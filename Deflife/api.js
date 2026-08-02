/* ==========================
   api.js
========================== */

const API_URL =
"https://script.google.com/macros/s/AKfycbx_ZaXg8IwK5TOEb4CO3ebh8ycujulJv6OjvkQMW-2RpOvVqysdqq1_y-dfqEjdHEBTDw/exec";

const LifeAPI={

async get(action){

if(location.protocol==="file:"){
  throw new Error("This app is open as a local file — Google's API blocks that. Serve it over http(s) instead (e.g. python -m http.server), then reload.");
}

const controller=new AbortController();
const timeout=setTimeout(()=>controller.abort(),20000);

let response;
try{
  response=await fetch(
    `${API_URL}?action=${action}&t=${Date.now()}`,
    { signal:controller.signal }
  );
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

async post(body){

// IMPORTANT: Apps Script web apps do not handle CORS preflight (OPTIONS)
// requests. Sending "Content-Type: application/json" forces the browser
// to preflight, which silently fails against most Apps Script deployments.
// "text/plain" is a CORS "simple" content type and skips preflight.
// Your Apps Script doPost() should read the body with:
//   const data = JSON.parse(e.postData.contents);
if(location.protocol==="file:"){
  throw new Error("This app is open as a local file — Google's API blocks that. Serve it over http(s) instead (e.g. python -m http.server), then reload.");
}

const controller=new AbortController();
const timeout=setTimeout(()=>controller.abort(),20000);

let response;
try{
  response=await fetch(API_URL,{
    method:"POST",
    headers:{
      "Content-Type":"text/plain;charset=utf-8"
    },
    body:JSON.stringify(body),
    signal:controller.signal
  });
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

dashboard(){

return this.get("dashboard");

},

today(){

return this.get("today");

},

tomorrow(){

return this.get("tomorrow");

},

next7(){

return this.get("next7");

},

nextWeek(){

return this.get("nextWeek");

},

next30(){

return this.get("next30");

},

upcoming(){

return this.get("upcoming");

},

moods(){

return this.get("mood");

},

sync(){

return this.post({

action:"sync"

});

},

complete(id,note=""){

return this.post({

action:"completeTask",

occurrenceId:id,

note

});

},

skip(id,note=""){

return this.post({

action:"skipTask",

occurrenceId:id,

note

});

},

logMood(mood,energy,focus,stress,motivation,note){

return this.post({

action:"logMood",

mood,

energy,

focus,

stress,

motivation,

note

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

/* ==========================
LOAD EVERYTHING
========================== */

async function loadLifeOS(){

try{

showLoader(true);

// Sequential rather than Promise.all: firing 8 simultaneous requests at
// one Apps Script deployment can exceed its concurrency handling and
// cause some calls to stall/timeout. One at a time is slower but reliable.
const dashboard=await LifeAPI.dashboard();
const today=await LifeAPI.today();
const tomorrow=await LifeAPI.tomorrow();
const next7=await LifeAPI.next7();
const nextWeek=await LifeAPI.nextWeek();
const next30=await LifeAPI.next30();
const upcoming=await LifeAPI.upcoming();
const moods=await LifeAPI.moods();

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

renderToday();

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

/* ==========================
TASK ACTIONS
========================== */

async function completeTask(id){

try{

await LifeAPI.complete(id);

await loadLifeOS();

}catch(err){

console.error(err);

showError("Couldn't complete task: "+err.message);

}

}

async function skipTask(id){

try{

await LifeAPI.skip(id);

await loadLifeOS();

}catch(err){

console.error(err);

showError("Couldn't skip task: "+err.message);

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
MOOD
========================== */

async function saveMood(){

const mood=document.querySelector(".mood.active")?.dataset.value||"😊";

const energy=Number(

document.getElementById("energy")?.value||0

);

const focus=Number(

document.getElementById("focus")?.value||0

);

const stress=Number(

document.getElementById("stress")?.value||0

);

const motivation=Number(

document.getElementById("motivation")?.value||0

);

const note=document.getElementById("note")?.value||"";

try{

await LifeAPI.logMood(

mood,

energy,

focus,

stress,

motivation,

note

);

await loadLifeOS();

}catch(err){

console.error(err);

showError("Couldn't save mood: "+err.message);

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
