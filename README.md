# Jackson County Public Parcel Viewer

This application was developed through a collaborative effort by the Jackson County GIS team and supporting county staff. Contributions spanned project planning, system design, application development, testing, and continuous refinement. The project addressed several long-standing operational challenges, including the transition from parcel updates occurring once per week to nightly updates through Portal-to-AGOL collaboration. Another major improvement was multi-parcel selection, which improved the speed and efficiency of parcel review. These and other team contributions helped modernize how the Assessment team can review and display overlapping land records in a more intuitive and effective way.

Development Team:
- John Adams
- Gary Bindley
- Richard Buford
- Lester Carver
- Kevin Kandola

Contributors:

- Amy Petrillo
- Dustin Schmidt
- Eric Rabe
- Giselle Castaneda
- Matt Wagner
- Phillip Stehman
- Randy Diehl
- Vince Brice
- Will Buskirk

See [Credits and acknowledgments](CREDITS.md).

Parcel Viewer helps users search, review, and understand Jackson County parcel information. It supports standard parcel lookup on a 2D map and adds a 3D view for condominium and elevated parcel situations where multiple parcel records overlap the same ground location.

## What It Does

- Search by parcel number, address, owner name, condominium, or building.
- Select one or more parcels from the map, search results, or pasted parcel lists.
- Review parcel details, ownership information, valuation history, legal description, and parcel photos when available.
- Use 3D viewing for condominium and elevated parcels that are difficult to understand in a flat 2D map.
- See selected parcels clearly on the map with highlighted geometry and numbered selection markers.
- Start split or combine workflows from selected parcels when a land-record change request is needed. Submission depends on the request layer's availability and server-side permissions.

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

The standard page supports 2D/3D switching. The inset page displays its 3D pane for condominium and elevated-parcel selections. Clearing the selection resets the condominium workflow and returns the viewer to the 2D map.

## Selected Parcels

- A single selected parcel opens the parcel detail view.
- Multiple selected parcels open the selected parcel list.
- Clicking a selected parcel row zooms to that parcel.
- Removing a parcel updates the remaining selected parcels.
- Clearing the selection resets the map and removes any active 3D condominium view.

## Quarterly Beta Updates

See the [Q3 2026 beta updates](docs/Q3%202026%20Internal%20Parcel%20Viewer%20Beta%20Updates.md). The filename retains its internal-viewer history; the document identifies changes shared with this public viewer.

## Browser Support

Parcel Viewer is intended for current desktop versions of Chrome and Edge.

## Running the Viewer

This repository contains static HTML, CSS, and JavaScript ES modules. No application build step or package manifest is included. Serve the repository root through a local HTTP development server, then open [index.html](index.html) or [indexinset.html](indexinset.html). Opening files directly through `file://` is not a supported development setup. The browser needs network access to the ArcGIS SDK and configured services.

The regression suite uses Node's built-in test runner and was verified with Node.js 24. It does not establish live service availability, browser compatibility, or deployed permissions.

## Publication and Security

Downloaded HTML, CSS, and JavaScript can be inspected by visitors. HTTPS protects traffic in transit; it does not hide frontend source code. Runtime browser configuration is also public and must not contain private credentials. Secrets and privileged operations must be protected on the server.

The viewer is configured for anonymous map access. Sharing, editing, and data-access restrictions must be enforced by the underlying services. Request-submission code is present, but its presence does not establish that anonymous writes are permitted.

Local source changes and passing tests do not establish that a site has been published or secured. No deployment automation is included, and live hosting and service permissions have not been verified as part of this documentation update.

## Supporting Documentation

- [Credits and acknowledgments](CREDITS.md)
- [Maintenance, configuration, and release checks](docs/maintenance.md)
- [Current module and function inventory](docs/function-inventory.md)
- [GIS help](gis-help.html)
- [Guided walkthroughs](gis-guided-walkthroughs.html)
