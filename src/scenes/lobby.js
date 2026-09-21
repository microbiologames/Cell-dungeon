/* ---------------------------------------------------------------------------
   Lobby : une boite de Petri vue au microscope.

   Le joueur y nage librement. Chaque matrice est un PUITS — un disque rempli
   de son propre milieu, ou derivent deux ou trois de ses organismes. On
   choisit son stage en nageant dedans ; il n'y a pas de menu. Un puits de
   plus mene au bestiaire.

   Le puits montre donc litteralement ce dans quoi on va tomber : c'est plus
   parlant qu'une liste, et ca reutilise tout le moteur de rendu.
--------------------------------------------------------------------------- */

import { VIEW, Screen, fade32, rgba } from '../core/pixel.js';
import { drawTextCentered, drawText } from '../core/font.js';
import { sceneText } from './hud-anchor.js';
import { clamp, TAU, hash2 } from '../core/util.js';
import { UI, MATRICES_PALETTE } from '../data/palette.js';
import { MATRICES } from '../data/matrices.js';
import { BESTIARY } from '../data/bestiary.js';
import { drawOrganism, drawPlayer, colorOf } from '../render/organisms.js';
import { Swimmer } from './swimmer.js';

const WELL_R = 24;
const BOUNDS = { r: 92 };

/* Disposition des puits, en coordonnees monde. Tout doit TENIR dans le
   champ d'un coup : un ecran de selection ou il faut se promener pour
   decouvrir les options est un mauvais ecran de selection. La camera est
   donc FIXE a l'origine, contrairement au jeu. */
const SLOTS = [
  { id: 'milk', x: -58, y: -44 },
  { id: 'pipe', x: 58, y: -44 },
  { id: 'kombucha', x: -58, y: 48 },
  { id: 'blood', x: 58, y: 48 },
  { id: 'bestiaire', x: 0, y: 2, r: 18 },
];

export class Lobby {
  constructor(onPick) {
    this.onPick = onPick;
    this.swim = new Swimmer(0, -76);
    this.time = 0;
    this.focus = null;
    this.enterHold = 0;
    this.wells = SLOTS.map((s) => {
      if (s.id === 'bestiaire') return { ...s, r: s.r || WELL_R, kind: 'bestiaire' };
      const mat = MATRICES[s.id];
      const pal = MATRICES_PALETTE[s.id];
      return {
        ...s, r: WELL_R, kind: 'matrice', mat, pal,
        playable: !!(mat && mat.playable),
        label: pal.name,
        sub: mat ? mat.subtitle : 'A VENIR',
        /* Trois habitants qui derivent dans le puits, pour montrer le milieu. */
        preview: (mat && mat.pool ? mat.pool : []).slice(0, 3).map((spec, i) => ({
          spec, ph: i * 2.1 + hash2(i, s.x) * TAU, rad: 10 + i * 6,
        })),
      };
    });
  }

  update(dt, input) {
    this.time += dt;
    this.swim.update(dt, input.move, BOUNDS);

    /* Puits le plus proche, s'il est assez pres. */
    let best = null, bd = Infinity;
    for (const w of this.wells) {
      const d = Math.hypot(this.swim.x - w.x, this.swim.y - w.y);
      if (d < w.r + 14 && d < bd) { bd = d; best = w; }
    }
    this.focus = best;

    /* On entre en RESTANT dedans : pas de touche a trouver, et pas
       d'entree accidentelle en passant. */
    if (best && bd < best.r * 0.72 && (best.kind === 'bestiaire' || best.playable)) {
      this.enterHold += dt;
      if (this.enterHold > 0.65) {
        this.enterHold = 0;
        this.onPick(best.kind === 'bestiaire' ? { bestiaire: true } : { matrice: best.id });
      }
    } else {
      this.enterHold = Math.max(0, this.enterHold - dt * 2);
    }
  }

  render(scr) {
    /* Camera fixe : la boite de Petri entiere reste visible. */
    const camX = 0, camY = 0;
    const toX = (x) => VIEW.CX + (x - camX);
    const toY = (y) => VIEW.CY + (y - camY);
    const fieldR = VIEW.R;
    scr.setFieldRadius(fieldR);

    scr.beginFrame(0xff000000);
    /* L'agar : pale, legerement chaud. */
    fillDisc(scr, VIEW.CX, VIEW.CY, fieldR, rgba(222, 219, 203, 255));

    scr.layer(Screen.layerFor(0.5, 1));
    /* Stries de la gelose, pour que le fond ne soit pas mort. */
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * TAU + Math.sin(this.time * 0.05 + i) * 0.04;
      const rr = 26 + hash2(i, 7) * 64;
      scr.disc(toX(Math.cos(a) * rr), toY(Math.sin(a) * rr),
        1 + hash2(i, 3) * 1.6, rgba(198, 194, 174, 200), 0);
    }

