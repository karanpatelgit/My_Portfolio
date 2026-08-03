/************************************************************
 * LIFEOS DATA HUB
 * MASTER PLANNER → DATA HUB → WEB APP API
 *
 * Version: 2.2 (FIXED — stable IDs, no more duplicate repeat tasks)
 *
 * IMPORTANT:
 * This script should be installed in the
 * GOOGLE SHEETS VERSION of your LIFEOS DATA HUB.
 *
 * The script automatically creates missing sheets.
 *
 * FIX IN THIS VERSION:
 * syncDailyTasks() / syncLimitedTasks() / syncEvents() used to mint a
 * brand-new random ID (generateId(...)) on EVERY sync for any Master
 * Planner row that didn't already have an ID filled in — and never
 * wrote that ID back to the sheet. So a repeating task with a blank
 * ID column got a new TaskID every single sync, which meant a whole
 * new set of occurrences (OccurrenceID = TaskID + '_' + date) was
 * generated for it each time, while the old occurrences from the
 * previous ID never got cleaned up. That's why the same task kept
 * appearing multiple times on the same day in Today/Upcoming.
 *
 * Now, the first time a row is seen without an ID, the generated ID
 * is written straight back into the Master Planner row so it stays
 * stable on every future sync. Also added a one-time
 * cleanupDuplicatesByContent() action to clear out duplicates that
 * already exist from before this fix.
 ************************************************************/


/* =========================================================
   CONFIGURATION
========================================================= */

const CONFIG = {

  MASTER_PLANNER_ID:
    '1NPC3nPXqARR5jA4y5iJNU7TpN2ssit2qjUCPEFgU_IM',

  DATA_HUB_ID:
    '19v7soyBo4wl7s9mUytfGGuWjDA73oq58',

  TIMEZONE:
    'Asia/Kolkata',

  UPCOMING_DAYS:
    90

};


/* =========================================================
   SHEET DEFINITIONS
========================================================= */

const SHEETS = {

  TASKS: {
    name: 'Tasks',
    headers: [
      'TaskID', 'TaskName', 'StartTime', 'DurationMin', 'RepeatDays',
      'CalendarName', 'ColorHex', 'Active', 'Notes', 'SourceSheet', 'LastSyncedAt'
    ]
  },

  LIMITED_TASKS: {
    name: 'LimitedRepeatTasks',
    headers: [
      'LimitedTaskID', 'TaskName', 'StartDate', 'EndDate', 'StartTime',
      'DurationMin', 'RepeatPattern', 'CalendarName', 'Priority', 'Notes',
      'Active', 'LastSyncedAt'
    ]
  },

  EVENTS: {
    name: 'Events',
    headers: [
      'EventID', 'EventName', 'EventType', 'Date', 'StartTime', 'DurationMin',
      'CalendarName', 'Priority', 'Location', 'Notes', 'LastSyncedAt'
    ]
  },

  OCCURRENCES: {
    name: 'TaskOccurrences',
    headers: [
      'OccurrenceID', 'TaskID', 'SourceType', 'OccurrenceDate', 'StartTime',
      'EndTime', 'DurationMin', 'Title', 'Category', 'Priority', 'Status',
      'Notes', 'GeneratedAt'
    ]
  },

  COMPLETIONS: {
    name: 'CompletionHistory',
    headers: [
      'CompletionID', 'OccurrenceID', 'TaskID', 'Date', 'Status',
      'CompletedAt', 'UserNote'
    ]
  },

  MOODS: {
    name: 'MoodLogs',
    headers: [
      'MoodID', 'Date', 'Time', 'Mood', 'Energy', 'Stress', 'Focus',
      'SleepHours', 'Motivation', 'Note', 'CreatedAt'
    ]
  },

  CONTENT: {
    name: 'ContentCalendar',
    headers: [
      'PostID', 'Platform', 'ContentType', 'ScheduledDate', 'ScheduledTime',
      'Caption', 'Status', 'Notes', 'LastSyncedAt'
    ]
  },

  STUDY: {
    name: 'StudySessions',
    headers: [
      'StudyID', 'Date', 'Subject', 'PlannedHours', 'ActualHours',
      'TopicsCovered', 'ReadinessScore', 'CompletionPct', 'ExamDate',
      'Notes', 'LastSyncedAt'
    ]
  },

  SYNC_LOG: {
    name: 'SyncLog',
    headers: [
      'SyncID', 'StartedAt', 'CompletedAt', 'RecordsRead', 'RecordsCreated',
      'RecordsUpdated', 'Status', 'Error'
    ]
  }

};


// Columns that must stay as plain text. Without this, Google Sheets
// silently auto-detects strings like "06:00" or "2026-08-02" and
// converts them into real Date/Time serial values. Reading those back
// produces a JS Date object, which JSON.stringify then dumps as a raw
// UTC timestamp (e.g. "1899-12-30T14:00:00.000Z") instead of the clean
// string you wrote — that's the garbled StartTime/EndTime you saw.
const DATE_TIME_HEADERS = [
  'StartTime', 'EndTime', 'Time', 'OccurrenceDate', 'Date', 'StartDate',
  'EndDate', 'ScheduledDate', 'ScheduledTime', 'ExamDate', 'GeneratedAt',
  'LastSyncedAt', 'CreatedAt', 'CompletedAt'
];


