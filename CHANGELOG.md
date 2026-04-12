# Changelog

Toutes les evolutions notables de ce projet seront documentees dans ce fichier.

Le format s'inspire de Keep a Changelog, adapte au contexte actuel du depot.


## [1.0.52] - 2026-04-12

### Modifié

 - Ajout d'un contournement runtime Linux pour limiter les soucis audio lies a VAAPI et dmabuf

## [1.0.51] - 2026-04-12

### Modifié

 - Ajout de logs debug desktop pour diagnostiquer l'audio et les VU-metres sur macOS et Linux

## [1.0.50] - 2026-04-12

### Modifié

 - Fix: bascule la lecture desktop sur un element audio DOM reutilise

## [1.0.49] - 2026-04-11

### Modifié

 - Correction stop musique locale et ajustements audio desktop

## [1.0.48] - 2026-04-11

### Modifié

 - macOS : désactivation temporaire de la fenêtre VU-mètre séparée Tauri, avec rendu recentré dans la fenêtre principale
 - Linux : neutralisation provisoire des chemins VU-mètre natifs/Web Audio suspects pour tenter de stabiliser la lecture radio et locale

## [1.0.47] - 2026-04-10

### Modifié

 - Desactivation de src/App.tsx pour voir si c'est cela qui bloque l'audio dans les builds

## [1.0.46] - 2026-04-09

### Modifié

 - Neutralisation du démarrage automatique backend natif Linux dans src/App.tsxpour eviter le gel au lancement des radios ou de l’ouverture d’un dossier local

## [1.0.45] - 2026-04-09

### Modifié

 - Amélioration de la selection des radios
 - Recablage des VU-mètres sur les flux audio
 - Amélioration comportement VU-mètres suivant la source

## [1.0.44] - 2026-04-09

### Modifié

 - Anti décrochement du VU-mètre
 - Modification taille des VU-mètre plein ecran 

## [1.0.43] - 2026-04-08

### Modifié

 - Affichage VU-metre dans le programme version build
 - Lecture audio locale et stream version build

## [1.0.42] - 2026-04-08

### Modifié

 - Aligne toutes les versions applicatives sur le tag de release pour relancer les builds desktop


## [1.0.41] - 2026-04-06

### Modifié

 - Modification des VU-mètres analogique et led mono + led strereo
 - Changement ordre des options
 - Integré -> fenêtres / Flottant -> Plein écran

### Ajouté

 - VU-mètre vintage
  

## [1.0.40] - 2026-04-06

### Ajouté

 - Ajout d'une fonction VU-mètre
 - Ré organisation fenetre options pour le mode d'affichage du vu metre


## [1.0.39] - 2026-04-06

### Modifié

 - Afinement precis des thèmes pouet sous macOS
 - Ajustement taille horloge analogique sous macOS

## [1.0.38] - 2026-04-06

### Modifié

 - Ajustement des thèmes pouet sous macOS

## [1.0.37] - 2026-04-06

### Modifié

 - Corrections affichage macOS

## [1.0.36] - 2026-04-06

### Modifié

 - aligne les versions avec le tag

## [1.0.35] - 2026-04-06

### Modifié

 - sécurise la release GitHub et fiabilise la synchronisation des versions


## [1.0.34] - 2026-04-06

### Modifié

 - Ajout secu N° de version
 - Build win sécurisé


## [1.0.33] - 2026-04-03

### Ajouté

 - Nouvelle liste radio orientee cool: ambient, lo-fi hip-hop, chill, soul et leftfield
 - Selection privilegiee sur des radios/community streams sans pub explicite ou a modele non-commercial
 - Le clic sur la radio courante propose maintenant 10 radios alternatives au lieu des dernieres radios selectionnees

### Modifié

  - Nom des builds avec numero de version 
  - Format des releases desktop aligne sur: Windows `.zip` + `.msi`, macOS `.dmg`, Linux `.tar.gz` + `.AppImage`

## [1.0.30] - 2026-04-3

 ### Modifié

 - Modification des build-script: N° de version dans le nom
 - Selection de repertoire pour la lecture d'audio locale 


