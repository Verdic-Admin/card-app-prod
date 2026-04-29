'use client';

interface DropZoneProps {
  label: string;
  file: File | null;
  id: string;
  onFile: (f: File) => void;
}

/**
 * Generic single-file drag-and-drop zone.
 * Used by both SinglePairUploadForm (Free Track) and BulkIngestionWizard (Premium Track).
 */
export function DropZone({ label, file, id, onFile }: DropZoneProps) {
  return (
    <div>
      <label className="block text-xs font-black text-foreground mb-2 uppercase tracking-widest text-center">
        {label}
      </label>
      <div
        className="border-2 border-dashed border-brand/30 bg-brand/5 rounded-2xl h-48 flex flex-col items-center justify-center cursor-pointer hover:bg-surface-hover transition shadow-inner"
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        onClick={() => document.getElementById(id)?.click()}
      >
        {/* Upload icon */}
        <svg
          className="w-7 h-7 text-brand/70 mb-2"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span className="text-sm font-bold text-brand text-center px-4">
          {file ? file.name : `Drop ${label}`}
        </span>
        <input
          id={id}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
