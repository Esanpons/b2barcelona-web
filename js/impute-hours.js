/*************** Datos compartidos ****************/
// Las variables globales (customers, tasks, invoices...) se definen en
// data-loader.js para centralizar la carga desde la base de datos.

/*************** Calendario y semana ****************/
// weekConfig y calendarDays también provienen de data-loader.js
function calendarLookup(d) { const k = d.toISOString().substring(0, 10); return calendarDays.find(c => c.date === k) || null; }
function isCalendarHoliday(d) { return calendarLookup(d)?.type === "festivo"; }
function isCalendarVacation(d) { return calendarLookup(d)?.type === "vacaciones"; }
function isWeekend(d) { return !weekConfig[d.getDay()]; }

async function loadFromDb(startDate = null, endDate = null) {
  btnAddImp.disabled = true;
  btnEntrar.disabled = true;
  await loadAllData(startDate, endDate);
  resumeOpenSession();
  renderImputations();
  loadTasksInSelects();
  btnAddImp.disabled = false;
  if (!isWorking) btnEntrar.disabled = false;
}

/*************** Utilidades ****************/
const pad2 = n => n.toString().padStart(2, '0');
const fmtTime = ms => { const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60; return `${pad2(h)}:${pad2(m)}:${pad2(ss)}`; };
const fmtClock = d => `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
const formatInputTime = d => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const formatInputDate = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseDT = (date, time) => { const [y, m, day] = date.split('-').map(Number); const [h, min] = time.split(':').map(Number); return new Date(y, m - 1, day, h, min, 0, 0); };
const round15 = d => { const ms = 15 * 60 * 1000; return new Date(Math.round(d.getTime() / ms) * ms); };
const round2 = v => Math.round(v * 100 + Number.EPSILON) / 100;
const sameDay = (a, b) => a.getDate() == b.getDate() && a.getMonth() == b.getMonth() && a.getFullYear() == b.getFullYear();

/*************** Control de fichaje ****************/
let isWorking = false, sessionStart = null, sessionTaskId = "";
const tiempoTotalEl = document.getElementById("TiempoTotalTrabajado");
const btnEntrar = document.getElementById("BtnEntrar");
const btnSalir = document.getElementById("BtnSalir");
const currentTaskSelect = document.getElementById("currentTaskSelect");
currentTaskSelect.dataset.prev = '';
function selectedTaskIdFromInput(input) {
  const opt = document.querySelector(`#taskOptions option[value="${input.value}"]`);
  return opt ? opt.dataset.id || "" : "";
}
function validateTaskInput(input) {
  if (!input.dataset.id) {
    if (input.value.trim() === '') {
      input.dataset.id = '';
      return true; // allow empty task
    }
    alert(i18n.t('Tarea no válida'));
    input.value = input.dataset.prev || '';
    input.dataset.id = selectedTaskIdFromInput(input);
    return false;
  }
  return true;
}
currentTaskSelect.addEventListener("input", () => {
  currentTaskSelect.dataset.id = selectedTaskIdFromInput(currentTaskSelect);
  sessionTaskId = currentTaskSelect.dataset.id;
});
currentTaskSelect.addEventListener('focus', () => { currentTaskSelect.dataset.prev = currentTaskSelect.value; });
currentTaskSelect.addEventListener('blur', () => { validateTaskInput(currentTaskSelect); });
const ultimaEntrada = document.getElementById("UltimaAccionEntrada");
const ultimaSalida = document.getElementById("UltimaAccionSalida");


btnEntrar.addEventListener("click", async () => {
  if (isWorking) return;
  isWorking = true;
  sessionStart = new Date();
  sessionTaskId = currentTaskSelect.dataset.id || "";
  ultimaEntrada.innerHTML = `Has entrado<br>${fmtClock(sessionStart)}`;
  ultimaEntrada.style.display = "block"; ultimaSalida.style.display = "none";
  btnEntrar.disabled = true; btnSalir.disabled = false;
  await createOpenImputation(sessionStart, sessionTaskId);
  updateTimer();
});
btnSalir.addEventListener("click", async () => {
  if (!isWorking) return;
  const end = new Date();
  await closeLastOpenImputation(end);
  isWorking = false;
  ultimaSalida.innerHTML = `Has salido<br>${fmtClock(end)}`;
  ultimaSalida.style.display = "block"; ultimaEntrada.style.display = "none";
  btnEntrar.disabled = false; btnSalir.disabled = true;
  sessionStart = null; sessionTaskId = ""; currentTaskSelect.value = ""; currentTaskSelect.dataset.id = "";
  updateTimer();
});

