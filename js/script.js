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

function toGermanDate(yyyyMmDd) {
  if (!yyyyMmDd) return "";
  const [y, m, d] = yyyyMmDd.split("-");
  return `${d}.${m}.${y}`;
}

function todayGerman() {
  const t = new Date();
  const dd = String(t.getDate()).padStart(2, "0");
  const mm = String(t.getMonth() + 1).padStart(2, "0");
  const yy = t.getFullYear();
  return `${dd}.${mm}.${yy}`;
}

function weekdayShortFromISO(datumStr) {
  if (!datumStr) return "";
  const [y, m, d] = datumStr.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  const w = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  return w[dateObj.getDay()] || "";
}

// ===================== Navigation (Pages) =====================
function showPage(pageId, clickedBtn) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("page-active"));
  const el = document.getElementById(pageId);
  if (el) el.classList.add("page-active");

  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  if (clickedBtn) clickedBtn.classList.add("active");
}

// ===================== Storage Keys =====================
function monthKey() {
  const monat = document.getElementById("monat").value.trim();
  const jahr = document.getElementById("jahr").value.trim();
  return `stundenapp_eintraege_${jahr}_${monat}`;
}

// ===================== State =====================
const eintraege = [];

// ===================== Calculate Day =====================
function ermittleWochentagName(datumStr) {
  const tag = weekdayShortFromISO(datumStr);
  const feld = document.getElementById("wochentag");
  if (feld) feld.value = tag;
  return tag;
}

