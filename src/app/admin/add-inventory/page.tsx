'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { Upload, Crop, RefreshCcw, Sparkles, Image as ImageIcon, CheckCircle2, AlertCircle, Save } from 'lucide-react';
import { BulkIngestionWizard } from '@/components/admin/BulkIngestionWizard';
import { ManualIngestionGrid } from '@/components/admin/ManualIngestionGrid';
import { uploadAssetAction, addCardAction } from '@/app/actions/inventory';
import { identifyCardPair } from '@/app/actions/visionSync';
import { price } from '@/utils/math';

type StagedSingle = {
  id: string;
  frontFile: File | null;
  frontPreview: string | null;
  backFile: File | null;
  backPreview: string | null;
  data: {
    player_name: string;
    team_name: string;
    team_name_source?: 'ocr_back' | 'ocr_with_db_conflict' | 'catalog_db' | 'none' | null;
    team_name_confidence?: number | null;
    team_name_verified?: boolean | null;
    target_percentage: number;
    year: string;
    brand: string;
    card_set: string;
    card_number: string;
    parallel_name: string;
    insert_name: string;
    print_run: string;
    grading_company: string;
    grade: string;
    condition: string;
    listed_price: number;
    avg_price: number;
    is_rookie: boolean;
    is_auto: boolean;
    is_relic: boolean;
  };
  processing: boolean;
  saving: boolean;
  identified: boolean;
  saved: boolean;
};

function blankSingle(): StagedSingle {
  return {
    id: Math.random().toString(36).substring(7),
    frontFile: null,
    frontPreview: null,
    backFile: null,
    backPreview: null,
    data: {
      player_name: '',
      team_name: '',
      target_percentage: 80,
      year: '',
      brand: '',
      card_set: '',
      card_number: '',
      parallel_name: '',
      insert_name: '',
      print_run: '',
      grading_company: '',
      grade: '',
      condition: 'NM',
      listed_price: 0,
      avg_price: 0,
      is_rookie: false,
      is_auto: false,
      is_relic: false,
    },
    processing: false,
    saving: false,
    identified: false,
    saved: false,
  };
}

