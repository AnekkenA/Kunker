// --- UGC CARD CREATOR (MODE 2: С НУЛЯ) ---
const UgcCreator = {
  categories: [],
  hasSubmitted: false,

  samplePresets: {
    profession: ['Кибер-повар', 'Астро-шахтер', 'Детектив-экстрасенс', 'Таксист на летающей тарелке', 'Генетик-самоучка'],
    health: ['Железные легкие', 'Аллергия на ложь', 'Иммунитет к ядам', 'Искусственный глаз', 'Ночное зрение'],
    biology: ['Мужчина, 30 лет, атлет', 'Женщина, 25 лет, фертильна', 'Киборг, 50 лет, вынослив', 'Женщина, 40 лет, ученый', 'Мужчина, 18 лет, ловкий'],
    hobby: ['Коллекционирование метеоритов', 'Взлом старых спутников', 'Дрессировка мутантов', 'Игра на лазерной гитаре', 'Грибная кулинария'],
    traits: ['Абсолютное бесстрашие', 'Параноик к роботам', 'Душа компании', 'Перфекционист', 'Хитрый дипломат'],
    facts: ['Случайно нашел вход в этот бункер', 'Знает пароль от реактора', 'Бывший шпион корпорации', 'Спас 10 человек во время бури', 'Владеет картой тайных ходов'],
    small_inventory: ['Плазменный резак', 'Фляга чистого спирта', 'Набор отмычек', 'Рация дальнего действия', 'Аптечка со стимуляторами'],
    large_inventory: ['Солнечная панель на 5 кВт', 'Ящик армейских пайков', 'Сварочный аппарат', 'Бронированный скафандр', 'Компактный очиститель воды'],
    special_cards: ['«Второе Дыхание»: Отмените свое изгнание 1 раз.', '«Шпионаж»: Посмотрите все скрытые карты любого игрока.', '«Переворот»: Заставьте двух игроков поменяться профессиями.', '«Убежище +1»: Увеличьте вместимость бункера на +1.', '«Право Вето»: Отмените решение Мастера на 1 ход.']
  },

  init() {
    this.bindEvents();
  },

  bindEvents() {
    // Autofill button
    document.getElementById('btn-ugc-autofill').addEventListener('click', () => {
      this.autofillRandom();
      App.playSound('click');
      App.showToast('🎲 Поля заполнены случайными вариантами!');
    });

    // Submit UGC
    document.getElementById('btn-ugc-submit').addEventListener('click', async () => {
      const submissions = this.gatherSubmissions();
      try {
        await App.sendAction('submit_ugc', { submissions });
        this.hasSubmitted = true;
        document.getElementById('ugc-status-badge').textContent = '✅ Карты отправлены! Ожидание остальных...';
        document.getElementById('ugc-status-badge').style.background = 'var(--accent-green)';
        App.playSound('start');
        App.showToast('✨ Ваши 45 карт успешно отправлены в банк бункера!');
      } catch (e) {
        App.showToast(`Ошибка: ${e.message}`);
      }
    });

    // Master start UGC game button
    document.getElementById('btn-ugc-start-game').addEventListener('click', async () => {
      const themeName = document.getElementById('input-ugc-theme-name').value.trim();
      await App.sendAction('start_ugc_game', {
        saveThemeName: themeName || null
      });
      App.playSound('start');
    });
  },

  render(state) {
    this.categories = state.categories || [];
    const container = document.getElementById('ugc-categories-container');

    // Build form if empty
    if (container.children.length === 0) {
      container.innerHTML = this.categories.map(cat => `
        <div class="ugc-category-box">
          <div class="ugc-category-title">
            <span>${cat.icon}</span>
            <span>${cat.name} (5 вариантов)</span>
          </div>
          <div class="ugc-inputs-grid">
            ${[1, 2, 3, 4, 5].map(i => `
              <input type="text" class="form-input ugc-input" data-cat="${cat.key}" data-index="${i - 1}" placeholder="Вариант ${i}">
            `).join('')}
          </div>
        </div>
      `).join('');
    }

    // Master Panel display
    const masterPanel = document.getElementById('ugc-master-panel');
    if (state.isHost) {
      masterPanel.classList.remove('hidden');
      const readyList = document.getElementById('ugc-players-ready-list');
      readyList.innerHTML = state.players.map(p => `
        <div style="margin-bottom: 6px; font-size: 13px;">
          ${p.ugcReady ? '✅' : '⏳'} <strong>${p.name}</strong> — ${p.ugcReady ? '<span class="text-green">Заполнил карты</span>' : '<span class="text-dim">Пишет...</span>'}
        </div>
      `).join('');
    } else {
      masterPanel.classList.add('hidden');
    }
  },

  gatherSubmissions() {
    const submissions = {};
    this.categories.forEach(cat => {
      submissions[cat.key] = [];
      const inputs = document.querySelectorAll(`.ugc-input[data-cat="${cat.key}"]`);
      inputs.forEach(input => {
        submissions[cat.key].push(input.value.trim() || 'Стандартная карта');
      });
    });
    return submissions;
  },

  autofillRandom() {
    this.categories.forEach(cat => {
      const inputs = document.querySelectorAll(`.ugc-input[data-cat="${cat.key}"]`);
      const presets = this.samplePresets[cat.key] || ['Вариант 1', 'Вариант 2', 'Вариант 3', 'Вариант 4', 'Вариант 5'];
      inputs.forEach((input, idx) => {
        input.value = presets[idx % presets.length];
      });
    });
  }
};

window.addEventListener('DOMContentLoaded', () => {
  UgcCreator.init();
});
