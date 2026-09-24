#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   Banc des SOUCHES JOUABLES.

   Quatre personnages qui partagent un moteur, c'est quatre facons de le
   casser. Ce banc fait deux choses que l'oeil ne sait pas faire :

   1. il compare les souches sur des grandeurs chiffrees (DPS de depart, PV,
      encombrement, portee) et refuse qu'une sorte de la bande ;
   2. il DECLENCHE chaque caracteristique unique dans la vraie boucle de jeu
      et verifie ce qu'elle a fait — une spore consommee, un amas qui fond
      avec les PV, un genome ampute de moitie.

   Le deuxieme point est le seul qui compte vraiment : un trait qui ne se
   declenche jamais ne leve aucune exception et ne se voit pas non plus sur
   une capture d'ecran. Il faut le provoquer et le mesurer.

     node tools/especes.mjs [runs_par_souche]

   Sort en code 1 si un verdict tombe.
--------------------------------------------------------------------------- */

import { Game, STATE } from '../src/game/game.js';
import { Player } from '../src/game/player.js';
import { ESPECES, TIRS } from '../src/data/especes.js';
import { EVOLUTIONS, EVO_FLAGELLE } from '../src/data/evolutions.js';
import { computeStats, theoreticalDps } from '../src/game/stats.js';
import { makeBullet } from '../src/game/entities.js';
import { collectDecor } from '../src/game/decor.js';

const RUNS = Number(process.argv[2] || 2);
const DUREE = 240;              // secondes de jeu reel par run
const DT = 1 / 60;

const echecs = [];
const verdict = (ok, titre, detail) => {
  console.log(`  ${ok ? 'OK  ' : 'RATE'}  ${titre}${detail ? '  — ' + detail : ''}`);
  if (!ok) echecs.push(titre + (detail ? ' — ' + detail : ''));
};

/* Partie jetable : sert a instancier un joueur hors de toute simulation.
   Le joueur a besoin d'un `game` pour son rng et son arene, pas davantage. */
function partie(especeId, seed = 1234) {
  const g = new Game('milk', seed, especeId);
  g.start();
  return g;
}

function joueurNu(especeId) {
  return partie(especeId).player;
}

/* ===========================================================================
   1. Les stats de depart
   =========================================================================== */

console.log('\n--- STATS DE DEPART ------------------------------------------');
const ref = computeStats(new Map(), ESPECES[0]).stats;
const refDps = theoreticalDps(ref);
console.log('  souche          DPS    x ref    PV     vit   portee  hitbox  tir');
const lignes = [];
for (const e of ESPECES) {
  const s = computeStats(new Map(), e).stats;
  const dps = theoreticalDps(s);
  lignes.push({ e, s, dps, ratio: dps / refDps });
  console.log(`  ${e.id.padEnd(14)} ${dps.toFixed(1).padStart(5)} `
    + `${(dps / refDps).toFixed(2).padStart(6)}  ${String(Math.round(s.maxHp)).padStart(4)} `
    + `${String(Math.round(s.speed)).padStart(6)} ${String(Math.round(s.range)).padStart(7)} `
    + `${s.hitbox.toFixed(1).padStart(7)}  ${e.tir}`);
}

console.log('\n--- VERDICTS -------------------------------------------------');
/* Bande volontairement large : l'egalite de DPS n'est pas le but, la
   jouabilite l'est. Une souche a 0,6 du DPS de reference doit avoir autre
   chose pour elle (des PV, un trait), mais en dessous elle ne tue plus assez
   vite pour recolter, et la spirale est sans retour. */
