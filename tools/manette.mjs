/* ---------------------------------------------------------------------------
   Banc manette : le jeu se joue-t-il SANS souris, SANS clavier et SANS
   ecran tactile ? C'est la question de la borne d'arcade, dont l'encodeur
   USB n'envoie que des axes et des boutons.

   La manette est FACTICE : Playwright ne sait pas brancher une manette, on
   remplace donc navigator.getGamepads() par un etat qu'on pilote depuis le
   banc. Ce que ce banc mesure est donc le CABLAGE du jeu (lecture des axes,
   fronts de boutons, curseur des overlays), pas le navigateur ni l'encodeur.
   Les index de boutons de l'encodeur, eux, se relevent sur la borne avec
   borne/touches.html : voir le README de Microbe-Fighter.

     npm run manette
--------------------------------------------------------------------------- */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

/* .pathname d'une URL file: rend "/C:/..." sous Windows : join() en faisait
   "\\C:\\..." et chaque fichier repondait 404, donc le banc echouait des son
   premier verdict sans que rien ne soit casse dans le jeu. fileURLToPath rend
   le chemin natif des deux cotes. Ce banc doit tourner sur le poste de
   developpement : Playwright n'est pas installe sur la borne. */
const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
                '.json':'application/json', '.png':'image/png' };

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const file = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('nope'); }
});
await new Promise((r) => server.listen(8097, r));
const BASE = 'http://localhost:8097';

const CANDIDATES = [
  process.env.CHROMIUM_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome',
].filter(Boolean);
const exe = CANDIDATES.find((p) => existsSync(p));
const browser = await chromium.launch(exe ? { executablePath: exe } : {});

/* Deux manettes, comme la borne : l'encodeur expose un peripherique par
   joueur, et le geste voulu est un joueur qui tient les deux joysticks. */
const MANETTE_FACTICE = () => {
  const pad = (index) => ({
    id: 'borne factice', index, connected: true, mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0, touched: false })),
    timestamp: 0,
  });
  window.__pads = [pad(0), pad(1)];
  Object.defineProperty(navigator, 'getGamepads', {
    value: () => window.__pads, configurable: true, writable: true,
  });
  window.__padAxe = (i, a, v) => { window.__pads[i].axes[a] = v; window.__pads[i].timestamp++; };
  window.__padBouton = (i, b, on) => {
    window.__pads[i].buttons[b] = { pressed: on, value: on ? 1 : 0, touched: on };
    window.__pads[i].timestamp++;
  };
  window.__padsCombien = (n) => { window.__pads.length = n; };
};

const verdicts = [];
function dire(ok, nom, detail = '') {
  verdicts.push(ok);
  const tag = ok ? ' OK  ' : 'ECHEC';
  console.log(`  [${tag}] ${String(verdicts.length).padStart(2)}. ${nom}${detail ? ' — ' + detail : ''}`);
}

/** Une page neuve, manette factice injectee avant tout script du jeu. */
async function ouvrir(query = '') {
  const page = await browser.newPage({ viewport: { width: 520, height: 760 } });
  const erreurs = [];
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push('console: ' + m.text()); });
  page.on('pageerror', (e) => erreurs.push('pageerror: ' + e.message));
  await page.addInitScript(MANETTE_FACTICE);
  await page.goto(BASE + '/' + query, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  return { page, erreurs };
}

/* Un appui doit durer au moins une image pour faire un front, et finir
   relache : un bouton tenu ne retombe jamais et masquerait l'appui suivant.
   120 ms = 7 images a 60 Hz, assez pour que la boucle en voie le debut et
   la fin sans allonger le banc. */
const APPUI_MS = 120;
async function appui(page, i, b) {
  await page.evaluate(({ i, b }) => window.__padBouton(i, b, true), { i, b });
  await page.waitForTimeout(APPUI_MS);
  await page.evaluate(({ i, b }) => window.__padBouton(i, b, false), { i, b });
  await page.waitForTimeout(APPUI_MS);
}
async function axe(page, i, a, v) {
  await page.evaluate(({ i, a, v }) => window.__padAxe(i, a, v), { i, a, v });
}
const etat = (page) => page.evaluate(() => ({
  scene: window.__scene,
  overlay: window.__overlay.current,
  curseur: !!document.querySelector('.overlay.on .sel'),
  libelle: document.getElementById('menuKeys')?.textContent || '',
  swim: window.__lobby ? { x: window.__lobby.swim.x, y: window.__lobby.swim.y } : null,
  jeu: window.__game ? {
    state: window.__game.state,
    focusTarget: +window.__game.focusTarget.toFixed(3),
    px: +window.__game.player.x.toFixed(2),
    /* dashCd, pas dashTtl : le dash ne dure que 0,16 s et etait deja
       retombe quand le banc lisait, alors qu'il avait bien eu lieu. Le
       refroidissement, lui, est pose a 6 s par dash() et par rien d'autre. */
    dashCd: +window.__game.player.dashCd.toFixed(2),
    taken: window.__game.player.taken.size,
  } : null,
}));

console.log('banc manette — manette FACTICE, le navigateur n\'en a pas');
console.log('cible: ' + BASE);

