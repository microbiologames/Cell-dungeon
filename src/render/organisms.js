/* ---------------------------------------------------------------------------
   Rendu procedural des morphologies.

   POINT D'INSERTION DES ASSETS : ajouter une entree dans SPRITES pour
   remplacer une forme procedurale par un blit. Tant qu'aucune entree
   n'existe, la forme procedurale sert de repli, donc les assets peuvent
   arriver un par un. Voir docs/05-roadmap-assets.md.
--------------------------------------------------------------------------- */

import { TAU, clamp, hash2 } from '../core/util.js';
import { drawFlagella, driveOf } from './flagella.js';
import { getSprite, drawSprite } from './sprites.js';
import { fade32, mix32 } from '../core/pixel.js';

/* Les sprites disponibles sont servis par le registre ; tant qu'une espece
   n'en a pas, sa forme procedurale fait foi. Un asset peut donc arriver seul,
   sans rien casser. */
export { SPRITE_REGISTRY } from './sprites.js';

/**
 * Couleurs d'un organisme.
 *
 * REGLE DE LISIBILITE : la FORME porte l'espece, la COULEUR porte la menace.
 * La morphologie est deja le vrai marqueur microbiologique (un bacille n'est
 * pas un coque), donc on peut liberer la teinte pour dire au joueur ce qui va
 * lui arriver. Sans cette regle, trois especes Gram + differentes sortaient
 * du meme vert et le champ devenait illisible en pleine vague.
 */
const ROLE_TINT = {
  chaff: ['bact', 'bactRim'],
  runner: ['fast', 'fastRim'],
  tank: ['hypha', 'hyphaRim'],
  ranged: ['phage', 'phageRim'],
  splitter: ['yeast', 'yeastRim'],
  denier: ['rod', 'rodRim'],
  predator: ['amoeba', 'amoebaRim'],
  neutral: ['neutral', 'neutralRim'],
};

export function colorOf(spec, pal) {
  if (spec.boss) return [pal.boss, pal.bossRim];
  /* Deux exceptions, parce que ce sont des cibles particulieres :
     la spore doit sauter aux yeux, le decor doit s'effacer. */
  if (spec.kind === 'spore') return [pal.spore, pal.sporeRim];
  if (spec.kind === 'globule') return [pal.debris, pal.debrisRim];
  /* Une plaque de biofilm n'est pas un organisme : c'est de la matrice. Elle
     porte donc la couleur du gel, pas celle d'un role. */
  if (spec.kind === 'plaque') return [pal.eps || pal.gel, pal.epsRim || pal.hypha];
  const t = ROLE_TINT[spec.role];
  if (t) return [pal[t[0]], pal[t[1]]];
  return [pal.bact, pal.bactRim];
}

/* ---------------------------------------------------------------------- */
/*                           RELIEF ET GRANULARITE                          */
/* ---------------------------------------------------------------------- */

/* Lumiere FIXE en haut a gauche, en repere ECRAN. Elle ne tourne jamais avec
   la cellule : une source qui suit l'objet ne se lit pas comme une source.
   C'est la meme convention que pour le joueur, et c'est ce qui donne au
   champ entier l'air d'etre eclaire par la meme lampe. */
const LX = -0.68, LY = -0.72;

/** Eclaircit une couleur vers le blanc : le cytoplasme d'un corps eclaire. */
function clair(c, k) { return mix32(c, 0xffffffff, k); }

/**
 * Un corps rond avec du volume.
 *
 * Trois couches, dans cet ordre : la paroi pleine, le cytoplasme decale vers
 * la lumiere (ce qui depasse du cote oppose EST le croissant d'ombre), et le
 * reflet speculaire. A moins de six pixels, c'est la seule recette qui rende
 * une sphere plutot qu'une pastille.
 */
