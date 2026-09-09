import { logCaughtError, notifyUser } from "./errorUX.js";
import { getParcelBatchParseDetails, parseParcelBatch } from "./utils.js";
import { FIELDS, LAYER_TITLES, MAX_SELECTED_PARCELS, SEARCH_COLORS, SERVICE_URLS } from "./constants.js";
const PAGE_ALIASES = Object.freeze({
    parcel: "parcel",
    pv: "parcel",
    pw: "pw",
    sa: "sa",
    pa: "sa"
});
const TEXTAREA_SUGGESTIONS_SINGLE_GROUP_LIMIT = 10;
const TEXTAREA_SUGGESTIONS_MULTI_GROUP_LIMIT = 6;
// Edit sourceKeys here to quickly add/remove search layers per page.
const PAGE_SEARCH_CONFIG = Object.freeze({
    parcel: {
        label: "Parcel Viewer",
        placeholder: "Search Parcel Viewer",
        sourceKeys: ["owner", "parcel", "address", "condo"]
    },
    pw: {
        label: "Public Works",
        placeholder: "Search Public Works",
        sourceKeys: ["parcel", "address", "condo"]
    },
    sa: {
        label: "Property Information",
        placeholder: "Search Property Information",
        sourceKeys: ["parcel", "address", "condo"]
    }
});
const SOURCE_DEFINITIONS = Object.freeze({
    parcel: {
        label: "Parcels",
        placeholder: "Search parcel number",
        searchType: "parcel"
    },
    address: {
        label: "Addresses",
        placeholder: "Search address",
        searchType: "address"
    },
    condo: {
        label: "Condominiums",
        placeholder: "Search condo parcel",
        searchType: "condo"
    },
    owner: {
        label: "Owners",
        placeholder: "Search owner name",
        searchType: "owner"
    }
});
const PARCEL_INFORMATION_QUERY_URL = SERVICE_URLS.parcelInformationQuery;
const CONDO_INFORMATION_DEFINITION = "ParcelSubtype IN (2, 4)";
/** Creates parcel search controller. */
export async function createParcelSearchController({ searchEl,
// Parcel Viewer layers
pvParcelLayer, pvOwnerTableLayer, pvCondoLayer, pvAddressLayer2d, pvAddressLayer3d,
// Public Works layers
pwParcelLayer, pwCondoLayer, pwAddressLayer,
// Property Analysis layers
saParcelLayer, saCondoLayer, saAddressLayer,
// Views
pvMapView, sceneView, pwMapView, saMapView, featureTable, SearchSourceClass,
// PV-only behaviors
switchTo2D, switchTo3D, toggleParcelSelection, selectBuildingFloorParcel, selectMultipleParcelsFromSearch, syncSearchBarWithSelectedParcels, addOwnerParcelLocationPoints, clearOwnerParcelLocationPoints,
// State getters
getActiveView, getCurrentPage, getSelectedParcels, getPVOwnerTableLayer, getPWMapView, getPWParcelLayer, getPWCondoLayer, getPWAddressLayer, getSAMapView, getSAParcelLayer, getSACondoLayer, getSAAddressLayer }) {
    if (!searchEl || !SearchSourceClass)
        return null;
    let saHighlightHandle = null;
    const searchShell = searchEl.closest(".header-search-shell");
    const inactiveSearchTextColor = SEARCH_COLORS.text;
    const activeSearchTextColor = SEARCH_COLORS.text;
    let resolvedSearchDisplayActive = false;
    let currentInputElement = null;
    const searchTextArea = document.getElementById("searchTextArea");
    const searchSuggestionsEl = document.getElementById("searchSuggestions");
    const searchNoticeEl = document.getElementById("searchNotice");
    let pasteSearchPending = false;
    let pasteSearchProcessing = false;
    let suggestionRequestId = 0;
    let suggestionTimer = null;
    let currentSuggestionItems = [];
    const ownerSuggestionGroups = new Map();
    let searchRenderObserver = null;
    let applyCurrentSearchVisibility = null;
    /** Normalizes page key. */
    function normalizePageKey(page) {
        const normalized = String(page || "parcel").trim().toLowerCase();
        return PAGE_ALIASES[normalized] || "parcel";
    }
    /** Clears search ui. */
    function clearSearchUi() {
        setSearchDisplayValue("");
        searchEl.dataset.suppressSuggestions = "false";
        searchEl.dataset.preserveSearchDisplay = "false";
        searchEl.dataset.preservedSearchDisplayValue = "";
        setResolvedSearchDisplayActive(false);
        searchEl.close?.();
        searchEl.blur?.();
        searchTextArea?.blur?.();
    }
    /** Updates suggestion suppressed. */
    function setSuggestionSuppressed(isSuppressed) {
        searchEl.dataset.suppressSuggestions = isSuppressed ? "true" : "false";
    }
    /** Determines whether suggestion suppressed. */
    function isSuggestionSuppressed() {
        return searchEl.dataset.suppressSuggestions === "true";
    }
    /** Closes suggestions only. */
    function closeSuggestionsOnly() {
        try {
            searchEl.close?.();
            hideTextareaSuggestions();
        }
        catch (e) {
            logCaughtError("searchParcels.js: failed to close search suggestions", e);
        }
    }
    /** Shows search-local notice below the header search box. */
    function showSearchNotice(message) {
        const text = String(message || "").trim();
        if (!searchNoticeEl || !text)
            return;
        searchNoticeEl.classList.remove("is-loading");
        searchNoticeEl.textContent = text;
        searchNoticeEl.hidden = false;
        hideTextareaSuggestions();
    }
    /** Shows condo search loading state below the header search box. */
    function showCondoSearchLoading() {
        if (!searchNoticeEl)
            return;
        searchNoticeEl.textContent = "Loading condo selection...";
        searchNoticeEl.classList.add("is-loading");
        searchNoticeEl.hidden = false;
        hideTextareaSuggestions();
    }
    /** Hides search-local notice. */
    function hideSearchNotice() {
        if (!searchNoticeEl)
            return;
        searchNoticeEl.hidden = true;
        searchNoticeEl.textContent = "";
        searchNoticeEl.classList.remove("is-loading");
    }
    /** Updates search display value. */
    function setSearchDisplayValue(value) {
        const nextValue = String(value || "").trim();
        searchEl.value = nextValue;
        searchEl.searchTerm = nextValue;
        if (searchTextArea && searchTextArea.value !== nextValue) {
            searchTextArea.value = nextValue;
        }
    }
    /** Returns search display value. */
    function getSearchDisplayValue() {
        if (searchTextArea) {
            return String(searchTextArea.value || "").trim();
        }
        return String(searchEl.value || searchEl.searchTerm || "").trim();
    }
    /** Updates search display preserved. */
    function setSearchDisplayPreserved(isPreserved) {
        searchEl.dataset.preserveSearchDisplay = isPreserved ? "true" : "false";
    }
    /** Returns preserved search display value. */
    function getPreservedSearchDisplayValue() {
        return String(searchEl.dataset.preservedSearchDisplayValue || "").trim();
    }
    /** Determines whether unlock preserved search display. */
    function shouldUnlockPreservedSearchDisplay(value) {
        if (searchEl.dataset.preserveSearchDisplay !== "true")
            return true;
        const currentValue = String(value || "").trim();
        const preservedValue = getPreservedSearchDisplayValue();
        if (!preservedValue)
            return true;
        if (currentValue === preservedValue)
            return false;
        if (currentValue.startsWith(preservedValue)) {
            return /^[\s]*[,;\n]/.test(currentValue.slice(preservedValue.length));
        }
        return true;
    }
    /** Synchronizes selected parcel search display. */
    function syncSelectedParcelSearchDisplay() {
        if (typeof syncSearchBarWithSelectedParcels !== "function")
            return;
        setSearchDisplayPreserved(false);
        syncSearchBarWithSelectedParcels();
    }
    /** Handles preserve resolved search display. */
    function preserveResolvedSearchDisplay(value) {
        setSearchDisplayPreserved(true);
        setSearchDisplayValue(value);
        searchEl.dataset.preservedSearchDisplayValue = String(value || "").trim();
        setSuggestionSuppressed(true);
    }
    /** Synchronizes search input text color. */
    function syncSearchInputTextColor() {
        const nextColor = resolvedSearchDisplayActive
            ? activeSearchTextColor
            : inactiveSearchTextColor;
        if (currentInputElement) {
            currentInputElement.style.color = nextColor;
            currentInputElement.style.caretColor = nextColor;
        }
        if (searchTextArea) {
            searchTextArea.style.setProperty("--calcite-input-text-color", nextColor);
            searchTextArea.style.setProperty("--calcite-input-placeholder-text-color", SEARCH_COLORS.placeholder);
        }
    }
    /** Updates resolved search display active. */
    function setResolvedSearchDisplayActive(isActive) {
        resolvedSearchDisplayActive = !!isActive;
        syncSearchInputTextColor();
    }
    /** Returns latest search token. */
    function getLatestSearchToken(value) {
        const parts = parseParcelBatch(value);
        return parts[parts.length - 1] || "";
    }
    /** Returns routing search token. */
    function getRoutingSearchToken(value) {
        const raw = String(value || "").trim();
        if (!raw)
            return "";
        const preservedValue = getPreservedSearchDisplayValue();
        if (preservedValue && raw.startsWith(preservedValue)) {
            const suffix = raw.slice(preservedValue.length);
            if (/^[\s]*[,;\t\r\n]/.test(suffix)) {
                return getLatestSearchToken(suffix.replace(/^[\s]*[,;\t\r\n]+/, ""));
            }
        }
        const parts = parseParcelBatch(raw);
        if (parts.length <= 1)
            return raw;
        const allParcelLike = parts.every((part) => {
            const digits = part.replace(/\D/g, "");
            return /^\d{17}$/.test(part) || (/^\d[\d-]*$/.test(part) && digits.length <= 17);
        });
        return allParcelLike ? parts[parts.length - 1] : raw;
    }
    /** Determines whether full address like term. */
    function isFullAddressLikeTerm(value) {
        const raw = normalizeAddressWhitespace(value);
        return /^\d+\s+\S+/.test(raw) && /,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?$/i.test(raw);
    }
    /** Returns search entry tokens. */
    function getSearchEntryTokens(value) {
        const raw = String(value || "").trim();
        if (!raw)
            return [];
        const preservedValue = getPreservedSearchDisplayValue();
        if (preservedValue && raw.startsWith(preservedValue)) {
            const suffix = raw.slice(preservedValue.length);
            if (/^[\s]*[,;\t\r\n]/.test(suffix)) {
                return parseParcelBatch(suffix.replace(/^[\s]*[,;\t\r\n]+/, ""));
            }
        }
        if (isFullAddressLikeTerm(raw))
            return [raw];
        const commaParts = parseParcelBatch(raw);
        if (commaParts.length && commaParts.every(part => /^\d{17}$/.test(part) || /^\d{2}-\d{3}-\d{2}-\d{2}-\d{2}-\d-\d{2}-\d{3}$/.test(part)))
            return commaParts;
        const allParcelLike = commaParts.length > 1 && commaParts.every((part) => {
            const digits = part.replace(/\D/g, "");
            return /^\d{17}$/.test(part) || (/^\d[\d-]*$/.test(part) && digits.length <= 17);
        });
        if (allParcelLike)
            return commaParts;
        return raw
            .split(/[\t\r\n;]+/)
            .map((token) => token.trim())
            .filter(Boolean);
    }
    /** Returns parcel paste no-match message. */
    function getParcelPasteNoMatchMessage(count) {
        const parcelText = count === 1 ? "This parcel number does" : "These parcel numbers do";
        return `${parcelText} not match any parcels in our dataset. If you feel this is an error, contact Jackson County Assessment Mapping.`;
    }
    const ADDRESS_CITY_NAMES = [
        "KANSAS CITY",
        "INDEPENDENCE",
        "LEE'S SUMMIT",
        "LEES SUMMIT",
        "BLUE SPRINGS",
        "RAYTOWN",
        "GRANDVIEW",
        "GRAIN VALLEY",
        "SUGAR CREEK",
        "OAK GROVE",
        "GREENWOOD",
        "LAKE LOTAWANA",
        "LAKE TAPAWINGO",
        "LONE JACK",
        "BUCKNER",
        "LEVASY",
        "SIBLEY",
        "UNITY VILLAGE"
    ];
    const ADDRESS_FIELD_CANDIDATES = Object.freeze({
        city: ["CITY", "CITY_NAME", "MUNICIPALITY", "COMMUNITY", "POSTCOMM", "POSTALCITY"],
        state: ["STATE", "STATE_ABBR", "ST", "STATECODE"],
        zip: ["ZIP", "ZIPCODE", "ZIP_CODE", "POSTAL", "POSTALCODE"]
    });
    /** Normalizes address whitespace. */
    function normalizeAddressWhitespace(value) {
        return String(value || "")
            .replace(/\s+/g, " ")
            .replace(/\s+,/g, ",")
            .trim();
    }
    /** Parses address search term. */
    function parseAddressSearchTerm(value) {
        let raw = normalizeAddressWhitespace(value);
        const parsed = {
            raw,
            street: raw,
            city: "",
            state: "",
            zip: ""
        };
        if (!raw)
            return parsed;
        const stateZipMatch = raw.match(/,?\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
        if (stateZipMatch) {
            parsed.state = stateZipMatch[1].toUpperCase();
            parsed.zip = stateZipMatch[2];
            raw = raw.slice(0, stateZipMatch.index).replace(/,+$/g, "").trim();
        }
        const upperRaw = raw.toUpperCase();
        const city = ADDRESS_CITY_NAMES.find((candidate) => upperRaw.endsWith(` ${candidate}`) || upperRaw === candidate);
        if (city) {
            parsed.city = city === "LEES SUMMIT" ? "LEE'S SUMMIT" : city;
            raw = raw.slice(0, Math.max(0, raw.length - city.length)).replace(/,+$/g, "").trim();
        }
        else if (raw.includes(",")) {
            const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
            if (parts.length > 1) {
                parsed.city = parts[parts.length - 1].toUpperCase();
                raw = parts.slice(0, -1).join(", ");
            }
        }
        parsed.street = normalizeAddressWhitespace(raw)
            .replace(/\b(?:APT|UNIT|STE|SUITE|#)\b.*$/i, "")
            .trim();
        parsed.raw = normalizeAddressWhitespace(value);
        return parsed;
    }
    /** Normalizes address search term. */
    function normalizeAddressSearchTerm(value) {
        return parseAddressSearchTerm(value).street;
    }
    /** Returns layer field name. */
    function getLayerFieldName(layer, candidates) {
        const fieldNames = (layer?.fields || []).map((field) => field.name).filter(Boolean);
        const fieldNamesUpper = new Map(fieldNames.map((name) => [name.toUpperCase(), name]));
        return candidates.map((candidate) => fieldNamesUpper.get(candidate.toUpperCase())).find(Boolean) || "";
    }
    /** Returns address layer field names. */
    function getAddressLayerFieldNames(layer) {
        return {
            city: getLayerFieldName(layer, ADDRESS_FIELD_CANDIDATES.city),
            state: getLayerFieldName(layer, ADDRESS_FIELD_CANDIDATES.state),
            zip: getLayerFieldName(layer, ADDRESS_FIELD_CANDIDATES.zip)
        };
    }
    /** Builds address where. */
    function buildAddressWhere(term, layer = null) {
        const parsed = parseAddressSearchTerm(term);
        const fields = getAddressLayerFieldNames(layer);
        const candidates = [
            parsed.street,
            parsed.raw,
            parsed.raw.split(",")[0]
        ]
            .map((candidate) => candidate.replace(/\s+/g, " ").trim())
            .filter(Boolean);
        const uniqueCandidates = [...new Set(candidates)];
        if (!uniqueCandidates.length)
            return "1=0";
        const streetWhere = uniqueCandidates
            .map((candidate) => {
            const escapedCandidate = escapeSql(candidate);
            const tokenPattern = escapeSql(candidate.split(/\s+/).join("%"));
            return `(UPPER(FULLADDR) LIKE UPPER('%${escapedCandidate}%') OR UPPER(FULLADDR) LIKE UPPER('%${tokenPattern}%'))`;
        })
            .join(" OR ");
        const componentWhere = [];
        if (parsed.city && fields.city)
            componentWhere.push(`UPPER(${fields.city}) = UPPER('${escapeSql(parsed.city)}')`);
        if (parsed.state && fields.state)
            componentWhere.push(`UPPER(${fields.state}) = UPPER('${escapeSql(parsed.state)}')`);
        if (parsed.zip && fields.zip)
            componentWhere.push(`${fields.zip} LIKE '${escapeSql(parsed.zip)}%'`);
        if (!componentWhere.length)
            return streetWhere;
        return `((${streetWhere}) AND ${componentWhere.join(" AND ")}) OR (${streetWhere})`;
    }
    /** Returns address attr value. */
    function getAddressAttrValue(attrs, candidates) {
        if (!attrs)
            return "";
        for (const candidate of candidates) {
            const exact = attrs[candidate];
            if (exact != null && exact !== "")
                return String(exact);
            const matchedKey = Object.keys(attrs).find((key) => key.toUpperCase() === candidate.toUpperCase());
            const matchedValue = matchedKey ? attrs[matchedKey] : "";
            if (matchedValue != null && matchedValue !== "")
                return String(matchedValue);
        }
        return "";
    }
    /** Formats address display. */
    function formatAddressDisplay(attrs = {}) {
        const street = String(attrs.FULLADDR || "").trim();
        const city = getAddressAttrValue(attrs, ADDRESS_FIELD_CANDIDATES.city).trim();
        const state = getAddressAttrValue(attrs, ADDRESS_FIELD_CANDIDATES.state).trim();
        const zip = getAddressAttrValue(attrs, ADDRESS_FIELD_CANDIDATES.zip).trim();
        const cityStateZip = [city, [state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
        return [street, cityStateZip].filter(Boolean).join(", ");
    }
    /** Returns current page safe. */
    function getCurrentPageSafe() {
        return normalizePageKey(getCurrentPage?.() || "parcel");
    }
    /** Returns page config. */
    function getPageConfig(page = getCurrentPageSafe()) {
        return PAGE_SEARCH_CONFIG[normalizePageKey(page)] || PAGE_SEARCH_CONFIG.parcel;
    }
    /** Returns pvaddress layer. */
    function getPVAddressLayer() {
        const activeView = getActiveView?.();
        return activeView === sceneView ? pvAddressLayer3d : pvAddressLayer2d;
    }
    /** Returns pvowner table layer safe. */
    function getPVOwnerTableLayerSafe() {
        return getPVOwnerTableLayer?.() || pvOwnerTableLayer || null;
    }
    /** Returns pwmap view safe. */
    function getPWMapViewSafe() {
        return getPWMapView?.() || pwMapView || null;
    }
    /** Returns pwparcel layer safe. */
    function getPWParcelLayerSafe() {
        return getPWParcelLayer?.() || pwParcelLayer || null;
    }
    /** Returns pwcondo layer safe. */
    function getPWCondoLayerSafe() {
        return getPWCondoLayer?.() || pwCondoLayer || null;
    }
    /** Returns pwaddress layer safe. */
    function getPWAddressLayerSafe() {
        return getPWAddressLayer?.() || pwAddressLayer || null;
    }
    /** Returns samap view safe. */
    function getSAMapViewSafe() {
        return getSAMapView?.() || saMapView || null;
    }
    /** Returns saparcel layer safe. */
    function getSAParcelLayerSafe() {
        return getSAParcelLayer?.() || saParcelLayer || null;
    }
    /** Returns sacondo layer safe. */
    function getSACondoLayerSafe() {
        return getSACondoLayer?.() || saCondoLayer || null;
    }
    /** Returns saaddress layer safe. */
    function getSAAddressLayerSafe() {
        return getSAAddressLayer?.() || saAddressLayer || null;
    }
    /** Finds layer by title. */
    function findLayerByTitle(view, titles) {
        const titleSet = new Set((titles || []).map((title) => String(title).toLowerCase()));
        return view?.map?.allLayers?.find((layer) => titleSet.has(String(layer.title || "").toLowerCase())) || null;
    }
    const pageResolvers = {
        parcel: {
            getView: () => getActiveView?.() || pvMapView || null,
            getLayer: (sourceKey) => {
                const activeView = getActiveView?.() || pvMapView || sceneView || null;
                if (sourceKey === "parcel") {
                    return pvParcelLayer ||
                        findLayerByTitle(pvMapView, [LAYER_TITLES.parcels]) ||
                        findLayerByTitle(activeView, [LAYER_TITLES.parcels]) ||
                        null;
                }
                if (sourceKey === "owner")
                    return getPVOwnerTableLayerSafe();
                if (sourceKey === "condo") {
                    return pvCondoLayer ||
                        findLayerByTitle(sceneView, [LAYER_TITLES.parcelCondominiumsFloors, LAYER_TITLES.parcelCondominiums]) ||
                        findLayerByTitle(activeView, [LAYER_TITLES.parcelCondominiumsFloors, LAYER_TITLES.parcelCondominiums]) ||
                        null;
                }
                if (sourceKey === "address")
                    return getPVAddressLayer();
                return null;
            }
        },
        pw: {
            getView: () => getPWMapViewSafe(),
            getLayer: (sourceKey) => {
                if (sourceKey === "parcel")
                    return getPWParcelLayerSafe();
                if (sourceKey === "condo")
                    return getPWCondoLayerSafe();
                if (sourceKey === "address")
                    return getPWAddressLayerSafe();
                return null;
            }
        },
        sa: {
            getView: () => getSAMapViewSafe(),
            getLayer: (sourceKey) => {
                if (sourceKey === "parcel")
                    return getSAParcelLayerSafe();
                if (sourceKey === "condo")
                    return getSACondoLayerSafe();
                if (sourceKey === "address")
                    return getSAAddressLayerSafe();
                return null;
            }
        }
    };
    /** Returns search context for page. */
    function getSearchContextForPage(page = getCurrentPageSafe()) {
        const normalizedPage = normalizePageKey(page);
        const config = getPageConfig(normalizedPage);
        const resolver = pageResolvers[normalizedPage] || pageResolvers.parcel;
        const layers = {
            parcel: resolver.getLayer("parcel"),
            owner: resolver.getLayer("owner"),
            address: resolver.getLayer("address"),
            condo: resolver.getLayer("condo")
        };
        const availableSourceKeys = config.sourceKeys.filter((sourceKey) => {
            if (normalizedPage === "parcel" && sourceKey === "owner")
                return true;
            return !!layers[sourceKey];
        });
        return {
            page: normalizedPage,
            config,
            view: resolver.getView?.() || null,
            layers,
            availableSourceKeys
        };
    }
    /** Handles delay. */
    function delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    /** Waits for for available sources. */
    async function waitForAvailableSources(page, { timeoutMs = 8000, pollMs = 250, minSources = 1 } = {}) {
        const startedAt = Date.now();
        let context = getSearchContextForPage(page);
        while (Date.now() - startedAt < timeoutMs) {
            if (context.availableSourceKeys.length >= minSources) {
                return context;
            }
            await delay(pollMs);
            context = getSearchContextForPage(page);
        }
        return context;
    }
    /** Escapes sql. */
    function escapeSql(value) {
        return String(value ?? "").replace(/'/g, "''");
    }
    /** Handles layer has field. */
    function layerHasField(layer, fieldName) {
        const fields = layer?.fields || [];
        return fields.some((field) => String(field.name).toLowerCase() === String(fieldName).toLowerCase());
    }
    /** Returns search out fields. */
    function getSearchOutFields(layer, { includeAddress = true } = {}) {
        const candidates = [
            FIELDS.objectId, FIELDS.name, FIELDS.pin, FIELDS.parcelNumber,
            FIELDS.parid, FIELDS.paridLower, FIELDS.parcelId, FIELDS.parcelIdUpper,
            FIELDS.parcelSubtype, "CartogNote", FIELDS.floorName,
            FIELDS.floorNameDesignator, "FloorDesignator", "ADDPTKEY"
        ];
        if (includeAddress) {
            candidates.push("FULLADDR", ...ADDRESS_FIELD_CANDIDATES.city, ...ADDRESS_FIELD_CANDIDATES.state, ...ADDRESS_FIELD_CANDIDATES.zip);
        }
        const fields = Array.isArray(layer?.fields) ? layer.fields : [];
        if (!fields.length)
            return [...new Set(candidates)];
        const byLower = new Map(fields.map((field) => [String(field.name).toLowerCase(), field.name]));
        return [...new Set(candidates.map((name) => byLower.get(String(name).toLowerCase())).filter(Boolean))];
    }
    /** Returns fields needed only to render search suggestions. */
    function getSearchSuggestionOutFields(layer, sourceKey) {
        const objectIdField = layer?.objectIdField || FIELDS.objectId;
        const candidates = [
            objectIdField,
            FIELDS.objectId
        ];
        if (sourceKey === "address") {
            candidates.push("FULLADDR", ...ADDRESS_FIELD_CANDIDATES.city, ...ADDRESS_FIELD_CANDIDATES.state, ...ADDRESS_FIELD_CANDIDATES.zip);
        }
        else {
            candidates.push(FIELDS.name, FIELDS.pin, FIELDS.parcelNumber, FIELDS.parid, FIELDS.paridLower, FIELDS.parcelId, FIELDS.parcelIdUpper);
        }
        const fields = Array.isArray(layer?.fields) ? layer.fields : [];
        if (!fields.length)
            return [...new Set(candidates)];
        const byLower = new Map(fields.map((field) => [String(field.name).toLowerCase(), field.name]));
        return [...new Set(candidates.map((name) => byLower.get(String(name).toLowerCase())).filter(Boolean))];
    }
    /** Handles with condo subtype where. */
    function withCondoSubtypeWhere(layer, where) {
        return layerHasField(layer, FIELDS.parcelSubtype)
            ? `${CONDO_INFORMATION_DEFINITION} AND (${where})`
            : where;
    }
    /** Returns attribute case insensitive. */
    function getAttributeCaseInsensitive(attributes, fieldName) {
        if (!attributes)
            return undefined;
        if (attributes[fieldName] !== undefined)
            return attributes[fieldName];
        const targetKey = String(fieldName).toLowerCase();
        const matchKey = Object.keys(attributes).find((key) => key.toLowerCase() === targetKey);
        return matchKey ? attributes[matchKey] : undefined;
    }
    /** Returns feature name. */
    function getFeatureName(feature) {
        return getAttributeCaseInsensitive(feature?.attributes, FIELDS.name);
    }
    /** Returns parcel suggestion display. */
    function getParcelSuggestionDisplay(feature) {
        return getFeatureName(feature) ||
            formatParcelWithDashes(getAttributeCaseInsensitive(feature?.attributes, FIELDS.parid) ||
                getAttributeCaseInsensitive(feature?.attributes, FIELDS.paridLower) ||
                getAttributeCaseInsensitive(feature?.attributes, FIELDS.parcelId) ||
                getAttributeCaseInsensitive(feature?.attributes, FIELDS.parcelIdUpper) ||
                "");
    }
    /** Returns feature cartog note. */
    function getFeatureCartogNote(feature) {
        return getAttributeCaseInsensitive(feature?.attributes, "CartogNote");
    }
    /** Returns feature floor key. */
    function getFeatureFloorKey(feature) {
        return getAttributeCaseInsensitive(feature?.attributes, FIELDS.floorName) ??
            getAttributeCaseInsensitive(feature?.attributes, FIELDS.floorNameDesignator) ??
            getAttributeCaseInsensitive(feature?.attributes, "FloorDesignator");
    }
    /** Determines whether building floor panel fields. */
    function hasBuildingFloorPanelFields(feature) {
        return !!(getFeatureCartogNote(feature) && getFeatureFloorKey(feature) != null && getFeatureName(feature));
    }
    /** Returns search input kind. */
    function getSearchInputKind(term) {
        const value = String(term || "").trim();
        if (!value)
            return "unknown";
        if (/^\d/.test(value))
            return "numeric";
        if (/^[A-Za-z]/.test(value))
            return "alpha";
        return "unknown";
    }
    /** Determines whether parcel number like term. */
    function isParcelNumberLikeTerm(term) {
        const value = String(term || "").trim();
        if (!value)
            return false;
        const digits = value.replace(/\D/g, "");
        const hasDash = value.includes("-");
        // 17-digit values are parcel IDs. A numeric value with dashes is parcel/condo
        // shaped once the user types the first dash, so it should not query addresses.
        return /^\d{17}$/.test(value) || (hasDash && /^\d[\d-]*$/.test(value) && digits.length <= 17);
    }
    /** Determines whether exact parcel number term. */
    function isExactParcelNumberTerm(term) {
        const value = String(term || "").trim();
        const digits = value.replace(/\D/g, "");
        return digits.length === 17 && /^\d[\d-]*$/.test(value);
    }
    /** Determines whether numeric parcel search field. */
    function isNumericParcelSearchField(fieldName) {
        return fieldName === FIELDS.name ||
            fieldName === FIELDS.parcelId ||
            fieldName === FIELDS.parid ||
            fieldName === FIELDS.paridLower;
    }
    /** Returns parcel id search fields. */
    function getParcelIdSearchFields(layer) {
        const candidates = [FIELDS.parid, FIELDS.paridLower, FIELDS.parcelId, FIELDS.parcelIdUpper];
        const fields = Array.isArray(layer?.fields) ? layer.fields : [];
        if (!fields.length)
            return candidates;
        const actualFieldNames = candidates
            .map((fieldName) => fields.find((field) => String(field.name).toLowerCase() === fieldName.toLowerCase())?.name)
            .filter(Boolean);
        return [...new Map(actualFieldNames.map((fieldName) => [fieldName.toLowerCase(), fieldName])).values()];
    }
    /** Builds parcel id clauses. */
    function buildParcelIdClauses(layer, operator, value) {
        return getParcelIdSearchFields(layer).map((fieldName) => `${fieldName} ${operator} '${value}'`);
    }
    /** Determines whether query field. */
    function canQueryField(layer, fieldName) {
        const fields = Array.isArray(layer?.fields) ? layer.fields : [];
        return !fields.length || layerHasField(layer, fieldName);
    }
    /** Builds parcel like prefix where. */
    function buildParcelLikePrefixWhere(fieldName, term, layer = null) {
        if (!isNumericParcelSearchField(fieldName)) {
            return `UPPER(${fieldName}) LIKE UPPER('${term}%')`;
        }
        const raw = String(term || "");
        const digits = raw.replace(/\D/g, "");
        const clauses = (raw.includes("-") || fieldName === FIELDS.name) && canQueryField(layer, FIELDS.name)
            ? [`${FIELDS.name} LIKE '${raw}%'`]
            : [];
        if (digits) {
            clauses.push(...buildParcelIdClauses(layer, "LIKE", `${digits}%`));
            if ((raw.includes("-") || fieldName === FIELDS.name) && canQueryField(layer, FIELDS.name)) {
                clauses.push(`${FIELDS.name} LIKE '${formatParcelWithDashes(digits)}%'`);
            }
        }
        else {
            clauses.push(...buildParcelIdClauses(layer, "LIKE", `${raw}%`));
        }
        const uniqueClauses = [...new Set(clauses)];
        return uniqueClauses.length ? `(${uniqueClauses.join(" OR ")})` : "1=0";
    }
    /** Builds condo parcel like prefix where. */
    function buildCondoParcelLikePrefixWhere(term) {
        const digits = String(term || "").replace(/\D/g, "");
        const clauses = [`${FIELDS.name} LIKE '${term}%'`];
        if (digits) {
            clauses.push(`${FIELDS.parcelId} LIKE '${escapeSql(digits)}%'`);
            clauses.push(`${FIELDS.name} LIKE '${escapeSql(formatParcelWithDashes(digits))}%'`);
        }
        else {
            clauses.push(`${FIELDS.parcelId} LIKE '${term}%'`);
        }
        const uniqueClauses = [...new Set(clauses)];
        return uniqueClauses.length ? `(${uniqueClauses.join(" OR ")})` : "1=0";
    }
    /** Builds parcel like exact where. */
    function buildParcelLikeExactWhere(fieldName, term, layer = null) {
        if (!isNumericParcelSearchField(fieldName)) {
            return `UPPER(${fieldName}) = UPPER('${term}')`;
        }
        const raw = String(term || "");
        const digits = raw.replace(/\D/g, "");
        const clauses = (raw.includes("-") || fieldName === FIELDS.name) && canQueryField(layer, FIELDS.name)
            ? [`${FIELDS.name} = '${raw}'`]
            : [];
        if (digits) {
            clauses.push(...buildParcelIdClauses(layer, "=", digits));
            if ((raw.includes("-") || fieldName === FIELDS.name) && canQueryField(layer, FIELDS.name)) {
                clauses.push(`${FIELDS.name} = '${formatParcelWithDashes(digits)}'`);
            }
        }
        else {
            clauses.push(...buildParcelIdClauses(layer, "=", raw));
        }
        const uniqueClauses = [...new Set(clauses)];
        return uniqueClauses.length ? `(${uniqueClauses.join(" OR ")})` : "1=0";
    }
    /** Determines whether use source for term. */
    function shouldUseSourceForTerm(page, sourceKey, term) {
        const routingToken = getRoutingSearchToken(term);
        const inputKind = getSearchInputKind(routingToken);
        if (normalizePageKey(page) !== "parcel")
            return true;
        if (isParcelNumberLikeTerm(routingToken))
            return sourceKey === "parcel" || sourceKey === "condo";
        if (inputKind === "numeric" && /[A-Za-z]/.test(routingToken))
            return sourceKey === "address";
        if (inputKind === "numeric")
            return sourceKey !== "owner";
        if (inputKind === "alpha")
            return sourceKey === "owner";
        return true;
    }
    /** Formats parcel with dashes. */
    function formatParcelWithDashes(value) {
        const digits = String(value || "").replace(/\D/g, "");
        if (digits.length !== 17)
            return String(value || "");
        return digits.replace(/^(\d{2})(\d{3})(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})(\d{3})$/, "$1-$2-$3-$4-$5-$6-$7-$8");
    }
    /** Returns parcel tail segment. */
    function getParcelTailSegment(value) {
        const text = String(value ?? "").trim();
        const dashedTail = text.match(/-(\d{2,3})$/)?.[1];
        if (dashedTail)
            return dashedTail;
        const digits = text.replace(/\D/g, "");
        return digits.slice(-3);
    }
    /** Determines whether condo common area parcel value. */
    function isCondoCommonAreaParcelValue(value) {
        const tail = getParcelTailSegment(value);
        return tail.length >= 2 && /^0+$/.test(tail);
    }
    /** Returns feature parcel sort value. */
    function getFeatureParcelSortValue(feature) {
        return getFeatureName(feature) ??
            getAttributeCaseInsensitive(feature?.attributes, FIELDS.parcelId) ??
            "";
    }
    /** Sorts condo suggestion features. */
    function sortCondoSuggestionFeatures(features) {
        return [...(features || [])].sort((a, b) => {
            const aValue = getFeatureParcelSortValue(a);
            const bValue = getFeatureParcelSortValue(b);
            const aCommonArea = isCondoCommonAreaParcelValue(aValue);
            const bCommonArea = isCondoCommonAreaParcelValue(bValue);
            if (aCommonArea !== bCommonArea)
                return aCommonArea ? 1 : -1;
            return String(aValue).localeCompare(String(bValue), undefined, {
                numeric: true,
                sensitivity: "base"
            });
        });
    }
    /** Returns search field from term. */
    function getSearchFieldFromTerm(term) {
        return term.includes("-") ? FIELDS.name : FIELDS.parid;
    }
    /** Normalizes owner name. */
    function normalizeOwnerName(value) {
        return String(value ?? "").replace(/(?:\s*,\s*)+$/g, "").replace(/\s+/g, " ").trim();
    }
    /** Returns owner attrs name. */
    function getOwnerAttrsName(attrs) {
        return normalizeOwnerName(attrs?.[FIELDS.ownerNames] ?? attrs?.[FIELDS.ownerNamesLower] ?? "");
    }
    /** Returns owner attrs parid. */
    function getOwnerAttrsParid(attrs) {
        return String(attrs?.[FIELDS.parid] ?? attrs?.[FIELDS.paridLower] ?? "").replace(/\D/g, "");
    }
    /** Handles group owner rows. */
    function groupOwnerRows(features, { maxOwners = 10 } = {}) {
        const groups = new Map();
        for (const feature of features || []) {
            const attrs = feature.attributes || {};
            const ownerName = getOwnerAttrsName(attrs);
            const parid = getOwnerAttrsParid(attrs);
            if (!ownerName || !parid)
                continue;
            const groupKey = ownerName.toUpperCase();
            let group = groups.get(groupKey);
            if (!group) {
                group = {
                    ownerName,
                    parids: new Set()
                };
                groups.set(groupKey, group);
            }
            group.parids.add(parid);
        }
        return [...groups.values()]
            .sort((a, b) => a.ownerName.localeCompare(b.ownerName))
            .slice(0, maxOwners)
            .map((group) => ({
            ownerName: group.ownerName,
            parids: [...group.parids].sort()
        }));
    }
    /** Returns owner group cache key. */
    function getOwnerGroupCacheKey(ownerName) {
        return normalizeOwnerName(ownerName).toUpperCase();
    }
    /** Queries owner groups by name. */
    async function queryOwnerGroupsByName(term, { exact = false, maxOwners = 10, maxRows = 2000 } = {}) {
        const ownerTable = getSearchContextForPage("parcel").layers.owner;
        const searchTerm = String(term || "").trim();
        if (searchTerm.length < 2)
            return [];
        const safeTerm = escapeSql(searchTerm);
        const where = exact
            ? `UPPER(${FIELDS.ownerNames}) = UPPER('${safeTerm}')`
            : `UPPER(${FIELDS.ownerNames}) LIKE UPPER('%${safeTerm}%')`;
        try {
            let features = [];
            if (ownerTable) {
                const res = await ownerTable.queryFeatures({
                    where,
                    outFields: [FIELDS.parid, FIELDS.taxYear, FIELDS.ownerNames],
                    returnGeometry: false,
                    num: maxRows
                });
                features = res.features || [];
            }
            else {
                const params = new URLSearchParams({
                    f: "json",
                    where,
                    outFields: [FIELDS.parid, FIELDS.taxYear, FIELDS.ownerNames].join(","),
                    returnGeometry: "false",
                    resultRecordCount: String(maxRows)
                });
                const response = await fetch(`${PARCEL_INFORMATION_QUERY_URL}?${params.toString()}`);
                if (!response.ok) {
                    throw new Error(`Owner REST query failed with HTTP ${response.status}`);
                }
                const json = await response.json();
                if (json.error) {
                    throw new Error(json.error.message || "Owner REST query returned an error");
                }
                features = (json.features || []).map((feature) => ({
                    attributes: feature.attributes || {}
                }));
            }
            return groupOwnerRows(features, { maxOwners });
        }
        catch (error) {
            return [];
        }
    }
    /** Finds parcel features by parids. */
    async function findParcelFeaturesByParids(parids, { limit = MAX_SELECTED_PARCELS } = {}) {
        const parcelLayer = getSearchContextForPage("parcel").layers.parcel;
        const normalizedParids = [...new Set((parids || [])
                .map((parid) => String(parid || "").replace(/\D/g, ""))
                .filter(Boolean))]
            .slice(0, limit);
        if (!parcelLayer || !normalizedParids.length)
            return [];
        const parcelIds = normalizedParids.map((parid) => `'${escapeSql(parid)}'`);
        const dashedNames = normalizedParids
            .map(formatParcelWithDashes)
            .map((parid) => `'${escapeSql(parid)}'`);
        const parcelIdClauses = getParcelIdSearchFields(parcelLayer)
            .map((fieldName) => `${fieldName} IN (${parcelIds.join(",")})`);
        parcelIdClauses.push(`${FIELDS.name} IN (${dashedNames.join(",")})`);
        const res = await parcelLayer.queryFeatures({
            where: `(${[...new Set(parcelIdClauses)].join(" OR ")})`,
            outFields: getSearchOutFields(parcelLayer),
            returnGeometry: true
        });
        return (res.features || []).map((feature) => {
            try {
                feature.layer = feature.layer || parcelLayer;
            }
            catch (e) {
                logCaughtError("searchParcels.js: suppressed recoverable error", e);
            }
            return feature;
        });
    }
    /** Finds condo floor workflow features by parcel ids. */
    async function findCondoFeaturesByParids(parids, { limit = MAX_SELECTED_PARCELS } = {}) {
        const condoLayer = getSearchContextForPage("parcel").layers.condo;
        const normalizedParids = [...new Set((parids || [])
                .map((parid) => String(parid || "").replace(/\D/g, ""))
                .filter(Boolean))]
            .slice(0, limit);
        if (!condoLayer || !normalizedParids.length)
            return [];
        await condoLayer.load?.();
        const parcelIds = normalizedParids.map((parid) => `'${escapeSql(parid)}'`);
        const dashedNames = normalizedParids
            .map(formatParcelWithDashes)
            .map((parid) => `'${escapeSql(parid)}'`);
        const clauses = [];
        if (canQueryField(condoLayer, FIELDS.name)) {
            clauses.push(`${FIELDS.name} IN (${dashedNames.join(",")})`);
        }
        if (canQueryField(condoLayer, FIELDS.parcelId)) {
            clauses.push(`${FIELDS.parcelId} IN (${parcelIds.join(",")})`);
        }
        if (canQueryField(condoLayer, FIELDS.parcelIdUpper)) {
            clauses.push(`${FIELDS.parcelIdUpper} IN (${parcelIds.join(",")})`);
        }
        if (!clauses.length)
            return [];
        const res = await condoLayer.queryFeatures({
            where: withCondoSubtypeWhere(condoLayer, `(${[...new Set(clauses)].join(" OR ")})`),
            outFields: getSearchOutFields(condoLayer),
            returnGeometry: true,
            orderByFields: ["Name ASC"],
            num: limit
        });
        const byParid = new Map();
        for (const feature of res.features || []) {
            if (!hasBuildingFloorPanelFields(feature))
                continue;
            try {
                feature.layer = feature.layer || condoLayer;
            }
            catch (e) {
                logCaughtError("searchParcels.js: suppressed recoverable error", e);
            }
            const key = String(getAttributeCaseInsensitive(feature.attributes, FIELDS.parcelId) || getFeatureName(feature) || "").replace(/\D/g, "");
            if (key && !byParid.has(key)) {
                byParid.set(key, feature);
            }
        }
        return normalizedParids.map((parid) => byParid.get(parid)).filter(Boolean);
    }
    /** Builds owner group search result. */
    async function buildOwnerGroupSearchResult(ownerGroup) {
        const features = await findParcelFeaturesByParids(ownerGroup?.parids || []);
        if (!features.length)
            return null;
        return {
            name: `${ownerGroup.ownerName} (${ownerGroup.parids.length} properties)`,
            feature: features[0],
            features,
            ownerName: ownerGroup.ownerName,
            propertyCount: ownerGroup.parids.length,
            searchType: "owner"
        };
    }
    /** Determines whether likely condo building parcel term. */
    function isLikelyCondoBuildingParcelTerm(term, feature) {
        const values = [
            term,
            getAttributeCaseInsensitive(feature?.attributes, FIELDS.parcelId),
            getAttributeCaseInsensitive(feature?.attributes, FIELDS.name)
        ];
        return values.some((value) => {
            const digits = String(value || "").replace(/\D/g, "");
            return digits.length >= 4 && digits.endsWith("0000");
        });
    }
    /** Finds first owner match. */
    async function findFirstOwnerMatch(term) {
        const groups = await queryOwnerGroupsByName(getLatestSearchToken(term), { maxOwners: 1 });
        return groups[0] ? buildOwnerGroupSearchResult(groups[0]) : null;
    }
    /** Finds first feature match. */
    async function findFirstFeatureMatch(layer, { term, outFields, searchType, where, orderByFields }) {
        if (!layer || !term)
            return null;
        const res = await layer.queryFeatures({
            where,
            outFields,
            returnGeometry: true,
            orderByFields,
            num: 1
        });
        const feature = res.features?.[0];
        if (!feature)
            return null;
        // ensure the feature knows its originating layer (used by selection/highlight helpers)
        try {
            feature.layer = feature.layer || layer;
        }
        catch (e) {
            logCaughtError("searchParcels.js: suppressed recoverable error", e);
        }
        return {
            name: searchType === "address"
                ? (formatAddressDisplay(feature.attributes) || feature.attributes?.FULLADDR || term)
                : (getFeatureName(feature) || feature.attributes?.FULLADDR || term),
            feature,
            searchType
        };
    }
    /** Finds exact condo workflow match. */
    async function findExactCondoWorkflowMatch(layer, { term, where, orderByFields }) {
        if (!layer || !term)
            return null;
        const res = await layer.queryFeatures({
            where,
            outFields: getSearchOutFields(layer),
            returnGeometry: true,
            orderByFields,
            num: 50
        });
        const feature = (res.features || []).find(hasBuildingFloorPanelFields) || null;
        if (!feature)
            return null;
        try {
            feature.layer = feature.layer || layer;
        }
        catch (e) {
            logCaughtError("searchParcels.js: suppressed recoverable error", e);
        }
        return {
            name: getFeatureName(feature) || term,
            feature,
            searchType: "condo"
        };
    }
    /** Finds first match. */
    async function findFirstMatch(term) {
        const searchTerm = getRoutingSearchToken(term);
        if (!searchTerm)
            return null;
        const safeTerm = escapeSql(searchTerm);
        const fieldName = getSearchFieldFromTerm(searchTerm);
        const context = getSearchContextForPage();
        if (context.page === "parcel" &&
            isExactParcelNumberTerm(searchTerm) &&
            context.config.sourceKeys.includes("condo") &&
            shouldUseSourceForTerm(context.page, "condo", searchTerm)) {
            const condoLayer = context.layers.condo;
            if (condoLayer) {
                await condoLayer.load?.();
                const condoMatch = await findExactCondoWorkflowMatch(condoLayer, {
                    term: searchTerm,
                    where: withCondoSubtypeWhere(condoLayer, buildParcelLikeExactWhere(fieldName, safeTerm, condoLayer)),
                    orderByFields: ["Name ASC"]
                });
                if (condoMatch) {
                    return condoMatch;
                }
            }
        }
        for (const sourceKey of context.config.sourceKeys) {
            if (!shouldUseSourceForTerm(context.page, sourceKey, searchTerm))
                continue;
            const layer = context.layers[sourceKey];
            if (!layer) {
                continue;
            }
            await layer.load?.();
            let match = null;
            if (sourceKey === "owner") {
                match = await findFirstOwnerMatch(searchTerm);
            }
            else if (sourceKey === "address") {
                const addressTerm = normalizeAddressSearchTerm(searchTerm);
                match = await findFirstFeatureMatch(layer, {
                    term: addressTerm,
                    outFields: getSearchOutFields(layer),
                    searchType: "address",
                    where: buildAddressWhere(searchTerm, layer),
                    orderByFields: ["FULLADDR ASC"]
                });
            }
            else {
                match = await findFirstFeatureMatch(layer, {
                    term: searchTerm,
                    outFields: getSearchOutFields(layer),
                    searchType: SOURCE_DEFINITIONS[sourceKey].searchType,
                    where: sourceKey === "condo"
                        ? withCondoSubtypeWhere(layer, buildCondoParcelLikePrefixWhere(safeTerm))
                        : buildParcelLikePrefixWhere(fieldName, safeTerm, layer),
                    orderByFields: ["Name ASC"]
                });
            }
            if (match) {
                return match;
            }
        }
        return null;
    }
    /** Creates parcel like source. */
    function createParcelLikeSource(sourceKey) {
        const definition = SOURCE_DEFINITIONS[sourceKey];
        return new SearchSourceClass({
            name: definition.label,
            placeholder: definition.placeholder,
            maxSuggestions: 10,
            maxResults: 10,
            getSuggestions: async (params) => {
                if (isSuggestionSuppressed())
                    return [];
                const page = getCurrentPageSafe();
                if (!shouldUseSourceForTerm(page, sourceKey, params.suggestTerm || ""))
                    return [];
                const layer = getSearchContextForPage(page).layers[sourceKey];
                if (!layer) {
                    return [];
                }
                await layer.load?.();
                const term = escapeSql((params.suggestTerm || "").trim());
                const latestToken = escapeSql(getLatestSearchToken(term));
                if (latestToken.length < 2)
                    return [];
                const fieldName = getSearchFieldFromTerm(latestToken);
                const res = await layer.queryFeatures({
                    where: sourceKey === "condo"
                        ? withCondoSubtypeWhere(layer, buildCondoParcelLikePrefixWhere(latestToken))
                        : buildParcelLikePrefixWhere(fieldName, latestToken, layer),
                    outFields: getSearchSuggestionOutFields(layer, sourceKey),
                    returnGeometry: false,
                    orderByFields: layerHasField(layer, "Name") ? ["Name ASC"] : undefined,
                    num: sourceKey === "condo" ? 50 : 10
                });
                const objectIdField = layer.objectIdField || "OBJECTID";
                const suggestionFeatures = sourceKey === "condo"
                    ? sortCondoSuggestionFeatures(res.features).slice(0, 10)
                    : res.features;
                return suggestionFeatures.map((feature) => ({
                    key: feature.attributes[objectIdField] ?? feature.attributes.OBJECTID,
                    text: getParcelSuggestionDisplay(feature),
                    sourceIndex: params.sourceIndex
                }));
            },
            getResults: async (params) => {
                const page = getCurrentPageSafe();
                if (!shouldUseSourceForTerm(page, sourceKey, params?.searchTerm || params?.suggestResult?.text || ""))
                    return [];
                const layer = getSearchContextForPage(page).layers[sourceKey];
                if (!layer) {
                    return [];
                }
                await layer.load?.();
                const suggestOid = params?.suggestResult?.key;
                if (suggestOid != null) {
                    const objectIdField = layer.objectIdField || "OBJECTID";
                    const res = await layer.queryFeatures({
                        where: `${objectIdField} = ${suggestOid}`,
                        outFields: getSearchOutFields(layer),
                        returnGeometry: true
                    });
                    return res.features.map((feature) => {
                        try {
                            feature.layer = feature.layer || layer;
                        }
                        catch (e) {
                            logCaughtError("searchParcels.js: suppressed recoverable error", e);
                        }
                        return {
                            name: getParcelSuggestionDisplay(feature),
                            feature,
                            searchType: definition.searchType
                        };
                    });
                }
                const term = escapeSql(getLatestSearchToken(params?.searchTerm || ""));
                if (!term)
                    return [];
                const fieldName = getSearchFieldFromTerm(term);
                const res = await layer.queryFeatures({
                    where: sourceKey === "condo"
                        ? withCondoSubtypeWhere(layer, buildCondoParcelLikePrefixWhere(term))
                        : buildParcelLikeExactWhere(fieldName, term, layer),
                    outFields: getSearchOutFields(layer),
                    returnGeometry: true,
                    num: 1
                });
                return res.features.map((feature) => {
                    try {
                        feature.layer = feature.layer || layer;
                    }
                    catch (e) {
                        logCaughtError("searchParcels.js: suppressed recoverable error", e);
                    }
                    return {
                        name: getParcelSuggestionDisplay(feature),
                        feature,
                        searchType: definition.searchType
                    };
                });
            }
        });
    }
    /** Creates address source. */
    function createAddressSource() {
        const definition = SOURCE_DEFINITIONS.address;
        return new SearchSourceClass({
            name: definition.label,
            placeholder: definition.placeholder,
            maxSuggestions: 10,
            maxResults: 10,
            getSuggestions: async (params) => {
                if (isSuggestionSuppressed())
                    return [];
                const page = getCurrentPageSafe();
                if (!shouldUseSourceForTerm(page, "address", params.suggestTerm || ""))
                    return [];
                const layer = getSearchContextForPage(page).layers.address;
                if (!layer) {
                    return [];
                }
                const term = normalizeAddressSearchTerm(params.suggestTerm || "");
                if (term.length < 2)
                    return [];
                let ownerSuggestions = [];
                if (page === "parcel" && shouldUseSourceForTerm(page, "owner", params.suggestTerm || "")) {
                    const ownerTerm = getLatestSearchToken(params.suggestTerm || "");
                    const ownerGroups = await queryOwnerGroupsByName(ownerTerm, {
                        maxOwners: 5,
                        maxRows: 2000
                    });
                    for (const group of ownerGroups) {
                        ownerSuggestionGroups.set(getOwnerGroupCacheKey(group.ownerName), group);
                    }
                    ownerSuggestions = ownerGroups.map((group) => ({
                        key: `owner::${group.ownerName}`,
                        text: `Owner: ${group.ownerName} (${group.parids.length} propert${group.parids.length === 1 ? "y" : "ies"})`,
                        sourceIndex: params.sourceIndex
                    }));
                }
                const res = await layer.queryFeatures({
                    where: buildAddressWhere(params.suggestTerm || "", layer),
                    outFields: getSearchSuggestionOutFields(layer, "address"),
                    returnGeometry: false,
                    num: 10
                });
                const addressSuggestions = res.features.map((feature) => ({
                    key: feature.attributes.OBJECTID,
                    text: formatAddressDisplay(feature.attributes) || feature.attributes.FULLADDR,
                    sourceIndex: params.sourceIndex
                }));
                const mergedSuggestions = [...ownerSuggestions, ...addressSuggestions].slice(0, 10);
                return mergedSuggestions;
            },
            getResults: async (params) => {
                const page = getCurrentPageSafe();
                if (!shouldUseSourceForTerm(page, "address", params?.searchTerm || params?.suggestResult?.text || ""))
                    return [];
                const layer = getSearchContextForPage(page).layers.address;
                if (!layer) {
                    return [];
                }
                const suggestionKey = params?.suggestResult?.key;
                if (typeof suggestionKey === "string" && suggestionKey.startsWith("owner::")) {
                    const ownerName = suggestionKey.slice("owner::".length);
                    const cachedGroup = ownerSuggestionGroups.get(getOwnerGroupCacheKey(ownerName));
                    let ownerGroup = cachedGroup || null;
                    if (!ownerGroup) {
                        const ownerGroups = await queryOwnerGroupsByName(ownerName, {
                            maxOwners: 10,
                            maxRows: 2000
                        });
                        const ownerKey = getOwnerGroupCacheKey(ownerName);
                        ownerGroup =
                            ownerGroups.find((group) => getOwnerGroupCacheKey(group.ownerName) === ownerKey) ||
                                ownerGroups[0] ||
                                null;
                    }
                    const ownerResult = ownerGroup ? await buildOwnerGroupSearchResult(ownerGroup) : null;
                    return ownerResult ? [ownerResult] : [];
                }
                const oid = suggestionKey;
                if (oid == null) {
                    const term = normalizeAddressSearchTerm(params?.searchTerm || "");
                    if (!term)
                        return [];
                    const res = await layer.queryFeatures({
                        where: buildAddressWhere(params?.searchTerm || "", layer),
                        outFields: getSearchOutFields(layer),
                        returnGeometry: true,
                        orderByFields: ["FULLADDR ASC"],
                        num: 1
                    });
                    return res.features.map((feature) => {
                        try {
                            feature.layer = feature.layer || layer;
                        }
                        catch (e) {
                            logCaughtError("searchParcels.js: suppressed recoverable error", e);
                        }
                        return {
                            name: formatAddressDisplay(feature.attributes) || feature.attributes.FULLADDR,
                            feature,
                            searchType: definition.searchType
                        };
                    });
                }
                const res = await layer.queryFeatures({
                    where: `OBJECTID = ${oid}`,
                    outFields: getSearchOutFields(layer),
                    returnGeometry: true
                });
                return res.features.map((feature) => {
                    try {
                        feature.layer = feature.layer || layer;
                    }
                    catch (e) {
                        logCaughtError("searchParcels.js: suppressed recoverable error", e);
                    }
                    return {
                        name: formatAddressDisplay(feature.attributes) || feature.attributes.FULLADDR,
                        feature,
                        searchType: definition.searchType
                    };
                });
            }
        });
    }
    /** Creates owner source. */
    function createOwnerSource() {
        const definition = SOURCE_DEFINITIONS.owner;
        return new SearchSourceClass({
            name: definition.label,
            placeholder: definition.placeholder,
            maxSuggestions: 10,
            maxResults: 10,
            getSuggestions: async (params) => {
                if (isSuggestionSuppressed())
                    return [];
                const page = getCurrentPageSafe();
                if (!shouldUseSourceForTerm(page, "owner", params.suggestTerm || ""))
                    return [];
                const ownerTable = getSearchContextForPage(page).layers.owner;
                if (page !== "parcel" && !ownerTable) {
                    return [];
                }
                const term = escapeSql(getLatestSearchToken(params.suggestTerm || ""));
                if (term.length < 2)
                    return [];
                const ownerGroups = await queryOwnerGroupsByName(getLatestSearchToken(params.suggestTerm || ""), {
                    maxOwners: 10,
                    maxRows: 2000
                });
                ownerSuggestionGroups.clear();
                for (const group of ownerGroups) {
                    ownerSuggestionGroups.set(getOwnerGroupCacheKey(group.ownerName), group);
                }
                return ownerGroups.map((group) => ({
                    key: group.ownerName,
                    text: `${group.ownerName} (${group.parids.length} propert${group.parids.length === 1 ? "y" : "ies"})`,
                    sourceIndex: params.sourceIndex
                }));
            },
            getResults: async (params) => {
                const page = getCurrentPageSafe();
                if (!shouldUseSourceForTerm(page, "owner", params?.searchTerm || params?.suggestResult?.text || params?.suggestResult?.key || ""))
                    return [];
                const ownerTable = getSearchContextForPage(page).layers.owner;
                if (page !== "parcel" && !ownerTable) {
                    return [];
                }
                const ownerName = params?.suggestResult?.key || getLatestSearchToken(params?.searchTerm || "");
                const cachedGroup = ownerSuggestionGroups.get(getOwnerGroupCacheKey(ownerName));
                let ownerGroup = cachedGroup || null;
                if (!ownerGroup) {
                    const ownerGroups = await queryOwnerGroupsByName(ownerName, {
                        maxOwners: 10,
                        maxRows: 2000
                    });
                    const ownerKey = getOwnerGroupCacheKey(ownerName);
                    ownerGroup =
                        ownerGroups.find((group) => getOwnerGroupCacheKey(group.ownerName) === ownerKey) ||
                            ownerGroups[0] ||
                            null;
                }
                const ownerResult = ownerGroup ? await buildOwnerGroupSearchResult(ownerGroup) : null;
                return ownerResult ? [ownerResult] : [];
            }
        });
    }
    const sourcesByKey = {
        parcel: createParcelLikeSource("parcel"),
        owner: createOwnerSource(),
        address: createAddressSource(),
        condo: createParcelLikeSource("condo")
    };
    /** Returns sources for page. */
    function getSourcesForPage(page = getCurrentPageSafe(), { includeUnavailable = true } = {}) {
        const context = getSearchContextForPage(page);
        const sourceKeys = includeUnavailable ? context.config.sourceKeys : context.availableSourceKeys;
        const sources = sourceKeys
            .map((sourceKey) => sourcesByKey[sourceKey])
            .filter(Boolean);
        return sources;
    }
    /** Escapes html. */
    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }
    /** Hides textarea suggestions. */
    function hideTextareaSuggestions() {
        currentSuggestionItems = [];
        if (searchSuggestionsEl) {
            searchSuggestionsEl.hidden = true;
            searchSuggestionsEl.innerHTML = "";
        }
    }
    /** Renders textarea suggestions. */
    function renderTextareaSuggestions(items) {
        if (!searchSuggestionsEl)
            return;
        currentSuggestionItems = items;
        if (!items.length) {
            hideTextareaSuggestions();
            return;
        }
        const groups = new Map();
        items.forEach((item, index) => {
            const groupName = item.sourceName || "Results";
            if (!groups.has(groupName))
                groups.set(groupName, []);
            groups.get(groupName).push({ ...item, index });
        });
        searchSuggestionsEl.innerHTML = [...groups.entries()].map(([groupName, groupItems]) => `
      <div class="header-search-suggestion-group">
        <div class="header-search-suggestion-heading">${escapeHtml(groupName)}</div>
        ${groupItems.map((item) => `
          <button class="header-search-suggestion-item" type="button" role="option" data-suggestion-index="${item.index}">
            ${escapeHtml(item.text)}
          </button>
        `).join("")}
      </div>
    `).join("");
        searchSuggestionsEl.hidden = false;
    }
    /** Selects textarea suggestion. */
    async function selectTextareaSuggestion(index) {
        const item = currentSuggestionItems[index];
        if (!item)
            return;
        setSearchDisplayValue(item.text);
        setSuggestionSuppressed(true);
        hideTextareaSuggestions();
        try {
            const results = await item.source.getResults({
                searchTerm: item.text,
                suggestResult: item.suggestion
            });
            const result = results?.[0];
            if (result?.feature) {
                await focusSearchResult(result);
                closeSuggestionsOnly();
            }
        }
        catch (error) {
        }
    }
    /** Updates textarea suggestions. */
    async function updateTextareaSuggestions() {
        if (!searchTextArea || !searchSuggestionsEl || isSuggestionSuppressed()) {
            hideTextareaSuggestions();
            return;
        }
        const requestId = ++suggestionRequestId;
        const term = getSearchDisplayValue();
        if (getLatestSearchToken(term).length < 2) {
            hideTextareaSuggestions();
            return;
        }
        const sources = getSourcesForPage(getCurrentPageSafe(), { includeUnavailable: false });
        const groups = await Promise.all(sources.map(async (source, sourceIndex) => {
            if (typeof source?.getSuggestions !== "function")
                return [];
            try {
                const suggestions = await source.getSuggestions({
                    suggestTerm: term,
                    sourceIndex
                });
                return (suggestions || []).map((suggestion) => ({
                    source,
                    sourceName: source.name || "Results",
                    suggestion,
                    text: suggestion?.text || suggestion?.name || ""
                })).filter((item) => item.text);
            }
            catch (error) {
                return [];
            }
        }));
        if (requestId !== suggestionRequestId)
            return;
        const populatedGroups = groups.filter((group) => group.length);
        const groupLimit = populatedGroups.length > 1
            ? TEXTAREA_SUGGESTIONS_MULTI_GROUP_LIMIT
            : TEXTAREA_SUGGESTIONS_SINGLE_GROUP_LIMIT;
        renderTextareaSuggestions(populatedGroups.flatMap((group) => group.slice(0, groupLimit)));
    }
    /** Schedules textarea suggestions. */
    function scheduleTextareaSuggestions() {
        if (!searchTextArea || !searchSuggestionsEl)
            return;
        clearTimeout(suggestionTimer);
        suggestionTimer = setTimeout(() => {
            void updateTextareaSuggestions();
        }, 160);
    }
    /** Synchronizes source selector visibility. */
    function syncSourceSelectorVisibility(page) {
        const hideSelector = page === "parcel";
        searchEl.dataset.hideSourceSelector = hideSelector ? "true" : "false";
        /** Applies visibility. */
        const applyVisibility = () => {
            try {
                const rootDropdown = searchEl.shadowRoot?.querySelector(".dropdown");
                const rootContainer = searchEl.shadowRoot?.querySelector(".container");
                const rootForm = searchEl.shadowRoot?.querySelector(".form");
                const autocomplete = searchEl.shadowRoot?.querySelector("calcite-autocomplete");
                const calciteInput = autocomplete?.shadowRoot?.querySelector("calcite-input");
                const actionMenu = calciteInput?.shadowRoot?.querySelector("calcite-action-menu");
                const actionWrapper = calciteInput?.shadowRoot?.querySelector(".action-wrapper");
                const clearButton = actionWrapper?.querySelector("button, calcite-button");
                const clearButtonShadowButton = clearButton?.shadowRoot?.querySelector?.("button");
                const clearButtonIcon = clearButton?.shadowRoot?.querySelector?.("calcite-icon");
                const inputElement = calciteInput?.shadowRoot?.querySelector("input");
                const wrapper = calciteInput?.shadowRoot?.querySelector(".wrapper, .container, .input-wrapper");
                const selectorButton = rootDropdown?.shadowRoot?.querySelector("calcite-button");
                const selectorNativeButton = selectorButton?.shadowRoot?.querySelector("button");
                const selectorIcon = selectorButton?.shadowRoot?.querySelector("calcite-icon");
                /** Handles style suggestion group labels. */
                const styleSuggestionGroupLabels = () => {
                    const labels = ["Owners", "Parcels", "Addresses", "Buildings"];
                    const autocompleteRoot = autocomplete?.shadowRoot || null;
                    if (autocompleteRoot && !autocompleteRoot.getElementById("jcgis-search-group-label-style")) {
                        const style = document.createElement("style");
                        style.id = "jcgis-search-group-label-style";
                        style.textContent = `
              calcite-autocomplete-item-group::part(label),
              calcite-autocomplete-item-group::part(heading),
              calcite-autocomplete-item-group::part(title) {
                color: ${SEARCH_COLORS.groupHeading};
                font-size: 18px;
                font-weight: 900;
                line-height: 1.25;
              }
            `;
                        autocompleteRoot.appendChild(style);
                    }
                    const itemGroups = Array.from(autocompleteRoot?.querySelectorAll("calcite-autocomplete-item-group") || []);
                    itemGroups.forEach((group) => {
                        group.style.setProperty("--calcite-color-text-1", SEARCH_COLORS.groupHeading);
                        group.style.setProperty("--calcite-color-text-2", SEARCH_COLORS.groupHeading);
                        group.style.setProperty("--calcite-font-size--1", "17px");
                        const root = group.shadowRoot;
                        if (!root)
                            return;
                        Array.from(root.querySelectorAll("*")).forEach((node) => {
                            const text = String(node.textContent || "").trim();
                            if (!labels.includes(text))
                                return;
                            node.style.color = SEARCH_COLORS.groupHeading;
                            node.style.fontSize = "18px";
                            node.style.fontWeight = "900";
                            node.style.lineHeight = "1.25";
                            node.style.paddingBlock = "8px";
                        });
                    });
                };
                searchEl.style.setProperty("--calcite-input-corner-radius", "0");
                searchEl.style.setProperty("--calcite-color-text-1", SEARCH_COLORS.text);
                searchEl.style.setProperty("--calcite-color-text-2", SEARCH_COLORS.text);
                searchEl.style.setProperty("--calcite-color-brand", SEARCH_COLORS.inverseText);
                searchEl.style.setProperty("--calcite-color-brand-hover", SEARCH_COLORS.inverseText);
                searchEl.style.setProperty("--calcite-color-foreground-1", SEARCH_COLORS.text);
                searchEl.style.setProperty("--calcite-color-foreground-2", SEARCH_COLORS.surface);
                searchEl.style.setProperty("--calcite-color-foreground-3", "#183863");
                searchEl.style.setProperty("--calcite-color-border-1", "transparent");
                searchEl.style.setProperty("--calcite-color-border-input", "transparent");
                searchEl.style.setProperty("--calcite-input-actions-background-color", "transparent");
                searchEl.style.setProperty("--calcite-input-actions-background-color-hover", "transparent");
                searchEl.style.setProperty("--calcite-input-actions-background-color-press", "transparent");
                searchEl.style.setProperty("--calcite-input-actions-icon-color", SEARCH_COLORS.text);
                searchEl.style.setProperty("--calcite-input-actions-icon-color-hover", SEARCH_COLORS.text);
                searchEl.style.setProperty("--calcite-input-actions-icon-color-press", SEARCH_COLORS.text);
                if (autocomplete) {
                    autocomplete.style.setProperty("--calcite-input-corner-radius", "0");
                    autocomplete.style.setProperty("--calcite-color-text-1", SEARCH_COLORS.inverseText);
                    autocomplete.style.setProperty("--calcite-color-text-2", SEARCH_COLORS.inverseText);
                    autocomplete.style.setProperty("--calcite-color-brand", SEARCH_COLORS.inverseText);
                    autocomplete.style.setProperty("--calcite-color-foreground-1", SEARCH_COLORS.text);
                    autocomplete.style.setProperty("--calcite-color-foreground-2", SEARCH_COLORS.surface);
                    autocomplete.style.setProperty("--calcite-color-foreground-3", "#183863");
                    autocomplete.style.setProperty("--calcite-color-border-1", "transparent");
                    autocomplete.style.setProperty("--calcite-color-border-input", "transparent");
                    autocomplete.style.setProperty("--calcite-input-actions-background-color", "transparent");
                    autocomplete.style.setProperty("--calcite-input-actions-background-color-hover", "transparent");
                    autocomplete.style.setProperty("--calcite-input-actions-background-color-press", "transparent");
                    Promise.resolve(autocomplete.componentOnReady?.())
                        .then(styleSuggestionGroupLabels)
                        .catch((error) => {
                        logCaughtError("searchParcels.js: autocomplete readiness failed", error);
                    });
                }
                if (calciteInput) {
                    calciteInput.style.setProperty("--calcite-input-corner-radius", "0");
                    calciteInput.style.setProperty("--calcite-color-foreground-1", SEARCH_COLORS.inverseText);
                    calciteInput.style.setProperty("--calcite-color-foreground-2", SEARCH_COLORS.inverseText);
                    calciteInput.style.setProperty("--calcite-color-foreground-3", SEARCH_COLORS.inverseText);
                    calciteInput.style.setProperty("--calcite-color-border-1", "transparent");
                    calciteInput.style.setProperty("--calcite-color-border-input", "transparent");
                    calciteInput.style.setProperty("--calcite-input-text-color", SEARCH_COLORS.text);
                    calciteInput.style.setProperty("--calcite-input-placeholder-text-color", SEARCH_COLORS.text);
                    calciteInput.style.setProperty("--calcite-input-icon-color", SEARCH_COLORS.text);
                    calciteInput.style.setProperty("--calcite-input-actions-background-color", "transparent");
                    calciteInput.style.setProperty("--calcite-input-actions-background-color-hover", "transparent");
                    calciteInput.style.setProperty("--calcite-input-actions-background-color-press", "transparent");
                    calciteInput.style.setProperty("--calcite-input-actions-icon-color", SEARCH_COLORS.text);
                    calciteInput.style.setProperty("--calcite-input-actions-icon-color-hover", SEARCH_COLORS.text);
                    calciteInput.style.setProperty("--calcite-input-actions-icon-color-press", SEARCH_COLORS.text);
                    calciteInput.style.borderRadius = "0";
                    calciteInput.style.border = "0";
                    calciteInput.style.background = "transparent";
                    calciteInput.style.boxShadow = "none";
                }
                if (wrapper) {
                    wrapper.style.borderRadius = "0";
                    wrapper.style.position = "relative";
                    wrapper.style.overflow = "visible";
                    wrapper.style.border = "0";
                    wrapper.style.background = "transparent";
                    wrapper.style.boxSizing = "border-box";
                    wrapper.style.boxShadow = "none";
                    wrapper.style.outline = "none";
                }
                if (inputElement) {
                    currentInputElement = inputElement;
                    inputElement.style.color = inactiveSearchTextColor;
                    inputElement.style.caretColor = inactiveSearchTextColor;
                    inputElement.style.border = "0";
                    inputElement.style.outline = "none";
                    inputElement.style.boxShadow = "none";
                    inputElement.style.borderRadius = "0";
                    inputElement.style.background = "transparent";
                    syncSearchInputTextColor();
                    if (inputElement.dataset.focusColorWired !== "true") {
                        inputElement.dataset.focusColorWired = "true";
                        inputElement.addEventListener("focus", () => {
                            syncSearchInputTextColor();
                        });
                        inputElement.addEventListener("blur", () => {
                            syncSearchInputTextColor();
                        });
                        inputElement.addEventListener("input", () => {
                            if (pasteSearchPending) {
                                setSuggestionSuppressed(true);
                                return;
                            }
                            const currentValue = getSearchDisplayValue();
                            const shouldUnlock = shouldUnlockPreservedSearchDisplay(currentValue);
                            setSuggestionSuppressed(!shouldUnlock);
                            if (shouldUnlock) {
                                setSearchDisplayPreserved(false);
                            }
                            setResolvedSearchDisplayActive(false);
                        });
                    }
                }
                if (rootDropdown) {
                    rootDropdown.style.display = hideSelector ? "none" : "";
                    rootDropdown.style.marginInlineStart = "0";
                    rootDropdown.style.alignSelf = "center";
                }
                if (actionMenu) {
                    actionMenu.style.display = "";
                    actionMenu.style.position = "absolute";
                    actionMenu.style.right = hideSelector ? "10px" : "40px";
                    actionMenu.style.top = "50%";
                    actionMenu.style.transform = "translateY(-50%)";
                    actionMenu.style.zIndex = "4";
                }
                if (actionWrapper) {
                    actionWrapper.style.display = "flex";
                    actionWrapper.style.alignItems = "center";
                    actionWrapper.style.position = "absolute";
                    actionWrapper.style.right = hideSelector ? "10px" : "40px";
                    actionWrapper.style.top = "50%";
                    actionWrapper.style.transform = "translateY(-50%)";
                    actionWrapper.style.zIndex = "4";
                    actionWrapper.style.margin = "0";
                    actionWrapper.style.padding = "0";
                    actionWrapper.style.background = "transparent";
                    actionWrapper.style.border = "0";
                    actionWrapper.style.boxShadow = "none";
                    actionWrapper.style.borderRadius = "0";
                }
                if (clearButton) {
                    clearButton.style.background = "transparent";
                    clearButton.style.border = "0";
                    clearButton.style.boxShadow = "none";
                    clearButton.style.borderRadius = "0";
                    clearButton.style.padding = "0";
                    clearButton.style.margin = "0";
                }
                if (clearButtonShadowButton) {
                    clearButtonShadowButton.style.background = "transparent";
                    clearButtonShadowButton.style.border = "0";
                    clearButtonShadowButton.style.boxShadow = "none";
                    clearButtonShadowButton.style.borderRadius = "0";
                    clearButtonShadowButton.style.padding = "0";
                    clearButtonShadowButton.style.margin = "0";
                }
                if (clearButtonIcon) {
                    clearButtonIcon.style.color = SEARCH_COLORS.text;
                }
                if (rootContainer) {
                    rootContainer.style.position = "relative";
                    rootContainer.style.display = "block";
                    rootContainer.style.width = "100%";
                }
                if (rootForm) {
                    rootForm.style.width = "100%";
                    rootForm.style.display = "block";
                    rootForm.style.margin = "0";
                }
                if (!hideSelector && selectorButton) {
                    selectorButton.setAttribute("appearance", "transparent");
                    selectorButton.setAttribute("kind", "neutral");
                    selectorButton.style.setProperty("--calcite-button-shadow", "none");
                    selectorButton.style.setProperty("--calcite-button-border-color", "transparent");
                    selectorButton.style.setProperty("--calcite-button-background-color", "transparent");
                    selectorButton.style.setProperty("--calcite-button-background-color-hover", "transparent");
                    selectorButton.style.setProperty("--calcite-button-background-color-press", "transparent");
                    selectorButton.style.setProperty("--calcite-button-text-color", SEARCH_COLORS.text);
                    selectorButton.style.setProperty("--calcite-button-text-color-hover", SEARCH_COLORS.text);
                    selectorButton.style.setProperty("--calcite-button-text-color-press", SEARCH_COLORS.text);
                    selectorButton.style.padding = "0";
                    selectorButton.style.margin = "0";
                }
                if (!hideSelector && selectorNativeButton) {
                    selectorNativeButton.style.border = "0";
                    selectorNativeButton.style.background = "transparent";
                    selectorNativeButton.style.boxShadow = "none";
                    selectorNativeButton.style.padding = "0 8px";
                    selectorNativeButton.style.minWidth = "28px";
                }
                if (!hideSelector && selectorIcon) {
                    selectorIcon.icon = "chevron-down";
                    selectorIcon.scale = "s";
                    selectorIcon.style.color = SEARCH_COLORS.text;
                }
                if (!hideSelector && rootDropdown) {
                    rootDropdown.style.position = "absolute";
                    rootDropdown.style.right = "10px";
                    rootDropdown.style.top = "50%";
                    rootDropdown.style.transform = "translateY(-50%)";
                    rootDropdown.style.zIndex = "3";
                    rootDropdown.style.width = "auto";
                    rootDropdown.style.pointerEvents = "auto";
                }
                else if (rootDropdown) {
                    rootDropdown.style.position = "";
                    rootDropdown.style.right = "";
                    rootDropdown.style.top = "";
                    rootDropdown.style.transform = "";
                    rootDropdown.style.zIndex = "";
                    rootDropdown.style.width = "";
                }
                if (calciteInput) {
                    calciteInput.style.paddingRight = hideSelector ? "34px" : "64px";
                }
                if (hideSelector && (clearButton || clearButtonShadowButton)) {
                }
            }
            catch (error) {
            }
        };
        applyCurrentSearchVisibility = applyVisibility;
        /** Handles observe rendered search structure. */
        const observeRenderedSearchStructure = () => {
            applyVisibility();
            const shadowRoot = searchEl.shadowRoot;
            if (!shadowRoot || searchRenderObserver)
                return;
            // ArcGIS Search renders parts of its internal control tree asynchronously.
            // Re-apply styling when that tree actually changes instead of guessing with timers.
            searchRenderObserver = new MutationObserver(() => {
                applyCurrentSearchVisibility?.();
            });
            searchRenderObserver.observe(shadowRoot, { childList: true, subtree: true });
        };
        Promise.resolve(searchEl.componentOnReady?.())
            .then(observeRenderedSearchStructure)
            .catch((error) => {
            logCaughtError("searchParcels.js: search component readiness failed", error);
        });
    }
    /** Applies search config. */
    async function applySearchConfig(page, { includeUnavailable = true } = {}) {
        const context = getSearchContextForPage(page);
        const sources = getSourcesForPage(context.page, { includeUnavailable });
        await searchEl.componentOnReady?.();
        searchEl.sources = [];
        searchEl.activeSourceIndex = -1;
        searchEl.sources = sources;
        searchEl.allPlaceholder = context.config.placeholder;
        searchEl.locationDisabled = true;
        searchEl.suggestionsDisabled = false;
        searchEl.maxSuggestions = 10;
        if (searchTextArea) {
            searchTextArea.placeholder = context.config.placeholder;
            searchTextArea.setAttribute("aria-label", context.config.placeholder);
        }
        syncSourceSelectorVisibility(context.page);
        clearSearchUi();
        searchEl.style.visibility = "visible";
        searchShell?.setAttribute("data-ready", "true");
    }
    /** Updates parcel viewer search. */
    async function setParcelViewerSearch() {
        await applySearchConfig("parcel");
    }
    /** Updates pwsearch. */
    async function setPWSearch() {
        await applySearchConfig("pw", { includeUnavailable: true });
        waitForAvailableSources("pw")
            .then(async (context) => {
            if (context.availableSourceKeys.length) {
                await applySearchConfig("pw", { includeUnavailable: false });
            }
        })
            .catch((err) => {
        });
    }
    /** Updates sasearch. */
    async function setSASearch() {
        await applySearchConfig("sa");
    }
    /** Selects in samap. */
    async function selectInSAMap(feature) {
        const activeSAMapView = getSAMapViewSafe();
        if (!feature?.attributes || !activeSAMapView)
            return;
        const oid = feature.attributes.OBJECTID;
        if (oid == null)
            return;
        const layer = feature.layer || getSearchContextForPage("sa").layers.parcel;
        if (!layer)
            return;
        const layerView = await activeSAMapView.whenLayerView(layer);
        if (saHighlightHandle) {
            try {
                saHighlightHandle.remove();
            }
            catch (error) {
                logCaughtError("searchParcels.js: suppressed recoverable error", error);
            }
        }
        saHighlightHandle = layerView.highlight([oid]);
        if (featureTable) {
            await featureTable.componentOnReady?.();
            featureTable.definitionExpression = `OBJECTID = ${oid}`;
        }
    }
    /** Returns feature extent. */
    function getFeatureExtent(feature) {
        return feature?.geometry?.extent || feature?.geometry || null;
    }
    /** Returns combined feature target. */
    function getCombinedFeatureTarget(features) {
        const extents = (features || [])
            .map(getFeatureExtent)
            .filter(Boolean);
        if (!extents.length)
            return null;
        let combined = extents[0].clone?.() || extents[0];
        for (let i = 1; i < extents.length; i++) {
            if (typeof combined.union === "function") {
                combined = combined.union(extents[i]);
            }
        }
        return combined.expand?.(2) || combined;
    }
    /** Selects owner parcel features. */
    async function selectOwnerParcelFeatures(features) {
        if (typeof toggleParcelSelection !== "function")
            return;
        const selected = typeof getSelectedParcels === "function" ? getSelectedParcels() : [];
        const selectedKeys = new Set((selected || []).map((feature) => {
            const attrs = feature?.attributes || {};
            const layerTitle = feature?.layer?.title || "UnknownLayer";
            const oid = attrs[FIELDS.objectId] ?? attrs.ObjectID ?? attrs.oid ?? attrs.OID ?? "";
            const name = attrs[FIELDS.name] || attrs[FIELDS.pin] || attrs[FIELDS.parcelNumber] || "";
            return `${layerTitle}::${oid}::${name}`;
        }));
        for (const feature of features || []) {
            if (selectedKeys.size >= MAX_SELECTED_PARCELS)
                break;
            const attrs = feature?.attributes || {};
            const layerTitle = feature?.layer?.title || "UnknownLayer";
            const oid = attrs[FIELDS.objectId] ?? attrs.ObjectID ?? attrs.oid ?? attrs.OID ?? "";
            const name = attrs[FIELDS.name] || attrs[FIELDS.pin] || attrs[FIELDS.parcelNumber] || "";
            const key = `${layerTitle}::${oid}::${name}`;
            if (selectedKeys.has(key))
                continue;
            await toggleParcelSelection(feature);
            selectedKeys.add(key);
            if (selectedKeys.size >= MAX_SELECTED_PARCELS)
                break;
        }
    }
    /** Selects parcel from address feature. */
    async function selectParcelFromAddressFeature(addressFeature, { select = true } = {}) {
        if (!addressFeature?.attributes)
            return null;
        const addptKey = addressFeature.attributes.ADDPTKEY;
        if (addptKey == null)
            return null;
        const parcelLayer = getSearchContextForPage().layers.parcel;
        const normalizedKey = String(addptKey).trim();
        if (!parcelLayer || !normalizedKey)
            return null;
        const res = await parcelLayer.queryFeatures({
            where: `UPPER(${FIELDS.name}) = UPPER('${escapeSql(normalizedKey)}')`,
            outFields: getSearchOutFields(parcelLayer),
            returnGeometry: true,
            num: 1
        });
        const parcelFeature = res.features?.[0];
        if (!parcelFeature)
            return null;
        try {
            parcelFeature.layer = parcelFeature.layer || parcelLayer;
        }
        catch (e) {
            logCaughtError("searchParcels.js: suppressed recoverable error", e);
        }
        if (select) {
            const context = getSearchContextForPage();
            if (context.page === "parcel" && typeof switchTo2D === "function") {
                await switchTo2D();
            }
            const activeView = getActiveView?.();
            if (activeView) {
                await activeView.goTo({
                    target: parcelFeature.geometry?.extent ? parcelFeature.geometry.extent.expand(2) : parcelFeature.geometry,
                    zoom: activeView === pvMapView ? 19 : undefined,
                    scale: activeView === sceneView ? 2500 : undefined,
                    tilt: activeView === sceneView ? 70 : undefined
                });
            }
            if (typeof toggleParcelSelection === "function") {
                await toggleParcelSelection(parcelFeature);
            }
        }
        return parcelFeature;
    }
    /** Focuses search result. */
    async function focusSearchResult(result) {
        if (!result?.feature)
            return false;
        const feature = result.feature;
        const searchType = result.searchType;
        const context = getSearchContextForPage();
        const searchText = String(getSearchDisplayValue() || result?.name || "").trim();
        setSearchDisplayValue(result?.name || "");
        setSuggestionSuppressed(true);
        setResolvedSearchDisplayActive(true);
        if (context.page === "sa") {
            const activeSAMapView = getSAMapViewSafe();
            if (activeSAMapView) {
                await activeSAMapView.goTo({
                    target: feature.geometry?.extent ? feature.geometry.extent.expand(2) : feature.geometry
                });
            }
            await selectInSAMap(feature);
            closeSuggestionsOnly();
            return true;
        }
        if (context.page === "pw") {
            const activePWMapView = getPWMapViewSafe();
            if (!activePWMapView) {
                return false;
            }
            await activePWMapView.goTo({
                target: feature.geometry?.extent ? feature.geometry.extent.expand(2) : feature.geometry,
                zoom: searchType === "address" ? 19 : undefined
            });
            closeSuggestionsOnly();
            return true;
        }
        if (searchType === "condo") {
            showCondoSearchLoading();
            if (typeof selectBuildingFloorParcel === "function") {
                try {
                    const selectedCondo = await selectBuildingFloorParcel(feature);
                    if (selectedCondo === false) {
                        logCaughtError("searchParcels.js: condo search result could not be selected", feature?.attributes);
                        return false;
                    }
                }
                finally {
                    hideSearchNotice();
                }
            }
            else {
                try {
                    if (typeof switchTo3D === "function") {
                        await switchTo3D();
                    }
                    if (sceneView) {
                        await sceneView.goTo({
                            target: feature.geometry?.extent ? feature.geometry.extent.expand(2) : feature.geometry,
                            tilt: 75
                        });
                    }
                }
                finally {
                    hideSearchNotice();
                }
            }
            syncSelectedParcelSearchDisplay();
            closeSuggestionsOnly();
            return true;
        }
        if (searchType === "owner" && Array.isArray(result.features) && result.features.length > 1) {
            if (typeof switchTo2D === "function") {
                await switchTo2D();
            }
            const target = getCombinedFeatureTarget(result.features);
            if (pvMapView && target) {
                await pvMapView.goTo({ target });
            }
            if ((result.propertyCount || result.features.length) > MAX_SELECTED_PARCELS) {
                window.alert?.(`${result.ownerName || "That owner"} has ${result.propertyCount} properties. The first ${MAX_SELECTED_PARCELS} were selected because the selection limit is ${MAX_SELECTED_PARCELS}.`);
            }
            await selectOwnerParcelFeatures(result.features);
            if (typeof addOwnerParcelLocationPoints === "function") {
                addOwnerParcelLocationPoints(result.features);
            }
            preserveResolvedSearchDisplay(result?.name || "");
            closeSuggestionsOnly();
            return true;
        }
        if (searchType === "parcel" || searchType === "owner") {
            if (searchType === "parcel" &&
                typeof selectBuildingFloorParcel === "function" &&
                isLikelyCondoBuildingParcelTerm(searchText, feature)) {
                showCondoSearchLoading();
                let selectedCondo = false;
                try {
                    selectedCondo = await selectBuildingFloorParcel(feature);
                }
                finally {
                    hideSearchNotice();
                }
                if (selectedCondo) {
                    syncSelectedParcelSearchDisplay();
                    closeSuggestionsOnly();
                    return true;
                }
            }
            if (typeof switchTo2D === "function") {
                await switchTo2D();
            }
            if (pvMapView) {
                await pvMapView.goTo({
                    target: feature.geometry?.extent ? feature.geometry.extent.expand(2) : feature.geometry
                });
            }
            if (typeof toggleParcelSelection === "function") {
                await toggleParcelSelection(feature);
            }
            if (searchType !== "owner" && typeof clearOwnerParcelLocationPoints === "function") {
                clearOwnerParcelLocationPoints();
            }
            if (searchType === "owner") {
                preserveResolvedSearchDisplay(result?.name || "");
            }
            else {
                syncSelectedParcelSearchDisplay();
            }
            closeSuggestionsOnly();
            return true;
        }
        if (searchType === "address") {
            const parcelFeature = await selectParcelFromAddressFeature(feature, { select: false });
            if (parcelFeature) {
                if (typeof selectBuildingFloorParcel === "function") {
                    showCondoSearchLoading();
                    let selectedCondo = false;
                    try {
                        selectedCondo = await selectBuildingFloorParcel(parcelFeature);
                    }
                    finally {
                        hideSearchNotice();
                    }
                    if (selectedCondo) {
                        syncSelectedParcelSearchDisplay();
                        closeSuggestionsOnly();
                        return true;
                    }
                }
                await selectParcelFromAddressFeature(feature);
                preserveResolvedSearchDisplay(result?.name || "");
                closeSuggestionsOnly();
                return true;
            }
            preserveResolvedSearchDisplay(result?.name || "");
            if (!parcelFeature) {
                const activeView = getActiveView?.();
                if (activeView) {
                    await activeView.goTo({
                        target: feature.geometry,
                        zoom: activeView === pvMapView ? 19 : undefined,
                        scale: activeView === sceneView ? 2500 : undefined,
                        tilt: activeView === sceneView ? 70 : undefined
                    });
                }
            }
            closeSuggestionsOnly();
            return true;
        }
        return false;
    }
    searchEl.addEventListener("arcgisSearchComplete", async (evt) => {
        const allResults = evt.detail?.results || [];
        const firstGroup = allResults.find((group) => group?.results?.length);
        const result = firstGroup?.results?.[0];
        if (!result?.feature)
            return;
        await focusSearchResult(result);
        closeSuggestionsOnly();
    });
    searchEl.addEventListener("arcgisSuggestComplete", () => {
        // A completed suggestion render is the real signal that can reopen the menu.
        // Re-apply internal styling after that render, and close only when suppression is active.
        applyCurrentSearchVisibility?.();
        if (!isSuggestionSuppressed())
            return;
        closeSuggestionsOnly();
    });
    /** Handles try select first from input. */
    async function trySelectFirstFromInput({ reportPasteResult = false } = {}) {
        const raw = getSearchDisplayValue();
        if (!raw)
            return false;
        const tokens = getSearchEntryTokens(raw);
        if (tokens.length === 0)
            return false;
        const pasteDetails = getParcelBatchParseDetails(raw);
        const isExactParcelPaste = tokens.length > 0 && tokens.every((token) => {
            const value = String(token || "").trim();
            return /^\d{17}$/.test(value) || /^\d{2}-\d{3}-\d{2}-\d{2}-\d{2}-\d-\d{2}-\d{3}$/.test(value);
        });
        if (isExactParcelPaste && tokens.length > 1 && typeof selectMultipleParcelsFromSearch === "function") {
            await selectMultipleParcelsFromSearch(raw);
            closeSuggestionsOnly();
            return true;
        }
        if (tokens.length === 1) {
            const match = await findFirstMatch(tokens[0]);
            if (match?.feature) {
                await focusSearchResult(match);
                if (reportPasteResult && isExactParcelPaste) {
                    const duplicateNote = pasteDetails.duplicateCount
                        ? ` ${pasteDetails.duplicateCount} duplicate${pasteDetails.duplicateCount === 1 ? " was" : "s were"} removed.`
                        : "";
                    notifyUser(`1 of 1 unique parcel numbers matched.${duplicateNote}`, {
                        title: "Parcel paste",
                        kind: "success"
                    });
                }
                closeSuggestionsOnly();
                return true;
            }
            if (reportPasteResult && isExactParcelPaste) {
                showSearchNotice(getParcelPasteNoMatchMessage(1));
            }
            return false;
        }
        if (isExactParcelPaste) {
            const attemptedTokens = tokens.slice(0, MAX_SELECTED_PARCELS);
            const condoFeatures = await findCondoFeaturesByParids(attemptedTokens, { limit: MAX_SELECTED_PARCELS });
            if (condoFeatures.length && typeof selectBuildingFloorParcel === "function") {
                showCondoSearchLoading();
                try {
                    for (const [index, condoFeature] of condoFeatures.entries()) {
                        await selectBuildingFloorParcel(condoFeature, {
                            clearExistingSelections: index === 0
                        });
                    }
                }
                finally {
                    hideSearchNotice();
                }
                syncSelectedParcelSearchDisplay();
                closeSuggestionsOnly();
                if (reportPasteResult) {
                    const failedCount = Math.max(0, attemptedTokens.length - condoFeatures.length);
                    const notes = [];
                    if (failedCount)
                        notes.push(`${failedCount} not found`);
                    if (pasteDetails.duplicateCount)
                        notes.push(`${pasteDetails.duplicateCount} duplicate${pasteDetails.duplicateCount === 1 ? "" : "s"} removed`);
                    if (tokens.length > MAX_SELECTED_PARCELS)
                        notes.push(`only the first ${MAX_SELECTED_PARCELS} unique parcels were processed`);
                    notifyUser(`${condoFeatures.length} of ${attemptedTokens.length} condo parcel numbers matched${notes.length ? `. ${notes.join("; ")}.` : "."}`, {
                        title: "Parcel paste",
                        kind: failedCount ? "warning" : "success"
                    });
                }
                return true;
            }
            const parcelFeatures = await findParcelFeaturesByParids(attemptedTokens, { limit: MAX_SELECTED_PARCELS });
            if (!parcelFeatures.length) {
                if (reportPasteResult) {
                    showSearchNotice(getParcelPasteNoMatchMessage(attemptedTokens.length));
                }
                return false;
            }
            if (typeof switchTo2D === "function") {
                await switchTo2D();
            }
            await selectOwnerParcelFeatures(parcelFeatures);
            const target = getCombinedFeatureTarget(parcelFeatures);
            if (pvMapView && target) {
                await pvMapView.goTo({ target });
            }
            if (typeof addOwnerParcelLocationPoints === "function") {
                addOwnerParcelLocationPoints(parcelFeatures);
            }
            syncSelectedParcelSearchDisplay();
            if (reportPasteResult) {
                const matchedParids = new Set(parcelFeatures.map((feature) => {
                    const attrs = feature?.attributes || {};
                    return String(attrs[FIELDS.parid] ?? attrs[FIELDS.paridLower] ?? attrs[FIELDS.parcelId] ?? attrs[FIELDS.parcelIdUpper] ?? attrs[FIELDS.name] ?? "").replace(/\D/g, "");
                }).filter(Boolean));
                const matchedCount = attemptedTokens.filter((token) => matchedParids.has(String(token || "").replace(/\D/g, ""))).length || parcelFeatures.length;
                const failedCount = Math.max(0, attemptedTokens.length - matchedCount);
                const notes = [];
                if (failedCount)
                    notes.push(`${failedCount} not found`);
                if (pasteDetails.duplicateCount)
                    notes.push(`${pasteDetails.duplicateCount} duplicate${pasteDetails.duplicateCount === 1 ? "" : "s"} removed`);
                if (tokens.length > MAX_SELECTED_PARCELS)
                    notes.push(`only the first ${MAX_SELECTED_PARCELS} unique parcels were processed`);
                notifyUser(`${matchedCount} of ${attemptedTokens.length} unique parcel numbers matched${notes.length ? `. ${notes.join("; ")}.` : "."}`, {
                    title: "Parcel paste",
                    kind: failedCount ? "warning" : "success"
                });
            }
            closeSuggestionsOnly();
            return true;
        }
        // multiple tokens -> try to find matches for each and select them
        const selectedMatches = [];
        const attemptedTokens = tokens.slice(0, MAX_SELECTED_PARCELS);
        for (const token of attemptedTokens) {
            try {
                const m = await findFirstMatch(token);
                if (m?.feature)
                    selectedMatches.push(m);
            }
            catch (e) {
                /* ignore individual token failures */
            }
        }
        if (!selectedMatches.length) {
            if (reportPasteResult && isExactParcelPaste) {
                showSearchNotice(getParcelPasteNoMatchMessage(attemptedTokens.length));
            }
            return false;
        }
        const parcelMatches = selectedMatches.filter((m) => m.searchType === "parcel" && m.feature);
        const nonParcelMatches = selectedMatches.filter((m) => m.searchType !== "parcel" && m.feature);
        for (const m of parcelMatches) {
            try {
                if (typeof toggleParcelSelection === "function") {
                    await toggleParcelSelection(m.feature);
                }
            }
            catch (e) {
                /* ignore */
            }
        }
        if (parcelMatches.length) {
            if (typeof switchTo2D === "function") {
                await switchTo2D();
            }
            const parcelFeatures = parcelMatches.map((m) => m.feature);
            const target = getCombinedFeatureTarget(parcelFeatures);
            if (pvMapView && target) {
                await pvMapView.goTo({ target });
            }
            if (typeof addOwnerParcelLocationPoints === "function") {
                addOwnerParcelLocationPoints(parcelFeatures);
            }
            syncSelectedParcelSearchDisplay();
        }
        for (const m of nonParcelMatches) {
            try {
                await focusSearchResult(m);
            }
            catch (e) {
                logCaughtError("searchParcels.js: non-parcel pasted search result could not be focused", e);
            }
        }
        if (reportPasteResult && isExactParcelPaste) {
            const matchedCount = selectedMatches.length;
            const failedCount = Math.max(0, attemptedTokens.length - matchedCount);
            const notes = [];
            if (failedCount)
                notes.push(`${failedCount} not found`);
            if (pasteDetails.duplicateCount)
                notes.push(`${pasteDetails.duplicateCount} duplicate${pasteDetails.duplicateCount === 1 ? "" : "s"} removed`);
            if (tokens.length > MAX_SELECTED_PARCELS)
                notes.push(`only the first ${MAX_SELECTED_PARCELS} unique parcels were processed`);
            notifyUser(`${matchedCount} of ${attemptedTokens.length} unique parcel numbers matched${notes.length ? `. ${notes.join("; ")}.` : "."}`, {
                title: "Parcel paste",
                kind: failedCount ? "warning" : "success"
            });
        }
        closeSuggestionsOnly();
        return true;
    }
    /** Handles process pasted search value. */
    async function processPastedSearchValue() {
        pasteSearchProcessing = true;
        searchEl.value = getSearchDisplayValue();
        searchEl.searchTerm = getSearchDisplayValue();
        let handled = false;
        try {
            handled = await trySelectFirstFromInput({ reportPasteResult: true });
        }
        catch (error) {
            logCaughtError("Pasted parcel search failed", error);
            notifyUser("The parcel list could not be searched. Please try again.", { title: "Parcel search", kind: "warning" });
        }
        finally {
            pasteSearchProcessing = false;
            if (!handled) {
                setSuggestionSuppressed(false);
                setSearchDisplayPreserved(false);
                scheduleTextareaSuggestions();
            }
        }
    }
    /** Handles search input. */
    function handleSearchInput() {
        hideSearchNotice();
        const currentValue = getSearchDisplayValue();
        searchEl.value = currentValue;
        searchEl.searchTerm = currentValue;
        if (pasteSearchPending) {
            // The input event is the browser's signal that the pasted value is now committed.
            pasteSearchPending = false;
            setSuggestionSuppressed(true);
            hideTextareaSuggestions();
            void processPastedSearchValue();
            return;
        }
        if (pasteSearchProcessing) {
            setSuggestionSuppressed(true);
            hideTextareaSuggestions();
            return;
        }
        const shouldUnlock = shouldUnlockPreservedSearchDisplay(currentValue);
        setSuggestionSuppressed(!shouldUnlock);
        if (shouldUnlock) {
            setSearchDisplayPreserved(false);
        }
        setResolvedSearchDisplayActive(false);
        scheduleTextareaSuggestions();
    }
    /** Handles search paste. */
    function handleSearchPaste() {
        // Do not guess when the browser has applied clipboard data. The ensuing input
        // event is the actual completion signal and processPastedSearchValue handles it.
        pasteSearchPending = true;
        setSuggestionSuppressed(true);
    }
    /** Handles search keydown. */
    async function handleSearchKeydown(evt) {
        if (String(evt.key || "").length === 1 || evt.key === "Backspace" || evt.key === "Delete") {
            hideSearchNotice();
        }
        const key = String(evt.key || "");
        const userTypingKey = key.length === 1 ||
            key === "Backspace" ||
            key === "Delete";
        if (userTypingKey) {
            const hasPreservedDisplay = searchEl.dataset.preserveSearchDisplay === "true";
            const delimiterKey = key === "," || key === ";";
            if (!hasPreservedDisplay || delimiterKey || key === "Backspace" || key === "Delete") {
                setSuggestionSuppressed(false);
                setSearchDisplayPreserved(false);
            }
            else {
                setSuggestionSuppressed(true);
            }
        }
        if (evt.key === "Enter") {
            if (evt.shiftKey && evt.currentTarget === searchTextArea) {
                return;
            }
            evt.preventDefault();
            hideTextareaSuggestions();
            searchEl.value = getSearchDisplayValue();
            searchEl.searchTerm = getSearchDisplayValue();
            const handled = await trySelectFirstFromInput();
            if (!handled) {
                try {
                    // fallback to the component's own search if available
                    searchEl.search?.();
                }
                catch (e) {
                    logCaughtError("searchParcels.js: suppressed recoverable error", e);
                }
            }
            setSuggestionSuppressed(true);
            closeSuggestionsOnly();
        }
    }
    searchEl.addEventListener("paste", handleSearchPaste);
    searchEl.addEventListener("keydown", handleSearchKeydown);
    if (searchTextArea) {
        searchTextArea.addEventListener("calciteTextAreaInput", handleSearchInput);
        searchTextArea.addEventListener("input", handleSearchInput);
        searchTextArea.addEventListener("paste", handleSearchPaste);
        searchTextArea.addEventListener("keydown", handleSearchKeydown);
        searchTextArea.addEventListener("focus", scheduleTextareaSuggestions);
    }
    if (searchSuggestionsEl) {
        searchSuggestionsEl.addEventListener("mousedown", (event) => {
            event.preventDefault();
        });
        searchSuggestionsEl.addEventListener("click", (event) => {
            const button = event.target instanceof Element
                ? event.target.closest(".header-search-suggestion-item")
                : null;
            const index = Number(button?.dataset?.suggestionIndex);
            if (Number.isInteger(index)) {
                void selectTextareaSuggestion(index);
            }
        });
    }
    document.addEventListener("click", (event) => {
        if (!searchTextArea || !searchSuggestionsEl || searchSuggestionsEl.hidden)
            return;
        const target = event.target;
        if (searchTextArea.contains?.(target) || searchSuggestionsEl.contains(target))
            return;
        hideTextareaSuggestions();
    });
    return {
        setParcelViewerSearch,
        setPWSearch,
        setSASearch,
        findFirstMatch,
        focusSearchResult,
        getSearchContextForPage
    };
}
