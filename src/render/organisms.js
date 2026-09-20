/* ---------------------------------------------------------------------------
   Rendu procedural des morphologies.

   POINT D'INSERTION DES ASSETS : ajouter une entree dans SPRITES pour
   remplacer une forme procedurale par un blit. Tant qu'aucune entree
   n'existe, la forme procedurale sert de repli, donc les assets peuvent
   arriver un par un. Voir docs/05-roadmap-assets.md.
--------------------------------------------------------------------------- */

import { TAU } from '../core/util.js';
import { getSprite, drawSprite } from './sprites.js';

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
  const t = ROLE_TINT[spec.role];
  if (t) return [pal[t[0]], pal[t[1]]];
  return [pal.bact, pal.bactRim];
}

/**
 * Dessine un organisme dans le calque courant de l'ecran.
 * @param {import('../core/pixel.js').Screen} scr
 */
export function drawOrganism(scr, spec, x, y, r, ang, phase, fill, rim) {
  const sprite = getSprite(spec.spriteId || spec.id);
  if (sprite) {
    /* Le sprite est dessine a sa taille native ; c'est l'importateur qui
       garantit qu'elle correspond au rayon de l'espece. */
    drawSprite(scr, sprite, x, y, ang, (fill >>> 24) / 255);
    return;
  }

  switch (spec.kind) {
    case 'diplo': {
      /* Deux cocci accoles : la division n'a pas fini de separer. */
      const d = r * 0.62;
      scr.disc(x - Math.cos(ang) * d, y - Math.sin(ang) * d, r * 0.78, fill, rim);
      scr.disc(x + Math.cos(ang) * d, y + Math.sin(ang) * d, r * 0.78, fill, rim);
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
        scr.disc(px, py, r * 0.55, fill, rim);
      }
      break;
    }
    case 'cluster': {
      /* Grappe de raisin : division dans plusieurs plans. */
      const n = spec.segments || 7;
      scr.disc(x, y, r * 0.5, fill, rim);
      for (let i = 0; i < n; i++) {
        const a = ang + (i / n) * TAU + Math.sin(phase * 0.5 + i) * 0.08;
        const d = r * (0.55 + 0.22 * ((i * 7) % 3));
        scr.disc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.42, fill, rim);
      }
      break;
    }
    case 'rod':
      scr.cap(x, y, r * 2.4, r * 1.25, ang, fill, rim);
      break;
    case 'rodlong':
      scr.cap(x, y, r * 3.4, r * 1.1, ang, fill, rim);
      break;
    case 'bud': {
      /* Levure : cellule mere plus un bourgeon lateral. */
      scr.ell(x, y, r, r * 0.82, ang, fill, rim);
      const ba = ang + 2.2;
      scr.disc(x + Math.cos(ba) * r * 0.95, y + Math.sin(ba) * r * 0.95, r * 0.42, fill, rim);
      break;
    }
    case 'spore':
      /* Refringente : coeur clair, paroi epaisse. */
      scr.ell(x, y, r * 1.15, r * 0.8, ang, rim, rim);
      scr.ell(x, y, r * 0.7, r * 0.44, ang, fill, 0);
      break;
    case 'arthro': {
      /* Arthrospores en chainettes qui se fragmentent. */
      for (let i = 0; i < 4; i++) {
        const a = ang + i * 1.57;
        for (let j = 1; j <= 2; j++) {
          scr.cap(x + Math.cos(a) * r * j * 0.75, y + Math.sin(a) * r * j * 0.75,
            r * 0.8, r * 0.5, a, fill, rim);
        }
      }
      scr.disc(x, y, r * 0.5, fill, rim);
      break;
    }
    case 'hypha': {
      const n = 5;
      for (let i = 0; i < n; i++) {
        const a = ang + (i / n) * TAU;
        const wob = Math.sin(phase + i) * 0.25;
        scr.seg(x, y, x + Math.cos(a + wob) * r * 1.8, y + Math.sin(a + wob) * r * 1.8,
          r * 0.34, fill, rim);
      }
      break;
    }
    case 'phage': {
      /* Tete icosaedrique + queue courte + fibres caudales. */
      const hx = x - Math.cos(ang) * r * 0.4, hy = y - Math.sin(ang) * r * 0.4;
      scr.disc(hx, hy, r * 0.72, fill, rim);
      const tx = x + Math.cos(ang) * r * 0.9, ty = y + Math.sin(ang) * r * 0.9;
      scr.seg(hx, hy, tx, ty, r * 0.30, rim, 0);
      for (const s of [-1, 1]) {
        scr.seg(tx, ty, tx + Math.cos(ang + s * 0.9) * r * 0.7,
          ty + Math.sin(ang + s * 0.9) * r * 0.7, r * 0.2, rim, 0);
      }
      break;
    }
    case 'amoeba': {
      /* Contour deformable : pseudopodes qui changent lentement. */
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU;
        const d = r * (0.55 + 0.35 * Math.sin(phase * 0.8 + i * 1.9));
        scr.disc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.5, fill, rim);
      }
      scr.disc(x, y, r * 0.6, fill, 0);
      break;
    }
    case 'globule':
      /* En fond noir, une sphere refringente se lit comme un ANNEAU brillant
         a centre sombre, pas comme une boule pleine. C'est ce qui la
         distingue au premier coup d'oeil d'un organisme. */
      scr.ring(x, y, r * 0.85, 1.3, rim);
      scr.disc(x, y, r * 0.5, fill, 0);
      break;
    default:
      scr.disc(x, y, r, fill, rim);
  }
}

