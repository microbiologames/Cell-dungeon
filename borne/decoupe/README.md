# Pièces découpées de la borne

**Généré par `tools/laser.mjs` — ne pas éditer à la main.** Relancer
`npm run laser` après toute modification des cotes.

Saignee compensée : **0.18 mm**. Si ce n'est pas celle de ta machine,
découpe d'abord `gabarit-kerf.svg`, mesure, puis relance avec
`KERF=<ta valeur> npm run laser`.

Rouge = coupe, bleu = gravure. Unités : millimètres.

| Fichier | Format | Épaisseur | Rôle |
|---|---|---|---|
| `gabarit-kerf.svg` | 90 x 46 mm | 5 mm | A DECOUPER EN PREMIER. Essayer une chute du meme materiau dans chaque fente : celle qui entre ferme sans forcer donne la saignee. Relancer ensuite avec KERF=<cette valeur>. |
| `platine-guide.svg` | 140 x 140 mm | 5 mm | Le logement de la boite : diametre 90.4 mm pour une boite de 90 mm, soit 0.4 mm de jeu. x1 |
| `platine-siege.svg` | 140 x 140 mm | 5 mm | L'epaulement qui porte la boite : 3 mm d'appui tout autour. x1 |
| `entretoise.svg` | 140 x 140 mm | 5 mm | Ecarte les LED du diffuseur. x3 (15 mm pour 15 mm demandes). |
| `support-anneau.svg` | 140 x 140 mm | 5 mm | L'anneau de LED se pose au centre. Le cercle grave marque son diametre (66 mm) : il guide le collage, il ne se coupe pas. x1 |
| `diffuseur.svg` | 98 x 98 mm | 3 mm | ACRYLIQUE OPALE, pas transparent : c'est lui qui transforme seize points lumineux en une nappe. Diametre 88 mm, pince entre le siege (trou 84) et la premiere entretoise. x1 |
| `panneau.svg` | 300 x 160 mm | 5 mm | COTES A VERIFIER SUR TES PIECES avant de lancer la decoupe : joystick 24 mm entraxe 76, boutons 28, molette 7.2. Ni les joysticks ni les boutons d'arcade ne sont normalises. Decouper d'abord ce panneau dans du carton et y presenter les vraies pieces. |
| `grille.svg` | 120 x 80 mm | 5 mm | 10 fentes, 21 % de surface ouverte. x2 : une en entree BASSE, une en sortie HAUTE — une seule grille ne ventile rien, il faut un chemin d'air. |

## Ordre de découpe

1. `gabarit-kerf.svg` — **d'abord**, pour mesurer la saignée réelle.
2. Relancer `npm run laser` avec la valeur mesurée.
3. `panneau.svg` **dans du carton**, pour y présenter les vraies pièces
   avant de le découper dans le MDF.
4. Le reste.
