import { PointerLockControls } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/controls/PointerLockControls.js';

export class Input {
  constructor() {
    this.forward = this.backward = this.left = this.right = false;
    this.sprinting = false;
    this.jump = false;
    this.flashlightToggleRequested = false;
    this.showcaseToggleRequested = false;
    this.controls = null;
    this.blocker = null;
    this.camera = null;
    this.usePointerLock = true;
    this.isFallbackActive = false;
    this.isDraggingLook = false;
    this.yaw = 0;
    this.pitch = 0;
    this.lookSensitivity = 0.0025;

    this.onBlockerClick = () => this.enterLookMode();
    this.onControlsLock = () => {
      if (this.blocker) this.blocker.style.display = 'none';
    };
    this.onControlsUnlock = () => {
      if (this.blocker) this.blocker.style.display = 'flex';
    };
    this.onBodyClick = () => this.enterLookMode();
    this.onMouseDownPreventDefault = (e) => {
      if (e.button === 0) e.preventDefault();
      if (!this.isFallbackActive || e.button !== 0) return;
      this.isDraggingLook = true;
    };
    this.onMouseMove = (e) => {
      if (!this.isFallbackActive || !this.isDraggingLook || !this.camera) return;
      this.yaw -= e.movementX * this.lookSensitivity;
      this.pitch -= e.movementY * this.lookSensitivity;
      const maxPitch = Math.PI / 2 - 0.01;
      this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
      this.camera.rotation.set(this.pitch, this.yaw, 0);
    };
    this.onMouseUp = () => {
      this.isDraggingLook = false;
    };
  }

  attach(camera) {
    this.camera = camera;
    this.camera.rotation.order = 'YXZ';
    this.yaw = camera.rotation.y;
    this.pitch = camera.rotation.x;
    const params = new URLSearchParams(window.location.search);
    this.usePointerLock = !params.has('noPointerLock') && 'pointerLockElement' in document;
    this.controls = new PointerLockControls(camera, document.body);

    // 點擊 #blocker 進入鎖定，沒 blocker 就第一次點畫面
    this.blocker = document.getElementById('blocker');
    if (this.blocker) {
      if (!this.usePointerLock) {
        this.blocker.querySelector('p:last-child').textContent =
          '操作說明：W/A/S/D 移動，按住滑鼠左鍵拖曳轉視角，Space 跳躍，E 切換手電筒，V 展示鏡頭';
      }
      this.blocker.addEventListener('click', this.onBlockerClick);
      if (this.usePointerLock) {
        this.controls.addEventListener('lock', this.onControlsLock);
        this.controls.addEventListener('unlock', this.onControlsUnlock);
      }
    } else {
      document.body.addEventListener('click', this.onBodyClick, { once: true });
    }

    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);

    // 也避免拖曳選取
    document.addEventListener('mousedown', this.onMouseDownPreventDefault);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
  }

  enterLookMode() {
    if (this.usePointerLock) {
      this.controls?.lock();
      return;
    }

    this.isFallbackActive = true;
    if (this.blocker) this.blocker.style.display = 'none';
  }

  onKeyDown = (e) => {
    if (e.repeat) return;
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': this.forward = true; break;
      case 'KeyS': case 'ArrowDown': this.backward = true; break;
      case 'KeyA': case 'ArrowLeft': this.left = true; break;
      case 'KeyD': case 'ArrowRight': this.right = true; break;
      case 'ShiftLeft': case 'ShiftRight': this.sprinting = true; break;
      case 'Space': this.jump = true; break;
      case 'KeyE': this.flashlightToggleRequested = true; break;
      case 'KeyV': this.showcaseToggleRequested = true; break;
    }
  }

  onKeyUp = (e) => {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': this.forward = false; break;
      case 'KeyS': case 'ArrowDown': this.backward = false; break;
      case 'KeyA': case 'ArrowLeft': this.left = false; break;
      case 'KeyD': case 'ArrowRight': this.right = false; break;
      case 'ShiftLeft': case 'ShiftRight': this.sprinting = false; break;
    }
  }

  consumeFlashlightToggle() {
    if (!this.flashlightToggleRequested) return false;
    this.flashlightToggleRequested = false;
    return true;
  }

  consumeShowcaseToggle() {
    if (!this.showcaseToggleRequested) return false;
    this.showcaseToggleRequested = false;
    return true;
  }

  dispose() {
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('mousedown', this.onMouseDownPreventDefault);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
    document.body.removeEventListener('click', this.onBodyClick);

    if (this.blocker) {
      this.blocker.removeEventListener('click', this.onBlockerClick);
    }

    if (this.controls) {
      this.controls.removeEventListener('lock', this.onControlsLock);
      this.controls.removeEventListener('unlock', this.onControlsUnlock);
    }
  }
}
