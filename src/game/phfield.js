/* ---------------------------------------------------------------------------
   Champ de pH local.

   Le pH cesse d'etre un compteur global : c'est une grille que le joueur
   acidifie la ou il tire. Les gouttes d'acide lactique diffusent en vol et
   deposent le gros de leur charge en fin de course, donc arroser une zone la
   transforme durablement.

   Consequences : les coliformes ralentissent sous 5,6 ; les Pseudomonas
   brulent sous 5,2 ; et la bacterie lactique, qui est chez elle en milieu
   acide, gagne en cadence dans sa propre flaque. Fabriquer son terrain
   devient une tactique.
--------------------------------------------------------------------------- */

import { clamp } from '../core/util.js';

export class PhField {
  constructor(matrix) {
    this.R = matrix.arenaRadius;
    this.n = 96;
    this.cell = (2 * this.R) / this.n;
    this.base = matrix.chem.phStart;
    this.floor = matrix.chem.phFloor;
    this.grid = new Float32Array(this.n * this.n).fill(this.base);
    this.tmp = new Float32Array(this.n * this.n);
    this.acc = 0;
  }

  _ij(x, y) {
    const i = clamp(Math.floor((x + this.R) / this.cell), 0, this.n - 1);
    const j = clamp(Math.floor((y + this.R) / this.cell), 0, this.n - 1);
    return j * this.n + i;
  }

  /** pH au point demande (plus proche voisin). */
  at(x, y) { return this.grid[this._ij(x, y)]; }

  /** pH interpole : sans ca, la carte en fausses couleurs montre la grille
   *  sous forme de gros carres, ce qui n'a rien d'un gradient chimique. */
  atSmooth(x, y) {
    const { n, cell, R, grid } = this;
    const fx = clamp((x + R) / cell - 0.5, 0, n - 1);
    const fy = clamp((y + R) / cell - 0.5, 0, n - 1);
    const i0 = Math.floor(fx), j0 = Math.floor(fy);
    const i1 = Math.min(i0 + 1, n - 1), j1 = Math.min(j0 + 1, n - 1);
    const tx = fx - i0, ty = fy - j0;
    const a = grid[j0 * n + i0], b = grid[j0 * n + i1];
    const c = grid[j1 * n + i0], d = grid[j1 * n + i1];
    return (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty;
  }

  /** Depose de l'acide. `amount` est en unites de pH retirees au centre. */
  acidify(x, y, amount, radius = 0) {
    if (radius <= this.cell) {
      const k = this._ij(x, y);
      this.grid[k] = Math.max(this.floor, this.grid[k] - amount);
      return;
    }
    const r = Math.ceil(radius / this.cell);
    const ci = clamp(Math.floor((x + this.R) / this.cell), 0, this.n - 1);
    const cj = clamp(Math.floor((y + this.R) / this.cell), 0, this.n - 1);
    for (let dj = -r; dj <= r; dj++) {
      for (let di = -r; di <= r; di++) {
        const i = ci + di, j = cj + dj;
        if (i < 0 || j < 0 || i >= this.n || j >= this.n) continue;
        const d = Math.hypot(di, dj) / r;
        if (d > 1) continue;
        const k = j * this.n + i;
        this.grid[k] = Math.max(this.floor, this.grid[k] - amount * (1 - d));
      }
    }
  }

  /**
   * Diffusion et retour lent vers le pH du milieu. Tourne a pas fixe :
   * la chimie n'a pas besoin de suivre la frequence d'affichage.
   */
  update(dt) {
    this.acc += dt;
    if (this.acc < 0.1) return;
    const step = this.acc;
    this.acc = 0;

    const { n, grid, tmp, base } = this;
    /* Le lait est visqueux et tamponne par les caseines et les phosphates :
       l'acide s'etale lentement et le milieu revient lentement. Avec une
       diffusion rapide, le joueur n'arrivait jamais a acidifier quoi que ce
       soit — l'acide se dissipait plus vite qu'il n'etait depose. */
    const diff = Math.min(0.5, 0.18 * step);  // etalement
    const back = Math.min(0.5, 0.012 * step); // tamponnage du milieu

    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        const l = grid[i > 0 ? k - 1 : k];
        const r = grid[i < n - 1 ? k + 1 : k];
        const u = grid[j > 0 ? k - n : k];
        const d = grid[j < n - 1 ? k + n : k];
        const avg = (l + r + u + d) * 0.25;
        let v = grid[k] + (avg - grid[k]) * diff;
        v += (base - v) * back;
        tmp[k] = v;
      }
    }
    this.grid.set(tmp);
  }

  /** Bornes courantes, pour caler l'echelle de la vue en fausses couleurs. */
  range() {
    let lo = Infinity, hi = -Infinity;
    for (let k = 0; k < this.grid.length; k++) {
      const v = this.grid[k];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    return [lo, hi];
  }
}
