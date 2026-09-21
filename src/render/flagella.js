/* ---------------------------------------------------------------------------
   Flagelles.

   Un flagelle bacterien n'est pas un trait qui vibre : c'est une helice
   rigide entrainee par un moteur rotatif ancre dans la membrane. Vu de cote,
   l'helice se projette en une ONDE QUI SE PROPAGE de la base vers la pointe.
   Trois consequences qu'on rend ici :

     1. ANCRAGE. Le flagelle part d'un point precis de la PAROI, pas du centre
        de la cellule, et il part droit : le crochet proximal est rigide.
        L'amplitude de l'onde monte donc depuis zero sur le premier quart.

     2. SOLIDARITE. Tout est calcule dans le repere de la cellule puis tourne
        avec elle. Si le corps pivote, l'ancrage et l'onde pivotent avec lui,
        sans glissement.

     3. REGIME. La frequence et l'amplitude suivent l'effort de nage. Une
        cellule a l'arret laisse trainer ses flagelles ; une cellule qui
        pousse bat vite et large.

   La disposition est un marqueur taxonomique reel, pas une decoration :
   monotriche polaire (Pseudomonas), peritriche (E. coli, Bacillus, Listeria),
   lophotriche (touffe polaire). Les peritriches se rassemblent en FAISCEAU
   pendant une course et se separent pendant une culbute — c'est le mecanisme
   du run and tumble, et il se voit.
--------------------------------------------------------------------------- */

import { TAU, clamp, angDelta, hash2 } from '../core/util.js';

/**
 * Sillage : la memoire de cap d'une cellule.
 *
 * A tres bas nombre de Reynolds, un filament passif tracte ne fait pas ce
 * qu'il veut : il SUIT LE CHEMIN DE SA BASE. Les forces visqueuses dominent
 * tellement l'inertie que chaque troncon se range dans la trace laissee par
 * le troncon precedent. Un flagelle est donc, litteralement, l'historique
 * recent de l'orientation de la cellule — exactement comme la queue d'un
 * serpent repasse la ou est passee sa tete.
 *
 * On garde donc quelques dixiemes de seconde de cap, en valeur DEROULEE
 * (jamais ramenee dans [-PI, PI]) pour que l'interpolation entre deux
 * instants ne fasse pas le tour du cadran.
 */
export class Sillage {
  constructor(n = 30, pas = 1 / 60) {
    this.buf = new Float32Array(n);
    this.n = n;
    this.pas = pas;
    this.i = 0;
    this.acc = 0;
    this.cont = 0;
    this.amorce = false;
  }

  /** A appeler une fois par pas de simulation. */
  pousser(ang, dt) {
    this.cont += angDelta(this.cont, ang);
    if (!this.amorce) { this.buf.fill(this.cont); this.amorce = true; return; }
    this.acc += dt;
    /* Pas fixe : sinon la longueur de memoire depend de la frequence
       d'affichage, et le flagelle traine plus sur un ecran lent. */
    let garde = 0;
    while (this.acc >= this.pas && garde++ < this.n) {
      this.acc -= this.pas;
      this.i = (this.i + 1) % this.n;
      this.buf[this.i] = this.cont;
    }
  }

  /** Cap qu'avait la cellule il y a `retard` secondes. */
  cap(retard) {
    const f = clamp(retard / this.pas, 0, this.n - 1);
    const a = Math.floor(f);
    const b = Math.min(a + 1, this.n - 1);
    const t = f - a;
    const ia = (this.i - a + this.n * 2) % this.n;
    const ib = (this.i - b + this.n * 2) % this.n;
    return this.buf[ia] + (this.buf[ib] - this.buf[ia]) * t;
  }
}

/** Duree de memoire utilisee par la pointe du filament, en secondes. */
const RETARD = 0.24;

/**
 * Trait d'un pixel de large entre deux points.
 *
 * Echantillonner la courbe et poser un point par echantillon ne suffit pas :
 * la ou l'onde est raide, le decalage lateral depasse un pixel entre deux
 * echantillons et le filament se CASSE en pointilles. Il faut relier.
 */
