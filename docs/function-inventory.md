# main.js Function Inventory

**File**: `js/main.js`  
**Total lines**: ~4,550  
**Module pattern**: ES6 modules + ArcGIS dynamic imports (`$arcgis.import`)  
**Architecture note**: Nearly all code executes inside a top-level `try { }` block after ArcGIS modules are loaded. Functions close over shared state declared in that block. The one named `export` is `initSpecialAssessment()` at the top of the file (before the main block).

---

## Module-Level State Variables

These are the shared variables that cross function boundaries. Each proposed module will receive only the subset it needs via its factory `init*()` call.

| Variable | Type | Purpose | Proposed Owner |
|---|---|---|---|
| `specialAssessmentInitPromise` | `Promise\|null` | Caches the SA module init so it only runs once | `main.js` |
| `preloader` | `object` | Preloader instance for loading screen | `main.js` |
| `appAuth` | `object` | Portal OAuth auth instance (from `createPortalAuth`) | `portalAccess.js` |
| `ACCOUNT_PAGE_EMBED_URL` | `string` | URL of the embedded account page iframe | `main.js` (auth UI) |
| `rectangleSelectionActive` | `boolean` | Whether rectangle selection sketch is running | `main.js` |
| `accessiblePageKeys` | `string[]` | Page keys the signed-in user can access | `portalAccess.js` |
| `saModuleInitPromise` | `Promise\|null` | Prevents double-init of SA tab | `main.js` |
| `activeView` | `MapView\|SceneView` | The currently active 2D or 3D view | `main.js` |
| `leftSidebarCollapsed` | `boolean` | Left sidebar open/closed state | `sidebarUI.js` |
| `sidebarResizePulseId` | `number` | `requestAnimationFrame` ID for sidebar resize loop | `sidebarUI.js` |
| `rightSidebarCollapsed` | `boolean` | Right sidebar open/closed state | `sidebarUI.js` |
| `rightSidebarResizeTimer` | `number\|null` | `setTimeout` ID for right sidebar resize debounce | `sidebarUI.js` |
| `pwLoaded` | `boolean` | Whether the Public Works map has been lazy-loaded | `main.js` |
| `saLoaded` | `boolean` | Whether the Property Analysis map has been lazy-loaded | `main.js` |
| `parcelListSelectedOIDs` | `Set` | OIDs of selected parcels in the list UI | `parcelSelection.js` |
| `highlightedParcels` | `Map<string, handle>` | Layer highlight handles keyed by selection key | `parcelSelection.js` |
| `tylerExtractTable` | `FeatureLayer\|null` | Tyler Extract table reference for owner/tax lookup | `parcelSelection.js` |
| `currentPage` | `string` | Active page key: `"parcel"`, `"pw"`, or `"sa"` | `main.js` |
| `tylerLookupCache` | `Map<string, object>` | Cached Tyler owner/tax results keyed by parcel ID | `parcelSelection.js` |
| `selectedParcels` | `object[]` | Currently selected ArcGIS features | `parcelSelection.js` |
| `selectedParcelRenderVersion` | `number` | Render version counter; stale async renders bail out | `selectedParcelUI.js` |
| `currentBuildingExtent` | `Extent\|null` | Extent of the currently selected 3D building | `buildingSelection.js` |
| `currentBuildingWhere` | `string\|null` | SQL WHERE clause scoping queries to the active building | `buildingSelection.js` |
| `allFeaturesForBuilding` | `object[]` | All condo features for the selected building | `buildingSelection.js` |
| `condoLayer` | `FeatureLayer\|null` | 3D "Parcel Condominiums" layer | `main.js` (set by `refreshLayerRefs`) |
| `regularParcelLayer` | `FeatureLayer\|null` | 2D "Parcels" layer | `main.js` (set by `refreshLayerRefs`) |
| `parcelLayer` | `FeatureLayer\|null` | Alias for `condoLayer` (active parcel layer) | `main.js` |
| `floorLayer` | `FeatureLayer\|null` | 3D "Parcel Condominiums Floors" layer | `main.js` |
| `lrcRequestLayer` | `FeatureLayer\|null` | "Land Records Change Request" feature layer | `lrcForms.js` |
| `lrcFormFeature` | `Graphic\|null` | Graphic staged for the current LRC form submission | `lrcForms.js` |
| `lrcFeatureFormEl` | `Element\|null` | `<arcgis-feature-form>` element (currently unused as module var) | `lrcForms.js` |
| `ESRILayer` | `FeatureLayer\|null` | "Esri 3D Buildings" layer | `main.js` |
| `KansasCityLayer`, `MissouriLayer`, `MajorCitiesLayer`, `JacksonCountyMaskLayer` | `FeatureLayer\|null` | Reference/context layers hidden from list | `main.js` |
| `ParcelCondominiumsFloors3DLayer` | `FeatureLayer\|null` | 3D floors reference layer | `main.js` |
| `addressLayer2d`, `addressLayer3d` | `FeatureLayer\|null` | Address layers for 2D and 3D views | `main.js` |
| `parcelLayerView`, `floorLayerView`, `regularParcelLayerView` | `LayerView` | LayerViews used for highlight operations | `parcelSelection.js` |
| `searchController` | `object` | Search controller returned by `createParcelSearchController` | `main.js` |
| `sceneView`, `mapView` | `SceneView, MapView` | The 2D and 3D map view instances | `main.js` |
| `lrmLayer2d`, `lrmLayer3d` | `FeatureLayer\|null` | "Land Records Change Request" layers (duplicates `lrcRequestLayer`) | `main.js` |
| `polygonGraphicsLayer` | `GraphicsLayer` | Graphics layer used for rectangle selection sketch | `main.js` |
| `sketchViewModel2d` | `SketchViewModel` | SketchViewModel driving rectangle selection | `main.js` |
| `activeMeasure2dTool` | `string` | Active 2D measurement tool: `"line"` or `"area"` | `measurementTools.js` |
| `activeMeasure3dTool` | `string` | Active 3D measurement tool: `"line"` or `"area"` | `measurementTools.js` |
| `resolvedSearchDisplayActive` | `boolean` | Unused / reserved | `main.js` |

