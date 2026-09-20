/* ---------------------------------------------------------------------------
   HUD. Tout vit dans le noir autour du champ : ce noir n'est pas un cache,
   c'est le fond noir du microscope (docs/06-heritage-wet-mount.md).
--------------------------------------------------------------------------- */

import { VIEW, fade32, rgba, mix32 } from '../core/pixel.js';
import { drawText, drawTextRight, drawTextCentered } from '../core/font.js';
import { clamp, mmss, TAU } from '../core/util.js';
import { UI, RARITY_COLOR } from '../data/palette.js';
import { sharpness } from '../game/entities.js';
import { WAYS } from '../data/evolutions.js';

const GAUGE_X = 240;
const GAUGE_TOP = 34;
const GAUGE_BOT = 214;

function bar(scr, x, y, w, h, frac, fg, bg) {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      scr.direct(x + i, y + j, i / w < frac ? fg : bg);
    }
  }
}

export function renderHud(scr, game, pal) {
  const p = game.player;

  /* --- bandeau superieur ------------------------------------------------ */
  drawText(scr, pal.name, 4, 5, UI.textDim);
  drawTextRight(scr, mmss(game.matrix.duration - game.time), VIEW.W - 4, 5,
    game.matrix.duration - game.time < 60 ? UI.textHot : UI.text);

  /* pH : descend avec vos propres tirs, et change la matrice. */
  const ph = game.ph.toFixed(1).replace('.', ',');
  drawTextCentered(scr, `PH ${ph}`, VIEW.CX, 5,
    game.ph < 5.6 ? UI.acid : UI.textDim);

  /* --- jauge de mise au point ------------------------------------------- */
  renderFocusGauge(scr, game);

  /* --- bandeau inferieur ------------------------------------------------ */
  const y0 = 236;
  const hpFrac = clamp(p.hp / p.stats.maxHp, 0, 1);
  drawText(scr, 'PV', 4, y0, UI.textDim);
  bar(scr, 18, y0, 180, 5, hpFrac,
    hpFrac > 0.3 ? UI.heal : UI.damage, rgba(24, 40, 32, 255));
  if (p.shield > 0) {
    bar(scr, 18, y0 + 5, Math.round(180 * clamp(p.shield / 60, 0, 1)), 1, 1,
      UI.shield, rgba(0, 0, 0, 0));
  }
  drawTextRight(scr, String(Math.ceil(p.hp)), VIEW.W - 4, y0, UI.text);

  const xpFrac = clamp(p.dna / xpNeeded(p.level), 0, 1);
  drawText(scr, 'ADN', 4, y0 + 10, UI.textDim);
  bar(scr, 18, y0 + 10, 180, 3, xpFrac, UI.dna, rgba(40, 26, 12, 255));
  drawTextRight(scr, String(p.level), VIEW.W - 4, y0 + 9, UI.dnaGlow);

  /* --- ligne d'etat ------------------------------------------------------ */
  const way = dominantWay(p);
  drawText(scr, `VOIE ${way}`, 4, y0 + 20, UI.textDim);
  drawTextRight(scr, `${p.kills} TUES`, VIEW.W - 4, y0 + 20, UI.textDim);

  /* --- evolutions : une pastille par rang, couleur de rarete ------------- */
  renderEvolutionChips(scr, p, 4, y0 + 30);

  /* --- bandeau d'annonce ------------------------------------------------- */
  if (game.bannerTtl > 0 && game.banner) {
    const a = clamp(game.bannerTtl, 0, 1);
    drawTextCentered(scr, game.banner, VIEW.CX, 100, fade32(UI.textHot, a));
  }

  /* --- boss -------------------------------------------------------------- */
  if (game.boss && game.boss.alive) {
    drawTextCentered(scr, game.boss.spec.label, VIEW.CX, 14, UI.hostile);
  }

  /* --- indications de commande ------------------------------------------- */
  if (game.showHints) {
    const hint = game.input.hasTouch
      ? 'GAUCHE DEPLACER / DROITE MISE AU POINT'
      : 'WASD DEPLACER  MOLETTE OU R-F MISE AU POINT';
    drawTextCentered(scr, hint, VIEW.CX, VIEW.H - 8, UI.textDim);
  }

  if (game.input && game.input.hasTouch) renderTouchControls(scr, game.input);
}

function xpNeeded(level) {
  return 6 + 5 * level + 0.32 * level * level;
}

function dominantWay(p) {
  const counts = {};
  for (const { evo, rank } of p.summary()) {
    if (evo.way === 'neutre' || evo.way === 'optique') continue;
    counts[evo.way] = (counts[evo.way] || 0) + rank;
  }
  let best = null, bestN = 0;
  for (const [k, n] of Object.entries(counts)) if (n > bestN) { bestN = n; best = k; }
  if (!best || bestN < 3) return 'INDIFFERENCIEE';
  return (WAYS[best] || best).toUpperCase();
}

