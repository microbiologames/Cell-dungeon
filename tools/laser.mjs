/* ---------------------------------------------------------------------------
   Plans de decoupe laser de la borne microscope.

   Produit des SVG en millimetres dans borne/decoupe/, et VERIFIE ce qu'il
   produit. Plan d'ensemble : docs/09-borne-microscope.md.

     npm run laser                 genere et verifie
     KERF=0.22 npm run laser       avec le jeu de coupe mesure sur TA machine
     DEFAUT=... npm run laser      verifie que le banc attrape le defaut

   LA CHOSE A COMPRENDRE AVANT DE LANCER LA MACHINE : le laser ENLEVE de la
   matiere, une saignee de l'ordre de 0,2 mm. Un trou sort donc plus GRAND que
   dessine, et une piece exterieure plus PETITE, chacun de la largeur de cette
   saignee. Qui ne compense pas obtient une boite de Petri qui ballotte dans un
   logement trop large et des entretoises qui n'empilent pas droit.

   La saignee depend de la machine, de la puissance, de la vitesse ET du
   materiau : elle ne se devine pas, elle se mesure. C'est a quoi sert
   `gabarit-kerf.svg`, LA PREMIERE PIECE A DECOUPER — avant tout le reste.
--------------------------------------------------------------------------- */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const SORTIE = 'borne/decoupe';

/* --- ce qui se regle ---------------------------------------------------- */
const n = (cle, defaut) => (process.env[cle] ? Number(process.env[cle]) : defaut);

/** Saignee du laser. 0,18 est une valeur COURANTE sur du MDF de 3 a 5 mm en
 *  CO2 de 40 a 60 W — ce n'est pas la tienne. La mesurer avec le gabarit, puis
 *  relancer avec KERF=<mesure>. */
const KERF = n('KERF', 0.18);

const EP_STRUCT = n('EP_STRUCT', 5);      // MDF de structure
const EP_FACE = n('EP_FACE', 3);          // acrylique des faces vues

/** Boite de Petri : 90 mm est la taille de laboratoire courante ; 55 mm
 *  existe aussi. Mesurer la BOITE qu'on a, les moules varient de quelques
 *  dixiemes et c'est justement l'ordre de grandeur du jeu recherche. */
const D_BOITE = n('D_BOITE', 90);

/** Largeur de l'epaulement qui porte la boite. En dessous de 2 mm, l'anneau
 *  de MDF restant casse a la manipulation. */
const APPUI = n('APPUI', 3);

/** Jeu de POSE : la boite doit entrer et sortir a la main, sans forcer et
 *  sans ballotter. 0,4 mm au diametre, soit 0,2 mm au rayon. */
const JEU_POSE = n('JEU_POSE', 0.4);

/** Anneau de LED. A verifier sur le modele reellement achete : les anneaux
 *  de 16 WS2812B vont d'environ 45 a 70 mm de diametre exterieur. */
const D_ANNEAU = n('D_ANNEAU', 66);

/** Ecart entre les LED et le diffuseur. En deca, on voit les points lumineux
 *  a travers l'opale au lieu d'une nappe. 15 mm est le minimum retenu dans
 *  docs/09-borne-microscope.md. */
const ECART_DIFFUSEUR = n('ECART_DIFFUSEUR', 15);

const COTE = n('COTE', 140);              // cote des plaques empilees
const D_VIS = n('D_VIS', 4.2);            // passage d'une vis M4
/* Entraxe des quatre vis d'empilage. 120 mm etait le premier reglage et le
   banc l'a refuse : il placait le bord des trous a 7,9 mm du bord de la
   plaque, sous la marge de 10 mm, et le MDF se fend la au serrage. 114 mm
   redonne 10,9 mm. Le genre d'erreur qui ne se voit qu'apres decoupe. */
const ENTRAXE = n('ENTRAXE', 114);
const D_CABLE = n('D_CABLE', 8);          // passage du cable de l'anneau

/** Marge minimale entre un percage et un bord. En deca, le MDF se fend au
 *  serrage. Regle d'atelier : au moins deux fois l'epaisseur. */
