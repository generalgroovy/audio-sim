import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const html = await readFile(new URL('../index.html',import.meta.url));
const server = createServer((request,response) => {
  if (request.url === '/favicon.ico') { response.writeHead(204); response.end(); return; }
  response.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});response.end(html);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({args:['--mute-audio']});
const results=[];
await mkdir('test-results',{recursive:true});
try {
  for (const width of [1366,390,320]) {
    const context=await browser.newContext({viewport:{width,height:width>600?768:844},hasTouch:width<600});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.getByRole('button',{name:/Speaker 1, X/}).waitFor();
    assert.equal(await page.evaluate(()=>audioEnabled),false);
    assert.equal(await page.evaluate(()=>masterGain.gain.value),0);
    await page.screenshot({path:`test-results/${width}-initial.png`});
    const speaker=page.getByRole('button',{name:/Speaker 1, X/});
    const rect=await speaker.boundingBox(),map=await page.locator('#roomMap').boundingBox();
    await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);
    await page.mouse.down();
    await page.mouse.move(rect.x+rect.width/2+map.width/10,rect.y+rect.height/2,{steps:6});
    await page.mouse.up();
    assert.equal(await page.evaluate(()=>selectedSpeaker.mesh.position.x),2.4);
    await page.getByRole('button',{name:'Undo',exact:true}).click();
    assert.equal(await page.evaluate(()=>selectedSpeaker.mesh.position.x),1);
    await speaker.click();
    await speaker.press('Shift+ArrowLeft');
    assert.equal(await page.evaluate(()=>selectedSpeaker.mesh.position.x),0.9);
    await page.getByRole('button',{name:'Start audio',exact:true}).click();
    assert.equal(await page.evaluate(()=>audioEnabled),true);
    await page.getByText('Arrange & compare',{exact:true}).click();
    await page.getByRole('button',{name:'Copy A to B',exact:true}).click();
    await page.getByRole('button',{name:'B',exact:true}).click();
    assert.equal(await page.evaluate(()=>audioEnabled),false);
    assert.equal(await page.evaluate(()=>masterGain.gain.value),0);
    await page.getByLabel('Frequency',{exact:true}).press('End');
    await page.getByLabel('Frequency',{exact:true}).press('Tab');
    assert.equal(await page.evaluate(()=>selectedSpeaker.osc.frequency.value),2000);
    await page.getByRole('button',{name:'A',exact:true}).click();
    assert.equal(await page.evaluate(()=>selectedSpeaker.osc.frequency.value),440);
    await page.getByRole('button',{name:'B',exact:true}).click();
    assert.equal(await page.evaluate(()=>selectedSpeaker.osc.frequency.value),2000);
    await page.getByRole('button',{name:'Save',exact:true}).click();
    await page.getByRole('button',{name:'Remove',exact:true}).click();
    assert.equal(await page.evaluate(()=>speakers.length),0);
    await page.getByRole('button',{name:'Undo',exact:true}).click();
    assert.equal(await page.evaluate(()=>speakers.length),1);
    assert.equal(await page.evaluate(()=>selectedSpeaker.osc.frequency.value),2000);
    await page.reload();
    await page.getByText('Arrange & compare',{exact:true}).click();
    await page.getByRole('button',{name:'Restore',exact:true}).click();
    assert.equal(await page.evaluate(()=>activeArrangement),'B');
    assert.equal(await page.evaluate(()=>selectedSpeaker.osc.frequency.value),2000);
    assert.equal(await page.evaluate(()=>audioEnabled),false);
    const before=await page.evaluate(()=>JSON.stringify(serializeWorkspace()));
    await page.getByRole('button',{name:'3D view',exact:true}).click();
    assert.equal(await page.locator('canvas').isVisible(),true);
    assert.equal(await page.locator('#roomMap').isVisible(),false);
    await page.getByRole('button',{name:'Room map',exact:true}).click();
    assert.equal(await page.evaluate(()=>JSON.stringify(serializeWorkspace())),before);
    await page.getByRole('button',{name:'A',exact:true}).click();
    await page.getByText('Arrange & compare',{exact:true}).click();
    const layout=await page.evaluate(()=>{
      const map=document.getElementById('roomMap').getBoundingClientRect(),ui=document.getElementById('ui').getBoundingClientRect();
      return {width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,map:{left:map.left,right:map.right,bottom:map.bottom,top:map.top},ui:{left:ui.left,top:ui.top}};
    });
    assert.equal(layout.width,width);
    assert.equal(layout.overflow,false);
    assert.ok(width>600?layout.map.left>290:layout.map.bottom<layout.ui.top);
    assert.deepEqual(errors,[]);
    await page.screenshot({path:`test-results/${width}-workflow.png`});
    results.push({width,workflow:'drag, undo, precision keys, audio start, A/B copy/edit, muted switch, save/reload/restore, remove/undo, map/3D state preservation',layout,errors});
    await context.close();
  }
} finally {
  await writeFile('test-results/results.json',JSON.stringify(results,null,2));
  await browser.close();server.close();
}
