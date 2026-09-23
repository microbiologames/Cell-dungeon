# Cell Dungeon — à lire avant de toucher au code

Roguelite d'arène microbiologique jouable au navigateur. On est une **bactérie
lactique** observée au microscope ; on tire de l'acide, on absorbe les acides
aminés de ses victimes, on vole leurs gènes.

**Zéro dépendance, zéro build.** Modules ES vanilla servis tels quels.
`npm run serve` puis `http://localhost:8080/`. Playwright n'est là que pour les
bancs de mesure.

---

## Conventions non négociables

| Où | Langue |
|---|---|
| Conversation avec l'utilisateur | **français** |
| Commentaires de code, messages de commit | **français sans accents** (ASCII pur) |
| Docs, README, textes d'interface | français accentué |

**Les commentaires disent POURQUOI, avec le chiffre qui a tranché.** C'est la
culture de ce dépôt : presque chaque constante porte la mesure qui l'a fixée et
le défaut qu'elle corrige. Un commentaire qui paraphrase le code ne vaut rien ;
un commentaire qui dit « mesuré à 0,18 : le mix perdait 60 % de son niveau »
évite de refaire l'erreur. Continuer ainsi.

---

## Règles de fond, posées par l'auteur

- **Les mobs n'ont que des capacités réelles et documentées.** Pas d'invention.
  Le **joueur**, lui, peut briser le réalisme — c'est justifié en jeu par le
  transfert horizontal de gènes.
- **La forme porte l'espèce, la couleur porte la menace** (le rôle : `chaff`
  vert, `runner` or, `tank` violet, `ranged` rose, `splitter` havane, `denier`
  cyan, `predator` bleu, boss rouge, neutre gris délavé). Exceptions
  documentées : l'endospore est blanche, le décor est gris, et les moisissures
  gardent leur couleur de conidies — qui est un vrai caractère d'identification.
- **Ne jamais réutiliser une morphologie pour deux espèces.**

---

## Sécurité : la clé Retro Diffusion

La clé vit **uniquement** dans la variable d'environnement
`RETRODIFFUSION_API_KEY`, définie dans les réglages de l'environnement Claude
Code. Jamais dans un fichier du dépôt, jamais collée dans la conversation (les
transcriptions sont conservées : une clé collée est une clé à révoquer).

```
npm run rd:guard      # AVANT tout commit — sort en erreur si une cle est versionnee
npm run rd:credits    # solde
node tools/rd.mjs cost "<prompt>" ...   # estimation GRATUITE, a faire avant toute generation
```

---

## La méthode : on mesure, on ne devine pas

C'est ce qui distingue ce dépôt. Quatre règles payées cher :

1. **Un banc tranche mieux que l'œil ou l'oreille.** Un moteur audio qui ne
   lève pas d'exception peut très bien ne produire que du silence ; un sprite
   superbe en grand peut être illisible à 28 px.
2. **Une mesure non monotone est une mesure fausse, pas une découverte.** Trois
   méthodes de RT60 ont donné trois absurdités avant que le simple relevé du
   niveau par seconde ne montre une queue qui *montait*.
3. **Vérifier qu'un banc attrape le défaut qu'il garde** — en remettant le
   défaut. Un verdict ajouté sans cette vérification ne garde rien : c'est
   arrivé, le rendu durait quatre secondes et le défaut passait.
4. **Vérifier la page qu'on LIVRE, pas celle qu'on garde.** Le banc du dépôt
   était vert pendant que la page hébergée ne construisait plus rien.

### Les bancs

```
npm run smoke      # le jeu se charge, tourne, reagit — rien n'est casse
npm run visual     # captures en jeu, portrait et paysage
npm run balance    # simulation d'equilibrage : plateau, decrochage, TTK
npm run sheet      # planche de contact : chaque espece a sa taille reelle
npm run son:check      # 12 verdicts sur la bande son, rendue HORS LIGNE et mesuree
npm run son:studio     # 23 verdicts sur le studio sonore, conduit dans un navigateur
npm run son:publier    # fabrique ET verifie la copie hebergeable du studio
node tools/jeu-publier.mjs   # idem pour le jeu
```

