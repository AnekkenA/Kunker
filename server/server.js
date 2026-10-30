const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const zlib = require('zlib');
const { roomManager, CATEGORIES, getNetworkInfo } = require('./game_manager');
const deckLoader = require('./deck_loader');
const licenseGuard = require('./license_guard');

const PORT = process.env.PORT || 3000;
const CLIENT_DIR = path.join(__dirname, '..', 'client');

// Initialize license guard and re-broadcast on status change
licenseGuard.init((isLocked) => {
  for (const room of roomManager.rooms.values()) {
    broadcastRoom(room);
  }
});

// Broadcast state to all SSE clients connected to a specific room
function broadcastRoom(targetRoom) {
  if (!targetRoom || !targetRoom.sseClients) return;
  const stateCache = new Map();
  for (const client of targetRoom.sseClients) {
    try {
      let state = stateCache.get(client.playerId);
      if (!state) {
        state = targetRoom.toClientState(client.playerId);
        state.systemLocked = licenseGuard.isLocked();
        state.systemLockReason = licenseGuard.getLockReason();
        stateCache.set(client.playerId, state);
      }
      client.res.write(`data: ${JSON.stringify(state)}\n\n`);
    } catch (e) {
      targetRoom.sseClients.delete(client);
    }
  }
}

// Hook roomManager so rooms auto-attach broadcastRoom
roomManager.onRoomCreated = (room) => {
  room.setBroadcast(() => broadcastRoom(room));
};
for (const r of roomManager.rooms.values()) {
  r.setBroadcast(() => broadcastRoom(r));
}

// Helper to resolve the target room instance from request
function getGameFromReq(req, parsedUrl, body = null) {
  let roomId = null;
  if (body && body.roomId) roomId = body.roomId;
  if (!roomId && parsedUrl && parsedUrl.query && parsedUrl.query.room) roomId = parsedUrl.query.room;
  if (!roomId && req && req.headers && req.headers['x-room-id']) roomId = req.headers['x-room-id'];
  const room = roomManager.getRoom(roomId);
  if (!room.broadcastCallback) {
    room.setBroadcast(() => broadcastRoom(room));
  }
  return room;
}

