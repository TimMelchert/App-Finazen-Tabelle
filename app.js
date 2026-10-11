/* =====================================================
   FINANZ-MANAGER – app.js
   Aufbau:
   1. Einstellungen & Listen
   2. Verbindung zum Script (Passwort)
   3. Kleine Helfer (Datum, Dropdown, Zweck-Verknüpfung)
   4. Kontostände
   5. Analyse (Monatsauswahl, Kacheln, Haken)
   6. Diagramme
   7. Buchen
   8. Start
   ===================================================== */


/* ---------- 1. EINSTELLUNGEN & LISTEN ---------- */

const GOOGLE_URL = "https://script.google.com/macros/s/AKfycbw4ak89SrPWn9uWLhhGDkieud8N_cGO7xeoTvDxwn7_fPTHSD6THuxaeInnfLTdf75arw/exec";

// ZWECKE: Beim Auswählen eines Zwecks werden Kategorie und (falls eingetragen) Betrag automatisch gesetzt.
// Betrag eintragen z. B.  betrag: 13.99   (Punkt statt Komma!)   –   leer lassen:  betrag: null
// Neue Zwecke einfach als neue Zeile ergänzen, die Sortierung passiert automatisch.
const ZWECK_INFO = {
    "Gehalt Job Neustadt": { kategorie: "Job",     betrag: 979.97 },
    "Greenpeace":          { kategorie: "Spenden", betrag: 3.33 },
    "Internet WG":         { kategorie: "Wohnen",  betrag: 23,98 },
    "Internet WG Janika":  { kategorie: "Wohnen",  betrag: 4 },
    "Internet WG Jekabs":  { kategorie: "Wohnen",  betrag: 4 },
    "Internet WG Sarah":   { kategorie: "Wohnen",  betrag: 4 },
    "Internet WG Vanessa": { kategorie: "Wohnen",  betrag: 4 },
    "Internet WG Vincent": { kategorie: "Wohnen",  betrag: 4 },
    "Kindergeld":          { kategorie: "Staat",   betrag: 259 },
    "Miete":               { kategorie: "Wohnen",  betrag: 450 },
    "Netflix":             { kategorie: "Abos",    betrag: 21.99 },
    "Netflix Jonathan":    { kategorie: "Abos",    betrag: null },
    "Netflix Miri":        { kategorie: "Abos",    betrag: null },
    "Netflix Zuhause":     { kategorie: "Abos",    betrag: null },
    "Rewe":                { kategorie: "Essen",   betrag: null },
    "Spotify":             { kategorie: "Abos",    betrag: 17.99 },
    "Spotify Zuhause":     { kategorie: "Abos",    betrag: 12 }
};
const ZWECKE = Object.keys(ZWECK_INFO);

const KATEGORIEN = [
    "Allgemein", "Abos", "Aktivismus", "Bank", "Essen", "Fortbewegung", "Freizeit", "Geschenk",
    "Großeltern", "Hygiene", "Job", "Spenden", "Staat", "Studium", "Style",
    "Technik", "Urlaub", "Wohnen", "Zuhause"
];

// RÜCKZAHLUNGEN: Wer zahlt dir etwas zurück? Ein Haken erscheint, sobald im gewählten Monat im Blatt "Konto"
// eine Einnahme mit genau diesem Zweck und der Kategorie (Abos bzw. Wohnen) steht.
// eigenerAnteil = dein fester Anteil in € (wird vom Rest abgezogen).
const RUECKZAHLUNG = {
    Abos: {
        eigenerAnteil: 0,
        personen: [
            { name: "Miri",       zweck: "Netflix Miri" },
            { name: "Jonathan",   zweck: "Netflix Jonathan" },
            { name: "N. Zuhause", zweck: "Netflix Zuhause" },
            { name: "S. Zuhause", zweck: "Spotify Zuhause" }
        ]
    },
    Wohnen: {
        eigenerAnteil: 0,
        personen: [
            { name: "Sarah",   zweck: "Internet WG Sarah" },
            { name: "Jekabs",  zweck: "Internet WG Jekabs" },
            { name: "Vanessa", zweck: "Internet WG Vanessa" },
            { name: "Vincent", zweck: "Internet WG Vincent" },
            { name: "Janika",  zweck: "Internet WG Janika" }
        ]
    }
};

