const HELP_TICKET_FORM_URL = "https://gisaws.jacksongov.org/tickets/gis/";
const HELP_TICKET_APP_LABEL = "Public Parcel Viewer";
const HELP_PAGE_CONTEXT_STORAGE_KEY = "jcgis-help-page-context";
const PARCEL_VIEWER_PAGE_URL = "./index.html";
const EMBED_HELP_MESSAGE_TARGET = "jcgis-help-close";
const EMBED_HELP_TICKET_MODAL_MESSAGE_TARGET = "jcgis-help-ticket-modal";
const EMBED_HELP_WALKTHROUGH_MODAL_MESSAGE_TARGET = "jcgis-help-walkthrough-modal";
const EMBED_HELP_TOUR_MESSAGE_TARGET = "jcgis-start-help-tour";
const GUIDED_WALKTHROUGH_START_MESSAGE = "jcgis-guided-walkthrough-start";
const HELP_TICKET_ARTWORK_VERSION = "20260612-19";
const HELP_TICKET_ARTWORK_BASE_URL = "./assets/tickettypes";
const HELP_TICKET_TYPES = [
  {
    label: "Question / Support",
    accent: "blue",
    art: "question-support.png"
  },
  {
    label: "Issue / Bug",
    accent: "red",
    art: "issue-bug.png"
  },
  {
    label: "Change",
    accent: "change",
    art: "change.png"
  },
  {
    label: "Data Correction",
    accent: "data-correction",
    art: "data-correction.png"
  },
  {
    label: "Access",
    accent: "access",
    art: "access.png"
  }
];

function normalizePageKey(value) {
  return value === "pw" || value === "sa" || value === "parcel" ? value : null;
}

