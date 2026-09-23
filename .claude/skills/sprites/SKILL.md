---
name: sprites
description: Fabriquer, importer et valider les sprites de Cell Dungeon. À utiliser dès qu'on parle d'assets, de sprites, de pixel art, d'images de référence à convertir, de la planche de contact, ou qu'on veut remplacer une forme procédurale par un dessin. Couvre les tailles cibles, la palette, le format indexé, la chaîne bake/import et le choix entre sprite et procédural.
---

# Sprites de Cell Dungeon

## Le principe qui commande tout

**La forme porte l'espèce, la couleur porte la menace.** Un sprite doit
respecter la teinte de son **rôle** (`chaff` vert, `runner` or, `tank` violet,
`ranged` rose, `splitter` havane, `denier` cyan, `predator` bleu, boss rouge,
neutre gris délavé), pas la coloration de Gram de l'espèce. Deux exceptions :
l'endospore est blanche, le décor est gris.

## Tailles cibles

Elles ne se devinent pas : elles valent `radius × 2` dans
`src/data/bestiary.js`. Pour les voir toutes d'un coup :

```
node tools/make-contact-sheet.mjs      # → assets/reference/contact-sheet.png
```

| Catégorie | Taille à l'écran | Verdict |
|---|---|---|
| Coques, bacilles, spores, phages | 4 – 9 px | **Ne pas faire de sprite.** Le procédural est plus lisible et reste net |
| Levures, *Geotrichum* | 11 – 16 px | Sprite utile |
| Cellule somatique, amibe | 18 – 20 px | Sprite utile |
| Mini-boss, boss | 26 – 34 px | **Sprite très utile**, c'est là que ça se voit |
| Joueur | 16 px (canevas) | **Sprite très utile**, on le regarde en permanence |

En dessous de 8 px, chaque pixel est une décision et un dessin à la main
n'apporte rien de plus qu'une forme analytique.

## Sprite ou procédural : le vrai arbitrage

Le rendu par sprite applique la **rotation** mais pas les déformations.
Ce qu'on perd en passant au sprite :

| Morphologie | Animation procédurale actuelle | Perte si sprite |
|---|---|---|
| `rod`, `rodlong`, `coccus`, `diplo`, `spore`, `phage` | rotation seule | **aucune** — passer au sprite sans hésiter |
| `chain` | ondulation de la chaînette | réelle |
| `cluster` | grappe qui respire | réelle |
| `amoeba` | pseudopodes qui changent | **forte** — garder le procédural |
| `bud` | bourgeon | faible |

Un sprite pour une amibe est une régression. Un sprite pour un boss `rod` est
un gain net.

## La chaîne

```
node tools/sprites.mjs bake     # toiles de départ → assets/sprites/<id>.png
#   ... retouche dans Aseprite, ou image de référence déposée au même nom ...
node tools/sprites.mjs import   # → src/render/sprite-data.js
```

- **Nommage** : `assets/sprites/<id>.png`, `<id>` étant l'identifiant du
  bestiaire (`listeria`, `staph`, `kluyveromyces`…) ou `player`.
  Suffixe `@LxH` pour forcer une taille : `listeria@40x40.png`.
- **Import** : réduction par moyenne de surface, quantification sur 11
  couleurs plus la transparence, sortie en pixels indexés encodés en chaîne.
  Un sprite de 16×16 pèse une centaine d'octets ; les treize tiennent en 5 Ko.
- **Transparence** : alpha < 110 devient transparent.

## Activation

`src/render/sprite-data.js` n'est **pas** importé par défaut : le jeu tourne
en procédural. Pour activer les sprites, ajouter dans `src/main.js` :

```js
import './render/sprite-data.js';
```

Le registre est consulté par `drawOrganism` : **une espèce sans sprite retombe
sur sa forme procédurale**. Les assets peuvent donc arriver un par un sans
jamais casser le jeu, et on peut en retirer un qui déçoit.

## Convertir une image de référence

C'est faisable et c'est le chemin le plus fiable :

1. Déposer la référence sous `assets/sprites/<id>.png` (n'importe quelle
   taille, fond transparent de préférence).
2. `node tools/sprites.mjs import`.
3. Activer, lancer `node tools/visual.mjs`, **regarder la capture**.
4. Corriger les pixels qui gênent en éditant le PNG, réimporter.

