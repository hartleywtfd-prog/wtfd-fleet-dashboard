/**
 * WTFD Turnout Gear API & Email Notifications
 *
 * 2026-08-11 FIX:
 *   Inspection email eligibility is restricted to OperativeIQ
 *   Subcategory = "Coat" or "Pants". All other gear is excluded.
 *
 * Data source:
 *   OperativeIQ API through Cloudflare Worker
 *
 * Required Script Property:
 *   SYNC_ADMIN_TOKEN
 *
 * Safe setup sequence:
 *   1. Run setupTurnoutGearSystem()
 *   2. Complete column B of "Email Reference list"
 *   3. Run previewGearDueNotifications()
 *   4. Run sendGearDueNotifications() for a controlled test
 *   5. Run installGearDueEmailTrigger()
 */

const TURNOUT_GEAR_CONFIG = Object.freeze({
  workerEndpoint:
    'https://wtfd-operative-preview.hartleywtfd.workers.dev/preview-turnout-gear-inspections',

  tokenProperty: 'SYNC_ADMIN_TOKEN',
  timezone: 'America/New_York',

  importSheetName: 'Import',
  referenceSheetName: 'Email Reference list',
  noMatchSheetName: 'No Match',
  notificationLogSheetName: 'Notification Log',

  triggerHour: 10,
  thresholds: [30, 14, 7, 3],

  subject: 'Notification of Gear Due for Inspection',

  // Set false while testing. The controlled send function explicitly overrides it.
  emailEnabled: false
});


/**
 * SAFE INITIAL SETUP
 * Imports the latest API data and creates/updates supporting sheets.
 * Does not send email and does not install a trigger.
 */
function setupTurnoutGearSystem() {
  validateTurnoutGearConfiguration_();
  const result = importTurnoutGearFromApi();
  const crewEmailResult = refreshCrewEmailReferences();

  Logger.log(JSON.stringify({
    setupComplete: true,
    importedRows: result.importedRows,
    referenceRowsAdded: result.referenceRowsAdded,
    crewEmailsPopulated: crewEmailResult.populatedEmails,
    preservedEmails: crewEmailResult.preservedEmails,
    unmatchedNames: crewEmailResult.unmatchedNames,
    ambiguousNames: crewEmailResult.ambiguousNames,
    emailSent: false,
    triggerInstalled: false
  }, null, 2));
}


/**
 * Pulls turnout-gear data from the Cloudflare Worker and writes it to Import.
 * Also adds newly discovered member/location values to Email Reference list
 * without overwriting existing email addresses.
 */
function importTurnoutGearFromApi() {
  validateTurnoutGearConfiguration_();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const importSheet = getOrCreateTurnoutSheet_(
    ss,
    TURNOUT_GEAR_CONFIG.importSheetName
  );
  const referenceSheet = getOrCreateTurnoutSheet_(
    ss,
    TURNOUT_GEAR_CONFIG.referenceSheetName
  );

  ensureReferenceHeaders_(referenceSheet);

  const payload = fetchTurnoutGearPayload_();
  const rawRows = extractTurnoutGearRows_(payload);
  const normalizedRows = rawRows.map(normalizeTurnoutGearRow_);

  writeTurnoutImportSheet_(importSheet, normalizedRows);
  const referenceRowsAdded = updateEmailReferenceSheet_(
    referenceSheet,
    normalizedRows
  );

  Logger.log(JSON.stringify({
    importedRows: normalizedRows.length,
    referenceRowsAdded: referenceRowsAdded,
    endpoint: TURNOUT_GEAR_CONFIG.workerEndpoint
  }, null, 2));

  return {
    importedRows: normalizedRows.length,
    referenceRowsAdded: referenceRowsAdded,
    rows: normalizedRows
  };
}


/**
 * SAFE PREVIEW
 * Refreshes the API import, evaluates notification thresholds, and writes
 * unmatched rows. It sends no email.
 */
function previewGearDueNotifications() {
  const result = processGearDueNotifications_({
    sendEmails: false,
    mode: 'preview'
  });

  Logger.log(JSON.stringify(result.summary, null, 2));
  return result.summary;
}


