/* ---------------------------------------------------------------------------
   ON NE DOIT PLUS POUVOIR S'ECHAPPER.

   Le defaut mesure ici est precis : dans une goutte sans obstacle, la bonne
   reponse a n'importe quelle vague etait de partir en ligne droite. La
   poursuite ne se terminait jamais, on gagnait a tous les coups, et le budget
   de menace du directeur ne voulait plus rien dire puisque la menace restait
   derriere. Le recyclage (`Game.recyclerLoin`) repose devant le joueur les
   mobs qu'il a distances.

   Le banc pilote le VRAI jeu avec un fuyard : il part en ligne droite et ne
   pilote rien d'autre. Il TIRE quand meme — le tir est automatique et le
   desactiver ne mesurerait plus le jeu — et c'est d'ailleurs ce qui explique
   qu'il reste moins de mobs vivants avec recyclage que sans : sans
   recyclage, aucun mob n'entre jamais a portee, donc aucun ne meurt.

   Ce qu'on regarde est ce que le fuyard trouve DEVANT lui, et la
   distribution des distances en fin de course.

     node tools/fuite.mjs [matrice]
--------------------------------------------------------------------------- */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const MATRICE = process.argv[2] || 'milk';
const ROOT = process.cwd();
const TYPES = { '.html': 'text/html', '.js': 'text/javascript' };
const srv = createServer(async (q, r) => {
  try {
    let p = q.url.split('?')[0]; if (p === '/') p = '/index.html';
    r.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' });
    r.end(await readFile(join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''))));
  } catch { r.writeHead(404); r.end(); }
});
await new Promise((r) => srv.listen(8095, r));
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(existsSync);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://localhost:8095/');

const res = await page.evaluate(async (matrice) => {
  const { Game } = await import('./src/game/game.js');

  /**
   * Fait fuir un joueur EN LIGNE DROITE et mesure ce qu'il rencontre DEVANT.
   *
   * Deux details ont fait toute la difference, et les deux etaient des
   * defauts du banc, pas du jeu :
   *
   *   - Le premier fuyard changeait de cap toutes les huit secondes. Il
   *     tournait en rond : il n'echappait a personne, et le banc mesurait
   *     plus de mobs a portee SANS recyclage qu'avec. On ne teste la fuite
   *     qu'en fuyant vraiment.
   *   - Compter les mobs « a portee » ne dit rien : quand on fuit, la meute
   *     est derriere, et derriere on s'en moque. Ce qui decide si la fuite
   *     paie est ce qu'on trouve DEVANT.
   *
   * L'arene du lait fait 1600 px de rayon pour un champ visible de 124 : il
   * y a largement de quoi fuir, et c'est bien le probleme qu'on corrige.
   */
  function fuir(recyclage, duree = 120, graine = 4242) {
    const g = new Game(matrice, graine);
    g.start();
    g.recyclage = recyclage;
    const input = {
      move: { x: 0, y: 0 }, focusAxis: 0,
      takeFocusImpulse: () => 0, takeDash: () => false, takePause: () => false,
    };
    const DT = 1 / 60;
    const steps = Math.round(duree / DT);
    const devant = [];
    const medianes = [];
    let cap = 0.3;
    for (let i = 0; i < steps; i++) {
      const p = g.player;
      /* Tout droit, et on ne tourne QUE pour ne pas s'ecraser sur la paroi.
         Un demi-tour de 140 degres, pas un virage : le fuyard doit repartir
         vers du champ libre, pas longer le bord. */
      if (!g.arena.contains(p.x + Math.cos(cap) * 220, p.y + Math.sin(cap) * 220, 8)) {
        cap += 2.44;
      }
      input.move.x = Math.cos(cap);
      input.move.y = Math.sin(cap);
      /* Invulnerable : on mesure la poursuite, pas la survie. Sans ca le
         fuyard meurt et le banc mesure un cadavre. */
      p.hp = p.stats.maxHp;
      g.update(DT, input);
      if (i % 60 === 0 && i > steps / 2) {
        let n = 0;
        for (const e of g.enemies) {
          if (!e.alive || e.spec.neutral || e.ally > 0 || !e.speed) continue;
          const dx = e.x - p.x, dy = e.y - p.y;
          const d = Math.hypot(dx, dy);
          /* 180 et non 130 : le recyclage repose les mobs entre 118 et 172 px
             (RECYCLE_MIN/MAX dans game.js), et mesurer a 130 en coupait la
             moitie. On mesurait le seuil du banc, pas le jeu. */
          if (d > 180 || d < 1) continue;
          /* DEVANT : dans le demi-plan du cap, avec un peu de marge. */
          if ((dx / d) * Math.cos(cap) + (dy / d) * Math.sin(cap) > 0.2) n++;
        }
        devant.push(n);
        /* La MEDIANE des distances a la meute hostile. C'est elle qui dit si
           on est seul, et elle ne depend d'aucun seuil arbitraire — contre
           un comptage « devant a tant de pixels », qui mesurait surtout le
           rayon que j'avais choisi. */
        const ds = [];
        for (const e of g.enemies) {
          if (!e.alive || e.spec.neutral || e.ally > 0 || !e.speed) continue;
          ds.push(Math.hypot(e.x - p.x, e.y - p.y));
        }
        if (ds.length) {
          ds.sort((a, b) => a - b);
          medianes.push(ds[ds.length >> 1]);
        }
      }
    }
    const moy = devant.reduce((a, b) => a + b, 0) / Math.max(1, devant.length);
    const med = medianes.reduce((a, b) => a + b, 0) / Math.max(1, medianes.length);
    /* Diagnostic : la distribution des distances en fin de course. Sans elle
       on regle le seuil d'oubli a l'aveugle. */
    const ds = [];
    for (const e of g.enemies) {
      if (!e.alive || e.spec.neutral || e.ally > 0 || !e.speed) continue;
      ds.push(Math.hypot(e.x - g.player.x, e.y - g.player.y));
    }
    ds.sort((a, b) => a - b);
    return { devant: +moy.toFixed(2), meute: Math.round(med),
      recycles: g.recycles, vus: ds.length, dist: ds.map((d) => Math.round(d)) };
  }

  /* TROIS GRAINES, et la moyenne. Le jeu tire de l'aleatoire non seme
     (`Math.random` dans `makeEnemy`), donc une seule mesure varie du simple
     au triple d'un passage a l'autre — vu entre 1 et 3 mobs devant sur la
     meme version. Un verdict pose sur une mesure aussi bruitee ne garde
     rien : il passe ou echoue selon l'humeur. */
  const moyenne = (recyclage) => {
    const rs = [4242, 91117, 555].map((g) => fuir(recyclage, 120, g));
    const m = (f) => +(rs.reduce((a, r) => a + f(r), 0) / rs.length).toFixed(2);
    return {
      devant: m((r) => r.devant),
      meute: Math.round(m((r) => r.meute)),
      meutes: rs.map((r) => r.meute),
      recycles: Math.round(m((r) => r.recycles)),
      dist: rs[0].dist,
      runs: rs.map((r) => r.devant),
    };
  };
  const avec = moyenne(true);
  const sans = moyenne(false);
  return { avec, sans };
}, MATRICE);

