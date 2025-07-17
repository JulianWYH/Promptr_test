"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import "../css/game.css";

export default function GameLobby() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [showNameInput, setShowNameInput] = useState(false);
  const [gameMode, setGameMode] = useState(null); // 'create' or 'join'

  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleCreateRoom = () => {
    if (!playerName.trim()) {
      alert("Please enter your name first!");
      return;
    }
    const newRoomCode = generateRoomCode();
    router.push(`/game/${newRoomCode}?player=${encodeURIComponent(playerName)}&host=true`);
  };

  const handleJoinRoom = () => {
    if (!playerName.trim()) {
      alert("Please enter your name first!");
      return;
    }
    if (!roomCode.trim()) {
      alert("Please enter a room code!");
      return;
    }
    router.push(`/game/${roomCode.toUpperCase()}?player=${encodeURIComponent(playerName)}`);
  };

  const handleCreateGameClick = () => {
    setGameMode('create');
    setShowNameInput(true);
  };

  const handleJoinGameClick = () => {
    setGameMode('join');
    setShowNameInput(true);
  };

  return (
    <div className="gameLobby">
      <div className="lobbyGameContent">
        <div className="lobbyGameHeader">
          <h1>PROMPT WARS</h1>
          <h2>Image Mimic Challenge</h2>
          <p>Create better prompts than your friends to recreate target images!</p>
        </div>

        {!showNameInput ? (
          <div className="lobbyGameOptions">
            <div className="gameOptionCard">
              <h3>Create New Game</h3>
              <p>Start a new room and invite friends</p>
              <button className="lobbyGameBtn create" onClick={handleCreateGameClick}>
                CREATE ROOM
              </button>
            </div>

            <div className="gameOptionCard">
              <h3>Join Game</h3>
              <p>Enter a room code to join friends</p>
              <button className="lobbyGameBtn join" onClick={handleJoinGameClick}>
                JOIN ROOM
              </button>
            </div>

            <div className="backBtn">
              <button onClick={() => router.push("/")}>← Back to Main</button>
            </div>
          </div>
        ) : (
          <div className="playerSetup">
            <div className="setupCard">
              <h3>{gameMode === 'create' ? 'Create Your Room' : 'Join a Room'}</h3>
              
              <div className="inputGroup">
                <label>Your Name:</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your display name"
                  maxLength={20}
                />
              </div>

              {gameMode === 'join' && (
                <div className="inputGroup">
                  <label>Room Code:</label>
                  <input
                    type="text"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    placeholder="Enter 6-digit room code"
                    maxLength={6}
                  />
                </div>
              )}

              <div className="setupButtons">
                <button 
                  className="lobbyGameBtn"
                  onClick={gameMode === 'create' ? handleCreateRoom : handleJoinRoom}
                  disabled={!playerName.trim() || (gameMode === 'join' && !roomCode.trim())}
                >
                  {gameMode === 'create' ? 'CREATE ROOM' : 'JOIN ROOM'}
                </button>
                <button 
                  className="lobbyGameBtn secondary"
                  onClick={() => setShowNameInput(false)}
                >
                  BACK
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="gameRules">
          <h4>How to Play:</h4>
          <ul>
            <li>🎯 5 rounds of image recreation challenges</li>
            <li>🖼️ Each round shows a target image from Unsplash</li>
            <li>✍️ Write prompts to recreate the image using AI</li>
            <li>🎲 Get 5 attempts per round to get the best match</li>
            <li>🏆 Scores based on how close your image matches the original</li>
            <li>👑 Highest total score after 5 rounds wins!</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
