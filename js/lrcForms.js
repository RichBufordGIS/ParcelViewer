import { notifyError, notifyWarning, notifySuccess, reportError } from "./errorUX.js";
// LRC (Land Records Change) form workflow logic.
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
export function initLrcForms({ getSelectedParcels, getLrcRequestLayer, getRightSidebarContent, getParcelDisplayName, updateSelectedPanel, buildLrcRequestGeometry, buildMergeMultipartGeometry, Graphic }) {
    // ---- Shared form submit logic --------------------------------------------
    async function submitLrcFeatureForm() {
        const loader = document.getElementById("lrcFormLoader");
        const submitBtn = document.getElementById("submitLrcFormBtn");
        const formEl = document.getElementById("lrcFeatureForm");
        const lrcRequestLayer = getLrcRequestLayer();
        try {
            if (!lrcRequestLayer || !formEl?.feature) {
                notifyWarning("Feature form is not ready yet. Please try again.", { title: "Request form not ready" });
                return;
            }
            if (loader)
                loader.hidden = false;
            if (submitBtn)
                submitBtn.disabled = true;
            const result = await lrcRequestLayer.applyEdits({
                addFeatures: [formEl.feature]
            });
            const addResult = result?.addFeatureResults?.[0];
            if (addResult?.error) {
                reportError("Land Record Change request returned an edit error", addResult.error, { userMessage: "Failed to submit the request. Please try again.", title: "Request not submitted" });
                return;
            }
            notifySuccess("The Land Record Change request was submitted successfully.", { title: "Request submitted" });
            updateSelectedPanel();
        }
        catch (error) {
            reportError("Land Record Change request submission failed", error, { userMessage: "Failed to submit the request. Please try again.", title: "Request not submitted" });
        }
        finally {
            if (loader)
                loader.hidden = true;
            if (submitBtn)
                submitBtn.disabled = false;
        }
    }
    // ---- Shared form element setup ------------------------------------------
    async function setupFormElement(formEl, lrcRequestLayer, prefillAttrs, geometry) {
        // Wait on the actual component and layer readiness contracts. Once both are ready,
        // a single feature assignment is sufficient; no render-race retry timers are needed.
        await Promise.all([
            formEl.componentOnReady?.(),
            lrcRequestLayer.load?.()
        ]);
        formEl.layer = lrcRequestLayer;
        formEl.formTemplate = lrcRequestLayer.formTemplate;
        formEl.editType = "add";
        const lrcFormFeature = new Graphic({
            layer: lrcRequestLayer,
            geometry,
            attributes: prefillAttrs
        });
        formEl.feature = lrcFormFeature;
    }
    // ---- Split parcel form --------------------------------------------------
    async function openLrcFeatureForm() {
        const lrcRequestLayer = getLrcRequestLayer();
        const rightSidebarContent = getRightSidebarContent();
        const selectedParcels = getSelectedParcels();
        if (!lrcRequestLayer) {
            notifyError("The Land Record Change Request layer is unavailable in the current map.", { title: "Request layer unavailable" });
            return;
        }
        const geometry = buildLrcRequestGeometry();
        if (!geometry) {
            notifyWarning("Please select at least one parcel before creating a request.", { title: "Parcel selection required" });
            return;
        }
        if (selectedParcels.length !== 1) {
            notifyWarning("Split requests require exactly one selected parcel.", { title: "Select one parcel" });
            return;
        }
        const parcelNumber = getParcelDisplayName(selectedParcels[0]);
        rightSidebarContent.innerHTML = `
            <calcite-panel class="calcitepanel" heading="Land Record Change Request" description="Complete the request form">
                <div style="display:flex; justify-content:flex-start; margin-top:10px; padding-left:10px;">
                    <calcite-button id="backToParcelInfoBtn" appearance="outline">
                        <calcite-icon preload style="margin-right:6px; color:#007ac2" icon="arrow-bold-left" scale="s"></calcite-icon>Back
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
                            <calcite-icon preload style="margin-right:6px; color:#008000" icon="check-circle-f" scale="s"></calcite-icon>
                            Submit
                        </calcite-button>
                    </div>

                    <calcite-loader id="lrcFormLoader" hidden label="Submitting request"></calcite-loader>
                </div>
            </calcite-panel>
        `;
        const formEl = document.getElementById("lrcFeatureForm");
        if (!formEl)
            return;
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
            notifyError("The Land Record Change Request layer is unavailable in the current map.", { title: "Request layer unavailable" });
            return;
        }
        if (selectedParcels.length < 2) {
            notifyWarning("Merge requests require at least two selected parcels.", { title: "Select multiple parcels" });
            return;
        }
        const geometry = buildMergeMultipartGeometry();
        if (!geometry) {
            notifyError("Unable to build the merge geometry from the selected parcels.", { title: "Merge geometry failed" });
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
                        <calcite-icon preload style="margin-right:6px; color:#007ac2" icon="arrow-bold-left" scale="s"></calcite-icon>Back
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
                            <calcite-icon preload style="margin-right:6px; color:#008000" icon="check-circle-f" scale="s"></calcite-icon>
                            Submit
                        </calcite-button>
                    </div>

                    <calcite-loader id="lrcFormLoader" hidden label="Submitting request"></calcite-loader>
                </div>
            </calcite-panel>
        `;
        const formEl = document.getElementById("lrcFeatureForm");
        if (!formEl)
            return;
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
