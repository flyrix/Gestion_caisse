# Guide : Avatar 2D avec Visèmes (Lip-Sync)

## Objectif
Créer un avatar réaliste avec synchronisation labiale (**lip-sync**) en utilisant une photo réelle + 8–10 variantes d'expressions de bouche.

## Étape 1 : Générer ou récupérer une photo de base

### Option A : Générer gratuitement une photo IA
- **ThisPersonDoesNotExist.com** : générez un visage aléatoire, téléchargez-le comme image statique
- **Generated.photos** : images gratuites de visages générés par IA
- **Unsplash / Pexels** : recherchez "woman smiling" ou "man speaking" (licence libre)

**Important** : choisir une pose **frontale** avec la bouche **légèrement fermée** (neutre) pour faciliter les retouches.

### Taille recommandée
- **Width** : 300–400px (sera redimensionné à 130px dans l'app)
- **Format** : PNG avec transparence ou JPG

**Enregistrez** cette image comme `avatar-base.png` ou `avatar-base.jpg` dans `icons/` ou `images/`.

---

## Étape 2 : Découper les 8 variantes de visèmes

Utilisez **GIMP (gratuit)** ou **Photoshop** pour créer ces 8 variantes à partir de l'image de base :

| Nom | Description | Phonèmes | Conseil |
|-----|-------------|-----------|---------|
| `closed.png` | Bouche **fermée** (repos) | silence | État par défaut |
| `smile-closed.png` | Bouche **fermée + sourire** | silence joyeux | Améliore l'empathie |
| `slight-open.png` | **Légèrement ouverte** | p, b, m | Ouverture ~2–3px |
| `medium-open.png` | **Ouverture moyenne** | a, e, i | Ouverture ~5–8px |
| `wide-open.png` | **Largement ouverte** | o, u, aw | Ouverture maxale ~12px |
| `o-shaped.png` | **Forme 'O'** (lèvres arrondies) | o, ou, oi | Prononcé et arrondi |
| `e-shaped.png` | **Forme 'E'** (sourire en parlant) | e, é, è | Lèvres étirées |
| `teeth-smile.png` | **Sourire montrant les dents** | variante rire/joie | Optionnel, renforce l'engagement |

### Workflow GIMP

1. **Ouvrir** l'image de base
2. **Dupliquer le calque** 8 fois (une copie = une variante)
3. **Pour chaque calque** :
   - Utiliser l'outil **Lasso** ou **Chemin** pour sélectionner la bouche
   - Utiliser **Pincer/Tirer** ou **Déformation** pour étirer/modifier
   - Ajouter une nouvelle couche si besoin (ex: dents blanches en `teeth-smile.png`)
4. **Exporter chaque variante** en PNG 300×400px

**Astuce** : garder un fichier `.xcf` (format GIMP natif) pour éditer plus tard.

### Résultat
Vous devriez avoir :
```
icons/
├── avatar-visemes/
│   ├── closed.png
│   ├── smile-closed.png
│   ├── slight-open.png
│   ├── medium-open.png
│   ├── wide-open.png
│   ├── o-shaped.png
│   ├── e-shaped.png
│   └── teeth-smile.png
```

---

## Étape 3 : Optimiser les images

Réduisez la taille côté client en utilisant **TinyPNG** ou **ImageOptim** :

```bash
# Exemple avec ImageMagick (gratuit)
convert closed.png -resize 130x130 -quality 85 closed-opt.png

# Ou avec ImageOptim (GUI macOS)
# drag & drop les PNG dans l'app
```

**Résultat** : ~15–25 KB par image, ~200 KB au total pour 8 variantes.

---

## Étape 4 : Intégrer dans le code

Le script `scripts/avatar-visemes.js` charge automatiquement ces 8 images et les bascule lors de `speechSynthesis.boundary`.

### Configuration dans `avatar-visemes.js`

```javascript
const VISEMES = {
  closed: 'icons/avatar-visemes/closed.png',
  smile_closed: 'icons/avatar-visemes/smile-closed.png',
  slight_open: 'icons/avatar-visemes/slight-open.png',
  medium_open: 'icons/avatar-visemes/medium-open.png',
  wide_open: 'icons/avatar-visemes/wide-open.png',
  o_shaped: 'icons/avatar-visemes/o-shaped.png',
  e_shaped: 'icons/avatar-visemes/e-shaped.png',
  teeth_smile: 'icons/avatar-visemes/teeth-smile.png'
};
```

---

## Étape 5 : Test et ajustement

1. **Chargez** `page.html`
2. **Autorisez l'audio** (clic sur la page)
3. **Appuyez sur le micro** et dites quelque chose
4. **Observez** : la bouche devrait changer en temps réel

### Troubleshooting

- **Images ne se chargent pas** : vérifiez les chemins dans `avatar-visemes.js`
- **Bouncing excessif** : augmentez `SWITCH_INTERVAL` (ms entre changements, ex: 200ms)
- **Pas en sync** : l'API `speechSynthesis.boundary` a une granularité limite ; c'est normal

---

## Étape 6 (Optionnel) : Animation avancée

Pour un lip-sync plus fluide, vous pouvez :

1. **Ajouter un 9e visème** : "transitional" (entre deux états)
2. **Utiliser une API phonème** : Web Speech API propose des événements `boundary` mais pas phonème exact
3. **Pré-enregistrer** : si vous enregistrez l'audio, vous pouvez mapper phonèmes → visèmes via une librairie comme **Mimic3** (offline, gratuit)

---

## Outils gratuits recommandés

| Outil | Usage | Lien |
|-------|-------|------|
| **GIMP** | Retouche d'images | https://www.gimp.org |
| **ImageMagick** | Batch resize | https://imagemagick.org |
| **TinyPNG** | Compression | https://tinypng.com |
| **ThisPersonDoesNotExist** | Générer visage IA | https://thispersondoesnotexist.com |
| **Unsplash** | Photos libres | https://unsplash.com |

---

## Résumé

✅ 1 photo de base + 8 variantes = **~200 KB total**  
✅ **100 % offline**, pérenne, pas d'API externe  
✅ Sync labiale **acceptable** pour caisse vocale  
✅ Cache PWA automatique → fonctionne offline  
✅ Temps de création : **~1–2 heures** (GIMP + retouches)

Bon courage ! 🎬
