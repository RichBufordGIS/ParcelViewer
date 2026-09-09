const PARCEL_NUMBER_EXAMPLE = "44-320-17-05-00-0-00-000";
const FULL_ADDRESS_EXAMPLE = "2423 INDEPENDENCE AVE KANSAS CITY, MO 64124";
const HELP_TOUR_COMPLETIONS_STORAGE_KEY = "jcgis-help-tour-completions";

const TOUR_DEFINITIONS = {
	searchParcelNumber: {
		storageId: "search-parcel-number",
		title: "Search by Parcel Number",
		steps: [
			{
				id: "focus-search",
				target: ".header-search-shell",
				title: "Click on the search bar",
				body: "Click inside the Parcel Viewer search bar.",
				task: "Click on the search bar",
				validate: ({ state }) => state.searchFocused === true
			},
			{
				id: "enter-search",
				target: ".header-search-shell",
				title: "Enter a parcel number",
				body: `Type or paste a parcel number. Try: ${PARCEL_NUMBER_EXAMPLE}`,
				task: "Parcel number entered",
				example: PARCEL_NUMBER_EXAMPLE,
				validate: ({ searchValue }) => searchValue.replace(/\D/g, "").length >= 8
			},
			{
				id: "run-search",
				target: ".header-search-shell",
				title: "Run the search",
				body: "Press Enter or choose the matching suggestion from the search results.",
				task: "Search result selected or completed",
				validate: ({ state }) => state.searchCompleted === true || hasVisibleParcelDetails()
			}
		]
	},
	searchFullAddress: {
		storageId: "search-full-address",
		title: "Search by Full Address",
		steps: [
			{
				id: "focus-search",
				target: ".header-search-shell",
				title: "Click on the search bar",
				body: "Click inside the Parcel Viewer search bar.",
				task: "Click on the search bar",
				validate: ({ state }) => state.searchFocused === true
			},
			{
				id: "enter-search",
				target: ".header-search-shell",
				title: "Enter the full address",
				body: `Type or paste the full street, city, state, and ZIP when available. Try: ${FULL_ADDRESS_EXAMPLE}`,
				task: "Full address entered",
				example: FULL_ADDRESS_EXAMPLE,
				validate: ({ searchValue }) => {
					const normalizedValue = searchValue.replace(/\s+/g, " ").trim().toUpperCase();
					return normalizedValue.length >= 12 && /\b(MO|MISSOURI)\b/.test(normalizedValue);
				}
			},
			{
				id: "run-search",
				target: ".header-search-shell",
				title: "Run the search",
				body: "Press Enter or choose the matching address suggestion from the search results.",
				task: "Address result selected or completed",
				validate: ({ state }) => state.searchCompleted === true || hasVisibleParcelDetails()
			}
		]
	},
	copyDetails: {
		storageId: "copy-details",
		title: "Copy Parcel Details",
		steps: [
			{
				id: "select-parcel-first",
				target: "#right-sidebar",
				title: "Start with a selected parcel",
				body: "Search for and select a parcel so the details panel opens.",
				task: "Parcel details visible",
				validate: () => !!document.querySelector(".copy-field-btn")
			},
			{
				id: "copy-detail",
				target: ".copy-field-btn",
				title: "Copy a common detail",
				body: "Click the small duplicate icon next to a parcel number, address, owner, or legal description.",
				task: "Detail copied",
				validate: ({ state }) => state.copyClicked === true
			}
		]
	},
	selectMultiple: {
		storageId: "select-multiple",
		title: "Select Multiple Parcels",
		steps: [
			{
				id: "confirm-parcel-viewer",
				target: "#map2d",
				title: "Parcel Viewer",
				body: "The public Parcel Viewer opens directly to the 2D parcel tools.",
				task: "Parcel Viewer visible",
				validate: () => document.getElementById("page-parcel")?.classList.contains("visible")
			},
			{
				id: "open-rectangle",
				target: "#rectangleSelectExpand2d",
				title: "Open rectangle selection",
				body: "Click the rectangle selection tool on the 2D map controls.",
				task: "Rectangle tool opened",
				validate: () => document.getElementById("rectangleSelectExpand2d")?.expanded === true
			},
			{
				id: "draw-rectangle",
				target: "#map",
				spotlight: "map-center",
				title: "Draw a rectangle around a few parcels",
				body: "If the map is far out, zoom in first. Click Start if needed, then drag a rectangle around a few parcels in the center of the map.",
				task: "Draw a rectangle around a few parcels",
				validate: () => hasSelectedParcelRows()
			},
			{
				id: "review-selected",
				target: "#rightSidebarContent",
				title: "Review selected parcels",
				body: "Review the selected parcel details in the right sidebar after the map adds parcels from the rectangle.",
				task: "Selected parcel details visible",
				validate: () => hasSelectedParcelRows()
			}
		]
	},
	viewMode: {
		storageId: "view-mode",
		title: "Switch Between 2D and 3D",
		steps: [
			{
				id: "find-view-toggle",
				target: "#viewModeToggle",
				title: "Find the view toggle",
				body: "The 2D / 3D switch sits on the map so users can change how the parcel is reviewed.",
				task: "View toggle located",
				validate: () => !!document.getElementById("viewModeToggle")
			},
			{
				id: "toggle-3d",
				target: "#viewModeToggle",
				title: "Switch views",
				body: "Click the control to change between 2D and 3D. Condo workflows may also move you into 3D automatically.",
				task: "View mode changed",
				validate: ({ state }) => state.viewModeChanged === true
			}
		]
	},
	mapLayerInfo: {
		storageId: "map-layer-info",
		title: "Open Map Layer Info",
		steps: [
			{
				id: "open-map-info",
				target: "#settingsBtn",
				title: "Open map layer info",
				body: "Click the map layer info button in the header.",
				task: "Map layer info opened",
				validate: () => !document.getElementById("settingsPanel")?.classList.contains("hidden")
			},
			{
				id: "review-map-info-tabs",
				target: "#settingsPanel",
				title: "Review map layer info",
				body: "Use the map layer info panel to review public maps, scenes, layers, tables, and service links.",
				task: "Layer info popup visible",
				validate: () => !document.getElementById("settingsPanel")?.classList.contains("hidden")
			}
		]
	}
};

