/* ===========================
   Stunden-App – script.js FINAL
   - Daten & Urlaub bleiben wie in deiner funktionierenden Version
   - Kein "Auf GitHub wird angezeigt..." mehr (kein alert/confirm)
   =========================== */

const DISPO_EMAIL = "b.rumi@mader-transporte.de"; // Zieladresse

// ===================== Mini-UI: Toast + Confirm =====================
let toastTimer = null;

function showToast(msg, ms = 2600) {
  const el = document.getElementById("appToast");
  if (!el) {
    // Fallback: wenn Toast nicht existiert, dann wenigstens nichts kaputt machen
    console.log("TOAST:", msg);
    return;
  }
  el.textContent = msg;
  el.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), ms);
}

function appConfirm(text, onYes, onNo) {
  const overlay = document.getElementById("appConfirm");
  const txt = document.getElementById("confirmText");
  const btnYes = document.getElementById("confirmYes");
  const btnNo = document.getElementById("confirmNo");

  // Fallback: wenn Confirm-Dialog nicht existiert -> dann "Nein" (sicherer)
  if (!overlay || !txt || !btnYes || !btnNo) {
    showToast(text);
    if (typeof onNo === "function") onNo();
    return;
  }

  txt.textContent = text;
  overlay.classList.remove("hidden");

  const cleanup = () => {
    overlay.classList.add("hidden");
    btnYes.onclick = null;
    btnNo.onclick = null;
  };

  btnYes.onclick = () => {
    cleanup();
    if (typeof onYes === "function") onYes();
  };

  btnNo.onclick = () => {
    cleanup();
    if (typeof onNo === "function") onNo();
  };
}

// ===================== Helpers =====================
function jahr4stellig(jahrInput) {
  const s = String(jahrInput || "").trim();
  if (s.length === 2 && /^\d{2}$/.test(s)) return "20" + s; // 25 -> 2025
  return s;
}

function monatLangName(monatKurz) {
  const map = {
    Jan: "Januar", Feb: "Februar", Mär: "März", Apr: "April", Mai: "Mai", Jun: "Juni",
    Juli: "Jul", Aug: "August", Sep: "September", Okt: "Oktober", Nov: "November", Dez: "Dezember"
  };
  return map[monatKurz] || monatKurz;
}

function monatJahrLang(monatKurz, jahrInput) {
  return `${monatLangName(monatKurz)} ${jahr4stellig(jahrInput)}`;
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function parsePauseToMinutes(pauseStr) {
  if (!pauseStr) return 0;
  const s = String(pauseStr).replace(",", ".").trim();
  const val = parseFloat(s);
  if (Number.isNaN(val) || val < 0) return 0;
  return val * 60;
}

function overlapMinutes(aStart, aEnd, bStart, bEnd) {
  const start = Math.max(aStart, bStart);
  const end = Math.min(aEnd, bEnd);
  return Math.max(0, end - start);
}

function formatNumberDE(value) {
  const num = typeof value === "number" ? value : parseFloat(String(value).replace(",", "."));
  if (Number.isNaN(num)) return "0,00";
  return num.toFixed(2).replace(".", ",");
}

function weekdayShortFromISO(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  const w = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  return w[dateObj.getDay()] || "";
}

function toGermanDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function parseGermanDateToDate(ddmmyyyy) {
  const parts = String(ddmmyyyy).split(".");
  if (parts.length !== 3) return null;
  const [dd, mm, yy] = parts.map(Number);
  if ([dd, mm, yy].some(Number.isNaN)) return null;
  return new Date(yy, mm - 1, dd);
}

function isStatusDay(ortAbfahrt) {
  const s = (ortAbfahrt || "").trim().toLowerCase();
  return ["urlaub", "krank", "abbummeln", "feiertag"].includes(s);
}

// ===================== Navigation (Pages) =====================
function showPage(pageId, clickedBtn) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("page-active"));
  const el = document.getElementById(pageId);
  if (el) el.classList.add("page-active");

  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
  if (clickedBtn) clickedBtn.classList.add("active");
}

