// FILE: MsdsGenBackend.gs

const GEN_CONFIG = {
  SOURCE_SS_ID: '1WHIYcmS_tyPDs1sLq9yhO8wAeCdCNeCqzwQ1Yjp30TY', 
  TEMPLATE_ID: '1QHPsIHpkf3q-AzmBbDSqxRg-KyUrx4SRTsH71HbmZvE', 
  OUTPUT_FOLDER_ID: '1Qjudj6SRO6vtMq2EBl5VYBxtcIvWzalX', // ID Folder bạn cung cấp
  
  SHEET_INPUT: 'Input',           
  SHEET_LINK: 'GHSPPE', // Tên Sheet chứa link ảnh (Cấu trúc Dọc: Cột A Tên, Cột B ID)
  
  MARKERS: ['x', 'v', 'có', 'yes', '√'] 
};

function getMaterialList() {
  const ss = SpreadsheetApp.openById(GEN_CONFIG.SOURCE_SS_ID);
  const sheet = ss.getSheetByName(GEN_CONFIG.SHEET_INPUT);
  if (!sheet) throw new Error(`Không tìm thấy Sheet "${GEN_CONFIG.SHEET_INPUT}"`);

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const nameIdx = headers.findIndex(h => String(h).toLowerCase().includes("tên nguyên liệu"));
  
  if (nameIdx === -1) throw new Error('Không tìm thấy cột "Tên nguyên liệu".');

  let list = [];
  // Duyệt từ dòng thứ 2 (bỏ dòng tiêu đề)
  for (let i = 1; i < data.length; i++) {
    if (data[i][nameIdx]) {
      list.push({ name: data[i][nameIdx], rowIndex: i });
    }
  }
  return list;
}

function generateSingleMsds(rowIndex) {
  try {
    const ss = SpreadsheetApp.openById(GEN_CONFIG.SOURCE_SS_ID);
    
    // --- 1. LẤY MAP ẢNH (LOGIC MỚI: ĐỌC DỌC) ---
    const linkSheet = ss.getSheetByName(GEN_CONFIG.SHEET_LINK);
    if (!linkSheet) throw new Error(`Không tìm thấy Sheet "${GEN_CONFIG.SHEET_LINK}"`);
    
    const linkData = linkSheet.getDataRange().getValues(); 
    let imageMap = {};

    // Duyệt từng dòng: Cột 0 là Tên (Độc), Cột 1 là Link/ID
    for (let i = 0; i < linkData.length; i++) {
       let name = String(linkData[i][0]).trim(); 
       let linkVal = String(linkData[i][1]).trim();     
       
       if (name && linkVal) {
          // Xử lý ID: Nếu là link dài thì cắt lấy ID, nếu là ID trần thì giữ nguyên
          let match = linkVal.match(/id=([a-zA-Z0-9_-]+)/) || linkVal.match(/\/d\/([a-zA-Z0-9_-]+)/);
          let fileId = match ? match[1] : linkVal; 
          
          if (fileId.length > 5) {
             imageMap[name] = fileId; // Lưu vào map: "Độc" -> "ID_anh"
          }
       }
    }

    // --- 2. LẤY DỮ LIỆU INPUT ---
    const inputSheet = ss.getSheetByName(GEN_CONFIG.SHEET_INPUT);
    const inputData = inputSheet.getDataRange().getValues();
    const headers = inputData[0];
    const row = inputData[rowIndex]; 
    
    const nameIdx = headers.findIndex(h => String(h).toLowerCase().includes("tên nguyên liệu"));
    const materialName = (nameIdx > -1) ? row[nameIdx] : "Unknown";

    // --- 3. COPY FILE MẪU ---
    const docTemplate = DriveApp.getFileById(GEN_CONFIG.TEMPLATE_ID);
    const destFolder = DriveApp.getFolderById(GEN_CONFIG.OUTPUT_FOLDER_ID);
    const copyFile = docTemplate.makeCopy(`MSDS ${materialName}`, destFolder);
    const copyDoc = DocumentApp.openById(copyFile.getId());
    const body = copyDoc.getBody();

    // --- 4. ĐIỀN DỮ LIỆU ---
    headers.forEach((header, colIdx) => {
      let cellValue = row[colIdx];
      let headerName = String(header).trim();
      
      // Xử lý ngày tháng
      if (cellValue instanceof Date) {
        cellValue = Utilities.formatDate(cellValue, "GMT+7", "dd/MM/yyyy");
      }
      cellValue = (cellValue === null || cellValue === undefined) ? "" : String(cellValue);

      // KIỂM TRA: Cột này có phải cột ẢNH không?
      if (imageMap[headerName]) {
        // Đây là cột ảnh (VD: Độc, Găng tay...)
        // Kiểm tra xem ô dữ liệu có đánh dấu 'x' không
        let isMarked = GEN_CONFIG.MARKERS.some(m => cellValue.toLowerCase().includes(m));
        
        // Tìm vị trí [Tên Cột] trong file Doc
        let placeholder = `[${headerName}]`;
        let range = body.findText(placeholder);
        
        if (range) {
          let element = range.getElement();
          // Luôn xóa chữ [Tên Cột] đi (dù có ảnh hay không) để tránh bị thừa chữ
          element.asText().deleteText(range.getStartOffset(), range.getEndOffsetInclusive());
          
          if (isMarked) {
            // Nếu có đánh dấu 'x' -> Chèn ảnh vào
            try {
              let imgBlob = DriveApp.getFileById(imageMap[headerName]).getBlob();
              let img = element.getParent().asParagraph().insertInlineImage(range.getStartOffset(), imgBlob);
              
              // Chỉnh kích thước ảnh chuẩn (Cao 60px - Rộng tự động theo tỷ lệ)
              img.setHeight(60); 
            } catch (e) {
              console.log(`Lỗi chèn ảnh ${headerName}: ${e.message}`);
            }
          }
        }
      } else {
        // Nếu là cột TEXT thường -> Thay thế nội dung
        body.replaceText(`\\[${headerName}\\]`, cellValue);
      }
    });

    copyDoc.saveAndClose();
    
    // --- 5. XUẤT PDF ---
    const pdfBlob = copyFile.getAs(MimeType.PDF);
    const pdfFile = destFolder.createFile(pdfBlob).setName(`MSDS ${materialName}.pdf`);
    
    // Xóa file Doc tạm
    try { copyFile.setTrashed(true); } catch(e) {}

    return { success: true, url: pdfFile.getUrl(), name: materialName };

  } catch (err) {
    return { success: false, message: err.toString() };
  }
}
