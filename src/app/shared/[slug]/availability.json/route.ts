import {
  getDashboardBySlug,
  getMonitorAvailability,
  getMonitors,
} from "@/lib/data";

const dayMs = 24 * 60 * 60 * 1000;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const dashboard = await getDashboardBySlug(slug);
  if (!dashboard?.isPublic) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const monitors = (await getMonitors()).filter(
    (monitor) => monitor.isActive && dashboard.monitorIds.includes(monitor.id),
  );
  const to = new Date();
  const from = new Date(to.getTime() - dayMs);
  const rows = await getMonitorAvailability(
    monitors.map(({ id }) => id),
    { from, to },
  );
  const availability = new Map(rows.map((row) => [row.monitorId, row]));

  return Response.json({
    window: { from: from.toISOString(), to: to.toISOString() },
    monitors: monitors.map(({ id, name }) => {
      const row = availability.get(id);
      return {
        id,
        name,
        observedChecks: row?.observedChecks ?? 0,
        availabilityPercent: row
          ? Math.round((row.availabilityScore / row.observedChecks) * 10_000) /
            100
          : null,
      };
    }),
  });
}
