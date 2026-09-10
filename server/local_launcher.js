const { spawn, exec } = require('child_process');
const path = require('path');
const os = require('os');

const ROOT_DIR = path.join(__dirname, '..');
const SERVER_SCRIPT = path.join(ROOT_DIR, 'server', 'server.js');

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const name of Object.keys(interfaces)) {
    const isVirtual = /vethernet|virtual|vbox|vmware|wsl|loopback/i.test(name);
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (!isVirtual) {
          candidates.unshift(iface.address);
        } else {
          candidates.push(iface.address);
        }
      }
    }
  }

  const lanIp = candidates.find(ip => ip.startsWith('192.168.') || ip.startsWith('10.'));
  return lanIp || candidates[0] || 'localhost';
}

function openBrowser(url) {
  const start = (process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open');
  exec(`${start} ${url}`);
}

async function main() {
  console.clear();
  console.log('\x1b[36m%s\x1b[0m', '===============================================================');
  console.log('\x1b[33m%s\x1b[0m', '       🛡️ ЗАПУСК ИГРЫ «БУНКЕР» В ЛОКАЛЬНОЙ СЕТИ WI-FI...');
  console.log('\x1b[36m%s\x1b[0m', '===============================================================');

  // Start game server
  const serverProcess = spawn(process.execPath || 'node', [SERVER_SCRIPT], {
    cwd: ROOT_DIR,
    stdio: 'inherit'
  });

  serverProcess.on('error', err => {
    console.error('Ошибка запуска сервера:', err);
  });

  await new Promise(r => setTimeout(r, 600));

  const localIp = getLocalIp();
  const localLanUrl = `http://${localIp}:3000`;
  const localhostUrl = `http://localhost:3000`;

  // Write tunnel_info for client
  const fs = require('fs');
  fs.writeFileSync(path.join(__dirname, 'tunnel_info.json'), JSON.stringify({
    publicUrl: null,
    localIpUrl: localLanUrl,
    localhostUrl: localhostUrl,
    updatedAt: Date.now()
  }, null, 2));

  console.clear();
  console.log('\x1b[32m%s\x1b[0m', '===============================================================');
  console.log('\x1b[32m%s\x1b[0m', '       🛡️ ИГРА «БУНКЕР» УСПЕШНО ЗАПУЩЕНА В WI-FI СЕТИ! 🛡️');
  console.log('\x1b[32m%s\x1b[0m', '===============================================================');
  console.log('');
  console.log('\x1b[1m\x1b[33m%s\x1b[0m', '  📱 АДРЕС ДЛЯ ВХОДА С ТЕЛЕФОНОВ И ДРУГИХ УСТРОЙСТВ:');
  console.log('\x1b[1m\x1b[36m%s\x1b[0m', `     👉  ${localLanUrl}`);
  console.log('\x1b[37m%s\x1b[0m', '     (Введите эту строку в браузере телефона, подключенного к вашему Wi-Fi)');
  console.log('');
  console.log('\x1b[37m%s\x1b[0m', '  💻 ДЛЯ ВАС (на этом компьютере):');
  console.log('\x1b[36m%s\x1b[0m', `     👉  ${localhostUrl}`);
  console.log('');
  console.log('\x1b[35m%s\x1b[0m', '  💡 Совет: Если телефон не открывает страницу, запустите один раз');
  console.log('\x1b[35m%s\x1b[0m', '     файл «Разрешить_порт_в_брандмауэре.bat» от имени администратора.');
  console.log('\x1b[32m%s\x1b[0m', '===============================================================');
  console.log('  Не закрывайте это окно во время игры!');
  console.log('');

  openBrowser(localhostUrl);
}

main();
