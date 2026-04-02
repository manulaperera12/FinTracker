/**
 * CARD TRACKER - ComBank Platinum Dashboard Logic
 * 
 * Logic based on:
 * - Statement Date: 20th of each month
 * - Due Date: 20 days after statement (~10th of following month)
 * - Interest-Free Max: ~50 days for purchases on 21st
 * - Interest-Free Min: ~20 days for purchases on 20th
 */

// --- DATA MANAGEMENT ---
let transactions = JSON.parse(localStorage.getItem('card-tracker-tx')) || [];
let backendUrl = localStorage.getItem('card-tracker-backend') || '';

async function saveToStorage() {
    localStorage.setItem('card-tracker-tx', JSON.stringify(transactions));
    updateUI();
    
    if (backendUrl) {
        syncToCloud();
    }
}

async function syncToCloud() {
    if (!backendUrl) return;
    
    const statusEl = document.getElementById('sync-status');
    statusEl.innerHTML = '<span class="dot"></span> Syncing...';
    
    try {
        // Use 'no-cors' and 'text/plain' to avoid OPTIONS preflight
        await fetch(backendUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(transactions)
        });
        
        // With no-cors, we can't check response.ok, so we assume success if no error is thrown
        statusEl.className = 'sync-status online';
        statusEl.innerHTML = '<span class="dot"></span> Cloud Synced';
    } catch (err) {
        statusEl.className = 'sync-status offline';
        statusEl.innerHTML = '<span class="dot"></span> Sync Error';
        console.error(err);
    }
}

async function loadFromCloud() {
    if (!backendUrl) return;
    
    try {
        // GET requests to GAS usually work if they return a proper ContentService response
        const response = await fetch(backendUrl);
        if (response.ok) {
            const text = await response.text();
            try {
                const data = JSON.parse(text);
                if (Array.isArray(data)) {
                    transactions = data;
                    localStorage.setItem('card-tracker-tx', JSON.stringify(transactions));
                    updateUI();
                    return true;
                }
            } catch (e) {
                console.warn("Cloud data is not valid JSON, might be empty.");
            }
        }
    } catch (err) {
        console.error("Cloud load failed (CORS or Network)", err);
    }
    return false;
}

// --- CORE LOGIC ---
const BILLING_CYCLE_DAY = 20;
const DUE_DAYS_OFFSET = 20;
const SALARY_DAY = 2;

function getFinancialContext() {
    const now = new Date();
    const today = now.getDate();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // 1. Calculate Next Statement Date
    let statementDate;
    if (today <= BILLING_CYCLE_DAY) {
        statementDate = new Date(currentYear, currentMonth, BILLING_CYCLE_DAY);
    } else {
        statementDate = new Date(currentYear, currentMonth + 1, BILLING_CYCLE_DAY);
    }

    // 2. Calculate Payment Due Date
    const dueDate = new Date(statementDate.getTime() + (DUE_DAYS_OFFSET * 24 * 60 * 60 * 1000));

    // 3. Determine Spending Zone
    let zone = {
        id: 'safe',
        badge: 'SAFE ZONE',
        title: 'Safe Spending',
        desc: 'Ideal for large purchases. You get the maximum interest-free period (~50 days).',
        class: 'badge-safe',
        progressColor: '#4ade80'
    };

    if (today >= 11 && today <= 15) {
        zone = {
            id: 'warning',
            badge: 'CAUTION ZONE',
            title: 'Decreasing Window',
            desc: 'Interest-free period is shrinking. Avoid large non-essential purchases.',
            class: 'badge-warning',
            progressColor: '#facc15'
        };
    } else if (today >= 16 && today <= 20) {
        zone = {
            id: 'danger',
            badge: 'RISK ZONE',
            title: 'Critical Period',
            desc: 'Very short interest-free window (~20 days). Wait until the 21st if possible!',
            class: 'badge-danger',
            progressColor: '#f87171'
        };
    }

    if (today >= SALARY_DAY && today <= 5) {
        zone.title = "💳 Payment Window!";
        zone.desc = "Salary received! Pay your full outstanding balance NOW (Due around the 10th).";
    }

    let cycleStart;
    if (today <= 20) {
        cycleStart = new Date(currentYear, currentMonth - 1, 21);
    } else {
        cycleStart = new Date(currentYear, currentMonth, 21);
    }
    
    const totalCycleDays = (statementDate - cycleStart) / (1000 * 60 * 60 * 24);
    const daysElapsed = (now - cycleStart) / (1000 * 60 * 60 * 24);
    const progressPercent = Math.min(100, Math.max(0, (daysElapsed / totalCycleDays) * 100));

    return {
        now,
        statementDate,
        dueDate,
        zone,
        progressPercent,
        daysToStatement: Math.ceil((statementDate - now) / (1000 * 60 * 60 * 24))
    };
}

