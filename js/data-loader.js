/*************** Carga de datos desde Supabase ****************/

window.customers = [];
window.invoices = [];
window.company = {};

async function loadCustomers() {
  window.customers = await db.select('customers');
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
