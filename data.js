'use strict';

const DB_KEYS = {
  USERS: 'tbo_users',
  VEHICLES: 'tbo_vehicles',
  SITES: 'tbo_sites',
  ORDERS: 'tbo_orders',
  VISITS: 'tbo_visits',
  VIOLATIONS: 'tbo_violations',
  SESSION: 'tbo_session'
};

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function seedDatabase() {
  const users = [
    { id: 'u0', name: 'Администратор', role: 'admin', username: 'admin', password: 'admin' },
    { id: 'u1', name: 'Жаксыбекова Айгерим', role: 'dispatcher', username: 'dispatcher', password: '1234' },
    { id: 'u2', name: 'Ахметов Дулат (Директор)', role: 'manager', username: 'manager', password: '1234' },
    { id: 'u3', name: 'Петров Алексей', role: 'driver', username: 'driver1', password: '1234', vehicleId: 'v1' },
    { id: 'u4', name: 'Иванов Сергей', role: 'driver', username: 'driver2', password: '1234', vehicleId: 'v2' },
    { id: 'u5', name: 'Сейткали Нурлан', role: 'driver', username: 'driver3', password: '1234', vehicleId: 'v3' }
  ];

  const vehicles = [
    { id: 'v1', number: 'А123ВС', model: 'КамАЗ-5320', driverId: 'u3', lat: 52.9578, lng: 63.1283, speed: 0, status: 'en_route', heading: 45, fuel: 68 },
    { id: 'v2', number: 'В456ДЕ', model: 'МАЗ-500', driverId: 'u4', lat: 52.9635, lng: 63.1360, speed: 0, status: 'idle', heading: 180, fuel: 82 },
    { id: 'v3', number: 'С789ЖЗ', model: 'КамАЗ-5320', driverId: 'u5', lat: 52.9510, lng: 63.1195, speed: 0, status: 'idle', heading: 270, fuel: 45 }
  ];

  const sites = [
    { id: 's1', name: 'мкр. Северный, д. 5', address: 'мкр. Северный, 5', district: 'Северный', lat: 52.9660, lng: 63.1185, geofenceRadius: 80 },
    { id: 's2', name: 'мкр. Северный, д. 12', address: 'мкр. Северный, 12', district: 'Северный', lat: 52.9675, lng: 63.1225, geofenceRadius: 80 },
    { id: 's3', name: 'мкр. Северный, д. 18', address: 'мкр. Северный, 18', district: 'Северный', lat: 52.9690, lng: 63.1255, geofenceRadius: 80 },
    { id: 's4', name: 'мкр. Северный, д. 24', address: 'мкр. Северный, 24', district: 'Северный', lat: 52.9708, lng: 63.1280, geofenceRadius: 80 },
    { id: 's5', name: 'ул. Абая, 15', address: 'ул. Абая, 15', district: 'Центральный', lat: 52.9612, lng: 63.1201, geofenceRadius: 70 },
    { id: 's6', name: 'ул. Валиханова, 8', address: 'ул. Валиханова, 8', district: 'Центральный', lat: 52.9592, lng: 63.1248, geofenceRadius: 70 },
    { id: 's7', name: 'ул. Ауэзова, 22', address: 'ул. Ауэзова, 22', district: 'Центральный', lat: 52.9558, lng: 63.1290, geofenceRadius: 70 },
    { id: 's8', name: 'ул. Ленина, 45', address: 'ул. Ленина, 45', district: 'Центральный', lat: 52.9578, lng: 63.1325, geofenceRadius: 70 },
    { id: 's9', name: 'ул. Горняков, 3', address: 'ул. Горняков, 3', district: 'Южный', lat: 52.9540, lng: 63.1205, geofenceRadius: 90 },
    { id: 's10', name: 'ул. Горняков, 15', address: 'ул. Горняков, 15', district: 'Южный', lat: 52.9525, lng: 63.1245, geofenceRadius: 90 },
    { id: 's11', name: 'ул. Победы, 12', address: 'ул. Победы, 12', district: 'Южный', lat: 52.9512, lng: 63.1290, geofenceRadius: 90 },
    { id: 's12', name: 'ул. Шевченко, 7', address: 'ул. Шевченко, 7', district: 'Западный', lat: 52.9602, lng: 63.1105, geofenceRadius: 80 },
    { id: 's13', name: 'ул. Шевченко, 25', address: 'ул. Шевченко, 25', district: 'Западный', lat: 52.9582, lng: 63.1072, geofenceRadius: 80 },
    { id: 's14', name: 'мкр. Восточный, 3', address: 'мкр. Восточный, 3', district: 'Восточный', lat: 52.9572, lng: 63.1405, geofenceRadius: 80 },
    { id: 's15', name: 'мкр. Восточный, 8', address: 'мкр. Восточный, 8', district: 'Восточный', lat: 52.9558, lng: 63.1438, geofenceRadius: 80 }
  ];

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const twoDaysAgo = new Date(Date.now() - 172800000).toISOString().split('T')[0];

  const orders = [
    { id: 'o1', number: 125, date: today, district: 'Северный', vehicleId: 'v1', driverId: 'u3', sites: ['s1', 's2', 's3', 's4'], notes: 'Начать с дома 5. Осторожно у д.18 — яма на въезде.', status: 'in_progress', createdBy: 'u1', createdAt: new Date(Date.now() - 7200000).toISOString() },
    { id: 'o2', number: 126, date: today, district: 'Центральный', vehicleId: 'v2', driverId: 'u4', sites: ['s5', 's6', 's7', 's8'], notes: '', status: 'pending', createdBy: 'u1', createdAt: new Date(Date.now() - 3600000).toISOString() },
    { id: 'o3', number: 124, date: today, district: 'Южный', vehicleId: 'v3', driverId: 'u5', sites: ['s9', 's10', 's11'], notes: 'Ремонт дороги на ул. Горняков.', status: 'completed', createdBy: 'u1', createdAt: new Date(Date.now() - 10800000).toISOString() },
    { id: 'o4', number: 123, date: yesterday, district: 'Северный', vehicleId: 'v1', driverId: 'u3', sites: ['s1', 's2', 's3'], notes: '', status: 'completed', createdBy: 'u1', createdAt: new Date(Date.now() - 86400000 - 7200000).toISOString() },
    { id: 'o5', number: 122, date: yesterday, district: 'Центральный', vehicleId: 'v2', driverId: 'u4', sites: ['s5', 's6', 's7'], notes: '', status: 'completed', createdBy: 'u1', createdAt: new Date(Date.now() - 86400000 - 3600000).toISOString() },
    { id: 'o6', number: 121, date: twoDaysAgo, district: 'Западный', vehicleId: 'v3', driverId: 'u5', sites: ['s12', 's13'], notes: '', status: 'completed', createdBy: 'u1', createdAt: new Date(Date.now() - 172800000 - 3600000).toISOString() }
  ];

  const visits = [
    // Order o1 — in_progress
    { id: 'vis1', orderId: 'o1', siteId: 's1', vehicleId: 'v1', status: 'completed', arrivedAt: new Date(Date.now() - 5400000).toISOString(), completedAt: new Date(Date.now() - 5100000).toISOString(), photoBefore: null, photoAfter: null, lat: 52.9660, lng: 63.1185 },
    { id: 'vis2', orderId: 'o1', siteId: 's2', vehicleId: 'v1', status: 'in_progress', arrivedAt: new Date(Date.now() - 1800000).toISOString(), completedAt: null, photoBefore: null, photoAfter: null, lat: 52.9675, lng: 63.1225 },
    { id: 'vis3', orderId: 'o1', siteId: 's3', vehicleId: 'v1', status: 'pending', arrivedAt: null, completedAt: null, photoBefore: null, photoAfter: null, lat: null, lng: null },
    { id: 'vis4', orderId: 'o1', siteId: 's4', vehicleId: 'v1', status: 'pending', arrivedAt: null, completedAt: null, photoBefore: null, photoAfter: null, lat: null, lng: null },
    // Order o2 — pending
    { id: 'vis5', orderId: 'o2', siteId: 's5', vehicleId: 'v2', status: 'pending', arrivedAt: null, completedAt: null, photoBefore: null, photoAfter: null, lat: null, lng: null },
    { id: 'vis6', orderId: 'o2', siteId: 's6', vehicleId: 'v2', status: 'pending', arrivedAt: null, completedAt: null, photoBefore: null, photoAfter: null, lat: null, lng: null },
    { id: 'vis7', orderId: 'o2', siteId: 's7', vehicleId: 'v2', status: 'pending', arrivedAt: null, completedAt: null, photoBefore: null, photoAfter: null, lat: null, lng: null },
    { id: 'vis8', orderId: 'o2', siteId: 's8', vehicleId: 'v2', status: 'pending', arrivedAt: null, completedAt: null, photoBefore: null, photoAfter: null, lat: null, lng: null },
    // Order o3 — completed
    { id: 'vis9', orderId: 'o3', siteId: 's9', vehicleId: 'v3', status: 'completed', arrivedAt: new Date(Date.now() - 10200000).toISOString(), completedAt: new Date(Date.now() - 9900000).toISOString(), photoBefore: null, photoAfter: null, lat: 52.9540, lng: 63.1205 },
    { id: 'vis10', orderId: 'o3', siteId: 's10', vehicleId: 'v3', status: 'completed', arrivedAt: new Date(Date.now() - 9600000).toISOString(), completedAt: new Date(Date.now() - 9300000).toISOString(), photoBefore: null, photoAfter: null, lat: 52.9525, lng: 63.1245 },
    { id: 'vis11', orderId: 'o3', siteId: 's11', vehicleId: 'v3', status: 'skipped', arrivedAt: null, completedAt: null, photoBefore: null, photoAfter: null, lat: null, lng: null },
    // Yesterday orders
    { id: 'vis12', orderId: 'o4', siteId: 's1', vehicleId: 'v1', status: 'completed', arrivedAt: new Date(Date.now() - 86400000 - 5400000).toISOString(), completedAt: new Date(Date.now() - 86400000 - 5100000).toISOString(), photoBefore: null, photoAfter: null, lat: 52.9660, lng: 63.1185 },
    { id: 'vis13', orderId: 'o4', siteId: 's2', vehicleId: 'v1', status: 'completed', arrivedAt: new Date(Date.now() - 86400000 - 4500000).toISOString(), completedAt: new Date(Date.now() - 86400000 - 4200000).toISOString(), photoBefore: null, photoAfter: null, lat: 52.9675, lng: 63.1225 },
    { id: 'vis14', orderId: 'o4', siteId: 's3', vehicleId: 'v1', status: 'completed', arrivedAt: new Date(Date.now() - 86400000 - 3600000).toISOString(), completedAt: new Date(Date.now() - 86400000 - 3300000).toISOString(), photoBefore: null, photoAfter: null, lat: 52.9690, lng: 63.1255 },
    { id: 'vis15', orderId: 'o5', siteId: 's5', vehicleId: 'v2', status: 'completed', arrivedAt: new Date(Date.now() - 86400000 - 4000000).toISOString(), completedAt: new Date(Date.now() - 86400000 - 3700000).toISOString(), photoBefore: null, photoAfter: null, lat: 52.9612, lng: 63.1201 },
    { id: 'vis16', orderId: 'o5', siteId: 's6', vehicleId: 'v2', status: 'completed', arrivedAt: new Date(Date.now() - 86400000 - 3200000).toISOString(), completedAt: new Date(Date.now() - 86400000 - 2900000).toISOString(), photoBefore: null, photoAfter: null, lat: 52.9592, lng: 63.1248 },
    { id: 'vis17', orderId: 'o5', siteId: 's7', vehicleId: 'v2', status: 'skipped', arrivedAt: null, completedAt: null, photoBefore: null, photoAfter: null, lat: null, lng: null },
    { id: 'vis18', orderId: 'o6', siteId: 's12', vehicleId: 'v3', status: 'completed', arrivedAt: new Date(Date.now() - 172800000 - 3600000).toISOString(), completedAt: new Date(Date.now() - 172800000 - 3300000).toISOString(), photoBefore: null, photoAfter: null, lat: 52.9602, lng: 63.1105 },
    { id: 'vis19', orderId: 'o6', siteId: 's13', vehicleId: 'v3', status: 'completed', arrivedAt: new Date(Date.now() - 172800000 - 2800000).toISOString(), completedAt: new Date(Date.now() - 172800000 - 2500000).toISOString(), photoBefore: null, photoAfter: null, lat: 52.9582, lng: 63.1072 }
  ];

  const violations = [
    { id: 'viol1', orderId: 'o3', siteId: 's11', type: 'missed_site', description: 'Площадка пропущена без объяснений', timestamp: new Date(Date.now() - 9000000).toISOString(), driverId: 'u5' },
    { id: 'viol2', orderId: 'o5', siteId: 's7', type: 'missed_site', description: 'Площадка пропущена — водитель не зафиксировал посещение', timestamp: new Date(Date.now() - 86400000 - 2800000).toISOString(), driverId: 'u4' },
    { id: 'viol3', orderId: 'o1', siteId: 's2', type: 'no_photo', description: 'Площадка посещена, но фотоотчёт отсутствует', timestamp: new Date(Date.now() - 1800000).toISOString(), driverId: 'u3' }
  ];

  localStorage.setItem(DB_KEYS.USERS, JSON.stringify(users));
  localStorage.setItem(DB_KEYS.VEHICLES, JSON.stringify(vehicles));
  localStorage.setItem(DB_KEYS.SITES, JSON.stringify(sites));
  localStorage.setItem(DB_KEYS.ORDERS, JSON.stringify(orders));
  localStorage.setItem(DB_KEYS.VISITS, JSON.stringify(visits));
  localStorage.setItem(DB_KEYS.VIOLATIONS, JSON.stringify(violations));
}

