/* Audio inclusivo: activación voluntaria, sin grabación ni envío de datos. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const panel=$('access-panel');
  const speechSupported='speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  const ctxSupported=!!(window.AudioContext||window.webkitAudioContext);
  const prefs={feedback:false,auto:false,rate:1,large:false,contrast:false};
  let audioCtx=null;let priorFocus=null;let latestSpeech=null;
  const sayStatus=msg=>{const el=$('audio-support');if(el)el.textContent=msg;};
  const isVisible=el=>!!el && el.getClientRects().length>0;
  function stop(){if(speechSupported){try{window.speechSynthesis.cancel();}catch(e){}}latestSpeech=null;}
  function speak(text){
    if(!speechSupported){sayStatus('La voz no está disponible en este navegador. Prueba Chrome o Safari actualizado.');return false;}
    const msg=String(text||'').replace(/\s+/g,' ').trim().slice(0,2600);
    if(!msg){sayStatus('No hay texto para leer en esta pantalla.');return false;}
    stop();
    const u=new SpeechSynthesisUtterance(msg);u.lang='es-CO';u.rate=prefs.rate;u.pitch=1;u.volume=0.95;
    const voices=window.speechSynthesis.getVoices();const selected=voices.find(v=>v.lang.toLowerCase()==='es-co') || voices.find(v=>v.lang.toLowerCase().startsWith('es'));
    if(selected)u.voice=selected;
    u.onstart=()=>sayStatus('Leyendo en voz alta. Puedes detenerla en cualquier momento.');
    u.onend=()=>{if(latestSpeech===u) sayStatus('Lectura finalizada.');};
    u.onerror=()=>{if(latestSpeech===u) sayStatus('El navegador no pudo reproducir la voz. Puedes utilizar la lectura en pantalla.');};
    latestSpeech=u;
    try{window.speechSynthesis.speak(u);return true;}catch(e){sayStatus('No se pudo iniciar el lector de voz.');return false;}
  }
  function beep(){
    if(!prefs.feedback||!ctxSupported)return;
    try{
      if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();
      if(audioCtx.state==='suspended')audioCtx.resume().catch(()=>{});
      const osc=audioCtx.createOscillator(),gain=audioCtx.createGain(),t=audioCtx.currentTime;
      osc.type='sine';osc.frequency.setValueAtTime(730,t);osc.frequency.exponentialRampToValueAtTime(890,t+.095);
      gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.032,t+.01);gain.gain.exponentialRampToValueAtTime(.0001,t+.14);
      osc.connect(gain);gain.connect(audioCtx.destination);osc.start(t);osc.stop(t+.15);
    }catch(e){}
  }
  function getPageText(){
    // Lee títulos y textos informativos. Evita leer las entradas de texto o los mensajes escritos por el ciudadano.
    const root=$('main-content');if(!root)return '';
    const copy=root.cloneNode(true);
    copy.querySelectorAll('input,textarea,select,button,form,.chat-messages,.footer,.tag,.chat-suggestions,.chat-disclaimer,.bot-fab,.hero-art,script,style').forEach(x=>x.remove());
    const raw=copy.innerText || copy.textContent || '';
    const view=$('breadcrumb')?.textContent||'SALUD360';
    return 'SALUD360. Pantalla: '+view+'. '+raw.replace(/\s+/g,' ').trim().slice(0,2200);
  }
  function open(){priorFocus=document.activeElement;panel.hidden=false;const b=$('close-access');if(b)b.focus();}
  function close(){panel.hidden=true;if(priorFocus&&typeof priorFocus.focus==='function')priorFocus.focus();}
  function updateUI(){
    document.body.classList.toggle('inclusive-large',prefs.large);
    document.body.classList.toggle('inclusive-contrast',prefs.contrast);
    $('audio-feedback').checked=prefs.feedback;
    $('auto-replies').checked=prefs.auto;
    $('large-type').checked=prefs.large;
    $('high-contrast').checked=prefs.contrast;
    $('speech-speed').value=String(prefs.rate);
    $('speech-speed-label').textContent=({'.75':'Lenta (0,75×)','1':'Normal (1×)','1.25':'Rápida (1,25×)'})[String(prefs.rate)] || prefs.rate+'×';
  }
  document.addEventListener('click',function(e){
    const openBtn=e.target.closest('#open-access,[data-action="open-access"]');
    if(openBtn){e.preventDefault();stop();open();return;}
    if(e.target.closest('#close-access')){close();return;}
    if(e.target===panel){close();return;}
    if(e.target.closest('#speak-screen')){const str=getPageText();close();speak(str);return;}
    if(e.target.closest('#stop-speech')){stop();sayStatus('Lectura detenida.');return;}
    const speechBtn=e.target.closest('[data-speak-chat]');
    if(speechBtn){const idx=Number(speechBtn.dataset.speakChat);let clone=speechBtn.parentElement.cloneNode(true);clone.querySelectorAll('small,button').forEach(n=>n.remove());speak(clone.textContent||'');return;}
    const tab=e.target.closest('[data-nav],[data-chat],[data-center]');if(tab){beep();if(tab.hasAttribute('data-nav'))stop();}
  });
  document.addEventListener('change',function(e){
    const id=e.target.id;
    if(id==='audio-feedback'){prefs.feedback=e.target.checked;if(prefs.feedback){beep();sayStatus('Sonidos de confirmación activados.');}else sayStatus('Sonidos desactivados.');}
    else if(id==='auto-replies'){prefs.auto=e.target.checked;sayStatus(prefs.auto?'Lectura de respuestas activada.':'Lectura automática desactivada.');}
    else if(id==='large-type'){prefs.large=e.target.checked;updateUI();}
    else if(id==='high-contrast'){prefs.contrast=e.target.checked;updateUI();}
    else if(id==='speech-speed'){prefs.rate=Number(e.target.value);updateUI();}
  });
  document.addEventListener('input',e=>{if(e.target.id==='speech-speed'){prefs.rate=Number(e.target.value);updateUI();}});
  function readLatestBot(){
    if(!prefs.auto)return;
    setTimeout(()=>{
      const visible=[...document.querySelectorAll('.chat-panel')].find(isVisible);
      if(!visible)return;
      const msgs=visible.querySelectorAll('.message.bot');const last=msgs[msgs.length-1];
      if(last){const clone=last.cloneNode(true);clone.querySelectorAll('small,button').forEach(n=>n.remove());speak(clone.textContent||'');}
    },120);
  }
  document.addEventListener('submit',e=>{if(e.target.id==='chat-form'){readLatestBot();beep();}});
  document.addEventListener('click',e=>{if(e.target.closest('[data-chat]'))readLatestBot();});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!panel.hidden){stop();close();}
    if(e.key==='Tab'&&!panel.hidden){const buttons=[...panel.querySelectorAll('button,input')].filter(isVisible);const first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  window.addEventListener('pagehide',stop);
  if(!speechSupported)sayStatus('La lectura en voz alta no está disponible en este navegador. El diseño sigue siendo accesible mediante lector de pantalla.');
  else sayStatus('Pulsa «Leer esta pantalla» para escuchar las instrucciones. No se graba tu voz.');
  updateUI();
})();