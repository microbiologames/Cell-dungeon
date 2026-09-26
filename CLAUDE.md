# Cell Dungeon — à lire avant de toucher au code

Roguelite d'arène microbiologique jouable au navigateur. On pilote une
**cellule** observée au microscope — quatre souches jouables, du lactobacille
à la levure ; on tire sa propre toxine, on absorbe les acides aminés de ses
victimes, on vole leurs gènes.

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
- **La caractéristique unique d'une souche jouable n'est pas une évolution.**
  Elle est acquise dès la première seconde ; seules des évolutions *dédiées*,
  réservées à cette souche, l'améliorent. Toutes les souches piochent dans le
  **même** catalogue : ce qui change est la probabilité, jamais l'accès.
- **La forme porte l'espèce, la couleur porte la menace** (le rôle : `chaff`
  vert, `runner` or, `tank` violet, `ranged` rose, `splitter` havane, `denier`
  cyan, `predator` bleu, boss rouge, neutre gris délavé). Exceptions
  documentées : l'endospore est blanche, le décor est gris, et les moisissures
  gardent leur couleur de conidies — qui est un vrai caractère d'identification.
- **Ne jamais réutiliser une morphologie pour deux espèces.**
- **Ce qui est seulement invraisemblable se règle par un biais ; ce qui est
  LAID se ferme.** Un poids rend rare, il n'interdit pas — mesuré, un biais à
  0,45 laissait encore sortir 250 cartes à flagelle sur 1500 mains.
  *S. aureus* et *S. cerevisiae* portent donc `aflagelle` : les trois cartes
  qui font pousser un flagelle sont retirées de leur **tirage**, pas de leur
  rendu. Fermer au dessin ferait le défaut symétrique, une carte qui applique
  ses stats sans rien montrer.

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
npm run especes    # les 4 souches jouables : stats, tirages, toxines, traits declenches
npm run visual     # captures en jeu, portrait et paysage
npm run balance    # simulation d'equilibrage : plateau, decrochage, TTK
npm run fuite      # on ne peut plus s'echapper : distance a la meute en fuyant
npm run sheet      # planche de contact : chaque espece a sa taille reelle
npm run son:check      # 17 verdicts sur la bande son, rendue HORS LIGNE et mesuree
npm run son:studio     # 23 verdicts sur le studio sonore, conduit dans un navigateur
npm run son:publier    # fabrique ET verifie la copie hebergeable du studio
node tools/jeu-publier.mjs   # idem pour le jeu
```

---

## Invariants à ne pas casser

- **On ne doit pas pouvoir s'echapper.** `Game.recyclerLoin()` repose devant
  le joueur tout mob hostile passe au-dela de 240 px. Mesure (`npm run fuite`,
  fuyard en ligne droite) : mediane a la meute **102 px avec, 877 px sans**.
  Ce n'est pas une apparition — le budget ne bouge pas, c'est le meme individu
  repose ailleurs. Trois exclusions a ne pas lever : le **boss** (le semer est
  une option tactique), les **neutres** (decor vivant), les **sessiles** (une
  plaque de biofilm EST du terrain).
- **L'ouverture est DENSE et FAIBLE.** 11 credits des la premiere seconde, et
  des mobs a moitie de PV, 55 % de degats, 75 % de vitesse, moitie moins de
  butin — les quatre rampes se referment en 85 s. La version precedente
  demarrait a 4,5 credits : l'arene etait vide et on n'apprenait rien.
- **`ENGAGE_KILL` de `balance-sim.mjs` se cale sur le NIVEAU FINAL du jeu
  reel**, pas sur le rapport brut qu'imprime le playtest — ce rapport est
  biaise vers le bas parce que son denominateur ignore auras et zones. S'y
  caler faisait predire le niveau 18 pour un jeu qui en rend 23, et un plateau
  paraissait rompu alors que rien ne l'etait.
- **Toute source d'ennemis interroge `director.hasBudget()`.** Une plaque de
  biofilm qui émet sans le demander double la population et le budget ne veut
  plus rien dire. Mesuré : 20 coureurs vivants pour un budget de 13 crédits.
- **Le décor est calculé une fois par image** (`collectDecor`) et partagé par
  le joueur, les mobs et les projectiles.
- **Le lobby : la souche se choisit dans la NICHE**, une maison de biofilm au
  bas de la boîte dans laquelle on entre (`src/scenes/lobby.js`). Dedans on
  s'habille, dehors on part : ne pas remettre de sélecteur de souche sur la
  gélose, le geste se confondait avec un départ de partie à dix pixels près.
  La maison est dessinée **de côté** au milieu de puits vus de dessus — c'est
  ce qui la fait lire comme un bâtiment, trois essais en vue de dessus ont
  tous donné « un puits de plus ».
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
- **Le jeu est en ligne : <https://microbiologames.github.io/Cell-dungeon/>.**
  Pages sert la branche `claude/epic-carson-ryenav` à la racine ; le dépôt
  *est* le site, donc un `git push` suffit à publier. **Le `C` majuscule
  compte** — l'URL en minuscules renvoie 404. Pour vérifier la page qu'on
  livre : `BASE=https://microbiologames.github.io/Cell-dungeon npm run smoke`,
  ou la comparaison octet à octet des 38 fichiers servis avec `HEAD`.

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
| `docs/08-especes-jouables.md` | les quatre souches jouables, leurs toxines et leurs traits |
| `.claude/skills/sprites/SKILL.md` | la chaîne sprites et **ce que la génération sait et ne sait pas faire** |

Le code lui-même est commenté en profondeur : `src/audio/son.js`,
`src/game/decor.js`, `src/render/organisms.js`, `src/game/pipe-geo.js` et
`src/data/especes.js` portent l'essentiel du raisonnement.

---

## Chantiers ouverts

- **Musique, passe B : faite** (24/09/2026, `docs/07-son.md`). Trois mécanismes
  livrés — couleur harmonique pilotée par le pH, palette de boss, scénario du
  NEP avec un timbre par biocide — et deux écartés par l'auteur : l'ostinato de
  biofilm et l'automate cellulaire. Ne pas les reproposer.
  **La couleur acide est conditionnée à l'évolution `phsense`**, et c'est une
  décision de conception, pas une précaution : `game.ph` est le pH *local*, et
  un effet dont le joueur ne peut pas voir la cause s'entend comme une panne,
  pas comme une information.
- **Deux écarts de niveau connus et assumés** : le lobby est 16 dB sous les
  stages, le lait cru 2,4 dB au-dessus des trois autres. Conséquences chiffrées
  de choix faits à l'oreille, laissées telles quelles faute d'une décision
  contraire.
- **Souches jouables, suite** : les quatre premières sont là
  (`docs/08-especes-jouables.md`), et leurs évolutions réservées ont leur
  vignette — **sauf `germination`**, que le générateur rend deux fois en boule
  hérissée, son a priori documenté. À dessiner à la main si on y tient ; en
  attendant la carte s'affiche nue, ce qui ne casse rien.
  **Une souche par matrice est ecartee** (decision de l'auteur, 24/09/2026) :
  le joueur choisit sa souche au lobby, et une souche imposee par la matrice
  lui reprendrait ce choix. Ne pas y revenir sans nouvelle instruction.
- **Le sang** reste à faire, et délibérément en dernier : ce n'est pas une
  goutte mais un **réseau vasculaire** — couloirs, courant pulsatile, système
  immunitaire, hématies qui bousculent. Il réutilisera la conduite, **et c'est
  précisément pourquoi il attend** : l'auteur veut d'abord jouer la conduite en
  vrai. Ne pas le commencer avant ce retour.
