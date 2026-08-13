# 🧪 Plan de Test - Mode Invité & Offline

> Valider que le Mode Invité fonctionne correctement et que toutes les données persistes en IndexedDB.

---

## 📋 Setup de Test

### Prérequis
- [ ] Navigateur Chrome/Firefox/Safari (cache Service Worker)
- [ ] DevTools ouverts (`F12`) pour inspecter IndexedDB

### Activation du Mode Offline (optionnel)
```
Chrome DevTools → Network tab
  → Checkbox "Offline" (si disponible)
  OU → Throttling: "Offline"
```

---

## ✅ Test 1: Entrée en Mode Invité

**Étapes:**
1. Ouvre [index.html](index.html)
2. **Clique "📱 Utiliser sans connexion (Mode invité)"**
3. Attends redirection vers [page.html](page.html)

**Vérifications:**
- [ ] Page se charge sans erreur
- [ ] Avatar s'affiche avec message de bienvenue
- [ ] Email affiché dans le coin = `guest@offline` ou ID invité

**DevTools Check:**
```javascript
// DevTools → Console
localStorage.getItem('guest_id'); // Retourne: "guest_1234567890_abcdef"
localStorage.getItem('is_guest_mode'); // Retourne: "true"
JSON.parse(sessionStorage.getItem('guest_session')); // Retourne: { user: {...}, is_guest_mode: true }
```

---

## ✅ Test 2: Fonctionnalités Basic Offline

**Étapes:**
1. Ajoute une nouvelle monnaie/crédit (ex: "Test Invité 100€")
2. Attends ~2 secondes
3. **Inspecte IndexedDB** (DevTools → Application → IndexedDB)

**Vérifications:**
- [ ] Nouvelle entrée crée dans `caisse-db` → `operations`
- [ ] Données contiennent ID, montant, timestamp, mode=`guest`

**DevTools Check:**
```javascript
// DevTools → Console
await db.readAll(); 
// Affiche les opérations en IndexedDB
```

---

## ✅ Test 3: Persistence Après Fermeture

**Étapes:**
1. Ajoute plusieurs opérations différentes (5+)
2. **Ferme complètement le navigateur**
3. Relance navigateur, ouvre [page.html](page.html)

**Vérifications:**
- [ ] Mode Invité se réactive automatiquement
- [ ] **Toutes les opérations sont encore là** ✅
- [ ] Avatar affiche message "Bon retour !" ou équivalent

---

## ✅ Test 4: Voice Input Offline

**Étapes:**
1. Clique sur le microphone 🎤 (toujours en mode invité)
2. Parle : "Cinquante euros" ou équivalent
3. STT (Speech-to-Text) devrait reconnaître

**Vérifications:**
- [ ] Texte apparait dans le champ de saisie
- [ ] Avatar bouge la bouche (visemes) 🗣️
- [ ] Son TTS sort du haut-parleur (si volume ON)
- [ ] Opération créée = `["Cinquante euros", "invité_..."]`

**Note:** Web Speech API fonctionne **100% offline** (pas de cloud requis).

---

## ✅ Test 5: Reconnexion Online (Future)

**Étapes:**
1. Avec mode invité actif, **relance la connexion réseau**
2. Attends 3-5 secondes
3. Inspecte les appels réseau (DevTools → Network)

**Vérifications (v1 - pas de sync encore)**
- [ ] **Pas d'erreur Supabase**
- [ ] Données locales sont préservées
- [ ] App continue de fonctionner offline

**Note:** v2 aura auto-sync intelligente. Actuellement, invité = offline-only.

---

## ✅ Test 6: Déconnexion & Nettoyage

**Étapes:**
1. Clique "Déconnexion" 
2. Retour à [index.html](index.html)
3. Inspecte localStorage

**Vérifications:**
- [ ] localStorage cleared (`guest_id` = null, `is_guest_mode` = null)
- [ ] sessionStorage cleared (`guest_session` = null)
- [ ] IndexedDB **NOT cleared** (données persistent pour restore)
- [ ] Bouton login "Connexion" est cliquable

---

## ✅ Test 7: Mode Invité → Login

**Étapes:**
1. Retour depuis Test 6 (déconnexion)
2. Rentre email/mdpass de compte existant
3. Clique "Se connecter"

**Vérifications:**
- [ ] Session Supabase se crée
- [ ] Mode invité = false dans sessionStorage
- [ ] Données *anciennes invité* restent en IndexedDB (future fusion)
- [ ] Données Supabase se chargent

---

## 🐛 Debugging - Si ça ne marche pas

### Symptôme: Bouton "Mode Invité" clique mais rien ne se passe
```javascript
// DevTools Console:
Auth.enterGuestMode ? "OK fonction existe" : "ERREUR: Auth non chargé"
// Si erreur: vérifie que auth.js est bien chargé
```

### Symptôme: Pas de persistence entre fermetures
```javascript
// DevTools → Application → IndexedDB → caisse-db
// Si vide = problème IndexedDB
// Solution: Vérifie que db.js est chargé avant script.js
```

### Symptôme: Avatar statique (pas de mouvements de bouche)
```javascript
// DevTools → Network
// Cherche: icons/avatar-visemes/*.png
// Si 404 = images manquent
// Solution: Génère avec generate_visemes.py
```

---

## 📊 Résultats Attendus

| Test | Résultat | Notes |
|---|---|---|
| **Test 1** | ✅ Page charge | Guest ID en localStorage |
| **Test 2** | ✅ IndexedDB créé | Opération sauvegardée |
| **Test 3** | ✅ Persistence | Données survivent fermeture |
| **Test 4** | ✅ Voice ok | STT + TTS offline ✅ |
| **Test 5** | ⏳ Pas sync (v1) | Données safe, pas d'erreur |
| **Test 6** | ✅ Logout clean | localStorage nettoyé |
| **Test 7** | ✅ Auth switch | Mode normal reprend |

---

## 🎯 Acceptance Criteria (AC)

- **AC1:** Mode Invité se lance sans erreur ✅
- **AC2:** Données persisten IndexedDB après fermeture ✅
- **AC3:** Voice fonctionne 100% offline ✅
- **AC4:** Switch auth (invité → normal) fonctionne ✅
- **AC5:** Aucune donnée invité n'est perdue ✅

---

## 📝 Notes de Test

```
Date: [Today]
Navigateur: [Chrome / Firefox / Safari]
URL: file:///[local path]/index.html
Résultats: [ ] PASS  [ ] FAIL  [ ] PARTIAL

Bugs trouvés:
- [Saisir ici]
```

---

## ✨ Validation Finale

- [ ] Tous les tests pass
- [ ] Aucune console error
- [ ] IndexedDB contient données attendues
- [ ] Mode Invité viable pour production ✅

---

**[Retour au Guide]** → [GUEST_MODE_GUIDE.md](GUEST_MODE_GUIDE.md)
