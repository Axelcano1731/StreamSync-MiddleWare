// services/statsTracker.js

/**
 * Stats Tracker — Tracks session statistics, top donors, top chatters
 */

let sessionData = {
  startTime: null,
  endTime: null,
  username: null,
  totals: {
    likes: 0,
    comments: 0,
    followers: 0,
    shares: 0,
    gifts: 0,
    diamonds: 0,
    viewers: 0,
    memberJoins: 0,
  },
  // Time-series data for charts (last 60 data points, 1 per 10s = 10 min window)
  timeline: [],
  timelineInterval: null,
};

// Track individual user contributions
const userStats = new Map();

// Snapshot counters for timeline
let snapshotCounters = {
  likes: 0,
  comments: 0,
  followers: 0,
  shares: 0,
  gifts: 0,
  diamonds: 0,
};

/**
 * Start a new tracking session
 */
export function startSession(username) {
  sessionData = {
    startTime: Date.now(),
    endTime: null,
    username,
    totals: {
      likes: 0, comments: 0, followers: 0,
      shares: 0, gifts: 0, diamonds: 0,
      viewers: 0, memberJoins: 0,
    },
    timeline: [],
    timelineInterval: null,
  };
  userStats.clear();
  resetSnapshotCounters();

  // Start timeline snapshots every 10 seconds
  sessionData.timelineInterval = setInterval(() => {
    takeSnapshot();
  }, 10000);

  console.log(`📊 Stats session started for @${username}`);
}

/**
 * End the current session
 */
export function endSession() {
  if (sessionData.timelineInterval) {
    clearInterval(sessionData.timelineInterval);
    sessionData.timelineInterval = null;
  }
  sessionData.endTime = Date.now();
  console.log('📊 Stats session ended');
}

/**
 * Take a snapshot of current counters for timeline
 */
function takeSnapshot() {
  sessionData.timeline.push({
    time: Date.now(),
    ...snapshotCounters,
  });

  // Keep last 60 data points
  if (sessionData.timeline.length > 60) {
    sessionData.timeline.shift();
  }

  resetSnapshotCounters();
}

function resetSnapshotCounters() {
  snapshotCounters = {
    likes: 0, comments: 0, followers: 0,
    shares: 0, gifts: 0, diamonds: 0,
  };
}

/**
 * Track an event
 */
export function trackEvent(eventType, data) {
  const userId = data.uniqueId || data.user?.uniqueId || 'unknown';

  // Track user stats
  if (!userStats.has(userId)) {
    userStats.set(userId, {
      uniqueId: userId,
      totalDiamonds: 0,
      totalGifts: 0,
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      lastSeen: Date.now(),
    });
  }

  const user = userStats.get(userId);
  user.lastSeen = Date.now();

  switch (eventType) {
    case 'like':
      const likeCount = data.likeCount || 1;
      sessionData.totals.likes += likeCount;
      snapshotCounters.likes += likeCount;
      user.totalLikes += likeCount;
      break;

    case 'chat':
      sessionData.totals.comments++;
      snapshotCounters.comments++;
      user.totalComments++;
      break;

    case 'follow':
      sessionData.totals.followers++;
      snapshotCounters.followers++;
      break;

    case 'share':
      sessionData.totals.shares++;
      snapshotCounters.shares++;
      user.totalShares++;
      break;

    case 'gift':
      const diamonds = data.diamondCount || 0;
      const repeatCount = data.repeatCount || 1;
      sessionData.totals.gifts += repeatCount;
      sessionData.totals.diamonds += (typeof diamonds === 'number' ? diamonds * repeatCount : 0);
      snapshotCounters.gifts += repeatCount;
      snapshotCounters.diamonds += (typeof diamonds === 'number' ? diamonds * repeatCount : 0);
      user.totalGifts += repeatCount;
      user.totalDiamonds += (typeof diamonds === 'number' ? diamonds * repeatCount : 0);
      break;

    case 'memberJoin':
      sessionData.totals.memberJoins++;
      break;

    case 'roomUser':
      if (data.viewerCount) {
        sessionData.totals.viewers = data.viewerCount;
      }
      break;
  }
}

/**
 * Get top donors (by diamonds)
 */
export function getTopDonors(limit = 10) {
  return Array.from(userStats.values())
    .filter(u => u.totalDiamonds > 0)
    .sort((a, b) => b.totalDiamonds - a.totalDiamonds)
    .slice(0, limit);
}

/**
 * Get top chatters
 */
export function getTopChatters(limit = 10) {
  return Array.from(userStats.values())
    .filter(u => u.totalComments > 0)
    .sort((a, b) => b.totalComments - a.totalComments)
    .slice(0, limit);
}

/**
 * Get session summary
 */
export function getSessionSummary() {
  const duration = sessionData.endTime
    ? sessionData.endTime - sessionData.startTime
    : sessionData.startTime
      ? Date.now() - sessionData.startTime
      : 0;

  return {
    username: sessionData.username,
    startTime: sessionData.startTime,
    endTime: sessionData.endTime,
    durationMs: duration,
    totals: { ...sessionData.totals },
    topDonors: getTopDonors(5),
    topChatters: getTopChatters(5),
    uniqueUsers: userStats.size,
  };
}

/**
 * Get timeline data for charts
 */
export function getTimeline() {
  return [...sessionData.timeline];
}

/**
 * Get all current stats
 */
export function getAllStats() {
  return {
    session: getSessionSummary(),
    timeline: getTimeline(),
    topDonors: getTopDonors(10),
    topChatters: getTopChatters(10),
  };
}