for (const { e, dps, ratio, s } of lignes) {
  verdict(ratio >= 0.70 && ratio <= 1.30, `[${e.id}] DPS de depart dans [0,70 ; 1,30] x reference`,
    `x${ratio.toFixed(2)}`);
  verdict(s.maxHp >= 90 && s.maxHp <= 240, `[${e.id}] PV de depart dans [90 ; 240]`,
    `${Math.round(s.maxHp)} PV`);
  /* Une hitbox qui depasse 7 px touche les mobs avant de les voir arriver :
     mesure faite en poussant la levure a 8, elle ramassait les contacts sans
     que le joueur puisse les eviter. */
  verdict(s.hitbox <= 7, `[${e.id}] hitbox jouable (<= 7 px)`, `${s.hitbox.toFixed(1)} px`);
  verdict(!!TIRS[e.tir] && !!TIRS[e.tir].note, `[${e.id}] toxine documentee`, TIRS[e.tir].label);
}
/* Quatre souches, quatre toxines : si deux partagent la meme, une des deux
   n'a plus d'identite de tir et le travail de rendu ne sert a rien. */
const tirs = new Set(ESPECES.map((e) => e.tir));
verdict(tirs.size === ESPECES.length, 'chaque souche a sa propre toxine',
  `${tirs.size} toxines pour ${ESPECES.length} souches`);

/* ===========================================================================
   2. Le tirage des evolutions
   =========================================================================== */

console.log('\n--- TIRAGE DES EVOLUTIONS ------------------------------------');
const N_MAINS = 1500;
const reserve = EVOLUTIONS.filter((e) => e.espece);
const stats = {};
for (const e of ESPECES) {
  const p = joueurNu(e.id);
  const compte = {};
  let voieFlagelle = 0, total = 0, flagPousse = 0;
  for (let i = 0; i < N_MAINS; i++) {
    /* On remet le joueur a zero a chaque main : sinon les rangs pris
       faussent les tirages suivants. */
    p.taken.clear();
    p.recompute();
    for (const c of p.draw()) {
      compte[c.id] = (compte[c.id] || 0) + 1;
      if (c.way === 'flagelle') voieFlagelle++;
      /* On compte a part les TROIS cartes qui font pousser un flagelle. La
         voie `flagelle` contient aussi la pompe a protons, les pili et l'EPS,
         qui ne dessinent rien : mesurer la voie entiere ne dirait pas si un
         staphylocoque risque de se retrouver avec une queue. */
      if (EVO_FLAGELLE.has(c.id)) flagPousse++;
      total++;
    }
  }
  stats[e.id] = { compte, partFlagelle: voieFlagelle / total, flagPousse };
  const intrus = reserve.filter((r) => r.espece !== e.id && compte[r.id]);
  const sienne = reserve.filter((r) => r.espece === e.id);
  const tirees = sienne.filter((r) => compte[r.id]);
  console.log(`  ${e.id.padEnd(14)} voie flagelle ${(voieFlagelle / total * 100).toFixed(1)} %`
    + `   cartes a flagelle ${String(flagPousse).padStart(4)}`
    + `   reservees ${tirees.length}/${sienne.length}`
    + `   intrus ${intrus.length}`);
  verdict(intrus.length === 0, `[${e.id}] aucune carte reservee a une autre souche`,
    intrus.map((r) => r.id).join(' ') || 'aucune');
  verdict(tirees.length === sienne.length, `[${e.id}] ses cartes reservees sortent`,
    `${tirees.length}/${sienne.length}`);
}
/* Le biais annonce dans especes.js doit se VOIR : un coque immobile et une
   levure tirent moins de flagelles qu'un bacille nageur. Sans cette mesure,
   la table de biais pourrait etre vide sans que rien ne le signale. */
verdict(stats.aureus.partFlagelle < stats.lactobacillus.partFlagelle * 0.8,
  'S. aureus tire nettement moins de flagelles que la reference',
  `${(stats.aureus.partFlagelle * 100).toFixed(1)} % contre ${(stats.lactobacillus.partFlagelle * 100).toFixed(1)} %`);
