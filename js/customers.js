/*************** Clientes (popup externo) ****************/
let currentCustomersBackdrop = null;

document.getElementById("btnCustomers").addEventListener("click", openCustomersPopup);

function openCustomersPopup() {
  if (currentCustomersBackdrop) { currentCustomersBackdrop.remove(); currentCustomersBackdrop = null; }

  fetch("html/customers.html")
    .then(r => r.text())
    .then(html => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const customersPage = doc.getElementById('customersPage');
      if (window.i18n) i18n.apply(customersPage);
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop customers-popup';
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.appendChild(customersPage);
      backdrop.appendChild(modal);
      document.body.appendChild(backdrop);
      currentCustomersBackdrop = backdrop;

      const customersTableBody = backdrop.querySelector("#customersTable tbody");
      const btnAdd = backdrop.querySelector("#BtnAddCustomer");
      const btnEdit = backdrop.querySelector("#BtnEditCustomer");
      const btnDel = backdrop.querySelector("#BtnDelCustomer");
      const closeBtn = backdrop.querySelector(".close");

      function closePopup() {
        backdrop.remove();
        currentCustomersBackdrop = null;
        document.removeEventListener('keydown', handleEsc);
      }

      function handleEsc(e) { if (e.key === 'Escape') closePopup(); }
      document.addEventListener('keydown', handleEsc);

      let selectedCustomerNo = customers.length ? customers[0].no : null;

      function updateButtons() {
        const hasSel = !!selectedCustomerNo;
        btnEdit.disabled = !hasSel;
        btnDel.disabled = !hasSel;
      }

      function renderCustomers() {
        customersTableBody.innerHTML = "";
        if (selectedCustomerNo === null && customers.length) selectedCustomerNo = customers[0].no;
        customers.forEach(c => {
          const tr = document.createElement("tr");
          tr.dataset.no = c.no;
          tr.innerHTML = `<td>${c.no}</td><td>${c.name}</td><td>${c.email || ''}</td>`;
          if (c.no === selectedCustomerNo) tr.classList.add("selected");
          tr.addEventListener("click", () => { selectedCustomerNo = c.no; renderCustomers(); });
          tr.addEventListener("dblclick", () => { openCustomerModal(c, no => { selectedCustomerNo = no; renderCustomers(); }); });
          customersTableBody.appendChild(tr);
        });
        updateButtons();
      }

      btnAdd.addEventListener("click", () => openCustomerModal(null, no => { selectedCustomerNo = no; renderCustomers(); }));
      btnEdit.addEventListener("click", () => {
        const customer = customers.find(c => c.no === selectedCustomerNo);
        if (customer) openCustomerModal(customer, no => { selectedCustomerNo = no; renderCustomers(); });
      });
      btnDel.addEventListener("click", async () => {
        if (!selectedCustomerNo) return;
        if (confirm(i18n.t("¿Eliminar cliente?"))) {
          try {
            await db.delete('customers', { no: selectedCustomerNo });
            await loadFromDb();
            selectedCustomerNo = null;
            renderCustomers();
            renderImputations();
            if (window.refreshTasksPopup) window.refreshTasksPopup();
          } catch (err) {
            console.error(err);
            alert(i18n.t('Error al eliminar el cliente'));
          }
        }
      });
      closeBtn.addEventListener("click", closePopup);

      renderCustomers();
    });
}

function openCustomerModal(customer = null, onSave) {
  const tmpl = (currentCustomersBackdrop || document).querySelector("#customerModalTmpl");
  const clone = tmpl.content.cloneNode(true);
  const backdrop = clone.querySelector(".modal-backdrop");
  const form = clone.querySelector("#customerForm");
  if (customer) {
    Object.entries(customer).forEach(([k, v]) => { if (form.elements[k] != null) form.elements[k].value = v; });
    backdrop.querySelector(".modal-title").textContent = i18n.t("Editar cliente");
    form.elements["no"].readOnly = true;
  } else if (form.elements["customerPrintLanguaje"]) {
    form.elements["customerPrintLanguaje"].value = i18n.lang || 'es';
  }
  function closeModal() {
    backdrop.remove();
    document.removeEventListener('keydown', handleEsc, true);
  }
  function handleEsc(e) { if (e.key === 'Escape') { e.stopPropagation(); closeModal(); } }
  document.addEventListener('keydown', handleEsc, true);
  backdrop.querySelector(".close").addEventListener("click", closeModal);
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const data = sanitizeStrings(Object.fromEntries(new FormData(form).entries()));
    ["priceHour", "vat", "irpf", "minimumMonthlyHours", "minimumDailyHours"].forEach(f => data[f] = parseFloat(data[f] || 0));
    try {
      if (customer) {
        await db.update('customers', { no: customer.no }, data);
      } else {
        await db.insert('customers', data);
      }
      await loadFromDb();
      backdrop.remove();
      if (onSave) onSave(data.no);
      loadTasksInSelects();
      renderImputations();
      if (window.refreshTasksPopup) window.refreshTasksPopup();
    } catch (err) {
      console.error(err);
      alert('Error al guardar el cliente');
    }
  });
  (currentCustomersBackdrop || document.body).appendChild(clone);
}
