/* ---------------------------------------------------------------------------
   Les souches jouables.

   Le jeu est parti d'une seule cellule pilotable, la bacterie lactique. Ce
   fichier en fait UNE ESPECE PARMI D'AUTRES : chaque souche apporte ses stats
   de base, sa toxine, sa morphologie et sa CARACTERISTIQUE UNIQUE.

   Trois regles, qui decident de tout le reste :

   1. La caracteristique unique N'EST PAS une evolution. Elle est la des la
      premiere seconde de la partie, elle ne se tire pas et ne se perd pas.
      Ce sont des evolutions DEDIEES qui l'ameliorent (champ `evo`), et
      celles-la ne sortent que pour la souche concernee.

   2. Toutes les souches piochent dans le MEME catalogue d'evolutions. Ce qui
      change est la PROBABILITE : chaque souche ponderer les voies par ce
      qu'elle est reellement (`biais`). Un coque immobile tire moins de
      flagelles, une levure tire moins d'acidophilie. Aucune carte n'est
      fermee pour autant : le transfert horizontal de genes est le sujet du
      jeu, et un S. aureus flagelle reste une histoire que le jeu sait
      raconter.

   3. Les MOBS n'ont que des capacites documentees ; le JOUEUR, lui, a le
      droit de briser le realisme. C'est pour ca qu'une souche jouable peut
      nager alors que son espece est immobile, ou former six spores quand la
      cellule reelle n'en fait qu'une.

   Les stats de base sont des ECARTS assumes a `BASE` (src/game/stats.js),
   pas des valeurs tirees au hasard : elles suivent la taille reelle de la
   cellule et son mode de vie. Les DPS theoriques sont calibres a puissance
   comparable au depart ; c'est le banc `npm run especes` qui le verifie.
--------------------------------------------------------------------------- */

/**
 * Les toxines.
 *
 * Le tir n'est pas un decor : chacune se comporte selon la CHIMIE de la
 * molecule, et c'est ce qui differencie les souches autant que leurs stats.
 *
 *   acidifie    part de la charge acide deposee dans le champ de pH.
 *               Seul l'acide lactique acidifie ; un depsipeptide, une
 *               proteine et un alcool ne changent pas le pH du milieu.
 *   grasArrete  un globule gras arrete-t-il le projectile ? L'acide lactique
 *               est hydrosoluble et ne penetre pas la phase grasse — c'est
 *               ce qui fait des globules un abri. Une molecule LIPOPHILE, au
 *               contraire, passe au travers : la phase grasse est son
 *               solvant, pas son mur.
 *   diffusion   gonflement du projectile en vol, en multiple du rayon
 *               initial. Une goutte d'acide s'etale et se dilue (1,6) ; un
 *               cristal de depsipeptide thermostable ne se dilue pas (0,1).
 *   perteDiffus part des degats perdue quand le projectile est entierement
 *               diffuse. C'est la dilution : elle ne s'applique qu'a ce qui
 *               se dilue.
 */
export const TIRS = {
  lactate: {
    id: 'lactate', label: 'ACIDE LACTIQUE', forme: 'goutte',
    acidifie: 1, grasArrete: true, diffusion: 1.6, perteDiffus: 0.5,
    note: "L'acide lactique fait le pH du milieu : c'est le seul tir qui acidifie le terrain, donc le seul qui prepare son propre confort.",
  },
  cereulide: {
    id: 'cereulide', label: 'CEREULIDE', forme: 'cristal',
    acidifie: 0, grasArrete: false, diffusion: 0.1, perteDiffus: 0,
    note: "Depsipeptide cyclique de 1,2 kDa, thermostable et fortement lipophile : il ne se dilue pas et traverse la phase grasse au lieu d'y etre arrete. Ionophore a potassium.",
  },
  alphatoxine: {
    id: 'alphatoxine', label: 'ALPHA-HEMOLYSINE', forme: 'pore',
    acidifie: 0, grasArrete: true, diffusion: 0.35, perteDiffus: 0.25,
    pore: { dps: 3.2, duree: 3.5 },
    note: "Proteine de 33 kDa qui s'assemble en heptamere et perce un pore dans la membrane cible. Le pore continue de fuir apres l'impact : les degats s'etalent dans le temps.",
  },
  ethanol: {
    id: 'ethanol', label: 'ETHANOL', forme: 'bouffee',
    acidifie: 0, grasArrete: false, diffusion: 2.4, perteDiffus: 0.35,
    ralentit: { part: 0.30, duree: 1.4 },
    note: "Petite molecule miscible a l'eau comme aux lipides : elle passe partout, se dilue vite, et fluidifie les membranes qu'elle touche — d'ou le ralentissement.",
  },
};

