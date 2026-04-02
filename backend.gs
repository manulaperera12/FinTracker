/**
 * FINTRACKER BACKEND - Google Apps Script (v2.0)
 * 
 * Supports both Multi-Account and Transaction tracking.
 * 
 * 1. Open your Apps Script editor.
 * 2. Replace all existing code with this updated version.
 * 3. Click 'Deploy' > 'New Deployment'.
 * 4. Select: 'Web App'.
 * 5. Description: 'FinTracker v2'.
 * 6. Execute as: 'Me'.
 * 7. Who has access: 'Anyone'.
 * 8. Click 'Deploy'. 
 * 9. IMPORTANT: Use the NEW URL if it changes.
 */

function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getRange(1, 1).getValue();
  
  // Default structure for the new unified dashboard
  var content = JSON.stringify({ "transactions": [], "accounts": [] });
  
  if (data && data.trim()) {
    try {
      // Check if it's already the new format
      const parsed = JSON.parse(data);
      if (parsed.transactions && parsed.accounts) {
         content = data;
      } else if (Array.isArray(parsed)) {
         // Migration: Handle old array-only format
         content = JSON.stringify({ "transactions": parsed, "accounts": [] });
      }
    } catch (e) {
      console.warn("Raw data is not JSON, returning default structure.");
    }
  }
  
  return ContentService.createTextOutput(content)
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const contents = e.postData.contents;
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    if (contents && contents.trim()) {
        sheet.getRange(1, 1).setValue(contents);
    }
    
    return ContentService.createTextOutput(JSON.stringify({status: "success"}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
