# 🏗️ Architecture - Gestion de Caisse PWA

> Vue d'ensemble complète de l'architecture offline-first avec Mode Invité, Voice, et Sync.

---

## 📐 Diagramme de Flux Principal

```
┌─────────────────────────────────────────────────────────────┐
│                  USER INTERFACE (index.html)                │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Authentification:                                       ││
│  │  • Email/Mot de passe (Supabase)                        ││
│  │  • Mode Invité (localStorage + IndexedDB)              ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│               APP PRINCIPAL (page.html)                     │
│  ┌──────────────────────────────────────────────────────────┐
│  │ • Avatar avec lip-sync (8 PNG visemes)                   │
│  │ • Micro input (Web Speech API - STT)                     │
│  │ • Output TTS (Native Web Audio)                          │
│  │ • Form pour crédits/monnaies                             │
│  │ • Liste des opérations                                   │
│  └──────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────┘
         ↙ (Données brutes)          ↘ (Session user)
┌─────────────────────┐        ┌─────────────────────┐
│   auth.js           │        │   script.js         │
│ • enterGuestMode()  │        │ • Load handler      │
│ • isGuestMode()     │        │ • Event listeners   │
│ • getGuestSession() │        │ • Voice handlers    │
└─────────────────────┘        └─────────────────────┘
         ↓ (Guest session)                ↓
┌─────────────────────────────────────────────────────────────┐
│            DATA LAYER                                       │
│  ┌────────────────────┐         ┌──────────────────────┐   │
│  │  IndexedDB (Local) │◄───────►│  Supabase (Cloud)    │   │
│  │  • caisse-db       │ (online) │  • Real-time sync    │   │
│  │  • operations[]    │          │  • Auth tokens       │   │
│  │  • Persistent ✅   │          │  • PostgreSQL db     │   │
│  └────────────────────┘         └──────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         ↑ (Cached)                      ↑ (Network dependent)
┌─────────────────────────────────────────────────────────────┐
│         SERVICE WORKER (sw.js)                              │
│  • Cache-first strategy                                     │
│  • Offline-capable resource serving                         │
│  • Fallback HTML on network error                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 État de l'App (State Machine)

```
                    ┌─────────┐
                    │  START  │
                    └────┬────┘
                         ↓
                  ┌─────────────┐
                  │ Check Auth  │
                  └────┬────┬───┘
                       │    └──────────────────────┐
                       ↓                           ↓
                  ┌─────────┐             ┌──────────────┐
                  │ ONLINE? │             │ GUEST MODE?  │
                  └────┬────┘             │ Set in page  │
                       │                  └──────┬───────┘
         ┌─────────────┴────────────┐            │
         ↓                          ↓            ↓
    ┌─────────┐            ┌──────────────┐ ┌────────────┐
    │ Supabase│            │ IndexedDB    │ │ IndexedDB  │
    │ Session │            │ (No Supabase)│ │ Guest      │
    │ Online  │            │ (Offline)    │ │ (Offline)  │
    └────┬────┘            └──────┬───────┘ └────┬───────┘
         │                        │              │
         └────────────┬───────────┴──────────────┘
                      ↓
              ┌──────────────────┐
              │ APP READY        │
              │ All ops proceed  │
              │ from IndexedDB   │
              │ (Try Supabase,   │
              │  fallback local) │
              └──────────────────┘
