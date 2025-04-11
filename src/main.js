import {
  Vector3,
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
} from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';

let camera, scene, renderer;

let requestRender = true
function requestRenderLoop() {
	if (requestRender) {
		// requestRender = false
		render()
	}
	requestAnimationFrame(requestRenderLoop)
}
requestAnimationFrame(requestRenderLoop)

function init() {
  camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
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

  {
    const gm = new SphereGeometry(5, 32, 16)
    const mat = new MeshBasicMaterial( { color: 0x00ff00, wireframe: true } )
    const sphere = new Mesh(gm, mat)
    sphere.position.set(0, 0, 0)
    scene.add(sphere)
    camera.lookAt(0,0,0)
    camera.position.set(0,7,0)
  }

	const controls = new MapControls(camera, renderer.domElement);
	controls.minDistance = 0.5;
	controls.maxDistance = 20;
	controls.zoomSpeed = 3;
	controls.panSpeed = 3;
	controls.rotateSpeed = 1.5;
	controls.target = new Vector3(0, 1, 0);
	controls.update()
	controls.addEventListener('change', () => requestRender = true);
}

function render() {
	renderer.render(scene, camera);
}

init();
