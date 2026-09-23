# Cell Dungeon

### ▶ [Jouer maintenant](https://microbiologames.github.io/Cell-dungeon/)

`https://microbiologames.github.io/Cell-dungeon/` — servi par GitHub Pages
depuis la branche `claude/epic-carson-ryenav`, à la racine. Rien à installer :
le dépôt *est* le site. **Le C majuscule compte** : l'URL en minuscules
renvoie 404.

Roguelite d'arène microbiologique. Vous êtes une **cellule** observée au
microscope, vous tirez votre propre toxine, vous absorbez les acides aminés de
vos victimes et vous volez leurs gènes.

**Quatre souches jouables** : *L. plantarum* (la référence, acide lactique),
*B. cereus* (céréulide, **sporule au lieu de mourir**), *S. aureus*
(alpha-hémolysine, **amas doré qui se déconstruit avec les PV**) et
*S. cerevisiae* (éthanol, **bourgeonne et renaît en perdant la moitié de son
génome**). Elles se choisissent en nageant dans leur colonie, au lobby —
`docs/08-especes-jouables.md`.

**État : maquette jouable.** Tout est dessiné procéduralement, avec quelques
sprites pour les silhouettes que le procédural ne rend pas.

**Quatre matrices jouables** — le **lait cru** (goutte, fond clair), la
**conduite** (couloir d'acier, courant, biofilm, NEP), le **kombucha** (jarre,
bulles de CO₂ qui brassent, moisissures-baleines) et le **levain** (pâte
dense, labyrinthe de grains d'amidon) — plus un **lobby** et un **bestiaire
vivant**. Le **sang** est spécifié dans `docs/01-matrices.md` et délibérément
gardé pour la fin : ce n'est pas une goutte mais un réseau vasculaire.

La **bande son est générative et adaptative**, entièrement synthétisée en Web
Audio : aucun fichier, aucune bibliothèque. Elle s'écrit et se règle dans un
studio dédié (`docs/07-son.md`).

Pour travailler sur le projet, commencer par **`CLAUDE.md`** : conventions,
invariants, bancs de mesure et chantiers ouverts.

## Le lobby et le bestiaire

On ne démarre pas sur un menu : on nage dans une **boîte de Petri** et on
choisit sa matrice en restant dans un puits. Les puits verrouillés sont
grisés, les autres montrent leur propre milieu et trois organismes de leur
flore qui dérivent dedans.

Le puits central ouvre le **bestiaire vivant** : chaque espèce dérive sur
place avec *sa* motilité — le lactocoque tremble, *Escherichia* file en ligne
brisée, *Listeria* culbute. C'est déjà la moitié de l'information. En
s'approchant, l'espèce se détache et ses caractéristiques s'affichent, avec
son fondement microbiologique. Les neutres y sont aussi.

## Jouer

Page statique, aucune compilation. En local :

```bash
npm run serve     # puis http://localhost:8080
```

Sur GitHub Pages : activer Pages sur la branche, racine du dépôt.

### Commandes

| | Clavier | Tactile |
|---|---|---|
| Déplacement | `WASD` / `ZQSD` / flèches | manche virtuel, moitié gauche |
| **Mise au point** | molette, ou `R` / `F` | glissement vertical, moitié droite |
| Dash (si pili de type IV) | `Espace` | — |
| Pause | `Échap` / `P` | — |
| Couper le son | `M` | — |

Les touches sont lues par position physique (`event.code`), donc AZERTY et
QWERTY fonctionnent sans réglage.

## Le personnage : quatre souches, un même moteur

La souche décide de quatre choses et de rien d'autre : les stats de base, la
toxine, la morphologie et la **caractéristique unique**. L'inertie de nage, la
mise au point, les acides aminés et le catalogue d'évolutions sont communs —
une souche est un jeu de nombres et un trait, pas un second personnage à
maintenir. Le détail, les mesures et les évolutions réservées sont dans
[`docs/08-especes-jouables.md`](docs/08-especes-jouables.md).

Ce qui suit décrit la souche de référence, et vaut pour les quatre corps.

### Le bacille lactique

Vous êtes un **bacille lactique**, pas un coque. Ce n'est pas un choix
esthétique : un *Lactobacillus* fait réellement 2 à 8 µm de long pour 0,5 à
1 µm de large, là où un *Lactococcus* fait 0,5 à 1,5 µm. Le personnage a donc
un **axe**, et c'est ce qui rend ses animations possibles :

- il se **dandine** en nageant, d'une onde qui court de la tête à la queue et
  dont l'amplitude suit l'effort ;
- il **vire** au lieu de pivoter : le cap a de l'inertie, et la queue chasse
  vers l'extérieur du tournant. La vitesse de virage est celle de la stat
  **agilité** — donc les évolutions de flagellation la règlent déjà ;
- il se **cambre** quand on change de plan focal — monter ou descendre dans
  l'épaisseur de la préparation se lit comme un corps qui s'arque ;
- ses **flagelles** ont leur propre inertie. À très bas nombre de Reynolds un
  filament tracté suit le chemin de sa base : le flagelle est donc la mémoire
  du cap récent de la cellule, comme la queue d'un serpent. Il se rassemble en
  faisceau quand on pousse, balaie en retard quand on vire, et à l'arrêt
  brutal il continue sur sa lancée, se déphase, puis se recale.

Une bactérie lactique n'est pas mobile. Celle-ci l'est parce qu'elle vole des
gènes à tout le monde, flagelline comprise — c'est le sujet du jeu.

## Ce qu'on voit au microscope

Le rendu ne cherche pas le joli pour le joli : chaque effet est un phénomène
réel, et c'est ce qui le rend lisible.

- **Halo de contraste de phase.** Un liseré clair autour de chaque objet. Le
  bord déphase la lumière plus fort que le centre : l'anneau de diffraction
  ressort. C'est l'artefact le plus connu de la technique.
- **Relief.** Paroi, cytoplasme décalé vers la lumière, reflet spéculaire. La
  lampe est fixe en haut à gauche pour tout le champ. Un corps allongé s'ombre
  le long de son arête, comme un cylindre.
- **Granulations réfringentes.** Les inclusions cytoplasmiques renvoient la
  lumière : elles sont claires, pas sombres.
- **L'endospore se voit.** Un *B. cereus* qui sporule montre sa spore claire
  par transparence — c'est le signe qui annonce la vague de spores.
- **La flagellation est documentée ou absente.** Voir `docs/02-bestiaire.md`.

## Le décor pousse

Les organismes neutres ne se traversent pas quand ils sont **dans votre
plan** : ce sont des obstacles. La séparation est pondérée par la masse, prise
en volume, donc une cellule somatique de dix-huit pixels ne s'écarte pas
poliment — elle bloque, et vous glissez le long. Hors de votre plan, elle
n'existe pas : la mise au point décide si un obstacle est là.

## La bande son est générée, pas jouée

Aucun fichier audio : tout est synthétisé au moment du jeu et assemblé selon
l'état de la partie. **Drum and bass à grain chiptune** dans les matrices,
**drone lent et réverbéré** dans le lobby et le bestiaire.

Le moteur **observe** l'état au lieu de se le faire pousser — même convention
que le rendu. Ajouter une matrice ne demande donc aucun câblage audio.
Détail dont je suis content : regarder loin de son propre plan **ouate** le
son exactement comme ça floute l'image, parce que la mise au point pilote le
passe-bas master.

Quatre canaux permanents comme une puce 8 bits, ce qui plafonne la polyphonie
par construction. Zéro dépendance, zéro asset. Voir `docs/07-son.md`.

Touche **M** pour couper, **L** pour l'overlay de vérification.

## La mécanique signature : la mise au point

Chaque organisme a une profondeur `z`. Vous réglez votre plan focal.

- Vos dégâts sont **proportionnels à la netteté** de la cible : l'acide diffuse
  mal hors du plan.
- Le tir automatique vise **le plus net et le plus proche** — donc régler la
  mise au point, c'est choisir sa cible.
- Seuls les mobs **dans votre plan** peuvent vous toucher.
- Les mobs apparaissent **hors plan** et dérivent vers vous : regarder loin,
  c'est voir la vague arriver et la ramollir avant l'impact, au prix de taper
  mou sur ce qui vous colle.
- Les **phages** ne descendent jamais dans votre plan. Ils vous forcent la main.

C'est le « saut » de ce jeu : dans un bouillon il n'y a pas de gravité, donc
l'axe Z remplace la verticalité.

Dans la conduite, la profondeur sert une deuxième fois : les **plaques de
biofilm** vivent à `z = +0.55`, contre l'acier. Il faut descendre la mise au
point pour les voir, et donc pour les détruire.

## La conduite : un couloir, pas une arène

La deuxième matrice change la forme du jeu, pas seulement son décor.

- **L'arène est un tube** (±1400 px en X, ±112 px en Y). On n'y tourne pas
  autour de la horde, on lui fait face.
- **Le courant est laminaire** : maximal au centre, nul contre la paroi. La
  couche limite est un vrai refuge, et le courant emporte aussi vos gouttes
  d'acide et les acides aminés libres.
- **Les plaques de biofilm** émettent indéfiniment. Les détruire tarit la
  source — mais elles se reforment en 45 s si un *P. aeruginosa* survit à
  côté : c'est lui qui sécrète l'alginate. Tuer la plaque ne suffit pas, il
  faut tuer la cause.
- **Le Nettoyage En Place** traverse le couloir toutes les 150 s, et les
  biocides **tournent** : soude, acide nitrique, hypochlorite, acide
  peracétique. Chacun a un contre différent — s'abriter, `Tolérance à
  l'acide`, `Catalase`, `Catalase` **et** `Efflux`. C'est là que le build
  monté dans le lait cru se révèle bon ou mauvais. La flore y passe aussi :
  bien placé, le NEP est une arme.

## Le pH est un terrain

Chaque goutte d'acide se **diffuse en vol** : elle part concentrée et rapide,
s'étale, ralentit, frappe de plus en plus large et de moins en moins fort,
puis dépose sa charge. Le pH n'est pas un compteur global mais une **carte**.

Arroser une zone la transforme : les coliformes y ralentissent sous pH 5,6,
les *Pseudomonas* y brûlent sous 5,2, et votre bactérie lactique — qui est
chez elle dans l'acide — y gagne en cadence. Le `Senseur de pH` révèle la
carte en fausses couleurs. Fabriquer son terrain devient une tactique.

## Documentation de conception

| Document | Contenu |
|---|---|
| [`docs/00-concept.md`](docs/00-concept.md) | Pitch, piliers, direction artistique |
| [`docs/01-matrices.md`](docs/01-matrices.md) | Les 4 matrices : lait cru, conduite, kombucha, sang |
| [`docs/02-bestiaire.md`](docs/02-bestiaire.md) | Espèces, capacités, et le fondement réel de chacune |
| [`docs/03-evolutions.md`](docs/03-evolutions.md) | 49 évolutions, raretés, les 6 voies implicites |
| [`docs/04-vagues-equilibrage.md`](docs/04-vagues-equilibrage.md) | Courbes, invariants, vérification |
| [`docs/05-roadmap-assets.md`](docs/05-roadmap-assets.md) | Où brancher les sprites, contraintes de taille |
| [`docs/06-heritage-wet-mount.md`](docs/06-heritage-wet-mount.md) | Audit critique de ce qu'on reprend de `wet-mount.html` |
| [`docs/07-son.md`](docs/07-son.md) | La bande son générative, le studio, les presets adoptés |
| [`docs/08-especes-jouables.md`](docs/08-especes-jouables.md) | Les 4 souches jouables, leurs toxines, leurs caractéristiques uniques |

## Règle de véracité

Un mob ne reçoit **que** des capacités documentées chez l'espèce réelle
(la coagulase est à *S. aureus*, pas à *E. coli*). Le joueur, lui, ment autant
qu'il veut — et c'est diégétique : transfert horizontal de gènes, plasmides,
transduction phagique. En fin de run il ne ressemble plus à rien de connu,
et la biologie réelle l'explique.

## Vérification

```bash
npm run balance          # invariants d'equilibrage, 400 runs (modele abstrait)
npm run playtest         # la VRAIE boucle de jeu, 3 runs de 12 min sans rendu
npm run smoke            # chargement, jeu, cartes, tactile
npm run especes          # les 4 souches : stats, tirages cloisonnes, toxines, traits
npm run visual           # captures : portrait, paysage, vue pH, boss
npm run sheet            # planche de contact des organismes
npm run sprites:bake     # toiles de depart editables -> assets/sprites/
npm run sprites:import   # PNG -> src/render/sprite-data.js
```

`balance` sort en code 1 si le plateau de difficulté ou le décrochage final
sont rompus. Il partage ses constantes avec le jeu : il n'existe pas de second
jeu de nombres à tenir à jour.

`especes` sort en code 1 si une souche dérive : DPS hors bande, carte réservée
qui fuit chez une autre souche, toxine qui perd sa chimie, caractéristique
unique qui ne se déclenche plus. Il déclenche chaque trait **dans la vraie
boucle de jeu** — un trait qui ne se déclenche jamais ne lève aucune exception
et ne se voit sur aucune capture.

## Structure

```
index.html            page unique, zéro build
src/core/pixel.js     tampon 256x352, 8 calques de profondeur, flou séparable
src/core/input.js     clavier par position physique + tactile
src/core/font.js      fonte bitmap 3x5
src/data/             matrices, bestiaire, évolutions, souches jouables, palettes
src/game/             stats, joueur, entités, directeur de vagues, orchestration
src/render/           champ, organismes procéduraux, HUD
src/ui/overlay.js     menus et cartes d'évolution (DOM)
tools/                simulateur d'équilibrage, tests navigateur
```

## Ce qui reste à faire

- Le sang (spécifié dans `docs/01-matrices.md`, gardé pour la fin)
- Vignettes de cartes pour les six évolutions réservées aux souches
- Assets (`docs/05-roadmap-assets.md`) — le rendu procédural est le repli
- Son
