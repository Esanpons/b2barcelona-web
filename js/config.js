/*************** Configuración Supabase ****************/
window.supabaseCreds = { url: '', key: '' };
window.aiConfig = { key: '', model: '', lang: 'es' };
window.uiLang = 'es';
let currentConfigBackdrop = null;

function loadSupabaseCreds() {
  const env = localStorage.getItem('supabaseEnv') || 'real';
  const url = localStorage.getItem(env === 'real' ? 'supabaseUrlReal' : 'supabaseUrlTest') || '';
  const key = localStorage.getItem(env === 'real' ? 'supabaseKeyReal' : 'supabaseKeyTest') || '';
  window.supabaseCreds.url = url;
  window.supabaseCreds.key = key;
  document.dispatchEvent(new Event('credsLoaded'));
}

function loadAiConfig() {
  window.aiConfig.key = localStorage.getItem('aiKey') || '';
  window.aiConfig.model = localStorage.getItem('aiModel') || '';
  window.aiConfig.lang = localStorage.getItem('aiLang') || 'es';
  document.dispatchEvent(new Event('aiConfigLoaded'));
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
      const envSel = form.elements['environment'];
      const urlReal = form.elements['supabaseUrlReal'];
      const keyReal = form.elements['supabaseKeyReal'];
      const urlTest = form.elements['supabaseUrlTest'];
      const keyTest = form.elements['supabaseKeyTest'];
      const realBlock = form.querySelector('#realFields');
      const testBlock = form.querySelector('#testFields');
      const aiKey = form.elements['aiKey'];
      const aiModel = form.elements['aiModel'];
      const aiLang = form.elements['aiLang'];
      const uiLang = form.elements['uiLang'];

      function updateFields() {
        const env = envSel.value;
        if (env === 'real') {
          realBlock.classList.remove('hidden');
          testBlock.classList.add('hidden');
          urlReal.required = keyReal.required = true;
          urlTest.required = keyTest.required = false;
          urlReal.value = localStorage.getItem('supabaseUrlReal') || '';
          keyReal.value = localStorage.getItem('supabaseKeyReal') || '';
        } else {
          realBlock.classList.add('hidden');
          testBlock.classList.remove('hidden');
          urlTest.required = keyTest.required = true;
          urlReal.required = keyReal.required = false;
          urlTest.value = localStorage.getItem('supabaseUrlTest') || '';
          keyTest.value = localStorage.getItem('supabaseKeyTest') || '';
        }
      }

      envSel.value = localStorage.getItem('supabaseEnv') || 'real';
      updateFields();
      envSel.addEventListener('change', updateFields);
      aiKey.value = localStorage.getItem('aiKey') || '';
      aiModel.value = localStorage.getItem('aiModel') || '';
      aiLang.value = localStorage.getItem('aiLang') || 'es';
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
        const env = envSel.value;
        const urlR = urlReal.value.trim();
        const keyR = keyReal.value.trim();
        const urlT = urlTest.value.trim();
        const keyT = keyTest.value.trim();
        const aiK = aiKey.value.trim();
        const aiM = aiModel.value.trim();
        const aiL = aiLang.value;
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
        if (urlR) localStorage.setItem('supabaseUrlReal', urlR);
        if (keyR) localStorage.setItem('supabaseKeyReal', keyR);
        if (urlT) localStorage.setItem('supabaseUrlTest', urlT);
        if (keyT) localStorage.setItem('supabaseKeyTest', keyT);
        if (aiK) localStorage.setItem('aiKey', aiK); else localStorage.removeItem('aiKey');
        if (aiM) localStorage.setItem('aiModel', aiM); else localStorage.removeItem('aiModel');
        localStorage.setItem('aiLang', aiL);
        localStorage.setItem('uiLang', uiL);

        loadSupabaseCreds();
        loadAiConfig();
        loadUiLang();
        document.dispatchEvent(new Event('configSaved'));
        closePopup();
      });
    });
}

if (document.getElementById('btnConfig'))
  document.getElementById('btnConfig').addEventListener('click', openConfigPopup);

window.openConfigPopup = openConfigPopup;

function updateEnvLabel() {
  const label = document.getElementById('envLabel');
  if (!label) return;
  const env = localStorage.getItem('supabaseEnv') || 'real';
  if (env === 'test') {
    label.textContent = 'TEST';
    label.classList.add('test');
  } else {
    label.textContent = '';
    label.classList.remove('test');
  }
}
document.addEventListener('DOMContentLoaded', () => { loadSupabaseCreds(); loadAiConfig(); loadUiLang(); updateEnvLabel(); });
document.addEventListener('configSaved', () => { loadSupabaseCreds(); loadAiConfig(); loadUiLang(); updateEnvLabel(); });
window.updateEnvLabel = updateEnvLabel;
