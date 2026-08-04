const OPEN_SERVICE_TICKETS_API_URL =
  'https://wtfd-operative-preview.hartleywtfd.workers.dev/open-service-tickets';
const OPEN_SERVICE_TICKETS_SPREADSHEET_ID =
  '1tiOyFEbDc-a0oQ2cVNPjK-7kE9QFYZrpm72vew2Ee4o';
const OPEN_SERVICE_TICKETS_SHEET_NAME = 'Open Service Tickets';
const OPEN_SERVICE_TICKET_HEADERS = [
  'Created',
  'Asset Description',
  'Ticket Name',
  'Unit Name',
  'Description',
  'Status'
];

function importOpenServiceTicketsFromApi() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    Logger.log('Another Open Service Tickets import is already running.');
    return;
  }

  try {
    const token = String(
      PropertiesService.getScriptProperties().getProperty('SYNC_ADMIN_TOKEN') || ''
    ).trim();

    if (!token) {
      throw new Error('SYNC_ADMIN_TOKEN is not configured in Script Properties.');
    }

    const response = UrlFetchApp.fetch(OPEN_SERVICE_TICKETS_API_URL, {
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
      throw new Error('Cloudflare returned an invalid Open Service Tickets payload.');
    }

    if (Number(payload.recordCount) !== payload.rows.length) {
      throw new Error(
        'Cloudflare record count mismatch: expected ' +
        payload.recordCount + ', received ' + payload.rows.length + '.'
      );
    }

    const values = [
      OPEN_SERVICE_TICKET_HEADERS,
      ...payload.rows.map(row => [
        String(row.created || ''),
        String(row.assetDescription || ''),
        String(row.ticketName || ''),
        String(row.unitName || ''),
        String(row.description || ''),
        String(row.status || '')
      ])
    ];

    const spreadsheet = SpreadsheetApp.openById(
      OPEN_SERVICE_TICKETS_SPREADSHEET_ID
    );
    const sheet = spreadsheet.getSheetByName(OPEN_SERVICE_TICKETS_SHEET_NAME);

    if (!sheet) {
      throw new Error(
        'Sheet "' + OPEN_SERVICE_TICKETS_SHEET_NAME + '" was not found.'
      );
    }

    if (sheet.getMaxRows() < values.length) {
      sheet.insertRowsAfter(
        sheet.getMaxRows(),
        values.length - sheet.getMaxRows()
      );
    }

    sheet.getRange(1, 1, sheet.getMaxRows(), 6).clearContent();
    if (values.length > 1) {
      sheet.getRange(2, 1, values.length - 1, 1).setNumberFormat('@');
    }
    sheet.getRange(1, 1, values.length, 6).setValues(values);
    sheet.setFrozenRows(1);

    Logger.log(
      'Imported ' + payload.rows.length +
      ' Open Service Ticket row(s) from OperativeIQ.'
    );
  } finally {
    lock.releaseLock();
  }
}

function createThirtyMinuteTriggerForOpenServiceTicketsApi() {
  const handlersToReplace = new Set([
    'importOpenServiceTicketsFromEmail',
    'importOpenServiceTicketsFromApi'
  ]);

  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (handlersToReplace.has(trigger.getHandlerFunction())) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('importOpenServiceTicketsFromApi')
    .timeBased()
    .everyMinutes(30)
    .create();

  Logger.log('30-minute Open Service Tickets API trigger created.');
}