const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

// Bezeichnungen und Farben der Diagramme (Reihenfolge = Reihenfolge der Daten)
const AUS_LABELS = ['Allg.', 'Essen', 'Freizeit', 'Hyg.', 'Spend.', 'Style', 'Tech.', 'Wohnen', 'Abos', 'Mobil', 'Geschenk', 'Aktiv.', 'Urlaub', 'Studium', 'Bank'];
const AUS_FARBEN = ['#34495e', '#27ae60', '#f1c40f', '#e67e22', '#e74c3c', '#9b59b6', '#1abc9c', '#d35400', '#2980b9', '#8e44ad', '#2c3e50', '#c0392b', '#16a085', '#273c75', '#95a5a6'];
const EIN_LABELS = ['Job', 'Allg.', 'Zuhause', 'Staat', 'Tip', 'Bank', 'Oma', 'Abos', 'Wohnen', 'Mobil'];
const EIN_FARBEN = ['#27ae60', '#2ecc71', '#1abc9c', '#16a085', '#f1c40f', '#34495e', '#e67e22', '#2980b9', '#d35400', '#8e44ad'];


/* ---------- 2. VERBINDUNG ZUM SCRIPT ---------- */

let userPin = localStorage.getItem('finanz_pin') || prompt("Passwort:") || "";

// Zentrale Anfrage an das Script (alles per POST, Passwort nie in der URL)
async function api(action, extra = {}, erneut = true) {
    const response = await fetch(GOOGLE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...extra, pin: userPin, action })
    });
    const d = await response.json();

    if (d.error === 'pin') {
        localStorage.removeItem('finanz_pin');
        if (!erneut) throw new Error('Passwort falsch');
        const neu = prompt("Passwort falsch. Bitte erneut eingeben:");
        if (!neu) throw new Error('Kein Passwort eingegeben');
        userPin = neu;
        return api(action, extra, false);
    }
    if (d.error) throw new Error(d.message || d.error);

    localStorage.setItem('finanz_pin', userPin); // erst nach Erfolg merken
    return d;
}

function setStatus(text) {
    document.getElementById('status').innerText = text;
}


/* ---------- 3. KLEINE HELFER ---------- */

const norm = (s) => String(s == null ? '' : s).trim().toLowerCase();

// Nummer des Monats (1-12) aus dem Namen, 0 wenn unbekannt
function monatNr(name) {
    const n = norm(name).slice(0, 3);
    if (!n) return 0;
    return MONATE.findIndex(m => m.toLowerCase().slice(0, 3) === n) + 1;
}

// Heutiges Datum in deiner Ortszeit (nicht UTC), daher auch nachts korrekt
function heute() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
let datumManuell = false; // wird true, sobald du das Datum selbst änderst

// Dropdown mit Freitext (Zweck & Kategorie). onWahl wird aufgerufen, wenn ein Eintrag gewählt wurde.
function initCombo(wrapId, items, onWahl) {
    const wrap = document.getElementById(wrapId);
    const input = wrap.querySelector('input');
    const btn = wrap.querySelector('.combo-btn');
    const list = wrap.querySelector('.combo-list');
    const sortiert = [...items].sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));
    const istPC = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    function close() { list.classList.remove('open'); }

    function open(filter) {
        const f = (filter || '').toLowerCase();
        const treffer = f ? sortiert.filter(i => i.toLowerCase().includes(f)) : sortiert;
        list.innerHTML = '';
        treffer.forEach(i => {
            const div = document.createElement('div');
            div.className = 'combo-item';
            div.textContent = i;
            div.addEventListener('click', () => {
                input.value = i;
                close();
                if (onWahl) onWahl(i);
            });
            list.appendChild(div);
        });
        if (treffer.length > 0) list.classList.add('open'); else close();
    }

    input.addEventListener('input', () => open(input.value));
    input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') close();
        if (ev.key === 'ArrowDown') open(input.value);
    });
    // Am PC öffnet ein Klick irgendwo ins Feld die Liste (am Handy nur der Pfeil)
    if (istPC) {
        input.addEventListener('click', () => { if (!list.classList.contains('open')) open(''); });
    }
    btn.addEventListener('click', () => { list.classList.contains('open') ? close() : open(''); });
    document.addEventListener('click', (ev) => { if (!wrap.contains(ev.target)) close(); });
}

