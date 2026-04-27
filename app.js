
const TASK_KEY = "my-lists-tasks-v5";
const PREFS_KEY = "my-lists-prefs-v6";

const defaultPrefs = {
  accent: "#5b5f97",
  accent2: "#8b90be",
  categories: ["Work", "Finance", "Personal", "Shopping List"],
  dailyReminderEnabled: false,
  dailyReminderTime: "09:00",
  notificationsPermissionAsked: false,
  darkMode: false
};

const accentPresets = [
  ["#5b5f97","#8b90be"],
  ["#4b6b63","#87a59a"],
  ["#4f6d8a","#88a7c3"],
  ["#8b5e6b","#c0949f"],
  ["#8a6648","#c3a07f"],
  ["#374151","#6b7280"]
];

const timeframeOptions = ["All", "Today", "This Week", "This Month"];

function loadPrefs(){
  try{
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || "null");
    return { ...defaultPrefs, ...(saved || {}) };
  }catch{
    return { ...defaultPrefs };
  }
}
const prefs = loadPrefs();

function currentSections(){
  return [
    { name: "Home", icon: "⌂", short: "Home" },
    ...prefs.categories.map((name) => ({ name, icon: "•", short: name })),
    { name: "Settings", icon: "⚙", short: "Settings" }
  ];
}