const MARGE_MIN = n('MARGE_MIN', 2 * EP_STRUCT);

/* Panneau de commande. CES COTES SONT A VERIFIER SUR TES PIECES : les
   joysticks et boutons d'arcade ne sont pas normalises, et un entraxe faux
   ne se rattrape pas apres decoupe. Le gabarit de percage est la pour ca. */
const D_JOYSTICK = n('D_JOYSTICK', 24);
const ENTRAXE_JOYSTICK = n('ENTRAXE_JOYSTICK', 76);
const D_BOUTON = n('D_BOUTON', 28);
const D_MOLETTE = n('D_MOLETTE', 7.2);    // filetage d'un encodeur EC11

const PLATEAU = [n('PLATEAU_L', 600), n('PLATEAU_H', 400)];

/* --- injection de defaut, pour verifier que le banc garde quelque chose --- */
const DEFAUT = process.env.DEFAUT || '';

/* --- compensation de la saignee ----------------------------------------- */
/** Diametre a DESSINER pour obtenir un trou de `d` apres decoupe.
 *  Le laser elargit le trou de la saignee : on dessine donc plus petit. */
const trou = (d) => d - KERF;
/** Diametre a DESSINER pour obtenir une piece exterieure de `d`.
 *  Le laser ronge le contour : on dessine plus grand. */
const contour = (d) => d + KERF;

/* --- petite bibliotheque SVG -------------------------------------------- */
/* Convention repandue chez les decoupeurs : trait rouge fin = coupe,
   bleu = gravure. La largeur 0,1 mm garantit que la machine lit un trait de
   coupe et non un remplissage. */
const COUPE = 'stroke="#ff0000" stroke-width="0.1" fill="none"';
const GRAVE = 'stroke="#0055ff" stroke-width="0.1" fill="none"';

const cercle = (cx, cy, d, style = COUPE) =>
  `  <circle cx="${cx.toFixed(3)}" cy="${cy.toFixed(3)}" r="${(d / 2).toFixed(3)}" ${style}/>`;

const rect = (x, y, l, h, r = 0, style = COUPE) =>
  `  <rect x="${x.toFixed(3)}" y="${y.toFixed(3)}" width="${l.toFixed(3)}"`
  + ` height="${h.toFixed(3)}"${r ? ` rx="${r}"` : ''} ${style}/>`;

/** Contour exterieur d'une piece, saignee compensee.
 *
 *  La piece est agrandie de la saignee et RECENTREE d'une demi-saignee, pour
 *  que les percages, eux places par rapport aux cotes nominales, restent a
 *  leur position reelle. Sans ce recentrage tout le percage glisse de 0,09 mm
 *  vers un coin — invisible sur une plaque seule, visible sur une colonne de
 *  cinq plaques vissees ensemble. */
const contourRect = (l, h, r = 0) =>
  rect(-KERF / 2, -KERF / 2, contour(l), contour(h), r);

/* Les libelles graves sont du CONTENU XML : un « < » ou un « & » brut y casse
   le fichier, et une decoupeuse refuse alors le plan entier. C'est arrive avec
   le libelle « KERF=<valeur lue> » du gabarit. Le verdict plus bas garde ce
   defaut, l'echappement le corrige. */
const echappe = (t) => String(t)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const texte = (x, y, t, taille = 4) =>
  `  <text x="${x.toFixed(3)}" y="${y.toFixed(3)}" font-family="monospace"`
  + ` font-size="${taille}" fill="#0055ff">${echappe(t)}</text>`;

function svg(l, h, corps, titre) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- ${titre}
     Cell Dungeon — borne microscope. Genere par tools/laser.mjs.
     Saignee compensee : ${KERF} mm. Unites : millimetres.
     Rouge = coupe, bleu = gravure (a desactiver si la machine graverait). -->