---

## DOM Element References

All cached as `const` declarations near the top of the main block. Listed here for completeness; each proposed module will receive only what it needs.

**Tab buttons**: `parcelViewerTabBtn`, `publicWorksTabBtn`, `specialAssessTabBtn`  
**Badges**: `selectedParcelBadge2d`, `selectedParcelBadge3d`  
**Content slots**: `selectedParcelContent2d`, `selectedParcelContent3d`  
**Left sidebar**: `leftSidebarShell`, `leftSidebarToggle`, `leftSidebarToggleIcon`  
**Right sidebar**: `rightSidebarShell`, `rightSidebar`, `rightSidebarContent`, `rightSidebarToggle`, `rightSidebarToggleIcon`  
**Clear buttons**: `clearSelectedParcelsButton2d`, `clearSelectedParcelsButton3d`  
**Zoom buttons**: `zoomInBtn2d`, `zoomOutBtn2d`, `zoomInBtn3d`, `zoomOutBtn3d`  
**Pages**: `pageParcel`, `pagePW`, `pageSA`  
**Search**: `searchEl`  
**View mode toggle**: `viewModeToggle`, `viewModeSwitch`  
**Rectangle select**: `rectangleSelectBtn`, `rectangleToolPopover`, `rectangleSelectStartBtn`, `rectangleSelectStopBtn`  
**2D measurement**: `distanceMeasure2d`, `areaMeasure2d`, `measure2dLineShell`, `measure2dAreaShell`, `measure2dLineOptionBtn`, `measure2dAreaOptionBtn`, `measure2dStartBtn`, `measure2dStopBtn`, `measure2dSubtitle`  
**3D measurement**: `lineMeasure3d`, `areaMeasure3d`, `measure3dLineShell`, `measure3dAreaShell`, `measure3dLineOptionBtn`, `measure3dAreaOptionBtn`, `measure3dStartBtn`, `measure3dStopBtn`, `measure3dSubtitle`  
**Map elements**: `sceneEl`, `mapEl`, `pwMapEl`, `saMapEl`  
**Map controls**: `home2d`, `home3d`, `compass2d`, `compass3d`, `navigationToggle3d`  
**Auth overlay**: `authOverlay`, `authOverlayTitle`, `authOverlayDescription`, `authPrimaryBtn`, `authPrimaryBtnIcon`, `authPrimaryBtnLabel`, `splashNotice`  
**Help overlay**: `helpBtn`, `helpOverlay`, `helpOverlayFrame`, `helpOverlayCloseBtn`  
**User auth**: `userAuthBtn`, `userAuthBackdrop`, `userAuthLabel`, `userAuthLicense`, `userAuthLicenseSymbol`, `userAuthLicensePlus`, `userAuthName`, `userAuthTypeBadge`, `userAuthMenu`, `userAuthMenuFrame`  
**Building/Floor/Parcel lists**: `buildingListEl`, `floorListEl`, `parcelListEl`, `buildingSearchEl`, `parcelSearchEl`  
**Selected parcel panel**: `selectedParcelContentEl`, `launchBtn`

---

## Function Inventory

### Special Assessment (SA) Bootstrap — stays in `main.js`

