const fs = require('fs');
const path = require('path');

const DECKS_DIR = path.join(__dirname, '..', 'decks');

// Standard built-in decks that are permanent and must never be deleted
const BUILTIN_DECK_IDS = new Set([
  'classic',
  'magic',
  'space_colony',
  'stalker_zone',
  'steampunk',
  'techno',
  'zombie_apocalypse'
]);

class DeckLoader {
  constructor() {
    this.decks = new Map();
    this.loadAllDecks();
  }

  loadAllDecks() {
    this.decks.clear();
    if (!fs.existsSync(DECKS_DIR)) {
      fs.mkdirSync(DECKS_DIR, { recursive: true });
    }

    const files = fs.readdirSync(DECKS_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const filePath = path.join(DECKS_DIR, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (data && data.id) {
          const isBuiltin = BUILTIN_DECK_IDS.has(data.id);
          data.isBuiltin = isBuiltin;
          data.isCustom = !isBuiltin;
          this.decks.set(data.id, data);
        }
      } catch (err) {
        console.error(`Ошибка при загрузке колоды ${file}:`, err.message);
      }
    }
  }

  getDeckList() {
    const list = [];
    for (const [id, deck] of this.decks.entries()) {
      const isBuiltin = BUILTIN_DECK_IDS.has(id);
      list.push({
        id: deck.id,
        name: deck.name || id,
        description: deck.description || '',
        isBuiltin,
        isCustom: !isBuiltin,
        counts: {
          disasters: (deck.disasters || []).length,
          bunker: ((deck.bunker || []).length || (deck.conditions || []).filter(c => !(c.title || '').includes('угроз') && !(c.title || '').includes('Угроз')).length),
          threats: ((deck.threats || []).length || (deck.conditions || []).filter(c => (c.title || '').includes('угроз') || (c.title || '').includes('Угроз')).length),
          conditions: (deck.conditions || []).length,
          professions: (deck.professions || []).length,
          health: (deck.health || []).length,
          biology: (deck.biology || []).length,
          hobby: (deck.hobby || []).length,
          traits: (deck.traits || []).length,
          facts: (deck.facts || []).length,
          small_inventory: (deck.small_inventory || []).length,
          large_inventory: (deck.large_inventory || []).length,
          special_cards: (deck.special_cards || []).length
        }
      });
    }
    return list;
  }

  getDeck(id) {
    return this.decks.get(id);
  }

  saveDeck(deckData) {
    if (!deckData || !deckData.id) {
      throw new Error('У колоды должен быть уникальный ID');
    }
    const safeId = deckData.id.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    deckData.id = safeId;
    const isBuiltin = BUILTIN_DECK_IDS.has(safeId);
    deckData.isBuiltin = isBuiltin;
    deckData.isCustom = !isBuiltin;
    if (!isBuiltin) {
      deckData.createdAt = Date.now();
    }
    const filePath = path.join(DECKS_DIR, `${safeId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(deckData, null, 2), 'utf-8');
    this.decks.set(safeId, deckData);
    return deckData;
  }

  deleteDeck(id) {
    if (BUILTIN_DECK_IDS.has(id)) {
      throw new Error('Встроенные стандартные колоды нельзя удалять.');
    }
    const filePath = path.join(DECKS_DIR, `${id}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    this.decks.delete(id);
  }

  // Cleanup custom uploaded/UGC decks not in active use by any room
  cleanupCustomDecks(activeDeckIdsSet = new Set()) {
    for (const [id, deck] of this.decks.entries()) {
      if (BUILTIN_DECK_IDS.has(id)) continue; // Never remove default 7 themes
      if (activeDeckIdsSet && activeDeckIdsSet.has(id)) continue; // In active use by an ongoing game room

      const filePath = path.join(DECKS_DIR, `${id}.json`);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`[DECKS] Временная пользовательская тема удалена: ${id}.json`);
        } catch (e) {
          console.warn(`Не удалось удалить файл ${id}.json:`, e.message);
        }
      }
      this.decks.delete(id);
    }
  }
}

module.exports = new DeckLoader();
module.exports.BUILTIN_DECK_IDS = BUILTIN_DECK_IDS;
