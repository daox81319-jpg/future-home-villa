import "./styles.css";

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { Sky } from "three/addons/objects/Sky.js";
import {
  Compass,
  Footprints,
  Maximize,
  Moon,
  Move3d,
  Sun,
  Sunrise,
  Sunset,
  createIcons,
} from "lucide";

createIcons({
  icons: {
    Compass,
    Footprints,
    Maximize,
    Moon,
    Move3d,
    Sun,
    Sunrise,
    Sunset,
  },
});

const canvas = document.querySelector("#villa-canvas");
const loading = document.querySelector("#loading");
const loadingLabel = document.querySelector("#loading-label");
const loadingProgress = document.querySelector("#loading-progress");
const statusText = document.querySelector("#status-text");
const timeText = document.querySelector("#time-text");
const placeEyebrow = document.querySelector("#place-eyebrow");
const placeTitle = document.querySelector("#place-title");
const placeCopy = document.querySelector("#place-copy");
const walkEntry = document.querySelector("#walk-entry");
const crosshair = document.querySelector("#crosshair");
const fullscreenButton = document.querySelector("#fullscreen-button");

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarsePointer = window.matchMedia("(pointer: coarse)").matches;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8c9a9e);
scene.fog = new THREE.FogExp2(0x8c9a9e, 0.0065);

const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 1000);
camera.position.set(34, 28, 42);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
window.__villaRenderer = renderer;
window.__villaCamera = camera;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.dampingFactor = 0.055;
orbit.minDistance = 2.2;
orbit.maxDistance = 95;
orbit.maxPolarAngle = Math.PI * 0.49;
orbit.target.set(0, 2.5, 0);

const pointer = new PointerLockControls(camera, renderer.domElement);
const movement = new Set();
let previousFrameTime = performance.now();
let model = null;
let mode = "tour";
let transition = null;
window.__villaMode = mode;
let sceneBounds = new THREE.Box3(
  new THREE.Vector3(-21, -1, -17),
  new THREE.Vector3(21, 10, 17),
);

const sky = new Sky();
sky.scale.setScalar(450000);
scene.add(sky);

const hemisphere = new THREE.HemisphereLight(0xb9ced7, 0x44392d, 1.8);
scene.add(hemisphere);

