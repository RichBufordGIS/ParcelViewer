export const JCGIS_BASE = "https://jcgis.jacksongov.org";
export const JCGIS_PORTAL_URL = `${JCGIS_BASE}/gisportal`;
export const MAX_SELECTED_PARCELS = 20;
export const ARCGIS_SERVICES_BASE = "https://services3.arcgis.com/4LOAHoFXfea6Y3Et";
const RUNTIME_CONFIG = (typeof window !== "undefined" && window.__JCGIS_APP_CONFIG__) || {};
export const APP_AUTH = Object.freeze({
    // Prefer runtime configuration via window.__JCGIS_APP_CONFIG__ to avoid committing deployment-specific values.
    // Example runtime config (not checked into source):
    // <script>window.__JCGIS_APP_CONFIG__ = { portalUrl: 'YOUR_PORTAL_URL', clientId: 'YOUR_CLIENT_ID' };</script>
    // If no runtime config is provided, the fallback value is used for local development only.
    portalUrl: RUNTIME_CONFIG.portalUrl || "https://jacksoncomo.maps.arcgis.com",
    clientId: RUNTIME_CONFIG.clientId || "JdWztUwhjhFsoTu1"
});
export const PORTAL_ITEM_IDS = Object.freeze({
    parcelViewer2d: "0561cabf74ff48a4af41d3130fd103d9",
    parcelViewer3d: "9b73428381b349a4b62110e5cbb9b9a8",
    publicWorks: "b68559fd7d424da79ca4667eeca1f9eb",
    propertyInformation: "683b226c7ebf4b5baf9f7c2ae7370359"
});
export const SERVICE_URLS = Object.freeze({
    buildingList: `${ARCGIS_SERVICES_BASE}/ArcGIS/rest/services/Buildings/FeatureServer/88`,
    parcelInformationLayer: `${ARCGIS_SERVICES_BASE}/ArcGIS/rest/services/Parcel_Information/FeatureServer/0`,
    parcelInformationQuery: `${ARCGIS_SERVICES_BASE}/ArcGIS/rest/services/Parcel_Information/FeatureServer/0/query`,
    historicParcelsBase: `${ARCGIS_SERVICES_BASE}/arcgis/rest/services/Parcel_Viewer_Historic_Parcels/FeatureServer/`
});
export const APP_ASSETS = Object.freeze({
    largeLogoUrl: `${JCGIS_BASE}/images/largelogo.png`,
    countyLogoUrl: `${JCGIS_BASE}/images/jackson-county-logo.png`,
    footerGlobeIconUrl: `${JCGIS_BASE}/images/Icons/globe-glow.svg`,
    teamsLogoUrl: `${JCGIS_BASE}/images/teamslogo.png`
});
export const EXTERNAL_LINKS = Object.freeze({
    helpTicketForm: "https://gisaws.jacksongov.org/tickets/gis/",
    helpTeamsChannel: "https://teams.microsoft.com/l/channel/19%3AN0OBV1NCKDef9XC2PCdoyU9ZwuZe1LNtUrqJp0-tyZ41%40thread.skype/Parcel%20Viewer%20Development?groupId=cf428a53-76d4-477b-b0b1-64047d99bbdc&tenantId=e5a0fc19-9f8a-44f4-b992-c7fb430b6d1f&ngc=true&allowXTenantAccess=true",
    esriAiAssistantsBlog: "https://www.esri.com/arcgis-blog/products/arcgis-online/geoai/whats-new-in-ai-assistants-february-2026",
    jacksonComoArcgisHome: "https://jacksoncomo.maps.arcgis.com/home/index.html"
});
export const CDN_URLS = Object.freeze({
    arcgisMapsSdk: "https://js.arcgis.com/5.0/",
    calciteEsm: "https://js.arcgis.com/calcite-components/5.0/"
});
export const USER_ACCOUNT_ASSET_BASES = Object.freeze({
    esriProductGlyph: "https://www.esri.com/is/content/esri/",
    esriProductLogo: "https://www.esri.com/content/dam/esrisites/en-us/common/icons/product-logos/",
    microsoftStoreImage: "https://store-images.s-microsoft.com/image/",
    arcgisAppAssets: "https://cdn-a.arcgis.com/cdn/1C31855/js/arcgis-app-components/arcgis-app/assets/",
    jacksonComoSharingItems: "https://jacksoncomo.maps.arcgis.com/sharing/rest/content/items/"
});
export const TYLER = Object.freeze({
    parcelQueryBaseUrl: "https://jacksoncountymoiasw.tylerhost.net",
    photosQueryUrl: `${JCGIS_BASE}/TylerPhotosQuery/TylerPhotosQuery.aspx/GetPhotos`,
    photoAssetBaseUrl: JCGIS_BASE,
    logoUrl: APP_ASSETS.largeLogoUrl
});
export const LAYER_TITLES = Object.freeze({
    parcels: "Parcels",
    parcelCondominiums: "Parcel Condominiums",
    parcelCondominiumsFloors: "Parcel Condominiums Floors"
});
export const FIELDS = Object.freeze({
    objectId: "OBJECTID",
    name: "Name",
    pin: "PIN",
    parcelNumber: "ParcelNumber",
    parid: "PARID",
    paridLower: "parid",
    parcelId: "parcel_id",
    parcelIdUpper: "PARCEL_ID",
    parcelSubtype: "ParcelSubtype",
    taxYear: "TAXYR",
    ownerNames: "OWNER_NAMES",
    ownerNamesLower: "owner_names",
    owner1: "OWN1",
    owner1Lower: "own1",
    owner2: "OWN2",
    owner2Lower: "own2",
    taxDistrict: "TAXDIST",
    taxDistrictLower: "taxdist",
    floorName: "FloorName",
    floorNameDesignator: "FloorNameDesignator"
});
export const SEARCH_COLORS = Object.freeze({
    text: "#0a1e3a",
    surface: "#10294a",
    inverseText: "#ffffff",
    groupHeading: "#9fe7ff",
    placeholder: "rgba(10,30,58,0.65)"
});
