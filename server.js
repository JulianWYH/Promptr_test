// Add top-level error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

console.log('Starting server initialization...');

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

console.log('Required modules loaded successfully');

const dev = process.env.NODE_ENV !== 'production';
console.log('Development mode:', dev);

const app = next({ dev });
const handle = app.getRequestHandler();

console.log('Next.js app initialized');

// Store game rooms in memory (in production, use Redis or database)
const gameRooms = new Map();

// Dynamic host configuration for API calls
const getApiBaseUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.RENDER_EXTERNAL_URL || `https://${process.env.RENDER_SERVICE_NAME}.onrender.com`;
  }
  return `http://localhost:${process.env.PORT || 4000}`;
};

console.log('About to prepare Next.js app...');

// Helper function to ensure only one host per room
function ensureSingleHost(room) {
  const connectedPlayers = room.players.filter(p => p.connected);
  const currentHosts = connectedPlayers.filter(p => p.isHost);
  
  // If multiple hosts exist, keep only the first one
  if (currentHosts.length > 1) {
    console.log(`WARNING: Multiple hosts detected in room. Fixing...`);
    for (let i = 1; i < currentHosts.length; i++) {
      currentHosts[i].isHost = false;
    }
    room.host = currentHosts[0].id;
  }
  
  // If no host exists but there are players, assign first player as host
  if (currentHosts.length === 0 && connectedPlayers.length > 0) {
    connectedPlayers[0].isHost = true;
    room.host = connectedPlayers[0].id;
    console.log(`Assigned ${connectedPlayers[0].name} as new host`);
  }
  
  // If no connected players, clear host
  if (connectedPlayers.length === 0) {
    room.host = null;
  }
}

// Helper function to validate host permissions
function isValidHost(socket, room) {
  if (!room) return false;
  const player = room.players.find(p => p.id === socket.id);
  return player && player.isHost && player.connected && room.host === socket.id;
}

// Helper function to send room updates to all players
function broadcastRoomUpdate(io, room) {
  room.players.forEach(player => {
    if (player.connected) {
      io.to(player.id).emit('room-updated', {
        players: room.players,
        gameState: room.gameState,
        currentRound: room.currentRound,
        targetImage: room.targetImage,
        isHost: player.id === room.host
      });
    }
  });
}

