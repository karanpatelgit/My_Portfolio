/* ==========================
   api.js
   Core networking + app state.

   FIXES IN THIS REWRITE
   ----------------------
   1. loadLifeOS() used to fire 8 requests in fixed batches of 3 via
      Promise.all. If ANY single endpoint failed (e.g. the "mood" action
      erroring on the backend), the whole Promise.all rejected, the outer
      try/catch fired, and NONE of the render*() functions ever ran —
      not dashboard, not mood, not settings-adjacent state. That is why
      whole sections looked "dead": one bad endpoint silently blocked
      everything else. Now every endpoint is fetched independently with
      Promise.allSettled, so one failure only blanks out its own section
      and shows a small toast, while everything else still renders.
   2. Today's tasks are now split into "pending" vs "done/skipped" the
      moment they load. Completing or skipping a task removes it from the
      visible list immediately instead of just relabeling it in place.
   3. Added addTask() for the new Chat Planner, with a local offline queue
      (Local.pendingTasks) so a task typed while the backend is slow/down
      is never silently lost — it's queued and retried on next sync.
========================== */

const API_URL =
"https://script.google.com/macros/s/AKfycbx_ZaXg8IwK5TOEb4CO3ebh8ycujulJv6OjvkQMW-2RpOvVqysdqq1_y-dfqEjdHEBTDw/exec";

const LifeAPI={

// Default timeout raised from 20s to 30s — Apps Script cold starts and
// larger sheets routinely take longer than 20s to respond, which was
// causing "Request timed out" errors on otherwise-fine requests. Callers
// that expect a heavier operation (e.g. sync) can pass a longer timeoutMs.
async _request(url, options, timeoutMs=30000){

if(location.protocol==="file:"){
  throw new Error("This app is open as a local file — Google's API blocks that. Serve it over http(s) instead (e.g. python -m http.server), then reload.");
}

const controller=new AbortController();
const timeout=setTimeout(()=>controller.abort(),timeoutMs);

let response;
try{
  response=await fetch(url, { ...options, signal:controller.signal });
}catch(err){
  throw new Error(err.name==="AbortError"?`Request timed out after ${Math.round(timeoutMs/1000)}s — the backend may be slow or waking up, try again`:"Network error — check your connection");
}finally{
  clearTimeout(timeout);
}

if(!response.ok){
  throw new Error(`Server Error (${response.status})`);
}

const data=await response.json();

if(data && data.error){
  throw new Error(data.error);
}

return data;

},

async _withRetry(fn, retries=3, delay=1000){

try{

return await fn();

}catch(err){

if(retries<=0 || err.message.startsWith("This app is open as a local file")){

throw err;

}

await new Promise(r=>setTimeout(r, delay));

return this._withRetry(fn, retries-1, delay*1.5);

}

},

get(action, timeoutMs){

return this._withRetry(()=>

this._request(`${API_URL}?action=${action}&t=${Date.now()}`, undefined, timeoutMs)

);

},

// Apps Script web apps don't handle CORS preflight (OPTIONS) requests.
// "text/plain" is a CORS "simple" content type and skips preflight.
// Your doPost() should read the body with: JSON.parse(e.postData.contents)
post(body, timeoutMs){

return this._withRetry(()=>

this._request(API_URL,{

method:"POST",

headers:{ "Content-Type":"text/plain;charset=utf-8" },

body:JSON.stringify(body)

}, timeoutMs)

);

},

dashboard(){ return this.get("dashboard"); },

today(){ return this.get("today"); },

tomorrow(){ return this.get("tomorrow"); },

next7(){ return this.get("next7"); },

nextWeek(){ return this.get("nextWeek"); },

next30(){ return this.get("next30"); },

upcoming(){ return this.get("upcoming"); },

moods(){ return this.get("mood"); },

sync(){

// Sync can regenerate occurrences across the whole master planner —
// give it a much longer runway than a normal read before giving up.
return this.post({ action:"sync" }, 60000);

},

complete(id,note=""){

return this.post({ action:"completeTask", occurrenceId:id, note });

},

skip(id,note=""){

return this.post({ action:"skipTask", occurrenceId:id, note });

},

logMood(mood,energy,focus,stress,motivation,note){

return this.post({

action:"logMood", mood, energy, focus, stress, motivation, note

});

},

// NEW — backing action for the Chat Planner. Expects the backend to
// accept { action:"addTask", title, date, time, priority, category, note }
// and create a new row on the master planner sheet. See Code.gs template.
addTask(task){

return this.post({ action:"addTask", ...task });

}

};