verdict(stats.cerevisiae.partFlagelle < stats.lactobacillus.partFlagelle * 0.8,
  'S. cerevisiae tire nettement moins de flagelles que la reference',
  `${(stats.cerevisiae.partFlagelle * 100).toFixed(1)} % contre ${(stats.lactobacillus.partFlagelle * 100).toFixed(1)} %`);

/* Et le verdict qui compte vraiment : ZERO, pas « rare ». Un biais a 0,45
   laissait encore passer une flagellation toutes les quelques parties, ce qui
   suffit a voir un staphylocoque battre du flagelle — c'est ce que l'auteur a
   refuse. Le seuil est donc exact, pas statistique : sur N_MAINS tirages, il
   ne doit en sortir aucune. */
verdict(stats.aureus.flagPousse === 0 && stats.cerevisiae.flagPousse === 0,
  'aucune carte a flagelle pour S. aureus ni S. cerevisiae',
  `aureus ${stats.aureus.flagPousse}, cerevisiae ${stats.cerevisiae.flagPousse} sur ${N_MAINS} mains`);
/* Temoin : le filtre doit fermer DEUX souches, pas le catalogue. Sans lui,
   retirer les trois cartes a tout le monde passerait le verdict precedent. */
verdict(stats.lactobacillus.flagPousse > 0 && stats.cereus.flagPousse > 0,
  'les deux souches nageuses les tirent toujours',
  `lactobacillus ${stats.lactobacillus.flagPousse}, cereus ${stats.cereus.flagPousse}`);

/* ===========================================================================
   3. Les caracteristiques uniques, declenchees pour de vrai
   =========================================================================== */

console.log('\n--- CARACTERISTIQUES UNIQUES ---------------------------------');

/* --- B. cereus : la spore ------------------------------------------------- */
{
  const g = partie('cereus');
  const p = g.player;
  const sporesDepart = p.spores;
  p.hp = -1;
  g.onPlayerDeath();
  const aSporule = g.state === STATE.PLAYING && p.spores === sporesDepart - 1;
  verdict(sporesDepart === 1, 'B. cereus demarre avec une spore', `${sporesDepart}`);
  verdict(aSporule, 'la lyse consomme une spore au lieu de tuer',
    `etat ${g.state}, spores ${p.spores}`);
  verdict(p.hp >= p.stats.maxHp * 0.69, 'la germination rend au moins 70 % des PV',
    `${Math.round(p.hp)} / ${Math.round(p.stats.maxHp)}`);
  verdict(p.dormance > 0 && p.invuln > p.dormance,
    'la spore est dormante ET invulnerable pendant toute la germination',
    `dormance ${p.dormance.toFixed(2)} s, invuln ${p.invuln.toFixed(2)} s`);

  /* Muette : on force une cible a portee et on verifie qu'aucun projectile
     ne part tant que la spore germe. */
  const tirsAvant = g.bullets.length;
  g.spawnSpecific('ecoli', p.x + 20, p.y, 0);
  for (let i = 0; i < 30; i++) g.autoFire(DT);
  verdict(g.bullets.length === tirsAvant, 'une spore en germination ne tire pas',
    `${g.bullets.length - tirsAvant} projectile(s)`);

  /* Credit epuise : la mort reprend ses droits. */
  p.dormance = 0;
  p.hp = -1;
  g.onPlayerDeath();
  verdict(g.state === STATE.DEAD, 'credit de spores epuise, la partie est finie',
    `etat ${g.state}`);

  /* L'evolution dediee augmente bien le credit. */
  const q = joueurNu('cereus');
  q.take('sporeplus'); q.take('sporeplus');
  verdict(q.sporesMax === 3, 'deux rangs de sporulation multiple donnent trois spores',
    `${q.sporesMax}`);
}