## [1.0.29] - 2026-04-3

 ### Modifié

  - Persistance du thème et du type d’horloge
  - recherche bug page web version ordinateur
  - Thèmes plus coherents


## [1.0.28] - 2026-04-3

 ### Modifié

 - Version web fonctionnelle recherche bug ecran blanc
 - lecture audio de plusieurs fichiers sous macOS

## [1.0.27] - 2026-04-3

 ### Modifié

 - Version web fonctionnelle 
 - Suppression barre du bas et resize auto horloge analogique sous macOS
 
## [1.0.26] - 2026-04-2

 ### Modifié

 - Plein ecran mode mobile via double tap
 - Affichage analogique sous macOS

## [1.0.25] - 2026-04-2

 ### Modifié

 - Forcage plein ecran mode mobile
 - Affichage analogique sous macOS

## [1.0.24] - 2026-04-2

 ### Ajouté

 - Splash screen pour la version mobile

 ### Modifié

 - Modif de l'icone du programme
 - Fond clair sur les themes clair en mode seven seg
 - Lecture stream ameliorée 
 - Lecteur audio en mode local ignore les fichiers non audio
 - Réctification affichage horloge analogique en mode mobile


## [1.0.23] - 2026-04-2

 ### Modifié

 - Affichage analogique sous macOS
 - Correction N°3 ecran blanc page web

## [1.0.22] - 2026-04-2

 ### Modifié

 - Correction N°2 ecrans blanc aux build
 - Acces repertoire musique locale via bouton eject
 - Lecture audio commence à la piste

## [1.0.21] - 2026-04-2

 ### Modifié

 - Correction ecrans blanc aux build
 
 ### Ajouté

  - Mode 12/24 avec case a cocher dans options /apparences

## [1.0.20] - 2026-04-1

 ### Ajouté

 - Deploiement d'une github page pour la version web

 ### Modifié

## [1.0.19] - 2026-04-1

 ### Modifié

  - Modification du pictogramme pinceau pour les couleurs d'alarme
  - Modif nom programme -> Clock.l.m
  - Ajout d'espace dans l'heure pour l'horloge "Seven seg"

## [1.0.18] - 2026-04-1

 ### Modifié

  - Agencement de l'horloge à lamelles

## [1.0.17] - 2026-04-1

 ### Modifié

  - Correction build macOS
  - Agencement de l'horloge "Seven segments" date + cloche 
  - L'affichage de la date est en option
  - Modification de la logique d'affichage des alarmes en mode analogique


## [1.0.16] - 2026-04-1

 ### Modifié

  - Le build macOS propose mainteant un fichier de type intel
  - Ajout de captures d'écran dans le readme

## [1.0.15] - 2026-03-31

 ### Ajouté

  - Correctifif tags multi radio
  - Ajout d'un fichier Appimage dans la sortie de build Linux

## [1.0.14] - 2026-03-31

### Ajouté
 
 - Icone minimaliste pour le lecteur audio
 - Récuperation des tags pour le Djam
 - Tags en transparence

## [1.0.13] - 2026-03-31

### Modifié

 - Refonte de la fenêtre options
 - Refonte de la fenêtre alarmes
 - Possibilité de mettre en place 5 alarmes
 - Combobox de choix de frequence de l'alarme
 - Couleurs parametrables pour chaque alarme 

## [1.0.12] - 2026-03-31

### Ajouté

 - Maj version affichée en bas a droite auto
 - Affichage icone + nom prog + verion dans fenetre option

## [1.0.11] - 2026-03-31

### Ajouté
 
 - Autoplay musique locale & et radio @
 - Pictograme sur le bouton options
 - Les fenetres se ferment si clique en dehors

## [1.0.10] - 2026-03-30

### Ajouté

 - Icone pour tout les OS
 - Fusion des boutons play & pause
 - bouton eject = choisir musique local ou radio @
 - boutons precedent / suivant uniquement en mode musique locale
 - Bulles infos sur les boutons de navigation audio 

### [1.0.9] - 2026-03-30

