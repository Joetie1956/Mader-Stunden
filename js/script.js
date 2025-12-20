/* =========================================================
   Stunden-App – script.js (FINAL, komplett neu)
   ========================================================= */

   const DISPO_EMAIL = "joerntiedemann@web.de"; // <- hier deine Zieladresse


// ===================== Helpers =====================

function openWebDeCompose(to, subject, body) {
  // Web.de hat keine offiziell stabile "compose" URL, daher öffnen wir Web.de-Mail
  // Empfänger/Betreff/Text können nicht garantiert automatisch gesetzt werden.
  const url = "https://web.de/mail/";
  window.open(url, "_blank");
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
  const num =
    typeof value === "number"
      ? value
      : parseFloat(String(value).replace(",", "."));
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

function monthLongFromShort(monatKurz) {
  const map = {
    Jan: "Januar",
    Feb: "Februar",
    Mär: "März",
    Apr: "April",
    Mai: "Mai",
    Jun: "Juni",
    Jul: "Juli",
    Aug: "August",
    Sep: "September",
    Okt: "Oktober",
    Nov: "November",
    Dez: "Dezember",
  };
  return map[monatKurz] || monatKurz || "";
}

function isStatusDay(ortAbfahrt) {
  const s = (ortAbfahrt || "").trim().toLowerCase();
  return ["urlaub", "krank", "abbummeln"].includes(s);
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
  return Number.isFinite(n) && n >= 0 ? n : null; // null = nicht gesetzt
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

  // Feldwert zuerst lesen (damit nichts „weg-0t“)
  const fieldVal = parseInt(String(totalEl.value || "").trim(), 10);
  const fieldHasNumber = Number.isFinite(fieldVal) && fieldVal >= 0;

  const stored = loadUrlaubTotal();
  let total;

  if (stored === null) {
    // noch nicht gespeichert
    if (fieldHasNumber) {
      total = saveUrlaubTotal(fieldVal);
    } else {
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

  // Status Tage: alles 0
  if (isStatusDay(ortAbfahrt)) {
    stdFeld.value = "0,00";
    weStdFeld.value = "0,00";
    nachtStdFeld.value = "0,00";
    spesenFeld.value = "0,00 €";
    return;
  }

  const vonMin = parseTimeToMinutes(vonStr);
  const bisMinRaw = parseTimeToMinutes(bisStr);

  if (vonMin === null || bisMinRaw === null) {
    alert("Bitte gültige Zeiten für 'Von' und 'Bis' eingeben.");
    return;
  }

  let bisMin = bisMinRaw;
  if (bisMin <= vonMin) bisMin += 24 * 60;

  let gesamtMin = bisMin - vonMin;
  const pauseMin = parsePauseToMinutes(pauseStr);
  gesamtMin = Math.max(0, gesamtMin - pauseMin);

  const gesamtStd = gesamtMin / 60;
  stdFeld.value = formatNumberDE(gesamtStd);

  // Wochenende
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

  // Spesen
  const istFirmaAbfahrt = ortAbfahrt.toLowerCase() === "firma";
  const istFirmaAnkunft = ortAnkunft.toLowerCase() === "firma";
  const spesen = (istFirmaAbfahrt || istFirmaAnkunft) ? 14 : 28;
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
}

// ===================== Einträge CRUD =====================
function eintragHinzufuegen() {
  const datumISO = document.getElementById("datum").value;
  const ortAbfahrt = document.getElementById("ortAbfahrt").value.trim();
  const ortAnkunft = document.getElementById("ortAnkunft").value.trim();
  const vonStr = document.getElementById("vonZeit").value;
  const bisStr = document.getElementById("bisZeit").value;
  const pauseStr = document.getElementById("pause").value;

  if (!datumISO) return alert("Bitte ein Datum eingeben.");

  const statusDay = isStatusDay(ortAbfahrt);
  if (!statusDay && (!vonStr || !bisStr)) {
    return alert("Bitte für Arbeitstage 'Von' und 'Bis' ausfüllen.");
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

  // --- Urlaub-Jahresliste korrekt pflegen (bei Ersetzen) ---
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

  // Sortieren
  eintraege.sort((a, b) => {
    const da = parseGermanDateToDate(a.datum);
    const db = parseGermanDateToDate(b.datum);
    return (da?.getTime() || 0) - (db?.getTime() || 0);
  });

  aktualisiereTabelleUndSummen();
  saveMonth();
  recalcUrlaubRestAnzeige();

  // UX: Monatsübersicht zeigen
  const btnMonat = document.querySelector('.nav-btn[data-target="page-monat"]');
  showPage("page-monat", btnMonat);
}

function eintragLoeschen(index) {
  if (index < 0 || index >= eintraege.length) return;

  const removed = eintraege[index];
  eintraege.splice(index, 1);

  // Urlaubstag entfernen, falls Urlaub
  if (isUrlaubEntry(removed)) {
    const dates = loadUrlaubDates().filter((d) => d !== removed.datum);
    saveUrlaubDates(dates);
  }

  aktualisiereTabelleUndSummen();
  saveMonth();
  recalcUrlaubRestAnzeige();
}

function eintraegeLeeren() {
  if (!confirm("Möchtest du wirklich alle Einträge dieses Monats löschen?")) return;

  // Urlaubstage dieses Monats aus Jahresliste entfernen
  const monthUrlaubDates = eintraege.filter(isUrlaubEntry).map((e) => e.datum);
  if (monthUrlaubDates.length) {
    const dates = loadUrlaubDates().filter((d) => !monthUrlaubDates.includes(d));
    saveUrlaubDates(dates);
  }

  eintraege.length = 0;
  aktualisiereTabelleUndSummen();
  saveMonth();
  recalcUrlaubRestAnzeige();
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
      <td><button type="button" class="btn-danger small" onclick="eintragLoeschen(${index})">Löschen</button></td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById("sumStd").textContent = formatNumberDE(sumStd);
  document.getElementById("sumWeStd").textContent = formatNumberDE(sumWe);
  document.getElementById("sumNachtStd").textContent = formatNumberDE(sumNacht);
  document.getElementById("sumSpesen").textContent = formatNumberDE(sumSpesen);
}

// ===================== CSV Export =====================
function csvExport() {
  if (eintraege.length === 0) return alert("Keine Einträge vorhanden.");

  const vorname = (localStorage.getItem("stundenapp_vorname") || "").trim();
  const nachname = (localStorage.getItem("stundenapp_nachname") || "").trim();
  if (!vorname || !nachname) return alert("Bitte zuerst Vorname & Nachname eintragen.");

  const monatKurz = (document.getElementById("monat")?.value || "").trim();
  const jahr = (document.getElementById("jahr")?.value || "").trim() || getYearSafe();
  const monatLang = monthLongFromShort(monatKurz);

  // Firmenkopf (anpassen)
  const firma = "Mader Transporte";
  const adresse1 = "Heidekoppel 20";
  const adresse2 = "24558 Henstedt-Ulzburg";

  const empId = computeEmployeeId(vorname, nachname) || "OhneName";

  let csv = "";
  csv += `${firma};;;;Name;${vorname};${nachname}\r\n`;
  csv += `${adresse1};;;;Monat/Jahr;${monatLang};${jahr}\r\n`;
  csv += `${adresse2}\r\n`;
  csv += `\r\n\r\n\r\n\r\n`; // bis Tabellenkopf Zeile 8

  csv += "Tag;Datum;OrtAbfahrt;OrtAnkunft;Von;Bis;Std;WEStd;Pause;NachtStd;Spesen\r\n";

  eintraege.forEach((e) => {
    const spesenClean = String(e.spesen || "").replace("€", "").trim();
    csv += [
      e.tag || "",
      e.datum || "",
      e.ortAbfahrt || "",
      e.ortAnkunft || "",
      e.von || "",
      e.bis || "",
      e.std || "",
      e.weStd || "",
      e.pause || "",
      e.nachtStd || "",
      spesenClean,
    ].join(";") + "\r\n";
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `Stunden_${monatKurz || "Monat"}_${jahr || "Jahr"}_${empId}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);

  // optional: Mail-App öffnen
const willSend = confirm("CSV jetzt per E-Mail senden?");
if (willSend) {
  const monatKurz = (document.getElementById("monat")?.value || "").trim();
  const jahr = (document.getElementById("jahr")?.value || "").trim();
  const empId = document.getElementById("mitarbeiterIdAnzeige")?.value || "";
  const subject = `Stundenliste ${monatKurz} ${jahr} (${empId})`;
  const body =
    `Hallo,\n\nanbei die exportierte CSV für ${monatKurz} ${jahr}.\n` +
    `Dateiname: Stunden_${monatKurz}_${jahr}_${empId}.csv\n\n` +
    `Viele Grüße`;

  const mailto =
    `mailto:${encodeURIComponent(DISPO_EMAIL)}` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;

  window.location.href = mailto;
}

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

  document.getElementById("btnResetAll")?.addEventListener("click", () => {
    if (!confirm("Alles zurücksetzen?")) return;
    localStorage.clear();
    location.reload();
  });

  // Stammdaten
  const vornameEl = document.getElementById("vorname");
  const nachnameEl = document.getElementById("nachname");
  const monatEl = document.getElementById("monat");
  const jahrEl = document.getElementById("jahr");
  const datumEl = document.getElementById("datum");

  // Name laden
  if (vornameEl) vornameEl.value = localStorage.getItem("stundenapp_vorname") || "";
  if (nachnameEl) nachnameEl.value = localStorage.getItem("stundenapp_nachname") || "";

  // Monat/Jahr laden oder heute setzen
  const now = new Date();
  const monateKurz = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];

  const savedMonat = localStorage.getItem("stundenapp_monat");
  const savedJahr = localStorage.getItem("stundenapp_jahr");

  if (monatEl) monatEl.value = savedMonat || monateKurz[now.getMonth()];
  if (jahrEl) jahrEl.value = savedJahr || String(now.getFullYear());

  // Mitarbeiter-ID sofort
  updateMitarbeiterIdAnzeige();

  // Name speichern + ID aktualisieren + Daten neu laden (weil Key ändert)
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

  // Monat/Jahr speichern + Monat laden
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

  // PWA: Service Worker registrieren
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(console.error);
  }
});

// Für Inline-Löschen Button
window.eintragLoeschen = eintragLoeschen;












     








