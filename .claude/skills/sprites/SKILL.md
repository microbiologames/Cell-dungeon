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

## Génération assistée (Retro Diffusion)

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
