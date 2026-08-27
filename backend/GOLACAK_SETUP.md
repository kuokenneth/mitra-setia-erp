# GOlacak integration

## Public webhook

`POST https://mitra-setia-erp.onrender.com/integrations/golacak/events`

Required headers:

```text
Content-Type: application/json
Token: <shared secret configured as GOLACAK_WEBHOOK_TOKEN>
```

The endpoint accepts one JSON event or an array of up to 500 events. It stores
the original payload and recognizes common variants of device ID, IMEI,
coordinates, speed, event type, and timestamp fields. Duplicate payloads are
accepted without being stored twice.

## Required environment variables

```env
GOLACAK_WEBHOOK_TOKEN=<strong random shared secret>
GOLACAK_ARRIVAL_DWELL_MINUTES=5
GOLACAK_ARRIVAL_MAX_SPEED_KPH=10
```

Set the same shared secret with the GOlacak PIC and in Render. Never commit it
to Git or place it in frontend code.

## Admin configuration

Map a GOlacak device to a truck:

```http
PUT /integrations/golacak/devices/:truckId
Authorization: Bearer <owner-or-admin-token>
Content-Type: application/json

{"deviceId":"GPS-123","imei":"860000000000001"}
```

Set the destination coordinates for a trip:

```http
PUT /integrations/golacak/trips/:tripId/destination
Authorization: Bearer <owner-or-admin-token>
Content-Type: application/json

{"latitude":3.5952,"longitude":98.6722,"radiusM":400}
```

When a mapped truck on a `DISPATCHED` trip remains within the configured radius
at or below the maximum speed for the dwell time, the trip is changed to
`ARRIVED`. `COMPLETED` remains a manual operational confirmation.

## Deployment order

1. Deploy the database migration with `npx prisma migrate deploy`.
2. Set the environment variables in Render.
3. Deploy/restart the backend.
4. Confirm `GET /integrations/golacak/events` returns `configured: true`.
5. Coordinate a test payload with GOlacak.
