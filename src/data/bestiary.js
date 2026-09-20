/* ---------------------------------------------------------------------------
   Bestiaire. Source de verite : docs/02-bestiaire.md.

   Regle : un mob ne recoit que des capacites documentees chez l'espece reelle.
   Le champ `note` doit toujours pouvoir etre rempli ; sinon la capacite sort.

   kind : morphologie de rendu      mot : motilite
   role : archetype de directeur    cost : credits de menace
   gram : '+', '-' ou 'fungi' (cible de la nisine et de la lipase)
   zSpeed : vitesse de derive vers le plan du joueur (0 = reste hors plan)
--------------------------------------------------------------------------- */

export const ROLE_COST = {
  chaff: 1.0, runner: 1.4, tank: 3.2, ranged: 2.6,
  splitter: 2.4, denier: 3.0, predator: 4.5,
};

const M = (o) => ({
  kind: 'rod', mot: 'brown', gram: '-', zSpeed: 0.24, radius: 3,
  contact: 5, aa: 1, resist: 0, ...o,
  cost: o.cost ?? ROLE_COST[o.role] ?? 1,
});

/* -------------------------------------------------------- MATRICE 1 ----- */

export const MILK_MOBS = [
  M({
    id: 'lactococcus', label: 'L. LACTIS SAUVAGE', role: 'chaff',
    kind: 'diplo', mot: 'brown', gram: '+',
    hp: 14, speed: 26, contact: 4, radius: 2.2, aa: 3,
    note: "Cocci ovoides par deux, immobiles : pas de flagelle, d'ou la derive brownienne pure.",
  }),
  M({
    id: 'leuconostoc', label: 'L. MESENTEROIDES', role: 'chaff',
    kind: 'chain', mot: 'brown', gram: '+', segments: 4,
    hp: 18, speed: 22, contact: 4, radius: 2.6, aa: 3,
    ability: 'dextrane',
    note: "Produit reellement du dextrane (dextransucrase) : les sirops filants des sucreries.",
  }),
  M({
    id: 'ecoli', label: 'E. COLI', role: 'chaff',
    kind: 'rod', mot: 'swim', gram: '-',
    hp: 20, speed: 58, contact: 6, radius: 3, aa: 3,
    phSlow: 5.6,
    note: "Flagelles peritriches, nage en run and tumble. Coliforme : ralentit nettement sous pH 5,6.",
  }),
  M({
    id: 'pseudomonas', label: 'P. FRAGI', role: 'runner',
    kind: 'rod', mot: 'swim', gram: '-',
    hp: 16, speed: 92, contact: 9, radius: 2.6, aa: 4,
    ability: 'lipase', phBurn: 5.2, phBurnDps: 3,
    note: "Psychrotrophe majeur du lait cru, lipolytique et proteolytique. Flagelle polaire unique : nage rapide et rectiligne.",
  }),
  M({
    id: 'kluyveromyces', label: 'K. MARXIANUS', role: 'splitter',
    kind: 'bud', mot: 'brown', gram: 'fungi',
    hp: 85, speed: 18, contact: 12, radius: 5.5, aa: 9, zSpeed: 0.16,
    ability: 'bourgeonnement',
    note: "Levure capable de fermenter le lactose, d'ou sa presence dans le lait. Bourgeonnement multilateral.",
  }),
  M({
    id: 'geotrichum', label: 'G. CANDIDUM', role: 'denier',
    kind: 'arthro', mot: 'none', gram: 'fungi',
    hp: 120, speed: 0, contact: 8, radius: 7, aa: 10, zSpeed: 0.5,
    ability: 'hyphes',
    note: "Moisissure de surface des fromages ; thalle d'arthrospores en chainettes.",
  }),
  M({
    id: 'bacillus', label: 'B. CEREUS', role: 'tank',
    kind: 'rodlong', mot: 'swim', gram: '+',
    hp: 110, speed: 30, contact: 14, radius: 4.5, aa: 10,
    ability: 'sporulation',
    note: "Endospore refringente, resistante a la chaleur et aux acides. Arrive au lait par le sol et la traite.",
  }),
  M({
    id: 'spore', label: 'ENDOSPORE', role: 'chaff', cost: 0.6,
    kind: 'spore', mot: 'none', gram: '+',
    hp: 46, speed: 0, contact: 11, radius: 2.9, aa: 5, zSpeed: 0.4,
    resist: 0.55, ability: 'germination',
    note: "Immobile mais bien la : elle occupe l'espace, blesse au contact et encaisse. Invulnerable aux degats de zone, il faut un tir direct. Si on la laisse, elle germe et rend un Bacillus.",
  }),
  M({
    id: 'phage', label: 'PHAGE 936', role: 'ranged',
    kind: 'phage', mot: 'drift', gram: null,
    hp: 10, speed: 14, contact: 3, radius: 2.5, aa: 4,
    zSpeed: 0, zHold: 0.5, ability: 'injection',
    note: "Les phages lactococciques sont le fleau industriel de la fermentation laitiere. Non mobiles : ils diffusent.",
  }),
];

