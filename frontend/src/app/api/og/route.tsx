import { ImageResponse } from 'next/og';
import pool from '@/utils/db';
import { getStoreSettings } from '@/app/actions/settings';

export const runtime = 'nodejs';

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

  let cardImageUrl: string | null = null;
  let siteName = 'Sports Card Store';
  let siteAuthor: string | null = null;
  
  try {
    let queryStr = "SELECT image_url FROM inventory WHERE status = 'available' AND image_url IS NOT NULL";
    let values: any[] = [];
    
    if (q) {
      values.push(`%${q}%`);
      queryStr += ` AND (player_name ILIKE $${values.length} OR team_name ILIKE $${values.length} OR card_set ILIKE $${values.length})`;
    }
    if (team) {
      values.push(`%${team}%`);
      queryStr += ` AND team_name ILIKE $${values.length}`;
    }
    if (year) {
      values.push(`${year}%`);
      queryStr += ` AND card_set ILIKE $${values.length}`;
    }
    queryStr += " LIMIT 1";

    const { rows } = await sql.query(queryStr, values);
    if (rows && rows.length > 0 && rows[0].image_url) {
      cardImageUrl = rows[0].image_url;
    }

    const brandData = await getStoreSettings();
    if (brandData?.site_name) siteName = brandData.site_name;
    if (brandData?.site_author) siteAuthor = brandData.site_author;
  } catch (e) {
    console.error("OG Image generation DB error:", e);
  }

  const title = label ? `Shop ${label} Cards` : siteName;

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
            {siteName}
          </span>
          {siteAuthor && (
            <span style={{ color: '#3f3f46', fontSize: '16px', fontWeight: 500 }}>
              by {siteAuthor}
            </span>
          )}
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
