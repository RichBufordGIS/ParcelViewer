// Page-switching, active-tab management, and lazy map loading extracted from main.js.
// Call initPageNavigation(refs) after tab button DOM elements are available.
// Returns { switchPage, setActivePageTab, ensureMapLoaded }.

/**
 * @param {object}    refs
 * @param {Function}  refs.getAccessiblePageKeys  () => string[]
 * @param {Function}  refs.getCurrentPage         () => string
 * @param {Function}  refs.setCurrentPage         (pageName: string) => void
 * @param {Function}  refs.getSearchController    () => searchController|null
 * @param {Function}  refs.getMapView             () => MapView|null
 * @param {Function}  refs.getSceneView           () => SceneView|null
 * @param {Function}  refs.getInitSpecialAssessment  () => Function  — the SA lazy-init function
 *
 * Page container elements:
 * @param {Element}   refs.pageParcel
 * @param {Element}   refs.pagePW
 * @param {Element}   refs.pageSA
 *
 * Tab button elements:
 * @param {Element}   refs.parcelViewerTabBtn
 * @param {Element}   refs.publicWorksTabBtn
 * @param {Element}   refs.specialAssessTabBtn
 */
export function initPageNavigation({
	getAccessiblePageKeys,
	getCurrentPage,
	setCurrentPage,
	getSearchController,
	getMapView,
	getSceneView,
	getInitSpecialAssessment,
	onMapLoaded,

	pageParcel,
	pagePW,
	pageSA,

	parcelViewerTabBtn,
	publicWorksTabBtn,
	specialAssessTabBtn
}) {
	// ---- Private state -------------------------------------------------------
	let pwLoaded = false;
	let saLoaded = false;
	let saModuleInitPromise = null;

	const tabButtons = [parcelViewerTabBtn, publicWorksTabBtn, specialAssessTabBtn].filter(Boolean);

	// ---- Active-tab UI -------------------------------------------------------

	function setActivePageTab(btn) {
		tabButtons.forEach((b) => {
			const on = b === btn;
			b.classList.toggle("active", on);
			b.setAttribute("aria-selected", on ? "true" : "false");
			b.tabIndex = on ? 0 : -1;
		});
	}

	// ---- Keyboard navigation (roving tabindex) --------------------------------

	function getEnabledTabButtons() {
		return tabButtons.filter((button) => {
			if (!button) return false;
			if (button.hasAttribute("hidden")) return false;
			if (button.getAttribute("aria-disabled") === "true") return false;
			return true;
		});
	}

	function focusTabButton(btn) {
		try { btn?.focus?.(); } catch {}
	}

	tabButtons.forEach((button) => {
		button?.addEventListener?.("keydown", (event) => {
			const enabledTabs = getEnabledTabButtons();
			if (enabledTabs.length === 0) return;

			const currentIndex = Math.max(0, enabledTabs.indexOf(event.currentTarget));
			let nextIndex = currentIndex;

			if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % enabledTabs.length;
			else if (event.key === "ArrowLeft")
				nextIndex = (currentIndex - 1 + enabledTabs.length) % enabledTabs.length;
			else if (event.key === "Home") nextIndex = 0;
			else if (event.key === "End") nextIndex = enabledTabs.length - 1;
			else if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				event.currentTarget.click();
				return;
			} else return;

			event.preventDefault();
			focusTabButton(enabledTabs[nextIndex]);
			enabledTabs[nextIndex].click();
		});
	});

	// ---- Lazy map loading ----------------------------------------------------

	function getSAMapView() {
		return document.getElementById("saMap")?.view || null;
	}

	function getPWMapView() {
		return document.getElementById("pwMap")?.view || null;
	}

	async function ensureMapLoaded(mapId, flagName) {
		const el = document.getElementById(mapId);
		if (!el) return;

		if (flagName === "pw" && pwLoaded) return;
		if (flagName === "sa" && saLoaded) return;

		if (flagName === "sa" && !saModuleInitPromise) {
			const initSA = getInitSpecialAssessment();
			if (initSA) saModuleInitPromise = initSA();
		}

		if (flagName === "sa" && saModuleInitPromise) {
			await saModuleInitPromise;
		}

		try {
			await Promise.race([
				el.viewOnReady(),
				new Promise((_, reject) =>
					setTimeout(
						() =>
							reject(
								new Error(`${flagName} viewOnReady timeout after 15000ms`)
							),
						15000
					)
				)
			]);
		} catch (err) {
			throw err;
		}

		el.view?.resize?.();

		if (flagName === "pw") {
			pwLoaded = true;
			onMapLoaded?.("pw");
		}
		if (flagName === "sa") {
			saLoaded = true;
			onMapLoaded?.("sa");
		}
	}

	// ---- Page switching ------------------------------------------------------

	async function switchPage(pageName) {
		const keys = getAccessiblePageKeys();
		if (!keys.includes(pageName)) {
			return;
		}

		setCurrentPage(pageName);

		pageParcel.classList.toggle("visible", pageName === "parcel");
		pagePW.classList.toggle("visible", pageName === "pw");
		pageSA.classList.toggle("visible", pageName === "sa");

		if (pageName === "parcel") setActivePageTab(parcelViewerTabBtn);
		if (pageName === "pw") setActivePageTab(publicWorksTabBtn);
		if (pageName === "sa") setActivePageTab(specialAssessTabBtn);

		const searchController = getSearchController();
		if (searchController) {
			if (pageName === "parcel") await searchController.setParcelViewerSearch();
			if (pageName === "pw") await searchController.setPWSearch();
			if (pageName === "sa") await searchController.setSASearch();
		}

		try {
			if (pageName === "pw") await ensureMapLoaded("pwMap", "pw");
			if (pageName === "sa") await ensureMapLoaded("saMap", "sa");
		} catch {}

		const mapView = getMapView();
		const sceneView = getSceneView();

		if (pageName === "parcel") {
			sceneView?.resize?.();
			mapView?.resize?.();
		}

		if (pageName === "pw") getPWMapView()?.resize?.();
		if (pageName === "sa") getSAMapView()?.resize?.();
	}

	// ---- Wire tab click handlers --------------------------------------------

	parcelViewerTabBtn?.addEventListener("click", () => switchPage("parcel"));
	publicWorksTabBtn?.addEventListener("click", () => switchPage("pw"));
	specialAssessTabBtn?.addEventListener("click", () => switchPage("sa"));

	return {
		switchPage,
		setActivePageTab,
		ensureMapLoaded
	};
}
