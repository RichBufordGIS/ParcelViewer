import { FIELDS } from "./constants.js";
import { logCaughtError } from "./errorUX.js";
// Parcel selection, highlighting, Tyler data lookup, and rectangle query extracted from main.js.
// Call initParcelSelection(refs) after layers and layer-views are ready.
// Returns { toggleParcelSelection, selectFeaturesByRectangle, clearSelectedParcels,
//           clearHighlightsAndSets, removeSelectedParcelByKey, getTylerDataByParcel,
//           getHighlightLayerViewForFeature, syncParcelListSelection,
//           getSelectedParcels }.

import {
	getSelectionKey,
	isRegular2DParcel,
	isCondo3DParcel,
	getParcelDisplayName,
	normalizeParcelForTyler
} from "./utils.js";

const MAX_SELECTED_PARCELS = 20;

/**
 * @param {object}   refs
 * @param {Function} refs.getRegularParcelLayerView  () => FeatureLayerView|null
 * @param {Function} refs.getFloorLayerView          () => FeatureLayerView|null
 * @param {Function} refs.getTylerExtractTable       () => FeatureLayer|null
 * @param {Function} refs.getPolygonGraphicsLayer    () => GraphicsLayer|null
 * @param {Function} refs.onSelectionChanged         (selectedParcels) => Promise — called after
 *                                                    every add/remove operation; receives the live
 *                                                    selectedParcels array. Wire this to
 *                                                    selectedParcelUI.updateSelectedPanel.
 * @param {Element}  refs.parcelListEl               The floor/condo parcel list element
 * @param {Element}  refs.selectedParcelContent2d    (optional) Expand panel content for 2D
 * @param {Element}  refs.selectedParcelContent3d    (optional) Expand panel content for 3D
 * @param {Element}  refs.selectedParcelBadge2d      (optional) Badge counter for 2D toolbar
 * @param {Element}  refs.selectedParcelBadge3d      (optional) Badge counter for 3D toolbar
 */
