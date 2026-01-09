/* =========================================================
   Stunden-App – script.js 
   ========================================================= */


let toastTimer = null;

function showToast(msg, ms = 2400) {
  const el = document.getElementById("appToast");
  if (!el) return;
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

  // Fallback (sollte nicht passieren)
  if (!overlay || !txt || !btnYes || !btnNo) {
    if (typeof onYes === "function") onYes();
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
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const s = String(timeStr).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(mi)) return null;
  return h * 60 + mi;
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

function nowHHMM() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function safeTrim(s) {
  return String(s ?? "").trim();
}

function normalizeEmpPart(s) {
  // Entfernt Sonderzeichen für Dateinamen / ID
  return safeTrim(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Umlaute/Diakritika entfernen
    .replace(/[^a-zA-Z0-9]+/g, "");
}

function buildEmpIdFromNames(vorname, nachname) {
  const v = normalizeEmpPart(vorname);
  const n = normalizeEmpPart(nachname);
  if (!v && !n) return "";
  const first = v ? v.charAt(0).toUpperCase() : "";
  const last = n ? n.charAt(0).toUpperCase() + n.slice(1) : "";
  return `${first}${last}`;
}

function monatLangName(monatKurz) {
  const map = {
    Jan: "Januar",
    Feb: "Februar",
    "Mär": "März",
    Apr: "April",
    Mai: "Mai",
    Jun: "Juni",
    Jul: "Juli",
    Aug: "August",
    Sep: "September",
    Okt: "Oktober",
    Nov: "November",
    Dez: "Dezember"
  };
  return map[monatKurz] || monatKurz;
}

function monatJahrLang(monatKurz, jahr) {
  return `${monatLangName(monatKurz)} ${String(jahr)}`;
}

// ===================== Navigation (Pages) =====================
function showPage(pageId, clickedBtn) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("page-active"));
  const el = document.getElementById(pageId);
  if (el) el.classList.add("page-active");

  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
  if (clickedBtn) clickedBtn.classList.add("active");
}

// ===================== Storage Keys =====================
function monthKey() {
  const monat = safeTrim(document.getElementById("monat")?.value);
  const jahr = safeTrim(document.getElementById("jahr")?.value);
  return `stundenapp_eintraege_${jahr}_${monat}`;
}

// ===================== State =====================
const eintraege = [];

// ===================== Mitarbeiter-ID Anzeige =====================
function updateMitarbeiterIdAnzeige() {
  const vorname = document.getElementById("vorname");
  const nachname = document.getElementById("nachname");
  const out = document.getElementById("mitarbeiterIdAnzeige");
  if (!vorname || !nachname || !out) return;

  const empId = buildEmpIdFromNames(vorname.value, nachname.value);
  out.value = empId || "";
  localStorage.setItem("stundenapp_empid", empId || "");
}

// ===================== Day / Status =====================
function ermittleWochentagName(datumStr) {
  const tag = weekdayShortFromISO(datumStr);
  const feld = document.getElementById("wochentag");
  if (feld) feld.value = tag;
  return tag;
}

function isStatusDay(ortAbfahrt) {
  const s = safeTrim(ortAbfahrt).toLowerCase();
  return ["urlaub", "krank", "abbummeln", "feiertag"].includes(s);
}

