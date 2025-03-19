 
/**
 * Ürün Yönetimi Controller
 * Özyürek Şekerleme E-Ticaret Sistemi için ürün yönetimi API endpoint'leri
 */

const ProductModel = require('../models/productModel');
const { validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');
const slugify = require('slugify');
const i18n = require('../utils/i18n');

/**
 * Tüm ürünleri listeler
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında ürün listesi
 */
exports.getAllProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortBy = req.query.sortBy || 'id';
    const sortOrder = req.query.sortOrder || 'DESC';
    const categoryId = req.query.categoryId;
    const search = req.query.search;
    const status = req.query.status;
    const language = req.query.language || req.headers['accept-language'] || 'tr';

    const filters = {};
    
    if (categoryId) {
      filters.categoryId = categoryId;
    }
    
    if (status) {
      filters.status = status;
    }
    
    if (search) {
      filters.search = search;
    }

    const result = await ProductModel.getAll(page, limit, sortBy, sortOrder, filters, language);
    
    return res.status(200).json({
      success: true,
      data: result.products,
      pagination: {
        total: result.total,
        page,
        limit,
        pages: Math.ceil(result.total / limit)
      }
    });
  } catch (error) {
    console.error('ProductController.getAllProducts Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Belirli bir ürünü ID'ye göre getirir
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında ürün detayı
 */
exports.getProductById = async (req, res) => {
  try {
    const productId = req.params.id;
    const language = req.query.language || req.headers['accept-language'] || 'tr';
    
    const product = await ProductModel.getById(productId, language);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: i18n.translate('errors.product_not_found', req.language)
      });
    }
    
    return res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('ProductController.getProductById Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Ürün slug'una göre ürün detaylarını getirir
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında ürün detayı
 */
exports.getProductBySlug = async (req, res) => {
  try {
    const slug = req.params.slug;
    const language = req.query.language || req.headers['accept-language'] || 'tr';
    
    const product = await ProductModel.getBySlug(slug, language);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: i18n.translate('errors.product_not_found', req.language)
      });
    }
    
    return res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('ProductController.getProductBySlug Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Yeni bir ürün ekler
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında eklenen ürün bilgisi
 */
exports.createProduct = async (req, res) => {
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
    
    const productData = req.body;
    
    // Slug oluştur (eğer belirtilmemişse)
    if (!productData.slug) {
      productData.slug = slugify(productData.name_tr || productData.name_en, {
        lower: true,
        strict: true
      });
    }
    
    // Ürün resimlerini işle
    if (req.files && req.files.length > 0) {
      productData.images = [];
      
      for (const file of req.files) {
        productData.images.push(file.filename);
      }
    }
    
    const result = await ProductModel.create(productData);
    
    return res.status(201).json({
      success: true,
      message: i18n.translate('success.product_created', req.language),
      data: {
        id: result.id,
        slug: result.slug
      }
    });
  } catch (error) {
    console.error('ProductController.createProduct Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Mevcut ürünü günceller
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında güncelleme durumu
 */
exports.updateProduct = async (req, res) => {
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
    
    const productId = req.params.id;
    const productData = req.body;
    
    // Önce ürünün var olduğunu kontrol et
    const existingProduct = await ProductModel.getById(productId);
    
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: i18n.translate('errors.product_not_found', req.language)
      });
    }
    
    // Slug güncelleme (eğer isim değiştiyse ve özel bir slug belirtilmediyse)
    if (
      (productData.name_tr && productData.name_tr !== existingProduct.name_tr) ||
      (productData.name_en && productData.name_en !== existingProduct.name_en)
    ) {
      if (!productData.slug) {
        productData.slug = slugify(
          productData.name_tr || productData.name_en || existingProduct.name_tr || existingProduct.name_en, 
          { lower: true, strict: true }
        );
      }
    }
    
    // Ürün resimlerini işle
    if (req.files && req.files.length > 0) {
      productData.images = existingProduct.images || [];
      
      for (const file of req.files) {
        productData.images.push(file.filename);
      }
    }
    
    // Silinen resimleri işle
    if (productData.deletedImages && Array.isArray(productData.deletedImages)) {
      const updatedImages = existingProduct.images.filter(img => !productData.deletedImages.includes(img));
      productData.images = updatedImages;
      
      // Silinen resimleri fiziksel olarak kaldır
      for (const imgName of productData.deletedImages) {
        const imgPath = path.join(__dirname, '../../public/uploads/products', imgName);
        if (fs.existsSync(imgPath)) {
          fs.unlinkSync(imgPath);
        }
      }
      
      // Artık ihtiyaç yok, temizle
      delete productData.deletedImages;
    }
    
    const result = await ProductModel.update(productId, productData);
    
    return res.status(200).json({
      success: true,
      message: i18n.translate('success.product_updated', req.language),
      data: {
        id: productId,
        updated: result
      }
    });
  } catch (error) {
    console.error('ProductController.updateProduct Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Ürünü siler
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında silme durumu
 */
exports.deleteProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    
    // Önce ürünün var olduğunu kontrol et
    const existingProduct = await ProductModel.getById(productId);
    
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: i18n.translate('errors.product_not_found', req.language)
      });
    }
    
    // Ürün resimlerini fiziksel olarak kaldır
    if (existingProduct.images && existingProduct.images.length > 0) {
      for (const imgName of existingProduct.images) {
        const imgPath = path.join(__dirname, '../../public/uploads/products', imgName);
        if (fs.existsSync(imgPath)) {
          fs.unlinkSync(imgPath);
        }
      }
    }
    
    await ProductModel.delete(productId);
    
    return res.status(200).json({
      success: true,
      message: i18n.translate('success.product_deleted', req.language)
    });
  } catch (error) {
    console.error('ProductController.deleteProduct Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Öne çıkan ürünleri getirir
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında öne çıkan ürünler
 */
exports.getFeaturedProducts = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 8;
    const language = req.query.language || req.headers['accept-language'] || 'tr';
    
    const featuredProducts = await ProductModel.getFeatured(limit, language);
    
    return res.status(200).json({
      success: true,
      data: featuredProducts
    });
  } catch (error) {
    console.error('ProductController.getFeaturedProducts Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * İndirimli ürünleri getirir
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında indirimli ürünler
 */
exports.getDiscountedProducts = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 8;
    const language = req.query.language || req.headers['accept-language'] || 'tr';
    
    const discountedProducts = await ProductModel.getDiscounted(limit, language);
    
    return res.status(200).json({
      success: true,
      data: discountedProducts
    });
  } catch (error) {
    console.error('ProductController.getDiscountedProducts Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Yeni çıkan ürünleri getirir
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında yeni çıkan ürünler
 */
exports.getNewProducts = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 8;
    const language = req.query.language || req.headers['accept-language'] || 'tr';
    
    const newProducts = await ProductModel.getNew(limit, language);
    
    return res.status(200).json({
      success: true,
      data: newProducts
    });
  } catch (error) {
    console.error('ProductController.getNewProducts Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * İlgili ürünleri getirir
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında ilgili ürünler
 */
exports.getRelatedProducts = async (req, res) => {
  try {
    const productId = req.params.id;
    const limit = parseInt(req.query.limit) || 4;
    const language = req.query.language || req.headers['accept-language'] || 'tr';
    
    const relatedProducts = await ProductModel.getRelated(productId, limit, language);
    
    return res.status(200).json({
      success: true,
      data: relatedProducts
    });
  } catch (error) {
    console.error('ProductController.getRelatedProducts Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Kategoriye göre ürünleri getirir
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında kategoriye ait ürünler
 */
exports.getProductsByCategory = async (req, res) => {
  try {
    const categoryId = req.params.categoryId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const sortBy = req.query.sortBy || 'id';
    const sortOrder = req.query.sortOrder || 'DESC';
    const language = req.query.language || req.headers['accept-language'] || 'tr';
    
    const result = await ProductModel.getByCategory(categoryId, page, limit, sortBy, sortOrder, language);
    
    return res.status(200).json({
      success: true,
      data: result.products,
      pagination: {
        total: result.total,
        page,
        limit,
        pages: Math.ceil(result.total / limit)
      }
    });
  } catch (error) {
    console.error('ProductController.getProductsByCategory Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Ürün arama işlemini gerçekleştirir
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında arama sonuçları
 */
exports.searchProducts = async (req, res) => {
  try {
    const searchTerm = req.query.q;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const categoryId = req.query.categoryId;
    const minPrice = req.query.minPrice;
    const maxPrice = req.query.maxPrice;
    const language = req.query.language || req.headers['accept-language'] || 'tr';
    
    if (!searchTerm || searchTerm.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: i18n.translate('errors.search_term_required', req.language)
      });
    }
    
    const filters = { search: searchTerm };
    
    if (categoryId) {
      filters.categoryId = categoryId;
    }
    
    if (minPrice !== undefined) {
      filters.minPrice = parseFloat(minPrice);
    }
    
    if (maxPrice !== undefined) {
      filters.maxPrice = parseFloat(maxPrice);
    }
    
    const result = await ProductModel.search(
      filters, 
      page, 
      limit, 
      'relevance', 
      'DESC', 
      language
    );
    
    return res.status(200).json({
      success: true,
      data: result.products,
      pagination: {
        total: result.total,
        page,
        limit,
        pages: Math.ceil(result.total / limit)
      }
    });
  } catch (error) {
    console.error('ProductController.searchProducts Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Ürün stok durumunu günceller
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında stok güncelleme durumu
 */
exports.updateProductStock = async (req, res) => {
  try {
    const productId = req.params.id;
    const { stockUpdates } = req.body;
    
    // Form validasyon kontrolleri
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: i18n.translate('errors.validation_error', req.language),
        errors: errors.array()
      });
    }
    
    if (!stockUpdates || !Array.isArray(stockUpdates)) {
      return res.status(400).json({
        success: false,
        message: i18n.translate('errors.invalid_stock_data', req.language)
      });
    }
    
    // Önce ürünün var olduğunu kontrol et
    const existingProduct = await ProductModel.getById(productId);
    
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: i18n.translate('errors.product_not_found', req.language)
      });
    }
    
    const result = await ProductModel.updateStock(productId, stockUpdates);
    
    return res.status(200).json({
      success: true,
      message: i18n.translate('success.stock_updated', req.language),
      data: {
        id: productId,
        updated: result
      }
    });
  } catch (error) {
    console.error('ProductController.updateProductStock Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Ürün durumunu günceller (aktif/pasif)
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında durum güncelleme bilgisi
 */
exports.updateProductStatus = async (req, res) => {
  try {
    const productId = req.params.id;
    const { status } = req.body;
    
    // Form validasyon kontrolleri
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: i18n.translate('errors.validation_error', req.language),
        errors: errors.array()
      });
    }
    
    if (status !== 'active' && status !== 'inactive') {
      return res.status(400).json({
        success: false,
        message: i18n.translate('errors.invalid_status', req.language)
      });
    }
    
    // Önce ürünün var olduğunu kontrol et
    const existingProduct = await ProductModel.getById(productId);
    
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: i18n.translate('errors.product_not_found', req.language)
      });
    }
    
    const result = await ProductModel.updateStatus(productId, status);
    
    return res.status(200).json({
      success: true,
      message: i18n.translate('success.status_updated', req.language),
      data: {
        id: productId,
        status: status,
        updated: result
      }
    });
  } catch (error) {
    console.error('ProductController.updateProductStatus Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};