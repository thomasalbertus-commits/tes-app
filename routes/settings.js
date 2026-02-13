const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { Store, Brand, Category } = require('../models');

router.get('/', (req, res) => {
  const ownerId = req.effectiveOwnerId;
  const storeId = req.effectiveStoreId;
  const db = getDb();
  const tab = req.query.tab || 'store';
  
  const stores = Store.findByOwner(ownerId);
  const brands = Brand.findAll({ owner_id: ownerId }, 'name ASC');
  const categories = Category.findAll({ owner_id: ownerId, type: 'category' }, 'name ASC');
  const subCategories = db.prepare("SELECT * FROM categories WHERE owner_id = ? AND type = 'sub_category' ORDER BY name").all(ownerId);
  const qcItems = db.prepare('SELECT * FROM qc_functional_items WHERE owner_id = ? OR is_master = 1 ORDER BY name').all(ownerId);
  const kelengkapanItems = db.prepare('SELECT * FROM kelengkapan_items WHERE owner_id = ? OR is_master = 1 ORDER BY name').all(ownerId);
  
  const currentStore = storeId ? Store.findById(storeId) : (stores.length > 0 ? stores[0] : null);
  
  res.render('settings/index', {
    title: 'Pengaturan',
    pageTitle: 'Pengaturan',
    tab, stores, brands, categories, subCategories, qcItems, kelengkapanItems,
    storeData: currentStore
  });
});

// Update store
router.post('/store', (req, res) => {
  try {
    if (req.body.store_id) {
      Store.update(req.body.store_id, {
        name: req.body.name,
        address: req.body.address || '',
        phone: req.body.phone || '',
        logo: req.body.logo || ''
      });
    } else {
      Store.create({
        owner_id: req.effectiveOwnerId,
        name: req.body.name,
        address: req.body.address || '',
        phone: req.body.phone || '',
        logo: req.body.logo || ''
      });
    }
    req.session.flash = { success: 'Toko berhasil disimpan' };
  } catch (e) {
    req.session.flash = { error: 'Gagal menyimpan toko' };
  }
  res.redirect('/settings?tab=store');
});

// Brand CRUD
router.post('/brand', (req, res) => {
  try {
    Brand.create({ owner_id: req.effectiveOwnerId, name: req.body.name });
    req.session.flash = { success: 'Brand berhasil ditambahkan' };
  } catch (e) { req.session.flash = { error: 'Gagal menambah brand' }; }
  res.redirect('/settings?tab=master');
});

router.post('/brand/:id/delete', (req, res) => {
  try { Brand.delete(req.params.id); req.session.flash = { success: 'Brand dihapus' }; }
  catch (e) { req.session.flash = { error: 'Gagal menghapus brand' }; }
  res.redirect('/settings?tab=master');
});

// Category CRUD
router.post('/category', (req, res) => {
  try {
    Category.create({
      owner_id: req.effectiveOwnerId,
      name: req.body.name,
      type: req.body.type || 'category',
      parent_category: req.body.parent_category || null
    });
    req.session.flash = { success: 'Kategori berhasil ditambahkan' };
  } catch (e) { req.session.flash = { error: 'Gagal menambah kategori' }; }
  res.redirect('/settings?tab=master');
});

router.post('/category/:id/delete', (req, res) => {
  try { Category.delete(req.params.id); req.session.flash = { success: 'Kategori dihapus' }; }
  catch (e) { req.session.flash = { error: 'Gagal menghapus kategori' }; }
  res.redirect('/settings?tab=master');
});

// QC Items
router.post('/qc', (req, res) => {
  try {
    const db = getDb();
    db.prepare('INSERT INTO qc_functional_items (owner_id, name, is_master) VALUES (?, ?, 0)').run(req.effectiveOwnerId, req.body.name);
    req.session.flash = { success: 'Item QC berhasil ditambahkan' };
  } catch (e) { req.session.flash = { error: 'Gagal menambah item QC' }; }
  res.redirect('/settings?tab=master');
});

router.post('/qc/:id/delete', (req, res) => {
  try { getDb().prepare('DELETE FROM qc_functional_items WHERE id = ? AND is_master = 0').run(req.params.id); req.session.flash = { success: 'Item QC dihapus' }; }
  catch (e) { req.session.flash = { error: 'Gagal menghapus item QC' }; }
  res.redirect('/settings?tab=master');
});

// Kelengkapan Items
router.post('/kelengkapan', (req, res) => {
  try {
    const db = getDb();
    db.prepare('INSERT INTO kelengkapan_items (owner_id, name, is_master) VALUES (?, ?, 0)').run(req.effectiveOwnerId, req.body.name);
    req.session.flash = { success: 'Item kelengkapan berhasil ditambahkan' };
  } catch (e) { req.session.flash = { error: 'Gagal menambah item kelengkapan' }; }
  res.redirect('/settings?tab=master');
});

router.post('/kelengkapan/:id/delete', (req, res) => {
  try { getDb().prepare('DELETE FROM kelengkapan_items WHERE id = ? AND is_master = 0').run(req.params.id); req.session.flash = { success: 'Item kelengkapan dihapus' }; }
  catch (e) { req.session.flash = { error: 'Gagal menghapus item kelengkapan' }; }
  res.redirect('/settings?tab=master');
});

module.exports = router;
