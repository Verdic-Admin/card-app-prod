import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const SITE_NAME = 'Into the Gap Sportscards';
const HANDLE   = 'by logic_in_the_gap';

// Lightweight admin client safe for edge (uses anon key — read-only public data only)
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q    = searchParams.get('q')    ?? '';
  const team = searchParams.get('team') ?? '';
  const year = searchParams.get('year') ?? '';

  // --- Build a human-readable label ---
  let label = '';
  if (q) label = q.trim();
  else if (team && year) label = `${year} ${team}`;
  else if (team) label = team;
  else if (year) label = year;

  // --- Try to pull a matching card image from Supabase ---
  let cardImageUrl: string | null = null;
  try {
    const supabase = getSupabase();
    let query = (supabase.from('inventory') as any)
      .select('image_url')
      .eq('status', 'available');

    if (q)    query = query.or(`player_name.ilike.%${q}%,team_name.ilike.%${q}%,card_set.ilike.%${q}%`);
    if (team) query = query.ilike('team_name', team);
    if (year) query = query.eq('year', year);

    const { data } = await query.limit(1).single();
    if (data?.image_url) cardImageUrl = data.image_url;
  } catch {
    // Silently fall back to the brandmark-only design
  }

  const title = label ? `Shop ${label} Cards` : SITE_NAME;

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          background: 'linear-gradient(135deg, #09090b 0%, #18181b 60%, #0e1a2b 100%)',
          fontFamily: 'sans-serif',
          overflow: 'hidden',
        }}
      >
        {/* Subtle grid texture overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(circle, rgba(6,182,212,0.06) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        {/* Left: branding block */}
        <div
          style={{
            position: 'absolute',
            left: '64px',
            bottom: '48px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          {/* Accent pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px',
            }}
          >
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#22d3ee',
              }}
            />
            <span style={{ color: '#22d3ee', fontSize: '16px', fontWeight: 700, letterSpacing: '0.08em' }}>
              ZERO FEES · PAYPAL PROTECTED
            </span>
          </div>

          {/* Dynamic title */}
          <span
            style={{
              color: '#ffffff',
              fontSize: title.length > 28 ? '44px' : '52px',
              fontWeight: 900,
              lineHeight: 1.1,
              maxWidth: cardImageUrl ? '580px' : '900px',
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </span>

          {/* Site name + handle */}
          <span style={{ color: '#71717a', fontSize: '20px', fontWeight: 600, marginTop: '6px' }}>
            {SITE_NAME}
          </span>
          <span style={{ color: '#3f3f46', fontSize: '16px', fontWeight: 500 }}>
            {HANDLE}
          </span>
        </div>

        {/* Right: card image — object-fit: contain, no crop */}
        {cardImageUrl && (
          <div
            style={{
              position: 'absolute',
              right: '0px',
              top: '0px',
              width: '440px',
              height: '630px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {/* Soft left-edge fade so the card blends into the dark background */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to right, #09090b 0%, transparent 30%)',
                zIndex: 2,
              }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cardImageUrl}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                objectPosition: 'center',
              }}
            />
          </div>
        )}
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
