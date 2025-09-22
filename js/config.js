/*************** Configuración Supabase ****************/
window.supabaseCreds = { url: '', key: '' };
window.uiLang = 'es';
let currentConfigBackdrop = null;

function loadSupabaseCreds() {
  const url = localStorage.getItem('supabaseUrl')
    || localStorage.getItem('supabaseUrlReal')
    || localStorage.getItem('supabaseUrlTest')
    || '';
  const key = localStorage.getItem('supabaseKey')
    || localStorage.getItem('supabaseKeyReal')
    || localStorage.getItem('supabaseKeyTest')
    || '';
  window.supabaseCreds.url = url;
  window.supabaseCreds.key = key;
  document.dispatchEvent(new Event('credsLoaded'));
}

function loadUiLang() {
  window.uiLang = localStorage.getItem('uiLang') || 'es';
  if (window.i18n) i18n.setLang(window.uiLang);
}

function openConfigPopup() {
  if (currentConfigBackdrop) { currentConfigBackdrop.remove(); currentConfigBackdrop = null; }

  fetch('html/config.html')
    .then(r => r.text())
    .then(html => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const page = doc.getElementById('configPage');
      if (window.i18n) i18n.apply(page);
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.appendChild(page);
      backdrop.appendChild(modal);
      document.body.appendChild(backdrop);
      currentConfigBackdrop = backdrop;

      const form = backdrop.querySelector('#configForm');
      const urlInput = form.elements['supabaseUrl'];
      const keyInput = form.elements['supabaseKey'];
      const uiLang = form.elements['uiLang'];

      urlInput.value = localStorage.getItem('supabaseUrl') || '';
      keyInput.value = localStorage.getItem('supabaseKey') || '';
      uiLang.value = localStorage.getItem('uiLang') || 'es';

      function closePopup() {
        backdrop.remove();
        currentConfigBackdrop = null;
        document.removeEventListener('keydown', handleEsc);
        location.reload();
      }
      function handleEsc(e) { if (e.key === 'Escape') closePopup(); }
      document.addEventListener('keydown', handleEsc);
      backdrop.querySelector('.close').addEventListener('click', closePopup);

      form.addEventListener('submit', e => {
        e.preventDefault();
        const url = urlInput.value.trim();
        const key = keyInput.value.trim();
        const uiL = uiLang.value;

        if (!url || !key) {
          alert(i18n.t('Debe introducir URL y KEY de Supabase'));
          return;
        }

        localStorage.setItem('supabaseUrl', url);
        localStorage.setItem('supabaseKey', key);
        localStorage.setItem('uiLang', uiL);

        ['supabaseEnv', 'supabaseUrlReal', 'supabaseKeyReal', 'supabaseUrlTest', 'supabaseKeyTest', 'aiKey', 'aiModel', 'aiLang']
          .forEach(name => localStorage.removeItem(name));

        loadSupabaseCreds();
        loadUiLang();
        document.dispatchEvent(new Event('configSaved'));
        closePopup();
      });
    });
}

if (document.getElementById('btnConfig'))
  document.getElementById('btnConfig').addEventListener('click', openConfigPopup);

window.openConfigPopup = openConfigPopup;

document.addEventListener('DOMContentLoaded', () => { loadSupabaseCreds(); loadUiLang(); });
document.addEventListener('configSaved', () => { loadSupabaseCreds(); loadUiLang(); });
