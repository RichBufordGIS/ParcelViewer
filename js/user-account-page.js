import { createPortalAuth } from "./oauth.js";

const APP_AUTH_CONFIG = {
  portalUrl: "https://jcgis.jacksongov.org/gisportal",
  clientId: "JdWztUwhjhFsoTu1"
};
const ACCOUNT_EMBED_MESSAGE_CLOSE = "jcgis-account-close";
const ACCOUNT_EMBED_MESSAGE_SIGNIN = "jcgis-account-signin";
const ACCOUNT_EMBED_MESSAGE_SIGNOUT = "jcgis-account-signed-out";
const ACCOUNT_EMBED_MESSAGE_SIZE = "jcgis-account-size";
const JCGIS_PORTAL_BASE_URL = "https://jcgis.jacksongov.org/gisportal/";
const JCGIS_PORTAL_HOME_BASE_URL = `${JCGIS_PORTAL_BASE_URL}home/`;
const JCGIS_PORTAL_ASSET_BASE_URL = "https://jcgis.jacksongov.org/gisportal/apps/instantgallery/assets/arcgis-app-components/arcgis-app/assets/";
const ESRI_PRODUCT_GLYPH_BASE_URL = "https://www.esri.com/is/content/esri/";
const ESRI_PRODUCT_LOGO_BASE_URL = "https://www.esri.com/content/dam/esrisites/en-us/common/icons/product-logos/";
const ARC_PRO_DESKTOP_URIS = ["arcgis-pro://", "arcgispro://"];
const ARC_PRO_ICON_URL = "https://jcgis.jacksongov.org/gisportal/home/11.5.0/js/arcgisonline/sharing/dijit/css/images/app-icons/arcgis-pro.png";

const STANDARD_ENTERPRISE_APP_URLS = {
  "ArcGIS Dashboards": `${JCGIS_PORTAL_BASE_URL}apps/dashboards/home`,
  "Sites": `${JCGIS_PORTAL_BASE_URL}apps/sites/#/`,
  "ArcGIS Enterprise Sites": `${JCGIS_PORTAL_BASE_URL}apps/sites/#/`,
  "ArcGIS Experience Builder": `${JCGIS_PORTAL_BASE_URL}apps/experiencebuilder/`,
  "ArcGIS Instant Apps": `${JCGIS_PORTAL_BASE_URL}apps/instantgallery/`,
  "ArcGIS StoryMaps": `${JCGIS_PORTAL_BASE_URL}apps/storymaps/`,
  "ArcGIS Web AppBuilder": `${JCGIS_PORTAL_BASE_URL}apps/webappviewer/`,
  "Map Viewer": `${JCGIS_PORTAL_BASE_URL}apps/mapviewer/`,
  "ArcGIS Hub": `${JCGIS_PORTAL_BASE_URL}apps/sites/#/`,
  "Organization Website": `${JCGIS_PORTAL_BASE_URL}apps/sites/#/`,
  "Scene Viewer": `${JCGIS_PORTAL_BASE_URL}apps/sceneviewer/`,
  "ArcGIS Insights": `${JCGIS_PORTAL_BASE_URL}apps/insights/`,
  "ArcGIS Mission Manager": `${JCGIS_PORTAL_BASE_URL}apps/missionmanager/`,
  "ArcGIS Solutions": `${JCGIS_PORTAL_BASE_URL}apps/solutions/`,
  "Web Editor": `${JCGIS_PORTAL_BASE_URL}apps/webeditor/`,
  "ArcGIS GeoBIM": `${JCGIS_PORTAL_BASE_URL}apps/geobim/`,
  "ArcGIS Indoors": `${JCGIS_PORTAL_BASE_URL}apps/indoors/`,
  "Floor-aware maps": `${JCGIS_PORTAL_BASE_URL}apps/indoors/`,
  "Indoor wayfinding": `${JCGIS_PORTAL_BASE_URL}apps/indoors/`,
  "Workplace apps": `${JCGIS_PORTAL_BASE_URL}apps/indoors/`,
  "Space planning": `${JCGIS_PORTAL_BASE_URL}apps/indoors/`,
  "Room search": `${JCGIS_PORTAL_BASE_URL}apps/indoors/`,
  "Reservations": `${JCGIS_PORTAL_BASE_URL}apps/indoors/`
};

const PREVIEW_ITEM_SEARCH_TERMS = {
  "Sites": "Sites",
  "ArcGIS Enterprise Sites": "Sites",
  "Floor-aware maps": "ArcGIS Indoors",
  "Indoor wayfinding": "ArcGIS Indoors",
  "Workplace apps": "ArcGIS Indoors",
  "Space planning": "ArcGIS Indoors",
  "Room search": "ArcGIS Indoors",
  "Reservations": "ArcGIS Indoors",
  "ArcGIS QuickCapture Web Designer": "ArcGIS QuickCapture",
  "ArcGIS Location Sharing": "ArcGIS Location Sharing",
  "ArcGIS Location Tracking": "ArcGIS Location Sharing",
  "Organization Website": "ArcGIS Hub"
};

const OVERLAY_ICON_BY_LABEL = {
  "Configurable Apps": "configure"
};

const CENTERED_OVERLAY_ICON_LABELS = {
  "Configurable Apps": true
};

const MARKETPLACE_BADGE_URLS = {
  "ArcGIS for Teams": [
    "https://store-images.s-microsoft.com/image/apps.17558.c0d4f245-c2d0-4798-b5e8-e73aea5336c0.eef4b3b2-8491-4428-9510-5862abb26f96.4928ff3c-324f-4663-8c7d-b289687b8562.png",
    "https://store-images.s-microsoft.com/image/apps.62196.c0d4f245-c2d0-4798-b5e8-e73aea5336c0.8fb13782-cc2c-4478-9998-5f41a3be292b.b3f2031e-84d7-425e-82cc-ea35fc1d2dd0.png"
  ],
  "ArcGIS for Excel": [
    "https://jcgis.jacksongov.org/gisportal/sharing/rest/content/items/80492ce0827a4cc8b19219be2b69cb8e/resources/ArcGIS_for_Excel/icon.png",
    "https://jcgis.jacksongov.org/images/Icons/ESRI/Apps/ArcGISforExcel.png",
    "https://store-images.s-microsoft.com/image/apps.14874.7ac80e32-4af3-4961-b3a6-2e871982b721.910edbf9-9d95-4224-a14c-7935fbbf3263.64da2c2e-9f1d-4b19-9264-dfe092cbe3eb.png",
    "https://store-images.s-microsoft.com/image/apps.4981.7ac80e32-4af3-4961-b3a6-2e871982b721.5017ef3a-2216-4391-91b6-b880a6d2020d.aa32737d-1270-4380-a102-3490ecc9d07c.png"
  ],
  "ArcGIS for SharePoint": [
    "https://store-images.s-microsoft.com/image/apps.2588.cb8ca56f-4b8d-4587-9750-cd678322b364.6ed5b02a-4712-48c9-bd08-290d15e3fbe9.9c9ed2c8-a1ea-4a01-b1d2-f765da44ccde.png"
  ],
  "ArcGIS for Power BI": [
    "https://jacksoncomo.maps.arcgis.com/sharing/rest/content/items/52b1bf8f295f4985abb4373fc3954862/resources/appthumbnail.png",
    "https://store-images.s-microsoft.com/image/apps.57931.559560f6-ab11-4da2-89e9-95b82f10f08b.cde9f701-e8b4-4bd3-b92e-098f5b776387.a1b2de7d-164f-4193-9a3b-f319f1288d3a",
    "https://store-images.s-microsoft.com/image/apps.3603.559560f6-ab11-4da2-89e9-95b82f10f08b.cde9f701-e8b4-4bd3-b92e-098f5b776387.6abd0d99-9d4b-43e5-ae43-4d6a258d435c"
  ]
};

