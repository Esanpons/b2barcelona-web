/*************** Empresa (editar directo) ****************/
let currentCompanyBackdrop = null;

const companyButton = document.getElementById("btnCompany");
if (companyButton) companyButton.addEventListener("click", openCompanyPopup);

function openCompanyPopup() {
  if (currentCompanyBackdrop) {
    currentCompanyBackdrop.remove();
    currentCompanyBackdrop = null;
  }

  fetch("html/company.html")
    .then(r => r.text())
    .then(html => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const tmpl = doc.getElementById("companyModalTmpl");
      if (window.i18n) i18n.apply(tmpl.content);
      openCompanyModal(tmpl);
    });
}

function openCompanyModal(tmpl) {
  const clone = tmpl.content.cloneNode(true);
  if (window.i18n) i18n.apply(clone);
  const bd = clone.querySelector(".modal-backdrop");
  const form = clone.querySelector("#companyForm");
  const logoField = form?.elements['logo'] || null;
  const logoFileInput = form?.querySelector('.company-logo__file') || null;
  const logoImage = form?.querySelector('.company-logo__image') || null;
  const logoEmpty = form?.querySelector('.company-logo__empty') || null;
  const logoAddBtn = form?.querySelector('.company-logo__add') || null;
  const logoChangeBtn = form?.querySelector('.company-logo__change') || null;
  const logoRemoveBtn = form?.querySelector('.company-logo__remove') || null;

  currentCompanyBackdrop = bd;

  Object.entries(company).forEach(([k, v]) => {
    if (form.elements[k] != null) form.elements[k].value = v;
  });
  if (form.elements['invoiceNumbering'] && !form.elements['invoiceNumbering'].value)
    form.elements['invoiceNumbering'].value = company.invoiceNumbering || '';
  if (logoField) logoField.value = company.logo || '';

  const updateLogoUi = () => {
    if (!form) return;
    const hasLogo = !!(logoField && logoField.value);
    if (logoImage) {
      if (hasLogo) {
        logoImage.src = logoField.value;
        logoImage.classList.remove('is-hidden');
      } else {
        logoImage.removeAttribute('src');
        logoImage.classList.add('is-hidden');
      }
    }
    if (logoEmpty) logoEmpty.classList.toggle('is-hidden', hasLogo);
    if (logoAddBtn) logoAddBtn.classList.toggle('is-hidden', hasLogo);
    if (logoChangeBtn) logoChangeBtn.classList.toggle('is-hidden', !hasLogo);
    if (logoRemoveBtn) logoRemoveBtn.classList.toggle('is-hidden', !hasLogo);
  };

  const openLogoFilePicker = () => {
    if (!logoFileInput) return;
    logoFileInput.value = '';
    logoFileInput.click();
  };

  if (logoAddBtn) logoAddBtn.addEventListener('click', openLogoFilePicker);
  if (logoChangeBtn) logoChangeBtn.addEventListener('click', openLogoFilePicker);
  if (logoRemoveBtn) logoRemoveBtn.addEventListener('click', () => {
    if (!logoField) return;
    logoField.value = '';
    updateLogoUi();
  });

  if (logoFileInput) {
    logoFileInput.addEventListener('change', () => {
      const file = logoFileInput.files && logoFileInput.files[0];
      if (!file) return;
      const maxSizeBytes = 1024 * 1024 * 2; // 2 MB
      if (file.size > maxSizeBytes) {
        alert('El logo no puede superar los 2 MB.');
        logoFileInput.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string' && logoField) {
          logoField.value = reader.result;
          updateLogoUi();
        }
      };
      reader.onerror = () => {
        console.error(reader.error);
        alert('No se pudo leer la imagen seleccionada.');
      };
      reader.readAsDataURL(file);
    });
  }

  updateLogoUi();

  function closeModal() {
    if (currentCompanyBackdrop) {
      currentCompanyBackdrop.remove();
      currentCompanyBackdrop = null;
      document.removeEventListener('keydown', handleEsc);
    }
  }

  function handleEsc(e) { if (e.key === 'Escape') closeModal(); }
  document.addEventListener('keydown', handleEsc);
  bd.querySelector(".close").addEventListener("click", closeModal);

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const data = sanitizeStrings(Object.fromEntries(new FormData(form).entries()));
    if (data.logo === "") data.logo = null;
    ["invoiceLogoMaxWidth", "invoiceLogoMaxHeight"].forEach(field => {
      if (!Object.prototype.hasOwnProperty.call(data, field)) return;
      const value = data[field];
      if (value === "" || value == null) {
        data[field] = null;
        return;
      }
      const parsed = Number.parseInt(value, 10);
      data[field] = Number.isFinite(parsed) ? parsed : null;
    });
    try {
      if (Object.prototype.hasOwnProperty.call(company, 'id')) {
        await db.update('company', { id: company.id }, data);
      } else {
        await db.insert('company', { id: "", ...data });
      }
      await loadFromDb();
      closeModal();
    } catch (err) {
      console.error(err);
      alert('Error al guardar la empresa');
    }
  });

  document.body.appendChild(clone);
}
