import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = '/home/user/Cell-dungeon';
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json' };

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
await new Promise((r) => server.listen(8099, r));

/* Chromium pre-installe : on laisse Playwright le trouver, sinon on tente
   les emplacements connus de l'environnement. */
import { existsSync } from 'node:fs';
const CANDIDATES = [
  process.env.CHROMIUM_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome',
].filter(Boolean);
const exe = CANDIDATES.find((p) => existsSync(p));
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage({ viewport: { width: 520, height: 760 } });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto('http://localhost:8099/', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

if (errors.length) { console.log('ERREURS AU CHARGEMENT:'); errors.forEach(e => console.log('  ' + e)); }
else console.log('chargement: aucune erreur');

await page.screenshot({ path: process.env.SHOT_DIR ? process.env.SHOT_DIR + '/01-menu.png' : '01-menu.png' });

await page.click('#btnStart');
/* Le bouton mene au LOBBY : on entre explicitement dans la matrice. */
await page.evaluate(() => window.__startMatrice('milk'));
await page.waitForTimeout(400);

// simule du jeu : deplacement + mise au point
await page.keyboard.down('KeyD');
for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, 40); await page.waitForTimeout(120); }
await page.keyboard.up('KeyD');
await page.waitForTimeout(2500);
await page.screenshot({ path: process.env.SHOT_DIR ? process.env.SHOT_DIR + '/02-play.png' : '02-play.png' });

// etat interne + perf
const info = await page.evaluate(() => {
  const g = window.__game;
  if (!g) return { noHook: true };
  return { state: g.state, time: +g.time.toFixed(1), enemies: g.enemies.length,
           bullets: g.bullets.length, pickups: g.pickups.length, hp: Math.round(g.player.hp),
           level: g.player.level, kills: g.player.kills, focus: +g.focus.toFixed(2) };
});
console.log('etat:', JSON.stringify(info));

const fps = await page.evaluate(() => new Promise((res) => {
  let n = 0; const t0 = performance.now();
  const tick = () => { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(tick); else res(Math.round(n / ((performance.now() - t0) / 1000))); };
  requestAnimationFrame(tick);
}));
console.log('fps:', fps);

// force une montee de niveau pour voir les cartes
await page.evaluate(() => { const g = window.__game; if (g) { g.pendingLevels = 1; g.openLevelUp(); } });
await page.waitForTimeout(300);
const cards = await page.$$eval('#lvCards .card', (els) => els.map((e) => e.querySelector('.name')?.textContent.trim()));
console.log('cartes:', JSON.stringify(cards));
await page.screenshot({ path: process.env.SHOT_DIR ? process.env.SHOT_DIR + '/03-levelup.png' : '03-levelup.png' });

if (errors.length) { console.log('ERREURS PENDANT LE JEU:'); errors.forEach(e => console.log('  ' + e)); }
else console.log('jeu: aucune erreur');

/* --- prise en charge tactile, detectee automatiquement ------------------ */
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
});
const mp = await mobile.newPage();
const mErrs = [];
mp.on('pageerror', (e) => mErrs.push(e.message));
await mp.goto('http://localhost:8099/');
const touchDetected = await mp.evaluate(() => window.__input.hasTouch);
await mp.tap('#btnStart');
await mp.evaluate(() => window.__startMatrice('milk'));
await mp.waitForTimeout(300);
/* manche virtuel a gauche, mise au point a droite */
await mp.touchscreen.tap(90, 600);
const before = await mp.evaluate(() => window.__game.focus);
await mp.evaluate(() => {
  const c = document.getElementById('cv');
  const r = c.getBoundingClientRect();
  const x = r.left + r.width * 0.8;
  const send = (type, y) => c.dispatchEvent(new PointerEvent(type, {
    pointerId: 7, pointerType: 'touch', clientX: x, clientY: y,
    bubbles: true, cancelable: true,
  }));
  send('pointerdown', r.top + r.height * 0.4);
  for (let i = 1; i <= 8; i++) send('pointermove', r.top + r.height * 0.4 + i * 12);
  send('pointerup', r.top + r.height * 0.4 + 96);
});
await mp.waitForTimeout(200);
const after = await mp.evaluate(() => window.__game.focus);
await mp.screenshot({ path: process.env.SHOT_DIR ? process.env.SHOT_DIR + '/07-tactile.png' : '07-tactile.png' });
console.log(`tactile: detecte=${touchDetected} miseAuPoint ${before.toFixed(2)} -> ${after.toFixed(2)}`
  + (Math.abs(after - before) > 0.02 ? ' (reagit)' : ' (NE REAGIT PAS)'));
if (mErrs.length) { console.log('ERREURS TACTILE:'); mErrs.forEach(e => console.log('  ' + e)); errors.push(...mErrs); }
await mobile.close();

await browser.close();
server.close();
process.exit(errors.length ? 1 : 0);
