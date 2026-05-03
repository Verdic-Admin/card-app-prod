import { calculatePricingAction } from '@/app/actions/oracleAPI';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // We expect fields like player_name, card_set, etc.
    if (!body.player_name || !body.card_set) {
      return NextResponse.json({ success: false, error: 'Player name and card set are required' }, { status: 400 });
    }

    const result = await calculatePricingAction({
      player_name: body.player_name,
      card_set: body.card_set,
      card_number: body.card_number,
      insert_name: body.insert_name,
      parallel_name: body.parallel_name,
      print_run: body.print_run,
      is_rookie: body.is_rookie,
      is_1st: body.is_1st,
      is_short_print: body.is_short_print,
      is_ssp: body.is_ssp,
      is_auto: body.is_auto,
      is_relic: body.is_relic,
      grade: body.grade,
    });

    if (!result || typeof result !== 'object' || !('success' in result) || !result.success) {
       return NextResponse.json({ success: false, error: (result as any)?.error || 'Pricing failed' }, { status: 400 });
    }

    const data = (result as any).data;
    const projection = Number(data.projected_target ?? data.target_price ?? 0);
    const marketBase = data.current_price != null && Number(data.current_price) > 0 ? Number(data.current_price) : projection;

    return NextResponse.json({
        success: true,
        market_price: marketBase,
        ebay_comps: data.ebay_comps || [],
        player_index_url: data.player_index_url || ''
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
