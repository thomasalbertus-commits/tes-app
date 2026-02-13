const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { Service, Sale, Inventory, Transaction } = require('../models');

router.get('/', (req, res) => {
  const ownerId = req.effectiveOwnerId;
  const storeId = req.effectiveStoreId;
  const tab = req.query.tab || 'summary';
  const db = getDb();
  
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const today = now.toISOString().split('T')[0] + ' 23:59:59';
  
  // Summary
  const txSummary = Transaction.getSummary(ownerId, storeId, monthStart, today);
  
  // Sales data
  const sales = Sale.findAll({ owner_id: ownerId }, 'created_at DESC', 100);
  sales.forEach(s => {
    s.items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(s.id);
  });
  
  // Service data
  const services = Service.getByOwnerAndStore(ownerId, storeId);
  
  // Inventory data
  const inventory = Inventory.findByOwnerAndStore(ownerId, storeId);
  
  // Profit/Loss
  const transactions = Transaction.getByDateRange(ownerId, storeId, monthStart, today);
  const incomeByCategory = {};
  const expenseByCategory = {};
  transactions.forEach(t => {
    if (t.type === 'income') {
      incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + t.amount;
    } else if (t.type === 'expense') {
      expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + t.amount;
    }
  });
  
  // Top products
  const topProducts = db.prepare(`
    SELECT name, SUM(qty) as total_qty, SUM(price * qty) as total_revenue
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    WHERE s.owner_id = ? AND s.created_at >= ?
    GROUP BY name ORDER BY total_qty DESC LIMIT 10
  `).all(ownerId, monthStart);
  
  res.render('reports/index', {
    title: 'Laporan',
    pageTitle: 'Laporan',
    tab, txSummary, sales, services, inventory, transactions,
    incomeByCategory, expenseByCategory, topProducts
  });
});

module.exports = router;
