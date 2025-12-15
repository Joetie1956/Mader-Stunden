/// ===================== Helpers =====================

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

  if (!vEl || !nEl || !idEl) return; // falls ein Feld fehlt

  idEl.value = computeEmployeeId(vEl.value, nEl.value);
}


function formatNumberDE(value) {
  const num = typeof value === "number"
    ? value
    : parseFloat(String(value).replace(",", "."));
  if (isNaN(num)) return "0,00";
  return num.toFixed(2).replace(".", ",");
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function parsePauseToMinutes(pauseStr) {
  if (!pauseStr) return 0;
  const val = parseFloat(String(pauseStr).replace(",", "."));
  if (isNaN(val) || val < 0) return 0;
  return val * 60;
}

function overlapMinutes(aStart, aEnd, bStart, bEnd) {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

// ===================== Mitarbeiter-ID =====================
function updateMitarbeiterIdAnzeige() {
  const vorname = (document.getElementById("vorname")?.value || "").trim();
  const nachname = (document.getElementById("nachname")?.value || "").trim();

  let id = "";
  if (vorname && nachname) {
    id = vorname[0].toUpperCase() + nachname;
    id = id.replace(/[^a-zA-Z0-9ÄÖÜäöüß_-]/g, "");
  }

  const feld = document.getElementById("mitarbeiterIdAnzeige");
  if (feld) feld.value = id;
}

// ===================== Monatsdaten =====================
const eintraege = [];

function monthKey() {
  const monat = document.getElementById("monat").value;
  const jahr = document.getElementById("jahr").value;
  return `stundenapp_${jahr}_${monat}`;
}

function saveMonth() {
  localStorage.setItem(monthKey(), JSON.stringify(eintraege));
}

function loadMonth() {
  eintraege.length = 0;
  const raw = localStorage.getItem(monthKey());
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) arr.forEach(e => eintraege.push(e));
    } catch {}
  }
  aktualisiereTabelleUndSummen();
}

// ===================== Berechnung =====================
function berechne() {
  const datum = document.getElementById("datum").value;
  const ortAb = document.getElementById("ortAbfahrt").value.trim();
  const ortAn = document.getElementById("ortAnkunft").value.trim();
  const von = document.getElementById("vonZeit").value;
  const bis = document.getElementById("bisZeit").value;
  const pause = document.getElementById("pause").value;

  const stdF = document.getElementById("std");
  const weF = document.getElementById("weStd");
  const nachtF = document.getElementById("nachtStd");
  const spesenF = document.getElementById("spesen");

  const status = ["urlaub", "krank", "abbummeln"].includes(ortAb.toLowerCase());
  if (status) {
    stdF.value = weF.value = nachtF.value = "0,00";
    spesenF.value = "0,00 €";
    return;
  }

  const v = parseTimeToMinutes(von);
  let b = parseTimeToMinutes(bis);
  if (v === null || b === null) return alert("Zeitangaben prüfen");

  if (b <= v) b += 1440;

  let gesamt = b - v - parsePauseToMinutes(pause);
  gesamt = Math.max(0, gesamt);

  const std = gesamt / 60;
  stdF.value = formatNumberDE(std);

  const d = new Date(datum);
  weF.value = (d.getDay() === 0 || d.getDay() === 6) ? formatNumberDE(std) : "0,00";

  let nachtMin = 0;
  nachtMin += overlapMinutes(v, b, 22 * 60, 24 * 60);
  nachtMin += overlapMinutes(v, b, 0, 6 * 60);
  nachtMin += overlapMinutes(v, b, 24 * 60, 30 * 60);

  const nacht = nachtMin / 60;
  nachtF.value = nacht >= 2 ? formatNumberDE(nacht) : "0,00";

  const firma = ortAb.toLowerCase() === "firma" || ortAn.toLowerCase() === "firma";
  spesenF.value = firma ? "14,00 €" : "28,00 €";
}

// ===================== Einträge =====================
function eintragHinzufuegen() {
  berechne();

  const datum = document.getElementById("datum").value;
  if (!datum) return alert("Datum fehlt");

  const entry = {
    datum,
    ortAbfahrt: ortAbfahrt.value,
    ortAnkunft: ortAnkunft.value,
    von: vonZeit.value,
    bis: bisZeit.value,
    pause: pause.value,
    std: std.value,
    weStd: weStd.value,
    nachtStd: nachtStd.value,
    spesen: spesen.value
  };

  const idx = eintraege.findIndex(e => e.datum === datum);
  if (idx >= 0) eintraege[idx] = entry;
  else eintraege.push(entry);

  saveMonth();
  aktualisiereTabelleUndSummen();
}

// ===================== Tabelle =====================
function aktualisiereTabelleUndSummen() {
  const tbody = document.querySelector("#monatsTabelle tbody");
  tbody.innerHTML = "";

  let sStd = 0, sWe = 0, sNacht = 0, sSp = 0;

  eintraege.forEach((e, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
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
    `;
    tbody.appendChild(tr);

    sStd += parseFloat(e.std.replace(",", ".")) || 0;
    sWe += parseFloat(e.weStd.replace(",", ".")) || 0;
    sNacht += parseFloat(e.nachtStd.replace(",", ".")) || 0;
    sSp += parseFloat(e.spesen.replace("€", "").replace(",", ".")) || 0;
  });

  sumStd.textContent = formatNumberDE(sStd);
  sumWeStd.textContent = formatNumberDE(sWe);
  sumNachtStd.textContent = formatNumberDE(sNacht);
  sumSpesen.textContent = formatNumberDE(sSp);
}

// ===================== Init =====================

// ID sofort setzen (wenn Name gespeichert ist)
updateMitarbeiterIdAnzeige();

// live aktualisieren beim Tippen
document.getElementById("vorname")?.addEventListener("input", updateMitarbeiterIdAnzeige);
document.getElementById("nachname")?.addEventListener("input", updateMitarbeiterIdAnzeige);


document.addEventListener("DOMContentLoaded", () => {
  const vor = document.getElementById("vorname");
  const nach = document.getElementById("nachname");

  vor.value = localStorage.getItem("stundenapp_vorname") || "";
  nach.value = localStorage.getItem("stundenapp_nachname") || "";

  updateMitarbeiterIdAnzeige();

  vor.addEventListener("input", () => {
    localStorage.setItem("stundenapp_vorname", vor.value.trim());
    updateMitarbeiterIdAnzeige();
  });

  nach.addEventListener("input", () => {
    localStorage.setItem("stundenapp_nachname", nach.value.trim());
    updateMitarbeiterIdAnzeige();
  });

  loadMonth();

  btnBerechne.onclick = berechne;
  btnAdd.onclick = eintragHinzufuegen;
});













     




