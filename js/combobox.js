export async function populateComboboxGroup({ map, layerTitle, fieldName, groupId, valuePrefix }) {
  const groupEl = document.getElementById(groupId);
  if (!groupEl) return;

  const layer = map.allLayers
    .toArray()
    .flatMap(l => l.type === "group" ? l.layers.toArray() : [l])
    .find(l => l.title === layerTitle && l.declaredClass === "esri.layers.FeatureLayer");

  if (!layer) {
    groupEl.innerHTML = "";
    return;
  }

  try {
    await layer.load();

    const query = layer.createQuery();
    query.where = "1=1";
    query.outFields = [fieldName];
    query.returnDistinctValues = true;
    query.orderByFields = [fieldName];
    query.returnGeometry = false;

    const { features } = await layer.queryFeatures(query);

    const values = features
      .map(f => f.attributes[fieldName])
      .filter(v => v != null)
      .sort((a,b)=>a.localeCompare(b));

    groupEl.innerHTML = "";

    values.forEach(value => {
      const item = document.createElement("calcite-combobox-item");
      item.value = value;
      item.textLabel = value;
      groupEl.appendChild(item);
    });
  } catch {
    groupEl.innerHTML = "";
  }
}

// Handles select-all toggle logic for combobox
export function attachSelectAllLogic(combobox) {
  let prevSelectedValues = new Set();

  combobox.addEventListener("calciteComboboxChange", (event) => {
    const currentSelectedValues = new Set(event.target.selectedItems.map(item => item.value));

    combobox.querySelectorAll("calcite-combobox-item[value^='select-all-']").forEach(selectAllItem => {
      const targetGroupId = selectAllItem.getAttribute("data-target-group");
      if (!targetGroupId) return;

      const group = combobox.querySelector(`#${targetGroupId}`);
      if (!group) return;

      const wasSelected = prevSelectedValues.has(selectAllItem.value);
      const isSelected = currentSelectedValues.has(selectAllItem.value);

      if (wasSelected !== isSelected) {
        group.querySelectorAll("calcite-combobox-item").forEach(groupItem => {
          groupItem.selected = isSelected;
        });
      }
    });

    prevSelectedValues = currentSelectedValues;
  });
}

// Displays selected items in a div list
export function attachSelectionListLogic(combobox, selectionList) {
  combobox.addEventListener("calciteComboboxChange", (event) => {
    const selectedItems = Array.from(event.target.selectedItems);
    selectionList.innerHTML = "";

    const groupedSelections = {};
    selectedItems.forEach(item => {
      if (item.value.startsWith("select-all-")) return;
      const parentGroup = item.closest("calcite-combobox-item-group");
      const groupKey = parentGroup?.label || parentGroup?.id || "Ungrouped";
      if (!groupedSelections[groupKey]) groupedSelections[groupKey] = [];
      groupedSelections[groupKey].push(item.value);
    });

    Object.entries(groupedSelections).forEach(([groupName, items]) => {
      const header = document.createElement("h3");
      header.textContent = groupName;
      selectionList.appendChild(header);

      items.forEach(text => {
        const listItem = document.createElement("div");
        listItem.textContent = text;
        listItem.style.marginLeft = "15px";
        selectionList.appendChild(listItem);
      });
    });
  });
}
