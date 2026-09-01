const STATUS_COLUMNS=[{id:"backlog",label:"BACKLOG"},{id:"todo",label:"TODO"},{id:"in-progress",label:"IN PROGRESS"},{id:"in-review",label:"IN REVIEW"},{id:"done",label:"DONE"}],PRIORITY_ORDER={urgent:4,high:3,medium:2,low:1};
function makeTaskId(){return"task-"+Date.now()+"-"+Math.random().toString(36).slice(2,7)}
function getTaskById(id){return getTasks().find(t=>t.id===id)}
function upsertTask(t){t.updatedAt=new Date().toISOString();TaskRepository.update(t)}
function removeTask(id){TaskRepository.remove(id)}
function moveTask(id,status){const t=getTaskById(id);if(!t||t.status===status)return false;const old=t.status;t.status=status;addTaskHistory(t,"Status changed",`${getStatusLabel(old)} → ${getStatusLabel(status)}`);upsertTask(t);addActivity("status",`"${t.title}" moved to ${getStatusLabel(status)}`,{taskId:id,from:old,to:status});return true}
function getStatusLabel(s){return STATUS_COLUMNS.find(c=>c.id===s)?.label||s}
function formatDueDate(s){if(!s)return"No due date";return new Date(s+"T00:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short"})}
function dueState(s,status){if(!s||status==="done")return"";const d=new Date();d.setHours(0,0,0,0);const diff=Math.round((new Date(s+"T00:00:00")-d)/86400000);return diff<0?"overdue":diff<=3?"soon":""}
function compareTasks(a,b,mode){if(mode==="priority")return(PRIORITY_ORDER[b.priority]||0)-(PRIORITY_ORDER[a.priority]||0);if(mode==="due")return(a.dueDate||"9999").localeCompare(b.dueDate||"9999");if(mode==="updated")return new Date(b.updatedAt||0)-new Date(a.updatedAt||0);return 0}
