/* ---------------------------------------------------------------------------
   Le rack : ce que chaque voix EST, par opposition a ce que l'ambiance dit.

   Jusqu'ici les timbres etaient figes dans le moteur et l'ambiance n'offrait
   que des reglages globaux — un rapport cyclique par-ci, une coupure par-la.
   On pouvait dire « plus sombre », pas « la basse est une dent de scie
   filtree a 700 avec une attaque molle ». Le partage est desormais net :

     L'AMBIANCE dit la MUSIQUE et l'ESPACE : tempo, tonique, mode, grain,
                reverbe, echo, densite melodique.
     LE RACK    dit les SONS : par voix, une onde, un filtre, une enveloppe
                et un niveau. C'est un synthetiseur soustractif ordinaire,
                parce que c'est le vocabulaire que tout le monde connait.

   Chaque ambiance a SON rack : une matrice a sa palette sonore comme elle a
   sa palette visuelle. Le studio sait recopier un rack d'une ambiance a
   l'autre quand on ne veut pas tout refaire.

   ─── Grilles ──────────────────────────────────────────────────────────────

   Les valeurs ne sont pas continues : chaque champ pioche dans une TABLE.
   Deux raisons. D'abord le code — une table de 16 ou 32 entrees tient sur
   quatre ou cinq bits, exactement. Ensuite l'oreille : une coupure se pense
   en octaves, pas en hertz, et une table log donne un curseur ou chaque cran
   s'entend. Les tables contiennent toutes les valeurs d'origine, si bien que
   le rack par defaut reproduit le moteur d'avant a l'identique.
--------------------------------------------------------------------------- */

/** Coupures et frequences de filtre. Pas regulier a l'oreille, pas en Hz. */
export const COUPURES = [
  80, 100, 120, 150, 180, 220, 260, 320, 390, 470, 570, 700, 850, 1000,
  1100, 1250, 1500, 1800, 1900, 2300, 2800, 3400, 4100, 5000, 6000, 6200,
  7000, 8500, 10000, 12000, 14000, 16000,
];
/** Resonances. Au-dela de 5 un filtre chante ; c'est parfois ce qu'on veut. */
export const RESONANCES = [0.4, 0.5, 0.6, 0.7, 0.8, 1, 1.1, 1.2, 1.4, 1.8, 2.4, 3.5, 5, 7, 10, 14];
export const ATTAQUES = [0.001, 0.002, 0.004, 0.006, 0.01, 0.02, 0.04, 0.07, 0.12, 0.2, 0.3, 0.45, 0.6, 0.9, 1.2, 1.6];
export const CHUTES = [0.01, 0.02, 0.04, 0.06, 0.08, 0.09, 0.12, 0.16, 0.22, 0.3, 0.4, 0.6, 0.8, 1.1, 1.5, 2];
export const TENUES = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1];
export const RELACHES = [0.02, 0.04, 0.08, 0.12, 0.18, 0.26, 0.35, 0.5, 0.7, 0.9, 1.2, 1.6, 2, 2.6, 3.2, 4];
export const NIVEAUX = [0, 0.05, 0.07, 0.09, 0.1, 0.12, 0.16, 0.2, 0.25, 0.3, 0.4, 0.5, 0.7, 0.9, 1.2, 1.5];
export const DUREES = [0.01, 0.02, 0.035, 0.05, 0.07, 0.09, 0.12, 0.16, 0.2, 0.26, 0.32, 0.4, 0.5, 0.65, 0.8, 1];
export const DEPARTS = [60, 80, 100, 120, 150, 180, 190, 220, 260, 300, 340, 400, 480, 560, 650, 750];
export const ARRIVEES = [25, 30, 35, 40, 42, 48, 55, 62, 70, 80, 90, 100, 115, 130, 150, 170];
export const GLISSES = [0.02, 0.03, 0.04, 0.06, 0.09, 0.12, 0.16, 0.2, 0.26, 0.32, 0.4, 0.5, 0.6, 0.75, 0.9, 1.1];
/** Les deux boutons de caractere. Leur sens depend du modele de synthese. */
export const TIMBRES = [0, 0.07, 0.13, 0.2, 0.27, 0.33, 0.4, 0.47, 0.53, 0.6, 0.67, 0.73, 0.8, 0.87, 0.93, 1];

