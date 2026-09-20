/* ---------------------------------------------------------------------------
   Rendu du champ : fond noir, decor, organismes repartis sur huit calques de
   profondeur, halo de contraste de phase, puis composition et masque.
--------------------------------------------------------------------------- */

import { Screen, VIEW, fade32, mix32, rgba, bayer } from '../core/pixel.js';
import { clamp, TAU, hash2 } from '../core/util.js';
import { drawOrganism, drawPlayer, colorOf } from './organisms.js';
import { forEachDecor, sharpness } from '../game/entities.js';
import { UI } from '../data/palette.js';

const HALO = rgba(210, 255, 235, 150);

/** Niveau de flou (0 a 3) pour une nettete donnee. */
function blurLevelOf(sharp) {
  return clamp(Math.round((1 - sharp) * 3), 0, 3);
}

export function renderField(scr, game, pal) {
  const p = game.player;
  const shrink = p.stats.fieldShrink || 1;
  const fieldR = Math.round(VIEW.R * shrink);
  scr.setFieldRadius(fieldR);

  /* Tremblement : uniquement sur la camera, jamais sur le HUD. */
  const sh = game.shake;
  const ox = sh > 0 ? (game.rng() * 2 - 1) * sh * 2.5 : 0;
  const oy = sh > 0 ? (game.rng() * 2 - 1) * sh * 2.5 : 0;
  const camX = p.x + ox, camY = p.y + oy;
  const toX = (wx) => VIEW.CX + (wx - camX);
  const toY = (wy) => VIEW.CY + (wy - camY);

  scr.beginFrame(pal.bg);
  drawHaze(scr, game, pal, fieldR);

  const dof = p.stats.dof;
  const margin = 24;

  /* --- decor : globules gras, a toutes les profondeurs ------------------ */
  forEachDecor(game.matrix, camX, camY, fieldR + margin, game.removedDecor,
    (wx, wy, z, r) => {
      const s = sharpness(z, game.focus, dof);
      const bl = blurLevelOf(s);
      scr.layer(Screen.layerFor(z, bl));
      const a = 0.35 + 0.5 * s;
      if (bl >= 2) {
        scr.ring(toX(wx), toY(wy), r + 1, 1.4, fade32(pal.debrisRim, 0.5 * a));
      }
      scr.disc(toX(wx), toY(wy), r,
        fade32(pal.debris, a), fade32(pal.debrisRim, a));
    });

  /* --- zones ------------------------------------------------------------ */
  for (const z of game.zones) {
    if (!z.alive) continue;
    scr.layer(Screen.layerFor(0.01, 0));
    const t = clamp(z.ttl / z.maxTtl, 0, 1);
    const col = zoneColor(z, pal);
    const sx = toX(z.x), sy = toY(z.y);
    /* Tramage clairseme, sans anneau plein : une zone doit se signaler sans
       masquer ce qu'elle contient. Un contour opaque rendait les organismes
       pris dedans illisibles. */
    const R = Math.ceil(z.r);
    const dense = z.dps ? 0.42 : 0.26;
    for (let yy = -R; yy <= R; yy++) {
      for (let xx = -R; xx <= R; xx++) {
        const d = Math.hypot(xx, yy);
        if (d > z.r) continue;
        const px = (sx + xx) | 0, py = (sy + yy) | 0;
        const edge = d > z.r - 1.2;
        if (bayer(px, py) > (edge ? 0.55 : dense) * t) continue;
        scr.plot(px, py, fade32(col, edge ? 0.55 * t : 0.32 * t));
      }
    }
  }

  /* --- ADN et plasmides ------------------------------------------------- */
  for (const k of game.pickups) {
    if (!k.alive) continue;
    scr.layer(Screen.layerFor(-0.01, 0));
    const pulse = 0.7 + 0.3 * Math.sin(k.phase);
    if (k.kind === 'plasmid') {
      /* Le plasmide est un anneau : c'est ce qu'est un plasmide. */
      scr.ring(toX(k.x), toY(k.y), 3.2, 1.4, fade32(UI.plasmid, pulse));
    } else {
      scr.disc(toX(k.x), toY(k.y), 1.4, fade32(UI.dna, pulse), 0);
      scr.plot(toX(k.x), toY(k.y), UI.dnaGlow);
    }
  }

  /* --- organismes ------------------------------------------------------- */
  const phaseTrace = p.flags.has('phase');
  for (const e of game.enemies) {
    if (!e.alive) continue;
    const sx = toX(e.x), sy = toY(e.y);
    if (sx < -margin || sy < -margin || sx > VIEW.W + margin || sy > VIEW.H + margin) continue;

    const s = sharpness(e.z, game.focus, dof);
    const bl = blurLevelOf(s);
    scr.layer(Screen.layerFor(e.z, bl));

    let [fill, rim] = colorOf(e.spec, pal);
    if (e.ally > 0) { fill = UI.ally; rim = UI.ally; }

    /* Halo de contraste de phase : un objet hors plan brille au lieu de
       s'effacer. C'est ce que fait un objet defocalise, et c'est ce qui rend
       une menace floue lisible. */
    if (bl >= 1) {
      const strength = (bl / 3) * (phaseTrace ? 0.9 : 0.55);
      scr.ring(sx, sy, e.radius + 1.5 + bl, 1.2 + bl * 0.4, fade32(HALO, strength));
    }

    const alpha = phaseTrace ? Math.max(0.5, 0.35 + 0.65 * s) : 0.3 + 0.7 * s;
    drawOrganism(scr, e.spec, sx, sy, e.radius, e.ang, e.phase,
      fade32(fill, alpha), fade32(rim, alpha));

    /* Barre de vie des boss uniquement : le reste se lit a la forme. */
    if (e.spec.boss && e.hp < e.maxHp) {
      const w = 22, frac = clamp(e.hp / e.maxHp, 0, 1);
      scr.layer(Screen.layerFor(-0.02, 0));
      for (let i = 0; i < w; i++) {
        scr.plot(sx - w / 2 + i, sy - e.radius - 5,
          i / w < frac ? UI.damage : rgba(40, 20, 24, 200));
      }
    }
  }

  /* --- projectiles ------------------------------------------------------ */
  for (const b of game.bullets) {
    if (!b.alive) continue;
    const s = b.hostile ? sharpness(b.z, game.focus, dof) : 1;
    scr.layer(Screen.layerFor(b.hostile ? b.z : -0.03, blurLevelOf(s)));
    const col = b.hostile ? UI.hostile : UI.acid;
    scr.disc(toX(b.x), toY(b.y), b.radius, fade32(col, 0.35 + 0.65 * s), 0);
  }

  /* --- particules ------------------------------------------------------- */
  scr.layer(Screen.layerFor(-0.04, 0));
  for (const q of game.particles) {
    if (!q.alive) continue;
    scr.plot(toX(q.x), toY(q.y), fade32(UI.acidRim, clamp(q.ttl * 3, 0, 1)));
  }

  /* --- aura et joueur --------------------------------------------------- */
  scr.layer(Screen.layerFor(-0.05, 0));
  const aura = p.stats.aura;
  if (aura.dps > 0) {
    scr.ring(toX(p.x), toY(p.y), aura.radius, 1.2,
      fade32(UI.acid, 0.18 + 0.08 * Math.sin(p.phase * 4)));
  }
  if (p.shield > 0) {
    scr.ring(toX(p.x), toY(p.y), p.radius + 3.5, 1.6,
      fade32(UI.shield, clamp(p.shield / 60, 0.2, 0.9)));
  }
  if (p.phagocytosedBy) {
    /* Englouti : on ne voit plus que la vacuole de l'hote. */
    scr.ring(toX(p.x), toY(p.y), p.radius + 5, 2, fade32(UI.hostile, 0.8));
  }
  const blink = p.invuln > 0 && Math.floor(p.phase * 12) % 2 === 0;
  if (!blink) {
    drawPlayer(scr, toX(p.x), toY(p.y), p.radius, p.ang, p.phase, UI, p.flagellaCount);
  }

  scr.composite();

  drawEdge(scr, game, pal, fieldR);
  if (game.flash > 0) tintField(scr, fieldR, UI.damage, game.flash * 0.35);
}

