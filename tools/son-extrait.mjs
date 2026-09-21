/* ---------------------------------------------------------------------------
   Rend un extrait de bande son en WAV, pour l'ECOUTER.

   Le rendu hors ligne de son-check.mjs verifie que les mappages repondent ;
   il ne dit rien de ce que ca vaut musicalement. Pour ca il faut entendre.

   L'extrait parcourt un arc : lobby, puis une matrice dont l'intensite monte
   de zero a un, puis une autre. C'est la seule facon de juger si les couches
   arrivent au bon moment.

     node tools/son-extrait.mjs [matrice] [secondes]  -> assets/reference/son.wav
--------------------------------------------------------------------------- */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const MATRICE = process.argv[2] || 'milk';
const DUREE = Number(process.argv[3] || 30);
const OUT = process.env.OUT || 'assets/reference/son.wav';
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
await new Promise((r) => srv.listen(8101, r));
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(existsSync);
const b = await chromium.launch(exe ? { executablePath: exe } : {});
const pg = await b.newPage();
pg.on('pageerror', (e) => console.log('ERREUR', e.message));
await pg.goto('http://localhost:8101/');

const canaux = await pg.evaluate(async ({ matrice, duree }) => {
  const mod = await import('./src/audio/son.js');
  const s = new mod.Son();
  const SR = 44100;
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * duree), SR);
  s.graine(0x5eed);
  s.init(ctx);
  if (!s.pret) return null;

  /* L'arc : un quart de lobby, puis la matrice avec l'intensite qui monte,
     et une pointe de danger sur la fin. */
  const bascule = duree * 0.25;
  s.appliquerAmbiance('ambiant', true);
  s.intensite = 0; s.danger = 0; s.miseAuPoint = 0;
  s.majCouches();
  let basculee = false;
  for (let t = 0; t < duree; t += 0.05) {
    if (!basculee && t >= bascule) { s.appliquerAmbiance(matrice); basculee = true; }
    if (basculee) {
      const u = (t - bascule) / Math.max(0.01, duree - bascule);
      s.intensite = Math.min(1, u * 1.25);
      s.danger = u > 0.75 ? (u - 0.75) * 3 : 0;
      /* Un coup d'oeil en profondeur vers les deux tiers, pour entendre le
         filtre se fermer. */
      s.miseAuPoint = (u > 0.55 && u < 0.68) ? 0.9 : 0;
      if (Math.random() < 0.05) s.evenement(Math.random() < 0.7 ? 'kill' : 'coup');
    }
    s.majCouches();
    s.avancerJusqua(t);
  }
  const buf = await ctx.startRendering();
  return [Array.from(buf.getChannelData(0)), Array.from(buf.getChannelData(1))];
}, { matrice: MATRICE, duree: DUREE });

if (!canaux) { console.log('le moteur n a pas demarre'); await b.close(); srv.close(); process.exit(1); }

/* --- ecriture WAV 16 bits ---------------------------------------------- */
const [G, D] = canaux;
const n = G.length;
const buf = Buffer.alloc(44 + n * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8);
buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22); buf.writeUInt32LE(44100, 24);
buf.writeUInt32LE(44100 * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
let crete = 0;
for (let i = 0; i < n; i++) crete = Math.max(crete, Math.abs(G[i]), Math.abs(D[i]));
/* Normalisation douce : on vise -3 dBFS, sans compresser. */
const k = crete > 0 ? 0.71 / crete : 1;
for (let i = 0; i < n; i++) {
  buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(G[i] * k * 32767))), 44 + i * 4);
  buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(D[i] * k * 32767))), 46 + i * 4);
}
/* Un chemin absolu doit rester absolu : join(ROOT, '/tmp/x') le recolle
   derriere la racine du depot. */
await writeFile(OUT.startsWith('/') ? OUT : join(ROOT, OUT), buf);
console.log(`extrait ${MATRICE}, ${DUREE} s, crete ${crete.toFixed(3)} -> ${OUT}`);
await b.close(); srv.close();
