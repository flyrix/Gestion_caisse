# Configuration Supabase pour Gestion de Caisse

## 1. Créer un projet Supabase

1. Allez sur https://app.supabase.com et créez un compte.
2. Créez un nouveau projet.
3. Dans `Project Settings`, copiez :
   - `API URL`
   - `anon key` (public)

## 2. Créer la table `operations`

Dans l'éditeur SQL de Supabase (`SQL Editor > New Query`), collez le contenu de `supabase-schema.sql` et exécutez-le.

## 3. Activer l'authentification par email/mot de passe

1. Allez dans `Authentication > Settings > External OAuth Providers` si nécessaire.
2. Dans `Authentication > Settings > Email`, activez `Enable email confirmations` si vous voulez confirmation par email.
3. Vérifiez que `Email` est activé comme fournisseur.

## 4. Configurer Row Level Security (RLS)

La requête `supabase-schema.sql` active déjà RLS et crée une policy permettant à chaque utilisateur de lire/écrire uniquement ses propres opérations.

## 5. Remplir la configuration locale

Ouvrez `scripts/supabase-config.js` et remplacez :

```js
window.SUPABASE_URL = "https://YOUR_PROJECT_ID.supabase.co";
window.SUPABASE_ANON_KEY = "YOUR_ANON_KEY";
```

par les valeurs de votre projet Supabase.

## 6. Tester l'authentification

1. Ouvrez `auth.html` dans votre navigateur (depuis GitHub Pages ou local via un serveur HTTPS si possible).
2. Créez un compte en renseignant un email valide et un nom d'utilisateur.
3. Une fois créé, vous pouvez vous connecter en utilisant soit votre email, soit votre nom d'utilisateur.
4. Vous devez être redirigé vers `index.html`.

## 7. Tester la synchronisation des opérations

1. Ajoutez une opération.
2. Vérifiez dans Supabase que la ligne a bien été enregistrée dans `operations`.
3. Ouvrez l'application avec un autre compte : vous ne devez voir que vos propres données.

## 8. Déployer sur GitHub Pages

1. Poussez le dépôt sur GitHub.
2. Activez GitHub Pages dans les paramètres du repo (`main` branch, dossier `/root`).
3. Vérifiez que `https://<votre-utilisateur>.github.io/<repo>/auth.html` et `index.html` sont accessibles.

## 9. Générer l'APK sur GitHub Actions

1. Créez les secrets GitHub :
   - `MANIFEST_URL` = URL complète de `manifest.json` sur GitHub Pages
   - `PACKAGE_ID` = `com.votreentreprise.caisse`
2. Poussez sur `main`.
3. Allez dans l'onglet `Actions`, ouvrez le workflow `Build APK`, et téléchargez l'artifact `apk-files`.
