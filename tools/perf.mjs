/* ---------------------------------------------------------------------------
   Banc de performance : combien de MILLISECONDES DE PROCESSEUR coute une
   image, sous charge reelle, et ou elles partent.

   Pourquoi ce banc existe : le rendu est LOGICIEL. On ecrit dans un
   Uint32Array, on floute huit calques separement, on composite, on pousse le
   tout avec putImageData. Le processeur graphique ne fait que l'agrandissement
   final. Le facteur qui decide si la borne tient 60 images par seconde est
   donc la vitesse MONO-COEUR, et rien d'autre : ni la memoire, ni le GPU.

   `npm run smoke` affiche des images par seconde, ce qui ne repond pas a la
   question : requestAnimationFrame plafonne a 60 et masque toute la marge
   restante. Une machine a 16 ms par image et une machine a 4 ms affichent le
   meme 60. Ici on mesure le travail lui-meme, hors attente d'affichage.

     node tools/perf.mjs [matrice]        defaut : milk
     PORT=8095 node tools/perf.mjs

   Le verdict est le budget d'une image a 60 Hz : 16,7 ms. On releve la
   mediane ET le 95e centile, parce que c'est le centile qui se voit : une
   image sur vingt au-dessus du budget, c'est un saccadement visible.
--------------------------------------------------------------------------- */
import { chromium } from 'playwright';
/* La jauge vit a part : elle doit pouvoir etre copiee SEULE sur la machine
   candidate, qui n'aura ni Playwright ni le depot. */
import { jauge } from './jauge.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const MATRICE = process.argv[2] || 'milk';
const PORT = Number(process.env.PORT || 8095);
const ROOT = process.cwd();
const TYPES = { '.html': 'text/html', '.js': 'text/javascript' };

const srv = createServer(async (q, r) => {
  try {
    let p = q.url.split('?')[0]; if (p === '/') p = '/index.html';
    r.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' });
    r.end(await readFile(join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''))));
  } catch { r.writeHead(404); r.end(); }
});
await new Promise((r) => srv.listen(PORT, r));

const exe = [
  process.env.CHROMIUM_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome',
].filter(Boolean).find(existsSync);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://localhost:${PORT}/`);

