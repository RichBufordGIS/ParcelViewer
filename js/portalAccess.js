// Portal authentication and page-access validation extracted from main.js.
// Factory: call initPortalAccess(refs) before the main initialization sequence.
// Returns helpers used throughout the app boot flow.

/**
 * @param {object} refs
 * @param {object}   refs.appAuth               Portal auth instance (from createPortalAuth)
 * @param {object}   refs.APP_AUTH_CONFIG        { portalUrl, clientId }
 * @param {Function} refs.esriRequest            ArcGIS esriRequest function
 * @param {class}    refs.Portal                 ArcGIS Portal class
 * @param {class}    refs.PortalItem             ArcGIS PortalItem class
 * @param {class}    refs.WebMap                 ArcGIS WebMap class
 * @param {class}    refs.WebScene               ArcGIS WebScene class
 * @param {object[]} refs.pageDefinitions        Array of page definition objects
 *
 * DOM refs (auth header elements — all optional/nullable):
 * @param {Element}  refs.userAuthLicense
 * @param {Element}  refs.userAuthLicenseSymbol
 * @param {Element}  refs.userAuthLicensePlus
 * @param {Element}  refs.userAuthTypeBadge
 * @param {Element}  refs.userAuthLabel
 * @param {Element}  refs.userAuthName
 * @param {Element}  refs.userAuthBtn
 * @param {Element}  refs.userAuthMenu
 * @param {Element}  refs.userAuthMenuFrame
 * @param {Element}  refs.userAuthBackdrop
 * @param {Element}  refs.authOverlay
 * @param {Element}  refs.authOverlayTitle
 * @param {Element}  refs.authOverlayDescription
 * @param {Element}  refs.authPrimaryBtn
 * @param {Element}  refs.authPrimaryBtnIcon
 * @param {Element}  refs.authPrimaryBtnLabel
 * @param {Element}  refs.splashNotice
 */