<svg xmlns="http://www.w3.org/2000/svg" width="${(l + KERF).toFixed(2)}mm"
     height="${(h + KERF).toFixed(2)}mm"
     viewBox="${(-KERF / 2).toFixed(3)} ${(-KERF / 2).toFixed(3)} ${(l + KERF).toFixed(3)} ${(h + KERF).toFixed(3)}">
${corps.join('\n')}
</svg>
`;
}

/* --- les pieces ---------------------------------------------------------- */
/* Chaque piece se decrit par ses percages, ce qui permet au banc de les
   verifier tous de la meme facon : un trou trop pres d'un bord ou deux trous
   qui se recouvrent se voient sur cette liste, pas sur le dessin. */

/** Les quatre vis d'empilage, communes a toutes les plaques de la colonne. */
function visEmpilage(cote) {
  const o = (cote - ENTRAXE) / 2;
  return [
    { x: o, y: o, d: D_VIS }, { x: cote - o, y: o, d: D_VIS },
    { x: o, y: cote - o, d: D_VIS }, { x: cote - o, y: cote - o, d: D_VIS },
  ];
}

/** Une plaque carree de la colonne, avec un trou central et les vis. */
function plaqueColonne(nom, dCentral, note, extra = []) {
  const c = COTE / 2;
  const percages = [
    ...(dCentral > 0 ? [{ x: c, y: c, d: dCentral, role: 'central' }] : []),
    ...visEmpilage(COTE), ...extra,
  ];
  const corps = [
    contourRect(COTE, COTE),
    ...percages.map((p) => cercle(p.x, p.y, trou(p.d))),
    texte(6, COTE - 5, `${nom}  ep.${EP_STRUCT}  kerf ${KERF}`),
  ];
  return { nom, l: COTE, h: COTE, corps, percages, note, ep: EP_STRUCT };
}

const pieces = [];

/* 1. LE GABARIT DE SAIGNEE — la premiere piece a decouper.
      Sept fentes nominalement larges de l'epaisseur du materiau, corrigees
      de -0,30 a +0,30 mm. On essaie une chute dans chacune : celle qui entre
      FERME sans forcer donne la saignee reelle de la machine. */
{
  const L = 90, H = 46;
  const corrections = [-0.30, -0.20, -0.10, 0, 0.10, 0.20, 0.30];
  const corps = [contourRect(L, H)];
  corrections.forEach((c, i) => {
    const x = 6 + i * 11.5;
    /* La fente est dessinee a (epaisseur + correction) : pas de compensation
       ici, c'est justement ce qu'on cherche a mesurer. */
    corps.push(rect(x, 10, EP_STRUCT + c, 26, 0));
    corps.push(texte(x - 1.5, 8, (c > 0 ? '+' : '') + c.toFixed(2), 3));
  });
  corps.push(texte(6, 43, `gabarit de saignee  ep.${EP_STRUCT}  -> KERF=<valeur lue>`, 3.4));
  pieces.push({
    nom: 'gabarit-kerf', l: L, h: H, corps, percages: [], ep: EP_STRUCT,
    note: 'A DECOUPER EN PREMIER. Essayer une chute du meme materiau dans chaque '
      + 'fente : celle qui entre ferme sans forcer donne la saignee. Relancer '
      + 'ensuite avec KERF=<cette valeur>.',
  });
}

/* 2. LA COLONNE DE LA BOITE DE PETRI, du haut vers le bas.

      [ boite de Petri posee ]
      platine-guide    trou D_BOITE + jeu   la boite s'y encastre
      platine-siege    trou D_BOITE - 2*APPUI   epaulement qui la porte
      [ diffuseur opale, pince entre le siege et les entretoises ]
      entretoise x N   trou identique       ecarte les LED du diffuseur
      support-anneau   plein + passage cable  l'anneau se visse dessus       */
const D_SIEGE = D_BOITE - 2 * APPUI;
const D_GUIDE = D_BOITE + JEU_POSE;
const D_DIFFUSEUR = D_BOITE - 2;
/* Nombre d'entretoises : l'ecart voulu divise par l'epaisseur, arrondi au
   SUPERIEUR. Arrondir au plus proche pourrait passer sous les 15 mm, et on
   reverrait les points lumineux. */
const N_ENTRETOISES = Math.ceil(ECART_DIFFUSEUR / EP_STRUCT);

pieces.push(plaqueColonne('platine-guide', D_GUIDE,
  `Le logement de la boite : diametre ${D_GUIDE} mm pour une boite de ${D_BOITE} mm, `
  + `soit ${JEU_POSE} mm de jeu. x1`));
pieces.push(plaqueColonne('platine-siege', D_SIEGE,
  `L'epaulement qui porte la boite : ${APPUI} mm d'appui tout autour. x1`));
pieces.push(plaqueColonne('entretoise', D_SIEGE,
  `Ecarte les LED du diffuseur. x${N_ENTRETOISES} `
  + `(${N_ENTRETOISES * EP_STRUCT} mm pour ${ECART_DIFFUSEUR} mm demandes).`));
pieces.push(plaqueColonne('support-anneau', 0,
  `L'anneau de LED se pose au centre. Le cercle grave marque son diametre `
  + `(${D_ANNEAU} mm) : il guide le collage, il ne se coupe pas. x1`,
  [{ x: COTE - 14, y: COTE / 2, d: D_CABLE, role: 'cable' }]));
