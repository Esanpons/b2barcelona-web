/*************** Carga de datos desde Supabase ****************/

// Variables globales compartidas
window.customers = [];
window.tasks = [];
window.invoices = [];
window.imputations = [];
window.calendarDays = [];
window.weekConfig = Array(7).fill(false);
window.company = {};
window.taskSeq = 1;
window.imputationSeq = 1;

// local util to pad numbers when building date strings for queries
const pad2d = n => n.toString().padStart(2, '0');
const formatDate = d => `${d.getFullYear()}-${pad2d(d.getMonth() + 1)}-${pad2d(d.getDate())}`;

async function loadCustomers() {
  window.customers = await db.select('customers');
}

async function loadTasks() {
  window.tasks = await db.select('tasks');
  window.taskSeq = Math.max(0, ...tasks.map(t => t.id)) + 1;
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
  let imps;
  if (startDate || endDate) {
    const s = startDate ? formatDate(startDate) : undefined;
    const e = endDate ? formatDate(endDate) : undefined;
    imps = await db.selectRange('imputations', 'date', s, e);
  } else {
    imps = await db.select('imputations');
  }
  window.imputations = imps;
  window.imputations.forEach(r => {
    r.date = new Date(r.date);
    r.inDate = new Date(r.inDate);
    r.outDate = r.outDate ? new Date(r.outDate) : null;
  });
  window.imputationSeq = Math.max(0, ...imputations.map(i => i.id)) + 1;
}

async function loadWeekConfig() {
  const wk = await db.select('week_config');
  window.weekConfig = Array(7).fill(false);
  wk.forEach(w => { weekConfig[w.weekday] = w.working; });
}

async function loadCalendar() {
  window.calendarDays = (await db.select('calendar_days')).map(d => ({
    date: d.date,
    type: d.type,
    desc: d.description || ''
  }));
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
    loadWeekConfig(),
    loadCalendar(),
    loadCompany()
  ]);
  if (window.i18n) i18n.setLang(localStorage.getItem('uiLang') || 'es');
}

window.loadCustomers = loadCustomers;
window.loadTasks = loadTasks;
window.loadInvoices = loadInvoices;
window.loadImputations = loadImputations;
window.loadWeekConfig = loadWeekConfig;
window.loadCalendar = loadCalendar;
window.loadCompany = loadCompany;
window.loadAllData = loadAllData;
