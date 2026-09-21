/* ---------------------------------------------------------------------------
   Nageur libre : le corps que le joueur pilote hors combat, dans le lobby et
   dans le bestiaire. Meme modele d'inertie que le joueur en jeu — un moteur
   a saturation de constante de temps vitesse / agilite — pour que le
   toucher soit le meme partout.
--------------------------------------------------------------------------- */

import { TAU } from '../core/util.js';

export class Swimmer {
  constructor(x = 0, y = 0, speed = 86, accel = 520) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.ang = -Math.PI / 2;
    this.phase = 0;
    this.speed = speed;
    this.accel = accel;
    this.radius = 3.4;
    /* Effort de nage, pour que la flagellation batte comme en jeu. */
    this.drive = 0;
  }

  update(dt, move, bounds) {
    this.phase += dt;
    const tau = this.speed / Math.max(1, this.accel);
    const k = 1 - Math.exp(-dt / Math.max(tau, 0.016));
    this.vx += (move.x * this.speed - this.vx) * k;
    this.vy += (move.y * this.speed - this.vy) * k;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (move.x || move.y) this.ang = Math.atan2(move.y, move.x);
    const effort = Math.min(1, Math.hypot(move.x, move.y));
    this.drive += (effort - this.drive) * Math.min(1, dt * 9);

    if (bounds) {
      if (bounds.r !== undefined) {
        const d = Math.hypot(this.x, this.y);
        if (d > bounds.r) {
          const kk = bounds.r / d;
          this.x *= kk; this.y *= kk;
          this.vx *= -0.25; this.vy *= -0.25;
        }
      } else {
        if (this.x < -bounds.hw) { this.x = -bounds.hw; this.vx *= -0.25; }
        if (this.x > bounds.hw) { this.x = bounds.hw; this.vx *= -0.25; }
        if (this.y < -bounds.hh) { this.y = -bounds.hh; this.vy *= -0.25; }
        if (this.y > bounds.hh) { this.y = bounds.hh; this.vy *= -0.25; }
      }
    }
  }
}

export { TAU };
