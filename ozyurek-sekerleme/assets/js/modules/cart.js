/**
 * Özyürek Şekerleme - Sepet İşlemleri JavaScript Modülü
 * Sepet fonksiyonlarını yönetir
 */

// Sepet Modülü IIFE (Immediately Invoked Function Expression)
const Cart = (function() {
  // Özel değişkenler
  let cart = {
    items: [],
    coupon: null,
    subtotal: 0,
    discount: 0,
    tax: 0,
    shipping: 0,
    total: 0
  };
  
  let config = {
    currencySymbol: '₺',
    taxRate: 0.08, // %8 KDV
    freeShippingThreshold: 200, // 200 TL üzeri ücretsiz kargo
    defaultShippingCost: 30, // 30 TL kargo ücreti
    storageKey: 'ozyurek_cart',
    sessionId: null,
    apiEndpoint: '/api/cart'
  };
  
  // DOM elementleri
  const DOM = {
    cartIcon: document.querySelector('.cart-icon'),
    cartCount: document.querySelector('.cart-count'),
    cartDropdown: document.querySelector('.cart-dropdown'),
    cartItems: document.querySelector('.cart-items'),
    cartSubtotal: document.querySelector('.cart-subtotal'),
    cartDiscount: document.querySelector('.cart-discount'),
    cartTax: document.querySelector('.cart-tax'),
    cartShipping: document.querySelector('.cart-shipping'),
    cartTotal: document.querySelector('.cart-total'),
    cartEmpty: document.querySelector('.cart-empty'),
    checkoutBtn: document.querySelector('.checkout-btn'),
    clearCartBtn: document.querySelector('.clear-cart-btn')
  };
  
  /**
   * Sepet modülünü başlatır
   * @param {Object} options - Yapılandırma seçenekleri
   */
  function init(options = {}) {
    // Yapılandırmayı güncelle
    config = { ...config, ...options };
    
    // Oturum ID'sini belirle
    config.sessionId = getSessionId();
    
    // Sepeti yerel depolamadan yükle
    loadCart();
    
    // Sepet sayacını güncelle
    updateCartCount();
    
    // Sepet ikonuna tıklama olayını dinle
    if (DOM.cartIcon) {
      DOM.cartIcon.addEventListener('click', toggleCart);
    }
    
    // Temizle butonuna tıklama olayını dinle
    if (DOM.clearCartBtn) {
      DOM.clearCartBtn.addEventListener('click', clearCart);
    }
    
    // Checkout butonuna tıklama olayını dinle
    if (DOM.checkoutBtn) {
      DOM.checkoutBtn.addEventListener('click', goToCheckout);
    }
    
    // Ürün sayfalarında "Sepete Ekle" butonlarını dinle
    document.addEventListener('click', function(e) {
      if (e.target && e.target.classList.contains('add-to-cart')) {
        e.preventDefault();
        
        const productCard = e.target.closest('.product-card') || e.target.closest('.product-detail');
        if (!productCard) return;
        
        const productId = productCard.dataset.productId;
        const productName = productCard.dataset.productName;
        const productPrice = parseFloat(productCard.dataset.productPrice);
        const productImage = productCard.dataset.productImage;
        
        // Varyasyon seçiliyse onu al
        let variation = null;
        const variationSelect = productCard.querySelector('.product-variation');
        
        if (variationSelect && variationSelect.value) {
          variation = {
            type: variationSelect.dataset.variationType,
            value: variationSelect.value,
            priceAdjustment: parseFloat(variationSelect.options[variationSelect.selectedIndex].dataset.priceAdjustment || 0)
          };
        }
        
        // Miktar seçiliyse onu al, yoksa 1 kullan
        let quantity = 1;
        const quantityInput = productCard.querySelector('.quantity-input');
        
        if (quantityInput && quantityInput.value) {
          quantity = parseInt(quantityInput.value);
        }
        
        // Sepete ürün ekle
        addToCart(productId, productName, productPrice, productImage, quantity, variation);
      }
    });
    
    // Sayfadaki sepet öğelerinde miktar değişikliğini izle
    document.addEventListener('click', function(e) {
      if (e.target && (e.target.classList.contains('quantity-minus') || e.target.classList.contains('quantity-plus'))) {
        e.preventDefault();
        
        const cartItem = e.target.closest('.cart-item');
        if (!cartItem) return;
        
        const productId = cartItem.dataset.productId;
        const itemIndex = findCartItemIndex(productId);
        
        if (itemIndex === -1) return;
        
        const quantityInput = cartItem.querySelector('.quantity-input');
        let newQuantity = parseInt(quantityInput.value);
        
        if (e.target.classList.contains('quantity-minus')) {
          newQuantity = Math.max(1, newQuantity - 1);
        } else {
          newQuantity += 1;
        }
        
        updateCartItemQuantity(productId, newQuantity);
      }
    });
    
    // Sayfadaki sepet öğelerinde silme butonunu dinle
    document.addEventListener('click', function(e) {
      if (e.target && e.target.classList.contains('remove-from-cart')) {
        e.preventDefault();
        
        const cartItem = e.target.closest('.cart-item');
        if (!cartItem) return;
        
        const productId = cartItem.dataset.productId;
        removeFromCart(productId);
      }
    });
    
    // Sayfa yüklendiğinde sepeti sunucuyla senkronize et
    syncCartWithServer();
    
    console.log('Sepet modülü başlatıldı.');
  }
  
  /**
   * Sepete ürün ekler
   * @param {string} productId - Ürün ID
   * @param {string} name - Ürün adı
   * @param {number} price - Ürün fiyatı
   * @param {string} image - Ürün resmi
   * @param {number} quantity - Ürün miktarı
   * @param {Object|null} variation - Ürün varyasyonu (opsiyonel)
   */
  function addToCart(productId, name, price, image, quantity = 1, variation = null) {
    // Ürünün sepette olup olmadığını kontrol et
    const existingItemIndex = findCartItemIndex(productId, variation);
    
    if (existingItemIndex !== -1) {
      // Ürün sepette varsa miktarını güncelle
      cart.items[existingItemIndex].quantity += quantity;
    } else {
      // Ürün sepette yoksa yeni ekle
      const adjustedPrice = variation && variation.priceAdjustment ? price + variation.priceAdjustment : price;
      
      cart.items.push({
        id: productId,
        name: name,
        price: adjustedPrice,
        originalPrice: price,
        image: image,
        quantity: quantity,
        variation: variation
      });
    }
    
    // Sepeti güncelle
    saveCart();
    updateCartCount();
    updateCartDisplay();
    
    // Sepeti sunucuyla senkronize et
    syncCartWithServer();
    
    // Bildirim göster
    showNotification('Ürün sepete eklendi', 'success');
    
    // Sepeti göster
    if (DOM.cartDropdown) {
      DOM.cartDropdown.classList.add('show');
      
      // 3 saniye sonra sepeti gizle
      setTimeout(() => {
        DOM.cartDropdown.classList.remove('show');
      }, 3000);
    }
  }
  
  /**
   * Sepetten ürün siler
   * @param {string} productId - Ürün ID
   * @param {Object|null} variation - Ürün varyasyonu (opsiyonel)
   */
  function removeFromCart(productId, variation = null) {
    const itemIndex = findCartItemIndex(productId, variation);
    
    if (itemIndex !== -1) {
      // Ürünü sepetten kaldır
      cart.items.splice(itemIndex, 1);
      
      // Sepeti güncelle
      saveCart();
      updateCartCount();
      updateCartDisplay();
      
      // Sepeti sunucuyla senkronize et
      syncCartWithServer();
      
      // Bildirim göster
      showNotification('Ürün sepetten silindi', 'info');
    }
  }
  
  /**
   * Sepetteki ürün miktarını günceller
   * @param {string} productId - Ürün ID
   * @param {number} quantity - Yeni miktar
   * @param {Object|null} variation - Ürün varyasyonu (opsiyonel)
   */
  function updateCartItemQuantity(productId, quantity, variation = null) {
    const itemIndex = findCartItemIndex(productId, variation);
    
    if (itemIndex !== -1) {
      // Miktar 0 veya negatifse ürünü sepetten kaldır
      if (quantity <= 0) {
        removeFromCart(productId, variation);
        return;
      }
      
      // Miktarı güncelle
      cart.items[itemIndex].quantity = quantity;
      
      // Sepeti güncelle
      saveCart();
      updateCartCount();
      updateCartDisplay();
      
      // Sepeti sunucuyla senkronize et
      syncCartWithServer();
    }
  }
  
  /**
   * Sepeti gösterir veya gizler
   */
  function toggleCart() {
    if (DOM.cartDropdown) {
      DOM.cartDropdown.classList.toggle('show');
    }
  }
  
  /**
   * Sepetteki ürün sayısını günceller
   */
  function updateCartCount() {
    const totalItems = cart.items.reduce((total, item) => total + item.quantity, 0);
    
    if (DOM.cartCount) {
      DOM.cartCount.textContent = totalItems;
      
      if (totalItems > 0) {
        DOM.cartCount.classList.add('show');
      } else {
        DOM.cartCount.classList.remove('show');
      }
    }
  }
  
  /**
   * Sepet gösterimini günceller
   */
  function updateCartDisplay() {
    // Sepet içeriği boşsa
    if (cart.items.length === 0) {
      if (DOM.cartEmpty) DOM.cartEmpty.style.display = 'block';
      if (DOM.cartItems) DOM.cartItems.style.display = 'none';
      if (DOM.checkoutBtn) DOM.checkoutBtn.style.display = 'none';
      return;
    }
    
    // Sepet içeriği doluysa
    if (DOM.cartEmpty) DOM.cartEmpty.style.display = 'none';
    if (DOM.cartItems) DOM.cartItems.style.display = 'block';
    if (DOM.checkoutBtn) DOM.checkoutBtn.style.display = 'block';
    
    // Sepet öğelerini temizle
    if (DOM.cartItems) {
      DOM.cartItems.innerHTML = '';
      
      // Sepet öğelerini ekle
      cart.items.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'cart-item';
        itemElement.dataset.productId = item.id;
        
        const variationText = item.variation ? 
          `<div class="cart-item-variation">${item.variation.type}: ${item.variation.value}</div>` : '';
        
        itemElement.innerHTML = `
          <div class="cart-item-image">
            <img src="${item.image}" alt="${item.name}">
          </div>
          <div class="cart-item-details">
            <div class="cart-item-name">${item.name}</div>
            ${variationText}
            <div class="cart-item-price">${formatCurrency(item.price)}</div>
            <div class="cart-item-quantity">
              <button class="quantity-minus">-</button>
              <input type="number" class="quantity-input" value="${item.quantity}" min="1" max="99">
              <button class="quantity-plus">+</button>
            </div>
          </div>
          <button class="remove-from-cart" title="Sepetten Çıkar">×</button>
        `;
        
        DOM.cartItems.appendChild(itemElement);
      });
    }
    
    // Sepet özetini hesapla
    calculateCartSummary();
    
    // Sepet özet bilgilerini güncelle
    if (DOM.cartSubtotal) DOM.cartSubtotal.textContent = formatCurrency(cart.subtotal);
    if (DOM.cartDiscount) {
      DOM.cartDiscount.textContent = formatCurrency(cart.discount);
      DOM.cartDiscount.parentElement.style.display = cart.discount > 0 ? 'flex' : 'none';
    }
    if (DOM.cartTax) DOM.cartTax.textContent = formatCurrency(cart.tax);
    if (DOM.cartShipping) DOM.cartShipping.textContent = formatCurrency(cart.shipping);
    if (DOM.cartTotal) DOM.cartTotal.textContent = formatCurrency(cart.total);
  }
  
  /**
   * Sepeti temizler
   */
  function clearCart() {
    if (!confirm('Sepetinizi temizlemek istediğinize emin misiniz?')) return;
    
    cart.items = [];
    cart.coupon = null;
    
    saveCart();
    updateCartCount();
    updateCartDisplay();
    
    // Sepeti sunucuyla senkronize et
    syncCartWithServer();
    
    // Bildirim göster
    showNotification('Sepet temizlendi', 'info');
  }
  
  /**
   * Ödeme sayfasına yönlendirir
   */
  function goToCheckout() {
    if (cart.items.length === 0) {
      showNotification('Sepetiniz boş', 'error');
      return;
    }
    
    window.location.href = '/checkout.html';
  }
  
  /**
   * Sepette belirli bir ürünün indeksini bulur
   * @param {string} productId - Ürün ID
   * @param {Object|null} variation - Ürün varyasyonu (opsiyonel)
   * @returns {number} Bulunan indeks veya -1
   */
  function findCartItemIndex(productId, variation = null) {
    return cart.items.findIndex(item => {
      // Ürün ID'si eşleşmeli
      if (item.id !== productId) return false;
      
      // Varyasyon yoksa direkt eşleşir
      if (!variation && !item.variation) return true;
      
      // Sadece birinde varyasyon varsa eşleşmez
      if ((!variation && item.variation) || (variation && !item.variation)) return false;
      
      // İki üründe de varyasyon varsa değerlerini karşılaştır
      return (
        variation.type === item.variation.type && 
        variation.value === item.variation.value
      );
    });
  }