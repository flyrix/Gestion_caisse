/**
 * MODULE AUTHENTIFICATION (Utilise le contrôleur SupabaseDB)
 * Inclut la gestion du mode Hors-Ligne et la synchronisation des données Invité.
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

  // Synchronise les données locales saisies en Mode Invité vers le compte connecté
  async function syncGuestDataToAccount(userId) {
    if (!navigator.onLine) return;
    
    try {
      // Vérifier si IndexedDB ou la base locale (DB / DBLocal) possède des opérations d'invité
      if (typeof DB !== 'undefined' && typeof DB.getOperations === 'function') {
        const localOps = await DB.getOperations();
        
        // CORRECTION 1 : Remplacement de un-syncedOps par unSyncedOps
        const unSyncedOps = localOps.filter(op => !op.user_id || op.user_id.startsWith('guest_'));

        if (unSyncedOps.length > 0) {
          console.log(`[Sync] Synchronisation de ${unSyncedOps.length} opération(s) invité vers le compte...`);
          
          for (const op of unSyncedOps) {
            delete op.id; // Laisse Supabase générer de nouveaux IDs
            op.user_id = userId;
            if (typeof SupabaseDB !== 'undefined' && typeof SupabaseDB.saveOperation === 'function') {
              await SupabaseDB.saveOperation(op);
            }
          }
          console.log("[Sync] Migration des données locales réussie !");
        }
      }
    } catch (err) {
      console.warn("Erreur lors de la synchronisation des données invité :", err.message);
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
      throw new Error("Connexion impossible sans réseau. Utilisez le 'Mode invité' hors-ligne.");
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
    
    // Si la connexion réussit et que l'utilisateur était en mode invité, synchroniser
    if (res.data && res.data.session && isGuestMode()) {
      await syncGuestDataToAccount(res.data.session.user.id);
    }

    return res;
  }

  // Déconnexion de la session actuelle (Supabase ou Mode Invité)
  async function signOut() {
    // Si nous sommes en mode invité, réinitialiser la session locale
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
      // Fallback si hors-ligne lors du logout
      window.location.href = './index.html';
      return { error: null };
    }
  }

  // Mode Invité : vérification
  function isGuestMode() {
    return localStorage.getItem('is_guest_mode') === 'true';
  }

  // Mode Invité : récupération de la session locale
  function getGuestSession() {
    const stored = sessionStorage.getItem('guest_session');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Erreur de lecture de la session invité:", e);
      }
    }
    // Si le flag localStorage existe mais que sessionStorage a été réinitialisé
    if (isGuestMode()) {
      const guestId = localStorage.getItem('guest_id') || ('guest_' + Date.now());
      return {
        user: { id: guestId, email: 'guest@offline', aud: 'guest' },
        is_guest_mode: true
      };
    }
    return null;
  }

  // Récupération sécurisée de la session active (Supabase ou Invité)
  async function getSession() {
    // 1. Priorité au mode invité si activé
    if (isGuestMode()) {
      return getGuestSession();
    }

    // Si totalement hors-ligne et pas en mode invité, retourner null
    if (!navigator.onLine) {
      return null;
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
        console.warn("Impossible de joindre Supabase pour la vérification de session (Hors-ligne).");
      }
    }

    return null;
  }

  // Protection des pages privées : redirige vers l'accueil si non connecté
  async function requireAuth() {
    const session = await getSession();
    if (!session && !isGuestMode()) {
      window.location.href = './index.html';
      return null;
    }
    return session;
  }

  // Protection de la page d'accueil : redirige vers le carnet si déjà connecté
  async function redirectIfAuthenticated() {
    try {
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

  // Mode Invité : création d'une session locale sans Supabase
  async function enterGuestMode() {
    try {
      let guestId = localStorage.getItem('guest_id');
      if (!guestId) {
        guestId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
        localStorage.setItem('guest_id', guestId);
      }
      
      localStorage.setItem('is_guest_mode', 'true');
      
      // Créer un objet session simulé
      const guestSession = {
        user: {
          id: guestId,
          email: 'guest@offline',
          aud: 'guest'
        },
        is_guest_mode: true
      };
      
      // Stocker en session storage pour accès rapide
      sessionStorage.setItem('guest_session', JSON.stringify(guestSession));
      
      return guestSession;
    } catch (e) {
      console.error('Erreur mode invité:', e.message);
      return null;
    }
  }

  // Écouteur des changements d'état de l'authentification (login/logout)
  function onAuthStateChange(callback) {
    const client = getAuthClient();
    if (client) {
      return client.auth.onAuthStateChange((event, session) => callback(event, session));
    }
  }

  // Exposition des fonctions publiques
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
 * GESTION DYNAMIQUE DE L'INTERFACE GRAPHIQUE (DOM)
 * S'exécute uniquement si nous sommes sur la page index.html (page d'authentification)
 */
