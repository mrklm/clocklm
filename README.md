# Clocklm

Application d'horloge et d'alarme en TypeScript + React + Three.js, avec emballage desktop via Tauri.

## Telechargements

Les builds desktop sont publies automatiquement a chaque tag de version.

### Applications standalone

- Linux
  - `.AppImage`
  - `.deb`
- Windows
  - `.msi`
- macOS
  - `.dmg`

- Toutes les versions : [page Releases](../../releases/latest)

## Objectifs initiaux

- Horloge analogique ronde
- Horloge numerique type seven segment
- Horloge rectangulaire a lamelles
- Extensions futures: alarmes, reglages, options avancees

## Structure

- `src/components`: elements de composition generaux
- `src/features/clocks`: composants et logique des differents affichages
- `src/features/alarms`: futur module pour les alarmes
- `src/three`: integration Three.js
- `src/types`: types partages
- `src/styles`: styles globaux et applicatifs

## Demarrage

```bash
npm install
npm run dev
```

## Desktop Tauri

Le projet embarque maintenant une couche desktop Tauri dans `src-tauri/`.

Commandes utiles :

```bash
npm run tauri:dev
npm run tauri:build
```

## Releases automatiques

Le workflow `.github/workflows/tauri-release.yml` publie automatiquement les builds desktop sur GitHub Releases a chaque push de tag `v*.*.*` ou `*.*.*`.

Plateformes construites :

- Ubuntu
- Windows
- macOS

Formats publies :

- Ubuntu : `.deb`
- Linux : `.AppImage`
- Windows : `.msi`
- macOS : `.dmg`

## Notes

- Le fichier `src-tauri/tauri.conf.json` utilise l'identifiant d'application `com.clocklm.app`.
- Pour une distribution macOS propre hors usage personnel, il faudra ajouter signature et notarisation Apple plus tard.
