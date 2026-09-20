/* ---------------------------------------------------------------------------
   Client minimal Retro Diffusion, pour alimenter la chaine de sprites.

   La cle est lue dans RETRODIFFUSION_API_KEY et n'est JAMAIS ecrite, ni
   journalisee, ni affichee : seules ses six premieres lettres apparaissent.

     node tools/rd.mjs guard              verifie qu'aucune cle n'est versionnee
     node tools/rd.mjs credits            solde, et donc validite de la cle
     node tools/rd.mjs cost "<prompt>"    estimation GRATUITE, rien n'est genere
     node tools/rd.mjs gen <id> "<prompt>" [--w 32] [--h 32] [--style <id>]
                                          ecrit assets/sprites/<id>.png, pret
                                          pour node tools/sprites.mjs import

   API : https://api.retrodiffusion.ai/v2, en-tete X-RD-Token.
--------------------------------------------------------------------------- */
import { writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

const BASE = 'https://api.retrodiffusion.ai/v2';
const cmd = process.argv[2];

/* --------------------------------------------------------------- guard --- */
/* Un garde-fou qui vaut mieux qu'une bonne intention : on verifie qu'aucun
   fichier SUIVI PAR GIT ne contient de cle. */
if (cmd === 'guard' || cmd === undefined) {
  let hits = '';
  try {
    hits = execFileSync('git', ['grep', '-nI', '-e', 'rdpk-', '--', '.'],
      { encoding: 'utf8' });
  } catch { /* git grep sort en 1 quand il ne trouve rien : c'est le bon cas */ }
  /* Une vraie cle a une longue partie aleatoire ; les mentions de doc et les
     exemples n'en ont pas. On ne garde que ce qui ressemble a une vraie. */
  const REAL_KEY = /rdpk-[A-Za-z0-9_-]{16,}/;
  const PLACEHOLDER = /rdpk-(YOUR|VOTRE|XXX|\.\.\.)/i;
  const real = hits.split('\n')
    .filter((l) => l && REAL_KEY.test(l) && !PLACEHOLDER.test(l));
  if (real.length) {
    console.error('CLE VERSIONNEE, a revoquer immediatement :');
    for (const l of real) console.error('  ' + l.split(':').slice(0, 2).join(':'));
    process.exit(1);
  }
  console.log('guard : aucune cle dans les fichiers suivis par git.');
  if (cmd === 'guard') process.exit(0);
}

const KEY = process.env.RETRODIFFUSION_API_KEY;
if (!KEY) {
  console.error(`
RETRODIFFUSION_API_KEY n'est pas definie.

  Sur Claude Code web : reglages de l'environnement > variables
  d'environnement. C'est le seul endroit qui survive a la session.

  En local : cp .env.example .env, puis remplir. Le .env est ignore par git.

Ne colle jamais la cle dans une conversation ni dans un fichier du depot.`);
  process.exit(1);
}
if (!KEY.startsWith('rdpk-')) {
  console.error('La cle ne commence pas par rdpk- : verifie qu\'elle est complete.');
  process.exit(1);
}
const masked = `${KEY.slice(0, 9)}...`;

async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'X-RD-Token': KEY,
      'Content-Type': 'application/json',
      ...(method === 'POST' ? { 'Idempotency-Key': randomUUID() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* reponse non JSON */ }
  if (!res.ok) {
    console.error(`HTTP ${res.status} sur ${path}`);
    console.error(text.slice(0, 600));
    process.exit(1);
  }
  return json ?? text;
}

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
};

if (cmd === 'credits') {
  console.log(`cle ${masked}`);
  console.log(JSON.stringify(await call('/inferences/credits'), null, 2));
  process.exit(0);
}

if (cmd === 'cost' || cmd === 'gen') {
  const isGen = cmd === 'gen';
  const id = isGen ? process.argv[3] : null;
  const prompt = isGen ? process.argv[4] : process.argv[3];
  if (!prompt) {
    console.error(isGen
      ? 'usage : node tools/rd.mjs gen <id> "<prompt>" [--w 32] [--h 32] [--style <id>]'
      : 'usage : node tools/rd.mjs cost "<prompt>"');
    process.exit(1);
  }
  const payload = {
    prompt,
    prompt_style: arg('style', 'rd_plus__default'),
    width: Number(arg('w', 32)),
    height: Number(arg('h', 32)),
    num_images: 1,
    ...(isGen ? {} : { check_cost: true }),
  };

  const out = await call('/inferences', { method: 'POST', body: payload });

  if (!isGen) {
    console.log('estimation (rien n\'a ete genere) :');
    console.log(JSON.stringify(out, null, 2));
    process.exit(0);
  }

  /* Le schema exact de reponse n'a pas encore ete confirme contre l'API
     reelle : on couvre les formes courantes, et sinon on affiche le JSON
     brut pour s'y adapter en une ligne. */
  const b64 = out?.base64_images?.[0] ?? out?.images?.[0]?.base64
    ?? out?.data?.[0]?.b64_json ?? (typeof out?.images?.[0] === 'string' ? out.images[0] : null);
  if (b64) {
    const file = join('assets/sprites', `${id}.png`);
    await writeFile(file, Buffer.from(b64.replace(/^data:image\/\w+;base64,/, ''), 'base64'));
    console.log(`ecrit ${file}`);
    console.log('puis : node tools/sprites.mjs import');
    process.exit(0);
  }
  if (out?.task_id) {
    console.log(`tache ${out.task_id} en file. Interroger :`);
    console.log(`  curl -H "X-RD-Token: $RETRODIFFUSION_API_KEY" ${BASE}/inferences/tasks/${out.task_id}`);
    process.exit(0);
  }
  console.log('reponse inattendue, a mapper :');
  console.log(JSON.stringify(out, null, 2).slice(0, 1200));
  process.exit(0);
}

console.error('commande inconnue. Voir l\'entete de tools/rd.mjs.');
process.exit(1);
