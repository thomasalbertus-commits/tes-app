const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { Purchase, Inventory, Supplier, Transaction, Debt, CashAccount } = require('../models');

router.get('/', (req, res) => {
  const purchases = Purchase.findAll({ owner_id: req.effectiveOwnerId }, 'created_at DESC', 100);
  // Add items to each purchase
  const db = getDb();
  purchases.forEach(p => {
    p.items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(p.id);
  });
  res.render('purchases/index', { title: 'Pembelian', pageTitle: 'Pembelian', purchases, queryString: '' });
});

router.get('/new', (req, res) => {
  const ownerId = req.effectiveOwnerId;
  const storeId = req.effectiveStoreId;
  const suppliers = Supplier.findAll({ owner_id: ownerId }, 'name ASC');
  const inventoryItems = Inventory.findByOwnerAndStore(ownerId, storeId);
  const cashAccounts = CashAccount.findByOwnerAndStore(ownerId, storeId);
  res.render('purchases/form', { title: 'Pembelian Baru', pageTitle: 'Pembelian Baru', suppliers, inventoryItems, cashAccounts });
});

router.post('/', (req, res) => {
  const ownerId = req.effectiveOwnerId;
  const storeId = req.effectiveStoreId;
  const db = getDb();
  
  try {
    const items = req.body.items || [];
    const total = items.reduce((sum, item) => sum + (parseFloat(item.buy_price) * parseInt(item.qty || 1)), 0);
    
    const transaction = db.transaction(() => {
      const purchase = Purchase.create({
        owner_id: ownerId, store_id: storeId,
        supplier_id: req.body.supplier_id || null,
        supplier_name: req.body.supplier_name || '',
        total,
        payment_method: req.body.payment_method || 'cash',
        cash_account_id: req.body.cash_account_id || null,
        notes: req.body.notes || ''
      });
      
      const insertItem = db.prepare('INSERT INTO purchase_items (purchase_id, inventory_id, name, qty, buy_price) VALUES (?, ?, ?, ?, ?)');
      for (const item of items) {
        insertItem.run(purchase.id, item.inventory_id || null, item.name, parseInt(item.qty) || 1, parseFloat(item.buy_price) || 0);
        if (item.inventory_id) {
          Inventory.adjustStock(parseInt(item.inventory_id), parseInt(item.qty) || 1);
        }
      }
      
      // Transaction expense
      Transaction.create({
        owner_id: ownerId, store_id: storeId,
        type: 'expense', category: 'Pembelian Barang',
        amount: total,
        description: `Pembelian #${purchase.id} - ${req.body.supplier_name || 'Supplier'}`,
        cash_account_id: req.body.cash_account_id || null,
        reference_type: 'purchase', reference_id: purchase.id,
        date: new Date().toISOString()
      });
      
      // If credit, create debt
      if (req.body.payment_method === 'credit') {
        Debt.create({
          owner_id: ownerId, store_id: storeId,
          type: 'payable',
          party_name: req.body.supplier_name || 'Supplier',
          amount: total, paid: 0, remaining: total,
          status: 'Belum Lunas',
          reference_type: 'purchase', reference_id: purchase.id
        });
      }
      
      return purchase;
    });
    
    transaction();
    req.session.flash = { success: 'Pembelian berhasil dibuat' };
  } catch (error) {
    req.session.flash = { error: 'Gagal membuat pembelian: ' + error.message };
  }
  res.redirect('/purchases');
});

router.post('/:id/delete', (req, res) => {
  const db = getDb();
  try {
    const purchase = Purchase.findWithItems(req.params.id);
    if (purchase) {
      db.transaction(() => {
        for (const item of (purchase.items || [])) {
          if (item.inventory_id) Inventory.adjustStock(item.inventory_id, -(item.qty));
        }
        db.prepare("DELETE FROM transactions WHERE reference_type = 'purchase' AND reference_id = ?").run(purchase.id);
        db.prepare("DELETE FROM debts WHERE reference_type = 'purchase' AND reference_id = ?").run(purchase.id);
        Purchase.delete(purchase.id);
      })();
    }
    req.session.flash = { success: 'Pembelian berhasil dihapus' };
  } catch (error) {
    req.session.flash = { error: 'Gagal menghapus pembelian' };
  }
  res.redirect('/purchases');
});

module.exports = router;
