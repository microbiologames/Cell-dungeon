/* ---------------------------------------------------------------------------
   Cherche une DERIVE : un niveau qui monte tout seul a etat de jeu constant.

   Signale a l'oreille : « un sifflement arrive tres progressivement pour finir
   par occuper tout l'espace ». Un son qui s'installe alors que rien ne change
   dans le jeu ne peut venir que d'une boucle qui s'accumule — une reverbe ou
   un delai dont le gain de boucle est trop proche de un, nourris en continu.

   On rend donc une minute a etat FIGE et on mesure le niveau efficace par
   fenetres de cinq secondes. Si ca monte, c'est mecanique.

     node tools/son-derive.mjs
--------------------------------------------------------------------------- */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const ROOT = process.cwd();
const srv = createServer(async (q, r) => {
  try {
    let p = decodeURIComponent(q.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const b = await readFile(join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, '')));
    r.writeHead(200, { 'content-type': extname(p) === '.html' ? 'text/html' : 'text/javascript' });
    r.end(b);
  } catch { r.writeHead(404); r.end(); }
});
await new Promise((r) => srv.listen(8102, r));
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(existsSync);
const b = await chromium.launch(exe ? { executablePath: exe } : {});
const pg = await b.newPage();
pg.on('pageerror', (e) => console.log('ERREUR', e.message));
await pg.goto('http://localhost:8102/');

const res = await pg.evaluate(async () => {
  const mod = await import('./src/audio/son.js');
  const sorties = [];
  for (const [nom, amb, I] of [['lobby', 'ambiant', 0], ['lait mi-partie', 'milk', 0.55]]) {
    const s = new mod.Son();
    s.graine(0x5eed);
    const SR = 22050, duree = 60;
    const ctx = new OfflineAudioContext(1, SR * duree, SR);
    s.init(ctx);
    s.appliquerAmbiance(amb, true);
    s.intensite = I; s.danger = 0; s.miseAuPoint = 0;
    s.majCouches();
    for (let t = 0; t < duree; t += 0.05) s.avancerJusqua(t);
    const buf = await ctx.startRendering();
    const g = buf.getChannelData(0);

    /* Niveau efficace par fenetre de 5 s, et crete de la fenetre. */
    const F = SR * 5;
    const fen = [];
    for (let w = 0; w + F <= g.length; w += F) {
      let sum = 0, crete = 0;
      for (let i = w; i < w + F; i++) { sum += g[i] * g[i]; if (Math.abs(g[i]) > crete) crete = Math.abs(g[i]); }
      fen.push({ rms: Math.sqrt(sum / F), crete });
    }
    sorties.push({ nom, fen: fen.map((f) => [+f.rms.toFixed(4), +f.crete.toFixed(3)]) });
  }
  return sorties;
});

for (const s of res) {
  console.log(`\n${s.nom}`);
  console.log('  s   ', s.fen.map((_, i) => String(i * 5).padStart(6)).join(''));
  console.log('  rms ', s.fen.map((f) => String(f[0]).padStart(6)).join(''));
  console.log('  crete', s.fen.map((f) => String(f[1]).padStart(6)).join(''));
  const a = s.fen[0][0], z = s.fen[s.fen.length - 1][0];
  const croissance = a > 0 ? z / a : 0;
  console.log(`  derive : x${croissance.toFixed(2)} entre la premiere et la derniere fenetre`
    + (croissance > 1.35 ? '   <-- CA MONTE TOUT SEUL' : '   (stable)'));
}
await b.close(); srv.close();
