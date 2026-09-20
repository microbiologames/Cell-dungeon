/* ---------------------------------------------------------------------------
   Palettes.

   Chaque matrice choisit son MODE d'observation, et ce n'est pas un detail
   esthetique : c'est ce que l'on verrait reellement.

     mode 'bright'  fond clair, organismes SOMBRES.
                    C'est un frottis colore observe en fond clair. Le lait
                    cru est blanc : un fond noir y etait contre-intuitif.
                    La lisibilite est assuree par la COLORATION, pas par le
                    fond noir — un frottis de Gram est parfaitement lisible.

     mode 'dark'    fond noir, organismes LUMINEUX (fond noir et marquage
                    vital). Garde pour la conduite, le kombucha et le sang,
                    ou le milieu n'est pas blanc.

   Le HUD vit toujours sur le pourtour noir de l'objectif, quel que soit le
   mode : ses couleurs (UI) sont donc independantes de la matrice.
   Les couleurs de JEU (joueur, acide, acides amines...) sont par matrice,
   puisqu'elles doivent trancher sur son fond.
--------------------------------------------------------------------------- */

import { hexToRgba } from '../core/pixel.js';

/** Chrome du HUD : toujours sur le noir du pourtour. */
export const UI = {
  text: hexToRgba('#cfe6d8'),
  textDim: hexToRgba('#5d7a68'),
  textHot: hexToRgba('#ffd479'),
  frame: hexToRgba('#24402f'),
  /* Reprises pour les jauges, qui sont elles aussi sur le noir. */
  player: hexToRgba('#7dff9b'),
  acid: hexToRgba('#c9ff5a'),
  acidRim: hexToRgba('#7fbf16'),
  aa: hexToRgba('#ff9b3d'),
  aaGlow: hexToRgba('#ffd9a0'),
  plasmid: hexToRgba('#ffe14d'),
  hostile: hexToRgba('#ff5a6e'),
  damage: hexToRgba('#ff2e46'),
  heal: hexToRgba('#6affc8'),
  shield: hexToRgba('#8fd6ff'),
  ally: hexToRgba('#c98aff'),
};

/* --- jeu de couleurs pour un FOND CLAIR (frottis colore) ---------------- */
const BRIGHT = {
  mode: 'bright',
  /* Un objet hors du plan focal, en fond clair, s'etale et FONCE le fond :
     son halo est sombre, pas lumineux. */
  halo: hexToRgba('#6b6455', 150),

  player: hexToRgba('#2f9e5e'), playerRim: hexToRgba('#14512f'),
  playerCore: hexToRgba('#b7f2ce'),
  acid: hexToRgba('#7d9c0e'), acidRim: hexToRgba('#4d6106'),
  acidCore: hexToRgba('#d8ee7c'),
  aa: hexToRgba('#c7590a'), aaGlow: hexToRgba('#f09a35'),
  plasmid: hexToRgba('#b8860b'),
  hostile: hexToRgba('#b32236'), damage: hexToRgba('#9e1122'),
  heal: hexToRgba('#178a62'), gel: hexToRgba('#6f93cf'),
  shield: hexToRgba('#2a6f9e'), ally: hexToRgba('#7a3fb0'),

  /* Organismes : teinte par ROLE (voir docs/05-roadmap-assets.md) */
  bact: hexToRgba('#2e7d4f'), bactRim: hexToRgba('#14472a'),
  rod: hexToRgba('#1f6b7a'), rodRim: hexToRgba('#0c3941'),
  fast: hexToRgba('#c2621a'), fastRim: hexToRgba('#6e320a'),
  yeast: hexToRgba('#8a6a22'), yeastRim: hexToRgba('#4a3710'),
  hypha: hexToRgba('#5b4a8a'), hyphaRim: hexToRgba('#2e2349'),
  phage: hexToRgba('#b02a76'), phageRim: hexToRgba('#601040'),
  amoeba: hexToRgba('#3a4a9a'), amoebaRim: hexToRgba('#1a2250'),
  neutral: hexToRgba('#9a9486'), neutralRim: hexToRgba('#615c50'),
  boss: hexToRgba('#b8322a'), bossRim: hexToRgba('#631411'),
  /* L'endospore est refringente : claire, a paroi tres marquee. */
  spore: hexToRgba('#fbfbf0'), sporeRim: hexToRgba('#4f4f3c'),
};

