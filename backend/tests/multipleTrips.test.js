const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../src/routes/trips'), 'utf8');
const start = source.indexOf('async function updateTruckOperationalState');
const end = source.indexOf('async function safeUpdateTruckStatus', start);
const update = vm.runInNewContext(`(${source.slice(start,end).trim()})`, {str:value=>value, sameLocation:(a,b)=>a===b});
test('finishing or cancelling one trip keeps a truck busy while another trip runs', async()=>{
  for(const status of ['COMPLETED','CANCELLED']) {
    let data;
    const tx={truck:{findUnique:async()=>({id:'truck',status:'DISPATCH',baseLocation:'Medan',currentLocation:'Medan'}),update:async args=>{data=args.data;}},trip:{findFirst:async({where})=>{assert.equal(where.id.not,'finished');return {purpose:'DELIVERY'};}}};
    await update(tx,{id:'finished',truckId:'truck'},status,new Date());
    assert.equal(data.status,'DISPATCH');assert.equal(data.availableForBackhaul,false);assert.equal(data.idleSince,null);
    tx.trip.findFirst=async()=>null;
    await update(tx,{id:'finished',truckId:'truck'},status,new Date());
    assert.equal(data.status,'READY');
  }
});
test('a GPS update evaluates every active trip on the truck',async()=>{
  const gps=fs.readFileSync(require.resolve('../src/routes/golacak'),'utf8');
  const start=gps.indexOf('async function evaluateArrival('), end=gps.indexOf('async function evaluateTripArrival(',start);
  const visited=[];
  const evaluate=vm.runInNewContext(`(${gps.slice(start,end).trim()})`,{validCoordinates:()=>true,prisma:{trip:{findMany:async()=>[{id:'one'},{id:'two'}]}},evaluateTripArrival:async(truck,event,id)=>{visited.push(id);return {tripId:id,tripChanged:id==='two',arrived:id==='two'};}});
  const result=await evaluate({id:'truck'},{latitude:1,longitude:2});
  assert.deepEqual(visited,['one','two']);assert.equal(result.tripChanged,true);assert.equal(result.arrived,true);assert.equal(result.trips.length,2);
});
