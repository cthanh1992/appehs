// FILE 3: ChecklistBackend.gs
// Chứa logic xử lý Checklist, Upload ảnh và Gửi Email

// 1. Cấu hình ID
const FOLDER_ID_UPLOAD = "1Tf7VmMjXPKJ0QW7I18plFnpAkIA60ENs"; 
const SHEET_ID = "1kNOZMlKPIsOYXiqhqVCAJBLiBirkqxCUf0dyCFTL4JA";

// 2. Email người nhận báo cáo lỗi
const MANAGER_EMAIL = "thanhhc@hoptrisummit.com"; 

/**
 * Lấy câu hỏi từ Sheet Master
 */
function getQuestionsByChecklistID(checklistId) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName("Checklist_Master");
  
  if (!sheet) throw new Error("LỖI: Không tìm thấy Sheet 'Checklist_Master'");
  
  const data = sheet.getDataRange().getValues();
  data.shift(); 
  
  const questions = [];
  
  data.forEach(function(row) {
    if (String(row[0]) === String(checklistId)) {
      questions.push({
        checklistId: row[0],
        qId: String(row[1]),
        order: row[2],
        content: row[3],
        type: row[4],
        required: row[5],
        options: row[6],
        parentId: row[7] ? String(row[7]) : "",
        conditionValue: row[8] ? String(row[8]) : "",
        description: row[9] ? String(row[9]) : "" 
      });
    }
  });

  questions.sort(function(a, b) { return a.order - b.order; });
  return questions;
}

/**
 * Lưu báo cáo + Gửi Email
 */
function saveDynamicReport(dataObj) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Checklist_Records");
    
    if (!sheet) {
      sheet = ss.insertSheet("Checklist_Records");
      sheet.appendRow(["ReportID", "Thời gian", "ChecklistID", "Người kiểm tra / Info", "Kết quả", "Dữ liệu chi tiết (JSON)"]);
    }

    const timestamp = new Date();
    const reportID = "RPT_" + timestamp.getTime(); 
    const folder = DriveApp.getFolderById(FOLDER_ID_UPLOAD);
    
    // Xử lý ảnh
    dataObj.answers.forEach(function(ans) {
      ans.imageLinks = [];
      if (ans.images && ans.images.length > 0) {
        ans.images.forEach(function(base64Str, index) {
          if(base64Str.indexOf('base64,') > -1) {
             const encoded = base64Str.split(',')[1];
             const decoded = Utilities.base64Decode(encoded);
             const fileName = reportID + "_" + ans.qId + "_" + index + ".jpg";
             const blob = Utilities.newBlob(decoded, MimeType.JPEG, fileName);
             const file = folder.createFile(blob);
             ans.imageLinks.push(file.getUrl());
          }
        });
        delete ans.images; 
      }
    });

    // --- [PHẦN SỬA ĐỔI QUAN TRỌNG] --- 
    // Cấu hình ID câu hỏi chứa "Họ tên" cho từng loại phiếu
    const INSPECTOR_QID_MAP = {
      'CHECKPLANT': 'Q03',
      'CHECKWAREHOUSE': 'Q03',
      'CHECKLAB': 'Q02',
      'CHECKHR': 'Q03',
      'CHECKNBC': 'Q02'
    };

    let inspectorInfo = "N/A";
    
    // Cách 1: Lấy chính xác theo ID (Ưu tiên cao nhất)
    const targetQId = INSPECTOR_QID_MAP[dataObj.checklistId];
    if (targetQId) {
        const exactQ = dataObj.answers.find(a => String(a.qId) === String(targetQId));
        if (exactQ && exactQ.value) inspectorInfo = exactQ.value;
    }

    // Cách 2: (Dự phòng) Nếu không tìm thấy, mới tìm theo từ khóa
    if (inspectorInfo === "N/A") {
        const nameQ = dataObj.answers.find(a => 
            (a.type === 'TEXT') && 
            (a.question.toLowerCase().includes('tên') || a.question.toLowerCase().includes('người'))
        );
        if (nameQ) inspectorInfo = nameQ.value;
    }
    // ---------------------------------
    
    const failItems = dataObj.answers.filter(a => a.value === 'NO');
    const failCount = failItems.length;
    const resultSummary = failCount > 0 ? (failCount + " Lỗi (Fail)") : "Đạt (Pass)";

    // Lưu vào Sheet
    sheet.appendRow([
      reportID,
      timestamp,
      dataObj.checklistId,
      inspectorInfo,
      resultSummary,
      JSON.stringify(dataObj.answers)
    ]);

    // Gửi Email nếu có lỗi
    if (failCount > 0 && MANAGER_EMAIL && MANAGER_EMAIL.includes("@")) {
        sendAlertEmail(MANAGER_EMAIL, reportID, dataObj.checklistId, inspectorInfo, failItems, timestamp);
    }

    return { success: true, message: "Đã lưu báo cáo thành công!" };
    
  } catch (e) {
    return { success: false, message: "Lỗi Server: " + e.toString() };
  }
}

// Hàm gửi Email HTML
function sendAlertEmail(recipient, reportId, checklistName, inspector, failItems, time) {
    const subject = `⚠️ CẢNH BÁO EHS: ${checklistName} - Phát hiện ${failItems.length} lỗi`;
    
    let rowsHtml = "";
    failItems.forEach((item, index) => {
        let imgLinksHtml = "";
        if (item.imageLinks && item.imageLinks.length > 0) {
            item.imageLinks.forEach((link, i) => {
                imgLinksHtml += `<a href="${link}" style="color:#d93025;" target="_blank">[Ảnh ${i+1}]</a> `;
            });
        }
        rowsHtml += `
        <tr style="border-bottom:1px solid #eee;">
            <td style="padding:10px;border:1px solid #ddd;">${index + 1}</td>
            <td style="padding:10px;border:1px solid #ddd;"><strong>${item.question}</strong></td>
            <td style="padding:10px;border:1px solid #ddd;color:#d93025;">${item.note || ""}</td>
            <td style="padding:10px;border:1px solid #ddd;">${imgLinksHtml}</td>
        </tr>`;
    });

    const htmlBody = `
    <div style="font-family:Arial,sans-serif;color:#333;">
        <h2 style="background-color:#d93025;color:white;padding:10px;">BÁO CÁO SỰ CỐ AN TOÀN</h2>
        <p><strong>Mã:</strong> ${reportId} | <strong>Người kiểm tra:</strong> ${inspector} | <strong>Thời gian:</strong> ${time.toLocaleString("vi-VN")}</p>
        <table style="width:100%;border-collapse:collapse;">
            <tr style="background-color:#f2f2f2;"><th style="padding:10px;border:1px solid #ddd;">STT</th><th style="padding:10px;border:1px solid #ddd;">Nội dung</th><th style="padding:10px;border:1px solid #ddd;">Lỗi</th><th style="padding:10px;border:1px solid #ddd;">Ảnh</th></tr>
            ${rowsHtml}
        </table>
    </div>`;

    MailApp.sendEmail({ to: recipient, subject: subject, htmlBody: htmlBody });
}
