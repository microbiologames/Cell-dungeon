/* ---------------------------------------------------------------------------
   Matrices et courbes du directeur.
   Source de verite : docs/01-matrices.md et docs/04-vagues-equilibrage.md.
   Ces courbes sont partagees avec tools/balance-sim.mjs : un seul jeu de
   constantes, verifie hors du navigateur.
--------------------------------------------------------------------------- */

import { MILK_MOBS, MILK_BOSSES } from './bestiary.js';

/** Population de menace visee, en credits presents SIMULTANEMENT dans le
 *  champ (ce n'est pas un debit : le directeur maintient ce niveau et
 *  reapprovisionne les morts). C'est la densite qui porte la montee
 *  d'intensite, pas les points de vie. 13 -> 57 credits sur un run. */
export const threatBudget = (p) => 13 * (1 + 3.4 * Math.pow(p, 2.8));
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

/** Courbe d'experience. Calibree pour atteindre le niveau 26-30 en 12 min
 *  avec le revenu d'acides amines reel : verifie par tools/balance-sim.mjs. */
export const XP_FOR_LEVEL = (n) => 6 + 5 * n + 0.32 * n * n;

export const MILK = {
  id: 'milk',
  label: 'LAIT CRU',
  subtitle: 'TANK REFRIGERE, 36 H',
  duration: 720,
  arenaRadius: 560,
  pool: MILK_MOBS,
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
  decor: { kind: 'globule', density: 0.00022, minR: 2, maxR: 7, blocksBullets: true },
};

export const MATRICES = { milk: MILK };

/** Palier courant (0 a 4) pour une fraction de run. */
export function tierAt(p) {
  return Math.max(0, Math.min(TIER_WEIGHTS.length - 1, Math.floor(p * 5)));
}
