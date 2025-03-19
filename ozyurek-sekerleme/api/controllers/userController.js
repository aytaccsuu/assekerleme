 
/**
 * Kullanıcı Yönetimi Controller
 * Özyürek Şekerleme E-Ticaret Sistemi için kullanıcı yönetimi API endpoint'leri
 */

const UserModel = require('../models/userModel');
const CartModel = require('../models/cartModel');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { validationResult } = require('express-validator');
const NotificationService = require('../services/notificationService');
const i18n = require('../utils/i18n');
const config = require('../config');

/**
 * Kullanıcı kaydı
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında kayıt sonucu
 */
exports.register = async (req, res) => {
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
    
    const { email, password, first_name, last_name, phone } = req.body;
    const sessionId = req.cookies.sessionId || req.body.sessionId || null;
    
    // E-posta adresi kullanılıyor mu kontrol et
    const existingUser = await UserModel.getByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: i18n.translate('errors.email_already_exists', req.language)
      });
    }
    
    // Şifreyi hash'le
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // E-posta doğrulama tokeni oluştur
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    // Kullanıcı oluştur
    const userData = {
      email,
      password: hashedPassword,
      first_name,
      last_name,
      phone,
      verification_token: verificationToken,
      status: 'unverified',
      role: 'customer'
    };
    
    const user = await UserModel.create(userData);
    
    // Sepet bağla (eğer mevcut bir oturum ID'si varsa)
    if (sessionId) {
      await CartModel.mergeCart(user.id, sessionId);
    }
    
    // E-posta doğrulama bağlantısı gönder
    const verificationLink = `${req.protocol}://${req.get('host')}/api/auth/verify-email/${verificationToken}`;
    await NotificationService.sendVerificationEmail(user.email, user.first_name, verificationLink, req.language);
    
    // JWT token oluştur
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    
    return res.status(201).json({
      success: true,
      message: i18n.translate('success.user_registered', req.language),
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          status: user.status
        }
      }
    });
  } catch (error) {
    console.error('UserController.register Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Kullanıcı girişi
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında giriş sonucu
 */
exports.login = async (req, res) => {
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
    
    const { email, password } = req.body;
    const sessionId = req.cookies.sessionId || req.body.sessionId || null;
    
    // Kullanıcıyı e-posta adresine göre bul
    const user = await UserModel.getByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: i18n.translate('errors.invalid_credentials', req.language)
      });
    }
    
    // Kullanıcı durumunu kontrol et
    if (user.status === 'banned') {
      return res.status(403).json({
        success: false,
        message: i18n.translate('errors.account_banned', req.language)
      });
    }
    
    // Şifreyi kontrol et
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: i18n.translate('errors.invalid_credentials', req.language)
      });
    }
    
    // Sepet bağla (eğer mevcut bir oturum ID'si varsa)
    if (sessionId) {
      await CartModel.mergeCart(user.id, sessionId);
    }
    
    // Son giriş zamanını güncelle
    await UserModel.updateLastLogin(user.id);
    
    // JWT token oluştur
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    
    return res.status(200).json({
      success: true,
      message: i18n.translate('success.login_successful', req.language),
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          status: user.status
        }
      }
    });
  } catch (error) {
    console.error('UserController.login Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * E-posta doğrulama
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 */
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    
    // Token'a sahip kullanıcıyı bul
    const user = await UserModel.getByVerificationToken(token);
    
    if (!user) {
      return res.redirect('/auth/verify-email?status=error&message=invalid_token');
    }
    
    // Kullanıcı durumunu güncelle
    await UserModel.updateStatus(user.id, 'active');
    
    // Tokeni temizle
    await UserModel.clearVerificationToken(user.id);
    
    // Hoş geldin e-postası gönder
    await NotificationService.sendWelcomeEmail(user.email, user.first_name, req.language);
    
    return res.redirect('/auth/verify-email?status=success');
  } catch (error) {
    console.error('UserController.verifyEmail Error:', error);
    return res.redirect('/auth/verify-email?status=error&message=server_error');
  }
};

/**
 * Şifre sıfırlama isteği
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında istek sonucu
 */
