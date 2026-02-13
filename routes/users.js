const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { User, Store } = require('../models');

router.get('/', (req, res) => {
  const employees = User.findByOwner(req.effectiveOwnerId);
  const stores = Store.findByOwner(req.effectiveOwnerId);
  res.render('users/index', { title: 'Pegawai', pageTitle: 'Manajemen Pegawai', employees, stores });
});

// Create employee
router.post('/', (req, res) => {
  try {
    const existing = User.findByEmail(req.body.email.toLowerCase().trim());
    if (existing) {
      req.session.flash = { error: 'Email sudah terdaftar' };
      return res.redirect('/employees');
    }
    
    const hashedPassword = bcrypt.hashSync(req.body.password, 10);
    User.create({
      name: req.body.name,
      email: req.body.email.toLowerCase().trim(),
      password: hashedPassword,
      role: req.body.role || 'teknisi',
      owner_id: req.effectiveOwnerId,
      store_id: req.body.store_id || null,
      is_active: 1
    });
    req.session.flash = { success: 'Pegawai berhasil ditambahkan' };
  } catch (error) {
    req.session.flash = { error: 'Gagal menambah pegawai: ' + error.message };
  }
  res.redirect('/employees');
});

// Update employee
router.post('/:id', (req, res) => {
  try {
    const updateData = {
      name: req.body.name,
      role: req.body.role || 'teknisi',
      store_id: req.body.store_id || null,
      is_active: req.body.is_active ? 1 : 0,
      updated_at: new Date().toISOString()
    };
    
    // Only update password if provided
    if (req.body.password && req.body.password.trim()) {
      updateData.password = bcrypt.hashSync(req.body.password, 10);
    }
    
    User.update(req.params.id, updateData);
    req.session.flash = { success: 'Pegawai berhasil diperbarui' };
  } catch (error) {
    req.session.flash = { error: 'Gagal memperbarui pegawai' };
  }
  res.redirect('/employees');
});

// Delete employee
router.post('/:id/delete', (req, res) => {
  try {
    User.delete(req.params.id);
    req.session.flash = { success: 'Pegawai berhasil dihapus' };
  } catch (e) {
    req.session.flash = { error: 'Gagal menghapus pegawai' };
  }
  res.redirect('/employees');
});

module.exports = router;
