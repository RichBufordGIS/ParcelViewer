function initializeMapInfoPanel({
	settingsBtnId = "settingsBtn",
	panelId = "settingsPanel",
	contentId = "settingsContent",
	closeBtnId = "settingsCloseBtn",
	tabButtonsId = "settingsTabButtons",
	pageDefinitions = [],
	getLoadedResource
}) {
	const settingsBtn = document.getElementById(settingsBtnId);
	const settingsPanel = document.getElementById(panelId);
	const settingsContent = document.getElementById(contentId);
	const settingsCloseBtn = document.getElementById(closeBtnId);
	const settingsTabButtons = document.getElementById(tabButtonsId);
	const settingsPanelShell = settingsPanel?.querySelector(".map-info-panel-shell") || settingsPanel;

	if (!settingsBtn || !settingsPanel || !settingsContent || !settingsTabButtons) {
		console.warn("Map info panel elements not found.", {
			settingsBtn,
			settingsPanel,
			settingsContent,
			settingsCloseBtn,
			settingsTabButtons
		});
		return;
	}

	let selectedPageKey = pageDefinitions[0]?.key || null;
	const cachedHtmlByPageKey = {};
	const pendingHtmlByPageKey = {};

	buildTabButtons();

	settingsBtn.addEventListener("click", async (e) => {
		e.stopPropagation();

		const isHidden = settingsPanel.classList.contains("hidden");

		if (isHidden) {
			settingsPanel.classList.remove("hidden");
			settingsBtn.classList.add("active");
			await showPageContent(selectedPageKey);
		} else {
			settingsPanel.classList.add("hidden");
			settingsBtn.classList.remove("active");
		}
	});

	if (settingsCloseBtn) {
		settingsCloseBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			settingsPanel.classList.add("hidden");
			settingsBtn.classList.remove("active");
		});
	}

	settingsPanel.addEventListener("click", (e) => {
		if (e.target === settingsPanel) {
			settingsPanel.classList.add("hidden");
			settingsBtn.classList.remove("active");
			return;
		}

		if (settingsPanelShell.contains(e.target)) {
			e.stopPropagation();
		}
	});

	document.addEventListener("click", (e) => {
		const clickedInsidePanel = settingsPanel.contains(e.target);
		const clickedSettingsBtn = settingsBtn.contains(e.target);

		if (!clickedInsidePanel && !clickedSettingsBtn) {
			settingsPanel.classList.add("hidden");
			settingsBtn.classList.remove("active");
		}
	});

	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape") {
			settingsPanel.classList.add("hidden");
			settingsBtn.classList.remove("active");
		}
	});

	async function showPageContent(pageKey) {
		if (!pageKey) {
			settingsContent.innerHTML = `<div class="map-info-message">No page selected.</div>`;
			return;
		}

		if (cachedHtmlByPageKey[pageKey]) {
			settingsContent.innerHTML = cachedHtmlByPageKey[pageKey];
			return;
		}

		settingsContent.innerHTML = pendingHtmlByPageKey[pageKey]
			? `<div class="map-info-message">Finishing map information...</div>`
			: `<div class="map-info-message">Loading map information...</div>`;

		try {
			const html = await loadPageHtml(pageKey);
			settingsContent.innerHTML = html;
		} catch (err) {
			console.error("Failed to build map info panel:", err);
			settingsContent.innerHTML = `<div class="map-info-message map-info-error">Unable to load map information.</div>`;
		}
	}

	function loadPageHtml(pageKey) {
		if (cachedHtmlByPageKey[pageKey]) return Promise.resolve(cachedHtmlByPageKey[pageKey]);
		if (pendingHtmlByPageKey[pageKey]) return pendingHtmlByPageKey[pageKey];

		const pageDef = pageDefinitions.find(p => p.key === pageKey);
		if (!pageDef) {
			return Promise.reject(new Error("Page definition not found."));
		}

		pendingHtmlByPageKey[pageKey] = buildPageHtml(pageDef, getLoadedResource)
			.then((result) => {
				const html = typeof result === "string" ? result : result.html;
				const complete = typeof result === "string" ? true : result.complete;

				if (complete) {
					cachedHtmlByPageKey[pageKey] = html;
				}

				return html;
			})
			.finally(() => {
				delete pendingHtmlByPageKey[pageKey];
			});

		return pendingHtmlByPageKey[pageKey];
	}

	function preloadPage(pageKey) {
		if (!pageKey || cachedHtmlByPageKey[pageKey] || pendingHtmlByPageKey[pageKey]) return;

		loadPageHtml(pageKey).catch((err) => {
			console.warn("Map info preload failed.", pageKey, err);
		});
	}

	function preloadAllPages({ staggerMs = 700 } = {}) {
		pageDefinitions.forEach((pageDef, index) => {
			window.setTimeout(() => preloadPage(pageDef.key), index * staggerMs);
		});
	}

	function buildTabButtons() {
		if (pageDefinitions.length <= 1) {
			settingsTabButtons.hidden = true;
			settingsTabButtons.innerHTML = "";
			return;
		}

		settingsTabButtons.hidden = false;
		settingsTabButtons.innerHTML = pageDefinitions.map((pageDef, index) => `
			<button
				type="button"
				class="map-info-tab-btn${index === 0 ? " active" : ""}"
				data-page-key="${escapeHtml(pageDef.key)}">
				${escapeHtml(getPageLabel(pageDef))}
			</button>
		`).join("");

		settingsTabButtons.querySelectorAll(".map-info-tab-btn").forEach(btn => {
			btn.addEventListener("click", async () => {
				selectedPageKey = btn.dataset.pageKey;

				settingsTabButtons.querySelectorAll(".map-info-tab-btn").forEach(tabBtn => {
					tabBtn.classList.remove("active");
				});

				btn.classList.add("active");
				await showPageContent(selectedPageKey);
			});
		});
	}

	return {
		preloadPage,
		preloadAllPages,
		showPageContent
	};
}

