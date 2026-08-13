// Avatar Humanoid — charge une animation Lottie d'un humain et expose `RobotAvatar.parler()`
// Comportement similaire à avatar-robot.js pour compatibilité avec le reste du projet.
(function(){
  let anim = null;
  let mouthEl = null;
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
          // Animation humanoïde publique (fallback). Remplacez par votre animation locale si souhaité.
          path: 'https://assets9.lottiefiles.com/packages/lf20_ydo1amjm.json'
        });
        anim.setSpeed(1);
        return anim;
      }catch(e){
        console.warn('Lottie load failed', e);
      }
    }

    // Fallback : simple avatar PNG/emoji
    container.innerHTML = '<div class="avatar-fallback humanoid">👩‍💼</div>';
    return null;
  }

  function createMouth(){
    const container = document.getElementById(containerId);
    if(!container) return null;
    // don't recreate
    if(container.querySelector('.avatar-mouth')) return container.querySelector('.avatar-mouth');
    const m = document.createElement('div');
    m.className = 'avatar-mouth';
    container.appendChild(m);
    return m;
  }

  function playAnim(){ if(anim && anim.play) try{ anim.play(); }catch(e){} }
  function stopAnim(){ if(anim && anim.stop) try{ anim.stop(); }catch(e){} }

  function speak(text){
    return new Promise((resolve)=>{
      try{
        if(!('speechSynthesis' in window)) return resolve(false);
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'fr-FR';
        u.rate = 0.95;
        u.onstart = () => {
          playAnim();
          if(!mouthEl) mouthEl = createMouth();
          if(mouthEl) mouthEl.classList.add('speaking');
        };
        u.onend = () => { stopAnim(); if(mouthEl) mouthEl.classList.remove('speaking'); resolve(true); };
        u.onerror = () => { stopAnim(); if(mouthEl) mouthEl.classList.remove('speaking'); resolve(false); };
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
      // create mouth overlay
      mouthEl = createMouth();
      const msgEl = document.getElementById(messageId);
      const initial = msgEl ? msgEl.textContent.trim() : '';
      if(initial){
        const trySpeak = async () => {
          if(spokenWelcome) return;
          spokenWelcome = true;
          if(document.body) document.body.removeEventListener('click', trySpeak);
          await speak(initial).catch(()=>{});
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
    setMessage, playAnim, stopAnim
  };

  window.RobotAvatar = RobotAvatar;
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ()=> RobotAvatar.init());
  else RobotAvatar.init();

})();
