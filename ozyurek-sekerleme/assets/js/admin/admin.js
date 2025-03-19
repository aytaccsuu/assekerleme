 /**
 * Özyürek Şekerleme Admin Panel
 * Ana javascript dosyası - Admin paneli genelinde kullanılan fonksiyonlar
 */

// Strict mode etkinleştirme
'use strict';

// Admin objesi - Admin panel genel fonksiyonları
const Admin = {
    // API endpoint temel URL'i
    apiBaseUrl: '/api',
    
    // Aktif admin oturumu kontrolü
    isLoggedIn: false,
    
    // Seçili dil
    currentLanguage: 'tr',
    
    // DOM yüklendikten sonra çalışacak init fonksiyonu
    init: function() {
        // Admin giriş kontrolü
        this.checkAdminLogin();
        
        // Dil ayarlarını yükle
        this.loadLanguageSettings();
        
        // UI olaylarını başlat
        this.initUIEvents();
        
        // Bildirimleri kontrol et
        this.checkNotifications();
        
        // Dashboard verilerini yükle (dashboard sayfasındaysa)
        if (document.querySelector('.dashboard-overview')) {
            this.loadDashboardData();
        }
        
        console.log('Admin panel initialized');
    },
    
    // Admin oturum kontrolü
    checkAdminLogin: function() {
        const adminToken = localStorage.getItem('adminToken');
        const adminEmail = localStorage.getItem('adminEmail');
        
        // Token ve email yoksa login sayfasına yönlendir
        if (!adminToken || !adminEmail) {
            // Eğer zaten login sayfasında değilsek yönlendir
            if (!window.location.pathname.includes('login.html')) {
                window.location.href = '../login.html?redirect=admin';
            }
            return;
        }
        
        // Admin email kontrolü (sadece izin verilen hesap)
        if (adminEmail !== 'aytaccsu1@gmail.com') {
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminEmail');
            window.location.href = '../login.html?redirect=admin&error=unauthorized';
            return;
        }
        
        // Token geçerliliğini API üzerinden kontrol et
        this.validateAdminToken(adminToken)
            .then(valid => {
                if (!valid) {
                    localStorage.removeItem('adminToken');
                    localStorage.removeItem('adminEmail');
                    window.location.href = '../login.html?redirect=admin&error=invalid_token';
                } else {
                    this.isLoggedIn = true;
                    this.updateUserInfo();
                }
            })
            .catch(error => {
                console.error('Admin oturum kontrolü hatası:', error);
                // Hata alınsa bile sayfa erişimi veriyoruz (offline çalışabilmek için)
                // Gerçek bir uygulamada burada da login sayfasına yönlendirilebilir
                this.isLoggedIn = true;
            });
    },
    
    // Admin token doğrulama
    validateAdminToken: function(token) {
        // API isteği simulasyonu (gerçek uygulamada API'ye istek yapılır)
        return new Promise((resolve) => {
            setTimeout(() => {
                // Geliştirme aşamasında her zaman true dönüyoruz
                resolve(true);
            }, 300);
        });
    },
    
    // Kullanıcı bilgilerini güncelleme
    updateUserInfo: function() {
        const adminNameEl = document.querySelector('.admin-user-menu .user-info span');
        if (adminNameEl) {
            adminNameEl.textContent = 'Admin';
        }
    },
    
    // Dil ayarlarını yükleme
    loadLanguageSettings: function() {
        // LocalStorage'dan dil ayarını al
        const savedLanguage = localStorage.getItem('language') || 'tr';
        this.currentLanguage = savedLanguage;
        
        // Dil seçiciyi güncelle
        const languageSelector = document.getElementById('admin-language-selector');
        if (languageSelector) {
            languageSelector.value = this.currentLanguage;
            
            // Dil değiştirme event listener'ı
            languageSelector.addEventListener('change', (e) => {
                this.changeLanguage(e.target.value);
            });
        }
        
        // Mevcut dil dosyasını yükle
        this.loadLanguageFile(this.currentLanguage);
    },
    
    // Dil değiştirme
    changeLanguage: function(lang) {
        // Yeni dili localStorage'a kaydet
        localStorage.setItem('language', lang);
        this.currentLanguage = lang;
        
        // Dil dosyasını yükle
        this.loadLanguageFile(lang);
        
        console.log(`Dil değiştirildi: ${lang}`);
    },
    
    // Dil dosyasını yükleme ve uygulamak
    loadLanguageFile: function(lang) {
        // Dil dosyasını çek
        fetch(`../locales/${lang}.json`)
            .then(response => response.json())
            .then(data => {
                // Tüm çevirileri uygula
                this.applyTranslations(data);
                
                // RTL desteği
                this.applyRTLSupport(lang);
            })
            .catch(error => {
                console.error('Dil dosyası yüklenirken hata oluştu:', error);
            });
    },
    
    // Çevirileri uygulama
    applyTranslations: function(translations) {
        // data-i18n özelliğine sahip tüm elementleri bul
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const value = this.getNestedTranslation(translations, key);
            
            if (value) {
                element.textContent = value;
            }
        });
        
        // Placeholder değerlerini çevir (data-i18n-placeholder)
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            const value = this.getNestedTranslation(translations, key);
            
            if (value) {
                element.placeholder = value;
            }
        });
        
        // Title değerlerini çevir (data-i18n-title)
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            const value = this.getNestedTranslation(translations, key);
            
            if (value) {
                element.title = value;
            }
        });
    },
    
    // Çok seviyeli objelerde çeviri değerini almak için
    getNestedTranslation: function(obj, path) {
        const keys = path.split('.');
        let current = obj;
        
        for (const key of keys) {
            if (current[key] === undefined) {
                return null;
            }
            current = current[key];
        }
        
        return current;
    },
    
    // RTL desteği
    applyRTLSupport: function(lang) {
        // Arapça için RTL desteği ekle
        if (lang === 'ar') {
            document.documentElement.dir = 'rtl';
            document.body.classList.add('rtl');
            // RTL CSS dosyasını yükle
            this.loadCSS('../assets/css/rtl.css');
        } else {
            document.documentElement.dir = 'ltr';
            document.body.classList.remove('rtl');
            // RTL CSS dosyasını kaldır
            this.unloadCSS('../assets/css/rtl.css');
        }
    },
    
    // CSS dosyası yükleme
    loadCSS: function(href) {
        if (!document.querySelector(`link[href="${href}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.id = 'rtl-stylesheet';
            document.head.appendChild(link);
        }
    },
    
    // CSS dosyası kaldırma
    unloadCSS: function(href) {
        const link = document.querySelector(`link[href="${href}"]`);
        if (link) {
            link.remove();
        }
    },
    
    // Bildirimleri kontrol etme
    checkNotifications: function() {
        // API isteği ile yeni bildirimleri kontrol et
        this.apiRequest('GET', '/notifications/unread')
            .then(data => {
                if (data && data.success && data.data.length > 0) {
                    this.showNotificationBadge(data.data.length);
                }
            })
            .catch(error => {
                console.error('Bildirimler kontrol edilirken hata oluştu:', error);
            });
    },
    
    // Bildirim badge'ini gösterme
    showNotificationBadge: function(count) {
        const notificationLink = document.querySelector('.admin-nav a[href="notifications.html"]');
        if (notificationLink) {
            // Badge yoksa oluştur
            let badge = notificationLink.querySelector('.notification-badge');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'notification-badge';
                notificationLink.appendChild(badge);
            }
            
            // Badge içeriğini güncelle
            badge.textContent = count;
            badge.style.display = 'inline-flex';
        }
    },
    
    // Dashboard verilerini yükleme
    loadDashboardData: function() {
        // Son siparişleri yükle
        this.loadRecentOrders();
        
        // İstatistikleri yükle
        this.loadDashboardStats();
    },
    
    // Son siparişleri yükleme
    loadRecentOrders: function() {
        this.apiRequest('GET', '/orders?limit=5&sort=created_at&order=desc')
            .then(data => {
                if (data && data.success) {
                    // Son siparişleri tabloya ekle
                    this.updateRecentOrdersTable(data.data);
                }
            })
            .catch(error => {
                console.error('Son siparişler yüklenirken hata oluştu:', error);
            });
    },
    
    // Dashboard istatistiklerini yükleme
    loadDashboardStats: function() {
        this.apiRequest('GET', '/dashboard/stats')
            .then(data => {
                if (data && data.success) {
                    // İstatistikleri güncelle
                    this.updateDashboardStats(data.data);
                }
            })
            .catch(error => {
                console.error('Dashboard istatistikleri yüklenirken hata oluştu:', error);
            });
    },
    
    // Son siparişler tablosunu güncelleme
    updateRecentOrdersTable: function(orders) {
        const tableBody = document.querySelector('.recent-orders table tbody');
        if (!tableBody || !orders || !orders.length) return;
        
        // Örnek veri - API çağrısında gerçek veriler alınacak
        // Offline modda çalışabilmek için örnek veriler kullanıyoruz
        console.log('Son siparişler yüklenecek:', orders);
    },
    
    // Dashboard istatistiklerini güncelleme
    updateDashboardStats: function(stats) {
        // Örnek veri - API çağrısında gerçek veriler alınacak
        // Offline modda çalışabilmek için örnek veriler kullanıyoruz
        console.log('Dashboard istatistikleri yüklenecek:', stats);
    },
    
    // UI olaylarını başlatma
    initUIEvents: function() {
        // Mobil menü aç/kapa
        this.initMobileMenu();
        
        // Modal işlemleri
        this.initModals();
        
        // Açılır menüler
        this.initDropdowns();
        
        // Form doğrulama işlemleri
        this.initFormValidation();
        
        // Çıkış işlemi
        this.initLogout();
    },
    
    // Mobil menü işlemleri
    initMobileMenu: function() {
        const hamburger = document.querySelector('.hamburger');
        const mobileMenu = document.querySelector('.mobile-menu');
        const overlay = document.querySelector('.overlay');
        
        if (hamburger && mobileMenu) {
            hamburger.addEventListener('click', () => {
                hamburger.classList.toggle('active');
                mobileMenu.classList.toggle('active');
                if (overlay) overlay.classList.toggle('active');
                document.body.classList.toggle('menu-open');
            });
            
            // Mobil menü kapat butonu
            const closeBtn = mobileMenu.querySelector('.mobile-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    hamburger.classList.remove('active');
                    mobileMenu.classList.remove('active');
                    if (overlay) overlay.classList.remove('active');
                    document.body.classList.remove('menu-open');
                });
            }
            
            // Overlay tıklandığında menüyü kapat
            if (overlay) {
                overlay.addEventListener('click', () => {
                    hamburger.classList.remove('active');
                    mobileMenu.classList.remove('active');
                    overlay.classList.remove('active');
                    document.body.classList.remove('menu-open');
                });
            }
        }
    },
    
    // Modal işlemleri
    initModals: function() {
        // Tüm modalleri seç
        const modals = document.querySelectorAll('.modal-overlay');
        
        modals.forEach(modal => {
            // Kapatma butonları
            const closeButtons = modal.querySelectorAll('.modal-close, [data-dismiss="modal"]');
            
            closeButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    modal.style.display = 'none';
                });
            });
            
            // Modal dışına tıklanınca kapat
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });
        
        // Modal açma butonları
        document.querySelectorAll('[data-toggle="modal"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const targetModal = document.querySelector(btn.getAttribute('data-target'));
                if (targetModal) {
                    targetModal.style.display = 'flex';
                }
            });
        });
    },
    
    // Dropdown menüler
    initDropdowns: function() {
        document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const dropdown = toggle.parentElement;
                const dropdownMenu = dropdown.querySelector('.dropdown-menu');
                
                if (dropdownMenu) {
                    dropdown.classList.toggle('show');
                    dropdownMenu.classList.toggle('show');
                }
            });
        });
        
        // Dropdown dışına tıklanınca kapat
        document.addEventListener('click', () => {
            document.querySelectorAll('.dropdown.show').forEach(dropdown => {
                dropdown.classList.remove('show');
                const dropdownMenu = dropdown.querySelector('.dropdown-menu');
                if (dropdownMenu) {
                    dropdownMenu.classList.remove('show');
                }
            });
        });
    },
    
    // Form doğrulama işlemleri
    initFormValidation: function() {
        document.querySelectorAll('form.needs-validation').forEach(form => {
            form.addEventListener('submit', (e) => {
                if (!form.checkValidity()) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                
                form.classList.add('was-validated');
            });
        });
    },
    
    // Çıkış işlemi
    initLogout: function() {
        const logoutBtn = document.querySelector('#admin-logout');
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Oturum bilgilerini temizle
                localStorage.removeItem('adminToken');
                localStorage.removeItem('adminEmail');
                
                // Giriş sayfasına yönlendir
                window.location.href = '../login.html';
            });
        }
    },
    
    // API istekleri için yardımcı fonksiyon
    apiRequest: function(method, endpoint, data = null) {
        const url = this.apiBaseUrl + endpoint;
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Language': this.currentLanguage
            }
        };
        
        // Token varsa ekle
        const adminToken = localStorage.getItem('adminToken');
        if (adminToken) {
            options.headers['Authorization'] = `Bearer ${adminToken}`;
        }
        
        // POST, PUT gibi istekler için veri ekle
        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            options.body = JSON.stringify(data);
        }
        
        // Hata kontrolü için önce isteği gerçekleştir
        return fetch(url, options)
            .then(response => {
                // HTTP hatası varsa fırlat
                if (!response.ok) {
                    throw new Error(`HTTP Hatası: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                // API hatası varsa fırlat
                if (data && !data.success) {
                    throw new Error(data.message || 'API Hatası');
                }
                return data;
            });
    },
    
    // Toast bildirimleri gösterme
    showToast: function(message, type = 'success', duration = 3000) {
        // Toast container varsa kullan, yoksa oluştur
        let toastContainer = document.querySelector('.toast-container');
        
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }
        
        // Yeni toast oluştur
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="toast-icon fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close">&times;</button>
        `;
        
        // Toast'u container'a ekle
        toastContainer.appendChild(toast);
        
        // Toast'u göster
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        // Kapatma butonu
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            toast.classList.remove('show');
            
            // Animasyon bittikten sonra DOM'dan kaldır
            setTimeout(() => {
                toast.remove();
            }, 300);
        });
        
        // Belirli süre sonra otomatik kapat
        setTimeout(() => {
            toast.classList.remove('show');
            
            // Animasyon bittikten sonra DOM'dan kaldır
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, duration);
    },
    
    // Ürün resmi önizleme
    initImagePreview: function(inputId, previewId) {
        const input = document.getElementById(inputId);
        const preview = document.getElementById(previewId);
        
        if (input && preview) {
            input.addEventListener('change', function() {
                preview.innerHTML = '';
                
                if (this.files) {
                    Array.from(this.files).forEach(file => {
                        if (file.type.match('image.*')) {
                            const reader = new FileReader();
                            
                            reader.onload = function(e) {
                                const img = document.createElement('img');
                                img.src = e.target.result;
                                preview.appendChild(img);
                            }
                            
                            reader.readAsDataURL(file);
                        }
                    });
                }
            });
        }
    },
    
    // Onay modalı gösterme
    showConfirmModal: function(title, message, confirmCallback, cancelCallback = null) {
        // Mevcut confirm modalı varsa sil
        let confirmModal = document.getElementById('confirm-modal');
        if (confirmModal) {
            confirmModal.remove();
        }
        
        // Yeni modal oluştur
        confirmModal = document.createElement('div');
        confirmModal.id = 'confirm-modal';
        confirmModal.className = 'modal-overlay';
        confirmModal.innerHTML = `
            <div class="modal" style="max-width: 400px;">
                <div class="modal-header">
                    <h2>${title}</h2>
                    <button class="modal-close">&times;</button>
                </div>
                <p>${message}</p>
                <div class="modal-footer">
                    <button type="button" class="btn" id="cancel-confirm">İptal</button>
                    <button type="button" class="btn btn-primary" id="ok-confirm">Tamam</button>
                </div>
            </div>
        `;
        
        // Modalı sayfaya ekle
        document.body.appendChild(confirmModal);
        
        // Modalı göster
        confirmModal.style.display = 'flex';
        
        // Buton olayları
        const closeBtn = confirmModal.querySelector('.modal-close');
        const cancelBtn = confirmModal.querySelector('#cancel-confirm');
        const okBtn = confirmModal.querySelector('#ok-confirm');
        
        // Kapatma işlemleri
        const closeModal = () => {
            confirmModal.style.display = 'none';
            setTimeout(() => {
                confirmModal.remove();
            }, 300);
        };
        
        // Kapatma butonu
        closeBtn.addEventListener('click', () => {
            closeModal();
            if (cancelCallback) cancelCallback();
        });
        
        // İptal butonu
        cancelBtn.addEventListener('click', () => {
            closeModal();
            if (cancelCallback) cancelCallback();
        });
        
        // Tamam butonu
        okBtn.addEventListener('click', () => {
            closeModal();
            if (confirmCallback) confirmCallback();
        });
        
        // Modal dışına tıklama
        confirmModal.addEventListener('click', (e) => {
            if (e.target === confirmModal) {
                closeModal();
                if (cancelCallback) cancelCallback();
            }
        });
    },
    
    // Form veri formatları
    formatters: {
        // Para birimi formatı
        currency: function(value, currency = '₺') {
            if (!value) return `0 ${currency}`;
            return parseFloat(value).toLocaleString('tr-TR') + ' ' + currency;
        },
        
        // Tarih formatı
        date: function(dateStr) {
            if (!dateStr) return '';
            const date = new Date(dateStr);
            return date.toLocaleDateString('tr-TR');
        },
        
        // Tarih ve saat formatı
        datetime: function(dateStr) {
            if (!dateStr) return '';
            const date = new Date(dateStr);
            return date.toLocaleDateString('tr-TR') + ' ' + date.toLocaleTimeString('tr-TR');
        }
    }
};

// Sayfa yüklendiğinde admin panelini başlat
document.addEventListener('DOMContentLoaded', function() {
    Admin.init();
});
