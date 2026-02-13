const { getDb } = require('../config/database');

// =============================================
// GENERIC MODEL HELPERS
// =============================================

class BaseModel {
  constructor(tableName) {
    this.tableName = tableName;
  }

  get db() {
    return getDb();
  }

  findById(id) {
    return this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`).get(id);
  }

  findAll(conditions = {}, orderBy = 'id DESC', limit = 100) {
    let sql = `SELECT * FROM ${this.tableName}`;
    const params = [];
    const wheres = [];

    for (const [key, value] of Object.entries(conditions)) {
      if (value !== undefined && value !== null) {
        wheres.push(`${key} = ?`);
        params.push(value);
      }
    }

    if (wheres.length > 0) {
      sql += ' WHERE ' + wheres.join(' AND ');
    }

    sql += ` ORDER BY ${orderBy}`;
    if (limit) sql += ` LIMIT ${limit}`;

    return this.db.prepare(sql).all(...params);
  }

  create(data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');
    const sql = `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders})`;
    const result = this.db.prepare(sql).run(...values);
    return { id: result.lastInsertRowid, ...data };
  }

  update(id, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const sets = keys.map(k => `${k} = ?`).join(', ');
    const sql = `UPDATE ${this.tableName} SET ${sets} WHERE id = ?`;
    return this.db.prepare(sql).run(...values, id);
  }

  delete(id) {
    return this.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`).run(id);
  }

  count(conditions = {}) {
    let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const params = [];
    const wheres = [];

    for (const [key, value] of Object.entries(conditions)) {
      if (value !== undefined && value !== null) {
        wheres.push(`${key} = ?`);
        params.push(value);
      }
    }

    if (wheres.length > 0) {
      sql += ' WHERE ' + wheres.join(' AND ');
    }

    return this.db.prepare(sql).get(...params).count;
  }

  paginate(conditions = {}, page = 1, perPage = 25, orderBy = 'id DESC') {
    const offset = (page - 1) * perPage;
    let sql = `SELECT * FROM ${this.tableName}`;
    let countSql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const params = [];
    const wheres = [];

    for (const [key, value] of Object.entries(conditions)) {
      if (value !== undefined && value !== null) {
        wheres.push(`${key} = ?`);
        params.push(value);
      }
    }

    if (wheres.length > 0) {
      const whereClause = ' WHERE ' + wheres.join(' AND ');
      sql += whereClause;
      countSql += whereClause;
    }

    const total = this.db.prepare(countSql).get(...params).count;
    sql += ` ORDER BY ${orderBy} LIMIT ? OFFSET ?`;

    const items = this.db.prepare(sql).all(...params, perPage, offset);

    return {
      items,
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage)
    };
  }
}

// =============================================
// SPECIFIC MODELS
// =============================================

class OwnerModel extends BaseModel {
  constructor() { super('owners'); }

  findByEmail(email) {
    return this.db.prepare('SELECT * FROM owners WHERE email = ?').get(email);
  }

  getAccessRights(ownerId) {
    const rows = this.db.prepare('SELECT permission_key, enabled FROM owner_access_rights WHERE owner_id = ?').all(ownerId);
    const rights = {};
    rows.forEach(r => { rights[r.permission_key] = !!r.enabled; });
    return rights;
  }

  setAccessRights(ownerId, rights) {
    const deleteStmt = this.db.prepare('DELETE FROM owner_access_rights WHERE owner_id = ?');
    const insertStmt = this.db.prepare('INSERT INTO owner_access_rights (owner_id, permission_key, enabled) VALUES (?, ?, ?)');

    const transaction = this.db.transaction(() => {
      deleteStmt.run(ownerId);
      for (const [key, value] of Object.entries(rights)) {
        insertStmt.run(ownerId, key, value ? 1 : 0);
      }
    });

    transaction();
  }

  getPaymentHistory(ownerId) {
    return this.db.prepare('SELECT * FROM subscription_payments WHERE owner_id = ? ORDER BY created_at DESC').all(ownerId);
  }