```

---

## 🔐 Couches de Sécurité & Authentification

### Tier 1: Supabase Auth (Online)
```javascript
// scripts/supabase-config.js
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// JWT token in session
// RLS policies enforce user isolation
// Realtime subscriptions sync changes
```

**Sécurité:**
- ✅ Email/Mot de passe hashé (bcrypt Supabase)
- ✅ JWT bearer token en Authorization header
- ✅ RLS row-level security (user_id = auth.uid)
- ✅ Policies: users can only read/write their own ops

### Tier 2: Guest Session (Offline)
```javascript
// scripts/auth.js
localStorage.setItem('guest_id', 'guest_' + Date.now() + '_' + uuid());
localStorage.setItem('is_guest_mode', 'true');
sessionStorage.setItem('guest_session', JSON.stringify({
  user: { id: guestId, email: 'guest@offline', aud: 'guest' },
  is_guest_mode: true
}));
```

**Sécurité:**
- ✅ Unique guest_id per browser
- ✅ sessionStorage (cleared on tab close)
- ✅ localStorage (survives browser close)
- ✅ No network communication
- ⚠️ Browser cache = local security (client-side only)

### Tier 3: IndexedDB (Persistence)
```javascript
// scripts/db.js
// Indexed database, not encrypted
// User-scoped: guest_id or user_id as partition key
// Survives browser close + offline
```

**Sécurité:**
- ✅ Per-user isolation (guest_id vs user_id)
- ⚠️ No encryption (browser native, depends on OS)
- ✅ Cleared by DevTools → Storage → Clear site data

---

## 📦 Components & Modules

### 1. **scripts/auth.js**
| Function | Purpose | Offline |
|---|---|---|
| `supabaseAuth()` | Supabase login/signup | ❌ Online only |
| `enterGuestMode()` | Activate guest session | ✅ Offline capable |
| `isGuestMode()` | Check if guest active | ✅ Offline capable |
| `getGuestSession()` | Retrieve guest data | ✅ Offline capable |
| `logout()` | Clear session | ✅ Works everywhere |

### 2. **scripts/script.js**
| Function | Purpose | Offline |
|---|---|---|
| `loadUser()` | Init session (guest or auth) | ✅ Hybrid |
| `startListening()` | Activate microphone (STT) | ✅ Offline capable |
| `speak()` | Play TTS + animate avatar | ✅ Offline capable |
| `saveOperation()` | Write op to IndexedDB | ✅ Offline capable |
| `loadOperations()` | Read from IndexedDB | ✅ Offline capable |

### 3. **scripts/db.js**
| Function | Purpose | Structure |
|---|---|---|
| `openDB()` | Create/connect IndexedDB | `caisse-db` |
| `saveOperation()` | Write single op | `operations` table |
| `readAll()` | Fetch all ops for user | Filtered by `user_id` or `guest_id` |
| `update()` | Edit existing op | Full replace + timestamp |
| `delete()` | Remove op | Soft/hard delete |

### 4. **scripts/avatar-visemes.js**
| Asset | Count | Resolution |
|---|---|---|
| Viseme images | 8 | 512x512 PNG |
| Mouth shapes | closed, smile_closed, slight_open, medium_open, o_shaped, ah_open, wide_open, teeth_visible | Phoneme-mapped |
| Avatar cycle | ~150ms per viseme | Sync with TTS |

---

## 🌐 Network Strategies

### Online (Supabase + IndexedDB)
```javascript
async function saveOperation(op) {
  try {
    // Try Supabase first (cloud)
    const { data, error } = await supabase
      .from('operations')
      .insert([{ ...op, user_id: user.id }]);
    
    // Also save to IndexedDB (cache layer)
    await db.saveOperation({ ...op, user_id: user.id, synced: true });
    return data;
  } catch (err) {
    console.warn('Supabase offline, using IndexedDB');
    await db.saveOperation({ ...op, user_id: user.id, synced: false });
  }
}
```

**Behavior:**
1. Tries Supabase (online) → inserts + syncs remote
2. Silently caches to IndexedDB (`synced: false`)
3. If network error → IndexedDB only

### Offline (IndexedDB Only)
```javascript
async function saveOperation(op) {
  if (isGuestMode()) {
    // No attempt at Supabase
    await db.saveOperation({ ...op, user_id: guest_id, synced: false });
  } else if (!navigator.onLine) {
    // No internet, IndexedDB only
    await db.saveOperation({ ...op, user_id: user.id, synced: false });
  }
}
```

**Behavior:**
1. Skip Supabase entirely
2. Write directly to IndexedDB
3. Mark as `synced: false` for later merge

### Detection
```javascript
// Automatic offline detection
if (!navigator.onLine || isGuestMode()) {
  // use IndexedDB only
} else {
  // try Supabase first, fallback to IndexedDB
}
```

---

## 🎤 Voice Processing Pipeline

### Speech-to-Text (STT)
```
User speaks into mic
     ↓