function normalizeTourId(value) {
	const tourMap = {
		"search-parcel": "searchParcelNumber",
		searchParcel: "searchParcelNumber",
		"search-parcel-number": "searchParcelNumber",
		searchParcelNumber: "searchParcelNumber",
		"search-full-address": "searchFullAddress",
		searchFullAddress: "searchFullAddress",
		"copy-details": "copyDetails",
		copyDetails: "copyDetails",
		"select-multiple": "selectMultiple",
		selectMultiple: "selectMultiple",
		"view-mode": "viewMode",
		viewMode: "viewMode",
		"map-layer-info": "mapLayerInfo",
		mapLayerInfo: "mapLayerInfo"
	};
	return tourMap[value] || null;
}

function getDeepActiveElement(root = document) {
	const active = root.activeElement;
	if (active?.shadowRoot) return getDeepActiveElement(active.shadowRoot) || active;
	return active;
}

function getSearchInput(searchEl) {
	return searchEl?.shadowRoot
		?.querySelector("calcite-autocomplete")
		?.shadowRoot?.querySelector("calcite-input")
		?.shadowRoot?.querySelector("input")
		|| searchEl?.shadowRoot?.querySelector("input")
		|| null;
}

function getSearchValue() {
	const searchEl = document.getElementById("search");
	const input = getSearchInput(searchEl);
	return String(input?.value || searchEl?.value || searchEl?.searchTerm || "").trim();
}

function hasVisibleParcelDetails() {
	const rightSidebarContent = document.getElementById("rightSidebarContent");
	const selectedBadgeCount = Number(document.getElementById("selectedParcelBadge2d")?.textContent || 0);
	if (selectedBadgeCount > 0) return true;
	if (!rightSidebarContent) return false;
	return !!rightSidebarContent.querySelector(".copy-field-btn, #right-info, .external-frame-card, .single-parcel-embed-grid, .selected-parcel-item");
}

