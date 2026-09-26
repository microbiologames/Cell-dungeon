# Vagues et équilibrage

## Le problème posé

> « Il faut que ce soit très équilibré entre les progressions du joueur et des
> mobs pour que l'**intensité** augmente sans pour autant augmenter la
> **difficulté réelle**, jusqu'à ce que ce soit trop intense et qu'on perde. »

Intensité et difficulté sont deux grandeurs distinctes, et c'est la clé :

- **Intensité** = combien il se passe de choses par seconde. Nombre d'ennemis
  à l'écran, de projectiles, de kills/s, d'effets. C'est ce qui *excite*.
- **Difficulté** = probabilité de mourir dans les 10 prochaines secondes.
  C'est ce qui *frustre*.

On veut : intensité **×5** sur le run, difficulté **plate** puis verticale à la fin.

## Les deux invariants

### Invariant 1 — TTK maîtrisé

Le temps nécessaire pour tuer un mob de référence (`chaff`) doit rester
constant **pour qui choisit bien**. C'est ce qui rend la progression
*ressentie* : le joueur tape toujours aussi fort, alors que les PV ennemis
montent aussi.

```
TTK(t) = PV_ref × H(t) / DPS_joueur(t)
```

| Politique de choix | Fenêtre exigée (p ≤ 0.8) | Mesuré |
|---|---|---|
| Joueur qui optimise | 0.42 – 1.25 s | **0.48 → 0.52 s**, plat |
| Joueur qui pioche au hasard | 0.42 – 1.90 s | 0.82 → 1.25 s, dérive |

L'écart entre les deux lignes **est** la récompense du choix : jouer au
hasard coûte jusqu'à 75 % de temps de tuerie en plus. C'est voulu, et c'est
mesuré plutôt qu'espéré.

### Invariant 2 — Pression : plateau puis décrochage

```
P(t) = menace entrante(t) / capacité d'encaissement(t)
```

où `menace entrante` tient compte de la **mitigation** : la vitesse du joueur
est une défense réelle (on distance la foule) et le contrôle de foule
(coagulase, EPS, aura acide) retire des mobs de l'équation.

La difficulté n'est pas testée sur des valeurs absolues — il suffirait de
déplacer les bornes jusqu'à ce que ça passe. Elle est testée sur la **forme**,
qui est la vraie affirmation de design :

| Invariant | Exigence | Mesuré (optimisateur) |
|---|---|---|
| **Plateau** : pression sur la 1ʳᵉ moitié | ne double pas (× ≤ 1.9) | **× 1.79** |
| **Décrochage** : pression sur la 2ᵈᵉ moitié | au moins double (× ≥ 2.0) | **× 3.62** |
| **Foule** : population sur le run | au moins × 3 | **× 4.40** |
| Garde-fous absolus | 0.25 ≤ P ≤ 3.2 | 0.39 … 2.58 |

Courbe obtenue, pour un joueur qui optimise :

```
0:00 ----------- 5:00 ----------- 9:00 ----------- 12:00
P =  0.40  →  0.60   |   0.60 → 1.33   |   1.33 → 2.58
     plateau         |   ça se tend    |   le sol se dérobe
foule : 9.6 mobs     |   12.5          |   24  →  42
```

Pendant que la foule **quadruple**, la difficulté ne bouge presque pas
sur la première moitié. C'est exactement la commande : l'intensité monte,
la difficulté attend.

Le décrochage final n'est pas un pic de PV : c'est une **saturation du champ**.
On meurt parce qu'il n'y a plus de place pour se déplacer, pas parce que les
mobs frappent plus fort. C'est la mort honnête.

## Les formules

Avec `p = t / T` et `T = 720 s` :

Avec `o(p) = min(1, p / 0.12)`, l'**avancement dans l'ouverture** :

```
Population de menace  B(p) = (11 + 2.5 o) × (1 + 3.4 p^2.8)  crédits  →  11 … 57
PV des mobs           H(p) = (0.5 + 0.5 o) × (1 + 1.9 p^1.20)          →  0.5 … 2.9
Dégâts des mobs       D(p) = (0.55 + 0.45 o) × (1 + 0.9 p)
Vitesse des mobs      V(p) = (0.75 + 0.25 o) × (1 + 0.35 p)
Butin d'un mob        A(p) = 0.5 + 0.5 o
Expérience            X(n) = 5 + 4n + 0.70 n²        → niveau 23 en fin de run
Palier de rôles       tier(p) = floor(p × 5)
```

