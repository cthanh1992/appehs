// FILE: LegalBackend.gs
// Thay ID Sheet chứa dữ liệu luật của bạn vào đây
const LEGAL_SHEET_ID = "DIEN_ID_SHEET_CUA_BAN_VAO_DAY"; 

function getLegalData() {
  try {
    const ss = SpreadsheetApp.openById(LEGAL_SHEET_ID);
    const sheet = ss.getSheetByName("Legal_Database");
    if (!sheet) return JSON.stringify({ error: true, message: "Không tìm thấy Sheet 'Legal_Database'" });

    // Lấy dữ liệu từ dòng 2 (bỏ tiêu đề)
    const range = sheet.getDataRange();
    const values = range.getValues();
    if (values.length <= 1) return JSON.stringify([]);
    values.shift(); // Xóa dòng tiêu đề

    // Map dữ liệu theo cấu trúc cột A, B, C, D, E
    const legalList = values.map(function(row) {
      // Bỏ qua dòng trống
      if (!row[1]) return null;

      // Xử lý ngày tháng cho đẹp
      let dateStr = "";
      if (row[2] instanceof Date) {
        dateStr = Utilities.formatDate(row[2], Session.getScriptTimeZone(), "dd/MM/yyyy");
      } else {
        dateStr = String(row[2] || "");
      }

      return {
        category: String(row[0] || "Khác"), // Cột A: Lĩnh vực
        name: String(row[1]),               // Cột B: Tên văn bản
        date: dateStr,                      // Cột C: Ngày hiệu lực
        linkWord: String(row[3] || ""),     // Cột D: Link Word
        linkPdf: String(row[4] || "")       // Cột E: Link PDF
      };
    }).filter(item => item !== null);

    return JSON.stringify(legalList);

  } catch (e) {
    return JSON.stringify({ error: true, message: e.toString() });
  }
}
