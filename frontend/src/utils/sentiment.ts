/**
 * NLP Sentiment Analysis Utility
 * Ingests external news RSS and calculates a qualitative momentum score ($\alpha_s$).
 */

/**
 * Universally absolute lexicon to prevent false signals.
 */
const BULLISH_TERMS = ['promoted', 'call up', 'called up', 'record', 'grand slam', 'mvp', 'homer', 'homerun', 'cycle', 'dominant', 'stellar', 'crushes', 'dominates', 'extension'];
const BEARISH_TERMS = [' il ', 'surgery', 'slump', 'demoted', 'torn', 'injured', 'injury', ' out ', 'struggles', 'worst', 'setback', 'rehab', 'brace'];

/**
 * Fetches the top recent headlines for a specific player using the public Google News RSS feed.
 */
export async function fetchPlayerNews(playerEntity: string): Promise<string[]> {
  try {
    // We add "baseball" to ensure we don't grab news for off-sport individuals with the same name.
    const query = encodeURIComponent(`"${playerEntity}" baseball`);
    const url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
    
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return [];

    const xmlData = await res.text();
    
    // Lightweight regex extraction to avoid heavy XML parser dependencies during execution
    const titleRegex = /<title>(.*?)<\/title>/g;
    const matches = [...xmlData.matchAll(titleRegex)];
    
    // The first match is usually the channel title ("Google News - ..."), so we slice it off.
    // Taking the top 10 recent headlines.
    const headlines = matches.slice(1, 11).map(m => m[1]);
    
    // Decode basic HTML entities that RSS might inject
    return headlines.map(h => 
      h.replace(/&amp;/g, '&')
       .replace(/&quot;/g, '"')
       .replace(/&#39;/g, "'")
    );
  } catch (error) {
    console.warn(`Failed to fetch news for ${playerEntity}:`, error);
    return [];
  }
}

/**
 * Calculates the Sentiment Alpha ($\alpha_s$) based on a strict heuristic dictionary.
 * Returns a float between -1.0 (Extremely Bearish) and 1.0 (Extremely Bullish).
 */
export function calculateSentimentAlpha(headlines: string[]): number {
  if (!headlines || headlines.length === 0) return 0.00;

  let score = 0;
  let matches = 0;

  for (const headline of headlines) {
    const normalizedHeadline = ` ${headline.toLowerCase()} `; // pad spaces for exact word matches like " IL "
    
    let headlineScore = 0;

    for (const term of BULLISH_TERMS) {
      if (normalizedHeadline.includes(term)) {
        headlineScore += 1;
      }
    }

    for (const term of BEARISH_TERMS) {
      if (normalizedHeadline.includes(term)) {
        headlineScore -= 1;
      }
    }

    // Clamp individual headline impact to prevent a single article packed with keywords from skewing data
    if (headlineScore > 1) headlineScore = 1;
    if (headlineScore < -1) headlineScore = -1;

    if (headlineScore !== 0) {
        score += headlineScore;
        matches += 1;
    }
  }

  // If no terms were triggered across any headlines, it is neutral noise.
  if (matches === 0) return 0.00;

  // Average the score across the number of headlines that actually triggered the lexicon, 
  // keeping the final float cleanly clamped between -1.0 and 1.0.
  const rawAlphaS = score / matches;
  return Math.max(-1.0, Math.min(1.0, rawAlphaS));
}