L'étape 3 n'est pas optionnelle : à 8–30 px, la seule façon de juger est de
regarder le résultat dans le jeu, pas le code.

## Génération assistée (Retro Diffusion) — testé le 20/09/2026

### Ce que l'essai a montré

**Le texte seul ne marche pas pour des micro-organismes.** Le prompt
« one single short rod shaped bacterium » a produit une **torche enflammée**.
Le modèle a de fortes attentes de personnages et d'objets de RPG, et aucune
notion de morphologie bactérienne.

**L'img2img sur nos propres silhouettes marche.** En envoyant la forme
procédurale en `input_image`, le générateur **conserve la silhouette** et
n'ajoute que le travail de pixel art (liserés, reflets). C'est exactement le
bon partage : la microbiologie vient de nous, la facture graphique vient de
lui. C'est donc le SEUL mode à utiliser ici.

### `input_palette` : la pièce qui manquait

Le liseré qui fusionnait les cellules à `strength` élevé venait de couleurs
**hors palette** (un corail vif). En passant la palette du jeu en
`input_palette`, le problème disparaît : à 0.60 les séparations entre coques
survivent, et les reflets — pris dans *notre* palette — donnent du volume.
Le résultat est alors **meilleur que la forme procédurale**.

```bash
node tools/sprites.mjs palette      # → assets/reference/palette.png
node tools/rd.mjs gen <id> "<prompt>" --w 64 --h 64 \
     --from assets/reference/gen-src/<id>.png --strength 0.6 \
     --palette assets/reference/palette.png
```

### Le gain dépend de la COMPLEXITÉ de la silhouette

Mesuré sur cinq organismes, tous à 0.60 + palette :

| Organisme | Silhouette | Gain réel |
|---|---|---|
| *S. aureus* (grappe de 7 coques) | complexe | **fort** — volume, séparations, adopté |
| *Listeria* (capsule lisse) | simple | faible — un reflet. Adopté quand même, aucune perte |
| *Kluyveromyces* (ovale + bourgeon) | simple | nul à 13 px |
| Cellule somatique (amibe) | complexe mais **animée** | refusé : le sprite tuerait les pseudopodes |
| Joueur (deux disques plats) | trop simple | **négatif** — n'a ajouté que du bruit |

Deux mesures de plus, sur la conduite (20/09/2026, même recette) :

