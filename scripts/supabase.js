/**
 * CONTROLEUR DE LA BASE DE DONNÉES (Supabase DB & Realtime)
 * Adapté pour une tolérance totale aux pannes et au mode Hors-Ligne (Offline).
 */
const SupabaseDB = (function() {
  const SUPABASE_URL = window.SUPABASE_URL || '';
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || '';

  let client = null;

  function initClient() {
    if (client) return client;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.warn('Supabase non configuré : remplissez scripts/supabase-config.js');
      return null;
    }

    if (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
      try {
        client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: {
            persistSession: true,
            detectSessionInUrl: true
          }
        });
      } catch (err) {
        console.warn('Erreur lors de la création du client Supabase :', err.message);
      }
    } else {
      console.warn("SDK Supabase non disponible (Mode Hors-Ligne ou CDN non chargé).");
    }

    return client;
  }

  initClient();

  // Utilitaire interne pour transformer les payloads en format DB
  function formatRecord(operation, userId) {
    const record = { ...operation, user_id: userId };
    if (record.createdAt) {
      record.createdat = record.createdAt;
      delete record.createdAt;
    }
    return record;
  }

  async function init() {
    const activeClient = initClient();
    if (!activeClient) return;
    try {
      await activeClient.auth.getSession();
    } catch (err) {
      console.warn('Erreur Supabase init() :', err.message);
    }
  }

  async function getSession() {
    const activeClient = initClient();
    if (!activeClient || !navigator.onLine) return null;
    
    try {
      const { data, error } = await activeClient.auth.getSession();
      if (error) throw error;
      return data?.session || null;
    } catch (err) {
      console.warn('Erreur Supabase getSession :', err.message);
      return null;
    }
  }

  async function getUser() {
    const session = await getSession();
    return session?.user || null;
  }

  async function getEmailByUsername(username) {
    const activeClient = initClient();
    if (!username || !activeClient || !navigator.onLine) return null;

    try {
      const { data, error } = await activeClient
        .from('profiles')
        .select('email')
        .eq('username', username)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data?.email || null;
    } catch (err) {
      console.warn('Erreur getEmailByUsername :', err.message);
      return null;
    }
  }

  async function createProfile(userId, username, email) {
    const activeClient = initClient();
    if (!userId || !username || !email || !activeClient || !navigator.onLine) return;

    try {
      const { error } = await activeClient
        .from('profiles')
        .upsert({ id: userId, username, email }, { onConflict: 'id' });
      if (error) console.warn('Erreur Supabase createProfile :', error.message);
    } catch (err) {
      console.warn('Erreur createProfile :', err.message);
    }
  }

  async function fetchOperations(userId) {
    const activeClient = initClient();
    if (!userId || !activeClient || !navigator.onLine) return [];

    try {
      const { data, error } = await activeClient
        .from('operations')
        .select('*')
        .eq('user_id', userId)
        .order('createdat', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.warn('Erreur fetchOperations :', err.message);
      return [];
    }
  }

  async function saveOperation(operation, userId) {
    const activeClient = initClient();
    if (!userId || !activeClient || !navigator.onLine) return null;

    try {
      const record = formatRecord(operation, userId);
      const { data, error } = await activeClient.from('operations').upsert(record).select();
      if (error) throw error;
      return data ? data[0] : null;
    } catch (err) {
      console.warn('Erreur saveOperation :', err.message);
      return null;
    }
  }

  async function updateOperation(operation, userId) {
    const activeClient = initClient();
    if (!userId || !activeClient || !navigator.onLine) return;

    try {
      const record = formatRecord(operation, userId);
      const { error } = await activeClient.from('operations').upsert(record);
      if (error) console.warn('Erreur Supabase updateOperation :', error.message);
    } catch (err) {
      console.warn('Erreur updateOperation :', err.message);
    }
  }

  async function deleteOperation(id, userId) {
    const activeClient = initClient();
    if (!id || !userId || !activeClient || !navigator.onLine) return;

    try {
      const { error } = await activeClient
        .from('operations')
        .delete()
        .match({ id, user_id: userId });
      if (error) console.warn('Erreur Supabase deleteOperation :', error.message);
    } catch (err) {
      console.warn('Erreur deleteOperation :', err.message);
    }
  }

  async function deleteOperations(ids, userId) {
    const activeClient = initClient();
    if (!ids?.length || !userId || !activeClient || !navigator.onLine) return;

    try {
      const { error } = await activeClient
        .from('operations')
        .delete()
        .in('id', ids)
        .eq('user_id', userId);
      if (error) console.warn('Erreur Supabase deleteOperations :', error.message);
    } catch (err) {
      console.warn('Erreur deleteOperations :', err.message);
    }
  }

  async function subscribeToOperations(userId, handler) {
    const activeClient = initClient();
    if (!userId || !activeClient || !navigator.onLine) return null;

    try {
      // Filtrage ciblé par user_id pour éviter la surconsommation réseau
      const channel = activeClient.channel(`public:operations:${userId}`)
        .on(
          'postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'operations',
            filter: `user_id=eq.${userId}`
          }, 
          payload => handler(payload)
        )
        .subscribe();

      return channel;
    } catch (e) {
      console.warn('Erreur subscribeToOperations :', e.message || e);
      return null;
    }
  }

  function unsubscribeChannel(channel) {
    const activeClient = initClient();
    try {
      if (!channel) return;
      if (activeClient && typeof activeClient.removeChannel === 'function') {
        activeClient.removeChannel(channel);
      } else if (typeof channel.unsubscribe === 'function') {
        channel.unsubscribe();
      }
    } catch (e) {
      console.warn('Erreur unsubscribeChannel :', e.message || e);
    }
  }

  return {
    get client() {
      return initClient();
    },
    init,
    getSession,
    getUser,
    fetchOperations,
    saveOperation,
    updateOperation,
    deleteOperation,
    deleteOperations,
    subscribeToOperations,
    unsubscribeChannel,
    createProfile,
    getEmailByUsername
  };
})();

window.SupabaseDB = SupabaseDB;