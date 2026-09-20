import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { existsSync } from 'node:fs';

const ROOT = '/home/user/Cell-dungeon';
const OUT = '/tmp/claude-0/-home-user-Cell-dungeon/8c8b2afa-4bc1-5597-82af-bf6100d14955/scratchpad';
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css' };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const body = await readFile(join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, '')));
    res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(8098, r));

const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(existsSync);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage({ viewport: { width: 520, height: 760 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://localhost:8098/');
await page.click('#btnStart');

// Avance le run jusqu'au palier 3 SANS declencher les evenements passes,
// sinon tous les boss sortent d'un coup et le directeur bride la pietaille.
await page.evaluate(() => {
  const g = window.__game;
  g.time = 430;
  for (const ev of g.matrix.events) if (ev.t <= g.time) g.director.fired.add(ev);
  g.boss = null; g.director.bossActive = false;
  g.player.invuln = 1e6;   // le harnais ne joue pas : on l'empeche de mourir
});
await page.waitForTimeout(6000);
// Mise au point sur le plan du joueur.
await page.evaluate(() => { window.__game.focus = 0; window.__game.focusVel = 0; });
await page.waitForTimeout(1500);
await page.evaluate(() => { window.__game.focus = 0; window.__game.focusVel = 0; });
await page.screenshot({ path: OUT + '/04-net.png' });
console.log('net:', JSON.stringify(await page.evaluate(() => {
  const g = window.__game;
  const byKind = {};
  for (const e of g.enemies) byKind[e.spec.id] = (byKind[e.spec.id] || 0) + 1;
  return { t: Math.round(g.time), enemies: g.enemies.length, byKind,
           sharp: g.sharpEnemyCount, credits: +g.director.liveCredits().toFixed(1),
           hp: Math.round(g.player.hp) };
})));

// Mise au point profonde : on doit voir arriver ce qui n'est pas encore la.
await page.evaluate(() => { window.__game.focus = 0.8; window.__game.focusVel = 0; });
await page.waitForTimeout(600);
await page.evaluate(() => { window.__game.focus = 0.8; window.__game.focusVel = 0; });
await page.screenshot({ path: OUT + '/05-profond.png' });

// Boss
await page.evaluate(() => { const g = window.__game; g.director.runEvent({ type:'boss', id:'staph' }); g.focus = 0; });
await page.waitForTimeout(2500);
await page.evaluate(() => { window.__game.focus = 0; window.__game.focusVel = 0; });
await page.screenshot({ path: OUT + '/06-boss.png' });
console.log('boss:', JSON.stringify(await page.evaluate(() => {
  const b = window.__game.boss;
  return b ? { label: b.spec.label, hp: Math.round(b.hp), z: +b.z.toFixed(2), phase: b.phaseIndex } : null;
})));

console.log(errs.length ? 'ERREURS: ' + errs.join(' | ') : 'aucune erreur');
await browser.close(); server.close();