| Organisme | Silhouette | Gain réel |
|---|---|---|
| `biofilmMur` (masse d'EPS, 52 px) | complexe, **immobile** | **fort** — texture grumeleuse et canaux d'eau, adopté |
| `mucoid` (bacille long, 24 px) | lisse | **nul** — une dalle rouge avant, une dalle rouge avec du bruit sur les bords après. Refusé |

Troisième mesure, sur le kombucha (22/09/2026, même recette, 96×96) :

| Organisme | Silhouette | Gain réel |
|---|---|---|
| `hyphes` (filament septé, 92 px) | allongée et **lisse** | **négatif** — silhouette conservée, mais les **septa effacés** et la teinte virée au vert, alors qu'un neutre doit rester gris délavé. Refusé |

**Règle** : une silhouette riche gagne du volume, une silhouette lisse gagne
un point blanc. Ne générer que ce qui a de la structure à éclairer.

Corollaire de l'essai `hyphes` : le générateur **efface les détails fins et
réguliers**. Des septa, des stries, une chaînette régulière sont précisément
ce qu'il lisse en texture. Si le trait qui identifie l'espèce est un motif
répété fin, la forme procédurale le gardera et pas lui.

Corollaire mesuré sur `mucoid` : la **taille ne rachète pas** la simplicité.
Un bacille de 24 px ne gagne pas plus qu'un bacille de 13 px — c'est la
structure interne qui décide, pas le nombre de pixels disponibles.

### Le bake couvre tout le bestiaire

`node tools/sprites.mjs bake` parcourt `BESTIARY`, donc toutes les matrices.
La toile de départ d'une espèce de la conduite se bake exactement comme celle
du lait cru.

### L'import RECADRE sur le contenu

La taille cible veut dire « cet organisme fait tant de pixels de large », et
ça parle de **l'organisme**, pas de la toile qui l'entoure. L'importateur
recadre donc sur la boîte englobante opaque avant de réduire, en conservant
les proportions (un bacille reste un bacille).

Mesure qui a motivé le correctif : `penicillium` sortait avec **23 × 17 px de
contenu dans une toile de 32 × 32**, soit une moisissure à peine plus grosse
que le joueur alors qu'elle doit faire figure de baleine. Deux marges se
multipliaient : le `bake` laisse 30 % de marge, et le générateur en rajoute.

Conséquence : les sprites ne sont plus carrés. `listeria` fait 34 × 19,
ce qui est exactement ce qu'on veut pour un bacille.

### `assets/sprites/` se CURE, ne se déverse pas

`bake` écrit désormais dans `assets/reference/bake/`. On **copie à la main**
dans `assets/sprites/` ce qu'on adopte, et rien d'autre. Y déverser les treize
toiles ferait perdre à chaque espèce son animation procédurale au profit d'une
image fixe qui, pour la plupart, n'apporte rien.

### Le générateur sert aussi de RÉFÉRENCE, pas seulement d'asset

Quand un sprite figerait une animation, on peut quand même générer l'image —
puis **lire la recette d'éclairage dedans et la coder à la main**. C'est ce
qui a été fait pour le lactobacille du joueur (21/09/2026) : le générateur a
montré deux choses que la version manuelle n'avait pas, et les deux sont
justes physiquement.

1. **L'ombre d'un corps allongé suit son arête longue**, pas la diagonale. Un
   cylindre s'ombre le long de sa génératrice basse.
2. **Les granulations sont CLAIRES.** Les inclusions cytoplasmiques sont
   réfringentes ; une granule sombre se lit comme un trou.

Les deux ont été portées dans `src/render/organisms.js` (`ombreAxiale`,
`granules`) et profitent à **tous** les bacilles, pas seulement au joueur.
Coût : deux générations, 0,054 $, pour une amélioration qui touche une
douzaine d'espèces. C'est le meilleur rapport mesuré jusqu'ici.

### Le cadrage du bake est MESURÉ, plus deviné

Le `fit` supposait un encombrement de `2 × radius`. C'est faux pour tout ce
qui est allongé : un bacille fait `3,8 × r`, un hyphe plus de `5 × r`. Chaque
nouvelle morphologie ressortait donc **coupée au cadre**, et une source
coupée coûte le même prix qu'une bonne.

Le bake dessine désormais une première fois, **relève la boîte englobante
opaque**, et recadre pour que le sujet occupe 70 % de la toile. Aucune table
par morphologie à tenir à jour.

Piège rencontré en l'écrivant : mesurer sur la toile finale ne sert à rien —
une forme qui déborde y est **coupée**, sa mesure plafonne à 1 et le
recadrage ne corrige rien. On mesure sur une toile **quatre fois plus
grande**.

### Vérifier la TOILE DE DÉPART avant de dépenser

Premier essai perdu : `bake` dessinait le joueur avec la palette `UI`, qui n'a
ni `playerRim` ni `playerCore`. La toile envoyée en `input_image` était donc
un **aplat**, et le générateur ne pouvait en tirer qu'une dalle. Deuxième
piège du même essai : le `fit` générique suppose un encombrement de `2 × r`,
alors qu'un bacille fait `3,8 × r` — la cellule sortait du cadre.

Règle : **regarder `assets/reference/gen-src/<id>.png` avant d'appeler `gen`.**
Une source ratée coûte le même prix qu'une bonne.

### Le joueur : à la main, pas généré

À 7 px de large, la génération n'a ajouté que des artefacts. Ce qui a marché
est un **éclairage directionnel fixe en haut à gauche** codé à la main dans
`drawPlayer` : paroi pleine, cytoplasme décalé vers la lumière (le débord du
côté opposé fait le croissant d'ombre), un pixel de reflet spéculaire par
lobe. Les deux lobes dessinés l'un après l'autre tracent naturellement le
septum.

Et depuis qu'il est un **lactobacille**, un sprite est exclu pour une raison
de fond : le corps se **dandine** en nageant et se **cambre** quand on change
de plan focal. Un blit ne fait que tourner — il figerait les deux animations
qui donnent au personnage sa vie. Le sprite généré reste dans
`assets/reference/essais-rd/` comme référence d'éclairage, pas comme asset.

Deux pièges rencontrés : un décalage trop grand ou un cytoplasme trop gros
efface le croissant et fond les deux lobes en une masse ; un flagelle dessiné
en deux segments se lit comme une barre. Les valeurs retenues sont dans le
code, commentées.

### Ce que le modèle ne sait pas dessiner

Sur six vignettes de cartes, quatre sont utilisables. Le modèle a **un seul
fort a priori pour « microbe » : une boule hérissée façon coronavirus**, et
il l'applique partout.

| Demande | Résultat |
|---|---|
| Un objet unique (phages sur une cellule, vésicules libérées) | ✅ marche |
| Une **relation** entre deux objets (une bactérie perçant une autre, un gel de fibrine autour) | ❌ redevient une boule hérissée |

Écrire les prompts en **objet**, pas en scène. Les deux échecs (`coagulase`,
`predation`) n'ont pas été livrés.

**Confirmé sur le lot des six évolutions réservées (23/09/2026), et la
reformulation rattrape la moitié des échecs.** Quatre sur six du premier coup ;
les deux ratés décrivaient une relation :

| Demande | 1ᵉʳ jet | Reformulée en objet | Livrée |
|---|---|---|---|
| `segregation` — « un fuseau mitotique avec les chromosomes alignés » | rayures verticales, du bruit | « un seul chromosome condensé en X, deux chromatides jointes à la taille » | ✅ un X rose net à 48 px |
| `germination` — « une spore qui s'ouvre ET une cellule qui en sort » | un escargot orange à tentacules | « une endospore, manteau épais, une fissure profonde » | ❌ la boule hérissée, avec une fissure |

Ce que ça isole : la reformulation corrige une **formulation** relationnelle,
pas un **sujet** qui l'est par nature. Un chromosome en métaphase est un objet
qu'on décrivait mal ; une spore qui germe est un **état entre deux**, et aucune
tournure ne l'en sort. Bilan livré : 5 vignettes sur 6, 0,24 $.

Et le juge reste la **taille d'affichage** : `germination` est lisible en grand
et n'est qu'une pastille orange à 48 px, qui est la taille réelle des vignettes
de carte (`.card .art`, `clamp(34px, 13vmin, 62px)`).

### Le balayage de `strength` : le résultat contre-intuitif

Testé sur *S. aureus* (grappe, 28 px en jeu) à 0.45 et 0.75.

| `strength` | En grand (64 px) | **À la taille du jeu (28 px)** |
|---|---|---|
| 0.45 | très proche de la source, reflets discrets | séparations entre coques **nettes**, la grappe se lit |
| 0.75 | joli liseré lumineux, silhouette conservée | le liseré **fusionne les coques** : on voit une masse rouge à halo, plus une grappe |

**Monter `strength` dégrade la lisibilité au format du jeu.** Le liseré que le
générateur ajoute est exactement ce qui mange l'information identifiant
l'espèce — la disposition en grappe. À 28 px, la source procédurale est aussi
bonne que le 0.45, et meilleure que le 0.75.

**Conséquence pratique : l'img2img n'apporte presque rien aux sprites
in-game**, qui font 4 à 34 px. Réserver le générateur à ce qui n'est PAS
contraint par cette taille :

- les **illustrations des cartes d'évolution** — elles sont en DOM, donc
  libres d'être en 64–128 px ;
- l'**écran-titre** et les portraits de boss ;
- les éléments de décor larges des matrices 2 à 4 (SCOBY, biofilm).

Toujours juger à la taille réelle, jamais en grand :

```bash
SIZE=28 node tools/at-size.mjs a.png b.png c.png
```

### Où le générateur est vraiment bon : les vignettes de cartes

Testé en 96×96 sur `Phage lytique`, en texte seul, sans silhouette source.
**Résultat très au-dessus de tout ce qu'on obtient à la taille des sprites** :
tramage, liserés, reflet sur le noyau, structure en anneaux, 63 % de
transparence, 0 pixel sur le bord.

La contrainte n'était donc **pas le sujet, mais la taille**. À 96 px le
modèle a la place de dire quelque chose ; à 28 px il n'en a pas.

Les cartes d'évolution sont en **DOM**, pas dans le canvas : rien ne les
oblige à la résolution du jeu. C'est le meilleur emploi du générateur.

```bash
node tools/rd.mjs gen carte "<prompt>" --w 96 --h 96 \
     --out assets/cards/<id_evolution>.png
```

Le nom du fichier est l'**identifiant de l'évolution** (`lytique`,
`coagulase`, `vesicules`…). `src/ui/overlay.js` charge
`assets/cards/<id>.png` et **retire l'image d'elle-même si elle n'existe
pas** : les vignettes arrivent une par une sans rien casser.

Réserve : la palette générée est plus saturée que celle du jeu. Le paramètre
`input_palette` (une image de palette) devrait la contraindre — non testé.

Coût : 0,030 $ en 96×96.

### Les quatre réglages qui comptent

| Paramètre | Pourquoi |
|---|---|
| `input_image` + `strength` | Retexturer notre silhouette. 0.45 est très conservateur (on reconnaît la source presque à l'identique) ; monter vers 0.6–0.7 pour plus de traitement |
| `bypass_prompt_expansion: true` | **Indispensable.** Par défaut un LLM enrichit le prompt, et c'est lui qui transforme une bactérie en torche |
| `remove_bg: true` | Fond transparent natif, vérifié : 55 % de pixels transparents |
| source **rembourrée** | Sans marge, le sujet est rogné au cadre (77 pixels sur le bord mesurés). `bake --size 64` produit des sources centrées à 70 % de la toile |

### Pièges d'API rencontrés

- L'en-tête REST est **`X-RD-Token`**, pas `Authorization: Bearer` (le Bearer,
  c'est pour le MCP).
- `Idempotency-Key` déclenche `idempotency_async_required` en mode synchrone :
  ne l'envoyer qu'avec `async`.
- L'API **met toujours en file**, même sans `async` : la première réponse
  porte un `task_id` et il faut interroger `/inferences/tasks/{id}` jusqu'à
  `status: "succeeded"`, puis lire `result.base64_images[0]`.
- Il n'y a pas d'endpoint `/inferences/styles`.

### Coût mesuré

0,027 $ par image, identique en 32×32 et en 64×64. Donc **générer en 64 et
laisser l'import réduire** : même prix, bien meilleur résultat.

### La chaîne complète

```bash
node tools/sprites.mjs bake --size 64     # sources rembourrees -> assets/reference/gen-src/
npm run rd:credits                        # solde
node tools/rd.mjs cost "<prompt>" --w 64 --h 64 --from assets/reference/gen-src/<id>.png
node tools/rd.mjs gen <id> "<prompt>" --w 64 --h 64 \
     --from assets/reference/gen-src/<id>.png --strength 0.55
node tools/sprites.mjs import             # -> src/render/sprite-data.js
```

## Hygiène de la clé

La clé **ne vit jamais dans le dépôt**. Elle est lue dans
`RETRODIFFUSION_API_KEY`, définie dans les réglages d'environnement de
Claude Code (le conteneur de session est éphémère ; un `.env` écrit dedans
disparaît). Ne jamais la coller dans une conversation : les transcriptions
sont conservées, et une clé collée est une clé à révoquer.

```bash
npm run rd:guard      # verifie qu'aucune cle n'est versionnee — a lancer avant tout commit
npm run rd:credits    # solde, et donc validite de la cle
node tools/rd.mjs cost "<prompt>"              # estimation GRATUITE
node tools/rd.mjs gen listeria "<prompt>" --w 34 --h 34
node tools/sprites.mjs import                  # puis la chaine habituelle
```

`cost` passe `check_cost: true` : l'API répond le prix sans rien générer et
sans consommer de crédit. **Toujours estimer avant de générer.**

Le serveur MCP hébergé (`.mcp.json.example`) est l'autre voie : il permet
d'appeler les outils directement depuis la conversation. Il est opt-in,
à activer en renommant le fichier.

### Tailles utiles à la génération

Les styles Retro Diffusion descendent à 12×12. En dessous de 8 px, la
génération ne peut rien dire d'utile : rester au procédural. Cibler la
génération sur le **joueur (16)**, les **boss (28 et 34)**, la **cellule
somatique (20)**, *Geotrichum* (16) et *Kluyveromyces* (13).

## Vérification

```
node tools/make-contact-sheet.mjs   # la planche, avant/après
node tools/visual.mjs               # captures en jeu, portrait et paysage
node tools/smoke.mjs                # rien n'est cassé
```