function hasSelectedParcelRows() {
	const rightSidebarContent = document.getElementById("rightSidebarContent");
	const inlineBadgeCount = Number(rightSidebarContent?.querySelector(".selected-parcel-badge-inline")?.textContent || 0);
	if (inlineBadgeCount > 0) return true;
	return !!rightSidebarContent?.querySelector(".selected-parcel-item");
}

function readCompletedTourIds() {
	try {
		const raw = window.localStorage.getItem(HELP_TOUR_COMPLETIONS_STORAGE_KEY);
		const parsed = raw ? JSON.parse(raw) : [];
		return new Set(Array.isArray(parsed) ? parsed.filter(Boolean) : []);
	} catch {
		return new Set();
	}
}

function writeCompletedTourId(tourId) {
	if (!tourId) return;
	const completedIds = readCompletedTourIds();
	completedIds.add(tourId);
	try {
		window.localStorage.setItem(HELP_TOUR_COMPLETIONS_STORAGE_KEY, JSON.stringify([...completedIds]));
	} catch {}
}

async function copyTextToClipboard(value) {
	const text = String(value || "");
	if (!text) return false;
	try {
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(text);
			return true;
		}
		const textarea = document.createElement("textarea");
		textarea.value = text;
		textarea.setAttribute("readonly", "");
		textarea.style.position = "fixed";
		textarea.style.left = "-9999px";
		document.body.appendChild(textarea);
		textarea.select();
		const copied = document.execCommand("copy");
		textarea.remove();
		return copied;
	} catch {
		return false;
	}
}

function createTourElements() {
	const overlay = document.createElement("div");
	overlay.className = "help-tour-overlay";
	overlay.hidden = true;
	overlay.innerHTML = `
		<div class="help-tour-scrim" aria-hidden="true"></div>
		<div class="help-tour-spotlight" aria-hidden="true"></div>
		<div class="help-tour-card" role="dialog" aria-modal="false" aria-live="polite">
			<div class="help-tour-complete-burst" aria-hidden="true">
				<span></span><span></span><span></span><span></span><span></span><span></span>
			</div>
			<div class="help-tour-complete-icon" aria-hidden="true">
				<calcite-icon icon="check" scale="l"></calcite-icon>
			</div>
			<div class="help-tour-eyebrow">Guided Walkthrough</div>
			<h3 id="helpTourTitle"></h3>
			<p id="helpTourBody"></p>
			<div class="help-tour-example" id="helpTourExample" hidden>
				<span id="helpTourExampleText"></span>
				<button class="help-tour-example-copy" type="button" data-tour-copy-example aria-label="Copy example" title="Copy example">
					<calcite-icon icon="duplicate" scale="s"></calcite-icon>
				</button>
			</div>
			<ol class="help-tour-step-list" id="helpTourStepList"></ol>
			<div class="help-tour-progress" id="helpTourProgress"></div>
			<div class="help-tour-actions">
				<button class="help-tour-btn secondary" type="button" data-tour-prev>Back</button>
				<button class="help-tour-btn secondary" type="button" data-tour-close>Close</button>
				<button class="help-tour-btn primary" type="button" data-tour-next disabled>Next</button>
			</div>
		</div>
	`;
	document.body.appendChild(overlay);

	return {
		overlay,
		spotlight: overlay.querySelector(".help-tour-spotlight"),
		card: overlay.querySelector(".help-tour-card"),
		completeIcon: overlay.querySelector(".help-tour-complete-icon"),
		title: overlay.querySelector("#helpTourTitle"),
		body: overlay.querySelector("#helpTourBody"),
		example: overlay.querySelector("#helpTourExample"),
		exampleText: overlay.querySelector("#helpTourExampleText"),
		exampleCopyBtn: overlay.querySelector("[data-tour-copy-example]"),
		stepList: overlay.querySelector("#helpTourStepList"),
		progress: overlay.querySelector("#helpTourProgress"),
		prevBtn: overlay.querySelector("[data-tour-prev]"),
		nextBtn: overlay.querySelector("[data-tour-next]")
	};
}