/**
 * CONTROLLED LIVE TEST
 * Refreshes the API import and sends eligible notifications.
 * Run manually only after reviewing previewGearDueNotifications().
 */
function sendGearDueNotifications() {
  const result = processGearDueNotifications_({
    sendEmails: true,
    mode: 'manual-live-test'
  });

  Logger.log(JSON.stringify(result.summary, null, 2));
  return result.summary;
}


/**
 * DAILY TRIGGER HANDLER
 * This is the function installed by installGearDueEmailTrigger().
 */
function runDailyGearDueNotifications() {
  const result = processGearDueNotifications_({
    sendEmails: true,
    mode: 'scheduled'
  });

  Logger.log(JSON.stringify(result.summary, null, 2));
  return result.summary;
}


/**
 * FINAL ENABLEMENT STEP
 * Deletes obsolete turnout-gear triggers and installs one daily trigger.
 */
function installGearDueEmailTrigger() {
  validateTurnoutGearConfiguration_();
  deleteObsoleteTurnoutGearTriggers_();

  ScriptApp.newTrigger('runDailyGearDueNotifications')
    .timeBased()
    .atHour(TURNOUT_GEAR_CONFIG.triggerHour)
    .everyDays(1)
    .inTimezone(TURNOUT_GEAR_CONFIG.timezone)
    .create();

  Logger.log(
    'Installed daily turnout-gear email trigger for approximately 10:00 AM ' +
    TURNOUT_GEAR_CONFIG.timezone + '.'
  );
}


/**
 * Removes the new trigger and all known obsolete turnout-gear triggers.
 */
function removeTurnoutGearTriggers() {
  const deleted = deleteObsoleteTurnoutGearTriggers_();
  Logger.log(`Deleted ${deleted} turnout-gear trigger(s).`);
  return deleted;
}


function processGearDueNotifications_(options) {
  validateTurnoutGearConfiguration_();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const importResult = importTurnoutGearFromApi();
  const rows = importResult.rows;

  const referenceSheet = ss.getSheetByName(
    TURNOUT_GEAR_CONFIG.referenceSheetName
  );
  const noMatchSheet = getOrCreateTurnoutSheet_(
    ss,
    TURNOUT_GEAR_CONFIG.noMatchSheetName
  );
  const logSheet = getOrCreateTurnoutSheet_(
    ss,
    TURNOUT_GEAR_CONFIG.notificationLogSheetName
  );

  ensureNotificationLogHeaders_(logSheet);

  const referenceMap = buildEmailReferenceMap_(referenceSheet);
  const eligibleRows = rows.filter(isGearRowEligibleForNotification_);

  const grouped = {};
  const noMatchRows = [];
  let alreadySentRows = 0;

  eligibleRows.forEach(row => {
    const referenceKey = normalizeLookupKey_(
      row.location || row.memberName || row.assignedTo
    );

    if (!referenceKey) {
      noMatchRows.push({
        reason: 'Blank member/location reference',
        row: row
      });
      return;
    }

    const email = referenceMap[referenceKey];
    if (!email) {
      noMatchRows.push({
        reason: 'No email reference match',
        row: row
      });
      return;
    }

    const threshold = getMatchedThreshold_(row.daysRemaining);
    if (threshold === null) return;

    const notificationKey = buildNotificationKey_(row, threshold);

    if (hasNotificationBeenSent_(logSheet, notificationKey)) {
      alreadySentRows++;
      return;
    }

    if (!grouped[email]) grouped[email] = [];
    grouped[email].push({
      row: row,
      threshold: threshold,
      notificationKey: notificationKey
    });
  });

  writeNoMatchSheet_(noMatchSheet, noMatchRows);

  let emailsSent = 0;
  let notifiedItems = 0;

  Object.keys(grouped).forEach(email => {
    const items = grouped[email];

    if (options.sendEmails) {
      MailApp.sendEmail({
        to: email,
        subject: TURNOUT_GEAR_CONFIG.subject,
        body: buildGearNotificationBody_(items)
      });

      emailsSent++;
      notifiedItems += items.length;

      items.forEach(item => {
        appendNotificationLog_(
          logSheet,
          item.notificationKey,
          email,
          item.threshold,
          item.row,
          options.mode
        );
      });
    }
  });

  const summary = {
    mode: options.mode,
    importedRows: rows.length,
    thresholdRows: eligibleRows.length,
    recipients: Object.keys(grouped).length,
    unmatchedRows: noMatchRows.length,
    alreadySentRows: alreadySentRows,
    emailsSent: emailsSent,
    notifiedItems: notifiedItems
  };

  return {
    summary: summary,
    grouped: grouped,
    noMatchRows: noMatchRows
  };
}


