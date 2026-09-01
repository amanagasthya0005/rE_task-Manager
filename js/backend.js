/*
  Supabase adapter.
  The UI keeps a local cache for fast rendering, while Supabase becomes the
  shared source of truth once configured.
*/
const BackendSync = (() => {
  let client = null;
  let configured = false;
  let pulling = false;
  let suppressPush = false;
  let realtimeChannel = null;
  let pushTimer = null;
  let lastPushError = null;

  function init() {
    const cfg = window.RE_CONFIG || {};
    configured = Boolean(
      window.supabase &&
      cfg.SUPABASE_URL &&
      cfg.SUPABASE_PUBLISHABLE_KEY &&
      !cfg.SUPABASE_URL.startsWith("YOUR_") &&
      !cfg.SUPABASE_PUBLISHABLE_KEY.startsWith("YOUR_")
    );
    if (!configured) return false;
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
    });
    return true;
  }

  function isConfigured() { return configured; }
  function getClient() { return client; }

  async function signInEditor(password) {
    if (!configured) return { ok: false, error: "Backend is not configured." };
    const email = window.RE_CONFIG.EDITOR_AUTH_EMAIL;
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    return error ? { ok: false, error: error.message } : { ok: Boolean(data?.session), user: data?.user };
  }

  async function signOut() {
    if (configured) await client.auth.signOut();
  }

  async function pullAll() {
    if (!configured || pulling) return false;
    pulling = true;
    try {
      const [tasks, team, activity, comments] = await Promise.all([
        client.from("tasks").select("*").order("updated_at", { ascending: false }),
        client.from("team_members").select("*").order("created_at", { ascending: true }),
        client.from("activity").select("*").order("created_at", { ascending: false }).limit(200),
        client.from("comments").select("*").order("created_at", { ascending: false })
      ]);
      if (tasks.error || team.error || activity.error || comments.error) {
        console.warn("Supabase read error:", tasks.error || team.error || activity.error || comments.error);
        return false;
      }
      suppressPush = true;
      saveTasks((tasks.data || []).map(rowToTask));
      saveTeam((team.data || []).map(rowToMember));
      saveActivity((activity.data || []).map(rowToActivity));
      const grouped = {};
      (comments.data || []).forEach(row => {
        grouped[row.task_id] ||= [];
        grouped[row.task_id].push(rowToComment(row));
      });
      saveComments(grouped);
      return true;
    } finally {
      suppressPush = false;
      pulling = false;
    }
  }

  function requestPush() {
    if (!configured || suppressPush || !window.session?.isEditor?.()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => pushAll(), 180);
  }

  async function pushAll() {
    if (!configured || suppressPush || !window.session?.isEditor?.()) return {ok:false,error:new Error("Not authorized")};
    try {
      const tasks = getTasks().map(taskToRow), team = getTeam().map(memberToRow), activity = getActivity().map(activityToRow);
      const comments = Object.entries(getComments()).flatMap(([taskId,list])=>list.map(c=>commentToRow(c,taskId)));
      const results = await Promise.all([
        client.from("tasks").upsert(tasks,{onConflict:"id"}),
        client.from("team_members").upsert(team,{onConflict:"id"}),
        client.from("activity").upsert(activity,{onConflict:"id"}),
        client.from("comments").upsert(comments,{onConflict:"id"})
      ]);
      const err=results.find(x=>x.error)?.error;if(err)throw err;
      const [rt,rm,ra,rc]=await Promise.all([client.from("tasks").select("id"),client.from("team_members").select("id"),client.from("activity").select("id"),client.from("comments").select("id")]);
      const readErr=[rt,rm,ra,rc].find(x=>x.error)?.error;if(readErr)throw readErr;
      const reconcile=async(table,rows,keep)=>{const stale=(rows||[]).map(x=>x.id).filter(id=>!keep.has(id));if(!stale.length)return;const r=await client.from(table).delete().in("id",stale);if(r.error)throw r.error};
      await reconcile("tasks",rt.data,new Set(tasks.map(x=>x.id)));
      await reconcile("team_members",rm.data,new Set(team.map(x=>x.id)));
      await reconcile("activity",ra.data,new Set(activity.map(x=>x.id)));
      await reconcile("comments",rc.data,new Set(comments.map(x=>x.id)));
      lastPushError=null;return {ok:true};
    } catch(error){lastPushError=error;console.error("Supabase sync error:",error);return {ok:false,error};}
  }

  async function subscribe() {
    if (!configured || realtimeChannel) return;
    realtimeChannel = client.channel("re-task-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => pullAll().then(() => window.renderAll?.()))
      .on("postgres_changes", { event: "*", schema: "public", table: "team_members" }, () => pullAll().then(() => window.renderAll?.()))
      .on("postgres_changes", { event: "*", schema: "public", table: "activity" }, () => pullAll().then(() => window.renderAll?.()))
      .on("postgres_changes", { event: "*", schema: "public", table: "comments" }, () => pullAll().then(() => window.renderAll?.()))
      .subscribe();
  }

  async function bootstrap() {
    if (!configured) return { connected: false };
    await pullAll();
    await subscribe();
    return { connected: true };
  }

  function rowToTask(r) {
    return {
      id:r.id,title:r.title,description:r.description||"",assigneeId:r.assignee_id,status:r.status,
      priority:r.priority,dueDate:r.due_date||"",labels:r.labels||[],createdAt:r.created_at,
      updatedAt:r.updated_at,history:r.history||[]
    };
  }
  function taskToRow(t) {
    return {id:t.id,title:t.title,description:t.description||"",assignee_id:t.assigneeId||null,status:t.status,
      priority:t.priority,due_date:t.dueDate||null,labels:t.labels||[],history:t.history||[],
      created_at:t.createdAt||new Date().toISOString(),updated_at:t.updatedAt||new Date().toISOString()};
  }
  function rowToMember(r){return{id:r.id,name:r.name,role:r.role||"Team member"}}
  function memberToRow(m){return{id:m.id,name:m.name,role:m.role||"Team member",created_at:m.createdAt||new Date().toISOString()}}
  function rowToActivity(r){return{id:r.id,type:r.type,message:r.message,meta:r.meta||{},timestamp:r.created_at}}
  function activityToRow(a){return{id:a.id,type:a.type,message:a.message,meta:a.meta||{},created_at:a.timestamp||new Date().toISOString()}}
  function rowToComment(r){return{id:r.id,author:r.author,text:r.text,timestamp:r.created_at}}
  function commentToRow(c,taskId){return{id:c.id,task_id:taskId,author:c.author,text:c.text,created_at:c.timestamp||new Date().toISOString()}}

  return { init, isConfigured, getClient, signInEditor, signOut, pullAll, pushAll, requestPush, subscribe, bootstrap, isSuppressing:()=>suppressPush, getLastPushError:()=>lastPushError };
})();

window.BackendSync = BackendSync;
