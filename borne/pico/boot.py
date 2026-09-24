# ---------------------------------------------------------------------------
# Active le canal SERIE DE DONNEES, en plus de la console REPL.
#
# Sans ce fichier, CircuitPython n'expose qu'un seul canal USB CDC, celui du
# REPL. Le jeu y enverrait ses couleurs au milieu des messages de la console,
# et la moindre erreur Python melangerait sa trace aux trames. `usb_cdc.data`
# ouvre un second port, propre, que WebSerial choisira.
#
# Ce fichier n'est lu qu'au BRANCHEMENT de la carte : apres l'avoir copie, il
# faut debrancher et rebrancher le Pico, un reset logiciel ne suffit pas.
# ---------------------------------------------------------------------------
import usb_cdc

usb_cdc.enable(console=True, data=True)
