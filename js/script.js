/* =========================================================
   Stunden-App – script.js (FINAL)
   - Navigation: Stammdaten / Tageserfassung / Monatsübersicht
   - Stammdaten: Vorname/Nachname/Monat/Jahr gespeichert
   - Mitarbeiter-ID Anzeige (z.B. JTiedemann)
   - Monatsdaten pro Mitarbeiter+Monat+Jahr gespeichert
   - Berechnung inkl. Urlaub/Krank/Abbummeln
   - CSV: Firmenkopf + Name in E1/F1/G1 + Monat/Jahr in E2/F2/G2
   - CSV Dateiname: Stunden_Dez_2025_JTiedemann.csv
   ========================================================= */

// ===================== Helpers =====================
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
  const num = typeof value === "number"
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
    Jan: "Januar", Feb: "Februar", Mär: "März", Apr: "April", Mai: "Mai", Jun: "Juni",
    Jul: "Juli", Aug: "August", Sep: "September", Okt: "Oktober", Nov: "November", Dez: "Dezember"
  };
  return map[monatKurz] || monatKurz || "";
}

function isStatusDay(ortAbfahrt) {
  const s = (ortAbfahrt || "").trim().toLowerCase();
  return ["urlaub", "krank", "abbummeln"].includes(s);
}

// ===================== Navigation (Pages) =====================
function showPage(pageId, clickedBtn) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("page-active"));
  const el = document.getElementById(pageId);
  if (el) el.classList.add("page-active");

  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
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

// ===================== Storage Keys =====================
function getEmployeeKeyPart() {
  const v = localStorage.getItem("stundenapp_vorname") || "";
  const n = localStorage.getItem("stundenapp_nachname") || "";
  return computeEmployeeId(v, n) || "OhneName";
}

function monthKey() {
  const monat = (document.getElementById("monat")?.value || "").trim();
  const jahr = (document.getElementById("jahr")?.value || "").trim();
  const emp = getEmployeeKeyPart();
  return `stundenapp_eintraege_${emp}_${jahr}_${monat}`;
}

// ===================== State =====================
const eintraege = [];

// ===================== Wochentag =====================
function ermittleWochentagName(datumISO) {
  const tag = weekdayShortFromISO(datumISO);
  const feld = document.getElementById("wochentag");
  if (feld) feld.value = tag;
  return tag;
}

// ===================== Berechnung =====================
function berechne() {
  const datumStr = document.getElementById("datum").value;
  const ortAbfahrt = document.getElementById("ortAbfahrt").value.trim();
  const ortAnkunft = document.getElementById("ortAnkunft").value.trim();
  const vonStr = document.getElementById("vonZeit").value;
  const bisStr = document.getElementById("bisZeit").value;
  const pauseStr = document.getElementById("pause").value;

  const stdFeld = document.getElementById("std");
  const weStdFeld = document.getElementById("weStd");
  const nachtStdFeld = document.getElementById("nachtStd");
  const spesenFeld = document.getElementById("spesen");

  // Wochentag setzen
  ermittleWochentagName(datumStr);

  // Status-Tage => alles 0
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
  if (bisMin <= vonMin) bisMin += 24 * 60; // über Mitternacht

  // Arbeitszeit minus Pause
  let gesamtMin = bisMin - vonMin;
  const pauseMin = parsePauseToMinutes(pauseStr);
  gesamtMin = Math.max(0, gesamtMin - pauseMin);

  const gesamtStd = gesamtMin / 60;
  stdFeld.value = formatNumberDE(gesamtStd);

  // Wochenende
  let weStd = 0;
  if (datumStr) {
    const [y, m, d] = datumStr.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dow = dateObj.getDay(); // 0=So, 6=Sa
    if (dow === 0 || dow === 6) weStd = gesamtStd;
  }
  weStdFeld.value = formatNumberDE(weStd);

  // Nachtstunden 22–06 (mind. 2h)
  const arbeitStart = vonMin;
  const arbeitEnde = bisMin;

  let nachtMin = 0;
  nachtMin += overlapMinutes(arbeitStart, arbeitEnde, 22 * 60, 24 * 60);          // 22–24
  nachtMin += overlapMinutes(arbeitStart, arbeitEnde, 0, 6 * 60);                 // 00–06
  nachtMin += overlapMinutes(arbeitStart, arbeitEnde, 24 * 60, 24 * 60 + 6 * 60); // 24–30

  let nachtStd = nachtMin / 60;
  if (nachtStd < 2) nachtStd = 0;
  nachtStdFeld.value = formatNumberDE(nachtStd);

  // Spesen
  const istFirmaAbfahrt = ortAbfahrt.toLowerCase() === "firma";
  const istFirmaAnkunft = ortAnkunft.toLowerCase() === "firma";
  const spesen = (istFirmaAbfahrt || istFirmaAnkunft) ? 14 : 28;
  spesenFeld.value = `${formatNumberDE(spesen)} €`;
}

