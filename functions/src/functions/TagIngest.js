// src/functions/TagIngest.js
// Event Grid trigger: on VM write, read tags, update VmSchedules, and immediately (re)populate DueIndex
const { app } = require("@azure/functions");
const { TableClient } = require("@azure/data-tables");
const { DefaultAzureCredential } = require("@azure/identity");
const { ComputeManagementClient } = require("@azure/arm-compute");
const { DateTime } = require("luxon");
const crypto = require("crypto");

function parseVmId(resourceId) {
  const parts = resourceId.split("/");
  return { sub: parts[2], rg: parts[4], name: parts[8] };
}

function toSafeKey(s) {
  return Buffer.from(s, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function normalizeTimeTag(s) {
  if (!s) return "";
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(s).trim());
  return m ? `${m[1]}:${m[2]}` : "";
}

function parseHHmm(s) {
  if (!s) return null;
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(s).trim());
  return m ? { hh: parseInt(m[1], 10), mm: parseInt(m[2], 10) } : null;
}

function computeScheduleHash({ enabled, start, stop, weekdaysOnly, tz }) {
  const raw = `${enabled}|${start}|${stop}|${weekdaysOnly}|${tz}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
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
    : new Set([1, 2, 3, 4, 5, 6, 7]); // Mon..Sun

  for (let d = 0; d < horizonDays; d++) {
    const dayLocal = DateTime.now()
      .setZone(tz)
      .startOf("day")
      .plus({ days: d });
    if (!allowed.has(dayLocal.weekday)) continue;

    if (start) {
      out.push({
        atUtc: dayLocal
          .set({ hour: start.hh, minute: start.mm })
          .toUTC()
          .startOf("minute"),
        action: "alloc",
        vmResourceId: resourceId,
      });
    }
    if (stop) {
      out.push({
        atUtc: dayLocal
          .set({ hour: stop.hh, minute: stop.mm })
          .toUTC()
          .startOf("minute"),
        action: "dealloc",
        vmResourceId: resourceId,
      });
    }
  }
  return out;
}

app.eventGrid("TagIngest", {
  handler: async (event, context) => {
    const tablesUrl = process.env.TABLES_URL;
    const tz = process.env.DEFAULT_TZ || "Europe/London";
    const horizonDays = parseInt(process.env.HORIZON_DAYS || "7", 10);
    if (!tablesUrl) return;

    const resourceId = event?.data?.resourceUri;
    if (
      !resourceId ||
      !resourceId.includes("/providers/Microsoft.Compute/virtualMachines/")
    )
      return;

    const { sub, rg, name } = parseVmId(resourceId);

    const credential = new DefaultAzureCredential();
    const compute = new ComputeManagementClient(credential, sub);

    // Read VM to get tags
    const vm = await compute.virtualMachines.get(rg, name);
    const tags = vm.tags || {};

    const enabled =
      String(tags.AutoEnabled ?? "true").toLowerCase() !== "false";
    const startStr = normalizeTimeTag(tags.AutoStart);
    const stopStr = normalizeTimeTag(tags.AutoStop);
    const weekdaysOnly =
      String(tags.AutoWeekdaysOnly ?? "false").toLowerCase() === "true";

    const start = parseHHmm(startStr);
    const stop = parseHHmm(stopStr);

    const vmKey = toSafeKey(resourceId);
    const hash = computeScheduleHash({
      enabled,
      start: startStr,
      stop: stopStr,
      weekdaysOnly,
      tz,
    });

    const schedClient = new TableClient(tablesUrl, "VmSchedules", credential);
    const dueClient = new TableClient(tablesUrl, "DueIndex", credential);

    // 1) Save source-of-truth schedule
    await schedClient.upsertEntity(
      {
        partitionKey: sub,
        rowKey: vmKey,
        vmResourceId: resourceId,
        enabled,
        start: startStr,
        stop: stopStr,
        weekdaysOnly,
        tz,
        scheduleHash: hash,
        updatedUtc: new Date().toISOString(),
      },
      "Replace",
    );

    // 2) Populate DueIndex immediately so changes apply right away
    if (!enabled) return;
    if (!start && !stop) return;

    const occurrences = buildOccurrences(
      resourceId,
      tz,
      weekdaysOnly,
      start,
      stop,
      horizonDays,
    );

    for (const occ of occurrences) {
      const pk = occ.atUtc.toFormat("yyyyLLddHHmm"); // UTC minute bucket
      const rk = `${occ.action}|${vmKey}`;
      await dueClient.upsertEntity(
        {
          partitionKey: pk,
          rowKey: rk,
          vmResourceId: occ.vmResourceId,
          action: occ.action,
          scheduleHash: hash,
        },
        "Replace",
      );
    }

    context.log(
      `TagIngest wrote ${occurrences.length} DueIndex rows for ${resourceId}`,
    );
  },
});
