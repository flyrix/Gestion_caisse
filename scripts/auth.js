/**
 * MODULE AUTHENTIFICATION
 * Gestion automatique de la bascule Online/Offline et synchronisation transparente.
 */
const Auth = (function() {

  // Récupère l'instance active du client Supabase
  function getAuthClient() {
    if (!navigator.onLine) return null;
    if (typeof SupabaseDB !== 'undefined' && SupabaseDB.client) {
      return SupabaseDB.client;
    }
    if (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
      const url = window.SUPABASE_URL || '';
      const key = window.SUPABASE_ANON_KEY || '';
      if (url && key) {
        return supabase.createClient(url, key);
      }
    }
    return null;
  }

  // Vérifie si le drapeau invité est actif
  function isGuestMode() {
    return localStorage.getItem('is_guest_mode') === 'true';
  }

  // Active le mode hors-ligne
  async function enterGuestMode() {
    let guestId = localStorage.getItem('guest_id');
    if (!guestId) {
      guestId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('guest_id', guestId);
    }
    localStorage.setItem('is_guest_mode', 'true');

    const guestSession = {
      user: { id: guestId, email: 'invito@hors-ligne.local', aud: 'guest' },
      is_guest_mode: true
    };
    sessionStorage.setItem('guest_session', JSON.stringify(guestSession));
    return guestSession;
  }

  // Récupère la session invité locale
  function getGuestSession() {
    const stored = sessionStorage.getItem('guest_session');
    if (stored) {
      try { return JSON.parse(stored); } catch (e) {}
    }
    const guestId = localStorage.getItem('guest_id') || ('guest_' + Date.now());
    return {
      user: { id: guestId, email: 'invito@hors-ligne.local', aud: 'guest' },
      is_guest_mode: true
    };
  }

  // Synchronise les données IndexedDB créées en mode hors-ligne vers Supabase
  async function syncGuestDataToAccount(userId) {
    if (!navigator.onLine) return;

    try {
      if (typeof DB !== 'undefined' && typeof DB.getOperations === 'function') {
        const localOps = await DB.getOperations();
        // Filtrer les opérations qui appartiennent au mode hors-ligne / invité
        const unSyncedOps = localOps.filter(op => !op.user_id || op.user_id.startsWith('guest_'));

        if (unSyncedOps.length > 0) {
          console.log(`[Sync Auto] Synchronisation de ${unSyncedOps.length} opération(s) hors-ligne vers Supabase...`);

          for (const op of unSyncedOps) {
            // On prépare la donnée pour Supabase
            const payload = { ...op, user_id: userId };
            delete payload.id; // Supabase attribue son propre ID

            // 1. Enregistrement sur le serveur Supabase
            if (typeof SupabaseDB !== 'undefined' && typeof SupabaseDB.saveOperation === 'function') {
              await SupabaseDB.saveOperation(payload);
            }

            // 2. Mise à jour locale dans IndexedDB avec le vrai user_id
            op.user_id = userId;
            if (typeof DB.saveOperation === 'function') {
              await DB.saveOperation(op);
            }
          }
          console.log("[Sync Auto] Migration réussie ! Toutes les données hors-ligne sont envoyées à Supabase.");
        }
      }
    } catch (err) {
      console.error("[Sync Auto] Erreur de synchronisation :", err.message);
    }
  }

  // Inscription
  async function signUp(email, password, username) {
    if (!navigator.onLine) throw new Error("Connexion internet requise pour créer un compte.");
    const client = getAuthClient();
    if (!client) throw new Error("Service d'authentification indisponible.");

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { username } }
    });
    if (!error && data.user) {
      await SupabaseDB.createProfile(data.user.id, username, email);
    }
    return { data, error };
  }

  // Connexion
  async function signIn(identifier, password) {
    if (!navigator.onLine) throw new Error("Connexion internet requise.");
    const client = getAuthClient();
    if (!client) throw new Error("Service d'authentification indisponible.");

    let email = identifier;
    if (!identifier.includes('@')) {
      email = await SupabaseDB.getEmailByUsername(identifier);
      if (!email) return { data: { session: null }, error: { message: "Nom d'utilisateur introuvable." } };
    }

    const res = await client.auth.signInWithPassword({ email, password });
    if (res.data && res.data.session) {
      localStorage.removeItem('is_guest_mode');
      localStorage.removeItem('guest_id');
      sessionStorage.removeItem('guest_session');
      await syncGuestDataToAccount(res.data.session.user.id);
    }
    return res;
  }

  // Déconnexion
  async function signOut() {
    localStorage.removeItem('is_guest_mode');
    localStorage.removeItem('guest_id');
    sessionStorage.removeItem('guest_session');

    const client = getAuthClient();
    if (client) await client.auth.signOut();

    window.location.href = './index.html';
    return { error: null };
  }

  // Obtention de la session active
  async function getSession() {
    // Si hors-ligne, forcer la session invité
    if (!navigator.onLine) {
      return getGuestSession();
    }

    // Si en ligne, chercher la vraie session Supabase
    const client = getAuthClient();
    if (client) {
      try {
        const { data } = await client.auth.getSession();
        if (data && data.session) {
          // On supprime le flag invité si la session utilisateur existe
          localStorage.removeItem('is_guest_mode');
          return data.session;
        }
      } catch (e) {
        console.warn("[Auth] Impossible d'atteindre Supabase.");
      }
    }

    // Repli en mode invité si explicitement activé
    if (isGuestMode()) {
      return getGuestSession();
    }

    return null;
  }

  // Garde de sécurité pour page.html
  async function requireAuth() {
    let session = await getSession();
    if (!session && !navigator.onLine) {
      session = await enterGuestMode();
      return session;
    }
    if (!session && !isGuestMode()) {
      window.location.href = './index.html';
      return null;
    }
    return session;
  }

  // Garde de sécurité pour index.html
  async function redirectIfAuthenticated() {
    if (!navigator.onLine) {
      await enterGuestMode();
      window.location.href = './page.html';
      return getGuestSession();
    }
    const session = await getSession();
    if (session) {
      window.location.href = './page.html';
    }
    return session;
  }

  return {
    signUp,
    signIn,
    signOut,
    getSession,
    requireAuth,
    redirectIfAuthenticated,
    enterGuestMode,
    isGuestMode,
    getGuestSession,
    syncGuestDataToAccount,
    getAuthClient
  };
})();

