const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { prisma } = require('../src/prisma');
const route = require('../src/routes/trips').stack.find(layer => layer.route?.path === '/:id/arrive-pickup').route.stack.at(-1).handle;
const startDelivery = require('../src/routes/trips').stack.find(layer => layer.route?.path === '/:id/start-delivery').route.stack.at(-1).handle;
let status, conflict, updated, truckUpdates, purpose = 'DELIVERY';
prisma.$transaction = async run => run({
  trip: {
    findUnique: async () => ({ id:'trip', purpose, status:'PLANNED', phase:'PLANNED', truckId:'truck', driverUserId:'driver', truck:{status,plateNumber:'BK 8151 ET'}, driverUser:{status:'ACTIVE',name:'Kas mari'} }),
    findFirst: async ({where}) => { assert.deepEqual(where.truckId, {not:'truck'}); return conflict ? {id:'other'} : null; },
    update: async ({data}) => { updated=data; return {id:'trip',...data}; },
  },
  truck: { findUnique: async () => ({id:'truck',status}), update: async () => { truckUpdates++; } },
});
async function arrive(role='OWNER') {
  const response={code:200};
  await route({user:{role},params:{id:'trip'},body:{}},{status(code){response.code=code;return this;},json(body){response.body=body;return this;}});
  return response;
}
test('owner can record loading arrival for non-READY trucks without overwriting maintenance status',async()=>{
  for(status of ['READY','DISPATCH','WAITING_BACKHAUL','MAINTENANCE','INACTIVE']) {
    conflict=false; updated=null;truckUpdates=0;
    const result=await arrive();
    assert.equal(result.code,200,status);assert.equal(updated.phase,'AT_PICKUP');assert.equal(updated.status,'DISPATCHED');
    if(['MAINTENANCE','INACTIVE'].includes(status))assert.equal(truckUpdates,0);
  }
});
test('driver conflict on another truck and loading-arrival permissions remain enforced',async()=>{
  status='DISPATCH';conflict=true;updated=null;
  assert.equal((await arrive()).code,400);assert.equal(updated,null);
  assert.equal((await arrive('STAFF')).code,400);
  conflict=false;
  assert.equal((await arrive('STAFF')).code,200);
  for (const role of ['ADMIN','DRIVER','UNKNOWN']) {
    updated=null;
    assert.equal((await arrive(role)).code,403);
    assert.equal(updated,null);
  }
});
test('single trips support manual pickup arrival', async () => {
  purpose = 'SINGLE_TRIP';
  status = 'READY';
  conflict = false;
  assert.equal((await arrive()).code, 200);
  assert.equal(updated.phase, 'AT_PICKUP');
});

test('owner can start a single material trip from TO_PICKUP without order allocations', async (t) => {
  const trip = { id: 'trip', purpose: 'SINGLE_TRIP', cargoCategorySnap: 'MATERIAL',
    status: 'DISPATCHED', phase: 'TO_PICKUP', order: null, orderAllocations: [] };
  const originalDelegate = prisma.trip;
  const update = t.mock.fn(async ({ data }) => ({ ...trip, ...data }));
  prisma.trip = { findUnique: async () => trip, update };
  t.after(() => { prisma.trip = originalDelegate; });
  async function start(role, ownerOverride) {
    const response = { code: 200 };
    await startDelivery({ user: { role }, params: { id: 'trip' }, body: { ownerOverride } }, {
      status(code) { response.code = code; return this; },
      json(body) { response.body = body; return this; },
    });
    return response;
  }

  assert.equal((await start('OWNER', false)).code, 400);
  assert.equal((await start('STAFF', true)).code, 400);
  assert.equal(update.mock.callCount(), 0);
  const result = await start('OWNER', true);
  assert.equal(result.code, 200);
  assert.equal(result.body.phase, 'TO_DESTINATION');
  assert.ok(result.body.loadedAt);

  trip.cargoCategorySnap = 'FERTILIZER';
  assert.equal((await start('OWNER', true)).code, 400);
  trip.plannedWeightKg = 500;
  assert.equal((await start('OWNER', true)).code, 200);
});
after(()=>prisma.$disconnect());
