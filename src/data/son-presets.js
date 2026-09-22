/* ---------------------------------------------------------------------------
   Direction artistique musicale : les valeurs, leur schema, et leur code.

   Trois choses vivent ici, et il ne faut pas les confondre.

     L'AMBIANCE fixe la MUSIQUE et l'ESPACE : tempo, tonique, mode, grain,
                reverbe, echo, densite melodique. Ce qui se dit d'un morceau
                sans parler de ses instruments.
     LE RACK    fixe les SONS, voix par voix. Il vit dans `son-instruments.js`.
     LA GRAINE  pilote le hasard controle : quelle note l'ostinato tire, ou
                tombe la variation. C'est l'INTERPRETATION. Deux graines
                donnent deux executions du meme morceau.

   Le CODE emballe les trois, pour qu'un reglage trouve a l'oreille dans le
   studio reparte a l'identique en jeu.

   ─── Ce qui est ici, et ce qui n'y est PAS ────────────────────────────────

   Tout ce qui est reglable est ici ou dans le rack. Ce qui n'y est pas est
   dans le moteur, et volontairement : les seuils d'apparition des couches,
   la loi qui relie la mise au point au passe-bas master, la structure des
   canaux permanents, et la reverbe elle-meme, dont le gain de boucle a deja
   coute un sifflement de huit secondes.

   ─── Quantification ───────────────────────────────────────────────────────

   Chaque champ tient sur un nombre fixe de bits, avec un pas ou une table
   choisis pour que les valeurs adoptees tombent exactement dessus. Un
   aller-retour reglage -> code -> reglage est donc l'identite, pas une
   approximation : ce qu'on entend dans le studio est ce que le jeu jouera.
--------------------------------------------------------------------------- */

import { VOIX, CHAMPS_PAR_GENRE, RACKS } from './son-instruments.js';

export { VOIX, CHAMPS_PAR_GENRE, RACKS, MACHINES, SENS } from './son-instruments.js';

/** Demi-tons d'une gamme mineure naturelle et de ses variantes. */
export const GAMMES = {
  mineure: [0, 2, 3, 5, 7, 8, 10],
  dorien: [0, 2, 3, 5, 7, 9, 10],
  phrygien: [0, 1, 3, 5, 7, 8, 10],
  pentamineure: [0, 3, 5, 7, 10],
};

const MODES = ['mineure', 'dorien', 'phrygien', 'pentamineure'];

/**
 * Le schema de l'ambiance. L'ordre des champs EST l'ordre des bits du code :
 * y toucher invalide les codes deja notes. On ajoute a la fin.
 *
 * Invariant : (max - min) / pas <= 2^bits - 1 pour chaque champ numerique.
 * `verifierSchema()` le controle, parce qu'un champ qui deborde d'un bit ne
 * se voit pas — il tronque silencieusement la valeur haute du curseur.
 */
export const CHAMPS = [
  { cle: 'bpm', nom: 'Tempo', unite: 'BPM', min: 50, max: 190, pas: 1, bits: 8,
    groupe: 'Tempo et harmonie',
    aide: 'Le squelette rythmique ne change pas d une matrice a l autre. Le tempo, si.' },
  { cle: 'tonique', nom: 'Tonique', unite: 'MIDI', min: 36, max: 60, pas: 1, bits: 5,
    groupe: 'Tempo et harmonie',
    aide: 'Grave = lourd, aigu = nerveux. 45 est un la1, 50 un re2.' },
  { cle: 'gamme', nom: 'Mode', choix: MODES, bits: 2,
    groupe: 'Tempo et harmonie',
    aide: 'Phrygien = le plus tendu. Pentamineure = le plus ouvert.' },
  { cle: 'grain', nom: 'Grain', min: 0, max: 1, pas: 0.05, bits: 5,
    groupe: 'Espace',
    aide: 'Dose de bitcrush sur le bus chip. A zero le mix est propre, a un il est rugueux comme une borne.' },
  { cle: 'reverbe', nom: 'Reverbe', min: 0, max: 1.55, pas: 0.05, bits: 5,
    groupe: 'Espace' },
  { cle: 'echo', nom: 'Echo', min: 0, max: 1.55, pas: 0.05, bits: 5,
    groupe: 'Espace',
    aide: 'Delai ping-pong cale sur trois doubles croches : il suit le tempo.' },
  { cle: 'melodie', nom: 'Densite melodique', min: 0, max: 1.55, pas: 0.05, bits: 5,
    groupe: 'Jeu',
    aide: 'Frequence des phrases du lead. C est une regle de jeu, pas un timbre : le son du lead est dans le rack.' },
];

/** Ordre d'affichage des groupes dans le studio. */
export const GROUPES = ['Tempo et harmonie', 'Espace', 'Jeu'];