/**
 * ÉCOUTEURS D'ÉVÉNEMENTS RÉSEAU AUTOMATIQUES
 */
window.addEventListener('offline', async () => {
  console.warn("📱 [Réseau] Déconnexion détectée. Passage en mode hors-ligne.");
  await Auth.enterGuestMode();
});

window.addEventListener('online', async () => {
  console.log("🌐 [Réseau] Connexion rétablie ! Analyse de la session...");

  const client = Auth.getAuthClient();
  if (client) {
    try {
      // 1. Récupérer la session Supabase du compte
      const { data } = await client.auth.getSession();
      
      if (data && data.session && data.session.user) {
        const userId = data.session.user.id;
        console.log(`[Réseau] Session retrouvée pour : ${data.session.user.email}`);

        // 2. Nettoyer le drapeau hors-ligne
        localStorage.removeItem('is_guest_mode');
        sessionStorage.removeItem('guest_session');

        // 3. Envoyer les données créées hors-ligne vers Supabase
        await Auth.syncGuestDataToAccount(userId);

        // 4. Recharger la page pour afficher l'application en mode connecté
        window.location.reload();
        return;
      }
    } catch (err) {
      console.warn("[Réseau] Erreur lors de la réhydratation de la session :", err.message);
    }
  }

  console.log("[Réseau] Pas de compte utilisateur actif. Maintien du mode invité.");
});