// Timer sólo hoy
function updateTimer() {
  const now = new Date();
  const todayImps = imputations.filter(i => sameDay(i.date, now) && !i.noFee);
  let total = 0;
  todayImps.forEach(i => {
    if (i.outDate) {
      total += i.outDate - i.inDate;
    } else {
      if (now >= i.inDate) { total += now - i.inDate; }
    }
  });
  tiempoTotalEl.textContent = fmtTime(total);
}
setInterval(() => { if (isWorking) updateTimer(); }, 1000);

function resumeOpenSession() {
  const open = imputations
    .filter(r => !r.outDate)
    .sort((a, b) => b.inDate - a.inDate)[0];
  if (open) {
    isWorking = true;
    sessionStart = new Date(open.inDate);
    sessionTaskId = open.taskId || "";
    const t = tasks.find(tt => tt.id == sessionTaskId);
    if (t) {
      currentTaskSelect.value = t.clientTaskNo || t.subject;
      currentTaskSelect.dataset.id = sessionTaskId;
    }
    btnEntrar.disabled = true;
    btnSalir.disabled = false;
    ultimaEntrada.innerHTML = `Has entrado<br>${fmtClock(sessionStart)}`;
    ultimaEntrada.style.display = "block";
    ultimaSalida.style.display = "none";
  } else {
    isWorking = false;
    sessionStart = null;
    sessionTaskId = "";
    currentTaskSelect.value = "";
    currentTaskSelect.dataset.id = "";
    btnEntrar.disabled = false;
    btnSalir.disabled = true;
    ultimaEntrada.style.display = "none";
    ultimaSalida.style.display = "none";
  }
  updateTimer();
}

/*************** Imputaciones ****************/
const imputationsTableBody = document.querySelector("#imputationsTable tbody");
const btnAddImp = document.getElementById("BtnAddImputation");
const btnEditImp = document.getElementById("BtnEditImputation");
const btnDelImp = document.getElementById("BtnDelImputation");
const btnLoadAllImp = document.getElementById("BtnLoadAllImp");
const btnExportImp = document.getElementById("BtnExportImp");
btnAddImp.addEventListener("click", () => openImputationModal());

let selectedImputationId = null;
function updateImputationButtons() {
  const hasSel = !!selectedImputationId;
  btnEditImp.disabled = !hasSel;
  btnDelImp.disabled = !hasSel;
}
btnEditImp.addEventListener("click", () => {
  const rec = imputations.find(r => r.id === selectedImputationId);
  if (rec) openImputationModal(rec);
});
btnDelImp.addEventListener("click", async () => {
  if (!selectedImputationId) return;
  if (confirm(i18n.t("¿Eliminar imputación?"))) {
    try {
      await db.delete('imputations', { id: selectedImputationId });
      await loadFromDb();
      selectedImputationId = null;
      updateTimer();
    } catch (err) {
      console.error(err);
      alert(i18n.t('Error al eliminar la imputación'));
    }
  }
});
btnLoadAllImp.addEventListener("click", async () => {
  await loadFromDb();
  selectedImputationId = null;
});
btnExportImp.addEventListener("click", exportImputationsCsv);

