import {
  Vector2,
  Vector3,
  Quaternion,
  Matrix4,
  Euler,
  Scene,
  WebGLRenderer,
  AmbientLight,
  PointLight,
  Color,

  PlaneGeometry,
  MeshBasicMaterial,
  OrthographicCamera,
  InstancedMesh,
  Shape,
  ShapeGeometry,
  CanvasTexture,
  RepeatWrapping,
  Raycaster,
} from 'three';

import { MapControls } from 'three/addons/controls/MapControls.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
// import Stats from 'three/addons/libs/stats.module.js';
// import THREEx from './threex.rendererstats.js';

const ktx2Loader = new KTX2Loader();
ktx2Loader.setTranscoderPath('./script/');
ktx2Loader.init();

const ASSET_PATH = './assets';

const LAYERS = {
  ARROW: -0.1,
  TILE: 0,
  REWARD: 0.1,
  POINT_TEXT: 0.2,
};

let camera, scene, renderer, controls;

let requestRender = true;
function requestRenderLoop(now) {
  if (requestRender) {
    // requestRender = false
    render(now);
  }
  requestAnimationFrame(requestRenderLoop);
}
requestAnimationFrame(requestRenderLoop);

const loadedTextures = {};
const spritePromises = {};
const sprites = {};

const raycaster = new Raycaster();
const mouse = new Vector2(1, 1);
window.addEventListener('pointermove', e => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});
window.addEventListener('touchstart', e => {
  if (e.touches.length > 0) {
    mouse.x = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.touches[0].clientY / window.innerHeight) * 2 + 1;
  }
});

const loadingItem = {};
function getLoadingDescription(adds, removes) {
  for (const add of adds) loadingItem[add] = true;
  for (const remove of removes) delete loadingItem[remove];
  return Object.keys(loadingItem).map(i => `Loading ${i}`).join('\n');
}
const infoDiv = document.createElement('div');
infoDiv.setAttribute('style', 'position:fixed;top:70px;left:10px;background-color:rgba(255,255,255,0.7);padding:20px;white-space:pre-wrap;max-width:300px;font-family:Arial,Meiryo,"Microsoft Yahei";pointer-events:none');
infoDiv.textContent = getLoadingDescription(['tiles', 'items', 'number', 'map-info'], []);
document.body.appendChild(infoDiv);

// const stats = new Stats();
// document.body.appendChild( stats.dom );
// var rendererStats	= new THREEx.RendererStats()
// rendererStats.domElement.style.position	= 'absolute'
// rendererStats.domElement.style.left	= '0px'
// rendererStats.domElement.style.top	= '60px'
// rendererStats.domElement.style.transform = 'scale(2)'
// rendererStats.domElement.style.transformOrigin = '0 0'
// document.body.appendChild( rendererStats.domElement )

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
  document.getElementById('loading').remove();

  ktx2Loader.detectSupport(renderer);
  camera.position.set(0,50,0);

  controls = new MapControls(camera, renderer.domElement);
  controls.minDistance = 0.5;
  controls.maxDistance = 20;
  controls.zoomSpeed = 3;
  controls.panSpeed = 1;
  controls.enableDamping = false;
  controls.enableRotate = false;
  controls.autoRotate = false;
  controls.addEventListener('change', () => requestRender = true);

  initSprites();

  {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0,0,256,0);
    gradient.addColorStop(0, 'rgba(100,100,100,0.7)');
    gradient.addColorStop(0.4, 'rgba(100,100,100,0.7)');
    gradient.addColorStop(0.45, 'rgba(255,255,255,0.9)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.55, 'rgba(255,255,255,0.9)');
    gradient.addColorStop(0.6, 'rgba(100,100,100,0.7)');
    gradient.addColorStop(1, 'rgba(100,100,100,0.7)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    const gradentTexture = new CanvasTexture(canvas);
    gradentTexture.wrapS = RepeatWrapping;
    gradentTexture.wrapT = RepeatWrapping;
    const shape = new Shape;
    ([
      [0, 0.2],
      [0.5, 0.2],
      [0.5, 0.4],
      [1, 0],
      [0.5, -0.4],
      [0.5, -0.2],
      [0, -0.2],
    ]).forEach(i => shape.lineTo(i[0], i[1]));
    const material = new MeshBasicMaterial({color: 0x3cbbcf, transparent: true, map: gradentTexture});
    const arrow = new InstancedMesh(new ShapeGeometry(shape), material, 1024);
    arrow.count = 0;
    scene.add(arrow);
    sprites.arrow = {arrow:{
      instance: arrow,
      texture: gradentTexture,
    }};
  }
}

