// FILE: LegalWatcher.gs

// ID Spreadsheet của bạn
const CHECK_SHEET_ID = "1kNOZMlKPIsOYXiqhqVCAJBLiBirkqxCUf0dyCFTL4JA"; 
const SHEET_NAME = "Legal_Database";

// Cấu hình cột (Số thứ tự cột tính từ A=1)
const COL_LINK_CHECK = 6;   // Cột F (Link VBPL)
const COL_STATUS_WRITE = 7; // Cột G (Ghi kết quả)

function runLegalCheck() {
  var ss = SpreadsheetApp.openById(CHECK_SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return;

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var range = sheet.getRange(2, 1, lastRow - 1, 10);
  var values = range.getValues();

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var link = row[COL_LINK_CHECK - 1]; 
    var currentStatus = row[COL_STATUS_WRITE - 1];

    // Chỉ check những dòng có Link VBPL
    if (link && String(link).indexOf("vbpl.vn") > -1) {
      try {
        var response = UrlFetchApp.fetch(link, {muteHttpExceptions: true});
        var html = response.getContentText();

        var newStatus = "❓ KHÔNG TÌM THẤY DỮ LIỆU";
        var alertColor = "white"; 

        // PHÂN TÍCH THEO CẤU TRÚC JSON-LD MỚI CỦA VBPL.VN
        // Quét tìm thẻ script chứa thuộc tính "@type":"Legislation"
        var jsonRegex = /<script type="application\/ld\+json">(\{.*?"@type":"Legislation".*?\})<\/script>/is;
        var match = html.match(jsonRegex);

        if (match && match[1]) {
           var jsonData = JSON.parse(match[1]);
           var legalForce = jsonData.legislationLegalForce;

           // Phân loại trạng thái theo chuẩn Schema.org của VBPL
           if (legalForce === "InForce") {
              newStatus = "✅ Đang hiệu lực";
              alertColor = "#e6ffe6"; // Xanh lá nhạt
           } else if (legalForce === "NotInForce" || legalForce === "OutOfForce") {
              newStatus = "⛔ HẾT HIỆU LỰC";
              alertColor = "#ffcccc"; // Đỏ nhạt
           } else if (legalForce === "PartiallyInForce") {
              newStatus = "⚠️ HẾT HIỆU LỰC 1 PHẦN";
              alertColor = "#ffe0b2"; // Cam nhạt
           } else if (legalForce === "Pending") {
              newStatus = "📅 CHƯA CÓ HIỆU LỰC";
              alertColor = "#e6f7ff"; // Xanh dương nhạt
           } else {
              newStatus = "⏳ ĐANG CẬP NHẬT: " + legalForce;
              alertColor = "#fff5cc"; // Vàng nhạt
           }
        } else {
           // Dự phòng nếu VBPL trả về file HTML dạng SSR tĩnh
           if (html.indexOf('"legislationLegalForce":"InForce"') > -1) {
              newStatus = "✅ Đang hiệu lực";
              alertColor = "#e6ffe6";
           } else if (html.indexOf('"legislationLegalForce":"NotInForce"') > -1) {
              newStatus = "⛔ HẾT HIỆU LỰC";
              alertColor = "#ffcccc";
           }
        }

        // 3. Ghi kết quả vào Sheet (Chỉ ghi khi có thay đổi)
        if (currentStatus !== newStatus) {
            var cellStatus = sheet.getRange(i + 2, COL_STATUS_WRITE);
            cellStatus.setValue(newStatus);
            cellStatus.setBackground(alertColor);
            console.log("Cập nhật dòng " + (i+2) + ": " + newStatus);
        }

        Utilities.sleep(1000); // Nghỉ 1 giây chống block IP

      } catch (e) {
        console.error("Lỗi dòng " + (i+2) + ": " + e.toString());
      }
    }
  }
}
