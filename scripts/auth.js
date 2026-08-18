/**
 * MODULE AUTHENTIFICATION - MODE EN LIGNE UNIQUEMENT
 */
const Auth = (function() {

  function getClient() {
    if (typeof SupabaseDB !== 'undefined' && SupabaseDB.client) return SupabaseDB.client;
    if (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
      const url = window.SUPABASE_URL || '';
      const key = window.SUPABASE_ANON_KEY || '';
      if (url && key) return supabase.createClient(url, key);
    }
    return null;
  }

  async function signUp(email, password, username) {
    const client = getClient();
    if (!client) throw new Error("Service d'authentification indisponible.");
    const { data, error } = await client.auth.signUp({ email, password, options: { data: { username } } });
    if (error) throw error;
    if (data && data.user && typeof SupabaseDB !== 'undefined' && typeof SupabaseDB.createProfile === 'function') {
      await SupabaseDB.createProfile(data.user.id, username, email);
    }
    return { data, error };
  }

  async function signIn(identifier, password) {
    const client = getClient();
    if (!client) throw new Error("Service d'authentification indisponible.");
    let email = identifier;
    if (!identifier.includes('@')) {
      if (typeof SupabaseDB !== 'undefined' && typeof SupabaseDB.getEmailByUsername === 'function') {
        email = await SupabaseDB.getEmailByUsername(identifier);
      }
      if (!email) throw new Error("Nom d'utilisateur introuvable.");
    }
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { data, error };
  }

  async function signOut() {
    const client = getClient();
    if (client) try { await client.auth.signOut(); } catch (e) {}
    window.location.href = './index.html';
  }

  async function getSession() {
    const client = getClient();
    if (!client) return null;
    try {
      const { data, error } = await client.auth.getSession();
      if (!error && data && data.session) return data.session;
    } catch (e) {}
    return null;
  }

  async function redirectIfAuthenticated() {
    const session = await getSession();
    if (session) window.location.href = './page.html';
  }

  async function requireAuth() {
    const session = await getSession();
    if (!session) window.location.href = './index.html';
    return session;
  }

  return { signUp, signIn, signOut, getSession, requireAuth, redirectIfAuthenticated, getClient };
})();

/**
 * INITIALISATION DE L'INTERFACE
 */
document.addEventListener('DOMContentLoaded', async () => {
  const isLoginPage  = !!document.getElementById('auth-form');
  const isMainPage   = !!document.getElementById('auth-bar');

  // --- PAGE DE CONNEXION (index.html) ---
  if (isLoginPage) {
    await Auth.redirectIfAuthenticated();

    const authForm          = document.getElementById('auth-form');
    const authTitle         = document.getElementById('auth-title');
    const authDesc          = document.getElementById('auth-desc');
    const btnPrincipal      = document.getElementById('btn-principal');
    const btnBasculer       = document.getElementById('btn-basculer');
    const signupGroup       = document.getElementById('signup-profile-group');
    const signupUsername    = document.getElementById('signup-username');
    const authMessage       = document.getElementById('auth-message');

    let isSignUpMode = false;

    btnBasculer.addEventListener('click', () => {
      isSignUpMode = !isSignUpMode;
      authMessage.textContent = '';
      if (isSignUpMode) {
        authTitle.textContent    = "Inscription";
        authDesc.textContent     = "Créez votre compte pour sauvegarder votre carnet de caisse.";
        btnPrincipal.textContent = "S'inscrire";
        btnBasculer.textContent  = "Déjà un compte ? Se connecter";
        signupGroup.hidden       = false;
        signupUsername.required  = true;
      } else {
        authTitle.textContent    = "Connexion";
        authDesc.textContent     = "Connectez-vous pour accéder à votre carnet de caisse.";
        btnPrincipal.textContent = "Se connecter";
        btnBasculer.textContent  = "Pas de compte ? S'inscrire";
        signupGroup.hidden       = true;
        signupUsername.required  = false;
      }
    });

    document.getElementById('btn-reset').addEventListener('click', async () => {
      const identifier = document.getElementById('identifier').value.trim();
      if (!identifier.includes('@')) {
        authMessage.style.color = '#e74c3c';
        authMessage.textContent = "Veuillez saisir votre adresse email ci-dessus.";
        return;
      }
      const client = Auth.getClient();
      if (!client) return;
      try {
        const { error } = await client.auth.resetPasswordForEmail(identifier);
        authMessage.style.color = error ? '#e74c3c' : '#27ae60';
        authMessage.textContent = error ? error.message : "Email de réinitialisation envoyé !";
      } catch (err) {
        authMessage.style.color = '#e74c3c';
        authMessage.textContent = err.message;
      }
    });

    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      authMessage.style.color = '#94a3b8';
      authMessage.textContent = "Traitement en cours...";
      const identifier = document.getElementById('identifier').value.trim();
      const password   = document.getElementById('password').value;
      try {
        if (isSignUpMode) {
          const username = signupUsername.value.trim();
          if (!username) throw new Error("Veuillez saisir un nom d'utilisateur.");
          await Auth.signUp(identifier, password, username);
          authMessage.style.color = '#27ae60';
          authMessage.textContent = "Compte créé ! Redirection...";
          setTimeout(() => window.location.href = './page.html', 1000);
        } else {
          await Auth.signIn(identifier, password);
          authMessage.style.color = '#27ae60';
          authMessage.textContent = "Connexion réussie ! Redirection...";
          setTimeout(() => window.location.href = './page.html', 800);
        }
      } catch (err) {
        authMessage.style.color = '#e74c3c';
        authMessage.textContent = err.message || "Une erreur est survenue.";
      }
    });
  }

  // --- PAGE PRINCIPALE (page.html) ---
  if (isMainPage) {
    const session = await Auth.requireAuth();
    if (!session) return;

    const authBar    = document.getElementById('auth-bar');
    const userEmail  = document.getElementById('user-email');
    const btnDeco    = document.getElementById('btn-deconnexion');

    if (authBar) authBar.hidden = false;
    if (userEmail) userEmail.textContent = session.user.email || "Utilisateur";
    if (btnDeco) btnDeco.addEventListener('click', () => Auth.signOut());
  }
});