### L'ouverture est DENSE et FAIBLE (26/09/2026)

C'est un renversement. La version précédente démarrait à **4,5 crédits** —
trois ou quatre bactéries — pour ne pas jeter le joueur dans une foule.
Résultat : l'arène était vide, on s'échappait en ligne droite sans rien
croiser, et on n'apprenait rien.

On démarre maintenant à **11 crédits**, soit une dizaine de cocci, et c'est la
**mollesse** qui fait la mise en jambes, pas la solitude : à `p = 0` un mob a
la moitié de ses PV, 55 % de ses dégâts et 75 % de sa vitesse, et il rend
moitié moins d'acides aminés. Les quatre rampes se referment en 85 s.

`A(p)` existe parce que sans lui la foule d'ouverture — deux fois plus
nombreuse **et** deux fois plus vite tuée — quadruplait la récolte des
premières minutes. Le butin suit les PV : c'est la même cellule qu'on mesure.

> **`B` est une population, pas un débit.** Le directeur maintient ce nombre
> de crédits *présents simultanément* et remplace les morts. Une première
> version traitait `B` comme un nombre d'apparitions par seconde : la
> population divergeait et le joueur était submergé dès la deuxième minute.
> Le simulateur l'a montré tout de suite.

### Pourquoi l'exposant 2.8

C'est la constante la plus sensible du jeu. Avec un exposant proche de 1, la
foule grossit régulièrement du début à la fin — et la pression monte
régulièrement avec elle, donc la difficulté croît tout du long. On perd le
plateau. Avec 2.8, la foule reste sage pendant les huit premières minutes
puis **double sur les quatre dernières** : plateau, puis falaise.

| Exposant | Plateau mesuré | Verdict |
|---|---|---|
| 1.35 | × 3.6 | difficulté croissante du début à la fin |
| 2.2 | × 2.07 | presque |
| **2.8** | **× 1.79** | ✅ |

### Pourquoi `H` monte moins vite que `B`

`H(p)` (× 2.9) suit la courbe de DPS du joueur, ce qui tient l'invariant 1.
`B(p)` (× 4.4) monte **plus vite**, donc c'est la **densité** qui porte la
montée d'intensité. Les mobs ne deviennent jamais des murs : ils deviennent
une foule.

### Calendrier d'une matrice (720 s)

| Temps | Événement |
|---|---|
| 0:00 | Ouverture, chaff seul, budget bas |
| 0:30 | Première vague nommée, `runner` débloqué |
| 2:00 | `ranged` débloqué (phages) — leçon de mise au point |
| 3:00 | `tank` débloqué |
| **4:00** | **Mini-boss** — budget coupé à 25 % pendant le combat, plasmide garanti |
| 5:00 | `splitter` et `denier` débloqués |
| 6:00 | **Accalmie 20 s** : budget à 10 %, les acides aminés au sol restent. Respiration. |
| **8:00** | **Mini-boss 2** |
| 9:00 | `predator` débloqué (matrices 2+) |
| 10:00 | Pression 1.0, le champ se sature |
| 11:30 | **Accalmie 15 s** avant le boss |
| **12:00** | **Boss** |

Les deux accalmies ne sont pas de la générosité : sans elles, la montée est
une rampe plate et le joueur s'habitue. Avec elles, le retour de la horde est
ressenti comme une accélération. **Le contraste porte l'intensité, pas le niveau absolu.**

### Composition des vagues

Une vague n'est pas une liste, c'est un **profil d'achat**. À chaque palier,
le directeur reçoit des poids par rôle :

| Palier | chaff | runner | ranged | tank | splitter | denier | predator |
|---|---|---|---|---|---|---|---|
| 0 | 100 | — | — | — | — | — | — |
| 1 | 70 | 30 | 8 | — | — | — | — |
| 2 | 55 | 30 | 12 | 15 | — | — | — |
| 3 | 40 | 28 | 12 | 18 | 14 | 10 | — |
| 4 | 30 | 25 | 10 | 20 | 16 | 14 | 8 |