// ===================== Mitarbeiter-ID =====================
function computeEmployeeId(vorname, nachname) {
  const v = (vorname || "").trim();
  const n = (nachname || "").trim();
  if (!v || !n) return "";
  return (v[0].toUpperCase() + n)
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9ÄÖÜäöüß_-]/g, "");
}

function updateMitarbeiterIdAnzeige() {
  const vEl = document.getElementById("vorname");
  const nEl = document.getElementById("nachname");
  const idEl = document.getElementById("mitarbeiterIdAnzeige");
  if (!vEl || !nEl || !idEl) return "";
  const id = computeEmployeeId(vEl.value, nEl.value);
  idEl.value = id;
  return id;
}

// ===================== Safe Year =====================
function getYearSafe() {
  const jahrEl = document.getElementById("jahr");
  const v = (jahrEl?.value || "").trim();
  if (v) return v;
  return String(new Date().getFullYear());
}

// ===================== Urlaub (2 Felder) =====================
function getEmployeeKeyPart() {
  const v = localStorage.getItem("stundenapp_vorname") || "";
  const n = localStorage.getItem("stundenapp_nachname") || "";
  return computeEmployeeId(v, n) || "OhneName";
}

function urlaubTotalKey() {
  const jahr = getYearSafe();
  const emp = getEmployeeKeyPart();
  return `stundenapp_urlaub_total_${emp}_${jahr}`;
}

function urlaubDatesKey() {
  const jahr = getYearSafe();
  const emp = getEmployeeKeyPart();
  return `stundenapp_urlaub_dates_${emp}_${jahr}`;
}

function loadUrlaubTotal() {
  const raw = localStorage.getItem(urlaubTotalKey());
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function saveUrlaubTotal(val) {
  const n = Math.max(0, parseInt(val || "0", 10) || 0);
  localStorage.setItem(urlaubTotalKey(), String(n));
  return n;
}

function loadUrlaubDates() {
  const raw = localStorage.getItem(urlaubDatesKey());
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveUrlaubDates(arr) {
  localStorage.setItem(urlaubDatesKey(), JSON.stringify(arr));
}

function isUrlaubEntry(entry) {
  return (entry?.ortAbfahrt || "").trim().toLowerCase() === "urlaub";
}

function recalcUrlaubRestAnzeige() {
  const totalEl = document.getElementById("urlaubTotal");
  const restEl = document.getElementById("urlaubRest");
  if (!totalEl || !restEl) return;

  const fieldVal = parseInt(String(totalEl.value || "").trim(), 10);
  const fieldHasNumber = Number.isFinite(fieldVal) && fieldVal >= 0;

  const stored = loadUrlaubTotal();
  let total;

  if (stored === null) {
    if (fieldHasNumber) total = saveUrlaubTotal(fieldVal);
    else {
      total = 0;
      saveUrlaubTotal(total);
      totalEl.value = "0";
    }
  } else {
    total = stored;
    if (!fieldHasNumber) totalEl.value = String(total);
  }

  const dates = loadUrlaubDates();
  const rest = Math.max(0, total - dates.length);
  restEl.value = String(rest);
}

// ===================== Monatsdaten (pro Mitarbeiter+Monat+Jahr) =====================
function monthKey() {
  const monat = (document.getElementById("monat")?.value || "").trim();
  const jahr = (document.getElementById("jahr")?.value || "").trim() || getYearSafe();
  const emp = getEmployeeKeyPart();
  return `stundenapp_eintraege_${emp}_${jahr}_${monat}`;
}

const eintraege = [];

function saveMonth() {
  try {
    localStorage.setItem(monthKey(), JSON.stringify(eintraege));
  } catch (e) {
    console.error("Speichern fehlgeschlagen:", e);
    showToast("Speichern fehlgeschlagen.");
  }
}

function loadMonth() {
  const key = monthKey();
  eintraege.length = 0;
  const raw = localStorage.getItem(key);
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) arr.forEach((x) => eintraege.push(x));
    } catch (e) {
      console.error("Laden fehlgeschlagen:", e);
      showToast("Monatsdaten konnten nicht geladen werden.");
    }
  }
  aktualisiereTabelleUndSummen();
}

