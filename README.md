# NFC Manager

Outil personnel, ultra simple, pour transformer un lien Google Maps en vrai
Google Place ID + lien Google Review, prêt à coller dans NFC Tools.

Pas de comptes, pas de CRM, pas de numéro de carte NFC. Juste :

```
Commune → Établissement → Lien NFC
```

## Workflow

1. Google Maps → Partager → Copier
2. Ouvrir NFC Manager sur l'iPhone
3. Choisir (ou créer) une commune
4. "+ Ajouter un établissement"
5. Coller le lien, cliquer "Analyser"
6. Vérifier la fiche trouvée, "Confirmer"
7. Sur la fiche : "Copier lien NFC"
8. Ouvrir NFC Tools, coller, écrire la carte

## Stack

- Next.js (pages router) + React
- Aucune base de données : les communes et établissements sont stockés en
  `localStorage`, directement sur l'iPhone
- Une seule route API serveur (`/api/resolve-place`) qui appelle l'API
  Google Places pour obtenir un vrai `place_id` — la clé API n'est jamais
  exposée au navigateur

## 1. Installation

```bash
npm install
```

## 2. Configuration Google API

1. Dans la [Google Cloud Console](https://console.cloud.google.com/), créez
   (ou réutilisez) un projet.
2. Activez l'API **Places API** (Legacy) pour ce projet.
3. Créez une clé API et restreignez-la si possible aux API "Places API" et,
   côté serveur, à l'IP/au domaine de votre déploiement Vercel.
4. Copiez `.env.example` vers `.env.local` :

```bash
cp .env.example .env.local
```

5. Renseignez votre clé :

```
GOOGLE_MAPS_API_KEY=votre_vraie_cle
```

⚠️ Ne committez jamais `.env.local` (déjà ignoré par `.gitignore`).

## 3. Lancement en local

```bash
npm run dev
```

Ouvrez `http://localhost:3000`.

## 4. Déploiement sur Vercel

1. Poussez le projet sur GitHub.
2. Sur [vercel.com](https://vercel.com), importez le repo.
3. Dans **Project Settings → Environment Variables**, ajoutez
   `GOOGLE_MAPS_API_KEY` avec votre vraie clé.
4. Déployez. Vous obtenez une URL du type
   `https://nfc-manager.vercel.app`.

## 5. Utilisation sur iPhone

1. Ouvrez l'URL Vercel dans **Safari** (pas Chrome — l'ajout à l'écran
   d'accueil en mode standalone fonctionne mieux dans Safari sur iOS).
2. Appuyez sur **Partager** → **Sur l'écran d'accueil**.
3. L'app s'ouvre ensuite en plein écran, sans barre Safari, comme une vraie
   app.

## 6. Sauvegarde de vos données

Les données vivent uniquement dans le `localStorage` de votre iPhone. Pour
les mettre en sécurité ou les transférer sur un autre appareil :

- **Exporter mes données** → télécharge un fichier `.json`
- **Importer mes données** → restaure ce fichier sur un autre appareil

Pensez à exporter régulièrement — vider les données de site dans Safari
effacerait tout sans sauvegarde.

## 7. Limites volontaires de la V1

- Pas de login / comptes / permissions (usage strictement personnel)
- Pas d'écriture NFC directe depuis l'app (rôle : préparer le lien, pas
  programmer la carte)
- Pas de numéro de carte NFC ou d'inventaire — uniquement
  commune → établissement → lien

## Structure du projet

```
pages/
  index.js            L'app entière (communes, établissements, fiches)
  _app.js
  _document.js         Meta tags iOS / PWA
  api/
    resolve-place.js   Résout un lien Google Maps -> vrai Place ID
lib/
  store.js             Lecture/écriture localStorage + export/import JSON
public/
  manifest.json         Manifest PWA
  icons/                Icônes 192x192 et 512x512
styles/
  globals.css           Style noir/blanc minimaliste, gros boutons
```
