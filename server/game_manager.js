const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const deckLoader = require('./deck_loader');
const TagHelper = require('../client/js/tag_helper');

function getNetworkInfo(roomId = null) {
  const queryParam = roomId ? `?room=${encodeURIComponent(roomId)}` : '';

  const renderUrl = process.env.RENDER_EXTERNAL_URL;
  if (renderUrl) {
    const base = renderUrl.replace(/\/+$/, '');
    return {
      roomId: roomId || 'BUNKER-101',
      publicUrl: `${base}/${queryParam}`,
      localIpUrl: `${base}/${queryParam}`,
      radminIpUrl: null,
      localhostUrl: `${base}/${queryParam}`
    };
  }

  const tunnelPath = path.join(__dirname, 'tunnel_info.json');
  let publicUrl = null;
  if (fs.existsSync(tunnelPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(tunnelPath, 'utf-8'));
      publicUrl = data.publicUrl || data.primaryUrl;
    } catch (e) {}
  }

  const interfaces = os.networkInterfaces();
  let localIp = null;
  let radminIp = null;

  for (const name of Object.keys(interfaces)) {
    const isRadmin = /radmin/i.test(name);
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (iface.address.startsWith('26.') || isRadmin) {
          radminIp = iface.address;
        } else if (iface.address.startsWith('192.168.') || iface.address.startsWith('10.')) {
          if (!/vethernet|virtual|vbox|vmware|wsl/i.test(name)) {
            localIp = iface.address;
          }
        }
      }
    }
  }

  const cleanPublic = publicUrl ? (publicUrl.replace(/\/+$/, '') + '/' + queryParam) : null;
  const localBase = localIp ? `http://${localIp}:3000` : 'http://localhost:3000';

  return {
    roomId: roomId || 'BUNKER-101',
    publicUrl: cleanPublic,
    localIpUrl: `${localBase}/${queryParam}`,
    radminIpUrl: radminIp ? `http://${radminIp}:3000/${queryParam}` : null,
    localhostUrl: `http://localhost:3000/${queryParam}`
  };
}

const CATEGORIES = [
  { key: 'profession', name: 'Профессия', icon: '💼', isSpecial: false },
  { key: 'health', name: 'Здоровье', icon: '❤️', isSpecial: false },
  { key: 'biology', name: 'Биология', icon: '🧬', isSpecial: false },
  { key: 'hobby', name: 'Хобби', icon: '🎨', isSpecial: false },
  { key: 'traits', name: 'Черты', icon: '🧠', isSpecial: false },
  { key: 'facts', name: 'Доп. сведения', icon: '📜', isSpecial: false },
  { key: 'small_inventory', name: 'Малый инв.', icon: '🎒', isSpecial: false },
  { key: 'large_inventory', name: 'Крупный инв.', icon: '📦', isSpecial: false },
  { key: 'special_cards', name: 'Спец-карта', icon: '⚡', isSpecial: true }
];

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getRandomItem(array, fallback = '—') {
  if (!array || array.length === 0) return fallback;
  return array[Math.floor(Math.random() * array.length)];
}

function detectSpecialAction(text) {
  if (!text) return 'custom';
  const t = text.toLowerCase();
  if ((t.includes('голос') && (t.includes('+1') || t.includes('два голос') || t.includes('двойной') || t.includes('дополнительн'))) || t.includes('веское слово')) {
    return 'vote_plus_one';
  }
  if (t.includes('изгнанн') && (t.includes('голос') || t.includes('мертв') || t.includes('павших'))) {
    return 'vote_exiled_power';
  }
  if ((t.includes('краж') || t.includes('украс') || t.includes('забер') || t.includes('отобрать')) && (t.includes('проголос') || t.includes('голосовавш') || t.includes('обвинител'))) {
    return 'steal_voter_card';
  }
  if (t.includes('краж') || t.includes('украс') || t.includes('забрать инвентар') || t.includes('своровать') || t.includes('ловкие пальцы')) {
    return 'steal_inventory';
  }
  if (t.includes('перемешать') || t.includes('хаос') || t.includes('перемешивание')) {
    return 'shuffle_category';
  }
  if (t.includes('+1') || t.includes('увеличит') || t.includes('увеличива') || t.includes('расширение убежищ') || (t.includes('вместимост') && t.includes('+'))) {
    return 'bunker_cap_plus';
  }
  if (t.includes('-1') || (t.includes('вместимост') && (t.includes('-') || t.includes('уменьш')))) {
    return 'bunker_cap_minus';
  }
  if (t.includes('иммунитет') || t.includes('второе дыхание') || t.includes('отмените свое изгнание')) {
    return 'exile_immunity';
  }
  if (t.includes('ликвидаци') || t.includes('сброс угроз') || t.includes('предотвращен') || t.includes('огнезащита бункера')) {
    return 'discard_threat';
  }
  if (t.includes('помилован') || t.includes('верните') || t.includes('возвращен') || t.includes('воскреш')) {
    return 'resurrect_exiled';
  }
  if (t.includes('обмен') || t.includes('поменяться картой') || t.includes('равноценный обмен')) {
    return 'exchange_card';
  }
  if (t.includes('замените') || t.includes('сбросьте свою') || t.includes('второй шанс') || t.includes('перераспредел')) {
    return 'reroll_card';
  }
  return 'custom';
}

class SingleGame {
  constructor(roomId = '101') {
    this.roomId = (roomId || '101').trim().toUpperCase();
    this.sseClients = new Set();
    this.broadcastCallback = null;
    this.password = '';
    this.lockedLobby = false;
    this.lastActivity = Date.now();
    this.resetGame();
  }

  setBroadcast(fn) {
    this.broadcastCallback = fn;
  }

  notifyBroadcast() {
    this.touchActivity();
    if (typeof this.broadcastCallback === 'function') {
      this.broadcastCallback(this);
    }
  }

  touchActivity() {
    this.lastActivity = Date.now();
    this.emptySince = null;
  }

  touch() {
    this.touchActivity();
  }

  broadcast() {
    this.touchActivity();
    this.notifyBroadcast();
  }

  resetGame() {
    this.stopThreatTimer();
    this.stopSpeakerTimer();

    this.touchActivity();
    // Preserve password across game restarts, reset lobby lock
    this.lockedLobby = false;
    this.hostId = null;
    this.status = 'lobby'; // 'lobby' | 'ugc_building' | 'playing' | 'finished'
    this.mode = 'preset'; // 'preset' | 'ugc'
    this.selectedDecks = ['classic'];
    this.bunkerCapacity = 3;

    // Speaker / Debate Timer
    this.speakerTimer = null;
    this.speakerTimerHandle = null;

    // Voting state & history
    this.voting = null;
    this.lastVotingHistory = null;

    // Threat / Bunker opening settings
    this.threatMode = 'threshold'; // 'threshold' | 'timer'
    this.threatTimerSeconds = 120; // 2 minutes (120s)
    this.threatTimerCountdown = 120;
    this.threatTimerHandle = null;

    // Threat / Bunker limits and probabilities (customizable by Master)
    this.worldCardsMaxLimit = 6; // Max world cards allowed on table
    this.threatPercent = 50; // Chance of Threat (0-100), bunker is 100 - threatPercent
    this.cardsLeftClosed = 1; // Number of regular cards left closed in finale

    // Categories (customizable by Master)
    this.categories = JSON.parse(JSON.stringify(CATEGORIES));

    // Round milestone triggers (triggers when every active player reveals at least 2, 3, 4... cards)
    this.triggeredRoundMilestones = new Set();
    this.totalRevealsCount = 0;

    // World Cards
    this.disaster = null;
    this.bunkerDeck = [];
    this.threatsDeck = [];
    this.revealedBunkerCards = [];
    this.revealedThreatCards = [];

    // Card Category Decks & In-Play tracking (STRICT 1 COPY PER CARD)
    this.categoryDecks = {};
    this.inPlayCards = {};
    this.categories.forEach(cat => {
      this.categoryDecks[cat.key] = [];
      this.inPlayCards[cat.key] = new Set();
    });

    this.results = null;
    this.players = new Map();
    this.logs = [];
    this.chatMessages = [];

    // Theme Background & Card Back custom images & Author
    this.backgroundImage = null;
    this.cardBackImage = null;
    this.deckAuthor = 'Бункер 3.1';

    this.addLog('Бункер инициализирован и готов к приему выживших.');
  }

  // Calculate sum of survival parameters (fire, medicine, food, etc.) among active survivors
  // onlyRevealed = true (default during gameplay) counts ONLY revealed cards of non-exiled survivors
  // onlyRevealed = false (during final evaluation) counts ALL cards of non-exiled survivors
  calculateTeamResources(onlyRevealed = true) {
    const activeSurvivors = Array.from(this.players.values()).filter(p => !p.isExiled);
    const totals = {
      fire: 0,
      medicine: 0,
      food: 0,
      engineering: 0,
      psycho: 0,
      defense: 0,
      science: 0,
      custom: {}
    };

    activeSurvivors.forEach(p => {
      Object.values(p.cards || {}).forEach(c => {
        if (!c) return;
        if (onlyRevealed && !c.revealed) return;
        const tags = c.tags || [];
        tags.forEach(t => {
          if (totals[t.key] !== undefined) {
            totals[t.key] += (t.value || 1);
          } else if (t.name) {
            totals.custom[t.name] = (totals.custom[t.name] || 0) + (t.value || 1);
          }
        });
      });
    });

    return totals;
  }