/**
 * Identite musicale par contexte.
 *
 * Le SQUELETTE rythmique ne change pas d'une matrice a l'autre : c'est lui
 * qui fait que la bande son est « toujours chez elle ». Ce qui change, c'est
 * la tonalite, le mode, l'espace — et desormais le rack.
 */
export const PRESETS = {
  /* Lobby et bestiaire : pas de batterie du tout, et un tempo qui ne sert
     qu'a cadencer les respirations de la nappe. */
  ambiant: { bpm: 58, tonique: 45, gamme: 'dorien', grain: 0.15, reverbe: 0.85, echo: 0.55, melodie: 1 },
  milk: { bpm: 172, tonique: 50, gamme: 'dorien', grain: 0.55, reverbe: 0.4, echo: 0.3, melodie: 1 },
  pipe: { bpm: 176, tonique: 42, gamme: 'mineure', grain: 0.85, reverbe: 0.3, echo: 0.4, melodie: 1 },
  kombucha: { bpm: 168, tonique: 49, gamme: 'phrygien', grain: 0.5, reverbe: 0.6, echo: 0.45, melodie: 1 },
  levain: { bpm: 170, tonique: 45, gamme: 'pentamineure', grain: 0.4, reverbe: 0.5, echo: 0.35, melodie: 1 },
};

/** Nom lisible de chaque ambiance, pour le studio. */
export const NOMS = {
  ambiant: 'Lobby et bestiaire',
  milk: 'Lait cru',
  pipe: 'Conduite',
  kombucha: 'Kombucha',
  levain: 'Levain',
};

/* --------------------------------------------------------------- code --- */

/* Alphabet de Crockford : ni I, ni L, ni O, ni U. On relit ces codes a voix
   haute et on les recopie a la main — un 0 qu'on prend pour un O coute une
   session d'ecoute. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const VERSION = 'CD3';
const BITS_GRAINE = 16;
const BITS_SOMME = 5;
const BITS_DESACCORD = 5;

/**
 * Somme de controle : cinq bits, un XOR par paquet de cinq sur les `n`
 * premiers bits. Elle n'a pas a etre cryptographique, elle a a attraper une
 * faute de frappe.
 *
 * Les DEUX cotes passent par ici, et c'est le fond du sujet : quand le
 * decodeur recalculait la somme sur son propre tampon, il mordait sur les
 * bits de la somme elle-meme, la ou l'encodeur ne voyait que du vide. Aucun
 * code ne se relisait, et rien ne le disait a part un « null ».
 */
function sommeDe(bits, n) {
  let somme = 0;
  for (let i = 0; i < n; i += 5) {
    let paquet = 0;
    for (let j = 0; j < 5; j++) paquet = (paquet << 1) | (i + j < n ? bits[i + j] : 0);
    somme ^= paquet;
  }
  return somme;
}

function entierDe(ch, v) {
  if (ch.choix) { const i = ch.choix.indexOf(v); return i < 0 ? 0 : i; }
  if (ch.table) {
    const i = ch.table.indexOf(v);
    if (i >= 0) return i;
    /* Valeur hors table : on prend le cran le plus proche plutot que de
       refuser. Un rack recopie a la main doit pouvoir entrer. */
    let mieux = 0, ecart = Infinity;
    for (let j = 0; j < ch.table.length; j++) {
      const e = Math.abs(Math.log(ch.table[j] / Math.max(1e-6, v)));
      if (e < ecart) { ecart = e; mieux = j; }
    }
    return mieux;
  }
  const n = Math.round((v - ch.min) / ch.pas);
  return Math.max(0, Math.min((1 << ch.bits) - 1, n));
}

function valeurDe(ch, n) {
  if (ch.choix) return ch.choix[Math.min(n, ch.choix.length - 1)];
  if (ch.table) return ch.table[Math.min(n, ch.table.length - 1)];
  const v = ch.min + n * ch.pas;
  /* Le pas est decimal : on arrondit au millieme pour ne pas trainer des
     0.30000000000000004 dans un fichier de donnees relu par un humain. */
  return Math.round(Math.max(ch.min, Math.min(ch.max, v)) * 1000) / 1000;
}

/* Champs apparus avec CD3 : le modele de synthese et ses deux boutons de
   caractere. Ils sont AJOUTES EN FIN de chaque liste, si bien qu'en les
   retirant on retrouve exactement l'ordre des bits de CD2. C'est ce qui
   permet de relire les anciens codes sans garder une copie figee du
   schema. */
const NOUVEAUX_CD3 = new Set(['modele', 'timbre1', 'timbre2']);

/** Tous les champs du code, dans l'ordre : ambiance puis rack. */
function champsDuCode(sansCD3 = false) {
  const l = CHAMPS.map((ch) => ({ ch, voix: null }));
  for (const v of VOIX) {
    for (const ch of CHAMPS_PAR_GENRE[v.genre]) {
      if (sansCD3 && NOUVEAUX_CD3.has(ch.cle)) continue;
      l.push({ ch, voix: v.cle });
    }
  }
  return l;
}

