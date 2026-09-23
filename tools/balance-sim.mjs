#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   Verification des deux invariants d'equilibrage (docs/04-vagues-equilibrage.md).

     Invariant 1 - TTK constant   : le joueur tape toujours aussi fort
     Invariant 2 - Pression bornee: la difficulte reste plate, puis decroche

   Simule la courbe de niveaux sur N runs pour deux politiques de choix :
   un joueur qui pioche au hasard, et un joueur qui optimise ses degats.
   Sort en code 1 si un invariant sort de ses bornes.
--------------------------------------------------------------------------- */

import { EVOLUTIONS, EVO_BY_ID, rarityWeight } from '../src/data/evolutions.js';
import { computeStats, theoreticalDps, BASE } from '../src/game/stats.js';
import {
  threatBudget, hpScale, dmgScale, XP_FOR_LEVEL, TIER_WEIGHTS, tierAt, MILK,
} from '../src/data/matrices.js';
import { MILK_MOBS } from '../src/data/bestiary.js';
import { mulberry32, weightedPick } from '../src/core/util.js';

const T = MILK.duration;
const DT = 0.5;
const RUNS = 400;

/* Constantes DERIVEES du bestiaire, jamais recopiees : un second jeu de
   nombres a tenir a jour finit toujours par diverger de celui du jeu. */
const CHAFF = MILK_MOBS.filter((m) => m.role === 'chaff');
const BUYABLE = MILK_MOBS.filter((m) => m.cost > 0);
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

const REF_HP = mean(CHAFF.map((m) => m.hp));
const AVG_COST = mean(BUYABLE.map((m) => m.cost));
const AVG_AA = mean(BUYABLE.map((m) => m.aa));
const AVG_CONTACT = mean(BUYABLE.map((m) => m.contact));
/* Part du temps ou le joueur tue effectivement : mesuree dans le jeu reel
   (tools/playtest.mjs), ou il passe le reste a se replacer et a ramasser. */
const ENGAGE_KILL = 0.38;
/* Fraction du temps ou un mob vivant touche effectivement le joueur.
   Un joueur competent se fait toucher rarement : 7 % du temps de presence. */
const ENGAGEMENT = 0.085;
/* Pression 1.0 signifie : dix secondes pour mourir au contact soutenu. */
const DEATH_WINDOW = 10;

const BASE_SPEED = BASE.speed;

/* ---------------------------------------------------------------------------
   Invariants. Ce sont des invariants de FORME, pas des bornes absolues :
   l'affirmation de design est "le plateau puis le decrochage", pas une
   valeur numerique choisie a la main. Des bornes absolues seraient
   inverifiables (il suffirait de les deplacer jusqu'a ce que ca passe).
--------------------------------------------------------------------------- */
const INVARIANTS = {
  /* 1. TTK plat pour qui choisit bien : le joueur tape toujours aussi fort. */
  ttkWindow: { dps: [0.42, 1.25], random: [0.42, 1.90] },
  ttkUntil: 0.8,
  /* 2a. Ouverture : les premieres secondes doivent etre CALMES. C'est une
         phase voulue, mesuree a part : la confondre avec le plateau ferait
         passer une bonne mise en jambes pour une difficulte croissante. */
  openingAt: 0.03, openingBand: [0.08, 0.42],
  /* 2b. Plateau, mesure APRES l'ouverture : la pression ne doit pas plus
         que doubler pendant que la foule, elle, triple. */
  plateauFrom: 0.15, plateauTo: 0.55, plateauMaxRatio: 1.9,
  /* 2c. Decrochage : la derniere ligne droite doit au moins doubler la
         pression de mi-parcours. C'est le "trop intense, on perd". */
  breakFrom: 0.55, breakTo: 1.0, breakMinRatio: 2.0,
  /* 2d. Garde-fous : ni ennuyeux, ni injuste. */
  absolute: [0.08, 3.2],
  /* 3. La foule doit vraiment grossir : c'est elle qui porte l'intensite. */
  crowdMinRatio: 3.0,
};

