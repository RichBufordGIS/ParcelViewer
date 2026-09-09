# Public Parcel Viewer module and function inventory

This inventory describes the current source, replacing the earlier proposed extraction plan. It lists named exported declarations for navigation; factory-returned methods, nested functions, event handlers and inline page scripts are not exhaustively listed.

See [credits](../CREDITS.md) for project contributions and the [maintenance guide](maintenance.md) for configuration and verification.

## Entry points and startup

Both [index.html](../index.html) and [indexinset.html](../indexinset.html) load [main.js](../js/main.js). Shared search markup and map tools are installed before their DOM references are collected. Startup loads ArcGIS modules, validates public resources, initializes the 2D map and optional 3D scene concurrently, and wires feature modules together. The inset page also contains its own layout and interaction code.

`main.js` retains a large startup block and shared state. Several legacy internal-page helpers remain even though their navigation is hidden in public mode. This is a source inventory, not a claim that all retained modules are active public features.

## JavaScript modules

| Module | Responsibility | Named exports |
| --- | --- | --- |
| [appShell.js](../js/appShell.js) | Shared public search markup installed for both viewer pages. | `installAppShell` |
| [buildingSelection.js](../js/buildingSelection.js) | Building/floor/condominium selection, camera navigation and workflow reset. | `initBuildingSelection` |
| [combobox.js](../js/combobox.js) | Combobox selection helpers retained for legacy analysis workflows. | `populateComboboxGroup`, `attachSelectAllLogic`, `attachSelectionListLogic` |
| [constants.js](../js/constants.js) | Service URLs, authentication defaults, item IDs, fields, limits, assets and colors. | `JCGIS_BASE`, `JCGIS_PORTAL_URL`, `MAX_SELECTED_PARCELS`, `ARCGIS_SERVICES_BASE`, `APP_AUTH`, `PORTAL_ITEM_IDS`, `SERVICE_URLS`, `APP_ASSETS`, `EXTERNAL_LINKS`, `CDN_URLS`, `USER_ACCOUNT_ASSET_BASES`, `TYLER`, `LAYER_TITLES`, `FIELDS`, `SEARCH_COLORS` |
| [controlStyling.js](../js/controlStyling.js) | Shared map-control styling and accessibility helpers. | `initControlStyling` |
| [errorUX.js](../js/errorUX.js) | Calcite notices and caught-error diagnostics. | `notifyUser`, `notifyError`, `notifyWarning`, `notifySuccess`, `logCaughtError`, `reportError` |
| [featureTable.js](../js/featureTable.js) | Feature-table helpers retained for legacy analysis workflows. | `createFeatureTable` |
| [gis-guided-walkthroughs.js](../js/gis-guided-walkthroughs.js) | Guided walkthrough page behavior. | No named exported declarations; page behavior or side effects. |
| [gis-help-page.js](../js/gis-help-page.js) | Help page behavior. | No named exported declarations; page behavior or side effects. |
| [helpTours.js](../js/helpTours.js) | Guided help-tour behavior. | `initHelpTours` |
| [helpWalkthroughContent.js](../js/helpWalkthroughContent.js) | Shared help-tour content. | `HELP_WALKTHROUGHS`, `renderHelpWalkthroughs` |
| [lrcForms.js](../js/lrcForms.js) | Split/combine request forms, readiness handling and layer submissions. | `initLrcForms` |
| [main.js](../js/main.js) | Application startup, public resource access, concurrent map initialization, module wiring, map/view switching and geometry helpers. | `initSpecialAssessment` |
| [mapInfoPanel.js](../js/mapInfoPanel.js) | Map-layer information panel. | No named exported declarations; page behavior or side effects. |
| [mapSetup.js](../js/mapSetup.js) | Map/layer initialization helpers. | `initMap` |
| [mapToolFactory.js](../js/mapToolFactory.js) | Shared ArcGIS/Calcite map-tool templates and installation. | `ensureMapToolTemplates`, `installMapTools`, `installParcelViewerTools`, `installPublicWorksTools`, `installPropertyAnalysisTools` |
| [measurementTools.js](../js/measurementTools.js) | Measurement tool state and controls. | `initMeasurementTools` |
| [oauth.js](../js/oauth.js) | OAuth helper retained for authenticated consumers; public startup uses an anonymous adapter. | `createPortalAuth` |
| [pageNavigation.js](../js/pageNavigation.js) | Page navigation helpers; internal-page navigation is hidden in public mode. | `initPageNavigation` |
| [parcelSelection.js](../js/parcelSelection.js) | Selected features, highlights, rectangle selection and cached batched owner/TCA lookups. | `initParcelSelection` |
| [portalAccess.js](../js/portalAccess.js) | Resource loading and access validation, including anonymous public resources. | `initPortalAccess` |
| [preloader.js](../js/preloader.js) | Startup progress display. | `createParcelPreloader` |
| [queryTable.js](../js/queryTable.js) | Query/table integration retained for legacy analysis workflows. | `groupFieldMap`, `buildComboboxWhereClause`, `attachQueryTableListener` |
| [rightPaneContent.js](../js/rightPaneContent.js) | Parcel detail queries, legal text, copy controls and photo viewing. | `buildParcelDetailsFrame`, `loadTylerPhotoViewer` |
| [searchParcels.js](../js/searchParcels.js) | Search sources, multiline input, suggestions, paste handling and result navigation. | `createParcelSearchController` |
| [selectedParcelUI.js](../js/selectedParcelUI.js) | Selection rows, parcel-detail staging, shared owner lookup results and search display synchronization. | `initSelectedParcelUI` |
| [sidebarUI.js](../js/sidebarUI.js) | Sidebar state and transition-completion resizing, including visible inset views. | `initSidebarUI` |
| [tabs-preview.js](../js/tabs-preview.js) | Retained tab-preview behavior. | No named exported declarations; page behavior or side effects. |
| [user-account-page.js](../js/user-account-page.js) | Retained account-page behavior; not evidence of a public account workflow. | No named exported declarations; page behavior or side effects. |
| [utils.js](../js/utils.js) | Parcel formatting, list parsing, duplicate feedback, identity and comparison helpers. | `normalizeTooltipText`, `humanizeControlId`, `isDashedParcel`, `isUndashed17DigitParcel`, `parseParcelBatch`, `getParcelBatchParseDetails`, `normalizeBatchParcelInput`, `formatParcelWithDashes`, `normalizeParcelForTyler`, `getSelectionKey`, `isRegular2DParcel`, `isCondo3DParcel`, `getParcelDisplayName`, `getTylerLookupValue`, `normalizeCompareValue`, `getCompareStatus` |