function boule(scr, x, y, r, fill, rim, eclat = 0.4) {
  if (r < 0.75) { scr.plot(x, y, fill); return; }
  scr.disc(x, y, r, rim, 0);
  scr.disc(x + LX * r * 0.24, y + LY * r * 0.24, r * 0.80, fill, 0);
  if (r >= 1.6 && eclat > 0) {
    scr.disc(x + LX * r * 0.46, y + LY * r * 0.46, Math.max(0.5, r * 0.26),
      fade32(clair(fill, 0.55), eclat), 0);
  }
}

/**
 * Direction d'ombrage d'un CORPS ALLONGE.
 *
 * Un cylindre eclaire ne s'ombre pas en diagonale : il s'ombre le long de sa
 * GENERATRICE BASSE, donc perpendiculairement a son axe. Decaler le
 * cytoplasme dans la direction brute de la lumiere mettait le croissant sur
 * un BOUT du bacille des qu'il s'orientait vers la lampe — un bacille avec
 * une extremite sombre ne ressemble a rien.
 *
 * On projette donc la lumiere sur la perpendiculaire a l'axe, et on garde un
 * cinquieme de composante axiale pour que les poles ne soient pas plats.
 */
function ombreAxiale(ang) {
  const px = -Math.sin(ang), py = Math.cos(ang);
  const d = LX * px + LY * py;
  return { x: px * d * 0.82 + LX * 0.2, y: py * d * 0.82 + LY * 0.2 };
}

/** Un bacille avec du volume : meme recette, sur une capsule. */
function barre(scr, x, y, len, w, ang, fill, rim, eclat = 0.4) {
  const r = w / 2;
  const o = ombreAxiale(ang);
  scr.cap(x, y, len, w, ang, rim, 0);
  scr.cap(x + o.x * r * 0.34, y + o.y * r * 0.34, len - r * 0.7, w * 0.76, ang, fill, 0);
  if (r >= 1.3 && eclat > 0) {
    const cx = x + Math.cos(ang) * len * 0.18, cy = y + Math.sin(ang) * len * 0.18;
    scr.disc(cx + o.x * r * 0.56, cy + o.y * r * 0.56, Math.max(0.5, r * 0.30),
      fade32(clair(fill, 0.55), eclat), 0);
  }
}

/**
 * Granulations cytoplasmiques.
 *
 * Ce ne sont pas des taches decoratives : les inclusions de polyphosphate,
 * de PHB et de lipides sont reellement ce qui rend un cytoplasme bacterien
 * grumeleux en microscopie. Elles sont posees dans le REPERE DE LA CELLULE,
 * donc elles tournent avec elle et ne scintillent pas.
 */
function granules(scr, x, y, hw, hh, ang, n, col, graine = 0) {
  /* CLAIRES, pas sombres : les inclusions de polyphosphate et de lipides
     sont REFRINGENTES, elles renvoient la lumiere. Une granule sombre se lit
     comme un trou, une granule claire comme un grain. */
  const ca = Math.cos(ang), sa = Math.sin(ang);
  for (let i = 0; i < n; i++) {
    const u = (hash2(i + graine, 3) * 2 - 1) * hw * 0.55;
    const v = (hash2(i + graine, 11) * 2 - 1) * hh * 0.45;
    scr.plot(x + u * ca - v * sa, y + u * sa + v * ca, col);
  }
}

/* ---------------------------------------------------------------------- */
/*                              MORPHOLOGIES                                */
/* ---------------------------------------------------------------------- */

/**
 * Silhouette d'une espece, dessinee a plat.
 *
 * `g` gonfle chaque primitive d'autant de pixels : c'est ce qui permet de
 * redessiner exactement la meme forme, un pixel plus large, pour le halo de
 * contraste de phase. Gonfler le RAYON aurait ecarte les elements d'une
 * chainette ou d'une grappe ; gonfler chaque primitive garde la composition.
 */
