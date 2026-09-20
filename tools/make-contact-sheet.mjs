/* Exporte tools/contact-sheet.html en PNG dans assets/reference/. */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const ROOT = process.cwd();
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = createServer(async (q, r) => {
  try {
    const p = decodeURIComponent(q.url.split('?')[0]);
    /* Lire AVANT d'ecrire l'entete : sinon un fichier manquant declenche un
       second writeHead et le serveur casse. */
    const body = await readFile(join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, '')));
    r.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' });
    r.end(body);
  } catch { r.writeHead(404); r.end(); }
});
await new Promise((r) => srv.listen(8094, r));
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(existsSync);
const b = await chromium.launch(exe ? { executablePath: exe } : {});
const pg = await b.newPage({ viewport: { width: 1480, height: 1000 }, deviceScaleFactor: 2 });
pg.on('pageerror', (e) => console.error('ERREUR', e.message));
await pg.goto('http://localhost:8094/tools/contact-sheet.html');
await pg.waitForFunction(() => window.__ready === true, { timeout: 15000 });
await pg.waitForTimeout(300);
const out = process.env.SHOT_DIR || 'assets/reference';
await pg.locator('#wrap').screenshot({ path: `${out}/contact-sheet.png` });
console.log(`planche ecrite dans ${out}/contact-sheet.png`);
await b.close(); srv.close();