async function buildPageHtml(pageDef, getLoadedResource) {
	const sections = [];
	let hasUnloadedResources = false;

		const sortedResources = [...(pageDef.resources || [])].sort((a, b) => {
		const aIsWebMap = a?.resourceType === "webmap" ? 1 : 0;
		const bIsWebMap = b?.resourceType === "webmap" ? 1 : 0;

		if (aIsWebMap !== bIsWebMap) {
			return aIsWebMap - bIsWebMap;
		}

		return String(a?.title || "").localeCompare(String(b?.title || ""));
		});

		for (let i = 0; i < sortedResources.length; i++) {
			const resource = sortedResources[i];

		try {
			const loadedMap = typeof getLoadedResource === "function"
				? getLoadedResource(pageDef.key, i, resource)
				: null;

			if (!loadedMap) {
				sections.push(`
					<div class="map-info-card">
						<h3 class="map-info-card-title">${escapeHtml(resource?.title || "Untitled Resource")}</h3>
						<div class="map-info-message">Map is not loaded yet.</div>
					</div>
				`);
				hasUnloadedResources = true;
				continue;
			}

			if (typeof loadedMap.load === "function") {
				await loadedMap.load();
			}

			const layerInfos = [];

			const topLevelLayers = loadedMap.layers?.toArray?.() || [];
			const basemapLayerIds = new Set([
				...(loadedMap.basemap?.baseLayers?.toArray?.().map(l => l.id) || []),
				...(loadedMap.basemap?.referenceLayers?.toArray?.().map(l => l.id) || [])
			]);
			const mapTables = loadedMap.tables?.toArray?.() || [];

			for (const layer of topLevelLayers) {
				await collectLayerInfo(layer, layerInfos, "", basemapLayerIds, false);
			}

			for (const table of mapTables) {
				await collectLayerInfo(table, layerInfos, "", basemapLayerIds, true);
			}

			layerInfos.sort((a, b) => {
				const aCount = Number.isFinite(Number(a.featureCount)) ? Number(a.featureCount) : -1;
				const bCount = Number.isFinite(Number(b.featureCount)) ? Number(b.featureCount) : -1;

				if (bCount !== aCount) {
					return bCount - aCount;
				}

				return String(a.title || "").localeCompare(String(b.title || ""));
			});

			const resourceMetadata = await getResourcePortalMetadata(loadedMap, resource);
			const owner = resourceMetadata.owner || "";
			const updated = formatDate(resourceMetadata.modified);
			const itemId = resourceMetadata.itemId || resource?.itemId || "";
			const title = resource?.title || loadedMap?.portalItem?.title || "Untitled Resource";
			const type = resource?.resourceType || resourceMetadata.type || "";

			sections.push(`
				<div class="map-info-card">
					<h3 class="map-info-card-title">${escapeHtml(title)}</h3>
					<div class="map-info-row"><strong>Type:</strong> ${escapeHtml(type)}</div>
					<div class="map-info-row"><strong>Owner:</strong> ${escapeHtml(owner)}</div>
					<div class="map-info-row"><strong>Last Activity:</strong> ${escapeHtml(updated)}</div>
					<div class="map-info-row"><strong>Item ID:</strong> ${escapeHtml(itemId)}</div>
					<div class="map-info-row"><strong>Item Count:</strong> ${layerInfos.length}</div>

					<div class="map-info-layer-list">
						${layerInfos.length
							? layerInfos.map(renderLayerInfo).join("")
							: `<div class="map-info-message">No layers or tables found.</div>`}
					</div>
				</div>
			`);
		} catch (err) {
			console.error(`Failed to load resource ${resource?.title || "(untitled resource)"}`, err);

			sections.push(`
				<div class="map-info-card">
					<h3 class="map-info-card-title">${escapeHtml(resource?.title || "Untitled Resource")}</h3>
					<div class="map-info-message map-info-error">Failed to load metadata for this resource.</div>
				</div>
			`);
		}
	}

	if (!sections.length) {
		return {
			html: `<div class="map-info-message">No resources found.</div>`,
			complete: true
		};
	}

	return {
		html: sections.join(""),
		complete: !hasUnloadedResources
	};
}