/**
 * Ondes. Toutes sont construites en additionnant des harmoniques, jamais en
 * echantillonnant : une impulsion « parfaite » repliee au-dessus de Nyquist
 * ne sonne pas retro, elle sonne cassee.
 */
export const ONDES = ['sinus', 'triangle', 'scie', 'pulse08', 'pulse12', 'pulse25', 'pulse33', 'carre'];
export const FILTRES = ['passe-bas', 'passe-bande', 'passe-haut'];

/**
 * Le MODELE de synthese. C'est lui qui fait qu'une voix est un autre
 * instrument et pas le meme reglage autrement : un filtre et une enveloppe
 * ne transforment pas un oscillateur en cloche, ni du bruit en charleston.
 */
export const MODELES = {
  melodique: ['soustractif', 'super', 'fm', 'acide'],
  bruit: ['bruit', 'taps', 'caisse', 'metal'],
  kick: ['propre', 'sature'],
};

const NOMS_MODELES = {
  soustractif: 'soustractif — un oscillateur, un filtre. Le plus direct',
  super: 'unisson — plusieurs copies desaccordees, large et mouvant',
  fm: 'modulation de frequence — cloches, cuivres, timbres inharmoniques',
  acide: 'acide — le filtre a sa propre enveloppe, c est elle qu on entend',
  bruit: 'bruit filtre — le plus simple',
  taps: 'rebonds — plusieurs eclats serres, un clap et non une porte',
  caisse: 'caisse — bruit plus deux sinus accordes, le corps d une claire',
  metal: 'metallique — six carres inharmoniques, la charleston des boites',
  propre: 'propre',
  sature: 'sature — passe devant le mix sans monter de niveau',
};

/** Le sens des deux boutons de caractere, modele par modele. */
const SENS = {
  soustractif: ['(sans effet)', '(sans effet)'],
  super: ['ecart de desaccord', 'niveau de l unisson'],
  fm: ['rapport du modulateur', 'profondeur de modulation'],
  acide: ['hauteur du balayage', 'duree du balayage'],
  bruit: ['(sans effet)', ''],
  taps: ['ecart entre les rebonds', ''],
  caisse: ['part du corps accorde', ''],
  metal: ['(sans effet)', ''],
  propre: ['clic d attaque', ''],
  sature: ['clic d attaque', ''],
};
export { NOMS_MODELES, SENS };

const NOMS_ONDES = {
  sinus: 'sinus — rond, sans harmonique',
  triangle: 'triangle — doux, harmoniques impaires faibles',
  scie: 'scie — la plus riche, celle des nappes',
  pulse08: 'impulsion 8 % — tres nasillarde, fine',
  pulse12: 'impulsion 12,5 % — le son de lead des consoles 8 bits',
  pulse25: 'impulsion 25 % — creuse, bien placee dans un mix',
  pulse33: 'impulsion 33 % — entre creux et plein',
  carre: 'carre — plein, la moitie des harmoniques',
};

/** Schema d'une voix melodique : un synthetiseur soustractif ordinaire. */
export const CHAMPS_VOIX = [
  { cle: 'onde', nom: 'Onde', choix: ONDES, bits: 3, legendes: NOMS_ONDES },
  { cle: 'filtre', nom: 'Filtre', choix: FILTRES, bits: 2 },
  { cle: 'coupure', nom: 'Coupure', unite: 'Hz', table: COUPURES, bits: 5 },
  { cle: 'resonance', nom: 'Resonance', table: RESONANCES, bits: 4 },
  { cle: 'attaque', nom: 'Attaque', unite: 's', table: ATTAQUES, bits: 4 },
  { cle: 'chute', nom: 'Chute', unite: 's', table: CHUTES, bits: 4 },
  { cle: 'tenue', nom: 'Tenue', table: TENUES, bits: 4 },
  { cle: 'relache', nom: 'Relache', unite: 's', table: RELACHES, bits: 4 },
  { cle: 'niveau', nom: 'Niveau', table: NIVEAUX, bits: 4 },
  /* Ajoutes en fin de liste : l'ordre des champs EST l'ordre des bits. */
  { cle: 'modele', nom: 'Modele', choix: MODELES.melodique, bits: 2, legendes: NOMS_MODELES },
  { cle: 'timbre1', nom: 'Caractere 1', table: TIMBRES, bits: 4 },
  { cle: 'timbre2', nom: 'Caractere 2', table: TIMBRES, bits: 4 },
];