/* Le cercle de l'anneau est GRAVE et non coupe : il sert de repere de
   collage. Ajoute apres coup pour ne pas entrer dans la liste des percages,
   qu'il fausserait. */
pieces.at(-1).corps.splice(1, 0, cercle(COTE / 2, COTE / 2, D_ANNEAU, GRAVE));

/* 3. LE DIFFUSEUR, en acrylique OPALE. Piece exterieure : la saignee se
      compense a l'envers. */
{
  const L = D_DIFFUSEUR + 10;
  pieces.push({
    nom: 'diffuseur', l: L, h: L, ep: EP_FACE,
    corps: [
      cercle(L / 2, L / 2, contour(D_DIFFUSEUR)),
      texte(4, L - 3, `diffuseur opale ep.${EP_FACE}`, 3.4),
    ],
    percages: [],
    note: `ACRYLIQUE OPALE, pas transparent : c'est lui qui transforme seize `
      + `points lumineux en une nappe. Diametre ${D_DIFFUSEUR} mm, pince entre `
      + `le siege (trou ${D_SIEGE}) et la premiere entretoise. x1`,
  });
}

/* 4. LE PANNEAU DE COMMANDE. */
{
  const L = n('PANNEAU_L', 300), H = n('PANNEAU_H', 160);
  const yJ = H / 2;
  const percages = [
    { x: 70, y: yJ, d: D_JOYSTICK, role: 'joystick' },
    ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => ({
      x: 70 + sx * ENTRAXE_JOYSTICK / 2, y: yJ + sy * ENTRAXE_JOYSTICK / 2,
      d: D_VIS, role: 'vis-joystick',
    })),
    { x: 170, y: yJ - 18, d: D_BOUTON, role: 'dash' },
    { x: 208, y: yJ - 10, d: D_BOUTON, role: 'pause' },
    { x: 246, y: yJ - 2, d: D_BOUTON, role: 'muet' },
    { x: 170, y: yJ + 38, d: D_MOLETTE, role: 'molette' },
  ];
  pieces.push({
    nom: 'panneau', l: L, h: H, ep: EP_STRUCT, percages,
    corps: [
      contourRect(L, H, 4),
      ...percages.map((p) => cercle(p.x, p.y, trou(p.d))),
      texte(170 - 12, yJ + 50, 'MISE AU POINT', 3.4),
      texte(6, H - 5, `panneau de commande  ep.${EP_STRUCT}`, 3.4),
    ],
    note: `COTES A VERIFIER SUR TES PIECES avant de lancer la decoupe : `
      + `joystick ${D_JOYSTICK} mm entraxe ${ENTRAXE_JOYSTICK}, boutons `
      + `${D_BOUTON}, molette ${D_MOLETTE}. Ni les joysticks ni les boutons `
      + `d'arcade ne sont normalises. Decouper d'abord ce panneau dans du `
      + `carton et y presenter les vraies pieces.`,
  });
}