  // Interactive Special Cards Execution
  playSpecialCardAction(requesterId, actionType, params = {}) {
    const player = this.players.get(requesterId);
    if (!player) throw new Error('Игрок не найден.');

    const specialCard = player.cards['special_cards'];
    if (!specialCard) throw new Error('У игрока нет спец-карты.');

    // Reveal special card
    specialCard.revealed = true;
    const cardTitle = specialCard.cleanText || specialCard.text || 'Спец-возможность';

    let result = { success: true };

    const resolvedAction = (actionType && actionType !== 'custom')
      ? actionType
      : (specialCard.action || detectSpecialAction(specialCard.text));

    switch (resolvedAction) {
      case 'bunker_cap_plus': {
        this.bunkerCapacity += 1;
        this.addLog(`⚡ ${player.name} сыграл спец-карту «${cardTitle}»: Вместимость бункера УВЕЛИЧЕНА на +1 (теперь мест: ${this.bunkerCapacity})!`);
        break;
      }

      case 'bunker_cap_minus': {
        this.bunkerCapacity = Math.max(1, this.bunkerCapacity - 1);
        this.addLog(`⚡ ${player.name} сыграл спец-карту «${cardTitle}»: Вместимость бункера УМЕНЬШЕНА на -1 (теперь мест: ${this.bunkerCapacity})!`);
        break;
      }

      case 'exile_immunity': {
        player.exileImmunity = true;
        this.addLog(`⚡ ${player.name} сыграл спец-карту «${cardTitle}»: Получен иммунитет к изгнанию на следующее голосование!`);
        break;
      }

      case 'discard_threat': {
        const threatIdx = parseInt(params.threatIndex, 10);
        if (this.revealedThreatCards.length > 0) {
          let removed;
          if (!isNaN(threatIdx) && threatIdx >= 0 && threatIdx < this.revealedThreatCards.length) {
            removed = this.revealedThreatCards.splice(threatIdx, 1)[0];
          } else {
            removed = this.revealedThreatCards.pop();
          }
          this.addLog(`⚡ ${player.name} сыграл спец-карту «${cardTitle}»: Угроза «${removed.title || 'Угроза'}» обезврежена и сброшена!`);
        } else {
          this.addLog(`⚡ ${player.name} сыграл спец-карту «${cardTitle}» (на столе не было активных угроз).`);
        }
        break;
      }

      case 'force_reveal_other': {
        const targetPlayer = this.players.get(params.targetPlayerId);
        if (!targetPlayer) throw new Error('Целевой игрок не найден.');
        const catKey = params.categoryKey || 'profession';
        if (!targetPlayer.cards[catKey]) throw new Error('Категория не найдена.');
        targetPlayer.cards[catKey].revealed = true;
        const catObj = this.categories.find(c => c.key === catKey);
        const catName = catObj ? catObj.name : catKey;
        this.addLog(`⚡ ${player.name} сыграл «Публичное разоблачение»: карта [${catName}] игрока ${targetPlayer.name} открыта: "${targetPlayer.cards[catKey].text}"!`);
        this.checkRoundMilestoneTriggers();
        break;
      }

      case 'exchange_card': {
        const targetPlayer = this.players.get(params.targetPlayerId);
        if (!targetPlayer) throw new Error('Целевой игрок не найден.');
        const catKey = params.categoryKey || 'profession';
        const myCard = player.cards[catKey];
        const theirCard = targetPlayer.cards[catKey];
        if (!myCard || !theirCard) throw new Error('Категория для обмена не найдена.');

        const temp = { ...myCard };
        player.cards[catKey] = { ...theirCard };
        targetPlayer.cards[catKey] = temp;

        const catObj = this.categories.find(c => c.key === catKey);
        const catName = catObj ? catObj.name : catKey;
        this.addLog(`⚡ ${player.name} сыграл «Обмен судьбами»: обменялся картой [${catName}] с игроком ${targetPlayer.name}!`);
        break;
      }

      case 'reroll_card': {
        const catKey = params.categoryKey || 'profession';
        this.replacePlayerCard(player.id, catKey, player.id, true);
        const catObj = this.categories.find(c => c.key === catKey);
        const catName = catObj ? catObj.name : catKey;
        this.addLog(`⚡ ${player.name} сыграл «Второй шанс»: заменил [${catName}] на случайную свободную карту из колоды!`);
        break;
      }

      case 'resurrect_exiled': {
        const targetPlayer = this.players.get(params.targetPlayerId);
        if (!targetPlayer) throw new Error('Игрок не найден.');
        targetPlayer.isExiled = false;
        this.addLog(`⚡ ${player.name} сыграл «Возвращение»: вернул изгнанного игрока ${targetPlayer.name} обратно в бункер!`);
        this.checkRoundMilestoneTriggers();
        break;
      }

      case 'vote_plus_one': {
        player.votingBonus = (player.votingBonus || 0) + 1;
        this.addLog(`⚡ ${player.name} сыграл спец-карту «${cardTitle}»: Получен +1 дополнительный голос на ближайшем голосовании!`);
        break;
      }

      case 'vote_exiled_power': {
        player.voteExiledPower = true;
        const exCount = Array.from(this.players.values()).filter(p => p.isExiled).length;
        this.addLog(`⚡ ${player.name} сыграл спец-карту «${cardTitle}»: Голос в голосовании будет усилен на число изгнанных игроков (+${exCount} гол.)!`);
        break;
      }

      case 'steal_inventory': {
        const catKey = params.categoryKey || 'small_inventory';
        this.stealInventory(requesterId, params.targetPlayerId, catKey);
        break;
      }

      case 'steal_voter_card': {
        const votes = this.lastVotingHistory ? this.lastVotingHistory.votes : {};
        const votersAgainstMe = Object.entries(votes || {})
          .filter(([voterId, targetId]) => targetId === requesterId)
          .map(([voterId]) => voterId);

        if (votersAgainstMe.length === 0) {
          throw new Error('В последнем голосовании против вас никто не голосовал (или голосования еще не было).');
        }

        const targetId = params.targetPlayerId || votersAgainstMe[0];
        if (!votersAgainstMe.includes(targetId)) {
          throw new Error('Вы можете красть карту только у того игрока, кто голосовал против вас в последнем раунде!');
        }

        const catKey = params.categoryKey || 'small_inventory';
        this.stealInventory(requesterId, targetId, catKey);
        break;
      }

      case 'shuffle_category': {
        const catKey = params.categoryKey || 'hobby';
        const activeIds = Array.from(this.players.values()).filter(p => !p.isExiled).map(p => p.id);
        if (activeIds.length >= 2) {
          this.shuffleSelectedCards(catKey, activeIds, this.hostId);
        } else {
          this.addLog(`⚡ ${player.name} сыграл «Командный хаос» (недостаточно активных игроков для перемешивания).`);
        }
        break;
      }

      default: {
        this.addLog(`⚡ ${player.name} разыграл спец-карту: "${cardTitle}"!`);
        break;
      }
    }

    return result;
  }

  addLog(text) {
    const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    this.logs.unshift({ time, text });
    if (this.logs.length > 60) this.logs.pop();
  }

  addChatMessage(playerId, text) {
    if (!text || typeof text !== 'string') return;
    const cleanText = text.trim().substring(0, 300);
    if (!cleanText) return;

    let senderName = 'Выживший';
    let isHost = false;
    if (playerId && this.players.has(playerId)) {
      const p = this.players.get(playerId);
      senderName = p.name;
      isHost = Boolean(p.isHost);
    }

    // Sanitize HTML
    const sanitized = cleanText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const msg = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      playerId,
      sender: senderName,
      isHost,
      text: sanitized,
      time
    };

    if (!Array.isArray(this.chatMessages)) {
      this.chatMessages = [];
    }
    this.chatMessages.push(msg);
    if (this.chatMessages.length > 100) {
      this.chatMessages.shift();
    }