/* =========================================================
   BASIC ACCESS
========================================================= */

function getMaster() {
  return SpreadsheetApp.openById(CONFIG.MASTER_PLANNER_ID);
}

function getHub() {
  return SpreadsheetApp.openById(CONFIG.DATA_HUB_ID);
}


/* =========================================================
   AUTOMATIC SHEET CREATION
========================================================= */

function setupDataHub() {

  const hub = getHub();

  Object.keys(SHEETS).forEach(function(key) {

    const definition = SHEETS[key];
    let sheet = hub.getSheetByName(definition.name);

    if (!sheet) {
      sheet = hub.insertSheet(definition.name);
    }

    ensureHeaders(sheet, definition.headers);

  });

  return {
    ok: true,
    message: 'LifeOS Data Hub is ready',
    spreadsheetId: CONFIG.DATA_HUB_ID,
    sheets: Object.keys(SHEETS).map(function(key) {
      return SHEETS[key].name;
    })
  };

}


function ensureHeaders(sheet, headers) {

  const existing = getHeaders(sheet);
  let headerRow;

  if (existing.length === 0) {

    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    headerRow = 1;

  } else {

    headerRow = findHeaderRow(sheet);

    headers.forEach(function(header) {

      if (existing.indexOf(header) === -1) {

        sheet
          .getRange(headerRow, sheet.getLastColumn() + 1)
          .setValue(header);

      }

    });

  }

  applyPlainTextFormatting(sheet, headerRow);

}


/**
 * Forces date/time-like columns to Plain Text format so Sheets stops
 * auto-converting written strings into Date/Time serials. Safe to run
 * repeatedly — it only touches formatting, never cell values.
 */
function applyPlainTextFormatting(sheet, headerRow) {

  const headers = getHeaders(sheet);
  const maxRows = sheet.getMaxRows();
  const dataRowCount = Math.max(maxRows - headerRow, 1);

  headers.forEach(function(header, i) {

    if (DATE_TIME_HEADERS.indexOf(header) !== -1) {

      sheet
        .getRange(headerRow + 1, i + 1, dataRowCount, 1)
        .setNumberFormat('@');

    }

  });

}


/* =========================================================
   WEB APP
========================================================= */

function doGet(e) {

  // No ?action= param at all → serve the HTML dashboard (uses
  // google.script.run internally, so no CORS issues, no fetch() caching
  // issues). Add ?action=... to any request to keep using the JSON API,
  // e.g. for external tools, testing, or automations.
  const hasAction = e && e.parameter && e.parameter.action;

  if (!hasAction) {
    return HtmlService
      .createTemplateFromFile('Dashboard')
      .evaluate()
      .setTitle('LifeOS Dashboard')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  try {

    const action = e.parameter.action;

    let result;

    switch (action) {

      case 'health':           result = health(); break;
      case 'setup':            result = setupDataHub(); break;
      case 'sync':              result = syncAll(); break;
      case 'generate':          result = generateOccurrences(); break;
      case 'today':              result = getTasksByView('today'); break;
      case 'tomorrow':          result = getTasksByView('tomorrow'); break;
      case 'next7':              result = getTasksByView('next7'); break;
      case 'nextWeek':          result = getTasksByView('nextWeek'); break;
      case 'next30':            result = getTasksByView('next30'); break;
      case 'upcoming':          result = getTasksByView('upcoming'); break;
      case 'dashboard':        result = getDashboard(); break;
      case 'mood':              result = getMoods(); break;
      case 'cleanup':          result = cleanupDuplicateOccurrences(); break;
      case 'cleanupContent':    result = cleanupDuplicatesByContent(); break;

      default:
        result = {
          ok: false,
          error: 'Unknown action',
          actions: [
            'health', 'setup', 'sync', 'generate', 'today', 'tomorrow',
            'next7', 'nextWeek', 'next30', 'upcoming', 'dashboard', 'mood',
            'cleanup', 'cleanupContent'
          ]
        };

    }

    return response(result);

  } catch (error) {

    return response({ ok: false, error: error.message });

  }

}


/* =========================================================
   POST
========================================================= */

function doPost(e) {

  try {

    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    if (action === 'completeTask') {
      return response(completeTask(data.occurrenceId, data.note));
    }

    if (action === 'skipTask') {
      return response(updateTaskStatus(data.occurrenceId, 'Skipped', data.note));
    }

    if (action === 'logMood') {
      return response(logMood(data));
    }

    if (action === 'sync') {
      return response(syncAll());
    }

    if (action === 'addTask') {
      return response(addTask(data));
    }

    return response({ ok: false, error: 'Unknown POST action' });

  } catch (error) {

    return response({ ok: false, error: error.message });

  }

}


/* =========================================================
   JSON RESPONSE
========================================================= */

function response(data) {

  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);

}


/* =========================================================
   SYNC ALL
========================================================= */

