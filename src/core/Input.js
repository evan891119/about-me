import { PointerLockControls } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/controls/PointerLockControls.js';

export class Input {
  constructor() {
    this.forward = this.backward = this.left = this.right = false;
    this.sprinting = false;
    this.jump = false;
    this.flashlightToggleRequested = false;
    this.controls = null;
  }

  attach(camera) {
    this.controls = new PointerLockControls(camera, document.body);

    // 點擊 #blocker 進入鎖定，沒 blocker 就第一次點畫面
    const blocker = document.getElementById('blocker');
    if (blocker) {
      blocker.addEventListener('click', () => this.controls.lock());
      this.controls.addEventListener('lock', () => blocker.style.display = 'none');
      this.controls.addEventListener('unlock', () => blocker.style.display = 'flex');
    } else {
      document.body.addEventListener('click', () => this.controls.lock(), { once: true });
    }

    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);

    // 也避免拖曳選取
    document.addEventListener('mousedown', (e)=>{ if (e.button===0) e.preventDefault(); });
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
}