/* ==========================
LOCAL (client-side persisted) STATE
Settings, chat log, reminder state, and the offline task queue all live
in localStorage so they survive reloads without needing a backend call.
========================== */

const Local={

KEYS:{
  settings:"lifeos.settings",
  chat:"lifeos.chatHistory",
  pending:"lifeos.pendingTasks",
  notified:"lifeos.notifiedToday"
},

defaultSettings(){
  return {
    userName:"Karan",
    reminderEnabled:true,
    reminderLeadMin:10,
    soundEnabled:true
  };
},

getSettings(){
  try{
    const raw=localStorage.getItem(this.KEYS.settings);
    return raw ? { ...this.defaultSettings(), ...JSON.parse(raw) } : this.defaultSettings();
  }catch{
    return this.defaultSettings();
  }
},

saveSettings(patch){
  const merged={ ...this.getSettings(), ...patch };
  localStorage.setItem(this.KEYS.settings, JSON.stringify(merged));
  return merged;
},

getChat(){
  try{
    return JSON.parse(localStorage.getItem(this.KEYS.chat)) || [];
  }catch{
    return [];
  }
},

pushChat(entry){
  const log=this.getChat();
  log.push(entry);
  // Keep the last 200 messages so localStorage doesn't grow unbounded.
  const trimmed=log.slice(-200);
  localStorage.setItem(this.KEYS.chat, JSON.stringify(trimmed));
  return trimmed;
},

getPendingTasks(){
  try{
    return JSON.parse(localStorage.getItem(this.KEYS.pending)) || [];
  }catch{
    return [];
  }
},

queuePendingTask(task){
  const q=this.getPendingTasks();
  q.push({ ...task, queuedAt:Date.now() });
  localStorage.setItem(this.KEYS.pending, JSON.stringify(q));
  return q;
},

clearPendingTasks(){
  localStorage.setItem(this.KEYS.pending, JSON.stringify([]));
},

removePendingTask(queuedAt){
  const q=this.getPendingTasks().filter(t=>t.queuedAt!==queuedAt);
  localStorage.setItem(this.KEYS.pending, JSON.stringify(q));
  return q;
},

getNotifiedToday(){
  try{
    const data=JSON.parse(localStorage.getItem(this.KEYS.notified));
    const todayKey=new Date().toDateString();
    if(!data || data.date!==todayKey) return { date:todayKey, ids:[] };
    return data;
  }catch{
    return { date:new Date().toDateString(), ids:[] };
  }
},

markNotified(id){
  const state=this.getNotifiedToday();
  if(!state.ids.includes(id)) state.ids.push(id);
  localStorage.setItem(this.KEYS.notified, JSON.stringify(state));
}

};

/* ==========================
GLOBAL APP STATE
========================== */

const AppState={

dashboard:{},

// today: full list as fetched (any status)
today:[],

// todayPending: what's still left to do — this is what renders in
// the Today's Timeline list, and shrinks as tasks are done/skipped.
todayPending:[],

todayCompletedCount:0,
todaySkippedCount:0,
todayTotal:0,

tomorrow:[],

next7:[],

nextWeek:[],

next30:[],

upcoming:[],

moods:[],

loading:false

};

/* ==========================
HELPERS
========================== */

function extractTasks(res){

if(!res) return [];

if(Array.isArray(res)) return res;

if(Array.isArray(res.tasks)) return res.tasks;

return [];

}

function isDoneStatus(task){
  return task.Status==="Completed" || task.Completed===true;
}

function isSkippedStatus(task){
  return task.Status==="Skipped";
}

