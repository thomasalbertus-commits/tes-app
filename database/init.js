const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const DB_PATH = path.resolve(process.env.DB_PATH || './database/ifix_pro.db');

console.log('📦 Initializing database at:', DB_PATH);

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// =============================================
// SCHEMA: All tables for iFix Pro Enterprise
// =============================================

db.exec(`

-- ==================== OWNERS (Tenants) ====================
CREATE TABLE IF NOT EXISTS owners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'basic' CHECK(plan IN ('basic', 'pro')),
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
  subscription_activated_at TEXT,
  subscription_expires_at TEXT,
  subscription_duration INTEGER DEFAULT 30,
  admin_message TEXT,
  admin_message_at TEXT,
  auto_sync_plan INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- ==================== OWNER ACCESS RIGHTS ====================
CREATE TABLE IF NOT EXISTS owner_access_rights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  permission_key TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,
  UNIQUE(owner_id, permission_key)
);

-- ==================== SUBSCRIPTION PAYMENTS ====================
CREATE TABLE IF NOT EXISTS subscription_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  amount REAL DEFAULT 0,
  duration INTEGER DEFAULT 30,
  method TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
);

-- ==================== STORES (Branches) ====================
CREATE TABLE IF NOT EXISTS stores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  logo TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
);

-- ==================== USERS (Employees) ====================
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'teknisi' CHECK(role IN ('superadmin', 'owner', 'admin', 'kasir', 'teknisi')),
  owner_id INTEGER,
  store_id INTEGER,
  is_active INTEGER DEFAULT 1,
  notification_type TEXT,
  notification_message TEXT,
  notification_at TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE SET NULL,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL
);

-- ==================== STORE CONFIGS ====================
CREATE TABLE IF NOT EXISTS store_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  store_id INTEGER,
  config_key TEXT NOT NULL,
  config_value TEXT,
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

-- ==================== STORE PERMISSIONS ====================
CREATE TABLE IF NOT EXISTS store_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  store_id INTEGER,
  permission_key TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  UNIQUE(owner_id, store_id, permission_key)
);

-- ==================== CATEGORIES & SUB-CATEGORIES ====================
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  store_id INTEGER,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'category' CHECK(type IN ('category', 'sub_category')),
  parent_category TEXT,
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
);

-- ==================== BRANDS ====================
CREATE TABLE IF NOT EXISTS brands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
);

-- ==================== CUSTOMERS ====================
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  store_id INTEGER,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  email TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL
);

-- ==================== SUPPLIERS ====================
CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  store_id INTEGER,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  email TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL
);

-- ==================== INVENTORY ====================
CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  store_id INTEGER,
  name TEXT NOT NULL,
  category TEXT,
  sub_category TEXT,
  brand TEXT,
  supplier_id INTEGER,
  stock INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  buy_price REAL DEFAULT 0,
  sell_price REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
);

-- ==================== SERVICES (Repair Orders) ====================
CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  store_id INTEGER,
  token TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT,
  unit_type TEXT,
  complaint TEXT,
  status TEXT DEFAULT 'Diterima' CHECK(status IN ('Diterima', 'Diagnosa', 'Menunggu Sparepart', 'Selesai', 'Dibatalkan')),
  cost_estimate REAL DEFAULT 0,
  dp REAL DEFAULT 0,
  service_fee REAL DEFAULT 0,
  warranty TEXT,
  technician TEXT,
  payment_status TEXT DEFAULT 'Belum Bayar' CHECK(payment_status IN ('Lunas', 'DP', 'Belum Bayar')),
  payment_method TEXT,
  cash_account_id INTEGER,
  notes TEXT,
  customer_id INTEGER,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (cash_account_id) REFERENCES cash_accounts(id) ON DELETE SET NULL
);

-- ==================== SERVICE PARTS (Sparepart per Service) ====================
CREATE TABLE IF NOT EXISTS service_parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id INTEGER NOT NULL,
  inventory_id INTEGER,
  name TEXT NOT NULL,
  qty INTEGER DEFAULT 1,
  buy_price REAL DEFAULT 0,
  sell_price REAL DEFAULT 0,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
  FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE SET NULL
);

-- ==================== SERVICE QC CHECKLIST ====================
CREATE TABLE IF NOT EXISTS service_qc (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id INTEGER NOT NULL,
  item_name TEXT NOT NULL,
  checked INTEGER DEFAULT 0,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- ==================== SERVICE KELENGKAPAN ====================
CREATE TABLE IF NOT EXISTS service_kelengkapan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id INTEGER NOT NULL,
  item_name TEXT NOT NULL,
  checked INTEGER DEFAULT 0,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- ==================== QC FUNCTIONAL ITEMS (Master) ====================
CREATE TABLE IF NOT EXISTS qc_functional_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER,
  name TEXT NOT NULL,
  is_master INTEGER DEFAULT 0,
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
);

-- ==================== KELENGKAPAN ITEMS (Master) ====================
CREATE TABLE IF NOT EXISTS kelengkapan_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER,
  name TEXT NOT NULL,
  is_master INTEGER DEFAULT 0,
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
);

-- ==================== SALES ====================
CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  store_id INTEGER,
  customer_name TEXT,
  customer_id INTEGER,
  subtotal REAL DEFAULT 0,
  discount REAL DEFAULT 0,
  discount_type TEXT DEFAULT 'nominal' CHECK(discount_type IN ('nominal', 'percent')),
  discount_amount REAL DEFAULT 0,
  total REAL DEFAULT 0,
  payment_method TEXT,
  cash_account_id INTEGER,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (cash_account_id) REFERENCES cash_accounts(id) ON DELETE SET NULL
);

-- ==================== SALE ITEMS ====================
CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL,
  inventory_id INTEGER,
  name TEXT NOT NULL,
  qty INTEGER DEFAULT 1,
  price REAL DEFAULT 0,
  buy_price REAL DEFAULT 0,
  category TEXT,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE SET NULL
);

-- ==================== PURCHASES ====================
CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  store_id INTEGER,
  supplier_id INTEGER,
  supplier_name TEXT,
  total REAL DEFAULT 0,
  payment_method TEXT DEFAULT 'cash' CHECK(payment_method IN ('cash', 'credit')),
  cash_account_id INTEGER,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
  FOREIGN KEY (cash_account_id) REFERENCES cash_accounts(id) ON DELETE SET NULL
);

-- ==================== PURCHASE ITEMS ====================
CREATE TABLE IF NOT EXISTS purchase_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL,
  inventory_id INTEGER,
  name TEXT NOT NULL,
  qty INTEGER DEFAULT 1,
  buy_price REAL DEFAULT 0,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
  FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE SET NULL
);

-- ==================== RETURN SALES ====================
CREATE TABLE IF NOT EXISTS return_sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  store_id INTEGER,
  sale_id INTEGER,
  total REAL DEFAULT 0,
  reason TEXT,
  compensation REAL DEFAULT 0,
  cash_account_id INTEGER,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL,
  FOREIGN KEY (cash_account_id) REFERENCES cash_accounts(id) ON DELETE SET NULL
);

-- ==================== RETURN SALE ITEMS ====================
CREATE TABLE IF NOT EXISTS return_sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_sale_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  qty INTEGER DEFAULT 1,
  price REAL DEFAULT 0,
  FOREIGN KEY (return_sale_id) REFERENCES return_sales(id) ON DELETE CASCADE
);

-- ==================== RETURN PURCHASES ====================
CREATE TABLE IF NOT EXISTS return_purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  store_id INTEGER,
  purchase_id INTEGER,
  total REAL DEFAULT 0,
  reason TEXT,
  compensation REAL DEFAULT 0,
  cash_account_id INTEGER,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE SET NULL,
  FOREIGN KEY (cash_account_id) REFERENCES cash_accounts(id) ON DELETE SET NULL
);

-- ==================== RETURN PURCHASE ITEMS ====================
CREATE TABLE IF NOT EXISTS return_purchase_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_purchase_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  qty INTEGER DEFAULT 1,
  price REAL DEFAULT 0,
  FOREIGN KEY (return_purchase_id) REFERENCES return_purchases(id) ON DELETE CASCADE
);

-- ==================== TRANSACTIONS ====================
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  store_id INTEGER,
  type TEXT NOT NULL CHECK(type IN ('income', 'expense', 'profit', 'loss')),
  category TEXT,
  amount REAL DEFAULT 0,
  description TEXT,
  cash_account_id INTEGER,
  reference_type TEXT,
  reference_id INTEGER,
  date TEXT DEFAULT (datetime('now', 'localtime')),
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL,
  FOREIGN KEY (cash_account_id) REFERENCES cash_accounts(id) ON DELETE SET NULL
);

-- ==================== DEBTS (Utang & Piutang) ====================
CREATE TABLE IF NOT EXISTS debts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  store_id INTEGER,
  type TEXT NOT NULL CHECK(type IN ('payable', 'receivable')),
  party_name TEXT NOT NULL,
  amount REAL DEFAULT 0,
  paid REAL DEFAULT 0,
  remaining REAL DEFAULT 0,
  status TEXT DEFAULT 'Belum Lunas' CHECK(status IN ('Lunas', 'Belum Lunas')),
  reference_type TEXT,
  reference_id INTEGER,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL
);

-- ==================== DEBT PAYMENTS ====================
CREATE TABLE IF NOT EXISTS debt_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  debt_id INTEGER NOT NULL,
  amount REAL DEFAULT 0,
  cash_account_id INTEGER,
  notes TEXT,
  date TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE CASCADE,
  FOREIGN KEY (cash_account_id) REFERENCES cash_accounts(id) ON DELETE SET NULL
);

-- ==================== CASH ACCOUNTS ====================
CREATE TABLE IF NOT EXISTS cash_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  store_id INTEGER,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'cash' CHECK(type IN ('cash', 'bank', 'ewallet')),
  color TEXT DEFAULT '#3b82f6',
  balance REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL
);

-- ==================== CASH FLOW ====================
CREATE TABLE IF NOT EXISTS cash_flow (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  store_id INTEGER,
  type TEXT NOT NULL CHECK(type IN ('in', 'out')),
  amount REAL DEFAULT 0,
  category TEXT,
  account_id INTEGER,
  description TEXT,
  date TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL,
  FOREIGN KEY (account_id) REFERENCES cash_accounts(id) ON DELETE SET NULL
);

-- ==================== ATTENDANCE ====================
CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  store_id INTEGER,
  user_id INTEGER NOT NULL,
  user_name TEXT,
  date TEXT NOT NULL,
  check_in TEXT,
  check_out TEXT,
  work_hours REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==================== SALARY SETTINGS ====================
CREATE TABLE IF NOT EXISTS salary_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  store_id INTEGER,
  user_id INTEGER NOT NULL,
  base_salary REAL DEFAULT 0,
  commission_rate REAL DEFAULT 0,
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(owner_id, user_id)
);

-- ==================== PAYROLL ====================
CREATE TABLE IF NOT EXISTS payroll (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  store_id INTEGER,
  user_id INTEGER NOT NULL,
  user_name TEXT,
  month TEXT NOT NULL,
  base_salary REAL DEFAULT 0,
  commission REAL DEFAULT 0,
  commission_rate REAL DEFAULT 0,
  bonus REAL DEFAULT 0,
  deduction REAL DEFAULT 0,
  total_salary REAL DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'paid')),
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==================== LEAVES ====================
CREATE TABLE IF NOT EXISTS leaves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  store_id INTEGER,
  user_id INTEGER NOT NULL,
  user_name TEXT,
  type TEXT,
  start_date TEXT,
  end_date TEXT,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==================== SHIFTS ====================
CREATE TABLE IF NOT EXISTS shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  store_id INTEGER,
  name TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL
);

-- ==================== MONTHLY BUDGETS ====================
CREATE TABLE IF NOT EXISTS monthly_budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  store_id INTEGER,
  name TEXT NOT NULL,
  amount REAL DEFAULT 0,
  category TEXT,
  due_date TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL
);

-- ==================== STOCK OPNAME HISTORY ====================
CREATE TABLE IF NOT EXISTS stock_opname_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  store_id INTEGER,
  inventory_id INTEGER NOT NULL,
  item_name TEXT,
  old_stock INTEGER DEFAULT 0,
  new_stock INTEGER DEFAULT 0,
  difference INTEGER DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,
  FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE
);

-- ==================== PLAN CONFIGS ====================
CREATE TABLE IF NOT EXISTS plan_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_name TEXT UNIQUE NOT NULL CHECK(plan_name IN ('basic', 'pro')),
  config_json TEXT DEFAULT '{}'
);

-- ==================== SUBSCRIPTION CONFIG ====================
CREATE TABLE IF NOT EXISTS subscription_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  price REAL DEFAULT 0,
  duration INTEGER DEFAULT 30,
  whatsapp TEXT,
  currency TEXT DEFAULT 'IDR'
);

-- ==================== INDEXES ====================
CREATE INDEX IF NOT EXISTS idx_users_owner ON users(owner_id);
CREATE INDEX IF NOT EXISTS idx_users_store ON users(store_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_stores_owner ON stores(owner_id);
CREATE INDEX IF NOT EXISTS idx_services_owner ON services(owner_id);
CREATE INDEX IF NOT EXISTS idx_services_store ON services(store_id);
CREATE INDEX IF NOT EXISTS idx_services_token ON services(token);
CREATE INDEX IF NOT EXISTS idx_services_status ON services(status);
CREATE INDEX IF NOT EXISTS idx_sales_owner ON sales(owner_id);
CREATE INDEX IF NOT EXISTS idx_sales_store ON sales(store_id);
CREATE INDEX IF NOT EXISTS idx_inventory_owner ON inventory(owner_id);
CREATE INDEX IF NOT EXISTS idx_inventory_store ON inventory(store_id);
CREATE INDEX IF NOT EXISTS idx_transactions_owner ON transactions(owner_id);
CREATE INDEX IF NOT EXISTS idx_transactions_store ON transactions(store_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_purchases_owner ON purchases(owner_id);
CREATE INDEX IF NOT EXISTS idx_debts_owner ON debts(owner_id);
CREATE INDEX IF NOT EXISTS idx_debts_type ON debts(type);
CREATE INDEX IF NOT EXISTS idx_cash_accounts_owner ON cash_accounts(owner_id);
CREATE INDEX IF NOT EXISTS idx_cash_flow_owner ON cash_flow(owner_id);
CREATE INDEX IF NOT EXISTS idx_attendance_owner ON attendance(owner_id);
CREATE INDEX IF NOT EXISTS idx_customers_owner ON customers(owner_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_owner ON suppliers(owner_id);

`);

