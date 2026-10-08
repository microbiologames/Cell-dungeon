/* ---------------------------------------------------------------------------
   Entrees. Clavier lu par event.code (position physique), donc AZERTY et
   QWERTY fonctionnent sans reglage : KeyW/KeyA/KeyS/KeyD correspondent a
   ZQSD sur un clavier francais.

   Tactile : moitie gauche = manche virtuel de deplacement, moitie droite =
   glissement vertical pour la mise au point. Detecte automatiquement.

   Manettes : la borne d'arcade est vue par le navigateur comme UNE OU DEUX
   manettes (son encodeur USB n'envoie pas de touches). Le geste voulu est
   celui d'un joueur qui tient les DEUX joysticks de la borne : le gauche
   nage, le droit fait la mise au point. Voir PADS plus bas.
--------------------------------------------------------------------------- */

import { clamp } from './util.js';

const MOVE_KEYS = {
  KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0],
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
};
const FOCUS_KEYS = { KeyR: -1, KeyF: 1, NumpadAdd: -1, NumpadSubtract: 1 };
/* Valider un menu au clavier. Space y sert aussi : c'est le bouton de dash,
   et le reflexe est de taper dash pour passer un ecran. Le menu jette alors
   le dash en attente (main.js) : sans cela, sortir de la pause avec ce
   bouton lancait un dash dans l'image suivante — mesure au banc manette,
   verdict 19, refroidissement a 5,5 s au lieu de 0. */
const VALIDER_KEYS = new Set(['Enter', 'NumpadEnter', 'Space', 'KeyE']);
const MENU_DY_KEYS = { ArrowUp: -1, KeyW: -1, ArrowDown: 1, KeyS: 1 };

/* --- Manettes --------------------------------------------------------------
   Deux manettes par defaut, dans l'ordre ou le navigateur les expose :
   la premiere deplace, la seconde met au point. L'ordre d'un encodeur de
   borne n'est pas garanti ; il se corrige SANS toucher au code, par l'URL
   servie par le kiosque : index.html?manettes=1,0

   Repli a une seule manette (manette de salon, ou encodeur vu comme un seul
   peripherique) : le stick droit de la meme manette, axes[2]/axes[3] du
   mappage "standard", prend la mise au point.

   Les index viennent du RELEVE fait sur la borne le 18/08/2026 (mesure CDP
   sur ses deux cartes DragonRise, reportee depuis Family Fight) : 0 = A vert,
   1 = B rouge, 2 = Y jaune, 3 = X bleu, 4 = Z blanc. Ce meuble n'a NI START
   NI SELECT, les index 8 et 9 n'existent pas : d'ou le 9 retire de
   'valider'. La pause passe au bouton 5, le seul qui reste ; il n'est cable
   que sur la carte du joueur 2, ce qui suffit ici puisque les fronts sont
   lus sur toutes les manettes confondues.
   Le bouton 4 (blanc) est laisse libre expres : il porte le geste de retour
   au menu du lanceur, qui le lit par-dessus le jeu. */
const PAD_BOUTONS = {
  dash: [0, 2],
  valider: [0, 2],
  pause: [5],
};
const PAD_DPAD = { haut: 12, bas: 13, gauche: 14, droite: 15 };
/* Zone morte. Un encodeur de borne est TOUT-OU-RIEN : son axe sort -1, 0 ou
   +1, donc n'importe quel seuil le laisse passer. La valeur basse est la
   pour les vraies manettes analogiques, dont le repos derive de quelques
   centiemes. Releve du 18/08/2026 sur la borne : ses deux cartes sortent
   [0, 0, 0, 0] au repos, donc 0,25 passe tres largement. A reconfirmer sur
   place avec borne/touches.html avant l'evenement. */
const PAD_ZONE_MORTE = 0.25;

/** Lecture de l'URL : ?manettes=<index deplacement>,<index mise au point> */
function padsDemandes() {
  try {
    const v = new URLSearchParams(location.search).get('manettes');
    if (!v) return [0, 1];
    const [a, b] = v.split(',').map((n) => Number.parseInt(n, 10));
    return [Number.isFinite(a) ? a : 0, Number.isFinite(b) ? b : 1];
  } catch { return [0, 1]; }
}

const mort = (v) => (Math.abs(v) < PAD_ZONE_MORTE ? 0 : v);

