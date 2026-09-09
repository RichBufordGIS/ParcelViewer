# Public Parcel Viewer maintenance guide

Contributor acknowledgments are recorded in [CREDITS.md](../CREDITS.md). The application reflects collaborative work by the Jackson County GIS team, with Richard Buford serving as a project lead and contributor alongside Amy Petrillo, Gary Bindley, John Adams, Kevin Kandola, Lester Carver, and Will Buskirk, who also contributed to development and testing.

## Application structure

`index.html` and `indexinset.html` load `js/main.js`. Shared search markup is installed by `js/appShell.js`; ArcGIS/Calcite map tools are installed by `js/mapToolFactory.js`. The inset page also contains its own layout styles and interaction script. Update and check both entry points when changing shared behavior.

The public viewer retains some legacy internal-page markup and modules. Those files are not proof that the corresponding pages are exposed or supported publicly. Avoid replacing public startup and access logic with the internal viewer's authenticated startup.

See the [module and function inventory](function-inventory.md) for source navigation.

## Configuration and data flow

- `js/constants.js` contains shared service URLs, authentication defaults, parcel limits, field names, colors, and other configuration.
- The viewer pages also contain `data-item-id` and `data-portal-url` attributes used by startup. Check those attributes when changing map items; changing a constant alone may not change the loaded map.
- `window.__JCGIS_APP_CONFIG__` can override browser authentication configuration. Define it before application modules load. This is public configuration, not secret storage.
- `js/portalAccess.js` validates resources. Public startup uses anonymous access, requires the 2D map, and permits the application to continue when the optional 3D scene fails.
- `js/parcelSelection.js` batches owner/TCA lookups by normalized parcel ID, caches results, and selects the newest tax-year record returned for each parcel. `js/selectedParcelUI.js` shares those results across selection renderers.
- `js/rightPaneContent.js` queries parcel details and loads photos. Explicit attribute lists reduce query payloads; attribute-only requests do not request geometry.
- `js/lrcForms.js` includes split/combine request submission through the configured layer's `applyEdits()` operation. The service must enforce intended submission permissions.
- `js/errorUX.js` provides Calcite notifications and console diagnostics. User-facing notices should explain recovery without exposing credentials or sensitive details.

## Running and checking changes

Serve the repository root with an HTTP development server. Open both `/index.html` and `/indexinset.html`. No bundler or application package installation is required by this repository; the ArcGIS SDK is loaded from its configured CDN.

Run:

```sh
node --test tests/public-port.test.mjs
git diff --check
```

The suite uses Node's built-in runner and mocked service/view behavior. It checks parsing, lookup batching and caching, missing-service fallback, sidebar resizing, syntax, local imports, and entry-point wiring. It does not perform a live map or permission audit.

Manual browser checks for both viewer pages:

1. Open a fresh browser session without signing in and verify the public 2D map loads. Check optional-3D failure behavior using a controlled test configuration if that behavior changed.
2. Search a known parcel, address, and owner. Check suggestion selection, Enter, and Shift+Enter.
3. Paste known parcel IDs with Excel tabs, blank rows, and duplicates. Check match feedback and the 20-parcel limit, including unmatched and oversized lists.
4. Select, remove, and clear parcels; check marker numbering, owner/TCA rows, details, legal text, and photos.
5. Select a known condominium and check building/floor navigation. On the inset page, resize the panes and clear the selection.
6. Open and close sidebars, use map tools, and check the browser console and network requests for failures.
7. Test request submissions only against an authorized test layer; a successful write changes service data.

Record the date, browser version, entry point, cases exercised, and observed results for each release. A name on the credits page is not evidence that the person approved a particular release.

## Hosting and protection

Deploy the HTML, CSS, JavaScript, and referenced assets together through the chosen static web host. No hosting URL, deployment pipeline, or completed publication is established by this repository. A source commit is not a deployment record.

Frontend code remains inspectable after publication. Minification or obfuscation cannot protect secrets delivered to a browser. HTTPS provides transport encryption; privileged credentials and operations belong behind server-side access controls.

Before public release, verify deployed ArcGIS sharing and editing permissions, including request layers, and confirm public responses contain only intended public fields. Hiding a page, button, or field in JavaScript does not restrict direct access to a service.

## Documentation and cleanup status

The README, credits, release notes, and function inventory describe the public source. The former link to a deleted standalone release-note page has been removed. Temporary migration scripts and comparison output are not part of the maintained application.

The repository does not currently include ESLint, Prettier, or EditorConfig configuration. `main.js` still contains substantial startup and shared-state logic, and legacy internal-page code remains. Passing syntax and regression checks must not be described as a complete code cleanup, security audit, or browser certification.

`CODEOWNERS.txt` is retained as an existing ownership reference. It is not a GitHub-recognized `CODEOWNERS` filename, and changing review ownership is separate from updating project credits.