/* --- S. aureus : l'amas -------------------------------------------------- */
{
  const p = joueurNu('aureus');
  verdict(p.amasMax === 1 && p.amasVivant === 1,
    'S. aureus demarre unicellulaire', `${p.amasVivant}/${p.amasMax}`);
  for (let i = 0; i < 5; i++) p.take('multiplan');
  verdict(p.amasMax === 6, "cinq rangs de division multiplan donnent l'amas de six",
    `${p.amasMax}`);

  /* Deconstruction : l'amas doit suivre les PV, sans jamais tomber a zero. */
  const paliers = [1, 0.8, 0.5, 0.3, 0.1, 0.01];
  const vus = paliers.map((f) => { p.hp = p.stats.maxHp * f; return p.amasVivant; });
  const decroit = vus.every((v, i) => i === 0 || v <= vus[i - 1]);
  console.log(`  amas selon les PV ${paliers.map((f, i) => `${Math.round(f * 100)}%:${vus[i]}`).join(' ')}`);
  verdict(decroit && vus[0] === 6 && vus[vus.length - 1] === 1,
    "l'amas se deconstruit proportionnellement aux PV, jamais sous une cellule",
    vus.join(' '));

  /* Les degats suivent l'amas : c'est tout l'interet du personnage. */
  p.hp = p.stats.maxHp;
  const plein = p.damageAgainst(null, 1);
  p.hp = p.stats.maxHp * 0.1;
  const blesse = p.damageAgainst(null, 1);
  verdict(plein > blesse * 1.5, 'un amas complet tape nettement plus fort que blesse',
    `${plein.toFixed(1)} contre ${blesse.toFixed(1)}`);

  /* La hitbox grossit avec la grappe : une grappe de six est une grosse
     cible, et c'est la contrepartie. */
  p.hp = p.stats.maxHp; p.recompute();
  const rPlein = p.radius;
  p.hp = p.stats.maxHp * 0.1; p.recompute();
  verdict(rPlein > p.radius, 'la hitbox suit la taille de la grappe',
    `${rPlein.toFixed(2)} px contre ${p.radius.toFixed(2)} px`);
}

/* --- S. cerevisiae : le bourgeon ----------------------------------------- */
{
  const g = partie('cerevisiae');
  const p = g.player;
  const duree = p.bourgeonDuree;
  verdict(p.bourgeon === 0, 'la levure demarre sans bourgeon mur', `${p.bourgeon}`);

  /* Bourgeon vert : la mort est une mort. */
  p.hp = -1;
  g.onPlayerDeath();
  verdict(g.state === STATE.DEAD, 'bourgeon vert, la lyse tue', `etat ${g.state}`);

  /* Maturation : on fait tourner la VRAIE boucle, pas un compteur a part.
     Deux precautions, toutes deux payees par une mesure fausse : on coupe le
     gain d'acides amines (une montee de niveau gele le jeu, et le temps
     mesure comptait alors 75 s pour 50 s annoncees), et on coupe les degats
     (une levure qui meurt avant maturite ne mesure rien). */
  const h = partie('cerevisiae', 99);
  const q = h.player;
  q.gainAa = () => 0;
  h.damagePlayer = () => {};
  const faux = { move: { x: 0, y: 0 }, focusAxis: 0, takeFocusImpulse: () => 0,
    takeDash: () => false, takePause: () => false };
  let t = 0;
  while (q.bourgeon < 1 && t < duree * 1.5) { h.update(DT, faux); t += DT; }
  verdict(q.bourgeon >= 1 && Math.abs(t - duree) < duree * 0.15,
    'le bourgeon murit dans le temps annonce',
    `${t.toFixed(1)} s pour ${duree.toFixed(0)} s annoncees`);

  /* Division : PV pleins, moitie du genome perdue. */
  for (const id of ['ldh', 'ldh', 'ldh', 'peptido', 'peptido', 'ribo', 'reca', 'cardio']) q.take(id);
  const rangsAvant = [...q.taken.values()].reduce((a, b) => a + b, 0);
  const xAvant = q.x, yAvant = q.y;
  q.hp = -1;
  h.onPlayerDeath();
  const rangsApres = [...q.taken.values()].reduce((a, b) => a + b, 0);
  const perte = 1 - rangsApres / rangsAvant;
  verdict(h.state === STATE.PLAYING, 'bourgeon mur, la fille prend la place de la mere',
    `etat ${h.state}`);
  verdict(Math.abs(q.hp - q.stats.maxHp) < 0.51, 'la fille repart a PV pleins',
    `${Math.round(q.hp)} / ${Math.round(q.stats.maxHp)}`);
  verdict(Math.abs(perte - 0.5) <= 0.07, 'la division coute la moitie des rangs acquis',
    `${rangsAvant} -> ${rangsApres} rangs, soit ${(perte * 100).toFixed(0)} %`);
  verdict(q.bourgeon === 0, 'le bourgeon repart de zero apres la division');
  verdict(Math.hypot(q.x - xAvant, q.y - yAvant) > 0.5,
    'la fille nait a cote de la mere', `${Math.hypot(q.x - xAvant, q.y - yAvant).toFixed(1)} px`);

  /* L'evolution dediee reduit la perte, sans jamais l'annuler. */
  const r = joueurNu('cerevisiae');
  const p0 = r.perteDivision;
  r.take('segregation');
  const p1 = r.perteDivision;
  r.take('segregation');
  const p2 = r.perteDivision;
  verdict(p0 > p1 && p1 > p2 && p2 > 0.15,
    'la segregation fidele allege la perte sans la supprimer',
    `${p0} -> ${p1} -> ${p2}`);
}


