/* ---------------------------------------------------------------------------
   Genere les vignettes de cartes d'evolution manquantes.

   Regle apprise a l'usage : ecrire les prompts en OBJET, jamais en scene.
   Le modele a un seul fort a priori pour "microbe" — une boule herissee — et
   toute demande de RELATION entre deux objets y retombe.

     node tools/cards-batch.mjs [n]      n = nombre maximal de vignettes
--------------------------------------------------------------------------- */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const PAL = 'assets/reference/palette.png';
const SUFFIX = ', dark field microscopy, pixel art game card icon, centered, single subject';

/* Par ordre de priorite : legendaires, epiques, rares, puis les peu communes
   et communes les plus marquantes. */
const PROMPTS = {
  symbiose: 'three identical small bacteria arranged in a tight triangle, glowing green, consortium',
  immersion: 'a microscope objective lens seen from below, concentric glass rings, a drop of oil beneath',
  t3ss: 'a molecular syringe, needle complex with a broad base and a long thin needle',
  hypermut: 'a DNA double helix with several mismatched garish rungs, unstable, sparking',
  sapi: 'a circular island of DNA detaching from a larger chromosome ring',
  nanotubes: 'two bacteria linked by several thin straight tubes, cytoplasm flowing through',
  predation: 'one very small bacterium half buried inside the wall of a much larger one',
  endolysine: 'a bacterium bursting out through a ruptured vacuole membrane',
  phagetemp: 'a bacteriophage with its DNA strand integrated into a bacterial chromosome ring',
  vbnc: 'a dormant shrunken bacterial cell with a thick dark wall, curled inward, asleep',
  betalactamase: 'a broken beta lactam ring molecule snapped in two, chemical structure',
  efflux: 'a membrane pump channel spanning a cell wall, ejecting small particles outward',
  quorum: 'many tiny signalling molecules converging on one bacterium in the centre',
  biofilm: 'a bacterium encased in a thick glassy dome of slime, sessile',
  phase: 'a phase contrast annulus, a bright ring of light around a dark disc',
  sidero: 'a claw shaped chelator molecule gripping a glowing iron atom',
  phsense: 'a two component sensor protein crossing a membrane, proton gradient arrows',
  nisine: 'a short peptide chain punching a pore through a bacterial cell wall',
  hetero: 'a bacterium releasing a lactate droplet, a carbon dioxide bubble and an ethanol droplet',
  gelatinase: 'an enzyme molecule dissolving a lump of gelatin into threads',
  coagulase: 'a dense tangled mesh of fibrin threads forming a clot ball',
  capsule: 'a bacterium wrapped in a thick smooth translucent polysaccharide capsule',
  pili: 'a bacterium with several short retractable hair like pili on one side',
  atr: 'a bacterium with a reinforced armoured wall, acid droplets beading off it',
  eps: 'a bacterium trailing a long ribbon of viscous exopolysaccharide slime',
  dof: 'an iris diaphragm, overlapping metal blades forming an aperture',
  transposon: 'a small DNA segment jumping between two chromosome strands, in flight',
  holine: 'a bacterial membrane perforated by many small holes, contents escaping',
  mcp: 'a bacterium studded with many long antenna like chemoreceptors',
  protease: 'a scissor shaped enzyme cleaving a protein chain into fragments',
  lipase: 'an enzyme splitting a fat droplet into free fatty acid chains',
  catalase: 'an enzyme converting hydrogen peroxide into oxygen bubbles',
  cody: 'a regulator protein releasing its grip on a DNA operator site',
  autolysine: 'a bacterial cell wall being chewed open from the inside by its own enzyme',
  ldh: 'a compact globular enzyme molecule with a bound cofactor, lactate dehydrogenase',
  atpase: 'a rotary molecular motor embedded in a membrane, turbine shaped',
  ribo: 'several ribosomes strung along a messenger RNA strand, a polysome',
  flagelle: 'a single long corkscrew bacterial flagellum with its basal motor',
  peptido: 'a thick cross linked mesh of peptidoglycan strands, armour like',
  fluidite: 'a lipid bilayer patch with loosely packed kinked fatty acid tails',
  opp: 'a membrane transporter channel pulling a short peptide chain inside',
  che: 'a bacterium swimming up a gradient of dots, denser toward the top',
  betaine: 'a small zwitterionic molecule, glycine betaine, crystalline',
  sec: 'a membrane translocon channel threading a protein chain through',
  diffusion: 'a droplet of acid spreading into faint concentric rings',
  acidloc: 'a bacterium surrounded by a tight halo of acid, etching its surroundings',
  reca: 'a repair protein filament coating a damaged DNA strand',
  cardio: 'a four tailed cardiolipin phospholipid molecule',
  homo: 'a straight single arrow metabolic pathway ending in one lactate molecule',
  peritriche: 'a bacterium covered with flagella on every side, peritrichous',
  polaire: 'a bacterium with a dense tuft of flagella at one pole only',
  glycolyse: 'a cascade of linked sugar molecules flowing down into lactate',

  /* --- reservees aux souches jouables ---------------------------------- */
  /* Meme regle : un OBJET. Et une contrainte de plus, propre a ce lot :
     aucune des six ne doit ressembler a une carte deja livree, sinon le
     joueur croit tirer deux fois la meme. C'est ce qui ecarte l'image
     evidente pour `agr` — un amas entoure de molecules de signal serait
     `quorum` redessine. On prend donc la MOLECULE que le locus detecte,
     le peptide auto-inducteur, qui n'existe nulle part ailleurs. */
  sporeplus: 'a rod shaped bacterium containing several bright refractile endospores lined up inside it',
  /* Reformules apres un premier echec, et pour la meme raison a chaque fois :
     la premiere version decrivait une RELATION. « une spore qui s'ouvre ET une
     cellule qui en sort » a donne un escargot orange a tentacules ; « un fuseau
     mitotique avec les chromosomes alignes » a donne des rayures verticales.
     Reecrites en UN objet, avec son detail identifiant comme adjectif.

     Bilan : `segregation` est passe du bruit a un X rose net, lisible a 48 px.
     `germination` NON — la reformulation a donne la boule herissee, l'a priori
     documente du modele, avec une fissure dessus. Lisible en grand, une
     pastille orange a 48 px. Pas livree : 5 vignettes sur 6.
     Ce qui manque au modele ici n'est pas la formulation mais le sujet — une
     spore qui germe n'a aucun a priori, et l'etat « entre deux » est par
     nature une relation. A dessiner a la main si on y tient. */
  germination: 'a bacterial endospore, thick layered coat, one deep crack splitting its shell',
  multiplan: 'a compact grape like cluster of round golden cocci, dividing in perpendicular planes',
  agr: 'a small cyclic peptide ring molecule closed by a sulphur bond, glowing, autoinducing peptide',
  segregation: 'a single condensed X shaped chromosome, two chromatids joined at a central waist, symmetrical',
  precoce: 'a budding yeast cell with one large swelling daughter bud at its pole',
};

const limit = Number(process.argv[2] || 999);
let n = 0;
for (const [id, body] of Object.entries(PROMPTS)) {
  if (n >= limit) break;
  const out = `assets/cards/${id}.png`;
  if (existsSync(out)) { console.log(`${id.padEnd(14)} deja present`); continue; }
  process.stdout.write(`${String(++n).padStart(2)} ${id.padEnd(14)} `);
  try {
    const r = execFileSync('node', [
      'tools/rd.mjs', 'gen', id, body + SUFFIX,
      '--w', '96', '--h', '96', '--palette', PAL, '--out', out,
    ], { encoding: 'utf8', timeout: 300000 });
    const m = r.match(/solde restant ([\d.]+)/);
    console.log(m ? `ok, solde ${m[1]}` : 'ok');
  } catch (e) {
    console.log('ECHEC ' + String(e.stdout || e.message).slice(0, 120).replace(/\n/g, ' '));
  }
}
console.log(`\n${n} vignette(s) demandee(s).`);