function zoneColor(z, pal) {
  switch (z.type) {
    case 'coagulum':
    case 'gel': return UI.gel;
    case 'dextrane': return rgba(150, 132, 86, 255);
    case 'eps': return UI.shield;
    case 'hemolysine':
    case 'llo': return UI.damage;
    default: return pal.edge;
  }
}

/** Voile de fond : un bouillon n'est jamais parfaitement vide. */
function drawHaze(scr, game, pal, fieldR) {
  const t = game.time * 0.35;
  scr.clip = false;
  for (let y = -fieldR; y <= fieldR; y += 2) {
    const w = Math.floor(Math.sqrt(Math.max(0, fieldR * fieldR - y * y)));
    for (let x = -w; x <= w; x += 2) {
      const px = VIEW.CX + x, py = VIEW.CY + y;
      const n = hash2(Math.floor((px + t) * 0.5), Math.floor((py - t * 0.3) * 0.5));
      if (n > 0.86) scr.direct(px, py, fade32(pal.haze, 0.5));
    }
  }
  scr.clip = true;
}

/** Bord du champ : diaphragme du fond noir, plus le menisque de la goutte. */
function drawEdge(scr, game, pal, fieldR) {
  const p = game.player;
  for (let a = 0; a < TAU; a += 0.004) {
    const x = VIEW.CX + Math.cos(a) * fieldR;
    const y = VIEW.CY + Math.sin(a) * fieldR;
    scr.direct(x, y, pal.edge);
    scr.direct(VIEW.CX + Math.cos(a) * (fieldR - 1), VIEW.CY + Math.sin(a) * (fieldR - 1),
      fade32(pal.edge, 0.4));
  }
  /* Approche du menisque : le bord s'allume du cote ou l'on est accule. */
  const d = Math.hypot(p.x, p.y);
  const R = game.matrix.arenaRadius;
  if (d > R - 90) {
    const k = clamp((d - (R - 90)) / 90, 0, 1);
    const dir = Math.atan2(p.y, p.x);
    for (let a = -0.9; a <= 0.9; a += 0.01) {
      const x = VIEW.CX + Math.cos(dir + a) * fieldR;
      const y = VIEW.CY + Math.sin(dir + a) * fieldR;
      const f = k * (1 - Math.abs(a) / 0.9);
      scr.direct(x, y, mix32(pal.edge, UI.textHot, f));
      scr.direct(VIEW.CX + Math.cos(dir + a) * (fieldR - 1),
        VIEW.CY + Math.sin(dir + a) * (fieldR - 1), fade32(UI.textHot, f * 0.5));
    }
  }
}

function tintField(scr, fieldR, color, strength) {
  const k = clamp(strength, 0, 1);
  for (let y = -fieldR; y <= fieldR; y++) {
    const w = Math.floor(Math.sqrt(Math.max(0, fieldR * fieldR - y * y)));
    for (let x = -w; x <= w; x++) {
      const px = VIEW.CX + x, py = VIEW.CY + y;
      if (bayer(px, py) > k) continue;
      scr.direct(px, py, fade32(color, 0.5));
    }
  }
}