Web Speech API (native browser)
     ↓
Transcript recognized
     ↓
Parse amount (regex: extract numbers)
     ↓
Save operation + Show in UI
```

**Offline:** ✅ 100% supported (native browser API)  
**Requirements:** Microphone permission + browser support

### Text-to-Speech (TTS)
```
Text input (greeting or confirmation)
     ↓
Web Speech API (native SpeechSynthesis)
     ↓
Audio plays + Collect phonemes
     ↓
Map to visemes (a/e/i → medium_open, etc.)
     ↓
Cycle through 8 PNG mouth shapes
     ↓
Animation + Audio sync (~150ms granularity)
```

**Offline:** ✅ 100% supported  
**Quality:** Native OS voice engine (no cloud TTS)

---

## 📊 Data Schema (IndexedDB)

### Database: `caisse-db`

#### Table: `operations`
```json
{
  "id": "auto-increment",
  "user_id": "string (uuid or guest_id)",
  "guest_id": "string (if guest mode)",
  "client": "string (optional)",
  "montant": "number (cents)",
  "type": "string (credit/debit/transfer/etc.)",
  "paye": "boolean",
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp",
  "synced": "boolean (false = not yet synced to Supabase)",
  "syncedAt": "ISO timestamp (when last synced)"
}
```

**Indexes:**
- Primary: `id`
- Foreign: `user_id` (Supabase) or `guest_id` (guest mode)
- Query: `user_id + createdAt` range

---

## 🔗 Data Flow (Example: Add €50)

### Scenario A: Online + Supabase
```
User speaks: "cinquante euros"
     ↓
STT recognizes: "cinquante" → 50
     ↓
Form: montant=50, type=credit, client=GuestName
     ↓
Save to Supabase:
  POST /operations { user_id, montant: 50, ... }
     ↓
200 OK → UI updates, synced=true ✅
     ↓
Also save to IndexedDB (backup)
```

### Scenario B: Offline (Guest Mode)
```
User speaks: "cinquante euros"
     ↓
STT recognizes: "cinquante" → 50
     ↓
Form: montant=50, type=credit, client=GuestName
     ↓
Save ONLY to IndexedDB:
  DB.saveOperation({ guest_id, montant: 50, synced: false, ... })
     ↓
✅ Instant, no network
     ↓
Data persists (survives browser close)
```

### Scenario C: Online + Guest Mode (Future: Sync)
```
[Online, but user in guest mode]
     ↓
Check: is_guest_mode && navigator.onLine
     ↓
Option: Migrate Guest → Supabase Account
  (v2 feature: upload all IndexedDB ops as bulk)
```

---

## 🔒 Isolation & Multi-User

### Supabase User (Online)
```
user_id: "550e8400-e29b-41d4-a716-446655440000" (UUID)
     ↓
IndexedDB: operations WHERE user_id = "550e8400-..."
     ↓
Supabase RLS: users can only read WHERE user_id = auth.uid
     ↓
Result: Strict isolation between accounts
```

### Guest Mode (Offline)
```
guest_id: "guest_1234567890_abcdef" (unique per browser)
     ↓
IndexedDB: operations WHERE guest_id = "guest_1234567890_abcdef"
     ↓
No RLS (local only, no server)
     ↓
Result: Isolated per browser/device
```

### Browser Cache (Service Worker)
```
Cache Name: "caisse-cache-v1"
     ↓
Cached: HTML, CSS, JS, images, manifest, sw.js
     ↓
Strategy: Cache-first (return cached, fallback to network)
     ↓
