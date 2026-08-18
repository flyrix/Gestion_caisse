/**
 * MODULE AUTHENTIFICATION
 * Gestion transparente de la bascule Online / Offline avec écouteurs d'interface (DOM).
 */
const Auth = (function() {

  function getAuthClient() {
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

  function isGuestMode() {
    return localStorage.getItem('is_guest_mode') === 'true';
  }

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

  function clearGuestState() {
    localStorage.removeItem('is_guest_mode');
    sessionStorage.removeItem('guest_session');
  }

  async function syncGuestDataToAccount(userId) {
    if (!navigator.onLine) return;

    try {
      if (typeof DB !== 'undefined' && typeof DB.getOperations === 'function') {
        const localOps = await DB.getOperations();
        const unSyncedOps = localOps.filter(op => !op.user_id || op.user_id.startsWith('guest_'));

        if (unSyncedOps.length > 0) {
          console.log(`[Sync Auto] Synchronisation de ${unSyncedOps.length} opération(s)...`);

          for (const op of unSyncedOps) {
            const oldLocalId = op.id;
            const payload = { ...op, user_id: userId };

            let savedRecord = null;
            if (typeof SupabaseDB !== 'undefined' && typeof SupabaseDB.saveOperation === 'function') {
              savedRecord = await SupabaseDB.saveOperation(payload, userId);
            }

            if (typeof DB.deleteOperation === 'function' && oldLocalId) {
              await DB.deleteOperation(oldLocalId);
            }
            
            const updatedOp = savedRecord || { ...payload, id: oldLocalId || Date.now() };
            if (typeof DB.saveOperation === 'function') {
              await DB.saveOperation(updatedOp);
            }
          }
          console.log("[Sync Auto] Migration réussie !");
        }
      }
    } catch (err) {
      console.error("[Sync Auto] Erreur de synchronisation :", err.message);
    }
  }

  async function signUp(email, password, username) {
    if (!navigator.onLine) throw new Error("Connexion internet requise pour créer un compte.");
    const client = getAuthClient();
    if (!client) throw new Error("Service d'authentification indisponible.");

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { username } }
    });
    
    if (error) throw error;

    if (data && data.user) {
      if (typeof SupabaseDB !== 'undefined' && typeof SupabaseDB.createProfile === 'function') {
        await SupabaseDB.createProfile(data.user.id, username, email);
      }
      clearGuestState();
      localStorage.removeItem('guest_id');
    }
    return { data, error };
  }

  async function signIn(identifier, password) {
    if (!navigator.onLine) throw new Error("Connexion internet requise.");
    const client = getAuthClient();
    if (!client) throw new Error("Service d'authentification indisponible.");

    let email = identifier;
    if (!identifier.includes('@')) {
      if (typeof SupabaseDB !== 'undefined' && typeof SupabaseDB.getEmailByUsername === 'function') {
        email = await SupabaseDB.getEmailByUsername(identifier);
      }
      if (!email) return { data: { session: null }, error: { message: "Nom d'utilisateur introuvable." } };
    }

    const res = await client.auth.signInWithPassword({ email, password });
    if (res.data && res.data.session) {
      clearGuestState();
      localStorage.removeItem('guest_id');
      await syncGuestDataToAccount(res.data.session.user.id);
    }
    return res;
  }

  async function signOut() {
    clearGuestState();
    localStorage.removeItem('guest_id');

    const client = getAuthClient();
    if (client) {
      try { await client.auth.signOut(); } catch (e) {}
    }

    window.location.href = './index.html';
    return { error: null };
  }

  async function getSession() {
    if (isGuestMode()) {
      return getGuestSession();
    }

    if (navigator.onLine) {
      const client = getAuthClient();
      if (client) {
        try {
          const { data, error } = await client.auth.getSession();
          if (!error && data && data.session) {
            return data.session;
          }
        } catch (e) {
          console.warn("[Auth] Erreur lors de la récupération de la session Supabase.");
        }
      }
    }

    // Si pas de réseau et pas en mode invité explicite, retourner la session locale invitée
    return getGuestSession();
  }

  async function requireAuth() {
    let session = await getSession();
    if (!session) {
      session = await enterGuestMode();
    }
    return session;
  }

  async function redirectIfAuthenticated() {
    if (navigator.onLine && !isGuestMode()) {
      const client = getAuthClient();
      if (client) {
        try {
          const { data } = await client.auth.getSession();
          if (data && data.session) {
            window.location.href = './page.html';
            return data.session;
          }
        } catch(e) {}
      }
    }
    return null;
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
    getAuthClient,
    clearGuestState
  };
})();

/**
 * INITIALISATION DE L'INTERFACE UTILISATEUR
 */