/* 5. LA GRILLE DE VENTILATION. Des fentes plutot que des trous ronds : a
      surface ouverte egale elles affaiblissent moins la plaque, et elles se
      coupent plus vite. */
{
  const L = 120, H = 80, FL = 4, FH = 50, PAS = 10;
  const corps = [contourRect(L, H, 3)];
  const percages = [];
  for (let x = 12; x <= L - 12 - FL; x += PAS) {
    corps.push(rect(x, (H - FH) / 2, FL - KERF, FH - KERF, FL / 2));
    percages.push({ x: x + FL / 2, y: H / 2, d: FL, role: 'fente', h: FH });
  }
  const ouverte = percages.length * FL * FH;
  corps.push(texte(6, H - 5, `ventilation  ${(100 * ouverte / (L * H)).toFixed(0)} % ouvert`, 3.4));
  pieces.push({
    nom: 'grille', l: L, h: H, ep: EP_STRUCT, percages, corps,
    note: `${percages.length} fentes, ${(100 * ouverte / (L * H)).toFixed(0)} % de `
      + `surface ouverte. x2 : une en entree BASSE, une en sortie HAUTE — une `
      + `seule grille ne ventile rien, il faut un chemin d'air.`,
  });
}

/* --- verifications ------------------------------------------------------- */
/* Un plan faux ne se voit pas a l'ecran : il se voit apres la decoupe, quand
   la matiere est consommee. D'ou ces verdicts. */

if (DEFAUT === 'serre') {
  /* Le siege plus grand que le guide : la boite tombe au travers. */
  pieces.find((p) => p.nom === 'platine-siege').percages[0].d = D_GUIDE + 2;
} else if (DEFAUT === 'bord') {
  /* Un percage colle au bord : la plaque se fend au serrage. */
  pieces.find((p) => p.nom === 'panneau').percages[0].x = 3;
} else if (DEFAUT === 'chevauche') {
  /* Deux boutons qui se recouvrent. */
  const p = pieces.find((x) => x.nom === 'panneau');
  p.percages.find((q) => q.role === 'pause').x =
    p.percages.find((q) => q.role === 'dash').x + 4;
} else if (DEFAUT === 'xml') {
  /* Un libelle grave avec un chevron brut : le plan devient illisible. */
  pieces.find((p) => p.nom === 'grille').corps.push(
    '  <text x="10" y="10" font-size="3" fill="#0055ff">largeur <valeur lue></text>');
} else if (DEFAUT === 'plateau') {
  pieces.find((p) => p.nom === 'panneau').l = PLATEAU[0] + 50;
}

let echecs = 0;
const dit = (ok, texte) => { if (!ok) echecs++; console.log(`${ok ? 'ok  ' : 'ECHEC'} ${texte}`); };

/* V1 : tout rentre sur le plateau. */
const trop = pieces.filter((p) => p.l > PLATEAU[0] || p.h > PLATEAU[1]);
dit(trop.length === 0,
  `chaque piece tient sur un plateau de ${PLATEAU[0]}x${PLATEAU[1]} mm`
  + (trop.length ? ` — ${trop.map((p) => `${p.nom} ${p.l}x${p.h}`).join(', ')}` : ''));

/* V2 : l'empilement de la boite est coherent. C'est LA verification qui
   compte : guide > boite > siege, sinon la boite tombe ou ne rentre pas. */
dit(D_GUIDE > D_BOITE && D_BOITE > D_SIEGE,
  `la boite s'encastre et repose : guide ${D_GUIDE} > boite ${D_BOITE} > siege ${D_SIEGE}`);
const siegeReel = pieces.find((p) => p.nom === 'platine-siege').percages[0].d;
dit(siegeReel < D_BOITE,
  `le siege porte bien la boite (trou ${siegeReel} < boite ${D_BOITE})`);