const taille = (sansCD3) => champsDuCode(sansCD3).reduce((a, { ch }) => a + ch.bits, 0)
  + BITS_DESACCORD + BITS_GRAINE + BITS_SOMME;
const BITS_UTILES = taille(false);
const LONGUEUR = Math.ceil(BITS_UTILES / 5);

/**
 * Verifie que chaque champ tient dans ses bits et que les valeurs adoptees
 * tombent sur la grille. A appeler dans les bancs : un champ qui deborde ne
 * se voit pas, il tronque la valeur haute du curseur en silence.
 * @returns {string[]} les problemes trouves, vide si tout va bien
 */
export function verifierSchema() {
  const maux = [];
  const borne = (ch, ou) => {
    const max = (1 << ch.bits) - 1;
    const n = ch.choix ? ch.choix.length : (ch.table ? ch.table.length : Math.round((ch.max - ch.min) / ch.pas) + 1);
    if (n > max + 1) maux.push(`${ou}${ch.cle} : ${n} valeurs pour ${ch.bits} bits`);
  };
  for (const ch of CHAMPS) borne(ch, '');
  for (const v of VOIX) for (const ch of CHAMPS_PAR_GENRE[v.genre]) borne(ch, `${v.cle}.`);
  for (const nom of Object.keys(PRESETS)) {
    for (const ch of CHAMPS) {
      const val = PRESETS[nom][ch.cle];
      if (val === undefined) { maux.push(`${nom} : champ ${ch.cle} absent`); continue; }
      if (valeurDe(ch, entierDe(ch, val)) !== val) maux.push(`${nom}.${ch.cle} : ${val} hors grille`);
    }
    for (const v of VOIX) {
      for (const ch of CHAMPS_PAR_GENRE[v.genre]) {
        const val = RACKS[nom][v.cle][ch.cle];
        if (val === undefined) { maux.push(`${nom}.${v.cle} : champ ${ch.cle} absent`); continue; }
        if (valeurDe(ch, entierDe(ch, val)) !== val) maux.push(`${nom}.${v.cle}.${ch.cle} : ${val} hors grille`);
      }
    }
  }
  return maux;
}

/**
 * Emballe une ambiance, son rack et sa graine dans un code.
 * @returns {string} `CD2-milk-XXXX…`
 */
export function encoderCode(ambiance, preset, rack, graine) {
  const bits = [];
  const pousser = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >> i) & 1); };
  for (const { ch, voix } of champsDuCode()) {
    pousser(entierDe(ch, voix ? rack[voix][ch.cle] : preset[ch.cle]), ch.bits);
  }
  pousser(Math.max(0, Math.min(30, Math.round(rack.desaccord))), BITS_DESACCORD);
  pousser(graine & 0xffff, BITS_GRAINE);
  pousser(sommeDe(bits, bits.length), BITS_SOMME);
  while (bits.length % 5) bits.push(0);
  let texte = '';
  for (let i = 0; i < bits.length; i += 5) {
    let v = 0;
    for (let j = 0; j < 5; j++) v = (v << 1) | bits[i + j];
    texte += ALPHABET[v];
  }
  return `${VERSION}-${ambiance}-${texte}`;
}

/**
 * Deballe un code. Rend `null` si la version, l'ambiance, la longueur ou la
 * somme de controle ne collent pas — on prefere ne rien charger plutot que
 * de charger un reglage a moitie faux, qu'on passerait la soiree a debusquer.
 * @returns {{ambiance, preset, rack, graine}|null}
 */
export function decoderCode(code) {
  if (typeof code !== 'string') return null;
  const m = code.trim().toUpperCase().split('-');
  if (m.length !== 3) return null;
  const ambiance = m[1].toLowerCase();
  if (!PRESETS[ambiance]) return null;
  if (m[0] === 'CD1') return depuisCD1(ambiance, m[2]);
  const ancien = m[0] === 'CD2';
  if (!ancien && m[0] !== VERSION) return null;
  const utiles = taille(ancien);
  if (m[2].length !== Math.ceil(utiles / 5)) return null;
  const bits = [];
  for (const c of m[2]) {
    const v = ALPHABET.indexOf(c);
    if (v < 0) return null;
    for (let i = 4; i >= 0; i--) bits.push((v >> i) & 1);
  }
  let pos = 0;
  const tirer = (n) => { let v = 0; for (let i = 0; i < n; i++) v = (v << 1) | bits[pos++]; return v; };
  const preset = {};
  /* On part du rack adopte : un code ancien ne porte pas les champs
     apparus depuis, et il faut bien leur donner une valeur. */
  const rack = JSON.parse(JSON.stringify(RACKS[ambiance]));
  for (const { ch, voix } of champsDuCode(ancien)) {
    const val = valeurDe(ch, tirer(ch.bits));
    if (voix) rack[voix][ch.cle] = val; else preset[ch.cle] = val;
  }
  rack.desaccord = tirer(BITS_DESACCORD);
  const graine = tirer(BITS_GRAINE);
  const annonce = tirer(BITS_SOMME);
  if (sommeDe(bits, utiles - BITS_SOMME) !== annonce) return null;
  /* Les bits de remplissage doivent etre nuls. Sans cette verification, une
     faute de frappe sur le DERNIER caractere passe inapercue : elle ne
     touche ni les donnees ni la somme, seulement le bourrage. */
  for (let i = utiles; i < bits.length; i++) if (bits[i]) return null;
  return { ambiance, preset, rack, graine };
}

