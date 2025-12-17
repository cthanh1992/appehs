// FILE: MsdsGenBackend.gs (Bản chuẩn: Đã bỏ setWidth để ảnh không bị méo)

const GEN_CONFIG = {
  SOURCE_SS_ID: '1WHIYcmS_tyPDs1sLq9yhO8wAeCdCNeCqzwQ1Yjp30TY', 
  TEMPLATE_ID: '1QHPsIHpkf3q-AzmBbDSqxRg-KyUrx4SRTsH71HbmZvE', 
  OUTPUT_FOLDER_ID: '1Qjudj6SRO6vtMq2EBl5VYBxtcIvWzalX', 
  
  SHEET_INPUT: 'Input',           
  SHEET_LINK: 'GHSPPE', 
  
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
    
    // 1. LẤY MAP ẢNH
    const linkSheet = ss.getSheetByName(GEN_CONFIG.SHEET_LINK);
    if (!linkSheet) throw new Error(`Không tìm thấy Sheet "${GEN_CONFIG.SHEET_LINK}"`);
    
    const linkData = linkSheet.getDataRange().getValues(); 
    let imageMap = {};

    for (let i = 0; i < linkData.length; i++) {
       let name = String(linkData[i][0]).trim(); 
       let linkVal = String(linkData[i][1]).trim();     
       if (name && linkVal) {
          let match = linkVal.match(/id=([a-zA-Z0-9_-]+)/) || linkVal.match(/\/d\/([a-zA-Z0-9_-]+)/);
          let fileId = match ? match[1] : linkVal; 
          if (fileId.length > 5) imageMap[name] = fileId;
       }
    }

    // 2. LẤY DATA
    const inputSheet = ss.getSheetByName(GEN_CONFIG.SHEET_INPUT);
    const inputData = inputSheet.getDataRange().getValues();
    const headers = inputData[0];
    const row = inputData[rowIndex]; 
    
    const nameIdx = headers.findIndex(h => String(h).toLowerCase().includes("tên nguyên liệu"));
    const materialName = (nameIdx > -1) ? row[nameIdx] : "Unknown";

    // 3. COPY TEMPLATE
    const docTemplate = DriveApp.getFileById(GEN_CONFIG.TEMPLATE_ID);
    const destFolder = DriveApp.getFolderById(GEN_CONFIG.OUTPUT_FOLDER_ID);
    const copyFile = docTemplate.makeCopy(`MSDS ${materialName}`, destFolder);
    const copyDoc = DocumentApp.openById(copyFile.getId());
    const body = copyDoc.getBody();

    // 4. ĐIỀN DỮ LIỆU
    headers.forEach((header, colIdx) => {
      let cellValue = row[colIdx];
      let headerName = String(header).trim(); 
      
      if (cellValue instanceof Date) {
        cellValue = Utilities.formatDate(cellValue, "GMT+7", "dd/MM/yyyy");
      }
      cellValue = (cellValue === null || cellValue === undefined) ? "" : String(cellValue);

      // --- LOGIC CHÈN ẢNH CHUẨN ---
      if (imageMap[headerName]) {
        let isMarked = GEN_CONFIG.MARKERS.some(m => cellValue.toLowerCase().includes(m));
        
        let placeholder = `\\[${headerName}\\]`; 
        let range = body.findText(placeholder);
        
        if (range) {
          let element = range.getElement();
          element.asText().deleteText(range.getStartOffset(), range.getEndOffsetInclusive());
          
          if (isMarked) {
            try {
              let imgBlob = DriveApp.getFileById(imageMap[headerName]).getBlob();
              let img = element.getParent().asParagraph().insertInlineImage(range.getStartOffset(), imgBlob);
              
              // --- CÔNG THỨC CHỐNG MÉO ẢNH ---
              // 1. Lấy kích thước gốc của ảnh vừa chèn
              let originalW = img.getWidth();
              let originalH = img.getHeight();
              
              // 2. Tính tỷ lệ khung hình (Aspect Ratio)
              let ratio = originalW / originalH;
              
              // 3. Tính toán kích thước mới (Cao 60px, Rộng tự tính theo tỷ lệ)
              let newH = 60; 
              let newW = newH * ratio; 
              
              // 4. Áp dụng cả 2 (Khóa cứng tỷ lệ)
              img.setHeight(newH);
              img.setWidth(newW);
              
            } catch (e) {
              console.log(`Lỗi chèn ảnh ${headerName}: ${e.message}`);
            }
          }
        }
      } else {
        body.replaceText(`\\[${headerName}\\]`, cellValue);
      }
    });

    copyDoc.saveAndClose();
    
    const pdfBlob = copyFile.getAs(MimeType.PDF);
    const pdfFile = destFolder.createFile(pdfBlob).setName(`MSDS ${materialName}.pdf`);
    try { copyFile.setTrashed(true); } catch(e) {}

    return { success: true, url: pdfFile.getUrl(), name: materialName };

  } catch (err) {
    return { success: false, message: err.toString() };
  }
}