function syncAll() {

  const started = new Date();

  setupDataHub();

  let result = {
    recordsRead: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    errors: []
  };

  try {

    const taskResult = syncDailyTasks();
    result.recordsRead += taskResult.read;
    result.recordsCreated += taskResult.created;
    result.recordsUpdated += taskResult.updated;

    const limitedResult = syncLimitedTasks();
    result.recordsRead += limitedResult.read;
    result.recordsCreated += limitedResult.created;
    result.recordsUpdated += limitedResult.updated;

    const eventResult = syncEvents();
    result.recordsRead += eventResult.read;
    result.recordsCreated += eventResult.created;
    result.recordsUpdated += eventResult.updated;

    generateOccurrences();

    writeSyncLog({
      status: 'SUCCESS',
      startedAt: started,
      completedAt: new Date(),
      recordsRead: result.recordsRead,
      recordsCreated: result.recordsCreated,
      recordsUpdated: result.recordsUpdated,
      error: ''
    });

    return { ok: true, message: 'Sync completed', result: result };

  } catch (error) {

    writeSyncLog({
      status: 'FAILED',
      startedAt: started,
      completedAt: new Date(),
      recordsRead: result.recordsRead,
      recordsCreated: result.recordsCreated,
      recordsUpdated: result.recordsUpdated,
      error: error.message
    });

    throw error;

  }

}


/* =========================================================
   ID STABILITY HELPER
   ---------------------------------------------------------
   Finds a row's existing ID, or mints a new one AND writes it straight
   back into the Master Planner source row so the same row gets the
   same ID on every future sync. This is the actual fix for repeat
   tasks duplicating themselves in Today/Upcoming — without this, a row
   with a blank ID column got a brand-new ID (and therefore a brand-new
   set of generated occurrences) on every single sync.
========================================================= */

function getOrAssignStableId(sourceSheet, row, idColumnName, prefix) {

  const existingId = row[idColumnName] || row.ID;

  if (existingId) {
    return String(existingId);
  }

  const newId = generateId(prefix);

  const headers = getHeaders(sourceSheet);
  let colIndex = headers.indexOf(idColumnName);

  // If the Master Planner sheet doesn't have this ID column at all yet,
  // add it so the write-back below (and all future syncs) has somewhere
  // to persist the ID.
  if (colIndex === -1) {
    colIndex = sourceSheet.getLastColumn();
    sourceSheet.getRange(1, colIndex + 1).setValue(idColumnName);
  }

  sourceSheet.getRange(row.__row, colIndex + 1).setValue(newId);

  return newId;

}


/* =========================================================
   DAILY TASK SYNC
========================================================= */

function syncDailyTasks() {

  const master = getMaster();
  const source = master.getSheetByName('DailyTasks');

  if (!source) {
    return { read: 0, created: 0, updated: 0 };
  }

  const hub = getHub();
  const target = hub.getSheetByName('Tasks');

  const sourceRows = readObjects(source);
  const targetRows = readObjects(target);

  const map = {};

  targetRows.forEach(function(row) {
    map[String(row.TaskID)] = row;
  });

  let created = 0;
  let updated = 0;

  sourceRows.forEach(function(row) {

    const id = getOrAssignStableId(source, row, 'TaskID', 'TASK');

    const task = {
      TaskID: id,
      TaskName: row.TaskName || row['Task Name'] || row.Name || '',
      StartTime: formatTime(row.StartTime || row['Start Time'] || row.Time),
      DurationMin: row.DurationMin || row.Duration || '',
      RepeatDays: row.RepeatDays || row['Repeat Days'] || '',
      CalendarName: row.CalendarName || row['Calendar Name'] || row.Category || '',
      ColorHex: row.ColorHex || row.Color || '',
      Active: normalizeBoolean(row.Active),
      Notes: row.Notes || row.Note || '',
      SourceSheet: 'DailyTasks',
      LastSyncedAt: new Date()
    };

    if (map[id]) {
      updateRow(target, map[id].__row, task);
      updated++;
    } else {
      appendRow(target, task);
      created++;
    }

  });

  return { read: sourceRows.length, created: created, updated: updated };

}


/* =========================================================
   LIMITED REPEAT TASK SYNC
========================================================= */

function syncLimitedTasks() {

  const master = getMaster();
  const source = master.getSheetByName('LimitedRepeatTasks');

  if (!source) {
    return { read: 0, created: 0, updated: 0 };
  }

  const hub = getHub();
  const target = hub.getSheetByName('LimitedRepeatTasks');

  const rows = readObjects(source);
  const existing = readObjects(target);

  const map = {};

  existing.forEach(function(row) {
    map[String(row.LimitedTaskID)] = row;
  });

  let created = 0;
  let updated = 0;

  rows.forEach(function(row) {

    const id = getOrAssignStableId(source, row, 'LimitedTaskID', 'LIMITED');

    const task = {
      LimitedTaskID: id,
      TaskName: row.TaskName || row['Task Name'] || row.Name || '',
      StartDate: formatDate(row.StartDate || row['Start Date']),
      EndDate: formatDate(row.EndDate || row['End Date']),
      StartTime: formatTime(row.StartTime || row['Start Time'] || row.Time),
      DurationMin: row.DurationMin || row.Duration || '',
      RepeatPattern: row.RepeatPattern || row['Repeat Pattern'] || row.RepeatDays || '',
      CalendarName: row.CalendarName || row['Calendar Name'] || row.Category || '',
      Priority: row.Priority || '',
      Notes: row.Notes || row.Note || '',
      Active: true,
      LastSyncedAt: new Date()
    };

    if (map[id]) {
      updateRow(target, map[id].__row, task);
      updated++;
    } else {
      appendRow(target, task);
      created++;
    }

  });

  return { read: rows.length, created: created, updated: updated };

}


