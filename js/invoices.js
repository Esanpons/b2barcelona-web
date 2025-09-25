/*************** Facturas (popup externo) ****************/
let currentInvoicesBackdrop = null;

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function parseCsv(text) {
  const cleanText = text.replace(/\ufeff/g, '').replace(/\r/g, '');
  const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const headers = parseCsvLine(lines.shift()).map(h => h.trim());
  return lines.map(line => {
    const values = parseCsvLine(line);
    const entry = {};
    headers.forEach((header, idx) => {
      const value = idx < values.length ? values[idx] : '';
      entry[header] = value.trim();
    });
    return entry;
  });
}

function cleanObject(obj) {
  const out = {};
  Object.entries(obj).forEach(([key, value]) => {
    if (value !== undefined) out[key] = value;
  });
  return out;
}

function toNumber(value) {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  if (!normalized) return undefined;
  const num = Number(normalized.replace(',', '.'));
  return Number.isFinite(num) ? num : undefined;
}

function toInteger(value) {
  const num = toNumber(value);
  return num === undefined ? undefined : Math.trunc(num);
}

function toBoolean(value) {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  if (!normalized) return undefined;
  if (/^(true|1|si|sí|yes)$/i.test(normalized)) return true;
  if (/^(false|0|no)$/i.test(normalized)) return false;
  return undefined;
}

function emptyToNull(value) {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  if (!normalized) return null;
  if (/^null$/i.test(normalized)) return null;
  return normalized;
}

function mapInvoiceHeaderRow(row) {
  const data = {
    no: row.no ? row.no.trim() : undefined,
    date: row.date ? row.date.trim() : undefined,
    customerNo: row.customer_no ? row.customer_no.trim() : (row.customerNo ? row.customerNo.trim() : undefined),
    priceHour: toNumber(row.price_hour ?? row.priceHour),
    vat: toNumber(row.vat),
    irpf: toNumber(row.irpf),
    createdAt: emptyToNull(row.created_at ?? row.createdAt),
    arrayLinesInvoicePrint: emptyToNull(row.array_lines_invoice_print ?? row.arrayLinesInvoicePrint),
    invoicePayment: toBoolean(row.invoice_payment ?? row.invoicePayment)
  };
  return cleanObject(data);
}

function mapInvoiceLineRow(row) {
  const data = {
    id: toInteger(row.id),
    invoiceNo: row.invoice_no ? row.invoice_no.trim() : (row.invoiceNo ? row.invoiceNo.trim() : undefined),
    lineNo: toInteger(row.line_no ?? row.lineNo),
    description: row.description !== undefined ? row.description : undefined,
    qty: toNumber(row.qty)
  };
  return cleanObject(data);
}

