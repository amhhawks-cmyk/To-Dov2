
const TASK_KEY = "my-lists-tasks-v5";
const PREFS_KEY = "my-lists-prefs-v5";

const defaultPrefs = {
  accent: "#7c3aed",
  accent2: "#c084fc",
  categories: ["Work", "Finance", "Personal", "Shopping List"],
  dailyReminderEnabled: false,
  dailyReminderTime: "09:00",
  notificationsPermissionAsked: false
};

const accentPresets = [
  ["#7c3aed","#c084fc"],
  ["#0f766e","#2dd4bf"],
  ["#2563eb","#60a5fa"],
  ["#db2777","#f472b6"],
  ["#ea580c","#fdba74"],
  ["#111827","#475569"]
];

const sectionsBase = [
  { name: "Home", icon: "⌂", short: "Home" },
  { name: "Settings", icon: "⚙", short: "Settings" }
];

const timeframeOptions = ["All", "Today", "This Week", "This Month"];

const initialTasks = [
  { id: 1, title: "Reply to team emails", section: "Work", timeframe: "Today", done: false },
  { id: 2, title: "Review monthly budget", section: "Finance", timeframe: "This Month", done: false },
  { id: 3, title: "Call mom", section: "Personal", timeframe: "This Week", done: false },
  { id: 4, title: "Eggs", section: "Shopping List", timeframe: "Today", done: true },
];

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
    ...prefs.categories.map((name) => ({ name, icon: "•", short: name.length > 6 ? name.slice(0,6) : name })),
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
    const base = saved ? JSON.parse(saved) : initialTasks;
    return base.map((task)=>normalizeTask(task));
  }catch{
    return initialTasks.map((task)=>normalizeTask(task));
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
  showCategoryManager: false,
  draft: { title: "", timeframe: "Today", category: prefs.categories[0] || "Work" },
  reminderLastShownKey: null
};

function saveTasks(){
  try{ localStorage.setItem(TASK_KEY, JSON.stringify(state.tasks)); }catch(e){ console.log("task save failed", e); }
}
function savePrefs(){
  try{ localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); }catch(e){ console.log("prefs save failed", e); }
}
function applyTheme(){
  document.documentElement.style.setProperty("--accent", prefs.accent);
  document.documentElement.style.setProperty("--accent-2", prefs.accent2);
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute("content", prefs.accent);
}

