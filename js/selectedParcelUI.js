// Selected-parcel sidebar rendering, expand-panel management, and search-bar sync
// extracted from main.js. Call initSelectedParcelUI(refs) after parcelSelection is
// initialized. Returns { updateSelectedPanel, openSelectedParcelPanel,
// closeSelectedParcelPanel, clearAllSelectedParcels, openLrcFeatureForm ref slot }.

import { buildParcelDetailsFrame, loadTylerPhotoViewer } from "./rightPaneContent.js";
import {
	getSelectionKey,
	getParcelDisplayName,
	getTylerLookupValue,
	normalizeParcelForTyler,
	getCompareStatus
} from "./utils.js";

/**
 * @param {object}   refs
 *
 * Parcel selection accessors (from parcelSelection module):
 * @param {Function} refs.getSelectedParcels            () => Feature[]
 * @param {Function} refs.removeSelectedParcelByKey     (key) => boolean
 * @param {Function} refs.clearSelectedParcels          () => void
 * @param {Function} refs.clearHighlightsAndSets        () => void
 * @param {Function} refs.syncParcelListSelection       () => void
 * @param {Function} refs.updateSelectedParcelBadge     () => void
 * @param {Function} refs.getTylerDataByParcels         (parcelNumbers) => Promise<Map>
 *
 * LRC form callbacks (wired in main.js after lrcForms.initLrcForms):
 * @param {Function} refs.getOpenLrcFeatureForm         () => Function
 * @param {Function} refs.getOpenMergeLrcFeatureForm    () => Function
 *
 * Sidebar state callbacks (from sidebarUI module):
 * @param {Function} refs.setRightSidebarCollapsed      (value: boolean) => void
 * @param {Function} refs.updateRightSidebarState       () => void
 *
 * Search bar sync:
 * @param {Function} refs.getCurrentPage                () => string
 * @param {Element}  refs.searchEl
 *
 * DOM:
 * @param {Element}  refs.rightSidebarContent
 * @param {Element}  refs.selectedParcelExpandEl        (may be null)
 * @param {Element}  refs.selectedParcelContent2d       (may be null)
 * @param {Element}  refs.selectedParcelContent3d       (may be null)
 * @param {Element}  refs.selectedParcelBadge2d         (may be null)
 * @param {Element}  refs.selectedParcelBadge3d         (may be null)
 * @param {Element}  refs.clearSelectedParcelsButton2d  (may be null)
 * @param {Element}  refs.clearSelectedParcelsButton3d  (may be null)
 * @param {Element}  refs.parcelListEl
 */