// --- UI UPDATES ---
function updateUI() {
    const ctx = getFinancialContext();
    const formatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const dayMonthFormatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

    document.getElementById('today-date').innerText = formatter.format(ctx.now);
    document.getElementById('next-statement-date').innerText = dayMonthFormatter.format(ctx.statementDate);
    document.getElementById('next-due-date').innerText = dayMonthFormatter.format(ctx.dueDate);
    document.getElementById('days-remaining').innerText = `${ctx.daysToStatement} days left`;
    
    const badge = document.getElementById('zone-badge');
    badge.innerText = ctx.zone.badge;
    badge.className = `badge ${ctx.zone.class}`;
    document.getElementById('zone-title').innerText = ctx.zone.title;
    document.getElementById('zone-description').innerText = ctx.zone.desc;
    
    const progressFill = document.getElementById('cycle-progress');
    progressFill.style.width = `${ctx.progressPercent}%`;
    progressFill.style.background = ctx.zone.progressColor;

    const total = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    document.getElementById('total-spending').innerText = `Rs. ${total.toLocaleString(undefined, {minimumFractionDigits: 2})}`;

    const list = document.getElementById('transaction-list');
    if (transactions.length === 0) {
        list.innerHTML = '<li class="empty-state">No transactions recorded.</li>';
    } else {
        list.innerHTML = [...transactions].reverse().map((tx, idx) => `
            <li class="transaction-item">
                <div class="transaction-info">
                    <span class="transaction-desc">${tx.desc}</span>
                    <span class="transaction-date">${formatter.format(new Date(tx.date))}</span>
                </div>
                <span class="transaction-amount">Rs. ${tx.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </li>
        `).join('');
    }
}

// --- MODALS & EVENTS ---
const modalOverlay = document.getElementById('modal-overlay');
const settingsOverlay = document.getElementById('settings-overlay');
const addBtn = document.getElementById('add-transaction-btn');
const settingsBtn = document.getElementById('open-settings');

addBtn.onclick = () => modalOverlay.classList.remove('hidden');
settingsBtn.onclick = () => {
    document.getElementById('backend-url').value = backendUrl;
    settingsOverlay.classList.remove('hidden');
};

document.getElementById('close-modal').onclick = () => modalOverlay.classList.add('hidden');
document.getElementById('close-settings').onclick = () => settingsOverlay.classList.add('hidden');

document.getElementById('transaction-form').onsubmit = (e) => {
    e.preventDefault();
    const desc = document.getElementById('desc').value;
    const amount = parseFloat(document.getElementById('amount').value);

    if (desc && amount) {
        transactions.push({
            id: Date.now(),
            desc,
            amount,
            date: new Date().toISOString()
        });
        saveToStorage();
        e.target.reset();
        modalOverlay.classList.add('hidden');
    }
};

document.getElementById('save-settings').onclick = async () => {
    const url = document.getElementById('backend-url').value.trim();
    if (url) {
        backendUrl = url;
        localStorage.setItem('card-tracker-backend', backendUrl);
        const success = await loadFromCloud();
        if (success) {
            alert("Connected and data synced from cloud!");
        } else {
            // If cloud is empty, push local to cloud
            await syncToCloud();
            alert("Connected! Local data pushed to cloud.");
        }
    } else {
        backendUrl = '';
        localStorage.removeItem('card-tracker-backend');
        document.getElementById('sync-status').className = 'sync-status';
        document.getElementById('sync-status').innerHTML = '<span class="dot"></span> Local Mode';
    }
    settingsOverlay.classList.add('hidden');
};

// --- DATA TOOLS ---
document.getElementById('export-data').onclick = () => {
    const dataStr = JSON.stringify(transactions, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cc-data-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
};

document.getElementById('import-data').onclick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (Array.isArray(data)) {
                    transactions = data;
                    saveToStorage();
                }
            } catch (err) { alert("Invalid file."); }
        };
        reader.readAsText(file);
    };
    input.click();
};

document.getElementById('clear-data').onclick = () => {
    if (confirm("Delete all history locally?")) {
        transactions = [];
        saveToStorage();
    }
};

// --- INITIALIZE ---
(async function init() {
    if (backendUrl) {
        const statusEl = document.getElementById('sync-status');
        statusEl.innerHTML = '<span class="dot"></span> Syncing...';
        await loadFromCloud();
        statusEl.className = 'sync-status online';
        statusEl.innerHTML = '<span class="dot"></span> Cloud Online';
    }
    updateUI();
})();

// Refresh UI every hour to keep dates fresh
setInterval(updateUI, 3600000);