/* ===========================================================================
   3 bis. La CHIMIE des toxines, verifiee dans le moteur
   =========================================================================== */

console.log('\n--- CHIMIE DES TOXINES ---------------------------------------');

/**
 * Ce que chaque souche DOIT faire a l'impact.
 *
 * Cette table vit ici et pas dans especes.js, et c'est tout l'interet du
 * banc : un verdict qui lit son attente dans la donnee qu'il verifie ne garde
 * rien. Mesure faite en remettant les defauts : sur huit defauts reinjectes,
 * les deux qui SUPPRIMAIENT un champ de TIRS passaient tranquillement, parce
 * que le verdict disparaissait avec lui. Ici, effacer `pore` de la cereulide
 * ou rendre l'ethanol inoffensif fait tomber le banc.
 *
 *   acidifie    la toxine change-t-elle le pH du terrain ?
 *   grasArrete  un globule gras l'arrete-t-il ?
 *   force       part de sa puissance qu'elle garde a bout de portee, une fois
 *               entierement diffusee. 1 = elle ne se dilue pas du tout.
 *   pore        degats par seconde laisses apres l'impact, 0 si aucun
 *   ralentit    part de vitesse otee a la cible, 0 si aucune
 */
const ATTENDU = {
  lactobacillus: { acidifie: true, grasArrete: true, force: 0.50, pore: 0, ralentit: 0 },
  cereus: { acidifie: false, grasArrete: false, force: 1.00, pore: 0, ralentit: 0 },
  aureus: { acidifie: false, grasArrete: true, force: 0.75, pore: 3, ralentit: 0 },
  cerevisiae: { acidifie: false, grasArrete: false, force: 0.65, pore: 0, ralentit: 0.25 },
};

/** Pose un projectile de la souche a un endroit precis et le fait vivre. */
function poser(g, x, y, dt = 1 / 60, ttl = 5, age = 0) {
  const b = makeBullet(x, y, 0, 0, 0, 0, 2.2, 0, 'player', {});
  b.tir = g.player.tir;
  b.hits = new Set();
  b.ttl = ttl; b.life = 5; b.r0 = 2.2; b.age = age;
  g.bullets.push(b);
  g.updateBullets(dt);
  return b;
}

