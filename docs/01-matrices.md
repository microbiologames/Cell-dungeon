# Matrices (stages)

Chaque matrice = un biotope réel, donc une flore réelle, des paramètres
physico-chimiques réels, et des dangers qui en découlent. Le joueur démarre
en *Lactococcus lactis* et traverse les matrices dans l'ordre.

Format commun : **12 minutes**, mini-boss à 4:00 et 8:00, boss à 12:00.

---

## 1 — Lait cru (tank réfrigéré, 36 h)

> Tutoriel de luxe. Votre matrice d'origine : vous y êtes chez vous.

| Paramètre | Valeur | Effet de jeu |
|---|---|---|
| Température | 6 → 12 °C | Les psychrotrophes (*Pseudomonas*) sont rapides, les mésophiles lents |
| pH | 6.7 → 5.2 | **Descend avec vos propres tirs.** Sous pH 5.6 les coliformes perdent 25 % de vitesse ; sous 5.2 les *Pseudomonas* subissent 3 dps |
| Oxygène | microaérophile | Neutre |
| Encombrement | fort | Globules gras (1–8 µm) : obstacles dérivants qui **bloquent les tirs** et masquent |

**Signature** : le champ est saturé de globules gras très réfringents. On ne voit
pas grand-chose, et l'acidification que l'on produit soi-même est une arme de
zone lente qui transforme la matrice au fil du run.

