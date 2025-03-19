/**
 * Sipariş Yönetimi Controller
 * Özyürek Şekerleme E-Ticaret Sistemi için sipariş yönetimi API endpoint'leri
 */

const OrderModel = require('../models/orderModel');
const CartModel = require('../models/cartModel');
const UserModel = require('../models/userModel');
const ProductModel = require('../models/productModel');
const NotificationService = require('../services/notificationService');
const IyzicoService = require('../services/izzicoService');
const { validationResult } = require('express-validator');
const i18n = require('../utils/i18n');

/**
 * Yeni sipariş oluşturur
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında oluşturulan sipariş bilgisi
 */
exports.createOrder = async (req, res) => {
  try {
    // Form validasyon kontrolleri
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: i18n.translate('errors.validation_error', req.language),
        errors: errors.array()
      });
    }
    
    const userId = req.user ? req.user.id : null;
    const sessionId = req.cookies.sessionId || req.body.sessionId || null;
    
    if (!userId && !sessionId) {
      return res.status(400).json({
        success: false,
        message: i18n.translate('errors.cart_identifier_required', req.language)
      });
    }
    
    // Sepeti kontrol et
    const cart = await CartModel.getCart(userId, sessionId);
    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: i18n.translate('errors.empty_cart', req.language)
      });
    }
    
    // Stok kontrolü
    for (const item of cart.items) {
      const product = await ProductModel.getById(item.product_id);
      
      if (!product || product.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: i18n.translate('errors.product_not_available', req.language, { productName: item.name })
        });
      }
      
      // Varyasyon kontrolü
      if (item.variations && Object.keys(item.variations).length > 0) {
        const variationKey = Object.keys(item.variations)[0]; // Örneğin 'weight'
        const variationValue = item.variations[variationKey]; // Örneğin '250g'
        
        if (product.variations && product.variations[variationKey]) {
          const variation = product.variations[variationKey].find(v => v.value === variationValue);
          
          if (!variation || variation.stock < item.quantity) {
            return res.status(400).json({
              success: false,
              message: i18n.translate('errors.insufficient_stock_for_product', req.language, { 
                productName: item.name, 
                variation: `${variationKey}: ${variationValue}` 
              })
            });
          }
        } else {
          return res.status(400).json({
            success: false,
            message: i18n.translate('errors.product_variation_not_found', req.language, { productName: item.name })
          });
        }
      } else if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: i18n.translate('errors.insufficient_stock_for_product', req.language, { productName: item.name })
        });
      }
    }
    
    // Sipariş özeti hesapla
    const summary = await CartModel.calculateSummary(userId, sessionId);
    
    // Sipariş verilerini hazırla
    const orderData = {
      ...req.body,
      user_id: userId,
      session_id: !userId ? sessionId : null,
      items: cart.items,
      coupon_code: cart.coupon ? cart.coupon.code : null,
      discount_amount: summary.discountAmount || 0,
      subtotal: summary.subtotal,
      tax_amount: summary.taxAmount,
      shipping_cost: summary.shippingCost,
      total_amount: summary.totalAmount,
      status: req.body.payment_method === 'cash_on_delivery' ? 'pending' : 'awaiting_payment',
      currency: 'TRY'
    };
    
    // Sipariş oluştur
    const order = await OrderModel.create(orderData);
    
    // Ödeme yöntemine göre işlem yap
    if (req.body.payment_method === 'credit_card') {
      try {
        // İyzico ödeme sayfası başlat
        const paymentPageUrl = await IyzicoService.createPaymentPage({
          orderId: order.id,
          totalAmount: order.total_amount,
          currency: order.currency,
          callbackUrl: `${req.protocol}://${req.get('host')}/api/payment/callback`,
          buyer: {
            id: userId || sessionId,
            name: order.billing_first_name,
            surname: order.billing_last_name,
            email: order.email,
            phone: order.phone
          }
        });
        
        // Sepeti temizle (ödeme sonrası)
        // await CartModel.clearCart(userId, sessionId);
        
        return res.status(200).json({
          success: true,
          message: i18n.translate('success.order_created', req.language),
          data: {
            order_id: order.id,
            payment_page_url: paymentPageUrl,
            redirect: true
          }
        });
      } catch (paymentError) {
        console.error('Payment Error:', paymentError);
        
        // Siparişi iptal et (ödeme başlatılamadı)
        await OrderModel.updateStatus(order.id, 'cancelled', 'Ödeme başlatılamadı');
        
        return res.status(400).json({
          success: false,
          message: i18n.translate('errors.payment_initiation_failed', req.language),
          error: paymentError.message
        });
      }
    } else if (req.body.payment_method === 'cash_on_delivery') {
      // Sipariş başarılı, sepeti temizle
      await CartModel.clearCart(userId, sessionId);
      
      // Bildirim gönder
      await NotificationService.sendOrderConfirmation(order, req.language);
      
      return res.status(200).json({
        success: true,
        message: i18n.translate('success.order_created', req.language),
        data: {
          order_id: order.id,
          redirect: true,
          redirect_url: `/order/confirmation/${order.id}`
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: i18n.translate('errors.invalid_payment_method', req.language)
      });
    }
  } catch (error) {
    console.error('OrderController.createOrder Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Belirli bir siparişi ID'ye göre getirir
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında sipariş detayları
 */
exports.getOrderById = async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.user ? req.user.id : null;
    
    // Admin kullanıcısı değilse, sadece kendi siparişlerini görebilir
    const isAdmin = req.user && req.user.role === 'admin';
    
    const order = await OrderModel.getById(orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: i18n.translate('errors.order_not_found', req.language)
      });
    }
    
    // Yetki kontrolü
    if (!isAdmin && order.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: i18n.translate('errors.not_authorized', req.language)
      });
    }
    
    return res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('OrderController.getOrderById Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Kullanıcının siparişlerini listeler
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında sipariş listesi
 */
exports.getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;
    
    const filters = { userId };
    
    if (status) {
      filters.status = status;
    }
    
    const result = await OrderModel.getUserOrders(userId, page, limit, filters);
    
    return res.status(200).json({
      success: true,
      data: result.orders,
      pagination: {
        total: result.total,
        page,
        limit,
        pages: Math.ceil(result.total / limit)
      }
    });
  } catch (error) {
    console.error('OrderController.getUserOrders Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Tüm siparişleri listeler (Admin için)
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında sipariş listesi
 */
exports.getAllOrders = async (req, res) => {
  try {
    // Yetki kontrolü
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: i18n.translate('errors.not_authorized', req.language)
      });
    }
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const sortBy = req.query.sortBy || 'created_at';
    const sortOrder = req.query.sortOrder || 'DESC';
    const status = req.query.status;
    const search = req.query.search;
    const dateFrom = req.query.dateFrom;
    const dateTo = req.query.dateTo;
    
    const filters = {};
    
    if (status) {
      filters.status = status;
    }
    
    if (search) {
      filters.search = search;
    }
    
    if (dateFrom) {
      filters.dateFrom = dateFrom;
    }
    
    if (dateTo) {
      filters.dateTo = dateTo;
    }
    
    const result = await OrderModel.getAllOrders(page, limit, sortBy, sortOrder, filters);
    
    return res.status(200).json({
      success: true,
      data: result.orders,
      pagination: {
        total: result.total,
        page,
        limit,
        pages: Math.ceil(result.total / limit)
      }
    });
  } catch (error) {
    console.error('OrderController.getAllOrders Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Sipariş durumunu günceller
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında güncelleme sonucu
 */
exports.updateOrderStatus = async (req, res) => {
  try {
    // Yetki kontrolü
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: i18n.translate('errors.not_authorized', req.language)
      });
    }
    
    // Form validasyon kontrolleri
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: i18n.translate('errors.validation_error', req.language),
        errors: errors.array()
      });
    }
    
    const orderId = req.params.id;
    const { status, note, notify } = req.body;
    
    // Geçerli durum değeri mi kontrol et
    const validStatuses = [
      'pending', 'processing', 'shipped', 'delivered', 
      'cancelled', 'refunded', 'on_hold', 'awaiting_payment'
    ];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: i18n.translate('errors.invalid_status', req.language)
      });
    }
    
    // Sipariş mevcut mu kontrol et
    const order = await OrderModel.getById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: i18n.translate('errors.order_not_found', req.language)
      });
    }
    
    // Durumu güncelle
    const updatedOrder = await OrderModel.updateStatus(orderId, status, note);
    
    // Bildirim gönder
    if (notify) {
      await NotificationService.sendOrderStatusUpdate(updatedOrder, req.language);
    }
    
    return res.status(200).json({
      success: true,
      message: i18n.translate('success.order_status_updated', req.language),
      data: updatedOrder
    });
  } catch (error) {
    console.error('OrderController.updateOrderStatus Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Sipariş iptal eder
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında iptal sonucu
 */
exports.cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.user.id;
    const { reason } = req.body;
    
    // Sipariş mevcut mu kontrol et
    const order = await OrderModel.getById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: i18n.translate('errors.order_not_found', req.language)
      });
    }
    
    // Kullanıcı kendi siparişini mi iptal ediyor kontrol et
    if (order.user_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: i18n.translate('errors.not_authorized', req.language)
      });
    }
    
    // Sipariş durumu iptal edilebilir mi kontrol et
    const cancelableStatuses = ['pending', 'awaiting_payment', 'processing'];
    if (!cancelableStatuses.includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: i18n.translate('errors.order_cannot_be_cancelled', req.language)
      });
    }
    
    // Siparişi iptal et
    const cancelledOrder = await OrderModel.cancelOrder(orderId, reason);
    
    // Kredi kartı ödemesiyse ve ödeme alındıysa iade işlemi
    if (order.payment_method === 'credit_card' && order.payment_status === 'paid') {
      try {
        const refundResult = await IyzicoService.refundPayment({
          transactionId: order.transaction_id,
          amount: order.total_amount
        });
        
        if (refundResult.success) {
          await OrderModel.updatePaymentStatus(orderId, 'refunded');
        } else {
          console.error('Refund Error:', refundResult);
        }
      } catch (refundError) {
        console.error('Refund Process Error:', refundError);
      }
    }
    
    // Bildirim gönder
    await NotificationService.sendOrderCancellationNotification(cancelledOrder, req.language);
    
    return res.status(200).json({
      success: true,
      message: i18n.translate('success.order_cancelled', req.language),
      data: cancelledOrder
    });
  } catch (error) {
    console.error('OrderController.cancelOrder Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Ödeme callback işlemi (İyzico)
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 */
exports.paymentCallback = async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.redirect('/payment/failed?error=invalid_token');
    }
    
    // Ödeme sonucunu kontrol et
    const paymentResult = await IyzicoService.checkPaymentResult(token);
    
    if (!paymentResult.success) {
      return res.redirect(`/payment/failed?error=${paymentResult.errorCode || 'payment_failed'}`);
    }
    
    const orderId = paymentResult.orderId;
    
    // Sipariş mevcut mu kontrol et
    const order = await OrderModel.getById(orderId);
    if (!order) {
      return res.redirect('/payment/failed?error=order_not_found');
    }
    
    // Ödeme durumunu güncelle
    await OrderModel.updatePaymentStatus(orderId, 'paid', paymentResult.transactionId);
    
    // Sipariş durumunu güncelle
    await OrderModel.updateStatus(orderId, 'processing');
    
    // Bildirim gönder
    await NotificationService.sendOrderConfirmation(
      await OrderModel.getById(orderId), 
      order.language || 'tr'
    );
    
    // Sepeti temizle
    await CartModel.clearCart(order.user_id, order.session_id);
    
    // Başarılı ödeme sayfasına yönlendir
    return res.redirect(`/order/confirmation/${orderId}`);
  } catch (error) {
    console.error('OrderController.paymentCallback Error:', error);
    return res.redirect('/payment/failed?error=server_error');
  }
};

