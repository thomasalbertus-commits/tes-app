const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { Service, Inventory, Transaction, Customer, CashAccount } = require('../models');

// LIST services
router.get('/', (req, res) => {
  const ownerId = req.effectiveOwnerId;
  const storeId = req.effectiveStoreId;
  const page = parseInt(req.query.page) || 1;
  const search = req.query.search || '';
  const status = req.query.status || '';
  
  const result = Service.paginateByOwner(ownerId, storeId, page, 25, search, status);
  
  const queryString = `&search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`;
  
  res.render('services/index', {
    title: 'Servis HP',
    pageTitle: 'Servis HP',
    services: result.items,
    pagination: result,
    search,
    status,
    queryString
  });
});

// NEW service form
router.get('/new', (req, res) => {
  const ownerId = req.effectiveOwnerId;
  const storeId = req.effectiveStoreId;
  
  const customers = Customer.findAll({ owner_id: ownerId }, 'name ASC', 100);
  const inventoryItems = Inventory.findByOwnerAndStore(ownerId, storeId);
  const cashAccounts = CashAccount.findByOwnerAndStore(ownerId, storeId);
  
  // Get QC items
  const db = getDb();
  let qcItems = db.prepare('SELECT * FROM qc_functional_items WHERE owner_id = ? OR is_master = 1 ORDER BY name').all(ownerId);
  let kelengkapanItems = db.prepare('SELECT * FROM kelengkapan_items WHERE owner_id = ? OR is_master = 1 ORDER BY name').all(ownerId);
  
  // Get technicians
  const technicians = db.prepare("SELECT * FROM users WHERE owner_id = ? AND role = 'teknisi'").all(ownerId);
  
  res.render('services/form', {
    title: 'Servis Baru',
    pageTitle: 'Tambah Servis Baru',
    service: null,
    customers,
    inventoryItems,
    cashAccounts,
    qcItems,
    kelengkapanItems,
    technicians,
    isEdit: false
  });
});

// CREATE service
router.post('/', (req, res) => {
  const ownerId = req.effectiveOwnerId;
  const storeId = req.effectiveStoreId;
  const db = getDb();
  
  try {
    const token = Service.generateToken();
    
    const serviceData = {
      owner_id: ownerId,
      store_id: storeId,
      token,
      customer_name: req.body.customer_name,
      phone: req.body.phone || '',
      unit_type: req.body.unit_type || '',
      complaint: req.body.complaint || '',
      status: 'Diterima',
      cost_estimate: parseFloat(req.body.cost_estimate) || 0,
      dp: parseFloat(req.body.dp) || 0,
      service_fee: parseFloat(req.body.service_fee) || 0,
      warranty: req.body.warranty || '',
      technician: req.body.technician || '',
      payment_status: req.body.payment_status || 'Belum Bayar',
      payment_method: req.body.payment_method || '',
      cash_account_id: req.body.cash_account_id || null,
      notes: req.body.notes || '',
      customer_id: req.body.customer_id || null
    };
    
    const transaction = db.transaction(() => {
      // Create service
      const service = Service.create(serviceData);
      
      // Add parts
      if (req.body.parts && Array.isArray(req.body.parts)) {
        const insertPart = db.prepare('INSERT INTO service_parts (service_id, inventory_id, name, qty, buy_price, sell_price) VALUES (?, ?, ?, ?, ?, ?)');
        
        for (const part of req.body.parts) {
          insertPart.run(
            service.id,
            part.inventory_id || null,
            part.name,
            parseInt(part.qty) || 1,
            parseFloat(part.buy_price) || 0,
            parseFloat(part.sell_price) || 0
          );
          
          // Reduce stock
          if (part.inventory_id) {
            Inventory.adjustStock(parseInt(part.inventory_id), -(parseInt(part.qty) || 1));
          }
        }
      }
      
      // Add QC checklist
      if (req.body.qc && Array.isArray(req.body.qc)) {
        const insertQc = db.prepare('INSERT INTO service_qc (service_id, item_name, checked) VALUES (?, ?, ?)');
        for (const item of req.body.qc) {
          insertQc.run(service.id, item.name, item.checked ? 1 : 0);
        }
      }
      
      // Add kelengkapan
      if (req.body.kelengkapan && Array.isArray(req.body.kelengkapan)) {
        const insertKel = db.prepare('INSERT INTO service_kelengkapan (service_id, item_name, checked) VALUES (?, ?, ?)');
        for (const item of req.body.kelengkapan) {
          insertKel.run(service.id, item.name, item.checked ? 1 : 0);
        }
      }
      
      // Create transactions for DP
      if (serviceData.dp > 0) {
        Transaction.create({
          owner_id: ownerId,
          store_id: storeId,
          type: 'income',
          category: 'DP Servis',
          amount: serviceData.dp,
          description: `DP Servis #${token} - ${serviceData.customer_name}`,
          cash_account_id: serviceData.cash_account_id,
          reference_type: 'service',
          reference_id: service.id,
          date: new Date().toISOString()
        });
      }
      
      return service;
    });
    
    const service = transaction();
    
    req.session.flash = { success: `Servis berhasil dibuat! Token: ${service.token}` };
    res.redirect('/services');
  } catch (error) {
    console.error('Error creating service:', error);
    req.session.flash = { error: 'Gagal membuat servis: ' + error.message };
    res.redirect('/services/new');
  }
});

