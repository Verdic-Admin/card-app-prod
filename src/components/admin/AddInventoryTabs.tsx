'use client';

import { useState } from 'react';
import { PencilLine, Wand2, Zap } from 'lucide-react';
import { FreeTrackPanel } from '@/components/admin/FreeTrackPanel';
import { BulkIngestionWizard } from '@/components/admin/BulkIngestionWizard';

type Track = 'free' | 'premium';

/**
 * Top-level tab switcher for /admin/add-inventory.
 * Conditionally mounts/unmounts each panel so state never bleeds between tracks.
 * Defaults to 'free' to prevent accidental AI token consumption.
 */
export function AddInventoryTabs() {
  const [track, setTrack] = useState<Track>('free');

  return (
    <div className="space-y-6">
      {/* Track toggle */}
      <div className="flex flex-col sm:flex-row gap-3">
        <TrackTab
          active={track === 'free'}
          onClick={() => setTrack('free')}
          icon={<PencilLine className="w-4 h-4" />}
          label="Free Track"
          sublabel="Manual entry — no AI tokens used"
          badge="Free"
          badgeClass="bg-emerald-500/15 text-emerald-500 border-emerald-500/25"
        />
        <TrackTab
          active={track === 'premium'}
          onClick={() => setTrack('premium')}
          icon={<Wand2 className="w-4 h-4" />}
          label="Premium Track"
          sublabel="AI Crop → Identify → Auto-Price"
          badge="Uses AI Tokens"
          badgeClass="bg-amber-500/15 text-amber-500 border-amber-500/25"
          badgeIcon={<Zap className="w-2.5 h-2.5" />}
        />
      </div>

      {/* Conditionally mounted panels — unmount on switch to clear all in-memory state */}
      {track === 'free' ? <FreeTrackPanel /> : <BulkIngestionWizard />}
    </div>
  );
}

// ── Sub-component ─────────────────────────────────────────────────────────────

interface TrackTabProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  badge: string;
  badgeClass: string;
  badgeIcon?: React.ReactNode;
}

function TrackTab({
  active, onClick, icon, label, sublabel, badge, badgeClass, badgeIcon,
}: TrackTabProps) {
  return (
    <button
      onClick={onClick}
      className={`
        flex-1 flex items-center gap-3 text-left px-4 py-3 rounded-xl border transition-all
        ${active
          ? 'bg-brand/10 border-brand/40 shadow-sm'
          : 'bg-surface border-border hover:bg-surface-hover hover:border-border'
        }
      `}
    >
      <span className={`p-2 rounded-lg ${active ? 'bg-brand/20 text-brand' : 'bg-surface-hover text-muted'}`}>
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-black text-foreground">{label}</span>
        <span className="block text-[11px] font-medium text-muted truncate">{sublabel}</span>
      </span>
      <span className={`flex items-center gap-1 text-[10px] font-bold border rounded-full px-2 py-0.5 uppercase tracking-wide whitespace-nowrap ${badgeClass}`}>
        {badgeIcon}
        {badge}
      </span>
    </button>
  );
}