// SSE keepalive ping every 15 seconds to prevent Cloudflare/NAT drops across all rooms
setInterval(() => {
  for (const room of roomManager.rooms.values()) {
    for (const client of room.sseClients) {
      try {
        client.res.write(': ping\n\n');
      } catch (e) {
        room.sseClients.delete(client);
      }
    }
  }
}, 15000);

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function parseBody(req, limit = 30 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > limit) {
        req.destroy();
        reject(new Error('Размер данных превышает лимит'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
  });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // 1. API: Server-Sent Events (SSE) Realtime Stream
  if (pathname === '/api/events') {
    const playerId = parsedUrl.query.playerId;
    const targetGame = getGameFromReq(req, parsedUrl);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*'
    });

    const clientObj = { res, playerId };
    targetGame.sseClients.add(clientObj);

    if (playerId && targetGame.players.has(playerId)) {
      const p = targetGame.players.get(playerId);
      p.connected = true;
      targetGame.emptySince = null;
    }

    // Send initial state immediately
    const initialState = targetGame.toClientState(playerId);
    res.write(`data: ${JSON.stringify(initialState)}\n\n`);

    req.on('close', () => {
      targetGame.sseClients.delete(clientObj);
      if (playerId && targetGame.players.has(playerId)) {
        const p = targetGame.players.get(playerId);
        p.connected = false;
      }
      const anyConnected = Array.from(targetGame.players.values()).some(p => p.connected);
      if (!anyConnected) {
        targetGame.emptySince = Date.now();
      }
    });
    return;
  }

  // 2. API Routes
  if (pathname.startsWith('/api/')) {
    try {
      // Create new unique room / game
      if (pathname === '/api/create_room' && req.method === 'POST') {
        const body = await parseBody(req);
        const customId = body ? (body.customRoomId || body.roomId) : null;
        const password = body && body.password ? String(body.password).trim() : '';
        const newGame = roomManager.createRoom(customId, password);
        newGame.touchActivity();
        newGame.setBroadcast(() => broadcastRoom(newGame));
        return sendJson(res, 200, {
          success: true,
          roomId: newGame.roomId,
          hasPassword: Boolean(newGame.password)
        });
      }

      // Room info (check existence, password requirement, player count, server capacity)
      if (pathname === '/api/room_info' && req.method === 'GET') {
        const roomId = parsedUrl.query.room;
        roomManager.cleanupIdleRooms();
        const targetRoom = roomManager.getRoom(roomId, false);
        if (!targetRoom) {
          return sendJson(res, 200, {
            exists: false,
            roomId: (roomId || '').trim().toUpperCase(),
            hasPassword: false,
            playersCount: 0,
            status: 'none',
            activeCount: roomManager.rooms.size,
            maxRooms: roomManager.maxRooms
          });
        }
        return sendJson(res, 200, {
          exists: true,
          roomId: targetRoom.roomId,
          hasPassword: Boolean(targetRoom.password),
          playersCount: targetRoom.players.size,
          status: targetRoom.status,
          lockedLobby: Boolean(targetRoom.lockedLobby),
          activeCount: roomManager.rooms.size,
          maxRooms: roomManager.maxRooms,
          idleSeconds: Math.floor((Date.now() - (targetRoom.lastActivity || Date.now())) / 1000)
        });
      }

      // List active rooms
      if (pathname === '/api/rooms' && req.method === 'GET') {
        return sendJson(res, 200, roomManager.listRooms());
      }

      // Join / Enter Game
      if (pathname === '/api/join' && req.method === 'POST') {
        const body = await parseBody(req);
        const targetGame = getGameFromReq(req, parsedUrl, body);
        const { playerId, isHost } = targetGame.joinPlayer(body.name, body.password, body.playerId);
        targetGame.broadcast();
        return sendJson(res, 200, {
          success: true,
          playerId,
          isHost,
          roomId: targetGame.roomId,
          state: targetGame.toClientState(playerId)
        });
      }

      // Game State
      if (pathname === '/api/state') {
        const targetGame = getGameFromReq(req, parsedUrl);
        const playerId = parsedUrl.query.playerId;
        return sendJson(res, 200, targetGame.toClientState(playerId));
      }

      // Actions
      if (pathname === '/api/action' && req.method === 'POST') {
        if (licenseGuard.isLocked()) {
          return sendJson(res, 403, { error: 'СЕРВЕР ЗАБЛОКИРОВАН: требуется авторизация копии игры в консоли сервера.' });
        }
        const body = await parseBody(req);
        const targetGame = getGameFromReq(req, parsedUrl, body);
        const { action, playerId, payload } = body;
        targetGame.touch();

        switch (action) {
          case 'send_chat': {
            const chatText = (payload && payload.text) ? String(payload.text) : '';
            targetGame.addChatMessage(playerId, chatText);
            break;
          }

          case 'reveal_card':
            targetGame.revealCard(payload.targetPlayerId, payload.categoryKey, playerId);
            break;

          case 'reveal_all_cards':
            targetGame.revealAllPlayerCards(payload.targetPlayerId, playerId);
            break;

          case 'toggle_exile':
            targetGame.toggleExile(payload.targetPlayerId, playerId);
            break;

          case 'start_preset':
            if (payload && Array.isArray(payload.decks)) {
              targetGame.selectedDecks = payload.decks;
            }
            if (payload && payload.bunkerCapacity) {
              targetGame.bunkerCapacity = parseInt(payload.bunkerCapacity, 10) || 1;
            }
            targetGame.mode = 'preset';
            targetGame.startPresetGame(playerId, {
              threatMode: payload ? payload.threatMode : 'threshold',
              threatPercent: payload ? payload.threatPercent : 50,
              worldCardsMaxLimit: payload ? payload.worldCardsMaxLimit : 6,
              cardsLeftClosed: payload ? payload.cardsLeftClosed : 1,
              categories: payload ? payload.categories : null,
              backgroundImage: payload ? payload.backgroundImage : null,
              cardBackImage: payload ? payload.cardBackImage : null,
              deckAuthor: payload ? payload.deckAuthor : null
            });
            break;

          case 'play_special_action': {
            const resData = targetGame.playSpecialCardAction(playerId, payload.actionType, payload.params);
            targetGame.broadcast();
            return sendJson(res, 200, { success: true });
          }

          case 'reveal_exiled_all':
            targetGame.revealExiledPlayerCards(payload.targetPlayerId, playerId);
            break;

          case 'claim_host':
            // Only allow claiming host if there is NO active host in room
            if (targetGame.hostId && targetGame.players.has(targetGame.hostId) && targetGame.hostId !== playerId) {
              throw new Error('В бункере уже есть назначенный Мастер. Только Мастер может передать права.');
            }
            targetGame.setHost(playerId);
            break;

          case 'transfer_host':
            if (targetGame.hostId !== playerId) {
              throw new Error('Только текущий Мастер может передавать права.');
            }
            targetGame.setHost(payload.targetPlayerId);
            break;

          case 'kick_player': {
            if (targetGame.hostId !== playerId) {
              throw new Error('Только Мастер может удалять игроков из шлюза.');
            }
            const targetId = payload.targetPlayerId;
            if (!targetId || targetId === targetGame.hostId) {
              throw new Error('Нельзя удалить самого себя или несуществующего игрока.');
            }
            targetGame.removePlayer(targetId);
            for (const client of targetGame.sseClients) {
              if (client.playerId === targetId) {
                try {
                  client.res.write(`data: ${JSON.stringify({ type: 'kicked', message: 'Вы были исключены Мастером из шлюза.' })}\n\n`);
                } catch (e) {}
              }
            }
            break;
          }

          case 'leave_room': {
            targetGame.removePlayer(playerId);
            const anyConnected = Array.from(targetGame.players.values()).some(p => p.connected);
            if (!anyConnected || targetGame.players.size === 0) {
              targetGame.emptySince = Date.now();
              targetGame.logs = [];
              targetGame.chatMessages = [];
            }
            break;
          }

          case 'start_ugc_phase':
            targetGame.mode = 'ugc';
            if (payload && payload.bunkerCapacity) {
              targetGame.bunkerCapacity = parseInt(payload.bunkerCapacity, 10) || 1;
            }
            targetGame.startUgcPhase(playerId, payload || {});
            break;

          case 'submit_ugc':
            targetGame.submitUgcCards(playerId, payload.submissions);
            break;

          case 'start_ugc_game':
            targetGame.startUgcGame(playerId, payload ? payload.saveThemeName : null, {
              backgroundImage: payload ? payload.backgroundImage : null,
              cardBackImage: payload ? payload.cardBackImage : null
            });
            break;

          case 'replace_card':
            targetGame.replacePlayerCard(payload.targetPlayerId || playerId, payload.categoryKey, playerId);
            break;

          case 'change_bunker_capacity':
            targetGame.changeBunkerCapacity(payload.delta, playerId);
            break;

          case 'reveal_other_card':
            targetGame.revealOtherPlayerCard(payload.targetPlayerId, payload.categoryKey, playerId);
            break;

          case 'shuffle_selected_cards':
            targetGame.shuffleSelectedCards(payload.categoryKey, payload.playerIds, playerId);
            break;

          case 'draw_world_card':
            targetGame.drawWorldCard();
            break;

          case 'submit_evaluation':
            targetGame.submitSurvivalEvaluation(payload.evaluation, playerId);
            break;

          case 'swap_cards':
            targetGame.swapPlayerCards(payload.player1Id, payload.player2Id, payload.categoryKey, playerId);
            break;

          case 'shuffle_revealed_cards':
            targetGame.shuffleSelectedCards(payload.categoryKey, Array.from(targetGame.players.keys()), playerId);
            break;

          case 'steal_card':
            targetGame.stealPlayerCard(payload.fromPlayerId, payload.toPlayerId, payload.categoryKey, playerId);
            break;

          case 'steal_inventory':
            targetGame.stealInventory(playerId, payload.targetPlayerId, payload.categoryKey);
            break;

          case 'start_speaker_timer':
            targetGame.startSpeakerTimer(payload ? payload.seconds : 30, playerId);
            break;

          case 'stop_speaker_timer':
            targetGame.stopSpeakerTimer(false);
            break;

          case 'start_voting':
            targetGame.startVoting(playerId, payload ? payload.candidates : null);
            break;

          case 'cast_vote':
            targetGame.castVote(playerId, payload.targetPlayerId);
            break;

          case 'end_voting':
            targetGame.endVoting(playerId);
            break;

          case 'cancel_voting':
            targetGame.cancelVoting(playerId);
            break;

          case 'finish_game':
            if (payload && payload.evaluation) {
              targetGame.submitSurvivalEvaluation(payload.evaluation, playerId);
            } else {
              targetGame.finishGame(playerId);
            }
            break;

          case 'reset_lobby':
            targetGame.resetToLobby(playerId);
            break;

          case 'update_room_access':
            if (playerId !== targetGame.hostId) throw new Error('Только Мастер может настраивать доступ к бункеру');
            if (payload && payload.password !== undefined) {
              targetGame.password = String(payload.password).trim();
              if (targetGame.password) {
                targetGame.addLog(`🔒 Мастер установил пароль для бункера.`);
              } else {
                targetGame.addLog(`🔓 Мастер снял пароль с бункера.`);
              }
            }
            if (payload && payload.lockedLobby !== undefined) {
              targetGame.lockedLobby = Boolean(payload.lockedLobby);
              if (targetGame.lockedLobby) {
                targetGame.addLog(`🚫 Мастер запер шлюз бункера (вход закрыт).`);
              } else {
                targetGame.addLog(`🚪 Мастер открыл шлюз бункера для входа.`);
              }
            }
            break;

          case 'update_settings':
            if (playerId !== targetGame.hostId) throw new Error('Только мастер может менять настройки');
            if (payload.bunkerCapacity) targetGame.bunkerCapacity = parseInt(payload.bunkerCapacity, 10) || 1;
            if (payload.decks) targetGame.selectedDecks = payload.decks;
            if (payload.password !== undefined) targetGame.password = String(payload.password).trim();
            if (payload.lockedLobby !== undefined) targetGame.lockedLobby = Boolean(payload.lockedLobby);
            break;

          default:
            return sendJson(res, 400, { error: `Неизвестное действие: ${action}` });
        }

        targetGame.broadcast();
        return sendJson(res, 200, { success: true });
      }

      // Network Info
      if (pathname === '/api/network' && req.method === 'GET') {
        const targetGame = getGameFromReq(req, parsedUrl);
        return sendJson(res, 200, getNetworkInfo(targetGame.roomId));
      }

      // Deck endpoints
      if (pathname === '/api/decks' && req.method === 'GET') {
        deckLoader.loadAllDecks();
        return sendJson(res, 200, { decks: deckLoader.getDeckList() });
      }

      if (pathname.startsWith('/api/decks/') && req.method === 'GET') {
        const id = pathname.replace('/api/decks/', '');
        const deck = deckLoader.getDeck(id);
        if (!deck) return sendJson(res, 404, { error: 'Колода не найдена' });
        return sendJson(res, 200, { deck });
      }

      if (pathname === '/api/decks/save' && req.method === 'POST') {
        const body = await parseBody(req);
        const saved = deckLoader.saveDeck(body);
        const targetGame = getGameFromReq(req, parsedUrl, body);
        if (targetGame && body && body.autoSelect) {
          if (!targetGame.selectedDecks.includes(saved.id)) {
            targetGame.selectedDecks.push(saved.id);
          }
          targetGame.broadcast();
        }
        return sendJson(res, 200, { success: true, deck: saved });
      }

      if (pathname === '/api/decks/delete' && req.method === 'POST') {
        const body = await parseBody(req);
        if (deckLoader.BUILTIN_DECK_IDS && deckLoader.BUILTIN_DECK_IDS.has(body.id)) {
          return sendJson(res, 400, { error: 'Стандартные встроенные темы нельзя удалять.' });
        }
        deckLoader.deleteDeck(body.id);
        return sendJson(res, 200, { success: true });
      }

      // Upload image endpoint (supports PNG, JPG, JPEG, WEBP, GIF up to 25MB)
      if (pathname === '/api/upload_image' && req.method === 'POST') {
        const body = await parseBody(req);
        if (!body || !body.data) {
          return sendJson(res, 400, { error: 'Данные изображения отсутствуют' });
        }

        const match = String(body.data).match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
        if (!match) {
          return sendJson(res, 400, { error: 'Неверный формат изображения (поддерживаются PNG, JPG, WEBP)' });
        }

        let ext = match[1].toLowerCase();
        if (ext === 'jpeg') ext = 'jpg';
        const base64Data = match[2];
        const buffer = Buffer.from(base64Data, 'base64');

        const uploadsDir = path.join(CLIENT_DIR, 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const cleanName = (body.filename || 'image').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 25);
        const fileName = `${Date.now()}_${cleanName}.${ext}`;
        const targetPath = path.join(uploadsDir, fileName);

        fs.writeFileSync(targetPath, buffer);
        const url = `/uploads/${fileName}`;
        return sendJson(res, 200, { success: true, url, fileName });
      }

      // License status endpoint
      if (pathname === '/api/license_status' && req.method === 'GET') {
        return sendJson(res, 200, {
          locked: licenseGuard.isLocked(),
          reason: licenseGuard.getLockReason()
        });
      }

      return sendJson(res, 404, { error: 'API endpoint not found' });
    } catch (err) {
      return sendJson(res, 400, { error: err.message || 'Ошибка сервера' });
    }
  }

  // 3. Static Files Delivery
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') {
    safePath = '/index.html';
  }

  const filePath = path.join(CLIENT_DIR, safePath);

  if (!filePath.startsWith(CLIENT_DIR)) {
    res.writeHead(403);
    return res.end('Access denied');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const indexPath = path.join(CLIENT_DIR, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
        return fs.createReadStream(indexPath).pipe(res);
      }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const acceptEncoding = req.headers['accept-encoding'] || '';

    const headers = {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    };

    // Disable caching completely for realtime multiplayer web app
    headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    headers['Pragma'] = 'no-cache';
    headers['Expires'] = '0';

    if (acceptEncoding.includes('gzip') && (contentType.includes('text') || contentType.includes('javascript') || contentType.includes('json') || contentType.includes('svg'))) {
      headers['Content-Encoding'] = 'gzip';
      res.writeHead(200, headers);
      fs.createReadStream(filePath).pipe(zlib.createGzip()).pipe(res);
    } else {
      res.writeHead(200, headers);
      fs.createReadStream(filePath).pipe(res);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=================================================`);
  console.log(`  Сервер игры «Бункер» запущен.`);
  console.log(`  Локальный адрес: http://localhost:${PORT}`);
  console.log(`=================================================`);
});
