// Avatar avec Visèmes (Lip-Sync) — charge des images de bouche et les bascule lors de la parole
// Compatible avec speechSynthesis (Web Speech API)
(function(){
  // ============================================
  // CONFIG : Chemins vers les images de visèmes
  // ============================================
  const VISEMES = {
    closed: 'icons/avatar-visemes/closed.png',
    smile_closed: 'icons/avatar-visemes/smile-closed.png',
    slight_open: 'icons/avatar-visemes/slight-open.png',
    medium_open: 'icons/avatar-visemes/medium-open.png',
    wide_open: 'icons/avatar-visemes/wide-open.png',
    o_shaped: 'icons/avatar-visemes/o-shaped.png',
    e_shaped: 'icons/avatar-visemes/e-shaped.png',
    teeth_smile: 'icons/avatar-visemes/teeth-smile.png'
  };

  const SWITCH_INTERVAL = 150; // ms entre chaque basculement de visème
  const containerId = 'avatar-container';
  const messageId = 'robot-message';

  let imgCache = {}; // Cache d'images pré-chargées
  let currentViseme = 'closed';
  let isSpeaking = false;
  let speakingTimer = null;
  let visemeRotationTimer = null;
  let visemeIndex = 0;

  // ============================================
  // INIT : Pré-charger les images
  // ============================================
  async function preloadImages(){
    const keys = Object.keys(VISEMES);
    const promises = keys.map(key => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          imgCache[key] = img;
          resolve();
        };
        img.onerror = () => {
          console.warn(`Failed to load ${key}: ${VISEMES[key]}`);
          resolve(); // continue anyway
        };
        img.src = VISEMES[key];
      });
    });
    await Promise.all(promises);
  }

  function setMessage(txt){
    const el = document.getElementById(messageId);
    if(el) el.textContent = txt;
  }

  function renderViseme(visemeKey){
    const container = document.getElementById(containerId);
    if(!container) return;
    
    const img = imgCache[visemeKey];
    if(!img) {
      // Fallback emoji
      container.innerHTML = '<div class="avatar-fallback viseme">👩‍💼</div>';
      return;
    }

    // Clear et afficher l'image
    container.innerHTML = '';
    const clone = img.cloneNode();
    clone.style.maxWidth = '100%';
    clone.style.maxHeight = '100%';
    clone.style.objectFit = 'contain';
    container.appendChild(clone);
  }

  function rotateThroughVisemes(){
    if(!isSpeaking) return;

    // Cycle à travers un ensemble de visèmes en parlant
    const speakingVisemes = [
      'slight_open',
      'medium_open',
      'wide_open',
      'medium_open',
      'slight_open',
      'closed',
      'medium_open'
    ];

    currentViseme = speakingVisemes[visemeIndex % speakingVisemes.length];
    renderViseme(currentViseme);
    visemeIndex++;

    if(isSpeaking){
      visemeRotationTimer = setTimeout(rotateThroughVisemes, SWITCH_INTERVAL);
    }
  }

  function startSpeaking(){
    if(isSpeaking) return;
    isSpeaking = true;
    visemeIndex = 0;
    rotateThroughVisemes();
  }

  function stopSpeaking(){
    isSpeaking = false;
    if(visemeRotationTimer) clearTimeout(visemeRotationTimer);
    // Retour à neutre
    currentViseme = 'closed';
    renderViseme(currentViseme);
  }

  function speak(text){
    return new Promise((resolve) => {
      try{
        if(!('speechSynthesis' in window)) return resolve(false);

        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'fr-FR';
        u.rate = 0.95;

        u.onstart = () => startSpeaking();
        u.onend = () => { stopSpeaking(); resolve(true); };
        u.onerror = () => { stopSpeaking(); resolve(false); };

        // Bonus : boundary event pour une granularité plus fine (optionnel)
        u.onboundary = (event) => {
          if(event.name === 'word') {
            // Basculer entre quelques visèmes au niveau du mot
            const opts = ['medium_open', 'wide_open', 'slight_open'];
            currentViseme = opts[Math.floor(Math.random() * opts.length)];
            renderViseme(currentViseme);
          }
        };

        window.speechSynthesis.speak(u);
      }catch(e){
        console.warn('TTS error', e);
        resolve(false);
      }
    });
  }

  // ============================================
  // API PUBLIQUE
  // ============================================
  const RobotAvatar = {
    async init(){
      // Pré-charger toutes les images
      await preloadImages();
      // Afficher visème par défaut
      renderViseme('closed');

      // Autoplay du message d'accueil sur premier clic
      const msgEl = document.getElementById(messageId);
      const initial = msgEl ? msgEl.textContent.trim() : '';

      if(initial){
        const trySpeak = async () => {
          const els = [document.body];
          els.forEach(el => {
            if(el) el.removeEventListener('click', trySpeak);
            if(el) el.removeEventListener('touchstart', trySpeak);
          });
          await speak(initial).catch(() => {});
        };

        // Essayer immédiatement (peut être bloqué), puis sur 1er clic
        trySpeak();
        if(document.body){
          document.body.addEventListener('click', trySpeak, { once: true });
          document.body.addEventListener('touchstart', trySpeak, { once: true });
        }
      }
    },

    async parler(txt){
      setMessage(txt);
      return await speak(txt);
    },

    setMessage,
    renderViseme
  };

  window.RobotAvatar = RobotAvatar;

  // Auto-init
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => RobotAvatar.init());
  } else {
    RobotAvatar.init();
  }

})();
