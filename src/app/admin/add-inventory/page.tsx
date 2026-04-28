'use client';

import React from 'react';
import Link from 'next/link';
import { BulkIngestionWizard } from '@/components/admin/BulkIngestionWizard';

export default function AddInventoryPage() {
  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10 min-h-screen pb-32">
      <div className="mb-8">
        <Link href="/admin" className="text-sm text-brand hover:underline mb-2 inline-block font-bold">← Back to Admin</Link>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Add Inventory</h1>
        <p className="text-muted mt-1 font-medium max-w-2xl">
          Upload card scans, crop &amp; identify with AI, price, and publish to your inventory.
        </p>
      </div>

      <div className="animate-in slide-in-from-bottom-2 duration-300">
        <BulkIngestionWizard />
      </div>
    </div>
  );
}