function silhouette(scr, spec, x, y, r, ang, phase, fill, rim, g) {
  const relief = g === 0;                 // pas de volume sur le halo
  const eclat = relief ? 0.42 : 0;
  const G = (v) => v + g;

  switch (spec.kind) {
    case 'diplo': {
      /* Deux cocci accoles : la division n'a pas fini de separer. Les deux
         lobes dessines l'un apres l'autre tracent le septum tout seuls. */
      const d = r * 0.62;
      const rr = G(r * 0.78);
      if (relief) {
        boule(scr, x - Math.cos(ang) * d, y - Math.sin(ang) * d, rr, fill, rim, eclat);
        boule(scr, x + Math.cos(ang) * d, y + Math.sin(ang) * d, rr, fill, rim, eclat);
      } else {
        scr.disc(x - Math.cos(ang) * d, y - Math.sin(ang) * d, rr, fill, 0);
        scr.disc(x + Math.cos(ang) * d, y + Math.sin(ang) * d, rr, fill, 0);
      }
      break;
    }
    case 'chain': {
      const n = spec.segments || 4;
      const step = r * 1.15;
      for (let i = 0; i < n; i++) {
        const t = i - (n - 1) / 2;
        /* La chainette ondule doucement : elle n'est pas rigide. */
        const bend = Math.sin(phase * 1.6 + i * 0.7) * r * 0.22;
        const px = x + Math.cos(ang) * t * step - Math.sin(ang) * bend;
        const py = y + Math.sin(ang) * t * step + Math.cos(ang) * bend;
        if (relief) boule(scr, px, py, G(r * 0.55), fill, rim, i === 0 ? eclat : eclat * 0.5);
        else scr.disc(px, py, G(r * 0.55), fill, 0);
      }
      break;
    }
    case 'cluster': {
      /* Grappe de raisin : division dans plusieurs plans. */
      const n = spec.segments || 7;
      if (relief) boule(scr, x, y, G(r * 0.5), fill, rim, 0);
      else scr.disc(x, y, G(r * 0.5), fill, 0);
      for (let i = 0; i < n; i++) {
        const a = ang + (i / n) * TAU + Math.sin(phase * 0.5 + i) * 0.08;
        const d = r * (0.55 + 0.22 * ((i * 7) % 3));
        const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
        if (relief) boule(scr, px, py, G(r * 0.42), fill, rim, eclat * 0.8);
        else scr.disc(px, py, G(r * 0.42), fill, 0);
      }
      break;
    }
    case 'rod': {
      /* Le rapport longueur/largeur est une donnee de l'espece : un coliforme
         trapu et une cellule en swarming allongee ne se confondent plus. */
      const el = spec.elance || 1;
      const len = G(r * 2.4 * el * 2) - g;
      if (relief) {
        barre(scr, x, y, r * 2.4 * el + g, r * 1.25 + g * 2, ang, fill, rim, eclat);
        if (r >= 2.4) granules(scr, x, y, r * el, r * 0.4, ang, 2,
          fade32(clair(fill, 0.5), 0.75), spec.id.length);
      } else scr.cap(x, y, r * 2.4 * el + g * 2, r * 1.25 + g * 2, ang, fill, 0);
      break;
    }
    case 'rodlong': {
      const len = r * 3.4, w = r * 1.1;
      /* SPORULATION : l'endospore est refringente, donc CLAIRE, et chez
         Bacillus cereus elle est centrale a subterminale et ne deforme pas
         le sporange. On la voit par transparence dans la cellule mere —
         c'est exactement ce qu'on observe au microscope, et c'est LE signe
         qui doit se lire : un bacille sporule annonce la vague de spores. */
      const sporule = spec.ability === 'sporulation' && r >= 2.4;
      if (relief) barre(scr, x, y, len + g, w + g * 2, ang, fill, rim, sporule ? 0 : eclat);
      else scr.cap(x, y, len + g * 2, w + g * 2, ang, fill, 0);
      if (relief && sporule) {
        const d = len * 0.19;
        const sx = x + Math.cos(ang) * d, sy = y + Math.sin(ang) * d;
        /* Assez grande pour se lire : mesuree a w x 0,44, elle sortait
           comme une moucheture parmi d'autres. */
        scr.ell(sx, sy, w * 0.86, w * 0.60, ang, fade32(rim, 0.9), 0);
        scr.ell(sx, sy, w * 0.62, w * 0.40, ang, 0xfff4f8e8, 0);
      }
      break;
    }
    case 'bud': {
      /* Levure : cellule mere plus un bourgeon lateral. */
      if (relief) {
        scr.ell(x, y, G(r), G(r * 0.82), ang, rim, 0);
        scr.ell(x + LX * r * 0.22, y + LY * r * 0.22, r * 0.78, r * 0.62, ang, fill, 0);
        scr.disc(x + LX * r * 0.46, y + LY * r * 0.46, Math.max(0.6, r * 0.20),
          fade32(clair(fill, 0.55), eclat), 0);
        /* Vacuole : une levure n'est pas pleine. */
        scr.disc(x - LX * r * 0.28, y - LY * r * 0.28, r * 0.28, fade32(rim, 0.55), 0);
      } else scr.ell(x, y, G(r), G(r * 0.82), ang, fill, 0);
      const ba = ang + 2.2;
      const bx = x + Math.cos(ba) * r * 0.95, by = y + Math.sin(ba) * r * 0.95;
      if (relief) boule(scr, bx, by, G(r * 0.42), fill, rim, eclat);
      else scr.disc(bx, by, G(r * 0.42), fill, 0);
      break;
    }
    case 'spore':
      /* Refringente : paroi tres epaisse, coeur clair. C'est ce qui la rend
         reconnaissable au premier coup d'oeil, et c'est physique. */
      scr.ell(x, y, G(r * 1.15), G(r * 0.8), ang, rim, 0);
      if (relief) {
        scr.ell(x, y, r * 0.72, r * 0.46, ang, fill, 0);
        scr.disc(x + LX * r * 0.34, y + LY * r * 0.24, Math.max(0.5, r * 0.20),
          0xffffffff, 0);
      }
      break;
    case 'arthro': {
      /* Arthrospores en chainettes qui se fragmentent. */
      for (let i = 0; i < 4; i++) {
        const a = ang + i * 1.57;
        for (let j = 1; j <= 2; j++) {
          const px = x + Math.cos(a) * r * j * 0.75, py = y + Math.sin(a) * r * j * 0.75;
          if (relief) barre(scr, px, py, r * 0.8, r * 0.5, a, fill, rim, j === 1 ? eclat : 0);
          else scr.cap(px, py, r * 0.8 + g * 2, r * 0.5 + g * 2, a, fill, 0);
        }
      }
      if (relief) boule(scr, x, y, G(r * 0.5), fill, rim, eclat);
      else scr.disc(x, y, G(r * 0.5), fill, 0);
      break;
    }
    case 'phage': {
      /* Tete icosaedrique + queue contractile + fibres caudales. */
      const hx = x - Math.cos(ang) * r * 0.4, hy = y - Math.sin(ang) * r * 0.4;
      if (relief) boule(scr, hx, hy, G(r * 0.72), fill, rim, eclat);
      else scr.disc(hx, hy, G(r * 0.72), fill, 0);
      const tx = x + Math.cos(ang) * r * 0.9, ty = y + Math.sin(ang) * r * 0.9;
      scr.seg(hx, hy, tx, ty, G(r * 0.30) * 2, rim, 0);
      for (const sgn of [-1, 1]) {
        scr.seg(tx, ty, tx + Math.cos(ang + sgn * 0.9) * r * 0.7,
          ty + Math.sin(ang + sgn * 0.9) * r * 0.7, G(r * 0.2) * 2, rim, 0);
      }
      break;
    }
    case 'leuco': {
      /* CELLULE SOMATIQUE. Ce sont majoritairement des POLYNUCLEAIRES : un
         cytoplasme rond et un noyau POLYLOBE, deux a cinq lobes relies par
         de fins ponts de chromatine. C'est le marqueur de l'espece et il est
         visible a la taille ou on la dessine (18 px). Elle n'a donc plus a
         emprunter la silhouette de l'amibe. */
      const lobes = 4;
      if (relief) {
        scr.disc(x, y, G(r), rim, 0);
        scr.disc(x + LX * r * 0.18, y + LY * r * 0.18, r * 0.88, fill, 0);
        for (let i = 0; i < lobes; i++) {
          const a = ang + (i / lobes) * TAU + Math.sin(phase * 0.5 + i) * 0.12;
          const d = r * 0.40;
          scr.disc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.30, rim, 0);
        }
        scr.disc(x, y, r * 0.18, rim, 0);
        scr.disc(x + LX * r * 0.52, y + LY * r * 0.52, Math.max(0.6, r * 0.18),
          fade32(0xffffffff, 0.5), 0);
      } else scr.disc(x, y, G(r), fill, 0);
      break;
    }
    case 'acanthe': {
      /* ACANTHAMOEBA. Son marqueur est dans son nom : les ACANTHOPODES,
         des pseudopodes fins et EPINEUX, pas les gros lobes d'une amibe
         quelconque. Corps compact, couronne d'epines qui se deplacent
         lentement. */
      const n = 9;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + ang * 0.2;
        const d = r * (0.95 + 0.45 * Math.sin(phase * 0.7 + i * 2.1));
        scr.seg(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5,
          x + Math.cos(a) * d, y + Math.sin(a) * d,
          Math.max(1, r * 0.17) + g, rim, 0);
      }
      if (relief) {
        scr.disc(x, y, G(r * 0.72), rim, 0);
        scr.disc(x + LX * r * 0.16, y + LY * r * 0.16, r * 0.60, fill, 0);
        /* Noyau a nucleole central, tres visible chez Acanthamoeba. */
        scr.disc(x - LX * r * 0.20, y - LY * r * 0.20, r * 0.24, fade32(rim, 0.8), 0);
        scr.disc(x - LX * r * 0.20, y - LY * r * 0.20, r * 0.10, clair(fill, 0.6), 0);
        granules(scr, x, y, r * 0.5, r * 0.5, ang, 3, fade32(clair(fill, 0.5), 0.7), 7);
      } else scr.disc(x, y, G(r * 0.72), fill, 0);
      break;
    }
    case 'mucoide': {
      /* Souche MUCOIDE : le bacille est noye dans une couche d'alginate.
         C'est le phenotype qu'on voit en boite — la colonie file. La gangue
         est translucide : elle ne cache pas la cellule, elle l'enrobe. */
      const gl = r * 1.75, gw = r * 1.5;
      scr.ell(x, y, gl + g, gw + g, ang, fade32(fill, 0.22), 0);
      scr.ell(x, y, gl * 0.82 + g, gw * 0.8 + g, ang, fade32(fill, 0.16), 0);
      if (relief) {
        barre(scr, x, y, r * 2.5, r * 1.05, ang, fill, rim, eclat);
        granules(scr, x, y, r * 0.9, r * 0.4, ang, 3, fade32(clair(fill, 0.5), 0.75), 5);
      } else scr.cap(x, y, r * 2.5 + g * 2, r * 1.05 + g * 2, ang, fill, 0);
      break;
    }
    case 'rosette': {
      /* METHYLOBACTERIUM. Elle forme reellement des ROSETTES : des bacilles
         accoles par un pole, en etoile. Une faune neutre qui ne ressemble a
         aucun mob, et c'est vrai. */
      const n = spec.segments || 4;
      for (let i = 0; i < n; i++) {
        const a = ang + (i / n) * TAU + Math.sin(phase * 0.4 + i) * 0.1;
        const cx = x + Math.cos(a) * r * 0.62, cy = y + Math.sin(a) * r * 0.62;
        if (relief) barre(scr, cx, cy, r * 1.25, r * 0.5, a, fill, rim, i === 0 ? eclat : 0);
        else scr.cap(cx, cy, r * 1.25 + g * 2, r * 0.5 + g * 2, a, fill, 0);
      }
      break;
    }
    case 'plaque': {
      /* Masse d'EPS accrochee a la paroi : ni disque ni cercle. Grumeleuse,
         figee par l'angle de l'entite, parcourue de canaux d'eau. */
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU + ang;
        const d = r * (0.28 + 0.46 * ((i * 5 + 3) % 7) / 7);
        const rr = r * (0.36 + 0.26 * ((i * 3 + 1) % 5) / 5)
          * (1 + 0.06 * Math.sin(phase * 0.7 + i));
        scr.disc(x + Math.cos(a) * d, y + Math.sin(a) * d, rr + g, fill, 0);
      }
      if (!relief) break;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + ang * 0.5 + 0.6;
        const d = r * (0.2 + 0.3 * ((i * 2 + 1) % 3) / 3);
        scr.disc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.13, rim, 0);
      }
      break;
    }
    case 'globule':
      /* Sphere refringente : un ANNEAU brillant a centre sombre, pas une
         boule pleine. C'est ainsi qu'on la voit vraiment, et c'est ce qui la
         distingue au premier coup d'oeil d'un organisme. */
      scr.ring(x, y, r * 0.85 + g, 1.3, rim);
      if (relief) scr.disc(x, y, r * 0.5, fill, 0);
      break;
    default:
      if (relief) boule(scr, x, y, G(r), fill, rim, eclat);
      else scr.disc(x, y, G(r), fill, 0);
  }
}

