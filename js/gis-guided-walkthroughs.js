import { renderHelpWalkthroughs } from "./helpWalkthroughContent.js";

const HELP_TOUR_COMPLETIONS_STORAGE_KEY = "jcgis-help-tour-completions";
const WALKTHROUGH_START_MESSAGE = "jcgis-guided-walkthrough-start";

function readCompletedTourIds() {
  try {
    const raw = window.localStorage.getItem(HELP_TOUR_COMPLETIONS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter(Boolean) : []);
  } catch {
    return new Set();
  }
}

function syncCompletedWalkthroughs() {
  const completedTourIds = readCompletedTourIds();
  document.querySelectorAll("[data-tour-id]").forEach((button) => {
    button.classList.toggle("completed", completedTourIds.has(button.dataset.tourId));
  });
}

function startWalkthrough(tourId) {
  if (!tourId) return;
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: WALKTHROUGH_START_MESSAGE, tourId }, window.location.origin);
    return;
  }

  const url = new URL("./index.html", window.location.href);
  url.searchParams.set("helpTour", tourId);
  window.location.href = url.toString();
}

function main() {
  const grid = document.getElementById("helpWalkthroughGrid");
  renderHelpWalkthroughs(grid);
  syncCompletedWalkthroughs();

  document.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("[data-tour-id]") : null;
    if (!button) return;
    event.preventDefault();
    startWalkthrough(button.dataset.tourId);
  });
}

main();
