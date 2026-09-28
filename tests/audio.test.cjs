const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {readFileSync} = require('node:fs');
const html=readFileSync(require('node:path').join(__dirname,'..','index.html'),'utf8');
function setup() {
  const elements=new Map();
  function element(id){if(!elements.has(id))elements.set(id,{value:'',focus(){this.focused=true;},addEventListener(type,fn){this[type]=fn;},setAttribute(k,v){this[k]=v;}});return elements.get(id);}
  function vector(){return {x:0,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z});}};}
  function Mesh(geo,material){this.position=vector();this.material=material;this.geometry=geo;}
  function param(){return {value:0,setTargetAtTime(v){this.value=v;}};}
  function audioNode(){return {gain:param(),frequency:param(),positionX:param(),positionY:param(),positionZ:param(),connect(to){this.connectedTo=to;return to;},start(){},stop(){this.stopped=true;},disconnect(){this.disconnected=true;}};}
  const audio={resumeCalls:0,currentTime:0,destination:{},listener:audioNode(),createGain:audioNode,createOscillator:audioNode,createBiquadFilter:audioNode,createPanner:audioNode,async resume(){this.resumeCalls++;}};
  const context=vm.createContext({document:{getElementById:element,querySelectorAll:()=>[],body:{appendChild(){}}},window:{AudioContext:function(){return audio;},innerWidth:800,innerHeight:600,addEventListener(type,fn){this[type]=fn;}},requestAnimationFrame(){},
    THREE:{Scene:function(){this.add=()=>{};this.remove=()=>{};},PerspectiveCamera:function(_fov,aspect){this.aspect=aspect;this.position=vector();this.updateProjectionMatrix=()=>{};},WebGLRenderer:function(){this.domElement=element('canvas');this.setSize=(width,height)=>{this.width=width;this.height=height;};this.render=()=>{};},BoxGeometry:function(){this.dispose=()=>{this.disposed=true;};},Mesh,MeshBasicMaterial:function(){this.dispose=()=>{this.disposed=true;};this.color={set(v){this.value=v;}};},PointLight:function(){this.position=vector();},Raycaster:function(){this.setFromCamera=()=>{};this.intersectObjects=()=>[];},Vector2:function(){}},Math});
  vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],context);
  return {elements,audio,context,run:code=>vm.runInContext(code,context)};
}
test('audio remains muted until explicit start, resumes browser context, and can stop',async()=>{
  const app=setup();
  assert.equal(app.run('masterGain.gain.value'),0);
  assert.equal(app.audio.resumeCalls,0);
  await app.elements.get('toggleAudio').onclick();
  assert.equal(app.audio.resumeCalls,1);
  assert.equal(app.run('masterGain.gain.value'),1);
  assert.equal(app.elements.get('toggleAudio')['aria-pressed'],'true');
  await app.elements.get('toggleAudio').onclick();
  assert.equal(app.run('masterGain.gain.value'),0);
});
test('speaker selection synchronizes sliders with its actual settings',()=>{
  const app=setup();
  app.run('selectedSpeaker.gain.gain.value = 0.12; selectedSpeaker.osc.frequency.value = 660; selectSpeaker(selectedSpeaker)');
  assert.equal(app.elements.get('volume').value,'0.12');
  assert.equal(app.elements.get('freq').value,'660');
  app.elements.get('addSpeaker').onclick();
  assert.equal(app.elements.get('volume').value,'0.5');
  assert.equal(app.elements.get('freq').value,'440');
});
test('resume rejection allows retry without unmuting output',async()=>{
  const app=setup();
  app.audio.resume=async()=>{throw Error('denied');};
  await app.elements.get('toggleAudio').onclick();
  assert.equal(app.elements.get('toggleAudio').disabled,false);
  assert.equal(app.run('masterGain.gain.value'),0);
  assert.match(app.elements.get('audioStatus').textContent,/could not start/);
});


test('speaker list selects independently and removal releases audio and graphics resources',()=>{
  const app=setup();
  app.run('globalThis.first=selectedSpeaker');
  app.elements.get('addSpeaker').onclick();
  app.elements.get('speakerSelect').value='1';app.elements.get('speakerSelect').onchange();
  assert.equal(app.run('selectedSpeaker.id'),1);
  app.elements.get('removeSpeaker').onclick();
  assert.equal(app.run('first.osc.stopped && first.osc.disconnected && first.panner.disconnected'),true);
  assert.equal(app.run('first.mesh.geometry.disposed && first.mesh.material.disposed'),true);
  assert.equal(app.run('selectedSpeaker.id'),2);
  assert.equal(app.elements.get('speakerSelect').focused,true);
  app.elements.get('removeSpeaker').onclick();
  assert.equal(app.run('speakers.length'),0);
  assert.equal(app.elements.get('toggleAudio').disabled,true);
  assert.equal(app.elements.get('volume').disabled,true);
  assert.equal(app.elements.get('addSpeaker').focused,true);
  app.elements.get('addSpeaker').onclick();
  assert.equal(app.elements.get('toggleAudio').disabled,false);
  assert.equal(app.run('masterGain.gain.value'),0);
});

