import React, { useEffect, useState } from "react";
import { useSpeech } from "../hooks/useSpeech";
import { VoiceSettings } from "./VoiceSettings";
import socket from "../services/socketService";

export default function LiveComments() {
  const [username, setUsername] = useState("");
  const [connected, setConnected] = useState(false);
  const { voices, selectedVoice, setSelectedVoice, enabled, toggleEnabled, speak } =
    useSpeech();

  useEffect(() => {
    socket.on("chatMessage", (msg) => {
      if (msg.comment) {
        // 🧹 Limpia el mensaje para evitar repetir el nombre del usuario
        const cleanText = msg.comment
          .replace(/^@\w+\s*/, "") // elimina @usuario si viene al inicio
          .replace(/^.*?\bdice\b\s*/i, "") // elimina "Axel dice", "Pedro dice", etc.
          .trim();

        if (cleanText.length > 0) {
          speak(cleanText);
        }
      }
    });

    socket.on("status", (status) => {
      setConnected(status.status === "online");
    });

    return () => {
      socket.off("chatMessage");
      socket.off("status");
    };
  }, [speak]);

  const handleConnect = () => {
    if (!username.trim()) return;
    socket.emit("joinStream", username.trim());
  };

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-bold mb-2">Interacciones en Tiempo Real</h1>
      <p className="text-gray-400 mb-6">
        Las interacciones se muestran en tiempo real en las siguientes categorías.
      </p>

      <VoiceSettings
        voices={voices}
        selectedVoice={selectedVoice}
        setSelectedVoice={setSelectedVoice}
        enabled={enabled}
        toggleEnabled={toggleEnabled}
      />

      <div className="flex flex-wrap gap-3 items-center mt-6">
        <input
          type="text"
          placeholder="Usuario de TikTok"
          className="border border-gray-700 bg-gray-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <button
          onClick={handleConnect}
          className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-lg transition-all duration-300 shadow-md shadow-pink-500/20"
        >
          Conectar
        </button>
        <span
          className={`text-sm ml-2 ${
            connected ? "text-green-400" : "text-red-500"
          }`}
        >
          {connected ? "Conectado" : "Desconectado"}
        </span>
      </div>
    </div>
  );
}
