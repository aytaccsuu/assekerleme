 
/**
 * İyzico Ödeme Servisi
 * Özyürek Şekerleme E-Ticaret Sistemi için İyzico ödeme entegrasyonu
 */

const Iyzipay = require('iyzipay');
const config = require('../config/iyzico.json');
const OrderModel = require('../models/orderModel');
const fs = require('fs');
const path = require('path');

// Environment'a göre iyzico yapılandırmasını yükle
const env = process.env.NODE_ENV || 'development';
const iyzicoConfig = {
  ...config[env],
  ...config.notifyOptions
};

// İyzipay nesnesini oluştur
const iyzipay = new Iyzipay({
  apiKey: iyzicoConfig.apiKey,
  secretKey: iyzicoConfig.secretKey,
  uri: iyzicoConfig.baseUrl
});

/**
 * Ödeme sayfası oluşturur
 * @param {Object} params - Ödeme parametreleri
 * @returns {Promise<string>} Ödeme sayfası URL'si
 */
exports.createPaymentPage = async (params) => {
  try {
    const { orderId, totalAmount, currency, callbackUrl, buyer } = params;
    
    // Sipariş bilgilerini getir
    const order = await OrderModel.getById(orderId);
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    // Basket Items oluştur
    const basketItems = order.items.map(item => {
      return {
        id: item.product_id.toString(),
        name: item.name,
        category1: 'Lokum ve Şekerlemeler',
        itemType: 'PHYSICAL',
        price: item.unit_price.toFixed(2)
      };
    });
    
    // Ödeme talebi oluştur
    const request = {
      locale: iyzicoConfig.language,
      conversationId: `order_${orderId}_${Date.now()}`,
      price: order.subtotal.toFixed(2), // Ürünlerin toplam fiyatı (indirimler ve vergiler hariç)
      paidPrice: totalAmount.toFixed(2), // Ödenecek miktar (indirimler, vergiler ve kargo dahil)
      currency: currency,
      basketId: `basket_${orderId}`,
      paymentGroup: 'PRODUCT',
      callbackUrl: callbackUrl,
      
      buyer: {
        id: buyer.id.toString(),
        name: buyer.name,
        surname: buyer.surname,
        email: buyer.email,
        identityNumber: '11111111111', // TC Kimlik No veya bir tanımlayıcı (zorunlu alan)
        registrationAddress: order.billing_address,
        ip: buyer.ip || '127.0.0.1',
        city: order.billing_city,
        country: order.billing_country,
        zipCode: order.billing_postcode,
        phoneNumber: buyer.phone
      },
      
      shippingAddress: {
        contactName: `${order.shipping_first_name} ${order.shipping_last_name}`,
        city: order.shipping_city,
        country: order.shipping_country,
        address: order.shipping_address,
        zipCode: order.shipping_postcode
      },
      
      billingAddress: {
        contactName: `${order.billing_first_name} ${order.billing_last_name}`,
        city: order.billing_city,
        country: order.billing_country,
        address: order.billing_address,
        zipCode: order.billing_postcode
      },
      
      basketItems: basketItems,
      
      // Taksit yapılandırması - sadece tek çekim
      enabledInstallments: iyzicoConfig.enabledInstallments,
      
      // Başlık ve açıklama
      paymentSource: 'ÖZYÜREK ŞEKERLEME',
      forceThreeDS: iyzicoConfig.paymentOptions.forceThreeDS,
      cardUserKey: null // Kayıtlı kart kullanımı için
    };
    
    // Debug amaçlı istek detaylarını kaydet (geliştirme aşamasında)
    if (env === 'development') {
      const debugPath = path.join(__dirname, '../../logs/iyzico');
      if (!fs.existsSync(debugPath)) {
        fs.mkdirSync(debugPath, { recursive: true });
      }
      
      fs.writeFileSync(
        path.join(debugPath, `checkout_form_request_${orderId}.json`),
        JSON.stringify(request, null, 2)
      );
    }
    
    // İyzico'ya ödeme isteği gönder
    return new Promise((resolve, reject) => {
      iyzipay.checkoutFormInitialize.create(request, function (err, result) {
        // Debug amaçlı yanıt detaylarını kaydet (geliştirme aşamasında)
        if (env === 'development') {
          const debugPath = path.join(__dirname, '../../logs/iyzico');
          if (!fs.existsSync(debugPath)) {
            fs.mkdirSync(debugPath, { recursive: true });
          }
          
          fs.writeFileSync(
            path.join(debugPath, `checkout_form_response_${orderId}.json`),
            JSON.stringify(result || err, null, 2)
          );
        }
        
        if (err) {
          reject(err);
        } else if (result.status === 'failure') {
          reject(new Error(result.errorMessage || 'İyzico ödeme sayfası oluşturulamadı'));
        } else {
          // Sipariş ile ödeme token'ını ilişkilendir
          OrderModel.updatePaymentToken(orderId, result.token);
          
          // Ödeme sayfası URL'sini döndür
          resolve(result.paymentPageUrl);
        }
      });
    });
  } catch (error) {
    console.error('IyzicoService.createPaymentPage Error:', error);
    throw error;
  }
};

/**
 * Ödeme sonucunu kontrol eder
 * @param {string} token - Ödeme token'ı
 * @returns {Promise<Object>} Ödeme sonucu
 */
