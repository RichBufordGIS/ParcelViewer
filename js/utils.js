// Shared pure-utility helpers extracted from main.js.
// No ArcGIS imports, no shared state, no DOM access.
// All functions are safe to call in any context.

// ---- Tooltip / label normalization ----------------------------------------

export function normalizeTooltipText(value) {
	return String(value || "")
		.replace(/\s+/g, " ")
		.replace(/[xX]/g, "")
		.replace(/[\u2716\u00D7]/g, "")
		.trim();
}

export function humanizeControlId(value) {
	return normalizeTooltipText(
		String(value || "")
			.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
			.replace(/[_-]+/g, " ")
			.replace(/\b(btn|tab|fab)\b/gi, "")
	);
}

// ---- Parcel number format helpers ------------------------------------------

/**
 * Returns true when value matches the Jackson County dashed parcel format:
 * ##-###-##-##-##-#-##-### (17 digits with dashes)
 */
export function isDashedParcel(value) {
	return /^\d{2}-\d{3}-\d{2}-\d{2}-\d{2}-\d-\d{2}-\d{3}$/.test(
		String(value || "").trim()
	);
}

/** Returns true when value is exactly 17 digits with no dashes. */
export function isUndashed17DigitParcel(value) {
	return /^\d{17}$/.test(String(value || "").trim());
}

/**
 * Splits a comma / newline / semicolon-delimited string into trimmed,
 * non-empty parcel number tokens.
 */
export function parseParcelBatch(input) {
	return String(input || "")
		.split(/[\n,;]/)
		.map((v) => v.trim())
		.filter(Boolean);
}

/**
 * Validates an array of parcel number strings.
 * @returns {{ ok: boolean, format: "dashed"|"undashed"|null, parcels: string[], message?: string }}
 */
export function normalizeBatchParcelInput(values) {
	if (!values.length) {
		return { ok: false, message: "No parcel numbers were provided.", format: null, parcels: [] };
	}

	if (values.length > 20) {
		return {
			ok: false,
			message: "You can search up to 20 parcel numbers at one time.",
			format: null,
			parcels: []
		};
	}

	const allDashed = values.every(isDashedParcel);
	const allUndashed = values.every(isUndashed17DigitParcel);

	if (allDashed) return { ok: true, format: "dashed", parcels: values };
	if (allUndashed) return { ok: true, format: "undashed", parcels: values };

	return {
		ok: false,
		message:
			"Parcel lists must be separated with commas with or without spaces, semicolons, or new lines. Use either all full dashed parcel numbers like 29-220-16-06-00-0-00-000, or all 17-digit parcel numbers with no dashes.",
		format: null,
		parcels: []
	};
}

/**
 * Inserts Jackson County dashes into a 17-digit parcel number.
 * Returns the original value unchanged if it is not exactly 17 digits.
 */
export function formatParcelWithDashes(value) {
	if (!value) return "";
	const digits = String(value).replace(/\D/g, "");
	if (digits.length === 17) {
		return digits.replace(
			/^(\d{2})(\d{3})(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})(\d{3})$/,
			"$1-$2-$3-$4-$5-$6-$7-$8"
		);
	}
	return value;
}

/** Strips dashes from a parcel number for use in Tyler system lookups. */
export function normalizeParcelForTyler(parcelNumber) {
	if (!parcelNumber) return "";
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
	const oid = attrs.OBJECTID ?? attrs.ObjectID ?? attrs.oid ?? attrs.OID ?? "";
	const name = attrs.Name || attrs.PIN || attrs.ParcelNumber || "";
	return `${layerTitle}::${oid}::${name}`;
}

/** Returns true when the feature is a regular 2D parcel (layer title "Parcels"). */
export function isRegular2DParcel(feature) {
	return feature?.layer?.title === "Parcels";
}

/** Returns true when the feature is a 3D condo floor (layer title "Parcel Condominiums Floors"). */
export function isCondo3DParcel(feature) {
	const layerTitle = feature?.layer?.title;
	return layerTitle === "Parcel Condominiums Floors" ||
		layerTitle === "Parcel Condominiums" ||
		[2, 4].includes(Number(feature?.attributes?.ParcelSubtype));
}

/** Returns the display name for a selected parcel (attributes.Name or fallback). */
export function getParcelDisplayName(feature) {
	return feature?.attributes?.Name || "Unknown Parcel";
}

/**
 * Returns the value used to look up a feature in the Tyler system.
 * Floor (3D condo) features use parcel_id; regular parcels use Name.
 */
export function getTylerLookupValue(feature) {
	const attrs = feature?.attributes || {};
	if (isCondo3DParcel(feature)) {
		return attrs.parcel_id || "";
	}
	return attrs.Name || "";
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
	if (values.length <= 1) return true;
	const first = values[0];
	return values.every((v) => v === first);
}
