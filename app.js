/**
 * FINTRACKER - Unified Bank & Credit Dashboard
 * Inspired by SpendSense and Card Tracker
 */

// --- DATA MANAGEMENT ---
// Default starting data for the user
const DEFAULT_ACCOUNTS = [
    { id: 'acc-cc', name: 'ComBank Platinum', type: 'credit', balance: 0, billingDay: 20 },
    { id: 'acc-savings', name: 'Savings Account', type: 'bank', balance: 50000 },
    { id: 'acc-cash', name: 'Cash Wallet', type: 'cash', balance: 2500 }
];

const DEFAULT_TRANSACTIONS = [
    { id: 1, accountId: 'acc-savings', desc: 'Sample Salary', amount: 85000, type: 'income', date: new Date().toISOString() },
    { id: 2, accountId: 'acc-savings', desc: 'Rent Payment', amount: 30000, type: 'expense', date: new Date().toISOString() }
];

let transactions = JSON.parse(localStorage.getItem('fintracker-tx')) || DEFAULT_TRANSACTIONS;
let accounts = JSON.parse(localStorage.getItem('fintracker-accounts')) || DEFAULT_ACCOUNTS;
let backendUrl = localStorage.getItem('card-tracker-backend') || '';

function showLoader(msg = "Syncing...") {
    const el = document.getElementById('loader');
    if (el) {
        document.getElementById('loader-msg').innerText = msg;
        el.classList.remove('hidden');
    }
}

function hideLoader() {
    const el = document.getElementById('loader');
    if (el) el.classList.add('hidden');
}

async function saveToStorage() {
    localStorage.setItem('fintracker-tx', JSON.stringify(transactions));
    localStorage.setItem('fintracker-accounts', JSON.stringify(accounts));
    updateUI();
    if (backendUrl) syncToCloud();
}

async function syncToCloud() {
    if (!backendUrl) return;
    const statusEl = document.getElementById('sync-status');
    statusEl.innerHTML = '<span class="dot"></span> Syncing...';
    showLoader("Cloud Syncing...");
    
    try {
        const payload = { transactions, accounts };
        await fetch(backendUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(payload)
        });
        statusEl.className = 'sync-status online';
        statusEl.innerHTML = '<span class="dot"></span> Cloud Synced';
    } catch (err) {
        statusEl.className = 'sync-status offline';
        statusEl.innerHTML = '<span class="dot"></span> Sync Error';
    } finally {
        hideLoader();
    }
}

async function loadFromCloud() {
    if (!backendUrl) return;
    showLoader("Refreshing...");
    try {
        const response = await fetch(backendUrl);
        if (response.ok) {
            const data = JSON.parse(await response.text());
            if (data.transactions && data.accounts) {
                transactions = data.transactions;
                accounts = data.accounts;
                localStorage.setItem('fintracker-tx', JSON.stringify(transactions));
                localStorage.setItem('fintracker-accounts', JSON.stringify(accounts));
                updateUI();
                return true;
            }
        }
    } catch (err) { console.error(err); }
    finally { hideLoader(); }
    return false;
}

// --- CORE UTILS ---
const formatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function calculateAccountBalances() {
    const balances = {};
    accounts.forEach(acc => balances[acc.id] = parseFloat(acc.balance) || 0);
    
    transactions.forEach(tx => {
        if (balances[tx.accountId] !== undefined) {
            if (tx.type === 'income') balances[tx.accountId] += tx.amount;
            else balances[tx.accountId] -= tx.amount;
        }
    });
    return balances;
}

