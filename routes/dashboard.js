const express = require('express');
const router = express.Router();
const { Service, Sale, Inventory, Transaction, Customer } = require('../models');

router.get('/', (req, res) => {
  const ownerId = req.effectiveOwnerId;
  const storeId = req.effectiveStoreId;
  
  // Date filters
  const filter = req.query.filter || 'today';
  let startDate, endDate;
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  switch (filter) {
    case 'today':
      startDate = today;
      endDate = today + ' 23:59:59';
      break;
    case 'month':
      startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      endDate = today + ' 23:59:59';
      break;
    case 'year':
      startDate = `${now.getFullYear()}-01-01`;
      endDate = today + ' 23:59:59';
      break;
    default:
      startDate = req.query.startDate || today;
      endDate = (req.query.endDate || today) + ' 23:59:59';
  }
  
  // Service stats
  const allServices = Service.getByOwnerAndStore(ownerId, storeId);
  const serviceStats = {
    antrian: allServices.filter(s => s.status === 'Diterima').length,
    dikerjakan: allServices.filter(s => ['Diagnosa', 'Menunggu Sparepart'].includes(s.status)).length,
    selesai: allServices.filter(s => s.status === 'Selesai').length,
    total: allServices.length
  };
  
  // Transaction summary
  const txSummary = Transaction.getSummary(ownerId, storeId, startDate, endDate);
  
  // Inventory value
  const stockValue = Inventory.getTotalStockValue(ownerId, storeId);
  
  // Recent services
  const recentServices = allServices.slice(0, 5);
  
  // Low stock items
  const lowStock = Inventory.getLowStock(ownerId, storeId);
  
  res.render('dashboard/index', {
    title: 'Dashboard',
    pageTitle: 'Dashboard',
    serviceStats,
    txSummary,
    stockValue,
    recentServices,
    lowStock,
    filter,
    startDate: req.query.startDate || '',
    endDate: req.query.endDate || ''
  });
});

module.exports = router;
