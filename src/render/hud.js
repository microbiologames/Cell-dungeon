/* ---------------------------------------------------------------------------
   HUD. Tout vit dans le noir autour du champ : ce noir n'est pas un cache,
   c'est le fond noir du microscope (docs/06-heritage-wet-mount.md).

   Deux dispositions, choisies sur l'orientation de l'ecran :
     portrait -> bande du bas, jauge de profondeur HORIZONTALE
     paysage  -> deux colonnes, jauge de profondeur VERTICALE
--------------------------------------------------------------------------- */

import { VIEW, fade32, rgba } from '../core/pixel.js';
import { drawText, drawTextRight, drawTextCentered, textWidth } from '../core/font.js';
import { clamp, mmss, TAU } from '../core/util.js';
import { UI, RARITY_COLOR } from '../data/palette.js';
import { sharpness } from '../game/entities.js';
import { WAYS } from '../data/evolutions.js';
import { XP_FOR_LEVEL } from '../data/matrices.js';

const BG_BAR = rgba(22, 38, 30, 255);
const BG_BAR_AA = rgba(42, 28, 12, 255);

function bar(scr, x, y, w, h, frac, fg, bg) {
  const cut = Math.round(w * clamp(frac, 0, 1));
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) scr.direct(x + i, y + j, i < cut ? fg : bg);
  }
}

export function renderHud(scr, game, pal) {
  if (VIEW.mode === 'sides') renderSides(scr, game, pal);
  else renderBottom(scr, game, pal);

  if (game.bannerTtl > 0 && game.banner) {
    const a = clamp(game.bannerTtl, 0, 1);
    drawTextCentered(scr, game.banner, VIEW.CX, VIEW.CY - VIEW.R + 26,
      fade32(UI.textHot, a), 1, 2);
  }
  if (game.boss && game.boss.alive) {
    drawTextCentered(scr, game.boss.spec.label, VIEW.CX, VIEW.CY - VIEW.R + 8, UI.hostile, 1, 1);
  }
  if (game.input && game.input.hasTouch) renderTouchControls(scr, game.input);
}

/**
 * Compteur de Nettoyage En Place.
 *
 * C'est la seule menace PROGRAMMEE du jeu : le joueur doit pouvoir la lire
 * sans la chercher, et la ligne du dessous lui dit quoi faire — pas quel
 * produit arrive, mais ce qui le sauve. C'est une consigne, pas une fiche
 * technique.
 *
 * Elle vit dans le noir du pourtour, jamais sur le champ : ecrite en haut du
 * disque, la paroi d'acier de la conduite passait dessus.
 */
function renderNep(scr, game, x, y) {
  const h = game.conduite.hud;
  const col = h.urgence === 2 ? UI.damage : (h.urgence === 1 ? UI.textHot : UI.textDim);
  drawText(scr, h.texte, x, y, col, 1, h.urgence ? 2 : 1);
  drawText(scr, h.sous, x, y + (h.urgence ? 12 : 8), UI.textDim, 1, 1);
}

/* ------------------------------------------------------------- portrait -- */

