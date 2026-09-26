/* ---------------------------------------------------------------------------
   Bestiaire. Source de verite : docs/02-bestiaire.md.

   Regle : un mob ne recoit que des capacites documentees chez l'espece reelle.
   Le champ `note` doit toujours pouvoir etre rempli ; sinon la capacite sort.

   kind : morphologie de rendu      mot : motilite
   role : archetype de directeur    cost : credits de menace
   gram : '+', '-' ou 'fungi' (cible de la nisine et de la lipase)
   zSpeed : vitesse de derive vers le plan du joueur (0 = reste hors plan)
   elance : rapport longueur/largeur du bacille (1 = trapu)

   flagella : {mode, count} — DOCUMENTE OU RIEN.
     La flagellation est un caractere taxonomique, pas une decoration : on
     la donne a une espece quand elle est decrite chez elle, et on ne la
     donne pas quand l'espece est immobile. Un Lactococcus n'a pas de
     flagelle, et c'est justement pour ca qu'il derive en brownien pur.
       'polaire'     monotriche ou lophotriche, a un seul pole
       'peritriche'  reparti sur tout le pourtour

   swarm : avancement du run a partir duquel l'espece porte ses flagelles.
     En deca, elle apparait en cellule VEGETATIVE : pas de flagelle, et la
     vitesse tombee a 55 %. Ce n'est pas un reglage de difficulte deguise,
     c'est la differenciation en cellules nageuses, qui est documentee et
     dependante de la phase de croissance chez les deux especes qui portent
     le champ. Le champ n'existe que pour elles ; une espece dont la
     flagellation est constitutive ne le recoit pas.
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
    hp: 20, speed: 64, contact: 6, radius: 3, aa: 3,
    phSlow: 5.6, elance: 1.05, flagella: { mode: 'peritriche', count: 6 },
    /* Le coliforme est le mob rapide du debut : c'est donc LUI qui decidait
       si on pouvait s'echapper en ligne droite des la premiere minute. En
       cellule vegetative il derive a 35 px/s et on le seme ; differencie, il
       monte a 64 et il faut le tuer. */
    swarm: 0.22,
    note: "Flagelles peritriches, nage en run and tumble. La synthese de flagelline est reprimee en phase exponentielle precoce : les cellules jeunes sont peu ou pas flagellees. Coliforme : ralentit nettement sous pH 5,6.",
  }),
  M({
    id: 'pseudomonas', label: 'P. FRAGI', role: 'runner',
    kind: 'rod', mot: 'swim', gram: '-',
    hp: 16, speed: 104, contact: 9, radius: 2.6, aa: 4,
    ability: 'lipase', phBurn: 5.2, phBurnDps: 3,
    elance: 0.95, flagella: { mode: 'polaire', count: 1 },
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
    hp: 110, speed: 42, contact: 14, radius: 4.5, aa: 10,
    ability: 'sporulation', flagella: { mode: 'peritriche', count: 7 },
    swarm: 0.5,
    note: "Endospore refringente, resistante a la chaleur et aux acides. Arrive au lait par le sol et la traite. Le swarming est une differenciation documentee chez B. cereus : les cellules swarmer s'allongent et s'hyperflagellent, les vegetatives sont peu mobiles.",
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
    kind: 'leuco', mot: 'brown', gram: null, neutral: true,
    hp: 160, speed: 7, contact: 0, radius: 9, aa: 4, zSpeed: 0, zWander: true,
    note: "Leucocytes de la vache, presents dans tout lait cru : leur numeration cellulaire est un critere reglementaire de qualite du lait. Majoritairement des polynucleaires, d'ou le noyau polylobe. Ils ne s'en prennent pas a une bacterie lactique.",
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
    boss: true, dropsPlasmid: true, flagella: { mode: 'peritriche', count: 5 },
    phases: [
      { at: 1.00, ability: 'tumble', label: 'CULBUTE' },
      { at: 0.65, ability: 'comete', label: 'COMETE D ACTINE' },
      { at: 0.30, ability: 'llo', label: 'LISTERIOLYSINE O' },
    ],
    note: "Mobile a 20-25 C par flagelles peritriches (culbute en roue), immobile a 37 C. Comete d'actine via ActA. LLO : sortie du phagosome.",
  }),
};

/* -------------------------------------------------------- MATRICE 2 -----
   Conduite industrielle. Flore reelle des lignes laitieres : ce sont les
   especes qu'on isole des joints, des coudes morts et des rayures d'inox
   apres un NEP mal conduit. Meme regle que pour le lait : aucune capacite
   qui ne soit documentee chez l'espece.
-------------------------------------------------------------------------- */

