# Public Parcel Viewer Requirements

This repository is the public-version starting point split from `InternalParcelViewer` on 2026-08-25.

## Confirmed From Current Codebase

- Keep the main Parcel Viewer map experience as a read-only public application.
- Keep parcel/address search, multi-parcel selection, map markers, hover focus, row-click zoom, measurement tools, layer list, basemaps, help pages, and selected parcel display where the backing services are public-safe.
- Use only publicly accessible ArcGIS items, layers, images, and service endpoints.
- Remove dependencies on Jackson County internal Portal sign-in for normal public use.
- Remove account menu, license/account page, access-validation overlay, and internal user-type presentation.
- Remove Tyler token/proxy code and any endpoint that requires internal credentials or returns non-public data.
- Remove or disable internal-only workflows unless they are explicitly approved for public release: Public Works tab, Property Information/Special Assessment tab, Land Records Change request forms, internal ticket/update artifacts, and internal beta messaging.
- Do not expose OAuth client IDs, private Portal item IDs, local server paths, token file paths, debug upstream errors, or staff-only operational details.
- Update branding/copy from "Internal" to public-facing language.
- Add a deployment README once the public ArcGIS item IDs and hosting target are chosen.

## Open Decisions

- Public ArcGIS web map item ID.
- Whether the public version includes 3D condo/building workflows.
- Whether owner search is allowed publicly, and which fields may be returned.
- Which parcel detail fields are public-safe.
- Hosting target and URL.
- Analytics, error reporting, and contact/help links.