/* =========================================================
   EVENTS
========================================================= */

function syncEvents() {

  const master = getMaster();
  const source = master.getSheetByName('SpecialEvents');

  if (!source) {
    return { read: 0, created: 0, updated: 0 };
  }

  const hub = getHub();
  const target = hub.getSheetByName('Events');

  const rows = readObjects(source);

  let created = 0;
  let updated = 0;

  const existing = readObjects(target);
  const map = {};

  existing.forEach(function(row) {
    map[String(row.EventID)] = row;
  });

  rows.forEach(function(row) {

    const id = getOrAssignStableId(source, row, 'EventID', 'EVENT');

    const event = {
      EventID: id,
      EventName: row.EventName || row['Event Name'] || row.Name || '',
      EventType: row.EventType || row.Type || '',
      Date: formatDate(row.Date || row.EventDate),
      StartTime: formatTime(row.StartTime || row.Time),
      DurationMin: row.DurationMin || row.Duration || '',
      CalendarName: row.CalendarName || row.Category || '',
      Priority: row.Priority || '',
      Location: row.Location || '',
      Notes: row.Notes || '',
      LastSyncedAt: new Date()
    };

    if (map[id]) {
      updateRow(target, map[id].__row, event);
      updated++;
    } else {
      appendRow(target, event);
      created++;
    }

  });

  return { read: rows.length, created: created, updated: updated };

}


/* =========================================================
   ADD TASK (Chat Planner)
========================================================= */

/**
 * Backs the frontend Chat Planner's LifeAPI.addTask(). Appends a new
 * row directly onto the Master Planner's DailyTasks sheet (as a
 * one-off, non-repeating "task" — RepeatDays left blank means it only
 * matches today via matchesRepeatDay's no-op default) and immediately
 * regenerates occurrences so it shows up right away without waiting
 * for the next full sync.
 */
function addTask(data) {

  const master = getMaster();
  const id = generateId('TASK');

  // Chat-added tasks are one-off by nature ("gym at 6pm tomorrow" should
  // happen once, not repeat forever), so they're written to
  // LimitedRepeatTasks with StartDate === EndDate rather than to
  // DailyTasks, which has no "just once" concept.
  let limited = master.getSheetByName('LimitedRepeatTasks');
  if (!limited) {
    limited = master.insertSheet('LimitedRepeatTasks');
    limited.getRange(1, 1, 1, 8).setValues([
      ['LimitedTaskID', 'TaskName', 'StartDate', 'EndDate', 'StartTime', 'RepeatPattern', 'Priority', 'Active']
    ]);
  }

  const lHeaders = getHeaders(limited);
  const dateStr = data.date || formatDate(new Date());

  const limitedObj = {
    LimitedTaskID: id,
    TaskName: data.title || 'Untitled task',
    StartDate: dateStr,
    EndDate: dateStr,
    StartTime: data.time || '09:00',
    RepeatPattern: 'once',
    Priority: data.priority || 'Medium',
    Active: true
  };

  const lRow = lHeaders.map(function(h) { return limitedObj[h] !== undefined ? limitedObj[h] : ''; });
  limited.appendRow(lRow);

  syncLimitedTasks();
  generateOccurrences();

  return { ok: true, taskId: id, title: limitedObj.TaskName, date: dateStr, time: limitedObj.StartTime };

}


/* =========================================================
   OCCURRENCE GENERATION
========================================================= */

function generateOccurrences() {

  // Prevent two concurrent calls (e.g. a double-click on the URL, or a
  // browser retry) from both reading the sheet before either has written,
  // which is what causes duplicate rows like DT005_2026-08-02 appearing twice.
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);
  } catch (lockError) {
    return { ok: false, error: 'Another generate/sync is already running — try again in a few seconds.' };
  }

  try {
    return generateOccurrencesInternal();
  } finally {
    lock.releaseLock();
  }

}


