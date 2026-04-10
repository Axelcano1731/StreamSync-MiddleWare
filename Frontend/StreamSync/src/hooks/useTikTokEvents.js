// hooks/useTikTokEvents.js
import { useEffect, useState, useCallback } from "react";
import socket from "../services/socketService";

const USERNAME_KEY = "tiktokUsername";

export function useTikTokEvents() {
  const [events, setEvents] = useState({
    follows: [],
    likes: [],
    gifts: [],
    chats: [],
    shares: [],
    memberJoins: [],
  });

  const [username, setUsername] = useState(
    localStorage.getItem(USERNAME_KEY) || ""
  );
  const [status, setStatus] = useState("offline");

  const [liveStats, setLiveStats] = useState({
    likes: 0,
    comments: 0,
    followers: 0,
    shares: 0,
    gifts: 0,
    viewers: 0,
  });

  const [topDonors, setTopDonors] = useState([]);

  // Handle new events with timestamp
  const handleNewEvent = useCallback((data, key) => {
    const eventWithTime = { ...data, _time: Date.now() };
    setEvents((prev) => ({
      ...prev,
      [key]: [eventWithTime, ...prev[key]].slice(0, 50),
    }));
  }, []);

  // Socket event listeners
  useEffect(() => {
    socket.on("like", (data) => {
      handleNewEvent(data, "likes");
      setLiveStats((prev) => ({
        ...prev,
        likes: prev.likes + (data.likeCount || 1),
      }));
    });

    socket.on("chat", (data) => {
      handleNewEvent(data, "chats");
      setLiveStats((prev) => ({ ...prev, comments: prev.comments + 1 }));
    });

    socket.on("follow", (data) => {
      handleNewEvent(data, "follows");
      setLiveStats((prev) => ({ ...prev, followers: prev.followers + 1 }));
    });

    socket.on("share", (data) => {
      handleNewEvent(data, "shares");
      setLiveStats((prev) => ({ ...prev, shares: prev.shares + 1 }));
    });

    socket.on("gift", (data) => {
      handleNewEvent(data, "gifts");
      setLiveStats((prev) => ({ ...prev, gifts: prev.gifts + 1 }));
    });

    socket.on("memberJoin", (data) => {
      handleNewEvent(data, "memberJoins");
    });

    socket.on("roomUser", (data) => {
      setLiveStats((prev) => ({
        ...prev,
        viewers: data.viewerCount || prev.viewers,
      }));
    });

    socket.on("status", (data) => {
      setStatus(data.status);
      if (data.status === "error") {
        console.error("Connection error:", data.message);
      }
    });

    return () => {
      socket.off("like");
      socket.off("chat");
      socket.off("follow");
      socket.off("share");
      socket.off("gift");
      socket.off("memberJoin");
      socket.off("roomUser");
      socket.off("status");
    };
  }, [handleNewEvent]);

  // Periodically fetch top donors
  useEffect(() => {
    if (status !== "online") return;

    const fetchDonors = () => {
      socket.emit("getTopDonors", (donors) => {
        if (Array.isArray(donors)) setTopDonors(donors);
      });
    };

    fetchDonors();
    const interval = setInterval(fetchDonors, 10000);
    return () => clearInterval(interval);
  }, [status]);

  const connectToTikTok = useCallback(() => {
    if (!username.trim()) return;

    localStorage.setItem(USERNAME_KEY, username.trim());
    socket.emit("disconnectFromTikTok");

    // Reset state
    setEvents({
      follows: [],
      likes: [],
      gifts: [],
      shares: [],
      chats: [],
      memberJoins: [],
    });
    setLiveStats({
      likes: 0,
      comments: 0,
      followers: 0,
      shares: 0,
      gifts: 0,
      viewers: 0,
    });
    setTopDonors([]);

    socket.emit("connectToTikTok", username.trim());
  }, [username]);

  const disconnectFromTikTok = useCallback(() => {
    socket.emit("disconnectFromTikTok");
    setStatus("offline");
    setEvents({
      follows: [],
      likes: [],
      gifts: [],
      shares: [],
      chats: [],
      memberJoins: [],
    });
    setLiveStats({
      likes: 0,
      comments: 0,
      followers: 0,
      shares: 0,
      gifts: 0,
      viewers: 0,
    });
    setTopDonors([]);
  }, []);

  return {
    username,
    setUsername,
    events,
    liveStats,
    status,
    topDonors,
    connectToTikTok,
    disconnectFromTikTok,
  };
}
