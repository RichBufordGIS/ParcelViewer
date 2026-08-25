async function loadLayerSafely(layer) {
  if (!layer) return null;

  try {
    await layer.load();
    return layer;
  } catch {
    return null;
  }
}

async function pruneFailedTopLevelLayers(map) {
  const topLevelLayers = map?.layers?.toArray?.() || [];

  for (const layer of topLevelLayers) {
    try {
      await layer.load();
    } catch {
      try {
        map.remove(layer);
      } catch {}
    }
  }
}

export async function initMap(mapEl, layerTitle = "Parcels") {
  await mapEl.viewOnReady();
  const view = mapEl.view;
  const map = view.map;

  await view.when();
  await map.when();
  await pruneFailedTopLevelLayers(map);

  const parcelLayer = map.allLayers.find((layer) => layer.title === layerTitle) || null;
  const loadedParcelLayer = await loadLayerSafely(parcelLayer);

  return { map, view, parcelLayer: loadedParcelLayer };
}
