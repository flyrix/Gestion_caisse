/**
 * MODULE AUTHENTIFICATION (Utilise le contrôleur SupabaseDB)
 * Inclut la gestion du mode Hors-Ligne Automatique et la synchronisation des données Invité.
 */
const Auth = (function() {
  
  // Fonction interne pour récupérer l'instance active du client Supabase
  function getAuthClient() {
    if (!navigator.onLine) {
      return null; // Force null si totalement hors-ligne
    }
    if (typeof SupabaseDB !== 'undefined' && SupabaseDB.client) {
      return SupabaseDB.client;
    }
    // Repli de secours si le contrôleur n'est pas encore totalement prêt
    if (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
      const url = window.SUPABASE_URL || '';
      const key = window.SUPABASE_ANON_KEY || '';
      if (url && key) {
        return supabase.createClient(url, key);
      }
    }
    return null;
  }

  // Synchronise les données locales saisies en Mode Invité/Hors-ligne vers le compte connecté
  async function syncGuestDataToAccount(userId) {
    if (!navigator.onLine) return;
    
    try {
      if (typeof DB !== 'undefined' && typeof DB.getOperations === 'function') {
        const localOps = await DB.getOperations();
        const unSyncedOps = localOps.filter(op => !op.user_id || op.user_id.startsWith('guest_'));

        if (unSyncedOps.length > 0) {
          console.log(`[Sync Auto] Synchronisation de ${unSyncedOps.length} opération(s) hors-ligne vers Supabase...`);
          
          for (const op of unSyncedOps) {
            delete op.id; // Laisse Supabase générer de nouveaux IDs
            op.user_id = userId;
            if (typeof SupabaseDB !== 'undefined' && typeof SupabaseDB.saveOperation === 'function') {
              await SupabaseDB.saveOperation(op);
            }
          }
          console.log("[Sync Auto] Migration des données locales réussie !");
        }
      }
    } catch (err) {
      console.warn("Erreur lors de la synchronisation des données hors-ligne :", err.message);
    }
  }

  // Inscription d'un nouvel utilisateur
  async function signUp(email, password, username) {
    if (!navigator.onLine) {
      throw new Error("Impossible de créer un compte sans connexion internet.");
    }
    const client = getAuthClient();
    if (!client) throw new Error("Le service d'authentification n'est pas joignable.");

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { username }
      }
    });
    
    if (!error && data.user) {
      await SupabaseDB.createProfile(data.user.id, username, email);
    }
    return { data, error };
  }

  // Connexion de l'utilisateur (gère l'E-mail ou le Pseudo)
  async function signIn(identifier, password) {
    if (!navigator.onLine) {
      throw new Error("Connexion réseau impossible. Mode hors-ligne actif.");
    }
    
    const client = getAuthClient();
    if (!client) throw new Error("Le client Supabase n'est pas disponible.");

    let email = identifier;
    if (!identifier.includes('@')) {
      email = await SupabaseDB.getEmailByUsername(identifier);
      if (!email) {
        return { data: { session: null }, error: { message: "Nom d'utilisateur introuvable." } };
      }
    }
    
    const res = await client.auth.signInWithPassword({ email, password });
    
    // Si la connexion réussit, synchroniser les données créées hors-ligne
    if (res.data && res.data.session) {
      await syncGuestDataToAccount(res.data.session.user.id);
    }

    return res;
  }

  // Déconnexion
  async function signOut() {
    if (isGuestMode()) {
      localStorage.removeItem('is_guest_mode');
      localStorage.removeItem('guest_id');
      sessionStorage.removeItem('guest_session');
      window.location.href = './index.html';
      return { error: null };
    }

    const client = getAuthClient();
    if (client) {
      const res = await client.auth.signOut();
      window.location.href = './index.html';
      return res;
    } else {
      window.location.href = './index.html';
      return { error: null };
    }
  }

  // Mode Hors-ligne / Invité : vérification
  function isGuestMode() {
    return localStorage.getItem('is_guest_mode') === 'true';
  }

  // Mode Hors-ligne / Invité : récupération de la session locale
  function getGuestSession() {
    const stored = sessionStorage.getItem('guest_session');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Erreur de lecture de la session locale:", e);
      }
    }
    
    // Si absent mais flag présent, régénérer une session locale
    const guestId = localStorage.getItem('guest_id') || ('guest_' + Date.now());
    return {
      user: { id: guestId, email: 'invito@hors-ligne.local', aud: 'guest' },
      is_guest_mode: true
    };
  }

  // Mode Hors-ligne : activation automatique de la session locale
  async function enterGuestMode() {
    try {
      let guestId = localStorage.getItem('guest_id');
      if (!guestId) {
        guestId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
        localStorage.setItem('guest_id', guestId);
      }
      
      localStorage.setItem('is_guest_mode', 'true');
      
      const guestSession = {
        user: {
          id: guestId,
          email: 'invito@hors-ligne.local',
          aud: 'guest'
        },
        is_guest_mode: true
      };
      
      sessionStorage.setItem('guest_session', JSON.stringify(guestSession));
      return guestSession;
    } catch (e) {
      console.error('Erreur activation automatique mode hors-ligne:', e.message);
      return null;
    }
  }

  // Récupération de la session active (Supabase ou Locale Hors-ligne)
  async function getSession() {
    // 1. Priorité au mode invité/hors-ligne si actif ou si hors-ligne
    if (isGuestMode() || !navigator.onLine) {
      return getGuestSession();
    }

    // 2. Vérifier avec SupabaseDB si disponible
    if (typeof SupabaseDB !== 'undefined' && typeof SupabaseDB.getSession === 'function') {
      try {
        const dbSession = await SupabaseDB.getSession();
        if (dbSession) return dbSession;
      } catch (err) {
        console.warn("Avertissement : Erreur de récupération session via SupabaseDB:", err.message);
      }
    }

    // 3. Repli direct vers le client Supabase
    const client = getAuthClient();
    if (client) {
      try {
        const { data, error } = await client.auth.getSession();
        if (!error && data) return data.session;
      } catch (e) {
        console.warn("Impossible de joindre Supabase.");
      }
    }

    return null;
  }

  // Protection des pages privées (page.html) : Bascule AUTO en hors-ligne si pas de réseau
  async function requireAuth() {
    let session = await getSession();

    // Si pas de session et HORS-LIGNE -> Activation automatique du mode hors-ligne
    if (!session && !navigator.onLine) {
      console.log("[Auth Auto] Hors-ligne détecté : Bascule automatique en mode local.");
      session = await enterGuestMode();
      return session;
    }

    if (!session && !isGuestMode()) {
      window.location.href = './index.html';
      return null;
    }
    return session;
  }

  // Protection de la page de connexion (index.html) : Redirection AUTO si hors-ligne
  async function redirectIfAuthenticated() {
    try {
      // SI HORS-LIGNE -> Redirection AUTOMATIQUE vers page.html sans bloquer l'utilisateur
      if (!navigator.onLine) {
        console.log("[Auth Auto] Réseau indisponible. Redirection automatique vers la caisse hors-ligne...");
        await enterGuestMode();
        window.location.href = './page.html';
        return getGuestSession();
      }

      const session = await getSession();
      if (session) {
        window.location.href = './page.html';
      }
      return session;
    } catch (e) {
      console.warn("Impossible de vérifier la session au démarrage:", e.message);
      return null;
    }
  }

  // Écouteur des changements d'état d'authentification Supabase
  function onAuthStateChange(callback) {
    const client = getAuthClient();
    if (client) {
      return client.auth.onAuthStateChange((event, session) => callback(event, session));
    }
  }

  return {
    signUp,
    signIn,
    signOut,
    getSession,
    requireAuth,
    redirectIfAuthenticated,
    onAuthStateChange,
    enterGuestMode,
    isGuestMode,
    getGuestSession
  };
})();

