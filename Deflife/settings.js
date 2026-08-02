/* ==========================
settings.js

The Settings tab in the nav previously pointed at an empty <section>
with no JS anywhere building its contents — that's the entire reason
it looked "broken": there was nothing to render. This file builds it.
========================== */

function renderSettings(){

  const section=document.getElementById("settings");

  if(!section) return;

  const s=Local.getSettings();

  const notifPermission = ("Notification" in window) ? Notification.permission : "unsupported";

  section.innerHTML=`

<div class="card fade">
<h2>Profile</h2>
<label style="display:block;margin-top:12px;color:var(--muted);font-size:13px;">What should LifeOS call you?</label>
<input id="settingUserName" type="text" value="${escapeHtml(s.userName)}" placeholder="Your name">
</div>

<div class="card fade">
<h2>Reminders</h2>

<div class="settings-row">
  <div>
    <div class="task-title">Enable reminders</div>
    <div class="task-time">Get a notification before each task starts</div>
  </div>
  <label class="switch">
    <input type="checkbox" id="settingReminderEnabled" ${s.reminderEnabled?"checked":""}>
    <span class="slider"></span>
  </label>
</div>

<label style="display:block;margin-top:15px;color:var(--muted);font-size:13px;">Remind me this many minutes before</label>
<input id="settingLeadMin" type="number" min="1" max="120" value="${s.reminderLeadMin}">

<div class="settings-row" style="margin-top:15px;">
  <div>
    <div class="task-title">Browser notification permission</div>
    <div class="task-time">Status: ${escapeHtml(notifPermission)}</div>
  </div>
  ${notifPermission==="granted"
    ? `<span style="color:var(--success);font-weight:600;">Granted ✓</span>`
    : `<button class="primary" id="btnRequestNotif">Allow</button>`
  }
</div>
</div>

<div class="card fade">
<h2>Sync</h2>
<p style="color:var(--muted);margin-top:6px;font-size:13px;">
Pulls fresh data from your master planner and rebuilds today/upcoming occurrences.
</p>
<button class="primary" id="btnSyncNow" style="margin-top:12px;width:100%;">Sync now</button>
<p id="pendingQueueNote" style="color:var(--muted);margin-top:10px;font-size:13px;"></p>
</div>

<div class="card fade">
<h2>About</h2>
<p style="color:var(--muted);margin-top:6px;font-size:13px;">LifeOS — personal planner &amp; dashboard.</p>
<p style="color:var(--muted);margin-top:4px;font-size:13px;">Data source: your Google Sheets master planner, synced through Apps Script.</p>
</div>

`;

  // --- wire up controls ---

  document.getElementById("settingUserName").addEventListener("change", (e)=>{
    Local.saveSettings({ userName: e.target.value.trim() });
    renderGreeting();
  });

  document.getElementById("settingReminderEnabled").addEventListener("change", (e)=>{
    Local.saveSettings({ reminderEnabled: e.target.checked });
  });

  document.getElementById("settingLeadMin").addEventListener("change", (e)=>{
    const val=Math.max(1, Math.min(120, Number(e.target.value)||10));
    e.target.value=val;
    Local.saveSettings({ reminderLeadMin: val });
  });

  const notifBtn=document.getElementById("btnRequestNotif");
  if(notifBtn){
    notifBtn.addEventListener("click", async ()=>{
      if(!("Notification" in window)){
        showError("This browser doesn't support notifications.");
        return;
      }
      const perm=await Notification.requestPermission();
      renderSettings();
      if(perm==="granted") showError("Reminders enabled — you'll get a notification before tasks start.");
    });
  }

  document.getElementById("btnSyncNow").addEventListener("click", ()=>{
    syncLife();
  });

  const pendingNote=document.getElementById("pendingQueueNote");
  const pendingCount=Local.getPendingTasks().length;
  if(pendingNote){
    pendingNote.textContent = pendingCount
      ? `${pendingCount} planner message${pendingCount===1?"":"s"} waiting to sync.`
      : "Everything is synced.";
  }

}