| Function | ~Line | Parameters | Returns | Description | State Read | State Written |
|---|---|---|---|---|---|---|
| `setSpecialAssessmentUnavailable` | 25 | `message: string` | `void` | Disables SA combobox/table and shows an error message | — | DOM only |
| `clearSpecialAssessmentUnavailableState` | 42 | — | `void` | Re-enables SA combobox and restores table visibility | — | DOM only |
| `initSpecialAssessment` | 57 | — | `Promise` | Exported. Lazy-initializes the full SA tab (map, feature table, comboboxes). Cached so it only runs once. | `specialAssessmentInitPromise` | `specialAssessmentInitPromise` |

---

### Authentication & Portal Access — proposed `portalAccess.js`

| Function | ~Line | Parameters | Returns | Description | State Read | State Written |
|---|---|---|---|---|---|---|
| `normalizeUsername` | 340 | `value: any` | `string` | Lowercases and trims a username string for safe comparison | — | — |
| `isOwnerMatch` | 345 | `ownerUsername, currentUsername` | `boolean` | Checks if two usernames match after normalization | — | — |
| `formatAuthDisplayName` | 350 | `user: object` | `string` | Returns `fullName` or falls back to `username` | — | — |
| `formatPreloaderIdentity` | 356 | `user: object` | `string` | Formats user display string for the preloader (name + email) | — | — |
| `collectHeaderProfileStringValues` | 365 | `user, keys: string[]` | `string[]` | Collects and deduplicates profile string values for license detection | — | — |
| `getHeaderLicenseFromProfileValues` | 396 | `values: string[]` | `object\|null` | Matches combined profile text against known license tier strings | — | — |
| `getHeaderUserLicensePresentation` | 411 | `user: object` | `object\|null` | Derives license presentation (label, icon, color) from user profile | — | — |
| `getHeaderAccountTypeLabel` | 421 | `user, license` | `string` | Derives a human-readable account type label | — | — |
| `renderHeaderUserSummary` | 438 | `user: object` | `void` | Updates header auth badge UI with license/type info | — | DOM (`userAuthLicense`, `userAuthTypeBadge`, etc.) |
| `isGroupSharedAccess` | 1016 | `accessValue: any` | `boolean` | Returns true if access level is `"shared"` or `"groups"` | — | — |
| `getItemGroupSharing` | 1024 | `resource: object` | `Promise<object>` | Queries Portal REST API for item group membership | `APP_AUTH_CONFIG` | — |
| `evaluatePortalSharingPolicy` | 1042 | `resource, portalItem` | `Promise<object>` | Determines if the signed-in user can access the portal item | `appAuth` | — |
| `applyPortalItemAccess` | 1091 | `element, resource` | `void` | Sets `item-id` / `portal-url` attributes (or `.map`) on a map element | `APP_AUTH_CONFIG` | DOM attributes |
| `validatePortalResource` | 1159 | `resource: object` | `Promise<object>` | Full validation: loads Portal + PortalItem + WebMap/WebScene, evaluates sharing | `appAuth`, `APP_AUTH_CONFIG` | — |
| `validatePageAccess` | 1224 | `definitions: array` | `Promise<array>` | Calls `validatePortalResource` for every resource in every page definition | — | — |
| `setAccessiblePages` | 1240 | `keys: string[]` | `void` | Updates `accessiblePageKeys` and toggles tab button/page visibility | `pageDefinitions` | `accessiblePageKeys`, DOM |
| `renderAuthButton` | 1254 | — | `void` | Updates header auth button label, aria attributes, user name display | `appAuth` | DOM |
| `hideUserAuthMenu` | 1268 | — | `void` | Hides user account dropdown menu | — | DOM (`userAuthMenu`, `userAuthBtn`) |
| `toggleUserAuthMenu` | 1281 | — | `void` | Toggles user account menu; loads embed URL if opening | `ACCOUNT_PAGE_EMBED_URL` | DOM |
| `showAuthOverlay` | 1297 | `{ title, description, descriptionHtml, primaryLabel, primaryAction }` | `void` | Displays the blocking auth overlay with configurable content | — | DOM (`authOverlay`, `authPrimaryBtn`) |
| `hideAuthOverlay` | 1319 | — | `void` | Hides the auth overlay | — | DOM (`authOverlay`) |
| `syncSplashNoticeVisibility` | 1323 | — | `void` | Unhides the splash notice | — | DOM (`splashNotice`) |
| `startPortalSignIn` | 1378 | — | `Promise` | Initiates Portal OAuth sign-in; reloads on success, shows error overlay on fail | `appAuth` | DOM (button disabled states) |

---

