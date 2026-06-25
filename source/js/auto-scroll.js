(function () {
  const state = {
    speed: 0.2,
    active: false,
    rafId: null,
    panel: null,
    button: null,
    carry: 0,
    initialized: false
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function syncUI() {
    if (!state.panel || !state.button) return;
    state.button.classList.toggle('active', state.active);
    state.panel.classList.toggle('show', state.active);
    const speedText = state.panel.querySelector('[data-auto-scroll-speed]');
    if (speedText) speedText.textContent = `${state.speed.toFixed(1)}x`;
  }

  function stop() {
    state.active = false;
    state.carry = 0;
    if (state.rafId) cancelAnimationFrame(state.rafId);
    state.rafId = null;
    syncUI();
  }

  function step() {
    if (!state.active) return;

    const maxScrollTop = document.documentElement.scrollHeight - window.innerHeight;
    const current = window.scrollY || window.pageYOffset || 0;

    if (current >= maxScrollTop - 1) {
      stop();
      return;
    }

    state.carry += state.speed * (4 / 3);
    const delta = Math.floor(state.carry);
    if (delta > 0) {
      window.scrollTo(0, current + delta);
      state.carry -= delta;
    }
    state.rafId = requestAnimationFrame(step);
  }

  function start() {
    state.active = true;
    state.carry = 0;
    syncUI();
    if (state.rafId) cancelAnimationFrame(state.rafId);
    state.rafId = requestAnimationFrame(step);
  }

  function toggle() {
    if (state.active) stop();
    else start();
  }

  function buildPanel() {
    if (state.panel) return;

    const panel = document.createElement('div');
    panel.id = 'auto-scroll-panel';
    panel.innerHTML = `
      <div class="auto-scroll-panel-head">
        <span>自动滚动</span>
        <button type="button" class="auto-scroll-close" aria-label="关闭自动滚动">×</button>
      </div>
      <div class="auto-scroll-panel-body">
        <label class="auto-scroll-speed-row">
          <span>速度</span>
          <input type="range" min="0.1" max="2" step="0.1" value="${state.speed}">
          <strong data-auto-scroll-speed>${state.speed.toFixed(1)}x</strong>
        </label>
      </div>
    `;

    document.body.appendChild(panel);

    const speedInput = panel.querySelector('input[type="range"]');
    speedInput.addEventListener('input', (e) => {
      state.speed = clamp(Number(e.target.value), 0.1, 2);
      syncUI();
    });

    const closeBtn = panel.querySelector('.auto-scroll-close');
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      stop();
    });

    state.panel = panel;
    syncUI();
  }

  function init() {
    const button = document.getElementById('auto-scroll-btn');
    if (!button) return;

    state.button = button;
    buildPanel();
    if (state.initialized) {
      syncUI();
      return;
    }

    button.removeAttribute('onclick');
    button.addEventListener('click', (e) => {
      e.preventDefault();
      toggle();
    });
    button.title = '自动向下滚动';
    const icon = button.querySelector('i');
    if (icon) {
      icon.className = 'fas fa-angles-down';
    }

    state.initialized = true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('pjax:complete', init);
})();
