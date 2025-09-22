/*************** Núcleo simplificado de la aplicación ****************/

(function () {
  const pad2 = n => n.toString().padStart(2, '0');

  function formatInputDate(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function round2(value) {
    return Math.round(value * 100 + Number.EPSILON) / 100;
  }

  async function loadFromDb(startDate = null, endDate = null) {
    if (window.dbReady) await window.dbReady;
    if (typeof loadAllData === 'function') {
      await loadAllData(startDate, endDate);
    }
  }

  window.formatInputDate = formatInputDate;
  window.round2 = round2;
  window.loadFromDb = loadFromDb;

  if (typeof window.renderImputations !== 'function') window.renderImputations = () => {};
  if (typeof window.loadTasksInSelects !== 'function') window.loadTasksInSelects = () => {};

  document.addEventListener('DOMContentLoaded', () => {
    loadFromDb().catch(console.error);
  });
})();
