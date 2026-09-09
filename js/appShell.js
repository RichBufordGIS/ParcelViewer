/** Shared public search shell for the standard and inset pages. */
export function installAppShell() {
    const host = document.querySelector('.header-search-shell');
    if (!host || document.getElementById('searchTextArea')) return;
    host.innerHTML = `<calcite-text-area id="searchTextArea" class="header-search-textarea"
        aria-label="Search Parcel Viewer" placeholder="Search, or paste parcel list from Excel"
        resize="none" rows="1" scale="m"></calcite-text-area>
        <div id="searchSuggestions" class="header-search-suggestions" role="listbox" hidden></div>
        <div id="searchNotice" class="header-search-notice" role="status" aria-live="polite" hidden></div>
        <arcgis-search id="search" class="header-search-proxy" include-default-sources-disabled></arcgis-search>`;
}
