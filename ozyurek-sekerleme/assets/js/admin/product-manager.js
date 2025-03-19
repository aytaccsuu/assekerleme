 
/**
 * Ürün Yönetimi JavaScript Dosyası
 * Özyürek Şekerleme E-Ticaret Sistemi için ürün yönetimi işlevleri
 */

// Ürün yönetimi nesnesi
const ProductManager = (function() {
    // Özel değişkenler
    let productsList = [];
    let categories = [];
    let currentProduct = null;
    let isEditing = false;
    let currentPage = 1;
    let totalPages = 1;
    let itemsPerPage = 10;
    let sortField = 'id';
    let sortOrder = 'DESC';
    let selectedCategories = [];
    let productImages = [];
    let deletedImages = [];
  
    // DOM elemanları
    const domElements = {
      productTable: document.querySelector('.admin-table tbody'),
      productForm: document.getElementById('product-form'),
      productModal: document.getElementById('product-modal'),
      modalTitle: document.getElementById('modal-title'),
      deleteModal: document.getElementById('delete-modal'),
      searchInput: document.getElementById('search-product'),
      categoryFilter: document.getElementById('category-filter'),
      statusFilter: document.getElementById('status-filter'),
      pagination: document.querySelector('.pagination'),
      addProductBtn: document.getElementById('add-product-btn'),
      saveProductBtn: document.getElementById('save-product'),
      cancelProductBtn: document.getElementById('cancel-product'),
      productIdInput: document.getElementById('product-id'),
      weightVariations: document.getElementById('weight-variations'),
      addVariationBtn: document.getElementById('add-variation'),
      imageInput: document.getElementById('product-images'),
      imagePreview: document.getElementById('image-preview'),
      confirmDeleteBtn: document.getElementById('confirm-delete')
    };
  
    /**
     * Sayfa yüklendiğinde çalışacak başlangıç fonksiyonu
     */
    const init = function() {
      // Olay dinleyicilerini ekle
      bindEvents();
      
      // Kategorileri yükle
      loadCategories();
      
      // Ürünleri yükle
      loadProducts();
    };
  
    /**
     * Olay dinleyicilerini bağlar
     */
    const bindEvents = function() {
      // Sayfa yüklendiğinde
      document.addEventListener('DOMContentLoaded', function() {
        // Ürün ekleme butonu
        if (domElements.addProductBtn) {
          domElements.addProductBtn.addEventListener('click', showAddProductModal);
        }
        
        // Ürün formu gönderimi
        if (domElements.productForm) {
          domElements.productForm.addEventListener('submit', handleProductFormSubmit);
        }
        
        // İptal butonu
        if (domElements.cancelProductBtn) {
          domElements.cancelProductBtn.addEventListener('click', closeProductModal);
        }
        
        // Varyasyon ekleme butonu
        if (domElements.addVariationBtn) {
          domElements.addVariationBtn.addEventListener('click', addVariation);
        }
        
        // Resim yükleme
        if (domElements.imageInput) {
          domElements.imageInput.addEventListener('change', handleImageUpload);
        }
        
        // Ürün silme işlemi onaylama
        if (domElements.confirmDeleteBtn) {
          domElements.confirmDeleteBtn.addEventListener('click', confirmDeleteProduct);
        }
        
        // Arama inputu
        if (domElements.searchInput) {
          domElements.searchInput.addEventListener('input', debounce(function() {
            currentPage = 1;
            loadProducts();
          }, 500));
        }
        
        // Kategori filtresi
        if (domElements.categoryFilter) {
          domElements.categoryFilter.addEventListener('change', function() {
            currentPage = 1;
            loadProducts();
          });
        }
        
        // Durum filtresi
        if (domElements.statusFilter) {
          domElements.statusFilter.addEventListener('change', function() {
            currentPage = 1;
            loadProducts();
          });
        }
      });
    };
  
    /**
     * Kategorileri API'den yükler
     */
    const loadCategories = function() {
      // Demo - gerçek uygulamada API'den alınacak
      categories = [
        { id: 1, name: 'Lokum Çeşitleri' },
        { id: 2, name: 'Şekerlemeler' },
        { id: 3, name: 'Özel Koleksiyonlar' },
        { id: 4, name: 'Hediyelik Setler' }
      ];
      
      // Kategori filtresi select'ine kategorileri ekle
      if (domElements.categoryFilter) {
        let options = `<option value="" data-i18n="admin.all_categories">Tüm Kategoriler</option>`;
        
        categories.forEach(category => {
          options += `<option value="${category.id}">${category.name}</option>`;
        });
        
        domElements.categoryFilter.innerHTML = options;
      }
    };
  
    /**
     * Ürünleri API'den yükler
     */
    const loadProducts = function() {
      // Yükleniyor göstergesi
      showLoading();
      
      // Filtre değerlerini al
      const search = domElements.searchInput ? domElements.searchInput.value : '';
      const categoryId = domElements.categoryFilter ? domElements.categoryFilter.value : '';
      const status = domElements.statusFilter ? domElements.statusFilter.value : '';
      
      // API isteği parametreleri
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        sortBy: sortField,
        sortOrder: sortOrder,
        search: search,
        categoryId: categoryId,
        status: status
      };
      
      // API'den ürünleri getir
      fetchProducts(params)
        .then(response => {
          // Ürünleri tabloya ekle
          renderProductsTable(response.products);
          
          // Sayfalama
          totalPages = Math.ceil(response.total / itemsPerPage);
          renderPagination();
          
          // Yükleniyor göstergesini kapat
          hideLoading();
        })
        .catch(error => {
          console.error('Ürünler yüklenirken hata oluştu:', error);
          showNotification('error', 'Ürünler yüklenirken hata oluştu!');
          hideLoading();
        });
    };
  
    /**
     * API'den ürünleri getiren fonksiyon
     * @param {Object} params - API parametreleri
     * @returns {Promise} Ürün verileri
     */
    const fetchProducts = function(params) {
      // Demo - gerçek uygulamada API'den alınacak
      return new Promise((resolve) => {
        setTimeout(() => {
          // Demo veri
          const demoProducts = [
            {
              id: 1,
              name_tr: 'Fındıklı Türk Lokumu',
              name_en: 'Turkish Delight with Hazelnuts',
              name_ar: 'راحة تركية بالبندق',
              slug: 'findikli-turk-lokumu',
              price: 120.00,
              discounted_price: null,
              stock: 250,
              category_ids: [1],
              images: ['lokum1.jpg'],
              status: 'active',
              featured: true,
              created_at: '2023-02-15'
            },
            {
              id: 2,
              name_tr: 'Güllü Türk Lokumu',
              name_en: 'Turkish Delight with Rose Flavor',
              name_ar: 'راحة تركية بالورد',
              slug: 'gullu-turk-lokumu',
              price: 140.00,
              discounted_price: null,
              stock: 180,
              category_ids: [1],
              images: ['lokum2.jpg'],
              status: 'active',
              featured: false,
              created_at: '2023-02-18'
            },
            {
              id: 3,
              name_tr: 'Antep Fıstıklı Türk Lokumu',
              name_en: 'Turkish Delight with Pistachios',
              name_ar: 'راحة تركية بالفستق الحلبي',
              slug: 'antep-fistikli-turk-lokumu',
              price: 160.00,
              discounted_price: null,
              stock: 200,
              category_ids: [1],
              images: ['lokum3.jpg'],
              status: 'active',
              featured: true,
              created_at: '2023-02-20'
            },
            {
              id: 4,
              name_tr: 'Karışık Meyve Şekeri',
              name_en: 'Mixed Fruit Candy',
              name_ar: 'حلوى الفواكه المشكلة',
              slug: 'karisik-meyve-sekeri',
              price: 90.00,
              discounted_price: null,
              stock: 150,
              category_ids: [2],
              images: ['seker1.jpg'],
              status: 'active',
              featured: false,
              created_at: '2023-03-05'
            },
            {
              id: 5,
              name_tr: 'Premium Lokum Koleksiyonu',
              name_en: 'Premium Turkish Delight Collection',
              name_ar: 'مجموعة راحة تركية فاخرة',
              slug: 'premium-lokum-koleksiyonu',
              price: 280.00,
              discounted_price: null,
              stock: 50,
              category_ids: [4],
              images: ['set1.jpg'],
              status: 'inactive',
              featured: false,
              created_at: '2023-03-10'
            }
          ];
          
          // Filtreleme işlemi
          let filteredProducts = [...demoProducts];
          
          if (params.search) {
            const searchLower = params.search.toLowerCase();
            filteredProducts = filteredProducts.filter(product => 
              product.name_tr.toLowerCase().includes(searchLower) || 
              product.name_en.toLowerCase().includes(searchLower) ||
              product.slug.toLowerCase().includes(searchLower)
            );
          }
          
          if (params.categoryId) {
            filteredProducts = filteredProducts.filter(product => 
              product.category_ids.includes(parseInt(params.categoryId))
            );
          }
          
          if (params.status) {
            filteredProducts = filteredProducts.filter(product => 
              product.status === params.status
            );
          }
          
          // Sayfalama
          const start = (params.page - 1) * params.limit;
          const end = start + params.limit;
          const paginatedProducts = filteredProducts.slice(start, end);
          
          resolve({
            products: paginatedProducts,
            total: filteredProducts.length
          });
        }, 300);
      });
    };
  
    /**
     * Ürünleri tabloya ekler
     * @param {Array} products - Ürün listesi
     */
    const renderProductsTable = function(products) {
      if (!domElements.productTable) return;
      
      productsList = products;
      
      let html = '';
      
      if (products.length === 0) {
        html = `<tr><td colspan="8" class="text-center">Ürün bulunamadı.</td></tr>`;
      } else {
        products.forEach(product => {
          const categoryNames = getCategoryNames(product.category_ids);
          const mainImage = product.images && product.images.length > 0 ? 
            `../assets/images/products/${product.images[0]}` : 
            '../assets/images/no-image.jpg';
            
          const price = product.discounted_price ? 
            `<del>${product.price.toFixed(2)}</del> ${product.discounted_price.toFixed(2)}` : 
            product.price.toFixed(2);
            
          const statusClass = product.status === 'active' ? 'status-active' : 'status-inactive';
          const statusText = product.status === 'active' ? 'Aktif' : 'Pasif';
          
          html += `
            <tr>
              <td>${product.id}</td>
              <td><img src="${mainImage}" alt="${product.name_tr}" class="admin-product-image"></td>
              <td>${product.name_tr}</td>
              <td>${categoryNames}</td>
              <td>₺${price}</td>
              <td>${product.stock}</td>
              <td><span class="${statusClass}">${statusText}</span></td>
              <td>
                <a href="#" class="action-btn edit" title="Düzenle" onclick="editProduct(${product.id})"><i class="fas fa-edit"></i></a>
                <a href="#" class="action-btn delete" title="Sil" onclick="deleteProduct(${product.id})"><i class="fas fa-trash"></i></a>
              </td>
            </tr>
          `;
        });
      }
      
      domElements.productTable.innerHTML = html;
    };
  
    /**
     * Kategori ID'leri ile kategori isimlerini getirir
     * @param {Array} categoryIds - Kategori ID'leri
     * @returns {string} Kategori isimleri
     */
    const getCategoryNames = function(categoryIds) {
      if (!categoryIds || !categoryIds.length) return '-';
      
      const names = categoryIds.map(id => {
        const category = categories.find(cat => cat.id === id);
        return category ? category.name : '';
      }).filter(name => name !== '');
      
      return names.join(', ');
    };
  
    /**
     * Sayfalama navigasyonunu oluşturur
     */
    const renderPagination = function() {
      if (!domElements.pagination) return;
      
      let html = '';
      
      // Önceki sayfa
      if (currentPage > 1) {
        html += `<a href="#" onclick="ProductManager.goToPage(${currentPage - 1})"><i class="fas fa-chevron-left"></i></a>`;
      }
      
      // Sayfa numaraları
      const startPage = Math.max(1, currentPage - 2);
      const endPage = Math.min(totalPages, currentPage + 2);
      
      for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
          html += `<a href="#" class="active">${i}</a>`;
        } else {
          html += `<a href="#" onclick="ProductManager.goToPage(${i})">${i}</a>`;
        }
      }
      
      // Sonraki sayfa
      if (currentPage < totalPages) {
        html += `<a href="#" onclick="ProductManager.goToPage(${currentPage + 1})"><i class="fas fa-chevron-right"></i></a>`;
      }
      
      domElements.pagination.innerHTML = html;
    };
  
    /**
     * Belirtilen sayfaya gider
     * @param {number} page - Sayfa numarası
     */
    const goToPage = function(page) {
      if (page < 1 || page > totalPages) return;
      
      currentPage = page;
      loadProducts();
    };
  
    /**
     * Ürün ekleme modalını gösterir
     * @param {Event} e - Olay nesnesi
     */
    const showAddProductModal = function(e) {
      if (e) e.preventDefault();
      
      // Form reset
      resetProductForm();
      
      // Modal başlığını ayarla
      if (domElements.modalTitle) {
        domElements.modalTitle.textContent = 'Ürün Ekle';
      }
      
      // Modal'ı göster
      if (domElements.productModal) {
        domElements.productModal.style.display = 'flex';
      }
      
      // Düzenleme modu değil
      isEditing = false;
      currentProduct = null;
      
      // Product ID temizle
      if (domElements.productIdInput) {
        domElements.productIdInput.value = '';
      }
    };
  
    /**
     * Ürün düzenleme modalını gösterir
     * @param {number} productId - Ürün ID
     */
    const editProduct = function(productId) {
      // Ürünü bul
      const product = productsList.find(p => p.id === productId);
      
      if (!product) {
        showNotification('error', 'Ürün bulunamadı!');
        return;
      }
      
      // Mevcut ürünü sakla
      currentProduct = product;
      
      // Form reset
      resetProductForm();
      
      // Modal başlığını ayarla
      if (domElements.modalTitle) {
        domElements.modalTitle.textContent = 'Ürün Düzenle';
      }
      
      // Form alanlarını doldur
      fillProductForm(product);
      
      // Modal'ı göster
      if (domElements.productModal) {
        domElements.productModal.style.display = 'flex';
      }
      
      // Düzenleme modu
      isEditing = true;
      
      // Product ID set et
      if (domElements.productIdInput) {
        domElements.productIdInput.value = productId;
      }
    };
  
    /**
     * Ürün silme modalını gösterir
     * @param {number} productId - Ürün ID
     */
    const deleteProduct = function(productId) {
      // Ürünü bul
      const product = productsList.find(p => p.id === productId);
      
      if (!product) {
        showNotification('error', 'Ürün bulunamadı!');
        return;
      }
      
      // Mevcut ürünü sakla
      currentProduct = product;
      
      // Product ID set et
      if (domElements.productIdInput) {
        domElements.productIdInput.value = productId;
      }
      
      // Silme modalını göster
      if (domElements.deleteModal) {
        domElements.deleteModal.style.display = 'flex';
      }
    };
  
    /**
     * Ürün silme işlemini onaylar
     */
    const confirmDeleteProduct = function() {
      if (!currentProduct) return;
      
      // Yükleniyor göstergesi
      showLoading();
      
      // API'ye silme isteği gönder
      // Demo - gerçek uygulamada API'ye istek gönderilecek
      setTimeout(() => {
        // Ürünü listeden kaldır
        productsList = productsList.filter(p => p.id !== currentProduct.id);
        
        // Tabloyu güncelle
        renderProductsTable(productsList);
        
        // Silme modalını kapat
        if (domElements.deleteModal) {
          domElements.deleteModal.style.display = 'none';
        }
        
        // Yükleniyor göstergesini kapat
        hideLoading();
        
        // Bildirim göster
        showNotification('success', 'Ürün başarıyla silindi!');
        
        // Mevcut ürünü temizle
        currentProduct = null;
        
        // Sayfalama kontrolü
        if (productsList.length === 0 && currentPage > 1) {
          currentPage--;
          loadProducts();
        } else {
          // Ürünleri yeniden yükle
          loadProducts();
        }
      }, 500);
    };
  
    /**
     * Ürün modalını kapatır
     */
    const closeProductModal = function() {
      if (domElements.productModal) {
        domElements.productModal.style.display = 'none';
      }
      
      // Form reset
      resetProductForm();
      
      // Mevcut ürünü temizle
      currentProduct = null;
    };
  
    /**
     * Ürün formunu sıfırlar
     */
    const resetProductForm = function() {
      if (!domElements.productForm) return;
      
      // Form sıfırla
      domElements.productForm.reset();
      
      // Ürün resimleri önizlemeyi temizle
      if (domElements.imagePreview) {
        domElements.imagePreview.innerHTML = '';
      }
      
      // Varyasyonları sıfırla
      resetVariations();
      
      // Ürün resimlerini sıfırla
      productImages = [];
      deletedImages = [];
    };
  
    /**
     * Ürün varyasyonlarını sıfırlar
     */
    const resetVariations = function() {
      if (!domElements.weightVariations) return;
      
      // Varsayılan varyasyon dışındakileri temizle
      const variationItems = domElements.weightVariations.querySelectorAll('.variation-item');
      
      if (variationItems.length > 1) {
        // İlk varyasyonu tut, diğerlerini kaldır
        for (let i = 1; i < variationItems.length; i++) {
          variationItems[i].remove();
        }
      }
      
      // İlk varyasyonu sıfırla
      if (variationItems.length > 0) {
        const inputs = variationItems[0].querySelectorAll('input, select');
        inputs.forEach(input => {
          input.value = '';
        });
      }
    };
  
    /**
     * Ürün formunu mevcut ürün verileriyle doldurur
     * @param {Object} product - Ürün verileri
     */
    const fillProductForm = function(product) {
      if (!domElements.productForm) return;
      
      // Türkçe form alanları
      const nameTrInput = document.getElementById('product-name-tr');
      const descTrInput = document.getElementById('product-description-tr');
      
      // İngilizce form alanları
      const nameEnInput = document.getElementById('product-name-en');
      const descEnInput = document.getElementById('product-description-en');
      
      // Arapça form alanları
      const nameArInput = document.getElementById('product-name-ar');
      const descArInput = document.getElementById('product-description-ar');
      
      // Ortak form alanları
      const categorySelect = document.getElementById('product-category');
      const priceInput = document.getElementById('product-price');
      const stockInput = document.getElementById('product-stock');
      const statusSelect = document.getElementById('product-status');
      
      // Form alanlarını doldur
      if (nameTrInput) nameTrInput.value = product.name_tr || '';
      if (descTrInput) descTrInput.value = product.description_tr || '';
      
      if (nameEnInput) nameEnInput.value = product.name_en || '';
      if (descEnInput) descEnInput.value = product.description_en || '';
      
      if (nameArInput) nameArInput.value = product.name_ar || '';
      if (descArInput) descArInput.value = product.description_ar || '';
      
      if (categorySelect && product.category_ids && product.category_ids.length > 0) {
        categorySelect.value = product.category_ids[0];
      }
      
      if (priceInput) priceInput.value = product.price || '';
      if (stockInput) stockInput.value = product.stock || '';
      if (statusSelect) statusSelect.value = product.status || 'active';
      
      // Ürün varyasyonlarını doldur
      fillProductVariations(product);
      
      // Ürün resimlerini doldur
      fillProductImages(product);
    };
  
    /**
     * Ürün varyasyonlarını formda doldurur
     * @param {Object} product - Ürün verileri
     */
    const fillProductVariations = function(product) {
      if (!domElements.weightVariations) return;
      
      // Tüm varyasyonları temizle
      resetVariations();
      
      // Ürün varyasyonları yoksa varsayılan formu kullan
      if (!product.variations) return;
      
      // Varyasyonları JSON parse et
      let variations;
      try {
        variations = typeof product.variations === 'string' ? 
          JSON.parse(product.variations) : product.variations;
      } catch (e) {
        console.error('Varyasyon parse hatası:', e);
        return;
      }
      
      // Ağırlık varyasyonlarını kontrol et
      if (variations.weight && Array.isArray(variations.weight)) {
        // İlk varyasyonu doldur
        const firstVariation = domElements.weightVariations.querySelector('.variation-item');
        
        if (firstVariation && variations.weight.length > 0) {
          const weightSelect = firstVariation.querySelector('.weight-option');
          const priceInput = firstVariation.querySelector('.weight-price');
          const stockInput = firstVariation.querySelector('.weight-stock');
          
          if (weightSelect) weightSelect.value = variations.weight[0].value || '';
          if (priceInput) priceInput.value = variations.weight[0].price || '';
          if (stockInput) stockInput.value = variations.weight[0].stock || '';
        }
        
        // Diğer varyasyonları ekle
        for (let i = 1; i < variations.weight.length; i++) {
          addVariation();
          
          // Yeni eklenen varyasyonu doldur
          const variationItems = domElements.weightVariations.querySelectorAll('.variation-item');
          const newVariation = variationItems[variationItems.length - 1];
          
          if (newVariation) {
            const weightSelect = newVariation.querySelector('.weight-option');
            const priceInput = newVariation.querySelector('.weight-price');
            const stockInput = newVariation.querySelector('.weight-stock');
            
            if (weightSelect) weightSelect.value = variations.weight[i].value || '';
            if (priceInput) priceInput.value = variations.weight[i].price || '';
            if (stockInput) stockInput.value = variations.weight[i].stock || '';
          }
        }
      }
    };
  
    /**
     * Ürün resimlerini formda doldurur
     * @param {Object} product - Ürün verileri
     */
    const fillProductImages = function(product) {
      if (!domElements.imagePreview) return;
      
      // Resim önizlemeyi temizle
      domElements.imagePreview.innerHTML = '';
      
      // Ürün resimleri
      productImages = product.images || [];
      
      // Resimleri önizlemede göster
      productImages.forEach(image => {
        const imgElement = document.createElement('img');
        imgElement.src = `../assets/images/products/${image}`;
        imgElement.alt = product.name_tr;
        
        // Resmi silme butonu
        const deleteBtn = document.createElement('span');
        deleteBtn.className = 'delete-image';
        deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
        deleteBtn.setAttribute('data-image', image);
        deleteBtn.onclick = function() {
          removeProductImage(image);
        };
        
        // Resim container
        const imgContainer = document.createElement('div');
        imgContainer.className = 'image-container';
        imgContainer.appendChild(imgElement);
        imgContainer.appendChild(deleteBtn);
        
        domElements.imagePreview.appendChild(imgContainer);
      });
    };
  
    /**
     * Yeni varyasyon ekler
     */
    const addVariation = function() {
      if (!domElements.weightVariations) return;
      
      const variationCount = domElements.weightVariations.querySelectorAll('.variation-item').length + 1;
      
      const variationHTML = `
        <div class="variation-item">
          <div class="form-group" style="flex: 1;">
            <label for="weight-option-${variationCount}">Ağırlık Seçeneği</label>
            <select id="weight-option-${variationCount}" class="form-control weight-option">
              <option value="250g">250g</option>
              <option value="500g">500g</option>
              <option value="1kg">1kg</option>
            </select>
          </div>
          <div class="form-group" style="flex: 1;">
            <label for="weight-price-${variationCount}">Fiyat (₺)</label>
            <input type="number" id="weight-price-${variationCount}" class="form-control weight-price" step="0.01" min="0">
          </div>
          <div class="form-group" style="flex: 1;">
            <label for="weight-stock-${variationCount}">Stok</label>
            <input type="number" id="weight-stock-${variationCount}" class="form-control weight-stock" min="0">
          </div>
          <button type="button" class="remove-variation" style="margin-top: 25px;"><i class="fas fa-trash"></i></button>
        </div>
      `;
      
      domElements.weightVariations.insertAdjacentHTML('beforeend', variationHTML);
      
      // Varyasyon silme butonu event listener
      const removeButtons = domElements.weightVariations.querySelectorAll('.remove-variation');
      removeButtons.forEach(button => {
        button.addEventListener('click', function() {
          this.closest('.variation-item').remove();
        });
      });
    };
  
    /**
     * Ürün resim dosyalarını yükleme ve önizleme
     * @param {Event} e - Olay nesnesi
     */
    const handleImageUpload = function(e) {
      if (!domElements.imagePreview) return;
      
      const files = e.target.files;
      
      if (!files || files.length === 0) return;
      
      // Her bir dosya için önizleme oluştur
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Sadece resim dosyalarını kabul et
        if (!file.type.match('image.*')) continue;
        
        const reader = new FileReader();
        
        reader.onload = function(e) {
          // Resim elemanı
          const imgElement = document.createElement('img');
          imgElement.src = e.target.result;
          imgElement.alt = file.name;
          
          // Dosya adını oluştur (gerçek uygulamada sunucudan gelecek)
          const fileName = `temp_${Date.now()}_${file.name}`;
          
          // Resmi silme butonu
          const deleteBtn = document.createElement('span');
          deleteBtn.className = 'delete-image';
          deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
          deleteBtn.setAttribute('data-image', fileName);
          deleteBtn.onclick = function() {
            removeProductImage(fileName);
          };
          
          // Resim container
          const imgContainer = document.createElement('div');
          imgContainer.className = 'image-container';
          imgContainer.appendChild(imgElement);
          imgContainer.appendChild(deleteBtn);
          
          domElements.imagePreview.appendChild(imgContainer);
          
          // Yeni resmi ekle
          productImages.push(fileName);
        };
        
        // Dosyayı oku
        reader.readAsDataURL(file);
      }
    };
  
    /**
     * Ürün resmini kaldırır
     * @param {string} imageName - Resim adı
     */
    const removeProductImage = function(imageName) {
      if (!domElements.imagePreview) return;
      
      // Resmi preview'dan kaldır
      const imageElements = domElements.imagePreview.querySelectorAll('.image-container');
      
      imageElements.forEach(container => {
        const deleteBtn = container.querySelector('.delete-image');
        
        if (deleteBtn && deleteBtn.getAttribute('data-image') === imageName) {
          container.remove();
        }
      });
      
      // Resmi listeden kaldır
      productImages = productImages.filter(img => img !== imageName);
      
      // Silinecek resimler listesine ekle (eğer düzenleme modundaysa)
      if (isEditing && currentProduct && currentProduct.images && currentProduct.images.includes(imageName)) {
        deletedImages.push(imageName);
      }
    };
  
    /**
     * Ürün form submit işleyicisi
     * @param {Event} e - Olay nesnesi
     */
    const handleProductFormSubmit = function(e) {
      e.preventDefault();
      
      // Form verilerini al
      const formData = getProductFormData();
      
      // Form validasyonu
      if (!validateProductForm(formData)) {
        return;
      }
      
      // Yükleniyor göstergesi
      showLoading();
      
      // API'ye istek gönder
      if (isEditing) {
        updateProductAPI(formData);
      } else {
        createProductAPI(formData);
      }
    };
  
    /**
     * Form verilerini toplar
     * @returns {Object} Form verileri
     */
    const getProductFormData = function() {
      // Türkçe form alanları
      const nameTrInput = document.getElementById('product-name-tr');
      const descTrInput = document.getElementById('product-description-tr');
      
      // İngilizce form alanları
      const nameEnInput = document.getElementById('product-name-en');
      const descEnInput = document.getElementById('product-description-en');
      
      // Arapça form alanları
      const nameArInput = document.getElementById('product-name-ar');
      const descArInput = document.getElementById('product-description-ar');
      
      // Ortak form alanları
      const categorySelect = document.getElementById('product-category');
      const priceInput = document.getElementById('product-price');
      const stockInput = document.getElementById('product-stock');
      const statusSelect = document.getElementById('product-status');
      
      // Varyasyonları topla
      const variations = getVariationsData();
      
      // Form verilerini oluştur
      const formData = {
        id: isEditing ? currentProduct.id : null,
        name_tr: nameTrInput ? nameTrInput.value : '',
        name_en: nameEnInput ? nameEnInput.value : '',
        name_ar: nameArInput ? nameArInput.value : '',
        description_tr: descTrInput ? descTrInput.value : '',
        description_en: descEnInput ? descEnInput.value : '',
        description_ar: descArInput ? descArInput.value : '',
        category_ids: categorySelect ? [parseInt(categorySelect.value)] : [],
        price: priceInput ? parseFloat(priceInput.value) : 0,
        stock: stockInput ? parseInt(stockInput.value) : 0,
        status: statusSelect ? statusSelect.value : 'active',
        variations: variations,
        images: productImages,
        deleted_images: deletedImages
      };
      
      return formData;
    };
  
    /**
     * Varyasyon verilerini toplar
     * @returns {Object} Varyasyon verileri
     */
    const getVariationsData = function() {
      if (!domElements.weightVariations) return null;
      
      const variationItems = domElements.weightVariations.querySelectorAll('.variation-item');
      
      if (!variationItems || variationItems.length === 0) return null;
      
      const weightVariations = [];
      
      variationItems.forEach(item => {
        const weightSelect = item.querySelector('.weight-option');
        const priceInput = item.querySelector('.weight-price');
        const stockInput = item.querySelector('.weight-stock');
        
        if (weightSelect && priceInput && stockInput && 
            weightSelect.value && priceInput.value && stockInput.value) {
          
          weightVariations.push({
            value: weightSelect.value,
            price: parseFloat(priceInput.value),
            stock: parseInt(stockInput.value)
          });
        }
      });
      
      return {
        weight: weightVariations
      };
    };
  
    /**
     * Form verilerini valide eder
     * @param {Object} formData - Form verileri
     * @returns {boolean} Validasyon sonucu
     */
    const validateProductForm = function(formData) {
      // Türkçe ürün adı kontrolü
      if (!formData.name_tr || formData.name_tr.trim() === '') {
        showNotification('error', 'Türkçe ürün adı girilmelidir!');
        return false;
      }
      
      // Fiyat kontrolü
      if (!formData.price || formData.price <= 0) {
        showNotification('error', 'Geçerli bir fiyat girilmelidir!');
        return false;
      }
      
      // Kategori kontrolü
      if (!formData.category_ids || formData.category_ids.length === 0 || !formData.category_ids[0]) {
        showNotification('error', 'Kategori seçilmelidir!');
        return false;
      }
      
      return true;
    };
  
    /**
     * Yeni ürün oluşturur
     * @param {Object} formData - Form verileri
     */
    const createProductAPI = function(formData) {
      // Demo - gerçek uygulamada API'ye istek gönderilecek
      setTimeout(() => {
        // Yeni ürün ID'si oluştur
        const newId = Math.max(...productsList.map(p => p.id), 0) + 1;
        
        // Yeni ürünü oluştur
        const newProduct = {
          id: newId,
          name_tr: formData.name_tr,
          name_en: formData.name_en,
          name_ar: formData.name_ar,
          description_tr: formData.description_tr,
          description_en: formData.description_en,
          description_ar: formData.description_ar,
          slug: formData.name_tr.toLowerCase().replace(/\s+/g, '-'),
          price: formData.price,
          discounted_price: null,
          stock: formData.stock,
          category_ids: formData.category_ids,
          images: formData.images,
          status: formData.status,
          featured: false,
          created_at: new Date().toISOString().split('T')[0]
        };
        
        // Ürünü listeye ekle
        productsList.unshift(newProduct);
        
        // Ürünleri yeniden yükle
        loadProducts();
        
        // Modal'ı kapat
        closeProductModal();
        
        // Yükleniyor göstergesini kapat
        hideLoading();
        
        // Bildirim göster
        showNotification('success', 'Ürün başarıyla eklendi!');
      }, 800);
    };
  
    /**
     * Mevcut ürünü günceller
     * @param {Object} formData - Form verileri
     */
    const updateProductAPI = function(formData) {
      // Demo - gerçek uygulamada API'ye istek gönderilecek
      setTimeout(() => {
        // Ürünü bul ve güncelle
        const index = productsList.findIndex(p => p.id === formData.id);
        
        if (index !== -1) {
          // Ürünü güncelle
          productsList[index] = {
            ...productsList[index],
            name_tr: formData.name_tr,
            name_en: formData.name_en,
            name_ar: formData.name_ar,
            description_tr: formData.description_tr,
            description_en: formData.description_en,
            description_ar: formData.description_ar,
            price: formData.price,
            stock: formData.stock,
            category_ids: formData.category_ids,
            images: formData.images,
            status: formData.status
          };
        }
        
        // Ürünleri yeniden yükle
        loadProducts();
        
        // Modal'ı kapat
        closeProductModal();
        
        // Yükleniyor göstergesini kapat
        hideLoading();
        
        // Bildirim göster
        showNotification('success', 'Ürün başarıyla güncellendi!');
      }, 800);
    };
  
    /**
     * Yükleniyor göstergesini gösterir
     */
    const showLoading = function() {
      const loader = document.querySelector('.loader-container');
      
      if (!loader) {
        // Loader yoksa oluştur
        const loaderHTML = `
          <div class="loader-container">
            <div class="loader"></div>
          </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', loaderHTML);
      } else {
        loader.style.display = 'flex';
      }
    };
  
    /**
     * Yükleniyor göstergesini gizler
     */
    const hideLoading = function() {
      const loader = document.querySelector('.loader-container');
      
      if (loader) {
        loader.style.display = 'none';
      }
    };
  
    /**
     * Bildirim gösterir
     * @param {string} type - Bildirim türü (success, error, warning, info)
     * @param {string} message - Bildirim mesajı
     */
    const showNotification = function(type, message) {
      // Toast bildirimi göster
      const toast = document.querySelector('.toast');
      
      if (!toast) {
        // Toast yoksa oluştur
        const toastHTML = `
          <div class="toast toast-${type}">
            <div class="toast-content">
              <span class="toast-message">${message}</span>
            </div>
            <button class="toast-close">&times;</button>
          </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', toastHTML);
        
        // Toast'ı göster
        setTimeout(() => {
          const newToast = document.querySelector('.toast');
          
          if (newToast) {
            newToast.classList.add('show');
            
            // Kapat butonuna event listener ekle
            const closeBtn = newToast.querySelector('.toast-close');
            
            if (closeBtn) {
              closeBtn.addEventListener('click', function() {
                newToast.classList.remove('show');
                
                setTimeout(() => {
                  newToast.remove();
                }, 300);
              });
            }
            
            // Otomatik kapanma
            setTimeout(() => {
              newToast.classList.remove('show');
              
              setTimeout(() => {
                newToast.remove();
              }, 300);
            }, 3000);
          }
        }, 100);
      }
    };
  
    /**
     * Debounce fonksiyonu - belirli bir süre içinde tekrarlanan çağrıları engeller
     * @param {Function} func - Çağrılacak fonksiyon
     * @param {number} wait - Bekleme süresi (ms)
     * @returns {Function} Debounce edilmiş fonksiyon
     */
    const debounce = function(func, wait) {
      let timeout;
      
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    };
  
    // Public API - Dışa açılan metodlar
    return {
      init: init,
      goToPage: goToPage,
      editProduct: editProduct,
      deleteProduct: deleteProduct
    };
  })();
  
  // Sayfa yüklendiğinde Ürün Yöneticisini başlat
  document.addEventListener('DOMContentLoaded', function() {
    ProductManager.init();
    
    // Global nesnelere editProduct ve deleteProduct fonksiyonlarını ekle
    window.editProduct = ProductManager.editProduct;
    window.deleteProduct = ProductManager.deleteProduct;
  });