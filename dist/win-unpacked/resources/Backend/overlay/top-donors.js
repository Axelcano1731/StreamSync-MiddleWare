(function () {
  'use strict';
  const socket = io();
  const MAX_ITEMS = 5;

  // Poll top donors every 5s
  function fetchDonors() {
    socket.emit('getTopDonors', (donors) => {
      if (Array.isArray(donors)) renderLeaderboard(donors);
    });
  }

  function renderLeaderboard(donors) {
    const list = document.getElementById('leaderboard');
    if (!list) return;

    const top = donors.slice(0, MAX_ITEMS);
    list.innerHTML = '';

    if (top.length === 0) {
      list.innerHTML = '<li style="text-align:center;color:rgba(255,255,255,0.3);padding:16px;font-size:0.85em;">Esperando donaciones...</li>';
      return;
    }

    top.forEach((donor, i) => {
      const li = document.createElement('li');
      li.className = 'leaderboard-item animate-in';
      li.style.animationDelay = `${i * 0.08}s`;

      const rankClass = i < 3 ? `rank-${i + 1}` : 'rank-other';

      li.innerHTML = `
        <div class="rank ${rankClass}">${i + 1}</div>
        <div class="user-avatar">${donor.profilePic ? `<img src="${donor.profilePic}" alt="">` : '👤'}</div>
        <div class="user-info">
          <div class="user-name">@${donor.uniqueId}</div>
          <div class="user-stat">${donor.totalGifts || 0} regalos</div>
        </div>
        <div class="stat-value diamonds">${donor.totalDiamonds} 💎</div>
      `;

      list.appendChild(li);
    });
  }

  socket.on('connect', () => {
    console.log('🏆 Top Donors widget connected');
    fetchDonors();
  });

  socket.on('topDonorsUpdate', (donors) => {
    if (Array.isArray(donors)) renderLeaderboard(donors);
  });

  setInterval(fetchDonors, 5000);
})();
