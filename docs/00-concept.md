# Cell Dungeon — Concept

## Pitch

Vous êtes une **bactérie lactique** observée au microscope. Vous survivez à des vagues
de micro-organismes dans des **matrices réelles** (lait cru, conduite industrielle,
kombucha, sang), vous tirez de l'**acide lactique**, et vous digérez les **acides aminés**
de vos victimes pour **muter**.

Roguelite d'arène, vue de dessus, tir automatique, run de 12 minutes par matrice.

Les quatre matrices ne sont pas quatre décors : chacune change la **forme de
l'espace** et le rôle de l'axe Z. Le lait cru est une goutte ouverte. La
conduite est un **couloir** où l'on se déplace surtout de gauche à droite et
où Z devient la stratification du biofilm. Le kombucha est une jarre où Z
porte le gradient d'oxygène et où l'arène **rétrécit**. Le sang est un flux
pulsatile.

## Les trois piliers

### 1. La mise au point est une arme

C'est la mécanique signature. L'écran est le champ d'un microscope : **un disque net
entouré de noir**. Chaque organisme possède une profondeur `z ∈ [-1 ; +1]`. Le joueur
règle son plan focal `f ∈ [-1 ; +1]` (molette / R-F / glissement tactile).

```
netteté(e) = clamp( 1 - ( |z_e - f| / profondeur_de_champ )² , 0, 1 )
```

Conséquences de gameplay :

| Effet | Règle |
|---|---|
| Dégâts infligés | `× (0.15 + 0.85 × netteté)` — l'acide diffuse mal hors du plan |
| Ciblage automatique | score `= 0.62 × netteté + 0.38 × proximité` |
| Contact / dégâts reçus | uniquement si `|z_e| < 0.18` (le mob est « dans votre plan ») |
| Anticipation | les mobs arrivent à `|z| ≈ 0.6-1.0` et **dérivent** vers `z = 0` |

Le joueur arbitre donc en permanence : **regarder loin** (voir la vague arriver,
la ramollir avant l'impact, mais taper mou sur ce qui le colle) ou **rester à plat**
(dégâts maximaux sur le contact immédiat, mais aveugle à ce qui tombe).
Certains mobs (les phages) **restent hors plan** et tirent de loin : ils forcent
le changement de mise au point. C'est le « saut » de ce jeu : pas de gravité dans
un bouillon, donc l'axe Z remplace la verticalité.

### 2. Évolution par acides aminés, pas par boutique

Tuer libère des **acides aminés**. On les absorbe, on monte de niveau, on
choisit **1 évolution parmi 3** tirées selon leur rareté. Les bactéries
lactiques sont auxotrophes pour la plupart des acides aminés : les prélever
dans le milieu est littéralement ce qui les fait croître.

Le rayon de captation est court au départ : il faut **entrer dans la foule**
pour se nourrir.
Un **plasmide** (drop rare) accorde une compétence **immédiatement**, sans niveau.

Les évolutions ne changent pas forcément le skin : elles changent les **stats** et
créent des **classes implicites** (voir `03-evolutions.md`). Le joueur n'est jamais
enfermé dans une classe : il est juste récompensé s'il en suit une.

### 3. Microbiologie honnête, gameplay d'abord

Règle de production :

- **Les mobs ne mentent jamais.** Un mob ne reçoit une capacité que si l'espèce la
  possède réellement et de façon documentée. *S. aureus* a la coagulase, pas *E. coli*.
- **Le joueur ment autant qu'il veut**, et c'est diégétique : transfert horizontal
  de gènes (plasmides conjugatifs, transduction par phage, îlots de pathogénicité,
  transformation). À la fin d'un run, le joueur ne ressemble plus à rien de connu —
  **c'est le but**, et c'est justifié par la biologie réelle du HGT.
- **Le vocabulaire reste juste.** Les procaryotes ne phagocytent pas : la phagocytose
  est une capacité **ennemie** (neutrophiles, macrophages, amibes). Voir la note
  « Phagocytose vs prédation » dans `03-evolutions.md`.

## Direction artistique

- Pixel art minimaliste et un peu goofy, 2D vue de dessus.
- **Microscopie sur fond noir** avec marquage vital à l'orange d'acridine :
  organismes lumineux sur fond parfaitement noir. Ce n'est pas un choix
  esthétique arbitraire, c'est ce qui rend le jeu lisible **et** ce qui donne
  au HUD ses zones noires naturelles. Voir `06-heritage-wet-mount.md`.
- **Flou de profondeur par calques** (8 calques, flou séparable en deux passes),
  **halo de contraste de phase** sur les objets hors plan : ils brillent au
  lieu de s'effacer, donc une menace floue reste lisible.
- Tramage **ordonné de Bayer**, jamais de bruit aléatoire : pas de grésillement
  quand les objets traversent le champ.
- Mouvement brownien d'amplitude `1/√taille` (Stokes-Einstein), dérive de
  courant, débris de matrice générés par hachage de coordonnées.
- Teinte par matrice sur le fond noir : lait cru verdâtre, conduite cyan acier,
  kombucha ambre, sang magenta sombre.

## Déviations assumées

Deux endroits où le jeu ment sciemment, parce que la simulation honnête
serait mauvaise à jouer. Ils sont listés ici plutôt que cachés :

**L'inertie.** À l'échelle d'un procaryote, le nombre de Reynolds est si bas
qu'il n'y a aucune inertie : une bactérie qui cesse de pousser s'arrête en une
fraction de son diamètre. Un déplacement sans inertie colle à la touche et ne
procure aucune sensation. On donne donc à la cellule une mise en train et une
glisse — et on s'en sert : la **flagellation** pilote ce réglage.

| Profil | Réel | Au toucher |
|---|---|---|
| Péritriche (*E. coli*) | flagelles sur toute la surface | vif, tourne sec, pointe plus basse |
| Polaire en touffe (*Pseudomonas*) | lophotriche à un pôle | lance fort, vire mal |

C'est le principal arbitrage de pilotage, et il est vrai dans son principe :
une touffe polaire pousse fort en ligne droite et manœuvre mal.

**L'échelle.** Voir `06-heritage-wet-mount.md` : les tailles sont
relativement plausibles, jamais littérales.

## Plateformes

Page statique, zéro build, GitHub Pages. Détection automatique :

- **Clavier/souris** : déplacement `WASD`/`ZQSD`/flèches (lecture par `event.code`,
  donc AZERTY et QWERTY marchent sans réglage), mise au point molette ou `R`/`F`,
  dash `Espace`, pause `Échap`.
- **Tactile** : joystick virtuel à gauche, molette de mise au point à droite,
  cartes d'évolution au doigt.

## État d'avancement

| Étape | Statut |
|---|---|
| 1. Définition des matrices | ✅ `01-matrices.md` |
| 2. Bestiaire | ✅ `02-bestiaire.md` |
| 3. Évolutions + raretés | ✅ `03-evolutions.md` |
| 4. Vagues + équilibrage | ✅ `04-vagues-equilibrage.md` |
| 5. Maquette jouable sans assets | ✅ `src/` — matrice 1 (lait cru) complète |
| 6. Assets | ⏳ `05-roadmap-assets.md` |

Audit critique de l'héritage de `wet-mount.html` : `06-heritage-wet-mount.md`.