function readHelpContext() {
  try {
    const raw = window.sessionStorage.getItem(HELP_PAGE_CONTEXT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function buildParcelViewerUrl({ page, openAssistant = false } = {}) {
  const url = new URL(PARCEL_VIEWER_PAGE_URL, window.location.href);
  const normalizedPage = normalizePageKey(page);

  if (normalizedPage) {
    url.searchParams.set("page", normalizedPage);
  }

  if (openAssistant) {
    url.searchParams.set("openAssistant", "1");
  }

  return url.toString();
}

function buildHelpTourUrl({ page, tourId } = {}) {
  const url = new URL(buildParcelViewerUrl({ page }));
  if (tourId) {
    url.searchParams.set("helpTour", tourId);
  }
  return url.toString();
}

function isEmbeddedHelp() {
  return new URL(window.location.href).searchParams.get("embed") === "1" && window.parent && window.parent !== window;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function buildTicketUrl(ticketType) {
  const url = new URL(HELP_TICKET_FORM_URL);
  url.searchParams.set("entry", "bypass");
  url.searchParams.set("ticketType", ticketType);
  url.searchParams.set("app", HELP_TICKET_APP_LABEL);
  return url.toString();
}

function getTicketArtworkUrl(fileName) {
  return `${HELP_TICKET_ARTWORK_BASE_URL}/${fileName}?v=${encodeURIComponent(HELP_TICKET_ARTWORK_VERSION)}`;
}

function renderTicketTypeChoices(container) {
  if (!container) return;
  container.innerHTML = HELP_TICKET_TYPES.map((ticketType) => `
    <button class="help-ticket-type-card" type="button" data-ticket-type="${escapeHtml(ticketType.label)}" data-accent="${escapeHtml(ticketType.accent)}">
      <img class="help-ticket-type-art" src="${escapeHtml(getTicketArtworkUrl(ticketType.art))}" alt="${escapeHtml(ticketType.label)}">
    </button>
  `).join("");
}

function syncVisibleSections(context) {
  const requestedPage = normalizePageKey(new URL(window.location.href).searchParams.get("page"));
  const sectionIds = {
    parcel: document.getElementById("helpSectionParcel"),
    pw: document.getElementById("helpSectionPW"),
    sa: document.getElementById("helpSectionSA")
  };

  const visibleKeys = Array.isArray(context?.accessiblePageKeys)
    ? context.accessiblePageKeys.map(normalizePageKey).filter(Boolean)
    : [];

  const effectiveKeys = visibleKeys.length ? visibleKeys : ["parcel"];

  Object.entries(sectionIds).forEach(([key, el]) => {
    if (!el) return;
    el.hidden = !effectiveKeys.includes(key);
  });

  return requestedPage || normalizePageKey(context?.currentPage) || "parcel";
}

function wireNavigation(currentPage) {
  const helpCloseBtn = document.getElementById("helpCloseBtn");
  const helpWalkthroughBtn = document.getElementById("helpWalkthroughBtn");
  const helpIssueBtn = document.getElementById("helpIssueBtn");
  const ticketTypeModal = document.getElementById("ticketTypeModal");
  const ticketTypeModalCloseBtn = document.getElementById("ticketTypeModalCloseBtn");
  const ticketTypeChoices = document.getElementById("ticketTypeChoices");
  const walkthroughModal = document.getElementById("walkthroughModal");
  const walkthroughModalCloseBtn = document.getElementById("walkthroughModalCloseBtn");
  const walkthroughModalFrame = document.getElementById("walkthroughModalFrame");
  const embedded = isEmbeddedHelp();

  const setTicketTypeModalOpen = (open) => {
    if (!ticketTypeModal) return;
    ticketTypeModal.hidden = !open;
    ticketTypeModal.setAttribute("aria-hidden", open ? "false" : "true");
    document.documentElement.classList.toggle("ticket-modal-open", open);
    document.body.classList.toggle("ticket-modal-open", open);
    if (embedded) {
      window.parent.postMessage({ type: EMBED_HELP_TICKET_MODAL_MESSAGE_TARGET, open }, window.location.origin);
    }
    if (open) {
      renderTicketTypeChoices(ticketTypeChoices);
      ticketTypeChoices?.querySelector("button")?.focus?.();
    }
  };

  const setWalkthroughModalOpen = (open) => {
    if (!walkthroughModal) return;
    walkthroughModal.hidden = !open;
    walkthroughModal.setAttribute("aria-hidden", open ? "false" : "true");
    document.documentElement.classList.toggle("walkthrough-modal-open", open);
    document.body.classList.toggle("walkthrough-modal-open", open);
    if (embedded) {
      window.parent.postMessage({ type: EMBED_HELP_WALKTHROUGH_MODAL_MESSAGE_TARGET, open }, window.location.origin);
    }
    if (open && walkthroughModalFrame) {
      walkthroughModalFrame.src = "./gis-guided-walkthroughs.html";
    }
  };

  const startGuidedTour = (tourId) => {
    if (!tourId) return;
    setWalkthroughModalOpen(false);
    if (embedded) {
      window.parent.postMessage({ type: EMBED_HELP_TOUR_MESSAGE_TARGET, tourId }, window.location.origin);
      return;
    }
    window.location.href = buildHelpTourUrl({ page: currentPage, tourId });
  };

  helpCloseBtn?.addEventListener("click", () => {
    if (embedded) {
      window.parent.postMessage({ type: EMBED_HELP_MESSAGE_TARGET }, window.location.origin);
      return;
    }
    window.location.href = buildParcelViewerUrl({ page: currentPage });
  });

  helpIssueBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    if (helpIssueBtn.disabled || helpIssueBtn.getAttribute("aria-disabled") === "true") return;
    setTicketTypeModalOpen(true);
  });

  ticketTypeModalCloseBtn?.addEventListener("click", () => {
    setTicketTypeModalOpen(false);
  });

  ticketTypeModal?.addEventListener("click", (event) => {
    if (event.target === ticketTypeModal) {
      setTicketTypeModalOpen(false);
    }
  });

  ticketTypeChoices?.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("[data-ticket-type]") : null;
    const ticketType = button?.dataset?.ticketType;
    if (!ticketType) return;
    window.open(buildTicketUrl(ticketType), "_blank", "noopener,noreferrer");
    setTicketTypeModalOpen(false);
  });

  helpWalkthroughBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    setWalkthroughModalOpen(true);
  });

  walkthroughModalCloseBtn?.addEventListener("click", () => {
    setWalkthroughModalOpen(false);
  });

  walkthroughModal?.addEventListener("click", (event) => {
    if (event.target === walkthroughModal) {
      setWalkthroughModalOpen(false);
    }
  });

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type === GUIDED_WALKTHROUGH_START_MESSAGE) {
      startGuidedTour(event.data?.tourId);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && ticketTypeModal && !ticketTypeModal.hidden) {
      setTicketTypeModalOpen(false);
      return;
    }
    if (event.key === "Escape" && walkthroughModal && !walkthroughModal.hidden) {
      setWalkthroughModalOpen(false);
      return;
    }
  });
}

function main() {
  const context = readHelpContext();
  const currentPage = syncVisibleSections(context);
  const embedded = isEmbeddedHelp();

  if (embedded) {
    document.documentElement.classList.add("embed-mode");
    document.body.classList.add("embed-mode");
  }

  wireNavigation(currentPage);
}

main();