/** Schema d'une percussion accordee au bruit (claire, charleston, tension). */
export const CHAMPS_BRUIT = [
  { cle: 'filtre', nom: 'Filtre', choix: FILTRES, bits: 2 },
  { cle: 'frequence', nom: 'Frequence', unite: 'Hz', table: COUPURES, bits: 5 },
  { cle: 'resonance', nom: 'Resonance', table: RESONANCES, bits: 4 },
  { cle: 'duree', nom: 'Duree', unite: 's', table: DUREES, bits: 4 },
  { cle: 'niveau', nom: 'Niveau', table: NIVEAUX, bits: 4 },
  { cle: 'modele', nom: 'Modele', choix: MODELES.bruit, bits: 2, legendes: NOMS_MODELES },
  { cle: 'timbre1', nom: 'Caractere', table: TIMBRES, bits: 4 },
];

/** Schema de la grosse caisse : un sinus qui tombe, rien d'autre. */
export const CHAMPS_KICK = [
  { cle: 'depart', nom: 'Hauteur de depart', unite: 'Hz', table: DEPARTS, bits: 4 },
  { cle: 'arrivee', nom: 'Hauteur d arrivee', unite: 'Hz', table: ARRIVEES, bits: 4 },
  { cle: 'glisse', nom: 'Temps de chute', unite: 's', table: GLISSES, bits: 4 },
  { cle: 'duree', nom: 'Duree', unite: 's', table: DUREES, bits: 4 },
  { cle: 'niveau', nom: 'Niveau', table: NIVEAUX, bits: 4 },
  { cle: 'modele', nom: 'Modele', choix: MODELES.kick, bits: 2, legendes: NOMS_MODELES },
  { cle: 'timbre1', nom: 'Clic d attaque', table: TIMBRES, bits: 4 },
];

/**
 * Les voix, dans l'ordre du code. Y toucher invalide les codes deja notes :
 * on ajoute a la fin, on ne reordonne pas.
 */
export const VOIX = [
  { cle: 'nappe', nom: 'Nappe', genre: 'melodique',
    aide: 'Trois scies desaccordees qui tiennent l harmonie. Deux poles de filtre au lieu d un : une scie TENUE laisse passer assez d harmoniques pour s entendre comme un ton.' },
  { cle: 'sub', nom: 'Sub', genre: 'melodique',
    aide: 'Le poids. Rien de retro, et c est assume : sans bas du spectre il n y a pas de drum and bass.' },
  { cle: 'basse', nom: 'Basse', genre: 'melodique',
    aide: 'La ligne qui bouge, une octave au-dessus du sub.' },
  { cle: 'ostinato', nom: 'Ostinato', genre: 'melodique',
    aide: 'Le motif hypnotique du fond. Il doit tenir douze minutes sans lasser.' },
  { cle: 'lead', nom: 'Lead', genre: 'melodique',
    aide: 'Les phrases courtes et entetantes. Elles n arrivent qu en pression.' },
  { cle: 'kick', nom: 'Grosse caisse', genre: 'kick' },
  { cle: 'clap', nom: 'Caisse claire', genre: 'bruit' },
  { cle: 'hat', nom: 'Charleston', genre: 'bruit',
    aide: 'Sa frequence est retiree au hasard dans une plage au-dessus de ce reglage : c est ce qui l empeche de sonner comme une boucle.' },
  { cle: 'tension', nom: 'Tension', genre: 'bruit',
    aide: 'Le battement sourd qui monte quand la vie descend. Muet tant que le danger est nul.' },
];

export const CHAMPS_PAR_GENRE = {
  melodique: CHAMPS_VOIX,
  bruit: CHAMPS_BRUIT,
  kick: CHAMPS_KICK,
};