  addPayment(ownerId, data) {
    return this.db.prepare('INSERT INTO subscription_payments (owner_id, amount, duration, method, notes) VALUES (?, ?, ?, ?, ?)').run(ownerId, data.amount, data.duration, data.method, data.notes);
  }
}

class StoreModel extends BaseModel {
  constructor() { super('stores'); }

  findByOwner(ownerId) {
    return this.db.prepare('SELECT * FROM stores WHERE owner_id = ? ORDER BY name ASC').all(ownerId);
  }
}

class UserModel extends BaseModel {
  constructor() { super('users'); }

  findByEmail(email) {
    return this.db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  }

  findByOwner(ownerId) {
    return this.db.prepare('SELECT u.*, s.name as store_name FROM users u LEFT JOIN stores s ON u.store_id = s.id WHERE u.owner_id = ? ORDER BY u.name ASC').all(ownerId);
  }

  findByOwnerAndStore(ownerId, storeId) {
    return this.db.prepare('SELECT * FROM users WHERE owner_id = ? AND store_id = ? ORDER BY name ASC').all(ownerId, storeId);
  }

  getTechnicians(ownerId, storeId) {
    let sql = 'SELECT * FROM users WHERE owner_id = ? AND role = ?';
    const params = [ownerId, 'teknisi'];
    if (storeId) {
      sql += ' AND store_id = ?';
      params.push(storeId);
    }
    return this.db.prepare(sql).all(...params);
  }
}

class ServiceModel extends BaseModel {
  constructor() { super('services'); }

  findByToken(token) {
    return this.db.prepare('SELECT * FROM services WHERE token = ?').get(token);
  }

  findWithParts(id) {
    const service = this.findById(id);
    if (!service) return null;
    service.parts = this.db.prepare('SELECT * FROM service_parts WHERE service_id = ?').all(id);
    service.qc = this.db.prepare('SELECT * FROM service_qc WHERE service_id = ?').all(id);
    service.kelengkapan = this.db.prepare('SELECT * FROM service_kelengkapan WHERE service_id = ?').all(id);
    return service;
  }

  getByOwnerAndStore(ownerId, storeId, status = null) {
    let sql = 'SELECT s.*, st.name as store_name FROM services s LEFT JOIN stores st ON s.store_id = st.id WHERE s.owner_id = ?';
    const params = [ownerId];
    if (storeId) { sql += ' AND s.store_id = ?'; params.push(storeId); }
    if (status) { sql += ' AND s.status = ?'; params.push(status); }
    sql += ' ORDER BY s.created_at DESC';
    return this.db.prepare(sql).all(...params);
  }

  paginateByOwner(ownerId, storeId, page = 1, perPage = 25, search = '', status = '') {
    let whereSql = 'WHERE s.owner_id = ?';
    const params = [ownerId];
    if (storeId) { whereSql += ' AND s.store_id = ?'; params.push(storeId); }
    if (status) { whereSql += ' AND s.status = ?'; params.push(status); }
    if (search) {
      whereSql += ' AND (s.customer_name LIKE ? OR s.token LIKE ? OR s.unit_type LIKE ? OR s.phone LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const countParams = [...params];
    const total = this.db.prepare(`SELECT COUNT(*) as count FROM services s ${whereSql}`).get(...countParams).count;

    const offset = (page - 1) * perPage;
    const items = this.db.prepare(`SELECT s.*, st.name as store_name FROM services s LEFT JOIN stores st ON s.store_id = st.id ${whereSql} ORDER BY s.created_at DESC LIMIT ? OFFSET ?`).all(...params, perPage, offset);

    // Get parts for each service
    const partsStmt = this.db.prepare('SELECT * FROM service_parts WHERE service_id = ?');
    items.forEach(item => {
      item.parts = partsStmt.all(item.id);
    });

    return { items, total, page, perPage, totalPages: Math.ceil(total / perPage) };
  }

  generateToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let token;
    do {
      token = '';
      for (let i = 0; i < 6; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.findByToken(token));
    return token;
  }
}

class InventoryModel extends BaseModel {
  constructor() { super('inventory'); }

