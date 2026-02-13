require('dotenv').config();

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);

const expressLayouts = require('express-ejs-layouts');

const { initDb } = require('./config/database');
const helpers = require('./middleware/helpers');
const {
  requireAuth,
  requireSuperAdmin,
  requireTenant,
  checkSubscription,
  checkMenuPermission
} = require('./middleware/auth');

// Initialize database
initDb();

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (for reverse proxy / hosting environments)
app.set('trust proxy', 1);

// ─── View Engine ────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// ─── Security & Performance ────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,  // Allow CDN scripts (Tailwind, Chart.js, Lucide)
  crossOriginEmbedderPolicy: false
}));
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 500,                    // limit per window
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// Login rate limit (stricter)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.'
});

// ─── Body Parsing ──────────────────────────────────────────
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// ─── Static Files ──────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Session ───────────────────────────────────────────────
app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: path.join(__dirname, 'database')
  }),
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000  // 24 hours
  }
}));

// ─── Template Helpers ──────────────────────────────────────
app.use(helpers);

// ─── Routes ────────────────────────────────────────────────

// Auth routes (public)
const authRoutes = require('./routes/auth');
app.use('/', authRoutes);

// Tracking (public)
const trackingRoutes = require('./routes/tracking');
app.use('/tracking', trackingRoutes);

// All routes below require authentication
app.use(requireAuth);

// API routes (authenticated, no tenant required for store switching)
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// SuperAdmin routes
const superadminRoutes = require('./routes/superadmin');
app.use('/superadmin', requireSuperAdmin, superadminRoutes);

// All tenant-scoped routes below
app.use(requireTenant);
app.use(checkSubscription);

// Dashboard
const dashboardRoutes = require('./routes/dashboard');
app.use('/dashboard', checkMenuPermission('menu_dashboard'), dashboardRoutes);

// Services
const servicesRoutes = require('./routes/services');
app.use('/services', checkMenuPermission('menu_service'), servicesRoutes);

// Sales
const salesRoutes = require('./routes/sales');
app.use('/sales', checkMenuPermission('menu_sales'), salesRoutes);

// Inventory
const inventoryRoutes = require('./routes/inventory');
app.use('/inventory', checkMenuPermission('menu_inventory'), inventoryRoutes);

// Customers
const customersRoutes = require('./routes/customers');
app.use('/customers', checkMenuPermission('menu_customers'), customersRoutes);

// Suppliers
const suppliersRoutes = require('./routes/suppliers');
app.use('/suppliers', checkMenuPermission('menu_supplier'), suppliersRoutes);

// Purchases
const purchasesRoutes = require('./routes/purchases');
app.use('/purchases', checkMenuPermission('menu_purchase'), purchasesRoutes);

// Returns
const returnsRoutes = require('./routes/returns');
app.use('/returns', returnsRoutes);  // Permission checked per sub-route

// Finance
const financeRoutes = require('./routes/finance');
app.use('/finance', checkMenuPermission('menu_finance'), financeRoutes);

// Cash
const cashRoutes = require('./routes/cash');
app.use('/cash', checkMenuPermission('menu_cash'), cashRoutes);

// Debts
const debtsRoutes = require('./routes/debts');
app.use('/debts', debtsRoutes);  // Permission checked per sub-route (payable/receivable)

// HR
const hrRoutes = require('./routes/hr');
app.use('/hr', checkMenuPermission('menu_hr'), hrRoutes);

// Users
const usersRoutes = require('./routes/users');
app.use('/users', checkMenuPermission('menu_users'), usersRoutes);

// Settings
const settingsRoutes = require('./routes/settings');
app.use('/settings', checkMenuPermission('menu_settings'), settingsRoutes);

// Reports
const reportsRoutes = require('./routes/reports');
app.use('/reports', checkMenuPermission('menu_report'), reportsRoutes);

// ─── Root redirect ─────────────────────────────────────────
app.get('/', (req, res) => {
  if (req.user && req.user.role === 'superadmin') {
    return res.redirect('/superadmin');
  }
  res.redirect('/dashboard');
});

// ─── 404 Handler ───────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render('errors/403', {
    title: 'Halaman Tidak Ditemukan',
    message: 'Halaman yang Anda cari tidak ditemukan.'
  });
});

// ─── Error Handler ─────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).render('errors/403', {
    title: 'Server Error',
    message: process.env.NODE_ENV === 'development'
      ? err.message
      : 'Terjadi kesalahan pada server.'
  });
});

// ─── Start Server ──────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║   iFix Pro Enterprise                     ║
  ║   Server running on port ${PORT}             ║
  ║   http://localhost:${PORT}                   ║
  ╚═══════════════════════════════════════════╝
  `);
});

module.exports = app;