// Zweck gewählt: Kategorie und Betrag automatisch eintragen.
// ueberschreiben = true (Auswahl aus der Liste): vorhandene Werte werden ersetzt.
// ueberschreiben = false (Tippen): nur leere Felder werden gefüllt.
function zweckAnwenden(zweck, ueberschreiben) {
    const key = ZWECKE.find(z => norm(z) === norm(zweck));
    if (!key) return;
    const info = ZWECK_INFO[key];
    const katEl = document.getElementById('kategorie');
    const betEl = document.getElementById('betrag');
    if (info.kategorie && (ueberschreiben || katEl.value.trim() === "")) katEl.value = info.kategorie;
    if (info.betrag != null && (ueberschreiben || betEl.value === "")) betEl.value = info.betrag;
}

function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    document.getElementById('btn-tab-' + tab).classList.add('active');

    if (tab === 'analyse') {
        if (analyseDaten) {
            zeigeAnalyse(analyseDaten);
            if (Date.now() - analyseZeit > 60000) ladeAnalyse(); // älter als 1 Minute: auffrischen
        } else {
            ladeAnalyse();
        }
    }
}


/* ---------- 4. KONTOSTÄNDE ---------- */

function zeigeStats(s) {
    const f = (v) => Number(v || 0).toFixed(2);
    document.getElementById('val-gesamt').innerText = f(s.gesamt) + " €";
    document.getElementById('val-konto').innerText = f(s.konto);
    document.getElementById('val-paypal').innerText = f(s.paypal);
    document.getElementById('val-kreditkarte').innerText = f(s.kreditkarte);
    document.getElementById('val-portemonnaie').innerText = f(s.portemonnaie);
    document.getElementById('val-muenzglas').innerText = f(s.muenzglas);
    document.getElementById('val-pfandbons').innerText = f(s.pfandbons);
    document.getElementById('val-gesamt').style.color = Number(s.gesamt) >= 0 ? "#27ae60" : "#e74c3c";
    try { localStorage.setItem('finanz_stats', JSON.stringify(s)); } catch (e) {}
}

async function loadStats(mitAnalyseVorladen = false) {
    setStatus("Aktualisiere Kontostände...");
    try {
        const s = await api('stats');
        zeigeStats(s);
        setStatus("");
        // Analyse im Hintergrund vorladen, damit der Tab später sofort da ist
        if (mitAnalyseVorladen) holeAnalyse().catch(() => {});
    } catch (e) {
        setStatus("Fehler: " + e.message);
    }
}


/* ---------- 5. ANALYSE ---------- */

let chartAus = null;
let chartEin = null;
let chartBalken = null;
let analyseDaten = null;
let analyseZeit = 0;
let analyseWahl = null;   // gewählter Monat, z. B. "M|2026|Oktober" oder "J|2026" (Ganzes Jahr)

async function holeAnalyse() {
    const d = await api('analyse');
    analyseDaten = d;
    analyseZeit = Date.now();
    return d;
}

async function ladeAnalyse() {
    setStatus("Analyse wird berechnet...");
    try {
        const d = await holeAnalyse();
        if (document.getElementById('tab-analyse').classList.contains('active')) zeigeAnalyse(d);
        else setStatus("");
    } catch (e) {
        setStatus("Fehler: " + e.message);
        console.error("Analyse Fehler:", e);
    }
}

function auswahlKey(m) { return "M|" + m.jahr + "|" + m.monat; }

