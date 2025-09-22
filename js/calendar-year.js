let yearBackdrop = null;
function openCalendarYear(year) {
  if (yearBackdrop) { yearBackdrop.remove(); yearBackdrop = null; }
  fetch('html/calendar-year.html')
    .then(r => r.text())
    .then(html => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const page = doc.getElementById('calendarYearPage');
      if (window.i18n) i18n.apply(page);
      const title = page.querySelector('.modal-title');
      if (title) title.textContent = `${i18n.t('Calendario anual')} ${year}`;
      yearBackdrop = document.createElement('div');
      yearBackdrop.className = 'modal-backdrop';
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.style.maxWidth = '95vw';
      modal.appendChild(page);
      yearBackdrop.appendChild(modal);
      document.body.appendChild(yearBackdrop);
      const grid = yearBackdrop.querySelector('#calendarYearGrid');
      const closeBtn = yearBackdrop.querySelector('.close');
      function closePopup() { yearBackdrop.remove(); yearBackdrop = null; document.removeEventListener('keydown', handleEsc); }
      function handleEsc(e) { if (e.key === 'Escape') closePopup(); }
      document.addEventListener('keydown', handleEsc);
      closeBtn.addEventListener('click', closePopup);
      yearBackdrop.addEventListener('click', e => { if (e.target === yearBackdrop) closePopup(); });
      function dayClass(dateStr) {
        const rec = calendarDays.find(c => c.date === dateStr);
        if (rec) {
          if (rec.type === 'festivo') return 'holiday';
          if (rec.type === 'vacaciones') return 'vacation';
        }
        const d = new Date(dateStr);
        if (!weekConfig[d.getDay()]) return 'nolaboral';
        return '';
      }
      async function openDayModal(rec, dateStr) {
        const html = await fetch('html/calendar.html').then(r => r.text());
        const doc2 = new DOMParser().parseFromString(html, 'text/html');
        const tmpl = doc2.getElementById('calModalTmpl');
        const clone = tmpl.content.cloneNode(true);
        if (window.i18n) i18n.apply(clone);
        const bd = clone.querySelector('.modal-backdrop');
        const form = clone.querySelector('#calForm');
        const delBtn = clone.querySelector('#btnCalDelete');
        if (rec) {
          form.elements.date.value = rec.date;
          form.elements.type.value = rec.type;
          form.elements.desc.value = rec.desc || '';
          clone.querySelector('.modal-title').textContent = i18n.t('Editar día');
          delBtn.addEventListener('click', async () => {
            if (confirm(i18n.t('¿Eliminar día?'))) {
              try {
                await db.delete('calendar_days', { date: rec.date });
                await loadFromDb();
                recalcCalendarFlags();
                closeModal();
                render();
              } catch (err) { console.error(err); alert(i18n.t('Error al eliminar el día')); }
            }
          });
        } else {
          form.elements.date.value = dateStr;
          delBtn.style.display = 'none';
        }
        function closeModal() { bd.remove(); document.removeEventListener('keydown', handleEscM, true); }
        function handleEscM(e) { if (e.key === 'Escape') { e.stopPropagation(); closeModal(); } }
        document.addEventListener('keydown', handleEscM, true);
        bd.querySelector('.close').addEventListener('click', closeModal);
        form.addEventListener('submit', async e => {
          e.preventDefault();
          const data = sanitizeStrings(Object.fromEntries(new FormData(form).entries()));
          try {
            if (rec) {
              await db.update('calendar_days', { date: rec.date }, { date: data.date, type: data.type, description: data.desc });
            } else {
              await db.insert('calendar_days', { date: data.date, type: data.type, description: data.desc });
            }
            await loadFromDb();
            recalcCalendarFlags();
            closeModal();
            render();
          } catch (err) { console.error(err); alert(i18n.t('Error al guardar el día')); }
        });
        yearBackdrop.appendChild(bd);
      }
      function render() {
        grid.innerHTML = '';
        for (let m = 0; m < 12; m++) {
          const table = document.createElement('table');
        const monthName = new Date(year, m, 1).toLocaleString(i18n.lang, { month: 'long' });
        const weekLetters = i18n.lang === 'ca' ? ['Dl','Dt','Dc','Dj','Dv','Ds','Dg'] : ['L','M','X','J','V','S','D'];
        table.innerHTML = `<thead><tr><th colspan="7">${monthName}</th></tr><tr>${weekLetters.map(l => `<th>${l}</th>`).join('')}</tr></thead>`;
          const tbody = document.createElement('tbody');
          const first = new Date(year, m, 1);
          let start = (first.getDay() + 6) % 7;
          const days = new Date(year, m + 1, 0).getDate();
          let tr = document.createElement('tr');
          for (let i = 0; i < start; i++) tr.appendChild(document.createElement('td'));
          for (let d = 1; d <= days; d++) {
            if ((start + d - 1) % 7 === 0 && d > 1) { tbody.appendChild(tr); tr = document.createElement('tr'); }
            const td = document.createElement('td');
            td.textContent = d;
            const dateStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const cls = dayClass(dateStr);
            if (cls) td.classList.add(cls);
            td.addEventListener('click', () => { const rec = calendarDays.find(c => c.date === dateStr); openDayModal(rec, dateStr); });
            tr.appendChild(td);
          }
          while (tr.children.length < 7) tr.appendChild(document.createElement('td'));
          tbody.appendChild(tr);
          table.appendChild(tbody);
          grid.appendChild(table);
        }
      }
      render();
    });
}