function getDateKey(date){return new Date(date.getFullYear(),date.getMonth(),date.getDate()).toISOString().slice(0,10)}
function getWeekStartKey(date){const d=new Date(date.getFullYear(),date.getMonth(),date.getDate());const day=d.getDay();const diff=day===0?-6:1-day;d.setDate(d.getDate()+diff);return d.toISOString().slice(0,10)}
function getMonthKey(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`}
function stampFor(timeframe, now=new Date()){if(timeframe==="Today") return getDateKey(now); if(timeframe==="This Week") return getWeekStartKey(now); return getMonthKey(now)}
function normalizeTask(task, now=new Date()){
  const createdAt = task.createdAt || now.toISOString();
  const todayKey=getDateKey(now), weekKey=getWeekStartKey(now), monthKey=getMonthKey(now);
  if(task.done){
    return {...task, createdAt, timeframeStamp: task.timeframeStamp || stampFor(task.timeframe, now)};
  }
  if(task.timeframe==="Today"){
    const stamp = task.timeframeStamp || todayKey;
    if(stamp!==todayKey) return {...task, createdAt, timeframe:"This Week", timeframeStamp: weekKey};
    return {...task, createdAt, timeframeStamp: stamp};
  }
  if(task.timeframe==="This Week"){
    const stamp = task.timeframeStamp || weekKey;
    if(stamp!==weekKey) return {...task, createdAt, timeframe:"This Month", timeframeStamp: monthKey};
    return {...task, createdAt, timeframeStamp: stamp};
  }
  return {...task, createdAt, timeframeStamp: task.timeframeStamp || monthKey};
}
function loadTasks(){
  try{
    const saved = localStorage.getItem(TASK_KEY);
    const base = saved ? JSON.parse(saved) : [
      { id: 1, title: "Reply to team emails", section: "Work", timeframe: "Today", done: false },
      { id: 2, title: "Review monthly budget", section: "Finance", timeframe: "This Month", done: false },
      { id: 3, title: "Call mom", section: "Personal", timeframe: "This Week", done: false },
      { id: 4, title: "Eggs", section: "Shopping List", timeframe: "Today", done: true }
    ];
    return base.map((task)=>normalizeTask(task));
  }catch{
    return [];
  }
}

const state = {
  tasks: loadTasks(),
  activeTab: "Home",
  query: "",
  selectedSort: "All",
  showComposer: false,
  showInstallHelp: false,
  showSortMenu: false,
  draft: { title: "", timeframe: "Today", category: prefs.categories[0] || "Work" },
  reminderLastShownKey: null,
  editingTaskId: null,
  editingDraft: { title: "", timeframe: "Today", category: "" },
  pendingUndo: null,    // { task, index, timeoutId } for undo-after-delete
  undoTimerId: null
};

function saveTasks(){ try{ localStorage.setItem(TASK_KEY, JSON.stringify(state.tasks)); }catch(e){ console.warn("task save failed", e); } }
function savePrefs(){ try{ localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); }catch(e){ console.warn("prefs save failed", e); } }

function applyTheme(){
  document.documentElement.style.setProperty("--accent", prefs.accent);
  document.documentElement.style.setProperty("--accent-2", prefs.accent2);
  document.documentElement.dataset.theme = prefs.darkMode ? "dark" : "light";
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute("content", prefs.darkMode ? "#0f172a" : prefs.accent);
}

function refreshRollovers(){
  let changed = false;
  const normalized = state.tasks.map((task)=>{
    const next = normalizeTask(task);
    // Shallow check on the fields normalizeTask might change.
    if(next.timeframe !== task.timeframe || next.timeframeStamp !== task.timeframeStamp || next.createdAt !== task.createdAt){
      changed = true;
    }
    return next;
  });
  if(changed){
    state.tasks = normalized;
    saveTasks();
    render();
  }
}

function requestNotificationPermission(){
  if(!("Notification" in window)) return;
  if(Notification.permission === "default"){
    Notification.requestPermission().then(() => {
      prefs.notificationsPermissionAsked = true;
      savePrefs();
      render();
    });
  }
}

function maybeFireReminder(){
  if(!prefs.dailyReminderEnabled) return;
  if(!("Notification" in window)) return;
  if(Notification.permission !== "granted") return;
  const now = new Date();
  const todayKey = getDateKey(now);
  const reminderKey = `${todayKey}-${prefs.dailyReminderTime}`;
  // Skip if we already fired today's reminder.
  if(state.reminderLastShownKey === reminderKey) return;
  // Compare current time to reminder time as minutes-since-midnight.
  const [rh, rm] = prefs.dailyReminderTime.split(":").map(Number);
  const reminderMinutes = rh*60 + rm;
  const nowMinutes = now.getHours()*60 + now.getMinutes();
  // Fire if we're at or past the reminder time today.
  if(nowMinutes >= reminderMinutes){
    const openToday = state.tasks.filter((task)=>!task.done && task.timeframe==="Today").length;
    const body = openToday ? `You have ${openToday} task${openToday===1?"":"s"} tagged Today.` : "You have no Today tasks yet.";
    try{
      new Notification("My Lists reminder", { body, tag: reminderKey });
      state.reminderLastShownKey = reminderKey;
    }catch{}
  }
}
setInterval(() => { refreshRollovers(); maybeFireReminder(); }, 30000);

window.addEventListener("visibilitychange", () => {
  if(document.visibilityState==="hidden") saveTasks();
  if(document.visibilityState==="visible"){ refreshRollovers(); maybeFireReminder(); }
});
window.addEventListener("beforeunload", saveTasks);
window.addEventListener("pagehide", saveTasks);

function pillClass(name){ if(name==="Today") return "today"; if(name==="This Week") return "week"; return "month"; }

function setTab(name){
  state.activeTab = name;
  state.query = "";
  state.selectedSort = "All";
  state.showComposer = false;
  state.showSortMenu = false;
  render();
}

function ensureValidCategory(){
  if(!prefs.categories.includes(state.draft.category)){
    state.draft.category = prefs.categories[0] || "Work";
  }
}

function addTask(keepOpen){
  const title = state.draft.title.trim();
  if(!title) return;
  const category = state.activeTab === "Home" || state.activeTab === "Settings" ? state.draft.category : state.activeTab;
  state.tasks.unshift(normalizeTask({
    id: Date.now(),
    title,
    section: category,
    timeframe: state.draft.timeframe,
    timeframeStamp: stampFor(state.draft.timeframe),
    createdAt: new Date().toISOString(),
    done: false
  }));
  state.draft.title = "";
  saveTasks();
  render();
  if(!keepOpen){ state.showComposer = false; render(); }
  if(state.showComposer) setTimeout(()=>document.getElementById("task-input")?.focus(),10);
}
function toggleTask(id){ state.tasks = state.tasks.map((task)=>task.id===id?{...task,done:!task.done}:task); saveTasks(); render(); }

function deleteTask(id){
  // Cancel any prior pending undo (commit it first).
  if(state.undoTimerId){ clearTimeout(state.undoTimerId); state.undoTimerId = null; state.pendingUndo = null; }
  const index = state.tasks.findIndex((t)=>t.id===id);
  if(index === -1) return;
  const task = state.tasks[index];
  state.tasks = state.tasks.filter((t)=>t.id!==id);
  state.pendingUndo = { task, index };
  state.undoTimerId = setTimeout(()=>{
    state.pendingUndo = null;
    state.undoTimerId = null;
    render();
  }, 5000);
  saveTasks();
  render();
}

function performUndo(){
  if(!state.pendingUndo) return;
  if(state.undoTimerId){ clearTimeout(state.undoTimerId); state.undoTimerId = null; }
  const { task, index } = state.pendingUndo;
  const safeIndex = Math.min(index, state.tasks.length);
  state.tasks.splice(safeIndex, 0, task);
  state.pendingUndo = null;
  saveTasks();
  render();
}

function startEditTask(id){
  const task = state.tasks.find((t)=>t.id===id);
  if(!task) return;
  state.editingTaskId = id;
  state.editingDraft = { title: task.title, timeframe: task.timeframe, category: task.section };
  render();
  setTimeout(()=>document.getElementById("edit-task-input")?.focus(), 10);
}

function saveEditedTask(){
  const id = state.editingTaskId;
  if(id == null) return;
  const title = state.editingDraft.title.trim();
  if(!title){ cancelEdit(); return; }
  state.tasks = state.tasks.map((task)=>{
    if(task.id !== id) return task;
    const timeframeChanged = task.timeframe !== state.editingDraft.timeframe;
    return {
      ...task,
      title,
      section: state.editingDraft.category || task.section,
      timeframe: state.editingDraft.timeframe,
      // Reset stamp if timeframe changed so rollover logic is consistent.
      timeframeStamp: timeframeChanged ? stampFor(state.editingDraft.timeframe) : task.timeframeStamp
    };
  });
  state.editingTaskId = null;
  saveTasks();
  render();
}

function cancelEdit(){
  state.editingTaskId = null;
  render();
}
function addCategory(name){
  const clean = name.trim();
  if(!clean) return;
  if(prefs.categories.includes(clean)) return;
  prefs.categories.push(clean);
  savePrefs();
  ensureValidCategory();
  render();
}
function removeCategory(name){
  if(prefs.categories.length <= 1) return;
  prefs.categories = prefs.categories.filter((c)=>c!==name);
  state.tasks = state.tasks.filter((task)=>task.section!==name);
  savePrefs();
  saveTasks();
  ensureValidCategory();
  if(state.activeTab === name) state.activeTab = "Home";
  render();
}

function getSectionCards(){
  return prefs.categories.map((section)=>{
    const tasks = state.tasks.filter((task)=>task.section===section);
    return {
      name: section,
      open: tasks.filter((t)=>!t.done).length,
      total: tasks.length,
      today: tasks.filter((t)=>!t.done && t.timeframe==="Today").length
    };
  });
}
function getTodayTasks(){ return state.tasks.filter((task)=>!task.done && task.timeframe==="Today").sort((a,b)=>a.section.localeCompare(b.section)); }
function getVisibleTasks(){
  if(state.activeTab === "Home" || state.activeTab === "Settings") return [];
  const order = {"Today":0,"This Week":1,"This Month":2};
  return state.tasks
    .filter((task)=>task.section===state.activeTab)
    .filter((task)=>task.title.toLowerCase().includes(state.query.toLowerCase()))
    .filter((task)=>state.selectedSort==="All" || task.timeframe===state.selectedSort)
    .sort((a,b)=>order[a.timeframe]-order[b.timeframe] || Number(a.done)-Number(b.done));
}
function escapeHtml(text){ return String(text).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;"); }

function taskCard(task, showSection=false){
  return `<div class="task-wrap" data-task="${task.id}">
    <div class="swipe-bg left">Delete</div>
    <div class="swipe-bg right">Done</div>
    <div class="task-card" draggable="false">
      <div class="task-top">
        <button class="check-btn ${task.done?"done":""}" data-action="toggle" data-id="${task.id}">${task.done?"✓":""}</button>
        <div class="task-text task-text-clickable" data-action="edit" data-id="${task.id}" role="button" tabindex="0">
          <div class="task-title ${task.done?"done":""}">${escapeHtml(task.title)}</div>
          ${showSection?`<div class="task-meta">${escapeHtml(task.section)}</div>`:""}
        </div>
        <button class="delete-btn" data-action="delete" data-id="${task.id}">✕</button>
      </div>
      <div class="task-footer">
        <span class="pill ${pillClass(task.timeframe)}">${task.timeframe}</span>
        <span class="hint">Tap title to edit · swipe right done · swipe left delete</span>
      </div>
    </div>
  </div>`;
}

function renderHome(){
  const todayTasks = getTodayTasks();
  const cards = getSectionCards();
  const openToday = state.tasks.filter((t)=>!t.done && t.timeframe==="Today").length;
  const openWeek = state.tasks.filter((t)=>!t.done && t.timeframe==="This Week").length;
  const summary = openToday === 0 && openWeek === 0
    ? "All caught up — nothing pending."
    : openToday === 0
      ? `No tasks due today, ${openWeek} this week.`
      : `${openToday} task${openToday===1?"":"s"} due today${openWeek?`, ${openWeek} this week`:""}.`;
  return `<div class="header">
    <div class="header-row">
      <div>
        <div class="eyebrow">Simple daily organizer</div>
        <h1>Today</h1>
        <p class="sub">${summary}</p>
      </div>
      <div style="display:flex;gap:8px">
        <button class="small-btn" id="ask-permission-btn">Alerts</button>
        <button class="install-btn" id="install-help-btn">Install</button>
      </div>
    </div>
  </div>
  <div class="content">
    <div class="panel">
      <div class="panel-title">Today focus</div>
      <div class="note">Local reminders work while the app is open or running on your device. They are not full push notifications.</div>
    </div>
    <div class="today-list" style="margin-top:12px">
      ${todayTasks.length ? todayTasks.map((task)=>taskCard(task,true)).join("") : `<div class="empty"><strong>Nothing due today 🎉</strong><p>Enjoy the free space or add something new.</p></div>`}
    </div>
    <div class="shortcut-list" style="margin-top:16px">
      ${cards.map((card)=>`<button class="shortcut-btn" data-open-section="${card.name}"><span>${escapeHtml(card.name)}</span><span class="muted">${card.open} open</span></button>`).join("")}
    </div>
  </div>`;
}

function renderSection(){
  const tasks = getVisibleTasks();
  return `<div class="header">
    <div class="header-row">
      <div style="display:flex;gap:8px"><button class="icon-btn" id="home-back-btn">←</button></div>
      <div style="flex:1;min-width:0">
        <div class="eyebrow">Category</div>
        <h1 style="font-size:clamp(24px,6vw,30px);overflow-wrap:anywhere;word-break:break-word">${escapeHtml(state.activeTab)}</h1>
      </div>
      <div style="display:flex;gap:8px">
        <button class="icon-btn" id="sort-toggle-btn">⇅</button>
        <button class="icon-btn" id="add-task-btn">＋</button>
      </div>
    </div>
    <div class="search-row">
      <span>⌕</span>
      <input id="search-input" placeholder="Search ${escapeHtml(state.activeTab.toLowerCase())}" value="${escapeHtml(state.query)}" />
    </div>
    ${state.showSortMenu ? `<div class="filters" style="margin-top:12px">${timeframeOptions.map((option)=>`<button class="chip ${state.selectedSort===option?"active":""}" data-sort="${option}">${option}</button>`).join("")}</div>` : ``}
  </div>
  <div class="content">
    <div class="task-list">
      ${tasks.length ? tasks.map((task)=>taskCard(task)).join("") : `<div class="empty"><strong>No matching items</strong><p>Try another filter or add a new to-do.</p></div>`}
    </div>
  </div>`;
}

function renderSettings(){
  return `<div class="header">
    <div class="header-row">
      <div>
        <div class="eyebrow">Customize</div>
        <h1>Settings</h1>
        <p class="sub">Tune the look, categories, and local reminder behavior.</p>
      </div>
      <button class="small-btn" id="ask-permission-btn">Alerts</button>
    </div>
  </div>
  <div class="content">
    <div class="settings-list">
      <div class="settings-item">
        <div class="label">Color theme</div>
        <div class="swatch-row">
          ${accentPresets.map(([a,b])=>`<button class="setting-swatch ${(prefs.accent===a && prefs.accent2===b)?"active":""}" data-accent="${a}" data-accent2="${b}" style="background:linear-gradient(135deg,${a},${b})"></button>`).join("")}
        </div>
        <div class="label" style="margin-top:14px">Appearance</div>
        <div class="chip-row">
          <button class="chip ${prefs.darkMode?"active":""}" id="toggle-dark-btn">${prefs.darkMode?"Dark mode on":"Dark mode off"}</button>
        </div>
      </div>
      <div class="settings-item">
        <div class="label">Categories</div>
        <div class="chip-row" style="margin-bottom:10px">
          ${prefs.categories.map((cat)=>`<button class="chip" data-remove-category="${escapeHtml(cat)}">${escapeHtml(cat)} ×</button>`).join("")}
        </div>
        <div style="display:flex;gap:8px">
          <input id="new-category-input" class="text-input" placeholder="Add a category" />
          <button class="primary-btn" id="add-category-btn" style="width:auto;margin-top:0;padding:0 16px">Add</button>
        </div>
      </div>
      <div class="settings-item">
        <div class="label">Daily reminder</div>
        <div class="chip-row" style="margin-bottom:10px">
          <button class="chip ${prefs.dailyReminderEnabled?"active":""}" id="toggle-reminder-btn">${prefs.dailyReminderEnabled?"On":"Off"}</button>
        </div>
        <div class="label">Reminder time</div>
        <input id="reminder-time-input" class="text-input" type="time" value="${prefs.dailyReminderTime}" />
        <div class="note" style="margin-top:10px">This uses browser notification permission and checks locally while the app is open. It is not a true server push alert.</div>
      </div>
    </div>
  </div>`;
}

function renderEditSheet(){
  if(state.editingTaskId == null) return "";
  return `<div class="sheet-backdrop open" id="edit-sheet">
    <div class="sheet">
      <div class="small">Edit</div>
      <h2>Edit to-do</h2>
      <input id="edit-task-input" class="text-input" placeholder="Item name" value="${escapeHtml(state.editingDraft.title)}" />
      <div class="label" style="margin-top:14px">Category</div>
      <select id="edit-category-select" class="select-input">
        ${prefs.categories.map((cat)=>`<option value="${escapeHtml(cat)}" ${state.editingDraft.category===cat?"selected":""}>${escapeHtml(cat)}</option>`).join("")}
      </select>
      <div class="label" style="margin-top:14px">When</div>
      <div class="chip-row">
        ${timeframeOptions.filter((t)=>t!=="All").map((option)=>`<button class="chip ${state.editingDraft.timeframe===option?"active":""}" data-edit-timeframe="${option}">${option}</button>`).join("")}
      </div>
      <button class="primary-btn" id="save-edit-btn">Save changes</button>
      <button class="secondary-btn" id="cancel-edit-btn">Cancel</button>
    </div>
  </div>`;
}

function renderUndoSnackbar(){
  if(!state.pendingUndo) return "";
  const title = state.pendingUndo.task.title;
  return `<div class="undo-snackbar" id="undo-snackbar" role="status" aria-live="polite">
    <span class="undo-text">Deleted "${escapeHtml(title.length > 30 ? title.slice(0,30)+"…" : title)}"</span>
    <button class="undo-btn" id="undo-btn">Undo</button>
  </div>`;
}

function renderComposer(){
  if(!state.showComposer) return "";
  return `<div class="sheet-backdrop open" id="composer-sheet">
    <div class="sheet">
      <div class="small">Quick add</div>
      <h2>New to-do</h2>
      <input id="task-input" class="text-input" placeholder="Item name" value="${escapeHtml(state.draft.title)}" />
      <div class="label" style="margin-top:14px">Category</div>
      <select id="draft-category-select" class="select-input">
        ${prefs.categories.map((cat)=>`<option value="${escapeHtml(cat)}" ${state.draft.category===cat?"selected":""}>${escapeHtml(cat)}</option>`).join("")}
      </select>
      <div class="label" style="margin-top:14px">When</div>
      <div class="chip-row">
        ${timeframeOptions.filter((t)=>t!=="All").map((option)=>`<button class="chip ${state.draft.timeframe===option?"active":""}" data-draft-timeframe="${option}">${option}</button>`).join("")}
      </div>
      <button class="primary-btn" id="add-keep-btn">Add and keep going</button>
      <button class="secondary-btn" id="add-close-btn">Add and close</button>
      <div class="helper">Press Enter to add quickly</div>
    </div>
  </div>`;
}

function renderInstallHelp(){
  if(!state.showInstallHelp) return "";
  return `<div class="sheet-backdrop open" id="install-sheet">
    <div class="sheet">
      <div class="small">Use on iPhone</div>
      <h2>Add to Home Screen</h2>
      <div class="settings-list" style="margin-top:16px">
        <div class="settings-item">1. Open this app in Safari on your iPhone.</div>
        <div class="settings-item">2. Tap the Share button.</div>
        <div class="settings-item">3. Choose <strong>Add to Home Screen</strong>.</div>
        <div class="settings-item">4. Save it for daily use.</div>
      </div>
      <button class="primary-btn" id="close-install-btn">Got it</button>
    </div>
  </div>`;
}

function renderNav(){
  const sections = currentSections();
  return `<div class="bottom-nav"><div class="nav-wrap"><div class="nav-grid">
    ${sections.map((section)=>`<button class="nav-btn ${state.activeTab===section.name?"active":""}" data-tab="${escapeHtml(section.name)}"><span>${section.icon}</span><span>${escapeHtml(section.short)}</span></button>`).join("")}
  </div></div></div>`;
}

function render(){
  applyTheme();
  ensureValidCategory();
  const app = document.getElementById("app");
  let mainView = renderHome();
  if(state.activeTab === "Settings") mainView = renderSettings();
  if(prefs.categories.includes(state.activeTab)) mainView = renderSection();

  app.innerHTML = `<div class="app-shell"><div class="phone">${mainView}</div>${renderNav()}${renderComposer()}${renderInstallHelp()}${renderEditSheet()}${renderUndoSnackbar()}</div>`;
  bindEvents();
  attachSwipes();
}

function bindTaskListEvents(root){
  root.querySelectorAll("[data-action='toggle']").forEach((btn)=>btn.onclick=(e)=>{e.stopPropagation();toggleTask(Number(btn.dataset.id));});
  root.querySelectorAll("[data-action='delete']").forEach((btn)=>btn.onclick=(e)=>{e.stopPropagation();deleteTask(Number(btn.dataset.id));});
  root.querySelectorAll("[data-action='edit']").forEach((el)=>{
    el.onclick=(e)=>{e.stopPropagation();startEditTask(Number(el.dataset.id));};
    el.onkeydown=(e)=>{ if(e.key==="Enter" || e.key===" "){ e.preventDefault(); startEditTask(Number(el.dataset.id)); } };
  });
}

function bindEvents(){
  document.querySelectorAll("[data-tab]").forEach((btn)=>btn.onclick=()=>setTab(btn.dataset.tab));
  document.querySelectorAll("[data-open-section]").forEach((btn)=>btn.onclick=()=>setTab(btn.dataset.openSection));
  document.querySelectorAll("[data-action='toggle']").forEach((btn)=>btn.onclick=(e)=>{e.stopPropagation();toggleTask(Number(btn.dataset.id));});
  document.querySelectorAll("[data-action='delete']").forEach((btn)=>btn.onclick=(e)=>{e.stopPropagation();deleteTask(Number(btn.dataset.id));});
  document.querySelectorAll("[data-action='edit']").forEach((el)=>{
    el.onclick=(e)=>{e.stopPropagation();startEditTask(Number(el.dataset.id));};
    el.onkeydown=(e)=>{ if(e.key==="Enter" || e.key===" "){ e.preventDefault(); startEditTask(Number(el.dataset.id)); } };
  });
  document.querySelectorAll("[data-sort]").forEach((btn)=>btn.onclick=()=>{state.selectedSort=btn.dataset.sort;render();});
  document.querySelectorAll("[data-draft-timeframe]").forEach((btn)=>btn.onclick=()=>{state.draft.timeframe=btn.dataset.draftTimeframe;render();setTimeout(()=>document.getElementById("task-input")?.focus(),10);});
  document.querySelectorAll("[data-accent]").forEach((btn)=>btn.onclick=()=>{prefs.accent=btn.dataset.accent;prefs.accent2=btn.dataset.accent2;savePrefs();render();});
  document.querySelectorAll("[data-remove-category]").forEach((btn)=>btn.onclick=()=>removeCategory(btn.dataset.removeCategory));

  document.getElementById("install-help-btn")?.addEventListener("click",()=>{state.showInstallHelp=true;render();});
  document.getElementById("close-install-btn")?.addEventListener("click",()=>{state.showInstallHelp=false;render();});
  document.getElementById("home-back-btn")?.addEventListener("click",()=>setTab("Home"));
  document.getElementById("sort-toggle-btn")?.addEventListener("click",()=>{state.showSortMenu=!state.showSortMenu;render();});
  document.getElementById("add-task-btn")?.addEventListener("click",()=>{state.showComposer=true;state.draft.category=state.activeTab;render();setTimeout(()=>document.getElementById("task-input")?.focus(),10);});
  document.getElementById("ask-permission-btn")?.addEventListener("click",()=>requestNotificationPermission());
  document.getElementById("toggle-reminder-btn")?.addEventListener("click",()=>{
    prefs.dailyReminderEnabled = !prefs.dailyReminderEnabled;
    if(prefs.dailyReminderEnabled) requestNotificationPermission();
    savePrefs();
    render();
  });
  document.getElementById("reminder-time-input")?.addEventListener("change",(e)=>{prefs.dailyReminderTime=e.target.value;savePrefs();});
  document.getElementById("add-category-btn")?.addEventListener("click",()=>{
    const input = document.getElementById("new-category-input");
    if(input) addCategory(input.value);
  });

  const search = document.getElementById("search-input");
  if(search) search.addEventListener("input",(e)=>{
    state.query=e.target.value;
    // Re-render only the task list, not the whole app — preserves input focus.
    const list = document.querySelector(".task-list");
    if(list){
      const tasks = getVisibleTasks();
      list.innerHTML = tasks.length
        ? tasks.map((task)=>taskCard(task)).join("")
        : `<div class="empty"><strong>No matching items</strong><p>Try another filter or add a new to-do.</p></div>`;
      bindTaskListEvents(list);
      attachSwipes();
    }
  });

  const composer = document.getElementById("composer-sheet");
  if(composer){ composer.addEventListener("click",(e)=>{if(e.target.id==="composer-sheet"){state.showComposer=false;render();}}); }
  const install = document.getElementById("install-sheet");
  if(install){ install.addEventListener("click",(e)=>{if(e.target.id==="install-sheet"){state.showInstallHelp=false;render();}}); }

  const categorySelect = document.getElementById("draft-category-select");
  if(categorySelect) categorySelect.addEventListener("change",(e)=>{state.draft.category=e.target.value;});

  const input = document.getElementById("task-input");
  if(input){
    input.focus();
    input.addEventListener("input",(e)=>{state.draft.title=e.target.value;});
    input.addEventListener("keydown",(e)=>{if(e.key==="Enter"){e.preventDefault();addTask(true);}});
  }
  document.getElementById("add-keep-btn")?.addEventListener("click",()=>addTask(true));
  document.getElementById("add-close-btn")?.addEventListener("click",()=>addTask(false));

  // Edit sheet bindings.
  const editInput = document.getElementById("edit-task-input");
  if(editInput){
    editInput.addEventListener("input",(e)=>{state.editingDraft.title=e.target.value;});
    editInput.addEventListener("keydown",(e)=>{
      if(e.key==="Enter"){ e.preventDefault(); saveEditedTask(); }
      if(e.key==="Escape"){ e.preventDefault(); cancelEdit(); }
    });
  }
  document.getElementById("edit-category-select")?.addEventListener("change",(e)=>{state.editingDraft.category=e.target.value;});
  document.querySelectorAll("[data-edit-timeframe]").forEach((btn)=>btn.onclick=()=>{
    state.editingDraft.timeframe = btn.dataset.editTimeframe;
    render();
    setTimeout(()=>document.getElementById("edit-task-input")?.focus(),10);
  });
  document.getElementById("save-edit-btn")?.addEventListener("click",saveEditedTask);
  document.getElementById("cancel-edit-btn")?.addEventListener("click",cancelEdit);
  const editSheet = document.getElementById("edit-sheet");
  if(editSheet){ editSheet.addEventListener("click",(e)=>{ if(e.target.id==="edit-sheet") cancelEdit(); }); }

  // Undo snackbar binding.
  document.getElementById("undo-btn")?.addEventListener("click", performUndo);

  // Dark mode toggle binding.
  document.getElementById("toggle-dark-btn")?.addEventListener("click",()=>{
    prefs.darkMode = !prefs.darkMode;
    savePrefs();
    render();
  });

  // New-category input: support Enter to add quickly.
  document.getElementById("new-category-input")?.addEventListener("keydown",(e)=>{
    if(e.key==="Enter"){ e.preventDefault(); addCategory(e.target.value); }
  });
}

// Active swipe drag, shared across renders. Window listeners are attached once below.
let activeSwipe = null;

function attachSwipes(){
  document.querySelectorAll(".task-wrap").forEach((wrap)=>{
    const card = wrap.querySelector(".task-card");
    const id = Number(wrap.dataset.task);

    const start = (x) => {
      activeSwipe = { card, id, startX: x, currentX: 0 };
      card.style.transition="none";
    };
    const cardMove = (x) => {
      if(!activeSwipe || activeSwipe.card !== card) return;
      activeSwipe.currentX = x - activeSwipe.startX;
      const limited = Math.max(-120, Math.min(120, activeSwipe.currentX));
      card.style.transform = `translateX(${limited}px)`;
    };
    const cardEnd = () => {
      if(!activeSwipe || activeSwipe.card !== card) return;
      const { currentX } = activeSwipe;
      card.style.transition="transform .18s ease";
      activeSwipe = null;
      if(currentX <= -90){ deleteTask(id); return; }
      if(currentX >= 90){ toggleTask(id); return; }
      card.style.transform="translateX(0)";
    };

    card.addEventListener("touchstart",(e)=>start(e.touches[0].clientX),{passive:true});
    card.addEventListener("touchmove",(e)=>cardMove(e.touches[0].clientX),{passive:true});
    card.addEventListener("touchend",cardEnd);
    card.addEventListener("mousedown",(e)=>start(e.clientX));
  });
}

// Attach window-level mouse listeners ONCE, not per render.
window.addEventListener("mousemove",(e)=>{
  if(!activeSwipe) return;
  activeSwipe.currentX = e.clientX - activeSwipe.startX;
  const limited = Math.max(-120, Math.min(120, activeSwipe.currentX));
  activeSwipe.card.style.transform = `translateX(${limited}px)`;
});
window.addEventListener("mouseup",()=>{
  if(!activeSwipe) return;
  const { card, id, currentX } = activeSwipe;
  card.style.transition="transform .18s ease";
  activeSwipe = null;
  if(currentX <= -90){ deleteTask(id); return; }
  if(currentX >= 90){ toggleTask(id); return; }
  card.style.transform="translateX(0)";
});

// Global keyboard shortcuts (desktop). Ignored when typing in inputs.
window.addEventListener("keydown", (e) => {
  const tag = (e.target && e.target.tagName) || "";
  const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
  // Esc always closes any open sheet, even from inside an input.
  if(e.key === "Escape"){
    if(state.editingTaskId != null){ cancelEdit(); return; }
    if(state.showComposer){ state.showComposer = false; render(); return; }
    if(state.showInstallHelp){ state.showInstallHelp = false; render(); return; }
  }
  if(typing) return;
  if(e.key === "n" || e.key === "N"){
    e.preventDefault();
    state.showComposer = true;
    state.draft.category = prefs.categories.includes(state.activeTab) ? state.activeTab : (prefs.categories[0] || "Work");
    render();
    setTimeout(()=>document.getElementById("task-input")?.focus(), 10);
  }
  if(e.key === "/"){
    const search = document.getElementById("search-input");
    if(search){ e.preventDefault(); search.focus(); }
  }
});

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>{navigator.serviceWorker.register("./sw.js").catch(()=>{});});
}

applyTheme();
refreshRollovers();
saveTasks();
savePrefs();
render();
