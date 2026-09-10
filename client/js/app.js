// --- GLOBAL APP STATE & NETWORKING (SINGLE SESSION ENGINE) ---
const App = {
  playerName: sessionStorage.getItem('bunker_player_name') || '',
  playerId: sessionStorage.getItem('bunker_player_id') || '',
  isHost: false,
  soundEnabled: true,
  state: null,
  eventSource: null,
  audioCtx: null,

  async init() {
    this.initAudio();
    this.bindGlobalEvents();

    if (this.playerName) {
      document.getElementById('input-player-name').value = this.playerName;
    }

    // If session has player ID, try restoring state
    if (this.playerId) {
      try {
        const res = await fetch(`/api/state?playerId=${encodeURIComponent(this.playerId)}`);
        if (res.ok) {
          const state = await res.json();
          if (state && state.myId) {
            this.connectEvents();
            this.onStateUpdate(state);
            return;
          }
        }
      } catch (e) {}
    }
  },

  initAudio() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    } catch (e) {}
  },

  playSound(type) {
    if (!this.soundEnabled || !this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const ctx = this.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'flip') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'click') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'exile') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.setValueAtTime(150, now + 0.15);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'start') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(554, now + 0.1);
      osc.frequency.setValueAtTime(659, now + 0.2);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    }
  },

  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');
  },

  showToast(message, duration = 3000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  bindGlobalEvents() {
    // Sound toggle
    const btnSound = document.getElementById('btn-sound-toggle');
    btnSound.addEventListener('click', () => {
      this.soundEnabled = !this.soundEnabled;
      btnSound.textContent = this.soundEnabled ? '🔊' : '🔇';
    });

    // Enter / Join Game
    document.getElementById('btn-join-game').addEventListener('click', async () => {
      const name = document.getElementById('input-player-name').value.trim();
      const password = document.getElementById('input-player-password').value.trim();

      if (!name) {
        this.showToast('⚠️ Пожалуйста, введите ваше имя (никнейм)!');
        return;
      }

      this.playerName = name;
      sessionStorage.setItem('bunker_player_name', name);

      try {
        const res = await fetch('/api/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Ошибка входа');

        this.playerId = data.playerId;
        this.isHost = data.isHost;
        sessionStorage.setItem('bunker_player_id', data.playerId);

        this.connectEvents();
        this.onStateUpdate(data.state);
        this.showToast(data.isHost ? '👑 Вы вошли как Мастер игры!' : '🚪 Вы вошли в бункер!');
        this.playSound('start');
      } catch (err) {
        this.showToast(`❌ ${err.message}`);
      }
    });

    // Invite Modal Open
    const handleOpenInvite = () => {
      this.openInviteModal();
      this.playSound('click');
    };

    document.getElementById('btn-invite').addEventListener('click', handleOpenInvite);
    document.getElementById('btn-lobby-invite').addEventListener('click', handleOpenInvite);

    // Close modal
    document.getElementById('btn-close-invite-modal').addEventListener('click', () => {
      document.getElementById('invite-modal').classList.add('hidden');
      this.playSound('click');
    });

    document.getElementById('invite-modal').addEventListener('click', (e) => {
      if (e.target.id === 'invite-modal') {
        document.getElementById('invite-modal').classList.add('hidden');
      }
    });

    // Logs Drawer
    const logsDrawer = document.getElementById('logs-drawer');
    document.getElementById('btn-toggle-logs').addEventListener('click', () => {
      logsDrawer.classList.toggle('open');
      this.playSound('click');
    });
    document.getElementById('btn-close-logs').addEventListener('click', () => {
      logsDrawer.classList.remove('open');
      this.playSound('click');
    });
  },

  connectEvents() {
    if (this.eventSource) {
      this.eventSource.close();
    }

    const sseUrl = `/api/events?playerId=${encodeURIComponent(this.playerId)}`;
    this.eventSource = new EventSource(sseUrl);

    this.eventSource.onmessage = (event) => {
      try {
        const state = JSON.parse(event.data);
        this.onStateUpdate(state);
      } catch (e) {
        console.error('Ошибка SSE:', e);
      }
    };

    this.eventSource.onerror = () => {
      console.warn('SSE переподключение...');
    };
  },

  onStateUpdate(state) {
    const prevState = this.state;
    this.state = state;
    this.isHost = state.isHost;

    // Header updates
    document.getElementById('btn-invite').classList.remove('hidden');
    document.getElementById('user-profile').classList.remove('hidden');
    document.getElementById('user-display-name').textContent = this.playerName;

    const roleBadge = document.getElementById('user-role-badge');
    if (state.isHost) {
      roleBadge.textContent = '👑 Мастер';
      roleBadge.classList.add('master');
    } else {
      roleBadge.textContent = 'Игрок';
      roleBadge.classList.remove('master');
    }

    // Status transition sound
    if (prevState && prevState.status !== state.status) {
      if (state.status === 'playing') this.playSound('start');
    }

    // Route screen
    if (state.status === 'lobby') {
      this.showScreen('screen-lobby');
      Lobby.render(state);
      document.getElementById('results-modal').classList.add('hidden');
    } else if (state.status === 'ugc_building') {
      this.showScreen('screen-ugc');
      UgcCreator.render(state);
      document.getElementById('results-modal').classList.add('hidden');
    } else if (state.status === 'playing') {
      this.showScreen('screen-game');
      GameBoard.render(state);
      document.getElementById('results-modal').classList.add('hidden');
    } else if (state.status === 'finished') {
      this.showScreen('screen-game');
      GameBoard.render(state);
      if (state.results) {
        GameBoard.showResultsModal(state.results);
      }
    }

    // Activity logs
    if (state.logs) {
      const logsList = document.getElementById('logs-list');
      logsList.innerHTML = state.logs.map(log => `
        <div class="log-entry">
          <span class="log-time">[${log.time}]</span>
          <span class="log-text">${log.text}</span>
        </div>
      `).join('');
    }
  },

  async openInviteModal() {
    const modal = document.getElementById('invite-modal');
    modal.classList.remove('hidden');

    let net = (this.state && this.state.network) || {};
    try {
      const res = await fetch('/api/network');
      if (res.ok) net = await res.json();
    } catch (e) {}

    const radminLink = net.radminIpUrl || '';
    const localLink = (window.location.origin.startsWith('http') ? window.location.origin : (net.localIpUrl || 'http://localhost:3000'));

    const radInput = document.getElementById('input-radmin-link');
    const locInput = document.getElementById('input-local-link');
    const radGroup = document.getElementById('group-radmin-link');

    if (locInput) locInput.value = localLink;
    if (radInput) radInput.value = radminLink;

    if (radGroup) {
      if (radminLink) {
        radGroup.classList.remove('hidden');
      } else {
        radGroup.classList.add('hidden');
      }
    }

    // Use active URL for QR Code
    const qrLink = localLink.trim();
    const qrContainer = document.getElementById('invite-qrcode');
    if (window.QRCode && qrContainer && qrLink) {
      qrContainer.innerHTML = '';
      new QRCode(qrContainer, {
        text: qrLink,
        width: 180,
        height: 180,
        correctLevel: QRCode.CorrectLevel.M
      });
    }
  },

  copyInputLink(inputId) {
    const input = document.getElementById(inputId);
    if (!input || !input.value) return;

    navigator.clipboard.writeText(input.value).then(() => {
      this.showToast('📋 Ссылка скопирована!');
      this.playSound('click');
    }).catch(() => {
      input.select();
      document.execCommand('copy');
      this.showToast('📋 Ссылка скопирована!');
    });
  },

  async sendAction(action, payload = {}) {
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          playerId: this.playerId,
          payload
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка действия');
      return data;
    } catch (err) {
      this.showToast(`⚠️ ${err.message}`);
      throw err;
    }
  }
};

window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
