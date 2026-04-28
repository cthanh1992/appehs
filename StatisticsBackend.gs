// FILE: StatisticsBackend.gs
// [BẢN V4.1 - ĐÃ CẬP NHẬT LỌC KHU VỰC + LỌC TUẦN/THÁNG TÙY CHỈNH]

// --- 1. HÀM MỚI: LẤY DANH SÁCH KHU VỰC (Cho Dropdown) ---
function getChecklistAreas(checklistId) { //
  var ss = SpreadsheetApp.getActiveSpreadsheet(); //
  var sheet = ss.getSheetByName("Checklist_Master"); // Lấy từ Master chuẩn hơn History //
  if (!sheet) return []; //
  
  var data = sheet.getDataRange().getValues(); //
  data.shift(); // Bỏ header //
  
  var areas = []; //
  var distinct = {}; //
  // Tìm cấu hình trong Master để lấy danh sách khu vực //
  // Cấu trúc Master: ID (Col A), Câu hỏi (Col B)... Option (Col G) //
  // Option có dạng: "Khu vực A: Máy 1, Máy 2 || Khu vực B: Máy 3" //
  
  // Mapping ID phiếu với Mã câu hỏi chứa địa điểm //
  var targetQ = "Q02"; //
  // Đa số là Q02, riêng Lab/NBC là Q01 //
  if (checklistId === 'CHECKLAB' || checklistId === 'CHECKNBC') targetQ = "Q01"; //
  var row = data.find(r => String(r[0]) === checklistId && String(r[1]) === targetQ); //
  if (row) { //
    var optionsStr = String(row[6]); //
    // Cột G //
    if (optionsStr.includes("||")) { //
       var groups = optionsStr.split("||"); //
       groups.forEach(g => { //
         var parts = g.split(":"); //
         if (parts.length > 0) { //
           var areaName = parts[0].trim(); //
           if (areaName && !distinct[areaName]) { //
             distinct[areaName] = true; //
             areas.push(areaName); //
           } //
         } //
       }); //
    } //
  } //
  return areas.sort(); //
} //