function resetForm() {
  // Datum bewusst nicht löschen
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

// ===================== Month Storage =====================
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
      if (Array.isArray(arr)) arr.forEach(x => eintraege.push(x));
    } catch (e) {
      console.error("Laden fehlgeschlagen:", e);
    }
  }
  aktualisiereTabelleUndSummen();
}

// ===================== CRUD Entries =====================
function eintragHinzufuegen() {
  const datumISO = document.getElementById("datum").value;
  const ortAbfahrt = document.getElementById("ortAbfahrt").value.trim();
  const ortAnkunft = document.getElementById("ortAnkunft").value.trim();
  const vonStr = document.getElementById("vonZeit").value;
  const bisStr = document.getElementById("bisZeit").value;
  const pauseStr = document.getElementById("pause").value;

  if (!datumISO) {
    alert("Bitte ein Datum eingeben.");
    return;
  }

  const statusDay = isStatusDay(ortAbfahrt);
  if (!statusDay && (!vonStr || !bisStr)) {
    alert("Bitte für Arbeitstage 'Von' und 'Bis' ausfüllen.");
    return;
  }

  // berechnen (setzt Felder)
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
    spesen: document.getElementById("spesen").value || "0,00 €"
  };

  // Datum schon vorhanden? -> ersetzen statt doppelt
  const idx = eintraege.findIndex(e => e.datum === entry.datum);
  if (idx >= 0) eintraege[idx] = entry;
  else eintraege.push(entry);

  // nach Datum sortieren
  eintraege.sort((a, b) => {
    const da = parseGermanDateToDate(a.datum);
    const db = parseGermanDateToDate(b.datum);
    return (da?.getTime() || 0) - (db?.getTime() || 0);
  });

  aktualisiereTabelleUndSummen();
  saveMonth();

  // UX: direkt Monatsübersicht anzeigen
  const btnMonat = document.querySelector('.nav-btn[data-target="page-monat"]');
  showPage("page-monat", btnMonat);
}

function eintragLoeschen(index) {
  if (index < 0 || index >= eintraege.length) return;
  eintraege.splice(index, 1);
  aktualisiereTabelleUndSummen();
  saveMonth();
}

function eintraegeLeeren() {
  if (!confirm("Möchtest du wirklich alle Einträge dieses Monats löschen?")) return;
  eintraege.length = 0;
  aktualisiereTabelleUndSummen();
  saveMonth();
}