function renderImputations() {
  imputationsTableBody.innerHTML = "";
  const filter = activeFilter(), txt = document.getElementById("searchFilter").value.toLowerCase();
  const list = filterImputations().sort((a, b) => b.inDate - a.inDate);
  if (selectedImputationId === null && list.length) selectedImputationId = list[0].id;
  list.forEach(rec => {
    const task = tasks.find(t => t.id == rec.taskId);
    const tr = document.createElement("tr");
    tr.dataset.id = rec.id;
    tr.innerHTML = `<td>${rec.date.toLocaleDateString()}</td>
        <td>${fmtClock(rec.inDate)}</td>
        <td>${rec.outDate ? fmtClock(rec.outDate) : ""}</td>
        <td>${rec.outDate ? fmtTime(rec.totalMs) : "00:00:00"}</td>
        <td>${rec.outDate ? rec.totalDecimal.toFixed(2) : "0.00"}</td>
        <td>${rec.outDate ? Math.round(rec.totalMs / 60000) : "0"}</td>
        <td>${task ? task.subject : ""}</td>
        <td>${task ? task.clientTaskNo || "" : ""}</td>
        <td>${rec.noFee ? "Sí" : "No"}</td>
        <td>${rec.isHoliday ? "Sí" : "No"}</td>
        <td>${rec.isVacation ? "Sí" : "No"}</td>
        <td>${rec.comments || ""}</td>`;
    if (rec.id === selectedImputationId) tr.classList.add("selected");
    tr.addEventListener("click", () => { selectedImputationId = rec.id; renderImputations(); });
    tr.addEventListener("dblclick", () => { openImputationModal(rec); });
    imputationsTableBody.appendChild(tr);
  });
  updateTotalsBar(list);
  updateImputationButtons();
}

/**
 * Totales:
 * - Tiempo trabajado / Decimal: imputaciones facturables (!noFee), incluidas festivos/vacaciones.
 * - Horas mínimas / laborales: sólo días con imputación facturable y no festivo/vacaciones.
 */
function filterImputations() {
  const filter = activeFilter(), txt = document.getElementById("searchFilter").value.toLowerCase();
  return imputations
    .filter(r => rowMatchesDate(filter, r.date))
    .filter(r => {
      if (!txt) return true;
      const t = tasks.find(t => t.id == r.taskId);
      return (
        t && (
          (t.subject || "").toLowerCase().includes(txt) ||
          (t.clientTaskNo || "").toLowerCase().includes(txt)
        )
      ) || (r.comments && r.comments.toLowerCase().includes(txt));
    });
}

function updateTotalsBar(list = null) {
  const filtered = list || filterImputations();

  let totalMs = 0, totalDec = 0, totalMin = 0;
  const dateMap = new Map(); // dateKey -> {billable,min,isHoliday,isVacation}

  filtered.forEach(r => {
    if (r.outDate && !r.noFee) {
      totalMs += r.totalMs;
      totalDec += r.totalDecimal;
      totalMin += r.totalMs / 60000;
    }

    const dateKey = r.date.toDateString();
    if (!dateMap.has(dateKey)) {
      dateMap.set(dateKey, { billable: false, min: 0, isHoliday: r.isHoliday, isVacation: r.isVacation });
    }
    const entry = dateMap.get(dateKey);
    if (r.isHoliday) entry.isHoliday = true;
    if (r.isVacation) entry.isVacation = true;
    if (!r.noFee && !r.isHoliday && !r.isVacation) {
      entry.billable = true;
      entry.min = Math.max(entry.min, r.minimumDailyHours || 0);
    }
    dateMap.set(dateKey, entry);
  });

  let totLabor = 0;
  dateMap.forEach(entry => {
    if (entry.billable && !entry.isHoliday && !entry.isVacation) totLabor += entry.min;
  });

  const dates = filtered.map(r => r.date);
  const start = dates.length ? new Date(Math.min(...dates)) : null;
  const end = dates.length ? new Date(Math.max(...dates)) : null;
  let minDaily = 0;
  filtered.forEach(r => { if (!r.noFee) minDaily = Math.max(minDaily, r.minimumDailyHours || 0); });
  let expected = 0;
  if (start && end) {
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (weekConfig[d.getDay()]) expected += minDaily;
    }
  }

  document.getElementById("totWorked").textContent = fmtTime(totalMs);
  document.getElementById("totDecimal").textContent = round2(totalDec).toString();
  document.getElementById("totMinutes").textContent = Math.round(totalMin);
  document.getElementById("totLabor").textContent = totLabor;
  document.getElementById("totExpected").textContent = expected;
}

