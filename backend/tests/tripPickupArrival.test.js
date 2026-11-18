const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { prisma } = require('../src/prisma');
const route = require('../src/routes/trips').stack.find(layer => layer.route?.path === '/:id/arrive-pickup').route.stack.at(-1).handle;
let status, conflict, updated, truckUpdates;
prisma.$transaction = async run => run({
  trip: {
    findUnique: async () => ({ id:'trip', purpose:'DELIVERY', status:'PLANNED', phase:'PLANNED', truckId:'truck', driverUserId:'driver', truck:{status,plateNumber:'BK 8151 ET'}, driverUser:{status:'ACTIVE',name:'Kas mari'} }),
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
test('driver conflict on another truck and owner-only permission remain enforced',async()=>{
  status='DISPATCH';conflict=true;updated=null;
  assert.equal((await arrive()).code,400);assert.equal(updated,null);
  assert.equal((await arrive('STAFF')).code,403);
});
after(()=>prisma.$disconnect());