### Help Overlay — stays in `main.js` (tightly coupled to auth/nav)

| Function | ~Line | Parameters | Returns | Description | State Read | State Written |
|---|---|---|---|---|---|---|
| `getCurrentVisiblePageKey` | 1329 | — | `string` | Returns the `key` of whichever page element has `class="visible"` | `pageDefinitions`, `accessiblePageKeys` | — |
| `syncHelpPageContext` | 1335 | — | `void` | Persists current page + accessible pages to `sessionStorage` | `currentPage`, `accessiblePageKeys` | `sessionStorage` |
| `showHelpOverlay` | 1346 | — | `void` | Builds help URL, sets `helpOverlayFrame.src`, unhides the overlay | `helpOverlayFrame`, `helpOverlay` | DOM |
| `hideHelpOverlay` | 1363 | — | `void` | Hides the help overlay and removes `help-overlay-open` body class | `helpOverlay` | DOM |
| `toggleHelpOverlay` | 1373 | — | `void` | Calls `showHelpOverlay` or `hideHelpOverlay` based on current state | `helpOverlay` | — |

---

### Map View Management — stays in `main.js` (owns `activeView`)

| Function | ~Line | Parameters | Returns | Description | State Read | State Written |
|---|---|---|---|---|---|---|
| `dockViewModeToggleTo` | 255 | `containerEl: Element` | `void` | Moves the view-mode toggle widget into the given map container slot | `viewModeToggle` | DOM |
| `waitForInitialView` | 1407 | `element, label, options?` | `Promise` | Races `viewOnReady()` against an arcgisError listener and a timeout | — | — |
| `showAndHide` | 1486 | `showEl, hideEl` | `void` | Adds `"visible"` to one element and removes it from another | — | DOM |
| `switchTo2D` | 2186 | — | `Promise` | Transfers viewpoint, shows 2D map, cancels sketch, resets selection state, calls `refreshLayerRefs` | `activeView`, `mapView`, `sceneView`, `sketchViewModel2d`, `polygonGraphicsLayer`, `rectangleSelectionActive`, `viewModeToggle`, `viewModeSwitch`, `rectangleToolPopover` | `activeView`, `rectangleSelectionActive` |
| `switchTo3D` | 2214 | — | `Promise` | Transfers viewpoint, shows 3D scene, calls `refreshLayerRefs` | same as above | `activeView` |
| `syncViewModeToggleFromActiveView` | 2241 | — | `void` | Sets `data-mode` and `checked` on the view-mode toggle to match `activeView` | `activeView`, `sceneView` | DOM |
| `refreshLayerRefs` | 2297 | — | `Promise` | Re-queries all layer references from map allLayers, loads them, sets formTemplate on LRC layer, acquires LayerViews | `sceneView`, `mapView` | All layer/layerView vars, `lrcRequestLayer.formTemplate` |

---

### Parcel Utility — proposed `utils.js` (pure / no shared state)

| Function | ~Line | Parameters | Returns | Description | State Read | State Written |
|---|---|---|---|---|---|---|
| `parseParcelBatch` | 2549 | `input: string` | `string[]` | Splits a comma/newline/semicolon-delimited string into trimmed non-empty values | — | — |
| `isDashedParcel` | 2555 | `value: any` | `boolean` | Tests the `##-###-##-##-#-##-##-###` dashed parcel regex | — | — |
| `isUndashed17DigitParcel` | 2560 | `value: any` | `boolean` | Tests for an exact 17-digit string | — | — |
| `normalizeBatchParcelInput` | 2565 | `values: string[]` | `object` | Validates batch parcel input: checks length, uniformity of format. Returns `{ ok, format, parcels, message? }` | — | — |
| `normalizeTooltipText` | 531 | `value: any` | `string` | Strips extra whitespace, "x", and Unicode × chars for tooltip comparison | — | — |
| `humanizeControlId` | 538 | `value: any` | `string` | Converts a camelCase/kebab-case DOM ID to human-readable text | — | — |
| `normalizeCompareValue` | 3330 | `value: any` | `string` | Trims and uppercases a value for comparison | — | — |
| `getCompareStatus` | 3335 | `rows: object[], fieldName: string` | `boolean` | Returns `true` if all rows have the same value for the field | — | — |
| `formatParcelWithDashes` | 3345 | `value: any` | `string` | Inserts dashes into a 17-digit parcel number string | — | — |
| `getSelectionKey` | 3385 | `feature: object` | `string` | Builds a unique `"LayerTitle::OID::Name"` key for a feature | — | — |
| `isRegular2DParcel` | 3400 | `feature: object` | `boolean` | Returns `true` if the feature's layer title is `"Parcels"` | — | — |
| `getParcelDisplayName` | 3405 | `feature: object` | `string` | Returns `feature.attributes.Name` or `"Unknown Parcel"` | — | — |
| `getTylerLookupValue` | 3410 | `feature: object` | `string` | Returns `parcel_id` for 3D floor features or `Name` for regular parcels | — | — |
| `isCondo3DParcel` | 3425 | `feature: object` | `boolean` | Returns `true` if layer title is `"Parcel Condominiums Floors"` | — | — |
| `normalizeParcelForTyler` | 3465 | `parcelNumber: string` | `string` | Strips dashes from parcel number for Tyler lookup | — | — |