// VIEW service detail
router.get('/:id', (req, res) => {
  const service = Service.findWithParts(req.params.id);
  if (!service) {
    req.session.flash = { error: 'Servis tidak ditemukan' };
    return res.redirect('/services');
  }
  
  const cashAccounts = CashAccount.findByOwnerAndStore(req.effectiveOwnerId, req.effectiveStoreId);
  
  res.render('services/detail', {
    title: `Servis #${service.token}`,
    pageTitle: `Detail Servis #${service.token}`,
    service,
    cashAccounts
  });
});

// EDIT service form
router.get('/:id/edit', (req, res) => {
  const ownerId = req.effectiveOwnerId;
  const storeId = req.effectiveStoreId;
  const db = getDb();
  
  const service = Service.findWithParts(req.params.id);
  if (!service) {
    req.session.flash = { error: 'Servis tidak ditemukan' };
    return res.redirect('/services');
  }
  
  const customers = Customer.findAll({ owner_id: ownerId }, 'name ASC', 100);
  const inventoryItems = Inventory.findByOwnerAndStore(ownerId, storeId);
  const cashAccounts = CashAccount.findByOwnerAndStore(ownerId, storeId);
  const qcItems = db.prepare('SELECT * FROM qc_functional_items WHERE owner_id = ? OR is_master = 1 ORDER BY name').all(ownerId);
  const kelengkapanItems = db.prepare('SELECT * FROM kelengkapan_items WHERE owner_id = ? OR is_master = 1 ORDER BY name').all(ownerId);
  const technicians = db.prepare("SELECT * FROM users WHERE owner_id = ? AND role = 'teknisi'").all(ownerId);
  
  res.render('services/form', {
    title: `Edit Servis #${service.token}`,
    pageTitle: `Edit Servis #${service.token}`,
    service,
    customers,
    inventoryItems,
    cashAccounts,
    qcItems,
    kelengkapanItems,
    technicians,
    isEdit: true
  });
});

// UPDATE service
router.post('/:id', (req, res) => {
  const ownerId = req.effectiveOwnerId;
  const storeId = req.effectiveStoreId;
  const db = getDb();
  const serviceId = req.params.id;
  
  try {
    const oldService = Service.findWithParts(serviceId);
    if (!oldService) {
      req.session.flash = { error: 'Servis tidak ditemukan' };
      return res.redirect('/services');
    }
    
    const transaction = db.transaction(() => {
      // Restore old stock
      for (const part of (oldService.parts || [])) {
        if (part.inventory_id) {
          Inventory.adjustStock(part.inventory_id, part.qty);
        }
      }
      
      // Update service
      Service.update(serviceId, {
        customer_name: req.body.customer_name,
        phone: req.body.phone || '',
        unit_type: req.body.unit_type || '',
        complaint: req.body.complaint || '',
        status: req.body.status || oldService.status,
        cost_estimate: parseFloat(req.body.cost_estimate) || 0,
        dp: parseFloat(req.body.dp) || 0,
        service_fee: parseFloat(req.body.service_fee) || 0,
        warranty: req.body.warranty || '',
        technician: req.body.technician || '',
        payment_status: req.body.payment_status || 'Belum Bayar',
        payment_method: req.body.payment_method || '',
        cash_account_id: req.body.cash_account_id || null,
        notes: req.body.notes || '',
        updated_at: new Date().toISOString()
      });
      
      // Delete old parts, QC, kelengkapan
      db.prepare('DELETE FROM service_parts WHERE service_id = ?').run(serviceId);
      db.prepare('DELETE FROM service_qc WHERE service_id = ?').run(serviceId);
      db.prepare('DELETE FROM service_kelengkapan WHERE service_id = ?').run(serviceId);
      
      // Re-add parts
      if (req.body.parts && Array.isArray(req.body.parts)) {
        const insertPart = db.prepare('INSERT INTO service_parts (service_id, inventory_id, name, qty, buy_price, sell_price) VALUES (?, ?, ?, ?, ?, ?)');
        for (const part of req.body.parts) {
          insertPart.run(serviceId, part.inventory_id || null, part.name, parseInt(part.qty) || 1, parseFloat(part.buy_price) || 0, parseFloat(part.sell_price) || 0);
          if (part.inventory_id) {
            Inventory.adjustStock(parseInt(part.inventory_id), -(parseInt(part.qty) || 1));
          }
        }
      }
      
      // Re-add QC
      if (req.body.qc && Array.isArray(req.body.qc)) {
        const insertQc = db.prepare('INSERT INTO service_qc (service_id, item_name, checked) VALUES (?, ?, ?)');
        for (const item of req.body.qc) {
          insertQc.run(serviceId, item.name, item.checked ? 1 : 0);
        }
      }
      
      // Re-add kelengkapan
      if (req.body.kelengkapan && Array.isArray(req.body.kelengkapan)) {
        const insertKel = db.prepare('INSERT INTO service_kelengkapan (service_id, item_name, checked) VALUES (?, ?, ?)');
        for (const item of req.body.kelengkapan) {
          insertKel.run(serviceId, item.name, item.checked ? 1 : 0);
        }
      }
    });
    
    transaction();
    
    req.session.flash = { success: 'Servis berhasil diperbarui' };
    res.redirect(`/services/${serviceId}`);
  } catch (error) {
    console.error('Error updating service:', error);
    req.session.flash = { error: 'Gagal memperbarui servis: ' + error.message };
    res.redirect(`/services/${serviceId}/edit`);
  }
});

