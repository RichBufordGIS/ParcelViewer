export async function createFeatureTable({ view, layer, containerId }) {

  const table = document.getElementById(containerId);
  if (!table) return null;

  await table.componentOnReady();

  if (!view || !layer) {
    table.style.display = "none";
    return null;
  }

  try {
    table.view = view;
    table.layer = layer;
  table.tableTemplate = {
    columnTemplates: [
      { type: "field", fieldName: "Name", label: "Name" },
      { type: "field", fieldName: "CID", label: "CID" },
      { type: "field", fieldName: "TDD", label: "TDD" },
      { type: "field", fieldName: "TIFproject", label: "TIF Project" },
      { type: "field", fieldName: "TIFdistrict", label: "TIF Plan District" },
      { type: "field", fieldName: "MKTVAL", label: "Market Value" },
      { type: "field", fieldName: "TAXVAL", label: "Taxable Value" },
      { type: "field", fieldName: "ASDVAL", label: "Assessed Value" }
    ]
  };

    table.visibleElements = {
      menuItems: false,
      selectionColumn: true
    };

    table.editingEnabled = false;
    table.style.display = "";

    return table;
  } catch {
    table.style.display = "none";
    return null;
  }
}
