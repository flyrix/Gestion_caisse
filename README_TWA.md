Guide: Générer un APK Android via TWA (Bubblewrap)
=================================================

Préambule
--------
Ce guide explique comment transformer votre PWA hébergée (https) en APK Android à l'aide de Trusted Web Activity (Bubblewrap).

Prérequis
---------
- Node.js et npm
- Java JDK (11+)
- Android SDK (platform-tools, build-tools, tools)
- npm global: `@bubblewrap/cli`
- Votre site doit être accessible via HTTPS et exposer `manifest.json` correctement (icônes 192x192 et 512x512).

Étapes rapides
---------------
1. Installer Bubblewrap:

```bash
npm install -g @bubblewrap/cli
```

2. Vérifier que `manifest.json` est accessible, par ex. https://votre-site/manifest.json

3. Initialiser le projet TWA (non interactif possible):

```bash
# Exemple non interactif (remplacez les valeurs)
bubblewrap init --manifestUrl=https://votre-site/manifest.json --packageId=com.votreentreprise.caisse --appVersionName=1.0.0 --appVersionCode=1
```

4. Construire l'APK:

```bash
bubblewrap build
```

5. Le résultat et les apks signés sont placés dans `./output` ou `./build` selon la version de Bubblewrap.

Générer et utiliser une keystore (si vous n'en avez pas)
---------------------------------------------------
Pour publier et signer définitivement votre APK, créez une keystore:

```bash
keytool -genkeypair -v -keystore release-keystore.jks -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

Donnez ensuite le chemin au moment du `bubblewrap build` ou configurez dans `twa-manifest.json`.

Conseils et débogage
--------------------
- Testez d'abord l'application dans Chrome mobile via "Add to Home screen" pour valider manifest/icônes.
- Ouvrez `chrome://inspect` pour déboguer WebView/TWA.
- Si Bubblewrap échoue, vérifiez `ANDROID_HOME` et les outils `sdkmanager`, `adb`, `zipalign` dans le PATH.

Sécurité & distribution
------------------------
- Pour distribuer sans Play Store, fournissez le fichier `.apk` signé depuis votre site (HTTPS) et guidez l'utilisateur pour activer l'installation depuis sources inconnues.
- Pour le Play Store, préférez générer un Android App Bundle (`.aab`) et suivre la publication Google Play.

Fichiers utiles ajoutés dans le repo
-----------------------------------
- `scripts/build_twa.sh` : script d'aide pour automatiser `bubblewrap init` + `bubblewrap build`.
- `scripts/sign_apk.sh` : script pour aligner et signer un APK via `zipalign` et `apksigner`.
- `icons/README.md` : indique les icônes requises pour le manifest.
- `twa-manifest.json` : modèle prêt à l'emploi (remplacez les valeurs `manifestUrl`, `packageId`, et les champs de `signingKey`).

Exemple: build + sign (suite complète)
------------------------------------
1) Initialiser et construire (bubblewrap):

```bash
./scripts/build_twa.sh https://votre-site/manifest.json com.votreentreprise.caisse release-keystore.jks
```

2) Si Bubblewrap produit un APK non aligné/non signé, utilisez le script de signature:

```bash
./scripts/sign_apk.sh path/to/unsigned.apk release-keystore.jks my-key-alias <storepass> <keypass>
```

Remarque: ne commitez jamais vos mots de passe dans le dépôt; utilisez des variables d'environnement ou un gestionnaire de secrets.

Souhaitez-vous que je génère un exemple `twa-manifest.json` configuré ici (je l'ai ajouté), ou que je prépare un script d'automatisation plus poussé pour CI/CD ?

Intégration CI (GitHub Actions)
--------------------------------
Un workflow `build_twa.yml` est inclus dans `.github/workflows/`. Il automatise l'installation de Bubblewrap et la construction de l'APK lorsque vous poussez sur `main`.

Secrets à ajouter dans votre repo GitHub (Settings → Secrets):
- `MANIFEST_URL` = https://votre-site/manifest.json
- `PACKAGE_ID` = com.votreentreprise.caisse
- `KEYSTORE_BASE64` = (contenu base64 du fichier `release-keystore.jks`)

Pour générer `KEYSTORE_BASE64` localement:

```bash
base64 -w 0 release-keystore.jks > keystore.b64
```

Collez le contenu de `keystore.b64` dans le secret.

Après un push sur `main`, l'action construira l'APK et publiera les fichiers produits comme artifact (téléchargeable depuis l'onglet Actions).