function isStatusDay(ortAbfahrt) {
  const s = (ortAbfahrt || "").trim().toLowerCase();
  return ["urlaub", "krank", "abbummeln"].includes(s);
}

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

  // Wochentag
  ermittleWochentagName(datumStr);

  // Status-Tage: keine Berechnung
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
    const dow = dateObj.getDay(); // 0=So,6=Sa
    if (dow === 0 || dow === 6) weStd = gesamtStd;
  }
  weStdFeld.value = formatNumberDE(weStd);

  // Nachtstunden 22–06 (mind. 2h)
  let arbeitStart = vonMin;
  let arbeitEnde = bisMin;

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
function resetForm() {
  // Datum bewusst NICHT löschen (praktisch auf Handy)
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

function eintragHinzufuegen() {
  const datumStr = document.getElementById("datum").value;
  const ortAbfahrt = document.getElementById("ortAbfahrt").value.trim();
  const ortAnkunft = document.getElementById("ortAnkunft").value.trim();
  const vonStr = document.getElementById("vonZeit").value;
  const bisStr = document.getElementById("bisZeit").value;
  const pauseStr = document.getElementById("pause").value;

  if (!datumStr) {
    alert("Bitte ein Datum eingeben.");
    return;
  }

  const status = (ortAbfahrt || "").trim().toLowerCase();
  const statusDay = isStatusDay(ortAbfahrt);

  if (!statusDay && (!vonStr || !bisStr)) {
    alert("Bitte für Arbeitstage 'Von' und 'Bis' ausfüllen.");
    return;
  }

  // vorher berechnen
  berechne();

  const entry = {
    tag: weekdayShortFromISO(datumStr),
    datum: toGermanDate(datumStr),
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

  // Falls Datum schon existiert: ersetzen statt doppelt
  const idx = eintraege.findIndex(e => e.datum === entry.datum);
  if (idx >= 0) {
    eintraege[idx] = entry;
  } else {
    eintraege.push(entry);
  }

  // nach Datum sortieren
  eintraege.sort((a, b) => {
    const [da, ma, ya] = a.datum.split(".").map(Number);
    const [db, mb, yb] = b.datum.split(".").map(Number);
    return new Date(ya, ma - 1, da) - new Date(yb, mb - 1, db);
  });

  aktualisiereTabelleUndSummen();
  saveMonth();

  // UX: direkt Monatsübersicht zeigen
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
  tbody.innerHTML = "";

  const heuteStr = todayGerman();

  let sumStd = 0, sumWe = 0, sumNacht = 0, sumSpesen = 0;

  eintraege.forEach((e, index) => {
    const tr = document.createElement("tr");

    // Zeilenklassen
    if (e.tag === "Sa" || e.tag === "So") tr.classList.add("row-weekend");
    if (e.datum === heuteStr) tr.classList.add("row-today");

    const status = (e.ortAbfahrt || "").trim().toLowerCase();
    if (status === "urlaub") tr.classList.add("row-urlaub");
    if (status === "krank") tr.classList.add("row-krank");
    if (status === "abbummeln") tr.classList.add("row-abbummeln");

    // Summen
    sumStd += parseFloat((e.std || "0").replace(",", ".")) || 0;
    sumWe += parseFloat((e.weStd || "0").replace(",", ".")) || 0;
    sumNacht += parseFloat((e.nachtStd || "0").replace(",", ".")) || 0;

    const sp = String(e.spesen || "0").replace("€", "").replace(" ", "").replace(",", ".");
    sumSpesen += parseFloat(sp) || 0;

    tr.innerHTML = `
      <td>${e.tag}</td>
      <td>${e.datum}</td>
      <td>${e.ortAbfahrt}</td>
      <td>${e.ortAnkunft}</td>
      <td>${e.von}</td>
      <td>${e.bis}</td>
      <td>${e.std}</td>
      <td>${e.weStd}</td>
      <td>${e.pause}</td>
      <td>${e.nachtStd}</td>
      <td>${e.spesen}</td>
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

  // ===== Firmenadresse =====
  const firma = "Mader Transporte";
  const adresse1 = "Heidekoppel 20";
  const adresse2 = "24558 Henstedt-Ulzburg";

  // ===== Stammdaten =====
  const vorname = (localStorage.getItem("stundenapp_vorname") || "").trim();
  const nachname = (localStorage.getItem("stundenapp_nachname") || "").trim();

  const monatKurz = (document.getElementById("monat")?.value || "").trim();
  const jahr = (document.getElementById("jahr")?.value || "").trim();

  const monateLang = {
    Jan: "Januar", Feb: "Februar", Mär: "März", Apr: "April", Mai: "Mai",
    Jun: "Juni", Jul: "Juli", Aug: "August", Sep: "September",
    Okt: "Oktober", Nov: "November", Dez: "Dezember"
  };
  const monatLang = monateLang[monatKurz] || monatKurz;

  let csv = "";

  // ===== Zeile 1: A1 + E1/F1/G1 =====
  // Spalten: A;B;C;D;E;F;G
  csv += `${firma};;;;Name;${vorname};${nachname}\r\n`;

  // ===== Zeile 2: A2 + E2/F2/G2 =====
  csv += `${adresse1};;;;Monat/Jahr;${monatLang};${jahr}\r\n`;

  // ===== Zeile 3: nur A3 =====
  csv += `${adresse2}\r\n`;

  // ===== Zeilen 4–7 leer (damit Tabellenkopf in Zeile 8 landet) =====
  csv += `\r\n\r\n\r\n\r\n`;

  // ===== Zeile 8: Tabellenkopf =====
  csv += "Tag;Datum;OrtAbfahrt;OrtAnkunft;Von;Bis;Std;WEStd;Pause;NachtStd;Spesen\r\n";

  // ===== Daten ab Zeile 9 =====
  eintraege.forEach((e) => {
    const spesenClean = String(e.spesen || "").replace("€", "").trim();

    csv += [
      e.tag || "",
      e.datum || "",        // TT.MM.JJJJ
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

  // ===== Download =====
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  const v = (localStorage.getItem("stundenapp_vorname") || "").trim();
const n = (localStorage.getItem("stundenapp_nachname") || "").trim();

const initial = v ? v[0].toUpperCase() : "X";
const cleanNachname = n.replace(/[^a-zA-Z0-9ÄÖÜäöüß_-]/g, ""); // Dateiname sicher

a.download = `Stunden_${monatKurz || "Monat"}_${jahr || "Jahr"}_${initial}${cleanNachname}.csv`;

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
  document.getElementById("btnBerechne").addEventListener("click", berechne);
  document.getElementById("btnResetForm").addEventListener("click", resetForm);
  document.getElementById("btnAdd").addEventListener("click", eintragHinzufuegen);
  document.getElementById("btnClear").addEventListener("click", eintraegeLeeren);
  document.getElementById("btnCSV").addEventListener("click", csvExport);

  document.getElementById("btnResetAll").addEventListener("click", () => {
    if (!confirm("Alles zurücksetzen? (Namen + Monatsdaten bleiben nur, wenn du NICHT bestätigst.)")) return;
    localStorage.clear();
    location.reload();
  });

  // Stammdaten speichern
  const vorname = document.getElementById("vorname");
  const nachname = document.getElementById("nachname");
  const monat = document.getElementById("monat");
  const jahr = document.getElementById("jahr");
  const datum = document.getElementById("datum");

  // Names load/save
  vorname.value = localStorage.getItem("stundenapp_vorname") || "";
  nachname.value = localStorage.getItem("stundenapp_nachname") || "";

  vorname.addEventListener("input", () => localStorage.setItem("stundenapp_vorname", vorname.value.trim()));
  nachname.addEventListener("input", () => localStorage.setItem("stundenapp_nachname", nachname.value.trim()));

  // default date
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  if (!jahr.value) jahr.value = yyyy;
  // Monat automatisch passend zu heute setzen
  const monthIdx = now.getMonth();
  monat.selectedIndex = monthIdx;

  // Datum initial
  datum.value = `${yyyy}-${mm}-${dd}`;
  ermittleWochentagName(datum.value);

  // Wenn Datum geändert wird: Wochentag aktualisieren
  datum.addEventListener("change", () => {
    ermittleWochentagName(datum.value);
  });

  // Wenn Monat/Jahr geändert wird -> Monatsdaten laden
  function onMonthOrYearChange() {
    loadMonth();
  }
  monat.addEventListener("change", onMonthOrYearChange);
  jahr.addEventListener("change", onMonthOrYearChange);

  // initial month load
  loadMonth();

  // PWA: Service Worker registrieren
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(console.error);
  }
});

function saveStammdaten() {
  localStorage.setItem("stundenapp_vorname", (document.getElementById("vorname")?.value || "").trim());
  localStorage.setItem("stundenapp_nachname", (document.getElementById("nachname")?.value || "").trim());
  localStorage.setItem("stundenapp_monat", (document.getElementById("monat")?.value || "").trim());
  localStorage.setItem("stundenapp_jahr", (document.getElementById("jahr")?.value || "").trim());
}

function loadStammdaten() {
  const v = localStorage.getItem("stundenapp_vorname") || "";
  const n = localStorage.getItem("stundenapp_nachname") || "";
  const m = localStorage.getItem("stundenapp_monat") || "";
  const j = localStorage.getItem("stundenapp_jahr") || "";

  const vornameEl = document.getElementById("vorname");
  const nachnameEl = document.getElementById("nachname");
  const monatEl = document.getElementById("monat");
  const jahrEl = document.getElementById("jahr");

  if (vornameEl) vornameEl.value = v;
  if (nachnameEl) nachnameEl.value = n;

  // Wichtig: Monat/Jahr zuerst aus Storage nehmen – NICHT sofort wieder "heute" drüberbügeln
  if (monatEl && m) monatEl.value = m;
  if (jahrEl && j) jahrEl.value = j;

  // Falls noch nix gespeichert ist -> erst dann Default auf heute
  const now = new Date();
  if (jahrEl && !jahrEl.value) jahrEl.value = String(now.getFullYear());
  if (monatEl && !monatEl.value) {
    const monate = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];
    monatEl.value = monate[now.getMonth()];
  }
}


// Expose delete globally for inline button
window.eintragLoeschen = eintragLoeschen;













     



