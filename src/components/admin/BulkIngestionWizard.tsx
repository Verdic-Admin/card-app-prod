'use client'
import { useState, useCallback, useEffect } from 'react'
import {
  Upload, Loader2, Play, CheckCircle2, Wand2,
  RefreshCw, Trash2, Send, Scissors, DollarSign
} from 'lucide-react'
import { pollScannerResult, identifyCardDirectAction, identifyCardBatchAction } from '@/app/actions/visionSync'
import type { BatchIdentifyResultItem } from '@/app/actions/visionSync'
import {
  stagePairedUploadAction,
  listScanStagingAction,
  submitStagingRowToScannerAction,
  finalizeStagingScanAction,
  promoteRawStagingToCroppedAction,
  updateDraftCardAction,
  publishDraftCardsAction,
  applyStagingDraftFieldPricingAction,
  applyStagingDraftImagePricingAction,
  applyStagingDraftBatchPricingAction,
} from '@/app/actions/drafts'
import { deleteStagingCardsAction } from '@/app/actions/inventory'
import { DropZone } from '@/components/admin/DropZone'
import { TaxonomySearch } from '@/components/admin/TaxonomySearch'
import { normalizeCardNumberForPlayerIndex } from '@/lib/player-index-deeplink'
import { InstructionTrigger } from '@/components/admin/DraggableGuide'
import { useToastContext } from '@/components/admin/ToastProvider'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StagingCard {
  id: string
  player_name: string
  team_name: string
  card_set: string
  card_number: string
  insert_name: string
  parallel_name: string
  print_run: string
  listed_price: string
  image_url: string | null
  back_image_url: string | null
  raw_front_url?: string | null
  raw_back_url?: string | null
  is_rookie: boolean
  is_auto: boolean
  is_relic: boolean
  grading_company: string
  grade: string
  confidence?: number
  ai_status?: string
  repricing?: boolean
  team_name_source?: 'ocr_back' | 'ocr_with_db_conflict' | 'catalog_db' | 'none' | null
  team_name_confidence?: number | null
  team_name_verified?: boolean | null
}

function isPendingScan(c: StagingCard): boolean {
  return !!c.raw_front_url && !c.image_url
}

function rowToStagingCard(row: Record<string, unknown>): StagingCard {
  return {
    id: String(row.id),
    player_name:      String(row.player_name ?? ''),
    team_name:        String(row.team_name ?? ''),
    card_set:         String(row.card_set ?? ''),
    card_number:      String(row.card_number ?? ''),
    insert_name:      String(row.insert_name ?? ''),
    parallel_name:    String(row.parallel_name ?? ''),
    print_run:        row.print_run != null ? String(row.print_run) : '',
    listed_price:     row.listed_price != null ? String(row.listed_price) : '',
    image_url:        (row.image_url as string) ?? null,
    back_image_url:   (row.back_image_url as string) ?? null,
    raw_front_url:    (row.raw_front_url as string) ?? null,
    raw_back_url:     (row.raw_back_url as string) ?? null,
    is_rookie:        Boolean(row.is_rookie ?? false),
    is_auto:          Boolean(row.is_auto ?? false),
    is_relic:         Boolean(row.is_relic ?? false),
    grading_company:  String(row.grading_company ?? ''),
    grade:            String(row.grade ?? ''),
  }
}



// ─── Main Component ───────────────────────────────────────────────────────────

