import { getSelectionKey } from "./utils.js";

// 3D building / floor selection logic extracted from main.js.
// Factory: call initBuildingSelection(refs) after layer refs and views are ready.
// Returns { populateBuildingList, attachViewClickHandler, selectBuildingFloorParcel, zoomToSelectedParcelIn3D }.

const DIRECTION_TO_HEADING = { N: 180, S: 0, E: 270, W: 90 };
const FEET_TO_METERS = 0.3048;
const CONDO_SUBTYPE_WHERE = "ParcelSubtype IN (2, 4)";

function getExtrusionHeightMeters(layer, fallback) {
	const symbolLayers = layer?.renderer?.symbol?.symbolLayers;
	const extrudeLayer = symbolLayers?.find((sl) => sl.type === "extrude");
	return typeof extrudeLayer?.size === "number" ? extrudeLayer.size : fallback;
}

function getAttributeCaseInsensitive(attributes, fieldName) {
	if (!attributes) return undefined;
	if (attributes[fieldName] !== undefined) return attributes[fieldName];

	const targetKey = fieldName.toLowerCase();
	const matchKey = Object.keys(attributes).find((key) => key.toLowerCase() === targetKey);
	return matchKey ? attributes[matchKey] : undefined;
}

/**
 * @param {object} refs
 * @param {Function} refs.getCondoLayer            () => FeatureLayer|null
 * @param {Function} refs.getFloorLayer            () => FeatureLayer|null
 * @param {Function} refs.getESRILayer             () => FeatureLayer|null
 * @param {Function} refs.getParcelLayer           () => FeatureLayer|null
 * @param {Function} refs.getRegularParcelLayer    () => FeatureLayer|null
 * @param {Function} refs.getSceneView             () => SceneView|null
 * @param {class}    refs.FeatureLayerClass        ArcGIS FeatureLayer class
 * @param {string}   refs.buildingListServiceUrl   REST service URL for the building list source
 * @param {Function} refs.switchTo3D               () => Promise
 * @param {Function} refs.switchTo2D               () => Promise  (unused here, kept for symmetry)
 * @param {Function} refs.toggleParcelSelection    (feature) => Promise
 * @param {Function} refs.clearHighlightsAndSets   () => void
 * @param {Function} refs.clearSelectedParcels     () => void
 * @param {Function} refs.clearAllSelectedParcels  () => Promise<void>
 * @param {Function} refs.syncParcelListSelection  () => void
 * @param {Function} refs.openLeftSidebar          () => void
 * @param {Function} refs.getCurrentPage           () => string
 * @param {class}    refs.FeatureFilter            ArcGIS FeatureFilter class
 * @param {Element}  refs.buildingListEl
 * @param {Element}  refs.floorListEl
 * @param {Element}  refs.parcelListEl
 * @param {Element}  refs.buildingSearchEl
 * @param {Element}  refs.parcelSearchEl
 */