---

### Sidebar Management — proposed `sidebarUI.js`

| Function | ~Line | Parameters | Returns | Description | State Read | State Written |
|---|---|---|---|---|---|---|
| `runSidebarResizePulse` | 2140 | `durationMs?: number` | `void` | RAF loop calling `mapView.resize()` and `sceneView.resize()` for the given duration | `sidebarResizePulseId`, `mapView`, `sceneView` | `sidebarResizePulseId` |
| `updateLeftSidebarState` | 2165 | — | `void` | Applies `"collapsed"` class and updates icon/label on the left sidebar toggle, then pulses resize | `leftSidebarCollapsed`, `leftSidebarShell`, `leftSidebarToggleIcon`, `leftSidebarToggle` | DOM |
| `openLeftSidebar` | 2180 | — | `void` | Opens the left sidebar if it is currently collapsed | `leftSidebarCollapsed` | `leftSidebarCollapsed`, calls `updateLeftSidebarState` |
| `updateRightSidebarState` | 2215 | — | `void` | Applies `"collapsed"` class and updates icon/label on the right sidebar toggle, then pulses resize | `rightSidebarCollapsed`, `rightSidebarShell`, `rightSidebarToggleIcon`, `rightSidebarToggle`, `rightSidebarResizeTimer`, `mapView`, `sceneView` | `rightSidebarResizeTimer`, DOM |

---

### Tab & Page Navigation — proposed `pageNavigation.js`

| Function | ~Line | Parameters | Returns | Description | State Read | State Written |
|---|---|---|---|---|---|---|
| `setActivePageTab` | 2246 | `btn: Element` | `void` | Applies `"active"` class and `aria-selected="true"` to the clicked tab; resets others | `tabButtons` | DOM |
| `getEnabledTabButtons` | 2256 | — | `Element[]` | Returns visible, non-disabled tab buttons | `tabButtons` | — |
| `focusTabButton` | 2266 | `btn: Element` | `void` | Safely calls `.focus()` on a tab button | — | — |
| `ensureMapLoaded` | 2308 | `mapId: string, flagName: string` | `Promise` | Lazy-loads the PW or SA map on first visit, including triggering `initSpecialAssessment` for SA | `pwLoaded`, `saLoaded`, `saModuleInitPromise` | `pwLoaded`, `saLoaded`, `saModuleInitPromise` |
| `switchPage` | 2766 | `pageName: string` | `Promise` | Switches the visible page, updates tab, updates search context, lazy-loads if needed, resizes view | `accessiblePageKeys`, `currentPage`, `searchController`, `mapView`, `sceneView` | `currentPage`, DOM |

---

### Search & Map Context — stays in `main.js` (retrieves live layer refs)

