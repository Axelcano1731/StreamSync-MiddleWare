// hooks/useTikTokEvents.js
import { useEffect, useState } from "react";
import socket from "../services/socketService";

const USERNAME_KEY = "tiktokUsername";

export function useTikTokEvents() {
  const [events, setEvents] = useState({
    follows: [],
    likes: [],
    gifts: [],
    chats: [],
    shares: [],
  });

  const [username, setUsername] = useState(localStorage.getItem(USERNAME_KEY) || "");
  const [status, setStatus] = useState("offline");

  const [liveStats, setLiveStats] = useState({
    likes: 0,
    comments: 0,
    followers: 0,
    shares: 0,
    gifts: 0,
  });

  const handleNewEvent = (data, type) => {
    setEvents((prev) => ({
      ...prev,
      [`${type}s`]: [data, ...prev[`${type}s`]].slice(0, 20),
    }));
  };

  // Conectar eventos del socket
  useEffect(() => {
    socket.on("like", (data) => {
      handleNewEvent(data, "like");
      setLiveStats((prev) => ({ ...prev, likes: prev.likes + data.likeCount }));
    });

    socket.on("chat", (data) => {
      handleNewEvent(data, "chat");
      setLiveStats((prev) => ({ ...prev, comments: prev.comments + 1 }));
    });

    socket.on("follow", (data) => {
      handleNewEvent(data, "follow");
      setLiveStats((prev) => ({ ...prev, followers: prev.followers + 1 }));
    });

    socket.on("share", (data) => {
      handleNewEvent(data, "share");
      setLiveStats((prev) => ({ ...prev, shares: prev.shares + 1 }));
    });

    socket.on("gift", (data) => {
      handleNewEvent(data, "gift");
      setLiveStats((prev) => ({ ...prev, gifts: prev.gifts + 1 }));
    });

    socket.on("status", (data) => {
      setStatus(data.status);
      if (data.status === "error") {
        alert(`Error: ${data.message}`);
      }
    });

    return () => {
      socket.off("like");
      socket.off("chat");
      socket.off("follow");
      socket.off("share");
      socket.off("gift");
      socket.off("status");
    };
  }, []);

  const connectToTikTok = () => {
    if (!username.trim()) {
      alert("Por favor, ingresa un nombre de usuario.");
      return;
    }

    localStorage.setItem(USERNAME_KEY, username.trim());
    socket.emit("disconnectFromTikTok");

    setEvents({ follows: [], likes: [], gifts: [], shares: [], chats: [] });
    setLiveStats({ likes: 0, comments: 0, followers: 0, shares: 0, gifts: 0 });

    socket.emit("connectToTikTok", username.trim());
  };

  const disconnectFromTikTok = () => {
    socket.emit("disconnectFromTikTok");
    setStatus("offline");
    setEvents({ follows: [], likes: [], gifts: [], shares: [], chats: [] });
    setLiveStats({ likes: 0, comments: 0, followers: 0, shares: 0, gifts: 0 });
  };

  return {
    username,
    setUsername,
    events,
    liveStats,
    status,
    connectToTikTok,
    disconnectFromTikTok,
  };
}
