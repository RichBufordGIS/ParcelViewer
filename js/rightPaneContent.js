import { logCaughtError } from "./errorUX.js";
import { SERVICE_URLS, TYLER } from "./constants.js";
const PARCEL_DETAIL_FIELDS = Object.freeze([
    "Name", "PARID", "parid", "PARCEL_ID", "parcel_id",
    "ParcelSubtype", "TAXYR", "FULLADDR", "PARCEL_ADDRESS", "SITUS_ADDRESS",
    "PROPERTY_ADDRESS", "LUC", "LUC_DESC", "ACRES_1", "SFLA", "RMBED",
    "OWNER_NAME", "OWNER_NAMES", "OWN1", "OWN2", "OWNER_ADDRESS", "MAIL_ADDRESS",
    "TAXDIST", "EXCODES", "LEGDESC", "MKTVAL", "ASDVAL", "TAXVAL",
    "TCA", "Fire", "School", "Water", "LIBRARY",
    "CartogNote", "FloorName", "FloorNameDesignator", "FloorDesignator"
]);
const CONDO_DETAIL_FIELDS = Object.freeze([
    "Name", "PARID", "parid", "PARCEL_ID", "parcel_id", "ParcelSubtype",
    "FULLADDR", "PARCEL_ADDRESS", "SITUS_ADDRESS", "PROPERTY_ADDRESS",
    "CartogNote", "FloorName", "FloorNameDesignator", "FloorDesignator"
]);
const HISTORIC_VALUE_FIELDS = Object.freeze(["MKTVAL", "ASDVAL", "TAXVAL"]);
let parcelDetailClassesPromise = null;
let parcelInformationLayer = null;
const historicParcelLayers = new Map();
/** Returns ArcGIS classes used by parcel details. */
function getParcelDetailClasses() {
    if (!parcelDetailClassesPromise) {
        parcelDetailClassesPromise = $arcgis.import([
            "@arcgis/core/layers/FeatureLayer.js",
            "@arcgis/core/rest/support/Query.js"
        ]);
    }
    return parcelDetailClassesPromise;
}
/** Returns shared parcel information layer. */
function getParcelInformationLayer(FeatureLayer) {
    if (!parcelInformationLayer) {
        parcelInformationLayer = new FeatureLayer({
            url: SERVICE_URLS.parcelInformationLayer
        });
    }
    return parcelInformationLayer;
}
/** Returns shared historic parcel layer. */
function getHistoricParcelLayer(FeatureLayer, historicLayerId) {
    const key = String(historicLayerId);
    if (!historicParcelLayers.has(key)) {
        historicParcelLayers.set(key, new FeatureLayer({
            url: `${SERVICE_URLS.historicParcelsBase}${key}`
        }));
    }
    return historicParcelLayers.get(key);
}
/** Returns existing fields. */
function getExistingFields(layer, candidates = PARCEL_DETAIL_FIELDS) {
    const fields = Array.isArray(layer?.fields) ? layer.fields : [];
    if (!fields.length)
        return [...candidates];
    const byLower = new Map(fields.map((field) => [String(field.name).toLowerCase(), field.name]));
    return [...new Set(candidates.map((name) => byLower.get(String(name).toLowerCase())).filter(Boolean))];
}
/** Builds parcel details frame. */
export async function buildParcelDetailsFrame(parcelnum, { sourceFeature = null } = {}) {
    const [FeatureLayer, Query] = await getParcelDetailClasses();
    //44-320-17-05-00-0-00-000 - me
    //11-700-04-27-00-0-00-000 - long legal descr
    const isCondoFeature = [2, 4].includes(Number(sourceFeature?.attributes?.ParcelSubtype)) ||
        sourceFeature?.layer?.title === "Parcel Condominiums Floors" ||
        sourceFeature?.layer?.title === "Parcel Condominiums";
    const view = document.getElementById("map2d")?.view || document.getElementById("saMap")?.view || document.getElementById("pwMap")?.view;
    const curParcels = view?.map?.allLayers?.find((layer) => layer.title === "Parcels") || null;
    const parcelInformationLayer = getParcelInformationLayer(FeatureLayer);
    const sceneView = document.getElementById("scene")?.view;
    const condoDetailsLayer = sourceFeature?.layer ||
        sceneView?.map?.allLayers?.find((layer) => layer.title === "Parcel Condominiums Floors") ||
        sceneView?.map?.allLayers?.find((layer) => layer.title === "Parcel Condominiums") ||
        null;
    const escapeSql = (value) => String(value ?? "").replace(/'/g, "''");
    const normalizeParcelDigits = (value) => String(value || "").replace(/\D/g, "");
    /** Formats parcel with dashes. */
    const formatParcelWithDashes = (value) => {
        const digits = normalizeParcelDigits(value);
        if (digits.length !== 17)
            return String(value || "");
        return digits.replace(/^(\d{2})(\d{3})(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})(\d{3})$/, "$1-$2-$3-$4-$5-$6-$7-$8");
    };
    const layerHasField = (layer, fieldName) => Array.isArray(layer?.fields) &&
        layer.fields.some((field) => String(field.name).toLowerCase() === String(fieldName).toLowerCase());
    /** Builds parcel where. */
    const buildParcelWhere = (value, layer = null) => {
        const raw = String(value || "").trim();
        const digits = normalizeParcelDigits(raw);
        const values = new Set([raw].filter(Boolean));
        if (digits.length === 17) {
            values.add(digits);
            values.add(formatParcelWithDashes(digits));
        }
        const quoted = [...values].map((v) => `'${escapeSql(v)}'`);
        if (!quoted.length)
            return "1=0";
        const clauses = [];
        if (layerHasField(layer, "Name"))
            clauses.push(`Name IN (${quoted.join(",")})`);
        if (layerHasField(layer, "PARID"))
            clauses.push(`PARID IN (${quoted.join(",")})`);
        if (layerHasField(layer, "parid"))
            clauses.push(`parid IN (${quoted.join(",")})`);
        if (layerHasField(layer, "PARCEL_ID"))
            clauses.push(`PARCEL_ID IN (${quoted.join(",")})`);
        if (layerHasField(layer, "parcel_id"))
            clauses.push(`parcel_id IN (${quoted.join(",")})`);
        return clauses.join(" OR ") || `Name IN (${quoted.join(",")})`;
    };
    const sourceAttrs = sourceFeature?.attributes || {};
    const normalizedParcelId = normalizeParcelDigits(sourceAttrs.parcel_id || sourceAttrs.PARCEL_ID || parcelnum || "");
    const dashedParcelNumber = normalizedParcelId.length === 17
        ? formatParcelWithDashes(normalizedParcelId)
        : String(parcelnum || "").trim();
    let feature = null;
    let currentParcelFeature = null;
    let parcelInformationFeature = null;
    if (isCondoFeature && condoDetailsLayer) {
        const condoQuery = new Query();
        const safeParcel = escapeSql(parcelnum);
        condoQuery.where = `Name='${safeParcel}' OR parcel_id='${safeParcel}'`;
        condoQuery.returnGeometry = false;
        condoQuery.outFields = getExistingFields(condoDetailsLayer, CONDO_DETAIL_FIELDS);
        const condoResults = await condoDetailsLayer.queryFeatures(condoQuery);
        feature = condoResults?.features?.[0] || null;
    }
    if (!feature && isCondoFeature) {
        feature = sourceFeature;
    }
    if (!feature && !isCondoFeature) {
        try {
            await parcelInformationLayer.load?.();
            const infoQuery = new Query();
            infoQuery.where = buildParcelWhere(parcelnum, parcelInformationLayer);
            infoQuery.returnGeometry = false;
            infoQuery.outFields = getExistingFields(parcelInformationLayer);
            const infoResults = await parcelInformationLayer.queryFeatures(infoQuery);
            feature = infoResults?.features?.[0] || null;
            parcelInformationFeature = feature;
        }
        catch {
            parcelInformationFeature = null;
        }
    }
    if (!feature && !curParcels) {
        return `<div>Parcels layer not available</div>`;
    }
    let curYear = 2026; // change this every year when the Assessment Dept has their new values ready
    if (curParcels && !feature) {
        await curParcels.load?.();
        const curQuery = new Query();
        curQuery.where = buildParcelWhere(dashedParcelNumber || parcelnum, curParcels);
        curQuery.returnGeometry = false;
        curQuery.outFields = getExistingFields(curParcels);
        const results = await curParcels.queryFeatures(curQuery);
        currentParcelFeature = results?.features?.[0] || null;
    }
    if (currentParcelFeature) {
        feature = feature
            ? {
                ...feature,
                attributes: {
                    ...(currentParcelFeature.attributes || {}),
                    ...(feature.attributes || {})
                }
            }
            : currentParcelFeature;
    }
    if (normalizedParcelId && !parcelInformationFeature) {
        try {
            await parcelInformationLayer.load?.();
            const parcelInfoQuery = new Query();
            parcelInfoQuery.where = buildParcelWhere(normalizedParcelId, parcelInformationLayer);
            parcelInfoQuery.returnGeometry = false;
            parcelInfoQuery.outFields = getExistingFields(parcelInformationLayer);
            parcelInfoQuery.orderByFields = ["TAXYR DESC"];
            parcelInfoQuery.num = 1;
            const parcelInfoResults = await parcelInformationLayer.queryFeatures(parcelInfoQuery);
            parcelInformationFeature = parcelInfoResults?.features?.[0] || null;
        }
        catch {
            parcelInformationFeature = null;
        }
    }
    if (parcelInformationFeature) {
        feature = feature
            ? {
                ...feature,
                attributes: {
                    ...(feature.attributes || {}),
                    ...(parcelInformationFeature.attributes || {})
                }
            }
            : parcelInformationFeature;
    }
    if (!feature) {
        return `<div>No parcel data found for ${String(parcelnum)}</div>`;
    }
    const attrs = feature.attributes || {};
    const escapeHtml = (value) => String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    const escapeAttr = escapeHtml;
    /** Formats currency value. */
    const formatCurrencyValue = (value, fallback = "") => {
        if (value === null || value === undefined || value === "")
            return fallback;
        const numericValue = Number(String(value).replace(/[^0-9.-]/g, ""));
        if (!Number.isFinite(numericValue))
            return String(value);
        return numericValue.toLocaleString("en-US", { maximumFractionDigits: 0 });
    };
    /** Returns value. */
    const getValue = (keys, fallback = "", sourceAttrs = attrs) => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const key of keyList) {
            const exactValue = sourceAttrs?.[key];
            if (exactValue !== null && exactValue !== undefined && exactValue !== "")
                return String(exactValue);
            const matchKey = Object.keys(sourceAttrs || {}).find((sourceKey) => sourceKey.toLowerCase() === String(key).toLowerCase());
            const matchValue = matchKey ? sourceAttrs[matchKey] : null;
            if (matchValue !== null && matchValue !== undefined && matchValue !== "")
                return String(matchValue);
        }
        return fallback;
    };
    /** Handles copy button. */
    const copyButton = (value, label = "Copy value") => {
        const text = String(value ?? "").trim();
        if (!text)
            return "";
        return `
            <button type="button" class="copy-field-btn" data-copy-value="${escapeAttr(text)}" data-copy-label="${escapeAttr(label)}" title="${escapeAttr(label)}" aria-label="${escapeAttr(label)}">
                <calcite-icon preload icon="duplicate" scale="s"></calcite-icon>
            </button>
        `;
    };
    /** Handles copy field value. */
    const copyFieldValue = (value, label = "Copy value") => {
        const text = String(value ?? "").trim();
        return `
            <span class="copy-field-value">${escapeHtml(text)}</span>
            ${copyButton(text, label)}
        `;
    };
    /** Returns exemption. */
    const getExemption = (sourceAttrs = attrs) => {
        const value = sourceAttrs?.["EXCODES"];
        return value === null || value === undefined || value === "" ? "No known exemption" : String(value);
    };
    /** Returns legal. */
    const getLegal = (sourceAttrs = attrs) => {
        const legal = sourceAttrs?.["LEGDESC"];
        if (typeof legal !== "string")
            return "";
        if (legal.length <= 100)
            return copyFieldValue(legal, "Copy legal description");
        const shortLegal = `${legal.slice(0, 100)}...`;
        return `
            <span class="copy-field-value legal-description-value" data-short-legal="${escapeAttr(shortLegal)}" data-full-legal="${escapeAttr(legal)}">${escapeHtml(shortLegal)}</span>
            ${copyButton(legal, "Copy legal description")}
            <button type="button" id="btnLegal" class="legal-expand-btn" data-expanded="false" title="Show full legal description" aria-label="Show full legal description">
                <calcite-icon preload icon="ellipsis" scale="s"></calcite-icon>
            </button>
        `;
    };
    if (!document.__legalToggleBound) {
        document.addEventListener("click", (event) => {
            const btnLegal = event.target instanceof Element ? event.target.closest("#btnLegal") : null;
            if (!btnLegal)
                return;
            toggleLegalDescription(btnLegal);
        });
        document.__legalToggleBound = true;
    }
    if (!document.__copyFieldBound) {
        document.addEventListener("click", async (event) => {
            const copyBtn = event.target instanceof Element ? event.target.closest(".copy-field-btn") : null;
            if (!copyBtn)
                return;
            const value = copyBtn.dataset.copyValue || "";
            if (!value)
                return;
            try {
                if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(value);
                }
                else {
                    const textarea = document.createElement("textarea");
                    textarea.value = value;
                    textarea.setAttribute("readonly", "");
                    textarea.style.position = "fixed";
                    textarea.style.left = "-9999px";
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand("copy");
                    textarea.remove();
                }
                copyBtn.classList.add("copied");
                copyBtn.setAttribute("aria-label", "Copied");
                copyBtn.title = "Copied";
                setTimeout(() => {
                    const label = copyBtn.dataset.copyLabel || "Copy value";
                    copyBtn.classList.remove("copied");
                    copyBtn.setAttribute("aria-label", label);
                    copyBtn.title = label;
                }, 1100);
            }
            catch (error) {
                logCaughtError("rightPaneContent.js: suppressed recoverable error", error);
            }
        });
        document.__copyFieldBound = true;
    }
    const histYears = Array.from({ length: 4 }, (_, i) => curYear - 1 - i);
    const historicRows = await Promise.all(histYears.map(async (histYearTarget) => {
        const historicLayerId = curYear - histYearTarget;
        try {
            const histParcels = getHistoricParcelLayer(FeatureLayer, historicLayerId);
            await histParcels.load?.();
            const histQuery = new Query();
            histQuery.where = buildParcelWhere(parcelnum, histParcels);
            histQuery.returnGeometry = false;
            histQuery.outFields = getExistingFields(histParcels, HISTORIC_VALUE_FIELDS);
            const histResults = await histParcels.queryFeatures(histQuery);
            const histFeature = histResults?.features?.[0];
            const histAttrs = histFeature?.attributes || {};
            return `
            <div class="col-values" id="lblYear${historicLayerId}"><b>${histYearTarget}</b></div>
            <div class="col-values" id="lblYear${historicLayerId}TMV">$${formatCurrencyValue(getValue("MKTVAL", "", histAttrs))}</div>
            <div class="col-values" id="lblYear${historicLayerId}TAV">$${formatCurrencyValue(getValue("ASDVAL", "", histAttrs))}</div>
            <div class="col-values" id="lblYear${historicLayerId}TTV">$${formatCurrencyValue(getValue("TAXVAL", "", histAttrs))}</div>
        `;
        }
        catch (error) {
            logCaughtError("rightPaneContent.js: historic parcel value lookup failed", error);
            return `
            <div class="col-values" id="lblYear${historicLayerId}"><b>${histYearTarget}</b></div>
            <div class="col-values" id="lblYear${historicLayerId}TMV"></div>
            <div class="col-values" id="lblYear${historicLayerId}TAV"></div>
            <div class="col-values" id="lblYear${historicLayerId}TTV"></div>
        `;
        }
    }));
    return `
        <div id="right-info">
            <div id="basic">
                <div class="col-full mobile-copy-field"><div class="col-full-left"><b>Parcel #</b></div><div class="col-full-right" id="lblParcelNum">${copyFieldValue(getValue(["PARCEL_ID", "parcel_id", "PARID", "Name"], parcelnum), "Copy parcel number")}</div></div>
                <div class="col-full mobile-copy-field"><div class="col-full-left"><b>Address:</b></div><div class="col-full-right" id="lblSitusAddr">${copyFieldValue(getValue(["PARCEL_ADDRESS", "SITUS_ADDRESS", "PROPERTY_ADDRESS", "FULLADDR"]), "Copy parcel address")}</div></div>
                <div class="col-left">
                    <div class="col-left"><b>Land Use:</b></div><div class="col-right" id="lblLandUseCode">${escapeHtml(getValue("LUC") + (getValue("LUC_DESC") ? " - " + getValue("LUC_DESC") : ""))}</div>
                    <div class="col-left"><b>Lot Size:</b></div><div class="col-right" id="lblLotSize">${escapeHtml(getValue("ACRES_1", "") + (getValue("ACRES_1", "") ? " Acres" : ""))}</div>
                    <div class="col-left"><b>Bldg Sq Ft:</b></div><div class="col-right" id="lblBldgSqFt">${escapeHtml(getValue("SFLA") ? Number(getValue("SFLA")).toLocaleString() : "")}</div>
                    <div class="col-left"><b>Bedrooms:</b></div><div class="col-right" id="lblNumBR">${escapeHtml(getValue("RMBED"))}</div>
                    <div class="col-left"><b>TCA:</b></div><div class="col-right" id="lblTCA">${escapeHtml(getValue(["TAXDIST", "TCA"]))}</div>
                </div>
                <div class="col-right">
                    <div class="col-left"><b>Exemption:</b></div><div class="col-right" id="lblExemption">${escapeHtml(getExemption())}</div>
                    <div class="col-left"><b>School Dist:</b></div><div class="col-right" id="lblSchoolDist">${escapeHtml(getValue("School"))}</div>
                    <div class="col-left"><b>Library Dist:</b></div><div class="col-right" id="lblLibraryDist">${escapeHtml(getValue("LIBRARY"))}</div>
                    <div class="col-left"><b>Fire Dist:</b></div><div class="col-right" id="lblFireDist">${escapeHtml(getValue("Fire"))}</div>
                    <div class="col-left"><b>Water Dist:</b></div><div class="col-right" id="lblWaterDist">${escapeHtml(getValue("Water"))}</div>
                </div>
                <div id="owners">
                    <div class="col-full mobile-copy-field"><div class="col-full-left"><b>Owner(s):</b></div><div class="col-full-right" id="lblOwnerName">${copyFieldValue(getValue(["OWNER_NAMES", "OWNER_NAME", "OWN1"]), "Copy owner name")}</div></div>
                    <div class="col-full mobile-copy-field"><div class="col-full-left">&nbsp</div><div class="col-full-right" id="lblOwnerAddress">${copyFieldValue(getValue(["OWNER_ADDRESS", "MAIL_ADDRESS"]), "Copy owner address")}</div></div>
                    <b>Legal Description:</b>&nbsp<div id="lblLegalDescr">${getLegal()}</div>
                </div>
            </div>
            <div id="values">
                <div class="col-head">Year</div><div class="col-head">Market Value</div><div class="col-head">Assessed Value</div><div class="col-head">Taxable Value</div>
                <div class="col-values" id="lblYearCur"><b>${curYear}</b></div><div class="col-values" id="lblYearCurTMV">$${formatCurrencyValue(getValue("MKTVAL"))}</div><div class="col-values" id="lblYearCurTAV">$${formatCurrencyValue(getValue("ASDVAL"))}</div><div class="col-values" id="lblYearCurTTV">$${formatCurrencyValue(getValue("TAXVAL"))}</div>
                ${historicRows.join("")}
            </div>
        </div>
    `;
}
/** Toggles legal description text in place. */
function toggleLegalDescription(btnLegal) {
    const legalValue = btnLegal?.closest("#lblLegalDescr")?.querySelector(".legal-description-value");
    if (!legalValue)
        return;
    const isExpanded = btnLegal.dataset.expanded === "true";
    legalValue.textContent = isExpanded
        ? (legalValue.dataset.shortLegal || "")
        : (legalValue.dataset.fullLegal || "");
    btnLegal.dataset.expanded = isExpanded ? "false" : "true";
    btnLegal.title = isExpanded ? "Show full legal description" : "Collapse legal description";
    btnLegal.setAttribute("aria-label", btnLegal.title);
}
/** Fetches tyler parcel photos. */
async function fetchTylerParcelPhotos(parcelNumber) {
    const response = await fetch(TYLER.photosQueryUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json; charset=utf-8"
        },
        body: JSON.stringify({ pnum: parcelNumber })
    });
    if (!response.ok)
        throw new Error(`Photo lookup failed (${response.status})`);
    const payload = await response.json();
    return normalizeTylerPhotoPayload(payload);
}
/** Fetches tyler parcel photos with fallbacks. */
async function fetchTylerParcelPhotosWithFallbacks(parcelNumbers) {
    const candidates = [...new Set((Array.isArray(parcelNumbers) ? parcelNumbers : [parcelNumbers])
            .map((value) => String(value || "").trim())
            .filter(Boolean))];
    let lastError = null;
    let hadSuccessfulLookup = false;
    for (const candidate of candidates) {
        try {
            const photos = await fetchTylerParcelPhotos(candidate);
            hadSuccessfulLookup = true;
            if (photos.length)
                return photos;
        }
        catch (error) {
            lastError = error;
        }
    }
    if (lastError && !hadSuccessfulLookup)
        throw lastError;
    return [];
}
/** Normalizes tyler photo payload. */
function normalizeTylerPhotoPayload(payload) {
    let values = payload?.d ?? payload;
    if (typeof values === "string") {
        try {
            values = JSON.parse(values);
        }
        catch {
            values = [values];
        }
    }
    if (!Array.isArray(values))
        values = [];
    return values
        .map((value) => {
        if (typeof value === "string")
            return value;
        return value?.url || value?.Url || value?.photoUrl || value?.PhotoUrl || "";
    })
        .map((value) => String(value || "").trim())
        .filter((value) => value && (value.includes("DOCCConv") || /^https?:\/\//i.test(value)))
        .map(normalizeTylerPhotoUrl)
        .filter(isBrowserDisplayablePhotoUrl)
        .filter(Boolean);
}
/** Normalizes tyler photo url. */
function normalizeTylerPhotoUrl(value) {
    const cleaned = String(value || "").trim().replace(/\\/g, "/");
    if (!cleaned)
        return "";
    try {
        return new URL(cleaned, `${TYLER.photoAssetBaseUrl}/`).href;
    }
    catch {
        return cleaned;
    }
}
/** Determines whether browser displayable photo url. */
function isBrowserDisplayablePhotoUrl(value) {
    try {
        const { pathname } = new URL(value);
        return /\.(jpe?g|png|gif|webp|bmp)$/i.test(pathname);
    }
    catch {
        return /\.(jpe?g|png|gif|webp|bmp)(?:[?#].*)?$/i.test(String(value || ""));
    }
}
/** Renders tyler photo viewer. */
function renderTylerPhotoViewer(container, photos, startIndex = 0) {
    if (!container)
        return;
    container.__tylerPhotoViewerCleanup?.();
    container.__tylerPhotoViewerCleanup = null;
    if (!photos.length) {
        container.innerHTML = `
            <div class="tyler-photo-empty">
                No parcel photos found.
            </div>
        `;
        return;
    }
    let activeIndex = Math.min(Math.max(startIndex, 0), photos.length - 1);
    container.innerHTML = `
        <div class="tyler-photo-viewer" role="group" aria-label="Parcel photos" tabindex="0">
            <div class="tyler-photo-stage">
                <button class="tyler-photo-nav previous" type="button" aria-label="Previous photo" title="Previous photo">
                    <calcite-icon preload icon="chevron-left" scale="m"></calcite-icon>
                </button>
                <div class="tyler-photo-container">
                    <img class="tyler-photo-active" alt="Parcel photo" />
                    <button class="tyler-photo-fullscreen-button" type="button" aria-label="Open photo viewer" title="Open photo viewer">
                        <span class="tyler-photo-fullscreen-cue" aria-hidden="true">
                            <calcite-icon preload icon="full-screen"></calcite-icon>
                        </span>
                    </button>
                </div>
                <button class="tyler-photo-nav next" type="button" aria-label="Next photo" title="Next photo">
                    <calcite-icon preload icon="chevron-right" scale="m"></calcite-icon>
                </button>
            </div>
            <div class="tyler-photo-thumbs" aria-label="Photo thumbnails"></div>
        </div>
    `;
    const viewer = container.querySelector(".tyler-photo-viewer");
    const fullscreenButton = container.querySelector(".tyler-photo-fullscreen-button");
    const activeImage = container.querySelector(".tyler-photo-active");
    const previousButton = container.querySelector(".tyler-photo-nav.previous");
    const nextButton = container.querySelector(".tyler-photo-nav.next");
    const thumbs = container.querySelector(".tyler-photo-thumbs");
    let viewerHasPointer = false;
    photos.forEach((photoUrl, index) => {
        const button = document.createElement("button");
        button.className = "tyler-photo-thumb";
        button.type = "button";
        button.setAttribute("aria-label", `Select photo ${index + 1}`);
        const image = document.createElement("img");
        image.src = photoUrl;
        image.alt = `Parcel photo ${index + 1}`;
        button.appendChild(image);
        button.addEventListener("click", () => {
            setActivePhoto(index);
            fullscreenButton?.focus({ preventScroll: true });
        });
        thumbs.appendChild(button);
    });
    const thumbButtons = Array.from(thumbs.querySelectorAll(".tyler-photo-thumb"));
    /** Updates active photo. */
    function setActivePhoto(index) {
        activeIndex = Math.min(Math.max(index, 0), photos.length - 1);
        activeImage.src = photos[activeIndex];
        activeImage.alt = `Parcel photo ${activeIndex + 1}`;
        thumbButtons.forEach((button, thumbIndex) => {
            const isActive = thumbIndex === activeIndex;
            button.classList.toggle("active", isActive);
            button.setAttribute("aria-current", isActive ? "true" : "false");
        });
        thumbButtons[activeIndex]?.scrollIntoView({ block: "nearest", inline: "nearest" });
        previousButton.disabled = photos.length < 2;
        nextButton.disabled = photos.length < 2;
    }
    /** Opens fullscreen viewer. */
    function openFullscreenViewer(index) {
        document.querySelector(".tyler-photo-fullscreen-overlay")?.remove();
        let fullscreenIndex = Math.min(Math.max(index, 0), photos.length - 1);
        const previousOverflow = document.documentElement.style.overflow;
        const overlay = document.createElement("div");
        overlay.className = "tyler-photo-fullscreen-overlay";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.setAttribute("aria-label", "Parcel photo viewer");
        overlay.tabIndex = -1;
        overlay.innerHTML = `
            <div class="tyler-photo-fullscreen-panel">
                <div class="tyler-photo-fullscreen-brand">
                    <img src="${TYLER.logoUrl}" alt="Jackson County GIS" />
                    <div>
                        <div class="tyler-photo-fullscreen-brand-title">Parcel Viewer</div>
                        <div class="tyler-photo-fullscreen-brand-subtitle">Parcel Photos</div>
                    </div>
                </div>
                <button class="tyler-photo-fullscreen-close" type="button" aria-label="Close photo viewer" title="Close photo viewer">
                    <calcite-icon preload icon="x" scale="m"></calcite-icon>
                </button>
                <button class="tyler-photo-fullscreen-nav previous" type="button" aria-label="Previous photo" title="Previous photo">
                    <calcite-icon preload icon="chevron-left" scale="l"></calcite-icon>
                </button>
                <img class="tyler-photo-fullscreen-image" alt="Parcel photo" />
                <button class="tyler-photo-fullscreen-nav next" type="button" aria-label="Next photo" title="Next photo">
                    <calcite-icon preload icon="chevron-right" scale="l"></calcite-icon>
                </button>
                <div class="tyler-photo-fullscreen-count" aria-live="polite"></div>
            </div>
        `;
        const image = overlay.querySelector(".tyler-photo-fullscreen-image");
        const count = overlay.querySelector(".tyler-photo-fullscreen-count");
        const closeButton = overlay.querySelector(".tyler-photo-fullscreen-close");
        const previous = overlay.querySelector(".tyler-photo-fullscreen-nav.previous");
        const next = overlay.querySelector(".tyler-photo-fullscreen-nav.next");
        /** Shows fullscreen photo. */
        function showFullscreenPhoto(nextIndex) {
            fullscreenIndex = (nextIndex + photos.length) % photos.length;
            image.src = photos[fullscreenIndex];
            image.alt = `Parcel photo ${fullscreenIndex + 1}`;
            count.textContent = `${fullscreenIndex + 1} / ${photos.length}`;
            setActivePhoto(fullscreenIndex);
        }
        /** Closes fullscreen viewer. */
        function closeFullscreenViewer() {
            document.documentElement.style.overflow = previousOverflow || "";
            window.removeEventListener("keydown", handleKeydown, true);
            overlay.remove();
            fullscreenButton?.focus({ preventScroll: true });
        }
        /** Handles keydown. */
        function handleKeydown(event) {
            if (event.key === "ArrowLeft") {
                event.preventDefault();
                showFullscreenPhoto(fullscreenIndex - 1);
            }
            else if (event.key === "ArrowRight") {
                event.preventDefault();
                showFullscreenPhoto(fullscreenIndex + 1);
            }
            else if (event.key === "Escape") {
                event.preventDefault();
                closeFullscreenViewer();
            }
        }
        closeButton.addEventListener("click", closeFullscreenViewer);
        previous.addEventListener("click", () => showFullscreenPhoto(fullscreenIndex - 1));
        next.addEventListener("click", () => showFullscreenPhoto(fullscreenIndex + 1));
        overlay.addEventListener("click", (event) => {
            if (event.target === overlay)
                closeFullscreenViewer();
        });
        document.body.appendChild(overlay);
        document.documentElement.style.overflow = "hidden";
        window.addEventListener("keydown", handleKeydown, true);
        showFullscreenPhoto(fullscreenIndex);
        overlay.focus({ preventScroll: true });
    }
    /** Handles cycle sidebar photo. */
    function cycleSidebarPhoto(offset) {
        setActivePhoto((activeIndex + offset + photos.length) % photos.length);
    }
    /** Handles sidebar keydown. */
    function handleSidebarKeydown(event) {
        if (document.querySelector(".tyler-photo-fullscreen-overlay"))
            return;
        if (!viewerHasPointer && !viewer?.contains(document.activeElement))
            return;
        if (event.key === "ArrowLeft") {
            event.preventDefault();
            cycleSidebarPhoto(-1);
        }
        else if (event.key === "ArrowRight") {
            event.preventDefault();
            cycleSidebarPhoto(1);
        }
    }
    fullscreenButton.addEventListener("click", () => openFullscreenViewer(activeIndex));
    previousButton.addEventListener("click", () => cycleSidebarPhoto(-1));
    nextButton.addEventListener("click", () => cycleSidebarPhoto(1));
    viewer?.addEventListener("mouseenter", () => { viewerHasPointer = true; });
    viewer?.addEventListener("mouseleave", () => { viewerHasPointer = false; });
    window.addEventListener("keydown", handleSidebarKeydown, true);
    container.__tylerPhotoViewerCleanup = () => {
        window.removeEventListener("keydown", handleSidebarKeydown, true);
    };
    setActivePhoto(activeIndex);
}
/** Loads tyler photo viewer. */
export async function loadTylerPhotoViewer(container, parcelNumber, { shouldRender = () => true } = {}) {
    if (!container)
        return;
    container.__tylerPhotoViewerCleanup?.();
    container.__tylerPhotoViewerCleanup = null;
    container.innerHTML = `
    <div class="tyler-photo-loader" role="status" aria-live="polite" aria-label="Loading parcel photos">
        <div class="tyler-photo-loader-card">
            <div class="tyler-photo-loader-icon">
                <calcite-icon preload icon="image" scale="l"></calcite-icon>
                <div class="tyler-photo-loader-scan"></div>
            </div>
            <div class="tyler-photo-loader-text">Loading parcel photos</div>
            <div class="tyler-photo-loader-dots" aria-hidden="true">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    </div>
    `;
    try {
        const photos = await fetchTylerParcelPhotosWithFallbacks(parcelNumber);
        if (!shouldRender() || !container.isConnected)
            return;
        renderTylerPhotoViewer(container, photos);
    }
    catch (error) {
        if (!shouldRender() || !container.isConnected)
            return;
        container.innerHTML = `
            <div class="tyler-photo-empty">
                Photo lookup failed.
            </div>
        `;
        logCaughtError("rightPaneContent.js: Tyler photo lookup failed", error);
    }
}
