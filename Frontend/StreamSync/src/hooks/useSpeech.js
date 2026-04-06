// hooks/useSpeech.js
import { useState, useEffect, useCallback, useRef } from "react";
import socket from "../services/socketService";

export const useSpeech = () => {
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [enabled, setEnabled] = useState(true);
  const queueRef = useRef([]);
  const isSpeakingRef = useRef(false);

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const available = speechSynthesis.getVoices();
      setVoices(available);

      if (!selectedVoice && available.length > 0) {
        const defaultVoice =
          available.find((v) => v.lang.startsWith("es")) || available[0];
        setSelectedVoice(defaultVoice);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, [selectedVoice]);

  // Process TTS queue
  const processQueue = useCallback(() => {
    if (isSpeakingRef.current || queueRef.current.length === 0 || !enabled) return;

    const next = queueRef.current.shift();
    isSpeakingRef.current = true;

    const utterance = new SpeechSynthesisUtterance(next.text);
    utterance.voice = selectedVoice;
    utterance.pitch = next.pitch || 1;
    utterance.rate = next.rate || 1;
    utterance.volume = next.volume || 0.8;

    utterance.onend = () => {
      isSpeakingRef.current = false;
      processQueue();
    };

    utterance.onerror = () => {
      isSpeakingRef.current = false;
      processQueue();
    };

    speechSynthesis.speak(utterance);
  }, [enabled, selectedVoice]);

  // Listen for TTS events from backend
  useEffect(() => {
    const handleTTS = (ttsEvent) => {
      if (!enabled) return;

      // Add to queue (priority items go first)
      if (ttsEvent.priority > 0) {
        queueRef.current.unshift(ttsEvent);
      } else {
        queueRef.current.push(ttsEvent);
      }

      // Keep queue manageable
      if (queueRef.current.length > 20) {
        queueRef.current = queueRef.current.slice(0, 20);
      }

      processQueue();
    };

    socket.on("tts", handleTTS);
    return () => socket.off("tts", handleTTS);
  }, [enabled, processQueue]);

  const speak = useCallback(
    (text) => {
      if (!enabled || !selectedVoice || !text?.trim()) return;

      queueRef.current.push({ text, priority: 0 });

      if (queueRef.current.length > 20) {
        queueRef.current = queueRef.current.slice(0, 20);
      }

      processQueue();
    },
    [enabled, selectedVoice, processQueue]
  );

  const skip = useCallback(() => {
    speechSynthesis.cancel();
    isSpeakingRef.current = false;
    processQueue();
  }, [processQueue]);

  const clearQueue = useCallback(() => {
    speechSynthesis.cancel();
    queueRef.current = [];
    isSpeakingRef.current = false;
  }, []);

  const toggleEnabled = useCallback(() => {
    setEnabled((prev) => {
      if (prev) {
        speechSynthesis.cancel();
        queueRef.current = [];
        isSpeakingRef.current = false;
      }
      return !prev;
    });
  }, []);

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
