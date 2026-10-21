// --- BUNKER TAG & PARAMETER HELPER ---
// Standard survival parameters with aliases and visual styling
const TagHelper = {
  PARAM_DEFINITIONS: {
    fire: {
      name: 'Пожаротушение',
      icon: '🧯',
      color: '#f97316',
      bg: 'rgba(249, 115, 22, 0.15)',
      aliases: ['пожаротушение', 'пожар', 'огонь', 'тушение', 'огнетушитель', 'песок']
    },
    medicine: {
      name: 'Медицина',
      icon: '💊',
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.15)',
      aliases: ['медицина', 'врач', 'здоровье', 'лечение', 'аптечка', 'доктор', 'хирург', 'травматолог', 'лекарства']
    },
    food: {
      name: 'Провизия/Вода',
      icon: '🍞',
      color: '#eab308',
      bg: 'rgba(234, 179, 8, 0.15)',
      aliases: ['еда', 'провизия', 'вода', 'питание', 'припасы', 'пайки', 'пища', 'консервы', 'ферма', 'теплица']
    },
    engineering: {
      name: 'Инженерия',
      icon: '⚙️',
      color: '#06b6d4',
      bg: 'rgba(6, 182, 212, 0.15)',
      aliases: ['инженерия', 'техника', 'ремонт', 'энергия', 'электрика', 'механика', 'строительство', 'генератор', 'станки']
    },
    psycho: {
      name: 'Психика/Сон',
      icon: '🧠',
      color: '#a855f7',
      bg: 'rgba(168, 85, 247, 0.15)',
      aliases: ['психика', 'стресс', 'сон', 'мораль', 'воля', 'спокойствие', 'психолог', 'релакс']
    },
    defense: {
      name: 'Защита/Оборона',
      icon: '🛡️',
      color: '#3b82f6',
      bg: 'rgba(59, 130, 246, 0.15)',
      aliases: ['защита', 'оборона', 'оружие', 'броня', 'безопасность', 'охрана', 'штурм', 'винтовка']
    },
    science: {
      name: 'Наука/Био',
      icon: '🔬',
      color: '#ec4899',
      bg: 'rgba(236, 72, 153, 0.15)',
      aliases: ['наука', 'биология', 'исследования', 'генетика', 'технологии', 'ученый', 'химия', 'лаборатория']
    }
  },

  parse(rawText) {
    if (!rawText || typeof rawText !== 'string') {
      return { cleanText: String(rawText || ''), tags: [] };
    }

    const tags = [];
    // Match #Tag[N], #Tag:N, #Tag+N, or simply #Tag
    const tagRegex = /#([а-яёa-z0-9_-]+)(?:\[(\d+)\]|:(\d+)|\+(\d+))?/gi;
    let match;

    while ((match = tagRegex.exec(rawText)) !== null) {
      const rawTag = match[0];
      const tagWord = match[1].toLowerCase();
      const valStr = match[2] || match[3] || match[4];
      const val = valStr ? parseInt(valStr, 10) : 2;

      let matchedDefKey = null;
      for (const [key, def] of Object.entries(this.PARAM_DEFINITIONS)) {
        if (def.aliases.some(alias => tagWord.includes(alias) || alias.includes(tagWord))) {
          matchedDefKey = key;
          break;
        }
      }

      if (matchedDefKey) {
        const def = this.PARAM_DEFINITIONS[matchedDefKey];
        tags.push({
          key: matchedDefKey,
          name: def.name,
          icon: def.icon,
          color: def.color,
          bg: def.bg,
          value: Math.max(1, val),
          raw: rawTag
        });
      } else {
        const capName = match[1].charAt(0).toUpperCase() + match[1].slice(1);
        tags.push({
          key: 'custom_' + tagWord,
          name: capName,
          icon: '🏷️',
          color: '#94a3b8',
          bg: 'rgba(148, 163, 184, 0.15)',
          value: Math.max(1, val),
          raw: rawTag
        });
      }
    }

    // Clean text by stripping raw tag matches and empty parentheses
    let cleanText = rawText
      .replace(/#([а-яёa-z0-9_-]+)(?:\[(\d+)\]|:(\d+)|\+(\d+))?/gi, '')
      .replace(/\(\s*[,;\s]*\)/g, '')
      .replace(/\(\s+/g, '(')
      .replace(/\s+\)/g, ')')
      .replace(/\s{2,}/g, ' ')
      .trim();

    cleanText = cleanText.replace(/\(\s*,\s*/g, '(').replace(/\s*,\s*\)/g, ')');
    if (cleanText === '()' || cleanText === '') cleanText = rawText;

    return { cleanText, tags };
  },

  renderTagsHtml(tags) {
    if (!tags || tags.length === 0) return '';
    return tags.map(t => `
      <span class="card-tag-chip" style="color: ${t.color}; background: ${t.bg}; border: 1px solid ${t.color}40;">
        ${t.icon} ${t.name} +${t.value}
      </span>
    `).join('');
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TagHelper;
}
