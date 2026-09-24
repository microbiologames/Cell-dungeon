/* ---------------------------------------------------------------------------
   Banc de la boite de Petri de la borne.

   Ce que ce banc garde, et pourquoi il existe : la couleur de la boite est
   une donnee qu'on ne peut pas juger a l'ecran. Elle sera diffusee par un
   anneau de LED a travers un acrylique opale, a un metre du joueur, et c'est
   la SEPARATION entre les cinq milieux qui porte toute l'information. Trois
   des cinq matrices sont reellement dans les jaunes-beiges : rien n'est plus
   facile que de les laisser converger sans s'en apercevoir, surtout apres le
   virage acide qui les tire toutes vers le meme jaune.

   Tourne en node pur : `couleurBoite` est une fonction pure, sans navigateur
   ni liaison serie.

     npm run leds
     DEFAUT=sombre npm run leds     verifie que le banc attrape le defaut
     DEFAUT=jumeau npm run leds
     DEFAUT=fige   npm run leds
--------------------------------------------------------------------------- */

import { MATRICES_PALETTE, LED_ACIDE } from '../src/data/palette.js';
import { couleurBoite, Leds } from '../src/borne/leds.js';

const IDS = ['milk', 'pipe', 'kombucha', 'levain', 'blood'];
const comp = (c) => [c & 255, (c >> 8) & 255, (c >> 16) & 255];
const REPOS = { acidite: 0, intensite: 0, danger: 0, nep: 0, t: 0 };

/* --- injection de defaut, pour verifier que le banc garde quelque chose --- */
const DEFAUT = process.env.DEFAUT || '';
if (DEFAUT === 'sombre') {
  /* Une matrice dont la boite s'eteint : exactement ce qui arriverait si on
     asservissait les LED a `bg` au lieu de `led`. */
  MATRICES_PALETTE.milk.led = 0xff050505;
} else if (DEFAUT === 'jumeau') {
  /* Le levain reprend la couleur du lait : deux stages indiscernables. */
  MATRICES_PALETTE.levain.led = MATRICES_PALETTE.milk.led;
} else if (DEFAUT === 'fige') {
  /* Le kombucha part deja de la couleur d'arrivee du virage : l'acidification
     ne se voit plus du tout sur la boite. */
  MATRICES_PALETTE.kombucha.led = LED_ACIDE;
}

/** Distance perceptuelle « redmean » : approximation classique, bien meilleure
 *  qu'une distance RGB brute sur des teintes chaudes voisines, et assez simple
 *  pour qu'on sache ce qu'elle mesure. */
