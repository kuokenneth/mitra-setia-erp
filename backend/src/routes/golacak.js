const crypto = require("crypto");
const express = require("express");
const { prisma } = require("../prisma");
const { authRequired } = require("../middleware/authRequired");
const { requireRole } = require("../middleware/requireRole");
const { publishUpdate } = require("../realtime");

const router = express.Router();

function clean(value) {
  const result = String(value ?? "").trim();
  return result || null;
}

function number(value) {
  if (value === "" || value === null || value === undefined) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function configuredNumber(value, fallback, minimum) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, parsed) : fallback;
}

function date(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const milliseconds = value < 1e12 ? value * 1000 : value;
    const result = new Date(milliseconds);
    return Number.isNaN(result.getTime()) ? null : result;
  }

  const text = String(value).trim();
  // GOlacak sends Indonesian wall-clock time without an offset. Node runs in
  // UTC on Render, so `new Date("YYYY-MM-DD HH:mm:ss")` used to store it seven
  // hours too far in the future. Explicit Z/+07:00 timestamps remain untouched.
  const hasExplicitZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(text);
  const localParts = !hasExplicitZone && text.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/);
  let result;
  if (localParts) {
    const [, year, month, day, hour, minute, second = "0", fraction = "0"] = localParts;
    const offsetMinutes = Number(process.env.GOLACAK_TIMEZONE_OFFSET_MINUTES || 420);
    const milliseconds = Number(fraction.padEnd(3, "0"));
    result = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second), milliseconds) - offsetMinutes * 60000);
  } else {
    result = new Date(text);
  }
  if (Number.isNaN(result.getTime())) return null;

  // The current GOlacak feed labels its WIB wall-clock value with `Z`. Detect
  // that provider quirk conservatively: only shift timestamps whose adjusted
  // value lands close to the current server time. Correct UTC timestamps and
  // small device clock drift are left unchanged.
  const offsetMinutes = Number(process.env.GOLACAK_TIMEZONE_OFFSET_MINUTES || 420);
  const clockSkewMs = result.getTime() - Date.now();
  const looksLikeWibMarkedAsUtc = clockSkewMs > 30 * 60000
    && clockSkewMs <= (offsetMinutes + 90) * 60000;
  return looksLikeWibMarkedAsUtc ? new Date(result.getTime() - offsetMinutes * 60000) : result;
}

function boolean(value) {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || String(value).toLowerCase() === "true") return true;
  if (value === 0 || value === "0" || String(value).toLowerCase() === "false") return false;
  return null;
}

function first(source, keys) {
  for (const key of keys) {
    if (source?.[key] !== undefined && source[key] !== null && source[key] !== "") return source[key];
  }
  return null;
}

function normalize(raw) {
  const source = raw?.data && typeof raw.data === "object" && !Array.isArray(raw.data) ? { ...raw, ...raw.data } : raw;
  const position = source?.position && typeof source.position === "object" ? source.position : {};
  const device = source?.device && typeof source.device === "object" ? source.device : {};
  return {
    eventType: clean(first(source, ["event", "eventType", "type", "alarm", "alarmType"])),
    deviceId: clean(first(source, ["deviceId", "device_id", "terminalId", "terminal_id"]) ?? first(device, ["id", "deviceId"])),
    imei: clean(first(source, ["imei", "deviceImei", "device_imei"]) ?? first(device, ["imei", "uniqueId"])),
    latitude: number(first(source, ["latitude", "lat"]) ?? first(position, ["latitude", "lat"])),
    longitude: number(first(source, ["longitude", "lng", "lon"]) ?? first(position, ["longitude", "lng", "lon"])),
    speed: number(first(source, ["speed", "velocity"]) ?? first(position, ["speed", "velocity"])),
    ignition: boolean(first(source, ["ignition", "engineOn", "engine_on"]) ?? first(position, ["ignition", "engineOn"])),
    eventAt: date(first(source, ["timestamp", "eventTime", "event_at", "gpsTime", "fixTime"]) ?? first(position, ["timestamp", "fixTime"])),
    upstreamId: clean(first(source, ["eventId", "event_id", "id", "positionId"])),
  };
}

