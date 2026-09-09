// Centralized Parcel Viewer notifications and caught-error reporting.
// Use user-facing notifications for recoverable operations. Keep the auth overlay
// for blocking authentication / application-startup failures.
const ALERT_HOST_ID = "parcelViewerAlertHost";
const DEFAULT_TITLES = {
    danger: "Something went wrong",
    warning: "Action needs attention",
    success: "Success",
    info: "Information"
};
/** Returns alert host. */
function getAlertHost() {
    let host = document.getElementById(ALERT_HOST_ID);
    if (host)
        return host;
    host = document.createElement("div");
    host.id = ALERT_HOST_ID;
    host.className = "parcel-viewer-alert-host";
    host.setAttribute("aria-live", "polite");
    host.setAttribute("aria-atomic", "false");
    document.body.appendChild(host);
    return host;
}
/** Displays user. */
export function notifyUser(message, { title, kind = "danger", autoClose = true, duration = "medium" } = {}) {
    const text = String(message || "").trim();
    if (!text)
        return null;
    const alert = document.createElement("calcite-alert");
    alert.kind = kind;
    alert.icon = true;
    alert.open = true;
    alert.setAttribute("open", "");
    alert.setAttribute("label", title || DEFAULT_TITLES[kind] || "Notification");
    if (autoClose) {
        alert.setAttribute("auto-close", "");
        alert.setAttribute("auto-close-duration", duration);
    }
    const heading = document.createElement("div");
    heading.slot = "title";
    heading.textContent = title || DEFAULT_TITLES[kind] || "Notification";
    const body = document.createElement("div");
    body.slot = "message";
    body.textContent = text;
    alert.append(heading, body);
    getAlertHost().appendChild(alert);
    const remove = () => alert.remove();
    alert.addEventListener("calciteAlertClose", remove, { once: true });
    setTimeout(() => {
        if (!alert.isConnected)
            return;
        if (!alert.open && !alert.hasAttribute("open"))
            remove();
    }, 12000);
    return alert;
}
/** Displays error. */
export function notifyError(message, options = {}) {
    return notifyUser(message, { ...options, kind: "danger" });
}
/** Displays warning. */
export function notifyWarning(message, options = {}) {
    return notifyUser(message, { ...options, kind: "warning" });
}
/** Displays success. */
export function notifySuccess(message, options = {}) {
    return notifyUser(message, { ...options, kind: "success" });
}
/** Logs caught error. */
export function logCaughtError(context, error) {
    console.warn(`[Parcel Viewer] ${context}`, error);
}
/** Reports error. */
export function reportError(context, error, { userMessage = "The requested action could not be completed.", title = "Something went wrong", notify = true } = {}) {
    logCaughtError(context, error);
    if (notify)
        notifyError(userMessage, { title });
    return error;
}