export function BulkIngestionWizard() {
  // Batch matrix upload
  const [batchFront, setBatchFront] = useState<File | null>(null)
  const [batchBack, setBatchBack] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  // Step 2 — scanning spinner
  const [scanJobId, setScanJobId] = useState<string | null>(null)
  const [scanProgress, setScanProgress] = useState('')
  const [identProgress, setIdentProgress] = useState('')



  // Step 5 -> 3 review
  const [reviewCards, setReviewCards] = useState<StagingCard[]>([])
  const [reviewSelected, setReviewSelected] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'staging' | 'cropped' | 'identified' | 'priced'>('staging')
  const [isPublishing, setIsPublishing] = useState(false)
  const [isDiscarding, setIsDiscarding] = useState(false)
  /** Cards explicitly moved to the Priced phase (prevents auto-move while typing price) */
  const [pricedIds, setPricedIds] = useState<Set<string>>(new Set())

  // Wizard: 1 Upload → 2 Process → 3 Publish
  const [step, setStep] = useState<1 | 2 | 3>(3)
  const [isSendingToScanner, setIsSendingToScanner] = useState(false)
  /** HSV mat keying for OpenCV — use Green/Blue when your scan pad matches; improves crop detection vs gray Canny. */
  const [scannerMat, setScannerMat] = useState<'none' | 'green' | 'blue'>('green')

  // Image zoom lightbox
  const [zoomedImg, setZoomedImg] = useState<string | null>(null)

  const { showToast, showConfirm } = useToastContext()

  const creditsExhausted = useCallback(() => {
    window.dispatchEvent(new CustomEvent('api-credits-exhausted'))
    window.location.href = '/admin/billing'
  }, [])

  useEffect(() => {
    listScanStagingAction('matrix')
      .then((rows) => {
        if (!rows?.length) return
        const loaded = (rows as Record<string, unknown>[]).map(rowToStagingCard)
        setReviewCards(loaded)
        setReviewSelected(new Set(loaded.map(x => x.id)))
        // Auto-mark cards that already have a price as priced
        const alreadyPriced = new Set(loaded.filter(c => parseFloat(String(c.listed_price)) > 0 && !!c.player_name).map(c => c.id))
        if (alreadyPriced.size) setPricedIds(alreadyPriced)
      })
      .catch(() => {})
  }, [])

  const pollScannerUntilDone = useCallback(async (jobId: string) => {
    for (;;) {
      const res = await pollScannerResult(jobId)
      if (res.status === 'processing' || res.status === 'pending') {
        setScanProgress(`Cropping cards… (${res.total_pairs} pairs detected)`)
        await new Promise((r) => setTimeout(r, 2000))
        continue
      }
      if (res.status === 'failed') {
        throw new Error(res.error || 'Scanner failed')
      }
      if (res.status === 'complete') {
        if (!res.cards?.length) {
          throw new Error('Scanner returned no card pairs.')
        }
        return res.cards
      }
      throw new Error(`Unexpected scanner status: ${res.status}`)
    }
  }, [])

  // ── Step 1: paired upload → staging (free, no scanner) ─────────────────────

  const handleCrop = async (id: string) => {
    setIsSendingToScanner(true)
    setScanJobId(id)
    setScanProgress('Uploading scan job…')
    setStep(2)
    try {
      const { job_id } = await submitStagingRowToScannerAction(
        id,
        scannerMat === 'none' ? undefined : { chroma: scannerMat }
      )
      const cropped = await pollScannerUntilDone(job_id)
      const newRows = await finalizeStagingScanAction(
        id,
        cropped.map((c) => ({ side_a_url: c.side_a_url, side_b_url: c.side_b_url }))
      )
      const added = (newRows as Record<string, unknown>[]).map((r) => rowToStagingCard(r))
      
      setReviewCards(prev => [...added, ...prev.filter(c => c.id !== id)])
      setReviewSelected(prev => {
        const next = new Set(prev)
        next.delete(id)
        added.forEach(u => next.add(u.id))
        return next
      })
    } catch (e: any) {
      showToast('Crop failed: ' + e.message, 'error')
    } finally {
      setIsSendingToScanner(false)
      setScanJobId(null)
      setStep(3)
    }
  }

  const handleIdentify = async (id: string) => {
    const c = reviewCards.find(x => x.id === id)
    if (!c || !c.image_url) return
    setReviewCards(prev => prev.map(x => x.id === id ? { ...x, ai_status: 'Identifying...' } : x))
    try {
      const res = await identifyCardDirectAction(c.id, c.image_url, c.back_image_url)
      const confidence = res.confidence ?? 0
      const aiStatus = confidence >= 0.85 ? 'High Confidence' : 'Manual Correction'
      
      const aiTeam = (res.team_name ?? '').trim()
      const mergedTeam = aiTeam || c.team_name
      const mergedPrint = res.print_run != null && Number.isFinite(Number(res.print_run)) ? String(res.print_run) : c.print_run
      const mergedCardNum = normalizeCardNumberForPlayerIndex((res.card_number && String(res.card_number).trim()) ? res.card_number : c.card_number) || c.card_number

      const updates = {
        player_name:   res.player_name   || c.player_name,
        team_name:     mergedTeam,
        card_set:      res.card_set       || c.card_set,
        card_number:   mergedCardNum,
        insert_name:   res.insert_name    || c.insert_name,
        parallel_name: res.parallel_name  || c.parallel_name,
        print_run:     mergedPrint,
        confidence,
        ai_status: aiStatus,
        team_name_source: res.team_name_source,
        team_name_confidence: res.team_name_confidence,
        team_name_verified: res.team_name_verified,
      }

      setReviewCards(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x))
      
      await updateDraftCardAction(id, {
        ...updates,
        print_run: (() => { const n = parseInt(String(mergedPrint ?? '').replace(/\D/g, ''), 10); return Number.isFinite(n) ? n : null })()
      })
    } catch (e: any) {
      if (e.message === 'credits_exhausted') { creditsExhausted(); return }
      setReviewCards(prev => prev.map(x => x.id === id ? { ...x, ai_status: 'Failed', confidence: 0 } : x))
      showToast('Identify failed: ' + e.message, 'error')
    }
  }

  const [isIdentifyingAll, setIsIdentifyingAll] = useState(false)

  const handleIdentifyAll = async () => {
    const visibleCards = reviewCards.filter(c => !isPendingScan(c) && !c.player_name && !(parseFloat(String(c.listed_price)) > 0))
    if (!visibleCards.length) {
      showToast('No un-identified cards on this tab.', 'info')
      return
    }
    setIsIdentifyingAll(true)

    // Mark all as identifying
    setReviewCards(prev => prev.map(x =>
      visibleCards.some(v => v.id === x.id) ? { ...x, ai_status: 'Identifying...' } : x
    ))

    try {
      // Chunk into batches of 9 (backend enforces max_length=9 per request)
      const BATCH_SIZE = 9
      const allResults: any[] = []

      for (let i = 0; i < visibleCards.length; i += BATCH_SIZE) {
        const chunk = visibleCards.slice(i, i + BATCH_SIZE)
        const { results } = await identifyCardBatchAction(
          chunk.map(c => ({
            queue_id: c.id,
            side_a_url: c.image_url!,
            side_b_url: c.back_image_url || null,
          }))
        )
        allResults.push(...results)
      }

      for (const r of allResults) {
        if (r.status === 'error') {
          setReviewCards(prev => prev.map(x =>
            x.id === r.queue_id ? { ...x, ai_status: 'Failed — Retry', confidence: 0 } : x
          ))
          continue
        }
        // Inline normalize: extract fields from card_details
        const cd = r.card_details ?? {} as Record<string, unknown>
        const rawPr = cd.print_run
        let printRunParsed: number | null = null
        if (typeof rawPr === 'number' && Number.isFinite(rawPr)) {
          printRunParsed = Math.trunc(rawPr)
        } else if (rawPr != null && String(rawPr).trim() !== '') {
          const digits = String(rawPr).replace(/\D/g, '')
          if (digits) { const n = parseInt(digits, 10); if (Number.isFinite(n)) printRunParsed = n }
        }
        const res = {
          status: r.status,
          confidence: r.confidence ?? 0,
          player_name: (cd.player_name as string) ?? null,
          card_set: (cd.card_set as string) ?? null,
          card_number: (cd.card_number as string) ?? null,
          insert_name: (cd.insert_name as string) ?? null,
          parallel_name: (cd.parallel_type as string) ?? null,
          team_name: (cd.team_name as string) ?? null,
          team_name_source: (cd.team_name_source as string) ?? null,
          team_name_confidence: typeof cd.team_name_confidence === 'number' ? cd.team_name_confidence : null,
          team_name_verified: typeof cd.team_name_verified === 'boolean' ? cd.team_name_verified : null,
          print_run: printRunParsed,
        }

        const card = visibleCards.find(c => c.id === r.queue_id)
        if (!card) continue

        const confidence = res.confidence ?? 0
        const aiStatus = confidence >= 0.85 ? 'High Confidence' : 'Manual Correction'
        const aiTeam = (res.team_name ?? '').trim()
        const mergedTeam = aiTeam || card.team_name
        const mergedPrint = res.print_run != null && Number.isFinite(Number(res.print_run)) ? String(res.print_run) : card.print_run
        const mergedCardNum = normalizeCardNumberForPlayerIndex((res.card_number && String(res.card_number).trim()) ? res.card_number : card.card_number) || card.card_number

        const updates = {
          player_name:   res.player_name   || card.player_name,
          team_name:     mergedTeam,
          card_set:      res.card_set       || card.card_set,
          card_number:   mergedCardNum,
          insert_name:   res.insert_name    || card.insert_name,
          parallel_name: res.parallel_name  || card.parallel_name,
          print_run:     mergedPrint,
          confidence,
          ai_status: aiStatus,
          team_name_source: res.team_name_source as 'ocr_back' | 'ocr_with_db_conflict' | 'catalog_db' | 'none' | null,
          team_name_confidence: res.team_name_confidence,
          team_name_verified: res.team_name_verified,
        }

        setReviewCards(prev => prev.map(x => x.id === r.queue_id ? { ...x, ...updates } : x))

        // Persist to DB in background (fire and forget)
        updateDraftCardAction(r.queue_id, {
          ...updates,
          print_run: (() => { const n = parseInt(String(mergedPrint ?? '').replace(/\D/g, ''), 10); return Number.isFinite(n) ? n : null })()
        }).catch(() => {})
      }

      const tokensUsed = Math.ceil(visibleCards.length / BATCH_SIZE)
      showToast(`Batch identified ${allResults.length} card(s) using ${tokensUsed} token(s).`, 'success')
    } catch (e: any) {
      if (e.message === 'credits_exhausted') { creditsExhausted(); return }
      showToast('Batch identify failed: ' + e.message, 'error')
      // Reset all to allow retry
      setReviewCards(prev => prev.map(x =>
        visibleCards.some(v => v.id === x.id) ? { ...x, ai_status: undefined } : x
      ))
    } finally {
      setIsIdentifyingAll(false)
    }
  }

  const [isCroppingAll, setIsCroppingAll] = useState(false)

  const handleCropAll = async () => {
    const visibleCards = reviewCards.filter(c => isPendingScan(c))
    if (!visibleCards.length) {
      showToast('No raw scan pairs on this tab.', 'info')
      return
    }
    setIsCroppingAll(true)
    for (const card of visibleCards) {
      await handleCrop(card.id)
    }
    setIsCroppingAll(false)
  }

  const handleUpload = async (front: File, back: File) => {
    setBatchFront(front)
    setBatchBack(back)
    setIsUploading(true)
    try {
      const fd = new FormData()
      fd.append('front', front)
      fd.append('back', back)
      fd.append('kind', 'matrix')
      const row = await stagePairedUploadAction(fd)
      const card = rowToStagingCard(row as Record<string, unknown>)
      setBatchFront(null)
      setBatchBack(null)
      setReviewCards(prev => [card, ...prev])
      setReviewSelected(prev => { const n = new Set(prev); n.add(card.id); return n })
      showToast('Batch pair staged successfully.', 'success')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      showToast('Upload failed: ' + msg, 'error')
      setBatchFront(null)
      setBatchBack(null)
    } finally {
      setIsUploading(false)
    }
  }

  const handleReviewDiscard = async () => {
    const ids = [...reviewSelected]
    if (!ids.length) return
    setIsDiscarding(true)
    try {
      const del = await deleteStagingCardsAction(ids)
      if (!del.success) {
        showToast('Discard failed: ' + del.error, 'error')
        return
      }
      const remaining = reviewCards.filter(c => !reviewSelected.has(c.id))
      setReviewCards(remaining)
      setReviewSelected(new Set(remaining.map(c => c.id)))
      if (remaining.length === 0) resetWizard()
    } finally {
      setIsDiscarding(false)
    }
  }
  // ── Step 5: re-price a single card ────────────────────────────────────────

  const handleReprice = async (id: string, imageUrl: string) => {
    setReviewCards(prev => prev.map(c => c.id === id ? { ...c, repricing: true } : c))
    try {
      const result = await applyStagingDraftImagePricingAction(id, imageUrl)
      if (!result.success) {
        if (result.error === 'credits_exhausted') {
          creditsExhausted()
          return
        }
        showToast('Re-price failed: ' + result.error, 'error')
        setReviewCards(prev => prev.map(c => (c.id === id ? { ...c, repricing: false } : c)))
        return
      }
      const newPrice =
        result.listed_price != null && Number.isFinite(result.listed_price)
          ? String(result.listed_price)
          : ''
      setReviewCards(prev => prev.map(c =>
        c.id === id
          ? {
              ...c,
              repricing: false,
              listed_price: newPrice,
              confidence: result.confidence ?? c.confidence,
              ai_status: result.ai_status ?? c.ai_status,
              player_name: result.player_name || c.player_name,
              card_set: result.card_set || c.card_set,
              card_number: result.card_number || c.card_number,
              insert_name: result.insert_name || c.insert_name,
              parallel_name: result.parallel_name || c.parallel_name,
            }
          : c,
      ))
    } catch (e: any) {
      if (e.message === 'credits_exhausted') {
        creditsExhausted()
        return
      }
      showToast('Re-price failed: ' + e.message, 'error')
      setReviewCards(prev => prev.map(c => c.id === id ? { ...c, repricing: false } : c))
    }
  }

  const handlePriceFromFields = async (id: string) => {
    const card = reviewCards.find(c => c.id === id)
    if (!card || !card.player_name) {
      showToast('Fill in at least Player Name and Card Set before pricing from fields.', 'info')
      return
    }
    setReviewCards(prev => prev.map(c => c.id === id ? { ...c, repricing: true } : c))
    try {
      const res = await applyStagingDraftFieldPricingAction(id)
      if (!res.success) {
        if (res.error === 'credits_exhausted') {
          creditsExhausted()
          return
        }
        throw new Error(res.error)
      }
      const newPrice =
        res.listed_price != null && Number.isFinite(res.listed_price)
          ? String(res.listed_price)
          : ''
      setReviewCards(prev => prev.map(c => (c.id === id ? { ...c, repricing: false, listed_price: newPrice } : c)))
    } catch (e: any) {
      showToast('Pricing failed: ' + e.message, 'error')
      setReviewCards(prev => prev.map(c => c.id === id ? { ...c, repricing: false } : c))
    }
  }

  const [isPricingAll, setIsPricingAll] = useState(false)

  const handlePriceAll = async () => {
    const visibleCards = reviewCards.filter(c =>
      !!c.player_name && !(parseFloat(String(c.listed_price)) > 0)
    )
    if (!visibleCards.length) {
      showToast('No cards with a Player Name on this tab to price.', 'info')
      return
    }
    setIsPricingAll(true)

    // Mark all as repricing
    setReviewCards(prev => prev.map(c =>
      visibleCards.some(v => v.id === c.id) ? { ...c, repricing: true } : c
    ))

    try {
      const batchRes = await applyStagingDraftBatchPricingAction(
        visibleCards.map(c => c.id)
      )

      if (!batchRes.success) {
        if (batchRes.error === 'credits_exhausted') {
          creditsExhausted()
          return
        }
        showToast('Batch pricing failed: ' + (batchRes.error || 'Unknown error'), 'error')
        setReviewCards(prev => prev.map(c =>
          visibleCards.some(v => v.id === c.id) ? { ...c, repricing: false } : c
        ))
        return
      }

      // Map results back to cards
      for (const r of batchRes.results) {
        if (r.success && r.listed_price != null) {
          setReviewCards(prev => prev.map(c =>
            c.id === r.id ? { ...c, repricing: false, listed_price: String(r.listed_price) } : c
          ))
        } else {
          setReviewCards(prev => prev.map(c =>
            c.id === r.id ? { ...c, repricing: false } : c
          ))
        }
      }

      const priced = batchRes.results.filter(r => r.success).length
      showToast(`Batch priced ${priced} card(s) with 1 token.`, 'success')
    } catch (e: any) {
      if (e.message === 'credits_exhausted') { creditsExhausted(); return }
      showToast('Batch pricing failed: ' + e.message, 'error')
      setReviewCards(prev => prev.map(c =>
        visibleCards.some(v => v.id === c.id) ? { ...c, repricing: false } : c
      ))
    } finally {
      setIsPricingAll(false)
    }
  }

  const updateReviewField = async (id: string, field: keyof StagingCard, value: string | boolean) => {
    setReviewCards(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  const saveReviewField = async (id: string, field: string, value: string) => {
    try { await updateDraftCardAction(id, { [field]: value }) } catch {}
  }

  const applyReviewTaxonomy = async (id: string, data: { player_name: string; card_set: string; card_number: string }) => {
    setReviewCards(prev => prev.map(c => c.id === id ? { ...c, ...data } : c))
    await updateDraftCardAction(id, data)
  }

  const toggleReviewSelect = (id: string) => {
    setReviewSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const handlePublish = async () => {
    const ids = [...reviewSelected]
    if (!ids.length) return
    setIsPublishing(true)
    try {
      const pub = await publishDraftCardsAction(ids)
      if (!pub.success) {
        showToast('Publish failed: ' + pub.error, 'error')
        return
      }
      const discard = reviewCards.filter(c => !reviewSelected.has(c.id)).map(c => c.id)
      if (discard.length) {
        const del = await deleteStagingCardsAction(discard)
        if (!del.success) {
          showToast('Cards were published to inventory, but removing the other drafts failed: ' + del.error, 'error')
        }
      }
      resetWizard()
    } finally {
      setIsPublishing(false)
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  const resetWizard = () => {
    setStep(1)
    setBatchFront(null); setBatchBack(null)
    setScanJobId(null); setScanProgress('')
    setIdentProgress('')
    setReviewCards([]); setReviewSelected(new Set())
  }

  // ─── Render ───────────────────────────────────────────────────────────────


  // ── Phase classification helpers ──────────────────────────────────────────
  /** Raw upload, not yet cropped */
  const isPhaseStaging = (c: StagingCard) => isPendingScan(c)
  /** Cropped, not yet AI identified */
  const isPhaseCropped = (c: StagingCard) => !isPendingScan(c) && !c.player_name && !pricedIds.has(c.id)
  /** AI identified (has player_name), NOT yet explicitly moved to priced */
  const isPhaseIdentified = (c: StagingCard) => !isPendingScan(c) && !!c.player_name && !pricedIds.has(c.id)
  /** Explicitly moved to priced — only via button, never auto */
  const isPhasePriced = (c: StagingCard) => pricedIds.has(c.id)

  /** Move selected cards to the Priced tab */
  const handleMoveToPriced = () => {
    const ids = reviewCards.filter(isPhaseIdentified).filter(c => reviewSelected.has(c.id)).map(c => c.id)
    if (!ids.length) { showToast('Select identified cards to move to Priced.', 'info'); return }
    setPricedIds(prev => { const n = new Set(prev); ids.forEach(id => n.add(id)); return n })
    showToast(`${ids.length} card(s) moved to Priced.`, 'success')
  }

  /** Move a single card to Cropped (skip crop for already-cropped singles) */
  const handleSkipToCropped = async (id: string) => {
    try {
      const rows = await promoteRawStagingToCroppedAction([id])
      const updated = (rows as Record<string, unknown>[]).map(rowToStagingCard)
      setReviewCards(prev => prev.map(c => c.id === id ? (updated[0] ?? c) : c))
      showToast('Moved to Cropped.', 'success')
    } catch (e: any) {
      showToast('Skip failed: ' + e.message, 'error')
    }
  }

  const phaseFilter = (c: StagingCard) => {
    if (activeTab === 'staging') return isPhaseStaging(c)
    if (activeTab === 'cropped') return isPhaseCropped(c)
    if (activeTab === 'identified') return isPhaseIdentified(c)
    return isPhasePriced(c)
  }

  return (
    <div className="bg-surface rounded-xl shadow-sm border border-border p-6 relative overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-brand/10 text-brand rounded-lg shadow-sm border border-brand/20">
          <Wand2 className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">
            Player Index Batch Importer
            <InstructionTrigger 
              title="Bulk Ingestion & AI Pipeline Guide" 
              steps={[
                { 
                  title: "1. Photographing Your Cards (The 'Matrix')", 
                  content: "For bulk 'matrix' uploads (multiple cards in one photo), place your cards on a solid, contrasting background. A Green or Blue mat works best for the AI's OpenCV edge detection. Ensure good, even lighting to minimize foil glare, and leave a little space between each card so their edges do not touch." 
                },
                { 
                  title: "2. Photographing the Backs", 
                  content: "The AI scanner absolutely requires a paired back image to function. After taking the photo of the card fronts, flip the cards over in the exact same grid arrangement and take your second photo. This allows the AI to correctly pair the front and back of each specific card." 
                },
                { 
                  title: "3. Uploading & Cropping", 
                  content: "Upload your paired front and back photos, selecting 'batch' for matrix sheets or 'single' for individual cards. Click 'Crop All' to send them to the vision scanner, which will automatically slice the sheet into individual, perfectly paired card rows." 
                },
                { 
                  title: "4. Identify & Classify", 
                  content: "Run the 'Identify' step. The AI reads the card text to find the Player Name, Set, Card Number, and Parallels. High-confidence matches are tagged automatically; low-confidence ones are flagged for your manual review." 
                },
                { 
                  title: "5. Oracle Pricing", 
                  content: "Hit 'Price All' to query the Player Index Oracle. It calculates real-time market values based on recent comps and automatically applies your store's global discount percentage." 
                },
                { 
                  title: "6. Review & Publish", 
                  content: "Double-check the AI's work in the review table. Fix any misread fields, select the ready cards, and click 'Publish' to instantly move them to your live store inventory." 
                }
              ]} 
            />
          </h2>
          <p className="text-sm font-medium text-muted">Upload → Crop → Identify → Edit & Price → Publish</p>
        </div>
      </div>

      {/* ── Processing overlay ────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="text-center py-20 animate-in fade-in">
          <Loader2 className="w-14 h-14 animate-spin text-brand mx-auto mb-5" />
          <h3 className="text-2xl font-black text-foreground mb-2">Processing Cards</h3>
          <p className="text-muted font-medium">
             {isSendingToScanner ? scanProgress : identProgress || 'Processing…'}
          </p>
        </div>
      )}

      {/* ── Pipeline View ─────────────────────────────────────────────────── */}
      {step !== 2 && (

        <div className="space-y-5 animate-in fade-in">

          {/* Inline upload — visible when Staging tab is active */}
          {activeTab === 'staging' && (
            <div className="border border-border rounded-xl p-4 bg-surface/50 space-y-3">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-brand" />
                <span className="text-sm font-black text-foreground">Upload Batch Matrix Pair</span>
              </div>

              {/* Single file picker — select 2 images (front matrix + back matrix) */}
              <div
                className={`border-2 border-dashed ${isUploading ? 'border-brand/50 bg-brand/10 opacity-70 pointer-events-none' : 'border-brand/30 bg-brand/5 hover:bg-surface-hover cursor-pointer'} rounded-xl p-4 flex flex-col items-center justify-center transition`}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault()
                  if (isUploading) return
                  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')).slice(0, 2)
                  if (files.length === 2) {
                    handleUpload(files[0], files[1])
                  }
                }}
                onClick={() => !isUploading && document.getElementById('pair-upload')?.click()}
              >
                {isUploading ? (
                  <Loader2 className="w-8 h-8 text-brand animate-spin mb-2" />
                ) : (
                  <Upload className="w-6 h-6 text-brand/70 mb-2" />
                )}
                
                {isUploading ? (
                  <div className="text-center">
                    <p className="text-sm font-bold text-brand">Uploading Batch...</p>
                  </div>
                ) : batchFront ? (
                  <div className="text-center">
                    <p className="text-xs font-bold text-brand">Front: {batchFront?.name}</p>
                    <p className="text-xs font-bold text-brand">Back: {batchBack?.name || 'Not selected'}</p>
                  </div>
                ) : (
                  <span className="text-sm font-bold text-brand">
                    Select or drop 2 images (Front Matrix + Back Matrix)
                  </span>
                )}
                <input id="pair-upload" type="file" accept="image/*" multiple className="hidden"
                  onChange={e => {
                    if (isUploading) return
                    const files = Array.from(e.target.files || []).slice(0, 2)
                    if (files.length >= 2) {
                      handleUpload(files[0], files[1])
                    } else if (files.length === 1) {
                      setBatchFront(files[0])
                      setBatchBack(null)
                    }
                    e.target.value = ''
                  }}
                />
                {!isUploading && (
                  <span className="text-[10px] text-muted mt-1">Select exactly 2 images — first is Front, second is Back</span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-muted">Mat:</span>
                  {(['none', 'green', 'blue'] as const).map(id => (
                    <label key={id} className="flex items-center gap-1 cursor-pointer">
                      <input type="radio" name="scannerMat" checked={scannerMat === id} onChange={() => setScannerMat(id)} className="accent-brand w-3 h-3" />
                      <span className="text-[10px] font-semibold text-foreground capitalize">{id}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          {/* Pipeline Tabs */}
          <div className="flex gap-1 bg-surface border border-border rounded-lg p-1 w-full max-w-2xl">
            {([
              { key: 'staging' as const, label: 'Staging', filter: isPhaseStaging },
              { key: 'cropped' as const, label: 'Cropped', filter: isPhaseCropped },
              { key: 'identified' as const, label: 'Identified', filter: isPhaseIdentified },
              { key: 'priced' as const, label: 'Priced', filter: isPhasePriced },
            ]).map(tab => {
              const count = reviewCards.filter(tab.filter).length
              return (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 py-2 text-xs font-black rounded-md transition ${activeTab === tab.key ? 'bg-brand text-brand-foreground shadow' : 'text-muted hover:text-foreground'}`}>
                  {tab.label} ({count})
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => setReviewSelected(new Set(reviewCards.filter(phaseFilter).map(c => c.id)))}
              className="text-xs font-bold text-brand hover:underline">Select All on Tab</button>
            <span className="text-muted text-xs">·</span>
            <button onClick={() => setReviewSelected(new Set())}
              className="text-xs font-bold text-muted hover:underline">Deselect All</button>
            <span className="ml-auto text-xs text-muted font-medium">{reviewSelected.size} selected</span>
          </div>

          <div className="space-y-3 max-h-[72vh] overflow-y-auto pr-1">
            {reviewCards
              .filter(phaseFilter)
              .map(card => (
                <div key={card.id}
                  className={`border rounded-xl p-3 bg-surface transition ${reviewSelected.has(card.id) ? 'border-brand/50' : 'border-border opacity-60'}`}>
                  <div className="flex gap-3">
                    {/* Images — front + back side by side, click to zoom */}
                    <div className="flex-shrink-0 flex gap-2">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[9px] font-bold text-muted uppercase tracking-wide">Front</span>
                        {card.image_url ? (
                          <img src={card.image_url} alt="front" onClick={() => setZoomedImg(card.image_url!)}
                            className="w-28 h-40 object-contain rounded-lg border border-border bg-surface cursor-zoom-in hover:border-brand/50 transition" />
                        ) : card.raw_front_url ? (
                          <img src={card.raw_front_url} alt="front raw" onClick={() => setZoomedImg(card.raw_front_url!)}
                            className="w-28 h-40 object-contain rounded-lg border border-border bg-surface cursor-zoom-in hover:border-brand/50 transition" />
                        ) : (
                          <div className="w-28 h-40 rounded-lg border border-border bg-surface-hover flex items-center justify-center text-muted text-[10px] text-center p-1">
                            No image
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[9px] font-bold text-muted uppercase tracking-wide">Back</span>
                        {card.back_image_url ? (
                          <img src={card.back_image_url} alt="back" onClick={() => setZoomedImg(card.back_image_url!)}
                            className="w-28 h-40 object-contain rounded-lg border border-border bg-surface cursor-zoom-in hover:border-brand/50 transition" />
                        ) : card.raw_back_url ? (
                          <img src={card.raw_back_url} alt="back raw" onClick={() => setZoomedImg(card.raw_back_url!)}
                            className="w-28 h-40 object-contain rounded-lg border border-border bg-surface cursor-zoom-in hover:border-brand/50 transition" />
                        ) : (
                          <div className="w-28 h-40 rounded-lg border border-border bg-surface-hover flex items-center justify-center text-muted text-[10px] text-center p-1">
                            No image
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Fields */}
                    <div className="flex-1 space-y-1.5">
                      {/* Confidence badge */}
                      {!isPendingScan(card) && (
                        <div className="flex items-center gap-2">
                          {card.confidence !== undefined && (
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                              card.confidence > 0.85
                                ? 'bg-emerald-500/20 text-emerald-500'
                                : 'bg-orange-500/20 text-orange-500'
                            }`}>
                              {(card.confidence * 100).toFixed(0)}% confidence
                            </span>
                          )}
                          {card.ai_status && (
                            <span className="text-[10px] text-muted font-medium">{card.ai_status}</span>
                          )}
                          {!card.player_name && (
                            <button
                              onClick={() => handleIdentify(card.id)}
                              disabled={card.ai_status === 'Identifying...'}
                              className="ml-auto flex items-center gap-1 text-xs font-bold text-brand hover:text-brand-hover disabled:opacity-40 transition"
                            >
                              {card.ai_status === 'Identifying...' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                              Identify AI
                            </button>
                          )}
                        </div>
                      )}
                      
                      {isPendingScan(card) && (
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-bold text-muted uppercase tracking-wide">Raw Scan Pair</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSkipToCropped(card.id)}
                              className="flex items-center gap-1 text-xs font-bold bg-surface border border-border text-foreground px-3 py-1.5 rounded-lg hover:bg-surface-hover transition"
                            >
                              Use As-Is
                            </button>
                            <button
                              onClick={() => handleCrop(card.id)}
                              disabled={scanJobId === card.id}
                              className="flex items-center gap-1 text-xs font-bold bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-500 disabled:opacity-40 transition"
                            >
                              {scanJobId === card.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Scissors className="w-3.5 h-3.5" />}
                              Crop & Rotate
                            </button>
                          </div>
                        </div>
                      )}

                      {!isPendingScan(card) && (
                        <>
                          {/* Taxonomy search for identified tab (manual correction) */}
                          {activeTab === 'identified' && (
                            <TaxonomySearch onSelect={data => applyReviewTaxonomy(card.id, data)} />
                          )}

                          <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { field: 'player_name', placeholder: 'Player Name' },
                          { field: 'team_name', placeholder: 'Team' },
                          { field: 'card_set', placeholder: 'Card Set' },
                          { field: 'card_number', placeholder: 'Card #' },
                          { field: 'insert_name', placeholder: 'Insert' },
                          { field: 'parallel_name', placeholder: 'Parallel' },
                          { field: 'print_run', placeholder: 'Print Run' },
                        ].map(({ field, placeholder }) => (
                          <input key={field}
                            value={(card as any)[field] || ''}
                            onChange={e => updateReviewField(card.id, field as keyof StagingCard, e.target.value)}
                            onBlur={e => saveReviewField(card.id, field, e.target.value)}
                            placeholder={placeholder}
                            className="border border-border rounded-md p-1.5 text-xs bg-surface text-foreground focus:ring-1 focus:ring-brand outline-none"
                          />
                        ))}
                      </div>
                      {card.team_name_source && card.team_name_source !== 'none' && (
                        <div className="text-[10px] text-muted font-medium bg-surface-hover border border-border rounded-md px-2 py-1">
                          Team source: {card.team_name_source}
                          {typeof card.team_name_confidence === 'number' ? ` · ${(card.team_name_confidence * 100).toFixed(0)}%` : ''}
                          {typeof card.team_name_verified === 'boolean'
                            ? card.team_name_verified
                              ? ' · DB verified'
                              : ' · OCR/DB conflict'
                            : ''}
                        </div>
                      )}

                      {/* Attribute flags */}
                      <div className="flex items-center gap-3 flex-wrap pt-0.5">
                        {([
                          { key: 'is_rookie', label: 'RC' },
                          { key: 'is_auto',   label: 'Auto' },
                          { key: 'is_relic',  label: 'Relic' },
                        ] as const).map(({ key, label }) => (
                          <label key={key} className="flex items-center gap-1 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={card[key]}
                              onChange={e => {
                                updateReviewField(card.id, key, e.target.checked as any)
                                updateDraftCardAction(card.id, { [key]: e.target.checked }).catch(() => {})
                              }}
                              className="w-3.5 h-3.5 accent-brand"
                            />
                            <span className="text-[10px] font-bold text-muted">{label}</span>
                          </label>
                        ))}
                        <label className="flex items-center gap-1 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={!!card.grading_company}
                            onChange={e => {
                              if (!e.target.checked) {
                                updateReviewField(card.id, 'grading_company', '')
                                updateReviewField(card.id, 'grade', '')
                                updateDraftCardAction(card.id, { grading_company: '', grade: '' }).catch(() => {})
                              } else {
                                updateReviewField(card.id, 'grading_company', 'PSA')
                              }
                            }}
                            className="w-3.5 h-3.5 accent-brand"
                          />
                          <span className="text-[10px] font-bold text-muted">Graded</span>
                        </label>
                        {!!card.grading_company && (
                          <>
                            <select
                              value={card.grading_company}
                              onChange={e => {
                                updateReviewField(card.id, 'grading_company', e.target.value)
                                updateDraftCardAction(card.id, { grading_company: e.target.value }).catch(() => {})
                              }}
                              className="border border-border rounded px-1.5 py-0.5 text-[10px] bg-surface text-foreground focus:ring-1 focus:ring-brand outline-none"
                            >
                              {['PSA', 'BGS', 'SGC', 'CGC', 'CSG'].map(g => <option key={g}>{g}</option>)}
                            </select>
                            <input
                              value={card.grade}
                              onChange={e => updateReviewField(card.id, 'grade', e.target.value)}
                              onBlur={e => updateDraftCardAction(card.id, { grade: e.target.value }).catch(() => {})}
                              placeholder="10"
                              className="border border-border rounded px-1.5 py-0.5 text-[10px] w-12 bg-surface text-foreground focus:ring-1 focus:ring-brand outline-none"
                            />
                          </>
                        )}
                      </div>

                      {/* Price + reprice + send to fintech */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-muted">$</span>
                        <input
                          type="number"
                          value={card.listed_price || ''}
                          onChange={e => updateReviewField(card.id, 'listed_price', e.target.value)}
                          onBlur={e => saveReviewField(card.id, 'price', e.target.value)}
                          placeholder="0.00"
                          className="border border-border rounded-md p-1.5 text-xs bg-surface text-foreground w-24 focus:ring-1 focus:ring-brand outline-none"
                        />
                        <button
                          onClick={() => card.image_url && handleReprice(card.id, card.image_url)}
                          disabled={card.repricing || !card.image_url}
                          className="flex items-center gap-1 text-xs font-bold text-brand hover:text-brand-hover disabled:opacity-40 transition"
                        >
                          {card.repricing
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <RefreshCw className="w-3.5 h-3.5" />}
                          Re-price
                        </button>
                        <button
                          onClick={() => handlePriceFromFields(card.id)}
                          disabled={card.repricing || !card.player_name}
                          className="flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 disabled:opacity-40 transition"
                          title="Send edited fields to fintech pricing engine"
                        >
                          {card.repricing
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <DollarSign className="w-3.5 h-3.5" />}
                          Send to Pricing
                        </button>
                        {activeTab === 'identified' && parseFloat(String(card.listed_price)) > 0 && (
                          <button
                            onClick={() => { setPricedIds(prev => { const n = new Set(prev); n.add(card.id); return n }); showToast('Moved to Priced.', 'success') }}
                            className="flex items-center gap-1 text-xs font-black bg-slate-800 text-white px-3 py-1 rounded-lg hover:bg-slate-700 transition ml-auto"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Move to Priced
                          </button>
                        )}
                      </div>
                      </>
                    )}
                    </div>

                    {/* Checkbox */}
                    <div className="flex-shrink-0 pt-1">
                      <input type="checkbox" checked={reviewSelected.has(card.id)}
                        onChange={() => toggleReviewSelect(card.id)}
                        className="w-5 h-5 accent-brand cursor-pointer" />
                    </div>
                  </div>
                </div>
              ))}
          </div>

          {/* Phase-specific action bar */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleReviewDiscard}
              disabled={reviewSelected.size === 0 || isDiscarding}
              className="bg-surface border border-border text-muted font-bold py-3 px-6 rounded-xl disabled:opacity-40 hover:bg-surface-hover hover:text-foreground transition flex items-center justify-center gap-2"
            >
              {isDiscarding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Discard Selected
            </button>

            {/* Staging: Crop All */}
            {activeTab === 'staging' && (
              <button
                onClick={handleCropAll}
                disabled={isCroppingAll || isPublishing}
                className="flex-1 bg-orange-600 text-white font-black py-3 rounded-xl disabled:opacity-40 hover:bg-orange-500 transition flex items-center justify-center gap-2"
              >
                {isCroppingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scissors className="w-4 h-4" />}
                Crop & Rotate All
              </button>
            )}

            {/* Cropped: Identify All */}
            {activeTab === 'cropped' && (
              <button
                onClick={handleIdentifyAll}
                disabled={isIdentifyingAll || isPublishing}
                className="flex-1 bg-brand text-brand-foreground font-black py-3 rounded-xl disabled:opacity-40 hover:bg-brand-hover transition flex items-center justify-center gap-2"
              >
                {isIdentifyingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                Identify All with AI
              </button>
            )}

            {/* Identified: Price All + Move to Priced */}
            {activeTab === 'identified' && (
              <>
                <button
                  onClick={handlePriceAll}
                  disabled={isPricingAll || isPublishing}
                  className="flex-1 bg-emerald-700 text-white font-black py-3 rounded-xl disabled:opacity-40 hover:bg-emerald-600 transition flex items-center justify-center gap-2"
                >
                  {isPricingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
                  Price All on Tab
                </button>
                <button
                  onClick={handleMoveToPriced}
                  className="flex-1 bg-slate-800 text-white font-black py-3 rounded-xl hover:bg-slate-700 transition flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Move Selected to Priced
                </button>
              </>
            )}

            {/* Priced: Publish */}
            {activeTab === 'priced' && (
              <button
                onClick={handlePublish}
                disabled={reviewSelected.size === 0 || isPublishing}
                className="flex-[2] bg-slate-900 text-white font-black text-lg py-4 rounded-xl disabled:opacity-40 hover:bg-brand transition flex items-center justify-center gap-3 drop-shadow-md"
              >
                {isPublishing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                Publish {reviewSelected.size > 0 ? `${reviewSelected.size} Cards` : 'Selected'} to Inventory
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Image zoom lightbox ─────────────────────────────────────────────── */}
      {zoomedImg && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setZoomedImg(null)}
        >
          <img
            src={zoomedImg}
            alt="zoomed card"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-2xl shadow-2xl ring-1 ring-white/10"
            onClick={e => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-5 text-white/70 hover:text-white text-3xl font-bold leading-none"
            onClick={() => setZoomedImg(null)}
            aria-label="Close"
          >
            ×
          </button>
        </div>
      )}

    </div>
  )
}
