/* Agrandit un carre d'une capture, au plus proche voisin.
     node tools/zoom.mjs <png> [cx] [cy] [taille] [zoom]   -> /tmp/.../zoom.png
   Sans centre, on prend le centre de l'image : c'est la que vit le joueur. */
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
const [src, cxA, cyA, tA, zA] = process.argv.slice(2);
const T = Number(tA || 110), Z = Number(zA || 8);
const OUT = process.env.OUT || '/tmp/zoom.png';
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(existsSync);
const b = await chromium.launch(exe ? { executablePath: exe } : {});
const pg = await b.newPage();
const b64 = (await readFile(src)).toString('base64');
const out = await pg.evaluate(async ({ b64, T, Z, cxA, cyA }) => {
  const img = new Image();
  await new Promise((r) => { img.onload = r; img.src = 'data:image/png;base64,' + b64; });
  const cx = cxA !== undefined && cxA !== '' ? Number(cxA) : img.width / 2;
  const cy = cyA !== undefined && cyA !== '' ? Number(cyA) : img.height / 2;
  const cv = document.createElement('canvas');
  cv.width = T * Z; cv.height = T * Z;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.drawImage(img, cx - T / 2, cy - T / 2, T, T, 0, 0, T * Z, T * Z);
  return cv.toDataURL('image/png');
}, { b64, T, Z, cxA, cyA });
await writeFile(OUT, Buffer.from(out.split(',')[1], 'base64'));
console.log('zoom ->', OUT);
await b.close();
