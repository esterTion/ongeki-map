import {
  Vector3,
  Quaternion,
  Matrix4,
  Scene,
	PerspectiveCamera,
  WebGLRenderer,
	AmbientLight,
  PointLight,
  Color,

  SphereGeometry,
  PlaneGeometry,
  MeshBasicMaterial,
  Mesh,
  OrthographicCamera,
  AxesHelper,
  InstancedMesh,
} from 'three';

import { MapControls } from 'three/addons/controls/MapControls.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import Stats from 'three/addons/libs/stats.module.js';
import THREEx from './threex.rendererstats.js';

const ktx2Loader = new KTX2Loader();
ktx2Loader.setTranscoderPath('./script/');
ktx2Loader.init();

const ASSET_PATH = './assets';

const LAYERS = {
  TILE: 0,
  POINT_TEXT: 0.1,
}

let camera, scene, renderer, controls;

let requestRender = true
function requestRenderLoop() {
	if (requestRender) {
		requestRender = false
		render()
	}
	requestAnimationFrame(requestRenderLoop)
}
requestAnimationFrame(requestRenderLoop)

const loadedTextures = {}
const spritePromises = {}
const sprites = {}

const stats = new Stats();
document.body.appendChild( stats.dom );
var rendererStats	= new THREEx.RendererStats()
rendererStats.domElement.style.position	= 'absolute'
rendererStats.domElement.style.left	= '0px'
rendererStats.domElement.style.top	= '60px'
rendererStats.domElement.style.transform = 'scale(2)'
rendererStats.domElement.style.transformOrigin = '0 0'
document.body.appendChild( rendererStats.domElement )

function init() {
  // camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera = new OrthographicCamera(-window.innerWidth / 200, window.innerWidth / 200, window.innerHeight / 200, -window.innerHeight / 200, 0.1, 100);
  scene = new Scene();

  const ambientLight = new AmbientLight(0xffffff);
	scene.add(ambientLight);
	scene.background = new Color('rgb(160,160,160)');

  const pointLight = new PointLight(0xffffff, 3, 0, 0.1);
	camera.add(pointLight);
	scene.add(camera);
  renderer = new WebGLRenderer({ antialias: true });
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);
	document.body.appendChild(renderer.domElement);
	document.getElementById('loading').remove()

	ktx2Loader.detectSupport(renderer);
  camera.position.set(0,50,0)

	controls = new MapControls(camera, renderer.domElement);
	controls.minDistance = 0.5;
	controls.maxDistance = 20;
	controls.zoomSpeed = 3;
	controls.panSpeed = 3;
  controls.enableDamping = false;
  controls.enableRotate = false;
  controls.autoRotate = false;
	controls.addEventListener('change', () => requestRender = true);

  initSprites();
}

function initSprites() {
  loadedTextures.tiles = new Promise((res, rej) => {
    ktx2Loader.load(`${ASSET_PATH}/tiles.ktx2`, res, undefined, rej)
  })
  loadedTextures.items = new Promise((res, rej) => {
    ktx2Loader.load(`${ASSET_PATH}/items.ktx2`, res, undefined, rej)
  })
  loadedTextures.number = new Promise((res, rej) => {
    ktx2Loader.load(`${ASSET_PATH}/number.ktx2`, res, undefined, rej)
  })

  spritePromises.tiles = new Promise((res, rej) => initSprite(res, rej, 'tiles'))
  spritePromises.items = new Promise((res, rej) => initSprite(res, rej, 'items'))
  spritePromises.number = new Promise((res, rej) => initSprite(res, rej, 'number'))
}
async function initSprite(res, rej, name) {
  const result = await fetch(`${ASSET_PATH}/${name}.json`).then(r => r.json())
  const sizew = result.size.w, sizeh = result.size.h;
  const spriteMap = {}
  const baseTexture = await loadedTextures[name]
  for (const spriteName in result.frames) {
    const { x, y, w, h } = result.frames[spriteName];
    const tex = baseTexture.clone()
    tex.repeat.set(w / sizew, h / sizeh)
    tex.offset.set(x / w * tex.repeat.x, (sizeh - h - y) / h * tex.repeat.y)
    const geometry = new PlaneGeometry(1, 1)
    const material = new MeshBasicMaterial({
      map: tex,
      transparent: true,
    })
    const instance = new InstancedMesh(geometry, material, 1024)
    instance.count = 0;
    instance.name = `${name}/${spriteName}`;
    scene.add(instance)
    spriteMap[spriteName] = {
      instance,
      frame: result.frames[spriteName],
    }
  }
  sprites[name] = spriteMap
  res()
}
const facingTop = new Quaternion;
facingTop.setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
function setSpriteVisible(sprite, x, y, z, w, h) {
  sprite = sprite.instance;
  const idx = sprite.count++;
  const matrix = new Matrix4;
  matrix.compose(
    new Vector3(x, y, z),
    facingTop,
    new Vector3(w, h, 1)
  );
  sprite.setMatrixAt(idx, matrix);
  sprite.instanceMatrix.needsUpdate = true;
  requestRender = true;
}
function resetSprites() {
  for (const map of Object.values(sprites)) {
    for (const sprite of Object.values(map)) {
      sprite.instance.count = 0;
      sprite.instance.instanceMatrix.needsUpdate = true;
    }
  }
}