export const PIPE_MOBS = [
  M({
    id: 'sphingomonas', label: 'SPHINGOMONAS', role: 'chaff',
    kind: 'rod', mot: 'brown', gram: '-',
    hp: 24, speed: 16, contact: 5, radius: 2.8, aa: 3,
    resist: 0.15, ability: 'adhesion', cipShelter: true, elance: 0.8,
    note: "Non mobile malgre son epithete paucimobilis, d'ou l'absence de flagelle. Colonisateur classique des reseaux d'eau. Sa membrane externe porte des glycosphingolipides a la place du LPS, d'ou une adhesion tres forte et une tolerance aux desinfectants. Peu mobile : elle tient la paroi plus qu'elle ne nage.",
  }),
  M({
    id: 'aeruginosa', label: 'P. AERUGINOSA', role: 'runner',
    kind: 'rod', mot: 'swim', gram: '-',
    hp: 34, speed: 88, contact: 8, radius: 3.1, aa: 5,
    ability: 'alginate', elance: 1.0, flagella: { mode: 'polaire', count: 1 },
    note: "Flagelle polaire unique. Secrete de l'alginate, l'exopolysaccharide qui donne le phenotype mucoide : c'est lui qui reforme la plaque de biofilm. Quorum sensing las/rhl.",
  }),
  M({
    id: 'listeriaPers', label: 'L. MONOCYTOGENES PERS.', role: 'tank',
    kind: 'rod', mot: 'tumble', gram: '+',
    hp: 130, speed: 46, contact: 13, radius: 4.2, aa: 9,
    resist: 0.30, ability: 'persistance', cipShelter: true,
    elance: 0.9, flagella: { mode: 'peritriche', count: 4 },
    note: "Souches persistantes reellement isolees des memes ateliers pendant des annees : elles tiennent l'inox raye et tolerent des doses sublethales de desinfectant. Mobile par flagelles peritriches sous 30 C.",
  }),
  M({
    id: 'sporeAdh', label: 'SPORE ADHEREE', role: 'chaff', cost: 0.8,
    kind: 'spore', mot: 'none', gram: '+',
    hp: 60, speed: 0, contact: 11, radius: 3, aa: 5, zSpeed: 0.4,
    resist: 0.60, cipImmune: true, ability: 'germination',
    germinatesInto: 'bacillus',
    note: "Les endospores de Bacillus adherent a l'inox et survivent a un cycle de NEP complet : c'est le probleme industriel de fond. Il faut un tir direct, la zone ne suffit pas.",
  }),
  M({
    id: 'acanthamoeba', label: 'ACANTHAMOEBA', role: 'predator',
    kind: 'acanthe', mot: 'brown', gram: null,
    hp: 210, speed: 30, contact: 16, radius: 8, aa: 16, zSpeed: 0.18,
    ability: 'phagocytose',
    note: "Amibe libre des reseaux d'eau : elle broute le biofilm et phagocyte les bacteries. Ses acanthopodes sont son marqueur. Elle s'enkyste et traverse les biocides.",
  }),
  M({
    id: 'swarmer', label: 'ESSAIM', role: 'chaff', cost: 0.7,
    kind: 'rod', mot: 'swim', gram: '-',
    hp: 16, speed: 118, contact: 6, radius: 2.2, aa: 2,
    /* Une cellule en swarming est REELLEMENT allongee et hyperflagellee :
       c'est la differenciation qui porte ce nom. */
    elance: 1.8, flagella: { mode: 'peritriche', count: 8 },
    note: "Cellules en swarming detachees d'une plaque de biofilm mur : la dispersion est la derniere etape du cycle du biofilm, et elle est active.",
  }),
];

/** Source du couloir : une plaque accrochee a la paroi, qui emet sans fin.
 *  Elle n'est pas achetee par le directeur — c'est la conduite qui la pose. */
