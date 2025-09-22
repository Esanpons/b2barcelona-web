/*************** Tareas (popup externo) ****************/
let currentTasksBackdrop = null;

document.getElementById("btnTasks").addEventListener("click", openTasksPopup);

function openTasksPopup() {
  if (currentTasksBackdrop) { currentTasksBackdrop.remove(); currentTasksBackdrop = null; }

  fetch("html/tasks.html")
    .then(r => r.text())
    .then(html => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const tasksPage = doc.getElementById('tasksPage');
      if (window.i18n) i18n.apply(tasksPage);
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop tasks-popup';
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.appendChild(tasksPage);
      backdrop.appendChild(modal);
      document.body.appendChild(backdrop);
      currentTasksBackdrop = backdrop;

      const tasksTableBody = backdrop.querySelector("#tasksTable tbody");
      const btnAdd = backdrop.querySelector("#BtnAddTask");
      const btnEdit = backdrop.querySelector("#BtnEditTask");
      const btnDup = backdrop.querySelector("#BtnDupTask");
      const btnDel = backdrop.querySelector("#BtnDelTask");
      const btnCompleteSelected = backdrop.querySelector("#BtnCompleteSelected");
      const btnUncompleteSelected = backdrop.querySelector("#BtnUncompleteSelected");
      const statusFilter = backdrop.querySelector("#taskStatusFilter");
      const searchInput = backdrop.querySelector("#taskSearchFilter");
      const closeBtn = backdrop.querySelector(".close");

      function closePopup() {
        backdrop.remove();
        currentTasksBackdrop = null;
        window.refreshTasksPopup = null;
        document.removeEventListener('keydown', handleEsc);
      }

      function handleEsc(e) { if (e.key === 'Escape') closePopup(); }
      document.addEventListener('keydown', handleEsc);

      let selectedTaskId = tasks.length ? tasks.slice().sort((a, b) => b.id - a.id)[0].id : null;
      let bulkSelection = new Set();

      function updateButtons() {
        const hasSel = !!selectedTaskId;
        btnEdit.disabled = !hasSel;
        btnDup.disabled = !hasSel;
        btnDel.disabled = !hasSel;
        const hasBulk = bulkSelection.size > 0;
        btnCompleteSelected.disabled = !hasBulk;
        btnUncompleteSelected.disabled = !hasBulk;
      }

      async function bulkSetCompletion(flag) {
        if (!bulkSelection.size) return;
        const ids = Array.from(bulkSelection);
        try {
          for (const id of ids) {
            await db.update('tasks', { id }, { completed: flag });
          }
          await loadFromDb();
          bulkSelection.clear();
          renderTasks();
          renderImputations();
        } catch (err) {
          console.error(err);
          alert('Error al actualizar las tareas seleccionadas');
        }
      }


      function renderTasks() {
        tasksTableBody.innerHTML = "";
        const existing = new Set(tasks.map(t => t.id));
        bulkSelection = new Set(Array.from(bulkSelection).filter(id => existing.has(id)));
        let list = tasks.slice().sort((a, b) => b.id - a.id);
        if ((selectedTaskId === null || !existing.has(selectedTaskId)) && list.length) selectedTaskId = list[0].id;
        const st = statusFilter.value;
        if (st === 'completed') list = list.filter(t => t.completed);
        else if (st === 'incomplete') list = list.filter(t => !t.completed);
        const txt = searchInput.value.toLowerCase();
        if (txt) {
          list = list.filter(t => {
            return Object.values(t).some(v => v && String(v).toLowerCase().includes(txt));
          });
        }
        const visibleIds = new Set(list.map(t => t.id));
        bulkSelection = new Set(Array.from(bulkSelection).filter(id => visibleIds.has(id)));
        if (selectedTaskId !== null && !visibleIds.has(selectedTaskId)) {
          selectedTaskId = list.length ? list[0].id : null;
        }
        if (!list.length) selectedTaskId = null;
        list.forEach(t => {
          const tr = document.createElement('tr');
          tr.dataset.id = t.id;
          const selectCell = document.createElement('td');
          selectCell.className = 'select-cell';
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.checked = bulkSelection.has(t.id);
          checkbox.addEventListener('click', e => e.stopPropagation());
          checkbox.addEventListener('change', () => {
            if (checkbox.checked) bulkSelection.add(t.id); else bulkSelection.delete(t.id);
            tr.classList.toggle('bulk-selected', checkbox.checked);
            updateButtons();
          });
          selectCell.appendChild(checkbox);
          tr.appendChild(selectCell);
          const subject = t.subject || '';
          const shortSub = subject.length > 20 ? subject.slice(0, 20) + '…' : subject;
          tr.insertAdjacentHTML('beforeend', `<td>${t.id}</td><td>${t.clientTaskNo || ''}</td><td>${shortSub}</td>` +
            `<td>${t.sprint || ''}</td>` +
            `<td>${t.customerNo || ''}</td>` +
            `<td>${t.noCharge ? i18n.t('Sí') : i18n.t('No')}</td>` +
            `<td>${t.completed ? i18n.t('Sí') : i18n.t('No')}</td>`);
          if (t.id === selectedTaskId) tr.classList.add('selected');
          if (bulkSelection.has(t.id)) tr.classList.add('bulk-selected');
          tr.addEventListener('click', () => { selectedTaskId = t.id; renderTasks(); });
          tr.addEventListener('dblclick', () => { openTaskModal(t, id => { selectedTaskId = id; renderTasks(); }); });
          tasksTableBody.appendChild(tr);
        });
        updateButtons();
        loadTasksInSelects();
      }

      statusFilter.addEventListener('change', renderTasks);
      searchInput.addEventListener('input', renderTasks);
      btnAdd.addEventListener("click", () => openTaskModal(null, id => { selectedTaskId = id; renderTasks(); }));
      btnEdit.addEventListener("click", () => {
        const task = tasks.find(t => t.id === selectedTaskId);
        if (task) openTaskModal(task, id => { selectedTaskId = id; renderTasks(); });
      });
      btnDup.addEventListener("click", () => {
        if (!selectedTaskId) return;
        const copy = duplicateTask(selectedTaskId);
        if (copy) openTaskModal(null, id => { selectedTaskId = id; renderTasks(); }, { initialData: copy, mode: 'duplicate' });
      });
      btnCompleteSelected.addEventListener('click', () => { bulkSetCompletion(true); });
      btnUncompleteSelected.addEventListener('click', () => { bulkSetCompletion(false); });
      btnDel.addEventListener("click", () => {
        if (!selectedTaskId) return;
        if (confirm(i18n.t("¿Eliminar tarea?"))) {
          (async () => {
            try {
              await db.delete('tasks', { id: selectedTaskId });
              await loadFromDb();
              selectedTaskId = null;
              renderTasks();
              loadTasksInSelects();
              renderImputations();
            } catch (err) {
              console.error(err);
              alert(i18n.t('Error al eliminar la tarea'));
            }
          })();
        }
      });

      closeBtn.addEventListener("click", closePopup);
      renderTasks();

      window.refreshTasksPopup = renderTasks;
    });
}

