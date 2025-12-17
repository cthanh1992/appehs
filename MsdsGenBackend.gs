// FILE: MsdsGenBackend.gs

const GEN_CONFIG = {
  // ID file Google Sheet và Template (Bạn giữ nguyên ID của bạn)
  SOURCE_SS_ID: '1WHIYcmS_tyPDs1sLq9yhO8wAeCdCNeCqzwQ1Yjp30TY', 
  TEMPLATE_ID: '1QHPsIHpkf3q-AzmBbDSqxRg-KyUrx4SRTsH71HbmZvE', 
  OUTPUT_FOLDER_ID: '1Qjudj6SRO6vtMq2EBl5VYBxtcIvWzalX', // <-- Đã lấy lại ID folder chuẩn từ file cấu hình của bạn
  
  SHEET_INPUT: 'Input',           
  SHEET_LINK: 'link GHS+PPE', // <-- Chú ý: Tên Sheet chứa link ảnh phải chính xác
  
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
  // Bắt đầu từ dòng 2 (index 2) vì dòng 0 là Header chính, dòng 1 là Header phụ/Note
  // Tùy file của bạn, nếu dữ liệu bắt đầu từ dòng 2 thì để i=1, nếu có 2 dòng tiêu đề thì để i=2
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
    
    // 1. LẤY LINK ẢNH
    const linkSheet = ss.getSheetByName(GEN_CONFIG.SHEET_LINK);
    if (!linkSheet) throw new Error(`Không tìm thấy Sheet "${GEN_CONFIG.SHEET_LINK}"`);
    const linkData = linkSheet.getDataRange().getValues(); 
    let imageMap = {};
    
    // Duyệt qua sheet Link (Cột 1: Tên, Cột 2: Link)
    for (let i = 0; i < linkData.length; i++) {
       let name = String(linkData[i][0]).trim();
       let linkVal = String(linkData[i][1]);     
       if (name && linkVal) {
          let match = linkVal.match(/id=([a-zA-Z0-9_-]+)/) || linkVal.match(/\/d\/([a-zA-Z0-9_-]+)/);
          let fileId = match ? match[1] : linkVal; 
          if (fileId.length > 5) imageMap[name] = fileId;
       }
    }

    // 2. LẤY DỮ LIỆU INPUT
    const inputSheet = ss.getSheetByName(GEN_CONFIG.SHEET_INPUT);
    const inputData = inputSheet.getDataRange().getValues();
    const headers = inputData[0]; // Dòng tiêu đề
    const row = inputData[rowIndex]; 
    
    const nameIdx = headers.findIndex(h => String(h).toLowerCase().includes("tên nguyên liệu"));
    const materialName = (nameIdx > -1) ? row[nameIdx] : "Unknown";

    // 3. COPY TEMPLATE
    const docTemplate = DriveApp.getFileById(GEN_CONFIG.TEMPLATE_ID);
    const destFolder = DriveApp.getFolderById(GEN_CONFIG.OUTPUT_FOLDER_ID);
    const copyFile = docTemplate.makeCopy(`MSDS ${materialName}`, destFolder);
    const copyDoc = DocumentApp.openById(copyFile.getId());
    const body = copyDoc.getBody();

    // 4. ĐIỀN DỮ LIỆU & XỬ LÝ ẢNH (LOGIC MỚI)
    headers.forEach((header, colIdx) => {
      let cellValue = row[colIdx];
      let headerName = String(header).trim();
      
      // A. Xử lý định dạng NGÀY THÁNG (Sửa lỗi Wed Mar 06...)
      if (cellValue instanceof Date) {
        cellValue = Utilities.formatDate(cellValue, "GMT+7", "dd/MM/yyyy");
      }
      // Xử lý null/undefined
      cellValue = (cellValue === null || cellValue === undefined) ? "" : String(cellValue);

      // B. Kiểm tra xem cột này có phải là ẢNH không?
      if (imageMap[headerName]) {
        // Đây là cột có khả năng chứa ảnh (VD: "Độc", "Mắt kính")
        // Kiểm tra xem ô dữ liệu có đánh dấu 'x' không
        let isMarked = GEN_CONFIG.MARKERS.some(m => cellValue.toLowerCase().includes(m));
        
        // Tìm vị trí placeholder trong Doc: [Tên Cột] (VD: [Độc], [Mắt kính])
        let placeholder = `[${headerName}]`;
        let range = body.findText(placeholder);
        
        if (range) {
          let element = range.getElement();
          // Xóa chữ [Tên Cột] đi
          element.asText().deleteText(range.getStartOffset(), range.getEndOffsetInclusive());
          
          if (isMarked) {
            // Nếu có đánh dấu 'x' -> Chèn ảnh vào đúng vị trí đó
            try {
              let imgBlob = DriveApp.getFileById(imageMap[headerName]).getBlob();
              let img = element.getParent().asParagraph().insertInlineImage(range.getStartOffset(), imgBlob);
              
              // Chỉnh kích thước ảnh cho vừa mắt (Cao 60px, rộng tự động)
              img.setHeight(60); 
              // img.setWidth(60); // Bỏ comment nếu muốn ép cả chiều rộng
            } catch (e) {
              console.log(`Lỗi chèn ảnh ${headerName}: ${e.message}`);
            }
          }
          // Nếu không đánh dấu 'x' -> Thì chữ [Tên Cột] đã bị xóa, để lại khoảng trắng (Đúng ý đồ)
        }
      } else {
        // C. Nếu là cột TEXT bình thường -> Thay thế text như cũ
        // Chỉ thay thế nếu không phải là cột ảnh
        body.replaceText(`\\[${headerName}\\]`, cellValue);
      }
    });

    copyDoc.saveAndClose();
    
    // 5. XUẤT PDF
    const pdfBlob = copyFile.getAs(MimeType.PDF);
    const pdfFile = destFolder.createFile(pdfBlob).setName(`MSDS ${materialName}.pdf`);
    
    // Xóa file Doc tạm (để đỡ rác)
    copyFile.setTrashed(true);

    return { success: true, url: pdfFile.getUrl(), name: materialName };

  } catch (err) {
    return { success: false, message: err.toString() };
  }
}