## Important factory-returned methods

- `initParcelSelection()` supplies selection state, selection mutation, rectangle selection, `getTylerDataByParcel()` and `getTylerDataByParcels()`.
- `initSelectedParcelUI()` supplies selection rendering, panel open/close, clear-all and search synchronization.
- `initBuildingSelection()` supplies building/floor/parcel navigation and reset behavior.
- `initSidebarUI()` supplies sidebar state changes and resize scheduling.
- `createParcelSearchController()` supplies page-specific search setup, match lookup and result focus.
- `initLrcForms()` supplies split/combine form entry points.

Consult each factory return statement for its exact current interface before changing a caller.

## Supporting files

- `css/main.css`, `css/mobile.css` and page-local styles define the application and inset layouts.
- `css/search.css` styles the shared multiline search, suggestions and notices.
- `css/preloader.css` and `css/tylerPhotoViewer.css` style startup and photo viewing.
- [tests/public-port.test.mjs](../tests/public-port.test.mjs) checks parsing, owner lookups, sidebar resizing, syntax/imports and entry-point wiring.

## Updating this inventory

When adding or moving a module, update its responsibility and exported names here. Avoid approximate line numbers and future-tense extraction plans that can become stale. Keep the distinction between shared public behavior and retained legacy helpers explicit.