function applyTodaySplit(list){
  AppState.today=list;
  AppState.todayTotal=list.length;
  AppState.todayCompletedCount=list.filter(isDoneStatus).length;
  AppState.todaySkippedCount=list.filter(isSkippedStatus).length;
  AppState.todayPending=list.filter(t=>!isDoneStatus(t) && !isSkippedStatus(t));
}

// Runs a named set of zero-arg async fetchers independently. A failure in
// one never blocks the others — each result comes back tagged ok/error so
// the caller can render whatever succeeded and report only what failed.
async function fetchIndependently(namedFetchers){

const names=Object.keys(namedFetchers);

const settled=await Promise.allSettled(names.map(n=>namedFetchers[n]()));

const out={};
const failures=[];

settled.forEach((result,i)=>{

const name=names[i];

if(result.status==="fulfilled"){
  out[name]={ ok:true, value:result.value };
}else{
  out[name]={ ok:false, error:result.reason?.message||"Unknown error" };
  failures.push(`${name}: ${out[name].error}`);
}

});

return { results:out, failures };

}

/* ==========================
LOAD EVERYTHING (full load — startup and manual sync only)
========================== */

async function loadLifeOS(){

try{

showLoader(true);

const { results, failures }=await fetchIndependently({

dashboard: ()=>LifeAPI.dashboard(),
today: ()=>LifeAPI.today(),
tomorrow: ()=>LifeAPI.tomorrow(),
next7: ()=>LifeAPI.next7(),
nextWeek: ()=>LifeAPI.nextWeek(),
next30: ()=>LifeAPI.next30(),
upcoming: ()=>LifeAPI.upcoming(),
moods: ()=>LifeAPI.moods()

});

if(results.dashboard.ok) AppState.dashboard=results.dashboard.value||{};

if(results.today.ok) applyTodaySplit(extractTasks(results.today.value));

if(results.tomorrow.ok) AppState.tomorrow=extractTasks(results.tomorrow.value);

if(results.next7.ok) AppState.next7=extractTasks(results.next7.value);

if(results.nextWeek.ok) AppState.nextWeek=extractTasks(results.nextWeek.value);

if(results.next30.ok) AppState.next30=extractTasks(results.next30.value);

if(results.upcoming.ok) AppState.upcoming=extractTasks(results.upcoming.value);

if(results.moods.ok){
  const m=results.moods.value;
  AppState.moods=(m && (m.logs||m))||[];
  if(!Array.isArray(AppState.moods)) AppState.moods=[];
}

renderGreeting();
renderDashboard();
renderUpcoming();
renderCharts();
renderMood();

if(failures.length){
  showError(`Some sections didn't load: ${failures.join(" · ")}`);
}

// Flush anything the Chat Planner queued while offline/unreachable.
flushPendingTasks();

}
catch(err){

console.error(err);

showError(err.message);

}
finally{

showLoader(false);

}

}

// Refreshes just "today" + "dashboard" in the background — used after a
// task action to reconcile with the server without refetching all 8
// endpoints.
async function refreshTodayInBackground(){

const { results, failures }=await fetchIndependently({
  dashboard: ()=>LifeAPI.dashboard(),
  today: ()=>LifeAPI.today()
});

if(results.dashboard.ok) AppState.dashboard=results.dashboard.value||{};

if(results.today.ok) applyTodaySplit(extractTasks(results.today.value));

renderDashboard();
renderCharts();

if(failures.length){
  console.warn("Background refresh partial failure:", failures.join(" · "));
}

}

/* ==========================
TASK ACTIONS (optimistic UI — tasks disappear from the list immediately)
========================== */

async function completeTask(id){

const idx=AppState.todayPending.findIndex(t=>t.OccurrenceID===id);

if(idx===-1) return;

const [removed]=AppState.todayPending.splice(idx,1);

AppState.todayCompletedCount++;

renderDashboard();

showUndoToast("Task completed", ()=>{
  AppState.todayPending.splice(idx,0,removed);
  AppState.todayCompletedCount--;
  renderDashboard();
});

try{

await LifeAPI.complete(id);

refreshTodayInBackground();

}catch(err){

console.error(err);

AppState.todayPending.splice(idx,0,removed);

AppState.todayCompletedCount--;

renderDashboard();

showError("Couldn't complete task — reverted: "+err.message);

}

}