  findByOwnerAndStore(ownerId, storeId, search = '', category = '', brand = '') {
    let sql = 'SELECT i.*, sup.name as supplier_name FROM inventory i LEFT JOIN suppliers sup ON i.supplier_id = sup.id WHERE i.owner_id = ?';
    const params = [ownerId];
    if (storeId) { sql += ' AND i.store_id = ?'; params.push(storeId); }
    if (search) { sql += ' AND i.name LIKE ?'; params.push(`%${search}%`); }
    if (category) { sql += ' AND i.category = ?'; params.push(category); }
    if (brand) { sql += ' AND i.brand = ?'; params.push(brand); }
    sql += ' ORDER BY i.name ASC';
    return this.db.prepare(sql).all(...params);
  }

  getLowStock(ownerId, storeId) {
    let sql = 'SELECT * FROM inventory WHERE owner_id = ? AND stock <= min_stock AND min_stock > 0';
    const params = [ownerId];
    if (storeId) { sql += ' AND store_id = ?'; params.push(storeId); }
    return this.db.prepare(sql).all(...params);
  }

  adjustStock(id, qty) {
    return this.db.prepare('UPDATE inventory SET stock = stock + ?, updated_at = datetime("now", "localtime") WHERE id = ?').run(qty, id);
  }

  getTotalStockValue(ownerId, storeId) {
    let sql = 'SELECT COALESCE(SUM(stock * buy_price), 0) as totalBuy, COALESCE(SUM(stock * sell_price), 0) as totalSell FROM inventory WHERE owner_id = ?';
    const params = [ownerId];
    if (storeId) { sql += ' AND store_id = ?'; params.push(storeId); }
    return this.db.prepare(sql).get(...params);
  }
}

class SaleModel extends BaseModel {
  constructor() { super('sales'); }

  findWithItems(id) {
    const sale = this.findById(id);
    if (!sale) return null;
    sale.items = this.db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id);
    return sale;
  }

  paginateByOwner(ownerId, storeId, page = 1, perPage = 25) {
    const conditions = { owner_id: ownerId };
    if (storeId) conditions.store_id = storeId;

    const result = this.paginate(conditions, page, perPage, 'created_at DESC');
    const itemsStmt = this.db.prepare('SELECT * FROM sale_items WHERE sale_id = ?');
    result.items.forEach(sale => {
      sale.items = itemsStmt.all(sale.id);
    });
    return result;
  }
}

class TransactionModel extends BaseModel {
  constructor() { super('transactions'); }

  getSummary(ownerId, storeId, startDate = null, endDate = null) {
    let whereSql = 'WHERE owner_id = ?';
    const params = [ownerId];
    if (storeId) { whereSql += ' AND store_id = ?'; params.push(storeId); }
    if (startDate) { whereSql += ' AND date >= ?'; params.push(startDate); }
    if (endDate) { whereSql += ' AND date <= ?'; params.push(endDate); }

    const income = this.db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions ${whereSql} AND type = 'income'`).get(...params).total;
    const expense = this.db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions ${whereSql} AND type = 'expense'`).get(...params).total;
    const profit = this.db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions ${whereSql} AND type = 'profit'`).get(...params).total;
    const loss = this.db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions ${whereSql} AND type = 'loss'`).get(...params).total;

    return { income, expense, profit, loss, netProfit: income - expense + profit - loss };
  }

  getByDateRange(ownerId, storeId, startDate, endDate) {
    let sql = 'SELECT * FROM transactions WHERE owner_id = ?';
    const params = [ownerId];
    if (storeId) { sql += ' AND store_id = ?'; params.push(storeId); }
    if (startDate) { sql += ' AND date >= ?'; params.push(startDate); }
    if (endDate) { sql += ' AND date <= ?'; params.push(endDate); }
    sql += ' ORDER BY date DESC, created_at DESC';
    return this.db.prepare(sql).all(...params);
  }
}

