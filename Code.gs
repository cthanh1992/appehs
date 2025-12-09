function doGet() {
  // Lưu ý: Đảm bảo bạn có file tên là "Index" (chữ I viết hoa hay thường phải khớp tên file)
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('EHS App Mobile')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getMenuData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("MenuData"); 
  if (!sheet) return JSON.stringify([]);

  // Lấy toàn bộ dữ liệu đang có trong sheet
  var range = sheet.getDataRange();
  var data = range.getValues();
  
  // Xóa dòng tiêu đề (Header)
  data.shift(); 

  var menuList = data.map(function(row) {
    // --- XỬ LÝ QUAN TRỌNG ---
    // Vì cột Note (Cột I - index 8) có thể bị trống ở các dòng đầu
    // row[8] có thể trả về undefined.
    // Ta dùng logic: (row[8] || "") -> Nếu không có gì thì coi là chuỗi rỗng
    // String(...) -> Ép kiểu thành chữ để chắc chắn JSON không xóa nó
    var noteVal = String(row[8] || ""); 

    return {
      id: row[0],
      parent: row[1],
      name: row[2],
      order: row[3],
      action: row[4],
      icon: row[5],
      type: row[6],
      color: row[7],
      note: noteVal // Bây giờ note luôn luôn có giá trị (dù là rỗng)
    };
  });

  return JSON.stringify(menuList);
}

// 2. HÀM LẤY DỮ LIỆU LỊCH SỬ (Đã chỉnh sửa trả về JSON)
function getHistoryRecords(checklistId, startDateStr, endDateStr) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Checklist_Records");
  if (!sheet) return JSON.stringify([]);
  
  var data = sheet.getDataRange().getValues();
  data.shift(); // Bỏ header

  var start = new Date(startDateStr); start.setHours(0,0,0,0);
  var end = new Date(endDateStr); end.setHours(23,59,59,999);

  var result = data.filter(function(row) {
    var rId = row[2]; 
    var rTime = new Date(row[1]); 
    return (rId === checklistId && rTime >= start && rTime <= end);
  }).map(function(row) {
    
    // --- XỬ LÝ CHI TIẾT LỖI ---
    var fullData = [];
    var location = "N/A";
    var area = "N/A";
    var errorCount = 0;
    var issues = []; // Danh sách các vấn đề cụ thể

    try {
      fullData = JSON.parse(row[5] || "[]");
      
      fullData.forEach(function(item) {
        // Lấy thông tin định danh
        if (item.question === "Vị trí") location = item.value;
        if (item.question === "Khu vực") area = item.value;
        
        // Logic xác định Lỗi: Value là NO/FAIL hoặc có Ghi chú/Ảnh
        var isFail = (String(item.value).toUpperCase() === "NO" || String(item.value).toUpperCase() === "FAIL");
        var hasNote = item.note && item.note !== "";
        var hasImage = item.imageLinks && item.imageLinks.length > 0;

        // Nếu là lỗi hoặc có ghi chú quan trọng thì đưa vào danh sách Issues
        if (isFail || hasNote || hasImage) {
           if (isFail) errorCount++;
           
           issues.push({
             question: item.question,
             value: item.value,
             note: item.note,
             images: item.imageLinks || [] // Trả về mảng link ảnh
           });
        }
      });
    } catch (e) {}

    return {
      reportId: row[0],
      time: row[1],
      inspector: row[3],
      result: row[4],
      location: location,
      area: area,
      errorCount: errorCount,
      issues: issues // Gửi kèm danh sách lỗi chi tiết
    };
  });
  
  return JSON.stringify(result.reverse());
}
// 3. CÁC HÀM LOAD MODULE (Quan trọng nhất bước này)

// Đây là chỗ thay đổi: Gọi file Statistics.html ra hiển thị
function loadStatisticsModule() { 
  return HtmlService.createTemplateFromFile('Statistics').evaluate().getContent(); 
}

// --- SỬA LẠI ĐOẠN NÀY TRONG CODE.GS ---

// 1. Hàm gọi module MSDS (SỬA QUAN TRỌNG)
function loadMsdsModule() {
  // PHẢI DÙNG createTemplateFromFile THÌ MỚI HIỂU HÀM include()
  return HtmlService.createTemplateFromFile('MSDS').evaluate().getContent();
}
function loadLegalSearchModule() {
  return HtmlService.createTemplateFromFile('LegalSearch').evaluate().getContent();
}

// 2. Hàm gọi module Checklist (Nên sửa luôn cho đồng bộ)
function loadChecklistForm() {
  return HtmlService.createTemplateFromFile('Checklist').evaluate().getContent();
}
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
function loadLegalSearchModule() {
  return HtmlService.createTemplateFromFile('LegalSearch').evaluate().getContent();
}
