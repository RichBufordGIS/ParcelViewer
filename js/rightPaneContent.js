export async function buildParcelDetailsFrame(parcelnum, { sourceFeature = null } = {})
{
    const [FeatureLayer, Query] = await $arcgis.import([
        "@arcgis/core/layers/FeatureLayer.js",
        "@arcgis/core/rest/support/Query.js"
    ]);

    //44-320-17-05-00-0-00-000 - me
    //11-700-04-27-00-0-00-000 - long legal descr
    const isCondoFeature =
        [2, 4].includes(Number(sourceFeature?.attributes?.ParcelSubtype)) ||
        sourceFeature?.layer?.title === "Parcel Condominiums Floors" ||
        sourceFeature?.layer?.title === "Parcel Condominiums";
    const view = document.getElementById("map2d")?.view || document.getElementById("saMap")?.view || document.getElementById("pwMap")?.view;
    const curParcels = view?.map?.allLayers?.find((layer) => layer.title === "Parcels") || null;
    const sceneView = document.getElementById("scene3d")?.view;
    const condoDetailsLayer =
        sourceFeature?.layer ||
        sceneView?.map?.allLayers?.find((layer) => layer.title === "Parcel Condominiums Floors") ||
        sceneView?.map?.allLayers?.find((layer) => layer.title === "Parcel Condominiums") ||
        null;
    let feature = null;

    if (isCondoFeature && condoDetailsLayer)
    {
        const condoQuery = new Query();
        const safeParcel = String(parcelnum).replace(/'/g, "''");
        condoQuery.where = `Name='${safeParcel}' OR parcel_id='${safeParcel}'`;
        condoQuery.returnGeography = false;
        condoQuery.outFields = ["*"];

        const condoResults = await condoDetailsLayer.queryFeatures(condoQuery);
        feature = condoResults?.features?.[0] || null;
    }

    if (!feature && isCondoFeature)
    {
        feature = sourceFeature;
    }

    if (!feature && !curParcels)
    {
        return `<div>Parcels layer not available</div>`;
    }

    let curYear = 2026; // change this every year when the Assessment Dept has their new values ready

    const curQuery = new Query();
    curQuery.where = "Name='" + String(parcelnum).replace(/'/g, "''") + "'";
    curQuery.returnGeography = false;
    curQuery.outFields = ["*"];
    if (!feature)
    {
        const results = await curParcels.queryFeatures(curQuery);
        feature = results?.features?.[0];
    }

    if (!feature)
    {
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
    const formatCurrencyValue = (value, fallback = "") => {
        if (value === null || value === undefined || value === "") return fallback;

        const numericValue = Number(String(value).replace(/[^0-9.-]/g, ""));
        if (!Number.isFinite(numericValue)) return String(value);

        return numericValue.toLocaleString("en-US", { maximumFractionDigits: 0 });
    };
    const getValue = (keys, fallback = "", sourceAttrs = attrs) => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const key of keyList)
        {
            const exactValue = sourceAttrs?.[key];
            if (exactValue !== null && exactValue !== undefined && exactValue !== "") return String(exactValue);

            const matchKey = Object.keys(sourceAttrs || {}).find((sourceKey) => sourceKey.toLowerCase() === String(key).toLowerCase());
            const matchValue = matchKey ? sourceAttrs[matchKey] : null;
            if (matchValue !== null && matchValue !== undefined && matchValue !== "") return String(matchValue);
        }

        return fallback;
    };
    const copyButton = (value, label = "Copy value") => {
        const text = String(value ?? "").trim();
        if (!text) return "";

        return `
            <button type="button" class="copy-field-btn" data-copy-value="${escapeAttr(text)}" data-copy-label="${escapeAttr(label)}" title="${escapeAttr(label)}" aria-label="${escapeAttr(label)}">
                <calcite-icon icon="duplicate" scale="s"></calcite-icon>
            </button>
        `;
    };
    const copyFieldValue = (value, label = "Copy value") => {
        const text = String(value ?? "").trim();
        return `
            <span class="copy-field-value">${escapeHtml(text)}</span>
            ${copyButton(text, label)}
        `;
    };
    const getExemption = (sourceAttrs = attrs) => {
        const value = sourceAttrs?.["EXCODES"];
        return value === null || value === undefined || value === "" ? "No known exemption" : String(value);
    };
    const getLegal = (sourceAttrs = attrs) => {
        const legal = sourceAttrs?.["LEGDESC"];
        if (typeof legal !== "string") return "";
        if (legal.length <= 100) return copyFieldValue(legal, "Copy legal description");

        return `
            <span class="copy-field-value">${escapeHtml(legal.slice(0, 100))}...</span>
            ${copyButton(legal, "Copy legal description")}
            <button type="button" id="btnLegal" data-full-legal="${escapeAttr(legal)}">Show Full Legal</button>
        `;
    };

    if (!document.__legalToggleBound)
    {
        document.addEventListener("click", (event) => {
            const btnLegal = event.target instanceof Element ? event.target.closest("#btnLegal") : null;
            if (!btnLegal) return;
            seeLongLegal(btnLegal.dataset.fullLegal || "");
        });
        document.__legalToggleBound = true;
    }

    if (!document.__copyFieldBound)
    {
        document.addEventListener("click", async (event) => {
            const copyBtn = event.target instanceof Element ? event.target.closest(".copy-field-btn") : null;
            if (!copyBtn) return;

            const value = copyBtn.dataset.copyValue || "";
            if (!value) return;

            try {
                if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(value);
                } else {
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
            } catch {}
        });
        document.__copyFieldBound = true;
    }

    const histYears = Array.from({ length: 4 }, (_, i) => curYear - 1 - i);
    const historicRows = [];

    for (let y = 0; y < 4; y++)
    {
        const histParcels = new FeatureLayer({
            url: "https://services3.arcgis.com/4LOAHoFXfea6Y3Et/arcgis/rest/services/Parcel_Viewer_Historic_Parcels/FeatureServer/" + y.toString()
        });

        const histQuery = new Query();
        histQuery.where = "Name='" + String(parcelnum).replace(/'/g, "''") + "'";
        histQuery.returnGeography = false;
        histQuery.outFields = ["*"];
        const histResults = await histParcels.queryFeatures(histQuery);
        const histFeature = histResults?.features?.[0];
        const histAttrs = histFeature?.attributes || {};

        historicRows.push(`
            <div class="col-values" id="lblYear${y}"><b>${histYears[y]}</b></div>
            <div class="col-values" id="lblYear${y}TMV">$${formatCurrencyValue(getValue("MKTVAL", "", histAttrs))}</div>
            <div class="col-values" id="lblYear${y}TAV">$${formatCurrencyValue(getValue("ASDVAL", "", histAttrs))}</div>
            <div class="col-values" id="lblYear${y}TTV">$${formatCurrencyValue(getValue("TAXVAL", "", histAttrs))}</div>
        `);
    }

    return `
        <div id="right-info">
            <div id="basic">
                <div class="col-full mobile-copy-field"><div class="col-full-left"><b>Parcel #</b></div><div class="col-full-right" id="lblParcelNum">${copyFieldValue(getValue(["PARCEL_ID", "parcel_id", "Name"], parcelnum), "Copy parcel number")}</div></div>
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
                    <div class="col-full-left" id="longLegal" style="display:none;"></div>
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

function seeLongLegal(fullLegal = "")
{
    const longLegal = document.getElementById("longLegal");
    const btnLegal = document.getElementById("btnLegal");
    if (!longLegal || !btnLegal) return;

    const isVisible = longLegal.style.display === "block";
    longLegal.textContent = fullLegal;
    longLegal.style.display = isVisible ? "none" : "block";
    btnLegal.textContent = isVisible ? "Show Full Legal" : "Hide Full Legal";
}

async function fetchTylerParcelPhotos(parcelNumber)
{
	const response = await fetch("https://jcgis.jacksongov.org/TylerPhotosQuery/TylerPhotosQuery.aspx/GetPhotos", {
		method: "POST",
		headers: {
			"Content-Type": "application/json; charset=utf-8"
		},
		body: JSON.stringify({ pnum: parcelNumber })
	});

	if(!response.ok) throw new Error(`Photo lookup failed (${response.status})`);

	const payload = await response.json();
	const values = Array.isArray(payload?.d) ? payload.d : [];
	return values.filter((value) => typeof value === "string" && value.includes("DOCCConv"));
}

function renderTylerPhotoViewer(container, photos, startIndex = 0)
{
	if(!container) return;

	container.__tylerPhotoViewerCleanup?.();
	container.__tylerPhotoViewerCleanup = null;

	if(!photos.length)
	{
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
					<calcite-icon icon="chevron-left" scale="m"></calcite-icon>
				</button>
				<div class="tyler-photo-container">
					<img class="tyler-photo-active" alt="Parcel photo" />
					<button class="tyler-photo-fullscreen-button" type="button" aria-label="Open photo viewer" title="Open photo viewer">
						<span class="tyler-photo-fullscreen-cue" aria-hidden="true">
							<calcite-icon icon="full-screen"></calcite-icon>
						</span>
					</button>
				</div>
				<button class="tyler-photo-nav next" type="button" aria-label="Next photo" title="Next photo">
					<calcite-icon icon="chevron-right" scale="m"></calcite-icon>
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

	photos.forEach((photoUrl, index) =>
	{
		const button = document.createElement("button");
		button.className = "tyler-photo-thumb";
		button.type = "button";
		button.setAttribute("aria-label", `Select photo ${index + 1}`);

		const image = document.createElement("img");
		image.src = photoUrl;
		image.alt = `Parcel photo ${index + 1}`;
		button.appendChild(image);
		button.addEventListener("click", () =>
		{
			setActivePhoto(index);
			fullscreenButton?.focus({ preventScroll: true });
		});
		thumbs.appendChild(button);
	});

	const thumbButtons = Array.from(thumbs.querySelectorAll(".tyler-photo-thumb"));

	function setActivePhoto(index)
	{
		activeIndex = Math.min(Math.max(index, 0), photos.length - 1);
		activeImage.src = photos[activeIndex];
		activeImage.alt = `Parcel photo ${activeIndex + 1}`;

		thumbButtons.forEach((button, thumbIndex) =>
		{
			const isActive = thumbIndex === activeIndex;
			button.classList.toggle("active", isActive);
			button.setAttribute("aria-current", isActive ? "true" : "false");
		});

		thumbButtons[activeIndex]?.scrollIntoView({ block: "nearest", inline: "nearest" });
		previousButton.disabled = photos.length < 2;
		nextButton.disabled = photos.length < 2;
	}

	function openFullscreenViewer(index)
	{
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
					<img src="https://jcgis.jacksongov.org/images/largelogo.png" alt="Jackson County GIS" />
					<div>
						<div class="tyler-photo-fullscreen-brand-title">Parcel Viewer</div>
						<div class="tyler-photo-fullscreen-brand-subtitle">Parcel Photos</div>
					</div>
				</div>
				<button class="tyler-photo-fullscreen-close" type="button" aria-label="Close photo viewer" title="Close photo viewer">
					<calcite-icon icon="x" scale="m"></calcite-icon>
				</button>
				<button class="tyler-photo-fullscreen-nav previous" type="button" aria-label="Previous photo" title="Previous photo">
					<calcite-icon icon="chevron-left" scale="l"></calcite-icon>
				</button>
				<img class="tyler-photo-fullscreen-image" alt="Parcel photo" />
				<button class="tyler-photo-fullscreen-nav next" type="button" aria-label="Next photo" title="Next photo">
					<calcite-icon icon="chevron-right" scale="l"></calcite-icon>
				</button>
				<div class="tyler-photo-fullscreen-count" aria-live="polite"></div>
			</div>
		`;

		const image = overlay.querySelector(".tyler-photo-fullscreen-image");
		const count = overlay.querySelector(".tyler-photo-fullscreen-count");
		const closeButton = overlay.querySelector(".tyler-photo-fullscreen-close");
		const previous = overlay.querySelector(".tyler-photo-fullscreen-nav.previous");
		const next = overlay.querySelector(".tyler-photo-fullscreen-nav.next");

		function showFullscreenPhoto(nextIndex)
		{
			fullscreenIndex = (nextIndex + photos.length) % photos.length;
			image.src = photos[fullscreenIndex];
			image.alt = `Parcel photo ${fullscreenIndex + 1}`;
			count.textContent = `${fullscreenIndex + 1} / ${photos.length}`;
			setActivePhoto(fullscreenIndex);
		}

		function closeFullscreenViewer()
		{
			document.documentElement.style.overflow = previousOverflow || "";
			window.removeEventListener("keydown", handleKeydown, true);
			overlay.remove();
			fullscreenButton?.focus({ preventScroll: true });
		}

		function handleKeydown(event)
		{
			if(event.key === "ArrowLeft")
			{
				event.preventDefault();
				showFullscreenPhoto(fullscreenIndex - 1);
			}
			else if(event.key === "ArrowRight")
			{
				event.preventDefault();
				showFullscreenPhoto(fullscreenIndex + 1);
			}
			else if(event.key === "Escape")
			{
				event.preventDefault();
				closeFullscreenViewer();
			}
		}

		closeButton.addEventListener("click", closeFullscreenViewer);
		previous.addEventListener("click", () => showFullscreenPhoto(fullscreenIndex - 1));
		next.addEventListener("click", () => showFullscreenPhoto(fullscreenIndex + 1));
		overlay.addEventListener("click", (event) =>
		{
			if(event.target === overlay) closeFullscreenViewer();
		});

		document.body.appendChild(overlay);
		document.documentElement.style.overflow = "hidden";
		window.addEventListener("keydown", handleKeydown, true);
		showFullscreenPhoto(fullscreenIndex);
		overlay.focus({ preventScroll: true });
	}

	function cycleSidebarPhoto(offset)
	{
		setActivePhoto((activeIndex + offset + photos.length) % photos.length);
	}

	function handleSidebarKeydown(event)
	{
		if(document.querySelector(".tyler-photo-fullscreen-overlay")) return;
		if(!viewerHasPointer && !viewer?.contains(document.activeElement)) return;

		if(event.key === "ArrowLeft")
		{
			event.preventDefault();
			cycleSidebarPhoto(-1);
		}
		else if(event.key === "ArrowRight")
		{
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
	container.__tylerPhotoViewerCleanup = () =>
	{
		window.removeEventListener("keydown", handleSidebarKeydown, true);
	};
	setActivePhoto(activeIndex);
}

export async function loadTylerPhotoViewer(container, parcelNumber, { shouldRender = () => true } = {})
{
	if(!container) return;

	container.__tylerPhotoViewerCleanup?.();
	container.__tylerPhotoViewerCleanup = null;

	container.innerHTML = `
	<div class="tyler-photo-loader" role="status" aria-live="polite" aria-label="Loading parcel photos">
		<div class="tyler-photo-loader-card">
			<div class="tyler-photo-loader-icon">
				<calcite-icon icon="image" scale="l"></calcite-icon>
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

	try
	{
		const photos = await fetchTylerParcelPhotos(parcelNumber);
		if(!shouldRender() || !container.isConnected) return;
		renderTylerPhotoViewer(container, photos);
	}
	catch(error)
	{
		if(!shouldRender() || !container.isConnected) return;
		container.innerHTML = `
			<div class="tyler-photo-empty">
				Photo lookup failed.
			</div>
		`;
		console.error(error);
	}
}
