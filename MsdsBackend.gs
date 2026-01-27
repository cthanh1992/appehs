// FILE: MsdsBackend.gs
const MSDS_SHEET_ID = "1WHIYcmS_tyPDs1sLq9yhO8wAeCdCNeCqzwQ1Yjp30TY"; 

function getMsdsList() {
  try {
    const ss = SpreadsheetApp.openById(MSDS_SHEET_ID);
    const sheet = ss.getSheetByName("Input");
    if (!sheet) throw new Error("Không tìm thấy Sheet 'Input'");

    const data = sheet.getDataRange().getValues();
    if (data.length > 0) data.shift(); // Bỏ dòng tiêu đề

    const msdsList = data.map(function(row) {
      if (!row[0] && !row[1]) return null;

      return {
        code: String(row[0]),         // Cột A
        name: String(row[1]),         // Cột B
        linkShort: row[2],            // Cột C
        linkFull: row[3],             // Cột D
        cas: String(row[5]),          // Cột F
        
        category: String(row[28] || "").toUpperCase(), // Cột AC (28)

        // [MỚI] Thêm H-Phrase từ cột AJ (Index 35)
        hPhrase: String(row[35] || ""), 

        composition: row[7],          // Cột H
        properties: row[8],           // Cột I
        
        hazards: {
          toxic:     !!row[17],
          oxidizing: !!row[18],
          flammable: !!row[19],
          corrosive: !!row[20],
          irritant:  !!row[21],
          health:    !!row[22],
          env:       !!row[23]
        }
      };
    }).filter(item => item !== null);

    return JSON.stringify(msdsList);

  } catch (e) {
    return JSON.stringify({ error: true, message: e.toString() });
  }
}
