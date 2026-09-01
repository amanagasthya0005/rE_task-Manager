function makeMemberId(){return"member-"+Date.now()+"-"+Math.random().toString(36).slice(2,7)}
function addMember(name,role){const t=getTeam(),m={id:makeMemberId(),name:name.trim(),role:role.trim()||"Team member"};t.push(m);saveTeam(t);addActivity("team",`${m.name} was added to the team`,{memberId:m.id});return m}
function removeMember(id){const t=getTeam();if(t.length<=1)return{success:false,reason:"last"};const m=getMember(id);if(getTasks().some(x=>x.assigneeId===id))return{success:false,reason:"assigned"};saveTeam(t.filter(x=>x.id!==id));window.BackendSync?.pushAll();addActivity("team",`${m?.name||"Team member"} was removed from the team`,{memberId:id});return{success:true}}
function getMember(id){return getTeam().find(m=>m.id===id)}
function initials(n){return n.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()}
