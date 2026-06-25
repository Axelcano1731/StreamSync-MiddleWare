(function () {
  'use strict';
  const socket = io();
  const MAX_ITEMS = 30;
  const events = [];

  const ICONS = {
    chat: '💬', gift: '🎁', follow: '➕',
    share: '↪️', like: '❤️', memberJoin: '👋',
  };

  const LABELS = {
    chat: 'comentó', gift: 'regaló', follow: 'siguió',
    share: 'compartió', like: 'dio likes', memberJoin: 'se unió',
  };

  socket.on('connect', () => console.log('⚡ Ticker connected'));

  function addEvent(type, data) {
    let detail = '';
    switch (type) {
      case 'chat': detail = `"${(data.comment || '').slice(0, 40)}"`; break;
      case 'gift': detail = `${data.repeatCount || 1}× ${data.giftName || 'regalo'}`; break;
      case 'like': detail = `${data.likeCount || 1} likes`; break;
      default: break;
    }

    events.unshift({
      type,
      user: data.uniqueId || 'user',
      detail,
      time: Date.now(),
    });

    if (events.length > MAX_ITEMS) events.pop();
    render();
  }

  socket.on('chat', (d) => addEvent('chat', d));
  socket.on('gift', (d) => addEvent('gift', d));
  socket.on('follow', (d) => addEvent('follow', d));
  socket.on('share', (d) => addEvent('share', d));
  socket.on('like', (d) => addEvent('like', d));
  socket.on('memberJoin', (d) => addEvent('memberJoin', d));

  function render() {
    const track = document.getElementById('ticker-track');
    if (!track || events.length === 0) return;

    // Duplicate items for seamless loop
    const items = [...events, ...events];
    track.innerHTML = items.map(e =>
      `<span class="ticker-item">
        <span class="ticker-icon">${ICONS[e.type] || '🔔'}</span>
        <span class="ticker-user">@${e.user}</span>
        ${LABELS[e.type] || ''} ${e.detail}
      </span>`
    ).join('');

    // Reset animation
    track.style.animation = 'none';
    track.offsetHeight; // force reflow
    const duration = Math.max(15, items.length * 2);
    track.style.animation = `ticker-scroll ${duration}s linear infinite`;
  }
})();
