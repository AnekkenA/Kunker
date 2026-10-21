const { exec, spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const readline = require('readline');

let cfProcess = null;

function getNetworkDetails() {
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
    localIp: localIp || '192.168.22.56',
    radminIp: radminIp || '26.191.152.48'
  };
}

function openBrowser(url) {
  try {
    exec(`start "" "${url}"`, { shell: 'cmd.exe' });
  } catch (e) {
    console.error('Ошибка открытия браузера:', e.message);
  }
}

function startHttpServer() {
  // Start server directly in the same runtime
  require('./server.js');
}

function cleanupProcesses() {
  if (cfProcess) {
    try {
      cfProcess.kill();
    } catch (e) {}
    cfProcess = null;
  }
}

process.on('exit', cleanupProcesses);
process.on('SIGINT', () => {
  cleanupProcesses();
  process.exit();
});
process.on('SIGTERM', () => {
  cleanupProcesses();
  process.exit();
});

// --- MODE 1: INTERNET & PHONES (CLOUDFLARE TUNNEL - WORKS EVERYWHERE) ---
function startInternetMode() {
  const net = getNetworkDetails();
  const localhostUrl = 'http://localhost:3000';
  const wifiUrl = `http://${net.localIp}:3000`;
  const radminUrl = `http://${net.radminIp}:3000`;

  // Write initial tunnel_info
  fs.writeFileSync(path.join(__dirname, 'tunnel_info.json'), JSON.stringify({
    primaryUrl: wifiUrl,
    localIpUrl: wifiUrl,
    radminIpUrl: radminUrl,
    localhostUrl,
    mode: 'internet',
    updatedAt: Date.now()
  }, null, 2));

  startHttpServer();

  console.clear();
  console.log('===============================================================');
  console.log('     ИГРА «БУНКЕР» ЗАПУСКАЕТСЯ В ИНТЕРНЕТЕ (CLOUDFLARE)...');
  console.log('===============================================================');
  console.log('');
  console.log('  [i] Создание безопасного интернет-соединения...');
  console.log('      (Обычно занимает 2-4 секунды, ожидайте)...');
  console.log('');

  const cloudflaredBin = path.join(__dirname, '..', 'bin', 'cloudflared.exe');
  if (!fs.existsSync(cloudflaredBin)) {
    console.log('[!] Файл bin/cloudflared.exe не найден. Запуск в режиме Wi-Fi.');
    startWifiMode();
    return;
  }

  cfProcess = spawn(cloudflaredBin, ['tunnel', '--protocol', 'http2', '--url', 'http://127.0.0.1:3000']);
  let tunnelEstablished = false;

  function onOutput(data) {
    const text = data.toString();
    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (match && !tunnelEstablished) {
      tunnelEstablished = true;
      const publicUrl = match[0];

      fs.writeFileSync(path.join(__dirname, 'tunnel_info.json'), JSON.stringify({
        publicUrl,
        primaryUrl: publicUrl,
        localIpUrl: wifiUrl,
        radminIpUrl: radminUrl,
        localhostUrl,
        mode: 'internet',
        updatedAt: Date.now()
      }, null, 2));

      console.clear();
      console.log('===============================================================');
      console.log('         ИГРА «БУНКЕР» УСПЕШНО ЗАПУЩЕНА В ИНТЕРНЕТЕ!');
      console.log('===============================================================');
      console.log('');
      console.log('  ССЫЛКА ДЛЯ ТЕЛЕФОНОВ И ДРУГИХ ИГРОКОВ:');
      console.log('');
      console.log(`     >>  ${publicUrl}  <<`);
      console.log('');
      console.log('     * Работает с ЛЮБОГО смартфона через мобильный интернет (4G/LTE)');
      console.log('     * Работает через любой домашний или мобильный Wi-Fi');
      console.log('     * Работает для друзей на ПК из любых городов');
      console.log('     * В лобби на компьютере можно показать QR-код этой ссылки!');
      console.log('');
      console.log('  ДЛЯ ВАС (Мастер игры на этом ПК):');
      console.log(`     >>  ${localhostUrl}  <<`);
      console.log('');
      console.log('===============================================================');
      console.log('  Не закрывайте это окно консоли во время игры.');
      console.log('');

      setTimeout(() => {
        openBrowser(localhostUrl);
      }, 400);
    }
  }

  cfProcess.stdout.on('data', onOutput);
  cfProcess.stderr.on('data', onOutput);

  cfProcess.on('error', (err) => {
    console.error('[!] Ошибка запуска cloudflared:', err.message);
    if (!tunnelEstablished) {
      console.log('    Резервный адрес для Wi-Fi: ' + wifiUrl);
      openBrowser(localhostUrl);
    }
  });

  // Timeout fallback if internet is unreachable
  setTimeout(() => {
    if (!tunnelEstablished) {
      console.log('[!] Не удалось связаться с Cloudflare за 12 секунд (нет интернета?).');
      console.log('    Запущен локальный сервер Wi-Fi: ' + wifiUrl);
      openBrowser(localhostUrl);
    }
  }, 12000);
}

