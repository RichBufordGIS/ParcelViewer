# Internal Parcel Viewer

Internal ArcGIS web application for Jackson County parcel review, public works maps, and property information workflows.

## Features

- 2D parcel map and 3D scene navigation.
- Parcel, address, condo, building, and owner search from the main header search.
- Multi-parcel selection from map clicks, rectangle selection, owner search results, or pasted parcel lists.
- Selected parcel panel with current owner name and tax code area for multi-select workflows.
- Numbered map markers for multi-selected parcels, including hover focus and row-click zoom.
- Single-parcel details pane with basic property information, valuation rows, legal description, and parcel photos when available.
- Portal authentication through Jackson County GIS Portal.
- Public Works and Property Information tabs with their own map contexts.

## Quarterly Beta Updates

End-user update notes are tracked by quarter. Current update:

- [Q3 2026 Internal Parcel Viewer Beta Updates page](q3-2026-internal-parcel-viewer-beta-updates.html)
- [Q3 2026 Internal Parcel Viewer Beta Updates](docs/Q3%202026%20Internal%20Parcel%20Viewer%20Beta%20Updates.md)

## Search Workflows

### Parcel and Address Search

Numeric search input is treated as parcel, address, parcel ID, or condo/building input. Owner searches are skipped for numeric input so parcel and address suggestions stay fast and relevant.

### Owner Search

Alphabetic input in the Parcel Viewer search is treated as owner-name search. Owner suggestions are queried from the Parcel Information table and grouped by owner name. Each suggestion shows the number of matching properties, for example:

```text
ADAMS & JOSEPH INC (4 properties)
```

Selecting an owner selects the matching parcels as a multi-selection, zooms to the combined extent, and shows numbered point markers on the map. If an owner has more than 20 matching parcels, the first 20 are selected.

### Pasted Parcel Lists

The search bar accepts pasted parcel lists separated by commas with or without spaces, semicolons, or new lines. A valid list must use one parcel number format consistently:

- Full dashed parcel numbers, such as `29-220-16-06-00-0-00-000`
- 17-digit undashed parcel IDs, such as `29220160600000000`

When the list is valid, all matching parcels are selected and the map zooms to the combined extent. Pressing Enter after pasting uses the same validation and should not show a notice for a valid list. If the list is malformed, the app shows an in-app notice instead of a browser alert.

## Selected Parcel Behavior

- Single selection opens the full parcel detail pane.
- Multi-selection opens the selected parcel list.
- Multi-selection owner name and TCA values come from the Parcel Information service by `PARID`.
- Numbered point markers match the order of the selected parcel list.
- Hovering a selected parcel row flashes the matching point marker.
- Clicking a selected parcel row zooms to that parcel while keeping the full multi-selection.
- Removing a parcel renumbers the remaining markers and zooms to the remaining selected extent.
- When only one parcel remains, multi-select markers are cleared and the map zooms to that parcel.

## Data Services

The app expects the following ArcGIS and county services to be available to authenticated users:

| Purpose | Service |
| --- | --- |
| Portal web maps and scenes | `https://jcgis.jacksongov.org/gisportal` |
| Building list search | `https://services3.arcgis.com/4LOAHoFXfea6Y3Et/ArcGIS/rest/services/Buildings/FeatureServer/88` |
| Owner search and multi-select owner/TCA | `https://services3.arcgis.com/4LOAHoFXfea6Y3Et/ArcGIS/rest/services/Parcel_Information/FeatureServer/0` |
| Historic parcel detail tables | `https://services3.arcgis.com/4LOAHoFXfea6Y3Et/arcgis/rest/services/Parcel_Viewer_Historic_Parcels/FeatureServer/{yearLayer}` |

Owner and multi-selection requests only return fields needed for rendering, including `PARID`, `OWNER_NAMES`, and `TAXDIST`.

The long-term parcel-data direction is to collaborate Tyler-derived values into AGOL so Parcel Viewer can rely on AGOL-hosted parcel records as the shared source for parcel information.

## Project Structure

```text
InternalParcelViewer/
|-- index.html
|-- gis-help.html
|-- user-account-infopage.html
|-- css/
|   |-- main.css
|   |-- gis-help-page.css
|   `-- user-account-page.css
|-- js/
|   |-- main.js
|   |-- mapSetup.js
|   |-- searchParcels.js
|   |-- parcelSelection.js
|   |-- selectedParcelUI.js
|   |-- rightPaneContent.js
|   |-- queryTable.js
|   |-- featureTable.js
|   |-- oauth.js
|   |-- pageNavigation.js
|   |-- gis-help-page.js
|   `-- user-account-page.js
`-- scripts/
```

## Local Development

Use a local static server from the repository root.

```bash
python -m http.server 3000
```

Then open:

```text
http://127.0.0.1:3000/index.html
```

The app requires access to the configured Jackson County GIS Portal, web maps, and feature services.

## Configuration

Primary app configuration is defined in `index.html` and `js/main.js`.

```javascript
const APP_AUTH_CONFIG = {
  portalUrl: "https://jcgis.jacksongov.org/gisportal",
  clientId: "JdWztUwhjhFsoTu1"
};
```

Map and scene item IDs are assigned on the ArcGIS component elements in `index.html`.

## Development Notes

- Keep parcel search behavior in `js/searchParcels.js`.
- Keep selection state, point markers, startup tolerance, and page wiring in `js/main.js`.
- Keep selected parcel list rendering in `js/selectedParcelUI.js`.
- Keep single-parcel detail frame and parcel photo rendering in `js/rightPaneContent.js`.
- Optional ArcGIS layer/service failures should not block startup unless the core map view cannot initialize.

## Browser Support

The application is intended for current desktop versions of Chrome and Edge.

## Contributing

1. Create a feature branch from `beta`.
2. Commit focused changes with a clear message.
3. Push the branch to origin.
4. Open a pull request back into `beta`.
