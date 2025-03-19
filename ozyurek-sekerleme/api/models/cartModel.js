 
/**
 * Sepet Model
 * Özyürek Şekerleme E-Ticaret Sistemi için sepet veri işlemleri
 */

const db = require('../utils/database');
const ProductModel = require('./productModel');
const CouponModel = require('./couponModel');

/**
 * Sepet bilgilerini getirir
 * @param {number|null} userId - Kullanıcı ID
 * @param {string|null} sessionId - Oturum ID
 * @returns {Promise<Object>} Sepet bilgileri
 */
exports.getCart = async (userId, sessionId) => {
  try {
    const query = `
      SELECT c.*, ci.id as item_id, ci.product_id, ci.quantity, ci.variations,
             p.name_tr, p.name_en, p.name_ar, p.slug, p.price, p.discounted_price, 
             p.images, p.weight, p.stock
      FROM carts c
      LEFT JOIN cart_items ci ON c.id = ci.cart_id
      LEFT JOIN products p ON ci.product_id = p.id
      WHERE ${userId ? 'c.user_id = ?' : 'c.session_id = ?'}
      ORDER BY ci.created_at DESC
    `;
    
    const cartRows = await db.query(query, [userId || sessionId]);
    
    if (!cartRows || cartRows.length === 0) {
      // Sepet yoksa yeni oluştur
      const cartId = await this.createCart(userId, sessionId);
      return { id: cartId, items: [], coupon: null };
    }
    
    // Sepet bilgilerini düzenle
    const cartId = cartRows[0].id;
    let items = [];
    let coupon = null;
    
    // Sepet öğelerini düzenle
    if (cartRows[0].item_id) {
      // Her bir satırı işleyerek sepet öğelerini oluştur
      const processedItems = {};
      
      for (const row of cartRows) {
        if (!row.item_id) continue;
        
        // Her öğeyi bir kez ekle
        if (!processedItems[row.item_id]) {
          // Varyasyonları JSON formatından objeye dönüştür
          const variations = row.variations ? JSON.parse(row.variations) : null;
          
          // Resim URL'lerini JSON formatından diziye dönüştür
          const images = row.images ? JSON.parse(row.images) : [];
          const imageUrl = images.length > 0 ? `/uploads/products/${images[0]}` : null;
          
          // Fiyat hesaplaması
          let unitPrice = row.price;
          if (row.discounted_price && row.discounted_price < row.price) {
            unitPrice = row.discounted_price;
          }
          
          // Varyasyona göre fiyat ayarlaması
          if (variations && Object.keys(variations).length > 0) {
            // Örnek: Ağırlık varyasyonu için fiyat ayarlaması
            const weightVariation = variations.weight;
            if (weightVariation) {
              if (weightVariation === '500g' && row.weight === '250g') {
                unitPrice *= 2;
              } else if (weightVariation === '1kg' && row.weight === '250g') {
                unitPrice *= 4;
              } else if (weightVariation === '1kg' && row.weight === '500g') {
                unitPrice *= 2;
              }
            }
          }
          
          processedItems[row.item_id] = {
            id: row.item_id,
            product_id: row.product_id,
            name: row.name_tr, // Varsayılan dil
            name_tr: row.name_tr,
            name_en: row.name_en,
            name_ar: row.name_ar,
            slug: row.slug,
            quantity: row.quantity,
            unit_price: unitPrice,
            total_price: unitPrice * row.quantity,
            stock: row.stock,
            variations: variations,
            image: imageUrl
          };
        }
      }
      
      items = Object.values(processedItems);
    }
    
    // Kupon bilgisini getir
    if (cartRows[0].coupon_id) {
      coupon = await CouponModel.getById(cartRows[0].coupon_id);
    }
    
    return {
      id: cartId,
      items,
      coupon
    };
  } catch (error) {
    console.error('CartModel.getCart Error:', error);
    throw error;
  }
};

/**
 * Yeni sepet oluşturur
 * @param {number|null} userId - Kullanıcı ID
 * @param {string|null} sessionId - Oturum ID
 * @returns {Promise<number>} Oluşturulan sepet ID'si
 */
exports.createCart = async (userId, sessionId) => {
  try {
    const query = `
      INSERT INTO carts (user_id, session_id, created_at, updated_at)
      VALUES (?, ?, NOW(), NOW())
    `;
    
    const result = await db.query(query, [userId, sessionId]);
    return result.insertId;
  } catch (error) {
    console.error('CartModel.createCart Error:', error);
    throw error;
  }
};

