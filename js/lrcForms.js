// LRC (Land Records Change) form logic extracted from main.js.
// Factory: call initLrcForms(refs) after layer refs are ready.
// Returns { openLrcFeatureForm, openMergeLrcFeatureForm } for use in main.js.

/**
 * @param {object} refs
 * @param {Function} refs.getSelectedParcels      () => Feature[]   — live array accessor
 * @param {Function} refs.getLrcRequestLayer      () => FeatureLayer|null
 * @param {Function} refs.getRightSidebarContent  () => Element|null
 * @param {Function} refs.getParcelDisplayName    (feature) => string
 * @param {Function} refs.updateSelectedPanel     () => Promise     — called on Back / after submit
 * @param {Function} refs.buildLrcRequestGeometry () => Geometry|null
 * @param {Function} refs.buildMergeMultipartGeometry () => Geometry|null
 * @param {class}    refs.Graphic                 ArcGIS Graphic class
 */
export function initLrcForms({
	getSelectedParcels,
	getLrcRequestLayer,
	getRightSidebarContent,
	getParcelDisplayName,
	updateSelectedPanel,
	buildLrcRequestGeometry,
	buildMergeMultipartGeometry,
	Graphic
}) {
	// ---- Shared form submit logic --------------------------------------------

	async function submitLrcFeatureForm() {
		const loader = document.getElementById("lrcFormLoader");
		const submitBtn = document.getElementById("submitLrcFormBtn");
		const formEl = document.getElementById("lrcFeatureForm");
		const lrcRequestLayer = getLrcRequestLayer();

		try {
			if (!lrcRequestLayer || !formEl?.feature) {
				alert("Feature form is not ready.");
				return;
			}

			if (loader) loader.hidden = false;
			if (submitBtn) submitBtn.disabled = true;

			const result = await lrcRequestLayer.applyEdits({
				addFeatures: [formEl.feature]
			});

			const addResult = result?.addFeatureResults?.[0];

			if (addResult?.error) {
				alert("Failed to submit request.");
				return;
			}

			alert("Request submitted successfully.");
			updateSelectedPanel();
		} catch {
			alert("Failed to submit request.");
		} finally {
			if (loader) loader.hidden = true;
			if (submitBtn) submitBtn.disabled = false;
		}
	}

	// ---- Shared form element setup ------------------------------------------

	async function setupFormElement(formEl, lrcRequestLayer, prefillAttrs, geometry) {
		await formEl.componentOnReady?.();

		formEl.layer = lrcRequestLayer;
		formEl.formTemplate = lrcRequestLayer.formTemplate;
		formEl.editType = "add";

		const lrcFormFeature = new Graphic({
			layer: lrcRequestLayer,
			geometry,
			attributes: prefillAttrs
		});

		formEl.feature = lrcFormFeature.clone();

		requestAnimationFrame(() => {
			formEl.feature = lrcFormFeature.clone();
		});

		setTimeout(() => {
			formEl.feature = lrcFormFeature.clone();
		}, 50);
	}

	// ---- Split parcel form --------------------------------------------------

	async function openLrcFeatureForm() {
		const lrcRequestLayer = getLrcRequestLayer();
		const rightSidebarContent = getRightSidebarContent();
		const selectedParcels = getSelectedParcels();

		if (!lrcRequestLayer) {
			alert("Land Record Change Request layer was not found in the web map.");
			return;
		}

		const geometry = buildLrcRequestGeometry();

		if (!geometry) {
			alert("Please select at least one parcel.");
			return;
		}

		if (selectedParcels.length !== 1) {
			alert("Split requests require exactly one selected parcel.");
			return;
		}

		const parcelNumber = getParcelDisplayName(selectedParcels[0]);

		rightSidebarContent.innerHTML = `
			<calcite-panel class="calcitepanel" heading="Land Record Change Request" description="Complete the request form">
				<div style="display:flex; justify-content:flex-start; margin-top:10px; padding-left:10px;">
					<calcite-button id="backToParcelInfoBtn" appearance="outline">
						<calcite-icon style="margin-right:6px; color:#007ac2" icon="arrow-bold-left" scale="s"></calcite-icon>Back
					</calcite-button>
				</div>
				<div style="padding:10px;">
					<arcgis-feature-form
						id="lrcFeatureForm"
						group-display="sequential"
						edit-type="add">
					</arcgis-feature-form>

					<div style="display:flex; justify-content:flex-end; margin-top:10px;">
						<calcite-button id="submitLrcFormBtn" appearance="outline" style="min-width:140px; --calcite-button-border-color:#008000;--calcite-button-text-color:#008000;">
							<calcite-icon style="margin-right:6px; color:#008000" icon="check-circle-f" scale="s"></calcite-icon>
							Submit
						</calcite-button>
					</div>

					<calcite-loader id="lrcFormLoader" hidden label="Submitting request"></calcite-loader>
				</div>
			</calcite-panel>
		`;

		const formEl = document.getElementById("lrcFeatureForm");
		if (!formEl) return;

		await setupFormElement(formEl, lrcRequestLayer, {
			name: "",
			company: "",
			email: "",
			phone: "",
			parcelnumber: parcelNumber,
			reqtype: "split",
			status: "Submitted",
			notes: "",
			assigneduser: "",
			submission_type: "",
			mondayid: ""
		}, geometry);

		document.getElementById("backToParcelInfoBtn").onclick = () => {
			updateSelectedPanel();
		};

		document.getElementById("submitLrcFormBtn").onclick = async () => {
			await formEl.submit();
		};

		formEl.addEventListener("arcgisSubmit", async () => {
			await submitLrcFeatureForm();
		});
	}

	// ---- Merge parcel form --------------------------------------------------

	async function openMergeLrcFeatureForm() {
		const lrcRequestLayer = getLrcRequestLayer();
		const rightSidebarContent = getRightSidebarContent();
		const selectedParcels = getSelectedParcels();

		if (!lrcRequestLayer) {
			alert("Land Record Change Request layer was not found in the web map.");
			return;
		}

		if (selectedParcels.length < 2) {
			alert("Merge requests require at least two selected parcels.");
			return;
		}

		const geometry = buildMergeMultipartGeometry();

		if (!geometry) {
			alert("Unable to build multipart geometry from selected parcels.");
			return;
		}

		const parcelNumbers = selectedParcels
			.map((f) => getParcelDisplayName(f))
			.filter(Boolean)
			.join(", ");

		rightSidebarContent.innerHTML = `
			<calcite-panel class="calcitepanel" heading="Merge Parcel Request" description="Complete the request form">
				<div style="display:flex; justify-content:flex-start; margin-top:10px; padding-left:10px;">
					<calcite-button id="backToParcelInfoBtn" appearance="outline">
						<calcite-icon style="margin-right:6px; color:#007ac2" icon="arrow-bold-left" scale="s"></calcite-icon>Back
					</calcite-button>
				</div>

				<div style="padding:10px;">
					<arcgis-feature-form
						id="lrcFeatureForm"
						group-display="sequential"
						edit-type="add">
					</arcgis-feature-form>

					<div style="display:flex; justify-content:flex-end; margin-top:10px;">
						<calcite-button id="submitLrcFormBtn" appearance="outline" style="min-width:140px; --calcite-button-border-color:#008000;--calcite-button-text-color:#008000;">
							<calcite-icon style="margin-right:6px; color:#008000" icon="check-circle-f" scale="s"></calcite-icon>
							Submit
						</calcite-button>
					</div>

					<calcite-loader id="lrcFormLoader" hidden label="Submitting request"></calcite-loader>
				</div>
			</calcite-panel>
		`;

		const formEl = document.getElementById("lrcFeatureForm");
		if (!formEl) return;

		await setupFormElement(formEl, lrcRequestLayer, {
			name: "",
			company: "",
			email: "",
			phone: "",
			parcelnumber: parcelNumbers,
			reqtype: "combine",
			status: "Submitted",
			notes: "",
			assigneduser: "",
			submission_type: "",
			mondayid: ""
		}, geometry);

		document.getElementById("backToParcelInfoBtn").onclick = () => {
			updateSelectedPanel();
		};

		document.getElementById("submitLrcFormBtn").onclick = async () => {
			await formEl.submit();
		};

		formEl.addEventListener("arcgisSubmit", async () => {
			await submitLrcFeatureForm();
		});
	}

	return { openLrcFeatureForm, openMergeLrcFeatureForm };
}
