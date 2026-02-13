const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { Inventory, Brand, Category, Supplier, StockOpname } = require('../models');

// LIST inventory
router.get('/', (req, res) => {
  const ownerId = req.effectiveOwnerId;
  const storeId = req.effectiveStoreId;
  const search = req.query.search || '';
  const category = req.query.category || '';
  const brand = req.query.brand || '';
  const tab = req.query.tab || 'items';
  
  const items = Inventory.findByOwnerAndStore(ownerId, storeId, search, category, brand);
  const lowStock = Inventory.getLowStock(ownerId, storeId);
  const brands = Brand.findAll({ owner_id: ownerId }, 'name ASC');
  const categories = Category.findAll({ owner_id: ownerId, type: 'category' }, 'name ASC');
  const stockValue = Inventory.getTotalStockValue(ownerId, storeId);
  const suppliers = Supplier.findAll({ owner_id: ownerId }, 'name ASC');
  
  // Stock opname history
  const opnameHistory = StockOpname.findAll({ owner_id: ownerId }, 'created_at DESC', 50);
  
  res.render('inventory/index', {
    title: 'Stok',
    pageTitle: 'Manajemen Stok',
    items,
    lowStock,
    brands,
    categories,
    suppliers,
    stockValue,
    opnameHistory,
    search,
    category,
    brand,
    tab,
    queryString: `&search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}&brand=${encodeURIComponent(brand)}`
  });
});

// NEW item form
router.get('/new', (req, res) => {
  const ownerId = req.effectiveOwnerId;
  const brands = Brand.findAll({ owner_id: ownerId }, 'name ASC');
  const categories = Category.findAll({ owner_id: ownerId, type: 'category' }, 'name ASC');
  const suppliers = Supplier.findAll({ owner_id: ownerId }, 'name ASC');
  
  // Get sub-categories
  const db = getDb();
  const subCategories = db.prepare("SELECT * FROM categories WHERE owner_id = ? AND type = 'sub_category' ORDER BY name").all(ownerId);
  
  res.render('inventory/form', {
    title: 'Tambah Barang',
    pageTitle: 'Tambah Barang Baru',
    item: null,
    brands,
    categories,
    subCategories,
    suppliers,
    isEdit: false
  });
});

// CREATE item
router.post('/', (req, res) => {
  try {
    Inventory.create({
      owner_id: req.effectiveOwnerId,
      store_id: req.effectiveStoreId,
      name: req.body.name,
      category: req.body.category || '',
      sub_category: req.body.sub_category || '',
      brand: req.body.brand || '',
      supplier_id: req.body.supplier_id || null,
      stock: parseInt(req.body.stock) || 0,
      min_stock: parseInt(req.body.min_stock) || 0,
      buy_price: parseFloat(req.body.buy_price) || 0,
      sell_price: parseFloat(req.body.sell_price) || 0
    });
    req.session.flash = { success: 'Barang berhasil ditambahkan' };
  } catch (error) {
    req.session.flash = { error: 'Gagal menambah barang: ' + error.message };
  }
  res.redirect('/inventory');
});

// EDIT item form 
router.get('/:id/edit', (req, res) => {
  const item = Inventory.findById(req.params.id);
  if (!item) { req.session.flash = { error: 'Barang tidak ditemukan' }; return res.redirect('/inventory'); }
  
  const ownerId = req.effectiveOwnerId;
  const brands = Brand.findAll({ owner_id: ownerId }, 'name ASC');
  const categories = Category.findAll({ owner_id: ownerId, type: 'category' }, 'name ASC');
  const suppliers = Supplier.findAll({ owner_id: ownerId }, 'name ASC');
  const db = getDb();
  const subCategories = db.prepare("SELECT * FROM categories WHERE owner_id = ? AND type = 'sub_category' ORDER BY name").all(ownerId);
  
  res.render('inventory/form', {
    title: 'Edit Barang',
    pageTitle: 'Edit Barang',
    item,
    brands,
    categories,
    subCategories,
    suppliers,
    isEdit: true
  });
});

// UPDATE item
router.post('/:id', (req, res) => {
  try {
    Inventory.update(req.params.id, {
      name: req.body.name,
      category: req.body.category || '',
      sub_category: req.body.sub_category || '',
      brand: req.body.brand || '',
      supplier_id: req.body.supplier_id || null,
      stock: parseInt(req.body.stock) || 0,
      min_stock: parseInt(req.body.min_stock) || 0,
      buy_price: parseFloat(req.body.buy_price) || 0,
      sell_price: parseFloat(req.body.sell_price) || 0,
      updated_at: new Date().toISOString()
    });
    req.session.flash = { success: 'Barang berhasil diperbarui' };
  } catch (error) {
    req.session.flash = { error: 'Gagal memperbarui barang' };
  }
  res.redirect('/inventory');
});

// ADJUST stock
router.post('/:id/adjust', (req, res) => {
  try {
    const qty = parseInt(req.body.adjustment) || 0;
    const item = Inventory.findById(req.params.id);
    if (item && qty !== 0) {
      Inventory.adjustStock(req.params.id, qty);
      // Log opname
      StockOpname.create({
        owner_id: req.effectiveOwnerId,
        store_id: req.effectiveStoreId,
        inventory_id: req.params.id,
        item_name: item.name,
        old_stock: item.stock,
        new_stock: item.stock + qty,
        difference: qty,
        notes: req.body.notes || 'Penyesuaian stok manual'
      });
    }
    req.session.flash = { success: 'Stok berhasil disesuaikan' };
  } catch (error) {
    req.session.flash = { error: 'Gagal menyesuaikan stok' };
  }
  res.redirect('/inventory');
});

// DELETE item
router.post('/:id/delete', (req, res) => {
  try {
    Inventory.delete(req.params.id);
    req.session.flash = { success: 'Barang berhasil dihapus' };
  } catch (error) {
    req.session.flash = { error: 'Gagal menghapus barang' };
  }
  res.redirect('/inventory');
});

module.exports = router;