export function initParcelSelection({
	getRegularParcelLayerView,
	getFloorLayerView,
	getTylerExtractTable,
	getPolygonGraphicsLayer,
	onSelectionChanged,

	parcelListEl,
	selectedParcelContent2d,
	selectedParcelContent3d,
	selectedParcelBadge2d,
	selectedParcelBadge3d
}) {
	// ---- Private state -------------------------------------------------------
	const selectedParcels = [];
	const highlightedParcels = new Map();
	const tylerLookupCache = new Map();

	// ---- Accessors -----------------------------------------------------------

	function getSelectedParcels() {
		return selectedParcels;
	}

	function dispatchSelectionState() {
		window.dispatchEvent(new CustomEvent("parcelviewer:selected-parcels-changed", {
			detail: {
				count: selectedParcels.length,
				hasCondoSelection: selectedParcels.some(isCondo3DParcel)
			}
		}));
	}

	// ---- Highlight helpers ---------------------------------------------------

	function getHighlightLayerViewForFeature(feature) {
		if (isRegular2DParcel(feature)) return getRegularParcelLayerView();
		if (isCondo3DParcel(feature)) return getFloorLayerView();
		return null;
	}

	// ---- Remove / clear ------------------------------------------------------

	function removeSelectedParcelByKey(selectionKey) {
		const idx = selectedParcels.findIndex(
			(feature) => getSelectionKey(feature) === selectionKey
		);
		if (idx < 0) return false;

		selectedParcels.splice(idx, 1);

		const handle = highlightedParcels.get(selectionKey);
		if (handle) {
			try { handle.remove(); } catch {}
			highlightedParcels.delete(selectionKey);
		}

		dispatchSelectionState();
		return true;
	}

	function clearSelectedParcels() {
		selectedParcels.length = 0;

		if (selectedParcelContent2d) selectedParcelContent2d.innerHTML = "";
		if (selectedParcelContent3d) selectedParcelContent3d.innerHTML = "";

		updateSelectedParcelBadge();
		dispatchSelectionState();
	}

	function clearHighlightsAndSets() {
		highlightedParcels.forEach((handle) => {
			try { handle.remove(); } catch {}
		});
		highlightedParcels.clear();
	}

	// ---- Badge ---------------------------------------------------------------

	function updateSelectedParcelBadge() {
		const count = selectedParcels.length;
		const text = count > 99 ? "99+" : String(count);

		if (selectedParcelBadge2d) {
			selectedParcelBadge2d.textContent = text;
			selectedParcelBadge2d.style.display = count > 0 ? "inline-block" : "none";
		}

		if (selectedParcelBadge3d) {
			selectedParcelBadge3d.textContent = text;
			selectedParcelBadge3d.style.display = count > 0 ? "inline-block" : "none";
		}
	}

	// ---- Parcel list sync (floor/building drill-down panel) ------------------

	function syncParcelListSelection() {
		if (!parcelListEl) return;

		const selectedKeys = new Set(selectedParcels.map((f) => getSelectionKey(f)));

		Array.from(parcelListEl.querySelectorAll(".parcel-list-item")).forEach((div) => {
			const selectionKey = div.dataset.selectionKey;
			if (selectionKey) {
				div.classList.toggle("selected", selectedKeys.has(selectionKey));
				return;
			}

			const name = div.dataset.name;
			const matchedKeys = selectedParcels
				.filter((f) => getParcelDisplayName(f) === name)
				.map((f) => getSelectionKey(f));

			if (matchedKeys.length) {
				div.classList.toggle("selected", matchedKeys.some((key) => selectedKeys.has(key)));
			} else {
				div.classList.remove("selected");
			}
		});
	}

	// ---- Tyler data lookup --------------------------------------------------
    const TYLER_FALLBACK = Object.freeze({
        ownerName: "Could not be found",
        taxDistrict: "Could not be found"
    });
    /** Builds tyler data. */
    function buildTylerData(attrs = {}) {
        // Field names may come back upper- or lower-cased depending on the service.
        const ownerNamesRaw = attrs[FIELDS.ownerNames] ?? attrs[FIELDS.ownerNamesLower] ?? null;
        const ownRaw1 = attrs[FIELDS.owner1] ?? attrs[FIELDS.owner1Lower] ?? null;
        const ownRaw2 = attrs[FIELDS.owner2] ?? attrs[FIELDS.owner2Lower] ?? null;
        const taxdistRaw = attrs[FIELDS.taxDistrict] ?? attrs[FIELDS.taxDistrictLower] ?? null;
        const ownerName = String(ownerNamesRaw || "").replace(/(?:\s*,\s*)+$/g, "").trim() ||
            [ownRaw1, ownRaw2]
                .filter((v) => v != null && String(v).trim() !== "")
                .join(" ") ||
            "Could not be found";
        return {
            ownerName,
            taxDistrict: taxdistRaw || "Could not be found"
        };
    }
    /** Returns tyler tax year. */
    function getTylerTaxYear(attrs = {}) {
        const value = attrs[FIELDS.taxYear] ?? attrs[String(FIELDS.taxYear).toLowerCase()] ?? null;
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : String(value ?? "");
    }
    /** Determines whether newer tyler record. */
    function isNewerTylerRecord(candidateAttrs, currentAttrs) {
        if (!currentAttrs)
            return true;
        const candidate = getTylerTaxYear(candidateAttrs);
        const current = getTylerTaxYear(currentAttrs);
        if (typeof candidate === "number" && typeof current === "number")
            return candidate > current;
        return String(candidate).localeCompare(String(current), undefined, { numeric: true }) > 0;
    }
    /**
     * Resolve Tyler owner/TCA information for a parcel selection in one service query.
     * Results are keyed by normalized PARID. Cached rows are reused and only cache misses
     * are included in the batched WHERE ... IN (...) request.
     */
    async function getTylerDataByParcels(parcelNumbers = []) {
        const parids = [...new Set(parcelNumbers
                .map(normalizeParcelForTyler)
                .filter(Boolean))];
        const resultByParid = new Map();
        const missingParids = [];
        for (const parid of parids) {
            if (tylerLookupCache.has(parid)) {
                resultByParid.set(parid, tylerLookupCache.get(parid));
            }
            else {
                missingParids.push(parid);
            }
        }
        if (missingParids.length === 0)
            return resultByParid;
        const tylerExtractTable = getTylerExtractTable();
        if (!tylerExtractTable) {
            for (const parid of missingParids)
                resultByParid.set(parid, TYLER_FALLBACK);
            return resultByParid;
        }
        try {
            // Resolve the service's actual field names before building the batch query.
            // ArcGIS rejects a query when outFields contains even one field that does not
            // exist, so optional owner fallbacks (OWN1/OWN2) must only be requested when
            // the Tyler table actually exposes them.
            await tylerExtractTable.load?.();
            const fields = Array.isArray(tylerExtractTable.fields) ? tylerExtractTable.fields : [];
            /** Returns the exact service field name for the first matching candidate. */
            const actualFieldName = (...candidates) => {
                for (const candidate of candidates) {
                    const match = fields.find((field) =>
                        String(field?.name || "").toLowerCase() === String(candidate || "").toLowerCase());
                    if (match?.name)
                        return match.name;
                }
                return null;
            };
            const paridField = actualFieldName(FIELDS.parid, FIELDS.paridLower);
            if (!paridField)
                throw new Error("Tyler parcel table does not expose a PARID field.");
            const taxYearField = actualFieldName(FIELDS.taxYear);
            const ownerNamesField = actualFieldName(FIELDS.ownerNames, FIELDS.ownerNamesLower);
            const owner1Field = actualFieldName(FIELDS.owner1, FIELDS.owner1Lower);
            const owner2Field = actualFieldName(FIELDS.owner2, FIELDS.owner2Lower);
            const taxDistrictField = actualFieldName(FIELDS.taxDistrict, FIELDS.taxDistrictLower);
            const q = tylerExtractTable.createQuery();
            q.where = `${paridField} IN (${missingParids
                .map((parid) => `'${parid.replace(/'/g, "''")}'`)
                .join(",")})`;
            q.outFields = [
                paridField,
                taxYearField,
                ownerNamesField,
                owner1Field,
                owner2Field,
                taxDistrictField
            ].filter(Boolean);
            q.returnGeometry = false;
            const { features = [] } = await tylerExtractTable.queryFeatures(q);
            const newestFeatureByParid = new Map();
            // A PARID can have multiple TAXYR records. Reduce the single result set to the
            // newest tax year for each parcel instead of relying on a global query order.
            for (const feature of features) {
                const attrs = feature?.attributes || {};
                const rawParid = attrs[paridField] ?? attrs[FIELDS.parid] ?? attrs[FIELDS.paridLower] ?? "";
                const parid = normalizeParcelForTyler(rawParid);
                if (!parid)
                    continue;
                const current = newestFeatureByParid.get(parid);
                if (!current || isNewerTylerRecord(attrs, current.attributes || {})) {
                    newestFeatureByParid.set(parid, feature);
                }
            }
            for (const parid of missingParids) {
                const feature = newestFeatureByParid.get(parid);
                const data = feature ? buildTylerData(feature.attributes || {}) : TYLER_FALLBACK;
                tylerLookupCache.set(parid, data);
                resultByParid.set(parid, data);
            }
        }
        catch (error) {
            logCaughtError("parcelSelection.js: batched Tyler lookup failed", error);
            for (const parid of missingParids)
                resultByParid.set(parid, TYLER_FALLBACK);
        }
        return resultByParid;
    }
    /** Returns tyler data by parcel. */
    async function getTylerDataByParcel(parcelNumber) {
        const parid = normalizeParcelForTyler(parcelNumber);
        if (!parid)
            return TYLER_FALLBACK;
        const resultByParid = await getTylerDataByParcels([parid]);
        return resultByParid.get(parid) || TYLER_FALLBACK;
    }
    // ---- Toggle selection ----------------------------------------------------

	async function toggleParcelSelection(feature) {
		if (!feature) return;

		const selectionKey = getSelectionKey(feature);
		const alreadySelectedIndex = selectedParcels.findIndex(
			(f) => getSelectionKey(f) === selectionKey
		);

		if (alreadySelectedIndex >= 0) {
			removeSelectedParcelByKey(selectionKey);
		} else {
			selectedParcels.push(feature);

			const lv = getHighlightLayerViewForFeature(feature);
			if (lv) {
				const oid = feature.attributes?.OBJECTID;
				if (oid != null) {
					try {
						const handle = lv.highlight([oid]);
						highlightedParcels.set(selectionKey, handle);
					} catch {}
				}
			}
		}

		await onSelectionChanged(selectedParcels);
		syncParcelListSelection();
		dispatchSelectionState();
	}

	// ---- Rectangle query selection ------------------------------------------

	async function selectFeaturesByRectangle(geometry) {
		try {
			const polygonGraphicsLayer = getPolygonGraphicsLayer();
			const regularParcelLayerView = getRegularParcelLayerView();

			// Resolve the actual FeatureLayer from the layer view
			const regularParcelLayer = regularParcelLayerView?.layer || null;

			if (!regularParcelLayer || !geometry) {
				polygonGraphicsLayer?.removeAll();
				return;
			}

			const query = regularParcelLayer.createQuery();
			query.geometry = geometry;
			query.spatialRelationship = "intersects";
			query.outFields = ["*"];
			query.returnGeometry = true;

			const result = await regularParcelLayer.queryFeatures(query);
			const features = result.features || [];

			// Ensure layer ref on each feature
			for (const f of features) {
				try { f.layer = f.layer || regularParcelLayer; } catch {}
			}

			const newFeatures = features.filter((feature) => {
				const key = getSelectionKey(feature);
				return !selectedParcels.some((f) => getSelectionKey(f) === key);
			});

			const availableSlots = Math.max(0, MAX_SELECTED_PARCELS - selectedParcels.length);

			if (availableSlots <= 0) {
				window.alert(
					`You can only have up to ${MAX_SELECTED_PARCELS} parcels selected at one time.`
				);
				polygonGraphicsLayer?.removeAll();
				return;
			}

			const featuresToAdd = newFeatures.slice(0, availableSlots);

			if (featuresToAdd.length === 0) {
				polygonGraphicsLayer?.removeAll();
				return;
			}

			if (newFeatures.length > availableSlots) {
				window.alert(
					`Only ${availableSlots} parcel${availableSlots === 1 ? "" : "s"} from that rectangle could be added because the selection limit is ${MAX_SELECTED_PARCELS}.`
				);
			}

			for (const feature of featuresToAdd) {
				selectedParcels.push(feature);
			}

			// Highlight all new features
			for (const feature of featuresToAdd) {
				const selectionKey = getSelectionKey(feature);
				const lv = getHighlightLayerViewForFeature(feature);
				const oid = feature.attributes?.OBJECTID;

				if (lv && oid != null && !highlightedParcels.has(selectionKey)) {
					try {
						const handle = lv.highlight([oid]);
						highlightedParcels.set(selectionKey, handle);
					} catch {}
				}
			}

			await onSelectionChanged(selectedParcels);
			syncParcelListSelection();
			polygonGraphicsLayer?.removeAll();
		} catch {}
	}

	return {
		getSelectedParcels,
		toggleParcelSelection,
		selectFeaturesByRectangle,
		clearSelectedParcels,
		clearHighlightsAndSets,
		removeSelectedParcelByKey,
		getTylerDataByParcel,
		getTylerDataByParcels,
		getHighlightLayerViewForFeature,
		syncParcelListSelection,
		updateSelectedParcelBadge
	};
}
