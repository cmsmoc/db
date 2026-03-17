/**
 * ══════════════════════════════════════════════
 *  SE·CMS — Google Apps Script Backend v2
 *  Secretaria Executiva · CMS Montes Claros
 *
 *  DEPLOY: Extensions > Apps Script > Deploy > New Deployment
 *  Type: Web App | Execute as: Me | Access: Anyone
 *
 *  CORREÇÕES v2:
 *  - saveAll para log usa appendOnly (não apaga entradas antigas)
 *  - addLog usa appendRow (nunca sobrescreve)
 *  - Proteção contra thumbData base64 enorme (truncado em 40KB)
 *  - getAll retorna timestamp para merge inteligente no cliente
 * ══════════════════════════════════════════════
 */

const SHEET_ID = '1cUzddnsqsyGG7ae8h6uEN67RTV68_UvsObfqzxVuGJ0';

/* ══════════════════════════════════════════════
   ENTRY POINTS
══════════════════════════════════════════════ */
function doGet(e) {
  const action = (e.parameter && e.parameter.action) ? e.parameter.action : 'getAll';
  try {
    initSheets();
    switch (action) {
      case 'getAll':     return respond(getAllData());
      case 'getTasks':   return respond(getSheetData('tasks'));
      case 'getNotes':   return respond(getSheetData('notes'));
      case 'getLog':     return respond(getSheetData('log'));
      case 'getLibrary': return respond(getSheetData('library'));
      case 'ping':       return respond({ status: 'ok', ts: new Date().toISOString() });
      default:           return respond({ error: 'Unknown action: ' + action });
    }
  } catch(err) {
    return respond({ error: err.toString() });
  }
}

function doPost(e) {
  try {
    initSheets();
    const payload = JSON.parse(e.postData.contents);
    const action  = payload.action;
    const data    = payload.data;

    switch (action) {
      case 'saveAll':
        // tasks, notes, library: sobrescreve (replace)
        if (data.tasks)   saveSheetData('tasks',   data.tasks,   TASK_COLS);
        if (data.notes)   saveSheetData('notes',   data.notes,   NOTE_COLS);
        if (data.library) saveSheetData('library', data.library, LIB_COLS);
        // *** FIX: log nunca é sobrescrito pelo saveAll ***
        // O log só cresce via 'addLog'. saveAll ignora data.log.
        return respond({ status: 'ok', saved: true, ts: new Date().toISOString() });

      case 'saveTask':
        upsertRow('tasks', data, 'id', TASK_COLS);
        return respond({ status: 'ok' });

      case 'saveNote':
        upsertRow('notes', data, 'id', NOTE_COLS);
        return respond({ status: 'ok' });

      case 'addLog':
        // *** FIX: sempre append, nunca upsert no log ***
        appendRow('log', data, LOG_COLS);
        return respond({ status: 'ok' });

      case 'saveLibItem':
        upsertRow('library', data, 'id', LIB_COLS);
        return respond({ status: 'ok' });

      case 'deleteTask':
        deleteRow('tasks', data.id, 'id');
        return respond({ status: 'ok' });

      case 'deleteNote':
        deleteRow('notes', data.id, 'id');
        return respond({ status: 'ok' });

      case 'deleteLibItem':
        deleteRow('library', data.id, 'id');
        return respond({ status: 'ok' });

      default:
        return respond({ error: 'Unknown action: ' + action });
    }
  } catch(err) {
    return respond({ error: err.toString() });
  }
}

function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ══════════════════════════════════════════════
   COLUMN DEFINITIONS
══════════════════════════════════════════════ */
const TASK_COLS = [
  'id','title','category','priority','responsible',
  'deadline','startDate','description','status',
  'notes','checklist','taskLog','createdAt'
];

const NOTE_COLS = [
  'id','title','body','category','color','createdAt'
];

const LOG_COLS = [
  'id','type','text','category','responsible','ts'
];

const LIB_COLS = [
  'id','title','url','type','category','desc','thumb','thumbData','createdAt'
];

