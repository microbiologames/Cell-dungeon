/* ---------------------------------------------------------------------------
   Matrices et courbes du directeur.
   Source de verite : docs/01-matrices.md et docs/04-vagues-equilibrage.md.
   Ces courbes sont partagees avec tools/balance-sim.mjs : un seul jeu de
   constantes, verifie hors du navigateur.
--------------------------------------------------------------------------- */

import {
  MILK_MOBS, MILK_NEUTRALS, MILK_BOSSES,
  PIPE_MOBS, PIPE_NEUTRALS, PIPE_BOSSES,
  KOMBUCHA_MOBS, KOMBUCHA_NEUTRALS, KOMBUCHA_BOSSES,
  LEVAIN_MOBS, LEVAIN_NEUTRALS, LEVAIN_BOSSES,
} from './bestiary.js';

/** Population de menace visee, en credits presents SIMULTANEMENT dans le
 *  champ (ce n'est pas un debit : le directeur maintient ce niveau et
 *  reapprovisionne les morts). C'est la densite qui porte la montee
 *  d'intensite, pas les points de vie. 13 -> 57 credits sur un run. */
export const OPENING = 0.12;   // fraction du run consacree a la mise en jambes

export const threatBudget = (p) => {
  /* OUVERTURE : on demarre avec trois ou quatre bacteries simples, et la
     population monte jusqu'a son socle sur les 85 premieres secondes. Sans
     cette rampe, le joueur est jete dans une foule des la premiere seconde.
     Elle est une PHASE a part entiere, pas le debut du plateau : le
     simulateur la mesure separement, sinon elle ferait passer le plateau
     pour rompu. */
  const socle = 4.5 + 8.5 * Math.min(1, p / OPENING);
  /* Puis la courbe validee : plateau long, puis decrochage. */
  return socle * (1 + 3.4 * Math.pow(p, 2.8));
};
/** Multiplicateur de PV des mobs : suit la courbe de degats du joueur. */
export const hpScale = (p) => 1 + 1.9 * Math.pow(p, 1.20);
/** Multiplicateur de degats des mobs. */
export const dmgScale = (p) => 1 + 0.9 * p;
/** Multiplicateur de vitesse des mobs. */
export const speedScale = (p) => 1 + 0.35 * p;

/** Poids d'achat par role, selon le palier (0 a 4). */
export const TIER_WEIGHTS = [
  { chaff: 100 },
  { chaff: 70, runner: 30, ranged: 8 },
  { chaff: 55, runner: 30, ranged: 12, tank: 15 },
  { chaff: 40, runner: 28, ranged: 12, tank: 18, splitter: 14, denier: 10 },
  { chaff: 30, runner: 25, ranged: 10, tank: 20, splitter: 16, denier: 14, predator: 8 },
];

/** Garde-fous anti-frustration : au-dela, l'arene devient injouable
 *  et non pas difficile. */
export const ROLE_CAPS = { ranged: 2, denier: 3, predator: 2, tank: 6 };

/** Courbe d'experience.
 *
 *  Recalibree sur le JEU REEL (tools/playtest.mjs) et non sur le modele
 *  abstrait : le simulateur supposait que le joueur tue tout ce qu'il peut,
 *  alors qu'en pratique il passe une bonne part du temps a se replacer et a
 *  ramasser. L'ancienne courbe promettait le niveau 26 et en donnait 13. */
export const XP_FOR_LEVEL = (n) => 5 + 4 * n + 0.20 * n * n;