    this.touch();
    return msg;
  }

  checkPassword(enteredPassword) {
    if (!this.password) return true;
    return String(enteredPassword || '').trim() === this.password;
  }

  joinPlayer(name, enteredPassword, existingPlayerId = null) {
    const cleanName = (name || 'Выживший').trim().substring(0, 24);
    if (!cleanName) {
      throw new Error('Введите ваше имя (никнейм).');
    }

    // 1. Reconnect by explicit playerId if provided
    if (existingPlayerId && this.players.has(existingPlayerId)) {
      const existing = this.players.get(existingPlayerId);
      existing.name = cleanName;
      existing.connected = true;
      this.lastActivity = Date.now();
      this.addLog(`👤 ${existing.name} восстановил связь с бункером.`);
      return { player: existing, playerId: existing.id, isHost: existing.isHost };
    }

    // 2. Prevent duplicate phantom guests: if a player with this exact name is already in the room, reconnect them
    for (const [id, p] of this.players.entries()) {
      if (p.name.trim().toLowerCase() === cleanName.toLowerCase()) {
        p.connected = true;
        this.lastActivity = Date.now();
        this.addLog(`👤 ${p.name} вернулся в бункер ${p.isHost ? '(Мастер игры)' : ''}`);
        return { player: p, playerId: p.id, isHost: p.isHost };
      }
    }

    // 3. Prevent new players if lobby is locked
    if (this.lockedLobby) {
      throw new Error('Шлюз бункера заблокирован Мастером. Вход новых игроков закрыт.');
    }

    // 4. Verify password for new players entering a password-protected room
    if (this.password) {
      if (!enteredPassword || String(enteredPassword).trim() === '') {
        throw new Error('Для входа в этот бункер требуется пароль.');
      }
      if (!this.checkPassword(enteredPassword)) {
        throw new Error('Неверный пароль от бункера.');
      }
    }

    this.lastActivity = Date.now();

    const playerId = crypto.randomUUID();
    const isHost = this.players.size === 0 || !this.hostId;
    if (isHost) {
      this.hostId = playerId;
    }

    const player = {
      id: playerId,
      name: cleanName,
      isHost,
      isExiled: false,
      connected: true,
      cards: {},
      ugcSubmissions: null,
      ugcReady: false
    };

    this.categories.forEach(cat => {
      player.cards[cat.key] = { text: '', revealed: false };
    });

    this.players.set(playerId, player);
    this.addLog(`👤 ${player.name} вошел в убежище ${isHost ? '(Мастер игры)' : ''}`);
    this.updateBunkerCapacityDefault();

    return { player, playerId, isHost };
  }

  setHost(targetPlayerId) {
    const target = this.players.get(targetPlayerId);
    if (!target) throw new Error('Игрок не найден.');
    this.players.forEach(p => { p.isHost = false; });
    target.isHost = true;
    this.hostId = targetPlayerId;
    this.addLog(`👑 ${target.name} теперь является Мастером игры.`);
    return true;
  }

  removePlayer(playerId) {
    const p = this.players.get(playerId);
    if (p) {
      this.addLog(`🚪 ${p.name} покинул бункер.`);

      // Free player cards back to category decks if game was playing
      this.categories.forEach(cat => {
        const card = p.cards[cat.key];
        if (card && card.text) {
          if (this.inPlayCards[cat.key]) this.inPlayCards[cat.key].delete(card.text);
          if (this.categoryDecks[cat.key]) this.categoryDecks[cat.key].push(card.text);
        }
      });

      this.players.delete(playerId);

      if (p.isHost && this.players.size > 0) {
        const nextHost = this.players.values().next().value;
        nextHost.isHost = true;
        this.hostId = nextHost.id;
        this.addLog(`👑 ${nextHost.name} назначен новым Мастером игры.`);
      }
    }
    this.updateBunkerCapacityDefault();
  }

  updateBunkerCapacityDefault() {
    const count = this.players.size;
    if (count > 0 && this.status === 'lobby') {
      this.bunkerCapacity = Math.max(1, Math.floor(count / 2));
    }
  }

  toggleExile(targetPlayerId, byPlayerId) {
    if (byPlayerId !== this.hostId) {
      throw new Error('Только Мастер игры может исключать или возвращать игроков.');
    }
    const player = this.players.get(targetPlayerId);
    if (!player) throw new Error('Игрок не найден.');

    player.isExiled = !player.isExiled;
    if (player.isExiled) {
      this.addLog(`🚫 Мастер ИСКЛЮЧИЛ игрока ${player.name} из бункера!`);
    } else {
      this.addLog(`♻️ Мастер ВЕРНУЛ игрока ${player.name} обратно в бункер.`);
    }

    // Check round milestone triggers because active player count changed
    this.checkRoundMilestoneTriggers();

    return player;
  }

  revealCard(targetPlayerId, categoryKey, requesterId) {
    const player = this.players.get(targetPlayerId);
    if (!player) throw new Error('Игрок не найден.');

    const isSelf = requesterId === targetPlayerId;
    const isMaster = requesterId === this.hostId;

    if (!isSelf && !isMaster) {
      throw new Error('Вы можете открывать только свои карты. Чужие карты может вскрывать только Мастер игры.');
    }

    if (!player.cards[categoryKey]) {
      throw new Error('Некорректная категория карты.');
    }

    const card = player.cards[categoryKey];
    const wasRevealed = card.revealed;
    card.revealed = !card.revealed;

    const catObj = CATEGORIES.find(c => c.key === categoryKey);
    const catName = catObj ? catObj.name : categoryKey;

    if (card.revealed) {
      this.addLog(`🃏 ${isMaster && !isSelf ? `Мастер открыл карту [${catName}] игрока ${player.name}` : `${player.name} открыл [${catName}]`}: "${card.text}"`);

      // If it was just revealed for the first time, increment reveal counter
      if (!wasRevealed) {
        this.totalRevealsCount++;
        // Check if all active players now have reached 2, 3, 4... revealed cards
        this.checkRoundMilestoneTriggers();
      }
    } else {
      this.addLog(`🔒 ${player.name} скрыл [${catName}].`);
    }

    return card;
  }

  // Check round milestones: trigger when EVERY active (non-exiled) player has revealed at least 2, 3, 4... REGULAR cards
  checkRoundMilestoneTriggers() {
    if (this.threatMode !== 'threshold' || this.status !== 'playing') return;

    const activePlayers = Array.from(this.players.values()).filter(p => !p.isExiled);
    if (activePlayers.length === 0) return;

    // Regular categories ONLY! Special cards are situational and do NOT trigger round milestones!
    const regularCats = this.categories.filter(c => !c.isSpecial && c.key !== 'special_cards');
    const totalRegular = regularCats.length;

    // Count revealed regular cards for each active player
    const playerRevealCounts = activePlayers.map(p => {
      let count = 0;
      regularCats.forEach(cat => {
        if (p.cards[cat.key] && p.cards[cat.key].revealed) count++;
      });
      return count;
    });

    const minRegularRevealed = Math.min(...playerRevealCounts);

    // Max milestone: totalRegular - cardsLeftClosed (milestones stop before last closed cards)
    const maxMilestoneAllowed = Math.max(1, totalRegular - this.cardsLeftClosed);

    for (let milestone = 2; milestone <= minRegularRevealed && milestone <= maxMilestoneAllowed; milestone++) {
      if (!this.triggeredRoundMilestones.has(milestone)) {
        this.triggeredRoundMilestones.add(milestone);
        this.addLog(`📢 Все активные выжившие открыли минимум по ${milestone} обычные карты! Автоматически открывается карта Угрозы / Бункера.`);
        this.drawWorldCard();
      }
    }
  }

  // --- MASTER ACTION: CHANGE BUNKER CAPACITY (+-1) ---
  changeBunkerCapacity(delta, requesterId) {
    if (requesterId !== this.hostId) {
      throw new Error('Только Мастер игры может изменять вместимость бункера.');
    }

    const d = parseInt(delta, 10);
    if (isNaN(d) || d === 0) return this.bunkerCapacity;

    const oldCap = this.bunkerCapacity;
    const newCap = Math.max(1, oldCap + d);
    if (newCap === oldCap) return this.bunkerCapacity;

    this.bunkerCapacity = newCap;
    const changeWord = d > 0 ? `увеличена на +${d}` : `уменьшена на ${d}`;
    this.addLog(`📦 Вместимость бункера ${changeWord} Мастером (сыграла карта особых условий): ${oldCap} ➔ ${newCap} мест!`);
    return this.bunkerCapacity;
  }

  // Check if game can proceed to evaluation (Master has full freedom, excess survivors will receive overpopulation penalty)
  canProceedToEvaluation() {
    const activeSurvivors = Array.from(this.players.values()).filter(p => !p.isExiled);
    const count = activeSurvivors.length;
    const capacity = this.bunkerCapacity;
    const hasOverpopulation = count > capacity;

    return {
      allowed: true,
      hasOverpopulation,
      survivorsCount: count,
      capacity,
      excess: Math.max(0, count - capacity)
    };
  }

  // --- MASTER ACTION: REVEAL ALL REGULAR CARDS OF EXILED PLAYER (EXCEPT SPECIAL CARD) ---
  revealExiledPlayerCards(targetPlayerId, requesterId) {
    if (requesterId !== this.hostId) {
      throw new Error('Только Мастер игры может открывать карты изгнанного игрока.');
    }
    const player = this.players.get(targetPlayerId);
    if (!player) throw new Error('Игрок не найден.');
    if (!player.isExiled) {
      throw new Error('Игрок не является изгнанным.');
    }

    let openedCount = 0;
    this.categories.forEach(cat => {
      // DO NOT reveal special cards! Special cards are situational and personal!
      if (!cat.isSpecial && cat.key !== 'special_cards') {
        const card = player.cards[cat.key];
        if (card && !card.revealed && card.text) {
          card.revealed = true;
          openedCount++;
        }
      }
    });

    this.addLog(`👁️ Мастер вскрыл все обычные карты изгнанного игрока ${player.name} (${openedCount} карт). Спец-карта осталась закрытой.`);
    return true;
  }

  // --- MASTER ACTION: REVEAL ANY CARD ---
  revealOtherPlayerCard(targetPlayerId, categoryKey, requesterId) {
    if (requesterId !== this.hostId) {
      throw new Error('Только Мастер игры может вскрывать чужие карты.');
    }
    return this.revealCard(targetPlayerId, categoryKey, requesterId);
  }

  // --- MASTER ACTION: REPLACE CARD WITH RANDOM UNUSED FROM SAME CLASS (STRICT 1 COPY) ---
  replacePlayerCard(targetPlayerId, categoryKey, requesterId, allowSelf = false) {
    if (!allowSelf && requesterId !== this.hostId) {
      throw new Error('Только Мастер игры может заменять карты.');
    }

    const player = this.players.get(targetPlayerId);
    if (!player) throw new Error('Игрок не найден.');

    const oldCard = player.cards[categoryKey];
    const oldText = oldCard ? oldCard.text : '';
    const wasRevealed = oldCard ? oldCard.revealed : false;

    // Return old card to category deck
    if (oldText && this.inPlayCards[categoryKey]) {
      this.inPlayCards[categoryKey].delete(oldText);
      if (!this.categoryDecks[categoryKey].includes(oldText)) {
        this.categoryDecks[categoryKey].push(oldText);
      }
    }

    // Filter available cards that are not held by ANY active player
    let available = (this.categoryDecks[categoryKey] || []).filter(c => !this.inPlayCards[categoryKey].has(c) && c !== oldText);

    if (available.length === 0) {
      // Re-populate from all selected decks if deck was exhausted
      const fallbackList = [];
      this.selectedDecks.forEach(deckId => {
        const d = deckLoader.getDeck(deckId);
        if (d) {
          const arr = d[categoryKey] || d[categoryKey + 's'] || [];
          if (Array.isArray(arr)) fallbackList.push(...arr);
        }
      });
      available = fallbackList.filter(c => !this.inPlayCards[categoryKey].has(c) && c !== oldText);
    }

    if (available.length === 0) {
      throw new Error(`В колоде категории "${categoryKey}" больше нет свободных карт (все уникальные карты уже на руках у игроков)!`);
    }

    const newRawItem = getRandomItem(available);
    let newRawText = '';
    let cardAuthor = oldCard?.author || this.deckAuthor || 'Бункер';
    let cardAction = null;

    if (typeof newRawItem === 'string') {
      newRawText = newRawItem;
    } else if (newRawItem && typeof newRawItem === 'object') {
      newRawText = newRawItem.text || newRawItem.title || newRawItem.name || JSON.stringify(newRawItem);
      if (newRawItem.author) cardAuthor = newRawItem.author;
      if (newRawItem.action) cardAction = newRawItem.action;
    }

    const parsed = TagHelper.parse(newRawText);

    // Remove new card from deck and mark in play
    this.categoryDecks[categoryKey] = (this.categoryDecks[categoryKey] || []).filter(c => c !== newRawItem);
    this.inPlayCards[categoryKey].add(newRawText);

    player.cards[categoryKey] = {
      text: newRawText,
      cleanText: parsed.cleanText,
      tags: parsed.tags,
      author: cardAuthor,
      action: cardAction,
      revealed: wasRevealed
    };

    const catObj = CATEGORIES.find(c => c.key === categoryKey);
    const catName = catObj ? catObj.name : categoryKey;

    if (!allowSelf) {
      this.addLog(`🎲 Мастер ЗАМЕНИЛ карту [${catName}] у игрока ${player.name}! Старая карта вернулась в колоду, выдана случайная свободная.`);
    }
    return player.cards[categoryKey];
  }

  // --- MASTER ACTION: SHUFFLE SELECTED CARDS AMONG PLAYERS ---
  shuffleSelectedCards(categoryKey, playerIds, requesterId) {
    if (requesterId !== this.hostId) {
      throw new Error('Только Мастер игры может перемешивать карты.');
    }

    if (!Array.isArray(playerIds) || playerIds.length < 2) {
      throw new Error('Для перемешивания выберите как минимум двух игроков.');
    }

    const targetPlayers = [];
    playerIds.forEach(id => {
      const p = this.players.get(id);
      if (p && p.cards[categoryKey] && p.cards[categoryKey].text) {
        targetPlayers.push(p);
      }
    });

    if (targetPlayers.length < 2) {
      throw new Error('Среди выбранных игроков нет достаточного количества карт для перемешивания.');
    }

    const collectedTexts = targetPlayers.map(p => p.cards[categoryKey].text);
    const shuffledTexts = shuffle(collectedTexts);

    targetPlayers.forEach((p, idx) => {
      p.cards[categoryKey].text = shuffledTexts[idx];
    });

    const catObj = CATEGORIES.find(c => c.key === categoryKey);
    const catName = catObj ? catObj.name : categoryKey;
    const names = targetPlayers.map(p => p.name).join(', ');

    this.addLog(`🔀 Мастер ПЕРЕМЕШАЛ карты [${catName}] между игроками: ${names}!`);
    return true;
  }

  // --- WORLD CARDS: AUTO-DRAW THREAT OR BUNKER CARD (STRICT 1 COPY) ---
  drawWorldCard() {
    const totalDrawn = this.revealedBunkerCards.length + this.revealedThreatCards.length;
    if (totalDrawn >= this.worldCardsMaxLimit) {
      this.addLog(`ℹ️ Достигнут лимит карт Угроз и Бункера на столе (${this.worldCardsMaxLimit} карт).`);
      return null;
    }

    if (this.bunkerDeck.length === 0 && this.threatsDeck.length === 0) {
      this.addLog('ℹ️ Все доступные карты Бункера и Угроз уже открыты на столе!');
      return null;
    }

    // Determine pickType based strictly on configured probability (threatPercent vs bunkerPercent)
    let pickType = 'threat';
    const roll = Math.random() * 100;
    if (roll < this.threatPercent) {
      pickType = this.threatsDeck.length > 0 ? 'threat' : 'bunker';
    } else {
      pickType = this.bunkerDeck.length > 0 ? 'bunker' : 'threat';
    }

    if (pickType === 'bunker' && this.bunkerDeck.length > 0) {
      const card = this.bunkerDeck.shift();
      if (card) {
        this.revealedBunkerCards.push(card);
        this.addLog(`🛡️ АВТОМАТИЧЕСКИ ОТКРЫТА КАРТА БУНКЕРА: "${card.title}"! ${card.description}`);
        return { type: 'bunker', card };
      }
    } else if (this.threatsDeck.length > 0) {
      const card = this.threatsDeck.shift();
      if (card) {
        this.revealedThreatCards.push(card);
        this.addLog(`⚠️ ТРЕВОГА! АВТОМАТИЧЕСКИ ОТКРЫТА КАРТА УГРОЗЫ: "${card.title}"! ${card.description}`);
        return { type: 'threat', card };
      }
    }

    return null;
  }

  // --- TIMER MANAGEMENT (MODE 2: 2 MINUTES / HARDCORE) ---
  startThreatTimer() {
    this.stopThreatTimer();
    this.threatTimerCountdown = this.threatTimerSeconds;

    this.threatTimerHandle = setInterval(() => {
      if (this.status !== 'playing') {
        this.stopThreatTimer();
        return;
      }

      this.threatTimerCountdown--;
      if (this.threatTimerCountdown <= 0) {
        this.threatTimerCountdown = this.threatTimerSeconds;
        this.drawWorldCard();
        this.notifyBroadcast();
      }
    }, 1000);
  }

  stopThreatTimer() {
    if (this.threatTimerHandle) {
      clearInterval(this.threatTimerHandle);
      this.threatTimerHandle = null;
    }
  }

  // --- SPEAKER / DEBATE TIMER (15s, 30s, 60s) ---
  startSpeakerTimer(seconds, requesterId) {
    this.stopSpeakerTimer();
    const validSecs = Math.max(5, Math.min(300, parseInt(seconds, 10) || 30));
    const player = this.players.get(requesterId);
    const starterName = player ? player.name : 'Мастер';

    this.speakerTimer = {
      active: true,
      secondsLeft: validSecs,
      totalSeconds: validSecs,
      startedBy: starterName,
      timeRanOut: false
    };

    this.addLog(`⏱️ ${starterName} включил таймер на речь: ${validSecs} сек.`);
    this.notifyBroadcast();

    this.speakerTimerHandle = setInterval(() => {
      if (!this.speakerTimer || !this.speakerTimer.active) {
        this.stopSpeakerTimer();
        return;
      }
      this.speakerTimer.secondsLeft--;
      if (this.speakerTimer.secondsLeft <= 0) {
        this.stopSpeakerTimer(true);
      } else {
        this.notifyBroadcast();
      }
    }, 1000);
  }

  stopSpeakerTimer(timeRanOut = false) {
    if (this.speakerTimerHandle) {
      clearInterval(this.speakerTimerHandle);
      this.speakerTimerHandle = null;
    }
    if (this.speakerTimer) {
      if (timeRanOut) {
        this.speakerTimer.active = false;
        this.speakerTimer.secondsLeft = 0;
        this.speakerTimer.timeRanOut = true;
        this.addLog(`🔔 ВРЕМЯ НА ВЫСТУПЛЕНИЕ (${this.speakerTimer.totalSeconds}с) ВЫШЛО!`);
        this.notifyBroadcast();
      } else {
        this.speakerTimer = null;
        this.addLog('⏹️ Таймер на речь остановлен.');
        this.notifyBroadcast();
      }
    }
  }

  // --- EXPULSION VOTING SYSTEM (NO TIMER, MAJORITY VOTE, TIE-BREAKER REVOTE) ---
  startVoting(requesterId, candidatesList = null) {
    const activePlayers = Array.from(this.players.values()).filter(p => !p.isExiled);
    if (activePlayers.length < 2) {
      throw new Error('Для голосования нужно как минимум 2 активных игрока в бункере.');
    }

    let candidates = [];
    if (Array.isArray(candidatesList) && candidatesList.length >= 2) {
      candidates = candidatesList.filter(id => this.players.has(id));
    } else {
      candidates = activePlayers.map(p => p.id);
    }

    const isRevote = Boolean(candidatesList && candidatesList.length > 0 && candidatesList.length < activePlayers.length);

    this.voting = {
      active: true,
      isRevote,
      candidates,
      votes: {}, // voterId -> targetPlayerId
      revoteRound: isRevote ? ((this.voting && this.voting.revoteRound) ? this.voting.revoteRound + 1 : 1) : 0
    };

    const candidateNames = candidates.map(id => this.players.get(id)?.name || id).join(', ');
    if (isRevote) {
      this.addLog(`⚖️ ПЕРЕГОЛОСОВАНИЕ: Кандидаты с равным числом голосов (${candidateNames}). Голосуйте!`);
    } else {
      this.addLog(`🗳️ ОБЪЯВЛЕНО ГОЛОСОВАНИЕ на изгнание из бункера! Кандидаты: ${candidateNames}`);
    }

    this.notifyBroadcast();
    return this.voting;
  }

  castVote(voterId, targetPlayerId) {
    if (!this.voting || !this.voting.active) {
      throw new Error('Голосование в данный момент не проводится.');
    }
    const voter = this.players.get(voterId);
    if (!voter) throw new Error('Игрок не найден.');
    if (voter.isExiled) throw new Error('Изгнанные игроки не могут голосовать.');

    if (!this.voting.candidates.includes(targetPlayerId)) {
      throw new Error('Этот игрок не входит в список кандидатов на изгнание.');
    }

    this.voting.votes[voterId] = targetPlayerId;
    const target = this.players.get(targetPlayerId);
    this.addLog(`🗳️ ${voter.name} отдал свой голос против игрока ${target ? target.name : 'кандидата'}.`);

    // Check if all active non-exiled players have voted
    const activePlayers = Array.from(this.players.values()).filter(p => !p.isExiled);
    const allVoted = activePlayers.every(p => Boolean(this.voting.votes[p.id]));

    if (allVoted) {
      // Automatically end voting when everyone has cast their vote!
      this.endVoting(this.hostId);
    } else {
      this.notifyBroadcast();
    }

    return true;
  }

  endVoting(requesterId) {
    if (!this.voting || !this.voting.active) {
      throw new Error('Нет активного голосования.');
    }

    const exiledCount = Array.from(this.players.values()).filter(p => p.isExiled).length;

    // Calculate vote weights
    const tally = {};
    this.voting.candidates.forEach(cId => { tally[cId] = 0; });

    const voterDetails = {}; // voterId -> { targetId, weight, voterName }

    Object.entries(this.voting.votes).forEach(([voterId, targetId]) => {
      if (!this.voting.candidates.includes(targetId)) return;
      const voter = this.players.get(voterId);
      if (!voter || voter.isExiled) return;

      let weight = 1;
      if (voter.votingBonus) {
        weight += voter.votingBonus;
        voter.votingBonus = 0; // consumed
      }
      if (voter.voteExiledPower) {
        weight += exiledCount;
        voter.voteExiledPower = false; // consumed
      }

      tally[targetId] = (tally[targetId] || 0) + weight;
      voterDetails[voterId] = { targetId, weight, voterName: voter.name };
    });

    // Save history of who voted for whom
    this.lastVotingHistory = {
      votes: { ...this.voting.votes },
      voterDetails,
      candidates: [...this.voting.candidates],
      tally: { ...tally }
    };

    let maxVotes = -1;
    this.voting.candidates.forEach(cId => {
      const v = tally[cId] || 0;
      if (v > maxVotes) maxVotes = v;
    });

    if (maxVotes <= 0) {
      this.addLog('ℹ️ В голосовании не было отдано голосов. Никто не изгнан.');
      this.voting = null;
      this.notifyBroadcast();
      return { outcome: 'none' };
    }

    const leaders = this.voting.candidates.filter(cId => (tally[cId] || 0) === maxVotes);

    if (leaders.length === 1) {
      const expelledId = leaders[0];
      const expelledPlayer = this.players.get(expelledId);

      // Check immunity
      if (expelledPlayer && expelledPlayer.exileImmunity) {
        expelledPlayer.exileImmunity = false;
        this.addLog(`🛡️ ${expelledPlayer.name} активировал ИММУНИТЕТ и избежал изгнания! Никто не покинул бункер.`);
        this.voting = null;
        this.notifyBroadcast();
        return { outcome: 'immunity', player: expelledPlayer };
      }

      if (expelledPlayer) {
        expelledPlayer.isExiled = true;
        this.addLog(`🚫 ПО ИТОГАМ ГОЛОСОВАНИЯ ИЗГНАН ИГРОК: ${expelledPlayer.name} (${maxVotes} гол.)!`);
        this.checkRoundMilestoneTriggers();
      }
      this.lastVotingHistory.expelledId = expelledId;
      this.voting = null;
      this.notifyBroadcast();
      return { outcome: 'expelled', player: expelledPlayer, votes: maxVotes };
    } else {
      // TIE! Launch revote ONLY among leaders
      const leaderNames = leaders.map(id => this.players.get(id)?.name || id).join(', ');
      this.addLog(`⚖️ НИЧЬЯ: кандидаты (${leaderNames}) набрали равное число голосов (${maxVotes})! Запускается переголосование ТОЛЬКО среди них.`);
      this.startVoting(requesterId, leaders);
      return { outcome: 'tie', leaders };
    }
  }

  cancelVoting(requesterId) {
    if (requesterId !== this.hostId) {
      throw new Error('Только Мастер игры может отменить голосование.');
    }
    this.voting = null;
    this.addLog('🚫 Мастер отменил текущее голосование.');
    this.notifyBroadcast();
    return true;
  }

  // --- INVENTORY THEFT & SWAP MECHANICS ---
  stealInventory(requesterId, targetPlayerId, categoryKey = 'small_inventory') {
    const thief = this.players.get(requesterId);
    const victim = this.players.get(targetPlayerId);
    if (!thief || !victim) throw new Error('Игрок не найден.');
    if (thief.id === victim.id) throw new Error('Нельзя украсть карту у самого себя.');

    const victimCard = victim.cards[categoryKey];
    if (!victimCard || !victimCard.text || victimCard.text.startsWith('[Украдено игроком')) {
      throw new Error(`У игрока ${victim.name} нет доступного предмета в категории "${categoryKey}".`);
    }

    const stolenRawText = victimCard.text;
    const stolenClean = victimCard.cleanText || stolenRawText;

    // Mark victim's card:
    victim.cards[categoryKey] = {
      text: `[Украдено игроком ${thief.name}]`,
      cleanText: `[Украдено игроком ${thief.name}]`,
      tags: [],
      author: victimCard.author,
      action: null,
      revealed: true
    };

    // Append to thief's card:
    const thiefCurrent = thief.cards[categoryKey];
    let combinedText = '';
    if (thiefCurrent && thiefCurrent.text && !thiefCurrent.text.startsWith('[Украдено игроком')) {
      combinedText = `${thiefCurrent.text};\n[Украдено у ${victim.name}]: ${stolenRawText}`;
    } else {
      combinedText = `[Украдено у ${victim.name}]: ${stolenRawText}`;
    }

    const parsedThief = TagHelper.parse(combinedText);
    thief.cards[categoryKey] = {
      text: combinedText,
      cleanText: parsedThief.cleanText,
      tags: parsedThief.tags,
      author: thiefCurrent?.author || thief.name,
      action: null,
      revealed: true // Marked revealed so tags immediately count for team resources/threats
    };

    const catObj = this.categories.find(c => c.key === categoryKey);
    const catName = catObj ? catObj.name : categoryKey;
    this.addLog(`⚡ ${thief.name} УКРАЛ [${catName}] у игрока ${victim.name}: "${stolenClean}"! Все параметры и теги предмета перешли к нему и защищают бункер.`);
    return { success: true };
  }

  swapPlayerCards(player1Id, player2Id, categoryKey, requesterId) {
    if (requesterId !== this.hostId) {
      throw new Error('Только Мастер игры может обменивать карты между игроками.');
    }
    const p1 = this.players.get(player1Id);
    const p2 = this.players.get(player2Id);
    if (!p1 || !p2) throw new Error('Игроки не найдены.');

    const card1 = p1.cards[categoryKey];
    const card2 = p2.cards[categoryKey];
    if (!card1 || !card2) throw new Error('Категория не найдена.');

    const temp = { ...card1 };
    p1.cards[categoryKey] = { ...card2 };
    p2.cards[categoryKey] = temp;

    const catObj = this.categories.find(c => c.key === categoryKey);
    const catName = catObj ? catObj.name : categoryKey;
    this.addLog(`🔄 Мастер ОБМЕНЯЛ карты [${catName}] между игроками ${p1.name} и ${p2.name}!`);
    return true;
  }

  stealPlayerCard(fromPlayerId, toPlayerId, categoryKey, requesterId) {
    return this.stealInventory(toPlayerId, fromPlayerId, categoryKey);
  }

  // --- START GAME (PRESET) ---
  startPresetGame(requesterId, options = {}) {
    if (requesterId !== this.hostId) {
      throw new Error('Только Мастер игры может запустить игру.');
    }
    if (this.players.size < 1) {
      throw new Error('Для игры нужен хотя бы 1 игрок.');
    }

    if (options.threatMode) {
      this.threatMode = options.threatMode; // 'threshold' | 'timer'
    }
    if (options.threatPercent !== undefined) {
      this.threatPercent = Math.max(0, Math.min(100, parseInt(options.threatPercent, 10) || 50));
    }
    if (options.worldCardsMaxLimit !== undefined) {
      this.worldCardsMaxLimit = Math.max(1, parseInt(options.worldCardsMaxLimit, 10) || 6);
    }
    if (options.cardsLeftClosed !== undefined) {
      this.cardsLeftClosed = Math.max(0, parseInt(options.cardsLeftClosed, 10) || 1);
    }
    if (Array.isArray(options.categories) && options.categories.length > 0) {
      this.categories = options.categories;
    }

    const pool = {
      disasters: [],
      bunker: [],
      threats: [],
      profession: [],
      health: [],
      biology: [],
      hobby: [],
      traits: [],
      facts: [],
      small_inventory: [],
      large_inventory: [],
      special_cards: []
    };

    // Gather from selected decks
    this.selectedDecks.forEach(deckId => {
      const deck = deckLoader.getDeck(deckId);
      if (deck) {
        if (deck.disasters) pool.disasters.push(...deck.disasters);

        // Bunker and Threats
        if (deck.bunker) pool.bunker.push(...deck.bunker);
        if (deck.threats) pool.threats.push(...deck.threats);

        // Legacy / fallback conditions partition
        if (deck.conditions && Array.isArray(deck.conditions)) {
          deck.conditions.forEach(c => {
            const title = typeof c === 'string' ? c : (c.title || '');
            const desc = typeof c === 'string' ? c : (c.description || '');
            const item = { title, description: desc };
            if (title.toLowerCase().includes('угроз')) {
              if (!pool.threats.some(t => t.title === title)) pool.threats.push(item);
            } else {
              if (!pool.bunker.some(b => b.title === title)) pool.bunker.push(item);
            }
          });
        }

        // Player categories
        this.categories.forEach(cat => {
          const list = deck[cat.key] || deck[cat.key + 's'] || [];
          if (Array.isArray(list)) {
            if (!pool[cat.key]) pool[cat.key] = [];
            pool[cat.key].push(...list);
          }
        });
      }
    });

    // Fallbacks if empty
    const classicDeck = deckLoader.getDeck('classic') || {};
    if (pool.disasters.length === 0) pool.disasters = classicDeck.disasters || [{ title: 'Ядерная зима', goal: 'Выжить в изоляции' }];
    if (pool.bunker.length === 0) pool.bunker = classicDeck.bunker || [{ title: 'Автономный бункер', description: 'Системы в норме' }];
    if (pool.threats.length === 0) pool.threats = classicDeck.threats || [{ title: 'Износ фильтров воздуха', description: 'Нужна ручная очистка' }];

    // 1. Disaster revealed immediately before players take turns
    const disasterItem = getRandomItem(pool.disasters);
    this.disaster = {
      title: typeof disasterItem === 'string' ? disasterItem : disasterItem.title,
      goal: typeof disasterItem === 'string' ? 'Выжить и возродить цивилизацию.' : (disasterItem.goal || disasterItem.description || ''),
      revealed: true
    };

    // 2. World Decks (Shuffled unique cards)
    this.bunkerDeck = shuffle(pool.bunker);
    this.threatsDeck = shuffle(pool.threats);
    this.revealedBunkerCards = [];
    this.revealedThreatCards = [];

    const primaryDeck = this.selectedDecks.length > 0 ? deckLoader.getDeck(this.selectedDecks[0]) : null;
    this.backgroundImage = options.backgroundImage || (primaryDeck && primaryDeck.backgroundImage) || null;
    this.cardBackImage = options.cardBackImage || (primaryDeck && primaryDeck.cardBackImage) || null;
    this.deckAuthor = options.deckAuthor || (primaryDeck && primaryDeck.author) || (primaryDeck && primaryDeck.name) || 'Бункер 3.1';

    // Merge custom or specialized player categories from selected deck
    const deckCats = (primaryDeck && (primaryDeck.playerCategories || primaryDeck.customCategories)) || [];
    if (Array.isArray(deckCats) && deckCats.length > 0) {
      deckCats.forEach(c => {
        if (!this.categories.some(existing => existing.key === c.key)) {
          this.categories.push({
            key: c.key,
            name: c.name,
            icon: c.icon || '🏷️',
            isSpecial: Boolean(c.isSpecial || c.type === 'special' || c.key === 'special_cards')
          });
        }
      });
    }
    this.customTags = (primaryDeck && primaryDeck.customTags) || [];
    this.evaluationConfig = (primaryDeck && primaryDeck.evaluationConfig) || null;

    // 3. Player Cards (STRICT 1 COPY PER CARD)
    this.categories.forEach(cat => {
      let sourceList = pool[cat.key] || [];
      if (cat.customCards && Array.isArray(cat.customCards) && cat.customCards.length > 0) {
        sourceList = cat.customCards;
      }
      if (sourceList.length === 0) {
        sourceList = classicDeck[cat.key] || classicDeck[cat.key + 's'] || [];
      }
      if (sourceList.length === 0) {
        // Fallback for custom dynamically added categories
        sourceList = Array.from({ length: 30 }, (_, i) => `${cat.name} №${i + 1}`);
      }

      // De-duplicate master pool
      const uniquePool = Array.from(new Set(sourceList));
      const shuffled = shuffle(uniquePool);

      this.categoryDecks[cat.key] = [...shuffled];
      this.inPlayCards[cat.key] = new Set();

      this.players.forEach(player => {
        player.isExiled = false;
        let cardItem = this.categoryDecks[cat.key].shift() || '—';
        let rawText = '';
        let cardAuthor = this.deckAuthor || 'Бункер';
        let cardAction = null;

        if (typeof cardItem === 'string') {
          rawText = cardItem;
        } else if (cardItem && typeof cardItem === 'object') {
          rawText = cardItem.text || cardItem.title || cardItem.name || JSON.stringify(cardItem);
          if (cardItem.author) cardAuthor = cardItem.author;
          if (cardItem.action) cardAction = cardItem.action;
        }

        const parsed = TagHelper.parse(rawText);

        this.inPlayCards[cat.key].add(rawText);
        player.cards[cat.key] = {
          text: rawText,
          cleanText: parsed.cleanText,
          tags: parsed.tags,
          author: cardAuthor,
          action: cardAction,
          revealed: false
        };
      });
    });

    // 4. Threshold milestones calculation based on player count
    const playerCount = Math.max(1, this.players.size);
    // User requested formula: for 5 players -> 10, 15, 20, 25, 30
    this.totalRevealsCount = 0;
    this.thresholdMilestones = [
      playerCount * 2,
      playerCount * 3,
      playerCount * 4,
      playerCount * 5,
      playerCount * 6,
      playerCount * 7,
      playerCount * 8
    ];
    this.nextThreshold = this.thresholdMilestones[0];

    // 5. Timer mode if selected
    if (this.threatMode === 'timer') {
      this.startThreatTimer();
    } else {
      this.stopThreatTimer();
    }

    this.results = null;
    this.status = 'playing';

    this.addLog(`🚀 Игра началась! Катастрофа: "${this.disaster.title}". Мест в бункере: ${this.bunkerCapacity}`);
    if (this.threatMode === 'timer') {
      this.addLog(`⏱️ Режим Угроз: Хардкор по таймеру (новая карта каждые 2 минуты)!`);
    } else {
      this.addLog(`📊 Режим Угроз: По открытию карт (следующая карта на ${this.nextThreshold} открытии)!`);
    }
  }

  // --- START UGC PHASE ---
  startUgcPhase(requesterId, options = {}) {
    if (requesterId !== this.hostId) {
      throw new Error('Только Мастер игры может запустить создание карт.');
    }
    this.stopThreatTimer();
    this.status = 'ugc_building';
    if (options.threatMode) this.threatMode = options.threatMode;
    if (options.bunkerCapacity !== undefined) this.bunkerCapacity = Math.max(1, parseInt(options.bunkerCapacity, 10) || 3);
    if (options.threatPercent !== undefined) this.threatPercent = Math.max(0, Math.min(100, parseInt(options.threatPercent, 10) || 50));
    if (options.worldCardsMaxLimit !== undefined) this.worldCardsMaxLimit = Math.max(1, parseInt(options.worldCardsMaxLimit, 10) || 6);
    if (options.cardsLeftClosed !== undefined) this.cardsLeftClosed = Math.max(0, parseInt(options.cardsLeftClosed, 10) || 1);
    if (Array.isArray(options.categories) && options.categories.length > 0) {
      this.categories = options.categories;
    }

    this.players.forEach(p => {
      p.ugcReady = false;
      p.ugcSubmissions = null;
    });
    this.addLog(`🛠️ Режим "С нуля": Игроки начали заполнять свои наборы карт (Катастрофы, Бункер, Угрозы и ${this.categories.length} категорий персонажа).`);
  }

  submitUgcCards(playerId, submissions) {
    const player = this.players.get(playerId);
    if (!player) throw new Error('Игрок не найден.');

    player.ugcSubmissions = submissions;
    player.ugcReady = true;
    this.addLog(`✍️ Игрок ${player.name} заполнил свои карты!`);

    let allReady = true;
    this.players.forEach(p => {
      if (!p.ugcReady) allReady = false;
    });

    return { allReady };
  }

  startUgcGame(requesterId, saveAsThemeName = null, options = {}) {
    if (requesterId !== this.hostId) {
      throw new Error('Только Мастер игры может запустить игру.');
    }

    if (options && options.backgroundImage) {
      this.backgroundImage = options.backgroundImage;
    }
    if (options && options.cardBackImage) {
      this.cardBackImage = options.cardBackImage;
    }

    const pool = {
      disasters: [],
      bunker: [],
      threats: []
    };
    this.categories.forEach(cat => {
      pool[cat.key] = [];
    });

    this.players.forEach(player => {
      const sub = player.ugcSubmissions;
      if (!sub) return;

      // 1. Disasters (2 variants per player)
      if (Array.isArray(sub.disasters)) {
        sub.disasters.forEach(d => {
          if (!d) return;
          const title = typeof d === 'string' ? d : (d.title || d.text || '');
          const goal = typeof d === 'string' ? 'Выжить и возродить цивилизацию' : (d.goal || d.description || 'Выжить любой ценой');
          if (title.trim()) {
            pool.disasters.push({ title: title.trim(), goal: goal.trim(), author: player.name });
          }
        });
      }

      // 2. Bunker Cards (5 variants per player)
      if (Array.isArray(sub.bunker)) {
        sub.bunker.forEach(b => {
          if (!b) return;
          const title = typeof b === 'string' ? b : (b.title || b.text || '');
          const desc = typeof b === 'string' ? '' : (b.description || b.desc || '');
          if (title.trim()) {
            pool.bunker.push({ title: title.trim(), description: desc.trim(), author: player.name });
          }
        });
      }

      // 3. Threat Cards (5 variants per player)
      if (Array.isArray(sub.threats)) {
        sub.threats.forEach(t => {
          if (!t) return;
          const title = typeof t === 'string' ? t : (t.title || t.text || '');
          const desc = typeof t === 'string' ? '' : (t.description || t.desc || '');
          if (title.trim()) {
            pool.threats.push({ title: title.trim(), description: desc.trim(), author: player.name });
          }
        });
      }

      // 4. Character Categories (5 variants per active category)
      this.categories.forEach(cat => {
        const list = sub[cat.key];
        if (Array.isArray(list)) {
          list.forEach(item => {
            if (!item) return;
            let itemText = typeof item === 'string' ? item : (item.text || item.title || '');
            itemText = String(itemText || '').trim();
            if (itemText) {
              pool[cat.key].push({
                text: itemText,
                author: player.name,
                action: (typeof item === 'object' && item.action) ? item.action : null
              });
            }
          });
        }
      });
    });

    const classicDeck = deckLoader.getDeck('classic') || {};

    // Fallbacks if empty
    if (pool.disasters.length === 0) {
      pool.disasters = classicDeck.disasters || [{ title: 'Глобальная катастрофа', goal: 'Выжить в условиях бункера' }];
    }
    if (pool.bunker.length === 0) {
      pool.bunker = classicDeck.bunker || [{ title: 'Автономный бункер', description: 'Системы жизнеобеспечения в норме' }];
    }
    if (pool.threats.length === 0) {
      pool.threats = classicDeck.threats || [{ title: 'Износ фильтров воздуха', description: 'Нужна ручная очистка' }];
    }

    this.categories.forEach(cat => {
      if (!pool[cat.key] || pool[cat.key].length === 0) {
        const fallbacks = classicDeck[cat.key] || classicDeck[cat.key + 's'] || Array.from({ length: 15 }, (_, i) => `${cat.name} №${i + 1}`);
        pool[cat.key] = fallbacks.map(f => ({
          text: typeof f === 'string' ? f : (f.text || JSON.stringify(f)),
          author: 'Бункер'
        }));
      }
    });

    // 1. Draw random Disaster created by players
    const chosenDisaster = getRandomItem(pool.disasters);
    this.disaster = {
      title: chosenDisaster.title,
      goal: chosenDisaster.goal || 'Выжить любой ценой!',
      author: chosenDisaster.author || 'Игроки',
      revealed: true
    };

    // 2. Bunker & Threat Decks created by players
    this.bunkerDeck = shuffle(pool.bunker);
    this.threatsDeck = shuffle(pool.threats);
    this.revealedBunkerCards = [];
    this.revealedThreatCards = [];

    // 3. Category Decks and dealing cards
    this.categories.forEach(cat => {
      const shuffled = shuffle(pool[cat.key]);
      this.categoryDecks[cat.key] = [...shuffled];
      this.inPlayCards[cat.key] = new Set();

      this.players.forEach(player => {
        player.isExiled = false;
        const cardItem = this.categoryDecks[cat.key].shift() || { text: '—', author: 'Игрок' };
        const rawText = typeof cardItem === 'string' ? cardItem : (cardItem.text || '—');
        const cardAuthor = (typeof cardItem === 'object' && cardItem.author) ? cardItem.author : 'Игрок';
        const cardAction = (typeof cardItem === 'object' && cardItem.action) ? cardItem.action : null;

        const parsed = TagHelper.parse(rawText);
        this.inPlayCards[cat.key].add(rawText);
        player.cards[cat.key] = {
          text: rawText,
          cleanText: parsed.cleanText,
          tags: parsed.tags,
          author: cardAuthor,
          action: cardAction,
          revealed: false
        };
      });
    });

    // Save as theme deck if requested
    if (saveAsThemeName && typeof saveAsThemeName === 'string' && saveAsThemeName.trim()) {
      try {
        const customDeckId = 'ugc_' + Date.now();
        const customDeck = {
          id: customDeckId,
          name: saveAsThemeName.trim(),
          author: 'Игроки Бункера',
          description: 'Пользовательский набор, созданный игроками в кастомном режиме.',
          disasters: pool.disasters.map(d => ({ title: d.title, goal: d.goal })),
          bunker: pool.bunker.map(b => ({ title: b.title, description: b.description })),
          threats: pool.threats.map(t => ({ title: t.title, description: t.description }))
        };
        this.categories.forEach(cat => {
          customDeck[cat.key] = pool[cat.key].map(c => c.text);
        });
        deckLoader.saveDeck(customDeck);
        this.addLog(`💾 Набор карт сохранен в библиотеку как «${saveAsThemeName.trim()}»!`);
      } catch (err) {
        console.warn('Не удалось сохранить UGC колоду:', err);
      }
    }

    if (this.threatMode === 'timer') {
      this.startThreatTimer();
    }

    this.results = null;
    this.status = 'playing';
    this.addLog(`🚀 Игра началась в режиме "С нуля"! Катастрофа: "${this.disaster.title}". Доступно ${this.bunkerDeck.length} карт бункера и ${this.threatsDeck.length} угроз.`);

    const playerCount = Math.max(1, this.players.size);
    this.totalRevealsCount = 0;
    this.thresholdMilestones = [playerCount * 2, playerCount * 3, playerCount * 4, playerCount * 5];
    this.nextThreshold = this.thresholdMilestones[0];

    if (this.threatMode === 'timer') {
      this.startThreatTimer();
    }

    this.results = null;
    this.status = 'playing';
    this.addLog(`🚀 Игра началась в режиме "С нуля"! Мест в бункере: ${this.bunkerCapacity}`);
  }

  // --- FINAL SURVIVAL ASSESSMENT (ОЦЕНКА ВЫЖИВАЕМОСТИ МАСТЕРОМ) ---
  submitSurvivalEvaluation(evaluation, requesterId) {
    if (requesterId !== this.hostId) {
      throw new Error('Только Мастер игры может подвести итоги выживания.');
    }

    const check = this.canProceedToEvaluation();
    if (!check.allowed) {
      throw new Error(check.reason);
    }

    this.stopThreatTimer();

    const evalScores = {
      supplies: Math.max(1, Math.min(5, parseInt(evaluation.supplies, 10) || 3)),
      medicine: Math.max(1, Math.min(5, parseInt(evaluation.medicine, 10) || 3)),
      specialists: Math.max(1, Math.min(5, parseInt(evaluation.specialists, 10) || 3)),
      defense: Math.max(1, Math.min(5, parseInt(evaluation.defense, 10) || 3)),
      psychology: Math.max(1, Math.min(5, parseInt(evaluation.psychology, 10) || 3))
    };

    const survivors = [];
    const exiled = [];

    this.players.forEach(p => {
      const summary = {
        id: p.id,
        name: p.name,
        profession: p.cards.profession ? p.cards.profession.text : '—',
        health: p.cards.health ? p.cards.health.text : '—',
        biology: p.cards.biology ? p.cards.biology.text : '—',
        traits: p.cards.traits ? p.cards.traits.text : '—',
        inventory: [
          p.cards.small_inventory ? p.cards.small_inventory.text : '',
          p.cards.large_inventory ? p.cards.large_inventory.text : ''
        ].filter(Boolean).join('; ')
      };

      if (p.isExiled) {
        exiled.push(summary);
      } else {
        survivors.push(summary);
      }
    });

    const survivorsCount = survivors.length;
    const capacity = this.bunkerCapacity;

    const disasterOk = (evaluation.disasterCondition !== 'failed');
    const bunkerStatuses = Array.isArray(evaluation.bunkerStatuses) ? evaluation.bunkerStatuses : [];
    const threatStatuses = Array.isArray(evaluation.threatStatuses) ? evaluation.threatStatuses : [];

    // 1. Base score from Master's evaluation questions
    let totalEvalPoints = 0;
    let maxEvalPoints = 25;

    if (evaluation.answers && typeof evaluation.answers === 'object') {
      const answers = evaluation.answers;
      const keys = Object.keys(answers);
      if (keys.length > 0) {
        totalEvalPoints = 0;
        maxEvalPoints = keys.length * 5;
        keys.forEach(k => {
          const val = Math.max(1, Math.min(5, parseInt(answers[k], 10) || 3));
          totalEvalPoints += val;
        });
      }
    } else {
      totalEvalPoints = evalScores.supplies + evalScores.medicine + evalScores.specialists + evalScores.defense + evalScores.psychology;
    }
    let percentage = Math.round((totalEvalPoints / maxEvalPoints) * 100);

    // 2. Disaster Conditions (penalty 2-3x higher than other threats: -30%)
    // Conditions and threats do NOT give positive bonuses; only penalties if failed/active
    let disasterImpactText = '';
    if (!disasterOk) {
      percentage -= 30;
      disasterImpactText = '❌ Условия катастрофы: НЕ СОБЛЮДЕНЫ (тяжелый штраф: -30%)';
    } else {
      disasterImpactText = '✅ Условия катастрофы: соблюдены (0%)';
    }

    // 3. Bunker compartments bonuses / penalties (0% for working, -10% per broken compartment)
    let workingBunkers = 0;
    let failedBunkers = 0;
    bunkerStatuses.forEach(st => {
      if (st === 'ok') {
        workingBunkers++;
      } else {
        failedBunkers++;
        percentage -= 10;
      }
    });

    // 4. Threats: NO positive bonuses (+0% if resolved, -15% per active threat)
    let activeThreats = 0;
    let resolvedThreats = 0;
    threatStatuses.forEach(st => {
      if (st === 'active') {
        activeThreats++;
        percentage -= 15;
      } else {
        resolvedThreats++;
      }
    });

    // 5. Overpopulation penalty (-20% per excess player above capacity)
    let overpopPenalty = 0;
    const excess = Math.max(0, survivorsCount - capacity);
    if (excess > 0) {
      overpopPenalty = excess * 20;
      percentage -= overpopPenalty;
    }

    // Clamp percentage
    if (survivorsCount === 0) {
      percentage = 0;
    } else {
      percentage = Math.max(1, Math.min(99, percentage));
    }

    // 6. RANDOMIZER (Рулетка судьбы от 1 до 100 с подсчетом от большего к меньшему)
    // Шанс 20% => победа при выпадении 81..100 (порог = 101 - 20 = 81)
    // Шанс 60% => победа при выпадении 41..100 (порог = 101 - 60 = 41)
    const threshold = (survivorsCount === 0 || percentage <= 0) ? 101 : Math.max(1, Math.min(101, 101 - percentage));
    const diceRoll = Math.floor(Math.random() * 100) + 1;
    const isSuccess = (survivorsCount > 0) && (percentage > 0) && (diceRoll >= threshold);
    const outcomeText = isSuccess ? 'УСПЕШНО' : 'ПРОВАЛ';

    let verdict = '';
    let epilogue = '';

    if (survivorsCount === 0) {
      verdict = '💀 ВСЕ ИЗГНАНЫ. БУНКЕР ПУСТ.';
      epilogue = 'Все кандидаты были изгнаны на поверхность. В убежище никто не вошел. Замкнутые системы отключились одна за другой, и человечество в этом регионе прекратило свое существование.';
    } else if (isSuccess) {
      verdict = `🎉 УСПЕШНО: БУНКЕР ВЫЖИЛ! (Шанс: ${percentage}%, Выпало: ${diceRoll} ≥ ${threshold} ➔ ВЫЖИВАНИЕ)`;
      epilogue = `Кубик судьбы выпал на ${diceRoll} (для победы требовалось от ${threshold} до 100 при шансе ${percentage}%). Выжившие преодолели суровые испытания и смогли наладить устойчивый быт в бункере! `;
      if (excess > 0) {
        epilogue += `Команда пожертвовала комфортом и психическим здоровьем из-за перенаселения (+${excess} чел., штраф -${overpopPenalty}%), но выдержка людей помогла преодолеть кризис. `;
      }
      if (!disasterOk) {
        epilogue += `Несмотря на нарушение условий катастрофы, обитателям чудом удалось избежать фатальной аварии! `;
      }
      if (activeThreats > 0) {
        epilogue += `Часть угроз осталась неликвидированной (${activeThreats} активных), но команда сумела локализовать ущерб. `;
      }
      epilogue += `Спустя годы гермодверь убежища распахнулась, и спасшиеся начали возрождать новый мир.`;
    } else {
      verdict = `💀 ПРОВАЛ: БУНКЕР ПОГИБ! (Шанс: ${percentage}%, Выпало: ${diceRoll} < ${threshold} ➔ ПОРАЖЕНИЕ)`;
      epilogue = `Кубик судьбы выпал на ${diceRoll} (при шансе ${percentage}% для спасения требовалось число от ${threshold} до 100). `;
      if (!disasterOk) {
        epilogue += `Несоблюдение условий глобальной катастрофы нанесло сокрушительный удар по обитателям бункера. `;
      }
      if (excess > 0) {
        epilogue += `Перенаселение (+${excess} чел.) вызвало острый дефицит кислорода и нервный срыв у команды. `;
      }
      if (activeThreats > 0) {
        epilogue += `Неликвидированные угрозы (${activeThreats} активных) привели к фатальной аварии систем жизнеобеспечения. `;
      }
      epilogue += `Внутренние системы бункера не выдержали нагрузки, и убежище угасло задолго до открытия спасательного шлюза.`;
    }

    const bunkerDetailLine = (bunkerStatuses.length > 0)
      ? `• Отсеки бункера: ${workingBunkers} раб. (0%), ${failedBunkers} поврежд. (-${failedBunkers * 10}%)\n`
      : '';
    const threatsDetailLine = (threatStatuses.length > 0)
      ? `• Угрозы бункеру: ${resolvedThreats} устранено (0%), ${activeThreats} активных (-${activeThreats * 15}%)\n`
      : '';

    const resLine = `\n\n📌 Факторы расчета выживаемости:\n` +
      `• Оценка анкеты Мастера: ${totalEvalPoints} из ${maxEvalPoints} б. (Базовый шанс: ${Math.round((totalEvalPoints / maxEvalPoints) * 100)}%)\n` +
      `• ${disasterImpactText}\n` +
      bunkerDetailLine +
      threatsDetailLine +
      (excess > 0 ? `• ⚠️ Перенаселение (+${excess} чел.): штраф -${overpopPenalty}%\n` : '') +
      `🎲 Рулетка судьбы: ${diceRoll} из 100 (для выживания требовалось ≥ ${threshold}) ➔ ${outcomeText}!`;
    epilogue += resLine;

    this.results = {
      isSuccess,
      percentage,
      threshold,
      diceRoll,
      outcomeText,
      verdict,
      epilogue,
      survivors,
      exiled,
      bunkerCapacity: capacity,
      evalScores,
      teamResources: this.calculateTeamResources(false),
      disaster: this.disaster ? this.disaster.title : 'Глобальная катастрофа',
      threatsCount: this.revealedThreatCards.length,
      bunkerCardsCount: this.revealedBunkerCards.length
    };

    this.status = 'finished';
    this.addLog(`🏁 ФИНАЛ: ${verdict}`);
    return this.results;
  }

  resetToLobby(requesterId) {
    if (requesterId !== this.hostId) {
      throw new Error('Только Мастер игры может сбросить игру в лобби.');
    }
    this.stopThreatTimer();
    this.status = 'lobby';
    this.results = null;
    this.revealedBunkerCards = [];
    this.revealedThreatCards = [];
    this.totalRevealsCount = 0;

    this.players.forEach(p => {
      p.isExiled = false;
      p.ugcReady = false;
      CATEGORIES.forEach(cat => {
        p.cards[cat.key] = { text: '', revealed: false };
      });
    });
    this.logs = [];
    this.addLog('🔄 Мастер вернул игру в лобби.');
  }

  toClientState(forPlayerId) {
    const isMaster = forPlayerId === this.hostId;
    const isFinished = this.status === 'finished';

    const playersList = [];
    this.players.forEach(p => {
      const isSelf = p.id === forPlayerId;
      const safeCards = {};

      this.categories.forEach(cat => {
        const card = p.cards[cat.key] || { text: '', revealed: false };
        if (card.revealed || isSelf || isFinished) {
          safeCards[cat.key] = {
            text: card.text,
            cleanText: card.cleanText || card.text,
            tags: card.tags || [],
            author: card.author || this.deckAuthor || 'Бункер',
            action: card.action || null,
            revealed: card.revealed,
            canReveal: isSelf || isMaster
          };
        } else {
          safeCards[cat.key] = {
            text: '',
            cleanText: '',
            tags: [],
            author: '',
            action: null,
            revealed: false,
            canReveal: isMaster
          };
        }
      });

      playersList.push({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        isExiled: p.isExiled,
        cards: safeCards,
        ugcReady: p.ugcReady
      });
    });

    const activePlayers = Array.from(this.players.values()).filter(p => !p.isExiled);
    const activeSurvivorsCount = activePlayers.length;
    const excessPlayers = Math.max(0, activeSurvivorsCount - this.bunkerCapacity);

    // Regular categories ONLY (special cards do NOT count towards rounds)
    const regularCats = this.categories.filter(c => !c.isSpecial && c.key !== 'special_cards');
    let minRegularRevealed = 0;
    if (activePlayers.length > 0) {
      const counts = activePlayers.map(p => {
        let c = 0;
        regularCats.forEach(cat => {
          if (p.cards[cat.key] && p.cards[cat.key].revealed) c++;
        });
        return c;
      });
      minRegularRevealed = Math.min(...counts);
    }

    const maxMilestoneAllowed = Math.max(1, regularCats.length - this.cardsLeftClosed);
    const requiredRevealed = maxMilestoneAllowed;

    const survivorsOk = activeSurvivorsCount <= this.bunkerCapacity;
    const cardsRevealedOk = minRegularRevealed >= requiredRevealed;
    const canFinish = survivorsOk && cardsRevealedOk;

    return {
      hasPassword: Boolean(this.password),
      currentPassword: isMaster ? (this.password || '') : null,
      lockedLobby: Boolean(this.lockedLobby),
      status: this.status,
      mode: this.mode,
      selectedDecks: this.selectedDecks,
      backgroundImage: this.backgroundImage,
      cardBackImage: this.cardBackImage,
      deckAuthor: this.deckAuthor,
      teamResources: this.calculateTeamResources(true),
      finalTeamResources: this.calculateTeamResources(false),
      bunkerCapacity: this.bunkerCapacity,
      activeSurvivorsCount,
      canFinish,
      survivorsOk,
      cardsRevealedOk,
      excessPlayers,
      minRevealedCards: minRegularRevealed,
      minRegularRevealed,
      maxMilestoneAllowed,
      requiredRevealed,

      // Threat / Bunker settings & progress
      threatMode: this.threatMode,
      threatPercent: this.threatPercent,
      bunkerPercent: 100 - this.threatPercent,
      worldCardsMaxLimit: this.worldCardsMaxLimit,
      cardsLeftClosed: this.cardsLeftClosed,
      threatTimerCountdown: this.threatTimerCountdown,
      totalRevealsCount: this.totalRevealsCount,
      nextThreshold: Math.min(maxMilestoneAllowed, Math.max(2, minRegularRevealed + 1)),

      // World Cards
      disaster: this.disaster,
      revealedBunkerCards: this.revealedBunkerCards,
      revealedThreatCards: this.revealedThreatCards,

      results: this.results,
      speakerTimer: this.speakerTimer,
      voting: this.voting ? {
        active: this.voting.active,
        isRevote: this.voting.isRevote,
        revoteRound: this.voting.revoteRound,
        candidates: this.voting.candidates,
        myVote: (this.voting.votes && this.voting.votes[forPlayerId]) || null,
        votesCount: Object.keys(this.voting.votes || {}).length,
        votes: (isMaster || isFinished) ? this.voting.votes : null
      } : null,
      lastVotingHistory: this.lastVotingHistory,
      isHost: isMaster,
      myId: this.players.has(forPlayerId) ? forPlayerId : null,
      players: playersList,
      categories: this.categories,
      customTags: this.customTags || [],
      evaluationConfig: this.evaluationConfig || null,
      logs: this.logs.slice(0, 35),
      chat: (this.chatMessages || []).slice(-60),
      roomId: this.roomId,
      roomsInfo: {
        activeCount: (typeof roomManager !== 'undefined' && roomManager) ? roomManager.rooms.size : 1,
        maxRooms: 4
      },
      network: getNetworkInfo(this.roomId)
    };
  }
}

