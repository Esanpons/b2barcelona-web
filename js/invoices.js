/*************** Facturas (popup externo) ****************/
let currentInvoicesBackdrop = null;

document.getElementById("btnInvoices").addEventListener("click", openInvoicesPopup);

function invoiceTotal(inv) {
  const base = inv.lines.reduce((s, l) => s + l.qty * inv.priceHour, 0);
  const vat = base * (inv.vat || 0) / 100;
  const irpf = base * (inv.irpf || 0) / 100;
  return round2(base - irpf + vat);
}

function incrementInvoiceNumber(no) {
  const m = /^(\d{4}-)(\d+)$/.exec(no);
  if (!m) return no;
  const prefix = m[1];
  const n = String(parseInt(m[2], 10) + 1).padStart(m[2].length, '0');
  return prefix + n;
}

function compareInvoiceNo(a, b) {
  const ma = /^(\d{4})-(\d+)$/.exec(a) || [];
  const mb = /^(\d{4})-(\d+)$/.exec(b) || [];
  if (ma.length && mb.length) {
    if (ma[1] !== mb[1]) return parseInt(ma[1], 10) - parseInt(mb[1], 10);
    return parseInt(ma[2], 10) - parseInt(mb[2], 10);
  }
  return a.localeCompare(b);
}

function getNextInvoiceNo() {
  let next = company.invoiceNumbering;
  invoices.forEach(inv => {
    if (compareInvoiceNo(inv.no, next) >= 0) next = incrementInvoiceNumber(inv.no);
  });
  return next;
}

function openInvoicesPopup() {
  if (currentInvoicesBackdrop) { currentInvoicesBackdrop.remove(); currentInvoicesBackdrop = null; }

  fetch("html/invoices.html")
    .then(r => r.text())
    .then(html => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const page = doc.getElementById('invoicesPage');
      if (window.i18n) i18n.apply(page);
      const bd = document.createElement('div');
      bd.className = 'modal-backdrop invoices-popup';
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.appendChild(page);
      bd.appendChild(modal);
      document.body.appendChild(bd);
      currentInvoicesBackdrop = bd;

      const tableBody = bd.querySelector('#invoicesTable tbody');
      const btnAdd = bd.querySelector('#BtnAddInvoice');
      const btnEdit = bd.querySelector('#BtnEditInvoice');
      const btnDel = bd.querySelector('#BtnDelInvoice');
      const btnPrintList = bd.querySelector('#BtnPrintInv');
      const yearSel = bd.querySelector('#invoiceYearFilter');
      const closeBtn = bd.querySelector('.close');

      function closePopup() {
        bd.remove();
        currentInvoicesBackdrop = null;
        document.removeEventListener('keydown', handleEsc);
      }

      function handleEsc(e) { if (e.key === 'Escape') closePopup(); }
      document.addEventListener('keydown', handleEsc);

      let selectedNo = invoices.length
        ? invoices
            .slice()
            .sort((a, b) => b.date.localeCompare(a.date) || compareInvoiceNo(b.no, a.no))[0].no
        : null;

      function renderYearOptions() {
        const years = Array.from(new Set(invoices.map(i => i.date.substring(0, 4))));
        const current = new Date().getFullYear().toString();
        if (!years.includes(current)) years.push(current);
        years.sort((a, b) => b - a);
        yearSel.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
        yearSel.value = current;
      }

      function updateButtons() {
        const inv = invoices.find(i => i.no === selectedNo);
        const has = !!selectedNo;
        btnEdit.disabled = !has;
        btnDel.disabled = !has || (inv && inv.paid);
        btnPrintList.disabled = !has;
      }

      function render() {
        tableBody.innerHTML = '';
        const year = yearSel.value;
        const list = invoices
          .filter(inv => inv.date.startsWith(year))
          .slice()
          .sort((a, b) => b.date.localeCompare(a.date) || compareInvoiceNo(b.no, a.no));
        if (selectedNo === null && list.length) selectedNo = list[0].no;
        list.forEach(inv => {
          const cust = customers.find(c => c.no === inv.customerNo);
          const tr = document.createElement('tr');
          tr.dataset.no = inv.no;
          tr.innerHTML = `<td>${inv.no}</td><td>${inv.date}</td><td>${cust ? cust.name : ''}</td><td>${invoiceTotal(inv).toFixed(2)}</td><td>${inv.paid ? i18n.t('Sí') : i18n.t('No')}</td>`;
          if (inv.no === selectedNo) tr.classList.add('selected');
          tr.addEventListener('click', () => { selectedNo = inv.no; render(); });
          tr.addEventListener('dblclick', () => { const invc = invoices.find(i => i.no === inv.no); if (invc) openInvoiceModal(invc, no => { selectedNo = no; render(); }); });
          tableBody.appendChild(tr);
        });
        updateButtons();
      }

      btnAdd.addEventListener('click', () => openInvoiceModal(null, no => { selectedNo = no; render(); }));
      btnEdit.addEventListener('click', () => {
        const inv = invoices.find(i => i.no === selectedNo);
        if (inv) openInvoiceModal(inv, no => { selectedNo = no; render(); });
      });
      btnDel.addEventListener('click', async () => {
        if (!selectedNo) return;
        if (confirm(i18n.t('¿Eliminar factura?'))) {
          try {
            await db.delete('invoice_lines', { invoice_no: selectedNo });
            await db.delete('invoices', { no: selectedNo });
            await loadFromDb();
            selectedNo = null;
            render();
          } catch (err) {
            console.error(err);
            alert(i18n.t('Error al eliminar la factura'));
          }
        }
      });
      btnPrintList.addEventListener('click', () => {
        if (!selectedNo) return;
        const inv = invoices.find(i => i.no === selectedNo);
        if (inv) printInvoice(inv);
      });
      yearSel.addEventListener('change', render);
      closeBtn.addEventListener('click', closePopup);

      renderYearOptions();
      render();
    });
}

