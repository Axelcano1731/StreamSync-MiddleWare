// hooks/useSpeech.js
//
// Lector de chat (TTS) con voces neuronales. En vez de usar la Web Speech API
// del navegador (que en Electron/Windows solo expone voces SAPI robóticas),
// pide el audio MP3 al backend (/api/tts) generado con el motor neuronal de
// Microsoft Edge y lo reproduce con un elemento <audio>.
import { useState, useEffect, useCallback, useRef } from "react";
import socket from "../services/socketService";

const params = new URLSearchParams(window.location.search);
const backendPort = params.get("backendPort") || "3000";
const BACKEND_URL = `http://localhost:${backendPort}`;

const STORAGE_KEY = "streamsync.ttsVoice";
const MAX_QUEUE = 20;

export const useSpeech = () => {
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoiceState] = useState(null);
  const [enabled, setEnabled] = useState(true);

  const queueRef = useRef([]);
  const isSpeakingRef = useRef(false);
  const audioRef = useRef(null);
  // Refs espejo para leer el estado actual dentro de la cola sin recrear callbacks.
  const selectedVoiceRef = useRef(null);
  const enabledRef = useRef(true);

  useEffect(() => {
    selectedVoiceRef.current = selectedVoice;
  }, [selectedVoice]);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const setSelectedVoice = useCallback((voice) => {
    setSelectedVoiceState(voice);
    if (voice?.shortName) {
      try {
        localStorage.setItem(STORAGE_KEY, voice.shortName);
      } catch {
        /* localStorage no disponible */
      }
    }
  }, []);

  // Cargar las voces neuronales del backend al montar.
  useEffect(() => {
    let cancelled = false;
    fetch(`${BACKEND_URL}/api/tts/voices`)
      .then((r) => r.json())
      .then((list) => {
        if (cancelled || !Array.isArray(list)) return;
        setVoices(list);

        let savedName = null;
        try {
          savedName = localStorage.getItem(STORAGE_KEY);
        } catch {
          /* ignore */
        }
        const saved = savedName && list.find((v) => v.shortName === savedName);
        const fallback =
          list.find((v) => v.shortName === "es-MX-DaliaNeural") ||
          list.find((v) => v.locale?.startsWith("es")) ||
          list[0];
        setSelectedVoiceState(saved || fallback || null);
      })
      .catch((err) =>
        console.error("[tts] No se pudieron cargar las voces neuronales:", err)
      );
    return () => {
      cancelled = true;
    };
  }, []);

  const stopCurrent = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      if (audio.src) URL.revokeObjectURL(audio.src);
      audioRef.current = null;
    }
    isSpeakingRef.current = false;
  }, []);

  // Procesa la cola: pide el audio al backend y lo reproduce.
  const playNext = useCallback(async () => {
    if (isSpeakingRef.current || !enabledRef.current) return;
    const voice = selectedVoiceRef.current;
    if (!voice) return; // aún no hay voz; se reintenta al cargar/encolar

    const next = queueRef.current.shift();
    if (!next) return;

    isSpeakingRef.current = true;
    try {
      const res = await fetch(`${BACKEND_URL}/api/tts/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: next.text,
          voice: voice.shortName,
          rate: next.rate ?? 1,
          pitch: next.pitch ?? 1,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.volume = next.volume ?? 0.8;
      audioRef.current = audio;

      const done = () => {
        URL.revokeObjectURL(url);
        if (audioRef.current === audio) audioRef.current = null;
        isSpeakingRef.current = false;
        playNext();
      };
      audio.onended = done;
      audio.onerror = done;
      await audio.play();
    } catch (err) {
      console.error("[tts] Error reproduciendo:", err);
      isSpeakingRef.current = false;
      playNext(); // no quedarse atascado por un fallo puntual
    }
  }, []);

  const enqueue = useCallback(
    (item) => {
      if (!enabledRef.current || !item?.text?.trim()) return;
      if (item.priority > 0) queueRef.current.unshift(item);
      else queueRef.current.push(item);
      if (queueRef.current.length > MAX_QUEUE) {
        queueRef.current = queueRef.current.slice(0, MAX_QUEUE);
      }
      playNext();
    },
    [playNext]
  );

  // Escuchar eventos TTS emitidos por el backend.
  useEffect(() => {
    const handleTTS = (ttsEvent) => enqueue(ttsEvent);
    socket.on("tts", handleTTS);
    return () => socket.off("tts", handleTTS);
  }, [enqueue]);

  // Arrancar la cola en cuanto haya una voz seleccionada (p. ej. tras cargarlas).
  useEffect(() => {
    if (selectedVoice) playNext();
  }, [selectedVoice, playNext]);

  const speak = useCallback(
    (text) => {
      enqueue({ text, priority: 0, rate: 1, pitch: 1, volume: 0.8 });
    },
    [enqueue]
  );

  const skip = useCallback(() => {
    stopCurrent();
    playNext();
  }, [stopCurrent, playNext]);

  const clearQueue = useCallback(() => {
    queueRef.current = [];
    stopCurrent();
  }, [stopCurrent]);

  const toggleEnabled = useCallback(() => {
    setEnabled((prev) => {
      const nextEnabled = !prev;
      enabledRef.current = nextEnabled;
      if (!nextEnabled) {
        queueRef.current = [];
        stopCurrent();
      }
      return nextEnabled;
    });
  }, [stopCurrent]);

  return {
    voices,
    selectedVoice,
    setSelectedVoice,
    enabled,
    toggleEnabled,
    speak,
    skip,
    clearQueue,
    queueLength: queueRef.current.length,
  };
};
