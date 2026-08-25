export async function createPortalAuth({
  portalUrl,
  clientId,
  popup = false,
  preserveUrlHash = true,
  flowType,
  resourceUrl
}) {
  const [Portal, PortalItem, OAuthInfo, identityManager, WebMap, WebScene] = await $arcgis.import([
    "@arcgis/core/portal/Portal.js",
    "@arcgis/core/portal/PortalItem.js",
    "@arcgis/core/identity/OAuthInfo.js",
    "@arcgis/core/identity/IdentityManager.js",
    "@arcgis/core/WebMap.js",
    "@arcgis/core/WebScene.js"
  ]);

  const normalizedPortalUrl = portalUrl.replace(/\/+$/, "");
  const sharingUrl = `${normalizedPortalUrl}/sharing`;
  const signInResourceUrl = resourceUrl || sharingUrl;

  let oauthRegistered = false;
  let credential = null;
  let portal = null;
  let lastAccessResults = [];

  function serializeError(error) {
    if (!error) {
      return null;
    }

    return {
      name: error?.name || null,
      message: error?.message || String(error),
      details: error?.details || null,
      code: error?.code || null,
      raw: error
    };
  }

  function ensureRegistered() {
    if (oauthRegistered) {
      return;
    }

    const oauthInfo = new OAuthInfo({
      appId: clientId,
      portalUrl: normalizedPortalUrl,
      popup,
      preserveUrlHash,
      ...(flowType ? { flowType } : {})
    });

    identityManager.registerOAuthInfos([oauthInfo]);
    oauthRegistered = true;
  }

  async function loadPortal() {
    if (portal?.loaded) {
      return portal;
    }

    const nextPortal = new Portal({
      url: normalizedPortalUrl,
      authMode: "immediate"
    });

    await nextPortal.load();
    portal = nextPortal;
    return portal;
  }

  async function checkSignIn() {
    ensureRegistered();

    try {
      credential = await identityManager.checkSignInStatus(signInResourceUrl);
      await loadPortal();
      return true;
    } catch (error) {
      credential = null;
      portal = null;
      return false;
    }
  }

  async function signIn() {
    ensureRegistered();
    credential = await identityManager.getCredential(signInResourceUrl, {
      oAuthPopupConfirmation: false
    });
    await loadPortal();
    return credential;
  }

  async function signOut({ reload = true } = {}) {
    identityManager.destroyCredentials();
    credential = null;
    portal = null;

    if (reload) {
      window.location.reload();
    }
  }

  async function canAccessItem(resource) {
    const itemId = resource?.itemId || null;

    if (!itemId) {
      return {
        allowed: false,
        itemId: null,
        title: resource?.title || null,
        error: {
          message: "Missing itemId"
        }
      };
    }

    try {
      const activePortal = await loadPortal();
      const item = new PortalItem({
        id: itemId,
        portal: activePortal
      });

      await item.load();

      if (resource?.resourceType === "webmap" && item.type !== "Web Map") {
        return {
          allowed: false,
          itemId,
          title: item.title || resource?.title || null,
          type: item.type || null,
          owner: item.owner || null,
          access: item.access || null,
          portalUrl: activePortal?.url || normalizedPortalUrl,
          error: {
            message: `Expected Web Map but item type is ${item.type || "unknown"}`
          }
        };
      }

      if (resource?.resourceType === "webscene" && item.type !== "Web Scene") {
        return {
          allowed: false,
          itemId,
          title: item.title || resource?.title || null,
          type: item.type || null,
          owner: item.owner || null,
          access: item.access || null,
          portalUrl: activePortal?.url || normalizedPortalUrl,
          error: {
            message: `Expected Web Scene but item type is ${item.type || "unknown"}`
          }
        };
      }

      if (resource?.resourceType === "webmap") {
        const webMap = new WebMap({
          portalItem: item
        });

        await webMap.load();
      }

      if (resource?.resourceType === "webscene") {
        const webScene = new WebScene({
          portalItem: item
        });

        await webScene.load();
      }

      const result = {
        allowed: true,
        itemId,
        title: item.title || resource?.title || null,
        type: item.type || null,
        owner: item.owner || null,
        access: item.access || null,
        portalUrl: activePortal?.url || normalizedPortalUrl,
        error: null
      };

      return result;
    } catch (error) {
      const result = {
        allowed: false,
        itemId,
        title: resource?.title || null,
        portalUrl: portal?.url || normalizedPortalUrl,
        error: serializeError(error)
      };
      return result;
    }
  }

  async function getAccessibleTabs(tabDefinitions) {
    const results = [];

    for (const definition of tabDefinitions) {
      const resources = definition.resources || [];
      let allowed = true;
      const resourceResults = [];

      for (const resource of resources) {
        const accessResult = await canAccessItem(resource);
        resourceResults.push({
          ...resource,
          ...accessResult
        });

        if (!accessResult.allowed) {
          allowed = false;
        }
      }

      results.push({
        ...definition,
        allowed,
        resourceResults
      });
    }

    lastAccessResults = results;
    return results;
  }

  return {
    canAccessItem,
    checkSignIn,
    getAccessibleTabs,
    getDebugState: () => ({
      portalUrl: normalizedPortalUrl,
      sharingUrl,
      signInResourceUrl,
      isSignedIn: !!credential,
      credential: credential
        ? {
            server: credential?.server || null,
            userId: credential?.userId || null,
            expires: credential?.expires || null,
            ssl: credential?.ssl || null
          }
        : null,
      user: portal?.user
        ? {
            username: portal.user.username || null,
            fullName: portal.user.fullName || null
          }
        : null,
      lastAccessResults
    }),
    getCredential: () => credential,
    getPortal: () => portal,
    getSharingUrl: () => sharingUrl,
    getUser: () => portal?.user || null,
    isSignedIn: () => !!credential,
    signIn,
    signOut
  };
}