// Die Werte für die aktuelle Auswahl: ein Monat oder die Summe eines Jahres
function werteFuerAuswahl(d, wahl) {
    const monate = d.monate || [];

    if (wahl && wahl.startsWith("J|")) {
        const jahr = Number(wahl.slice(2));
        const liste = monate.filter(m => m.jahr === jahr);
        if (liste.length) {
            const summe = { jahr: jahr, monat: "Ganzes Jahr", istJahr: true };
            liste.forEach(m => {
                Object.keys(m).forEach(k => {
                    if (typeof m[k] === 'number' && k !== 'jahr') summe[k] = (summe[k] || 0) + m[k];
                });
            });
            return summe;
        }
    }
    return monate.find(m => auswahlKey(m) === wahl) || d;  // sonst: aktueller Monat
}

// Baut die Auswahlliste (Jahr → Monate) und wählt standardmäßig den aktuellen Monat
function baueAuswahl(d) {
    const sel = document.getElementById('monat-wahl');
    const aktJahr = Number(d.jahr) || 0;
    const istAktuell = (m) => Number(m.jahr) === aktJahr && norm(m.monat) === norm(d.monat);
    const sichtbar = (d.monate || []).filter(m => istAktuell(m) || Math.abs(m.ausgabenGesamt) + Math.abs(m.einnahmenGesamt) > 0.005);
    const jahre = [...new Set(sichtbar.map(m => m.jahr))].sort((a, b) => b - a);

    sel.innerHTML = '';
    jahre.forEach(j => {
        const gruppe = document.createElement('optgroup');
        gruppe.label = String(j);
        gruppe.appendChild(new Option('Ganzes Jahr ' + j, 'J|' + j));
        sichtbar.filter(m => m.jahr === j)
            .sort((a, b) => monatNr(b.monat) - monatNr(a.monat))
            .forEach(m => {
                gruppe.appendChild(new Option(m.monat + ' ' + j + (istAktuell(m) ? ' (aktuell)' : ''), auswahlKey(m)));
            });
        sel.appendChild(gruppe);
    });

    const keys = Array.from(sel.options).map(o => o.value);
    const aktuellKey = (d.monate || []).filter(istAktuell).map(auswahlKey)[0];
    if (!keys.includes(analyseWahl)) analyseWahl = aktuellKey || keys[0] || null;
    if (analyseWahl) sel.value = analyseWahl;
}

function zeigeAnalyse(d) {
    baueAuswahl(d);
    renderAnalyse(d);
}

function tabellenZelle(tr, text, klasse) {
    const td = document.createElement('td');
    td.textContent = text;
    if (klasse) td.className = klasse;
    tr.appendChild(td);
}

// Rechnet für Abos/Wohnen den Rest aus und wer schon gezahlt hat.
// Rest = Netto minus dein fester Anteil (0, wenn alle gezahlt haben).
function berechneHaken(kat, netto, jahr, monat, rueckzahlungen) {
    const cfg = RUECKZAHLUNG[kat];
    const monatsDaten = (rueckzahlungen || {})[jahr + "-" + monatNr(monat)] || {};
    const personen = cfg.personen.map(p => {
        const betrag = monatsDaten[norm(p.zweck) + "|" + norm(kat)] || 0;
        return { name: p.name, betrag: betrag, bezahlt: betrag > 0 };
    });
    const eigen = Number(cfg.eigenerAnteil) || 0;
    const betragNetto = Math.abs(netto);
    let rest = Math.round(Math.max(0, betragNetto - eigen) * 100) / 100;
    if (netto < 0) rest = -rest;
    return { rest: rest || 0, personen: personen, eigen: eigen, alleBezahlt: personen.every(p => p.bezahlt) };
}

function haekchenZeile(liste, name, ok, betrag) {
    const zeile = document.createElement('div');
    zeile.className = 'haken-zeile' + (ok ? ' ok' : '');
    const box = document.createElement('span');
    box.className = 'haken-box';
    const n = document.createElement('span');
    n.className = 'haken-name';
    n.textContent = name;
    zeile.appendChild(box);
    zeile.appendChild(n);
    if (betrag != null) {
        const b = document.createElement('span');
        b.className = 'haken-betrag';
        b.textContent = Number(betrag).toFixed(2);
        zeile.appendChild(b);
    }
    liste.appendChild(zeile);
}