/**
 * Dessine un organisme dans le calque courant de l'ecran.
 *
 * Trois passes : le halo de contraste de phase, la silhouette avec son
 * volume, puis la flagellation. Les flagelles viennent EN DERNIER parce
 * qu'ils sortent de la cellule et doivent se voir par-dessus le halo.
 *
 * @param {object} [opts] {pal, drive} — la palette donne le halo de phase,
 *   `drive` l'effort de nage (battement des flagelles).
 */
export function drawOrganism(scr, spec, x, y, r, ang, phase, fill, rim, opts = null) {
  const o = opts || {};
  const pal = o.pal;
  const sprite = getSprite(spec.spriteId || spec.id);

  /* Halo de contraste de phase : un artefact REEL de la technique. Le bord
     d'un objet dephase plus fort que son centre, et l'anneau de diffraction
     ressort en clair autour de lui. Deux passes de largeurs differentes :
     une seule donnait un trait gris uniforme, pas un halo. */
  if (pal && pal.phase && r >= 1.2) {
    /* L'epaisseur du halo suit la TAILLE de l'objet. Une valeur fixe donnait
       au joueur de sept pixels une aureole plus large que lui, et au boss de
       trente-deux un trait de cheveu. */
    const g = clamp(0.55 + r * 0.11, 0.7, 2.2);
    if (sprite) {
      scr.ring(x, y, r + g, g * 1.4, fade32(pal.phase, 0.6));
    } else {
      silhouette(scr, spec, x, y, r, ang, phase, fade32(pal.phase, 0.5), 0, g);
      silhouette(scr, spec, x, y, r, ang, phase, pal.phase, 0, g * 0.45);
    }
  }

  if (sprite) {
    /* Le sprite est dessine a sa taille native ; c'est l'importateur qui
       garantit qu'elle correspond au rayon de l'espece. */
    drawSprite(scr, sprite, x, y, ang, (fill >>> 24) / 255);
  } else {
    silhouette(scr, spec, x, y, r, ang, phase, fill, rim, 0);
  }

  /* Flagellation. C'est un marqueur taxonomique reel : on ne la donne qu'aux
     especes chez qui elle est documentee (voir `flagella` dans le
     bestiaire), et jamais aux autres. Un Lactococcus n'a pas de flagelle. */
  const fl = spec.flagella;
  if (fl && r >= 1.6) {
    const hw = r * (spec.kind === 'rodlong' ? 1.7 : 1.2 * (spec.elance || 1));
    drawFlagella(scr, {
      x, y, ang, hw, hh: r * 0.62,
      count: fl.count, mode: fl.mode, phase,
      drive: o.drive ?? 0.55,
      splay: 1 - (o.drive ?? 0.55),
      sillage: o.sillage, trouble: o.trouble,
      len: hw * (fl.mode === 'polaire' ? 3.6 : 3.0),
      /* Discrets : a quarante mobs dans le champ, des flagelles trop
         contrastes font une toile d'araignee et on ne voit plus les corps. */
      col: fade32(rim, 0.42), width: 1,
    });
  }
}