function fetchTurnoutGearPayload_() {
  const token = PropertiesService
    .getScriptProperties()
    .getProperty(TURNOUT_GEAR_CONFIG.tokenProperty);

  if (!token) {
    throw new Error(
      `Missing Script Property "${TURNOUT_GEAR_CONFIG.tokenProperty}".`
    );
  }

  const response = UrlFetchApp.fetch(TURNOUT_GEAR_CONFIG.workerEndpoint, {
    method: 'get',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    },
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  const text = response.getContentText();

  if (status < 200 || status >= 300) {
    throw new Error(
      `Cloudflare request failed (${status}): ${text.substring(0, 1000)}`
    );
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(
      `Cloudflare response was not valid JSON: ${text.substring(0, 1000)}`
    );
  }
}


/**
 * Supports common Worker response wrappers:
 *   [...]
 *   { rows: [...] }
 *   { data: [...] }
 *   { items: [...] }
 *   { gear: [...] }
 *   { turnoutGear: [...] }
 *   { results: [...] }
 */
function extractTurnoutGearRows_(payload) {
  if (Array.isArray(payload)) return payload;

  const candidateKeys = [
    'rows',
    'data',
    'items',
    'gear',
    'turnoutGear',
    'turnout_gear',
    'results',
    'records'
  ];

  for (let i = 0; i < candidateKeys.length; i++) {
    const value = payload && payload[candidateKeys[i]];
    if (Array.isArray(value)) return value;
  }

  if (payload && payload.result) {
    return extractTurnoutGearRows_(payload.result);
  }

  throw new Error(
    'The Worker response did not contain a recognized turnout-gear row array.'
  );
}


function normalizeTurnoutGearRow_(raw) {
  const row = raw || {};

  const inspectionDueDate = firstNonBlank_(
    row.inspectionDueDate,
    row.inspection_due_date,
    row.dueDate,
    row.due_date,
    row.nextServiceDate,
    row.next_service_date,
    row.nextInspectionDate,
    row.next_inspection_date,
    row.expirationDate,
    row.expiration_date
  );

  let daysRemaining = toFiniteNumber_(firstNonBlank_(
    row.daysRemaining,
    row.days_remaining,
    row.daysUntilDue,
    row.days_until_due,
    row.daysLeft,
    row.days_left
  ));

  if (daysRemaining === null && inspectionDueDate) {
    daysRemaining = calculateDaysRemaining_(inspectionDueDate);
  }

  return {
    itemId: safeTurnoutText_(firstNonBlank_(
      row.itemId,
      row.item_id,
      row.id,
      row.assetId,
      row.asset_id
    )),
    assetTag: safeTurnoutText_(firstNonBlank_(
      row.gearIdentifier,
      row.gear_identifier,
      row.assetTag,
      row.asset_tag,
      row.assetTagNumber,
      row.asset_tag_number,
      row['Asset Tag #/Part UPC'],
      row.partUpc,
      row.part_upc,
      row.barcode
    )),
    serialNumber: safeTurnoutText_(firstNonBlank_(
      row.serialNumber,
      row.serial_number,
      row.serial,
      row.SerialNumber
    )),
    itemName: safeTurnoutText_(firstNonBlank_(
      row.itemName,
      row.item_name,
      row.description,
      row.assetName,
      row.asset_name,
      row.productName,
      row.product_name
    )),
    category: safeTurnoutText_(firstNonBlank_(
      row.category,
      row.itemCategory,
      row.item_category,
      row.type
    )),
    subcategory: safeTurnoutText_(firstNonBlank_(
      row.subcategory,
      row.subCategory,
      row.subcategoryName,
      row.sub_category,
      row.itemSubcategory,
      row.item_subcategory
    )),
    location: safeTurnoutText_(firstNonBlank_(
      row.issuedTo,
      row.issued_to,
      row.location,
      row.Location,
      row.currentLocation,
      row.current_location
    )),
    memberName: safeTurnoutText_(firstNonBlank_(
      row.memberName,
      row.member_name,
      row.employeeName,
      row.employee_name,
      row.assigneeName,
      row.assignee_name,
      row.personName,
      row.person_name
    )),
    assignedTo: safeTurnoutText_(firstNonBlank_(
      row.assignedTo,
      row.assigned_to,
      row.assignee,
      row.employee,
      row.member
    )),
    inspectionDueDate: normalizeDateForSheet_(inspectionDueDate),
    daysRemaining: daysRemaining,
    status: safeTurnoutText_(firstNonBlank_(
      row.status,
      row.inspectionStatus,
      row.inspection_status,
      row.state
    )),
    rawJson: JSON.stringify(row)
  };
}


function writeTurnoutImportSheet_(sheet, rows) {
  const headers = [
    'Item ID',
    'Asset Tag #/Part UPC',
    'Serial Number',
    'Item Name',
    'Category',
    'Subcategory',
    'Location',
    'Member Name',
    'Assigned To',
    'Inspection Due Date',
    'Days Remaining',
    'Status',
    'Raw JSON'
  ];

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  if (rows.length === 0) return;

  const values = rows.map(row => [
    row.itemId,
    row.assetTag,
    row.serialNumber,
    row.itemName,
    row.category,
    row.subcategory,
    row.location,
    row.memberName,
    row.assignedTo,
    row.inspectionDueDate,
    row.daysRemaining === null ? '' : row.daysRemaining,
    row.status,
    row.rawJson
  ]);

  sheet.getRange(2, 1, values.length, headers.length).setValues(values);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, Math.min(headers.length, 12));
}


function ensureReferenceHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 3).setValues([[
      'Location / Member',
      'Email',
      'Last Seen'
    ]]);
    sheet.setFrozenRows(1);
    return;
  }

  const header = sheet.getRange(1, 1, 1, 3).getValues()[0];
  if (!header[0]) sheet.getRange(1, 1).setValue('Location / Member');
  if (!header[1]) sheet.getRange(1, 2).setValue('Email');
  if (!header[2]) sheet.getRange(1, 3).setValue('Last Seen');
}


function updateEmailReferenceSheet_(sheet, rows) {
  const existingValues = sheet.getDataRange().getValues();
  const existingKeys = {};

  for (let i = 1; i < existingValues.length; i++) {
    const key = normalizeLookupKey_(existingValues[i][0]);
    if (key) existingKeys[key] = i + 1;
  }

  const now = new Date();
  const additions = [];
  const seenThisRun = {};

  rows.forEach(row => {
    const displayValue = safeTurnoutText_(
      row.location || row.memberName || row.assignedTo
    );
    const key = normalizeLookupKey_(displayValue);

    if (!key || seenThisRun[key]) return;
    seenThisRun[key] = true;

    if (existingKeys[key]) {
      sheet.getRange(existingKeys[key], 3).setValue(now);
    } else {
      additions.push([displayValue, '', now]);
    }
  });

  if (additions.length > 0) {
    sheet.getRange(
      sheet.getLastRow() + 1,
      1,
      additions.length,
      3
    ).setValues(additions);
  }

  return additions.length;
}


function buildEmailReferenceMap_(sheet) {
  if (!sheet) {
    throw new Error(
      `Sheet "${TURNOUT_GEAR_CONFIG.referenceSheetName}" not found.`
    );
  }

  const values = sheet.getDataRange().getValues();
  const map = {};

  for (let i = 1; i < values.length; i++) {
    const key = normalizeLookupKey_(values[i][0]);
    const email = safeTurnoutText_(values[i][1]);

    if (!key || !email) continue;
    map[key] = email;
  }

  return map;
}


