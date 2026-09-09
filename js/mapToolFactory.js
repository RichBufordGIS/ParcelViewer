// Reusable ArcGIS/Calcite map tool factory. Templates are registered once per document
// so Parcel Viewer, Public Works, and Property Information can use the same markup.
const MAP_TOOL_TEMPLATE_MARKUP = `
<template id="map-tool-basemap-template">
  <arcgis-expand collapse-icon="chevrons-right" data-tool-role="expand" expand-icon="basemap" mode="floating" slot="top-right" visual-scale="l">
    <div class="map-tool-popover"><calcite-panel heading="Basemaps"><div class="basemap-gallery-panel"><arcgis-basemap-gallery data-tool-role="gallery"></arcgis-basemap-gallery></div></calcite-panel></div>
  </arcgis-expand>
</template>
<template id="map-tool-layer-list-template">
  <arcgis-expand collapse-icon="chevrons-right" data-tool-role="expand" expand-icon="layers" mode="floating" slot="top-right" visual-scale="l">
    <div class="map-tool-popover"><calcite-panel heading="Layer List"><div><arcgis-layer-list></arcgis-layer-list></div></calcite-panel></div>
  </arcgis-expand>
</template>
<template id="map-tool-measurement-template">
  <arcgis-expand collapse-icon="chevrons-right" data-tool-role="expand" expand-icon="measure" mode="floating" slot="top-right" visual-scale="l">
    <div class="map-tool-popover"><calcite-panel heading="Measurement"><div style="padding:12px;display:grid;gap:8px;width:320px;">
      <div>Choose a measurement tool</div>
      <calcite-button data-tool-role="line-option" icon-start="measure-line" width="full">Distance</calcite-button>
      <calcite-button data-tool-role="area-option" icon-start="measure-area" width="full">Area</calcite-button>
      <calcite-button data-tool-role="start" icon-start="play" width="full">Start</calcite-button>
      <calcite-button appearance="outline" data-tool-role="stop" hidden icon-start="stop" width="full">Stop</calcite-button>
      <div data-tool-role="subtitle">Choose a tool, then Start.</div>
      <div data-tool-role="line-shell" hidden></div><div data-tool-role="area-shell" hidden></div>
    </div></calcite-panel></div>
  </arcgis-expand>
</template>
<template id="map-tool-rectangle-template">
  <arcgis-expand collapse-icon="chevrons-right" data-tool-role="expand" expand-icon="cursor-selection" mode="floating" slot="top-right" visual-scale="l">
    <div class="map-tool-popover"><calcite-panel heading="Select by rectangle"><div style="padding:12px;display:grid;gap:8px;width:280px;">
      <div>Click Start, then drag a box on the 2D map.</div>
      <calcite-button appearance="solid" data-tool-role="start" icon-start="play" kind="neutral" width="full">Start</calcite-button>
      <calcite-button appearance="outline" data-tool-role="stop" icon-start="stop" kind="neutral" width="full">Stop</calcite-button>
    </div></calcite-panel></div>
  </arcgis-expand>
</template>
<template id="map-tool-nav-template">
  <div class="map-nav-stack" slot="top-left">
    <calcite-button appearance="solid" data-tool-role="zoom-in" icon-start="plus" kind="neutral" scale="l" title="Zoom in"></calcite-button>
    <arcgis-home visual-scale="l"></arcgis-home>
    <calcite-button appearance="solid" data-tool-role="zoom-out" icon-start="minus" kind="neutral" scale="l" title="Zoom out"></calcite-button>
    <span data-tool-role="nav-3d"><arcgis-navigation-toggle visual-scale="l"></arcgis-navigation-toggle></span>
    <arcgis-compass visual-scale="l"></arcgis-compass>
  </div>
</template>`;

/** Ensures the shared map-tool templates exist in the current document. */
export function ensureMapToolTemplates() {
    if (document.getElementById("map-tool-basemap-template")) {
        return;
    }
    const host = document.createElement("div");
    host.hidden = true;
    host.setAttribute("data-map-tool-templates", "true");
    host.innerHTML = MAP_TOOL_TEMPLATE_MARKUP;
    document.body.appendChild(host);
}

/** Clones a registered map-tool template. */
function cloneTemplate(id) {
    ensureMapToolTemplates();
    const template = document.getElementById(id);
    if (!(template instanceof HTMLTemplateElement)) {
        throw new Error(`Missing map tool template: ${id}`);
    }
    return template.content.cloneNode(true);
}

/** Assigns an id to a template element by its tool role. */
function setId(root, role, id) {
    const el = root.querySelector(`[data-tool-role="${role}"]`);
    if (el && id) {
        el.id = id;
    }
    return el;
}

