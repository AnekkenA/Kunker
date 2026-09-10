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
      publicUrl = data.publicUrl;
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
    this.resetGame();
  }

  resetGame() {
    this.password = '';
    this.hostId = null;
    this.status = 'lobby'; // 'lobby' | 'ugc_building' | 'playing' | 'finished'
    this.mode = 'preset'; // 'preset' | 'ugc'
    this.selectedDecks = ['classic'];
    this.bunkerCapacity = 3;

    // World Cards
    this.disaster = null;
    this.condition = null;
    this.results = null;

    // Active Card Pools
    this.activePools = {};

    // Players: Map of id -> Player
    this.players = new Map();
    this.logs = [];

    this.addLog('Бункер инициализирован и готов к приему выживших.');
  }

  addLog(text) {
    const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    this.logs.unshift({ time, text });
    if (this.logs.length > 50) this.logs.pop();
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
      this.addLog(`⚠️ Мастер ИСКЛЮЧИЛ игрока ${player.name} из бункера!`);
    } else {
      this.addLog(`♻️ Мастер ВЕРНУЛ игрока ${player.name} обратно в бункер.`);
    }
    return player;
  }

  revealCard(playerId, categoryKey, requesterId) {
    const player = this.players.get(playerId);
    if (!player) throw new Error('Игрок не найден.');

    if (requesterId !== playerId && requesterId !== this.hostId) {
      throw new Error('Вы можете открывать только свои карты.');
    }

    if (!player.cards[categoryKey]) {
      throw new Error('Некорректная категория карты.');
    }

    player.cards[categoryKey].revealed = !player.cards[categoryKey].revealed;
    const catObj = CATEGORIES.find(c => c.key === categoryKey);
    const catName = catObj ? catObj.name : categoryKey;

    if (player.cards[categoryKey].revealed) {
      this.addLog(`🃏 ${player.name} открыл [${catName}]: "${player.cards[categoryKey].text}"`);
    } else {
      this.addLog(`🔒 ${player.name} скрыл [${catName}].`);
    }
    return player.cards[categoryKey];
  }

  revealAllPlayerCards(playerId, requesterId) {
    if (requesterId !== this.hostId && requesterId !== playerId) {
      throw new Error('Нет прав на открытие всех карт.');
    }
    const player = this.players.get(playerId);
    if (!player) throw new Error('Игрок не найден.');

    CATEGORIES.forEach(cat => {
      if (player.cards[cat.key]) {
        player.cards[cat.key].revealed = true;
      }
    });
    this.addLog(`📢 Все карты игрока ${player.name} были раскрыты!`);
  }

  // --- MASTER SPECIAL ACTIONS (СПЕЦ-МЕХАНИКИ МАСТЕРА) ---

  // 1. Замена карты из колоды
  replacePlayerCard(targetPlayerId, categoryKey, requesterId) {
    if (requesterId !== this.hostId) {
      throw new Error('Только Мастер может применять спец-действия.');
    }
    const player = this.players.get(targetPlayerId);
    if (!player) throw new Error('Игрок не найден.');

    const catPool = this.activePools[categoryKey] || [];
    let newCardText = 'Новая карта выжившего';
    if (catPool.length > 0) {
      newCardText = getRandomItem(catPool, newCardText);
    } else {
      const fallbackDeck = deckLoader.getDeck('classic') || {};
      const list = fallbackDeck[categoryKey] || fallbackDeck[categoryKey + 's'] || ['—'];
      newCardText = getRandomItem(list, newCardText);
    }

    const wasRevealed = player.cards[categoryKey] ? player.cards[categoryKey].revealed : false;

    player.cards[categoryKey] = {
      text: newCardText,
      revealed: wasRevealed
    };

    const catObj = CATEGORIES.find(c => c.key === categoryKey);
    const catName = catObj ? catObj.name : categoryKey;

    this.addLog(`🎲 Мастер ЗАМЕНИЛ карту [${catName}] у игрока ${player.name}! ${wasRevealed ? `(Новая: "${newCardText}")` : '(Карта скрыта)'}`);
    return player.cards[categoryKey];
  }

  // 2. Обмен картами между двумя игроками
  swapPlayerCards(player1Id, player2Id, categoryKey, requesterId) {
    if (requesterId !== this.hostId) {
      throw new Error('Только Мастер может применять спец-действия.');
    }

    const p1 = this.players.get(player1Id);
    const p2 = this.players.get(player2Id);

    if (!p1 || !p2) throw new Error('Игроки для обмена не найдены.');
    if (!p1.cards[categoryKey] || !p2.cards[categoryKey]) throw new Error('Категория не найдена.');

    const temp = p1.cards[categoryKey];
    p1.cards[categoryKey] = p2.cards[categoryKey];
    p2.cards[categoryKey] = temp;

    const catObj = CATEGORIES.find(c => c.key === categoryKey);
    const catName = catObj ? catObj.name : categoryKey;

    this.addLog(`🔄 Мастер ОБМЕНЯЛ карты [${catName}] между ${p1.name} и ${p2.name}!`);
    return true;
  }

  // 3. Перемешать открытые карты выбранной категории
  shuffleRevealedCards(categoryKey, requesterId) {
    if (requesterId !== this.hostId) {
      throw new Error('Только Мастер может применять спец-действия.');
    }

    const eligiblePlayers = [];
    this.players.forEach(p => {
      const card = p.cards[categoryKey];
      if (card && card.revealed && card.text && card.text !== '—' && !card.text.includes('(Украдено)')) {
        eligiblePlayers.push(p);
      }
    });

    if (eligiblePlayers.length < 2) {
      throw new Error(`Для перемешивания нужно хотя бы 2 игрока с ОТКРЫТОЙ картой в категории "${categoryKey}". Сейчас открыто: ${eligiblePlayers.length}.`);
    }

    const texts = eligiblePlayers.map(p => p.cards[categoryKey].text);
    const shuffledTexts = shuffle(texts);

    eligiblePlayers.forEach((p, idx) => {
      p.cards[categoryKey].text = shuffledTexts[idx];
    });

    const catObj = CATEGORIES.find(c => c.key === categoryKey);
    const catName = catObj ? catObj.name : categoryKey;

    this.addLog(`🔀 Мастер ПЕРЕМЕШАЛ все открытые карты [${catName}] между ${eligiblePlayers.length} игроками (${eligiblePlayers.map(p => p.name).join(', ')})!`);
    return true;
  }

  // 4. Украсть карту у одного игрока в пользу другого
  stealPlayerCard(fromPlayerId, toPlayerId, categoryKey, requesterId) {
    if (requesterId !== this.hostId) {
      throw new Error('Только Мастер может применять спец-действия.');
    }

    const victim = this.players.get(fromPlayerId);
    const thief = this.players.get(toPlayerId);

    if (!victim || !thief) throw new Error('Игроки не найдены.');
    if (fromPlayerId === toPlayerId) throw new Error('Нельзя украсть карту у самого себя.');

    const stolenCard = victim.cards[categoryKey];
    if (!stolenCard || !stolenCard.text || stolenCard.text === '—') {
      throw new Error(`У игрока ${victim.name} нет карты в этой категории.`);
    }

    const stolenText = stolenCard.text;
    const wasRevealed = stolenCard.revealed;

    // Thief receives the card
    thief.cards[categoryKey] = {
      text: `${stolenText} (Украдено у ${victim.name})`,
      revealed: wasRevealed
    };

    // Victim loses the card
    victim.cards[categoryKey] = {
      text: '— (Украдено)',
      revealed: true
    };

    const catObj = CATEGORIES.find(c => c.key === categoryKey);
    const catName = catObj ? catObj.name : categoryKey;

    this.addLog(`🦹 Спец-действие: Игрок ${thief.name} УКРАЛ карту [${catName}] у ${victim.name}!`);
    return true;
  }

  startPresetGame(requesterId) {
    if (requesterId !== this.hostId) {
      throw new Error('Только Мастер игры может запустить игру.');
    }
    if (this.players.size < 1) {
      throw new Error('Для игры нужен хотя бы 1 игрок.');
    }

    const pool = {
      disasters: [],
      conditions: [],
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

    this.selectedDecks.forEach(deckId => {
      const deck = deckLoader.getDeck(deckId);
      if (deck) {
        Object.keys(pool).forEach(k => {
          const src = deck[k] || deck[k + 's'] || deck[k.replace(/s$/, '')] || [];
          if (Array.isArray(src)) {
            pool[k].push(...src);
          }
        });
      }
    });

    if (pool.disasters.length === 0) {
      const fallbackDeck = deckLoader.getDeck('classic') || {};
      Object.keys(pool).forEach(k => {
        pool[k] = fallbackDeck[k] || fallbackDeck[k + 's'] || ['Стандартная карта'];
      });
    }

    this.activePools = pool;

    const disasterItem = getRandomItem(pool.disasters, {
      title: 'Неизвестный глобальный катаклизм',
      goal: 'Выжить в замкнутом бункере любой ценой.'
    });
    this.disaster = {
      title: typeof disasterItem === 'string' ? disasterItem : disasterItem.title,
      goal: typeof disasterItem === 'string' ? 'Выжить и возродить цивилизацию.' : (disasterItem.goal || disasterItem.description || ''),
      revealed: true
    };

    const conditionItem = getRandomItem(pool.conditions, {
      title: 'Автономный бункер высшей категории',
      description: 'Все системы жизнеобеспечения функционируют в штатном режиме.'
    });
    this.condition = {
      title: typeof conditionItem === 'string' ? conditionItem : conditionItem.title,
      description: typeof conditionItem === 'string' ? conditionItem : (conditionItem.description || conditionItem.goal || ''),
      revealed: true
    };

    CATEGORIES.forEach(cat => {
      const sourceList = pool[cat.key] || ['—'];
      const shuffledCat = shuffle(sourceList.length > 0 ? sourceList : ['—']);
      let index = 0;
      this.players.forEach(player => {
        player.isExiled = false;
        const text = shuffledCat[index % shuffledCat.length] || '—';
        player.cards[cat.key] = {
          text: typeof text === 'string' ? text : (text.name || text.title || JSON.stringify(text)),
          revealed: false
        };
        index++;
      });
    });

    this.results = null;
    this.status = 'playing';
    this.addLog(`🚀 Игра началась! Катастрофа: "${this.disaster.title}". Мест в бункере: ${this.bunkerCapacity}`);
  }

  startUgcPhase(requesterId) {
    if (requesterId !== this.hostId) {
      throw new Error('Только Мастер игры может запустить создание карт.');
    }
    this.status = 'ugc_building';
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
      conditions: [],
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

    this.activePools = pool;

    this.disaster = {
      title: 'Абсолютный непредсказуемый катаклизм игроков',
      goal: 'Выжить в условиях, созданных самими игроками!',
      revealed: true
    };
    this.condition = {
      title: 'Убежище ручной сборки',
      description: 'Условия и оборудование бункера соответствуют безумным картам игроков.',
      revealed: true
    };

    if (saveAsThemeName) {
      try {
        const customDeck = {
          id: 'custom_' + Date.now(),
          name: saveAsThemeName.trim() || 'Колода игроков',
          description: `Создана игроками в убежище`,
          disasters: [this.disaster],
          conditions: [this.condition],
          ...pool
        };
        deckLoader.saveDeck(customDeck);
        this.addLog(`💾 Набор карт сохранен в библиотеку как "${customDeck.name}".`);
      } catch (e) {
        console.error('Ошибка сохранения колоды:', e);
      }
    }

    CATEGORIES.forEach(cat => {
      const shuffledCat = shuffle(pool[cat.key]);
      let index = 0;
      this.players.forEach(player => {
        player.isExiled = false;
        const text = shuffledCat[index % shuffledCat.length] || '—';
        player.cards[cat.key] = {
          text,
          revealed: false
        };
        index++;
      });
    });

    this.results = null;
    this.status = 'playing';
    this.addLog(`🚀 Игра началась в режиме "С нуля"! Мест в бункере: ${this.bunkerCapacity}`);
  }

  finishGame(requesterId) {
    if (requesterId !== this.hostId) {
      throw new Error('Только Мастер игры может подвести итоги.');
    }

    const survivors = [];
    const exiled = [];

    this.players.forEach(p => {
      const summary = {
        id: p.id,
        name: p.name,
        profession: p.cards.profession ? p.cards.profession.text : '—',
        health: p.cards.health ? p.cards.health.text : '—',
        biology: p.cards.biology ? p.cards.biology.text : '—'
      };

      if (p.isExiled) {
        exiled.push(summary);
      } else {
        survivors.push(summary);
      }
    });

    const isSuccess = survivors.length > 0 && survivors.length <= this.bunkerCapacity;
    let verdict = '';
    if (survivors.length === 0) {
      verdict = '💀 Все выжившие были изгнаны. Бункер пуст, человечество угасло...';
    } else if (survivors.length > this.bunkerCapacity) {
      verdict = `⚠️ ПЕРЕНАСЕЛЕНИЕ! В бункере осталось ${survivors.length} чел., но мест было всего ${this.bunkerCapacity}. Ресурсов не хватило на всех!`;
    } else {
      verdict = `🎉 УСПЕШНОЕ ВЫЖИВАНИЕ! В бункер вошли ${survivors.length} чел. из ${this.bunkerCapacity} доступных мест. Бункер выстоял!`;
    }

    this.results = {
      survivors,
      exiled,
      bunkerCapacity: this.bunkerCapacity,
      isSuccess,
      verdict,
      disaster: this.disaster ? this.disaster.title : 'Катастрофа'
    };

    this.status = 'finished';
    this.addLog(`🏁 ФИНАЛ: ${verdict}`);
    return this.results;
  }

  resetToLobby(requesterId) {
    if (requesterId !== this.hostId) {
      throw new Error('Только Мастер игры может сбросить игру в лобби.');
    }
    this.status = 'lobby';
    this.results = null;
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
    const playersList = [];
    this.players.forEach(p => {
      const isSelf = p.id === forPlayerId;
      const isMaster = forPlayerId === this.hostId;
      const isFinished = this.status === 'finished';
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

    const isHost = forPlayerId === this.hostId;

    return {
      hasPassword: Boolean(this.password),
      status: this.status,
      mode: this.mode,
      selectedDecks: this.selectedDecks,
      bunkerCapacity: this.bunkerCapacity,
      disaster: this.disaster,
      condition: this.condition,
      results: this.results,
      isHost,
      myId: forPlayerId,
      players: playersList,
      categories: CATEGORIES,
      logs: this.logs.slice(0, 30),
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
