const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { Attendance, Payroll, Leave, Shift, SalarySetting, MonthlyBudget, User } = require('../models');

router.get('/', (req, res) => {
  const ownerId = req.effectiveOwnerId;
  const storeId = req.effectiveStoreId;
  const tab = req.query.tab || 'attendance';
  
  const employees = User.findByOwner(ownerId);
  const today = new Date().toISOString().split('T')[0];
  const month = req.query.month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  
  const attendance = Attendance.findAll({ owner_id: ownerId, date: today }, 'created_at DESC');
  const payrolls = Payroll.findAll({ owner_id: ownerId, month }, 'created_at DESC');
  const leaves = Leave.findAll({ owner_id: ownerId }, 'created_at DESC', 50);
  const shifts = Shift.findAll({ owner_id: ownerId }, 'name ASC');
  const salarySettings = SalarySetting.findAll({ owner_id: ownerId });
  const budgets = MonthlyBudget.findAll({ owner_id: ownerId }, 'due_date ASC');
  
  res.render('hr/index', {
    title: 'HR & Payroll',
    pageTitle: 'HR & Payroll',
    tab, employees, attendance, payrolls, leaves, shifts, salarySettings, budgets, today, month
  });
});

// Check-in
router.post('/checkin', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const user = User.findById(req.body.user_id);
    
    Attendance.create({
      owner_id: req.effectiveOwnerId,
      store_id: req.effectiveStoreId,
      user_id: req.body.user_id,
      user_name: user ? user.name : '',
      date: today,
      check_in: now
    });
    req.session.flash = { success: 'Check-in berhasil' };
  } catch (e) {
    req.session.flash = { error: 'Gagal check-in' };
  }
  res.redirect('/hr?tab=attendance');
});

// Check-out
router.post('/checkout/:id', (req, res) => {
  try {
    const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const att = Attendance.findById(req.params.id);
    let workHours = 0;
    if (att && att.check_in) {
      const [inH, inM] = att.check_in.split(':').map(Number);
      const [outH, outM] = now.split(':').map(Number);
      workHours = Math.round(((outH * 60 + outM) - (inH * 60 + inM)) / 60 * 10) / 10;
    }
    Attendance.update(req.params.id, { check_out: now, work_hours: workHours });
    req.session.flash = { success: 'Check-out berhasil' };
  } catch (e) {
    req.session.flash = { error: 'Gagal check-out' };
  }
  res.redirect('/hr?tab=attendance');
});

// Save salary setting
router.post('/salary', (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM salary_settings WHERE owner_id = ? AND user_id = ?').get(req.effectiveOwnerId, req.body.user_id);
    if (existing) {
      SalarySetting.update(existing.id, {
        base_salary: parseFloat(req.body.base_salary) || 0,
        commission_rate: parseFloat(req.body.commission_rate) || 0
      });
    } else {
      SalarySetting.create({
        owner_id: req.effectiveOwnerId,
        store_id: req.effectiveStoreId,
        user_id: req.body.user_id,
        base_salary: parseFloat(req.body.base_salary) || 0,
        commission_rate: parseFloat(req.body.commission_rate) || 0
      });
    }
    req.session.flash = { success: 'Setting gaji berhasil disimpan' };
  } catch (e) {
    req.session.flash = { error: 'Gagal menyimpan setting gaji' };
  }
  res.redirect('/hr?tab=salary');
});

// Generate payroll
router.post('/payroll', (req, res) => {
  try {
    const user = User.findById(req.body.user_id);
    Payroll.create({
      owner_id: req.effectiveOwnerId,
      store_id: req.effectiveStoreId,
      user_id: req.body.user_id,
      user_name: user ? user.name : '',
      month: req.body.month,
      base_salary: parseFloat(req.body.base_salary) || 0,
      commission: parseFloat(req.body.commission) || 0,
      commission_rate: parseFloat(req.body.commission_rate) || 0,
      bonus: parseFloat(req.body.bonus) || 0,
      deduction: parseFloat(req.body.deduction) || 0,
      total_salary: parseFloat(req.body.total_salary) || 0,
      status: 'draft'
    });
    req.session.flash = { success: 'Payroll berhasil dibuat' };
  } catch (e) {
    req.session.flash = { error: 'Gagal membuat payroll' };
  }
  res.redirect('/hr?tab=payroll');
});

// Mark payroll as paid
router.post('/payroll/:id/pay', (req, res) => {
  try {
    Payroll.update(req.params.id, { status: 'paid' });
    req.session.flash = { success: 'Payroll ditandai sudah dibayar' };
  } catch (e) {
    req.session.flash = { error: 'Gagal update payroll' };
  }
  res.redirect('/hr?tab=payroll');
});

// Submit leave
router.post('/leave', (req, res) => {
  try {
    const user = User.findById(req.body.user_id);
    Leave.create({
      owner_id: req.effectiveOwnerId,
      store_id: req.effectiveStoreId,
      user_id: req.body.user_id,
      user_name: user ? user.name : '',
      type: req.body.type || 'Cuti',
      start_date: req.body.start_date,
      end_date: req.body.end_date,
      reason: req.body.reason || '',
      status: 'pending'
    });
    req.session.flash = { success: 'Pengajuan cuti berhasil' };
  } catch (e) {
    req.session.flash = { error: 'Gagal mengajukan cuti' };
  }
  res.redirect('/hr?tab=leave');
});

// Approve/reject leave
router.post('/leave/:id/status', (req, res) => {
  try {
    Leave.update(req.params.id, { status: req.body.status });
    req.session.flash = { success: `Cuti ${req.body.status === 'approved' ? 'disetujui' : 'ditolak'}` };
  } catch (e) {
    req.session.flash = { error: 'Gagal update status cuti' };
  }
  res.redirect('/hr?tab=leave');
});

// Shifts CRUD
router.post('/shift', (req, res) => {
  try {
    Shift.create({
      owner_id: req.effectiveOwnerId, store_id: req.effectiveStoreId,
      name: req.body.name, start_time: req.body.start_time, end_time: req.body.end_time
    });
    req.session.flash = { success: 'Shift berhasil ditambahkan' };
  } catch (e) { req.session.flash = { error: 'Gagal menambah shift' }; }
  res.redirect('/hr?tab=shift');
});

router.post('/shift/:id/delete', (req, res) => {
  try { Shift.delete(req.params.id); req.session.flash = { success: 'Shift dihapus' }; }
  catch (e) { req.session.flash = { error: 'Gagal menghapus shift' }; }
  res.redirect('/hr?tab=shift');
});

// Budget CRUD
router.post('/budget', (req, res) => {
  try {
    MonthlyBudget.create({
      owner_id: req.effectiveOwnerId, store_id: req.effectiveStoreId,
      name: req.body.name, amount: parseFloat(req.body.amount) || 0,
      category: req.body.category || '', due_date: req.body.due_date || ''
    });
    req.session.flash = { success: 'Anggaran berhasil ditambahkan' };
  } catch (e) { req.session.flash = { error: 'Gagal menambah anggaran' }; }
  res.redirect('/hr?tab=budget');
});

router.post('/budget/:id/delete', (req, res) => {
  try { MonthlyBudget.delete(req.params.id); req.session.flash = { success: 'Anggaran dihapus' }; }
  catch (e) { req.session.flash = { error: 'Gagal menghapus anggaran' }; }
  res.redirect('/hr?tab=budget');
});

module.exports = router;