// Kachel Abos bzw. Wohnen mit Haken
function zeigeKachel(kat, w, d) {
    const abos = kat === 'Abos';
    const netto = Number(abos ? w.nettoAbos : w.nettoWohnen) || 0;
    const wertEl = document.getElementById(abos ? 'ana-abos' : 'ana-wohnen');
    const liste = document.getElementById(abos ? 'haken-abos' : 'haken-wohnen');
    const kachel = wertEl.closest('.netto-stat');

    liste.innerHTML = '';
    kachel.classList.remove('erledigt');

    if (w.istJahr) {                       // Ganzes Jahr: nur die Summe, keine Haken
        wertEl.innerText = netto.toFixed(2);
        return;
    }
    const h = berechneHaken(kat, netto, Number(w.jahr), w.monat, d.rueckzahlungen);
    wertEl.innerText = h.rest.toFixed(2);
    h.personen.forEach(p => haekchenZeile(liste, p.name, p.bezahlt, p.bezahlt ? p.betrag : null));
    if (h.eigen > 0) haekchenZeile(liste, 'Ich', true, h.eigen);
    if (h.rest === 0 && h.alleBezahlt) kachel.classList.add('erledigt');
}

function renderAnalyse(d) {
    const w = werteFuerAuswahl(d, analyseWahl);
    const f2 = (v) => Number(v || 0).toFixed(2);

    // Kopf: Monatsbilanz
    document.getElementById('anzeige-monat').innerText = w.istJahr ? ("Ganzes Jahr " + w.jahr) : (w.monat + " " + w.jahr);
    document.getElementById('ana-bilanz').innerText = f2(w.bilanz) + " €";
    document.getElementById('ana-bilanz').style.color = w.bilanz >= 0 ? "var(--success)" : "var(--danger)";

    // Budget-Balken
    const nettoGesamt = parseFloat(w.nettoGesamt) || 0;
    const budget = Number(w.budgetMonat) || 0;
    const prozent = budget > 0 ? Math.min((nettoGesamt / budget) * 100, 100) : 0;
    const bar = document.getElementById('ana-budget-bar');
    bar.style.width = Math.max(0, prozent) + "%";
    bar.style.backgroundColor = prozent < 80 ? "var(--success)" : "var(--danger)";
    document.getElementById('ana-budget-label').innerText = w.istJahr ? "Budget (Summe Jahr)" : "Monatsbudget";
    document.getElementById('ana-budget-text').innerText = Math.round(nettoGesamt) + " / " + Math.round(budget) + " €";

    // Kacheln
    zeigeKachel('Abos', w, d);
    zeigeKachel('Wohnen', w, d);
    const kacheln = { 'ana-mobil': w.nettoMobil, 'ana-bank': w.nettoBank, 'ana-essen': w.nettoEssen, 'ana-allg': w.nettoAllgemein };
    for (const id in kacheln) document.getElementById(id).innerText = f2(kacheln[id]);

    // Jahrestabelle (Tipp auf einen Monat wählt ihn aus)
    const tbody = document.getElementById('jahres-tabelle-body');
    tbody.innerHTML = "";
    (d.jahresUebersicht || []).forEach(m => {
        if (!m.monat || m.monat.toString().trim() === "") return;

        const aus = parseFloat(m.ausgaben) || 0;
        const ein = parseFloat(m.einnahmen) || 0;
        const bil = parseFloat(m.bilanz) || 0;
        const bilanzKlasse = bil >= 1 ? 'positiv' : (bil <= -1 ? 'negativ' : '');
        const einKlasse = ein >= 1 ? 'positiv' : '';
        const key = auswahlKey({ jahr: d.tabellenJahr, monat: m.monat });

        const tr = document.createElement('tr');
        tabellenZelle(tr, m.monat, 'td-monat');
        tabellenZelle(tr, aus.toFixed(2) + " €", 'td-val');
        tabellenZelle(tr, ein.toFixed(2) + " €", 'td-val ' + einKlasse);
        tabellenZelle(tr, bil.toFixed(2) + " €", 'td-val ' + bilanzKlasse);

        const sel = document.getElementById('monat-wahl');
        if (Array.from(sel.options).some(o => o.value === key)) {
            tr.classList.add('klickbar');
            if (key === analyseWahl) tr.classList.add('gewaehlt');
            tr.addEventListener('click', () => {
                analyseWahl = key;
                sel.value = key;
                renderAnalyse(d);
            });
        }
        tbody.appendChild(tr);
    });

    // Bafög (unabhängig von der Monatsauswahl)
    if (d.bafoeg) {
        document.getElementById('b-zahlung').innerText = Number(d.bafoeg.zahlung || 0).toLocaleString() + " €";
        document.getElementById('b-darlehen').innerText = Number(d.bafoeg.darlehen || 0).toLocaleString() + " €";
        document.getElementById('b-rueck').innerText = Number(d.bafoeg.rueckzahlung || 0).toLocaleString() + " €";
    }

    renderCharts(w);

    // Hinweis, falls im Sheet Spaltennamen fehlen oder umbenannt wurden
    setStatus(
        (d.fehlendeSpalten && d.fehlendeSpalten.length)
            ? "Hinweis: Diese Spalten fehlen in Zeile 7: " + d.fehlendeSpalten.join(", ")
            : ""
    );
}