---

## Invariants à ne pas casser

- **Toute source d'ennemis interroge `director.hasBudget()`.** Une plaque de
  biofilm qui émet sans le demander double la population et le budget ne veut
  plus rien dire. Mesuré : 20 coureurs vivants pour un budget de 13 crédits.
- **Le décor est calculé une fois par image** (`collectDecor`) et partagé par
  le joueur, les mobs et les projectiles.
- **Audio : les voix sont PERMANENTES.** Un oscillateur Web Audio ne se relance
  pas après `stop()` ; en créer un par note, c'est la fuite classique. Chaque
  canal a un oscillateur qui tourne du début à la fin, et jouer une note ne
  fait qu'ouvrir son enveloppe.
- **Audio : jamais de passe-bas biquad dans une boucle de rétroaction.** Mesuré
  au `getFrequencyResponse` : il amplifie de +1,5 à +2 dB sous sa coupure,
  **quel que soit son Q**. Dans une réverbe à renvoi 0,8 le gain de boucle
  monte à 0,96 et la queue ne décroît plus. Utiliser un **un-pôle**
  (`IIRFilterNode`), dont le gain est majoré par un.
- **Publication d'une page hébergée : préfixe versionné** (`v6/src/…`,
  `j2/src/…`) changé à chaque fois, **et on ne supprime jamais l'ancien**. Les
  deux moitiés de la règle ont chacune coûté une panne.

---

## Où lire quoi

| Fichier | Contenu |
|---|---|
| `docs/00-concept.md` | le concept et la boucle de jeu |
| `docs/01-matrices.md` | les matrices : lait cru, conduite, kombucha, levain, sang |
| `docs/02-bestiaire.md` | les espèces, leurs rôles, leur réalisme |
| `docs/03-evolutions.md` | les cartes d'évolution |
| `docs/04-vagues-equilibrage.md` | le directeur, le budget de menace, l'équilibrage |
| `docs/05-roadmap-assets.md` | l'état des assets |
| `docs/06-heritage-wet-mount.md` | le rendu : profondeur, flou, mise au point |
| `docs/07-son.md` | la bande son, le studio, les presets adoptés |
| `.claude/skills/sprites/SKILL.md` | la chaîne sprites et **ce que la génération sait et ne sait pas faire** |

Le code lui-même est commenté en profondeur : `src/audio/son.js`,
`src/game/decor.js`, `src/render/organisms.js` et `src/game/pipe-geo.js`
portent l'essentiel du raisonnement.

---

## Chantiers ouverts

- **GitHub Pages renvoie 404.** Le dépôt n'a qu'une branche
  (`claude/epic-carson-ryenav`, pas de `main`) et Pages ne sert rien. À régler
  dans Settings → Pages, ou en créant une `main`. En attendant, le jeu est
  publié comme page hébergée privée.
- **Musique, passe B** : scénario du NEP (montée de tension, impact, timbre par
  biocide), ostinato de biofilm tant qu'un producteur d'alginate vit, palette de
  boss dédiée, couleur harmonique pilotée par le pH, automate cellulaire. La
  direction artistique est calée (`docs/07-son.md`), on peut y aller.
- **Deux écarts de niveau connus et assumés** : le lobby est 16 dB sous les
  stages, le lait cru 2,4 dB au-dessus des trois autres. Conséquences chiffrées
  de choix faits à l'oreille, laissées telles quelles faute d'une décision
  contraire.
- **Le sang** reste à faire, et délibérément en dernier : ce n'est pas une
  goutte mais un **réseau vasculaire** — couloirs, courant pulsatile, système
  immunitaire, hématies qui bousculent. Il réutilisera la conduite.
