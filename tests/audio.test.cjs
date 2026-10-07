const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {readFileSync} = require('node:fs');
const html=readFileSync(require('node:path').join(__dirname,'..','index.html'),'utf8');
function setup(saved = null) {
  const elements=new Map();
  let activeElement = null;
  const storage = new Map(saved ? [['speaker-simulator.scene.v1',saved]] : []);
  function element(id){if(!elements.has(id))elements.set(id,{value:'',dataset:{},style:{setProperty(k,v){this[k]=v;}},appendChild(){},remove(){this.removed=true;if(activeElement===this)activeElement=null;},setPointerCapture(){},focus(){this.focused=true;activeElement=this;},addEventListener(type,fn){this[type]=fn;},setAttribute(k,v){this[k]=v;}});return elements.get(id);}
  function vector(){return {x:0,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z});}};}
  function Mesh(geo,material){this.position=vector();this.material=material;this.geometry=geo;}
  function param(){return {value:0,cancelScheduledValues(){},setValueAtTime(v){this.value=v;},setTargetAtTime(v){this.value=v;}};}
  function audioNode(){return {gain:param(),frequency:param(),positionX:param(),positionY:param(),positionZ:param(),connect(to){this.connectedTo=to;return to;},start(){},stop(){this.stopped=true;},disconnect(){this.disconnected=true;}};}
  const audio={resumeCalls:0,currentTime:0,destination:{},listener:audioNode(),createGain:audioNode,createOscillator:audioNode,createBiquadFilter:audioNode,createPanner:audioNode,async resume(){this.resumeCalls++;}};
  const context=vm.createContext({localStorage:{setItem(k,v){storage.set(k,v);},getItem:k=>storage.get(k)},document:{get activeElement(){return activeElement;},createElement:()=>element(Symbol()),getElementById:element,querySelectorAll:()=>[],body:{appendChild(){}}},window:{AudioContext:function(){return audio;},innerWidth:800,innerHeight:600,addEventListener(type,fn){this[type]=fn;}},requestAnimationFrame(){},
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
  app.run('selectedSpeaker.volume = 0.12; selectedSpeaker.osc.frequency.value = 660; selectSpeaker(selectedSpeaker)');
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

test('A/B preserves independent edits and Undo restores overwritten arrangements',()=>{
  const app=setup();
  app.run('selectedSpeaker.osc.frequency.value=550');
  app.elements.get('copyArrangement').onclick();
  app.elements.get('arrangementB').onclick();
  assert.equal(app.run('selectedSpeaker.osc.frequency.value'),550);
  app.run('selectedSpeaker.osc.frequency.value=880');
  app.elements.get('arrangementA').onclick();
  assert.equal(app.run('selectedSpeaker.osc.frequency.value'),550);
  app.elements.get('copyArrangement').onclick();
  app.elements.get('undo').onclick();
  assert.equal(app.run('arrangements.B.speakers[0][3]'),880);
  assert.equal(app.run('activeArrangement'),'A');
});

test('continuous level editing is one reversible gesture and retains requested gain',()=>{
  const app=setup();
  const volume=app.elements.get('volume');
  for(const value of ['0.4','0.3','0.2']) { volume.value=value;volume.oninput(); }
  volume.onchange();
  assert.equal(app.run('history.length'),1);
  assert.equal(app.run('selectedSpeaker.volume'),0.2);
  app.elements.get('undo').onclick();
  assert.equal(app.run('selectedSpeaker.volume'),0.5);
  assert.equal(app.run('history.length'),0);
});

test('mix budget is bounded with 32 full-volume voices without altering saved levels',()=>{
  const app=setup();
  app.run('applyScene({version:1,listener:[0,2,6],speakers:Array(32).fill([0,1,0,440,1])})');
  assert.ok(app.run('speakers.reduce((sum,s)=>sum+s.gain.gain.value,0)')<=0.70000001);
  assert.equal(app.run('serializeScene().speakers.every(s=>s[4]===1)'),true);
  app.run('selectSpeaker(speakers[15])');
  assert.equal(app.elements.get('volume').value,'1');
  assert.equal(app.run('selectedSpeaker.filter.frequency.value'),20000);
});

test('Undo and switching arrangements invalidate delayed resume and active audio',async()=>{
  for(const action of ['undo','arrangementB']) {
    const app=setup();let resume;
    app.elements.get('addSpeaker').onclick();
    app.audio.resume=()=>new Promise(resolve=>{resume=resolve;});
    const pending=app.elements.get('toggleAudio').onclick();
    app.elements.get(action).onclick();
    resume();await pending;
    assert.equal(app.run('audioEnabled'),false);
    assert.equal(app.run('masterGain.gain.value'),0);
    app.audio.resume=async()=>{};
    await app.elements.get('toggleAudio').onclick();
    app.elements.get('addSpeaker').onclick();
    app.elements.get('undo').onclick();
    assert.equal(app.run('audioEnabled'),false);
    assert.equal(app.run('masterGain.gain.value'),0);
  }
});

test('saved workspaces round trip both arrangements and legacy scenes migrate independently',()=>{
  const app=setup();
  app.run('globalThis.legacy=serializeScene();restoreWorkspace(legacy);arrangements.B.speakers[0][3]=660');
  assert.equal(app.run('selectedSpeaker.osc.frequency.value'),440);
  app.run('switchArrangement("B");globalThis.snapshot=serializeWorkspace();switchArrangement("A");restoreWorkspace(snapshot)');
  assert.equal(app.run('activeArrangement'),'B');
  assert.equal(app.run('selectedSpeaker.osc.frequency.value'),660);
  assert.equal(app.run('arrangements.A.speakers[0][3]'),440);
  assert.equal(app.run('audioEnabled'),false);
  const before=app.run('JSON.stringify(serializeWorkspace())');
  assert.throws(()=>app.run('restoreWorkspace({version:2,active:"A",arrangements:{A:legacy,B:{}}})'));
  assert.equal(app.run('JSON.stringify(serializeWorkspace())'),before);
});

test('map keyboard edits preserve height, clamp speakers and provide precision with Undo',()=>{
  const app=setup();
  app.run('globalThis.marker=mapMarkers.get("1");marker.closest=()=>marker');
  const marker=app.run('marker'),map=app.elements.get('roomMap');
  map.keydown({target:marker,key:'ArrowRight',shiftKey:true,preventDefault(){}});
  assert.equal(app.run('selectedSpeaker.mesh.position.x'),1.1);
  assert.equal(app.run('selectedSpeaker.mesh.position.y'),1);
  app.elements.get('undo').onclick();
  assert.equal(app.run('selectedSpeaker.mesh.position.x'),1);
  app.run('placeOnMap("1",99,-99)');
  assert.equal(app.run('selectedSpeaker.mesh.position.x'),5);
  assert.equal(app.run('selectedSpeaker.mesh.position.z'),-5);
});

test('map drag uses actual geometry, preserves grab offset and becomes one Undo entry',()=>{
  const app=setup(),map=app.elements.get('roomMap');
  app.run('globalThis.marker=mapMarkers.get("1");marker.closest=()=>marker');
  map.getBoundingClientRect=()=>({width:280,height:280});
  map.pointerdown({target:app.run('marker'),button:0,pointerId:7,clientX:151,clientY:123,preventDefault(){}});
  for(const x of [171,191,211])map.pointermove({pointerId:7,clientX:x,clientY:143});
  map.pointercancel({pointerId:7});
  assert.equal(app.run('selectedSpeaker.mesh.position.x'),4);
  assert.equal(app.run('selectedSpeaker.mesh.position.z'),1);
  assert.equal(app.run('history.length'),1);
  app.elements.get('undo').onclick();
  assert.equal(app.run('selectedSpeaker.mesh.position.x'),1);
  assert.equal(app.run('selectedSpeaker.mesh.position.z'),0);
});

test('legacy distant listener remains visible, Home is reversible and history is bounded',()=>{
  const app=setup();
  app.run('applyScene({version:1,listener:[90,2,-100],speakers:SCENE_PRESETS.single})');
  assert.equal(app.run('mapExtent'),101);
  app.elements.get('homeListener').onclick();
  assert.equal(app.run('camera.position.z'),6);
  app.elements.get('undo').onclick();
  assert.equal(app.run('camera.position.z'),-100);
  for(let n=0;n<60;n++)app.run('moveListener("a")');
  assert.equal(app.run('history.length'),40);
});

test('held map drag cannot edit a scene replaced by a preset, A/B, Restore or Undo',()=>{
  for(const action of ['preset','switch','restore','undo']) {
    const app=setup(),map=app.elements.get('roomMap');
    app.run('globalThis.saved=serializeWorkspace();globalThis.marker=mapMarkers.get("1");marker.closest=()=>marker');
    map.getBoundingClientRect=()=>({width:280,height:280});
    map.pointerdown({target:app.run('marker'),button:0,pointerId:7,clientX:150,clientY:120,preventDefault(){}});
    map.pointermove({pointerId:7,clientX:170,clientY:120});
    if(action==='preset') {app.run('document.getElementById("scenePreset").value="stereo"');app.elements.get('applyScene').onclick();}
    if(action==='switch')app.elements.get('arrangementB').onclick();
    if(action==='restore')app.run('endGesture();restoreWorkspace(saved)');
    if(action==='undo')app.elements.get('undo').onclick();
    const before=app.run('JSON.stringify(serializeScene())');
    map.pointermove({pointerId:7,clientX:250,clientY:250});
    map.pointerup({pointerId:7});
    assert.equal(app.run('JSON.stringify(serializeScene())'),before,action);
    assert.equal(app.run('drag'),null);
  }
});

test('empty scene offers recovery and final Undo focuses the restored visible object',()=>{
  for (const mapVisible of [true,false]) {
    const app=setup();
    app.run(`setSceneView(${mapVisible})`);
    app.elements.get('removeSpeaker').onclick();
    assert.equal(app.elements.get('emptyScene').hidden,false);
    assert.equal(app.elements.get('speakerEditor').hidden,true);
    assert.equal(app.run('document.activeElement === document.getElementById("addSpeaker")'),true);
    app.elements.get('undo').onclick();
    assert.equal(app.elements.get('emptyScene').hidden,true);
    assert.equal(app.elements.get('speakerEditor').hidden,false);
    assert.equal(app.elements.get('undo').disabled,true);
    assert.equal(app.run(mapVisible ? 'document.activeElement === mapMarkers.get(String(selectedSpeaker.id))' : 'document.activeElement === speakerSelect'),true);
    assert.equal(app.run('audioEnabled'),false);
  }
});

test('save feedback tracks settings, other arrangement copies, undo and browser reload',()=>{
  const app=setup();
  const status=app.elements.get('saveStatus');
  assert.match(status.textContent,/No saved/);
  app.elements.get('saveScene').onclick();
  assert.equal(status.textContent,'A + B saved in this browser.');
  const saved=app.run('savedWorkspaceJSON');
  const frequency=app.elements.get('freq');frequency.value='660';frequency.oninput();frequency.onchange();
  assert.equal(status.textContent,'Unsaved changes to A + B.');
  app.elements.get('copyArrangement').onclick();
  app.elements.get('undo').onclick();
  assert.equal(status.textContent,'Unsaved changes to A + B.');
  app.elements.get('undo').onclick();
  assert.equal(status.textContent,'A + B saved in this browser.');
  const reloaded=setup(saved);
  assert.equal(reloaded.elements.get('saveStatus').textContent,'A + B saved in this browser.');
  reloaded.elements.get('arrangementB').onclick();
  assert.equal(reloaded.elements.get('applyScene').textContent,'Use preset in B');
  assert.equal(reloaded.elements.get('saveStatus').textContent,'Unsaved changes to A + B.');
  reloaded.elements.get('loadScene').onclick();
  assert.equal(reloaded.elements.get('saveStatus').textContent,'A + B saved in this browser.');
  assert.equal(reloaded.run('audioEnabled'),false);
});

test('listener reset preserves speakers, announces its scope and remains reversible',()=>{
  const app=setup();
  app.run('placeOnMap("listener",3,4)');
  const speakers=app.run('JSON.stringify(serializeScene().speakers)');
  app.elements.get('homeListener').onclick();
  assert.equal(app.run('JSON.stringify(serializeScene().speakers)'),speakers);
  assert.equal(app.run('JSON.stringify(serializeScene().listener)'),'[0,2,6]');
  assert.match(app.elements.get('sceneStatus').textContent,/Speakers stay/);
  app.elements.get('undo').onclick();
  assert.equal(app.run('JSON.stringify(serializeScene().listener)'),'[3,2,4]');
});

function savedComparison() {
  return JSON.stringify({version:2,active:'B',arrangements:{
    A:{version:1,listener:[1,2,5],speakers:[[1,1,0,330,0.2]]},
    B:{version:1,listener:[-2,2,4],speakers:[[-2,1,0,660,0.4],[2,3,0,880,0.1]]}
  }});
}

test('returning workspace offers the saved A/B counts without applying or playing it',()=>{
  const fresh=setup();
  assert.equal(fresh.elements.get('savedWork').hidden,true);
  const app=setup(savedComparison());
  assert.equal(app.elements.get('savedWork').hidden,false);
  assert.equal(app.elements.get('savedWorkSummary').textContent,'A: 1 speaker · B: 2 speakers · Opens B');
  assert.equal(app.run('activeArrangement'),'A');
  assert.equal(app.run('speakers.length'),1);
  assert.equal(app.run('selectedSpeaker.osc.frequency.value'),440);
  assert.equal(app.audio.resumeCalls,0);
  assert.equal(app.run('masterGain.gain.value'),0);
  assert.equal(setup('{"version":2,"arrangements":{}}').elements.get('savedWork').hidden,true);
});

test('continue saved restores both arrangements muted and Undo recovers current edits',async()=>{
  for(const mapVisible of [true,false]) {
    const app=setup(savedComparison());
    app.run(`setSceneView(${mapVisible});selectedSpeaker.osc.frequency.value=550;placeOnMap('listener',3,2)`);
    const before=app.run('JSON.stringify(serializeWorkspace())');
    let resume;
    app.audio.resume=()=>new Promise(resolve=>{resume=resolve;});
    const pending=app.elements.get('toggleAudio').onclick();
    app.elements.get('continueSaved').onclick();
    resume();await pending;
    assert.equal(app.run('JSON.stringify(serializeWorkspace())'),savedComparison());
    assert.equal(app.run('audioEnabled'),false);
    assert.equal(app.run('masterGain.gain.value'),0);
    assert.equal(app.elements.get('savedWork').hidden,true);
    assert.equal(app.run(mapVisible ? 'document.activeElement === mapMarkers.get("1")' : 'document.activeElement === speakerSelect'),true);
    app.elements.get('undo').onclick();
    assert.equal(app.run('JSON.stringify(serializeWorkspace())'),before);
  }
});

test('keep current preserves edits, saved storage and audio; manual restore stays available',async()=>{
  const saved=savedComparison(),app=setup(saved);
  app.elements.get('addSpeaker').onclick();
  const before=app.run('JSON.stringify(serializeWorkspace())'),history=app.run('history.length');
  await app.elements.get('toggleAudio').onclick();
  app.elements.get('keepCurrent').onclick();
  assert.equal(app.elements.get('savedWork').hidden,true);
  assert.equal(app.run('JSON.stringify(serializeWorkspace())'),before);
  assert.equal(app.run('localStorage.getItem(SCENE_KEY)'),saved);
  assert.equal(app.run('history.length'),history);
  assert.equal(app.run('audioEnabled'),true);
  assert.equal(app.run('document.activeElement === mapMarkers.get(String(selectedSpeaker.id))'),true);
  app.elements.get('loadScene').onclick();
  assert.equal(app.run('JSON.stringify(serializeWorkspace())'),saved);
  assert.equal(app.run('audioEnabled'),false);
});

test('failed continue validates both arrangements before mutation and allows retry',()=>{
  for(const unreadable of [false,true]) {
    const app=setup(savedComparison());
    app.elements.get('addSpeaker').onclick();
    const before=app.run('JSON.stringify(serializeWorkspace())'),history=app.run('history.length');
    const getItem=app.context.localStorage.getItem;
    app.context.localStorage.getItem=()=>{
      if(unreadable)throw Error('blocked');
      return '{"version":2,"active":"A","arrangements":{"A":{"version":1,"listener":[0,2,6],"speakers":[]},"B":{}}}';
    };
    app.elements.get('continueSaved').onclick();
    assert.equal(app.run('JSON.stringify(serializeWorkspace())'),before);
    assert.equal(app.run('history.length'),history);
    assert.equal(app.elements.get('savedWork').hidden,false);
    assert.equal(app.elements.get('savedWorkError').hidden,false);
    assert.match(app.elements.get('savedWorkError').textContent,/unchanged/);
    assert.equal(app.run('document.activeElement === document.getElementById("continueSaved")'),true);
    app.context.localStorage.getItem=getItem;
    app.elements.get('continueSaved').onclick();
    assert.equal(app.run('JSON.stringify(serializeWorkspace())'),savedComparison());
  }
});

test('legacy empty saves resume recoverably and a new Save closes the old recovery prompt',()=>{
  const app=setup(JSON.stringify({version:1,listener:[0,2,6],speakers:[]}));
  assert.equal(app.elements.get('savedWorkSummary').textContent,'A: 0 speakers · B: 0 speakers · Opens A');
  app.elements.get('continueSaved').onclick();
  assert.equal(app.run('speakers.length'),0);
  assert.equal(app.elements.get('toggleAudio').disabled,true);
  assert.equal(app.run('document.activeElement === document.getElementById("addSpeaker")'),true);
  app.elements.get('undo').onclick();
  assert.equal(app.run('speakers.length'),1);
  const changed=setup(savedComparison());
  changed.elements.get('saveScene').onclick();
  assert.equal(changed.elements.get('savedWork').hidden,true);
  assert.equal(changed.run('localStorage.getItem(SCENE_KEY)'),changed.run('JSON.stringify(serializeWorkspace())'));
});