function openInvoiceModal(invoice = null, onSave) {
  const tmpl = (currentInvoicesBackdrop || document).querySelector('#invoiceModalTmpl');
  const clone = tmpl.content.cloneNode(true);
  const bd = clone.querySelector('.modal-backdrop');
  const form = clone.querySelector('#invoiceForm');
  const customerSel = form.elements['customerNo'];
  customerSel.innerHTML = '<option value=""></option>' + customers.map(c => `<option value="${c.no}">${c.no} - ${c.name}</option>`).join('');
  const linesBody = clone.querySelector('#invoiceLinesTable tbody');
  const btnAddLine = clone.querySelector('#BtnAddLine');
  const btnDelLine = clone.querySelector('#BtnDelLine');
  const btnImport = clone.querySelector('#BtnImportImps');
  const totalsDiv = clone.querySelector('#invoiceTotals');
  const totalSpan = clone.querySelector('#invoiceTotal');
  const btnPrint = clone.querySelector('#BtnPrintInvoice');
  const btnSave = form.querySelector('button[type="submit"]');
  const paidChk = form.elements['paid'];
  const linesPerPageInput = form.elements['arrayLinesInvoicePrint'];

  let lines = invoice ? invoice.lines.map(l => ({ ...l })) : [];

  let selectedLine = null;

  function priceHour() {
    const cust = customers.find(c => c.no === customerSel.value);
    return cust ? cust.priceHour || 0 : 0;
  }

  function updateTotal() {
    const base = lines.reduce((s, l) => s + l.qty * priceHour(), 0);
    const vat = base * (parseFloat(form.elements['vat'].value) || 0) / 100;
    const irpf = base * (parseFloat(form.elements['irpf'].value) || 0) / 100;
    const total = round2(base + vat - irpf);
    totalsDiv.innerHTML = `
      <div>Base: <span>${base.toFixed(2)}</span></div>
      <div>+ IVA (${form.elements['vat'].value || 0}%): <span>${vat.toFixed(2)}</span></div>
      <div>- IRPF (${form.elements['irpf'].value || 0}%): <span>${irpf.toFixed(2)}</span></div>
      <div class="final">Total: <span id="invoiceTotal">${total.toFixed(2)}</span></div>`;
  }

  function renderLines() {
    linesBody.innerHTML = '';
    lines.forEach((ln, idx) => {
      const tr = document.createElement('tr');
      tr.dataset.idx = idx;
      tr.innerHTML = `<td><input type="text" data-idx="${idx}" name="desc" value="${ln.description}" /></td>
                     <td><input type="text" data-idx="${idx}" name="qty" value="${ln.qty}" inputmode="decimal" /></td>
                     <td>${(ln.qty * priceHour()).toFixed(2)}</td>`;
      if (idx == selectedLine) tr.classList.add('selected');
      tr.addEventListener('click', e => { if (e.target.tagName !== 'INPUT') { selectedLine = idx; renderLines(); } });
      linesBody.appendChild(tr);
    });
    linesBody.querySelectorAll('input[name="desc"]').forEach(inp => {
      inp.addEventListener('input', () => { lines[inp.dataset.idx].description = inp.value; });
    });
    linesBody.querySelectorAll('input[name="qty"]').forEach(inp => {
      inp.dataset.prev = inp.value;
      inp.addEventListener('focus', () => { inp.dataset.prev = inp.value; });
      inp.addEventListener('blur', () => {
        const raw = inp.value.trim();
        if (raw.includes(',') || !/^-?\d+(?:\.\d+)?$/.test(raw)) {
          alert(i18n.t('Cantidad inválida'));
          inp.value = inp.dataset.prev || '';
          return;
        }
        const val = parseFloat(raw);
        if (isNaN(val)) {
          alert(i18n.t('Cantidad inválida'));
          inp.value = inp.dataset.prev || '';
          return;
        }
        lines[inp.dataset.idx].qty = val;
        inp.closest('tr').lastElementChild.textContent = (val * priceHour()).toFixed(2);
        updateTotal();
      });
    });
    const locked = paidChk.checked;
    linesBody.querySelectorAll('input').forEach(inp => { inp.disabled = locked; });
    btnAddLine.disabled = locked;
    btnDelLine.disabled = selectedLine === null || locked;
    btnImport.disabled = locked;
    updateTotal();
  }

  btnAddLine.addEventListener('click', () => { lines.push({ description: '', qty: 1 }); selectedLine = lines.length - 1; renderLines(); });
  btnDelLine.addEventListener('click', () => { if (selectedLine === null) return; lines.splice(selectedLine, 1); selectedLine = null; renderLines(); });
  btnImport.addEventListener('click', importImps);

  if (invoice) {
    Object.entries(invoice).forEach(([k, v]) => {
      if (!form.elements[k]) return;
      if (form.elements[k].type === 'checkbox') form.elements[k].checked = !!v;
      else form.elements[k].value = v;
    });
    customerSel.value = invoice.customerNo;
    form.elements['no'].readOnly = true;
    if (linesPerPageInput) linesPerPageInput.value = invoice.arrayLinesInvoicePrint || '';
  } else {
    form.elements['no'].value = getNextInvoiceNo();
    form.elements['date'].value = formatInputDate(new Date());
  }

  function syncCustomer() {
    const cust = customers.find(c => c.no === customerSel.value);
    if (cust) {
      form.elements['vat'].value = cust.vat;
      form.elements['irpf'].value = cust.irpf;
    }
    renderLines();
    updateTotal();
  }

  customerSel.addEventListener('change', syncCustomer);

  syncCustomer();
  updateLocked();

  function updateLocked() {
    const locked = paidChk.checked;
    // Disable all editable fields except the paid checkbox itself
    form.querySelectorAll('input, select, textarea').forEach(el => {
      if (el === paidChk) return;
      if (el.type === 'button' || el.type === 'submit') return;
      el.disabled = locked;
    });
    renderLines();
  }
  paidChk.addEventListener('change', updateLocked);

  function importImps() {
    if (paidChk.checked) return;
    const dateVal = form.elements['date'].value;
    const cust = customerSel.value;
    if (!dateVal || !cust) return;
    const d = new Date(dateVal);
    const total = imputations.filter(imp => {
      if (!imp.outDate || imp.noFee) return false;
      const impDate = imp.date instanceof Date ? imp.date : new Date(imp.date);
      if (impDate.getFullYear() !== d.getFullYear() || impDate.getMonth() !== d.getMonth()) return false;
      const t = tasks.find(t => t.id === imp.taskId);
      return t && t.customerNo === cust;
    }).reduce((s, imp) => s + imp.totalDecimal, 0);
    lines.push({ description: i18n.t('Horas realizadas en el período'), qty: round2(total) });
    selectedLine = lines.length - 1;
    renderLines();
  }

  function collectData() {
    for (const ln of lines) {
      if (isNaN(ln.qty)) {
        alert(i18n.t('Cantidad inválida en una línea'));
        return null;
      }
    }
    const base = {
      no: form.elements['no'].value,
      date: form.elements['date'].value,
      customerNo: customerSel.value,
      vat: parseFloat(form.elements['vat'].value) || 0,
      irpf: parseFloat(form.elements['irpf'].value) || 0,
      priceHour: priceHour(),
      arrayLinesInvoicePrint: linesPerPageInput ? linesPerPageInput.value.trim() : '',
      lines: lines.map(l => sanitizeStrings({ ...l })),
      paid: paidChk.checked
    };
    return sanitizeStrings(base);
  }

  btnPrint.addEventListener('click', () => {
    printInvoice(collectData());
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const data = collectData();
    if (!data) return;
    try {
      const baseFields = {
        date: data.date,
        customerNo: data.customerNo,
        priceHour: data.priceHour,
        vat: data.vat,
        irpf: data.irpf,
        arrayLinesInvoicePrint: data.arrayLinesInvoicePrint
      };

      async function attempt(saveFn) {
        try {
          await saveFn({ ...baseFields, invoicePayment: data.paid });
        } catch (err) {
          if (err.code === 'PGRST204' && /invoice_payment/.test(err.message || '')) {
            await saveFn({ ...baseFields, paid: data.paid });
          } else throw err;
        }
      }

      if (invoice) {
        await attempt(fields => db.update('invoices', { no: invoice.no }, fields));
        await db.delete('invoice_lines', { invoice_no: invoice.no });
      } else {
        await attempt(fields => db.insert('invoices', { no: data.no, ...fields }));
        company.invoiceNumbering = incrementInvoiceNumber(data.no);
        if (company.id)
          await db.update('company', { id: company.id }, { invoiceNumbering: company.invoiceNumbering });
      }
      for (let i = 0; i < data.lines.length; i++) {
        await db.insert('invoice_lines', { invoiceNo: data.no, lineNo: i + 1, description: data.lines[i].description, qty: data.lines[i].qty });
      }
      await loadFromDb();
      bd.remove();
      if (onSave) onSave(data.no);
    } catch (err) {
      console.error(err);
      alert('Error al guardar la factura');
    }
  });

  function closeModal() {
    bd.remove();
    document.removeEventListener('keydown', handleEscModal, true);
  }
  function handleEscModal(e) { if (e.key === 'Escape') { e.stopPropagation(); closeModal(); } }
  document.addEventListener('keydown', handleEscModal, true);
  bd.querySelector('.close').addEventListener('click', closeModal);
  (currentInvoicesBackdrop || document.body).appendChild(clone);
  renderLines();
  updateTotal();
  updateLocked();
}
