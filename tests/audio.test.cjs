const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {readFileSync} = require('node:fs');
const html=readFileSync(require('node:path').join(__dirname,'..','index.html'),'utf8');
function setup() {
  const elements=new Map();
  function element(id){if(!elements.has(id))elements.set(id,{value:'',addEventListener(){},setAttribute(k,v){this[k]=v;}});return elements.get(id);}
  function vector(){return {x:0,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z});}};}
  function Mesh(geo,material){this.position=vector();this.material=material;}
  function param(){return {value:0,setTargetAtTime(v){this.value=v;}};}
  function audioNode(){return {gain:param(),frequency:param(),positionX:param(),positionY:param(),positionZ:param(),connect(to){this.connectedTo=to;return to;},start(){}};}
  const audio={resumeCalls:0,currentTime:0,destination:{},listener:audioNode(),createGain:audioNode,createOscillator:audioNode,createBiquadFilter:audioNode,createPanner:audioNode,async resume(){this.resumeCalls++;}};
  const context=vm.createContext({document:{getElementById:element,body:{appendChild(){}}},window:{AudioContext:function(){return audio;},innerWidth:800,innerHeight:600,addEventListener(){}},requestAnimationFrame(){},
    THREE:{Scene:function(){this.add=()=>{};},PerspectiveCamera:function(){this.position=vector();},WebGLRenderer:function(){this.domElement=element('canvas');this.setSize=()=>{};this.render=()=>{};},BoxGeometry:function(){},Mesh,MeshBasicMaterial:function(){this.color={set(v){this.value=v;}};},PointLight:function(){this.position=vector();},Raycaster:function(){},Vector2:function(){}},Math});
  vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],context);
  return {elements,audio,run:code=>vm.runInContext(code,context)};
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