exports.forgotPassword = async (req, res) => {
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
    
    const { email } = req.body;
    
    // Kullanıcıyı e-posta adresine göre bul
    const user = await UserModel.getByEmail(email);
    
    // Kullanıcı bulunamasa bile başarılı yanıt döndür (güvenlik için)
    if (!user) {
      return res.status(200).json({
        success: true,
        message: i18n.translate('success.password_reset_email_sent', req.language)
      });
    }
    
    // Kullanıcı durumunu kontrol et
    if (user.status === 'banned') {
      return res.status(200).json({
        success: true,
        message: i18n.translate('success.password_reset_email_sent', req.language)
      });
    }
    
    // Şifre sıfırlama tokeni oluştur
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 saat
    
    // Tokeni kaydet
    await UserModel.setPasswordResetToken(user.id, resetToken, resetTokenExpires);
    
    // Şifre sıfırlama e-postası gönder
    const resetLink = `${req.protocol}://${req.get('host')}/auth/reset-password/${resetToken}`;
    await NotificationService.sendPasswordResetEmail(user.email, user.first_name, resetLink, req.language);
    
    return res.status(200).json({
      success: true,
      message: i18n.translate('success.password_reset_email_sent', req.language)
    });
  } catch (error) {
    console.error('UserController.forgotPassword Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Şifre sıfırlama
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında sıfırlama sonucu
 */
exports.resetPassword = async (req, res) => {
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
    
    const { token } = req.params;
    const { password } = req.body;
    
    // Token'a sahip kullanıcıyı bul
    const user = await UserModel.getByResetToken(token);
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: i18n.translate('errors.invalid_reset_token', req.language)
      });
    }
    
    // Token süresi dolmuş mu kontrol et
    if (new Date() > new Date(user.reset_token_expires)) {
      return res.status(400).json({
        success: false,
        message: i18n.translate('errors.expired_reset_token', req.language)
      });
    }
    
    // Şifreyi hash'le
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Şifreyi güncelle ve tokeni temizle
    await UserModel.resetPassword(user.id, hashedPassword);
    
    // Şifre değişikliği bildirimi gönder
    await NotificationService.sendPasswordChangedEmail(user.email, user.first_name, req.language);
    
    return res.status(200).json({
      success: true,
      message: i18n.translate('success.password_reset_successful', req.language)
    });
  } catch (error) {
    console.error('UserController.resetPassword Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Kullanıcı bilgilerini getirir
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında kullanıcı bilgisi
 */
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await UserModel.getById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: i18n.translate('errors.user_not_found', req.language)
      });
    }
    
    // Hassas bilgileri çıkar
    delete user.password;
    delete user.reset_token;
    delete user.reset_token_expires;
    delete user.verification_token;
    
    return res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('UserController.getProfile Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Kullanıcı profil bilgilerini günceller
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında güncelleme sonucu
 */
exports.updateProfile = async (req, res) => {
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
    
    const userId = req.user.id;
    const { first_name, last_name, phone } = req.body;
    
    // Kullanıcı var mı kontrol et
    const user = await UserModel.getById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: i18n.translate('errors.user_not_found', req.language)
      });
    }
    
    // Profil bilgilerini güncelle
    const updatedUser = await UserModel.updateProfile(userId, {
      first_name: first_name || user.first_name,
      last_name: last_name || user.last_name,
      phone: phone || user.phone
    });
    
    // Hassas bilgileri çıkar
    delete updatedUser.password;
    delete updatedUser.reset_token;
    delete updatedUser.reset_token_expires;
    delete updatedUser.verification_token;
    
    return res.status(200).json({
      success: true,
      message: i18n.translate('success.profile_updated', req.language),
      data: updatedUser
    });
  } catch (error) {
    console.error('UserController.updateProfile Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Kullanıcı şifresini değiştirir
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında şifre değiştirme sonucu
 */
exports.changePassword = async (req, res) => {
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
    
    const userId = req.user.id;
    const { current_password, new_password } = req.body;
    
    // Kullanıcı var mı kontrol et
    const user = await UserModel.getById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: i18n.translate('errors.user_not_found', req.language)
      });
    }
    
    // Mevcut şifreyi kontrol et
    const isPasswordValid = await bcrypt.compare(current_password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: i18n.translate('errors.incorrect_password', req.language)
      });
    }
    
    // Yeni şifreyi hash'le
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(new_password, salt);
    
    // Şifreyi güncelle
    await UserModel.updatePassword(userId, hashedPassword);
    
    // Şifre değişikliği bildirimi gönder
    await NotificationService.sendPasswordChangedEmail(user.email, user.first_name, req.language);
    
    return res.status(200).json({
      success: true,
      message: i18n.translate('success.password_changed', req.language)
    });
  } catch (error) {
    console.error('UserController.changePassword Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Kullanıcı adreslerini getirir
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında adres listesi
 */
exports.getAddresses = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const addresses = await UserModel.getAddresses(userId);
    
    return res.status(200).json({
      success: true,
      data: addresses
    });
  } catch (error) {
    console.error('UserController.getAddresses Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Yeni adres ekler
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında ekleme sonucu
 */
exports.addAddress = async (req, res) => {
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
    
    const userId = req.user.id;
    const addressData = {
      ...req.body,
      user_id: userId
    };
    
    // Eğer varsayılan adres olarak işaretlendiyse, diğer adresleri güncelle
    if (addressData.is_default) {
      await UserModel.resetDefaultAddresses(userId, addressData.type);
    }
    
    const address = await UserModel.addAddress(addressData);
    
    return res.status(201).json({
      success: true,
      message: i18n.translate('success.address_added', req.language),
      data: address
    });
  } catch (error) {
    console.error('UserController.addAddress Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Adres günceller
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında güncelleme sonucu
 */
exports.updateAddress = async (req, res) => {
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
    
    const userId = req.user.id;
    const addressId = req.params.id;
    const addressData = req.body;
    
    // Adres mevcut mu ve kullanıcıya ait mi kontrol et
    const address = await UserModel.getAddressById(addressId);
    if (!address || address.user_id !== userId) {
      return res.status(404).json({
        success: false,
        message: i18n.translate('errors.address_not_found', req.language)
      });
    }
    
    // Eğer varsayılan adres olarak işaretlendiyse, diğer adresleri güncelle
    if (addressData.is_default) {
      await UserModel.resetDefaultAddresses(userId, address.type);
    }
    
    const updatedAddress = await UserModel.updateAddress(addressId, addressData);
    
    return res.status(200).json({
      success: true,
      message: i18n.translate('success.address_updated', req.language),
      data: updatedAddress
    });
  } catch (error) {
    console.error('UserController.updateAddress Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Adres siler
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında silme sonucu
 */
exports.deleteAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const addressId = req.params.id;
    
    // Adres mevcut mu ve kullanıcıya ait mi kontrol et
    const address = await UserModel.getAddressById(addressId);
    if (!address || address.user_id !== userId) {
      return res.status(404).json({
        success: false,
        message: i18n.translate('errors.address_not_found', req.language)
      });
    }
    
    await UserModel.deleteAddress(addressId);
    
    return res.status(200).json({
      success: true,
      message: i18n.translate('success.address_deleted', req.language)
    });
  } catch (error) {
    console.error('UserController.deleteAddress Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Tüm kullanıcıları listeler (Admin için)
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında kullanıcı listesi
 */
exports.getAllUsers = async (req, res) => {
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
    const search = req.query.search;
    const status = req.query.status;
    
    const filters = {};
    
    if (search) {
      filters.search = search;
    }
    
    if (status) {
      filters.status = status;
    }
    
    const result = await UserModel.getAllUsers(page, limit, sortBy, sortOrder, filters);
    
    return res.status(200).json({
      success: true,
      data: result.users,
      pagination: {
        total: result.total,
        page,
        limit,
        pages: Math.ceil(result.total / limit)
      }
    });
  } catch (error) {
    console.error('UserController.getAllUsers Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Kullanıcı durumunu günceller (Admin için)
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında güncelleme sonucu
 */
exports.updateUserStatus = async (req, res) => {
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
    
    const userId = req.params.id;
    const { status } = req.body;
    
    // Geçerli durum değeri mi kontrol et
    const validStatuses = ['active', 'inactive', 'unverified', 'banned'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: i18n.translate('errors.invalid_status', req.language)
      });
    }
    
    // Admin kendisini banlayamaz
    if (userId === req.user.id && status === 'banned') {
      return res.status(400).json({
        success: false,
        message: i18n.translate('errors.cannot_ban_self', req.language)
      });
    }
    
    // Kullanıcı var mı kontrol et
    const user = await UserModel.getById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: i18n.translate('errors.user_not_found', req.language)
      });
    }
    
    // Admin'i banlamaya çalışıyorsa
    if (user.role === 'admin' && status === 'banned') {
      return res.status(400).json({
        success: false,
        message: i18n.translate('errors.cannot_ban_admin', req.language)
      });
    }
    
    const updatedUser = await UserModel.updateStatus(userId, status);
    
    // Bildirim gönder
    if (status === 'banned') {
      await NotificationService.sendAccountBannedEmail(user.email, user.first_name, req.language);
    } else if (status === 'active' && user.status === 'banned') {
      await NotificationService.sendAccountReactivatedEmail(user.email, user.first_name, req.language);
    }
    
    return res.status(200).json({
      success: true,
      message: i18n.translate('success.user_status_updated', req.language),
      data: updatedUser
    });
  } catch (error) {
    console.error('UserController.updateUserStatus Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Kullanıcı istatistikleri (Admin için)
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında kullanıcı istatistikleri
 */
exports.getUserStats = async (req, res) => {
  try {
    // Yetki kontrolü
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: i18n.translate('errors.not_authorized', req.language)
      });
    }
    
    const stats = await UserModel.getUserStats();
    
    return res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('UserController.getUserStats Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Bülten aboneliği ekler
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında abonelik sonucu
 */
exports.subscribeNewsletter = async (req, res) => {
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
    
    const { email, first_name, language } = req.body;
    
    // E-posta adresi zaten kayıtlı mı kontrol et
    const existingSubscription = await UserModel.getNewsletterSubscription(email);
    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        message: i18n.translate('errors.already_subscribed', req.language)
      });
    }
    
    // Abonelik ekle
    await UserModel.addNewsletterSubscription({
      email,
      first_name,
      language: language || req.language || 'tr',
      status: 'active'
    });
    
    // Hoş geldin e-postası gönder
    await NotificationService.sendNewsletterWelcomeEmail(email, first_name, req.language);
    
    return res.status(200).json({
      success: true,
      message: i18n.translate('success.newsletter_subscribed', req.language)
    });
  } catch (error) {
    console.error('UserController.subscribeNewsletter Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};

/**
 * Bülten aboneliğini iptal eder
 * @param {Object} req - Express request objesi
 * @param {Object} res - Express response objesi
 * @returns {Object} JSON formatında iptal sonucu
 */
exports.unsubscribeNewsletter = async (req, res) => {
  try {
    const { email, token } = req.query;
    
    if (!email || !token) {
      return res.status(400).json({
        success: false,
        message: i18n.translate('errors.invalid_unsubscribe_link', req.language)
      });
    }
    
    // Abonelik var mı kontrol et
    const subscription = await UserModel.getNewsletterSubscription(email);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: i18n.translate('errors.subscription_not_found', req.language)
      });
    }
    
    // Token doğrula
    const expectedToken = crypto
      .createHash('md5')
      .update(email + config.newsletter.secret)
      .digest('hex');
    
    if (token !== expectedToken) {
      return res.status(400).json({
        success: false,
        message: i18n.translate('errors.invalid_unsubscribe_token', req.language)
      });
    }
    
    // Aboneliği iptal et
    await UserModel.updateNewsletterSubscription(email, { status: 'unsubscribed' });
    
    return res.status(200).json({
      success: true,
      message: i18n.translate('success.newsletter_unsubscribed', req.language)
    });
  } catch (error) {
    console.error('UserController.unsubscribeNewsletter Error:', error);
    return res.status(500).json({
      success: false,
      message: i18n.translate('errors.server_error', req.language),
      error: error.message
    });
  }
};