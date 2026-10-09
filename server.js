const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;
const CONFIG_PATH = path.join(__dirname, 'data', 'config.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

// Helper: Calculate CPU percentage across cores
let prevCpus = os.cpus();
function getCpuUsage() {
  const currentCpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  for (let i = 0; i < currentCpus.length; i++) {
    const cpu = currentCpus[i];
    const prevCpu = prevCpus[i] || cpu;

    const idle = cpu.times.idle - prevCpu.times.idle;
    let total = 0;
    for (const type in cpu.times) {
      total += cpu.times[type] - prevCpu.times[type];
    }

    totalIdle += idle;
    totalTick += total;
  }

  prevCpus = currentCpus;
  const usage = totalTick === 0 ? 0 : Math.round((1 - totalIdle / totalTick) * 100);
  return Math.min(100, Math.max(0, usage));
}

// Helper: Read CPU Temperature (Raspberry Pi / Linux)
function getCpuTemperature() {
  return new Promise((resolve) => {
    // 1. Try Linux thermal zone file (Standard Pi/Debian location)
    const thermalPath = '/sys/class/thermal/thermal_zone0/temp';
    if (fs.existsSync(thermalPath)) {
      try {
        const rawTemp = fs.readFileSync(thermalPath, 'utf8');
        const temp = parseFloat(rawTemp) / 1000;
        if (!isNaN(temp) && temp > 0) {
          return resolve(Math.round(temp * 10) / 10);
        }
      } catch (err) {
        // Fallback to vcgencmd if file read fails
      }
    }

    // 2. Try Raspberry Pi official utility `vcgencmd measure_temp`
    exec('vcgencmd measure_temp', (error, stdout) => {
      if (!error && stdout) {
        // Format output: temp=42.5'C
        const match = stdout.match(/temp=([0-9.]+)/);
        if (match && match[1]) {
          return resolve(parseFloat(match[1]));
        }
      }

      // 3. Fallback for macOS/development environment or unsupported OS
      if (process.platform === 'darwin') {
        return resolve(42.5); // Mock realistic temperature for dev preview
      }

      resolve(null);
    });
  });
}

// Helper: Read Disk Usage (`df -h /`)
function getDiskUsage() {
  return new Promise((resolve) => {
    exec('df -h /', (error, stdout) => {
      if (error || !stdout) {
        return resolve({ total: 'N/A', used: 'N/A', free: 'N/A', percent: 0 });
      }

      try {
        const lines = stdout.trim().split('\n');
        if (lines.length >= 2) {
          // Standard Unix output format: Filesystem Size Used Avail Capacity Mounted
          const parts = lines[1].split(/\s+/);
          // Handles macOS df output vs Linux df output
          const sizeIndex = 1;
          const usedIndex = 2;
          const availIndex = 3;
          const capacityIndex = parts.findIndex(p => p.endsWith('%'));

          const total = parts[sizeIndex] || 'N/A';
          const used = parts[usedIndex] || 'N/A';
          const free = parts[availIndex] || 'N/A';
          const percentStr = capacityIndex !== -1 ? parts[capacityIndex].replace('%', '') : '0';

          return resolve({
            total,
            used,
            free,
            percent: parseInt(percentStr, 10) || 0
          });
        }
      } catch (e) {
        // Ignore parse error
      }
      resolve({ total: 'N/A', used: 'N/A', free: 'N/A', percent: 0 });
    });
  });
}

// Helper: Get primary local IPv4
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === 'IPv4' && !alias.internal && alias.address !== '127.0.0.1') {
        return alias.address;
      }
    }
  }
  return '127.0.0.1';
}

// Helper: Load persistent config
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Erreur lecture config:', err);
  }
  return { title: 'Mon Raspberry Pi Hub', services: [], notes: '' };
}

// Helper: Save persistent config
function saveConfig(data) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Erreur sauvegarde config:', err);
    return false;
  }
}

// --- API ENDPOINTS ---

// GET /api/stats - Real-time system monitoring metrics
app.get('/api/stats', async (req, res) => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memPercent = Math.round((usedMem / totalMem) * 100);

  const temp = await getCpuTemperature();
  const disk = await getDiskUsage();
  const cpuUsage = getCpuUsage();

  res.json({
    hostname: os.hostname(),
    platform: `${os.type()} ${os.arch()} (${os.release()})`,
    nodeVersion: process.version,
    ip: getLocalIp(),
    uptimeSeconds: Math.floor(os.uptime()),
    cpu: {
      usagePercent: cpuUsage,
      tempC: temp,
      cores: os.cpus().length,
      model: os.cpus()[0] ? os.cpus()[0].model : 'ARM Processor',
      loadAvg: os.loadavg().map(l => Math.round(l * 100) / 100)
    },
    memory: {
      totalBytes: totalMem,
      usedBytes: usedMem,
      freeBytes: freeMem,
      usedMb: Math.round(usedMem / (1024 * 1024)),
      totalMb: Math.round(totalMem / (1024 * 1024)),
      percent: memPercent
    },
    disk
  });
});

// GET /api/config - Retrieve saved shortcuts and notes
app.get('/api/config', (req, res) => {
  res.json(loadConfig());
});

// POST /api/config - Save updated shortcuts or notes
app.post('/api/config', (req, res) => {
  const { title, services, notes } = req.body;
  const currentConfig = loadConfig();

  const newConfig = {
    title: title !== undefined ? title : currentConfig.title,
    services: Array.isArray(services) ? services : currentConfig.services,
    notes: notes !== undefined ? notes : currentConfig.notes
  };

  if (saveConfig(newConfig)) {
    res.json({ success: true, config: newConfig });
  } else {
    res.status(500).json({ error: 'Impossible d’enregistrer la configuration' });
  }
});

// Start Express server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`🚀 PiDash - Serveur Raspberry Pi actif !`);
  console.log(`📡 URL Locale  : http://localhost:${PORT}`);
  console.log(`🌐 URL Réseau  : http://${getLocalIp()}:${PORT}`);
  console.log(`====================================================`);
});
