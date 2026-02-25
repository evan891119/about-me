import WebGL from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/capabilities/WebGL.js';

import { App } from './src/core/App.js';
import { Loop } from './src/core/Loop.js';
import { Input } from './src/core/Input.js';
import { Physics } from './src/physics/Physics.js';
import { PHYSICS } from './src/config.js';

import { StaticColliderSystem } from './src/systems/StaticColliderSystem.js';
import { DoorSystem } from './src/systems/DoorSystem.js';
import { SkySystem } from './src/systems/SkySystem.js';
import { InteractionSystem } from './src/systems/InteractionSystem.js';
import { FlashlightSystem } from './src/systems/FlashlightSystem.js';
import { PlayerController } from './src/player/PlayerController.js';
import { buildWorld } from './src/world/WorldBuilder.js';
import { HUD } from './src/ui/HUD.js';

if (!WebGL.isWebGLAvailable()) {
  const warning = WebGL.getWebGLErrorMessage();
  warning.style.position = 'absolute';
  warning.style.top = '0';
  warning.style.left = '0';
  document.body.appendChild(warning);
} else {
  init();
}

async function init() {
  // Core
  const app = new App();
  app.init();

  const loop = new Loop({
    fixedTimeStep: PHYSICS.fixedTimeStep,
    maxSubSteps: PHYSICS.maxSubSteps,
  });

  const physics = new Physics();
  await physics.init();

  const input = new Input();
  input.attach(app.camera);
  // ★ 把 PointerLockControls 的 3D 物件加到場景（否則看不到相機的位置變化）
  app.scene.add(input.controls.getObject());

  const hud = new HUD();
  hud.init();

  // World（只產生 Mesh 與 metadata）
    const { collidableMeshes, doors, streetLights } = await buildWorld(app.scene, {
    maxAnisotropy: app.renderer.capabilities.getMaxAnisotropy()
    });

    const sky = new SkySystem(app.scene, {
    lat: 25.0330,
    lon: 121.5654,
    streetLights
    });

  // 靜態碰撞
  const staticCols = new StaticColliderSystem(physics, collidableMeshes);
  staticCols.init();

  // Player（內部會建立 KCC 與 capsule collider）
  const player = new PlayerController(physics, app.camera, input);

  // 手電筒（E 切換）
  const flashlight = new FlashlightSystem(app.scene, app.camera, input);

  // 門系統
  const doorSystem = new DoorSystem(physics);
  if (typeof doorSystem.registerDoors === 'function') {
    doorSystem.registerDoors(doors);
  } else {
    doors.forEach(d => doorSystem.registerDoor(d.mesh, d.pivot));
  }

  // 射線互動（點門）
  const doorMeshes = doors.map((d) => d.mesh);
  const interaction = new InteractionSystem(app.camera, player.rb, doorSystem, doorMeshes, hud);

  // 固定步進：玩家 -> 門 -> 物理
  loop.addFixed({ update: dt => player.update(dt) });
  loop.addFixed({ update: dt => doorSystem.update(dt) });
  loop.addFixed({ update: (dt) => physics.step(dt) });

  // 每幀更新：輸入/互動/天空/渲染
  loop.addFrame({ update: () => flashlight.update() });
  loop.addFrame({ update: () => interaction.update() });
  loop.addFrame({ update: (dt) => sky.update(dt) });
  loop.addFrame({ update: () => app.render() });

  loop.tick();
}
