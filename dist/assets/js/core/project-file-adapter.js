(function (window, document) {
  "use strict";

  var scriptUrl = document.currentScript ? document.currentScript.src : document.baseURI;
  var workerUrl = new URL("../../../service-worker.js", scriptUrl);
  var scopeUrl = new URL("../../../", scriptUrl);
  var projectManager = null;
  var currentFileHandle = null;
  var fileQueue = Promise.resolve();
  var managerReadyResolve;
  var managerReady = new Promise(function (resolve) {
    managerReadyResolve = resolve;
  });

  function reportError(message) {
    if (projectManager && typeof projectManager.reportFileError === "function") {
      projectManager.reportFileError(message);
      return;
    }
    console.error("[MathForge] " + message);
  }

  async function writeFile(handle, contents) {
    if (!handle || handle.kind !== "file" || typeof handle.createWritable !== "function") {
      throw new Error("The project file is not writable in this browser.");
    }

    if (typeof handle.queryPermission === "function") {
      var permission = await handle.queryPermission({ mode: "readwrite" });
      if (permission !== "granted" && typeof handle.requestPermission === "function") {
        permission = await handle.requestPermission({ mode: "readwrite" });
      }
      if (permission !== "granted") {
        throw new Error("Write permission was denied. The project file was not changed.");
      }
    } else if (typeof handle.requestPermission === "function") {
      var requestedPermission = await handle.requestPermission({ mode: "readwrite" });
      if (requestedPermission !== "granted") {
        throw new Error("Write permission was denied. The project file was not changed.");
      }
    } else {
      throw new Error("This browser cannot confirm write permission. Use Save As to create a project copy.");
    }

    var writable = await handle.createWritable();
    try {
      await writable.write(contents);
      await writable.close();
    } catch (error) {
      if (typeof writable.abort === "function") {
        try {
          await writable.abort();
        } catch (abortError) {
          console.error("[MathForge] Unable to abort the failed project-file write:", abortError);
        }
      }
      throw error;
    }
  }

  async function processFileHandle(handle, manager, confirmReplace) {
    if (!handle || handle.kind !== "file" || !/\.mathforge$/i.test(handle.name || "")) {
      throw new Error("The file handler only accepts .mathforge project files.");
    }

    var file = await handle.getFile();
    if (file.size > 10 * 1024 * 1024) {
      throw new Error("Project files must be smaller than 10 MB.");
    }
    if (file.type && file.type !== "application/json") {
      throw new Error("Unsupported project file type. Expected application/json.");
    }
    var text = await file.text();
    return manager.loadProjectText(text, handle.name, handle, { confirmReplace: confirmReplace });
  }

  function handleLaunchParams(params) {
    var handles = params && Array.isArray(params.files) ? params.files.slice() : [];
    if (!handles.length) return fileQueue;

    fileQueue = fileQueue.then(async function () {
      var manager = await managerReady;
      await manager.ready;
      for (var i = 0; i < handles.length; i++) {
        try {
          var opened = await processFileHandle(handles[i], manager, handles.length > 1 && i > 0);
          if (!opened) break;
        } catch (error) {
          reportError("Unable to open " + (handles[i].name || "the selected project") + ": " + error.message);
        }
      }
    }).catch(function (error) {
      reportError("Unable to process the file-open request: " + error.message);
    });
    return fileQueue;
  }

  var api = {
    supported: Boolean(window.launchQueue && typeof window.launchQueue.setConsumer === "function"),
    registered: false,
    setProjectManager: function (manager) {
      projectManager = manager;
      managerReadyResolve(manager);
    },
    setCurrentFileHandle: function (handle) {
      currentFileHandle = handle || null;
    },
    getCurrentFileHandle: function () {
      return currentFileHandle;
    },
    writeFile: writeFile,
    handleLaunchParams: handleLaunchParams
  };
  window.MathForgeProjectFileAdapter = api;

  if (api.supported) {
    try {
      window.launchQueue.setConsumer(handleLaunchParams);
      api.registered = true;
    } catch (error) {
      reportError("The browser could not register its PWA file-open handler: " + error.message);
    }
  }

  if (window.location.protocol !== "file:" && window.isSecureContext &&
      window.navigator.serviceWorker && typeof window.navigator.serviceWorker.register === "function") {
    window.navigator.serviceWorker.register(workerUrl.href, { scope: scopeUrl.pathname })
      .catch(function (error) {
        reportError("Offline app resources could not be cached: " + error.message);
      });
  }
})(window, document);