// ===================== Calculate Day =====================
function berechne() {
  const datumStr = document.getElementById("datum")?.value || "";
  const ortAbfahrt = safeTrim(document.getElementById("ortAbfahrt")?.value);
  const ortAnkunft = safeTrim(document.getElementById("ortAnkunft")?.value);
  const vonStr = safeTrim(document.getElementById("vonZeit")?.value);
  const bisStr = safeTrim(document.getElementById("bisZeit")?.value);
  const pauseStr = safeTrim(document.getElementById("pause")?.value);

  const stdFeld = document.getElementById("std");
  const weStdFeld = document.getElementById("weStd");
  const nachtStdFeld = document.getElementById("nachtStd");
  const spesenFeld = document.getElementById("spesen");

  // Wochentag
  ermittleWochentagName(datumStr);

  // Status-Tage: keine Berechnung
  if (isStatusDay(ortAbfahrt)) {
    if (stdFeld) stdFeld.value = "0,00";
    if (weStdFeld) weStdFeld.value = "0,00";
    if (nachtStdFeld) nachtStdFeld.value = "0,00";
    if (spesenFeld) spesenFeld.value = "0,00 €";
    showToast("Status-Tag erkannt – keine Berechnung.");
    return;
  }

  const vonMin = parseTimeToMinutes(vonStr);
  const bisMinRaw = parseTimeToMinutes(bisStr);

  if (vonMin === null || bisMinRaw === null) {
    showToast("Bitte gültige Zeiten für Von und Bis eingeben.");
    return;
  }

  let bisMin = bisMinRaw;
  if (bisMin <= vonMin) bisMin += 24 * 60; // über Mitternacht

  let gesamtMin = bisMin - vonMin;
  const pauseMin = parsePauseToMinutes(pauseStr);
  gesamtMin = Math.max(0, gesamtMin - pauseMin);

  const gesamtStd = gesamtMin / 60;
  if (stdFeld) stdFeld.value = formatNumberDE(gesamtStd);

  // Wochenende
  let weStd = 0;
  if (datumStr) {
    const [y, m, d] = datumStr.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dow = dateObj.getDay(); // 0=So,6=Sa
    if (dow === 0 || dow === 6) weStd = gesamtStd;
  }
  if (weStdFeld) weStdFeld.value = formatNumberDE(weStd);

  // Nachtstunden: 23:00–06:00 (mind. 2h)
  let arbeitStart = vonMin;
  let arbeitEnde = bisMin;

  let nachtMin = 0;
  nachtMin += overlapMinutes(arbeitStart, arbeitEnde, 23 * 60, 24 * 60);          // 23–24
  nachtMin += overlapMinutes(arbeitStart, arbeitEnde, 0, 6 * 60);                 // 00–06
  nachtMin += overlapMinutes(arbeitStart, arbeitEnde, 24 * 60 + 23 * 60, 24 * 60 + 24 * 60); // falls >24h (theoretisch)
  nachtMin += overlapMinutes(arbeitStart, arbeitEnde, 24 * 60, 24 * 60 + 6 * 60); // 24–30

  let nachtStd = nachtMin / 60;
  if (nachtStd < 2) nachtStd = 0;
  if (nachtStdFeld) nachtStdFeld.value = formatNumberDE(nachtStd);

  // Spesen
  const istFirmaAbfahrt = ortAbfahrt.toLowerCase() === "firma";
  const istFirmaAnkunft = ortAnkunft.toLowerCase() === "firma";
  const spesen = (istFirmaAbfahrt || istFirmaAnkunft) ? 14 : 28;
  if (spesenFeld) spesenFeld.value = `${formatNumberDE(spesen)} €`;

  showToast("Berechnung abgeschlossen.");
}