function isGearRowEligibleForNotification_(row) {
  const subcategory = safeTurnoutText_(row.subcategory).toLowerCase();

  // Inspection notifications are ONLY for turnout coats and turnout pants.
  // This is an explicit allow-list so helmets, boots, gloves, hoods, etc.
  // can never generate an inspection email even if OperativeIQ supplies
  // an inspection/preventive-maintenance due date for those items.
  if (subcategory !== 'coat' && subcategory !== 'pants') {
    return false;
  }

  const days = Math.floor(Number(row.daysRemaining));
  if (!Number.isFinite(days)) return false;

  // Notify only while an eligible coat/pants item is due today
  // or within the next 30 days.
  return days >= 0 && days <= Math.max.apply(null, TURNOUT_GEAR_CONFIG.thresholds);
}


function getMatchedThreshold_(daysRemaining) {
  const days = Math.floor(Number(daysRemaining));
  if (!Number.isFinite(days) || days < 0) return null;

  // Assign the item to the nearest active threshold window:
  // 15-30 days -> 30-day notice
  // 8-14 days  -> 14-day notice
  // 4-7 days   -> 7-day notice
  // 0-3 days   -> 3-day notice
  const ascendingThresholds = TURNOUT_GEAR_CONFIG.thresholds
    .slice()
    .sort((a, b) => a - b);

  for (let i = 0; i < ascendingThresholds.length; i++) {
    if (days <= ascendingThresholds[i]) {
      return ascendingThresholds[i];
    }
  }

  return null;
}


function buildGearNotificationBody_(items) {
  let body = '';

  items.forEach(item => {
    const row = item.row;
    const identifier =
      row.assetTag ||
      row.serialNumber ||
      row.itemName ||
      row.itemId ||
      'UNKNOWN ITEM';

    body +=
      `You are receiving this email since your item (${identifier}) ` +
      `is due for inspection in less than 30 days. ` +
      `Please return the item to Station 44 immediately. ` +
      `If you have already returned your item you can disregard this notification.\n\n`;
  });

  body += 'This is an automated message.';
  return body;
}


function writeNoMatchSheet_(sheet, noMatchRows) {
  const headers = [
    'Reason',
    'Location / Member',
    'Asset Tag',
    'Serial Number',
    'Item Name',
    'Inspection Due Date',
    'Days Remaining',
    'Raw JSON'
  ];

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  if (noMatchRows.length === 0) return;

  const values = noMatchRows.map(item => [
    item.reason,
    item.row.location || item.row.memberName || item.row.assignedTo,
    item.row.assetTag,
    item.row.serialNumber,
    item.row.itemName,
    item.row.inspectionDueDate,
    item.row.daysRemaining === null ? '' : item.row.daysRemaining,
    item.row.rawJson
  ]);

  sheet.getRange(2, 1, values.length, headers.length).setValues(values);
  sheet.setFrozenRows(1);
}


function ensureNotificationLogHeaders_(sheet) {
  if (sheet.getLastRow() > 0) return;

  sheet.getRange(1, 1, 1, 10).setValues([[
    'Notification Key',
    'Sent At',
    'Recipient',
    'Threshold',
    'Asset Tag',
    'Serial Number',
    'Item Name',
    'Location / Member',
    'Due Date',
    'Mode'
  ]]);
  sheet.setFrozenRows(1);
}


function buildNotificationKey_(row, threshold) {
  const stableId =
    row.itemId ||
    row.assetTag ||
    row.serialNumber ||
    [
      row.itemName,
      row.location,
      row.memberName,
      row.assignedTo
    ].join('|');

  const dueDate = row.inspectionDueDate || '';
  return [stableId, dueDate, threshold].join('::');
}


function hasNotificationBeenSent_(sheet, notificationKey) {
  if (sheet.getLastRow() < 2) return false;

  const keys = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 1)
    .getDisplayValues()
    .flat();

  return keys.indexOf(notificationKey) !== -1;
}


