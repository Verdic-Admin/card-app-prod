'use client'
import { useState, useCallback, useEffect } from 'react'
import {
  Upload, Loader2, Play, CheckCircle2, Wand2,
  RefreshCw, Trash2, Send, Eye, EyeOff, Scissors
} from 'lucide-react'
import { pollScannerResult, requestPricingAction } from '@/app/actions/visionSync'
import {
  stagePairedUploadAction,
  listScanStagingAction,
  submitStagingRowToScannerAction,
  finalizeStagingScanAction,
  promoteRawStagingToCroppedAction,
  updateDraftCardAction,
  publishDraftCardsAction,
} from '@/app/actions/drafts'
import { deleteStagingCardsAction } from '@/app/actions/inventory'
import { submitBatchIngestAction, checkBatchStatusAction } from '@/app/actions/oracleAPI'
import { TaxonomySearch } from '@/components/admin/TaxonomySearch'
import { InstructionTrigger } from '@/components/admin/DraggableGuide'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StagingCard {
  id: string
  player_name: string
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
  confidence?: number
  ai_status?: string
  repricing?: boolean
}

function isPendingScan(c: StagingCard): boolean {
  return !!c.raw_front_url && !c.image_url
}

function rowToStagingCard(row: Record<string, unknown>): StagingCard {
  return {
    id: String(row.id),
    player_name:   String(row.player_name ?? ''),
    card_set:      String(row.card_set ?? ''),
    card_number:   String(row.card_number ?? ''),
    insert_name:   String(row.insert_name ?? ''),
    parallel_name: String(row.parallel_name ?? ''),
    print_run:     row.print_run != null ? String(row.print_run) : '',
    listed_price:  row.listed_price != null ? String(row.listed_price) : '',
    image_url:     (row.image_url as string) ?? null,
    back_image_url:(row.back_image_url as string) ?? null,
    raw_front_url: (row.raw_front_url as string) ?? null,
    raw_back_url:  (row.raw_back_url as string) ?? null,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function DropZone({
  label, file, id, onFile
}: { label: string; file: File | null; id: string; onFile: (f: File) => void }) {
  return (
    <div>
      <label className="block text-xs font-black text-foreground mb-2 uppercase tracking-widest text-center">
        {label}
      </label>
      <div
        className="border-2 border-dashed border-brand/30 bg-brand/5 rounded-2xl h-48 flex flex-col items-center justify-center cursor-pointer hover:bg-surface-hover transition shadow-inner"
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onFile(f) }}
        onClick={() => document.getElementById(id)?.click()}
      >
        <Upload className="w-7 h-7 text-brand/70 mb-2" />
        <span className="text-sm font-bold text-brand text-center px-4">
          {file ? file.name : `Drop ${label}`}
        </span>
        <input id={id} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BulkIngestionWizard() {
  // Step 1 — upload
  const [uploadMode, setUploadMode] = useState<'batch' | 'single'>('batch')
  const [batchFront, setBatchFront] = useState<File | null>(null)
  const [batchBack, setBatchBack] = useState<File | null>(null)
  const [singleFront, setSingleFront] = useState<File | null>(null)
  const [singleBack, setSingleBack] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  // Step 2 — scanning spinner
  const [scanJobId, setScanJobId] = useState<string | null>(null)
  const [scanProgress, setScanProgress] = useState('')

  // Step 3 — staging grid
  const [staging, setStaging] = useState<StagingCard[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBack, setShowBack] = useState<Set<string>>(new Set())
  const [isPublishingAsIs, setIsPublishingAsIs] = useState(false)
  const [isDiscarding, setIsDiscarding] = useState(false)

  // Step 4 — AI identification spinner
  const [identJobId, setIdentJobId] = useState<string | null>(null)
  const [identProgress, setIdentProgress] = useState('')

  // Step 5 — review
  const [reviewCards, setReviewCards] = useState<StagingCard[]>([])
  const [reviewSelected, setReviewSelected] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'ready' | 'correction'>('ready')
  const [isPublishing, setIsPublishing] = useState(false)

  // Wizard: 1 Upload → 2 Staging → 3 Crop (spinner) → 4 AI → 5 Review
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [isSendingToScanner, setIsSendingToScanner] = useState(false)

  const creditsExhausted = useCallback(() => {
    window.dispatchEvent(new CustomEvent('api-credits-exhausted'))
    window.location.href = '/admin/billing'
  }, [])

  useEffect(() => {
    listScanStagingAction()
      .then((rows) => {
        if (!rows?.length) return
        setStaging((prev) => {
          const merged = new Map<string, StagingCard>()
          for (const p of prev) merged.set(p.id, p)
          for (const r of rows as Record<string, unknown>[]) {
            merged.set(String(r.id), rowToStagingCard(r))
          }
          return Array.from(merged.values()).sort((a, b) => (a.id < b.id ? 1 : -1))
        })
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

  const handleUpload = async () => {
    setIsUploading(true)
    try {
      if (uploadMode === 'batch') {
        if (!batchFront || !batchBack) return
        const fd = new FormData()
        fd.append('front', batchFront)
        fd.append('back', batchBack)
        fd.append('kind', 'matrix')
        const row = await stagePairedUploadAction(fd)
        const card = rowToStagingCard(row as Record<string, unknown>)
        setStaging((prev) => [card, ...prev])
        setSelectedIds((prev) => new Set([...prev, card.id]))
      } else {
        if (!singleFront || !singleBack) return
        const fd = new FormData()
        fd.append('front', singleFront)
        fd.append('back', singleBack)
        fd.append('kind', 'single_pair')
        const row = await stagePairedUploadAction(fd)
        const card = rowToStagingCard(row as Record<string, unknown>)
        setStaging((prev) => [card, ...prev])
        setSelectedIds((prev) => new Set([...prev, card.id]))
      }
      setBatchFront(null)
      setBatchBack(null)
      setSingleFront(null)
      setSingleBack(null)
      setStep(2)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      alert('Upload failed: ' + msg)
    } finally {
      setIsUploading(false)
    }
  }

  // ── Staging: send selected raw pairs to scanner (1 credit per pair sent) ─

  const handleSendSelectedToScanner = async () => {
    const pending = staging.filter((c) => selectedIds.has(c.id) && isPendingScan(c))
    if (!pending.length) {
      alert('Select one or more uncropped uploads (orange badge). Each sheet uses a paired front + back.')
      return
    }
    const missingBack = pending.filter((c) => !c.raw_back_url)
    if (missingBack.length) {
      alert('Scanner requires a back image for each selected upload. Re-stage with front + back, or use "Use as-is" only when both raw sides exist.')
      return
    }
    setIsSendingToScanner(true)
    setStep(3)
    try {
      for (const card of pending) {
        setScanProgress(`Uploading scan job…`)
        const { job_id } = await submitStagingRowToScannerAction(card.id)
        setScanJobId(job_id)
        const cropped = await pollScannerUntilDone(job_id)
        const newRows = await finalizeStagingScanAction(
          card.id,
          cropped.map((c) => ({ side_a_url: c.side_a_url, side_b_url: c.side_b_url }))
        )
        const added = (newRows as Record<string, unknown>[]).map((r) => rowToStagingCard(r))
        setStaging((prev) => {
          const rest = prev.filter((r) => r.id !== card.id)
          return [...added, ...rest]
        })
        setSelectedIds((prev) => {
          const n = new Set(prev)
          n.delete(card.id)
          added.forEach((a) => n.add(a.id))
          return n
        })
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg === 'credits_exhausted' || msg.includes('402') || msg.toLowerCase().includes('insufficient')) {
        creditsExhausted()
        return
      }
      alert('Scanner error: ' + msg)
    } finally {
      setIsSendingToScanner(false)
      setScanJobId(null)
      setScanProgress('')
      setStep(2)
    }
  }

  const handlePromoteRawAsCropped = async () => {
    const pending = staging.filter((c) => selectedIds.has(c.id) && isPendingScan(c))
    if (!pending.length) {
      alert('Select uncropped uploads to promote.')
      return
    }
    const missingBack = pending.filter((c) => !c.raw_back_url)
    if (missingBack.length) {
      alert('Use as-is requires a back image for each row. Upload paired front + back, then promote.')
      return
    }
    try {
      const ids = pending.map((c) => c.id)
      await promoteRawStagingToCroppedAction(ids)
      setStaging((prev) =>
        prev.map((c) =>
          ids.includes(c.id)
            ? {
                ...c,
                image_url: c.raw_front_url ?? null,
                back_image_url: c.raw_back_url ?? null,
                raw_front_url: null,
                raw_back_url: null,
              }
            : c
        )
      )
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      alert('Could not promote images: ' + msg)
    }
  }

  // ── Step 3: staging field updates (auto-save on blur) ─────────────────────

  const updateField = (id: string, field: keyof StagingCard, value: string) => {
    setStaging(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  const saveField = async (id: string, field: string, value: string) => {
    try {
      await updateDraftCardAction(id, { [field]: value })
    } catch (e) {
      console.warn('Auto-save failed for field', field, e)
    }
  }

  const applyTaxonomy = async (id: string, data: { player_name: string; card_set: string; card_number: string }) => {
    setStaging(prev => prev.map(c => c.id === id ? { ...c, ...data } : c))
    await updateDraftCardAction(id, data)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleBack = (id: string) => {
    setShowBack(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => setSelectedIds(new Set(staging.map(c => c.id)))
  const deselectAll = () => setSelectedIds(new Set())

  const handlePublishAsIs = async () => {
    const ids = staging
      .filter((c) => selectedIds.has(c.id) && c.image_url)
      .map((c) => c.id)
    if (!ids.length) {
      alert('Select cards that already have a front image (cropped or promoted).')
      return
    }
    setIsPublishingAsIs(true)
    try {
      await publishDraftCardsAction(ids)
      const remaining = staging.filter(c => !selectedIds.has(c.id))
      setStaging(remaining)
      setSelectedIds(new Set(remaining.map(c => c.id)))
      if (remaining.length === 0) resetWizard()
    } catch (e: any) {
      alert('Publish failed: ' + e.message)
    } finally {
      setIsPublishingAsIs(false)
    }
  }

  const handleDiscard = async () => {
    const ids = [...selectedIds]
    if (!ids.length) return
    setIsDiscarding(true)
    try {
      await deleteStagingCardsAction(ids)
      const remaining = staging.filter(c => !selectedIds.has(c.id))
      setStaging(remaining)
      setSelectedIds(new Set(remaining.map(c => c.id)))
      if (remaining.length === 0) resetWizard()
    } catch (e: any) {
      alert('Discard failed: ' + e.message)
    } finally {
      setIsDiscarding(false)
    }
  }

  // ── Step 3 → 4: send selected for AI identification ───────────────────────

  const handleIdentify = async () => {
    const selected = staging.filter((c) => selectedIds.has(c.id) && c.image_url)
    if (!selected.length) {
      alert('Select cropped cards with a front image (finish scanner or use as-is first).')
      return
    }
    const urls = selected.map((c) => c.image_url).filter(Boolean) as string[]
    if (!urls.length) {
      alert('No image URLs available for selected cards.')
      return
    }
    setStep(4)
    setIdentProgress(`Sending ${selected.length} cards for identification…`)
    try {
      const res = await submitBatchIngestAction('local_shop', urls)
      if (res.error === 'credits_exhausted') { creditsExhausted(); return }
      if (!res.success) throw new Error('Batch ingest rejected')
      const jobId = res.data.job_id
      setIdentJobId(jobId)
      pollIdent(jobId, selected)
    } catch (e: any) {
      alert('Identification failed: ' + e.message)
      setStep(2)
    }
  }

  // ── Step 4: poll orchestrator and write results back to staging ───────────

  const pollIdent = (jobId: string, selectedCards: StagingCard[]) => {
    const interval = setInterval(async () => {
      try {
        const res = await checkBatchStatusAction(jobId)
        if (res.error === 'credits_exhausted') { clearInterval(interval); creditsExhausted(); return }
        if (!res.success) { clearInterval(interval); setStep(2); return }
        const data = res.data
        if (data.status === 'processing') {
          setIdentProgress(`AI identifying… (${data.progress || ''})`)
          return
        }
        clearInterval(interval)
        if (data.status !== 'completed') { setStep(2); return }

        const allResults: any[] = [
          ...(data.summary?.ready_to_publish || []),
          ...(data.summary?.manual_correction_required || []),
        ]

        // Write AI results back to staging (match by position — orchestrator preserves order)
        const updates: StagingCard[] = [...staging]
        for (let i = 0; i < selectedCards.length; i++) {
          const result = allResults[i]
          if (!result) continue
          const stagingIdx = updates.findIndex(c => c.id === selectedCards[i].id)
          if (stagingIdx === -1) continue
          const updated: StagingCard = {
            ...updates[stagingIdx],
            player_name:   result.player_name   || updates[stagingIdx].player_name,
            card_set:      result.card_set       || updates[stagingIdx].card_set,
            card_number:   result.card_number    || updates[stagingIdx].card_number,
            insert_name:   result.insert_name    || updates[stagingIdx].insert_name,
            parallel_name: result.parallel_name  || updates[stagingIdx].parallel_name,
            listed_price:  String(result.pricing?.afv || updates[stagingIdx].listed_price || ''),
            confidence:    result.confidence,
            ai_status:     result.status,
          }
          updates[stagingIdx] = updated
          // Persist to DB
          updateDraftCardAction(updated.id, {
            player_name:   updated.player_name,
            card_set:      updated.card_set,
            card_number:   updated.card_number,
            insert_name:   updated.insert_name,
            parallel_name: updated.parallel_name,
            price:         updated.listed_price,
          }).catch(() => {})
        }

        setStaging(updates)
        setReviewCards(updates)
        setReviewSelected(new Set(updates.map(c => c.id)))
        setActiveTab('ready')
        setStep(5)
      } catch (e: any) {
        clearInterval(interval)
        alert('Identification poll error: ' + e.message)
        setStep(2)
      }
    }, 3000)
  }

  // ── Step 5: re-price a single card ────────────────────────────────────────

  const handleReprice = async (id: string, imageUrl: string) => {
    setReviewCards(prev => prev.map(c => c.id === id ? { ...c, repricing: true } : c))
    try {
      const result = await requestPricingAction(imageUrl)
      const newPrice = String(result.pricing?.afv || '')
      setReviewCards(prev => prev.map(c => c.id === id
        ? { ...c, repricing: false, listed_price: newPrice, confidence: result.confidence, ai_status: result.status,
            player_name: result.player_name || c.player_name,
            card_set: result.card_set || c.card_set,
            card_number: result.card_number || c.card_number,
            insert_name: result.insert_name || c.insert_name,
            parallel_name: result.parallel_name || c.parallel_name,
          }
        : c
      ))
      await updateDraftCardAction(id, {
        player_name: result.player_name,
        card_set: result.card_set,
        card_number: result.card_number,
        insert_name: result.insert_name,
        parallel_name: result.parallel_name,
        price: newPrice,
      })
    } catch (e: any) {
      if (e.message === 'credits_exhausted') { creditsExhausted(); return }
      alert('Re-price failed: ' + e.message)
      setReviewCards(prev => prev.map(c => c.id === id ? { ...c, repricing: false } : c))
    }
  }

  const updateReviewField = async (id: string, field: keyof StagingCard, value: string) => {
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
      await publishDraftCardsAction(ids)
      const discard = reviewCards.filter(c => !reviewSelected.has(c.id)).map(c => c.id)
      if (discard.length) await deleteStagingCardsAction(discard)
      resetWizard()
    } catch (e: any) {
      alert('Publish failed: ' + e.message)
    } finally {
      setIsPublishing(false)
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  const resetWizard = () => {
    setStep(1)
    setBatchFront(null); setBatchBack(null)
    setSingleFront(null); setSingleBack(null)
    setScanJobId(null); setScanProgress('')
    setStaging([]); setSelectedIds(new Set()); setShowBack(new Set())
    setIdentJobId(null); setIdentProgress('')
    setReviewCards([]); setReviewSelected(new Set())
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const stepLabels = [
    { num: 1, label: 'Upload' },
    { num: 2, label: 'Staging' },
    { num: 3, label: 'Crop' },
    { num: 4, label: 'AI' },
    { num: 5, label: 'Mint' },
  ]

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
              title="AI Ingestion Instructions"
              steps={[
                { title: "Step 1: Upload", content: "Upload a paired front and back (single card or full matrix sheet). Images are stored in staging first — no credits until you send a pair to the scanner for auto-crop." },
                { title: "Step 2: Staging", content: "Each row is one front+back pair. Select rows and send them to the scanner to crop and rotate (1 credit per send), or use as-is to keep full images without cropping." },
                { title: "Step 3: Crop", content: "While the scanner runs, cropped card images replace the raw pair with one row per detected card." },
                { title: "Step 4: AI", content: "Send cropped cards to identification. Catalog search remains free." },
                { title: "Step 5: Mint", content: "Review, re-price, then publish to inventory." },
              ]}
            />
          </h2>
          <p className="text-sm font-medium text-muted">Upload → Staging → Crop → AI → Inventory</p>
        </div>
      </div>

      {/* Step progress bar */}
      <div className="flex justify-between items-center mb-8 px-2 sm:px-6 relative">
        <div className="absolute top-1/2 left-6 right-6 h-0.5 bg-border -z-10 translate-y-[-50%]" />
        {stepLabels.map(s => (
          <div key={s.num} className="flex flex-col items-center bg-surface px-1">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs border-2 transition-colors
              ${step > s.num ? 'bg-emerald-500 text-white border-emerald-500' :
                step === s.num ? 'bg-brand text-brand-foreground border-brand shadow-md' :
                'bg-surface text-muted border-border'}`}>
              {step > s.num ? <CheckCircle2 className="w-4 h-4" /> : s.num}
            </div>
            <span className={`text-[9px] mt-1.5 uppercase tracking-wide font-black hidden sm:block
              ${step >= s.num ? 'text-foreground' : 'text-muted'}`}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Step 1: Upload ─────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-6 animate-in fade-in">
          <div className="flex bg-surface border border-border rounded-lg p-1 w-full max-w-xs mx-auto">
            <button onClick={() => setUploadMode('batch')}
              className={`flex-1 py-2 text-sm font-bold rounded-md transition ${uploadMode === 'batch' ? 'bg-brand text-brand-foreground shadow' : 'text-muted hover:text-foreground'}`}>
              Batch Matrix
            </button>
            <button onClick={() => setUploadMode('single')}
              className={`flex-1 py-2 text-sm font-bold rounded-md transition ${uploadMode === 'single' ? 'bg-brand text-brand-foreground shadow' : 'text-muted hover:text-foreground'}`}>
              Single Pair
            </button>
          </div>

          {uploadMode === 'batch' ? (
            <>
              <p className="text-center text-xs text-muted font-medium -mt-2 mb-1">
                Free to stage one sheet pair — select it in staging and send to scanner when ready (1 credit per send).
              </p>
              <div className="grid grid-cols-2 gap-4">
                <DropZone label="Front Matrix (up to 9 cards)" file={batchFront} id="batch-front" onFile={setBatchFront} />
                <DropZone label="Back Matrix (same layout)" file={batchBack} id="batch-back" onFile={setBatchBack} />
              </div>
            </>
          ) : (
            <>
              <p className="text-center text-xs text-muted font-medium -mt-2 mb-1">
                One physical card: front + back photos (required). Same flow as the full matrix — one pair per job.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <DropZone label="Front Side (required)" file={singleFront} id="single-front" onFile={setSingleFront} />
                <DropZone label="Back Side (required)" file={singleBack} id="single-back" onFile={setSingleBack} />
              </div>
            </>
          )}

          <button
            onClick={handleUpload}
            disabled={isUploading || (uploadMode === 'batch' ? (!batchFront || !batchBack) : (!singleFront || !singleBack))}
            className="w-full bg-brand text-background font-black text-lg py-4 rounded-xl disabled:opacity-40 hover:bg-brand-hover transition flex items-center justify-center gap-3"
          >
            {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
            {isUploading
              ? 'Uploading…'
              : 'Add paired upload to staging (free)'}
          </button>
        </div>
      )}

      {/* ── Step 3: Scanning spinner ────────────────────────────────────────── */}
      {step === 3 && (
        <div className="text-center py-20 animate-in fade-in">
          <Loader2 className="w-14 h-14 animate-spin text-brand mx-auto mb-5" />
          <h3 className="text-2xl font-black text-foreground mb-2">Scanning & Cropping</h3>
          <p className="text-muted font-medium">{scanProgress || 'Processing your scan…'}</p>
        </div>
      )}

      {/* ── Step 2: Staging area ────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-5 animate-in fade-in">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="font-black text-foreground text-lg">{staging.length} item{staging.length !== 1 ? 's' : ''} in staging</p>
              <p className="text-xs text-muted font-medium">Every row is a front+back pair; crop with scanner (credit) or use as-is (free), then AI / publish</p>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <button type="button" onClick={() => setStep(1)} className="text-xs font-black text-brand hover:underline">
                + Add more uploads
              </button>
              <span className="text-muted text-xs">·</span>
              <button onClick={selectAll} className="text-xs font-bold text-brand hover:underline">Select All</button>
              <span className="text-muted text-xs">·</span>
              <button onClick={deselectAll} className="text-xs font-bold text-muted hover:underline">Deselect All</button>
            </div>
          </div>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {staging.map(card => {
              const pending = isPendingScan(card)
              const displayFront = pending ? (card.raw_front_url ?? null) : (card.image_url ?? null)
              const displayBack = pending ? (card.raw_back_url ?? null) : (card.back_image_url ?? null)
              const showToggle = !!(displayFront && displayBack)
              return (
              <div key={card.id}
                className={`border rounded-xl p-4 bg-surface transition ${selectedIds.has(card.id) ? 'border-brand/50' : 'border-border opacity-60'}`}>
                <div className="flex gap-4">
                  {/* Image */}
                  <div className="flex-shrink-0 w-20 space-y-1">
                    {pending && (
                      <span className="block text-[9px] font-black uppercase tracking-wide text-orange-600 bg-orange-500/15 rounded px-1 py-0.5 text-center">
                        Uncropped
                      </span>
                    )}
                    {(showBack.has(card.id) ? displayBack : displayFront) ? (
                      <img
                        src={(showBack.has(card.id) ? displayBack : displayFront)!}
                        alt="card"
                        className="w-20 h-28 object-contain rounded-lg border border-border bg-surface"
                      />
                    ) : (
                      <div className="w-20 h-28 rounded-lg border border-border bg-surface-hover flex items-center justify-center text-muted text-xs text-center p-1">
                        No image
                      </div>
                    )}
                    {showToggle && (
                      <button type="button" onClick={() => toggleBack(card.id)}
                        className="flex items-center gap-1 text-[10px] text-muted hover:text-brand font-bold w-full justify-center">
                        {showBack.has(card.id) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        {showBack.has(card.id) ? 'Front' : 'Back'}
                      </button>
                    )}
                  </div>

                  {/* Fields */}
                  <div className="flex-1 space-y-2">
                    {/* Catalog search */}
                    <TaxonomySearch onSelect={data => applyTaxonomy(card.id, data)} />

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={card.player_name}
                        onChange={e => updateField(card.id, 'player_name', e.target.value)}
                        onBlur={e => saveField(card.id, 'player_name', e.target.value)}
                        placeholder="Player Name"
                        className="border border-border rounded-lg p-2 text-sm bg-surface text-foreground focus:ring-1 focus:ring-brand outline-none"
                      />
                      <input
                        value={card.card_set}
                        onChange={e => updateField(card.id, 'card_set', e.target.value)}
                        onBlur={e => saveField(card.id, 'card_set', e.target.value)}
                        placeholder="Card Set"
                        className="border border-border rounded-lg p-2 text-sm bg-surface text-foreground focus:ring-1 focus:ring-brand outline-none"
                      />
                      <input
                        value={card.card_number}
                        onChange={e => updateField(card.id, 'card_number', e.target.value)}
                        onBlur={e => saveField(card.id, 'card_number', e.target.value)}
                        placeholder="Card #"
                        className="border border-border rounded-lg p-2 text-sm bg-surface text-foreground focus:ring-1 focus:ring-brand outline-none"
                      />
                      <input
                        value={card.insert_name}
                        onChange={e => updateField(card.id, 'insert_name', e.target.value)}
                        onBlur={e => saveField(card.id, 'insert_name', e.target.value)}
                        placeholder="Insert"
                        className="border border-border rounded-lg p-2 text-sm bg-surface text-foreground focus:ring-1 focus:ring-brand outline-none"
                      />
                      <input
                        value={card.parallel_name}
                        onChange={e => updateField(card.id, 'parallel_name', e.target.value)}
                        onBlur={e => saveField(card.id, 'parallel_name', e.target.value)}
                        placeholder="Parallel"
                        className="border border-border rounded-lg p-2 text-sm bg-surface text-foreground focus:ring-1 focus:ring-brand outline-none"
                      />
                      <input
                        value={card.print_run}
                        onChange={e => updateField(card.id, 'print_run', e.target.value)}
                        onBlur={e => saveField(card.id, 'print_run', e.target.value)}
                        placeholder="Print Run"
                        className="border border-border rounded-lg p-2 text-sm bg-surface text-foreground focus:ring-1 focus:ring-brand outline-none"
                      />
                      <input
                        value={card.listed_price}
                        onChange={e => updateField(card.id, 'listed_price', e.target.value)}
                        onBlur={e => saveField(card.id, 'price', e.target.value)}
                        placeholder="Price $"
                        type="number"
                        className="border border-border rounded-lg p-2 text-sm bg-surface text-foreground focus:ring-1 focus:ring-brand outline-none"
                      />
                    </div>
                  </div>

                  {/* Checkbox */}
                  <div className="flex-shrink-0 pt-1">
                    <input type="checkbox" checked={selectedIds.has(card.id)}
                      onChange={() => toggleSelect(card.id)}
                      className="w-5 h-5 accent-brand cursor-pointer" />
                  </div>
                </div>
              </div>
            )
            })}
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
            <button
              type="button"
              onClick={handleSendSelectedToScanner}
              disabled={isSendingToScanner || selectedIds.size === 0}
              className="bg-amber-600 text-white font-black py-3 rounded-xl disabled:opacity-40 hover:bg-amber-700 transition flex items-center justify-center gap-2"
            >
              {isSendingToScanner ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scissors className="w-4 h-4" />}
              Send to scanner
            </button>
            <button
              type="button"
              onClick={handlePromoteRawAsCropped}
              disabled={selectedIds.size === 0}
              className="bg-slate-600 text-white font-black py-3 rounded-xl disabled:opacity-40 hover:bg-slate-700 transition flex items-center justify-center gap-2 text-sm"
            >
              Use as-is (no crop)
            </button>
            <button
              onClick={handleIdentify}
              disabled={selectedIds.size === 0}
              className="bg-brand text-background font-black py-3 rounded-xl disabled:opacity-40 hover:bg-brand-hover transition flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send {selectedIds.size > 0 ? `${selectedIds.size} ` : ''}for AI ID
            </button>
            <button
              onClick={handlePublishAsIs}
              disabled={selectedIds.size === 0 || isPublishingAsIs}
              className="bg-emerald-600 text-white font-black py-3 rounded-xl disabled:opacity-40 hover:bg-emerald-700 transition flex items-center justify-center gap-2"
            >
              {isPublishingAsIs ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Publish As-Is
            </button>
            <button
              onClick={handleDiscard}
              disabled={selectedIds.size === 0 || isDiscarding}
              className="bg-surface border border-border text-muted font-bold py-3 rounded-xl disabled:opacity-40 hover:bg-surface-hover hover:text-foreground transition flex items-center justify-center gap-2"
            >
              {isDiscarding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Discard Selected
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: AI identification spinner ─────────────────────────────── */}
      {step === 4 && (
        <div className="text-center py-20 animate-in fade-in">
          <Loader2 className="w-14 h-14 animate-spin text-brand mx-auto mb-5" />
          <h3 className="text-2xl font-black text-foreground mb-2">AI Identifying Cards</h3>
          <p className="text-muted font-medium">{identProgress || 'Processing…'}</p>
        </div>
      )}

      {/* ── Step 5: Review, edit, price, publish ───────────────────────────── */}
      {step === 5 && (
        <div className="space-y-5 animate-in fade-in">
          {/* Tabs */}
          <div className="flex gap-1 bg-surface border border-border rounded-lg p-1 w-full max-w-xs">
            {(['ready', 'correction'] as const).map(tab => {
              const count = tab === 'ready'
                ? reviewCards.filter(c => (c.confidence ?? 0) > 0.85).length
                : reviewCards.filter(c => (c.confidence ?? 1) <= 0.85).length
              return (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 text-xs font-black rounded-md transition ${activeTab === tab ? 'bg-brand text-brand-foreground shadow' : 'text-muted hover:text-foreground'}`}>
                  {tab === 'ready' ? `Ready (${count})` : `Correction (${count})`}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => setReviewSelected(new Set(reviewCards.map(c => c.id)))}
              className="text-xs font-bold text-brand hover:underline">Select All</button>
            <span className="text-muted text-xs">·</span>
            <button onClick={() => setReviewSelected(new Set())}
              className="text-xs font-bold text-muted hover:underline">Deselect All</button>
            <span className="ml-auto text-xs text-muted font-medium">{reviewSelected.size} selected</span>
          </div>

          <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
            {reviewCards
              .filter(c => activeTab === 'ready' ? (c.confidence ?? 0) > 0.85 : (c.confidence ?? 1) <= 0.85)
              .map(card => (
                <div key={card.id}
                  className={`border rounded-xl p-4 bg-surface transition ${reviewSelected.has(card.id) ? 'border-brand/50' : 'border-border opacity-60'}`}>
                  <div className="flex gap-4">
                    {/* Images */}
                    <div className="flex-shrink-0 flex flex-col gap-1">
                      {card.image_url && (
                        <img src={card.image_url} alt="front"
                          className="w-16 h-22 object-contain rounded-lg border border-border bg-surface" />
                      )}
                      {card.back_image_url && (
                        <img src={card.back_image_url} alt="back"
                          className="w-16 h-22 object-contain rounded-lg border border-border bg-surface" />
                      )}
                    </div>

                    {/* Fields */}
                    <div className="flex-1 space-y-2">
                      {/* Confidence badge */}
                      {card.confidence !== undefined && (
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            card.confidence > 0.85
                              ? 'bg-emerald-500/20 text-emerald-500'
                              : 'bg-orange-500/20 text-orange-500'
                          }`}>
                            {(card.confidence * 100).toFixed(0)}% confidence
                          </span>
                          {card.ai_status && (
                            <span className="text-[10px] text-muted font-medium">{card.ai_status}</span>
                          )}
                        </div>
                      )}

                      {/* Taxonomy search for correction tab */}
                      {activeTab === 'correction' && (
                        <TaxonomySearch onSelect={data => applyReviewTaxonomy(card.id, data)} />
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { field: 'player_name', placeholder: 'Player Name' },
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
                            className="border border-border rounded-lg p-2 text-sm bg-surface text-foreground focus:ring-1 focus:ring-brand outline-none"
                          />
                        ))}
                      </div>

                      {/* Price + reprice */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-muted">$</span>
                        <input
                          type="number"
                          value={card.listed_price || ''}
                          onChange={e => updateReviewField(card.id, 'listed_price', e.target.value)}
                          onBlur={e => saveReviewField(card.id, 'price', e.target.value)}
                          placeholder="0.00"
                          className="border border-border rounded-lg p-2 text-sm bg-surface text-foreground w-28 focus:ring-1 focus:ring-brand outline-none"
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
                      </div>
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

          <button
            onClick={handlePublish}
            disabled={reviewSelected.size === 0 || isPublishing}
            className="w-full bg-slate-900 text-white font-black text-lg py-4 rounded-xl disabled:opacity-40 hover:bg-emerald-600 transition flex items-center justify-center gap-3 drop-shadow-md"
          >
            {isPublishing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            Publish {reviewSelected.size > 0 ? `${reviewSelected.size} Cards` : 'Selected'} to Inventory
          </button>
        </div>
      )}

    </div>
  )
}
