# Étape 6 — Assets

La maquette dessine tout **procéduralement** (formes pleines, tramées,
avec halo de phase). Rien n'est un fichier image. Ajouter des assets ne
demandera donc aucune refonte : il suffira de remplacer la fonction de rendu
d'un `kind` par un blit de sprite.

## La chaîne existe

```bash
npm run sheet           # planche de contact : tout, à sa vraie taille
npm run sprites:bake    # toiles de départ éditables → assets/sprites/
npm run sprites:import  # PNG → src/render/sprite-data.js
```

`bake` rend chaque espèce procéduralement à sa taille native et écrit un PNG.
C'est une **toile de départ** : on l'ouvre dans Aseprite, on retouche, on
réimporte. Une image de référence déposée au même nom marche aussi bien.

`import` réduit par moyenne de surface, quantifie sur 11 couleurs plus la
transparence, et sort des pixels indexés encodés en chaîne. Un sprite de 16×16
pèse une centaine d'octets ; les treize actuels tiennent en 5 Ko — donc pas de
requête, pas d'asynchrone, la page reste un seul fichier déployable.

`src/render/sprite-data.js` n'est **pas activé par défaut**. Une ligne dans
`src/main.js` l'allume :

```js
import './render/sprite-data.js';
```

Le registre est consulté par `drawOrganism` : **une espèce sans sprite retombe
sur sa forme procédurale**. Les assets arrivent donc un par un, et on peut en
retirer un qui déçoit.

Les conventions détaillées vivent dans le skill `.claude/skills/sprites/`.

## Le générateur sert aux cartes, pas aux sprites

Mesuré, pas supposé (voir `.claude/skills/sprites/`) :

| Cible | Taille | Verdict |
|---|---|---|
| Sprites in-game, silhouette **complexe** | 26 – 34 px | **Gain réel, à condition de verrouiller la palette** (`input_palette`). Sans elle, le liseré hors palette fusionne les cellules |
| Sprites in-game, silhouette **lisse** | 4 – 20 px | Le générateur n'apporte rien : une capsule gagne un point blanc |
| Sprites d'organismes **déformables** (amibe, chaînette) | — | Refuser : le sprite tue l'animation procédurale |
| **Vignettes de cartes d'évolution** | 96 px, en **DOM** | **C'est là qu'il brille.** Tramage, liserés, reflets — très au-dessus du procédural |
| Écran-titre, portraits de boss | libre | Même logique |

La contrainte n'était pas le sujet, mais la taille.

```bash
node tools/sprites.mjs palette   # palette du jeu -> assets/reference/palette.png
node tools/rd.mjs gen carte "<prompt>" --w 96 --h 96 --out assets/cards/<id>.png
```

**Écrire les prompts en objet, pas en scène.** Le modèle a un seul fort a
priori pour « microbe » — une boule hérissée — et toute demande de *relation*
entre deux objets y retombe. Quatre vignettes sur six ont été retenues.

`src/ui/overlay.js` charge `assets/cards/<id_evolution>.png` et retire
l'image d'elle-même si elle manque : les 55 vignettes peuvent arriver une
par une.

## Sprite ou procédural : ce qu'on perd

Le rendu par sprite applique la rotation, pas les déformations.

| Morphologie | Perte si sprite |
|---|---|
| `rod`, `rodlong`, `coccus`, `diplo`, `spore`, `phage` | **aucune** — y aller |
| `chain`, `cluster` | l'ondulation, la grappe qui respire |
| `amoeba` | **forte** — les pseudopodes. Garder le procédural |

Un sprite pour une amibe est une régression. Un sprite pour un boss `rod` est
un gain net.

## Contraintes de production

Le tampon interne fait **256 × 352 pixels** et le champ un disque de
**104 px de rayon**. À cette échelle :

| Organisme | Taille à l'écran | Budget sprite |
|---|---|---|
| Coque (lactocoque) | 3–4 px | pas de sprite, procédural |
| Bacille (*E. coli*) | 8 × 3 px | 8 × 8 |
| Levure | 10 × 8 px | 16 × 16 |
| Phage | 6 × 8 px | 8 × 16 |
| Joueur | 7 × 5 px | 16 × 16, 4 orientations |
| Mini-boss | 26 px | 32 × 32 |
| Boss | 44 px | 48 × 48 |

En dessous de 5 px, un sprite dessiné à la main **n'apportera rien** : la
forme procédurale est plus lisible car elle reste nette à toute échelle.
Concentrer l'effort sur : **joueur, boss, mini-boss, levures, phages, amibe**.
Ça fait une dizaine de sprites pour couvrir 90 % de l'impact visuel.

## Règle de lisibilité : la forme porte l'espèce, la couleur porte la menace

C'est la contrainte la plus importante pour qui dessinera les sprites.

La **morphologie** est déjà le vrai marqueur microbiologique : un bacille
n'est pas un coque, une chaînette n'est pas une grappe. Elle suffit à dire
*qui* est là. La **teinte** est donc libérée pour dire *ce qui va arriver* :

| Rôle | Teinte | Exemples |
|---|---|---|
| `chaff` | vert | *L. lactis*, *Leuconostoc*, *E. coli* |
| `runner` | or | *P. fragi* |
| `tank` | violet | *B. cereus* |
| `ranged` | rose | phage 936 |
| `splitter` | havane | *K. marxianus* |
| `denier` | cyan | *G. candidum* |
| `predator` | bleu | *Acanthamoeba* |
| boss | rouge | *S. aureus*, *Listeria* |

Deux exceptions, parce que ce sont des cibles particulières : l'**endospore**
est blanche (elle doit sauter aux yeux, c'est la seule cible qui exige un tir
net) et le **décor** est gris (il doit s'effacer).

Sans cette règle, trois espèces Gram + différentes sortaient du même vert et
le champ devenait illisible en pleine vague — constaté à l'écran, pas supposé.

**Un sprite doit donc respecter la teinte de son rôle**, pas celle de la
coloration de Gram de l'espèce.

## Palette

`src/data/palette.js` définit une palette par matrice, construite pour le
**fond noir** (voir `06-heritage-wet-mount.md`) : organismes lumineux sur noir,
joueur vert (vivant), acides aminés ambrés. Ce n'est **pas** la
palette d'état frais de `wet-mount.html`, qui serait illisible ici.
Un sprite doit s'y tenir : **12 couleurs par matrice**, pas plus.

## Sur Pixellab

Pour des formes aussi petites, une génération automatique produira presque
certainement du bruit : à 8 × 8 px, chaque pixel est une décision. Mon
conseil : **dessine à la main** le joueur et les deux boss (c'est là que ça
se voit), et laisse le procédural pour la piétaille. Si tu testes Pixellab,
vise les gros éléments : boss, amibe, SCOBY, décor de conduite.

## Ordre suggéré

1. Joueur (4 orientations + animation de division) — c'est ce qu'on regarde
   tout le temps.
2. Boss *Listeria* et mini-boss *S. aureus*.
3. Globules gras du lait cru (décor qui remplit le champ).
4. Levures et phages.
5. Le reste, si le besoin s'en fait sentir.
