/*************** Empresa (editar directo) ****************/
let currentCompanyBackdrop = null;

document.getElementById("btnCompany").addEventListener("click", openCompanyPopup);

function openCompanyPopup() {
  // Cerrar si ya está abierto
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

  // Guardamos referencia para poder cerrarlo externamente si hace falta
  currentCompanyBackdrop = bd;

  // Rellenar datos actuales
  Object.entries(company).forEach(([k, v]) => {
    if (form.elements[k] != null) form.elements[k].value = v;
  });
  if (form.elements['invoiceNumbering'] && !form.elements['invoiceNumbering'].value)
    form.elements['invoiceNumbering'].value = company.invoiceNumbering || '';

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

  const btnCalc = form.querySelector("#btnCompanyCalc");
  if (btnCalc) btnCalc.addEventListener("click", () => { if (window.openCompanyCalcPopup) openCompanyCalcPopup(); });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const data = sanitizeStrings(Object.fromEntries(new FormData(form).entries()));
    ["amountAutonomos", "totalVacationDays", "amountNomina", "tithePercent", "minimumHoursMonth", "incomeAmount", "extraAmounts"]
      .forEach(f => data[f] = parseFloat(data[f] || 0));
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
