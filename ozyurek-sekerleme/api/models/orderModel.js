/**
 * Sipariş Model
 * Özyürek Şekerleme E-Ticaret Sistemi için sipariş veri işlemleri
 */

const db = require('../utils/database');
const ProductModel = require('./productModel');
const CouponModel = require('./couponModel');
const crypto = require('crypto');
const moment = require('moment');

/**
 * Yeni sipariş oluşturur
 * @param {Object} orderData - Sipariş verileri
 * @returns {Promise<Object>} Oluşturulan sipariş bilgisi
 */
exports.create = async (orderData) => {
  try {
    const {
      user_id, session_id, email, phone, billing_first_name, billing_last_name,
      billing_address, billing_city, billing_state, billing_postcode, billing_country,
      shipping_first_name, shipping_last_name, shipping_address, shipping_city,
      shipping_state, shipping_postcode, shipping_country, payment_method,
      items, coupon_code, discount_amount, subtotal, tax_amount, shipping_cost,
      total_amount, status, currency, notes
    } = orderData;
    
    // Sipariş numarası oluştur
    const orderNumber = await this.generateOrderNumber();
    
    // Ana sipariş kaydını ekle
    const query = `
      INSERT INTO orders (
        order_number, user_id, session_id, email, phone, 
        billing_first_name, billing_last_name, billing_address, billing_city, 
        billing_state, billing_postcode, billing_country,
        shipping_first_name, shipping_last_name, shipping_address, shipping_city, 
        shipping_state, shipping_postcode, shipping_country,
        payment_method, payment_status, coupon_code, discount_amount, 
        subtotal, tax_amount, shipping_cost, total_amount, 
        status, currency, notes, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()
      )
    `;
    
    const params = [
      orderNumber, user_id, session_id, email, phone,
      billing_first_name, billing_last_name, billing_address, billing_city,
      billing_state, billing_postcode, billing_country,
      shipping_first_name || billing_first_name,
      shipping_last_name || billing_last_name,
      shipping_address || billing_address,
      shipping_city || billing_city,
      shipping_state || billing_state,
      shipping_postcode || billing_postcode,
      shipping_country || billing_country,
      payment_method,
      payment_method === 'cash_on_delivery' ? 'pending' : 'awaiting',
      coupon_code,
      discount_amount || 0,
      subtotal,
      tax_amount,
      shipping_cost,
      total_amount,
      status,
      currency,
      notes
    ];
    
    const result = await db.query(query, params);
    const orderId = result.insertId;
    
    // Sipariş öğelerini ekle
    if (items && items.length > 0) {
      for (const item of items) {
        await this.addOrderItem(orderId, item);
      }
    }
    
    // Kupon kullanımını güncelle
    if (coupon_code) {
      await CouponModel.incrementUsage(coupon_code, user_id);
    }
    
    // Sipariş durumu güncellemesini ekle
    await this.addStatusHistory(orderId, status, 'Sipariş oluşturuldu');
    
    // Ürün stoklarını güncelle
    await this.updateProductStocks(items);
    
    // Oluşturulan siparişi getir
    return await this.getById(orderId);
  } catch (error) {
    console.error('OrderModel.create Error:', error);
    throw error;
  }
};

/**
 * Sipariş numarası oluşturur
 * @returns {Promise<string>} Benzersiz sipariş numarası
 */
exports.generateOrderNumber = async () => {
  try {
    // Yıl-Ay ve rastgele sayı kombinasyonu ile sipariş numarası oluştur
    const prefix = moment().format('YYMM');
    const random = crypto.randomInt(10000, 99999); // 5 basamaklı rastgele sayı
    
    const orderNumber = `${prefix}${random}`;
    
    // Bu numara daha önce kullanılmış mı kontrol et
    const checkQuery = `
      SELECT COUNT(*) as count
      FROM orders
      WHERE order_number = ?
    `;
    
    const result = await db.query(checkQuery, [orderNumber]);
    
    // Eğer bu numara zaten mevcutsa, yeniden oluştur
    if (result[0].count > 0) {
      return this.generateOrderNumber();
    }
    
    return orderNumber;
  } catch (error) {
    console.error('OrderModel.generateOrderNumber Error:', error);
    throw error;
  }
};

