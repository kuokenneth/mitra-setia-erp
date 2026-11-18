const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { prisma } = require('../src/prisma');
let stored, loads;
prisma.$transaction = async run => run({
  order: { findUnique: async () => ({id:'order',status:'COMPLETED',unit:'KG',qty:49000,customer:{cargoLossTolerancePercent:0},invoices:[],tripAllocations:loads}) },
  invoice: { findFirst: async()=>null, create: async({data})=>{stored={id:'invoice',status:'DRAFT',payments:[],...data};return {id:'invoice'};} },
});
prisma.invoice.findUnique = async()=>stored;
const route = require('../src/routes/receivables').stack.find(layer=>layer.route?.path==='/invoices').route.stack.at(-1).handle;
function load(id, planned, actual) {return {qtyPlanned:planned,qtyActual:actual,unitSnap:'KG',trip:{id,plateNumberSnap:id}};}
async function create(tolerance=0) {
  const result={};
  await route({user:{id:'owner'},body:{contractSubtotal:0,orderId:'order',customerName:'Customer',issuedAt:'2026-11-18',dueAt:'2026-12-18',tolerancePercent:tolerance,orderTripIds:loads.map(l=>l.trip.id)}},{status(code){result.code=code;return this},json(body){result.body=body}});
  assert.equal(result.code,201,JSON.stringify(result.body));
}
test('actual 19060 is stored separately while billing is capped at planned 19000',async()=>{
  loads=[load('8579',19000,19060)];await create();
  assert.equal(stored.plannedQuantity,19000);assert.equal(stored.deliveredQuantity,19060);assert.equal(stored.billableQuantity,19000);
  assert.equal(stored.manualData.orderLoads[0].quantityKg,19000);
});
test('overweight on one truck does not offset loss on another',async()=>{
  loads=[load('8579',19000,19060),load('8574',30000,29950)];await create();
  assert.equal(stored.billableQuantity,48950);assert.equal(stored.cargoLossQuantity,50);
  await create(1);assert.equal(stored.billableQuantity,49000);assert.equal(stored.cargoLossQuantity,0);
});
after(()=>prisma.$disconnect());