| Function | ~Line | Parameters | Returns | Description | State Read | State Written |
|---|---|---|---|---|---|---|
| `clearSearchUi` | 2404 | — | `void` | Clears search element value/term and closes suggestions | `searchEl` | DOM |
| `getCurrentSearchInputValue` | 2415 | `event: Event` | `string` | Walks the composed event path and shadow DOM to find the current typed value | `searchEl` | — |
| `getSAMapView` | 2435 | — | `MapView\|null` | Returns `document.getElementById("saMap")?.view` | — | — |
| `getPWMapView` | 2440 | — | `MapView\|null` | Returns `document.getElementById("pwMap")?.view` | — | — |
| `getPWParcelLayer` | 2445 | — | `FeatureLayer\|null` | Finds "Parcels" in PW map | — | — |
| `getPWCondoLayer` | 2450 | — | `FeatureLayer\|null` | Finds "Parcel Condominiums" in PW map | — | — |
| `getPWAddressLayer` | 2455 | — | `FeatureLayer\|null` | Finds "Addresses" in PW map | — | — |
| `getSAParcelLayer` | 2460 | — | `FeatureLayer\|null` | Finds "Parcels" in SA map | — | — |
| `getSACondoLayer` | 2465 | — | `FeatureLayer\|null` | Finds "Parcel Condominiums" in SA map | — | — |
| `getSAAddressLayer` | 2470 | — | `FeatureLayer\|null` | Finds "Addresses" in SA map | — | — |
| `getFallbackSearchContext` | 2601 | `pageName?: string` | `object` | Returns `{ page, view, layers }` built from live layer refs as fallback for search | `currentPage`, `activeView`, `regularParcelLayer`, `floorLayer`, `addressLayer2d`, `addressLayer3d` | — |
| `getSearchContextForPage` | 2603 | `pageName?: string` | `object` | Returns the search context from `searchController` or `getFallbackSearchContext` | `searchController`, `currentPage` | — |
| `zoomToFeatureSet` | 2610 | `features: object[]` | `Promise` | Unions feature extents and calls `goTo` on the appropriate view | `currentPage`, `sceneView`, `mapView`, `activeView` | — |
| `applyPAFeatureTableSelection` | 2668 | `features: object[]` | `Promise` | Sets `definitionExpression` on the SA feature table to show matching OIDs | — | DOM (`featureTableEl`) |
| `selectMultipleParcelsFromSearch` | 2688 | `rawInput: string` | `Promise` | Parses, validates, queries, zooms, and selects a batch of parcel numbers | `selectedParcels`, `currentPage` | `selectedParcels` (via `toggleParcelSelection`) |
| `wireSearchEnterBehavior` | 4390 | — | `Promise` | Wires the Enter key on the search element to trigger batch or single-match search | `searchEl`, `searchController` | `searchEl.dataset.enterWired` |
| `syncSearchBarWithSelectedParcels` | 3367 | — | `void` | Writes selected parcel names into the search input and suppresses suggestions | `selectedParcels`, `currentPage`, `searchEl` | DOM (`searchEl`) |

---

### Measurement Tools — proposed `measurementTools.js`

| Function | ~Line | Parameters | Returns | Description | State Read | State Written |
|---|---|---|---|---|---|---|
| `isMeasurementActive` | 1900 | `measureEl: Element` | `boolean` | Returns `true` if element state is `"measuring"` or `"measured"` | — | — |
| `syncMeasurementHintDialogVisibility` | 1910 | `measureEl: Element` | `void` | Hides "start measuring" hint dialogs in the measurement widget shadow/light DOM | — | Shadow DOM styles |
| `syncMeasurementInstruction` | 1940 | `measureEl, subtitleEl: Element` | `void` | Updates instruction text below start/stop buttons based on measurement state | `areaMeasure2d`, `areaMeasure3d` | DOM (`subtitleEl.textContent`) |
| `syncMeasurementPanelButtons` | 1960 | `measureEl, startBtn, stopBtn, subtitleEl` | `void` | Disables/hides start and stop based on active state; calls instruction + shell sync helpers | — | DOM |
| `safeMeasurementStart` | 1984 | `measureEl: Element` | `Promise` | Safely calls `measureEl.start()` with component-ready guard | — | — |
| `safeMeasurementClear` | 1998 | `measureEl: Element` | `Promise` | Safely calls `measureEl.clear()` with component-ready guard | — | — |
| `syncMeasurementShellVisibility2d` | 2010 | — | `void` | Hides both 2D measurement shells | `measure2dLineShell`, `measure2dAreaShell` | DOM |
| `syncMeasurementShellVisibility3d` | 2016 | — | `void` | Hides both 3D measurement shells | `measure3dLineShell`, `measure3dAreaShell` | DOM |
| `getActiveMeasure2dElement` | 2030 | — | `Element` | Returns `areaMeasure2d` or `distanceMeasure2d` based on `activeMeasure2dTool` | `activeMeasure2dTool`, `areaMeasure2d`, `distanceMeasure2d` | — |
| `applyMeasure2dToolSelection` | 2035 | `tool: string` | `void` | Sets `activeMeasure2dTool` and re-syncs panel | `activeMeasure2dTool` | `activeMeasure2dTool` |
| `getActiveMeasure3dElement` | 2048 | — | `Element` | Returns `areaMeasure3d` or `lineMeasure3d` based on `activeMeasure3dTool` | `activeMeasure3dTool`, `areaMeasure3d`, `lineMeasure3d` | — |
| `applyMeasure3dToolSelection` | 2053 | `tool: string` | `void` | Sets `activeMeasure3dTool` and re-syncs panel | `activeMeasure3dTool` | `activeMeasure3dTool` |

---

### Parcel Selection — proposed `parcelSelection.js`