async function collectLayerInfo(layer, results, parentTitle = "", basemapLayerIds = new Set(), forceTable = false) {
	try {
		if (typeof layer.load === "function") {
			await layer.load();
		}
		if (layer.type === "graphics") {
			return;
		}

		const isBasemapLayer = basemapLayerIds.has(layer.id);
		const isTable = forceTable || layer.isTable === true || layer.type === "table";

		if (layer.type === "group" && layer.layers) {
			const childLayers = layer.layers.toArray();
			for (const child of childLayers) {
				await collectLayerInfo(child, results, layer.title || parentTitle, basemapLayerIds, false);
			}
			return;
		}

		let owner = "";
		let updated = "";
		let itemId = "";
		let dataLastEditDate = "";
		const portalMetadata = await getLayerPortalMetadata(layer);
		owner = portalMetadata.owner || "";
		updated = formatDate(portalMetadata.modified);
		itemId = portalMetadata.itemId || "";

		let featureCount = "";
		if (!isTable && typeof layer.queryFeatureCount === "function") {
			try {
				featureCount = await layer.queryFeatureCount();
			} catch (countErr) {
				featureCount = "";
			}
		}

		dataLastEditDate = await getLayerDataLastEditDate(layer);

		const displayTitle = getLayerDisplayTitle(layer, {
			isBasemapLayer,
			isTable
		});

		results.push({
			title: displayTitle,
			type: getLayerDisplayType(layer, { isBasemapLayer, isTable }),
			category: isTable ? "Table" : (isBasemapLayer ? "Basemap" : "Operational"),
			parentTitle,
			owner,
			updated,
			dataLastEditDate,
			itemId,
			url: layer.url || "",
			featureCount,
			isBasemapLayer,
			isTable
		});
	} catch (err) {
		console.warn("Layer metadata load failed:", err);

		const isBasemapLayer = basemapLayerIds.has(layer?.id);
		const isTable = forceTable || layer?.isTable === true || layer?.type === "table";

		results.push({
			title: getLayerDisplayTitle(layer, { isBasemapLayer, isTable }),
			type: getLayerDisplayType(layer, { isBasemapLayer, isTable }),
			category: isTable ? "Table" : (isBasemapLayer ? "Basemap" : "Operational"),
			parentTitle,
			owner: "",
			updated: "",
			dataLastEditDate: "",
			itemId: "",
			url: layer?.url || "",
			featureCount: "",
			isBasemapLayer,
			isTable
		});
	}
}