class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.defaultRoomId = '101';
    this.maxRooms = 4; // Strict cap of 4 rooms maximum
    this.idleLimitMs = 30 * 60 * 1000; // 30 minutes inactivity timeout (extended so players can discuss & argue freely)
    this.onRoomCreated = null;

    // Periodically clean up idle rooms (every 10 seconds)
    setInterval(() => {
      this.cleanupIdleRooms();
    }, 10000);
  }

  getActiveDeckIds() {
    const activeSet = new Set();
    for (const room of this.rooms.values()) {
      if (Array.isArray(room.selectedDecks)) {
        room.selectedDecks.forEach(d => activeSet.add(d));
      }
    }
    return activeSet;
  }

  generateRoomCode() {
    let code;
    let attempts = 0;
    do {
      code = String(Math.floor(1000 + Math.random() * 9000));
      attempts++;
    } while (this.rooms.has(code) && attempts < 100);
    return code;
  }

  hasRoom(roomId) {
    if (!roomId) return false;
    const cleanId = String(roomId).trim().toUpperCase();
    return this.rooms.has(cleanId);
  }

  cleanupIdleRooms() {
    const now = Date.now();
    for (const [id, room] of this.rooms.entries()) {
      const timeSinceActivity = now - (room.lastActivity || now);
      const noConnected = room.players.size === 0 || Array.from(room.players.values()).every(p => !p.connected);
      const timeSinceEmpty = room.emptySince ? (now - room.emptySince) : (noConnected ? timeSinceActivity : 0);

      // 1. If room has had 0 connected players for 10 minutes: close and erase in-memory history
      if (noConnected && timeSinceEmpty >= 10 * 60 * 1000) {
        room.chatMessages = [];
        room.logs = [];
        room.results = null;
        this.closeRoom(id, 'Бункер был закрыт из-за отсутствия подключенных игроков более 10 минут.');
        continue;
      }

      // 2. If room has active players:
      // While game is playing or cards are being crafted, players often spend 15-30 minutes talking/arguing.
      // Give 45 minutes of timeout during gameplay, and 30 minutes in lobby.
      const allowedIdle = (room.status === 'playing' || room.status === 'ugc_building')
        ? (45 * 60 * 1000)
        : this.idleLimitMs;

      if (timeSinceActivity >= allowedIdle) {
        this.closeRoom(id, `Бункер был закрыт из-за отсутствия активности в течение ${Math.round(allowedIdle / 60000)} минут.`);
      }
    }

    // Clean up any ephemeral custom decks that are no longer used by any active room
    try {
      if (typeof deckLoader !== 'undefined' && deckLoader.cleanupCustomDecks) {
        deckLoader.cleanupCustomDecks(this.getActiveDeckIds());
      }
    } catch (e) {}
  }

  closeRoom(roomId, reason = 'Комната закрыта из-за отсутствия активности.') {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // Erase in-memory chat & event logs completely
    room.chatMessages = [];
    room.logs = [];
    room.results = null;

    // Notify connected SSE clients before closing
    for (const client of room.sseClients) {
      try {
        client.res.write(`data: ${JSON.stringify({ type: 'room_closed', message: reason })}\n\n`);
      } catch (e) {}
    }
    room.sseClients.clear();
    room.stopThreatTimer();
    room.stopSpeakerTimer();
    this.rooms.delete(roomId);
    console.log(`[ROOMS] Бункер #${roomId} закрыт и освобожден (${reason}). Занято бункеров: ${this.rooms.size}/${this.maxRooms}`);

    // Trigger cleanup of any custom decks that are now orphaned
    try {
      if (typeof deckLoader !== 'undefined' && deckLoader.cleanupCustomDecks) {
        deckLoader.cleanupCustomDecks(this.getActiveDeckIds());
      }
    } catch (e) {}
  }

  getRoom(roomId, createIfNotFound = true, password = '') {
    let cleanId = (roomId || '').trim().toUpperCase();
    if (!cleanId) {
      cleanId = this.defaultRoomId;
    }

    if (this.rooms.has(cleanId)) {
      return this.rooms.get(cleanId);
    }

    if (!createIfNotFound) return null;

    this.cleanupIdleRooms();

    if (this.rooms.size >= this.maxRooms) {
      throw new Error(`Все ${this.maxRooms} бункера сейчас заняты другими игроками. Подождите, пока освободится место (комната освобождается после 5 минут неактивности).`);
    }

    const gameInstance = new SingleGame(cleanId);
    if (password) gameInstance.password = String(password).trim();
    this.rooms.set(cleanId, gameInstance);
    if (typeof this.onRoomCreated === 'function') {
      this.onRoomCreated(gameInstance);
    }
    return gameInstance;
  }

  createRoom(customId = null, password = '') {
    this.cleanupIdleRooms();

    const roomId = customId && String(customId).trim() ? String(customId).trim().toUpperCase() : this.generateRoomCode();
    if (this.rooms.has(roomId)) {
      const room = this.rooms.get(roomId);
      if (password) room.password = String(password).trim();
      return room;
    }

    if (this.rooms.size >= this.maxRooms) {
      throw new Error(`Все ${this.maxRooms} бункера сейчас заняты другими игроками. Подождите, пока освободится место (комната освобождается после 5 минут неактивности).`);
    }

    const gameInstance = new SingleGame(roomId);
    if (password) gameInstance.password = String(password).trim();
    this.rooms.set(roomId, gameInstance);
    if (typeof this.onRoomCreated === 'function') {
      this.onRoomCreated(gameInstance);
    }
    return gameInstance;
  }

  listRooms() {
    this.cleanupIdleRooms();
    return {
      activeCount: this.rooms.size,
      maxRooms: this.maxRooms,
      rooms: Array.from(this.rooms.values()).map(r => ({
        roomId: r.roomId,
        playersCount: r.players.size,
        status: r.status,
        hasPassword: Boolean(r.password),
        lockedLobby: Boolean(r.lockedLobby),
        idleSeconds: Math.floor((Date.now() - (r.lastActivity || Date.now())) / 1000)
      }))
    };
  }
}

const roomManager = new RoomManager();
const singleGameInstance = roomManager.getRoom('101');

module.exports = {
  game: singleGameInstance,
  SingleGame,
  RoomManager,
  roomManager,
  CATEGORIES,
  getNetworkInfo
};
