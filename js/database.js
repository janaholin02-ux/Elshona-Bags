// Database management using JSON structure
let database = {
  accounts: {},
  carts: {},
  orders: []
};
let databaseReady = false;
let databaseLoadPromise = null;

// Load database from data.json first, otherwise attempt to use localStorage cache
function loadDatabase() {
  databaseLoadPromise = fetch('data.json')
    .then(response => {
      if (!response.ok) {
        throw new Error('data.json not available');
      }
      return response.json();
    })
    .then(json => {
      if (json && typeof json === 'object') {
        database = json;
        if (Array.isArray(database.carts)) {
          database.carts = {};
        }
        if (!database.accounts || typeof database.accounts !== 'object') {
          database.accounts = {};
        }
        if (!Array.isArray(database.orders)) {
          database.orders = [];
        }
        saveDatabase();
      } else {
        throw new Error('Invalid data.json');
      }
    })
    .catch(() => {
      const savedData = localStorage.getItem('eshonaDatabase');
      if (savedData) {
        try {
          database = JSON.parse(savedData);
          return;
        } catch (e) {
          console.error('Error loading stored database:', e);
        }
      }
      initializeDatabase();
    })
    .finally(() => {
      databaseReady = true;
    });
}

function ensureDatabaseLoaded() {
  if (databaseLoadPromise) {
    return databaseLoadPromise;
  }
  return Promise.resolve();
}

function initializeDatabase() {
  database = {
    accounts: {},
    carts: {},
    orders: []
  };
  saveDatabase();
}

// Save database to localStorage
function saveDatabase() {
  localStorage.setItem('eshonaDatabase', JSON.stringify(database));
}

// Account functions
function saveAccount(username, accountData) {
  database.accounts[username] = accountData;
  saveDatabase();
}

function getAccount(username) {
  return database.accounts[username];
}

function findAccount(identifier) {
  if (!identifier) return null;
  const normalized = identifier.trim().toLowerCase();
  for (const [username, account] of Object.entries(database.accounts)) {
    if (username.toLowerCase() === normalized || String(account.email || '').toLowerCase() === normalized) {
      return { username, account };
    }
  }
  return null;
}

function accountExists(identifier) {
  return !!findAccount(identifier);
}

// Cart functions
function getCart(username) {
  return database.carts[username] || [];
}

function saveCart(username, cart) {
  database.carts[username] = cart;
  saveDatabase();
}

function clearCart(username) {
  database.carts[username] = [];
  saveDatabase();
}

// Orders functions
function saveOrder(order) {
  database.orders.push(order);
  saveDatabase();
}

function getOrders(username) {
  return database.orders.filter(order => order.user === username);
}

function getAllOrders() {
  return database.orders;
}

// Initialize on load
loadDatabase();