/* ---------- 6. DIAGRAMME ---------- */

// Lässt Werte nahe 0 weg und macht aus allen Beträgen positive Zahlen
function filterData(labels, values, colors) {
    const fL = [], fV = [], fC = [];
    values.forEach((v, i) => {
        if (Math.abs(v) > 0.1) { fL.push(labels[i]); fV.push(Math.abs(v)); fC.push(colors[i]); }
    });
    return { labels: fL, values: fV, colors: fC };
}

function donut(canvasId, alt, daten) {
    if (alt) alt.destroy();
    return new Chart(document.getElementById(canvasId), {
        type: 'doughnut',
        data: { labels: daten.labels, datasets: [{ data: daten.values, backgroundColor: daten.colors, borderWidth: 1 }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 8, font: { size: 9 }, padding: 10 } } },
            cutout: '65%'
        }
    });
}

// Säulen pro Ausgaben-Kategorie (Abos, Wohnen, Allgemein, Fortbewegung, Bank, Essen netto, der Rest brutto)
// mit waagerechter Linie auf Höhe des Budgets
function balken(alt, daten, budget) {
    if (alt) alt.destroy();
    const mitBudget = budget > 0;
    const datasets = [{
        type: 'bar', label: 'Ausgaben', data: daten.values, backgroundColor: daten.colors, borderWidth: 0
    }];
    if (mitBudget) {
        datasets.push({
            type: 'line', label: 'Budget', data: daten.labels.map(() => budget),
            borderColor: '#e74c3c', borderDash: [6, 4], borderWidth: 2, pointRadius: 0, fill: false
        });
    }
    return new Chart(document.getElementById('chartBalken'), {
        data: { labels: daten.labels, datasets: datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { font: { size: 9 }, maxRotation: 60 }, grid: { display: false } },
                y: { beginAtZero: true, ticks: { font: { size: 9 } } }
            }
        }
    });
}

function renderCharts(w) {
    chartAus = donut('chartAusgaben', chartAus, filterData(
        AUS_LABELS,
        [w.aus_Allg, w.aus_Essen, w.aus_Freizeit, w.aus_Hygiene, w.aus_Spenden, w.aus_Style, w.aus_Technik, w.aus_Wohnen, w.aus_Abos, w.aus_Mobil, w.aus_Geschenk, w.aus_Aktivismus, w.aus_Urlaub, w.aus_Studium, w.aus_Bank],
        AUS_FARBEN
    ));
    chartEin = donut('chartEinnahmen', chartEin, filterData(
        EIN_LABELS,
        [w.einJob, w.einAllg, w.einZuhause, w.einStaat, w.einTrinkgeld, w.einBank, w.einOma, w.einAbos, w.einWohnen, w.einMobil].map(v => v || 0),
        EIN_FARBEN
    ));

    const budget = Number(w.budgetMonat) || 0;
    chartBalken = balken(chartBalken, filterData(
        AUS_LABELS,
        [w.nettoAllgemein, w.nettoEssen, w.aus_Freizeit, w.aus_Hygiene, w.aus_Spenden, w.aus_Style, w.aus_Technik, w.nettoWohnen, w.nettoAbos, w.nettoMobil, w.aus_Geschenk, w.aus_Aktivismus, w.aus_Urlaub, w.aus_Studium, w.nettoBank].map(v => v || 0),
        AUS_FARBEN
    ), budget);
    document.getElementById('balken-hinweis').innerText = budget > 0
        ? "Gestrichelte Linie = Budget (" + Math.round(budget) + " €)"
        : "Kein Budget eingetragen (Spalte Budget-Monat)";
}


