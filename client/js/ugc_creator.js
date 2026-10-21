// --- UGC CARD CREATOR (MODE 2: С НУЛЯ) ---
const UgcCreator = {
  categories: [],
  hasSubmitted: false,
  lastFocusedInput: null,

  samplePresets: {
    profession: [
      'Пожарный спасатель (#Пожаротушение[5], #Защита[2])',
      'Врач-хирург (#Медицина[5], #Психика[2])',
      'Агроном-селекционер (#Еда[5], #Наука[2])',
      'Инженер-электрик (#Инженерия[5], #Защита[1])',
      'Психотерапевт (#Психика[5], #Медицина[2])'
    ],
    health: [
      'Идеальное здоровье (#Медицина[2])',
      'Устойчивая психика (#Психика[3])',
      'Аллергия на пыль',
      'Ночное зрение (#Защита[2])',
      'Иммунитет к радиации (#Медицина[4])'
    ],
    biology: [
      'Мужчина, 32 года, атлет (#Защита[2])',
      'Женщина, 26 лет, фертильна (#Медицина[1])',
      'Мужчина, 45 лет, физик (#Наука[3])',
      'Женщина, 35 лет, биолог (#Наука[4], #Еда[2])',
      'Мужчина, 22 года, вынослив (#Инженерия[2])'
    ],
    hobby: [
      'Кулинария и консервация (#Еда[4])',
      'Радиолюбитель и пайка (#Инженерия[3])',
      'Дрессировка собак (#Защита[2])',
      'Йога и медитация (#Психика[3])',
      'Туризм и выживание (#Еда[2], #Пожаротушение[2])'
    ],
    traits: [
      'Хладнокровие в стрессе (#Психика[4])',
      'Лидерские качества (#Психика[2])',
      'Педантичность и порядок (#Инженерия[1])',
      'Осторожность и бдительность (#Защита[2])',
      'Оптимизм (#Психика[2])'
    ],
    facts: [
      'Знает расположение пожарных гидрантов бункера (#Пожаротушение[3])',
      'Умеет настраивать гидропонные фермы (#Еда[4])',
      'Прошел курс первой помощи МЧС (#Медицина[3])',
      'Владеет радиостанцией дальнего действия (#Инженерия[2])',
      'Имеет черный пояс по дзюдо (#Защита[3])'
    ],
    small_inventory: [
      'Огнетушитель углекислотный (#Пожаротушение[4])',
      'Армейская тактическая аптечка (#Медицина[4])',
      'Сухой паек на 14 дней (#Еда[3])',
      'Мультитул и набор радиодеталей (#Инженерия[3])',
      'Шокер и перцовый баллон (#Защита[3])'
    ],
    large_inventory: [
      'Компактная гидропонная установка (#Еда[5], #Инженерия[2])',
      'Дизель-генератор 10 кВт с запасом топлива (#Инженерия[5])',
      'Хирургический набор и стерилизатор (#Медицина[5])',
      'Пожарная мотопомпа и рукав 50м (#Пожаротушение[6])',
      'Система видеонаблюдения и охранные турели (#Защита[5])'
    ],
    special_cards: [
      '«Огнезащита бункера»: Примените для предотвращения угрозы пожара. (#Пожаротушение[5])',
      '«Второе дыхание»: Отмените свое изгнание 1 раз.',
      '«Шпионаж»: Посмотрите все скрытые карты любого игрока.',
      '«Расширение убежища»: Вместимость бункера увеличивается на +1 место.',
      '«Перераспределение припасов»: Добавьте +4 к провизии. (#Еда[4])'
    ]
  },

  init() {
    this.bindEvents();
  },

  bindEvents() {
    // Autofill button
    const btnAutofill = document.getElementById('btn-ugc-autofill');
    if (btnAutofill) {
      btnAutofill.addEventListener('click', () => {
        this.autofillRandom();
        App.playSound('click');
        App.showToast('🎲 Поля заполнены сбалансированными вариантами с тегами выживания!');
      });
    }

    // Submit UGC
    const btnSubmit = document.getElementById('btn-ugc-submit');
    if (btnSubmit) {
      btnSubmit.addEventListener('click', async () => {
        const submissions = this.gatherSubmissions();
        try {
          await App.sendAction('submit_ugc', { submissions });
          this.hasSubmitted = true;
          const statusBadge = document.getElementById('ugc-status-badge');
          if (statusBadge) {
            statusBadge.textContent = '✅ Карты отправлены! Ожидание остальных...';
            statusBadge.style.background = 'var(--accent-green)';
          }
          App.playSound('start');
          App.showToast('✨ Ваши 45 карт успешно отправлены в банк бункера!');
        } catch (e) {
          App.showToast(`Ошибка: ${e.message}`);
        }
      });
    }

    // Master start UGC game button
    const btnStart = document.getElementById('btn-ugc-start-game');
    if (btnStart) {
      btnStart.addEventListener('click', async () => {
        const themeNameInput = document.getElementById('input-ugc-theme-name');
        const themeName = themeNameInput ? themeNameInput.value.trim() : null;
        await App.sendAction('start_ugc_game', {
          saveThemeName: themeName || null
        });
        App.playSound('start');
      });
    }
  },

  renderTagInsertBar() {
    const bar = document.getElementById('ugc-tag-helper-bar');
    if (!bar) return;

    if (!window.TagHelper || !TagHelper.PARAM_DEFINITIONS) return;

    bar.innerHTML = `
      <div style="font-size: 12px; color: var(--text-dim); margin-bottom: 6px;">
        💡 <strong>Быстрая вставка тегов параметров выживания</strong> (кликните в поле, затем нажмите нужный тег):
      </div>
      <div class="quick-tag-insert-bar" style="display: flex; flex-wrap: wrap; gap: 6px;">
        ${Object.entries(TagHelper.PARAM_DEFINITIONS).map(([key, def]) => `
          <button type="button" class="btn-tag-chip" data-tag="#${def.name}[3]" style="border-color: ${def.color}60; color: ${def.color}; background: ${def.bg}; font-size: 12px; padding: 3px 8px; border-radius: 6px; cursor: pointer;">
            + ${def.icon} #${def.name}[3]
          </button>
        `).join('')}
      </div>
    `;

    bar.querySelectorAll('.btn-tag-chip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tag = btn.getAttribute('data-tag');
        this.insertTagIntoActiveInput(tag);
      });
    });
  },

  insertTagIntoActiveInput(tag) {
    let input = this.lastFocusedInput;
    if (!input || !document.body.contains(input)) {
      // Find first empty or first input in container
      input = document.querySelector('.ugc-input');
    }
    if (!input) return;

    const val = input.value;
    if (val.trim()) {
      input.value = `${val.trim()} (${tag})`;
    } else {
      input.value = tag;
    }
    input.focus();
    App.showToast(`Вставлен тег ${tag}`);
  },

  render(state) {
    this.categories = state.categories || [];
    const container = document.getElementById('ugc-categories-container');
    if (!container) return;

    this.renderTagInsertBar();

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
              <input type="text" class="form-input ugc-input" data-cat="${cat.key}" data-index="${i - 1}" placeholder="Вариант ${i} (например: Название (#Параметр[3]))">
            `).join('')}
          </div>
        </div>
      `).join('');

      // Attach focus listeners to keep track of last focused input
      container.querySelectorAll('.ugc-input').forEach(inp => {
        inp.addEventListener('focus', () => {
          this.lastFocusedInput = inp;
        });
      });
    }

    // Master Panel display
    const masterPanel = document.getElementById('ugc-master-panel');
    if (masterPanel) {
      if (state.isHost) {
        masterPanel.classList.remove('hidden');
        const readyList = document.getElementById('ugc-players-ready-list');
        if (readyList) {
          readyList.innerHTML = state.players.map(p => `
            <div style="margin-bottom: 6px; font-size: 13px;">
              ${p.ugcReady ? '✅' : '⏳'} <strong>${p.name}</strong> — ${p.ugcReady ? '<span class="text-green">Заполнил карты</span>' : '<span class="text-dim">Пишет...</span>'}
            </div>
          `).join('');
        }
      } else {
        masterPanel.classList.add('hidden');
      }
    }
  },

  gatherSubmissions() {
    const submissions = {};
    const authorName = (window.App && window.App.playerName) ? window.App.playerName : 'Игрок';

    this.categories.forEach(cat => {
      submissions[cat.key] = [];
      const inputs = document.querySelectorAll(`.ugc-input[data-cat="${cat.key}"]`);
      inputs.forEach(input => {
        const val = input.value.trim() || 'Стандартная карта';
        submissions[cat.key].push({
          text: val,
          author: authorName
        });
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
