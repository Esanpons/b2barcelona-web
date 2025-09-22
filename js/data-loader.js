/*************** Carga de datos desde Supabase ****************/

window.customers = [];
window.tasks = [];
window.invoices = [];
window.imputations = [];
window.company = {};

const pad2d = n => n.toString().padStart(2, '0');
const formatDate = d => `${d.getFullYear()}-${pad2d(d.getMonth() + 1)}-${pad2d(d.getDate())}`;

async function loadCustomers() {
  window.customers = await db.select('customers');
}

async function loadTasks() {
  try {
    window.tasks = await db.select('tasks');
  } catch (err) {
    console.warn('No se pudieron cargar las tareas:', err);
    window.tasks = [];
  }
}

async function loadInvoices() {
  const invs = await db.select('invoices');
  const lines = await db.select('invoice_lines');
  window.invoices = invs.map(inv => ({
    ...inv,
    paid: !!(inv.invoicePayment ?? inv.paid),
    lines: lines
      .filter(l => l.invoiceNo === inv.no)
      .sort((a, b) => a.lineNo - b.lineNo)
      .map(l => ({ description: l.description, qty: l.qty }))
  }));
}

async function loadImputations(startDate = null, endDate = null) {
  try {
    let imps;
    if (startDate || endDate) {
      const s = startDate ? formatDate(startDate) : undefined;
      const e = endDate ? formatDate(endDate) : undefined;
      imps = await db.selectRange('imputations', 'date', s, e);
    } else {
      imps = await db.select('imputations');
    }
    window.imputations = imps.map(r => ({
      ...r,
      date: new Date(r.date),
      inDate: new Date(r.inDate),
      outDate: r.outDate ? new Date(r.outDate) : null
    }));
  } catch (err) {
    console.warn('No se pudieron cargar las imputaciones:', err);
    window.imputations = [];
  }
}

async function loadCompany() {
  const comp = await db.select('company');
  window.company = comp[0] || {};
  if (company.invoiceNextNumber && !company.invoiceNumbering)
    company.invoiceNumbering = company.invoiceNextNumber;
}

async function loadAllData(startDate = null, endDate = null) {
  await Promise.all([
    loadCustomers(),
    loadTasks(),
    loadInvoices(),
    loadImputations(startDate, endDate),
    loadCompany()
  ]);
  if (window.i18n) i18n.setLang(localStorage.getItem('uiLang') || 'es');
}

window.loadCustomers = loadCustomers;
window.loadTasks = loadTasks;
window.loadInvoices = loadInvoices;
window.loadImputations = loadImputations;
window.loadCompany = loadCompany;
window.loadAllData = loadAllData;