class CustomerModel extends BaseModel {
  constructor() { super('customers'); }
}

class SupplierModel extends BaseModel {
  constructor() { super('suppliers'); }
}

class PurchaseModel extends BaseModel {
  constructor() { super('purchases'); }

  findWithItems(id) {
    const purchase = this.findById(id);
    if (!purchase) return null;
    purchase.items = this.db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(id);
    return purchase;
  }
}

class DebtModel extends BaseModel {
  constructor() { super('debts'); }

  getPayments(debtId) {
    return this.db.prepare('SELECT dp.*, ca.name as account_name FROM debt_payments dp LEFT JOIN cash_accounts ca ON dp.cash_account_id = ca.id WHERE dp.debt_id = ? ORDER BY dp.date DESC').all(debtId);
  }

  addPayment(debtId, data) {
    const payment = this.db.prepare('INSERT INTO debt_payments (debt_id, amount, cash_account_id, notes) VALUES (?, ?, ?, ?)').run(debtId, data.amount, data.cash_account_id, data.notes);

    // Update debt totals
    const debt = this.findById(debtId);
    const totalPaid = this.db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM debt_payments WHERE debt_id = ?').get(debtId).total;
    const remaining = debt.amount - totalPaid;

    this.update(debtId, {
      paid: totalPaid,
      remaining: remaining,
      status: remaining <= 0 ? 'Lunas' : 'Belum Lunas'
    });

    return payment;
  }
}

class CashAccountModel extends BaseModel {
  constructor() { super('cash_accounts'); }

  findByOwnerAndStore(ownerId, storeId) {
    let sql = 'SELECT * FROM cash_accounts WHERE owner_id = ?';
    const params = [ownerId];
    if (storeId) { sql += ' AND (store_id = ? OR store_id IS NULL)'; params.push(storeId); }
    sql += ' ORDER BY name ASC';
    return this.db.prepare(sql).all(...params);
  }
}

class CashFlowModel extends BaseModel {
  constructor() { super('cash_flow'); }
}

class AttendanceModel extends BaseModel {
  constructor() { super('attendance'); }
}

class PayrollModel extends BaseModel {
  constructor() { super('payroll'); }
}

class LeaveModel extends BaseModel {
  constructor() { super('leaves'); }
}

class ShiftModel extends BaseModel {
  constructor() { super('shifts'); }
}

class BrandModel extends BaseModel {
  constructor() { super('brands'); }
}

class CategoryModel extends BaseModel {
  constructor() { super('categories'); }
}

class StockOpnameModel extends BaseModel {
  constructor() { super('stock_opname_history'); }
}

class SalarySettingModel extends BaseModel {
  constructor() { super('salary_settings'); }
}

class MonthlyBudgetModel extends BaseModel {
  constructor() { super('monthly_budgets'); }
}

// Export singletons
module.exports = {
  Owner: new OwnerModel(),
  Store: new StoreModel(),
  User: new UserModel(),
  Service: new ServiceModel(),
  Inventory: new InventoryModel(),
  Sale: new SaleModel(),
  Transaction: new TransactionModel(),
  Customer: new CustomerModel(),
  Supplier: new SupplierModel(),
  Purchase: new PurchaseModel(),
  Debt: new DebtModel(),
  CashAccount: new CashAccountModel(),
  CashFlow: new CashFlowModel(),
  Attendance: new AttendanceModel(),
  Payroll: new PayrollModel(),
  Leave: new LeaveModel(),
  Shift: new ShiftModel(),
  Brand: new BrandModel(),
  Category: new CategoryModel(),
  StockOpname: new StockOpnameModel(),
  SalarySetting: new SalarySettingModel(),
  MonthlyBudget: new MonthlyBudgetModel(),
  BaseModel
};