Contrainte anti-frustration : **jamais plus de 2 `ranged` simultanés**, et
**jamais plus de 3 `denier`** (sinon l'arène devient injouable, pas difficile).

### Spawn et mise au point

Un mob n'apparaît pas au bord de l'écran : il apparaît **hors plan focal**,
à `z = ±(0.55 … 1.0)`, dans le champ ou juste à son bord, puis **dérive vers
`z = 0`** en 3 à 6 s. Le joueur qui utilise sa molette voit donc littéralement
la vague se former avant qu'elle n'existe. C'est le rendu du télégraphe :
pas d'indicateur de HUD, juste de l'optique.

## Trois phases, pas deux

| Phase | Fraction | Pression | Intention |
|---|---|---|---|
| **Ouverture** | 0 → 0.12 (85 s) | 0.26 | Une dizaine de cellules molles. On prend ses marques dans la foule |
| **Plateau** | 0.15 → 0.55 | × 1.84 | La foule quadruple, la difficulté ne bouge presque pas |
| **Décrochage** | 0.55 → 1.0 | × 3.22 | Le sol se dérobe |

L'ouverture est une **phase à part entière**, mesurée séparément. La confondre
avec le plateau faisait passer une bonne mise en jambes pour une difficulté
croissante et cassait le test — alors que c'est précisément ce qu'on voulait.

## On ne peut plus s'échapper (26/09/2026)

Le défaut, signalé en jouant : *« on peut facilement s'échapper et on finit en
course-poursuite où on gagne forcément en s'échappant »*. Dans une goutte de
1600 px de rayon sans obstacle, la bonne réponse à n'importe quelle vague
était de partir en ligne droite. La poursuite ne se terminait jamais, et le
**budget de menace devenait un chiffre sans effet** puisque la menace restait
derrière.

Mesuré par `npm run fuite`, qui pilote le vrai jeu avec un fuyard en ligne
droite et relève la distance médiane à la meute hostile :

| | médiane à la meute | mobs devant |
|---|---|---|
| sans recyclage | **877 px** | 0,02 |
| avec recyclage | **102 px** | 1,33 |

877 px, c'est sept fois le champ visible : le fuyard était littéralement seul
au monde. Le relevé brut des distances en fin de course le dit mieux encore —
`[1054, 1264, …, 1393]` sans recyclage, `[37, 57, 60, …, 163]` avec.

### Ce que fait le recyclage, et ce qu'il ne fait pas

`Game.recyclerLoin()` repose **devant** le joueur, dans un cône de ±55°, tout
mob hostile qui passe au-delà de 240 px. Ce n'est **pas** une apparition : le
budget ne bouge pas, c'est le même individu qu'on repose ailleurs. Et ce n'est
pas une invention : le champ contient des millions de cellules dont on n'en
dessine que quelques dizaines ; celles qu'on distance sont remplacées, dans la
fiction, par d'autres du même clone déjà en avant. C'est un échantillonnage.

Trois exclusions, et chacune protège quelque chose :

| Exclu | Pourquoi |
|---|---|
| le **boss** | on doit pouvoir le semer, c'est une option tactique |
| les **neutres** | ils sont le décor vivant, pas la menace |
| les **sessiles** | une plaque de biofilm ou une spore posée **est** du terrain ; la voir réapparaître devant soi détruirait la seule chose que le décor apporte |

240 px est choisi pour que le recyclage ne se voie **jamais** se produire : le
champ visible fait 124 px de rayon. Le mob revient entre 118 et 172 px, hors
du plan focal — la mise au point reste le télégraphe, et un mob qui se
matérialise net à portée de contact n'est pas une menace, c'est une gifle.

### La conséquence sur toute l'économie

Les kills réels sont passés de **~355 à ~840 par run**. Sans rien d'autre, le
joueur finissait au **niveau 36 au lieu de 23**, avec cinq fois le DPS :
l'invariant de TTK n'existait plus. D'où le durcissement de `X(n)`.

Deux erreurs commises en le calibrant, notées parce qu'elles se referaient :

1. **Multiplier la courbe entière par 2,4** paraissait plus propre que
   déformer son terme carré — une échelle plutôt qu'une forme. Mesure faite,
   c'est l'inverse : les runs **bifurquaient** (niveau 16 à 27, 20 à 43 morts)
   parce que les tout premiers niveaux devenaient 2,4 fois plus chers et que
   la foule d'ouverture ne payait plus la mise en jambes qu'elle est censée
   payer. En durcissant seulement le terme carré, le niveau 1 coûte 9,9 au
   lieu de 9,2 — la mise en jambes est intacte — et c'est la suite qui se
   mérite.
2. **Recopier `ENGAGE_KILL` du rapport brut imprimé par le playtest.** Ce
   rapport (`tués / ∫ dps/PV`) est biaisé vers le bas : son dénominateur
   ignore les auras, les zones et la perforation, si bien que les runs
   individuels vont de 0,50 à 1,06. S'y caler donnait un simulateur qui
   prédisait le niveau 18 pour un jeu qui en rend 23 — donc un joueur
   sous-équipé, donc un plateau qui **paraissait** rompu alors que rien ne
   l'était. Le critère qui vaut est celui pour lequel ce simulateur existe :
   il doit **reproduire le niveau final du jeu réel**. Jeu réel 22,7, et
   `ENGAGE_KILL = 1,00` donne 22,5.

## Rester vaut le coup : les porteurs de plasmide

Empêcher la fuite ne suffit pas — encore faut-il **vouloir** rester. Le
directeur promeut un mob **porteur de plasmide** toutes les 34 à 60 s, jamais
avant la 22ᵉ seconde. Il porte un anneau qui bat, encaisse 2,4 fois plus, rend
le double d'acides aminés, et **lâche un plasmide** — exactement le butin d'un
boss, et c'est voulu : ce qu'on gagne à rester doit valoir ce qu'on gagne à
survivre à un boss, sinon rester ne se décide pas.

Le prétexte n'en est pas un : une cellule portant un plasmide conjugatif est
une chose réelle, identifiable à son phénotype, et c'est littéralement la
récompense — le plasmide est déjà ce que le joueur ramasse pour gagner une
compétence immédiate.

Réservé aux espèces **mobiles** coûtant au moins un crédit : un porteur
immobile ne crée aucune tension (on le tue quand on veut), et une spore à 0,6
crédit en ferait un distributeur. Mesuré : 13 à 15 porteurs par run de 12 min.

## La vitesse se gagne

`BASE.speed` passe de **68 à 56** (−18 %) et les vitesses des trois autres
souches suivent. À 68, un joueur qui n'achetait aucune carte de nage se
sortait de tout en ligne droite, et les six rangs de `flagelle` (+54 %) ne
changeaient qu'un confort. À 56, la même cellule pleinement flagellée monte à
~100 et c'est **elle** qui décide si on distance un coureur.

Côté mob, le pendant est la **différenciation en cellules nageuses** : le
champ `swarm` du bestiaire donne l'avancement du run à partir duquel l'espèce
porte ses flagelles. En deçà elle apparaît en cellule végétative — pas de
flagelle, vitesse à 55 %. Ce n'est pas un réglage de difficulté déguisé : la
flagellation dépendante de la phase de croissance est documentée chez les deux
espèces qui portent le champ, *E. coli* (répression de la flagelline en phase
exponentielle précoce) et *B. cereus* (différenciation swarmer).

| Espèce | `swarm` | Ce que ça change |
|---|---|---|
| *E. coli* | 0.22 | 35 px/s en végétative, 64 différenciée. C'est **lui** qui décidait si on pouvait s'échapper la première minute |
| *B. cereus* | 0.50 | le tank de mi-partie n'arrive à pleine vitesse qu'en seconde moitié |

## Le score

`kills` ne compte que des têtes. Le **score** pèse la menace abattue :

```
score += cost × 10 × (1 + p) × (boss ? 5 : 1) × (porteur ? 2 : 1)
```

`cost` est le crédit de menace que le directeur paie pour poser le mob — donc
exactement sa difficulté, sans second jeu de nombres à tenir à jour. Le
facteur `(1 + p)` dit le reste : le même mob à la douzième minute porte trois
fois les PV qu'il avait à la première. Les deux compteurs restent affichés :
un joueur qui farme du coccus doit pouvoir le voir. Ordre de grandeur mesuré :
**10 000 à 26 000** sur un run complet.

## Deux outils, deux rôles

| Outil | Ce qu'il mesure | Ce qu'il ne voit pas |
|---|---|---|
| `npm run balance` | Modèle abstrait, 400 runs, invariants de forme | La récolte, le décor, la portée réelle des tirs |
| `npm run playtest` | **La vraie boucle de jeu**, sans rendu, avec un pilote automatique | Le ressenti, qui demande des mains |
| `npm run fuite` | Qu'**on ne peut plus s'échapper** : un fuyard en ligne droite, trois graines, la distance à la meute | Tout le reste — il ne juge qu'une chose |

Le second existe parce que le premier s'est trompé. Le modèle abstrait
supposait que le joueur tue tout ce qu'il peut : il annonçait le niveau 26,
le jeu réel en donnait 13. Il a aussi manqué deux bugs que seul le jeu réel
pouvait montrer :

- les gouttes d'acide n'atteignaient **jamais** la portée de ciblage (avec
  une traînée exponentielle, la distance plafonne à `vitesse / coefficient`,
  ici 137 px pour une portée annoncée de 190) ;
- les chaînes de reproduction **divergeaient** : un *Bacillus* meurt en spore,
  la spore germe en *Bacillus*, qui meurt en spore. Mesuré à 123 mobs pour un
  budget de 21. Les descendances sont maintenant bornées par génération, avec
  un plafond global de sécurité.

Les constantes du simulateur sont désormais **dérivées du bestiaire** et non
recopiées : un second jeu de nombres à tenir à jour finit toujours par
diverger.

## Vérification

`tools/balance-sim.mjs` simule 400 runs pour deux politiques de choix
(joueur qui optimise, joueur qui pioche au hasard), calcule le TTK et la
pression toutes les 30 s, et vérifie les invariants de forme.

```
npm run balance      # modele abstrait, invariants de forme
npm run playtest     # la vraie boucle de jeu, 3 runs complets sans rendu
```

Le script sort en code 1 dès qu'un invariant est rompu, en nommant lequel.
Il partage ses constantes avec `src/data/matrices.js` et `src/game/stats.js` :
il n'y a **pas** de second jeu de nombres à tenir à jour, donc le test ne peut
pas diverger du jeu.

---

## La forme de l'arène est un paramètre d'équilibrage

Le budget de menace compte des **crédits présents**, pas une densité. Tant
qu'il n'y avait qu'une goutte de 2800 px, la distinction ne coûtait rien. Avec
la conduite — un couloir de 2800 × 224 — elle devient centrale : à budget
égal, la pression au pixel visible y est bien plus forte, et surtout **on n'y
décroche pas**. Un nageur rapide reste collé, faute de place pour le semer.

Deux leviers, tous deux déclarés par la matrice :

| Champ | Rôle |
|---|---|
| `budgetScale` | Multiplie le budget commun. `0.68` pour la conduite |
| `roleCaps` | Remplace `ROLE_CAPS` pour cette matrice. `runner 4`, `tank 3`, `predator 1` |

Ce ne sont pas des réglages de difficulté : ce sont des propriétés de la
**forme**. Une arène qui empêche de décrocher doit porter moins de coureurs,
sinon le rôle « coureur » cesse d'être une menace parmi d'autres pour devenir
la seule.

### Mesures

| État | Morts (3 runs, pilote auto) | Part du premier coupable |
|---|---|---|
| Conduite, sans garde-fous | 146 à 494 par run | *P. aeruginosa* : **96 %** |
| Conduite, budget et plafonds posés | 39 / 63 / 119 par tiers | répartie sur 5 espèces |
| Lait cru, référence | 16 / 24 / 34 par tiers | *B. cereus* : 62 % |

La conduite reste plus dure que le lait cru — c'est la deuxième matrice, et le
pilote automatique y est bien plus mauvais qu'un humain puisqu'il ne sait ni
se mettre à l'abri du NEP ni longer la couche limite. Ce qui compte est la
**forme** de la courbe : les morts montent jusqu'à la fin, elles ne font pas
une bosse au milieu.

## Toute source d'ennemis passe par le budget

`Director.hasBudget()` existe pour ça. Trois appelants hors directeur :

- la plaque de biofilm (`emission`),
- les capacités de boss qui appellent du renfort (`quorumboss`, `essaimage`),
- la germination d'une spore.

Sans ces appels, la population double sans que personne ne l'ait décidé —
mesuré à 20 coureurs vivants pour un budget de 13 crédits. C'est la même
divergence que la chaîne *Bacillus* → spore → *Bacillus*, sous un autre nom.
Le budget n'est une garantie que si **personne ne le contourne**.