/* ---------- 7. BUCHEN ---------- */

let sendet = false; // verhindert Doppelbuchungen durch mehrfaches Tippen

function sperreButtons(sperren) {
    document.querySelectorAll('.btn-aus, .btn-ein, .btn-umb').forEach(b => { b.disabled = sperren; });
}

async function senden(typ) {
    if (sendet) return;

    const overlay = document.getElementById('success-overlay');
    const betragField = document.getElementById('betrag');
    const zweckField = document.getElementById('zweck');

    const data = {
        reiter: document.getElementById('reiter').value,
        ziel: document.getElementById('ziel_reiter').value,
        betrag: parseFloat(betragField.value),
        zweck: zweckField.value.trim() || "Transfer",
        kategorie: document.getElementById('kategorie').value.trim() || "Allgemein",
        datum: document.getElementById('datum').value,
        split: document.getElementById('split').checked,
        mode: typ
    };

    if (isNaN(data.betrag) || data.betrag <= 0) return alert("Bitte einen Betrag größer 0 eingeben!");
    if (typ === 'umbuchung' && data.reiter === data.ziel) return alert("Quelle und Ziel sind gleich!");

    sendet = true;
    sperreButtons(true);
    setStatus("Speichere...");

    try {
        const s = await api('buchen', data);
        zeigeStats(s); // das Script liefert die neuen Stände gleich mit

        // Felder leeren, das Datum bleibt wie eingestellt
        betragField.value = "";
        zweckField.value = "";
        document.getElementById('kategorie').value = "";
        document.getElementById('split').checked = false;
        setStatus("");
        analyseZeit = 0; // Analyse beim nächsten Öffnen neu laden

        overlay.style.display = 'flex';
        setTimeout(() => {
            overlay.style.display = 'none';
            if (document.getElementById('tab-analyse').classList.contains('active')) ladeAnalyse();
        }, 1200);
    } catch (e) {
        alert("NICHT gespeichert: " + e.message);
        setStatus("");
    } finally {
        sendet = false;
        sperreButtons(false);
    }
}


/* ---------- 8. START ---------- */

window.onload = () => {
    const datumEl = document.getElementById('datum');
    datumEl.value = heute();
    datumEl.addEventListener('change', () => { datumManuell = true; });

    // App über Nacht offen gelassen und Datum nicht selbst geändert: auf heute setzen
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && !datumManuell) datumEl.value = heute();
    });

    initCombo('combo-zweck', ZWECKE, (z) => zweckAnwenden(z, true));
    initCombo('combo-kategorie', KATEGORIEN);
    // Zweck von Hand eingetippt: leere Felder (Kategorie, Betrag) trotzdem füllen
    document.getElementById('zweck').addEventListener('change', (ev) => zweckAnwenden(ev.target.value, false));

    // Monatsauswahl im Analyse-Tab
    document.getElementById('monat-wahl').addEventListener('change', (ev) => {
        analyseWahl = ev.target.value;
        if (analyseDaten) renderAnalyse(analyseDaten);
    });

    // Zuletzt bekannte Stände sofort zeigen, solange die frischen laden
    try {
        const alt = localStorage.getItem('finanz_stats');
        if (alt) zeigeStats(JSON.parse(alt));
    } catch (e) {}

    loadStats(true);
};

// Service Worker anmelden (macht die Seite zur echten PWA)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service Worker:', e));
    });
}