// --- UI LOGIC ---
function updateUI() {
    const balances = calculateAccountBalances();
    const now = new Date();
    document.getElementById('today-date').innerText = formatter.format(now);

    // Summary
    const netWorth = Object.values(balances).reduce((a, b) => a + b, 0);
    const monthlySpend = transactions
        .filter(tx => tx.type === 'expense' && new Date(tx.date).getMonth() === now.getMonth())
        .reduce((sum, tx) => sum + tx.amount, 0);

    document.getElementById('net-worth').innerText = `Rs. ${netWorth.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    document.getElementById('monthly-spending').innerText = `Rs. ${monthlySpend.toLocaleString(undefined, {minimumFractionDigits: 2})}`;

    // Transaction Lists
    renderList('recent-transaction-list', transactions.slice(-5).reverse());
    renderList('full-transaction-list', transactions.slice().reverse());

    // Account List
    const accList = document.getElementById('account-list');
    accList.innerHTML = accounts.map(acc => `
        <div class="acc-card" onclick="openAccountDetails('${acc.id}')">
            <div class="acc-info">
                <h4>${acc.name}</h4>
                <span>${acc.type}</span>
            </div>
            <div class="acc-balance ${balances[acc.id] < 0 ? 'negative' : ''}">
                Rs. ${balances[acc.id].toLocaleString(undefined, {minimumFractionDigits: 2})}
            </div>
        </div>
    `).join('');

    // Update Dropdowns
    const selects = ['account-select', 'filter-account'];
    selects.forEach(sid => {
        const el = document.getElementById(sid);
        if (!el) return;
        const currentVal = el.value;
        let html = sid === 'filter-account' ? '<option value="all">All Accounts</option>' : '';
        html += accounts.map(acc => `<option value="${acc.id}">${acc.name}</option>`).join('');
        el.innerHTML = html;
        if (currentVal) el.value = currentVal;
    });

    // Credit Card Cycle Logic (First Credit Card found)
    const cc = accounts.find(a => a.type === 'credit');
    const cycleSection = document.getElementById('card-cycle-section');
    if (cc) {
        cycleSection.classList.remove('hidden');
        updateCycleUI(cc);
    } else {
        cycleSection.classList.add('hidden');
    }
}

function updateCycleUI(cc) {
    const bDay = cc.billingDay || 20;
    const now = new Date();
    const today = now.getDate();
    let statementDate = new Date(now.getFullYear(), now.getMonth() + (today > bDay ? 1 : 0), bDay);
    const dueDate = new Date(statementDate.getTime() + (20 * 24 * 60 * 60 * 1000));
    
    document.getElementById('cycle-account-name').innerText = `${cc.name.toUpperCase()} CYCLE`;
    document.getElementById('days-remaining').innerText = `${Math.ceil((statementDate - now) / 86400000)} days left`;
    
    const progress = Math.min(100, Math.max(0, (today / 30) * 100)); // Simple calc
    document.getElementById('cycle-progress').style.width = `${progress}%`;
}

function renderList(id, listData) {
    const list = document.getElementById(id);
    if (!list) return;
    if (listData.length === 0) {
        list.innerHTML = '<li class="empty-state">No transactions yet.</li>';
        return;
    }
    list.innerHTML = listData.map(tx => {
        const accName = accounts.find(a => a.id === tx.accountId)?.name || 'Unknown';
        return `
        <li class="transaction-item">
            <div class="transaction-info">
                <span class="transaction-desc">${tx.desc}</span>
                <span class="transaction-date">${accName} • ${formatter.format(new Date(tx.date))}</span>
            </div>
            <div class="transaction-actions">
                <span class="transaction-amount ${tx.type}">${tx.type === 'income' ? '+' : ''}Rs. ${tx.amount.toLocaleString()}</span>
                <div class="action-btns">
                    <button onclick="editTransaction(${tx.id})" class="edit-btn">✏️</button>
                    <button onclick="removeTransaction(${tx.id})" class="delete-btn">🗑️</button>
                </div>
            </div>
        </li>`;
    }).join('');
}

// --- TABS & MODALS ---
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.tab-btn, .tab-pane').forEach(el => el.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    };
});

document.getElementById('quick-add-btn').onclick = () => {
    document.getElementById('modal-title').innerText = "Add Transaction";
    document.getElementById('edit-id').value = "";
    document.getElementById('transaction-form').reset();
    document.getElementById('modal-overlay').classList.remove('hidden');
};

document.getElementById('add-account-btn').onclick = () => {
    document.getElementById('account-modal-overlay').classList.remove('hidden');
};

document.getElementById('close-modal').onclick = () => document.getElementById('modal-overlay').classList.add('hidden');
document.getElementById('close-acc-modal').onclick = () => document.getElementById('account-modal-overlay').classList.add('hidden');

document.getElementById('acc-type').onchange = (e) => {
    document.getElementById('credit-fields').classList.toggle('hidden', e.target.value !== 'credit');
};

// --- FORMS ---
document.getElementById('transaction-form').onsubmit = (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const tx = {
        id: id ? parseInt(id) : Date.now(),
        accountId: document.getElementById('account-select').value,
        desc: document.getElementById('desc').value,
        amount: parseFloat(document.getElementById('amount').value),
        type: document.getElementById('type').value,
        date: id ? transactions.find(t => t.id == id).date : new Date().toISOString()
    };

    if (id) {
        const idx = transactions.findIndex(t => t.id == id);
        transactions[idx] = tx;
    } else {
        transactions.push(tx);
    }
    saveToStorage();
    document.getElementById('modal-overlay').classList.add('hidden');
};

document.getElementById('account-form').onsubmit = (e) => {
    e.preventDefault();
    const acc = {
        id: 'acc-' + Date.now(),
        name: document.getElementById('acc-name').value,
        type: document.getElementById('acc-type').value,
        balance: parseFloat(document.getElementById('acc-balance').value),
        billingDay: parseInt(document.getElementById('billing-day').value)
    };
    accounts.push(acc);
    saveToStorage();
    document.getElementById('account-modal-overlay').classList.add('hidden');
};

// --- INITIALIZE ---
(async function init() {
    if (backendUrl) await loadFromCloud();
    updateUI();
})();

// Re-using old sync triggers for convenience
document.getElementById('open-settings').onclick = () => {
    document.getElementById('backend-url').value = backendUrl;
    document.getElementById('settings-overlay').classList.remove('hidden');
};
document.getElementById('close-settings').onclick = () => document.getElementById('settings-overlay').classList.add('hidden');
document.getElementById('save-settings').onclick = async () => {
    backendUrl = document.getElementById('backend-url').value.trim();
    localStorage.setItem('card-tracker-backend', backendUrl);
    await syncToCloud();
    document.getElementById('settings-overlay').classList.add('hidden');
};
document.getElementById('clear-data').onclick = () => {
    if(confirm("Wipe all data?")) {
        transactions = [];
        accounts = [{ id: 'default-cc', name: 'ComBank Platinum', type: 'credit', balance: 0, billingDay: 20 }];
        saveToStorage();
    }
};

window.removeTransaction = (id) => {
    if (confirm("Delete?")) {
        transactions = transactions.filter(t => t.id != id);
        saveToStorage();
    }
};

window.editTransaction = (id) => {
    const tx = transactions.find(t => t.id == id);
    if (!tx) return;
    document.getElementById('modal-title').innerText = "Edit Transaction";
    document.getElementById('edit-id').value = tx.id;
    document.getElementById('account-select').value = tx.accountId;
    document.getElementById('desc').value = tx.desc;
    document.getElementById('amount').value = tx.amount;
    document.getElementById('type').value = tx.type;
    document.getElementById('modal-overlay').classList.remove('hidden');
};