### Modifié 

Correctif : déclaration explicite icone Tauro build win

### [1.0.8] - 2026-03-30

### Ajouté

 - Ajouts des icones Tauri oiur multi OS builds

## [1.0.7] - 2026-03-30

### Ajouté

 - Nom du programme + version ajouté en bas à droite de la fenetre
 - Nom du programme cliquable -> lien
 - Le New Djam ajouté à la liste des radios

## [1.0.6] - 2026-03-30

### Ajouté

 - Auto multi build

## [1.0.5] - 2026-03-30

### Modifié

 - Amelioration rendu date 

## [1.0.4] - 2026-03-30

### Modifié

 - Affichage radio - sous titre radio 

### Ajouté

 - + en dessous du nom de la radio: artiste - morceau

## [1.0.3] - 2026-03-30

### Modifié
 
- Changement de source de radio -> Laut.fm
- modification de selecteur de radio


## [1.0.1] - 2026-03-30

### Modifié
 
- La mini horloge uniquement est grisée si l'alarme est désactivée. 


## [1.0.0] - 2026-03-30

### Modifié

- Refonte de la presentation plein ecran pour ne conserver qu'une seule fenetre visuelle.

- Integration du bouton `Options` directement dans la fenetre principale, avec un rendu plus discret.

- Agrandissement de l'horloge analogique pour exploiter au mieux la hauteur et la largeur disponibles.

- Ajustement fin du zoom camera de l'aperçu Three.js pour maximiser la taille du cadran sans depassement.

- Affinage global du cadran analogique: aiguilles, repères, chiffres et cercle exterieur.

- Uniformisation des repères minute et heure sur la couleur principale du theme.

- Passage des aiguilles analogiques sur la couleur d'accent du theme pour ameliorer la lisibilite.

- Reduction des repères horaires pour eviter qu'ils ne masquent les chiffres.

- Alignement des repères horaires sur le meme rayon que les repères des minutes.

- Rapprochement du cercle exterieur du bord des repères, avec une epaisseur tres fine.

- Ajout de la date dans le cadran analogique, avec mise en page sur trois lignes et inversion de couleur au passage des aiguilles.

- Memorisation locale des reglages d'alarme dans le navigateur.

### Ajouté

- Ajout d'une section `Alarmes` dans `Options` avec activation, heure de declenchement et choix de la source audio.

- Ajout d'une lecture de test et d'un arret manuel pour verifier rapidement l'alarme.

- Ajout d'un son d'alarme par defaut `assets/alarm.mp3` utilise quand aucun autre fichier local n'est choisi.

- Ajout d'une selection rapide de 25 radios internet, avec une premiere selection orientee chill pop puis des styles varies.

- Ajout d'un champ permettant de saisir une URL de radio personnalisee.

### Corrigé

- Correction d'un probleme de compilation dans `ClockDisplayGrid` lie a des props manquantes.

## [0.1.0] - Snapshot documented on 2026-03-29

Premiere entree du changelog creee a partir de l'etat actuel du projet.
L'historique Git n'est pas disponible dans ce repertoire, donc cette version
decrit la base existante plutot qu'une suite exacte de commits.

### Ajouté

- Initialisation d'une application TypeScript, React et Vite.

- Integration de Three.js dans le projet.

- Mise en place d'une architecture `features` pour les modules horloges et alarmes.

- Definition de types partages pour les affichages d'horloge et les themes.

- Ajout d'un shell d'application et d'une structure de styles globale.

- Ajout d'un systeme de themes avec selection depuis l'interface.

- Ajout d'un selecteur de mode d'affichage de l'horloge.

- Ajout d'une horloge analogique.

- Ajout d'une horloge numerique type seven-segment.

- Ajout d'une horloge a lamelles de type flip clock.

- Ajout d'un hook de temps systeme pour synchroniser l'affichage.

- Ajout d'un apercu 3D d'horloge avec rendu Three.js.

- Ajout d'une documentation de demarrage dans `README.md`.

- Ajout d'un espace reserve pour un futur module d'alarmes.
