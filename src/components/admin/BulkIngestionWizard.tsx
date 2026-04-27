'use client'
import { useState, useCallback, useEffect } from 'react'
import {
  Upload, Loader2, Play, CheckCircle2, Wand2,
  RefreshCw, Trash2, Send, Scissors, DollarSign
} from 'lucide-react'
import { pollScannerResult, identifyCardDirectAction } from '@/app/actions/visionSync'
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
} from '@/app/actions/drafts'
import { deleteStagingCardsAction } from '@/app/actions/inventory'
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
  const [identProgress, setIdentProgress] = useState('')



  // Step 5 -> 3 review
  const [reviewCards, setReviewCards] = useState<StagingCard[]>([])
  const [reviewSelected, setReviewSelected] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'ready' | 'correction'>('ready')
  const [isPublishing, setIsPublishing] = useState(false)
  const [isDiscarding, setIsDiscarding] = useState(false)

  // Wizard: 1 Upload → 2 Process → 3 Publish
  const [step, setStep] = useState<1 | 2 | 3>(1)
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
    listScanStagingAction()
      .then((rows) => {
        if (!rows?.length) return
        const loaded = (rows as Record<string, unknown>[]).map(rowToStagingCard)
        setReviewCards(loaded)
        setReviewSelected(new Set(loaded.map(x => x.id)))
        setStep(3)
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

  const runPipeline = async (card: StagingCard) => {
    try {
      setIsSendingToScanner(true)
      setStep(2)
      setScanProgress('Uploading scan job…')
      const { job_id } = await submitStagingRowToScannerAction(
        card.id,
        scannerMat === 'none' ? undefined : { chroma: scannerMat }
      )
      setScanJobId(job_id)
      const cropped = await pollScannerUntilDone(job_id)
      const newRows = await finalizeStagingScanAction(
        card.id,
        cropped.map((c) => ({ side_a_url: c.side_a_url, side_b_url: c.side_b_url }))
      )
      const added = (newRows as Record<string, unknown>[]).map((r) => rowToStagingCard(r))

      setIsSendingToScanner(false)
      setScanJobId(null)
      
      const updates = [...added]
      for (let i = 0; i < added.length; i++) {
        const c = added[i]
        setIdentProgress(`Identifying card ${i + 1} of ${added.length}…`)
        try {
          const res = await identifyCardDirectAction(c.id, c.image_url!, c.back_image_url)
          const confidence = res.confidence ?? 0
          const aiStatus = confidence >= 0.85 ? 'High Confidence' : 'Manual Correction'
          const idx = updates.findIndex(x => x.id === c.id)
          if (idx !== -1) {
            const aiTeam = (res.team_name ?? '').trim()
            const mergedTeam = aiTeam || updates[idx].team_name
            const mergedPrint = res.print_run != null && Number.isFinite(Number(res.print_run)) ? String(res.print_run) : updates[idx].print_run
            const mergedCardNum = normalizeCardNumberForPlayerIndex((res.card_number && String(res.card_number).trim()) ? res.card_number : updates[idx].card_number) || updates[idx].card_number
            updates[idx] = {
              ...updates[idx],
              player_name:   res.player_name   || updates[idx].player_name,
              team_name:     mergedTeam,
              card_set:      res.card_set       || updates[idx].card_set,
              card_number:   mergedCardNum,
              insert_name:   res.insert_name    || updates[idx].insert_name,
              parallel_name: res.parallel_name  || updates[idx].parallel_name,
              print_run:     mergedPrint,
              confidence,
              ai_status: aiStatus,
              team_name_source: res.team_name_source,
              team_name_confidence: res.team_name_confidence,
              team_name_verified: res.team_name_verified,
            }
            updateDraftCardAction(updates[idx].id, {
              player_name: updates[idx].player_name,
              team_name: updates[idx].team_name,
              card_set: updates[idx].card_set,
              card_number: mergedCardNum,
              insert_name: updates[idx].insert_name,
              parallel_name: updates[idx].parallel_name,
              print_run: (() => { const n = parseInt(String(mergedPrint ?? '').replace(/\D/g, ''), 10); return Number.isFinite(n) ? n : null })()
            }).catch(() => {})
          }
        } catch (e: any) {
          if (e.message === 'credits_exhausted') { creditsExhausted(); return }
          const idx = updates.findIndex(x => x.id === c.id)
          if (idx !== -1) updates[idx] = { ...updates[idx], ai_status: 'Failed', confidence: 0 }
        }
      }
      setIdentProgress('')
      setReviewCards(prev => [...updates, ...prev])
      setReviewSelected(prev => {
        const next = new Set(prev)
        updates.forEach(u => next.add(u.id))
        return next
      })
      setActiveTab('ready')
      setStep(3)
    } catch (e: any) {
      setIsSendingToScanner(false)
      setScanJobId(null)
      setStep(3) // Advance anyway to let them see existing reviewCards
      showToast('Processing failed: ' + e.message, 'error')
    }
  }

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
        setBatchFront(null)
        setBatchBack(null)
        runPipeline(card)
      } else {
        if (!singleFront || !singleBack) return
        const fd = new FormData()
        fd.append('front', singleFront)
        fd.append('back', singleBack)
        fd.append('kind', 'single_pair')
        const row = await stagePairedUploadAction(fd)
        const card = rowToStagingCard(row as Record<string, unknown>)
        setSingleFront(null)
        setSingleBack(null)
        runPipeline(card)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      showToast('Upload failed: ' + msg, 'error')
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
      activeTab === 'ready' ? (c.confidence ?? 0) > 0.85 : (c.confidence ?? 1) <= 0.85
    ).filter(c => c.player_name)
    if (!visibleCards.length) {
      showToast('No cards with a Player Name on this tab to price.', 'info')
      return
    }
    setIsPricingAll(true)
    for (const card of visibleCards) {
      setReviewCards(prev => prev.map(c => c.id === card.id ? { ...c, repricing: true } : c))
      try {
        const res = await applyStagingDraftFieldPricingAction(card.id)
        if (!res.success) {
          if (res.error === 'credits_exhausted') {
            creditsExhausted()
            setIsPricingAll(false)
            return
          }
          setReviewCards(prev => prev.map(c => (c.id === card.id ? { ...c, repricing: false } : c)))
        } else {
          const newPrice =
            res.listed_price != null && Number.isFinite(res.listed_price)
              ? String(res.listed_price)
              : ''
          setReviewCards(prev => prev.map(c => (c.id === card.id ? { ...c, repricing: false, listed_price: newPrice } : c)))
        }
      } catch {
        setReviewCards(prev => prev.map(c => c.id === card.id ? { ...c, repricing: false } : c))
      }
    }
    setIsPricingAll(false)
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
    setSingleFront(null); setSingleBack(null)
    setScanJobId(null); setScanProgress('')
    setIdentProgress('')
    setReviewCards([]); setReviewSelected(new Set())
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const stepLabels = [
    { num: 1, label: 'Upload' },
    { num: 2, label: 'Process' },
    { num: 3, label: 'Publish' },
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
                { title: "Step 1: Upload", content: "Upload a paired front and back (single card or full matrix sheet)." },
                { title: "Step 2: Process", content: "The AI automatically crops the sheet and identifies each card's metadata." },
                { title: "Step 3: Publish", content: "Review, edit pricing, and publish directly to your inventory." },
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

          {/* Scanner mat — drives chroma-key in vision worker */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface/80 px-4 py-3 text-sm mt-4">
            <span className="font-bold text-foreground shrink-0">Scanner mat</span>
            <span className="text-xs text-muted max-w-md">
              Green or blue pad: pick the match so each card separates from the background. Use “None” only for neutral mats.
            </span>
            <div className="flex flex-wrap gap-3 ml-auto">
              {([
                { id: 'none' as const, label: 'None' },
                { id: 'green' as const, label: 'Green' },
                { id: 'blue' as const, label: 'Blue' },
              ]).map(({ id, label }) => (
                <label key={id} className="flex items-center gap-1.5 cursor-pointer font-semibold text-foreground text-xs">
                  <input
                    type="radio"
                    name="scannerMat"
                    checked={scannerMat === id}
                    onChange={() => setScannerMat(id)}
                    className="accent-brand"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={handleUpload}
            disabled={isUploading || (uploadMode === 'batch' ? (!batchFront || !batchBack) : (!singleFront || !singleBack))}
            className="w-full bg-brand text-background font-black text-lg py-4 rounded-xl disabled:opacity-40 hover:bg-brand-hover transition flex items-center justify-center gap-3 mt-4"
          >
            {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
            {isUploading
              ? 'Uploading…'
              : 'Upload & Process Cards'}
          </button>
        </div>
      )}

      {/* ── Step 2: Processing spinner ────────────────────────────────────────── */}
      {step === 2 && (
        <div className="text-center py-20 animate-in fade-in">
          <Loader2 className="w-14 h-14 animate-spin text-brand mx-auto mb-5" />
          <h3 className="text-2xl font-black text-foreground mb-2">Processing Cards</h3>
          <p className="text-muted font-medium">
             {isSendingToScanner ? scanProgress : identProgress || 'Processing…'}
          </p>
        </div>
      )}

      {/* ── Step 3: Review, edit, price, publish ───────────────────────────── */}
      {step === 3 && (

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

          <div className="space-y-3 max-h-[72vh] overflow-y-auto pr-1">
            {reviewCards
              .filter(c => activeTab === 'ready' ? (c.confidence ?? 0) > 0.85 : (c.confidence ?? 1) <= 0.85)
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

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleReviewDiscard}
              disabled={reviewSelected.size === 0 || isDiscarding}
              className="bg-surface border border-border text-muted font-bold py-3 px-6 rounded-xl disabled:opacity-40 hover:bg-surface-hover hover:text-foreground transition flex items-center justify-center gap-2"
            >
              {isDiscarding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Discard Selected
            </button>
            <button
              onClick={handlePriceAll}
              disabled={isPricingAll || isPublishing}
              className="flex-1 bg-emerald-700 text-white font-black py-3 rounded-xl disabled:opacity-40 hover:bg-emerald-600 transition flex items-center justify-center gap-2"
            >
              {isPricingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
              Price All on Tab
            </button>
            <button
              onClick={handlePublish}
              disabled={reviewSelected.size === 0 || isPublishing}
              className="flex-[2] bg-slate-900 text-white font-black text-lg py-4 rounded-xl disabled:opacity-40 hover:bg-brand transition flex items-center justify-center gap-3 drop-shadow-md"
            >
              {isPublishing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              Publish {reviewSelected.size > 0 ? `${reviewSelected.size} Cards` : 'Selected'} to Inventory
            </button>
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
