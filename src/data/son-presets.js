/* ---------------------------------------------------------------------------
   Direction artistique musicale : les valeurs, leur schema, et leur code.

   Deux choses vivent ici, et il ne faut pas les confondre.

     LE PRESET  fixe l'identite d'une ambiance : tempo, tonique, mode,
                couleur des timbres, espace, caractere de batterie. Il ne
                bouge pas d'une partie a l'autre. C'est la DA.
     LA GRAINE  pilote le hasard controle : quelle note l'ostinato tire, ou
                tombe la variation, quelle charleston passe. C'est
                l'interpretation. Deux graines donnent deux executions du
                meme morceau.

   Le CODE emballe les deux dans dix-huit caracteres, pour qu'un reglage
   trouve a l'oreille dans le studio reparte a l'identique en jeu.

   ─── Ce qui est ici, et ce qui n'y est PAS ────────────────────────────────

   Tout ce qui est reglable est ici. Ce qui n'y est pas est dans le moteur,
   et volontairement : les seuils d'apparition des couches, la loi qui relie
   la mise au point au passe-bas master, la structure des canaux permanents,
   et les garde-fous qui empechent la nappe de se remettre a siffler
   (coupure plafonnee, deuxieme pole, envoi de reverbe reduit en stage). Un
   curseur dessus, et on reconstruit le defaut en trois clics.

   ─── Quantification ───────────────────────────────────────────────────────

   Chaque champ tient sur un nombre fixe de bits, avec un PAS choisi pour que
   les valeurs adoptees tombent exactement dessus. Un aller-retour preset ->
   code -> preset est donc l'identite, pas une approximation : ce qu'on
   entend dans le studio est ce que le jeu jouera.
--------------------------------------------------------------------------- */

/** Demi-tons d'une gamme mineure naturelle et de ses variantes. */
export const GAMMES = {
  mineure: [0, 2, 3, 5, 7, 8, 10],
  dorien: [0, 2, 3, 5, 7, 9, 10],
  phrygien: [0, 1, 3, 5, 7, 8, 10],
  pentamineure: [0, 3, 5, 7, 10],
};

const MODES = ['mineure', 'dorien', 'phrygien', 'pentamineure'];
const CYCLES = [0.125, 0.25, 0.5];

/**
 * Le schema. L'ordre des champs EST l'ordre des bits du code : y toucher
 * invalide les codes deja notes. On ajoute a la fin, on ne reordonne pas.
 *
 * Invariant : (max - min) / pas <= 2^bits - 1 pour chaque champ numerique.
 * `verifierSchema()` le controle, parce qu'un champ qui deborde d'un bit
 * ne se voit pas — il se contente de tronquer silencieusement la valeur
 * haute du curseur.
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

  { cle: 'rapport1', nom: 'Cycle du lead', choix: CYCLES, bits: 2,
    groupe: 'Timbres',
    aide: 'Rapport cyclique de l onde pulsee. 0,125 nasille, 0,5 est un carre plein.' },
  { cle: 'rapport2', nom: 'Cycle de l ostinato', choix: CYCLES, bits: 2,
    groupe: 'Timbres' },
  { cle: 'coupure', nom: 'Couleur', unite: 'Hz', min: 1500, max: 9000, pas: 100, bits: 7,
    groupe: 'Timbres',
    aide: 'Ouvre ou ferme tous les timbres d un coup. La nappe en tire sa propre coupure, plafonnee a 1250 Hz.' },
  { cle: 'grain', nom: 'Grain', min: 0, max: 1, pas: 0.05, bits: 5,
    groupe: 'Timbres',
    aide: 'Dose de bitcrush. A zero le mix est propre, a un il est rugueux comme une borne.' },
  { cle: 'desaccord', nom: 'Desaccord de nappe', unite: 'cents', min: 0, max: 30, pas: 1, bits: 5,
    groupe: 'Timbres',
    aide: 'C est le desaccord, pas le nombre de voix, qui fait l impression de liquide.' },

  { cle: 'reverbe', nom: 'Reverbe', min: 0, max: 1.55, pas: 0.05, bits: 5,
    groupe: 'Espace' },
  { cle: 'echo', nom: 'Echo', min: 0, max: 1.55, pas: 0.05, bits: 5,
    groupe: 'Espace',
    aide: 'Delai ping-pong cale sur trois doubles croches : il suit le tempo.' },

  { cle: 'sub', nom: 'Sub', min: 0, max: 1.55, pas: 0.05, bits: 5,
    groupe: 'Rythme',
    aide: 'Sans bas du spectre il n y a pas de drum and bass. Mais un haut-parleur de telephone n en rend rien.' },
  { cle: 'percu', nom: 'Percussion sourde vers claquante', min: 0, max: 1.55, pas: 0.05, bits: 5,
    groupe: 'Rythme',
    aide: 'Deplace la charleston et la caisse claire en frequence. A 0,6 on retrouve le reglage d origine.' },
  { cle: 'ostinato', nom: 'Presence de l ostinato', min: 0, max: 1.55, pas: 0.05, bits: 5,
    groupe: 'Rythme',
    aide: 'Le motif hypnotique du fond. Il doit tenir douze minutes sans lasser.' },
  { cle: 'melodie', nom: 'Densite melodique', min: 0, max: 1.55, pas: 0.05, bits: 5,
    groupe: 'Rythme',
    aide: 'Frequence des phrases courtes du lead. Elles n arrivent qu en pression.' },
];

/** Ordre d'affichage des groupes dans le studio. */
export const GROUPES = ['Tempo et harmonie', 'Timbres', 'Espace', 'Rythme'];

