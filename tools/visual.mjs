/* Captures de controle : portrait, paysage, vue pH, boss.
   SHOT_DIR pour choisir le dossier de sortie. */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const ROOT = process.cwd();
const OUT = process.env.SHOT_DIR || '.';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
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

const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(existsSync);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const errs = [];

/** Amene le jeu a mi-parcours sans declencher les evenements passes. */
const FFWD = `() => {
  const g = window.__game;
  g.time = 430;
  for (const ev of g.matrix.events) if (ev.t <= g.time) g.director.fired.add(ev);
  g.boss = null; g.director.bossActive = false;
  g.player.invuln = 1e6;
}`;

async function shot(name, viewport, steps) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(`${name}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(`${name}: ${m.text()}`); });
  await page.goto('http://localhost:8098/');
  await page.click('#btnStart');
  await page.evaluate(FFWD);
  await page.waitForTimeout(5000);
  if (steps) await steps(page);
  await page.evaluate(() => { const g = window.__game; g.focus = 0; g.focusTarget = 0; });
  await page.waitForTimeout(400);
  const info = await page.evaluate(() => {
    const g = window.__game;
    const V = window.__view;
    return {
      canvas: `${V.W}x${V.H}`, mode: V.mode, rayon: V.R,
      mobs: g.enemies.length, ph: +g.ph.toFixed(2),
      vitesse: +Math.hypot(g.player.vx, g.player.vy).toFixed(0),
    };
  });
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(name.padEnd(18), JSON.stringify(info));
  await ctx.close();
}

await shot('10-portrait', { width: 420, height: 840 });
await shot('11-paysage', { width: 960, height: 540 });
await shot('12-ph', { width: 420, height: 840 }, async (page) => {
  await page.evaluate(() => {
    const g = window.__game;
    g.player.take('phsense');
    /* On arrose le champ pour que la carte ait quelque chose a montrer. */
    for (let i = 0; i < 260; i++) {
      const a = Math.random() * 6.283, d = Math.random() * 90;
      g.phField.acidify(g.player.x + Math.cos(a) * d, g.player.y + Math.sin(a) * d, 0.5, 26);
    }
  });
  await page.waitForTimeout(400);
});
await shot('13-boss', { width: 960, height: 540 }, async (page) => {
  await page.evaluate(() => window.__game.director.runEvent({ type: 'boss', id: 'staph' }));
  await page.waitForTimeout(2500);
});

console.log(errs.length ? 'ERREURS: ' + errs.join(' | ') : 'aucune erreur');
await browser.close();
server.close();
