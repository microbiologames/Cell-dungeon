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
  /* Halo de contraste de phase. C'est un ARTEFACT REEL de la technique : le
     bord d'un objet dephase la lumiere plus fort que son centre, et l'anneau
     de diffraction ressort en clair autour de lui. En fond clair, il se lit
     comme un lisere blanc entre l'organisme sombre et le milieu creme. */
  phase: hexToRgba('#ffffff', 96),
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

  /* --- couleurs des SOUCHES JOUABLES ------------------------------------
     Regle du jeu : la forme porte l'espece, la couleur porte la menace. Elle
     s'applique aux MOBS. Le joueur, lui, est seul de son espece a l'ecran :
     sa couleur peut donc dire QUI il est, et c'est la seule information qui
     manquerait sinon quand quatre souches partagent le meme champ.

     Deux teintes sur quatre sont des caracteres d'identification reels :
     la staphyloxanthine dore vraiment S. aureus (c'est son nom), et le
     violet de B. cereus est celui du cristal violet du Gram, qui colore
     tous les Gram positif. */
  souches: {
    lactobacillus: { fill: hexToRgba('#2f9e5e'), rim: hexToRgba('#14512f'), core: hexToRgba('#b7f2ce') },
    cereus: { fill: hexToRgba('#5e3aa8'), rim: hexToRgba('#2a1552'), core: hexToRgba('#d9c8ff') },
    aureus: { fill: hexToRgba('#a8790a'), rim: hexToRgba('#4f3500'), core: hexToRgba('#ffdf8a') },
    /* Sepia et non or : en fond clair, le doré de la levure tombait sur la
       teinte `yeast` des mobs splitter (#8a6a22) et le joueur se confondait
       avec un Kluyveromyces a deux cases de lui. */
    cerevisiae: { fill: hexToRgba('#6b4a2a'), rim: hexToRgba('#2e1d0c'), core: hexToRgba('#f0dfc0') },
  },
  /* --- couleurs des TOXINES ---------------------------------------------
     Chaque tir prend la teinte de ce qu'il est reellement : l'acide lactique
     jaune-vert du lactate, la cereulide d'un cristal cireux, l'hemolysine du
     dore de la souche qui la secrete, l'ethanol presque incolore. */
  tirs: {
    lactate: { fill: hexToRgba('#7d9c0e'), rim: hexToRgba('#4d6106'), core: hexToRgba('#d8ee7c') },
    cereulide: { fill: hexToRgba('#4a4a66'), rim: hexToRgba('#20203a'), core: hexToRgba('#e6e6f5') },
    alphatoxine: { fill: hexToRgba('#9a5a00'), rim: hexToRgba('#4d2c00'), core: hexToRgba('#ffd79a') },
    ethanol: { fill: hexToRgba('#5d7f8c'), rim: hexToRgba('#2b4650'), core: hexToRgba('#dff1f7') },
  },
};

/* --- jeu de couleurs pour un FOND NOIR (marquage vital) ----------------- */
const DARK = {
  mode: 'dark',
  /* Meme artefact, sur fond noir : l'anneau clair detache l'objet du fond
     sans l'eclaircir lui-meme. */
  phase: hexToRgba('#e8f6ff', 95),
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

  /* Memes souches, en marquage vital sur fond noir : les teintes montent en
     luminosite mais gardent leur identite (voir le bloc clair). */
  souches: {
    lactobacillus: { fill: hexToRgba('#7dff9b'), rim: hexToRgba('#2ea84f'), core: hexToRgba('#d8ffe4') },
    cereus: { fill: hexToRgba('#b98cff'), rim: hexToRgba('#6a3fc0'), core: hexToRgba('#eadcff') },
    aureus: { fill: hexToRgba('#ffc23a'), rim: hexToRgba('#b06b00'), core: hexToRgba('#ffeeb0') },
    cerevisiae: { fill: hexToRgba('#e8dcb0'), rim: hexToRgba('#9a8a55'), core: hexToRgba('#fff8e0') },
  },
  tirs: {
    lactate: { fill: hexToRgba('#c9ff5a'), rim: hexToRgba('#7fbf16'), core: hexToRgba('#f2ffd0') },
    cereulide: { fill: hexToRgba('#cfd4ff'), rim: hexToRgba('#7b7fc0'), core: hexToRgba('#ffffff') },
    alphatoxine: { fill: hexToRgba('#ffb347'), rim: hexToRgba('#b06a00'), core: hexToRgba('#ffe6bf') },
    ethanol: { fill: hexToRgba('#cfe9f5'), rim: hexToRgba('#6f9fb0'), core: hexToRgba('#ffffff') },
  },
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
    /* Acier 316L : froid, mat, et ses rayures plus sombres encore — ce sont
       elles qui servent d'abri au NEP, donc elles doivent se voir. */
    steel: hexToRgba('#7d95a3'), steelDim: hexToRgba('#35505c'),
    flow: hexToRgba('#8fd6ff'),
    /* La couleur dit le produit, donc l'evolution qui sauve. */
    biocide: {
      alcalin: hexToRgba('#8f7dff'),
      acide: hexToRgba('#ffb03d'),
      oxydant: hexToRgba('#6affe0'),
    },
    /* Matrice d'EPS : un gel, pas une membrane. */
    eps: hexToRgba('#4e7a6a'), epsRim: hexToRgba('#8fd6b5'),
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
  levain: {
    name: 'LEVAIN',
    /* Une pate a levain est opaque et pale : on l'observe comme un frottis,
       en fond clair, exactement pour la meme raison que le lait cru. Ca
       separe aussi les deux matrices ouvertes au premier coup d'oeil. */
    ...BRIGHT,
    bg: hexToRgba('#ddd2b6'),
    haze: hexToRgba('#c3b593', 95),        // farine en suspension
    /* Les grains d'amidon SONT le levain : clairs, tres refringents, avec un
       hile marque. Ce sont eux qu'on voit d'abord dans une pate. */
    debris: hexToRgba('#fdf8e8'), debrisRim: hexToRgba('#8a7a55'),
    edge: hexToRgba('#7d6d49'),
    tint: hexToRgba('#cbbf9f', 40),
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

/**
 * Couleurs du corps d'une souche jouable, avec repli sur l'ancien jeu de
 * couleurs du joueur. Le repli n'est pas decoratif : il garde le lobby, le
 * bestiaire et les bancs fonctionnels tant qu'une palette de matrice n'a pas
 * encore sa table `souches`.
 */
export function souchePalette(pal, id) {
  const t = pal.souches && pal.souches[id];
  if (t) return t;
  return { fill: pal.player, rim: pal.playerRim, core: pal.playerCore };
}

/** Couleurs d'une toxine, meme convention de repli sur l'acide. */
export function tirPalette(pal, id) {
  const t = pal.tirs && pal.tirs[id];
  if (t) return t;
  return { fill: pal.acid, rim: pal.acidRim, core: pal.acidCore };
}

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
