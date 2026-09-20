# Cell Dungeon

Roguelite d'arène microbiologique. Vous êtes une **bactérie lactique** observée
au microscope, vous tirez de l'acide lactique, vous absorbez l'ADN de vos
victimes et vous volez leurs gènes.

**État : maquette jouable sans assets.** Tout est dessiné procéduralement.
La matrice 1 (lait cru) est complète ; les matrices 2 à 4 sont spécifiées
mais pas implémentées.

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

Les touches sont lues par position physique (`event.code`), donc AZERTY et
QWERTY fonctionnent sans réglage.

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

## Règle de véracité

Un mob ne reçoit **que** des capacités documentées chez l'espèce réelle
(la coagulase est à *S. aureus*, pas à *E. coli*). Le joueur, lui, ment autant
qu'il veut — et c'est diégétique : transfert horizontal de gènes, plasmides,
transduction phagique. En fin de run il ne ressemble plus à rien de connu,
et la biologie réelle l'explique.

## Vérification

```bash
npm run balance   # invariants d'equilibrage, 400 runs simules
npm run smoke     # chargement, jeu, cartes, tactile (Playwright)
npm run visual    # captures : champ net, champ profond, boss
```

`balance` sort en code 1 si le plateau de difficulté ou le décrochage final
sont rompus. Il partage ses constantes avec le jeu : il n'existe pas de second
jeu de nombres à tenir à jour.

## Structure

```
index.html            page unique, zéro build
src/core/pixel.js     tampon 256x352, 8 calques de profondeur, flou séparable
src/core/input.js     clavier par position physique + tactile
src/core/font.js      fonte bitmap 3x5
src/data/             matrices, bestiaire, évolutions, palettes
src/game/             stats, joueur, entités, directeur de vagues, orchestration
src/render/           champ, organismes procéduraux, HUD
src/ui/overlay.js     menus et cartes d'évolution (DOM)
tools/                simulateur d'équilibrage, tests navigateur
```

## Ce qui reste à faire

- Matrices 2 à 4 (spécifiées dans `docs/01-matrices.md`)
- Assets (`docs/05-roadmap-assets.md`) — le rendu procédural est le repli
- Son