function validCoordinates(latitude, longitude) {
  return latitude !== null && longitude !== null && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

function activePlateNumber(deviceId) {
  const value = clean(deviceId);
  if (!value) return null;
  // Prefer the first Indonesian plate pattern, independent of how GOlacak
  // separates the old plate (" - ", "-", "/", etc.).
  const match = value.toUpperCase().match(/^([A-Z]{1,2})\s*(\d{1,4})\s*([A-Z]{1,3})\b/);
  if (match) return `${match[1]} ${match[2]} ${match[3]}`;
  return clean(value.split(/\s*[-/]\s*/)[0]);
}

function normalizedPlate(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function authorized(req) {
  const expected = clean(process.env.GOLACAK_WEBHOOK_TOKEN);
  const supplied = clean(req.get("Token"));
  if (!expected || !supplied) return false;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function fingerprint(raw, event) {
  return crypto.createHash("sha256").update(JSON.stringify({
    upstreamId: event.upstreamId,
    deviceId: event.deviceId,
    imei: event.imei,
    eventType: event.eventType,
    latitude: event.latitude,
    longitude: event.longitude,
    speed: event.speed,
    ignition: event.ignition,
    eventAt: event.eventAt?.toISOString() || null,
    raw,
  })).digest("hex");
}

function distanceMeters(lat1, lng1, lat2, lng2) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const earthRadius = 6371000;
  const dLat = radians(lat2 - lat1);
  const dLng = radians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateStopState({
  truck,
  event,
  observedAt,
  stopRadiusM,
  movementRadiusM,
}) {
  const hasPreviousPosition = validCoordinates(truck.lastGpsLatitude, truck.lastGpsLongitude);
  const hasStoredAnchor = validCoordinates(truck.gpsStopAnchorLatitude, truck.gpsStopAnchorLongitude);
  const hasStopState = Boolean(truck.gpsStoppedSince && hasStoredAnchor);

  // Every new sequence starts at the newest observation. Speed and ignition
  // are intentionally not used because those fields are not reliable across
  // all GOlacak devices.
  if (!hasStopState) {
    return {
      gpsStoppedSince: observedAt,
      anchorLatitude: event.latitude,
      anchorLongitude: event.longitude,
      remainsInStopArea: true,
      movementConfirmed: false,
      distanceFromAnchor: 0,
    };
  }

  const anchorLatitude = truck.gpsStopAnchorLatitude;
  const anchorLongitude = truck.gpsStopAnchorLongitude;
  const distanceFromAnchor = distanceMeters(event.latitude, event.longitude, anchorLatitude, anchorLongitude);
  const previousDistanceFromAnchor = hasPreviousPosition
    ? distanceMeters(truck.lastGpsLatitude, truck.lastGpsLongitude, anchorLatitude, anchorLongitude)
    : 0;
  const remainsInStopArea = distanceFromAnchor <= stopRadiusM;
  // Hysteresis: one noisy point does not reset the timer. Movement must be
  // outside the wider radius in two consecutive observations.
  const movementConfirmed = distanceFromAnchor >= movementRadiusM
    && previousDistanceFromAnchor >= movementRadiusM;

  return {
    gpsStoppedSince: movementConfirmed ? observedAt : truck.gpsStoppedSince,
    anchorLatitude: movementConfirmed ? event.latitude : anchorLatitude,
    anchorLongitude: movementConfirmed ? event.longitude : anchorLongitude,
    remainsInStopArea,
    movementConfirmed,
    distanceFromAnchor,
  };
}

async function findTruck(event) {
  if (!event.deviceId && !event.imei) return null;
  const mapped = await prisma.truck.findFirst({
    where: { OR: [event.deviceId ? { gpsDeviceId: event.deviceId } : null, event.imei ? { gpsImei: event.imei } : null].filter(Boolean) },
  });
  if (mapped) return mapped;

  // GOlacak uses the active plate as deviceId. Some devices include the old
  // plate after " - ", for example "BK 8535 GD - BK 9677".
  const plateNumber = activePlateNumber(event.deviceId);
  if (!plateNumber) return null;
  let truck = await prisma.truck.findFirst({
    where: { plateNumber: { equals: plateNumber, mode: "insensitive" } },
  });
  if (!truck) {
    const trucks = await prisma.truck.findMany();
    truck = trucks.find((candidate) => normalizedPlate(candidate.plateNumber) === normalizedPlate(plateNumber)) || null;
  }
  if (!truck) return null;

  // Persist the stable IMEI mapping so later events do not depend on a plate
  // number that may change again. Keep an existing explicit mapping intact.
  try {
    return await prisma.truck.update({
      where: { id: truck.id },
      data: {
        gpsDeviceId: truck.gpsDeviceId || event.deviceId,
        gpsImei: truck.gpsImei || event.imei,
      },
    });
  } catch (error) {
    if (error.code !== "P2002") throw error;
    return truck;
  }
}

async function evaluateArrival(truck, event) {
  if (!truck || !validCoordinates(event.latitude, event.longitude)) return { arrived: false };
  const trip = await prisma.trip.findFirst({
    where: { truckId: truck.id, status: { in: ["PLANNED", "DISPATCHED"] } },
    orderBy: { createdAt: "desc" },
    include: { serviceStops: { where: { endedAt: null }, include: { location: true }, take: 1 } },
  });
  if (!trip) return { arrived: false };

  const observedAt = event.eventAt || new Date();
  const departureSpeed = Math.max(0, Number(process.env.GOLACAK_DEPARTURE_MIN_SPEED_KPH || 5));
  const previousDistance = validCoordinates(truck.lastGpsLatitude, truck.lastGpsLongitude)
    ? distanceMeters(event.latitude, event.longitude, truck.lastGpsLatitude, truck.lastGpsLongitude)
    : 0;
  const isMoving = (event.speed !== null && event.speed > departureSpeed) || previousDistance >= 100;
  const pickupCoordinatesValid = Number.isFinite(trip.pickupLat) && Number.isFinite(trip.pickupLng);
  const pickupRadius = Number(trip.pickupRadiusM) || 400;
  const currentPickupDistance = pickupCoordinatesValid ? distanceMeters(event.latitude, event.longitude, trip.pickupLat, trip.pickupLng) : Infinity;
  const previousPickupDistance = pickupCoordinatesValid && validCoordinates(truck.lastGpsLatitude, truck.lastGpsLongitude)
    ? distanceMeters(truck.lastGpsLatitude, truck.lastGpsLongitude, trip.pickupLat, trip.pickupLng)
    : Infinity;
  const locationWasPickup = String(truck.currentLocation || "").trim().toLocaleLowerCase("id-ID") === String(trip.fromText || "").trim().toLocaleLowerCase("id-ID");

  if (trip.status === "PLANNED") {
    const wasAtPickup = locationWasPickup || previousPickupDistance <= pickupRadius;
    const isAtPickup = currentPickupDistance <= pickupRadius;
    // A planned delivery that is already inside its pickup geofence has arrived
    // for loading even when the truck is stationary or only moving slowly.
    // Likewise, crossing beyond the geofence buffer is enough to confirm that a
    // truck previously at pickup has departed; GPS speed must not block it.
    const usesPickupWorkflow = trip.purpose !== "EMPTY_RETURN";
    const isDeliveryAtPickup = usesPickupWorkflow && isAtPickup;
    const hasLeftPickup = usesPickupWorkflow && wasAtPickup && currentPickupDistance > pickupRadius + 50;
    if (!isMoving && !isDeliveryAtPickup && !hasLeftPickup) return { arrived: false, tripId: trip.id, phase: trip.phase };
    const nextPhase = !usesPickupWorkflow ? "TO_DESTINATION" : isAtPickup ? "AT_PICKUP" : wasAtPickup ? "TO_DESTINATION" : "TO_PICKUP";
    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.trip.updateMany({
        where: { id: trip.id, status: "PLANNED" },
        data: {
          status: "DISPATCHED",
          phase: nextPhase,
          dispatchedAt: observedAt,
          pickupArrivedAt: (isAtPickup || wasAtPickup) ? observedAt : undefined,
          loadedAt: nextPhase === "TO_DESTINATION" ? observedAt : undefined,
          gpsArrivalCandidateAt: null,
        },
      });
      if (saved.count) await tx.truck.update({ where: { id: truck.id }, data: { status: "DISPATCH", idleSince: null, availableForBackhaul: false } });
      return Boolean(saved.count);
    });
    return { arrived: false, departed: updated, tripChanged: updated, tripId: trip.id, phase: nextPhase };
  }

  if (trip.phase === "AT_PICKUP" && currentPickupDistance > pickupRadius + 50) {
    const updated = await prisma.trip.updateMany({
      where: { id: trip.id, status: "DISPATCHED", phase: "AT_PICKUP" },
      data: { phase: "TO_DESTINATION", loadedAt: observedAt, gpsArrivalCandidateAt: null },
    });
    return { arrived: false, departed: Boolean(updated.count), tripChanged: Boolean(updated.count), tripId: trip.id, phase: "TO_DESTINATION" };
  }

  if (trip.purpose !== "EMPTY_RETURN" && ["TO_DESTINATION", "SERVICE_AT_BASE"].includes(trip.phase)) {
    const destinationDistance = Number.isFinite(trip.destinationLat) && Number.isFinite(trip.destinationLng)
      ? distanceMeters(event.latitude, event.longitude, trip.destinationLat, trip.destinationLng)
      : Infinity;
    const insideDestination = destinationDistance <= (Number(trip.arrivalRadiusM) || 400);
    const bases = await prisma.operationalLocation.findMany({
      where: { isActive: true, type: "BASE" },
      select: { id: true, name: true, latitude: true, longitude: true, radiusM: true },
    });
    const baseMatches = bases
      .map((base) => ({ ...base, distance: distanceMeters(event.latitude, event.longitude, base.latitude, base.longitude) }))
      .filter((base) => base.distance <= base.radiusM)
      .sort((a, b) => a.distance - b.distance);
    const matchedBase = baseMatches[0] || null;

    if (trip.phase === "SERVICE_AT_BASE") {
      const openStop = trip.serviceStops[0] || null;
      const serviceBase = openStop?.location || bases.find((base) => base.id === trip.serviceCandidateBaseId) || null;
      const serviceDistance = serviceBase ? distanceMeters(event.latitude, event.longitude, serviceBase.latitude, serviceBase.longitude) : Infinity;
      const exitRadius = (Number(serviceBase?.radiusM) || 400) + 50;
      if (isMoving && serviceDistance > exitRadius) {
        const resumed = await prisma.$transaction(async (tx) => {
          const updated = await tx.trip.updateMany({
            where: { id: trip.id, status: "DISPATCHED", phase: "SERVICE_AT_BASE" },
            data: { phase: "TO_DESTINATION", serviceCandidateAt: null, serviceCandidateBaseId: null, gpsArrivalCandidateAt: null },
          });
          if (openStop) await tx.tripServiceStop.updateMany({ where: { id: openStop.id, endedAt: null }, data: { endedAt: observedAt } });
          return Boolean(updated.count);
        });
        return { arrived: false, resumed: resumed, tripChanged: resumed, tripId: trip.id, phase: "TO_DESTINATION" };
      }
      return { arrived: false, service: true, tripId: trip.id, phase: "SERVICE_AT_BASE" };
    }

    if (!insideDestination && matchedBase) {
      const paused = await prisma.$transaction(async (tx) => {
        const updated = await tx.trip.updateMany({
          where: { id: trip.id, status: "DISPATCHED", phase: "TO_DESTINATION", loadedAt: { not: null } },
          data: { phase: "SERVICE_AT_BASE", serviceCandidateAt: null, serviceCandidateBaseId: matchedBase.id, gpsArrivalCandidateAt: null },
        });
        if (updated.count) await tx.tripServiceStop.create({ data: { tripId: trip.id, locationId: matchedBase.id, startedAt: observedAt } });
        return Boolean(updated.count);
      });
      return { arrived: false, service: paused, tripChanged: paused, tripId: trip.id, phase: paused ? "SERVICE_AT_BASE" : trip.phase, base: matchedBase.name };
    }
    if (trip.serviceCandidateAt || trip.serviceCandidateBaseId) {
      await prisma.trip.update({ where: { id: trip.id }, data: { serviceCandidateAt: null, serviceCandidateBaseId: null } });
    }
  }

  const headingToPickup = trip.purpose !== "EMPTY_RETURN" && trip.phase === "TO_PICKUP";
  const headingToDestination = trip.phase === "TO_DESTINATION";
  if (!headingToPickup && !headingToDestination) return { arrived: false, tripId: trip.id, phase: trip.phase };
  const targetLat = headingToPickup ? trip.pickupLat : trip.destinationLat;
  const targetLng = headingToPickup ? trip.pickupLng : trip.destinationLng;
  const targetRadius = headingToPickup ? trip.pickupRadiusM : trip.arrivalRadiusM;
  if (!Number.isFinite(targetLat) || !Number.isFinite(targetLng)) return { arrived: false, tripId: trip.id, phase: trip.phase };

  const distance = distanceMeters(event.latitude, event.longitude, targetLat, targetLng);
  const inside = distance <= targetRadius;
  const maxSpeed = Number(process.env.GOLACAK_ARRIVAL_MAX_SPEED_KPH || 10);
  const slowEnough = event.speed === null || event.speed <= maxSpeed;
  if (!inside || !slowEnough) {
    if (trip.gpsArrivalCandidateAt) {
      await prisma.trip.update({ where: { id: trip.id }, data: { gpsArrivalCandidateAt: null } });
    }
    return { arrived: false, tripId: trip.id, distance: Math.round(distance) };
  }

  if (!trip.gpsArrivalCandidateAt) {
    await prisma.trip.update({ where: { id: trip.id }, data: { gpsArrivalCandidateAt: observedAt } });
    return { arrived: false, candidate: true, tripId: trip.id, distance: Math.round(distance) };
  }
  const dwellMinutes = Math.max(0, Number(process.env.GOLACAK_ARRIVAL_DWELL_MINUTES || 5));
  if (observedAt.getTime() - trip.gpsArrivalCandidateAt.getTime() < dwellMinutes * 60000) {
    return { arrived: false, candidate: true, tripId: trip.id, distance: Math.round(distance) };
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = headingToPickup
      ? await tx.trip.updateMany({
        where: { id: trip.id, status: "DISPATCHED", phase: "TO_PICKUP" },
        data: { phase: "AT_PICKUP", pickupArrivedAt: observedAt, gpsArrivalCandidateAt: null },
      })
      : await tx.trip.updateMany({
        where: { id: trip.id, status: "DISPATCHED", phase: "TO_DESTINATION" },
        data: { status: "ARRIVED", phase: "AT_DESTINATION", arrivedAt: observedAt, gpsArrivalCandidateAt: null },
      });
    if (!updated.count) return false;
    await tx.truck.update({
      where: { id: truck.id },
      data: { currentLocation: (headingToPickup ? trip.fromText : trip.toText) || truck.currentLocation, locationUpdatedAt: observedAt },
    });
    return true;
  });
  return { arrived: result, tripChanged: result, tripId: trip.id, distance: Math.round(distance), phase: headingToPickup ? "AT_PICKUP" : "AT_DESTINATION" };
}