document.addEventListener('DOMContentLoaded', async () => {
  const isLoginPage = !!document.getElementById('auth-form');
  const isMainPage = !!document.getElementById('btn-vocal-main') || !!document.getElementById('auth-bar');

  // 1. SUR INDEX.HTML (Page de connexion)
  if (isLoginPage) {
    await Auth.redirectIfAuthenticated();

    const authForm = document.getElementById('auth-form');
    const authTitle = document.getElementById('auth-title');
    const authDesc = document.getElementById('auth-desc');
    const btnPrincipal = document.getElementById('btn-principal');
    const btnBasculer = document.getElementById('btn-basculer');
    const btnGuest = document.getElementById('btn-guest');
    const signupGroup = document.getElementById('signup-profile-group');
    const signupUsernameInput = document.getElementById('signup-username');
    const authMessage = document.getElementById('auth-message');

    let isSignUpMode = false;

    if (btnBasculer) {
      btnBasculer.addEventListener('click', () => {
        isSignUpMode = !isSignUpMode;
        if (authMessage) authMessage.textContent = '';

        if (isSignUpMode) {
          if (authTitle) authTitle.textContent = "Inscription";
          if (authDesc) authDesc.textContent = "Créez votre compte pour sauvegarder votre carnet de caisse.";
          if (btnPrincipal) btnPrincipal.textContent = "S'inscrire";
          btnBasculer.textContent = "Déjà un compte ? Se connecter";
          if (signupGroup) signupGroup.hidden = false;
          if (signupUsernameInput) signupUsernameInput.required = true;
        } else {
          if (authTitle) authTitle.textContent = "Connexion";
          if (authDesc) authDesc.textContent = "Connectez-vous pour accéder à votre carnet de caisse et synchroniser vos opérations.";
          if (btnPrincipal) btnPrincipal.textContent = "Se connecter";
          btnBasculer.textContent = "Pas de compte ? S'inscrire";
          if (signupGroup) signupGroup.hidden = true;
          if (signupUsernameInput) signupUsernameInput.required = false;
        }
      });
    }

    if (btnGuest) {
      btnGuest.addEventListener('click', async () => {
        if (authMessage) {
          authMessage.style.color = '#27ae60';
          authMessage.textContent = "Lancement du mode invité...";
        }
        await Auth.enterGuestMode();
        window.location.href = './page.html';
      });
    }

    if (authForm) {
      authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (authMessage) {
          authMessage.style.color = '#333';
          authMessage.textContent = "Traitement en cours...";
        }

        const identifier = document.getElementById('identifier').value.trim();
        const password = document.getElementById('password').value;

        try {
          if (isSignUpMode) {
            const username = document.getElementById('signup-username').value.trim();
            if (!username) throw new Error("Veuillez saisir un nom d'utilisateur.");
            
            const { error } = await Auth.signUp(identifier, password, username);
            if (error) throw error;

            if (authMessage) {
              authMessage.style.color = '#27ae60';
              authMessage.textContent = "Compte créé avec succès ! Redirection...";
            }
            setTimeout(() => window.location.href = './page.html', 1000);

          } else {
            const { error } = await Auth.signIn(identifier, password);
            if (error) throw error;

            if (authMessage) {
              authMessage.style.color = '#27ae60';
              authMessage.textContent = "Connexion réussie ! Redirection...";
            }
            setTimeout(() => window.location.href = './page.html', 800);
          }
        } catch (err) {
          if (authMessage) {
            authMessage.style.color = '#e74c3c';
            authMessage.textContent = err.message || "Une erreur est survenue.";
          }
        }
      });
    }
  }

  // 2. SUR PAGE.HTML (Page principale de l'application)
  if (isMainPage) {
    const session = await Auth.requireAuth();
    
    const authBar = document.getElementById('auth-bar');
    const userEmailSpan = document.getElementById('user-email');
    const btnDeconnexion = document.getElementById('btn-deconnexion');

    if (session && session.user) {
      if (authBar) authBar.hidden = false;
      if (userEmailSpan) {
        userEmailSpan.textContent = session.is_guest_mode ? "Invité (Hors-ligne)" : (session.user.email || "Utilisateur");
      }
    }

    if (btnDeconnexion) {
      btnDeconnexion.addEventListener('click', async () => {
        await Auth.signOut();
      });
    }
  }
});

/**
 * GESTION ÉVÉNEMENTS RÉSEAU
 */
window.addEventListener('online', async () => {
  console.log("🌐 [Réseau] Connexion rétablie.");
  if (!Auth.isGuestMode()) {
    const client = Auth.getAuthClient();
    if (client) {
      try {
        const { data } = await client.auth.getSession();
        if (data && data.session && data.session.user) {
          await Auth.syncGuestDataToAccount(data.session.user.id);
        }
      } catch (err) {
        console.warn("[Réseau] Erreur synchronisation online:", err.message);
      }
    }
  }
});