/* --- jeu de couleurs pour un FOND NOIR (marquage vital) ----------------- */
const DARK = {
  mode: 'dark',
  halo: hexToRgba('#d2ffeb', 150),

  player: hexToRgba('#7dff9b'), playerRim: hexToRgba('#2ea84f'),
  playerCore: hexToRgba('#d8ffe4'),
  acid: hexToRgba('#c9ff5a'), acidRim: hexToRgba('#7fbf16'),
  acidCore: hexToRgba('#f2ffd0'),
  aa: hexToRgba('#ff9b3d'), aaGlow: hexToRgba('#ffd9a0'),
  plasmid: hexToRgba('#ffe14d'),
  hostile: hexToRgba('#ff5a6e'), damage: hexToRgba('#ff2e46'),
  heal: hexToRgba('#6affc8'), gel: hexToRgba('#6ea8ff'),
  shield: hexToRgba('#8fd6ff'), ally: hexToRgba('#c98aff'),

  bact: hexToRgba('#9be8a8'), bactRim: hexToRgba('#3f8a55'),
  rod: hexToRgba('#8fd9e8'), rodRim: hexToRgba('#2f7f92'),
  fast: hexToRgba('#ffd06b'), fastRim: hexToRgba('#b57a12'),
  yeast: hexToRgba('#e0c68a'), yeastRim: hexToRgba('#8a6f34'),
  hypha: hexToRgba('#b7a9d6'), hyphaRim: hexToRgba('#5d4f80'),
  phage: hexToRgba('#ff8ad4'), phageRim: hexToRgba('#a32c78'),
  amoeba: hexToRgba('#9fb8ff'), amoebaRim: hexToRgba('#3d5299'),
  neutral: hexToRgba('#8d94a8'), neutralRim: hexToRgba('#4a5060'),
  boss: hexToRgba('#ff6b52'), bossRim: hexToRgba('#a32c18'),
  spore: hexToRgba('#f4f7e8'), sporeRim: hexToRgba('#7c8a6a'),
};

export const MATRICES_PALETTE = {
  milk: {
    name: 'LAIT CRU',
    ...BRIGHT,
    /* Le lait : blanc casse, legerement chaud. */
    bg: hexToRgba('#e9e5d7'),
    haze: hexToRgba('#cfc9b4', 90),        // nuees de caseine
    /* Les globules gras SONT le lait : a peine plus clairs que le fond,
       avec une paroi nette. C'est ainsi qu'on les voit vraiment. */
    debris: hexToRgba('#fbf9ef'), debrisRim: hexToRgba('#8a8069'),
    edge: hexToRgba('#8d846a'),                 // menisque de la goutte
    tint: hexToRgba('#d9d4c0', 40),
  },
  pipe: {
    name: 'CONDUITE',
    ...DARK,
    bg: hexToRgba('#02070a'),
    haze: hexToRgba('#0a1d26', 70),
    debris: hexToRgba('#26363d'), debrisRim: hexToRgba('#4d6a75'),
    edge: hexToRgba('#1b4250'),
    tint: hexToRgba('#08191f', 40),
  },
  kombucha: {
    name: 'KOMBUCHA',
    ...DARK,
    bg: hexToRgba('#080502'),
    haze: hexToRgba('#241705', 70),
    debris: hexToRgba('#3b2a12'), debrisRim: hexToRgba('#6b5124'),
    edge: hexToRgba('#59400f'),
    tint: hexToRgba('#1d1204', 40),
  },
  blood: {
    name: 'SANG',
    ...DARK,
    bg: hexToRgba('#0a0206'),
    haze: hexToRgba('#2a0713', 70),
    debris: hexToRgba('#4a1020'), debrisRim: hexToRgba('#7d2338'),
    edge: hexToRgba('#6b1228'),
    tint: hexToRgba('#20040d', 40),
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