exports.checkPaymentResult = async (token) => {
  try {
    const request = {
      locale: iyzicoConfig.language,
      conversationId: `check_payment_${Date.now()}`,
      token: token
    };
    
    // Debug amaçlı istek detaylarını kaydet (geliştirme aşamasında)
    if (env === 'development') {
      const debugPath = path.join(__dirname, '../../logs/iyzico');
      if (!fs.existsSync(debugPath)) {
        fs.mkdirSync(debugPath, { recursive: true });
      }
      
      fs.writeFileSync(
        path.join(debugPath, `payment_result_request_${token}.json`),
        JSON.stringify(request, null, 2)
      );
    }
    
    // İyzico'dan ödeme sonucunu sorgula
    return new Promise((resolve, reject) => {
      iyzipay.checkoutForm.retrieve(request, function (err, result) {
        // Debug amaçlı yanıt detaylarını kaydet (geliştirme aşamasında)
        if (env === 'development') {
          const debugPath = path.join(__dirname, '../../logs/iyzico');
          if (!fs.existsSync(debugPath)) {
            fs.mkdirSync(debugPath, { recursive: true });
          }
          
          fs.writeFileSync(
            path.join(debugPath, `payment_result_response_${token}.json`),
            JSON.stringify(result || err, null, 2)
          );
        }
        
        if (err) {
          reject(err);
        } else {
          // Token'a sahip siparişi bul
          OrderModel.getByPaymentToken(token)
            .then(order => {
              if (!order) {
                resolve({
                  success: false,
                  errorCode: 'ORDER_NOT_FOUND',
                  errorMessage: 'Sipariş bulunamadı'
                });
                return;
              }
              
              if (result.status === 'success' && result.paymentStatus === 'SUCCESS') {
                resolve({
                  success: true,
                  orderId: order.id,
                  transactionId: result.paymentId,
                  paymentStatus: 'paid'
                });
              } else {
                resolve({
                  success: false,
                  orderId: order.id,
                  errorCode: result.errorCode,
                  errorMessage: result.errorMessage || 'Ödeme başarısız'
                });
              }
            })
            .catch(error => {
              reject(error);
            });
        }
      });
    });
  } catch (error) {
    console.error('IyzicoService.checkPaymentResult Error:', error);
    throw error;
  }
};

/**
 * Ödeme iadesi yapar
 * @param {Object} params - İade parametreleri
 * @returns {Promise<Object>} İade sonucu
 */
exports.refundPayment = async (params) => {
  try {
    const { transactionId, amount } = params;
    
    const request = {
      locale: iyzicoConfig.language,
      conversationId: `refund_${transactionId}_${Date.now()}`,
      paymentTransactionId: transactionId,
      price: amount.toFixed(2), // İade edilecek tutar
      currency: iyzicoConfig.currency,
      ip: '127.0.0.1'
    };
    
    // Debug amaçlı istek detaylarını kaydet (geliştirme aşamasında)
    if (env === 'development') {
      const debugPath = path.join(__dirname, '../../logs/iyzico');
      if (!fs.existsSync(debugPath)) {
        fs.mkdirSync(debugPath, { recursive: true });
      }
      
      fs.writeFileSync(
        path.join(debugPath, `refund_request_${transactionId}.json`),
        JSON.stringify(request, null, 2)
      );
    }
    
    // İyzico'ya iade isteği gönder
    return new Promise((resolve, reject) => {
      iyzipay.refund.create(request, function (err, result) {
        // Debug amaçlı yanıt detaylarını kaydet (geliştirme aşamasında)
        if (env === 'development') {
          const debugPath = path.join(__dirname, '../../logs/iyzico');
          if (!fs.existsSync(debugPath)) {
            fs.mkdirSync(debugPath, { recursive: true });
          }
          
          fs.writeFileSync(
            path.join(debugPath, `refund_response_${transactionId}.json`),
            JSON.stringify(result || err, null, 2)
          );
        }
        
        if (err) {
          reject(err);
        } else if (result.status === 'success') {
          resolve({
            success: true,
            transactionId: result.paymentId,
            refundId: result.paymentTransactionId
          });
        } else {
          resolve({
            success: false,
            errorCode: result.errorCode,
            errorMessage: result.errorMessage || 'İade işlemi başarısız'
          });
        }
      });
    });
  } catch (error) {
    console.error('IyzicoService.refundPayment Error:', error);
    throw error;
  }
};

/**
 * Kart bilgilerini maskeler
 * @param {string} cardNumber - Kart numarası
 * @returns {string} Maskelenmiş kart numarası
 */
exports.maskCardNumber = (cardNumber) => {
  if (!cardNumber || cardNumber.length < 10) return '****';
  
  const firstSix = cardNumber.substring(0, 6);
  const lastFour = cardNumber.slice(-4);
  const maskedPart = '*'.repeat(cardNumber.length - 10);
  
  return `${firstSix}${maskedPart}${lastFour}`;
};

/**
 * Ödeme test işlemi
 * @returns {Promise<Object>} Test sonucu
 */
exports.testConnection = async () => {
  try {
    const request = {
      locale: iyzicoConfig.language,
      conversationId: `test_${Date.now()}`
    };
    
    // İyzico bağlantısını test et
    return new Promise((resolve, reject) => {
      iyzipay.apiTest.retrieve(request, function (err, result) {
        if (err) {
          reject(err);
        } else if (result.status === 'success') {
          resolve({
            success: true,
            environment: env,
            message: 'İyzico bağlantısı başarılı'
          });
        } else {
          resolve({
            success: false,
            environment: env,
            errorMessage: result.errorMessage || 'İyzico bağlantı testi başarısız'
          });
        }
      });
    });
  } catch (error) {
    console.error('IyzicoService.testConnection Error:', error);
    throw error;
  }
};