function renderEvolutionChips(scr, p, x0, y0) {
  const items = p.summary();
  let x = x0, y = y0;
  for (const { evo, rank } of items) {
    const col = RARITY_COLOR[evo.rarity] || UI.text;
    for (let i = 0; i < rank; i++) {
      scr.direct(x, y, col);
      scr.direct(x, y + 1, fade32(col, 0.6));
      x += 2;
      if (x > VIEW.W - 6) { x = x0; y += 4; if (y > VIEW.H - 12) return; }
    }
    x += 2;
    if (x > VIEW.W - 6) { x = x0; y += 4; if (y > VIEW.H - 12) return; }
  }
}

/**
 * Jauge de profondeur. C'est l'element de HUD le plus important du jeu :
 * elle montre ou se trouvent les mobs sur l'axe Z, donc ce qui arrive.
 */
function renderFocusGauge(scr, game) {
  const p = game.player;
  const h = GAUGE_BOT - GAUGE_TOP;
  const zToY = (z) => GAUGE_TOP + ((z + 1) / 2) * h;

  /* Graduation */
  for (let y = GAUGE_TOP; y <= GAUGE_BOT; y++) {
    scr.direct(GAUGE_X, y, rgba(20, 36, 28, 255));
  }
  for (let i = 0; i <= 4; i++) {
    const y = GAUGE_TOP + (i / 4) * h;
    scr.direct(GAUGE_X - 2, y, UI.frame);
    scr.direct(GAUGE_X - 1, y, UI.frame);
  }

  /* Bande nette : la profondeur de champ courante. */
  const dof = p.stats.dof;
  const yTop = zToY(clamp(game.focus - dof, -1, 1));
  const yBot = zToY(clamp(game.focus + dof, -1, 1));
  for (let y = Math.round(yTop); y <= Math.round(yBot); y++) {
    scr.direct(GAUGE_X - 1, y, fade32(UI.acidRim, 0.5));
    scr.direct(GAUGE_X + 1, y, fade32(UI.acidRim, 0.5));
  }

  /* Le plan du joueur, toujours a z = 0. */
  const y0 = zToY(0);
  for (let i = -2; i <= 2; i++) scr.direct(GAUGE_X + i, y0, fade32(UI.player, 0.55));

  /* Les mobs, a leur profondeur. Un point plein = dans votre plan. */
  for (const e of game.enemies) {
    if (!e.alive) continue;
    const dx = e.x - p.x, dy = e.y - p.y;
    if (dx * dx + dy * dy > 200 * 200) continue;
    const y = Math.round(zToY(clamp(e.z, -1, 1)));
    const s = sharpness(e.z, game.focus, dof);
    const col = e.ally > 0 ? UI.ally
      : e.spec.boss ? UI.hostile
        : e.spec.kind === 'phage' ? UI.plasmid : UI.textHot;
    scr.direct(GAUGE_X, y, fade32(col, 0.45 + 0.55 * s));
    if (Math.abs(e.z) < 0.18) scr.direct(GAUGE_X + 1, y, fade32(col, 0.8));
  }

  /* Curseur de mise au point. */
  const yf = Math.round(zToY(clamp(game.focus, -1, 1)));
  scr.direct(GAUGE_X - 3, yf, UI.acid);
  scr.direct(GAUGE_X - 4, yf, UI.acid);
  scr.direct(GAUGE_X - 3, yf - 1, fade32(UI.acid, 0.5));
  scr.direct(GAUGE_X - 3, yf + 1, fade32(UI.acid, 0.5));

  drawText(scr, 'Z', GAUGE_X - 2, GAUGE_TOP - 8, UI.textDim);
}

function renderTouchControls(scr, input) {
  if (input.stick.active) {
    const cx = Math.round(input.stick.ox * VIEW.W);
    const cy = Math.round(input.stick.oy * VIEW.H);
    ringDirect(scr, cx, cy, 14, fade32(UI.textDim, 0.5));
    ringDirect(scr, cx + input.stick.dx * 10, cy + input.stick.dy * 10, 4,
      fade32(UI.player, 0.8));
  }
  if (input.focusPad.active) {
    const cy = Math.round(input.focusPad.oy * VIEW.H);
    for (let i = 0; i < 10; i++) scr.direct(VIEW.W - 6 - i, cy, fade32(UI.acid, 0.6));
  }
}

function ringDirect(scr, cx, cy, r, col) {
  for (let a = 0; a < TAU; a += 0.12) {
    scr.direct(cx + Math.cos(a) * r, cy + Math.sin(a) * r, col);
  }
}

export { mix32 };
