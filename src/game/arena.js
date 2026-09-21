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
import { Geometrie, PERIODE } from './pipe-geo.js';

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
/**
 * Conduite : un couloir SANS FIN.
 *
 * L'abscisse n'est jamais bornee. Ce qui empeche les coordonnees de partir a
 * l'infini n'est pas une paroi, c'est le tapis roulant de la Conduite : quand
 * le joueur franchit la couture, tout le monde est recentre d'un coup. Comme
 * la geometrie et le decor sont periodiques de la meme longueur, ca ne se
 * voit pas — et surtout, on peut revenir en arriere indefiniment. Avec des
 * extremites fermees, le courant vous plaquait contre un mur invisible.
 *
 * La hauteur, elle, est une vraie paroi, et elle VARIE : c'est la geometrie
 * qui repond.
 */
class TubeArena {
  constructor(geo, periode) {
    this.kind = 'tube';
    this.geo = geo;
    this.periode = periode;
    this.halfX = periode / 2;
    this.halfY = geo.demiMax;
  }

  get extent() { return Math.max(this.halfX, this.halfY); }

  contains(x, y, m = 0) {
    const c = this.geo.canal(x, y);
    return y >= c.bas + m && y <= c.haut - m;
  }

  /**
   * @param {number} glisse 0 = on bute sur les barreaux, 1 = on est guide
   *   vers l'ouverture la plus proche. Le joueur doit VISER le trou — c'est
   *   tout l'interet d'une crepine ; les mobs, eux, sont guides, sinon ils
   *   s'entassent contre la grille et la horde ne passe plus jamais.
   */
  confine(o, margin = 0, bounce = -0.3, glisse = 0) {
    /* Rien sur l'abscisse : le couloir n'a pas de bout. */
    const fil = this.geo.filtre(o.x);
    if (fil && !this.geo.passeFiltre(fil, o.y)) {
      /* Un barreau est plein : on le repousse du cote d'ou l'on vient. */
      const sens = (o.vx !== undefined && o.vx < 0) ? -1 : 1;
      o.x += sens * (fil.epaisseur + 0.8);
      if (o.vx !== undefined) o.vx *= -0.15;
      if (glisse > 0) {
        let proche = null, d = 1e9;
        for (const t of fil.trous) {
          const dd = Math.abs(o.y - t.y);
          if (dd < d) { d = dd; proche = t; }
        }
        if (proche) o.y += Math.sign(proche.y - o.y) * Math.min(d, 34 * glisse * 0.016);
      }
    }
    const c = this.geo.canal(o.x, o.y);
    const bas = c.bas + margin, haut = c.haut - margin;
    if (haut <= bas) { o.y = (c.bas + c.haut) / 2; return true; }
    if (o.y > haut) { o.y = haut; if (o.vy !== undefined) o.vy *= bounce; return true; }
    if (o.y < bas) { o.y = bas; if (o.vy !== undefined) o.vy *= bounce; return true; }
    return false;
  }

  edgeCloseness(x, y, band = 34) {
    const c = this.geo.canal(x, y);
    const m = Math.min(y - c.bas, c.haut - y);
    return clamp(1 - m / band, 0, 1);
  }

  edgeDir(x, y) {
    const c = this.geo.canal(x, y);
    return (y - c.bas) <= (c.haut - y) ? -Math.PI / 2 : Math.PI / 2;
  }

  spawnNear(rng, px, py, dMin, dMax) {
    /* Dans un couloir, la horde arrive par la gauche ou par la droite : un
       tirage circulaire mettrait la moitie des mobs dans la paroi. */
    for (let essai = 0; essai < 10; essai++) {
      const a = rng() * TAU;
      const d = dMin + rng() * (dMax - dMin);
      const x = px + Math.cos(a) * d;
      const y = py + Math.sin(a) * d * 0.45;
      if (this.contains(x, y, 6)) return { x, y };
    }
    const sens = rng() < 0.5 ? -1 : 1;
    const x = px + sens * dMax;
    const c = this.geo.canal(x, py);
    return { x, y: clamp(py, c.bas + 6, c.haut - 6) };
  }

  /** Profil de vitesse : maximal au milieu du canal, nul aux parois.
   *  C'est un ecoulement laminaire — la couche limite est un refuge reel. */
  flowProfile(y, x = 0) {
    const c = this.geo.canal(x, y);
    const demi = (c.haut - c.bas) / 2;
    const centre = (c.haut + c.bas) / 2;
    const u = clamp(Math.abs(y - centre) / Math.max(demi, 1), 0, 1);
    return (1 - u * u) * this.geo.facteurDebit(x);
  }
}

export function makeArena(matrix, graine = 3) {
  const a = matrix.arena;
  if (a && a.kind === 'tube') {
    return new TubeArena(new Geometrie(a.demi, graine), PERIODE);
  }
  return new DiscArena(matrix.arenaRadius);
}
