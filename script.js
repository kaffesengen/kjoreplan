// ==========================================
// 1. LIM INN FIREBASE CONFIG HER (FRA GOOGLE)
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyAHWKMFrjLO0golIkfpdfbEyL8FxWuivbA",
    authDomain: "bryllup2026-3d2c1.firebaseapp.com",
    databaseURL: "https://bryllup2026-3d2c1-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "bryllup2026-3d2c1",
    storageBucket: "bryllup2026-3d2c1.firebasestorage.app",
    messagingSenderId: "843855995608",
    appId: "1:843855995608:web:21f2ab82e95e86bce36dad"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ==========================================
// CONFIG & DOM
// ==========================================
const USER = "admin";
const PASS = "Brunstad2020";

const loginOverlay = document.getElementById('login-overlay');
const appContainer = document.getElementById('app-container');
const container = document.getElementById('schedule-container');
const clockEl = document.getElementById('clock');
const errorMsg = document.getElementById('error-msg');
const viewBtn = document.getElementById('view-btn');

let scheduleData = [];
let dbState = {}; // Her lagrer vi data fra Firebase (live)
let wakeLock = null;
const modes = ['auto', 'phone', 'tablet', 'desktop'];
let currentModeIndex = 0;

// ==========================================
// AUTH & INIT
// ==========================================
function attemptLogin() {
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    if (u.toLowerCase() === USER.toLowerCase() && p === PASS) {
        loginOverlay.style.display = 'none';
        initApp();
        requestWakeLock();
    } else {
        errorMsg.innerText = "ACCESS DENIED";
        setTimeout(() => errorMsg.innerText = "", 2000);
    }
}
document.getElementById('password').addEventListener('keyup', (e) => { if(e.key==='Enter') attemptLogin() });

async function initApp() {
    try {
        // 1. Hent den statiske listen (tekster, tider)
        const response = await fetch('data.json');
        scheduleData = await response.json();

        // 2. Koble på Firebase lytter (Real-time!)
        // Hver gang noen endrer noe i databasen, kjøres denne koden:
        db.ref('status').on('value', (snapshot) => {
            dbState = snapshot.val() || {};
            // Vi rendrer på nytt når data endres
            renderSchedule(); 
        });

        // Start klokke
        setInterval(updateClock, 1000);
        updateClock();

    } catch (e) {
        console.error(e);
        container.innerHTML = "<div style='color:red; padding:20px; text-align:center;'>Error loading data</div>";
    }
}

// ==========================================
// RENDER (Tegner listen)
// ==========================================
function renderSchedule() {
    // Husk posisjon så vi ikke hopper til toppen ved oppdatering
    const scrollPos = container.scrollTop;

    // Tøm container, men ikke hvis vi driver og skriver akkurat nå (litt hacky, men ok for i dag)
    // Enklere løsning: Vi tegner alt på nytt, men mister fokus hvis vi skriver.
    // Siden "blur" lagrer, går det fint.
    
    container.innerHTML = '';

    scheduleData.forEach((item) => {
        if (item.type === 'header') {
            const div = document.createElement('div');
            div.className = `section-header ${item.class || ''}`;
            div.innerHTML = `<span>${item.start.substr(0,5)}</span> ${item.title}`;
            container.appendChild(div);
        } else {
            // Hent live data fra dbState, eller bruk default fra JSON
            const liveItem = dbState[item.id] || {};
            
            const isDone = liveItem.done ? 'done' : '';
            const avText = liveItem.av !== undefined ? liveItem.av : (item.av || '');
            const noteText = liveItem.note !== undefined ? liveItem.note : (item.note || '');

            const start = parseTime(item.start);
            const durSec = parseDuration(item.dur);
            const end = new Date(start.getTime() + durSec * 1000);

            const wrapper = document.createElement('div');
            wrapper.className = `row-wrapper ${isDone}`;
            wrapper.id = 'wrapper-' + item.id;
            wrapper.dataset.startObj = start.toISOString();
            wrapper.dataset.endObj = end.toISOString();

            wrapper.innerHTML = `
                <div class="row-main">
                    <div class="col" onclick="toggleDone(${item.id}, ${!liveItem.done})">
                        <div class="btn-check" id="btn-${item.id}">${isDone ? 'OFF' : 'ON'}</div>
                    </div>
                    <div class="col time">${item.start.substr(0,5)}</div>
                    <div class="col col-who col-desktop">${item.who || '-'}</div>

                    <div class="col desc-container">
                        <div class="desc">${item.desc}</div>
                        <div class="meta">${item.type || ''} ${item.who ? ' • ' + item.who : ''}</div>
                    </div>
                    
                    <div class="col col-av col-desktop" contenteditable="true" 
                         onblur="saveEdit(${item.id}, 'av', this)">${avText}</div>
                    <div class="col col-note col-desktop" contenteditable="true" 
                         onblur="saveEdit(${item.id}, 'note', this)">${noteText}</div>
                    
                    <div class="col dur" style="justify-content:flex-end; font-family:'Courier New'; color:#888;">
                        ${item.dur.substr(3,2)}m
                    </div>

                    <div class="col col-expand">
                        <button class="btn-expand" id="exp-${item.id}" onclick="toggleDetails(${item.id})">▼</button>
                    </div>
                    
                    <div class="progress-bar" id="bar-${item.id}"></div>
                </div>

                <div class="details-box" id="details-${item.id}">
                    <div class="detail-item">
                        <span class="detail-label">ANSVARLIG</span>
                        <span class="detail-content" style="color:var(--accent-blue)">${item.who || '-'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">LYD / BILDE (Trykk for å redigere)</span>
                        <div class="detail-content" style="color:#8fd" contenteditable="true" 
                             onblur="saveEdit(${item.id}, 'av', this)">${avText || 'Ingen info'}</div>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">KOMMENTARER (Trykk for å redigere)</span>
                        <div class="detail-content" style="color:#fd8; font-style:italic" contenteditable="true" 
                             onblur="saveEdit(${item.id}, 'note', this)">${noteText || 'Ingen info'}</div>
                    </div>
                </div>
            `;
            container.appendChild(wrapper);
        }
    });
    
    // Restore scroll position
    container.scrollTop = scrollPos;
    // Restore opened details based on local UI state (optional complexity skipped for stability)
}

