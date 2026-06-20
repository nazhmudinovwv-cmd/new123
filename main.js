'use strict';

const App = (() => {
  // ─── State ────────────────────────────────────────────────
  let state = {
    user: null,
    activeOrderId: null,
    activeSiteId: null,
    gpsLat: null,
    gpsLng: null,
    gpsWatchId: null,
    maps: {},
    vehicleMarkers: {},
    siteMarkers: {},
    routeLine: null,
    driverMapLine: null,
    simInterval: null,
    chartWeek: null,
    chartStatus: null,
    gpsTrack: [],
    knownOrderIds: new Set(),
    dispHeatLayer: null,
    mgrHeatLayer: null,
    gpsDiagInterval: null,
    gpsLog: []
  };

  // ─── Utils ────────────────────────────────────────────────
  function fmt(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('ru-RU');
  }
  function fmtFull(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  function statusLabel(s) {
    return { pending: 'Не начато', in_progress: 'В работе', completed: 'Выполнено', skipped: 'Пропущено' }[s] || s;
  }
  function orderStatusLabel(s) {
    return { pending: 'Не начато', in_progress: 'В работе', completed: 'Выполнено' }[s] || s;
  }
  function violTypeLabel(t) {
    return { missed_site: 'Пропущена площадка', no_photo: 'Отсутствует фото', late: 'Опоздание', complaint: 'Жалоба жителей' }[t] || t;
  }
  function distanceMeter(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ─── Toast ────────────────────────────────────────────────
  function toast(msg, type = '', dur = 3000) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = type ? `show ${type}` : 'show';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.className = ''; }, dur);
  }

  // ─── Screen navigation ────────────────────────────────────
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`screen-${id}`).classList.add('active');
  }

  function showTab(screen, tab) {
    const prefix = screen === 'driver' ? 'driver' : screen === 'dispatcher' ? 'disp' : 'mgr';
    document.querySelectorAll(`#screen-${screen} .tab-content`).forEach(t => t.classList.remove('active'));
    document.querySelectorAll(`#screen-${screen} .tab-btn`).forEach(b => b.classList.remove('active'));
    const tabEl = document.getElementById(`tab-${tab}`);
    if (tabEl) tabEl.classList.add('active');
    document.querySelectorAll(`#screen-${screen} .tab-btn[data-tab="${tab}"]`).forEach(b => b.classList.add('active'));
  }

  // ─── Login / Logout ───────────────────────────────────────
  function login() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    const user = Data.login(username, password);
    if (!user) { errEl.classList.add('show'); return; }
    errEl.classList.remove('show');
    state.user = user;
    Data.setSession(user);
    initRole(user);
  }

  function logout() {
    stopGPS();
    if (state.simInterval) { clearInterval(state.simInterval); state.simInterval = null; }
    Data.clearSession();
    state.user = null;
    state.activeOrderId = null;
    state.activeSiteId = null;
    state.maps = {};
    state.vehicleMarkers = {};
    state.siteMarkers = {};
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    showScreen('login');
    toast('Вы вышли из системы');
  }

  function initRole(user) {
    if (user.role === 'driver') initDriver(user);
    else if (user.role === 'dispatcher') initDispatcher(user);
    else if (user.role === 'manager') initManager(user);
    else if (user.role === 'admin') initAdmin(user);
  }

  // ─── DRIVER ───────────────────────────────────────────────
  function initDriver(user) {
    document.getElementById('driver-header-title').textContent = user.name.split(' ')[0] + ' ' + (user.name.split(' ')[1] || '');
    document.getElementById('driver-avatar').textContent = user.name[0];
    showScreen('driver');
    renderDriverOrders();
    startGPS();
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    Data.getOrdersByDriver(user.id).forEach(o => state.knownOrderIds.add(o.id));

    // auto-select active order
    const orders = Data.getOrdersByDriver(user.id);
    const active = orders.find(o => o.status === 'in_progress');
    if (active) {
      state.activeOrderId = active.id;
      const visits = Data.getVisitsByOrder(active.id);
      const cur = visits.find(v => v.status === 'in_progress') || visits.find(v => v.status === 'pending');
      if (cur) state.activeSiteId = cur.siteId;
      renderDriverActive();
    }
  }

  function renderDriverOrders() {
    const orders = Data.getOrdersByDriver(state.user.id);
    const el = document.getElementById('driver-orders-list');
    if (!orders.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>Нет назначенных нарядов</p></div>';
      return;
    }
    el.innerHTML = orders.map(o => {
      const visits = Data.getVisitsByOrder(o.id);
      const done = visits.filter(v => v.status === 'completed').length;
      return `<div class="order-item status-${o.status}" onclick="App.selectDriverOrder('${o.id}')">
        <div class="order-num">Наряд №${o.number} · ${fmtDate(o.date)}</div>
        <div class="order-title">📍 ${o.district} район</div>
        <div class="order-meta">
          <span>🚛 ${(Data.getVehicleById(o.vehicleId) || {}).number || '—'}</span>
          <span>📍 ${done}/${visits.length} площадок</span>
          <span><span class="badge badge-${o.status === 'completed' ? 'success' : o.status === 'in_progress' ? 'warning' : 'pending'}">${orderStatusLabel(o.status)}</span></span>
        </div>
      </div>`;
    }).join('');
  }

  function selectDriverOrder(orderId) {
    const order = Data.getOrderById(orderId);
    if (!order) return;

    if (order.status === 'pending') {
      Data.updateOrder(orderId, { status: 'in_progress' });
      // create visit records if not exist
      order.sites.forEach(siteId => {
        if (!Data.getVisit(orderId, siteId)) {
          Data.createVisit({ orderId, siteId, vehicleId: order.vehicleId, status: 'pending', arrivedAt: null, completedAt: null, photoBefore: null, photoAfter: null, lat: null, lng: null });
        }
      });
      toast('Наряд начат!', 'success');
    }

    state.activeOrderId = orderId;
    state.gpsTrack = [];
    const visits = Data.getVisitsByOrder(orderId);
    const cur = visits.find(v => v.status === 'in_progress') || visits.find(v => v.status === 'pending');
    state.activeSiteId = cur ? cur.siteId : null;

    renderDriverOrders();
    renderDriverActive();
    showTab('driver', 'driver-active');
    initDriverMap();
  }

  function renderDriverActive() {
    const noActive = document.getElementById('driver-no-active');
    const content = document.getElementById('driver-active-content');

    if (!state.activeOrderId) {
      noActive.style.display = '';
      content.style.display = 'none';
      return;
    }

    noActive.style.display = 'none';
    content.style.display = '';

    const order = Data.getOrderById(state.activeOrderId);
    if (!order) return;
    const visits = Data.getVisitsByOrder(state.activeOrderId);

    document.getElementById('active-order-title').textContent = `Наряд №${order.number} · ${order.district}`;
    document.getElementById('active-order-badge').className = `badge badge-${order.status === 'completed' ? 'success' : order.status === 'in_progress' ? 'warning' : 'pending'}`;
    document.getElementById('active-order-badge').textContent = orderStatusLabel(order.status);

    // current site panel
    const curVisit = visits.find(v => v.siteId === state.activeSiteId);
    const curSite = state.activeSiteId ? Data.getSiteById(state.activeSiteId) : null;

    if (curSite) {
      document.getElementById('active-site-name').textContent = curSite.name;
      document.getElementById('active-site-addr').textContent = curSite.address;
    } else {
      document.getElementById('active-site-name').textContent = 'Все площадки обслужены';
      document.getElementById('active-site-addr').textContent = order.district + ' район';
    }

    const arriveBtn = document.getElementById('btn-arrive');
    const completeBtn = document.getElementById('btn-complete-site');
    const skipBtn = document.getElementById('btn-skip-site');

    if (!curVisit || curVisit.status === 'pending') {
      arriveBtn.disabled = false;
      completeBtn.disabled = true;
    } else if (curVisit.status === 'in_progress') {
      arriveBtn.disabled = true;
      completeBtn.disabled = false;
    } else {
      arriveBtn.disabled = true;
      completeBtn.disabled = true;
    }

    // photo slots
    renderPhotoSlots(curVisit);

    // sites list
    const list = document.getElementById('active-sites-list');
    list.innerHTML = order.sites.map((siteId, i) => {
      const site = Data.getSiteById(siteId);
      const visit = visits.find(v => v.siteId === siteId);
      const st = visit ? visit.status : 'pending';
      const numClass = st === 'completed' ? 'done' : st === 'in_progress' ? 'active' : st === 'skipped' ? 'skip' : '';
      const icon = st === 'completed' ? '✓' : st === 'in_progress' ? '▶' : st === 'skipped' ? '✗' : i + 1;
      return `<div class="site-row" onclick="App.selectSite('${siteId}')">
        <div class="site-num ${numClass}">${icon}</div>
        <div class="site-info">
          <div class="site-name">${site ? site.name : siteId}</div>
          <div class="site-addr">${site ? site.address : ''}</div>
          ${visit && visit.arrivedAt ? `<div class="site-time">Прибыл: ${fmt(visit.arrivedAt)} · ${visit.completedAt ? 'Выполнен: ' + fmt(visit.completedAt) : 'В работе'}</div>` : ''}
        </div>
        <span class="badge badge-${st === 'completed' ? 'success' : st === 'in_progress' ? 'warning' : st === 'skipped' ? 'danger' : 'pending'}">${statusLabel(st)}</span>
      </div>`;
    }).join('');
  }

  function renderPhotoSlots(visit) {
    const slotBefore = document.getElementById('slot-before');
    const slotAfter = document.getElementById('slot-after');
    if (!visit) return;

    // Before photo
    const imgBefore = slotBefore.querySelector('img') || (() => { const img = document.createElement('img'); slotBefore.appendChild(img); return img; })();
    if (visit.photoBefore) {
      imgBefore.src = visit.photoBefore;
      imgBefore.style.display = '';
      slotBefore.querySelector('.photo-icon').style.display = 'none';
      slotBefore.querySelector('.photo-label').style.display = 'none';
    } else {
      imgBefore.style.display = 'none';
      const pi = slotBefore.querySelector('.photo-icon');
      const pl = slotBefore.querySelector('.photo-label');
      if (pi) pi.style.display = '';
      if (pl) pl.style.display = '';
    }

    const imgAfter = slotAfter.querySelector('img') || (() => { const img = document.createElement('img'); slotAfter.appendChild(img); return img; })();
    if (visit.photoAfter) {
      imgAfter.src = visit.photoAfter;
      imgAfter.style.display = '';
      slotAfter.querySelector('.photo-icon').style.display = 'none';
      slotAfter.querySelector('.photo-label').style.display = 'none';
    } else {
      imgAfter.style.display = 'none';
      const pi = slotAfter.querySelector('.photo-icon');
      const pl = slotAfter.querySelector('.photo-label');
      if (pi) pi.style.display = '';
      if (pl) pl.style.display = '';
    }
  }

  function selectSite(siteId) {
    if (!state.activeOrderId) return;
    const visits = Data.getVisitsByOrder(state.activeOrderId);
    const visit = visits.find(v => v.siteId === siteId);
    if (visit && (visit.status === 'completed' || visit.status === 'skipped')) return;
    state.activeSiteId = siteId;
    renderDriverActive();
  }

  function arrive() {
    if (!state.activeOrderId || !state.activeSiteId) return;
    const visit = Data.getVisit(state.activeOrderId, state.activeSiteId);
    if (!visit) return;
    Data.updateVisit(visit.id, {
      status: 'in_progress',
      arrivedAt: new Date().toISOString(),
      lat: state.gpsLat,
      lng: state.gpsLng
    });
    // Update vehicle status
    const order = Data.getOrderById(state.activeOrderId);
    if (order) Data.updateVehicle(order.vehicleId, { status: 'at_site', lat: state.gpsLat || 52.9578, lng: state.gpsLng || 63.1283 });
    toast('Прибытие зафиксировано!', 'success');
    renderDriverActive();
  }

  function completeSite() {
    if (!state.activeOrderId || !state.activeSiteId) return;
    const visit = Data.getVisit(state.activeOrderId, state.activeSiteId);
    if (!visit) return;
    if (!visit.photoAfter) {
      toast('⚠️ Добавьте фото ПОСЛЕ уборки!', 'warning');
      return;
    }
    Data.updateVisit(visit.id, {
      status: 'completed',
      completedAt: new Date().toISOString()
    });
    toast('✅ Площадка выполнена!', 'success');

    // Move to next site
    const order = Data.getOrderById(state.activeOrderId);
    const visits = Data.getVisitsByOrder(state.activeOrderId);
    const nextVisit = order.sites.map(sid => visits.find(v => v.siteId === sid)).find(v => v && v.status === 'pending');
    if (nextVisit) {
      state.activeSiteId = nextVisit.siteId;
      Data.updateVehicle(order.vehicleId, { status: 'en_route' });
    } else {
      state.activeSiteId = null;
      Data.updateOrder(state.activeOrderId, { status: 'completed' });
      Data.updateVehicle(order.vehicleId, { status: 'idle' });
      toast('🎉 Наряд полностью выполнен!', 'success', 5000);
    }
    renderDriverActive();
    updateDriverMapMarkers();
  }

  function skipSite() {
    if (!state.activeOrderId || !state.activeSiteId) return;
    if (!confirm('Пропустить площадку? Это будет зафиксировано как нарушение.')) return;
    const visit = Data.getVisit(state.activeOrderId, state.activeSiteId);
    if (!visit) return;
    Data.updateVisit(visit.id, { status: 'skipped' });
    Data.addViolation({ orderId: state.activeOrderId, siteId: state.activeSiteId, type: 'missed_site', description: 'Площадка пропущена водителем', driverId: state.user.id });
    toast('⚠️ Площадка пропущена, нарушение зафиксировано', 'warning');

    const order = Data.getOrderById(state.activeOrderId);
    const visits = Data.getVisitsByOrder(state.activeOrderId);
    const next = order.sites.map(sid => visits.find(v => v.siteId === sid)).find(v => v && v.status === 'pending');
    if (next) state.activeSiteId = next.siteId;
    else { state.activeSiteId = null; Data.updateOrder(state.activeOrderId, { status: 'completed' }); }
    renderDriverActive();
  }

  function handlePhoto(type, input) {
    if (!input.files || !input.files[0]) return;
    if (!state.activeOrderId || !state.activeSiteId) { toast('Сначала выберите активную площадку', 'warning'); return; }
    const visit = Data.getVisit(state.activeOrderId, state.activeSiteId);
    if (!visit) return;

    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        // Максимальное сжатие: 900px по длинной стороне, JPEG 0.55
        const canvas = document.createElement('canvas');
        const maxW = 900;
        const scale = Math.min(1, maxW / Math.max(img.width, img.height));
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.55);

        toast(`📤 Загрузка фото...`, '');

        // Загружаем в Supabase Storage (если настроен), иначе base64
        const photoUrl = await SupabaseSync.uploadPhoto(
          dataUrl,
          `${state.activeOrderId}_${state.activeSiteId}_${type}`
        );

        const updates = {};
        updates[type === 'before' ? 'photoBefore' : 'photoAfter'] = photoUrl;
        Data.updateVisit(visit.id, updates);

        if (type === 'after' && !visit.photoBefore) {
          Data.addViolation({ orderId: state.activeOrderId, siteId: state.activeSiteId, type: 'no_photo', description: 'Отсутствует фото ДО уборки', driverId: state.user.id });
        }
        toast(`📸 Фото ${type === 'before' ? 'ДО' : 'ПОСЛЕ'} сохранено`, 'success');
        renderDriverActive();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  // ─── GPS helpers ─────────────────────────────────────────
  function _gpsAgeText(isoStr) {
    if (!isoStr) return '— нет GPS';
    const sec = Math.floor((Date.now() - new Date(isoStr)) / 1000);
    if (sec < 60)   return `${sec}с`;
    if (sec < 3600) return `${Math.floor(sec / 60)}м`;
    return `${Math.floor(sec / 3600)}ч`;
  }
  function _gpsFreshColor(isoStr) {
    if (!isoStr) return '#9E9E9E';
    const sec = Math.floor((Date.now() - new Date(isoStr)) / 1000);
    if (sec < 5)  return '#43A047';  // зелёный — свежий
    if (sec < 30) return '#FB8C00';  // оранжевый — недавний
    return '#E53935';                // красный — устаревший
  }

  // ─── GPS ──────────────────────────────────────────────────
  function startGPS() {
    if (!navigator.geolocation) {
      document.getElementById('gps-status').textContent = 'GPS: не поддерживается';
      return;
    }
    state.gpsWatchId = navigator.geolocation.watchPosition(
      pos => {
        state.gpsLat = pos.coords.latitude;
        state.gpsLng = pos.coords.longitude;
        const speedKmh = pos.coords.speed != null ? Math.round(pos.coords.speed * 3.6) : 0;
        const acc = Math.round(pos.coords.accuracy);
        document.getElementById('gps-status').textContent = `GPS: активен (±${acc}м)${speedKmh > 0 ? ' · ' + speedKmh + ' км/ч' : ''}`;
        document.getElementById('gps-coords').textContent = `${state.gpsLat.toFixed(4)}, ${state.gpsLng.toFixed(4)}`;
        document.getElementById('gps-dot').style.background = 'var(--success)';

        if (state.activeOrderId) state.gpsTrack.push([state.gpsLat, state.gpsLng]);
        if (state.user && state.user.vehicleId) {
          const veh = Data.getVehicleById ? Data.getVehicleById(state.user.vehicleId) : null;
          Data.updateVehicle(state.user.vehicleId, { lat: state.gpsLat, lng: state.gpsLng, speed: speedKmh, lastGpsAt: new Date().toISOString() });
          const vNum = veh ? veh.number : state.user.vehicleId;
          _gpsLogEntry(`📍 ${vNum}: ${state.gpsLat.toFixed(5)}, ${state.gpsLng.toFixed(5)} · ±${acc}м${speedKmh > 0 ? ' · ' + speedKmh + 'км/ч' : ''}`, 'ok');
        } else {
          _gpsLogEntry(`📍 GPS: ${state.gpsLat.toFixed(5)}, ${state.gpsLng.toFixed(5)} · ±${acc}м (нет ТС)`, 'info');
        }
        updateDriverMapMarkers();
        checkGeofences();
      },
      err => {
        // Fallback: simulate GPS in Rudny area
        state.gpsLat = 52.9578 + (Math.random() - 0.5) * 0.002;
        state.gpsLng = 63.1283 + (Math.random() - 0.5) * 0.002;
        document.getElementById('gps-status').textContent = 'GPS: симуляция (демо)';
        document.getElementById('gps-coords').textContent = `${state.gpsLat.toFixed(4)}, ${state.gpsLng.toFixed(4)}`;
        _gpsLogEntry(`⚠️ GPS недоступен (${err.message}), используется симуляция`, 'warn');
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
  }

  function stopGPS() {
    if (state.gpsWatchId !== null) {
      navigator.geolocation.clearWatch(state.gpsWatchId);
      state.gpsWatchId = null;
    }
  }

  function checkGeofences() {
    if (!state.activeOrderId || !state.activeSiteId || !state.gpsLat) return;
    const site = Data.getSiteById(state.activeSiteId);
    if (!site) return;
    const visit = Data.getVisit(state.activeOrderId, state.activeSiteId);
    if (!visit || visit.status !== 'pending') return;
    const dist = distanceMeter(state.gpsLat, state.gpsLng, site.lat, site.lng);
    if (dist <= site.geofenceRadius) {
      toast(`📍 Вы прибыли на ${site.name}!`, 'success', 4000);
    }
  }

  // ─── Driver Map ───────────────────────────────────────────
  function initDriverMap() {
    if (state.maps.driver) { state.maps.driver.invalidateSize(); updateDriverMapMarkers(); return; }
    const map = L.map('driver-route-map').setView([52.9578, 63.1283], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19
    }).addTo(map);
    state.maps.driver = map;
    updateDriverMapMarkers();
  }

  function updateDriverMapMarkers() {
    const map = state.maps.driver;
    if (!map || !state.activeOrderId) return;
    const _drvLayers = [];
    map.eachLayer(l => { if (l instanceof L.Marker || l instanceof L.Polyline || l instanceof L.Circle) _drvLayers.push(l); });
    _drvLayers.forEach(l => map.removeLayer(l));

    const order = Data.getOrderById(state.activeOrderId);
    const visits = Data.getVisitsByOrder(state.activeOrderId);
    const coords = [];

    order.sites.forEach((siteId, i) => {
      const site = Data.getSiteById(siteId);
      const visit = visits.find(v => v.siteId === siteId);
      const st = visit ? visit.status : 'pending';
      const color = st === 'completed' ? '#43A047' : st === 'in_progress' ? '#FB8C00' : st === 'skipped' ? '#E53935' : '#9E9E9E';

      L.circle([site.lat, site.lng], { radius: site.geofenceRadius, color, fillColor: color, fillOpacity: 0.2, weight: 2 }).addTo(map);
      const marker = L.circleMarker([site.lat, site.lng], { radius: 10, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 });
      marker.bindTooltip(`${i + 1}. ${site.name}`);
      marker.addTo(map);
      coords.push([site.lat, site.lng]);
    });

    if (coords.length > 1) L.polyline(coords, { color: '#1565C0', weight: 3, dashArray: '8,4', opacity: 0.7 }).addTo(map);

    if (state.gpsTrack.length > 1) {
      L.polyline(state.gpsTrack, { color: '#E91E63', weight: 3, opacity: 0.8 }).addTo(map);
    }
    if (state.gpsLat) {
      const truckIcon = L.divIcon({ html: '<div style="font-size:24px;line-height:1">🚛</div>', iconSize: [30, 30], iconAnchor: [15, 15], className: '' });
      L.marker([state.gpsLat, state.gpsLng], { icon: truckIcon }).addTo(map).bindTooltip('Ваше положение');
    }

    if (coords.length) map.fitBounds(coords, { padding: [30, 30] });
  }

  // ─── DISPATCHER ───────────────────────────────────────────
  function initDispatcher(user) {
    document.getElementById('dispatcher-avatar').textContent = user.name[0];
    document.getElementById('dispatcher-username').textContent = user.name;
    showScreen('dispatcher');
    initDispatcherMap();
    renderDispatcherOrders();
    renderViolations();
    initOrderForm();
    startVehicleSimulation();
  }

  function initDispatcherMap() {
    if (state.maps.dispatcher) { state.maps.dispatcher.invalidateSize(); return; }
    const map = L.map('dispatcher-map').setView([52.9620, 63.1280], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19
    }).addTo(map);
    state.maps.dispatcher = map;
    renderDispatcherMapLayers();
  }

  function renderDispatcherMapLayers() {
    const map = state.maps.dispatcher;
    if (!map) return;

    // Clear old layers (safe collect-then-remove to avoid eachLayer mutation bug)
    const _dispLayers = [];
    map.eachLayer(l => { if (l instanceof L.Marker || l instanceof L.CircleMarker || l instanceof L.Circle) _dispLayers.push(l); });
    _dispLayers.forEach(l => map.removeLayer(l));

    const sites = Data.getSites();
    const visits = Data.getVisits();
    const todayOrders = Data.getTodayOrders();

    sites.forEach(site => {
      let status = 'pending';
      todayOrders.forEach(order => {
        if (order.sites.includes(site.id)) {
          const visit = visits.find(v => v.orderId === order.id && v.siteId === site.id);
          if (visit) status = visit.status;
        }
      });
      const color = status === 'completed' ? '#43A047' : status === 'in_progress' ? '#FB8C00' : status === 'skipped' ? '#E53935' : '#9E9E9E';
      const marker = L.circleMarker([site.lat, site.lng], { radius: 9, color: '#fff', weight: 2, fillColor: color, fillOpacity: 0.9 });
      marker.bindPopup(`<b>${site.name}</b><br>${site.address}<br>Статус: <b>${statusLabel(status)}</b>`);
      marker.addTo(map);
    });

    if (state.dispHeatLayer) { map.removeLayer(state.dispHeatLayer); state.dispHeatLayer = null; }
    const dispViolations = Data.getViolations();
    if (dispViolations.length && typeof L.heatLayer !== 'undefined') {
      const pts = dispViolations.map(v => { const s = Data.getSiteById(v.siteId); return s ? [s.lat, s.lng, 1] : null; }).filter(Boolean);
      if (pts.length) state.dispHeatLayer = L.heatLayer(pts, { radius: 35, blur: 25, maxZoom: 17, gradient: { 0.4: '#FFC107', 0.7: '#FF5722', 1: '#B71C1C' } }).addTo(map);
    }
    // Vehicles
    renderVehicleMarkers(map);
    renderVehiclePanel();
  }

  function renderVehicleMarkers(map) {
    Object.values(state.vehicleMarkers).forEach(m => m.remove());
    state.vehicleMarkers = {};
    const vehicles = Data.getVehicles();
    vehicles.forEach(v => {
      const driver = Data.getUserById(v.driverId);
      const color = v.status === 'idle' ? '#9E9E9E' : v.status === 'at_site' ? '#43A047' : '#1565C0';
      const gpsAge = _gpsAgeText(v.lastGpsAt);
      const gpsDot = _gpsFreshColor(v.lastGpsAt);
      const speedPart = (v.speed > 0) ? `<span>${v.speed}км/ч</span><span>·</span>` : '';
      const truckIcon = L.divIcon({
        html: `<div style="background:${color};color:#fff;border-radius:8px;padding:3px 7px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.35);line-height:1.4">
          <div>🚛 ${v.number}</div>
          <div style="font-size:9px;display:flex;align-items:center;gap:3px;margin-top:1px;opacity:0.92">
            ${speedPart}<span>GPS:${gpsAge}</span>
            <span style="width:6px;height:6px;border-radius:50%;background:${gpsDot};display:inline-block;flex-shrink:0"></span>
          </div>
        </div>`,
        className: '',
        iconAnchor: [40, 24]
      });
      const m = L.marker([v.lat, v.lng], { icon: truckIcon });
      const statusTxt = { idle: 'Простой', en_route: 'В пути', at_site: 'На объекте' }[v.status] || v.status;
      const lastGpsFormatted = v.lastGpsAt
        ? new Date(v.lastGpsAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : '—';
      m.bindPopup(`<b>${v.number}</b> (${v.model})<br>Водитель: ${driver ? driver.name : '—'}<br>Статус: <b>${statusTxt}</b><br>Скорость: <b>${v.speed || 0} км/ч</b><br>Последний GPS: <b>${lastGpsFormatted}</b>`);
      m.addTo(map);
      state.vehicleMarkers[v.id] = m;
    });
  }

  function renderVehiclePanel() {
    const vehicles = Data.getVehicles();
    const el = document.getElementById('vehicle-list');
    if (!el) return;
    const statusTxt = { idle: 'Простой', en_route: 'В пути', at_site: 'На объекте' };
    const statusColor = { idle: '#9E9E9E', en_route: '#1565C0', at_site: '#43A047' };
    el.innerHTML = vehicles.map(v => {
      const driver = Data.getUserById(v.driverId);
      return `<div class="vehicle-row" onclick="App.panToVehicle('${v.id}')" style="cursor:pointer" title="Найти на карте">
        <span class="vehicle-icon">🚛</span>
        <div class="vehicle-info">
          <div class="vnum">${v.number}</div>
          <div class="vdriver">${driver ? driver.name.split(' ')[0] + ' ' + driver.name.split(' ')[1][0] + '.' : '—'}</div>
        </div>
        <span style="font-size:11px;padding:2px 7px;background:${statusColor[v.status]}22;color:${statusColor[v.status]};border-radius:10px;font-weight:600">${statusTxt[v.status] || v.status}</span>
      </div>`;
    }).join('');
  }

  // ─── GPS Diagnostics ──────────────────────────────────────
  function _gpsLogEntry(msg, type) {
    const now = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    state.gpsLog.unshift({ time: now, msg, type }); // newest first
    if (state.gpsLog.length > 100) state.gpsLog.length = 100;
    const logEl = document.getElementById('gps-event-log');
    if (logEl) _renderGpsLog(logEl);
  }

  function _renderGpsLog(el) {
    if (!state.gpsLog.length) {
      el.innerHTML = '<div style="padding:12px;color:var(--text-muted);text-align:center">Ожидание событий GPS...</div>';
      return;
    }
    const colors = { ok: '#43A047', warn: '#FB8C00', err: '#E53935', info: '#1565C0' };
    el.innerHTML = state.gpsLog.map(e =>
      `<div style="padding:4px 14px;border-bottom:1px solid var(--border-color);display:flex;gap:8px;align-items:baseline">
        <span style="color:var(--text-muted);min-width:56px">${e.time}</span>
        <span style="width:8px;height:8px;border-radius:50%;background:${colors[e.type] || '#9E9E9E'};flex-shrink:0;margin-top:3px"></span>
        <span>${e.msg}</span>
      </div>`
    ).join('');
  }

  function renderGpsDiag() {
    const tableEl = document.getElementById('gps-diag-table');
    const updEl   = document.getElementById('gps-diag-updated');
    if (!tableEl) return;

    const vehicles = Data.getVehicles();
    const now = Date.now();
    const updTime = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (updEl) updEl.textContent = `Обновлено: ${updTime}`;

    if (!vehicles.length) {
      tableEl.innerHTML = '<div class="empty-state"><div class="empty-icon">🚛</div><p>Нет техники в системе</p></div>';
      return;
    }

    const rows = vehicles.map(v => {
      const driver = Data.getUserById(v.driverId);
      const driverName = driver ? driver.name : '— нет водителя —';

      // GPS age
      const sec = v.lastGpsAt ? Math.floor((now - new Date(v.lastGpsAt)) / 1000) : null;
      let dotColor, statusLabel, ageText;
      if (sec === null) {
        dotColor = '#9E9E9E'; statusLabel = 'Нет данных'; ageText = '—';
      } else if (sec < 5) {
        dotColor = '#43A047'; statusLabel = 'Онлайн'; ageText = `${sec}с назад`;
      } else if (sec < 30) {
        dotColor = '#FB8C00'; statusLabel = 'Недавно'; ageText = `${sec}с назад`;
      } else if (sec < 3600) {
        dotColor = '#E53935'; statusLabel = 'Нет связи'; ageText = `${Math.floor(sec / 60)}м назад`;
      } else {
        dotColor = '#E53935'; statusLabel = 'Нет связи'; ageText = `${Math.floor(sec / 3600)}ч назад`;
      }

      const lastTime = v.lastGpsAt
        ? new Date(v.lastGpsAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : '—';
      const coords = (v.lat && v.lng) ? `${v.lat.toFixed(4)}, ${v.lng.toFixed(4)}` : '—';
      const speedStr = (v.speed > 0) ? `${v.speed} км/ч` : '0 км/ч';

      // pulse animation for online
      const pulse = sec !== null && sec < 5
        ? 'animation:gps-pulse 1s infinite'
        : '';

      return `<tr>
        <td style="padding:10px 14px;white-space:nowrap">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="width:12px;height:12px;border-radius:50%;background:${dotColor};flex-shrink:0;${pulse}"></span>
            <div>
              <div style="font-weight:700;font-size:13px">🚛 ${v.number}</div>
              <div style="font-size:11px;color:var(--text-muted)">${v.model}</div>
            </div>
          </div>
        </td>
        <td style="padding:10px 14px">
          <div style="font-size:13px">${driverName}</div>
        </td>
        <td style="padding:10px 14px">
          <span style="padding:3px 9px;border-radius:10px;font-size:12px;font-weight:600;background:${dotColor}22;color:${dotColor}">${statusLabel}</span>
        </td>
        <td style="padding:10px 14px;font-size:12px">
          <div style="font-weight:600">${lastTime}</div>
          <div style="color:var(--text-muted);font-size:11px">${ageText}</div>
        </td>
        <td style="padding:10px 14px;font-size:12px">
          <div style="font-weight:600">${speedStr}</div>
        </td>
        <td style="padding:10px 14px;font-size:11px;color:var(--text-muted);font-family:monospace">${coords}</td>
      </tr>`;
    }).join('');

    tableEl.innerHTML = `<table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:var(--bg-secondary);font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px">
          <th style="padding:8px 14px;text-align:left;font-weight:600">ТС</th>
          <th style="padding:8px 14px;text-align:left;font-weight:600">Водитель</th>
          <th style="padding:8px 14px;text-align:left;font-weight:600">GPS статус</th>
          <th style="padding:8px 14px;text-align:left;font-weight:600">Последний сигнал</th>
          <th style="padding:8px 14px;text-align:left;font-weight:600">Скорость</th>
          <th style="padding:8px 14px;text-align:left;font-weight:600">Координаты</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  function startGpsDiag() {
    if (state.gpsDiagInterval) return;
    renderGpsDiag();
    state.gpsDiagInterval = setInterval(renderGpsDiag, 1000);
  }

  function stopGpsDiag() {
    if (state.gpsDiagInterval) {
      clearInterval(state.gpsDiagInterval);
      state.gpsDiagInterval = null;
    }
  }

  function clearGpsLog() {
    state.gpsLog = [];
    const el = document.getElementById('gps-event-log');
    if (el) _renderGpsLog(el);
  }

  function startVehicleSimulation() {
    if (state.simInterval) return;
    // Routes: vehicle moves between their order sites
    state.simInterval = setInterval(() => {
      const orders = Data.getTodayOrders();
      const vehicles = Data.getVehicles();
      vehicles.forEach(v => {
        const order = orders.find(o => o.vehicleId === v.id && o.status === 'in_progress');
        if (!order || v.status === 'at_site') return;

        const visits = Data.getVisitsByOrder(order.id);
        const nextVisit = order.sites.map(sid => visits.find(vi => vi.siteId === sid)).find(vi => vi && vi.status === 'pending');
        if (!nextVisit) return;
        const site = Data.getSiteById(nextVisit.siteId);
        if (!site) return;

        // Move towards next site
        const dlat = (site.lat - v.lat) * 0.08 + (Math.random() - 0.5) * 0.0002;
        const dlng = (site.lng - v.lng) * 0.08 + (Math.random() - 0.5) * 0.0002;
        const speed = Math.round(20 + Math.random() * 20);
        Data.updateVehicle(v.id, { lat: v.lat + dlat, lng: v.lng + dlng, speed, status: 'en_route', lastGpsAt: new Date().toISOString() });
      });

      // Update map markers
      if (state.maps.dispatcher) {
        Object.values(state.vehicleMarkers).forEach(m => m.remove());
        state.vehicleMarkers = {};
        renderVehicleMarkers(state.maps.dispatcher);
        renderVehiclePanel();
        renderDispatcherMapLayers();
      }
      if (state.maps.manager) {
        Object.values(state.vehicleMarkers).forEach(m => { if (m._map === state.maps.manager) m.remove(); });
        renderManagerMapLayers();
      }
    }, 4000);
  }

  function renderDispatcherOrders() {
    const orders = Data.getOrders().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const el = document.getElementById('disp-orders-list');
    if (!orders.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>Нет нарядов</p></div>';
      return;
    }
    el.innerHTML = orders.map(o => {
      const vehicle = Data.getVehicleById(o.vehicleId) || {};
      const driver = Data.getUserById(o.driverId) || {};
      const visits = Data.getVisitsByOrder(o.id);
      const done = visits.filter(v => v.status === 'completed').length;
      const hasPhoto = visits.some(v => v.photoBefore || v.photoAfter);
      return `<div class="order-item status-${o.status}" onclick="App.openOrderModal('${o.id}')">
        <div class="order-num">Наряд №${o.number} · ${fmtDate(o.date)}</div>
        <div class="order-title">📍 ${o.district} район</div>
        <div class="order-meta">
          <span>🚛 ${vehicle.number || '—'}</span>
          <span>👤 ${driver.name ? driver.name.split(' ').slice(0, 2).join(' ') : '—'}</span>
          <span>📍 ${done}/${visits.length}</span>
          ${hasPhoto ? '<span>📸 Есть фото</span>' : ''}
          <span><span class="badge badge-${o.status === 'completed' ? 'success' : o.status === 'in_progress' ? 'warning' : 'pending'}">${orderStatusLabel(o.status)}</span></span>
        </div>
      </div>`;
    }).join('');
  }

  function openOrderModal(orderId) {
    const order = Data.getOrderById(orderId);
    if (!order) return;
    const visits = Data.getVisitsByOrder(orderId);
    const vehicle = Data.getVehicleById(order.vehicleId) || {};
    const driver = Data.getUserById(order.driverId) || {};

    document.getElementById('modal-order-title').textContent = `Наряд №${order.number} · ${order.district}`;
    document.getElementById('modal-order-body').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
        <div><div style="font-size:11px;color:var(--text-muted);font-weight:700">ВОДИТЕЛЬ</div><div style="font-size:14px;font-weight:600">${driver.name || '—'}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);font-weight:700">ТРАНСПОРТ</div><div style="font-size:14px;font-weight:600">${vehicle.number || '—'}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);font-weight:700">ДАТА</div><div style="font-size:14px">${fmtDate(order.date)}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);font-weight:700">СТАТУС</div><span class="badge badge-${order.status === 'completed' ? 'success' : order.status === 'in_progress' ? 'warning' : 'pending'}">${orderStatusLabel(order.status)}</span></div>
      </div>
      ${order.notes ? `<div style="padding:10px 12px;background:var(--bg);border-radius:8px;font-size:13px;margin-bottom:14px">📝 ${order.notes}</div>` : ''}
      <div style="font-size:13px;font-weight:700;color:var(--text-muted);margin-bottom:8px">ПЛОЩАДКИ (${visits.filter(v => v.status === 'completed').length}/${visits.length} выполнено)</div>
      <div class="site-list" style="border:1px solid var(--border);border-radius:8px;overflow:hidden">
        ${order.sites.map((siteId, i) => {
          const site = Data.getSiteById(siteId);
          const visit = visits.find(v => v.siteId === siteId);
          const st = visit ? visit.status : 'pending';
          const hasPhoto = visit && (visit.photoBefore || visit.photoAfter);
          return `<div class="site-row" ${hasPhoto ? `onclick="App.openPhotoModal('${order.id}','${siteId}')"` : ''} style="${hasPhoto ? 'cursor:pointer' : ''}">
            <div class="site-num ${st === 'completed' ? 'done' : st === 'in_progress' ? 'active' : st === 'skipped' ? 'skip' : ''}">${st === 'completed' ? '✓' : st === 'skipped' ? '✗' : i + 1}</div>
            <div class="site-info">
              <div class="site-name">${site ? site.name : siteId}</div>
              ${visit && visit.arrivedAt ? `<div class="site-time">Прибыл: ${fmt(visit.arrivedAt)}${visit.completedAt ? ' · Выполнен: ' + fmt(visit.completedAt) : ''}</div>` : ''}
            </div>
            <div style="display:flex;gap:6px;align-items:center">
              ${hasPhoto ? '<span title="Есть фотоотчёт">📸</span>' : ''}
              <span class="badge badge-${st === 'completed' ? 'success' : st === 'in_progress' ? 'warning' : st === 'skipped' ? 'danger' : 'pending'}">${statusLabel(st)}</span>
            </div>
          </div>`;
        }).join('')}
      </div>`;
    document.getElementById('modal-order').classList.add('show');
  }

  function openPhotoModal(orderId, siteId) {
    const visit = Data.getVisit(orderId, siteId);
    const site = Data.getSiteById(siteId);
    if (!visit) return;
    document.getElementById('modal-photo-title').textContent = `Фотоотчёт — ${site ? site.name : siteId}`;

    const before = document.getElementById('modal-photo-before');
    const beforeEmpty = document.getElementById('modal-photo-before-empty');
    const after = document.getElementById('modal-photo-after');
    const afterEmpty = document.getElementById('modal-photo-after-empty');

    if (visit.photoBefore) { before.src = visit.photoBefore; before.style.display = ''; beforeEmpty.style.display = 'none'; }
    else { before.style.display = 'none'; beforeEmpty.style.display = ''; }

    if (visit.photoAfter) { after.src = visit.photoAfter; after.style.display = ''; afterEmpty.style.display = 'none'; }
    else { after.style.display = 'none'; afterEmpty.style.display = ''; }

    document.getElementById('modal-photo-meta').innerHTML =
      `📍 ${visit.lat ? visit.lat.toFixed(5) + ', ' + visit.lng.toFixed(5) : '—'}&nbsp;&nbsp;🕐 Прибыл: ${fmtFull(visit.arrivedAt)}&nbsp;&nbsp;✅ Выполнен: ${fmtFull(visit.completedAt)}`;

    closeModal('modal-order');
    document.getElementById('modal-photo').classList.add('show');
  }

  function closeModal(id) {
    document.getElementById(id).classList.remove('show');
  }

  function renderViolations() {
    const violations = Data.getViolations().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const el = document.getElementById('violations-list');
    if (!violations.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div><p>Нарушений не зафиксировано</p></div>';
      return;
    }
    el.innerHTML = violations.map(v => {
      const site = Data.getSiteById(v.siteId);
      const driver = Data.getUserById(v.driverId);
      return `<div class="violation-item">
        <div class="viol-title">⚠️ ${violTypeLabel(v.type)}</div>
        <div class="viol-meta">
          📍 ${site ? site.name : v.siteId}&nbsp;&nbsp;
          👤 ${driver ? driver.name : '—'}&nbsp;&nbsp;
          🕐 ${fmtFull(v.timestamp)}<br>
          ${v.description}
        </div>
      </div>`;
    }).join('');
  }

  // ─── Order form ───────────────────────────────────────────
  function initOrderForm() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('order-date').value = today;

    const driverSel = document.getElementById('order-driver');
    const vehicleSel = document.getElementById('order-vehicle');
    Data.getDrivers().forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.name;
      driverSel.appendChild(opt);
    });
    Data.getVehicles().forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = `${v.number} (${v.model})`;
      vehicleSel.appendChild(opt);
    });

    // Link driver to vehicle
    driverSel.addEventListener('change', () => {
      const driver = Data.getUserById(driverSel.value);
      if (driver && driver.vehicleId) vehicleSel.value = driver.vehicleId;
    });

    renderSiteCheckboxes();

    // Filter by district
    document.getElementById('order-district').addEventListener('change', renderSiteCheckboxes);
  }

  function renderSiteCheckboxes() {
    const district = document.getElementById('order-district').value;
    const sites = Data.getSites().filter(s => !district || s.district === district);
    const el = document.getElementById('site-checkbox-list');
    el.innerHTML = sites.map(s => `
      <div class="site-checkbox-item">
        <input type="checkbox" id="site-cb-${s.id}" value="${s.id}">
        <label for="site-cb-${s.id}">${s.name} · ${s.district}</label>
      </div>`).join('');
  }

  function createOrder() {
    const date = document.getElementById('order-date').value;
    const district = document.getElementById('order-district').value;
    const driverId = document.getElementById('order-driver').value;
    const vehicleId = document.getElementById('order-vehicle').value;
    const notes = document.getElementById('order-notes').value.trim();
    const sites = [...document.querySelectorAll('#site-checkbox-list input:checked')].map(i => i.value);

    if (!date || !district || !driverId || !vehicleId || !sites.length) {
      toast('⚠️ Заполните все обязательные поля и выберите площадки', 'warning');
      return;
    }

    const order = Data.createOrder({ date, district, driverId, vehicleId, sites, notes, status: 'pending', createdBy: state.user.id });

    // create visit stubs
    sites.forEach(siteId => {
      Data.createVisit({ orderId: order.id, siteId, vehicleId, status: 'pending', arrivedAt: null, completedAt: null, photoBefore: null, photoAfter: null, lat: null, lng: null });
    });

    toast(`✅ Наряд №${order.number} создан и отправлен водителю!`, 'success', 4000);
    resetOrderForm();
    renderDispatcherOrders();
    showTab('dispatcher', 'disp-orders');
  }

  function resetOrderForm() {
    document.getElementById('order-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('order-district').value = '';
    document.getElementById('order-driver').value = '';
    document.getElementById('order-vehicle').value = '';
    document.getElementById('order-notes').value = '';
    renderSiteCheckboxes();
  }

  // ─── MANAGER ──────────────────────────────────────────────
  function initManager(user) {
    document.getElementById('manager-avatar').textContent = user.name[0];
    document.getElementById('manager-username').textContent = user.name;
    showScreen('manager');
    renderStats();
    renderKPI();
    document.getElementById('report-date').value = new Date().toISOString().split('T')[0];
    startVehicleSimulation();
  }

  function renderStats() {
    const s = Data.getStats();
    const grid = document.getElementById('stats-grid');
    grid.innerHTML = [
      { icon: '📋', value: s.todayOrders, label: 'Нарядов сегодня' },
      { icon: '✅', value: s.completedOrders, label: 'Выполнено нарядов' },
      { icon: '▶️', value: s.inProgressOrders, label: 'В работе' },
      { icon: '📍', value: s.completedVisits, label: 'Площадок обслужено' },
      { icon: '⛔', value: s.skippedVisits, label: 'Пропущено' },
      { icon: '⚠️', value: s.violations, label: 'Нарушений' }
    ].map(s => `<div class="stat-card"><div class="stat-icon">${s.icon}</div><div class="stat-value">${s.value}</div><div class="stat-label">${s.label}</div></div>`).join('');

    renderCharts(s);
  }

  function renderCharts(stats) {
    // Week chart
    const weekLabels = [];
    const weekData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const dateStr = d.toISOString().split('T')[0];
      weekLabels.push(d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' }));
      const dayOrders = Data.getOrders().filter(o => o.date === dateStr);
      const dayVisits = Data.getVisits().filter(v => dayOrders.find(o => o.id === v.orderId) && v.status === 'completed');
      weekData.push(dayVisits.length);
    }

    if (state.chartWeek) state.chartWeek.destroy();
    state.chartWeek = new Chart(document.getElementById('chart-week'), {
      type: 'bar',
      data: {
        labels: weekLabels,
        datasets: [{ label: 'Площадок', data: weekData, backgroundColor: '#1565C0', borderRadius: 6 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });

    // Status donut
    if (state.chartStatus) state.chartStatus.destroy();
    state.chartStatus = new Chart(document.getElementById('chart-status'), {
      type: 'doughnut',
      data: {
        labels: ['Выполнено', 'В работе', 'Не начато'],
        datasets: [{ data: [stats.completedOrders, stats.inProgressOrders, stats.todayOrders - stats.completedOrders - stats.inProgressOrders], backgroundColor: ['#43A047', '#FB8C00', '#9E9E9E'], borderWidth: 0 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, cutout: '65%' }
    });
  }

  function renderKPI() {
    const drivers = Data.getDrivers();
    const orders = Data.getTodayOrders();
    const visits = Data.getVisits();
    const violations = Data.getViolations();
    const tbody = document.getElementById('kpi-tbody');

    tbody.innerHTML = drivers.map(driver => {
      const order = orders.find(o => o.driverId === driver.id);
      const driverVisits = order ? visits.filter(v => v.orderId === order.id) : [];
      const done = driverVisits.filter(v => v.status === 'completed').length;
      const skipped = driverVisits.filter(v => v.status === 'skipped').length;
      const photos = driverVisits.filter(v => v.photoBefore || v.photoAfter).length;
      const viols = violations.filter(v => v.driverId === driver.id && order && v.orderId === order.id).length;
      const vehicle = Data.getVehicleByDriver(driver.id);
      const score = order ? Math.max(0, Math.round((done / Math.max(driverVisits.length, 1)) * 100 - viols * 10)) : '—';
      const scoreColor = typeof score === 'number' ? (score >= 80 ? '#43A047' : score >= 50 ? '#FB8C00' : '#E53935') : '#9E9E9E';
      return `<tr>
        <td><b>${driver.name}</b></td>
        <td>${vehicle ? vehicle.number : '—'}</td>
        <td>${order ? `№${order.number}` : '—'}</td>
        <td style="color:var(--success);font-weight:700">${done}</td>
        <td style="color:${skipped > 0 ? 'var(--danger)' : 'var(--text-muted)'};font-weight:${skipped > 0 ? 700 : 400}">${skipped}</td>
        <td>📸 ${photos}</td>
        <td style="color:${viols > 0 ? 'var(--danger)' : 'var(--text-muted)'}">${viols}</td>
        <td><span style="font-weight:800;color:${scoreColor};font-size:16px">${score}${typeof score === 'number' ? '%' : ''}</span></td>
      </tr>`;
    }).join('');
  }

  function initManagerMap() {
    if (state.maps.manager) { state.maps.manager.invalidateSize(); renderManagerMapLayers(); return; }
    const map = L.map('manager-map').setView([52.9620, 63.1280], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19
    }).addTo(map);
    state.maps.manager = map;
    renderManagerMapLayers();
  }

  function renderManagerMapLayers() {
    const map = state.maps.manager;
    if (!map) return;
    const _mgrLayers = [];
    map.eachLayer(l => { if (l instanceof L.Marker || l instanceof L.CircleMarker) _mgrLayers.push(l); });
    _mgrLayers.forEach(l => map.removeLayer(l));

    const sites = Data.getSites();
    const visits = Data.getVisits();
    const todayOrders = Data.getTodayOrders();
    sites.forEach(site => {
      let status = 'pending';
      todayOrders.forEach(order => {
        if (order.sites.includes(site.id)) {
          const visit = visits.find(v => v.orderId === order.id && v.siteId === site.id);
          if (visit) status = visit.status;
        }
      });
      const color = status === 'completed' ? '#43A047' : status === 'in_progress' ? '#FB8C00' : status === 'skipped' ? '#E53935' : '#9E9E9E';
      L.circleMarker([site.lat, site.lng], { radius: 9, color: '#fff', weight: 2, fillColor: color, fillOpacity: 0.9 })
        .bindPopup(`<b>${site.name}</b><br>${statusLabel(status)}`)
        .addTo(map);
    });

    Data.getVehicles().forEach(v => {
      const driver = Data.getUserById(v.driverId);
      const icon = L.divIcon({
        html: `<div style="background:#1565C0;color:#fff;border-radius:8px;padding:2px 6px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.3)">🚛 ${v.number}</div>`,
        className: '', iconAnchor: [30, 14]
      });
      L.marker([v.lat, v.lng], { icon }).bindPopup(`<b>${v.number}</b><br>${driver ? driver.name : '—'}`).addTo(map);
    });
    if (state.mgrHeatLayer) { map.removeLayer(state.mgrHeatLayer); state.mgrHeatLayer = null; }
    const mgrViolations = Data.getViolations();
    if (mgrViolations.length && typeof L.heatLayer !== 'undefined') {
      const pts = mgrViolations.map(v => { const s = Data.getSiteById(v.siteId); return s ? [s.lat, s.lng, 1] : null; }).filter(Boolean);
      if (pts.length) state.mgrHeatLayer = L.heatLayer(pts, { radius: 35, blur: 25, maxZoom: 17, gradient: { 0.4: '#FFC107', 0.7: '#FF5722', 1: '#B71C1C' } }).addTo(map);
    }
  }

  // ─── Report ───────────────────────────────────────────────
  function generateReport() {
    const date = document.getElementById('report-date').value;
    if (!date) return;
    const orders = Data.getOrders().filter(o => o.date === date);
    const visits = Data.getVisits();
    const violations = Data.getViolations();

    let totalSites = 0, doneSites = 0, skippedSites = 0, photoCount = 0;
    orders.forEach(o => {
      const v = visits.filter(vi => vi.orderId === o.id);
      totalSites += v.length;
      doneSites += v.filter(vi => vi.status === 'completed').length;
      skippedSites += v.filter(vi => vi.status === 'skipped').length;
      photoCount += v.filter(vi => vi.photoBefore || vi.photoAfter).length;
    });

    const dayViolations = violations.filter(v => {
      const o = orders.find(o => o.id === v.orderId);
      return !!o;
    });

    const el = document.getElementById('report-content');
    el.innerHTML = `
      <div style="font-size:17px;font-weight:800;margin-bottom:4px">Суточный отчёт — ${new Date(date + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:20px">г. Рудный · Составлен: ${new Date().toLocaleString('ru-RU')}</div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:20px">
        ${[
          ['📋', orders.length, 'Нарядов'],
          ['✅', orders.filter(o => o.status === 'completed').length, 'Выполнено'],
          ['📍', doneSites, 'Площадок обслужено'],
          ['⛔', skippedSites, 'Пропущено'],
          ['📸', photoCount, 'Фотоотчётов'],
          ['⚠️', dayViolations.length, 'Нарушений']
        ].map(([icon, val, label]) => `
          <div style="background:var(--bg);border-radius:10px;padding:12px;text-align:center">
            <div style="font-size:22px">${icon}</div>
            <div style="font-size:24px;font-weight:800;color:var(--primary)">${val}</div>
            <div style="font-size:11px;color:var(--text-muted)">${label}</div>
          </div>`).join('')}
      </div>

      <table>
        <thead><tr><th>Наряд</th><th>Район</th><th>Водитель</th><th>ТС</th><th>Площадок</th><th>Выполнено</th><th>Пропущено</th><th>Статус</th></tr></thead>
        <tbody>
          ${orders.map(o => {
            const v = visits.filter(vi => vi.orderId === o.id);
            const driver = Data.getUserById(o.driverId);
            const vehicle = Data.getVehicleById(o.vehicleId);
            return `<tr>
              <td>№${o.number}</td>
              <td>${o.district}</td>
              <td>${driver ? driver.name.split(' ').slice(0, 2).join(' ') : '—'}</td>
              <td>${vehicle ? vehicle.number : '—'}</td>
              <td>${v.length}</td>
              <td style="color:var(--success);font-weight:700">${v.filter(vi => vi.status === 'completed').length}</td>
              <td style="color:${v.filter(vi => vi.status === 'skipped').length > 0 ? 'var(--danger)' : 'var(--text-muted)'}">${v.filter(vi => vi.status === 'skipped').length}</td>
              <td><span class="badge badge-${o.status === 'completed' ? 'success' : o.status === 'in_progress' ? 'warning' : 'pending'}">${orderStatusLabel(o.status)}</span></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>

      ${dayViolations.length ? `
        <div style="margin-top:20px;font-size:14px;font-weight:700;margin-bottom:8px">⚠️ Нарушения (${dayViolations.length})</div>
        ${dayViolations.map(v => {
          const site = Data.getSiteById(v.siteId);
          const driver = Data.getUserById(v.driverId);
          return `<div style="padding:8px 12px;background:#FFF3E0;border-radius:8px;border-left:3px solid var(--warning);margin-bottom:6px;font-size:13px">
            <b>${violTypeLabel(v.type)}</b> · ${site ? site.name : ''} · ${driver ? driver.name.split(' ').slice(0, 2).join(' ') : ''} · ${fmtFull(v.timestamp)}
          </div>`;
        }).join('')}` : ''}`;
  }

  function printReport() {
    window.print();
  }

  function exportCSV() {
    const date = document.getElementById('report-date').value || new Date().toISOString().split('T')[0];
    const orders = Data.getOrders().filter(o => o.date === date);
    const visits = Data.getVisits();
    const rows = [['Наряд', 'Район', 'Водитель', 'ТС', 'Площадка', 'Адрес', 'Статус', 'Прибыл', 'Выполнен', 'Фото']];
    orders.forEach(o => {
      const driver = Data.getUserById(o.driverId);
      const vehicle = Data.getVehicleById(o.vehicleId);
      o.sites.forEach(siteId => {
        const site = Data.getSiteById(siteId);
        const visit = visits.find(v => v.orderId === o.id && v.siteId === siteId);
        rows.push([
          `№${o.number}`, o.district,
          driver ? driver.name : '', vehicle ? vehicle.number : '',
          site ? site.name : siteId, site ? site.address : '',
          statusLabel(visit ? visit.status : 'pending'),
          fmt(visit ? visit.arrivedAt : null), fmt(visit ? visit.completedAt : null),
          visit && (visit.photoBefore || visit.photoAfter) ? 'Да' : 'Нет'
        ]);
      });
    });

    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tbo-report-${date}.csv`;
    a.click();
    toast('📊 CSV файл скачан', 'success');
  }

  // ─── ADMIN PANEL ─────────────────────────────────────────
  let _adminSaveFn = null;
  const _ROLES = { driver: '🚗 Водитель', dispatcher: '🖥️ Диспетчер', manager: '📊 Руководитель', admin: '⚙️ Администратор' };

  function initAdmin(user) {
    document.getElementById('admin-avatar').textContent = user.name[0];
    document.getElementById('admin-username').textContent = user.name;
    const backBtn = document.getElementById('admin-back-btn');
    if (backBtn) backBtn.style.display = user.role === 'dispatcher' ? '' : 'none';
    showScreen('admin');
    renderAdminPersonnel(); renderAdminVehicles(); renderAdminSites();
    renderAdminOrders(); renderAdminRoles(); renderAdminStatuses();
  }

  function renderAdminPersonnel() {
    const vehs = Data.getVehicles();
    document.getElementById('admin-personnel-tbody').innerHTML = Data.getUsers().map(u => {
      const veh = vehs.find(v => v.driverId === u.id);
      return `<tr><td><b>${u.name}</b></td><td><code>${u.username}</code></td><td>${_ROLES[u.role]||u.role}</td><td>${veh?veh.number:'—'}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-outline btn-sm" onclick="App.adminEditUser('${u.id}')">✏️</button>
          ${u.id!=='u0'?`<button class="btn btn-sm" style="background:#E53935;color:#fff;margin-left:4px" onclick="App.adminDeleteUser('${u.id}')">🗑️</button>`:''}
        </td></tr>`;
    }).join('');
  }

  function adminAddUser() {
    _openAdminForm('+ Добавить сотрудника', _userFormHtml(), () => {
      const d = _readUserForm(); if (!d) return;
      const user = Data.addUser({ name: d.name, username: d.username, password: d.password, role: d.role });
      if (d.vehicleId) { Data.updateVehicle(d.vehicleId, { driverId: user.id }); Data.updateUser(user.id, { vehicleId: d.vehicleId }); }
      toast('✅ Сотрудник добавлен', 'success');
      closeModal('modal-admin-form'); renderAdminPersonnel(); renderAdminRoles();
    });
  }

  function adminEditUser(id) {
    const u = Data.getUserById(id); if (!u) return;
    const veh = Data.getVehicles().find(v => v.driverId === id);
    _openAdminForm('✏️ Редактировать сотрудника', _userFormHtml(u, veh ? veh.id : ''), () => {
      const d = _readUserForm(); if (!d) return;
      const upd = { name: d.name, username: d.username, role: d.role, vehicleId: d.vehicleId || undefined };
      if (d.password) upd.password = d.password;
      Data.updateUser(id, upd);
      if (d.vehicleId) Data.updateVehicle(d.vehicleId, { driverId: id });
      toast('✅ Сохранено', 'success');
      closeModal('modal-admin-form'); renderAdminPersonnel(); renderAdminRoles();
    });
  }

  function adminDeleteUser(id) {
    const u = Data.getUserById(id);
    if (!u || !confirm(`Удалить "${u.name}"?`)) return;
    Data.deleteUser(id); toast('Удалено', 'warning');
    renderAdminPersonnel(); renderAdminRoles();
  }

  function _userFormHtml(u = {}, vehicleId = '') {
    return `<div class="form-group"><label>Полное имя</label><input id="af-name" value="${u.name||''}" placeholder="Иванов Иван"></div>
      <div class="form-group"><label>Логин</label><input id="af-login" value="${u.username||''}" placeholder="login"></div>
      <div class="form-group"><label>Пароль${u.id?' (пусто = не менять)':''}</label><input id="af-pass" type="password" placeholder="${u.id?'••••':'пароль'}"></div>
      <div class="form-group"><label>Роль</label><select id="af-role">${Object.entries(_ROLES).map(([v,l])=>`<option value="${v}"${u.role===v?' selected':''}>${l}</option>`).join('')}</select></div>
      <div class="form-group"><label>Привязать ТС</label><select id="af-vehicle"><option value="">— Нет —</option>${Data.getVehicles().map(v=>`<option value="${v.id}"${vehicleId===v.id?' selected':''}>${v.number} (${v.model})</option>`).join('')}</select></div>`;
  }

  function _readUserForm() {
    const name = document.getElementById('af-name').value.trim();
    const username = document.getElementById('af-login').value.trim();
    if (!name || !username) { toast('Заполните имя и логин', 'warning'); return null; }
    return { name, username, password: document.getElementById('af-pass').value, role: document.getElementById('af-role').value, vehicleId: document.getElementById('af-vehicle').value };
  }

  function renderAdminVehicles() {
    const stTxt = { idle: 'Простой', en_route: 'В пути', at_site: 'На объекте' };
    document.getElementById('admin-vehicles-tbody').innerHTML = Data.getVehicles().map(v => {
      const d = Data.getUserById(v.driverId);
      return `<tr><td><b>${v.number}</b></td><td>${v.model}</td><td>${d?d.name.split(' ').slice(0,2).join(' '):'—'}</td><td>${stTxt[v.status]||v.status}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-outline btn-sm" onclick="App.adminEditVehicle('${v.id}')">✏️</button>
          <button class="btn btn-sm" style="background:#E53935;color:#fff;margin-left:4px" onclick="App.adminDeleteVehicle('${v.id}')">🗑️</button>
        </td></tr>`;
    }).join('');
  }

  function adminAddVehicle() {
    _openAdminForm('+ Добавить технику', _vehicleFormHtml(), () => {
      const d = _readVehicleForm(); if (!d) return;
      const veh = Data.addVehicle({ ...d, lat: 52.9578, lng: 63.1283, speed: 0, status: 'idle', heading: 0, fuel: 100 });
      if (d.driverId) Data.updateUser(d.driverId, { vehicleId: veh.id });
      toast('✅ Техника добавлена', 'success');
      closeModal('modal-admin-form'); renderAdminVehicles();
    });
  }

  function adminEditVehicle(id) {
    const v = Data.getVehicleById(id); if (!v) return;
    _openAdminForm('✏️ Редактировать технику', _vehicleFormHtml(v), () => {
      const d = _readVehicleForm(); if (!d) return;
      Data.updateVehicle(id, d);
      if (d.driverId) Data.updateUser(d.driverId, { vehicleId: id });
      toast('✅ Сохранено', 'success');
      closeModal('modal-admin-form'); renderAdminVehicles();
    });
  }

  function adminDeleteVehicle(id) {
    const v = Data.getVehicleById(id);
    if (!v || !confirm(`Удалить "${v.number}"?`)) return;
    Data.deleteVehicle(id); toast('Удалено', 'warning'); renderAdminVehicles();
  }

  function _vehicleFormHtml(v = {}) {
    return `<div class="form-group"><label>Гос. номер</label><input id="vf-num" value="${v.number||''}" placeholder="А123ВС"></div>
      <div class="form-group"><label>Модель</label><input id="vf-model" value="${v.model||''}" placeholder="КамАЗ-5320"></div>
      <div class="form-group"><label>Водитель</label><select id="vf-driver"><option value="">— Не назначен —</option>${Data.getDrivers().map(u=>`<option value="${u.id}"${v.driverId===u.id?' selected':''}>${u.name}</option>`).join('')}</select></div>`;
  }

  function _readVehicleForm() {
    const number = document.getElementById('vf-num').value.trim();
    const model = document.getElementById('vf-model').value.trim();
    if (!number || !model) { toast('Заполните номер и модель', 'warning'); return null; }
    return { number, model, driverId: document.getElementById('vf-driver').value || undefined };
  }

  function renderAdminSites() {
    document.getElementById('admin-sites-tbody').innerHTML = Data.getSites().map(s => `<tr>
      <td><b>${s.name}</b></td><td>${s.district}</td><td style="font-size:12px">${s.address}</td><td>${s.geofenceRadius}м</td>
      <td style="white-space:nowrap">
        <button class="btn btn-outline btn-sm" onclick="App.adminEditSite('${s.id}')">✏️</button>
        <button class="btn btn-sm" style="background:#E53935;color:#fff;margin-left:4px" onclick="App.adminDeleteSite('${s.id}')">🗑️</button>
      </td></tr>`).join('');
  }

  function adminAddSite() {
    _openAdminForm('+ Добавить площадку', _siteFormHtml(), () => {
      const d = _readSiteForm(); if (!d) return;
      Data.addSite(d); toast('✅ Площадка добавлена', 'success');
      closeModal('modal-admin-form'); renderAdminSites();
    });
  }

  function adminEditSite(id) {
    const s = Data.getSiteById(id); if (!s) return;
    _openAdminForm('✏️ Редактировать площадку', _siteFormHtml(s), () => {
      const d = _readSiteForm(); if (!d) return;
      Data.updateSite(id, d); toast('✅ Сохранено', 'success');
      closeModal('modal-admin-form'); renderAdminSites();
    });
  }

  function adminDeleteSite(id) {
    const s = Data.getSiteById(id);
    if (!s || !confirm(`Удалить "${s.name}"?`)) return;
    Data.deleteSite(id); toast('Удалено', 'warning'); renderAdminSites();
  }

  function _siteFormHtml(s = {}) {
    const dists = ['Северный','Центральный','Южный','Западный','Восточный'];
    return `<div class="form-group"><label>Название</label><input id="sf-name" value="${s.name||''}" placeholder="мкр. Северный, д.5"></div>
      <div class="form-group"><label>Адрес</label><input id="sf-addr" value="${s.address||''}" placeholder="Полный адрес"></div>
      <div class="form-row">
        <div class="form-group"><label>Район</label><select id="sf-district">${dists.map(d=>`<option${s.district===d?' selected':''}>${d}</option>`).join('')}</select></div>
        <div class="form-group"><label>Радиус (м)</label><input id="sf-radius" type="number" value="${s.geofenceRadius||80}" min="20" max="300"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Широта</label><input id="sf-lat" type="number" step="0.0001" value="${s.lat||52.9578}"></div>
        <div class="form-group"><label>Долгота</label><input id="sf-lng" type="number" step="0.0001" value="${s.lng||63.1283}"></div>
      </div>`;
  }

  function _readSiteForm() {
    const name = document.getElementById('sf-name').value.trim();
    const lat = parseFloat(document.getElementById('sf-lat').value);
    const lng = parseFloat(document.getElementById('sf-lng').value);
    if (!name || isNaN(lat) || isNaN(lng)) { toast('Заполните название и координаты', 'warning'); return null; }
    return { name, address: document.getElementById('sf-addr').value.trim()||name, district: document.getElementById('sf-district').value, lat, lng, geofenceRadius: parseInt(document.getElementById('sf-radius').value)||80 };
  }

  function renderAdminOrders() {
    document.getElementById('admin-orders-tbody').innerHTML = Data.getOrders()
      .sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)).map(o => {
        const driver = Data.getUserById(o.driverId); const vehicle = Data.getVehicleById(o.vehicleId);
        const visits = Data.getVisitsByOrder(o.id); const done = visits.filter(v=>v.status==='completed').length;
        return `<tr><td><b>№${o.number}</b></td><td>${fmtDate(o.date)}</td><td>${o.district}</td>
          <td>${driver?driver.name.split(' ').slice(0,2).join(' '):'—'}</td><td>${vehicle?vehicle.number:'—'}</td>
          <td>${done}/${visits.length}</td>
          <td><span class="badge badge-${o.status==='completed'?'success':o.status==='in_progress'?'warning':'pending'}">${orderStatusLabel(o.status)}</span></td>
          <td><button class="btn btn-sm" style="background:#E53935;color:#fff" onclick="App.adminDeleteOrder('${o.id}')">🗑️</button></td></tr>`;
      }).join('');
  }

  function adminDeleteOrder(id) {
    const o = Data.getOrderById(id);
    if (!o || !confirm(`Удалить наряд №${o.number}?`)) return;
    Data.deleteOrder(id); toast('Наряд удалён', 'warning');
    renderAdminOrders(); renderAdminStatuses();
  }

  function renderAdminRoles() {
    document.getElementById('admin-roles-tbody').innerHTML = Data.getUsers().map(u => `<tr>
      <td><b>${u.name}</b></td><td><code>${u.username}</code></td><td>${_ROLES[u.role]||u.role}</td>
      <td><select style="padding:4px 8px;font-size:13px;border:1.5px solid var(--border);border-radius:8px" onchange="App.adminChangeRole('${u.id}',this.value)">
        ${Object.entries(_ROLES).map(([v,l])=>`<option value="${v}"${u.role===v?' selected':''}>${l}</option>`).join('')}
      </select></td></tr>`).join('');
  }

  function adminChangeRole(id, role) {
    Data.updateUser(id, { role }); toast('✅ Роль обновлена', 'success');
    renderAdminPersonnel(); renderAdminRoles();
  }

  function renderAdminStatuses() {
    document.getElementById('admin-status-tbody').innerHTML = Data.getOrders()
      .sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)).map(o => {
        const driver = Data.getUserById(o.driverId);
        return `<tr><td><b>№${o.number}</b></td><td>${fmtDate(o.date)}</td>
          <td>${driver?driver.name.split(' ').slice(0,2).join(' '):'—'}</td>
          <td><span class="badge badge-${o.status==='completed'?'success':o.status==='in_progress'?'warning':'pending'}">${orderStatusLabel(o.status)}</span></td>
          <td><select style="padding:4px 8px;font-size:13px;border:1.5px solid var(--border);border-radius:8px" onchange="App.adminChangeOrderStatus('${o.id}',this.value)">
            ${['pending','in_progress','completed'].map(s=>`<option value="${s}"${o.status===s?' selected':''}>${orderStatusLabel(s)}</option>`).join('')}
          </select></td></tr>`;
      }).join('');
    const sel = document.getElementById('admin-visit-order-sel');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">— Выберите наряд —</option>' +
      Data.getOrders().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))
        .map(o=>`<option value="${o.id}"${o.id===cur?' selected':''}>№${o.number} · ${fmtDate(o.date)} · ${o.district}</option>`).join('');
  }

  function adminChangeOrderStatus(id, status) {
    Data.updateOrder(id, { status }); toast('✅ Статус обновлён', 'success'); renderAdminStatuses();
  }

  function renderAdminVisitStatuses() {
    const orderId = document.getElementById('admin-visit-order-sel').value;
    const tbody = document.getElementById('admin-visits-tbody');
    if (!orderId) { tbody.innerHTML = ''; return; }
    tbody.innerHTML = Data.getVisitsByOrder(orderId).map(v => {
      const site = Data.getSiteById(v.siteId);
      return `<tr><td>${site?site.name:v.siteId}</td>
        <td><span class="badge badge-${v.status==='completed'?'success':v.status==='in_progress'?'warning':v.status==='skipped'?'danger':'pending'}">${statusLabel(v.status)}</span></td>
        <td><select style="padding:4px 8px;font-size:13px;border:1.5px solid var(--border);border-radius:8px" onchange="App.adminChangeVisitStatus('${v.id}',this.value)">
          ${['pending','in_progress','completed','skipped'].map(s=>`<option value="${s}"${v.status===s?' selected':''}>${statusLabel(s)}</option>`).join('')}
        </select></td></tr>`;
    }).join('');
  }

  function adminChangeVisitStatus(id, status) {
    Data.updateVisit(id, { status }); toast('✅ Статус обновлён', 'success'); renderAdminVisitStatuses();
  }

  function _openAdminForm(title, html, saveFn) {
    document.getElementById('admin-form-title').textContent = title;
    document.getElementById('admin-form-body').innerHTML = html;
    _adminSaveFn = saveFn;
    document.getElementById('modal-admin-form').classList.add('show');
  }

  function adminFormSave() { if (_adminSaveFn) _adminSaveFn(); }

  // ─── Real-time UI refresh ────────────────────────────────
  function refreshUI(keys) {
    if (!state.user) return;
    if (state.user.role === 'driver') {
      renderDriverOrders();
      renderDriverActive();
      if (!keys || keys.includes('tbo_orders')) _checkNewOrders();
    } else if (state.user.role === 'dispatcher') {
      renderDispatcherOrders();
      renderViolations();
      renderVehiclePanel();
      if (state.maps.dispatcher) renderDispatcherMapLayers();
    } else if (state.user.role === 'manager') {
      renderStats();
      renderKPI();
    }
  }

  function _checkNewOrders() {
    if (!state.user) return;
    Data.getOrdersByDriver(state.user.id).forEach(order => {
      if (!state.knownOrderIds.has(order.id)) {
        state.knownOrderIds.add(order.id);
        if (order.status === 'pending') _notifyNewOrder(order);
      }
    });
  }

  function _notifyNewOrder(order) {
    toast(`🔔 Новый наряд №${order.number} · ${order.district}`, 'success', 6000);
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('ТБО Мониторинг — Новый наряд!', {
        body: `Наряд №${order.number} · ${order.district} район`
      });
    }
  }

  function panToVehicle(vehicleId) {
    const vehicle = Data.getVehicleById(vehicleId);
    if (!vehicle) return;
    if (!state.maps.dispatcher) initDispatcherMap();
    showTab('dispatcher', 'disp-map');
    document.querySelectorAll('#screen-dispatcher .tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === 'disp-map');
    });
    setTimeout(() => {
      state.maps.dispatcher.invalidateSize();
      state.maps.dispatcher.setView([vehicle.lat, vehicle.lng], 16, { animate: true });
      const marker = state.vehicleMarkers[vehicleId];
      if (marker) marker.openPopup();
    }, 150);
  }

  function exportExcel() {
    if (typeof XLSX === 'undefined') { toast('⚠️ Excel недоступен — перезагрузите страницу', 'warning'); return; }
    const date = document.getElementById('report-date').value || new Date().toISOString().split('T')[0];
    const orders = Data.getOrders().filter(o => o.date === date);
    const visits = Data.getVisits();
    const rows = [['Наряд', 'Район', 'Водитель', 'ТС', 'Площадка', 'Адрес', 'Статус', 'Прибыл', 'Выполнен', 'Фото']];
    orders.forEach(o => {
      const driver = Data.getUserById(o.driverId);
      const vehicle = Data.getVehicleById(o.vehicleId);
      o.sites.forEach(siteId => {
        const site = Data.getSiteById(siteId);
        const visit = visits.find(v => v.orderId === o.id && v.siteId === siteId);
        rows.push([
          `№${o.number}`, o.district,
          driver ? driver.name : '', vehicle ? vehicle.number : '',
          site ? site.name : siteId, site ? site.address : '',
          statusLabel(visit ? visit.status : 'pending'),
          fmt(visit ? visit.arrivedAt : null), fmt(visit ? visit.completedAt : null),
          visit && (visit.photoBefore || visit.photoAfter) ? 'Да' : 'Нет'
        ]);
      });
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 10 }, { wch: 12 }, { wch: 22 }, { wch: 12 },
      { wch: 28 }, { wch: 32 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 6 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Отчёт');
    XLSX.writeFile(wb, `tbo-report-${date}.xlsx`);
    toast('📗 Excel файл скачан', 'success');
  }

  // ─── Tab wiring ───────────────────────────────────────────
  function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        const screen = btn.dataset.screen;
        if (!tab || !screen) return;

        if (tab === 'driver-logout' || tab === 'disp-logout' || tab === 'mgr-logout' || tab === 'admin-logout') { logout(); return; }
        if (tab === 'disp-admin-open') { initAdmin(state.user); return; }
        if (tab === 'admin-back') { showScreen('dispatcher'); return; }
        showTab(screen, tab);

        // Lazy init maps and data
        if (tab === 'driver-map') { setTimeout(() => { initDriverMap(); state.maps.driver && state.maps.driver.invalidateSize(); }, 100); }
        if (tab === 'disp-map') { setTimeout(() => { initDispatcherMap(); state.maps.dispatcher && state.maps.dispatcher.invalidateSize(); }, 100); }
        if (tab === 'disp-orders') renderDispatcherOrders();
        if (tab === 'disp-violations') renderViolations();
        if (tab === 'disp-gps') { startGpsDiag(); } else { stopGpsDiag(); }
        if (tab === 'mgr-map') { setTimeout(() => { initManagerMap(); state.maps.manager && state.maps.manager.invalidateSize(); }, 100); }
        if (tab === 'mgr-stats') renderStats();
        if (tab === 'mgr-kpi') renderKPI();
      });
    });
  }

  // ─── Boot ─────────────────────────────────────────────────
  function init() {
    Data.init();
    initTabs();

    document.getElementById('btn-login').addEventListener('click', login);
    document.getElementById('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
    document.getElementById('btn-arrive').addEventListener('click', arrive);
    document.getElementById('btn-complete-site').addEventListener('click', completeSite);
    document.getElementById('btn-skip-site').addEventListener('click', skipSite);
    document.getElementById('btn-create-order').addEventListener('click', createOrder);

    // Close modal on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('show'); });
    });

    // Restore session
    const session = Data.getSession();
    if (session) {
      state.user = session;
      initRole(session);
    }

    let _syncDebounce = null;
    window.addEventListener('tbo-sync', e => {
      clearTimeout(_syncDebounce);
      _syncDebounce = setTimeout(() => refreshUI(e.detail && e.detail.keys), 300);
    });
  }

  return {
    init,
    selectDriverOrder,
    selectSite,
    handlePhoto,
    arrive,
    completeSite,
    skipSite,
    openOrderModal,
    openPhotoModal,
    closeModal,
    createOrder,
    resetOrderForm,
    generateReport,
    printReport,
    exportCSV,
    exportExcel,
    panToVehicle,
    adminAddUser, adminEditUser, adminDeleteUser,
    adminAddVehicle, adminEditVehicle, adminDeleteVehicle,
    adminAddSite, adminEditSite, adminDeleteSite,
    adminDeleteOrder, adminChangeRole, adminChangeOrderStatus,
    adminChangeVisitStatus, renderAdminVisitStatuses, adminFormSave,
    clearGpsLog
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  SupabaseSync.init(() => {
    App.init();
    SupabaseSync.startRealtime();
    SupabaseSync.startPolling();
  });
});