function renderBottom(scr, game, pal) {
  const p = game.player;
  const W = VIEW.W;
  const barW = 118;

  /* Les lignes sont ancrees EN BAS du canvas, pas sous le disque : sur un
     telephone allonge, le disque reste en haut et les jauges tombent sous
     le pouce, au lieu de flotter au milieu d'une zone noire. */
  const gy = VIEW.H - 12;          // jauge de profondeur
  const ay = VIEW.H - 30;          // acides amines
  const hy = VIEW.H - 46;          // points de vie
  const sy = VIEW.H - 58;          // etat

  drawText(scr, 'PV', 3, hy, UI.textDim, 1, 2);
  const hpFrac = clamp(p.hp / p.stats.maxHp, 0, 1);
  bar(scr, 18, hy + 2, barW, 6, hpFrac, hpFrac > 0.3 ? UI.heal : UI.damage, BG_BAR);
  if (p.shield > 0) bar(scr, 18, hy + 8, Math.round(barW * clamp(p.shield / 60, 0, 1)), 1, 1, UI.shield, BG_BAR);
  drawText(scr, String(Math.ceil(p.hp)), 18 + barW + 4, hy, UI.text, 1, 2);
  const left = game.matrix.duration - game.time;
  drawTextRight(scr, mmss(left), W - 3, hy, left < 60 ? UI.textHot : UI.text, 1, 2);

  drawText(scr, 'AA', 3, ay, UI.textDim, 1, 2);
  bar(scr, 18, ay + 2, barW, 4, clamp(p.aa / XP_FOR_LEVEL(p.level), 0, 1), UI.aa, BG_BAR_AA);
  drawText(scr, String(p.level), 18 + barW + 4, ay, UI.aaGlow, 1, 2);
  drawTextRight(scr, game.ph.toFixed(1).replace('.', ','), W - 3, ay,
    game.ph < 5.6 ? UI.acid : UI.textDim, 1, 2);

  drawText(scr, dominantWay(p), 3, sy, UI.textDim, 1, 1);
  drawTextRight(scr, `${p.kills} TUES`, W - 3, sy, UI.textDim, 1, 1);
  if (game.conduite) renderNep(scr, game, 3, sy - 22);

  gauge(scr, game, { x: 16, y: gy, len: W - 32, vertical: false });

  /* Pastilles d'evolution : juste sous le disque, la ou il reste du noir. */
  const chipTop = VIEW.CY + VIEW.R + 8;
  if (sy - chipTop > 8) chips(scr, p, 3, chipTop, W - 6, sy - 6);
}

/* -------------------------------------------------------------- paysage -- */

function renderSides(scr, game, pal) {
  const p = game.player;
  const colW = VIEW.CX - VIEW.R - 6;
  const lx = 3;
  const rx = VIEW.CX + VIEW.R + 6;

  const left = game.matrix.duration - game.time;
  drawText(scr, mmss(left), lx, 6, left < 60 ? UI.textHot : UI.text, 1, 2);
  drawText(scr, pal.name, lx, 20, UI.textDim, 1, 1);

  const hpFrac = clamp(p.hp / p.stats.maxHp, 0, 1);
  drawText(scr, 'PV', lx, 32, UI.textDim, 1, 1);
  bar(scr, lx, 39, colW, 6, hpFrac, hpFrac > 0.3 ? UI.heal : UI.damage, BG_BAR);
  if (p.shield > 0) bar(scr, lx, 45, Math.round(colW * clamp(p.shield / 60, 0, 1)), 1, 1, UI.shield, BG_BAR);
  drawText(scr, String(Math.ceil(p.hp)), lx, 48, UI.text, 1, 2);

  drawText(scr, 'AA', lx, 64, UI.textDim, 1, 1);
  bar(scr, lx, 71, colW, 4, clamp(p.aa / XP_FOR_LEVEL(p.level), 0, 1), UI.aa, BG_BAR_AA);
  drawText(scr, `N${p.level}`, lx, 78, UI.aaGlow, 1, 2);

  drawText(scr, `PH ${game.ph.toFixed(1).replace('.', ',')}`, lx, 94,
    game.ph < 5.6 ? UI.acid : UI.textDim, 1, 1);
  drawText(scr, `${p.kills} TUES`, lx, 104, UI.textDim, 1, 1);
  drawText(scr, dominantWay(p), lx, 114, UI.textDim, 1, 1);
  let cy = 126;
  if (game.conduite) { renderNep(scr, game, lx, cy); cy += 24; }
  chips(scr, p, lx, cy, colW, VIEW.H - 4);

  /* Jauge de profondeur, verticale, centree dans la colonne de droite */
  gauge(scr, game, {
    x: VIEW.CX + VIEW.R + Math.round(colW / 2) + 3,
    y: 18, len: VIEW.H - 36, vertical: true,
  });
}

/* ---------------------------------------------------------------- pieces - */

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