export function initSelectedParcelUI({
	getSelectedParcels,
	removeSelectedParcelByKey,
	clearSelectedParcels,
	clearHighlightsAndSets,
	syncParcelListSelection,
	updateSelectedParcelBadge,
	getTylerDataByParcels,
	onSelectedParcelHover,
	onSelectedParcelHoverEnd,
	onSelectedParcelRowClick,
	onSelectionCleared,
	clearOwnerParcelLocationPoints,
	refreshOwnerParcelLocationPoints,
	refreshOwnerParcelLocationPointsAndZoom,

	getOpenLrcFeatureForm,
	getOpenMergeLrcFeatureForm,

	setRightSidebarCollapsed,
	updateRightSidebarState,

	getCurrentPage,
	searchEl,

	rightSidebarContent,
	selectedParcelExpandEl,
	selectedParcelContent2d,
	selectedParcelContent3d,
	selectedParcelBadge2d,
	selectedParcelBadge3d,
	clearSelectedParcelsButton2d,
	clearSelectedParcelsButton3d,
	parcelListEl
}) {
	// ---- Private render-version counter (prevents stale async renders) ------
	let selectedParcelRenderVersion = 0;
	const rightSidebarShell = rightSidebarContent?.closest?.("#right-sidebar-shell") || null;

	// ---- Expand-panel helpers -----------------------------------------------

	function openSelectedParcelPanel() {
		if (selectedParcelExpandEl) selectedParcelExpandEl.expanded = true;
	}

	function closeSelectedParcelPanel() {
		if (selectedParcelExpandEl) selectedParcelExpandEl.expanded = false;
	}

	// ---- Search bar sync ----------------------------------------------------

	function getSelectedParcelSearchDisplay(names) {
		if (!names.length) return "";
		if (names.length === 1) return names[0];
		return `${names.length} parcels selected (max 20)`;
	}

	function syncSearchBarWithSelectedParcels() {
		if (getCurrentPage() !== "parcel") return;
		if (searchEl?.dataset?.preserveSearchDisplay === "true") return;

		const selectedParcels = getSelectedParcels();

		const names = selectedParcels.map((feature) => getParcelDisplayName(feature)).filter(Boolean);
		const joined = names.join(", ");
		const displayValue = getSelectedParcelSearchDisplay(names);
		const searchTextArea = document.getElementById("searchTextArea");
		if (searchTextArea) { searchTextArea.value = joined; searchTextArea.title = joined; }

		if (searchEl) {
			searchEl.value = displayValue;
			searchEl.searchTerm = displayValue;
			searchEl.title = joined;
			searchEl.dataset.selectedParcelList = joined;
			searchEl.dataset.suppressSuggestions = "true";
			searchEl.close?.();
			requestAnimationFrame(() => searchEl.close?.());
			setTimeout(() => searchEl.close?.(), 0);
			setTimeout(() => searchEl.close?.(), 120);
		}
	}

	// ---- Single-parcel iframe staging ---------------------------------------

	async function stageSingleParcelIframes(contentEl, { parcelNumber, photoParcelNumber = parcelNumber, renderVersion }) {
		if (!contentEl || renderVersion !== selectedParcelRenderVersion) return;

		contentEl.innerHTML = `
			<div class="single-parcel-embed-grid">
				<div id="singleParcelDetailsSlot" class="single-parcel-frame-slot">
					<div class="single-parcel-frame-placeholder">Loading parcel details...</div>
				</div>
				<div id="singleParcelPhotosSlot" class="single-parcel-frame-slot">
					<div class="single-parcel-frame-placeholder">Loading parcel photos...</div>
				</div>
			</div>
		`;

		const detailsSlot = document.getElementById("singleParcelDetailsSlot");
		const photosSlot = document.getElementById("singleParcelPhotosSlot");
		if (!detailsSlot || !photosSlot) return;

		photosSlot.innerHTML = `<div id="singleParcelPhotoShell" class="tyler-photo-shell"></div>`;
		const photoShell = document.getElementById("singleParcelPhotoShell");
		const normalizedParcel = normalizeParcelForTyler(photoParcelNumber);

		void loadTylerPhotoViewer(photoShell, [...new Set([normalizedParcel, photoParcelNumber, parcelNumber, getTylerLookupValue(getSelectedParcels()[0])].filter(Boolean))], {
			shouldRender: () =>
				renderVersion === selectedParcelRenderVersion && photoShell?.isConnected === true
		});

		void buildParcelDetailsFrame(parcelNumber, { sourceFeature: getSelectedParcels()[0] })
			.then((html) => {
				if (renderVersion !== selectedParcelRenderVersion || !detailsSlot?.isConnected) return;
				detailsSlot.innerHTML = html;
			})
			.catch(() => {
				if (renderVersion !== selectedParcelRenderVersion || !detailsSlot?.isConnected) return;
				detailsSlot.innerHTML = `
					<div class="single-parcel-frame-placeholder">Parcel details failed to load.</div>
				`;
			});
	}

	function wireSelectedParcelRowInteractions(div, feature, removeButton) {
		if (!div || !feature) return;

		div.classList.add("selected-parcel-row-action");

		div.addEventListener("mouseenter", () => {
			onSelectedParcelHover?.(feature);
		});

		div.addEventListener("mouseleave", () => {
			onSelectedParcelHoverEnd?.(feature);
		});

		div.addEventListener("click", async (event) => {
			if (event.target?.closest?.(".remove-button")) return;
			await onSelectedParcelRowClick?.(feature);
		});

		removeButton?.addEventListener("click", (event) => {
			event.stopPropagation();
		});
	}

	async function removeSelectedParcelFromPanel(selectionKey, rowEl) {
		if (!removeSelectedParcelByKey(selectionKey)) return;

		rowEl?.remove?.();
		onSelectedParcelHoverEnd?.();
		refreshOwnerParcelLocationPoints?.();
		await refreshOwnerParcelLocationPointsAndZoom?.();
		syncParcelListSelection();
		updateSelectedParcelBadge();
		syncSearchBarWithSelectedParcels();

		if (getSelectedParcels().length === 0) {
			await onSelectionCleared?.();
		}

		await updateSelectedPanel();
	}

	// ---- Right-sidebar render -----------------------------------------------

	async function renderSelectedParcelSidebar(renderVersion, selectedSnapshot, tylerByParid) {
		if (renderVersion !== selectedParcelRenderVersion) return;

		const snapshot = selectedSnapshot || [...getSelectedParcels()];

		if (snapshot.length === 0) {
			rightSidebarContent.innerHTML = "";
			rightSidebarShell?.classList.remove("single-parcel-mode");
			clearOwnerParcelLocationPoints?.();
			setRightSidebarCollapsed(true);
			updateRightSidebarState();
			return;
		}

		const count = snapshot.length;
		const isSingle = count === 1;
		rightSidebarShell?.classList.toggle("single-parcel-mode", isSingle);

		rightSidebarContent.innerHTML = `
			<div class="selected-parcel-panel" style="width:100%; max-width:none; max-height:none; height:100%; border-radius:0; box-shadow:none; border:none;">
				<div class="selected-parcel-header">
					<div class="selected-parcel-title">
						Selected Parcels
						<span class="selected-parcel-badge-inline">${count}</span>
					</div>
					<div class="selected-parcel-header-buttons">
						${isSingle
							? `<button id="openLrcFormBtnSingle" style="width:20%;" class="selected-header-btn action-tile-btn">
									<calcite-icon icon="split-units" scale="s"></calcite-icon>Split Parcel
								</button>`
							: `<button id="openMergeLrcFormBtn" style="width:20%;" class="selected-header-btn action-tile-btn">
									<calcite-icon icon="merge" scale="s"></calcite-icon>Combine
								</button>`
						}
						<button id="rightSidebarClearSelectedParcelsButton" class="selected-header-btn">Clear All</button>
					</div>
				</div>
				<div id="rightSidebarSelectedParcelContent" style="padding:10px; overflow-y:auto; flex:1 1 auto;"></div>
			</div>
		`;

		const contentEl = document.getElementById("rightSidebarSelectedParcelContent");

		if (isSingle) {
			contentEl.classList.add("single-parcel-frame");
			const feature = snapshot[0];
			const name = getParcelDisplayName(feature);
			const photoLookupValue = getTylerLookupValue(feature) || name;
			void stageSingleParcelIframes(contentEl, {
				parcelNumber: name,
				photoParcelNumber: photoLookupValue,
				renderVersion
			});

			const lrcBtn = document.getElementById("openLrcFormBtnSingle");
			if (lrcBtn) {
				lrcBtn.onclick = () => getOpenLrcFeatureForm()?.();
			}
		} else {
			contentEl.classList.remove("single-parcel-frame");
			const parcelRows = [];

			for (const f of snapshot) {
				const selectionKey = getSelectionKey(f);
				const name = getParcelDisplayName(f);
				const lookupValue = getTylerLookupValue(f) || name;
				const tylerData = tylerByParid.get(normalizeParcelForTyler(lookupValue)) || { ownerName: "Could not be found", taxDistrict: "Could not be found" };

				if (renderVersion !== selectedParcelRenderVersion) return;

				parcelRows.push({
					selectionKey,
					feature: f,
					parcelNumber: name,
					ownerName: tylerData.ownerName,
					taxDistrict: tylerData.taxDistrict
				});
			}

			const ownerMatch = getCompareStatus(parcelRows, "ownerName");
			const taxDistrictMatch = getCompareStatus(parcelRows, "taxDistrict");

			for (const [rowIndex, row] of parcelRows.entries()) {
				const div = document.createElement("div");
				div.className = "selected-parcel-item";

				const ownerColor = ownerMatch ? "#7CFC8A" : "#FF6B6B";
				const taxDistrictColor = taxDistrictMatch ? "#7CFC8A" : "#FF6B6B";
				const markerNumber = rowIndex + 1;

				div.innerHTML = `
					<div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
						<div style="display:flex; gap:10px; min-width:0; align-items:flex-start;">
							<span class="selected-parcel-marker-badge">${markerNumber}</span>
							<div style="min-width:0;">
							<div><strong>Parcel Number:</strong> ${row.parcelNumber}</div>
							<div><strong>Owner Name:</strong> <span style="color:${ownerColor};">${row.ownerName}</span></div>
							<div><strong>TCA:</strong> <span style="color:${taxDistrictColor};">${row.taxDistrict}</span></div>
							</div>
						</div>
						<button class="remove-button">x</button>
					</div>
				`;

				const removeButton = div.querySelector(".remove-button");
				removeButton.onclick = async () => {
					await removeSelectedParcelFromPanel(row.selectionKey, div);
				};
				wireSelectedParcelRowInteractions(div, row.feature, removeButton);

				contentEl.appendChild(div);
			}

			if (renderVersion !== selectedParcelRenderVersion) return;

			const mergeBtn = document.getElementById("openMergeLrcFormBtn");
			if (mergeBtn) {
				mergeBtn.onclick = () => getOpenMergeLrcFeatureForm()?.();
			}
		}

		if (renderVersion !== selectedParcelRenderVersion) return;

		const clearBtn = document.getElementById("rightSidebarClearSelectedParcelsButton");
		if (clearBtn) {
			clearBtn.onclick = () => void clearAllSelectedParcels();
		}

		setRightSidebarCollapsed(false);
		updateRightSidebarState();
	}

	// ---- Main update function -----------------------------------------------

	async function updateSelectedPanel() {
		const renderVersion = ++selectedParcelRenderVersion;
		const selectedParcels = getSelectedParcels();
		const selectedSnapshot = [...selectedParcels];
		const shouldRenderSummaryRows = selectedSnapshot.length > 1;
		const tylerByParid = shouldRenderSummaryRows
			? await getTylerDataByParcels(selectedSnapshot.map(f => getTylerLookupValue(f) || getParcelDisplayName(f)))
			: new Map();
		if (renderVersion !== selectedParcelRenderVersion) return;

		if (selectedParcelContent2d) selectedParcelContent2d.innerHTML = "";
		if (selectedParcelContent3d) selectedParcelContent3d.innerHTML = "";

		if (shouldRenderSummaryRows) for (const [selectedIndex, f] of selectedSnapshot.entries()) {
			const selectionKey = getSelectionKey(f);
			const name = getParcelDisplayName(f);
			const lookupValue = getTylerLookupValue(f) || name;
			const tylerData = tylerByParid.get(normalizeParcelForTyler(lookupValue)) || { ownerName: "Could not be found", taxDistrict: "Could not be found" };

			if (renderVersion !== selectedParcelRenderVersion) return;

			function buildRow() {
				const div = document.createElement("div");
				div.className = "selected-parcel-item";

				div.innerHTML = `
					<div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
						<div style="display:flex; gap:10px; min-width:0; align-items:flex-start;">
							<span class="selected-parcel-marker-badge">${selectedIndex + 1}</span>
							<div style="min-width:0;">
							<div><strong>Parcel Number:</strong> ${name}</div>
							<div><strong>Owner Name:</strong> ${tylerData.ownerName}</div>
							<div><strong>TCA:</strong> ${tylerData.taxDistrict}</div>
							</div>
						</div>
						<button class="remove-button">x</button>
					</div>
				`;

				const removeButton = div.querySelector(".remove-button");
				removeButton.onclick = async () => {
					await removeSelectedParcelFromPanel(selectionKey, div);
				};
				wireSelectedParcelRowInteractions(div, f, removeButton);

				return div;
			}

			if (renderVersion !== selectedParcelRenderVersion) return;

			if (selectedParcelContent2d) selectedParcelContent2d.appendChild(buildRow());
			if (selectedParcelContent3d) selectedParcelContent3d.appendChild(buildRow());
		}

		if (renderVersion !== selectedParcelRenderVersion) return;

		updateSelectedParcelBadge();
		syncSearchBarWithSelectedParcels();
		await renderSelectedParcelSidebar(renderVersion, selectedSnapshot, tylerByParid);
		refreshOwnerParcelLocationPoints?.();
	}

	// ---- Clear-all -----------------------------------------------------------

	async function clearAllSelectedParcels() {
		const selectedParcels = getSelectedParcels();
		selectedParcels.length = 0;
		window.dispatchEvent(new CustomEvent("parcelviewer:selected-parcels-changed", {
			detail: {
				count: 0,
				hasCondoSelection: false
			}
		}));

		clearHighlightsAndSets();
		onSelectedParcelHoverEnd?.();
		clearOwnerParcelLocationPoints?.();

		syncParcelListSelection();

		if (parcelListEl) {
			Array.from(parcelListEl.querySelectorAll(".parcel-list-item")).forEach((div) =>
				div.classList.remove("selected")
			);
		}

		await onSelectionCleared?.();
		await updateSelectedPanel();
	}

	// ---- Wire clear-selected buttons ----------------------------------------

	clearSelectedParcelsButton2d?.addEventListener("click", () => void clearAllSelectedParcels());
	clearSelectedParcelsButton3d?.addEventListener("click", () => void clearAllSelectedParcels());

	return {
		updateSelectedPanel,
		openSelectedParcelPanel,
		closeSelectedParcelPanel,
		clearAllSelectedParcels,
		syncSearchBarWithSelectedParcels
	};
}