function getTargetRect(selector) {
	const target = document.querySelector(selector);
	if (!target) return null;

	target.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
	return target.getBoundingClientRect();
}

function getMapCenterRect(selector) {
	const mapRect = getTargetRect(selector);
	if (!mapRect) return null;

	const rightSidebarRect = document.getElementById("right-sidebar-shell")?.getBoundingClientRect();
	const visibleRight = rightSidebarRect && rightSidebarRect.left > mapRect.left && rightSidebarRect.left < mapRect.right
		? rightSidebarRect.left
		: mapRect.right;
	const visibleLeft = mapRect.left;
	const visibleTop = Math.max(mapRect.top, 0);
	const visibleWidth = Math.max(260, visibleRight - visibleLeft);
	const visibleHeight = Math.max(220, mapRect.bottom - visibleTop);
	const width = Math.min(Math.max(visibleWidth * 0.28, 300), 480);
	const height = Math.min(Math.max(visibleHeight * 0.24, 170), 280);
	const mapCenterX = visibleLeft + visibleWidth * 0.5;
	const mapCenterY = visibleTop + visibleHeight * 0.5;

	return {
		left: mapCenterX - width / 2,
		top: mapCenterY - height / 2,
		width,
		height,
		right: mapCenterX + width / 2,
		bottom: mapCenterY + height / 2
	};
}

function renderStepList({ elements, tour, index, completedStepIds }) {
	elements.stepList.innerHTML = tour.steps.map((step, stepIndex) => {
		const complete = completedStepIds.has(step.id);
		const current = stepIndex === index;
		return `
			<li class="${complete ? "complete" : ""} ${current ? "current" : ""}">
				<span class="help-tour-step-check" aria-hidden="true"></span>
				<span class="help-tour-step-copy">
					<span class="help-tour-step-number">Step ${stepIndex + 1}</span>
					<span class="help-tour-step-task">${step.task}</span>
				</span>
			</li>
		`;
	}).join("");
}

function positionTour({ elements, tour, step, index, total, complete, completedStepIds }) {
	const rect = step.spotlight === "map-center"
		? getMapCenterRect(step.target)
		: getTargetRect(step.target);
	const inset = 8;
	const fallbackRect = {
		left: 24,
		top: 90,
		width: Math.max(260, window.innerWidth - 48),
		height: 74,
		right: window.innerWidth - 24,
		bottom: 164
	};
	const targetRect = rect && rect.width > 0 && rect.height > 0 ? rect : fallbackRect;

	const spotlightLeft = Math.max(8, targetRect.left - inset);
	const spotlightTop = Math.max(8, targetRect.top - inset);
	const spotlightWidth = Math.min(window.innerWidth - 16, targetRect.width + inset * 2);
	const spotlightHeight = Math.min(window.innerHeight - 16, targetRect.height + inset * 2);

	elements.spotlight.style.left = `${spotlightLeft}px`;
	elements.spotlight.style.top = `${spotlightTop}px`;
	elements.spotlight.style.width = `${spotlightWidth}px`;
	elements.spotlight.style.height = `${spotlightHeight}px`;

	elements.title.textContent = step.title;
	elements.body.textContent = step.body;
	renderStepList({ elements, tour, index, completedStepIds });
	elements.progress.textContent = `Step ${index + 1} of ${total}`;
	elements.prevBtn.disabled = index === 0;
	elements.nextBtn.disabled = !complete;
	elements.nextBtn.textContent = index === total - 1 ? "Finish" : "Next";

	if (step.example) {
		elements.example.hidden = false;
		elements.exampleText.textContent = step.example;
		elements.exampleCopyBtn.dataset.copyValue = step.example;
		elements.exampleCopyBtn.classList.remove("copied");
		elements.exampleCopyBtn.setAttribute("aria-label", "Copy example");
		elements.exampleCopyBtn.title = "Copy example";
	} else {
		elements.example.hidden = true;
		elements.exampleText.textContent = "";
		elements.exampleCopyBtn.dataset.copyValue = "";
	}

	const cardWidth = Math.min(390, window.innerWidth - 24);
	let cardLeft = Math.min(window.innerWidth - cardWidth - 12, Math.max(12, targetRect.left));
	let cardTop = targetRect.bottom + 18;
	if (cardTop + 260 > window.innerHeight) {
		cardTop = Math.max(12, targetRect.top - 276);
	}

	elements.card.style.width = `${cardWidth}px`;
	elements.card.style.left = `${cardLeft}px`;
	elements.card.style.top = `${cardTop}px`;
}

