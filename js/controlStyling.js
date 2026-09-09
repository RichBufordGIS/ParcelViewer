// Interactive control label sync and widget active-state styling extracted from main.js.
// Call initControlStyling(refs) once after the DOM and map views are ready.
// The module wires all observers and event listeners internally and returns
// { syncWidgetActiveStates } for external callers that need to force a resync.

import { normalizeTooltipText, humanizeControlId } from "./utils.js";

/**
 * @param {object}   refs
 * @param {Element}  refs.viewModeSwitch          calcite-switch or <input> for 2D/3D toggle
 * @param {Element}  refs.rectangleSelectBtn
 * @param {Element}  refs.rectangleToolPopover
 * @param {Element}  refs.rectangleSelectStartBtn
 * @param {Element}  refs.rectangleSelectStopBtn
 * @param {Function} refs.getRectangleSelectionActive  () => boolean
 * @param {Element}  refs.zoomInBtn2d
 * @param {Element}  refs.zoomOutBtn2d
 * @param {Element}  refs.zoomInBtn3d
 * @param {Element}  refs.zoomOutBtn3d
 * @param {Element}  refs.home2d
 * @param {Element}  refs.home3d
 * @param {Element}  refs.compass2d
 * @param {Element}  refs.compass3d
 * @param {Element}  refs.navigationToggle3d
 */