function trait(scr, x0, y0, x1, y1, col) {
  let x = Math.round(x0), y = Math.round(y0);
  const xf = Math.round(x1), yf = Math.round(y1);
  const dx = Math.abs(xf - x), dy = -Math.abs(yf - y);
  const sx = x < xf ? 1 : -1, sy = y < yf ? 1 : -1;
  let err = dx + dy;
  for (let garde = 0; garde < 64; garde++) {
    scr.plot(x, y, col);
    if (x === xf && y === yf) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

/* Le filament est trace point par point, a un pas inferieur au pixel : un
   flagelle fait 10 a 20 nm d'epaisseur pour une cellule de 1 um, c'est un
   CHEVEU. Le dessiner en segments epais donnait une pelote, et les segments
   qui se recouvrent aux jointures faisaient des perles. */
const PAS_PX = 0.62;

/**
 * Dessine la flagellation d'une cellule.
 *
 * Tout est en repere cellule (x vers l'avant, y vers la gauche) puis tourne
 * de `ang` : c'est ce qui garantit que l'ancrage suit le corps.
 *
 * @param {object} o
 * @param {number} o.x @param {number} o.y   centre de la cellule, en pixels
 * @param {number} o.ang                     cap de la cellule
 * @param {number} o.hw @param {number} o.hh demi-longueur et demi-largeur du corps
 * @param {number} o.count                   nombre de filaments
 * @param {string} o.mode 'polaire' | 'peritriche' | 'bundle'
 * @param {number} o.phase                   temps d'animation
 * @param {number} o.drive                   effort de nage, 0 a 1
 * @param {number} o.splay                   dispersion du faisceau, 0 a 1
 * @param {number} o.len                     longueur du filament, en pixels
 * @param {number} o.col                     couleur
 */
export function drawFlagella(scr, o) {
  const n = Math.min(o.count | 0, 10);
  if (n <= 0) return;
  const { hw, hh } = o;
  const drive = clamp(o.drive ?? 0.5, 0, 1);
  const splay = clamp(o.splay ?? 0, 0, 1);
  const ca = Math.cos(o.ang), sa = Math.sin(o.ang);
  const len = o.len ?? hw * 3.2;
  const col = o.col;
  const w = o.width ?? 1;

  /* Une cellule qui pousse bat vite ; a l'arret, le moteur s'ARRETE et le
     filament ne fait plus que retomber. Un battement residuel a l'arret
     donnait a la cellule immobile l'air de pedaler dans le vide. */
  const omega = 1.4 + 32 * drive;
  /* Desordre : juste apres un arret brutal ou un virage sec, les filaments
     n'ont pas encore repris un battement commun. Ils se dephasent et le
     faisceau s'ouvre, puis tout se recale. */
  const trouble = clamp(o.trouble ?? 0, 0, 1);
  const ouvre = clamp(splay + trouble, 0, 1);
  /* Amplitude tres contenue : mesure a hh x 2, six flagelles peritriches
     formaient une pelote ou la direction de nage n'etait plus lisible. */
  /* Une amplitude residuelle meme a l'arret : un filament au repos est
     MOU, il retombe en courbe. A amplitude quasi nulle il sortait comme un
     trait rigide, ce qui est le contraire de l'effet voulu. C'est la
     FREQUENCE, pas l'amplitude, qui dit si le moteur tourne. */
  const amp = hh * (0.30 + 0.30 * drive + 0.34 * trouble);
  /* Le faisceau peritriche se resserre quand on nage droit et s'ouvre
     quand on culbute : c'est le run and tumble, dessine. */
  /* Peu d'ondes sur un long filament : a cette resolution, une sinusoide
     de 5 px de periode se lit comme un escalier, pas comme une helice. Il
     faut que la courbe change lentement pour se lire. */
  const ondes = 1.15 + 0.45 * drive;
  /* A l'arret, le filament traine et se raccourcit apparemment : il n'est
     plus tendu par la propulsion. */
  const lon = len * (0.66 + 0.34 * drive);
  const nPas = Math.max(8, Math.ceil(lon / PAS_PX));
  const pasLong = lon / nPas;

  const sillage = o.sillage;
  const capActuel = sillage ? sillage.cap(0) : 0;

  for (let i = 0; i < n; i++) {
    /* --- ancrage, en repere cellule ---------------------------------- */
    let bx, by, dx, dy, dephase;   // eslint-disable-line prefer-const
    if (o.mode === 'peritriche') {
      /* Repartis sur tout le pourtour : c'est ce que veut dire peritriche.
         L'ancrage est sur l'ELLIPSE du corps, la direction est la normale
         sortante — un flagelle ne sort pas du cytoplasme. */
      const a = ((i + 0.5) / n) * TAU;
      bx = Math.cos(a) * hw; by = Math.sin(a) * hh;
      /* Normale a l'ellipse, pas rayon : sur un bacille allonge les deux
         different beaucoup et un flagelle radial sort de travers. */
      let nx = Math.cos(a) / hw, ny = Math.sin(a) / hh;
      const nn = Math.hypot(nx, ny) || 1;
      nx /= nn; ny /= nn;
      /* Pendant une COURSE, les flagelles peritriches se rassemblent en un
         faisceau unique derriere la cellule ; pendant une CULBUTE, ils se
         separent. C'est le mecanisme du run and tumble, et c'est de loin ce
         qui se lit le mieux : six filaments independants font une pelote,
         un faisceau fait une helice.

         On rabat donc les directions vers l'arriere ET on remet les phases
         en commun : les filaments se superposent au lieu de se croiser. */
      /* Meme disperses, les filaments restent DERRIERE : mesure a k = 0.55,
         six flagelles peritriches d'une cellule a l'arret rayonnaient tout
         autour et dessinaient un anneau parfait autour du corps. Une
         bacterie n'a pas d'aureole. */
      const k = 0.74 + 0.23 * (1 - ouvre);
      dx = nx * (1 - k) - k; dy = ny * (1 - k);
      /* Pendant une course, les ancrages eux-memes se RASSEMBLENT vers le
         pole arriere : un faisceau peritriche n'est pas six filaments qui
         pointent dans le meme sens, c'est six filaments qui se rejoignent.
         Sans ca, la course sortait comme une touffe et pas comme une corde. */
      const rassemble = (1 - ouvre) * 0.78;
      bx += (-hw * 0.9 - bx) * rassemble;
      by += (0 - by) * rassemble;
      dephase = i * 0.9 * ouvre + hash2(i, 17) * TAU * trouble;
    } else if (o.mode === 'polaire') {
      /* Monotriche ou lophotriche : un seul pole, faisceau serre. */
      const ec = n === 1 ? 0 : (i - (n - 1) / 2) * 0.18;
      bx = -hw; by = Math.sin(ec) * hh * 0.7;
      dx = -Math.cos(ec); dy = Math.sin(ec);
      dephase = i * 0.5 + hash2(i, 17) * TAU * trouble;
    } else {
      /* Faisceau arriere ouvert. */
      const ec = n === 1 ? 0 : (i - (n - 1) / 2) * (0.10 + 0.42 * ouvre);
      bx = -hw * 0.92; by = Math.sin(ec) * hh;
      dx = -Math.cos(ec); dy = Math.sin(ec);
      dephase = i * 0.7 * ouvre + hash2(i, 17) * TAU * trouble;
    }
    const dn = Math.hypot(dx, dy) || 1;
    dx /= dn; dy /= dn;
    /* --- l'onde, integree le long du sillage ------------------------- */
    /* On n'avance pas en ligne droite depuis l'ancrage : a chaque pas, la
       direction est celle qu'avait la cellule il y a `t x RETARD` secondes.
       Le filament trace donc le chemin de sa base — quand la cellule vire,
       la queue suit avec un temps de retard, comme celle d'un serpent. */
    let ox = null, oy = null;
    let lx = bx, ly = by;
    for (let k = 0; k <= nPas; k++) {
      const t = k / nPas;
      const dA = sillage ? sillage.cap(t * RETARD) - capActuel : 0;
      const cA = Math.cos(dA), sA = Math.sin(dA);
      const ddx = dx * cA - dy * sA, ddy = dx * sA + dy * cA;
      if (k > 0) { lx += ddx * pasLong; ly += ddy * pasLong; }
      /* Perpendiculaire a la direction LOCALE : l'helice se projette dans
         ce plan-la, pas dans celui de l'ancrage. */
      const nx2 = -ddy, ny2 = ddx;
      /* Le crochet proximal est rigide : l'amplitude monte depuis zero.
         Sans ca le flagelle a l'air decroche de la cellule. */
      const rampe = Math.min(1, t / 0.28);
      const onde = Math.sin(t * ondes * TAU - o.phase * omega + dephase)
        * amp * rampe;
      const fx = lx + nx2 * onde, fy = ly + ny2 * onde;
      /* Repere cellule -> ecran. */
      const sx = o.x + fx * ca - fy * sa;
      const sy = o.y + fx * sa + fy * ca;
      if (ox !== null) trait(scr, ox, oy, sx, sy, col);
      else scr.plot(sx, sy, col);
      ox = sx; oy = sy;
    }
  }
}

/**
 * Effort de nage d'un mob, de 0 a 1.
 *
 * Ce n'est pas sa vitesse absolue : un Pseudomonas lent pour lui-meme doit
 * battre aussi fort qu'un coliforme lance. On normalise donc par la vitesse
 * propre de l'espece.
 */
export function driveOf(e) {
  const vmax = Math.max(1, e.speed || e.spec.speed || 1);
  return clamp(Math.hypot(e.vx || 0, e.vy || 0) / vmax, 0, 1);
}