async function skipTask(id){

const idx=AppState.todayPending.findIndex(t=>t.OccurrenceID===id);

if(idx===-1) return;

const [removed]=AppState.todayPending.splice(idx,1);

AppState.todaySkippedCount++;

renderDashboard();

showUndoToast("Task skipped", ()=>{
  AppState.todayPending.splice(idx,0,removed);
  AppState.todaySkippedCount--;
  renderDashboard();
});

try{

await LifeAPI.skip(id);

refreshTodayInBackground();

}catch(err){

console.error(err);

AppState.todayPending.splice(idx,0,removed);

AppState.todaySkippedCount--;

renderDashboard();

showError("Couldn't skip task — reverted: "+err.message);

}

}

async function syncLife(){

try{

await LifeAPI.sync();

await loadLifeOS();

}catch(err){

console.error(err);

showError("Sync failed: "+err.message);

}

}

/* ==========================
MOOD (optimistic UI)
========================== */

async function saveMood(){

const mood=document.querySelector(".mood.active")?.dataset.value||"😊";

const energy=Number(document.getElementById("energy")?.value||0);

const focus=Number(document.getElementById("focus")?.value||0);

const stress=Number(document.getElementById("stress")?.value||0);

const motivation=Number(document.getElementById("motivation")?.value||0);

const note=document.getElementById("note")?.value||"";

const optimisticEntry={ Mood:mood, Energy:energy, Focus:focus, Stress:stress, Motivation:motivation, Note:note };

AppState.moods.push(optimisticEntry);

renderMoodHistory();

renderDashboard();

try{

await LifeAPI.logMood(mood, energy, focus, stress, motivation, note);

}catch(err){

console.error(err);

AppState.moods.pop();

renderMoodHistory();

renderDashboard();

showError("Couldn't save mood — reverted: "+err.message);

}

}

/* ==========================
CHAT PLANNER — offline queue flush
========================== */

async function flushPendingTasks(){

const queue=Local.getPendingTasks();

if(!queue.length) return;

for(const task of queue){

try{

await LifeAPI.addTask(task);

Local.removePendingTask(task.queuedAt);

if(typeof onPendingTaskSynced==="function") onPendingTaskSynced(task);

}catch(err){

// Leave it queued — will retry on next load/sync.
console.warn("Pending task still unsynced:", task, err.message);

}

}

}

/* ==========================
HELPERS
========================== */

function showLoader(show){

const loader=document.getElementById("loader");

if(loader){

loader.style.display=show?"flex":"none";

}

}

let toastTimer=null;

function showError(msg){

let toast=document.getElementById("toast");

if(!toast){

toast=document.createElement("div");

toast.id="toast";

toast.className="toast";

document.body.appendChild(toast);

}

toast.innerHTML="";
toast.textContent=msg;

toast.classList.add("show");

clearTimeout(toastTimer);

toastTimer=setTimeout(()=>{

toast.classList.remove("show");

},4000);

}

// A toast with an Undo button — used for task completion/skip so a
// mis-tap is never a data-loss moment.
let undoToastTimer=null;

function showUndoToast(msg, onUndo){

let toast=document.getElementById("toast");

if(!toast){

toast=document.createElement("div");

toast.id="toast";

toast.className="toast";

document.body.appendChild(toast);

}

toast.innerHTML="";

const span=document.createElement("span");
span.textContent=msg;

const btn=document.createElement("button");
btn.textContent="Undo";
btn.className="toast-undo";
btn.onclick=()=>{
  onUndo();
  toast.classList.remove("show");
  clearTimeout(undoToastTimer);
};

toast.appendChild(span);
toast.appendChild(btn);

toast.classList.add("show");

clearTimeout(undoToastTimer);

undoToastTimer=setTimeout(()=>{

toast.classList.remove("show");

},5000);

}

document.addEventListener(

"DOMContentLoaded",

()=>{
  loadLifeOS();
  if(typeof initReminders==="function") initReminders();
}

);
