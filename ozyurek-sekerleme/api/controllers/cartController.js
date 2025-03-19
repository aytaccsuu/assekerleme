 
/**
 * Sepet Yönetimi Controller
 * Özyürek Şekerleme E-Ticaret Sistemi için sepet yönetimi API endpoint'leri
 */

const CartModel = require('../models/cartModel');
const ProductModel = require('../models/productModel');
const { validationResult } = require('express-validator');
const i18n = require('../utils/i18n');

/**
 * Kullanıcının sepetini getirir
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında sepet bilgileri
 */
exports.getCart = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const sessionId = req.cookies.sessionId || req.body.sessionId || null;
    
    if (!userId && !sessionId) {
      return res.status(400).json({
        success: false,
        message: i18n.translate('errors.cart_identifier_required', req.language)
      });
    }
    
    const cart = await CartModel.getCart(userId, sessionId);
    
    return res.status(200).json({
      success: true,
      data: cart
    });
  } catch (error) {
    console.error('CartController.getCart Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Ürünü sepete ekler
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında ekleme sonucu
 */
exports.addToCart = async (req, res) => {
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
    
    const { productId, quantity, variations } = req.body;
    
    // Ürün mevcut mu kontrol et
    const product = await ProductModel.getById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: i18n.translate('errors.product_not_found', req.language)
      });
    }
    
    // Ürün aktif mi kontrol et
    if (product.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: i18n.translate('errors.product_not_available', req.language)
      });
    }
    
    // Stok kontrolü
    let hasStock = true;
    let stockMessage = '';
    
    if (variations && Object.keys(variations).length > 0) {
      // Varyasyonlu ürün için stok kontrolü
      const variationKey = Object.keys(variations)[0]; // Örneğin 'weight'
      const variationValue = variations[variationKey]; // Örneğin '250g'
      
      if (product.variations && product.variations[variationKey]) {
        const variationStock = product.variations[variationKey].find(
          v => v.value === variationValue
        );
        
        if (!variationStock || variationStock.stock < quantity) {
          hasStock = false;
          stockMessage = i18n.translate('errors.insufficient_variation_stock', req.language);
        }
      } else {
        hasStock = false;
        stockMessage = i18n.translate('errors.variation_not_found', req.language);
      }
    } else {
      // Normal ürün için stok kontrolü
      if (product.stock < quantity) {
        hasStock = false;
        stockMessage = i18n.translate('errors.insufficient_stock', req.language);
      }
    }
    
    if (!hasStock) {
      return res.status(400).json({
        success: false,
        message: stockMessage
      });
    }
    
    // Sepete ekle
    const result = await CartModel.addItem(userId, sessionId, productId, quantity, variations);
    
    return res.status(200).json({
      success: true,
      message: i18n.translate('success.product_added_to_cart', req.language),
      data: result
    });
  } catch (error) {
    console.error('CartController.addToCart Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Sepetteki ürün miktarını günceller
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında güncelleme sonucu
 */
exports.updateCartItem = async (req, res) => {
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
    const cartItemId = req.params.id;
    const { quantity } = req.body;
    
    if (!userId && !sessionId) {
      return res.status(400).json({
        success: false,
        message: i18n.translate('errors.cart_identifier_required', req.language)
      });
    }
    
    // Sepet öğesi mevcut mu kontrol et
    const cartItem = await CartModel.getCartItem(cartItemId, userId, sessionId);
    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: i18n.translate('errors.cart_item_not_found', req.language)
      });
    }
    
    // Ürün mevcut mu kontrol et
    const product = await ProductModel.getById(cartItem.product_id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: i18n.translate('errors.product_not_found', req.language)
      });
    }
    
    // Stok kontrolü
    let hasStock = true;
    let stockMessage = '';
    
    if (cartItem.variations && Object.keys(cartItem.variations).length > 0) {
      // Varyasyonlu ürün için stok kontrolü
      const variationKey = Object.keys(cartItem.variations)[0]; // Örneğin 'weight'
      const variationValue = cartItem.variations[variationKey]; // Örneğin '250g'
      
      if (product.variations && product.variations[variationKey]) {
        const variationStock = product.variations[variationKey].find(
          v => v.value === variationValue
        );
        
        if (!variationStock || variationStock.stock < quantity) {
          hasStock = false;
          stockMessage = i18n.translate('errors.insufficient_variation_stock', req.language);
        }
      } else {
        hasStock = false;
        stockMessage = i18n.translate('errors.variation_not_found', req.language);
      }
    } else {
      // Normal ürün için stok kontrolü
      if (product.stock < quantity) {
        hasStock = false;
        stockMessage = i18n.translate('errors.insufficient_stock', req.language);
      }
    }
    
    if (!hasStock) {
      return res.status(400).json({
        success: false,
        message: stockMessage
      });
    }
    
    // Sepet öğesini güncelle
    const result = await CartModel.updateItem(cartItemId, userId, sessionId, quantity);
    
    return res.status(200).json({
      success: true,
      message: i18n.translate('success.cart_updated', req.language),
      data: result
    });
  } catch (error) {
    console.error('CartController.updateCartItem Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Sepetten ürün siler
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında silme sonucu
 */
exports.removeCartItem = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const sessionId = req.cookies.sessionId || req.query.sessionId || null;
    const cartItemId = req.params.id;
    
    if (!userId && !sessionId) {
      return res.status(400).json({
        success: false,
        message: i18n.translate('errors.cart_identifier_required', req.language)
      });
    }
    
    // Sepet öğesi mevcut mu kontrol et
    const cartItem = await CartModel.getCartItem(cartItemId, userId, sessionId);
    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: i18n.translate('errors.cart_item_not_found', req.language)
      });
    }
    
    // Sepetten öğeyi sil
    const result = await CartModel.removeItem(cartItemId, userId, sessionId);
    
    return res.status(200).json({
      success: true,
      message: i18n.translate('success.item_removed_from_cart', req.language),
      data: result
    });
  } catch (error) {
    console.error('CartController.removeCartItem Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Sepeti temizler
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında temizleme sonucu
 */
exports.clearCart = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const sessionId = req.cookies.sessionId || req.query.sessionId || null;
    
    if (!userId && !sessionId) {
      return res.status(400).json({
        success: false,
        message: i18n.translate('errors.cart_identifier_required', req.language)
      });
    }
    
    const result = await CartModel.clearCart(userId, sessionId);
    
    return res.status(200).json({
      success: true,
      message: i18n.translate('success.cart_cleared', req.language),
      data: result
    });
  } catch (error) {
    console.error('CartController.clearCart Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Sepete indirim kuponu uygular
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında kupon uygulama sonucu
 */
exports.applyCoupon = async (req, res) => {
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
    const { couponCode } = req.body;
    
    if (!userId && !sessionId) {
      return res.status(400).json({
        success: false,
        message: i18n.translate('errors.cart_identifier_required', req.language)
      });
    }
    
    const result = await CartModel.applyCoupon(userId, sessionId, couponCode);
    
    if (!result.valid) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }
    
    return res.status(200).json({
      success: true,
      message: i18n.translate('success.coupon_applied', req.language),
      data: result
    });
  } catch (error) {
    console.error('CartController.applyCoupon Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Sepetten indirim kuponunu kaldırır
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında kupon kaldırma sonucu
 */
exports.removeCoupon = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const sessionId = req.cookies.sessionId || req.query.sessionId || null;
    
    if (!userId && !sessionId) {
      return res.status(400).json({
        success: false,
        message: i18n.translate('errors.cart_identifier_required', req.language)
      });
    }
    
    const result = await CartModel.removeCoupon(userId, sessionId);
    
    return res.status(200).json({
      success: true,
      message: i18n.translate('success.coupon_removed', req.language),
      data: result
    });
  } catch (error) {
    console.error('CartController.removeCoupon Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Sepeti oturum açmış kullanıcıya bağlar
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında bağlama sonucu
 */
exports.mergeCart = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const sessionId = req.cookies.sessionId || req.body.sessionId || null;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: i18n.translate('errors.auth_required', req.language)
      });
    }
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: i18n.translate('errors.session_id_required', req.language)
      });
    }
    
    const result = await CartModel.mergeCart(userId, sessionId);
    
    return res.status(200).json({
      success: true,
      message: i18n.translate('success.cart_merged', req.language),
      data: result
    });
  } catch (error) {
    console.error('CartController.mergeCart Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Sepet içeriğinin kargo, vergi ve toplam tutarlarını hesaplar
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında sepet özeti
 */
exports.calculateCartSummary = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const sessionId = req.cookies.sessionId || req.query.sessionId || null;
    
    if (!userId && !sessionId) {
      return res.status(400).json({
        success: false,
        message: i18n.translate('errors.cart_identifier_required', req.language)
      });
    }
    
    const cart = await CartModel.getCart(userId, sessionId);
    const summary = await CartModel.calculateSummary(userId, sessionId);
    
    return res.status(200).json({
      success: true,
      data: {
        items: cart.items,
        itemCount: cart.items.length,
        ...summary
      }
    });
  } catch (error) {
    console.error('CartController.calculateCartSummary Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};