import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const b=await chromium.launch({headless:true, args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const c=await b.newContext({viewport:{width:390,height:844},locale:'en-GB'});
const p=await c.newPage();
const errors=[]; p.on('pageerror',e=>errors.push(e.message)); p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
for (const [path,name] of [['/','landing'],['/login','login'],['/register','register']]) {
  await p.goto('http://127.0.0.1:3000'+path);
  await p.waitForLoadState('networkidle');
  await p.waitForTimeout(2200);
  const d=await p.evaluate(()=>({c:document.documentElement.scrollWidth,v:window.innerWidth}));
  assert.ok(d.c<=d.v+1, `${path}: ${JSON.stringify(d)}`);
  await p.screenshot({path:`/tmp/m-${name}.png`});
}
assert.deepEqual(errors,[]);
console.log('PASS: landing/login/register fit 390px');
await b.close();
