/* =====================================================
   FINANZ-MANAGER – app.js
   Aufbau:
   1. Einstellungen & Listen
   2. Verbindung zum Script (Passwort)
   3. Kleine Helfer (Datum, Dropdown)
   4. Kontostände
   5. Analyse & Diagramme
   6. Buchen
   7. Start
   ===================================================== */


/* ---------- 1. EINSTELLUNGEN & LISTEN ---------- */

const GOOGLE_URL = "https://script.google.com/macros/s/AKfycbw4ak89SrPWn9uWLhhGDkieud8N_cGO7xeoTvDxwn7_fPTHSD6THuxaeInnfLTdf75arw/exec";

// Hier kannst du Einträge ergänzen oder löschen.
// Die alphabetische Sortierung passiert automatisch.
const ZWECKE = [
    "Gehalt Job Neustadt", "Greenpeace", "Internet WG", "Internet WG Janika", "Internet WG Jekabs",
    "Internet WG Sarah", "Internet WG Vanessa", "Internet WG Vincent", "Kindergeld",
    "Miete", "Netflix", "Netflix Miri", "Netflix Zuhause", "Rewe", "Spotify", "Spotify Zuhause"
];
const KATEGORIEN = [
    "Allgemein", "Abos", "Aktivismus", "Bank", "Essen", "Fortbewegung", "Freizeit", "Geschenk",
    "Großeltern", "Hygiene", "Job", "Spenden", "Staat", "Studium", "Style",
    "Technik", "Urlaub", "Wohnen", "Zuhause"
];

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

// Heutiges Datum in deiner Ortszeit (nicht UTC), daher auch nachts korrekt
function heute() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
let datumManuell = false; // wird true, sobald du das Datum selbst änderst

// Dropdown mit Freitext (Zweck & Kategorie)
function initCombo(wrapId, items) {
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
            div.addEventListener('click', () => { input.value = i; close(); });
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


/* ---------- 5. ANALYSE & DIAGRAMME ---------- */

let chartAus = null;
let chartEin = null;
let analyseDaten = null;
let analyseZeit = 0;

async function holeAnalyse() {
    const d = await api('analyse');
    analyseDaten = d;
    analyseZeit = Date.now();
    return d;
}

async function ladeAnalyse() {
    setStatus("Analyse wird berechnet...");
    try {
        zeigeAnalyse(await holeAnalyse());
    } catch (e) {
        setStatus("Fehler: " + e.message);
        console.error("Analyse Fehler:", e);
    }
}

function tabellenZelle(tr, text, klasse) {
    const td = document.createElement('td');
    td.textContent = text;
    if (klasse) td.className = klasse;
    tr.appendChild(td);
}

function zeigeAnalyse(d) {
    const f2 = (v) => Number(v || 0).toFixed(2);

    // Kopf: Monatsbilanz
    document.getElementById('anzeige-monat').innerText = d.monat + " " + d.jahr;
    document.getElementById('ana-bilanz').innerText = f2(d.bilanz) + " €";
    document.getElementById('ana-bilanz').style.color = d.bilanz >= 0 ? "var(--success)" : "var(--danger)";

    // Budget-Balken
    const nettoGesamt = parseFloat(d.nettoGesamt) || 0;
    const prozent = d.budgetMonat > 0 ? Math.min((nettoGesamt / d.budgetMonat) * 100, 100) : 0;
    const bar = document.getElementById('ana-budget-bar');
    bar.style.width = Math.max(0, prozent) + "%";
    bar.style.backgroundColor = prozent < 80 ? "var(--success)" : "var(--danger)";
    document.getElementById('ana-budget-text').innerText = Math.round(nettoGesamt) + " / " + d.budgetMonat + " €";

    // Netto-Kacheln
    const kacheln = {
        'ana-abos': d.nettoAbos, 'ana-wohnen': d.nettoWohnen,
        'ana-mobil': d.nettoMobil, 'ana-bank': d.nettoBank,
        'ana-essen': d.nettoEssen, 'ana-allg': d.nettoAllgemein
    };
    for (const id in kacheln) {
        document.getElementById(id).innerText = f2(kacheln[id]);
    }

    // Jahrestabelle
    const tbody = document.getElementById('jahres-tabelle-body');
    tbody.innerHTML = "";
    (d.jahresUebersicht || []).forEach(m => {
        if (!m.monat || m.monat.toString().trim() === "") return;

        const aus = parseFloat(m.ausgaben) || 0;
        const ein = parseFloat(m.einnahmen) || 0;
        const bil = parseFloat(m.bilanz) || 0;
        const bilanzKlasse = bil >= 1 ? 'positiv' : (bil <= -1 ? 'negativ' : '');
        const einKlasse = ein >= 1 ? 'positiv' : '';

        const tr = document.createElement('tr');
        tabellenZelle(tr, m.monat, 'td-monat');
        tabellenZelle(tr, aus.toFixed(2) + " €", 'td-val');
        tabellenZelle(tr, ein.toFixed(2) + " €", 'td-val ' + einKlasse);
        tabellenZelle(tr, bil.toFixed(2) + " €", 'td-val ' + bilanzKlasse);
        tbody.appendChild(tr);
    });

    // Bafög
    if (d.bafoeg) {
        document.getElementById('b-zahlung').innerText = Number(d.bafoeg.zahlung || 0).toLocaleString() + " €";
        document.getElementById('b-darlehen').innerText = Number(d.bafoeg.darlehen || 0).toLocaleString() + " €";
        document.getElementById('b-rueck').innerText = Number(d.bafoeg.rueckzahlung || 0).toLocaleString() + " €";
    }

    renderCharts(d);

    // Hinweis, falls im Sheet Spaltennamen fehlen oder umbenannt wurden
    setStatus(
        (d.fehlendeSpalten && d.fehlendeSpalten.length)
            ? "Hinweis: Diese Spalten fehlen in Zeile 7: " + d.fehlendeSpalten.join(", ")
            : ""
    );
}

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

function renderCharts(d) {
    chartAus = donut('chartAusgaben', chartAus, filterData(
        AUS_LABELS,
        [d.aus_Allg, d.aus_Essen, d.aus_Freizeit, d.aus_Hygiene, d.aus_Spenden, d.aus_Style, d.aus_Technik, d.aus_Wohnen, d.aus_Abos, d.aus_Mobil, d.aus_Geschenk, d.aus_Aktivismus, d.aus_Urlaub, d.aus_Studium, d.aus_Bank],
        AUS_FARBEN
    ));
    chartEin = donut('chartEinnahmen', chartEin, filterData(
        EIN_LABELS,
        [d.einJob, d.einAllg, d.einZuhause, d.einStaat, d.einTrinkgeld, d.einBank, d.einOma, d.einAbos, d.einWohnen, d.einMobil].map(v => v || 0),
        EIN_FARBEN
    ));
}


/* ---------- 6. BUCHEN ---------- */

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


/* ---------- 7. START ---------- */

window.onload = () => {
    const datumEl = document.getElementById('datum');
    datumEl.value = heute();
    datumEl.addEventListener('change', () => { datumManuell = true; });

    // App über Nacht offen gelassen und Datum nicht selbst geändert: auf heute setzen
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && !datumManuell) datumEl.value = heute();
    });

    initCombo('combo-zweck', ZWECKE);
    initCombo('combo-kategorie', KATEGORIEN);

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
