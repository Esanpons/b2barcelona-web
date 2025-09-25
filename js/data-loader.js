/*************** Carga de datos desde Supabase ****************/

const BASE_APP_TITLE = 'Aesva ERP';

window.customers = [];
const customerNoCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
window.invoices = [];
window.company = {};

function applyCompanyTitle() {
  const companyName = (window.company?.name || '').trim();
  const title = companyName ? `${BASE_APP_TITLE} (${companyName})` : BASE_APP_TITLE;
  document.title = title;
  const headerTitle = document.getElementById('appTitleText');
  if (headerTitle) headerTitle.textContent = title;
}

applyCompanyTitle();

async function loadCustomers() {
  const items = await db.select('customers');
  window.customers = items.sort((a, b) => customerNoCollator.compare(a.no ?? '', b.no ?? ''));
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

async function loadCompany() {
  const comp = await db.select('company');
  window.company = comp[0] || {};
  if (company.invoiceNextNumber && !company.invoiceNumbering)
    company.invoiceNumbering = company.invoiceNextNumber;
  applyCompanyTitle();
}

async function loadAllData(startDate = null, endDate = null) {
  await Promise.all([
    loadCustomers(),
    loadInvoices(),
    loadCompany()
  ]);
  if (window.i18n) i18n.setLang(localStorage.getItem('uiLang') || 'es');
}

window.loadCustomers = loadCustomers;
window.loadInvoices = loadInvoices;
window.loadCompany = loadCompany;
window.loadAllData = loadAllData;