export function initHelpTours({ closeHelpOverlay, openHelpOverlay, showAppNotice } = {}) {
	const elements = createTourElements();
	const state = {
		searchFocused: false,
		searchCompleted: false,
		copyClicked: false,
		rectangleStarted: false,
		viewModeChanged: false
	};
	let activeTour = null;
	let activeIndex = 0;
	let completedStepIds = new Set();
	let taskTimer = null;
	let completionReturnTimer = null;
	let completingTour = false;

	function getCurrentStep() {
		return activeTour?.steps?.[activeIndex] || null;
	}

	function isCurrentStepComplete() {
		const step = getCurrentStep();
		if (!step) return false;
		return step.validate({
			state,
			searchValue: getSearchValue()
		});
	}

	function resetTaskState() {
		state.searchFocused = false;
		state.searchCompleted = false;
		state.copyClicked = false;
		state.rectangleStarted = false;
		state.viewModeChanged = false;
	}

	function closeTour({ returnToHelp = false, completed = false } = {}) {
		if (completed && activeTour?.storageId) {
			writeCompletedTourId(activeTour.storageId);
		}
		elements.overlay.hidden = true;
		elements.card.classList.remove("complete");
		document.body.classList.remove("help-tour-open");
		activeTour = null;
		activeIndex = 0;
		completedStepIds = new Set();
		completingTour = false;
		resetTaskState();
		window.removeEventListener("resize", syncPosition);
		window.clearInterval(taskTimer);
		window.clearTimeout(completionReturnTimer);
		taskTimer = null;
		completionReturnTimer = null;
		if (returnToHelp) {
			window.setTimeout(() => openHelpOverlay?.(), 120);
		}
	}

	function completeTourWithCelebration() {
		if (!activeTour || completingTour) return;
		completingTour = true;
		completedStepIds = new Set(activeTour.steps.map((step) => step.id));
		writeCompletedTourId(activeTour.storageId);
		elements.spotlight.style.opacity = "0";
		elements.card.classList.add("complete");
		elements.title.textContent = "You did it";
		elements.body.textContent = `${activeTour.title} is complete. Returning to Help now.`;
		elements.example.hidden = true;
		elements.stepList.innerHTML = "";
		elements.progress.textContent = "Walkthrough completed";
		elements.prevBtn.disabled = true;
		elements.nextBtn.disabled = true;
		elements.nextBtn.textContent = "Done";
		window.clearInterval(taskTimer);
		window.clearTimeout(completionReturnTimer);
		completionReturnTimer = window.setTimeout(() => {
			closeTour({ returnToHelp: true });
		}, 1700);
	}

	function syncPosition() {
		if (!activeTour || completingTour) return;
		const complete = isCurrentStepComplete();
		const step = getCurrentStep();
		if (complete && step) {
			completedStepIds.add(step.id);
		}
		positionTour({
			elements,
			tour: activeTour,
			step: getCurrentStep(),
			index: activeIndex,
			total: activeTour.steps.length,
			complete,
			completedStepIds
		});
		if (complete && activeIndex >= activeTour.steps.length - 1 && !completionReturnTimer) {
			completionReturnTimer = window.setTimeout(() => {
				completeTourWithCelebration();
			}, 500);
		}
	}

	function startTour(tourId) {
		const normalizedTourId = normalizeTourId(tourId);
		const tour = normalizedTourId ? TOUR_DEFINITIONS[normalizedTourId] : null;
		if (!tour) {
			showAppNotice?.("That walkthrough is not available yet.", { title: "Help tour", tone: "warning" });
			return;
		}

		closeHelpOverlay?.();
		activeTour = tour;
		activeIndex = 0;
		completedStepIds = new Set();
		completingTour = false;
		resetTaskState();
		window.clearTimeout(completionReturnTimer);
		completionReturnTimer = null;
		elements.overlay.hidden = false;
		elements.spotlight.style.opacity = "1";
		elements.card.classList.remove("complete");
		document.body.classList.add("help-tour-open");
		window.addEventListener("resize", syncPosition);
		window.clearInterval(taskTimer);
		taskTimer = window.setInterval(syncPosition, 300);
		window.setTimeout(syncPosition, 160);
	}

	elements.overlay.addEventListener("click", (event) => {
		if (event.target.closest("[data-tour-close]")) {
			event.preventDefault();
			closeTour({ returnToHelp: true });
		}
	});

	elements.exampleCopyBtn.addEventListener("click", async (event) => {
		event.preventDefault();
		event.stopPropagation();
		const copied = await copyTextToClipboard(elements.exampleCopyBtn.dataset.copyValue);
		if (!copied) return;
		elements.exampleCopyBtn.classList.add("copied");
		elements.exampleCopyBtn.setAttribute("aria-label", "Copied");
		elements.exampleCopyBtn.title = "Copied";
		window.setTimeout(() => {
			elements.exampleCopyBtn.classList.remove("copied");
			elements.exampleCopyBtn.setAttribute("aria-label", "Copy example");
			elements.exampleCopyBtn.title = "Copy example";
		}, 1000);
	});

	document.addEventListener("focusin", () => {
		const searchEl = document.getElementById("search");
		const active = getDeepActiveElement();
		if (searchEl && (active === searchEl || searchEl.contains(active) || searchEl.shadowRoot?.contains(active))) {
			state.searchFocused = true;
			syncPosition();
		}
	});

	document.getElementById("search")?.addEventListener("click", () => {
		state.searchFocused = true;
		syncPosition();
	});

	document.getElementById("search")?.addEventListener("arcgisSearchComplete", () => {
		state.searchCompleted = true;
		syncPosition();
	});

	document.getElementById("search")?.addEventListener("arcgisSelectResult", () => {
		state.searchCompleted = true;
		syncPosition();
	});

	document.addEventListener("click", (event) => {
		const target = event.target instanceof Element ? event.target : null;
		if (!target) return;
		if (target.closest(".copy-field-btn")) {
			state.copyClicked = true;
			syncPosition();
			return;
		}
		if (target.closest("#rectangleSelectStartBtn")) {
			state.rectangleStarted = true;
			syncPosition();
			return;
		}
		if (target.closest("#viewModeToggle, #viewModeSwitch")) {
			state.viewModeChanged = true;
			syncPosition();
		}
	});

	elements.prevBtn.addEventListener("click", () => {
		if (!activeTour || activeIndex === 0) return;
		window.clearTimeout(completionReturnTimer);
		completionReturnTimer = null;
		activeIndex -= 1;
		syncPosition();
	});

	elements.nextBtn.addEventListener("click", () => {
		if (!activeTour || !isCurrentStepComplete()) return;
		if (activeIndex >= activeTour.steps.length - 1) {
			completeTourWithCelebration();
			return;
		}
		window.clearTimeout(completionReturnTimer);
		completionReturnTimer = null;
		activeIndex += 1;
		syncPosition();
	});

	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape" && activeTour) {
			closeTour({ returnToHelp: true });
		}
		if (event.key === "Enter" && activeTour && getCurrentStep()?.id === "run-search") {
			state.searchCompleted = true;
			syncPosition();
		}
	});

	return { startTour, closeTour };
}
