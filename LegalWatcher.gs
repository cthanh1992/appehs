// FILE: LegalWatcher.gs

// ID Spreadsheet của bạn
const CHECK_SHEET_ID = "1kNOZMlKPIsOYXiqhqVCAJBLiBirkqxCUf0dyCFTL4JA"; 
const SHEET_NAME = "Legal_Database";

// Cấu hình cột theo cấu trúc (Số thứ tự cột tính từ A=1)
const COL_LINK_CHECK = 6;   // Cột F: Link_Check_Status
const COL_STATUS_WRITE = 7; // Cột G: Status

function runLegalCheck() {
  var ss = SpreadsheetApp.openById(CHECK_SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return;

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  
  // Lấy dữ liệu từ dòng 2, cột 1 đến hết dòng có dữ liệu, giới hạn ở 7 cột
  var range = sheet.getRange(2, 1, lastRow - 1, 7); 
  var values = range.getValues();

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var link = row[COL_LINK_CHECK - 1]; 
    var currentStatus = row[COL_STATUS_WRITE - 1];

    if (link && String(link).indexOf("vbpl.vn") > -1) {
      try {
        var response = UrlFetchApp.fetch(link, {muteHttpExceptions: true});
        var html = response.getContentText();

        var newStatus = "❓ KHÔNG TÌM THẤY DỮ LIỆU";
        var alertColor = "white"; 

        var jsonRegex = /<script type="application\/ld\+json">(\{.*?"@type":"Legislation".*?\})<\/script>/is;
        var match = html.match(jsonRegex);

        if (match && match[1]) {
           var jsonData = JSON.parse(match[1]);
           var legalForce = jsonData.legislationLegalForce;

           if (legalForce === "InForce") {
              newStatus = "✅ Đang hiệu lực";
              alertColor = "#e6ffe6"; 
           } else if (legalForce === "NotInForce" || legalForce === "OutOfForce") {
              newStatus = "⛔ HẾT HIỆU LỰC";
              alertColor = "#ffcccc"; 
           } else if (legalForce === "PartiallyInForce") {
              newStatus = "⚠️ HẾT HIỆU LỰC 1 PHẦN";
              alertColor = "#ffe0b2"; 
           } else if (legalForce === "Pending") {
              newStatus = "📅 CHƯA CÓ HIỆU LỰC";
              alertColor = "#e6f7ff"; 
           } else {
              newStatus = "⏳ ĐANG CẬP NHẬT: " + legalForce;
              alertColor = "#fff5cc"; 
           }
        } else {
           if (html.indexOf('"legislationLegalForce":"InForce"') > -1) {
              newStatus = "✅ Đang hiệu lực";
              alertColor = "#e6ffe6";
           } else if (html.indexOf('"legislationLegalForce":"NotInForce"') > -1) {
              newStatus = "⛔ HẾT HIỆU LỰC";
              alertColor = "#ffcccc";
           }
        }

        if (currentStatus !== newStatus) {
            var cellStatus = sheet.getRange(i + 2, COL_STATUS_WRITE);
            cellStatus.setValue(newStatus);
            cellStatus.setBackground(alertColor);
        }

        Utilities.sleep(1000);

      } catch (e) {
        console.error("Lỗi dòng " + (i+2) + ": " + e.toString());
      }
    }
  }
}
