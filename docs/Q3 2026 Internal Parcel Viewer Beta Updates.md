# Q3 2026 Beta Update: Parcel Search and Multi-Select Improvements

Applies to the shared improvements in the [standard public viewer](../index.html) and [inset public viewer](../indexinset.html). This filename retains its internal-viewer history; the former standalone release-note page is no longer included.

This release reflects collaborative work by the Jackson County GIS team. Richard Buford contributed as a project lead and team member, alongside Amy Petrillo, Gary Bindley, John Adams, Kevin Kandola, Lester Carver, and Will Buskirk, who supported planning, development, and testing. See [Credits and acknowledgments](../CREDITS.md).

This release improves the Parcel Viewer workflows users touch most often: searching, selecting multiple parcels, and seeing where selected parcels are on the map.

It also supports the larger parcel-data direction for the application: parcel details should come from AGOL-hosted parcel information instead of direct end-user workflows depending on Tyler API lookups. The longer-term concept is to collaborate Tyler-derived data into AGOL so each parcel can be represented as a single parcel record with the needed Tyler values included.

## Owner Search

Users can now search by owner name from the Parcel Viewer search bar. When the search starts with letters, the app shows owner-name results with the number of properties found.

<p align="center">
  <img src="images/q3-owner-search.png" alt="Owner search suggestions in the Parcel Viewer search bar" width="64%">
</p>

What changed for users:

- Type an owner name, such as `adams`, in the search bar.
- Owner suggestions show the property count.
- Selecting an owner selects that owner's matching parcels.
- The map zooms out so the selected parcels can be seen together.
- If more than 20 properties match, the first 20 are selected.

## Pasted Parcel Lists

Users can paste a list of parcel numbers into the search bar and select them all at once.

<p align="center">
  <img src="images/q3-multi-select-list.png" alt="Pasted parcel list selecting multiple parcels" width="82%">
</p>

Supported list formats:

- Comma with no space: `29-220-16-06-00-0-00-000,51-310-06-06-00-0-00-000`
- Comma with a space: `29-220-16-06-00-0-00-000, 51-310-06-06-00-0-00-000`
- Semicolons, tabs, carriage returns, or new lines, including Excel cells
- Full dashed parcel numbers
- 17-digit parcel IDs with no dashes

Blank entries and duplicate values are removed. Valid lists are processed within the 20-parcel selection limit; oversized or invalid lists display guidance. The multiline input supports Shift+Enter, and paste feedback reports matches and duplicates. Selection and map framing also depend on whether the matches use the regular parcel or condominium workflow.

## Multi-Select Map Markers

Multi-selected parcels now have numbered map markers that match the selected parcel list.

<p align="center">
  <img src="images/q3-hover-focus.png" alt="Selected parcel list with matching numbered map markers and row focus" width="78%">
</p>

What users can do:

- Use the numbered markers to see where each selected parcel is located.
- Hover a selected parcel row to flash the matching point on the map.
- Click a selected parcel row, outside the red remove button, to zoom to that parcel while keeping the full list selected.
- Remove a parcel and the remaining map markers renumber automatically.
- If only one parcel remains, the map zooms to that parcel and the numbered multi-select markers are cleared.

## Selected Parcel List

The selected parcel list now shows the current owner name and TCA for multi-selected parcels. These values come from the current Parcel Information service, so users see current owner and tax code area values for each selected parcel.

This is part of the move toward AGOL as the shared parcel-information source. Owner and TCA values used by the multi-select list are read from the AGOL Parcel Information service by parcel ID.

## AGOL Parcel Data Direction

This beta starts aligning parcel workflows around AGOL-hosted parcel information.

- Current owner and TCA values are read from the Parcel Information service in AGOL.
- Parcel lookups are based on the parcel ID without dashes when needed.
- The intended future model is a single AGOL parcel record that includes the Tyler-collaborated values needed by Parcel Viewer.
- This is still a concept direction, but the current work prepares the app for that model.

## Single Parcel Details

Single parcel selection still opens the full detail pane with:

- Basic parcel information
- Current owner and address
- TCA and district information
- Recent value rows
- Legal description
- Parcel photos when available

The shorter owner/TCA card layout is only for multi-select lists. Single parcel selections continue to use the full details view.

## Shared public-viewer implementation updates

- Both entry points use shared search markup and map-tool templates.
- Shared constants define service configuration and parcel limits.
- Owner/TCA lookups use batched queries and cached results shared by selection renderers.
- Detail queries request explicit attributes and omit geometry when it is not needed.
- Map and scene startup runs concurrently; the public viewer can continue in 2D if the optional scene is unavailable.
- Sidebar resizing responds to transition completion, with support for both visible inset views.
- Search and form code use component readiness and input/completion events.
- Calcite notifications provide feedback, and the public error helper records caught errors in the console.

These notes describe source changes, not proof of publication or live security verification. Historical screenshots above illustrate the workflows and may differ from the current public interface. See the [maintenance guide](maintenance.md) for verification scope and release checks.

## Workflow reminders

- Search by owner name when you know the owner.
- Paste a parcel list when you need to select several parcels at once.
- Use numbered markers to understand where selected parcels are located.
- Hover or click a selected row to focus a specific selected parcel.
- Remove parcels from the list as needed; markers and zoom update automatically.