// UPDATE status only
router.post('/:id/status', (req, res) => {
  const { status } = req.body;
  const db = getDb();
  
  try {
    Service.update(req.params.id, { 
      status, 
      updated_at: new Date().toISOString() 
    });
    
    // If completed, create profit transactions
    if (status === 'Selesai') {
      const service = Service.findWithParts(req.params.id);
      if (service) {
        const ownerId = req.effectiveOwnerId;
        const storeId = req.effectiveStoreId;
        
        // Calculate totals
        let totalBuyParts = 0;
        let totalSellParts = 0;
        for (const part of (service.parts || [])) {
          totalBuyParts += part.buy_price * part.qty;
          totalSellParts += part.sell_price * part.qty;
        }
        
        const remaining = service.cost_estimate - service.dp;
        
        // Income: pelunasan
        if (remaining > 0 && service.payment_status !== 'Belum Bayar') {
          Transaction.create({
            owner_id: ownerId, store_id: storeId,
            type: 'income', category: 'Pelunasan Servis',
            amount: remaining,
            description: `Pelunasan Servis #${service.token}`,
            reference_type: 'service', reference_id: service.id,
            date: new Date().toISOString()
          });
        }
        
        // Expense: modal sparepart
        if (totalBuyParts > 0) {
          Transaction.create({
            owner_id: ownerId, store_id: storeId,
            type: 'expense', category: 'Modal Sparepart Dijual',
            amount: totalBuyParts,
            description: `Modal Sparepart Servis #${service.token}`,
            reference_type: 'service', reference_id: service.id,
            date: new Date().toISOString()
          });
        }
        
        // Profit/Loss: sparepart
        const sparepartProfit = totalSellParts - totalBuyParts;
        if (sparepartProfit !== 0) {
          Transaction.create({
            owner_id: ownerId, store_id: storeId,
            type: sparepartProfit >= 0 ? 'profit' : 'loss',
            category: sparepartProfit >= 0 ? 'Keuntungan Sparepart' : 'Rugi Sparepart',
            amount: Math.abs(sparepartProfit),
            description: `${sparepartProfit >= 0 ? 'Keuntungan' : 'Rugi'} Sparepart Servis #${service.token}`,
            reference_type: 'service', reference_id: service.id,
            date: new Date().toISOString()
          });
        }
        
        // Profit: jasa servis
        const jasaProfit = service.service_fee - totalSellParts;
        if (jasaProfit > 0) {
          Transaction.create({
            owner_id: ownerId, store_id: storeId,
            type: 'profit', category: 'Keuntungan Jasa Servis',
            amount: jasaProfit,
            description: `Keuntungan Jasa Servis #${service.token}`,
            reference_type: 'service', reference_id: service.id,
            date: new Date().toISOString()
          });
        }
      }
    }
    
    req.session.flash = { success: `Status berhasil diubah ke "${status}"` };
  } catch (error) {
    req.session.flash = { error: 'Gagal mengubah status' };
  }
  
  res.redirect(`/services/${req.params.id}`);
});

// DELETE service
router.post('/:id/delete', (req, res) => {
  const db = getDb();
  
  try {
    const service = Service.findWithParts(req.params.id);
    if (service) {
      // Restore stock
      db.transaction(() => {
        for (const part of (service.parts || [])) {
          if (part.inventory_id) {
            Inventory.adjustStock(part.inventory_id, part.qty);
          }
        }
        Service.delete(req.params.id);
      })();
    }
    req.session.flash = { success: 'Servis berhasil dihapus' };
  } catch (error) {
    req.session.flash = { error: 'Gagal menghapus servis' };
  }
  
  res.redirect('/services');
});

module.exports = router;
