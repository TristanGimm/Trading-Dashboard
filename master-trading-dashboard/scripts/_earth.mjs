import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:3000';
const b=await chromium.launch({headless:true});
const c=await b.newContext({viewport:{width:1600,height:1000},locale:'en-GB',reducedMotion:'reduce'});
const p=await c.newPage();
const errors=[]; p.on('pageerror',e=>errors.push(e.message)); p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await p.goto(base+'/login');
await p.getByText('Highly individualised Trading Dashboard').waitFor();
await p.waitForTimeout(1400);
assert.equal(await p.locator('.earth-hero').count(),1);
assert.equal(await p.locator('.earth-hero svg .earth-lines path').count(),2);
assert.ok((await p.locator('.earth-hero .earth-stars circle').count())>100);
await p.screenshot({path:'/tmp/e-login.png'});

// brand mark matches the favicon file
const markPaths = await p.locator('.auth-v3-header svg path').evaluateAll(els=>els.map(e=>e.getAttribute('d')));
assert.deepEqual(markPaths, ['M17 45V34M29 45V25M41 45V17','m16 24 12-10']);

const creds=readFileSync('.account-credentials.txt','utf8').split('\n[').at(-1);
await p.getByLabel('Username or email').fill(/Username: (.+)/.exec(creds)[1].trim());
await p.getByLabel('Password').fill(/Password: (.+)/.exec(creds)[1].trim());
await p.getByRole('button',{name:'Sign in'}).click();
await p.waitForURL(/\/dashboard/);
await p.getByRole('heading',{name:'Trading Dashboard'}).waitFor();
await p.waitForTimeout(1200);
assert.equal(await p.locator('.earth-ambient').count(),1);
const sidebarMark = await p.locator('.app-sidebar svg path').evaluateAll(els=>els.slice(0,2).map(e=>e.getAttribute('d')));
assert.deepEqual(sidebarMark, ['M17 45V34M29 45V25M41 45V17','m16 24 12-10']);
await p.screenshot({path:'/tmp/e-dashboard.png'});
console.log('PASS: earth hero + ambient, brand mark identical to favicon');
await p.goto(base+'/journal?account=all&period=all'); await p.waitForTimeout(900);
await p.screenshot({path:'/tmp/e-journal.png'});
assert.deepEqual(errors,[]);
console.log('OK');
await b.close();
