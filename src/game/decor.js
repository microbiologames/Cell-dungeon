/* ---------------------------------------------------------------------------
   Decor de matrice : genere par hachage de coordonnees (densite illimitee,
   memoire nulle), anime sans etat, et PHYSIQUE.

   Un decor inerte ne sert a rien. Dans le lait cru, deux elements dominent
   le champ et ne se comportent pas pareil :

     globule gras  - la bacterie s'y ADSORBE. C'est documente : les bacteries
                     s'associent a la phase grasse du lait, retenues par la
                     membrane du globule (MFGM). On colle, on ralentit, on se
                     detache. Il absorbe aussi les gouttes d'acide, qui sont
                     hydrosolubles et ne penetrent pas une phase lipidique :
                     un globule est donc un ABRI.
     bulle d'air   - incompressible a cette echelle : on REBONDIT dessus.
                     Le lait est aere pendant le pompage, il y en a partout.

   Les deux interactions sont volontairement opposees, pour que le champ se
   lise : ce qui est dore colle, ce qui est clair repousse.
--------------------------------------------------------------------------- */

import { hash2, TAU, clamp } from '../core/util.js';

export const DECOR_CELL = 64;

/** Derive lente de l'ensemble du champ : une preparation n'est jamais figee. */
export function convection(time) {
  return {
    x: Math.sin(time * 0.061) * 21 + Math.sin(time * 0.017) * 13,
    y: Math.cos(time * 0.048) * 18 + Math.sin(time * 0.023) * 11,
  };
}

/**
 * Parcourt les elements de decor visibles.
 * @param {(item: {x:number,y:number,z:number,r:number,kind:string,key:string}) => void} fn
 */
export function forEachDecor(matrix, cx, cy, radius, removed, time, fn) {
  const d = matrix.decor;
  const drift = convection(time);
  const x0 = Math.floor((cx - radius) / DECOR_CELL), x1 = Math.floor((cx + radius) / DECOR_CELL);
  const y0 = Math.floor((cy - radius) / DECOR_CELL), y1 = Math.floor((cy + radius) / DECOR_CELL);
  const r2 = radius * radius;

  /* Dans une conduite, le monde BOUCLE : le decor doit boucler avec lui,
     sinon le recentrage du tapis roulant fait sauter tous les globules d'un
     coup. On replie donc la colonne de la grille sur la periode. */
  const perX = d.periodeX ? Math.round(d.periodeX / DECOR_CELL) : 0;
  const repli = (g) => (perX ? ((g % perX) + perX) % perX : g);

  for (let gy = y0; gy <= y1; gy++) {
    for (let gx = x0; gx <= x1; gx++) {
      const gr = repli(gx);
      /* `densite` permet a une matrice d'etre franchement plus encombree :
         une pate a levain est PLEINE de grains d'amidon, la ou une goutte de
         lait a de la place. */
      const n = Math.max(1, Math.round((1 + Math.floor(hash2(gr, gy) * 2)) * (d.densite || 1)));
      for (let i = 0; i < n; i++) {
        const key = `${gx},${gy},${i}`;
        if (removed.has(key)) continue;
        const h1 = hash2(gr * 31 + i, gy * 17);
        const h2 = hash2(gr * 13, gy * 29 + i);
        const h3 = hash2(gr + i * 101, gy - i * 57);
        const h4 = hash2(gr * 7 - i, gy * 3 + i * 41);
        const h5 = hash2(gr * 53 + i * 11, gy * 23 - i * 7);

        const kind = h4 > 0.84 ? 'bubble' : 'globule';
        /* L'exposant biaise la distribution vers les petites tailles : sans
           lui, une loi uniforme remplit le champ de gros objets et il n'y a
           plus de texture. */
        const r = kind === 'bubble'
          ? d.bubbleMinR + Math.pow(h3, d.bubbleSkew) * (d.bubbleMaxR - d.bubbleMinR)
          : d.minR + Math.pow(h3, d.skew) * (d.maxR - d.minR);

        /* Mouvement brownien d'amplitude 1/sqrt(taille) : les petits objets
           s'agitent plus. C'est Stokes-Einstein, et c'est gratuit ici
           puisque la position est une fonction du temps, sans etat. */
        /* ALLONGEMENT. Un globule gras est une gouttelette, donc rond. Un
           grain d'amidon de ble est LENTICULAIRE — une lentille vue de
           trois quarts — et c'est ce qui fait qu'un champ de grains se lit
           comme un encombrement et pas comme un semis de bulles. */
        const eMin = d.elongation ? d.elongation[0] : 1;
        const eMax = d.elongation ? d.elongation[1] : 1;
        const el = kind === 'bubble' ? 1 : eMin + h5 * (eMax - eMin);
        const ang = h5 * TAU;

        const amp = 11 / Math.sqrt(r);
        const f1 = 0.55 + h1 * 0.9, f2 = 0.47 + h2 * 0.8;
        const bx = gx * DECOR_CELL + h1 * DECOR_CELL;
        const by = gy * DECOR_CELL + h2 * DECOR_CELL;
        const x = bx + Math.sin(time * f1 + h3 * TAU) * amp + drift.x;
        const y = by + Math.cos(time * f2 + h4 * TAU) * amp + drift.y;

        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy > r2) continue;

        /* La profondeur derive aussi : des objets entrent et sortent du plan
           net tout seuls, ce qui donne au champ sa vie et sa profondeur. */
        const etal = d.zEtalement ?? 0.9;
        const z = clamp(
          (hash2(gx - i, gy + i) * 2 - 1) * etal + Math.sin(time * 0.21 + h1 * TAU) * 0.22,
          -1, 1,
        );
        fn({ x, y, z, r, el, ang, kind, key });
      }
    }
  }
}