/**
 * Sipariş takibi
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında sipariş takip bilgisi
 */
exports.trackOrder = async (req, res) => {
  try {
    const { orderNumber, email } = req.query;
    
    if (!orderNumber || !email) {
      return res.status(400).json({
        success: false,
        message: i18n.translate('errors.missing_track_info', req.language)
      });
    }
    
    const order = await OrderModel.getByOrderNumber(orderNumber);
    
    if (!order || order.email.toLowerCase() !== email.toLowerCase()) {
      return res.status(404).json({
        success: false,
        message: i18n.translate('errors.order_not_found', req.language)
      });
    }
    
    // Hassas bilgileri temizle
    delete order.billing_address;
    delete order.user_id;
    delete order.session_id;
    delete order.transaction_id;
    delete order.notes;
    
    return res.status(200).json({
      success: true,
      data: {
        order,
        trackingHistory: await OrderModel.getOrderStatusHistory(order.id)
      }
    });
  } catch (error) {
    console.error('OrderController.trackOrder Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Siparişe not ekler
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında not ekleme sonucu
 */
exports.addOrderNote = async (req, res) => {
  try {
    // Yetki kontrolü
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: i18n.translate('errors.not_authorized', req.language)
      });
    }
    
    // Form validasyon kontrolleri
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: i18n.translate('errors.validation_error', req.language),
        errors: errors.array()
      });
    }
    
    const orderId = req.params.id;
    const { note, isPublic } = req.body;
    
    // Sipariş mevcut mu kontrol et
    const order = await OrderModel.getById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: i18n.translate('errors.order_not_found', req.language)
      });
    }
    
    // Not ekle
    const result = await OrderModel.addNote(orderId, note, req.user.id, isPublic);
    
    // Müşteriye bildirim gönder
    if (isPublic) {
      await NotificationService.sendOrderNoteNotification(order, note, req.language);
    }
    
    return res.status(200).json({
      success: true,
      message: i18n.translate('success.note_added', req.language),
      data: result
    });
  } catch (error) {
    console.error('OrderController.addOrderNote Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Siparişin fatura bilgisini yaratır veya getirir
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında fatura bilgisi
 */
exports.getOrderInvoice = async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.user ? req.user.id : null;
    
    // Admin kullanıcısı değilse, sadece kendi siparişlerini görebilir
    const isAdmin = req.user && req.user.role === 'admin';
    
    const order = await OrderModel.getById(orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: i18n.translate('errors.order_not_found', req.language)
      });
    }
    
    // Yetki kontrolü
    if (!isAdmin && order.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: i18n.translate('errors.not_authorized', req.language)
      });
    }
    
    // Fatura oluştur veya mevcut faturayı getir
    const invoiceData = await OrderModel.generateInvoice(orderId);
    
    return res.status(200).json({
      success: true,
      data: invoiceData
    });
  } catch (error) {
    console.error('OrderController.getOrderInvoice Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Sipariş istatistikleri (Admin için)
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında sipariş istatistikleri
 */
exports.getOrderStats = async (req, res) => {
  try {
    // Yetki kontrolü
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: i18n.translate('errors.not_authorized', req.language)
      });
    }
    
    const period = req.query.period || 'month'; // day, week, month, year
    const dateFrom = req.query.dateFrom;
    const dateTo = req.query.dateTo;
    
    const stats = await OrderModel.getOrderStats(period, dateFrom, dateTo);
    
    return res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('OrderController.getOrderStats Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};