const sun = new THREE.DirectionalLight(0xffd4a1, 3.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 140;
sun.shadow.camera.left = -45;
sun.shadow.camera.right = 45;
sun.shadow.camera.top = 45;
sun.shadow.camera.bottom = -45;
sun.shadow.bias = -0.00035;
scene.add(sun);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(180, 180),
  new THREE.MeshStandardMaterial({ color: 0x202522, roughness: 1 }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -1.2;
floor.receiveShadow = true;
scene.add(floor);

const placeData = {
  aerial: {
    eyebrow: "四象总图",
    title: "全院鸟瞰",
    copy: "南向入院，前水后山，左右廊院围合成完整生活场域。",
    status: "全景导览",
  },
  entrance: {
    eyebrow: "南向礼序",
    title: "门楼与影壁",
    copy: "双扇木门收住入口，影壁让到达路径转折后再进入水院。",
    status: "入口导览",
  },
  courtyard: {
    eyebrow: "前照聚水",
    title: "半月荷池",
    copy: "开阔水面构成前院明堂，汀步与双廊把视线引向主楼。",
    status: "前院导览",
  },
  hall: {
    eyebrow: "家庭核心",
    title: "挑空大堂",
    copy: "两层挑空、木构梁柱与二层回廊共同组织会客和家庭活动。",
    status: "室内导览",
  },
  garden: {
    eyebrow: "玄武靠山",
    title: "后园叠水",
    copy: "假山、浅溪、松柏与月洞门围合出安静的北侧私家庭园。",
    status: "后园导览",
  },
};

const timePresets = {
  dawn: {
    label: "清晨",
    elevation: 8,
    azimuth: 82,
    sun: 0xffad72,
    sunIntensity: 2.0,
    hemi: 1.15,
    exposure: 0.9,
    fog: 0x9b9184,
  },
  day: {
    label: "日间",
    elevation: 42,
    azimuth: 138,
    sun: 0xffe4bd,
    sunIntensity: 3.2,
    hemi: 1.8,
    exposure: 1.05,
    fog: 0x8c9a9e,
  },
  dusk: {
    label: "黄昏",
    elevation: 5,
    azimuth: 252,
    sun: 0xff6f3a,
    sunIntensity: 2.4,
    hemi: 0.8,
    exposure: 0.82,
    fog: 0x6b5954,
  },
  night: {
    label: "夜景",
    elevation: -5,
    azimuth: 210,
    sun: 0x7695ba,
    sunIntensity: 0.18,
    hemi: 0.42,
    exposure: 0.68,
    fog: 0x17212a,
  },
};

const fallbackPresets = {
  aerial: {
    position: new THREE.Vector3(37, 38, 48),
    target: new THREE.Vector3(0, 2, 0),
  },
  entrance: {
    position: new THREE.Vector3(0, 4.2, 30),
    target: new THREE.Vector3(0, 1.4, 14),
  },
  courtyard: {
    position: new THREE.Vector3(13, 8.5, 12),
    target: new THREE.Vector3(0, 1.1, 7),
  },
  hall: {
    position: new THREE.Vector3(-3.2, 1.7, -0.4),
    target: new THREE.Vector3(0.3, 1.7, -4.2),
  },
  garden: {
    position: new THREE.Vector3(-12, 4.6, -10.8),
    target: new THREE.Vector3(-3.7, 1.2, -13.2),
  },
};

const cameraAnchors = {
  aerial: "CAM_Aerial",
  entrance: "CAM_Entrance",
  hall: "CAM_LivingHall",
  garden: "CAM_BackGarden",
};

const presets = {};

function presetFromCamera(name) {
  const anchor = model?.getObjectByName(name);
  if (!anchor) return null;
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  anchor.getWorldPosition(position);
  anchor.getWorldQuaternion(quaternion);
  const target = new THREE.Vector3(0, 0, -1)
    .applyQuaternion(quaternion)
    .multiplyScalar(12)
    .add(position);
  return { position, target };
}

function resolvePresets() {
  presets.aerial =
    presetFromCamera(cameraAnchors.aerial) ?? fallbackPresets.aerial;
  presets.entrance = fallbackPresets.entrance;
  presets.hall = fallbackPresets.hall;
  presets.garden = fallbackPresets.garden;
  const pond = model?.getObjectByName("MARKER_LotusPond");
  if (pond) {
    const target = new THREE.Vector3();
    pond.getWorldPosition(target);
    target.y += 0.8;
    presets.courtyard = {
      position: target.clone().add(new THREE.Vector3(11, 7, 13)),
      target,
    };
  } else {
    presets.courtyard = fallbackPresets.courtyard;
  }
}

function setPlace(key) {
  const data = placeData[key];
  if (!data) return;
  document.querySelectorAll(".location").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === key);
  });
  placeEyebrow.textContent = data.eyebrow;
  placeTitle.textContent = data.title;
  placeCopy.textContent = data.copy;
  statusText.textContent = data.status;
}

function flyTo(key, immediate = false) {
  const preset = presets[key] ?? fallbackPresets[key];
  if (!preset) return;
  setPlace(key);
  if (mode !== "tour") setMode("tour");
  const duration = immediate || reducedMotion ? 0 : 1.45;
  if (duration === 0) {
    camera.position.copy(preset.position);
    orbit.target.copy(preset.target);
    orbit.update();
    return;
  }
  transition = {
    startedAt: performance.now(),
    durationMs: duration * 1000,
    fromPosition: camera.position.clone(),
    fromTarget: orbit.target.clone(),
    toPosition: preset.position.clone(),
    toTarget: preset.target.clone(),
  };
}

