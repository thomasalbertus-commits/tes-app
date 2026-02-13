const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { Inventory, Transaction, CashAccount, Sale, Purchase } = require('../models');

// ==================== RETUR PENJUALAN ====================
router.get('/sales', (req, res) => {
  const db = getDb();
  const returns = db.prepare('SELECT * FROM return_sales WHERE owner_id = ? ORDER BY created_at DESC').all(req.effectiveOwnerId);
  returns.forEach(r => { r.items = db.prepare('SELECT * FROM return_sale_items WHERE return_sale_id = ?').all(r.id); });
  res.render('returns/sales', { title: 'Retur Penjualan', pageTitle: 'Retur Penjualan', returns, queryString: '' });
});

router.get('/sales/new', (req, res) => {
  const sales = Sale.findAll({ owner_id: req.effectiveOwnerId }, 'created_at DESC', 50);
  const cashAccounts = CashAccount.findByOwnerAndStore(req.effectiveOwnerId, req.effectiveStoreId);
  res.render('returns/sales-form', { title: 'Retur Penjualan Baru', pageTitle: 'Retur Penjualan Baru', sales, cashAccounts });
});

router.post('/sales', (req, res) => {
  const db = getDb();
  const ownerId = req.effectiveOwnerId;
  const storeId = req.effectiveStoreId;
  
  try {
    const items = req.body.items || [];
    const total = items.reduce((sum, item) => sum + (parseFloat(item.price) * parseInt(item.qty || 1)), 0);
    const compensation = parseFloat(req.body.compensation) || 0;
    
    db.transaction(() => {
      const result = db.prepare('INSERT INTO return_sales (owner_id, store_id, sale_id, total, reason, compensation, cash_account_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        ownerId, storeId, req.body.sale_id || null, total, req.body.reason || '', compensation, req.body.cash_account_id || null
      );
      
      const insertItem = db.prepare('INSERT INTO return_sale_items (return_sale_id, name, qty, price) VALUES (?, ?, ?, ?)');
      for (const item of items) {
        insertItem.run(result.lastInsertRowid, item.name, parseInt(item.qty) || 1, parseFloat(item.price) || 0);
        // Restore stock if linked to inventory
        if (item.inventory_id) Inventory.adjustStock(parseInt(item.inventory_id), parseInt(item.qty) || 1);
      }
      
      // Refund expense
      Transaction.create({ owner_id: ownerId, store_id: storeId, type: 'expense', category: 'Retur Penjualan', amount: total, description: `Retur Penjualan #${result.lastInsertRowid}`, reference_type: 'return_sale', reference_id: result.lastInsertRowid, date: new Date().toISOString() });
      
      if (compensation > 0) {
        Transaction.create({ owner_id: ownerId, store_id: storeId, type: 'income', category: 'Kompensasi Retur Penjualan', amount: compensation, description: `Kompensasi Retur Penjualan #${result.lastInsertRowid}`, reference_type: 'return_sale', reference_id: result.lastInsertRowid, date: new Date().toISOString() });
      }
    })();
    
    req.session.flash = { success: 'Retur penjualan berhasil dibuat' };
  } catch (error) {
    req.session.flash = { error: 'Gagal membuat retur penjualan' };
  }
  res.redirect('/return-sales');
});

// ==================== RETUR PEMBELIAN ====================
router.get('/purchases', (req, res) => {
  const db = getDb();
  const returns = db.prepare('SELECT * FROM return_purchases WHERE owner_id = ? ORDER BY created_at DESC').all(req.effectiveOwnerId);
  returns.forEach(r => { r.items = db.prepare('SELECT * FROM return_purchase_items WHERE return_purchase_id = ?').all(r.id); });
  res.render('returns/purchases', { title: 'Retur Pembelian', pageTitle: 'Retur Pembelian', returns, queryString: '' });
});

router.get('/purchases/new', (req, res) => {
  const db = getDb();
  const purchases = db.prepare('SELECT * FROM purchases WHERE owner_id = ? ORDER BY created_at DESC LIMIT 50').all(req.effectiveOwnerId);
  const cashAccounts = CashAccount.findByOwnerAndStore(req.effectiveOwnerId, req.effectiveStoreId);
  res.render('returns/purchases-form', { title: 'Retur Pembelian Baru', pageTitle: 'Retur Pembelian Baru', purchases, cashAccounts });
});

router.post('/purchases', (req, res) => {
  const db = getDb();
  const ownerId = req.effectiveOwnerId;
  const storeId = req.effectiveStoreId;
  
  try {
    const items = req.body.items || [];
    const total = items.reduce((sum, item) => sum + (parseFloat(item.price) * parseInt(item.qty || 1)), 0);
    const compensation = parseFloat(req.body.compensation) || 0;
    
    db.transaction(() => {
      const result = db.prepare('INSERT INTO return_purchases (owner_id, store_id, purchase_id, total, reason, compensation, cash_account_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        ownerId, storeId, req.body.purchase_id || null, total, req.body.reason || '', compensation, req.body.cash_account_id || null
      );
      
      const insertItem = db.prepare('INSERT INTO return_purchase_items (return_purchase_id, name, qty, price) VALUES (?, ?, ?, ?)');
      for (const item of items) {
        insertItem.run(result.lastInsertRowid, item.name, parseInt(item.qty) || 1, parseFloat(item.price) || 0);
        if (item.inventory_id) Inventory.adjustStock(parseInt(item.inventory_id), -(parseInt(item.qty) || 1));
      }
      
      Transaction.create({ owner_id: ownerId, store_id: storeId, type: 'income', category: 'Retur Pembelian', amount: total, description: `Retur Pembelian #${result.lastInsertRowid}`, reference_type: 'return_purchase', reference_id: result.lastInsertRowid, date: new Date().toISOString() });
      
      if (compensation > 0) {
        Transaction.create({ owner_id: ownerId, store_id: storeId, type: 'expense', category: 'Kompensasi Retur Pembelian', amount: compensation, description: `Kompensasi Retur Pembelian #${result.lastInsertRowid}`, reference_type: 'return_purchase', reference_id: result.lastInsertRowid, date: new Date().toISOString() });
      }
    })();
    
    req.session.flash = { success: 'Retur pembelian berhasil dibuat' };
  } catch (error) {
    req.session.flash = { error: 'Gagal membuat retur pembelian' };
  }
  res.redirect('/return-purchases');
});

module.exports = router;
