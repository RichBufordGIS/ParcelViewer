// Shared pure-utility helpers.
// No ArcGIS imports, no shared state, no DOM access.
// All functions are safe to call in any context.
import { FIELDS, LAYER_TITLES, MAX_SELECTED_PARCELS } from "./constants.js";
// ---- Tooltip / label normalization ----------------------------------------
export function normalizeTooltipText(value) {
    return String(value || "")
        .replace(/\s+/g, " ")
        .replace(/[xX]/g, "")
        .replace(/[\u2716\u00D7]/g, "")
        .trim();
}
/** Handles humanize control id. */
export function humanizeControlId(value) {
    return normalizeTooltipText(String(value || "")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .replace(/\b(btn|tab|fab)\b/gi, ""));
}
// ---- Parcel number format helpers ------------------------------------------
/**
 * Returns true when value matches the Jackson County dashed parcel format:
 * ##-###-##-##-##-#-##-### (17 digits with dashes)
 */
export function isDashedParcel(value) {
    return /^\d{2}-\d{3}-\d{2}-\d{2}-\d{2}-\d-\d{2}-\d{3}$/.test(String(value || "").trim());
}
/** Returns true when value is exactly 17 digits with no dashes. */
export function isUndashed17DigitParcel(value) {
    return /^\d{17}$/.test(String(value || "").trim());
}
/**
 * Splits parcel-list text copied from text editors or spreadsheets.
 * Commas, semicolons, tabs, carriage returns, and new lines are treated as
 * separators. Empty cells/rows are ignored and duplicate parcel values are
 * removed while preserving the user's original order.
 */
export function parseParcelBatch(input) {
    const parcelPattern = /\d{2}-\d{3}-\d{2}-\d{2}-\d{2}-\d-\d{2}-\d{3}|\b\d{17}\b/g;
    const parcelMatches = String(input || "").match(parcelPattern);
    const seen = new Set();
    const tokens = parcelMatches?.length
        ? parcelMatches
        : String(input || "").split(/[\t\r\n,;]+/);
    return tokens
        .map((value) => value.trim())
        .filter(Boolean)
        .filter((value) => {
        const key = value.toUpperCase();
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
/**
 * Returns parcel-list parsing details used to provide paste feedback without
 * duplicating the delimiter/de-duplication rules in UI modules.
 */
export function getParcelBatchParseDetails(input) {
    const parcelPattern = /\d{2}-\d{3}-\d{2}-\d{2}-\d{2}-\d-\d{2}-\d{3}|\b\d{17}\b/g;
    const parcelMatches = String(input || "").match(parcelPattern);
    const rawTokens = (parcelMatches?.length
        ? parcelMatches
        : String(input || "").split(/[\t\r\n,;]+/))
        .map((value) => value.trim())
        .filter(Boolean);
    const parcels = parseParcelBatch(input);
    return {
        parcels,
        suppliedCount: rawTokens.length,
        duplicateCount: Math.max(0, rawTokens.length - parcels.length)
    };
}
/**
 * Validates an array of parcel number strings.
 * @returns {{ ok: boolean, format: "dashed"|"undashed"|null, parcels: string[], message?: string }}
 */
export function normalizeBatchParcelInput(values) {
    if (!values.length) {
        return { ok: false, message: "No parcel numbers were provided.", format: null, parcels: [] };
    }
    if (values.length > MAX_SELECTED_PARCELS) {
        return {
            ok: false,
            message: `You can search up to ${MAX_SELECTED_PARCELS} parcel numbers at one time.`,
            format: null,
            parcels: []
        };
    }
    const allDashed = values.every(isDashedParcel);
    const allUndashed = values.every(isUndashed17DigitParcel);
    if (allDashed)
        return { ok: true, format: "dashed", parcels: values };
    if (allUndashed)
        return { ok: true, format: "undashed", parcels: values };
    return {
        ok: false,
        message: "Parcel lists may be separated by commas, semicolons, tabs, or new lines (including Excel rows/cells). Use either all full dashed parcel numbers like 29-220-16-06-00-0-00-000, or all 17-digit parcel numbers with no dashes.",
        format: null,
        parcels: []
    };
}
/**
 * Inserts Jackson County dashes into a 17-digit parcel number.
 * Returns the original value unchanged if it is not exactly 17 digits.
 */
export function formatParcelWithDashes(value) {
    if (!value)
        return "";
    const digits = String(value).replace(/\D/g, "");
    if (digits.length === 17) {
        return digits.replace(/^(\d{2})(\d{3})(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})(\d{3})$/, "$1-$2-$3-$4-$5-$6-$7-$8");
    }
    return value;
}
/** Strips dashes from a parcel number for use in Tyler system lookups. */
export function normalizeParcelForTyler(parcelNumber) {
    if (!parcelNumber)
        return "";
    return String(parcelNumber).replace(/-/g, "").trim();
}
// ---- Feature identity helpers ----------------------------------------------
/**
 * Builds a unique string key for a selected ArcGIS feature.
 * Format: "LayerTitle::OID::Name"
 */
export function getSelectionKey(feature) {
    const attrs = feature?.attributes || {};
    const layerTitle = feature?.layer?.title || "UnknownLayer";
    const oid = attrs[FIELDS.objectId] ?? attrs.ObjectID ?? attrs.oid ?? attrs.OID ?? "";
    const name = attrs[FIELDS.name] || attrs[FIELDS.pin] || attrs[FIELDS.parcelNumber] || "";
    return `${layerTitle}::${oid}::${name}`;
}
/** Returns true when the feature is a regular 2D parcel (layer title "Parcels"). */
export function isRegular2DParcel(feature) {
    return feature?.layer?.title === LAYER_TITLES.parcels;
}
/** Returns true when the feature is a 3D condo floor (layer title "Parcel Condominiums Floors"). */
export function isCondo3DParcel(feature) {
    const layerTitle = feature?.layer?.title;
    return layerTitle === LAYER_TITLES.parcelCondominiumsFloors ||
        layerTitle === LAYER_TITLES.parcelCondominiums ||
        [2, 4].includes(Number(feature?.attributes?.[FIELDS.parcelSubtype]));
}
/** Returns the display name for a selected parcel. */
export function getParcelDisplayName(feature) {
    const attrs = feature?.attributes || {};
    const value = attrs[FIELDS.name] ||
        attrs[FIELDS.parid] ||
        attrs[FIELDS.paridLower] ||
        attrs[FIELDS.parcelIdUpper] ||
        attrs[FIELDS.parcelId] ||
        attrs[FIELDS.pin] ||
        attrs[FIELDS.parcelNumber] ||
        "";
    if (!value)
        return "Unknown Parcel";
    return formatParcelWithDashes(value);
}
/**
 * Returns the value used to look up a feature in the Tyler system.
 * Floor (3D condo) features use parcel_id; regular parcels use Name.
 */
export function getTylerLookupValue(feature) {
    const attrs = feature?.attributes || {};
    if (isCondo3DParcel(feature)) {
        return attrs[FIELDS.parcelId] || "";
    }
    return attrs[FIELDS.name] || "";
}
// ---- Comparison helpers ----------------------------------------------------
/** Trims and uppercases a value for case-insensitive comparison. */
export function normalizeCompareValue(value) {
    return String(value ?? "").trim().toUpperCase();
}
/**
 * Returns true if every row has the same value for fieldName
 * (after normalization). Single-row arrays always return true.
 */
export function getCompareStatus(rows, fieldName) {
    const values = rows.map((r) => normalizeCompareValue(r[fieldName]));
    if (values.length <= 1)
        return true;
    const first = values[0];
    return values.every((v) => v === first);
}
