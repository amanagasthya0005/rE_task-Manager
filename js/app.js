document.addEventListener("DOMContentLoaded", () => {
  BackendSync.init();
  cacheElements();window.renderAll=renderAll;

  if (!localStorage.getItem(STORAGE_KEYS.tasks)) saveTasks(DEFAULT_TASKS);
  if (!localStorage.getItem(STORAGE_KEYS.team)) saveTeam(DEFAULT_TEAM);
  if (!localStorage.getItem(STORAGE_KEYS.activity)) saveActivity([]);
  if (!localStorage.getItem(STORAGE_KEYS.comments)) saveComments({});

  window.renderAll = renderAll;

  document.querySelectorAll("[data-role]").forEach(button => {
    button.addEventListener("click", () => {
      if (button.dataset.role === "guest") showWorkspace("guest");
      else showEditorLogin();
    });
  });

  els["back-to-roles"].onclick = showRoleChoice;
  els["editor-login-form"].onsubmit = async event => {
    event.preventDefault();
    els["login-error"].textContent = "Signing in...";
    const result = await authenticateEditor(els.username.value.trim(), els.password.value);
    if (result.ok) {
      await showWorkspace("editor");
    } else {
      els["login-error"].textContent = result.error || "Incorrect username or password.";
      els.password.select();
    }
  };

  els["logout-button"].onclick = logout;
  els["add-task-button"].onclick = () => openTaskModal();
  els["my-work-add"].onclick = () => openTaskModal();
  els["backlog-add"].onclick = () => openTaskModal();
  els["team-manage-button"].onclick = openTeamModal;
  els["activity-button"].onclick = () => setView("activity");
  els["theme-toggle"].onclick = toggleTheme;
  els["filter-button"].onclick = () => els["filter-panel"].classList.toggle("hidden");

  els["search-input"].oninput = event => { state.search = event.target.value; renderBoard(); };
  els["assignee-filter"].onchange = event => { state.assignee = event.target.value; renderBoard(); };
  els["priority-filter"].onchange = event => { state.priority = event.target.value; renderBoard(); };
  els["status-filter"].onchange = event => { state.status = event.target.value; renderBoard(); };
  els["sort-filter"].onchange = event => { state.sort = event.target.value; renderBoard(); };
  els["clear-filters"].onclick = () => {
    state.search = ""; state.assignee = state.priority = state.status = "all"; state.sort = "default";
    els["search-input"].value = "";
    els["assignee-filter"].value = els["priority-filter"].value = els["status-filter"].value = "all";
    els["sort-filter"].value = "default";
    renderBoard();
  };

  els["task-form"].onsubmit = saveTaskFromForm;
  els["delete-task-button"].onclick = deleteCurrentTask;
  els["team-form"].onsubmit = saveMember;
  els["comment-form"].onsubmit = addCommentFromForm;
  els["detail-edit-button"].onclick = () => {
    const id = els["detail-edit-button"].dataset.id;
    closeModals();
    openTaskModal(id);
  };
  els["export-button"].onclick = exportData;
  els["import-file"].onchange = event => importData(event.target.files[0]);

  document.querySelectorAll("[data-view]").forEach(node => node.onclick = () => setView(node.dataset.view));
  document.querySelectorAll(".close-modal,.close-team-modal,.close-detail-modal,.close-activity-modal")
    .forEach(button => button.onclick = closeModals);
  document.querySelectorAll(".modal-backdrop").forEach(modal => {
    modal.onclick = event => { if (event.target === modal) closeModals(); };
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeModals();
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && !els.workspace.classList.contains("hidden")) {
      event.preventDefault(); els["search-input"].focus();
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n" && session.isEditor()) {
      event.preventDefault(); openTaskModal();
    }
  });
});
