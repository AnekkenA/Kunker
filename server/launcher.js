const { exec } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const readline = require('readline');

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
  console.log('  Если телефоны не могут подключиться, выберите пункт [3]');
  console.log('  в меню для открытия порта в Брандмауэре Windows.');
  console.log('===============================================================');
  console.log('  Не закрывайте это окно консоли во время игры.');
  console.log('');

  setTimeout(() => {
    openBrowser(localhostUrl);
  }, 400);
}

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
  console.log('  Выберите способ подключения игроков:');
  console.log('');
  console.log('   [1] ОБЩИЙ WI-FI / ТОЧКА ДОСТУПА С ТЕЛЕФОНА');
  console.log(`       Для смартфонов и ПК в одной сети (${net.localIp})`);
  console.log('');
  console.log('   [2] RADMIN VPN');
  console.log(`       Для друзей на ПК из других городов (${net.radminIp})`);
  console.log('');
  console.log('   [3] Открыть порт 3000 в Брандмауэре Windows');
  console.log('       (Разрешить входящие подключения в системе)');
  console.log('');
  console.log('===============================================================');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Введите номер (1, 2 или 3) [по умолчанию 1]: ', (ans) => {
    rl.close();
    const choice = ans.trim();
    if (choice === '1' || choice === '') {
      startWifiMode();
    } else if (choice === '2') {
      startRadminMode();
    } else if (choice === '3') {
      openFirewallPort();
    } else {
      askMenu();
    }
  });
}

const arg = process.argv[2];
if (arg === '--wifi') {
  startWifiMode();
} else if (arg === '--radmin') {
  startRadminMode();
} else if (arg === '--firewall') {
  openFirewallPort();
} else {
  askMenu();
}
