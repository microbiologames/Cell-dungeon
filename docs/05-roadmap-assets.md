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

---

## Sprites adoptés (état au 20/09/2026)

`assets/sprites/` se **cure à la main** : on n'y copie que ce qui bat la forme
procédurale à la taille réelle du jeu. Une espèce sans sprite retombe sur sa
forme procédurale, donc les assets arrivent un par un sans rien casser.

| id | Taille | Pourquoi adopté |
|---|---|---|
| `staph` | 28 px | Grappe de sept coques : volume et séparations que le procédural ne donne pas |
| `listeria` | 34 px | Gain faible (un reflet) mais aucune perte : pas d'animation de forme |
| `biofilmMur` | 52 px | Masse d'EPS immobile et grumeleuse, avec canaux d'eau. Le meilleur gain mesuré |

Refusés, et pourquoi : `somatic` et `acanthamoeba` (un sprite tuerait les
pseudopodes), `kluyveromyces` et `geotrichum` (silhouette trop simple à leur
taille), `player` (7 px : la génération n'ajoutait que du bruit ; réglé par un
éclairage directionnel codé à la main), `mucoid` (24 px mais silhouette lisse
— la taille ne rachète pas la simplicité).

## Vignettes de cartes

Les **56 évolutions** ont leur vignette, dans `assets/cards/<id>.png`, listées
par `src/ui/card-art.js` (manifeste généré : sans lui, le DOM demandait une
image pour chaque évolution et noyait les vraies erreurs sous des 404).

```
node tools/cards-batch.mjs [n]      # génère les vignettes manquantes
node tools/sprites.mjs import       # régénère le manifeste
```

---

## La recette de relief

Tout ce qui a un volume est rendu en **trois couches**, jamais en aplat :

1. **la paroi**, disque ou capsule plein, dans la couleur de liseré ;
2. **le cytoplasme**, décalé vers la lumière et plus petit — ce qui dépasse du
   côté opposé *est* le croissant d'ombre ;
3. **le reflet spéculaire**, un ou deux pixels. C'est lui qui vend la sphère.

La lumière est **fixe en haut à gauche, en repère écran**. Elle ne tourne
jamais avec la cellule : une source qui suit l'objet ne se lit pas comme une
source, et le champ entier doit avoir l'air éclairé par la même lampe.

### Un corps allongé ne s'ombre pas en diagonale

Un cylindre éclairé s'ombre le long de sa **génératrice basse**, donc
perpendiculairement à son axe. Décaler le cytoplasme dans la direction brute
de la lumière mettait le croissant sur un **bout** du bacille dès qu'il
s'orientait vers la lampe — et un bacille avec une extrémité sombre ne
ressemble à rien. On projette donc la lumière sur la perpendiculaire à l'axe,
en gardant un cinquième de composante axiale pour que les pôles ne soient pas
plats (`ombreAxiale`).

### Les granulations sont claires

Les inclusions de polyphosphate, de PHB et de lipides sont **réfringentes** :
elles renvoient la lumière. Une granule sombre se lit comme un trou, une
granule claire comme un grain. Elles sont posées dans le repère de la cellule,
donc elles tournent avec elle et ne scintillent pas.

Cas particulier qui vaut le détour : **l'endospore de *Bacillus cereus***. Elle
est réfringente, centrale à subterminale, et ne déforme pas le sporange. On la
voit par transparence dans la cellule mère — c'est exactement ce qu'on observe
au microscope, et c'est le signe qui annonce la vague de spores.

## Le halo de contraste de phase

Un **artefact réel** de la technique : le bord d'un objet déphase la lumière
plus fort que son centre, et l'anneau de diffraction ressort en clair autour
de lui. On le rend en redessinant la silhouette **une fois plus large**, dans
la couleur de halo, avant le corps.

- L'épaisseur suit la **taille** de l'objet (`0,55 + r × 0,11`, borné). Une
  valeur fixe donnait au joueur de sept pixels une auréole plus large que lui,
  et au boss de trente-deux un trait de cheveu.
- Deux passes de largeurs différentes : une seule donnait un trait gris
  uniforme, pas un halo.
- L'opacité suit celle de l'objet : un organisme très défocalisé ne garde pas
  un liseré net.
- En fond clair il est blanc (visible entre l'organisme sombre et le milieu
  crème) ; en fond noir il est bleuté et détache l'objet sans l'éclaircir.

C'est pour gonfler chaque **primitive** et non le rayon global que la
silhouette est une fonction à part (`silhouette(..., g)`) : gonfler le rayon
aurait écarté les éléments d'une chaînette ou d'une grappe.