/**
 * DÉTECTION ET ÉCOUTE AUTOMATIQUE DE L'ÉTAT DU RÉSEAU (ONLINE / OFFLINE)
 */
window.addEventListener('offline', async () => {
  console.warn("📱 [Réseau] Connexion perdue. Passage automatique en mode hors-ligne.");
  await Auth.enterGuestMode();
});

window.addEventListener('online', async () => {
  console.log("🌐 [Réseau] Connexion internet rétablie !");
  // Si un compte Supabase est connecté, tenter de synchroniser les données saisies hors-ligne
  const session = await Auth.getSession();
  if (session && session.user && !session.is_guest_mode) {
    await syncGuestDataToAccount(session.user.id);
  }
});

/**
 * GESTION DYNAMIQUE DE L'INTERFACE GRAPHIQUE (DOM index.html)
 */
if (document.querySelector('#btn-principal')) {
  window.addEventListener('DOMContentLoaded', async () => {
    // Vérification initiale : Si hors-ligne, cette fonction redirige automatiquement vers page.html
    await Auth.redirectIfAuthenticated();

    let isLoginMode = true;

    const authTitle = document.querySelector('#auth-title');
    const authDesc = document.querySelector('#auth-desc');
    const labelIdentifier = document.querySelector('#label-identifier');
    const inputIdentifier = document.querySelector('#identifier');
    const passwordField = document.querySelector('#password');
    const signupGroup = document.querySelector('#signup-profile-group');
    const inputUsername = document.querySelector('#signup-username');
    
    const btnPrincipal = document.querySelector('#btn-principal');
    const btnBasculer = document.querySelector('#btn-basculer');
    const btnReset = document.querySelector('#btn-reset');
    const messageBox = document.querySelector('#auth-message');

    const showMessage = (text, isError = false) => {
      if (messageBox) {
        messageBox.textContent = text;
        messageBox.style.color = isError ? '#ef4444' : '#10b981';
      }
    };

    const basculerMode = () => {
      isLoginMode = !isLoginMode;
      if (messageBox) messageBox.textContent = "";

      if (isLoginMode) {
        if (authTitle) authTitle.textContent = "Connexion";
        if (authDesc) authDesc.textContent = "Connectez-vous pour accéder à votre carnet de caisse et synchroniser vos opérations.";
        if (labelIdentifier) labelIdentifier.textContent = "Email ou nom d'utilisateur";
        if (inputIdentifier) inputIdentifier.placeholder = "votre@exemple.com ou monutilisateur";
        if (signupGroup) signupGroup.hidden = true;
        if (btnPrincipal) btnPrincipal.textContent = "Se connecter";
        if (btnBasculer) btnBasculer.textContent = "Pas de compte ? S'inscrire";
        if (btnReset) btnReset.style.display = "block";
      } else {
        if (authTitle) authTitle.textContent = "Inscription";
        if (authDesc) authDesc.textContent = "Créez un compte pour sauvegarder vos crédits et monnaies en toute sécurité.";
        if (labelIdentifier) labelIdentifier.textContent = "Adresse Email";
        if (inputIdentifier) inputIdentifier.placeholder = "votre@exemple.com";
        if (signupGroup) signupGroup.hidden = false;
        if (btnPrincipal) btnPrincipal.textContent = "Créer mon compte";
        if (btnBasculer) btnBasculer.textContent = "Déjà inscrit ? Se connecter";
        if (btnReset) btnReset.style.display = "none";
      }
    };

    if (btnBasculer) btnBasculer.addEventListener('click', basculerMode);

    if (btnPrincipal) {
      btnPrincipal.addEventListener('click', async () => {
        const identifier = inputIdentifier ? inputIdentifier.value.trim() : '';
        const password = passwordField ? passwordField.value.trim() : '';

        if (isLoginMode) {
          if (!identifier || !password) {
            showMessage('Veuillez renseigner votre identifiant et votre mot de passe.', true);
            return;
          }

          showMessage('Connexion en cours...');
          
          try {
            const { data, error } = await Auth.signIn(identifier, password);
            if (error) {
              showMessage(error.message, true);
              return;
            }
            if (data && data.session) {
              localStorage.removeItem('is_guest_mode');
              localStorage.removeItem('guest_id');
              sessionStorage.removeItem('guest_session');

              window.location.href = './page.html';
            } else {
              showMessage('Session introuvable. Vérifiez vos identifiants.', true);
            }
          } catch (err) {
            showMessage(err.message, true);
          }
        } else {
          const username = inputUsername ? inputUsername.value.trim() : '';
          
          if (!identifier || !password || !username) {
            showMessage('Veuillez remplir tous les champs (Email, Mot de passe et Pseudo).', true);
            return;
          }
          if (!identifier.includes('@')) {
            showMessage('Veuillez entrer une adresse email valide contenant un "@".', true);
            return;
          }

          showMessage('Création du compte en cours...');
          
          try {
            const { data, error } = await Auth.signUp(identifier, password, username);
            if (error) {
              showMessage(error.message, true);
              return;
            }
            
            showMessage('Compte créé avec succès ! Vérifiez votre boîte mail pour confirmer l’inscription.');
            setTimeout(basculerMode, 3000);
          } catch (err) {
            showMessage(err.message, true);
          }
        }
      });
    }

    if (btnReset) {
      btnReset.addEventListener('click', async () => {
        const identifier = inputIdentifier ? inputIdentifier.value.trim() : '';
        if (!identifier || !identifier.includes('@')) {
          showMessage('Veuillez entrer votre adresse email dans le champ du haut pour réinitialiser le mot de passe.', true);
          return;
        }
        
        try {
          const client = getAuthClient();
          if (!client) {
            showMessage("Impossible de contacter le serveur en mode hors-ligne.", true);
            return;
          }

          const { data, error } = await client.auth.resetPasswordForEmail(identifier, {
            redirectTo: window.location.origin + '/page.html'
          });
          if (error) {
            showMessage(error.message, true);
            return;
          }
          showMessage('Email de réinitialisation envoyé.');
        } catch (e) {
          showMessage(e.message, true);
        }
      });
    }

    const btnGuest = document.querySelector('#btn-guest');
    if (btnGuest) {
      btnGuest.addEventListener('click', async () => {
        await Auth.enterGuestMode();
        window.location.href = './page.html';
      });
    }
  });
}