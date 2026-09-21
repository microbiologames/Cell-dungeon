/* ---------------------------------------------------------------------------
   Nageur libre : le corps que le joueur pilote hors combat, dans le lobby et
   dans le bestiaire. Meme modele d'inertie que le joueur en jeu — un moteur
   a saturation de constante de temps vitesse / agilite — pour que le
   toucher soit le meme partout.
--------------------------------------------------------------------------- */

import { TAU, clamp, girer } from '../core/util.js';
import { Sillage } from '../render/flagella.js';

export class Swimmer {
  constructor(x = 0, y = 0, speed = 86, accel = 520) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.ang = -Math.PI / 2;
    this.phase = 0;
    this.speed = speed;
    this.accel = accel;
    this.radius = 3.4;
    /* Meme attirail que le joueur en jeu : effort de nage, giration,
       memoire de cap et desordre du faisceau. Le toucher doit etre le meme
       partout, l'allure aussi. */
    this.drive = 0;
    this.angCible = this.ang;
    this.omega = 0;
    this.lean = 0;
    this.trouble = 0;
    this.sillage = new Sillage();
  }

  update(dt, move, bounds) {
    this.phase += dt;
    const tau = this.speed / Math.max(1, this.accel);
    const k = 1 - Math.exp(-dt / Math.max(tau, 0.016));
    this.vx += (move.x * this.speed - this.vx) * k;
    this.vy += (move.y * this.speed - this.vy) * k;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const effort = Math.min(1, Math.hypot(move.x, move.y));
    if (effort > 0.02) this.angCible = Math.atan2(move.y, move.x);
    const tauAng = Math.max(0.07, 80 / this.accel);
    const omegaMax = clamp(1.15 / tauAng, 1.8, 11);
    girer(this, dt, this.angCible, tauAng, omegaMax);
    this.lean += (clamp(this.omega / omegaMax, -1, 1) - this.lean) * Math.min(1, dt * 12);
    const avant = this.drive;
    this.drive += (effort - this.drive) * Math.min(1, dt * 9);
    const freinage = Math.max(0, (avant - this.drive) / Math.max(dt, 1e-3)) * 0.22;
    this.trouble = clamp(Math.max(this.trouble * Math.exp(-dt / 0.45), freinage,
      Math.abs(this.omega) / omegaMax * 0.9), 0, 1);
    this.sillage.pousser(this.ang, dt);

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
