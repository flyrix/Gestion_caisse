// Avatar Robot minimal — charge une animation Lottie et expose `RobotAvatar.parler()`
(function(){
  let anim = null;
  let spokenWelcome = false;

  const containerId = 'avatar-container';
  const messageId = 'robot-message';

  function setMessage(txt){
    const el = document.getElementById(messageId);
    if(el) el.textContent = txt;
  }

  async function loadLottie(){
    const container = document.getElementById(containerId);
    if(!container) return null;

    if(window.lottie && typeof window.lottie.loadAnimation === 'function'){
      try{
        anim = window.lottie.loadAnimation({
          container: container,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          // animation JSON publique (fallback). Remplacez par votre animation locale si besoin.
          path: 'https://assets9.lottiefiles.com/packages/lf20_iwmd6pyr.json'
        });
        anim.setSpeed(1);
        return anim;
      }catch(e){
        console.warn('Lottie load failed', e);
      }
    }

    // Fallback simple : emoji animé via CSS
    container.innerHTML = '<div class="avatar-fallback">🤖</div>';
    return null;
  }

  function playAnim(){ if(anim && anim.play) try{ anim.play(); }catch(e){} }
  function stopAnim(){ if(anim && anim.stop) try{ anim.stop(); }catch(e){} }

  function speak(text){
    return new Promise((resolve)=>{
      try{
        if(!('speechSynthesis' in window)) return resolve(false);

        // Cancel any previous
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'fr-FR';
        u.rate = 0.95;
        u.onstart = () => playAnim();
        u.onend = () => { stopAnim(); resolve(true); };
        u.onerror = () => { stopAnim(); resolve(false); };

        // Try speak — may be blocked until user interacts with page.
        window.speechSynthesis.speak(u);
      }catch(e){
        console.warn('TTS error', e);
        resolve(false);
      }
    });
  }

  const RobotAvatar = {
    async init(){
      await loadLottie();

      // If the page already shows a robot message, attempt to speak it after first user gesture.
      const msgEl = document.getElementById(messageId);
      const initial = msgEl ? msgEl.textContent.trim() : '';

      if(initial){
        const trySpeak = async () => {
          if(spokenWelcome) return;
          spokenWelcome = true;
          if(document.body) document.body.removeEventListener('click', trySpeak);
          await speak(initial).catch(()=>{});
        };

        // Try immediately (may be blocked), and also on first user click/touch.
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
    playAnim,
    stopAnim
  };

  window.RobotAvatar = RobotAvatar;

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ()=> RobotAvatar.init());
  } else {
    RobotAvatar.init();
  }

})();
