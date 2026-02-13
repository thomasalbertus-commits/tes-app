const express = require('express');
const router = express.Router();
const { Customer } = require('../models');

router.get('/', (req, res) => {
  const customers = Customer.findAll({ owner_id: req.effectiveOwnerId }, 'name ASC');
  res.render('customers/index', { title: 'Pelanggan', pageTitle: 'Pelanggan', customers });
});

router.post('/', (req, res) => {
  try {
    Customer.create({
      owner_id: req.effectiveOwnerId,
      store_id: req.effectiveStoreId,
      name: req.body.name,
      phone: req.body.phone || '',
      address: req.body.address || '',
      email: req.body.email || ''
    });
    req.session.flash = { success: 'Pelanggan berhasil ditambahkan' };
  } catch (e) {
    req.session.flash = { error: 'Gagal menambah pelanggan' };
  }
  res.redirect('/customers');
});

router.post('/:id', (req, res) => {
  try {
    Customer.update(req.params.id, {
      name: req.body.name,
      phone: req.body.phone || '',
      address: req.body.address || '',
      email: req.body.email || ''
    });
    req.session.flash = { success: 'Pelanggan berhasil diperbarui' };
  } catch (e) {
    req.session.flash = { error: 'Gagal memperbarui pelanggan' };
  }
  res.redirect('/customers');
});

router.post('/:id/delete', (req, res) => {
  try {
    Customer.delete(req.params.id);
    req.session.flash = { success: 'Pelanggan berhasil dihapus' };
  } catch (e) {
    req.session.flash = { error: 'Gagal menghapus pelanggan' };
  }
  res.redirect('/customers');
});

module.exports = router;