export const PIPE_PLAQUE = M({
  id: 'plaque', label: 'PLAQUE DE BIOFILM', role: 'denier', cost: 0,
  kind: 'plaque', mot: 'none', gram: null,
  hp: 200, speed: 0, contact: 9, radius: 11, aa: 14,
  zSpeed: 0, zHold: 0.55, resist: 0.25, immobile: true,
  /* Une plaque n'est pas un organisme qui flotte a une profondeur : c'est
     une STRUCTURE accrochee a la paroi, qui occupe la section. La mise au
     point decide si on peut la TOUCHER, pas si elle est la. */
  obstacle: true,
  ability: 'emission', cipShelter: true,
  note: "Un biofilm est un mode de vie, pas un depot : la matrice d'EPS protege du courant et des biocides, et la plaque disperse activement des cellules pour coloniser plus loin. Elle se reforme tant qu'un secreteur d'alginate vit a cote.",
});

export const PIPE_NEUTRALS = [
  M({
    id: 'methylo', label: 'METHYLOBACTERIUM', role: 'neutral', cost: 0,
    kind: 'rosette', mot: 'brown', gram: '-', neutral: true, segments: 4,
    hp: 140, speed: 9, contact: 0, radius: 4.6, aa: 3, zSpeed: 0, zWander: true,
    note: "Methylotrophe facultative rose, habitante ordinaire des reseaux d'eau et des rincages. Elle s'accole par un pole en ROSETTES, ce qui la rend reconnaissable entre toutes. Elle colonise l'inox sans rien devoir a personne, et surtout pas a une bacterie lactique.",
  }),
];

export const PIPE_BOSSES = {
  mucoid: M({
    id: 'mucoid', label: 'P. AERUGINOSA MUCOIDE', role: 'boss', cost: 0,
    kind: 'mucoide', mot: 'swim', gram: '-',
    hp: 1000, speed: 52, contact: 16, radius: 12, aa: 110, zSpeed: 0.3,
    flagella: { mode: 'polaire', count: 1 },
    boss: true, dropsPlasmid: true,
    phases: [
      { at: 1.00, ability: 'alginate', label: 'ALGINATE' },
      { at: 0.55, ability: 'quorumboss', label: 'QUORUM SENSING' },
      { at: 0.25, ability: 'dispersion', label: 'DISPERSION' },
    ],
    disperseInto: 'swarmer',
    note: "Conversion mucoide par mutation de mucA : surproduction d'alginate, le phenotype des souches installees a demeure. Pyocyanine et rhamnolipides completent l'arsenal.",
  }),
  amibe: M({
    id: 'amibe', label: 'ACANTHAMOEBA GEANTE', role: 'boss', cost: 0,
    kind: 'acanthe', mot: 'brown', gram: null,
    hp: 1400, speed: 34, contact: 18, radius: 15, aa: 150, zSpeed: 0.22,
    boss: true, dropsPlasmid: true,
    phases: [
      { at: 1.00, ability: 'phagocytose', label: 'PHAGOCYTOSE' },
      { at: 0.55, ability: 'broutage', label: 'BROUTAGE' },
      { at: 0.25, ability: 'enkystement', label: 'ENKYSTEMENT' },
    ],
    note: "Trophozoite gorge de biofilm. Les amibes sont un reservoir reel de bacteries dans les reseaux : ce qu'elles avalent en ressort vivant.",
  }),
  biofilm: M({
    id: 'biofilmMur', label: 'BIOFILM MUR', role: 'boss', cost: 0,
    kind: 'plaque', mot: 'none', gram: null,
    hp: 3200, speed: 0, contact: 22, radius: 26, aa: 320,
    boss: true, dropsPlasmid: true, zSpeed: 0, immobile: true,
    phases: [
      { at: 1.00, ability: 'essaimage', label: 'ESSAIMAGE' },
      { at: 0.60, ability: 'retraction', label: 'RETRACTION' },
      { at: 0.28, ability: 'dispersion', label: 'DISPERSION' },
    ],
    disperseInto: 'swarmer',
    note: "Un biofilm mur n'est pas un organisme mais un consortium : matrice d'EPS, canaux d'eau, gradients internes. Il se disperse activement quand le milieu se degrade, et c'est pendant le NEP qu'il est le plus expose.",
  }),
};

/* -------------------------------------------------------- MATRICE 3 -----
   Kombucha. Consortium reel d'une jarre au septieme jour : bacteries
   acetiques, tisseuse de cellulose, et surtout des LEVURES, plus une flore
   fongique de surface. Le milieu est bien plus acide que le lait cru et
   sature d'acide acetique, ce qui change ce qu'on peut y faire.
-------------------------------------------------------------------------- */

