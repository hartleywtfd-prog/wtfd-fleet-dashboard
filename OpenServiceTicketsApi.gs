const PHYSICAL_DUE_API_URL =
  'https://wtfd-operative-preview.hartleywtfd.workers.dev/preview-physical-due';
const PHYSICAL_DUE_SHEET_NAME = 'Members Due For Annual Physical';
const PHYSICAL_DUE_HEADERS = ['Staff Member', 'Due For Physical'];

function importDueForPhysicalFromApi() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    Logger.log('Another Due For Physical import is already running.');
    return;
  }

  try {
    const properties = PropertiesService.getScriptProperties();
    const token = String(properties.getProperty('SYNC_ADMIN_TOKEN') || '').trim();

    if (!token) {
      throw new Error('SYNC_ADMIN_TOKEN is not configured in Script Properties.');
    }

    const response = UrlFetchApp.fetch(PHYSICAL_DUE_API_URL, {
      method: 'get',
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/json'
      },
      muteHttpExceptions: true
    });

    const status = response.getResponseCode();
    const text = response.getContentText();
    if (status !== 200) {
      throw new Error('Cloudflare request failed (' + status + '): ' + text);
    }

    const payload = JSON.parse(text);
    if (!payload.success || !Array.isArray(payload.rows)) {
      throw new Error('Cloudflare returned an invalid Due For Physical payload.');
    }
    if (Number(payload.recordCount) !== payload.rows.length) {
      throw new Error(
        'Cloudflare record count mismatch: expected ' +
        payload.recordCount + ', received ' + payload.rows.length + '.'
      );
    }

    const spreadsheetId = String(
      properties.getProperty('PHYSICAL_DUE_SPREADSHEET_ID') || ''
    ).trim();
    const spreadsheet = spreadsheetId
      ? SpreadsheetApp.openById(spreadsheetId)
      : SpreadsheetApp.getActiveSpreadsheet();

    if (!spreadsheet) {
      throw new Error(
        'No active spreadsheet was found. Set PHYSICAL_DUE_SPREADSHEET_ID in Script Properties.'
      );
    }

    const sheet = spreadsheet.getSheetByName(PHYSICAL_DUE_SHEET_NAME);
    if (!sheet) {
      throw new Error('Sheet "' + PHYSICAL_DUE_SHEET_NAME + '" was not found.');
    }

    const dataRows = payload.rows.map(row => [
      String(row.staffMember || '').trim(),
      physicalDueDate_(row.dueForPhysical)
    ]);
    const values = [PHYSICAL_DUE_HEADERS].concat(dataRows);

    if (sheet.getMaxRows() < values.length) {
      sheet.insertRowsAfter(sheet.getMaxRows(), values.length - sheet.getMaxRows());
    }

    sheet.getRange(1, 1, sheet.getMaxRows(), 2).clearContent();
    sheet.getRange(1, 1, values.length, 2).setValues(values);
    if (dataRows.length) {
      sheet.getRange(2, 2, dataRows.length, 1).setNumberFormat('m/d/yyyy');
    }
    sheet.setFrozenRows(1);

    Logger.log(
      'Imported ' + dataRows.length +
      ' Due For Physical row(s) through ' + payload.cutoffDate + '.'
    );
  } finally {
    lock.releaseLock();
  }
}

function createDailyTriggerForDueForPhysicalApi() {
  const handlersToReplace = new Set([
    'importDueForPhysicalFromEmail',
    'importDueForPhysicalFromApi'
  ]);

  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (handlersToReplace.has(trigger.getHandlerFunction())) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('importDueForPhysicalFromApi')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();

  Logger.log('Daily Due For Physical API trigger created for the 6:00 AM hour.');
}

function physicalDueDate_(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}