function distance(a, b) {
  const rm = (a[0] + b[0]) / 2;
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

/** Est-ce que la boite est ALLUMEE : le canal le plus ouvert des trois.
 *
 *  Premiere version de ce banc : luminance relative Rec. 709. Elle donnait au
 *  sang 0,19 et le declarait eteint. C'etait la mesure qui etait fausse, pas
 *  la couleur : la Rec. 709 pondere le rouge a 0,2126 parce qu'elle modelise
 *  la perception d'une SURFACE ECLAIREE, alors qu'un rouge pur (255,0,0) sur
 *  une LED est eclatant et y tombe pourtant a 0,21. Appliquee ici, elle
 *  condamnait toute boite rouge — et le sang est rouge.
 *
 *  Ce qui compte pour une LED est la puissance qu'elle emet sur son canal le
 *  plus ouvert. Le critere separe d'ailleurs bien mieux : 0,69 pour le sang,
 *  0,04 pour le fond le plus sombre des matrices. */
const allumage = (c) => Math.max(c[0], c[1], c[2]) / 255;
/** Gardee pour l'affichage : elle dit la clarte percue, qui reste une
 *  information utile pour comparer deux teintes chaudes. */
const lum = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;

/* --- releves ------------------------------------------------------------- */

const repos = {}, acide = {};
for (const id of IDS) {
  repos[id] = couleurBoite(id, REPOS);
  acide[id] = couleurBoite(id, { ...REPOS, acidite: 1 });
}

console.log('couleur de la boite, par matrice');
console.log('matrice'.padEnd(10), 'au repos'.padEnd(18), 'allum'.padStart(6),
  'clarte'.padStart(7), '   au pH plancher'.padEnd(21), 'allum'.padStart(6),
  '   allumage vs bg');
for (const id of IDS) {
  const r = repos[id], a = acide[id];
  const bg = comp(MATRICES_PALETTE[id].bg);
  console.log(id.padEnd(10),
    `rgb(${r.join(',')})`.padEnd(18), allumage(r).toFixed(2).padStart(6),
    lum(r).toFixed(2).padStart(7),
    `   rgb(${a.join(',')})`.padEnd(21), allumage(a).toFixed(2).padStart(6),
    `             x${(allumage(r) / Math.max(0.004, allumage(bg))).toFixed(1)}`);
}

/* Separation deux a deux, au repos ET au pH plancher : c'est la seconde qui
   est la vraie contrainte, puisque le virage acide tire tout le monde vers le
   meme jaune. */
console.log('\nseparation deux a deux (distance perceptuelle)');
console.log('paire'.padEnd(22), 'au repos'.padStart(9), 'pH plancher'.padStart(12));
let pireRepos = Infinity, pireAcide = Infinity, pirePaire = '';
for (let i = 0; i < IDS.length; i++) {
  for (let j = i + 1; j < IDS.length; j++) {
    const dr = distance(repos[IDS[i]], repos[IDS[j]]);
    const da = distance(acide[IDS[i]], acide[IDS[j]]);
    if (dr < pireRepos) pireRepos = dr;
    if (da < pireAcide) { pireAcide = da; pirePaire = `${IDS[i]}/${IDS[j]}`; }
    console.log(`${IDS[i]} / ${IDS[j]}`.padEnd(22),
      dr.toFixed(0).padStart(9), da.toFixed(0).padStart(12));
  }
}

/* La reponse au pH doit etre MONOTONE. Regle du depot : une mesure non
   monotone est une mesure fausse, pas une decouverte. Une boite qui
   reviendrait sur ses pas pendant que le pH descend dirait n'importe quoi. */
const PAS = 21;
const monotonie = {};
for (const id of IDS) {
  let ecartTotal = 0, retours = 0;
  let prec = couleurBoite(id, { ...REPOS, acidite: 0 });
  const depart = prec;
  for (let k = 1; k < PAS; k++) {
    const c = couleurBoite(id, { ...REPOS, acidite: k / (PAS - 1) });
    /* On mesure l'eloignement au point de depart : il doit croitre a chaque
       pas, sans jamais revenir en arriere. */
    if (distance(c, depart) < distance(prec, depart) - 0.5) retours++;
    ecartTotal = distance(c, depart);
    prec = c;
  }
  monotonie[id] = { ecartTotal, retours };
}

console.log('\nvirage acide : eloignement a la couleur de depart');
console.log('matrice'.padEnd(10), 'ecart au plancher'.padStart(18), 'retours'.padStart(9));
for (const id of IDS) {
  console.log(id.padEnd(10), monotonie[id].ecartTotal.toFixed(0).padStart(18),
    String(monotonie[id].retours).padStart(9));
}

/* --- tenue aux etats extremes -------------------------------------------- */
let horsBornes = 0, nonFini = 0;
const EXTREMES = [-5, -1, 0, 0.5, 1, 2, 9e9, NaN];
for (const id of [...IDS, 'matrice-inexistante']) {
  for (const a of EXTREMES) for (const d of EXTREMES) for (const n of [0, 0.5, 1]) {
    const c = couleurBoite(id, { acidite: a, intensite: d, danger: d, nep: n, t: 7.3 });
    for (const v of c) {
      if (!Number.isFinite(v)) nonFini++;
      else if (v < 0 || v > 255) horsBornes++;
    }
  }
}

/* --- le module ne doit rien casser sans liaison serie --------------------- */
let leveApres = null, envoye = 0;
const faux = new Leds();
/* On compte ce que le module TENTERAIT d'envoyer, liaison ouverte, pour
   verifier le debit. Sans ce piege on ne mesurerait rien : sans WebSerial le
   module n'ecrit jamais, ce qui est justement l'autre verdict. */
faux.actif = true;
faux._ecrire = () => { envoye++; return Promise.resolve(); };
const jeuBidon = {
  matrix: { id: 'milk', chem: { phStart: 6.7, phFloor: 5.0 } },
  ph: 6.7, progress: 0.5, flash: 0,
  director: { targetCredits: () => 20, liveCredits: () => 14 },
  player: { hp: 60, stats: { maxHp: 100 } },
  boss: null, conduite: null,
};
/* 10 secondes de jeu a 60 images par seconde, avec un pH qui descend. */
try {
  for (let i = 0; i < 600; i++) {
    jeuBidon.ph = 6.7 - 1.7 * (i / 600);
    faux.observe('jeu', jeuBidon, 1 / 60);
  }
} catch (e) { leveApres = e.message; }
/* La vivacite se juge ICI, sur du jeu normal. Les entrees absurdes qui
   suivent mettent le module en sommeil a dessein — c'est son contrat — et les
   mesurer ensemble faisait echouer le verdict pour la mauvaise raison. */
const vivantApresJeu = !faux.mort;
try {
  faux.observe('jeu', null, 1 / 60);
  faux.observe('lobby', undefined, 0);
  faux.observe('jeu', { matrix: null }, 1 / 60);
} catch (e) { leveApres = e.message; }
const hzEmis = envoye / 10;

/* Le vrai module, sans liaison : il ne doit rien emettre du tout. */
let envoyeSansLien = 0;
const nu = new Leds();
nu._ecrire = () => { envoyeSansLien++; return Promise.resolve(); };
for (let i = 0; i < 120; i++) nu.observe('jeu', jeuBidon, 1 / 60);

/* --- verdicts ------------------------------------------------------------ */
const dit = (ok, texte) => { if (!ok) echecs++; console.log(`${ok ? 'ok  ' : 'ECHEC'} ${texte}`); };
let echecs = 0;
console.log('');
if (DEFAUT) console.log(`[DEFAUT INJECTE : ${DEFAUT} — le banc DOIT signaler un echec]\n`);

dit(IDS.every((id) => !!MATRICES_PALETTE[id].led),
  'les cinq matrices ont une couleur de boite');

/* Seuil a 0,45 : la plus sombre des cinq teintes retenues (le sang) mesure
   0,69, et les fonds `bg` qu'il s'agit de ne PAS reproduire sont entre 0,04 et
   0,91. Le seuil est place assez haut pour attraper une boite qu'on aurait
   asservie a un `bg` sombre, et assez bas pour laisser passer une teinte
   saturee legitime. */
const SEUIL_ALLUM = 0.45;
const sombre = IDS.filter((id) => allumage(repos[id]) < SEUIL_ALLUM);
dit(sombre.length === 0,
  `aucune boite eteinte (allumage >= ${SEUIL_ALLUM})`
  + (sombre.length ? ` — ${sombre.map((id) => `${id} ${allumage(repos[id]).toFixed(2)}`).join(', ')}` : ''));

/* Seuil a 60 : mesure, la paire la plus serree des cinq teintes retenues est
   a 96 au repos et 82 au pH plancher. Un seuil a 60 laisse donc une marge
   confortable tout en attrapant une convergence reelle — les deux defauts
   injectables tombent a moins de 20. Le verdict ne tient pas a un reglage
   fin du seuil. */
const SEUIL_SEP = 60;
dit(pireRepos >= SEUIL_SEP,
  `les cinq milieux se distinguent au repos (pire paire ${pireRepos.toFixed(0)} >= ${SEUIL_SEP})`);
dit(pireAcide >= SEUIL_SEP,
  `et ils se distinguent ENCORE au pH plancher (pire paire ${pirePaire} a ${pireAcide.toFixed(0)})`);

/* Seuil a 25 : en dessous, le virage ne se voit pas sur une LED diffusee. */
const SEUIL_VIRAGE = 25;
const fige = IDS.filter((id) => monotonie[id].ecartTotal < SEUIL_VIRAGE);
dit(fige.length === 0,
  `l'acidification se voit sur les cinq milieux (ecart >= ${SEUIL_VIRAGE})`
  + (fige.length ? ` — ${fige.map((id) => `${id} ${monotonie[id].ecartTotal.toFixed(0)}`).join(', ')}` : ''));

const zigzag = IDS.filter((id) => monotonie[id].retours > 0);
dit(zigzag.length === 0,
  'le virage acide est monotone : la boite ne revient jamais sur ses pas'
  + (zigzag.length ? ` — ${zigzag.join(', ')}` : ''));

dit(horsBornes === 0 && nonFini === 0,
  `la couleur reste dans [0,255] sur ${EXTREMES.length ** 2 * 3 * 6} etats extremes`
  + (horsBornes || nonFini ? ` — ${horsBornes} hors bornes, ${nonFini} non finis` : ''));

dit(leveApres === null,
  'observe() encaisse un jeu absent, une matrice nulle et un dt nul'
  + (leveApres ? ` — a leve : ${leveApres}` : ''));

dit(vivantApresJeu, 'le module reste vivant apres 10 s de jeu simule');

/* Le debit est la seule chose qui peut faire tomber la boucle de rendu :
   une file d'ecriture serie qui s'accumule finit par bloquer. */
dit(hzEmis <= 30.5, `le debit reste sous 30 trames par seconde (mesure ${hzEmis.toFixed(1)})`);
dit(envoye > 0, `et la couleur est bien poussee quand la liaison est ouverte (${envoye} trames)`);

dit(envoyeSansLien === 0,
  "sans liaison serie, rien n'est emis — le jeu reste intact sur telephone");

console.log('');
if (DEFAUT) {
  const attendu = echecs > 0;
  console.log(attendu
    ? `VERIFICATION DU BANC : le defaut « ${DEFAUT} » a bien ete attrape (${echecs} echec(s)).`
    : `VERIFICATION DU BANC : RATEE — le defaut « ${DEFAUT} » est passe inapercu.`);
  process.exit(attendu ? 0 : 1);
}
console.log(echecs === 0 ? 'tous les verdicts passent.' : `${echecs} verdict(s) en echec.`);
process.exit(echecs === 0 ? 0 : 1);