/**
 * @typedef {object} Espece
 * @property {string} id          identifiant interne
 * @property {string} label       nom affiche
 * @property {string} sous        sous-titre du lobby
 * @property {string} morpho      morphologie de rendu (voir drawPlayer)
 * @property {string} tir         cle de TIRS
 * @property {object} stats       ecarts a BASE
 * @property {number} confortAcide  part de cadence gagnee (ou perdue) a pH bas
 * @property {object|null} trait  caracteristique unique
 * @property {object} biais       ponderation du tirage d'evolutions
 * @property {boolean} [aflagelle] la souche ne PEUT PAS gagner de flagelle
 */

/* Ponderation par defaut : une voie absente vaut 1. */
export const ESPECES = [
  {
    id: 'lactobacillus',
    label: 'L. PLANTARUM',
    sous: 'BACTERIE LACTIQUE',
    morpho: 'bacille',
    gram: '+',
    tir: 'lactate',
    stats: {},                       // la reference : BASE tel quel
    /* Une lactique fonctionne mieux dans l'acide qu'elle fabrique. */
    confortAcide: 0.14,
    trait: null,
    biais: { voies: { acidophile: 1.45, diffuseur: 1.20, flagelle: 1.15 } },
    note: "Bacille de 2 a 8 um sur 0,5 a 1 um, homofermentaire facultative, auxotrophe pour la plupart des acides amines. Immobile dans la nature : sa nage lui vient des flagellines qu'elle vole. C'est la souche de reference, celle sur laquelle tout le jeu est cale.",
  },

  {
    id: 'cereus',
    label: 'B. CEREUS',
    sous: 'BACILLE SPORULANT',
    morpho: 'bacillelong',
    gram: '+',
    tir: 'cereulide',
    /* Une cellule de B. cereus fait 1,0 a 1,2 um de LARGE contre 0,5 a 1 um
       pour un lactobacille, soit un volume double a section egale : plus de
       PV, plus d'encombrement. Le tir est lent parce qu'un depsipeptide se
       synthetise sur un complexe non ribosomique, pas sur un ribosome —
       mais chaque dose porte, puisqu'elle ne se dilue pas. */
    stats: {
      maxHp: 132, speed: 62, accel: 430, dmg: 15, fireRate: 1.45,
      bulletSpeed: 150, bulletRadius: 2.6, range: 112, hitbox: 4.3,
      aaGain: 0.92,
    },
    /* B. cereus ne pousse plus sous pH 4,9 : l'acide le gene au lieu de
       l'aider. C'est le seul personnage penalise par un terrain acide. */
    confortAcide: -0.12,
    trait: {
      id: 'sporulation',
      label: 'SPORULATION',
      /* Credit de spores. Une cellule reelle n'en forme qu'UNE, et c'est
         pour ca que le depart est a 1 : la premiere spore est realiste, les
         suivantes sont le privilege du joueur. */
      base: 1,
      evo: 'sporeplus',
      court: 'SPORES',
      desc: "A la lyse, la cellule sporule au lieu de mourir. La germination rend 70 % des PV. Credit epuise, la partie est finie.",
      note: "L'endospore de Bacillus resiste a la chaleur, a la dessiccation et aux acides ; c'est reellement ce qui fait survivre l'espece a la pasteurisation.",
    },
    biais: {
      voies: { cuirasse: 1.45, acidophile: 0.70, predateur: 1.15, diffuseur: 0.85 },
      /* La dormance VBNC est la reponse des NON sporulants au meme probleme :
         elle ferait doublon avec la spore, donc elle se rarefie. */
      cartes: { vbnc: 0.25, sporeplus: 3.0, germination: 2.4 },
    },
    note: "Bacille de 3 a 5 um, mobile par flagelles peritriches, Gram positif. Sa toxine emetique, la cereulide, est un ionophore a potassium thermostable : c'est elle qui survit a la cuisson du riz. Arrive au lait par le sol et la traite.",
  },

  {
    id: 'aureus',
    label: 'S. AUREUS',
    sous: 'COQUE EN AMAS',
    morpho: 'amas',
    gram: '+',
    tir: 'alphatoxine',
    /* Un coque de 0,8 a 1,0 um : petit, compact, sans flagelle. Il est donc
       lent et peu agile, mais il encaisse — la paroi d'un staphylocoque est
       epaisse et il tolere une pression osmotique que rien d'autre ne
       supporte. La portee est courte : l'alpha-hemolysine est une PROTEINE,
       elle ne part pas loin. */
    stats: {
      maxHp: 118, speed: 58, accel: 330, dmg: 9.5, fireRate: 2.0,
      bulletSpeed: 150, bulletRadius: 2.0, range: 84, hitbox: 3.0,
    },
    /* S. aureus pousse de pH 4,5 a 9,3 : ni gene ni aide. */
    confortAcide: 0,
    trait: {
      id: 'amas',
      label: 'DIVISION MULTIPLAN',
      /* On commence UNICELLULAIRE. L'amas se gagne, il n'est pas donne. */
      base: 1,
      max: 6,
      evo: 'multiplan',
      court: 'AMAS',
      desc: "Chaque cellule de l'amas ajoute de la toxine. L'amas se deconstruit a mesure que les PV tombent : blesse, on tape moins fort.",
      note: "S. aureus se divise dans des plans successifs sans separer ses cellules filles : c'est ce qui donne la grappe de raisin du frottis.",
    },
    /* Immobile, et ca ne s'achete pas. Un staphylocoque n'a pas de flagelle,
       n'en a jamais eu, et les trois cartes de flagellation lui sont donc
       FERMEES — pas rendues rares, fermees. */
    aflagelle: true,
    biais: {
      voies: { cuirasse: 1.30, predateur: 1.20, flagelle: 0.55, acidophile: 0.80 },
      /* La coagulase et l'ilot de pathogenicite sont a lui : il les porte
         reellement, il n'a pas a les voler. */
      cartes: { coagulase: 2.2, sapi: 2.0, multiplan: 3.0, agr: 2.4 },
    },
    note: "Coque de 0,8 a 1,0 um en grappe, immobile, Gram positif. Pigmente par la staphyloxanthine, un carotenoide dore qui lui donne son nom et le protege des especes reactives de l'oxygene. Coagulase positive : c'est le test qui identifie l'espece.",
  },

  {
    id: 'cerevisiae',
    label: 'S. CEREVISIAE',
    sous: 'LEVURE DE FERMENTATION',
    morpho: 'levure',
    gram: 'fungi',
    tir: 'ethanol',
    /* Une levure fait 5 a 10 um : un eucaryote, dix a cent fois le VOLUME
       d'une bacterie. D'ou beaucoup de PV, une grosse hitbox, une nage
       lourde et une cadence lente — une cellule qui pese ne se deplace pas
       comme un bacille. Le gain d'acides amines baisse : la meme bouchee
       deplace moins de biomasse quand la cellule est dix fois plus grosse. */
    stats: {
      maxHp: 210, speed: 46, accel: 300, dmg: 14, fireRate: 1.25,
      bulletSpeed: 140, bulletRadius: 3.4, range: 104, hitbox: 6.0,
      pickup: 42, aaGain: 0.85,
    },
    /* Les levures poussent jusqu'a pH 2,5 : l'acide les derange a peine et
       elimine leur concurrence. Un leger confort, pas celui d'une lactique. */
    confortAcide: 0.06,
    trait: {
      id: 'bourgeonnement',
      label: 'BOURGEONNEMENT',
      /* Duree de maturation du bourgeon, en secondes. Voir le banc : c'est
         le nombre qui decide si le trait est un filet de securite ou une
         seconde vie gratuite. */
      base: 50,
      perte: 0.5,
      evo: 'segregation',
      court: 'BOURGEON',
      desc: "Un bourgeon murit en continu. A la lyse, la cellule fille prend la place de la mere : PV pleins, mais la moitie des evolutions acquises est perdue au hasard.",
      note: "Le bourgeonnement de S. cerevisiae est asymetrique : la cellule fille repart neuve, la mere porte les cicatrices. La perte d'evolutions est la part de genome que la division ne transmet pas.",
    },
    /* Une levure ne nage pas : elle bourgeonne, elle flotte et elle sedimente.
       Un flagelle sur un eucaryote de 8 um serait un cil, ce qui est un autre
       organite avec un autre moteur. Cartes de flagellation fermees. */
    aflagelle: true,
    biais: {
      voies: { flagelle: 0.45, acidophile: 0.65, diffuseur: 1.30, cuirasse: 1.15 },
      /* La lipase attaque les levures : se la donner a soi-meme n'a aucun
         sens. La nisine non plus, elle ne touche que les Gram positif. */
      cartes: { lipase: 0.15, nisine: 0.25, segregation: 3.0, precoce: 2.4 },
    },
    note: "Levure de 5 a 10 um, eucaryote, bourgeonnement multilateral. Elle fabrique l'ethanol qui tue sa concurrence et le tolere jusqu'a 15 % : c'est sa strategie ecologique entiere, et c'est devenu son tir.",
  },
];

export const ESPECE_BY_ID = Object.fromEntries(ESPECES.map((e) => [e.id, e]));
export const ESPECE_DEFAUT = 'lactobacillus';

/** Souche par identifiant, avec repli sur la reference. */
export function especeOf(id) {
  return ESPECE_BY_ID[id] || ESPECE_BY_ID[ESPECE_DEFAUT];
}

/** Toxine d'une souche. */
export function tirOf(espece) {
  return TIRS[espece.tir] || TIRS.lactate;
}
