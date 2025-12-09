// FILE: LegalWatcher.gs

// ID Spreadsheet của bạn
const CHECK_SHEET_ID = "1kNOZMlKPIsOYXiqhqVCAJBLiBirkqxCUf0dyCFTL4JA"; 
const SHEET_NAME = "Legal_Database";

// Cấu hình cột (Số thứ tự cột tính từ A=1)
const COL_LINK_CHECK = 6; // Cột F (Link VBPL)
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

        // 1. KHOANH VÙNG TÌM KIẾM (Tránh đọc nhầm chân trang)
        var searchZone = "";
        var keywordIndex = html.indexOf("Tình trạng hiệu lực"); 
        if (keywordIndex === -1) keywordIndex = html.indexOf("Hiệu lực:");
        if (keywordIndex === -1) keywordIndex = html.indexOf("Trạng thái:");

        if (keywordIndex !== -1) {
            // Lấy 500 ký tự ngay sau nhãn để check
            searchZone = html.substring(keywordIndex, keywordIndex + 500);
        } else {
            // Không tìm thấy nhãn thì quét đầu trang
            searchZone = html.substring(0, 3000); 
        }

        // 2. PHÂN TÍCH TRẠNG THÁI (Logic ưu tiên)
        var newStatus = "✅ Đang hiệu lực"; 
        var alertColor = "white"; 

        var lowerZone = searchZone.toLowerCase();

        // --- ƯU TIÊN 1: Kiểm tra "Một phần" trước ---
        if (lowerZone.indexOf("hết hiệu lực một phần") > -1 || lowerZone.indexOf("ngưng hiệu lực một phần") > -1) {
            newStatus = "⚠️ HẾT HIỆU LỰC 1 PHẦN";
            alertColor = "#ffe0b2"; // Màu Cam nhạt
        } 
        // --- ƯU TIÊN 2: Kiểm tra Hết hiệu lực hoàn toàn ---
        else if (lowerZone.indexOf("hết hiệu lực") > -1 || lowerZone.indexOf("hết thời hạn") > -1) {
            newStatus = "⛔ HẾT HIỆU LỰC"; // Đổi icon cho khác biệt
            alertColor = "#ffcccc"; // Màu Đỏ nhạt
        } 
        // --- Các trạng thái khác ---
        else if (lowerZone.indexOf("bị hủy bỏ") > -1 || lowerZone.indexOf("văn bản thay thế") > -1) {
            newStatus = "❌ BỊ HỦY BỎ/THAY THẾ";
            alertColor = "#ffeb99"; // Màu Vàng
        } else if (lowerZone.indexOf("sắp hết hiệu lực") > -1) {
            newStatus = "⏳ SẮP HẾT HIỆU LỰC";
            alertColor = "#fff5cc"; 
        } else if (lowerZone.indexOf("chưa có hiệu lực") > -1) {
             newStatus = "📅 CHƯA CÓ HIỆU LỰC";
             alertColor = "#e6f7ff";
        }

        // 3. Ghi kết quả vào Sheet (Chỉ ghi khi có thay đổi)
        if (currentStatus !== newStatus) {
            var cellStatus = sheet.getRange(i + 2, COL_STATUS_WRITE);
            cellStatus.setValue(newStatus);
            cellStatus.setBackground(alertColor);
            console.log("Cập nhật dòng " + (i+2) + ": " + newStatus);
        }

        Utilities.sleep(1000); // Nghỉ 1 giây

      } catch (e) {
        console.error("Lỗi dòng " + (i+2) + ": " + e.toString());
      }
    }
  }
}
