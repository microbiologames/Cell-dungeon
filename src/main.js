/* ---------------------------------------------------------------------------
   Point d'entree : scenes, boucle principale, cablage entree / jeu / rendu.

   Trois scenes partagent le meme ecran et le meme moteur de rendu :
     lobby      une boite de Petri ou l'on choisit sa matrice en y nageant
     bestiaire  la flore en vitrine, fond noir
     jeu        une matrice en cours
--------------------------------------------------------------------------- */

import { Screen, VIEW, computeLayout } from './core/pixel.js';
import { Input } from './core/input.js';
import { Game, STATE } from './game/game.js';
import { renderField } from './render/field.js';
import { renderHud } from './render/hud.js';
import { Overlay } from './ui/overlay.js';
import { MATRICES_PALETTE } from './data/palette.js';
import { forEachDecor } from './game/decor.js';
import { Lobby } from './scenes/lobby.js';
import { ESPECE_DEFAUT } from './data/especes.js';
import { Bestiary } from './scenes/bestiary.js';
/* Active les sprites adoptes. Le registre ne contient que ceux-la ; toute
   espece absente garde sa forme procedurale et son animation. */
import './render/sprite-data.js';
import { son } from './audio/son.js';
import { drawText } from './core/font.js';
import { UI } from './data/palette.js';
import { clamp } from './core/util.js';

const canvas = document.getElementById('cv');
const stage = document.getElementById('stage');
const panel = document.getElementById('specPanel');

const SCENE = { LOBBY: 'lobby', BESTIAIRE: 'bestiaire', JEU: 'jeu' };

const scr = new Screen(canvas, computeLayout(innerWidth, innerHeight));
const input = new Input(canvas);

let scene = SCENE.LOBBY;
let game = null;
let bestiaire = null;
let lobby = null;
/* La souche choisie survit au retour au lobby et aux parties suivantes :
   elle vit donc ici, pas dans le lobby qui est reconstruit a chaque fois. */
let especeId = ESPECE_DEFAUT;
let prevState = null;
let hintsUntil = 0;
let lastPanelId = null;

/* Le champ doit remplir l'ecran : en portrait il touche le haut, la gauche
   et la droite ; en paysage, le haut et le bas. */
function relayout() {
  const L = computeLayout(innerWidth, innerHeight);
  scr.applyLayout(L);
  stage.style.aspectRatio = `${L.W} / ${L.H}`;
  stage.style.height = `min(100dvh, calc(100vw * ${L.H} / ${L.W}))`;
  stage.style.width = `min(100vw, calc(100dvh * ${L.W} / ${L.H}))`;
  /* La colonne laterale libre, en pourcentage du stage : le panneau du
     bestiaire s'y loge en paysage au lieu de manger le bas du disque. */
  stage.dataset.mode = L.mode;
  stage.style.setProperty('--col', `${((L.CX - L.R) / L.W) * 100}%`);
}

function goLobby() {
  scene = SCENE.LOBBY;
  game = null;
  bestiaire = null;
  hidePanel();
  lobby = new Lobby((choix) => {
    if (choix.bestiaire) {
      bestiaire = new Bestiary(goLobby);
      scene = SCENE.BESTIAIRE;
    } else {
      especeId = choix.espece || especeId;
      startMatrice(choix.matrice, especeId);
    }
  }, especeId);
  overlay.hideAll();
}

function startMatrice(id, souche = especeId) {
  especeId = souche;
  game = new Game(id, (Math.random() * 0xffffffff) >>> 0, souche);
  game.input = input;
  game.showHints = true;
  game.start();
  prevState = game.state;
  hintsUntil = 8;
  scene = SCENE.JEU;
  hidePanel();
  overlay.hideAll();
}

const overlay = new Overlay(() => { goLobby(); overlay.hideAll(); });
overlay.getGame = () => game;

function hidePanel() {
  if (!panel) return;
  panel.classList.remove('on');
  lastPanelId = null;
}