function generateOccurrencesInternal() {

  const hub = getHub();

  const taskSheet = hub.getSheetByName('Tasks');
  const limitedSheet = hub.getSheetByName('LimitedRepeatTasks');
  const eventSheet = hub.getSheetByName('Events');
  const occurrenceSheet = hub.getSheetByName('TaskOccurrences');

  const tasks = readObjects(taskSheet);
  const limited = readObjects(limitedSheet);
  const events = readObjects(eventSheet);
  const existing = readObjects(occurrenceSheet);

  const map = {};

  existing.forEach(function(row) {
    map[String(row.OccurrenceID)] = row;
  });

  const today = startOfDay(new Date());
  const endDate = addDays(today, CONFIG.UPCOMING_DAYS);

  // Collect every new occurrence in memory first — do NOT write to the
  // sheet inside these loops. Writing one row at a time (the old
  // appendRow-in-a-loop approach) means hundreds or thousands of
  // separate Sheets API calls, which is what was making this so slow.
  const newOccurrences = [];

  /* DAILY TASKS */
  tasks.forEach(function(task) {

    if (!normalizeBoolean(task.Active)) {
      return;
    }

    for (let date = new Date(today); date <= endDate; date = addDays(date, 1)) {

      if (!matchesRepeatDay(date, task.RepeatDays)) {
        continue;
      }

      const occurrence = makeOccurrence(
        task.TaskID, 'DailyTasks', date, task.StartTime, task.DurationMin,
        task.TaskName, task.CalendarName, task.Notes, task.Priority
      );

      if (!map[occurrence.OccurrenceID]) {
        map[occurrence.OccurrenceID] = occurrence; // prevent dupes within this same run
        newOccurrences.push(occurrence);
      }

    }

  });

  /* LIMITED REPEAT TASKS */
  limited.forEach(function(task) {

    const start = parseDate(task.StartDate);
    const end = parseDate(task.EndDate);

    if (!start || !end) {
      return;
    }

    for (
      let date = new Date(Math.max(today.getTime(), start.getTime()));
      date <= Math.min(end.getTime(), endDate.getTime());
      date = addDays(date, 1)
    ) {

      if (!matchesRepeatPattern(date, start, task.RepeatPattern)) {
        continue;
      }

      const occurrence = makeOccurrence(
        task.LimitedTaskID, 'LimitedRepeatTasks', date, task.StartTime,
        task.DurationMin, task.TaskName, task.CalendarName, task.Notes, task.Priority
      );

      if (!map[occurrence.OccurrenceID]) {
        map[occurrence.OccurrenceID] = occurrence;
        newOccurrences.push(occurrence);
      }

    }

  });

  /* SPECIAL EVENTS */
  events.forEach(function(event) {

    const date = parseDate(event.Date);

    if (!date) {
      return;
    }

    if (date < today || date > endDate) {
      return;
    }

    const occurrence = makeOccurrence(
      event.EventID, 'SpecialEvents', date, event.StartTime, event.DurationMin,
      event.EventName, event.CalendarName, event.Notes, event.Priority
    );

    if (!map[occurrence.OccurrenceID]) {
      map[occurrence.OccurrenceID] = occurrence;
      newOccurrences.push(occurrence);
    }

  });

  // Single bulk write instead of one appendRow() call per occurrence.
  if (newOccurrences.length > 0) {
    bulkAppendRows(occurrenceSheet, newOccurrences);
  }

  return { ok: true, generated: newOccurrences.length, horizon: CONFIG.UPCOMING_DAYS };

}


/* =========================================================
   OCCURRENCE OBJECT
========================================================= */

function makeOccurrence(taskId, sourceType, date, startTime, duration, title, category, notes, priority) {

  const dateText = formatDate(date);

  return {
    OccurrenceID: String(taskId) + '_' + dateText,
    TaskID: taskId,
    SourceType: sourceType,
    OccurrenceDate: dateText,
    StartTime: formatTime(startTime),
    EndTime: calculateEndTime(startTime, duration),
    DurationMin: duration,
    Title: title,
    Category: category,
    Priority: priority,
    Status: 'Pending',
    Notes: notes,
    GeneratedAt: new Date()
  };

}


/* =========================================================
   DUPLICATE CLEANUP
========================================================= */

/**
 * Removes duplicate rows from TaskOccurrences, keeping the first
 * occurrence of each OccurrenceID. Only catches EXACT OccurrenceID
 * matches (e.g. from a race condition before the LockService fix).
 */
function cleanupDuplicateOccurrences() {

  const hub = getHub();
  const sheet = hub.getSheetByName('TaskOccurrences');

  if (!sheet) {
    return { ok: false, error: 'TaskOccurrences sheet not found' };
  }

  const rows = readObjects(sheet);
  const seen = {};
  const duplicateRowNumbers = [];

  rows.forEach(function(row) {

    const id = String(row.OccurrenceID || '');

    if (seen[id]) {
      duplicateRowNumbers.push(row.__row);
    } else {
      seen[id] = true;
    }

  });

  // Delete from the bottom up so row numbers above stay valid as we go.
  duplicateRowNumbers.sort(function(a, b) { return b - a; });

  duplicateRowNumbers.forEach(function(rowNum) {
    sheet.deleteRow(rowNum);
  });

  return { ok: true, duplicatesRemoved: duplicateRowNumbers.length };

}


/**
 * Removes duplicate rows from TaskOccurrences that have DIFFERENT
 * OccurrenceIDs but the same Title + OccurrenceDate + StartTime — the
 * pattern left behind by the old "new random ID every sync" bug. Run
 * this ONCE after deploying the ID-stability fix above to clean up
 * whatever already duplicated itself. Keeps the earliest row (lowest
 * row number) for each Title/Date/Time combination.
 */