function initSprites() {
  loadedTextures.tiles = new Promise((res, rej) => {
    ktx2Loader.load(`${ASSET_PATH}/tiles.ktx2`, res, undefined, rej);
  });
  loadedTextures.items = new Promise((res, rej) => {
    ktx2Loader.load(`${ASSET_PATH}/items.ktx2`, res, undefined, rej);
  });
  loadedTextures.number = new Promise((res, rej) => {
    ktx2Loader.load(`${ASSET_PATH}/number.ktx2`, res, undefined, rej);
  });

  spritePromises.tiles = new Promise((res, rej) => initSprite(res, rej, 'tiles'));
  spritePromises.items = new Promise((res, rej) => initSprite(res, rej, 'items'));
  spritePromises.number = new Promise((res, rej) => initSprite(res, rej, 'number'));
}
async function initSprite(res, rej, name) {
  const result = await fetch(`${ASSET_PATH}/${name}.json`).then(r => r.json());
  const sizew = result.size.w, sizeh = result.size.h;
  const spriteMap = {};
  const baseTexture = await loadedTextures[name];
  for (const spriteName in result.frames) {
    const { x, y, w, h } = result.frames[spriteName];
    const tex = baseTexture.clone();
    tex.repeat.set(w / sizew, h / sizeh);
    tex.offset.set(x / w * tex.repeat.x, (sizeh - h - y) / h * tex.repeat.y);
    const geometry = new PlaneGeometry(1, 1);
    const material = new MeshBasicMaterial({
      map: tex,
      transparent: true,
    });
    const instance = new InstancedMesh(geometry, material, 1024);
    instance.count = 0;
    instance.name = `${name}/${spriteName}`;
    scene.add(instance);
    spriteMap[spriteName] = {
      instance,
      frame: result.frames[spriteName],
    };
  }
  sprites[name] = spriteMap;
  infoDiv.textContent = getLoadingDescription([], [name]);
  res();
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
  updateSprite(sprite);
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
function updateSprite(sprite) {
  sprite.instanceMatrix.needsUpdate = true;
  sprite.computeBoundingBox();
  sprite.computeBoundingSphere();
}

function render(now) {
  sprites.arrow.arrow.texture.offset.x = -now / 2000;
  renderer.render(scene, camera);
  checkIntersection();
  // rendererStats.update(renderer);
  // stats.update();
}
async function checkIntersection() {
  if (sprites.tiles) {
    raycaster.setFromCamera( mouse, camera );
    const intersect = raycaster.intersectObjects(Object.values(sprites.tiles).map(i => i.instance));
    if (intersect.length) {
      const obj = intersect[0].object;
      const id = intersect[0].instanceId;
      const matrix = new Matrix4;
      obj.getMatrixAt(id, matrix);
      const position = new Vector3;
      position.setFromMatrixPosition(matrix);
      renderTileInfo(position);
    } else {
      renderTileInfo(null);
    }
  }
}

function onWindowResize() {

  // camera.aspect = window.innerWidth / window.innerHeight;
  camera.left = -window.innerWidth / 200;
  camera.right = window.innerWidth / 200;
  camera.top = window.innerHeight / 200;
  camera.bottom = -window.innerHeight / 200;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);

  render();

}

