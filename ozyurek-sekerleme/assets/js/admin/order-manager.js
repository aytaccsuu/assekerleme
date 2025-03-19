/**
 * Özyürek Şekerleme - Admin Sipariş Yöneticisi
 * Admin paneli sipariş yönetimi için JavaScript fonksiyonları
 * Bölüm 1
 */

// Global değişkenler ve sabitler
let currentPage = 1;
const itemsPerPage = 10;
let totalOrders = 0;
let orderData = [];
let sessionToken = localStorage.getItem('adminSessionToken');

// Sayfa yüklendiğinde başlangıç işlemlerini gerçekleştir
document.addEventListener('DOMContentLoaded', function() {
    // Session kontrolü
    checkSession();
    
    // DOM elementlerini seç
    const orderSearchInput = document.getElementById('search-order');
    const statusFilter = document.getElementById('status-filter');
    const dateFilter = document.getElementById('date-filter');
    const paymentFilter = document.getElementById('payment-filter');
    
    // Filtre eventlerini ekle
    if (orderSearchInput) {
      orderSearchInput.addEventListener('keyup', filterOrders);
    }
    
    if (statusFilter) {
      statusFilter.addEventListener('change', filterOrders);
    }
    
    if (dateFilter) {
      dateFilter.addEventListener('change', filterOrders);
    }
    
    if (paymentFilter) {
      paymentFilter.addEventListener('change', filterOrders);
    }
    
    // View order detay modal kontrolü
    initializeOrderDetailModal();
    
    // Sipariş durumu güncelleme modal kontrolü
    initializeStatusUpdateModal();
    
    // Sipariş iptal modal kontrolü
    initializeCancelOrderModal();
    
    // Pagination kontrollerini ekle
    initializePagination();
    
    // URL parametrelerini kontrol et
    checkUrlParams();
    
    // Responsive tasarım kontrolleri
    handleResponsiveLayout();
    window.addEventListener('resize', handleResponsiveLayout);
});

/**
 * Admin oturumunu kontrol eder
 */
function checkSession() {
    // Session token var mı kontrol et
    if (!sessionToken) {
        // Redirect to login page
        window.location.href = '/admin/login?redirect=' + encodeURIComponent(window.location.pathname);
        return;
    }
    
    // Token geçerliliğini API ile kontrol et
    try {
        validateSessionToken(sessionToken);
    } catch (error) {
        console.error('Session validation error:', error);
        // Oturum sorunluysa çıkış yap
        logout();
    }
}

/**
 * Session token geçerliliğini API ile kontrol eder
 * @param {string} token - Session token
 */
async function validateSessionToken(token) {
    try {
        const response = await fetch('/api/admin/validate-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Invalid session');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Session validation error:', error);
        throw error;
    }
}

/**
 * Admin oturumunu sonlandırır
 */
function logout() {
    localStorage.removeItem('adminSessionToken');
    window.location.href = '/admin/login';
}

/**
 * Order detail modal ayarlarını initialize eder
 */
function initializeOrderDetailModal() {
    const orderDetailModal = document.getElementById('order-detail-modal');
    if (!orderDetailModal) return;
    
    const closeDetailModalBtn = document.getElementById('close-detail-modal');
    const closeOrderDetailsBtn = document.getElementById('close-order-details');
    
    if (closeDetailModalBtn) {
        closeDetailModalBtn.addEventListener('click', function() {
            orderDetailModal.style.display = 'none';
        });
    }
    
    if (closeOrderDetailsBtn) {
        closeOrderDetailsBtn.addEventListener('click', function() {
            orderDetailModal.style.display = 'none';
        });
    }
    
    // Modal dışına tıklandığında kapat
    window.addEventListener('click', function(event) {
        if (event.target === orderDetailModal) {
            orderDetailModal.style.display = 'none';
        }
    });
}

/**
 * Sipariş durumu güncelleme modal ayarlarını initialize eder
 */
function initializeStatusUpdateModal() {
    const statusUpdateModal = document.getElementById('status-update-modal');
    if (!statusUpdateModal) return;
    
    const closeStatusModalBtn = document.getElementById('close-status-modal');
    const cancelStatusUpdateBtn = document.getElementById('cancel-status-update');
    
    if (closeStatusModalBtn) {
        closeStatusModalBtn.addEventListener('click', function() {
            statusUpdateModal.style.display = 'none';
        });
    }
    
    if (cancelStatusUpdateBtn) {
        cancelStatusUpdateBtn.addEventListener('click', function() {
            statusUpdateModal.style.display = 'none';
        });
    }
    
    // Modal dışına tıklandığında kapat
    window.addEventListener('click', function(event) {
        if (event.target === statusUpdateModal) {
            statusUpdateModal.style.display = 'none';
        }
    });
    
    // Durum güncelleme formunu dinle
    const statusUpdateForm = document.getElementById('status-update-form');
    if (statusUpdateForm) {
        statusUpdateForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Form validasyonu
            if (validateStatusUpdateForm()) {
                updateOrderStatusSubmit();
            }
        });
    }
}

/**
 * Sipariş iptal modal ayarlarını initialize eder
 */
function initializeCancelOrderModal() {
    const cancelOrderModal = document.getElementById('cancel-order-modal');
    if (!cancelOrderModal) return;
    
    const closeCancelModalBtn = document.getElementById('close-cancel-modal');
    const cancelCancelOrderBtn = document.getElementById('cancel-cancel-order');
    const confirmCancelOrderBtn = document.getElementById('confirm-cancel-order');
    
    if (closeCancelModalBtn) {
        closeCancelModalBtn.addEventListener('click', function() {
            cancelOrderModal.style.display = 'none';
        });
    }
    
    if (cancelCancelOrderBtn) {
        cancelCancelOrderBtn.addEventListener('click', function() {
            cancelOrderModal.style.display = 'none';
        });
    }
    
    if (confirmCancelOrderBtn) {
        confirmCancelOrderBtn.addEventListener('click', function() {
            // Form validasyonu
            if (validateCancelOrderForm()) {
                cancelOrderSubmit();
            }
        });
    }
    
    // Modal dışına tıklandığında kapat
    window.addEventListener('click', function(event) {
        if (event.target === cancelOrderModal) {
            cancelOrderModal.style.display = 'none';
        }
    });
}