const ESRI_PRODUCT_LOGO_CANDIDATES = {
  "ArcGIS AppStudio": [
    "https://jcgis.jacksongov.org/gisportal/sharing/rest/content/items/80492ce0827a4cc8b19219be2b69cb8e/resources/ArcGIS_AppStudio_Developer_Edition/icon.png",
    "AppStudio.png",
    "arcgis-appstudio.png"
  ],
  "ArcGIS Dashboards": [
    "https://cdn-a.arcgis.com/cdn/1C31855/js/arcgis-app-components/arcgis-app/assets/operations-dashboard.png",
    "arcgis-dashboards.png",
    "Dashboards.png"
  ],
  "Sites": [
    "https://jcgis.jacksongov.org/gisportal/home/11.5.0/js/arcgis-app-components/arcgis-app/assets/sites.png",
    "Sites.png",
    "EnterpriseSites.png",
    "arcgis-enterprise-sites.png"
  ],
  "ArcGIS Experience Builder": [
    "https://cdn-a.arcgis.com/cdn/1C31855/js/arcgis-app-components/arcgis-app/assets/arcgis-experience-builder.png",
    "ExperienceBuilder.png",
    "arcgis-experience-builder.png"
  ],
  "ArcGIS Instant Apps": [
    "https://cdn-a.arcgis.com/cdn/1C31855/js/arcgis-app-components/arcgis-app/assets/instant-apps.png",
    "InstantApps.png",
    "arcgis-instant-apps.png"
  ],
  "ArcGIS Maps for Adobe Creative Cloud": [
    "https://cdn-a.arcgis.com/cdn/1C31855/js/arcgis-app-components/arcgis-app/assets/maps-adobe-cloud.png",
    "AdobeCC.png",
    "MapsForAdobeCreativeCloud.png",
    "arcgis-maps-for-adobe-creative-cloud.png"
  ],
  "ArcGIS StoryMaps": ["StoryMaps.png", "arcgis-storymaps.png"],
  "ArcGIS Web AppBuilder": ["WebAppBuilder.png", "arcgis-web-appbuilder.png"],
  "Configurable Apps": [
    "https://jcgis.jacksongov.org/gisportal/home/11.5.0/js/arcgisonline/sharing/dijit/css/images/app-icons/svg-app-icon.svg",
    "ConfigurableApps.png",
    "configurable-apps.png"
  ],
  "Map Viewer": [
    "https://cdn-a.arcgis.com/cdn/1C31855/js/arcgis-app-components/arcgis-app/assets/map-viewer.png",
    "MapViewer.png",
    "arcgis-map-viewer.png"
  ],
  "ArcGIS Hub": [
    "https://cdn-a.arcgis.com/cdn/1C31855/js/arcgis-app-components/arcgis-app/assets/arcgis-hub.png",
    "https://cdn-a.arcgis.com/cdn/1C31855/js/arcgis-app-components/arcgis-app/assets/arcgis-online.png",
    "Hub.png",
    "arcgis-hub.png"
  ],
  "Scene Viewer": ["SceneViewer.png", "arcgis-scene-viewer.png"],
  "ArcGIS Connectors for Power Automate": [
    "https://jcgis.jacksongov.org/gisportal/sharing/rest/content/items/80492ce0827a4cc8b19219be2b69cb8e/resources/ArcGIS_Connectors_for_Power_Automate/icon.png",
    "PowerAutomate.png",
    "arcgis-power-automate.png"
  ],
  "ArcGIS for Excel": ["Excel.png", "arcgis-excel.png", "arcgis-for-excel.png"],
  "ArcGIS for Power BI": ["PowerBI.png", "arcgis-power-bi.png", "arcgis-for-power-bi.png"],
  "ArcGIS for SharePoint": ["SharePoint.png", "arcgis-sharepoint.png", "arcgis-for-sharepoint.png"],
  "ArcGIS for Teams": ["Teams.png", "arcgis-teams.png", "arcgis-for-teams.png"],
  "ArcGIS Collector": [
    "https://jcgis.jacksongov.org/gisportal/sharing/rest/content/items/80492ce0827a4cc8b19219be2b69cb8e/resources/ArcGIS_Collector/icon.png",
    "Collector.png",
    "arcgis-collector.png"
  ],
  "ArcGIS Field Maps": [
    "https://jcgis.jacksongov.org/gisportal/sharing/rest/content/items/80492ce0827a4cc8b19219be2b69cb8e/resources/ArcGIS_Field_Maps/icon.png",
    "https://cdn-a.arcgis.com/cdn/1C31855/js/arcgis-app-components/arcgis-app/assets/fieldmaps.png",
    "FieldMaps.png",
    "arcgis-field-maps.png"
  ],
  "ArcGIS QuickCapture": [
    `${JCGIS_PORTAL_ASSET_BASE_URL}quick-capture.png`,
    "QuickCapture.png",
    "arcgis-quickcapture.png"
  ],
  "ArcGIS Survey123": [
    "https://jcgis.jacksongov.org/gisportal/sharing/rest/content/items/80492ce0827a4cc8b19219be2b69cb8e/resources/ArcGIS_Survey123/icon.png",
    "https://cdn-a.arcgis.com/cdn/1C31855/js/arcgis-app-components/arcgis-app/assets/survey123.png",
    "Survey123.png",
    "arcgis-survey123.png"
  ],
  "ArcGIS Workforce": [
    `${JCGIS_PORTAL_ASSET_BASE_URL}workforce.png`,
    "Workforce.png",
    "arcgis-workforce.png"
  ],
  "ArcGIS Flight": [
    "https://jcgis.jacksongov.org/gisportal/sharing/rest/content/items/80492ce0827a4cc8b19219be2b69cb8e/resources/ArcGIS_Flight/icon.png",
    `${JCGIS_PORTAL_ASSET_BASE_URL}excalibur.png`,
    "Flight.png",
    "arcgis-flight.png"
  ],
  "ArcGIS Field Maps Designer": [
    "https://jcgis.jacksongov.org/gisportal/sharing/rest/content/items/80492ce0827a4cc8b19219be2b69cb8e/resources/ArcGIS_Field_Maps/icon.png",
    "FieldMapsDesigner.png",
    "arcgis-field-maps-designer.png"
  ],
  "ArcGIS Insights": ["Insights.png", "arcgis-insights.png"],
  "ArcGIS Mission Manager": [
    "https://jcgis.jacksongov.org/gisportal/sharing/rest/content/items/80492ce0827a4cc8b19219be2b69cb8e/resources/ArcGIS_Mission_Manager/icon.png",
    "MissionManager.png",
    "arcgis-mission-manager.png"
  ],
  "ArcGIS QuickCapture Web Designer": [
    `${JCGIS_PORTAL_ASSET_BASE_URL}quick-capture.png`,
    "QuickCapture.png",
    "arcgis-quickcapture.png"
  ],
  "ArcGIS Solutions": [
    `${JCGIS_PORTAL_ASSET_BASE_URL}solutions.png`,
    "https://cdn-a.arcgis.com/cdn/1C31855/js/arcgis-app-components/arcgis-app/assets/solutions.png",
    "Solutions.png",
    "arcgis-solutions.png"
  ],
  "Web Editor": [
    `${JCGIS_PORTAL_ASSET_BASE_URL}web-editor.png`,
    "WebEditor.png",
    "arcgis-web-editor.png"
  ],
  "ArcGIS GeoBIM": [
    "https://cdn-a.arcgis.com/cdn/1C31855/js/arcgis-app-components/arcgis-app/assets/geobim.png",
    "GeoBIM.png",
    "arcgis-geobim.png"
  ],
  "ArcGIS Runtime Basic": [
    "https://jcgis.jacksongov.org/gisportal/home/11.5.0/js/arcgisonline/sharing/dijit/css/images/app-icons/runtime.png",
    "Runtime.png",
    "arcgis-runtime.png"
  ],
  "ArcGIS Runtime Standard": [
    "https://jcgis.jacksongov.org/gisportal/home/11.5.0/js/arcgisonline/sharing/dijit/css/images/app-icons/runtime.png",
    "Runtime.png",
    "arcgis-runtime.png"
  ],
  "ArcGIS Runtime Advanced": [
    "https://jcgis.jacksongov.org/gisportal/home/11.5.0/js/arcgisonline/sharing/dijit/css/images/app-icons/runtime.png",
    "Runtime.png",
    "arcgis-runtime.png"
  ],
  "ArcGIS Indoors": [
    "https://cdn-a.arcgis.com/cdn/1C31855/js/arcgis-app-components/arcgis-app/assets/indoors.png",
    "Indoors.png",
    "arcgis-indoors.png"
  ],
  "Floor-aware maps": [
    "https://cdn-a.arcgis.com/cdn/1C31855/js/arcgis-app-components/arcgis-app/assets/indoors.png",
    "Indoors.png",
    "arcgis-indoors.png"
  ],
  "Indoor wayfinding": [
    "https://cdn-a.arcgis.com/cdn/1C31855/js/arcgis-app-components/arcgis-app/assets/indoors.png",
    "Indoors.png",
    "arcgis-indoors.png"
  ],
  "Workplace apps": [
    "https://cdn-a.arcgis.com/cdn/1C31855/js/arcgis-app-components/arcgis-app/assets/indoors.png",
    "Indoors.png",
    "arcgis-indoors.png"
  ],
  "Space planning": [
    "https://cdn-a.arcgis.com/cdn/1C31855/js/arcgis-app-components/arcgis-app/assets/indoors.png",
    "Indoors.png",
    "arcgis-indoors.png"
  ],
  "Room search": [
    "https://cdn-a.arcgis.com/cdn/1C31855/js/arcgis-app-components/arcgis-app/assets/indoors.png",
    "Indoors.png",
    "arcgis-indoors.png"
  ],
  "Reservations": [
    "https://cdn-a.arcgis.com/cdn/1C31855/js/arcgis-app-components/arcgis-app/assets/indoors.png",
    "Indoors.png",
    "arcgis-indoors.png"
  ],
  "ArcGIS Pro Basic": [
    "https://jcgis.jacksongov.org/gisportal/home/11.5.0/js/arcgisonline/sharing/dijit/css/images/app-icons/arcgis-pro.png",
    "ArcGISPro.png",
    "arcgis-pro.png"
  ],
  "ArcGIS Pro Standard": [
    "https://jcgis.jacksongov.org/gisportal/home/11.5.0/js/arcgisonline/sharing/dijit/css/images/app-icons/arcgis-pro.png",
    "ArcGISPro.png",
    "arcgis-pro.png"
  ],
  "ArcGIS Pro Advanced": [
    "https://jcgis.jacksongov.org/gisportal/home/11.5.0/js/arcgisonline/sharing/dijit/css/images/app-icons/arcgis-pro.png",
    "ArcGISPro.png",
    "arcgis-pro.png"
  ],
  "3D Analyst": [
    "https://jcgis.jacksongov.org/gisportal/home/11.5.0/js/arcgisonline/sharing/dijit/css/images/app-icons/pro-extension.png",
    "3DAnalyst.png",
    "arcgis-3d-analyst.png"
  ],
  "Business Analyst": [
    "https://jcgis.jacksongov.org/gisportal/home/11.5.0/js/arcgisonline/sharing/dijit/css/images/app-icons/pro-extension.png",
    "https://cdn-a.arcgis.com/cdn/1C31855/js/arcgis-app-components/arcgis-app/assets/business-analyst.png",
    "BusinessAnalyst.png",
    "arcgis-business-analyst.png"
  ],
  "Data Reviewer": [
    "https://jcgis.jacksongov.org/gisportal/home/11.5.0/js/arcgisonline/sharing/dijit/css/images/app-icons/pro-extension.png",
    "DataReviewer.png",
    "arcgis-data-reviewer.png"
  ],
  "Geostatistical Analyst": [
    "https://jcgis.jacksongov.org/gisportal/home/11.5.0/js/arcgisonline/sharing/dijit/css/images/app-icons/pro-extension.png",
    "GeostatisticalAnalyst.png",
    "arcgis-geostatistical-analyst.png"
  ],
  "Image Analyst": [
    "https://jcgis.jacksongov.org/gisportal/home/11.5.0/js/arcgisonline/sharing/dijit/css/images/app-icons/pro-extension.png",
    "ImageAnalyst.png",
    "arcgis-image-analyst.png"
  ],
  "Network Analyst": [
    "https://jcgis.jacksongov.org/gisportal/home/11.5.0/js/arcgisonline/sharing/dijit/css/images/app-icons/pro-extension.png",
    "NetworkAnalyst.png",
    "arcgis-network-analyst.png"
  ],
  "Publisher": [
    "https://jcgis.jacksongov.org/gisportal/home/11.5.0/js/arcgisonline/sharing/dijit/css/images/app-icons/pro-extension.png",
    "Publisher.png",
    "arcgis-publisher.png"
  ],
  "Spatial Analyst": [
    "https://jcgis.jacksongov.org/gisportal/home/11.5.0/js/arcgisonline/sharing/dijit/css/images/app-icons/pro-extension.png",
    "SpatialAnalyst.png",
    "arcgis-spatial-analyst.png"
  ],
  "Workflow Manager": [
    "https://jcgis.jacksongov.org/gisportal/home/11.5.0/js/arcgisonline/sharing/dijit/css/images/app-icons/pro-extension.png",
    `${JCGIS_PORTAL_ASSET_BASE_URL}workflow-manager.png`,
    "WorkflowManager.png",
    "arcgis-workflow-manager.png"
  ],
  "ArcGIS CityEngine": [
    "https://jcgis.jacksongov.org/gisportal/sharing/rest/content/items/80492ce0827a4cc8b19219be2b69cb8e/resources/ArcGIS_CityEngine/icon.png",
    "CityEngine.png",
    "arcgis-cityengine.png"
  ],
  "ArcGIS Advanced Editing": [
    "https://jcgis.jacksongov.org/gisportal/home/11.5.0/js/arcgisonline/sharing/dijit/css/images/app-icons/user-type-extension.png",
    "AdvancedEditing.png",
    "arcgis-advanced-editing.png"
  ],
  "ArcGIS Location Sharing": [
    "https://jcgis.jacksongov.org/gisportal/sharing/rest/content/items/80492ce0827a4cc8b19219be2b69cb8e/resources/ArcGIS_Location_Sharing/icon.png",
    "LocationSharing.png",
    "arcgis-location-sharing.png"
  ]
};

