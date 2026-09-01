const STORAGE_KEYS={tasks:"re_task_tasks_v3",team:"re_task_team_v3",activity:"re_task_activity_v3",comments:"re_task_comments_v3",preferences:"re_task_preferences_v3"};
const DEFAULT_TEAM=[{id:"member-aman",name:"Aman",role:"Category & Strategy"},{id:"member-neha",name:"Neha",role:"Brand"},{id:"member-rohan",name:"Rohan",role:"Performance"},{id:"member-simran",name:"Simran",role:"Creative"}];
const DEFAULT_TASKS=[
{id:"task-1",title:"Map competitor massage gun range",description:"Document competitor products, positioning and price architecture.",assigneeId:"member-aman",status:"in-progress",priority:"high",dueDate:"2026-09-05",labels:["Research","Competitor"],createdAt:"2026-09-01T08:00:00.000Z",updatedAt:"2026-09-01T08:00:00.000Z",history:[]},
{id:"task-2",title:"Build recovery education content buckets",description:"Define problem-agitation, educational and symptom-led content themes.",assigneeId:"member-neha",status:"todo",priority:"medium",dueDate:"2026-09-07",labels:["Content","Education"],createdAt:"2026-09-01T08:30:00.000Z",updatedAt:"2026-09-01T08:30:00.000Z",history:[]},
{id:"task-3",title:"Review performance creative hooks",description:"Shortlist high-intent hooks for aware and unaware audiences.",assigneeId:"member-simran",status:"in-review",priority:"high",dueDate:"2026-09-03",labels:["Creative","Performance"],createdAt:"2026-09-01T09:00:00.000Z",updatedAt:"2026-09-01T09:00:00.000Z",history:[]},
{id:"task-4",title:"Finalize recovery product comparison sheet",description:"Complete the competitor manufacturer and comparison-product framework.",assigneeId:"member-rohan",status:"backlog",priority:"low",dueDate:"2026-09-12",labels:["Research"],createdAt:"2026-09-01T09:30:00.000Z",updatedAt:"2026-09-01T09:30:00.000Z",history:[]},
{id:"task-5",title:"Define 10-minute reset proposition",description:"Translate the core proposition into clear consumer-facing language.",assigneeId:"member-aman",status:"done",priority:"urgent",dueDate:"2026-08-30",labels:["Strategy","Brand"],createdAt:"2026-08-31T10:00:00.000Z",updatedAt:"2026-09-01T07:00:00.000Z",history:[]}
];
function loadJSON(k,f){try{const v=localStorage.getItem(k);return v?JSON.parse(v):f}catch{return f}}
function saveJSON(k,v){
  localStorage.setItem(k,JSON.stringify(v));
  if(k!==STORAGE_KEYS.preferences && window.BackendSync?.requestPush) BackendSync.requestPush();
}
function getTasks(){return loadJSON(STORAGE_KEYS.tasks,DEFAULT_TASKS)}
function saveTasks(v){saveJSON(STORAGE_KEYS.tasks,v)}
function getTeam(){return loadJSON(STORAGE_KEYS.team,DEFAULT_TEAM)}
function saveTeam(v){saveJSON(STORAGE_KEYS.team,v)}
function getActivity(){return loadJSON(STORAGE_KEYS.activity,[])}
function saveActivity(v){saveJSON(STORAGE_KEYS.activity,v.slice(0,200))}
function getComments(){return loadJSON(STORAGE_KEYS.comments,{})}
function saveComments(v){saveJSON(STORAGE_KEYS.comments,v)}
function getPreferences(){return loadJSON(STORAGE_KEYS.preferences,{theme:"light"})}
function savePreferences(v){saveJSON(STORAGE_KEYS.preferences,v)}
function addActivity(type,message,meta={}){const a=getActivity();a.unshift({id:"activity-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),type,message,meta,timestamp:new Date().toISOString()});saveActivity(a);window.BackendSync?.pushAll()}
function addTaskHistory(task,action,details=""){task.history=Array.isArray(task.history)?task.history:[];task.history.unshift({action,details,timestamp:new Date().toISOString()})}
function addComment(taskId,author,text){const c=getComments();c[taskId]=c[taskId]||[];c[taskId].unshift({id:"comment-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),author,text:text.trim(),timestamp:new Date().toISOString()});saveComments(c);window.BackendSync?.pushAll()}
function resetDemoData(){Object.values(STORAGE_KEYS).forEach(k=>localStorage.removeItem(k));saveTasks(DEFAULT_TASKS);saveTeam(DEFAULT_TEAM);saveActivity([]);saveComments({});savePreferences({theme:"light"})}
const TaskRepository={
 list:getTasks,save:saveTasks,
 add:t=>{const x=getTasks();x.push(t);saveTasks(x);window.BackendSync?.pushAll();return t},
 update:t=>{const x=getTasks(),i=x.findIndex(v=>v.id===t.id);if(i>=0)x[i]=t;else x.push(t);saveTasks(x);window.BackendSync?.pushAll();return t},
 remove:id=>{saveTasks(getTasks().filter(t=>t.id!==id));window.BackendSync?.pushAll()}
};