function exportImputationsCsv() {
  const filter = activeFilter(), txt = document.getElementById('searchFilter').value.toLowerCase();
  const list = imputations
    .filter(r => rowMatchesDate(filter, r.date))
    .filter(r => {
      if (!txt) return true;
      const t = tasks.find(t => t.id == r.taskId);
      return (t && ((t.subject || '').toLowerCase().includes(txt) || (t.clientTaskNo || '').toLowerCase().includes(txt))) || (r.comments && r.comments.toLowerCase().includes(txt));
    })
    .sort((a, b) => b.inDate - a.inDate);
  const esc = v => `"${String(v).replace(/"/g, '""')}"`;
  const header = ['Fecha', 'Entrada', 'Salida', 'Total', 'Decimal', 'Minutos', 'Tarea', 'Nº tarea cliente', 'No Fee', 'Festivo', 'Vacaciones', 'Comentarios'].join(';');
  const rows = list.map(rec => {
    const task = tasks.find(t => t.id == rec.taskId);
    return [
      formatInputDate(rec.date),
      formatInputTime(rec.inDate),
      rec.outDate ? formatInputTime(rec.outDate) : '',
      rec.outDate ? fmtTime(rec.totalMs) : '00:00:00',
      rec.outDate ? rec.totalDecimal.toFixed(2) : '0.00',
      rec.outDate ? Math.round(rec.totalMs / 60000) : '0',
      task ? task.subject : '',
      task ? task.clientTaskNo || '' : '',
      rec.noFee ? i18n.t('Sí') : i18n.t('No'),
      rec.isHoliday ? i18n.t('Sí') : i18n.t('No'),
      rec.isVacation ? i18n.t('Sí') : i18n.t('No'),
      rec.comments || ''
    ].map(esc).join(';');
  });
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'imputaciones.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

function activeFilter() { return document.querySelector('#filterPane li.active[data-filter]')?.dataset.filter || "all"; }
function rowMatchesDate(filter, date) {
  const now = new Date();
  if (filter === "today") return sameDay(date, now);
  if (filter === "week") { const start = new Date(now); start.setDate(now.getDate() - now.getDay()); start.setHours(0, 0, 0, 0); return date >= start && date <= now; }
  if (filter === "month") return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  if (filter === "prevMonth") {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return date.getMonth() === prev.getMonth() && date.getFullYear() === prev.getFullYear();
  }
  return true;
}

Array.from(document.querySelectorAll('#filterPane li[data-filter]')).forEach(li => li.addEventListener('click', () => {
  document.querySelector('#filterPane li.active[data-filter]').classList.remove('active');
  li.classList.add('active'); renderImputations();
}));
document.getElementById('searchFilter').addEventListener('input', () => renderImputations());

// Crear imputación abierta
async function createOpenImputation(inDate, taskId, comments = '', noFee = false) {
  const ri = round15(inDate);
  const task = tasks.find(t => t.id == taskId);
  const customer = task ? customers.find(c => c.no === task.customerNo) : null;
  const date = new Date(ri.getFullYear(), ri.getMonth(), ri.getDate());
  const rec = sanitizeStrings({
    id: imputationSeq++,
    date,
    inDate: ri,
    outDate: null,
    totalMs: 0, totalDecimal: 0,
    taskId: taskId || "",
    comments: comments || (task ? task.taskDescription : ""),
    noFee: noFee || (task ? !!task.noCharge : false),
    isHoliday: isWeekend(date) || isCalendarHoliday(date),
    isVacation: isCalendarVacation(date),
    unitPriceHour: customer ? customer.priceHour : 0,
    vatPercentage: customer ? customer.vat : 0,
    irpfPercentage: customer ? customer.irpf : 0,
    minimumMonthlyHours: customer ? customer.minimumMonthlyHours : 0,
    minimumDailyHours: customer ? customer.minimumDailyHours : 0
  });
  await applyAiCorrection('imputations', rec, {});
  selectedImputationId = rec.id;
  return db.insert('imputations', {
    ...sanitizeStrings({
      ...rec,
      taskId: rec.taskId || null,
      date: formatInputDate(rec.date),
      inDate: rec.inDate.toISOString(),
      outDate: null
    })
  }).then(() => loadFromDb()).catch(console.error);
}
// Cerrar imputación abierta
async function closeLastOpenImputation(outDate) {
  const open = [...imputations].reverse().find(r => !r.outDate);
  if (!open) return;
  const ro = round15(outDate), ri = open.inDate;
  if (ro <= ri) { open.outDate = ro; open.totalMs = 0; open.totalDecimal = 0; return; }
  selectedImputationId = open.id;
  await db.update('imputations', { id: open.id }, {
    outDate: ro.toISOString(),
    totalMs: ro - ri,
    totalDecimal: round2((ro - ri) / 3600000),
    date: formatInputDate(open.date),
    isHoliday: isWeekend(ro) || isCalendarHoliday(ro),
    isVacation: isCalendarVacation(ro)
  }).then(() => loadFromDb()).catch(console.error);
}

function openImputationModal(record = null) {
  const tmpl = document.getElementById("imputationModalTmpl");
  const clone = tmpl.content.cloneNode(true);
  const backdrop = clone.querySelector(".modal-backdrop");
  const form = clone.querySelector("#imputationForm");
  const taskSel = form.elements["taskId"];
  const commentsInput = form.elements["comments"];
  const noFeeChk = form.elements["noFee"];
  const today = new Date();

  if (record) {
    backdrop.querySelector(".modal-title").textContent = "Editar imputación";
    form.elements["id"].value = record.id;
    form.elements["date"].value = formatInputDate(record.date);
    form.elements["inTime"].value = formatInputTime(record.inDate);
    form.elements["outTime"].value = record.outDate ? formatInputTime(record.outDate) : "";
    const tEdit = tasks.find(t => t.id == record.taskId);
    if (tEdit) {
      taskSel.value = tEdit.clientTaskNo || tEdit.subject;
      taskSel.dataset.id = record.taskId;
    }
    taskSel.dataset.prev = taskSel.value;
    commentsInput.value = record.comments || "";
    noFeeChk.checked = !!record.noFee;
  } else {
    form.elements["date"].value = formatInputDate(today);
    form.elements["inTime"].value = "09:00";
    form.elements["outTime"].value = "17:00";
    taskSel.dataset.id = "";
    taskSel.dataset.prev = '';
  }

  taskSel.addEventListener("input", () => {
    taskSel.dataset.id = selectedTaskIdFromInput(taskSel);
    const t = tasks.find(tt => tt.id == taskSel.dataset.id);
    if (t) {
      if (!commentsInput.value.trim()) { commentsInput.value = t.taskDescription || ""; }
      if (!record) { noFeeChk.checked = noFeeChk.checked || !!t.noCharge; }
    }
  });
  taskSel.addEventListener('focus', () => { taskSel.dataset.prev = taskSel.value; });
  taskSel.addEventListener('blur', () => { validateTaskInput(taskSel); });

  function closeModal() {
    backdrop.remove();
    document.removeEventListener('keydown', handleEsc, true);
  }
  function handleEsc(e) { if (e.key === 'Escape') { e.stopPropagation(); closeModal(); } }
  document.addEventListener('keydown', handleEsc, true);
  backdrop.querySelector(".close").addEventListener("click", closeModal);
  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (!validateTaskInput(taskSel)) return;
    const data = sanitizeStrings(Object.fromEntries(new FormData(form).entries()));
    const inDate = parseDT(data.date, data.inTime);
    const outTime = data.outTime;
    const taskId = taskSel.dataset.id || "";
    try {
      if (record) {
        await updateImputation(
          record.id,
          inDate,
          outTime ? parseDT(data.date, outTime) : null,
          taskId,
          data.comments,
          noFeeChk.checked
        );
        selectedImputationId = record.id;
      } else {
        if (outTime) {
          await createManualImputation(inDate, parseDT(data.date, outTime), taskId, data.comments, noFeeChk.checked);
        } else {
          await createOpenImputation(inDate, taskId, data.comments, noFeeChk.checked);
        }
      }
      backdrop.remove();
      updateTimer();
    } catch (err) {
      console.error(err);
      alert(i18n.t('Error al guardar la imputación'));
    }
  });
  document.body.appendChild(clone);
}

