const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const deckLoader = require('./deck_loader');

function getNetworkInfo() {
  const renderUrl = process.env.RENDER_EXTERNAL_URL;
  if (renderUrl) {
    return {
      publicUrl: renderUrl,
      localIpUrl: renderUrl,
      radminIpUrl: null,
      localhostUrl: renderUrl
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

  return {
    publicUrl,
    localIpUrl: localIp ? `http://${localIp}:3000` : 'http://localhost:3000',
    radminIpUrl: radminIp ? `http://${radminIp}:3000` : null,
    localhostUrl: 'http://localhost:3000'
  };
}

const CATEGORIES = [
  { key: 'profession', name: 'Профессия', icon: '💼' },
  { key: 'health', name: 'Здоровье', icon: '❤️' },
  { key: 'biology', name: 'Биология', icon: '🧬' },
  { key: 'hobby', name: 'Хобби', icon: '🎨' },
  { key: 'traits', name: 'Черты', icon: '🧠' },
  { key: 'facts', name: 'Доп. сведения', icon: '📜' },
  { key: 'small_inventory', name: 'Малый инв.', icon: '🎒' },
  { key: 'large_inventory', name: 'Крупный инв.', icon: '📦' },
  { key: 'special_cards', name: 'Спец-карта', icon: '⚡' }
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

class SingleGame {
  constructor() {
    this.broadcastCallback = null;
    this.resetGame();
  }

  setBroadcast(fn) {
    this.broadcastCallback = fn;
  }

  notifyBroadcast() {
    if (typeof this.broadcastCallback === 'function') {
      this.broadcastCallback();
    }
  }

  resetGame() {
    this.stopThreatTimer();

    this.password = '';
    this.hostId = null;
    this.status = 'lobby'; // 'lobby' | 'ugc_building' | 'playing' | 'finished'
    this.mode = 'preset'; // 'preset' | 'ugc'
    this.selectedDecks = ['classic'];
    this.bunkerCapacity = 3;

    // Threat / Bunker opening settings
    this.threatMode = 'threshold'; // 'threshold' | 'timer'
    this.threatTimerSeconds = 120; // 2 minutes (120s)
    this.threatTimerCountdown = 120;
    this.threatTimerHandle = null;

    // Threshold reveal milestones
    this.totalRevealsCount = 0;
    this.nextThreshold = 10;
    this.thresholdMilestones = [10, 15, 20, 25, 30, 35, 40];

    // World Cards
    this.disaster = null;
    this.bunkerDeck = [];
    this.threatsDeck = [];
    this.revealedBunkerCards = [];
    this.revealedThreatCards = [];

    // Card Category Decks & In-Play tracking (STRICT 1 COPY PER CARD)
    this.categoryDecks = {};
    this.inPlayCards = {};
    CATEGORIES.forEach(cat => {
      this.categoryDecks[cat.key] = [];
      this.inPlayCards[cat.key] = new Set();
    });

    this.results = null;
    this.players = new Map();
    this.logs = [];

    this.addLog('Бункер инициализирован и готов к приему выживших.');
  }

  addLog(text) {
    const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    this.logs.unshift({ time, text });
    if (this.logs.length > 60) this.logs.pop();
  }

  checkPassword(enteredPassword) {
    if (!this.password) return true;
    return String(enteredPassword).trim() === this.password;
  }

  joinPlayer(name, enteredPassword) {
    if (!this.checkPassword(enteredPassword)) {
      throw new Error('Неверный пароль от бункера.');
    }

    const cleanName = (name || 'Выживший').trim().substring(0, 24);
    if (!cleanName) {
      throw new Error('Введите ваше имя (никнейм).');
    }

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

    CATEGORIES.forEach(cat => {
      player.cards[cat.key] = { text: '', revealed: false };
    });

    this.players.set(playerId, player);
    this.addLog(`👤 ${player.name} вошел в убежище ${isHost ? '(Мастер игры)' : ''}`);
    this.updateBunkerCapacityDefault();

    return { player, playerId, isHost };
  }

  removePlayer(playerId) {
    const p = this.players.get(playerId);
    if (p) {
      this.addLog(`🚪 ${p.name} покинул бункер.`);

      // Free player cards back to category decks if game was playing
      CATEGORIES.forEach(cat => {
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

        // Threshold mode check
        if (this.threatMode === 'threshold' && this.totalRevealsCount >= this.nextThreshold) {
          this.drawWorldCard();
          // Advance threshold milestone
          const nextIdx = this.thresholdMilestones.findIndex(m => m > this.totalRevealsCount);
          if (nextIdx !== -1) {
            this.nextThreshold = this.thresholdMilestones[nextIdx];
          } else {
            const step = Math.max(3, this.players.size);
            this.nextThreshold += step;
          }
        }
      }
    } else {
      this.addLog(`🔒 ${player.name} скрыл [${catName}].`);
    }

    return card;
  }

  // --- MASTER ACTION: REVEAL ANY CARD ---
  revealOtherPlayerCard(targetPlayerId, categoryKey, requesterId) {
    if (requesterId !== this.hostId) {
      throw new Error('Только Мастер игры может вскрывать чужие карты.');
    }
    return this.revealCard(targetPlayerId, categoryKey, requesterId);
  }

  // --- MASTER ACTION: REPLACE CARD WITH RANDOM UNUSED FROM SAME CLASS (STRICT 1 COPY) ---
  replacePlayerCard(targetPlayerId, categoryKey, requesterId) {
    if (requesterId !== this.hostId) {
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

    const newText = getRandomItem(available);

    // Remove new card from deck and mark in play
    this.categoryDecks[categoryKey] = (this.categoryDecks[categoryKey] || []).filter(c => c !== newText);
    this.inPlayCards[categoryKey].add(newText);

    player.cards[categoryKey] = {
      text: newText,
      revealed: wasRevealed
    };

    const catObj = CATEGORIES.find(c => c.key === categoryKey);
    const catName = catObj ? catObj.name : categoryKey;

    this.addLog(`🎲 Мастер ЗАМЕНИЛ карту [${catName}] у игрока ${player.name}! Старая карта вернулась в колоду, выдана случайная свободная.`);
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
    // Choose between bunker and threats: prioritize the one with fewer on table or randomly
    let pickType = 'threat';
    if (this.bunkerDeck.length > 0 && this.threatsDeck.length > 0) {
      if (this.revealedThreatCards.length > this.revealedBunkerCards.length) {
        pickType = 'bunker';
      } else if (this.revealedBunkerCards.length > this.revealedThreatCards.length) {
        pickType = 'threat';
      } else {
        pickType = Math.random() < 0.5 ? 'threat' : 'bunker';
      }
    } else if (this.bunkerDeck.length > 0) {
      pickType = 'bunker';
    } else if (this.threatsDeck.length > 0) {
      pickType = 'threat';
    } else {
      this.addLog('ℹ️ Все доступные карты Бункера и Угроз уже открыты на столе!');
      return null;
    }

    if (pickType === 'bunker') {
      const card = this.bunkerDeck.shift();
      if (card) {
        this.revealedBunkerCards.push(card);
        this.addLog(`🛡️ АВТОМАТИЧЕСКИ ОТКРЫТА КАРТА БУНКЕРА: "${card.title}"! ${card.description}`);
        return { type: 'bunker', card };
      }
    } else {
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
        CATEGORIES.forEach(cat => {
          const list = deck[cat.key] || deck[cat.key + 's'] || [];
          if (Array.isArray(list)) pool[cat.key].push(...list);
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

    // Draw initial Bunker card
    if (this.bunkerDeck.length > 0) {
      this.revealedBunkerCards.push(this.bunkerDeck.shift());
    }

    // 3. Player Cards (STRICT 1 COPY PER CARD)
    CATEGORIES.forEach(cat => {
      let sourceList = pool[cat.key] || [];
      if (sourceList.length === 0) {
        sourceList = classicDeck[cat.key] || classicDeck[cat.key + 's'] || ['—'];
      }

      // De-duplicate master pool
      const uniquePool = Array.from(new Set(sourceList));
      const shuffled = shuffle(uniquePool);

      this.categoryDecks[cat.key] = [...shuffled];
      this.inPlayCards[cat.key] = new Set();

      this.players.forEach(player => {
        player.isExiled = false;
        let cardText = this.categoryDecks[cat.key].shift() || '—';
        if (typeof cardText !== 'string') cardText = cardText.title || cardText.name || JSON.stringify(cardText);

        this.inPlayCards[cat.key].add(cardText);
        player.cards[cat.key] = {
          text: cardText,
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

    this.players.forEach(p => {
      p.ugcReady = false;
      p.ugcSubmissions = {};
      CATEGORIES.forEach(cat => {
        p.ugcSubmissions[cat.key] = ['', '', '', '', ''];
      });
    });
    this.addLog('🛠️ Режим "С нуля": Игроки начали заполнять свои наборы карт.');
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

  startUgcGame(requesterId, saveAsThemeName = null) {
    if (requesterId !== this.hostId) {
      throw new Error('Только Мастер игры может запустить игру.');
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

    this.players.forEach(player => {
      if (player.ugcSubmissions) {
        CATEGORIES.forEach(cat => {
          const list = player.ugcSubmissions[cat.key];
          if (Array.isArray(list)) {
            list.forEach(item => {
              const str = String(item || '').trim();
              if (str) pool[cat.key].push(str);
            });
          }
        });
      }
    });

    const classicDeck = deckLoader.getDeck('classic') || {};
    CATEGORIES.forEach(cat => {
      if (!pool[cat.key] || pool[cat.key].length === 0) {
        pool[cat.key] = classicDeck[cat.key] || classicDeck[cat.key + 's'] || ['Карта игрока'];
      }
    });

    this.disaster = {
      title: 'Непредсказуемый катаклизм игроков',
      goal: 'Выжить в условиях, созданных самими игроками!',
      revealed: true
    };

    this.bunkerDeck = shuffle(classicDeck.bunker || [{ title: 'Убежище ручной сборки', description: 'Оборудование создано игроками' }]);
    this.threatsDeck = shuffle(classicDeck.threats || [{ title: 'Нестабильные внешние генераторы', description: 'Требуется постоянный контроль' }]);
    this.revealedBunkerCards = [this.bunkerDeck.shift()];
    this.revealedThreatCards = [];

    // Distribute unique cards
    CATEGORIES.forEach(cat => {
      const uniquePool = Array.from(new Set(pool[cat.key]));
      const shuffled = shuffle(uniquePool);

      this.categoryDecks[cat.key] = [...shuffled];
      this.inPlayCards[cat.key] = new Set();

      this.players.forEach(player => {
        player.isExiled = false;
        const text = this.categoryDecks[cat.key].shift() || '—';
        this.inPlayCards[cat.key].add(text);
        player.cards[cat.key] = {
          text,
          revealed: false
        };
      });
    });

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

    // Calculation formula
    const totalEvalPoints = evalScores.supplies + evalScores.medicine + evalScores.specialists + evalScores.defense + evalScores.psychology; // 5 to 25
    let percentage = Math.round((totalEvalPoints / 25) * 100);

    let verdict = '';
    let isSuccess = false;
    let epilogue = '';

    if (survivorsCount === 0) {
      percentage = 0;
      isSuccess = false;
      verdict = '💀 ВСЕ ИЗГНАНЫ. БУНКЕР ПУСТ.';
      epilogue = 'Все кандидаты были изгнаны на поверхность. В убежище никто не вошел. Замкнутые системы отключились одна за другой, и человечество в этом регионе прекратило свое существование.';
    } else if (survivorsCount > capacity) {
      const excess = survivorsCount - capacity;
      percentage = Math.max(5, percentage - (excess * 22));
      isSuccess = false;
      verdict = `⚠️ ПЕРЕНАСЕЛЕНИЕ БУНКЕРА! (${survivorsCount} чел. на ${capacity} мест)`;
      epilogue = `В бункер попытались набиться ${survivorsCount} человек, хотя спальных капсул и ресурсов было рассчитано всего на ${capacity}. ` +
        `Спустя 3 месяца системы регенерации кислорода вышли из строя от предельной нагрузки. ` +
        `Началась жестокая борьба за пайки и воду. Бункер не выдержал внутреннего хаоса.`;
    } else {
      // Normal or under capacity
      if (percentage >= 70) {
        isSuccess = true;
        verdict = `🎉 БУНКЕР УСПЕШНО ВЫЖИЛ! (Шанс выживания: ${percentage}%)`;
        epilogue = `Благодаря слаженным действиям команды и грамотному распределению ресурсов, ${survivorsCount} выживших преодолели все угрозы. ` +
          `Запасов и медикаментов хватило на весь срок изоляции. Спустя годы шлюз распахнулся, и спасшиеся начали возрождать новый мир.`;
      } else if (percentage >= 40) {
        isSuccess = true;
        verdict = `⚖️ ТЯЖЕЛАЯ БОРЬБА ЗА ВЫЖИВАНИЕ (Шанс выживания: ${percentage}%)`;
        epilogue = `Группе из ${survivorsCount} человек удалось пережить катастрофу, однако изоляция далась дорогой ценой. ` +
          `Дефицит припасов и нехватка нужных специалистов едва не привели к гибели колонии. Только строжайшая дисциплина спасла убежище.`;
      } else {
        isSuccess = false;
        verdict = `💀 КАТАСТРОФА В БУНКЕРЕ (Шанс выживания: ${percentage}%)`;
        epilogue = `Несмотря на то, что бункер закрылся, критическая нехватка ресурсов, болезни и нерешенные внешние угрозы оказались фатальными. ` +
          `Системы жизнеобеспечения угасли задолго до открытия спасательного шлюза.`;
      }
    }

    this.results = {
      isSuccess,
      percentage,
      verdict,
      epilogue,
      survivors,
      exiled,
      bunkerCapacity: capacity,
      evalScores,
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
    this.addLog('🔄 Мастер вернул игру в лобби.');
  }

  toClientState(forPlayerId) {
    const isMaster = forPlayerId === this.hostId;
    const isFinished = this.status === 'finished';

    const playersList = [];
    this.players.forEach(p => {
      const isSelf = p.id === forPlayerId;
      const safeCards = {};

      CATEGORIES.forEach(cat => {
        const card = p.cards[cat.key] || { text: '', revealed: false };
        if (card.revealed || isSelf || isFinished) {
          safeCards[cat.key] = {
            text: card.text,
            revealed: card.revealed,
            canReveal: isSelf || isMaster
          };
        } else {
          safeCards[cat.key] = {
            text: '',
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

    return {
      hasPassword: Boolean(this.password),
      status: this.status,
      mode: this.mode,
      selectedDecks: this.selectedDecks,
      bunkerCapacity: this.bunkerCapacity,

      // Threat / Bunker mode & progress
      threatMode: this.threatMode,
      threatTimerCountdown: this.threatTimerCountdown,
      totalRevealsCount: this.totalRevealsCount,
      nextThreshold: this.nextThreshold,

      // World Cards
      disaster: this.disaster,
      revealedBunkerCards: this.revealedBunkerCards,
      revealedThreatCards: this.revealedThreatCards,

      results: this.results,
      isHost: isMaster,
      myId: forPlayerId,
      players: playersList,
      categories: CATEGORIES,
      logs: this.logs.slice(0, 35),
      network: getNetworkInfo()
    };
  }
}

const singleGameInstance = new SingleGame();

module.exports = {
  game: singleGameInstance,
  CATEGORIES,
  getNetworkInfo
};
