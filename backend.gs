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
  
  // Ensure we return valid JSON or empty array
  var content = "[]";
  if (data && data.trim()) {
      content = data;
  }
  
  return ContentService.createTextOutput(content)
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const contents = e.postData.contents;
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Validate contents is non-empty before saving
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
