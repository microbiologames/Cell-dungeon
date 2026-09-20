/* ---------------------------------------------------------------------------
   Calcul des statistiques du joueur a partir des evolutions prises.
   Convention : suffixe Mul -> somme puis (1 + somme) ; suffixe Add -> plat.
--------------------------------------------------------------------------- */

import { EVO_BY_ID } from '../data/evolutions.js';
import { clamp } from '../core/util.js';

export const BASE = {
  maxHp: 100,
  regen: 0,
  speed: 118,        // px/s
  dmg: 10,
  fireRate: 2.2,     // tirs/s
  bulletSpeed: 330,
  bulletRadius: 2.2,
  range: 190,
  pierce: 0,
  projectiles: 1,
  spread: 0,
  dnaGain: 1,
  pickup: 46,
  resist: 0,         // reduction de degats, 0..0.75
  hitbox: 3.4,
  dof: 0.45,         // profondeur de champ
  focusPenalty: 1,   // 1 = penalite de nettete pleine
  aura: { dps: 0, radius: 0 },
  gramPierce: 0,
  fungiDmg: 0,
  acidResist: 0,
  rosResist: 0,
  envResist: 0,
  phagoResist: 0,
};

const MUL_KEYS = {
  dmgMul: 'dmg', speedMul: 'speed', fireRateMul: 'fireRate',
  bulletSpeedMul: 'bulletSpeed', bulletRadiusMul: 'bulletRadius',
  dnaGainMul: 'dnaGain', pickupMul: 'pickup', maxHpMul: 'maxHp',
  hitboxMul: 'hitbox', focusPenaltyMul: 'focusPenalty',
};
const ADD_KEYS = {
  maxHpAdd: 'maxHp', regenAdd: 'regen', resistAdd: 'resist',
  projectilesAdd: 'projectiles', spreadAdd: 'spread', pierceAdd: 'pierce',
  dofAdd: 'dof', gramPierceAdd: 'gramPierce', fungiDmgAdd: 'fungiDmg',
  acidResistAdd: 'acidResist', rosResistAdd: 'rosResist',
  envResistAdd: 'envResist', phagoResistAdd: 'phagoResist',
};

/**
 * @param {Map<string, number>} taken  id d'evolution -> rang possede
 * @returns {{stats: object, flags: Set<string>, rank: (id:string)=>number}}
 */
export function computeStats(taken) {
  const muls = {};
  const adds = {};
  let auraDps = 0, auraRadius = 0;
  const flags = new Set();

  for (const [id, rank] of taken) {
    const evo = EVO_BY_ID[id];
    if (!evo || rank <= 0) continue;
    if (evo.flag) flags.add(evo.flag);
    if (!evo.mods) continue;
    for (const [k, v] of Object.entries(evo.mods)) {
      if (k === 'auraDpsAdd') { auraDps += v * rank; continue; }
      if (k === 'auraRadiusAdd') { auraRadius = Math.max(auraRadius, v); continue; }
      if (MUL_KEYS[k]) muls[MUL_KEYS[k]] = (muls[MUL_KEYS[k]] || 0) + v * rank;
      else if (ADD_KEYS[k]) adds[ADD_KEYS[k]] = (adds[ADD_KEYS[k]] || 0) + v * rank;
    }
  }

  const s = {
    maxHp: (BASE.maxHp + (adds.maxHp || 0)) * (1 + (muls.maxHp || 0)),
    regen: BASE.regen + (adds.regen || 0),
    speed: BASE.speed * (1 + (muls.speed || 0)),
    dmg: BASE.dmg * (1 + (muls.dmg || 0)),
    fireRate: BASE.fireRate * (1 + (muls.fireRate || 0)),
    bulletSpeed: BASE.bulletSpeed * (1 + (muls.bulletSpeed || 0)),
    bulletRadius: BASE.bulletRadius * (1 + (muls.bulletRadius || 0)),
    range: BASE.range,
    pierce: BASE.pierce + (adds.pierce || 0),
    projectiles: BASE.projectiles + (adds.projectiles || 0),
    spread: BASE.spread + (adds.spread || 0),
    dnaGain: BASE.dnaGain * (1 + (muls.dnaGain || 0)),
    pickup: BASE.pickup * (1 + (muls.pickup || 0)),
    hitbox: BASE.hitbox * (1 + (muls.hitbox || 0)),
    dof: BASE.dof + (adds.dof || 0),
    focusPenalty: clamp(BASE.focusPenalty * (1 + (muls.focusPenalty || 0)), 0.15, 1),
    aura: { dps: auraDps, radius: auraDps > 0 ? Math.max(auraRadius, 22) : 0 },
    /* Les resistances saturent : aucune n'atteint jamais l'immunite. */
    resist: clamp(BASE.resist + (adds.resist || 0), -0.5, 0.75),
    gramPierce: clamp(adds.gramPierce || 0, 0, 0.7),
    fungiDmg: adds.fungiDmg || 0,
    acidResist: clamp(adds.acidResist || 0, 0, 0.9),
    rosResist: clamp(adds.rosResist || 0, 0, 0.8),
    envResist: clamp(adds.envResist || 0, 0, 0.6),
    phagoResist: clamp(adds.phagoResist || 0, 0, 0.9),
  };

  /* L'immersion voit tout net, mais retrecit le champ de 25 %. */
  if (flags.has('immersion')) s.fieldShrink = 0.75;

  return { stats: s, flags, rank: (id) => taken.get(id) || 0 };
}

/** DPS theorique, utilise par l'equilibrage et l'affichage. */
export function theoreticalDps(stats) {
  return stats.dmg * stats.fireRate * stats.projectiles;
}