// --- 2. HÀM CHÍNH: LẤY THỐNG KÊ ---
// --- 2. HÀM CHÍNH: LẤY THỐNG KÊ ---
function getTrackingStats(filterType, areaFilter) { 
  try { 
    var ss = SpreadsheetApp.getActiveSpreadsheet(); 
    var sheetRecords = ss.getSheetByName("Checklist_Records"); 
    var sheetMaster = ss.getSheetByName("Checklist_Master"); 
    var sheetMenu = ss.getSheetByName("MenuData"); 
    var sheetHolidays = ss.getSheetByName("Holidays"); 

    if (!sheetRecords || !sheetMaster || !sheetMenu) return JSON.stringify({ error: true, message: "Thiếu Sheet dữ liệu" }); 

    // --- LẤY DANH SÁCH NGÀY NGHỈ ---
    var holidayMap = {};
    if (sheetHolidays) {
          var hData = sheetHolidays.getDataRange().getValues();
        hData.shift(); // Bỏ header
        hData.forEach(r => {
            if (r[0]) {
                var d = new Date(r[0]);
                if (!isNaN(d.getTime())) {
                    var key = d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
                    holidayMap[key] = true;
                }
            }
        });
    }
    // --- CONFIG & MAPPING ---
    const CONFIG = { //
      'CHECKPLANT':     { areaQ: 'Q01', locQ: 'Q02', masterQ: 'Q02', hasArea: true }, //
      'CHECKWAREHOUSE': { areaQ: 'Q01', locQ: 'Q02', masterQ: 'Q02', hasArea: true }, //
      'CHECKLAB':       { areaQ: '',    locQ: 'Q01', masterQ: 'Q01', hasArea: false }, //
      'CHECKHR':        { areaQ: 'Q01', locQ: 'Q02', masterQ: 'Q02', hasArea: true }, //
      'CHECKNBC':       { areaQ: 'Q01', locQ: '',    masterQ: 'Q01', hasArea: true }  //
    }; //
    const NAME_QID_MAP = { //
      'CHECKPLANT': 'Q03', 'CHECKWAREHOUSE': 'Q03', 'CHECKLAB': 'Q02', 'CHECKHR': 'Q03', 'CHECKNBC': 'Q02' //
    }; //
    
    // Đọc MenuData lấy tần suất //
    var menuData = sheetMenu.getDataRange().getValues(); //
    menuData.shift(); //
    var freqMap = {}; //
    menuData.forEach(r => { //
        var id = String(r[0]); //
        var note = String(r[8]);  //
        if (note.includes("Frequency:")) { //
            freqMap[id] = note.split(":")[1].trim().toUpperCase(); //
        } else { //
            freqMap[id] = 'DAILY';  //
        } //
    }); //

    // --- XỬ LÝ THỜI GIAN (ĐÃ CẬP NHẬT ĐỂ HỖ TRỢ CHỌN TUẦN/THÁNG TÙY CHỈNH) ---
    var filterParams = filterType.split(',');
    var baseFilter = filterParams[0]; // Là 'TODAY', 'WEEK', 'MONTH', hoặc 'CUSTOM'

    var startDate, endDate;
    if (filterParams.length >= 3) {
        // Frontend đã truyền chính xác ngày bắt đầu và kết thúc
        startDate = new Date(filterParams[1] + "T00:00:00");
        endDate = new Date(filterParams[2] + "T23:59:59");
    } else {
        // Fallback an toàn (chỉ dành cho TODAY)
        var now = new Date();
        startDate = new Date(now.setHours(0,0,0,0));
        endDate = new Date(now.setHours(23,59,59,999));
    }

    // --- LẤY KẾ HOẠCH TỪ MASTER ---
    var masterData = sheetMaster.getDataRange().getValues(); //
    masterData.shift(); //
    var planMap = {};  //
    Object.keys(CONFIG).forEach(chkId => { //
       planMap[chkId] = []; //
       var conf = CONFIG[chkId]; //
       var row = masterData.find(r => String(r[0]) == chkId && String(r[1]) == conf.masterQ); //
       if (row) { //
         var optionsStr = String(row[6]);  //
         if (conf.hasArea && optionsStr.includes(':')) { //
            var groups = optionsStr.split('||'); //
            groups.forEach(g => { //
               var parts = g.split(':'); //
               if(parts.length >= 2) { //
                 var areaName = parts[0].trim(); //
                 var locs = parts[1].split(','); //
                 locs.forEach(l => planMap[chkId].push({ area: areaName, loc: l.trim() })); //
               } //
            }); //
         } else { //
            var locs = optionsStr.split(','); //
            locs.forEach(l => planMap[chkId].push({ area: "", loc: l.trim() })); //
         } //
       } //
    }); //

    // --- LẤY DỮ LIỆU THỰC TẾ ---
    var lastRow = sheetRecords.getLastRow(); //
    var recordsData = (lastRow >= 2) ? sheetRecords.getRange(2, 2, lastRow - 1, 5).getValues() : []; //
    var actualMap = {}; //
    recordsData.forEach(row => { //
        if(!row[0] || !row[1]) return; //
        var rDate = new Date(row[0]); //
        if(isNaN(rDate.getTime())) return; //

        if (rDate >= startDate && rDate <= endDate) { //
            var chkId = String(row[1]); //
            if (!CONFIG[chkId]) return; //
            
            var user = row[2] ? String(row[2]).split(" - ")[0] : "N/A"; //
            var jsonStr = row[4]; //
            
            // Fix tên N/A //
            if ((user === "N/A" || user === "") && jsonStr) { //
                try { //
                    var parsed = JSON.parse(jsonStr); //
                    var targetQ = NAME_QID_MAP[chkId]; //
                    if (targetQ) { //
                        var qObj = parsed.find(q => String(q.qId) === targetQ); //
                        if (qObj && qObj.value) user = qObj.value; //
                    } //
                } catch(e) {} //
            } //

            var issues = []; //
            var areaVal = "", locVal = ""; //
            if (jsonStr) { //
                try { //
                    var answers = JSON.parse(jsonStr); //
                    var conf = CONFIG[chkId]; //
                    if(conf.hasArea) { //
                       var qA = answers.find(a => a.qId == conf.areaQ); //
                       if(qA) areaVal = qA.value; //
                    } //
                    var qL = answers.find(a => a.qId == conf.locQ); //
                    if(qL) locVal = qL.value; //

                    answers.forEach(a => { //
                        if (a.value === 'NO' || (typeof a.value === 'string' && a.value.includes('Fail'))) { //
                            issues.push({ //
                                question: a.question, //
                                value: a.value, //
                                note: a.note || "", //
                                images: a.imageLinks || []  //
                            }); //
                        } //
                    }); //
                } catch(e) {} //
            } //

            var key = chkId + "_" + (areaVal||"").trim() + "_" + (locVal||"").trim(); //
            if (!actualMap[key]) actualMap[key] = []; //
            
            actualMap[key].push({ //
                date: rDate, //
                inspector: user, //
                timeStr: Utilities.formatDate(rDate, Session.getScriptTimeZone(), "HH:mm dd/MM"), //
                issues: issues //
            }); //
        } //
    }); //

    // --- TỔNG HỢP HIỂN THỊ (SỬA ĐỔI ĐỂ GIỮ % THEO BASEFILTER) ---
    var result = {}; 
    Object.keys(CONFIG).forEach(chkId => { //
        var freq = freqMap[chkId] || 'DAILY'; //
        var viewMode = 'DETAIL';  //
        var targetCount = 1; //

        // Xác định chế độ View dựa trên Loại (baseFilter) thay vì toàn bộ chuỗi
        if (baseFilter === 'TODAY') viewMode = 'DETAIL';
        else if (baseFilter === 'WEEK') {
            if (freq === 'DAILY') { viewMode = 'AGGREGATE'; targetCount = countWorkingDays(startDate, endDate, holidayMap); }
            else viewMode = 'DETAIL';
        } else if (baseFilter === 'MONTH') {
            if (freq === 'DAILY') { viewMode = 'AGGREGATE'; targetCount = countWorkingDays(startDate, endDate, holidayMap); }
            else if (freq === 'WEEKLY') { viewMode = 'AGGREGATE'; targetCount = 4; }
            else viewMode = 'DETAIL';
        } else if (baseFilter === 'CUSTOM') {
            if (freq === 'DAILY') { viewMode = 'AGGREGATE'; targetCount = countWorkingDays(startDate, endDate, holidayMap); }
            else viewMode = 'DETAIL';
        }

        var groupName = getGroupName(chkId); //
        var rows = []; //
        var planList = planMap[chkId] || []; //

        planList.forEach(p => { //
            // LOGIC LỌC KHU VỰC
            if (areaFilter && areaFilter !== 'ALL' && areaFilter !== '' && p.area !== areaFilter) { //
                return; //
            } //

            var key = chkId + "_" + (p.area||"").trim() + "_" + (p.loc||"").trim(); //
            var checks = actualMap[key] || []; //
            
            if (viewMode === 'DETAIL') { //
                var lastCheck = checks.length > 0 ? checks[checks.length-1] : null; //
                var statusResult = "MISSING"; //
                if (lastCheck) { //
                    statusResult = (lastCheck.issues.length > 0) ? "FAIL" : "PASS"; //
                } //

                rows.push({ //
                    area: p.area, //
                    loc: p.loc, //
                    inspector: lastCheck ? lastCheck.inspector : "-", //
                    time: lastCheck ? lastCheck.timeStr : "-", //
                    issues: lastCheck ? lastCheck.issues : [], //
                    status: statusResult,  //
                    result: statusResult  //
                }); //
            } else { //
                var uniqueDays = countUniqueDays(checks); //
                rows.push({ //
                    area: p.area, //
                    loc: p.loc, //
                    current: uniqueDays, //
                    target: targetCount, //
                    ratio: Math.round((uniqueDays / targetCount) * 100) //
                }); //
            } //
        }); //

        result[chkId] = { //
            name: groupName, //
            viewMode: viewMode, //
            frequency: freq, //
            rows: rows //
        }; //
    }); //

    return JSON.stringify(result); //

  } catch (e) { //
    return JSON.stringify({ error: true, message: "Lỗi Backend: " + e.toString() }); //
  } //
} //

