const express = require('express');
const router = express.Router();
const { Transaction, CashAccount } = require('../models');

router.get('/', (req, res) => {
  const ownerId = req.effectiveOwnerId;
  const storeId = req.effectiveStoreId;
  
  const filter = req.query.filter || 'month';
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  let startDate, endDate;
  
  switch (filter) {
    case 'today':
      startDate = today; endDate = today + ' 23:59:59'; break;
    case 'month':
      startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      endDate = today + ' 23:59:59'; break;
    case 'year':
      startDate = `${now.getFullYear()}-01-01`; endDate = today + ' 23:59:59'; break;
    default:
      startDate = req.query.startDate || today;
      endDate = (req.query.endDate || today) + ' 23:59:59';
  }
  
  const transactions = Transaction.getByDateRange(ownerId, storeId, startDate, endDate);
  const summary = Transaction.getSummary(ownerId, storeId, startDate, endDate);
  const cashAccounts = CashAccount.findByOwnerAndStore(ownerId, storeId);
  
  res.render('finance/index', {
    title: 'Laporan Keuangan',
    pageTitle: 'Laporan Keuangan',
    transactions, summary, cashAccounts, filter,
    startDate: req.query.startDate || '',
    endDate: req.query.endDate || ''
  });
});

// Add operational expense
router.post('/expense', (req, res) => {
  try {
    Transaction.create({
      owner_id: req.effectiveOwnerId,
      store_id: req.effectiveStoreId,
      type: 'expense',
      category: 'Pengeluaran Operasional',
      amount: parseFloat(req.body.amount) || 0,
      description: req.body.description || '',
      cash_account_id: req.body.cash_account_id || null,
      date: req.body.date || new Date().toISOString()
    });
    req.session.flash = { success: 'Pengeluaran berhasil dicatat' };
  } catch (error) {
    req.session.flash = { error: 'Gagal mencatat pengeluaran' };
  }
  res.redirect('/finance');
});

module.exports = router;