// ==========================================
// ACTIONS (Sender til Firebase)
// ==========================================

function toggleDone(id, newState) {
    // Oppdaterer "status/ID/done" i databasen
    db.ref('status/' + id + '/done').set(newState);
}

function saveEdit(id, field, element) {
    const newVal = element.innerText;
    // Oppdaterer "status/ID/av" eller "status/ID/note"
    db.ref('status/' + id + '/' + field).set(newVal);
}

// ==========================================
// UTILS & VIEW
// ==========================================
function toggleDetails(id) {
    const box = document.getElementById('details-' + id);
    const btn = document.getElementById('exp-' + id);
    if(box) box.classList.toggle('open');
    if(btn) btn.classList.toggle('rotated');
}

function cycleViewMode() {
    document.body.classList.remove('mode-' + modes[currentModeIndex]);
    currentModeIndex = (currentModeIndex + 1) % modes.length;
    const newMode = modes[currentModeIndex];
    document.body.classList.add('mode-' + newMode);
    viewBtn.innerText = "VIEW: " + newMode.toUpperCase();
}

function updateClock() {
    const now = new Date();
    clockEl.innerText = now.toLocaleTimeString('no-NO', { hour12: false });

    // CSS Active State Logic (Calculation only, no re-render)
    const wrappers = document.querySelectorAll('.row-wrapper');
    wrappers.forEach(wrap => {
        if (wrap.classList.contains('done')) return;
        const start = new Date(wrap.dataset.startObj);
        const end = new Date(wrap.dataset.endObj);
        const bar = wrap.querySelector('.progress-bar');

        if (now >= start && now < end) {
            wrap.classList.add('active');
            const pct = ((now - start) / (end - start)) * 100;
            if(bar) bar.style.width = pct + "%";
        } else {
            wrap.classList.remove('active');
            if(bar) bar.style.width = "0%";
        }
    });
}

function parseTime(t) {
    const d = new Date();
    const parts = t.replace(/\./g,':').split(':');
    d.setHours(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]||0));
    return d;
}
function parseDuration(d) {
    const parts = d.replace(/\./g,':').split(':');
    return (parseInt(parts[0])*3600) + (parseInt(parts[1])*60) + parseInt(parts[2]);
}

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        document.getElementById('fs-btn').innerText = "EXIT";
        requestWakeLock();
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
        document.getElementById('fs-btn').innerText = "FULL";
    }
}
async function requestWakeLock() {
    try { wakeLock = await navigator.wakeLock.request('screen'); }
    catch (e) { console.log("WakeLock error", e); }
}
document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible') requestWakeLock();
});
