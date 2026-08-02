/* ==========================
app.js
========================== */

function escapeHtml(str){

if(str===null||str===undefined) return "";

return String(str)

.replaceAll("&","&amp;")

.replaceAll("<","&lt;")

.replaceAll(">","&gt;")

.replaceAll('"',"&quot;")

.replaceAll("'","&#039;");

}

function taskTitle(task){

return escapeHtml(task.Title||task.TaskName||"Untitled task");

}

/* ==========================
GREETING (salutation)
Time-of-day greeting + the user's name from Settings. This element
already existed in the header but was hardcoded to "Good Morning" —
now it's live and reacts to what's saved on the Settings page.
========================== */

function renderGreeting(){

const el=document.getElementById("greeting");
const dateEl=document.getElementById("todayDate");

if(dateEl){
  dateEl.textContent=new Date().toLocaleDateString(undefined,{
    weekday:"long", year:"numeric", month:"long", day:"numeric"
  });
}

if(!el) return;

const hour=new Date().getHours();
const name=Local.getSettings().userName?.trim();

let salutation="Good Evening";
if(hour<5) salutation="Still up";
else if(hour<12) salutation="Good Morning";
else if(hour<17) salutation="Good Afternoon";
else if(hour<21) salutation="Good Evening";
else salutation="Good Night";

el.textContent=name ? `${salutation}, ${name}` : salutation;

}

function renderDashboard() {

    const dashboard = document.getElementById("dashboard");

    if (!dashboard) return;

    const total = AppState.todayTotal;

    const completed = AppState.todayCompletedCount;

    const pending = AppState.todayPending.length;

    const percent = total === 0 ? 0 :
        Math.round((completed / total) * 100);

    dashboard.innerHTML = `

<div class="card fade">

<div style="display:flex;justify-content:space-between;align-items:center;">

<div>

<h2>Today's Progress</h2>

<p style="color:var(--muted);margin-top:6px;">
${completed} of ${total} tasks completed
</p>

</div>

<div class="progress-ring">

<svg width="120" height="120">

<circle
class="progress-bg"
cx="60"
cy="60"
r="50"></circle>

<circle
id="progressCircle"
class="progress-bar"
cx="60"
cy="60"
r="50"></circle>

</svg>

<div class="progress-text">

${percent}%

</div>

</div>

</div>

</div>

<div class="stats">

<div class="stat">

<span>Total</span>

<h2>${total}</h2>

</div>

<div class="stat">

<span>Done</span>

<h2>${completed}</h2>

</div>

<div class="stat">

<span>Pending</span>

<h2>${pending}</h2>

</div>

<div class="stat">

<span>Mood</span>

<h2>${escapeHtml(latestMood())}</h2>

</div>

</div>

<div class="section-title">

Today's Timeline

</div>

<div id="todayList"></div>

`;

    const circumference = 314;
    const offset = circumference - (percent / 100) * circumference;

    setTimeout(() => {

        const ring = document.getElementById("progressCircle");

        if (ring) ring.style.strokeDashoffset = offset;

    }, 300);

    renderToday();

}

function renderToday() {

    const container = document.getElementById("todayList");

    if (!container) return;

    container.innerHTML = "";

    if (AppState.todayPending.length === 0) {

        const allDone = AppState.todayTotal > 0;

        container.innerHTML = `
<div class="card">

${allDone ? "All done for today 🎉" : "Nothing scheduled today 🎉"}

</div>
`;

        return;

    }

    AppState.todayPending.forEach(task => {

        const occId = escapeHtml(task.OccurrenceID);

        container.innerHTML += `

<div class="task fade">

<div class="task-left">

<div
class="task-dot"
style="background:${priorityColor(task.Priority)}">

</div>

<div>

<div class="task-title">

${taskTitle(task)}

</div>

<div class="task-time">

${escapeHtml(task.StartTime || "--:--")}

•

${Number(task.DurationMin) || 0} mins

</div>

</div>

</div>

<div>

<button

class="success"

onclick="completeTask('${occId}')">

Done

</button>

<br>

<button

class="secondary"

onclick="skipTask('${occId}')">

Skip

</button>

</div>

</div>

`;

    });

}

function renderUpcoming() {

    const timeline = document.getElementById("timeline");

    if (!timeline) return;

    timeline.innerHTML = "";

    addUpcomingSection(
        timeline,
        "Tomorrow",
        AppState.tomorrow
    );

    addUpcomingSection(
        timeline,
        "Next 7 Days",
        AppState.next7
    );

    addUpcomingSection(
        timeline,
        "Next Week",
        AppState.nextWeek
    );

    addUpcomingSection(
        timeline,
        "Upcoming",
        AppState.upcoming
    );

}

