const [
	SearchSource,
	Graphic,
	FeatureFilter,
	unionOperator,
	simplifyOperator,
	convexHullOperator,
	generalizeOperator,
	projectOperator,
	GraphicsLayer,
	SketchViewModel,
	reactiveUtils,
	esriRequest,
	Portal,
	PortalItem,
	WebMap,
	WebScene,
	FeatureLayer
	
]=await $arcgis.import([
	"@arcgis/core/widgets/Search/SearchSource.js",
	"@arcgis/core/Graphic.js",
	"@arcgis/core/layers/support/FeatureFilter.js",
	"@arcgis/core/geometry/operators/unionOperator.js",
	"@arcgis/core/geometry/operators/simplifyOperator.js",
	"@arcgis/core/geometry/operators/convexHullOperator.js",
	"@arcgis/core/geometry/operators/generalizeOperator.js",
	"@arcgis/core/geometry/operators/projectOperator.js",
	"@arcgis/core/layers/GraphicsLayer.js",
	"@arcgis/core/widgets/Sketch/SketchViewModel.js",
	"@arcgis/core/core/reactiveUtils.js",
	"@arcgis/core/request.js",
	"@arcgis/core/portal/Portal.js",
	"@arcgis/core/portal/PortalItem.js",
	"@arcgis/core/WebMap.js",
	"@arcgis/core/WebScene.js",
	"@arcgis/core/layers/FeatureLayer.js",
]);

import { initMap } from "./mapSetup.js";
import { createFeatureTable } from "./featureTable.js";
import { populateComboboxGroup, attachSelectAllLogic, attachSelectionListLogic } from "./combobox.js";
import { attachQueryTableListener } from "./queryTable.js";
import { createParcelPreloader } from "./preloader.js";
import { buildParcelDetailsFrame, loadTylerPhotoViewer } from "./rightPaneContent.js";
import { initPortalAccess } from "./portalAccess.js";
import { initSidebarUI } from "./sidebarUI.js";
import { initMeasurementTools } from "./measurementTools.js";
import { initPageNavigation } from "./pageNavigation.js";
import { initParcelSelection } from "./parcelSelection.js";
import { initSelectedParcelUI } from "./selectedParcelUI.js";
import { initBuildingSelection } from "./buildingSelection.js";
import { initLrcForms } from "./lrcForms.js";
import { getParcelDisplayName, getSelectionKey, formatParcelWithDashes,
	isDashedParcel, isUndashed17DigitParcel, parseParcelBatch, normalizeBatchParcelInput } from "./utils.js";
import { createPortalAuth } from "./oauth.js";
import { createParcelSearchController } from "./searchParcels.js";
import { initHelpTours } from "./helpTours.js";

let specialAssessmentInitPromise = null;

function setSpecialAssessmentUnavailable(message) {
  const combobox = document.getElementById("fieldBox");
  const taxList = document.getElementById("taxList");
  const table = document.getElementById("parcelsTable");

  if (combobox) {
    combobox.disabled = true;
    combobox.placeholder = "Property Analysis unavailable";
  }

  if (taxList) {
    taxList.innerHTML = `<div style="opacity:.78;font-size:12px;line-height:1.5;">${message}</div>`;
  }

  if (table) {
    table.style.display = "none";
  }
}

function clearSpecialAssessmentUnavailableState() {
  const combobox = document.getElementById("fieldBox");
  const table = document.getElementById("parcelsTable");

  if (combobox) {
    combobox.disabled = false;
    combobox.placeholder = "Select a field";
  }

  if (table) {
    table.style.display = "";
  }
}

