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

function date(value) {
  if (!value) return null;
  const result = new Date(value);
  return Number.isNaN(result.getTime()) ? null : result;
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
    where: { truckId: truck.id, status: "DISPATCHED", destinationLat: { not: null }, destinationLng: { not: null } },
    orderBy: { dispatchedAt: "desc" },
  });
  if (!trip) return { arrived: false };

  const distance = distanceMeters(event.latitude, event.longitude, trip.destinationLat, trip.destinationLng);
  const inside = distance <= trip.arrivalRadiusM;
  const maxSpeed = Number(process.env.GOLACAK_ARRIVAL_MAX_SPEED_KPH || 10);
  const slowEnough = event.speed === null || event.speed <= maxSpeed;
  if (!inside || !slowEnough) {
    if (trip.gpsArrivalCandidateAt) {
      await prisma.trip.update({ where: { id: trip.id }, data: { gpsArrivalCandidateAt: null } });
    }
    return { arrived: false, tripId: trip.id, distance: Math.round(distance) };
  }

  const observedAt = event.eventAt || new Date();
  if (!trip.gpsArrivalCandidateAt) {
    await prisma.trip.update({ where: { id: trip.id }, data: { gpsArrivalCandidateAt: observedAt } });
    return { arrived: false, candidate: true, tripId: trip.id, distance: Math.round(distance) };
  }
  const dwellMinutes = Math.max(0, Number(process.env.GOLACAK_ARRIVAL_DWELL_MINUTES || 5));
  if (observedAt.getTime() - trip.gpsArrivalCandidateAt.getTime() < dwellMinutes * 60000) {
    return { arrived: false, candidate: true, tripId: trip.id, distance: Math.round(distance) };
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.trip.updateMany({
      where: { id: trip.id, status: "DISPATCHED" },
      data: { status: "ARRIVED", arrivedAt: observedAt },
    });
    if (!updated.count) return false;
    await tx.truck.update({
      where: { id: truck.id },
      data: { currentLocation: trip.toText || truck.currentLocation, locationUpdatedAt: observedAt },
    });
    return true;
  });
  return { arrived: result, tripId: trip.id, distance: Math.round(distance) };
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
      await prisma.truck.update({
        where: { id: truck.id },
        data: {
          lastGpsLatitude: event.latitude, lastGpsLongitude: event.longitude,
          lastGpsSpeed: event.speed, lastGpsAt: event.eventAt || new Date(),
        },
      });
    }
    results.push({ accepted: true, mapped: Boolean(truck), ...(await evaluateArrival(truck, event)) });
  }
  if (results.some((result) => result.mapped)) {
    publishUpdate({ method: "PATCH", resource: "trucks" });
  }
  if (results.some((result) => result.arrived)) {
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

router._test = { activePlateNumber, distanceMeters, normalize, normalizedPlate, validCoordinates };
module.exports = router;
