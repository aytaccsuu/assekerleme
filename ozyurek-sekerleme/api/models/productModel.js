/**
 * Ürün Model
 * Özyürek Şekerleme E-Ticaret Sistemi için ürün veri işlemleri
 */

const db = require('../utils/database');
const slugify = require('slugify');
const fs = require('fs');
const path = require('path');

/**
 * Tüm ürünleri getirir
 * @param {number} page - Sayfa numarası
 * @param {number} limit - Sayfa başına kayıt sayısı
 * @param {string} sortBy - Sıralama alanı
 * @param {string} sortOrder - Sıralama yönü
 * @param {Object} filters - Filtreler
 * @param {string} language - Dil
 * @returns {Promise<Object>} Ürün listesi ve toplam kayıt sayısı
 */
exports.getAll = async (page = 1, limit = 10, sortBy = 'id', sortOrder = 'DESC', filters = {}, language = 'tr') => {
  try {
    const offset = (page - 1) * limit;
    
    // Filtreleme koşulları
    let whereConditions = ['1=1']; // Herzaman doğru olan bir başlangıç koşulu
    let params = [];
    
    if (filters.categoryId) {
      whereConditions.push('p.id IN (SELECT product_id FROM product_categories WHERE category_id = ?)');
      params.push(filters.categoryId);
    }
    
    if (filters.status) {
      whereConditions.push('p.status = ?');
      params.push(filters.status);
    }
    
    if (filters.search) {
      whereConditions.push(`(
        p.name_${language} LIKE ? OR 
        p.description_${language} LIKE ? OR 
        p.slug LIKE ?
      )`);
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (filters.minPrice) {
      whereConditions.push('p.price >= ?');
      params.push(filters.minPrice);
    }
    
    if (filters.maxPrice) {
      whereConditions.push('p.price <= ?');
      params.push(filters.maxPrice);
    }
    
    // Geçerli sıralama alanı kontrolü
    const validSortFields = ['id', 'name_tr', 'name_en', 'name_ar', 'price', 'created_at', 'stock'];
    const adjustedSortBy = validSortFields.includes(sortBy) ? sortBy : 'id';
    
    // Geçerli sıralama yönü kontrolü
    const adjustedSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    // Toplam kayıt sayısını getir
    const countQuery = `
      SELECT COUNT(*) as total
      FROM products p
      WHERE ${whereConditions.join(' AND ')}
    `;
    
    const countResult = await db.query(countQuery, params);
    const total = countResult[0].total;
    
    // Ürünleri getir
    const productsQuery = `
      SELECT 
        p.*,
        GROUP_CONCAT(DISTINCT pc.category_id) as category_ids,
        AVG(pr.rating) as average_rating,
        COUNT(DISTINCT pr.id) as review_count
      FROM products p
      LEFT JOIN product_categories pc ON p.id = pc.product_id
      LEFT JOIN product_reviews pr ON p.id = pr.product_id
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY p.id
      ORDER BY p.${adjustedSortBy} ${adjustedSortOrder}
      LIMIT ?, ?
    `;
    
    const productsResult = await db.query(productsQuery, [...params, offset, limit]);
    
    // Ürünleri işle
    const products = await Promise.all(productsResult.map(async (product) => {
      return await this.formatProductData(product, language);
    }));
    
    return {
      products,
      total
    };
  } catch (error) {
    console.error('ProductModel.getAll Error:', error);
    throw error;
  }
};

/**
 * ID'ye göre ürün getirir
 * @param {number} productId - Ürün ID
 * @param {string} language - Dil
 * @returns {Promise<Object|null>} Ürün bilgisi
 */
exports.getById = async (productId, language = 'tr') => {
  try {
    const query = `
      SELECT 
        p.*,
        GROUP_CONCAT(DISTINCT pc.category_id) as category_ids,
        AVG(pr.rating) as average_rating,
        COUNT(DISTINCT pr.id) as review_count
      FROM products p
      LEFT JOIN product_categories pc ON p.id = pc.product_id
      LEFT JOIN product_reviews pr ON p.id = pr.product_id
      WHERE p.id = ?
      GROUP BY p.id
    `;
    
    const result = await db.query(query, [productId]);
    
    if (!result || result.length === 0) {
      return null;
    }
    
    // Ürün verilerini işle
    return await this.formatProductData(result[0], language);
  } catch (error) {
    console.error('ProductModel.getById Error:', error);
    throw error;
  }
};

/**
 * Slug'a göre ürün getirir
 * @param {string} slug - Ürün slug
 * @param {string} language - Dil
 * @returns {Promise<Object|null>} Ürün bilgisi
 */
exports.getBySlug = async (slug, language = 'tr') => {
  try {
    const query = `
      SELECT 
        p.*,
        GROUP_CONCAT(DISTINCT pc.category_id) as category_ids,
        AVG(pr.rating) as average_rating,
        COUNT(DISTINCT pr.id) as review_count
      FROM products p
      LEFT JOIN product_categories pc ON p.id = pc.product_id
      LEFT JOIN product_reviews pr ON p.id = pr.product_id
      WHERE p.slug = ?
      GROUP BY p.id
    `;
    
    const result = await db.query(query, [slug]);
    
    if (!result || result.length === 0) {
      return null;
    }
    
    // Ürün verilerini işle
    return await this.formatProductData(result[0], language);
  } catch (error) {
    console.error('ProductModel.getBySlug Error:', error);
    throw error;
  }
};

/**
 * Yeni ürün oluşturur
 * @param {Object} productData - Ürün verileri
 * @returns {Promise<Object>} Oluşturulan ürün
 */
exports.create = async (productData) => {
  try {
    // Ürün tabloya ekle
    const insertQuery = `
      INSERT INTO products (
        name_tr, name_en, name_ar,
        description_tr, description_en, description_ar,
        slug, price, discounted_price,
        stock, weight, variations,
        meta_title_tr, meta_title_en, meta_title_ar,
        meta_description_tr, meta_description_en, meta_description_ar,
        images, featured, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;
    
    // Variations değerini JSON olarak dönüştür
    const variations = productData.variations ? 
      (typeof productData.variations === 'string' ? 
        productData.variations : 
        JSON.stringify(productData.variations)
      ) : null;
    
    // Images değerini JSON olarak dönüştür
    const images = productData.images ? 
      (typeof productData.images === 'string' ? 
        productData.images : 
        JSON.stringify(productData.images)
      ) : null;
    
    const params = [
      productData.name_tr || '',
      productData.name_en || '',
      productData.name_ar || '',
      productData.description_tr || '',
      productData.description_en || '',
      productData.description_ar || '',
      productData.slug,
      productData.price || 0,
      productData.discounted_price || null,
      productData.stock || 0,
      productData.weight || '250g',
      variations,
      productData.meta_title_tr || '',
      productData.meta_title_en || '',
      productData.meta_title_ar || '',
      productData.meta_description_tr || '',
      productData.meta_description_en || '',
      productData.meta_description_ar || '',
      images,
      productData.featured ? 1 : 0,
      productData.status || 'active'
    ];
    
    const result = await db.query(insertQuery, params);
    const productId = result.insertId;
    
    // Ürün kategorilerini ekle
    if (productData.categories && Array.isArray(productData.categories) && productData.categories.length > 0) {
      await this.updateProductCategories(productId, productData.categories);
    }
    
    return {
      id: productId,
      slug: productData.slug
    };
  } catch (error) {
    console.error('ProductModel.create Error:', error);
    throw error;
  }
};

/**
 * Ürünü günceller
 * @param {number} productId - Ürün ID
 * @param {Object} productData - Güncellenecek veriler
 * @returns {Promise<boolean>} İşlem sonucu
 */
exports.update = async (productId, productData) => {
  try {
    // Güncellenecek alanları ve değerleri oluştur
    const updateFields = [];
    const params = [];
    
    // Temel ürün alanlarını güncelle
    const fields = [
      'name_tr', 'name_en', 'name_ar',
      'description_tr', 'description_en', 'description_ar',
      'slug', 'price', 'discounted_price',
      'stock', 'weight',
      'meta_title_tr', 'meta_title_en', 'meta_title_ar',
      'meta_description_tr', 'meta_description_en', 'meta_description_ar',
      'featured', 'status'
    ];
    
    fields.forEach(field => {
      if (productData[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        params.push(productData[field]);
      }
    });
    
    // Variations alanını güncelle
    if (productData.variations !== undefined) {
      updateFields.push('variations = ?');
      
      const variations = productData.variations ? 
        (typeof productData.variations === 'string' ? 
          productData.variations : 
          JSON.stringify(productData.variations)
        ) : null;
      
      params.push(variations);
    }
    
    // Images alanını güncelle
    if (productData.images !== undefined) {
      updateFields.push('images = ?');
      
      const images = productData.images ? 
        (typeof productData.images === 'string' ? 
          productData.images : 
          JSON.stringify(productData.images)
        ) : null;
      
      params.push(images);
    }
    
    // Updated_at alanını güncelle
    updateFields.push('updated_at = NOW()');
    
    // Güncelleme sorgusu
    const updateQuery = `
      UPDATE products
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;
    
    params.push(productId);
    
    await db.query(updateQuery, params);
    
    // Ürün kategorilerini güncelle
    if (productData.categories && Array.isArray(productData.categories)) {
      await this.updateProductCategories(productId, productData.categories);
    }
    
    return true;
  } catch (error) {
    console.error('ProductModel.update Error:', error);
    throw error;
  }
};

/**
 * Ürünü siler
 * @param {number} productId - Ürün ID
 * @returns {Promise<boolean>} İşlem sonucu
 */
exports.delete = async (productId) => {
  try {
    // Önce ürün resimlerini getir
    const product = await this.getById(productId);
    
    if (!product) {
      throw new Error('Product not found');
    }
    
    // Ürün kategorilerini sil
    await db.query('DELETE FROM product_categories WHERE product_id = ?', [productId]);
    
    // Ürünü sil
    await db.query('DELETE FROM products WHERE id = ?', [productId]);
    
    return true;
  } catch (error) {
    console.error('ProductModel.delete Error:', error);
    throw error;
  }
};

/**
 * Ürün stok miktarını günceller
 * @param {number} productId - Ürün ID
 * @param {number} stock - Yeni stok miktarı
 * @returns {Promise<boolean>} İşlem sonucu
 */
exports.updateStock = async (productId, stock) => {
  try {
    const query = `
      UPDATE products
      SET stock = ?, updated_at = NOW()
      WHERE id = ?
    `;
    
    await db.query(query, [stock, productId]);
    
    return true;
  } catch (error) {
    console.error('ProductModel.updateStock Error:', error);
    throw error;
  }
};

/**
 * Ürün varyasyon stok miktarını günceller
 * @param {number} productId - Ürün ID
 * @param {string} variationType - Varyasyon tipi (örn: weight)
 * @param {string} variationValue - Varyasyon değeri (örn: 250g)
 * @param {number} stock - Yeni stok miktarı
 * @returns {Promise<boolean>} İşlem sonucu
 */
exports.updateVariationStock = async (productId, variationType, variationValue, stock) => {
  try {
    // Önce ürünü getir
    const product = await this.getById(productId);
    
    if (!product || !product.variations) {
      throw new Error('Product or variations not found');
    }
    
    // String olarak geldiyse JSON'a dönüştür
    let variations = product.variations;
    if (typeof variations === 'string') {
      variations = JSON.parse(variations);
    }
    
    // Varyasyon tipini kontrol et
    if (!variations[variationType]) {
      variations[variationType] = [];
    }
    
    // Varyasyon değerini bul ve stok miktarını güncelle
    const variationIndex = variations[variationType].findIndex(v => v.value === variationValue);
    
    if (variationIndex !== -1) {
      variations[variationType][variationIndex].stock = stock;
    } else {
      // Yeni varyasyon değeri ekle
      variations[variationType].push({
        value: variationValue,
        stock: stock
      });
    }
    
    // Ürünü güncelle
    const query = `
      UPDATE products
      SET variations = ?, updated_at = NOW()
      WHERE id = ?
    `;
    
    await db.query(query, [JSON.stringify(variations), productId]);
    
    return true;
  } catch (error) {
    console.error('ProductModel.updateVariationStock Error:', error);
    throw error;
  }
};

/**
 * Ürün durumunu günceller
 * @param {number} productId - Ürün ID
 * @param {string} status - Yeni durum (active, inactive)
 * @returns {Promise<boolean>} İşlem sonucu
 */
exports.updateStatus = async (productId, status) => {
  try {
    const query = `
      UPDATE products
      SET status = ?, updated_at = NOW()
      WHERE id = ?
    `;
    
    await db.query(query, [status, productId]);
    
    return true;
  } catch (error) {
    console.error('ProductModel.updateStatus Error:', error);
    throw error;
  }
};

/**
 * Ürün kategorilerini günceller
 * @param {number} productId - Ürün ID
 * @param {Array} categories - Kategori ID'leri
 * @returns {Promise<boolean>} İşlem sonucu
 */
exports.updateProductCategories = async (productId, categories) => {
  try {
    // Önce mevcut kategorileri sil
    await db.query('DELETE FROM product_categories WHERE product_id = ?', [productId]);
    
    // Yeni kategorileri ekle
    if (categories && categories.length > 0) {
      const values = categories.map(categoryId => [productId, categoryId]);
      
      // Bulk insert
      const query = `
        INSERT INTO product_categories (product_id, category_id)
        VALUES ?
      `;
      
      await db.query(query, [values]);
    }
    
    return true;
  } catch (error) {
    console.error('ProductModel.updateProductCategories Error:', error);
    throw error;
  }
};

/**
 * Kategoriye göre ürünleri getirir
 * @param {number} categoryId - Kategori ID
 * @param {number} page - Sayfa numarası
 * @param {number} limit - Sayfa başına kayıt sayısı
 * @param {string} sortBy - Sıralama alanı
 * @param {string} sortOrder - Sıralama yönü
 * @param {string} language - Dil
 * @returns {Promise<Object>} Ürün listesi ve toplam kayıt sayısı
 */
exports.getByCategory = async (categoryId, page = 1, limit = 12, sortBy = 'id', sortOrder = 'DESC', language = 'tr') => {
  try {
    const offset = (page - 1) * limit;
    
    // Alt kategorileri de dahil et
    const categories = [categoryId];
    
    // Alt kategorileri getir
    const subcategoriesQuery = `
      SELECT id FROM categories WHERE parent_id = ?
    `;
    
    const subcategories = await db.query(subcategoriesQuery, [categoryId]);
    subcategories.forEach(subcat => {
      categories.push(subcat.id);
    });
    
    // Toplam kayıt sayısını getir
    const countQuery = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM products p
      JOIN product_categories pc ON p.id = pc.product_id
      WHERE p.status = 'active' AND pc.category_id IN (?)
    `;
    
    const countResult = await db.query(countQuery, [categories]);
    const total = countResult[0].total;
    
    // Geçerli sıralama alanı kontrolü
    const validSortFields = ['id', 'name_tr', 'name_en', 'name_ar', 'price', 'created_at', 'stock'];
    const adjustedSortBy = validSortFields.includes(sortBy) ? sortBy : 'id';
    
    // Geçerli sıralama yönü kontrolü
    const adjustedSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    // Ürünleri getir
    const productsQuery = `
      SELECT 
        p.*,
        GROUP_CONCAT(DISTINCT pc2.category_id) as category_ids,
        AVG(pr.rating) as average_rating,
        COUNT(DISTINCT pr.id) as review_count
      FROM products p
      JOIN product_categories pc ON p.id = pc.product_id
      LEFT JOIN product_categories pc2 ON p.id = pc2.product_id
      LEFT JOIN product_reviews pr ON p.id = pr.product_id
      WHERE p.status = 'active' AND pc.category_id IN (?)
      GROUP BY p.id
      ORDER BY p.${adjustedSortBy} ${adjustedSortOrder}
      LIMIT ?, ?
    `;
    
    const productsResult = await db.query(productsQuery, [categories, offset, limit]);
    
    // Ürünleri işle
    const products = await Promise.all(productsResult.map(async (product) => {
      return await this.formatProductData(product, language);
    }));
    
    return {
      products,
      total
    };
  } catch (error) {
    console.error('ProductModel.getByCategory Error:', error);
    throw error;
  }
};

/**
 * Öne çıkan ürünleri getirir
 * @param {number} limit - Kayıt sayısı
 * @param {string} language - Dil
 * @returns {Promise<Array>} Ürün listesi
 */
exports.getFeatured = async (limit = 8, language = 'tr') => {
  try {
    const query = `
      SELECT 
        p.*,
        GROUP_CONCAT(DISTINCT pc.category_id) as category_ids,
        AVG(pr.rating) as average_rating,
        COUNT(DISTINCT pr.id) as review_count
      FROM products p
      LEFT JOIN product_categories pc ON p.id = pc.product_id
      LEFT JOIN product_reviews pr ON p.id = pr.product_id
      WHERE p.status = 'active' AND p.featured = 1
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT ?
    `;
    
    const result = await db.query(query, [limit]);
    
    // Ürünleri işle
    return await Promise.all(result.map(async (product) => {
      return await this.formatProductData(product, language);
    }));
  } catch (error) {
    console.error('ProductModel.getFeatured Error:', error);
    throw error;
  }
};

/**
 * İndirimli ürünleri getirir
 * @param {number} limit - Kayıt sayısı
 * @param {string} language - Dil
 * @returns {Promise<Array>} Ürün listesi
 */
exports.getDiscounted = async (limit = 8, language = 'tr') => {
  try {
    const query = `
      SELECT 
        p.*,
        GROUP_CONCAT(DISTINCT pc.category_id) as category_ids,
        AVG(pr.rating) as average_rating,
        COUNT(DISTINCT pr.id) as review_count
      FROM products p
      LEFT JOIN product_categories pc ON p.id = pc.product_id
      LEFT JOIN product_reviews pr ON p.id = pr.product_id
      WHERE p.status = 'active' AND p.discounted_price IS NOT NULL AND p.discounted_price > 0 AND p.discounted_price < p.price
      GROUP BY p.id
      ORDER BY (p.price - p.discounted_price) / p.price DESC
      LIMIT ?
    `;
    
    const result = await db.query(query, [limit]);
    
    // Ürünleri işle
    return await Promise.all(result.map(async (product) => {
      return await this.formatProductData(product, language);
    }));
  } catch (error) {
    console.error('ProductModel.getDiscounted Error:', error);
    throw error;
  }
};

/**
 * Yeni ürünleri getirir
 * @param {number} limit - Kayıt sayısı
 * @param {string} language - Dil
 * @returns {Promise<Array>} Ürün listesi
 */
exports.getNew = async (limit = 8, language = 'tr') => {
  try {
    const query = `
      SELECT 
        p.*,
        GROUP_CONCAT(DISTINCT pc.category_id) as category_ids,
        AVG(pr.rating) as average_rating,
        COUNT(DISTINCT pr.id) as review_count
      FROM products p
      LEFT JOIN product_categories pc ON p.id = pc.product_id
      LEFT JOIN product_reviews pr ON p.id = pr.product_id
      WHERE p.status = 'active'
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT ?
    `;
    
    const result = await db.query(query, [limit]);
    
    // Ürünleri işle
    return await Promise.all(result.map(async (product) => {
      return await this.formatProductData(product, language);
    }));
  } catch (error) {
    console.error('ProductModel.getNew Error:', error);
    throw error;
  }
};

/**
 * İlgili ürünleri getirir
 * @param {number} productId - Ürün ID
 * @param {number} limit - Kayıt sayısı
 * @param {string} language - Dil
 * @returns {Promise<Array>} Ürün listesi
 */
exports.getRelated = async (productId, limit = 4, language = 'tr') => {
  try {
    // Ürün kategorilerini getir
    const categoryQuery = `
      SELECT category_id
      FROM product_categories
      WHERE product_id = ?
    `;
    
    const categoryResult = await db.query(categoryQuery, [productId]);
    
    if (!categoryResult || categoryResult.length === 0) {
      // Kategori bulunamadıysa yeni ürünleri göster
      return await this.getNew(limit, language);
    }
    
    // Kategori ID'lerini çıkar
    const categoryIds = categoryResult.map(row => row.category_id);
    
    // İlgili ürünleri getir (aynı kategoride olup farklı ID'ye sahip ürünler)
    const query = `
      SELECT 
        p.*,
        GROUP_CONCAT(DISTINCT pc.category_id) as category_ids,
        AVG(pr.rating) as average_rating,
        COUNT(DISTINCT pr.id) as review_count,
        COUNT(pc2.category_id) as category_match_count
      FROM products p
      JOIN product_categories pc ON p.id = pc.product_id
      LEFT JOIN product_categories pc2 ON p.id = pc2.product_id AND pc2.category_id IN (?)
      LEFT JOIN product_reviews pr ON p.id = pr.product_id
      WHERE p.id != ? AND p.status = 'active'
      GROUP BY p.id
      ORDER BY category_match_count DESC, p.created_at DESC
      LIMIT ?
    `;
    
    const result = await db.query(query, [categoryIds, productId, limit]);
    
    // Ürünleri işle
    return await Promise.all(result.map(async (product) => {
      return await this.formatProductData(product, language);
    }));
  } catch (error) {
    console.error('ProductModel.getRelated Error:', error);
    throw error;
  }
};

/**
 * Ürün arama yapar
 * @param {Object} filters - Arama filtreleri
 * @param {number} page - Sayfa numarası
 * @param {number} limit - Sayfa başına kayıt sayısı
 * @param {string} sortBy - Sıralama alanı
 * @param {string} sortOrder - Sıralama yönü
 * @param {string} language - Dil
 * @returns {Promise<Object>} Arama sonuçları
 */
exports.search = async (filters, page = 1, limit = 12, sortBy = 'relevance', sortOrder = 'DESC', language = 'tr') => {
  try {
    const offset = (page - 1) * limit;
    
    // Filtreleme koşulları
    let whereConditions = ['p.status = "active"']; // Herzaman aktif ürünleri getir
    let params = [];
    
    if (filters.search) {
      whereConditions.push(`(
        p.name_${language} LIKE ? OR 
        p.description_${language} LIKE ? OR 
        p.slug LIKE ?
      )`);
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (filters.categoryId) {
      whereConditions.push('p.id IN (SELECT product_id FROM product_categories WHERE category_id = ?)');
      params.push(filters.categoryId);
    }
    
    if (filters.minPrice !== undefined) {
      whereConditions.push('(p.discounted_price > 0 AND p.discounted_price >= ?) OR (p.discounted_price IS NULL AND p.price >= ?)');
      params.push(filters.minPrice, filters.minPrice);
    }
    
    if (filters.maxPrice !== undefined) {
      whereConditions.push('(p.discounted_price > 0 AND p.discounted_price <= ?) OR (p.discounted_price IS NULL AND p.price <= ?)');
      params.push(filters.maxPrice, filters.maxPrice);
    }
    
    // Toplam kayıt sayısını getir
    const countQuery = `
      SELECT COUNT(*) as total
      FROM products p
      WHERE ${whereConditions.join(' AND ')}
    `;
    
    const countResult = await db.query(countQuery, params);
    const total = countResult[0].total;
    
    // Sıralama alanını belirle
    let orderBy;
    
    if (sortBy === 'relevance' && filters.search) {
      // İlgililik bazlı sıralama (arama terimi ürün adında geçiyorsa daha üstte)
      orderBy = `
        CASE 
          WHEN p.name_${language} LIKE ? THEN 3
          WHEN p.name_${language} LIKE ? THEN 2
          WHEN p.description_${language} LIKE ? THEN 1
          ELSE 0
        END ${sortOrder}
      `;
      
      const exactSearchTerm = `%${filters.search}%`;
      const startSearchTerm = `${filters.search}%`;
      const containsSearchTerm = `%${filters.search}%`;
      
      params.push(exactSearchTerm, startSearchTerm, containsSearchTerm);
    } else {
      // Diğer sıralama seçenekleri
      const validSortFields = ['id', 'name_tr', 'name_en', 'name_ar', 'price', 'created_at', 'stock'];
      const adjustedSortBy = validSortFields.includes(sortBy) ? sortBy : 'id';
      
      // Sıralama yönü kontrolü
      const adjustedSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      
      orderBy = `p.${adjustedSortBy} ${adjustedSortOrder}`;
    }
    
    // Ürünleri getir
    const productsQuery = `
      SELECT 
        p.*,
        GROUP_CONCAT(DISTINCT pc.category_id) as category_ids,
        AVG(pr.rating) as average_rating,
        COUNT(DISTINCT pr.id) as review_count
      FROM products p
      LEFT JOIN product_categories pc ON p.id = pc.product_id
      LEFT JOIN product_reviews pr ON p.id = pr.product_id
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY p.id
      ORDER BY ${orderBy}
      LIMIT ?, ?
    `;
    
    const productsResult = await db.query(productsQuery, [...params, offset, limit]);
    
    // Ürünleri işle
    const products = await Promise.all(productsResult.map(async (product) => {
      return await this.formatProductData(product, language);
    }));
    
    return {
      products,
      total
    };
  } catch (error) {
    console.error('ProductModel.search Error:', error);
    throw error;
  }
};

/**
 * Ürün verilerini formatlar
 * @param {Object} product - Ürün verisi
 * @param {string} language - Dil
 * @returns {Promise<Object>} Formatlanmış ürün verisi
 */
exports.formatProductData = async (product, language = 'tr') => {
  try {
    // Resim URL'lerini JSON formatından diziye dönüştür
    const images = product.images ? 
      (typeof product.images === 'string' ? JSON.parse(product.images) : product.images) : 
      [];
    
    // Resimleri tam URL olarak formatla
    const imageUrls = images.map(image => `/uploads/products/${image}`);
    
    // Varyasyonları JSON formatından objeye dönüştür
    const variations = product.variations ? 
      (typeof product.variations === 'string' ? JSON.parse(product.variations) : product.variations) : 
      null;
    
    // Kategorileri dizi haline getir
    const categoryIds = product.category_ids ? 
      product.category_ids.split(',').map(id => parseInt(id)) : 
      [];
    
    // Dil bazlı ürün adı belirle
    const name = product[`name_${language}`] || product.name_tr || '';
    
    // Dil bazlı ürün açıklaması belirle
    const description = product[`description_${language}`] || product.description_tr || '';
    
    // Dil bazlı meta başlığı ve açıklaması
    const metaTitle = product[`meta_title_${language}`] || product[`meta_title_tr`] || name;
    const metaDescription = product[`meta_description_${language}`] || product[`meta_description_tr`] || '';
    
    // İndirim yüzdesi hesapla
    let discountPercentage = 0;
    if (product.discounted_price && product.price > 0) {
      discountPercentage = Math.round((product.price - product.discounted_price) / product.price * 100);
    }
    
    // Derecelendirme bilgisini düzenle
    const rating = {
      average: product.average_rating ? parseFloat(product.average_rating) : 0,
      count: product.review_count ? parseInt(product.review_count) : 0
    };
    
    // Stok durumunu belirle
    const inStock = product.stock > 0;
    
    return {
      id: product.id,
      name,
      name_tr: product.name_tr,
      name_en: product.name_en,
      name_ar: product.name_ar,
      description,
      description_tr: product.description_tr,
      description_en: product.description_en,
      description_ar: product.description_ar,
      slug: product.slug,
      price: parseFloat(product.price),
      discounted_price: product.discounted_price ? parseFloat(product.discounted_price) : null,
      discount_percentage: discountPercentage,
      stock: parseInt(product.stock),
      weight: product.weight,
      variations,
      meta_title: metaTitle,
      meta_description: metaDescription,
      images: imageUrls,
      thumbnail: imageUrls.length > 0 ? imageUrls[0] : null,
      category_ids: categoryIds,
      featured: product.featured === 1,
      status: product.status,
      rating,
      in_stock: inStock,
      created_at: product.created_at,
      updated_at: product.updated_at
    };
  } catch (error) {
    console.error('ProductModel.formatProductData Error:', error);
    throw error;
  }
};