function addUpcomingSection(parent, title, list) {

    let html = `

<div class="card fade">

<h2>${escapeHtml(title)}</h2>

`;

    if (list.length === 0) {

        html += `

<p style="margin-top:15px;color:var(--muted);">

Nothing planned

</p>

`;

    }

    list.forEach(task => {

        html += `

<div class="task">

<div>

<div class="task-title">

${taskTitle(task)}

</div>

<div class="task-time">

${escapeHtml(task.OccurrenceDate || "")}

•

${escapeHtml(task.StartTime || "--:--")}

</div>

</div>

</div>

`;

    });

    html += "</div>";

    parent.innerHTML += html;

}

function latestMood() {

    if (!AppState.moods.length)
        return "🙂";

    const mood = AppState.moods[AppState.moods.length - 1];

    return mood.Mood || "🙂";

}

function priorityColor(priority) {

    if (!priority)
        return "#00d084";

    priority = priority.toLowerCase();

    if (priority.includes("high"))
        return "#ff5d73";

    if (priority.includes("medium"))
        return "#ffb347";

    return "#00d084";

}

/* ==========================
MOOD SECTION
========================== */

const MOOD_OPTIONS = ["😄","😊","😐","😔","😡"];

function renderMood() {

    const section = document.getElementById("mood");

    if (!section) return;

    if (!document.getElementById("moodForm")) {

        section.innerHTML = `

<div class="card fade">

<h2>How are you feeling?</h2>

<div id="moodPicker" style="display:flex;gap:10px;justify-content:space-between;margin-top:15px;">

${MOOD_OPTIONS.map(m => `
<div class="mood" data-value="${m}" style="font-size:28px;cursor:pointer;padding:8px 10px;border-radius:14px;">${m}</div>
`).join("")}

</div>

<form id="moodForm">

<label style="display:block;margin-top:15px;color:var(--muted);font-size:13px;">Energy</label>

<input type="range" id="energy" min="1" max="10" value="5">

<label style="display:block;margin-top:15px;color:var(--muted);font-size:13px;">Focus</label>

<input type="range" id="focus" min="1" max="10" value="5">

<label style="display:block;margin-top:15px;color:var(--muted);font-size:13px;">Stress</label>

<input type="range" id="stress" min="1" max="10" value="5">

<label style="display:block;margin-top:15px;color:var(--muted);font-size:13px;">Motivation</label>

<input type="range" id="motivation" min="1" max="10" value="5">

<textarea id="note" placeholder="Any notes?" rows="3"></textarea>

<button type="submit" class="primary" style="margin-top:15px;width:100%;">Save mood</button>

</form>

</div>

<div class="section-title">Recent moods</div>

<div id="moodHistory"></div>

`;

        section.querySelectorAll(".mood").forEach(el => {

            el.onclick = () => {

                section.querySelectorAll(".mood").forEach(m => m.classList.remove("active"));

                el.classList.add("active");

            };

        });

        document.getElementById("moodForm").addEventListener("submit", (e) => {

            e.preventDefault();

            saveMood();

        });

    }

    renderMoodHistory();

}

function renderMoodHistory() {

    const container = document.getElementById("moodHistory");

    if (!container) return;

    container.innerHTML = "";

    if (!AppState.moods.length) {

        container.innerHTML = `<div class="card">No mood logs yet</div>`;

        return;

    }

    AppState.moods.slice().reverse().slice(0, 10).forEach(m => {

        container.innerHTML += `

<div class="task">

<div>

<div class="task-title">${escapeHtml(m.Mood || "🙂")}</div>

<div class="task-time">${escapeHtml(m.Note || "")}</div>

</div>

</div>

`;

    });

}

/* ==========================
NAV WIRING
========================== */

document

.querySelectorAll(".bottom-nav button")

.forEach(btn => {

    btn.onclick = () => {

        document

            .querySelectorAll(".bottom-nav button")

            .forEach(b => b.classList.remove("active"));

        btn.classList.add("active");

        document

            .querySelectorAll("main section")

            .forEach(s => s.classList.add("hidden"));

        const target = document.getElementById(btn.dataset.page);

        if (target) target.classList.remove("hidden");

        // Lazily render sections that don't need live server data on
        // every app load — Settings and Chat Planner build themselves
        // the first time they're opened.
        if (btn.dataset.page === "settings" && typeof renderSettings === "function") {
            renderSettings();
        }

        if (btn.dataset.page === "chat" && typeof renderChat === "function") {
            renderChat();
        }

    };

});

const fab = document.getElementById("fab");

if (fab) fab.onclick = syncLife;