export const MILK = {
  id: 'milk',
  label: 'LAIT CRU',
  subtitle: 'TANK REFRIGERE, 36 H',
  playable: true,
  duration: 720,
  /* Le champ visible fait environ 110 px de rayon : a 560, on butait sans
     arret sur le menisque. A 1600 le monde fait une centaine de fois la
     surface visible, et le bord redevient un evenement. */
  arenaRadius: 1600,
  pool: MILK_MOBS,
  neutrals: MILK_NEUTRALS,
  /* Nombre d'organismes neutres entretenus autour du joueur. */
  ambient: 3,
  bosses: MILK_BOSSES,

  /* Deverrouillage des roles, en secondes. */
  unlocks: { chaff: 0, runner: 30, ranged: 120, tank: 180, splitter: 300, denier: 300 },

  /* Calendrier. Un `lull` coupe le budget : le contraste porte l'intensite. */
  events: [
    { t: 240, type: 'boss', id: 'staph' },
    { t: 360, type: 'lull', dur: 20, budget: 0.10 },
    { t: 480, type: 'sporewave' },
    { t: 690, type: 'lull', dur: 15, budget: 0.10 },
    { t: 720, type: 'boss', id: 'listeria' },
  ],

  /* Physico-chimie : le pH descend avec les tirs du joueur. */
  chem: {
    phStart: 6.7, phFloor: 5.0,
    /* Acidification : en unites de pH par seconde de vol pour la trainee,
       et en une fois pour le depot de fin de course. Calibre pour qu'un
       arrosage soutenu d'une zone la fasse passer sous 5,6 (seuil des
       coliformes) en une dizaine de secondes, mais pas d'un seul tir. */
    phTrail: 0.30, phDeposit: 0.34,
    /* Sous ces seuils, la flore trinque. Valeurs de docs/01-matrices.md. */
    coliformSlowBelow: 5.6, pseudomonasBurnBelow: 5.2, pseudomonasBurnDps: 3,
    tempC: 8,
  },

  /* Decor : globules gras, generes par hachage de coordonnees. */
  /* Gamme de tailles large et BIAISEE vers le petit : dans un lait cru les
     globules gras vont de 1 a 8 um avec beaucoup plus de petits que de gros,
     et c'est cette dispersion qui donne au champ sa texture. Un gros globule
     devient un vrai obstacle, et donc un vrai abri. */
  decor: {
    kind: 'globule', minR: 1.5, maxR: 16, skew: 2.4,
    bubbleMinR: 1.8, bubbleMaxR: 15, bubbleSkew: 2.0,
    blocksBullets: true,
  },
};

/* La conduite est jouable ; le kombucha et le sang sont encore des ebauches.
   Elles existent ici pour que le lobby les montre — un puits grise dit mieux
   "a venir" qu'une absence. Specification : docs/01-matrices.md. */

export const PIPE = {
  id: 'pipe',
  label: 'CONDUITE',
  subtitle: 'ACIER 316L, BIOFILM',
  playable: true,
  duration: 720,
  /* Ce n'est pas un disque : c'est un tube, et il n'a PAS DE BOUT. La
     geometrie (chambres, pincements, filtres, bifurcations) est generee par
     hachage de l'abscisse et se repete sur une periode que le tapis roulant
     de la Conduite rend invisible. `demi` est la demi-hauteur NOMINALE :
     la vraie section varie de 0,42 a 1,75 fois cette valeur. */
  arena: { kind: 'tube', demi: 112 },
  arenaRadius: 1408,
  pool: PIPE_MOBS,
  neutrals: PIPE_NEUTRALS,
  ambient: 2,
  bosses: PIPE_BOSSES,

  /* Un couloir de 224 px de large concentre la horde : a budget egal, la
     pression y est bien plus forte que dans une goutte de 2800 px. Mesure sans
     ce facteur : 3 a 12 fois plus de morts que dans le lait cru. */
  budgetScale: 0.68,
  /* Dans un couloir on ne decroche pas : un nageur rapide reste colle. Les
     plafonds y sont donc plus bas que dans la goutte, sinon le seul role
     "runner" faisait 96 % des degats subis. */
  roleCaps: { chaff: 14, runner: 4, tank: 3, denier: 3, predator: 1 },

  /* Ecoulement laminaire, en px/s au centre du tube. Il vaut la moitie de la
     vitesse de depart du joueur : remonter le courant est penible sans etre
     impossible, et la couche limite devient un vrai choix. */
  /* 26 px/s au centre d'une section nominale. Avec le facteur de debit
     plafonne a 1,8, le courant culmine a 47 px/s dans un pincement — 69 %
     de la vitesse de nage de depart. On remonte, mais on le sent. */
  pipe: { flow: 26 },

  unlocks: { chaff: 0, runner: 25, tank: 110, predator: 210, denier: 0 },

  events: [
    { t: 240, type: 'boss', id: 'mucoid' },
    { t: 400, type: 'lull', dur: 18, budget: 0.12 },
    { t: 480, type: 'boss', id: 'amibe' },
    { t: 690, type: 'lull', dur: 15, budget: 0.10 },
    { t: 720, type: 'boss', id: 'biofilm' },
  ],

  /* Une conduite laitiere en service tourne acide : le rincage acide et les
     residus de lactose fermente laissent un milieu bien plus bas que le lait.
     Le plancher est plus bas aussi, l'acide n'a pas de caseine a tamponner. */
  chem: {
    phStart: 5.4, phFloor: 3.6,
    phTrail: 0.30, phDeposit: 0.34,
    coliformSlowBelow: 4.6, pseudomonasBurnBelow: 4.2, pseudomonasBurnDps: 3,
    tempC: 20,
  },

  /* Decor : pas de globules gras ici mais des amas d'EPS et des bulles du
     circuit. On reutilise la meme generation par hachage : ce qui est dore
     colle, ce qui est clair repousse. */
  decor: {
    kind: 'globule', minR: 1.5, maxR: 11, skew: 2.8,
    bubbleMinR: 1.6, bubbleMaxR: 9, bubbleSkew: 2.2,
    blocksBullets: true,
    /* Le decor boucle avec le monde, sinon le recentrage du tapis roulant
       ferait sauter tous les globules d'un coup. */
    periodeX: 2816,
  },
};

