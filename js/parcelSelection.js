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

		return true;
	}

	function clearSelectedParcels() {
		selectedParcels.length = 0;

		if (selectedParcelContent2d) selectedParcelContent2d.innerHTML = "";
		if (selectedParcelContent3d) selectedParcelContent3d.innerHTML = "";

		updateSelectedParcelBadge();
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

	async function getTylerDataByParcel(parcelNumber) {
		const parid = normalizeParcelForTyler(parcelNumber);
		const fallback = {
			ownerName: "Could not be found",
			taxDistrict: "Could not be found"
		};

		if (!parid) return fallback;
		if (tylerLookupCache.has(parid)) return tylerLookupCache.get(parid);

		const tylerExtractTable = getTylerExtractTable();
		if (!tylerExtractTable) return fallback;

		try {
			const q = tylerExtractTable.createQuery();
			q.where = `PARID = '${parid.replace(/'/g, "''")}'`;
			q.outFields = ["PARID", "TAXYR", "OWNER_NAMES", "TAXDIST"];
			q.orderByFields = ["TAXYR DESC"];
			q.num = 1;
			q.returnGeometry = false;

			const result = await tylerExtractTable.queryFeatures(q);
			const attrs = result.features?.[0]?.attributes || {};

			// Field names may come back upper- or lower-cased depending on the service.
			const ownerNamesRaw = attrs.OWNER_NAMES ?? attrs.owner_names ?? null;
			const ownRaw1 = attrs.OWN1 ?? attrs.own1 ?? null;
			const ownRaw2 = attrs.OWN2 ?? attrs.own2 ?? null;
			const taxdistRaw = attrs.TAXDIST ?? attrs.taxdist ?? null;

			const ownerName =
				String(ownerNamesRaw || "").replace(/(?:\s*,\s*)+$/g, "").trim() ||
				[ownRaw1, ownRaw2]
					.filter((v) => v != null && String(v).trim() !== "")
					.join(" ") ||
				"Could not be found";

			const data = {
				ownerName,
				taxDistrict: taxdistRaw || "Could not be found"
			};

			tylerLookupCache.set(parid, data);
			return data;
		} catch {
			return fallback;
		}
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
		getHighlightLayerViewForFeature,
		syncParcelListSelection,
		updateSelectedParcelBadge
	};
}
