(function () {
  'use strict';
  const socket = io();

  socket.on('connect', () => console.log('🎵 Now Playing widget connected'));

  socket.on('nowPlaying', (data) => {
    const widget = document.getElementById('now-playing');
    if (!widget) return;

    if (!data || !data.isPlaying) {
      widget.classList.add('hidden');
      return;
    }

    widget.classList.remove('hidden');

    const cover = document.getElementById('np-cover');
    const track = document.getElementById('np-track');
    const artist = document.getElementById('np-artist');
    const progress = document.getElementById('np-progress-fill');

    if (track) track.textContent = data.name || 'Desconocido';
    if (artist) artist.textContent = data.artist || 'Artista desconocido';

    if (cover && data.albumArt) {
      cover.innerHTML = `<img src="${data.albumArt}" alt="Album Art">`;
    } else if (cover) {
      cover.innerHTML = '🎵';
    }

    if (progress && data.duration > 0) {
      const percent = Math.min(100, (data.progress / data.duration) * 100);
      progress.style.width = `${percent}%`;
    }
  });
})();