/* --- acidification : seul l'acide lactique change le pH ------------------ */
for (const e of ESPECES) {
  const g = partie(e.id);
  const x = g.player.x + 12, y = g.player.y;
  const avant = g.phField.at(x, y);
  poser(g, x, y, 0.01, 0.001);          // ttl epuise : depot de fin de course
  const delta = avant - g.phField.at(x, y);
  const doit = ATTENDU[e.id].acidifie;
  verdict(doit ? delta > 0.01 : delta === 0,
    `[${e.id}] ${doit ? 'acidifie' : "n'acidifie pas"} le terrain`, `pH -${delta.toFixed(3)}`);
}

/* --- phase grasse : un globule abrite de l'acide, pas des lipophiles ----- */
for (const e of ESPECES) {
  const g = partie(e.id);
  g.decorNear = collectDecor(g.matrix, g.player.x, g.player.y, 240, g.removedDecor, g.time);
  const glob = g.decorNear.find((it) => it.kind === 'globule' && Math.abs(it.z) <= 0.30);
  if (!glob) { verdict(false, 'un globule gras a portee pour la mesure'); break; }
  const b = poser(g, glob.x, glob.y);
  const doit = ATTENDU[e.id].grasArrete;
  verdict(doit ? !b.alive : b.alive,
    `[${e.id}] le globule gras ${doit ? 'arrete' : 'laisse passer'} la toxine`,
    `projectile ${b.alive ? 'intact' : 'creve'}`);
}

/* --- effets a l'impact : pore qui fuit, membrane fluidifiee -------------- */
for (const e of ESPECES) {
  const g = partie(e.id);
  const cible = g.spawnSpecific('ecoli', g.player.x + 30, g.player.y, 0);
  cible.z = 0; g.focus = 0;
  const pvAvant = cible.hp;
  poser(g, cible.x, cible.y);
  const att = ATTENDU[e.id];
  verdict(cible.hp < pvAvant, `[${e.id}] la toxine blesse au contact`,
    `${(pvAvant - cible.hp).toFixed(1)} degats`);
  verdict(att.pore ? (cible.dot >= att.pore && cible.dotTtl > 0) : cible.dotTtl <= 0,
    `[${e.id}] ${att.pore ? 'le pore continue de fuir apres l\'impact' : 'aucun effet retard'}`,
    `${cible.dot.toFixed(1)} dgt/s pendant ${cible.dotTtl.toFixed(1)} s`);
  verdict(att.ralentit ? (cible.slow >= att.ralentit && cible.slowTtl > 0) : cible.slowTtl <= 0,
    `[${e.id}] ${att.ralentit ? 'la toxine ralentit la cible' : 'la toxine ne ralentit pas'}`,
    `-${Math.round(cible.slow * 100)} % pendant ${cible.slowTtl.toFixed(1)} s`);
}

/* --- dilution : ce qui ne se dilue pas garde toute sa puissance ---------- */
{
  const force = (id) => {
    const g = partie(id);
    const cible = g.spawnSpecific('ecoli', g.player.x + 30, g.player.y, 0);
    cible.z = 0; g.focus = 0;
    const pv = cible.hp;
    /* Projectile en BOUT DE COURSE : c'est l'age qui fait la diffusion, pas
       un champ pose a la main — updateBullets le recalcule a chaque image et
       ecrasait la valeur forcee. */
    poser(g, cible.x, cible.y, 1 / 60, 5, 5);
    return (pv - cible.hp) / (g.player.stats.dmg * g.player.facteurAmas);
  };
  for (const e of ESPECES) {
    const f = force(e.id);
    const attendu = ATTENDU[e.id].force;
    verdict(Math.abs(f - attendu) < 0.03,
      `[${e.id}] garde ${Math.round(attendu * 100)} % de sa force a bout de portee`,
      `${(f * 100).toFixed(0)} % mesures`);
  }
}

/* ===========================================================================
   4. La vraie boucle, avec un pilote
   =========================================================================== */

console.log('\n--- PARTIES REELLES ------------------------------------------');
console.log(`  ${RUNS} run(s) de ${DUREE} s par souche, pilote automatique`);

