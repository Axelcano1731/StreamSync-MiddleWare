// App.jsx
import React, { useState } from "react";
import "./App.css";
import { useTikTokEvents } from "./hooks/useTikTokEvents";
import { useSpeech } from "./hooks/useSpeech";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import StatsPanel from "./components/StatsPanel";
import InteractionsPanel from "./components/InteractionsPanel";
import ConnectPanel from "./components/ConnectPanel";
import AlertsPanel from "./components/AlertsPanel";
import EventLog from "./components/EventLog";
import OverlayPanel from "./components/OverlayPanel";
import SpotifyPanel from "./components/SpotifyPanel";
import AutomationPanel from "./components/AutomationPanel";
import { VoiceSettings } from "./components/VoiceSettings";

const PAGE_TITLES = {
  dashboard: "Dashboard",
  chat: "Chat en Vivo",
  alerts: "Alertas",
  events: "Log de Eventos",
  overlay: "Overlays",
  automation: "Automatización",
  spotify: "Spotify",
  settings: "Configuración",
};

function App() {
  const [currentPage, setCurrentPage] = useState("dashboard");

  const {
    username,
    setUsername,
    events,
    liveStats,
    status,
    topDonors,
    connectToTikTok,
    disconnectFromTikTok,
  } = useTikTokEvents();

  const {
    voices,
    selectedVoice,
    setSelectedVoice,
    enabled: ttsEnabled,
    toggleEnabled: toggleTTS,
  } = useSpeech();

  const isLiveConnected = status === "online" || status === "reconnecting";

  const renderConnectGate = () => (
    <div
      className="main-content"
      style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <ConnectPanel
        username={username}
        setUsername={setUsername}
        connectToTikTok={connectToTikTok}
      />
    </div>
  );

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        if (!isLiveConnected) return renderConnectGate();
        return (
          <div className="main-content page-enter">
            <StatsPanel liveStats={liveStats} />
            <InteractionsPanel events={events} topDonors={topDonors} />
          </div>
        );

      case "chat":
        if (!isLiveConnected) return renderConnectGate();
        return (
          <div className="main-content">
            <InteractionsPanel events={events} topDonors={topDonors} />
          </div>
        );

      case "alerts":
        return (
          <div className="main-content">
            <AlertsPanel />
          </div>
        );

      case "events":
        if (!isLiveConnected) return renderConnectGate();
        return (
          <div className="main-content">
            <EventLog events={events} />
          </div>
        );

      case "overlay":
        return (
          <div className="main-content">
            <OverlayPanel />
          </div>
        );

      case "automation":
        return (
          <div className="main-content">
            <AutomationPanel />
          </div>
        );

      case "spotify":
        return (
          <div className="main-content">
            <SpotifyPanel />
          </div>
        );

      case "settings":
        return (
          <div className="main-content">
            <div className="page-enter">
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <div className="panel-title">⚙️ Configuración General</div>
                    <div className="panel-subtitle">
                      Ajustes de la aplicación
                    </div>
                  </div>
                </div>

                <VoiceSettings
                  voices={voices}
                  selectedVoice={selectedVoice}
                  onVoiceSelect={setSelectedVoice}
                  isMuted={!ttsEnabled}
                  onToggleMute={toggleTTS}
                />
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="app-container">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <div className="app-body">
        <TopBar
          status={status}
          username={username}
          disconnectFromTikTok={disconnectFromTikTok}
          pageTitle={PAGE_TITLES[currentPage] || "StreamSync"}
        />
        {renderPage()}
      </div>
    </div>
  );
}

export default App;
