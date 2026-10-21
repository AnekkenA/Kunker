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

class SingleGame {
  constructor(roomId = 'BUNKER-101') {
    this.roomId = (roomId || 'BUNKER-101').trim().toUpperCase();
    this.sseClients = new Set();
    this.broadcastCallback = null;
    this.resetGame();
  }

  setBroadcast(fn) {
    this.broadcastCallback = fn;
  }

  notifyBroadcast() {
    if (typeof this.broadcastCallback === 'function') {
      this.broadcastCallback(this);
    }
  }

  broadcast() {
    this.notifyBroadcast();
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

    switch (actionType) {
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

      case 'spy_card': {
        const targetPlayer = this.players.get(params.targetPlayerId);
        if (!targetPlayer) throw new Error('Целевой игрок не найден.');
        const catKey = params.categoryKey || 'profession';
        const targetCard = targetPlayer.cards[catKey];
        const catObj = this.categories.find(c => c.key === catKey);
        const catName = catObj ? catObj.name : catKey;
        this.addLog(`⚡ ${player.name} применил шпионаж против игрока ${targetPlayer.name} и тайно изучил его [${catName}].`);
        result.privateSpyResult = {
          targetPlayerName: targetPlayer.name,
          categoryName: catName,
          cardText: targetCard ? (targetCard.cleanText || targetCard.text) : 'Пусто'
        };
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

    this.categories.forEach(cat => {
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

  startUgcGame(requesterId, saveAsThemeName = null) {
    if (requesterId !== this.hostId) {
      throw new Error('Только Мастер игры может запустить игру.');
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
      const teamRes = this.calculateTeamResources(false);
      const resourceBonus = Math.min(20, Math.round(
        (teamRes.fire * 1.5) +
        (teamRes.medicine * 2) +
        (teamRes.food * 2) +
        (teamRes.engineering * 2) +
        (teamRes.psycho * 1.5) +
        (teamRes.defense * 1.5) +
        (teamRes.science * 1.5)
      ));

      percentage = Math.max(5, percentage + resourceBonus - (excess * 20));
      isSuccess = percentage >= 50;
      verdict = `⚠️ ПЕРЕНАСЕЛЕНИЕ БУНКЕРА! (${survivorsCount} чел. на ${capacity} мест, Шанс: ${percentage}%)`;
      epilogue = `В бункер попытались набиться ${survivorsCount} человек, хотя спальных капсул и ресурсов было рассчитано всего на ${capacity}. ` +
        `Спустя 3 месяца системы регенерации кислорода и фильтры вышли из строя от предельной нагрузки (штраф перенаселения -${excess * 20}%). ` +
        (isSuccess
          ? `Однако благодаря совокупным навыкам и запасам команды выжившим удалось преодолеть кризис и стабилизировать системы убежища!`
          : `Началась ожесточенная борьба за пайки и воду. Бункер не выдержал внутреннего хаоса.`);

      const resLine = `\n\n📊 Совокупные ресурсы команды:\n` +
        `🧯 Пожаротушение: ${teamRes.fire} | 💊 Медицина: ${teamRes.medicine} | 🍞 Провизия: ${teamRes.food} | ⚙️ Инженерия: ${teamRes.engineering} | 🧠 Психика: ${teamRes.psycho} | 🛡️ Защита: ${teamRes.defense} | 🔬 Наука: ${teamRes.science}` +
        (resourceBonus > 0 ? ` (+${resourceBonus}% к шансу выживания за полезные предметы и навыки)` : '') +
        ` | ⚠️ Штраф за перенаселение: -${excess * 20}%`;
      epilogue += resLine;
    } else {
      // Normal or under capacity
      const teamRes = this.calculateTeamResources(false);
      const resourceBonus = Math.min(20, Math.round(
        (teamRes.fire * 1.5) +
        (teamRes.medicine * 2) +
        (teamRes.food * 2) +
        (teamRes.engineering * 2) +
        (teamRes.psycho * 1.5) +
        (teamRes.defense * 1.5) +
        (teamRes.science * 1.5)
      ));

      percentage = Math.min(100, Math.max(5, percentage + resourceBonus));

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

      const resLine = `\n\n📊 Совокупные ресурсы команды:\n` +
        `🧯 Пожаротушение: ${teamRes.fire} | 💊 Медицина: ${teamRes.medicine} | 🍞 Провизия: ${teamRes.food} | ⚙️ Инженерия: ${teamRes.engineering} | 🧠 Психика: ${teamRes.psycho} | 🛡️ Защита: ${teamRes.defense} | 🔬 Наука: ${teamRes.science}` +
        (resourceBonus > 0 ? ` (+${resourceBonus}% к шансу выживания за полезные предметы и навыки)` : '');
      epilogue += resLine;
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
      isHost: isMaster,
      myId: this.players.has(forPlayerId) ? forPlayerId : null,
      players: playersList,
      categories: this.categories,
      logs: this.logs.slice(0, 35),
      roomId: this.roomId,
      network: getNetworkInfo(this.roomId)
    };
  }
}

class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.defaultRoomId = 'BUNKER-101';
    this.onRoomCreated = null;
    // Pre-create default room
    this.getRoom(this.defaultRoomId);
  }

  generateRoomCode() {
    const digits = Math.floor(1000 + Math.random() * 9000);
    return `BUNKER-${digits}`;
  }

  getRoom(roomId, createIfNotFound = true) {
    let cleanId = (roomId || '').trim().toUpperCase();
    if (!cleanId) {
      cleanId = this.defaultRoomId;
    }

    if (!this.rooms.has(cleanId)) {
      if (!createIfNotFound) return null;
      const gameInstance = new SingleGame(cleanId);
      this.rooms.set(cleanId, gameInstance);
      if (typeof this.onRoomCreated === 'function') {
        this.onRoomCreated(gameInstance);
      }
      return gameInstance;
    }
    return this.rooms.get(cleanId);
  }

  createRoom(customId = null) {
    const roomId = customId ? customId.trim().toUpperCase() : this.generateRoomCode();
    const gameInstance = new SingleGame(roomId);
    this.rooms.set(roomId, gameInstance);
    if (typeof this.onRoomCreated === 'function') {
      this.onRoomCreated(gameInstance);
    }
    return gameInstance;
  }

  listRooms() {
    return Array.from(this.rooms.values()).map(r => ({
      roomId: r.roomId,
      playersCount: r.players.size,
      status: r.status,
      disaster: r.disaster ? r.disaster.title : null
    }));
  }
}

const roomManager = new RoomManager();
const singleGameInstance = roomManager.getRoom('BUNKER-101');

module.exports = {
  game: singleGameInstance,
  SingleGame,
  RoomManager,
  roomManager,
  CATEGORIES,
  getNetworkInfo
};