async function syncTruckStatusWithoutActiveTrip(truck, event, observedAt) {
  if (!truck || !validCoordinates(event.latitude, event.longitude)) return null;
  if (["MAINTENANCE", "INACTIVE"].includes(truck.status)) return null;

  const activeTrip = await prisma.trip.findFirst({
    where: { truckId: truck.id, status: { in: ["DISPATCHED", "ARRIVED"] } },
    select: { id: true },
  });
  if (activeTrip) return null;

  const locations = await prisma.operationalLocation.findMany({
    where: { isActive: true },
    select: { id: true, name: true, type: true, latitude: true, longitude: true, radiusM: true },
  });
  let matchedLocation = null;
  let matchedDistance = Infinity;
  for (const location of locations) {
    const distance = distanceMeters(event.latitude, event.longitude, location.latitude, location.longitude);
    const warningPriority = location.type === "WARNING" && matchedLocation?.type !== "WARNING";
    const samePriority = !matchedLocation || (location.type === "WARNING") === (matchedLocation.type === "WARNING");
    if (distance <= location.radiusM && (warningPriority || (samePriority && distance < matchedDistance))) {
      matchedLocation = location;
      matchedDistance = distance;
    }
  }

  const movingSpeedKph = Math.max(1, Number(process.env.GPS_MOVING_SPEED_KPH || 5));
  const isMoving = event.speed !== null && event.speed > movingSpeedKph;
  // Operational availability is driven by trip assignment. A vehicle without
  // an active trip remains READY even when its GPS happens to be moving.
  const nextStatus = "READY";

  await prisma.truck.update({
    where: { id: truck.id },
    data: {
      status: nextStatus,
      currentLocation: matchedLocation?.name || (isMoving ? "Dalam perjalanan" : "Di luar master lokasi"),
      locationUpdatedAt: observedAt,
    },
  });
  return {
    status: nextStatus,
    reason: matchedLocation ? matchedLocation.type : (isMoving ? "MOVING_WITHOUT_TRIP" : "STOPPED_OUTSIDE_MASTER_LOCATION"),
    locationId: matchedLocation?.id || null,
    distanceM: matchedLocation ? Math.round(matchedDistance) : null,
  };
}

