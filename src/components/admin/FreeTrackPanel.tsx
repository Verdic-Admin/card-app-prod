'use client';

import { useState } from 'react';
import { SinglePairUploadForm } from '@/components/admin/SinglePairUploadForm';
import { ManualIngestionGrid } from '@/components/admin/ManualIngestionGrid';

/**
 * Free Track panel — no AI APIs, no wizard steps.
 * Layout: upload form on top, staging grid below.
 * The refreshKey pattern triggers a re-fetch in the grid without global state.
 */
export function FreeTrackPanel() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      <SinglePairUploadForm onUploaded={() => setRefreshKey(k => k + 1)} />
      <ManualIngestionGrid refreshKey={refreshKey} />
    </div>
  );
}
