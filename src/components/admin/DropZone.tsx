'use client';

import { useState } from 'react';

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
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragIn = (e: React.DragEvent) => {
    handleDrag(e);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragOut = (e: React.DragEvent) => {
    handleDrag(e);
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    handleDrag(e);
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  return (
    <div>
      <label className="block text-xs font-black text-foreground mb-2 uppercase tracking-widest text-center">
        {label}
      </label>
      <div
        className={`border-2 border-dashed rounded-2xl h-48 flex flex-col items-center justify-center cursor-pointer transition shadow-inner ${
          isDragging 
            ? 'border-brand bg-brand/10 scale-[1.02]' 
            : 'border-brand/30 bg-brand/5 hover:bg-surface-hover'
        }`}
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDragIn}
        onDrop={handleDrop}
        onClick={() => document.getElementById(id)?.click()}
      >
        {/* Upload icon */}
        <svg
          className={`w-7 h-7 mb-2 transition-colors ${isDragging ? 'text-brand' : 'text-brand/70'}`}
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
        <span className={`text-sm font-bold text-center px-4 transition-colors ${isDragging ? 'text-brand' : 'text-brand'}`}>
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
