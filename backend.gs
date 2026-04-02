/**
 * CARD TRACKER BACKEND - Google Apps Script
 * 
 * 1. Create a New Google Sheet.
 * 2. Go to Extensions > Apps Script.
 * 3. Paste this code.
 * 4. Click 'Deploy' > 'New Deployment'.
 * 5. Select 'Web App'.
 * 6. Execute as: 'Me'.
 * 7. Who has access: 'Anyone' (This makes it a public API for your personal use).
 * 8. Copy the Web App URL and paste it into the Card Tracker settings.
 */

function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getRange(1, 1).getValue();
  
  return ContentService.createTextOutput(data || "[]")
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const contents = e.postData.contents;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  // Clear and update with new JSON
  sheet.getRange(1, 1).setValue(contents);
  
  return ContentService.createTextOutput(JSON.stringify({status: "success"}))
    .setMimeType(ContentService.MimeType.JSON);
}

// Add CORS support
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}