/* Le rack de base, celui qui reproduit exactement le moteur d'avant. */
const BASE = {
  nappe: { onde: 'scie', filtre: 'passe-bas', coupure: 1250, resonance: 0.7,
    attaque: 0.9, chute: 0.6, tenue: 0.8, relache: 1.6, niveau: 0.09,
    modele: 'soustractif', timbre1: 0, timbre2: 0 },
  sub: { onde: 'sinus', filtre: 'passe-bas', coupure: 260, resonance: 0.7,
    attaque: 0.01, chute: 0.12, tenue: 0.7, relache: 0.26, niveau: 0.5,
    modele: 'soustractif', timbre1: 0, timbre2: 0 },
  basse: { onde: 'triangle', filtre: 'passe-bas', coupure: 1800, resonance: 0.7,
    attaque: 0.006, chute: 0.08, tenue: 0.5, relache: 0.18, niveau: 0.16,
    modele: 'soustractif', timbre1: 0, timbre2: 0 },
  ostinato: { onde: 'pulse25', filtre: 'passe-bas', coupure: 6000, resonance: 0.7,
    attaque: 0.004, chute: 0.04, tenue: 0.35, relache: 0.12, niveau: 0.1,
    modele: 'soustractif', timbre1: 0, timbre2: 0 },
  lead: { onde: 'carre', filtre: 'passe-bas', coupure: 7000, resonance: 0.7,
    attaque: 0.006, chute: 0.09, tenue: 0.4, relache: 0.26, niveau: 0.12,
    modele: 'soustractif', timbre1: 0, timbre2: 0 },
  kick: { depart: 190, arrivee: 42, glisse: 0.09, duree: 0.2, niveau: 0.9,
    modele: 'propre', timbre1: 0 },
  clap: { filtre: 'passe-bande', frequence: 1900, resonance: 1.1, duree: 0.12,
    niveau: 0.5, modele: 'bruit', timbre1: 0 },
  hat: { filtre: 'passe-haut', frequence: 6200, resonance: 0.8, duree: 0.035,
    niveau: 0.07, modele: 'bruit', timbre1: 0 },
  tension: { filtre: 'passe-bande', frequence: 220, resonance: 3.5, duree: 0.5,
    niveau: 0.25, modele: 'bruit', timbre1: 0 },
  desaccord: 8,
};

const rack = (o = {}) => {
  const r = JSON.parse(JSON.stringify(BASE));
  for (const [voix, champs] of Object.entries(o)) {
    if (voix === 'desaccord') r.desaccord = champs;
    else Object.assign(r[voix], champs);
  }
  return r;
};

/** Un rack par ambiance : une matrice a sa palette sonore. */
export const RACKS = {
  ambiant: rack({ nappe: { coupure: 850 }, lead: { onde: 'carre' }, ostinato: { onde: 'pulse25' } }),
  milk: rack(),
  pipe: rack({ lead: { onde: 'pulse12' }, ostinato: { onde: 'carre' }, desaccord: 14 }),
  kombucha: rack({ lead: { onde: 'pulse25' }, ostinato: { onde: 'pulse12' } }),
  levain: rack({ lead: { onde: 'carre' }, ostinato: { onde: 'carre' } }),
};

/* ----------------------------------------------------------- machines --- */

/**
 * Des timbres tout faits, a choisir avant de regler.
 *
 * Une machine ne touche PAS au niveau de la voix : changer d'instrument ne
 * doit pas faire sauter l'equilibre du mix. Elle pose le modele, l'onde, le
 * filtre, l'enveloppe et les deux boutons de caractere, et c'est tout.
 *
 * Les noms decrivent un caractere, pas une marque : tout est synthetise ici,
 * rien n'est echantillonne, et appeler une de ces voix du nom d'une machine
 * reelle serait une promesse qu'elle ne tient pas. Les references sont dans
 * l'aide, la ou elles servent a se reperer.
 */