// ==================== SEED DEFAULT DATA ====================

// Insert default plan configs
const planBasic = db.prepare('SELECT id FROM plan_configs WHERE plan_name = ?').get('basic');
if (!planBasic) {
  db.prepare(`INSERT INTO plan_configs (plan_name, config_json) VALUES (?, ?)`).run('basic', JSON.stringify({
    feature_multi_branch: false,
    feature_backup: false,
    feature_qc_checklist: true,
    feature_kelengkapan: true,
    feature_accounting: false,
    max_stores: 1
  }));
}

const planPro = db.prepare('SELECT id FROM plan_configs WHERE plan_name = ?').get('pro');
if (!planPro) {
  db.prepare(`INSERT INTO plan_configs (plan_name, config_json) VALUES (?, ?)`).run('pro', JSON.stringify({
    feature_multi_branch: true,
    feature_backup: true,
    feature_qc_checklist: true,
    feature_kelengkapan: true,
    feature_accounting: true,
    max_stores: 999
  }));
}

// Insert default subscription config
const subConfig = db.prepare('SELECT id FROM subscription_config LIMIT 1').get();
if (!subConfig) {
  db.prepare(`INSERT INTO subscription_config (price, duration, whatsapp, currency) VALUES (?, ?, ?, ?)`).run(150000, 30, '6281234567890', 'IDR');
}