| Function | ~Line | Parameters | Returns | Description | State Read | State Written |
|---|---|---|---|---|---|---|
| `getHighlightLayerViewForFeature` | 3430 | `feature: object` | `LayerView\|null` | Returns the LayerView (`regularParcelLayerView` or `floorLayerView`) for the given feature | `regularParcelLayerView`, `floorLayerView` | — |
| `getEncodedPoly` | 3440 | `geoms: Geometry[]` | `string` | Unions, simplifies, hull-wraps, generalizes, and WKT-encodes polygons for Tyler URL | — | — (uses ArcGIS operators) |
| `getTylerDataByParcel` | 3480 | `parcelNumber: string` | `Promise<{ ownerName, taxDistrict }>` | Queries Tyler Extract table for owner/tax info; cached | `tylerExtractTable`, `tylerLookupCache` | `tylerLookupCache` |
| `clearSelection` | 3360 | `container: Element` | `void` | Removes `"selected"` class from all `.selected` children of `container` | — | DOM |
| `clearSelectedParcels` | 3365 | — | `void` | Empties `selectedParcels` array and clears legacy content slots | `selectedParcelContent2d`, `selectedParcelContent3d` | `selectedParcels`, DOM |
| `clearHighlightsAndSets` | 3373 | — | `void` | Removes all highlight handles and clears `highlightedParcels` map | `highlightedParcels` | `highlightedParcels` |
| `removeSelectedParcelByKey` | 3380 | `selectionKey: string` | `boolean` | Removes one feature from `selectedParcels` and disposes its highlight | `selectedParcels`, `highlightedParcels` | both |
| `restoreBuildingListVisibility` | 3395 | — | `void` | Resets building list items to visible (un-collapses after building deselect) | `buildingSearchEl`, `buildingListEl` | DOM |
| `selectFeaturesByRectangle` | 2080 | `geometry: Geometry` | `Promise` | Queries regular parcels within a rectangle, respects MAX limit, adds to selection | `regularParcelLayer`, `selectedParcels`, `highlightedParcels`, `polygonGraphicsLayer` | `selectedParcels`, `highlightedParcels` |
| `toggleParcelSelection` | 3780 | `feature: object` | `Promise` | Adds or removes a feature from `selectedParcels`; updates highlights and triggers panel update | `selectedParcels`, `highlightedParcels`, `parcelLayerView`, `floorLayerView`, `regularParcelLayerView` | `selectedParcels`, `highlightedParcels` |

---

### Selected Parcel Sidebar UI — proposed `selectedParcelUI.js`

| Function | ~Line | Parameters | Returns | Description | State Read | State Written |
|---|---|---|---|---|---|---|
| `openSelectedParcelPanel` | 2278 | — | `void` | Expands `selectedParcelExpandEl` | `selectedParcelExpandEl` | DOM |
| `closeSelectedParcelPanel` | 2283 | — | `void` | Collapses `selectedParcelExpandEl` | `selectedParcelExpandEl` | DOM |
| `clearAllSelectedParcels` | 2288 | — | `Promise` | Removes all highlights, empties `selectedParcels`, refreshes panel | `selectedParcels`, `highlightedParcels`, `parcelListEl` | `selectedParcels`, `highlightedParcels`, DOM |
| `updateSelectedParcelBadge` | 2315 | — | `void` | Sets badge count text and toggles badge visibility | `selectedParcels`, `selectedParcelBadge2d`, `selectedParcelBadge3d` | DOM |
| `stageSingleParcelIframes` | 3375 | `contentEl, { parcelNumber, renderVersion }` | `void` | Builds the two-column detail + photo iframe layout for a single parcel | `selectedParcelRenderVersion` | DOM |
| `renderSelectedParcelSidebar` | 3420 | `renderVersion, selectedSnapshot?` | `Promise` | Renders the full right sidebar: header, LRC button(s), parcel rows or single-parcel frame | `selectedParcels`, `selectedParcelRenderVersion`, `rightSidebarContent`, `rightSidebarCollapsed` | DOM, `rightSidebarCollapsed` |
| `updateSelectedPanel` | 3640 | — | `Promise` | Increments render version, rebuilds legacy content slots, then calls `renderSelectedParcelSidebar` | `selectedParcels`, `selectedParcelRenderVersion` | `selectedParcelRenderVersion`, DOM |
| `syncParcelListSelection` | 3720 | — | `void` | Syncs `"selected"` class on parcel list items based on `selectedParcels` | `selectedParcels`, `parcelListEl` | DOM |

---

### Building / Floor Selection (3D) — proposed `buildingSelection.js`