const invoicesButton = document.getElementById("btnInvoices");
if (invoicesButton) invoicesButton.addEventListener("click", openInvoicesPopup);

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
      const btnImportHeaders = bd.querySelector('#BtnImportInvoiceHeaders');
      const btnImportLines = bd.querySelector('#BtnImportInvoiceLines');
      const yearSel = bd.querySelector('#invoiceYearFilter');
      const closeBtn = bd.querySelector('.close');

      const headersFileInput = document.createElement('input');
      headersFileInput.type = 'file';
      headersFileInput.accept = '.csv,text/csv';
      headersFileInput.style.display = 'none';
      page.appendChild(headersFileInput);

      const linesFileInput = document.createElement('input');
      linesFileInput.type = 'file';
      linesFileInput.accept = '.csv,text/csv';
      linesFileInput.style.display = 'none';
      page.appendChild(linesFileInput);

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
        if (btnImportHeaders) btnImportHeaders.disabled = false;
        if (btnImportLines) btnImportLines.disabled = false;
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

      function refreshAfterImport(lastNo, fallbackYear) {
        renderYearOptions();
        let targetYear = fallbackYear;
        if (lastNo) {
          const inv = invoices.find(i => i.no === lastNo);
          if (inv) {
            selectedNo = lastNo;
            targetYear = inv.date.substring(0, 4);
          }
        }
        if (targetYear) {
          const options = Array.from(yearSel.options);
          if (options.some(opt => opt.value === targetYear)) yearSel.value = targetYear;
        }
        render();
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
      if (btnImportHeaders) {
        btnImportHeaders.addEventListener('click', () => headersFileInput.click());
        headersFileInput.addEventListener('change', async () => {
          if (!headersFileInput.files || !headersFileInput.files[0]) return;
          btnImportHeaders.disabled = true;
          let inserted = 0;
          let lastInvoice = null;
          const previousYear = yearSel.value;
          try {
            const text = await headersFileInput.files[0].text();
            const rows = parseCsv(text);
            if (!rows.length) {
              alert('El archivo CSV no contiene registros.');
              return;
            }
            const mapped = rows.map(mapInvoiceHeaderRow).filter(r => Object.keys(r).length);
            if (!mapped.length) {
              alert('No se han encontrado cabeceras válidas en el CSV.');
              return;
            }
            if (!confirm(`Se han leído ${mapped.length} cabeceras de factura. ¿Quieres continuar?`)) return;
            for (const record of mapped) {
              try {
                await db.insert('invoices', record);
              } catch (err) {
                if (err && err.code === '23505' && record.no) {
                  await db.update('invoices', { no: record.no }, record);
                } else {
                  throw err;
                }
              }
              inserted += 1;
              if (record.no) lastInvoice = record.no;
            }
            await loadInvoices();
            refreshAfterImport(lastInvoice, previousYear);
            alert('Importación de cabeceras completada correctamente.');
          } catch (err) {
            console.error(err);
            if (inserted > 0) {
              try {
                await loadInvoices();
                refreshAfterImport(lastInvoice, previousYear);
              } catch (loadErr) {
                console.error(loadErr);
              }
            }
            alert('Se produjo un error al importar las cabeceras. Revisa la consola para más detalles.');
          } finally {
            btnImportHeaders.disabled = false;
            headersFileInput.value = '';
          }
        });
      }
      if (btnImportLines) {
        btnImportLines.addEventListener('click', () => linesFileInput.click());
        linesFileInput.addEventListener('change', async () => {
          if (!linesFileInput.files || !linesFileInput.files[0]) return;
          btnImportLines.disabled = true;
          let inserted = 0;
          let lastInvoice = null;
          const previousYear = yearSel.value;
          try {
            const text = await linesFileInput.files[0].text();
            const rows = parseCsv(text);
            if (!rows.length) {
              alert('El archivo CSV no contiene registros.');
              return;
            }
            const mapped = rows.map(mapInvoiceLineRow).filter(r => Object.keys(r).length);
            if (!mapped.length) {
              alert('No se han encontrado líneas válidas en el CSV.');
              return;
            }
            if (!confirm(`Se han leído ${mapped.length} líneas de factura. ¿Quieres continuar?`)) return;
            for (const record of mapped) {
              try {
                await db.insert('invoice_lines', record);
              } catch (err) {
                if (err && err.code === '23505' && record.id !== undefined) {
                  await db.update('invoice_lines', { id: record.id }, record);
                } else {
                  throw err;
                }
              }
              inserted += 1;
              if (record.invoiceNo) lastInvoice = record.invoiceNo;
            }
            await loadInvoices();
            refreshAfterImport(lastInvoice, previousYear);
            alert('Importación de líneas completada correctamente.');
          } catch (err) {
            console.error(err);
            if (inserted > 0) {
              try {
                await loadInvoices();
                refreshAfterImport(lastInvoice, previousYear);
              } catch (loadErr) {
                console.error(loadErr);
              }
            }
            alert('Se produjo un error al importar las líneas. Revisa la consola para más detalles.');
          } finally {
            btnImportLines.disabled = false;
            linesFileInput.value = '';
          }
        });
      }
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
  const priceInput = form.elements['priceHour'];
  const linesBody = clone.querySelector('#invoiceLinesTable tbody');
  const btnAddLine = clone.querySelector('#BtnAddLine');
  const btnDelLine = clone.querySelector('#BtnDelLine');
  const totalsDiv = clone.querySelector('#invoiceTotals');
  const btnPrint = clone.querySelector('#BtnPrintInvoice');
  const paidChk = form.elements['paid'];

  let lines = invoice ? invoice.lines.map(l => ({ ...l })) : [];

  let selectedLine = null;
  const originalCustomerNo = invoice ? invoice.customerNo : null;

  function priceHour() {
    return parseFloat(priceInput.value) || 0;
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
    updateTotal();
  }

  btnAddLine.addEventListener('click', () => { lines.push({ description: '', qty: 1 }); selectedLine = lines.length - 1; renderLines(); });
  btnDelLine.addEventListener('click', () => { if (selectedLine === null) return; lines.splice(selectedLine, 1); selectedLine = null; renderLines(); });
  if (invoice) {
    Object.entries(invoice).forEach(([k, v]) => {
      if (!form.elements[k]) return;
      if (form.elements[k].type === 'checkbox') form.elements[k].checked = !!v;
      else form.elements[k].value = v;
    });
    customerSel.value = invoice.customerNo;
    form.elements['no'].readOnly = true;
  } else {
    form.elements['no'].value = getNextInvoiceNo();
    form.elements['date'].value = formatInputDate(new Date());
  }

  function syncCustomer() {
    const cust = customers.find(c => c.no === customerSel.value);
    if (cust) {
      if (!invoice || customerSel.value !== originalCustomerNo || priceInput.value === '') {
        priceInput.value = cust.priceHour ?? '';
      }
      form.elements['vat'].value = cust.vat;
      form.elements['irpf'].value = cust.irpf;
    }
    renderLines();
  }

  customerSel.addEventListener('change', syncCustomer);
  priceInput.addEventListener('input', () => {
    renderLines();
  });

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
        irpf: data.irpf
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
