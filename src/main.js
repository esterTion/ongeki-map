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
  Mesh,
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

import './style.css';
import btnPlusSvg from './btn-plus.svg';
import btnMinusSvg from './btn-minus.svg';

const maps = {
  21: '修学旅行編',
  20: '期末試験編',
};
const initialMapId = 21;

Set.prototype.union ??= function (set) {
  const result = new Set(this);
  for (const item of set) result.add(item);
  return result;
};

// createElement
function _(e,t,i){var a=null;if("text"===e)return document.createTextNode(t);a=document.createElement(e);for(var n in t)if("style"===n)for(var o in t.style)a.style[o]=t.style[o];else if("className"===n)a.className=t[n];else if("event"===n)for(var o in t.event)a.addEventListener(o,t.event[o]);else a.setAttribute(n,t[n]);if(i)if("string"==typeof i)a.innerHTML=i;else if(Array.isArray(i))for(var l=0;l<i.length;l++)null!=i[l]&&a.appendChild(i[l]);return a;}

const ktx2Loader = new KTX2Loader();
ktx2Loader.setTranscoderPath('./script/');
ktx2Loader.init();

const ASSET_PATH = './assets';

const LAYERS = {
  SELECTBOX: -0.2,
  BELOW_ARROW: -0.15,
  ARROW: -0.1,
  ABOVE_ARROW: -0.05,
  TILE: 0,
  REWARD: 0.1,
  POINT_TEXT: 0.2,
};

let camera, scene, renderer, controls, selectBox;

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

const loadingItem = {};
function getLoadingDescription(adds, removes) {
  for (const add of adds) loadingItem[add] = true;
  for (const remove of removes) delete loadingItem[remove];
  return Object.keys(loadingItem).map(i => `Loading ${i}`).join('\n');
}
const infoDiv = _('div', { className: 'info-box' });
infoDiv.textContent = getLoadingDescription(['tiles', 'items', 'number', 'map-info'], []);
document.body.appendChild(infoDiv);

const rewardTypeSelect = _('select', { className: 'reward-select' }, [
  _('option', { value: 'all' }, [_('text', '所有奖励')])
]);
document.body.appendChild(rewardTypeSelect);

const zoomButtons = _('div', { className: 'zoom-button-group' }, [
  _('button', { event: { click: _ => { buttonZoom(1); } } }, [_('img', { src: btnPlusSvg })]),
  _('br'),
  _('button', { event: { click: _ => { buttonZoom(-1); } } }, [_('img', { src: btnMinusSvg })]),
]);
document.body.appendChild(zoomButtons);

// const stats = new Stats();
// document.body.appendChild( stats.dom );
// var rendererStats	= new THREEx.RendererStats()
// rendererStats.domElement.style.position	= 'absolute'
// rendererStats.domElement.style.left	= '0px'
// rendererStats.domElement.style.top	= '60px'
// rendererStats.domElement.style.transform = 'scale(2)'
// rendererStats.domElement.style.transformOrigin = '0 0'
// document.body.appendChild( rendererStats.domElement )