export function initControlStyling({
	viewModeSwitch,
	rectangleSelectBtn,
	rectangleToolPopover,
	rectangleSelectStartBtn,
	rectangleSelectStopBtn,
	getRectangleSelectionActive,
	zoomInBtn2d,
	zoomOutBtn2d,
	zoomInBtn3d,
	zoomOutBtn3d,
	home2d,
	home3d,
	compass2d,
	compass3d,
	navigationToggle3d
}) {
	// ---- Constants -----------------------------------------------------------

	const INTERACTIVE_TOOLTIP_SELECTOR = [
		"button",
		"calcite-button",
		"calcite-switch",
		"calcite-action",
		"calcite-fab",
		"a.help-action-btn",
		"a.help-tool-action-btn",
		"[role='button']",
		"arcgis-expand",
		"arcgis-home",
		"arcgis-locate",
		"arcgis-compass",
		"arcgis-navigation-toggle",
		"arcgis-zoom"
	].join(",");

	const CONTROL_LABEL_OVERRIDES = {
		settingsBtn: "Settings",
		helpBtn: "Help and updates",
		leftSidebarToggle: "Building list",
		rightSidebarToggle: "Parcel information",
		viewModeSwitch: "Toggle 2D and 3D view",
		rectangleSelectBtn: "Select by rectangle",
		zoomInBtn2d: "Zoom in",
		zoomOutBtn2d: "Zoom out",
		zoomInBtn3d: "Zoom in",
		zoomOutBtn3d: "Zoom out",
		authPrimaryBtn: "Sign In",
		helpCloseBtn: "Close help",
		helpIssueBtn: "Public ticket submission coming soon",
		openLrcFormBtnSingle: "Open split parcel request form",
		openMergeLrcFormBtn: "Open combine parcel request form",
		backToParcelInfoBtn: "Back to parcel information",
		submitLrcFormBtn: "Submit request",
		rightSidebarClearSelectedParcelsButton: "Clear all selected parcels"
	};

	// ---- Label helpers -------------------------------------------------------

	function deriveArcgisControlLabel(element) {
		if (!element) return "";
		if (element.matches("arcgis-home")) return "Home";
		if (element.matches("arcgis-locate")) return "Locate";
		if (element.matches("arcgis-compass")) return "Compass";
		if (element.matches("arcgis-navigation-toggle")) return "Navigation toggle";
		if (element.matches("arcgis-zoom")) return "Zoom controls";

		if (element.matches("arcgis-expand")) {
			if (element.querySelector("arcgis-basemap-gallery")) return "Basemap selector";
			if (element.querySelector("arcgis-layer-list")) return "Layer list";
			const hasDistanceMeasure = !!element.querySelector(
				"arcgis-distance-measurement-2d, arcgis-direct-line-measurement-3d"
			);
			const hasAreaMeasure = !!element.querySelector(
				"arcgis-area-measurement-2d, arcgis-area-measurement-3d"
			);
			if (hasDistanceMeasure && hasAreaMeasure) return "Measurement tools";
			if (element.querySelector("arcgis-area-measurement-2d, arcgis-area-measurement-3d"))
				return "Area measurement";
			if (element.querySelector("arcgis-direct-line-measurement-3d"))
				return "Direct line measurement";
			if (element.querySelector(".measure3d-panel"))
				return normalizeTooltipText(element.getAttribute("tooltip")) || "Measurement tools";
			if (element.querySelector("calcite-card")) return "Testing guidance";
			if (element.getAttribute("expand-icon") === "measure-area") return "Area measurement";
			if (element.getAttribute("expand-icon") === "measure") return "Direct line measurement";
			if (element.getAttribute("expand-icon") === "information") return "Testing guidance";
		}

		return "";
	}

	function syncArcgisExpandShadowLabel(element, label) {
		if (!element?.matches?.("arcgis-expand") || !label) return;
		const shadowRoot = element.shadowRoot;
		if (!shadowRoot) return;
		const innerControls = shadowRoot.querySelectorAll("button, calcite-action, [role='button']");
		innerControls.forEach((control) => {
			control.setAttribute("aria-label", label);
			control.setAttribute("title", label);
			control.setAttribute("tooltip", label);
		});
	}

	function deriveInteractiveLabel(element) {
		if (!element) return "";

		const explicit = normalizeTooltipText(
			element.getAttribute("data-tooltip-label") ||
				element.getAttribute("aria-label") ||
				element.getAttribute("title") ||
				element.getAttribute("tooltip")
		);
		if (explicit) return explicit;

		if (element.id && CONTROL_LABEL_OVERRIDES[element.id]) {
			return CONTROL_LABEL_OVERRIDES[element.id];
		}

		if (element.classList?.contains("remove-button")) return "Remove selected parcel";

		const arcgisLabel = deriveArcgisControlLabel(element);
		if (arcgisLabel) return arcgisLabel;

		const iconStart = normalizeTooltipText(element.getAttribute("icon-start"));
		if (iconStart === "plus") return "Zoom in";
		if (iconStart === "minus") return "Zoom out";
		if (iconStart === "cursor-selection") return "Select by rectangle";

		const text = normalizeTooltipText(element.innerText || element.textContent || "");
		if (text) return text;

		if (element.id) return humanizeControlId(element.id);

		return "";
	}

	function syncInteractiveControlLabels(root = document) {
		const elements = [];
		if (root instanceof Element && root.matches?.(INTERACTIVE_TOOLTIP_SELECTOR)) {
			elements.push(root);
		}
		elements.push(...(root.querySelectorAll?.(INTERACTIVE_TOOLTIP_SELECTOR) || []));

		elements.forEach((element) => {
			const label = deriveInteractiveLabel(element);
			if (!label) return;

			if (!normalizeTooltipText(element.getAttribute("aria-label"))) {
				element.setAttribute("aria-label", label);
			}

			if (!normalizeTooltipText(element.getAttribute("title"))) {
				element.setAttribute("title", label);
			}

			if (
				element.matches("arcgis-expand") &&
				!normalizeTooltipText(element.getAttribute("tooltip"))
			) {
				element.setAttribute("tooltip", label);
			}

			if (element.matches("arcgis-expand")) {
				syncArcgisExpandShadowLabel(element, label);
			}
		});

		if (viewModeSwitch && !normalizeTooltipText(viewModeSwitch.getAttribute("aria-label"))) {
			viewModeSwitch.setAttribute("aria-label", "Toggle 2D and 3D view");
		}
	}

	// ---- Active state helpers ------------------------------------------------

	function syncExpandActiveIconState(expandEl) {
		if (!expandEl?.matches?.("arcgis-expand")) return;

		const activeColor =
			getComputedStyle(document.documentElement)
				.getPropertyValue("--tabs-active-color")
				.trim() || "#32d5ff";
		const isActive = expandEl.hasAttribute("expanded") || expandEl.expanded === true;
		const shadowRoot = expandEl.shadowRoot;
		if (!shadowRoot) return;

		if (expandEl.classList?.contains("panel-expand")) {
			expandEl.style.setProperty("--calcite-popover-background-color", "transparent");
			expandEl.style.setProperty("--calcite-popover-border-color", "transparent");
			expandEl.style.setProperty("--calcite-popover-corner-radius", "16px");
		}

		try {
			const popovers = shadowRoot.querySelectorAll("calcite-popover, calcite-popover-edge");
			popovers.forEach((popover) => {
				const panelSurface =
					"linear-gradient(180deg, rgba(15,34,63,0.96) 0%, rgba(8,19,36,0.96) 100%)";
				try {
					popover.setAttribute("pointer-disabled", "");
				} catch { }
				popover.style.background = panelSurface;
				popover.style.border = "0";
				popover.style.boxShadow = "none";
				popover.style.padding = "0";
				popover.style.setProperty("--calcite-popover-background-color", "transparent");
				popover.style.setProperty("--calcite-popover-border-color", "transparent");
				popover.style.setProperty("--calcite-popover-corner-radius", "16px");

				const popoverShadow = popover.shadowRoot;
				if (!popoverShadow) return;
				const surfaces = popoverShadow.querySelectorAll(
					"[part='content'],[part='container'],[part='popover-content'],[part='popover'],[part='tip'],[part='arrow'],[part='pointer']"
				);
				surfaces.forEach((surface) => {
					surface.style.background = panelSurface;
					surface.style.border = "0";
					surface.style.boxShadow = "none";
					surface.style.padding = "0";
				});
			});
		} catch { }

		if (expandEl.classList?.contains("panel-expand")) {
			try {
				const parts = shadowRoot.querySelectorAll(
					"[part='content'],[part='panel'],[part='container'],[part='popover-content'],[part='popover']"
				);
				parts.forEach((el) => {
					el.style.background = "transparent";
					el.style.border = "0";
					el.style.boxShadow = "none";
					el.style.padding = "0";
				});
			} catch { }
		}

		const actionEl = shadowRoot.querySelector("calcite-action");
		if (actionEl) {
			actionEl.style.color = isActive ? activeColor : "";
			actionEl.style.setProperty("--calcite-action-text-color", isActive ? activeColor : "");
			actionEl.style.setProperty("--calcite-ui-icon-color", isActive ? activeColor : "");
			actionEl.style.setProperty("--calcite-icon-color", isActive ? activeColor : "");
			actionEl.style.filter = "";
		}

		const icons = shadowRoot.querySelectorAll("calcite-icon");
		icons.forEach((icon) => {
			const iconName = String(icon.getAttribute("icon") || "").toLowerCase();
			const isChevron = iconName.includes("chevron");
			if (isChevron) {
				icon.style.color = "";
				icon.style.filter = "";
				return;
			}
			icon.style.color = isActive ? activeColor : "";
			icon.style.filter = "";
		});
	}

	function syncWidgetActiveStates() {
		document
			.querySelectorAll("arcgis-expand")
			.forEach((expandEl) => syncExpandActiveIconState(expandEl));

		const rectanglePopoverOpen = !!rectangleToolPopover?.open;
		rectangleSelectBtn?.classList.toggle(
			"widget-active-trigger",
			getRectangleSelectionActive() || rectanglePopoverOpen
		);

		if (rectangleSelectStartBtn) {
			rectangleSelectStartBtn.disabled = getRectangleSelectionActive();
			rectangleSelectStartBtn.hidden = getRectangleSelectionActive();
		}
		if (rectangleSelectStopBtn) {
			rectangleSelectStopBtn.disabled = !getRectangleSelectionActive();
			rectangleSelectStopBtn.hidden = !getRectangleSelectionActive();
		}
	}

	function setTransientActiveStyle(element, isActive) {
		if (!element?.classList) return;
		element.classList.toggle("widget-active-trigger", !!isActive);
	}

	function flashActiveStyle(element, durationMs = 240) {
		if (!element) return;
		setTransientActiveStyle(element, true);
		window.setTimeout(() => setTransientActiveStyle(element, false), durationMs);
	}

	function attachPressFlash(element, { releaseDelayMs = 160 } = {}) {
		if (!element?.addEventListener) return;
		let pressed = false;
		const release = () => {
			if (!pressed) return;
			pressed = false;
			window.setTimeout(() => setTransientActiveStyle(element, false), releaseDelayMs);
		};
		element.addEventListener("pointerdown", () => {
			pressed = true;
			setTransientActiveStyle(element, true);
		});
		element.addEventListener("pointerup", release);
		element.addEventListener("pointercancel", release);
		element.addEventListener("pointerleave", release);
		element.addEventListener("keydown", (event) => {
			if (event.key !== "Enter" && event.key !== " ") return;
			flashActiveStyle(element);
		});
	}

	function syncCompassSelectedState(compassEl) {
		if (!compassEl) return;
		const z = compassEl?.orientation?.z;
		const heading = compassEl?.heading;
		const rotation = compassEl?.rotation;
		const zActive = typeof z === "number" && Math.abs(z) > 0.001;
		const headingActive = typeof heading === "number" && Math.abs(heading) > 0.001;
		const rotationActive = typeof rotation === "number" && Math.abs(rotation) > 0.001;
		const isActive = zActive || headingActive || rotationActive;

		setTransientActiveStyle(compassEl, isActive);

		const shadowRoot = compassEl.shadowRoot;
		if (!shadowRoot) return;
		const activeColor =
			getComputedStyle(document.documentElement)
				.getPropertyValue("--tabs-active-color")
				.trim() || "#32d5ff";

		shadowRoot.querySelectorAll("calcite-action, calcite-button").forEach((control) => {
			control.style.color = isActive ? activeColor : "";
			control.style.setProperty(
				"--calcite-action-text-color",
				isActive ? activeColor : ""
			);
			control.style.setProperty("--calcite-ui-icon-color", isActive ? activeColor : "");
			control.style.setProperty("--calcite-icon-color", isActive ? activeColor : "");
			control.style.setProperty(
				"--calcite-button-icon-color",
				isActive ? activeColor : ""
			);
			control.style.filter = "";
		});

		shadowRoot.querySelectorAll("calcite-icon").forEach((icon) => {
			icon.style.color = isActive ? activeColor : "";
			icon.style.filter = "";
		});
	}

	function syncNavigationToggleSelectedState(toggleEl) {
		if (!toggleEl) return;
		const mode = String(toggleEl?.navigationMode || "").toLowerCase();
		setTransientActiveStyle(toggleEl, mode === "rotate");
	}

	function wireHomeSelectedState(homeEl) {
		if (!homeEl?.addEventListener) return;
		homeEl.addEventListener("arcgisGo", () => setTransientActiveStyle(homeEl, true));
		homeEl.addEventListener("arcgisPropertyChange", (event) => {
			if (event?.detail?.name !== "state") return;
			const state = String(homeEl?.state || "").toLowerCase();
			if (state === "ready") setTransientActiveStyle(homeEl, false);
		});
		homeEl.addEventListener("click", () => flashActiveStyle(homeEl));
	}

	// ---- Calcite popover surface stripping ----------------------------------

	function stripCalcitePopoverSurface(popoverEl) {
		if (!popoverEl) return;
		const tagName = String(popoverEl.tagName || "").toLowerCase();
		if (tagName !== "calcite-popover" && tagName !== "calcite-popover-edge") return;

		try {
			popoverEl.setAttribute("pointer-disabled", "");
		} catch { }

		const panelSurface =
			"linear-gradient(180deg, rgba(15,34,63,0.96) 0%, rgba(8,19,36,0.96) 100%)";
		popoverEl.style.background = panelSurface;
		popoverEl.style.border = "0";
		popoverEl.style.boxShadow = "none";
		popoverEl.style.padding = "0";
		popoverEl.style.setProperty("--calcite-popover-background-color", "transparent");
		popoverEl.style.setProperty("--calcite-popover-border-color", "transparent");
		popoverEl.style.setProperty("--calcite-popover-corner-radius", "16px");

		const shadow = popoverEl.shadowRoot;
		if (!shadow) return;
		shadow
			.querySelectorAll(
				"[part='container'],[part='content'],[part='popover-content'],[part='popover'],[part='tip'],[part='arrow'],[part='pointer']"
			)
			.forEach((el) => {
				el.style.background = panelSurface;
				el.style.border = "0";
				el.style.boxShadow = "none";
				el.style.padding = "0";
			});
	}

	// ---- arcgis-expand chrome observers -------------------------------------

	const observedExpands = new WeakSet();

	function wireExpandChromeObservers(root = document) {
		const expands = [];
		if (root instanceof Element && root.matches?.("arcgis-expand")) expands.push(root);
		expands.push(...(root.querySelectorAll?.("arcgis-expand") || []));

		expands.forEach((expandEl) => {
			if (observedExpands.has(expandEl)) return;
			observedExpands.add(expandEl);

			const observer = new MutationObserver((mutations) => {
				for (const m of mutations) {
					if (m.type !== "attributes") continue;
					if (m.attributeName !== "expanded") continue;
					requestAnimationFrame(() => syncExpandActiveIconState(expandEl));
					window.setTimeout(() => syncExpandActiveIconState(expandEl), 60);
				}
			});
			observer.observe(expandEl, { attributes: true, attributeFilter: ["expanded"] });

			requestAnimationFrame(() => syncExpandActiveIconState(expandEl));
			window.setTimeout(() => syncExpandActiveIconState(expandEl), 60);
		});
	}

	// ---- MutationObserver for new nodes -------------------------------------

	let observerStarted = false;
	function startInteractiveControlLabelObserver() {
		if (observerStarted || !document.body) return;
		observerStarted = true;

		let scheduled = false;
		const scheduleSync = (root = document) => {
			if (scheduled) return;
			scheduled = true;
			requestAnimationFrame(() => {
				scheduled = false;
				syncInteractiveControlLabels(root);
				syncWidgetActiveStates();
			});
		};

		syncInteractiveControlLabels(document);
		syncWidgetActiveStates();

		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				mutation.addedNodes.forEach((node) => {
					if (node instanceof Element) scheduleSync(node);
				});
			}
		});

		observer.observe(document.body, { childList: true, subtree: true });
	}

	// ---- Wire everything -----------------------------------------------------

	startInteractiveControlLabelObserver();
	wireExpandChromeObservers(document);

	document.addEventListener(
		"calcitePopoverBeforeOpen",
		(event) => {
			const target = event?.target;
			stripCalcitePopoverSurface(target);
			try {
				if (target instanceof Element) {
					stripCalcitePopoverSurface(
						target.closest?.("calcite-popover, calcite-popover-edge")
					);
				}
			} catch { }
		},
		true
	);

	document.addEventListener(
		"calcitePopoverOpen",
		(event) => {
			const target = event?.target;
			stripCalcitePopoverSurface(target);
			try {
				if (target instanceof Element) {
					stripCalcitePopoverSurface(
						target.closest?.("calcite-popover, calcite-popover-edge")
					);
				}
			} catch { }
		},
		true
	);

	try {
		const popoverObserver = new MutationObserver((mutations) => {
			for (const m of mutations) {
				m.addedNodes?.forEach?.((node) => {
					if (!(node instanceof Element)) return;
					if (node.matches?.("calcite-popover, calcite-popover-edge")) {
						stripCalcitePopoverSurface(node);
						return;
					}
					node.querySelectorAll?.("calcite-popover, calcite-popover-edge")?.forEach?.((el) =>
						stripCalcitePopoverSurface(el)
					);
				});
			}
		});
		popoverObserver.observe(document.body, { childList: true, subtree: true });
	} catch { }

	try {
		const expandRootObserver = new MutationObserver((mutations) => {
			for (const m of mutations) {
				m.addedNodes?.forEach?.((node) => {
					if (!(node instanceof Element)) return;
					wireExpandChromeObservers(node);
					styleBasemapGalleryShadowRoots(node);
				});
			}
		});
		expandRootObserver.observe(document.body, { childList: true, subtree: true });
	} catch { }

	document.addEventListener(
		"click",
		() => requestAnimationFrame(syncWidgetActiveStates),
		true
	);

	document.addEventListener(
		"arcgisPropertyChange",
		(event) => {
			const target = event?.target;
			if (!(target instanceof Element)) return;
			if (!target.matches?.("arcgis-expand")) return;
			if (event?.detail?.name !== "expanded") return;
			requestAnimationFrame(() => syncExpandActiveIconState(target));
		},
		true
	);

	// Rectangle popover re-syncs active state on open/close
	["calcitePopoverBeforeOpen", "calcitePopoverOpen", "calcitePopoverBeforeClose", "calcitePopoverClose"].forEach(
		(eventName) => rectangleToolPopover?.addEventListener?.(eventName, () => syncWidgetActiveStates())
	);

	// Press flash + home/compass/navigation wiring
	attachPressFlash(zoomInBtn2d);
	attachPressFlash(zoomOutBtn2d);
	attachPressFlash(zoomInBtn3d);
	attachPressFlash(zoomOutBtn3d);

	wireHomeSelectedState(home2d);
	wireHomeSelectedState(home3d);

	syncCompassSelectedState(compass2d);
	syncCompassSelectedState(compass3d);

	compass2d?.addEventListener?.("arcgisPropertyChange", (event) => {
		if (event?.detail?.name !== "orientation" && event?.detail?.name !== "state") return;
		syncCompassSelectedState(compass2d);
	});
	compass3d?.addEventListener?.("arcgisPropertyChange", (event) => {
		if (event?.detail?.name !== "orientation" && event?.detail?.name !== "state") return;
		syncCompassSelectedState(compass3d);
	});
	compass2d?.addEventListener?.("click", () => flashActiveStyle(compass2d));
	compass3d?.addEventListener?.("click", () => flashActiveStyle(compass3d));

	syncNavigationToggleSelectedState(navigationToggle3d);
	navigationToggle3d?.addEventListener?.("arcgisPropertyChange", (event) => {
		if (event?.detail?.name !== "state" && event?.detail?.name !== "layout") return;
		syncNavigationToggleSelectedState(navigationToggle3d);
	});
	navigationToggle3d?.addEventListener?.("click", () => {
		requestAnimationFrame(() => syncNavigationToggleSelectedState(navigationToggle3d));
	});

	if (navigationToggle3d) {
		const navToggleObserver = new MutationObserver(() =>
			syncNavigationToggleSelectedState(navigationToggle3d)
		);
		navToggleObserver.observe(navigationToggle3d, {
			attributes: true,
			attributeFilter: ["navigation-mode"]
		});
	}

	return { syncWidgetActiveStates };
}