const ESRI_PRODUCT_GLYPH_ALIASES = {
  "Sites": ["sites", "arcgis-enterprise-sites", "enterprise-sites"],
  "ArcGIS AppStudio": ["arcgis-appstudio"],
  "ArcGIS Dashboards": ["arcgis-dashboards"],
  "ArcGIS Experience Builder": ["arcgis-experience-builder"],
  "ArcGIS Instant Apps": ["arcgis-instant-apps"],
  "ArcGIS Maps for Adobe Creative Cloud": ["arcgis-maps-for-adobe-creative-cloud", "maps-for-adobe-creative-cloud"],
  "ArcGIS StoryMaps": ["arcgis-storymaps"],
  "ArcGIS Web AppBuilder": ["arcgis-web-appbuilder"],
  "Configurable Apps": ["configurable-apps"],
  "Map Viewer": ["map-viewer"],
  "ArcGIS Hub": ["arcgis-hub"],
  "Scene Viewer": ["scene-viewer"],
  "ArcGIS Connectors for Power Automate": ["arcgis-connectors-for-power-automate", "power-automate"],
  "ArcGIS for Excel": ["arcgis-for-excel"],
  "ArcGIS for Power BI": ["arcgis-for-power-bi"],
  "ArcGIS for SharePoint": ["arcgis-for-sharepoint"],
  "ArcGIS for Teams": ["arcgis-for-teams"],
  "ArcGIS Collector": ["arcgis-collector", "collector"],
  "ArcGIS Field Maps": ["arcgis-field-maps", "field-maps"],
  "ArcGIS QuickCapture": ["arcgis-quickcapture", "quickcapture"],
  "ArcGIS Survey123": ["arcgis-survey123", "survey123"],
  "ArcGIS Workforce": ["arcgis-workforce", "workforce"],
  "ArcGIS Flight": ["arcgis-flight", "flight"],
  "ArcGIS Field Maps Designer": ["arcgis-field-maps-designer", "field-maps-designer"],
  "ArcGIS Insights": ["arcgis-insights", "insights"],
  "ArcGIS Mission Manager": ["arcgis-mission-manager", "mission-manager"],
  "ArcGIS QuickCapture Web Designer": ["arcgis-quickcapture", "quickcapture"],
  "ArcGIS Solutions": ["arcgis-solutions", "solutions"],
  "Web Editor": ["web-editor", "arcgis-web-editor"],
  "ArcGIS GeoBIM": ["arcgis-geobim", "geobim"],
  "ArcGIS Runtime Basic": ["arcgis-runtime", "runtime"],
  "ArcGIS Runtime Standard": ["arcgis-runtime", "runtime"],
  "ArcGIS Runtime Advanced": ["arcgis-runtime", "runtime"],
  "ArcGIS Indoors": ["arcgis-indoors", "indoors"],
  "Floor-aware maps": ["arcgis-indoors", "indoors"],
  "Indoor wayfinding": ["arcgis-indoors", "indoors"],
  "Workplace apps": ["arcgis-indoors", "indoors"],
  "Space planning": ["arcgis-indoors", "indoors"],
  "Room search": ["arcgis-indoors", "indoors"],
  "Reservations": ["arcgis-indoors", "indoors"],
  "ArcGIS Pro Basic": ["arcgis-pro"],
  "ArcGIS Pro Standard": ["arcgis-pro"],
  "ArcGIS Pro Advanced": ["arcgis-pro"],
  "3D Analyst": ["arcgis-3d-analyst"],
  "Business Analyst": ["arcgis-business-analyst", "business-analyst"],
  "Data Reviewer": ["arcgis-data-reviewer", "data-reviewer"],
  "Geostatistical Analyst": ["arcgis-geostatistical-analyst"],
  "Image Analyst": ["arcgis-image-analyst"],
  "Network Analyst": ["arcgis-network-analyst"],
  "Publisher": ["arcgis-publisher", "publisher"],
  "Spatial Analyst": ["arcgis-spatial-analyst"],
  "Workflow Manager": ["arcgis-workflow-manager", "workflow-manager"],
  "ArcGIS CityEngine": ["arcgis-cityengine", "cityengine"],
  "ArcGIS Advanced Editing": ["arcgis-advanced-editing", "advanced-editing"],
  "ArcGIS Location Sharing": ["arcgis-location-sharing", "location-sharing"]
};

