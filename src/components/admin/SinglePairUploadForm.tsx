'use client';

import { useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { stagePairedUploadAction } from '@/app/actions/drafts';
import { DropZone } from '@/components/admin/DropZone';
import { useToastContext } from '@/components/admin/ToastProvider';

interface SinglePairUploadFormProps {
  /** Called after a successful upload so the parent can refresh the grid. */
  onUploaded: () => void;
}

/**
 * Free Track upload form — stages a single card's front + back as `kind: 'single_pair'`.
 * Contains zero AI API calls.
 */
export function SinglePairUploadForm({ onUploaded }: SinglePairUploadFormProps) {
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { showToast } = useToastContext();

  const canSubmit = !!front && !!back && !isUploading;

  const handleSubmit = async () => {
    if (!front || !back) return;
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append('front', front);
      fd.append('back', back);
      fd.append('kind', 'single_pair');
      await stagePairedUploadAction(fd);
      setFront(null);
      setBack(null);
      showToast('Card staged successfully.', 'success');
      onUploaded();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast('Upload failed: ' + msg, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <Upload className="w-4 h-4 text-brand" />
        <h3 className="text-sm font-black text-foreground">Upload Card (Front &amp; Back)</h3>
        <span className="ml-auto text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/25 rounded-full px-2 py-0.5 uppercase tracking-wide">
          Free · No tokens
        </span>
      </div>

      {/* Two drop zones side by side */}
      <div className="grid grid-cols-2 gap-4">
        <DropZone
          label="Front"
          file={front}
          id="free-track-front"
          onFile={setFront}
        />
        <DropZone
          label="Back"
          file={back}
          id="free-track-back"
          onFile={setBack}
        />
      </div>

      {/* Helper text */}
      <p className="text-[11px] text-muted font-medium text-center">
        Select one card front and one card back. Both images are required before staging.
      </p>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full bg-brand text-brand-foreground font-black text-sm py-2.5 rounded-lg disabled:opacity-40 hover:bg-brand-hover transition flex items-center justify-center gap-2"
      >
        {isUploading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Uploading…
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" />
            Stage Card
          </>
        )}
      </button>
    </div>
  );
}
