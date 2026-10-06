(function () {
  const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
  const LAST_ACTIVITY_KEY = "buscaSaltoMetricsLastActivity";
  let fallbackLastActivity = 0;

  function send(event, payload = {}) {
    try {
      navigator.sendBeacon?.("/api/metricas", new Blob([
        JSON.stringify({ event, payload, path: location.pathname }),
      ], { type: "application/json" }));
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
    if (!lastActivity || now - lastActivity >= SESSION_TIMEOUT_MS || lastActivity > now) {
      send("visit");
    }
    send(event, payload);
  }

  window.BuscaSaltoMetrics = { track };
})();