/* V3 : le diffuseur est pince des deux cotes. */
dit(D_DIFFUSEUR > D_SIEGE,
  `le diffuseur (${D_DIFFUSEUR}) deborde le trou du siege (${D_SIEGE}) et ne peut pas tomber`);

/* V4 : l'ecart LED-diffuseur est atteint. */
dit(N_ENTRETOISES * EP_STRUCT >= ECART_DIFFUSEUR,
  `l'ecart LED-diffuseur est atteint : ${N_ENTRETOISES} x ${EP_STRUCT} = `
  + `${N_ENTRETOISES * EP_STRUCT} mm >= ${ECART_DIFFUSEUR} mm`);

/* V5 : aucun percage trop pres d'un bord. */
const pres = [];
for (const p of pieces) {
  for (const t of p.percages) {
    const m = Math.min(t.x - t.d / 2, t.y - (t.h || t.d) / 2,
      p.l - t.x - t.d / 2, p.h - t.y - (t.h || t.d) / 2);
    if (m < MARGE_MIN) pres.push(`${p.nom}/${t.role || 'trou'} a ${m.toFixed(1)} mm`);
  }
}
dit(pres.length === 0,
  `aucun percage a moins de ${MARGE_MIN} mm d'un bord`
  + (pres.length ? ` — ${pres.join(', ')}` : ''));

/* V6 : aucun chevauchement entre percages. */
const collisions = [];
for (const p of pieces) {
  for (let i = 0; i < p.percages.length; i++) {
    for (let j = i + 1; j < p.percages.length; j++) {
      const a = p.percages[i], b = p.percages[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < (a.d + b.d) / 2 + 1) {
        collisions.push(`${p.nom} : ${a.role || i} et ${b.role || j} a ${d.toFixed(1)} mm`);
      }
    }
  }
}
dit(collisions.length === 0,
  'aucun percage n\'en recouvre un autre'
  + (collisions.length ? ` — ${collisions.join(', ')}` : ''));

/* V7 : la saignee est effectivement compensee, et dans le BON SENS. Une
   inversion de signe est l'erreur la plus facile a commettre ici, et la plus
   couteuse : tout sort au double du jeu de coupe. */
dit(trou(10) < 10 && contour(10) > 10,
  `la saignee est compensee dans le bon sens (trou 10 -> ${trou(10).toFixed(2)}, `
  + `contour 10 -> ${contour(10).toFixed(2)})`);

/**
 * Valide la structure XML d'un SVG produit.
 *
 * Premiere version de ce verdict : chercher les « < » non suivis d'une
 * lettre. Elle n'attrapait RIEN — pas meme le defaut qui lui avait donne
 * naissance, le libelle « KERF=<valeur lue> », puisque « <v » commence bien
 * par une lettre. Ce que le parseur refuse la, c'est une balise nommee
 * « valeur » portant un attribut « lue » sans valeur.
 *
 * On verifie donc ce qui compte vraiment : que chaque « <...> » est une
 * balise bien formee, et que les balises s'apparient.
 */
