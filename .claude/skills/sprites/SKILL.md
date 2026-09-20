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
