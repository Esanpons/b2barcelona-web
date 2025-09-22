// Popup Calendario
document
  .getElementById("btnCalendar")
  .addEventListener("click", openCalendarPopup);
let calBackdrop = null;

function openCalendarPopup() {
  if (calBackdrop) {
    calBackdrop.remove();
    calBackdrop = null;
  }
  fetch("html/calendar.html")
    .then((r) => r.text())
    .then((html) => {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const page = doc.getElementById("calendarPage");
      if (window.i18n) i18n.apply(page);
      calBackdrop = document.createElement("div");
      calBackdrop.className = "modal-backdrop";
      const modal = document.createElement("div");
      modal.className = "modal";
      modal.appendChild(page);
      calBackdrop.appendChild(modal);
      document.body.appendChild(calBackdrop);

      const tblBody = calBackdrop.querySelector("#calendarTable tbody");
      const btnAdd = calBackdrop.querySelector("#BtnAddCal");
      const btnEdit = calBackdrop.querySelector("#BtnEditCal");
      const btnDel = calBackdrop.querySelector("#BtnDelCal");
      const btnYear = calBackdrop.querySelector("#BtnYearView");
      const weekDiv = calBackdrop.querySelector("#weekCfg");
      const yearSel = calBackdrop.querySelector("#calYearFilter");
      const typeSel = calBackdrop.querySelector("#calTypeFilter");
      const summaryDiv = calBackdrop.querySelector("#calendarSummary");
      const close = calBackdrop.querySelector(".close");

      function closePopup() {
        calBackdrop.remove();
        calBackdrop = null;
        document.removeEventListener("keydown", handleEsc);
      }

      function handleEsc(e) {
        if (e.key === "Escape") closePopup();
      }
      document.addEventListener("keydown", handleEsc);

      let selectedDate = calendarDays.length ? calendarDays[0].date : null;

      function renderWeekCfg() {
        weekDiv.innerHTML = "";
        const order = [1, 2, 3, 4, 5, 6, 0];
        const days = i18n.lang === 'ca' ? ["DG", "DL", "DT", "DC", "DJ", "DV", "DS"] : ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
        order.forEach((idx) => {
          const d = days[idx];
          const lbl = document.createElement("label");
          lbl.innerHTML = `<input type="checkbox" ${weekConfig[idx] ? "checked" : ""
            }> ${d}`;
          lbl.querySelector("input").addEventListener("change", (e) => {
            weekConfig[idx] = e.target.checked;
            recalcCalendarFlags();
            (async () => {
              await db.delete("week_config", { weekday: idx });
              await db.insert("week_config", {
                weekday: idx,
                working: weekConfig[idx],
              });
              loadFromDb();
            })().catch(console.error);
          });
          weekDiv.appendChild(lbl);
        });
      }

      function renderYearOptions() {
        const years = Array.from(
          new Set(calendarDays.map((d) => d.date.substring(0, 4)))
        );
        const current = new Date().getFullYear().toString();
        if (!years.includes(current)) years.push(current);
        years.sort((a, b) => b - a);
        yearSel.innerHTML = years
          .map((y) => `<option value="${y}">${y}</option>`)
          .join("");
        yearSel.value = current;
      }

      function renderDays() {
        tblBody.innerHTML = "";
        const year = yearSel.value;
        const type = typeSel.value;
        const list = calendarDays
          .filter((d) => d.date.startsWith(year))
          .filter((d) => type === "all" || d.type === type)
          .sort((a, b) => a.date.localeCompare(b.date))
        if (selectedDate === null && list.length) selectedDate = list[0].date;
        list.forEach((rec) => {
          const tr = document.createElement("tr");
          tr.dataset.date = rec.date;
          tr.innerHTML = `<td>${rec.date}</td><td>${rec.type}</td><td>${rec.desc || ""
            }</td>`;
          if (rec.date === selectedDate) tr.classList.add("selected");
          tr.addEventListener("click", () => {
            selectedDate = rec.date;
            renderDays();
          });
          tr.addEventListener("dblclick", () => {
            openCalModal(rec);
          });
          tblBody.appendChild(tr);
        });
        btnEdit.disabled = !selectedDate;
        btnDel.disabled = !selectedDate;
        updateSummary();
      }

      function updateSummary() {
        if (!summaryDiv) return;
        const year = parseInt(yearSel.value, 10);
        let fest = 0, vac = 0, nonWorkingWeek = 0, days = 0;
        for (let d = new Date(year, 0, 1); d.getFullYear() == year; d.setDate(d.getDate() + 1)) {
          days++;
          if (!weekConfig[d.getDay()]) nonWorkingWeek++;
          const dateStr = d.toISOString().substring(0, 10);
          const rec = calendarDays.find(c => c.date === dateStr);
          if (rec) {
            if (rec.type === 'vacaciones') vac++;
            else if (rec.type === 'festivo') fest++;
          }
        }
        const labor = days - nonWorkingWeek - fest - (company.totalVacationDays || 0);
        const remain = (company.totalVacationDays || 0) - vac;
        summaryDiv.innerHTML = `
            <div><span>Vacaciones</span><strong>${vac}</strong></div>
            <div><span>Festivos</span><strong>${fest}</strong></div>
            <div><span>Laborables</span><strong>${labor}</strong></div>
            <div><span>Vacaciones restantes</span><strong>${remain}</strong></div>`;
      }

      function openCalModal(rec = null) {
        const tmpl = calBackdrop
          .querySelector("#calModalTmpl")
          .content.cloneNode(true);
        const bd = tmpl.querySelector(".modal-backdrop");
        const form = tmpl.querySelector("#calForm");
        const delBtn = tmpl.querySelector("#btnCalDelete");
        if (rec) {
          form.elements.date.value = rec.date;
          form.elements.type.value = rec.type;
          form.elements.desc.value = rec.desc || "";
          tmpl.querySelector(".modal-title").textContent = i18n.t("Editar día");
          delBtn.addEventListener('click', async () => {
            if (confirm(i18n.t("¿Eliminar día?"))) {
              try {
                await db.delete('calendar_days', { date: rec.date });
                await loadFromDb();
                closeModal();
                selectedDate = null;
                renderDays();
                recalcCalendarFlags();
                updateSummary();
              } catch (err) { console.error(err); alert(i18n.t('Error al eliminar el día')); }
            }
          });
        }
        else {
          delBtn.style.display = 'none';
        }
        function closeModal() {
          bd.remove();
          document.removeEventListener("keydown", handleEscModal, true);
        }
        function handleEscModal(e) {
          if (e.key === "Escape") {
            e.stopPropagation();
            closeModal();
          }
        }
        document.addEventListener("keydown", handleEscModal, true);
        bd.querySelector(".close").addEventListener("click", closeModal);
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          const data = sanitizeStrings(
            Object.fromEntries(new FormData(form).entries())
          );
          try {
            if (rec) {
              await db.update(
                "calendar_days",
                { date: rec.date },
                { date: data.date, type: data.type, description: data.desc }
              );
            } else {
              await db.insert("calendar_days", {
                date: data.date,
                type: data.type,
                description: data.desc,
              });
            }
            await loadFromDb();
            bd.remove();
            selectedDate = data.date;
            renderDays();
            recalcCalendarFlags();
            updateSummary();
          } catch (err) {
            console.error(err);
            alert(i18n.t("Error al guardar el día"));
          }
        });
        (calBackdrop || document.body).appendChild(bd);
      }

      btnAdd.addEventListener("click", () => openCalModal());
      btnEdit.addEventListener("click", () =>
        openCalModal(calendarDays.find((d) => d.date === selectedDate))
      );
      btnDel.addEventListener("click", async () => {
        if (!selectedDate) return;
        if (confirm(i18n.t("¿Eliminar día?"))) {
          try {
            await db.delete("calendar_days", { date: selectedDate });
            await loadFromDb();
            selectedDate = null;
            renderDays();
            recalcCalendarFlags();
            updateSummary();
          } catch (err) {
            console.error(err);
            alert(i18n.t("Error al eliminar el día"));
          }
        }
      });
      yearSel.addEventListener("change", () => { renderDays(); });
      yearSel.addEventListener("change", updateSummary);
      typeSel.addEventListener("change", () => { renderDays(); });
      typeSel.addEventListener("change", updateSummary);
      if (btnYear) btnYear.addEventListener("click", () => openCalendarYear(yearSel.value));
      close.addEventListener("click", closePopup);

      renderWeekCfg();
      renderYearOptions();
      renderDays();
      updateSummary();
    });
}