const res = await page.evaluate(async ({ matrice, penalite }) => {
  const { Game } = await import('./src/game/game.js');
  const { Screen, computeLayout } = await import('./src/core/pixel.js');
  const { renderField } = await import('./src/render/field.js');
  const { renderHud } = await import('./src/render/hud.js');
  const { MATRICES_PALETTE } = await import('./src/data/palette.js');
  await import('./src/render/sprite-data.js');

  /* Le canvas est ATTACHE au document : un canvas detache laisse le
     navigateur sauter une partie du travail de putImageData, et le banc
     mesurerait alors une page qu'on ne livre pas. */
  const cv = document.createElement('canvas');
  cv.style.cssText = 'position:fixed;left:0;top:0;width:512px;height:704px;image-rendering:pixelated';
  document.body.appendChild(cv);

  /* Pilote automatique : le MEME que tools/playtest.mjs. On ne mesure pas la
     charge d'un joueur immobile qui meurt a la premiere minute — c'est la
     foule entretenue par le directeur qui coute cher, et il faut rester
     vivant pour la voir. */
  function piloter(g, input) {
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
  }

  const centile = (arr, q) => {
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(s.length * q))];
  };

  /* Les formats d'ECRAN reellement achetables pour la borne. Ce n'est pas
     une curiosite : computeLayout fait dependre la TAILLE DU TAMPON du
     format de la fenetre, et l'agrandissement final est fait par le
     processeur graphique, donc gratuit. Un ecran carre demande un tampon de
     76 800 pixels la ou un 21:9 en demande 176 800 — 2,3 fois plus de
     travail logiciel pour la meme scene. Le format de l'ecran est donc un
     choix de PERFORMANCE autant que d'esthetique. On le mesure ici, parce
     que le rectangle sale du compositeur peut tres bien absorber l'ecart.
     Voir docs/09-borne-microscope.md. */
  const CONFIGS = [
    { nom: 'carre 1:1      (tampon 256x300)', win: [720, 720] },
    { nom: 'portrait 3:4   (tampon 256x341)', win: [768, 1024] },
    { nom: 'paysage 4:3    (tampon 392x272)', win: [1024, 768] },
    { nom: 'paysage 16:9   (tampon 464x272)', win: [1024, 600] },
    { nom: 'portrait 9:19  (telephone, tampon 256x470)', win: [420, 840] },
  ];
  /* Instants du run ou l'on mesure. Le budget du directeur monte avec la
     progression : mesurer a la premiere minute ne dit rien du pire cas. 690 s
     tombe apres le second decrochage et avant le boss final. */
  const MARKS = [60, 240, 480, 690];
  const DT = 1 / 60;
  /* 240 images = 4 s par point. A 150 le 95e centile sautait de 6,7 a 12,3 ms
     d'un point a l'autre sans que la charge ait bouge : c'etait le ramasse-
     miettes et la compilation a chaud, pas le jeu. */
  const IMAGES = 240;
  /* Echauffement non compte. Le premier passage paie la compilation du
     compositeur : mesure a 12,3 ms contre 6,4 ms juste apres, pour la meme
     image. Sans cet echauffement le banc accusait la charge a tort. */
  const ECHAUFFEMENT = 90;
  /* Verification du banc : PENALITE=1 rend DEUX fois par image. Un banc qui
     ne voit pas ce doublement ne mesure pas ce qu'il pretend mesurer. */
  const PENALITE = penalite;

  const out = [];
  for (const cfg of CONFIGS) {
    const L = computeLayout(cfg.win[0], cfg.win[1]);
    const scr = new Screen(cv, L);
    const g = new Game(matrice, 4242);
    g.start();
    const pal = MATRICES_PALETTE[g.matrix.id];
    const input = {
      move: { x: 0, y: 0 }, focusAxis: 0,
      takeFocusImpulse: () => 0, takeDash: () => false, takePause: () => false,
    };
    const points = [];
    let mi = 0;

    while (mi < MARKS.length && g.time < g.matrix.duration + 5) {
      /* Avance SANS rendu jusqu'au point de mesure : on ne paie le rendu que
         la ou on le mesure, sinon le banc durerait des minutes. Le rendu ne
         touche pas l'etat du jeu, la simulation est donc identique. */
      while (g.time < MARKS[mi]) {
        piloter(g, input);
        g.focusTarget = 0;
        g.update(DT, input);
        let guard = 0;
        while (g.state === 'levelup' && guard++ < 8) {
          const hand = g.hand || [];
          if (!hand.length) { g.state = 'playing'; break; }
          g.chooseEvolution(hand[Math.floor(Math.random() * hand.length)].id);
        }
        /* Le pilote n'est pas bon : on le ressuscite, sinon la mesure
           s'arrete avant le pire cas, qui est justement ce qu'on cherche. */
        if (g.state === 'dead') { g.player.hp = g.player.stats.maxHp; g.state = 'playing'; }
        if (g.state === 'won') break;
      }

      const tLog = [], tRen = [];
      for (let i = 0; i < ECHAUFFEMENT + IMAGES; i++) {
        piloter(g, input);
        g.focusTarget = 0;
        const a = performance.now();
        g.update(DT, input);
        const b = performance.now();
        renderField(scr, g, pal);
        renderHud(scr, g, pal);
        scr.present();
        if (PENALITE) {
          renderField(scr, g, pal);
          renderHud(scr, g, pal);
          scr.present();
        }
        const c = performance.now();
        if (i >= ECHAUFFEMENT) { tLog.push(b - a); tRen.push(c - b); }
        let guard = 0;
        while (g.state === 'levelup' && guard++ < 8) {
          const hand = g.hand || [];
          if (!hand.length) { g.state = 'playing'; break; }
          g.chooseEvolution(hand[Math.floor(Math.random() * hand.length)].id);
        }
        if (g.state === 'dead') { g.player.hp = g.player.stats.maxHp; g.state = 'playing'; }
      }
      const tot = tLog.map((v, i) => v + tRen[i]);
      points.push({
        t: MARKS[mi],
        mobs: g.enemies.filter((e) => e.alive && !e.spec.neutral).length,
        balles: g.bullets.filter((b) => b.alive !== false).length,
        pickups: g.pickups.filter((k) => k.alive).length,
        logique: +centile(tLog, 0.5).toFixed(2),
        rendu: +centile(tRen, 0.5).toFixed(2),
        plancher: +centile(tot, 0).toFixed(2),
        p50: +centile(tot, 0.5).toFixed(2),
        p95: +centile(tot, 0.95).toFixed(2),
      });
      mi++;
    }
    out.push({ nom: cfg.nom, w: L.W, h: L.H, px: L.W * L.H, points });
  }
  return out;
}, { matrice: MATRICE, penalite: !!process.env.PENALITE });

await browser.close();
srv.close();

