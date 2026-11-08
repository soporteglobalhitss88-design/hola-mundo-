/* Solo controles de presentación móvil y registro PWA. Nunca almacena datos médicos. */
(function(){
  'use strict';
  const byId=(id)=>document.getElementById(id);
  const more=byId('mobile-more-panel'),help=byId('mobile-install-help'),moreButton=byId('mobile-more-tab');
  let deferredPrompt=null;
  function standalone(){return window.matchMedia('(display-mode: standalone)').matches||Boolean(window.navigator.standalone)}
  function closeMore(){more.hidden=true;moreButton.setAttribute('aria-expanded','false')}
  function closeHelp(){help.hidden=true}
  window.__salud360SyncNav=function(view){
    document.querySelectorAll('.mobile-tab[data-nav]').forEach(btn=>btn.setAttribute('aria-current',btn.dataset.nav===view?'page':'false'));
    const special=!['home','centers','appointments','pharmacies'].includes(view);
    moreButton.setAttribute('aria-current',special?'page':'false');
    if(!more.hidden)closeMore();
  };
  window.__salud360SyncNav(byId('breadcrumb')?.textContent==='Inicio'?'home':'home');
  document.addEventListener('click',function(e){
    const btn=e.target.closest('[data-action]');
    if(!btn){if(e.target===more)closeMore();if(e.target===help)closeHelp();const n=e.target.closest('[data-nav]');if(n)closeMore();return}
    if(btn.dataset.action==='mobile-more'){more.hidden=!more.hidden;moreButton.setAttribute('aria-expanded',String(!more.hidden));return}
    if(btn.dataset.action==='mobile-more-close'){closeMore();return}
    if(btn.dataset.action==='mobile-install-close'){closeHelp();return}
    if(btn.dataset.action==='mobile-install'){
      closeMore();
      if(standalone()){
        byId('install-guide').textContent='SALUD360 ya está abierta como aplicación desde tu pantalla de inicio.';
        help.hidden=false;return;
      }
      if(deferredPrompt){
        const p=deferredPrompt;deferredPrompt=null;p.prompt();
        p.userChoice.catch(()=>{});return;
      }
      const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent);
      byId('install-guide').textContent=ios
       ?'En Safari, pulsa el botón Compartir (cuadro con flecha) → Añadir a pantalla de inicio → Añadir. Después abre el icono SALUD360.'
       :'En Chrome para Android, abre el menú de tres puntos (⋮) → Instalar aplicación o Añadir a pantalla de inicio. Si no aparece la opción, entra desde una dirección HTTPS activa.';
      help.hidden=false;
    }
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMore();closeHelp()}});
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e});
  window.addEventListener('appinstalled',()=>{deferredPrompt=null;closeHelp()});
  if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1')){
    window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{}));
  }
})();