// ===================== Wochentag =====================
function ermittleWochentagName(datumISO) {
  const tag = weekdayShortFromISO(datumISO);
  const feld = document.getElementById("wochentag");
  if (feld) feld.value = tag;
  return tag;
}

// ===================== Tagesberechnung =====================
function berechne() {
  const datumISO = document.getElementById("datum").value;
  const ortAbfahrt = document.getElementById("ortAbfahrt").value.trim();
  const ortAnkunft = document.getElementById("ortAnkunft").value.trim();
  const vonStr = document.getElementById("vonZeit").value;
  const bisStr = document.getElementById("bisZeit").value;
  const pauseStr = document.getElementById("pause").value;

  const stdFeld = document.getElementById("std");
  const weStdFeld = document.getElementById("weStd");
  const nachtStdFeld = document.getElementById("nachtStd");
  const spesenFeld = document.getElementById("spesen");

  ermittleWochentagName(datumISO);

  if (isStatusDay(ortAbfahrt)) {
    stdFeld.value = "0,00";
    weStdFeld.value = "0,00";
    nachtStdFeld.value = "0,00";
    spesenFeld.value = "0,00 €";
    showToast("Status-Tag – keine Berechnung.");
    return;
  }

  const vonMin = parseTimeToMinutes(vonStr);
  const bisMinRaw = parseTimeToMinutes(bisStr);

  if (vonMin === null || bisMinRaw === null) {
    showToast("Bitte gültige Zeiten für Von und Bis eingeben.");
    return;
  }

  let bisMin = bisMinRaw;
  if (bisMin <= vonMin) bisMin += 24 * 60;

  let gesamtMin = bisMin - vonMin;
  const pauseMin = parsePauseToMinutes(pauseStr);
  gesamtMin = Math.max(0, gesamtMin - pauseMin);

  const gesamtStd = gesamtMin / 60;
  stdFeld.value = formatNumberDE(gesamtStd);

  let weStd = 0;
  if (datumISO) {
    const [y, m, d] = datumISO.split("-").map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    if (dow === 0 || dow === 6) weStd = gesamtStd;
  }
  weStdFeld.value = formatNumberDE(weStd);

  // Nachtstunden 23–06 (mind. 2h)
  const arbeitStart = vonMin;
  const arbeitEnde = bisMin;

  let nachtMin = 0;
  nachtMin += overlapMinutes(arbeitStart, arbeitEnde, 23 * 60, 24 * 60);
  nachtMin += overlapMinutes(arbeitStart, arbeitEnde, 0, 6 * 60);
  nachtMin += overlapMinutes(arbeitStart, arbeitEnde, 24 * 60, 24 * 60 + 6 * 60);

  let nachtStd = nachtMin / 60;
  if (nachtStd < 2) nachtStd = 0;
  nachtStdFeld.value = formatNumberDE(nachtStd);

  // Spesenberechnung
let spesen = 0;

const istFirmaAbfahrt = ortAbfahrt.toLowerCase() === "firma";
const istFirmaAnkunft = ortAnkunft.toLowerCase() === "firma";

// 28 € immer, wenn weder Abfahrt noch Ankunft Firma ist
if (!istFirmaAbfahrt && !istFirmaAnkunft) {
  spesen = 28;
} else {
  // Firma ist bei Abfahrt oder Ankunft beteiligt
  if (gesamtStd < 8) {
    spesen = 0;
  } else {
    spesen = 14;
  }
}

spesenFeld.value = `${formatNumberDE(spesen)} €`;
}

// ===================== Form Reset =====================
function resetForm() {
  document.getElementById("ortAbfahrt").value = "";
  document.getElementById("ortAnkunft").value = "";
  document.getElementById("vonZeit").value = "";
  document.getElementById("bisZeit").value = "";
  document.getElementById("pause").value = "";
  document.getElementById("std").value = "";
  document.getElementById("weStd").value = "";
  document.getElementById("nachtStd").value = "";
  document.getElementById("spesen").value = "";
  showToast("Formular zurückgesetzt.");
}