export const KOMBUCHA_MOBS = [
  M({
    id: 'acetobacter', label: 'A. PASTEURIANUS', role: 'chaff',
    kind: 'rod', mot: 'swim', gram: '-',
    hp: 26, speed: 58, contact: 6, radius: 2.8, aa: 3,
    elance: 1.1, flagella: { mode: 'peritriche', count: 5 },
    ability: 'acetique',
    note: "Bacterie acetique de la fermentation : elle oxyde l'ethanol en acide acetique. C'est elle qui rend le milieu hostile a une bacterie lactique.",
  }),
  M({
    id: 'gluconobacter', label: 'GLUCONOBACTER', role: 'runner',
    kind: 'rod', mot: 'swim', gram: '-',
    hp: 22, speed: 92, contact: 8, radius: 2.5, aa: 4,
    elance: 0.95, flagella: { mode: 'polaire', count: 1 },
    note: "Oxyde le glucose en acide gluconique sans aller jusqu'au bout du cycle : elle vit vite et acidifie vite. Flagellation polaire.",
  }),
  M({
    id: 'komagataeibacter', label: 'K. XYLINUS', role: 'denier',
    kind: 'rod', mot: 'none', gram: '-',
    hp: 150, speed: 0, contact: 7, radius: 3.4, aa: 9, zSpeed: 0.45,
    elance: 1.3, ability: 'cellulose',
    note: "La tisseuse du SCOBY : elle extrude en continu des rubans de cellulose bacterienne. C'est elle qui fabrique la pellicule, et elle referme l'arene si on la laisse faire.",
  }),
  M({
    id: 'brettanomyces', label: 'B. BRUXELLENSIS', role: 'splitter',
    kind: 'bud', mot: 'brown', gram: 'fungi',
    hp: 95, speed: 20, contact: 12, radius: 9, aa: 9, zSpeed: 0.16,
    ability: 'bourgeonnement',
    note: "Levure de contamination des fermentations, tres tolerante a l'acide et a l'ethanol. Bourgeonnement, et cellules souvent allongees en ogive.",
  }),
  M({
    id: 'zygosaccharomyces', label: 'Z. BAILII', role: 'tank',
    kind: 'bud', mot: 'brown', gram: 'fungi',
    hp: 180, speed: 24, contact: 14, radius: 11, aa: 12, zSpeed: 0.18,
    resist: 0.35, ability: 'osmotolerance',
    note: "L'une des levures d'alteration les plus resistantes qu'on connaisse : elle tient des concentrations en sucre et en acide qui steriliseraient tout le reste. La tuer coute cher.",
  }),
  M({
    id: 'conidie', label: 'CONIDIE', role: 'chaff', cost: 0.7,
    kind: 'spore', mot: 'drift', gram: 'fungi',
    hp: 34, speed: 12, contact: 8, radius: 2.6, aa: 4,
    zSpeed: 0.2, resist: 0.3, ability: 'germination',
    germinatesInto: 'brettanomyces',
    note: "Spore asexuee de moisissure, detachee d'une tete conidienne et portee par le milieu. Elle ne nage pas : elle derive, et elle germe si on la laisse.",
  }),
];

/* La faune neutre du kombucha, ce sont les MOISISSURES FILAMENTEUSES. Elles
   sont enormes, lentes, majestueuses, et elles ne vous veulent rien — des
   baleines. Elles occupent le champ et il faut faire avec.

   Leur rayon est volontairement TRES superieur a celui des mobs : une tete
   conidienne d'Aspergillus fait quelques centaines de micrometres contre un
   ou deux pour une bacterie. On compresse enormement, comme partout dans le
   jeu, mais le rapport doit rester lisible A L'ECRAN.

   Echelle retenue, en rayons, le joueur valant 3,4 :

     bacterie      2,5 a 3,4     reference
     levure        9 a 11        une levure fait quatre a six fois une
                                 bacterie, c'est le rapport reel
     amas          26            un bourgeonnement qui n'a pas separe
     moisissure    34 a 38       tete conidienne : une baleine
     hyphe         46            le mycelium, qui est encore au-dessus

   Mesure qui a motive la revision : a 5,2 une levure faisait une fois et
   demie le joueur, et a 22 une moisissure en faisait trois fois — les deux
   se lisaient comme de gros mobs, pas comme un autre regne. */