async function getResourcePortalMetadata(resourceOrMap, resource = null) {
	const directPortalItem = resourceOrMap?.portalItem || null;

	if (directPortalItem) {
		const loaded = await loadPortalItemMetadata(directPortalItem);
		if (loaded.owner || loaded.itemId || loaded.modified || loaded.type) {
			return loaded;
		}
	}

	const resourceItemId =
		resource?.itemId ||
		resourceOrMap?.sourceJSON?.portalItem?.id ||
		resourceOrMap?.sourceJSON?.itemId ||
		"";
	const portalUrl =
		resource?.portalUrl ||
		resourceOrMap?.portalItem?.portal?.url ||
		resourceOrMap?.portal?.url ||
		"";

	if (!resourceItemId) {
		return {
			owner: "",
			modified: "",
			itemId: "",
			type: ""
		};
	}

	const fallbackItem = await loadPortalItemById(resourceItemId, portalUrl);
	return {
		owner: fallbackItem.owner || "",
		modified: fallbackItem.modified || "",
		itemId: fallbackItem.itemId || resourceItemId,
		type: fallbackItem.type || ""
	};
}

async function getLayerPortalMetadata(layer) {
	const portalItemMetadata = await loadPortalItemMetadata(layer?.portalItem);
	if (portalItemMetadata.owner || portalItemMetadata.itemId || portalItemMetadata.modified) {
		return portalItemMetadata;
	}

	const sourcePortalItemId =
		layer?.sourceJSON?.portalItem?.id ||
		layer?.sourceJSON?.serviceItemId ||
		layer?.sourceJSON?.itemId ||
		layer?.portalItem?.id ||
		"";
	const sourceOwner =
		layer?.sourceJSON?.portalItem?.owner ||
		layer?.sourceJSON?.copyrightText ||
		"";
	const portalUrl =
		layer?.portalItem?.portal?.url ||
		layer?.portal?.url ||
		layer?.sourceJSON?.portalUrl ||
		"";

	if (!sourcePortalItemId) {
		return {
			owner: sourceOwner || "",
			modified: "",
			itemId: "",
			type: ""
		};
	}

	const fallbackItem = await loadPortalItemById(sourcePortalItemId, portalUrl);
	return {
		owner: fallbackItem.owner || sourceOwner || "",
		modified: fallbackItem.modified || "",
		itemId: fallbackItem.itemId || sourcePortalItemId,
		type: fallbackItem.type || ""
	};
}

async function loadPortalItemMetadata(portalItem) {
	if (!portalItem) {
		return {
			owner: "",
			modified: "",
			itemId: "",
			type: ""
		};
	}

	try {
		if (typeof portalItem.load === "function") {
			await portalItem.load();
		}

		return {
			owner: portalItem.owner || "",
			modified: portalItem.modified || "",
			itemId: portalItem.id || "",
			type: portalItem.type || ""
		};
	} catch (portalItemErr) {
		console.warn("Could not load portal item metadata.", portalItem?.id || portalItem?.title, portalItemErr);
		return {
			owner: portalItem?.owner || "",
			modified: portalItem?.modified || "",
			itemId: portalItem?.id || "",
			type: portalItem?.type || ""
		};
	}
}

let portalClassesPromise = null;

