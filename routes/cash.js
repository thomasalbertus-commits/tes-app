const express = require('express');
const router = express.Router();
const { CashAccount, CashFlow } = require('../models');

router.get('/', (req, res) => {
  const ownerId = req.effectiveOwnerId;
  const storeId = req.effectiveStoreId;
  const cashAccounts = CashAccount.findByOwnerAndStore(ownerId, storeId);
  const cashFlows = CashFlow.findAll({ owner_id: ownerId }, 'date DESC', 100);
  
  res.render('cash/index', {
    title: 'Kas',
    pageTitle: 'Manajemen Kas',
    cashAccounts,
    cashFlows
  });
});

// Create cash account
router.post('/accounts', (req, res) => {
  try {
    CashAccount.create({
      owner_id: req.effectiveOwnerId,
      store_id: req.effectiveStoreId,
      name: req.body.name,
      type: req.body.type || 'cash',
      color: req.body.color || '#3b82f6',
      balance: parseFloat(req.body.balance) || 0
    });
    req.session.flash = { success: 'Akun kas berhasil ditambahkan' };
  } catch (e) {
    req.session.flash = { error: 'Gagal menambah akun kas' };
  }
  res.redirect('/cash');
});

// Update cash account
router.post('/accounts/:id', (req, res) => {
  try {
    CashAccount.update(req.params.id, {
      name: req.body.name,
      type: req.body.type || 'cash',
      color: req.body.color || '#3b82f6'
    });
    req.session.flash = { success: 'Akun kas berhasil diperbarui' };
  } catch (e) {
    req.session.flash = { error: 'Gagal memperbarui akun kas' };
  }
  res.redirect('/cash');
});

// Delete cash account
router.post('/accounts/:id/delete', (req, res) => {
  try {
    CashAccount.delete(req.params.id);
    req.session.flash = { success: 'Akun kas berhasil dihapus' };
  } catch (e) {
    req.session.flash = { error: 'Gagal menghapus akun kas' };
  }
  res.redirect('/cash');
});

// Record cash flow
router.post('/flow', (req, res) => {
  try {
    const amount = parseFloat(req.body.amount) || 0;
    CashFlow.create({
      owner_id: req.effectiveOwnerId,
      store_id: req.effectiveStoreId,
      type: req.body.type || 'in',
      amount,
      category: req.body.category || '',
      account_id: req.body.account_id || null,
      description: req.body.description || '',
      date: req.body.date || new Date().toISOString()
    });
    
    // Update cash account balance
    if (req.body.account_id) {
      const account = CashAccount.findById(req.body.account_id);
      if (account) {
        const newBalance = req.body.type === 'in' ? account.balance + amount : account.balance - amount;
        CashAccount.update(req.body.account_id, { balance: newBalance });
      }
    }
    
    req.session.flash = { success: 'Arus kas berhasil dicatat' };
  } catch (e) {
    req.session.flash = { error: 'Gagal mencatat arus kas' };
  }
  res.redirect('/cash');
});

module.exports = router;
