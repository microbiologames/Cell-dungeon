# Bestiaire

## Règle de véracité

Un mob ne reçoit **que** des capacités documentées chez l'espèce réelle.
La colonne « Fondement » doit toujours être remplissable. Si on ne sait pas
quoi y mettre, la capacité ne rentre pas dans le jeu.

Le vocabulaire de morphologie (`kind`) et de motilité (`mot`) est repris de
`wet-mount.html` pour que les deux projets partagent le même langage visuel.

- **kind** : `coccus` `diplo` `chain` `cluster` `rod` `rodlong` `bud` `spore`
  `arthro` `hypha` `phage` `amoeba` `globule`
- **mot** : `brown` (brownien) · `swim` (nage dirigée, flagelle) ·
  `tumble` (culbute, *Listeria*) · `glide` (glissement) · `crawl` (rampe) ·
  `drift` (porté par le courant) · `none`

## Archétypes de rôle

| Rôle | Fonction | Coût en crédits |
|---|---|---|
| `chaff` | Masse, meurt vite, sature le champ | 1.0 |
| `runner` | Rapide, fragile, force le déplacement | 1.4 |
| `tank` | Lent, encaisse, bloque les lignes de tir | 3.2 |
| `ranged` | Reste hors plan, force la mise au point | 2.6 |
| `splitter` | Se divise à la mort | 2.4 |
| `denier` | Crée des zones interdites | 3.0 |
| `predator` | Vous gobe (phagocytose) | 4.5 |
| `boss` | — | hors budget |

---

## Matrice 1 — Lait cru

### *Lactococcus lactis* (souche sauvage) — `chaff`
`diplo` · `brown` · PV 14 · vitesse 26 · contact 4
Votre propre espèce, non domestiquée. Lente, inoffensive en petit nombre.
**Fondement** : cocci ovoïdes par deux ou en chaînettes courtes, **immobile**
(pas de flagelle) — d'où la dérive brownienne pure.

### *Leuconostoc mesenteroides* — `chaff` / `denier`
`chain` · `brown` · PV 18 · vitesse 22 · contact 4
**Capacité — Dextrane** : laisse derrière elle une traînée visqueuse qui
ralentit de 35 %.
**Fondement** : *L. mesenteroides* produit réellement du dextrane à partir du
saccharose (dextransucrase). C'est le responsable historique des « sirops
filants » en sucrerie.

### *Escherichia coli* — `chaff`
`rod` · `swim` · PV 20 · vitesse 58 · contact 6
Nage en ligne droite entrecoupée de réorientations brusques.
**Fondement** : flagelles péritriches, nage en alternance *run and tumble*.

### *Pseudomonas fragi* — `runner`
`rod` · `swim` · PV 16 · vitesse 92 · contact 9
**Capacité — Lipase/protéase** : le contact applique une corrosion (DoT 3 s).
**Fondement** : psychrotrophe majeur de l'altération du lait cru, fortement
lipolytique et protéolytique ; flagelle polaire unique, d'où une nage rapide
et rectiligne. Sa vitesse **augmente** quand la température baisse.

### *Kluyveromyces marxianus* — `tank` / `splitter`
`bud` · `brown` · PV 85 · vitesse 18 · contact 12
**Capacité — Bourgeonnement** : à la mort, produit 2 cellules filles à 35 % PV.
**Fondement** : levure **capable de fermenter le lactose** (rare, et c'est
pourquoi elle est chez elle dans le lait) ; reproduction par bourgeonnement
multilatéral.

### *Geotrichum candidum* — `denier` (statique)
`arthro` / `hypha` · `none` · PV 120 · contact 8
Ne bouge pas. Étend des hyphes qui **bloquent les projectiles** et le passage.
**Fondement** : moisissure de surface des fromages et du lait, thalle formé
d'arthrospores en chaînettes qui se fragmentent.

### *Bacillus cereus* — `tank`
`rod` + `spore` · `swim` lent · PV 110 · vitesse 30 · contact 14
**Capacité — Sporulation** : à la mort, laisse une **endospore** invulnérable
aux dégâts de zone. Elle germe en 12 s et rend un *B. cereus* à 60 % PV.
Détruire la spore demande un tir direct net (netteté > 0.75).
**Fondement** : endospore réfringente, résistante à la chaleur, aux acides et
à la dessiccation. Contaminant classique du lait via le sol et la traite.

