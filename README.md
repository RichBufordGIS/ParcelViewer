# Parcel Viewer

Parcel Viewer helps users search, review, and understand Jackson County parcel information. It supports standard parcel lookup on a 2D map and adds a 3D view for condominium and elevated parcel situations where multiple parcel records overlap the same ground location.

## What It Does

- Search by parcel number, address, owner name, condominium, or building.
- Select one or more parcels from the map, search results, or pasted parcel lists.
- Review parcel details, ownership information, valuation history, legal description, and parcel photos when available.
- Use 3D viewing for condominium and elevated parcels that are difficult to understand in a flat 2D map.
- See selected parcels clearly on the map with highlighted geometry and numbered selection markers.
- Start split or combine workflows from selected parcels when a land-record change request is needed.

## Why 3D Is Included

Some properties, especially condominiums and elevated parcels, overlap in 2D. A flat map can make those records look like a confusing stack of parcel lines in the same location.

The 3D workflow is included to make those overlapping property interests easier to understand. When a condominium or elevated parcel is selected, the viewer can show the related building, floor, and parcel in a more natural visual context before the user reviews details, valuations, photos, or land-record change request options.

## Search

The search bar supports:

- Dashed parcel numbers, such as `29-220-16-06-00-0-00-000`
- Undashed parcel IDs, such as `29220160600000000`
- Addresses
- Owner names
- Condominium and building records

Pasted parcel lists can be separated by commas, semicolons, tabs, carriage returns, or new lines, including cells copied from Excel. Blank cells and duplicate parcel numbers are removed. Paste feedback reports matches, duplicates, and the 20-parcel selection limit. Shift+Enter adds a line in the search input.

Both `index.html` and `indexinset.html` use the shared search shell, map-tool templates, configuration, notifications, parcel details, and batched owner/TCA lookup. The inset page retains its resizable 2D/3D layout. Public maps continue to load anonymously, with 2D available when the optional 3D scene cannot load.

The internal viewer's authenticated navigation and separate Public Works/Property Information pages are not exposed in this public application. The existing public selection and condo workflows remain in place.

Run the local regression checks with `node --test tests/public-port.test.mjs`. These cover parsing, batched owner lookups, sidebar resizing, JavaScript syntax, local imports, and both entry points. Live ArcGIS services and browser interactions require a separate browser check.

## Condominium And Elevated Parcel Workflow

When a condominium or elevated parcel is selected, the viewer steps through the selection so the user can follow what is happening:

1. Selects the building.
2. Selects the floor.
3. Selects the parcel.
4. Frames the 3D view.

The 3D view appears only when it is needed for a selected condominium or elevated parcel. Clearing the selection removes the 3D view and returns the viewer to the 2D map.

## Selected Parcels

- A single selected parcel opens the parcel detail view.
- Multiple selected parcels open the selected parcel list.
- Clicking a selected parcel row zooms to that parcel.
- Removing a parcel updates the remaining selected parcels.
- Clearing the selection resets the map and removes any active 3D condominium view.

## Quarterly Beta Updates

Parcel Viewer beta updates will be tracked quarterly. These notes will summarize new features, known limitations, and research findings from the condominium and elevated parcel workflow.

## Browser Support

Parcel Viewer is intended for current desktop versions of Chrome and Edge.
