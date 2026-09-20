/* ---------------------------------------------------------------------------
   Entrees. Clavier lu par event.code (position physique), donc AZERTY et
   QWERTY fonctionnent sans reglage : KeyW/KeyA/KeyS/KeyD correspondent a
   ZQSD sur un clavier francais.

   Tactile : moitie gauche = manche virtuel de deplacement, moitie droite =
   glissement vertical pour la mise au point. Detecte automatiquement.
--------------------------------------------------------------------------- */

import { clamp } from './util.js';

const MOVE_KEYS = {
  KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0],
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
};
const FOCUS_KEYS = { KeyR: -1, KeyF: 1, NumpadAdd: -1, NumpadSubtract: 1 };

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.move = { x: 0, y: 0 };
    this.focusAxis = 0;      // -1 .. 1, maintenu
    this.focusImpulse = 0;   // molette, consomme chaque image
    this.dash = false;
    this.pause = false;
    this.anyPress = false;
    this.hasTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    /* Etat du manche virtuel, pour que le HUD puisse le dessiner. */
    this.stick = { active: false, ox: 0, oy: 0, dx: 0, dy: 0 };
    this.focusPad = { active: false, oy: 0, dy: 0 };
    this._touches = new Map();
    this._bind();
  }

  _bind() {
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.anyPress = true;
      if (e.code === 'Space') { this.dash = true; e.preventDefault(); }
      if (e.code === 'Escape' || e.code === 'KeyP') this.pause = true;
      if (MOVE_KEYS[e.code] || FOCUS_KEYS[e.code]) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.focusImpulse += clamp(e.deltaY, -60, 60) * 0.0024;
    }, { passive: false });

    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => this._down(e), { passive: false });
    c.addEventListener('pointermove', (e) => this._move(e), { passive: false });
    c.addEventListener('pointerup', (e) => this._up(e));
    c.addEventListener('pointercancel', (e) => this._up(e));
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Coordonnees du pointeur en fraction du canvas affiche. */
  _local(e) {
    const r = this.canvas.getBoundingClientRect();
    return { u: (e.clientX - r.left) / r.width, v: (e.clientY - r.top) / r.height, r };
  }

  _down(e) {
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    this.anyPress = true;
    const { u, v, r } = this._local(e);
    if (u < 0.5) {
      this._touches.set(e.pointerId, { role: 'move', ox: e.clientX, oy: e.clientY, r });
      this.stick.active = true;
      this.stick.ox = u; this.stick.oy = v;
      this.stick.dx = 0; this.stick.dy = 0;
    } else {
      this._touches.set(e.pointerId, { role: 'focus', ox: e.clientX, oy: e.clientY, r });
      this.focusPad.active = true;
      this.focusPad.oy = v;
      this.focusPad.dy = 0;
    }
    /* Apres l'enregistrement, et jamais bloquant : la capture peut lever
       (pointeur deja relache, evenement synthetique). Si elle echoue, le
       doigt doit quand meme compter. */
    try { this.canvas.setPointerCapture?.(e.pointerId); } catch { /* sans effet */ }
  }

  _move(e) {
    const t = this._touches.get(e.pointerId);
    if (!t) return;
    e.preventDefault();
    if (t.role === 'move') {
      /* Rayon du manche : 18 % de la largeur affichee. */
      const rad = t.r.width * 0.18;
      const dx = clamp((e.clientX - t.ox) / rad, -1, 1);
      const dy = clamp((e.clientY - t.oy) / rad, -1, 1);
      this.stick.dx = dx; this.stick.dy = dy;
    } else {
      /* Mappage ABSOLU : la mise au point suit le deplacement reel du doigt.
         Glisser d'un tiers de la hauteur balaie toute la profondeur. Un
         mappage par impulsion demandait plus de trois secondes pour aller
         d'un bout a l'autre : injouable pour une commande de combat. */
      const sweep = t.r.height * 0.34;
      const delta = (e.clientY - t.oy) / sweep * 2;
      this.focusImpulse += delta;
      this.focusPad.dy = clamp(delta * 4, -1, 1);
      t.oy = e.clientY;
    }
  }

  _up(e) {
    const t = this._touches.get(e.pointerId);
    if (!t) return;
    this._touches.delete(e.pointerId);
    try { this.canvas.releasePointerCapture?.(e.pointerId); } catch { /* sans effet */ }
    if (t.role === 'move') {
      this.stick.active = false; this.stick.dx = 0; this.stick.dy = 0;
    } else {
      this.focusPad.active = false; this.focusPad.dy = 0;
    }
  }

  /** A appeler une fois par image, avant la logique. */
  sample() {
    let mx = 0, my = 0;
    for (const code of this.keys) {
      const m = MOVE_KEYS[code];
      if (m) { mx += m[0]; my += m[1]; }
    }
    if (this.stick.active) { mx += this.stick.dx; my += this.stick.dy; }
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    this.move.x = mx; this.move.y = my;

    let f = 0;
    for (const code of this.keys) {
      const k = FOCUS_KEYS[code];
      if (k) f += k;
    }
    this.focusAxis = clamp(f, -1, 1);
  }

  /** Consomme l'impulsion de molette / glissement accumulee. */
  takeFocusImpulse() {
    const v = this.focusImpulse;
    this.focusImpulse = 0;
    return v;
  }

  takeDash() { const v = this.dash; this.dash = false; return v; }
  takePause() { const v = this.pause; this.pause = false; return v; }
  takeAnyPress() { const v = this.anyPress; this.anyPress = false; return v; }
}
