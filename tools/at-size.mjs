/* ---------------------------------------------------------------------------
   Compare des images A LA TAILLE REELLE DU JEU.

   C'est le seul juge qui vaille : un sprite peut etre superbe en grand et
   illisible a 28 px. Mesure faite, un strength eleve en img2img ajoute un
   lisere lumineux qui FUSIONNE les cellules d'une grappe a cette taille.

     SIZE=28 node tools/at-size.mjs a.png b.png c.png   -> /tmp/at-size.png
--------------------------------------------------------------------------- */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';

const ROOT = process.cwd();
const SIZE = Number(process.env.SIZE || 28);
const OUT = process.env.OUT || '/tmp/at-size.png';
const srv = createServer(async (q, r) => {
  try {
    const p = decodeURIComponent(q.url.split('?')[0]);
    const b = await readFile(join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, '')));
    r.writeHead(200, { 'content-type': extname(p) === '.png' ? 'image/png' : 'text/html' });
    r.end(b);
  } catch { r.writeHead(404); r.end(); }
});
await new Promise((r) => srv.listen(8090, r));
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(existsSync);
const b = await chromium.launch(exe ? { executablePath: exe } : {});
const pg = await b.newPage({ viewport: { width: 1400, height: 620 } });
await pg.goto('http://localhost:8090/index.html');

const shots = [];
for (const f of process.argv.slice(2)) {
  const url = await pg.evaluate(async ([u, s]) => {
    const img = new Image(); img.src = u; await img.decode();
    const c = document.createElement('canvas'); c.width = s; c.height = s;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, s, s);
    return c.toDataURL('image/png');
  }, ['http://localhost:8090/' + f, SIZE]);
  shots.push({ f, url });
}
await pg.setContent(`<body style="margin:0;background:#04080c;display:flex;gap:26px;padding:24px;font:12px monospace;color:#9ab;align-items:flex-start">
${shots.map((s) => `<figure style="margin:0;text-align:center">
  <img src="${s.url}" style="image-rendering:pixelated;width:${SIZE * 3}px;height:${SIZE * 3}px;background:#000;display:block;margin:0 auto 6px">
  <img src="${s.url}" style="image-rendering:pixelated;width:${SIZE * 11}px;height:${SIZE * 11}px;background:#000;display:block">
  <figcaption style="margin-top:6px">${s.f.split('/').pop()}</figcaption></figure>`).join('')}
</body>`);
await pg.waitForTimeout(400);
await pg.screenshot({ path: OUT });
console.log(`${shots.length} image(s) a ${SIZE}px -> ${OUT}`);
await b.close(); srv.close();
