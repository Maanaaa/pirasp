// PiDash Frontend Application Logic
document.addEventListener('DOMContentLoaded', () => {

  // --- STATE & DATA ---
  let historyData = {
    cpu: new Array(20).fill(0),
    ram: new Array(20).fill(0)
  };
  let services = [];
  let notesSaveTimeout = null;

  // --- DOM ELEMENTS ---
  const cpuUsageVal = document.getElementById('cpuUsageVal');
  const cpuBar = document.getElementById('cpuBar');
  const cpuSubtext = document.getElementById('cpuSubtext');

  const cpuTempVal = document.getElementById('cpuTempVal');
  const tempBar = document.getElementById('tempBar');
  const tempSubtext = document.getElementById('tempSubtext');

  const ramUsageVal = document.getElementById('ramUsageVal');
  const ramBar = document.getElementById('ramBar');
  const ramSubtext = document.getElementById('ramSubtext');

  const diskUsageVal = document.getElementById('diskUsageVal');
  const diskBar = document.getElementById('diskBar');
  const diskSubtext = document.getElementById('diskSubtext');

  const specHostname = document.getElementById('specHostname');
  const specUptime = document.getElementById('specUptime');
  const specPlatform = document.getElementById('specPlatform');
  const specNode = document.getElementById('specNode');
  const specLoad = document.getElementById('specLoad');
  const ipAddress = document.getElementById('ipAddress');
  const systemInfo = document.getElementById('systemInfo');
  const appTitle = document.getElementById('appTitle');

  const servicesGrid = document.getElementById('servicesGrid');
  const notesArea = document.getElementById('notesArea');
  const notesStatus = document.getElementById('notesStatus');

  // Modal elements
  const serviceModal = document.getElementById('serviceModal');
  const addServiceBtn = document.getElementById('addServiceBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const cancelModalBtn = document.getElementById('cancelModalBtn');
  const serviceForm = document.getElementById('serviceForm');
  const modalTitle = document.getElementById('modalTitle');
  const serviceId = document.getElementById('serviceId');
  const serviceName = document.getElementById('serviceName');
  const serviceUrl = document.getElementById('serviceUrl');
  const serviceCategory = document.getElementById('serviceCategory');
  const serviceColor = document.getElementById('serviceColor');

  // Chart canvas
  const canvas = document.getElementById('realtimeChart');
  const ctx = canvas ? canvas.getContext('2d') : null;

  // --- HELPER FUNCTIONS ---
  function formatUptime(seconds) {
    if (!seconds || isNaN(seconds)) return 'N/A';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);

    let parts = [];
    if (days > 0) parts.push(`${days}j`);
    if (hours > 0) parts.push(`${hours}h`);
    parts.push(`${mins}m`);
    return parts.join(' ');
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'Ko', 'Mo', 'Go', 'To'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Draw smooth sparkline chart
  function drawChart() {
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    const drawLine = (data, color, fillGradient) => {
      if (data.length < 2) return;
      const step = width / (data.length - 1);

      ctx.beginPath();
      ctx.moveTo(0, height - (data[0] / 100) * (height - 10) - 5);

      for (let i = 1; i < data.length; i++) {
        const x = i * step;
        const y = height - (data[i] / 100) * (height - 10) - 5;
        ctx.lineTo(x, y);
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      if (fillGradient) {
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fillStyle = fillGradient;
        ctx.fill();
      }
    };

    // CPU Area
    const cpuGrad = ctx.createLinearGradient(0, 0, 0, height);
    cpuGrad.addColorStop(0, 'rgba(56, 189, 248, 0.2)');
    cpuGrad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
    drawLine(historyData.cpu, '#38bdf8', cpuGrad);

    // RAM Line
    drawLine(historyData.ram, '#8b5cf6', null);
  }

  // --- API CALLS ---

  async function fetchStats() {
    try {
      const res = await fetch('/api/stats');
      if (!res.ok) throw new Error('API non disponible');
      const data = await res.json();

      // CPU
      const cpuVal = data.cpu.usagePercent || 0;
      cpuUsageVal.textContent = `${cpuVal}%`;
      cpuBar.style.width = `${cpuVal}%`;
      cpuSubtext.textContent = `${data.cpu.cores || 1} cœurs • ${data.cpu.model.split(' ')[0]}`;

      // Temp
      if (data.cpu.tempC !== null && data.cpu.tempC !== undefined) {
        const temp = data.cpu.tempC;
        cpuTempVal.textContent = `${temp}°C`;
        const tempPercent = Math.min(100, Math.max(0, (temp / 85) * 100));
        tempBar.style.width = `${tempPercent}%`;

        if (temp > 75) {
          tempBar.style.background = 'linear-gradient(90deg, #f59e0b, #ef4444)';
          tempSubtext.textContent = '⚠️ Température élevée';
        } else if (temp > 60) {
          tempBar.style.background = 'linear-gradient(90deg, #10b981, #f59e0b)';
          tempSubtext.textContent = 'Température normale';
        } else {
          tempBar.style.background = 'linear-gradient(90deg, #38bdf8, #10b981)';
          tempSubtext.textContent = 'SOC Température optimale';
        }
      } else {
        cpuTempVal.textContent = 'N/A';
        tempBar.style.width = '0%';
        tempSubtext.textContent = 'Sonde indisponible';
      }

      // RAM
      const ramVal = data.memory.percent || 0;
      ramUsageVal.textContent = `${ramVal}%`;
      ramBar.style.width = `${ramVal}%`;
      ramSubtext.textContent = `${data.memory.usedMb} Mo / ${data.memory.totalMb} Mo`;

      // Disk
      const diskVal = data.disk.percent || 0;
      diskUsageVal.textContent = `${diskVal}%`;
      diskBar.style.width = `${diskVal}%`;
      diskSubtext.textContent = `${data.disk.used} / ${data.disk.total} (${data.disk.free} libre)`;

      // Specs & Info
      specHostname.textContent = data.hostname || 'RaspberryPi';
      specUptime.textContent = formatUptime(data.uptimeSeconds);
      specPlatform.textContent = data.platform || 'Linux';
      specNode.textContent = data.nodeVersion || 'v25';
      specLoad.textContent = data.cpu.loadAvg ? data.cpu.loadAvg.join(', ') : '0.00';
      ipAddress.textContent = data.ip || '127.0.0.1';
      systemInfo.textContent = `${data.hostname} • IP: ${data.ip}`;

      // Push history for chart
      historyData.cpu.shift();
      historyData.cpu.push(cpuVal);

      historyData.ram.shift();
      historyData.ram.push(ramVal);

      drawChart();

    } catch (err) {
      console.warn('Erreur récupération stats:', err);
      systemInfo.textContent = '⚠️ Mode hors ligne ou tentative de reconnexion...';
    }
  }

  async function loadConfig() {
    try {
      const res = await fetch('/api/config');
      if (!res.ok) return;
      const data = await res.json();

      if (data.title) appTitle.textContent = data.title;
      if (Array.isArray(data.services)) {
        services = data.services;
        renderServices();
      }
      if (data.notes !== undefined) {
        notesArea.value = data.notes;
      }
    } catch (err) {
      console.error('Erreur chargement config:', err);
    }
  }

  async function saveConfigData(newServices, newNotes) {
    try {
      const payload = {
        services: newServices !== undefined ? newServices : services,
        notes: newNotes !== undefined ? newNotes : notesArea.value
      };

      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showSaveStatus();
      }
    } catch (err) {
      console.error('Erreur sauvegarde config:', err);
    }
  }

  function showSaveStatus() {
    notesStatus.classList.add('active');
    setTimeout(() => {
      notesStatus.classList.remove('active');
    }, 2000);
  }

  // --- RENDER SERVICES ---

  function renderServices() {
    servicesGrid.innerHTML = '';

    if (services.length === 0) {
      servicesGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 30px;">
          Aucun service configuré. Cliquez sur <strong>Nouveau Service</strong> pour ajouter un raccourci !
        </div>
      `;
      return;
    }

    services.forEach(service => {
      const card = document.createElement('div');
      card.className = 'service-card';
      const initial = service.name ? service.name.charAt(0).toUpperCase() : 'S';
      const color = service.color || '#38bdf8';

      card.innerHTML = `
        <div class="service-main">
          <div class="service-icon-box" style="background: ${color}20; border: 1px solid ${color}40; color: ${color};">
            ${initial}
          </div>
          <div class="service-info">
            <span class="service-title">${escapeHtml(service.name)}</span>
            <span class="service-category">${escapeHtml(service.category || 'Général')}</span>
          </div>
        </div>
        <div class="service-actions">
          <a href="${escapeHtml(service.url)}" target="_blank" rel="noopener noreferrer" class="service-link">
            Ouvrir
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
          <div class="service-buttons">
            <button class="icon-btn edit-btn" data-id="${service.id}" title="Modifier">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="icon-btn delete delete-btn" data-id="${service.id}" title="Supprimer">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      `;

      servicesGrid.appendChild(card);
    });

    // Attach event listeners to Edit and Delete buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        openEditModal(id);
      });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        deleteService(id);
      });
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function(m) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      }[m];
    });
  }

  // --- MODAL & SERVICE HANDLERS ---

  function openModal() {
    serviceModal.classList.add('active');
  }

  function closeModal() {
    serviceModal.classList.remove('active');
    serviceForm.reset();
    serviceId.value = '';
    modalTitle.textContent = 'Ajouter un service';
  }

  function openEditModal(id) {
    const item = services.find(s => s.id === id);
    if (!item) return;

    serviceId.value = item.id;
    serviceName.value = item.name;
    serviceUrl.value = item.url;
    serviceCategory.value = item.category || 'Général';
    serviceColor.value = item.color || '#38bdf8';
    modalTitle.textContent = 'Modifier le service';

    openModal();
  }

  function deleteService(id) {
    if (confirm('Voulez-vous vraiment supprimer ce service ?')) {
      services = services.filter(s => s.id !== id);
      renderServices();
      saveConfigData(services, undefined);
    }
  }

  addServiceBtn.addEventListener('click', () => {
    closeModal();
    openModal();
  });

  closeModalBtn.addEventListener('click', closeModal);
  cancelModalBtn.addEventListener('click', closeModal);

  serviceForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const id = serviceId.value;
    const name = serviceName.value.trim();
    const url = serviceUrl.value.trim();
    const category = serviceCategory.value.trim() || 'Général';
    const color = serviceColor.value;

    if (!name || !url) return;

    if (id) {
      // Edit existing
      const idx = services.findIndex(s => s.id === id);
      if (idx !== -1) {
        services[idx] = { id, name, url, category, color };
      }
    } else {
      // Create new
      const newService = {
        id: Date.now().toString(),
        name,
        url,
        category,
        color
      };
      services.push(newService);
    }

    renderServices();
    saveConfigData(services, undefined);
    closeModal();
  });

  // --- NOTES AUTO-SAVE ---

  notesArea.addEventListener('input', () => {
    clearTimeout(notesSaveTimeout);
    notesSaveTimeout = setTimeout(() => {
      saveConfigData(undefined, notesArea.value);
    }, 1000);
  });

  // --- INITIALIZATION ---
  loadConfig();
  fetchStats();
  setInterval(fetchStats, 3000);

  window.addEventListener('resize', drawChart);
});
