'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'
import { normalizePlayerName } from '@/utils/normalization'
import { calculateMedian } from '@/utils/math'
import { resolvePlayerId, fetchPlayerStats, calculateFundamentalAlpha } from '@/utils/mlbStats'
import { fetchPlayerNews, calculateSentimentAlpha } from '@/utils/sentiment'
import { calculateAFV } from '@/utils/matrix'

// Strict dampening coefficient to prevent NLP sentiment from artificially doubling PBIs
const BETA_S = 0.10;

export type PbiEntity = {
  playerEntity: string;
  assetCount: number;
  medianPbi: number;
  alphaF?: number;
  alphaS?: number;
  targetPbi?: number;
  liveStatValue?: number;
  liveStatType?: 'OPS' | 'WHIP';
}

/**
 * Executes a full database scan to group current inventory assets by player,
 * calculate the strictly-median Player Base Index (PBI) per entity, 
 * and return the simulated ticker. No DB UPSERTs are performed.
 */
export async function calculateBasePBI(): Promise<PbiEntity[]> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
     throw new Error("Unauthorized to run Pricing Engine tasks.");
  }

  // 1. Ingest flat inventory dataset. We only need Listed Price and Player Name.
  const { data: inventory, error } = await supabase
    .from('inventory')
    .select('player_name, listed_price');

  if (error) {
     console.error("Pricing Engine Database Error:", error);
     throw new Error(`Failed to ingest inventory for PBI calculation: ${error.message}`);
  }

  // 2. Normalize & Group
  // Accumulator maps a normalized name (e.g., 'agustin ramirez') to an array of price floats.
  const groupedPricing: Record<string, number[]> = {};

  for (const item of (inventory as any[] || [])) {
    // If the card doesn't have a listed price, we cannot incorporate it into mathematical medians.
    if (item.listed_price == null) continue;

    const rawName = item.player_name || 'Unknown';
    const normalizedKey = normalizePlayerName(rawName);

    if (!groupedPricing[normalizedKey]) {
      groupedPricing[normalizedKey] = [];
    }
    groupedPricing[normalizedKey].push(item.listed_price);
  }

  // 3. Compute Median Math & Construct Final Entities
  const engineResults: PbiEntity[] = [];
  const normalizedNames = Object.keys(groupedPricing);

  // We process these sequentially to prevent getting rate limited by the MLB Stats API during the dry run POC
  for (const normalizedName of normalizedNames) {
    const prices = groupedPricing[normalizedName];
    const medianBasePrice = calculateMedian(prices);
    
    let alphaF: number | undefined;
    let alphaS: number | undefined;
    let targetPbi: number | undefined;
    let liveStatValue: number | undefined;
    let liveStatType: 'OPS' | 'WHIP' | undefined;

    // Fetch live MLB stats ($\alpha_f$)
    const playerId = await resolvePlayerId(normalizedName);
    if (playerId) {
      const stats = await fetchPlayerStats(playerId);
      if (stats) {
        liveStatValue = stats.statValue;
        liveStatType = stats.statType;
        // The optional historical baseline parameter is omitted here for the V1 league average
        alphaF = calculateFundamentalAlpha(stats); 
      }
    }

    // Fetch qualitative news sentiment ($\alpha_s$)
    const headlines = await fetchPlayerNews(normalizedName);
    alphaS = calculateSentimentAlpha(headlines);

    // Calculate Final Overarching Formula
    // PBI_target = PBI_baseline * (1 + alpha_f + (alpha_s * beta_s))
    const af = alphaF || 0;
    const as = alphaS || 0;
    
    targetPbi = medianBasePrice * (1 + af + (as * BETA_S));

    engineResults.push({
      playerEntity: normalizedName.toUpperCase(),
      assetCount: prices.length,
      medianPbi: medianBasePrice,
      alphaF,
      alphaS,
      targetPbi,
      liveStatValue,
      liveStatType
    });
  }

  // Sort descending by highest PBI (most valuable entities)
  engineResults.sort((a, b) => (b.targetPbi || 0) - (a.targetPbi || 0));

  return engineResults;
}

/**
 * Triggers a full execution of the Shadow Book pricing pipeline, evaluating all inventory
 * and safely chunking Upsert payloads to the Supabase alpha_projections table.
 */
export async function executeShadowBookUpsert(): Promise<{ success: boolean; upsertedCount: number; message: string }> {
  const supabase = await createClient();
  const admin = createAdminClient();

  // 1. Authenticate Admin
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Unauthorized");

  // 2. Fetch all overarching Engine Results (Macro pricing)
  const engineResults = await calculateBasePBI();

  // Map the engine results by normalized name for fast lookup
  const pbiLookup: Record<string, PbiEntity> = {};
  engineResults.forEach(p => { pbiLookup[p.playerEntity.toLowerCase()] = p; });

  // 3. Fetch specific asset inventory details safely
  const { data: inventory, error: invError } = await supabase
    .from('inventory')
    .select('id, player_name, card_set, parallel_insert_type')
    .eq('status', 'available');

  if (invError) throw new Error(`Inventory fetch failed: ${invError.message}`);

  // 4. Construct payload arrays mapping Hub & Spoke AFVs
  const payloads: any[] = [];
  
  for (const item of (inventory as any[] || [])) {
    const rawName = item.player_name || 'Unknown';
    const normalizedKey = normalizePlayerName(rawName);
    const macroPricing = pbiLookup[normalizedKey];

    if (!macroPricing || macroPricing.targetPbi === undefined || macroPricing.targetPbi === null) {
      continue; // Skip if we don't have macro pricing (e.g., no listed assets)
    }

    // Apply strict matrix logic
    const matrix = calculateAFV(macroPricing.targetPbi, item.card_set, item.parallel_insert_type);

    payloads.push({
      card_id: item.id,
      is_hub: matrix.is_hub,
      pbi_target: macroPricing.targetPbi,
      c_set: matrix.c_set,
      m_parallel: matrix.m_parallel,
      alpha_f: macroPricing.alphaF || 0,
      alpha_s: macroPricing.alphaS || 0,
      afv: matrix.afv,
      updated_at: new Date().toISOString()
    });
  }

  // 5. Serverless Timeout Mitigation (Execute Batch Upserts)
  const BATCH_SIZE = 50;
  let totalUpserted = 0;

  for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
    const batch = payloads.slice(i, i + BATCH_SIZE);
    
    // Note: ensure 'onConflict' is set to purely update based on 'card_id' constraint.
    const { error: upsertError } = await (admin.from('alpha_projections') as any)
      .upsert(batch, { onConflict: 'card_id' });

    if (upsertError) {
      console.error(`Batch Upsert Error (${i} to ${i + BATCH_SIZE}):`, upsertError);
      throw new Error(`Pipeline stopped abruptly. Upserted ${totalUpserted} before failing: ${upsertError.message}`);
    }

    totalUpserted += batch.length;
  }

  return { success: true, upsertedCount: totalUpserted, message: `Successfully committed ${totalUpserted} assets to the Shadow Book.` };
}