function buttonZoom(dir) {
  controls._updateZoomParameters(innerWidth / 2, innerHeight / 2);
  if (dir > 0) {
    controls._dollyIn(controls._getZoomScale(-300));
  } else {
    controls._dollyOut(controls._getZoomScale(300));
  }
  controls.update();
}

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

  {
    let moved = false;
    renderer.domElement.addEventListener('pointerdown', e => moved = false);
    renderer.domElement.addEventListener('pointermove', e => moved = true);
    renderer.domElement.addEventListener('pointerup', e => {
      if (moved) return;
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      checkIntersection();
    });
  }

  ktx2Loader.detectSupport(renderer);
  camera.position.set(0,50,0);

  controls = new MapControls(camera, renderer.domElement);
  controls.minDistance = 0.5;
  controls.maxDistance = 20;
  controls.zoomSpeed = 3;
  controls.panSpeed = 1.5;
  controls.enableDamping = false;
  controls.enableRotate = false;
  controls.autoRotate = false;
  controls.zoomToCursor = true;
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
    const gradientTexture = new CanvasTexture(canvas);
    gradientTexture.wrapS = RepeatWrapping;
    gradientTexture.wrapT = RepeatWrapping;
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
    const material = new MeshBasicMaterial({color: 0x3cbbcf, map: gradientTexture});
    const arrow = new InstancedMesh(new ShapeGeometry(shape), material, 1024);
    arrow.count = 0;
    scene.add(arrow);
    sprites.arrow = {arrow:{
      instance: arrow,
      texture: gradientTexture,
    }};
    const whiteMaterial = new MeshBasicMaterial({color: 0xFFFFFF, transparent: true, opacity: 1});
    const whiteArrow = new InstancedMesh(new ShapeGeometry(shape), whiteMaterial, 1024);
    whiteArrow.count = 0;
    scene.add(whiteArrow);
    sprites.arrow.arrowWhite = {
      instance: whiteArrow,
      material: whiteMaterial,
    };
  }
  {
    const shape = new Shape;
    const arcR = 0.3, arcR2 = 0.5, w = 0.5, h = 0.4;
    shape.moveTo(w, h - arcR);
    shape.arc(-arcR, 0, arcR, 0, Math.PI / 2);
    shape.lineTo(w - arcR, h - arcR + arcR2);
    shape.arc(0, -arcR2, arcR2, Math.PI / 2, 0, true);
    shape.lineTo(w, h - arcR);

    shape.moveTo(-w + arcR, h);
    shape.arc(0, -arcR, arcR, Math.PI / 2, Math.PI);
    shape.lineTo(-w + arcR - arcR2, h - arcR);
    shape.arc(arcR2, 0, arcR2, Math.PI, Math.PI / 2, true);
    shape.lineTo(-w + arcR, h);

    shape.moveTo(-w, -h + arcR);
    shape.arc(arcR, 0, arcR, Math.PI, Math.PI * 3 / 2);
    shape.lineTo(-w + arcR, -h + arcR - arcR2);
    shape.arc(0, arcR2, arcR2, Math.PI * 3 / 2, Math.PI, true);
    shape.lineTo(-w, -h + arcR);

    shape.moveTo(w - arcR, -h);
    shape.arc(0, arcR, arcR, Math.PI * 3 / 2, Math.PI * 2);
    shape.lineTo(w - arcR + arcR2, -h + arcR);
    shape.arc(-arcR2, 0, arcR2, Math.PI * 2, Math.PI * 3 / 2, true);
    shape.lineTo(w - arcR, -h);

    const material = new MeshBasicMaterial({color: 0x3cbbcf, transparent: true});
    selectBox = new Mesh(new ShapeGeometry(shape), material);
    selectBox.position.set(0, -1, 0);
    selectBox.visible = false;
    selectBox.lookAt(0, 0, 0);
    scene.add(selectBox);
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

let selectTime = 0;
function render(now) {
  sprites.arrow.arrow.texture.offset.x = -now / 2000;
  sprites.arrow.arrowWhite.material.opacity = Math.sin((now - selectTime) / 400) * 0.3 + 0.4;
  {
    const scale = (Math.cos((now - selectTime) / 200) + 1) * 0.04 + 0.55;
    selectBox.scale.set(scale, scale, scale);
  }
  renderer.render(scene, camera);
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

  const width = document.body.offsetWidth;
  const height = document.body.offsetHeight;

  // camera.aspect = width / height;
  camera.left = -width / 200;
  camera.right = width / 200;
  camera.top = height / 200;
  camera.bottom = -height / 200;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);

}