/**
 * Identite sonore par contexte.
 *
 * Le SQUELETTE rythmique ne change pas d'une matrice a l'autre : c'est lui
 * qui fait que la bande son est « toujours chez elle ». Ce qui change, c'est
 * la tonalite, le mode et la couleur des timbres — comme chaque matrice a
 * deja sa palette visuelle.
 */
export const PRESETS = {
  /* Lobby et bestiaire : pas de batterie du tout, et un tempo qui ne sert
     qu'a cadencer les respirations de la nappe. */
  ambiant: {
    bpm: 58, tonique: 45, gamme: 'dorien',
    rapport1: 0.5, rapport2: 0.25, coupure: 2400, grain: 0.15, desaccord: 8,
    reverbe: 0.85, echo: 0.55,
    sub: 1, percu: 0.6, ostinato: 1, melodie: 1,
  },
  milk: {
    bpm: 172, tonique: 50, gamme: 'dorien',
    rapport1: 0.5, rapport2: 0.25, coupure: 6200, grain: 0.55, desaccord: 8,
    reverbe: 0.4, echo: 0.3,
    sub: 1, percu: 0.6, ostinato: 1, melodie: 1,
  },
  pipe: {
    bpm: 176, tonique: 42, gamme: 'mineure',
    rapport1: 0.125, rapport2: 0.5, coupure: 7400, grain: 0.85, desaccord: 14,
    reverbe: 0.3, echo: 0.4,
    sub: 1, percu: 0.6, ostinato: 1, melodie: 1,
  },
  kombucha: {
    bpm: 168, tonique: 49, gamme: 'phrygien',
    rapport1: 0.25, rapport2: 0.125, coupure: 5600, grain: 0.5, desaccord: 8,
    reverbe: 0.6, echo: 0.45,
    sub: 1, percu: 0.6, ostinato: 1, melodie: 1,
  },
  levain: {
    bpm: 170, tonique: 45, gamme: 'pentamineure',
    rapport1: 0.5, rapport2: 0.5, coupure: 5000, grain: 0.4, desaccord: 8,
    reverbe: 0.5, echo: 0.35,
    sub: 1, percu: 0.6, ostinato: 1, melodie: 1,
  },
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
const VERSION = 'CD1';
const BITS_GRAINE = 16;
const BITS_SOMME = 5;

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
  if (ch.choix) {
    const i = ch.choix.indexOf(v);
    return i < 0 ? 0 : i;
  }
  const n = Math.round((v - ch.min) / ch.pas);
  return Math.max(0, Math.min((1 << ch.bits) - 1, n));
}

function valeurDe(ch, n) {
  if (ch.choix) return ch.choix[Math.min(n, ch.choix.length - 1)];
  const v = ch.min + n * ch.pas;
  const borne = Math.max(ch.min, Math.min(ch.max, v));
  /* Le pas est decimal : on arrondit au millieme pour ne pas trainer des
     0.30000000000000004 dans un fichier de donnees relu par un humain. */
  return Math.round(borne * 1000) / 1000;
}

/**
 * Verifie que chaque champ tient dans ses bits. A appeler dans les bancs :
 * un champ qui deborde ne se voit pas, il tronque la valeur haute du
 * curseur en silence.
 * @returns {string[]} les problemes trouves, vide si tout va bien
 */
export function verifierSchema() {
  const maux = [];
  for (const ch of CHAMPS) {
    const max = (1 << ch.bits) - 1;
    if (ch.choix) {
      if (ch.choix.length > max + 1) maux.push(`${ch.cle} : ${ch.choix.length} choix pour ${ch.bits} bits`);
      continue;
    }
    const pas = Math.round((ch.max - ch.min) / ch.pas);
    if (pas > max) maux.push(`${ch.cle} : ${pas} pas pour ${ch.bits} bits`);
  }
  for (const [nom, p] of Object.entries(PRESETS)) {
    for (const ch of CHAMPS) {
      if (!(ch.cle in p)) { maux.push(`${nom} : champ ${ch.cle} absent`); continue; }
      const aller = valeurDe(ch, entierDe(ch, p[ch.cle]));
      if (aller !== p[ch.cle]) {
        maux.push(`${nom}.${ch.cle} : ${p[ch.cle]} hors grille, tombe sur ${aller}`);
      }
    }
  }
  return maux;
}

/**
 * Emballe un preset et sa graine dans un code court.
 * @param {string} ambiance cle de PRESETS
 * @param {object} preset
 * @param {number} graine entier, seuls les 16 bits bas comptent
 * @returns {string} `CD1-milk-XXXXXXXXXXXXXXXXXX`
 */
export function encoderCode(ambiance, preset, graine) {
  const bits = [];
  const pousser = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >> i) & 1); };
  for (const ch of CHAMPS) pousser(entierDe(ch, preset[ch.cle]), ch.bits);
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
 * de charger un preset a moitie faux, qu'on passerait la soiree a debusquer.
 * @returns {{ambiance: string, preset: object, graine: number}|null}
 */
export function decoderCode(code) {
  if (typeof code !== 'string') return null;
  const m = code.trim().toUpperCase().split('-');
  if (m.length !== 3 || m[0] !== VERSION) return null;
  const ambiance = m[1].toLowerCase();
  if (!PRESETS[ambiance]) return null;
  const utiles = CHAMPS.reduce((a, ch) => a + ch.bits, 0) + BITS_GRAINE + BITS_SOMME;
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
  for (const ch of CHAMPS) preset[ch.cle] = valeurDe(ch, tirer(ch.bits));
  const graine = tirer(BITS_GRAINE);
  const annonce = tirer(BITS_SOMME);
  if (sommeDe(bits, utiles - BITS_SOMME) !== annonce) return null;
  return { ambiance, preset, graine };
}
