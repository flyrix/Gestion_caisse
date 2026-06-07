# Gestion_caisse

## Authentification et base de données Supabase

1. Créez un projet Supabase sur https://app.supabase.com
2. Ajoutez un utilisateur et activez l'authentification par email/mot de passe.
3. Créez une table `operations` avec les colonnes suivantes :
   - `id` (bigint) : clé primaire
   - `user_id` (uuid)
   - `client` (text)
   - `montant` (integer)
   - `type` (text)
   - `paye` (boolean)
   - `createdAt` (timestamp)
4. Copiez votre URL Supabase et la clé `anon` dans `scripts/supabase-config.js`.

## Page d'authentification

Utilisez `auth.html` pour vous connecter ou créer un compte. L'application redirige automatiquement vers `index.html` lorsque la session est valide.

La connexion accepte :
- un email
- un nom d'utilisateur

Lors de la création d'un compte, vous devez fournir un email valide et un nom d'utilisateur unique.

## Configuration Supabase

1. Créez votre projet sur https://app.supabase.com
2. Exécutez le fichier `supabase-schema.sql` dans le SQL Editor.
3. Activez l'authentification par email/mot de passe.
4. Remplissez `scripts/supabase-config.js` avec votre `SUPABASE_URL` et `SUPABASE_ANON_KEY`.

## Documentation de configuration

Voir aussi `SUPABASE_SETUP.md` pour un guide pas à pas et des instructions sur les policies RLS.

## Génération d'un APK via GitHub Actions

Un workflow est ajouté dans `.github/workflows/build-apk.yml`.
Il construit l'APK à chaque push sur `main` et publie l'APK comme artifact téléchargeable.

Secrets GitHub requis :
- `MANIFEST_URL` : URL complète de `manifest.json` hébergé sur GitHub Pages ou HTTPS
- `PACKAGE_ID` : identifiant de package Android, par exemple `com.monentreprise.caisse`