/**
 * Pilote : va chercher les acides amines, s'ecarte quand un mob colle, et
 * prend la carte qui monte le plus ses degats. Ce n'est pas un bon joueur ;
 * c'est le MEME mauvais joueur pour les quatre souches, et c'est ce qui rend
 * la comparaison honnete.
 */
function pilote(g) {
  const p = g.player;
  const mv = { x: 0, y: 0 };
  let tx = null, ty = null, bd = 1e9;
  for (const k of g.pickups) {
    if (!k.alive) continue;
    const d = Math.hypot(k.x - p.x, k.y - p.y);
    if (d < bd) { bd = d; tx = k.x; ty = k.y; }
  }
  let fx = 0, fy = 0;
  for (const e of g.enemies) {
    if (!e.alive || e.ally > 0 || e.spec.neutral) continue;
    const dx = p.x - e.x, dy = p.y - e.y;
    const d = Math.hypot(dx, dy);
    if (d < 34 && d > 0.01) { fx += dx / d; fy += dy / d; }
  }
  if (fx || fy) { mv.x = fx; mv.y = fy; }
  else if (tx !== null) { mv.x = tx - p.x; mv.y = ty - p.y; }
  const n = Math.hypot(mv.x, mv.y) || 1;
  mv.x /= n; mv.y /= n;
  return mv;
}

const bilans = [];
for (const e of ESPECES) {
  const acc = { temps: 0, niveau: 0, tues: 0, morts: 0, traits: 0 };
  for (let r = 0; r < RUNS; r++) {
    const g = partie(e.id, 20260923 + r * 7919);
    const input = { move: { x: 0, y: 0 }, focusAxis: 0, takeFocusImpulse: () => 0,
      takeDash: () => false, takePause: () => false };
    let t = 0;
    while (t < DUREE && g.state !== STATE.DEAD) {
      if (g.state === STATE.LEVELUP) {
        /* Choix simple et identique pour tous : la premiere carte proposee. */
        g.chooseEvolution(g.hand[0].id);
        continue;
      }
      input.move = pilote(g);
      g.update(DT, input);
      t += DT;
    }
    acc.temps += t;
    acc.niveau += g.player.level;
    acc.tues += g.player.kills;
    if (g.state === STATE.DEAD) acc.morts++;
    acc.traits += g.player.sporesBrulees + g.player.divisions;
  }
  const b = {
    id: e.id, temps: acc.temps / RUNS, niveau: acc.niveau / RUNS,
    tues: acc.tues / RUNS, morts: acc.morts, traits: acc.traits,
  };
  bilans.push(b);
  console.log(`  ${b.id.padEnd(14)} survie ${b.temps.toFixed(0).padStart(3)} s`
    + `   niveau ${b.niveau.toFixed(1).padStart(4)}   tues ${b.tues.toFixed(0).padStart(3)}`
    + `   morts ${b.morts}/${RUNS}   traits declenches ${b.traits}`);
}

/* Aucune souche ne doit etre injouable. Le pilote est mediocre : il ne s'agit
   pas d'exiger la survie, mais qu'aucune souche ne s'effondre la ou les
   autres tiennent. */
const survieMax = Math.max(...bilans.map((b) => b.temps));
for (const b of bilans) {
  verdict(b.temps > survieMax * 0.45,
    `[${b.id}] tient la comparaison avec la meilleure souche`,
    `${b.temps.toFixed(0)} s contre ${survieMax.toFixed(0)} s`);
  verdict(b.niveau >= 4, `[${b.id}] monte en niveau`, `niveau ${b.niveau.toFixed(1)}`);
}

console.log('');
if (echecs.length) {
  console.error(`${echecs.length} verdict(s) tombe(s) :`);
  for (const p of echecs) console.error('  - ' + p);
  process.exit(1);
}
console.log('Les quatre souches tiennent : stats dans la bande, traits declenches, tirages cloisonnes.');