function appendNotificationLog_(
  sheet,
  notificationKey,
  email,
  threshold,
  row,
  mode
) {
  sheet.appendRow([
    notificationKey,
    new Date(),
    email,
    threshold,
    row.assetTag,
    row.serialNumber,
    row.itemName,
    row.location || row.memberName || row.assignedTo,
    row.inspectionDueDate,
    mode
  ]);
}


function deleteObsoleteTurnoutGearTriggers_() {
  const handlerNames = [
    'runDailyGearDueNotifications',
    'installGearDueEmailTrigger',
    'processGearNotificationCsv',
    'importTurnoutGearFromApi',
    'importTurnoutReportFromEmail',
    'sendGearDueNotifications'
  ];

  let deleted = 0;

  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (handlerNames.indexOf(trigger.getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(trigger);
      deleted++;
    }
  });

  return deleted;
}


function validateTurnoutGearConfiguration_() {
  const token = PropertiesService
    .getScriptProperties()
    .getProperty(TURNOUT_GEAR_CONFIG.tokenProperty);

  if (!token) {
    throw new Error(
      `Add Script Property "${TURNOUT_GEAR_CONFIG.tokenProperty}" before running this function.`
    );
  }

  if (!TURNOUT_GEAR_CONFIG.workerEndpoint) {
    throw new Error('TURNOUT_GEAR_CONFIG.workerEndpoint is blank.');
  }
}


function calculateDaysRemaining_(dateValue) {
  const parsed = parseTurnoutDate_(dateValue);
  if (!parsed) return null;

  const timezone = TURNOUT_GEAR_CONFIG.timezone;
  const todayText = Utilities.formatDate(new Date(), timezone, 'yyyy-MM-dd');
  const dueText = Utilities.formatDate(parsed, timezone, 'yyyy-MM-dd');

  const today = new Date(`${todayText}T00:00:00`);
  const due = new Date(`${dueText}T00:00:00`);

  return Math.round((due.getTime() - today.getTime()) / 86400000);
}


function normalizeDateForSheet_(value) {
  const parsed = parseTurnoutDate_(value);
  return parsed || safeTurnoutText_(value);
}


function parseTurnoutDate_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}


function firstNonBlank_() {
  for (let i = 0; i < arguments.length; i++) {
    const value = arguments[i];
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return value;
    }
  }
  return '';
}


function toFiniteNumber_(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}


function normalizeLookupKey_(value) {
  return safeTurnoutText_(value).toLowerCase().replace(/\s+/g, ' ');
}


function safeTurnoutText_(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}


function getOrCreateTurnoutSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}
/**
 * Populates blank emails in "Email Reference list" from the protected
 * /preview-crew-emails Worker route.
 *
 * Matching:
 * - First Last
 * - Last First
 * - Unique token-order matches, including suffix placement
 *
 * Existing nonblank email addresses are preserved.
 */
function refreshCrewEmailReferences() {
  validateTurnoutGearConfiguration_();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateTurnoutSheet_(
    ss,
    TURNOUT_GEAR_CONFIG.referenceSheetName
  );

  ensureCrewEmailReferenceHeaders_(sheet);

  const payload = fetchProtectedWorkerJson_(
    'https://wtfd-operative-preview.hartleywtfd.workers.dev/preview-crew-emails'
  );

  const crewRows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.rows)
      ? payload.rows
      : [];

  if (!crewRows.length) {
    throw new Error(
      'The /preview-crew-emails response did not contain any crew rows.'
    );
  }

  const indexes = buildCrewEmailIndexes_(crewRows);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return {
      populatedEmails: 0,
      preservedEmails: 0,
      unmatchedNames: 0,
      ambiguousNames: 0,
      activeCrewEmails: crewRows.length
    };
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  let populatedEmails = 0;
  let preservedEmails = 0;
  let unmatchedNames = 0;
  let ambiguousNames = 0;

  const updated = values.map(row => {
    const referenceName = safeTurnoutText_(row[0]);
    const existingEmail = safeTurnoutText_(row[1]);

    if (existingEmail) {
      preservedEmails++;
      return row;
    }

    const match = findUniqueCrewEmailMatch_(referenceName, indexes);

    if (match.status === 'matched') {
      row[1] = match.record.email;
      row[2] = new Date();
      row[3] = 'OperativeIQ';
      row[4] = match.record.crewId || '';
      populatedEmails++;
    } else if (match.status === 'ambiguous') {
      row[3] = 'Ambiguous';
      ambiguousNames++;
    } else {
      row[3] = 'No Match';
      unmatchedNames++;
    }

    return row;
  });

  sheet.getRange(2, 1, updated.length, 5).setValues(updated);

  const summary = {
    populatedEmails: populatedEmails,
    preservedEmails: preservedEmails,
    unmatchedNames: unmatchedNames,
    ambiguousNames: ambiguousNames,
    activeCrewEmails: crewRows.length
  };

  Logger.log(JSON.stringify(summary, null, 2));
  return summary;
}