function refreshRollovers(){
  const normalized = state.tasks.map((task)=>normalizeTask(task));
  if(JSON.stringify(normalized)!==JSON.stringify(state.tasks)){
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
  const hh = String(now.getHours()).padStart(2,"0");
  const mm = String(now.getMinutes()).padStart(2,"0");
  const current = `${hh}:${mm}`;
  const todayKey = getDateKey(now);
  const reminderKey = `${todayKey}-${prefs.dailyReminderTime}`;
  if(current === prefs.dailyReminderTime && state.reminderLastShownKey !== reminderKey){
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
  state.tasks = state.tasks.filter((task) => prefs.categories.includes(task.section) || task.section === "Archived");
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
function toggleTask(id){
  state.tasks = state.tasks.map((task)=>task.id===id?{...task,done:!task.done}:task);
  saveTasks();
  render();
}
function deleteTask(id){
  state.tasks = state.tasks.filter((task)=>task.id!==id);
  saveTasks();
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
function getTodayTasks(){
  return state.tasks.filter((task)=>!task.done && task.timeframe==="Today").sort((a,b)=>a.section.localeCompare(b.section));
}
function getVisibleTasks(){
  if(state.activeTab === "Home" || state.activeTab === "Settings") return [];
  const order = {"Today":0,"This Week":1,"This Month":2};
  return state.tasks
    .filter((task)=>task.section===state.activeTab)
    .filter((task)=>task.title.toLowerCase().includes(state.query.toLowerCase()))
    .filter((task)=>state.selectedSort==="All" || task.timeframe===state.selectedSort)
    .sort((a,b)=>order[a.timeframe]-order[b.timeframe] || Number(a.done)-Number(b.done));
}
function escapeHtml(text){
  return String(text).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}
function taskCard(task, showSection=false){
  return `<div class="task-wrap" data-task="${task.id}">
    <div class="swipe-bg left">Delete</div>
    <div class="swipe-bg right">Done</div>
    <div class="task-card" draggable="false">
      <div class="task-top">
        <button class="check-btn ${task.done?"done":""}" data-action="toggle" data-id="${task.id}">${task.done?"✓":""}</button>
        <div class="task-text">
          <div class="task-title ${task.done?"done":""}">${escapeHtml(task.title)}</div>
          ${showSection?`<div class="task-meta">${escapeHtml(task.section)}</div>`:""}
        </div>
        <button class="delete-btn" data-action="delete" data-id="${task.id}">✕</button>
      </div>
      <div class="task-footer">
        <span class="pill ${pillClass(task.timeframe)}">${task.timeframe}</span>
        <span class="hint">Swipe right to complete · left to delete</span>
      </div>
    </div>
  </div>`;
}

function renderHome(){
  const todayTasks = getTodayTasks();
  const cards = getSectionCards();
  return `<div class="header">
    <div class="header-row">
      <div>
        <div class="eyebrow">Simple daily organizer</div>
        <h1>Today</h1>
        <p class="sub">A cleaner daily view with categories, color themes, and local reminders.</p>
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
      ${cards.map((card)=>`<button class="shortcut-btn" data-open-section="${card.name}"><span>${card.name}</span><span class="muted">${card.open} open</span></button>`).join("")}
    </div>
  </div>`;
}

function renderSection(){
  const tasks = getVisibleTasks();
  return `<div class="header">
    <div class="header-row">
      <div style="display:flex;gap:8px"><button class="icon-btn" id="home-back-btn">←</button></div>
      <div style="flex:1">
        <div class="eyebrow">Category</div>
        <h1>${escapeHtml(state.activeTab)}</h1>
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
          ${accentPresets.map(([a,b], idx)=>`<button class="setting-swatch ${(prefs.accent===a && prefs.accent2===b)?"active":""}" data-accent="${a}" data-accent2="${b}" style="background:linear-gradient(135deg,${a},${b})"></button>`).join("")}
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
        <div class="note" style="margin-top:10px">This uses the browser notification permission and checks locally while the app is open. It will not behave like a true server push notification.</div>
      </div>
    </div>
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

  app.innerHTML = `<div class="app-shell"><div class="phone">${mainView}</div>${renderNav()}${renderComposer()}${renderInstallHelp()}</div>`;
  bindEvents();
  attachSwipes();
}

function bindEvents(){
  document.querySelectorAll("[data-tab]").forEach((btn)=>btn.onclick=()=>setTab(btn.dataset.tab));
  document.querySelectorAll("[data-open-section]").forEach((btn)=>btn.onclick=()=>setTab(btn.dataset.openSection));
  document.querySelectorAll("[data-action='toggle']").forEach((btn)=>btn.onclick=(e)=>{e.stopPropagation();toggleTask(Number(btn.dataset.id));});
  document.querySelectorAll("[data-action='delete']").forEach((btn)=>btn.onclick=(e)=>{e.stopPropagation();deleteTask(Number(btn.dataset.id));});
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
  document.getElementById("reminder-time-input")?.addEventListener("change",(e)=>{
    prefs.dailyReminderTime = e.target.value;
    savePrefs();
  });
  document.getElementById("add-category-btn")?.addEventListener("click",()=>{
    const input = document.getElementById("new-category-input");
    if(input) addCategory(input.value);
  });

  const search = document.getElementById("search-input");
  if(search) search.addEventListener("input",(e)=>{state.query=e.target.value;});

  const composer = document.getElementById("composer-sheet");
  if(composer){
    composer.addEventListener("click",(e)=>{if(e.target.id==="composer-sheet"){state.showComposer=false;render();}});
  }
  const install = document.getElementById("install-sheet");
  if(install){
    install.addEventListener("click",(e)=>{if(e.target.id==="install-sheet"){state.showInstallHelp=false;render();}});
  }

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
}

function attachSwipes(){
  document.querySelectorAll(".task-wrap").forEach((wrap)=>{
    const card = wrap.querySelector(".task-card");
    const id = Number(wrap.dataset.task);
    let startX = 0, currentX = 0, dragging = false;

    const start = (x) => { dragging=true; startX=x; currentX=0; card.style.transition="none"; };
    const move = (x) => {
      if(!dragging) return;
      currentX = x - startX;
      const limited = Math.max(-120, Math.min(120, currentX));
      card.style.transform = `translateX(${limited}px)`;
    };
    const end = () => {
      if(!dragging) return;
      dragging=false;
      card.style.transition="transform .18s ease";
      if(currentX <= -90){ deleteTask(id); return; }
      if(currentX >= 90){ toggleTask(id); return; }
      card.style.transform="translateX(0)";
    };

    card.addEventListener("touchstart",(e)=>start(e.touches[0].clientX),{passive:true});
    card.addEventListener("touchmove",(e)=>move(e.touches[0].clientX),{passive:true});
    card.addEventListener("touchend",end);
    card.addEventListener("mousedown",(e)=>start(e.clientX));
    window.addEventListener("mousemove",(e)=>move(e.clientX));
    window.addEventListener("mouseup",end);
  });
}

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>{navigator.serviceWorker.register("./sw.js").catch(()=>{});});
}

applyTheme();
refreshRollovers();
saveTasks();
savePrefs();
render();
