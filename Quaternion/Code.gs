// ==========================================
// QUATERNION OS - BACKEND
// ==========================================

const APP_NAME = "Quaternion OS";
const SHEET_NAMES = ['USERS', 'TASKS', 'UPDATES', 'EVENTS', 'ACTIVITY_LOG', 'SETTINGS'];

// --- UI & WEB APP BINDINGS ---
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Quaternion OS')
    .addItem('1. Initialize Database', 'setupSystem')
    .addItem('2. Open Dashboard Sidebar', 'openSidebar')
    .addToUi();
}

function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle(APP_NAME)
    .setFaviconUrl('https://img.icons8.com/color/48/000000/task--v1.png')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function openSidebar() {
  const html = HtmlService.createTemplateFromFile('Index').evaluate().setTitle(APP_NAME);
  SpreadsheetApp.getUi().showSidebar(html);
}

// --- SETUP & INSTALLATION ---
function setupSystem() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const schemas = {
    'USERS': ['Email', 'Name', 'Role (OBS/CORE)', 'Department', 'AddedDate'],
    'TASKS': ['TaskID', 'Timestamp', 'CreatorEmail', 'Title', 'Description', 'AssigneeEmail', 'Department', 'Priority', 'Status', 'Progress', 'StartDate', 'Deadline', 'EventID', 'LastUpdated'],
    'UPDATES': ['UpdateID', 'TaskID', 'Timestamp', 'UserEmail', 'Comment'],
    'EVENTS': ['EventID', 'Name', 'Date', 'OwnerEmail', 'Status', 'Notes'],
    'ACTIVITY_LOG': ['LogID', 'Timestamp', 'UserEmail', 'Action', 'ObjectType', 'ObjectID', 'Details'],
    'SETTINGS': ['ConfigKey', 'ConfigValue']
  };

  SHEET_NAMES.forEach(name => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(schemas[name]);
      sheet.getRange(1, 1, 1, schemas[name].length).setFontWeight("bold").setBackground("#f3f4f6");
      sheet.setFrozenRows(1);
    }
  });

  // Add default OBS user if USERS is empty
  const userSheet = ss.getSheetByName('USERS');
  if (userSheet.getLastRow() === 1) {
    userSheet.appendRow([Session.getActiveUser().getEmail(), 'Admin (Setup)', 'OBS', 'President', new Date()]);
  }
  
  SpreadsheetApp.getUi().alert("Setup Complete. You can now add users to the USERS sheet.");
}

// --- AUTHENTICATION & DATA FETCHING ---
function getUserContext() {
  const email = Session.getActiveUser().getEmail();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const users = getSheetData('USERS');
  
  const user = users.find(u => u['Email'].toLowerCase() === email.toLowerCase());
  if (!user) return { isAuthorized: false, email: email };
  
  return {
    isAuthorized: true,
    email: email,
    name: user['Name'],
    role: user['Role (OBS/CORE)'],
    department: user['Department']
  };
}

function getAppInitialData() {
  const ctx = getUserContext();
  if (!ctx.isAuthorized) return { authorized: false, email: ctx.email };

  const allTasks = getSheetData('TASKS');
  let viewableTasks = [];

  if (ctx.role === 'OBS') {
    viewableTasks = allTasks;
  } else {
    viewableTasks = allTasks.filter(t => 
      t['AssigneeEmail'].toLowerCase() === ctx.email.toLowerCase() || 
      t['Department'] === ctx.department ||
      t['CreatorEmail'].toLowerCase() === ctx.email.toLowerCase()
    );
  }

  return {
    authorized: true,
    user: ctx,
    tasks: viewableTasks,
    events: getSheetData('EVENTS'),
    users: getSheetData('USERS').map(u => ({email: u.Email, name: u.Name, dept: u.Department}))
  };
}

// --- CRUD OPERATIONS ---
function saveTask(taskData) {
  const ctx = getUserContext();
  if (!ctx.isAuthorized) throw new Error("Unauthorized");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('TASKS');
  
  const isNew = !taskData.TaskID;
  const taskId = isNew ? Utilities.getUuid() : taskData.TaskID;
  const now = new Date();

  if (isNew) {
    sheet.appendRow([
      taskId, now, ctx.email, taskData.Title, taskData.Description, 
      taskData.AssigneeEmail, taskData.Department, taskData.Priority, 
      'Not Started', 0, taskData.StartDate, taskData.Deadline, 
      taskData.EventID || '', now
    ]);
    logActivity('Created', 'Task', taskId, `Task: ${taskData.Title}`);
  } else {
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === taskId) {
        // Update fields: Title, Desc, Assignee, Priority, Status, Progress, Deadline
        sheet.getRange(i+1, 4).setValue(taskData.Title);
        sheet.getRange(i+1, 5).setValue(taskData.Description);
        sheet.getRange(i+1, 6).setValue(taskData.AssigneeEmail);
        sheet.getRange(i+1, 8).setValue(taskData.Priority);
        sheet.getRange(i+1, 9).setValue(taskData.Status);
        sheet.getRange(i+1, 10).setValue(taskData.Progress);
        sheet.getRange(i+1, 12).setValue(taskData.Deadline);
        sheet.getRange(i+1, 14).setValue(now);
        break;
      }
    }
    logActivity('Updated', 'Task', taskId, `Status: ${taskData.Status}, Prog: ${taskData.Progress}%`);
  }
  return getAppInitialData(); // Return refreshed data
}

// --- UTILITIES ---
function getSheetData(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const headers = data[0];
  const result = [];
  for (let i = 1; i < data.length; i++) {
    let obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    result.push(obj);
  }
  return result;
}

function logActivity(action, objType, objId, details) {
  const ctx = getUserContext();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ACTIVITY_LOG');
  sheet.appendRow([Utilities.getUuid(), new Date(), ctx.email || 'SYSTEM', action, objType, objId, details]);
}

// --- TRIGGERS ---
function checkDeadlines() {
  const tasks = getSheetData('TASKS');
  const now = new Date();
  
  tasks.forEach(t => {
    if (t.Status === 'Completed' || t.Status === 'Cancelled') return;
    
    let deadline = new Date(t.Deadline);
    if (!deadline || isNaN(deadline)) return;
    
    let diffDays = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      MailApp.sendEmail(t.AssigneeEmail, `[Quaternion Reminder] Due Tomorrow: ${t.Title}`, `Your task "${t.Title}" is due tomorrow.`);
    } else if (diffDays < 0) {
      MailApp.sendEmail(t.AssigneeEmail, `[Quaternion Alert] OVERDUE: ${t.Title}`, `Your task "${t.Title}" is overdue!`);
    }
  });
}
