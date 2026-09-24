# ---------------------------------------------------------------------------
# Borne Cell Dungeon — le microcontroleur unique.
#
# Un seul Raspberry Pi Pico, un seul cable USB, et il fait tout :
#
#   * le JOYSTICK devient les fleches du clavier
#   * la MOLETTE de mise au point devient la molette d'une souris
#   * les BOUTONS deviennent Espace (dash), Echap (pause), M (muet)
#   * l'ANNEAU DE LED sous la boite de Petri prend la couleur envoyee par le
#     jeu sur le port serie
#
# Pourquoi passer par le clavier et la souris plutot que d'inventer un
# protocole : src/core/input.js ecoute deja `wheel` et les fleches, lues par
# POSITION physique. Un peripherique HID standard pilote donc la borne sans
# pilote, sans reglage, et sans une ligne de code ajoutee au jeu.
#
# Cablage, bibliotheques et mise en service : borne/pico/README.md
# ---------------------------------------------------------------------------

import board
import digitalio
import rotaryio
import usb_cdc
import neopixel
from adafruit_hid.keyboard import Keyboard
from adafruit_hid.keycode import Keycode
from adafruit_hid.mouse import Mouse
import usb_hid

# --- brochage -------------------------------------------------------------
# Les microswitches vont a la MASSE, avec la resistance de tirage interne :
# c'est le cablage des joysticks et boutons d'arcade du commerce, qui n'ont
# que deux cosses.
BOUTONS = {
    board.GP2: Keycode.UP_ARROW,
    board.GP3: Keycode.DOWN_ARROW,
    board.GP4: Keycode.LEFT_ARROW,
    board.GP5: Keycode.RIGHT_ARROW,
    board.GP6: Keycode.SPACE,      # dash
    board.GP7: Keycode.ESCAPE,     # pause
    board.GP8: Keycode.M,          # muet
}
ENCODEUR_A = board.GP10
ENCODEUR_B = board.GP11
LED_BROCHE = board.GP16

# --- anneau de LED --------------------------------------------------------
NB_LED = 16

# Plafond de luminosite, et c'est une contrainte d'ALIMENTATION avant d'etre
# un gout. Une WS2812B tire jusqu'a 60 mA en blanc plein ; 16 LED a fond
# demandent donc 0,96 A, ce qu'aucun port USB ne fournit. A 0,35 on retombe
# sur 340 mA, dans ce qu'un port sait donner. Si l'anneau a sa PROPRE
# alimentation 5 V — recommande, et alors masse commune avec le Pico — ce
# plafond peut monter.
LUMINOSITE = 0.35

# Couleur d'attente, avant la premiere trame du jeu. Une borne qu'on allume ne
# doit jamais montrer une boite noire : on ne saurait pas si elle a demarre.
ATTENTE = (60, 58, 52)

# --- sensibilite de la mise au point --------------------------------------
# input.js borne deltaY a +-60 et le multiplie par 0,0024, soit 0,144 de mise
# au point par cran. Sur une profondeur utile de -1 a 1, il faut donc environ
# 14 crans pour la traverser, c'est-a-dire un peu plus d'un demi-tour d'un
# encodeur a 24 crans. C'est proche du geste d'une vraie vis micrometrique.
# Monter ce nombre pour une molette plus nerveuse, le descendre pour plus de
# finesse.
CRANS_PAR_PAS = 1

kbd = Keyboard(usb_hid.devices)
souris = Mouse(usb_hid.devices)
serie = usb_cdc.data

pixels = neopixel.NeoPixel(LED_BROCHE, NB_LED, brightness=LUMINOSITE,
                           auto_write=False)
pixels.fill(ATTENTE)
pixels.show()

entrees = {}
for broche, touche in BOUTONS.items():
    io = digitalio.DigitalInOut(broche)
    io.direction = digitalio.Direction.INPUT
    io.pull = digitalio.Pull.UP
    entrees[io] = touche

encodeur = rotaryio.IncrementalEncoder(ENCODEUR_A, ENCODEUR_B)

enfonces = set()
position = encodeur.position
tampon = ""


def appliquer(texte):
    """Applique une trame '#RRGGBB'. Tolere le bruit sans jamais lever."""
    texte = texte.strip()
    if len(texte) != 7 or not texte.startswith("#"):
        return False
    try:
        valeur = int(texte[1:], 16)
    except ValueError:
        return False
    pixels.fill((valeur >> 16 & 255, valeur >> 8 & 255, valeur & 255))
    pixels.show()
    return True


while True:
    # --- boutons : on n'emet que sur les FRONTS ---------------------------
    # Renvoyer l'appui a chaque tour ferait repeter la touche et le jeu
    # verrait un martelement au lieu d'une direction tenue.
    for io, touche in entrees.items():
        appuye = not io.value          # tirage haut : appuye = niveau bas
        if appuye and touche not in enfonces:
            kbd.press(touche)
            enfonces.add(touche)
        elif not appuye and touche in enfonces:
            kbd.release(touche)
            enfonces.discard(touche)

    # --- molette ----------------------------------------------------------
    nouvelle = encodeur.position
    delta = nouvelle - position
    if delta:
        position = nouvelle
        # Un cran a la fois : envoyer un grand nombre d'un coup ferait sauter
        # la mise au point au lieu de la faire glisser.
        pas = 1 if delta > 0 else -1
        for _ in range(min(abs(delta), 8) * CRANS_PAR_PAS):
            souris.move(wheel=pas)

    # --- couleur de la boite ----------------------------------------------
    # Lecture NON BLOQUANTE : `in_waiting` d'abord, sinon la boucle
    # s'arreterait sur `read` et les boutons ne repondraient plus.
    if serie is not None and serie.in_waiting:
        try:
            tampon += serie.read(serie.in_waiting).decode("utf-8")
        except UnicodeError:
            tampon = ""
        # Seule la DERNIERE trame complete compte : si le jeu a pris de
        # l'avance, afficher les intermediaires ne ferait que du retard.
        if "\n" in tampon:
            morceaux = tampon.split("\n")
            tampon = morceaux[-1]
            for ligne in reversed(morceaux[:-1]):
                if appliquer(ligne):
                    break
        # Garde-fou : une liaison bruitee sans fin de ligne remplirait la
        # memoire du Pico jusqu'au plantage.
        if len(tampon) > 64:
            tampon = ""