/* Les deux joysticks de la borne sont montes EN MIROIR : sur la carte
   d'index 0, pousser a gauche donne axes[0] = +1 et vers le haut
   axes[1] = +1, l'inverse de la convention. Mesure du 18/08/2026, reprise de
   Family Fight. Sans elle, le joystick gauche fait nager a l'envers.
   Restreint aux cartes DragonRise du meuble : le jeu se joue aussi a la
   manette de salon, dont l'index 0 est parfaitement normal et ne doit
   surtout pas etre inverse. */
const BORNE_DRAGONRISE = /dragonrise|0079/i;
const axe = (pad, i) => {
  /* Le miroir n'a ete mesure que sur les DEUX axes du joystick (0 et 1). On
     ne l'etend donc pas a axes[3], que seul le repli a une manette unique
     utilise : inverser un axe qu'on n'a pas releve serait une devinette. */
  const sign = i < 2 && pad.index === 0 && BORNE_DRAGONRISE.test(pad.id || '') ? -1 : 1;
  return mort((pad.axes[i] || 0) * sign);
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.move = { x: 0, y: 0 };
    this.focusAxis = 0;      // -1 .. 1, maintenu
    this.focusImpulse = 0;   // molette, consomme chaque image
    this.dash = false;
    this.pause = false;
    this.muet = false;
    this.panneauSon = false;
    this.anyPress = false;
    this.hasTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.hasPad = false;
    /* Etat du manche virtuel, pour que le HUD puisse le dessiner. */
    this.stick = { active: false, ox: 0, oy: 0, dx: 0, dy: 0 };
    this.focusPad = { active: false, oy: 0, dy: 0 };
    this._touches = new Map();
    /* Manettes : etat de l'image courante, et de la precedente pour les
       fronts. Les fronts sont CONSOMMES par le preneur qui s'en sert, et
       c'est ce qui rend l'ORDRE des preneurs sans importance : le meme
       bouton 9 est la pause en jeu et la validation dans un ecran.
       Mesure (banc manette, verdict 12) : la consommation seule suffit a
       tenir, mais retiree EN MEME TEMPS que l'ordre des preneurs — la
       navigation des ecrans passee apres les scenes — la pause se refermait
       dans l'image meme qui l'ouvrait. Deux garde-fous pour un defaut, on
       garde les deux. */
    this._padIdx = padsDemandes();
    this._padPrev = new Map();
    this._padEdges = new Set();
    this._padMove = { x: 0, y: 0 };
    this._padFocus = 0;
    this._menuLatch = 0;
    this._menuDy = 0;
    this._menuValider = false;
    this._bind();
  }

  _bind() {
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.anyPress = true;
      if (e.code === 'Space') { this.dash = true; e.preventDefault(); }
      if (e.code === 'Escape' || e.code === 'KeyP') this.pause = true;
      if (e.code === 'KeyM') this.muet = true;
      if (e.code === 'KeyL') this.panneauSon = true;
      if (MENU_DY_KEYS[e.code]) this._menuDy = MENU_DY_KEYS[e.code];
      if (VALIDER_KEYS.has(e.code)) { this._menuValider = true; e.preventDefault(); }
      if (MOVE_KEYS[e.code] || FOCUS_KEYS[e.code]) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    /* Une manette ne se declare qu'au premier appui : hasPad passe a vrai en
       cours de route, et c'est la boucle principale qui le surveille pour
       corriger le libelle des commandes. */
    addEventListener('gamepadconnected', () => { this.hasPad = true; });

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

  /* --- Manettes ---------------------------------------------------------- */

  /** Les manettes branchees, trous compris : getGamepads() rend des null. */
  _pads() {
    const l = navigator.getGamepads ? navigator.getGamepads() : [];
    return Array.from(l || []);
  }

  /**
   * Un tour de manettes : axes, fronts de boutons, et le cap de menu.
   * Appele par sample(), donc une fois par image.
   */
  _samplePads() {
    const pads = this._pads();
    const vus = pads.filter(Boolean);
    if (vus.length) this.hasPad = true;

    const [iM, iF] = this._padIdx;
    const padM = pads[iM] || vus[0] || null;
    const padF = pads[iF] || null;

    this._padMove = { x: 0, y: 0 };
    this._padFocus = 0;
    this._padEdges.clear();

    if (padM) {
      this._padMove.x = axe(padM, 0) + this._dpadX(padM);
      this._padMove.y = axe(padM, 1) + this._dpadY(padM);
    }
    if (padF && padF !== padM) {
      /* Axe VERTICAL de la seconde manette, pris tel quel : axes[1] est
         positif vers le bas, comme la molette et comme le glissement
         tactile. Inverser ici ferait partir les trois commandes dans des
         sens differents pour le meme geste. */
      this._padFocus = clamp(axe(padF, 1) + this._dpadY(padF), -1, 1);
    } else if (padM && padM.axes.length >= 4) {
      /* Une seule manette : son stick droit. Le geste reste "le droit met au
         point", que les deux sticks soient sur deux peripheriques (borne) ou
         sur un seul (manette de salon). */
      this._padFocus = clamp(axe(padM, 3), -1, 1);
    }

    /* Fronts de boutons, toutes manettes confondues : sur la borne, le
       bouton de dash peut tomber sur l'un ou l'autre des deux encodeurs. */
    let dyPad = 0;
    for (const [i, pad] of pads.entries()) {
      if (!pad) { this._padPrev.delete(i); continue; }
      const prev = this._padPrev.get(i) || [];
      const now = pad.buttons.map((b) => !!b.pressed);
      for (const [b, on] of now.entries()) {
        if (on && !prev[b]) {
          this._padEdges.add(`${i}:${b}`);
          this.anyPress = true;
          if (PAD_BOUTONS.dash.includes(b)) this.dash = true;
        }
      }
      this._padPrev.set(i, now);
      const y = axe(pad, 1) + this._dpadY(pad);
      if (y && !dyPad) dyPad = Math.sign(y);
    }

    /* Cap de menu : un FRONT, pas un maintien. Un stick tenu vers le haut
       ferait defiler trois cartes avant qu'on ait lache. */
    if (dyPad && !this._menuLatch) this._menuDy = dyPad;
    this._menuLatch = dyPad;
  }

  _dpadX(pad) {
    return (pad.buttons[PAD_DPAD.droite]?.pressed ? 1 : 0)
         - (pad.buttons[PAD_DPAD.gauche]?.pressed ? 1 : 0);
  }

  _dpadY(pad) {
    return (pad.buttons[PAD_DPAD.bas]?.pressed ? 1 : 0)
         - (pad.buttons[PAD_DPAD.haut]?.pressed ? 1 : 0);
  }

  /** Consomme le front d'une action de manette, s'il y en a un. */
  _prendFront(boutons) {
    for (const cle of this._padEdges) {
      const b = Number(cle.split(':')[1]);
      if (boutons.includes(b)) { this._padEdges.delete(cle); return true; }
    }
    return false;
  }

  /** A appeler une fois par image, avant la logique. */
  sample() {
    this._samplePads();

    let mx = 0, my = 0;
    for (const code of this.keys) {
      const m = MOVE_KEYS[code];
      if (m) { mx += m[0]; my += m[1]; }
    }
    if (this.stick.active) { mx += this.stick.dx; my += this.stick.dy; }
    mx += this._padMove.x; my += this._padMove.y;
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    this.move.x = mx; this.move.y = my;

    let f = 0;
    for (const code of this.keys) {
      const k = FOCUS_KEYS[code];
      if (k) f += k;
    }
    this.focusAxis = clamp(f + this._padFocus, -1, 1);

    if (this._prendFront(PAD_BOUTONS.pause)) this.pause = true;
  }

  /** Consomme l'impulsion de molette / glissement accumulee. */
  takeFocusImpulse() {
    const v = this.focusImpulse;
    this.focusImpulse = 0;
    return v;
  }

  /**
   * Navigation des overlays : un cap vertical et une validation, consommes.
   * C'est la SEULE facon de traverser les menus sans souris — donc la seule
   * sur la borne, dont l'encodeur n'a ni souris ni pave numerique.
   */
  takeMenu() {
    const dy = this._menuDy;
    this._menuDy = 0;
    const valider = this._menuValider || this._prendFront(PAD_BOUTONS.valider);
    this._menuValider = false;
    return { dy, valider };
  }

  takeDash() { const v = this.dash; this.dash = false; return v; }
  takePause() { const v = this.pause; this.pause = false; return v; }
  takeMuet() { const v = this.muet; this.muet = false; return v; }
  takePanneauSon() { const v = this.panneauSon; this.panneauSon = false; return v; }
  takeAnyPress() { const v = this.anyPress; this.anyPress = false; return v; }
}
