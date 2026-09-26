/* ---------------------------------------------------------------------------
   Calcul des statistiques du joueur a partir des evolutions prises.
   Convention : suffixe Mul -> somme puis (1 + somme) ; suffixe Add -> plat.

   BASE est la table de la souche de REFERENCE, le lactobacille. Une autre
   souche ne redefinit que ce qui change chez elle (src/data/especes.js) :
   garder une seule table de reference evite le jeu de nombres parallele qui
   finit toujours par diverger.
--------------------------------------------------------------------------- */

import { EVO_BY_ID } from '../data/evolutions.js';
import { clamp } from '../core/util.js';

export const BASE = {
  maxHp: 100,
  regen: 0,
  /* 56 et non 68. Baisse de 18 % decidee pour que la FLAGELLATION soit un
     vrai gain et non un ajustement : a 68 de base, un joueur qui n'achetait
     aucune carte de nage se sortait de tout en ligne droite, et les six
     rangs de `flagelle` (+54 %) ne changeaient qu'un confort. A 56, la
     meme cellule pleinement flagellee monte a ~100 et c'est ELLE qui decide
     si on distance un coureur. Le debut de partie se joue au corps a corps ;
     la vitesse est ce qu'on gagne. */
  speed: 56,         // vitesse de pointe, px/s
  /* Acceleration : c'est elle qui porte l'inertie. Une valeur finie donne a
     la cellule une mise en train et une glisse, au lieu d'un deplacement
     collant a la touche. La flagellation la module fortement. */
  accel: 400,        // px/s^2
  dmg: 10,
  fireRate: 2.2,     // tirs/s
  /* Une goutte d'acide ejectee n'est pas une balle : elle part lentement et
     se diffuse en vol (voir la diffusion des projectiles dans game.js). */
  bulletSpeed: 172,
  bulletRadius: 2.2,
  /* Portee : l'acide se dilue vite. Au depart on touche a peine au-dela de
     son propre voisinage, et c'est une STAT que les evolutions comblent. */
  range: 96,
  pierce: 0,
  projectiles: 1,
  spread: 0,
  aaGain: 1,
  /* Rayon de captation court : il faut aller CHERCHER les acides amines,
     c'est ce qui oblige a entrer dans la foule. Cale sur la vitesse du
     joueur : a 22 px avec une cellule a 68 px/s, la recolte ne suivait plus
     et le joueur sous-montait en niveau (mesure par tools/playtest.mjs). */
  pickup: 34,
  pull: 1,           // vivacite de l'attraction
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
  aaGainMul: 'aaGain', pickupMul: 'pickup', maxHpMul: 'maxHp',
  hitboxMul: 'hitbox', focusPenaltyMul: 'focusPenalty',
  accelMul: 'accel', pullMul: 'pull', rangeMul: 'range',
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
 * @param {object|null} espece  souche jouee ; ses `stats` remplacent BASE
 * @returns {{stats: object, flags: Set<string>, rank: (id:string)=>number}}
 */
export function computeStats(taken, espece = null) {
  const B = espece && espece.stats ? { ...BASE, ...espece.stats } : BASE;
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
    maxHp: (B.maxHp + (adds.maxHp || 0)) * (1 + (muls.maxHp || 0)),
    regen: B.regen + (adds.regen || 0),
    speed: B.speed * (1 + (muls.speed || 0)),
    /* L'agilite ne descend jamais sous 35 % : une cellule lourde reste
       pilotable, elle est juste patraque. */
    accel: B.accel * Math.max(0.35, 1 + (muls.accel || 0)),
    pull: B.pull * (1 + (muls.pull || 0)),
    dmg: B.dmg * (1 + (muls.dmg || 0)),
    fireRate: B.fireRate * (1 + (muls.fireRate || 0)),
    bulletSpeed: B.bulletSpeed * (1 + (muls.bulletSpeed || 0)),
    bulletRadius: B.bulletRadius * (1 + (muls.bulletRadius || 0)),
    range: B.range * (1 + (muls.range || 0)),
    pierce: B.pierce + (adds.pierce || 0),
    projectiles: B.projectiles + (adds.projectiles || 0),
    spread: B.spread + (adds.spread || 0),
    aaGain: B.aaGain * (1 + (muls.aaGain || 0)),
    pickup: B.pickup * (1 + (muls.pickup || 0)),
    hitbox: B.hitbox * (1 + (muls.hitbox || 0)),
    dof: B.dof + (adds.dof || 0),
    focusPenalty: clamp(B.focusPenalty * (1 + (muls.focusPenalty || 0)), 0.15, 1),
    aura: { dps: auraDps, radius: auraDps > 0 ? Math.max(auraRadius, 22) : 0 },
    /* Les resistances saturent : aucune n'atteint jamais l'immunite. */
    resist: clamp(B.resist + (adds.resist || 0), -0.5, 0.75),
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

/* ---------------------------------------------------------------------------
   Profil d'une souche : ce qu'elle a de mieux et de pire que la reference.
--------------------------------------------------------------------------- */

/**
 * Les stats comparees, avec le sens dans lequel « plus » est un atout.
 *
 * La liste est courte volontairement. Une fiche qui enumere onze ecarts ne
 * se lit pas : ce qu'on veut donner au joueur devant une alveole, c'est de
 * quoi CHOISIR, donc trois atouts et trois faiblesses au plus.
 *
 * `hitbox` est le seul champ dont le sens s'inverse — une grosse cellule est
 * une grosse cible — et c'est exactement pour ca qu'il est dans la table
 * plutot que dans une exception ailleurs.
 */
/* QUATORZE CARACTERES AU PLUS, et ce n'est pas une coquetterie : en paysage
   le HUD n'a qu'une colonne de 64 a 110 px selon la fenetre, soit 16 a 27
   caracteres a 4 px le glyphe. Avec le prefixe « + » ou « - » et son espace,
   quatorze tient tout juste dans le cas etroit. Verifie sur capture en
   620x590, la fenetre qui donne la colonne la plus mince : « PAS DE
   FLAGELLE » y mordait sur le disque, « SANS FLAGELLE » non. */
const COMPAREES = [
  { cle: 'maxHp', sens: 1, plus: 'ENCAISSE', moins: 'FRAGILE' },
  { cle: 'dmg', sens: 1, plus: 'FRAPPE FORT', moins: 'FRAPPE FAIBLE' },
  { cle: 'fireRate', sens: 1, plus: 'CADENCE RAPIDE', moins: 'CADENCE LENTE' },
  { cle: 'speed', sens: 1, plus: 'NAGE VITE', moins: 'NAGE LENTEMENT' },
  { cle: 'accel', sens: 1, plus: 'RELANCE VIVE', moins: 'RELANCE LOURDE' },
  { cle: 'range', sens: 1, plus: 'LONGUE PORTEE', moins: 'COURTE PORTEE' },
  { cle: 'hitbox', sens: -1, plus: 'PETITE CIBLE', moins: 'GROSSE CIBLE' },
  { cle: 'aaGain', sens: 1, plus: 'RECOLTE BIEN', moins: 'RECOLTE MAL' },
];

/* 8 % : en deca, l'ecart ne se sent pas en jouant et l'afficher ferait du
   bruit. Mesure a 4 %, la fiche du lactobacille — qui EST la reference —
   sortait deux lignes a cause des arrondis du bestiaire. */
const SEUIL = 0.08;

/**
 * Atouts et faiblesses d'une souche, DERIVES de ses stats.
 *
 * Rien n'est recopie a la main : les souches sont des ecarts a `BASE`, donc
 * la fiche se calcule. Une fiche ecrite a la main aurait divergé du premier
 * reglage d'equilibrage — et c'est arrive assez souvent dans ce depot pour
 * qu'on n'essaie meme pas.
 *
 * @returns {{atouts: string[], faiblesses: string[]}}
 */
export function profilSouche(espece) {
  const st = { ...BASE, ...(espece.stats || {}) };
  const atouts = [];
  const faiblesses = [];
  for (const c of COMPAREES) {
    const ref = BASE[c.cle];
    if (!ref) continue;
    const ecart = (st[c.cle] / ref - 1) * c.sens;
    if (Math.abs(ecart) < SEUIL) continue;
    (ecart > 0 ? atouts : faiblesses).push({ t: ecart > 0 ? c.plus : c.moins, a: Math.abs(ecart) });
  }
  /* Le confort acide n'est pas une stat mais il decide de la cadence reelle
     dans un milieu qui s'acidifie a chaque tir : c'est le joueur lui-meme
     qui fabrique ce terrain, donc il le subit toute la partie. */
  if (espece.confortAcide > 0.05) atouts.push({ t: 'AIME L ACIDE', a: 0.5 });
  else if (espece.confortAcide < -0.05) faiblesses.push({ t: 'CRAINT L ACIDE', a: 0.5 });
  /* Et la fermeture des cartes de nage, qui ne se lit dans aucune stat alors
     qu'elle ferme six rangs d'evolution. */
  if (espece.aflagelle) faiblesses.push({ t: 'SANS FLAGELLE', a: 0.6 });

  const trie = (xs) => xs.sort((u, v) => v.a - u.a).slice(0, 3).map((u) => u.t);
  return { atouts: trie(atouts), faiblesses: trie(faiblesses) };
}