async function getPortalClasses() {
	if (!portalClassesPromise) {
		portalClassesPromise = $arcgis.import([
			"@arcgis/core/portal/Portal.js",
			"@arcgis/core/portal/PortalItem.js"
		]);
	}

	return portalClassesPromise;
}

async function loadPortalItemById(itemId, portalUrl = "") {
	if (!itemId) {
		return {
			owner: "",
			modified: "",
			itemId: "",
			type: ""
		};
	}

	try {
		const [Portal, PortalItem] = await getPortalClasses();
		const portalItem = new PortalItem({
			id: itemId,
			portal: portalUrl ? new Portal({ url: portalUrl }) : undefined
		});
		await portalItem.load();

		return {
			owner: portalItem.owner || "",
			modified: portalItem.modified || "",
			itemId: portalItem.id || itemId,
			type: portalItem.type || ""
		};
	} catch (err) {
		console.warn("Could not load fallback portal item.", itemId, err);
		return {
			owner: "",
			modified: "",
			itemId,
			type: ""
		};
	}
}

async function getLayerDataLastEditDate(layer) {
	try {
		const epoch =
			layer?.editingInfo?.lastEditDate ||
			layer?.sourceJSON?.editingInfo?.lastEditDate ||
			layer?.parsedUrl?.sourceJSON?.editingInfo?.lastEditDate;

		if (!epoch) {
			return "";
		}

		return formatDate(epoch);
	} catch (err) {
		console.warn("Failed to read data last edit date from layer object.", layer?.title, err);
		return "";
	}
}

function getLayerDisplayTitle(layer, { isBasemapLayer = false, isTable = false } = {}) {
	const candidates = [
		layer?.title,
		layer?.portalItem?.title,
		layer?.sourceJSON?.title,
		layer?.sourceJSON?.name,
		layer?.layerDefinition?.name,
		layer?.parsedUrl?.path,
		layer?.url ? layer.url.split("/").filter(Boolean).pop() : "",
		layer?.id
	]
		.map(v => String(v || "").trim())
		.filter(Boolean);

	if (candidates.length) {
		return candidates[0];
	}

	if (isTable) {
		return "Table";
	}

	if (isBasemapLayer) {
		return "Basemap Layer";
	}

	return "Untitled Layer";
}

function getLayerDisplayType(layer, { isBasemapLayer = false, isTable = false } = {}) {
	if (isTable) return "Table";
	if (isBasemapLayer) return `Basemap ${layer?.type ? `(${layer.type})` : ""}`.trim();
	return layer?.type || "";
}

function renderLayerInfo(layer) {
	return `
		<div class="map-info-layer-card">
			<div class="map-info-layer-title">${escapeHtml(layer.title)}</div>
			<div class="map-info-row"><strong>Type:</strong> ${escapeHtml(layer.type)}</div>
			${layer.owner ? `<div class="map-info-row"><strong>Owner:</strong> ${escapeHtml(layer.owner)}</div>` : ""}
			${layer.itemId ? `<div class="map-info-row"><strong>Item ID:</strong> ${escapeHtml(layer.itemId)}</div>` : ""}
			${layer.updated ? `<div class="map-info-row"><strong>Last Activity:</strong> ${escapeHtml(layer.updated)}</div>` : ""}
			${layer.dataLastEditDate ? `<div class="map-info-row"><strong>Data Updated:</strong> ${escapeHtml(layer.dataLastEditDate)}</div>` : ""}
			${layer.url ? `<div class="map-info-row map-info-url-row"><strong>URL:</strong> <a href="${escapeAttribute(layer.url)}" target="_blank">Open service</a></div>` : ""}
		</div>
	`;
}

function getPageLabel(pageDef) {
	switch (pageDef.key) {
		case "parcel":
			return "Parcel";
		case "pw":
			return "Public Works";
		case "sa":
			return "Property Analysis";
		default:
			return pageDef.key || "Page";
	}
}

function formatDate(value) {
	if (!value) return "";
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

function escapeHtml(value) {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
	return escapeHtml(value);
}

window.initializeMapInfoPanel = initializeMapInfoPanel;