app.prepare().then(() => {
  console.log('Next.js app prepared successfully!');
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    
    // Debug endpoint to check room status (remove in production)
    if (parsedUrl.pathname === '/debug/rooms') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      
      const roomsDebug = {};
      for (const [roomId, room] of gameRooms.entries()) {
        roomsDebug[roomId] = {
          players: room.players.map(p => ({
            name: p.name,
            id: p.id,
            isHost: p.isHost,
            connected: p.connected
          })),
          host: room.host,
          gameState: room.gameState,
          hostsCount: room.players.filter(p => p.isHost).length
        };
      }
      
      res.end(JSON.stringify(roomsDebug, null, 2));
      return;
    }
    
    handle(req, res, parsedUrl);
  });

  const io = new Server(server, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? [process.env.RENDER_EXTERNAL_URL || "https://*.onrender.com"]
        : "*",
      methods: ["GET", "POST"]
    },
    // Add connection stability settings
    pingTimeout: 60000,    // 60 seconds before considering disconnected
    pingInterval: 25000,   // Send ping every 25 seconds
    connectTimeout: 60000, // 60 seconds to establish connection
    maxHttpBufferSize: 10e6, // 10MB max message size (for large images)
    transports: ['websocket', 'polling'] // Fallback transports
  });

  io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Add connection monitoring
    socket.on('error', (error) => {
      console.error(`[SOCKET-ERROR] Socket ${socket.id} error:`, error);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[DISCONNECT] Player disconnected: ${socket.id}, Reason: ${reason}`);
      
      if (socket.roomId) {
        const room = gameRooms.get(socket.roomId);
        if (room) {
          const player = room.players.find(p => p.id === socket.id);
          if (player) {
            // If game is in lobby state, completely remove the player
            if (room.gameState === 'lobby') {
              console.log(`[DISCONNECT] Removing ${player.name} from lobby in room ${socket.roomId}`);
              room.players = room.players.filter(p => p.id !== socket.id);
              console.log(`[DISCONNECT] Room ${socket.roomId} now has ${room.players.length} players in lobby`);
            } else {
              // If game is already started, just mark as disconnected
              player.connected = false;
              console.log(`[DISCONNECT] ${player.name} disconnected from active game in room ${socket.roomId} (${reason})`);
              console.log(`[DISCONNECT] Room ${socket.roomId} now has ${room.players.filter(p => p.connected).length}/${room.players.length} connected players`);
            }
            
            // Use helper function to manage host assignment
            ensureSingleHost(room);
            
            // Send updated room state to all players
            broadcastRoomUpdate(io, room);
            
            // If no players left in the room, clean up the room
            if (room.players.length === 0) {
              console.log(`[DISCONNECT] Room ${socket.roomId} is now empty, removing room`);
              gameRooms.delete(socket.roomId);
            }
          }
        }
      }
    });

    // Join a game room
    socket.on('join-room', ({ roomId, playerName, isHost }) => {
      socket.join(roomId);
      
      if (!gameRooms.has(roomId)) {
        gameRooms.set(roomId, {
          id: roomId,
          players: [],
          gameState: 'lobby',
          currentRound: 0,
          totalRounds: 5,
          targetImage: null,
          targetDescription: '',
          submissions: new Map(),
          host: null,
          calculatingScores: false
        });
      }

      const room = gameRooms.get(roomId);
      let isNewJoin = false;
      let isReconnection = false;
      
      // Check if player already exists (reconnection)
      const existingPlayer = room.players.find(p => p.name === playerName);
      
      if (!existingPlayer) {
        // Determine if this player should be host
        // Only become host if:
        // 1. No host exists yet (room.host is null), AND
        // 2. No other players are marked as host, AND  
        // 3. This is the first player OR explicitly requesting host status
        const hasExistingHost = room.host !== null || room.players.some(p => p.isHost && p.connected);
        const shouldBeHost = !hasExistingHost && (room.players.length === 0 || isHost);
        
        const newPlayer = {
          id: socket.id,
          name: playerName,
          score: 0,
          connected: true,
          isHost: shouldBeHost
        };
        
        room.players.push(newPlayer);
        isNewJoin = true;
        
        if (newPlayer.isHost) {
          room.host = socket.id;
          console.log(`${playerName} is now the host of room ${roomId}`);
        }
      } else {
        // Check if this is actually a reconnection (different socket ID)
        if (existingPlayer.id !== socket.id) {
          // Update existing player's socket ID (reconnection)
          console.log(`[JOIN-ROOM] ${playerName} reconnecting to room ${roomId}. Old ID: ${existingPlayer.id}, New ID: ${socket.id}`);
          existingPlayer.id = socket.id;
          existingPlayer.connected = true;
          isReconnection = true;
          
          // Only restore host status if they were the host and no one else took over
          if (existingPlayer.isHost && room.host === null) {
            room.host = socket.id;
            console.log(`[JOIN-ROOM] ${playerName} reconnected as host of room ${roomId}`);
          }
        } else {
          console.log(`[JOIN-ROOM] ${playerName} duplicate join-room event ignored (same socket ID)`);
        }
        // If socket ID is the same, this is likely a duplicate join-room event - ignore silently
      }

      socket.playerName = playerName;
      socket.roomId = roomId;

      // Ensure only one host exists in the room
      ensureSingleHost(room);

      // Send room state to each player with their specific host status
      broadcastRoomUpdate(io, room);

      // Only log for actual joins or reconnections, not duplicate events
      if (isNewJoin) {
        console.log(`${playerName} joined room ${roomId}. Host: ${room.host ? room.players.find(p => p.id === room.host)?.name : 'None'}`);
      } else if (isReconnection) {
        console.log(`${playerName} reconnected to room ${roomId}. Host: ${room.host ? room.players.find(p => p.id === room.host)?.name : 'None'}`);
      }
    });

    // Start game (host only)
    socket.on('start-game', async ({ roomId }) => {
      console.log(`[START-GAME] Host ${socket.id} attempting to start game in room ${roomId}`);
      
      const room = gameRooms.get(roomId);
      if (!isValidHost(socket, room)) {
        console.log(`[START-GAME] Unauthorized start-game attempt by ${socket.id} in room ${roomId}`);
        return;
      }

      console.log(`[START-GAME] Starting game in room ${roomId} with ${room.players.length} players`);
      
      room.gameState = 'playing';
      room.currentRound = 1;
      room.submissions.clear();

      console.log(`[START-GAME] Game state set to 'playing', round 1/${room.totalRounds}`);

      // Fetch target image
      try {
        const fetch = (await import('node-fetch')).default;
        
        console.log(`[START-GAME] Fetching target image from Unsplash...`);
        // Get random image from Unsplash API
        const unsplashRes = await fetch(`${getApiBaseUrl()}/api/unsplash`);
        const unsplashData = await unsplashRes.json();
        
        if (unsplashData.url) {
          room.targetImage = unsplashData.url;
          console.log(`[START-GAME] Target image set: ${room.targetImage}`);
          
          // Get description
          console.log(`[START-GAME] Getting image description from Gemini...`);
          const describeRes = await fetch(`${getApiBaseUrl()}/api/geminidescribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl: unsplashData.url })
          });
          
          const describeData = await describeRes.json();
          room.targetDescription = describeData.description || '';
          console.log(`[START-GAME] Target description: "${room.targetDescription}"`);
        } else {
          console.error(`[START-GAME] No image URL received from Unsplash`);
        }
      } catch (error) {
        console.error(`[START-GAME] Failed to fetch target image:`, error);
      }

      console.log(`[START-GAME] Emitting game-started event to room ${roomId}`);
      
      io.to(roomId).emit('game-started', {
        gameState: room.gameState,
        currentRound: room.currentRound,
        targetImage: room.targetImage
      });

      console.log(`[START-GAME] Game successfully started in room ${roomId}`);
    });

    // Player submits their final image
    socket.on('submit-image', async ({ roomId, imageData }) => {
      console.log(`[SUBMIT-IMAGE] Starting submission process for player ${socket.id} in room ${roomId}`);
      
      const room = gameRooms.get(roomId);
      if (!room) {
        console.log(`[SUBMIT-IMAGE] ERROR: Room ${roomId} not found`);
        return;
      }
      
      if (room.gameState !== 'playing') {
        console.log(`[SUBMIT-IMAGE] ERROR: Room ${roomId} is not in playing state. Current state: ${room.gameState}`);
        return;
      }

      const player = room.players.find(p => p.id === socket.id);
      if (!player) {
        // Try to find player by name if socket ID doesn't match (reconnection case)
        const playerByName = room.players.find(p => p.name === socket.playerName);
        if (playerByName) {
          console.log(`[SUBMIT-IMAGE] Found player by name ${socket.playerName}, updating socket ID from ${playerByName.id} to ${socket.id}`);
          playerByName.id = socket.id;
          playerByName.connected = true;
        } else {
          console.log(`[SUBMIT-IMAGE] ERROR: Player ${socket.id} (${socket.playerName}) not found in room ${roomId}`);
          return;
        }
      }

      // Get the player object (either found by ID or by name and updated)
      const currentPlayer = room.players.find(p => p.id === socket.id);

      // Check if player has already submitted for this round
      if (room.submissions.has(currentPlayer.name)) {
        console.log(`[SUBMIT-IMAGE] WARNING: ${currentPlayer.name} already submitted for round ${room.currentRound}. Ignoring duplicate submission.`);
        return;
      }

      console.log(`[SUBMIT-IMAGE] Player ${currentPlayer.name} submitting image in room ${roomId}, round ${room.currentRound}`);

      // Store submission with player name as key to handle reconnections
      room.submissions.set(currentPlayer.name, {
        playerName: currentPlayer.name,
        playerId: socket.id,
        ...imageData,
        submittedAt: Date.now()
      });

      // Calculate total players that should submit (only connected players)
      const connectedPlayers = room.players.filter(p => p.connected);
      const totalConnectedPlayers = connectedPlayers.length;
      const submittedPlayers = Array.from(room.submissions.keys());
      
      console.log(`[SUBMIT-IMAGE] Room ${roomId} submission status: ${room.submissions.size}/${totalConnectedPlayers} connected players submitted`);
      console.log(`[SUBMIT-IMAGE] Connected players: ${connectedPlayers.map(p => p.name).join(', ')}`);
      console.log(`[SUBMIT-IMAGE] All players in room: ${room.players.map(p => `${p.name}(${p.connected ? 'connected' : 'disconnected'})`).join(', ')}`);
      console.log(`[SUBMIT-IMAGE] Submitted players: ${submittedPlayers.join(', ')}`);
      
      // Notify room about submission with detailed status
      io.to(roomId).emit('player-submitted', {
        playerName: currentPlayer.name,
        totalSubmissions: room.submissions.size,
        totalPlayers: totalConnectedPlayers, // Use only connected players
        submittedPlayers: submittedPlayers,
        isAllSubmitted: room.submissions.size >= totalConnectedPlayers
      });

      // Check if all connected players have submitted
      if (room.submissions.size >= totalConnectedPlayers) {
        console.log(`[SUBMIT-IMAGE] All connected players submitted in room ${roomId}. Starting score calculation...`);
        
        // Add a small delay to prevent race conditions
        setTimeout(async () => {
          // Double-check that we still have all submissions before calculating
          const currentConnectedPlayers = room.players.filter(p => p.connected).length;
          if (room.submissions.size >= currentConnectedPlayers && room.gameState === 'playing') {
            console.log(`[SUBMIT-IMAGE] Confirmed all submissions ready. Proceeding with score calculation...`);
            await calculateRoundScores(room, roomId);
          } else {
            console.log(`[SUBMIT-IMAGE] Submission state changed during delay. Current: ${room.submissions.size}/${currentConnectedPlayers}, State: ${room.gameState}`);
          }
        }, 500); // 500ms delay to prevent race conditions
      } else {
        console.log(`[SUBMIT-IMAGE] Waiting for more submissions in room ${roomId}: ${room.submissions.size}/${totalConnectedPlayers}`);
      }

      console.log(`[SUBMIT-IMAGE] ${currentPlayer.name} submission completed in room ${roomId}`);
    });
  });

  // Calculate scores for all submissions in a round
  async function calculateRoundScores(room, roomId) {
    console.log(`[CALCULATE-SCORES] Starting score calculation for room ${roomId}, round ${room.currentRound}`);
    console.log(`[CALCULATE-SCORES] Total submissions: ${room.submissions.size}`);
    
    // Prevent multiple simultaneous score calculations
    if (room.calculatingScores) {
      console.log(`[CALCULATE-SCORES] Score calculation already in progress for room ${roomId}. Skipping.`);
      return;
    }
    
    room.calculatingScores = true;
    
    try {
      const fetch = (await import('node-fetch')).default;
      const scores = [];

      console.log(`[CALCULATE-SCORES] Processing ${room.submissions.size} submissions...`);
      
      for (const [playerName, submission] of room.submissions) {
        console.log(`[CALCULATE-SCORES] Processing submission from player ${submission.playerName} (name: ${playerName})`);
        
        try {
          // Compare submission description with target description
          console.log(`[CALCULATE-SCORES] Calling similarity API for ${submission.playerName}`);
          console.log(`[CALCULATE-SCORES] Submission description: "${submission.description}"`);
          console.log(`[CALCULATE-SCORES] Target description: "${room.targetDescription}"`);
          
          const compareRes = await fetch(`${getApiBaseUrl()}/api/minilm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text1: submission.description || '',
              text2: room.targetDescription
            })
          });
          
          if (!compareRes.ok) {
            console.error(`[CALCULATE-SCORES] API error for ${submission.playerName}: ${compareRes.status} ${compareRes.statusText}`);
            continue;
          }
          
          const compareData = await compareRes.json();
          const roundScore = Math.round(compareData.score * 100);
          
          console.log(`[CALCULATE-SCORES] Score for ${submission.playerName}: ${roundScore} (similarity: ${compareData.score})`);
          
          // Update player score (find by name instead of ID to handle reconnections)
          const player = room.players.find(p => p.name === playerName);
          if (player) {
            const oldScore = player.score;
            player.score += roundScore;
            console.log(`[CALCULATE-SCORES] Updated ${player.name} total score: ${oldScore} -> ${player.score}`);
          } else {
            console.error(`[CALCULATE-SCORES] Player not found for name: ${playerName}`);
          }
          
          scores.push({
            playerName: submission.playerName,
            roundScore,
            similarity: compareData.score,
            image: submission
          });
        } catch (error) {
          console.error(`[CALCULATE-SCORES] Error calculating score for ${submission.playerName}:`, error);
        }
      }

      console.log(`[CALCULATE-SCORES] Sending round results to room ${roomId}`);
      console.log(`[CALCULATE-SCORES] Round ${room.currentRound}/${room.totalRounds} completed`);
      
      // Send round results to all players
      io.to(roomId).emit('round-completed', {
        scores,
        players: room.players,
        currentRound: room.currentRound,
        totalRounds: room.totalRounds
      });

      console.log(`[CALCULATE-SCORES] Setting 3-second timeout for next round in room ${roomId}`);
      
      // Automatically progress to next round after 3 seconds
      setTimeout(async () => {
        console.log(`[NEXT-ROUND] Timeout triggered for room ${roomId}, checking round progression...`);
        
        // Reset the calculating flag
        room.calculatingScores = false;
        
        if (room.currentRound >= room.totalRounds) {
          console.log(`[NEXT-ROUND] Game finished in room ${roomId} (${room.currentRound}/${room.totalRounds})`);
          
          // Game finished
          room.gameState = 'finished';
          const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);
          
          console.log(`[NEXT-ROUND] Final scores: ${sortedPlayers.map(p => `${p.name}: ${p.score}`).join(', ')}`);
          console.log(`[NEXT-ROUND] Winner: ${sortedPlayers[0]?.name}`);
          
          io.to(roomId).emit('game-finished', {
            finalScores: sortedPlayers,
            winner: sortedPlayers[0]
          });
        } else {
          console.log(`[NEXT-ROUND] Starting next round in room ${roomId}: ${room.currentRound + 1}/${room.totalRounds}`);
          
          // Next round
          room.currentRound++;
          room.submissions.clear();
          
          console.log(`[NEXT-ROUND] Cleared submissions, fetching new target image...`);
          
          // Fetch new target image
          try {
            const fetch = (await import('node-fetch')).default;
            
            console.log(`[NEXT-ROUND] Calling Unsplash API...`);
            const unsplashRes = await fetch(`${getApiBaseUrl()}/api/unsplash`);
            const unsplashData = await unsplashRes.json();
            
            if (unsplashData.url) {
              room.targetImage = unsplashData.url;
              console.log(`[NEXT-ROUND] New target image: ${room.targetImage}`);
              
              console.log(`[NEXT-ROUND] Calling Gemini describe API...`);
              const describeRes = await fetch(`${getApiBaseUrl()}/api/geminidescribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl: unsplashData.url })
              });
              
              const describeData = await describeRes.json();
              room.targetDescription = describeData.description || '';
              console.log(`[NEXT-ROUND] New target description: "${room.targetDescription}"`);
            } else {
              console.error(`[NEXT-ROUND] No URL received from Unsplash API`);
            }
          } catch (error) {
            console.error(`[NEXT-ROUND] Failed to fetch target image:`, error);
          }

          console.log(`[NEXT-ROUND] Emitting next-round event to room ${roomId}`);
          
          io.to(roomId).emit('next-round', {
            currentRound: room.currentRound,
            targetImage: room.targetImage
          });
          
          console.log(`[NEXT-ROUND] Successfully started round ${room.currentRound} in room ${roomId}`);
        }
      }, 3000); // 3 second delay to show scores

    } catch (error) {
      console.error(`[CALCULATE-SCORES] Fatal error in calculateRoundScores for room ${roomId}:`, error);
      room.calculatingScores = false; // Reset flag on error
    }
  }

  const port = process.env.PORT || 4000;
  server.listen(port, '0.0.0.0', (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`> Network: http://192.168.1.13:${port}`);
      console.log(`> Other devices can connect using: http://192.168.1.13:${port}`);
    } else {
      console.log(`> Production server running on port ${port}`);
    }
  });
}).catch((error) => {
  console.error('Failed to prepare Next.js app:', error);
  process.exit(1);
});
