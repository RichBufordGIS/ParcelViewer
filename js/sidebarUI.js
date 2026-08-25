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
	let sidebarResizePulseId = 0;
	let rightSidebarResizeTimer = null;
	let viewportResizeTimer = null;

	// ---- Resize pulse --------------------------------------------------------

	function runSidebarResizePulse(durationMs = 560) {
		const startedAt = performance.now();

		if (sidebarResizePulseId) {
			cancelAnimationFrame(sidebarResizePulseId);
			sidebarResizePulseId = 0;
		}

		const step = (now) => {
			getMapView()?.resize?.();
			getSceneView()?.resize?.();

			if (now - startedAt < durationMs) {
				sidebarResizePulseId = requestAnimationFrame(step);
				return;
			}

			sidebarResizePulseId = 0;
			getMapView()?.resize?.();
			getSceneView()?.resize?.();
		};

		sidebarResizePulseId = requestAnimationFrame(step);
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

		if (rightSidebarResizeTimer) clearTimeout(rightSidebarResizeTimer);
		runSidebarResizePulse();
		rightSidebarResizeTimer = setTimeout(() => {
			getMapView()?.resize?.();
			getSceneView()?.resize?.();
		}, 520);
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
		updateRightSidebarState,
		getRightSidebarCollapsed,
		setRightSidebarCollapsed
	};
}
