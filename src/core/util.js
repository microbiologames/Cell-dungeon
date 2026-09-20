/* Outils numériques partagés. */

export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);

/** Générateur déterministe : deux runs de même graine sont identiques. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bruit de valeur stable en espace écran (pas de scintillement image à image). */
export function hash2(x, y) {
  let n = (x | 0) * 374761393 + (y | 0) * 668265263;
  n = Math.imul(n ^ (n >> 13), 1274126177);
  return ((n ^ (n >> 16)) >>> 0) / 4294967296;
}

/** Tirage pondéré : entries = [{w:poids, ...}] */
export function weightedPick(rng, entries, weightOf = (e) => e.w) {
  let total = 0;
  for (const e of entries) total += weightOf(e);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const e of entries) {
    r -= weightOf(e);
    if (r <= 0) return e;
  }
  return entries[entries.length - 1];
}

/** Distance angulaire signée la plus courte. */
export function angDelta(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** Formate un temps en m:ss. */
export function mmss(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
