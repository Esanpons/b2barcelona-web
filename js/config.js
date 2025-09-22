/*************** Configuración Supabase ****************/
window.supabaseCreds = { url: '', key: '', env: 'real' };
window.uiLang = 'es';
let currentConfigBackdrop = null;

function getStoredEnv() {
  return localStorage.getItem('supabaseEnv') || 'real';
}

function loadSupabaseCreds() {
  const env = getStoredEnv();
  const urlKey = env === 'real' ? 'supabaseUrlReal' : 'supabaseUrlTest';
  const keyKey = env === 'real' ? 'supabaseKeyReal' : 'supabaseKeyTest';

  let url = localStorage.getItem(urlKey) || '';
  let key = localStorage.getItem(keyKey) || '';

  const legacyUrl = localStorage.getItem('supabaseUrl') || '';
  const legacyKey = localStorage.getItem('supabaseKey') || '';
  let migrated = false;

  if (!url && legacyUrl) {
    url = legacyUrl;
    localStorage.setItem(urlKey, url);
    migrated = true;
  }
  if (!key && legacyKey) {
    key = legacyKey;
    localStorage.setItem(keyKey, key);
    migrated = true;
  }
  if (migrated) {
    localStorage.removeItem('supabaseUrl');
    localStorage.removeItem('supabaseKey');
  }

  window.supabaseCreds.url = url;
  window.supabaseCreds.key = key;
  window.supabaseCreds.env = env;
  document.dispatchEvent(new Event('credsLoaded'));
}

function loadUiLang() {
  window.uiLang = localStorage.getItem('uiLang') || 'es';
  if (window.i18n) i18n.setLang(window.uiLang);
}

function updateEnvLabel() {
  const label = document.getElementById('envLabel');
  if (!label) return;
  const env = getStoredEnv();
  if (env === 'test') {
    label.textContent = 'TEST';
    label.classList.add('test');
  } else {
    label.textContent = '';
    label.classList.remove('test');
  }
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
      const envSel = form.elements['environment'];
      const urlReal = form.elements['supabaseUrlReal'];
      const keyReal = form.elements['supabaseKeyReal'];
      const urlTest = form.elements['supabaseUrlTest'];
      const keyTest = form.elements['supabaseKeyTest'];
      const realBlock = form.querySelector('#realFields');
      const testBlock = form.querySelector('#testFields');
      const uiLang = form.elements['uiLang'];

      envSel.value = getStoredEnv();
      urlReal.value = localStorage.getItem('supabaseUrlReal')
        || localStorage.getItem('supabaseUrl')
        || '';
      keyReal.value = localStorage.getItem('supabaseKeyReal')
        || localStorage.getItem('supabaseKey')
        || '';
      urlTest.value = localStorage.getItem('supabaseUrlTest') || '';
      keyTest.value = localStorage.getItem('supabaseKeyTest') || '';
      uiLang.value = localStorage.getItem('uiLang') || 'es';

      function updateFields() {
        const env = envSel.value;
        realBlock.classList.toggle('hidden', env !== 'real');
        testBlock.classList.toggle('hidden', env !== 'test');
        if (env === 'real') {
          urlReal.required = keyReal.required = true;
          urlTest.required = keyTest.required = false;
        } else {
          urlTest.required = keyTest.required = true;
          urlReal.required = keyReal.required = false;
        }
      }

      updateFields();
      envSel.addEventListener('change', updateFields);

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
        const env = envSel.value;
        const urlR = urlReal.value.trim();
        const keyR = keyReal.value.trim();
        const urlT = urlTest.value.trim();
        const keyT = keyTest.value.trim();
        const uiL = uiLang.value;

        if (env === 'real' && (!urlR || !keyR)) {
          alert(i18n.t('Debe introducir URL y KEY de Real'));
          return;
        }
        if (env === 'test' && (!urlT || !keyT)) {
          alert(i18n.t('Debe introducir URL y KEY de Test'));
          return;
        }

        localStorage.setItem('supabaseEnv', env);
        if (urlR) localStorage.setItem('supabaseUrlReal', urlR); else localStorage.removeItem('supabaseUrlReal');
        if (keyR) localStorage.setItem('supabaseKeyReal', keyR); else localStorage.removeItem('supabaseKeyReal');
        if (urlT) localStorage.setItem('supabaseUrlTest', urlT); else localStorage.removeItem('supabaseUrlTest');
        if (keyT) localStorage.setItem('supabaseKeyTest', keyT); else localStorage.removeItem('supabaseKeyTest');
        localStorage.removeItem('supabaseUrl');
        localStorage.removeItem('supabaseKey');
        localStorage.setItem('uiLang', uiL);

        loadSupabaseCreds();
        loadUiLang();
        updateEnvLabel();
        document.dispatchEvent(new Event('configSaved'));
        closePopup();
      });
    });
}

if (document.getElementById('btnConfig'))
  document.getElementById('btnConfig').addEventListener('click', openConfigPopup);

window.openConfigPopup = openConfigPopup;
window.updateEnvLabel = updateEnvLabel;

document.addEventListener('DOMContentLoaded', () => { loadSupabaseCreds(); loadUiLang(); updateEnvLabel(); });
document.addEventListener('configSaved', () => { loadSupabaseCreds(); loadUiLang(); updateEnvLabel(); });
