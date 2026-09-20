/* ---------------------------------------------------------------------------
   Point d'entree : boucle principale, cablage entree / jeu / rendu.
--------------------------------------------------------------------------- */

import { Screen, VIEW, computeLayout } from './core/pixel.js';
import { Input } from './core/input.js';
import { Game, STATE } from './game/game.js';
import { renderField } from './render/field.js';
import { renderHud } from './render/hud.js';
import { Overlay } from './ui/overlay.js';
import { MATRICES_PALETTE } from './data/palette.js';
import { forEachDecor } from './game/decor.js';

const canvas = document.getElementById('cv');
const stage = document.getElementById('stage');

/* Le champ doit remplir l'ecran : en portrait il touche le haut, la gauche
   et la droite ; en paysage, le haut et le bas. La taille du tampon interne
   suit donc l'orientation, et le HUD change de colonne avec elle. */
function relayout() {
  const L = computeLayout(innerWidth, innerHeight);
  scr.applyLayout(L);
  stage.style.aspectRatio = `${L.W} / ${L.H}`;
  stage.style.height = `min(100dvh, calc(100vw * ${L.H} / ${L.W}))`;
  stage.style.width = `min(100vw, calc(100dvh * ${L.W} / ${L.H}))`;
}

const scr = new Screen(canvas, computeLayout(innerWidth, innerHeight));
const input = new Input(canvas);
const game = new Game('milk', (Math.random() * 0xffffffff) >>> 0);
game.input = input;
game.showHints = true;

const overlay = new Overlay(game, () => {
  game.start();
  game.input = input;
  game.showHints = true;
  hintsUntil = 8;
  overlay.hideAll();
});

const pal = MATRICES_PALETTE[game.matrix.id];
let last = performance.now();
let hintsUntil = 8;
let prevState = game.state;

function applyPendingDecorClear() {
  if (!game.pendingDecorClear) return;
  const { x, y, radius } = game.pendingDecorClear;
  game.pendingDecorClear = null;
  forEachDecor(game.matrix, x, y, radius, game.removedDecor, game.time,
    (it) => game.removedDecor.add(it.key));
}

function frame(now) {
  /* Pas de temps borne : un onglet en arriere-plan ne doit pas teleporter
     la simulation quand il revient. */
  let dt = (now - last) / 1000;
  last = now;
  dt = Math.min(dt, 1 / 20);

  input.sample();

  if (input.takePause() && game.state === STATE.PLAYING) {
    game.state = STATE.PAUSED;
    overlay.showPause();
  }

  if (game.state === STATE.PLAYING) {
    game.update(dt, input);
    applyPendingDecorClear();
    if (hintsUntil > 0) {
      hintsUntil -= dt;
      game.showHints = hintsUntil > 0;
    }
  }

  /* Transitions d'etat vers l'interface DOM. */
  if (game.state !== prevState) {
    if (game.state === STATE.LEVELUP) overlay.showLevelUp();
    else if (game.state === STATE.DEAD) overlay.showEnd(false);
    else if (game.state === STATE.WON) overlay.showEnd(true);
    prevState = game.state;
  }

  renderField(scr, game, pal);
  renderHud(scr, game, pal);
  scr.present();

  requestAnimationFrame(frame);
}

relayout();
addEventListener('resize', relayout);
addEventListener('orientationchange', () => setTimeout(relayout, 120));

requestAnimationFrame(frame);

/* Accroche de mise au point : inspection depuis la console et tests
   automatises (tools/smoke.mjs). */
window.__game = game;
window.__screen = scr;
window.__view = VIEW;
window.__overlay = overlay;

/* Pause automatique quand l'onglet part : on ne meurt pas hors de l'ecran. */
addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === STATE.PLAYING) {
    game.state = STATE.PAUSED;
    overlay.showPause();
  }
  last = performance.now();
});
