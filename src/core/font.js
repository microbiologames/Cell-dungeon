/* Fonte bitmap 3x5 : chiffres, capitales et quelques signes.
   Chaque glyphe tient sur 15 bits, 3 par ligne, du haut vers le bas.
   Les textes longs (cartes d'evolution) passent par le DOM, pas par ici. */

const G = {
  '0': [7, 5, 5, 5, 7], '1': [2, 6, 2, 2, 7], '2': [7, 1, 7, 4, 7],
  '3': [7, 1, 7, 1, 7], '4': [5, 5, 7, 1, 1], '5': [7, 4, 7, 1, 7],
  '6': [7, 4, 7, 5, 7], '7': [7, 1, 1, 1, 1], '8': [7, 5, 7, 5, 7],
  '9': [7, 5, 7, 1, 7],
  A: [7, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [7, 4, 4, 4, 7],
  D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7], F: [7, 4, 6, 4, 4],
  G: [7, 4, 5, 5, 7], H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7],
  J: [1, 1, 1, 5, 7], K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7],
  M: [5, 7, 7, 5, 5], N: [6, 5, 5, 5, 5], O: [7, 5, 5, 5, 7],
  P: [7, 5, 7, 4, 4], Q: [7, 5, 5, 7, 1], R: [7, 5, 6, 5, 5],
  S: [7, 4, 7, 1, 7], T: [7, 2, 2, 2, 2], U: [5, 5, 5, 5, 7],
  V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5], X: [5, 5, 2, 5, 5],
  Y: [5, 5, 7, 2, 2], Z: [7, 1, 2, 4, 7],
  ' ': [0, 0, 0, 0, 0], '-': [0, 0, 7, 0, 0], '.': [0, 0, 0, 0, 2],
  ':': [0, 2, 0, 2, 0], '/': [1, 1, 2, 4, 4], '%': [5, 1, 2, 4, 5],
  '+': [0, 2, 7, 2, 0], '!': [2, 2, 2, 0, 2], '?': [7, 1, 3, 0, 2],
  'x': [0, 5, 2, 5, 0], '<': [1, 2, 4, 2, 1], '>': [4, 2, 1, 2, 4],
  '|': [2, 2, 2, 2, 2], "'": [2, 2, 0, 0, 0], ',': [0, 0, 0, 2, 4],
  '(': [1, 2, 2, 2, 1], ')': [4, 2, 2, 2, 4], '=': [0, 7, 0, 7, 0],
};

/* Les accents francais sont aplatis : a 3 px de large on ne les lirait pas. */
const FOLD = {
  'À': 'A', 'Â': 'A', 'Ä': 'A', 'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E',
  'Î': 'I', 'Ï': 'I', 'Ô': 'O', 'Ö': 'O', 'Ù': 'U', 'Û': 'U', 'Ü': 'U',
  'Ç': 'C', 'Œ': 'O',
};

export const GLYPH_W = 3;
export const GLYPH_H = 5;

function glyph(ch) {
  const up = ch.toUpperCase();
  return G[ch] || G[up] || G[FOLD[up]] || null;
}

export function textWidth(str, spacing = 1) {
  if (!str.length) return 0;
  return str.length * (GLYPH_W + spacing) - spacing;
}

/**
 * Ecrit un texte dans le tampon principal (non floute).
 * @param {import('./pixel.js').Screen} scr
 */
export function drawText(scr, str, x, y, color, spacing = 1) {
  let cx = x | 0;
  for (const ch of String(str)) {
    const g = glyph(ch);
    if (g) {
      for (let row = 0; row < GLYPH_H; row++) {
        const bits = g[row];
        if (!bits) continue;
        if (bits & 4) scr.direct(cx, y + row, color);
        if (bits & 2) scr.direct(cx + 1, y + row, color);
        if (bits & 1) scr.direct(cx + 2, y + row, color);
      }
    }
    cx += GLYPH_W + spacing;
  }
  return cx - spacing;
}

export function drawTextCentered(scr, str, cx, y, color, spacing = 1) {
  return drawText(scr, str, cx - (textWidth(str, spacing) >> 1), y, color, spacing);
}

export function drawTextRight(scr, str, rx, y, color, spacing = 1) {
  return drawText(scr, str, rx - textWidth(str, spacing), y, color, spacing);
}
