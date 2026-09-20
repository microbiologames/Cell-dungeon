/* ---------------------------------------------------------------------------
   Sprites.

   Format : pixels INDEXES sur une palette courte, encodes en une chaine.
   Pas de PNG charge a l'execution, donc pas d'asynchrone, pas de requete, et
   la page reste un seul fichier deployable. Un sprite de 16x16 pese une
   centaine d'octets.

   Le rendu accepte une rotation quelconque par echantillonnage inverse :
   a ces tailles, le plus proche voisin est exactement ce qu'on veut, il
   garde les pixels francs au lieu de les lisser.
--------------------------------------------------------------------------- */

import { fade32 } from '../core/pixel.js';

const ALPHABET = '.0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * @typedef {{w:number, h:number, ox:number, oy:number,
 *            palette:number[], px:Uint8Array}} Sprite
 */

/** Decode un sprite depuis sa forme compacte. */
export function decodeSprite({ w, h, palette, data, ox, oy }) {
  const px = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const c = data[i];
    px[i] = c === '.' ? 0 : ALPHABET.indexOf(c);
  }
  return { w, h, ox: ox ?? w / 2, oy: oy ?? h / 2, palette, px };
}

export function encodeSprite(w, h, palette, indices, ox, oy) {
  let data = '';
  for (let i = 0; i < w * h; i++) data += indices[i] === 0 ? '.' : ALPHABET[indices[i]];
  return { w, h, ox, oy, palette, data };
}

/**
 * Dessine un sprite dans le calque courant.
 * @param {import('../core/pixel.js').Screen} scr
 * @param {Sprite} sp
 * @param {number} scale  1 = taille native
 */
export function drawSprite(scr, sp, cx, cy, angle = 0, alpha = 1, scale = 1) {
  const ca = Math.cos(-angle), sa = Math.sin(-angle);
  /* Boite englobante apres rotation, arrondie au pixel superieur. */
  const rad = Math.ceil(Math.hypot(sp.w, sp.h) * 0.5 * scale) + 1;
  const inv = 1 / scale;
  for (let y = -rad; y <= rad; y++) {
    for (let x = -rad; x <= rad; x++) {
      /* Echantillonnage INVERSE : on part du pixel ecran et on remonte a la
         source, sinon une rotation laisse des trous. */
      const sx = (x * ca - y * sa) * inv + sp.ox;
      const sy = (x * sa + y * ca) * inv + sp.oy;
      const ix = Math.floor(sx), iy = Math.floor(sy);
      if (ix < 0 || iy < 0 || ix >= sp.w || iy >= sp.h) continue;
      const idx = sp.px[iy * sp.w + ix];
      if (idx === 0) continue;
      const col = sp.palette[idx];
      scr.plot(cx + x, cy + y, alpha >= 1 ? col : fade32(col, alpha));
    }
  }
}

/* Registre : rempli par src/render/sprite-data.js s'il existe. Tant qu'une
   entree manque, organisms.js retombe sur la forme procedurale, donc les
   assets peuvent arriver UN PAR UN sans jamais casser le jeu. */
export const SPRITE_REGISTRY = new Map();

export function registerSprites(table) {
  for (const [id, raw] of Object.entries(table)) {
    SPRITE_REGISTRY.set(id, decodeSprite(raw));
  }
}

export function getSprite(id) {
  return SPRITE_REGISTRY.get(id) || null;
}
