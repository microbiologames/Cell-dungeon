/* ---------------------------------------------------------------------------
   Catalogue des evolutions. Source de verite : docs/03-evolutions.md.

   mods   : modificateurs de stats cumules par rang.
            suffixe Mul -> additionne puis applique en (1 + somme)
            suffixe Add -> ajout plat
   flag   : capacite comportementale, lue par le jeu (le rang module l'effet)
   way    : voie implicite, sert aux synergies et a l'affichage
   espece : RESERVE a une souche jouable. Sans ce champ, la carte est
            universelle et toutes les souches peuvent la tirer — c'est le
            cas de l'immense majorite. Une carte reservee n'ameliore qu'une
            CARACTERISTIQUE UNIQUE (la spore, l'amas, le bourgeon) : elle n'a
            litteralement rien a faire chez les autres, ou elle serait une
            carte morte dans la main.
--------------------------------------------------------------------------- */

export const RARITY = {
  commune:     { weight: 100, label: 'COMMUNE' },
  peucommune:  { weight: 42,  label: 'PEU COMMUNE' },
  rare:        { weight: 14,  label: 'RARE' },
  epique:      { weight: 4,   label: 'EPIQUE' },
  legendaire:  { weight: 1,   label: 'LEGENDAIRE' },
};

export const WAYS = {
  acidophile:   'Acidophile',
  diffuseur:    'Diffuseur',
  cuirasse:     'Cuirasse',
  flagelle:     'Flagelle',
  necromancien: 'Necromancien',
  predateur:    'Predateur',
  optique:      'Optique',
  neutre:       'Neutre',
};

