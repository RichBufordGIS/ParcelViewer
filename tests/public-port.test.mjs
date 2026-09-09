import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseParcelBatch, getParcelBatchParseDetails, normalizeBatchParcelInput } from '../js/utils.js';
import { initParcelSelection } from '../js/parcelSelection.js';
import { initSidebarUI } from '../js/sidebarUI.js';

const a = '29-220-16-06-00-0-00-000';
const b = '44-320-17-05-00-0-00-000';
test('Excel cells, blank rows, delimiters and duplicates preserve input order', () => {
    assert.deepEqual(parseParcelBatch(`${a}\t${b}\r\n\t\r${a};${b},`), [a,b]);
    assert.deepEqual(getParcelBatchParseDetails(`${a},${a}`), { parcels:[a], suppliedCount:2, duplicateCount:1 });
    assert.equal(normalizeBatchParcelInput([a,b]).ok,true);
    assert.equal(normalizeBatchParcelInput(Array.from({length:21},(_,i)=>String(i).padStart(17,'0'))).ok,false);
    assert.equal(normalizeBatchParcelInput([a,'29220160600000000']).ok,false);
    assert.deepEqual(parseParcelBatch(''),[]);
    assert.deepEqual(parseParcelBatch('123 MAIN ST'),['123 MAIN ST']);
});

test('Owner lookup batches cache misses, selects newest year and omits unavailable fields', async () => {
    const queries = [];
    const table = {
        fields: ['PARID','TAXYR','OWNER_NAMES','TAXDIST'].map(name=>({name})),
        load: async()=>{}, createQuery:()=>({}),
        queryFeatures: async q => {
            queries.push(q);
            return { features: [
                {attributes:{PARID:a.replaceAll('-',''),TAXYR:2024,OWNER_NAMES:'OLD'}},
                {attributes:{PARID:a.replaceAll('-',''),TAXYR:2026,OWNER_NAMES:'NEW,',TAXDIST:'001'}},
                {attributes:{PARID:b.replaceAll('-',''),TAXYR:2025,OWNER_NAMES:'SECOND',TAXDIST:'002'}}
            ]};
        }
    };
    const selection = initParcelSelection({getTylerExtractTable:()=>table});
    const rows = await selection.getTylerDataByParcels([a,b,a]);
    assert.equal(queries.length,1);
    assert.match(queries[0].where,/PARID IN \(/);
    assert.equal(queries[0].returnGeometry,false);
    assert.deepEqual(queries[0].outFields,['PARID','TAXYR','OWNER_NAMES','TAXDIST']);
    assert.equal(rows.get(a.replaceAll('-','')).ownerName,'NEW');
    assert.equal(rows.get(b.replaceAll('-','')).taxDistrict,'002');
    await selection.getTylerDataByParcels([a,b]);
    assert.equal(queries.length,1);
});

test('Missing owner service returns a usable fallback',async()=>{
    const selection = initParcelSelection({getTylerExtractTable:()=>null});
    const rows = await selection.getTylerDataByParcels([a]);
    assert.equal(rows.get(a.replaceAll('-','')).ownerName,'Could not be found');
});

test('Sidebar transitions resize the visible view and both active inset views',()=>{
    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;
    let inset = false;
    let counts = [0,0];
    const element = () => ({classList:{toggle(){}},setAttribute(){},addEventListener(name,fn){this[name]=fn;}});
    const left = element(), right = element();
    globalThis.document = {body:{classList:{contains:()=>inset}},getElementById:id=>({classList:{contains:()=>id==='map2d'}})};
    globalThis.window = {addEventListener(){}};
    try {
        initSidebarUI({getMapView:()=>({resize:()=>counts[0]++}),getSceneView:()=>({resize:()=>counts[1]++}),
            leftSidebarShell:left,leftSidebarToggle:element(),leftSidebarToggleIcon:element(),
            rightSidebarShell:right,rightSidebarToggle:element(),rightSidebarToggleIcon:element()});
        left.transitionend({target:left});
        assert.deepEqual(counts,[1,0]);
        inset = true;
        right.transitionend({target:right});
        assert.deepEqual(counts,[2,1]);
    } finally { globalThis.document=originalDocument; globalThis.window=originalWindow; }
});

test('All JavaScript parses and local imports resolve',()=>{
    for(const file of readdirSync('js').filter(p=>p.endsWith('.js'))) {
        const full=resolve('js',file);
        const result=spawnSync(process.execPath,['--check',full],{encoding:'utf8'});
        assert.equal(result.status,0,`${file}: ${result.stderr}`);
        for(const match of readFileSync(full,'utf8').matchAll(/(?:from\s*|import\s*)["'](\.\.?\/[^"']+)["']/g)) {
            assert.ok(existsSync(resolve(dirname(full),match[1])),`${file}: ${match[1]}`);
        }
    }
});

test('Both public entry points retain public maps and load shared improvements',()=>{
    for(const file of ['index.html','indexinset.html']) {
        const html=readFileSync(file,'utf8');
        assert.match(html,/0561cabf74ff48a4af41d3130fd103d9/);
        assert.match(html,/9b73428381b349a4b62110e5cbb9b9a8/);
        assert.match(html,/css\/search.css/);
        assert.match(html,/js\/main.js/);
        // The legacy hidden Property Information panel has its own left-sidebar.
        const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]).filter(id=>id!=='left-sidebar');
        assert.equal(new Set(ids).size,ids.length,`${file} duplicate IDs`);
        for(const [i,script] of [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].entries()) {
            if(!script[2].trim()) continue;
            const result=spawnSync(process.execPath,['--check','--input-type=module'],{input:script[2],encoding:'utf8'});
            assert.equal(result.status,0,`${file} inline script ${i}: ${result.stderr}`);
        }
    }
    assert.match(readFileSync('indexinset.html','utf8'),/<body class="inset-mode">/);
    assert.match(readFileSync('js/main.js','utf8'),/allowAnonymous: true, required: false/);
});