const section = (title, items) => ({ title, items });
const item = (label, icon, color) => ({ label, icon, color });

const PROFILE_VALUE_KEYS = [
  "userType",
  "userTypeId",
  "userLicenseTypeId",
  "userLicenseTypeExtensions",
  "licenseType",
  "role",
  "roleName"
];

function collectProfileStringValues(user, keys) {
  const values = [];
  const sourceJson = user?.sourceJSON && typeof user.sourceJSON === "object"
    ? user.sourceJSON
    : null;

  const pushString = (rawValue) => {
    const text = String(rawValue ?? "").trim();
    if (text) values.push(text);
  };

  const pushValue = (rawValue) => {
    if (rawValue == null) return;
    if (Array.isArray(rawValue)) {
      rawValue.forEach(pushValue);
      return;
    }
    if (typeof rawValue === "object") {
      pushString(rawValue.id);
      pushString(rawValue.name);
      pushString(rawValue.title);
      pushString(rawValue.value);
      return;
    }
    pushString(rawValue);
  };

  keys.forEach((key) => {
    pushValue(user?.[key]);
    pushValue(sourceJson?.[key]);
  });

  return [...new Set(values)];
}

function getLicenseFromProfileValues(values) {
  const combined = values.join(" ").toLowerCase();
  if (!combined) return null;

  if (combined.includes("professional plus")) return { key: "professional-plus", label: "Professional Plus", icon: "ribbon", color: "#ff9f43", plus: true };
  if (combined.includes("professional")) return { key: "professional", label: "Professional", icon: "ribbon", color: "#f3c44e", plus: false };
  if (combined.includes("creator")) return { key: "creator", label: "Creator", icon: "pencil", color: "#b35fd6", plus: false };
  if (combined.includes("contributor") || combined.includes("editor")) return { key: "contributor", label: "Contributor", icon: "collaboration", color: "#2f9e44", plus: false };
  if (combined.includes("mobile worker") || combined.includes("field worker")) return { key: "mobile-worker", label: "Mobile Worker", icon: "compass-north-circle", color: "#67d46f", plus: false };
  if (combined.includes("indoors")) return { key: "indoors-user", label: "Indoors User", icon: "3d-building", color: "#3f7fd6", plus: false };
  if (combined.includes("viewer")) return { key: "viewer", label: "Viewer", icon: "check", color: "#66b8ff", plus: false };

  return null;
}

function getUserLicensePresentation(user) {
  if (!user) return null;
  const profileValues = collectProfileStringValues(user, PROFILE_VALUE_KEYS);
  return getLicenseFromProfileValues(profileValues);
}

function getRawAccountTypeLabel(user) {
  const license = getUserLicensePresentation(user);
  if (license?.label) return license.label;

  const profileValues = collectProfileStringValues(user, PROFILE_VALUE_KEYS);
  const accountTypeValue = profileValues.find((value) => {
    const normalizedValue = value.toLowerCase();
    if (normalizedValue === "argisonly" || normalizedValue === "arcgisonly") return false;
    if (normalizedValue === "nameduser") return false;
    return true;
  });

  return accountTypeValue || "Signed in";
}

function getArcProTierForLicense(license) {
  switch (license?.key) {
    case "creator":
      return "Basic";
    case "professional":
      return "Standard";
    case "professional-plus":
      return "Advanced";
    default:
      return "Not included";
  }
}