/**
 * Sayfalama kontrollerini initialize eder
 */
function initializePagination() {
    const paginationContainer = document.getElementById('pagination-container');
    if (!paginationContainer) return;
    
    // Toplam sipariş sayısını API'den al ve sayfalama kontrollerini oluştur
    fetchTotalOrderCount()
        .then(count => {
            totalOrders = count;
            renderPagination();
        })
        .catch(error => {
            console.error('Failed to fetch order count:', error);
            showNotification('error', getTranslation('error.failed_to_fetch_data', 'Veri alınamadı. Lütfen sayfayı yenileyin.'));
        });
    
    // Sayfa değiştirme eventleri
    paginationContainer.addEventListener('click', function(e) {
        if (e.target.classList.contains('page-link')) {
            e.preventDefault();
            const page = parseInt(e.target.dataset.page);
            if (page > 0) {
                currentPage = page;
                fetchOrders(currentPage, itemsPerPage);
                renderPagination();
            }
        }
    });
}

/**
 * Toplam sipariş sayısını API'den alır
 * @returns {Promise<number>} Toplam sipariş sayısı
 */
async function fetchTotalOrderCount() {
    try {
        const response = await fetch('/api/admin/orders/count', {
            headers: {
                'Authorization': `Bearer ${sessionToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch order count');
        }
        
        const data = await response.json();
        return data.count;
    } catch (error) {
        console.error('Error fetching order count:', error);
        throw error;
    }
}

/**
 * Belirli sayfadaki siparişleri API'den alır
 * @param {number} page - Sayfa numarası
 * @param {number} limit - Sayfa başına öğe sayısı
 */
async function fetchOrders(page, limit) {
    try {
        const searchText = document.getElementById('search-order').value.toLowerCase();
        const statusValue = document.getElementById('status-filter').value;
        const dateValue = document.getElementById('date-filter').value;
        const paymentValue = document.getElementById('payment-filter').value;
        
        // URL parametrelerini oluştur
        let queryParams = new URLSearchParams({
            page: page,
            limit: limit
        });
        
        if (searchText) {
            queryParams.append('search', searchText);
        }
        
        if (statusValue) {
            queryParams.append('status', statusValue);
        }
        
        if (dateValue) {
            queryParams.append('date', dateValue);
        }
        
        if (paymentValue) {
            queryParams.append('payment', paymentValue);
        }
        
        const response = await fetch(`/api/admin/orders?${queryParams.toString()}`, {
            headers: {
                'Authorization': `Bearer ${sessionToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch orders');
        }
        
        const data = await response.json();
        orderData = data.orders;
        
        // Tabloyu güncelle
        renderOrdersTable(orderData);
        
        // Filtreleri uygula
        applyFilters();
    } catch (error) {
        console.error('Error fetching orders:', error);
        showNotification('error', getTranslation('error.failed_to_fetch_data', 'Veri alınamadı. Lütfen sayfayı yenileyin.'));
    }
}

/**
 * Sayfalama kontrollerini render eder
 */
function renderPagination() {
    const paginationContainer = document.getElementById('pagination-container');
    if (!paginationContainer) return;
    
    const totalPages = Math.ceil(totalOrders / itemsPerPage);
    let paginationHTML = '';
    
    // Önceki sayfa butonu
    paginationHTML += `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
        <a class="page-link" href="#" data-page="${currentPage - 1}" aria-label="Previous">
            <span aria-hidden="true">&laquo;</span>
        </a>
    </li>`;
    
    // Sayfa butonları
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `<li class="page-item ${currentPage === i ? 'active' : ''}">
            <a class="page-link" href="#" data-page="${i}">${i}</a>
        </li>`;
    }
    
    // Sonraki sayfa butonu
    paginationHTML += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
        <a class="page-link" href="#" data-page="${currentPage + 1}" aria-label="Next">
            <span aria-hidden="true">&raquo;</span>
        </a>
    </li>`;
    
    paginationContainer.innerHTML = paginationHTML;
}

/**
 * Çeviri metni alır, i18n kontrolü yapar
 * @param {string} key - Çeviri anahtarı
 * @param {string} defaultText - Varsayılan metin
 * @returns {string} Çevirisi yapılmış metin
 */
function getTranslation(key, defaultText) {
    // i18n objesi var mı kontrol et
    if (typeof i18n !== 'undefined' && typeof i18n.translate === 'function') {
        return i18n.translate(key) || defaultText;
    }
    return defaultText;
}

/**
 * HTML'i güvenli hale getirir (XSS koruması)
 * @param {string} text - İşlenecek metin
 * @returns {string} Güvenli metin
 */
function escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Para birimini formatlar
 * @param {number} amount - Miktar
 * @returns {string} Formatlanmış para birimi
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY'
    }).format(amount);
}

/**
 * Tarihi yerelleştirir
 * @param {Date} date - Tarih
 * @param {boolean} includeTime - Zaman eklensin mi
 * @returns {string} Formatlanmış tarih
 */
function localizeDate(date, includeTime = false) {
    const options = {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };
    
    if (includeTime) {
        options.hour = '2-digit';
        options.minute = '2-digit';
    }
    
    return date.toLocaleDateString('tr-TR', options);
}

/**
 * Yerelleştirilmiş tarihi ayrıştırır
 * @param {string} dateStr - Tarih metni
 * @returns {Date} Date objesi
 */
function parseLocalizedDate(dateStr) {
    // TR tarih formatını parse et (gün Ay yıl)
    const parts = dateStr.split(' ');
    const day = parseInt(parts[0]);
    
    const monthMap = {
        'Ocak': 0, 'Şubat': 1, 'Mart': 2, 'Nisan': 3, 'Mayıs': 4, 'Haziran': 5,
        'Temmuz': 6, 'Ağustos': 7, 'Eylül': 8, 'Ekim': 9, 'Kasım': 10, 'Aralık': 11
    };
    
    const month = monthMap[parts[1]];
    const year = parseInt(parts[2]);
    
    return new Date(year, month, day);
}

/**
 * Ödeme yöntemi metni alır
 * @param {string} method - Ödeme yöntemi
 * @returns {string} Ödeme yöntemi metni
 */
function getPaymentMethodText(method) {
    switch (method) {
        case 'credit_card':
            return getTranslation('admin.credit_card', 'Kredi Kartı');
        case 'cash_on_delivery':
            return getTranslation('admin.cash_on_delivery', 'Kapıda Ödeme');
        case 'bank_transfer':
            return getTranslation('admin.bank_transfer', 'Banka Havalesi');
        default:
            return method;
    }
}

/**
 * Ödeme durumu metni alır
 * @param {string} status - Ödeme durumu
 * @returns {string} Ödeme durumu metni
 */
function getPaymentStatusText(status) {
    switch (status) {
        case 'pending':
            return getTranslation('admin.payment_pending', 'Bekliyor');
        case 'completed':
            return getTranslation('admin.payment_completed', 'Tamamlandı');
        case 'failed':
            return getTranslation('admin.payment_failed', 'Başarısız');
        case 'refunded':
            return getTranslation('admin.payment_refunded', 'İade Edildi');
        default:
            return status;
    }
}

/**
 * Sipariş durumu metni alır
 * @param {string} status - Sipariş durumu
 * @returns {string} Sipariş durumu metni
 */
function getStatusText(status) {
    switch (status) {
        case 'pending':
            return getTranslation('admin.pending', 'Onay Bekliyor');
        case 'processing':
            return getTranslation('admin.processing', 'Hazırlanıyor');
        case 'shipped':
            return getTranslation('admin.shipped', 'Kargoya Verildi');
        case 'delivered':
            return getTranslation('admin.delivered', 'Teslim Edildi');
        case 'cancelled':
            return getTranslation('admin.cancelled', 'İptal Edildi');
        default:
            return status;
    }
}

/**
 * Duyarlı tasarım ayarlamaları yapar
 */
function handleResponsiveLayout() {
    const windowWidth = window.innerWidth;
    const orderTable = document.querySelector('.admin-table');
    
    if (!orderTable) return;
    
    if (windowWidth < 768) {
        // Mobil görünüm
        orderTable.classList.add('mobile-view');
        
        // Sipariş tablosundaki gereksiz sütunları gizle
        const headerCells = orderTable.querySelectorAll('thead th');
        const rows = orderTable.querySelectorAll('tbody tr');
        
        // Sadece Sipariş No, Müşteri ve Durum göster, diğerlerini gizle
        headerCells.forEach((cell, index) => {
            if (index !== 0 && index !== 1 && index !== 5 && index !== 6) {
                cell.style.display = 'none';
            }
        });
        
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            cells.forEach((cell, index) => {
                if (index !== 0 && index !== 1 && index !== 5 && index !== 6) {
                    cell.style.display = 'none';
                }
            });
        });
    } else {
        // Masaüstü görünüm
        orderTable.classList.remove('mobile-view');
        
        // Tüm sütunları göster
        const allCells = orderTable.querySelectorAll('th, td');
        allCells.forEach(cell => {
            cell.style.display = '';
        });
    }
}
/**
 * Özyürek Şekerleme - Admin Sipariş Yöneticisi
 * Admin paneli sipariş yönetimi için JavaScript fonksiyonları
 * Bölüm 2
 */

/**
 * Siparişleri tabloya render eder
 * @param {Array} orders - Sipariş verileri
 */
function renderOrdersTable(orders) {
    const tableBody = document.querySelector('.admin-table tbody');
    if (!tableBody) return;
    
    let tableHTML = '';
    
    if (orders.length === 0) {
        tableHTML = `<tr><td colspan="7" class="text-center">${getTranslation('admin.no_orders_found', 'Sipariş bulunamadı')}</td></tr>`;
    } else {
        orders.forEach(order => {
            const orderDate = new Date(order.orderDate);
            const formattedDate = localizeDate(orderDate);
            
            tableHTML += `
                <tr>
                    <td>#${order.id}</td>
                    <td>${escapeHTML(order.customerName)}</td>
                    <td>${formattedDate}</td>
                    <td>${formatCurrency(order.totalAmount)}</td>
                    <td>${getPaymentMethodText(order.paymentMethod)}</td>
                    <td><span class="status-badge status-${order.status}">${getStatusText(order.status)}</span></td>
                    <td>
                        <a href="#" class="action-btn view" title="${getTranslation('admin.view', 'Görüntüle')}" onclick="viewOrder('${order.id}'); return false;">
                            <i class="fas fa-eye"></i>
                        </a>
                        ${(order.status !== 'delivered' && order.status !== 'cancelled') ? 
                            `<a href="#" class="action-btn edit" title="${getTranslation('admin.update_status', 'Durumu Güncelle')}" onclick="updateOrderStatus('${order.id}'); return false;">
                                <i class="fas fa-edit"></i>
                            </a>
                            <a href="#" class="action-btn delete" title="${getTranslation('admin.cancel_order', 'Siparişi İptal Et')}" onclick="cancelOrder('${order.id}'); return false;">
                                <i class="fas fa-times"></i>
                            </a>` : ''}
                    </td>
                </tr>
            `;
        });
    }
    
    tableBody.innerHTML = tableHTML;
}

/**
 * URL parametrelerini kontrol eder ve işlem yapar
 */
function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('id');
    const action = urlParams.get('action');
    
    if (orderId) {
        // Sipariş ID'si varsa detaylarını göster
        viewOrder(orderId);
    }
    
    if (action === 'update-status' && orderId) {
        // Durum güncelleme işlemi varsa modalı aç
        updateOrderStatus(orderId);
    } else if (action === 'cancel' && orderId) {
        // Sipariş iptal işlemi varsa modalı aç
        cancelOrder(orderId);
    }
}

/**
 * Siparişleri filtreler
 */
function filterOrders() {
    // API tabanlı filtreleme için verileri yeniden getir
    fetchOrders(currentPage, itemsPerPage);
}

/**
 * Tablodaki filtreleri uygular (frontend filtreleme)
 */
function applyFilters() {
    const searchText = document.getElementById('search-order').value.toLowerCase();
    const statusValue = document.getElementById('status-filter').value;
    const dateValue = document.getElementById('date-filter').value;
    const paymentValue = document.getElementById('payment-filter').value;
    
    const rows = document.querySelectorAll('.admin-table tbody tr');
    
    rows.forEach(row => {
        let showRow = true;
        
        // Sipariş No ve Müşteri adına göre filtrele
        const orderIdCell = row.querySelector('td:nth-child(1)');
        const customerCell = row.querySelector('td:nth-child(2)');
        
        if (orderIdCell && customerCell) {
            const orderId = orderIdCell.textContent.toLowerCase();
            const customer = customerCell.textContent.toLowerCase();
            
            if (searchText && !(orderId.includes(searchText) || customer.includes(searchText))) {
                showRow = false;
            }
        }
        
        // Durum filtreleme
        if (statusValue && showRow) {
            const statusCell = row.querySelector('td:nth-child(6) .status-badge');
            if (statusCell && !statusCell.classList.contains(`status-${statusValue}`)) {
                showRow = false;
            }
        }
        
        // Ödeme yöntemi filtreleme
        if (paymentValue && showRow) {
            const paymentCell = row.querySelector('td:nth-child(5)');
            if (paymentCell) {
                const paymentMethod = paymentCell.textContent.toLowerCase();
                // Ödeme yöntemi değerini uygun formatta ayarla
                let paymentCompare = '';
                
                if (paymentValue === 'credit_card') {
                    paymentCompare = getTranslation('admin.credit_card', 'Kredi Kartı').toLowerCase();
                } else if (paymentValue === 'cash_on_delivery') {
                    paymentCompare = getTranslation('admin.cash_on_delivery', 'Kapıda Ödeme').toLowerCase();
                } else if (paymentValue === 'bank_transfer') {
                    paymentCompare = getTranslation('admin.bank_transfer', 'Banka Havalesi').toLowerCase();
                }
                
                if (!paymentMethod.includes(paymentCompare)) {
                    showRow = false;
                }
            }
        }
        
        // Tarih filtreleme
        if (dateValue && showRow) {
            const dateCell = row.querySelector('td:nth-child(3)');
            if (dateCell) {
                const orderDate = parseLocalizedDate(dateCell.textContent);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                
                const last7Days = new Date(today);
                last7Days.setDate(last7Days.getDate() - 7);
                
                const last30Days = new Date(today);
                last30Days.setDate(last30Days.getDate() - 30);
                
                const thisMonth = new Date(today);
                thisMonth.setDate(1);
                
                const lastMonth = new Date(today);
                lastMonth.setMonth(lastMonth.getMonth() - 1);
                lastMonth.setDate(1);
                
                const lastMonthEnd = new Date(today);
                lastMonthEnd.setDate(0);
                
                if (
                    (dateValue === 'today' && orderDate < today) ||
                    (dateValue === 'yesterday' && (orderDate < yesterday || orderDate >= today)) ||
                    (dateValue === 'last7days' && orderDate < last7Days) ||
                    (dateValue === 'last30days' && orderDate < last30Days) ||
                    (dateValue === 'thismonth' && orderDate < thisMonth) ||
                    (dateValue === 'lastmonth' && (orderDate < lastMonth || orderDate >= thisMonth))
                ) {
                    showRow = false;
                }
            }
        }
        
        // Göster/Gizle
        row.style.display = showRow ? '' : 'none';
    });
}

/**
 * Sipariş detaylarını görüntüler
 * @param {string} orderId - Sipariş numarası
 */
function viewOrder(orderId) {
    const orderDetailModal = document.getElementById('order-detail-modal');
    if (!orderDetailModal) return;
    
    // Yükleniyor göster
    document.getElementById('order-detail-content').innerHTML = `
        <div class="loading-spinner">
            <i class="fas fa-spinner fa-spin"></i> ${getTranslation('admin.loading', 'Yükleniyor...')}
        </div>
    `;
    
    // Modal başlığını ayarla
    const modalTitle = document.getElementById('order-detail-title');
    if (modalTitle) {
        modalTitle.textContent = `${getTranslation('admin.order_detail', 'Sipariş Detayı')} #${orderId}`;
    }
    
    // Sipariş ID'sini gizli alana ata
    const orderIdInput = document.getElementById('order-id');
    if (orderIdInput) {
        orderIdInput.value = orderId;
    }
    
    // Modalı göster
    orderDetailModal.style.display = 'flex';
    
    // API'den sipariş detaylarını getir
    fetchOrderDetails(orderId)
        .then(orderDetails => {
            renderOrderDetails(orderDetails);
        })
        .catch(error => {
            console.error('Error fetching order details:', error);
            document.getElementById('order-detail-content').innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-circle"></i> ${getTranslation('error.failed_to_fetch_data', 'Sipariş detayları alınamadı. Lütfen tekrar deneyin.')}
                </div>
            `;
        });
}

/**
 * Sipariş detaylarını API'den alır
 * @param {string} orderId - Sipariş numarası
 * @returns {Promise<Object>} Sipariş detayları
 */
async function fetchOrderDetails(orderId) {
    try {
        const response = await fetch(`/api/admin/orders/${orderId}`, {
            headers: {
                'Authorization': `Bearer ${sessionToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch order details');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error fetching order details:', error);
        throw error;
    }
}

/**
 * Sipariş detaylarını render eder
 * @param {Object} orderDetails - Sipariş detayları
 */
function renderOrderDetails(orderDetails) {
    const orderDetailContent = document.getElementById('order-detail-content');
    if (!orderDetailContent) return;
    
    const orderDate = new Date(orderDetails.orderDate);
    const formattedDate = localizeDate(orderDate);
    
    // Durum bilgisi
    let statusHtml = `
        <div class="detail-section order-status-section">
            <h4>${getTranslation('admin.order_status', 'Sipariş Durumu')}</h4>
            <div class="status-badge-large status-${orderDetails.status}" id="order-status-badge">
                ${getStatusText(orderDetails.status)}
            </div>
            <div class="order-timeline">
                <div class="timeline-item ${orderDetails.status === 'pending' ? 'active' : (orderDetails.status !== 'cancelled' ? 'completed' : '')}">
                    <div class="timeline-icon"><i class="fas fa-clipboard-check"></i></div>
                    <div class="timeline-content">
                        <h5>${getTranslation('admin.order_received', 'Sipariş Alındı')}</h5>
                        <p>${formattedDate}</p>
                    </div>
                </div>
                <div class="timeline-item ${orderDetails.status === 'processing' ? 'active' : (orderDetails.status === 'shipped' || orderDetails.status === 'delivered' ? 'completed' : '')}">
                    <div class="timeline-icon"><i class="fas fa-box"></i></div>
                    <div class="timeline-content">
                        <h5>${getTranslation('admin.processing', 'Hazırlanıyor')}</h5>
                        ${orderDetails.processingDate ? `<p>${localizeDate(new Date(orderDetails.processingDate))}</p>` : ''}
                    </div>
                </div>
                <div class="timeline-item ${orderDetails.status === 'shipped' ? 'active' : (orderDetails.status === 'delivered' ? 'completed' : '')}">
                    <div class="timeline-icon"><i class="fas fa-shipping-fast"></i></div>
                    <div class="timeline-content">
                        <h5>${getTranslation('admin.shipped', 'Kargoya Verildi')}</h5>
                        ${orderDetails.shippedDate ? `<p>${localizeDate(new Date(orderDetails.shippedDate))}</p>` : ''}
                    </div>
                </div>
                <div class="timeline-item ${orderDetails.status === 'delivered' ? 'active completed' : ''}">
                    <div class="timeline-icon"><i class="fas fa-home"></i></div>
                    <div class="timeline-content">
                        <h5>${getTranslation('admin.delivered', 'Teslim Edildi')}</h5>
                        ${orderDetails.deliveredDate ? `<p>${localizeDate(new Date(orderDetails.deliveredDate))}</p>` : ''}
                    </div>
                </div>
                ${orderDetails.status === 'cancelled' ? `
                <div class="timeline-item active cancelled">
                    <div class="timeline-icon"><i class="fas fa-times-circle"></i></div>
                    <div class="timeline-content">
                        <h5>${getTranslation('admin.cancelled', 'İptal Edildi')}</h5>
                        ${orderDetails.cancelledDate ? `<p>${localizeDate(new Date(orderDetails.cancelledDate))}</p>` : ''}
                    </div>
                </div>
                ` : ''}
            </div>
        </div>
    `;
    
    // Sipariş özeti
    let orderSummaryHtml = `
        <div class="detail-section order-summary-section">
            <h4>${getTranslation('admin.order_summary', 'Sipariş Özeti')}</h4>
            <div class="order-info">
                <p><strong>${getTranslation('admin.order_number', 'Sipariş Numarası')}:</strong> #${orderDetails.id}</p>
                <p><strong>${getTranslation('admin.order_date', 'Sipariş Tarihi')}:</strong> ${formattedDate}</p>
                <p><strong>${getTranslation('admin.payment_method', 'Ödeme Yöntemi')}:</strong> ${getPaymentMethodText(orderDetails.paymentMethod)}</p>
                <p><strong>${getTranslation('admin.payment_status', 'Ödeme Durumu')}:</strong> ${getPaymentStatusText(orderDetails.paymentStatus)}</p>
            </div>
        </div>
    `;
    
    // Sipariş öğeleri
    let orderItemsHtml = `
        <div class="detail-section">
            <h4>${getTranslation('admin.order_items', 'Sipariş Detayı')}</h4>
            <table class="detail-table">
                <thead>
                    <tr>
                        <th>${getTranslation('admin.product', 'Ürün')}</th>
                        <th>${getTranslation('admin.quantity', 'Adet')}</th>
                        <th>${getTranslation('admin.unit_price', 'Birim Fiyat')}</th>
                        <th>${getTranslation('admin.total', 'Toplam')}</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    orderDetails.items.forEach(item => {
        orderItemsHtml += `
            <tr>
                <td>${escapeHTML(item.productName)}${item.options ? ` (${escapeHTML(item.options)})` : ''}</td>
                <td>${item.quantity}</td>
                <td>${formatCurrency(item.unitPrice)}</td>
                <td>${formatCurrency(item.unitPrice * item.quantity)}</td>
            </tr>
        `;
    });
    
    // Sipariş toplamları
    orderItemsHtml += `
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="3" class="text-right"><strong>${getTranslation('admin.subtotal', 'Ara Toplam')}:</strong></td>
                        <td>${formatCurrency(orderDetails.subtotal)}</td>
                    </tr>
                    <tr>
                        <td colspan="3" class="text-right"><strong>${getTranslation('admin.shipping', 'Kargo')}:</strong></td>
                        <td>${formatCurrency(orderDetails.shippingCost)}</td>
                    </tr>
                    ${orderDetails.discount > 0 ? `
                    <tr>
                        <td colspan="3" class="text-right"><strong>${getTranslation('admin.discount', 'İndirim')}:</strong></td>
                        <td>-${formatCurrency(orderDetails.discount)}</td>
                    </tr>
                    ` : ''}
                    <tr>
                        <td colspan="3" class="text-right"><strong>${getTranslation('admin.tax', 'Vergi')}:</strong></td>
                        <td>${formatCurrency(orderDetails.tax)}</td>
                    </tr>
                    <tr class="total-row">
                        <td colspan="3" class="text-right"><strong>${getTranslation('admin.total', 'Genel Toplam')}:</strong></td>
                        <td>${formatCurrency(orderDetails.totalAmount)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;
    
    // Müşteri bilgileri
    let customerInfoHtml = `
        <div class="detail-section">
            <h4>${getTranslation('admin.customer_info', 'Müşteri Bilgileri')}</h4>
            <div class="customer-info">
                <p><strong>${getTranslation('admin.name', 'Ad Soyad')}:</strong> ${escapeHTML(orderDetails.customer.name)}</p>
                <p><strong>${getTranslation('admin.email', 'E-posta')}:</strong> ${escapeHTML(orderDetails.customer.email)}</p>
                <p><strong>${getTranslation('admin.phone', 'Telefon')}:</strong> ${escapeHTML(orderDetails.customer.phone)}</p>
            </div>
        </div>
    `;
    
    // Teslimat adresi
    let shippingAddressHtml = `
        <div class="detail-section">
            <h4>${getTranslation('admin.shipping_address', 'Teslimat Adresi')}</h4>
            <div class="address-info">
                <p>${escapeHTML(orderDetails.shippingAddress.addressLine1)}</p>
                ${orderDetails.shippingAddress.addressLine2 ? `<p>${escapeHTML(orderDetails.shippingAddress.addressLine2)}</p>` : ''}
                <p>${escapeHTML(orderDetails.shippingAddress.city)}, ${escapeHTML(orderDetails.shippingAddress.state)} ${escapeHTML(orderDetails.shippingAddress.postalCode)}</p>
                <p>${escapeHTML(orderDetails.shippingAddress.country)}</p>
            </div>
        </div>
    `;
    
    // Fatura adresi (eğer varsa)
    let billingAddressHtml = '';
    if (orderDetails.differentBillingAddress) {
        billingAddressHtml = `
            <div class="detail-section">
                <h4>${getTranslation('admin.billing_address', 'Fatura Adresi')}</h4>
                <div class="address-info">
                    <p>${escapeHTML(orderDetails.billingAddress.addressLine1)}</p>
                    ${orderDetails.billingAddress.addressLine2 ? `<p>${escapeHTML(orderDetails.billingAddress.addressLine2)}</p>` : ''}
                    <p>${escapeHTML(orderDetails.billingAddress.city)}, ${escapeHTML(orderDetails.billingAddress.state)} ${escapeHTML(orderDetails.billingAddress.postalCode)}</p>
                    <p>${escapeHTML(orderDetails.billingAddress.country)}</p>
                </div>
            </div>
        `;
    }
    
    // Sipariş notları
    let orderNotesHtml = '';
    if (orderDetails.notes && orderDetails.notes.length > 0) {
        orderNotesHtml = `
            <div class="detail-section">
                <h4>${getTranslation('admin.order_notes', 'Sipariş Notları')}</h4>
                <div class="notes-container">
        `;
        
        orderDetails.notes.forEach(note => {
            const noteDate = new Date(note.date);
            const formattedNoteDate = localizeDate(noteDate, true);
            
            orderNotesHtml += `
                <div class="note-item">
                    <div class="note-header">
                        <span class="note-author">${escapeHTML(note.author)}</span>
                        <span class="note-date">${formattedNoteDate}</span>
                    </div>
                    <div class="note-content">${escapeHTML(note.content)}</div>
                </div>
            `;
        });
        
        orderNotesHtml += `
                </div>
            </div>
        `;
    }
    
    // Sipariş işlemleri
    let orderActionsHtml = `
        <div class="order-actions" id="order-actions">
            <button class="btn" onclick="printOrderDetails()"><i class="fas fa-print"></i> ${getTranslation('admin.print', 'Yazdır')}</button>
            
            ${(orderDetails.status !== 'delivered' && orderDetails.status !== 'cancelled') ? `
                <button class="btn btn-primary" onclick="updateOrderStatus('${orderDetails.id}')">
                    <i class="fas fa-edit"></i> ${getTranslation('admin.update_status', 'Durumu Güncelle')}
                </button>
                
                <button class="btn btn-danger" onclick="cancelOrder('${orderDetails.id}')">
                    <i class="fas fa-times"></i> ${getTranslation('admin.cancel_order', 'Siparişi İptal Et')}
                </button>
            ` : ''}
        </div>
    `;
    
    // Tüm detayları bir araya getir
    orderDetailContent.innerHTML = `
        <div class="order-detail-wrapper">
            ${statusHtml}
            ${orderSummaryHtml}
            ${orderItemsHtml}
            <div class="detail-columns">
                <div class="detail-column">
                    ${customerInfoHtml}
                    ${shippingAddressHtml}
                </div>
                <div class="detail-column">
                    ${billingAddressHtml}
                    ${orderNotesHtml}
                </div>
            </div>
            ${orderActionsHtml}
        </div>
    `;
}/**
 * Özyürek Şekerleme - Admin Sipariş Yöneticisi
 * Admin paneli sipariş yönetimi için JavaScript fonksiyonları
 * Bölüm 3
 */

/**
 * Siparişi iptal etmek için modal açar
 * @param {string} orderId - Sipariş numarası
 */
function cancelOrder(orderId) {
    const cancelOrderModal = document.getElementById('cancel-order-modal');
    if (!cancelOrderModal) return;
    
    // Sipariş ID'sini gizli alana ata
    const updateOrderIdInput = document.getElementById('update-order-id');
    if (updateOrderIdInput) {
        updateOrderIdInput.value = orderId;
    }
    
    // İptal sebebi alanını temizle
    const cancelReasonInput = document.getElementById('cancel-reason');
    if (cancelReasonInput) {
        cancelReasonInput.value = '';
    }
    
    // Bildirim checkbox'ını işaretle
    const notifyCheckbox = document.getElementById('notify-customer-cancel');
    if (notifyCheckbox) {
        notifyCheckbox.checked = true;
    }
    
    // Modalı göster
    cancelOrderModal.style.display = 'flex';
}

/**
 * Sipariş iptal formunu validate eder
 * @returns {boolean} Form geçerli mi
 */
function validateCancelOrderForm() {
    const cancelReason = document.getElementById('cancel-reason').value;
    
    // İptal sebebi zorunlu
    if (!cancelReason || cancelReason.trim() === '') {
        showNotification('error', getTranslation('error.reason_required', 'İptal sebebi zorunludur.'));
        return false;
    }
    
    // Kısa sebepler için min 5 karakter kontrolü
    if (cancelReason.length < 5) {
        showNotification('error', getTranslation('error.reason_too_short', 'İptal sebebi çok kısa. En az 5 karakter giriniz.'));
        return false;
    }
    
    return true;
}

/**
 * Sipariş iptal etme formunu gönderir
 */
async function cancelOrderSubmit() {
    try {
        const orderId = document.getElementById('update-order-id').value;
        const reason = document.getElementById('cancel-reason').value;
        const notify = document.getElementById('notify-customer-cancel').checked;
        
        // Yükleniyor durumunu göster
        const submitButton = document.getElementById('confirm-cancel-order');
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${getTranslation('admin.cancelling', 'İptal Ediliyor...')}`;
        }
        
        // API isteği
        const response = await fetch(`/api/admin/orders/${orderId}/cancel`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({
                reason,
                notify
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to cancel order');
        }
        
        // Başarılı yanıt
        const data = await response.json();
        
        // Tablodaki durumu güncelle
        updateOrderStatusInTable(orderId, 'cancelled');
        
        // Detay sayfasındaki durumu güncelle (eğer açıksa)
        updateOrderDetailStatus('cancelled');
        
        // Modalı kapat
        document.getElementById('cancel-order-modal').style.display = 'none';
        
        // Başarı mesajı göster
        showNotification('success', getTranslation('success.order_cancelled', 'Sipariş başarıyla iptal edildi!'));
        
        // Submit butonunu normale döndür
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = getTranslation('admin.confirm_cancel', 'İptal Et');
        }
    } catch (error) {
        console.error('Error cancelling order:', error);
        showNotification('error', getTranslation('error.failed_to_cancel', 'İptal işlemi başarısız oldu. Lütfen tekrar deneyin.'));
        
        // Submit butonunu normale döndür
        const submitButton = document.getElementById('confirm-cancel-order');
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = getTranslation('admin.confirm_cancel', 'İptal Et');
        }
    }
}

/**
 * Tablodaki sipariş durumunu günceller
 * @param {string} orderId - Sipariş numarası
 * @param {string} status - Yeni durum
 */
function updateOrderStatusInTable(orderId, status) {
    const rows = document.querySelectorAll('.admin-table tbody tr');
    
    rows.forEach(row => {
        const orderIdCell = row.querySelector('td:first-child');
        if (orderIdCell && orderIdCell.textContent === `#${orderId}`) {
            const statusCell = row.querySelector('td:nth-child(6)');
            const statusBadge = statusCell.querySelector('.status-badge');
            
            // Mevcut sınıfları temizle
            statusBadge.classList.remove('status-pending', 'status-processing', 'status-shipped', 'status-delivered', 'status-cancelled');
            
            // Yeni durumu uygula
            statusBadge.classList.add(`status-${status}`);
            
            // Durum metni
            statusBadge.textContent = getStatusText(status);
            
            // Teslim edilmiş veya iptal edilmiş siparişlerde silme butonunu kaldır
            if (status === 'delivered' || status === 'cancelled') {
                const actionCell = row.querySelector('td:last-child');
                actionCell.innerHTML = `<a href="#" class="action-btn view" title="${getTranslation('admin.view', 'Görüntüle')}" onclick="viewOrder('${orderId}'); return false;"><i class="fas fa-eye"></i></a>`;
            }
        }
    });
}

/**
 * Detay sayfasındaki sipariş durumunu günceller
 * @param {string} status - Yeni durum
 */
function updateOrderDetailStatus(status) {
    // Durum badge'i güncelle
    const statusBadge = document.getElementById('order-status-badge');
    if (statusBadge) {
        // Mevcut sınıfları temizle
        statusBadge.classList.remove('status-pending', 'status-processing', 'status-shipped', 'status-delivered', 'status-cancelled');
        
        // Yeni durumu uygula
        statusBadge.classList.add(`status-${status}`);
        
        // Durum metni
        statusBadge.textContent = getStatusText(status);
    }
    
    // Durum zaman çizelgesini güncelle
    updateOrderTimeline(status);
    
    // Sipariş eylemlerini güncelle
    updateOrderActions(status);
}

/**
 * Durum zaman çizelgesini günceller
 * @param {string} status - Sipariş durumu
 */
function updateOrderTimeline(status) {
    const timelineItems = document.querySelectorAll('.timeline-item');
    if (!timelineItems.length) return;
    
    // Önce tüm sınıfları temizle
    timelineItems.forEach(item => {
        item.classList.remove('active', 'completed', 'cancelled');
    });
    
    // Sipariş alındı her zaman tamamlanmış olmalı
    timelineItems[0].classList.add('completed');
    
    // Duruma göre sınıfları ekle
    if (status === 'pending') {
        timelineItems[0].classList.add('active');
    } else if (status === 'processing') {
        timelineItems[1].classList.add('active');
    } else if (status === 'shipped') {
        timelineItems[1].classList.add('completed');
        timelineItems[2].classList.add('active');
    } else if (status === 'delivered') {
        timelineItems[1].classList.add('completed');
        timelineItems[2].classList.add('completed');
        timelineItems[3].classList.add('completed', 'active');
    } else if (status === 'cancelled') {
        // Tüm zaman çizelgesi kalemlerini pasifleştir
        timelineItems.forEach(item => {
            item.classList.remove('active');
        });
        
        // İptal öğesi varsa aktifleştir
        const cancelledItem = document.querySelector('.timeline-item.cancelled');
        if (cancelledItem) {
            cancelledItem.classList.add('active');
        } else {
            // İptal öğesi yoksa ekle
            const timelineContainer = document.querySelector('.order-timeline');
            if (timelineContainer) {
                const cancelledItemHTML = `
                    <div class="timeline-item active cancelled">
                        <div class="timeline-icon"><i class="fas fa-times-circle"></i></div>
                        <div class="timeline-content">
                            <h5>${getTranslation('admin.cancelled', 'İptal Edildi')}</h5>
                            <p>${localizeDate(new Date())}</p>
                        </div>
                    </div>
                `;
                timelineContainer.innerHTML += cancelledItemHTML;
            }
        }
    }
}

/**
 * Sipariş eylemlerini günceller
 * @param {string} status - Sipariş durumu
 */
function updateOrderActions(status) {
    const orderActions = document.querySelector('.order-actions');
    if (!orderActions) return;
    
    // Teslim edilmiş veya iptal edilmiş siparişlerde durum güncelleme butonunu kaldır
    if (status === 'delivered' || status === 'cancelled') {
        orderActions.innerHTML = `
            <button class="btn" onclick="printOrderDetails()">
                <i class="fas fa-print"></i> ${getTranslation('admin.print', 'Yazdır')}
            </button>
        `;
    } else {
        orderActions.innerHTML = `
            <button class="btn" onclick="printOrderDetails()">
                <i class="fas fa-print"></i> ${getTranslation('admin.print', 'Yazdır')}
            </button>
            <button class="btn btn-primary" onclick="updateOrderStatus('${document.getElementById('order-id').value}')">
                <i class="fas fa-edit"></i> ${getTranslation('admin.update_status', 'Durumu Güncelle')}
            </button>
            <button class="btn btn-danger" onclick="cancelOrder('${document.getElementById('order-id').value}')">
                <i class="fas fa-times"></i> ${getTranslation('admin.cancel_order', 'Siparişi İptal Et')}
            </button>
        `;
    }
}

/**
 * Sipariş detaylarını yazdırır
 */
function printOrderDetails() {
    // Yazdırma öncesi CSS sınıflarını ekle
    document.body.classList.add('print-mode');
    
    // Yazdırma işlemi
    window.print();
    
    // Yazdırma sonrası CSS sınıflarını kaldır
    setTimeout(() => {
        document.body.classList.remove('print-mode');
    }, 1000);
}

/**
 * Bildirim gösterir
 * @param {string} type - Bildirim türü (success, error, info, warning)
 * @param {string} message - Bildirim mesajı
 */
function showNotification(type, message) {
    // Toast mesajı gösterimi için container kontrolü
    let toastContainer = document.querySelector('.toast-container');
    
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    // Yeni toast elementi oluştur
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Toast içeriği
    toast.innerHTML = `
        <div class="toast-header">
            <i class="fas ${getToastIcon(type)}"></i>
            <span class="toast-title">${getToastTitle(type)}</span>
            <button class="toast-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="toast-body">
            ${message}
        </div>
    `;
    
    // Toast'u container'a ekle
    toastContainer.appendChild(toast);
    
    // Otomatik kapanma
    setTimeout(() => {
        toast.classList.add('toast-hide');
        setTimeout(() => {
            toast.remove();
        }, 500);
    }, 5000);
}

/**
 * Toast için ikon alır
 * @param {string} type - Bildirim türü
 * @returns {string} İkon sınıfı
 */
function getToastIcon(type) {
    switch (type) {
        case 'success':
            return 'fa-check-circle';
        case 'error':
            return 'fa-exclamation-circle';
        case 'warning':
            return 'fa-exclamation-triangle';
        case 'info':
        default:
            return 'fa-info-circle';
    }
}

/**
 * Toast için başlık alır
 * @param {string} type - Bildirim türü
 * @returns {string} Başlık metni
 */
function getToastTitle(type) {
    switch (type) {
        case 'success':
            return getTranslation('notification.success', 'Başarılı');
        case 'error':
            return getTranslation('notification.error', 'Hata');
        case 'warning':
            return getTranslation('notification.warning', 'Uyarı');
        case 'info':
        default:
            return getTranslation('notification.info', 'Bilgi');
    }
}

/**
 * Oturumu kontrol eder ve gerekirse yeniler
 */
function checkSessionExpiry() {
    // Oturum son kullanma zamanını al
    const sessionExpiry = localStorage.getItem('adminSessionExpiry');
    
    if (sessionExpiry) {
        const expiryTime = parseInt(sessionExpiry);
        const currentTime = new Date().getTime();
        
        // Oturum süresi dolmak üzereyse (5 dakikadan az kaldıysa)
        if (expiryTime - currentTime < 5 * 60 * 1000) {
            // Session token'ı yenile
            refreshSessionToken();
        }
    }
}

/**
 * Session token'ı yeniler
 */
async function refreshSessionToken() {
    try {
        const response = await fetch('/api/admin/refresh-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to refresh token');
        }
        
        const data = await response.json();
        
        // Yeni token'ı kaydet
        sessionToken = data.token;
        localStorage.setItem('adminSessionToken', data.token);
        localStorage.setItem('adminSessionExpiry', data.expiry);
    } catch (error) {
        console.error('Error refreshing token:', error);
        // Token yenileme hatası - çıkış yap
        logout();
    }
}

// Periyodik oturum kontrolü
setInterval(checkSessionExpiry, 60 * 1000); // Her dakika kontrol et

// İlk sayfa yüklendiğinde çalışacak olan işlemleri başlat
fetchOrders(currentPage, itemsPerPage);