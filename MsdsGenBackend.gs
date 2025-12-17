// FILE: MsdsGenBackend.gs

// --- CẤU HÌNH ---
const GEN_CONFIG = {
  // [MỚI] ID CỦA FILE GOOGLE SHEET DATA (Dán ID bạn vừa hỏi vào đây)
  SOURCE_SS_ID: '1WHIYcmS_tyPDs1sLq9yhO8wAeCdCNeCqzwQ1Yjp30TY', 

  TEMPLATE_ID: '1QHPsIHpkf3q-AzmBbDSqxRg-KyUrx4SRTsH71HbmZvE',       // <-- Thay ID file Doc mẫu vào đây
  OUTPUT_FOLDER_ID: 'I1Qjudj6SRO6vtMq2EBl5VYBxtcIvWzalX',    // <-- Thay ID Folder lưu PDF vào đây
  
  SHEET_INPUT: 'Input',           // Tên Tab chứa dữ liệu (Lưu ý: Tab của bạn phải tên là "Input")
  SHEET_LINK: 'GHS+PPE',     // Tên Tab chứa Link ảnh
  
  MARKERS: ['x', 'v', 'có', 'yes', '√'] 
};

// 1. Hàm lấy danh sách Nguyên liệu
function getMaterialList() {
  // [SỬA ĐỔI] Dùng openById để mở chính xác file Sheet theo ID
  const ss = SpreadsheetApp.openById(GEN_CONFIG.SOURCE_SS_ID);
  const sheet = ss.getSheetByName(GEN_CONFIG.SHEET_INPUT);
  
  if (!sheet) throw new Error(`Không tìm thấy Tab tên là "${GEN_CONFIG.SHEET_INPUT}". Hãy kiểm tra lại tên Tab.`);

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data[0];
  const nameIdx = headers.findIndex(h => String(h).toLowerCase().includes("tên nguyên liệu"));
  
  if (nameIdx === -1) throw new Error('Không tìm thấy cột "Tên nguyên liệu".');

  let list = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][nameIdx]) {
      list.push({ name: data[i][nameIdx], rowIndex: i });
    }
  }
  return list;
}

// 2. Hàm xử lý tạo 1 file MSDS duy nhất
function generateSingleMsds(rowIndex) {
  try {
    // [SỬA ĐỔI] Dùng openById thay vì getActiveSpreadsheet
    const ss = SpreadsheetApp.openById(GEN_CONFIG.SOURCE_SS_ID);
    
    // --- A. LẤY MAP ẢNH ---
    const linkSheet = ss.getSheetByName(GEN_CONFIG.SHEET_LINK);
    if (!linkSheet) throw new Error(`Không tìm thấy Sheet "${GEN_CONFIG.SHEET_LINK}"`);

    const linkData = linkSheet.getDataRange().getValues(); 
    let imageMap = {};
    
    // Duyệt qua từng dòng của sheet Link (Dạng cột dọc)
    for (let i = 0; i < linkData.length; i++) {
       let name = String(linkData[i][0]).trim(); 
       let linkVal = String(linkData[i][1]);     
       
       if (name && linkVal) {
          let match = linkVal.match(/id=([a-zA-Z0-9_-]+)/) || linkVal.match(/\/d\/([a-zA-Z0-9_-]+)/);
          let fileId = match ? match[1] : linkVal; 
          if (fileId.length > 5) imageMap[name] = fileId;
       }
    }

    // --- B. LẤY DỮ LIỆU INPUT ---
    const inputSheet = ss.getSheetByName(GEN_CONFIG.SHEET_INPUT);
    const inputData = inputSheet.getDataRange().getValues();
    const headers = inputData[0];
    const row = inputData[rowIndex]; 
    
    const nameIdx = headers.findIndex(h => String(h).toLowerCase().includes("tên nguyên liệu"));
    const materialName = (nameIdx > -1) ? row[nameIdx] : "Unknown";

    // --- C. XỬ LÝ FILE DOC ---
    const docTemplate = DriveApp.getFileById(GEN_CONFIG.TEMPLATE_ID);
    const destFolder = DriveApp.getFolderById(GEN_CONFIG.OUTPUT_FOLDER_ID);
    
    const copyFile = docTemplate.makeCopy(`MSDS ${materialName}`, destFolder);
    const copyDoc = DocumentApp.openById(copyFile.getId());
    const body = copyDoc.getBody();

    // --- D. ĐIỀN TEXT ---
    headers.forEach((h, idx) => {
      body.replaceText(`\\[${h}\\]`, String(row[idx] || ""));
    });

    // --- E. CHÈN ẢNH ---
    let imagesToInsert = [];
    headers.forEach((colName, colIdx) => {
      if (imageMap[colName]) {
        let cellVal = String(row[colIdx]).toLowerCase().trim();
        if (GEN_CONFIG.MARKERS.some(m => cellVal.includes(m))) {
          try {
            let imgBlob = DriveApp.getFileById(imageMap[colName]).getBlob();
            imagesToInsert.push(imgBlob);
          } catch (e) { console.log("Lỗi ảnh: " + e.message); }
        }
      }
    });

    for (let k = 1; k <= 15; k++) {
      let placeholder = `[Image ${k}]`;
      let range = body.findText(placeholder);
      if (range) {
        let element = range.getElement();
        element.asText().deleteText(range.getStartOffset(), range.getEndOffsetInclusive());
        if (imagesToInsert.length > 0) {
          let imgBlob = imagesToInsert.shift(); 
          try { element.getParent().asParagraph().insertInlineImage(0, imgBlob).setWidth(80); } catch(e){}
        }
      }
    }

    copyDoc.saveAndClose();
    const pdfBlob = copyFile.getAs(MimeType.PDF);
    const pdfFile = destFolder.createFile(pdfBlob).setName(`MSDS ${materialName}.pdf`);
    copyFile.setTrashed(true);

    return { success: true, url: pdfFile.getUrl(), name: materialName };

  } catch (err) {
    return { success: false, message: err.toString() };
  }
}