/* --- 1 a 5 : l'ecran titre et le lobby, a la manette seule --------------- */
{
  const { page, erreurs } = await ouvrir();
  dire(erreurs.length === 0, 'chargement sans erreur', erreurs.join(' | ') || 'aucune');

  const a = await etat(page);
  dire(a.libelle.includes('JOYSTICK'), 'la manette se declare et le titre le dit',
    a.libelle.slice(0, 46) + '...');
  dire(a.overlay === 'menu' && a.curseur, 'un ecran ouvert designe deja une cible',
    `overlay=${a.overlay} curseur=${a.curseur}`);

  /* Bouton 0 = poing sur la borne : il doit passer l'ecran titre. Aucune
     souris, aucun clavier n'intervient ici. */
  await appui(page, 0, 0);
  const b = await etat(page);
  dire(b.overlay === null, 'l\'ecran titre se passe au bouton seul', `overlay=${b.overlay}`);

  /* Joystick gauche dans le lobby : le nageur part a droite. */
  const avant = (await etat(page)).swim;
  await axe(page, 0, 0, 1);
  await page.waitForTimeout(500);
  await axe(page, 0, 0, 0);
  const apres = (await etat(page)).swim;
  dire(apres.x - avant.x > 5, 'joystick gauche : le nageur se deplace dans le lobby',
    `dx=${(apres.x - avant.x).toFixed(1)} px`);
  await page.close();
}

/* --- 6 a 9 : en partie, les deux joysticks ------------------------------- */
{
  const { page } = await ouvrir();
  await appui(page, 0, 0);
  await page.evaluate(() => window.__startMatrice('milk'));
  await page.waitForTimeout(400);

  const p0 = (await etat(page)).jeu.px;
  await axe(page, 0, 0, 1);
  await page.waitForTimeout(500);
  await axe(page, 0, 0, 0);
  const p1 = (await etat(page)).jeu.px;
  dire(p1 - p0 > 5, 'joystick gauche : le joueur se deplace en partie',
    `dx=${(p1 - p0).toFixed(1)} px`);

  /* Joystick droit, vers le bas. L'axe vertical est positif vers le bas. */
  const f0 = (await etat(page)).jeu.focusTarget;
  await axe(page, 1, 1, 1);
  await page.waitForTimeout(500);
  await axe(page, 1, 1, 0);
  const f1 = (await etat(page)).jeu.focusTarget;
  await axe(page, 1, 1, -1);
  await page.waitForTimeout(700);
  await axe(page, 1, 1, 0);
  const f2 = (await etat(page)).jeu.focusTarget;
  dire(f1 - f0 > 0.1 && f2 - f1 < -0.1, 'joystick droit : la mise au point suit, dans les deux sens',
    `${f0} -> ${f1} -> ${f2}`);

  /* MEME SENS que la molette : c'est l'invariant qu'affirme le commentaire
     de input.js. Si l'un des deux change de signe, le meme geste va dans
     deux directions selon la commande. */
  const g0 = (await etat(page)).jeu.focusTarget;
  await page.mouse.move(260, 380);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(250);
  const g1 = (await etat(page)).jeu.focusTarget;
  dire(Math.sign(g1 - g0) === Math.sign(f1 - f0) && g1 !== g0,
    'joystick droit et molette vont dans le meme sens',
    `molette ${(g1 - g0).toFixed(3)}, joystick ${(f1 - f0).toFixed(3)}`);

  /* Dash : c'est une evolution, on l'accorde pour pouvoir la mesurer. */
  await page.evaluate(() => window.__game.player.flags.add('dash'));
  await appui(page, 0, 0);
  const d = (await etat(page)).jeu;
  dire(d.dashCd > 5, 'le bouton lance le dash', `refroidissement=${d.dashCd} s`);
  await page.close();
}

/* --- 10 : une seule manette, le stick droit prend la mise au point ------- */
{
  const { page } = await ouvrir();
  await appui(page, 0, 0);
  await page.evaluate(() => window.__startMatrice('milk'));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__padsCombien(1));
  const f0 = (await etat(page)).jeu.focusTarget;
  await axe(page, 0, 3, 1);
  await page.waitForTimeout(500);
  await axe(page, 0, 3, 0);
  const f1 = (await etat(page)).jeu.focusTarget;
  dire(f1 - f0 > 0.1, 'une seule manette : son stick droit met au point',
    `${f0} -> ${f1}`);
  await page.close();
}

/* --- 11 : ?manettes=1,0 echange les roles sans toucher au code ----------- */
{
  const { page } = await ouvrir('?manettes=1,0');
  await appui(page, 1, 0);
  const avant = (await etat(page)).swim;
  await axe(page, 1, 0, 1);
  await page.waitForTimeout(500);
  await axe(page, 1, 0, 0);
  const apres = (await etat(page)).swim;
  dire(apres.x - avant.x > 5, '?manettes=1,0 : la seconde manette deplace',
    `dx=${(apres.x - avant.x).toFixed(1)} px`);
  await page.close();
}