/**
 * Sepete ürün ekler
 * @param {number|null} userId - Kullanıcı ID
 * @param {string|null} sessionId - Oturum ID
 * @param {number} productId - Ürün ID
 * @param {number} quantity - Miktar
 * @param {Object|null} variations - Varyasyon bilgileri
 * @returns {Promise<Object>} Ekleme sonucu
 */
exports.addItem = async (userId, sessionId, productId, quantity, variations) => {
  try {
    // Önce sepeti getir veya oluştur
    let cart = await this.getCart(userId, sessionId);
    
    // Sepette aynı ürün ve varyasyon var mı kontrol et
    const existingItemIndex = cart.items.findIndex(item => {
      if (item.product_id !== productId) return false;
      
      // Varyasyon kontrolü
      if (variations && Object.keys(variations).length > 0) {
        // İki varyasyon objesini karşılaştır
        const itemVars = item.variations || {};
        const newVars = variations || {};
        
        // Her iki objenin anahtar sayısı aynı olmalı
        if (Object.keys(itemVars).length !== Object.keys(newVars).length) {
          return false;
        }
        
        // Her anahtarın değeri aynı olmalı
        for (const key in newVars) {
          if (itemVars[key] !== newVars[key]) {
            return false;
          }
        }
        
        return true;
      } else if (!item.variations || Object.keys(item.variations).length === 0) {
        // Her ikisi de varyasyonsuz
        return true;
      }
      
      return false;
    });
    
    if (existingItemIndex >= 0) {
      // Varolan öğenin miktarını güncelle
      const existingItem = cart.items[existingItemIndex];
      const newQuantity = existingItem.quantity + quantity;
      
      const updateQuery = `
        UPDATE cart_items
        SET quantity = ?, updated_at = NOW()
        WHERE id = ?
      `;
      
      await db.query(updateQuery, [newQuantity, existingItem.id]);
      
      // Sepeti yeniden yükle
      cart = await this.getCart(userId, sessionId);
    } else {
      // Yeni öğe ekle
      const variationsJson = variations ? JSON.stringify(variations) : null;
      
      const insertQuery = `
        INSERT INTO cart_items (cart_id, product_id, quantity, variations, created_at, updated_at)
        VALUES (?, ?, ?, ?, NOW(), NOW())
      `;
      
      await db.query(insertQuery, [cart.id, productId, quantity, variationsJson]);
      
      // Sepeti yeniden yükle
      cart = await this.getCart(userId, sessionId);
    }
    
    return cart;
  } catch (error) {
    console.error('CartModel.addItem Error:', error);
    throw error;
  }
};

/**
 * Sepet öğesini getirir
 * @param {number} itemId - Öğe ID
 * @param {number|null} userId - Kullanıcı ID
 * @param {string|null} sessionId - Oturum ID
 * @returns {Promise<Object|null>} Sepet öğesi
 */
exports.getCartItem = async (itemId, userId, sessionId) => {
  try {
    const query = `
      SELECT ci.*
      FROM cart_items ci
      JOIN carts c ON ci.cart_id = c.id
      WHERE ci.id = ? AND ${userId ? 'c.user_id = ?' : 'c.session_id = ?'}
    `;
    
    const rows = await db.query(query, [itemId, userId || sessionId]);
    
    if (!rows || rows.length === 0) {
      return null;
    }
    
    const item = rows[0];
    item.variations = item.variations ? JSON.parse(item.variations) : null;
    
    return item;
  } catch (error) {
    console.error('CartModel.getCartItem Error:', error);
    throw error;
  }
};

/**
 * Sepet öğesi miktarını günceller
 * @param {number} itemId - Öğe ID
 * @param {number|null} userId - Kullanıcı ID
 * @param {string|null} sessionId - Oturum ID
 * @param {number} quantity - Yeni miktar
 * @returns {Promise<Object>} Güncelleme sonucu
 */
exports.updateItem = async (itemId, userId, sessionId, quantity) => {
  try {
    // Öğe kullanıcıya ait mi kontrol et
    const cartItem = await this.getCartItem(itemId, userId, sessionId);
    
    if (!cartItem) {
      throw new Error('Cart item not found');
    }
    
    if (quantity <= 0) {
      // Miktar 0 veya negatifse öğeyi sil
      return await this.removeItem(itemId, userId, sessionId);
    }
    
    // Öğe miktarını güncelle
    const query = `
      UPDATE cart_items
      SET quantity = ?, updated_at = NOW()
      WHERE id = ?
    `;
    
    await db.query(query, [quantity, itemId]);
    
    // Sepeti yeniden yükle ve döndür
    return await this.getCart(userId, sessionId);
  } catch (error) {
    console.error('CartModel.updateItem Error:', error);
    throw error;
  }
};

