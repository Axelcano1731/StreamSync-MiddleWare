// StreamSync Overlay — Client-side JS for OBS Browser Source
// Connects to backend via Socket.IO and renders alerts

(function () {
  'use strict';

  const BACKEND_URL = 'http://localhost:3000';
  const socket = io(BACKEND_URL + '/overlay');

  let config = {};
  let alertQueue = [];
  let activeAlerts = 0;
  const MAX_ALERTS = 3;
  const MAX_CHAT = 15;

  // ── Icon Map ──
  const ICONS = {
    gift: '🎁',
    follow: '➕',
    share: '↪️',
    like: '❤️',
    memberJoin: '👋',
    chat: '💬',
  };

  // ── Socket Events ──
  socket.on('connect', () => {
    console.log('🎨 Overlay connected to backend');
  });

  socket.on('config', (cfg) => {
    config = cfg;
    updateGoalTracker();
    updateChatBoxVisibility();
  });

  socket.on('alert', (alertEvent) => {
    if (alertEvent.config?.showOverlay) {
      queueAlert(alertEvent);
    }
  });

  // Also listen for chat in the overlay namespace to show chat box
  // The main namespace emits these, but overlay gets alerts through the engine
  // We connect to main namespace too for raw events
  const mainSocket = io(BACKEND_URL);

  mainSocket.on('chat', (data) => {
    addChatMessage(data);
  });

  mainSocket.on('alertConfig', (cfg) => {
    config = cfg;
    updateGoalTracker();
  });

  // ── Alert Queue ──
  function queueAlert(alertEvent) {
    const maxAlerts = config?.overlay?.maxAlerts || MAX_ALERTS;
    if (activeAlerts < maxAlerts) {
      showAlert(alertEvent);
    } else {
      alertQueue.push(alertEvent);
    }
  }

  function processQueue() {
    const maxAlerts = config?.overlay?.maxAlerts || MAX_ALERTS;
    while (alertQueue.length > 0 && activeAlerts < maxAlerts) {
      const next = alertQueue.shift();
      showAlert(next);
    }
  }

  // ── Render Alert ──
  function showAlert(alertEvent) {
    const container = document.getElementById('alert-container');
    if (!container) return;

    activeAlerts++;
    const animation = alertEvent.config?.animation || 'slideIn';
    const duration = alertEvent.config?.duration || 5000;
    const type = alertEvent.type;
    const data = alertEvent.data;

    // Build card
    const card = document.createElement('div');
    card.className = `alert-card ${type} alert-enter-${animation}`;

    // Icon or gift image
    let iconHtml = '';
    if (type === 'gift' && data.giftImage) {
      iconHtml = `<img class="alert-gift-img" src="${data.giftImage}" alt="${data.giftName || 'gift'}" />`;
    } else {
      iconHtml = `<span class="alert-icon">${ICONS[type] || '🔔'}</span>`;
    }

    // Content
    const username = data.uniqueId || 'Unknown';
    let message = '';
    let badge = '';

    switch (type) {
      case 'gift':
        message = `Envió ${data.repeatCount || 1}× ${data.giftName || 'Regalo'}`;
        badge = data.diamondCount ? `${data.diamondCount} 💎` : '';
        break;
      case 'follow':
        message = 'Comenzó a seguirte';
        break;
      case 'share':
        message = 'Compartió el directo';
        break;
      case 'like':
        message = `Envió ${data.likeCount || 1} likes`;
        break;
      case 'memberJoin':
        message = 'Se unió al directo';
        break;
      default:
        message = '';
    }

    card.innerHTML = `
      ${iconHtml}
      <div class="alert-content">
        <div class="alert-username">@${username}</div>
        <div class="alert-message">${message}</div>
      </div>
      ${badge ? `<div class="alert-badge">${badge}</div>` : ''}
    `;

    container.appendChild(card);

    // Play sound if configured
    if (alertEvent.config?.sound) {
      playSound(alertEvent.config.sound, alertEvent.config.volume || 0.5);
    }

    // Remove after duration
    setTimeout(() => {
      card.className = `alert-card ${type} alert-exit-${animation}`;
      setTimeout(() => {
        card.remove();
        activeAlerts--;
        processQueue();
      }, 500);
    }, duration);
  }

  // ── Sound Player ──
  function playSound(soundFile, volume) {
    try {
      const audio = new Audio(`${BACKEND_URL}/sounds/${soundFile}`);
      audio.volume = Math.max(0, Math.min(1, volume));
      audio.play().catch(() => {}); // Ignore autoplay errors
    } catch (e) {
      console.warn('Sound error:', e);
    }
  }

  // ── Chat Box ──
  function addChatMessage(data) {
    const chatBox = document.getElementById('chat-box');
    const chatMessages = document.getElementById('chat-messages');
    if (!chatBox || !chatMessages) return;

    chatBox.classList.remove('hidden');

    const msg = document.createElement('div');
    msg.className = 'chat-msg';
    msg.innerHTML = `<span class="chat-user">@${data.uniqueId || 'user'}</span>${escapeHtml(data.comment || '')}`;

    chatMessages.appendChild(msg);

    // Keep only last N messages
    while (chatMessages.children.length > MAX_CHAT) {
      chatMessages.removeChild(chatMessages.firstChild);
    }

    // Auto scroll
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function updateChatBoxVisibility() {
    const chatBox = document.getElementById('chat-box');
    if (chatBox && config?.alerts?.chat?.showOverlay) {
      chatBox.classList.remove('hidden');
    }
  }

  // ── Goal Tracker ──
  function updateGoalTracker() {
    const tracker = document.getElementById('goal-tracker');
    if (!tracker || !config?.goals) return;

    // Find first active goal
    const goals = config.goals;
    let activeGoal = null;
    let goalKey = null;

    for (const [key, goal] of Object.entries(goals)) {
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
      const labels = { likes: '❤️ Likes', followers: '➕ Seguidores', gifts: '🎁 Regalos', diamonds: '💎 Diamantes' };
      title.textContent = labels[goalKey] || 'Meta';
    }
  }

  // ── Utility ──
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
})();