Offline: Serve cached assets (app shell)
```

---

## 📈 Scalability Notes

| Aspect | Current | Limitation | Future |
|---|---|---|---|
| **Users** | 1 per device | localStorage/IndexedDB | Backend partitioning |
| **Operations** | 10k+ | IndexedDB limits (50MB+) | Archive old ops |
| **Realtime** | Per-tab refresh | Polling or Supabase subscribe | WebSocket sync |
| **Avatars** | 8 static visemes | PNG load time | Sprite sheet or WebGL |
| **Voice** | Native browser API | Language packs vary | Fallback UI input |

---

## 🛠️ Technology Stack

```
Frontend:
  • HTML5 (semantic, accessible)
  • CSS3 (flexbox, responsive)
  • JavaScript ES6+ (no transpiler)
  • Service Worker (cache, offline)

Backend (Optional):
  • Supabase (PostgreSQL, Auth, Realtime)

APIs (Browser Native):
  • Web Speech API (STT/TTS)
  • IndexedDB (local persistence)
  • localStorage / sessionStorage (config)
  • Cache API (offline resources)
  • Web App Manifest (PWA)

Build:
  • No build step (vanilla JS)
  • Bash scripts for APK packaging (TWA)
```

---

## 📝 Files Map

```
/
├── index.html ...................... Login page
├── page.html ....................... Main app
├── manifest.json ................... PWA manifest
├── sw.js ........................... Service Worker
├── styles/
│   └── style.css ................... All styling
├── scripts/
│   ├── auth.js ..................... Auth + Guest mode
│   ├── script.js ................... App logic + Voice
│   ├── db.js ....................... IndexedDB wrapper
│   ├── avatar-visemes.js ........... Lip-sync animation
│   ├── supabase.js ................. Supabase client
│   ├── supabase-config.js .......... Config (secrets)
│   └── [build scripts] ............. APK/TWA packaging
├── icons/
│   ├── icon-192.png ................ PWA 192x192
│   ├── icon-512.png ................ PWA 512x512
│   └── avatar-visemes/
│       ├── closed.png .............. Mouth: closed
│       ├── [6 more visemes] ........ Mouth variants
│       └── teeth_visible.png ....... Mouth: wide open
├── docs/
│   ├── GUEST_MODE_GUIDE.md ......... User guide
│   ├── TEST_GUEST_MODE.md .......... Test plan
│   ├── OFFLINE_CAPABILITY_REPORT.md  Technical audit
│   ├── GUIDE_AVATAR_VISEMES.md .... Avatar generation
│   └── ARCHITECTURE_OVERVIEW.md ... This file
└── README.md ....................... Project overview
```

---

## 🚀 Deployment Checklist

- [ ] Supabase project created & schema loaded
- [ ] Service Worker registered (`sw.js` in root)
- [ ] Manifest.json points to domain
- [ ] Icons 192x192 & 512x512 in /icons
- [ ] Avatar visemes generated in /icons/avatar-visemes/
- [ ] HTTPS enabled (PWA requirement)
- [ ] GH Pages hosting configured (for HTTPS)
- [ ] Guest mode tested offline in browser
- [ ] Voice permissions requested + tested
- [ ] IndexedDB persists after browser restart
- [ ] APK signed & tested on Android (optional)

---

## 📚 Related Docs

- [**GUEST_MODE_GUIDE.md**](GUEST_MODE_GUIDE.md) — User quickstart
- [**TEST_GUEST_MODE.md**](TEST_GUEST_MODE.md) — Testing procedures
- [**OFFLINE_CAPABILITY_REPORT.md**](OFFLINE_CAPABILITY_REPORT.md) — Technical diagnosis
- [**GUIDE_AVATAR_VISEMES.md**](GUIDE_AVATAR_VISEMES.md) — Avatar customization
- [**SUPABASE_SETUP.md**](SUPABASE_SETUP.md) — Supabase configuration