async function updateImputation(id, inDate, outDate, taskId, comments, noFeeChecked) {
  const rec = imputations.find(r => r.id == id); if (!rec) return;
  const ri = round15(inDate);
  const task = tasks.find(t => t.id == taskId);
  const customer = task ? customers.find(c => c.no === task.customerNo) : null;
  const data = sanitizeStrings({
    inDate: ri.toISOString(),
    taskId: taskId || null,
    comments: comments || (task ? task.taskDescription : rec.comments),
    noFee: noFeeChecked,
    unitPriceHour: customer ? customer.priceHour : 0,
    vatPercentage: customer ? customer.vat : 0,
    irpfPercentage: customer ? customer.irpf : 0,
    minimumMonthlyHours: customer ? customer.minimumMonthlyHours : 0,
    minimumDailyHours: customer ? customer.minimumDailyHours : 0
  });
  if (outDate) {
    const ro = round15(outDate); if (ro <= ri) { alert("La salida debe ser posterior."); return; }
    Object.assign(data, {
      outDate: ro.toISOString(),
      totalMs: ro - ri,
      totalDecimal: round2((ro - ri) / 3600000),
      date: formatInputDate(new Date(ro.getFullYear(), ro.getMonth(), ro.getDate())),
      isHoliday: isWeekend(ro) || isCalendarHoliday(ro),
      isVacation: isCalendarVacation(ro)
    });
  } else {
    Object.assign(data, {
      outDate: null, totalMs: 0, totalDecimal: 0,
      date: formatInputDate(new Date(ri.getFullYear(), ri.getMonth(), ri.getDate())),
      isHoliday: isWeekend(ri) || isCalendarHoliday(ri),
      isVacation: isCalendarVacation(ri)
    });
  }
  await applyAiCorrection('imputations', data, rec);
  selectedImputationId = id;
  await db.update('imputations', { id }, data).then(() => loadFromDb()).catch(console.error);
}