// Insert superadmin user
const superadminEmail = process.env.SUPERADMIN_EMAIL || 'agis.cpcd@gmail.com';
const existingSuperadmin = db.prepare('SELECT id FROM users WHERE email = ?').get(superadminEmail);
if (!existingSuperadmin) {
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  db.prepare(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`).run('Super Admin', superadminEmail, hashedPassword, 'superadmin');
  console.log(`✅ SuperAdmin created: ${superadminEmail} / admin123`);
}

// Insert default master QC items
const existingQc = db.prepare('SELECT id FROM qc_functional_items WHERE is_master = 1 LIMIT 1').get();
if (!existingQc) {
  const qcItems = ['Layar Touchscreen', 'Speaker', 'Microphone', 'Kamera Depan', 'Kamera Belakang', 'WiFi', 'Bluetooth', 'GPS', 'Charging Port', 'Headphone Jack', 'Tombol Power', 'Tombol Volume', 'Fingerprint', 'Face ID', 'NFC', 'Vibrator', 'SIM Card Slot', 'Signal/Baseband'];
  const insertQc = db.prepare('INSERT INTO qc_functional_items (name, is_master) VALUES (?, 1)');
  for (const item of qcItems) {
    insertQc.run(item);
  }
}

// Insert default master kelengkapan items
const existingKel = db.prepare('SELECT id FROM kelengkapan_items WHERE is_master = 1 LIMIT 1').get();
if (!existingKel) {
  const kelItems = ['Unit HP', 'Charger', 'Kabel Data', 'Earphone', 'Casing/Cover', 'Kardus/Box', 'SIM Card', 'Memory Card', 'Stylus Pen'];
  const insertKel = db.prepare('INSERT INTO kelengkapan_items (name, is_master) VALUES (?, 1)');
  for (const item of kelItems) {
    insertKel.run(item);
  }
}

db.close();
console.log('✅ Database initialized successfully!');
