# iFix Pro Enterprise

Aplikasi POS untuk Service HP & Penjualan - Fullstack Multi-tenant SaaS

## 🚀 Fitur Utama

- **Multi-tenant SaaS** - Satu aplikasi untuk banyak tenant/bisnis
- **Manajemen Servis HP** - Tracking repair, QC checklist, kelengkapan unit
- **POS Penjualan** - Point of Sale dengan cart, diskon, multiple payment
- **Inventory Management** - Stock management, stock opname, alerts
- **Pembelian & Supplier** - Purchase management dengan auto stock update
- **Retur** - Sales & purchases returns dengan stock restoration
- **Keuangan** - Cash flow, utang/piutang, laporan keuangan
- **HR & Payroll** - Attendance, salary, leave management
- **Multi-cabang** - Support multiple stores per tenant
- **Subscription Management** - Plan-based access (Basic, Standard, Pro)
- **Permission System** - 35+ granular permissions per tenant

## 📦 Tech Stack

- **Backend:** Node.js + Express.js
- **Database:** SQLite3 (better-sqlite3)
- **Template Engine:** EJS + express-ejs-layouts
- **Frontend:** Tailwind CSS (CDN) + Lucide Icons + Chart.js
- **Session:** express-session + connect-sqlite3
- **Authentication:** bcryptjs
- **Security:** helmet, compression, rate-limiting

## 🛠️ Cara Install & Setup

### 1. Clone Repository

```bash
git clone https://github.com/thomasalbertus-commits/tes-app.git
cd tes-app
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Environment Variables

```bash
cp .env.example .env
```

Edit `.env` sesuai kebutuhan:
- `PORT` - Port server (default: 3000)
- `SESSION_SECRET` - Secret key untuk session (ganti dengan random string panjang)
- `SUPERADMIN_EMAIL` - Email untuk akun SuperAdmin

### 4. Initialize Database

```bash
npm run db:init
```

Ini akan membuat:
- Database SQLite3 di `database/ifix_pro.db`
- 30+ tables dengan indexes
- Akun SuperAdmin (email dari .env, password: `admin123`)
- Plan configs (Basic, Standard, Pro)
- Master QC items & kelengkapan items

### 5. Jalankan Server

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

Server akan berjalan di: `http://localhost:3000`

## 👤 Default Login

### SuperAdmin
- Email: `agis.cpcd@gmail.com` (atau sesuai SUPERADMIN_EMAIL di .env)
- Password: `admin123`

### Cara Membuat Tenant Baru

1. Login sebagai SuperAdmin
2. Klik **"Tambah Tenant"**
3. Isi form (nama, email, password, plan)
4. Tenant & toko default akan otomatis dibuat
5. Login sebagai tenant dengan email & password yang dibuat

## 📂 Struktur Folder

```
tes-app/
├── config/           # Database connection
├── database/         # SQLite database & initialization
├── middleware/       # Auth & helpers middleware
├── models/          # Database models (20+ models)
├── routes/          # Route handlers (17 route files)
├── views/           # EJS templates
│   ├── layouts/     # Main layout
│   ├── partials/    # Reusable components
│   ├── auth/        # Login page
│   ├── dashboard/   # Dashboard
│   ├── services/    # Service management
│   ├── sales/       # POS
│   ├── inventory/   # Stock management
│   ├── finance/     # Financial reports
│   ├── hr/          # HR & Payroll
│   ├── superadmin/  # SuperAdmin panel
│   └── ...
├── public/          # Static files (JS, CSS, images)
├── server.js        # Entry point
├── package.json     # Dependencies
└── .env.example     # Environment template
```

## 🗄️ Database Schema

Database menggunakan SQLite3 dengan **30+ tables**:

**Core:**
- owners (tenants)
- users, stores
- owner_access_rights
- plan_configs, subscription_config

**Business:**
- services, service_parts, service_qc, service_kelengkapan
- sales, sale_items
- purchases, purchase_items
- inventory, stock_opname
- customers, suppliers
- transactions, debts, debt_payments
- cash_accounts, cash_flow

**HR:**
- attendance, payroll, leaves, shifts, salary_settings, monthly_budgets

**Settings:**
- brands, categories, qc_items, kelengkapan_items

## 🔐 Permission System

35+ permission keys dibagi 2 kategori:

**Menu Access (17):**
- menu_dashboard, menu_service, menu_sales, menu_purchase
- menu_return_sales, menu_return_purchase
- menu_payable, menu_receivable, menu_cash, menu_finance
- menu_inventory, menu_supplier, menu_customers
- menu_hr, menu_users, menu_settings, menu_report

**Feature Access (18):**
- feature_delete, feature_print, feature_share
- feature_stock_add, feature_backup
- feature_finance_edit, feature_employee_edit
- feature_service_edit, feature_sales_edit
- feature_inventory_edit, feature_customer_edit
- feature_import_export, feature_multi_branch
- feature_qc_checklist, feature_kelengkapan
- feature_accounting

## 📜 Available Scripts

```bash
npm start          # Jalankan server production
npm run dev        # Jalankan server development (nodemon)
npm run db:init    # Initialize database & seed data
```

## 🚢 Deploy ke Hosting

### VPS / Cloud Server

1. Upload semua file (kecuali node_modules, database/*.db, .env)
2. Install Node.js (v18+)
3. `npm install --production`
4. Setup `.env` dengan secrets production
5. `npm run db:init` (sekali saja untuk initialize)
6. `npm start` atau gunakan PM2:
   ```bash
   npm install -g pm2
   pm2 start server.js --name ifix-pro
   pm2 save
   ```

### Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Database Backup

SQLite database ada di: `database/ifix_pro.db`

**Backup manual:**
```bash
cp database/ifix_pro.db database/backup_$(date +%Y%m%d_%H%M%S).db
```

**Scheduled backup (cron):**
```bash
# Backup setiap hari jam 2 pagi
0 2 * * * cp /path/to/database/ifix_pro.db /backup/ifix_$(date +\%Y\%m\%d).db
```

## 🐛 Troubleshooting

### Error: better-sqlite3 compilation failed
```bash
npm rebuild better-sqlite3
```

### Port 3000 sudah digunakan
Edit `.env`, ubah `PORT=3000` ke port lain (misal: `PORT=8080`)

### Session tidak persisten
Pastikan folder `database/` writable untuk simpan `sessions.db`

## 📝 License

Proprietary - All rights reserved

## 👨‍💻 Developer

Developed by: Thomas Albertus
Contact: agis.cpcd@gmail.com

---

**Last Updated:** February 13, 2026
