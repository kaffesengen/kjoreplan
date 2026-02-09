const firebaseConfig = {
    apiKey: "AIzaSyAHWKMFrjLO0golIkfpdfbEyL8FxWuivbA",
    authDomain: "bryllup2026-3d2c1.firebaseapp.com",
    databaseURL: "https://bryllup2026-3d2c1-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "bryllup2026-3d2c1",
    storageBucket: "bryllup2026-3d2c1.firebasestorage.app",
    messagingSenderId: "843855995608",
    appId: "1:843855995608:web:21f2ab82e95e86bce36dad"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const USER = "admin";
const PASS = "Brunstad2020";

let currentListId = "Funksjonstest_2026";
let allLists = {};
let doorTemplate = []; // Nå tom, fylles fra data.json

function attemptLogin() {
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    if (u.toLowerCase() === USER.toLowerCase() && p === PASS) {
        document.getElementById('login-overlay').style.display = 'none';
        initApp();
    } else {
        document.getElementById('error-msg').innerText = "ACCESS DENIED";
    }
}

async function initApp() {
    try {
        // 1. Hent den fulle dørlisten fra fila di
        const response = await fetch('data.json');
        doorTemplate = await response.json();

        // 2. Lytt på Firebase
        db.ref('checklists').on('value', (snapshot) => {
            allLists = snapshot.val() || {};
            updateSelector();
            renderChecklist();
        });
    } catch (err) {
        console.error("Kunne ikke laste dørdata:", err);
    }
}

function updateSelector() {
    const selector = document.getElementById('checklist-selector');
    if (!selector) return;
    selector.innerHTML = '';
    
    const ids = Object.keys(allLists);
    if (ids.length === 0) {
        createNewList("Funksjonstest 2026");
        return;
    }

    ids.forEach(id => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = id.replace(/_/g, ' ');
        opt.selected = (id === currentListId);
        selector.appendChild(opt);
    });
}

function createNewList(manualName = null) {
    const name = manualName || prompt("Navn på ny sjekkliste (f.eks. Vernerunde Jan):");
    if (!name) return;

    const listId = name.replace(/\s+/g, '_');
    const newData = {};
    
    // Bruker nå dataen fra data.json til å bygge den nye listen i Firebase
    doorTemplate.forEach(door => {
        newData[door.id] = {
            checked: false,
            note: "",
            timestamp: null,
            room: door.room,
            etg: door.etg
        };
    });

    db.ref('checklists/' + listId).set(newData);
    currentListId = listId;
}

function renderChecklist() {
    const container = document.getElementById('checklist-container');
    if (!container) return;
    
    container.innerHTML = '';
    const liveData = allLists[currentListId] || {};

    doorTemplate.forEach(door => {
        const status = liveData[door.id] || {};
        const isChecked = status.checked;

        const row = document.createElement('div');
        row.className = `row-wrapper ${isChecked ? 'checked' : ''}`;
        row.innerHTML = `
            <div class="row-main">
                <div class="col id-col">${door.id}</div>
                <div class="col room-col">
                    <div class="room-name">${door.room}</div>
                    <div class="room-meta">Etasje: ${door.etg}</div>
                    <input type="text" class="note-input" placeholder="Kommentar..." 
                           value="${status.note || ''}" 
                           onblur="saveNote('${door.id}', this.value)">
                </div>
                <div class="col status-col">
                    <span class="status-badge">${isChecked ? 'OK' : 'PENDING'}</span>
                </div>
                <div class="col action-col">
                    <button class="check-btn" onclick="toggleDoor('${door.id}', ${!isChecked})">
                        ${isChecked ? 'ÅPNE' : 'SJEKK'}
                    </button>
                </div>
            </div>
        `;
        container.appendChild(row);
    });
}

// ... resten av funksjonene dine (toggleDoor, saveNote, exportToJSON, switchList) forblir like
