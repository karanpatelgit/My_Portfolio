/* ==========================
   api.js
========================== */

const API_URL =
"https://script.google.com/macros/s/AKfycbx_ZaXg8IwK5TOEb4CO3ebh8ycujulJv6OjvkQMW-2RpOvVqysdqq1_y-dfqEjdHEBTDw/exec";

// How many requests to send at once when doing a full load. Google Apps
// Script deployments have limited concurrent-execution headroom; 3 at a
// time is a middle ground between "one giant waterfall" (slow) and
// "8 at once" (some calls stall/timeout under load).
const BATCH_SIZE = 3;

const LifeAPI={

async _request(url, options){

if(location.protocol==="file:"){
  throw new Error("This app is open as a local file — Google's API blocks that. Serve it over http(s) instead (e.g. python -m http.server), then reload.");
}

const controller=new AbortController();
const timeout=setTimeout(()=>controller.abort(),20000);

let response;
try{
  response=await fetch(url, { ...options, signal:controller.signal });
}catch(err){
  throw new Error(err.name==="AbortError"?"Request timed out":"Network error — check your connection");
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

// Retries transient failures (timeouts, network blips) with a short
// backoff. Does NOT retry the file:// guard error, since retrying that
// can never succeed.
async _withRetry(fn, retries=2, delay=700){

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

get(action){

return this._withRetry(()=>

this._request(`${API_URL}?action=${action}&t=${Date.now()}`)

);

},

// IMPORTANT: Apps Script web apps do not handle CORS preflight (OPTIONS)
// requests. Sending "Content-Type: application/json" forces the browser
// to preflight, which silently fails against most Apps Script deployments.
// "text/plain" is a CORS "simple" content type and skips preflight.
// Your Apps Script doPost() should read the body with:
//   const data = JSON.parse(e.postData.contents);
post(body){

return this._withRetry(()=>

this._request(API_URL,{

method:"POST",

headers:{ "Content-Type":"text/plain;charset=utf-8" },

body:JSON.stringify(body)

})

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

return this.post({ action:"sync" });

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

}

};

/* ==========================
GLOBAL APP STATE
========================== */

const AppState={

dashboard:{},

today:[],

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

// Normalizes an API response into a plain task array, whether the backend
// returned { tasks: [...] } or a bare array.
function extractTasks(res){

if(!res) return [];

if(Array.isArray(res)) return res;

if(Array.isArray(res.tasks)) return res.tasks;

return [];

}

// Runs a list of zero-arg async fetchers in fixed-size concurrent batches,
// returning results in the original order. Faster than one-at-a-time,
// gentler on the backend than firing everything at once.
async function runInBatches(fetchers, batchSize=BATCH_SIZE){

const results=new Array(fetchers.length);

for(let i=0;i<fetchers.length;i+=batchSize){

const slice=fetchers.slice(i,i+batchSize);

const settled=await Promise.all(slice.map(fn=>fn()));

settled.forEach((val,j)=>{ results[i+j]=val; });

}

return results;

}

/* ==========================
LOAD EVERYTHING (full load — startup and manual sync only)
========================== */

async function loadLifeOS(){

try{

showLoader(true);

const [

dashboard,

today,

tomorrow,

next7,

nextWeek,

next30,

upcoming,

moods

]=await runInBatches([

()=>LifeAPI.dashboard(),

()=>LifeAPI.today(),

()=>LifeAPI.tomorrow(),

()=>LifeAPI.next7(),

()=>LifeAPI.nextWeek(),

()=>LifeAPI.next30(),

()=>LifeAPI.upcoming(),

()=>LifeAPI.moods()

]);

AppState.dashboard=dashboard||{};

AppState.today=extractTasks(today);

AppState.tomorrow=extractTasks(tomorrow);

AppState.next7=extractTasks(next7);

AppState.nextWeek=extractTasks(nextWeek);

AppState.next30=extractTasks(next30);

AppState.upcoming=extractTasks(upcoming);

AppState.moods=(moods && (moods.logs||moods))||[];

if(!Array.isArray(AppState.moods)) AppState.moods=[];

renderDashboard();

renderUpcoming();

renderCharts();

renderMood();

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
// endpoints. Errors here are logged but don't interrupt the user; the
// optimistic UI update already reflects their action.
async function refreshTodayInBackground(){

try{

const [dashboard, today]=await runInBatches([

()=>LifeAPI.dashboard(),

()=>LifeAPI.today()

]);

AppState.dashboard=dashboard||{};

AppState.today=extractTasks(today);

renderDashboard();

renderCharts();

}catch(err){

console.error("Background refresh failed:", err);

}

}

/* ==========================
TASK ACTIONS (optimistic UI)
========================== */

async function completeTask(id){

const idx=AppState.today.findIndex(t=>t.OccurrenceID===id);

if(idx===-1) return;

const previous={ ...AppState.today[idx] };

// Update immediately so the button feels instant, then reconcile with
// the server in the background instead of blocking on a full reload.
AppState.today[idx]={ ...previous, Status:"Completed", Completed:true };

renderDashboard();

try{

await LifeAPI.complete(id);

refreshTodayInBackground();

}catch(err){

console.error(err);

AppState.today[idx]=previous;

renderDashboard();

showError("Couldn't complete task — reverted: "+err.message);

}

}

async function skipTask(id){

const idx=AppState.today.findIndex(t=>t.OccurrenceID===id);

if(idx===-1) return;

const previous={ ...AppState.today[idx] };

AppState.today[idx]={ ...previous, Status:"Skipped" };

renderDashboard();

try{

await LifeAPI.skip(id);

refreshTodayInBackground();

}catch(err){

console.error(err);

AppState.today[idx]=previous;

renderDashboard();

showError("Couldn't skip task — reverted: "+err.message);

}

}

async function syncLife(){

// A user-initiated full resync — this one legitimately needs everything,
// since the backend may regenerate occurrences across all date ranges.
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

// Mood log doesn't affect today/dashboard task counts, so no
// background refresh is needed beyond what we already applied.

}catch(err){

console.error(err);

AppState.moods.pop();

renderMoodHistory();

renderDashboard();

showError("Couldn't save mood — reverted: "+err.message);

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

// Non-blocking toast instead of alert(), so errors don't freeze the UI
// or hide behind the loader.
let toastTimer=null;

function showError(msg){

let toast=document.getElementById("toast");

if(!toast){

toast=document.createElement("div");

toast.id="toast";

toast.className="toast";

document.body.appendChild(toast);

}

toast.textContent=msg;

toast.classList.add("show");

clearTimeout(toastTimer);

toastTimer=setTimeout(()=>{

toast.classList.remove("show");

},4000);

}

document.addEventListener(

"DOMContentLoaded",

loadLifeOS

);
