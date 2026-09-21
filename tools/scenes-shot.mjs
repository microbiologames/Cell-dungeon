/* Captures du lobby et du bestiaire, en portrait et en paysage. */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';
const ROOT = process.cwd();
const OUT = process.env.SHOT_DIR || '.';
const T = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png' };
const srv = createServer(async (q, r) => {
  try {
    let p = decodeURIComponent(q.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const b = await readFile(join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, '')));
    r.writeHead(200, { 'content-type': T[extname(p)] || 'application/octet-stream' });
    r.end(b);
  } catch { r.writeHead(404); r.end(); }
});
await new Promise((r) => srv.listen(8086, r));
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(existsSync);
const b = await chromium.launch(exe ? { executablePath: exe } : {});
const errs = [];

async function shot(name, viewport, steps) {
  const ctx = await b.newContext({ viewport, deviceScaleFactor: 2 });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => errs.push(`${name}: ${e.message}`));
  pg.on('console', (m) => { if (m.type() === 'error') errs.push(`${name}: ${m.text()}`); });
  await pg.goto('http://localhost:8086/');
  await pg.click('#btnStart');
  await pg.waitForTimeout(400);
  if (steps) await steps(pg);
  await pg.waitForTimeout(500);
  await pg.screenshot({ path: `${OUT}/${name}.png` });
  console.log(name.padEnd(20), await pg.evaluate(() => window.__scene));
  await ctx.close();
}

await shot('20-lobby-portrait', { width: 420, height: 840 });
await shot('21-lobby-paysage', { width: 960, height: 540 });
/* On se place pres d'un puits pour montrer l'anneau de selection. */
await shot('22-lobby-puits', { width: 960, height: 540 }, async (pg) => {
  await pg.evaluate(() => {
    const L = window.__lobby;
    L.swim.x = -110; L.swim.y = -70 - 30;
  });
  await pg.waitForTimeout(400);
});
await shot('23-bestiaire', { width: 960, height: 540 }, async (pg) => {
  await pg.evaluate(() => { window.__lobby.onPick({ bestiaire: true }); });
  await pg.waitForTimeout(900);
});
await shot('24-bestiaire-focus', { width: 420, height: 840 }, async (pg) => {
  await pg.evaluate(() => { window.__lobby.onPick({ bestiaire: true }); });
  await pg.waitForTimeout(400);
  await pg.evaluate(() => {
    const B = window.__bestiaire;
    const e = B.entries.find((x) => x.spec.id === 'staph') || B.entries[0];
    B.swim.x = e.x; B.swim.y = e.y + 14;
  });
  await pg.waitForTimeout(500);
});
await shot('25-bestiaire-paysage', { width: 960, height: 540 }, async (pg) => {
  await pg.evaluate(() => { window.__lobby.onPick({ bestiaire: true }); });
  await pg.waitForTimeout(400);
  await pg.evaluate(() => {
    const B = window.__bestiaire;
    const e = B.entries.find((x) => x.spec.id === 'staph') || B.entries[0];
    B.swim.x = e.x; B.swim.y = e.y + 14;
  });
  await pg.waitForTimeout(500);
});
/* La conduite : couloir, courant, plaques de biofilm. */
await shot('26-conduite', { width: 960, height: 540 }, async (pg) => {
  await pg.evaluate(() => window.__startMatrice('pipe'));
  await pg.waitForTimeout(2500);
});
await shot('27-conduite-portrait', { width: 420, height: 840 }, async (pg) => {
  await pg.evaluate(() => window.__startMatrice('pipe'));
  await pg.waitForTimeout(2500);
});
/* Le NEP en cours : la lame de biocide traverse le couloir. */
await shot('28-nep', { width: 960, height: 540 }, async (pg) => {
  await pg.evaluate(() => {
    window.__startMatrice('pipe');
  });
  await pg.waitForTimeout(600);
  await pg.evaluate(() => {
    const g = window.__game, c = g.conduite;
    c.cip.etat = 'vague';
    c.cip.index = 2;
    c.cip.frontX = g.player.x - 30;
  });
  await pg.waitForTimeout(250);
});
/* Mise au point sur la paroi : c'est la que vivent les plaques de biofilm. */
await shot('29-biofilm', { width: 960, height: 540 }, async (pg) => {
  await pg.evaluate(() => window.__startMatrice('pipe'));
  await pg.waitForTimeout(1500);
  await pg.evaluate(() => {
    const g = window.__game;
    const pl = g.conduite.slots.find((s) => s.entite && s.entite.alive);
    if (pl) { g.player.x = pl.entite.x; g.player.y = pl.entite.y * 0.45; }
    g.focusTarget = 0.55;
  });
  await pg.waitForTimeout(700);
});
/* Le boss de la conduite : la masse de biofilm mur. */
await shot('30-boss-biofilm', { width: 960, height: 540 }, async (pg) => {
  await pg.evaluate(() => window.__startMatrice('pipe'));
  await pg.waitForTimeout(800);
  await pg.evaluate(() => {
    const g = window.__game;
    g.director.runEvent({ type: 'boss', id: 'biofilm' });
    g.focusTarget = 0.8;
  });
  await pg.waitForTimeout(900);
});
/* Tour de la conduite : un cliche par type d'accident. La geometrie etant
   generee par hachage, on demande a la Geometrie ou aller. */
for (const nature of ['chambre', 'pincement', 'filtre', 'bifurcation']) {
  await shot(`3${['chambre', 'pincement', 'filtre', 'bifurcation'].indexOf(nature) + 1}-conduite-${nature}`,
    { width: 960, height: 540 }, async (pg) => {
      await pg.evaluate((n) => window.__startMatrice('pipe'), nature);
      await pg.waitForTimeout(600);
      await pg.evaluate((n) => {
        const g = window.__game;
        g.damagePlayer = () => {};
        const geo = g.arena.geo;
        /* On cherche le centre du premier troncon de cette nature. */
        for (let i = 0; i < 8; i++) {
          const x = -1408 + i * 352 + 176;
          if (geo.troncon(x).nature === n) { g.player.x = x; g.player.y = 0; break; }
        }
        g.player.vx = 0; g.player.vy = 0;
      }, nature);
      await pg.waitForTimeout(500);
    });
}
console.log(errs.length ? 'ERREURS: ' + errs.join(' | ') : 'aucune erreur');
await b.close(); srv.close();