/* ══════════════════════════════════════════════
   SHEET INIT
══════════════════════════════════════════════ */
function getSpreadsheet() {
  return SHEET_ID !== 'YOUR_GOOGLE_SHEET_ID_HERE'
    ? SpreadsheetApp.openById(SHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

function initSheets() {
  const ss = getSpreadsheet();
  const sheetDefs = [
    { name: 'tasks',   cols: TASK_COLS },
    { name: 'notes',   cols: NOTE_COLS },
    { name: 'log',     cols: LOG_COLS  },
    { name: 'library', cols: LIB_COLS  },
  ];
  sheetDefs.forEach(def => {
    let sheet = ss.getSheetByName(def.name);
    if (!sheet) {
      sheet = ss.insertSheet(def.name);
      sheet.getRange(1, 1, 1, def.cols.length).setValues([def.cols]);
      const header = sheet.getRange(1, 1, 1, def.cols.length);
      header.setBackground('#0D2E5A');
      header.setFontColor('#FFFFFF');
      header.setFontWeight('bold');
      header.setFontSize(11);
      sheet.setFrozenRows(1);
    }
  });
}

/* ══════════════════════════════════════════════
   READ
══════════════════════════════════════════════ */
function getAllData() {
  return {
    tasks:   getSheetData('tasks'),
    notes:   getSheetData('notes'),
    log:     getSheetData('log'),
    library: getSheetData('library'),
    ts:      new Date().toISOString()
  };
}

function getSheetData(sheetName) {
  const ss    = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data[0];
  const rows    = data.slice(1);

  return rows
    .filter(row => row[0])
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        let val = row[i] !== undefined ? row[i] : '';
        // Converte Date objects do Sheets para string ISO
        if (val instanceof Date) val = val.toISOString();
        // Parse JSON em arrays
        if ((h === 'checklist' || h === 'taskLog') && typeof val === 'string' && val) {
          try { val = JSON.parse(val); } catch(e) { val = []; }
        }
        obj[h] = val;
      });
      return obj;
    });
}

/* ══════════════════════════════════════════════
   WRITE
══════════════════════════════════════════════ */

/** Serializa um valor para célula do Sheets.
 *  FIX: thumbData base64 é truncado para evitar estourar limite de 50KB por célula.
 */
function serializeVal(col, val) {
  if (col === 'thumbData' && typeof val === 'string' && val.length > 40000) {
    return ''; // Base64 muito grande: descarta, usa thumb URL
  }
  if (Array.isArray(val) || (typeof val === 'object' && val !== null)) {
    return JSON.stringify(val);
  }
  return val !== undefined ? val : '';
}

function saveSheetData(sheetName, items, cols) {
  const ss    = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;

  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  }

  if (!items || items.length === 0) return;

  const rows = items.map(item => cols.map(col => serializeVal(col, item[col])));
  sheet.getRange(2, 1, rows.length, cols.length).setValues(rows);
}

function upsertRow(sheetName, item, keyField, cols) {
  const ss    = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;

  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const keyIdx  = headers.indexOf(keyField);
  if (keyIdx < 0) return;

  const rowValues = cols.map(col => serializeVal(col, item[col]));

  let found = false;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][keyIdx]) === String(item[keyField])) {
      sheet.getRange(i + 1, 1, 1, cols.length).setValues([rowValues]);
      found = true;
      break;
    }
  }
  if (!found) sheet.appendRow(rowValues);
}

function appendRow(sheetName, item, cols) {
  const ss    = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;
  const rowValues = cols.map(col => serializeVal(col, item[col]));
  sheet.appendRow(rowValues);
}

function deleteRow(sheetName, keyValue, keyField) {
  const ss    = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;

  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const keyIdx  = headers.indexOf(keyField);
  if (keyIdx < 0) return;

  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][keyIdx]) === String(keyValue)) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
}

/* ══════════════════════════════════════════════
   SETUP (rodar uma vez manualmente)
══════════════════════════════════════════════ */
function setup() {
  initSheets();
  Logger.log('✅ Planilha configurada!');
  Logger.log('Abas: tasks, notes, log, library');
  Logger.log('Próximo passo: Deploy > New deployment > Web App');
}