/* Faune neutre : elle ne vous veut rien. Elle est la pour que le champ ait
   une vie et une profondeur, et parce qu'elle est reellement la. */
export const MILK_NEUTRALS = [
  M({
    id: 'somatic', label: 'CELLULE SOMATIQUE', role: 'neutral', cost: 0,
    kind: 'amoeba', mot: 'brown', gram: null, neutral: true,
    hp: 160, speed: 7, contact: 0, radius: 9, aa: 4, zSpeed: 0, zWander: true,
    note: "Leucocytes de la vache, presents dans tout lait cru : leur numeration cellulaire est un critere reglementaire de qualite du lait. Ils ne s'en prennent pas a une bacterie lactique.",
  }),
];

export const MILK_BOSSES = {
  staph: M({
    id: 'staph', label: 'S. AUREUS', role: 'boss', cost: 0,
    kind: 'cluster', mot: 'brown', gram: '+', segments: 7,
    hp: 900, speed: 24, contact: 18, radius: 13, aa: 90, zSpeed: 0.3,
    boss: true, dropsPlasmid: true,
    phases: [
      { at: 1.00, ability: 'coagulase', label: 'COAGULASE' },
      { at: 0.60, ability: 'dispersion', label: 'DISPERSION' },
      { at: 0.25, ability: 'hemolysine', label: 'ALPHA-HEMOLYSINE' },
    ],
    note: "Staphylocoagulase activant la prothrombine : le test d'identification de l'espece. Grappe par division multiplan. Toxine alpha formant des pores.",
  }),
  listeria: M({
    id: 'listeria', label: 'L. MONOCYTOGENES', role: 'boss', cost: 0,
    kind: 'rod', mot: 'tumble', gram: '+',
    hp: 2400, speed: 70, contact: 20, radius: 16, aa: 240, zSpeed: 0.4,
    boss: true, dropsPlasmid: true,
    phases: [
      { at: 1.00, ability: 'tumble', label: 'CULBUTE' },
      { at: 0.65, ability: 'comete', label: 'COMETE D ACTINE' },
      { at: 0.30, ability: 'llo', label: 'LISTERIOLYSINE O' },
    ],
    note: "Mobile a 20-25 C par flagelles peritriches (culbute en roue), immobile a 37 C. Comete d'actine via ActA. LLO : sortie du phagosome.",
  }),
};

export const BESTIARY = Object.fromEntries(
  [...MILK_MOBS, ...MILK_NEUTRALS, ...Object.values(MILK_BOSSES)].map((m) => [m.id, m]),
);

/* Les matrices 2 a 4 sont specifiees dans docs/02-bestiaire.md mais ne sont
   pas encore implementees : la maquette ne fait tourner que le lait cru. */
export const IMPLEMENTED_MATRICES = ['milk'];