// ===================== Einträge CRUD =====================
function eintragHinzufuegen() {
  const datumISO = document.getElementById("datum").value;
  const ortAbfahrt = document.getElementById("ortAbfahrt").value.trim();
  const ortAnkunft = document.getElementById("ortAnkunft").value.trim();
  const vonStr = document.getElementById("vonZeit").value;
  const bisStr = document.getElementById("bisZeit").value;
  const pauseStr = document.getElementById("pause").value;

  if (!datumISO) {
    showToast("Bitte ein Datum eingeben.");
    return;
  }

  const statusDay = isStatusDay(ortAbfahrt);
  if (!statusDay && (!vonStr || !bisStr)) {
    showToast("Bitte für Arbeitstage Von und Bis ausfüllen.");
    return;
  }

  berechne();

  const entry = {
    tag: weekdayShortFromISO(datumISO),
    datum: toGermanDate(datumISO),
    ortAbfahrt,
    ortAnkunft,
    von: statusDay ? "" : vonStr,
    bis: statusDay ? "" : bisStr,
    std: document.getElementById("std").value || "0,00",
    weStd: document.getElementById("weStd").value || "0,00",
    pause: statusDay ? "" : pauseStr,
    nachtStd: document.getElementById("nachtStd").value || "0,00",
    spesen: document.getElementById("spesen").value || "0,00 €",
  };

  // Urlaub-Jahresliste pflegen
  const dates = loadUrlaubDates();
  const entryDate = entry.datum;

  const idx = eintraege.findIndex((e) => e.datum === entry.datum);
  const warUrlaub = idx >= 0 ? isUrlaubEntry(eintraege[idx]) : false;
  const istUrlaub = isUrlaubEntry(entry);

  if (idx >= 0) eintraege[idx] = entry;
  else eintraege.push(entry);

  const exists = dates.includes(entryDate);
  if (!warUrlaub && istUrlaub && !exists) dates.push(entryDate);
  if (warUrlaub && !istUrlaub && exists) {
    saveUrlaubDates(dates.filter((d) => d !== entryDate));
  } else {
    saveUrlaubDates(dates);
  }

  eintraege.sort((a, b) => {
    const da = parseGermanDateToDate(a.datum);
    const db = parseGermanDateToDate(b.datum);
    return (da?.getTime() || 0) - (db?.getTime() || 0);
  });

  aktualisiereTabelleUndSummen();
  saveMonth();
  recalcUrlaubRestAnzeige();
  showToast("Eintrag gespeichert.");

  const btnMonat = document.querySelector('.nav-btn[data-target="page-monat"]');
  showPage("page-monat", btnMonat);
}

function eintragLoeschen(index) {
  if (index < 0 || index >= eintraege.length) return;

  appConfirm("Eintrag wirklich löschen?",
    () => {
      const removed = eintraege[index];
      eintraege.splice(index, 1);

      if (isUrlaubEntry(removed)) {
        const dates = loadUrlaubDates().filter((d) => d !== removed.datum);
        saveUrlaubDates(dates);
      }

      aktualisiereTabelleUndSummen();
      saveMonth();
      recalcUrlaubRestAnzeige();
      showToast("Eintrag gelöscht.");
    }
  );
}

function eintraegeLeeren() {
  appConfirm("Möchtest du wirklich alle Einträge dieses Monats löschen?",
    () => {
      const monthUrlaubDates = eintraege.filter(isUrlaubEntry).map((e) => e.datum);
      if (monthUrlaubDates.length) {
        const dates = loadUrlaubDates().filter((d) => !monthUrlaubDates.includes(d));
        saveUrlaubDates(dates);
      }

      eintraege.length = 0;
      aktualisiereTabelleUndSummen();
      saveMonth();
      recalcUrlaubRestAnzeige();
      showToast("Monat geleert.");
    }
  );
}

