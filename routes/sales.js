const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { Sale, Inventory, Transaction, Customer, CashAccount } = require('../models');

// LIST sales
router.get('/', (req, res) => {
  const ownerId = req.effectiveOwnerId;
  const storeId = req.effectiveStoreId;
  const page = parseInt(req.query.page) || 1;
  
  const result = Sale.paginateByOwner(ownerId, storeId, page, 25);
  
  res.render('sales/index', {
    title: 'Penjualan',
    pageTitle: 'Penjualan',
    sales: result.items,
    pagination: result,
    queryString: ''
  });
});

// NEW sale (POS)
router.get('/new', (req, res) => {
  const ownerId = req.effectiveOwnerId;
  const storeId = req.effectiveStoreId;
  
  const inventoryItems = Inventory.findByOwnerAndStore(ownerId, storeId);
  const customers = Customer.findAll({ owner_id: ownerId }, 'name ASC', 100);
  const cashAccounts = CashAccount.findByOwnerAndStore(ownerId, storeId);
  
  res.render('sales/form', {
    title: 'Penjualan Baru',
    pageTitle: 'POS - Penjualan Baru',
    inventoryItems,
    customers,
    cashAccounts
  });
});

// CREATE sale
router.post('/', (req, res) => {
  const ownerId = req.effectiveOwnerId;
  const storeId = req.effectiveStoreId;
  const db = getDb();
  
  try {
    const items = req.body.items || [];
    if (!Array.isArray(items) || items.length === 0) {
      req.session.flash = { error: 'Tambahkan minimal 1 item' };
      return res.redirect('/sales/new');
    }
    
    const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.price) * parseInt(item.qty || 1)), 0);
    const discountType = req.body.discount_type || 'nominal';
    const discountValue = parseFloat(req.body.discount) || 0;
    const discountAmount = discountType === 'percent' ? (subtotal * discountValue / 100) : discountValue;
    const total = subtotal - discountAmount;
    
    const transaction = db.transaction(() => {
      const sale = Sale.create({
        owner_id: ownerId,
        store_id: storeId,
        customer_name: req.body.customer_name || 'Umum',
        customer_id: req.body.customer_id || null,
        subtotal,
        discount: discountValue,
        discount_type: discountType,
        discount_amount: discountAmount,
        total,
        payment_method: req.body.payment_method || 'cash',
        cash_account_id: req.body.cash_account_id || null,
        notes: req.body.notes || ''
      });
      
      // Add sale items and reduce stock
      const insertItem = db.prepare('INSERT INTO sale_items (sale_id, inventory_id, name, qty, price, buy_price, category) VALUES (?, ?, ?, ?, ?, ?, ?)');
      
      for (const item of items) {
        insertItem.run(sale.id, item.inventory_id || null, item.name, parseInt(item.qty) || 1, parseFloat(item.price) || 0, parseFloat(item.buy_price) || 0, item.category || '');
        
        if (item.inventory_id) {
          Inventory.adjustStock(parseInt(item.inventory_id), -(parseInt(item.qty) || 1));
        }
      }
      
      // Create income transaction
      Transaction.create({
        owner_id: ownerId,
        store_id: storeId,
        type: 'income',
        category: 'Penjualan',
        amount: total,
        description: `Penjualan #${sale.id} - ${req.body.customer_name || 'Umum'}`,
        cash_account_id: req.body.cash_account_id || null,
        reference_type: 'sale',
        reference_id: sale.id,
        date: new Date().toISOString()
      });
      
      return sale;
    });
    
    const sale = transaction();
    req.session.flash = { success: `Penjualan #${sale.id} berhasil dibuat` };
    res.redirect('/sales');
  } catch (error) {
    console.error('Error creating sale:', error);
    req.session.flash = { error: 'Gagal membuat penjualan: ' + error.message };
    res.redirect('/sales/new');
  }
});

// VIEW sale detail
router.get('/:id', (req, res) => {
  const sale = Sale.findWithItems(req.params.id);
  if (!sale) {
    req.session.flash = { error: 'Penjualan tidak ditemukan' };
    return res.redirect('/sales');
  }
  
  res.render('sales/detail', {
    title: `Penjualan #${sale.id}`,
    pageTitle: `Detail Penjualan #${sale.id}`,
    sale
  });
});

// DELETE sale
router.post('/:id/delete', (req, res) => {
  const db = getDb();
  
  try {
    const sale = Sale.findWithItems(req.params.id);
    if (sale) {
      db.transaction(() => {
        // Restore stock
        for (const item of (sale.items || [])) {
          if (item.inventory_id) {
            Inventory.adjustStock(item.inventory_id, item.qty);
          }
        }
        // Delete related transactions
        db.prepare("DELETE FROM transactions WHERE reference_type = 'sale' AND reference_id = ?").run(sale.id);
        Sale.delete(sale.id);
      })();
    }
    req.session.flash = { success: 'Penjualan berhasil dihapus' };
  } catch (error) {
    req.session.flash = { error: 'Gagal menghapus penjualan' };
  }
  res.redirect('/sales');
});

module.exports = router;
