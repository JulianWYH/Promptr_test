"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSocket from "../../hooks/useSocket";
import "../../css/gameroom.css";

export default function GameRoom({ params }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { socket, isConnected } = useSocket();
  const { roomId } = use(params);
  const playerName = searchParams.get('player');
  const isHost = searchParams.get('host') === 'true';

  // Game State
  const [gameState, setGameState] = useState('lobby'); // 'lobby', 'playing', 'scoring', 'finished'
  const [players, setPlayers] = useState([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [totalRounds] = useState(5);
  const [isPlayerHost, setIsPlayerHost] = useState(isHost);

  // Round State
  const [targetImage, setTargetImage] = useState(null);
  const [playerPrompt, setPlayerPrompt] = useState('');
  const [generatedImages, setGeneratedImages] = useState([]);
  const [attemptsLeft, setAttemptsLeft] = useState(5);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [roundResults, setRoundResults] = useState([]);
  const [submissionStatus, setSubmissionStatus] = useState('');
  const [finalScores, setFinalScores] = useState([]);

  // Socket.IO event handlers
  useEffect(() => {
    if (!socket || !isConnected || !playerName) return;

    // Join the room when socket connects
    socket.emit('join-room', { roomId, playerName, isHost });

    // Room updated
    socket.on('room-updated', (data) => {
      setPlayers(data.players);
      setGameState(data.gameState);
      setCurrentRound(data.currentRound);
      if (data.targetImage) setTargetImage(data.targetImage);
      
      // Only update host status if it's actually different
      setIsPlayerHost(prevHost => {
        if (prevHost !== data.isHost) {
          console.log(`Host status changed: ${prevHost} -> ${data.isHost}`);
          return data.isHost;
        }
        return prevHost;
      });
    });

    // Game started
    socket.on('game-started', (data) => {
      setGameState(data.gameState);
      setCurrentRound(data.currentRound);
      setTargetImage(data.targetImage);
      setHasSubmitted(false);
      setGeneratedImages([]);
      setAttemptsLeft(5);
      setSelectedImage(null);
      setError('');
      setSubmissionStatus('');
    });

    // Player submitted
    socket.on('player-submitted', (data) => {
      // Show detailed real-time submission status
      if (data.isAllSubmitted) {
        setSubmissionStatus(`🎉 All players submitted! Calculating scores...`);
      } else {
        const waitingPlayers = data.totalPlayers - data.totalSubmissions;
        setSubmissionStatus(`✅ ${data.playerName} submitted! (${data.totalSubmissions}/${data.totalPlayers} done, waiting for ${waitingPlayers} more)`);
      }
    });

    // Round completed
    socket.on('round-completed', (data) => {
      setPlayers(data.players);
      setRoundResults(prev => [...prev, ...data.scores]);
      
      // Server will automatically progress to next round or end game
      // No need for client-side logic here
    });

    // Next round
    socket.on('next-round', (data) => {
      setCurrentRound(data.currentRound);
      setTargetImage(data.targetImage);
      setHasSubmitted(false);
      setGeneratedImages([]);
      setAttemptsLeft(5);
      setSelectedImage(null);
      setError('');
      setSubmissionStatus('');
    });

    // Game finished
    socket.on('game-finished', (data) => {
      setGameState('finished');
      setFinalScores(data.finalScores);
    });

    return () => {
      socket.off('room-updated');
      socket.off('game-started');
      socket.off('player-submitted');
      socket.off('round-completed');
      socket.off('next-round');
      socket.off('game-finished');
    };
  }, [socket, isConnected, playerName, roomId, isHost]); // Removed isPlayerHost from dependencies

  useEffect(() => {
    if (!playerName) {
      router.push('/game');
      return;
    }
  }, [playerName, router]);

  const startGame = useCallback(() => {
    if (!isPlayerHost || !socket) return;
    socket.emit('start-game', { roomId });
  }, [isPlayerHost, socket, roomId]);

  const fetchNewTargetImage = async () => {
    // This is now handled by the server via Socket.IO
    // Target images are fetched server-side and broadcast to all players
  };

  const generateImage = async () => {
    if (attemptsLeft <= 0 || !playerPrompt.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/geminigenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: playerPrompt })
      });
      
      const data = await response.json();
      if (data.imageBase64) {
        const newImage = {
          id: Date.now(),
          base64: data.imageBase64,
          prompt: playerPrompt,
          description: data.text || ''
        };
        
        setGeneratedImages(prev => [...prev, newImage]);
        setAttemptsLeft(prev => prev - 1);
        setPlayerPrompt('');
        
        // Auto-select the latest image
        setSelectedImage(newImage);
      }
    } catch (err) {
      setError('Failed to generate image');
    } finally {
      setLoading(false);
    }
  };

  const submitFinalImage = async () => {
    if (!selectedImage || !socket) {
      alert('Please select an image to submit!');
      return;
    }
    
    setHasSubmitted(true);
    setLoading(true);
    
    try {
      // Send submission to server via Socket.IO
      socket.emit('submit-image', {
        roomId,
        imageData: {
          base64: selectedImage.base64,
          prompt: selectedImage.prompt,
          description: selectedImage.description
        }
      });
      
      setSubmissionStatus('✅ Image submitted! Waiting for other players...');
      
    } catch (err) {
      setError('Failed to submit image');
      setHasSubmitted(false);
    } finally {
      setLoading(false);
    }
  };

  const nextRound = () => {
    // This is now handled by the server via Socket.IO
    // Only host can trigger next round, handled in socket events
  };

  const copyRoomLink = () => {
    // Get the current host (works for both localhost and IP access)
    const currentHost = window.location.host;
    const protocol = window.location.protocol;
    const link = `${protocol}//${currentHost}/game/${roomId}`;
    navigator.clipboard.writeText(link);
    alert(`Room link copied to clipboard!\n\nShare this link: ${link}\n\nFor other devices on your network, use: http://192.168.1.13:4000/game/${roomId}`);
  };

  if (gameState === 'lobby') {
    return (
      <div className="gameRoom">
        <div className="roomHeader">
          <h1>Room: {roomId}</h1>
          <div className="connectionStatus">
            {isConnected ? (
              <span className="connected">🟢 Connected</span>
            ) : (
              <span className="disconnected">🔴 Connecting...</span>
            )}
          </div>
          <button className="copyLink" onClick={copyRoomLink}>
            📋 Copy Invite Link
          </button>
        </div>
        
        <div className="lobbyContent">
          <div className="playersPanel">
            <h2>Players ({players.length})</h2>
            <div className="playersList">
              {players.map(player => (
                <div key={player.id} className="playerItem">
                  <span className="playerName">
                    {player.name}
                    {!player.connected && <span className="disconnectedBadge">🔴</span>}
                  </span>
                  {player.isHost && <span className="hostBadge">HOST</span>}
                  <span className="playerScore">Score: {player.score}</span>
                </div>
              ))}
              {players.length === 0 && (
                <div className="noPlayers">
                  <p>Connecting to room...</p>
                </div>
              )}
            </div>
          </div>
          
          <div className="gameInfo">
            <h3>Prompt Wars: Image Mimic Challenge</h3>
            <p>🎯 {totalRounds} rounds of image recreation</p>
            <p>🎲 5 attempts per round</p>
            <p>🏆 Best similarity score wins!</p>
            
            {isPlayerHost && (
              <button 
                className="startGameBtn"
                onClick={startGame}
                disabled={players.length < 1 || !isConnected}
              >
                {players.length < 1 ? 'Waiting for players...' : 'START GAME'}
              </button>
            )}
            
            {!isPlayerHost && (
              <p className="waitingMsg">
                {players.length > 0 ? 'Waiting for host to start the game...' : 'Connecting...'}
              </p>
            )}
          </div>
        </div>
        
        <button className="backBtn" onClick={() => router.push('/game')}>
          ← Leave Room
        </button>
      </div>
    );
  }

  if (gameState === 'playing') {
    return (
      <div className="gameRoom playing">
        <div className="roomGameHeader">
          <div className="roundInfo">
            <h2>Round {currentRound} of {totalRounds}</h2>
            <div className="playerScore">Your Score: {players.find(p => p.name === playerName)?.score || 0}</div>
          </div>
          <div className="attemptsInfo">
            <span>Attempts Left: {attemptsLeft}</span>
          </div>
        </div>

        <div className="roomGameContent">
          <div className="targetSection">
            <h3>🎯 Target Image</h3>
            <p>Recreate this image with your prompts!</p>
            {loading && !targetImage ? (
              <div className="imagePlaceholder">Loading target image...</div>
            ) : (
              <img src={targetImage} alt="Target" className="targetImage" />
            )}
          </div>

          <div className="promptSection">
            <h3>✍️ Your Prompt</h3>
            <div className="promptInput">
              <input
                type="text"
                value={playerPrompt}
                onChange={(e) => setPlayerPrompt(e.target.value)}
                placeholder="Describe the image you want to generate..."
                disabled={attemptsLeft <= 0 || hasSubmitted || loading}
                onKeyPress={(e) => e.key === 'Enter' && generateImage()}
              />
              <button 
                onClick={generateImage}
                disabled={attemptsLeft <= 0 || hasSubmitted || loading || !playerPrompt.trim()}
                className="generateBtn"
              >
                {loading ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>

          {generatedImages.length > 0 && (
            <div className="generatedSection">
              <h3>🖼️ Your Generated Images</h3>
              <div className="imageGrid">
                {generatedImages.map(img => (
                  <div 
                    key={img.id} 
                    className={`generatedImageCard ${selectedImage?.id === img.id ? 'selected' : ''}`}
                    onClick={() => setSelectedImage(img)}
                  >
                    <img src={`data:image/png;base64,${img.base64}`} alt="Generated" />
                    <p className="imagePrompt">"{img.prompt}"</p>
                    {selectedImage?.id === img.id && <div className="selectedBadge">✓ Selected</div>}
                  </div>
                ))}
              </div>
              
              <div className="submitSection">
                <button 
                  onClick={submitFinalImage}
                  disabled={!selectedImage || hasSubmitted || loading}
                  className="submitBtn"
                >
                  {hasSubmitted ? 'Submitted!' : 'Submit Selected Image'}
                </button>
              </div>
            </div>
          )}

          {hasSubmitted && (
            <div className="waitingSubmit">
              <p>{submissionStatus || '✅ Image submitted! Waiting for other players...'}</p>
            </div>
          )}

          {error && <div className="error">{error}</div>}
        </div>
      </div>
    );
  }

  if (gameState === 'finished') {
    const displayScores = finalScores.length > 0 ? finalScores : players;
    const sortedPlayers = [...displayScores].sort((a, b) => b.score - a.score);
    const winner = sortedPlayers[0];
    const myResults = roundResults.filter(r => r.playerName === playerName);
    
    return (
      <div className="gameRoom finished">
        <div className="gameComplete">
          <h1>🎉 Game Complete!</h1>
          
          <div className="finalScoreboard">
            <h2>Final Scoreboard</h2>
            {sortedPlayers.map((player, index) => (
              <div key={player.id || player.name} className={`finalPlayerItem ${index === 0 ? 'winner' : ''}`}>
                <span className="position">#{index + 1}</span>
                <span className="playerName">{player.name}</span>
                <span className="finalScore">{player.score} pts</span>
                {index === 0 && <span className="crown">👑</span>}
              </div>
            ))}
          </div>

          {myResults.length > 0 && (
            <div className="roundSummary">
              <h3>Your Performance</h3>
              {myResults.map((result, index) => (
                <div key={index} className="roundResult">
                  <span>Round {result.round || index + 1}: {result.roundScore || result.score} points</span>
                  <span className="similarity">({((result.similarity || 0) * 100).toFixed(1)}% similarity)</span>
                </div>
              ))}
            </div>
          )}

          <div className="gameActions">
            <button onClick={() => router.push('/game')} className="newGameBtn">
              🎮 New Game
            </button>
            <button onClick={() => router.push('/')} className="homeBtn">
              🏠 Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