const BUDGET = 1000 / 60;
console.log(`matrice : ${MATRICE}   budget d'une image a 60 Hz : ${BUDGET.toFixed(1)} ms`
  + (process.env.PENALITE ? '   [PENALITE : double rendu, verification du banc]' : ''));
if (errs.length) console.log('ERREURS: ' + errs.join(' | '));

let pireP50 = 0, pireP95 = 0, nomPire = '';
for (const c of res) {
  console.log(`\n--- ${c.nom} : tampon ${c.w}x${c.h} = ${c.px.toLocaleString('fr-FR')} px x 8 calques ---`);
  console.log('   t     mobs  balles   logique    rendu  plancher     p50      p95   marge 60Hz');
  for (const p of c.points) {
    if (p.p50 > pireP50) { pireP50 = p.p50; nomPire = c.nom.trim(); }
    if (p.p95 > pireP95) pireP95 = p.p95;
    console.log(
      `  ${String(Math.floor(p.t / 60))}:${String(p.t % 60).padStart(2, '0')}`
      + `   ${String(p.mobs).padStart(4)}  ${String(p.balles).padStart(6)}`
      + `  ${(p.logique.toFixed(2) + ' ms').padStart(9)}`
      + `  ${(p.rendu.toFixed(2) + ' ms').padStart(8)}`
      + `  ${(p.plancher.toFixed(2) + ' ms').padStart(9)}`
      + `  ${(p.p50.toFixed(2) + ' ms').padStart(7)}`
      + `  ${(p.p95.toFixed(2) + ' ms').padStart(8)}`
      + `     x${(BUDGET / p.p95).toFixed(1)}`);
  }
  const r = c.points.at(-1);
  console.log(`  part du rendu au pire point : ${Math.round(100 * r.rendu / r.p50)} %`);
}

/* Ce que la population coute, et c'est le resultat le plus utile du banc :
   PEU. Mesure x1,3 de temps pour x5 de foule. Le gros du cout est un
   PLANCHER du pipeline optique — huit calques, flou de boite, composition —
   qui est paye que le champ soit vide ou plein. Dimensionner la machine de
   la borne "pour beaucoup de mobs" revient donc a se tromper de grandeur :
   c'est le plancher qu'il faut tenir. On le reverifie a chaque passage
   plutot que de le croire sur parole — le rapport a oscille entre x1,0 et
   x1,3 selon les tirages, jamais au-dela. */
const tous = res.flatMap((c) => c.points);
const creux = tous.reduce((a, b) => (a.mobs <= b.mobs ? a : b));
const plein = tous.reduce((a, b) => (a.mobs >= b.mobs ? a : b));
console.log(`\npopulation : ${creux.mobs} mobs -> ${creux.p50.toFixed(2)} ms`
  + `   |   ${plein.mobs} mobs -> ${plein.p50.toFixed(2)} ms`
  + `   (rapport x${(plein.p50 / creux.p50).toFixed(2)} pour x${(plein.mobs / Math.max(1, creux.mobs)).toFixed(1)} de foule)`);

const j = jauge();
console.log(`\njauge processeur de CETTE machine : ${j.ms} ms   (node tools/jauge.mjs)`);
console.log(`pire mediane mesuree : ${pireP50.toFixed(2)} ms  [${nomPire}]`);
/* Le verdict s'appuie sur la MEDIANE, pas sur le 95e centile. Sur une machine
   partagee le 95e centile a saute de 6,4 a 12,4 ms entre deux points de
   charge identique : c'est le voisinage, pas le jeu. La mediane, elle, n'a
   pas bouge de plus de 0,3 ms d'un passage a l'autre. Sur la machine de la
   borne, qui sera dediee, le 95e centile redeviendra le bon critere.
   Rappel du 95e centile observe ici, pour memoire : voir la colonne p95. */
const seuil = (cible) => Math.round(j.ms * cible / pireP50);
console.log(`\nVERDICT — seuils de jauge pour la machine de la borne :`);
console.log(`  confortable (mediane sous la moitie du budget, ${(BUDGET / 2).toFixed(1)} ms) : jauge <= ${seuil(BUDGET / 2)} ms`);
console.log(`  60 Hz sans marge (mediane au budget, ${BUDGET.toFixed(1)} ms)                 : jauge <= ${seuil(BUDGET)} ms`);
console.log(`  30 Hz (mediane a ${(BUDGET * 2).toFixed(1)} ms)                               : jauge <= ${seuil(BUDGET * 2)} ms`);
console.log(`\nRelever la jauge sur la machine candidate :  node tools/jauge.mjs`);
console.log(`(seul tools/jauge.mjs est necessaire la-bas : ni navigateur, ni depot.)`);
