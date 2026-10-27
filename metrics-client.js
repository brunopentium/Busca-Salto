(function () {
  const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
  const LAST_ACTIVITY_KEY = "buscaSaltoMetricsLastActivity";
  let fallbackLastActivity = 0;
  let startedVisitOnPage = false;

  function send(event, payload = {}) {
    const body = JSON.stringify({ event, payload, path: location.pathname });
    try {
      if (navigator.sendBeacon?.("/api/metricas", new Blob([body], { type: "application/json" }))) return;
    } catch (error) {}
    try {
      fetch("/api/metricas", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    } catch (error) {}
  }

  function track(event, payload = {}) {
    const now = Date.now();
    let lastActivity = fallbackLastActivity;
    try {
      lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY)) || 0;
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
    } catch (error) {
      fallbackLastActivity = now;
    }
    const newVisit = !lastActivity || now - lastActivity >= SESSION_TIMEOUT_MS || lastActivity > now;
    if (newVisit) {
      startedVisitOnPage = true;
      send("visit");
    }
    send(event, payload);
    return newVisit;
  }

  window.BuscaSaltoMetrics = { track, startedVisitOnPage: () => startedVisitOnPage };
})();