export default function AddInventoryPage() {
  const [activeView, setActiveView] = useState<'batch' | 'manual'>('batch');
  const [stagedSingles, setStagedSingles] = useState<StagedSingle[]>([]);

  const addNewManualSingle = () => {
    setStagedSingles(prev => [blankSingle(), ...prev]);
  };

  const updateSingleField = (id: string, field: keyof StagedSingle['data'], value: any) => {
    setStagedSingles(prev => prev.map(s =>
      s.id === id ? { ...s, data: { ...s.data, [field]: value } } : s
    ));
  };

  const handleSingleImageUpload = (id: string, side: 'front' | 'back', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setStagedSingles(prev => prev.map(s =>
      s.id === id
        ? {
          ...s,
          identified: false,
          ...(side === 'front'
            ? { frontFile: file, frontPreview: preview }
            : { backFile: file, backPreview: preview }),
        }
        : s
    ));
  };

  const identifySingle = async (id: string) => {
    const single = stagedSingles.find(s => s.id === id);
    if (!single?.frontFile || !single.backFile) {
      alert('Upload both front and back images before running AI scan.');
      return;
    }

    setStagedSingles(prev => prev.map(s => s.id === id ? { ...s, processing: true } : s));

    try {
      const frontFormData = new FormData();
      frontFormData.append('file', single.frontFile);
      const { url: frontUrl } = await uploadAssetAction(frontFormData);

      const backFormData = new FormData();
      backFormData.append('file', single.backFile);
      const { url: backUrl } = await uploadAssetAction(backFormData);

      const result = await identifyCardPair({
        queue_id: `single-${id}`,
        side_a_url: frontUrl,
        side_b_url: backUrl,
      });

      setStagedSingles(prev => prev.map(s =>
        s.id === id
          ? {
            ...s,
            processing: false,
            identified: true,
            data: {
              ...s.data,
              player_name: result.player_name || s.data.player_name,
              team_name: result.team_name || s.data.team_name,
              team_name_source: result.team_name_source,
              team_name_confidence: result.team_name_confidence,
              team_name_verified: result.team_name_verified,
              card_set: result.card_set || s.data.card_set,
              card_number: result.card_number || s.data.card_number,
              insert_name: result.insert_name || s.data.insert_name,
              parallel_name: result.parallel_name || s.data.parallel_name,
              avg_price: s.data.avg_price,
              listed_price: s.data.listed_price,
            },
          }
          : s
      ));
    } catch (err: any) {
      alert(`AI scan failed: ${err.message}`);
      setStagedSingles(prev => prev.map(s => s.id === id ? { ...s, processing: false } : s));
    }
  };

  const saveToDatabase = async (id: string) => {
    const single = stagedSingles.find(s => s.id === id);
    if (!single?.frontFile || !single.backFile) {
      alert('Upload both front and back images before saving to inventory.');
      return;
    }
    setStagedSingles(prev => prev.map(s => s.id === id ? { ...s, saving: true } : s));
    try {
      const formData = new FormData();
      formData.append('image', single.frontFile);
      formData.append('back_image', single.backFile);
      formData.append('data', JSON.stringify({
        player_name: single.data.player_name,
        team_name: single.data.team_name,
        card_set: single.data.card_set,
        insert_name: single.data.insert_name,
        parallel_name: single.data.parallel_name,
        card_number: single.data.card_number,
        high_price: single.data.avg_price,
        low_price: single.data.avg_price,
        avg_price: single.data.avg_price,
        listed_price: single.data.listed_price,
        cost_basis: 0,
        accepts_offers: false,
        is_rookie: single.data.is_rookie,
        is_auto: single.data.is_auto,
        is_relic: single.data.is_relic,
        grading_company: single.data.grading_company || null,
        grade: single.data.grade || null,
      }));
      const result = await addCardAction(formData);
      if (!result.success) {
        alert('Save failed: ' + result.error);
        return;
      }
      setStagedSingles(prev => prev.map(s => s.id === id ? { ...s, saving: false, saved: true } : s));
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
      setStagedSingles(prev => prev.map(s => s.id === id ? { ...s, saving: false } : s));
    }
  };

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10 min-h-screen pb-32">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <Link href="/admin" className="text-sm text-brand hover:underline mb-2 inline-block font-bold">← Back to Admin</Link>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Add Inventory</h1>
          <p className="text-muted mt-1 font-medium max-w-2xl">
            Use the AI Batch Importer to process a full binder page scan, or switch to Singles to enter cards one at a time.
          </p>
        </div>

        <div className="flex bg-surface p-1 rounded-xl border border-border shadow-sm w-fit self-start md:self-end">
          <button
            onClick={() => setActiveView('batch')}
            className={`px-4 py-2 font-bold text-sm flex items-center gap-2 rounded-lg transition-all ${activeView === 'batch' ? 'bg-foreground text-background shadow-md' : 'text-muted hover:text-foreground'}`}
          >
            <ImageIcon className="w-4 h-4" /> Batch Importer
          </button>
          <button
            onClick={() => setActiveView('manual')}
            className={`px-4 py-2 font-bold text-sm flex items-center gap-2 rounded-lg transition-all ${activeView === 'manual' ? 'bg-foreground text-background shadow-md' : 'text-muted hover:text-foreground'}`}
          >
            <Crop className="w-4 h-4" /> Manual Grid
          </button>
        </div>
      </div>

      {/* BATCH — BulkIngestionWizard (full scanner + orchestrator pipeline) */}
      {activeView === 'batch' && (
        <div className="animate-in slide-in-from-bottom-2 duration-300">
          <BulkIngestionWizard />
        </div>
      )}

      {/* MANUAL GRID */}
      {activeView === 'manual' && (
        <div className="animate-in slide-in-from-bottom-2 duration-300">
          <ManualIngestionGrid />
        </div>
      )}
    </div>
  );
}
