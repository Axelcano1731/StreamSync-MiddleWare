// App.jsx
import React from "react";
import "./App.css";
import { useTikTokEvents } from "./hooks/useTikTokEvents";
import TopBar from "./components/TopBar";
import StatsPanel from "./components/StatsPanel";
import InteractionsPanel from "./components/InteractionsPanel";
import ConnectPanel from "./components/ConnectPanel";

function App() {
  const {
    username,
    setUsername,
    events,
    liveStats,
    status,
    connectToTikTok,
    disconnectFromTikTok,
  } = useTikTokEvents();

  return (
    <div className="app-container">
      <TopBar
        status={status}
        username={username}
        disconnectFromTikTok={disconnectFromTikTok}
      />
      {status === "online" ? (
        <div className="main-container">
          <StatsPanel liveStats={liveStats} />
          <InteractionsPanel events={events} />
        </div>
      ) : (
        <div className="main-container center-content">
          <ConnectPanel
            username={username}
            setUsername={setUsername}
            connectToTikTok={connectToTikTok}
          />
        </div>
      )}
    </div>
  );
}

export default App;