function chips(scr, p, x0, y0, w, maxY) {
  let x = x0, y = y0;
  for (const { evo, rank } of p.summary()) {
    const col = RARITY_COLOR[evo.rarity] || UI.text;
    for (let i = 0; i < rank; i++) {
      if (x > x0 + w - 3) { x = x0; y += 5; if (y > maxY - 3) return; }
      scr.direct(x, y, col);
      scr.direct(x + 1, y, col);
      scr.direct(x, y + 1, fade32(col, 0.55));
      scr.direct(x + 1, y + 1, fade32(col, 0.55));
      x += 3;
    }
    x += 2;
  }
}

/**
 * Jauge de profondeur. C'est l'element de HUD le plus important du jeu :
 * elle montre ou se trouvent les mobs sur l'axe Z, donc ce qui arrive.
 */
function gauge(scr, game, L) {
  const p = game.player;
  const { x, y, len, vertical } = L;
  const at = (z) => (vertical ? y : x) + ((clamp(z, -1, 1) + 1) / 2) * len;
  const put = (t, off, c) => (vertical ? scr.direct(x + off, t, c) : scr.direct(t, y + off, c));

  for (let i = 0; i <= len; i++) put((vertical ? y : x) + i, 0, rgba(20, 36, 28, 255));
  for (let i = 0; i <= 4; i++) {
    const t = (vertical ? y : x) + (i / 4) * len;
    put(t, -2, UI.frame); put(t, -3, UI.frame);
  }

  /* Bande nette : la profondeur de champ courante. */
  const dof = p.stats.dof;
  const a = at(game.focus - dof), b = at(game.focus + dof);
  for (let t = Math.round(Math.min(a, b)); t <= Math.round(Math.max(a, b)); t++) {
    put(t, 1, fade32(UI.acidRim, 0.5));
    put(t, -1, fade32(UI.acidRim, 0.5));
  }

  /* Le plan du joueur, toujours a z = 0. */
  const z0 = at(0);
  for (let i = -2; i <= 2; i++) put(z0 + i, 0, fade32(UI.player, 0.6));

  /* Les mobs, a leur profondeur. Deux pixels = dans votre plan. */
  for (const e of game.enemies) {
    if (!e.alive) continue;
    const dx = e.x - p.x, dy = e.y - p.y;
    if (dx * dx + dy * dy > 220 * 220) continue;
    const s = sharpness(e.z, game.focus, dof);
    const col = e.ally > 0 ? UI.ally
      : e.spec.boss ? UI.hostile
        : e.spec.kind === 'phage' ? UI.plasmid : UI.textHot;
    const t = Math.round(at(e.z));
    put(t, 0, fade32(col, 0.45 + 0.55 * s));
    if (Math.abs(e.z) < 0.18) put(t, 1, fade32(col, 0.85));
  }

  /* Curseur de mise au point. */
  const f = Math.round(at(game.focus));
  put(f, -3, UI.acid); put(f, -4, UI.acid);
  put(f - 1, -3, fade32(UI.acid, 0.5));
  put(f + 1, -3, fade32(UI.acid, 0.5));

  if (vertical) drawText(scr, 'Z', x - 1, y - 10, UI.textDim, 1, 1);
  else drawText(scr, 'Z', x - 10, y - 2, UI.textDim, 1, 1);
}

function renderTouchControls(scr, input) {
  if (input.stick.active) {
    const cx = Math.round(input.stick.ox * VIEW.W);
    const cy = Math.round(input.stick.oy * VIEW.H);
    ringDirect(scr, cx, cy, 16, fade32(UI.textDim, 0.5));
    ringDirect(scr, cx + input.stick.dx * 11, cy + input.stick.dy * 11, 5, fade32(UI.player, 0.85));
  }
  if (input.focusPad.active) {
    const cy = Math.round(input.focusPad.oy * VIEW.H);
    for (let i = 0; i < 12; i++) scr.direct(VIEW.W - 5 - i, cy, fade32(UI.acid, 0.6));
  }
}

function ringDirect(scr, cx, cy, r, col) {
  for (let a = 0; a < TAU; a += 0.1) {
    scr.direct(cx + Math.cos(a) * r, cy + Math.sin(a) * r, col);
  }
}

export { textWidth };
