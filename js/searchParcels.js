const PAGE_ALIASES = Object.freeze({
  parcel: "parcel",
  pv: "parcel",
  pw: "pw",
  sa: "sa",
  pa: "sa"
});

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

const PARCEL_INFORMATION_QUERY_URL =
  "https://services3.arcgis.com/4LOAHoFXfea6Y3Et/ArcGIS/rest/services/Parcel_Information/FeatureServer/0/query";
const CONDO_INFORMATION_DEFINITION = "ParcelSubtype IN (2, 4)";

export async function createParcelSearchController({
  searchEl,

  // Parcel Viewer layers
  pvParcelLayer,
  pvOwnerTableLayer,
  pvCondoLayer,
  pvAddressLayer2d,
  pvAddressLayer3d,

  // Public Works layers
  pwParcelLayer,
  pwCondoLayer,
  pwAddressLayer,

  // Property Analysis layers
  saParcelLayer,
  saCondoLayer,
  saAddressLayer,

  // Views
  pvMapView,
  sceneView,
  pwMapView,
  saMapView,

  featureTable,
  SearchSourceClass,

  // PV-only behaviors
  switchTo2D,
  switchTo3D,
  toggleParcelSelection,
  selectBuildingFloorParcel,
  syncSearchBarWithSelectedParcels,
  addOwnerParcelLocationPoints,
  clearOwnerParcelLocationPoints,

  // State getters
  getActiveView,
  getCurrentPage,
  getSelectedParcels,
  getPVOwnerTableLayer,
  getPWMapView,
  getPWParcelLayer,
  getPWCondoLayer,
  getPWAddressLayer,
  getSAMapView,
  getSAParcelLayer,
  getSACondoLayer,
  getSAAddressLayer
}) {
  if (!searchEl || !SearchSourceClass) return null;

  let saHighlightHandle = null;
  const searchShell = searchEl.closest(".header-search-shell");
  const inactiveSearchTextColor = "#0a1e3a";
  const activeSearchTextColor = "#0a1e3a";
  let resolvedSearchDisplayActive = false;
  let currentInputElement = null;
  let pasteSearchPending = false;
  const ownerSuggestionGroups = new Map();

  function logDebug() {}

  function normalizePageKey(page) {
    const normalized = String(page || "parcel").trim().toLowerCase();
    return PAGE_ALIASES[normalized] || "parcel";
  }

  function clearSearchUi() {
    searchEl.value = "";
    searchEl.searchTerm = "";
    searchEl.dataset.suppressSuggestions = "false";
    searchEl.dataset.preserveSearchDisplay = "false";
    searchEl.dataset.preservedSearchDisplayValue = "";
    setResolvedSearchDisplayActive(false);
    searchEl.close?.();
    searchEl.blur?.();
  }

  function setSuggestionSuppressed(isSuppressed) {
    searchEl.dataset.suppressSuggestions = isSuppressed ? "true" : "false";
  }

  function isSuggestionSuppressed() {
    return searchEl.dataset.suppressSuggestions === "true";
  }

  function closeSuggestionsOnly() {
    try {
      searchEl.close?.();
      // Some ArcGIS search renders reopen on the same frame; close again next frame.
      requestAnimationFrame(() => searchEl.close?.());
      setTimeout(() => searchEl.close?.(), 0);
      setTimeout(() => searchEl.close?.(), 90);
      setTimeout(() => searchEl.close?.(), 180);
    } catch (e) {}
  }

  function setSearchDisplayValue(value) {
    const nextValue = String(value || "").trim();
    searchEl.value = nextValue;
    searchEl.searchTerm = nextValue;
  }

  function setSearchDisplayPreserved(isPreserved) {
    searchEl.dataset.preserveSearchDisplay = isPreserved ? "true" : "false";
  }

  function getPreservedSearchDisplayValue() {
    return String(searchEl.dataset.preservedSearchDisplayValue || "").trim();
  }

  function shouldUnlockPreservedSearchDisplay(value) {
    if (searchEl.dataset.preserveSearchDisplay !== "true") return true;

    const currentValue = String(value || "").trim();
    const preservedValue = getPreservedSearchDisplayValue();
    if (!preservedValue) return true;
    if (currentValue === preservedValue) return false;
    if (currentValue.startsWith(preservedValue)) {
      return /^[\s]*[,;\n]/.test(currentValue.slice(preservedValue.length));
    }

    return true;
  }

  function syncSelectedParcelSearchDisplay() {
    if (typeof syncSearchBarWithSelectedParcels !== "function") return;

    setSearchDisplayPreserved(false);
    syncSearchBarWithSelectedParcels();
    requestAnimationFrame(() => syncSearchBarWithSelectedParcels());
    setTimeout(() => syncSearchBarWithSelectedParcels(), 0);
    setTimeout(() => syncSearchBarWithSelectedParcels(), 120);
  }

  function preserveResolvedSearchDisplay(value) {
    setSearchDisplayPreserved(true);
    setSearchDisplayValue(value);
    searchEl.dataset.preservedSearchDisplayValue = String(value || "").trim();
    setSuggestionSuppressed(true);
    requestAnimationFrame(() => setSearchDisplayValue(value));
    setTimeout(() => setSearchDisplayValue(value), 0);
    setTimeout(() => setSearchDisplayValue(value), 120);
  }

  function syncSearchInputTextColor() {
    if (!currentInputElement) return;

    const nextColor = resolvedSearchDisplayActive
      ? activeSearchTextColor
      : inactiveSearchTextColor;

    currentInputElement.style.color = nextColor;
    currentInputElement.style.caretColor = nextColor;
  }

  function setResolvedSearchDisplayActive(isActive) {
    resolvedSearchDisplayActive = !!isActive;
    syncSearchInputTextColor();
  }

  function getLatestSearchToken(value) {
    const parts = String(value || "")
      .split(/[\n,;]/)
      .map((part) => part.trim())
      .filter(Boolean);

    return parts[parts.length - 1] || "";
  }

  function getRoutingSearchToken(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";

    const preservedValue = getPreservedSearchDisplayValue();
    if (preservedValue && raw.startsWith(preservedValue)) {
      const suffix = raw.slice(preservedValue.length);
      if (/^[\s]*[,;\n]/.test(suffix)) {
        return getLatestSearchToken(suffix.replace(/^[\s]*[,;\n]+/, ""));
      }
    }

    const parts = raw
      .split(/[\n,;]/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length <= 1) return raw;

    const allParcelLike = parts.every((part) => {
      const digits = part.replace(/\D/g, "");
      return /^\d{17}$/.test(part) || (/^\d[\d-]*$/.test(part) && digits.length <= 17);
    });

    return allParcelLike ? parts[parts.length - 1] : raw;
  }

  function isFullAddressLikeTerm(value) {
    const raw = normalizeAddressWhitespace(value);
    return /^\d+\s+\S+/.test(raw) && /,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?$/i.test(raw);
  }

  function getSearchEntryTokens(value) {
    const raw = String(value || "").trim();
    if (!raw) return [];

    const preservedValue = getPreservedSearchDisplayValue();
    if (preservedValue && raw.startsWith(preservedValue)) {
      const suffix = raw.slice(preservedValue.length);
      if (/^[\s]*[,;\n]/.test(suffix)) {
        return suffix
          .replace(/^[\s]*[,;\n]+/, "")
          .split(/[\n,;]+/)
          .map((token) => token.trim())
          .filter(Boolean);
      }
    }

    if (isFullAddressLikeTerm(raw)) return [raw];

    const commaParts = raw.split(/[\n,;]+/).map((token) => token.trim()).filter(Boolean);
    const allParcelLike = commaParts.length > 1 && commaParts.every((part) => {
      const digits = part.replace(/\D/g, "");
      return /^\d{17}$/.test(part) || (/^\d[\d-]*$/.test(part) && digits.length <= 17);
    });

    if (allParcelLike) return commaParts;

    return raw
      .split(/[\n;]+/)
      .map((token) => token.trim())
      .filter(Boolean);
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

  function normalizeAddressWhitespace(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .replace(/\s+,/g, ",")
      .trim();
  }

  function parseAddressSearchTerm(value) {
    let raw = normalizeAddressWhitespace(value);
    const parsed = {
      raw,
      street: raw,
      city: "",
      state: "",
      zip: ""
    };

    if (!raw) return parsed;

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
    } else if (raw.includes(",")) {
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

  function normalizeAddressSearchTerm(value) {
    return parseAddressSearchTerm(value).street;
  }

  function getLayerFieldName(layer, candidates) {
    const fieldNames = (layer?.fields || []).map((field) => field.name).filter(Boolean);
    const fieldNamesUpper = new Map(fieldNames.map((name) => [name.toUpperCase(), name]));
    return candidates.map((candidate) => fieldNamesUpper.get(candidate.toUpperCase())).find(Boolean) || "";
  }

  function getAddressLayerFieldNames(layer) {
    return {
      city: getLayerFieldName(layer, ADDRESS_FIELD_CANDIDATES.city),
      state: getLayerFieldName(layer, ADDRESS_FIELD_CANDIDATES.state),
      zip: getLayerFieldName(layer, ADDRESS_FIELD_CANDIDATES.zip)
    };
  }

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
    if (!uniqueCandidates.length) return "1=0";

    const streetWhere = uniqueCandidates
      .map((candidate) => {
        const escapedCandidate = escapeSql(candidate);
        const tokenPattern = escapeSql(candidate.split(/\s+/).join("%"));
        return `(UPPER(FULLADDR) LIKE UPPER('%${escapedCandidate}%') OR UPPER(FULLADDR) LIKE UPPER('%${tokenPattern}%'))`;
      })
      .join(" OR ");

    const componentWhere = [];
    if (parsed.city && fields.city) componentWhere.push(`UPPER(${fields.city}) = UPPER('${escapeSql(parsed.city)}')`);
    if (parsed.state && fields.state) componentWhere.push(`UPPER(${fields.state}) = UPPER('${escapeSql(parsed.state)}')`);
    if (parsed.zip && fields.zip) componentWhere.push(`${fields.zip} LIKE '${escapeSql(parsed.zip)}%'`);

    if (!componentWhere.length) return streetWhere;

    return `((${streetWhere}) AND ${componentWhere.join(" AND ")}) OR (${streetWhere})`;
  }

  function getAddressAttrValue(attrs, candidates) {
    if (!attrs) return "";
    for (const candidate of candidates) {
      const exact = attrs[candidate];
      if (exact != null && exact !== "") return String(exact);
      const matchedKey = Object.keys(attrs).find((key) => key.toUpperCase() === candidate.toUpperCase());
      const matchedValue = matchedKey ? attrs[matchedKey] : "";
      if (matchedValue != null && matchedValue !== "") return String(matchedValue);
    }
    return "";
  }

  function formatAddressDisplay(attrs = {}) {
    const street = String(attrs.FULLADDR || "").trim();
    const city = getAddressAttrValue(attrs, ADDRESS_FIELD_CANDIDATES.city).trim();
    const state = getAddressAttrValue(attrs, ADDRESS_FIELD_CANDIDATES.state).trim();
    const zip = getAddressAttrValue(attrs, ADDRESS_FIELD_CANDIDATES.zip).trim();
    const cityStateZip = [city, [state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");

    return [street, cityStateZip].filter(Boolean).join(", ");
  }

  function getCurrentPageSafe() {
    return normalizePageKey(getCurrentPage?.() || "parcel");
  }

  function getPageConfig(page = getCurrentPageSafe()) {
    return PAGE_SEARCH_CONFIG[normalizePageKey(page)] || PAGE_SEARCH_CONFIG.parcel;
  }

  function getPVAddressLayer() {
    const activeView = getActiveView?.();
    return activeView === sceneView ? pvAddressLayer3d : pvAddressLayer2d;
  }

  function getPVOwnerTableLayerSafe() {
    return getPVOwnerTableLayer?.() || pvOwnerTableLayer || null;
  }

  function getPWMapViewSafe() {
    return getPWMapView?.() || pwMapView || null;
  }

  function getPWParcelLayerSafe() {
    return getPWParcelLayer?.() || pwParcelLayer || null;
  }

  function getPWCondoLayerSafe() {
    return getPWCondoLayer?.() || pwCondoLayer || null;
  }

  function getPWAddressLayerSafe() {
    return getPWAddressLayer?.() || pwAddressLayer || null;
  }

  function getSAMapViewSafe() {
    return getSAMapView?.() || saMapView || null;
  }

  function getSAParcelLayerSafe() {
    return getSAParcelLayer?.() || saParcelLayer || null;
  }

  function getSACondoLayerSafe() {
    return getSACondoLayer?.() || saCondoLayer || null;
  }

  function getSAAddressLayerSafe() {
    return getSAAddressLayer?.() || saAddressLayer || null;
  }

  const pageResolvers = {
    parcel: {
      getView: () => getActiveView?.() || pvMapView || null,
      getLayer: (sourceKey) => {
        if (sourceKey === "parcel") return pvParcelLayer || null;
        if (sourceKey === "owner") return getPVOwnerTableLayerSafe();
        if (sourceKey === "condo") return pvCondoLayer || null;
        if (sourceKey === "address") return getPVAddressLayer();
        return null;
      }
    },
    pw: {
      getView: () => getPWMapViewSafe(),
      getLayer: (sourceKey) => {
        if (sourceKey === "parcel") return getPWParcelLayerSafe();
        if (sourceKey === "condo") return getPWCondoLayerSafe();
        if (sourceKey === "address") return getPWAddressLayerSafe();
        return null;
      }
    },
    sa: {
      getView: () => getSAMapViewSafe(),
      getLayer: (sourceKey) => {
        if (sourceKey === "parcel") return getSAParcelLayerSafe();
        if (sourceKey === "condo") return getSACondoLayerSafe();
        if (sourceKey === "address") return getSAAddressLayerSafe();
        return null;
      }
    }
  };

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
      if (normalizedPage === "parcel" && sourceKey === "owner") return true;
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

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

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

  function escapeSql(value) {
    return String(value ?? "").replace(/'/g, "''");
  }

  function layerHasField(layer, fieldName) {
    const fields = layer?.fields || [];
    return fields.some((field) => String(field.name).toLowerCase() === String(fieldName).toLowerCase());
  }

  function withCondoSubtypeWhere(layer, where) {
    return layerHasField(layer, "ParcelSubtype")
      ? `${CONDO_INFORMATION_DEFINITION} AND (${where})`
      : where;
  }

  function getAttributeCaseInsensitive(attributes, fieldName) {
    if (!attributes) return undefined;
    if (attributes[fieldName] !== undefined) return attributes[fieldName];

    const targetKey = String(fieldName).toLowerCase();
    const matchKey = Object.keys(attributes).find((key) => key.toLowerCase() === targetKey);
    return matchKey ? attributes[matchKey] : undefined;
  }

  function getFeatureName(feature) {
    return getAttributeCaseInsensitive(feature?.attributes, "Name");
  }

  function getSearchInputKind(term) {
    const value = String(term || "").trim();
    if (!value) return "unknown";
    if (/^\d/.test(value)) return "numeric";
    if (/^[A-Za-z]/.test(value)) return "alpha";
    return "unknown";
  }

  function isParcelNumberLikeTerm(term) {
    const value = String(term || "").trim();
    if (!value) return false;

    const digits = value.replace(/\D/g, "");
    const hasDash = value.includes("-");

    // 17-digit values are parcel IDs. A numeric value with dashes is parcel/condo
    // shaped once the user types the first dash, so it should not query addresses.
    return /^\d{17}$/.test(value) || (hasDash && /^\d[\d-]*$/.test(value) && digits.length <= 17);
  }

  function isNumericParcelSearchField(fieldName) {
    return fieldName === "Name" || fieldName === "parcel_id";
  }

  function buildParcelLikePrefixWhere(fieldName, term) {
    return isNumericParcelSearchField(fieldName)
      ? `${fieldName} LIKE '${term}%'`
      : `UPPER(${fieldName}) LIKE UPPER('${term}%')`;
  }

  function buildCondoParcelLikePrefixWhere(term) {
    const digits = String(term || "").replace(/\D/g, "");
    const clauses = [`Name LIKE '${term}%'`];

    if (digits) {
      clauses.push(`parcel_id LIKE '${escapeSql(digits)}%'`);
      clauses.push(`Name LIKE '${escapeSql(formatParcelWithDashes(digits))}%'`);
    } else {
      clauses.push(`parcel_id LIKE '${term}%'`);
    }

    return `(${[...new Set(clauses)].join(" OR ")})`;
  }

  function buildParcelLikeExactWhere(fieldName, term) {
    return isNumericParcelSearchField(fieldName)
      ? `${fieldName} = '${term}'`
      : `UPPER(${fieldName}) = UPPER('${term}')`;
  }

  function shouldUseSourceForTerm(page, sourceKey, term) {
    const routingToken = getRoutingSearchToken(term);
    const inputKind = getSearchInputKind(routingToken);
    if (normalizePageKey(page) !== "parcel") return true;
    if (isParcelNumberLikeTerm(routingToken)) return sourceKey === "parcel" || sourceKey === "condo";
    if (inputKind === "numeric" && /[A-Za-z]/.test(routingToken)) return sourceKey === "address";
    if (inputKind === "numeric") return sourceKey !== "owner";
    if (inputKind === "alpha") return sourceKey === "owner";
    return true;
  }

  function formatParcelWithDashes(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (digits.length !== 17) return String(value || "");

    return digits.replace(
      /^(\d{2})(\d{3})(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})(\d{3})$/,
      "$1-$2-$3-$4-$5-$6-$7-$8"
    );
  }

  function getSearchFieldFromTerm(term) {
    return term.includes("-") ? "Name" : "parcel_id";
  }

  async function findParcelFeatureByParid(parid) {
    const parcelLayer = getSearchContextForPage("parcel").layers.parcel;
    const normalizedParid = String(parid || "").replace(/\D/g, "");
    if (!parcelLayer || !normalizedParid) return null;

    const dashedParid = formatParcelWithDashes(normalizedParid);
    const safeParid = escapeSql(normalizedParid);
    const safeDashedParid = escapeSql(dashedParid);

    const res = await parcelLayer.queryFeatures({
      where: `parcel_id = '${safeParid}' OR Name = '${safeDashedParid}'`,
      outFields: ["*"],
      returnGeometry: true,
      num: 1
    });

    const feature = res.features?.[0] || null;
    if (feature) {
      try { feature.layer = feature.layer || parcelLayer; } catch (e) {}
    }

    return feature;
  }

  function normalizeOwnerName(value) {
    return String(value ?? "").replace(/(?:\s*,\s*)+$/g, "").replace(/\s+/g, " ").trim();
  }

  function getOwnerAttrsName(attrs) {
    return normalizeOwnerName(attrs?.OWNER_NAMES ?? attrs?.owner_names ?? "");
  }

  function getOwnerAttrsParid(attrs) {
    return String(attrs?.PARID ?? attrs?.parid ?? "").replace(/\D/g, "");
  }

  function groupOwnerRows(features, { maxOwners = 10 } = {}) {
    const groups = new Map();

    for (const feature of features || []) {
      const attrs = feature.attributes || {};
      const ownerName = getOwnerAttrsName(attrs);
      const parid = getOwnerAttrsParid(attrs);
      if (!ownerName || !parid) continue;

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

  function getOwnerGroupCacheKey(ownerName) {
    return normalizeOwnerName(ownerName).toUpperCase();
  }

  async function queryOwnerGroupsByName(term, { exact = false, maxOwners = 10, maxRows = 2000 } = {}) {
    const ownerTable = getSearchContextForPage("parcel").layers.owner;
    const searchTerm = String(term || "").trim();
    if (searchTerm.length < 2) return [];

    const safeTerm = escapeSql(searchTerm);
    const where = exact
      ? `UPPER(OWNER_NAMES) = UPPER('${safeTerm}')`
      : `UPPER(OWNER_NAMES) LIKE UPPER('%${safeTerm}%')`;

    try {
      let features = [];

      if (ownerTable) {
        const res = await ownerTable.queryFeatures({
          where,
          outFields: ["PARID", "TAXYR", "OWNER_NAMES"],
          returnGeometry: false,
          num: maxRows
        });
        features = res.features || [];
      } else {
        const params = new URLSearchParams({
          f: "json",
          where,
          outFields: "PARID,TAXYR,OWNER_NAMES",
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
    } catch (error) {
      return [];
    }
  }

  async function findParcelFeaturesByParids(parids, { limit = 20 } = {}) {
    const parcelLayer = getSearchContextForPage("parcel").layers.parcel;
    const normalizedParids = [...new Set((parids || [])
      .map((parid) => String(parid || "").replace(/\D/g, ""))
      .filter(Boolean))]
      .slice(0, limit);

    if (!parcelLayer || !normalizedParids.length) return [];

    const parcelIds = normalizedParids.map((parid) => `'${escapeSql(parid)}'`);
    const dashedNames = normalizedParids
      .map(formatParcelWithDashes)
      .map((parid) => `'${escapeSql(parid)}'`);

    const res = await parcelLayer.queryFeatures({
      where: `parcel_id IN (${parcelIds.join(",")}) OR Name IN (${dashedNames.join(",")})`,
      outFields: ["*"],
      returnGeometry: true
    });

    return (res.features || []).map((feature) => {
      try { feature.layer = feature.layer || parcelLayer; } catch (e) {}
      return feature;
    });
  }

  async function buildOwnerGroupSearchResult(ownerGroup) {
    const features = await findParcelFeaturesByParids(ownerGroup?.parids || []);
    if (!features.length) return null;

    return {
      name: `${ownerGroup.ownerName} (${ownerGroup.parids.length} properties)`,
      feature: features[0],
      features,
      ownerName: ownerGroup.ownerName,
      propertyCount: ownerGroup.parids.length,
      searchType: "owner"
    };
  }

  async function findFirstOwnerMatch(term) {
    const groups = await queryOwnerGroupsByName(getLatestSearchToken(term), { maxOwners: 1 });
    return groups[0] ? buildOwnerGroupSearchResult(groups[0]) : null;
  }

  async function findFirstFeatureMatch(layer, { term, outFields, searchType, where, orderByFields }) {
    if (!layer || !term) return null;

    const res = await layer.queryFeatures({
      where,
      outFields,
      returnGeometry: true,
      orderByFields,
      num: 1
    });

    const feature = res.features?.[0];
    if (!feature) return null;

    // ensure the feature knows its originating layer (used by selection/highlight helpers)
    try { feature.layer = feature.layer || layer; } catch (e) {}

    return {
      name: searchType === "address"
        ? (formatAddressDisplay(feature.attributes) || feature.attributes?.FULLADDR || term)
        : (getFeatureName(feature) || feature.attributes?.FULLADDR || term),
      feature,
      searchType
    };
  }

  async function findFirstMatch(term) {
    const searchTerm = getRoutingSearchToken(term);
    if (!searchTerm) return null;

    const safeTerm = escapeSql(searchTerm);
    const fieldName = getSearchFieldFromTerm(searchTerm);
    const context = getSearchContextForPage();

    logDebug("findFirstMatch start", {
      page: context.page,
      searchTerm,
      configuredSourceKeys: context.config.sourceKeys,
      availableSourceKeys: context.availableSourceKeys
    });

    for (const sourceKey of context.config.sourceKeys) {
      if (!shouldUseSourceForTerm(context.page, sourceKey, searchTerm)) continue;

      const layer = context.layers[sourceKey];

      if (!layer) {
        logDebug("findFirstMatch skipped missing layer", {
          page: context.page,
          sourceKey
        });
        continue;
      }

      await layer.load?.();

      let match = null;

      if (sourceKey === "owner") {
        match = await findFirstOwnerMatch(searchTerm);
      } else if (sourceKey === "address") {
        const addressTerm = normalizeAddressSearchTerm(searchTerm);
        match = await findFirstFeatureMatch(layer, {
          term: addressTerm,
          outFields: ["*"],
          searchType: "address",
          where: buildAddressWhere(searchTerm, layer),
          orderByFields: ["FULLADDR ASC"]
        });
      } else {
        match = await findFirstFeatureMatch(layer, {
          term: searchTerm,
          outFields: ["*"],
          searchType: SOURCE_DEFINITIONS[sourceKey].searchType,
          where: sourceKey === "condo"
            ? withCondoSubtypeWhere(layer, buildCondoParcelLikePrefixWhere(safeTerm))
            : buildParcelLikePrefixWhere(fieldName, safeTerm),
          orderByFields: ["Name ASC"]
        });
      }

      if (match) {
        logDebug("findFirstMatch hit", {
          page: context.page,
          sourceKey,
          resultName: match.name
        });
        return match;
      }
    }

    logDebug("findFirstMatch miss", {
      page: context.page,
      searchTerm
    });
    return null;
  }

  function createParcelLikeSource(sourceKey) {
    const definition = SOURCE_DEFINITIONS[sourceKey];

    return new SearchSourceClass({
      name: definition.label,
      placeholder: definition.placeholder,
      maxSuggestions: 10,
      maxResults: 10,

      getSuggestions: async (params) => {
        if (isSuggestionSuppressed()) return [];

        const page = getCurrentPageSafe();
        if (!shouldUseSourceForTerm(page, sourceKey, params.suggestTerm || "")) return [];

        const layer = getSearchContextForPage(page).layers[sourceKey];
        if (!layer) {
          logDebug("getSuggestions missing layer", { page, sourceKey });
          return [];
        }

        await layer.load?.();

        const term = escapeSql((params.suggestTerm || "").trim());
        const latestToken = escapeSql(getLatestSearchToken(term));
        if (latestToken.length < 2) return [];

        const fieldName = getSearchFieldFromTerm(latestToken);
        const outFields = sourceKey === "condo"
          ? ["*"]
          : ["OBJECTID", "Name", "parcel_id"];

        logDebug("getSuggestions query", {
          page,
          sourceKey,
          term: latestToken,
          fieldName
        });

        const res = await layer.queryFeatures({
          where: sourceKey === "condo"
            ? withCondoSubtypeWhere(layer, buildCondoParcelLikePrefixWhere(latestToken))
            : buildParcelLikePrefixWhere(fieldName, latestToken),
          outFields,
          returnGeometry: false,
          orderByFields: ["Name ASC"],
          num: 10
        });

        const objectIdField = layer.objectIdField || "OBJECTID";

        return res.features.map((feature) => ({
          key: feature.attributes[objectIdField] ?? feature.attributes.OBJECTID,
          text: feature.attributes.Name,
          sourceIndex: params.sourceIndex
        }));
      },

      getResults: async (params) => {
        const page = getCurrentPageSafe();
        if (!shouldUseSourceForTerm(page, sourceKey, params?.searchTerm || params?.suggestResult?.text || "")) return [];

        const layer = getSearchContextForPage(page).layers[sourceKey];
        if (!layer) {
          logDebug("getResults missing layer", { page, sourceKey });
          return [];
        }

        await layer.load?.();

        const suggestOid = params?.suggestResult?.key;

        if (suggestOid != null) {
          logDebug("getResults by OID", {
            page,
            sourceKey,
            suggestOid
          });

          const objectIdField = layer.objectIdField || "OBJECTID";
          const res = await layer.queryFeatures({
            where: `${objectIdField} = ${suggestOid}`,
            outFields: ["*"],
            returnGeometry: true
          });

          return res.features.map((feature) => {
            try { feature.layer = feature.layer || layer; } catch (e) {}
            return {
              name: feature.attributes.Name,
              feature,
              searchType: definition.searchType
            };
          });
        }

        const term = escapeSql(getLatestSearchToken(params?.searchTerm || ""));
        if (!term) return [];

        const fieldName = getSearchFieldFromTerm(term);

        logDebug("getResults by search term", {
          page,
          sourceKey,
          term,
          fieldName
        });

        const res = await layer.queryFeatures({
          where: sourceKey === "condo"
            ? withCondoSubtypeWhere(layer, buildCondoParcelLikePrefixWhere(term))
            : buildParcelLikeExactWhere(fieldName, term),
          outFields: ["*"],
          returnGeometry: true,
          num: 1
        });

        return res.features.map((feature) => {
          try { feature.layer = feature.layer || layer; } catch (e) {}
          return {
            name: feature.attributes.Name,
            feature,
            searchType: definition.searchType
          };
        });
      }
    });
  }

  function createAddressSource() {
    const definition = SOURCE_DEFINITIONS.address;

    return new SearchSourceClass({
      name: definition.label,
      placeholder: definition.placeholder,
      maxSuggestions: 10,
      maxResults: 10,

      getSuggestions: async (params) => {
        if (isSuggestionSuppressed()) return [];

        const page = getCurrentPageSafe();
        if (!shouldUseSourceForTerm(page, "address", params.suggestTerm || "")) return [];

        const layer = getSearchContextForPage(page).layers.address;
        if (!layer) {
          logDebug("getSuggestions missing layer", { page, sourceKey: "address" });
          return [];
        }

        const term = normalizeAddressSearchTerm(params.suggestTerm || "");
        if (term.length < 2) return [];

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

        logDebug("getSuggestions query", {
          page,
          sourceKey: "address",
          term
        });

        const res = await layer.queryFeatures({
          where: buildAddressWhere(params.suggestTerm || "", layer),
          outFields: ["*"],
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
        if (!shouldUseSourceForTerm(page, "address", params?.searchTerm || params?.suggestResult?.text || "")) return [];

        const layer = getSearchContextForPage(page).layers.address;
        if (!layer) {
          logDebug("getResults missing layer", { page, sourceKey: "address" });
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
          if (!term) return [];

          const res = await layer.queryFeatures({
            where: buildAddressWhere(params?.searchTerm || "", layer),
            outFields: ["*"],
            returnGeometry: true,
            orderByFields: ["FULLADDR ASC"],
            num: 1
          });

          return res.features.map((feature) => {
            try { feature.layer = feature.layer || layer; } catch (e) {}
            return {
              name: formatAddressDisplay(feature.attributes) || feature.attributes.FULLADDR,
              feature,
              searchType: definition.searchType
            };
          });
        }

        logDebug("getResults by OID", {
          page,
          sourceKey: "address",
          oid
        });

        const res = await layer.queryFeatures({
          where: `OBJECTID = ${oid}`,
          outFields: ["*"],
          returnGeometry: true
        });

        return res.features.map((feature) => {
          try { feature.layer = feature.layer || layer; } catch (e) {}
          return {
            name: formatAddressDisplay(feature.attributes) || feature.attributes.FULLADDR,
            feature,
            searchType: definition.searchType
          };
        });
      }
    });
  }

  function createOwnerSource() {
    const definition = SOURCE_DEFINITIONS.owner;

    return new SearchSourceClass({
      name: definition.label,
      placeholder: definition.placeholder,
      maxSuggestions: 10,
      maxResults: 10,

      getSuggestions: async (params) => {
        if (isSuggestionSuppressed()) return [];

        const page = getCurrentPageSafe();
        if (!shouldUseSourceForTerm(page, "owner", params.suggestTerm || "")) return [];

        const ownerTable = getSearchContextForPage(page).layers.owner;
        if (page !== "parcel" && !ownerTable) {
          logDebug("getSuggestions missing layer", { page, sourceKey: "owner" });
          return [];
        }

        const term = escapeSql(getLatestSearchToken(params.suggestTerm || ""));
        if (term.length < 2) return [];

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
        if (!shouldUseSourceForTerm(page, "owner", params?.searchTerm || params?.suggestResult?.text || params?.suggestResult?.key || "")) return [];

        const ownerTable = getSearchContextForPage(page).layers.owner;
        if (page !== "parcel" && !ownerTable) {
          logDebug("getResults missing layer", { page, sourceKey: "owner" });
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

  function getSourcesForPage(page = getCurrentPageSafe(), { includeUnavailable = true } = {}) {
    const context = getSearchContextForPage(page);
    const sourceKeys = includeUnavailable ? context.config.sourceKeys : context.availableSourceKeys;
    const sources = sourceKeys
      .map((sourceKey) => sourcesByKey[sourceKey])
      .filter(Boolean);

    logDebug("resolved search sources", {
      page: context.page,
      configuredSourceKeys: context.config.sourceKeys,
      availableSourceKeys: context.availableSourceKeys,
      includedSourceKeys: sourceKeys,
      sourceNames: sources.map((source) => source?.name)
    });

    return sources;
  }

  function syncSourceSelectorVisibility(page) {
    const hideSelector = page === "parcel";
    searchEl.dataset.hideSourceSelector = hideSelector ? "true" : "false";

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
                color: #9fe7ff;
                font-size: 18px;
                font-weight: 900;
                line-height: 1.25;
              }
            `;
            autocompleteRoot.appendChild(style);
          }

          const itemGroups = Array.from(
            autocompleteRoot?.querySelectorAll("calcite-autocomplete-item-group") || []
          );

          itemGroups.forEach((group) => {
            group.style.setProperty("--calcite-color-text-1", "#9fe7ff");
            group.style.setProperty("--calcite-color-text-2", "#9fe7ff");
            group.style.setProperty("--calcite-font-size--1", "17px");

            const root = group.shadowRoot;
            if (!root) return;

            Array.from(root.querySelectorAll("*")).forEach((node) => {
              const text = String(node.textContent || "").trim();
              if (!labels.includes(text)) return;

              node.style.color = "#9fe7ff";
              node.style.fontSize = "18px";
              node.style.fontWeight = "900";
              node.style.lineHeight = "1.25";
              node.style.paddingBlock = "8px";
            });
          });
        };
 
        searchEl.style.setProperty("--calcite-input-corner-radius", "0");
        searchEl.style.setProperty("--calcite-color-text-1", "#0a1e3a");
        searchEl.style.setProperty("--calcite-color-text-2", "#0a1e3a");
        searchEl.style.setProperty("--calcite-color-brand", "#ffffff");
        searchEl.style.setProperty("--calcite-color-brand-hover", "#ffffff");
        searchEl.style.setProperty("--calcite-color-foreground-1", "#0a1e3a");
        searchEl.style.setProperty("--calcite-color-foreground-2", "#10294a");
        searchEl.style.setProperty("--calcite-color-foreground-3", "#183863");
        searchEl.style.setProperty("--calcite-color-border-1", "transparent");
        searchEl.style.setProperty("--calcite-color-border-input", "transparent");
        searchEl.style.setProperty("--calcite-input-actions-background-color", "transparent");
        searchEl.style.setProperty("--calcite-input-actions-background-color-hover", "transparent");
        searchEl.style.setProperty("--calcite-input-actions-background-color-press", "transparent");
        searchEl.style.setProperty("--calcite-input-actions-icon-color", "#0a1e3a");
        searchEl.style.setProperty("--calcite-input-actions-icon-color-hover", "#0a1e3a");
        searchEl.style.setProperty("--calcite-input-actions-icon-color-press", "#0a1e3a");
 
        if (autocomplete) {
          autocomplete.style.setProperty("--calcite-input-corner-radius", "0");
          autocomplete.style.setProperty("--calcite-color-text-1", "#ffffff");
          autocomplete.style.setProperty("--calcite-color-text-2", "#ffffff");
          autocomplete.style.setProperty("--calcite-color-brand", "#ffffff");
          autocomplete.style.setProperty("--calcite-color-foreground-1", "#0a1e3a");
          autocomplete.style.setProperty("--calcite-color-foreground-2", "#10294a");
          autocomplete.style.setProperty("--calcite-color-foreground-3", "#183863");
          autocomplete.style.setProperty("--calcite-color-border-1", "transparent");
          autocomplete.style.setProperty("--calcite-color-border-input", "transparent");
          autocomplete.style.setProperty("--calcite-input-actions-background-color", "transparent");
          autocomplete.style.setProperty("--calcite-input-actions-background-color-hover", "transparent");
          autocomplete.style.setProperty("--calcite-input-actions-background-color-press", "transparent");
          styleSuggestionGroupLabels();
          requestAnimationFrame(styleSuggestionGroupLabels);
          setTimeout(styleSuggestionGroupLabels, 80);
        }
 
        if (calciteInput) {
          calciteInput.style.setProperty("--calcite-input-corner-radius", "0");
          calciteInput.style.setProperty("--calcite-color-foreground-1", "#ffffff");
          calciteInput.style.setProperty("--calcite-color-foreground-2", "#ffffff");
          calciteInput.style.setProperty("--calcite-color-foreground-3", "#ffffff");
          calciteInput.style.setProperty("--calcite-color-border-1", "transparent");
          calciteInput.style.setProperty("--calcite-color-border-input", "transparent");
          calciteInput.style.setProperty("--calcite-input-text-color", "#0a1e3a");
          calciteInput.style.setProperty("--calcite-input-placeholder-text-color", "#0a1e3a");
          calciteInput.style.setProperty("--calcite-input-icon-color", "#0a1e3a");
          calciteInput.style.setProperty("--calcite-input-actions-background-color", "transparent");
          calciteInput.style.setProperty("--calcite-input-actions-background-color-hover", "transparent");
          calciteInput.style.setProperty("--calcite-input-actions-background-color-press", "transparent");
          calciteInput.style.setProperty("--calcite-input-actions-icon-color", "#0a1e3a");
          calciteInput.style.setProperty("--calcite-input-actions-icon-color-hover", "#0a1e3a");
          calciteInput.style.setProperty("--calcite-input-actions-icon-color-press", "#0a1e3a");
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

              const currentValue = String(inputElement.value || searchEl.value || searchEl.searchTerm || "");
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
          clearButtonIcon.style.color = "#0a1e3a";
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
          selectorButton.style.setProperty("--calcite-button-text-color", "#0a1e3a");
          selectorButton.style.setProperty("--calcite-button-text-color-hover", "#0a1e3a");
          selectorButton.style.setProperty("--calcite-button-text-color-press", "#0a1e3a");
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
          selectorIcon.style.color = "#0a1e3a";
        }
 
        if (!hideSelector && rootDropdown) {
          rootDropdown.style.position = "absolute";
          rootDropdown.style.right = "10px";
          rootDropdown.style.top = "50%";
          rootDropdown.style.transform = "translateY(-50%)";
          rootDropdown.style.zIndex = "3";
          rootDropdown.style.width = "auto";
          rootDropdown.style.pointerEvents = "auto";
        } else if (rootDropdown) {
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
 
        logDebug("syncSourceSelectorVisibility applied", {
          page,
          hideSelector,
          hasRootDropdown: !!rootDropdown,
          hasRootContainer: !!rootContainer,
          hasRootForm: !!rootForm,
          hasActionMenu: !!actionMenu,
          hasActionWrapper: !!actionWrapper,
          hasClearButton: !!clearButton,
          hasClearButtonShadowButton: !!clearButtonShadowButton,
          hasCalciteInput: !!calciteInput,
          hasInputElement: !!inputElement,
          hasSelectorButton: !!selectorButton
        });
 
        if (hideSelector && (clearButton || clearButtonShadowButton)) {
          logDebug("parcel clear button debug", {
            actionWrapperTag: actionWrapper?.tagName || null,
            actionWrapperClass: actionWrapper?.className || null,
            clearButtonTag: clearButton?.tagName || null,
            clearButtonClass: clearButton?.className || null,
            clearButtonShadowButtonClass: clearButtonShadowButton?.className || null,
            clearButtonInlineStyle: clearButton?.getAttribute?.("style") || null,
            clearButtonShadowInlineStyle: clearButtonShadowButton?.getAttribute?.("style") || null
          });
        }
      } catch (error) {
        logDebug("syncSourceSelectorVisibility failed", {
          page,
          message: error?.message || error,
          name: error?.name
        });
      }
    };


    requestAnimationFrame(applyVisibility);
    setTimeout(applyVisibility, 0);
    setTimeout(applyVisibility, 150);
    setTimeout(applyVisibility, 400);
  }

  async function applySearchConfig(page, { includeUnavailable = true } = {}) {
    const context = getSearchContextForPage(page);
    const sources = getSourcesForPage(context.page, { includeUnavailable });

    await searchEl.componentOnReady?.();

    logDebug("applySearchConfig", {
      page: context.page,
      label: context.config.label,
      placeholder: context.config.placeholder,
      configuredSourceKeys: context.config.sourceKeys,
      availableSourceKeys: context.availableSourceKeys,
      includeUnavailable,
      hasView: !!context.view,
      hasParcelLayer: !!context.layers.parcel,
      hasAddressLayer: !!context.layers.address,
      hasCondoLayer: !!context.layers.condo
    });

    searchEl.sources = [];
    searchEl.activeSourceIndex = -1;
    searchEl.sources = sources;
    searchEl.allPlaceholder = context.config.placeholder;
    searchEl.locationDisabled = true;
    searchEl.suggestionsDisabled = false;
    searchEl.maxSuggestions = 10;
    syncSourceSelectorVisibility(context.page);

    clearSearchUi();
    searchEl.style.visibility = "visible";
    searchShell?.setAttribute("data-ready", "true");
  }

  async function setParcelViewerSearch() {
    logDebug("setParcelViewerSearch requested");
    await applySearchConfig("parcel");
  }

  async function setPWSearch() {
    logDebug("setPWSearch requested");
    await applySearchConfig("pw", { includeUnavailable: true });

    waitForAvailableSources("pw")
      .then(async (context) => {
        if (context.availableSourceKeys.length) {
          await applySearchConfig("pw", { includeUnavailable: false });
        }
      })
      .catch((err) => {
        logDebug("setPWSearch background source wait failed", {
          message: err?.message || err,
          name: err?.name
        });
      });
  }

  async function setSASearch() {
    logDebug("setSASearch requested");
    await applySearchConfig("sa");
  }

  async function selectInSAMap(feature) {
    const activeSAMapView = getSAMapViewSafe();
    if (!feature?.attributes || !activeSAMapView) return;

    const oid = feature.attributes.OBJECTID;
    if (oid == null) return;

    const layer = feature.layer || getSearchContextForPage("sa").layers.parcel;
    if (!layer) return;

    const layerView = await activeSAMapView.whenLayerView(layer);

    if (saHighlightHandle) {
      try {
        saHighlightHandle.remove();
      } catch {}
    }

    saHighlightHandle = layerView.highlight([oid]);

    if (featureTable) {
      await featureTable.componentOnReady?.();
      featureTable.definitionExpression = `OBJECTID = ${oid}`;
    }
  }

  function getFeatureExtent(feature) {
    return feature?.geometry?.extent || feature?.geometry || null;
  }

  function getCombinedFeatureTarget(features) {
    const extents = (features || [])
      .map(getFeatureExtent)
      .filter(Boolean);

    if (!extents.length) return null;

    let combined = extents[0].clone?.() || extents[0];

    for (let i = 1; i < extents.length; i++) {
      if (typeof combined.union === "function") {
        combined = combined.union(extents[i]);
      }
    }

    return combined.expand?.(2) || combined;
  }

  async function selectOwnerParcelFeatures(features) {
    if (typeof toggleParcelSelection !== "function") return;

    const selected = typeof getSelectedParcels === "function" ? getSelectedParcels() : [];
    const selectedKeys = new Set((selected || []).map((feature) => {
      const attrs = feature?.attributes || {};
      const layerTitle = feature?.layer?.title || "UnknownLayer";
      const oid = attrs.OBJECTID ?? attrs.ObjectID ?? attrs.oid ?? attrs.OID ?? "";
      const name = attrs.Name || attrs.PIN || attrs.ParcelNumber || "";
      return `${layerTitle}::${oid}::${name}`;
    }));

    for (const feature of features || []) {
      if (selectedKeys.size >= 20) break;

      const attrs = feature?.attributes || {};
      const layerTitle = feature?.layer?.title || "UnknownLayer";
      const oid = attrs.OBJECTID ?? attrs.ObjectID ?? attrs.oid ?? attrs.OID ?? "";
      const name = attrs.Name || attrs.PIN || attrs.ParcelNumber || "";
      const key = `${layerTitle}::${oid}::${name}`;

      if (selectedKeys.has(key)) continue;
      await toggleParcelSelection(feature);
      selectedKeys.add(key);

      if (selectedKeys.size >= 20) break;
    }
  }

  async function selectParcelFromAddressFeature(addressFeature, { select = true } = {}) {
    if (!addressFeature?.attributes) return null;

    const addptKey = addressFeature.attributes.ADDPTKEY;
    if (addptKey == null) return null;

    const parcelLayer = getSearchContextForPage().layers.parcel;
    const normalizedKey = String(addptKey).trim();
    if (!parcelLayer || !normalizedKey) return null;

    const res = await parcelLayer.queryFeatures({
      where: `UPPER(Name) = UPPER('${escapeSql(normalizedKey)}')`,
      outFields: ["*"],
      returnGeometry: true,
      num: 1
    });

    const parcelFeature = res.features?.[0];
    if (!parcelFeature) return null;

    try { parcelFeature.layer = parcelFeature.layer || parcelLayer; } catch (e) {}

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

  async function focusSearchResult(result) {
    if (!result?.feature) return false;

    const feature = result.feature;
    const searchType = result.searchType;
    const context = getSearchContextForPage();
    const searchText = String(searchEl.value || searchEl.searchTerm || result?.name || "").trim();
    setSearchDisplayValue(result?.name || "");
    setSuggestionSuppressed(true);
    setResolvedSearchDisplayActive(true);

    logDebug("focusSearchResult", {
      page: context.page,
      searchType,
      hasFeature: !!feature,
      availableSourceKeys: context.availableSourceKeys
    });

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
        logDebug("focusSearchResult missing PW view", { searchType });
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
      if (typeof switchTo3D === "function") {
        await switchTo3D();
      }

      if (sceneView) {
        await sceneView.goTo({
          target: feature.geometry?.extent ? feature.geometry.extent.expand(2) : feature.geometry,
          tilt: 75
        });
      }

      if (typeof selectBuildingFloorParcel === "function") {
        const selectedCondo = await selectBuildingFloorParcel(feature);
        if (selectedCondo === false) {
          console.warn("Condo search result could not be selected.", feature?.attributes);
          return false;
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

      if ((result.propertyCount || result.features.length) > 20) {
        window.alert?.(
          `${result.ownerName || "That owner"} has ${result.propertyCount} properties. The first 20 were selected because the selection limit is 20.`
        );
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
      } else {
        syncSelectedParcelSearchDisplay();
      }
      closeSuggestionsOnly();
      return true;
    }

    if (searchType === "address") {
      const parcelFeature = await selectParcelFromAddressFeature(feature, { select: false });
      if (parcelFeature) {
        if (typeof selectBuildingFloorParcel === "function") {
          const selectedCondo = await selectBuildingFloorParcel(parcelFeature);
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

    logDebug("arcgisSearchComplete", {
      page: getCurrentPageSafe(),
      groupCount: allResults.length,
      hasResult: !!result?.feature
    });

    if (!result?.feature) return;

    await focusSearchResult(result);
    closeSuggestionsOnly();
  });

  searchEl.addEventListener("arcgisSuggestComplete", () => {
    if (!isSuggestionSuppressed()) return;
    closeSuggestionsOnly();
  });

  async function trySelectFirstFromInput() {
    const raw = String(searchEl.value || searchEl.searchTerm || "").trim();
    if (!raw) return false;

    const tokens = getSearchEntryTokens(raw);

    if (tokens.length === 0) return false;

    // single token -> behave as before
    if (tokens.length === 1) {
      const match = await findFirstMatch(tokens[0]);
      if (match?.feature) {
        await focusSearchResult(match);
        closeSuggestionsOnly();
        return true;
      }

      return false;
    }

    // multiple tokens -> try to find matches for each and select them
    const MAX_MULTI = 20;
    const selectedMatches = [];

    for (const token of tokens.slice(0, MAX_MULTI)) {
      try {
        const m = await findFirstMatch(token);
        if (m?.feature) selectedMatches.push(m);
      } catch (e) {
        /* ignore individual token failures */
      }
    }

    if (!selectedMatches.length) return false;

    const parcelMatches = selectedMatches.filter((m) => m.searchType === "parcel" && m.feature);
    const nonParcelMatches = selectedMatches.filter((m) => m.searchType !== "parcel" && m.feature);

    for (const m of parcelMatches) {
      try {
        if (typeof toggleParcelSelection === "function") {
          await toggleParcelSelection(m.feature);
        }
      } catch (e) {
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
      } catch (e) {
        /* ignore */
      }
    }

    closeSuggestionsOnly();

    return true;
  }

  searchEl.addEventListener("paste", () => {
    pasteSearchPending = true;
    setSuggestionSuppressed(true);

    // wait for the paste to update the input value, then try to select the first match
    setTimeout(async () => {
      let handled = false;

      try {
        handled = await trySelectFirstFromInput();
      } finally {
        pasteSearchPending = false;

        if (!handled) {
          setSuggestionSuppressed(false);
          setSearchDisplayPreserved(false);
        }
      }
    }, 0);
  });

  searchEl.addEventListener("keydown", async (evt) => {
    const key = String(evt.key || "");
    const userTypingKey =
      key.length === 1 ||
      key === "Backspace" ||
      key === "Delete";
    if (userTypingKey) {
      const hasPreservedDisplay = searchEl.dataset.preserveSearchDisplay === "true";
      const delimiterKey = key === "," || key === ";";
      if (!hasPreservedDisplay || delimiterKey || key === "Backspace" || key === "Delete") {
        setSuggestionSuppressed(false);
        setSearchDisplayPreserved(false);
      } else {
        setSuggestionSuppressed(true);
      }
    }

    if (evt.key === "Enter") {
      evt.preventDefault();
      const handled = await trySelectFirstFromInput();
      if (!handled) {
        try {
          // fallback to the component's own search if available
          searchEl.search?.();
        } catch (e) {}
      }
      setSuggestionSuppressed(true);
      closeSuggestionsOnly();
    }
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