test('readouts follow sliders and WASD does not move while editing a control',()=>{
  const app=setup();
  app.elements.get('volume').value='0.23';app.elements.get('volume').oninput();
  app.elements.get('freq').value='650';app.elements.get('freq').oninput();
  assert.equal(app.elements.get('volumeValue').textContent,'23%');
  assert.equal(app.elements.get('freqValue').textContent,'650 Hz');
  const keydown=app.context.window.keydown;
  keydown({key:'W',target:{tagName:'SELECT'}});
  assert.equal(app.run('camera.position.z'),6);
  keydown({key:'W',target:{tagName:'BODY'}});
  assert.equal(app.run('camera.position.z'),5.7);
});

test('removing all speakers cancels a pending start even if a new speaker is added',async()=>{
  const app=setup();let resume;
  app.audio.resume=()=>new Promise(resolve=>{resume=resolve;});
  const pending=app.elements.get('toggleAudio').onclick();
  app.elements.get('removeSpeaker').onclick();
  app.elements.get('addSpeaker').onclick();
  resume();await pending;
  assert.equal(app.run('masterGain.gain.value'),0);
  assert.equal(app.run('audioEnabled'),false);
});

test('scene serialization round-trips positions and sound settings while restore stops output',async()=>{
  const app=setup();
  app.run("applyScene({version:1,listener:[1,2,3],speakers:SCENE_PRESETS.stereo});globalThis.savedScene=serializeScene()");
  await app.elements.get('toggleAudio').onclick();
  assert.equal(app.run('audioEnabled'),true);
  app.run('applyScene(savedScene)');
  assert.equal(app.run('JSON.stringify(serializeScene())'),app.run('JSON.stringify(savedScene)'));
  assert.equal(app.run('audioEnabled'),false);
  assert.equal(app.run('masterGain.gain.value'),0);
  assert.equal(app.run('selectedSpeaker.id'),1);
});

test('invalid saved scenes cannot destroy or replace the current scene',()=>{
  const app=setup();
  const before=app.run('JSON.stringify(serializeScene())');
  for(const speakers of ['[[0,1,0,Infinity,.5]]','[[0,1,0,440,2]]','[[0,1,0,99,.5]]','[[6,1,0,440,.5]]','Array(33).fill([0,1,0,440,.5])']){
    assert.throws(()=>app.run(`applyScene({version:1,listener:[0,2,6],speakers:${speakers}})`),/invalid/);
    assert.equal(app.run('JSON.stringify(serializeScene())'),before);
  }
});

test('scene storage reports failures and restores a saved scene without autoplay',()=>{
  const app=setup(),storage=new Map();
  app.context.localStorage={setItem(k,v){storage.set(k,v);},getItem:k=>storage.get(k)};
  app.elements.get('saveScene').onclick();
  app.elements.get('addSpeaker').onclick();
  app.elements.get('loadScene').onclick();
  assert.equal(app.run('speakers.length'),1);
  assert.equal(app.run('audioEnabled'),false);
  app.context.localStorage.setItem=()=>{throw Error('full');};
  app.elements.get('saveScene').onclick();
  assert.match(app.elements.get('sceneStatus').textContent,/not saved/);
});

test('restoring a preset invalidates pending audio startup',async()=>{
  const app=setup();let resume;
  app.audio.resume=()=>new Promise(resolve=>{resume=resolve;});
  const pending=app.elements.get('toggleAudio').onclick();
  app.run('applyScene({version:1,listener:[0,2,6],speakers:SCENE_PRESETS.surround})');
  resume();await pending;
  assert.equal(app.run('audioEnabled'),false);
  assert.equal(app.run('speakers.length'),4);
  assert.equal(app.elements.get('toggleAudio').disabled,false);
});

test('invalid position entry preserves coordinates and speaker count is bounded',()=>{
  const app=setup(),x=app.elements.get('speakerX');
  x.value='99';x.onchange();assert.equal(x.value,'1');
  x.value='-2.5';x.onchange();assert.equal(app.run('selectedSpeaker.mesh.position.x'),-2.5);
  for(let i=0;i<40;i++)app.elements.get('addSpeaker').onclick();
  assert.equal(app.run('speakers.length'),32);
});

test('mobile viewport keeps the rendered scene above controls and desktop resizing restores full height',()=>{
  const app=setup();
  app.context.window.innerWidth=390;app.context.window.innerHeight=844;
  app.context.window.resize();
  const height=app.run('renderer.height');
  assert.ok(height <= 844 * .54 - 10, 'canvas ends before the control pane begins');
  assert.ok(height >= 844 * .50, 'scene retains roughly half the phone viewport');
  assert.equal(app.run('renderer.width'),390);
  assert.equal(app.run('camera.aspect'),390 / height);
  app.context.window.innerWidth=1200;app.context.window.innerHeight=800;
  app.context.window.resize();
  assert.equal(app.run('renderer.height'),800);
  assert.equal(app.run('camera.aspect'),1.5);
});

test('speaker picking normalizes against the actual canvas rectangle including offsets',()=>{
  const app=setup(),canvas=app.elements.get('canvas');
  canvas.getBoundingClientRect=()=>({left:12,top:20,width:390,height:430});
  canvas.click({clientX:207,clientY:235});
  assert.equal(app.run('mouse.x'),0);
  assert.equal(app.run('mouse.y'),0);
  canvas.click({clientX:12,clientY:20});
  assert.equal(app.run('mouse.x'),-1);
  assert.equal(app.run('mouse.y'),1);
});