**Mécanique introduite** : la mise au point (les phages arrivent à `z ≈ +0.5`
et n'en bougent pas).

**Flore** : `lc` *Lactococcus lactis* sauvage · `leu` *Leuconostoc mesenteroides* ·
`ec` *Escherichia coli* · `ps` *Pseudomonas fragi* · `kl` *Kluyveromyces marxianus* ·
`geo` *Geotrichum candidum* · `bc` *Bacillus cereus* · `phg` phage lactococcique 936

**Mini-boss 4:00** — *Staphylococcus aureus* (grappe) : coagulase.
**Mini-boss 8:00** — *Bacillus cereus* sporulé (vague de spores).
**Boss 12:00** — *Listeria monocytogenes* : culbute, trois phases.

---

## 2 — Conduite industrielle (acier 316L, biofilm)

> La matrice qui circule dans la conduite est un **moût de kombucha en transfert**.
> Acide, sucré, et plein de monde. Le biofilm, lui, est vieux de six mois.

| Paramètre | Valeur | Effet de jeu |
|---|---|---|
| Écoulement | 0.8 m/s, laminaire au centre | **Courant** qui pousse le joueur ; les bords (couche limite) sont calmes |
| Surface | inox rayé + EPS | Les rayures sont des abris : le courant y tombe à zéro |
| pH | 3.4 | 2 dps constants sans *Acid Tolerance Response* |
| Nettoyage | **NIP toutes les 150 s** | Voir ci-dessous |

**Signature — le Nettoyage En Place (NEP/CIP)** : toutes les 150 s, un cycle
démarre. 8 s de télégraphe (le champ vire au jaune, le courant s'accélère),
puis une **vague de soude à 2 % traverse l'écran** et inflige 70 dégâts à tout
ce qui n'est pas dans une anfractuosité du biofilm. Les mobs meurent aussi :
c'est une arme si on sait s'en servir. Alternance soude → acide nitrique → chlore.

**Mécanique introduite** : la **phagocytose subie**. *Acanthamoeba* broute le
biofilm et vous gobe. Sans *Endolysine*, c'est 4 s d'impuissance et 35 dégâts.
Avec, vous le tuez de l'intérieur — c'est le moment où l'évolution paie.

**Flore** : *Pseudomonas aeruginosa* (EPS alginate, quorum sensing) ·
*Listeria monocytogenes* persistante · *Sphingomonas* · spores de *Bacillus* adhérées ·
*Acanthamoeba castellanii* · *Komagataeibacter* dérivant du moût

**Boss 12:00** — **Le biofilm mature lui-même** : une masse immobile qui envoie
des essaims, se rétracte quand on l'acidifie, et dont il faut détruire les
quatre points d'ancrage. Fenêtre de dégâts pendant le NEP.

---

## 3 — Kombucha (jarre, jour 7)

> Vous entrez en territoire hostile : à pH 2.8, une bactérie lactique n'a rien
> à faire là. C'est le stage « survie chimique ».

| Paramètre | Valeur | Effet de jeu |
|---|---|---|
| pH | 2.8 | 5 dps sans ATR ; l'ATR devient obligatoire |
| Éthanol | 0.5 → 2 % v/v | Nuages qui **inversent les commandes** 2 s |
| Acide acétique | fort | Vos propres tirs lactiques font **moitié moins** (le milieu est déjà saturé) |
| Oxygène | gradient vertical | Zone aérobie en surface (`z < -0.4`) : les AAB y sont deux fois plus rapides |
| Cellulose | pellicule (SCOBY) | **Murs** de cellulose bactérienne qui poussent en temps réel et referment l'arène |

**Signature** : l'arène **rétrécit**. *Komagataeibacter xylinus* tisse de la
cellulose en continu ; si on ne tue pas les tisseurs, on finit emmuré.
Priorité de cible imposée par la matrice, pas par le HUD.

**Mécanique introduite** : le **gradient d'oxygène sur l'axe Z**. Pour la
première fois, la profondeur a une valeur intrinsèque, pas seulement optique.

**Flore** : *Acetobacter pasteurianus* · *Gluconacetobacter* ·
*Komagataeibacter xylinus* (tisseur) · *Brettanomyces bruxellensis* ·
*Zygosaccharomyces bailii* (osmophile, très résistante) · *Saccharomyces cerevisiae*

**Boss 12:00** — **Le SCOBY** : la pellicule entière s'anime. Régénère tant
qu'un tisseur est vivant.

---

## 4 — Sang (in vivo)

> La matrice où tout ce que vous avez volé aux autres se retourne contre vous.

| Paramètre | Valeur | Effet de jeu |
|---|---|---|
| Écoulement | pulsatile 1.2 Hz | Le courant **bat** ; se déplacer à contre-temps coûte 40 % de vitesse |
| Température | 37 °C | Tout le monde est rapide |
| Complément | actif | **CAM** : rayon qui se charge 1.5 s puis inflige 40 dégâts. Contré par la capsule |
| Opsonisation | cumulative | Les anticorps marquent : +20 % de dégâts reçus par pile, 8 piles max |
| Antibiotiques | 3 vagues (6:00, 9:00, 11:00) | β-lactame → **vos évolutions Peptidoglycane deviennent une faiblesse** |

**Signature — la punition du build** : la β-lactamine cible la synthèse du
peptidoglycane. Chaque évolution `Réticulation du peptidoglycane` prise
multiplie les dégâts de la vague d'antibiotique par 1.25. Le tank pur meurt
ici s'il n'a pas pris `β-lactamase`. C'est la seule contre-incitation forte
du jeu, et elle est scientifiquement exacte.

**Mécanique introduite** : l'**immunité adaptative**. Les neutrophiles
apprennent : chaque mort d'un neutrophile augmente de 4 % la vitesse des
suivants, pour tout le reste du run.

**Faune** : neutrophiles (phagocytose, NETs) · macrophages (tank, phagocytose
longue) · plaquettes (coagulation) · *Staphylococcus aureus* (coagulase, SCV) ·
*Streptococcus pyogenes* (protéine M, streptolysine O) ·
*Neisseria meningitidis* (capsule, résiste au complément)

**Boss 12:00** — **La réponse immunitaire coordonnée** : pas un organisme, un
système. Trois neutrophiles liés par des NETs, plus une pression de complément
qui monte. Il faut casser les NETs (ADNase — une vraie enzyme de *S. aureus*).

---

## Note d'arbitrage à trancher

Tu as écrit « conduite industrielle **avec matrice favorable kombucha** ».
J'ai lu ça comme : la conduite **transporte** du kombucha (d'où la flore
acétique et le pH 3.4 du stage 2), et la jarre de kombucha reste un stage
distinct où l'enjeu est la pellicule de cellulose.

Si tu préférais **fusionner** les stages 2 et 3 en un seul, on passe à
3 matrices et je bascule la pellicule de cellulose et le gradient d'oxygène
dans la conduite. Dis-moi.
