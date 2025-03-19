 
/**
 * Kullanıcı Model
 * Özyürek Şekerleme E-Ticaret Sistemi için kullanıcı veri işlemleri
 */

const db = require('../utils/database');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

/**
 * Yeni kullanıcı oluşturur
 * @param {Object} userData - Kullanıcı verileri
 * @returns {Promise<Object>} Oluşturulan kullanıcı
 */
exports.create = async (userData) => {
  try {
    const {
      email, password, first_name, last_name, phone,
      verification_token, status, role
    } = userData;
    
    const query = `
      INSERT INTO users (
        email, password, first_name, last_name, phone,
        verification_token, status, role, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;
    
    const params = [
      email, password, first_name, last_name, phone,
      verification_token, status || 'unverified', role || 'customer'
    ];
    
    const result = await db.query(query, params);
    
    return {
      id: result.insertId,
      email,
      first_name,
      last_name,
      phone,
      status: status || 'unverified',
      role: role || 'customer'
    };
  } catch (error) {
    console.error('UserModel.create Error:', error);
    throw error;
  }
};

/**
 * E-posta adresine göre kullanıcı getirir
 * @param {string} email - E-posta adresi
 * @returns {Promise<Object|null>} Kullanıcı bilgisi
 */
exports.getByEmail = async (email) => {
  try {
    const query = `
      SELECT *
      FROM users
      WHERE email = ?
    `;
    
    const result = await db.query(query, [email]);
    
    if (!result || result.length === 0) {
      return null;
    }
    
    return result[0];
  } catch (error) {
    console.error('UserModel.getByEmail Error:', error);
    throw error;
  }
};

/**
 * ID'ye göre kullanıcı getirir
 * @param {number} userId - Kullanıcı ID
 * @returns {Promise<Object|null>} Kullanıcı bilgisi
 */
exports.getById = async (userId) => {
  try {
    const query = `
      SELECT *
      FROM users
      WHERE id = ?
    `;
    
    const result = await db.query(query, [userId]);
    
    if (!result || result.length === 0) {
      return null;
    }
    
    return result[0];
  } catch (error) {
    console.error('UserModel.getById Error:', error);
    throw error;
  }
};

/**
 * Doğrulama tokenine göre kullanıcı getirir
 * @param {string} token - Doğrulama tokeni
 * @returns {Promise<Object|null>} Kullanıcı bilgisi
 */
exports.getByVerificationToken = async (token) => {
  try {
    const query = `
      SELECT *
      FROM users
      WHERE verification_token = ?
    `;
    
    const result = await db.query(query, [token]);
    
    if (!result || result.length === 0) {
      return null;
    }
    
    return result[0];
  } catch (error) {
    console.error('UserModel.getByVerificationToken Error:', error);
    throw error;
  }
};

/**
 * Şifre sıfırlama tokenine göre kullanıcı getirir
 * @param {string} token - Şifre sıfırlama tokeni
 * @returns {Promise<Object|null>} Kullanıcı bilgisi
 */
exports.getByResetToken = async (token) => {
  try {
    const query = `
      SELECT *
      FROM users
      WHERE reset_token = ? AND reset_token_expires > NOW()
    `;
    
    const result = await db.query(query, [token]);
    
    if (!result || result.length === 0) {
      return null;
    }
    
    return result[0];
  } catch (error) {
    console.error('UserModel.getByResetToken Error:', error);
    throw error;
  }
};

/**
 * Kullanıcı durumunu günceller
 * @param {number} userId - Kullanıcı ID
 * @param {string} status - Yeni durum
 * @returns {Promise<Object>} Güncellenmiş kullanıcı
 */
exports.updateStatus = async (userId, status) => {
  try {
    const query = `
      UPDATE users
      SET status = ?, updated_at = NOW()
      WHERE id = ?
    `;
    
    await db.query(query, [status, userId]);
    
    return await this.getById(userId);
  } catch (error) {
    console.error('UserModel.updateStatus Error:', error);
    throw error;
  }
};

/**
 * Kullanıcı profilini günceller
 * @param {number} userId - Kullanıcı ID
 * @param {Object} profileData - Profil verileri
 * @returns {Promise<Object>} Güncellenmiş kullanıcı
 */
exports.updateProfile = async (userId, profileData) => {
  try {
    const { first_name, last_name, phone } = profileData;
    
    const query = `
      UPDATE users
      SET 
        first_name = ?,
        last_name = ?,
        phone = ?,
        updated_at = NOW()
      WHERE id = ?
    `;
    
    await db.query(query, [first_name, last_name, phone, userId]);
    
    return await this.getById(userId);
  } catch (error) {
    console.error('UserModel.updateProfile Error:', error);
    throw error;
  }
};

/**
 * Kullanıcı şifresini günceller
 * @param {number} userId - Kullanıcı ID
 * @param {string} hashedPassword - Hashlenmiş şifre
 * @returns {Promise<boolean>} İşlem sonucu
 */
exports.updatePassword = async (userId, hashedPassword) => {
  try {
    const query = `
      UPDATE users
      SET 
        password = ?,
        updated_at = NOW()
      WHERE id = ?
    `;
    
    await db.query(query, [hashedPassword, userId]);
    
    return true;
  } catch (error) {
    console.error('UserModel.updatePassword Error:', error);
    throw error;
  }
};

/**
 * Son giriş tarihini günceller
 * @param {number} userId - Kullanıcı ID
 * @returns {Promise<boolean>} İşlem sonucu
 */
exports.updateLastLogin = async (userId) => {
  try {
    const query = `
      UPDATE users
      SET 
        last_login = NOW(),
        updated_at = NOW()
      WHERE id = ?
    `;
    
    await db.query(query, [userId]);
    
    return true;
  } catch (error) {
    console.error('UserModel.updateLastLogin Error:', error);
    throw error;
  }
};

/**
 * Doğrulama tokenini temizler
 * @param {number} userId - Kullanıcı ID
 * @returns {Promise<boolean>} İşlem sonucu
 */
exports.clearVerificationToken = async (userId) => {
  try {
    const query = `
      UPDATE users
      SET 
        verification_token = NULL,
        updated_at = NOW()
      WHERE id = ?
    `;
    
    await db.query(query, [userId]);
    
    return true;
  } catch (error) {
    console.error('UserModel.clearVerificationToken Error:', error);
    throw error;
  }
};

/**
 * Şifre sıfırlama tokeni oluşturur
 * @param {number} userId - Kullanıcı ID
 * @param {string} token - Token
 * @param {Date} expires - Geçerlilik süresi
 * @returns {Promise<boolean>} İşlem sonucu
 */
exports.setPasswordResetToken = async (userId, token, expires) => {
  try {
    const query = `
      UPDATE users
      SET 
        reset_token = ?,
        reset_token_expires = ?,
        updated_at = NOW()
      WHERE id = ?
    `;
    
    await db.query(query, [token, expires, userId]);
    
    return true;
  } catch (error) {
    console.error('UserModel.setPasswordResetToken Error:', error);
    throw error;
  }
};

/**
 * Şifreyi sıfırlar ve tokeni temizler
 * @param {number} userId - Kullanıcı ID
 * @param {string} hashedPassword - Hashlenmiş şifre
 * @returns {Promise<boolean>} İşlem sonucu
 */
exports.resetPassword = async (userId, hashedPassword) => {
  try {
    const query = `
      UPDATE users
      SET 
        password = ?,
        reset_token = NULL,
        reset_token_expires = NULL,
        updated_at = NOW()
      WHERE id = ?
    `;
    
    await db.query(query, [hashedPassword, userId]);
    
    return true;
  } catch (error) {
    console.error('UserModel.resetPassword Error:', error);
    throw error;
  }
};

/**
 * Kullanıcı adreslerini getirir
 * @param {number} userId - Kullanıcı ID
 * @returns {Promise<Array>} Adresler listesi
 */
exports.getAddresses = async (userId) => {
  try {
    const query = `
      SELECT *
      FROM user_addresses
      WHERE user_id = ?
      ORDER BY is_default DESC, created_at DESC
    `;
    
    return await db.query(query, [userId]);
  } catch (error) {
    console.error('UserModel.getAddresses Error:', error);
    throw error;
  }
};

/**
 * Adres ID'sine göre adres getirir
 * @param {number} addressId - Adres ID
 * @returns {Promise<Object|null>} Adres bilgisi
 */
exports.getAddressById = async (addressId) => {
  try {
    const query = `
      SELECT *
      FROM user_addresses
      WHERE id = ?
    `;
    
    const result = await db.query(query, [addressId]);
    
    if (!result || result.length === 0) {
      return null;
    }
    
    return result[0];
  } catch (error) {
    console.error('UserModel.getAddressById Error:', error);
    throw error;
  }
};

/**
 * Yeni adres ekler
 * @param {Object} addressData - Adres verileri
 * @returns {Promise<Object>} Eklenen adres
 */
exports.addAddress = async (addressData) => {
  try {
    const {
      user_id, title, first_name, last_name, address, city,
      state, postcode, country, phone, type, is_default
    } = addressData;
    
    const query = `
      INSERT INTO user_addresses (
        user_id, title, first_name, last_name, 
        address, city, state, postcode, country,
        phone, type, is_default, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;
    
    const params = [
      user_id, title, first_name, last_name,
      address, city, state, postcode, country,
      phone, type || 'both', is_default ? 1 : 0
    ];
    
    const result = await db.query(query, params);
    
    return {
      id: result.insertId,
      ...addressData
    };
  } catch (error) {
    console.error('UserModel.addAddress Error:', error);
    throw error;
  }
};

/**
 * Adres günceller
 * @param {number} addressId - Adres ID
 * @param {Object} addressData - Adres verileri
 * @returns {Promise<Object>} Güncellenmiş adres
 */
exports.updateAddress = async (addressId, addressData) => {
  try {
    const {
      title, first_name, last_name, address, city,
      state, postcode, country, phone, type, is_default
    } = addressData;
    
    const updateFields = [];
    const params = [];
    
    // Güncellenecek alanları belirle
    if (title !== undefined) {
      updateFields.push('title = ?');
      params.push(title);
    }
    
    if (first_name !== undefined) {
      updateFields.push('first_name = ?');
      params.push(first_name);
    }
    
    if (last_name !== undefined) {
      updateFields.push('last_name = ?');
      params.push(last_name);
    }
    
    if (address !== undefined) {
      updateFields.push('address = ?');
      params.push(address);
    }
    
    if (city !== undefined) {
      updateFields.push('city = ?');
      params.push(city);
    }
    
    if (state !== undefined) {
      updateFields.push('state = ?');
      params.push(state);
    }
    
    if (postcode !== undefined) {
      updateFields.push('postcode = ?');
      params.push(postcode);
    }
    
    if (country !== undefined) {
      updateFields.push('country = ?');
      params.push(country);
    }
    
    if (phone !== undefined) {
      updateFields.push('phone = ?');
      params.push(phone);
    }
    
    if (type !== undefined) {
      updateFields.push('type = ?');
      params.push(type);
    }
    
    if (is_default !== undefined) {
      updateFields.push('is_default = ?');
      params.push(is_default ? 1 : 0);
    }
    
    // updated_at alanını güncelle
    updateFields.push('updated_at = NOW()');
    
    // Güncelleme sorgusu
    const query = `
      UPDATE user_addresses
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;
    
    params.push(addressId);
    
    await db.query(query, params);
    
    // Güncellenmiş adresi getir
    return await this.getAddressById(addressId);
  } catch (error) {
    console.error('UserModel.updateAddress Error:', error);
    throw error;
  }
};

/**
 * Adres siler
 * @param {number} addressId - Adres ID
 * @returns {Promise<boolean>} İşlem sonucu
 */
exports.deleteAddress = async (addressId) => {
  try {
    const query = `
      DELETE FROM user_addresses
      WHERE id = ?
    `;
    
    await db.query(query, [addressId]);
    
    return true;
  } catch (error) {
    console.error('UserModel.deleteAddress Error:', error);
    throw error;
  }
};

/**
 * Diğer adreslerin varsayılan durumunu sıfırlar
 * @param {number} userId - Kullanıcı ID
 * @param {string} type - Adres tipi (shipping, billing, both)
 * @returns {Promise<boolean>} İşlem sonucu
 */
exports.resetDefaultAddresses = async (userId, type) => {
  try {
    let query;
    
    if (type === 'both') {
      // Tüm tip adreslerinin varsayılan durumunu sıfırla
      query = `
        UPDATE user_addresses
        SET is_default = 0
        WHERE user_id = ?
      `;
    } else {
      // Belirli tip adreslerinin varsayılan durumunu sıfırla
      query = `
        UPDATE user_addresses
        SET is_default = 0
        WHERE user_id = ? AND (type = ? OR type = 'both')
      `;
    }
    
    await db.query(query, type === 'both' ? [userId] : [userId, type]);
    
    return true;
  } catch (error) {
    console.error('UserModel.resetDefaultAddresses Error:', error);
    throw error;
  }
};

/**
 * Kullanıcının varsayılan adresini getirir
 * @param {number} userId - Kullanıcı ID
 * @param {string} type - Adres tipi (shipping, billing, both)
 * @returns {Promise<Object|null>} Adres bilgisi
 */
exports.getDefaultAddress = async (userId, type) => {
  try {
    const query = `
      SELECT *
      FROM user_addresses
      WHERE user_id = ? AND is_default = 1 AND (type = ? OR type = 'both')
      LIMIT 1
    `;
    
    const result = await db.query(query, [userId, type]);
    
    if (!result || result.length === 0) {
      return null;
    }
    
    return result[0];
  } catch (error) {
    console.error('UserModel.getDefaultAddress Error:', error);
    throw error;
  }
};

/**
 * Tüm kullanıcıları getirir (admin için)
 * @param {number} page - Sayfa numarası
 * @param {number} limit - Sayfa başına kayıt sayısı
 * @param {string} sortBy - Sıralama alanı
 * @param {string} sortOrder - Sıralama yönü
 * @param {Object} filters - Filtreler
 * @returns {Promise<Object>} Kullanıcı listesi ve toplam kayıt sayısı
 */
exports.getAllUsers = async (page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'DESC', filters = {}) => {
  try {
    const offset = (page - 1) * limit;
    
    // Filtreleme koşulları
    let whereConditions = ['1=1']; // Herzaman doğru olan bir başlangıç koşulu
    let params = [];
    
    if (filters.search) {
      whereConditions.push('(email LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR phone LIKE ?)');
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    if (filters.status) {
      whereConditions.push('status = ?');
      params.push(filters.status);
    }
    
    if (filters.role) {
      whereConditions.push('role = ?');
      params.push(filters.role);
    }
    
    // Geçerli sıralama alanı kontrolü
    const validSortFields = ['id', 'email', 'first_name', 'last_name', 'created_at', 'last_login', 'status'];
    const adjustedSortBy = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    
    // Geçerli sıralama yönü kontrolü
    const adjustedSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    // Toplam kayıt sayısını getir
    const countQuery = `
      SELECT COUNT(*) as total
      FROM users
      WHERE ${whereConditions.join(' AND ')}
    `;
    
    const countResult = await db.query(countQuery, params);
    const total = countResult[0].total;
    
    // Kullanıcıları getir (hassas bilgileri hariç tut)
    const usersQuery = `
      SELECT 
        id, email, first_name, last_name, phone, 
        status, role, created_at, updated_at, last_login,
        (
          SELECT COUNT(*) 
          FROM orders 
          WHERE user_id = users.id
        ) as order_count
      FROM users
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY ${adjustedSortBy} ${adjustedSortOrder}
      LIMIT ?, ?
    `;
    
    const users = await db.query(usersQuery, [...params, offset, limit]);
    
    return {
      users,
      total
    };
  } catch (error) {
    console.error('UserModel.getAllUsers Error:', error);
    throw error;
  }
};

/**
 * Kullanıcı istatistiklerini getirir
 * @returns {Promise<Object>} İstatistik verileri
 */
exports.getUserStats = async () => {
  try {
    // Toplam kullanıcı sayısı
    const totalUsersQuery = `
      SELECT COUNT(*) as total
      FROM users
    `;
    
    const totalUsersResult = await db.query(totalUsersQuery);
    const totalUsers = totalUsersResult[0].total;
    
    // Durum bazında kullanıcı sayıları
    const statusStatsQuery = `
      SELECT status, COUNT(*) as count
      FROM users
      GROUP BY status
    `;
    
    const statusStats = await db.query(statusStatsQuery);
    
    // Son 30 gün içinde kaydolan kullanıcı sayısı
    const newUsersQuery = `
      SELECT COUNT(*) as count
      FROM users
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `;
    
    const newUsersResult = await db.query(newUsersQuery);
    const newUsers = newUsersResult[0].count;
    
    // Aktif kullanıcı sayısı (son 30 gün içinde giriş yapan)
    const activeUsersQuery = `
      SELECT COUNT(*) as count
      FROM users
      WHERE last_login >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `;
    
    const activeUsersResult = await db.query(activeUsersQuery);
    const activeUsers = activeUsersResult[0].count;
    
    // Ay bazında yeni kayıt olan kullanıcı sayısı (son 12 ay)
    const monthlySignupsQuery = `
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as count
      FROM users
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY month
      ORDER BY month
    `;
    
    const monthlySignups = await db.query(monthlySignupsQuery);
    
    return {
      total_users: totalUsers,
      status_stats: statusStats,
      new_users_last_30_days: newUsers,
      active_users_last_30_days: activeUsers,
      monthly_signups: monthlySignups
    };
  } catch (error) {
    console.error('UserModel.getUserStats Error:', error);
    throw error;
  }
};

/**
 * Bülten aboneliği ekler
 * @param {Object} subscriptionData - Abonelik verileri
 * @returns {Promise<Object>} Eklenen abonelik
 */
exports.addNewsletterSubscription = async (subscriptionData) => {
  try {
    const { email, first_name, language, status } = subscriptionData;
    
    const query = `
      INSERT INTO newsletter_subscriptions (
        email, first_name, language, status, 
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        first_name = VALUES(first_name),
        language = VALUES(language),
        status = VALUES(status),
        updated_at = NOW()
    `;
    
    const params = [
      email, first_name || null, language || 'tr', status || 'active'
    ];
    
    const result = await db.query(query, params);
    
    return {
      id: result.insertId || result.affectedRows,
      email,
      first_name,
      language,
      status
    };
  } catch (error) {
    console.error('UserModel.addNewsletterSubscription Error:', error);
    throw error;
  }
};

/**
 * Bülten aboneliğini getirir
 * @param {string} email - E-posta adresi
 * @returns {Promise<Object|null>} Abonelik bilgisi
 */
exports.getNewsletterSubscription = async (email) => {
  try {
    const query = `
      SELECT *
      FROM newsletter_subscriptions
      WHERE email = ?
    `;
    
    const result = await db.query(query, [email]);
    
    if (!result || result.length === 0) {
      return null;
    }
    
    return result[0];
  } catch (error) {
    console.error('UserModel.getNewsletterSubscription Error:', error);
    throw error;
  }
};

/**
 * Bülten aboneliğini günceller
 * @param {string} email - E-posta adresi
 * @param {Object} updateData - Güncellenecek veriler
 * @returns {Promise<boolean>} İşlem sonucu
 */
exports.updateNewsletterSubscription = async (email, updateData) => {
  try {
    const { first_name, language, status } = updateData;
    
    const updateFields = [];
    const params = [];
    
    if (first_name !== undefined) {
      updateFields.push('first_name = ?');
      params.push(first_name);
    }
    
    if (language !== undefined) {
      updateFields.push('language = ?');
      params.push(language);
    }
    
    if (status !== undefined) {
      updateFields.push('status = ?');
      params.push(status);
    }
    
    // updated_at alanını güncelle
    updateFields.push('updated_at = NOW()');
    
    // Güncelleme sorgusu
    const query = `
      UPDATE newsletter_subscriptions
      SET ${updateFields.join(', ')}
      WHERE email = ?
    `;
    
    params.push(email);
    
    await db.query(query, params);
    
    return true;
  } catch (error) {
    console.error('UserModel.updateNewsletterSubscription Error:', error);
    throw error;
  }
};

/**
 * Aktif bülten abonelerini getirir
 * @param {string|null} language - Dil filtresi
 * @returns {Promise<Array>} Aboneler listesi
 */
exports.getActiveNewsletterSubscribers = async (language = null) => {
  try {
    let query = `
      SELECT *
      FROM newsletter_subscriptions
      WHERE status = 'active'
    `;
    
    const params = [];
    
    if (language) {
      query += ' AND language = ?';
      params.push(language);
    }
    
    return await db.query(query, params);
  } catch (error) {
    console.error('UserModel.getActiveNewsletterSubscribers Error:', error);
    throw error;
  }
};