export function initSpecialAssessment() {
  if (specialAssessmentInitPromise) {
    return specialAssessmentInitPromise;
  }

  specialAssessmentInitPromise = (async function() {
  const saMap = document.getElementById("saMap");
  const { map, view, parcelLayer } = await initMap(saMap);
  clearSpecialAssessmentUnavailableState();

  if (!parcelLayer) {
    setSpecialAssessmentUnavailable("Property Analysis layers could not be loaded from the portal item. The map may still open, but the district filters and feature table are disabled until those layer references are fixed.");
    return;
  }

  const featureTable = await createFeatureTable({
    view,
    layer: parcelLayer,
    containerId: "parcelsTable"
  });

  if (!featureTable) {
    setSpecialAssessmentUnavailable("The Property Analysis feature table could not be initialized for the current layer set.");
    return;
  }

  // Combobox logic
  await populateComboboxGroup({ map, layerTitle: "CID", fieldName: "Name", groupId: "cid-names", valuePrefix: "CID" });
  await populateComboboxGroup({ map, layerTitle: "TDD", fieldName: "Name", groupId: "tdd-names", valuePrefix: "TDD" });
  await populateComboboxGroup({ map, layerTitle: "TIF Projects", fieldName: "Name", groupId: "tifproj-names", valuePrefix: "TIF_PROJECT" });
  await populateComboboxGroup({ map, layerTitle: "TIF Plan District", fieldName: "Name", groupId: "tifplan-names", valuePrefix: "TIF_PLAN" });

  const combobox = document.getElementById("fieldBox");
  const selectionList = document.getElementById("taxList");
  attachSelectAllLogic(combobox);
  attachSelectionListLogic(combobox, selectionList);
  attachQueryTableListener(combobox, featureTable, parcelLayer, view);
  })().catch(() => {
    setSpecialAssessmentUnavailable("Property Analysis could not finish loading because one or more portal resources are missing or inaccessible.");
  });

  return specialAssessmentInitPromise;
}



		const APP_AUTH_CONFIG = {
			portalUrl: "https://jcgis.jacksongov.org/gisportal",
			clientId: "JdWztUwhjhFsoTu1"
		};
		const BUILDING_LIST_SERVICE_URL = "https://services3.arcgis.com/4LOAHoFXfea6Y3Et/ArcGIS/rest/services/Buildings/FeatureServer/88";
		const PARCEL_INFORMATION_TABLE_URL = "https://services3.arcgis.com/4LOAHoFXfea6Y3Et/ArcGIS/rest/services/Parcel_Information/FeatureServer/0";
		const HELP_ISSUES_FORM_URL = "";
		const HELP_PAGE_CONTEXT_STORAGE_KEY = "jcgis-help-page-context";
		const HELP_TOUR_MESSAGE_TARGET = "jcgis-start-help-tour";
		const APP_BOOT_ABORT = "APP_BOOT_ABORT";
		const preloader=createParcelPreloader(document.getElementById("preloader"));
		preloader.setStatus("Connecting to Jackson County GIS");
		try
		{

			// ---- Page + header refs
			const parcelViewerTabBtn=document.getElementById("parcelViewerTab");
			const publicWorksTabBtn=document.getElementById("publicWorksTab");
			const specialAssessTabBtn=document.getElementById("specialAssessTab");

			const selectedParcelBadge2d=document.getElementById("selectedParcelBadge2d");
			const selectedParcelBadge3d=document.getElementById("selectedParcelBadge3d");

			const selectedParcelContent2d=document.getElementById("selectedParcelContent2d");
			const selectedParcelContent3d=document.getElementById("selectedParcelContent3d");

			const leftSidebarShell=document.getElementById("left-sidebar-shell");
			const leftSidebarToggle=document.getElementById("leftSidebarToggle");
			const leftSidebarToggleIcon=document.getElementById("leftSidebarToggleIcon");

			const rightSidebarShell=document.getElementById("right-sidebar-shell");
			const rightSidebar=document.getElementById("right-sidebar");
			const rightSidebarContent=document.getElementById("rightSidebarContent");
			const rightSidebarToggle=document.getElementById("rightSidebarToggle");
			const rightSidebarToggleIcon=document.getElementById("rightSidebarToggleIcon");

			const selectedParcelExpandEl=document.getElementById("selectedParcelExpand");
			const clearSelectedParcelsButton2d=document.getElementById("clearSelectedParcelsButton2d");
			const clearSelectedParcelsButton3d=document.getElementById("clearSelectedParcelsButton3d");

			const zoomInBtn2d=document.getElementById("zoomInBtn2d");
			const zoomOutBtn2d=document.getElementById("zoomOutBtn2d");
			const zoomInBtn3d=document.getElementById("zoomInBtn3d");
			const zoomOutBtn3d=document.getElementById("zoomOutBtn3d");

			const pageParcel=document.getElementById("page-parcel");
			const pagePW=document.getElementById("page-pw");
			const pageSA=document.getElementById("page-sa");

			const searchEl=document.getElementById("search");

			const viewModeToggle=document.getElementById("viewModeToggle");
			const viewModeSwitch=document.getElementById("viewModeSwitch");

			const rectangleSelectBtn=document.getElementById("rectangleSelectBtn");
			const rectangleToolPopover=document.getElementById("rectangleToolPopover");
			const rectangleSelectStartBtn=document.getElementById("rectangleSelectStartBtn");
			const rectangleSelectStopBtn=document.getElementById("rectangleSelectStopBtn");

			const distanceMeasure2d=document.getElementById("distanceMeasure2d");
			const areaMeasure2d=document.getElementById("areaMeasure2d");
			const areaMeasure3d=document.getElementById("areaMeasure3d");
			const lineMeasure3d=document.getElementById("lineMeasure3d");

			const measure2dLineShell=document.getElementById("measure2dLineShell");
			const measure2dAreaShell=document.getElementById("measure2dAreaShell");
			const measure2dLineOptionBtn=document.getElementById("measure2dLineOptionBtn");
			const measure2dAreaOptionBtn=document.getElementById("measure2dAreaOptionBtn");
			const measure2dStartBtn=document.getElementById("measure2dStartBtn");
			const measure2dStopBtn=document.getElementById("measure2dStopBtn");
			const measure2dSubtitle=document.getElementById("measure2dSubtitle");

			const measure3dLineShell=document.getElementById("measure3dLineShell");
			const measure3dAreaShell=document.getElementById("measure3dAreaShell");
			const measure3dLineOptionBtn=document.getElementById("measure3dLineOptionBtn");
			const measure3dAreaOptionBtn=document.getElementById("measure3dAreaOptionBtn");
			const measure3dStartBtn=document.getElementById("measure3dStartBtn");
			const measure3dStopBtn=document.getElementById("measure3dStopBtn");
			const measure3dSubtitle=document.getElementById("measure3dSubtitle");

			// ---- Parcel view elements
			const sceneEl=document.getElementById("scene");
			const mapEl=document.getElementById("map2d");
			const pwMapEl=document.getElementById("pwMap");
			const saMapEl=document.getElementById("saMap");

			function dockViewModeToggleTo(containerEl)
			{
				if(!viewModeToggle || !containerEl?.appendChild) return;
				if(viewModeToggle.parentElement === containerEl) return;

				viewModeToggle.setAttribute("slot", "bottom-right");
				containerEl.appendChild(viewModeToggle);
			}
			const authOverlay=document.getElementById("authOverlay");
			const authOverlayTitle=document.getElementById("authOverlayTitle");
			const authOverlayDescription=document.getElementById("authOverlayDescription");
			const authPrimaryBtn=document.getElementById("authPrimaryBtn");
			const authPrimaryBtnIcon=document.getElementById("authPrimaryBtnIcon");
			const authPrimaryBtnLabel=document.getElementById("authPrimaryBtnLabel");
			const splashNotice=document.getElementById("splashNotice");
			const helpBtn=document.getElementById("helpBtn");
			const mobileHeaderMenuBtn=document.getElementById("mobileHeaderMenuBtn");
			const mobileHeaderMenu=document.getElementById("mobileHeaderMenu");
			const mobileHeaderMenuBackdrop=document.getElementById("mobileHeaderMenuBackdrop");
			const mobileMapInfoBtn=document.getElementById("mobileMapInfoBtn");
			const mobileHelpBtn=document.getElementById("mobileHelpBtn");
			const mobileAccountBtn=document.getElementById("mobileAccountBtn");
			const mobileParcelViewerTabBtn=document.getElementById("mobileParcelViewerTabBtn");
			const mobilePublicWorksTabBtn=document.getElementById("mobilePublicWorksTabBtn");
			const mobileSpecialAssessTabBtn=document.getElementById("mobileSpecialAssessTabBtn");
				const helpOverlay=document.getElementById("helpOverlay");
				const helpOverlayFrame=document.getElementById("helpOverlayFrame");
				const helpOverlayCloseBtn=document.getElementById("helpOverlayCloseBtn");
				const userAuthBtn=document.getElementById("userAuthBtn");
				const userAuthBackdrop=document.getElementById("userAuthBackdrop");
			const userAuthLabel=document.getElementById("userAuthLabel");
			const userAuthLicense=document.getElementById("userAuthLicense");
			const userAuthLicenseSymbol=document.getElementById("userAuthLicenseSymbol");
			const userAuthLicensePlus=document.getElementById("userAuthLicensePlus");
			const userAuthName=document.getElementById("userAuthName");
			const userAuthTypeBadge=document.getElementById("userAuthTypeBadge");
			const userAuthMenu=document.getElementById("userAuthMenu");
			const userAuthMenuFrame=document.getElementById("userAuthMenuFrame");
			const appAuth=await createPortalAuth(APP_AUTH_CONFIG);
			const ACCOUNT_PAGE_EMBED_URL = new URL("./user-account-infopage.html?embed=1", window.location.href).toString();
			const ACCOUNT_MENU_MESSAGE_SIGNIN = "jcgis-account-signin";
			const ACCOUNT_MENU_MESSAGE_SIGNOUT = "jcgis-account-signed-out";
			const ACCOUNT_MENU_MESSAGE_SIZE = "jcgis-account-size";
			let rectangleSelectionActive = false;
			let appNoticeTimer = null;

			function showAppNotice(message, { title = "Parcel search", tone = "warning" } = {})
			{
				if(!message) return;

				let notice = document.getElementById("appNotice");
				if(!notice)
				{
					notice = document.createElement("div");
					notice.id = "appNotice";
					notice.className = "app-notice";
					notice.setAttribute("role", "status");
					notice.setAttribute("aria-live", "polite");
					document.body.appendChild(notice);
				}

				notice.className = `app-notice ${tone}`;
				notice.innerHTML = `
					<div class="app-notice-title">${title}</div>
					<div class="app-notice-message">${message}</div>
				`;
				notice.hidden = false;

				clearTimeout(appNoticeTimer);
				appNoticeTimer = setTimeout(() =>
				{
					notice.hidden = true;
				}, 6500);
			}

			function syncWidgetActiveStates() {
				if (rectangleSelectStartBtn) {
					rectangleSelectStartBtn.disabled = rectangleSelectionActive;
					rectangleSelectStartBtn.hidden = rectangleSelectionActive;
				}
				if (rectangleSelectStopBtn) {
					rectangleSelectStopBtn.disabled = !rectangleSelectionActive;
					rectangleSelectStopBtn.hidden = !rectangleSelectionActive;
				}
			}
			syncWidgetActiveStates();

			const pageDefinitions=[
				{
					key: "parcel",
					buttonEl: parcelViewerTabBtn,
					pageEl: pageParcel,
					resources: [
						{ element: mapEl, itemId: mapEl.dataset.itemId, portalUrl: mapEl.dataset.portalUrl || APP_AUTH_CONFIG.portalUrl, title: "Parcel Viewer 2D map", resourceType: "webmap" },
						{ element: sceneEl, itemId: sceneEl.dataset.itemId, portalUrl: sceneEl.dataset.portalUrl || APP_AUTH_CONFIG.portalUrl, title: "Parcel Viewer 3D scene", resourceType: "webscene", allowAnonymous: true }
					]
				},
				{
					key: "pw",
					buttonEl: publicWorksTabBtn,
					pageEl: pagePW,
					resources: [
						{ element: pwMapEl, itemId: pwMapEl.dataset.itemId, portalUrl: pwMapEl.dataset.portalUrl || APP_AUTH_CONFIG.portalUrl, title: "Public Works map", resourceType: "webmap" }
					]
				},
				{
					key: "sa",
					buttonEl: specialAssessTabBtn,
					pageEl: pageSA,
					resources: [
						{ element: saMapEl, itemId: saMapEl.dataset.itemId, portalUrl: saMapEl.dataset.portalUrl || APP_AUTH_CONFIG.portalUrl, title: "Property Analysis map", resourceType: "webmap" }
					]
				}
			];


			const portalAccessModule = initPortalAccess({
				appAuth,
				APP_AUTH_CONFIG,
				esriRequest,
				Portal,
				PortalItem,
				WebMap,
				WebScene,
				pageDefinitions,
				userAuthLicense,
				userAuthLicenseSymbol,
				userAuthLicensePlus,
				userAuthTypeBadge,
				userAuthLabel,
				userAuthName,
				userAuthBtn,
				userAuthMenu,
				userAuthMenuFrame,
				userAuthBackdrop,
				authOverlay,
				authOverlayTitle,
				authOverlayDescription,
				authPrimaryBtn,
				authPrimaryBtnIcon,
				authPrimaryBtnLabel,
				splashNotice
			});

			const {
				getAccessiblePageKeys,
				formatAuthDisplayName,
				formatPreloaderIdentity,
				renderHeaderUserSummary,
				renderAuthButton,
				hideUserAuthMenu,
				toggleUserAuthMenu,
				showAuthOverlay,
				hideAuthOverlay,
				startPortalSignIn,
				applyPortalItemAccess,
				validatePortalResource,
				validatePageAccess,
				setAccessiblePages
			} = portalAccessModule;

			function getCurrentVisiblePageKey()
			{
				const activeDefinition = pageDefinitions.find((definition) => definition.pageEl?.classList.contains("visible"));
				return activeDefinition?.key || getAccessiblePageKeys()[0] || "parcel";
			}

			function syncHelpPageContext()
			{
				try
				{
					window.sessionStorage.setItem(HELP_PAGE_CONTEXT_STORAGE_KEY, JSON.stringify({
						currentPage: getCurrentVisiblePageKey(),
						accessiblePageKeys: getAccessiblePageKeys()
					}));
				}
				catch
				{
				}
			}

			function showHelpOverlay()
			{
				hideUserAuthMenu();
				syncHelpPageContext();
				if(helpOverlayFrame)
				{
					const helpUrl = new URL("./gis-help.html", window.location.href);
					helpUrl.searchParams.set("embed", "1");
					helpUrl.searchParams.set("page", getCurrentVisiblePageKey());
					helpOverlayFrame.src = helpUrl.toString();
				}
				helpOverlay.hidden = false;
				helpOverlay.setAttribute("aria-hidden", "false");
				if(helpOverlayCloseBtn) helpOverlayCloseBtn.hidden = false;
				document.body.classList.add("help-overlay-open");
			}

			function hideHelpOverlay()
			{
				helpOverlay.hidden = true;
				helpOverlay.setAttribute("aria-hidden", "true");
				if(helpOverlayCloseBtn) helpOverlayCloseBtn.hidden = false;
				document.body.classList.remove("help-overlay-open");
				document.body.classList.remove("help-ai-modal-open");
				document.body.classList.remove("help-ticket-modal-open");
				document.body.classList.remove("help-walkthrough-modal-open");
			}

			function toggleHelpOverlay()
			{
				if(helpOverlay.hidden) showHelpOverlay();
				else hideHelpOverlay();
			}

			const helpTours = initHelpTours({
				closeHelpOverlay: hideHelpOverlay,
				openHelpOverlay: showHelpOverlay,
				showAppNotice
			});

			function setMobileHeaderMenuOpen(isOpen)
			{
				if(!mobileHeaderMenu || !mobileHeaderMenuBtn) return;
				mobileHeaderMenu.hidden = !isOpen;
				if(mobileHeaderMenuBackdrop) mobileHeaderMenuBackdrop.hidden = !isOpen;
				mobileHeaderMenuBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
				document.body.classList.toggle("mobile-header-menu-open", isOpen);
			}

			function closeMobileHeaderMenu()
			{
				setMobileHeaderMenuOpen(false);
			}

			mobileHeaderMenuBtn?.addEventListener("click",(event) =>
			{
				event.preventDefault();
				event.stopPropagation();
				const opening = !!mobileHeaderMenu?.hidden;
				if(opening)
				{
					// Keep the mobile tab buttons in sync with the real header
					// tabs (e.g. hidden/disabled state driven by access rules).
					[
						[mobileParcelViewerTabBtn, parcelViewerTabBtn],
						[mobilePublicWorksTabBtn, publicWorksTabBtn],
						[mobileSpecialAssessTabBtn, specialAssessTabBtn]
					].forEach(([mobileBtn, realBtn]) =>
					{
						if(!mobileBtn || !realBtn) return;
						mobileBtn.hidden = realBtn.hasAttribute("hidden");
						mobileBtn.classList.toggle("active", realBtn.classList.contains("active"));
					});
				}
				setMobileHeaderMenuOpen(opening);
			});

			mobileParcelViewerTabBtn?.addEventListener("click",(event) =>
			{
				event.preventDefault();
				event.stopPropagation();
				closeMobileHeaderMenu();
				parcelViewerTabBtn?.click();
			});

			mobilePublicWorksTabBtn?.addEventListener("click",(event) =>
			{
				event.preventDefault();
				event.stopPropagation();
				closeMobileHeaderMenu();
				publicWorksTabBtn?.click();
			});

			mobileSpecialAssessTabBtn?.addEventListener("click",(event) =>
			{
				event.preventDefault();
				event.stopPropagation();
				closeMobileHeaderMenu();
				specialAssessTabBtn?.click();
			});

			mobileMapInfoBtn?.addEventListener("click",(event) =>
			{
				event.preventDefault();
				event.stopPropagation();
				closeMobileHeaderMenu();
				document.getElementById("settingsBtn")?.click();
			});

			mobileHelpBtn?.addEventListener("click",(event) =>
			{
				event.preventDefault();
				event.stopPropagation();
				closeMobileHeaderMenu();
				helpBtn?.click();
			});

			mobileAccountBtn?.addEventListener("click",async (event) =>
			{
				event.preventDefault();
				event.stopPropagation();
				closeMobileHeaderMenu();
				userAuthBtn?.click();
			});

			mobileHeaderMenuBackdrop?.addEventListener("click",(event) =>
			{
				event.preventDefault();
				closeMobileHeaderMenu();
			});

			document.addEventListener("click",(event) =>
			{
				if(mobileHeaderMenu?.hidden) return;
				const target = event.target;
				if(mobileHeaderMenu?.contains(target) || mobileHeaderMenuBtn?.contains(target) || mobileHeaderMenuBackdrop?.contains(target)) return;
				closeMobileHeaderMenu();
			});

			userAuthBtn?.addEventListener("click",async () =>
			{
				if(appAuth.isSignedIn())
				{
					toggleUserAuthMenu(ACCOUNT_PAGE_EMBED_URL);
					return;
				}

				await startPortalSignIn();
			});

			helpBtn?.addEventListener("click",(event) =>
			{
				event.preventDefault();
				event.stopPropagation();
				toggleHelpOverlay();
			});
			helpOverlay?.addEventListener("click",(event) =>
			{
				if(event.target === helpOverlay) hideHelpOverlay();
			});
				helpOverlayCloseBtn?.addEventListener("click",(event) =>
				{
					event.preventDefault();
					event.stopPropagation();
					hideHelpOverlay();
				});
				userAuthBackdrop?.addEventListener("click",(event) =>
				{
					event.preventDefault();
					hideUserAuthMenu();
				});
				window.addEventListener("message",(event) =>
				{
					if(event.origin !== window.location.origin) return;
					if(event.data?.type === "jcgis-help-close")
					{
						hideHelpOverlay();
						return;
					}
					if(event.data?.type === "jcgis-help-ai-modal")
					{
						const open = event.data?.open === true;
						if(helpOverlayCloseBtn) helpOverlayCloseBtn.hidden = open;
						document.body.classList.toggle("help-ai-modal-open", open);
						return;
					}
					if(event.data?.type === "jcgis-help-ticket-modal")
					{
						const open = event.data?.open === true;
						if(helpOverlayCloseBtn) helpOverlayCloseBtn.hidden = open;
						document.body.classList.toggle("help-ticket-modal-open", open);
						return;
					}
					if(event.data?.type === "jcgis-help-walkthrough-modal")
					{
						const open = event.data?.open === true;
						if(helpOverlayCloseBtn) helpOverlayCloseBtn.hidden = open;
						document.body.classList.toggle("help-walkthrough-modal-open", open);
						return;
					}
					if(event.data?.type === HELP_TOUR_MESSAGE_TARGET)
					{
						helpTours.startTour(event.data?.tourId);
						return;
					}
					if(event.data?.type === ACCOUNT_MENU_MESSAGE_SIGNIN)
					{
					hideUserAuthMenu();
					void startPortalSignIn();
					return;
				}
				if(event.data?.type === ACCOUNT_MENU_MESSAGE_SIZE)
				{
					const width = Number(event.data?.width || 0);
					const height = Number(event.data?.height || 0);
					const expanded = event.data?.expanded === true;
					userAuthMenu.classList.toggle("expanded", expanded);
					if(width > 0) userAuthMenu.style.width = `min(${width}px, calc(100vw - 24px))`;
					if(height > 0)
					{
						userAuthMenu.style.height = `min(${height}px, calc(100vh - 24px))`;
					}
					return;
				}
				if(event.data?.type === ACCOUNT_MENU_MESSAGE_SIGNOUT)
				{
					hideUserAuthMenu();
					window.location.reload();
				}
			});
			document.addEventListener("keydown",(event) =>
			{
				if(event.key === "Escape" && mobileHeaderMenu && !mobileHeaderMenu.hidden)
				{
					closeMobileHeaderMenu();
					return;
				}
				if(event.key === "Escape" && helpOverlay && !helpOverlay.hidden)
				{
					hideHelpOverlay();
					return;
				}
				if(event.key === "Escape" && userAuthMenu && !userAuthMenu.hidden)
				{
					hideUserAuthMenu();
				}
			});
			authPrimaryBtn?.addEventListener("click",async () =>
			{
				if(authPrimaryBtn.dataset.action === "signout")
				{
					await appAuth.signOut();
					return;
				}
				await startPortalSignIn();
			});

			document.addEventListener("click",(event) =>
			{
				if(!userAuthMenu || !userAuthBtn) return;
				if(userAuthMenu.hidden) return;
				const target = event.target;
				if(userAuthBtn.contains(target) || userAuthMenu.contains(target)) return;
				hideUserAuthMenu();
			});

			renderAuthButton();

			preloader.setStatus("Checking your Portal session");
			const hasExistingSession = await appAuth.checkSignIn();
			renderAuthButton();
			if(hasExistingSession)
			{
				preloader.setUser(formatPreloaderIdentity(appAuth.getUser()));
			}
			else
			{
				preloader.setUser("");
			}

			if(hasExistingSession)
			{
				try
				{
					const cleanUrl = new URL(window.location.href);
					const hadOAuthParams = cleanUrl.searchParams.has("code") || cleanUrl.searchParams.has("state");
					if(hadOAuthParams)
					{
						cleanUrl.searchParams.delete("code");
						cleanUrl.searchParams.delete("state");
						window.history.replaceState({}, document.title, cleanUrl.toString());
					}
				}
				catch
				{
				}
			}

			if(!hasExistingSession)
			{
				setAccessiblePages([]);
				showAuthOverlay({
					title: "",
					primaryLabel: "Continue to Sign In"
				});
				preloader.hide();
				throw new Error(APP_BOOT_ABORT);
			}

			preloader.setStatus("Validating Parcel Viewer access");
			const pageAccessResults = await validatePageAccess(pageDefinitions);

			pageAccessResults
				.filter(result => result.allowed)
				.forEach((result) =>
				{
					const resources = result.resourceResults || result.resources || [];
					resources.forEach((resource) => applyPortalItemAccess(resource.element, resource));
				});

			setAccessiblePages(pageAccessResults.filter(result => result.allowed).map(result => result.key));

			if(!getAccessiblePageKeys().includes("parcel"))
			{
				const parcelAccess = pageAccessResults.find(result => result.key === "parcel");
				const blockedResources = (parcelAccess?.resourceResults || parcelAccess?.resources || [])
					?.filter(resource => !resource.allowed)
					?.map(resource => `${resource.title || resource.itemId}: ${resource.error?.message || "access denied"}`) || [];

				showAuthOverlay({
					title: "No Parcel Viewer access",
					description: blockedResources.length
						? `Signed in as ${appAuth.getUser()?.username || "unknown user"}, but these Parcel Viewer resources failed: ${blockedResources.join(" | ")}`
						: "Your account signed in successfully, but it cannot load the secured Parcel Viewer map and scene. Share the required Portal items to this user or their groups, then try again.",
					primaryLabel: "Sign out",
					primaryAction: "signout"
				});
				preloader.hide();
				throw new Error(APP_BOOT_ABORT);
			}

			hideAuthOverlay();

			async function waitForInitialView(element, label, { forceVisible = false, timeoutMs = 15000 } = {})
			{
				let restoreVisibility = false;

				if(forceVisible && !element.classList.contains("visible"))
				{
					element.classList.add("visible");
					restoreVisibility = true;
				}

				try
				{
					const waitForViewObject = () => new Promise((resolve, reject) =>
					{
						const startedAt = Date.now();
						const timer = window.setInterval(() =>
						{
							if(element.view)
							{
								window.clearInterval(timer);
								resolve(element.view);
								return;
							}

							if(Date.now() - startedAt > timeoutMs)
							{
								window.clearInterval(timer);
								reject(new Error(`${label} view timeout after ${timeoutMs}ms`));
							}
						}, 100);
					});

					const viewReady = element.viewOnReady().catch(async (error) =>
					{
						if(element.view) return element.view;
						try
						{
							return await waitForViewObject();
						}
						catch
						{
							throw error;
						}
					});

					await Promise.race([
						viewReady,
						new Promise((_, reject) =>
							setTimeout(() => reject(new Error(`${label} viewOnReady timeout after ${timeoutMs}ms`)), timeoutMs)
						)
					]);
				}
				catch (error)
				{
					throw error;
				}
				finally
				{
					if(restoreVisibility)
					{
						element.classList.remove("visible");
					}
				}
			}

			try
			{
				preloader.setStatus("Loading parcel maps in 2D and 3D");
				await waitForInitialView(mapEl, "parcel-2d");
				await waitForInitialView(sceneEl, "parcel-3d", { forceVisible: true });
			}
			catch (initialViewError)
			{
				preloader.hide();
				showAuthOverlay({
					title: "Initial map load failed",
					description: `${initialViewError?.message || initialViewError}. Check the console for [init] and [auth] details.`,
					primaryLabel: "Sign out",
					primaryAction: "signout"
				});
				throw new Error(APP_BOOT_ABORT);
			}

			preloader.setStatus("Preparing search and parcel tools");
			const MAX_SELECTED_PARCELS = 20;

			const sceneView=sceneEl.view;
			const mapView=mapEl.view;
			let ESRILayer=null;
			let lrmLayer2d=null;
			let lrmLayer3d=null;
			let polygonGraphicsLayer=null;
			let ownerParcelPointGraphicsLayer=null;
			let parcelFocusGraphicsLayer=null;
			let sketchViewModel2d=null;



			// Start in 3D
			let activeView=mapView;
			dockViewModeToggleTo(mapEl);

			function showAndHide(showEl,hideEl)
			{
				showEl.classList.add("visible");
				hideEl.classList.remove("visible");
			}

			zoomInBtn2d?.addEventListener("click",async () =>
			{
				await mapView.goTo({ scale: mapView.scale * 0.5 });
			});

			zoomOutBtn2d?.addEventListener("click",async () =>
			{
				await mapView.goTo({ scale: mapView.scale * 2 });
			});

			zoomInBtn3d?.addEventListener("click",async () =>
			{
				await sceneView.goTo({ scale: sceneView.scale * 0.5 });
			});

			zoomOutBtn3d?.addEventListener("click",async () =>
			{
				await sceneView.goTo({ scale: sceneView.scale * 2 });
			});

			function stopRectangleSelection()
			{
				if(!rectangleSelectionActive) return;
				rectangleSelectionActive = false;

				try { sketchViewModel2d?.cancel?.(); } catch {}
				try { polygonGraphicsLayer?.removeAll?.(); } catch {}

				syncWidgetActiveStates();
			}

			function startRectangleSelection()
			{
				if(currentPage!=="parcel") return;
				if(activeView!==mapView) return;
				if(!sketchViewModel2d) return;

				mapView.closePopup();
				rectangleSelectionActive = true;
				try { polygonGraphicsLayer?.removeAll?.(); } catch {}
				sketchViewModel2d.create("rectangle");
				syncWidgetActiveStates();
			}

			rectangleSelectBtn?.addEventListener("click",() =>
			{
				if(currentPage!=="parcel") return;
				if(activeView!==mapView) return;

				if(rectangleToolPopover)
				{
					// Prevent an initial layout flash before the map slots hydrate.
					rectangleToolPopover.hidden = false;
					rectangleToolPopover.open = !rectangleToolPopover.open;
					syncWidgetActiveStates();
				}
			});

			rectangleSelectStartBtn?.addEventListener("click",() =>
			{
				if(rectangleSelectionActive) return;
				startRectangleSelection();
			});

			rectangleSelectStopBtn?.addEventListener("click",() =>
			{
				stopRectangleSelection();
			});


			const measurementBtn2d = document.getElementById("measurementBtn2d");
			const measurementPopover2d = document.getElementById("measurementPopover2d");

				measurementBtn2d?.addEventListener("click", () => {
				measurementPopover2d.hidden = false;
				measurementPopover2d.open = !measurementPopover2d.open;
			});
			initMeasurementTools({
				distanceMeasure2d,
				areaMeasure2d,
				lineMeasure3d,
				areaMeasure3d,
				measure2dLineShell,
				measure2dAreaShell,
				measure2dLineOptionBtn,
				measure2dAreaOptionBtn,
				measure2dStartBtn,
				measure2dStopBtn,
				measure2dSubtitle,
				measure3dLineShell,
				measure3dAreaShell,
				measure3dLineOptionBtn,
				measure3dAreaOptionBtn,
				measure3dStartBtn,
				measure3dStopBtn,
				measure3dSubtitle
			});




			const { updateLeftSidebarState, openLeftSidebar, updateRightSidebarState, getRightSidebarCollapsed, setRightSidebarCollapsed } = initSidebarUI({
				getMapView: () => mapView,
				getSceneView: () => sceneView,
				leftSidebarShell, leftSidebarToggle, leftSidebarToggleIcon,
				rightSidebarShell, rightSidebarToggle, rightSidebarToggleIcon
			});


			const { switchPage, setActivePageTab, ensureMapLoaded } = initPageNavigation({
				getAccessiblePageKeys,
				getCurrentPage: () => currentPage,
				setCurrentPage: (p) => { currentPage = p; },
				getSearchController: () => searchController,
				getMapView: () => mapView,
				getSceneView: () => sceneView,
				getInitSpecialAssessment: () => initSpecialAssessment,
				onMapLoaded: (pageName) => {
					mapInfoPanel?.preloadPage?.(pageName);
				},
				pageParcel, pagePW, pageSA,
				parcelViewerTabBtn, publicWorksTabBtn, specialAssessTabBtn
			});


			// ---- Lazy-load PW/SA maps (hidden containers start at 0x0)




			function clearSearchUi()
			{
				searchEl.value = "";
				searchEl.searchTerm = "";
				searchEl.close?.();
				searchEl.blur?.();
			}

			function getCurrentSearchInputValue(event)
			{
				const path = typeof event?.composedPath === "function"
					? event.composedPath()
					: [];
				const pathValue = path.find(node => typeof node?.value === "string")?.value;
				const shadowInputValue = searchEl.shadowRoot
					?.querySelector("calcite-autocomplete")
					?.shadowRoot?.querySelector("calcite-input")
					?.shadowRoot?.querySelector("input")
					?.value;

				return String(
					pathValue
					|| shadowInputValue
					|| searchEl.value
					|| searchEl.searchTerm
					|| ""
				).trim();
			}

			function getSAMapView()
			{
				return document.getElementById("saMap")?.view || null;
			}

			function getPWMapView()
			{
				return document.getElementById("pwMap")?.view || null;
			}

			function getPWParcelLayer()
			{
				return getPWMapView()?.map?.allLayers?.find(l => l.title === "Parcels") || null;
			}

			function getPWCondoLayer()
			{
				return getPWMapView()?.map?.allLayers?.find(l => l.title === "Parcel Condominiums") || null;
			}

			function getPWAddressLayer()
			{
				return getPWMapView()?.map?.allLayers?.find(l => l.title === "Addresses") || null;
			}

			function getSAParcelLayer()
			{
				return getSAMapView()?.map?.allLayers?.find(l => l.title === "Parcels") || null;
			}

			function getSACondoLayer()
			{
				return getSAMapView()?.map?.allLayers?.find(l => l.title === "Parcel Condominiums") || null;
			}

			function getSAAddressLayer()
			{
				return getSAMapView()?.map?.allLayers?.find(l => l.title === "Addresses") || null;
			}

			const mapInfoPanel = window.initializeMapInfoPanel?.({
				settingsBtnId: "settingsBtn",
				panelId: "settingsPanel",
				contentId: "settingsContent",
				closeBtnId: "settingsCloseBtn",
				tabButtonsId: "settingsTabButtons",
				pageDefinitions,
				getLoadedResource: (pageKey, resourceIndex, resource) => {
					if (pageKey === "parcel" && resource?.resourceType === "webscene") return sceneView?.map || null;
					if (pageKey === "parcel" && resource?.resourceType === "webmap") return mapView?.map || null;
					if (pageKey === "pw") return getPWMapView?.()?.map || null;
					if (pageKey === "sa") return getSAMapView?.()?.map || null;
					return null;
				}
			});

			/*async function applySearchConfig(sources, placeholder)
			{
				await searchEl.componentOnReady?.();

				searchEl.sources = sources;
				searchEl.allPlaceholder = placeholder;
				searchEl.activeSourceIndex = -1;

				clearSearchUi();

				searchEl.style.visibility = "visible";
			}*/



			function getFallbackSearchContext(pageName = currentPage)
			{
				const normalizedPage = pageName === "pw"
					? "pw"
					: pageName === "sa"
						? "sa"
						: "parcel";

				if (normalizedPage === "pw")
				{
					return {
						page: "pw",
						view: getPWMapView(),
						layers: {
							parcel: getPWParcelLayer(),
							condo: getPWCondoLayer(),
							address: getPWAddressLayer()
						}
					};
				}

				if (normalizedPage === "sa")
				{
					return {
						page: "sa",
						view: getSAMapView(),
						layers: {
							parcel: getSAParcelLayer(),
							condo: getSACondoLayer(),
							address: getSAAddressLayer()
						}
					};
				}

				return {
					page: "parcel",
					view: activeView,
					layers: {
						parcel: regularParcelLayer,
						condo: floorLayer,
						address: activeView === sceneView ? addressLayer3d : addressLayer2d
					}
				};
			}

			function getSearchContextForPage(pageName = currentPage)
			{
				return searchController?.getSearchContextForPage?.(pageName) || getFallbackSearchContext(pageName);
			}

			async function zoomToFeatureSet(features)
			{
				if (!features?.length) return;
			
				const extents = features
					.map(f => f.geometry?.extent)
					.filter(Boolean);
			
				if (!extents.length) return;
			
				let combined = extents[0].clone();
			
				for (let i = 1; i < extents.length; i++) {
					combined = combined.union(extents[i]);
				}

				const searchContext = getSearchContextForPage(currentPage);

				if (currentPage === "sa")
				{
					const saMapView = searchContext?.view || getSAMapView();
					if (saMapView)
					{
						await saMapView.goTo({
							target: combined.expand(2)
						});
					}
					return;
				}

				if (currentPage === "pw")
				{
					const pwView = searchContext?.view || getPWMapView();
					if (pwView)
					{
						await pwView.goTo({
							target: combined.expand(2)
						});
					}
					return;
				}
			
				if (features.some(f => f.layer?.title === "Parcel Condominiums Floors")) {
					await switchTo3D();
					await sceneView.goTo({
						target: combined.expand(2),
						tilt: 75
					});
				} else {
					await switchTo2D();
					await mapView.goTo({
						target: combined.expand(2)
					});
				}
			}

			async function applyPAFeatureTableSelection(features)
			{
				const featureTableEl = document.getElementById("parcelsTable");
				if (!featureTableEl || !features?.length) return;

				const oids = features
					.map(feature => feature?.attributes?.OBJECTID)
					.filter(oid => oid != null);

				if (!oids.length) return;

				await featureTableEl.componentOnReady?.();
				featureTableEl.definitionExpression = oids.length === 1
					? `OBJECTID = ${oids[0]}`
					: `OBJECTID IN (${oids.join(",")})`;
			}

			async function selectMultipleParcelsFromSearch(rawInput)
			{
				const parsed = parseParcelBatch(rawInput);
				const batch = normalizeBatchParcelInput(parsed);

				if (!batch.ok) {
					showAppNotice(batch.message);
					return;
				}

				const fieldName = batch.format === "dashed" ? "Name" : "parcel_id";
				const safeValues = batch.parcels.map(v => `'${v.replace(/'/g, "''")}'`);
				const where = `${fieldName} IN (${safeValues.join(",")})`;
				const searchContext = getSearchContextForPage(currentPage);
				const parcelSearchLayer = searchContext?.layers?.parcel || null;
				const condoSearchLayer = searchContext?.layers?.condo || null;

				let features = [];

				// 1. Try regular parcels first
				if (parcelSearchLayer)
				{
					const parcelRes = await parcelSearchLayer.queryFeatures({
						where,
						outFields: ["*"],
						returnGeometry: true
					});

					features = parcelRes.features || [];
				}

				// 2. If none found, try condos/floors
				if (!features.length && condoSearchLayer)
				{
					const condoRes = await condoSearchLayer.queryFeatures({
						where,
						outFields: ["*"],
						returnGeometry: true
					});

					features = condoRes.features || [];
				}

				if (!features.length)
				{
					showAppNotice("No matching parcels were found for that list.");
					return;
				}

				await zoomToFeatureSet(features);

				if (currentPage === "sa")
				{
					await applyPAFeatureTableSelection(features);
					clearSearchUi();
					return;
				}

				if (currentPage === "pw")
				{
					clearSearchUi();
					return;
				}

				// limit total selected to 20
				const remaining = 20 - getSelectedParcels().length;
				if (remaining <= 0)
				{
					showAppNotice("You can only have up to 20 selected parcels.");
					return;
				}

				for (const feature of features.slice(0, remaining))
				{
					const alreadySelected = getSelectedParcels().some(
						f => getSelectionKey(f) === getSelectionKey(feature)
					);

					if (!alreadySelected) {
						await toggleParcelSelection(feature);
					}
				}

				syncSearchBarWithSelectedParcels();
			}

			function isParcelBatchCandidate(rawInput, parsedBatch)
			{
				const value = String(rawInput || "").trim();
				if(!value) return false;
				if(normalizeBatchParcelInput(parsedBatch).ok) return true;
				if(!(value.includes(",") || value.includes("\n") || value.includes(";"))) return false;

				return parsedBatch.some(token => /^\d/.test(String(token || "").trim()));
			}


			polygonGraphicsLayer=new GraphicsLayer({
				listMode: "hide"
			});

			ownerParcelPointGraphicsLayer=new GraphicsLayer({
				listMode: "hide"
			});

			parcelFocusGraphicsLayer=new GraphicsLayer({
				listMode: "hide"
			});

			mapView.map.add(polygonGraphicsLayer);
			mapView.map.add(parcelFocusGraphicsLayer);
			mapView.map.add(ownerParcelPointGraphicsLayer);

			sketchViewModel2d=new SketchViewModel({
				view: mapView,
				layer: polygonGraphicsLayer,
				updateOnGraphicClick: false
			});


			sketchViewModel2d.on("create",async (event) =>
			{
				if(event.state==="cancel")
				{
					rectangleSelectionActive = false;
					sketchViewModel2d.cancel();
					polygonGraphicsLayer?.removeAll();
					syncWidgetActiveStates();
					return;
				}

				if(event.state==="complete")
				{
					const queryGeometry = event.graphic?.geometry?.clone?.() || event.graphic?.geometry || null;

					rectangleSelectionActive = false;
					sketchViewModel2d.cancel();
					polygonGraphicsLayer?.removeAll();
					syncWidgetActiveStates();

					await selectFeaturesByRectangle(queryGeometry);
				}
			});

			function getFeatureMapTarget(feature)
			{
				return feature?.geometry?.extent || feature?.geometry || null;
			}

			function getFeaturePointGeometry(feature)
			{
				const geometry = feature?.geometry;
				if(!geometry) return null;
				if(geometry.type === "point") return geometry;
				return geometry.extent?.center || geometry.centroid || null;
			}

			function getCombinedFeatureTarget(features)
			{
				const extents = (features || [])
					.map(feature => feature?.geometry?.extent || feature?.geometry || null)
					.filter(Boolean);

				if(!extents.length) return null;

				let combined = extents[0].clone?.() || extents[0];

				for(let i = 1; i < extents.length; i++)
				{
					if(typeof combined.union === "function")
					{
						combined = combined.union(extents[i]);
					}
				}

				return combined.expand?.(2) || combined;
			}

			function clearOwnerParcelLocationPoints()
			{
				ownerParcelPointGraphicsLayer?.removeAll();
			}

			function clearParcelFocusGraphic()
			{
				parcelFocusGraphicsLayer?.removeAll();
			}

			function addOwnerParcelLocationPoints(features)
			{
				if(!ownerParcelPointGraphicsLayer) return;
				ownerParcelPointGraphicsLayer.removeAll();

				(features || []).forEach((feature, index) =>
				{
					const point = getFeaturePointGeometry(feature);
					if(!point) return;

					ownerParcelPointGraphicsLayer.add(new Graphic({
						geometry: point,
						attributes: {
							parcelNumber: getParcelDisplayName(feature),
							index: index + 1
						},
						symbol: {
							type: "simple-marker",
							style: "circle",
							size: 17,
							color: [31, 111, 235, 0.96],
							outline: {
								color: [78, 245, 224, 1],
								width: 2.5
							}
						}
					}));

					ownerParcelPointGraphicsLayer.add(new Graphic({
						geometry: point,
						symbol: {
							type: "text",
							text: String(index + 1),
							color: [255, 255, 255, 1],
							font: {
								size: 11,
								weight: "bold"
							},
							yoffset: -1
						}
					}));
				});
			}

			function refreshOwnerParcelLocationPoints()
			{
				const selected = getSelectedParcels?.() || [];
				clearOwnerParcelLocationPoints();
				if(selected.length > 1) addOwnerParcelLocationPoints(selected);
			}

			async function refreshOwnerParcelLocationPointsAndZoom()
			{
				const selected = getSelectedParcels?.() || [];
				refreshOwnerParcelLocationPoints();
				if(selected.length < 1) return;
				if(currentPage !== "parcel") return;

				const target = selected.length === 1
					? getFeatureMapTarget(selected[0])
					: getCombinedFeatureTarget(selected);

				if(!target) return;

				const view = activeView || mapView;
				await view.goTo({
					target: selected.length === 1
						? (target.expand?.(2) || target)
						: target,
					scale: target.type === "point"
						? (view === sceneView ? 2500 : 1800)
						: undefined,
					tilt: view === sceneView ? 70 : undefined
				});
			}

			function flashSelectedParcelFeature(feature)
			{
				if(!parcelFocusGraphicsLayer || !feature?.geometry) return;
				parcelFocusGraphicsLayer.removeAll();

				if(feature.geometry.type === "polygon")
				{
					parcelFocusGraphicsLayer.add(new Graphic({
						geometry: feature.geometry,
						symbol: {
							type: "simple-fill",
							color: [255, 107, 53, 0.16],
							outline: {
								color: [255, 107, 53, 1],
								width: 3
							}
						}
					}));
				}

				const point = getFeaturePointGeometry(feature);
				if(point)
				{
					parcelFocusGraphicsLayer.add(new Graphic({
						geometry: point,
						symbol: {
							type: "simple-marker",
							style: "circle",
							size: 34,
							color: [255, 107, 53, 0],
							outline: {
								color: [255, 107, 53, 1],
								width: 4
							}
						}
					}));
				}
			}

			async function zoomToSelectedParcelFeature(feature)
			{
				if(currentPage !== "parcel") return;
				if(activeView !== mapView) await switchTo2D();

				clearParcelFocusGraphic();

				const target = getFeatureMapTarget(feature);
				if(!target) return;

				await mapView.goTo({
					target: target.expand?.(2) || target,
					scale: target.type === "point" ? 1800 : undefined
				});
			}

			// ---- 2D/3D toggle (FAB) ONLY for Parcel page
			async function switchTo2D()
			{
				if(activeView===mapView) return;

				const vp=activeView.viewpoint.clone();
				const lat=vp.targetGeometry?.latitude;
				const scaleFactor=(typeof lat==="number")? Math.cos((lat*Math.PI)/180):1;
				vp.scale/=scaleFactor;

				mapView.viewpoint=vp;
				showAndHide(mapEl,sceneEl);

				activeView=mapView;
				dockViewModeToggleTo(mapEl);
				if(viewModeToggle) viewModeToggle.dataset.mode = "2d";
				if(viewModeSwitch) viewModeSwitch.checked = false;
				rectangleSelectionActive = false;
				sketchViewModel2d?.cancel();
				polygonGraphicsLayer?.removeAll();
				if(rectangleToolPopover) rectangleToolPopover.open = false;
				syncWidgetActiveStates();
				await refreshLayerRefs();
			}

			async function switchTo3D()
			{
				if(activeView===sceneView) return;

				const vp=activeView.viewpoint.clone();
				const lat=vp.targetGeometry?.latitude;
				const scaleFactor=(typeof lat==="number")? Math.cos((lat*Math.PI)/180):1;
				vp.scale*=scaleFactor;

				sceneView.viewpoint=vp;
				showAndHide(sceneEl,mapEl);

				activeView=sceneView;
				dockViewModeToggleTo(sceneEl);
				if(viewModeToggle) viewModeToggle.dataset.mode = "3d";
				if(viewModeSwitch) viewModeSwitch.checked = true;
				rectangleSelectionActive = false;
				sketchViewModel2d?.cancel();
				polygonGraphicsLayer?.removeAll();
				if(rectangleToolPopover) rectangleToolPopover.open = false;
				syncWidgetActiveStates();
				await refreshLayerRefs();
			}

			function syncViewModeToggleFromActiveView()
			{
				const is3d = activeView === sceneView;
				if(viewModeToggle) viewModeToggle.dataset.mode = is3d ? "3d" : "2d";
				if(viewModeSwitch) viewModeSwitch.checked = is3d;
			}

			syncViewModeToggleFromActiveView();

			const viewModeChangeEvent =
				viewModeSwitch?.tagName?.toLowerCase?.() === "calcite-switch"
					? "calciteSwitchChange"
					: "change";

			viewModeSwitch?.addEventListener(viewModeChangeEvent, async () =>
			{
				if(currentPage!=="parcel") return;

				if(viewModeSwitch.checked)
				{
					await switchTo3D();
				}
				else
				{
					await switchTo2D();
				}

				syncViewModeToggleFromActiveView();
			});

			// ---- DOM refs for parcel UI
			const buildingListEl=document.getElementById("buildingList");
			const floorListEl=document.getElementById("floorList");
			const parcelListEl=document.getElementById("parcelList");
			const buildingSearchEl=document.getElementById("buildingSearch");
			const parcelSearchEl=document.getElementById("parcelSearch");

			const selectedParcelContentEl=document.getElementById("selectedParcelContent");
			const launchBtn=document.getElementById("launchSurveyButton");

			// ---- State
			let tylerExtractTable = null;
			let currentPage="parcel";

			// ---- Layers (stable)
			let condoLayer=null;
			let regularParcelLayer=null;
			let parcelLayer=null;
			let floorLayer=null;
			let lrcRequestLayer=null;
			let lrcFormFeature=null;
			let lrcFeatureFormEl=null;
			let KansasCityLayer=null;
			let MissouriLayer=null;
			let MajorCitiesLayer=null;
			let JacksonCountyMaskLayer=null;
			let addressLayer2d=null;
			let addressLayer3d=null;

			// ---- Search Controller
			let searchController = null;
			


			// ---- LayerViews
			let parcelLayerView=null;
			let floorLayerView=null;
			let regularParcelLayerView=null;

			async function refreshLayerRefs()
			{
				async function loadOptionalLayer(layer)
				{
					if(!layer) return false;

					try
					{
						await layer.load();
						return true;
					}
					catch
					{
						return false;
					}
				}

				condoLayer=sceneView.map?.allLayers?.find(l => l.title==="Parcel Condominiums")||null;
				floorLayer=sceneView.map?.allLayers?.find(l => l.title==="Parcel Condominiums Floors")||null;
				ESRILayer=sceneView.map?.allLayers?.find(l => l.title==="Esri 3D Buildings")||null;
				regularParcelLayer=mapView.map?.allLayers?.find(l => l.title==="Parcels")||null;
				lrcRequestLayer = mapView.map?.allLayers?.find(l => l.title === "Land Records Change Request") || null;

				KansasCityLayer=sceneView.map?.allLayers?.find(l => l.title==="Kansas City")||null;
				MissouriLayer=sceneView.map?.allLayers?.find(l => l.title==="Missouri")||null;
				MajorCitiesLayer=sceneView.map?.allLayers?.find(l => l.title==="Major Cities")||null;
				JacksonCountyMaskLayer=sceneView.map?.allLayers?.find(l => l.title==="Jackson County Mask")||null;
				addressLayer2d=mapView.map?.allLayers?.find(l => l.title==="Addresses")||null;
				addressLayer3d=sceneView.map?.allLayers?.find(l => l.title==="Addresses")||null;

				floorLayer = floorLayer || condoLayer;

				if (!tylerExtractTable)
				{
					tylerExtractTable = new FeatureLayer({
						url: PARCEL_INFORMATION_TABLE_URL,
						listMode: "hide"
					});
				}

				lrmLayer2d=mapView.map?.allLayers?.find(l => l.title==="Land Records Change Request")||null;
				lrmLayer3d=sceneView.map?.allLayers?.find(l => l.title==="Land Records Change Request")||null;

				await loadOptionalLayer(lrmLayer2d);
				await loadOptionalLayer(lrmLayer3d);

				await loadOptionalLayer(addressLayer2d);
				await loadOptionalLayer(addressLayer3d);

				[KansasCityLayer,MissouriLayer, MajorCitiesLayer,JacksonCountyMaskLayer,ESRILayer].forEach(layer =>
				{
					if(layer && layer !== condoLayer && layer !== floorLayer)
					{
						layer.listMode="hide";
					}
				});

				await loadOptionalLayer(condoLayer);
				await loadOptionalLayer(floorLayer);
				[condoLayer, floorLayer].forEach(layer =>
				{
					if (!layer) return;
					layer.listMode = "show";
					layer.outFields = ["*"];
				});
				if(regularParcelLayer) await regularParcelLayer.load();
				await loadOptionalLayer(lrcRequestLayer);
				await loadOptionalLayer(tylerExtractTable);

				if(lrcRequestLayer)
				{
					lrcRequestLayer.formTemplate = {
						title: "Land Record Change Request",
						description: "Complete the request details below.",
						elements: [
							{
								type: "group",
								label: "Contact Information",
								description: "Who is submitting the request.",
								elements: [
									{
										type: "field",
										fieldName: "name",
										label: "Name"
									},
									{
										type: "field",
										fieldName: "company",
										label: "Company"
									},
									{
										type: "field",
										fieldName: "email",
										label: "Email"
									},
									{
										type: "field",
										fieldName: "phone",
										label: "Phone"
									}
								]
							},
							{
								type: "group",
								label: "Request Details",
								description: "Request information for parcel maintenance.",
								elements: [
									{
										type: "field",
										fieldName: "parcelnumber",
										label: "Parcel Number"
									},
									{
										type: "field",
										fieldName: "reqtype",
										label: "Request Type"
									},
									{
										type: "field",
										fieldName: "status",
										label: "Status"
									},
									{
										type: "field",
										fieldName: "notes",
										label: "Notes"
									}
								]
							},
							{
								type: "group",
								label: "Optional Tracking",
								description: "Internal tracking fields if needed.",
								elements: [
									{
										type: "field",
										fieldName: "assigneduser",
										label: "Assigned User"
									},
									{
										type: "field",
										fieldName: "submission_type",
										label: "Submission Type"
									},
									{
										type: "field",
										fieldName: "mondayid",
										label: "Monday ID"
									}
								]
							}
						]
					};

				}

				parcelLayer=condoLayer;

				try { parcelLayerView=condoLayer? await sceneView.whenLayerView(condoLayer):null; }
				catch { parcelLayerView=null; }

				try { floorLayerView=floorLayer? await sceneView.whenLayerView(floorLayer):null; }
				catch { floorLayerView=null; }

				try { regularParcelLayerView=regularParcelLayer? await mapView.whenLayerView(regularParcelLayer):null; }
				catch { regularParcelLayerView=null; }
			}
			// ---- Utility

			function buildLrcRequestGeometry()
			{
				const geometries = getSelectedParcels()
					.map(f => f.geometry)
					.filter(Boolean);

				if(!geometries.length) return null;

				if(geometries.length === 1) return geometries[0];

				return unionOperator.executeMany(geometries);
			}

			function buildMergeMultipartGeometry()
			{
				const geometries = getSelectedParcels()
					.map(f => f.geometry)
					.filter(g => g && g.type === "polygon");

				if(!geometries.length) return null;
				if(geometries.length === 1) return geometries[0];

				const first = geometries[0];
				const rings = [];

				geometries.forEach(g =>
				{
					if(Array.isArray(g.rings))
					{
						g.rings.forEach(ring => rings.push(ring));
					}
				});

				return {
					type: "polygon",
					rings: rings,
					spatialReference: first.spatialReference
				};
			}

			async function wireSearchEnterBehavior()
			{
				await searchEl.componentOnReady?.();

				if (searchEl.dataset.enterWired === "true") return;
				searchEl.dataset.enterWired = "true";

				function forceCloseSearchSuggestions()
				{
					searchEl.close?.();
					requestAnimationFrame(() => searchEl.close?.());
					setTimeout(() => searchEl.close?.(), 0);
					setTimeout(() => searchEl.close?.(), 90);
					setTimeout(() => searchEl.close?.(), 180);
				}

				searchEl.addEventListener("keydown", async (event) =>
				{
					if (event.key !== "Enter") return;

					event.preventDefault();
					event.stopPropagation();
					event.stopImmediatePropagation();

					const term = getCurrentSearchInputValue(event);

					if (!term) return;

					const looksLikeUnseparatedParcelList =
						/\d{2}-\d{3}-\d{2}-\d{2}-\d{2}-\d-\d{2}-\d{3}\s+\d{2}-\d{3}/.test(term) ||
						/\d{17}\s+\d{17}/.test(term);
					const parsedBatch = parseParcelBatch(term);
					const shouldHandleAsParcelBatch = isParcelBatchCandidate(term, parsedBatch);

					// Parcel number entry, whether single or multi-value, should keep the legacy
					// select-and-zoom flow instead of dropping into the generic search widget.
					if (shouldHandleAsParcelBatch)
					{
						await selectMultipleParcelsFromSearch(term);

						// close suggestion UI after batch handling
						forceCloseSearchSuggestions();

						return;
					}

					if (looksLikeUnseparatedParcelList)
					{
						showAppNotice("Separate multiple parcel numbers with commas with or without spaces, semicolons, or new lines. Use either all full dashed parcel numbers like 29-220-16-06-00-0-00-000, or all 17-digit parcel numbers with no dashes.");
						forceCloseSearchSuggestions();
						return;
					}

					const termToSearch = formatParcelWithDashes(term) || term;

					try
					{
						const firstMatch = await searchController?.findFirstMatch?.(termToSearch);

						if (firstMatch)
						{
							searchEl.value = firstMatch.name || termToSearch;
							searchEl.searchTerm = firstMatch.name || termToSearch;
							await searchController.focusSearchResult(firstMatch);
							forceCloseSearchSuggestions();
							return;
						}

					}
					catch
					{
					}
					finally
					{
						forceCloseSearchSuggestions();
					}
				}, true);
			}
			// ---- Init
			await refreshLayerRefs();
			// ---- Module initializations
			let openLrcFeatureForm = null;
			let openMergeLrcFeatureForm = null;

			const parcelSelectionModule = initParcelSelection({
				getRegularParcelLayerView: () => regularParcelLayerView,
				getFloorLayerView: () => floorLayerView,
				getTylerExtractTable: () => tylerExtractTable,
				getPolygonGraphicsLayer: () => polygonGraphicsLayer,
				onSelectionChanged: async () => { await selectedParcelUIModule.updateSelectedPanel(); },
				parcelListEl, selectedParcelContent2d, selectedParcelContent3d, selectedParcelBadge2d, selectedParcelBadge3d
			});
			const { getSelectedParcels, toggleParcelSelection, selectFeaturesByRectangle, clearSelectedParcels,
					clearHighlightsAndSets, removeSelectedParcelByKey, getTylerDataByParcel,
					getHighlightLayerViewForFeature, syncParcelListSelection, updateSelectedParcelBadge } = parcelSelectionModule;

			let selectedParcelUIModule;
			selectedParcelUIModule = initSelectedParcelUI({
				getSelectedParcels, removeSelectedParcelByKey, clearSelectedParcels, clearHighlightsAndSets,
				syncParcelListSelection, updateSelectedParcelBadge, getTylerDataByParcel,
				onSelectedParcelHover: flashSelectedParcelFeature,
				onSelectedParcelHoverEnd: clearParcelFocusGraphic,
				onSelectedParcelRowClick: zoomToSelectedParcelFeature,
				clearOwnerParcelLocationPoints,
				refreshOwnerParcelLocationPoints,
				refreshOwnerParcelLocationPointsAndZoom,
				getOpenLrcFeatureForm: () => openLrcFeatureForm,
				getOpenMergeLrcFeatureForm: () => openMergeLrcFeatureForm,
				setRightSidebarCollapsed, updateRightSidebarState,
				getCurrentPage: () => currentPage, searchEl,
				rightSidebarContent, selectedParcelExpandEl,
				selectedParcelContent2d, selectedParcelContent3d, selectedParcelBadge2d, selectedParcelBadge3d,
				clearSelectedParcelsButton2d, clearSelectedParcelsButton3d, parcelListEl
			});
			const { updateSelectedPanel, openSelectedParcelPanel, closeSelectedParcelPanel, clearAllSelectedParcels, syncSearchBarWithSelectedParcels } = selectedParcelUIModule;

			const { populateBuildingList, attachViewClickHandler, selectBuildingFloorParcel } = initBuildingSelection({
				getCondoLayer: () => condoLayer,
				getFloorLayer: () => floorLayer,
				getESRILayer: () => ESRILayer,
				getParcelLayer: () => parcelLayer,
				getRegularParcelLayer: () => regularParcelLayer,
				getSceneView: () => sceneView,
				FeatureLayerClass: FeatureLayer,
				buildingListServiceUrl: BUILDING_LIST_SERVICE_URL,
				switchTo3D, toggleParcelSelection,
				clearHighlightsAndSets, clearSelectedParcels, clearAllSelectedParcels, syncParcelListSelection, openLeftSidebar,
				getCurrentPage: () => currentPage, FeatureFilter,
				buildingListEl, floorListEl, parcelListEl, buildingSearchEl, parcelSearchEl
			});
			attachViewClickHandler(sceneView);
			attachViewClickHandler(mapView);
			leftSidebarToggle?.addEventListener("click", () => {
				void populateBuildingList();
			});

			const lrcModule = initLrcForms({
				getSelectedParcels,
				getLrcRequestLayer: () => lrcRequestLayer,
				getRightSidebarContent: () => rightSidebarContent,
				getParcelDisplayName: (f) => getParcelDisplayName(f),
				updateSelectedPanel: () => selectedParcelUIModule.updateSelectedPanel(),
				buildLrcRequestGeometry, buildMergeMultipartGeometry, Graphic
			});
			openLrcFeatureForm = lrcModule.openLrcFeatureForm;
			openMergeLrcFeatureForm = lrcModule.openMergeLrcFeatureForm;

			const featureTableEl = document.getElementById("parcelsTable");

			searchController = await createParcelSearchController({
			searchEl,

			pvParcelLayer: regularParcelLayer,
			pvOwnerTableLayer: tylerExtractTable,
			pvCondoLayer: floorLayer,
			pvAddressLayer2d: addressLayer2d,
			pvAddressLayer3d: addressLayer3d,

			pwParcelLayer: null,
			pwCondoLayer: null,
			pwAddressLayer: null,

			saParcelLayer: null,
			saCondoLayer: null,
			saAddressLayer: null,

			pvMapView: mapView,
			sceneView,
			pwMapView: null,
			saMapView: null,

			featureTable: featureTableEl,
			SearchSourceClass: SearchSource,

			switchTo2D,
			switchTo3D,
			toggleParcelSelection,
			selectBuildingFloorParcel,
			syncSearchBarWithSelectedParcels,
			addOwnerParcelLocationPoints,
			clearOwnerParcelLocationPoints,

			getActiveView: () => activeView,
			getCurrentPage: () => currentPage,
			getSelectedParcels,
			getPVOwnerTableLayer: () => tylerExtractTable,
			getPWMapView,
			getPWParcelLayer,
			getPWCondoLayer,
			getPWAddressLayer,
			getSAMapView,
			getSAParcelLayer,
			getSACondoLayer,
			getSAAddressLayer
			});
			await wireSearchEnterBehavior();
			const initialPage = getAccessiblePageKeys().includes("parcel") ? "parcel" : getAccessiblePageKeys()[0];
			await switchPage(initialPage);
			
			window.clearAllSelectedParcels = clearAllSelectedParcels;
			//window.launchSurvey = launchSurvey;

			updateLeftSidebarState();
			updateRightSidebarState();
			preloader.hide();
			const scheduleBuildingListLoad = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 1200));
			scheduleBuildingListLoad(() => {
				void populateBuildingList();
			});
			const scheduleMapInfoPreload = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 1800));
			scheduleMapInfoPreload(() => {
				mapInfoPanel?.preloadAllPages?.();
			});
			const requestedHelpTour = new URL(window.location.href).searchParams.get("helpTour");
			if(requestedHelpTour)
			{
				window.setTimeout(() => {
					helpTours.startTour(requestedHelpTour);
				}, 800);
			}

		} catch(err)
		{
			if(err?.message !== APP_BOOT_ABORT)
			{
				console.error(err);
				preloader.fail(err?.message || "Unknown error");
			}
		}
		const PortalBasemapsSource = await $arcgis.import(
		"@arcgis/core/widgets/BasemapGallery/support/PortalBasemapsSource.js"
		);

		const basemapGallery2d = document.getElementById("basemapGallery2d");

		if (basemapGallery2d) {
		basemapGallery2d.source = new PortalBasemapsSource({
			query: {
			id: "ddb73f5899734779a4a05cd3fdef651b"
			}
		});
		}
		const mapToolExpandsAnalysis = [
			document.getElementById("basemapExpandAnalysis"),
			document.getElementById("layerListExpandAnalysis")
		].filter(Boolean);

		mapToolExpandsAnalysis.forEach((expand) => {
			expand.addEventListener("arcgisPropertyChange", (event) => {
				if (event?.detail?.name !== "expanded") return;
				if (!expand.expanded) return;

				mapToolExpandsAnalysis.forEach((otherExpand) => {
					if (otherExpand !== expand) {
						otherExpand.expanded = false;
					}
				});
			});
		});

		const mapToolExpandsPw = [
			document.getElementById("basemapExpandPw"),
			document.getElementById("layerListExpandPw")
		].filter(Boolean);

		mapToolExpandsPw.forEach((expand) => {
			expand.addEventListener("arcgisPropertyChange", (event) => {
				if (event?.detail?.name !== "expanded") return;
				if (!expand.expanded) return;

				mapToolExpandsPw.forEach((otherExpand) => {
					if (otherExpand !== expand) {
						otherExpand.expanded = false;
					}
				});
			});
		});
		const mapToolExpands3d = [
			document.getElementById("basemapExpand3d"),
			document.getElementById("layerListExpand3d"),
			document.getElementById("measurementExpand3d")
		].filter(Boolean);

		mapToolExpands3d.forEach((expand) => {
			expand.addEventListener("arcgisPropertyChange", (event) => {
				if (event?.detail?.name !== "expanded") return;
				if (!expand.expanded) return;

				mapToolExpands3d.forEach((otherExpand) => {
					if (otherExpand !== expand) {
						otherExpand.expanded = false;
					}
				});
			});
		});

		const mapToolExpands2d = [
			document.getElementById("basemapExpand2d"),
			document.getElementById("layerListExpand2d"),
			document.getElementById("measurementExpand2d"),
			document.getElementById("rectangleSelectExpand2d")
		].filter(Boolean);

		mapToolExpands2d.forEach((expand) => {
			expand.addEventListener("arcgisPropertyChange", (event) => {
				if (event?.detail?.name !== "expanded") return;
				if (!expand.expanded) return;

				mapToolExpands2d.forEach((otherExpand) => {
					if (otherExpand !== expand) {
						otherExpand.expanded = false;
					}
				});
			});
		});

	function styleCalcitePanel(panel) {
		if (!panel) return;

		panel.componentOnReady().then(() => {
			requestAnimationFrame(() => {
				const root = panel.shadowRoot;
				if (!root) return;

				const container = root.querySelector(".container");
				const header = root.querySelector(".header-container");
				const heading = root.querySelector(".header-content .heading");
				const content = root.querySelector(".content");

				if (container) {
					container.style.borderRadius = "10px";
					container.style.overflow = "hidden";
					container.style.backgroundClip = "padding-box";
				}

				if (header) {
					header.style.background = "#0a1e3a";
				}

				if (heading) {
					heading.style.color = "#ffffff";
				}

				if (content) {
					content.style.borderBottomLeftRadius = "10px";
					content.style.borderBottomRightRadius = "10px";
				}
			});
		});
	}

	[
	"#basemapExpand2d calcite-panel",
	"#layerListExpand2d calcite-panel",
	"#measurementExpand2d calcite-panel",
	"#rectangleSelectExpand2d calcite-panel",
	"#basemapExpandPw calcite-panel",
  	"#layerListExpandPw calcite-panel",
	"#basemapExpandAnalysis calcite-panel",
  	"#layerListExpandAnalysis calcite-panel",
	"#basemapExpand3d calcite-panel",
	"#layerListExpand3d calcite-panel",
	"#measurementExpand3d calcite-panel"
	].forEach((selector) => {
	styleCalcitePanel(document.querySelector(selector));
	});
