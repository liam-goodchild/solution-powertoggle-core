// src/functions/Scheduler.js
// Timer trigger: every minute, execute DueIndex rows that match current VmSchedules.scheduleHash; purge stale rows
const { app } = require("@azure/functions");
const { TableClient } = require("@azure/data-tables");
const { DefaultAzureCredential } = require("@azure/identity");
const { ComputeManagementClient } = require("@azure/arm-compute");
const { DateTime } = require("luxon");

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

async function startVm(resourceId) {
  const { sub, rg, name } = parseVmId(resourceId);
  const cred = new DefaultAzureCredential();
  const client = new ComputeManagementClient(cred, sub);
  await client.virtualMachines.beginStartAndWait(rg, name);
}

async function deallocateVm(resourceId) {
  const { sub, rg, name } = parseVmId(resourceId);
  const cred = new DefaultAzureCredential();
  const client = new ComputeManagementClient(cred, sub);
  await client.virtualMachines.beginDeallocateAndWait(rg, name);
}

app.timer("Scheduler", {
  schedule: "0 * * * * *", // every minute
  handler: async (myTimer, context) => {
    const tablesUrl = process.env.TABLES_URL;
    const drift = parseInt(process.env.ALLOW_DRIFT_MINUTES || "1", 10);
    if (!tablesUrl) return;

    const credential = new DefaultAzureCredential();
    const dueClient = new TableClient(tablesUrl, "DueIndex", credential);
    const schedClient = new TableClient(tablesUrl, "VmSchedules", credential);

    const nowUtc = DateTime.utc().startOf("minute");

    for (let i = 0; i <= drift; i++) {
      const pk = nowUtc.minus({ minutes: i }).toFormat("yyyyLLddHHmm");

      for await (const e of dueClient.listEntities({
        queryOptions: { filter: `PartitionKey eq '${pk}'` },
      })) {
        try {
          const { sub } = parseVmId(e.vmResourceId);
          const vmKey = toSafeKey(e.vmResourceId);

          // Load current schedule; if missing, delete stale due row
          let sched;
          try {
            sched = await schedClient.getEntity(sub, vmKey);
          } catch {
            await dueClient.deleteEntity(e.partitionKey, e.rowKey);
            continue;
          }

          // If disabled or stale schedule, purge and do nothing
          if (
            !sched.enabled ||
            (e.scheduleHash &&
              sched.scheduleHash &&
              e.scheduleHash !== sched.scheduleHash)
          ) {
            await dueClient.deleteEntity(e.partitionKey, e.rowKey);
            continue;
          }

          if (e.action === "alloc") await startVm(e.vmResourceId);
          if (e.action === "dealloc") await deallocateVm(e.vmResourceId);

          await dueClient.deleteEntity(e.partitionKey, e.rowKey);
        } catch (err) {
          context.error(err?.message || err);
        }
      }
    }
  },
});