export const KOMBUCHA_NEUTRALS = [
  M({
    id: 'aspergillus', label: 'ASPERGILLUS', role: 'neutral', cost: 0,
    kind: 'conidiophore', mot: 'brown', gram: 'fungi', neutral: true, obstacle: true,
    hp: 900, speed: 4, contact: 0, radius: 38, aa: 10, zSpeed: 0, zWander: true, zAmp: 0.32,
    note: "Tete conidienne en aspergillum : un stipe dresse, une vesicule globuleuse, et des chainettes de conidies rayonnantes. Moisissure de surface d'une jarre ouverte. Elle ne s'en prend a personne.",
  }),
  M({
    id: 'penicillium', label: 'PENICILLIUM', role: 'neutral', cost: 0,
    kind: 'penicille', mot: 'brown', gram: 'fungi', neutral: true, obstacle: true,
    hp: 820, speed: 5, contact: 0, radius: 34, aa: 9, zSpeed: 0, zWander: true, zAmp: 0.32,
    note: "Son nom vient du pinceau : le conidiophore se ramifie en metules puis en phialides, d'ou partent les chainettes de conidies. Contaminant classique des milieux sucres et acides.",
  }),
];

/* Les HYPHES. Un mycelium n'est pas une cellule de plus : c'est un RESEAU,
   et a l'echelle ou l'on observe, un seul filament traverse le champ. Il ne
   bouge pratiquement pas et ne veut rien a personne, mais il occupe — c'est
   le seul neutre qui se comporte comme un element de terrain. */
KOMBUCHA_NEUTRALS.push(M({
  id: 'hyphes', label: 'HYPHE MYCELIEN', role: 'neutral', cost: 0,
  kind: 'hyphe', mot: 'brown', gram: 'fungi', neutral: true, obstacle: true,
  hp: 1200, speed: 2, contact: 0, radius: 46, aa: 12, zSpeed: 0, zWander: true, zAmp: 0.26,
  elance: 2.6,
  note: "Filament vegetatif d'une moisissure : une file de cellules separees par des septa, qui pousse par son extremite et se ramifie. C'est la partie qui colonise, la tete conidienne n'etant que l'organe de reproduction.",
}));

export const KOMBUCHA_BOSSES = {
  scoby: M({
    id: 'scoby', label: 'LE SCOBY', role: 'boss', cost: 0,
    kind: 'plaque', mot: 'none', gram: null,
    hp: 3000, speed: 0, contact: 20, radius: 28, aa: 300,
    boss: true, dropsPlasmid: true, zSpeed: 0, immobile: true,
    disperseInto: 'conidie',
    phases: [
      { at: 1.00, ability: 'cellulose', label: 'TISSAGE' },
      { at: 0.55, ability: 'essaimage', label: 'RELARGAGE' },
      { at: 0.25, ability: 'dispersion', label: 'DISPERSION' },
    ],
    note: "La pellicule entiere : un consortium de bacteries acetiques et de levures pris dans un feutrage de cellulose bacterienne. Ce n'est pas un organisme, c'est un ecosysteme qui se defend.",
  }),
};

/* -------------------------------------------------------- MATRICE 4 -----
   Levain. Meme famille que le kombucha — milieu acide, flore mixte — mais
   l'accent est sur les LEVURES, et le champ est encombre de grains d'amidon
   qui en font un labyrinthe.
-------------------------------------------------------------------------- */