// ===================== Tabelle & Summen =====================
function aktualisiereTabelleUndSummen() {
  const tbody = document.querySelector("#monatsTabelle tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  let sumStd = 0, sumWe = 0, sumNacht = 0, sumSpesen = 0;

  eintraege.forEach((e, index) => {
    const tr = document.createElement("tr");

    sumStd += parseFloat((e.std || "0").replace(",", ".")) || 0;
    sumWe += parseFloat((e.weStd || "0").replace(",", ".")) || 0;
    sumNacht += parseFloat((e.nachtStd || "0").replace(",", ".")) || 0;

    const sp = String(e.spesen || "0").replace("€", "").replace(" ", "").replace(",", ".");
    sumSpesen += parseFloat(sp) || 0;

    tr.innerHTML = `
      <td>${e.tag || ""}</td>
      <td>${e.datum || ""}</td>
      <td>${e.ortAbfahrt || ""}</td>
      <td>${e.ortAnkunft || ""}</td>
      <td>${e.von || ""}</td>
      <td>${e.bis || ""}</td>
      <td>${e.std || ""}</td>
      <td>${e.weStd || ""}</td>
      <td>${e.pause || ""}</td>
      <td>${e.nachtStd || ""}</td>
      <td>${e.spesen || ""}</td>
      <td></td>
    `;
    const td = tr.lastElementChild;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-danger small";
    btn.textContent = "Löschen";
    btn.addEventListener("click", () => eintragLoeschen(index));
    td.appendChild(btn);

    tbody.appendChild(tr);
  });

  document.getElementById("sumStd").textContent = formatNumberDE(sumStd);
  document.getElementById("sumWeStd").textContent = formatNumberDE(sumWe);
  document.getElementById("sumNachtStd").textContent = formatNumberDE(sumNacht);
  document.getElementById("sumSpesen").textContent = formatNumberDE(sumSpesen);
}

// ===================== CSV Export =====================
function csvExport() {
  if (eintraege.length === 0) {
    showToast("Keine Einträge vorhanden.");
    return;
  }

  const vornameEl = document.getElementById("vorname");
  const nachnameEl = document.getElementById("nachname");
  const monatEl = document.getElementById("monat");
  const jahrEl = document.getElementById("jahr");

  const vorname = (vornameEl?.value || "").trim();
  const nachname = (nachnameEl?.value || "").trim();
  const monat = (monatEl?.value || "").trim();
  const jahr = (jahrEl?.value || "").trim();

  const empId = document.getElementById("mitarbeiterIdAnzeige")?.value || "";

  const fileName = `Stunden_${monat}_${jahr}_${empId}.csv`;

  let csv = "";
  csv += `Mader-Transporte;;;;Vorname;${vorname};${nachname}\r\n`;
  csv += "Heidekoppel 20\r\n";
  const monatJahrText = monatJahrLang(monat, jahr);
  csv += `24558 Henstedt-Ulzburg;;;;Monat/Jahr;="${monatJahrText}"\r\n`;
  csv += "\r\n\r\n\r\n\r\n";
  csv += "Tag;Datum;Ort Abfahrt;Ort Ankunft;Von;Bis;Std;WE-Std;Pause;Nacht;Spesen\r\n";

  const BOM = "\uFEFF";
  eintraege.forEach((e) => {
    const spesenClean = String(e.spesen || "").replace("€", "").trim();
    csv += [
      e.tag, e.datum, e.ortAbfahrt, e.ortAnkunft, e.von, e.bis,
      e.std, e.weStd, e.pause, e.nachtStd, spesenClean
    ].join(";") + "\r\n";
  });

  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`CSV gespeichert: ${fileName}`);

  appConfirm(
    "Die CSV jetzt per E-Mail senden?",
    () => {
      const subject = `Stundenliste ${monatJahrLang(monat, jahr)} (${empId})`;
      const body =
        `Hallo Birte,\n\nanbei die CSV-Datei:\n${fileName}\n\nLG\n${vorname} ${nachname}`;
      const mailto =
        `mailto:${DISPO_EMAIL}` +
        `?subject=${encodeURIComponent(subject)}` +
        `&body=${encodeURIComponent(body)}`;
      window.location.href = mailto;
    },
    () => showToast("OK – du kannst später senden.")
  );
}