function cleanupDuplicatesByContent() {

  const hub = getHub();
  const sheet = hub.getSheetByName('TaskOccurrences');

  if (!sheet) {
    return { ok: false, error: 'TaskOccurrences sheet not found' };
  }

  const rows = readObjects(sheet);
  const seen = {};
  const duplicateRowNumbers = [];

  rows.forEach(function(row) {

    const key = String(row.Title || '') + '|' + String(row.OccurrenceDate || '') + '|' + String(row.StartTime || '');

    if (seen[key]) {
      duplicateRowNumbers.push(row.__row);
    } else {
      seen[key] = true;
    }

  });

  duplicateRowNumbers.sort(function(a, b) { return b - a; });

  duplicateRowNumbers.forEach(function(rowNum) {
    sheet.deleteRow(rowNum);
  });

  return { ok: true, duplicatesRemoved: duplicateRowNumbers.length };

}


/**
 * Recovers a clean text value from a cell, even if Google Sheets
 * silently auto-converted it into a Date/Time serial at some point.
 *
 * When Sheets converts a written string like "06:00" into a serial,
 * Apps Script's getValues() turns it back into a JS Date using the
 * SCRIPT PROJECT's timezone (Session.getScriptTimeZone()) — not
 * CONFIG.TIMEZONE. So to recover the exact original string, we must
 * format it back out using that same script timezone, not Asia/Kolkata.
 */
function normalizeDateTimeValue(value, pattern) {

  if (value instanceof Date) {

    if (isNaN(value.getTime())) {
      return '';
    }

    return Utilities.formatDate(value, Session.getScriptTimeZone(), pattern);

  }

  return value;

}


function normalizeOccurrenceForOutput(row) {

  return Object.assign({}, row, {
    OccurrenceDate: normalizeDateTimeValue(row.OccurrenceDate, 'yyyy-MM-dd'),
    StartTime: normalizeDateTimeValue(row.StartTime, 'HH:mm'),
    EndTime: normalizeDateTimeValue(row.EndTime, 'HH:mm'),
    GeneratedAt: normalizeDateTimeValue(row.GeneratedAt, "yyyy-MM-dd'T'HH:mm:ss")
  });

}


/* =========================================================
   TASK FILTERING
========================================================= */

function getTasksByView(view) {

  const hub = getHub();
  const sheet = hub.getSheetByName('TaskOccurrences');

  if (!sheet) {
    return {
      ok: false,
      view: view,
      count: 0,
      tasks: [],
      error: 'TaskOccurrences sheet not found'
    };
  }

  const rows = readObjects(sheet);

  const today = startOfDay(new Date());

  let start = new Date(today);
  let end = new Date(today);

  if (view === 'today') {

    start = new Date(today);
    end = new Date(today);

  } else if (view === 'tomorrow') {

    start = addDays(today, 1);
    end = addDays(today, 1);

  } else if (view === 'next7') {

    start = new Date(today);
    end = addDays(today, 6);

  } else if (view === 'nextWeek') {

    const day = today.getDay();
    const daysUntilMonday = day === 0 ? 1 : 8 - day;

    start = addDays(today, daysUntilMonday);
    end = addDays(start, 6);

  } else if (view === 'next30') {

    start = new Date(today);
    end = addDays(today, 29);

  } else if (view === 'upcoming') {

    start = new Date(today);
    end = addDays(today, CONFIG.UPCOMING_DAYS);

  }

  const completions = getCompletedIds();

  const tasks = rows.filter(function(row) {

    const taskDate = parseFlexibleDate(row.OccurrenceDate);

    if (!taskDate) {
      return false;
    }

    const normalizedTaskDate = startOfDay(taskDate);

    const isInRange = normalizedTaskDate >= start && normalizedTaskDate <= end;

    if (!isInRange) {
      return false;
    }

    const occurrenceId = String(row.OccurrenceID || '');

    if (completions.has(occurrenceId)) {
      return false;
    }

    return true;

  });

  // Defensive dedupe: keep the first row seen for each OccurrenceID,
  // in case any duplicate rows still exist in the sheet.
  const seenIds = {};

  const dedupedTasks = tasks.filter(function(row) {

    const id = String(row.OccurrenceID || '');

    if (seenIds[id]) {
      return false;
    }

    seenIds[id] = true;
    return true;

  });

  dedupedTasks.sort(function(a, b) {

    const dateA = parseFlexibleDate(a.OccurrenceDate);
    const dateB = parseFlexibleDate(b.OccurrenceDate);

    if (dateA && dateB) {

      const dateDifference = dateA.getTime() - dateB.getTime();

      if (dateDifference !== 0) {
        return dateDifference;
      }

    }

    return String(a.StartTime || '').localeCompare(String(b.StartTime || ''));

  });

  return {
    ok: true,
    view: view,
    count: dedupedTasks.length,
    startDate: formatDate(start),
    endDate: formatDate(end),
    tasks: dedupedTasks.map(normalizeOccurrenceForOutput)
  };

}


