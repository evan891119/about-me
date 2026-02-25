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

    this.onBlockerClick = () => this.controls?.lock();
    this.onControlsLock = () => {
      if (this.blocker) this.blocker.style.display = 'none';
    };
    this.onControlsUnlock = () => {
      if (this.blocker) this.blocker.style.display = 'flex';
    };
    this.onBodyClick = () => this.controls?.lock();
    this.onMouseDownPreventDefault = (e) => {
      if (e.button === 0) e.preventDefault();
    };
  }

  attach(camera) {
    this.controls = new PointerLockControls(camera, document.body);

    // 點擊 #blocker 進入鎖定，沒 blocker 就第一次點畫面
    this.blocker = document.getElementById('blocker');
    if (this.blocker) {
      this.blocker.addEventListener('click', this.onBlockerClick);
      this.controls.addEventListener('lock', this.onControlsLock);
      this.controls.addEventListener('unlock', this.onControlsUnlock);
    } else {
      document.body.addEventListener('click', this.onBodyClick, { once: true });
    }

    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);

    // 也避免拖曳選取
    document.addEventListener('mousedown', this.onMouseDownPreventDefault);
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