// ===================== Init =====================
document.addEventListener("DOMContentLoaded", () => {
  // Navigation
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => showPage(btn.dataset.target, btn));
  });

  // Buttons
  document.getElementById("btnBerechne")?.addEventListener("click", berechne);
  document.getElementById("btnResetForm")?.addEventListener("click", resetForm);
  document.getElementById("btnAdd")?.addEventListener("click", eintragHinzufuegen);
  document.getElementById("btnClear")?.addEventListener("click", eintraegeLeeren);
  document.getElementById("btnCSV")?.addEventListener("click", csvExport);

  // Reset Stammdaten (Monatsdaten bleiben)
  document.getElementById("btnResetAll")?.addEventListener("click", () => {
    appConfirm(
      "Möchtest du die Stammdaten wirklich zurücksetzen?\n\nVorname, Nachname und Urlaubstage werden gelöscht.\nMonatsdaten bleiben erhalten.",
      () => {
        localStorage.removeItem("stundenapp_vorname");
        localStorage.removeItem("stundenapp_nachname");
        // Urlaub-Keys sind pro Mitarbeiter+Jahr -> lassen wir stehen? NEIN: wenn Name gelöscht wird, sind sie "unauffindbar".
        // Deshalb löschen wir nur die Eingabefelder – Urlaubskeys bleiben technisch im Storage, schaden aber nicht.
        document.getElementById("vorname").value = "";
        document.getElementById("nachname").value = "";
        document.getElementById("urlaubTotal").value = "";
        document.getElementById("urlaubRest").value = "";
        updateMitarbeiterIdAnzeige();
        showToast("Stammdaten zurückgesetzt.");
      },
      () => {}
    );
  });

  // Stammdaten-Elemente
  const vornameEl = document.getElementById("vorname");
  const nachnameEl = document.getElementById("nachname");
  const monatEl = document.getElementById("monat");
  const jahrEl = document.getElementById("jahr");
  const datumEl = document.getElementById("datum");

  // Name laden
  if (vornameEl) vornameEl.value = localStorage.getItem("stundenapp_vorname") || "";
  if (nachnameEl) nachnameEl.value = localStorage.getItem("stundenapp_nachname") || "";

  // Monat/Jahr laden oder heute
  const now = new Date();
  const monateKurz = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];
  const savedMonat = localStorage.getItem("stundenapp_monat");
  const savedJahr = localStorage.getItem("stundenapp_jahr");

  if (monatEl) monatEl.value = savedMonat || monateKurz[now.getMonth()];
  if (jahrEl) jahrEl.value = savedJahr || String(now.getFullYear());

  updateMitarbeiterIdAnzeige();

  // Name speichern + ID + Daten neu laden (weil Key von Name abhängt)
  vornameEl?.addEventListener("input", () => {
    localStorage.setItem("stundenapp_vorname", vornameEl.value.trim());
    updateMitarbeiterIdAnzeige();
    loadMonth();
    recalcUrlaubRestAnzeige();
  });

  nachnameEl?.addEventListener("input", () => {
    localStorage.setItem("stundenapp_nachname", nachnameEl.value.trim());
    updateMitarbeiterIdAnzeige();
    loadMonth();
    recalcUrlaubRestAnzeige();
  });

  // Monat/Jahr speichern + neu laden
  monatEl?.addEventListener("change", () => {
    localStorage.setItem("stundenapp_monat", monatEl.value.trim());
    loadMonth();
  });

  jahrEl?.addEventListener("change", () => {
    localStorage.setItem("stundenapp_jahr", jahrEl.value.trim());
    loadMonth();
    recalcUrlaubRestAnzeige();
  });

  // Datum initial
  if (datumEl && !datumEl.value) {
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    datumEl.value = `${yyyy}-${mm}-${dd}`;
  }
  ermittleWochentagName(datumEl?.value);
  datumEl?.addEventListener("change", () => ermittleWochentagName(datumEl.value));

  // Urlaub init + speichern
  recalcUrlaubRestAnzeige();
  document.getElementById("urlaubTotal")?.addEventListener("input", (e) => {
    saveUrlaubTotal(e.target.value);
    recalcUrlaubRestAnzeige();
  });

  // Monatsdaten initial laden
  loadMonth();

  // Service Worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(console.error);
  }
});

// Für Inline-Löschen Button (falls irgendwo noch inline genutzt)
window.eintragLoeschen = eintragLoeschen;













     














































