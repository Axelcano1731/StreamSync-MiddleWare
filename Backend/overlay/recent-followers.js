(function () {
  'use strict';
  const socket = io('http://localhost:3000');
  const MAX_FOLLOWERS = 8;
  const followers = [];

  socket.on('connect', () => {
    console.log('➕ Recent Followers widget connected');
  });

  socket.on('follow', (data) => {
    followers.unshift({
      uniqueId: data.uniqueId || 'unknown',
      profilePic: data.profilePic || null,
      time: Date.now(),
    });

    if (followers.length > MAX_FOLLOWERS) followers.pop();
    render();
  });

  function render() {
    const list = document.getElementById('follower-list');
    if (!list) return;

    list.innerHTML = '';

    if (followers.length === 0) {
      list.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,0.3);padding:16px;font-size:0.85em;">Esperando seguidores...</div>';
      return;
    }

    followers.forEach((f, i) => {
      const item = document.createElement('div');
      item.className = 'follower-item';
      item.style.animationDelay = `${i * 0.05}s`;

      const timeAgo = getTimeAgo(f.time);

      item.innerHTML = `
        <div class="user-avatar">${f.profilePic ? `<img src="${f.profilePic}" alt="">` : '👤'}</div>
        <div class="follower-name">@${f.uniqueId}</div>
        <div class="follower-time">${timeAgo}</div>
      `;

      list.appendChild(item);
    });
  }

  function getTimeAgo(ts) {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 5) return 'ahora';
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    return `${Math.floor(diff / 3600)}h`;
  }

  // Re-render every 10s to update times
  setInterval(render, 10000);
})();