function parseFlexibleDate(value) {

  if (!value) {
    return null;
  }

  if (Object.prototype.toString.call(value) === '[object Date]') {

    if (isNaN(value.getTime())) {
      return null;
    }

    return new Date(value);

  }

  const text = String(value).trim();

  if (!text) {
    return null;
  }

  // YYYY-MM-DD
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  // DD/MM/YYYY
  match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (match) {
    return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  }

  // DD-MM-YYYY
  match = text.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);

  if (match) {
    return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  }

  // Try native parser as final fallback
  const parsed = new Date(text);

  if (isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;

}


/* =========================================================
   COMPLETION
========================================================= */

function completeTask(occurrenceId, note) {
  return updateTaskStatus(occurrenceId, 'Completed', note);
}


function updateTaskStatus(occurrenceId, status, note) {

  const hub = getHub();
  const sheet = hub.getSheetByName('CompletionHistory');

  appendRow(sheet, {
    CompletionID: generateId('COMP'),
    OccurrenceID: occurrenceId,
    TaskID: '',
    Date: formatDate(new Date()),
    Status: status,
    CompletedAt: status === 'Completed' ? new Date() : '',
    UserNote: note || ''
  });

  return { ok: true, occurrenceId: occurrenceId, status: status };

}


function getCompletedIds() {

  const hub = getHub();
  const sheet = hub.getSheetByName('CompletionHistory');
  const rows = readObjects(sheet);

  const set = new Set();

  rows.forEach(function(row) {

    if (String(row.Status).toLowerCase() === 'completed') {
      set.add(String(row.OccurrenceID));
    }

  });

  return set;

}


/* =========================================================
   MOOD
========================================================= */

function logMood(data) {

  const hub = getHub();
  const sheet = hub.getSheetByName('MoodLogs');

  appendRow(sheet, {
    MoodID: generateId('MOOD'),
    Date: data.date || formatDate(new Date()),
    Time: data.time || formatTime(new Date()),
    Mood: data.mood || '',
    Energy: data.energy || '',
    Stress: data.stress || '',
    Focus: data.focus || '',
    SleepHours: data.sleepHours || '',
    Motivation: data.motivation || '',
    Note: data.note || '',
    CreatedAt: new Date()
  });

  return { ok: true, message: 'Mood saved' };

}


function getMoods() {

  const hub = getHub();
  const sheet = hub.getSheetByName('MoodLogs');
  const rows = readObjects(sheet);

  return { ok: true, moods: rows.slice(-30) };

}


/* =========================================================
   DASHBOARD
   One call that returns everything the frontend needs on load —
   today/tomorrow/next7/nextWeek/upcoming/moods — so the client never
   has to fire 8 separate requests again.
========================================================= */

function getDashboard() {

  return {
    ok: true,
    generatedAt: new Date(),
    today: getTasksByView('today').tasks,
    tomorrow: getTasksByView('tomorrow').tasks,
    next7: getTasksByView('next7').tasks,
    nextWeek: getTasksByView('nextWeek').tasks,
    upcoming: getTasksByView('upcoming').tasks,
    moods: getMoods().moods
  };

}


/* =========================================================
   SYNC LOG
========================================================= */

function writeSyncLog(data) {

  const hub = getHub();
  const sheet = hub.getSheetByName('SyncLog');

  appendRow(sheet, {
    SyncID: generateId('SYNC'),
    StartedAt: data.startedAt,
    CompletedAt: data.completedAt,
    RecordsRead: data.recordsRead,
    RecordsCreated: data.recordsCreated,
    RecordsUpdated: data.recordsUpdated,
    Status: data.status,
    Error: data.error || ''
  });

}


/* =========================================================
   HEALTH
========================================================= */

function health() {

  return {
    ok: true,
    service: 'LifeOS Data Hub',
    status: 'ONLINE',
    timestamp: new Date(),
    spreadsheetId: CONFIG.DATA_HUB_ID
  };

}


/* =========================================================
   SHEET UTILITIES  (dynamic header-row detection)
========================================================= */

/**
 * Detects which row actually holds the column headers.
 *
 * Your Data Hub sheets store a title/description sentence in
 * row 1 and a blank row in row 2, with the real headers in row 3.
 * This scans the first few rows and picks the first one that
 * looks like a header row: multiple short, non-empty cells,
 * rather than one long descriptive sentence.
 */
function findHeaderRow(sheet) {

  const lastCol = sheet.getLastColumn();

  if (lastCol === 0) {
    return 1;
  }

  const scanRows = Math.min(5, sheet.getLastRow() || 1);

  for (let r = 1; r <= scanRows; r++) {

    const rowVals = sheet.getRange(r, 1, 1, lastCol).getValues()[0];

    const nonEmpty = rowVals.filter(function(v) {
      return v !== '' && v !== null;
    }).length;

    const firstCellWords = String(rowVals[0]).trim().split(/\s+/).length;

    // A real header row: at least 2 short, populated cells.
    // A title/description row: one long sentence, mostly empty cells.
    if (nonEmpty >= 2 && firstCellWords <= 4) {
      return r;
    }

  }

  return 1;

}