function getLicenseAccessDetails(license) {
  const essentialApps = () => ([
    item("ArcGIS AppStudio", "organization", "#7a62ef"),
    item("ArcGIS Dashboards", "graph-time-series", "#e59a28"),
    item("Sites", "organization", "#6698ef"),
    item("ArcGIS Experience Builder", "organization", "#31c6df"),
    item("ArcGIS Instant Apps", "view-visible", "#7fb756"),
    item("ArcGIS Maps for Adobe Creative Cloud", "map", "#d98673"),
    item("ArcGIS StoryMaps", "view-visible", "#6d63ef"),
    item("ArcGIS Web AppBuilder", "organization", "#23b8cf"),
    item("Configurable Apps", "organization", "#6f97e5"),
    item("Map Viewer", "map", "#42bbd9"),
    item("ArcGIS Hub", "organization", "#7a98dc"),
    item("Scene Viewer", "view-visible", "#d67f68")
  ]);

  const officeApps = () => ([
    item("ArcGIS Connectors for Power Automate", "organization", "#6698ef"),
    item("ArcGIS for Excel", "graph-time-series", "#82b85c"),
    item("ArcGIS for Power BI", "graph-time-series", "#d6b24e"),
    item("ArcGIS for SharePoint", "organization", "#38bfd7"),
    item("ArcGIS for Teams", "collaboration", "#7763ef")
  ]);

  const fieldAppsBasic = () => ([item("ArcGIS Field Maps", "map", "#6e97ef")]);

  const fieldAppsMobile = () => ([
    item("ArcGIS Collector", "annotate-tool", "#2cb8d0"),
    item("ArcGIS Field Maps", "map", "#6e97ef"),
    item("ArcGIS QuickCapture", "annotate-tool", "#c9954f"),
    item("ArcGIS Survey123", "information", "#88b73d"),
    item("ArcGIS Workforce", "organization", "#7763ef")
  ]);

  const creatorApps = () => ([
    item("ArcGIS Flight", "compass-north-circle", "#d0933d"),
    item("ArcGIS Field Maps Designer", "map", "#5f8ee7"),
    item("ArcGIS Insights", "graph-time-series", "#d6b14b"),
    item("ArcGIS Mission Manager", "organization", "#7a62ef"),
    item("ArcGIS QuickCapture Web Designer", "annotate-tool", "#ca8d44"),
    item("ArcGIS Solutions", "organization", "#7fb756"),
    item("Web Editor", "pencil", "#31c6df")
  ]);

  const proPlusAddOns = () => ([
    item("ArcGIS Pro Advanced", "ribbon", "#5e8ee6"),
    item("3D Analyst", "3d-building", "#7a62ef"),
    item("Business Analyst", "graph-time-series", "#2cb8d0"),
    item("Data Reviewer", "check", "#88b73d"),
    item("Geostatistical Analyst", "graph-time-series", "#d0933d"),
    item("Image Analyst", "view-visible", "#d67f68"),
    item("Network Analyst", "organization", "#6d63ef"),
    item("Publisher", "organization", "#2cb8d0"),
    item("Spatial Analyst", "map", "#d6b14b"),
    item("Workflow Manager", "organization", "#8a63ef")
  ]);

  const fallback = {
    title: "License Access",
    summary: "This account can open the maps, apps, and workflows shared to it within Jackson County GIS.",
    sections: [section("Applications", essentialApps().slice(0, 4))]
  };

  if (!license?.key) return fallback;

  const detailMap = {
    "viewer": {
      title: "Viewer Access",
      summary: "Core read-only access for shared maps, apps, office integrations, and parcel review tools.",
      sections: [
        section("Essential Apps", essentialApps()),
        section("Office Apps", officeApps()),
        section("Field Apps", fieldAppsBasic()),
        section("Capabilities", [item("ArcGIS GeoBIM", "3d-building", "#74b84a")]),
        section("ArcGIS Runtime", [item("ArcGIS Runtime Basic", "organization", "#7b61ff")])
      ]
    },
    "contributor": {
      title: "Contributor Access",
      summary: "Everything in Viewer plus shared editing and contribution workflows across county apps.",
      sections: [
        section("Essential Apps", essentialApps()),
        section("Office Apps", officeApps()),
        section("Field Apps", fieldAppsBasic()),
        section("Capabilities", [item("ArcGIS GeoBIM", "3d-building", "#74b84a")]),
        section("ArcGIS Runtime", [item("ArcGIS Runtime Basic", "organization", "#7b61ff")])
      ]
    },
    "mobile-worker": {
      title: "Mobile Worker Access",
      summary: "Field-ready access with mobile collection apps, office integrations, and operational tools.",
      sections: [
        section("Essential Apps", essentialApps()),
        section("Field Apps", fieldAppsMobile()),
        section("Office Apps", officeApps()),
        section("Additional Apps", [item("ArcGIS Flight", "compass-north-circle", "#d0933d")]),
        section("Capabilities", [
          item("ArcGIS Location Sharing", "compass-north-circle", "#27c7de"),
          item("ArcGIS GeoBIM", "3d-building", "#74b84a")
        ]),
        section("ArcGIS Runtime", [item("ArcGIS Runtime Basic", "organization", "#7b61ff")])
      ]
    },
    "creator": {
      title: "Creator Access",
      summary: "Authoring access for building maps, apps, editable workflows, and creator-level ArcGIS tools.",
      sections: [
        section("Add-on Licenses", [item("ArcGIS Pro Basic", "ribbon", "#4f8df7")]),
        section("Essential Apps", essentialApps()),
        section("Field Apps", fieldAppsMobile()),
        section("Office Apps", officeApps()),
        section("Additional Apps", creatorApps()),
        section("Capabilities", [item("ArcGIS GeoBIM", "3d-building", "#74b84a")]),
        section("ArcGIS Runtime", [item("ArcGIS Runtime Standard", "organization", "#7b61ff")])
      ]
    },
    "professional": {
      title: "Professional Access",
      summary: "Creator access plus deeper GIS production, advanced maintenance, and analytical workflows.",
      sections: [
        section("Add-on Licenses", [item("ArcGIS Pro Standard", "ribbon", "#4f8df7")]),
        section("Essential Apps", essentialApps()),
        section("Field Apps", fieldAppsMobile()),
        section("Office Apps", officeApps()),
        section("Additional Apps", creatorApps()),
        section("Capabilities", [
          item("ArcGIS GeoBIM", "3d-building", "#74b84a"),
          item("ArcGIS Advanced Editing", "pencil", "#8f63ff")
        ]),
        section("ArcGIS Runtime", [item("ArcGIS Runtime Advanced", "organization", "#7b61ff")])
      ]
    },
    "professional-plus": {
      title: "Professional Plus Access",
      summary: "Top-tier access with the broadest ArcGIS Pro extensions, premium apps, advanced editing, and enterprise GIS tooling.",
      sections: [
        section("Add-on Licenses", proPlusAddOns()),
        section("Essential Apps", essentialApps()),
        section("Field Apps", fieldAppsMobile()),
        section("Office Apps", officeApps()),
        section("Additional Apps", [item("ArcGIS CityEngine", "3d-building", "#ff7a59"), ...creatorApps()]),
        section("Capabilities", [
          item("ArcGIS GeoBIM", "3d-building", "#74b84a"),
          item("ArcGIS Advanced Editing", "pencil", "#8f63ff")
        ]),
        section("ArcGIS Runtime", [item("ArcGIS Runtime Advanced", "organization", "#7b61ff")])
      ]
    },
    "indoors-user": {
      title: "Indoors User Access",
      summary: "Indoor mapping access for floor-aware wayfinding, workplace, and facilities experiences.",
      sections: [
        section("Applications", [
          item("ArcGIS Indoors", "3d-building", "#5f8ee7"),
          item("Floor-aware maps", "map", "#31c6df"),
          item("Indoor wayfinding", "compass-north-circle", "#7763ef"),
          item("Workplace apps", "organization", "#7fb756")
        ]),
        section("Office Apps", [item("ArcGIS for Teams", "collaboration", "#7763ef")]),
        section("Capabilities", [
          item("Space planning", "organization", "#d6a14b"),
          item("Room search", "view-visible", "#5f8ee7"),
          item("Reservations", "check", "#7fb756")
        ])
      ]
    }
  };

  return detailMap[license.key] || fallback;
}