export const KOMBUCHA = {
  id: 'kombucha',
  label: 'KOMBUCHA',
  subtitle: 'JARRE, JOUR 7',
  playable: true,
  duration: 720,
  /* Une jarre : arene ouverte, comme le lait cru, mais plus resserree — on
     est dans un bocal, pas dans un tank. */
  arenaRadius: 1100,
  pool: KOMBUCHA_MOBS,
  neutrals: KOMBUCHA_NEUTRALS,
  /* Peu de neutres, mais enormes : ce sont les baleines du stage. Trois et
     non deux depuis que les hyphes s'ajoutent au lot : avec deux places
     pour trois especes, on pouvait traverser un run sans jamais voir de
     mycelium. */
  ambient: 3,
  bosses: KOMBUCHA_BOSSES,

  /* Une jarre est un milieu riche et encombre : a surface egale, il s'y
     passe plus de choses que dans un tank refrigere. */
  budgetScale: 1.2,

  unlocks: { chaff: 0, runner: 30, splitter: 90, denier: 150, tank: 240 },

  events: [
    { t: 240, type: 'boss', id: 'scoby' },
    { t: 400, type: 'lull', dur: 18, budget: 0.12 },
    { t: 690, type: 'lull', dur: 15, budget: 0.10 },
    { t: 720, type: 'boss', id: 'scoby' },
  ],

  /* La signature du stage : le CO2 de la fermentation remonte en permanence,
     et sa cadence monte avec la progression. */
  bulles: {
    debut: 0.16, fin: 0.85,
    /* De la taille du joueur (3,4) a la MOITIE DU DISQUE observe (rayon
       124 px) : c'est cette echelle qui rend une jarre vivante. Une bulle
       de 5 px passe sans qu'on la remarque, une de 60 px chasse tout ce
       qui se trouve devant elle. Le biais garde les petites majoritaires,
       sinon la jarre devient un jacuzzi. */
    rMin: 4, rMax: 62, skew: 2.4,
    vitesseZ: 0.28,
    /* Une bulle ne blesse pas, elle BRASSE. Mesure a 320 : le joueur ne
       sentait rien. Le fluide chasse devant la bulle deplace un volume
       egal au sien — a cette echelle, c'est une vague. */
    /* Mesure, derive naturelle, bulle de 60 px sur un joueur immobile :
       320 donnait 24 px/s de crete (x0,4 de la vitesse de nage) et 32 px de
       deplacement — imperceptible. 2600 donne 81 px/s (x1,2) et 94 px, soit
       les trois quarts du rayon du disque observe : la vague prend la main
       sur la nage, ce qui est exactement ce qu'on veut. Au-dela l'effet
       sature, le joueur sortant de la vague avant d'en profiter. */
    poussee: 2600,
  },

  /* pH 3,0 : bien plus acide que le lait cru. Une bacterie lactique y est
     mal, et son propre acide n'y change plus grand-chose — le milieu est
     deja sature d'acide acetique. */
  chem: {
    phStart: 3.0, phFloor: 2.5,
    phTrail: 0.16, phDeposit: 0.18,
    coliformSlowBelow: 2.9, pseudomonasBurnBelow: 2.7, pseudomonasBurnDps: 3,
    tempC: 24,
  },

  /* Le decor d'une jarre : des lambeaux de cellulose et des bulles piegees
     dans la pellicule. Gamme large, biaisee vers le petit. */
  decor: {
    kind: 'globule', minR: 1.5, maxR: 14, skew: 2.6,
    bubbleMinR: 2, bubbleMaxR: 13, bubbleSkew: 1.9,
    blocksBullets: true,
  },
};