/* ---------------------------------------------------------------------- */
/*                                LE JOUEUR                                 */
/* ---------------------------------------------------------------------- */

/**
 * Le joueur : un LACTOBACILLE.
 *
 * Le diplocoque de depart etait une impasse de lisibilite : deux disques
 * plats de sept pixels n'ont ni avant ni arriere, donc aucune des animations
 * qui rendent un personnage vivant n'avait de prise. Un lactobacille a un
 * axe, et c'est tout ce qu'il fallait.
 *
 * Ce n'est pas un compromis : un Lactobacillus fait reellement 2 a 8 um de
 * long pour 0,5 a 1 um de large, la ou un Lactococcus fait 0,5 a 1,5 um. Le
 * personnage grandit donc DANS le vrai, pas contre lui.
 *
 * Le corps est une COLONNE VERTEBRALE echantillonnee, pas une capsule rigide.
 * Deux deformations s'y ajoutent, toutes deux en repere cellule :
 *
 *   dandinement  une onde laterale qui court de la tete a la queue, dont
 *                l'amplitude suit l'effort de nage. C'est ce qui fait qu'une
 *                cellule a l'arret n'a pas l'air d'un objet pose.
 *   courbure     un arc parabolique, pilote par la VITESSE de la mise au
 *                point. Monter ou descendre dans l'epaisseur de la
 *                preparation se lit comme un corps qui se cambre — c'est la
 *                seule facon de rendre l'axe Z en deux dimensions.
 *
 * @param {object} [opts] {drive, bend, lean, sillage, trouble} — effort de
 *   nage, cambrure de profondeur, inclinaison de virage, memoire de cap et
 *   desordre du faisceau.
 */
