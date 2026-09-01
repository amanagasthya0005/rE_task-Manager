/*
  rE Task Manager — Supabase Backend Adapter

  Supabase is the shared source of truth.
  localStorage remains only as a local cache/fallback.

  IMPORTANT:
  - Supabase Auth controls whether an editor is authenticated.
  - Supabase RLS controls whether that authenticated user can write.
  - We do NOT perform a separate frontend email authorization check.
*/

const BackendSync = (() => {
  let client = null;
  let configured = false;
  let pulling = false;
  let suppressPush = false;
  let realtimeChannel = null;
  let pushTimer = null;
  let lastPushError = null;

  // ------------------------------------------------------------
  // INITIALIZATION
  // ------------------------------------------------------------

  function init() {
    const cfg = window.RE_CONFIG || {};

    configured = Boolean(
      window.supabase &&
      cfg.SUPABASE_URL &&
      cfg.SUPABASE_PUBLISHABLE_KEY &&
      !cfg.SUPABASE_URL.startsWith("YOUR_") &&
      !cfg.SUPABASE_PUBLISHABLE_KEY.startsWith("YOUR_")
    );

    if (!configured) {
      console.warn("Supabase is not configured. Running in local mode.");
      return false;
    }

    client = window.supabase.createClient(
      cfg.SUPABASE_URL,
      cfg.SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true
        }
      }
    );

    console.log("Supabase client initialized.");

    return true;
  }

  function isConfigured() {
    return configured;
  }

  function getClient() {
    return client;
  }

  // ------------------------------------------------------------
  // AUTHENTICATION
  // ------------------------------------------------------------

  async function signInEditor(password) {
    if (!configured) {
      return {
        ok: false,
        error: "Backend is not configured."
      };
    }

    try {
      const email = window.RE_CONFIG.EDITOR_AUTH_EMAIL;

      const { data, error } = await client.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error("Supabase login error:", error);

        return {
          ok: false,
          error: error.message
        };
      }

      if (!data?.session) {
        return {
          ok: false,
          error: "Supabase did not create an authenticated session."
        };
      }

      console.log("Editor authenticated with Supabase.");

      return {
        ok: true,
        user: data.user,
        session: data.session
      };

    } catch (error) {
      console.error("Editor authentication failed:", error);

      return {
        ok: false,
        error: error?.message || "Authentication failed."
      };
    }
  }

  async function signOut() {
    if (!configured || !client) {
      return;
    }

    try {
      await client.auth.signOut();
    } catch (error) {
      console.warn("Supabase sign-out error:", error);
    }
  }

  async function getAuthSession() {
    if (!configured || !client) {
      return null;
    }

    try {
      const {
        data,
        error
      } = await client.auth.getSession();

      if (error) {
        console.error("Could not retrieve Supabase session:", error);
        return null;
      }

      return data?.session || null;

    } catch (error) {
      console.error("Session lookup failed:", error);
      return null;
    }
  }

  // ------------------------------------------------------------
  // PULL DATA FROM SUPABASE
  // ------------------------------------------------------------

  async function pullAll() {
    if (!configured || !client || pulling) {
      return false;
    }

    pulling = true;

    try {
      const [
        tasksResult,
        teamResult,
        activityResult,
        commentsResult
      ] = await Promise.all([
        client
          .from("tasks")
          .select("*")
          .order("updated_at", { ascending: false }),

        client
          .from("team_members")
          .select("*")
          .order("created_at", { ascending: true }),

        client
          .from("activity")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200),

        client
          .from("comments")
          .select("*")
          .order("created_at", { ascending: false })
      ]);

      const errors = [
        tasksResult.error,
        teamResult.error,
        activityResult.error,
        commentsResult.error
      ].filter(Boolean);

      if (errors.length) {
        console.error("Supabase read error:", errors);

        lastPushError = errors[0];

        return false;
      }

      /*
        Prevent the local storage listeners from immediately trying
        to push the downloaded Supabase data back to Supabase.
      */
      suppressPush = true;

      saveTasks(
        (tasksResult.data || []).map(rowToTask)
      );

      saveTeam(
        (teamResult.data || []).map(rowToMember)
      );

      saveActivity(
        (activityResult.data || []).map(rowToActivity)
      );

      const groupedComments = {};

      (commentsResult.data || []).forEach(row => {
        if (!groupedComments[row.task_id]) {
          groupedComments[row.task_id] = [];
        }

        groupedComments[row.task_id].push(
          rowToComment(row)
        );
      });

      saveComments(groupedComments);

      suppressPush = false;

      return true;

    } catch (error) {
      console.error("Supabase pull failed:", error);

      lastPushError = error;

      return false;

    } finally {
      suppressPush = false;
      pulling = false;
    }
  }

  // ------------------------------------------------------------
  // PUSH REQUEST
  // ------------------------------------------------------------

  function requestPush() {
    if (!configured || suppressPush) {
      return;
    }

    clearTimeout(pushTimer);

    pushTimer = setTimeout(async () => {
      const result = await pushAll();

      if (!result.ok) {
        console.error(
          "Cloud save failed:",
          result.error
        );
      }
    }, 180);
  }

  // ------------------------------------------------------------
  // PUSH DATA TO SUPABASE
  // ------------------------------------------------------------

  async function pushAll() {
    if (!configured || !client) {
      return {
        ok: false,
        error: new Error("Supabase is not configured.")
      };
    }

    if (suppressPush) {
      return {
        ok: false,
        error: new Error("Cloud push temporarily suppressed.")
      };
    }

    try {
      /*
        IMPORTANT:

        We only check whether a real Supabase Auth session exists.

        We deliberately do NOT check the user's email here.

        Supabase Auth + RLS are responsible for authorization.
      */

      const {
        data: sessionData,
        error: sessionError
      } = await client.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      const authSession = sessionData?.session;

      if (!authSession?.user) {
        return {
          ok: false,
          error: new Error(
            "No active Supabase session. Please log in as Editor again."
          )
        };
      }

      console.log(
        "Cloud sync authenticated as:",
        authSession.user.email
      );

      // --------------------------------------------------------
      // CONVERT LOCAL DATA INTO SUPABASE ROWS
      // --------------------------------------------------------

      const tasks = getTasks().map(taskToRow);

      const team = getTeam().map(memberToRow);

      const activity = getActivity().map(activityToRow);

      const comments = Object.entries(
        getComments()
      ).flatMap(([taskId, list]) => {
        return list.map(comment =>
          commentToRow(comment, taskId)
        );
      });

      // --------------------------------------------------------
      // WRITE TO SUPABASE
      // --------------------------------------------------------

      const results = await Promise.all([
        client
          .from("tasks")
          .upsert(tasks, {
            onConflict: "id"
          }),

        client
          .from("team_members")
          .upsert(team, {
            onConflict: "id"
          }),

        client
          .from("activity")
          .upsert(activity, {
            onConflict: "id"
          }),

        client
          .from("comments")
          .upsert(comments, {
            onConflict: "id"
          })
      ]);

      const writeError =
        results.find(result => result.error)?.error;

      if (writeError) {
        throw writeError;
      }

      // --------------------------------------------------------
      // VERIFY THAT SUPABASE ACTUALLY ACCEPTED THE DATA
      // --------------------------------------------------------

      const [
        taskCheck,
        teamCheck,
        activityCheck,
        commentCheck
      ] = await Promise.all([
        client
          .from("tasks")
          .select("id"),

        client
          .from("team_members")
          .select("id"),

        client
          .from("activity")
          .select("id"),

        client
          .from("comments")
          .select("id")
      ]);

      const readBackError = [
        taskCheck.error,
        teamCheck.error,
        activityCheck.error,
        commentCheck.error
      ].find(Boolean);

      if (readBackError) {
        throw readBackError;
      }

      // --------------------------------------------------------
      // RECONCILE DELETIONS
      // --------------------------------------------------------

      await reconcileTable(
        "tasks",
        taskCheck.data,
        new Set(tasks.map(row => row.id))
      );

      await reconcileTable(
        "team_members",
        teamCheck.data,
        new Set(team.map(row => row.id))
      );

      await reconcileTable(
        "activity",
        activityCheck.data,
        new Set(activity.map(row => row.id))
      );

      await reconcileTable(
        "comments",
        commentCheck.data,
        new Set(comments.map(row => row.id))
      );

      lastPushError = null;

      console.log("Cloud sync successful.");

      return {
        ok: true
      };

    } catch (error) {

      lastPushError = error;

      console.error(
        "Supabase sync error:",
        {
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
          status: error?.status
        },
        error
      );

      return {
        ok: false,
        error
      };
    }
  }

  // ------------------------------------------------------------
  // DELETE STALE CLOUD RECORDS
  // ------------------------------------------------------------

  async function reconcileTable(
    table,
    cloudRows,
    localIds
  ) {
    const staleIds = (cloudRows || [])
      .map(row => row.id)
      .filter(id => !localIds.has(id));

    if (!staleIds.length) {
      return;
    }

    const result = await client
      .from(table)
      .delete()
      .in("id", staleIds);

    if (result.error) {
      throw result.error;
    }
  }

  // ------------------------------------------------------------
  // REALTIME
  // ------------------------------------------------------------

  async function subscribe() {
    if (
      !configured ||
      !client ||
      realtimeChannel
    ) {
      return;
    }

    realtimeChannel = client
      .channel("re-task-live")

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks"
        },
        async () => {
          console.log("Realtime: tasks changed.");

          const success = await pullAll();

          if (success) {
            window.renderAll?.();
          }
        }
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "team_members"
        },
        async () => {
          console.log("Realtime: team changed.");

          const success = await pullAll();

          if (success) {
            window.renderAll?.();
          }
        }
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "activity"
        },
        async () => {
          console.log("Realtime: activity changed.");

          const success = await pullAll();

          if (success) {
            window.renderAll?.();
          }
        }
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments"
        },
        async () => {
          console.log("Realtime: comments changed.");

          const success = await pullAll();

          if (success) {
            window.renderAll?.();
          }
        }
      );

    realtimeChannel.subscribe(status => {
      console.log(
        "Supabase Realtime status:",
        status
      );
    });
  }

  // ------------------------------------------------------------
  // BOOTSTRAP
  // ------------------------------------------------------------

  async function bootstrap() {
    if (!configured || !client) {
      return {
        connected: false
      };
    }

    try {
      /*
        Load the persisted Supabase Auth session first.
      */
      await client.auth.getSession();

      /*
        Pull shared data from Supabase.
      */
      await pullAll();

      /*
        Start realtime listeners.
      */
      await subscribe();

      return {
        connected: true
      };

    } catch (error) {
      console.error(
        "Supabase bootstrap failed:",
        error
      );

      return {
        connected: false,
        error
      };
    }
  }

  // ------------------------------------------------------------
  // SUPABASE → LOCAL CONVERTERS
  // ------------------------------------------------------------

  function rowToTask(row) {
    return {
      id: row.id,

      title: row.title,

      description:
        row.description || "",

      assigneeId:
        row.assignee_id || null,

      status:
        row.status,

      priority:
        row.priority,

      dueDate:
        row.due_date || "",

      labels:
        row.labels || [],

      createdAt:
        row.created_at,

      updatedAt:
        row.updated_at,

      history:
        row.history || []
    };
  }

  function rowToMember(row) {
    return {
      id: row.id,

      name: row.name,

      role:
        row.role || "Team member"
    };
  }

  function rowToActivity(row) {
    return {
      id: row.id,

      type: row.type,

      message: row.message,

      meta:
        row.meta || {},

      timestamp:
        row.created_at
    };
  }

  function rowToComment(row) {
    return {
      id: row.id,

      author:
        row.author,

      text:
        row.text,

      timestamp:
        row.created_at
    };
  }

  // ------------------------------------------------------------
  // LOCAL → SUPABASE CONVERTERS
  // ------------------------------------------------------------

  function taskToRow(task) {
    return {
      id:
        task.id,

      title:
        task.title,

      description:
        task.description || "",

      assignee_id:
        task.assigneeId || null,

      status:
        task.status,

      priority:
        task.priority,

      due_date:
        task.dueDate || null,

      labels:
        task.labels || [],

      history:
        task.history || [],

      created_at:
        task.createdAt ||
        new Date().toISOString(),

      updated_at:
        task.updatedAt ||
        new Date().toISOString()
    };
  }

  function memberToRow(member) {
    return {
      id:
        member.id,

      name:
        member.name,

      role:
        member.role ||
        "Team member",

      created_at:
        member.createdAt ||
        new Date().toISOString()
    };
  }

  function activityToRow(activity) {
    return {
      id:
        activity.id,

      type:
        activity.type,

      message:
        activity.message,

      meta:
        activity.meta || {},

      created_at:
        activity.timestamp ||
        new Date().toISOString()
    };
  }

  function commentToRow(comment, taskId) {
    return {
      id:
        comment.id,

      task_id:
        taskId,

      author:
        comment.author,

      text:
        comment.text,

      created_at:
        comment.timestamp ||
        new Date().toISOString()
    };
  }

  // ------------------------------------------------------------
  // PUBLIC API
  // ------------------------------------------------------------

  return {
    init,

    isConfigured,

    getClient,

    signInEditor,

    signOut,

    getAuthSession,

    pullAll,

    pushAll,

    requestPush,

    subscribe,

    bootstrap,

    isSuppressing: () =>
      suppressPush,

    getLastPushError: () =>
      lastPushError
  };
})();

window.BackendSync = BackendSync;