export const LEVAIN = {
  id: 'levain',
  label: 'LEVAIN',
  subtitle: 'CHEF, TROISIEME JOUR',
  playable: true,
  duration: 720,
  /* Une pate : dense, encombree. L'arene est petite parce que le champ est
     deja plein — la difficulte est de circuler, pas de couvrir du terrain. */
  arenaRadius: 900,
  pool: LEVAIN_MOBS,
  neutrals: LEVAIN_NEUTRALS,
  ambient: 3,
  bosses: LEVAIN_BOSSES,

  /* Un levain est la matrice la plus DENSE du jeu : on y est au coude a
     coude. Et comme la flore y est surtout immobile, il en faut plus pour
     que la pression se fasse sentir — mesure a 1,0 : zero mort sur le
     premier tiers, le stage etait une promenade. */
  budgetScale: 1.28,

  /* Le coureur arrive TOT. La flore du levain est essentiellement immobile —
     c'est exact, les lactobacilles de levain ne nagent pas — et une horde
     immobile ne menace personne : mesure a zero mort sur le premier tiers.
     C'est L. plantarum, la seule mobile du lot, qui porte l'ouverture. */
  unlocks: { chaff: 0, runner: 18, splitter: 100, denier: 170, tank: 260 },

  events: [
    { t: 240, type: 'boss', id: 'amasmur' },
    { t: 420, type: 'lull', dur: 18, budget: 0.12 },
    { t: 690, type: 'lull', dur: 15, budget: 0.10 },
    { t: 720, type: 'boss', id: 'amasmur' },
  ],

  /* PAS de bulles ici. Un levain en produit, evidemment — mais la mecanique
     de remontee est la signature du kombucha, et la reprendre telle quelle
     dans un deuxieme stage ouvert dilue les deux. Le levain a deja sa
     mecanique : l'encombrement. Deux stages ouverts doivent se jouer
     differemment, pas se ressembler.
     La fermentation reste lisible autrement : le pH descend, la pate est
     pleine. */

  /* pH 3,9 : acide, mais c'est le domaine des bacteries lactiques. Le joueur
     y est chez lui — c'est la seule matrice apres le lait cru ou il ait cet
     avantage. */
  chem: {
    phStart: 3.9, phFloor: 3.3,
    phTrail: 0.22, phDeposit: 0.26,
    coliformSlowBelow: 3.8, pseudomonasBurnBelow: 3.5, pseudomonasBurnDps: 3,
    tempC: 26,
  },

  /* LES GRAINS D'AMIDON. Ce sont eux le stage : enormes, immobiles, ils
     bloquent les tirs et forment un labyrinthe ou l'on se fait pieger. Les
     grains de ble sont reellement bimodaux — de grosses lenticulaires A de
     15 a 35 um et une nuee de petites spheriques B de 2 a 10 — d'ou une
     gamme tres large et un biais leger seulement. */
  decor: {
    kind: 'globule', minR: 2.5, maxR: 48, skew: 2.0,
    bubbleMinR: 1.8, bubbleMaxR: 10, bubbleSkew: 2.2,
    blocksBullets: true,
    /* LENTICULAIRES. Un grain d'amidon de ble est une lentille, pas une
       bille : allonge, il barre le passage sur sa longueur et se contourne
       par la tranche. C'est ce qui fait qu'on NAVIGUE entre les grains au
       lieu de slalomer entre des points. */
    elongation: [1.4, 2.6],
    /* Une pate est une preparation MINCE : on ne regarde pas au travers
       d'une colonne de liquide, les grains sont tous a peu pres dans le
       plan. Sans ce resserrement, les deux tiers du champ etaient flous
       donc traversables, et le labyrinthe n'existait pas. */
    zEtalement: 0.45,
    /* IMPENETRABLES a partir de 5 px de rayon : un grain d'amidon est un
       cristal, pas une gouttelette. C'est ce qui fait le labyrinthe. */
    solide: true,
    solideMinR: 5,
    /* Une pate est PLEINE. Mesure : a 2,2 on traversait le champ en ligne
       droite sans toucher un grain. */
    densite: 4.2,
  },
};

/* Le SANG reste une ebauche, et c'est un choix : en travaillant la conduite,
   il est apparu que le stage ultime n'est pas une goutte de sang mais un
   RESEAU VASCULAIRE — couloirs labyrinthiques, courant pulsatile,
   bifurcations, hematies qui bousculent, systeme immunitaire. Autrement dit
   la conduite poussee a son terme. Le construire maintenant reviendrait a
   jeter la moitie du travail : il attend que les couloirs soient murs. */
export const BLOOD = {
  id: 'blood', label: 'SANG', subtitle: 'IN VIVO, 37 C',
  playable: false, duration: 720, arenaRadius: 1600, pool: [], bosses: {},
  unlocks: {}, events: [],
  chem: { phStart: 7.4, phFloor: 6.8, phTrail: 0.3, phDeposit: 0.34, tempC: 37 },
  decor: { kind: 'globule', minR: 2, maxR: 16, skew: 2.2,
    bubbleMinR: 1.8, bubbleMaxR: 10, bubbleSkew: 2.0, blocksBullets: true },
};

export const MATRICES = {
  milk: MILK, pipe: PIPE, kombucha: KOMBUCHA, levain: LEVAIN, blood: BLOOD,
};

/** Palier courant (0 a 4) pour une fraction de run. */
export function tierAt(p) {
  return Math.max(0, Math.min(TIER_WEIGHTS.length - 1, Math.floor(p * 5)));
}
