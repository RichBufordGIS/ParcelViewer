function createNoopController() {
  return {
    setStatus() {},
    setUser() {},
    fail() {},
    hide() {}
  };
}

export function createParcelPreloader(root) {
  if (!root) return createNoopController();

  root.innerHTML = `
    <div class="parcel-preloader-shell" data-state="loading">
      <div class="parcel-preloader-card">
        <div class="parcel-preloader-brand">
          <img
            class="parcel-preloader-brand-logo"
            src="https://jcgis.jacksongov.org/images/jackson-county-logo.png"
            alt="Jackson County GIS logo"
          />
          <div class="parcel-preloader-brand-text">
            <div class="parcel-preloader-brand-welcome">Welcome To Jackson County GIS</div>
            <div class="parcel-preloader-brand-title">Parcel Viewer</div>
            <div class="parcel-preloader-brand-subtitle">Beta</div>
          </div>
        </div>
        <div class="parcel-preloader-status-block">
          <div class="parcel-preloader-status-label">Loading...</div>
          <div class="parcel-preloader-status" data-preloader-status>Starting Parcel Viewer</div>
          <div class="parcel-preloader-user" data-preloader-user hidden></div>
          <div class="parcel-preloader-progress" aria-hidden="true">
            <span class="parcel-preloader-progress-bar"></span>
          </div>
        </div>
      </div>
    </div>
  `;

  root.hidden = false;
  root.style.display = "";

  const shell = root.querySelector(".parcel-preloader-shell");
  const statusEl = root.querySelector("[data-preloader-status]");
  const userEl = root.querySelector("[data-preloader-user]");

  function stopHintTimer() {
  }

  return {
    setStatus(message) {
      if (shell) shell.dataset.state = "loading";
      if (statusEl && message) statusEl.textContent = message;
    },
    setUser(userLabel) {
      if (!userEl) return;
      const safeLabel = String(userLabel || "").trim();
      if (!safeLabel) {
        userEl.hidden = true;
        userEl.textContent = "";
        return;
      }
      userEl.hidden = false;
      userEl.textContent = `Signed in as ${safeLabel}`;
    },
    fail(message) {
      stopHintTimer();
      if (shell) shell.dataset.state = "error";
      if (statusEl) statusEl.textContent = message || "Parcel Viewer could not finish loading.";
      root.hidden = false;
      root.style.display = "";
    },
    hide() {
      stopHintTimer();
      if (shell) shell.dataset.state = "done";
      window.setTimeout(() => {
        root.hidden = true;
        root.style.display = "none";
      }, 260);
    }
  };
}
