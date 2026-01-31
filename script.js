// CONFIG
const USER = "admin";
const PASS = "Brunstad2020";

// DOM ELEMENTS
const loginOverlay = document.getElementById('login-overlay');
const appContainer = document.getElementById('app-container');
const container = document.getElementById('schedule-container');
const clockEl = document.getElementById('clock');
const errorMsg = document.getElementById('error-msg');

let scheduleData = [];
let wakeLock = null;

// --- AUTHENTICATION ---
function attemptLogin() {
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;

    if (u === USER && p === PASS) {
        loginOverlay.style.display = 'none';
        appContainer.style.display = 'flex';
        initApp();
        requestWakeLock();
    } else {
        errorMsg.innerText = "ACCESS DENIED";
        setTimeout(() => errorMsg.innerText = "", 2000);
    }
}

// Allow "Enter" key to login
document.getElementById('password').addEventListener('keyup', function(event) {
    if (event.key === 'Enter') attemptLogin();
});

// --- APP LOGIC ---
async function initApp() {
    try {
        const response = await fetch('data.json');
        scheduleData = await response.json();
        renderSchedule();
        setInterval(updateClock, 1000);
        updateClock();
    } catch (e) {
        console.error("Could not load data.json", e);
        container.innerHTML = "<div style='padding:20px; color:red'>ERROR: Could not load data.json</div>";
    }
}

function renderSchedule() {
    container.innerHTML = '';
    
    // Retrieve saved state from localStorage
    const savedDoneState = JSON.parse(localStorage.getItem('weddingDoneState')) || {};

    scheduleData.forEach((item, index) => {
        if (item.type === 'header') {
            const div = document.createElement('div');
            div.className = `section-header ${item.class || ''}`;
            div.innerHTML = `<span>${item.start.substr(0,5)}</span> ${item.title}`;
            container.appendChild(div);
        } else {
            const isDone = savedDoneState[item.id] ? 'done' : '';
            
            const row = document.createElement('div');
            row.className = `row ${isDone}`;
            row.id = 'row-' + item.id;
            row.dataset.start = item.start;
            row.dataset.dur = item.dur;
            row.dataset.id = item.id;

            // Calculate timing objects
            const startTime = parseTime(item.start);
            const durSeconds = parseDuration(item.dur);
            const endTime = new Date(startTime.getTime() + durSeconds * 1000);
            row.dataset.endTimeObj = endTime.toISOString();
            row.dataset.startTimeObj = startTime.toISOString();

            row.innerHTML = `
                <div class="col" onclick="toggleDone(${item.id})">
                    <div class="btn-check" id="btn-${item.id}">${isDone ? 'OFF' : 'ON'}</div>
                </div>
                <div class="col time">${item.start.substr(0,5)}</div>
                <div class="col desc-container">
                    <div class="desc">${item.desc}</div>
                    <div class="meta">
                        ${item.who ? `<span>${item.who}</span>` : ''} 
                        ${item.type ? `<span style="color:#aaa;">${item.type}</span>` : ''}
                    </div>
                </div>
                <div class="col dur">${item.dur.substr(3,2)}m</div>
                <div class="progress-bar" id="bar-${item.id}"></div>
            `;
            container.appendChild(row);
        }
    });
}

function toggleDone(id) {
    const row = document.getElementById('row-' + id);
    const btn = document.getElementById('btn-' + id);
    
    row.classList.toggle('done');
    
    // Update LocalStorage
    const savedDoneState = JSON.parse(localStorage.getItem('weddingDoneState')) || {};
    
    if (row.classList.contains('done')) {
        savedDoneState[id] = true;
        btn.innerText = "OFF";
    } else {
        delete savedDoneState[id];
        btn.innerText = "ON";
    }
    
    localStorage.setItem('weddingDoneState', JSON.stringify(savedDoneState));
}

function parseTime(timeStr) {
    const d = new Date();
    const parts = timeStr.replace(/\./g, ':').split(':');
    d.setHours(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2] || 0));
    return d;
}

function parseDuration(durStr) {
    const parts = durStr.replace(/\./g, ':').split(':');
    return (parseInt(parts[0]) * 3600) + (parseInt(parts[1]) * 60) + parseInt(parts[2]);
}

function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('no-NO', { hour12: false });
    clockEl.innerText = timeString;

    const rows = document.querySelectorAll('.row');
    rows.forEach(row => {
        if (row.classList.contains('done')) return;

        const start = new Date(row.dataset.startTimeObj);
        const end = new Date(row.dataset.endTimeObj);
        const bar = row.querySelector('.progress-bar');

        if (now >= start && now < end) {
            row.classList.add('active');
            const totalDur = (end - start);
            const elapsed = (now - start);
            const pct = (elapsed / totalDur) * 100;
            bar.style.width = pct + "%";
        } else {
            row.classList.remove('active');
            bar.style.width = "0%";
        }
    });
}

// --- UTILS ---
function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        document.getElementById('fs-btn').innerText = "EXIT";
        requestWakeLock();
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
            document.getElementById('fs-btn').innerText = "FULLSCREEN";
        }
    }
}

async function requestWakeLock() {
    try {
        wakeLock = await navigator.wakeLock.request('screen');
        console.log('Wake Lock active');
    } catch (err) {
        console.log("Wake Lock error:", err);
    }
}

document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible') {
        requestWakeLock();
    }
});
