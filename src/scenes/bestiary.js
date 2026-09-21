/* ---------------------------------------------------------------------------
   Bestiaire vivant.

   Fond noir, et chaque espece derive sur place avec SA motilite : le
   lactocoque ne fait que trembler, l'Escherichia file en ligne brisee, la
   Listeria culbute. C'est deja la moitie de l'information.

   En s'approchant, l'espece se detache et ses caracteristiques s'affichent.
   Le fondement microbiologique, trop long pour la fonte 3x5, passe par un
   panneau HTML — meme partage que les cartes d'evolution.

   Les tailles sont RELATIVES et honnetes entre elles : un lactocoque est
   vraiment plus petit qu'une levure. Seul le facteur global est grossi,
   sinon la moitie des especes serait invisible.
--------------------------------------------------------------------------- */

import { VIEW, Screen, fade32, rgba } from '../core/pixel.js';
import { drawTextCentered } from '../core/font.js';
import { sceneText } from './hud-anchor.js';
import { clamp, TAU, hash2 } from '../core/util.js';
import { UI, MATRICES_PALETTE } from '../data/palette.js';
import { BESTIARY } from '../data/bestiary.js';
import { drawOrganism, drawPlayer, colorOf } from '../render/organisms.js';
import { Swimmer } from './swimmer.js';

const COLS = 5;
const STEP = 92;
const ZOOM = 2.2;
const MAX_R = 15;

export class Bestiary {
  constructor(onExit) {
    this.onExit = onExit;
    this.time = 0;
    this.focus = null;
    this.pal = MATRICES_PALETTE.pipe;   // fond noir, organismes lumineux

    const ids = Object.keys(BESTIARY);
    const rows = Math.ceil(ids.length / COLS);
    this.entries = ids.map((id, i) => {
      const spec = BESTIARY[id];
      const col = i % COLS, row = Math.floor(i / COLS);
      return {
        spec,
        x: (col - (COLS - 1) / 2) * STEP,
        y: (row - (rows - 1) / 2) * STEP,
        ph: hash2(i, 11) * TAU,
        ang: hash2(i, 5) * TAU,
        jx: 0, jy: 0, tmr: 0, heading: hash2(i, 9) * TAU,
      };
    });
    this.bounds = {
      hw: ((COLS - 1) / 2) * STEP + 70,
      hh: ((rows - 1) / 2) * STEP + 70,
    };
    /* On entre par le bas, sous la premiere rangee. */
    this.swim = new Swimmer(0, -this.bounds.hh + 30);
  }

  update(dt, input) {
    this.time += dt;
    this.swim.update(dt, input.move, this.bounds);

    for (const e of this.entries) {
      /* Chaque espece bouge selon SA motilite, sur place. */
      const amp = 9 / Math.sqrt(Math.max(e.spec.radius, 0.7));
      switch (e.spec.mot) {
        case 'swim':
          e.tmr -= dt;
          if (e.tmr <= 0) { e.heading += (Math.random() - 0.5) * 2.6; e.tmr = 0.4 + Math.random(); }
          e.jx += Math.cos(e.heading) * dt * 26;
          e.jy += Math.sin(e.heading) * dt * 26;
          e.ang = e.heading;
          break;
        case 'tumble':
          e.tmr -= dt;
          if (e.tmr <= 0) { e.heading = Math.random() * TAU; e.tmr = 0.18 + Math.random() * 0.4; }
          e.jx += Math.cos(e.heading) * dt * 30;
          e.jy += Math.sin(e.heading) * dt * 30;
          e.ang += dt * 7;
          break;
        case 'none':
          break;
        default:
          e.jx += (Math.random() * 2 - 1) * amp * dt * 2.4;
          e.jy += (Math.random() * 2 - 1) * amp * dt * 2.4;
          e.ang += (Math.random() - 0.5) * dt;
      }
      /* Rappel elastique : chacun reste sur son emplacement. */
      e.jx -= e.jx * dt * 1.8;
      e.jy -= e.jy * dt * 1.8;
      const d = Math.hypot(e.jx, e.jy);
      if (d > 20) { e.jx *= 20 / d; e.jy *= 20 / d; }
      e.ph += dt * 1.6;
    }

    let best = null, bd = 52;
    for (const e of this.entries) {
      const d = Math.hypot(this.swim.x - (e.x + e.jx), this.swim.y - (e.y + e.jy));
      if (d < bd) { bd = d; best = e; }
    }
    this.focus = best;

    if (input.takePause && input.takePause()) this.onExit();
  }