/**
 * Sepetten öğe siler
 * @param {number} itemId - Öğe ID
 * @param {number|null} userId - Kullanıcı ID
 * @param {string|null} sessionId - Oturum ID
 * @returns {Promise<Object>} Silme sonucu
 */
exports.removeItem = async (itemId, userId, sessionId) => {
  try {
    // Öğe kullanıcıya ait mi kontrol et
    const cartItem = await this.getCartItem(itemId, userId, sessionId);
    
    if (!cartItem) {
      throw new Error('Cart item not found');
    }
    
    // Öğeyi sil
    const query = `
      DELETE FROM cart_items
      WHERE id = ?
    `;
    
    await db.query(query, [itemId]);
    
    // Sepeti yeniden yükle ve döndür
    return await this.getCart(userId, sessionId);
  } catch (error) {
    console.error('CartModel.removeItem Error:', error);
    throw error;
  }
};

/**
 * Sepeti tamamen temizler
 * @param {number|null} userId - Kullanıcı ID
 * @param {string|null} sessionId - Oturum ID
 * @returns {Promise<Object>} Temizleme sonucu
 */
exports.clearCart = async (userId, sessionId) => {
  try {
    // Önce sepeti getir
    const cart = await this.getCart(userId, sessionId);
    
    // Tüm öğeleri sil
    const query = `
      DELETE FROM cart_items
      WHERE cart_id = ?
    `;
    
    await db.query(query, [cart.id]);
    
    // Kupon bilgisini temizle
    if (cart.coupon) {
      const updateCartQuery = `
        UPDATE carts
        SET coupon_id = NULL, updated_at = NOW()
        WHERE id = ?
      `;
      
      await db.query(updateCartQuery, [cart.id]);
    }
    
    // Boş sepeti döndür
    return {
      id: cart.id,
      items: [],
      coupon: null
    };
  } catch (error) {
    console.error('CartModel.clearCart Error:', error);
    throw error;
  }
};

/**
 * Sepete kupon uygular
 * @param {number|null} userId - Kullanıcı ID
 * @param {string|null} sessionId - Oturum ID
 * @param {string} couponCode - Kupon kodu
 * @returns {Promise<Object>} Kupon uygulama sonucu
 */
exports.applyCoupon = async (userId, sessionId, couponCode) => {
  try {
    // Sepeti getir
    const cart = await this.getCart(userId, sessionId);
    
    // Kupon kodunu doğrula
    const coupon = await CouponModel.getByCode(couponCode);
    
    if (!coupon) {
      return {
        valid: false,
        message: 'Kupon bulunamadı.'
      };
    }
    
    // Kupon aktif mi?
    if (coupon.status !== 'active') {
      return {
        valid: false,
        message: 'Kupon aktif değil.'
      };
    }
    
    // Kupon süresi dolmuş mu?
    const now = new Date();
    if (coupon.start_date && new Date(coupon.start_date) > now) {
      return {
        valid: false,
        message: 'Kupon henüz başlamadı.'
      };
    }
    if (coupon.end_date && new Date(coupon.end_date) < now) {
      return {
        valid: false,
        message: 'Kupon süresi dolmuş.'
      };
    }
    
    // Minimum sepet tutarı kontrolü
    if (coupon.min_amount > 0) {
      const cartTotal = cart.items.reduce((total, item) => total + item.total_price, 0);
      if (cartTotal < coupon.min_amount) {
        return {
          valid: false,
          message: `Kupon için minimum sepet tutarı: ${coupon.min_amount} TL.`
        };
      }
    }
    
    // Kullanım limiti kontrolü
    if (coupon.usage_limit > 0 && coupon.usage_count >= coupon.usage_limit) {
      return {
        valid: false,
        message: 'Kupon kullanım limiti dolmuş.'
      };
    }
    
    // Kullanıcı başına kullanım limiti kontrolü
    if (userId && coupon.per_user_limit > 0) {
      const userUsageCount = await CouponModel.getUserUsageCount(coupon.id, userId);
      if (userUsageCount >= coupon.per_user_limit) {
        return {
          valid: false,
          message: 'Bu kuponu daha fazla kullanamazsınız.'
        };
      }
    }
    
    // Kuponu sepete uygula
    const query = `
      UPDATE carts
      SET coupon_id = ?, updated_at = NOW()
      WHERE id = ?
    `;
    
    await db.query(query, [coupon.id, cart.id]);
    
    // Güncellenmiş sepeti yükle
    const updatedCart = await this.getCart(userId, sessionId);
    
    return {
      valid: true,
      message: 'Kupon başarıyla uygulandı.',
      cart: updatedCart
    };
  } catch (error) {
    console.error('CartModel.applyCoupon Error:', error);
    throw error;
  }
};

