/* ---------------------------------------------------------------------------
   Playtest headless : fait tourner la VRAIE boucle de jeu (decor, pH, vagues,
   evolutions, collisions) a vitesse maximale, avec un pilote automatique.

   Le simulateur d'equilibrage travaille sur un modele abstrait ; celui-ci
   mesure ce que le modele ne voit pas : la recolte, qui depend du
   deplacement et du rayon de captation, et tout ce que le decor change.

     node tools/playtest.mjs [nb_de_runs]
--------------------------------------------------------------------------- */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const RUNS = Number(process.argv[2] || 3);
const ROOT = process.cwd();
const TYPES = { '.html': 'text/html', '.js': 'text/javascript' };
const srv = createServer(async (q, r) => {
  try {
    let p = q.url.split('?')[0]; if (p === '/') p = '/index.html';
    r.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' });
    r.end(await readFile(join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''))));
  } catch { r.writeHead(404); r.end(); }
});
await new Promise((r) => srv.listen(8096, r));
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(existsSync);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage({ viewport: { width: 420, height: 840 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://localhost:8096/');

const result = await page.evaluate(async (runs) => {
  const { Game } = await import('./src/game/game.js');
  const out = [];

  for (let run = 0; run < runs; run++) {
    const g = new Game('milk', 4242 + run * 977);
    g.start();

    /* Entree simulee : le pilote la remplit a chaque pas. */
    const input = {
      move: { x: 0, y: 0 }, focusAxis: 0,
      takeFocusImpulse: () => 0, takeDash: () => false, takePause: () => false,
    };

    const DT = 1 / 60;
    const steps = Math.ceil(g.matrix.duration / DT) + 60;
    const marks = [];
    let nextMark = 0;
    let deaths = 0;

    for (let i = 0; i < steps; i++) {
      /* Pilote : cherche les acides amines, fuit quand la foule colle. */
      const p = g.player;
      let tx = null, ty = null, bd = 1e9;
      for (const k of g.pickups) {
        if (!k.alive) continue;
        const d = Math.hypot(k.x - p.x, k.y - p.y);
        if (d < bd) { bd = d; tx = k.x; ty = k.y; }
      }
      let near = 0, ax = 0, ay = 0;
      for (const e of g.enemies) {
        if (!e.alive || e.spec.neutral || Math.abs(e.z) > 0.2) continue;
        const dx = p.x - e.x, dy = p.y - e.y;
        const d = Math.hypot(dx, dy);
        if (d < 34) { near++; ax += dx / (d || 1); ay += dy / (d || 1); }
      }
      if (near >= 2) {
        const d = Math.hypot(ax, ay) || 1;
        input.move.x = ax / d; input.move.y = ay / d;
      } else if (tx !== null && bd < 260) {
        const d = Math.hypot(tx - p.x, ty - p.y) || 1;
        input.move.x = (tx - p.x) / d; input.move.y = (ty - p.y) / d;
      } else {
        const a = g.time * 0.45;
        input.move.x = Math.cos(a); input.move.y = Math.sin(a);
      }
      g.focusTarget = 0;

      g.update(DT, input);

      /* Choix d'evolution : on prend au hasard, le pire des cas. */
      let guard = 0;
      while (g.state === 'levelup' && guard++ < 8) {
        const hand = g.hand || [];
        if (!hand.length) { g.state = 'playing'; break; }
        g.chooseEvolution(hand[Math.floor(Math.random() * hand.length)].id);
      }
      if (g.state === 'dead') { deaths++; g.player.hp = g.player.stats.maxHp; g.state = 'playing'; }

      if (g.time >= nextMark) {
        nextMark += 120;
        marks.push({
          t: Math.round(g.time), niv: g.player.level, tues: g.player.kills,
          mobs: g.enemies.filter((e) => !e.spec.neutral && e.alive).length,
          auSol: g.pickups.filter((k) => k.alive).length,
          ph: +g.ph.toFixed(2),
          dps: +(g.player.stats.dmg * g.player.fireRate * g.player.stats.projectiles).toFixed(0),
        });
      }
      if (g.state === 'won') break;
    }
    out.push({ run, deaths, marks, niveauFinal: g.player.level, tues: g.player.kills });
  }
  return out;
}, RUNS);

for (const r of result) {
  console.log(`--- run ${r.run} : niveau ${r.niveauFinal}, ${r.tues} tues, ${r.deaths} mort(s) ---`);
  for (const m of r.marks) {
    console.log(`  ${String(Math.floor(m.t / 60)).padStart(2)}:${String(m.t % 60).padStart(2, '0')}`
      + `  niv ${String(m.niv).padStart(2)}  dps ${String(m.dps).padStart(3)}`
      + `  mobs ${String(m.mobs).padStart(2)}  au sol ${String(m.auSol).padStart(3)}`
      + `  pH ${m.ph.toFixed(2)}  tues ${m.tues}`);
  }
}
const niv = result.map((r) => r.niveauFinal);
console.log(`\nniveau final : ${Math.min(...niv)} a ${Math.max(...niv)}`
  + `  (moyenne ${(niv.reduce((a, b) => a + b, 0) / niv.length).toFixed(1)})`);
console.log(errs.length ? 'ERREURS: ' + errs.join(' | ') : 'aucune erreur');
await browser.close();
srv.close();