router.get("/events", (_req, res) => {
  res.json({ ok: true, service: "golacak-webhook", configured: Boolean(process.env.GOLACAK_WEBHOOK_TOKEN) });
});

router.post("/events", async (req, res) => {
  if (!authorized(req)) return res.status(401).json({ ok: false, error: "Invalid token" });
  const payloads = Array.isArray(req.body)
    ? req.body
    : Array.isArray(req.body?.data)
      ? req.body.data
      : [req.body];
  if (!payloads.length || payloads.length > 500 || payloads.some((item) => !item || typeof item !== "object" || Array.isArray(item))) {
    return res.status(400).json({ ok: false, error: "Body must be an object or an array of up to 500 objects" });
  }

  const results = [];
  for (const raw of payloads) {
    const event = normalize(raw);
    if (!event.deviceId && !event.imei) {
      results.push({ accepted: false, error: "deviceId or imei is required" });
      continue;
    }
    if ((event.latitude !== null || event.longitude !== null) && !validCoordinates(event.latitude, event.longitude)) {
      results.push({ accepted: false, error: "Invalid coordinates" });
      continue;
    }
    const truck = await findTruck(event);
    try {
      await prisma.gpsEvent.create({
        data: {
          fingerprint: fingerprint(raw, event), eventType: event.eventType,
          deviceId: event.deviceId, imei: event.imei, latitude: event.latitude,
          longitude: event.longitude, speed: event.speed, eventAt: event.eventAt,
          raw, truckId: truck?.id || null,
        },
      });
    } catch (error) {
      if (error.code === "P2002") {
        results.push({ accepted: true, duplicate: true });
        continue;
      }
      throw error;
    }
    if (truck && validCoordinates(event.latitude, event.longitude)) {
      const observedAt = event.eventAt || new Date();
      const isOutOfOrder = truck.lastGpsAt && observedAt.getTime() <= truck.lastGpsAt.getTime();
      if (isOutOfOrder) {
        results.push({ accepted: true, mapped: true, ignoredOutOfOrder: true });
        continue;
      }
      const stopRadiusM = configuredNumber(process.env.GPS_STOP_AREA_RADIUS_METERS, 100, 25);
      const movementRadiusM = configuredNumber(process.env.GPS_STOP_MOVEMENT_RADIUS_METERS, 150, stopRadiusM + 1);
      const stopState = calculateStopState({
        truck, event, observedAt, stopRadiusM, movementRadiusM,
      });
      await prisma.truck.update({
        where: { id: truck.id },
        data: {
          lastGpsLatitude: event.latitude, lastGpsLongitude: event.longitude,
          lastGpsSpeed: event.speed, lastGpsAt: observedAt,
          lastGpsIgnition: event.ignition,
          gpsStoppedSince: stopState.gpsStoppedSince,
          gpsStopAnchorLatitude: stopState.anchorLatitude,
          gpsStopAnchorLongitude: stopState.anchorLongitude,
        },
      });
      await syncTruckStatusWithoutActiveTrip(truck, event, observedAt);
    }
    results.push({ accepted: true, mapped: Boolean(truck), ...(await evaluateArrival(truck, event)) });
  }
  if (results.some((result) => result.mapped)) {
    publishUpdate({ method: "PATCH", resource: "trucks" });
  }
  if (results.some((result) => result.tripChanged || result.arrived)) {
    publishUpdate({ method: "PATCH", resource: "trips" });
  }
  res.status(202).json({ ok: true, processed: results.length, results });
});