export const MACHINES = {
  melodique: [
    { nom: 'Soustractif', aide: 'un oscillateur et un filtre, le point de depart',
      p: { modele: 'soustractif', onde: 'carre', filtre: 'passe-bas', coupure: 7000,
        resonance: 0.7, attaque: 0.006, chute: 0.09, tenue: 0.4, relache: 0.26,
        timbre1: 0, timbre2: 0 } },
    { nom: 'Pulse chiptune', aide: 'le lead nasillard des consoles 8 bits, attaque seche',
      p: { modele: 'soustractif', onde: 'pulse12', filtre: 'passe-bas', coupure: 7000,
        resonance: 0.7, attaque: 0.001, chute: 0.04, tenue: 0.35, relache: 0.08,
        timbre1: 0, timbre2: 0 } },
    { nom: 'Super scie', aide: 'trois scies desaccordees, large et brillante',
      p: { modele: 'super', onde: 'scie', filtre: 'passe-bas', coupure: 5000,
        resonance: 0.7, attaque: 0.02, chute: 0.3, tenue: 0.7, relache: 0.5,
        timbre1: 0.27, timbre2: 0.6 } },
    { nom: 'Nappe large', aide: 'la meme, lente et sombre : un fond qui respire',
      p: { modele: 'super', onde: 'scie', filtre: 'passe-bas', coupure: 1250,
        resonance: 0.7, attaque: 0.9, chute: 0.6, tenue: 0.8, relache: 1.6,
        timbre1: 0.4, timbre2: 0.53 } },
    { nom: 'FM cloche', aide: 'rapport non entier : inharmonique, metallique, qui tinte',
      p: { modele: 'fm', onde: 'sinus', filtre: 'passe-bas', coupure: 8500,
        resonance: 0.7, attaque: 0.002, chute: 0.4, tenue: 0.1, relache: 0.9,
        timbre1: 0.73, timbre2: 0.33 } },
    { nom: 'FM basse', aide: 'rapport serre : une basse qui grogne, dans l esprit des synthes numeriques',
      p: { modele: 'fm', onde: 'sinus', filtre: 'passe-bas', coupure: 1800,
        resonance: 0.7, attaque: 0.002, chute: 0.12, tenue: 0.5, relache: 0.18,
        timbre1: 0.13, timbre2: 0.4 } },
    { nom: 'Acide', aide: 'filtre resonant balaye a chaque note, dans l esprit des basses acid',
      p: { modele: 'acide', onde: 'scie', filtre: 'passe-bas', coupure: 700,
        resonance: 5, attaque: 0.002, chute: 0.12, tenue: 0.3, relache: 0.12,
        timbre1: 0.6, timbre2: 0.2 } },
  ],
  bruit: [
    { nom: 'Bruit filtre', aide: 'le plus simple : un eclat de bruit dans une bande',
      p: { modele: 'bruit', filtre: 'passe-bande', frequence: 1900, resonance: 1.1,
        duree: 0.12, timbre1: 0 } },
    { nom: 'Clap a rebonds', aide: 'trois eclats serres puis la queue : des mains, pas une porte',
      p: { modele: 'taps', filtre: 'passe-bande', frequence: 1500, resonance: 1.2,
        duree: 0.16, timbre1: 0.33 } },
    { nom: 'Caisse claire', aide: 'bruit plus deux sinus accordes : le corps que le bruit seul n a pas',
      p: { modele: 'caisse', filtre: 'passe-bande', frequence: 1900, resonance: 1.4,
        duree: 0.16, timbre1: 0.53 } },
    { nom: 'Rimshot', aide: 'tres court, tres resonant : un coup sur le cercle',
      p: { modele: 'caisse', filtre: 'passe-bande', frequence: 2800, resonance: 3.5,
        duree: 0.05, timbre1: 0.8 } },
    { nom: 'Charleston metallique', aide: 'six carres inharmoniques : le grain des boites a rythmes',
      p: { modele: 'metal', filtre: 'passe-haut', frequence: 6200, resonance: 0.8,
        duree: 0.035, timbre1: 0 } },
    { nom: 'Charleston ouverte', aide: 'la meme, qui tient',
      p: { modele: 'metal', filtre: 'passe-haut', frequence: 6200, resonance: 0.8,
        duree: 0.2, timbre1: 0 } },
    { nom: 'Cymbale', aide: 'metallique, plus grave et bien plus longue',
      p: { modele: 'metal', filtre: 'passe-haut', frequence: 4100, resonance: 0.6,
        duree: 0.5, timbre1: 0 } },
  ],
  kick: [
    { nom: 'Sinus long', aide: 'descend loin et tient : la grosse caisse des boites analogiques de 1980',
      p: { modele: 'propre', depart: 190, arrivee: 42, glisse: 0.09, duree: 0.2, timbre1: 0 } },
    { nom: 'Claquante', aide: 'chute rapide et clic d attaque : celle des boites de 1983, taillee pour la piste',
      p: { modele: 'propre', depart: 260, arrivee: 48, glisse: 0.04, duree: 0.16, timbre1: 0.53 } },
    { nom: 'Sourde', aide: 'grave, longue, sans attaque : elle porte sans se faire entendre',
      p: { modele: 'propre', depart: 120, arrivee: 35, glisse: 0.12, duree: 0.32, timbre1: 0 } },
    { nom: 'Saturee', aide: 'passe devant le mix sans monter de niveau',
      p: { modele: 'sature', depart: 220, arrivee: 55, glisse: 0.06, duree: 0.2, timbre1: 0.33 } },
  ],
};
