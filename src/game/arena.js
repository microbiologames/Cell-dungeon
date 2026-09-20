/* ---------------------------------------------------------------------------
   Forme de l'arene.

   Jusqu'ici une matrice etait forcement une goutte : un disque, un menisque,
   un rappel elastique vers le centre. La conduite industrielle n'est pas une
   arene, c'est un COULOIR — on n'y tourne pas autour de la horde, on lui fait
   face, dos au courant. La forme doit donc devenir une donnee de la matrice
   et non une constante du moteur.

   Tout le monde passe par le meme objet : le joueur, les mobs, les gouttes,
   le directeur et le rendu du bord. Une seule definition de "dehors".
--------------------------------------------------------------------------- */

import { TAU, clamp } from '../core/util.js';

/** Goutte : disque de rayon R, menisque tout autour. */
class DiscArena {
  constructor(R) { this.kind = 'disc'; this.R = R; this.halfX = R; this.halfY = R; }

  /** Rayon max utile pour le rendu et les champs (grille de pH, decor). */
  get extent() { return this.R; }

  contains(x, y, m = 0) { return Math.hypot(x, y) <= this.R - m; }

  /**
   * Replace un objet a l'interieur et amortit sa vitesse.
   * @returns {boolean} vrai si l'objet touchait le bord.
   */
  confine(o, margin = 0, bounce = -0.3) {
    const R = this.R - margin;
    const d = Math.hypot(o.x, o.y);
    if (d <= R || d === 0) return false;
    const k = R / d;
    o.x *= k; o.y *= k;
    if (o.vx !== undefined) { o.vx *= bounce; o.vy *= bounce; }
    return true;
  }

  /** Proximite du bord, de 0 (loin) a 1 (contre la paroi). */
  edgeCloseness(x, y, band = 90) {
    const d = Math.hypot(x, y);
    return clamp((d - (this.R - band)) / band, 0, 1);
  }

  /** Direction du bord le plus proche, en radians. */
  edgeDir(x, y) { return Math.atan2(y, x); }

  /** Point d'apparition a distance d d'un point, ramene dans l'arene. */
  spawnNear(rng, px, py, dMin, dMax) {
    const a = rng() * TAU;
    const d = dMin + rng() * (dMax - dMin);
    let x = px + Math.cos(a) * d, y = py + Math.sin(a) * d;
    const dist = Math.hypot(x, y);
    if (dist > this.R - 8) { const k = (this.R - 8) / dist; x *= k; y *= k; }
    return { x, y };
  }
}

/** Conduite : tube tres allonge, parois en haut et en bas. */
class TubeArena {
  constructor(halfX, halfY) {
    this.kind = 'tube'; this.halfX = halfX; this.halfY = halfY;
  }

  get extent() { return Math.max(this.halfX, this.halfY); }

  contains(x, y, m = 0) {
    return Math.abs(x) <= this.halfX - m && Math.abs(y) <= this.halfY - m;
  }

  confine(o, margin = 0, bounce = -0.3) {
    const hx = this.halfX - margin, hy = this.halfY - margin;
    let touche = false;
    if (o.x > hx) { o.x = hx; if (o.vx !== undefined) o.vx *= bounce; touche = true; }
    else if (o.x < -hx) { o.x = -hx; if (o.vx !== undefined) o.vx *= bounce; touche = true; }
    /* La paroi haute et la paroi basse sont le vrai mur : on y perd plus de
       vitesse qu'aux extremites, qui sont juste la limite du troncon. */
    if (o.y > hy) { o.y = hy; if (o.vy !== undefined) o.vy *= bounce; touche = true; }
    else if (o.y < -hy) { o.y = -hy; if (o.vy !== undefined) o.vy *= bounce; touche = true; }
    return touche;
  }

  edgeCloseness(x, y, band = 40) {
    const my = (this.halfY - Math.abs(y)) / band;
    const mx = (this.halfX - Math.abs(x)) / band;
    return clamp(1 - Math.min(my, mx), 0, 1);
  }

  edgeDir(x, y) {
    const my = this.halfY - Math.abs(y);
    const mx = this.halfX - Math.abs(x);
    if (my <= mx) return y >= 0 ? Math.PI / 2 : -Math.PI / 2;
    return x >= 0 ? 0 : Math.PI;
  }

  spawnNear(rng, px, py, dMin, dMax) {
    /* Dans un couloir, la horde arrive par la gauche ou par la droite : un
       tirage circulaire mettrait la moitie des mobs dans la paroi. */
    for (let essai = 0; essai < 8; essai++) {
      const a = rng() * TAU;
      const d = dMin + rng() * (dMax - dMin);
      const x = px + Math.cos(a) * d;
      const y = py + Math.sin(a) * d * 0.45;
      if (this.contains(x, y, 6)) return { x, y };
    }
    const sens = rng() < 0.5 ? -1 : 1;
    return {
      x: clamp(px + sens * dMax, -this.halfX + 8, this.halfX - 8),
      y: clamp(py + (rng() * 2 - 1) * this.halfY * 0.7, -this.halfY + 6, this.halfY - 6),
    };
  }

  /** Profil de vitesse de l'ecoulement : maximal au centre, nul aux parois.
   *  C'est un ecoulement laminaire — la couche limite est un refuge reel. */
  flowProfile(y) {
    const u = clamp(Math.abs(y) / this.halfY, 0, 1);
    return 1 - u * u;
  }
}

export function makeArena(matrix) {
  const a = matrix.arena;
  if (a && a.kind === 'tube') return new TubeArena(a.halfX, a.halfY);
  return new DiscArena(matrix.arenaRadius);
}