// ===================== Month Storage =====================
function saveMonth() {
  try {
    localStorage.setItem(monthKey(), JSON.stringify(eintraege));
  } catch (e) {
    console.error("Speichern fehlgeschlagen:", e);
    showToast("Speichern fehlgeschlagen (Speicher voll?).");
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

// ===================== CRUD Entries =====================
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

function eintragHinzufuegen() {
  const datumStr = document.getElementById("datum")?.value || "";
  const ortAbfahrt = safeTrim(document.getElementById("ortAbfahrt")?.value);
  const ortAnkunft = safeTrim(document.getElementById("ortAnkunft")?.value);
  const vonStr = safeTrim(document.getElementById("vonZeit")?.value);
  const bisStr = safeTrim(document.getElementById("bisZeit")?.value);
  const pauseStr = safeTrim(document.getElementById("pause")?.value);

  if (!datumStr) {
    showToast("Bitte ein Datum eingeben.");
    return;
  }

  const statusDay = isStatusDay(ortAbfahrt);

  if (!statusDay && (!vonStr || !bisStr)) {
    showToast("Bitte Start und Ende setzen (oder Status-Tag eintragen).");
    return;
  }

  // vorher berechnen (Status-Day setzt 0,00)
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
  const idx = eintraege.findIndex((e) => e.datum === entry.datum);
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
  showToast("Eintrag gespeichert.");

  // UX: direkt Monatsübersicht zeigen
  const btnMonat = document.querySelector('.nav-btn[data-target="page-monat"]');
  showPage("page-monat", btnMonat);
}

function eintragLoeschen(index) {
  if (index < 0 || index >= eintraege.length) return;

  appConfirm("Eintrag wirklich löschen?",
    () => {
      eintraege.splice(index, 1);
      aktualisiereTabelleUndSummen();
      saveMonth();
      showToast("Eintrag gelöscht.");
    }
  );
}

function eintraegeLeeren() {
  appConfirm("Möchtest du wirklich alle Einträge dieses Monats löschen?",
    () => {
      eintraege.length = 0;
      aktualisiereTabelleUndSummen();
      saveMonth();
      showToast("Liste geleert.");
    }
  );
}

// ===================== Table & Totals =====================
function aktualisiereTabelleUndSummen() {
  const tbody = document.querySelector("#monatsTabelle tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  const heuteStr = todayGerman();

  let sumStd = 0, sumWe = 0, sumNacht = 0, sumSpesen = 0;

  eintraege.forEach((e, index) => {
    const tr = document.createElement("tr");

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

    // Optik
    if (e.tag === "Sa" || e.tag === "So") tr.classList.add("row-weekend");
    if (e.datum === heuteStr) tr.classList.add("row-today");
    const status = safeTrim(e.ortAbfahrt).toLowerCase();
    if (status === "urlaub") tr.classList.add("row-urlaub");
    if (status === "krank") tr.classList.add("row-krank");
    if (status === "abbummeln") tr.classList.add("row-abbummeln");
    if (status === "feiertag") tr.classList.add("row-feiertag");

    tbody.appendChild(tr);
  });

  document.getElementById("sumStd").textContent = formatNumberDE(sumStd);
  document.getElementById("sumWeStd").textContent = formatNumberDE(sumWe);
  document.getElementById("sumNachtStd").textContent = formatNumberDE(sumNacht);
  document.getElementById("sumSpesen").textContent = formatNumberDE(sumSpesen);
}

// ===================== CSV Export =====================
// -> Adresse bleibt oben stehen
// -> Vorname/Nachname in E1/F1/G1 Optik
// -> Monat/Jahr in E2/F2/G2 Optik
// -> Tabellenkopf in Zeile 8, Daten ab Zeile 9
const DISPO_EMAIL = "birte@example.de"; // <-- HIER ggf. anpassen (nur Beispiel)

function csvExport() {
  if (eintraege.length === 0) {
    showToast("Keine Einträge vorhanden.");
    return;
  }

  const vorname = safeTrim(document.getElementById("vorname")?.value);
  const nachname = safeTrim(document.getElementById("nachname")?.value);
  const monat = safeTrim(document.getElementById("monat")?.value);
  const jahr = safeTrim(document.getElementById("jahr")?.value);

  const empId =
    localStorage.getItem("stundenapp_empid") ||
    buildEmpIdFromNames(vorname, nachname) ||
    "Mitarbeiter";

  const fileName = `Stunden_${monat}_${jahr}_${empId}.csv`;

  let csv = "";
  csv += "Mader-Transporte\r\n";
  csv += "Heidekoppel 20\r\n";
  csv += "24558 Henstedt-Ulzburg\r\n";
  csv += `;;;;Name;${vorname};${nachname}\r\n`;
  csv += `;;;;Monat/Jahr;${monatJahrLang(monat, jahr)};;\r\n`;
  csv += "\r\n";
  csv += "\r\n";
  csv += "\r\n";
  csv += "\r\n";
  csv += "Tag;Datum;Ort Abfahrt;Ort Ankunft;Von;Bis;Std;WE-Std;Pause;Nacht;Spesen\r\n";

  eintraege.forEach((e) => {
    const spesenClean = String(e.spesen || "").replace(" €", "").replace("€", "").trim();
    csv += [
      e.tag,
      e.datum,
      e.ortAbfahrt,
      e.ortAnkunft,
      e.von,
      e.bis,
      e.std,
      e.weStd,
      e.pause,
      e.nachtStd,
      spesenClean
    ].join(";") + "\r\n";
  });

  // Download
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`CSV gespeichert: ${fileName}`);

  // Optional: Per Mail senden (Ja/Nein ohne Browser confirm)
  appConfirm("Die CSV jetzt per E-Mail senden?",
    () => {
      const subject = `Stundenliste ${monatJahrLang(monat, jahr)} (${empId})`;
      const body = `Hallo,\n\nanbei die CSV-Datei:\n${fileName}\n\nViele Grüße\n${vorname} ${nachname}`;
      const mailto =
        `mailto:${DISPO_EMAIL}` +
        `?subject=${encodeURIComponent(subject)}` +
        `&body=${encodeURIComponent(body)}`;

      window.location.href = mailto;
    },
    () => {
      showToast("OK – du kannst später senden.");
    }
  );
}

// ===================== PWA Service Worker =====================
function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch((e) => console.error(e));
  }
}