function render() {
	renderer.render(scene, camera);
  rendererStats.update(renderer);
  stats.update();
}

function onWindowResize() {

	// camera.aspect = window.innerWidth / window.innerHeight;
  camera.left = -window.innerWidth / 200;
  camera.right = window.innerWidth / 200;
  camera.top = window.innerHeight / 200;
  camera.bottom = -window.innerHeight / 200;
	camera.updateProjectionMatrix();

	renderer.setSize(window.innerWidth, window.innerHeight);

	render()

}

function initMaps() {
  const maps = {
    20: '期末試験編',
  }

	const characterSelect = document.createElement('select')
	characterSelect.setAttribute('style', 'position:fixed;top:30px;left:10px')
  for (const mapId in maps) {
    const option = document.createElement('option')
    option.value = mapId
    option.textContent = maps[mapId]
    characterSelect.appendChild(option)
  }
  characterSelect.value = 20;
  document.body.appendChild(characterSelect)
  characterSelect.addEventListener('change', () => {
    const mapId = characterSelect.value
    loadMapInfo(mapId)
  })
  loadMapInfo(20)
}

let loadingSession = null
const tileInfoMap = []
async function loadMapInfo(id) {
  const currentLoadSession = Symbol('load');
  loadingSession = currentLoadSession
  const mapEvent = await fetch(`${ASSET_PATH}/xml/mapevent${(id+'').padStart(4, '0')}/MapEvent.xml`)
    .then(r => r.text())
    .then(r => (new DOMParser()).parseFromString(r, 'text/xml'))
  const tiles = Array.from(mapEvent.getElementsByTagName('MapEventTileData'))

  await spritePromises.tiles

  if (loadingSession !== currentLoadSession) return;
  tileInfoMap.length = 0

  tiles.forEach(tile => {
    const tileInfo = parseTileInfo(tile)
    const tileId = tileInfo.TileID;
    tileInfoMap[tileId] = tileInfo
  })
  renderTiles()

  console.log(tileInfoMap)
  const startingTile = tileInfoMap[1]
  camera.position.set(startingTile.CoordX, 50, -startingTile.CoordY)
  controls.target.set(startingTile.CoordX, 0, -startingTile.CoordY)
  controls.update()
}
function parseTileInfo(tile) {
  const info = {}
  for (const element of tile.children) {
    const key = element.tagName
    switch (key) {
      case 'Reward': {
        info[key] = {
          'id': parseInt(element.querySelector('id').textContent),
          'str': element.querySelector('str').textContent
        }
        break;
      }
      case 'UnlockConditionTileID': {
        info[key] = Array.from(element.querySelectorAll('int')).map(i => parseInt(i.textContent))
        break
      }
      default: {
        info[key] = element.textContent
        if (info[key] === 'false') info[key] = false
        if (info[key] === 'true') info[key] = true
        if (parseInt(info[key]) + '' === info[key]) info[key] = parseInt(info[key])
      }
    }
  }
  return info;
}
function renderTiles() {
  resetSprites()
  for (const tileInfo of tileInfoMap) {
    if (!tileInfo) continue
    const hasContent = tileInfo.Reward.id !== 0
                    || tileInfo.UnlockKeyID !== 0
                    || tileInfo.RewardKeyID !== 0
                    || tileInfo.RewardScenarioID !== 0
    const usingTile = sprites.tiles[hasContent ? 'tile_with_item' : 'tile_empty']
    const x = tileInfo.CoordX
    const y = -tileInfo.CoordY
    const w = 0.5
    const h = usingTile.frame.h / usingTile.frame.w * w
    setSpriteVisible(usingTile, x, LAYERS.TILE, y, w, h)

    let point = (tileInfo.Point + '').split('')
    for (const i in point) {
      const text = sprites.number['n'+point[i]]
      const textw = 0.2;
      const texth = text.frame.h / text.frame.w * textw
      setSpriteVisible(text, x + 0.25 + i * 0.1, LAYERS.POINT_TEXT, y + 0.2, textw, texth)
    }
  }
}

init();
initMaps();
window.addEventListener('resize', onWindowResize);
