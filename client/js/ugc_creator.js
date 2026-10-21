// --- UGC CARD CREATOR (MODE 2: С НУЛЯ) ---
const UgcCreator = {
  categories: [],
  hasSubmitted: false,
  lastFocusedInput: null,

  categoryExamples: {
    profession: 'Военный хирург (#Медицина[5], #Психика[2])',
    health: 'Иммунитет к инфекциям (#Медицина[4])',
    biology: 'Мужчина, 32 года, атлет (#Защита[2])',
    hobby: 'Кулинария и консервация (#Еда[4])',
    traits: 'Хладнокровие в стрессе (#Психика[4])',
    facts: 'Знает схему пожарных гидрантов бункера (#Пожаротушение[3])',
    small_inventory: 'Огнетушитель углекислотный (#Пожаротушение[4])',
    large_inventory: 'Компактная гидропонная ферма (#Еда[5], #Инженерия[2])',
    special_cards: '«Огнезащита бункера»: защита от угрозы пожара (#Пожаротушение[5])'
  },

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
          this.showSubmittedView(true);
          App.playSound('start');
          App.showToast('✨ Ваши 45 карт успешно отправлены в банк бункера!');
        } catch (e) {
          App.showToast(`Ошибка: ${e.message}`);
        }
      });
    }

    // Edit again button
    const btnEditAgain = document.getElementById('btn-ugc-edit-again');
    if (btnEditAgain) {
      btnEditAgain.addEventListener('click', () => {
        this.hasSubmitted = false;
        this.showSubmittedView(false);
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

  showSubmittedView(isSubmitted) {
    const formWrap = document.getElementById('ugc-creator-form-wrap');
    const submittedBox = document.getElementById('ugc-submitted-box');
    if (!formWrap || !submittedBox) return;

    if (isSubmitted) {
      formWrap.classList.add('hidden');
      submittedBox.classList.remove('hidden');
    } else {
      formWrap.classList.remove('hidden');
      submittedBox.classList.add('hidden');
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

    // Check if current user is marked as ready or already submitted
    const myPlayer = (state.players || []).find(p => p.id === state.myId);
    const isSelfReady = myPlayer ? Boolean(myPlayer.ugcReady) : false;

    if (isSelfReady || this.hasSubmitted) {
      this.showSubmittedView(true);
    }

    // Build form if empty
    if (container.children.length === 0) {
      container.innerHTML = this.categories.map(cat => {
        const example = this.categoryExamples[cat.key] || `${cat.name} (#Параметр[3])`;
        return `
          <div class="ugc-category-box">
            <div class="ugc-category-title">
              <span>${cat.icon}</span>
              <span>${cat.name} (5 вариантов)</span>
            </div>
            <div class="ugc-category-hint">
              💡 Формат: Название (#Параметр[сила]) &nbsp;•&nbsp; <em>Пример: ${example}</em>
            </div>
            <div class="ugc-inputs-grid">
              ${[1, 2, 3, 4, 5].map(i => `
                <input type="text" class="form-input ugc-input" data-cat="${cat.key}" data-index="${i - 1}" placeholder="Вариант ${i}">
              `).join('')}
            </div>
          </div>
        `;
      }).join('');

      // Attach focus listeners to keep track of last focused input
      container.querySelectorAll('.ugc-input').forEach(inp => {
        inp.addEventListener('focus', () => {
          this.lastFocusedInput = inp;
        });
      });
    }

    // Render readiness list in #ugc-submitted-players-list
    const submittedList = document.getElementById('ugc-submitted-players-list');
    if (submittedList && state.players) {
      submittedList.innerHTML = state.players.map(p => `
        <div class="ugc-ready-row" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; margin-bottom: 6px; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>${p.isHost ? '👑' : '👤'}</span>
            <strong>${p.name}</strong>
            ${p.id === state.myId ? '<span class="role-badge" style="font-size: 10px;">(Вы)</span>' : ''}
          </div>
          <div>
            ${p.ugcReady
              ? '<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: var(--accent-green); border: 1px solid var(--accent-green);">✅ Готов (карты в банке)</span>'
              : '<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: var(--accent-amber); border: 1px solid var(--accent-amber);">⏳ Пишет карты...</span>'}
          </div>
        </div>
      `).join('');
    }

    // Toggle Host controls vs Player waiting notice in submitted panel
    const masterActions = document.getElementById('ugc-submitted-master-actions');
    const waitingNotice = document.getElementById('ugc-submitted-player-waiting');
    if (masterActions && waitingNotice) {
      if (state.isHost) {
        masterActions.classList.remove('hidden');
        waitingNotice.classList.add('hidden');
      } else {
        masterActions.classList.add('hidden');
        waitingNotice.classList.remove('hidden');
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