### Phage lactococcique (espèce 936) — `ranged`
`phage` · `drift` · PV 10 · reste à `z ≈ +0.5`
**Capacité — Injection** : tire une capside toutes les 2.4 s. **Ne descend
jamais dans votre plan** : impossible à toucher sans changer la mise au point.
**Fondement** : les phages lactococciques (936, c2, P335) sont *le* fléau
industriel de la fermentation laitière ; tête icosaédrique, queue courte,
injection de l'ADN à travers la paroi. Ils ne sont pas mobiles : ils diffusent.

> Le phage est le mob-professeur de la mise au point. Tant que le joueur ne
> comprend pas l'axe Z, il ne peut pas le tuer. Il n'est jamais mortel seul.

---

### Mini-boss 4:00 — *Staphylococcus aureus*
`cluster` · `brown` · PV 900 · vitesse 24 · contact 18

| Phase | Comportement |
|---|---|
| 1 (100–60 %) | **Coagulase** : dépose 3 flaques de gel (ralentissement 55 %, 6 s) |
| 2 (60–25 %) | La grappe se **désolidarise** en 7 cocci qui attaquent séparément ; elle se reforme à 25 % |
| 3 (< 25 %) | **α-hémolysine** : impulsion de zone toutes les 4 s |

**Fondement** : coagulase libre (staphylocoagulase) activant la prothrombine —
c'est *le* test d'identification de l'espèce ; disposition en grappe de raisin
par division dans plusieurs plans ; toxine α formant des pores.

**Récompense** : plasmide garanti.

### Mini-boss 8:00 — Vague sporulée de *Bacillus cereus*
Pas un organisme : **six** *B. cereus* qui sporulent en chaîne. Le boss est le
tapis de spores. Introduit l'idée qu'une vague peut être un boss.

### Boss 12:00 — *Listeria monocytogenes*
`rod` court · `tumble` · PV 2400 · vitesse 70

| Phase | Comportement |
|---|---|
| 1 | Culbute rapide et erratique, difficile à cibler (`tumble` réel) |
| 2 | **Motilité en comète** : accélère en ligne droite en laissant une traînée |
| 3 | **Listériolysine O** : détruit les globules gras du champ → plus d'abris, et 12 dps de zone |

**Fondement** : mobile à 20–25 °C par flagelles péritriches (culbute
caractéristique « en roue »), **immobile à 37 °C** ; motilité intracellulaire
par polymérisation d'actine (ActA) formant une comète ; listériolysine O,
toxine formant des pores qui lui permet de sortir du phagosome.
Pathogène emblématique du lait cru.

> La phase 3 est la promesse du stage 2 : la LLO est exactement l'*Endolysine*
> que le joueur pourra voler.

---

## Matrices 2 à 4 — table de référence

| Espèce | Matrice | Rôle | Capacité | Fondement |
|---|---|---|---|---|
| *Pseudomonas aeruginosa* | 2 | `denier` | Alginate : boucliers EPS régénérants | EPS alginate, biofilm mucoïde |
| *Acanthamoeba castellanii* | 2 | `predator` | **Phagocytose** le joueur (4 s) | Amibe libre broutant le biofilm des réseaux d'eau |
| *Sphingomonas* | 2 | `chaff` | Adhésion : colle au joueur | Glycosphingolipides, adhérence forte en conduite |
| *Listeria* persistante | 2 | `tank` | Résiste aux désinfectants | Souches persistantes réelles en atelier |
| *Komagataeibacter xylinus* | 3 | `denier` | **Tisse** des murs de cellulose | Cellulose bactérienne = la pellicule du SCOBY |
| *Acetobacter pasteurianus* | 3 | `runner` | Acide acétique : perce l'ATR | Oxyde l'éthanol en acide acétique |
| *Brettanomyces bruxellensis* | 3 | `tank` | Nuage d'éthanol (commandes inversées) | Levure de contamination, produit éthanol et phénols volatils |
| *Zygosaccharomyces bailii* | 3 | `tank` | Immunité aux conservateurs | Résistance extrême aux acides faibles, fléau de l'agro |
| Neutrophile | 4 | `predator` | Phagocytose + **NETs** (pièges) | Phagocytose et NETose documentées |
| Macrophage | 4 | `tank`/`predator` | Phagocytose longue, très PV | — |
| Plaquettes | 4 | `denier` | Coagulation en zones | Cascade de coagulation |
| *Streptococcus pyogenes* | 4 | `runner` | Streptolysine O + protéine M (anti-phagocytose) | SLO formant des pores ; protéine M antiphagocytaire |
| *Neisseria meningitidis* | 4 | `chaff` | Capsule : immunise contre le complément | Capsule polysaccharidique antiphagocytaire |