/* ------------------------------------------------------------- CD1 ------ */

/* La premiere version du code ne connaissait pas les racks : elle avait des
   reglages globaux qui agissaient sur des voix precises. On les traduit
   plutot que de les jeter — un code note a l'oreille represente une soiree
   d'ecoute, et rien ne justifie de la perdre. */
const CHAMPS_CD1 = [
  { cle: 'bpm', min: 50, max: 190, pas: 1, bits: 8 },
  { cle: 'tonique', min: 36, max: 60, pas: 1, bits: 5 },
  { cle: 'gamme', choix: MODES, bits: 2 },
  { cle: 'rapport1', choix: [0.125, 0.25, 0.5], bits: 2 },
  { cle: 'rapport2', choix: [0.125, 0.25, 0.5], bits: 2 },
  { cle: 'coupure', min: 1500, max: 9000, pas: 100, bits: 7 },
  { cle: 'grain', min: 0, max: 1, pas: 0.05, bits: 5 },
  { cle: 'desaccord', min: 0, max: 30, pas: 1, bits: 5 },
  { cle: 'reverbe', min: 0, max: 1.55, pas: 0.05, bits: 5 },
  { cle: 'echo', min: 0, max: 1.55, pas: 0.05, bits: 5 },
  { cle: 'sub', min: 0, max: 1.55, pas: 0.05, bits: 5 },
  { cle: 'percu', min: 0, max: 1.55, pas: 0.05, bits: 5 },
  { cle: 'ostinato', min: 0, max: 1.55, pas: 0.05, bits: 5 },
  { cle: 'melodie', min: 0, max: 1.55, pas: 0.05, bits: 5 },
];
const ONDE_CD1 = { 0.125: 'pulse12', 0.25: 'pulse25', 0.5: 'carre' };

function depuisCD1(ambiance, texte) {
  const utiles = CHAMPS_CD1.reduce((a, c) => a + c.bits, 0) + BITS_GRAINE + BITS_SOMME;
  if (texte.length !== Math.ceil(utiles / 5)) return null;
  const bits = [];
  for (const c of texte) {
    const v = ALPHABET.indexOf(c);
    if (v < 0) return null;
    for (let i = 4; i >= 0; i--) bits.push((v >> i) & 1);
  }
  let pos = 0;
  const tirer = (n) => { let v = 0; for (let i = 0; i < n; i++) v = (v << 1) | bits[pos++]; return v; };
  const a = {};
  for (const ch of CHAMPS_CD1) a[ch.cle] = valeurDe(ch, tirer(ch.bits));
  const graine = tirer(BITS_GRAINE);
  if (sommeDe(bits, utiles - BITS_SOMME) !== tirer(BITS_SOMME)) return null;

  const preset = { bpm: a.bpm, tonique: a.tonique, gamme: a.gamme,
    grain: a.grain, reverbe: a.reverbe, echo: a.echo, melodie: a.melodie };
  const rack = JSON.parse(JSON.stringify(RACKS[ambiance]));
  const pose = (voix, cle, val) => {
    const ch = CHAMPS_PAR_GENRE[VOIX.find((v) => v.cle === voix).genre].find((c) => c.cle === cle);
    rack[voix][cle] = valeurDe(ch, entierDe(ch, val));
  };
  rack.lead.onde = ONDE_CD1[a.rapport1] || rack.lead.onde;
  rack.ostinato.onde = ONDE_CD1[a.rapport2] || rack.ostinato.onde;
  pose('nappe', 'coupure', Math.min(a.coupure * 0.35, 1250));
  rack.desaccord = a.desaccord;
  pose('sub', 'niveau', 0.5 * a.sub);
  pose('ostinato', 'niveau', 0.1 * a.ostinato);
  pose('clap', 'frequence', 1420 + 800 * a.percu);
  pose('hat', 'frequence', 4400 + 3000 * a.percu);
  return { ambiance, preset, rack, graine };
}