/**
 * Rayon de l'ellipse dans la direction donnee.
 *
 * Un grain allonge n'oppose pas la meme surface selon l'angle d'approche :
 * on le contourne par la tranche et on le heurte de plein fouet par le
 * flanc. Traiter sa collision comme celle d'un disque ferait mentir le
 * dessin — et c'est le dessin que le joueur lit pour naviguer.
 */
export function rayonVers(it, nx, ny) {
  if (!it.el || it.el === 1) return it.r;
  const a = it.r * it.el, b = it.r;
  const ca = Math.cos(it.ang), sa = Math.sin(it.ang);
  const cu = nx * ca + ny * sa;         // composante sur le grand axe
  const su = -nx * sa + ny * ca;        // composante sur le petit axe
  return (a * b) / Math.sqrt(b * b * cu * cu + a * a * su * su);
}

/** Liste des elements proches, pour la physique. */
export function collectDecor(matrix, cx, cy, radius, removed, time) {
  const out = [];
  forEachDecor(matrix, cx, cy, radius, removed, time, (it) => out.push(it));
  return out;
}

/**
 * Applique le decor a une entite qui possede x, y, vx, vy.
 * Renvoie un facteur de vitesse a appliquer (1 = libre).
 */
/**
 * @param {boolean} solide Les gros elements sont-ils IMPENETRABLES ?
 *   Un globule gras est une gouttelette : on s'y colle, on la traverse a
 *   moitie. Un grain d'amidon est un cristal : on ne le traverse pas du
 *   tout. C'est cette difference qui fait du levain un labyrinthe et du
 *   lait cru un champ ouvert.
 */
export function applyDecor(ent, entRadius, decor, dt, solide = false, d = {}) {
  let slow = 1;
  for (const it of decor) {
    /* Seul ce qui est dans le plan compte : un globule flou est au-dessus
       ou en dessous, on passe dessous sans le toucher. */
    if (Math.abs(it.z) > 0.30) continue;
    const dx = ent.x - it.x, dy = ent.y - it.y;
    const d2 = dx * dx + dy * dy;
    /* Test grossier d'abord, sur le grand axe : la trigonometrie de
       l'ellipse ne se paie que pour les quelques elements qui la meritent. */
    const rmax = it.r * (it.el || 1) + entRadius;
    if (d2 > rmax * rmax) continue;
    const d = Math.sqrt(d2) || 0.001;
    const nx = dx / d, ny = dy / d;
    const rr = rayonVers(it, nx, ny) + entRadius;
    if (d > rr) continue;

    if (it.kind === 'bubble') {
      /* Rebond : on repousse hors de la bulle et on inverse la composante
         normale de la vitesse. */
      const push = (rr - d);
      ent.x += nx * push;
      ent.y += ny * push;
      const vn = ent.vx * nx + ent.vy * ny;
      if (vn < 0) { ent.vx -= 2 * vn * nx * 0.75; ent.vy -= 2 * vn * ny * 0.75; }
    } else {
      /* Adsorption sur la membrane du globule : on ralentit fort, on est
         legerement retenu vers la surface, et on finit par se detacher. */
      slow = Math.min(slow, 0.42);
      const pull = clamp((rr - d) / rr, 0, 1);
      ent.vx -= ent.vx * pull * 3.2 * dt;
      ent.vy -= ent.vy * pull * 3.2 * dt;
      if (solide && it.r >= (d.solideMinR ?? 6)) {
        /* Cristal d'amidon : plein. On est repousse a l'exterieur et on
           GLISSE le long, au lieu de s'y ecraser. */
        const push = rr - d;
        ent.x += nx * push; ent.y += ny * push;
        const vn = ent.vx * nx + ent.vy * ny;
        if (vn < 0) { ent.vx -= nx * vn * 1.6; ent.vy -= ny * vn * 1.6; }
      } else if (d < it.r * 0.65) {
        /* Gouttelette : on ne s'enfonce pas jusqu'au centre, mais on entre. */
        const push = it.r * 0.65 - d;
        ent.x += nx * push; ent.y += ny * push;
      }
    }
  }
  return slow;
}

/** Un globule gras arrete une goutte d'acide : elle est hydrosoluble. */
export function decorBlocksBullet(bx, by, br, decor) {
  for (const it of decor) {
    if (it.kind !== 'globule' || Math.abs(it.z) > 0.30) continue;
    const dx = bx - it.x, dy = by - it.y;
    const d = Math.hypot(dx, dy) || 0.001;
    const rr = rayonVers(it, dx / d, dy / d) * 0.85 + br;
    if (d < rr) return true;
  }
  return false;
}
