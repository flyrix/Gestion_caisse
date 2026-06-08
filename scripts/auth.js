const Auth = (function() {
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

  async function signIn(identifier, password) {
    let email = identifier;
    if (!identifier.includes('@')) {
      email = await SupabaseDB.getEmailByUsername(identifier);
    }
    return await supabase.auth.signInWithPassword({ email, password });
  }

  async function signOut() {
    return await supabase.auth.signOut();
  }

  async function getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  }

  async function requireAuth() {
    const session = await getSession();
    if (!session) {
      window.location.href = 'index.html';
      return null;
    }
    return session;
  }

  async function redirectIfAuthenticated() {
    const session = await getSession();
    if (session) {
      window.location.href = 'page.html';
    }
    return session;
  }

  function onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange((event, session) => callback(event, session));
  }

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

if (document.body.contains(document.querySelector('#btn-connexion'))) {
  window.addEventListener('load', async () => {
    await Auth.redirectIfAuthenticated();

    const passwordField = document.querySelector('#password');
    const messageBox = document.querySelector('#auth-message');
    const btnConnexion = document.querySelector('#btn-connexion');
    const btnInscription = document.querySelector('#btn-inscription');
    const btnReset = document.querySelector('#btn-reset');

    const showMessage = (text, isError = false) => {
      messageBox.textContent = text;
      messageBox.style.color = isError ? '#c0392b' : '#1f8f55';
    };

    btnConnexion.addEventListener('click', async () => {
      const identifier = document.querySelector('#identifier').value.trim();
      const password = passwordField.value.trim();
      if (!identifier || !password) {
        showMessage('Veuillez renseigner un email ou un nom d’utilisateur, et un mot de passe.', true);
        return;
      }
      const { data, error } = await Auth.signIn(identifier, password);
      if (error) {
        showMessage(error.message, true);
        return;
      }
      if (data.session) {
        window.location.href = 'page.html';
      }
    });

    btnInscription.addEventListener('click', async () => {
      const identifier = document.querySelector('#identifier').value.trim();
      const password = passwordField.value.trim();
      const username = document.querySelector('#signup-username').value.trim();
      if (!identifier || !password || !username) {
        showMessage('Veuillez renseigner un email, un nom d’utilisateur et un mot de passe.', true);
        return;
      }
      if (!identifier.includes('@')) {
        showMessage('Pour créer un compte, entrez une adresse email valide.', true);
        return;
      }
      const email = identifier;
      const { data, error } = await Auth.signUp(email, password, username);
      if (error) {
        showMessage(error.message, true);
        return;
      }
      showMessage('Compte créé. Vérifiez votre email pour confirmer l’inscription.');
    });

    btnReset.addEventListener('click', async () => {
      const identifier = document.querySelector('#identifier').value.trim();
      if (!identifier || !identifier.includes('@')) {
        showMessage('Entrez votre email pour réinitialiser le mot de passe.', true);
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
