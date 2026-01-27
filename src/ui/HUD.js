export class HUD {
  constructor() {
    this.promptEl = null;
  }

  init() {
    const el = document.createElement('div');
    el.id = 'interaction-prompt';
    el.style.position = 'absolute';
    el.style.left = '50%';
    el.style.bottom = '10%';
    el.style.transform = 'translateX(-50%)';
    el.style.padding = '8px 12px';
    el.style.borderRadius = '8px';
    el.style.background = 'rgba(0, 0, 0, 0.55)';
    el.style.color = '#ffffff';
    el.style.fontFamily = 'sans-serif';
    el.style.fontSize = '14px';
    el.style.letterSpacing = '0.2px';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '6';
    el.style.display = 'none';
    document.body.appendChild(el);
    this.promptEl = el;
  }

  setPrompt(text) {
    if (!this.promptEl) return;
    if (!text) {
      this.promptEl.style.display = 'none';
      this.promptEl.textContent = '';
      return;
    }
    this.promptEl.textContent = text;
    this.promptEl.style.display = 'block';
  }
}