function orderLicenseSections(sections) {
  const priority = new Map([
    ["Essential Apps", 10],
    ["Field Apps", 20],
    ["Office Apps", 30],
    ["Additional Apps", 40],
    ["Applications", 50],
    ["Capabilities", 60],
    ["Add-on Licenses", 70],
    ["ArcGIS Runtime", 80]
  ]);

  return [...(sections || [])].sort((a, b) => {
    const aPriority = priority.get(a?.title) ?? 999;
    const bPriority = priority.get(b?.title) ?? 999;
    if (aPriority !== bPriority) return aPriority - bPriority;
    const aCount = Array.isArray(a?.items) ? a.items.length : 0;
    const bCount = Array.isArray(b?.items) ? b.items.length : 0;
    if (aCount !== bCount) return bCount - aCount;
    return String(a?.title || "").localeCompare(String(b?.title || ""));
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slugifyEsriLabel(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function uniqueList(values) {
  return [...new Set(values.filter(Boolean))];
}

function getPortalGroupContentUrl(groupId) {
  return `${JCGIS_PORTAL_HOME_BASE_URL}group.html?id=${encodeURIComponent(groupId)}#content`;
}

function appendTokenToUrl(url, token) {
  const trimmedUrl = String(url || "").trim();
  const trimmedToken = String(token || "").trim();

  if (!trimmedUrl || !trimmedToken) return trimmedUrl;
  if (/[?&]token=/i.test(trimmedUrl)) return trimmedUrl;

  try {
    const nextUrl = new URL(trimmedUrl, window.location.href);
    nextUrl.searchParams.set("token", trimmedToken);
    return nextUrl.toString();
  } catch {
    const separator = trimmedUrl.includes("?") ? "&" : "?";
    return `${trimmedUrl}${separator}token=${encodeURIComponent(trimmedToken)}`;
  }
}

function getGroupThumbnailUrl(group, token) {
  const portalBaseUrl = String(APP_AUTH_CONFIG?.portalUrl || "").replace(/\/+$/, "");
  const thumbnailName = String(group?.thumbnail || group?.sourceJSON?.thumbnail || "").trim();
  const restThumbnailUrl = group?.id && thumbnailName && portalBaseUrl
    ? `${portalBaseUrl}/sharing/rest/community/groups/${encodeURIComponent(group.id)}/info/${encodeURIComponent(thumbnailName)}?w=150`
    : "";
  const rawThumbnailUrl = String(
    group?.getThumbnailUrl?.(150) ||
    group?.thumbnailUrl ||
    restThumbnailUrl ||
    ""
  ).trim();

  return appendTokenToUrl(rawThumbnailUrl, token);
}

function normalizeUserGroups(groups, token = "") {
  return (groups || [])
    .map((group) => ({
      id: String(group?.id || "").trim(),
      title: String(group?.title || "").trim(),
      thumbnailUrl: getGroupThumbnailUrl(group, token)
    }))
    .filter((group) => group.title)
    .sort((a, b) => a.title.localeCompare(b.title));
}

function getGroupChipPalette(title) {
  const palettes = [
    { chipBg: "#fff6d6", chipBorder: "#f0d36a", avatarBg: "#ffe896", avatarColor: "#715000" },
    { chipBg: "#ebffd8", chipBorder: "#8fd866", avatarBg: "#cfffaa", avatarColor: "#2f6b1a" },
    { chipBg: "#e1f1ff", chipBorder: "#77baff", avatarBg: "#b9ddff", avatarColor: "#174f87" },
    { chipBg: "#fae6ff", chipBorder: "#d48cff", avatarBg: "#efc2ff", avatarColor: "#6e2b8f" },
    { chipBg: "#ffe9dc", chipBorder: "#ffb278", avatarBg: "#ffd0ae", avatarColor: "#8b4a18" },
    { chipBg: "#e6ffff", chipBorder: "#69dddd", avatarBg: "#baf7f7", avatarColor: "#1d7070" },
    { chipBg: "#ece8ff", chipBorder: "#9a8cff", avatarBg: "#d0c8ff", avatarColor: "#493e94" },
    { chipBg: "#f2ffd8", chipBorder: "#b8e05e", avatarBg: "#dcf5a9", avatarColor: "#556d14" }
  ];
  const normalizedTitle = String(title || "");
  let hash = 0;

  for (let index = 0; index < normalizedTitle.length; index += 1) {
    hash = ((hash * 31) + normalizedTitle.charCodeAt(index)) >>> 0;
  }

  return palettes[hash % palettes.length];
}

function getGroupChipShortText(title) {
  const words = String(title || "")
    .split(/[^a-z0-9]+/i)
    .map((word) => word.trim())
    .filter(Boolean);

  if (!words.length) return "GRP";
  if (words.length === 1) return words[0].slice(0, 4).toUpperCase();
  if (words.length === 2) return `${words[0].charAt(0)}${words[1].slice(0, 3)}`.toUpperCase();
  return words.slice(0, 4).map((word) => word.charAt(0)).join("").toUpperCase();
}

function getReadableRoleLabel(user) {
  const explicitRoleName = [
    user?.roleName,
    user?.sourceJSON?.roleName
  ]
    .map((value) => String(value || "").trim())
    .find((value) => value && !/^org_(admin|publisher|user)$/i.test(value));

  if (explicitRoleName) {
    return explicitRoleName
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  const normalizedRole = String(user?.role || user?.sourceJSON?.role || "").trim().toLowerCase();
  const baseRoleLabel = {
    org_admin: "Enterprise Administrator",
    org_publisher: "Publisher",
    org_user: "User"
  }[normalizedRole];

  if (baseRoleLabel) return baseRoleLabel;

  const fallbackRole = String(user?.role || user?.sourceJSON?.role || "").trim();
  if (!fallbackRole) return "Standard user";

  return fallbackRole
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

async function fetchCustomRoleName(user, appAuth) {
  const roleId = String(user?.roleId || user?.sourceJSON?.roleId || "").trim();
  const orgId = String(user?.orgId || user?.sourceJSON?.orgId || "").trim();
  if (!roleId || !orgId) return "";

  const portalBase = String(APP_AUTH_CONFIG?.portalUrl || "").replace(/\/+$/, "");
  if (!portalBase) return "";

  const token = String(appAuth?.getCredential?.()?.token || "").trim();
  if (!token) return "";

  try {
    const endpoint = new URL(`${portalBase}/sharing/rest/portals/${encodeURIComponent(orgId)}/roles/${encodeURIComponent(roleId)}`);
    endpoint.searchParams.set("f", "json");
    endpoint.searchParams.set("token", token);

    const response = await fetch(endpoint.toString(), { method: "GET" });
    if (!response.ok) return "";

    const payload = await response.json();
    if (payload?.error) return "";

    const roleName = String(payload?.name || "").trim();
    if (!roleName) return "";

    return roleName
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (character) => character.toUpperCase());
  } catch {
    return "";
  }
}

function isArcProIncluded(license) {
  return getArcProTierForLicense(license) !== "Not included";
}

function buildArcProLaunchMarkup(tierLabel) {
  return `
    <button class="header-user-menu-pro-launch-plain" type="button" title="Open ArcGIS Pro on this desktop">
      <img class="header-user-menu-pro-link-icon" src="${escapeHtml(ARC_PRO_ICON_URL)}" alt="" loading="lazy">
      <span class="header-user-menu-pro-version">${escapeHtml(tierLabel)}</span>
    </button>
  `;
}

function launchArcProDesktop() {
  const launchUri = (uri) => {
    try {
      window.location.href = uri;
      return true;
    } catch {
      return false;
    }
  };

  if (window.navigator && typeof window.navigator.msLaunchUri === "function") {
    window.navigator.msLaunchUri(ARC_PRO_DESKTOP_URIS[0], () => {}, () => {
      launchUri(ARC_PRO_DESKTOP_URIS[1]);
    });
    return;
  }

  const launchedPrimary = launchUri(ARC_PRO_DESKTOP_URIS[0]);
  if (!launchedPrimary) {
    launchUri(ARC_PRO_DESKTOP_URIS[1]);
  } else {
    window.setTimeout(() => {
      launchUri(ARC_PRO_DESKTOP_URIS[1]);
    }, 280);
  }
}

async function updateRoleLabelFromPortal(user, appAuth, elements) {
  if (!elements?.accountRole || !user) return;
  const customRoleName = await fetchCustomRoleName(user, appAuth);
  if (!customRoleName) return;

  const currentUsername = String(elements.accountUsername?.textContent || "").trim().toLowerCase();
  const expectedUsername = String(user?.username || "").trim().toLowerCase();
  if (currentUsername && expectedUsername && currentUsername !== expectedUsername) return;

  elements.accountRole.textContent = customRoleName;
}

function buildGroupChipMarkup(group) {
  const label = escapeHtml(group.title);
  const shortText = escapeHtml(getGroupChipShortText(group.title));
  const palette = getGroupChipPalette(group.title);
  const chipStyle = escapeHtml([
    `--group-chip-bg:${palette.chipBg}`,
    `--group-chip-border:${palette.chipBorder}`,
    `--group-avatar-bg:${palette.avatarBg}`,
    `--group-avatar-color:${palette.avatarColor}`
  ].join(";"));
  const avatarStyle = escapeHtml([
    `--calcite-avatar-background-color:${palette.avatarBg}`,
    `--calcite-avatar-color:${palette.avatarColor}`
  ].join(";"));
  const mediaMarkup = group.thumbnailUrl
    ? `<span slot="image" class="header-user-group-chip-media"><calcite-avatar class="header-user-group-chip-avatar" label="${label}" thumbnail="${escapeHtml(group.thumbnailUrl)}" style="${avatarStyle}"></calcite-avatar></span>`
    : `<span slot="image" class="header-user-group-chip-media"><span class="header-user-group-chip-icon-shell" style="${escapeHtml(`--group-avatar-bg:${palette.avatarBg};--group-avatar-color:${palette.avatarColor}`)}"><calcite-icon class="header-user-group-chip-icon" icon="group" scale="s"></calcite-icon></span></span>`;
  const chipMarkup = `
    <calcite-chip class="header-user-group-chip" value="${label}" label="${label}" title="${label}" appearance="outline-fill" kind="neutral" scale="m" style="${chipStyle}">
      ${mediaMarkup}
      <span class="header-user-group-chip-short">${shortText}</span>
    </calcite-chip>
  `;
  if (!group.id) {
    return `
      <span class="header-user-group-chip-static" title="${label}">
        ${chipMarkup}
        <span class="header-user-group-chip-label">${label}</span>
      </span>
    `;
  }
  return `
    <a class="header-user-group-chip-link" href="${escapeHtml(getPortalGroupContentUrl(group.id))}" target="_blank" rel="noopener noreferrer" title="Open ${label} group content" aria-label="Open ${label} group content">
      ${chipMarkup}
      <span class="header-user-group-chip-label">${label}</span>
    </a>
  `;
}

function renderGroupChips(container, { groups = [], loading = false, error = false } = {}) {
  if (!container) return;

  if (loading) {
    container.innerHTML = '<div class="header-user-group-status">Loading groups...</div>';
    return;
  }

  if (error) {
    container.innerHTML = '<div class="header-user-group-status">Unable to load groups</div>';
    return;
  }

  if (!groups.length) {
    container.innerHTML = '<div class="header-user-group-status">No groups found</div>';
    return;
  }

  container.innerHTML = `
    <calcite-chip-group class="header-user-group-chip-grid" group-display="all">
      ${groups.map((group) => buildGroupChipMarkup(group)).join("")}
    </calcite-chip-group>
  `;
}

function getEsriItemUrl(label) {
  const directUrl = STANDARD_ENTERPRISE_APP_URLS[label];
  if (directUrl) return directUrl;
  const searchTerm = PREVIEW_ITEM_SEARCH_TERMS[label] || label;
  return `${JCGIS_PORTAL_HOME_BASE_URL}search.html?q=${encodeURIComponent(searchTerm)}`;
}

function getEsriItemLogoCandidates(label) {
  const marketplaceCandidates = MARKETPLACE_BADGE_URLS[label] || [];
  const aliasSlugs = ESRI_PRODUCT_GLYPH_ALIASES[label] || [];
  const genericSlug = slugifyEsriLabel(label);
  const glyphSlugs = uniqueList([
    ...aliasSlugs,
    genericSlug,
    genericSlug.startsWith("arcgis-") ? genericSlug : `arcgis-${genericSlug}`
  ]);
  const glyphCandidates = glyphSlugs.map((slug) => `${ESRI_PRODUCT_GLYPH_BASE_URL}${slug}-glyph-48?dpr=off`);
  const logoCandidates = (ESRI_PRODUCT_LOGO_CANDIDATES[label] || []).map((fileName) =>
    /^https?:\/\//i.test(fileName) ? fileName : `${ESRI_PRODUCT_LOGO_BASE_URL}${fileName}`
  );
  return uniqueList([...marketplaceCandidates, ...logoCandidates, ...glyphCandidates]);
}

function buildItemMedia(entry) {
  const imageCandidates = getEsriItemLogoCandidates(entry.label);
  const accent = escapeHtml(entry.color || "#66b8ff");
  const fallbackIcon = escapeHtml(entry.icon || "organization");
  const overlayIcon = OVERLAY_ICON_BY_LABEL[entry.label] ? escapeHtml(OVERLAY_ICON_BY_LABEL[entry.label]) : "";
  const overlayClasses = CENTERED_OVERLAY_ICON_LABELS[entry.label]
    ? "header-user-license-chip-overlay centered"
    : "header-user-license-chip-overlay";
  const overlayMarkup = overlayIcon ? `<calcite-icon class="${overlayClasses}" icon="${overlayIcon}" scale="s"></calcite-icon>` : "";

  if (!imageCandidates.length) {
    return `
      <span class="header-user-license-chip-media" style="--tile-accent:${accent}">
        <calcite-icon class="header-user-license-chip-fallback" icon="${fallbackIcon}" scale="m"></calcite-icon>
        ${overlayMarkup}
      </span>
    `;
  }

  const [primarySrc, ...fallbackSources] = imageCandidates;
  const fallbackAttr = fallbackSources.length ? ` data-fallback-srcs="${escapeHtml(fallbackSources.join("|"))}"` : "";

  return `
    <span class="header-user-license-chip-media" style="--tile-accent:${accent}">
      <img class="header-user-license-chip-image" src="${escapeHtml(primarySrc)}" alt="" loading="lazy"${fallbackAttr}
        onerror="var next=(this.dataset.fallbackSrcs||'').split('|').filter(Boolean);if(next.length){this.dataset.fallbackSrcs=next.slice(1).join('|');this.src=next[0];return;}this.hidden=true;this.nextElementSibling.hidden=false;var tile=this.closest('.header-user-license-chip');if(tile)tile.dataset.visual='fallback';">
      <calcite-icon class="header-user-license-chip-fallback" icon="${fallbackIcon}" scale="m" hidden></calcite-icon>
      ${overlayMarkup}
    </span>
  `;
}

function buildItemTile(entry) {
  return `
    <a class="header-user-license-chip" style="--tile-accent:${escapeHtml(entry.color || "#66b8ff")}" href="${escapeHtml(getEsriItemUrl(entry.label))}" target="_blank" rel="noopener noreferrer" title="Open ${escapeHtml(entry.label)} in Portal">
      ${buildItemMedia(entry)}
      <span class="header-user-license-chip-label">${escapeHtml(entry.label)}</span>
    </a>
  `;
}

function buildLicenseBadgeMarkup(license) {
  if (!license) return "";
  return `
    <span class="header-user-menu-license-badge" style="color:${escapeHtml(license.color)}">
      <calcite-icon icon="${escapeHtml(license.icon)}" scale="s" style="color:${escapeHtml(license.color)}"></calcite-icon>
      ${license.plus ? '<calcite-icon class="header-user-menu-license-plus" icon="plus" scale="s"></calcite-icon>' : ""}
    </span>
  `;
}

function buildLicensePillMarkup(license) {
  if (!license) return "";
  return `
    ${buildLicenseBadgeMarkup(license)}
    <span class="header-user-menu-license-text">${escapeHtml(license.label)}</span>
    <calcite-icon class="header-user-menu-license-chevron" icon="chevron-down" scale="s"></calcite-icon>
  `;
}

function buildUserTypeValueMarkup(label, license) {
  const safeLabel = escapeHtml(label || "Signed in");
  if (!license) return safeLabel;

  return `
    <span class="header-user-menu-type-pill" style="color:${escapeHtml(license.color)}">
      ${buildLicenseBadgeMarkup(license)}
      <span class="header-user-menu-type-pill-text">${safeLabel}</span>
    </span>
  `;
}

function formatDisplayName(user) {
  return String(user?.fullName || user?.username || "Signed In User").trim();
}

const COLLAPSED_POPUP_SIZE = { width: 660, height: 270 };
const EXPANDED_POPUP_SIZE = { width: 920, height: 640 };
const COLLAPSED_MENU_WIDTH = 620;
const EXPANDED_MENU_WIDTH = 1080;
const COLLAPSED_MENU_HEIGHT = 230;
const EXPANDED_MENU_HEIGHT = 640;

function isEmbeddedContext() {
  return new URL(window.location.href).searchParams.get("embed") === "1" && window.parent && window.parent !== window;
}

function postEmbedMessage(type) {
  if (!isEmbeddedContext()) return;
  window.parent.postMessage({ type }, window.location.origin);
}

function isPopupContext() {
  try {
    return !!window.opener && !window.opener.closed;
  } catch {
    return false;
  }
}

function movePopupWindow(width, height) {
  if (!isPopupContext() || typeof window.resizeTo !== "function") return;

  let left = Math.max(0, Math.round(window.screenX || 0));
  let top = Math.max(0, Math.round(window.screenY || 0));

  try {
    const opener = window.opener;
    left = Math.max(0, Math.round(opener.screenX + ((opener.outerWidth - width) / 2)));
    top = Math.max(0, Math.round(opener.screenY + ((opener.outerHeight - height) / 2)));
  } catch {
    left = Math.max(0, Math.round((window.screen.availWidth - width) / 2));
    top = Math.max(0, Math.round((window.screen.availHeight - height) / 2));
  }

  try {
    window.resizeTo(width, height);
    if (typeof window.moveTo === "function") {
      window.moveTo(left, top);
    }
  } catch {
  }
}

function syncPopupSize(expanded) {
  const nextSize = expanded ? EXPANDED_POPUP_SIZE : COLLAPSED_POPUP_SIZE;
  window.setTimeout(() => movePopupWindow(nextSize.width, nextSize.height), 40);
}

function setExpandedState(elements, expanded) {
  document.body.classList.toggle("expanded", expanded);
  if (elements.menuRoot) {
    elements.menuRoot.classList.toggle("expanded", expanded);
  }
  if (elements.detailsPanel) {
    elements.detailsPanel.hidden = !expanded;
  }
  if (elements.accountInfoBtn) {
    elements.accountInfoBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
  }
  if (elements.licensePill) {
    elements.licensePill.setAttribute("aria-expanded", expanded ? "true" : "false");
    elements.licensePill.hidden = true;
  }
  if (elements.accountInfoBtnText) {
    elements.accountInfoBtnText.textContent = expanded ? "Hide Info" : "Account Info";
  }
  if (elements.accountInfoBtnIcon) {
    elements.accountInfoBtnIcon.setAttribute("icon", expanded ? "minimize" : "information");
  }
  syncPopupSize(expanded);
  syncEmbeddedSize(elements);
}

function closeOrReturnToApp() {
  if (isEmbeddedContext()) {
    postEmbedMessage(ACCOUNT_EMBED_MESSAGE_CLOSE);
    return;
  }
  if (isPopupContext()) {
    window.close();
    return;
  }
  window.location.href = "./index.html";
}

function setAccountPageReady() {
  document.body.classList.add("account-page-ready");
}

function syncEmbeddedSize(elements) {
  if (!isEmbeddedContext()) return;
  const target = !elements.layout?.hidden
    ? elements.menuRoot
    : (!elements.emptyState?.hidden ? elements.emptyState : null);
  if (!target) return;

  window.requestAnimationFrame(() => {
    const rect = target.getBoundingClientRect();
    const frameInset = 20;
    const expanded = target.classList.contains("expanded") || document.body.classList.contains("expanded");
    const baseWidth = expanded ? EXPANDED_MENU_WIDTH : COLLAPSED_MENU_WIDTH;
    const baseHeight = expanded ? EXPANDED_MENU_HEIGHT : COLLAPSED_MENU_HEIGHT;
    const width = baseWidth + frameInset;
    const measuredHeight = Math.ceil(Math.max(rect.height || 0, target.scrollHeight || 0) + frameInset);
    const height = elements.layout?.hidden ? measuredHeight : Math.max(baseHeight, measuredHeight);
    if (!width || !height) return;
    window.parent.postMessage({
      type: ACCOUNT_EMBED_MESSAGE_SIZE,
      width,
      height,
      expanded
    }, window.location.origin);
  });
}

function renderSignedOut(elements) {
  elements.emptyState.hidden = false;
  elements.layout.hidden = true;
  setExpandedState(elements, false);
  setAccountPageReady();
  syncEmbeddedSize(elements);
}

function renderSignedIn(elements, user) {
  const license = getUserLicensePresentation(user);
  const details = getLicenseAccessDetails(license);
  const rawAccountType = license?.label || getRawAccountTypeLabel(user);
  const username = String(user?.username || "").trim() || "Unknown";
  const role = getReadableRoleLabel(user);
  const arcProTier = getArcProTierForLicense(license);
  const hasArcPro = isArcProIncluded(license);

  elements.emptyState.hidden = true;
  elements.layout.hidden = false;
  elements.licensePill.hidden = true;
  elements.licensePill.innerHTML = buildLicensePillMarkup({
    ...license,
    label: rawAccountType
  });
  elements.licensePill.style.color = license?.color || "#f4f8ff";
  if (elements.accountName) {
    elements.accountName.textContent = "Account Info";
  }
  elements.accountType.innerHTML = buildUserTypeValueMarkup(rawAccountType, license);
  elements.accountType.title = rawAccountType;
  if (elements.accountProRow) {
    elements.accountProRow.hidden = !hasArcPro;
  }
  if (hasArcPro) {
    elements.accountPro.innerHTML = buildArcProLaunchMarkup(arcProTier);
    const proLaunchButton = elements.accountPro.querySelector(".header-user-menu-pro-launch-plain");
    proLaunchButton?.addEventListener("click", (event) => {
      event.preventDefault();
      launchArcProDesktop();
    });
  } else {
    elements.accountPro.textContent = "";
  }
  elements.accountUsername.textContent = username;
  elements.accountRole.textContent = role;
  elements.licenseTitle.textContent = "License Access";
  elements.licenseSummary.textContent = "This account can open the maps, apps, and workflows shared to it within Jackson County GIS.";

  const orderedSections = orderLicenseSections(details.sections);
  elements.sections.innerHTML = orderedSections.map((group) => `
    <div class="header-user-license-section">
      <div class="header-user-license-section-title">${escapeHtml(group.title)}</div>
      <div class="header-user-license-chip-grid">
        ${(group.items || []).map((entry) => buildItemTile(entry)).join("")}
      </div>
    </div>
  `).join("");

  setExpandedState(elements, false);
  setAccountPageReady();
  syncEmbeddedSize(elements);
}

async function main() {
  const appAuth = await createPortalAuth(APP_AUTH_CONFIG);
  const embedded = isEmbeddedContext();
  const getElement = (...ids) => ids.map((id) => document.getElementById(id)).find(Boolean) || null;
  const elements = {
    menuRoot: getElement("accountMenu", "userAuthMenu"),
    emptyState: getElement("emptyState"),
    layout: getElement("accountLayout"),
    signInBtn: getElement("accountSignInBtn"),
    signOutBtn: getElement("signOutBtn", "userAuthSignOutBtn"),
    backLink: getElement("backLink"),
    closeWindowBtn: getElement("closeWindowBtn"),
    accountInfoBtn: getElement("accountInfoBtn", "userAuthDetailsToggleBtn"),
    accountInfoBtnIcon: getElement("accountInfoBtnIcon") || getElement("userAuthDetailsToggleBtn")?.querySelector("calcite-icon"),
    accountInfoBtnText: getElement("accountInfoBtnText", "userAuthDetailsToggleText"),
    detailsPanel: getElement("detailsPanel", "userAuthLicensePanel"),
    groupsRow: getElement("groupsRow", "userAuthMenuGroupsRow"),
    licensePill: getElement("licensePill", "userAuthMenuLicenseBtn"),
    accountName: getElement("accountName", "userAuthMenuName"),
    accountType: getElement("accountType", "userAuthMenuType"),
    accountProRow: getElement("accountProRow", "userAuthMenuProRow"),
    accountPro: getElement("accountPro", "userAuthMenuPro"),
    accountUsername: getElement("accountUsername", "userAuthMenuUsername"),
    accountRole: getElement("accountRole", "userAuthMenuRole"),
    accountGroups: getElement("accountGroups", "userAuthMenuGroupsValue"),
    licenseTitle: getElement("licenseTitle", "userAuthLicensePanelTitle"),
    licenseSummary: getElement("licenseSummary", "userAuthLicensePanelSummary"),
    sections: getElement("accountSections", "userAuthLicenseFeatureList"),
    portalBtn: getElement("portalBtn", "userAuthPortalBtn"),
    agolBtn: getElement("agolBtn", "userAuthAgolBtn")
  };

  if (embedded) {
    document.documentElement.classList.add("embed-mode");
    document.body.classList.add("embed-mode");
  }

  if (isPopupContext()) {
    document.body.classList.add("popup-context");
    if (elements.backLink) elements.backLink.hidden = true;
    if (elements.closeWindowBtn) elements.closeWindowBtn.hidden = false;
    syncPopupSize(false);
  }

  elements.closeWindowBtn?.addEventListener("click", () => {
    closeOrReturnToApp();
  });

  elements.portalBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    window.open(`${APP_AUTH_CONFIG.portalUrl}/home/index.html`, "_blank", "noopener,noreferrer");
  });

  elements.agolBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    window.open("https://jacksoncomo.maps.arcgis.com/home/index.html", "_blank", "noopener,noreferrer");
  });

  elements.signInBtn?.addEventListener("click", async () => {
    elements.signInBtn.disabled = true;
    try {
      if (embedded) {
        postEmbedMessage(ACCOUNT_EMBED_MESSAGE_SIGNIN);
        return;
      }
      await appAuth.signIn();
      window.location.reload();
    } finally {
      elements.signInBtn.disabled = false;
    }
  });

  elements.signOutBtn?.addEventListener("click", async () => {
    elements.signOutBtn.disabled = true;
    try {
      await appAuth.signOut({ reload: false });
      if (embedded) {
        postEmbedMessage(ACCOUNT_EMBED_MESSAGE_SIGNOUT);
        return;
      }
      try {
        if (isPopupContext() && window.opener && !window.opener.closed) {
          window.opener.location.reload();
        }
      } catch {
      }
      closeOrReturnToApp();
    } finally {
      elements.signOutBtn.disabled = false;
    }
  });

  const toggleExpanded = () => {
    const nextExpanded = !document.body.classList.contains("expanded");
    setExpandedState(elements, nextExpanded);
  };

  if (elements.accountInfoBtn) {
    elements.accountInfoBtn.hidden = true;
  }
  if (elements.groupsRow) {
    elements.groupsRow.hidden = true;
  }
  if (elements.detailsPanel) {
    elements.detailsPanel.hidden = true;
  }
  elements.licensePill?.addEventListener("click", toggleExpanded);

  const signedIn = await appAuth.checkSignIn();
  if (!signedIn) {
    renderSignedOut(elements);
    return;
  }

  const user = appAuth.getUser();
  if (!user) {
    renderSignedOut(elements);
    return;
  }

  renderSignedIn(elements, user);
  void updateRoleLabelFromPortal(user, appAuth, elements);
}

main().catch(() => {
  const emptyState = document.getElementById("emptyState");
  const layout = document.getElementById("accountLayout");
  if (layout) layout.hidden = true;
  if (emptyState) {
    emptyState.hidden = false;
    emptyState.querySelector("h2").textContent = "Account page could not load";
    emptyState.querySelector("p").textContent = "There was a problem loading your Portal account details from this page.";
  }
  document.body.classList.add("account-page-ready");
});
