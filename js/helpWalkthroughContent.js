export const HELP_WALKTHROUGHS = [
	{
		id: "search-parcel-number",
		title: "Search by parcel number",
		description: "Type or paste a parcel number, then select the matching parcel result.",
		icon: "magnifying-glass",
		actionLabel: "Start walkthrough"
	},
	{
		id: "search-full-address",
		title: "Search by full address",
		description: "Use the full street, city, state, and ZIP when the address is known.",
		icon: "locator",
		actionLabel: "Start walkthrough"
	},
	{
		id: "copy-details",
		title: "Copy parcel details",
		description: "Learn where parcel number, address, owner, and legal description copy buttons appear after a parcel is selected.",
		icon: "duplicate",
		actionLabel: "Start walkthrough"
	},
	{
		id: "select-multiple",
		title: "Select multiple parcels",
		description: "Use the rectangle selection workflow to add more than one parcel to the selected parcel list.",
		icon: "cursor-selection",
		actionLabel: "Start walkthrough"
	},
	{
		id: "view-mode",
		title: "Use 2D / 3D",
		description: "Find the 2D / 3D control and understand when Parcel Viewer changes views for condo workflows.",
		icon: "3d-glasses",
		actionLabel: "Start walkthrough"
	},
	{
		id: "map-layer-info",
		title: "Open map layer info",
		description: "Review the map, scene, layers, tables, ownership, and service links loaded on each app tab.",
		icon: "book",
		actionLabel: "Start walkthrough"
	}
];

function renderAppPreview() {
	return `
		<div class="app-preview" aria-hidden="true">
			<div class="app-preview-header">
				<div class="app-preview-brand">
					<img src="https://jcgis.jacksongov.org/images/jackson-county-logo.png" alt="">
					<div>
						<div class="app-preview-title">Parcel Viewer</div>
						<div class="app-preview-subtitle">Internal</div>
					</div>
				</div>
				<div class="app-preview-tabs">
					<div class="app-preview-tab active"><calcite-icon icon="parcel-layer" scale="s"></calcite-icon><span>Parcel Viewer</span></div>
					<div class="app-preview-tab"><calcite-icon icon="wrench" scale="s"></calcite-icon><span>Public Works</span></div>
					<div class="app-preview-tab"><calcite-icon icon="chart-magnifying-glass" scale="s"></calcite-icon></div>
				</div>
				<div class="app-preview-search">
					<calcite-icon icon="magnifying-glass" scale="s"></calcite-icon>
					<span>2423 INDEPENDENCE AVE KANSAS CITY, MO 64124</span>
				</div>
			</div>
			<div class="app-preview-body">
				<div class="app-preview-map">
					<div class="app-preview-road horizontal"></div>
					<div class="app-preview-road vertical"></div>
					<div class="app-preview-parcel one"></div>
					<div class="app-preview-parcel two"></div>
					<div class="app-preview-result">
						<div>2423 INDEPENDENCE AVE</div>
						<span>Kansas City, MO 64124</span>
					</div>
					<div class="app-preview-controls left">
						<span>+</span>
						<span></span>
						<span>-</span>
					</div>
					<div class="app-preview-controls right">
						<span></span>
						<span></span>
						<span></span>
					</div>
					<div class="app-preview-cursor"></div>
				</div>
				<div class="app-preview-sidebar">
					<div class="app-preview-sidebar-title">Parcel Details</div>
					<div class="app-preview-field wide"></div>
					<div class="app-preview-field"></div>
					<div class="app-preview-field short"></div>
				</div>
			</div>
		</div>
	`;
}

function renderWalkthroughItem(walkthrough) {
	return `
		<button class="help-walkthrough-item" type="button" data-tour-id="${walkthrough.id}">
			<div class="help-walkthrough-icon"><calcite-icon icon="${walkthrough.icon}" scale="s"></calcite-icon></div>
			<div class="help-walkthrough-copy">
				<h4>${walkthrough.title}</h4>
				<p>${walkthrough.description}</p>
			</div>
			<span class="help-walkthrough-complete" aria-label="Completed">
				<calcite-icon icon="check" scale="s"></calcite-icon>
			</span>
			<calcite-icon class="help-walkthrough-next" icon="chevron-right" scale="s"></calcite-icon>
		</button>
	`;
}

export function renderHelpWalkthroughs(container) {
	if (!container) return;
	container.innerHTML = `
		<div class="help-walkthrough-layout">
			${renderAppPreview()}
			<div class="help-walkthrough-list">
				${HELP_WALKTHROUGHS.map(renderWalkthroughItem).join("")}
			</div>
		</div>
	`;
}
