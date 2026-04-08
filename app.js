/**
 * FINTRACKER - Unified Bank, Credit, Budget & Transfers Dashboard
 */

// --- DATA MANAGEMENT ---
const DEFAULT_ACCOUNTS = [
    { id: 'acc-savings', name: 'Main Savings', type: 'savings', balance: 150000 },
    { id: 'acc-current', name: 'Commercial Bank', type: 'bank', balance: 50000 },
    { id: 'acc-cc', name: 'ComBank Platinum', type: 'credit', balance: 0, billingDay: 20 },
    { id: 'acc-cash', name: 'Cash Wallet', type: 'cash', balance: 5000 }
];

const DEFAULT_TRANSACTIONS = [
    { id: 1, accountId: 'acc-current', desc: 'Sample Salary', amount: 95000, type: 'income', date: new Date().toISOString() },
    { id: 2, accountId: 'acc-current', desc: 'Rent Payment', amount: 35000, type: 'expense', date: new Date().toISOString() }
];

let transactions = JSON.parse(localStorage.getItem('fintracker-tx')) || DEFAULT_TRANSACTIONS;
let accounts = JSON.parse(localStorage.getItem('fintracker-accounts')) || DEFAULT_ACCOUNTS;
let budgetPlans = JSON.parse(localStorage.getItem('fintracker-budgets')) || [];
let backendUrl = localStorage.getItem('card-tracker-backend') || '';
let currentViewDate = new Date();

function getMonthKey(date) {
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
}

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
    localStorage.setItem('fintracker-budgets', JSON.stringify(budgetPlans));
    updateUI();
    if (backendUrl) syncToCloud();
}

async function syncToCloud() {
    if (!backendUrl) return;
    const statusEl = document.getElementById('sync-status');
    statusEl.className = 'sync-status';
    statusEl.innerHTML = '<span class="dot"></span> Syncing...';
    showLoader("Cloud Syncing...");
    try {
        const payload = { transactions, accounts, budgetPlans };
        await fetch(backendUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(payload)
        });
        statusEl.className = 'sync-status online';
        statusEl.innerHTML = '<span class="dot"></span> Cloud Online';
    } catch (err) {
        statusEl.className = 'sync-status offline';
        statusEl.innerHTML = '<span class="dot"></span> Sync Error';
    } finally {
        hideLoader();
    }
}

async function loadFromCloud() {
    if (!backendUrl) return;
    const statusEl = document.getElementById('sync-status');
    showLoader("Refreshing...");
    try {
        const response = await fetch(backendUrl);
        if (response.ok) {
            const data = JSON.parse(await response.text());
            if (data.transactions && data.accounts) {
                transactions = data.transactions;
                accounts = data.accounts;
                budgetPlans = data.budgetPlans || [];
                localStorage.setItem('fintracker-tx', JSON.stringify(transactions));
                localStorage.setItem('fintracker-accounts', JSON.stringify(accounts));
                localStorage.setItem('fintracker-budgets', JSON.stringify(budgetPlans));
                statusEl.className = 'sync-status online';
                statusEl.innerHTML = '<span class="dot"></span> Cloud Online';
                updateUI();
                return true;
            }
        }
    } catch (err) { 
        statusEl.className = 'sync-status offline';
        statusEl.innerHTML = '<span class="dot"></span> Offline';
    }
    finally { hideLoader(); }
    return false;
}

// --- CORE UTILS ---
const formatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function calculateAccountBalances() {
    const balances = {};
    accounts.forEach(acc => balances[acc.id] = parseFloat(acc.balance) || 0);
    transactions.forEach(tx => {
        if (tx.type === 'income') {
            if (balances[tx.accountId] !== undefined) balances[tx.accountId] += tx.amount;
        } else if (tx.type === 'expense') {
            if (balances[tx.accountId] !== undefined) balances[tx.accountId] -= tx.amount;
        } else if (tx.type === 'transfer') {
            if (balances[tx.accountId] !== undefined) balances[tx.accountId] -= tx.amount;
            if (balances[tx.toAccountId] !== undefined) balances[tx.toAccountId] += tx.amount;
        }
    });
    return balances;
}