export const LEVAIN_MOBS = [
  M({
    id: 'sanfranciscensis', label: 'F. SANFRANCISCENSIS', role: 'chaff',
    kind: 'rod', mot: 'brown', gram: '+',
    hp: 22, speed: 24, contact: 4, radius: 2.6, aa: 3,
    elance: 1.4, ability: 'heterolactique',
    note: "L'embleme du levain : elle domine la quasi-totalite des levains matures du monde, en symbiose avec la levure qui lui laisse le maltose. Heterofermentaire, immobile.",
  }),
  M({
    id: 'brevis', label: 'L. BREVIS', role: 'chaff',
    kind: 'rod', mot: 'brown', gram: '+',
    hp: 26, speed: 30, contact: 5, radius: 2.9, aa: 3,
    elance: 1.25, ability: 'heterolactique',
    note: "Heterofermentaire : elle produit du CO2 et de l'acide acetique en plus du lactate. C'est une partie de la leve, et du gout.",
  }),
  M({
    id: 'plantarum', label: 'L. PLANTARUM', role: 'runner',
    kind: 'rod', mot: 'glide', gram: '+',
    hp: 30, speed: 74, contact: 8, radius: 2.8, aa: 4,
    elance: 1.2, ability: 'bacteriocine',
    note: "Genome parmi les plus grands des lactobacilles : elle s'adapte a tout et produit des plantaricines, des bacteriocines qui genent ses concurrentes.",
  }),
  M({
    id: 'kazachstania', label: 'K. HUMILIS', role: 'splitter',
    kind: 'bud', mot: 'brown', gram: 'fungi',
    hp: 110, speed: 18, contact: 12, radius: 5.8, aa: 10, zSpeed: 0.16,
    ability: 'bourgeonnement',
    note: "La levure classique des levains, longtemps appelee Candida milleri : incapable d'utiliser le maltose, elle le laisse a la bacterie lactique. C'est le coeur de la symbiose du levain.",
  }),
  M({
    id: 'anomalus', label: 'W. ANOMALUS', role: 'denier',
    kind: 'bud', mot: 'brown', gram: 'fungi',
    hp: 140, speed: 14, contact: 10, radius: 5.4, aa: 11, zSpeed: 0.3,
    ability: 'killer',
    note: "Levure a phenotype killer : elle secrete des toxines proteiques qui tuent les levures sensibles. Elle produit aussi de l'acetate d'ethyle, l'odeur de solvant d'un levain qui derape.",
  }),
  M({
    id: 'cerevisiae', label: 'S. CEREVISIAE', role: 'tank',
    kind: 'bud', mot: 'brown', gram: 'fungi',
    hp: 200, speed: 20, contact: 15, radius: 11, aa: 14, zSpeed: 0.18,
    ability: 'bourgeonnement',
    note: "La levure de boulangerie. Dans un levain elle coexiste avec les lactobacilles au lieu de les ecraser, parce que le milieu est trop acide pour qu'elle domine.",
  }),
];

export const LEVAIN_NEUTRALS = [
  M({
    id: 'grandelevure', label: 'AMAS DE LEVURES', role: 'neutral', cost: 0,
    kind: 'amas', mot: 'brown', gram: 'fungi', neutral: true, obstacle: true,
    hp: 700, speed: 6, contact: 0, radius: 26, aa: 8, zSpeed: 0, zWander: true, zAmp: 0.30,
    note: "Un bourgeonnement qui n'a pas separe : les cellules filles restent accrochees et forment un amas pseudomycelien. Massif, lent, et parfaitement indifferent.",
  }),
  M({
    id: 'penicilliumLev', label: 'PENICILLIUM', role: 'neutral', cost: 0,
    kind: 'penicille', mot: 'brown', gram: 'fungi', neutral: true, obstacle: true,
    spriteId: 'penicillium',
    hp: 820, speed: 5, contact: 0, radius: 34, aa: 9, zSpeed: 0, zWander: true, zAmp: 0.32,
    note: "La moisissure qui finit par gagner un levain neglige. Conidiophore en pinceau, chainettes de conidies.",
  }),
];

export const LEVAIN_BOSSES = {
  amasmur: M({
    id: 'amasmur', label: 'COLONIE DE W. ANOMALUS', role: 'boss', cost: 0,
    kind: 'amas', mot: 'brown', gram: 'fungi',
    hp: 2600, speed: 16, contact: 20, radius: 20, aa: 260, zSpeed: 0.2,
    boss: true, dropsPlasmid: true, disperseInto: 'brevis',
    phases: [
      { at: 1.00, ability: 'killer', label: 'TOXINE KILLER' },
      { at: 0.55, ability: 'bourgeonnement', label: 'BOURGEONNEMENT' },
      { at: 0.25, ability: 'dispersion', label: 'DISPERSION' },
    ],
    note: "Une colonie killer qui a pris toute la place : elle tue les levures sensibles autour d'elle et occupe le terrain. Le levain vire au solvant.",
  }),
};

export const BESTIARY = Object.fromEntries(
  [...MILK_MOBS, ...MILK_NEUTRALS, ...Object.values(MILK_BOSSES),
    ...PIPE_MOBS, PIPE_PLAQUE, ...PIPE_NEUTRALS, ...Object.values(PIPE_BOSSES),
    ...KOMBUCHA_MOBS, ...KOMBUCHA_NEUTRALS, ...Object.values(KOMBUCHA_BOSSES),
    ...LEVAIN_MOBS, ...LEVAIN_NEUTRALS, ...Object.values(LEVAIN_BOSSES),
  ].map((m) => [m.id, m]),
);

/* Les matrices 3 et 4 sont specifiees dans docs/02-bestiaire.md mais ne sont
   pas encore implementees. */
export const IMPLEMENTED_MATRICES = ['milk', 'pipe', 'kombucha', 'levain'];