function drawHand(rng, taken, size, hyper) {
  /* Les cartes reservees a une souche sont exclues : ce simulateur travaille
     sur le joueur de REFERENCE (le lactobacille), et une carte qu'il ne peut
     pas tirer n'a rien a faire dans sa courbe. Le banc des souches
     (tools/especes.mjs) s'occupe des trois autres. */
  const pool = EVOLUTIONS.filter((e) => (taken.get(e.id) || 0) < e.ranks && !e.espece);
  const hand = [];
  const used = new Set();
  for (let i = 0; i < size && pool.length; i++) {
    const cands = pool.filter((e) => !used.has(e.id));
    if (!cands.length) break;
    const pick = weightedPick(rng, cands, (e) => rarityWeight(e.rarity, hyper));
    if (!pick) break;
    used.add(pick.id);
    hand.push(pick);
  }
  return hand;
}

/** Politique "degats" : prend la carte qui maximise le DPS theorique. */
function bestForDps(hand, taken) {
  let best = hand[0], bestVal = -Infinity;
  for (const c of hand) {
    const trial = new Map(taken);
    trial.set(c.id, (trial.get(c.id) || 0) + 1);
    const { stats } = computeStats(trial);
    const v = theoreticalDps(stats) + stats.maxHp * 0.08;
    if (v > bestVal) { bestVal = v; best = c; }
  }
  return best;
}

function simulate(policy, seed) {
  const rng = mulberry32(seed);
  const taken = new Map();
  let { stats, flags } = computeStats(taken);
  let level = 0, xp = 0;
  const samples = [];

  for (let t = 0; t <= T; t += DT) {
    const p = t / T;
    const dps = theoreticalDps(stats);
    const mobHp = REF_HP * hpScale(p);
    const ttk = mobHp / dps;

    /* Le directeur maintient une population, pas un debit : il remplace les
       morts. Le joueur tue donc a sa capacite, et la foule reste a la cible. */
    const alive = threatBudget(p) / AVG_COST;
    const kills = (dps / mobHp) * ENGAGE_KILL;

    /* Mitigation : la vitesse est une defense reelle (on distance la foule),
       et le controle de foule retire des mobs de l'equation. Sans ce terme
       on sous-estime le joueur rapide et on surestime la difficulte. */
    const speedMit = BASE_SPEED / stats.speed;
    let cc = 0;
    if (flags.has('coagulase')) cc += 0.14;
    if (flags.has('eps')) cc += 0.08;
    if (stats.aura.dps > 0) cc += 0.06;
    const ccMit = 1 - Math.min(cc, 0.45);

    const incoming = alive * AVG_CONTACT * dmgScale(p) * ENGAGEMENT * speedMit * ccMit;
    const effHp = stats.maxHp / (1 - stats.resist) + stats.regen * DEATH_WINDOW;
    const pressure = incoming / (effHp / DEATH_WINDOW);

    samples.push({ t, p, ttk, pressure, level, dps, alive });

    /* Progression */
    xp += kills * AVG_AA * stats.aaGain * DT;
    let guard = 0;
    while (xp >= XP_FOR_LEVEL(level) && guard++ < 10) {
      xp -= XP_FOR_LEVEL(level);
      level++;
      const hyper = flags.has('hypermutateur');
      const hand = drawHand(rng, taken, hyper ? 4 : 3, hyper);
      if (!hand.length) break;
      const pick = policy === 'dps' ? bestForDps(hand, taken)
        : hand[Math.floor(rng() * hand.length)];
      taken.set(pick.id, (taken.get(pick.id) || 0) + 1);
      ({ stats, flags } = computeStats(taken));
    }
  }
  return { samples, level, stats };
}

function aggregate(policy) {
  const acc = [];
  let levelSum = 0;
  for (let i = 0; i < RUNS; i++) {
    const r = simulate(policy, 1234 + i * 7919);
    levelSum += r.level;
    r.samples.forEach((s, k) => {
      if (!acc[k]) acc[k] = { t: s.t, p: s.p, ttk: 0, pressure: 0, level: 0, alive: 0, dps: 0 };
      acc[k].ttk += s.ttk; acc[k].pressure += s.pressure;
      acc[k].level += s.level; acc[k].alive += s.alive; acc[k].dps += s.dps;
    });
  }
  for (const a of acc) {
    a.ttk /= RUNS; a.pressure /= RUNS; a.level /= RUNS; a.alive /= RUNS; a.dps /= RUNS;
  }
  return { acc, avgLevel: levelSum / RUNS };
}

function bandFor(p) {
  for (const [pMax, lo, hi] of PRESSURE_BANDS) if (p <= pMax) return [lo, hi];
  return PRESSURE_BANDS[PRESSURE_BANDS.length - 1].slice(1);
}

