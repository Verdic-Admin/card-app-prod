import pool from '@/utils/db';
import type { Metadata } from "next";
import { Hero } from "@/components/Hero";
import { CardGrid } from "@/components/CardGrid";
import { StoreFilters } from "@/components/StoreFilters";
import { getStoreSettings } from "@/app/actions/settings";

/**
 * Normalise an env var that may have been pasted with a leading ` =` prefix
 * (a common Railway copy-paste mistake).  Returns a valid HTTPS origin or ''.
 */
function sanitizeOrigin(raw: string | undefined): string {
  if (!raw) return '';
  const trimmed = raw.trim().replace(/^=\s*/, '').trim().replace(/\/$/, '');
  try { new URL(trimmed); return trimmed; } catch { return ''; }
}

const BASE_URL =
  sanitizeOrigin(process.env.NEXT_PUBLIC_SITE_URL) ||
  sanitizeOrigin(process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : '') ||
  '';

/** Builds the URL for our dynamic /api/og edge route, or null if no origin is known. */
function buildOgImageUrl(base: string, params: { q?: string; team?: string }): string | null {
  if (!base) return null;
  try {
    const url = new URL(`${base}/api/og`);
    if (params.q)    url.searchParams.set('q',    params.q);
    if (params.team) url.searchParams.set('team', params.team);
    return url.toString();
  } catch {
    return null;
  }
}

type PageProps = { searchParams: Promise<{ [key: string]: string | undefined }> | any };

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const settings = await getStoreSettings();

  const siteName = settings.site_name;
  const defaultDescription = settings.store_description;

  // Build a human-readable label from whatever filter is active
  const query = params?.q;
  const team  = params?.team;

  let label: string | null = null;
  if (query) label = query.trim();
  else if (team) label = team;

  const title = label ? `Shop ${label} Cards | ${siteName}` : siteName;
  const description = label
    ? `Browse ${label} sports cards at ${siteName} — zero fees, direct to you.`
    : defaultDescription;

  const ogImageUrl = buildOgImageUrl(BASE_URL, { q: query, team });

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(BASE_URL ? { url: BASE_URL } : {}),
      siteName,
      ...(ogImageUrl ? { images: [{ url: ogImageUrl, width: 1200, height: 630, alt: title }] } : {}),
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(ogImageUrl ? { images: [ogImageUrl] } : {}),
    },
  };
}


export default async function Home(props: { searchParams: Promise<{ [key: string]: string | undefined }> | any }) {
  const searchParams = await props.searchParams;

  const settings = await getStoreSettings();

  // 1. Dynamically extract the highly precise lists of available teams and years that actually exist in the DB right now
  let filterData: any[] = [];
  try {
    const res = await pool.query(`SELECT DISTINCT team_name FROM inventory WHERE status = 'available' AND team_name IS NOT NULL`);
    filterData = res.rows;
  } catch (err: any) {
    console.error("Filter DB Query Failed:", err.message);
  }
  const availableTeams = filterData.map(d => d.team_name).sort();

  // 2. Base Query Builder using Next.js pure SearchParams to natively enable shareable Deep Links instantly
  let items = [];
  let error = null;
  try {
     let queryStr = "SELECT * FROM inventory WHERE status = 'available'";
     const values: any[] = [];
     
     if (searchParams?.q) {
         values.push(`%${searchParams.q}%`);
         queryStr += ` AND (player_name ILIKE $${values.length} OR team_name ILIKE $${values.length} OR card_set ILIKE $${values.length})`;
     }
     if (searchParams?.team) {
         values.push(searchParams.team);
         queryStr += ` AND team_name ILIKE $${values.length}`;
     }
     if (searchParams?.minPrice) {
         values.push(searchParams.minPrice);
         queryStr += ` AND listed_price >= $${values.length}`;
     }
     if (searchParams?.maxPrice) {
         values.push(searchParams.maxPrice);
         queryStr += ` AND listed_price <= $${values.length}`;
     }
     if (searchParams?.type) {
         if (searchParams.type === 'auto') {
             queryStr += ` AND (insert_name ILIKE '%Auto%' OR parallel_name ILIKE '%Auto%' OR parallel_insert_type ILIKE '%Auto%')`;
         } else if (searchParams.type === 'relic') {
             queryStr += ` AND (insert_name ILIKE '%Relic%' OR parallel_name ILIKE '%Relic%' OR parallel_insert_type ILIKE '%Relic%' OR insert_name ILIKE '%Patch%' OR parallel_name ILIKE '%Patch%' OR parallel_insert_type ILIKE '%Patch%')`;
         } else if (searchParams.type === 'rookie') {
             queryStr += ` AND (insert_name ILIKE '%Rookie%' OR parallel_name ILIKE '%Rookie%' OR parallel_insert_type ILIKE '%Rookie%' OR insert_name ILIKE '%RC%' OR parallel_name ILIKE '%RC%' OR parallel_insert_type ILIKE '%RC%')`;
         }
     }

     queryStr += " ORDER BY player_name ASC";
     const { rows } = await pool.query(queryStr, values);
     items = rows;
  } catch (err) {
     error = err;
  }


  if (error) {
    console.error("Error fetching available inventory:", error);
  }

  const hasFilters = Boolean(searchParams?.q || searchParams?.team || searchParams?.minPrice || searchParams?.maxPrice);

  if (!hasFilters && items.length === 0) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-background px-4">
        <div className="max-w-2xl w-full text-center">
          <div className="w-24 h-24 mx-auto mb-8 bg-surface border border-border rounded-full flex items-center justify-center shadow-2xl">
            <svg className="w-10 h-10 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-foreground tracking-tight mb-4">{settings.site_name}</h1>
          <p className="text-xl text-muted mb-8 font-medium">Coming Soon</p>
          <div className="bg-surface/50 border border-border/50 rounded-2xl p-6 md:p-8">
            <p className="text-muted">
              We are currently scanning and organizing our initial inventory. 
              Check back shortly as we go live with our first batch of premium cards!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Hero settings={settings} />
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16 flex flex-col lg:flex-row items-start gap-8">
        
        <StoreFilters availableTeams={availableTeams} />

        <div className="flex-1 w-full min-w-0">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-black tracking-tight text-foreground">Available Inventory</h2>
            <span className="bg-cyan-950 text-brand-hover text-xs font-bold px-3 py-1 rounded-full inline-flex items-center gap-2 flex-shrink-0 border border-cyan-900/50">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              {items?.length || 0} Cards
            </span>
          </div>
          
          {error ? (
            <div className="bg-red-950/30 text-red-400 border border-red-900/50 font-bold p-4 rounded-lg shadow-sm">
              Failed to load inventory. Please try again later.
            </div>
          ) : (
            <CardGrid
              items={items || []}
              discountRate={settings.oracle_discount_percentage}
              emptyMessage="Zero cards match those filters. Try clearing your search!"
            />
          )}
        </div>
      </div>
    </div>
  );
}
