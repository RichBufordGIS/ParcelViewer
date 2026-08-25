/**
 * Initializes the 2D measurement popover.
 *
 * @param {object} refs
 * @param {HTMLCalciteButtonElement} refs.measurementBtn2d
 * @param {HTMLCalcitePopoverElement} refs.measurementPopover2d
 * @param {HTMLCalciteButtonElement} refs.measureDistanceBtn2d
 * @param {HTMLCalciteButtonElement} refs.measureAreaBtn2d
 * @param {HTMLElement} refs.measureWidgetContainer2d
 * @param {HTMLElement} refs.distanceMeasure2d
 * @param {HTMLElement} refs.areaMeasure2d
 */
export function initMeasurementTools({
	distanceMeasure2d,
	areaMeasure2d,
	lineMeasure3d,
	areaMeasure3d,
	measure2dLineShell,
	measure2dAreaShell,
	measure2dLineOptionBtn,
	measure2dAreaOptionBtn,
	measure2dStartBtn,
	measure2dStopBtn,
	measure2dSubtitle,
	measure3dLineShell,
	measure3dAreaShell,
	measure3dLineOptionBtn,
	measure3dAreaOptionBtn,
	measure3dStartBtn,
	measure3dStopBtn,
	measure3dSubtitle
}) {
	// ---- Private state --------------------------------------------------------
	let activeMeasure2dTool = "line";
	let activeMeasure3dTool = "line";

	// ---- Helpers --------------------------------------------------------------

	function isMeasurementActive(measureEl) {
		const state = String(measureEl?.state || "").toLowerCase();
		return state === "measuring" || state === "measured";
	}

	function syncMeasurementHintDialogVisibility(measureEl) {
		if (!measureEl) return;

		const maybeToggle = (root) => {
			if (!root?.querySelectorAll) return;
			const candidates = root.querySelectorAll(
				"calcite-notice, calcite-alert, [role='alert'], [role='status'], .hint, .esri-measurement__hint"
			);
			candidates.forEach((el) => {
				const text = String(el?.innerText || el?.textContent || "").toLowerCase();
				const isStartHint =
					text.includes("start measuring") ||
					text.includes("place your first point") ||
					text.includes("clicking in the map") ||
					text.includes("click in the map");
				if (!isStartHint) return;
				el.style.display = "none";
			});
		};

		maybeToggle(measureEl.shadowRoot);
		maybeToggle(measureEl);
	}

	function syncMeasurementInstruction(measureEl, subtitleEl) {
		if (!subtitleEl) return;
		const state = String(measureEl?.state || "").toLowerCase();
		const isMeasuring = state === "measuring";
		const baseText = "Choose a tool, then Start.";
		if (!isMeasuring) {
			subtitleEl.textContent = baseText;
			return;
		}
		const isAreaTool = measureEl === areaMeasure2d || measureEl === areaMeasure3d;
		subtitleEl.textContent = isAreaTool
			? "Click vertices, double-click finish."
			: "Click points, double-click finish.";
	}

	function syncMeasurementShellVisibility2d() {
		if (measure2dLineShell) measure2dLineShell.hidden = true;
		if (measure2dAreaShell) measure2dAreaShell.hidden = true;
	}

	function syncMeasurementShellVisibility3d() {
		if (measure3dLineShell) measure3dLineShell.hidden = true;
		if (measure3dAreaShell) measure3dAreaShell.hidden = true;
	}

	function syncMeasurementPanelButtons(measureEl, startBtn, stopBtn, subtitleEl) {
		if (!startBtn && !stopBtn) return;
		const active = isMeasurementActive(measureEl);
		if (startBtn) {
			startBtn.disabled = active;
			startBtn.hidden = active;
		}
		if (stopBtn) {
			stopBtn.disabled = !active;
			stopBtn.hidden = !active;
		}
		syncMeasurementHintDialogVisibility(measureEl);
		syncMeasurementInstruction(measureEl, subtitleEl);
		syncMeasurementShellVisibility2d();
		syncMeasurementShellVisibility3d();
	}

	async function safeMeasurementStart(measureEl) {
		if (!measureEl?.start) return;
		try {
			await measureEl.componentOnReady?.();
			await measureEl.start();
		} catch (e) {
			console.info("Measurement start failed", e);
		}
	}

	async function safeMeasurementClear(measureEl) {
		if (!measureEl?.clear) return;
		try {
			await measureEl.componentOnReady?.();
			await measureEl.clear();
		} catch (e) {
			console.info("Measurement clear failed", e);
		}
	}

	function getActiveMeasure2dElement() {
		return activeMeasure2dTool === "area" ? areaMeasure2d : distanceMeasure2d;
	}

	function applyMeasure2dToolSelection(tool) {
		activeMeasure2dTool = tool === "area" ? "area" : "line";
		syncMeasurementPanelButtons(
			getActiveMeasure2dElement(),
			measure2dStartBtn,
			measure2dStopBtn,
			measure2dSubtitle
		);
	}

	function getActiveMeasure3dElement() {
		return activeMeasure3dTool === "area" ? areaMeasure3d : lineMeasure3d;
	}

	function applyMeasure3dToolSelection(tool) {
		activeMeasure3dTool = tool === "area" ? "area" : "line";
		syncMeasurementPanelButtons(
			getActiveMeasure3dElement(),
			measure3dStartBtn,
			measure3dStopBtn,
			measure3dSubtitle
		);
	}

	// ---- Wire event listeners ------------------------------------------------

	measure2dLineOptionBtn?.addEventListener?.("click", () => applyMeasure2dToolSelection("line"));
	measure2dAreaOptionBtn?.addEventListener?.("click", () => applyMeasure2dToolSelection("area"));

	measure3dLineOptionBtn?.addEventListener?.("click", () => applyMeasure3dToolSelection("line"));
	measure3dAreaOptionBtn?.addEventListener?.("click", () => applyMeasure3dToolSelection("area"));

	measure2dStartBtn?.addEventListener?.("click", async () => {
		const measureEl = getActiveMeasure2dElement();
		await safeMeasurementStart(measureEl);
		syncMeasurementPanelButtons(measureEl, measure2dStartBtn, measure2dStopBtn, measure2dSubtitle);
	});

	measure2dStopBtn?.addEventListener?.("click", async () => {
		const measureEl = getActiveMeasure2dElement();
		await safeMeasurementClear(measureEl);
		syncMeasurementPanelButtons(measureEl, measure2dStartBtn, measure2dStopBtn, measure2dSubtitle);
	});

	measure3dStartBtn?.addEventListener?.("click", async () => {
		const measureEl = getActiveMeasure3dElement();
		await safeMeasurementStart(measureEl);
		syncMeasurementPanelButtons(measureEl, measure3dStartBtn, measure3dStopBtn, measure3dSubtitle);
	});

	measure3dStopBtn?.addEventListener?.("click", async () => {
		const measureEl = getActiveMeasure3dElement();
		await safeMeasurementClear(measureEl);
		syncMeasurementPanelButtons(measureEl, measure3dStartBtn, measure3dStopBtn, measure3dSubtitle);
	});

	// Keep start/stop in sync when measurement state changes.
	[distanceMeasure2d, areaMeasure2d, lineMeasure3d, areaMeasure3d].forEach((measureEl) => {
		// Default: hide the "Start measuring..." hint until Start is clicked.
		requestAnimationFrame(() => syncMeasurementHintDialogVisibility(measureEl));

		measureEl?.addEventListener?.("arcgisPropertyChange", (event) => {
			if (event?.detail?.name !== "state") return;
			syncMeasurementPanelButtons(
				getActiveMeasure2dElement(),
				measure2dStartBtn,
				measure2dStopBtn,
				measure2dSubtitle
			);
			syncMeasurementPanelButtons(
				getActiveMeasure3dElement(),
				measure3dStartBtn,
				measure3dStopBtn,
				measure3dSubtitle
			);
		});
	});

	// ---- Initial state -------------------------------------------------------
	applyMeasure2dToolSelection("line");
	applyMeasure3dToolSelection("line");
	syncMeasurementShellVisibility2d();
	syncMeasurementShellVisibility3d();
}
