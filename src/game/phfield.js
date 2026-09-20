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
  /** @param {object} matrix @param {{halfX:number,halfY:number}} arena */
  constructor(matrix, arena) {
    /* La grille epouse la FORME de l'arene. Une conduite fait 1400 x 110 :
       lui allouer un carre de 1400 de cote gaspillerait 92 % des cases et
       ferait travailler la diffusion sur de l'acier. */
    this.ox = arena ? arena.halfX : matrix.arenaRadius;
    this.oy = arena ? arena.halfY : matrix.arenaRadius;
    /* Maille CONSTANTE, pas un nombre de cases constant : agrandir l'arene
       ne doit pas rendre les poches d'acide plus grossieres. */
    this.cell = 12;
    this.nx = Math.ceil((2 * this.ox) / this.cell);
    this.ny = Math.ceil((2 * this.oy) / this.cell);
    this.base = matrix.chem.phStart;
    this.floor = matrix.chem.phFloor;
    this.grid = new Float32Array(this.nx * this.ny).fill(this.base);
    this.tmp = new Float32Array(this.nx * this.ny);
    this.acc = 0;
  }

  _ij(x, y) {
    const i = clamp(Math.floor((x + this.ox) / this.cell), 0, this.nx - 1);
    const j = clamp(Math.floor((y + this.oy) / this.cell), 0, this.ny - 1);
    return j * this.nx + i;
  }

  /** pH au point demande (plus proche voisin). */
  at(x, y) { return this.grid[this._ij(x, y)]; }

  /** pH interpole : sans ca, la carte en fausses couleurs montre la grille
   *  sous forme de gros carres, ce qui n'a rien d'un gradient chimique. */
  atSmooth(x, y) {
    const { nx, ny, cell, grid } = this;
    const fx = clamp((x + this.ox) / cell - 0.5, 0, nx - 1);
    const fy = clamp((y + this.oy) / cell - 0.5, 0, ny - 1);
    const i0 = Math.floor(fx), j0 = Math.floor(fy);
    const i1 = Math.min(i0 + 1, nx - 1), j1 = Math.min(j0 + 1, ny - 1);
    const tx = fx - i0, ty = fy - j0;
    const a = grid[j0 * nx + i0], b = grid[j0 * nx + i1];
    const c = grid[j1 * nx + i0], d = grid[j1 * nx + i1];
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
    const ci = clamp(Math.floor((x + this.ox) / this.cell), 0, this.nx - 1);
    const cj = clamp(Math.floor((y + this.oy) / this.cell), 0, this.ny - 1);
    for (let dj = -r; dj <= r; dj++) {
      for (let di = -r; di <= r; di++) {
        const i = ci + di, j = cj + dj;
        if (i < 0 || j < 0 || i >= this.nx || j >= this.ny) continue;
        const d = Math.hypot(di, dj) / r;
        if (d > 1) continue;
        const k = j * this.nx + i;
        this.grid[k] = Math.max(this.floor, this.grid[k] - amount * (1 - d));
      }
    }
  }

  /**
   * Diffusion et retour lent vers le pH du milieu. Tourne a pas fixe :
   * la chimie n'a pas besoin de suivre la frequence d'affichage.
   */
  update(dt, cx = 0, cy = 0) {
    this.acc += dt;
    if (this.acc < 0.1) return;
    const step = this.acc;
    this.acc = 0;

    const { nx, ny, grid, tmp, base } = this;
    /* On ne fait diffuser que la fenetre autour du joueur. Sur une grande
       arene, la quasi-totalite de la grille est au pH du milieu et n'a rien
       a echanger : la faire tourner entierement serait du temps perdu.
       L'acide loin du joueur reste en place, ce qui est aussi le bon
       comportement physique a cette echelle de temps. */
    const HALF = 72;
    const ci = Math.round((cx + this.ox) / this.cell);
    const cj = Math.round((cy + this.oy) / this.cell);
    const i0 = Math.max(1, ci - HALF), i1 = Math.min(nx - 2, ci + HALF);
    const j0 = Math.max(1, cj - HALF), j1 = Math.min(ny - 2, cj + HALF);
    if (i1 < i0 || j1 < j0) return;
    /* Le lait est visqueux et tamponne par les caseines et les phosphates :
       l'acide s'etale lentement et le milieu revient lentement. Avec une
       diffusion rapide, le joueur n'arrivait jamais a acidifier quoi que ce
       soit — l'acide se dissipait plus vite qu'il n'etait depose. */
    const diff = Math.min(0.5, 0.18 * step);  // etalement
    const back = Math.min(0.5, 0.012 * step); // tamponnage du milieu

    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const k = j * nx + i;
        const avg = (grid[k - 1] + grid[k + 1] + grid[k - nx] + grid[k + nx]) * 0.25;
        let v = grid[k] + (avg - grid[k]) * diff;
        v += (base - v) * back;
        tmp[k] = v;
      }
    }
    for (let j = j0; j <= j1; j++) {
      grid.set(tmp.subarray(j * nx + i0, j * nx + i1 + 1), j * nx + i0);
    }
  }

  /**
   * Bornes autour d'un point, pour caler l'echelle de la vue en fausses
   * couleurs. Bornees a une fenetre : balayer toute la grille a chaque image
   * couterait bien plus que de l'afficher.
   */
  range(cx = 0, cy = 0, radius = 260) {
    const { nx, ny, grid } = this;
    const r = Math.ceil(radius / this.cell);
    const ci = Math.round((cx + this.ox) / this.cell);
    const cj = Math.round((cy + this.oy) / this.cell);
    let lo = Infinity, hi = -Infinity;
    for (let j = Math.max(0, cj - r); j <= Math.min(ny - 1, cj + r); j++) {
      for (let i = Math.max(0, ci - r); i <= Math.min(nx - 1, ci + r); i++) {
        const v = grid[j * nx + i];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    if (lo === Infinity) return [this.base, this.base];
    return [lo, hi];
  }
}