/**
 * Sipariş öğesi ekler
 * @param {number} orderId - Sipariş ID
 * @param {Object} item - Ürün bilgileri
 * @returns {Promise<void>}
 */
exports.addOrderItem = async (orderId, item) => {
  try {
    const query = `
      INSERT INTO order_items (
        order_id, product_id, name, quantity, unit_price, 
        total_price, variations, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;
    
    const params = [
      orderId,
      item.product_id,
      item.name,
      item.quantity,
      item.unit_price,
      item.total_price,
      item.variations ? JSON.stringify(item.variations) : null
    ];
    
    await db.query(query, params);
  } catch (error) {
    console.error('OrderModel.addOrderItem Error:', error);
    throw error;
  }
};

/**
 * Sipariş durumu geçmişi ekler
 * @param {number} orderId - Sipariş ID
 * @param {string} status - Durum
 * @param {string} note - Not
 * @param {number|null} userId - İşlemi yapan kullanıcı ID
 * @returns {Promise<void>}
 */
exports.addStatusHistory = async (orderId, status, note, userId = null) => {
  try {
    const query = `
      INSERT INTO order_status_history (
        order_id, status, note, user_id, created_at
      ) VALUES (?, ?, ?, ?, NOW())
    `;
    
    await db.query(query, [orderId, status, note, userId]);
  } catch (error) {
    console.error('OrderModel.addStatusHistory Error:', error);
    throw error;
  }
};

/**
 * Ürün stoklarını günceller
 * @param {Array} items - Sipariş öğeleri
 * @returns {Promise<void>}
 */
exports.updateProductStocks = async (items) => {
  try {
    for (const item of items) {
      // Ürün bilgilerini getir
      const product = await ProductModel.getById(item.product_id);
      
      if (!product) continue;
      
      // Varyasyon kontrolü
      if (item.variations && Object.keys(item.variations).length > 0) {
        // Ağırlık varyasyonu örneği
        const weightVariation = item.variations.weight;
        
        if (weightVariation && product.variations && product.variations.weight) {
          const variation = product.variations.weight.find(v => v.value === weightVariation);
          
          if (variation) {
            // Varyasyon stok miktarını güncelle
            await ProductModel.updateVariationStock(
              item.product_id,
              'weight',
              weightVariation,
              variation.stock - item.quantity
            );
          }
        }
      } else {
        // Genel stok miktarını güncelle
        await ProductModel.updateStock(
          item.product_id,
          product.stock - item.quantity
        );
      }
    }
  } catch (error) {
    console.error('OrderModel.updateProductStocks Error:', error);
    throw error;
  }
};

/**
 * Belirli bir siparişi ID'ye göre getirir
 * @param {number} orderId - Sipariş ID
 * @returns {Promise<Object|null>} Sipariş bilgileri
 */
exports.getById = async (orderId) => {
  try {
    // Ana sipariş bilgilerini getir
    const orderQuery = `
      SELECT *
      FROM orders
      WHERE id = ?
    `;
    
    const orderRows = await db.query(orderQuery, [orderId]);
    
    if (!orderRows || orderRows.length === 0) {
      return null;
    }
    
    const order = orderRows[0];
    
    // Sipariş öğelerini getir
    const itemsQuery = `
      SELECT *
      FROM order_items
      WHERE order_id = ?
    `;
    
    const itemRows = await db.query(itemsQuery, [orderId]);
    
    // Öğeleri düzenle
    const items = itemRows.map(item => {
      const variations = item.variations ? JSON.parse(item.variations) : null;
      return {
        ...item,
        variations
      };
    });
    
    // Durum geçmişini getir
    const historyQuery = `
      SELECT osh.*, u.first_name, u.last_name
      FROM order_status_history osh
      LEFT JOIN users u ON osh.user_id = u.id
      WHERE osh.order_id = ?
      ORDER BY osh.created_at ASC
    `;
    
    const historyRows = await db.query(historyQuery, [orderId]);
    
    // Tam siparişi oluştur
    return {
      ...order,
      items,
      status_history: historyRows
    };
  } catch (error) {
    console.error('OrderModel.getById Error:', error);
    throw error;
  }
};

/**
 * Siparişi sipariş numarasına göre getirir
 * @param {string} orderNumber - Sipariş numarası
 * @returns {Promise<Object|null>} Sipariş bilgileri
 */
exports.getByOrderNumber = async (orderNumber) => {
  try {
    const query = `
      SELECT id
      FROM orders
      WHERE order_number = ?
    `;
    
    const rows = await db.query(query, [orderNumber]);
    
    if (!rows || rows.length === 0) {
      return null;
    }
    
    return await this.getById(rows[0].id);
  } catch (error) {
    console.error('OrderModel.getByOrderNumber Error:', error);
    throw error;
  }
};

/**
 * Kullanıcıya ait siparişleri getirir
 * @param {number} userId - Kullanıcı ID
 * @param {number} page - Sayfa numarası
 * @param {number} limit - Sayfa başına kayıt sayısı
 * @param {Object} filters - Filtre seçenekleri
 * @returns {Promise<Object>} Siparişler listesi
 */
exports.getUserOrders = async (userId, page = 1, limit = 10, filters = {}) => {
  try {
    const offset = (page - 1) * limit;
    
    // Filtreleme koşulları
    let whereConditions = ['user_id = ?'];
    let params = [userId];
    
    if (filters.status) {
      whereConditions.push('status = ?');
      params.push(filters.status);
    }
    
    // Toplam kayıt sayısını getir
    const countQuery = `
      SELECT COUNT(*) as total
      FROM orders
      WHERE ${whereConditions.join(' AND ')}
    `;
    
    const countResult = await db.query(countQuery, params);
    const total = countResult[0].total;
    
    // Siparişleri getir
    const ordersQuery = `
      SELECT id, order_number, created_at, total_amount, status, payment_method, payment_status,
             shipping_cost, subtotal, discount_amount, tax_amount, currency
      FROM orders
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT ?, ?
    `;
    
    const orderRows = await db.query(ordersQuery, [...params, offset, limit]);
    
    // Siparişler için detayları getir
    const orders = [];
    
    for (const orderRow of orderRows) {
      // Her sipariş için öğe listesini getir
      const itemsQuery = `
        SELECT product_id, name, quantity, unit_price, total_price, variations
        FROM order_items
        WHERE order_id = ?
      `;
      
      const itemRows = await db.query(itemsQuery, [orderRow.id]);
      
      // Öğeleri düzenle
      const items = itemRows.map(item => {
        const variations = item.variations ? JSON.parse(item.variations) : null;
        return {
          ...item,
          variations
        };
      });
      
      orders.push({
        ...orderRow,
        items
      });
    }
    
    return {
      orders,
      total
    };
  } catch (error) {
    console.error('OrderModel.getUserOrders Error:', error);
    throw error;
  }
};

/**
 * Tüm siparişleri getirir (admin için)
 * @param {number} page - Sayfa numarası
 * @param {number} limit - Sayfa başına kayıt sayısı
 * @param {string} sortBy - Sıralama alanı
 * @param {string} sortOrder - Sıralama yönü (ASC/DESC)
 * @param {Object} filters - Filtre seçenekleri
 * @returns {Promise<Object>} Siparişler listesi
 */
exports.getAllOrders = async (page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'DESC', filters = {}) => {
  try {
    const offset = (page - 1) * limit;
    
    // Filtreleme koşulları
    let whereConditions = ['1=1']; // Herzaman doğru olan bir başlangıç koşulu
    let params = [];
    
    if (filters.status) {
      whereConditions.push('status = ?');
      params.push(filters.status);
    }
    
    if (filters.search) {
      whereConditions.push('(order_number LIKE ? OR email LIKE ? OR phone LIKE ? OR CONCAT(billing_first_name, " ", billing_last_name) LIKE ?)');
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    if (filters.dateFrom) {
      whereConditions.push('created_at >= ?');
      params.push(filters.dateFrom);
    }
    
    if (filters.dateTo) {
      whereConditions.push('created_at <= ?');
      params.push(filters.dateTo);
    }
    
    // Geçerli sıralama alanı kontrolü
    const validSortFields = ['id', 'order_number', 'created_at', 'total_amount', 'status'];
    if (!validSortFields.includes(sortBy)) {
      sortBy = 'created_at';
    }
    
    // Geçerli sıralama yönü kontrolü
    sortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    // Toplam kayıt sayısını getir
    const countQuery = `
      SELECT COUNT(*) as total
      FROM orders
      WHERE ${whereConditions.join(' AND ')}
    `;
    
    const countResult = await db.query(countQuery, params);
    const total = countResult[0].total;
    
    // Siparişleri getir
    const ordersQuery = `
      SELECT o.id, o.order_number, o.user_id, o.email, 
             o.billing_first_name, o.billing_last_name, 
             o.total_amount, o.status, o.payment_method, o.payment_status,
             o.created_at, o.updated_at, u.first_name, u.last_name, u.email as user_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY o.${sortBy} ${sortOrder}
      LIMIT ?, ?
    `;
    
    const orders = await db.query(ordersQuery, [...params, offset, limit]);
    
    return {
      orders,
      total
    };
  } catch (error) {
    console.error('OrderModel.getAllOrders Error:', error);
    throw error;
  }
};

/**
 * Sipariş durumunu günceller
 * @param {number} orderId - Sipariş ID
 * @param {string} status - Durum
 * @param {string|null} note - Not
 * @param {number|null} userId - İşlemi yapan kullanıcı ID
 * @returns {Promise<Object>} Güncellenen sipariş
 */
exports.updateStatus = async (orderId, status, note = null, userId = null) => {
  try {
    // Siparişi getir
    const order = await this.getById(orderId);
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    // Durumu güncelle
    const query = `
      UPDATE orders
      SET status = ?, updated_at = NOW()
      WHERE id = ?
    `;
    
    await db.query(query, [status, orderId]);
    
    // Durum geçmişine ekle
    await this.addStatusHistory(orderId, status, note, userId);
    
    // Güncellenmiş siparişi getir
    return await this.getById(orderId);
  } catch (error) {
    console.error('OrderModel.updateStatus Error:', error);
    throw error;
  }
};

/**
 * Sipariş ödeme durumunu günceller
 * @param {number} orderId - Sipariş ID
 * @param {string} paymentStatus - Ödeme durumu
 * @param {string|null} transactionId - İşlem ID
 * @returns {Promise<Object>} Güncellenen sipariş
 */
exports.updatePaymentStatus = async (orderId, paymentStatus, transactionId = null) => {
  try {
    // Siparişi getir
    const order = await this.getById(orderId);
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    // Ödeme durumunu güncelle
    const query = `
      UPDATE orders
      SET payment_status = ?, transaction_id = ?, updated_at = NOW()
      WHERE id = ?
    `;
    
    await db.query(query, [paymentStatus, transactionId, orderId]);
    
    // Eğer ödeme tamamlandıysa, durumu güncelle
    if (paymentStatus === 'paid' && order.status === 'awaiting_payment') {
      await this.updateStatus(orderId, 'processing', 'Ödeme alındı, sipariş işleniyor.');
    }
    
    // Güncellenmiş siparişi getir
    return await this.getById(orderId);
  } catch (error) {
    console.error('OrderModel.updatePaymentStatus Error:', error);
    throw error;
  }
};

/**
 * Siparişi iptal eder
 * @param {number} orderId - Sipariş ID
 * @param {string|null} reason - İptal nedeni
 * @param {number|null} userId - İşlemi yapan kullanıcı ID
 * @returns {Promise<Object>} İptal edilen sipariş
 */
exports.cancelOrder = async (orderId, reason = null, userId = null) => {
  try {
    // Siparişi getir
    const order = await this.getById(orderId);
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    // Durumu güncelle
    const query = `
      UPDATE orders
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = ?
    `;
    
    await db.query(query, [orderId]);
    
    // Durum geçmişine ekle
    await this.addStatusHistory(
      orderId, 
      'cancelled', 
      reason || 'Sipariş iptal edildi.', 
      userId
    );
    
    // Stokları geri yükle
    await this.restoreProductStocks(order.items);
    
    // İptal edilen siparişi getir
    return await this.getById(orderId);
  } catch (error) {
    console.error('OrderModel.cancelOrder Error:', error);
    throw error;
  }
};

/**
 * İptal edilen sipariş için ürün stoklarını geri yükler
 * @param {Array} items - Sipariş öğeleri
 * @returns {Promise<void>}
 */
exports.restoreProductStocks = async (items) => {
  try {
    for (const item of items) {
      // Ürün bilgilerini getir
      const product = await ProductModel.getById(item.product_id);
      
      if (!product) continue;
      
      // Varyasyon kontrolü
      if (item.variations && Object.keys(item.variations).length > 0) {
        // Ağırlık varyasyonu örneği
        const weightVariation = item.variations.weight;
        
        if (weightVariation && product.variations && product.variations.weight) {
          const variation = product.variations.weight.find(v => v.value === weightVariation);
          
          if (variation) {
            // Varyasyon stok miktarını güncelle
            await ProductModel.updateVariationStock(
              item.product_id,
              'weight',
              weightVariation,
              variation.stock + item.quantity
            );
          }
        }
      } else {
        // Genel stok miktarını güncelle
        await ProductModel.updateStock(
          item.product_id,
          product.stock + item.quantity
        );
      }
    }
  } catch (error) {
    console.error('OrderModel.restoreProductStocks Error:', error);
    throw error;
  }
};

/**
 * Sipariş durumu geçmişini getirir
 * @param {number} orderId - Sipariş ID
 * @returns {Promise<Array>} Durum geçmişi
 */
exports.getOrderStatusHistory = async (orderId) => {
  try {
    const query = `
      SELECT osh.*, u.first_name, u.last_name
      FROM order_status_history osh
      LEFT JOIN users u ON osh.user_id = u.id
      WHERE osh.order_id = ?
      ORDER BY osh.created_at ASC
    `;
    
    return await db.query(query, [orderId]);
  } catch (error) {
    console.error('OrderModel.getOrderStatusHistory Error:', error);
    throw error;
  }
};

/**
 * Siparişe not ekler
 * @param {number} orderId - Sipariş ID
 * @param {string} note - Not
 * @param {number} userId - Kullanıcı ID
 * @param {boolean} isPublic - Notun müşteriye gösterilip gösterilmeyeceği
 * @returns {Promise<Object>} Eklenen not
 */
exports.addNote = async (orderId, note, userId, isPublic = false) => {
  try {
    const query = `
      INSERT INTO order_notes (
        order_id, note, user_id, is_public, created_at
      ) VALUES (?, ?, ?, ?, NOW())
    `;
    
    const result = await db.query(query, [orderId, note, userId, isPublic ? 1 : 0]);
    
    // Eklenen notu getir
    const noteQuery = `
      SELECT on.*, u.first_name, u.last_name
      FROM order_notes on
      LEFT JOIN users u ON on.user_id = u.id
      WHERE on.id = ?
    `;
    
    const noteResult = await db.query(noteQuery, [result.insertId]);
    
    return noteResult[0];
  } catch (error) {
    console.error('OrderModel.addNote Error:', error);
    throw error;
  }
};

/**
 * Sipariş notlarını getirir
 * @param {number} orderId - Sipariş ID
 * @param {boolean|null} isPublic - Sadece herkese açık notları getir
 * @returns {Promise<Array>} Notlar listesi
 */
exports.getNotes = async (orderId, isPublic = null) => {
  try {
    let query = `
      SELECT on.*, u.first_name, u.last_name
      FROM order_notes on
      LEFT JOIN users u ON on.user_id = u.id
      WHERE on.order_id = ?
    `;
    
    const params = [orderId];
    
    if (isPublic !== null) {
      query += ' AND on.is_public = ?';
      params.push(isPublic ? 1 : 0);
    }
    
    query += ' ORDER BY on.created_at DESC';
    
    return await db.query(query, params);
  } catch (error) {
    console.error('OrderModel.getNotes Error:', error);
    throw error;
  }
};

/**
 * Sipariş faturası oluşturur
 * @param {number} orderId - Sipariş ID
 * @returns {Promise<Object>} Fatura bilgileri
 */
exports.generateInvoice = async (orderId) => {
  try {
    // Siparişi getir
    const order = await this.getById(orderId);
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    // Mevcut faturayı kontrol et
    const checkQuery = `
      SELECT *
      FROM invoices
      WHERE order_id = ?
    `;
    
    const existingInvoice = await db.query(checkQuery, [orderId]);
    
    if (existingInvoice && existingInvoice.length > 0) {
      return existingInvoice[0];
    }
    
    // Fatura numarası oluştur
    const invoiceNumber = await this.generateInvoiceNumber();
    
    // Fatura oluştur
    const query = `
      INSERT INTO invoices (
        order_id, invoice_number, amount, tax_amount, currency,
        billing_name, billing_address, billing_city,
        billing_state, billing_postcode, billing_country,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    
    const params = [
      orderId,
      invoiceNumber,
      order.total_amount,
      order.tax_amount,
      order.currency,
      `${order.billing_first_name} ${order.billing_last_name}`,
      order.billing_address,
      order.billing_city,
      order.billing_state,
      order.billing_postcode,
      order.billing_country
    ];
    
    const result = await db.query(query, params);
    
    // Oluşturulan faturayı getir
    const invoiceQuery = `
      SELECT *
      FROM invoices
      WHERE id = ?
    `;
    
    const invoiceResult = await db.query(invoiceQuery, [result.insertId]);
    
    return {
      ...invoiceResult[0],
      order
    };
  } catch (error) {
    console.error('OrderModel.generateInvoice Error:', error);
    throw error;
  }
};

/**
 * Fatura numarası oluşturur
 * @returns {Promise<string>} Benzersiz fatura numarası
 */
exports.generateInvoiceNumber = async () => {
  try {
    // Yıl-Ay ve sıra numarası kombinasyonu ile fatura numarası oluştur
    const prefix = moment().format('YYMM');
    
    // Bu ay oluşturulan son fatura numarasını bul
    const query = `
      SELECT invoice_number
      FROM invoices
      WHERE invoice_number LIKE ?
      ORDER BY id DESC
      LIMIT 1
    `;
    
    const result = await db.query(query, [`${prefix}%`]);
    
    let sequenceNumber = 1;
    
    if (result && result.length > 0) {
      // Son fatura numarasından sıra numarasını çıkar ve bir artır
      const lastInvoiceNumber = result[0].invoice_number;
      const lastSequence = parseInt(lastInvoiceNumber.substring(4));
      sequenceNumber = lastSequence + 1;
    }
    
    // 5 basamaklı sıra numarası formatla
    const formattedSequence = String(sequenceNumber).padStart(5, '0');
    
    return `${prefix}${formattedSequence}`;
  } catch (error) {
    console.error('OrderModel.generateInvoiceNumber Error:', error);
    throw error;
  }
};

/**
 * Sipariş istatistiklerini getirir
 * @param {string} period - Dönem (day, week, month, year)
 * @param {string|null} dateFrom - Başlangıç tarihi
 * @param {string|null} dateTo - Bitiş tarihi
 * @returns {Promise<Object>} İstatistik bilgileri
 */
exports.getOrderStats = async (period = 'month', dateFrom = null, dateTo = null) => {
  try {
    let groupBy, dateFormat, whereSql = '';
    const params = [];
    
    // Dönem formatını belirle
    switch (period) {
      case 'day':
        groupBy = 'DATE(created_at)';
        dateFormat = '%Y-%m-%d';
        break;
      case 'week':
        groupBy = 'YEARWEEK(created_at)';
        dateFormat = '%x-W%v';
        break;
      case 'month':
        groupBy = 'DATE_FORMAT(created_at, "%Y-%m")';
        dateFormat = '%Y-%m';
        break;
      case 'year':
        groupBy = 'YEAR(created_at)';
        dateFormat = '%Y';
        break;
      default:
        groupBy = 'DATE_FORMAT(created_at, "%Y-%m")';
        dateFormat = '%Y-%m';
    }
    
    // Tarih filtresi
    if (dateFrom) {
      whereSql += ' AND created_at >= ?';
      params.push(dateFrom);
    }
    
    if (dateTo) {
      whereSql += ' AND created_at <= ?';
      params.push(dateTo);
    }
    
    // Sipariş sayısı ve ciroyu dönem bazında getir
    const orderStatsQuery = `
      SELECT 
        DATE_FORMAT(created_at, '${dateFormat}') as period,
        COUNT(*) as order_count,
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as avg_order_value
      FROM orders
      WHERE 1=1 ${whereSql}
      GROUP BY ${groupBy}
      ORDER BY period
    `;
    
    const orderStats = await db.query(orderStatsQuery, params);
    
    // Durum bazında sipariş sayıları
    const statusStatsQuery = `
      SELECT 
        status, 
        COUNT(*) as count,
        SUM(total_amount) as total_amount
      FROM orders
      WHERE 1=1 ${whereSql}
      GROUP BY status
    `;
    
    const statusStats = await db.query(statusStatsQuery, params);
    
    // Ödeme yöntemi bazında sipariş sayıları
    const paymentMethodQuery = `
      SELECT 
        payment_method, 
        COUNT(*) as count,
        SUM(total_amount) as total_amount
      FROM orders
      WHERE 1=1 ${whereSql}
      GROUP BY payment_method
    `;
    
    const paymentMethodStats = await db.query(paymentMethodQuery, params);
    
    // En çok satılan ürünler
    const topProductsQuery = `
      SELECT 
        oi.product_id,
        oi.name,
        COUNT(*) as order_count,
        SUM(oi.quantity) as total_quantity,
        SUM(oi.total_price) as total_revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE 1=1 ${whereSql}
      GROUP BY oi.product_id
      ORDER BY total_quantity DESC
      LIMIT 10
    `;
    
    const topProducts = await db.query(topProductsQuery, params);
    
    return {
      period_stats: orderStats,
      status_stats: statusStats,
      payment_method_stats: paymentMethodStats,
      top_products: topProducts,
      summary: {
        total_orders: orderStats.reduce((sum, stat) => sum + stat.order_count, 0),
        total_revenue: orderStats.reduce((sum, stat) => sum + stat.total_revenue, 0),
        avg_order_value: orderStats.length > 0 ? 
          orderStats.reduce((sum, stat) => sum + stat.total_revenue, 0) / 
          orderStats.reduce((sum, stat) => sum + stat.order_count, 0) : 0
      }
    };
  } catch (error) {
    console.error('OrderModel.getOrderStats Error:', error);
    throw error;
  }
};