---

## Ce qu'on s'interdit

- Donner la coagulase à autre chose que *S. aureus* (et *S. lugdunensis*).
- Rendre *Lactococcus* mobile.
- Faire « phagocyter » par une bactérie (voir `03-evolutions.md`).
- Faire nager une spore.
- Rendre *Listeria* mobile à 37 °C — donc en matrice 4 (sang), la *Listeria*
  qu'on recroise est **immobile**. Le détail paie : le joueur qui le remarque
  a appris quelque chose de vrai.


---

## Matrice 2 — Conduite industrielle (implémentée)

Toutes ces espèces sont réellement isolées des lignes laitières : des joints,
des coudes morts et des rayures d'inox après un NEP mal conduit. Même règle
que pour le lait cru : **aucune capacité qui ne soit documentée chez l'espèce
réelle**.

| id | Espèce | Rôle | Capacité | Fondement |
|---|---|---|---|---|
| `sphingomonas` | *Sphingomonas* | chaff | `adhesion` — rampe vers la paroi, tolère l'abri au NEP | Membrane externe à glycosphingolipides au lieu du LPS : adhésion très forte, tolérance aux désinfectants. Colonisateur classique des réseaux d'eau |
| `aeruginosa` | *P. aeruginosa* | runner | `alginate` — fait repousser les plaques détruites | Exopolysaccharide qui donne le phénotype mucoïde. Flagelle polaire unique, quorum sensing las/rhl |
| `listeriaPers` | *L. monocytogenes* persistante | tank | `persistance` — 30 % de résistance, abri au NEP | Souches réellement réisolées des mêmes ateliers pendant des années ; tolèrent des doses sublétales de désinfectant |
| `sporeAdh` | Spore adhérée | chaff | `germination` → *B. cereus* ; **immunisée au NEP** | Les endospores de *Bacillus* adhèrent à l'inox et survivent à un cycle complet : c'est le problème industriel de fond |
| `acanthamoeba` | *Acanthamoeba castellanii* | predator | `phagocytose` | Amibe libre des réseaux d'eau : broute le biofilm, phagocyte les bactéries, s'enkyste et traverse les biocides |
| `swarmer` | Cellules en *swarming* | chaff | — | La dispersion est la dernière étape du cycle du biofilm, et elle est **active** |
| `plaque` | Plaque de biofilm | source | `emission` | Un biofilm est un mode de vie, pas un dépôt : matrice d'EPS, canaux d'eau, dispersion active |
| `methylo` | *Methylobacterium* | **neutre** | — | Méthylotrophe facultative rose, habitante ordinaire des réseaux d'eau et des rinçages. Elle ne doit rien à une bactérie lactique |

**Boss** : `mucoid` *P. aeruginosa* mucoïde (mutation `mucA`, alginate, quorum
sensing, dispersion) · `amibe` *Acanthamoeba* géante (phagocytose, broutage,
enkystement) · `biofilmMur` le biofilm mature.

### Règle de budget : toute source d'ennemis interroge le même budget

Trois choses engendrent des mobs **en dehors** du directeur : une plaque de
biofilm, une capacité de boss (`quorumboss`, `essaimage`, `dispersion`), et
une spore qui germe. Chacune doit appeler `director.hasBudget()`.

Mesuré quand elles ne le faisaient pas : **20 *P. aeruginosa* vivants en
moyenne pour un budget de 13 crédits**, et 96 % des dégâts subis venant de
cette seule espèce. C'est exactement la divergence déjà rencontrée avec la
chaîne *Bacillus* → spore → *Bacillus* dans le lait cru. Le budget de menace
n'est une garantie que si **personne ne le contourne**.

Corollaire : une spore achetée 0,8 crédit ne peut pas rendre gratuitement un
tank à 3,2. La germination attend que le champ ait de la place — ce qui est
d'ailleurs la vérité biologique : une spore germe en milieu favorable.
