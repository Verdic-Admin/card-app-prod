'use server'

import { createClient } from '@/utils/supabase/server'

export type ShadowBookItem = {
  id: string;
  inventory_id: string;
  player_name: string | null;
  team_name: string | null;
  card_set: string | null;
  parallel_insert_type: string | null;
  listed_price: number | null;
  is_hub: boolean | null;
  pbi_target: number | null;
  c_set: number | null;
  m_parallel: number | null;
  alpha_f: number | null;
  alpha_s: number | null;
  afv: number | null;
}

export async function getShadowBookData(): Promise<ShadowBookItem[]> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error("Unauthorized to access Shadow Book data")
  }

  // Perform a LEFT JOIN from inventory to alpha_projections
  // so we see all live inventory items, even those missing projections yet
  const { data, error } = await supabase
    .from('inventory')
    .select(`
      id,
      player_name,
      team_name,
      card_set,
      parallel_insert_type,
      listed_price,
      alpha_projections (
        id,
        is_hub,
        pbi_target,
        c_set,
        m_parallel,
        alpha_f,
        alpha_s,
        afv
      )
    `)
    .order('player_name', { ascending: true });

  if (error) {
    console.error("Error fetching Shadow Book DB data:", error)
    throw new Error(`Failed to load alpha projections: ${error.message}`)
  }

  // Flatten the response for the frontend table
  const formattedData: ShadowBookItem[] = (data || []).map((item: any) => {
    // There could be multiple projections but we assume 1:1 or 1:0 for now
    const projection = Array.isArray(item.alpha_projections) 
      ? item.alpha_projections[0] 
      : item.alpha_projections;

    return {
      inventory_id: item.id,
      id: projection?.id || `virtual-${item.id}`,
      player_name: item.player_name,
      team_name: item.team_name,
      card_set: item.card_set,
      parallel_insert_type: item.parallel_insert_type,
      listed_price: item.listed_price,
      is_hub: projection?.is_hub ?? false,
      pbi_target: projection?.pbi_target ?? null,
      c_set: projection?.c_set ?? null,
      m_parallel: projection?.m_parallel ?? null,
      alpha_f: projection?.alpha_f ?? null,
      alpha_s: projection?.alpha_s ?? null,
      afv: projection?.afv ?? null,
    };
  });

  return formattedData;
}
