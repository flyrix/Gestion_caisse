/**
 * CONFIGURATION SUPABASE - CAISSE VOCALE PWA
 * Initialisation de l'URL du projet et de la clé anonyme publique.
 */

// URL de votre instance Supabase
window.SUPABASE_URL = "https://fxpdeblytwlumvraegrr.supabase.co";

// Clé anonyme publique Supabase
window.SUPABASE_ANON_KEY = "sb_publishable_RPu5aL_HIgI2MRneCV2AKQ_Tnw-EasO";

// Contrôle de présence de la configuration
if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
  console.log("✅ [Supabase Config] Configuration chargée avec succès.");
} else {
  console.error("❌ [Supabase Config] Échec du chargement des identifiants Supabase.");
}