/**
 * Sepetten kuponu kaldırır
 * @param {number|null} userId - Kullanıcı ID
 * @param {string|null} sessionId - Oturum ID
 * @returns {Promise<Object>} Kupon kaldırma sonucu
 */
exports.removeCoupon = async (userId, sessionId) => {
  try {
    // Sepeti getir
    const cart = await this.getCart(userId, sessionId);
    
    // Kuponu sepetten kaldır
    const query = `
      UPDATE carts
      SET coupon_id = NULL, updated_at = NOW()
      WHERE id = ?
    `;
    
    await db.query(query, [cart.id]);
    
    // Güncellenmiş sepeti yükle
    const updatedCart = await this.getCart(userId, sessionId);
    
    return {
      message: 'Kupon kaldırıldı.',
      cart: updatedCart
    };
  } catch (error) {
    console.error('CartModel.removeCoupon Error:', error);
    throw error;
  }
};

/**
 * Misafir sepetini kullanıcı sepetine birleştirir
 * @param {number} userId - Kullanıcı ID
 * @param {string} sessionId - Oturum ID
 * @returns {Promise<Object>} Birleştirme sonucu
 */
exports.mergeCart = async (userId, sessionId) => {
  try {
    // Önce her iki sepeti getir
    const guestCart = await this.getCart(null, sessionId);
    const userCart = await this.getCart(userId, null);
    
    // Misafir sepetinde ürün yoksa işlemi atla
    if (!guestCart.items || guestCart.items.length === 0) {
      return userCart;
    }
    
    // Misafir sepetindeki her öğeyi kullanıcı sepetine ekle
    for (const item of guestCart.items) {
      await this.addItem(
        userId,
        null,
        item.product_id,
        item.quantity,
        item.variations
      );
    }
    
    // Misafir sepeti kuponunu kontrol et ve uygula
    if (guestCart.coupon && !userCart.coupon) {
      await this.applyCoupon(userId, null, guestCart.coupon.code);
    }
    
    // Misafir sepetini temizle
    await this.clearCart(null, sessionId);
    
    // Birleştirilmiş sepeti döndür
    return await this.getCart(userId, null);
  } catch (error) {
    console.error('CartModel.mergeCart Error:', error);
    throw error;
  }
};

/**
 * Sepet özetini hesaplar (toplam, vergi, kargo, indirim)
 * @param {number|null} userId - Kullanıcı ID
 * @param {string|null} sessionId - Oturum ID
 * @returns {Promise<Object>} Hesaplama sonucu
 */
exports.calculateSummary = async (userId, sessionId) => {
  try {
    // Sepeti getir
    const cart = await this.getCart(userId, sessionId);
    
    // Sepet boşsa 0 değerlerini döndür
    if (!cart.items || cart.items.length === 0) {
      return {
        subtotal: 0,
        taxAmount: 0,
        discountAmount: 0,
        shippingCost: 0,
        totalAmount: 0
      };
    }
    
    // Sepet toplamını hesapla
    const subtotal = cart.items.reduce((total, item) => total + item.total_price, 0);
    
    // Vergi oranı ve miktarını hesapla (ör: %8 KDV)
    const taxRate = 0.08;
    const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
    
    // İndirim miktarını hesapla
    let discountAmount = 0;
    if (cart.coupon) {
      if (cart.coupon.type === 'percentage') {
        discountAmount = Math.round(subtotal * (cart.coupon.amount / 100) * 100) / 100;
        
        // Maksimum indirim tutarı kontrolü
        if (cart.coupon.max_discount_amount > 0 && discountAmount > cart.coupon.max_discount_amount) {
          discountAmount = cart.coupon.max_discount_amount;
        }
      } else if (cart.coupon.type === 'fixed') {
        discountAmount = cart.coupon.amount > subtotal ? subtotal : cart.coupon.amount;
      }
    }
    
    // Kargo ücretini hesapla
    let shippingCost = 0;
    
    // Sepet tutarına göre ücretsiz kargo
    const freeShippingThreshold = 200;
    
    if (subtotal < freeShippingThreshold) {
      shippingCost = 30; // Varsayılan kargo ücreti
    }
    
    // İndirimli sepet toplamı
    const discountedSubtotal = subtotal - discountAmount;
    
    // Toplam tutarı hesapla
    const totalAmount = discountedSubtotal + taxAmount + shippingCost;
    
    return {
      subtotal,
      taxAmount,
      discountAmount,
      shippingCost,
      totalAmount
    };
  } catch (error) {
    console.error('CartModel.calculateSummary Error:', error);
    throw error;
  }
};