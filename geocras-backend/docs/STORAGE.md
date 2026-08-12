# Stockage images — Cloudinary

## Principe : upload direct signé, jamais via le serveur Node

Ne **jamais** faire transiter un fichier image par le serveur Express (`multer` + upload proxifié) — ça consomme de la bande passante/mémoire serveur pour rien, et ça ne scale pas. À la place :

1. L'app mobile demande une **signature d'upload** au backend (`POST /uploads/sign`).
2. L'app mobile upload le fichier **directement** à Cloudinary avec cette signature.
3. Cloudinary renvoie une URL (`secure_url`) directement à l'app mobile.
4. L'app mobile envoie cette URL au backend dans la requête suivante (ex: `photoUrl` dans `POST /sos`, ou `photos` dans `POST /garages`).

Le serveur Node ne voit jamais le contenu binaire de l'image.

## Setup Cloudinary

1. Créer un compte sur [cloudinary.com](https://cloudinary.com) (tier gratuit : 25 crédits/mois, largement suffisant pour démarrer).
2. Récupérer `Cloud name`, `API Key`, `API Secret` depuis le dashboard → variables d'env `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
3. Créer deux dossiers logiques (via des préfixes de `folder` à l'upload, pas besoin de les créer manuellement) : `geocras/garages/` et `geocras/sos/`.

## Route backend : générer la signature

```ts
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// POST /uploads/sign
export async function signUpload(req: AuthedRequest, res: Response) {
  const { folder } = req.body as { folder: 'garages' | 'sos' };
  const timestamp = Math.round(Date.now() / 1000);

  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder: `geocras/${folder}` },
    process.env.CLOUDINARY_API_SECRET!,
  );

  res.json({
    signature,
    timestamp,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    folder: `geocras/${folder}`,
  });
}
```

Cette route est protégée (JWT) pour éviter que n'importe qui puisse générer des signatures et spammer le compte Cloudinary.

## Côté app mobile : upload direct

```ts
const { signature, timestamp, cloudName, apiKey, folder } = await api.post('/uploads/sign', { folder: 'sos' });

const formData = new FormData();
formData.append('file', { uri: photoUri, type: 'image/jpeg', name: 'photo.jpg' } as any);
formData.append('api_key', apiKey);
formData.append('timestamp', String(timestamp));
formData.append('signature', signature);
formData.append('folder', folder);

const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
  method: 'POST',
  body: formData,
});
const { secure_url } = await response.json();
// secure_url → à envoyer ensuite au backend (ex: POST /sos { photoUrl: secure_url, ... })
```

Cette étape remplace directement le `TODO` déjà laissé dans le prototype (`GarageSosSheet.tsx`, fonction `handlePickPhoto` / `handleSubmit`) — l'image est déjà sélectionnée via `expo-image-picker`, il ne reste qu'à l'uploader avec ce flux avant de soumettre le formulaire.

## Transformations à la volée

Pas besoin de générer plusieurs tailles d'image manuellement — Cloudinary transforme à la demande via l'URL :
```
https://res.cloudinary.com/<cloud>/image/upload/w_400,h_300,c_fill,q_auto/geocras/garages/photo.jpg
```
Utile pour les miniatures dans les listes de garages (`GarageCard`) vs. la photo pleine résolution sur l'écran détail.