/** Le joueur : coque lactique avec un noyau clair et ses flagelles. */
export function drawPlayer(scr, x, y, r, ang, phase, pal, flagellation = null) {
  const f = flagellation || { count: 0, mode: 'bundle' };
  const n = Math.min(f.count, 10);
  for (let i = 0; i < n; i++) {
    let a;
    if (f.mode === 'peritriche') {
      /* Repartis sur toute la surface : c'est ce que veut dire peritriche. */
      a = (i / n) * TAU + phase * 0.3;
    } else if (f.mode === 'polaire') {
      /* Touffe serree a un seul pole : lophotriche. */
      a = ang + Math.PI + (i - (n - 1) / 2) * 0.16;
    } else {
      a = ang + Math.PI + (i - (n - 1) / 2) * 0.42;
    }
    const wav = Math.sin(phase * 9 + i * 1.3) * (f.mode === 'polaire' ? 0.22 : 0.5);
    const len = f.mode === 'polaire' ? r * 2.9 : r * 2.3;
    scr.seg(x, y, x + Math.cos(a + wav) * len, y + Math.sin(a + wav) * len,
      1.1, pal.playerRim, 0);
  }
  const d = r * 0.5;
  /* Pas de halo de detourage.
     Il avait ete ajoute pour que le joueur ne se perde pas dans la foule,
     mais la CAMERA EST VERROUILLEE SUR LUI : il occupe toujours le centre
     exact du champ, on ne peut donc pas le perdre. Le halo ne resolvait
     aucun probleme reel et posait un disque etranger sur le milieu. */

  /* Eclairage FIXE en haut a gauche, independant de l'orientation : la
     lumiere ne tourne pas avec la cellule. A sept pixels de large, un liseré
     tout autour se lit comme une tache sombre ; un croissant d'ombre d'un
     seul cote se lit comme une sphere. C'est la recette classique du pixel
     art de petite taille, et c'est ce qui donne du volume au joueur qu'on
     regarde en permanence. */
  const LX = -0.7, LY = -0.7;
  const lobe = (cx, cy, rad) => {
    /* 1. la paroi : disque plein dans la couleur du liseré */
    scr.disc(cx, cy, rad, pal.playerRim, 0);
    /* 2. le cytoplasme, DECALE vers la lumiere et nettement plus petit :
          ce qui depasse du cote oppose est le croissant d'ombre. Avec un
          decalage trop faible ou un disque trop gros, le croissant
          disparait et les deux lobes fusionnent en une masse. */
    scr.disc(cx + LX * rad * 0.24, cy + LY * rad * 0.24, rad * 0.70, pal.player, 0);
    /* 3. le reflet speculaire : un pixel ou deux, mais c'est lui qui vend
          la sphere. Chaque lobe a le sien, du meme cote. */
    scr.disc(cx + LX * rad * 0.42, cy + LY * rad * 0.42, Math.max(0.5, rad * 0.24),
      pal.playerCore, 0);
  };

  /* Les deux lobes sont dessines l'un apres l'autre : la paroi du second
     trace naturellement le septum entre les deux cellules accolees. */
  const ax = Math.cos(ang) * d, ay = Math.sin(ang) * d;
  lobe(x - ax, y - ay, r * 0.8);
  lobe(x + ax, y + ay, r * 0.8);
}