function getActiveBudgets(monthKey) {
    let active = budgetPlans.filter(p => p.monthKey === monthKey);
    const recurringSources = budgetPlans.filter(p => p.recurring && p.monthKey < monthKey);
    recurringSources.forEach(source => {
        if (!active.find(a => a.name === source.name)) {
            active.push({ ...source, monthKey, virtual: true });
        }
    });
    return active;
}

// --- UI UPDATES ---
function updateUI() {
    const balances = calculateAccountBalances();
    const now = new Date();
    document.getElementById('today-date').innerText = formatter.format(now);

    const mKey = getMonthKey(currentViewDate);
    document.getElementById('current-budget-month').innerText = currentViewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    // Net Wealth = All Assets - All Liabilities
    const netWealth = Object.values(balances).reduce((a, b) => a + b, 0);

    // Spending Cash ONLY = Current Accounts + Cash Wallet
    const liquidCash = accounts
        .filter(acc => acc.type === 'bank' || acc.type === 'cash')
        .reduce((sum, acc) => sum + (balances[acc.id] || 0), 0);

    // Summary - Calculate total spent this month on BUDGETED items vs ALL items
    const monthTx = transactions.filter(tx => tx.type === 'expense' && getMonthKey(new Date(tx.date)) === getMonthKey(now));
    const activeBudgetsThisMonth = getActiveBudgets(getMonthKey(now));
    
    // totalSpentOnMandatory: Only expenses that match a budget goal (by ID or legacy description)
    const totalSpentOnMandatory = monthTx.reduce((sum, tx) => {
        const isBudgeted = tx.budgetId || activeBudgetsThisMonth.some(bud => tx.desc.toLowerCase().includes(bud.name.toLowerCase()));
        return isBudgeted ? sum + tx.amount : sum;
    }, 0);

    const totalPlannedObligations = activeBudgetsThisMonth.reduce((s, b) => s + b.amount, 0);

    document.getElementById('net-worth').innerText = `Rs. ${netWealth.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    document.getElementById('liquid-cash').innerText = `Rs. ${liquidCash.toLocaleString(undefined, {minimumFractionDigits: 2})}`;

    // Render Components
    updateDailyGuide(totalPlannedObligations, totalSpentOnMandatory, liquidCash);
    renderAccountCarousel(balances);
    renderBudgetTab(getActiveBudgets(mKey), transactions.filter(tx => tx.type === 'expense' && getMonthKey(new Date(tx.date)) === mKey));
    renderAccounts(balances);
    renderLedger();
    updateDropdowns();

    // Credit Card Cycle
    const cc = accounts.find(a => a.type === 'credit');
    const cycleSection = document.getElementById('card-cycle-section');
    if (cc) { cycleSection.classList.remove('hidden'); updateCreditCycleInfo(cc); }
    else { cycleSection.classList.add('hidden'); }
}

function updateDailyGuide(totalMandatory, totalSpentOnMandatory, liquidCash) {
    const elLimit = document.getElementById('daily-limit');
    const elTip = document.getElementById('coach-tip');
    if (!elLimit || !elTip) return;

    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysLeft = Math.max(1, lastDay - now.getDate() + 1);

    // Remaining Obligations (portion of budgets not yet paid)
    const remainingObligations = Math.max(0, totalMandatory - totalSpentOnMandatory);
    
    // SAFE Residual = Your Spending Cash - What you still MUST pay this month
    const safeResidual = liquidCash - remainingObligations;
    const dailyRec = Math.max(0, safeResidual / daysLeft);

    elLimit.innerText = `Rs. ${dailyRec.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    
    // Update Detailed Math
    document.getElementById('math-liquid').innerText = `Rs. ${liquidCash.toLocaleString()}`;
    document.getElementById('math-bills').innerText = `- Rs. ${remainingObligations.toLocaleString()}`;
    document.getElementById('math-pool').innerText = `Rs. ${safeResidual.toLocaleString()}`;
    document.getElementById('math-days').innerText = `${daysLeft} Days Left`;

    if (liquidCash < remainingObligations) {
        elLimit.style.color = "var(--danger)";
        elTip.innerText = `⚠️ Stop! You only have Rs. ${liquidCash.toLocaleString()} in spending money, but have Rs. ${remainingObligations.toLocaleString()} in remaining bills. Your savings are now your only buffer!`;
    } else {
        elLimit.style.color = "var(--accent-cyan)";
        elTip.innerText = `After securing your bills (Leases/Rent), you have Rs. ${safeResidual.toLocaleString()} in Spending Cash left for the month. Your savings stay untouched! 🧘‍♂️`;
    }
}

function renderAccountCarousel(balances) {
    const list = document.getElementById('dash-account-carousel');
    if (!list) return;
    list.innerHTML = accounts.map(acc => `
        <div class="carousel-card">
            <h4>${acc.name}</h4>
            <span class="amount ${balances[acc.id] < 0 ? 'negative' : ''}">Rs. ${balances[acc.id].toLocaleString()}</span>
            <span class="type">${acc.type}</span>
        </div>
    `).join('');
}

function renderBudgetTab(activeBudgets, monthExpenses) {
    const list = document.getElementById('budget-list');
    if (!list) return;
    if (activeBudgets.length === 0) { list.innerHTML = '<li class="empty-state">No monthly goal set.</li>'; return; }
    list.innerHTML = activeBudgets.map(bud => {
        // Calculate spent value: Match by explicit budgetId OR fall back to legacy description matching
        const spentVal = monthExpenses
            .filter(tx => tx.budgetId === bud.id || (!tx.budgetId && tx.desc.toLowerCase().includes(bud.name.toLowerCase())))
            .reduce((s, tx) => s + tx.amount, 0);
            
        const prog = bud.amount > 0 ? Math.min(100, (spentVal / bud.amount) * 100) : 0;
        const color = spentVal > bud.amount ? 'var(--danger)' : 'var(--success)';
        const remaining = bud.amount - spentVal;
        
        return `
        <div class="budget-card">
            <div class="bud-header">
                <div class="bud-info"><h4>${bud.name}</h4><span>${bud.virtual ? '🔄 Recurring' : '📝 Monthly Specific'}</span></div>
                <div class="bud-stats">
                    <span class="bud-stat-val" style="color: ${color}">Rs. ${spentVal.toLocaleString()}</span>
                    <span class="bud-limit">of Rs. ${bud.amount.toLocaleString()}</span>
                </div>
            </div>
            <div class="progress-bar"><div class="progress-fill" style="width: ${prog}%; background: ${color}"></div></div>
            <div class="bud-footer">
                <span class="remaining-label" style="color: ${remaining < 0 ? 'var(--danger)' : 'var(--text-gray)'}">
                    ${remaining >= 0 ? 'Remaining: ' : 'Overspent: '} 
                    <strong>Rs. ${Math.abs(remaining).toLocaleString()}</strong>
                </span>
                <div class="action-btns"><button onclick="deleteBudget('${bud.id}', '${bud.monthKey}')" class="delete-btn">🗑️</button></div>
            </div>
        </div>`;
    }).join('');
}

function renderAccounts(balances) {
    const accList = document.getElementById('account-list');
    accList.innerHTML = accounts.map(acc => `
        <div class="acc-card">
            <div class="acc-info">
                <h4>${acc.name}</h4>
                <span>${acc.type === 'savings' ? '🔒 Savings Account' : acc.type}</span>
                <p class="acc-balance ${balances[acc.id] < 0 ? 'negative' : ''}">
                    Rs. ${balances[acc.id].toLocaleString(undefined, {minimumFractionDigits: 2})}
                </p>
            </div>
            <div class="action-btns">
                <button onclick="editAccount('${acc.id}')" class="edit-btn">✏️</button>
                <button onclick="removeAccount('${acc.id}')" class="delete-btn">🗑️</button>
            </div>
        </div>
    `).join('');
}

function renderLedger() {
    const filterVal = document.getElementById('filter-account')?.value || 'all';
    
    // Sort transactions reverse-chronologically
    const sortedAll = [...transactions].reverse();
    
    // Recent activity (Dashboard) - ALWAYS SHOW ALL
    renderTransactionList('recent-transaction-list', sortedAll.slice(0, 8));
    
    // Ledger List (Filtered)
    let filteredData = sortedAll;
    if (filterVal !== 'all') {
        filteredData = sortedAll.filter(tx => 
            tx.accountId === filterVal || tx.toAccountId === filterVal
        );
    }
    renderTransactionList('full-transaction-list', filteredData);
}

function renderTransactionList(id, data) {
    const list = document.getElementById(id); if (!list) return;
    if (data.length === 0) { list.innerHTML = '<li class="empty-state">No records found.</li>'; return; }
    list.innerHTML = data.map(tx => {
        const accFrom = accounts.find(a => a.id === tx.accountId)?.name || 'Unknown';
        const accTo = tx.type === 'transfer' ? accounts.find(a => a.id === tx.toAccountId)?.name || 'Unknown' : '';
        const descText = tx.type === 'transfer' ? `Transfer: ${accFrom} ⇆ ${accTo}` : tx.desc;
        const subText = tx.type === 'transfer' ? `Internal Movement • ${formatter.format(new Date(tx.date))}` : `${accFrom} • ${formatter.format(new Date(tx.date))}`;
        return `<li class="transaction-item">
            <div class="transaction-info"><span class="transaction-desc">${descText}</span><span class="transaction-date">${subText}</span></div>
            <div class="transaction-actions"><span class="transaction-amount ${tx.type}">${tx.type === 'income' ? '+' : ''}${tx.type === 'expense' ? '-' : ''}Rs. ${tx.amount.toLocaleString()}</span><div class="action-btns"><button onclick="editTransaction(${tx.id})" class="edit-btn">✏️</button><button onclick="removeTransaction(${tx.id})" class="delete-btn">🗑️</button></div></div>
        </li>`;
    }).join('');
}

function updateDropdowns() {
    ['account-select', 'account-to', 'filter-account'].forEach(sid => {
        const el = document.getElementById(sid); if (!el) return;
        const currentVal = el.value;
        let html = sid === 'filter-account' ? '<option value="all">All Accounts</option>' : '';
        html += accounts.map(acc => `<option value="${acc.id}">${acc.name}</option>`).join('');
        el.innerHTML = html;
        if (currentVal) el.value = currentVal;
    });

    // Populate Budget Select
    const budSelect = document.getElementById('budget-select');
    if (budSelect) {
        const currentVal = budSelect.value;
        const mKey = getMonthKey(currentViewDate);
        const activeBudgets = getActiveBudgets(mKey);
        let html = '<option value="">None / General Expense</option>';
        html += activeBudgets.map(b => `<option value="${b.id}">${b.name} (Goal: Rs. ${b.amount.toLocaleString()})</option>`).join('');
        budSelect.innerHTML = html;
        if (currentVal) budSelect.value = currentVal;
    }
}

function updateCreditCycleInfo(cc) {
    const now = new Date(); const today = now.getDate(); const bDay = cc.billingDay || 20;
    let statementDate = new Date(now.getFullYear(), now.getMonth() + (today > bDay ? 1 : 0), bDay);
    let zone = { badge: 'SAFE ZONE', title: 'Safe Spending', desc: 'Ideal for large purchases.', class: 'badge-safe', color: '#4ade80' };
    if (today >= 11 && today <= 15) zone = { badge: 'CAUTION ZONE', title: 'Window Shrinking', desc: 'Interest-free period is decreasing.', class: 'badge-warning', color: '#facc15' };
    else if (today >= 16 && today <= 20) zone = { badge: 'RISK ZONE', title: 'Critical Period', desc: 'Wait until next statement if possible!', class: 'badge-danger', color: '#f87171' };
    if (today >= 2 && today <= 5) { zone.title = "💳 Payment Window!"; zone.desc = "Salary received! Clear balance now."; }
    document.getElementById('cycle-account-name').innerText = `${cc.name.toUpperCase()} CYCLE`;
    document.getElementById('zone-badge').innerText = zone.badge;
    document.getElementById('zone-badge').className = `badge ${zone.class}`;
    document.getElementById('zone-title').innerText = zone.title;
    document.getElementById('zone-description').innerText = zone.desc;
    document.getElementById('days-remaining').innerText = `${Math.ceil((statementDate - now) / 86400000)} days left`;
    const prevStatement = new Date(statementDate.getTime()); prevStatement.setMonth(prevStatement.getMonth() - 1);
    const progressPercent = Math.min(100, Math.max(0, ((now - prevStatement) / (statementDate - prevStatement)) * 100));
    document.getElementById('cycle-progress').style.width = `${progressPercent}%`; document.getElementById('cycle-progress').style.background = zone.color;
}

// --- EVENTS ---
document.getElementById('type').onchange = (e) => {
    const isTransfer = e.target.value === 'transfer';
    const isExpense = e.target.value === 'expense';
    
    document.getElementById('group-to').classList.toggle('hidden', !isTransfer);
    document.getElementById('group-budget').classList.toggle('hidden', !isExpense);
    document.getElementById('group-from').querySelector('label').innerText = isTransfer ? 'From Account' : 'Account';
};

document.querySelectorAll('.tab-btn').forEach(btn => { btn.onclick = () => { document.querySelectorAll('.tab-btn, .tab-pane').forEach(el => el.classList.remove('active')); btn.classList.add('active'); document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active'); if (btn.dataset.tab === 'overview') updateUI();}; });
document.getElementById('prev-month').onclick = () => { currentViewDate.setMonth(currentViewDate.getMonth() - 1); updateUI(); };
document.getElementById('next-month').onclick = () => { currentViewDate.setMonth(currentViewDate.getMonth() + 1); updateUI(); };
document.getElementById('filter-account').onchange = () => renderLedger();
document.getElementById('daily-guide-section').onclick = () => {
    document.getElementById('daily-guide-section').classList.toggle('expanded');
    document.getElementById('coach-details').classList.toggle('hidden');
};

document.getElementById('quick-add-btn').onclick = () => { 
    document.getElementById('modal-title').innerText = "New Record"; 
    document.getElementById('edit-id').value = ""; 
    document.getElementById('transaction-form').reset(); 
    document.getElementById('group-to').classList.add('hidden'); 
    document.getElementById('group-budget').classList.remove('hidden'); // Default is expense
    document.getElementById('modal-overlay').classList.remove('hidden'); 
};
document.getElementById('add-budget-btn').onclick = () => document.getElementById('budget-modal-overlay').classList.remove('hidden');
document.getElementById('add-account-btn').onclick = () => { document.getElementById('acc-modal-title').innerText = "Add Account"; document.getElementById('edit-acc-id').value = ""; document.getElementById('account-form').reset(); document.getElementById('account-modal-overlay').classList.remove('hidden'); };
document.getElementById('close-modal').onclick = () => document.getElementById('modal-overlay').classList.add('hidden');
document.getElementById('close-bud-modal').onclick = () => document.getElementById('budget-modal-overlay').classList.add('hidden');
document.getElementById('close-acc-modal').onclick = () => document.getElementById('account-modal-overlay').classList.add('hidden');
document.getElementById('acc-type').onchange = (e) => document.getElementById('credit-fields').classList.toggle('hidden', e.target.value !== 'credit');

// --- FORMS ---
document.getElementById('budget-form').onsubmit = (e) => { e.preventDefault(); budgetPlans.push({ id: 'bud-' + Date.now(), name: document.getElementById('bud-name').value, amount: parseFloat(document.getElementById('bud-amount').value), monthKey: getMonthKey(currentViewDate), recurring: document.getElementById('bud-recurring').checked }); saveToStorage(); document.getElementById('budget-modal-overlay').classList.add('hidden'); };

document.getElementById('transaction-form').onsubmit = (e) => { 
    e.preventDefault(); 
    const id = document.getElementById('edit-id').value; 
    const tx = { 
        id: id ? parseInt(id) : Date.now(), 
        type: document.getElementById('type').value, 
        accountId: document.getElementById('account-select').value, 
        toAccountId: document.getElementById('account-to').value, 
        budgetId: document.getElementById('budget-select').value,
        amount: parseFloat(document.getElementById('amount').value), 
        desc: document.getElementById('desc').value, 
        date: id ? transactions.find(t => t.id == id).date : new Date().toISOString() 
    }; 
    if (id) transactions[transactions.findIndex(t => t.id == id)] = tx; 
    else transactions.push(tx); 
    saveToStorage(); 
    document.getElementById('modal-overlay').classList.add('hidden'); 
};

document.getElementById('account-form').onsubmit = (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-acc-id').value;
    const acc = {
        id: id ? id : 'acc-' + Date.now(),
        name: document.getElementById('acc-name').value,
        type: document.getElementById('acc-type').value,
        balance: parseFloat(document.getElementById('acc-balance').value),
        billingDay: parseInt(document.getElementById('billing-day').value) || 20
    };
    if (id) accounts[accounts.findIndex(a => a.id === id)] = acc;
    else accounts.push(acc);
    saveToStorage();
    document.getElementById('account-modal-overlay').classList.add('hidden');
};

(async function init() {
    if (backendUrl) await loadFromCloud();
    else { const statusEl = document.getElementById('sync-status'); statusEl.innerHTML = '<span class="dot"></span> Local Mode'; }
    updateUI();
})();

window.deleteBudget = (id, monthKey) => { if (confirm("Remove this goal?")) { const bud = budgetPlans.find(b => b.id === id); if (bud && bud.recurring && bud.monthKey < monthKey) budgetPlans.push({ ...bud, id: 'over-' + Date.now(), amount: 0, monthKey, recurring: false }); else budgetPlans = budgetPlans.filter(b => b.id !== id); saveToStorage(); } };
window.removeAccount = (id) => { if (confirm("Delete this account and transactions?")) { accounts = accounts.filter(a => a.id !== id); transactions = transactions.filter(t => t.accountId !== id && t.toAccountId !== id); saveToStorage(); } };
window.editAccount = (id) => { const acc = accounts.find(a => a.id === id); if (!acc) return; document.getElementById('acc-modal-title').innerText = "Edit Account"; document.getElementById('edit-acc-id').value = acc.id; document.getElementById('acc-name').value = acc.name; document.getElementById('acc-type').value = acc.type; document.getElementById('acc-balance').value = acc.balance; document.getElementById('billing-day').value = acc.billingDay || 20; document.getElementById('credit-fields').classList.toggle('hidden', acc.type !== 'credit'); document.getElementById('account-modal-overlay').classList.remove('hidden'); };
window.removeTransaction = (id) => { if (confirm("Delete?")) { transactions = transactions.filter(t => t.id != id); saveToStorage(); } };
window.editTransaction = (id) => { 
    const tx = transactions.find(t => t.id == id); 
    if (!tx) return; 
    document.getElementById('modal-title').innerText = "Edit Record"; 
    document.getElementById('edit-id').value = tx.id; 
    document.getElementById('type').value = tx.type; 
    document.getElementById('account-select').value = tx.accountId; 
    
    if (tx.type === 'transfer') { 
        document.getElementById('group-to').classList.remove('hidden'); 
        document.getElementById('account-to').value = tx.toAccountId; 
    } else { 
        document.getElementById('group-to').classList.add('hidden'); 
    } 

    if (tx.type === 'expense') {
        document.getElementById('group-budget').classList.remove('hidden');
        document.getElementById('budget-select').value = tx.budgetId || "";
    } else {
        document.getElementById('group-budget').classList.add('hidden');
    }

    document.getElementById('amount').value = tx.amount; 
    document.getElementById('desc').value = tx.desc; 
    document.getElementById('modal-overlay').classList.remove('hidden'); 
};
document.getElementById('open-settings').onclick = () => { document.getElementById('backend-url').value = backendUrl; document.getElementById('settings-overlay').classList.remove('hidden'); };
document.getElementById('close-settings').onclick = () => document.getElementById('settings-overlay').classList.add('hidden');
document.getElementById('save-settings').onclick = async () => { backendUrl = document.getElementById('backend-url').value.trim(); localStorage.setItem('card-tracker-backend', backendUrl); await loadFromCloud(); if (!transactions.length) await syncToCloud(); document.getElementById('settings-overlay').classList.add('hidden'); };
document.getElementById('clear-data').onclick = () => { if(confirm("Wipe all data?")) { transactions = []; accounts = DEFAULT_ACCOUNTS; budgetPlans = []; saveToStorage(); } };