const Data = {
  init() {
    if (!localStorage.getItem(DB_KEYS.USERS)) {
      seedDatabase();
    } else {
      const users = this.getUsers();
      if (!users.find(u => u.role === 'admin')) {
        users.push({ id: 'u0', name: 'Администратор', role: 'admin', username: 'admin', password: 'admin' });
        this._set(DB_KEYS.USERS, users);
      }
    }
  },

  reset() {
    Object.values(DB_KEYS).forEach(k => localStorage.removeItem(k));
    seedDatabase();
  },

  _get(key) { return JSON.parse(localStorage.getItem(key) || '[]'); },
  _set(key, val) { localStorage.setItem(key, JSON.stringify(val)); },

  // Auth
  getSession() { return JSON.parse(localStorage.getItem(DB_KEYS.SESSION) || 'null'); },
  setSession(user) { localStorage.setItem(DB_KEYS.SESSION, JSON.stringify(user)); },
  clearSession() { localStorage.removeItem(DB_KEYS.SESSION); },
  login(username, password) {
    return this._get(DB_KEYS.USERS).find(u => u.username === username && u.password === password) || null;
  },

  // Users
  getUsers() { return this._get(DB_KEYS.USERS); },
  getUserById(id) { return this._get(DB_KEYS.USERS).find(u => u.id === id); },
  getDrivers() { return this._get(DB_KEYS.USERS).filter(u => u.role === 'driver'); },

  // Vehicles
  getVehicles() { return this._get(DB_KEYS.VEHICLES); },
  getVehicleById(id) { return this._get(DB_KEYS.VEHICLES).find(v => v.id === id); },
  getVehicleByDriver(driverId) { return this._get(DB_KEYS.VEHICLES).find(v => v.driverId === driverId); },
  updateVehicle(id, updates) {
    const list = this._get(DB_KEYS.VEHICLES);
    const i = list.findIndex(v => v.id === id);
    if (i !== -1) { list[i] = { ...list[i], ...updates }; this._set(DB_KEYS.VEHICLES, list); }
  },

  // Sites
  getSites() { return this._get(DB_KEYS.SITES); },
  getSiteById(id) { return this._get(DB_KEYS.SITES).find(s => s.id === id); },

  // Orders
  getOrders() { return this._get(DB_KEYS.ORDERS); },
  getOrderById(id) { return this._get(DB_KEYS.ORDERS).find(o => o.id === id); },
  getOrdersByDriver(driverId) { return this._get(DB_KEYS.ORDERS).filter(o => o.driverId === driverId); },
  getTodayOrders() {
    const today = new Date().toISOString().split('T')[0];
    return this._get(DB_KEYS.ORDERS).filter(o => o.date === today);
  },
  createOrder(order) {
    const list = this._get(DB_KEYS.ORDERS);
    const maxNum = list.reduce((m, o) => Math.max(m, o.number), 100);
    order.id = genId();
    order.number = maxNum + 1;
    order.createdAt = new Date().toISOString();
    list.push(order);
    this._set(DB_KEYS.ORDERS, list);
    return order;
  },
  updateOrder(id, updates) {
    const list = this._get(DB_KEYS.ORDERS);
    const i = list.findIndex(o => o.id === id);
    if (i !== -1) { list[i] = { ...list[i], ...updates }; this._set(DB_KEYS.ORDERS, list); }
  },
  deleteOrder(id) {
    this._set(DB_KEYS.ORDERS, this._get(DB_KEYS.ORDERS).filter(o => o.id !== id));
    this._set(DB_KEYS.VISITS, this._get(DB_KEYS.VISITS).filter(v => v.orderId !== id));
  },

  // User CRUD
  addUser(user) {
    const list = this._get(DB_KEYS.USERS);
    user.id = 'u' + genId();
    list.push(user);
    this._set(DB_KEYS.USERS, list);
    return user;
  },
  updateUser(id, updates) {
    const list = this._get(DB_KEYS.USERS);
    const i = list.findIndex(u => u.id === id);
    if (i !== -1) { list[i] = { ...list[i], ...updates }; this._set(DB_KEYS.USERS, list); }
  },
  deleteUser(id) {
    this._set(DB_KEYS.USERS, this._get(DB_KEYS.USERS).filter(u => u.id !== id));
  },

  // Vehicle CRUD
  addVehicle(vehicle) {
    const list = this._get(DB_KEYS.VEHICLES);
    vehicle.id = 'v' + genId();
    list.push(vehicle);
    this._set(DB_KEYS.VEHICLES, list);
    return vehicle;
  },
  deleteVehicle(id) {
    this._set(DB_KEYS.VEHICLES, this._get(DB_KEYS.VEHICLES).filter(v => v.id !== id));
  },

  // Site CRUD
  addSite(site) {
    const list = this._get(DB_KEYS.SITES);
    site.id = 's' + genId();
    list.push(site);
    this._set(DB_KEYS.SITES, list);
    return site;
  },
  updateSite(id, updates) {
    const list = this._get(DB_KEYS.SITES);
    const i = list.findIndex(s => s.id === id);
    if (i !== -1) { list[i] = { ...list[i], ...updates }; this._set(DB_KEYS.SITES, list); }
  },
  deleteSite(id) {
    this._set(DB_KEYS.SITES, this._get(DB_KEYS.SITES).filter(s => s.id !== id));
  },

  // Visits
  getVisits() { return this._get(DB_KEYS.VISITS); },
  getVisitsByOrder(orderId) { return this._get(DB_KEYS.VISITS).filter(v => v.orderId === orderId); },
  getVisit(orderId, siteId) { return this._get(DB_KEYS.VISITS).find(v => v.orderId === orderId && v.siteId === siteId); },
  createVisit(visit) {
    const list = this._get(DB_KEYS.VISITS);
    visit.id = genId();
    list.push(visit);
    this._set(DB_KEYS.VISITS, list);
    return visit;
  },
  updateVisit(id, updates) {
    const list = this._get(DB_KEYS.VISITS);
    const i = list.findIndex(v => v.id === id);
    if (i !== -1) { list[i] = { ...list[i], ...updates }; this._set(DB_KEYS.VISITS, list); }
  },

  // Violations
  getViolations() { return this._get(DB_KEYS.VIOLATIONS); },
  addViolation(viol) {
    const list = this._get(DB_KEYS.VIOLATIONS);
    viol.id = genId();
    viol.timestamp = new Date().toISOString();
    list.push(viol);
    this._set(DB_KEYS.VIOLATIONS, list);
    return viol;
  },

  // Stats helpers
  getStats() {
    const orders = this.getOrders();
    const visits = this.getVisits();
    const today = new Date().toISOString().split('T')[0];
    const todayOrders = orders.filter(o => o.date === today);
    const todayVisits = visits.filter(v => todayOrders.find(o => o.id === v.orderId));
    return {
      todayOrders: todayOrders.length,
      completedOrders: todayOrders.filter(o => o.status === 'completed').length,
      inProgressOrders: todayOrders.filter(o => o.status === 'in_progress').length,
      todayVisits: todayVisits.length,
      completedVisits: todayVisits.filter(v => v.status === 'completed').length,
      skippedVisits: todayVisits.filter(v => v.status === 'skipped').length,
      violations: this.getViolations().filter(v => {
        const o = orders.find(o => o.id === v.orderId);
        return o && o.date === today;
      }).length
    };
  }
};