/** Clones, configures, and appends a tool template to a map element. */
function appendTemplate(mapEl, templateId, configure) {
    if (!mapEl) {
        return null;
    }
    const fragment = cloneTemplate(templateId);
    configure?.(fragment);
    mapEl.appendChild(fragment);
    return mapEl.lastElementChild;
}

/** Adds the basemap gallery tool. */
function addBasemap(mapEl, suffix) {
    appendTemplate(mapEl, "map-tool-basemap-template", (fragment) => {
        setId(fragment, "expand", `basemapExpand${suffix}`);
        setId(fragment, "gallery", `basemapGallery${suffix}`);
    });
}

/** Adds the layer-list tool. */
function addLayerList(mapEl, suffix) {
    appendTemplate(mapEl, "map-tool-layer-list-template", (fragment) => {
        setId(fragment, "expand", `layerListExpand${suffix}`);
    });
}

/** Adds the 2D or 3D measurement tools. */
function addMeasurement(mapEl, dimension) {
    const is3d = dimension === "3d";
    const suffix = is3d ? "3d" : "2d";
    appendTemplate(mapEl, "map-tool-measurement-template", (fragment) => {
        setId(fragment, "expand", `measurementExpand${suffix}`);
        setId(fragment, "line-option", `measure${suffix}LineOptionBtn`);
        setId(fragment, "area-option", `measure${suffix}AreaOptionBtn`);
        setId(fragment, "start", `measure${suffix}StartBtn`);
        setId(fragment, "stop", `measure${suffix}StopBtn`);
        setId(fragment, "subtitle", `measure${suffix}Subtitle`);
        const lineShell = setId(fragment, "line-shell", `measure${suffix}LineShell`);
        const areaShell = setId(fragment, "area-shell", `measure${suffix}AreaShell`);
        const lineMeasure = document.createElement(is3d ? "arcgis-direct-line-measurement-3d" : "arcgis-distance-measurement-2d");
        lineMeasure.id = is3d ? "lineMeasure3d" : "distanceMeasure2d";
        lineMeasure.setAttribute("hide-start-button", "");
        lineShell?.appendChild(lineMeasure);
        const areaMeasure = document.createElement(is3d ? "arcgis-area-measurement-3d" : "arcgis-area-measurement-2d");
        areaMeasure.id = is3d ? "areaMeasure3d" : "areaMeasure2d";
        areaMeasure.setAttribute("hide-start-button", "");
        areaShell?.appendChild(areaMeasure);
    });
}

/** Adds the 2D rectangle-selection tool. */
function addRectangleSelection(mapEl) {
    appendTemplate(mapEl, "map-tool-rectangle-template", (fragment) => {
        setId(fragment, "expand", "rectangleSelectExpand2d");
        setId(fragment, "start", "rectangleSelectStartBtn");
        setId(fragment, "stop", "rectangleSelectStopBtn");
    });
}

/** Adds the map navigation stack. */
function addNavStack(mapEl, dimension) {
    const is3d = dimension === "3d";
    const suffix = is3d ? "3d" : "2d";
    appendTemplate(mapEl, "map-tool-nav-template", (fragment) => {
        setId(fragment, "zoom-in", `zoomInBtn${suffix}`);
        setId(fragment, "zoom-out", `zoomOutBtn${suffix}`);
        const nav3d = fragment.querySelector('[data-tool-role="nav-3d"]');
        if (nav3d) {
            nav3d.hidden = !is3d;
        }
    });
}

/** Installs the requested shared tools on one ArcGIS map or scene element. */
export function installMapTools(mapEl, { suffix, dimension = "2d", basemap = true, layers = true, measurement = false, rectangle = false, navigation = false } = {}) {
    if (!mapEl || mapEl.dataset.mapToolsInstalled === "true") {
        return mapEl;
    }
    ensureMapToolTemplates();
    if (basemap) addBasemap(mapEl, suffix);
    if (layers) addLayerList(mapEl, suffix);
    if (measurement) addMeasurement(mapEl, dimension);
    if (rectangle) addRectangleSelection(mapEl);
    if (navigation) addNavStack(mapEl, dimension);
    mapEl.dataset.mapToolsInstalled = "true";
    return mapEl;
}

/** Installs tools used by the Parcel Viewer 2D and 3D views. */
export function installParcelViewerTools() {
    installMapTools(document.getElementById("map2d"), {
        suffix: "2d", dimension: "2d", measurement: true, rectangle: true, navigation: true
    });
    installMapTools(document.getElementById("scene"), {
        suffix: "3d", dimension: "3d", measurement: true, navigation: true
    });
}

/** Installs the Public Works basemap and layer-list tools. */
export function installPublicWorksTools() {
    return installMapTools(document.getElementById("pwMap"), { suffix: "Pw" });
}

/** Installs the Property Information basemap and layer-list tools. */
export function installPropertyAnalysisTools() {
    return installMapTools(document.getElementById("saMap"), { suffix: "Analysis" });
}
