(function () {
  'use strict';
  const socket = io();
  const MAX_ITEMS = 5;
  const likeMap = new Map();

  socket.on('connect', () => {
    console.log('❤️ Top Likes widget connected');
  });

  socket.on('like', (data) => {
    const user = data.uniqueId || 'unknown';
    const count = data.likeCount || 1;
    const prev = likeMap.get(user) || { uniqueId: user, totalLikes: 0, profilePic: data.profilePic };
    prev.totalLikes += count;
    prev.profilePic = data.profilePic || prev.profilePic;
    likeMap.set(user, prev);
    renderLeaderboard();
  });

  // Also listen for topLikersUpdate from backend
  socket.on('topLikersUpdate', (likers) => {
    if (Array.isArray(likers)) {
      likers.forEach(l => likeMap.set(l.uniqueId, l));
      renderLeaderboard();
    }
  });

  function renderLeaderboard() {
    const list = document.getElementById('leaderboard');
    if (!list) return;

    const sorted = Array.from(likeMap.values())
      .sort((a, b) => b.totalLikes - a.totalLikes)
      .slice(0, MAX_ITEMS);

    list.innerHTML = '';

    if (sorted.length === 0) {
      list.innerHTML = '<li style="text-align:center;color:rgba(255,255,255,0.3);padding:16px;font-size:0.85em;">Esperando likes...</li>';
      return;
    }

    sorted.forEach((user, i) => {
      const li = document.createElement('li');
      li.className = 'leaderboard-item animate-in';
      li.style.animationDelay = `${i * 0.08}s`;
      const rankClass = i < 3 ? `rank-${i + 1}` : 'rank-other';

      li.innerHTML = `
        <div class="rank ${rankClass}">${i + 1}</div>
        <div class="user-avatar">${user.profilePic ? `<img src="${user.profilePic}" alt="">` : '👤'}</div>
        <div class="user-info">
          <div class="user-name">@${user.uniqueId}</div>
        </div>
        <div class="stat-value likes">${formatNumber(user.totalLikes)} ❤️</div>
      `;

      list.appendChild(li);
    });
  }

  function formatNumber(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }
})();
