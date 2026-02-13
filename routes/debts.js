const express = require('express');
const router = express.Router();
const { Debt, Transaction, CashAccount } = require('../models');

// Utang (payable)
router.get('/payable', (req, res) => {
  const debts = Debt.findAll({ owner_id: req.effectiveOwnerId, type: 'payable' }, 'created_at DESC');
  const cashAccounts = CashAccount.findByOwnerAndStore(req.effectiveOwnerId, req.effectiveStoreId);
  debts.forEach(d => { d.payments = Debt.getPayments(d.id); });
  res.render('debts/index', { title: 'Utang', pageTitle: 'Utang (Payable)', debts, cashAccounts, debtType: 'payable' });
});

// Piutang (receivable)
router.get('/receivable', (req, res) => {
  const debts = Debt.findAll({ owner_id: req.effectiveOwnerId, type: 'receivable' }, 'created_at DESC');
  const cashAccounts = CashAccount.findByOwnerAndStore(req.effectiveOwnerId, req.effectiveStoreId);
  debts.forEach(d => { d.payments = Debt.getPayments(d.id); });
  res.render('debts/index', { title: 'Piutang', pageTitle: 'Piutang (Receivable)', debts, cashAccounts, debtType: 'receivable' });
});

// Create debt
router.post('/', (req, res) => {
  try {
    const amount = parseFloat(req.body.amount) || 0;
    Debt.create({
      owner_id: req.effectiveOwnerId,
      store_id: req.effectiveStoreId,
      type: req.body.type,
      party_name: req.body.party_name,
      amount, paid: 0, remaining: amount,
      status: 'Belum Lunas',
      notes: req.body.notes || ''
    });
    req.session.flash = { success: `${req.body.type === 'payable' ? 'Utang' : 'Piutang'} berhasil ditambahkan` };
  } catch (e) {
    req.session.flash = { error: 'Gagal menambah data' };
  }
  res.redirect(`/debts/${req.body.type}`);
});

// Pay debt
router.post('/:id/pay', (req, res) => {
  const debt = Debt.findById(req.params.id);
  if (!debt) { return res.redirect('/debts/payable'); }
  
  try {
    const amount = parseFloat(req.body.amount) || 0;
    Debt.addPayment(debt.id, {
      amount,
      cash_account_id: req.body.cash_account_id || null,
      notes: req.body.notes || ''
    });
    
    // Create transaction
    Transaction.create({
      owner_id: req.effectiveOwnerId,
      store_id: req.effectiveStoreId,
      type: debt.type === 'payable' ? 'expense' : 'income',
      category: debt.type === 'payable' ? 'Pembayaran Utang' : 'Pembayaran Piutang',
      amount,
      description: `Pembayaran ${debt.type === 'payable' ? 'Utang' : 'Piutang'} - ${debt.party_name}`,
      cash_account_id: req.body.cash_account_id || null,
      reference_type: 'debt', reference_id: debt.id,
      date: new Date().toISOString()
    });
    
    req.session.flash = { success: 'Pembayaran berhasil dicatat' };
  } catch (error) {
    req.session.flash = { error: 'Gagal mencatat pembayaran' };
  }
  res.redirect(`/debts/${debt.type}`);
});

// Delete debt
router.post('/:id/delete', (req, res) => {
  const debt = Debt.findById(req.params.id);
  const redirectTo = debt ? `/debts/${debt.type}` : '/debts/payable';
  try {
    Debt.delete(req.params.id);
    req.session.flash = { success: 'Data berhasil dihapus' };
  } catch (e) {
    req.session.flash = { error: 'Gagal menghapus data' };
  }
  res.redirect(redirectTo);
});

module.exports = router;
