// CONFIG
const USER = "admin";
const PASS = "Brunstad2020";

// DOM
const loginOverlay = document.getElementById('login-overlay');
const appContainer = document.getElementById('app-container');
const container = document.getElementById('schedule-container');
const clockEl = document.getElementById('clock');
const errorMsg = document.getElementById('error-msg');
const viewBtn = document.getElementById('view-btn');

let scheduleData = [];
let wakeLock = null;
const modes = ['auto', 'phone', 'tablet', 'desktop'];
let currentModeIndex = 0;

// --- LOGIN ---
function attemptLogin() {
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;

    // HER ER ENDRINGEN:
    // Vi legger til .toLowerCase() på 'u' (input) og 'USER' (fasit)
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

// --- VIEW MODES ---
function cycleViewMode() {
    document.body.classList.remove('mode-' + modes[currentModeIndex]);
    currentModeIndex = (currentModeIndex + 1) % modes.length;
    const newMode = modes[currentModeIndex];
    document.body.classList.add('mode-' + newMode);
    viewBtn.innerText = "VIEW: " + newMode.toUpperCase();
}

// --- APP INIT ---
async function initApp() {
    try {
        const response = await fetch('data.json');
        scheduleData = await response.json();
        renderSchedule();
        setInterval(updateClock, 1000);
        updateClock();
    } catch (e) {
        console.error(e);
        container.innerHTML = "<div style='color:red; padding:20px; text-align:center;'>Error loading data.json</div>";
    }
}

// --- RENDER ---
function renderSchedule() {
    container.innerHTML = '';
    const savedDoneState = JSON.parse(localStorage.getItem('weddingDoneState')) || {};
    const savedEdits = JSON.parse(localStorage.getItem('weddingEdits')) || {};

    scheduleData.forEach((item, index) => {
        if (item.type === 'header') {
            const div = document.createElement('div');
            div.className = `section-header ${item.class || ''}`;
            div.innerHTML = `<span>${item.start.substr(0,5)}</span> ${item.title}`;
            container.appendChild(div);
        } else {
            // Merge defaults with saved edits
            const avText = savedEdits[item.id + '_av'] !== undefined ? savedEdits[item.id + '_av'] : (item.av || '');
            const noteText = savedEdits[item.id + '_note'] !== undefined ? savedEdits[item.id + '_note'] : (item.note || '');
            
            const isDone = savedDoneState[item.id] ? 'done' : '';
            const start = parseTime(item.start);
            const durSec = parseDuration(item.dur);
            const end = new Date(start.getTime() + durSec * 1000);

            const wrapper = document.createElement('div');
            wrapper.className = `row-wrapper ${isDone}`;
            wrapper.id = 'wrapper-' + item.id;
            wrapper.dataset.startObj = start.toISOString();
            wrapper.dataset.endObj = end.toISOString();

            // Main Row Content
            wrapper.innerHTML = `
                <div class="row-main">
                    <div class="col" onclick="toggleDone(${item.id})">
                        <div class="btn-check" id="btn-${item.id}">${isDone ? 'OFF' : 'ON'}</div>
                    </div>
                    <div class="col time">${item.start.substr(0,5)}</div>
                    
                    <div class="col col-who col-desktop">${item.who || '-'}</div>

                    <div class="col desc-container">
                        <div class="desc">${item.desc}</div>
                        <div class="meta">${item.type || ''} ${item.who ? ' • ' + item.who : ''}</div>
                    </div>
                    
                    <div class="col col-av col-desktop" contenteditable="true" onblur="saveEdit(${item.id}, 'av', this)">${avText}</div>
                    <div class="col col-note col-desktop" contenteditable="true" onblur="saveEdit(${item.id}, 'note', this)">${noteText}</div>
                    
                    <div class="col dur" style="justify-content:flex-end; font-family:'Courier New'; color:#888;">${item.dur.substr(3,2)}m</div>

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
                        <div class="detail-content" style="color:#8fd" contenteditable="true" onblur="saveEdit(${item.id}, 'av', this)">${avText || 'Ingen info'}</div>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">KOMMENTARER (Trykk for å redigere)</span>
                        <div class="detail-content" style="color:#fd8; font-style:italic" contenteditable="true" onblur="saveEdit(${item.id}, 'note', this)">${noteText || 'Ingen info'}</div>
                    </div>
                </div>
            `;
            container.appendChild(wrapper);
        }
    });
}

// --- LOGIC ---
function saveEdit(id, field, element) {
    const newVal = element.innerText;
    const savedEdits = JSON.parse(localStorage.getItem('weddingEdits')) || {};
    
    // Save the edit
    savedEdits[id + '_' + field] = newVal;
    localStorage.setItem('weddingEdits', JSON.stringify(savedEdits));

    // Sync Desktop/Phone fields so they match instantly if view changes
    // (Simple reload logic or targeted DOM update could work, reloading is safer for consistency)
    // console.log("Saved", field, newVal);
}

function toggleDetails(id) {
    const box = document.getElementById('details-' + id);
    const btn = document.getElementById('exp-' + id);
    box.classList.toggle('open');
    btn.classList.toggle('rotated');
}

function toggleDone(id) {
    const wrapper = document.getElementById('wrapper-' + id);
    const btn = document.getElementById('btn-' + id);
    wrapper.classList.toggle('done');
    
    const savedState = JSON.parse(localStorage.getItem('weddingDoneState')) || {};
    if (wrapper.classList.contains('done')) {
        savedState[id] = true;
        btn.innerText = "OFF";
    } else {
        delete savedState[id];
        btn.innerText = "ON";
    }
    localStorage.setItem('weddingDoneState', JSON.stringify(savedState));
}

function updateClock() {
    const now = new Date();
    clockEl.innerText = now.toLocaleTimeString('no-NO', { hour12: false });

    const wrappers = document.querySelectorAll('.row-wrapper');
    wrappers.forEach(wrap => {
        if (wrap.classList.contains('done')) return;
        const start = new Date(wrap.dataset.startObj);
        const end = new Date(wrap.dataset.endObj);
        const bar = wrap.querySelector('.progress-bar');

        if (now >= start && now < end) {
            wrap.classList.add('active');
            const pct = ((now - start) / (end - start)) * 100;
            bar.style.width = pct + "%";
        } else {
            wrap.classList.remove('active');
            bar.style.width = "0%";
        }
    });
}

// --- UTILS ---
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