function ensureCrewEmailReferenceHeaders_(sheet) {
  const headers = [
    'Location / Member',
    'Email',
    'Last Seen / Updated',
    'Email Source',
    'Crew ID'
  ];

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return;
  }

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
}


function fetchProtectedWorkerJson_(endpoint) {
  const token = PropertiesService
    .getScriptProperties()
    .getProperty(TURNOUT_GEAR_CONFIG.tokenProperty);

  if (!token) {
    throw new Error(
      `Missing Script Property "${TURNOUT_GEAR_CONFIG.tokenProperty}".`
    );
  }

  const response = UrlFetchApp.fetch(endpoint, {
    method: 'get',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    },
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  const body = response.getContentText();

  if (status < 200 || status >= 300) {
    throw new Error(
      `Cloudflare request failed (${status}): ${body.substring(0, 1000)}`
    );
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error(
      `Cloudflare response was not valid JSON: ${body.substring(0, 1000)}`
    );
  }
}


function buildCrewEmailIndexes_(crewRows) {
  const exact = {};
  const token = {};

  crewRows.forEach(raw => {
    const record = {
      crewId: raw.crewId || '',
      employeeId: safeTurnoutText_(raw.employeeId),
      firstName: safeTurnoutText_(raw.firstName),
      lastName: safeTurnoutText_(raw.lastName),
      fullName: safeTurnoutText_(
        raw.fullName || `${raw.firstName || ''} ${raw.lastName || ''}`
      ),
      operativeLocationName: safeTurnoutText_(
        raw.operativeLocationName ||
        `${raw.lastName || ''} ${raw.firstName || ''}`
      ),
      email: safeTurnoutText_(raw.email).toLowerCase()
    };

    if (!record.email) return;

    [
      record.fullName,
      record.operativeLocationName,
      `${record.firstName} ${record.lastName}`,
      `${record.lastName} ${record.firstName}`
    ].forEach(name => addCrewIndexRecord_(exact, normalizePersonName_(name), record));

    addCrewIndexRecord_(
      token,
      normalizePersonTokens_(record.fullName),
      record
    );
  });

  return { exact: exact, token: token };
}


function addCrewIndexRecord_(index, key, record) {
  if (!key) return;
  if (!index[key]) index[key] = [];
  if (!index[key].some(item => item.email === record.email)) {
    index[key].push(record);
  }
}


function findUniqueCrewEmailMatch_(referenceName, indexes) {
  const exactKey = normalizePersonName_(referenceName);
  const exactMatches = indexes.exact[exactKey] || [];

  if (exactMatches.length === 1) {
    return { status: 'matched', record: exactMatches[0] };
  }
  if (exactMatches.length > 1) {
    return { status: 'ambiguous', records: exactMatches };
  }

  const tokenKey = normalizePersonTokens_(referenceName);
  const tokenMatches = indexes.token[tokenKey] || [];

  if (tokenMatches.length === 1) {
    return { status: 'matched', record: tokenMatches[0] };
  }
  if (tokenMatches.length > 1) {
    return { status: 'ambiguous', records: tokenMatches };
  }

  return { status: 'unmatched' };
}


function normalizePersonName_(value) {
  return safeTurnoutText_(value)
    .toLowerCase()
    .replace(/[.,'"()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


function normalizePersonTokens_(value) {
  return normalizePersonName_(value)
    .split(' ')
    .filter(Boolean)
    .sort()
    .join('|');
}
