// Real MaterialStock forms + production CSS, fixture API only. No app data writes.
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('node:assert/strict');
const frontend = path.resolve(__dirname, '..');
const esbuild = require(path.join(frontend, 'node_modules/esbuild'));
const puppeteer = require(path.join(frontend, '../backend/node_modules/puppeteer'));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'erp-material-tablet-'));
const customers = [{ id: 'customer', name: 'Customer contoh' }];
const overview = { customers, locations: [], storageLocations: [{ id: 'warehouse', name: 'Gudang' }], destinations: [{ id: 'destination', name: 'Tujuan bongkar' }], receipts: [], trips: [{ id: 'trip', tripNo: 'TRIP-TEST', truck: { plateNumber: 'BK TEST' } }] };
const groups = Array.from({ length: 12 }, (_, i) => ({ key: `item-${i}`, itemName: `Material contoh ${i+1}`, unit: 'PCS', locationId: 'warehouse', location: { name: 'Gudang' }, qtyRemaining: 10 }));
(async () => {
  await esbuild.build({ stdin: {
    contents: `import React from '${frontend}/node_modules/react/index.js';import{createRoot}from '${frontend}/node_modules/react-dom/client.js';import MaterialStock from '${frontend}/src/pages/MaterialStock.jsx';import usePopupEnvironment from '${frontend}/src/ui/usePopupEnvironment.js';function App(){usePopupEnvironment();return <div className="erp-content"><MaterialStock/></div>}createRoot(document.getElementById('root')).render(<App/>);`,
    loader: 'jsx', resolveDir: frontend,
  }, bundle: true, outfile: path.join(temp, 'fixture.js'), jsx: 'automatic', plugins: [{ name: 'fixture-api', setup(build) {
    build.onResolve({ filter: /^\.\.\/api$/ }, () => ({ path: 'fixture', namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `export const API_BASE='';export const getAccessToken=()=>null;export const apiAssetUrl=x=>x;export const uploadFiles=async()=>{throw Error('Fixture uploads disabled')};export const api=async(path,options)=>{if(options?.method)throw Error('Fixture writes disabled');if(path==='/customers')return {items:${JSON.stringify(customers)}};if(path.includes('/available/'))return {groups:${JSON.stringify(groups)}};return ${JSON.stringify(overview)}};` }));
  } }] });
  const assets = path.join(frontend, 'dist/assets');
  const css = fs.readFileSync(path.join(assets, fs.readdirSync(assets).find(name => name.endsWith('.css'))), 'utf8');
  const browser = await puppeteer.launch({ headless: true });
  try {
    for (const [name,width,height] of [['ipad-landscape',1138,690],['ipad-portrait',820,1000],['redmi-landscape',1280,720],['redmi-portrait',800,1100]]) {
      for (const kind of ['entry','allocation']) {
        const page = await browser.newPage();
        await page.setViewport({ width,height,isMobile:true,hasTouch:true });
        await page.setContent('<!doctype html><html class="erp-app"><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body><div id="root"></div></body></html>');
        await page.addStyleTag({ content: css });
        await page.addScriptTag({ content: fs.readFileSync(path.join(temp,'fixture.js'),'utf8') });
        await page.waitForSelector('.material-head-actions');
        await page.click(kind === 'entry' ? '.material-head-actions button:last-child' : '.material-head-actions button:first-child');
        const modal = kind === 'entry' ? '.material-entry-modal' : '.material-allocation-modal';
        await page.waitForSelector(modal);
        if (kind === 'entry') {
          for (let i=0;i<5;i++) await page.click('.material-add-line');
        } else {
          await page.select('.material-allocation-section select','customer');
          await page.waitForFunction(() => document.querySelectorAll('.material-allocation-picker input[type=checkbox]').length > 0);
        }
        const measure = () => page.$eval(modal, panel => {
          const body=panel.querySelector('.material-form-body'), head=panel.querySelector('.material-modal-head'), foot=panel.querySelector('footer');
          const p=panel.getBoundingClientRect(), b=body.getBoundingClientRect(), h=head.getBoundingClientRect(), f=foot.getBoundingClientRect();
          return { bodyHeight:body.clientHeight,bodyScrollHeight:body.scrollHeight,bodyTop:b.top,bodyBottom:b.bottom,bodyRight:b.right,headerBottom:h.bottom,footerTop:f.top,footerBottom:f.bottom,panelBottom:p.bottom,horizontalOverflow:body.scrollWidth>body.clientWidth+1 };
        });
        let geometry=await measure();
        assert.ok(geometry.bodyHeight>60,JSON.stringify({name,kind,geometry}));
        assert.ok(geometry.bodyTop>=geometry.headerBottom-1 && geometry.bodyBottom<=geometry.footerTop+1 && geometry.footerBottom<=geometry.panelBottom+1,JSON.stringify({name,kind,geometry}));
        assert.equal(geometry.horizontalOverflow,false);
        await page.$eval(`${modal} .material-form-body`,body=>body.scrollTop=0);
        const client=await page.createCDPSession();
        await client.send('Input.synthesizeScrollGesture',{x:Math.floor(geometry.bodyRight-8),y:Math.round((geometry.bodyTop+geometry.bodyBottom)/2),yDistance:-300,speed:600,gestureSourceType:'touch'});
        const touchScroll=await page.$eval(`${modal} .material-form-body`,body=>body.scrollTop);
        if(geometry.bodyScrollHeight>geometry.bodyHeight+1) assert.ok(touchScroll>0,`touch scrolling failed: ${name}/${kind}`);
        await page.$eval(`${modal} .material-form-body`,body=>body.scrollTop=body.scrollHeight);
        const notes=`${modal} textarea`;
        await page.focus(notes);await page.type(notes,'Catatan tablet');
        await page.setViewport({width,height:360,isMobile:true,hasTouch:true});
        await new Promise(resolve=>setTimeout(resolve,450));
        geometry=await measure();
        const field=await page.$eval(notes,el=>({value:el.value,top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom}));
        assert.equal(field.value,'Catatan tablet');
        assert.ok(field.top>=geometry.bodyTop-1 && field.bottom<=geometry.bodyBottom+1,JSON.stringify({name,kind,geometry,field}));
        assert.ok(geometry.bodyBottom<=geometry.footerTop+1);
        console.log(`${name}/${kind}: touch scroll, footer separation, keyboard focus OK`);
        await page.screenshot({path:path.join(temp,`${name}-${kind}.png`)});
        await page.close();
      }
    }
    console.log(`Screenshots: ${temp}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error);process.exitCode=1; });
