const { spawn, exec } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

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
  console.log('===============================================================');
  console.log('      ЗАПУСК ИГРЫ «БУНКЕР» В ИНТЕРНЕТ-РЕЖИМЕ...');
  console.log('===============================================================');
  console.log('');

  // 1. Start server
  console.log(' [1/3] Запуск локального игрового сервера...');
  const serverProcess = spawn(process.execPath || 'node', [SERVER_SCRIPT], {
    cwd: ROOT_DIR,
    stdio: 'inherit'
  });

  serverProcess.on('error', err => {
    console.error('Ошибка запуска сервера:', err);
  });

  await new Promise(r => setTimeout(r, 600));

  // 2. Start SSH Tunnel
  console.log(' [2/3] Подключение защищенного интернет-туннеля (ожидание ссылки)...');

  let publicUrl = null;

  const localIp = getLocalIp();
  const localLanUrl = `http://${localIp}:3000`;
  const localhostUrl = `http://localhost:3000`;

  // Start SSH tunnel
  const sshProcess = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ServerAliveInterval=30',
    '-R', '80:127.0.0.1:3000',
    'nokey@localhost.run'
  ]);

  const cleanup = () => {
    try { serverProcess.kill(); } catch (e) {}
    try { sshProcess.kill(); } catch (e) {}
  };
  process.on('SIGINT', () => { cleanup(); process.exit(0); });
  process.on('exit', cleanup);

  const tunnelPromise = new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(null);
    }, 15000);

    const onData = (data) => {
      const text = data.toString();
      const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.lhr\.life/);
      if (match) {
        clearTimeout(timeout);
        resolve(match[0]);
      }
    };

    sshProcess.stdout.on('data', onData);
    sshProcess.stderr.on('data', onData);

    sshProcess.on('error', (err) => {
      console.warn('SSH error:', err.message);
      resolve(null);
    });
  });

  publicUrl = await tunnelPromise;

  // Save tunnel info
  fs.writeFileSync(path.join(__dirname, 'tunnel_info.json'), JSON.stringify({
    publicUrl: publicUrl || null,
    localIpUrl: localLanUrl,
    localhostUrl,
    updatedAt: Date.now()
  }, null, 2));

  // Print Banner
  console.clear();
  console.log('===============================================================');
  console.log('       ИГРА «БУНКЕР» УСПЕШНО ЗАПУЩЕНА ДЛЯ ИНТЕРНЕТА!');
  console.log('===============================================================');
  console.log('');

  if (publicUrl) {
    console.log('  ССЫЛКА ДЛЯ ДРУЗЕЙ В ДРУГИХ ГОРОДАХ (через интернет):');
    console.log(`     >>  ${publicUrl}  <<`);
    console.log('     (Отправьте эту ссылку друзьям в Telegram / WhatsApp / Discord)');
    console.log('');
  } else {
    console.log('  [!] Не удалось получить интернет-ссылку автоматически.');
    console.log('      Используйте локальную ссылку в одной Wi-Fi сети.');
    console.log('');
  }

  console.log('  ЛОКАЛЬНАЯ ССЫЛКА (для домашнего Wi-Fi):');
  console.log(`     >>  ${localLanUrl}  <<`);
  console.log('');

  console.log('  ДЛЯ ВАС (на этом компьютере):');
  console.log(`     >>  ${localhostUrl}  <<`);
  console.log('');

  console.log('  Защита: Вы можете задать пароль при создании комнаты.');
  console.log('===============================================================');
  console.log('  Не закрывайте это окно консоли во время игры!');
  console.log('');

  // Open browser
  console.log(' [3/3] Открытие игры в вашем браузере...');
  openBrowser(localhostUrl);
}

main();
