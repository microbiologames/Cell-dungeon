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

  for (let gy = y0; gy <= y1; gy++) {
    for (let gx = x0; gx <= x1; gx++) {
      const n = 1 + Math.floor(hash2(gx, gy) * 2);
      for (let i = 0; i < n; i++) {
        const key = `${gx},${gy},${i}`;
        if (removed.has(key)) continue;
        const h1 = hash2(gx * 31 + i, gy * 17);
        const h2 = hash2(gx * 13, gy * 29 + i);
        const h3 = hash2(gx + i * 101, gy - i * 57);
        const h4 = hash2(gx * 7 - i, gy * 3 + i * 41);

        const kind = h4 > 0.84 ? 'bubble' : 'globule';
        const r = kind === 'bubble'
          ? 2.5 + h3 * 5.5
          : d.minR + h3 * (d.maxR - d.minR);

        /* Mouvement brownien d'amplitude 1/sqrt(taille) : les petits objets
           s'agitent plus. C'est Stokes-Einstein, et c'est gratuit ici
           puisque la position est une fonction du temps, sans etat. */
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
        const z = clamp(
          (hash2(gx - i, gy + i) * 2 - 1) * 0.9 + Math.sin(time * 0.21 + h1 * TAU) * 0.22,
          -1, 1,
        );
        fn({ x, y, z, r, kind, key });
      }
    }
  }
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
export function applyDecor(ent, entRadius, decor, dt) {
  let slow = 1;
  for (const it of decor) {
    /* Seul ce qui est dans le plan compte : un globule flou est au-dessus
       ou en dessous, on passe dessous sans le toucher. */
    if (Math.abs(it.z) > 0.30) continue;
    const dx = ent.x - it.x, dy = ent.y - it.y;
    const rr = it.r + entRadius;
    const d2 = dx * dx + dy * dy;
    if (d2 > rr * rr) continue;
    const d = Math.sqrt(d2) || 0.001;
    const nx = dx / d, ny = dy / d;

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
      /* On ne s'enfonce pas jusqu'au centre : le globule a un volume. */
      if (d < it.r * 0.65) {
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
    const rr = it.r * 0.85 + br;
    if (dx * dx + dy * dy < rr * rr) return true;
  }
  return false;
}
