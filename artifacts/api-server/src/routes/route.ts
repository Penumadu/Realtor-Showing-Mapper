import { Router, type IRouter } from "express";
import { OptimizeRouteBody } from "@workspace/api-zod";
import {
  geocodeAddress,
  buildDistanceMatrix,
  nearestNeighborTSP,
  fetchRoutePolyline,
} from "../lib/routeOptimizer";

const router: IRouter = Router();

router.post("/route/optimize", async (req, res) => {
  const parsed = OptimizeRouteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.message });
    return;
  }

  const { properties } = parsed.data;

  const geocodeResults = await Promise.allSettled(
    properties.map((p) => geocodeAddress(p.address, p.label))
  );

  const failed = geocodeResults.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    const reasons = (failed as PromiseRejectedResult[]).map((f) => String(f.reason)).join("; ");
    res.status(422).json({ error: "One or more addresses could not be geocoded", details: reasons });
    return;
  }

  const locations = (geocodeResults as PromiseFulfilledResult<any>[]).map((r) => r.value);

  let orderedLocations = locations;
  if (locations.length > 2) {
    try {
      const matrix = await buildDistanceMatrix(locations);
      const order = nearestNeighborTSP(matrix, 0);
      orderedLocations = order.map((i) => locations[i]);
    } catch (err) {
      req.log.warn({ err }, "Distance matrix failed, using input order");
    }
  }

  const legs: any[] = [];
  let totalDistanceKm = 0;
  let totalDurationMinutes = 0;
  const allPolylinePoints: number[][] = [];

  for (let i = 0; i < orderedLocations.length - 1; i++) {
    const from = orderedLocations[i];
    const to = orderedLocations[i + 1];
    try {
      const segment = await fetchRoutePolyline(from, to);
      legs.push({
        from,
        to,
        distanceKm: segment.distanceKm,
        durationMinutes: segment.durationMinutes,
        order: i + 1,
      });
      totalDistanceKm += segment.distanceKm;
      totalDurationMinutes += segment.durationMinutes;
      if (i === 0) {
        allPolylinePoints.push(...segment.polyline);
      } else {
        allPolylinePoints.push(...segment.polyline.slice(1));
      }
    } catch (err) {
      req.log.warn({ err, from: from.address, to: to.address }, "Routing segment failed");
      const distKm = haversineKm(from.lat, from.lng, to.lat, to.lng);
      const durMin = (distKm / 50) * 60;
      legs.push({
        from,
        to,
        distanceKm: distKm,
        durationMinutes: durMin,
        order: i + 1,
      });
      totalDistanceKm += distKm;
      totalDurationMinutes += durMin;
      allPolylinePoints.push([from.lat, from.lng], [to.lat, to.lng]);
    }
  }

  res.json({
    stops: orderedLocations,
    legs,
    totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
    totalDurationMinutes: Math.round(totalDurationMinutes),
    polyline: allPolylinePoints,
  });
});

router.post("/route/geocode", async (req, res) => {
  const { address } = req.body;
  if (!address || typeof address !== "string") {
    res.status(400).json({ error: "address is required" });
    return;
  }
  try {
    const result = await geocodeAddress(address);
    res.json(result);
  } catch (err) {
    res.status(422).json({ error: "Could not geocode address", details: String(err) });
  }
});

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default router;