// --- HÀM PHỤ TRỢ ---
function countWorkingDays(start, end, holidayMap) { 
    var count = 0; 
    var cur = new Date(start); 
    while (cur <= end) { 
        var day = cur.getDay(); 
        var dateKey = cur.getFullYear() + "-" + cur.getMonth() + "-" + cur.getDate();
        
        // Chỉ đếm nếu không phải T7, CN VÀ không nằm trong danh sách ngày nghỉ
        if (day !== 0 && day !== 6 && (!holidayMap || !holidayMap[dateKey])) {
            count++;  
        } 
        cur.setDate(cur.getDate() + 1); 
    } 
    return count > 0 ? count : 1; 
}
function countUniqueDays(checks) { //
    if(!checks || checks.length === 0) return 0; //
    var days = {}; //
    checks.forEach(c => { //
        var key = c.date.getFullYear() + "-" + c.date.getMonth() + "-" + c.date.getDate(); //
        days[key] = true; //
    }); //
    return Object.keys(days).length; //
} //

function getGroupName(id) { //
    if(id == 'CHECKPLANT') return "Nhà Máy"; //
    if(id == 'CHECKWAREHOUSE') return "Kho"; //
    if(id == 'CHECKLAB') return "QC Lab"; //
    if(id == 'CHECKHR') return "Hành Chính"; //
    if(id == 'CHECKNBC') return "Nhiễm bẩn chéo"; //
    return id; //
} //
