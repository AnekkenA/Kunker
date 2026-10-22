const fs = require('fs');
const path = require('path');
const TagHelper = require('../client/js/tag_helper');

TagHelper.init();

const decks = [
  require('./data_classic'),
  require('./data_stalker'),
  require('./data_zombie'),
  require('./data_space')
];

const targetDirs = [
  path.join(__dirname, '..', 'decks'),
  path.join('C:', 'Users', 'lma', 'Desktop', 'Папка', 'decks')
];

targetDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {}
  }
});

let totalCardsCount = 0;
let errorsCount = 0;

decks.forEach(deck => {
  console.log(`\n========================================`);
  console.log(`Проверка колоды: ${deck.name} (id: ${deck.id})`);
  console.log(`========================================`);

  const categories = [
    'professions', 'health', 'biology', 'hobby', 'traits',
    'facts', 'small_inventory', 'large_inventory'
  ];

  let deckTotal = 0;

  categories.forEach(catKey => {
    const list = deck[catKey] || [];
    deckTotal += list.length;
    console.log(`  • ${catKey.padEnd(16)}: ${list.length} карт`);

    // Check duplicates
    const seen = new Set();
    list.forEach((item, idx) => {
      const text = typeof item === 'string' ? item : item.text;
      if (seen.has(text)) {
        console.warn(`    ⚠️ ДУБЛИКАТ [${catKey}][${idx}]: "${text}"`);
        errorsCount++;
      }
      seen.add(text);

      // Validate TagHelper parsing
      if (typeof text === 'string' && text.includes('#')) {
        const parsed = TagHelper.parse(text);
        if (parsed.tags.length === 0) {
          console.warn(`    ⚠️ НЕ РАСПОЗНАН ТЕГ [${catKey}][${idx}]: "${text}"`);
          errorsCount++;
        }
      }
    });
  });

  const specialList = deck.special_cards || [];
  const bunkerList = deck.bunker || [];
  const threatsList = deck.threats || [];
  const disastersList = deck.disasters || [];

  deckTotal += specialList.length + bunkerList.length + threatsList.length + disastersList.length;
  console.log(`  • ${'special_cards'.padEnd(16)}: ${specialList.length} карт`);
  console.log(`  • ${'bunker'.padEnd(16)}: ${bunkerList.length} карт`);
  console.log(`  • ${'threats'.padEnd(16)}: ${threatsList.length} карт`);
  console.log(`  • ${'disasters'.padEnd(16)}: ${disastersList.length} карт`);
  console.log(`  => ВСЕГО В ПАКЕ: ${deckTotal} КАРТ`);
  totalCardsCount += deckTotal;

  // Write JSON to targets
  const jsonContent = JSON.stringify(deck, null, 2);
  targetDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      const filePath = path.join(dir, `${deck.id}.json`);
      fs.writeFileSync(filePath, jsonContent, 'utf8');
      console.log(`    ✅ Сохранено в: ${filePath}`);
    }
  });
});

console.log(`\n========================================`);
console.log(`ИТОГО СГЕНЕРИРОВАНО: ${totalCardsCount} карт в 4 паках!`);
console.log(`Ошибок/предупреждений: ${errorsCount}`);
console.log(`========================================\n`);

if (errorsCount > 0) {
  process.exit(1);
}