function initMaps() {
  const maps = {
    20: '期末試験編',
  };

  const characterSelect = document.createElement('select');
  characterSelect.setAttribute('style', 'position:fixed;top:30px;left:10px');
  for (const mapId in maps) {
    const option = document.createElement('option');
    option.value = mapId;
    option.textContent = maps[mapId];
    characterSelect.appendChild(option);
  }
  characterSelect.value = 20;
  document.body.appendChild(characterSelect);
  characterSelect.addEventListener('change', () => {
    const mapId = characterSelect.value;
    loadMapInfo(mapId);
  });
  loadMapInfo(20);
}

let loadingSession = null;
const tileInfoMap = [];
async function loadMapInfo(id) {
  const currentLoadSession = Symbol('load');
  loadingSession = currentLoadSession;
  const mapEvent = await fetch(`${ASSET_PATH}/xml/mapevent${(id+'').padStart(4, '0')}/MapEvent.xml`)
    .then(r => r.text())
    .then(r => (new DOMParser()).parseFromString(r, 'text/xml'));
  const tiles = Array.from(mapEvent.getElementsByTagName('MapEventTileData'));

  await Promise.all(Object.values(spritePromises));

  infoDiv.textContent = getLoadingDescription([], ['map-info']);
  infoDiv.style.display = 'none';

  if (loadingSession !== currentLoadSession) return;
  tileInfoMap.length = 0;

  tiles.forEach(tile => {
    const tileInfo = parseTileInfo(tile);
    const tileId = tileInfo.TileID;
    tileInfoMap[tileId] = tileInfo;
  });
  renderTiles();

  console.log('tileInfoMap', tileInfoMap);
  const startingTile = tileInfoMap[1];
  camera.position.set(startingTile.CoordX, 50, -startingTile.CoordY);
  controls.target.set(startingTile.CoordX, 0, -startingTile.CoordY);
  controls.update();
}
function parseTileInfo(tile) {
  const info = {};
  for (const element of tile.children) {
    const key = element.tagName;
    switch (key) {
    case 'Reward': {
      info[key] = {
        'id': parseInt(element.querySelector('id').textContent),
        'str': element.querySelector('str').textContent
      };
      break;
    }
    case 'UnlockConditionTileID': {
      info[key] = Array.from(element.querySelectorAll('int')).map(i => parseInt(i.textContent));
      break;
    }
    default: {
      info[key] = element.textContent;
      if (info[key] === 'false') info[key] = false;
      if (info[key] === 'true') info[key] = true;
      if (parseInt(info[key]) + '' === info[key]) info[key] = parseInt(info[key]);
    }
    }
  }
  return info;
}
function renderTiles() {
  resetSprites();
  for (const tileInfo of tileInfoMap) {
    if (!tileInfo) continue;
    // 格子
    const hasContent = tileInfo.Reward.id !== 0
                    || tileInfo.UnlockKeyID !== 0
                    || tileInfo.RewardKeyID !== 0
                    || tileInfo.RewardScenarioID !== 0;
    const usingTile = sprites.tiles[hasContent ? 'tile_with_item' : 'tile_empty'];
    const x = tileInfo.CoordX;
    const y = -tileInfo.CoordY;
    const w = 0.5;
    const h = usingTile.frame.h / usingTile.frame.w * w;
    setSpriteVisible(usingTile, x, LAYERS.TILE, y, w, h);

    // 格子数
    const point = (tileInfo.Point + '').split('');
    for (const i in point) {
      const text = sprites.number['n'+point[i]];
      const textw = 0.2;
      const texth = text.frame.h / text.frame.w * textw;
      setSpriteVisible(text, x + 0.25 + i * 0.1, LAYERS.POINT_TEXT, y + 0.2, textw, texth);
    }

    // 解锁箭头
    for (const unlockId of tileInfo.UnlockConditionTileID) {
      const unlockTile = tileInfoMap[unlockId];
      if (!unlockTile) continue;
      const unlockX = unlockTile.CoordX;
      const unlockY = -unlockTile.CoordY;
      const arrow = sprites.arrow.arrow.instance;
      const idx = arrow.count++;
      const matrix = new Matrix4;

      const conditionTilePosition = new Vector3(unlockX, LAYERS.ARROW, unlockY);
      const currentTilePosition = new Vector3(x, LAYERS.ARROW, y);
      const arrowDirection = new Vector3().subVectors(currentTilePosition, conditionTilePosition);
      const scale = arrowDirection.length();
      arrowDirection.normalize();
      const rotation = new Quaternion();
      rotation.setFromUnitVectors(new Vector3(0, 0, 1), arrowDirection);
      rotation.multiply(new Quaternion().setFromEuler(new Euler(-Math.PI / 2, 0, -Math.PI / 2, 'XYZ')));
      const arrowStartPosition = conditionTilePosition.add(arrowDirection.multiplyScalar(0.5));

      matrix.compose(arrowStartPosition, rotation, new Vector3(scale - 1, 0.5, 1));
      arrow.setMatrixAt(idx, matrix);
      updateSprite(arrow);
    }

    // 物品
    if (tileInfo.UnlockKeyID) {
      const item = sprites.items['lock_'+tileInfo.UnlockKeyID];
      const itemw = 0.5;
      const itemh = item.frame.h / item.frame.w * itemw;
      setSpriteVisible(item, x, LAYERS.REWARD, y - 0.1, itemw, itemh);
    }
    if (tileInfo.RewardKeyID) {
      const item = sprites.items['key_'+tileInfo.RewardKeyID];
      const itemw = 0.5;
      const itemh = item.frame.h / item.frame.w * itemw;
      setSpriteVisible(item, x, LAYERS.REWARD, y - 0.1, itemw, itemh);
    }
    if (tileInfo.RewardScenarioID) {
      const item = sprites.items['reward_item'];
      const itemw = 0.5;
      const itemh = item.frame.h / item.frame.w * itemw;
      setSpriteVisible(item, x, LAYERS.REWARD, y - 0.1, itemw, itemh);
    }
    if (tileInfo.Reward.id) {
      const item = sprites.items[getRewardSprite(tileInfo.Reward)];
      const itemh = 0.4;
      const itemw = item.frame.w / item.frame.h * itemh;
      setSpriteVisible(item, x, LAYERS.REWARD, y - 0.1, itemw, itemh);
      if (tileInfo.RewardNum > 1) {
        const num = (tileInfo.RewardNum+'').split('');
        for (const i in num) {
          const text = sprites.number['n'+num[i]];
          const textw = 0.15;
          const texth = text.frame.h / text.frame.w * textw;
          setSpriteVisible(text, x + 0.2 + i * 0.08, LAYERS.REWARD, y - 0.3, textw, texth);
        }
      }
    }
  }
}
function getRewardSprite(reward) {
  const type = getRewardType(reward);
  const { id } = reward;
  switch (type) {
  case 'nameplate': return 'reward_item';
  case 'music': return 'reward_music';
  case 'card': return 'reward_item';
  case 'money': return 'reward_money';
  case 'kaika': return 'reward_kaika';
  case 'droplet': return 'reward_droplet';
  case 'levelup_item': return 'reward_item';
  case 'ticket': {
    switch (id) {
    case 4001004: return 'reward_ticket_ssr';
    }
    return 'reward_ticket_r';
  }
  case 'gift': {
    switch (id) {
    case 14000001: return 'reward_gift_1';
    case 14000002: return 'reward_gift_2';
    case 14000003: return 'reward_gift_3';
    }
    return 'reward_ticket_r';
  }
  default: {
    console.log(reward);
    return 'reward_item';
  }
  }
}
function getRewardType(reward) {
  const { id } = reward;
  const type = Math.floor(id / 1000000);
  switch (type) {
  case 1: return 'card';
  case 2: return 'nameplate';
  case 4: return 'ticket';
  case 6: return 'money';
  case 7: return 'music';
  case 12: return 'kaika';
  case 13: return 'levelup_item';
  case 14: return 'gift';
  case 21: return 'droplet';
  }
  return 'unknown';
}
const keyColor = ['', '红','蓝','黄','绿'];
const RewardTypes = {
  'card': '新卡',
  'nameplate': '名牌',
  'ticket': '突破票',
  'money': '金币',
  'music': '新歌',
  'kaika': '开花票',
  'levelup_item': '强化道具',
  'gift': '亲密度礼物',
  'droplet': '水滴',

  'unknown': '物品'
};
function renderTileInfo(pos) {
  if (!pos) {
    infoDiv.style.display = 'none';
    return;
  }
  const x = Math.round(pos.x), y = Math.round(-pos.z);
  const tileInfo = tileInfoMap.find(i => i && i.CoordX === x && i.CoordY === y);
  if (!tileInfo) {
    return;
  }
  calculateUnlockPoint(tileInfo);
  infoDiv.style.display = '';
  const text = [];
  text.push(`Tile @ (${x}, ${y})`);
  text.push(`Tile ID: ${tileInfo.TileID}`);
  text.push('');
  text.push(`点数: ${tileInfo.Point}`);
  text.push(`前置所需最少点数: ${tileInfo.unlockTotalPointBefore}`);
  text.push('');
  if (tileInfo.UnlockKeyID) {
    text.push(`需要${keyColor[tileInfo.UnlockKeyID]}钥匙`);
  }
  if (tileInfo.RewardKeyID) {
    text.push(`获得${keyColor[tileInfo.RewardKeyID]}钥匙`);
  }
  if (tileInfo.RewardScenarioID) {
    text.push(`解锁剧情 ${tileInfo.RewardScenarioID}`);
  }
  if (tileInfo.Reward.id) {
    const rewardType = getRewardType(tileInfo.Reward);
    const rewardName = RewardTypes[rewardType];
    text.push(`获得${rewardName}`);
    text.push(`${tileInfo.Reward.str} (${tileInfo.Reward.id}) x${tileInfo.RewardNum}`);
  }
  infoDiv.textContent = text.join('\n');
}
function calculateUnlockPoint(tile) {
  if (tile.unlockTotalPointBefore) return;
  if (tile.UnlockConditionTileID.length === 0) {
    tile.unlockTotalPointBefore = 0;
    tile.unlockTree = [];
    return;
  }
  if (!tile.UnlockKeyID) {
    const conditionTiles = tile.UnlockConditionTileID.map(i => tileInfoMap[i]);
    conditionTiles.map(calculateUnlockPoint);
    conditionTiles.sort((a, b) => a.unlockTotalPointBefore - b.unlockTotalPointBefore);
    const leastPointConditionTile = conditionTiles[0];
    tile.unlockTotalPointBefore = leastPointConditionTile.unlockTotalPointBefore + leastPointConditionTile.Point;
    tile.unlockTree = leastPointConditionTile.unlockTree.concat([leastPointConditionTile.TileID]);
    return;
  } else {
    // 这一格是锁，需要计算钥匙的最短树和锁前置的最短树，合并后计算总和
    const conditionTiles = tile.UnlockConditionTileID.map(i => tileInfoMap[i]);
    conditionTiles.map(calculateUnlockPoint);
    conditionTiles.sort((a, b) => a.unlockTotalPointBefore - b.unlockTotalPointBefore);
    const leastPointConditionTile = conditionTiles[0];
    const keyTile = tileInfoMap.find(i => i && i.RewardKeyID === tile.UnlockKeyID);
    calculateUnlockPoint(keyTile);
    const treeCombined = new Set();
    leastPointConditionTile.unlockTree.forEach(i => treeCombined.add(i));
    keyTile.unlockTree.forEach(i => treeCombined.add(i));
    let totalUnlockPoint = keyTile.Point;
    for (const i of treeCombined) {
      const tile = tileInfoMap[i];
      if (tile) totalUnlockPoint += tile.Point;
    }
    tile.unlockTotalPointBefore = totalUnlockPoint;
    tile.unlockTree = Array.from(treeCombined);
    return;
  }
}

init();
initMaps();
window.addEventListener('resize', onWindowResize);