// CORRECTION 2 : Vérification directe de l'élément pour éviter les erreurs null dans le DOM
if (document.querySelector('#btn-principal')) {
  window.addEventListener('DOMContentLoaded', async () => {
    // Si l'utilisateur a déjà un jeton de session valide ou est invité, on l'envoie sur le carnet
    await Auth.redirectIfAuthenticated();

    // Variable d'état pour suivre le mode actuel (true = Connexion, false = Inscription)
    let isLoginMode = true;

    // Sélection des éléments du DOM
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

    // Fonction utilitaire pour afficher les messages de retour à l'utilisateur
    const showMessage = (text, isError = false) => {
      if (messageBox) {
        messageBox.textContent = text;
        messageBox.style.color = isError ? '#ef4444' : '#10b981';
      }
    };

    // Alerte automatique si l'utilisateur ouvre la page hors-ligne
    if (!navigator.onLine) {
      showMessage("📱 Vous êtes hors-ligne. Utilisez le 'Mode invité' ci-dessous pour accéder à vos données locales.", false);
    }

    // Fonction pour basculer visuellement l'interface entre Connexion et Inscription
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

    // Écouteur sur le bouton secondaire pour changer de mode
    if (btnBasculer) btnBasculer.addEventListener('click', basculerMode);

    // Écouteur sur le bouton principal (Exécute soit la connexion, soit l'inscription)
    if (btnPrincipal) {
      btnPrincipal.addEventListener('click', async () => {
        const identifier = inputIdentifier ? inputIdentifier.value.trim() : '';
        const password = passwordField ? passwordField.value.trim() : '';

        if (isLoginMode) {
          // --- TRAITEMENT DE LA CONNEXION ---
          if (!identifier || !password) {
            showMessage('Veuillez renseigner votre identifiant et votre mot de passe.', true);
            return;
          }

          if (!navigator.onLine) {
            showMessage("Impossible de se connecter sans réseau. Cliquez sur 'Utiliser sans connexion'.", true);
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
              // Nettoyage des flags du Mode Invité lors de la connexion réussie
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
          // --- TRAITEMENT DE L'INSCRIPTION ---
          const username = inputUsername ? inputUsername.value.trim() : '';
          
          if (!identifier || !password || !username) {
            showMessage('Veuillez remplir tous les champs (Email, Mot de passe et Pseudo).', true);
            return;
          }
          if (!identifier.includes('@')) {
            showMessage('Veuillez entrer une adresse email valide contenant un "@".', true);
            return;
          }

          if (!navigator.onLine) {
            showMessage("Impossible de créer un compte hors-ligne.", true);
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

    // --- TRAITEMENT DU MOT DE PASSE OUBLIÉ ---
    if (btnReset) {
      btnReset.addEventListener('click', async () => {
        if (!navigator.onLine) {
          showMessage("Action impossible en mode hors-ligne.", true);
          return;
        }

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

    // --- BOUTON MODE INVITÉ / HORS-LIGNE ---
    const btnGuest = document.querySelector('#btn-guest');
    if (btnGuest) {
      btnGuest.addEventListener('click', async () => {
        showMessage('Activation du mode invité...');
        try {
          const guestSession = await Auth.enterGuestMode();
          if (guestSession) {
            setTimeout(() => {
              window.location.href = './page.html';
            }, 300);
          } else {
            showMessage('Erreur lors de l\'activation du mode invité.', true);
          }
        } catch (err) {
          showMessage(err.message, true);
        }
      });
    }
  });
}