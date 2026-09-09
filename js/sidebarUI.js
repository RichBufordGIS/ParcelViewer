// Sidebar open/close and resize-pulse logic extracted from main.js.
// Factory: call initSidebarUI(refs) after views are ready.
// Returns { updateLeftSidebarState, openLeftSidebar, updateRightSidebarState }.

/**
 * @param {object} refs
 * @param {Function} refs.getMapView          () => MapView|null
 * @param {Function} refs.getSceneView        () => SceneView|null
 * @param {Element}  refs.leftSidebarShell
 * @param {Element}  refs.leftSidebarToggle
 * @param {Element}  refs.leftSidebarToggleIcon
 * @param {Element}  refs.rightSidebarShell
 * @param {Element}  refs.rightSidebarToggle
 * @param {Element}  refs.rightSidebarToggleIcon
 */
export function initSidebarUI({
	getMapView,
	getSceneView,
	leftSidebarShell,
	leftSidebarToggle,
	leftSidebarToggleIcon,
	rightSidebarShell,
	rightSidebarToggle,
	rightSidebarToggleIcon
}) {
	// ---- Private state -------------------------------------------------------
	let leftSidebarCollapsed = true;
	let rightSidebarCollapsed = true;
	let sidebarResizeTimer = null;
	let viewportResizeTimer = null;

	// ---- Resize pulse --------------------------------------------------------

	function runSidebarResizePulse(durationMs = 560) {
		clearTimeout(sidebarResizeTimer);
		// Fallback for reduced motion or a sidebar whose transition is interrupted.
		sidebarResizeTimer = setTimeout(resizeVisibleViews, durationMs);
	}

	function resizeVisibleViews() {
		clearTimeout(sidebarResizeTimer);
		const insetActive = document.body.classList.contains("inset-3d-active");
		const views = new Set();
		if (document.getElementById("map2d")?.classList.contains("visible") || insetActive) views.add(getMapView());
		if (document.getElementById("scene")?.classList.contains("visible") || insetActive) views.add(getSceneView());
		views.forEach(view => view?.resize?.());
	}

	for (const shell of [leftSidebarShell, rightSidebarShell]) {
		shell?.addEventListener("transitionend", event => {
			if (event.target === shell) resizeVisibleViews();
		});
	}

	// ---- Left sidebar --------------------------------------------------------

	function updateLeftSidebarState() {
		leftSidebarShell.classList.toggle("collapsed", leftSidebarCollapsed);
		leftSidebarToggleIcon.setAttribute(
			"icon",
			leftSidebarCollapsed ? "chevrons-right" : "chevrons-left"
		);
		leftSidebarToggle.title = "Building list";
		leftSidebarToggle.setAttribute("aria-label", "Building list");
		runSidebarResizePulse();
	}

	function openLeftSidebar() {
		if (!leftSidebarCollapsed) return;
		leftSidebarCollapsed = false;
		updateLeftSidebarState();
	}

	function closeLeftSidebar() {
		if (leftSidebarCollapsed) return;
		leftSidebarCollapsed = true;
		updateLeftSidebarState();
	}

	leftSidebarToggle?.addEventListener("click", () => {
		leftSidebarCollapsed = !leftSidebarCollapsed;
		updateLeftSidebarState();
	});

	// ---- Right sidebar -------------------------------------------------------

	function updateRightSidebarState() {
		rightSidebarShell.classList.toggle("collapsed", rightSidebarCollapsed);
		rightSidebarToggleIcon.setAttribute(
			"icon",
			rightSidebarCollapsed ? "chevrons-left" : "chevrons-right"
		);
		rightSidebarToggle.title = "Parcel information";
		rightSidebarToggle.setAttribute("aria-label", "Parcel information");

		runSidebarResizePulse();
	}

	function getRightSidebarCollapsed() {
		return rightSidebarCollapsed;
	}

	function setRightSidebarCollapsed(value) {
		rightSidebarCollapsed = !!value;
	}

	rightSidebarToggle?.addEventListener("click", () => {
		rightSidebarCollapsed = !rightSidebarCollapsed;
		updateRightSidebarState();
	});

	window.addEventListener("resize", () => {
		if (viewportResizeTimer) clearTimeout(viewportResizeTimer);
		viewportResizeTimer = setTimeout(() => {
			runSidebarResizePulse(220);
		}, 120);
	});

	// ---- Initial state -------------------------------------------------------
	updateLeftSidebarState();
	updateRightSidebarState();

	return {
		updateLeftSidebarState,
		openLeftSidebar,
		closeLeftSidebar,
		updateRightSidebarState,
		getRightSidebarCollapsed,
		setRightSidebarCollapsed
	};
}
