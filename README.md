# 💳 Card Tracker | Commercial Bank Platinum Edition

A premium, 100% free web-based credit card spending dashboard designed to help you maximize your interest-free period.

## ✨ Features
- **Billing Cycle Logic**: Hardcoded for the 20th Statement Date (ComBank Platinum).
- **Spending Zones**: Visual indicators (Green/Yellow/Red) showing the safety of current purchases.
- **Payment Reminders**: Alerts when salary arrives (2nd-5th) to pay the full outstanding balance.
- **100% Free Persistence**: Sync your data to a private Google Sheet.
- **Offline First**: Works locally in your browser (LocalStorage).

---

## 🚀 How to Host on GitHub Pages (100% Free)

1. Create a new repository on GitHub (e.g., `card-tracker`).
2. Upload the following files to the main branch:
   - `index.html`
   - `style.css`
   - `app.js`
3. Go to **Settings > Pages**.
4. Under **Build and deployment**, set Source to **Deploy from a branch**.
5. Select the `main` branch and click **Save**.
6. Your site will be live at `https://[your-username].github.io/card-tracker/`.

---

## ☁️ Setting Up Persistent Storage (No Data Loss)

By default, data is saved in your browser. To ensure it's never cleared, use the Google Sheets Sync:

1. Create a **New Google Sheet**.
2. Go to **Extensions > Apps Script**.
3. Copy the code from `backend.gs` (provided in this repo) and paste it there.
4. Click **Deploy > New Deployment**.
   - **Type**: Web App
   - **Execute as**: Me
   - **Who has access**: Anyone
5. Click **Deploy** and copy the **Web App URL**.
6. Open your hosted Card Tracker, click the **⚙️ Sync Settings** button, and paste the URL.
7. Click **Connect & Sync**.

---

## 🛠️ Tech Stack
- **HTML5 / Vanilla CSS** (Glassmorphism design)
- **Vanilla JavaScript** (ES6+)
- **Google Apps Script** (Free DB backend)
- **GitHub Pages** (Free hosting)

*Built by Antigravity.*
