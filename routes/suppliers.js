const express = require('express');
const router = express.Router();
const { Supplier } = require('../models');

router.get('/', (req, res) => {
  const suppliers = Supplier.findAll({ owner_id: req.effectiveOwnerId }, 'name ASC');
  res.render('suppliers/index', { title: 'Supplier', pageTitle: 'Supplier', suppliers });
});

router.post('/', (req, res) => {
  try {
    Supplier.create({
      owner_id: req.effectiveOwnerId,
      store_id: req.effectiveStoreId,
      name: req.body.name,
      phone: req.body.phone || '',
      address: req.body.address || '',
      email: req.body.email || ''
    });
    req.session.flash = { success: 'Supplier berhasil ditambahkan' };
  } catch (e) {
    req.session.flash = { error: 'Gagal menambah supplier' };
  }
  res.redirect('/suppliers');
});

router.post('/:id', (req, res) => {
  try {
    Supplier.update(req.params.id, {
      name: req.body.name,
      phone: req.body.phone || '',
      address: req.body.address || '',
      email: req.body.email || ''
    });
    req.session.flash = { success: 'Supplier berhasil diperbarui' };
  } catch (e) {
    req.session.flash = { error: 'Gagal memperbarui supplier' };
  }
  res.redirect('/suppliers');
});

router.post('/:id/delete', (req, res) => {
  try {
    Supplier.delete(req.params.id);
    req.session.flash = { success: 'Supplier berhasil dihapus' };
  } catch (e) {
    req.session.flash = { error: 'Gagal menghapus supplier' };
  }
  res.redirect('/suppliers');
});

module.exports = router;