export function initPortalAccess({
	appAuth,
	APP_AUTH_CONFIG,
	esriRequest,
	Portal,
	PortalItem,
	WebMap,
	WebScene,
	pageDefinitions,

	// header DOM
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

	// auth overlay DOM
	authOverlay,
	authOverlayTitle,
	authOverlayDescription,
	authPrimaryBtn,
	authPrimaryBtnIcon,
	authPrimaryBtnLabel,
	splashNotice
}) {
	// ---- Mutable state -------------------------------------------------------
	let accessiblePageKeys = [];

	// ---- Pure helpers --------------------------------------------------------

	function normalizeUsername(value) {
		return String(value || "").trim().toLowerCase();
	}

	function isOwnerMatch(ownerUsername, currentUsername) {
		return (
			!!normalizeUsername(ownerUsername) &&
			normalizeUsername(ownerUsername) === normalizeUsername(currentUsername)
		);
	}

	function formatAuthDisplayName(user) {
		const fullName = String(user?.fullName || "").trim();
		if (fullName) return fullName;
		return String(user?.username || "").trim();
	}

	function formatPreloaderIdentity(user) {
		if (!user) return "";
		const fullName = String(user?.fullName || "").trim();
		const email = String(user?.email || "").trim();
		const username = String(user?.username || "").trim();
		if (fullName && email) return `${fullName} (${email})`;
		return fullName || email || username;
	}

	const HEADER_PROFILE_VALUE_KEYS = [
		"userType",
		"userTypeId",
		"userLicenseTypeId",
		"userLicenseTypeExtensions",
		"licenseType",
		"role",
		"roleName"
	];

	function collectHeaderProfileStringValues(user, keys) {
		const values = [];
		const sourceJson =
			user?.sourceJSON && typeof user.sourceJSON === "object" ? user.sourceJSON : null;

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

	function getHeaderLicenseFromProfileValues(values) {
		const combined = values.join(" ").toLowerCase();
		if (!combined) return null;

		if (combined.includes("professional plus"))
			return { label: "Professional Plus", icon: "ribbon", color: "#ff9f43", plus: true };
		if (combined.includes("professional"))
			return { label: "Professional", icon: "ribbon", color: "#f3c44e", plus: false };
		if (combined.includes("creator"))
			return { label: "Creator", icon: "pencil", color: "#b35fd6", plus: false };
		if (combined.includes("contributor") || combined.includes("editor"))
			return { label: "Contributor", icon: "collaboration", color: "#2f9e44", plus: false };
		if (combined.includes("mobile worker") || combined.includes("field worker"))
			return { label: "Mobile Worker", icon: "compass-north-circle", color: "#67d46f", plus: false };
		if (combined.includes("indoors"))
			return { label: "Indoors User", icon: "3d-building", color: "#3f7fd6", plus: false };
		if (combined.includes("viewer"))
			return { label: "Viewer", icon: "check", color: "#66b8ff", plus: false };

		return null;
	}

	function getHeaderUserLicensePresentation(user) {
		if (!user) return null;
		const profileValues = collectHeaderProfileStringValues(user, HEADER_PROFILE_VALUE_KEYS);
		return getHeaderLicenseFromProfileValues(profileValues);
	}

	function getHeaderAccountTypeLabel(user, license) {
		if (license?.label) return license.label;

		const rawLabel = collectHeaderProfileStringValues(user, HEADER_PROFILE_VALUE_KEYS).find(
			(value) => {
				const normalizedValue = value.toLowerCase();
				if (normalizedValue === "argisonly" || normalizedValue === "arcgisonly") return false;
				if (normalizedValue === "nameduser") return false;
				return true;
			}
		);

		return rawLabel || "";
	}

	// ---- Header UI -----------------------------------------------------------

	function renderHeaderUserSummary(user) {
		const license = getHeaderUserLicensePresentation(user);
		const accountTypeLabel = getHeaderAccountTypeLabel(user, license);

		if (userAuthLicense) {
			userAuthLicense.hidden = !license;
			userAuthLicense.style.color = license?.color || "";
		}

		if (userAuthLicenseSymbol) {
			userAuthLicenseSymbol.setAttribute("icon", license?.icon || "check");
			userAuthLicenseSymbol.style.color = license?.color || "";
		}

		if (userAuthLicensePlus) {
			userAuthLicensePlus.hidden = !license?.plus;
			userAuthLicensePlus.style.color = license?.color || "";
		}

		if (userAuthTypeBadge) {
			userAuthTypeBadge.hidden = !accountTypeLabel;
			userAuthTypeBadge.textContent = accountTypeLabel;
			userAuthTypeBadge.style.color = license?.color || "";
			userAuthTypeBadge.title = accountTypeLabel || "";
		}
	}

	function renderAuthButton() {
		const user = appAuth.getUser();
		const signedIn = appAuth.isSignedIn();
		const displayName = signedIn && user ? formatAuthDisplayName(user) : "";
		userAuthLabel.textContent = signedIn ? "Account" : "Sign in";
		userAuthBtn.setAttribute("aria-label", signedIn ? "Open account menu" : "Sign in to Portal");
		userAuthBtn.title = signedIn ? displayName || "Account" : "Sign In";
		userAuthName.hidden = !signedIn;
		userAuthName.textContent = signedIn ? displayName : "";

		if (signedIn && user) {
			renderHeaderUserSummary(user);
		} else {
			renderHeaderUserSummary(null);
			hideUserAuthMenu();
		}
	}

	// ---- Auth menu -----------------------------------------------------------

	function hideUserAuthMenu() {
		userAuthMenu.hidden = true;
		userAuthMenu.classList.remove("expanded");
		userAuthMenu.style.width = "";
		userAuthMenu.style.height = "";
		userAuthBtn.setAttribute("aria-expanded", "false");
		userAuthBtn.classList.remove("header-user-btn-open");
		if (userAuthBackdrop) {
			userAuthBackdrop.hidden = true;
			userAuthBackdrop.setAttribute("aria-hidden", "true");
		}
		document.body.classList.remove("user-auth-menu-open");
	}

	function toggleUserAuthMenu(ACCOUNT_PAGE_EMBED_URL) {
		const willShow = userAuthMenu.hidden;
		if (willShow && userAuthMenuFrame) {
			userAuthMenuFrame.src = ACCOUNT_PAGE_EMBED_URL;
		}
		userAuthMenu.hidden = !willShow;
		userAuthBtn.setAttribute("aria-expanded", willShow ? "true" : "false");
		userAuthBtn.classList.toggle("header-user-btn-open", willShow);
		if (userAuthBackdrop) {
			userAuthBackdrop.hidden = !willShow;
			userAuthBackdrop.setAttribute("aria-hidden", willShow ? "false" : "true");
		}
		document.body.classList.toggle("user-auth-menu-open", willShow);
	}

	// ---- Auth overlay --------------------------------------------------------

	function syncSplashNoticeVisibility(showSplash = true) {
		if (!splashNotice) return;
		splashNotice.hidden = !showSplash;
	}

	function showAuthOverlay({
		title,
		description,
		descriptionHtml,
		primaryLabel,
		primaryAction = "signin",
		showSplash = primaryAction === "signin" && !title && !description && !descriptionHtml
	}) {
		syncSplashNoticeVisibility(showSplash);

		authOverlayTitle.textContent = title || "";
		authOverlayTitle.hidden = !title;

		if (descriptionHtml) {
			authOverlayDescription.innerHTML = descriptionHtml;
			authOverlayDescription.hidden = false;
		} else {
			authOverlayDescription.textContent = description || "";
			authOverlayDescription.hidden = !description;
		}

		const isSignOutAction = primaryAction === "signout";
		if (authPrimaryBtnLabel) authPrimaryBtnLabel.textContent = primaryLabel;
		if (authPrimaryBtnIcon)
			authPrimaryBtnIcon.setAttribute("icon", isSignOutAction ? "sign-out" : "sign-in");
		authPrimaryBtn.classList.toggle("signout", isSignOutAction);
		authPrimaryBtn.classList.toggle("primary", !isSignOutAction);
		authPrimaryBtn.setAttribute("aria-label", primaryLabel);
		authPrimaryBtn.title = primaryLabel;
		authPrimaryBtn.dataset.action = primaryAction;
		authOverlay.hidden = false;
	}

	function hideAuthOverlay() {
		authOverlay.hidden = true;
	}

	async function startPortalSignIn() {
		authPrimaryBtn.disabled = true;
		userAuthBtn.disabled = true;

		try {
			await appAuth.signIn();
			window.location.reload();
		} catch (err) {
			showAuthOverlay({
				title: "Sign in failed",
				description:
					err?.message || "The Portal sign-in flow did not complete successfully.",
				primaryLabel: "Try signing in again",
				primaryAction: "signin"
			});
		} finally {
			authPrimaryBtn.disabled = false;
			userAuthBtn.disabled = false;
		}
	}

	// ---- Portal sharing policy -----------------------------------------------

	function isGroupSharedAccess(accessValue) {
		const normalizedAccess = String(accessValue || "").trim().toLowerCase();
		return normalizedAccess === "shared" || normalizedAccess === "groups";
	}

	async function getItemGroupSharing(resource) {
		const portalUrl = (resource.portalUrl || APP_AUTH_CONFIG.portalUrl || "").replace(/\/+$/, "");
		const response = await esriRequest(
			`${portalUrl}/sharing/rest/content/items/${encodeURIComponent(resource.itemId)}/groups`,
			{ responseType: "json", query: { f: "json" } }
		);
		const data = response?.data || {};
		const admin = Array.isArray(data.admin) ? data.admin : [];
		const member = Array.isArray(data.member) ? data.member : [];
		const other = Array.isArray(data.other) ? data.other : [];
		return { admin, member, other, all: [...admin, ...member, ...other] };
	}

	async function evaluatePortalSharingPolicy(resource, portalItem) {
		const currentUser = appAuth.getUser();
		const currentUsername = currentUser?.username || currentUser?.userId || null;
		const itemOwner = portalItem?.owner || null;
		const itemAccess = portalItem?.access || null;

		const policy = {
			currentUsername,
			itemOwner,
			access: itemAccess,
			isOwner: isOwnerMatch(itemOwner, currentUsername),
			allowReason: null,
			groupMembershipTypes: [],
			groupTitles: []
		};

		if (policy.isOwner) {
			policy.allowReason = "owner";
			return { allowed: true, policy };
		}

		if (String(itemAccess || "").trim().toLowerCase() === "private") {
			return {
				allowed: false,
				policy,
				message: "Item is private and the signed-in user is not the owner."
			};
		}

		if (isGroupSharedAccess(itemAccess)) {
			const sharing = await getItemGroupSharing(resource);
			const memberships = sharing.all.map((group) => ({
				id: group?.id || null,
				title: group?.title || null,
				access: group?.access || null,
				memberType: String(group?.userMembership?.memberType || "none").toLowerCase()
			}));
			const explicitMemberships = memberships.filter(
				(group) =>
					group.memberType === "owner" ||
					group.memberType === "admin" ||
					group.memberType === "member"
			);

			policy.groupMembershipTypes = memberships.map((group) => group.memberType);
			policy.groupTitles = memberships.map((group) => group.title).filter(Boolean);

			if (explicitMemberships.length) {
				policy.allowReason = "group-membership";
				return { allowed: true, policy };
			}

			return {
				allowed: false,
				policy,
				message:
					"Item is shared to groups, but the signed-in user is not the owner and is not a member of any shared group."
			};
		}

		policy.allowReason = itemAccess || "loadable";
		return { allowed: true, policy };
	}

	function applyPortalItemAccess(element, resource) {
		if (!element || !resource?.itemId) return;
		const portalUrl = resource.portalUrl || APP_AUTH_CONFIG.portalUrl;
		if (resource.mapInstance) {
			element.removeAttribute("item-id");
			element.map = resource.mapInstance;
			return;
		}
		if (portalUrl && element.portalUrl !== portalUrl) {
			element.setAttribute("portal-url", portalUrl);
		}
		if (element.getAttribute("item-id") !== resource.itemId) {
			element.setAttribute("item-id", resource.itemId);
		}
	}

	async function validatePortalResource(resource) {
		const result = {
			...resource,
			allowed: false,
			itemType: null,
			owner: null,
			access: null,
			mapInstance: null,
			sharingPolicy: null,
			error: null
		};

		try {
			const portalAuthMode = resource.allowAnonymous ? "auto" : "immediate";
			const portal = new Portal({
				url: resource.portalUrl || APP_AUTH_CONFIG.portalUrl,
				authMode: portalAuthMode
			});
			await portal.load();

			const portalItem = new PortalItem({ id: resource.itemId, portal });
			await portalItem.load();

			result.itemType = portalItem.type || null;
			result.owner = portalItem.owner || null;
			result.access = portalItem.access || null;

			const sharingDecision = await evaluatePortalSharingPolicy(resource, portalItem);
			result.sharingPolicy = sharingDecision.policy || null;

			if (!sharingDecision.allowed) {
				result.error = {
					name: "PortalSharingPolicyDenied",
					message: sharingDecision.message,
					details: sharingDecision.policy || null,
					code: "PORTAL_SHARING_POLICY_DENIED"
				};
				return result;
			}

			if (resource.resourceType === "webmap") {
				const webMap = new WebMap({ portalItem });
				await webMap.load();
				result.mapInstance = webMap;
			} else if (resource.resourceType === "webscene") {
				const webScene = new WebScene({ portalItem });
				await webScene.load();
				result.mapInstance = webScene;
			}

			result.allowed = true;
		} catch (error) {
			result.error = {
				name: error?.name || null,
				message: error?.message || String(error),
				details: error?.details || null,
				code: error?.code || null
			};
		}

		return result;
	}

	async function validatePageAccess(definitions) {
		const results = [];
		for (const definition of definitions) {
			const resourceResults = [];
			let allowed = true;
			for (const resource of definition.resources || []) {
				const resourceResult = await validatePortalResource(resource);
				resourceResults.push(resourceResult);
				if (!resourceResult.allowed) allowed = false;
			}
			results.push({ ...definition, allowed, resourceResults });
		}
		return results;
	}

	function setAccessiblePages(keys) {
		accessiblePageKeys = [...keys];
		pageDefinitions.forEach((definition) => {
			const allowed = accessiblePageKeys.includes(definition.key);
			if (definition.buttonEl) definition.buttonEl.hidden = !allowed;
			if (!allowed) definition.pageEl?.classList.remove("visible");
		});
	}

	function getAccessiblePageKeys() {
		return accessiblePageKeys;
	}

	return {
		// State accessor
		getAccessiblePageKeys,

		// User identity
		formatAuthDisplayName,
		formatPreloaderIdentity,
		renderAuthDisplayName: formatAuthDisplayName,

		// Header UI
		renderHeaderUserSummary,
		renderAuthButton,

		// Auth menu
		hideUserAuthMenu,
		toggleUserAuthMenu,

		// Auth overlay
		showAuthOverlay,
		hideAuthOverlay,
		startPortalSignIn,

		// Portal access
		applyPortalItemAccess,
		validatePortalResource,
		validatePageAccess,
		setAccessiblePages
	};
}
