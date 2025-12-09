// FILE: StatisticsBackend.gs
// [BẢN V3.4 - FIX LỖI HIỂN THỊ ẢNH & TRẠNG THÁI]

function getTrackingStats(filterType) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetRecords = ss.getSheetByName("Checklist_Records");
    var sheetMaster = ss.getSheetByName("Checklist_Master");
    var sheetMenu = ss.getSheetByName("MenuData"); 
    
    if (!sheetRecords || !sheetMaster || !sheetMenu) return JSON.stringify({ error: true, message: "Thiếu Sheet dữ liệu" });

    // --- 1. CONFIG & MAPPING ---
    const CONFIG = {
      'CHECKPLANT':     { areaQ: 'Q01', locQ: 'Q02', masterQ: 'Q02', hasArea: true },
      'CHECKWAREHOUSE': { areaQ: 'Q01', locQ: 'Q02', masterQ: 'Q02', hasArea: true },
      'CHECKLAB':       { areaQ: '',    locQ: 'Q01', masterQ: 'Q01', hasArea: false },
      'CHECKHR':        { areaQ: 'Q01', locQ: 'Q02', masterQ: 'Q02', hasArea: true },
      'CHECKNBC':       { areaQ: 'Q01', locQ: '',    masterQ: 'Q01', hasArea: true } 
    };

    // Cấu hình ID câu hỏi Tên
    const NAME_QID_MAP = {
      'CHECKPLANT': 'Q03',      
      'CHECKWAREHOUSE': 'Q03',  
      'CHECKLAB': 'Q02',        
      'CHECKHR': 'Q03',         
      'CHECKNBC': 'Q02'         
    };

    // Đọc MenuData để lấy tần suất
    var menuData = sheetMenu.getDataRange().getValues();
    menuData.shift();
    
    var freqMap = {}; 
    menuData.forEach(r => {
        var id = String(r[0]);
        var note = String(r[8]); 
        if (note.includes("Frequency:")) {
            freqMap[id] = note.split(":")[1].trim().toUpperCase();
        } else {
            freqMap[id] = 'DAILY'; 
        }
    });

    // --- 2. XỬ LÝ THỜI GIAN ---
    var now = new Date();
    var startDate = new Date(now.setHours(0,0,0,0));
    var endDate = new Date(now.setHours(23,59,59,999));

    if (filterType === 'WEEK') {
       var day = now.getDay(); 
       var diff = now.getDate() - day + (day == 0 ? -6 : 1); // Thứ 2
       startDate = new Date(now.setDate(diff)); startDate.setHours(0,0,0,0);
       endDate = new Date(startDate); endDate.setDate(startDate.getDate() + 6); endDate.setHours(23,59,59);
    } else if (filterType === 'MONTH') {
       startDate = new Date(now.getFullYear(), now.getMonth(), 1);
       endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (filterType.includes(',')) { // Custom range
       var parts = filterType.split(',');
       startDate = new Date(parts[0]); startDate.setHours(0,0,0,0);
       endDate = new Date(parts[1]); endDate.setHours(23,59,59,999);
    }

    // --- 3. LẤY KẾ HOẠCH (PLAN) ---
    var masterData = sheetMaster.getDataRange().getValues();
    masterData.shift(); 
    var planMap = {}; 
    Object.keys(CONFIG).forEach(chkId => {
       planMap[chkId] = [];
       var conf = CONFIG[chkId];
       var row = masterData.find(r => String(r[0]) == chkId && String(r[1]) == conf.masterQ);
       if (row) {
         var optionsStr = String(row[6]); 
         if (conf.hasArea && optionsStr.includes(':')) {
            var groups = optionsStr.split('||');
            groups.forEach(g => {
               var parts = g.split(':');
               if(parts.length >= 2) {
                 var areaName = parts[0].trim();
                 var locs = parts[1].split(',');
                 locs.forEach(l => planMap[chkId].push({ area: areaName, loc: l.trim() }));
               }
            });
         } else {
            var locs = optionsStr.split(',');
            locs.forEach(l => planMap[chkId].push({ area: "", loc: l.trim() }));
         }
       }
    });

    // --- 4. LẤY DỮ LIỆU THỰC TẾ & FIX LỖI ---
    var lastRow = sheetRecords.getLastRow();
    var recordsData = (lastRow >= 2) ? sheetRecords.getRange(2, 2, lastRow - 1, 5).getValues() : [];
    var actualMap = {}; 

    recordsData.forEach(row => {
        if(!row[0] || !row[1]) return;
        var rDate = new Date(row[0]);
        if(isNaN(rDate.getTime())) return;

        if (rDate >= startDate && rDate <= endDate) {
            var chkId = String(row[1]);
            if (!CONFIG[chkId]) return;
            
            var user = row[2] ? String(row[2]).split(" - ")[0] : "N/A";
            var jsonStr = row[4];
            
            // Fix Lỗi N/A Tên
            if ((user === "N/A" || user === "") && jsonStr) {
                try {
                    var parsed = JSON.parse(jsonStr);
                    var targetQ = NAME_QID_MAP[chkId];
                    if (targetQ) {
                        var qObj = parsed.find(q => String(q.qId) === targetQ);
                        if (qObj && qObj.value) user = qObj.value;
                    }
                } catch(e) {}
            }

            // --- TRÍCH XUẤT LỖI (QUAN TRỌNG: LẤY CẢ ẢNH) ---
            var issues = [];
            var areaVal = "", locVal = "";

            if (jsonStr) {
                try {
                    var answers = JSON.parse(jsonStr);
                    var conf = CONFIG[chkId];
                    
                    if(conf.hasArea) {
                       var qA = answers.find(a => a.qId == conf.areaQ);
                       if(qA) areaVal = qA.value;
                    }
                    var qL = answers.find(a => a.qId == conf.locQ);
                    if(qL) locVal = qL.value;

                    answers.forEach(a => {
                        // Logic xác định lỗi
                        if (a.value === 'NO' || (typeof a.value === 'string' && a.value.includes('Fail'))) {
                            // [FIX QUAN TRỌNG] Đẩy cả object đầy đủ vào để Frontend hiển thị ảnh/note
                            issues.push({
                                question: a.question,
                                value: a.value,
                                note: a.note || "",
                                images: a.imageLinks || [] 
                            });
                        }
                    });
                } catch(e) {}
            }

            var key = chkId + "_" + (areaVal||"").trim() + "_" + (locVal||"").trim();
            if (!actualMap[key]) actualMap[key] = [];
            
            actualMap[key].push({
                date: rDate,
                inspector: user,
                timeStr: Utilities.formatDate(rDate, Session.getScriptTimeZone(), "HH:mm dd/MM"),
                issues: issues
            });
        }
    });

    // --- 5. TỔNG HỢP HIỂN THỊ ---
    var result = {};

    Object.keys(CONFIG).forEach(chkId => {
        var freq = freqMap[chkId] || 'DAILY';
        var viewMode = 'DETAIL'; 
        var targetCount = 1;

        if (filterType === 'TODAY') viewMode = 'DETAIL';
        else if (filterType === 'WEEK') {
            if (freq === 'DAILY') { viewMode = 'AGGREGATE'; targetCount = countWorkingDays(startDate, endDate); }
            else viewMode = 'DETAIL';
        } else if (filterType === 'MONTH') {
            if (freq === 'DAILY') { viewMode = 'AGGREGATE'; targetCount = countWorkingDays(startDate, endDate); }
            else if (freq === 'WEEKLY') { viewMode = 'AGGREGATE'; targetCount = 4; }
            else viewMode = 'DETAIL';
        }

        var groupName = getGroupName(chkId);
        var rows = [];
        var planList = planMap[chkId] || [];

        planList.forEach(p => {
            var key = chkId + "_" + (p.area||"").trim() + "_" + (p.loc||"").trim();
            var checks = actualMap[key] || [];
            
            if (viewMode === 'DETAIL') {
                var lastCheck = checks.length > 0 ? checks[checks.length-1] : null;
                
                // [FIX QUAN TRỌNG] Tạo biến trạng thái chuẩn cho Frontend
                var statusResult = "MISSING";
                if (lastCheck) {
                    statusResult = (lastCheck.issues.length > 0) ? "FAIL" : "PASS";
                }

                rows.push({
                    area: p.area,
                    loc: p.loc,
                    inspector: lastCheck ? lastCheck.inspector : "-",
                    time: lastCheck ? lastCheck.timeStr : "-",
                    issues: lastCheck ? lastCheck.issues : [],
                    status: statusResult, // Dùng cho logic màu sắc
                    result: statusResult  // [FIX] Dùng cho hiển thị chữ (Frontend tìm biến này)
                });
            } else {
                var uniqueDays = countUniqueDays(checks);
                rows.push({
                    area: p.area,
                    loc: p.loc,
                    current: uniqueDays,
                    target: targetCount,
                    ratio: Math.round((uniqueDays / targetCount) * 100)
                });
            }
        });

        result[chkId] = {
            name: groupName,
            viewMode: viewMode,
            frequency: freq,
            rows: rows
        };
    });

    return JSON.stringify(result);

  } catch (e) {
    return JSON.stringify({ error: true, message: "Lỗi Backend: " + e.toString() });
  }
}

// --- HÀM PHỤ TRỢ ---
function countWorkingDays(start, end) {
    var count = 0;
    var cur = new Date(start);
    while (cur <= end) {
        var day = cur.getDay();
        if (day !== 0 && day !== 6) count++; 
        cur.setDate(cur.getDate() + 1);
    }
    return count > 0 ? count : 1; 
}

function countUniqueDays(checks) {
    if(!checks || checks.length === 0) return 0;
    var days = {};
    checks.forEach(c => {
        var key = c.date.getFullYear() + "-" + c.date.getMonth() + "-" + c.date.getDate();
        days[key] = true;
    });
    return Object.keys(days).length;
}

function getGroupName(id) {
    if(id == 'CHECKPLANT') return "Nhà Máy";
    if(id == 'CHECKWAREHOUSE') return "Kho";
    if(id == 'CHECKLAB') return "QC Lab";
    if(id == 'CHECKHR') return "Hành Chính";
    if(id == 'CHECKNBC') return "Nhiễm bẩn chéo";
    return id;
}