export function drawPlayer(scr, x, y, r, ang, phase, pal, flagellation = null, opts = null) {
  const f = flagellation || { count: 0, mode: 'bundle' };
  const o = opts || {};
  const drive = clamp(o.drive ?? 0, 0, 1);
  const bend = clamp(o.bend ?? 0, -1, 1);
  const lean = clamp(o.lean ?? 0, -1, 1);

  /* Proportions d'un lactobacille : long, mince, bouts arrondis. Un
     Lactobacillus fait trois a huit fois plus long que large ; en deca de
     deux fois, on retombe sur un gros coque. */
  const hw = r * 1.90;          // demi-longueur
  const hh = r * 0.66;          // demi-largeur
  const ca = Math.cos(ang), sa = Math.sin(ang);

  /* Les flagelles d'abord : ils passent DERRIERE le corps. Une bacterie
     lactique n'est pas mobile, mais celle-ci vole des genes a tout le monde,
     flagelline comprise — c'est le sujet du jeu. */
  drawFlagella(scr, {
    x, y, ang, hw, hh,
    count: f.count, mode: f.mode, phase, drive,
    /* Le faisceau s'ouvre quand on ne pousse pas : c'est la culbute. */
    splay: 1 - drive,
    sillage: o.sillage, trouble: o.trouble,
    /* Un flagelle fait plusieurs fois la longueur de la cellule : le
       raccourcir pour "faire propre" lui enlevait justement l'allure de
       flagelle. */
    len: hw * (f.mode === 'polaire' ? 3.8 : 3.2),
    col: fade32(pal.playerRim, 0.62), width: 1,
  });

  /* --- la colonne vertebrale ------------------------------------------ */
  const N = 9;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const u = (i / N) * 2 - 1;                 // -1 queue, +1 tete
    /* Onde qui court vers la queue. Un lactobacille ne nage pas en ligne
       droite comme une fleche : il se dandine. */
    const dandine = Math.sin(phase * (7 + 9 * drive) - u * 1.4) * hh * 0.5 * drive;
    /* Cambrure de PROFONDEUR : un arc, maximal au milieu, nul aux poles.
       C'est le changement de plan focal qui la pilote. */
    const cambre = bend * hh * 0.95 * (1 - u * u);
    /* Inclinaison de VIRAGE : la queue chasse vers l'exterieur du tournant.
       Ponderee vers l'arriere, pas symetrique — c'est la queue qui balaie,
       la tete mene. C'est ce qui fait lire un virage comme un virage. */
    const chasse = -lean * hh * 1.45 * Math.pow((1 - u) / 2, 1.5);
    const lat = dandine + cambre + chasse;
    /* Profil de largeur : plat au centre, arrondi aux deux bouts. */
    const c = 1 - hh / hw;
    const t = clamp((Math.abs(u) - c) / Math.max(1e-3, 1 - c), 0, 1);
    const rad = hh * Math.sqrt(Math.max(0, 1 - t * t));
    pts.push({
      sx: x + (u * hw) * ca - lat * sa,
      sy: y + (u * hw) * sa + lat * ca,
      rad,
    });
  }

  /* --- halo de contraste de phase -------------------------------------- */
  if (pal.phase) {
    for (const q of pts) if (q.rad > 0.2) scr.disc(q.sx, q.sy, q.rad + 0.85, pal.phase, 0);
  }

  /* --- eclairage ------------------------------------------------------- */
  /* Lumiere FIXE en haut a gauche, en repere ECRAN : elle ne tourne pas avec
     la cellule. L'ombre suit la generatrice basse du cylindre, donc la
     PERPENDICULAIRE a l'axe du corps et non la diagonale brute : sinon, des
     que le bacille pointe vers la lampe, le croissant se retrouve sur un de
     ses BOUTS, ce qui ne ressemble a rien. */
  const o2 = ombreAxiale(ang);
  for (const q of pts) {
    if (q.rad < 0.2) continue;
    scr.disc(q.sx, q.sy, q.rad, pal.playerRim, 0);
  }
  for (const q of pts) {
    if (q.rad < 0.5) continue;
    scr.disc(q.sx + o2.x * q.rad * 0.32, q.sy + o2.y * q.rad * 0.32, q.rad * 0.78, pal.player, 0);
  }

  /* Granulations cytoplasmiques : deux inclusions figees dans le repere de
     la cellule, donc solidaires du corps. Elles cassent l'aplat, et les
     lactobacilles en ont reellement (polyphosphates, lipides). */
  for (const gu of [-0.42, 0.34]) {
    const i = Math.round(((gu + 1) / 2) * N);
    const q = pts[clamp(i, 0, N)];
    if (q.rad < 0.9) continue;
    scr.disc(q.sx, q.sy, Math.max(0.6, q.rad * 0.30),
      fade32(clair(pal.player, 0.45), 0.8), 0);
  }

  /* Reflet speculaire : deux pixels vers la tete, du cote de la lumiere.
     C'est lui qui vend le volume. */
  const tete = pts[N - 1];
  scr.disc(tete.sx + o2.x * tete.rad * 0.56, tete.sy + o2.y * tete.rad * 0.56,
    Math.max(0.5, tete.rad * 0.30), pal.playerCore, 0);
}
