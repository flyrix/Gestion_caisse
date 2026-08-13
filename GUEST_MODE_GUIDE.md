# Mode Invité (Guest Mode) - Guide Utilisateur

## 📱 Qu'est-ce que le Mode Invité ?

Le **Mode Invité** permet d'utiliser l'app complètement **offline** sans créer de compte Supabase. Toutes les données sont sauvegardées localement en **IndexedDB** et synchronisées automatiquement quand la connexion revient.

---

## ✅ Fonctionnalités en Mode Invité

| Fonctionnalité | Disponible | Notes |
|---|---|---|
| **Gestion des crédits/monnaies** | ✅ | Sauvegarde locale |
| **Reconnaissance vocale (STT)** | ✅ | Marche offline |
| **Synthèse vocale (TTS)** | ✅ | Avatar parle offline |
| **Affichage/Édition** | ✅ | Temps réel local |
| **Persistance** | ✅ | IndexedDB, survit fermeture |
| **Sync Supabase** | ⏳ | Auto-sync au retour online (v2) |

---

## 🚀 Comment activer le Mode Invité

### Sur la page de connexion
1. Ouvre [index.html](index.html)
2. Ignore les champs Email/Mot de passe
3. **Clique sur le bouton vert** : **"📱 Utiliser sans connexion (Mode invité)"**
4. L'app se charge instantanément en mode offline
5. Tous les crédits/monnaies sont sauvegardés localement

### Indicateurs du Mode Invité
- Email affiché : `guest@offline` ✅
- Bouton "Déconnexion" toujours visible
- Aucun appel réseau à Supabase 🚫

---

## 🔄 Retour Online

Quand la connexion revient :
1. **Les données locales restent intactes** ✅
2. **Sync automatique** (en préparation - v2)
3. **Merge intelligent** : pas de duplication, OK pour offline-first

### Actuellement (v1)
- ✅ Mode invité fonctionne 100% offline
- ⏳ Sync manuel disponible après implémentation

---

## 🔐 Sécurité & Confidentialité

| Aspect | Garantie |
|---|---|
| **Données locales** | 🔒 Stockées UNIQUEMENT en IndexedDB (pas d'upload sans consentement) |
| **Pas de compte** | 🚫 Aucune création de compte Supabase |
| **Hors-ligne** | ✈️ Fonctionne 100% offline, zéro appel réseau |
| **Nettoyage** | 🗑️ Clic "Déconnexion" = nettoyage localStorage + sessionStorage |

---

## 💾 Où sont stockées les données ?

```
Browser IndexedDB
├── Database: caisse-db
└── Table: operations
    └── Tous les crédits/monnaies en JSON local
```

**Pas de serveur contacté** sauf si vous créez manuellement un compte.

---

## 🛠️ Workflow Recommandé

### Scénario Offline-First (sans connexion)
```
Visite 1 (offline) → Mode Invité → Utilise l'app → Données en IndexedDB ✅
```

### Scénario 1ère visite Online → puis Offline
```
Visite 1 (online)  → Login Supabase → Sync ✅
                  ↓
Visite 2 (offline) → Session en cache → App fonctionne ✅
                  ↓
Visite 3 (offline) → Session expirée → Mode Invité comme fallback ✅
```

---

## ❓ FAQ

**Q: Puis-je passer du Mode Invité à un compte "vrai" ?**  
R: Oui (v2) — futur: option "Créer un compte + sync" pour uploader les données offline.

**Q: Les données "invité" sont-elles supprimées en quittant l'app ?**  
R: Non ! IndexedDB persiste même après fermeture du navigateur. Clic "Déconnexion" les nettoie explicitement.

**Q: Puis-je avoir plusieurs comptes invité ?**  
R: Non, 1 ID par navigateur/appareil. Chaque [localStorage](app.js) est unique.

**Q: Comment retrouver mes données invité ?**  
R: Elles restent en IndexedDB jusqu'à suppression manuelle ou nettoyage du cache.

---

## 🎯 Prochaines Étapes (v2)

- [ ] **Auto-sync intelligente** au retour online
- [ ] **Merge de données** (deduplicate par ID + timestamp)
- [ ] **Bouton "Migrer vers compte"** — upload invité → Supabase
- [ ] **Indicateur visuel** du statut sync (offline/online/syncing)
- [ ] **Rappel de sync** si données expirées

---

## 📞 Besoin d'aide ?

Consulte [OFFLINE_CAPABILITY_REPORT.md](OFFLINE_CAPABILITY_REPORT.md) pour le diagnostic technique complet.