const pad = (s, n) => String(s).padStart(n);
const at = (acc, p) => acc.reduce((b, a) => (Math.abs(a.p - p) < Math.abs(b.p - p) ? a : b));
const problems = [];

for (const policy of ['random', 'dps']) {
  const { acc, avgLevel } = aggregate(policy);
  const label = policy === 'dps' ? 'joueur optimisateur' : 'joueur au hasard';
  console.log(`\n=== politique : ${label} — niveau moyen en fin de run : ${avgLevel.toFixed(1)} ===`);
  console.log('  temps  palier    DPS   vivants     TTK   pression');

  for (let k = 0; k < acc.length; k += Math.round(30 / DT)) {
    const a = acc[k];
    const mm = `${Math.floor(a.t / 60)}:${String(Math.floor(a.t % 60)).padStart(2, '0')}`;
    console.log(
      `  ${pad(mm, 5)}  ${pad(tierAt(a.p), 6)} ${pad(a.dps.toFixed(0), 6)} `
      + `${pad(a.alive.toFixed(1), 9)} ${pad(a.ttk.toFixed(2), 7)} ${pad(a.pressure.toFixed(2), 10)}`,
    );
  }

  /* --- verification des invariants --- */
  const [lo, hi] = INVARIANTS.ttkWindow[policy];
  for (const a of acc) {
    if (a.p > INVARIANTS.ttkUntil) continue;
    if (a.ttk < lo || a.ttk > hi) {
      problems.push(`[${label}] TTK ${a.ttk.toFixed(2)} hors de [${lo};${hi}] a t=${a.t.toFixed(0)}s`);
      break;
    }
  }

  const opening = at(acc, INVARIANTS.openingAt).pressure;
  const p0 = at(acc, INVARIANTS.plateauFrom).pressure;
  const pMid = at(acc, INVARIANTS.plateauTo).pressure;
  const pEnd = at(acc, INVARIANTS.breakTo).pressure;
  const plateau = pMid / p0;
  const breakup = pEnd / pMid;
  const crowd = at(acc, 1.0).alive / at(acc, INVARIANTS.plateauFrom).alive;

  console.log(`  ouverture ${opening.toFixed(2)} `
    + `[${INVARIANTS.openingBand[0]};${INVARIANTS.openingBand[1]}]`
    + `   plateau x${plateau.toFixed(2)} (max ${INVARIANTS.plateauMaxRatio})`
    + `   decrochage x${breakup.toFixed(2)} (min ${INVARIANTS.breakMinRatio})`
    + `   foule x${crowd.toFixed(2)} (min ${INVARIANTS.crowdMinRatio})`);

  const [oLo, oHi] = INVARIANTS.openingBand;
  if (opening < oLo || opening > oHi) {
    problems.push(`[${label}] ouverture a ${opening.toFixed(2)}, hors de [${oLo};${oHi}]`);
  }

  if (plateau > INVARIANTS.plateauMaxRatio) {
    problems.push(`[${label}] plateau rompu : pression x${plateau.toFixed(2)} sur la premiere moitie`);
  }
  if (breakup < INVARIANTS.breakMinRatio) {
    problems.push(`[${label}] pas de decrochage : pression x${breakup.toFixed(2)} sur la seconde moitie`);
  }
  if (crowd < INVARIANTS.crowdMinRatio) {
    problems.push(`[${label}] la foule ne grossit pas assez : x${crowd.toFixed(2)}`);
  }
  const [aLo, aHi] = INVARIANTS.absolute;
  const worst = acc.reduce((m, a) => Math.max(m, a.pressure), 0);
  const best = acc.reduce((m, a) => Math.min(m, a.pressure), Infinity);
  if (worst > aHi) problems.push(`[${label}] pression maximale ${worst.toFixed(2)} > ${aHi} : injouable`);
  if (best < aLo) problems.push(`[${label}] pression minimale ${best.toFixed(2)} < ${aLo} : ennuyeux`);
}

if (problems.length) {
  console.error('\nInvariants rompus :');
  for (const p of problems) console.error('  - ' + p);
  console.error('\nAjuster les courbes de src/data/matrices.js.');
  process.exit(1);
}
console.log('\nLes deux invariants tiennent : plateau puis decrochage, TTK maitrise.');
