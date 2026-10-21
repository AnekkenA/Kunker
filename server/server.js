const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const zlib = require('zlib');
const { game, CATEGORIES, getNetworkInfo } = require('./game_manager');
const deckLoader = require('./deck_loader');

const PORT = process.env.PORT || 3000;
const CLIENT_DIR = path.join(__dirname, '..', 'client');

// SSE clients set: Set of { res, playerId }
const sseClients = new Set();

function broadcast() {
  for (const client of sseClients) {
    try {
      const state = game.toClientState(client.playerId);
      client.res.write(`data: ${JSON.stringify(state)}\n\n`);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

// Hook broadcast into game manager for timer auto-updates
game.setBroadcast(broadcast);

// SSE keepalive ping every 15 seconds to prevent Cloudflare/NAT drops
setInterval(() => {
  for (const client of sseClients) {
    try {
      client.res.write(': ping\n\n');
    } catch (e) {
      sseClients.delete(client);
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

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Body too large'));
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

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*'
    });

    const clientObj = { res, playerId };
    sseClients.add(clientObj);

    // Send initial state immediately
    const initialState = game.toClientState(playerId);
    res.write(`data: ${JSON.stringify(initialState)}\n\n`);

    req.on('close', () => {
      sseClients.delete(clientObj);
    });
    return;
  }

  // 2. API Routes
  if (pathname.startsWith('/api/')) {
    try {
      // Join / Enter Game
      if (pathname === '/api/join' && req.method === 'POST') {
        const body = await parseBody(req);
        const { playerId, isHost } = game.joinPlayer(body.name, body.password);
        broadcast();
        return sendJson(res, 200, {
          success: true,
          playerId,
          isHost,
          state: game.toClientState(playerId)
        });
      }

      // Game State
      if (pathname === '/api/state') {
        const playerId = parsedUrl.query.playerId;
        return sendJson(res, 200, game.toClientState(playerId));
      }

      // Actions
      if (pathname === '/api/action' && req.method === 'POST') {
        const body = await parseBody(req);
        const { action, playerId, payload } = body;

        switch (action) {
          case 'reveal_card':
            game.revealCard(payload.targetPlayerId, payload.categoryKey, playerId);
            break;

          case 'reveal_all_cards':
            game.revealAllPlayerCards(payload.targetPlayerId, playerId);
            break;

          case 'toggle_exile':
            game.toggleExile(payload.targetPlayerId, playerId);
            break;

          case 'start_preset':
            if (payload && Array.isArray(payload.decks)) {
              game.selectedDecks = payload.decks;
            }
            if (payload && payload.bunkerCapacity) {
              game.bunkerCapacity = parseInt(payload.bunkerCapacity, 10) || 1;
            }
            game.mode = 'preset';
            game.startPresetGame(playerId, {
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
            const res = game.playSpecialCardAction(playerId, payload.actionType, payload.params);
            broadcastState();
            if (res && res.privateSpyResult) {
              return sendJson(200, { success: true, spyResult: res.privateSpyResult });
            }
            return sendJson(200, { success: true });
          }

          case 'reveal_exiled_all':
            game.revealExiledPlayerCards(payload.targetPlayerId, playerId);
            break;

          case 'start_ugc_phase':
            game.mode = 'ugc';
            if (payload && payload.bunkerCapacity) {
              game.bunkerCapacity = parseInt(payload.bunkerCapacity, 10) || 1;
            }
            game.startUgcPhase(playerId, { threatMode: payload ? payload.threatMode : 'threshold' });
            break;

          case 'submit_ugc':
            game.submitUgcCards(playerId, payload.submissions);
            break;

          case 'start_ugc_game':
            game.startUgcGame(playerId, payload ? payload.saveThemeName : null);
            break;

          case 'replace_card':
            game.replacePlayerCard(payload.targetPlayerId || playerId, payload.categoryKey, playerId);
            break;

          case 'change_bunker_capacity':
            game.changeBunkerCapacity(payload.delta, playerId);
            break;

          case 'reveal_other_card':
            game.revealOtherPlayerCard(payload.targetPlayerId, payload.categoryKey, playerId);
            break;

          case 'shuffle_selected_cards':
            game.shuffleSelectedCards(payload.categoryKey, payload.playerIds, playerId);
            break;

          case 'draw_world_card':
            game.drawWorldCard();
            break;

          case 'submit_evaluation':
            game.submitSurvivalEvaluation(payload.evaluation, playerId);
            break;

          case 'swap_cards':
            game.swapPlayerCards(payload.player1Id, payload.player2Id, payload.categoryKey, playerId);
            break;

          case 'shuffle_revealed_cards':
            game.shuffleSelectedCards(payload.categoryKey, Array.from(game.players.keys()), playerId);
            break;

          case 'steal_card':
            game.stealPlayerCard(payload.fromPlayerId, payload.toPlayerId, payload.categoryKey, playerId);
            break;

          case 'finish_game':
            // Opens questionnaire or direct finish
            if (payload && payload.evaluation) {
              game.submitSurvivalEvaluation(payload.evaluation, playerId);
            } else {
              game.finishGame(playerId);
            }
            break;

          case 'reset_lobby':
            game.resetToLobby(playerId);
            break;

          case 'update_settings':
            if (playerId !== game.hostId) throw new Error('Только мастер может менять настройки');
            if (payload.bunkerCapacity) game.bunkerCapacity = parseInt(payload.bunkerCapacity, 10) || 1;
            if (payload.decks) game.selectedDecks = payload.decks;
            if (payload.password !== undefined) game.password = String(payload.password).trim();
            break;

          default:
            return sendJson(res, 400, { error: `Неизвестное действие: ${action}` });
        }

        broadcast();
        return sendJson(res, 200, { success: true });
      }

      // Network Info
      if (pathname === '/api/network' && req.method === 'GET') {
        return sendJson(res, 200, getNetworkInfo());
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
        return sendJson(res, 200, { success: true, deck: saved });
      }

      if (pathname === '/api/decks/delete' && req.method === 'POST') {
        const body = await parseBody(req);
        deckLoader.deleteDeck(body.id);
        return sendJson(res, 200, { success: true });
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

    if (ext === '.css' || ext === '.js' || ext === '.svg' || ext === '.png' || ext === '.ico') {
      headers['Cache-Control'] = 'public, max-age=86400';
    } else {
      headers['Cache-Control'] = 'no-cache';
    }

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