function xmlMalForme(src) {
  const maux = [];
  const pile = [];
  const BALISE = /^\/?[a-zA-Z][\w:.-]*(\s+[\w:.-]+\s*=\s*"[^"]*")*\s*\/?$/;
  let i = 0;
  while (i < src.length) {
    const ouvre = src.indexOf('<', i);
    if (ouvre < 0) break;
    /* Commentaires et instructions de traitement : on les saute entiers. */
    if (src.startsWith('<!--', ouvre)) {
      const fin = src.indexOf('-->', ouvre);
      if (fin < 0) { maux.push('commentaire non ferme'); break; }
      i = fin + 3; continue;
    }
    if (src.startsWith('<?', ouvre)) {
      const fin = src.indexOf('?>', ouvre);
      if (fin < 0) { maux.push('instruction non fermee'); break; }
      i = fin + 2; continue;
    }
    const ferme = src.indexOf('>', ouvre);
    if (ferme < 0) { maux.push('balise non fermee'); break; }
    const dedans = src.slice(ouvre + 1, ferme);
    if (!BALISE.test(dedans)) {
      maux.push(`balise invalide : <${dedans.slice(0, 30)}>`);
    } else {
      const nom = dedans.replace(/^\//, '').split(/[\s/]/)[0];
      if (dedans.startsWith('/')) {
        if (pile.pop() !== nom) maux.push(`fermeture depareillee : </${nom}>`);
      } else if (!dedans.trimEnd().endsWith('/')) {
        pile.push(nom);
      }
    }
    /* Le texte entre deux balises ne doit contenir ni « < » (impossible ici,
       on vient de le consommer) ni « & » non echappee. */
    const suivant = src.indexOf('<', ferme);
    const contenu = src.slice(ferme + 1, suivant < 0 ? undefined : suivant);
    if (/&(?!(amp|lt|gt|quot|apos|#\d+);)/.test(contenu)) {
      maux.push('esperluette non echappee dans un contenu');
    }
    i = ferme + 1;
  }
  if (pile.length) maux.push(`balises non fermees : ${pile.join(', ')}`);
  return maux;
}

/* V8 : le XML produit est bien forme. Un libelle mal echappe suffit a faire
   refuser le plan entier par la decoupeuse, et ca ne se voit pas en relisant
   le code qui l'a ecrit. */
const rendus = pieces.map((p) => ({ p, texte: svg(p.l, p.h, p.corps, p.nom) }));
const malForme = [];
for (const { p, texte: t } of rendus) {
  const maux = xmlMalForme(t);
  if (maux.length) malForme.push(`${p.nom} : ${maux[0]}`);
}
dit(malForme.length === 0,
  'les SVG produits sont du XML bien forme'
  + (malForme.length ? ` — ${malForme.join(' | ')}` : ''));

/* --- ecriture ------------------------------------------------------------ */
await mkdir(SORTIE, { recursive: true });
const index = [];
for (const { p, texte: t } of rendus) {
  const nom = `${p.nom}.svg`;
  await writeFile(join(SORTIE, nom), t);
  index.push(`| \`${nom}\` | ${p.l} x ${p.h} mm | ${p.ep} mm | ${p.note} |`);
}

await writeFile(join(SORTIE, 'README.md'), `# Pièces découpées de la borne

**Généré par \`tools/laser.mjs\` — ne pas éditer à la main.** Relancer
\`npm run laser\` après toute modification des cotes.

Saignee compensée : **${KERF} mm**. Si ce n'est pas celle de ta machine,
découpe d'abord \`gabarit-kerf.svg\`, mesure, puis relance avec
\`KERF=<ta valeur> npm run laser\`.

Rouge = coupe, bleu = gravure. Unités : millimètres.

| Fichier | Format | Épaisseur | Rôle |
|---|---|---|---|
${index.join('\n')}

## Ordre de découpe

1. \`gabarit-kerf.svg\` — **d'abord**, pour mesurer la saignée réelle.
2. Relancer \`npm run laser\` avec la valeur mesurée.
3. \`panneau.svg\` **dans du carton**, pour y présenter les vraies pièces
   avant de le découper dans le MDF.
4. Le reste.
`);

console.log('');
console.log(`${pieces.length} pieces ecrites dans ${SORTIE}/ (saignee ${KERF} mm)`);
for (const p of pieces) console.log(`  ${p.nom.padEnd(16)} ${String(p.l).padStart(4)} x ${String(p.h).padStart(3)} mm   ep.${p.ep}`);
console.log('');
if (DEFAUT) {
  const attendu = echecs > 0;
  console.log(attendu
    ? `VERIFICATION DU BANC : le defaut « ${DEFAUT} » a bien ete attrape (${echecs} echec(s)).`
    : `VERIFICATION DU BANC : RATEE — le defaut « ${DEFAUT} » est passe inapercu.`);
  process.exit(attendu ? 0 : 1);
}
console.log(echecs === 0 ? 'tous les verdicts passent.' : `${echecs} verdict(s) en echec.`);
process.exit(echecs === 0 ? 0 : 1);
