// context/StickerSoundsContext.jsx
//
// Estado global de los sonidos de stickers. Vive a nivel de App (montado una
// sola vez) para que los sonidos suenen y los stickers/regalos se recolecten
// SIN IMPORTAR qué página esté abierta. El panel solo consume este estado para
// pintar la UI y configurar.
import React, { useEffect, useRef, useState } from "react";
import socket from "../services/socketService";
import { StickerSoundsContext } from "./stickerSoundsStore";

export function StickerSoundsProvider({ children }) {
  const [chatStickers, setChatStickers] = useState([]); // [{ emoteId, image, count }]
  const [recentGifts, setRecentGifts] = useState([]); // [{ name, image }]
  const [lastTriggered, setLastTriggered] = useState(null);
  const [antiSpam, setAntiSpam] = useState(() => {
    const v = localStorage.getItem("stickerAntiSpam");
    return v === null ? true : v === "true";
  });
  const [cooldownSec, setCooldownSec] = useState(() => {
    const v = parseFloat(localStorage.getItem("stickerCooldownSec"));
    return Number.isFinite(v) ? v : 5;
  });
  // Anti-ráfaga global: tiempo mínimo entre CUALQUIER par de sonidos. Evita que
  // un mensaje con muchos stickers distintos los reproduzca todos a la vez.
  const [minGapSec, setMinGapSec] = useState(() => {
    const v = parseFloat(localStorage.getItem("stickerMinGapSec"));
    return Number.isFinite(v) ? v : 1.5;
  });

  const lastPlayedRef = useRef({}); // { [stickerKey]: timestamp } para el cooldown
  const lastAnyPlayedRef = useRef(0); // timestamp del último sonido (cualquiera)
  // Refs frescas para leerlas dentro del listener (que se registra una sola vez).
  const antiSpamRef = useRef(antiSpam);
  const cooldownRef = useRef(cooldownSec);
  const minGapRef = useRef(minGapSec);

  useEffect(() => {
    antiSpamRef.current = antiSpam;
    localStorage.setItem("stickerAntiSpam", String(antiSpam));
  }, [antiSpam]);
  useEffect(() => {
    cooldownRef.current = cooldownSec;
    localStorage.setItem("stickerCooldownSec", String(cooldownSec));
  }, [cooldownSec]);
  useEffect(() => {
    minGapRef.current = minGapSec;
    localStorage.setItem("stickerMinGapSec", String(minGapSec));
  }, [minGapSec]);

  // Listeners globales: se registran una vez al arrancar la app y siguen vivos
  // mientras cambias de pestaña, así el directo nunca se queda sin sonidos.
  useEffect(() => {
    const handleEmote = (data) => {
      const emoteId = data.emoteId;
      const image = data.emoteImage || null;
      if (!emoteId) return;
      setChatStickers((prev) => {
        const idx = prev.findIndex((s) => s.emoteId === emoteId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            count: next[idx].count + 1,
            image: next[idx].image || image,
          };
          // bubble most-recent to front
          const [item] = next.splice(idx, 1);
          return [item, ...next];
        }
        return [{ emoteId, image, count: 1 }, ...prev].slice(0, 60);
      });
    };

    const handleGift = (data) => {
      const name = data.giftName || "Unknown";
      const image = data.giftImage || null;
      setRecentGifts((prev) => {
        const without = prev.filter((g) => g.name !== name);
        return [{ name, image }, ...without].slice(0, 24);
      });
    };

    const handleStickerSound = ({ giftName: key, soundData, volume: vol, cooldownSec: itemCd }) => {
      setLastTriggered(key);
      setTimeout(() => setLastTriggered(null), 2000);
      if (!soundData) return;

      const now = Date.now();

      // 1) Anti-ráfaga global (siempre): nunca dos sonidos casi a la vez. Esto
      // evita que un mensaje con muchos stickers distintos suene todo de golpe.
      if (minGapRef.current > 0 && now - lastAnyPlayedRef.current < minGapRef.current * 1000) {
        return;
      }

      // 2) Cooldown por sticker (si anti-spam activo): no repetir el mismo
      // sticker hasta que pase su cooldown propio (o el global por defecto).
      if (antiSpamRef.current) {
        const cd = (itemCd == null ? cooldownRef.current : itemCd) * 1000;
        const last = lastPlayedRef.current[key] || 0;
        if (now - last < cd) return;
      }

      lastPlayedRef.current[key] = now;
      lastAnyPlayedRef.current = now;

      const audio = new Audio(soundData);
      audio.volume =
        typeof vol === "number" ? Math.min(1, Math.max(0, vol)) : 0.8;
      audio.play().catch(() => {});
    };

    socket.on("emote", handleEmote);
    socket.on("gift", handleGift);
    socket.on("stickerSound", handleStickerSound);
    return () => {
      socket.off("emote", handleEmote);
      socket.off("gift", handleGift);
      socket.off("stickerSound", handleStickerSound);
    };
  }, []);

  const value = {
    chatStickers,
    recentGifts,
    lastTriggered,
    antiSpam,
    setAntiSpam,
    cooldownSec,
    setCooldownSec,
    minGapSec,
    setMinGapSec,
  };

  return (
    <StickerSoundsContext.Provider value={value}>
      {children}
    </StickerSoundsContext.Provider>
  );
}
