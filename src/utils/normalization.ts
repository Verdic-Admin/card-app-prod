/**
 * Normalizes a sports card player name into a clean, lower-case identifier.
 * This removes diacritics (accents), trims whitespace, and forces lowercase
 * so that "Agustín Ramírez", "agustin ramirez", and "AGUSTIN RAMIREZ"
 * all mathematically cluster as the same entity ('agustin ramirez').
 */
export function normalizePlayerName(name: string | null | undefined): string {
  if (!name) return 'unknown';

  return name
    .trim()
    .toLowerCase()
    // NFD splits characters from their diacritics. The regex matches the diacritic range and removes them.
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