  /**
   * Ce que le panneau HTML doit afficher, ou null.
   *
   * Les caracteristiques y descendent AUSSI : dessinees sur le canvas,
   * elles percutaient le panneau en portrait. Un seul bloc, lisible.
   */
  get info() {
    if (!this.focus) return null;
    const s = this.focus.spec;
    const stats = [
      ['ROLE', String(s.role || '-').toUpperCase()],
      ['PV', Math.round(s.hp)],
      ['VITESSE', Math.round(s.speed)],
      ['CONTACT', Math.round(s.contact)],
      ['AA', Math.round(s.aa)],
      ['GRAM', s.gram === 'fungi' ? 'CHAMPIGNON' : (s.gram || '-')],
      ['FORME', String(s.kind).toUpperCase()],
      ['MOTILITE', String(s.mot).toUpperCase()],
    ];
    if (s.resist) stats.push(['RESIST', `${Math.round(s.resist * 100)} %`]);
    if (s.ability) stats.push(['CAPACITE', String(s.ability).toUpperCase()]);
    return { id: s.id, label: s.label, note: s.note || '', stats };
  }

  render(scr) {
    const camX = this.swim.x, camY = this.swim.y;
    const toX = (x) => VIEW.CX + (x - camX);
    const toY = (y) => VIEW.CY + (y - camY);
    const fieldR = VIEW.R;
    scr.setFieldRadius(fieldR);
    const pal = this.pal;

    scr.beginFrame(0xff000000);

    /* Poussiere de fond, pour que le noir ne soit pas plat. */
    scr.layer(Screen.layerFor(0.6, 2));
    for (let i = 0; i < 40; i++) {
      const a = hash2(i, 21) * TAU;
      const rr = 30 + hash2(i, 33) * 400;
      scr.disc(toX(Math.cos(a) * rr), toY(Math.sin(a) * rr), 1,
        fade32(pal.neutralRim, 0.5), 0);
    }

    for (const e of this.entries) {
      const sx = toX(e.x + e.jx), sy = toY(e.y + e.jy);
      if (sx < -40 || sy < -40 || sx > VIEW.W + 40 || sy > VIEW.H + 40) continue;
      const actif = this.focus === e;
      const r = Math.min(MAX_R, e.spec.radius * ZOOM);

      /* Socle : un anneau discret, vif quand on est dessus. */
      scr.layer(Screen.layerFor(0.3, 1));
      scr.ring(sx, sy, 26, 1, fade32(actif ? UI.textHot : pal.neutralRim, actif ? 0.9 : 0.35));

      scr.layer(Screen.layerFor(0.02, 0));
      const [fill, rim] = colorOf(e.spec, pal);
      /* Dans le bestiaire, chaque espece nage pour elle-meme : on force un
         effort de nage moyen pour que la flagellation batte visiblement. */
      drawOrganism(scr, e.spec, sx, sy, r, e.ang, e.ph, fill, rim,
        { pal, drive: e.spec.mot === 'none' ? 0 : 0.7 });
    }

    scr.layer(Screen.layerFor(-0.1, 0));
    drawPlayer(scr, toX(this.swim.x), toY(this.swim.y), this.swim.radius,
      this.swim.ang, this.swim.phase, pal, { count: 2, mode: 'bundle' },
      { drive: this.swim.drive, bend: 0, lean: this.swim.lean,
        sillage: this.swim.sillage, trouble: this.swim.trouble });

    scr.composite();

    /* Etiquettes par-dessus, jamais floutees. */
    for (const e of this.entries) {
      const sx = toX(e.x + e.jx), sy = toY(e.y + e.jy);
      if (sx < 0 || sy < 0 || sx > VIEW.W || sy > VIEW.H) continue;
      const actif = this.focus === e;
      const dd = Math.hypot(sx - VIEW.CX, sy - VIEW.CY);
      if (dd > fieldR - 12) continue;
      drawTextCentered(scr, e.spec.label, sx, sy + 30,
        actif ? UI.textHot : fade32(UI.textDim, 0.85), 1, actif ? 2 : 1);
    }

    this.drawRim(scr, fieldR);
    this.drawHud(scr);
  }

  drawRim(scr, r) {
    for (let a = 0; a < TAU; a += 0.004) {
      scr.direct(VIEW.CX + Math.cos(a) * r, VIEW.CY + Math.sin(a) * r, UI.frame);
    }
  }

  drawHud(scr) {
    const t = sceneText(scr);
    t.ligne('BESTIAIRE', UI.text, 2).saut(3);
    if (this.focus) {
      t.ligne(this.focus.spec.label, UI.textHot, 2);
      t.ligne('ECHAP POUR SORTIR', UI.textDim, 1);
    } else {
      t.ligne('APPROCHE UNE ESPECE', UI.textDim, 1);
      t.ligne('ECHAP POUR SORTIR', UI.textDim, 1);
    }
  }
}
