// Avatar Emoji avec Animation de Bouche — simple et léger
(function(){
  const containerId = 'avatar-container';
  const messageId = 'robot-message';

  let isSpeaking = false;
  let mouthTimer = null;
  let mouthState = 0;

  function setMessage(txt){
    const el = document.getElementById(messageId);
    if(el) el.textContent = txt;
  }

  function renderAvatar(){
    const container = document.getElementById(containerId);
    if(!container) return;
    
    container.innerHTML = '<div class="avatar-emoji">👩‍💼</div>';
  }

  function startSpeaking(){
    if(isSpeaking) return;
    isSpeaking = true;
  }

  function stopSpeaking(){
    isSpeaking = false;
    if(mouthTimer) clearTimeout(mouthTimer);
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
      renderAvatar();

      // Autoplay du message d'accueil sur premier clic
      const msgEl = document.getElementById(messageId);
      const initial = msgEl ? msgEl.textContent.trim() : '';

      if(initial){
        const trySpeak = async () => {
          if(document.body) document.body.removeEventListener('click', trySpeak);
          if(document.body) document.body.removeEventListener('touchstart', trySpeak);
          await speak(initial).catch(() => {});
        };

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

    setMessage
  };

  window.RobotAvatar = RobotAvatar;

  // Auto-init
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => RobotAvatar.init());
  } else {
    RobotAvatar.init();
  }

})();
