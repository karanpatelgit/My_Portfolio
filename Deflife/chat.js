/* ==========================
chat.js

CHAT PLANNER — this section had no HTML, no CSS, no JS anywhere in the
original app; the nav had no button for it and nothing rendered it.
It wasn't broken, it simply never existed. This builds it from scratch:
a lightweight natural-language quick-add for tasks that talks to the
same backend as everything else (LifeAPI.addTask), with an offline
queue so a message typed with a flaky connection is never lost.
========================== */

const WEEKDAYS=["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];

function pad2(n){ return String(n).padStart(2,"0"); }

// Very small natural-language parser tuned for short planner messages
// like "remind me to call mom at 5pm tomorrow" or "gym 6:30am high priority".
function parseTaskMessage(raw){

  let text=raw.trim();
  const now=new Date();
  let targetDate=new Date(now);
  let time=null;
  let priority=null;

  // --- date ---
  if(/\btomorrow\b/i.test(text)){
    targetDate.setDate(targetDate.getDate()+1);
    text=text.replace(/\btomorrow\b/i,"");
  }else if(/\btoday\b/i.test(text)){
    text=text.replace(/\btoday\b/i,"");
  }else{
    const wdMatch=text.match(new RegExp(`\\b(${WEEKDAYS.join("|")})\\b`,"i"));
    if(wdMatch){
      const target=WEEKDAYS.indexOf(wdMatch[1].toLowerCase());
      const diff=(target - now.getDay() + 7) % 7 || 7;
      targetDate.setDate(targetDate.getDate()+diff);
      text=text.replace(wdMatch[0],"");
    }
  }

  // --- time --- e.g. "5pm", "5:30 pm", "17:30", "at 9"
  // Only matches numbers that look like a time (have am/pm, a colon, or
  // an explicit "at" in front) so a stray number in the task title itself
  // — "buy 2 bottles of milk" — doesn't get misread as a clock time.
  const timeMatch = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i)
                 || text.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i)
                 || text.match(/\b(\d{1,2})\s*(am|pm)\b/i);
  if(timeMatch){
    let hour=Number(timeMatch[1]);
    const min=(timeMatch[2] && /^\d+$/.test(timeMatch[2]))?Number(timeMatch[2]):0;
    const ampmRaw = timeMatch[3] || (timeMatch[2] && !/^\d+$/.test(timeMatch[2]) ? timeMatch[2] : null);
    const ampm = ampmRaw ? ampmRaw.toLowerCase() : null;
    if(ampm==="pm" && hour<12) hour+=12;
    if(ampm==="am" && hour===12) hour=0;
    if(hour>=0 && hour<24){
      time=`${pad2(hour)}:${pad2(min)}`;
      text=text.replace(timeMatch[0],"");
    }
  }

  // --- priority ---
  if(/\bhigh priority\b|\burgent\b|\bimportant\b/i.test(text)){
    priority="High";
    text=text.replace(/\bhigh priority\b|\burgent\b|\bimportant\b/gi,"");
  }else if(/\blow priority\b/i.test(text)){
    priority="Low";
    text=text.replace(/\blow priority\b/gi,"");
  }

  // --- strip common lead-in phrases ---
  text=text.replace(/^(remind me to|add task|add|schedule|plan|create task)\b\s*/i,"");

  const title=text.replace(/\s{2,}/g," ").trim().replace(/^[-–,]\s*/,"") || "Untitled task";

  return {
    title,
    date: `${targetDate.getFullYear()}-${pad2(targetDate.getMonth()+1)}-${pad2(targetDate.getDate())}`,
    time: time || "09:00",
    priority: priority || "Medium"
  };

}

function chatBubbleHtml(entry){

  const isUser=entry.role==="user";

  return `
<div class="chat-bubble ${isUser?"chat-user":"chat-bot"}">
  ${escapeHtml(entry.text)}
</div>
`;

}

function scrollChatToBottom(){
  const log=document.getElementById("chatLog");
  if(log) log.scrollTop=log.scrollHeight;
}

function renderChat(){

  const section=document.getElementById("chat");

  if(!section) return;

  if(!document.getElementById("chatForm")){

    section.innerHTML=`
<div class="card fade" style="display:flex;flex-direction:column;height:60vh;">

<h2>Planner chat</h2>

<p style="color:var(--muted);font-size:13px;margin-top:4px;">
Type things like "gym at 6pm tomorrow" or "call mom 5:30pm high priority". Try "sync" or "today" too.
</p>

<div id="chatLog" style="flex:1;overflow-y:auto;margin-top:12px;display:flex;flex-direction:column;gap:8px;"></div>

<form id="chatForm" style="display:flex;gap:8px;margin-top:12px;">
  <input id="chatInput" type="text" placeholder="Add or ask about a task…" autocomplete="off" style="margin-top:0;">
  <button type="submit" class="primary" style="white-space:nowrap;">Send</button>
</form>

</div>
`;

    document.getElementById("chatForm").addEventListener("submit",(e)=>{
      e.preventDefault();
      handleChatSubmit();
    });

  }

  const log=document.getElementById("chatLog");
  log.innerHTML=Local.getChat().map(chatBubbleHtml).join("");
  scrollChatToBottom();

}

function addChatMessage(role,text){
  Local.pushChat({ role, text, ts:Date.now() });
  const log=document.getElementById("chatLog");
  if(log){
    log.innerHTML+=chatBubbleHtml({role,text});
    scrollChatToBottom();
  }
}

async function handleChatSubmit(){

  const input=document.getElementById("chatInput");
  const text=input.value.trim();

  if(!text) return;

  input.value="";

  addChatMessage("user", text);

  const lower=text.toLowerCase();

  if(lower==="sync"){
    addChatMessage("bot","On it — syncing with the master planner now.");
    await syncLife();
    addChatMessage("bot","Synced. Your dashboard is up to date.");
    return;
  }

  if(lower==="today"){
    const n=AppState.todayPending.length;
    addChatMessage("bot", n===0
      ? "Nothing left on today's list 🎉"
      : `You've got ${n} task${n===1?"":"s"} left today: ${AppState.todayPending.slice(0,5).map(t=>taskTitle(t).replace(/<[^>]+>/g,"")).join(", ")}${n>5?", …":""}`
    );
    return;
  }

  const parsed=parseTaskMessage(text);

  try{

    await LifeAPI.addTask(parsed);

    addChatMessage("bot", `Added "${parsed.title}" on ${parsed.date} at ${parsed.time} (${parsed.priority} priority).`);

    refreshTodayInBackground();

  }catch(err){

    Local.queuePendingTask(parsed);

    addChatMessage("bot", `Couldn't reach the planner backend right now, so I've queued "${parsed.title}" — it'll sync automatically once the connection is back.`);

  }

}

// Called from api.js after a previously-queued task finally syncs.
function onPendingTaskSynced(task){
  addChatMessage("bot", `Synced queued task: "${task.title}".`);
}
