// src/functions/DailyExtend.js
// Timer trigger: once/day, ensures DueIndex never runs out (set-and-forget)
const { app } = require("@azure/functions");
const { TableClient } = require("@azure/data-tables");
const { DefaultAzureCredential } = require("@azure/identity");
const { DateTime } = require("luxon");

function toSafeKey(s) {
  return Buffer.from(s, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function parseHHmm(s) {
  if (!s) return null;
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(s).trim());
  return m ? { hh: parseInt(m[1], 10), mm: parseInt(m[2], 10) } : null;
}

function buildOccurrences(
  resourceId,
  tz,
  weekdaysOnly,
  start,
  stop,
  horizonDays,
) {
  const out = [];
  const allowed = weekdaysOnly
    ? new Set([1, 2, 3, 4, 5])
    : new Set([1, 2, 3, 4, 5, 6, 7]);

  for (let d = 0; d < horizonDays; d++) {
    const dayLocal = DateTime.now()
      .setZone(tz)
      .startOf("day")
      .plus({ days: d });
    if (!allowed.has(dayLocal.weekday)) continue;

    if (start)
      out.push({
        atUtc: dayLocal
          .set({ hour: start.hh, minute: start.mm })
          .toUTC()
          .startOf("minute"),
        action: "alloc",
        vmResourceId: resourceId,
      });
    if (stop)
      out.push({
        atUtc: dayLocal
          .set({ hour: stop.hh, minute: stop.mm })
          .toUTC()
          .startOf("minute"),
        action: "dealloc",
        vmResourceId: resourceId,
      });
  }
  return out;
}

app.timer("DailyExtend", {
  schedule: "0 5 0 * * *", // 00:05 UTC daily
  handler: async (myTimer, context) => {
    const tablesUrl = process.env.TABLES_URL;
    const tz = process.env.DEFAULT_TZ || "Europe/London";
    const horizonDays = parseInt(process.env.HORIZON_DAYS || "7", 10);
    if (!tablesUrl) return;

    const credential = new DefaultAzureCredential();
    const schedClient = new TableClient(tablesUrl, "VmSchedules", credential);
    const dueClient = new TableClient(tablesUrl, "DueIndex", credential);

    for await (const s of schedClient.listEntities()) {
      if (!s.enabled) continue;

      const start = parseHHmm(s.start);
      const stop = parseHHmm(s.stop);
      if (!start && !stop) continue;

      const occurrences = buildOccurrences(
        s.vmResourceId,
        tz,
        !!s.weekdaysOnly,
        start,
        stop,
        horizonDays,
      );
      const vmKey = toSafeKey(s.vmResourceId);

      for (const occ of occurrences) {
        const pk = occ.atUtc.toFormat("yyyyLLddHHmm");
        const rk = `${occ.action}|${vmKey}`;
        await dueClient.upsertEntity(
          {
            partitionKey: pk,
            rowKey: rk,
            vmResourceId: occ.vmResourceId,
            action: occ.action,
            scheduleHash: s.scheduleHash,
          },
          "Replace",
        );
      }
    }

    context.log("DailyExtend completed");
  },
});