router.put("/devices/:truckId", authRequired, requireRole("OWNER", "ADMIN"), async (req, res) => {
  try {
    const gpsDeviceId = clean(req.body?.deviceId);
    const gpsImei = clean(req.body?.imei);
    if (!gpsDeviceId && !gpsImei) return res.status(400).json({ error: "deviceId or imei is required" });
    const truck = await prisma.truck.update({
      where: { id: req.params.truckId }, data: { gpsDeviceId, gpsImei },
    });
    res.json({ ok: true, truck });
  } catch (error) {
    res.status(error.code === "P2025" ? 404 : error.code === "P2002" ? 409 : 400).json({ error: error.message || "Failed to map GPS device" });
  }
});

router.put("/trips/:tripId/destination", authRequired, requireRole("OWNER", "ADMIN"), async (req, res) => {
  try {
    const destinationLat = number(req.body?.latitude);
    const destinationLng = number(req.body?.longitude);
    const arrivalRadiusM = Math.round(number(req.body?.radiusM) || 400);
    if (!validCoordinates(destinationLat, destinationLng)) return res.status(400).json({ error: "Valid latitude and longitude are required" });
    if (arrivalRadiusM < 50 || arrivalRadiusM > 5000) return res.status(400).json({ error: "radiusM must be between 50 and 5000" });
    const trip = await prisma.trip.update({
      where: { id: req.params.tripId }, data: { destinationLat, destinationLng, arrivalRadiusM, gpsArrivalCandidateAt: null },
    });
    res.json({ ok: true, trip });
  } catch (error) {
    res.status(error.code === "P2025" ? 404 : 400).json({ error: error.message || "Failed to set trip destination" });
  }
});

router._test = { activePlateNumber, calculateStopState, date, distanceMeters, normalize, normalizedPlate, validCoordinates };
module.exports = router;
