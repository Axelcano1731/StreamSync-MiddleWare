// services/spotifyService.js
// Spotify integration using Authorization Code Flow with PKCE
// User only needs a free Client ID from developer.spotify.com

import crypto from 'crypto';

let spotifyState = {
  accessToken: null,
  refreshToken: null,
  expiresAt: 0,
  clientId: null,
  redirectUri: 'http://localhost:3000/api/spotify/callback',
  codeVerifier: null,
  isConnected: false,
  currentTrack: null,
};

// PKCE helpers
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

async function generateCodeChallenge(verifier) {
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return hash.toString('base64url');
}

/**
 * Initialize Spotify with a client ID
 */
export function setClientId(clientId) {
  spotifyState.clientId = clientId;
}

export function setRedirectUri(uri) {
  spotifyState.redirectUri = uri;
}

/**
 * Get the authorization URL for Spotify OAuth PKCE flow
 */
export async function getAuthUrl(clientId) {
  spotifyState.clientId = clientId;
  spotifyState.codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(spotifyState.codeVerifier);

  const scopes = [
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
  ].join(' ');

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: spotifyState.redirectUri,
    scope: scopes,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    state: crypto.randomBytes(16).toString('hex'),
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function handleCallback(code) {
  if (!spotifyState.clientId || !spotifyState.codeVerifier) {
    throw new Error('Missing client ID or code verifier');
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: spotifyState.clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: spotifyState.redirectUri,
      code_verifier: spotifyState.codeVerifier,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Token exchange failed: ${err}`);
  }

  const data = await response.json();
  spotifyState.accessToken = data.access_token;
  spotifyState.refreshToken = data.refresh_token;
  spotifyState.expiresAt = Date.now() + data.expires_in * 1000;
  spotifyState.isConnected = true;
  spotifyState.codeVerifier = null;

  console.log('🎵 Spotify connected successfully');
  return true;
}

/**
 * Refresh the access token
 */
async function refreshAccessToken() {
  if (!spotifyState.refreshToken || !spotifyState.clientId) return false;

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: spotifyState.clientId,
        grant_type: 'refresh_token',
        refresh_token: spotifyState.refreshToken,
      }),
    });

    if (!response.ok) {
      spotifyState.isConnected = false;
      return false;
    }

    const data = await response.json();
    spotifyState.accessToken = data.access_token;
    if (data.refresh_token) spotifyState.refreshToken = data.refresh_token;
    spotifyState.expiresAt = Date.now() + data.expires_in * 1000;
    return true;
  } catch (err) {
    console.error('Spotify refresh error:', err);
    spotifyState.isConnected = false;
    return false;
  }
}

/**
 * Make an authenticated Spotify API request
 */
async function spotifyRequest(endpoint, options = {}) {
  if (!spotifyState.isConnected) return null;

  // Refresh token if expired
  if (Date.now() >= spotifyState.expiresAt - 60000) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) return null;
  }

  const url = endpoint.startsWith('http') ? endpoint : `https://api.spotify.com/v1${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${spotifyState.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (response.status === 204) return {}; // No content (success)
    if (!response.ok) {
      console.warn(`Spotify API error: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (err) {
    console.error('Spotify request error:', err);
    return null;
  }
}

/**
 * Get currently playing track
 */
export async function getCurrentTrack() {
  const data = await spotifyRequest('/me/player/currently-playing');
  if (!data || !data.item) {
    spotifyState.currentTrack = null;
    return null;
  }

  const track = {
    isPlaying: data.is_playing,
    name: data.item.name,
    artist: data.item.artists.map(a => a.name).join(', '),
    album: data.item.album.name,
    albumArt: data.item.album.images[0]?.url || null,
    duration: data.item.duration_ms,
    progress: data.progress_ms,
    uri: data.item.uri,
  };

  spotifyState.currentTrack = track;
  return track;
}

/**
 * Search for a track and play it
 */
export async function searchAndPlay(query) {
  const searchResult = await spotifyRequest(`/search?q=${encodeURIComponent(query)}&type=track&limit=1`);
  if (!searchResult?.tracks?.items?.length) return null;

  const track = searchResult.tracks.items[0];

  await spotifyRequest('/me/player/play', {
    method: 'PUT',
    body: JSON.stringify({ uris: [track.uri] }),
  });

  return {
    name: track.name,
    artist: track.artists.map(a => a.name).join(', '),
    albumArt: track.album.images[0]?.url || null,
  };
}

/**
 * Skip to next track
 */
export async function skipTrack() {
  await spotifyRequest('/me/player/next', { method: 'POST' });
  // Wait a moment then get current track
  await new Promise(r => setTimeout(r, 500));
  return await getCurrentTrack();
}

/**
 * Pause/Resume playback
 */
export async function togglePlayback() {
  const current = await getCurrentTrack();
  if (!current) return null;

  if (current.isPlaying) {
    await spotifyRequest('/me/player/pause', { method: 'PUT' });
  } else {
    await spotifyRequest('/me/player/play', { method: 'PUT' });
  }

  return await getCurrentTrack();
}

/**
 * Get connection status
 */
export function getSpotifyStatus() {
  return {
    isConnected: spotifyState.isConnected,
    currentTrack: spotifyState.currentTrack,
    clientId: spotifyState.clientId ? '***' + spotifyState.clientId.slice(-4) : null,
  };
}

/**
 * Disconnect Spotify
 */
export function disconnectSpotify() {
  spotifyState = {
    ...spotifyState,
    accessToken: null,
    refreshToken: null,
    expiresAt: 0,
    isConnected: false,
    currentTrack: null,
  };
  console.log('🎵 Spotify disconnected');
}
