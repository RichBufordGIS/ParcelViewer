import { getSelectionKey } from "./utils.js";

// 3D building / floor selection logic extracted from main.js.
// Factory: call initBuildingSelection(refs) after layer refs and views are ready.
// Returns { populateBuildingList, attachViewClickHandler, selectBuildingFloorParcel, zoomToSelectedParcelIn3D }.

const DIRECTION_TO_HEADING = { N: 180, S: 0, E: 270, W: 90 };
const CONDO_SUBTYPE_WHERE = "ParcelSubtype IN (2, 4)";
const CONDO_CAMERA_TILT = 70;
const CONDO_BUILDING_CAMERA_TILT = 62;
const CONDO_FLOOR_HEIGHT_METERS = 3.048;
const ESRI_BUILDINGS_CLIP_EXTENT_MULTIPLIER = 1.12;
const BUILDING_REVEAL_DURATION_MS = 280;
const BUILDING_REVEAL_DELAY_MS = 20;
const BUILDING_ZOOM_DURATION_MS = 950;
const FLOOR_REVEAL_DURATION_MS = 180;
const FLOOR_REVEAL_DELAY_MS = 15;
const STAGE_HANDOFF_DELAY_MS = 30;
const STAGE_PULSE_MS = 520;
const CONDO_WORKFLOW_HIDE_DELAY_MS = 260;
const BUILDING_FRAME_MIN_EXPAND = 3.6;
const SELECTED_PARCEL_BUILDING_CONTEXT_EXPAND = 1.18;
const CONDO_SCENE_VIEW_BUILDING = "building";
const CONDO_SCENE_VIEW_FLOOR_PLAN = "floor-plan";
const CONDO_FLOOR_PLAN_TILT = 18;
const CONDO_MULTI_FLOOR_PLAN_TILT = 48;
const CONDO_FLOOR_PLAN_EXPAND = 1.55;
const FOCUS_AREA_SIZE_MULTIPLIER = 3.2;
const FOCUS_AREA_MIN_METERS = 75;
const FOCUS_AREA_MAX_METERS = 170;
const FOCUS_AREA_MIN_FEET = 250;
const FOCUS_AREA_MAX_FEET = 560;

	function emitCondoSelectionGeometry(feature, geometry) {
		const extentJson = geometry?.extent?.toJSON?.();
		if (!extentJson) return;

	window.dispatchEvent(new CustomEvent("parcelviewer:condo-selection-geometry", {
		detail: {
			parcelName: getAttributeCaseInsensitive(feature?.attributes, "Name"),
			parcelId: getAttributeCaseInsensitive(feature?.attributes, "parcel_id"),
			extent: extentJson
		}
	}));
}

	function emitCondoWorkflowState(active, detail = {}) {
		window.dispatchEvent(new CustomEvent("parcelviewer:condo-workflow-state", {
			detail: { active, ...detail }
		}));
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
 * @param {Function} refs.closeLeftSidebar         () => void
 * @param {Function} refs.getCurrentPage           () => string
 * @param {class}    refs.FeatureFilter            ArcGIS FeatureFilter class
 * @param {class}    refs.SceneFilter              ArcGIS SceneFilter class
 * @param {object}   refs.projectOperator          ArcGIS projectOperator module
 * @param {class}    refs.PolygonClass             ArcGIS Polygon class
 * @param {class}    refs.GraphicClass             ArcGIS Graphic class
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
	switchTo2D,
	toggleParcelSelection,
	clearHighlightsAndSets,
	clearSelectedParcels,
	clearAllSelectedParcels,
	syncParcelListSelection,
	openLeftSidebar,
	closeLeftSidebar,
	getCurrentPage,
	FeatureFilter,
	SceneFilter,
	projectOperator,
	PolygonClass,
	GraphicClass,
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
	let condoRevealAnimationToken = 0;
	let esriBuildingsClipToken = 0;
	let esriBuildingsOriginalDefinitionExpression;
	let esriBuildingsFocusGraphic = null;
	const condoLayerOriginalOpacity = new Map();
	const condoLayerOriginalElevationInfo = new Map();
	let condoWorkflowOverlayEl = null;
	let condoWorkflowToken = 0;
	let condoSceneViewMode = CONDO_SCENE_VIEW_FLOOR_PLAN;
	let lastSelectedCondoFeature = null;

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

	function pulseStageElement(element) {
		if (!element) return;
		element.classList.remove("workflow-stage-active");
		void element.offsetWidth;
		element.classList.add("workflow-stage-active");
		window.setTimeout(() => {
			element.classList.remove("workflow-stage-active");
		}, STAGE_PULSE_MS);
	}

	function syncCondoSceneViewToggle() {
		const toggle = document.getElementById("condoSceneViewToggle");
		if (!toggle) return;

		toggle.querySelectorAll("[data-condo-scene-view]").forEach((button) => {
			const active = button.dataset.condoSceneView === condoSceneViewMode;
			button.classList.toggle("active", active);
			button.setAttribute("aria-pressed", active ? "true" : "false");
		});
	}

	function wireCondoSceneViewToggle() {
		const toggle = document.getElementById("condoSceneViewToggle");
		if (!toggle || toggle.dataset.wired) return;
		toggle.dataset.wired = "true";

		toggle.addEventListener("click", async (event) => {
			const button = event.target?.closest?.("[data-condo-scene-view]");
			if (!button) return;

			const mode = button.dataset.condoSceneView === CONDO_SCENE_VIEW_FLOOR_PLAN
				? CONDO_SCENE_VIEW_FLOOR_PLAN
				: CONDO_SCENE_VIEW_BUILDING;
			await setCondoSceneViewMode(mode);
		});

		syncCondoSceneViewToggle();
	}

	function getCondoWorkflowOverlay() {
		if (condoWorkflowOverlayEl?.isConnected) return condoWorkflowOverlayEl;

		condoWorkflowOverlayEl = document.createElement("div");
		condoWorkflowOverlayEl.className = "condo-workflow-overlay";
		condoWorkflowOverlayEl.hidden = true;
		condoWorkflowOverlayEl.setAttribute("aria-live", "polite");
		condoWorkflowOverlayEl.innerHTML = `
			<div class="condo-workflow-card">
				<div class="condo-workflow-eyebrow">Condo Search Initiated</div>
				<div class="condo-workflow-title">Preparing 3D condo view</div>
				<div class="condo-workflow-subtitle" data-condo-workflow-subtitle></div>
				<div class="condo-workflow-steps">
					<div class="condo-workflow-step" data-step="building"><span></span><div><strong>Selecting building</strong><small data-step-detail="building"></small></div></div>
					<div class="condo-workflow-step" data-step="floor"><span></span><div><strong>Selecting floor</strong><small data-step-detail="floor"></small></div></div>
					<div class="condo-workflow-step" data-step="parcel"><span></span><div><strong>Selecting parcel</strong><small data-step-detail="parcel"></small></div></div>
					<div class="condo-workflow-step" data-step="scene"><span></span><div><strong>Focusing scene</strong><small data-step-detail="scene"></small></div></div>
				</div>
			</div>
		`;
		document.body.appendChild(condoWorkflowOverlayEl);
		return condoWorkflowOverlayEl;
	}

	function setCondoWorkflowStage(stage, {
		buildingName = "",
		floorName = "",
		parcelName = "",
		message = ""
	} = {}) {
		const overlay = getCondoWorkflowOverlay();
		const stageOrder = ["building", "floor", "parcel", "scene"];
		const activeIndex = Math.max(0, stageOrder.indexOf(stage));

		overlay.hidden = false;
		overlay.classList.add("visible");

		const subtitle = overlay.querySelector("[data-condo-workflow-subtitle]");
		if (subtitle) {
			subtitle.textContent = message || [
				buildingName ? `Building ${buildingName}` : "",
				floorName ? `Floor ${floorName}` : "",
				parcelName ? `Parcel ${parcelName}` : ""
			].filter(Boolean).join(" | ");
		}

		const details = {
			building: buildingName,
			floor: floorName ? `Floor ${floorName}` : "",
			parcel: parcelName,
			scene: parcelName ? `Orienting to ${parcelName}` : ""
		};

		stageOrder.forEach((step, index) => {
			const stepEl = overlay.querySelector(`[data-step="${step}"]`);
			const detailEl = overlay.querySelector(`[data-step-detail="${step}"]`);
			if (!stepEl) return;
			stepEl.classList.toggle("complete", index < activeIndex);
			stepEl.classList.toggle("active", index === activeIndex);
			if (detailEl) detailEl.textContent = details[step] || "";
		});
	}

	function showCondoWorkflowOverlay(details) {
		condoWorkflowToken += 1;
		emitCondoWorkflowState(true, { token: condoWorkflowToken });
		setCondoWorkflowStage("building", {
			...details,
			message: "Finding the selected condo building"
		});
		return condoWorkflowToken;
	}

	function isCondoWorkflowCandidate(feature) {
		const attrs = feature?.attributes || {};
		const layerTitle = String(feature?.layer?.title || "");
		return layerTitle.includes("Condominiums") ||
			[2, 4].includes(Number(attrs.ParcelSubtype)) ||
			!!getCartogNote(attrs) ||
			getFloorKey(attrs) != null;
	}

	async function hideCondoWorkflowOverlay(token, { complete = false, errorMessage = "" } = {}) {
		if (token !== condoWorkflowToken) return;
		if (complete) {
			setCondoWorkflowStage("scene", { message: "Condo parcel selected" });
			await delay(CONDO_WORKFLOW_HIDE_DELAY_MS);
		} else if (errorMessage) {
			const overlay = getCondoWorkflowOverlay();
			const subtitle = overlay.querySelector("[data-condo-workflow-subtitle]");
			if (subtitle) subtitle.textContent = errorMessage;
			await delay(1100);
		}

		const overlay = getCondoWorkflowOverlay();
		overlay.classList.remove("visible");
		window.setTimeout(() => {
			if (token !== condoWorkflowToken) return;
			overlay.hidden = true;
			emitCondoWorkflowState(false, { token, holdMs: 1800 });
		}, 180);
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

	function rememberLayerOpacity(layer) {
		if (!layer || condoLayerOriginalOpacity.has(layer)) return;
		condoLayerOriginalOpacity.set(layer, typeof layer.opacity === "number" ? layer.opacity : 1);
	}

	function getRememberedLayerOpacity(layer) {
		if (!layer) return 1;
		return condoLayerOriginalOpacity.has(layer) ? condoLayerOriginalOpacity.get(layer) : 1;
	}

	function restoreCondoLayerOpacity(layers) {
		(layers || []).filter(Boolean).forEach((layer) => {
			layer.opacity = getRememberedLayerOpacity(layer);
		});
	}

	async function getGroundElevationAtCentroidMeters(geometry) {
		const sceneView = getSceneView();
		const centroid = geometry?.centroid || geometry?.extent?.center;
		if (!sceneView?.map?.ground?.queryElevation || !centroid) return 0;

		try {
			const result = await sceneView.map.ground.queryElevation(centroid);
			const elevationGeometry = result?.geometry || result;
			const z = Number(elevationGeometry?.z);
			return Number.isFinite(z) ? z : 0;
		} catch (error) {
			console.warn("Unable to query ground elevation for condo centroid.", error);
			return 0;
		}
	}

	function rememberLayerElevationInfo(layer) {
		if (!layer || condoLayerOriginalElevationInfo.has(layer)) return;
		condoLayerOriginalElevationInfo.set(layer, layer.elevationInfo?.clone?.() || layer.elevationInfo || null);
	}

	function restoreCondoLayerElevationInfo(layers) {
		(layers || []).filter(Boolean).forEach((layer) => {
			if (!condoLayerOriginalElevationInfo.has(layer)) return;
			layer.elevationInfo = condoLayerOriginalElevationInfo.get(layer);
		});
	}

	async function applyFlatCondoElevationInfo(features) {
		const condoLayer = getCondoLayer();
		const floorLayer = getFloorLayer();
		const layers = [...new Set([condoLayer, floorLayer].filter(Boolean))];
		if (!layers.length || !features?.length) return;

		const buildingGeometry = buildBuildingClipGeometry(features) || features[0]?.geometry;
		const baseZ = await getGroundElevationAtCentroidMeters(buildingGeometry);
		const floorOffsetExpression = `
			var floor2 = DefaultValue($feature.FloorDesignator, $feature.FloorNameDesignator);
			var floorText = Upper(Text(DefaultValue(floor2, 0)));
			var floorNum = Number(floorText);
			if (Find("SUB", floorText) >= 0) {
				floorNum = -2;
			} else if (Find("BASEMENT", floorText) >= 0 || Find("LOWER", floorText) >= 0) {
				floorNum = -1;
			} else if (IsNan(floorNum)) {
				floorNum = 0;
			}
			return floorNum * ${CONDO_FLOOR_HEIGHT_METERS};
		`;

		layers.forEach((layer) => {
			rememberLayerElevationInfo(layer);
			layer.elevationInfo = {
				mode: "absolute-height",
				offset: baseZ,
				featureExpressionInfo: { expression: floorOffsetExpression },
				unit: "meters"
			};
		});
	}

	function prepareSelectedCondoReveal(layers) {
		condoRevealAnimationToken += 1;
		[...new Set((layers || []).filter(Boolean))].forEach((layer) => {
			rememberLayerOpacity(layer);
			layer.opacity = 0;
		});
		return condoRevealAnimationToken;
	}

	function delay(ms) {
		return new Promise((resolve) => window.setTimeout(resolve, ms));
	}

	async function waitForSceneLayout(sceneView) {
		sceneView?.resize?.();
		await new Promise((resolve) => requestAnimationFrame(resolve));
		sceneView?.resize?.();
		await new Promise((resolve) => requestAnimationFrame(resolve));
	}

	async function goToOrContinue(view, target, options, timeoutMs = 1800) {
		if (!view?.goTo) return;

		let didTimeout = false;
		try {
			await Promise.race([
				view.goTo(target, options),
				delay(timeoutMs).then(() => {
					didTimeout = true;
				})
			]);
		} catch (error) {
			if (error?.name !== "AbortError") throw error;
		}

		if (didTimeout) {
			console.warn("[3D zoom] goTo did not finish before timeout; continuing condo workflow.", { target });
		}
	}

	async function withTimeout(promise, timeoutMs, fallbackValue) {
		let timeoutId = null;
		try {
			return await Promise.race([
				promise,
				new Promise((resolve) => {
					timeoutId = window.setTimeout(() => resolve(fallbackValue), timeoutMs);
				})
			]);
		} finally {
			if (timeoutId !== null) window.clearTimeout(timeoutId);
		}
	}

	function revealSelectedCondoLayers(layers, token, {
		durationMs = BUILDING_REVEAL_DURATION_MS,
		delayMs = BUILDING_REVEAL_DELAY_MS
	} = {}) {
		const revealLayers = [...new Set((layers || []).filter(Boolean))];
		if (!revealLayers.length) return Promise.resolve();

		return new Promise((resolve) => {
			const startedAt = performance.now() + delayMs;

			function step(now) {
				if (token !== condoRevealAnimationToken) {
					resolve();
					return;
				}

				const progress = Math.max(0, Math.min(1, (now - startedAt) / durationMs));
				const easedProgress = 1 - Math.pow(1 - progress, 3);

				revealLayers.forEach((layer) => {
					layer.opacity = getRememberedLayerOpacity(layer) * easedProgress;
				});

				if (progress < 1) {
					requestAnimationFrame(step);
					return;
				}

				restoreCondoLayerOpacity(revealLayers);
				resolve();
			}

			requestAnimationFrame(step);
		});
	}

	async function clearEsriBuildingsClip() {
		esriBuildingsClipToken += 1;

		const sceneView = getSceneView();
		const ESRILayer = getESRILayer();
		clearEsriBuildingsFocusArea();
		if (!sceneView || !ESRILayer) return;

		try {
			const esriLayerView = await sceneView.whenLayerView(ESRILayer);
			if ("filter" in ESRILayer) ESRILayer.filter = null;
			esriLayerView.filter = null;
			esriLayerView.effect = null;
			esriLayerView.featureEffect = null;
			if (esriBuildingsOriginalDefinitionExpression !== undefined && "definitionExpression" in ESRILayer) {
				ESRILayer.definitionExpression = esriBuildingsOriginalDefinitionExpression;
			}
			ESRILayer.opacity = 1;
			ESRILayer.visible = true;
		} catch (error) {
			console.warn("Unable to clear Esri 3D Buildings clip filter.", error);
		}
	}

	function clearEsriBuildingsFocusArea() {
		const sceneView = getSceneView();

		try {
			if (esriBuildingsFocusGraphic && sceneView?.graphics?.remove) {
				sceneView.graphics.remove(esriBuildingsFocusGraphic);
			}
		} catch (error) {
			console.warn("Unable to remove Esri Buildings focus graphic.", error);
		}

		esriBuildingsFocusGraphic = null;
	}

	function addEsriBuildingsFocusGraphic(geometry) {
		const sceneView = getSceneView();
		if (!sceneView?.graphics || !geometry) return;

		const graphicProperties = {
			geometry,
			symbol: {
				type: "simple-fill",
				color: [0, 229, 255, 0.12],
				outline: {
					color: [0, 229, 255, 1],
					width: 3
				}
			}
		};

		esriBuildingsFocusGraphic = GraphicClass
			? new GraphicClass(graphicProperties)
			: graphicProperties;
		sceneView.graphics.add(esriBuildingsFocusGraphic);
	}

	function applyEsriBuildingsFocusArea(geometry) {
		if (!geometry) return;

		clearEsriBuildingsFocusArea();
		addEsriBuildingsFocusGraphic(geometry);
		console.debug("Applied selected condo FocusArea graphic.", {
			width: geometry.extent?.width,
			height: geometry.extent?.height
		});
	}

	function buildNotInWhere(fieldName, values) {
		const ids = [...new Set((values || [])
			.map((value) => Number(value))
			.filter((value) => Number.isFinite(value)))];

		if (!ids.length) return "";

		const clauses = [];
		for (let i = 0; i < ids.length; i += 900) {
			clauses.push(`${fieldName} NOT IN (${ids.slice(i, i + 900).join(",")})`);
		}
		return clauses.join(" AND ");
	}

	function spatialReferencesMatch(a, b) {
		if (!a || !b) return true;
		if (a.wkid && b.wkid) return Number(a.wkid) === Number(b.wkid);
		if (a.latestWkid && b.latestWkid) return Number(a.latestWkid) === Number(b.latestWkid);
		return JSON.stringify(a.toJSON?.() || a) === JSON.stringify(b.toJSON?.() || b);
	}

	async function projectGeometryForEsriBuildings(geometry, targetSpatialReference) {
		if (!geometry || !targetSpatialReference || spatialReferencesMatch(geometry.spatialReference, targetSpatialReference)) {
			return geometry;
		}

		if (!projectOperator?.execute) return geometry;

		try {
			await projectOperator.load?.();
			return projectOperator.execute(geometry, targetSpatialReference) || geometry;
		} catch (error) {
			console.warn("Unable to project Esri 3D Buildings clip geometry.", error);
			return geometry;
		}
	}

	async function projectGeometriesForEsriBuildings(geometries, targetSpatialReference) {
		const sourceGeometries = Array.isArray(geometries) ? geometries : [geometries].filter(Boolean);
		const projected = [];

		for (const geometry of sourceGeometries) {
			const projectedGeometry = await projectGeometryForEsriBuildings(geometry, targetSpatialReference);
			if (projectedGeometry) projected.push(projectedGeometry);
		}

		return projected;
	}

	async function queryIntersectingEsriBuildingIds(layer, layerView, geometry) {
		if (!geometry) return [];

		await layer?.load?.();
		const objectIdField = layer.objectIdField || layer.fields?.find?.((field) => field.type === "oid")?.name || "OBJECTID";
		if (layerView?.queryObjectIds) {
			try {
				const viewQuery = layerView.createQuery ? layerView.createQuery() : {};
				viewQuery.geometry = geometry;
				viewQuery.spatialRelationship = "intersects";
				viewQuery.returnGeometry = false;
				viewQuery.outFields = [objectIdField];
				viewQuery.num = 2000;
				const objectIds = await layerView.queryObjectIds(viewQuery);
				if (Array.isArray(objectIds) && objectIds.length) return objectIds;
			} catch (error) {
				console.warn("Unable to query visible Esri 3D Buildings by layer view.", error);
			}
		}

		if (!layer?.queryFeatures) return [];

		const query = layer.createQuery ? layer.createQuery() : {};
		query.geometry = geometry;
		query.spatialRelationship = "intersects";
		query.returnGeometry = false;
		query.outFields = [objectIdField];
		query.num = 2000;

		try {
			const result = await layer.queryFeatures(query);
			return (result.features || [])
				.map((feature) => feature.attributes?.[objectIdField])
				.filter((value) => value !== undefined && value !== null);
		} catch (error) {
			console.warn("Unable to query Esri 3D Buildings service by geometry.", error);
			return [];
		}
	}

	async function applyEsriBuildingsClip(clipGeometry) {
		const sceneView = getSceneView();
		const ESRILayer = getESRILayer();
		if (!sceneView || !ESRILayer || !clipGeometry) return;

		const token = ++esriBuildingsClipToken;
		const clipGeometries = Array.isArray(clipGeometry) ? clipGeometry.filter(Boolean) : [clipGeometry];
		if (!clipGeometries.length) return;

		try {
			const esriLayerView = await sceneView.whenLayerView(ESRILayer);
			if (token !== esriBuildingsClipToken) return;

			if ("filter" in ESRILayer) ESRILayer.filter = null;
			esriLayerView.filter = null;
			esriLayerView.effect = null;
			esriLayerView.featureEffect = null;
			clearEsriBuildingsFocusArea();
			ESRILayer.visible = true;
			ESRILayer.opacity = 1;
			await new Promise((resolve) => requestAnimationFrame(resolve));
			if (token !== esriBuildingsClipToken) return;

			const projectedClipGeometries = await projectGeometriesForEsriBuildings(
				clipGeometries,
				sceneView.spatialReference || ESRILayer.spatialReference
			);
			if (token !== esriBuildingsClipToken) return;

			const filterPolygons = projectedClipGeometries.filter(
				(geometry) => geometry?.type === "polygon" && Array.isArray(geometry.rings) && geometry.rings.length
			);
			if (!filterPolygons.length) {
				console.warn("Skipping Esri 3D Buildings clip because no valid polygon clip geometry was available.");
				return;
			}

			applyEsriBuildingsFocusArea(filterPolygons[0]);

			if (SceneFilter && "filter" in ESRILayer) {
				ESRILayer.filter = new SceneFilter({
					geometries: filterPolygons,
					spatialRelationship: "disjoint"
				});
				esriLayerView.filter = null;
				console.debug("Applied Esri 3D Buildings SceneFilter around selected condo area.", {
					count: filterPolygons.length
				});
				return;
			}

			if ("filter" in ESRILayer) ESRILayer.filter = null;
			esriLayerView.filter = new FeatureFilter({
				geometry: filterPolygons[0],
				spatialRelationship: "disjoint"
			});
			console.debug("Applied Esri 3D Buildings layer-view filter around selected condo area.");
		} catch (error) {
			console.warn("Unable to clip Esri 3D Buildings around selected condo area.", error);
			await clearEsriBuildingsClip();
		}
	}

	function buildBuildingClipGeometry(features) {
		const polygons = (features || [])
			.map((feature) => feature.geometry)
			.filter((geometry) => geometry?.type === "polygon" && Array.isArray(geometry.rings));

		if (!polygons.length) return null;
		if (polygons.length === 1) return polygons[0];

		const base = polygons[0].clone?.() || polygons[0];
		const rings = [];

		polygons.forEach((polygon) => {
			polygon.rings.forEach((ring) => {
				rings.push(ring.map((point) => Array.isArray(point) ? point.slice() : point));
			});
		});

		if (base.clone) {
			const combined = base.clone();
			combined.rings = rings;
			return combined;
		}

		return {
			...base,
			rings
		};
	}

	function extentToClipPolygon(extent) {
		if (!extent) return null;

		if (PolygonClass?.fromExtent) {
			return PolygonClass.fromExtent(extent);
		}

		if (!PolygonClass) return null;

		return new PolygonClass({
			spatialReference: extent.spatialReference,
			rings: [[
				[extent.xmin, extent.ymin],
				[extent.xmin, extent.ymax],
				[extent.xmax, extent.ymax],
				[extent.xmax, extent.ymin],
				[extent.xmin, extent.ymin]
			]]
		});
	}

	function squareExtent(extent) {
		if (!extent) return null;
		const center = extent.center;
		const size = Math.max(extent.width || 0, extent.height || 0);
		if (!center || !size) return extent;

		const halfSize = size / 2;
		const square = extent.clone?.() || extent;
		square.xmin = center.x - halfSize;
		square.xmax = center.x + halfSize;
		square.ymin = center.y - halfSize;
		square.ymax = center.y + halfSize;
		return square;
	}

	function getFocusAreaSizeLimits(spatialReference) {
		const wkid = Number(spatialReference?.wkid || spatialReference?.latestWkid);
		const unitName = String(spatialReference?.unit || spatialReference?.units || "").toLowerCase();
		const usesFeet = unitName.includes("foot") || unitName.includes("feet") || wkid === 102698;

		return usesFeet
			? { min: FOCUS_AREA_MIN_FEET, max: FOCUS_AREA_MAX_FEET }
			: { min: FOCUS_AREA_MIN_METERS, max: FOCUS_AREA_MAX_METERS };
	}

	function clampedFocusExtent(extent) {
		if (!extent) return null;
		const center = extent.center;
		const baseSize = Math.max(extent.width || 0, extent.height || 0);
		if (!center || !baseSize) return extent;

		const limits = getFocusAreaSizeLimits(extent.spatialReference);
		const size = Math.max(limits.min, Math.min(limits.max, baseSize * FOCUS_AREA_SIZE_MULTIPLIER));
		const halfSize = size / 2;
		const square = extent.clone?.() || extent;

		square.xmin = center.x - halfSize;
		square.xmax = center.x + halfSize;
		square.ymin = center.y - halfSize;
		square.ymax = center.y + halfSize;
		return square;
	}

	function buildFocusExtentFromExtent(extent) {
		return clampedFocusExtent(extent);
	}

	function buildEsriBuildingsClipGeometry(features, fallbackExtent) {
		const featureExtents = (features || [])
			.map((feature) => feature.geometry?.extent)
			.filter(Boolean);

		let extent = fallbackExtent?.clone?.() || null;
		featureExtents.forEach((featureExtent) => {
			extent = extent ? extent.union(featureExtent) : featureExtent.clone();
		});

		const expandedExtent = clampedFocusExtent(squareExtent(extent))?.expand?.(ESRI_BUILDINGS_CLIP_EXTENT_MULTIPLIER);
		return extentToClipPolygon(expandedExtent) || buildBuildingClipGeometry(features);
	}

	function getSceneAspectPaddingMultiplier() {
		const sceneView = getSceneView();
		const width = sceneView?.container?.clientWidth || sceneView?.width || 0;
		const height = sceneView?.container?.clientHeight || sceneView?.height || 0;
		if (!width || !height) return 1;

		const aspect = width / height;
		if (aspect >= 1.2) return 1;
		return Math.min(1.45, 1 + (1.2 - aspect) * 0.65);
	}

	function getBuildingHeightRatio(features, extent) {
		const floors = (features || [])
			.map((feature) => Number(getFloorDesignator(feature.attributes)))
			.filter((floor2) => !Number.isNaN(floor2));
		const maxFloor = floors.length ? Math.max(...floors) : 1;
		const buildingHeight = maxFloor * 10;
		const footprintSize = Math.max(extent?.width || 0, extent?.height || 0);

		return {
			maxFloor,
			buildingHeight,
			footprintSize,
			heightRatio: buildingHeight / (footprintSize || 1)
		};
	}

	function getSceneAwareBuildingExpandMultiplier(features, extent, baseMultiplier) {
		const { heightRatio } = getBuildingHeightRatio(features, extent);
		let expandMultiplier = baseMultiplier;
		if (heightRatio > 0.7) expandMultiplier += heightRatio * 1.15;
		expandMultiplier *= getSceneAspectPaddingMultiplier();
		return Math.max(baseMultiplier, Math.min(9, expandMultiplier));
	}

	function buildSelectedParcelCameraTarget(parcelGeometry, focusExtent) {
		const parcelExtent = parcelGeometry?.extent;
		if (!parcelExtent) return parcelGeometry;

		let targetExtent = parcelExtent.clone?.() || parcelExtent;
		if (focusExtent && spatialReferencesMatch(parcelExtent.spatialReference, focusExtent.spatialReference)) {
			targetExtent = targetExtent.union(focusExtent);
		}

		return targetExtent.expand(SELECTED_PARCEL_BUILDING_CONTEXT_EXPAND * getSceneAspectPaddingMultiplier());
	}

	function getFloorPlanCameraTarget(parcelGeometry, floorFeatures = []) {
		const extents = (floorFeatures || [])
			.map((floorFeature) => floorFeature?.geometry?.extent)
			.filter(Boolean);

		if (parcelGeometry?.extent) {
			extents.push(parcelGeometry.extent);
		}

		if (!extents.length) return parcelGeometry;

		let targetExtent = extents[0].clone?.() || extents[0];
		for (let i = 1; i < extents.length; i += 1) {
			targetExtent = targetExtent.union(extents[i]);
		}

		return targetExtent.expand(CONDO_FLOOR_PLAN_EXPAND * getSceneAspectPaddingMultiplier());
	}

	function getSelectedFloorNums() {
		return Array.from(floorListEl?.querySelectorAll?.("calcite-chip.selected") || [])
			.map((chip) => chip.dataset.floor)
			.filter((floor2) => floor2 !== undefined && floor2 !== null && floor2 !== "");
	}

	async function applyBuildingViewFilter() {
		const sceneView = getSceneView();
		const condoLayer = getCondoLayer();
		const floorLayer = getFloorLayer();
		if (!sceneView || !currentBuildingWhere) return;

		const selectedFloorNums = getSelectedFloorNums();
		if (selectedFloorNums.length) {
			await applyFloorFilter(selectedFloorNums);
			return;
		}

		if (condoLayer) {
			try {
				const layerView = await sceneView.whenLayerView(condoLayer);
				layerView.filter = new FeatureFilter({ where: withCondoSubtypeWhere(condoLayer, currentBuildingWhere) });
			} catch { }
		}
		if (floorLayer) {
			try {
				const layerView = await sceneView.whenLayerView(floorLayer);
				layerView.filter = new FeatureFilter({ where: withCondoSubtypeWhere(floorLayer, currentBuildingWhere) });
			} catch { }
		}
	}

	function getFloorPlanFloorNums(feature) {
		const selectedFloorNums = getSelectedFloorNums();
		if (selectedFloorNums.length) return selectedFloorNums;

		const floor2 = String(getFloorKey(feature?.attributes) ?? "").trim();
		return floor2 ? [floor2] : [];
	}

	async function queryFeaturesForFloorPlan(feature, floorNums = getFloorPlanFloorNums(feature)) {
		const sceneView = getSceneView();
		const floorLayer = getFloorLayer() || getCondoLayer();
		if (!sceneView || !floorLayer || !currentBuildingWhere) return [];
		if (!layerSupportsFloorFilter(floorLayer)) return [];

		if (!floorNums.length) return [];

		const where = withCondoSubtypeWhere(
			floorLayer,
			`${currentBuildingWhere} AND (${buildFloorWhere(floorLayer, floorNums)})`
		);

		try {
			const result = await floorLayer.queryFeatures({
				where,
				outFields: ["*"],
				returnGeometry: true,
				outSpatialReference: sceneView.spatialReference,
				num: 2000
			});
			return result.features || [];
		} catch (error) {
			console.warn("Unable to query condo floor plan features.", error);
			return [];
		}
	}

	async function applyFloorPlanFilter(feature, floorNums = getFloorPlanFloorNums(feature)) {
		const sceneView = getSceneView();
		const condoLayer = getCondoLayer();
		const floorLayer = getFloorLayer();
		if (!sceneView || !currentBuildingWhere) return;

		if (!floorNums.length) return;

		if (floorLayer) {
			try {
				const where = layerSupportsFloorFilter(floorLayer)
					? withCondoSubtypeWhere(floorLayer, `${currentBuildingWhere} AND (${buildFloorWhere(floorLayer, floorNums)})`)
					: "1=0";
				const layerView = await sceneView.whenLayerView(floorLayer);
				layerView.filter = new FeatureFilter({ where });
			} catch { }
		}

		if (condoLayer && condoLayer !== floorLayer) {
			try {
				const layerView = await sceneView.whenLayerView(condoLayer);
				layerView.filter = new FeatureFilter({ where: buildSelectedCondoParcelWhere(condoLayer, feature) });
			} catch { }
		}
	}

	async function zoomToFloorPlanView(feature, heading) {
		const sceneView = getSceneView();
		if (!sceneView || !feature?.geometry) return;

		const floorNums = getFloorPlanFloorNums(feature);
		await applyFloorPlanFilter(feature, floorNums);
		const floorFeatures = await queryFeaturesForFloorPlan(feature, floorNums);
		const target = getFloorPlanCameraTarget(feature.geometry, floorFeatures);
		const tilt = floorNums.length > 1 ? CONDO_MULTI_FLOOR_PLAN_TILT : CONDO_FLOOR_PLAN_TILT;

		try {
			await waitForSceneLayout(sceneView);
			await goToOrContinue(sceneView,
				{ target, heading, tilt },
				{ duration: 1050, easing: "in-out-cubic" },
				1800
			);
		} catch (error) {
			if (error?.name !== "AbortError") {
				console.error("[3D zoom] zoomToFloorPlanView: goTo failed.", error);
			}
		}
	}

	async function setCondoSceneViewMode(mode) {
		const nextMode = mode === CONDO_SCENE_VIEW_FLOOR_PLAN
			? CONDO_SCENE_VIEW_FLOOR_PLAN
			: CONDO_SCENE_VIEW_BUILDING;
		if (condoSceneViewMode === nextMode) return;

		condoSceneViewMode = nextMode;
		syncCondoSceneViewToggle();

		if (!lastSelectedCondoFeature) return;

		if (condoSceneViewMode === CONDO_SCENE_VIEW_FLOOR_PLAN) {
			const direction = getAttributeCaseInsensitive(lastSelectedCondoFeature.attributes, "Direction");
			const heading = DIRECTION_TO_HEADING[String(direction || "").toUpperCase()] ?? 0;
			await zoomToFloorPlanView(lastSelectedCondoFeature, heading);
			return;
		}

		await applyBuildingViewFilter();
		await zoomToSelectedParcelIn3D(lastSelectedCondoFeature);
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

	function buildSelectedCondoParcelWhere(layer, feature) {
		const attrs = feature?.attributes || {};
		const clauses = [];
		const name = getParcelName(attrs);
		const parcelId = getParcelId(attrs);

		if (name && layerHasField(layer, "Name")) {
			clauses.push(`Name = '${escapeSql(name)}'`);
		}
		if (parcelId && layerHasField(layer, "parcel_id")) {
			clauses.push(`parcel_id = '${escapeSql(parcelId)}'`);
		}

		if (!clauses.length) return "1=0";
		return withCondoSubtypeWhere(layer, `${currentBuildingWhere} AND (${clauses.join(" OR ")})`);
	}

	function getFloorDesignator(attributes = {}) {
		return getAttr(attributes, "FloorDesignator") ?? getAttr(attributes, "FloorNameDesignator");
	}

	function getFloorKey(attributes = {}) {
		return getAttr(attributes, "FloorName") ?? getAttr(attributes, "FloorNameDesignator") ?? getFloorDesignator(attributes);
	}

	function hasBuildingFloorPanelFields(feature) {
		const attrs = feature?.attributes || {};
		return !!(getCartogNote(attrs) && getFloorKey(attrs) != null && getParcelName(attrs));
	}

	function chooseBuildingFloorFeature(features) {
		const candidates = Array.isArray(features) ? features : [];
		return candidates.find(hasBuildingFloorPanelFields) || candidates[0] || null;
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

	function layerSupportsFloorFilter(layer) {
		return layerHasField(layer, "FloorName") ||
			layerHasField(layer, "FloorNameDesignator") ||
			layerHasField(layer, "FloorDesignator");
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
		if (hasBuildingFloorPanelFields(feature)) {
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
					num: 50
				});
				condoFeature = chooseBuildingFloorFeature(res.features);
			}

			if (!condoFeature && feature.geometry) {
				const geometryRes = await floorLayer.queryFeatures({
					where: withCondoSubtypeWhere(floorLayer, "1=1"),
					geometry: feature.geometry,
					spatialRelationship: "intersects",
					outFields: ["*"],
					returnGeometry: true,
					num: 50
				});
				condoFeature = chooseBuildingFloorFeature(geometryRes.features);
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

		buildingRenderToken += 1;
		renderedBuildingNames = new Set();
		if (buildingListEl) {
			buildingListEl.innerHTML = "<div style='opacity:.7;font-size:12px;'>Search a parcel ID or address to open its building.</div>";
		}
	}

	async function resetBuildingSelectionPanel({ closeSidebar = true, switchTo2DOnly = true } = {}) {
		const condoLayer = getCondoLayer();
		const floorLayer = getFloorLayer();
		const ESRILayer = getESRILayer();
		const parcelLayer = getParcelLayer();
		const sceneView = getSceneView();

		resetBuildingListAfterDeselection();
		clearFloorSelection();
		clearSelection(parcelListEl);

		if (floorListEl) floorListEl.innerHTML = "";
		if (parcelListEl) parcelListEl.innerHTML = "";

		const floorPanel = document.getElementById("floorPanel");
		const parcelPanel = document.getElementById("parcelPanel");
		if (floorPanel) floorPanel.style.display = "none";
		if (parcelPanel) parcelPanel.style.display = "none";

		currentBuildingExtent = null;
		allFeaturesForBuilding = [];
		currentBuildingWhere = null;
		lastSelectedCondoFeature = null;
		condoRevealAnimationToken += 1;
		restoreCondoLayerElevationInfo([condoLayer, floorLayer]);
		restoreCondoLayerOpacity([...new Set([condoLayer, floorLayer].filter(Boolean))]);

		try {
			if (sceneView && condoLayer) (await sceneView.whenLayerView(condoLayer)).filter = null;
			if (sceneView && floorLayer) (await sceneView.whenLayerView(floorLayer)).filter = null;
			if (parcelLayer && parcelLayer !== floorLayer) parcelLayer.visible = true;
			if (ESRILayer) ESRILayer.visible = true;
		} catch { }

		await clearEsriBuildingsClip();
		sceneView?.graphics?.removeAll?.();
		syncParcelListSelection?.();

		if (closeSidebar) closeLeftSidebar?.();
		if (switchTo2DOnly && typeof switchTo2D === "function") {
			await switchTo2D();
		}
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

			chip.addEventListener("click", async () => {
				chip.classList.toggle("selected");
				pulseStageElement(chip);
				await delay(STAGE_HANDOFF_DELAY_MS);
				await handleFloorSelection();
			});

			group.appendChild(chip);
		});

		document.getElementById("floorPanel").style.display = "block";
	}

	async function handleFloorSelection() {
		const floorLayer = getFloorLayer();
		const condoLayer = getCondoLayer();
		const sceneView = getSceneView();

		document.getElementById("parcelPanel").style.display = "flex";
		parcelListEl.innerHTML = "";

		const selectedFloorNums = Array.from(
			floorListEl.querySelectorAll("calcite-chip.selected")
		).map((chip) => chip.dataset.floor);

		if (!selectedFloorNums.length) {
			await applyFloorFilter([]);
			document.getElementById("parcelPanel").style.display = "none";
			return;
		}

		const revealLayers = [...new Set([floorLayer || condoLayer].filter(Boolean))];
		const revealToken = prepareSelectedCondoReveal(revealLayers);
		const whereClause = withCondoSubtypeWhere(floorLayer, `${currentBuildingWhere} AND (${buildFloorWhere(floorLayer, selectedFloorNums)})`);

		try {
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
						clearSelection(parcelListEl);
						divP.classList.add("selected");
						pulseStageElement(divP);
						await delay(STAGE_HANDOFF_DELAY_MS);
						const zoomPromise = zoomToSelectedParcelIn3D(p);
						await toggleParcelSelection(p);
						await zoomPromise;
					};

					parcelListEl.appendChild(divP);
				});
			});

			await applyFloorFilter(selectedFloorNums);
			await revealSelectedCondoLayers(revealLayers, revealToken, {
				durationMs: FLOOR_REVEAL_DURATION_MS,
				delayMs: FLOOR_REVEAL_DELAY_MS
			});

			if (condoSceneViewMode === CONDO_SCENE_VIEW_FLOOR_PLAN && lastSelectedCondoFeature) {
				const direction = getAttributeCaseInsensitive(lastSelectedCondoFeature.attributes, "Direction");
				const heading = DIRECTION_TO_HEADING[String(direction || "").toUpperCase()] ?? 0;
				await zoomToFloorPlanView(lastSelectedCondoFeature, heading);
			}
		} catch (error) {
			restoreCondoLayerOpacity(revealLayers);
			throw error;
		}

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
		if (parcelLayer && parcelLayer !== floorLayer) parcelLayer.visible = false;
		let revealLayers = [...new Set([condoLayer, floorLayer].filter(Boolean))];
		restoreCondoLayerOpacity(revealLayers);

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
			lastSelectedCondoFeature = null;
			condoRevealAnimationToken += 1;
			restoreCondoLayerElevationInfo([condoLayer, floorLayer]);
			restoreCondoLayerOpacity(revealLayers);

			try {
				if (condoLayer) (await sceneView.whenLayerView(condoLayer)).filter = null;
				if (floorLayer) (await sceneView.whenLayerView(floorLayer)).filter = null;
			} catch { }
			await clearEsriBuildingsClip();

			sceneView.graphics.removeAll();
			await clearParcelSelections();
			closeLeftSidebar?.();
			if (typeof switchTo2D === "function") {
				await switchTo2D();
			}
			return true;
		}

		// Collapse list to just this building
		Array.from(buildingListEl.children).forEach(
			(el) => (el.style.display = el === div ? "" : "none")
		);

		clearSelection(buildingListEl);
		div.classList.add("selected");
		pulseStageElement(div);

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
			returnGeometry: true,
			outSpatialReference: sceneView.spatialReference
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
						returnGeometry: true,
						outSpatialReference: sceneView.spatialReference
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

		await applyFlatCondoElevationInfo(allFeaturesForBuilding);

		const revealToken = prepareSelectedCondoReveal(revealLayers);

		try {
			// Apply building filter before the reveal so only the selected condo is animated in.
			if (condoLayer) {
				const lvCondo = await sceneView.whenLayerView(condoLayer);
				lvCondo.filter = new FeatureFilter({ where: currentBuildingWhere });
			}
			if (floorLayer) {
				const lvFloors = await sceneView.whenLayerView(floorLayer);
				lvFloors.filter = new FeatureFilter({ where: currentBuildingWhere });
			}

			currentBuildingExtent = await zoomToBuildingExtent(allFeaturesForBuilding);
			void applyEsriBuildingsClip(buildEsriBuildingsClipGeometry(allFeaturesForBuilding, currentBuildingExtent));
			await revealSelectedCondoLayers(revealLayers, revealToken);
		} catch (error) {
			restoreCondoLayerOpacity(revealLayers);
			throw error;
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

		const { maxFloor, buildingHeight, footprintSize, heightRatio } = getBuildingHeightRatio(features, parcelExtent);
		const expandMultiplier = getSceneAwareBuildingExpandMultiplier(
			features,
			parcelExtent,
			BUILDING_FRAME_MIN_EXPAND
		);

		const expanded = parcelExtent.expand(expandMultiplier);

		console.debug("[3D zoom] zoomToBuildingExtent:", {
			maxFloor,
			buildingHeight,
			footprintSize,
			heightRatio,
			expandMultiplier,
			tilt: CONDO_BUILDING_CAMERA_TILT
		});

		await waitForSceneLayout(sceneView);
		await goToOrContinue(sceneView,
			{ target: expanded, tilt: CONDO_BUILDING_CAMERA_TILT },
			{ duration: BUILDING_ZOOM_DURATION_MS, easing: "in-out-cubic" },
			2600
		);
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

		lastSelectedCondoFeature = condoFloorFeature;
		emitCondoSelectionGeometry(condoFloorFeature, geometry);

		const tilt = CONDO_CAMERA_TILT;
		const focusExtent = buildFocusExtentFromExtent(geometry.extent);
		const finalTarget = buildSelectedParcelCameraTarget(geometry, focusExtent);
		void applyEsriBuildingsClip(
			buildEsriBuildingsClipGeometry(allFeaturesForBuilding, currentBuildingExtent) ||
			extentToClipPolygon(focusExtent)
		);

		if (condoSceneViewMode === CONDO_SCENE_VIEW_FLOOR_PLAN) {
			await zoomToFloorPlanView(condoFloorFeature, heading);
			return;
		}

		await applyBuildingViewFilter();

		console.debug("[3D zoom] orientCameraToParcel:", {
			parcelName, direction, heading, tilt, finalTarget, focusExtent
		});

		try {
			await waitForSceneLayout(sceneView);
			await goToOrContinue(sceneView,
				{ target: finalTarget, heading, tilt },
				{ duration: 1250, easing: "in-out-cubic" },
				2100
			);
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
						returnGeometry: true,
						outSpatialReference: sceneView.spatialReference
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

	// ---- Programmatic building -> floor -> parcel navigation ------------------

	async function selectBuildingFloorContext(feature, {
		clearExistingSelections = true,
		clearSameBuildingSelections = clearExistingSelections,
		showWorkflow = false
	} = {}) {
		feature = await resolveCondoFloorFeature(feature);
		if (!feature) return false;

		if (feature.geometry) {
			emitCondoSelectionGeometry(feature, feature.geometry);
		}

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

		if (showWorkflow) {
			setCondoWorkflowStage("building", {
				buildingName: cartogNote,
				floorName: floorNum,
				parcelName
			});
		}

		openLeftSidebar();
		await switchTo3D();
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
		await delay(STAGE_HANDOFF_DELAY_MS);

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

		const selectedFloorNums = Array.from(
			floorListEl.querySelectorAll("calcite-chip.selected")
		).map((chip) => chip.dataset.floor);
		const floorAlreadySelected = selectedFloorNums.includes(floorNum);
		if (!floorAlreadySelected) {
			clearFloorSelection();
			floorChip.classList.add("selected");
			floorChip.selected = true;
			pulseStageElement(floorChip);
		}
		if (showWorkflow) {
			setCondoWorkflowStage("floor", {
				buildingName: cartogNote,
				floorName: floorNum,
				parcelName
			});
		}
		if (!floorAlreadySelected) {
			await delay(STAGE_HANDOFF_DELAY_MS);
		}

		if (!floorAlreadySelected || !parcelListEl.querySelector(".parcel-list-item")) {
			await handleFloorSelection();
		}

		// Wait one frame so parcel list exists after floor selection.
		await new Promise((r) => requestAnimationFrame(r));
		if (!floorAlreadySelected) {
			await delay(STAGE_HANDOFF_DELAY_MS);
		}

		if (parcelName) {
			const selectionKey = getSelectionKey(feature);
			const parcelDiv = Array.from(parcelListEl.querySelectorAll(".parcel-list-item")).find(
				(d) => d.dataset.selectionKey === selectionKey || (!d.dataset.selectionKey && d.dataset.name === parcelName)
			);
			if (parcelDiv) {
				clearSelection(parcelListEl);
				parcelDiv.classList.add("selected");
				pulseStageElement(parcelDiv);
				parcelDiv.scrollIntoView?.({ block: "nearest" });
				if (showWorkflow) {
					setCondoWorkflowStage("parcel", {
						buildingName: cartogNote,
						floorName: floorNum,
						parcelName
					});
				}
				await delay(STAGE_HANDOFF_DELAY_MS);
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
		const shouldShowEarlyWorkflow = isCondoWorkflowCandidate(feature);
		const workflowToken = shouldShowEarlyWorkflow ? showCondoWorkflowOverlay({
			parcelName: getParcelName(feature?.attributes) || getParcelId(feature?.attributes) || "Condo parcel selected"
		}) : null;
		const condoFeature = await resolveCondoFloorFeature(feature);
		if (!condoFeature) {
			if (workflowToken) {
				await hideCondoWorkflowOverlay(workflowToken, {
					errorMessage: "Could not find a matching condo parcel."
				});
			}
			return false;
		}

		const activeWorkflowToken = workflowToken || showCondoWorkflowOverlay({
			buildingName: getCartogNote(condoFeature?.attributes),
			floorName: String(getFloorKey(condoFeature?.attributes) ?? ""),
			parcelName: getParcelName(condoFeature?.attributes)
		});

		setCondoWorkflowStage("building", {
			buildingName: getCartogNote(condoFeature?.attributes),
			floorName: String(getFloorKey(condoFeature?.attributes) ?? ""),
			parcelName: getParcelName(condoFeature?.attributes)
		});

		try {
			const contextSelected = await selectBuildingFloorContext(condoFeature, {
				clearExistingSelections: true,
				showWorkflow: true
			});
			if (!contextSelected) {
				console.warn("Unable to sync search result with building/floor list; selecting condo directly.", condoFeature?.attributes);
				await hideCondoWorkflowOverlay(activeWorkflowToken, {
					errorMessage: "Could not match this condo to a building and floor."
				});
				return false;
			}

			setCondoWorkflowStage("scene", {
				buildingName: getCartogNote(condoFeature?.attributes),
				floorName: String(getFloorKey(condoFeature?.attributes) ?? ""),
				parcelName: getParcelName(condoFeature?.attributes)
			});
			const zoomPromise = zoomToSelectedParcelIn3D(condoFeature);
			await toggleParcelSelection(condoFeature);
			await zoomPromise;
			await hideCondoWorkflowOverlay(activeWorkflowToken, { complete: true });
			return true;
		} catch (error) {
			await hideCondoWorkflowOverlay(activeWorkflowToken, {
				errorMessage: "Condo search could not finish."
			});
			throw error;
		}
	}

	async function zoomToCondoFeatureSet(features) {
		const sceneView = getSceneView();
		if (!sceneView || !features?.length) return;

		const extents = features
			.map((feature) => feature?.geometry?.extent)
			.filter(Boolean);
		if (!extents.length) return;

		let combined = extents[0].clone();
		for (let i = 1; i < extents.length; i += 1) {
			combined = combined.union(extents[i]);
		}

		try {
			await sceneView.goTo(
				{ target: combined.expand(3), tilt: CONDO_CAMERA_TILT },
				{ duration: 1050, easing: "in-out-cubic" }
			);
		} catch (error) {
			if (error?.name !== "AbortError") throw error;
		}
	}

	async function selectBuildingFloorParcels(features) {
		const earlyWorkflowToken = (features || []).some(isCondoWorkflowCandidate)
			? showCondoWorkflowOverlay({
				parcelName: `${(features || []).length} condo parcels selected`
			})
			: null;
		const condoFeatures = [];
		for (const feature of features || []) {
			const condoFeature = await resolveCondoFloorFeature(feature);
			if (condoFeature) condoFeatures.push(condoFeature);
		}

		if (!condoFeatures.length) {
			if (earlyWorkflowToken) {
				await hideCondoWorkflowOverlay(earlyWorkflowToken, {
					errorMessage: "Could not find matching condo parcels."
				});
			}
			return false;
		}

		const firstFeature = condoFeatures[0];
		const buildingName = getCartogNote(firstFeature?.attributes);
		const floorNames = [...new Set(condoFeatures
			.map((feature) => String(getFloorKey(feature?.attributes) ?? ""))
			.filter(Boolean))];
		const workflowToken = earlyWorkflowToken || showCondoWorkflowOverlay({
			buildingName,
			floorName: floorNames.join(", "),
			parcelName: `${condoFeatures.length} parcels`
		});

		setCondoWorkflowStage("building", {
			buildingName,
			floorName: floorNames.join(", "),
			parcelName: `${condoFeatures.length} parcels`
		});

		try {
			const contextSelected = await selectBuildingFloorContext(firstFeature, {
				clearExistingSelections: true,
				showWorkflow: true
			});
			if (!contextSelected) {
				await hideCondoWorkflowOverlay(workflowToken, {
					errorMessage: "Could not match these condos to a building and floor."
				});
				return false;
			}

			setCondoWorkflowStage("floor", {
				buildingName,
				floorName: floorNames.join(", "),
				parcelName: `${condoFeatures.length} parcels`
			});

			for (const floorName of floorNames) {
				const floorChip = findFloorChip(floorName);
				if (!floorChip) continue;
				floorChip.classList.add("selected");
				floorChip.selected = true;
				pulseStageElement(floorChip);
			}

			await delay(STAGE_HANDOFF_DELAY_MS);
			await handleFloorSelection();
			await new Promise((r) => requestAnimationFrame(r));

			setCondoWorkflowStage("parcel", {
				buildingName,
				floorName: floorNames.join(", "),
				parcelName: `${condoFeatures.length} parcels`
			});

			for (const feature of condoFeatures) {
				const selectionKey = getSelectionKey(feature);
				const parcelDiv = Array.from(parcelListEl.querySelectorAll(".parcel-list-item")).find(
					(d) => d.dataset.selectionKey === selectionKey
				);
				if (parcelDiv) {
					parcelDiv.classList.add("selected");
					pulseStageElement(parcelDiv);
				}

				await toggleParcelSelection(feature);
			}

			setCondoWorkflowStage("scene", {
				buildingName,
				floorName: floorNames.join(", "),
				parcelName: `${condoFeatures.length} parcels`
			});

			await zoomToCondoFeatureSet(condoFeatures);
			await hideCondoWorkflowOverlay(workflowToken, { complete: true });
			return true;
		} catch (error) {
			await hideCondoWorkflowOverlay(workflowToken, {
				errorMessage: "Condo batch search could not finish."
			});
			throw error;
		}
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
				const zoomPromise = zoomToSelectedParcelIn3D(feature);
				await toggleParcelSelection(feature);
				await zoomPromise;
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
		if (buildingListEl) {
			buildingListEl.innerHTML = "<div style='opacity:.7;font-size:12px;'>Search a parcel ID or address to open its building.</div>";
		}
		wireCondoSceneViewToggle();
	}

	wireCondoSceneViewToggle();

	return {
		populateBuildingList,
		attachViewClickHandler,
		selectBuildingFloorParcel,
		selectBuildingFloorParcels,
		zoomToSelectedParcelIn3D,
		resetBuildingSelectionPanel
	};
}

