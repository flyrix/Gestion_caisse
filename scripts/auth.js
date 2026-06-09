/**
 * MODULE AUTHENTIFICATION (Supabase Auth)
 */
const Auth = (function() {
  // Inscription d'un nouvel utilisateur
  async function signUp(email, password, username) {
    const { data, error } = await supabase.auth.signUp({
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
    let email = identifier;
    if (!identifier.includes('@')) {
      email = await SupabaseDB.getEmailByUsername(identifier);
    }
    return await supabase.auth.signInWithPassword({ email, password });
  }

  // Déconnexion de la session actuelle
  async function signOut() {
    return await supabase.auth.signOut();
  }

  // Récupération de la session active
  async function getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  }

  // Protection des pages privées : redirige vers l'accueil si non connecté
  async function requireAuth() {
    const session = await getSession();
    if (!session) {
      window.location.href = './index.html';
      return null;
    }
    return session;
  }

  // Protection de la page d'accueil : redirige vers le carnet si déjà connecté
  async function redirectIfAuthenticated() {
    const session = await getSession();
    if (session) {
      window.location.href = './page.html';
    }
    return session;
  }

  // Écouteur des changements d'état de l'authentification (login/logout)
  function onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange((event, session) => callback(event, session));
  }

  // Exposition des fonctions publiques
  return {
    signUp,
    signIn,
    signOut,
    getSession,
    requireAuth,
    redirectIfAuthenticated,
    onAuthStateChange
  };
})();

/**
 * GESTION DYNAMIQUE DE L'INTERFACE GRAPHIQUE (DOM)
 * S'exécute uniquement si nous sommes sur la page index.html (page d'authentification)
 */
if (document.body.contains(document.querySelector('#btn-principal'))) {
  window.addEventListener('load', async () => {
    // Si l'utilisateur est déjà connecté, on l'envoie directement sur le carnet de caisse
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
      messageBox.textContent = text;
      messageBox.style.color = isError ? '#c0392b' : '#1f8f55';
    };

    // Fonction pour basculer visuellement l'interface entre Connexion et Inscription
    const basculerMode = () => {
      isLoginMode = !isLoginMode;
      messageBox.textContent = ""; // Nettoyage des anciens messages d'erreur/succès

      if (isLoginMode) {
        authTitle.textContent = "Connexion";
        authDesc.textContent = "Connectez-vous pour accéder à votre carnet de caisse et synchroniser vos opérations.";
        labelIdentifier.textContent = "Email ou nom d'utilisateur";
        inputIdentifier.placeholder = "votre@exemple.com ou monutilisateur";
        signupGroup.hidden = true;
        btnPrincipal.textContent = "Se connecter";
        btnBasculer.textContent = "Pas de compte ? S'inscrire";
        btnReset.style.display = "block";
      } else {
        authTitle.textContent = "Inscription";
        authDesc.textContent = "Créez un compte pour sauvegarder vos crédits et monnaies en toute sécurité.";
        labelIdentifier.textContent = "Adresse Email";
        inputIdentifier.placeholder = "votre@exemple.com";
        signupGroup.hidden = false;
        btnPrincipal.textContent = "Créer mon compte";
        btnBasculer.textContent = "Déjà inscrit ? Se connecter";
        btnReset.style.display = "none";
      }
    };

    // Écouteur sur le bouton secondaire pour changer de mode
    btnBasculer.addEventListener('click', basculerMode);

    // Écouteur sur le bouton principal (Exécute soit la connexion, soit l'inscription)
    btnPrincipal.addEventListener('click', async () => {
      const identifier = inputIdentifier.value.trim();
      const password = passwordField.value.trim();

      if (isLoginMode) {
        // --- TRAITEMENT DE LA CONNEXION ---
        if (!identifier || !password) {
          showMessage('Veuillez renseigner votre identifiant et votre mot de passe.', true);
          return;
        }
        showMessage('Connexion en cours...');
        
        const { data, error } = await Auth.signIn(identifier, password);
        if (error) {
          showMessage(error.message, true);
          return;
        }
        if (data.session) {
          window.location.href = './page.html';
        }
      } else {
        // --- TRAITEMENT DE L'INSCRIPTION ---
        const username = inputUsername.value.trim();
        
        if (!identifier || !password || !username) {
          showMessage('Veuillez remplir tous les champs (Email, Mot de passe et Pseudo).', true);
          return;
        }
        if (!identifier.includes('@')) {
          showMessage('Veuillez entrer une adresse email valide contenant un "@".', true);
          return;
        }
        
        showMessage('Création du compte en cours...');
        
        const { data, error } = await Auth.signUp(identifier, password, username);
        if (error) {
          showMessage(error.message, true);
          return;
        }
        
        showMessage('Compte créé avec succès ! Vérifiez votre boîte mail pour confirmer l’inscription.');
        
        // On repasse automatiquement l'interface en mode connexion après 3 secondes
        setTimeout(basculerMode, 3000);
      }
    });

    // --- TRAITEMENT DU MOT DE PASSE OUBLIÉ ---
    btnReset.addEventListener('click', async () => {
      const identifier = inputIdentifier.value.trim();
      if (!identifier || !identifier.includes('@')) {
        showMessage('Veuillez entrer votre adresse email dans le champ du haut pour réinitialiser le mot de passe.', true);
        return;
      }
      
      const { data, error } = await supabase.auth.resetPasswordForEmail(identifier, {
        redirectTo: window.location.origin + '/page.html'
      });
      if (error) {
        showMessage(error.message, true);
        return;
      }
      showMessage('Email de réinitialisation envoyé.');
    });
  });
}