export function initBuildingSelection({
	getCondoLayer,
	getFloorLayer,
	getESRILayer,
	getParcelLayer,
	getRegularParcelLayer,
	getSceneView,
	FeatureLayerClass,
	buildingListServiceUrl,
	switchTo3D,
	toggleParcelSelection,
	clearHighlightsAndSets,
	clearSelectedParcels,
	clearAllSelectedParcels,
	syncParcelListSelection,
	openLeftSidebar,
	getCurrentPage,
	FeatureFilter,
	buildingListEl,
	floorListEl,
	parcelListEl,
	buildingSearchEl,
	parcelSearchEl
}) {
	// ---- Private state -------------------------------------------------------
	const INITIAL_BUILDING_RENDER_COUNT = 50;
	const BUILDING_RENDER_CHUNK_SIZE = 250;
	let currentBuildingExtent = null;
	let currentBuildingWhere = null;
	let allFeaturesForBuilding = [];
	let allBuildingNames = [];
	let renderedBuildingNames = new Set();
	let buildingRenderToken = 0;
	let buildingListLayer = null;
	let buildingListLoadPromise = null;

	// ---- Helpers -------------------------------------------------------------

	function clearSelection(container) {
		if (!container) return;
		container.querySelectorAll(".selected").forEach((el) => el.classList.remove("selected"));
	}

	function clearFloorSelection() {
		if (!floorListEl) return;
		Array.from(floorListEl.querySelectorAll("calcite-chip.selected")).forEach((chip) => {
			chip.classList.remove("selected");
			chip.selected = false;
		});
	}

	function getBuildingFilterValue() {
		return (buildingSearchEl?.value || "").trim().toLowerCase();
	}

	function matchesBuildingFilter(buildingName, filter = getBuildingFilterValue()) {
		return !filter || String(buildingName || "").toLowerCase().includes(filter);
	}

	function createBuildingButton(buildingName) {
		const button = document.createElement("div");
		button.className = "building-list-item";
		button.textContent = buildingName;
		button.onclick = () => handleBuildingSelection(buildingName, button);
		button.style.display = matchesBuildingFilter(buildingName) ? "" : "none";
		return button;
	}

	function appendBuildingButtons(buildingNames) {
		if (!buildingListEl || !Array.isArray(buildingNames) || !buildingNames.length) return 0;

		const fragment = document.createDocumentFragment();
		let appendedCount = 0;

		buildingNames.forEach((buildingName) => {
			if (!buildingName || renderedBuildingNames.has(buildingName)) return;
			renderedBuildingNames.add(buildingName);
			fragment.appendChild(createBuildingButton(buildingName));
			appendedCount += 1;
		});

		if (appendedCount) {
			buildingListEl.appendChild(fragment);
		}

		return appendedCount;
	}

	function applyBuildingSearchFilter() {
		const filter = getBuildingFilterValue();
		Array.from(buildingListEl.children).forEach((div) => {
			const match = !filter || div.textContent.toLowerCase().includes(filter);
			div.style.display = match ? "" : "none";
		});
	}

	function filterBuildingListToName(buildingName) {
		if (buildingSearchEl) {
			buildingSearchEl.value = buildingName || "";
		}

		Array.from(buildingListEl.children).forEach((div) => {
			div.style.display = div.textContent === buildingName ? "" : "none";
		});
	}

	function findFloorChip(floorNum) {
		const targetFloor = String(floorNum ?? "").trim();
		if (!targetFloor) return null;

		return Array.from(floorListEl.querySelectorAll("calcite-chip")).find((chip) => {
			const chipFloor = String(chip.dataset.floor ?? "").trim();
			return chipFloor === targetFloor || Number(chipFloor) === Number(targetFloor);
		}) || null;
	}

	function scheduleRemainingBuildingRender(startIndex, token) {
		if (token !== buildingRenderToken) return;
		if (startIndex >= allBuildingNames.length) return;

		window.setTimeout(() => {
			if (token !== buildingRenderToken) return;

			const nextBatch = allBuildingNames.slice(
				startIndex,
				startIndex + BUILDING_RENDER_CHUNK_SIZE
			);
			appendBuildingButtons(nextBatch);
			scheduleRemainingBuildingRender(startIndex + BUILDING_RENDER_CHUNK_SIZE, token);
		}, 0);
	}

	function ensureBuildingButton(buildingName) {
		if (!buildingName || renderedBuildingNames.has(buildingName)) {
			return Array.from(buildingListEl.children).find((d) => d.textContent === buildingName) || null;
		}

		appendBuildingButtons([buildingName]);
		return Array.from(buildingListEl.children).find((d) => d.textContent === buildingName) || null;
	}

	function restoreBuildingListVisibility() {
		Array.from(buildingListEl.children).forEach((el) => {
			el.classList.remove("selected");
			const match = matchesBuildingFilter(el.textContent);
			el.style.display = match ? "" : "none";
		});
	}

	function escapeSql(value) {
		return String(value ?? "").replace(/'/g, "''");
	}

	function getAttr(attributes = {}, fieldName) {
		return getAttributeCaseInsensitive(attributes, fieldName);
	}

	function getCartogNote(attributes = {}) {
		return getAttr(attributes, "CartogNote");
	}

	function getParcelName(attributes = {}) {
		return getAttr(attributes, "Name");
	}

	function getParcelId(attributes = {}) {
		return getAttr(attributes, "parcel_id");
	}

	function getFloorDesignator(attributes = {}) {
		return getAttr(attributes, "FloorDesignator") ?? getAttr(attributes, "FloorNameDesignator");
	}

	function getFloorKey(attributes = {}) {
		return getAttr(attributes, "FloorName") ?? getAttr(attributes, "FloorNameDesignator") ?? getFloorDesignator(attributes);
	}

	function layerHasField(layer, fieldName) {
		const fields = layer?.fields || [];
		return fields.some((field) => String(field.name).toLowerCase() === String(fieldName).toLowerCase());
	}

	function getLayerField(layer, fieldName) {
		const fields = layer?.fields || [];
		const target = String(fieldName).toLowerCase();
		return fields.find((field) => String(field.name).toLowerCase() === target) || null;
	}

	function getFloorFieldName(layer) {
		if (layerHasField(layer, "FloorName")) return "FloorName";
		if (layerHasField(layer, "FloorNameDesignator")) return "FloorNameDesignator";
		return "FloorDesignator";
	}

	function withCondoSubtypeWhere(layer, where) {
		return layerHasField(layer, "ParcelSubtype")
			? `${CONDO_SUBTYPE_WHERE} AND (${where})`
			: where;
	}

	function buildFloorWhere(layer, floorNums) {
		const floorField = getFloorFieldName(layer);
		const field = getLayerField(layer, floorField);
		const values = [...new Set(floorNums
			.map((fn) => String(fn ?? "").trim())
			.filter(Boolean))];

		if (!values.length) return "1=1";

		const isNumericField = /Integer|Double|Single|SmallInteger|OID/i.test(field?.type || "");
		if (isNumericField) {
			const numericFloors = values.map((fn) => Number(fn)).filter(Number.isFinite);
			return numericFloors.length ? `${floorField} IN (${numericFloors.join(",")})` : "1=0";
		}

		return `${floorField} IN (${values.map((fn) => `'${escapeSql(fn)}'`).join(",")})`;
	}

	function getParcelIdentifierValues(feature) {
		const values = [
			getParcelName(feature?.attributes),
			getParcelId(feature?.attributes)
		].filter(Boolean).map((value) => String(value).trim()).filter(Boolean);

		const identifiers = new Set();
		values.forEach((value) => {
			identifiers.add(value);
			const digits = value.replace(/\D/g, "");
			if (digits.length === 17) {
				identifiers.add(digits);
				identifiers.add(digits.replace(
					/^(\d{2})(\d{3})(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})(\d{3})$/,
					"$1-$2-$3-$4-$5-$6-$7-$8"
				));
			}
		});

		return [...identifiers];
	}

	async function resolveCondoFloorFeature(feature) {
		if (!feature) return null;

		const attrs = feature.attributes || {};
		if (getCartogNote(attrs) && getFloorKey(attrs) != null && getParcelName(attrs)) {
			return feature;
		}

		const floorLayer = getFloorLayer();
		if (!floorLayer) return null;

		const identifiers = getParcelIdentifierValues(feature);
		const clauses = identifiers.flatMap((identifier) => [
			`Name = '${escapeSql(identifier)}'`,
			`parcel_id = '${escapeSql(identifier)}'`
		]);

		try {
			await floorLayer.load?.();
			let condoFeature = null;

			if (clauses.length) {
				const res = await floorLayer.queryFeatures({
					where: withCondoSubtypeWhere(floorLayer, `(${[...new Set(clauses)].join(" OR ")})`),
					outFields: ["*"],
					returnGeometry: true,
					num: 1
				});
				condoFeature = res.features?.[0] || null;
			}

			if (!condoFeature && feature.geometry) {
				const geometryRes = await floorLayer.queryFeatures({
					where: withCondoSubtypeWhere(floorLayer, "1=1"),
					geometry: feature.geometry,
					spatialRelationship: "intersects",
					outFields: ["*"],
					returnGeometry: true,
					num: 1
				});
				condoFeature = geometryRes.features?.[0] || null;
			}

			if (condoFeature) {
				try { condoFeature.layer = condoFeature.layer || floorLayer; } catch {}
			}
			return condoFeature;
		} catch (error) {
			console.warn("Unable to resolve parcel search result to a condo floor feature.", error);
			return null;
		}
	}

	function resetBuildingListAfterDeselection() {
		if (buildingSearchEl) {
			buildingSearchEl.value = "";
		}

		restoreBuildingListVisibility();
	}

	function getBuildingListLayer() {
		if (buildingListLayer || !FeatureLayerClass || !buildingListServiceUrl) {
			return buildingListLayer;
		}

		buildingListLayer = new FeatureLayerClass({
			url: buildingListServiceUrl,
			outFields: ["CartogNote"]
		});

		return buildingListLayer;
	}

	async function clearParcelSelections() {
		if (typeof clearAllSelectedParcels === "function") {
			await clearAllSelectedParcels();
			return;
		}

		clearHighlightsAndSets();
		clearSelectedParcels();
		syncParcelListSelection?.();
	}

	async function resolveFloorFeature(graphic) {
		const floorLayer = getFloorLayer();
		if (!graphic || !floorLayer) return graphic;

		const attrs = graphic.attributes || {};
		const hasPanelFields = getCartogNote(attrs) && getFloorKey(attrs) != null && getParcelName(attrs);
		if (hasPanelFields) return graphic;

		const objectIdField = floorLayer.objectIdField || "OBJECTID";
		const oid = attrs[objectIdField] ?? attrs.OBJECTID ?? attrs.ObjectID ?? attrs.oid ?? attrs.OID;
		if (oid == null) return graphic;

		try {
			const res = await floorLayer.queryFeatures({
				where: `${objectIdField} = ${oid}`,
				outFields: ["*"],
				returnGeometry: true
			});

			const feature = res.features?.[0] || graphic;
			try { feature.layer = feature.layer || floorLayer; } catch {}
			return feature;
		} catch {
			return graphic;
		}
	}

	async function applyFloorFilter(floorNums) {
		const condoLayer = getCondoLayer();
		const floorLayer = getFloorLayer();
		const ESRILayer = getESRILayer();
		const parcelLayer = getParcelLayer();
		const sceneView = getSceneView();

		if (!currentBuildingWhere) return;

		if (!Array.isArray(floorNums)) floorNums = [floorNums];
		if (ESRILayer) ESRILayer.visible = false;
		if (parcelLayer) parcelLayer.visible = true;

		const floorWhere_FloorsLayer = buildFloorWhere(floorLayer, floorNums);
		const floorWhere_ParcelsLayer = floorNums.length
			? `NOT (${floorWhere_FloorsLayer})`
			: "1=1";

		const combinedFloorsWhere = withCondoSubtypeWhere(floorLayer, `${currentBuildingWhere} AND (${floorWhere_FloorsLayer})`);
		const combinedParcelsWhere = withCondoSubtypeWhere(condoLayer, `${currentBuildingWhere} AND (${floorWhere_ParcelsLayer})`);
		const sameCondoAndFloorLayer = condoLayer && floorLayer && condoLayer === floorLayer;

		if (floorLayer) {
			try {
				const lvFloors = await sceneView.whenLayerView(floorLayer);
				lvFloors.filter = new FeatureFilter({ where: combinedFloorsWhere });
			} catch { }
		}

		if (condoLayer && !sameCondoAndFloorLayer) {
			try {
				const lvParcels = await sceneView.whenLayerView(condoLayer);
				lvParcels.filter = new FeatureFilter({ where: combinedParcelsWhere });
			} catch { }
		}
	}

	async function renderFloorsForBuilding(features) {
		floorListEl.innerHTML = "";

		const floorMap = new Map();

		features.forEach((feature) => {
			const floorKey = getFloorKey(feature.attributes);
			if (floorKey === null || floorKey === undefined || floorKey === "") return;
			floorMap.set(String(floorKey), String(floorKey));
		});

		const floors = [...floorMap.entries()].sort((a, b) => {
			const numA = Number(a[0]);
			const numB = Number(b[0]);
			if (Number.isFinite(numA) && Number.isFinite(numB)) return numA - numB;
			if (Number.isFinite(numA)) return 1;
			if (Number.isFinite(numB)) return -1;
			return String(a[0]).localeCompare(String(b[0]));
		});

		const group = document.createElement("calcite-chip-group");
		group.selectionMode = "multiple";
		group.label = "Floors";
		floorListEl.appendChild(group);

		floors.forEach(([fl, floorLabel]) => {
			const chip = document.createElement("calcite-chip");
			chip.textContent = floorLabel;
			chip.dataset.floor = fl;

			chip.addEventListener("click", () => {
				chip.classList.toggle("selected");
				handleFloorSelection();
			});

			group.appendChild(chip);
		});

		document.getElementById("floorPanel").style.display = "block";
	}

	async function handleFloorSelection() {
		const floorLayer = getFloorLayer();
		const sceneView = getSceneView();

		document.getElementById("parcelPanel").style.display = "block";
		parcelListEl.innerHTML = "";

		const selectedFloorNums = Array.from(
			floorListEl.querySelectorAll("calcite-chip.selected")
		).map((chip) => chip.dataset.floor);

		if (!selectedFloorNums.length) {
			await applyFloorFilter([]);
			document.getElementById("parcelPanel").style.display = "none";
			return;
		}

		const whereClause = withCondoSubtypeWhere(floorLayer, `${currentBuildingWhere} AND (${buildFloorWhere(floorLayer, selectedFloorNums)})`);

		const floorRes = await floorLayer.queryFeatures({
			where: whereClause,
			outFields: ["*"],
			returnGeometry: true
		});

		const floorFeatures = floorRes.features || [];

		selectedFloorNums.forEach((fn) => {
			const headerDiv = document.createElement("div");
			headerDiv.style.margin = "8px 0 4px";
			headerDiv.style.fontWeight = "bold";
			headerDiv.style.color = "#fff";
			headerDiv.textContent = "Floor " + fn;
			parcelListEl.appendChild(headerDiv);

			const parcels = floorFeatures.filter(
				(f) => String(getFloorKey(f.attributes)) === String(fn)
			).sort((a, b) => String(getParcelName(a.attributes) || "").localeCompare(String(getParcelName(b.attributes) || "")));

			parcels.forEach((p) => {
				const parcelName = getParcelName(p.attributes);
				try { p.layer = p.layer || floorLayer; } catch {}
				const divP = document.createElement("div");
				divP.className = "parcel-list-item";
				divP.textContent = parcelName;
				divP.dataset.name = parcelName;
				divP.dataset.selectionKey = getSelectionKey(p);

				divP.onclick = async () => {
					await switchTo3D();
					await toggleParcelSelection(p);
					await zoomToSelectedParcelIn3D(p);
				};

				parcelListEl.appendChild(divP);
			});
		});

		await applyFloorFilter(selectedFloorNums);

		parcelSearchEl.value = "";
		parcelSearchEl.oninput = () => {
			const filter = parcelSearchEl.value.toLowerCase();
			Array.from(parcelListEl.querySelectorAll(".parcel-list-item")).forEach((child) => {
				child.style.display = child.textContent.toLowerCase().includes(filter) ? "" : "none";
			});
		};

		syncParcelListSelection();
	}

	// ---- Building selection (forces 3D + zoom) --------------------------------

	async function handleBuildingSelection(cartogNote, div, {
		resetIfAlreadySelected = true,
		clearExistingSelections = true
	} = {}) {
		const condoLayer = getCondoLayer();
		const floorLayer = getFloorLayer();
		const ESRILayer = getESRILayer();
		const parcelLayer = getParcelLayer();
		const sceneView = getSceneView();

		await switchTo3D();

		if (!condoLayer) {
			alert("Condo layer not found in 3D scene.");
			return;
		}

		if (floorLayer) floorLayer.visible = true;
		if (condoLayer) condoLayer.visible = true;
		if (ESRILayer) ESRILayer.visible = false;
		if (parcelLayer && parcelLayer !== floorLayer) parcelLayer.visible = false;

		// Same building clicked again => reset
		const isAlreadySelected = div.classList.contains("selected");
		if (isAlreadySelected) {
			if (!resetIfAlreadySelected) {
				return true;
			}

			resetBuildingListAfterDeselection();
			floorListEl.innerHTML = "";
			parcelListEl.innerHTML = "";
			document.getElementById("floorPanel").style.display = "none";
			document.getElementById("parcelPanel").style.display = "none";

			currentBuildingExtent = null;
			allFeaturesForBuilding = [];
			currentBuildingWhere = null;

			try {
				if (condoLayer) (await sceneView.whenLayerView(condoLayer)).filter = null;
				if (floorLayer) (await sceneView.whenLayerView(floorLayer)).filter = null;
			} catch { }

			sceneView.graphics.removeAll();
			await clearParcelSelections();
			return true;
		}

		// Collapse list to just this building
		Array.from(buildingListEl.children).forEach(
			(el) => (el.style.display = el === div ? "" : "none")
		);

		clearSelection(buildingListEl);
		div.classList.add("selected");

		clearFloorSelection();
		clearSelection(parcelListEl);

		if (clearExistingSelections) {
			await clearParcelSelections();
		}

		floorListEl.innerHTML = "";
		parcelListEl.innerHTML = "";
		document.getElementById("parcelPanel").style.display = "none";

		const safeCartog = escapeSql(cartogNote);
		currentBuildingWhere = `CartogNote = '${safeCartog}'`;

		const res = await condoLayer.queryFeatures({
			where: withCondoSubtypeWhere(condoLayer, currentBuildingWhere),
			outFields: ["*"],
			returnGeometry: true
		});

		allFeaturesForBuilding = res.features || [];
		if (floorLayer && floorLayer !== condoLayer) {
			const hasFloorFeatures = allFeaturesForBuilding.some(
				(feature) => getFloorKey(feature.attributes) != null
			);

			if (!hasFloorFeatures) {
				try {
					const floorRes = await floorLayer.queryFeatures({
						where: withCondoSubtypeWhere(floorLayer, currentBuildingWhere),
						outFields: ["*"],
						returnGeometry: true
					});
					if (floorRes.features?.length) {
						allFeaturesForBuilding = floorRes.features;
					}
				} catch (error) {
					console.warn("Unable to query condo floor details for building selection.", error);
				}
			}
		}

		if (!allFeaturesForBuilding.length) {
			alert("No features found for building.");
			return false;
		}

		currentBuildingExtent = await zoomToBuildingExtent(allFeaturesForBuilding);

		// Apply building filter
		if (condoLayer) {
			const lvCondo = await sceneView.whenLayerView(condoLayer);
			lvCondo.filter = new FeatureFilter({ where: currentBuildingWhere });
		}
		if (floorLayer) {
			const lvFloors = await sceneView.whenLayerView(floorLayer);
			lvFloors.filter = new FeatureFilter({ where: currentBuildingWhere });
		}

		await renderFloorsForBuilding(allFeaturesForBuilding);
		document.getElementById("floorPanel").style.display = "block";
		return true;
	}

	// ---- 3D camera zoom / orientation ----------------------------------------

	async function zoomToBuildingExtent(features) {
		const sceneView = getSceneView();

		// Union extent
		const parcelExtent = (features || []).reduce((acc, f) => {
			if (!f.geometry) return acc;
			const ex = f.geometry.extent;
			return acc ? acc.union(ex) : ex.clone();
		}, null);

		if (!parcelExtent) {
			console.debug("[3D zoom] zoomToBuildingExtent: no geometry available, skipping extent zoom.");
			return null;
		}

		const floors = (features || [])
			.map((f) => Number(getFloorDesignator(f.attributes)))
			.filter((f) => !isNaN(f));
		const maxFloor = floors.length ? Math.max(...floors) : 1;
		const buildingHeight = maxFloor * 10;
		const footprintSize = Math.max(parcelExtent.width, parcelExtent.height);
		const heightRatio = buildingHeight / (footprintSize || 1);

		let expandMultiplier = 2.2;
		if (heightRatio > 1) expandMultiplier += heightRatio * 0.5;

		const expanded = parcelExtent.expand(expandMultiplier);

		console.debug("[3D zoom] zoomToBuildingExtent:", { maxFloor, buildingHeight, footprintSize, heightRatio, expandMultiplier });

		await sceneView.goTo({ target: expanded, tilt: 70 }, { easing: "in-out-cubic" });
		return parcelExtent;
	}

	async function orientCameraToParcel(feature) {
		const sceneView = getSceneView();
		const condoFloorLayer = getFloorLayer?.() || getCondoLayer?.();

		if (!sceneView) return;

		if (!condoFloorLayer) {
			console.warn("[3D zoom] orientCameraToParcel: condo floor layer not found, skipping orientation.");
			return;
		}

		const parcelName = getParcelName(feature?.attributes);
		if (!parcelName) {
			console.warn("[3D zoom] orientCameraToParcel: feature has no Name attribute to match against condo floor layer.");
			return;
		}

		let condoFloorFeature = null;
		try {
			await condoFloorLayer.load();
			const safeName = String(parcelName).replace(/'/g, "''");
			const res = await condoFloorLayer.queryFeatures({
				where: `Name = '${safeName}'`,
				outFields: ["*"],
				outSpatialReference: sceneView.spatialReference,
				returnGeometry: true,
				num: 1
			});
			condoFloorFeature = res.features?.[0] || null;
		} catch (error) {
			console.warn("[3D zoom] orientCameraToParcel: failed to query condo floor layer.", error);
			return;
		}

		if (!condoFloorFeature) {
			console.warn(`[3D zoom] orientCameraToParcel: no condo floor record found for Name='${parcelName}'.`);
			return;
		}

		console.debug("[3D zoom] orientCameraToParcel: matched condo floor attributes:", condoFloorFeature.attributes);

		const direction = getAttributeCaseInsensitive(condoFloorFeature.attributes, "Direction");
		const heading = DIRECTION_TO_HEADING[String(direction || "").toUpperCase()];

		if (heading === undefined) {
			console.warn(`[3D zoom] orientCameraToParcel: unrecognized Direction value "${direction}" for parcel "${parcelName}".`);
			return;
		}

		const geometry = condoFloorFeature.geometry || feature.geometry;
		if (!geometry) {
			console.warn("[3D zoom] orientCameraToParcel: no geometry available for parcel, skipping orientation.");
			return;
		}

		const targetBase = geometry.centroid ?? geometry.extent.center;

		const elevationInfo = condoFloorFeature.layer?.elevationInfo || condoFloorLayer.elevationInfo;
		const elevationOffsetFeet = elevationInfo?.offset ?? 0;
		const floorHeightFeet = (getAttributeCaseInsensitive(condoFloorFeature.attributes, "FloorDesignator") ?? getAttributeCaseInsensitive(condoFloorFeature.attributes, "FloorNameDesignator") ?? 0) * 10;

		let groundElevation = 0;
		try {
			const groundResult = await sceneView.map.ground.queryElevation(targetBase);
			groundElevation = groundResult?.geometry?.z ?? 0;
		} catch (error) {
			console.warn("[3D zoom] orientCameraToParcel: ground elevation query failed, defaulting to 0.", error);
		}

		const extrusionHeightMeters = getExtrusionHeightMeters(condoFloorFeature.layer || condoFloorLayer, 1.5);

		const parcelBaseZ = groundElevation + (floorHeightFeet + elevationOffsetFeet) * FEET_TO_METERS;
		const targetZ = parcelBaseZ + extrusionHeightMeters / 2;

		const target = {
			x: targetBase.x,
			y: targetBase.y,
			z: targetZ,
			spatialReference: sceneView.spatialReference
		};

		const camera = sceneView.camera;
		const tilt = camera.tilt;
		const dx = camera.position.x - target.x;
		const dy = camera.position.y - target.y;
		const dz = camera.position.z - target.z;
		const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

		const tiltRad = (tilt * Math.PI) / 180;
		const headingRad = (heading * Math.PI) / 180;
		const horizontal = distance * Math.sin(tiltRad);

		const newPosition = {
			x: target.x - horizontal * Math.sin(headingRad),
			y: target.y - horizontal * Math.cos(headingRad),
			z: target.z + distance * Math.cos(tiltRad),
			spatialReference: sceneView.spatialReference
		};

		console.debug("[3D zoom] orientCameraToParcel:", {
			parcelName, direction, heading, floorHeightFeet, elevationOffsetFeet,
			groundElevation, extrusionHeightMeters, targetZ, distance, tilt, newPosition
		});

		try {
			await sceneView.goTo({ position: newPosition, heading, tilt }, { duration: 1500 });
		} catch (error) {
			if (error?.name !== "AbortError") {
				console.error("[3D zoom] orientCameraToParcel: goTo failed.", error);
			}
		}
	}

	async function zoomToSelectedParcelIn3D(feature) {
		if (!feature) return;

		const sceneView = getSceneView();
		if (!sceneView) return;

		try {
			const cartogNote = getCartogNote(feature.attributes);
			const safeCartog = cartogNote != null ? `CartogNote = '${escapeSql(cartogNote)}'` : null;
			const buildingAlreadyFramed = !!cartogNote && safeCartog === currentBuildingWhere;

			console.debug("[3D zoom] zoomToSelectedParcelIn3D: start", {
				name: getParcelName(feature.attributes), cartogNote, buildingAlreadyFramed
			});

			if (!buildingAlreadyFramed && cartogNote != null) {
				const condoLayer = getCondoLayer();
				if (condoLayer) {
					const res = await condoLayer.queryFeatures({
						where: withCondoSubtypeWhere(condoLayer, safeCartog),
						outFields: ["*"],
						returnGeometry: true
					});
					await zoomToBuildingExtent(res.features || []);
				}
			} else {
				console.debug("[3D zoom] zoomToSelectedParcelIn3D: skipping building extent stage (already framed or no CartogNote).");
			}

			await orientCameraToParcel(feature);

			console.debug("[3D zoom] zoomToSelectedParcelIn3D: complete");
		} catch (error) {
			console.error("[3D zoom] zoomToSelectedParcelIn3D: unexpected error.", error);
		}
	}

	// ---- Programmatic building → floor → parcel navigation ------------------

	async function selectBuildingFloorContext(feature, {
		clearExistingSelections = true,
		clearSameBuildingSelections = clearExistingSelections
	} = {}) {
		feature = await resolveCondoFloorFeature(feature);
		if (!feature) return false;

		const cartogNote = getCartogNote(feature?.attributes);
		const floorNum = String(getFloorKey(feature?.attributes) ?? "");
		const parcelName = getParcelName(feature?.attributes);
		if (!cartogNote || !floorNum) {
			console.warn("Condo search result is missing fields needed for the building/floor panel.", {
				hasCartogNote: !!cartogNote,
				floorNum,
				parcelName,
				attributes: feature?.attributes
			});
			return false;
		}

		openLeftSidebar();
		await switchTo3D();
		await populateBuildingList();

		// BUILDING
		const buildingDiv = ensureBuildingButton(cartogNote);
		if (!buildingDiv) return false;
		filterBuildingListToName(cartogNote);

		const isSameBuilding = buildingDiv.classList.contains("selected");
		if (isSameBuilding) {
			if (clearSameBuildingSelections) {
				await clearParcelSelections();
			}

			if (!findFloorChip(floorNum)) {
				buildingDiv.classList.remove("selected");
				const buildingSelected = await handleBuildingSelection(cartogNote, buildingDiv, {
					resetIfAlreadySelected: false,
					clearExistingSelections: false
				});
				if (!buildingSelected) return false;
				filterBuildingListToName(cartogNote);
			}
		} else {
			const buildingSelected = await handleBuildingSelection(cartogNote, buildingDiv, {
				resetIfAlreadySelected: false,
				clearExistingSelections
			});
			if (!buildingSelected) return false;
			filterBuildingListToName(cartogNote);
		}

		// Wait one frame so floor chips exist after a building change.
		await new Promise((r) => requestAnimationFrame(r));

		// FLOOR
		let floorChip = findFloorChip(floorNum);
		if (!floorChip) {
			console.warn("Unable to find floor chip for condo search result.", {
				parcelName,
				cartogNote,
				floorNum,
				availableFloors: Array.from(floorListEl.querySelectorAll("calcite-chip")).map((chip) => chip.dataset.floor)
			});
			return false;
		}

		clearFloorSelection();
		floorChip.classList.add("selected");
		floorChip.selected = true;

		await handleFloorSelection();

		// Wait one frame so parcel list exists after floor selection.
		await new Promise((r) => requestAnimationFrame(r));

		if (parcelName) {
			const selectionKey = getSelectionKey(feature);
			const parcelDiv = Array.from(parcelListEl.querySelectorAll(".parcel-list-item")).find(
				(d) => d.dataset.selectionKey === selectionKey || (!d.dataset.selectionKey && d.dataset.name === parcelName)
			);
			if (parcelDiv) {
				clearSelection(parcelListEl);
				parcelDiv.classList.add("selected");
				parcelDiv.scrollIntoView?.({ block: "nearest" });
			} else {
				console.warn("Unable to find parcel row for condo search result.", {
					parcelName,
					cartogNote,
					floorNum,
					availableParcels: Array.from(parcelListEl.querySelectorAll(".parcel-list-item")).map((div) => div.dataset.name)
				});
			}
		}

		return true;
	}

	async function selectBuildingFloorParcel(feature) {
		const condoFeature = await resolveCondoFloorFeature(feature);
		if (!condoFeature) return false;

		const contextSelected = await selectBuildingFloorContext(condoFeature, {
			clearExistingSelections: true
		});
		if (!contextSelected) {
			console.warn("Unable to sync search result with building/floor list; selecting condo directly.", condoFeature?.attributes);
			return false;
		}

		await toggleParcelSelection(condoFeature);
		await zoomToSelectedParcelIn3D(condoFeature);
		return true;
	}

	// ---- Map click handler --------------------------------------------------

	function attachViewClickHandler(v) {
		const floorLayer = getFloorLayer();
		const regularParcelLayer = getRegularParcelLayer();
		const sceneView = getSceneView();

		v.on("click", async (event) => {
			if (getCurrentPage() !== "parcel") return;

			const hit = await v.hitTest(event);

			// 3D condo/floor clicks
			if (v === sceneView) {
				const result = hit.results.find(
					(r) => r.graphic?.layer && (r.graphic.layer === getFloorLayer() || r.graphic.layer === getCondoLayer())
				);
				if (!result) return;
				const feature = await resolveFloorFeature(result.graphic);
				const contextSelected = await selectBuildingFloorContext(feature, {
					clearExistingSelections: true,
					clearSameBuildingSelections: false
				});
				if (!contextSelected) {
					console.warn("Unable to sync 3D parcel with building/floor list.", feature.attributes);
				}
				await toggleParcelSelection(feature);
				await zoomToSelectedParcelIn3D(feature);
				return;
			}

			// 2D regular parcel clicks
			const regLayer = getRegularParcelLayer();
			const result = hit.results.find(
				(r) => r.graphic?.layer && regLayer && r.graphic.layer === regLayer
			);
			if (!result) return;

			const oid = result.graphic.attributes?.OBJECTID;
			if (oid == null) return;

			const res = await regLayer.queryFeatures({
				where: `OBJECTID = ${oid}`,
				outFields: ["*"],
				returnGeometry: true
			});

			const feature = res.features?.[0];
			if (!feature) return;

			await toggleParcelSelection(feature);
		});
	}

	// ---- Building list population -------------------------------------------

	async function populateBuildingList() {
		if (buildingListLoadPromise) return buildingListLoadPromise;

		buildingListLoadPromise = (async () => {
			const buildingSourceLayer = getBuildingListLayer() || getCondoLayer() || getFloorLayer();
			const renderToken = ++buildingRenderToken;

			if (!buildingSourceLayer) {
				buildingListEl.innerHTML =
					"<div style='opacity:.7;font-size:12px;'>Building list source unavailable.</div>";
				return;
			}

			await buildingSourceLayer.load?.();

			const res = await buildingSourceLayer.queryFeatures({
				where: withCondoSubtypeWhere(buildingSourceLayer, "CartogNote IS NOT NULL"),
				outFields: ["CartogNote"],
				returnDistinctValues: true,
				returnGeometry: false
			});

			const buildings = res.features
				.map((f) => getCartogNote(f.attributes))
				.filter(Boolean)
				.sort();

			allBuildingNames = buildings;
			renderedBuildingNames = new Set();
			buildingListEl.innerHTML = "";
			appendBuildingButtons(buildings.slice(0, INITIAL_BUILDING_RENDER_COUNT));
			scheduleRemainingBuildingRender(INITIAL_BUILDING_RENDER_COUNT, renderToken);

			if (!buildingSearchEl.dataset.wired) {
				buildingSearchEl.dataset.wired = "true";
				buildingSearchEl.addEventListener("input", applyBuildingSearchFilter);
			}

			applyBuildingSearchFilter();
		})().catch((error) => {
			console.warn("Building list could not be loaded.", error);
			buildingListLoadPromise = null;
			if (buildingListEl) {
				buildingListEl.innerHTML =
					"<div style='opacity:.7;font-size:12px;'>Building list could not be loaded.</div>";
			}
		});

		return buildingListLoadPromise;
	}

	return {
		populateBuildingList,
		attachViewClickHandler,
		selectBuildingFloorParcel,
		zoomToSelectedParcelIn3D
	};
}