function initMaps() {
  const mapSelect = _('select', { className: 'map-select' });
  for (const mapId in maps) {
    const option = _('option');
    option.value = mapId;
    option.textContent = maps[mapId];
    mapSelect.appendChild(option);
  }
  mapSelect.value = initialMapId;
  document.body.appendChild(mapSelect);
  mapSelect.addEventListener('change', () => {
    const mapId = mapSelect.value;
    loadMapInfo(mapId);
  });
  loadMapInfo(initialMapId);

  rewardTypeSelect.appendChild(_('option', { value: 'story' }, [_('text', '剧情')]));
  for (const v in RewardTypes) {
    rewardTypeSelect.appendChild(_('option', { value: v }, [_('text', v === 'unknown' ? '其他物品' : RewardTypes[v])]));
  }
  rewardTypeSelect.addEventListener('change', renderTiles);
}

let loadingSession = null;
const tileInfoMap = [];
const mutualUnlockMap = {};
const unlockArrowMap = {};
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

  loadStoredState();
  finishedTiles[id] = finishedTiles[id] || new Set();
  finishedTiles.current = finishedTiles[id];

  tiles.forEach(tile => {
    const tileInfo = parseTileInfo(tile);
    const tileId = tileInfo.TileID;
    tileInfo.CanUnlockTileIDs = [];
    tileInfoMap[tileId] = tileInfo;
  });
  for (let id in mutualUnlockMap) {
    delete mutualUnlockMap[id];
  }
  Object.values(tileInfoMap).forEach(i => {
    mutualUnlockMap[i.TileID] = {};
    i.UnlockConditionTileID.forEach(j => {
      const t = tileInfoMap[j];
      if (t) {
        t.CanUnlockTileIDs.push(i.TileID);
        if (t.UnlockConditionTileID.includes(i.TileID)) {
          mutualUnlockMap[i.TileID][j] = true;
        }
      }
    });
  });
  calculateUnlockPointFromStart();
  renderTiles();
  renderTileInfo(null);

  console.log('tileInfoMap', tileInfoMap);
  const startingTile = finishedTiles.current.size ? (() => {
    const list = Array.from(finishedTiles.current);
    list.sort((b, a) => tileInfoMap[a].unlockTotalPointBefore + tileInfoMap[a].Point - (tileInfoMap[b].unlockTotalPointBefore + tileInfoMap[b].Point));
    return tileInfoMap[list[0]];
  })() : tileInfoMap[1];
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
  const filterType = rewardTypeSelect.value;
  const tilesFiltered = [];
  const colorBright = new Color('#FFFFFF');
  const colorDim = new Color('#AAAAAA');
  const colorDark = new Color('#444444');
  for (const tileInfo of tileInfoMap) {
    if (!tileInfo) continue;

    const showReward = filterType === 'all'
                    || (tileInfo.RewardScenarioID && filterType === 'story')
                    || (tileInfo.Reward.id && filterType === getRewardType(tileInfo.Reward));
    // 格子
    const hasContent = tileInfo.Reward.id !== 0
                    || tileInfo.RewardKeyID !== 0
                    || tileInfo.RewardScenarioID !== 0;
    const usingTile = sprites.tiles[finishedTiles.current.has(tileInfo.TileID) ? 'tile_visited' : hasContent ? 'tile_with_item' : 'tile_empty'];
    const x = tileInfo.CoordX;
    const y = -tileInfo.CoordY;
    const w = 0.5;
    const h = usingTile.frame.h / usingTile.frame.w * w;
    const tileTint = filterType !== 'all' ? colorDark : finishedTiles.current.has(tileInfo.TileID) ? colorBright : colorDim;
    usingTile.instance.setColorAt(usingTile.instance.count, tileTint);
    usingTile.instance.instanceColor.needsUpdate = true;
    setSpriteVisible(usingTile, x, LAYERS.TILE, y, w, h);
    tileInfo.usingTile = usingTile.instance;
    tileInfo.usingTileId = usingTile.instance.count - 1;
    if (filterType !== 'all' && showReward) tilesFiltered.push(tileInfo);

    // 格子数
    const point = (tileInfo.Point + '').split('');
    for (const i in point) {
      const text = sprites.number['n'+point[i]];
      const textw = 0.2;
      const texth = text.frame.h / text.frame.w * textw;
      setSpriteVisible(text, x + 0.25 + i * 0.1, LAYERS.POINT_TEXT, y + 0.2, textw, texth);
    }

    // 解锁箭头
    tileInfo.unlockArrows = [];
    for (const unlockId of tileInfo.UnlockConditionTileID) {
      const unlockTile = tileInfoMap[unlockId];
      if (!unlockTile) continue;
      const unlockX = unlockTile.CoordX;
      const unlockY = -unlockTile.CoordY;
      const arrow = sprites.arrow.arrow.instance;
      const arrowWhite = sprites.arrow.arrowWhite.instance;
      const idx = arrow.count++;
      arrowWhite.count++;
      const matrix = new Matrix4;

      const conditionTilePosition = new Vector3(unlockX, LAYERS.ARROW, unlockY);
      const currentTilePosition = new Vector3(x, LAYERS.ARROW, y);
      const arrowDirection = new Vector3().subVectors(currentTilePosition, conditionTilePosition);
      const scale = arrowDirection.length();
      arrowDirection.normalize();
      const rotation = new Quaternion();
      rotation.setFromUnitVectors(new Vector3(0, 0, 1), arrowDirection);
      rotation.multiply(new Quaternion().setFromEuler(new Euler(-Math.PI / 2, 0, -Math.PI / 2, 'XYZ')));
      const arrowPadding = scale <= 1 ? 0.3 : 0.5;

      // 双向解锁箭头置于中点
      if (mutualUnlockMap[tileInfo.TileID][unlockId]) {
        const mutualArrowStartPosition = new Vector3().addVectors(conditionTilePosition, arrowDirection.multiplyScalar(scale / 2));
        matrix.compose(mutualArrowStartPosition, rotation, new Vector3(scale/2 - arrowPadding, 0.5, 1));
      } else {
        const arrowStartPosition = new Vector3().addVectors(conditionTilePosition, arrowDirection.multiplyScalar(arrowPadding));
        matrix.compose(arrowStartPosition, rotation, new Vector3(scale - arrowPadding*2, 0.5, 1));
      }
      arrow.setMatrixAt(idx, matrix);
      arrow.setColorAt(idx, tileTint);
      arrow.instanceColor.needsUpdate = true;
      updateSprite(arrow);
      const whiteArrowPosition = new Vector3().setFromMatrixPosition(matrix);
      whiteArrowPosition.y = LAYERS.BELOW_ARROW;
      matrix.setPosition(whiteArrowPosition);
      arrowWhite.setMatrixAt(idx, matrix);
      updateSprite(arrowWhite);
      tileInfo.unlockArrows.push(idx);
      unlockArrowMap[unlockId*10000 + tileInfo.TileID] = idx;
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

    if (!showReward) continue;

    if (tileInfo.RewardScenarioID && (filterType === 'all' || filterType === 'story')) {
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

  let tilesToBrighten = new Set();
  for (const tile of tilesFiltered) {
    tilesToBrighten = tilesToBrighten.union(tile.unlockTree).union(new Set([tile.TileID]));
  }
  for (const tile of tilesToBrighten) {
    const tileInfo = tileInfoMap[tile];
    if (!tileInfo) continue;
    const usingTile = tileInfo.usingTile;
    const usingTileId = tileInfo.usingTileId;
    const tileTint = finishedTiles.current.has(tileInfo.TileID) ? colorBright : colorDim;
    usingTile.setColorAt(usingTileId, tileTint);
    usingTile.instanceColor.needsUpdate = true;
    for (const arrowId of tileInfo.unlockArrows) {
      const arrow = sprites.arrow.arrow.instance;
      arrow.setColorAt(arrowId, tileTint);
      arrow.instanceColor.needsUpdate = true;
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
  case 'medal': return 'reward_medal';
  case 'ssr_gacha_ticket': return 'reward_ssr_gacha_ticket';
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
    console.log(reward, type, Math.floor(reward.id / 1000000));
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
  case 15: return 'ssr_gacha_ticket';
  case 18: return 'medal';
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
  'medal': '奖章',
  'ssr_gacha_ticket': 'SSR确定书',

  'unknown': '物品'
};

const finishedTiles = {};
function loadStoredState() {
  const storedState = localStorage.getItem('finishedTiles');
  if (storedState) {
    const parsedState = JSON.parse(storedState);
    for (const mapId in parsedState) {
      const set = new Set(parsedState[mapId]);
      finishedTiles[mapId] = set;
    }
  }
}
function saveStoredState() {
  const store = {};
  for (const mapId in finishedTiles) {
    if (mapId === 'current') continue;
    const set = finishedTiles[mapId];
    store[mapId] = Array.from(set);
  }
  localStorage.setItem('finishedTiles', JSON.stringify(store));
}

let selectedTileId = null;
function renderMapInfo() {
  const totalPoint = tileInfoMap.reduce((acc, i) => acc + (i && i.Point || 0), 0);
  const finishedPoint = tileInfoMap.filter(i => i && finishedTiles.current.has(i.TileID)).reduce((acc, i) => acc + i.Point, 0);
  const text = [];
  text.push(`已完成点数：${finishedPoint}`);
  text.push(`剩余点数：${totalPoint - finishedPoint}`);
  text.push(`完成度：${(finishedPoint / totalPoint * 100).toFixed(2)}%`);
  text.push('');
  text.push(`点击格子查看信息`);
  infoDiv.textContent = text.join('\n');
}
function renderTileInfo(pos) {
  infoDiv.style.display = '';
  deleteSelectionTileUnlockPathEffect();
  if (!pos) {
    renderMapInfo();
    selectedTileId = null;
    selectBox.visible = false;
    return;
  }
  const x = Math.round(pos.x), y = Math.round(-pos.z);
  const tileInfo = tileInfoMap.find(i => i && i.CoordX === x && i.CoordY === y);
  if (!tileInfo) {
    return;
  }
  if (selectedTileId === tileInfo.TileID) {
    if (finishedTiles.current.has(selectedTileId)) {
      finishedTiles.current.delete(selectedTileId);
      Array.from(tileInfoMap.values()).forEach(i => {
        if (i && i.unlockTree.has(selectedTileId)) {
          finishedTiles.current.delete(i.TileID);
        }
      });
    } else {
      tileInfo.unlockTree.forEach(i => finishedTiles.current.add(i));
      finishedTiles.current.add(selectedTileId);
    }
    calculateUnlockPointFromStart();
    saveStoredState();
    renderTiles();
  }
  selectBox.visible = true;
  selectBox.position.set(tileInfo.CoordX, LAYERS.SELECTBOX, -tileInfo.CoordY);
  selectTime = performance.now();
  selectedTileId = tileInfo.TileID;
  infoDiv.style.display = '';
  const text = [];
  text.push(`Tile @ (${x}, ${y})`);
  text.push(`Tile ID: ${tileInfo.TileID}`);
  text.push('再次点击格子标记完成状态');
  text.push('');
  text.push(`点数: ${tileInfo.Point}`);
  const remainPoint = tileInfoMap.filter(i => i && (i === tileInfo || tileInfo.unlockTree.has(i.TileID)) && !finishedTiles.current.has(i.TileID)).reduce((acc, i) => acc + i.Point, 0);
  text.push(`解锁需要点数: ${remainPoint}`);
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
  setupSelectionTileUnlockPathEffect(tileInfo);
}

function calculateUnlockPointQueue(tiles) {
  const tileId = tiles.shift();
  const tile = tileInfoMap[tileId];
  if (!tile) return;
  if (tile.UnlockConditionTileID.length === 0) {
    tile.unlockTotalPointBefore = 0;
    tile.unlockTree = new Set();
    tile.unlockPath = new Set();
    tile.CanUnlockTileIDs.forEach(i => {
      tiles.push(i);
    });
    return;
  }
  let unlockPoint = Infinity;
  let unlockTree = null;
  let unlockPath = null;
  for (let prevId of tile.UnlockConditionTileID) {
    const prevTile = tileInfoMap[prevId];
    if (!prevTile || prevTile.unlockTotalPointBefore === undefined) {
      continue;
    }
    const point = finishedTiles.current.has(prevId) ? 0 : (prevTile.unlockTotalPointBefore + prevTile.Point);
    if (point < unlockPoint) {
      unlockPoint = point;
      unlockTree = prevTile.unlockTree.union(new Set([prevTile.TileID]));
      unlockPath = prevTile.unlockPath.union(new Set([prevTile.TileID * 10000 + tile.TileID]));
    }
  }
  if (tile.UnlockKeyID) {
    const keyTile = tileInfoMap.find(i => i && i.RewardKeyID === tile.UnlockKeyID);
    if (!keyTile) throw new Error('找不到钥匙格子', tile);
    if (keyTile.unlockTotalPointBefore === undefined) {
      tiles.push(tileId);
      return;
    }
    unlockPoint = (finishedTiles.current.has(keyTile.TileID) ? 0 : (keyTile.unlockTotalPointBefore + keyTile.Point)) + unlockPoint;
    unlockTree = keyTile.unlockTree.union(new Set([keyTile.TileID])).union(unlockTree);
    unlockPath = keyTile.unlockPath.union(new Set([keyTile.TileID * 10000 + tile.TileID])).union(unlockPath);
  }
  if (tile.unlockTotalPointBefore === undefined || unlockPoint < tile.unlockTotalPointBefore) {
    tile.unlockTotalPointBefore = unlockPoint;
    tile.unlockTree = unlockTree;
    tile.unlockPath = unlockPath;
    tile.CanUnlockTileIDs.forEach(i => {
      tiles.push(i);
    });
  }
  if (finishedTiles.current.has(tile.TileID)) {
    tile.unlockTotalPointBefore = 0;
  }
}
function calculateUnlockPointFromStart() {
  const tiles = [1];
  for (let tile of tileInfoMap) {
    if (!tile) continue;
    delete tile.unlockTotalPointBefore;
    delete tile.unlockTree;
  }
  while (tiles.length) {
    calculateUnlockPointQueue(tiles);
  }
}

const unlockPathLights = [];
function setupSelectionTileUnlockPathEffect(tile) {
  const unlockPath = tile.unlockPath;
  const arrowWhite = sprites.arrow.arrowWhite.instance;
  console.log(unlockPath);
  for (let path of unlockPath) {
    const arrowId = unlockArrowMap[path];
    const matrix = new Matrix4();
    arrowWhite.getMatrixAt(arrowId, matrix);
    const position = new Vector3().setFromMatrixPosition(matrix);
    position.y = LAYERS.ABOVE_ARROW;
    matrix.setPosition(position);
    arrowWhite.setMatrixAt(arrowId, matrix);
  }
  updateSprite(arrowWhite);
}
function deleteSelectionTileUnlockPathEffect() {
  const arrowWhite = sprites.arrow.arrowWhite.instance;
  for (let i = 0; i < arrowWhite.count; i++) {
    const matrix = new Matrix4();
    arrowWhite.getMatrixAt(i, matrix);
    const position = new Vector3().setFromMatrixPosition(matrix);
    position.y = LAYERS.BELOW_ARROW;
    matrix.setPosition(position);
    arrowWhite.setMatrixAt(i, matrix);
  }
  updateSprite(arrowWhite);
}

init();
initMaps();
window.addEventListener('resize', onWindowResize);
