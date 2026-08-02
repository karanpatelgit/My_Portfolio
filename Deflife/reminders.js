/* ==========================
reminders.js

New feature: checks today's pending tasks every 30 seconds and fires a
browser notification a configurable number of minutes before each one
starts (default 10, set on the Settings page). Each task is only ever
notified once per day, tracked in Local.notifiedToday so re-renders
and background refreshes don't spam duplicate alerts.
========================== */

let reminderTimer=null;

function initReminders(){

  if(reminderTimer) clearInterval(reminderTimer);

  reminderTimer=setInterval(checkReminders, 30*1000);

  // Also check once shortly after load, once today's tasks have arrived.
  setTimeout(checkReminders, 3000);

}

function minutesUntil(dateStr, timeStr){

  if(!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return null;

  const [h,m]=timeStr.split(":").map(Number);
  const target=new Date();

  if(dateStr){
    const parsed=new Date(dateStr);
    if(!isNaN(parsed)){
      target.setFullYear(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    }
  }

  target.setHours(h, m, 0, 0);

  return (target.getTime() - Date.now()) / 60000;

}

function fireReminder(task){

  const title=(task.Title||task.TaskName||"Task").toString();

  if("Notification" in window && Notification.permission==="granted"){

    try{
      new Notification("Coming up: "+title, {
        body: `Starts at ${task.StartTime||"soon"}`,
        icon: "icon-192.png",
        tag: "lifeos-"+task.OccurrenceID
      });
    }catch(err){
      console.warn("Notification failed:", err);
    }

  }else{

    // No permission granted — fall back to an in-app toast so the
    // reminder still reaches the person while the app is open.
    showError(`Reminder: "${title}" starts at ${task.StartTime||"soon"}`);

  }

  Local.markNotified(task.OccurrenceID);

}

function checkReminders(){

  const settings=Local.getSettings();

  if(!settings.reminderEnabled) return;

  if(!Array.isArray(AppState.todayPending) || !AppState.todayPending.length) return;

  const notified=Local.getNotifiedToday().ids;

  AppState.todayPending.forEach(task=>{

    if(!task.OccurrenceID || notified.includes(task.OccurrenceID)) return;

    const mins=minutesUntil(task.OccurrenceDate, task.StartTime);

    if(mins===null) return;

    // Fire once the task is within the lead window but hasn't already
    // started more than a couple minutes ago (avoids a burst of stale
    // reminders firing for tasks earlier in the day right after load).
    if(mins<=settings.reminderLeadMin && mins>=-2){
      fireReminder(task);
    }

  });

}
