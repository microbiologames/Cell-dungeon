/* ---------------------------------------------------------------------------
   Palettes. Fond noir + marquage vital a l'orange d'acridine :
   cellules vivantes en vert, ADN libre et cellules mortes en orange-rouge.
   Douze couleurs par matrice, pas plus (contrainte pour les futurs sprites).
   Justification dans docs/06-heritage-wet-mount.md.
--------------------------------------------------------------------------- */

import { hexToRgba } from '../core/pixel.js';

/** Couleurs communes a toutes les matrices (joueur, interface, retours). */
export const UI = {
  player: hexToRgba('#7dff9b'),
  playerRim: hexToRgba('#2ea84f'),
  playerCore: hexToRgba('#d8ffe4'),
  acid: hexToRgba('#c9ff5a'),
  acidRim: hexToRgba('#7fbf16'),
  dna: hexToRgba('#ff9b3d'),
  dnaGlow: hexToRgba('#ffd9a0'),
  plasmid: hexToRgba('#ffe14d'),
  hostile: hexToRgba('#ff5a6e'),
  damage: hexToRgba('#ff2e46'),
  heal: hexToRgba('#6affc8'),
  gel: hexToRgba('#6ea8ff'),
  shield: hexToRgba('#8fd6ff'),
  ally: hexToRgba('#c98aff'),
  text: hexToRgba('#cfe6d8'),
  textDim: hexToRgba('#5d7a68'),
  textHot: hexToRgba('#ffd479'),
  frame: hexToRgba('#24402f'),
};

/* Teintes d'organismes : le fond noir autorise des verts francs, et
   l'orange est reserve a tout ce qui touche aux acides nucleiques. */
const COMMON_ORG = {
  bact: hexToRgba('#9be8a8'), bactRim: hexToRgba('#3f8a55'),
  rod: hexToRgba('#8fd9e8'), rodRim: hexToRgba('#2f7f92'),
  fast: hexToRgba('#ffd06b'), fastRim: hexToRgba('#b57a12'),
  yeast: hexToRgba('#e0c68a'), yeastRim: hexToRgba('#8a6f34'),
  spore: hexToRgba('#f4f7e8'), sporeRim: hexToRgba('#7c8a6a'),
  hypha: hexToRgba('#b7a9d6'), hyphaRim: hexToRgba('#5d4f80'),
  phage: hexToRgba('#ff8ad4'), phageRim: hexToRgba('#a32c78'),
  boss: hexToRgba('#ff6b52'), bossRim: hexToRgba('#a32c18'),
  amoeba: hexToRgba('#9fb8ff'), amoebaRim: hexToRgba('#3d5299'),
};

export const MATRICES_PALETTE = {
  milk: {
    name: 'LAIT CRU',
    bg: hexToRgba('#02060a'),
    haze: hexToRgba('#0d2118', 70),      // voile vert laiteux du fond noir
    debris: hexToRgba('#59705f'),        // globules gras, tres refringents
    debrisRim: hexToRgba('#93b39c'),
    edge: hexToRgba('#1d4633'),          // menisque de la goutte
    tint: hexToRgba('#0a1f14', 40),
    ...COMMON_ORG,
  },
  pipe: {
    name: 'CONDUITE',
    bg: hexToRgba('#02070a'),
    haze: hexToRgba('#0a1d26', 70),
    debris: hexToRgba('#26363d'),
    debrisRim: hexToRgba('#4d6a75'),
    edge: hexToRgba('#1b4250'),
    tint: hexToRgba('#08191f', 40),
    ...COMMON_ORG,
  },
  kombucha: {
    name: 'KOMBUCHA',
    bg: hexToRgba('#080502'),
    haze: hexToRgba('#241705', 70),
    debris: hexToRgba('#3b2a12'),
    debrisRim: hexToRgba('#6b5124'),
    edge: hexToRgba('#59400f'),
    tint: hexToRgba('#1d1204', 40),
    ...COMMON_ORG,
  },
  blood: {
    name: 'SANG',
    bg: hexToRgba('#0a0206'),
    haze: hexToRgba('#2a0713', 70),
    debris: hexToRgba('#4a1020'),
    debrisRim: hexToRgba('#7d2338'),
    edge: hexToRgba('#6b1228'),
    tint: hexToRgba('#20040d', 40),
    ...COMMON_ORG,
  },
};

export const RARITY_COLOR = {
  commune: hexToRgba('#9aa8a0'),
  peucommune: hexToRgba('#6fd98a'),
  rare: hexToRgba('#59c9ff'),
  epique: hexToRgba('#c07bff'),
  legendaire: hexToRgba('#ffd24a'),
};

export const RARITY_HEX = {
  commune: '#9aa8a0',
  peucommune: '#6fd98a',
  rare: '#59c9ff',
  epique: '#c07bff',
  legendaire: '#ffd24a',
};