function syncPanel(info) {
  if (!panel) return;
  if (!info) { hidePanel(); return; }
  if (info.id !== lastPanelId) {
    lastPanelId = info.id;
    const stats = (info.stats || [])
      .map(([k, v]) => `<em><i>${escapeHtml(k)}</i>${escapeHtml(String(v))}</em>`)
      .join('');
    panel.innerHTML = `<b>${escapeHtml(info.label)}</b>`
      + `<div class="stats">${stats}</div>`
      + `<span>${escapeHtml(info.note)}</span>`;
  }
  panel.classList.add('on');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function applyPendingDecorClear() {
  if (!game || !game.pendingDecorClear) return;
  const { x, y, radius } = game.pendingDecorClear;
  game.pendingDecorClear = null;
  forEachDecor(game.matrix, x, y, radius, game.removedDecor, game.time,
    (it) => game.removedDecor.add(it.key));
}

let last = performance.now();
let panneauSon = false;

/**
 * Overlay de verification du son (touche L).
 *
 * On ne regle pas une bande son adaptative a l'oreille seule : il faut voir
 * les grandeurs observees pour savoir si c'est le mappage ou le timbre qui
 * ne va pas.
 */
function dessinerPanneauSon(scr) {
  const e = son.etat;
  const lignes = [
    `SON ${e.mort ? 'HS' : (e.pret ? (e.muet ? 'MUET' : 'ON') : 'ATTENTE GESTE')}`,
    `AMBIANCE ${e.ambiance.toUpperCase()}`,
    `INTENSITE  ${barre(e.intensite)}`,
    `MISE AU PT ${barre(e.miseAuPoint)}`,
    `DANGER     ${barre(e.danger)}`,
    `ACIDITE    ${barre((e.acidite + 1) / 2)}`,
    'M : COUPER   L : FERMER',
  ];
  lignes.forEach((l, i) => drawText(scr, l, 3, 3 + i * 8, UI.text, 1, 1));
}

const barre = (v) => {
  const n = Math.round(clamp(v, 0, 1) * 10);
  return '#'.repeat(n) + '.'.repeat(10 - n);
};

function frame(now) {
  /* Pas de temps borne : un onglet en arriere-plan ne doit pas teleporter
     la simulation quand il revient. */
  let dt = (now - last) / 1000;
  last = now;
  dt = Math.min(dt, 1 / 20);

  input.sample();
  /* Le son OBSERVE l'etat, on ne lui pousse rien : meme convention que le
     rendu. Ajouter une matrice ne demande donc aucun cablage audio. */
  if (input.takeMuet()) son.setMuted(!son.muet);
  if (input.takePanneauSon()) panneauSon = !panneauSon;
  son.observe(scene === SCENE.JEU ? 'jeu' : 'lobby', scene === SCENE.JEU ? game : null, dt);

  if (scene === SCENE.LOBBY) {
    input.takePause();
    lobby.update(dt, input);
    lobby.render(scr);
  } else if (scene === SCENE.BESTIAIRE) {
    bestiaire.update(dt, input);
    bestiaire.render(scr);
    syncPanel(bestiaire.info);
  } else {
    if (input.takePause() && game.state === STATE.PLAYING) {
      game.state = STATE.PAUSED;
      overlay.showPause();
      son.suspend();
    }
    if (game.state === STATE.PLAYING) son.resume();
    if (game.state === STATE.PLAYING) {
      game.update(dt, input);
      applyPendingDecorClear();
      if (hintsUntil > 0) {
        hintsUntil -= dt;
        game.showHints = hintsUntil > 0;
      }
    }
    if (game.state !== prevState) {
      if (game.state === STATE.LEVELUP) overlay.showLevelUp();
      else if (game.state === STATE.DEAD) overlay.showEnd(false);
      else if (game.state === STATE.WON) overlay.showEnd(true);
      prevState = game.state;
    }
    const pal = MATRICES_PALETTE[game.matrix.id];
    renderField(scr, game, pal);
    renderHud(scr, game, pal);
  }

  if (panneauSon) dessinerPanneauSon(scr);

  scr.present();
  requestAnimationFrame(frame);
}

relayout();
addEventListener('resize', relayout);
addEventListener('orientationchange', () => setTimeout(relayout, 120));

goLobby();
/* Le lobby tourne DERRIERE l'ecran-titre : on voit deja les puits vivre. */
overlay.show('menu');
requestAnimationFrame(frame);

/* Accroche de mise au point : inspection depuis la console et tests
   automatises (tools/smoke.mjs). */
window.__game = null;
window.__input = input;
window.__screen = scr;
window.__view = VIEW;
window.__overlay = overlay;
Object.defineProperty(window, '__game', { get: () => game, configurable: true });
Object.defineProperty(window, '__scene', { get: () => scene, configurable: true });
Object.defineProperty(window, '__lobby', { get: () => lobby, configurable: true });
Object.defineProperty(window, '__bestiaire', { get: () => bestiaire, configurable: true });
window.__startMatrice = startMatrice;

/* Pause automatique quand l'onglet part : on ne meurt pas hors de l'ecran. */
addEventListener('visibilitychange', () => {
  if (document.hidden && scene === SCENE.JEU && game && game.state === STATE.PLAYING) {
    game.state = STATE.PAUSED;
    overlay.showPause();
  }
  /* L'onglet qui part endort l'audio : sinon la bande son continue de jouer
     dans le vide et le planificateur accumule du retard a rattraper. */
  if (document.hidden) son.suspend(); else son.resume();
  last = performance.now();
});