    for (const w of this.wells) this.drawWell(scr, w, toX, toY);

    scr.layer(Screen.layerFor(-0.1, 0));
    drawPlayer(scr, toX(this.swim.x), toY(this.swim.y), this.swim.radius,
      this.swim.ang, this.swim.phase, MATRICES_PALETTE.milk, { count: 2, mode: 'bundle' },
      { drive: this.swim.drive, bend: 0, lean: this.swim.lean,
        sillage: this.swim.sillage, trouble: this.swim.trouble });

    scr.composite();
    drawRim(scr, fieldR, rgba(150, 146, 128, 255));
    this.drawHud(scr);
  }

  drawWell(scr, w, toX, toY) {
    const sx = toX(w.x), sy = toY(w.y);
    if (sx < -60 || sy < -60 || sx > VIEW.W + 60 || sy > VIEW.H + 60) return;
    const actif = this.focus === w;
    const dispo = w.kind === 'bestiaire' || w.playable;

    scr.layer(Screen.layerFor(0.2, 0));
    /* Le milieu du puits : on voit dans quoi on va tomber. */
    const fond = w.kind === 'bestiaire' ? rgba(6, 8, 12, 255) : w.pal.bg;
    scr.disc(sx, sy, w.r, dispo ? fond : fade32(fond, 0.45), 0);

    if (w.kind === 'matrice' && dispo) {
      scr.layer(Screen.layerFor(0.1, 0));
      for (const p of w.preview) {
        const a = p.ph + this.time * 0.5;
        const px = sx + Math.cos(a) * p.rad;
        const py = sy + Math.sin(a * 1.3) * p.rad * 0.7;
        const [fill, rim] = colorOf(p.spec, w.pal);
        drawOrganism(scr, p.spec, px, py, Math.min(p.spec.radius, 5), a, this.time,
          fill, rim, { pal: w.pal, drive: 0.6 });
      }
    }
    if (w.kind === 'bestiaire') {
      scr.layer(Screen.layerFor(0.1, 0));
      for (let i = 0; i < 5; i++) {
        const a = i * 1.257 + this.time * 0.35;
        scr.disc(sx + Math.cos(a) * 12, sy + Math.sin(a) * 12, 1.6,
          fade32(UI.textHot, 0.8), 0);
      }
    }

    scr.layer(Screen.layerFor(-0.05, 0));
    const anneau = dispo ? (actif ? UI.textHot : rgba(150, 146, 128, 255))
      : rgba(150, 146, 128, 140);
    scr.ring(sx, sy, w.r + 1.5, actif ? 2 : 1.2, anneau);

    /* Anneau de progression : il se remplit tant qu'on reste dedans. */
    if (actif && this.enterHold > 0) {
      const frac = clamp(this.enterHold / 0.65, 0, 1);
      for (let a = -Math.PI / 2; a < -Math.PI / 2 + frac * TAU; a += 0.06) {
        scr.disc(sx + Math.cos(a) * (w.r + 4), sy + Math.sin(a) * (w.r + 4), 1.1, UI.textHot, 0);
      }
    }
  }

  drawHud(scr) {
    const t = sceneText(scr);
    t.ligne('CELL DUNGEON', UI.text, 2).saut(3);
    if (this.focus) {
      const w = this.focus;
      const bestiaire = w.kind === 'bestiaire';
      t.ligne(bestiaire ? 'BESTIAIRE' : w.label, UI.textHot, 2);
      t.ligne(bestiaire ? 'OBSERVER LA FLORE' : (w.playable ? w.sub : 'MATRICE A VENIR'),
        UI.textDim, 1);
      if (!bestiaire && !w.playable) t.ligne('PAS ENCORE JOUABLE', UI.textDim, 1);
      else t.ligne('RESTE DEDANS POUR ENTRER', UI.textDim, 1);
    } else {
      t.ligne('NAGE VERS UN PUITS', UI.textDim, 1);
    }
  }
}

/* --- petits utilitaires de dessin direct -------------------------------- */

function fillDisc(scr, cx, cy, r, col) {
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(Math.max(0, r * r - y * y)));
    for (let x = -w; x <= w; x++) scr.direct(cx + x, cy + y, col);
  }
}

function drawRim(scr, r, col) {
  for (let a = 0; a < TAU; a += 0.004) {
    scr.direct(VIEW.CX + Math.cos(a) * r, VIEW.CY + Math.sin(a) * r, col);
  }
}

export { fillDisc, drawRim };