// ===================== Init =====================
document.addEventListener("DOMContentLoaded", () => {
  // Navigation
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => showPage(btn.dataset.target, btn));
  });

  // Buttons: Standard
  document.getElementById("btnBerechne")?.addEventListener("click", berechne);
  document.getElementById("btnResetForm")?.addEventListener("click", resetForm);
  document.getElementById("btnAdd")?.addEventListener("click", eintragHinzufuegen);
  document.getElementById("btnClear")?.addEventListener("click", eintraegeLeeren);
  document.getElementById("btnCSV")?.addEventListener("click", csvExport);

  // Start/Ende "Jetzt"
  document.getElementById("btnStartNow")?.addEventListener("click", () => {
    const start = document.getElementById("vonZeit");
    if (!start) return;

    if (start.value) {
      appConfirm("Start ist schon gesetzt. Überschreiben?",
        () => {
          start.value = nowHHMM();
          showToast("Start gespeichert.");
        }
      );
      return;
    }

    start.value = nowHHMM();
    showToast("Start gespeichert.");
  });

  document.getElementById("btnEndNow")?.addEventListener("click", () => {
    const ende = document.getElementById("bisZeit");
    const start = document.getElementById("vonZeit");
    if (!ende || !start) return;

    if (!start.value) {
      showToast("Bitte zuerst Start drücken.");
      return;
    }

    ende.value = nowHHMM();
    berechne();
  });

  // Stammdaten Elemente
  const vornameEl = document.getElementById("vorname");
  const nachnameEl = document.getElementById("nachname");
  const monatEl = document.getElementById("monat");
  const jahrEl = document.getElementById("jahr");
  const datumEl = document.getElementById("datum");

  // Names load/save
  if (vornameEl) vornameEl.value = localStorage.getItem("stundenapp_vorname") || "";
  if (nachnameEl) nachnameEl.value = localStorage.getItem("stundenapp_nachname") || "";

  // Mitarbeiter-ID Anzeige initial
  updateMitarbeiterIdAnzeige();

  // Name speichern + ID aktualisieren
  vornameEl?.addEventListener("input", () => {
    localStorage.setItem("stundenapp_vorname", safeTrim(vornameEl.value));
    updateMitarbeiterIdAnzeige();
  });

  nachnameEl?.addEventListener("input", () => {
    localStorage.setItem("stundenapp_nachname", safeTrim(nachnameEl.value));
    updateMitarbeiterIdAnzeige();
  });

  // Default Datum/Monat/Jahr setzen
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  if (jahrEl && !jahrEl.value) jahrEl.value = yyyy;
  if (monatEl && typeof monatEl.selectedIndex === "number" && monatEl.selectedIndex < 0) {
    monatEl.selectedIndex = now.getMonth();
  } else if (monatEl) {
    // Wenn Monat noch leer/ungültig, setze auf aktuellen Index
    const idx = now.getMonth();
    if (!monatEl.value) monatEl.selectedIndex = idx;
  }

  if (datumEl && !datumEl.value) {
    datumEl.value = `${yyyy}-${mm}-${dd}`;
  }
  if (datumEl) ermittleWochentagName(datumEl.value);

  // Wochentag aktualisieren
  datumEl?.addEventListener("change", () => {
    ermittleWochentagName(datumEl.value);
  });

  // Monat/Jahr geändert -> Monatsdaten laden
  function onMonthOrYearChange() {
    loadMonth();
    showToast("Monatsdaten geladen.");
  }
  monatEl?.addEventListener("change", onMonthOrYearChange);
  jahrEl?.addEventListener("change", onMonthOrYearChange);

  // Initial month load
  loadMonth();

  // "Alles zurücksetzen" -> NUR Stammdaten löschen (Monatsdaten bleiben!)
  document.getElementById("btnResetAll")?.addEventListener("click", () => {
    appConfirm(
      "Möchtest du nur die Stammdaten (Vorname/Nachname/ID) zurücksetzen?",
      () => {
        localStorage.removeItem("stundenapp_vorname");
        localStorage.removeItem("stundenapp_nachname");
        localStorage.removeItem("stundenapp_empid");
        location.reload();
      }
    );
  });

  // PWA
  registerServiceWorker();
});

// Inline delete button needs global
window.eintragLoeschen = eintragLoeschen;












     





