function setTime(name) {
  const preset = timePresets[name];
  if (!preset) return;
  document.querySelectorAll(".time-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.time === name);
  });
  const phi = THREE.MathUtils.degToRad(90 - preset.elevation);
  const theta = THREE.MathUtils.degToRad(preset.azimuth);
  const skySun = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
  sky.material.uniforms.sunPosition.value.copy(skySun);
  sky.material.uniforms.turbidity.value = name === "night" ? 3 : 6;
  sky.material.uniforms.rayleigh.value = name === "night" ? 0.45 : 1.6;
  sky.material.uniforms.mieCoefficient.value = name === "dusk" ? 0.018 : 0.006;
  sky.material.uniforms.mieDirectionalG.value = 0.84;
  sun.position.copy(skySun).multiplyScalar(70);
  sun.color.setHex(preset.sun);
  sun.intensity = preset.sunIntensity;
  hemisphere.intensity = preset.hemi;
  renderer.toneMappingExposure = preset.exposure;
  scene.fog.color.setHex(preset.fog);
  timeText.textContent = preset.label;
  window.__villaTime = name;
  if (model?.userData.gardenLights) {
    const intensity = name === "night" ? 18 : name === "dusk" ? 7 : 0;
    model.userData.gardenLights.forEach((light) => {
      light.intensity = intensity;
    });
  }
}

function addGardenLights() {
  const positions = [
    [-4.7, 1.5, 10.2],
    [4.7, 1.5, 10.2],
    [-5.8, 1.5, 3],
    [5.8, 1.5, 3],
    [-8, 1.5, -11.2],
    [2.5, 1.5, -11.2],
    [11, 1.5, -11.5],
  ];
  model.userData.gardenLights = positions.map(([x, y, z]) => {
    const light = new THREE.PointLight(0xff9b45, 0, 7, 2);
    light.position.set(x, y, z);
    model.add(light);
    return light;
  });
}

function setMode(nextMode) {
  mode = nextMode;
  window.__villaMode = mode;
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === mode);
  });
  const walking = mode === "walk";
  orbit.enabled = !walking;
  walkEntry.classList.toggle("is-visible", walking && !pointer.isLocked);
  crosshair.classList.toggle("is-visible", walking && pointer.isLocked);
  canvas.style.cursor = walking ? "crosshair" : "grab";
  statusText.textContent = walking ? "自由漫游" : "全景导览";
  if (!walking && pointer.isLocked) pointer.unlock();

  if (walking && model) {
    const gate = model.getObjectByName("MARKER_Gate");
    const start = new THREE.Vector3(0, 1.65, 15.5);
    const target = new THREE.Vector3(0, 1.55, 8);
    if (gate) {
      gate.getWorldPosition(start);
      start.y = 1.65;
      start.z += 1.8;
      target.copy(start).add(new THREE.Vector3(0, -0.1, -7));
    }
    camera.position.copy(start);
    camera.lookAt(target);
  }
}

function tickTransition() {
  if (!transition) return;
  const raw = Math.min(
    (performance.now() - transition.startedAt) / transition.durationMs,
    1,
  );
  const eased = 1 - Math.pow(1 - raw, 3);
  camera.position.lerpVectors(
    transition.fromPosition,
    transition.toPosition,
    eased,
  );
  orbit.target.lerpVectors(transition.fromTarget, transition.toTarget, eased);
  if (raw === 1) transition = null;
}

