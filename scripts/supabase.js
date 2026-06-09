const SupabaseDB = (function() {
  const SUPABASE_URL = window.SUPABASE_URL || '';
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || '';

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('Supabase non configuré : remplissez scripts/supabase-config.js');
  }

  const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      detectSessionInUrl: true
    }
  });

  async function init() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Supabase non configuré');
    }
    await client.auth.getSession();
  }

  async function getSession() {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session;
  }

  async function getUser() {
    const session = await getSession();
    return session?.user || null;
  }

  async function getEmailByUsername(username) {
    if (!username) return null;
    const { data, error } = await client
      .from('profiles')
      .select('email')
      .eq('username', username)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('Erreur Supabase getEmailByUsername', error.message);
      return null;
    }
    return data?.email || null;
  }

  async function createProfile(userId, username, email) {
    if (!userId || !username || !email) return;
    const { error } = await client.from('profiles').upsert({ id: userId, username, email });
    if (error) console.warn('Erreur Supabase createProfile', error.message);
  }

  async function fetchOperations(userId) {
    if (!userId) return [];
    const { data, error } = await client
      .from('operations')
      .select('*')
      .eq('user_id', userId)
      .order('createdAt', { ascending: false });
    if (error) {
      console.warn('Erreur Supabase fetchOperations', error.message);
      return [];
    }
    return data || [];
  }

  async function saveOperation(operation, userId) {
    if (!userId) return;
    const record = {
      ...operation,
      user_id: userId
    };
    const { error } = await client.from('operations').upsert(record);
    if (error) console.warn('Erreur Supabase saveOperation', error.message);
  }

  async function updateOperation(operation, userId) {
    if (!userId) return;
    const record = {
      ...operation,
      user_id: userId
    };
    const { error } = await client.from('operations').upsert(record);
    if (error) console.warn('Erreur Supabase updateOperation', error.message);
  }

  async function deleteOperation(id, userId) {
    if (!id || !userId) return;
    const { error } = await client
      .from('operations')
      .delete()
      .match({ id, user_id: userId });
    if (error) console.warn('Erreur Supabase deleteOperation', error.message);
  }

  async function deleteOperations(ids, userId) {
    if (!ids?.length || !userId) return;
    const { error } = await client
      .from('operations')
      .delete()
      .in('id', ids)
      .eq('user_id', userId);
    if (error) console.warn('Erreur Supabase deleteOperations', error.message);
  }

  return {
    init,
    getSession,
    getUser,
    fetchOperations,
    saveOperation,
    updateOperation,
    deleteOperation,
    deleteOperations,
    // Realtime helpers
    subscribeToOperations,
    unsubscribeChannel,
    createProfile,
    getEmailByUsername
  };


// Implementation of realtime helpers (placed after the module to access `client`)
async function subscribeToOperations(userId, handler) {
  if (!userId) return null;
  try {
    const channel = client.channel('public:operations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'operations' }, payload => {
        // payload may contain eventType and new/old rows depending on version
        handler(payload);
      })
      .subscribe();

    return channel;
  } catch (e) {
    console.warn('Erreur subscribeToOperations', e.message || e);
    return null;
  }
}

function unsubscribeChannel(channel) {
  try {
    if (!channel) return;
    // channel may expose unsubscribe() or unsubscribe
    if (typeof channel.unsubscribe === 'function') {
      channel.unsubscribe();
    } else if (typeof client.removeChannel === 'function') {
      client.removeChannel(channel);
    }
  } catch (e) {
    console.warn('Erreur unsubscribeChannel', e.message || e);
  }
}
})();