/* --- 12 a 16 : les ecrans, a la manette seule ---------------------------- */
{
  const { page } = await ouvrir();
  await appui(page, 0, 0);
  await page.evaluate(() => window.__startMatrice('milk'));
  await page.waitForTimeout(400);

  /* Le bouton de pause ouvre la pause. Le MEME appui ne doit pas valider
     REPRENDRE dans la foulee : c'est le defaut que la consommation des
     fronts corrige.
     C'est le bouton 5 depuis le releve du 18/08/2026 : la borne n'a pas de
     START, l'index 9 n'existe pas sur son encodeur. Sur le meuble le 5 n'est
     cable que sur la carte du joueur 2 ; ici l'appui part sur la manette 0,
     ce qui teste la meme chose puisque les fronts sont lus sur toutes les
     manettes confondues. */
  await appui(page, 0, 5);
  const p = await etat(page);
  dire(p.overlay === 'pause' && p.jeu.state === 'paused',
    'le bouton de pause ouvre la pause sans la refermer aussitot',
    `overlay=${p.overlay} etat=${p.jeu.state}`);

  /* Et on en sort au bouton, curseur sur REPRENDRE. */
  await appui(page, 0, 0);
  const r = await etat(page);
  dire(r.overlay === null && r.jeu.state === 'playing', 'on quitte la pause au bouton',
    `overlay=${r.overlay} etat=${r.jeu.state}`);

  /* Cartes d'evolution : cap vers le bas, puis validation. */
  await page.evaluate(() => { window.__game.pendingLevels = 1; window.__game.openLevelUp(); });
  await page.waitForTimeout(250);
  const avantCartes = await etat(page);
  await axe(page, 0, 1, 1);
  await page.waitForTimeout(APPUI_MS);
  await axe(page, 0, 1, 0);
  await page.waitForTimeout(APPUI_MS);
  const rang = await page.evaluate(() =>
    [...document.querySelectorAll('#lvCards .card')].findIndex((c) => c.classList.contains('sel')));
  dire(avantCartes.overlay === 'level' && rang === 1,
    'le cap descend d\'une carte', `carte retenue = ${rang + 1}`);

  await appui(page, 0, 0);
  const choisie = await etat(page);
  dire(choisie.overlay === null && choisie.jeu.taken >= 1 && choisie.jeu.state === 'playing',
    'la carte se prend a la manette seule', `evolutions=${choisie.jeu.taken}`);

  /* L'ecran de mort ne doit PAS se valider tout seul : le bouton de dash
     presse en jeu etait garde en reserve et validait l'ecran a l'ouverture. */
  await appui(page, 0, 0);
  await appui(page, 0, 0);
  await page.evaluate(() => { window.__game.state = 'dead'; });
  await page.waitForTimeout(300);
  const mort = await etat(page);
  dire(mort.overlay === 'end' && mort.scene === 'jeu',
    'l\'ecran de mort ne se valide pas tout seul', `overlay=${mort.overlay}`);

  await appui(page, 0, 0);
  await page.waitForTimeout(250);
  const retour = await etat(page);
  dire(retour.scene === 'lobby', 'retour au lobby a la manette', `scene=${retour.scene}`);
  await page.close();
}

/* --- 18 : le clavier, ou la MEME touche sert deux fois ------------------- */
{
  /* Espace est le dash ET la validation : c'est le seul chemin ou une
     commande de jeu peut rester en reserve et valider l'ecran qui s'ouvre
     ensuite. Mesure a la place du cas manette, qui ne peut pas arriver : un
     front de bouton meurt a la fin de son image. */
  const { page } = await ouvrir();
  await appui(page, 0, 0);
  await page.evaluate(() => window.__startMatrice('milk'));
  await page.waitForTimeout(400);
  await page.keyboard.press('Space');
  await page.keyboard.press('Space');
  await page.evaluate(() => { window.__game.state = 'dead'; });
  await page.waitForTimeout(350);
  const e = await etat(page);
  dire(e.overlay === 'end' && e.scene === 'jeu',
    'Espace presse en jeu ne valide pas l\'ecran de mort', `overlay=${e.overlay}`);
  await page.close();
}

/* --- 19 : valider un ecran ne laisse pas un dash en reserve -------------- */
{
  /* Le bouton 0 valide les ecrans ET lance le dash. Sortir de la pause avec
     lui ne doit pas declencher un dash dans l'image suivante. */
  const { page } = await ouvrir();
  await appui(page, 0, 0);
  await page.evaluate(() => window.__startMatrice('milk'));
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__game.player.flags.add('dash'));
  await appui(page, 0, 5);
  await appui(page, 0, 0);
  await page.waitForTimeout(250);
  const e = await etat(page);
  dire(e.jeu.state === 'playing' && e.jeu.dashCd === 0,
    'sortir d\'un ecran au bouton ne lance pas de dash',
    `refroidissement=${e.jeu.dashCd} s`);
  await page.close();
}

await browser.close();
server.close();

const rates = verdicts.filter((v) => !v).length;
console.log(`\n${verdicts.length - rates}/${verdicts.length} verdicts tenus`);
if (rates) { console.log(`${rates} ECHEC(S)`); process.exit(1); }