function duplicateTask(id) {
  const original = tasks.find(t => t.id === id);
  if (!original) return null;
  const copy = sanitizeStrings({
    ...original,
    id: taskSeq,
    subject: '',
    taskDescription: '',
    clientTaskDesc: '',
    completed: false
  });
  return copy;
}

function openTaskModal(task = null, onSave, options = {}) {
  const tmpl = (currentTasksBackdrop || document).querySelector("#taskModalTmpl");
  const clone = tmpl.content.cloneNode(true);
  const backdrop = clone.querySelector(".modal-backdrop");
  const form = clone.querySelector("#taskForm");
  const customerSel = form.elements["customerNo"];
  customerSel.innerHTML = '<option value=""></option>' + customers.map(c => `<option value="${c.no}">${c.no} - ${c.name}</option>`).join('');
  form.reset();
  const { initialData = null, mode = null } = options;
  const applyValues = data => {
    Object.entries(data || {}).forEach(([k, v]) => {
      const input = form.elements[k];
      if (!input) return;
      if (input.type === 'checkbox') input.checked = !!v;
      else input.value = v != null ? v : '';
    });
  };
  if (task) {
    applyValues(task);
    backdrop.querySelector(".modal-title").textContent = "Editar tarea";
  } else {
    const init = initialData ? { ...initialData } : {};
    if (init.id == null) init.id = taskSeq;
    applyValues(init);
  }
  if (mode === 'duplicate') {
    const banner = document.createElement('div');
    banner.className = 'task-duplicate-banner';
    banner.textContent = 'Estás duplicando esta tarea. Introduce los nuevos datos.';
    form.insertBefore(banner, form.firstElementChild);
  }

  if (task && task.completed) {
    form.classList.add('task-readonly');
    let warned = false;
    const warn = () => {
      if (!warned) {
        warned = true;
        alert('Esta tarea está completada y no se puede modificar.');
      }
    };
    const block = e => {
      if (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
      warn();
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
    };
    Array.from(form.elements).forEach(el => {
      if (el.name === 'id' || el.name === 'completed') return;
      if (el.tagName === 'BUTTON') {
        if (el.type === 'submit') return;
        el.addEventListener('click', block, true);
      } else {
        ['focus', 'click', 'keydown', 'input', 'change'].forEach(evt => el.addEventListener(evt, block, true));
      }
    });
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
    data.noCharge = form.elements["noCharge"].checked;
    data.completed = form.elements["completed"].checked;
    data.id = Number(form.elements["id"].value);
    await applyAiCorrection('tasks', data, task || {});
    let savedId;
    try {
      if (task) {
        await db.update('tasks', { id: task.id }, data);
        savedId = task.id;
      } else {
        await db.insert('tasks', data);
        savedId = data.id;
      }
      await loadFromDb();
      backdrop.remove();
      if (onSave) onSave(savedId);
      loadTasksInSelects();
      renderImputations();
      if (window.refreshTasksPopup) window.refreshTasksPopup();
    } catch (err) {
      console.error(err);
      alert('Error al guardar la tarea');
    }
  });
  (currentTasksBackdrop || document.body).appendChild(clone);
}
