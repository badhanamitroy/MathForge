(function (window, document) {
  "use strict";

  var AUTOSAVE_ID = "mathforge-autosave";
  var PROJECT_MIME_TYPE = "application/json";
  var TOOL_IDS = ["coordinates-graph", "equation-plotter", "ogive-curve", "histogram-polygon"];
  var currentId = newProjectId();
  var currentName = "Untitled Project";
  var projectStorage = window.MathForgeProjectStorage;
  var saveTimer = null;
  var historyTimer = null;
  var isRestoring = false;
  var allowUnload = false;
  var hasUserInteracted = false;
  var pendingSaveOperations = 0;
  var lifecycleSaveKey = null;
  var saveOperationQueue = Promise.resolve();
  var persistedKey = null;
  var lastHistoryProject = null;
  var lastHistoryKey = null;
  var undoStack = [];
  var redoStack = [];
  var HISTORY_LIMIT = 80;

  function newProjectId() {
    return "project-" + Date.now() + "-" + Math.random().toString(16).slice(2, 8);
  }

  function setNotice(message, isError) {
    var notice = document.getElementById("mfStorageNotice");
    if (notice) {
      notice.textContent = message;
      notice.classList.toggle("mf-storage-error", Boolean(isError));
    }
  }

  function beginSave(status) {
    pendingSaveOperations += 1;
    setNotice(status || "Saving...", false);
  }

  function finishSave(status, isError) {
    pendingSaveOperations = Math.max(0, pendingSaveOperations - 1);
    if (pendingSaveOperations === 0) setNotice(status, isError);
  }

  function enqueueSaveOperation(operation) {
    var result = saveOperationQueue.then(operation);
    saveOperationQueue = result.then(function () {}, function () {});
    return result;
  }

  function openDatabase() {
    if (!projectStorage) return Promise.reject(new Error("Local project storage could not be initialized."));
    return projectStorage.open();
  }

  function captureProject() {
    var workspace = window.MathForgeWorkspace;
    var state = workspace ? workspace.getState() : {};
    return {
      format: "mathforge-project",
      version: 1,
      id: currentId,
      name: currentName,
      updatedAt: new Date().toISOString(),
      activeTool: state.activeTool || null,
      toolStates: workspace ? workspace.getToolStates() : {},
      graphDesignSettings: window.MathForgeGraphDesignSettings ? window.MathForgeGraphDesignSettings.getState() : undefined
    };
  }

  function projectKey(project) {
    return JSON.stringify({
      name: project.name,
      activeTool: project.activeTool,
      toolStates: project.toolStates,
      graphDesignSettings: project.graphDesignSettings || null
    });
  }

  function validateProject(project) {
    if (!project || project.format !== "mathforge-project" || project.version !== 1 ||
        typeof project.name !== "string" || !project.name.trim() || project.name.length > 80 ||
        !project.toolStates || typeof project.toolStates !== "object" || Array.isArray(project.toolStates) ||
        (project.activeTool !== null && TOOL_IDS.indexOf(project.activeTool) === -1)) {
      return false;
    }
    return Object.keys(project.toolStates).every(function (id) {
      return TOOL_IDS.indexOf(id) !== -1 &&
        (project.toolStates[id] === null || typeof project.toolStates[id] === "object");
    });
  }

  function readProject(id) {
    return projectStorage.get(id);
  }

  function listProjects() {
    return projectStorage.getAll().then(function (projects) {
      return projects.filter(function (project) { return project.id !== AUTOSAVE_ID; })
        .sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
    });
  }

  function refreshRecentProjects() {
    var select = document.getElementById("mfRecentProjects");
    if (!select) return Promise.resolve();
    return listProjects().then(function (projects) {
      select.innerHTML = "";
      if (!projects.length) {
        var empty = document.createElement("option");
        empty.value = "";
        empty.textContent = "No saved projects yet";
        select.appendChild(empty);
        return;
      }
      projects.slice(0, 12).forEach(function (project) {
        var option = document.createElement("option");
        option.value = project.id;
        option.textContent = project.name + " — " + new Date(project.updatedAt).toLocaleString();
        select.appendChild(option);
      });
    });
  }

  function updateDirtyUI() {
    var projectLabel = document.getElementById("mfProjectName");
    var dirty = false;
    try {
      dirty = persistedKey !== null && projectKey(captureProject()) !== persistedKey;
    } catch (error) {
      dirty = true;
      console.error("[MathForge] Unable to compare the current project state:", error);
    }
    if (persistedKey === null) dirty = true;
    if (projectLabel) {
      projectLabel.textContent = currentName + (dirty ? " *" : "");
      projectLabel.title = dirty ? "Unsaved changes" : currentName;
      projectLabel.setAttribute("data-dirty", dirty ? "true" : "false");
    }
    var statusDoc = document.getElementById("mfStatusDoc");
    if (statusDoc) statusDoc.textContent = currentName;
    var tabTitle = document.querySelector("#mfDocTabsContainer .mf-tab-title");
    if (tabTitle) tabTitle.textContent = currentName;
    var propertyName = document.getElementById("mfPropDocName");
    if (propertyName) propertyName.textContent = currentName;
    return dirty;
  }

  function updateHistoryUI() {
    var undo = document.getElementById("mfUndoMenuItem");
    var redo = document.getElementById("mfRedoMenuItem");
    if (undo) undo.disabled = undoStack.length === 0;
    if (redo) redo.disabled = redoStack.length === 0;
  }

  function setProjectName(name) {
    currentName = String(name || "Untitled Project").trim().slice(0, 80) || "Untitled Project";
    var label = document.getElementById("mfProjectName");
    var input = document.getElementById("mfSaveAsName");
    if (label) label.textContent = currentName;
    if (input) input.value = currentName;
    updateDirtyUI();
  }

  function closeMenus() {
    Array.prototype.forEach.call(document.querySelectorAll(".mf-menu-root.open"), function (root) {
      root.classList.remove("open");
      var button = root.querySelector("[aria-haspopup='true']");
      if (button) button.setAttribute("aria-expanded", "false");
    });
  }

  function resetHistory() {
    window.clearTimeout(historyTimer);
    undoStack = [];
    redoStack = [];
    lastHistoryProject = captureProject();
    lastHistoryKey = projectKey(lastHistoryProject);
    updateHistoryUI();
  }

  function applyProject(project, options) {
    options = options || {};
    if (!validateProject(project)) throw new Error("This is not a supported MathForge project file.");

    window.clearTimeout(saveTimer);
    window.clearTimeout(historyTimer);
    isRestoring = true;
    try {
      currentId = options.keepId ? currentId : (project.sourceId || project.id || newProjectId());
      if (currentId === AUTOSAVE_ID) currentId = newProjectId();
      setProjectName(project.name);
      if (window.MathForgeGraphDesignSettings) {
        if (project.graphDesignSettings) window.MathForgeGraphDesignSettings.setState(project.graphDesignSettings);
        else window.MathForgeGraphDesignSettings.reset();
      }
      window.MathForgeWorkspace.selectTool(null);
      window.MathForgeWorkspace.resetTools();
      window.MathForgeWorkspace.setToolStates(project.toolStates);
      window.MathForgeWorkspace.selectTool(project.activeTool || null);
    } finally {
      isRestoring = false;
    }

    if (!options.keepDirty) persistedKey = projectKey(captureProject());
    if (!options.keepHistory) resetHistory();
    updateDirtyUI();
  }

  function saveCurrent(showSuccess) {
    if (isRestoring) return Promise.resolve(false);
    if (showSuccess) hasUserInteracted = true;
    beginSave("Saving...");
    return enqueueSaveOperation(function () {
      var project;
      try {
        project = captureProject();
      } catch (error) {
        finishSave("Save failed: the current tool state could not be captured. " + error.message, true);
        throw error;
      }
      var adapter;
      var fileHandle;
      try {
        adapter = fileAdapter();
        fileHandle = adapter && adapter.getCurrentFileHandle();
      } catch (error) {
        finishSave("Save failed: " + error.message, true);
        throw error;
      }
      var fileWrite = showSuccess && fileHandle
        ? Promise.resolve().then(function () { return adapter.writeFile(fileHandle, serializeProject(project)); })
          .then(function () { return null; }, function (error) { return error; })
        : Promise.resolve(null);
      var localWrite = persistLocalProject(project);

      return Promise.all([fileWrite, localWrite]).then(function (results) {
        var fileError = results[0];
        var localError = results[1].error;
        if (fileHandle && showSuccess && !fileError) persistedKey = projectKey(project);
        else if (!fileHandle && !localError) persistedKey = projectKey(project);
        updateDirtyUI();

        if (fileError) {
          finishSave("Save failed: project file write failed. " + fileError.message +
            (localError ? " The browser recovery copy also failed." : " The project was saved locally as a recovery copy."), true);
          throw fileError;
        }
        if (localError) {
          if (fileHandle && showSuccess) {
            finishSave("Project file saved; local recovery save failed: " + localError.message, true);
            return true;
          }
          finishSave("Save failed: " + localError.message + " Use Save File As to download a portable .mathforge project.", true);
          throw localError;
        }
        if (results[1].recentError) {
          finishSave("Saved locally; recent projects could not be refreshed: " + results[1].recentError.message, true);
          return true;
        }
        var status = updateDirtyUI()
          ? "Saved locally. Newer changes are still pending."
          : (showSuccess && fileHandle ? "Saved locally and to project file" : "Saved locally");
        finishSave(status, false);
        return true;
      });
    });
  }

  function scheduleMutation() {
    if (isRestoring || allowUnload) return;
    hasUserInteracted = true;
    updateDirtyUI();
    window.clearTimeout(historyTimer);
    historyTimer = window.setTimeout(recordHistory, 350);
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(function () {
      saveCurrent(false).catch(function () {});
    }, 1400);
  }

  function recordHistory() {
    if (isRestoring) return;
    try {
      var current = captureProject();
      var currentKey = projectKey(current);
      if (currentKey !== lastHistoryKey) {
        undoStack.push(lastHistoryProject);
        if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
        redoStack = [];
        lastHistoryProject = current;
        lastHistoryKey = currentKey;
        updateHistoryUI();
      }
      updateDirtyUI();
    } catch (error) {
      setNotice("History update failed: " + error.message, true);
    }
  }

  function flushHistory() {
    if (historyTimer) {
      window.clearTimeout(historyTimer);
      historyTimer = null;
      recordHistory();
    }
  }

  function restoreHistory(project, otherStack) {
    var current = captureProject();
    otherStack.push(current);
    try {
      applyProject(project, { keepId: true, keepDirty: true, keepHistory: true });
      lastHistoryProject = captureProject();
      lastHistoryKey = projectKey(lastHistoryProject);
      updateHistoryUI();
      updateDirtyUI();
      scheduleMutation();
    } catch (error) {
      otherStack.pop();
      setNotice("History restore failed: " + error.message, true);
    }
  }

  function undo() {
    flushHistory();
    if (!undoStack.length) return;
    restoreHistory(undoStack.pop(), redoStack);
  }

  function redo() {
    flushHistory();
    if (!redoStack.length) return;
    restoreHistory(redoStack.pop(), undoStack);
  }

  function showDialog(options) {
    options = options || {};
    var backdrop = document.getElementById("mfDialogBackdrop");
    var fieldHost = document.getElementById("mfDialogField");
    var cancelButton = document.getElementById("mfDialogCancel");
    var confirmButton = document.getElementById("mfDialogConfirm");
    var title = document.getElementById("mfDialogTitle");
    var message = document.getElementById("mfDialogMessage");
    fieldHost.innerHTML = "";
    title.textContent = options.title || "MathForge";
    message.textContent = options.message || "";
    confirmButton.textContent = options.confirmLabel || "Continue";
    cancelButton.textContent = options.cancelLabel || "Cancel";
    cancelButton.hidden = options.cancelLabel === "";

    var field = null;
    if (options.choices) {
      field = document.createElement("select");
      field.className = "mf-dialog-field";
      options.choices.forEach(function (choice) {
        var option = document.createElement("option");
        option.value = choice.value;
        option.textContent = choice.label;
        field.appendChild(option);
      });
    } else if (options.input) {
      field = document.createElement("input");
      field.type = "text";
      field.maxLength = options.maxLength || 80;
      field.value = options.value || "";
      field.setAttribute("aria-label", options.inputLabel || "Value");
    }
    if (field) {
      fieldHost.className = "mf-dialog-field";
      fieldHost.appendChild(field);
    } else {
      fieldHost.className = "";
    }

    return new Promise(function (resolve) {
      var completed = false;
      var previouslyFocused = document.activeElement;
      function finish(result) {
        if (completed) return;
        completed = true;
        backdrop.hidden = true;
        cancelButton.removeEventListener("click", cancel);
        confirmButton.removeEventListener("click", accept);
        backdrop.removeEventListener("click", backdropClick);
        document.removeEventListener("keydown", keydown);
        if (previouslyFocused && typeof previouslyFocused.focus === "function") previouslyFocused.focus();
        resolve(result);
      }
      function cancel() { finish(null); }
      function accept() { finish(field ? field.value : true); }
      function backdropClick(event) {
        if (event.target === backdrop) cancel();
      }
      function keydown(event) {
        if (event.key === "Escape") {
          event.preventDefault();
          cancel();
        } else if (event.key === "Enter" && field) {
          event.preventDefault();
          accept();
        }
      }
      cancelButton.addEventListener("click", cancel);
      confirmButton.addEventListener("click", accept);
      backdrop.addEventListener("click", backdropClick);
      document.addEventListener("keydown", keydown);
      backdrop.hidden = false;
      (field || confirmButton).focus();
    });
  }

  function confirmDiscard(action, force) {
    var dirty = updateDirtyUI();
    if (!dirty && !force) return Promise.resolve(true);
    return showDialog({
      title: dirty ? "Unsaved changes" : "Open another project",
      message: dirty
        ? "This project has unsaved changes. Continue and discard them to " + action + "?"
        : "Opening another file will replace the current workspace view. The current project remains in Recent Projects. Continue?",
      confirmLabel: dirty ? "Discard changes" : "Open next file",
      cancelLabel: "Keep editing"
    }).then(function (result) { return result !== null; });
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    try {
      link.click();
    } finally {
      link.remove();
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }
  }

  function filenameForProject(extension) {
    return (currentName || "MathForge-Project")
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
      .replace(/[. ]+$/g, "") + "." + extension;
  }

  function downloadProject(project) {
    var blob = new Blob([serializeProject(project)], { type: PROJECT_MIME_TYPE });
    downloadBlob(blob, filenameForName(project.name));
  }

  function serializeProject(project) {
    if (!validateProject(project)) throw new Error("Cannot save an invalid MathForge project.");
    return JSON.stringify(project, null, 2);
  }

  function filenameForName(name) {
    return (String(name || "MathForge-Project").trim() || "MathForge-Project")
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
      .replace(/[. ]+$/g, "") + ".mathforge";
  }

  function fileAdapter() {
    return window.MathForgeProjectFileAdapter || null;
  }

  function writeLocalProject(project) {
    var recovery = Object.assign({}, project, { id: AUTOSAVE_ID, sourceId: project.id });
    return projectStorage.putMany([project, recovery]);
  }

  function persistLocalProject(project) {
    return Promise.resolve().then(function () { return writeLocalProject(project); }).then(function () {
      return refreshRecentProjects().then(function () {
        return { error: null, recentError: null };
      }, function (error) {
        return { error: null, recentError: error };
      });
    }, function (error) {
      return { error: error, recentError: null };
    });
  }

  async function saveAs() {
    var input = document.getElementById("mfSaveAsName");
    var proposedName = input && input.value.trim() ? input.value.trim() : currentName;
    var name = proposedName.trim().slice(0, 80);
    if (!name) {
      setNotice("Save As cancelled: enter a project name.", true);
      return;
    }

    hasUserInteracted = true;
    var handle = null;
    try {
      if (typeof window.showSaveFilePicker === "function") {
        handle = await window.showSaveFilePicker({
          suggestedName: filenameForName(name),
          types: [{
            description: "MathForge project",
            accept: { "application/json": [".mathforge"] }
          }]
        });
      }
    } catch (error) {
      if (error && error.name === "AbortError") return;
      setNotice("Save failed: " + error.message, true);
      return;
    }

    beginSave(handle ? "Saving..." : "Downloading project");

    function finishSaveAs(project) {
      currentId = project.id;
      setProjectName(project.name);
      if (fileAdapter()) fileAdapter().setCurrentFileHandle(handle);
      persistedKey = projectKey(project);
      resetHistory();
      updateDirtyUI();
      return persistLocalProject(project).then(function (localResult) {
        if (localResult.error) {
          finishSave((handle ? "Project file saved; local recovery save failed: " : "Project downloaded; local save failed: ") +
            localResult.error.message, true);
          return false;
        }
        if (localResult.recentError) {
          finishSave((handle ? "Saved locally and to project file; " : "Project downloaded and saved locally; ") +
            "recent projects could not be refreshed: " + localResult.recentError.message, true);
          return false;
        }
        finishSave(handle ? "Saved locally and to project file" : "Project downloaded", false);
        return true;
      });
    }

    if (handle) {
      return enqueueSaveOperation(async function () {
        try {
          var project = captureProject();
          project.id = newProjectId();
          project.name = name;
          project.updatedAt = new Date().toISOString();
          var serialized = serializeProject(project);
          var adapter = fileAdapter();
          if (!adapter) throw new Error("The project file adapter is unavailable.");
          await adapter.writeFile(handle, serialized);
          return finishSaveAs(project);
        } catch (error) {
          finishSave("Save failed: " + error.message, true);
          return false;
        }
      });
    }

    var downloadedProject;
    try {
      downloadedProject = captureProject();
      downloadedProject.id = newProjectId();
      downloadedProject.name = name;
      downloadedProject.updatedAt = new Date().toISOString();
      downloadProject(downloadedProject);
    } catch (error) {
      finishSave("Save failed: " + error.message, true);
      return;
    }
    return enqueueSaveOperation(function () { return finishSaveAs(downloadedProject); });
  }

  async function loadProjectText(text, source, handle, options) {
    if (typeof text !== "string") throw new Error("The selected project file did not contain text.");
    if (text.length > 10 * 1024 * 1024) throw new Error("Project files must be smaller than 10 MB.");
    var project;
    try {
      project = JSON.parse(text);
    } catch (error) {
      throw new Error("The selected file is not valid project JSON.");
    }
    if (!validateProject(project)) throw new Error("Unsupported or invalid MathForge project file.");
    if (!(await confirmDiscard("open another file", Boolean(options && options.confirmReplace)))) return false;
    hasUserInteracted = true;
    var previousProject = captureProject();
    var previousProjectId = currentId;
    var previousPersistedKey = persistedKey;
    project.id = newProjectId();
    project.sourceId = project.id;
    try {
      applyProject(project);
    } catch (error) {
      try {
        applyProject(previousProject);
        currentId = previousProjectId;
        persistedKey = previousPersistedKey;
        updateDirtyUI();
      } catch (restoreError) {
        throw new Error("The project could not be opened, and the previous workspace could not be restored: " +
          error.message + " " + restoreError.message);
      }
      throw new Error("The project could not be restored; the previous workspace was kept. " + error.message);
    }
    if (fileAdapter()) fileAdapter().setCurrentFileHandle(handle || null);
    saveCurrent(false).catch(function () {});
    setNotice("Opened " + (source || "project") + ": " + currentName, false);
    return true;
  }

  async function openImportedFile(file) {
    if (!file) return;
    try {
      var text;
      if (typeof file.text === "function") {
        text = await file.text();
      } else {
        text = await new Promise(function (resolve, reject) {
          var reader = new FileReader();
          reader.onload = function () { resolve(String(reader.result || "")); };
          reader.onerror = function () { reject(new Error("The selected file could not be read.")); };
          reader.readAsText(file);
        });
      }
      await loadProjectText(text, file.name || "project file", null);
    } catch (error) {
      setNotice("Open failed: " + error.message, true);
    }
  }

  function openFilePicker() {
    hasUserInteracted = true;
    var input = document.getElementById("mfProjectFileInput");
    if (input) input.click();
  }

  function openFolder() {
    hasUserInteracted = true;
    if (typeof window.showDirectoryPicker !== "function") {
      setNotice("Folder picking is not supported here. Use Open File to open a .mathforge project.", true);
      return;
    }
    var picker;
    try {
      picker = window.showDirectoryPicker({ mode: "read" });
    } catch (error) {
      setNotice("Open Folder failed: " + error.message, true);
      return;
    }
    return Promise.resolve(picker).then(async function (directory) {
      var candidates = [];
      for await (var entry of directory.values()) {
        if (entry.kind === "file" && /\.(mathforge|json)$/i.test(entry.name)) candidates.push(entry);
      }
      if (!candidates.length) {
        setNotice("Folder opened: no .mathforge or JSON project files were found.", false);
        return;
      }
      var selected = candidates[0];
      if (candidates.length > 1) {
        var choice = await showDialog({
          title: "Choose a project",
          message: "Select a .mathforge project from " + directory.name + ".",
          choices: candidates.map(function (entry, index) { return { value: String(index), label: entry.name }; }),
          confirmLabel: "Open"
        });
        if (choice === null) return;
        selected = candidates[Number(choice)];
      }
      var file = await selected.getFile();
      await loadProjectText(await file.text(), selected.name, null);
    }).catch(function (error) {
      if (error && error.name === "AbortError") return;
      setNotice("Open Folder failed: " + error.message, true);
    });
  }

  async function newProject() {
    if (!(await confirmDiscard("create a new file"))) return;
    hasUserInteracted = true;
    window.clearTimeout(saveTimer);
    currentId = newProjectId();
    if (fileAdapter()) fileAdapter().setCurrentFileHandle(null);
    setProjectName("Untitled Project");
    isRestoring = true;
    try {
      window.MathForgeWorkspace.selectTool(null);
      window.MathForgeWorkspace.resetTools();
      window.MathForgeWorkspace.setToolStates({});
      if (window.MathForgeGraphDesignSettings) window.MathForgeGraphDesignSettings.reset();
    } finally {
      isRestoring = false;
    }
    resetHistory();
    persistedKey = projectKey(captureProject());
    updateDirtyUI();
    setNotice("New file ready. Changes are saved locally when browser storage is available.", false);
    saveCurrent(false).catch(function () {});
  }

  async function renameProject() {
    var name = await showDialog({
      title: "Rename File",
      message: "Enter a name for this MathForge project.",
      input: true,
      inputLabel: "Project name",
      value: currentName,
      confirmLabel: "Rename"
    });
    if (name === null) return;
    name = name.trim().slice(0, 80);
    if (!name) {
      setNotice("Rename cancelled: enter a project name.", true);
      return;
    }
    setProjectName(name);
    scheduleMutation();
  }

  function exportGraph(format) {
    var canvas = document.querySelector("#mfToolMountContainer canvas");
    if (!canvas || !canvas.width || !canvas.height) {
      setNotice("Export unavailable: select a graph tool first.", true);
      return false;
    }
    try {
      var png = canvas.toDataURL("image/png");
      if (!png || png.length < 100 || png === "data:,") {
        throw new Error("The active graph canvas is empty.");
      }
      var blob;
      if (format === "svg") {
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' +
          canvas.width + '" height="' + canvas.height + '" viewBox="0 0 ' + canvas.width + " " + canvas.height +
          '"><image x="0" y="0" width="' + canvas.width + '" height="' + canvas.height +
          '" href="' + png + '" xlink:href="' + png + '"/></svg>';
        blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      } else if (format === "png") {
        blob = dataUrlToBlob(png);
      } else {
        throw new Error("Choose PNG or SVG.");
      }
      downloadBlob(blob, filenameForProject(format));
      setNotice(format.toUpperCase() + " export started for " + currentName + ".", false);
      return true;
    } catch (error) {
      setNotice("Graph export failed: " + error.message, true);
      return false;
    }
  }

  function dataUrlToBlob(dataUrl) {
    var parts = dataUrl.split(",");
    var mime = (parts[0].match(/:(.*?);/) || [])[1] || "image/png";
    var binary = window.atob(parts[1]);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  async function promptExport() {
    if (!window.MathForgeWorkspace.getState().activeTool) {
      setNotice("Select a graph tool before exporting.", true);
      return;
    }
    var format = await showDialog({
      title: "Export Graph As",
      message: "Choose an image format for the active graph.",
      choices: [
        { value: "png", label: "PNG image" },
        { value: "svg", label: "SVG image (embedded PNG)" }
      ],
      confirmLabel: "Export"
    });
    if (format === null) return;
    exportGraph(format);
  }

  async function exitWorkspace() {
    if (!(await confirmDiscard("exit MathForge"))) return;
    allowUnload = true;
    window.close();
    window.setTimeout(function () {
      if (!window.closed) setNotice("Your browser kept this tab open. Close it using the browser controls.", true);
    }, 100);
  }

  function zoom(direction) {
    var activeTool = window.MathForgeWorkspace.getState().activeTool;
    if (activeTool === "coordinates-graph") {
      var toolbarButton = document.getElementById(direction > 0 ? "mfZoomInBtn" : "mfZoomOutBtn");
      if (toolbarButton && !toolbarButton.disabled) toolbarButton.click();
      return;
    }
    var zoomInput = {
      "equation-plotter": "zoom",
      "ogive-curve": "o_zoom",
      "histogram-polygon": "h_zoom"
    }[activeTool];
    var input = zoomInput && document.getElementById(zoomInput);
    if (!input) {
      setNotice("Select a graph tool before changing zoom.", true);
      return;
    }
    var current = Number(input.value);
    var min = Number(input.min) || 0.35;
    var max = Number(input.max) || 4;
    input.value = String(Math.max(min, Math.min(max, current * (direction > 0 ? 1.15 : 0.87))));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function performMenuAction(action) {
    closeMenus();
    switch (action) {
      case "new": newProject(); break;
      case "open": openFilePicker(); break;
      case "open-folder": openFolder(); break;
      case "save": saveCurrent(true).catch(function () {}); break;
      case "save-as": saveAs(); break;
      case "export": promptExport(); break;
      case "exit": exitWorkspace(); break;
      case "undo": undo(); break;
      case "redo": redo(); break;
      case "zoom-in": zoom(1); break;
      case "zoom-out": zoom(-1); break;
      case "rename": renameProject(); break;
      case "about":
        showDialog({ title: "About MathForge", message: "Offline mathematical workspace\nEarly Build", confirmLabel: "Close", cancelLabel: "" });
        break;
      case "shortcuts":
        showDialog({
          title: "Keyboard Shortcuts",
          message: "Ctrl+N  New File\nCtrl+O  Open File\nCtrl+S  Save File\nCtrl+Shift+S  Save File As\nCtrl+Z  Undo\nCtrl+Y  Redo\nCtrl++  Zoom In\nCtrl+-  Zoom Out",
          confirmLabel: "Close",
          cancelLabel: ""
        });
        break;
      default: console.warn("[MathForge] Unknown menu action:", action);
    }
  }

  function bindMenus() {
    Array.prototype.forEach.call(document.querySelectorAll(".mf-menu-root"), function (root) {
      var button = root.querySelector("[aria-haspopup='true']");
      if (!button) return;
      button.addEventListener("click", function (event) {
        event.stopPropagation();
        var shouldOpen = !root.classList.contains("open");
        closeMenus();
        root.classList.toggle("open", shouldOpen);
        button.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
      });
    });
    document.addEventListener("click", function (event) {
      var item = event.target.closest("[data-menu-action]");
      if (item && !item.disabled) {
        performMenuAction(item.getAttribute("data-menu-action"));
        return;
      }
      if (!event.target.closest(".mf-menu-root")) closeMenus();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeMenus();
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      var target = event.target;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      var key = event.key.toLowerCase();
      var handled = true;
      if (key === "n") newProject();
      else if (key === "o") openFilePicker();
      else if (key === "s" && event.shiftKey) saveAs();
      else if (key === "s") saveCurrent(true).catch(function () {});
      else if (key === "z" && !event.shiftKey) undo();
      else if (key === "y" || (key === "z" && event.shiftKey)) redo();
      else if (key === "+" || key === "=") zoom(1);
      else if (key === "-") zoom(-1);
      else handled = false;
      if (handled) event.preventDefault();
    });
  }

  document.getElementById("mfNewProjectBtn").addEventListener("click", newProject);
  document.getElementById("mfOpenProjectBtn").addEventListener("click", openFilePicker);
  document.getElementById("mfSaveAsProjectBtn").addEventListener("click", saveAs);
  document.getElementById("mfSaveProjectBtn").addEventListener("click", function () {
    saveCurrent(true).catch(function () {});
  });
  document.getElementById("mfProjectFileInput").addEventListener("change", function (event) {
    openImportedFile(event.target.files && event.target.files[0]);
    event.target.value = "";
  });
  document.getElementById("mfRecentProjects").addEventListener("change", async function (event) {
    var id = event.target.value;
    if (!id || !(await confirmDiscard("open a saved project"))) return;
    hasUserInteracted = true;
    readProject(id).then(function (project) {
      if (!project || !validateProject(project)) throw new Error("The selected saved project is unavailable or invalid.");
      applyProject(project);
      if (fileAdapter()) fileAdapter().setCurrentFileHandle(null);
      setNotice("Opened project: " + currentName, false);
    }).catch(function (error) { setNotice("Open failed: " + error.message, true); });
  });
  document.getElementById("mfHomeBtn").addEventListener("click", function () {
    window.MathForgeWorkspace.selectTool(null);
  });
  document.getElementById("mfExportPngBtn").addEventListener("click", function () { exportGraph("png"); });
  bindMenus();

  document.addEventListener("mf:tool-changed", function () {
    syncZoomReadout();
    scheduleMutation();
  });
  document.addEventListener("input", function (event) {
    if (event.target.closest("#mfToolControlsContainer, #mfToolMountContainer, #mfCoordToolInputs, #mfPropertiesContainer")) scheduleMutation();
    syncZoomReadout();
  }, true);
  document.addEventListener("change", function (event) {
    if (event.target.closest("#mfToolControlsContainer, #mfToolMountContainer, #mfCoordToolInputs, #mfPropertiesContainer")) scheduleMutation();
    syncZoomReadout();
  }, true);
  document.addEventListener("click", function (event) {
    if (event.target.closest("#mfToolControlsContainer, #mfToolMountContainer, #mfCoordToolInputs, #mfPropertiesContainer") ||
        event.target.closest("#mfZoomInBtn, #mfZoomOutBtn, #mfResetViewToolbarBtn")) scheduleMutation();
  }, true);
  document.addEventListener("pointerup", function (event) {
    if (event.target.closest("#mfToolMountContainer")) scheduleMutation();
  }, true);
  document.addEventListener("mouseup", function (event) {
    if (event.target.closest("#mfToolMountContainer")) scheduleMutation();
  }, true);

  function syncZoomReadout() {
    var activeTool = window.MathForgeWorkspace.getState().activeTool;
    var zoomInput = {
      "equation-plotter": "zoom",
      "ogive-curve": "o_zoom",
      "histogram-polygon": "h_zoom"
    }[activeTool];
    var input = zoomInput && document.getElementById(zoomInput);
    if (!input) return;
    var percentage = Math.round((Number(input.value) || 1) * 100) + "%";
    var readout = document.getElementById("mfCanvasZoomReadout");
    var status = document.getElementById("mfStatusZoom");
    var activeToolInfo = window.MathForgeWorkspace.getActiveTool();
    if (readout) readout.textContent = (activeToolInfo ? activeToolInfo.name + " · " : "") + percentage;
    if (status) status.textContent = percentage;
  }

  window.addEventListener("beforeunload", function (event) {
    if (!allowUnload && updateDirtyUI()) {
      event.preventDefault();
      event.returnValue = "";
    }
  });

  function flushPendingLocalSave() {
    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (isRestoring || allowUnload) return;
    var project;
    var key;
    try {
      project = captureProject();
      key = projectKey(project);
    } catch (error) {
      setNotice("Save failed: the current tool state could not be captured. " + error.message, true);
      return;
    }
    if (key === persistedKey || key === lifecycleSaveKey) return;
    lifecycleSaveKey = key;
    beginSave("Saving...");
    persistLocalProject(project).then(function (result) {
      if (result.error) {
        finishSave("Save failed during workspace close: " + result.error.message, true);
        return;
      }
      persistedKey = key;
      updateDirtyUI();
      finishSave(result.recentError
        ? "Saved locally; recent projects could not be refreshed: " + result.recentError.message
        : "Saved locally", Boolean(result.recentError));
    }).finally(function () {
      if (lifecycleSaveKey === key) lifecycleSaveKey = null;
    });
  }

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flushPendingLocalSave();
  });
  window.addEventListener("pagehide", flushPendingLocalSave);

  resetHistory();
  persistedKey = projectKey(captureProject());
  updateDirtyUI();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateDirtyUI);
  } else {
    updateDirtyUI();
  }
  var isOpenProjectRoute = /(?:^|\/)open-project\/?$/.test(window.location.pathname);
  var startupReady = openDatabase().then(function () {
    return Promise.all([readProject(AUTOSAVE_ID), refreshRecentProjects()]);
  }).then(function (results) {
    if (isOpenProjectRoute && !hasUserInteracted) {
      setNotice("Ready to open the project sent to MathForge.", false);
    } else if (!hasUserInteracted && results[0] && validateProject(results[0])) {
      applyProject(results[0]);
      setNotice("Recovered the most recent saved project from this browser.", false);
    } else if (!hasUserInteracted) {
      setNotice("Local project storage is ready. Save File As also creates a portable .mathforge file.", false);
    }
    return true;
  }).catch(function (error) {
    setNotice("Browser storage unavailable: " + error.message + " Portable .mathforge files remain available.", true);
    return false;
  });

  window.MathForgeProjectManager = {
    newProject: newProject,
    openFile: openFilePicker,
    openFolder: openFolder,
    loadProjectText: loadProjectText,
    save: saveCurrent,
    saveAs: saveAs,
    exportGraph: exportGraph,
    undo: undo,
    redo: redo,
    rename: renameProject,
    isDirty: updateDirtyUI,
    ready: startupReady,
    reportFileError: function (message) { setNotice(message, true); }
  };
  if (fileAdapter()) fileAdapter().setProjectManager(window.MathForgeProjectManager);
})(window, document);