async function createManualImputation(inDate, outDate, taskId, comments, noFeeChecked) {
  const ri = round15(inDate), ro = round15(outDate);
  if (ro <= ri) { alert("La salida debe ser posterior."); return; }
  const task = tasks.find(t => t.id == taskId);
  const customer = task ? customers.find(c => c.no === task.customerNo) : null;
  const rec = sanitizeStrings({
    id: imputationSeq++,
    date: new Date(ro.getFullYear(), ro.getMonth(), ro.getDate()),
    inDate: ri,
    outDate: ro,
    totalMs: ro - ri,
    totalDecimal: round2((ro - ri) / 3600000),
    taskId: taskId || "",
    comments: comments || (task ? task.taskDescription : ""),
    noFee: noFeeChecked,
    isHoliday: isWeekend(ro) || isCalendarHoliday(ro),
    isVacation: isCalendarVacation(ro),
    unitPriceHour: customer ? customer.priceHour : 0,
    vatPercentage: customer ? customer.vat : 0,
    irpfPercentage: customer ? customer.irpf : 0,
    minimumMonthlyHours: customer ? customer.minimumMonthlyHours : 0,
    minimumDailyHours: customer ? customer.minimumDailyHours : 0
  });
  await applyAiCorrection('imputations', rec, {});
  selectedImputationId = rec.id;
  await db.insert('imputations', {
    ...sanitizeStrings({
      ...rec,
      taskId: rec.taskId || null,
      date: formatInputDate(rec.date),
      inDate: rec.inDate.toISOString(),
      outDate: rec.outDate.toISOString()
    })
  }).then(() => loadFromDb()).catch(console.error);
}

function recalcCalendarFlags() {
  imputations.forEach(rec => {
    rec.isHoliday = isWeekend(rec.date) || isCalendarHoliday(rec.date);
    rec.isVacation = isCalendarVacation(rec.date);
  });
  renderImputations();
}

/*************** API para otros módulos ****************/
function loadTasksInSelects() {
  const incomplete = tasks.filter(t => !t.completed);
  const options = incomplete.map(t => `<option data-id="${t.id}" value="${t.clientTaskNo || t.subject}"></option>`).join('');
  document.getElementById('taskOptions').innerHTML = options;
}

/*************** INIT ****************/
async function init() {
  await dbReady;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  await loadFromDb(start, end);
  updateTimer();
}
init();