// --- MODE 2: LOCAL WI-FI / HOTSPOT (OFFLINE) ---
function startWifiMode() {
  const net = getNetworkDetails();
  const wifiUrl = `http://${net.localIp}:3000`;
  const radminUrl = `http://${net.radminIp}:3000`;
  const localhostUrl = `http://localhost:3000`;

  fs.writeFileSync(path.join(__dirname, 'tunnel_info.json'), JSON.stringify({
    primaryUrl: wifiUrl,
    localIpUrl: wifiUrl,
    radminIpUrl: radminUrl,
    localhostUrl,
    mode: 'wifi',
    updatedAt: Date.now()
  }, null, 2));

  startHttpServer();

  console.clear();
  console.log('===============================================================');
  console.log('       ИГРА «БУНКЕР» ЗАПУЩЕНА (РЕЖИМ WI-FI / ТОЧКА ДОСТУПА)');
  console.log('===============================================================');
  console.log('');
  console.log('  АДРЕС ДЛЯ ТЕЛЕФОНОВ И ДРУГИХ ПК В ВАШЕМ WI-FI:');
  console.log('');
  console.log(`     >>  ${wifiUrl}  <<`);
  console.log('');
  console.log('     (Игроки открывают эту строку в браузере или сканируют QR-код)');
  console.log('');
  console.log('  ДЛЯ ВАС (на этом компьютере):');
  console.log(`     >>  ${localhostUrl}  <<`);
  console.log('');
  console.log('  Если телефоны не могут подключиться, выберите пункт [4]');
  console.log('  в меню для открытия порта в Брандмауэре Windows.');
  console.log('===============================================================');
  console.log('  Не закрывайте это окно консоли во время игры.');
  console.log('');

  setTimeout(() => {
    openBrowser(localhostUrl);
  }, 400);
}

// --- MODE 3: RADMIN VPN ---
function startRadminMode() {
  const net = getNetworkDetails();
  const wifiUrl = `http://${net.localIp}:3000`;
  const radminUrl = `http://${net.radminIp}:3000`;
  const localhostUrl = `http://localhost:3000`;

  fs.writeFileSync(path.join(__dirname, 'tunnel_info.json'), JSON.stringify({
    primaryUrl: radminUrl,
    localIpUrl: wifiUrl,
    radminIpUrl: radminUrl,
    localhostUrl,
    mode: 'radmin',
    updatedAt: Date.now()
  }, null, 2));

  startHttpServer();

  console.clear();
  console.log('===============================================================');
  console.log('       ИГРА «БУНКЕР» ЗАПУЩЕНА ЧЕРЕЗ RADMIN VPN');
  console.log('===============================================================');
  console.log('');
  console.log('  АДРЕС ДЛЯ ДРУЗЕЙ В ВАШЕЙ СЕТИ RADMIN VPN:');
  console.log('');
  console.log(`     >>  ${radminUrl}  <<`);
  console.log('');
  console.log('     (Друзья на своих ПК вставляют эту строку в любой браузер)');
  console.log('');
  console.log('  ДЛЯ ВАС (на этом компьютере):');
  console.log(`     >>  ${localhostUrl}  <<`);
  console.log('');
  console.log('===============================================================');
  console.log('  Не закрывайте это окно консоли во время игры.');
  console.log('');

  setTimeout(() => {
    openBrowser(localhostUrl);
  }, 400);
}

// --- MODE 4: FIREWALL PORT UNLOCK ---
function openFirewallPort() {
  console.clear();
  console.log('===============================================================');
  console.log('   РАЗРЕШЕНИЕ ПОРТА 3000 В БРАНДМАУЭРЕ WINDOWS');
  console.log('===============================================================');
  console.log('');
  console.log('[i] Запрос прав администратора для добавления правила...');

  exec('powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd -ArgumentList \'/c netsh advfirewall firewall delete rule name=\"\"Bunker Game Server (Port 3000)\"\" & netsh advfirewall firewall add rule name=\"\"Bunker Game Server (Port 3000)\"\" dir=in action=allow protocol=TCP localport=3000 profile=any\' -Verb RunAs"', (err) => {
    if (err) {
      console.log('[!] Ошибка или отмена запроса прав администратора.');
    } else {
      console.log('[УСПЕХ] Порт 3000 успешно открыт в Брандмауэре Windows.');
    }
    console.log('');
    console.log('Возврат в меню через 3 секунды...');
    setTimeout(askMenu, 3000);
  });
}

function askMenu() {
  console.clear();
  const net = getNetworkDetails();

  console.log('===============================================================');
  console.log('            ИГРА «БУНКЕР: УБЕЖИЩЕ-101»');
  console.log('===============================================================');
  console.log('');
  console.log('  Выберите способ подключения:');
  console.log('');
  console.log('   [1] ИНТЕРНЕТ И ТЕЛЕФОНЫ (Рекомендуется - работает ВСЕГДА)');
  console.log('       Для любых смартфонов (через мобильный 4G или Wi-Fi)');
  console.log('       и друзей из других городов (без белого IP и без роутера)');
  console.log('');
  console.log('   [2] ТОЛЬКО ЛОКАЛЬНАЯ СЕТЬ (Офлайн Wi-Fi / Точка доступа)');
  console.log(`       Без интернета, только устройства в одной подсети (${net.localIp})`);
  console.log('');
  console.log('   [3] RADMIN VPN');
  console.log(`       Для ПК через комнату Radmin VPN (${net.radminIp})`);
  console.log('');
  console.log('   [4] Открыть порт 3000 в Брандмауэре Windows');
  console.log('');
  console.log('===============================================================');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Введите номер (1, 2, 3 или 4) [по умолчанию 1]: ', (ans) => {
    rl.close();
    const choice = ans.trim();
    if (choice === '1' || choice === '') {
      startInternetMode();
    } else if (choice === '2') {
      startWifiMode();
    } else if (choice === '3') {
      startRadminMode();
    } else if (choice === '4') {
      openFirewallPort();
    } else {
      askMenu();
    }
  });
}

const arg = process.argv[2];
if (arg === '--internet') {
  startInternetMode();
} else if (arg === '--wifi') {
  startWifiMode();
} else if (arg === '--radmin') {
  startRadminMode();
} else if (arg === '--firewall') {
  openFirewallPort();
} else {
  askMenu();
}
