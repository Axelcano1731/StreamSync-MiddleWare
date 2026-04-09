(function () {
  'use strict';

  const BACKEND_URL = 'http://localhost:3000';
  const overlaySocket = io(`${BACKEND_URL}/overlay`);
  const mainSocket = io(BACKEND_URL);
  const params = new URLSearchParams(window.location.search);
  const requestedPresetId = params.get('preset');

  const ICONS = {
    gift: '🎁',
    follow: '➕',
    share: '↪️',
    like: '❤️',
    memberJoin: '👋',
    chat: '💬',
  };

  const MAX_CHAT = 15;
  const DEFAULT_PRESET = {
    accentColor: '#7c3aed',
    theme: 'dark',
    backgroundStyle: 'glass',
    position: 'top-right',
    maxAlerts: 3,
    showChatBox: true,
    showGoalTracker: true,
    chatPlacement: 'bottom-left',
    goalPlacement: 'bottom-center',
  };

  let config = {};
  let activePreset = { ...DEFAULT_PRESET };
  let alertQueue = [];
  let activeAlerts = 0;
  let customStyleTag = null;

  overlaySocket.on('connect', () => {
    console.log('Overlay connected to backend');
  });

  overlaySocket.on('config', (cfg) => {
    config = cfg || {};
    activePreset = getActivePreset();
    applyOverlayAppearance();
  });

  overlaySocket.on('alert', (alertEvent) => {
    if (alertEvent.config?.showOverlay) {
      queueAlert(alertEvent);
    }
  });

  mainSocket.on('chat', (data) => {
    addChatMessage(data);
  });

  mainSocket.on('alertConfig', (cfg) => {
    config = cfg || {};
    activePreset = getActivePreset();
    applyOverlayAppearance();
  });

  mainSocket.on('goalProgress', (goals) => {
    config.goals = goals || {};
    updateGoalTracker();
  });

  function getActivePreset() {
    const presets = config.overlay?.presets || [];
    return (
      presets.find((preset) => preset.id === requestedPresetId) ||
      presets.find((preset) => preset.id === config.overlay?.defaultPresetId) ||
      presets[0] ||
      DEFAULT_PRESET
    );
  }

  function queueAlert(alertEvent) {
    const maxAlerts = activePreset?.maxAlerts || config?.overlay?.maxAlerts || DEFAULT_PRESET.maxAlerts;
    if (activeAlerts < maxAlerts) {
      showAlert(alertEvent);
    } else {
      alertQueue.push(alertEvent);
    }
  }

  function processQueue() {
    const maxAlerts = activePreset?.maxAlerts || config?.overlay?.maxAlerts || DEFAULT_PRESET.maxAlerts;
    while (alertQueue.length > 0 && activeAlerts < maxAlerts) {
      showAlert(alertQueue.shift());
    }
  }

  function showAlert(alertEvent) {
    const container = document.getElementById('alert-container');
    if (!container) return;

    activeAlerts += 1;

    const animation = alertEvent.config?.animation || 'slideIn';
    const duration = Math.max(1500, alertEvent.config?.duration || 4000);
    const type = alertEvent.type;
    const data = alertEvent.data || {};
    const title = escapeHtml(alertEvent.title || `@${data.uniqueId || 'streamsync'}`);
    const message = escapeHtml(alertEvent.message || '');

    const card = document.createElement('div');
    card.className = `alert-card ${type} alert-enter-${animation}`;

    let iconHtml = '';
    if (type === 'gift' && data.giftImage) {
      iconHtml = `<img class="alert-gift-img" src="${data.giftImage}" alt="${escapeHtml(data.giftName || 'gift')}" />`;
    } else {
      iconHtml = `<span class="alert-icon">${ICONS[type] || '🔔'}</span>`;
    }

    const badge =
      type === 'gift' && data.diamondCount
        ? `<div class="alert-badge">${escapeHtml(String(data.diamondCount))} 💎</div>`
        : '';

    card.innerHTML = `
      ${iconHtml}
      <div class="alert-content">
        <div class="alert-title">${title}</div>
        <div class="alert-message">${message}</div>
      </div>
      ${badge}
    `;

    container.appendChild(card);

    if (alertEvent.config?.sound) {
      playSound(alertEvent.config.sound, alertEvent.config.volume || 0.5);
    }

    setTimeout(() => {
      card.className = `alert-card ${type} alert-exit-${animation}`;
      setTimeout(() => {
        card.remove();
        activeAlerts -= 1;
        processQueue();
      }, 450);
    }, duration);
  }

  function playSound(soundFile, volume) {
    try {
      const audio = new Audio(`${BACKEND_URL}/sounds/${soundFile}`);
      audio.volume = Math.max(0, Math.min(1, volume));
      audio.play().catch(() => {});
    } catch (error) {
      console.warn('Sound error:', error);
    }
  }

  function addChatMessage(data) {
    const chatBox = document.getElementById('chat-box');
    const chatMessages = document.getElementById('chat-messages');

    if (!chatBox || !chatMessages || !shouldShowChatBox()) {
      return;
    }

    chatBox.classList.remove('hidden');

    const message = document.createElement('div');
    message.className = 'chat-msg';
    message.innerHTML = `
      <span class="chat-user">@${escapeHtml(data.uniqueId || 'user')}</span>
      <span>${escapeHtml(data.comment || '')}</span>
    `;

    chatMessages.appendChild(message);

    while (chatMessages.children.length > MAX_CHAT) {
      chatMessages.removeChild(chatMessages.firstChild);
    }

    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function shouldShowChatBox() {
    return Boolean(activePreset?.showChatBox || config?.alerts?.chat?.showOverlay);
  }

  function shouldShowGoalTracker() {
    return Boolean(activePreset?.showGoalTracker);
  }

  function updateChatBoxVisibility() {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return;

    chatBox.classList.toggle('hidden', !shouldShowChatBox());
  }

  function updateGoalTracker() {
    const tracker = document.getElementById('goal-tracker');
    if (!tracker || !config?.goals || !shouldShowGoalTracker()) {
      if (tracker) tracker.classList.add('hidden');
      return;
    }

    let activeGoal = null;
    let goalKey = null;

    for (const [key, goal] of Object.entries(config.goals)) {
      if (goal.enabled && goal.target > 0) {
        activeGoal = goal;
        goalKey = key;
        break;
      }
    }

    if (!activeGoal) {
      tracker.classList.add('hidden');
      return;
    }

    tracker.classList.remove('hidden');

    const fill = document.getElementById('goal-fill');
    const text = document.getElementById('goal-text');
    const title = document.querySelector('.goal-title');
    const percent = Math.min(100, (activeGoal.current / activeGoal.target) * 100);

    if (fill) fill.style.width = `${percent}%`;
    if (text) text.textContent = `${activeGoal.current} / ${activeGoal.target}`;

    if (title) {
      const labels = {
        likes: '❤️ Likes',
        followers: '➕ Seguidores',
        gifts: '🎁 Regalos',
        diamonds: '💎 Diamantes',
      };
      title.textContent = labels[goalKey] || 'Meta';
    }
  }

  function applyOverlayAppearance() {
    const preset = activePreset || DEFAULT_PRESET;

    document.body.dataset.theme = preset.theme || 'dark';
    document.body.dataset.background = preset.backgroundStyle || 'glass';
    document.documentElement.style.setProperty('--overlay-accent', preset.accentColor || DEFAULT_PRESET.accentColor);

    applyPlacement(document.getElementById('alert-container'), preset.position || DEFAULT_PRESET.position);
    applyPlacement(document.getElementById('chat-box'), preset.chatPlacement || DEFAULT_PRESET.chatPlacement);
    applyPlacement(document.getElementById('goal-tracker'), preset.goalPlacement || DEFAULT_PRESET.goalPlacement);

    if (!customStyleTag) {
      customStyleTag = document.createElement('style');
      customStyleTag.id = 'streamsync-overlay-custom-css';
      document.head.appendChild(customStyleTag);
    }

    customStyleTag.textContent = config.overlay?.customCSS || '';

    updateChatBoxVisibility();
    updateGoalTracker();
  }

  function applyPlacement(element, placement) {
    if (!element) return;

    const style = {
      top: 'auto',
      right: 'auto',
      bottom: 'auto',
      left: 'auto',
      transform: 'none',
      alignItems: 'stretch',
    };

    switch (placement) {
      case 'top-left':
        style.top = '20px';
        style.left = '20px';
        style.alignItems = 'flex-start';
        break;
      case 'top-center':
        style.top = '20px';
        style.left = '50%';
        style.transform = 'translateX(-50%)';
        style.alignItems = 'center';
        break;
      case 'top-right':
        style.top = '20px';
        style.right = '20px';
        style.alignItems = 'flex-end';
        break;
      case 'bottom-left':
        style.bottom = '20px';
        style.left = '20px';
        style.alignItems = 'flex-start';
        break;
      case 'bottom-center':
        style.bottom = '20px';
        style.left = '50%';
        style.transform = 'translateX(-50%)';
        style.alignItems = 'center';
        break;
      case 'bottom-right':
        style.bottom = '20px';
        style.right = '20px';
        style.alignItems = 'flex-end';
        break;
      case 'center':
        style.top = '50%';
        style.left = '50%';
        style.transform = 'translate(-50%, -50%)';
        style.alignItems = 'center';
        break;
      default:
        style.top = '20px';
        style.right = '20px';
        style.alignItems = 'flex-end';
        break;
    }

    Object.assign(element.style, style);

    if (element.id === 'alert-container') {
      element.style.alignItems = style.alignItems;
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text || '');
    return div.innerHTML;
  }
})();
