export const groupFieldMap = {
  "CID": "CID",
  "TDD": "TDD",
  "TIF Projects": "TIFproject",
  "TIF Plan District": "TIFdistrict"
};


export function buildComboboxWhereClause(combobox) {
  const selectedItems = Array.from(combobox.selectedItems);
  const groupedSelections = {};

  selectedItems.forEach(item => {
    if (item.value.startsWith("select-all-")) return;
    const parentGroup = item.closest("calcite-combobox-item-group");
    const groupKey = parentGroup?.label || parentGroup?.id || "Ungrouped";
    if (!groupedSelections[groupKey]) groupedSelections[groupKey] = [];
    groupedSelections[groupKey].push(item.value);
  });

  const clauses = [];
  Object.entries(groupedSelections).forEach(([groupName, values]) => {
    const field = groupFieldMap[groupName];
    if (!field || values.length === 0) return;
    const formattedValues = values.map(v => `'${v.replace(/'/g,"''")}'`).join(", ");
    clauses.push(`${field} IN (${formattedValues})`);
  });

  return clauses.length ? clauses.join(" OR ") : "1=1";
}

function hasActiveSelection(combobox) {
  return Array.from(combobox.selectedItems).some(
    item => !item.value.startsWith("select-all-")
  );
}

export function attachQueryTableListener(combobox, featureTable, parcelLayer, view) {
  if (!combobox || !featureTable || !parcelLayer || !view) {
    return;
  }

  let layerViewPromise = view.whenLayerView(parcelLayer).catch(() => {
    return null;
  });

combobox.addEventListener("calciteComboboxChange", async () => {

  const layerView = await layerViewPromise;
  if (!layerView) {
    return;
  }
  const otherLayers = view.map.layers.filter(l => l.id !== parcelLayer.id);

  if (!hasActiveSelection(combobox)) {
    featureTable.highlightIds?.removeAll?.();
    featureTable._allSelectedObjectIds = [];
    featureTable.definitionExpression = "1=1";

    // Reset parcel layer filter
    layerView.filter = null;

    // Restore other layers
    otherLayers.forEach(l => l.visible = true);

    return;
  }

  const whereClause = buildComboboxWhereClause(combobox);
  featureTable.definitionExpression = whereClause;

  try {
    const query = parcelLayer.createQuery();
    query.where = whereClause;
    query.returnGeometry = false;

    const allObjectIds = await parcelLayer.queryObjectIds(query);

    featureTable.highlightIds?.removeAll?.();
    const visibleIds = allObjectIds.slice(0, parcelLayer.maxRecordCount);
    featureTable.highlightIds?.addMany?.(visibleIds);
    featureTable._allSelectedObjectIds = allObjectIds;

    // Map filter
    layerView.filter = { where: whereClause };

    // Hide other layers while selection is active
    otherLayers.forEach(l => l.visible = false);

    // Zoom to selected parcels
    const extentQuery = parcelLayer.createQuery();
    extentQuery.where = whereClause;
    const result = await parcelLayer.queryExtent(extentQuery);
    if (result.extent) {
      view.goTo(result.extent.expand(1.2));
    }

  } catch {
    return;
  }
});
}