function getHeaders(sheet) {

  if (sheet.getLastColumn() === 0) {
    return [];
  }

  const headerRow = findHeaderRow(sheet);

  return sheet
    .getRange(headerRow, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(String);

}


function readObjects(sheet) {

  const headerRow = findHeaderRow(sheet);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow <= headerRow || lastColumn < 1) {
    return [];
  }

  const headers = sheet
    .getRange(headerRow, 1, 1, lastColumn)
    .getValues()[0]
    .map(String);

  const values = sheet
    .getRange(headerRow + 1, 1, lastRow - headerRow, lastColumn)
    .getValues();

  return values.map(function(row, index) {

    const obj = { __row: headerRow + 1 + index };

    headers.forEach(function(header, i) {
      obj[header] = row[i];
    });

    return obj;

  });

}


function appendRow(sheet, object) {

  const headers = getHeaders(sheet);

  const row = headers.map(function(header) {
    return object[header] !== undefined ? object[header] : '';
  });

  sheet.appendRow(row);

}


/**
 * Writes many objects to a sheet in one API call instead of one
 * appendRow() call per object. Use this instead of a loop of
 * appendRow() whenever you're writing more than a handful of rows —
 * looped appendRow() calls are the main cause of Apps Script
 * "generate"/"sync" actions timing out or taking minutes to run.
 */
function bulkAppendRows(sheet, objects) {

  if (!objects || objects.length === 0) {
    return;
  }

  const headers = getHeaders(sheet);

  const rows = objects.map(function(object) {
    return headers.map(function(header) {
      return object[header] !== undefined ? object[header] : '';
    });
  });

  const startRow = sheet.getLastRow() + 1;

  sheet
    .getRange(startRow, 1, rows.length, headers.length)
    .setValues(rows);

}


function updateRow(sheet, rowNumber, object) {

  const headers = getHeaders(sheet);

  const current = sheet
    .getRange(rowNumber, 1, 1, headers.length)
    .getValues()[0];

  const row = headers.map(function(header, i) {
    return object[header] !== undefined ? object[header] : current[i];
  });

  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([row]);

}


/* =========================================================
   DATE / TIME
========================================================= */

function formatDate(value) {

  if (!value) {
    return '';
  }

  const date = parseFlexibleDate(value);

  if (!date) {
    return '';
  }

  return Utilities.formatDate(date, CONFIG.TIMEZONE, 'yyyy-MM-dd');

}


function parseDate(value) {

  if (value instanceof Date) {
    return value;
  }

  const text = String(value || '');

  if (!text) {
    return null;
  }

  const parts = text.split('-');

  if (parts.length === 3) {
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  const date = new Date(text);

  return isNaN(date.getTime()) ? null : date;

}


function formatTime(value) {

  if (!value) {
    return '';
  }

  if (value instanceof Date) {
    return Utilities.formatDate(value, CONFIG.TIMEZONE, 'HH:mm');
  }

  return String(value).trim();

}


function calculateEndTime(startTime, duration) {

  if (!startTime || !duration) {
    return '';
  }

  const parts = String(startTime).split(':');

  if (parts.length < 2) {
    return '';
  }

  let minutes = Number(parts[0]) * 60 + Number(parts[1]);

  minutes += Number(duration);
  minutes %= 1440;

  return (
    String(Math.floor(minutes / 60)).padStart(2, '0') +
    ':' +
    String(minutes % 60).padStart(2, '0')
  );

}


/* =========================================================
   REPEAT LOGIC
========================================================= */

function matchesRepeatDay(date, repeatDays) {

  if (!repeatDays) {
    return true;
  }

  const text = String(repeatDays).toLowerCase();
  const day = getDayName(date);

  return text.indexOf(day.substring(0, 3).toLowerCase()) !== -1;

}


function matchesRepeatPattern(date, startDate, pattern) {

  const text = String(pattern || '').toLowerCase();

  if (!text) {
    return true;
  }

  if (text.indexOf('once') !== -1) {
    return date.getTime() === startOfDay(startDate).getTime();
  }

  if (text.indexOf('daily') !== -1) {
    return true;
  }

  if (text.indexOf('weekly') !== -1) {
    return date.getDay() === startDate.getDay();
  }

  return true;

}


function getDayName(date) {

  return [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
  ][date.getDay()];

}


function getNextMonday(date) {

  const d = startOfDay(date);
  const day = d.getDay();
  const offset = day === 0 ? 1 : 8 - day;

  return addDays(d, offset);

}


function startOfDay(date) {

  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  return d;

}


function addDays(date, days) {

  const d = new Date(date);
  d.setDate(d.getDate() + days);

  return d;

}


/* =========================================================
   HELPERS
========================================================= */

function normalizeBoolean(value) {

  if (value === true) {
    return true;
  }

  const text = String(value || '').toLowerCase().trim();

  return ['true', 'yes', 'y', '1', 'active'].indexOf(text) !== -1;

}


function generateId(prefix) {

  return prefix + '-' + Utilities.getUuid().replace(/-/g, '').substring(0, 12);

}