// ===================== Table & Totals =====================
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
  if (eintraege.length === 0) {
    alert("Keine Einträge vorhanden.");
    return;
  }

  // Stammdaten
  const vorname = (localStorage.getItem("stundenapp_vorname") || "").trim();
  const nachname = (localStorage.getItem("stundenapp_nachname") || "").trim();
  if (!vorname || !nachname) {
    alert("Bitte zuerst Vorname und Nachname unter Stammdaten eintragen.");
    return;
  }

  const monatKurz = (document.getElementById("monat")?.value || "").trim();
  const jahr = (document.getElementById("jahr")?.value || "").trim();
  const monatLang = monthLongFromShort(monatKurz);

  // Firmenkopf (hier anpassen, wenn nötig)
  const firma = "Mader Transporte";
  const adresse1 = "Heidekoppel 20";
  const adresse2 = "24558 Henstedt-Ulzburg";

  const empId = computeEmployeeId(vorname, nachname) || "OhneName";

  let csv = "";
  // Zeile 1: A1 + E1/F1/G1
  csv += `${firma};;;;Name;${vorname};${nachname}\r\n`;
  // Zeile 2: A2 + E2/F2/G2
  csv += `${adresse1};;;;Monat/Jahr;${monatLang};${jahr}\r\n`;
  // Zeile 3: A3
  csv += `${adresse2}\r\n`;

  // Zeile 4–7 leer (damit Tabellenkopf in Zeile 8 ist)
  csv += `\r\n\r\n\r\n\r\n`;

  // Zeile 8 Tabellenkopf
  csv += "Tag;Datum;OrtAbfahrt;OrtAnkunft;Von;Bis;Std;WEStd;Pause;NachtStd;Spesen\r\n";

  // Daten ab Zeile 9
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
      spesenClean
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
}

// ===================== Init =====================
document.addEventListener("DOMContentLoaded", () => {
  // Navigation
  document.querySelectorAll(".nav-btn").forEach(btn => {
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

  // Stammdaten Elemente
  const vornameEl = document.getElementById("vorname");
  const nachnameEl = document.getElementById("nachname");
  const monatEl = document.getElementById("monat");
  const jahrEl = document.getElementById("jahr");
  const datumEl = document.getElementById("datum");

  // Stammdaten laden (Name)
  if (vornameEl) vornameEl.value = localStorage.getItem("stundenapp_vorname") || "";
  if (nachnameEl) nachnameEl.value = localStorage.getItem("stundenapp_nachname") || "";

  // Default Monat/Jahr: Storage oder heute
  const now = new Date();
  const monateKurz = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];

  const savedMonat = localStorage.getItem("stundenapp_monat");
  const savedJahr = localStorage.getItem("stundenapp_jahr");

  if (monatEl) monatEl.value = savedMonat || monateKurz[now.getMonth()];
  if (jahrEl) jahrEl.value = savedJahr || String(now.getFullYear());

  // Mitarbeiter-ID sofort anzeigen
  updateMitarbeiterIdAnzeige();

  // Live speichern + ID aktualisieren
  vornameEl?.addEventListener("input", () => {
    localStorage.setItem("stundenapp_vorname", vornameEl.value.trim());
    updateMitarbeiterIdAnzeige();
    loadMonth(); // Key ändert sich ggf. -> passenden Monat laden
  });

  nachnameEl?.addEventListener("input", () => {
    localStorage.setItem("stundenapp_nachname", nachnameEl.value.trim());
    updateMitarbeiterIdAnzeige();
    loadMonth(); // Key ändert sich ggf. -> passenden Monat laden
  });

  monatEl?.addEventListener("change", () => {
    localStorage.setItem("stundenapp_monat", monatEl.value.trim());
    loadMonth();
  });

  jahrEl?.addEventListener("change", () => {
    localStorage.setItem("stundenapp_jahr", jahrEl.value.trim());
    loadMonth();
  });

  // Datum initial setzen (wenn leer)
  if (datumEl && !datumEl.value) {
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    datumEl.value = `${yyyy}-${mm}-${dd}`;
  }
  ermittleWochentagName(datumEl?.value);

  // Wochentag bei Datum-Änderung
  datumEl?.addEventListener("change", () => ermittleWochentagName(datumEl.value));

  // Monatsdaten laden
  loadMonth();

  // PWA: Service Worker registrieren
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(console.error);
  }
});

// Für Inline-Löschen Button
window.eintragLoeschen = eintragLoeschen;












     





