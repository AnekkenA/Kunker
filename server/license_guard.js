const os = require('os');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Path to internal verification file in workspace root
const LICENSE_FILE = path.join(__dirname, '..', '.sys_license.dat');

// Normalized target charcodes for verification:
// "спасибомаксиму" -> [1089, 1087, 1072, 1089, 1080, 1073, 1086, 1084, 1072, 1082, 1089, 1080, 1084, 1091]
const _VERIFY_CODES = [1089, 1087, 1072, 1089, 1080, 1073, 1086, 1084, 1072, 1082, 1089, 1080, 1084, 1091];

class LicenseGuard {
  constructor() {
    this.locked = false;
    this.lockReason = '';
    this.currentMachineUser = this.detectSystemUsername();
    this.graceTimer = null;
    this.onStatusChange = null;
    this.rl = null;
  }

  detectSystemUsername() {
    try {
      const user = os.userInfo().username;
      if (user) return String(user).trim().toLowerCase();
    } catch (e) {}
    const envUser = process.env.USERNAME || process.env.USER || 'lma';
    return String(envUser).trim().toLowerCase();
  }

  encodeUser(user) {
    return Buffer.from(`auth_${user}_bunker3`).toString('base64');
  }

  decodeUser(hash) {
    try {
      const raw = Buffer.from(hash, 'base64').toString('utf8');
      const match = raw.match(/^auth_(.+)_bunker3$/);
      return match ? match[1].toLowerCase() : null;
    } catch (e) {
      return null;
    }
  }

  readStoredUser() {
    try {
      if (fs.existsSync(LICENSE_FILE)) {
        const content = fs.readFileSync(LICENSE_FILE, 'utf8').trim();
        const json = JSON.parse(content);
        if (json && json.token && typeof json.token === 'string' && json.token.trim() !== '') {
          return this.decodeUser(json.token);
        }
      }
    } catch (e) {}
    return null;
  }

  writeStoredUser(user) {
    try {
      const data = {
        token: this.encodeUser(user),
        activated_at: new Date().toISOString(),
        node: process.version,
        platform: os.platform()
      };
      fs.writeFileSync(LICENSE_FILE, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (e) {
      console.error('[LICENSE] Ошибка записи файла авторизации:', e.message);
      return false;
    }
  }

  verifyInput(input) {
    if (!input || typeof input !== 'string') return false;

    // Exact charcode sequence for "Спасибо Максиму!"
    // [1057, 1087, 1072, 1089, 1080, 1073, 1086, 32, 1052, 1072, 1082, 1089, 1080, 1084, 1091, 33]
    const exactCodes = Array.from(input.trim()).map(c => c.charCodeAt(0));
    const targetExact = [1057, 1087, 1072, 1089, 1080, 1073, 1086, 32, 1052, 1072, 1082, 1089, 1080, 1084, 1091, 33];
    if (exactCodes.length === targetExact.length && exactCodes.every((v, i) => v === targetExact[i])) {
      return true;
    }

    // Also support normalized version (without punctuation, extra spaces or lowercase)
    const clean = input.toLowerCase().replace(/[^а-яa-z0-9]/gi, '');
    const codes = Array.from(clean).map(c => c.charCodeAt(0));
    return codes.length === _VERIFY_CODES.length && codes.every((v, i) => v === _VERIFY_CODES[i]);
  }

  init(onStatusChangeCallback) {
    this.onStatusChange = onStatusChangeCallback;

    // Check if current user is authorized
    const storedUser = this.readStoredUser();

    if (!storedUser) {
      // First run on author machine: initialize with current user
      this.writeStoredUser(this.currentMachineUser);
      console.log(`[СИСТЕМА] Авторизация подтверждена для рабочей станции (${this.currentMachineUser}).`);
      return;
    }

    if (storedUser === this.currentMachineUser) {
      console.log(`[СИСТЕМА] Проверка рабочей станции пройдена (${this.currentMachineUser}).`);
      return;
    }

    // Machine mismatch! Another user copied the project!
    console.warn(`[ВНИМАНИЕ] Обнаружено несовпадение рабочей станции (текущая: ${this.currentMachineUser}, лицензия: ${storedUser}).`);
    
    // Start grace interval before locking (50 seconds)
    this.graceTimer = setTimeout(() => {
      this.triggerLock();
    }, 50000);

    this.setupConsoleListener();
  }

  triggerLock() {
    this.locked = true;
    this.lockReason = `Копия игры требует подтверждения авторизации на сервере для учетной записи (${this.currentMachineUser}).`;

    console.log('\n======================================================');
    console.log(' [СИСТЕМА ЗАЩИТЫ] ВНИМАНИЕ: СЕАНС ПРИОСТАНОВЛЕН!');
    console.log(` Игра запущена на новой учетной записи: "${this.currentMachineUser}".`);
    console.log(' Для разблокировки и привязки рабочей станции введите ключ в консоль:');
    console.log('======================================================\n');

    if (this.onStatusChange) {
      this.onStatusChange(true);
    }

    this.setupConsoleListener();
  }

  setupConsoleListener() {
    if (this.rl) return;

    try {
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
      });

      this.rl.on('line', (line) => {
        const trimmed = line.trim();
        if (this.verifyInput(trimmed)) {
          this.unlockForCurrentUser();
        } else if (this.locked) {
          console.log('[СИСТЕМА] Неверный ключ. Попробуйте еще раз:');
        }
      });
    } catch (e) {
      console.warn('[LICENSE] Не удалось подключить чтение консоли:', e.message);
    }
  }

  unlockForCurrentUser() {
    this.locked = false;
    this.lockReason = '';
    if (this.graceTimer) clearTimeout(this.graceTimer);

    this.writeStoredUser(this.currentMachineUser);

    console.log('\n======================================================');
    console.log(` [СИСТЕМА ЗАЩИТЫ] КЛЮЧ ПРИНЯТ!`);
    console.log(` Учетная запись "${this.currentMachineUser}" успешно авторизована.`);
    console.log(' Работа сервера полностью возобновлена.');
    console.log('======================================================\n');

    if (this.onStatusChange) {
      this.onStatusChange(false);
    }
  }

  isLocked() {
    return this.locked;
  }

  getLockReason() {
    return this.lockReason;
  }
}

module.exports = new LicenseGuard();
