const assert = require("node:assert/strict");
const { aggregateMetrics } = require("../api/metricas");

const row = (timestamp, event, path = "/", payload = {}) => [
  timestamp, timestamp.slice(0, 10), event, path, JSON.stringify(payload), "127.0.0.0", "Private browser",
];
const rows = [
  row("2026-01-02T12:00:00-03:00", "visit"),
  row("2026-10-05T09:14:00-03:00", "visit"),
  row("2026-10-05T09:15:00-03:00", "search", "/", { busca: "Pastelaria", categoria: "Alimentação", bairro: "Centro" }),
  row("2026-10-05T10:00:00-03:00", "search", "/", { busca: "Pizza", categoria: "Alimentação", bairro: "Centro" }),
  row("2026-10-06T09:16:00-03:00", "search", "/", { busca: "Pastelaria", categoria: "Alimentação", bairro: "Centro" }),
  row("2026-10-06T11:30:00-03:00", "contact_click", "/comercio/5", { nome: "Scallet", tipo: "whatsapp" }),
  row("2026-10-06T12:00:00-03:00", "sponsor_click", "/", { nome: "Uninter" }),
];

const report = (options = {}) => aggregateMetrics(rows, {
  start: "2026-10-05", end: "2026-10-06", granularity: "day", ...options,
});

const full = report();
assert.equal(full.summary.total, 6);
assert.equal(full.records.total, 6);
assert.equal(full.timeline.daily.reduce((sum, bucket) => sum + bucket.total, 0), 6);
assert.equal(full.summary.visits, 1);
assert.equal(full.records.items[0].event, "sponsor_click");
assert.equal(JSON.stringify(full.records).includes("Private browser"), false);
assert.equal(JSON.stringify(full.records).includes("127.0.0.0"), false);

const filtered = report({ event: "search", field: "busca", query: "pastelaria" });
assert.equal(filtered.summary.total, 2);
assert.equal(filtered.searches.terms[0].count, 2);
assert.equal(filtered.timeline.daily.reduce((sum, bucket) => sum + bucket.total, 0), 2);
assert.deepEqual(filtered.records.items.map((item) => item.event), ["search", "search"]);
assert.equal(report({ field: "categoria", query: "Alimentacao" }).summary.total, 3);
assert.equal(report({ field: "comercio", query: "Scallet" }).summary.total, 1);
assert.equal(report({ field: "patrocinador", query: "Uninter" }).summary.total, 1);
assert.equal(report({ field: "path", query: "/comercio/5" }).summary.total, 1);
assert.equal(report({ start: "2026-10-05", end: "2026-10-05", startTime: "09:15", endTime: "09:16" }).summary.total, 1);

for (const granularity of ["hour", "day", "week", "month", "hour_of_day"]) {
  const result = report({ granularity });
  assert.equal(result.timeline.daily.reduce((sum, bucket) => sum + bucket.total, 0), 6, granularity);
}
assert.equal(report({ granularity: "hour_of_day" }).timeline.daily.length, 24);
assert.equal(report({ granularity: "auto" }).timeline.granularity, "hour");
assert.equal(report({ start: "2026-09-01", end: "2026-10-06", granularity: "auto" }).timeline.granularity, "day");
assert.equal(report({ start: "2026-01-01", end: "2026-10-06", granularity: "auto" }).timeline.granularity, "month");
assert.throws(() => report({ start: "2026-09-01", end: "2026-10-06", granularity: "hour" }), { statusCode: 400 });

const paged = report({ page: 2, pageSize: 2 });
assert.equal(paged.records.pageCount, 3);
assert.equal(paged.records.items.length, 2);
assert.equal(paged.records.items[0].event, "search");

const historical = aggregateMetrics(rows, { all: true, granularity: "auto" });
assert.equal(historical.summary.total, 7);
assert.equal(historical.period.start, "2026-01-02");
assert.equal(historical.timeline.granularity, "month");

const pwaRows = [
  row("2026-10-06T12:01:00-03:00", "pwa_prompt_shown", "/", { modo: "prompt" }),
  row("2026-10-06T12:02:00-03:00", "pwa_install_click", "/", { modo: "prompt" }),
  row("2026-10-06T12:03:00-03:00", "pwa_native_accept"),
  row("2026-10-06T12:04:00-03:00", "pwa_installed"),
  row("2026-10-06T12:05:00-03:00", "pwa_prompt_dismiss", "/", { modo: "manual" }),
  row("2026-10-06T12:06:00-03:00", "pwa_native_dismiss"),
  row("2026-10-06T12:07:00-03:00", "pwa_visit_no_notice", "/", { motivo: "standalone" }),
];
const pwa = aggregateMetrics(pwaRows, { start: "2026-10-06", end: "2026-10-06", granularity: "day" });
assert.deepEqual(pwa.summary.pwa, {
  promptShown: 1, installClicks: 1, promptDismissed: 1,
  nativeAccepted: 1, nativeDismissed: 1, installed: 1, visitsWithoutNotice: 1,
});
assert.equal(pwa.pwaNoNoticeReasons[0].label, "standalone");
assert.equal(aggregateMetrics(pwaRows, { start: "2026-10-06", end: "2026-10-06", event: "pwa_install_click", field: "modo", query: "prompt" }).summary.total, 1);
assert.equal(aggregateMetrics(pwaRows, { start: "2026-10-06", end: "2026-10-06", field: "motivo", query: "standalone" }).summary.pwa.visitsWithoutNotice, 1);

console.log("Metrics report: filters, timelines, pagination, PWA events, history and privacy passed.");