console.log(`matrice ${MATRICE}, fuyard en ligne droite, 120 s, 3 graines\n`);
const ligne = (nom, r) => console.log(`  recyclage ${nom}  meute a `
  + String(r.meute).padStart(5) + ' px  (' + r.meutes.join(' / ') + ')'
  + '   mobs devant ' + String(r.devant).padStart(5)
  + '   repositionnements ' + r.recycles);
ligne('ON ', res.avec);
ligne('OFF', res.sans);
console.log('');

const dit = (ok, t) => console.log(`${ok ? 'ok  ' : 'ECHEC'} ${t}`);
/* Le champ visible fait 124 px de rayon. Tant que la meute se tient sous
   250 px, elle est au pire juste hors de l'ecran et revient tout de suite :
   le joueur n'est jamais seul. Au-dela, il a gagne la course. */
dit(res.avec.meute < 250,
  `on ne seme plus la meute (mediane a ${res.avec.meute} px en fuyant)`);
/* Le TEMOIN, et c'est lui qui donne sa valeur au verdict precedent : sans le
   recyclage, le meme fuyard doit se retrouver seul. Si les deux chiffres se
   ressemblent, le banc ne mesure pas le recyclage mais autre chose. */
/* Le TEMOIN, et c'est lui qui donne sa valeur au verdict precedent : sans
   recyclage, le meme fuyard doit se retrouver a des centaines de pixels de
   quiconque. Mesure : 1350 px, soit onze fois le champ visible. */
dit(res.sans.meute > res.avec.meute * 4,
  `et sans lui on la seme pour de bon (${res.sans.meute} px contre ${res.avec.meute})`);
dit(res.avec.recycles > 0 && res.sans.recycles === 0,
  `le drapeau de banc agit vraiment (${res.avec.recycles} contre ${res.sans.recycles})`);
console.log('\n  distances ON  :', JSON.stringify(res.avec.dist));
console.log('  distances OFF :', JSON.stringify(res.sans.dist));
console.log(errs.length ? 'ERREURS: ' + errs.join(' | ') : 'aucune erreur de page');
await browser.close(); srv.close();
process.exit(errs.length ? 1 : 0);