/** @type {Array<{id:string,label:string,rarity:string,ranks:number,way:string,desc:string,mods?:object,flag?:string,note?:string}>} */
export const EVOLUTIONS = [
  /* ---------------------------------------------------------- COMMUNES -- */
  { id: 'ldh', label: 'Lactate deshydrogenase', rarity: 'commune', ranks: 5, way: 'acidophile',
    desc: '+12 % de degats.', mods: { dmgMul: 0.12 },
    note: "Enzyme terminale de la fermentation lactique." },
  { id: 'atpase', label: 'Pompe a protons F1F0', rarity: 'commune', ranks: 5, way: 'flagelle',
    desc: '+8 % de vitesse.', mods: { speedMul: 0.08 },
    note: "ATPase membranaire, force proton-motrice." },
  { id: 'ribo', label: 'Ribosomes surnumeraires', rarity: 'commune', ranks: 5, way: 'acidophile',
    desc: '+10 % de cadence.', mods: { fireRateMul: 0.10 },
    note: "Plus de ribosomes, plus de debit proteique." },
  { id: 'flagelle', label: 'Flagelle supplementaire', rarity: 'commune', ranks: 6, way: 'flagelle',
    desc: '+9 % de vitesse, +4 % de hitbox.', mods: { speedMul: 0.09, hitboxMul: 0.04 },
    note: "Chaque flagelle ajoute de la poussee et de l'encombrement." },
  { id: 'peptido', label: 'Reticulation du peptidoglycane', rarity: 'commune', ranks: 6, way: 'cuirasse',
    desc: '+14 PV, -3 % de vitesse.', mods: { maxHpAdd: 14, speedMul: -0.03 }, flag: 'peptido',
    note: "Pontages peptidiques : paroi plus epaisse, plus lourde. Cible des beta-lactames." },
  { id: 'peritriche', label: 'Flagellation peritriche', rarity: 'commune', ranks: 3, way: 'flagelle',
    desc: "+22 % d'agilite, -5 % de vitesse de pointe.",
    mods: { accelMul: 0.22, speedMul: -0.05 },
    note: "Flagelles repartis sur toute la surface, comme E. coli : tourne vite, pousse moins fort." },
  { id: 'polaire', label: 'Flagellation polaire en touffe', rarity: 'commune', ranks: 3, way: 'flagelle',
    desc: '+14 % de vitesse de pointe, -18 % d\'agilite.',
    mods: { speedMul: 0.14, accelMul: -0.18 },
    note: "Touffe lophotriche a un seul pole, comme Pseudomonas : nage droite et rapide, virages laborieux." },
  { id: 'fluidite', label: 'Fluidite membranaire', rarity: 'commune', ranks: 5, way: 'acidophile',
    desc: '+9 % de cadence, -6 % de resistance.', mods: { fireRateMul: 0.09, resistAdd: -0.06 },
    note: "Insaturation des acides gras : membrane fluide mais fragile." },
  { id: 'opp', label: 'Systeme Opp', rarity: 'commune', ranks: 4, way: 'neutre',
    desc: "+15 % d'acides amines ramasses, +12 % de rayon de captation.",
    mods: { aaGainMul: 0.15, pickupMul: 0.12 },
    note: "Permease a oligopeptides : c'est par la que les bacteries lactiques, auxotrophes pour la plupart des acides amines, se nourrissent." },
  { id: 'che', label: 'Chimiotactisme (Che)', rarity: 'commune', ranks: 4, way: 'neutre',
    desc: '+25 % de rayon de captation.', mods: { pickupMul: 0.25 },
    note: "Systeme Che, migration le long d'un gradient." },
  { id: 'betaine', label: 'Osmoregulation (betaine)', rarity: 'commune', ranks: 4, way: 'cuirasse',
    desc: '+10 PV.', mods: { maxHpAdd: 10 },
    note: "Solute compatible accumule en stress osmotique." },
  { id: 'sec', label: 'Secretion Sec', rarity: 'commune', ranks: 4, way: 'neutre',
    desc: '+10 % de vitesse de projectile, +8 % de portee.',
    mods: { bulletSpeedMul: 0.10, rangeMul: 0.08 },
    note: "Translocon SecYEG : une goutte mieux ejectee part plus vite et donc plus loin." },
  { id: 'diffusion', label: 'Diffusion acide', rarity: 'commune', ranks: 4, way: 'diffuseur',
    desc: '+10 % de rayon des tirs, +12 % de portee.',
    mods: { bulletRadiusMul: 0.10, rangeMul: 0.12 },
    note: "L'acide porte plus loin avant d'etre dilue." },
  { id: 'glycolyse', label: 'Flux glycolytique', rarity: 'commune', ranks: 4, way: 'acidophile',
    desc: '+14 % de portee.', mods: { rangeMul: 0.14 },
    note: "Le debit de la glycolyse fixe la quantite de lactate produite par tir : plus on en produit, plus loin il reste assez concentre pour mordre." },
  { id: 'acidloc', label: 'Acidification locale', rarity: 'commune', ranks: 3, way: 'diffuseur',
    desc: 'Aura de pH bas : 2 degats/s dans 22 px.', mods: { auraDpsAdd: 2, auraRadiusAdd: 22 },
    note: "L'acide s'accumule autour de la cellule." },
  { id: 'reca', label: 'Reponse SOS (RecA)', rarity: 'commune', ranks: 4, way: 'cuirasse',
    desc: '+0,4 PV/s.', mods: { regenAdd: 0.4 },
    note: "Reparation de l'ADN induite par le stress." },
  { id: 'cardio', label: 'Cardiolipine', rarity: 'commune', ranks: 4, way: 'cuirasse',
    desc: '+6 % de resistance.', mods: { resistAdd: 0.06 },
    note: "Phospholipide des poles, stabilise la membrane." },
  { id: 'homo', label: 'Homofermentaire strict', rarity: 'commune', ranks: 3, way: 'acidophile',
    desc: '+15 % de degats, -8 % de rayon.', mods: { dmgMul: 0.15, bulletRadiusMul: -0.08 },
    note: "Voie d'Embden-Meyerhof : lactate seul, rendement maximal." },

  /* ------------------------------------------------------ PEU COMMUNES -- */
  { id: 'nisine', label: 'Bacteriocine (nisine)', rarity: 'peucommune', ranks: 2, way: 'acidophile',
    desc: 'Les tirs ignorent 35 % de la resistance des Gram +.', flag: 'nisine',
    mods: { gramPierceAdd: 0.35 },
    note: "La nisine de L. lactis forme des pores via le lipide II." },
  { id: 'hetero', label: 'Heterofermentation', rarity: 'peucommune', ranks: 3, way: 'diffuseur',
    desc: '+1 projectile en eventail, -20 % de degats par projectile.',
    mods: { projectilesAdd: 1, dmgMul: -0.20, spreadAdd: 0.17 },
    note: "Voie des pentoses phosphates : lactate, CO2 et ethanol." },
  { id: 'gelatinase', label: 'Gelatinase (GelE)', rarity: 'peucommune', ranks: 1, way: 'neutre',
    desc: 'Immunite a la coagulation, +5 % de vitesse.', flag: 'gelatinase',
    mods: { speedMul: 0.05 },
    note: "Gelatinase d'Enterococcus faecalis, hydrolyse la gelatine." },
  { id: 'coagulase', label: 'Coagulase', rarity: 'peucommune', ranks: 3, way: 'diffuseur',
    desc: 'Les impacts deposent un gel : -45 % de vitesse, 3 s.', flag: 'coagulase',
    note: "Volee a S. aureus par transfert horizontal de genes." },
  { id: 'catalase', label: 'Catalase / SOD', rarity: 'peucommune', ranks: 2, way: 'cuirasse',
    desc: "-40 % de degats des especes reactives de l'oxygene.", flag: 'catalase',
    mods: { rosResistAdd: 0.40 },
    note: "Detoxification de H2O2 et O2-." },
  { id: 'capsule', label: 'Capsule polysaccharidique', rarity: 'peucommune', ranks: 3, way: 'cuirasse',
    desc: "-35 % de chance d'etre phagocyte, -5 % de vitesse.", flag: 'capsule',
    mods: { phagoResistAdd: 0.35, speedMul: -0.05 },
    note: "Capsule antiphagocytaire." },
  { id: 'protease', label: 'Protease (PrtP)', rarity: 'peucommune', ranks: 3, way: 'acidophile',
    desc: 'Les tirs appliquent une corrosion pendant 4 s.', flag: 'protease',
    note: "Proteinase de paroi des lactocoques." },
  { id: 'lipase', label: 'Lipase / esterase', rarity: 'peucommune', ranks: 3, way: 'predateur',
    desc: '+25 % de degats contre levures et moisissures.', mods: { fungiDmgAdd: 0.25 },
    note: "Hydrolyse des lipides membranaires." },
  { id: 'pili', label: 'Pili de type IV', rarity: 'peucommune', ranks: 1, way: 'flagelle',
    desc: 'Debloque le dash (6 s de recharge).', flag: 'dash',
    note: "Twitching motility par retraction du pilus." },
  { id: 'atr', label: "Reponse de tolerance a l'acide", rarity: 'peucommune', ranks: 3, way: 'cuirasse',
    desc: "-50 % de degats d'acide du milieu.", flag: 'atr',
    mods: { acidResistAdd: 0.50 },
    note: "ATR : adaptation reelle des lactiques au pH bas." },
  { id: 'cody', label: 'Dereglement de CodY', rarity: 'peucommune', ranks: 2, way: 'neutre',
    desc: 'Les acides amines comptent double sous 40 % de PV.', flag: 'transformation',
    note: "CodY est le regulateur global des Firmicutes : il detecte la carence en acides amines ramifies et leve la repression des transporteurs de peptides. Affame, on absorbe mieux." },
  { id: 'eps', label: 'Exopolysaccharide (EPS)', rarity: 'peucommune', ranks: 3, way: 'flagelle',
    desc: 'Laisse une trainee visqueuse qui ralentit les poursuivants.', flag: 'eps',
    note: "EPS des lactiques, texturants du yaourt." },
  { id: 'autolysine', label: 'Autolysine regulee', rarity: 'peucommune', ranks: 3, way: 'acidophile',
    desc: '+10 % de degats, -10 % de PV max.', mods: { dmgMul: 0.10, maxHpMul: -0.10 },
    note: "Hydrolases de paroi : remodelage au prix de la solidite." },
  { id: 'dof', label: 'Profondeur de champ', rarity: 'peucommune', ranks: 3, way: 'optique',
    desc: '-30 % de penalite de nettete, +20 % de zone nette.',
    mods: { dofAdd: 0.09, focusPenaltyMul: -0.30 },
    note: "Ouverture du diaphragme." },
  { id: 'transposon', label: 'Transposon (element IS)', rarity: 'peucommune', ranks: 1, way: 'neutre',
    desc: 'Relance la main une fois par niveau.', flag: 'transposon',
    note: "Elements d'insertion, rearrangement genomique." },

  /* ------------------------------------------------------------- RARES -- */
  { id: 'predation', label: 'Predation periplasmique', rarity: 'rare', ranks: 2, way: 'predateur',
    desc: 'Au contact, absorbe les mobs plus petits : soin et acides amines.', flag: 'predation',
    note: "Bdellovibrio bacteriovorus penetre le periplasme de sa proie." },
  { id: 'endolysine', label: 'Endolysine (LLO)', rarity: 'rare', ranks: 1, way: 'predateur',
    desc: "Si phagocyte, lyse l'hote de l'interieur en 1,5 s.", flag: 'endolysine',
    note: "Listeriolysine O : Listeria s'echappe du phagosome." },
  { id: 'phagetemp', label: 'Phage tempere', rarity: 'rare', ranks: 3, way: 'necromancien',
    desc: 'Convertit un mob en allie 8 s (recharge 14 s).', flag: 'temperate',
    note: "Lysogenie, conversion phagique." },
  { id: 'vbnc', label: 'Dormance (etat VBNC)', rarity: 'rare', ranks: 1, way: 'cuirasse',
    desc: 'Ressuscite une fois a 40 % PV, 6 s de reprise invulnerable.', flag: 'vbnc',
    note: "Etat viable non cultivable : la cellule se met en dormance, metabolisme ralenti, et repart plus tard. Documente chez les lactiques, qui ne savent PAS sporuler : la spore appartient aux Bacillus, donc aux mobs." },
  { id: 'betalactamase', label: 'Beta-lactamase', rarity: 'rare', ranks: 1, way: 'cuirasse',
    desc: 'Immunite aux antibiotiques beta-lactames.', flag: 'betalactamase',
    note: "Hydrolyse du cycle beta-lactame : la resistance historique." },
  { id: 'efflux', label: 'Efflux multidrogue', rarity: 'rare', ranks: 2, way: 'cuirasse',
    desc: '-30 % de tous les degats de zone du milieu.', flag: 'efflux',
    mods: { envResistAdd: 0.30 },
    note: "Pompe AcrAB-TolC." },
  { id: 'quorum', label: 'Quorum sensing (AI-2)', rarity: 'rare', ranks: 2, way: 'diffuseur',
    desc: '+6 % de degats par mob net dans le champ (max +60 %).', flag: 'quorum',
    note: "Autoinducteur-2 : decision collective selon la densite." },
  { id: 'biofilm', label: 'Biofilm inductible', rarity: 'rare', ranks: 2, way: 'cuirasse',
    desc: '1,5 s immobile donne un bouclier absorbant.', flag: 'biofilm',
    note: "Passage planctonique vers sessile sous stress." },
  { id: 'phase', label: 'Contraste de phase', rarity: 'rare', ranks: 1, way: 'optique',
    desc: 'Les mobs flous laissent un halo traceur toujours visible.', flag: 'phase',
    note: "Anneau de phase de Zernike." },
  { id: 'sidero', label: 'Siderophores', rarity: 'rare', ranks: 2, way: 'acidophile',
    desc: 'Chaque kill : +2 % de cadence 8 s, 10 piles max.', flag: 'sidero',
    note: "Chelateurs de fer, captation en milieu carence." },

  { id: 'holine', label: 'Lyse programmee (holine)', rarity: 'peucommune', ranks: 3, way: 'necromancien',
    desc: 'Chaque mob tue a 18 % de chance par rang de liberer un projectile.',
    flag: 'holine',
    note: "Les holines percent la membrane et declenchent la lyse : le contenu cytoplasmique part avec." },
  { id: 'mcp', label: 'Recepteurs MCP surnumeraires', rarity: 'peucommune', ranks: 2, way: 'neutre',
    desc: '+50 % de rayon de captation et attraction plus vive.',
    mods: { pickupMul: 0.50, pullMul: 0.6 }, flag: 'mcp',
    note: "Proteines chimiotactiques acceptrices de methyle : les chimiorecepteurs eux-memes. Plus on en a, plus loin on sent le gradient." },

  /* ------------------------------------------------------------- RARES -- */
  { id: 'vesicules', label: 'Vesicules membranaires', rarity: 'rare', ranks: 3, way: 'diffuseur',
    desc: '+2 projectiles par rang, tires en gerbe. -18 % de degats par projectile.',
    mods: { projectilesAdd: 2, dmgMul: -0.18, spreadAdd: 0.15 },
    note: "Les bacteries a Gram positif liberent des vesicules membranaires a travers leur paroi : une salve, pas un jet." },
  { id: 'phsense', label: 'Senseur de pH', rarity: 'rare', ranks: 1, way: 'neutre',
    desc: 'Revele la carte des pH du milieu en fausses couleurs.', flag: 'phsense',
    note: "Systemes a deux composants sensibles aux protons : la cellule sait ou le milieu est acide, et vous le montre." },

  /* ----------------------------------------------------------- EPIQUES -- */
  { id: 'lytique', label: 'Phage lytique', rarity: 'epique', ranks: 2, way: 'necromancien',
    desc: 'Les mobs tues explosent en 6 capsides infectieuses.', flag: 'lytique',
    note: "Cycle lytique : la cellule eclate et libere les virions." },
  { id: 't3ss', label: 'Injectisome (T3SS)', rarity: 'epique', ranks: 2, way: 'acidophile',
    desc: 'Tir perforant qui traverse la profondeur, ignore la nettete.', flag: 't3ss',
    mods: { pierceAdd: 2 },
    note: "Seringue moleculaire du systeme de secretion de type III." },
  { id: 'hypermut', label: 'Hypermutateur', rarity: 'epique', ranks: 1, way: 'neutre',
    desc: '+1 carte et x1,35 sur les hautes raretes. Une stat varie de 10 % toutes les 45 s.',
    flag: 'hypermutateur',
    note: "Souches deficientes en reparation des mesappariements (mutS)." },
  { id: 'sapi', label: 'Ilot de pathogenicite (SaPI)', rarity: 'epique', ranks: 1, way: 'predateur',
    desc: "Vole 2 capacites au hasard a un mob vaincu.", flag: 'sapi',
    note: "Ilots de pathogenicite mobiles de S. aureus." },
  { id: 'nanotubes', label: 'Nanotubes intercellulaires', rarity: 'epique', ranks: 2, way: 'acidophile',
    desc: 'Draine 1,5 PV/s a tout mob net a moins de 90 px.', flag: 'nanotubes',
    note: "Nanotubes d'echange cytoplasmique entre bacteries." },

  /* -------------------------------------------------------- LEGENDAIRES -- */
  { id: 'conjugaison', label: 'Conjugaison massive', rarity: 'legendaire', ranks: 1, way: 'necromancien',
    desc: 'Toutes les 30 s, un mob devient allie definitivement.', flag: 'conjugaison',
    note: "Conjugaison bacterienne, transfert du plasmide F." },
  { id: 'crispr', label: 'CRISPR-Cas', rarity: 'legendaire', ranks: 1, way: 'cuirasse',
    desc: 'Immunite aux phages. Chaque phage detruit donne +1 % de degats definitif.',
    flag: 'crispr',
    note: "Immunite adaptative procaryote par memoire de spacers." },
  { id: 'symbiose', label: 'Symbiose (consortium)', rarity: 'legendaire', ranks: 1, way: 'necromancien',
    desc: 'Deux L. lactis satellites tirent a 50 %.', flag: 'symbiose',
    note: "Consortiums lactiques des ferments mixtes." },
  { id: 'immersion', label: 'Objectif a immersion', rarity: 'legendaire', ranks: 1, way: 'optique',
    desc: 'Tout le champ est net, mais le champ retrecit de 25 %.', flag: 'immersion',
    mods: { dofAdd: 3.0 },
    note: "Immersion a huile : resolution maximale, champ minimal." },

  /* ------------------------------------------- RESERVEES AUX SOUCHES -- */
  /* Elles n'ameliorent pas des stats : elles ameliorent la caracteristique
     unique d'une souche, qui, elle, est acquise des la premiere seconde.
     Voir src/data/especes.js. */

  { id: 'sporeplus', label: 'Sporulation multiple', rarity: 'peucommune', ranks: 3,
    way: 'cuirasse', espece: 'cereus',
    desc: '+1 spore de reserve par rang.',
    note: "Une cellule de Bacillus ne forme qu'UNE endospore, et une seule : le sporange se lyse en la liberant. Au-dela de la premiere, c'est le privilege du joueur, pas de la microbiologie." },
  { id: 'germination', label: 'Germination rapide', rarity: 'peucommune', ranks: 2,
    way: 'cuirasse', espece: 'cereus',
    desc: 'Sortie de spore plus rapide, et davantage de PV rendus.',
    note: "La germination d'une endospore demande la rehydratation du coeur et la degradation des couches de peptidoglycane : c'est cette etape qui prend du temps, pas le reveil du metabolisme." },

  { id: 'multiplan', label: 'Division multiplan', rarity: 'commune', ranks: 5,
    way: 'cuirasse', espece: 'aureus',
    desc: "+1 cellule dans l'amas et +16 PV par rang.",
    mods: { maxHpAdd: 16 },
    note: "S. aureus se divise selon des plans successifs perpendiculaires sans separer ses cellules filles : c'est ce qui donne la grappe, et c'est le caractere qui l'identifie au frottis." },
  { id: 'agr', label: 'Quorum accessoire (agr)', rarity: 'peucommune', ranks: 2,
    way: 'diffuseur', espece: 'aureus',
    desc: "+8 % de degats par cellule vivante de l'amas et par rang.",
    note: "Le locus agr detecte la densite cellulaire par un peptide auto-inducteur et bascule la cellule des adhesines de surface vers les toxines secretees. Plus l'amas est dense, plus il empoisonne." },

  { id: 'segregation', label: 'Segregation fidele', rarity: 'rare', ranks: 2,
    way: 'neutre', espece: 'cerevisiae',
    desc: 'La division ne coute plus que 34 % des evolutions, puis 22 %.',
    note: "Cohesines et point de controle du fuseau : ce sont eux qui garantissent que la cellule fille recoit un jeu complet de chromosomes. Les relacher, c'est l'aneuploidie." },
  { id: 'precoce', label: 'Bourgeonnement precoce', rarity: 'peucommune', ranks: 3,
    way: 'neutre', espece: 'cerevisiae',
    desc: 'Le bourgeon murit 25 % plus vite par rang.',
    note: "Le passage de START, en fin de G1, engage la cellule dans le cycle. Les cyclines G1 en sont l'accelerateur." },
];

/**
 * Les trois evolutions qui font POUSSER un flagelle.
 *
 * Ce sont exactement celles que lit `player.flagellation` — les seules dont
 * l'effet se voit a l'ecran. La voie `flagelle` en contient d'autres
 * (pompe a protons, pili, EPS) qui ne dessinent rien et restent ouvertes a
 * tout le monde : la liste est donc nommee par ce qu'elle DESSINE, pas par
 * la voie a laquelle elle appartient.
 *
 * Elle existe parce que deux souches n'ont pas de flagelle et ne doivent pas
 * pouvoir en gagner un — voir `aflagelle` dans `especes.js`.
 */
export const EVO_FLAGELLE = new Set(['flagelle', 'peritriche', 'polaire']);

export const EVO_BY_ID = Object.fromEntries(EVOLUTIONS.map((e) => [e.id, e]));

/** Poids effectif d'une carte, module par l'hypermutateur. */
export function rarityWeight(rarity, hypermutateur = false) {
  const base = RARITY[rarity].weight;
  if (!hypermutateur) return base;
  const boosted = rarity === 'rare' || rarity === 'epique' || rarity === 'legendaire';
  return boosted ? base * 1.35 : base;
}
