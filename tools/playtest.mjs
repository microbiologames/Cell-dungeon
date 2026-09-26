/* ---------------------------------------------------------------------------
   Playtest headless : fait tourner la VRAIE boucle de jeu (decor, pH, vagues,
   evolutions, collisions) a vitesse maximale, avec un pilote automatique.

   Le simulateur d'equilibrage travaille sur un modele abstrait ; celui-ci
   mesure ce que le modele ne voit pas : la recolte, qui depend du
   deplacement et du rayon de captation, et tout ce que le decor change.

     node tools/playtest.mjs [nb_de_runs] [matrice]
--------------------------------------------------------------------------- */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const RUNS = Number(process.argv[2] || 3);
const MATRICE = process.argv[3] || 'milk';
/* Permet de balayer un reglage de nage sans toucher au code :
     NAGE='{"alignement":0.2}' node tools/playtest.mjs 3 pipe               */
const NAGE_OVR = process.env.NAGE ? JSON.parse(process.env.NAGE) : null;
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

const result = await page.evaluate(async ({ runs, matrice, nageOvr }) => {
  const { Game } = await import('./src/game/game.js');
  const { MILK_MOBS } = await import('./src/data/bestiary.js');
  const { hpScale: HP_SCALE } = await import('./src/data/matrices.js');
  const CHAFF = MILK_MOBS.filter((m) => m.role === 'chaff');
  const REF_HP = CHAFF.reduce((a, m) => a + m.hp, 0) / CHAFF.length;
  if (nageOvr) {
    const { NAGE } = await import('./src/game/player.js');
    Object.assign(NAGE, nageOvr);
  }
  const out = [];

  for (let run = 0; run < runs; run++) {
    const g = new Game(matrice, 4242 + run * 977);
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
    /* Porteurs de plasmide VUS : le directeur en promeut un toutes les 34 a
       60 s, et un run de 12 minutes doit donc en montrer une dizaine. A zero,
       la promotion ne se declenche pas et personne ne s'en apercevrait — le
       jeu tournerait tres bien sans elle. */
    const porteursVus = new Set();
    /* Integrale de la capacite theorique de tuerie, pour RE-MESURER
       `ENGAGE_KILL` du simulateur d'equilibrage. Ce n'est pas un chiffre
       qu'on choisit : c'est le rapport entre ce que le joueur POURRAIT tuer
       (dps / PV d'un chaff) et ce qu'il tue vraiment. Son commentaire
       la-bas dit qu'il vient d'ici ; il faut donc qu'il vienne d'ici. */
    let capacite = 0;
    const deathPhase = [0, 0, 0];   // debut / milieu / fin

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
        /* Pas d'acide amine en vue : on va CHERCHER le combat, comme le
           ferait un joueur qui veut monter. Un pilote qui se contente de
           tourner en rond ne mesure que la fuite. */
        let ex = null, ey = null, ed = 1e9;
        for (const e of g.enemies) {
          if (!e.alive || e.spec.neutral) continue;
          const d = Math.hypot(e.x - p.x, e.y - p.y);
          if (d < ed) { ed = d; ex = e.x; ey = e.y; }
        }
        if (ex !== null && ed > p.stats.range * 0.6) {
          const d = Math.hypot(ex - p.x, ey - p.y) || 1;
          input.move.x = (ex - p.x) / d; input.move.y = (ey - p.y) / d;
        } else {
          const a = g.time * 0.45;
          input.move.x = Math.cos(a) * 0.35; input.move.y = Math.sin(a) * 0.35;
        }
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
      if (g.state === 'dead') {
        deaths++;
        /* Ou meurt-on ? Des morts concentrees a la fin, c'est le decrochage
           voulu. Des morts des l'ouverture, c'est un probleme. */
        deathPhase[Math.min(2, Math.floor((g.time / g.matrix.duration) * 3))]++;
        g.player.hp = g.player.stats.maxHp;
        g.state = 'playing';
      }

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
      for (const e of g.enemies) if (e.elite) porteursVus.add(e.uid);
      {
        const pr = Math.min(1, g.time / g.matrix.duration);
        const st = g.player.stats;
        const dps = st.dmg * g.player.fireRate * st.projectiles;
        capacite += (dps / (REF_HP * HP_SCALE(pr))) * DT;
      }
      if (g.state === 'won') break;
    }
    out.push({ run, deaths, deathPhase, marks, niveauFinal: g.player.level,
      tues: g.player.kills, score: g.score, porteurs: porteursVus.size,
      engage: +(g.player.kills / Math.max(1, capacite)).toFixed(3) });
  }
  return out;
}, { runs: RUNS, matrice: MATRICE, nageOvr: NAGE_OVR });

console.log(`matrice : ${MATRICE}${NAGE_OVR ? '  nage ' + JSON.stringify(NAGE_OVR) : ''}`);
for (const r of result) {
  console.log(`--- run ${r.run} : niveau ${r.niveauFinal}, score ${r.score}, ${r.tues} tues, `
    + `${r.porteurs} porteurs, `
    + `${r.deaths} mort(s) [debut ${r.deathPhase[0]} / milieu ${r.deathPhase[1]} / fin ${r.deathPhase[2]}] ---`);
  for (const m of r.marks) {
    console.log(`  ${String(Math.floor(m.t / 60)).padStart(2)}:${String(m.t % 60).padStart(2, '0')}`
      + `  niv ${String(m.niv).padStart(2)}  dps ${String(m.dps).padStart(3)}`
      + `  mobs ${String(m.mobs).padStart(2)}  au sol ${String(m.auSol).padStart(3)}`
      + `  pH ${m.ph.toFixed(2)}  tues ${m.tues}`);
  }
}
const niv = result.map((r) => r.niveauFinal);
const eng = result.map((r) => r.engage);
console.log(`\nENGAGE_KILL mesure : ${(eng.reduce((a, b) => a + b, 0) / eng.length).toFixed(3)}`
  + `  (runs : ${eng.join(', ')})`);
/* Ce rapport est BIAISE VERS LE BAS — son denominateur ignore auras et zones
   — et on ne le recopie donc PAS tel quel dans le simulateur. Ce qu'on y
   cale est le NIVEAU FINAL ci-dessous : `npm run balance`, politique au
   hasard (le meme pilote qu'ici), doit annoncer le meme. */
console.log('  -> caler ENGAGE_KILL de balance-sim.mjs sur le NIVEAU FINAL, pas sur ce rapport.');
console.log(`niveau final : ${Math.min(...niv)} a ${Math.max(...niv)}`
  + `  (moyenne ${(niv.reduce((a, b) => a + b, 0) / niv.length).toFixed(1)})`);
const ph = [0, 1, 2].map((i) => result.reduce((a, r) => a + r.deathPhase[i], 0));
console.log(`morts par tiers de run : debut ${ph[0]}  milieu ${ph[1]}  fin ${ph[2]}`
  + (ph[2] > ph[0] ? '   (le decrochage est bien a la fin)' : '   ATTENTION : ouverture trop dure'));
console.log(errs.length ? 'ERREURS: ' + errs.join(' | ') : 'aucune erreur');
await browser.close();
srv.close();