function tickWalk(delta) {
  if (mode !== "walk" || !pointer.isLocked) return;
  const speed = movement.has("ShiftLeft") || movement.has("ShiftRight") ? 7 : 3.6;
  const step = speed * delta;
  if (movement.has("KeyW") || movement.has("ArrowUp")) pointer.moveForward(step);
  if (movement.has("KeyS") || movement.has("ArrowDown")) pointer.moveForward(-step);
  if (movement.has("KeyA") || movement.has("ArrowLeft")) pointer.moveRight(-step);
  if (movement.has("KeyD") || movement.has("ArrowRight")) pointer.moveRight(step);
  camera.position.x = THREE.MathUtils.clamp(
    camera.position.x,
    sceneBounds.min.x + 0.8,
    sceneBounds.max.x - 0.8,
  );
  camera.position.z = THREE.MathUtils.clamp(
    camera.position.z,
    sceneBounds.min.z + 0.8,
    sceneBounds.max.z - 0.8,
  );
  camera.position.y = 1.65;
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const delta = Math.min((now - previousFrameTime) / 1000, 0.05);
  previousFrameTime = now;
  tickTransition();
  tickWalk(delta);
  if (mode === "tour") orbit.update();
  renderer.render(scene, camera);
}

document.querySelectorAll(".location").forEach((button) => {
  button.addEventListener("click", () => flyTo(button.dataset.view));
});

document.querySelectorAll("[data-mode]").forEach((button) => {
  if (coarsePointer && button.dataset.mode === "walk") {
    button.hidden = true;
    return;
  }
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

document.querySelectorAll(".time-button").forEach((button) => {
  button.addEventListener("click", () => setTime(button.dataset.time));
});

walkEntry.addEventListener("click", () => pointer.lock());
renderer.domElement.addEventListener("dblclick", () => {
  if (mode === "walk" && !pointer.isLocked) pointer.lock();
});
pointer.addEventListener("lock", () => {
  walkEntry.classList.remove("is-visible");
  crosshair.classList.add("is-visible");
});
pointer.addEventListener("unlock", () => {
  crosshair.classList.remove("is-visible");
  walkEntry.classList.toggle("is-visible", mode === "walk");
});

fullscreenButton.addEventListener("click", async () => {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen();
  } else {
    await document.exitFullscreen();
  }
});

window.addEventListener("keydown", (event) => {
  movement.add(event.code);
});
window.addEventListener("keyup", (event) => {
  movement.delete(event.code);
});
window.addEventListener("resize", resize);

const loader = new GLTFLoader();
loader.load(
  "/models/future_home_villa.glb",
  (gltf) => {
    model = gltf.scene;
    model.name = "FutureHomeVilla";
    window.__villaModel = model;
    model.traverse((object) => {
      if (object.isLight) object.visible = false;
      if (!object.isMesh) return;
      object.geometry.computeBoundingSphere();
      object.castShadow =
        !coarsePointer && object.geometry.boundingSphere.radius > 0.16;
      object.receiveShadow = true;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      materials.filter(Boolean).forEach((material) => {
        material.envMapIntensity = 0.72;
        if (material.name.includes("Water")) {
          material.transparent = true;
          material.opacity = 0.74;
          material.roughness = 0.12;
        }
      });
    });
    scene.add(model);
    sceneBounds = new THREE.Box3().setFromObject(model);
    const center = sceneBounds.getCenter(new THREE.Vector3());
    sun.target.position.copy(center);
    scene.add(sun.target);
    resolvePresets();
    addGardenLights();
    setTime("day");
    flyTo("aerial", true);
    loadingProgress.style.width = "100%";
    loadingLabel.textContent = "院门已开";
    window.setTimeout(() => loading.classList.add("is-complete"), 260);
    window.__villaReady = true;
    window.__villaState = {
      bounds: {
        min: sceneBounds.min.toArray(),
        max: sceneBounds.max.toArray(),
      },
      meshes: renderer.info.render,
      locations: Object.keys(presets),
    };
  },
  (event) => {
    if (!event.total) return;
    const progress = Math.min((event.loaded / event.total) * 94, 94);
    loadingProgress.style.width = `${progress}%`;
    loadingLabel.textContent = `正在载入未来之家 ${Math.round(progress)}%`;
  },
  (error) => {
    console.error(error);
    loadingLabel.textContent = "三维模型载入失败";
    loadingLabel.classList.add("fatal-error");
  },
);

setTime("day");
resize();
animate();
