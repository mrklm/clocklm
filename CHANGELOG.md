# Changelog

Toutes les evolutions notables de ce projet seront documentees dans ce fichier.

Le format s'inspire de Keep a Changelog, adapte au contexte actuel du depot.


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