| Function | ~Line | Parameters | Returns | Description | State Read | State Written |
|---|---|---|---|---|---|---|
| `populateBuildingList` | 3800 | — | `Promise` | Queries `condoLayer` for distinct `CartogNote` values and renders building list items | `condoLayer`, `buildingListEl`, `buildingSearchEl` | DOM |
| `renderFloorsForBuilding` | 3860 | `features: object[]` | `Promise` | Renders `calcite-chip` floor selectors from feature `FloorNameDesignator` values | `floorListEl` | DOM |
| `applyFloorFilter` | 3895 | `floorNums: string[]\|string` | `Promise` | Applies `FeatureFilter` to condo and floor layerViews for the selected floors | `currentBuildingWhere`, `floorLayer`, `condoLayer`, `sceneView`, `ESRILayer`, `parcelLayer` | DOM (layer visibility/filter) |
| `handleBuildingSelection` | 3945 | `cartogNote: string, div: Element` | `Promise` | Handles a building click: forces 3D, zooms to building, applies condo/floor filter, renders floors | `condoLayer`, `floorLayer`, `sceneView`, `ESRILayer`, `parcelLayer`, `buildingListEl`, `floorListEl`, `parcelListEl`, `currentBuildingWhere`, `allFeaturesForBuilding` | `currentBuildingExtent`, `currentBuildingWhere`, `allFeaturesForBuilding`, DOM |
| `selectBuildingFloorParcel` | 4050 | `feature: object` | `Promise` | Programmatically navigates building → floor → parcel selection | `buildingListEl`, `floorListEl`, `parcelListEl` | calls `handleBuildingSelection`, `handleFloorSelection`, `toggleParcelSelection` |
| `handleFloorSelection` | 4100 | — | `Promise` | Reads selected floor chips, queries floor features, renders parcel list, applies floor filter | `floorListEl`, `floorLayer`, `currentBuildingWhere`, `parcelListEl`, `parcelSearchEl` | DOM, calls `applyFloorFilter`, `syncParcelListSelection` |
| `attachViewClickHandler` | 4030 | `v: MapView\|SceneView` | `void` | Attaches a `"click"` handler on the view that calls `toggleParcelSelection` for hit-tested features | `currentPage`, `floorLayer`, `regularParcelLayer` | — |

---

### LRC (Land Records Change) Forms — proposed `lrcForms.js`

| Function | ~Line | Parameters | Returns | Description | State Read | State Written |
|---|---|---|---|---|---|---|
| `buildLrcRequestGeometry` | 4160 | — | `Geometry\|null` | Unions geometries from all selected parcels; returns single geometry or null | `selectedParcels` | — |
| `buildMergeMultipartGeometry` | 4175 | — | `Geometry\|null` | Builds a multipart polygon from all selected parcel rings | `selectedParcels` | — |
| `openLrcFeatureForm` | 4075 | — | `Promise` | Renders split LRC form into right sidebar; pre-fills parcel number; wires submit | `lrcRequestLayer`, `selectedParcels`, `rightSidebarContent` | DOM, `lrcFormFeature` |
| `submitLrcFeatureForm` | 4215 | — | `Promise` | Calls `lrcRequestLayer.applyEdits` with the form feature; handles loader/button state | `lrcRequestLayer` | DOM (loader/button states) |
| `openMergeLrcFeatureForm` | 4265 | — | `Promise` | Renders merge LRC form into right sidebar; pre-fills combined parcel numbers; wires submit | `lrcRequestLayer`, `selectedParcels`, `rightSidebarContent` | DOM, `lrcFormFeature` |

---

## Proposed Module Extraction Order

Extract lowest-coupling modules first so each step is testable in isolation.

| Step | Module | ~Lines Removed | Primary Coupling |
|---|---|---|---|
| 1 | `utils.js` | ~150 | None (pure functions) |
| 2 | `measurementTools.js` | ~350 | 15 DOM element refs, 2 state vars |
| 3 | `lrcForms.js` | ~350 | `lrcRequestLayer`, `selectedParcels`, `rightSidebarContent` |
| 4 | `buildingSelection.js` | ~450 | `condoLayer`, `sceneView`, `FeatureFilter` ArcGIS class |
| 5 | `portalAccess.js` | ~300 | `appAuth`, `APP_AUTH_CONFIG`, ArcGIS Portal classes |
| 6 | `sidebarUI.js` | ~200 | `mapView`, `sceneView`, 4 DOM refs, 4 state vars |
| 7 | `pageNavigation.js` | ~200 | `currentPage`, `searchController`, 3 tab buttons |
| 8 | `parcelSelection.js` | ~600 | `selectedParcels`, `highlightedParcels`, layerViews, Tyler table |
| 9 | `selectedParcelUI.js` | ~400 | `selectedParcels`, `rightSidebarContent`, `renderSelectedParcelSidebar` |

**After all extractions**: `main.js` becomes an orchestration shell (~500–700 lines) that wires all modules together and manages the initialization sequence.
