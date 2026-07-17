/**
 * 认证工具模块
 * 管理 token 存储、用户信息、登录状态检查
 */

/**
 * 保存登录信息
 * @param {object} data - 登录返回的数据
 * @param {string} data.token - JWT token
 * @param {string} data.refreshToken - JWT refreshToken
 * @param {object} data.user - 用户信息
 */
function saveLoginInfo(data) {
  wx.setStorageSync('token', data.token);
  wx.setStorageSync('refreshToken', data.refreshToken);
  wx.setStorageSync('userInfo', JSON.stringify(data.user));
  if (data.user.restaurants && data.user.restaurants.length > 0) {
    wx.setStorageSync('currentRestaurant', JSON.stringify(data.user.restaurants[0]));
  }
}

/**
 * 获取当前用户信息
 * @returns {object|null} 用户信息
 */
function getUserInfo() {
  try {
    const raw = wx.getStorageSync('userInfo');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * 获取当前选中的餐厅
 * @returns {object|null} 餐厅信息
 */
function getCurrentRestaurant() {
  try {
    const raw = wx.getStorageSync('currentRestaurant');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * 设置当前选中的餐厅
 * @param {object} restaurant - 餐厅信息
 */
function setCurrentRestaurant(restaurant) {
  wx.setStorageSync('currentRestaurant', JSON.stringify(restaurant));
}

/**
 * 检查是否已登录
 * @returns {boolean}
 */
function isLoggedIn() {
  return !!wx.getStorageSync('token');
}

/**
 * 清除登录信息
 */
function clearLoginInfo() {
  wx.removeStorageSync('token');
  wx.removeStorageSync('refreshToken');
  wx.removeStorageSync('userInfo');
  wx.removeStorageSync('currentRestaurant');
}

/**
 * 检查用户是否有指定权限
 * @param {string} permission - 权限标识
 * @returns {boolean}
 */
function hasPermission(permission) {
  const user = getUserInfo();
  if (!user || !user.profile) return false;
  return user.profile.includes(permission);
}

/**
 * 判断当前用户是否为管理员（店长）
 * @returns {boolean}
 */
function isAdmin() {
  const user = getUserInfo();
  return !!(user && user.role === 'admin');
}

/**
 * 获取角色显示名
 * @param {string} role - 角色标识
 * @returns {string}
 */
function getRoleLabel(role) {
  const labels = { admin: '餐厅主管', user: '员工' };
  return labels[role] || role;
}

/**
 * 校验用户是否有权访问指定餐厅
 * admin 角色拥有全部餐厅权限
 * @param {string} restaurantId - 目标餐厅 ID
 * @returns {boolean}
 */
function hasRestaurantAccess(restaurantId) {
  const user = getUserInfo();
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (!user.restaurants || !Array.isArray(user.restaurants)) return false;
  return user.restaurants.some((r) => r.id === restaurantId);
}

/**
 * 校验用户是否关联了餐厅，未关联则提示并跳转登录页
 * @returns {boolean} 是否通过校验
 */
function requireRestaurant() {
  const user = getUserInfo();
  if (!user) {
    wx.reLaunch({ url: '/pages/login/login' });
    return false;
  }
  if (user.role === 'admin') return true;
  if (!user.restaurants || user.restaurants.length === 0) {
    wx.showToast({ title: '您未关联任何餐厅，请联系管理员', icon: 'none', duration: 2000 });
    setTimeout(() => {
      clearLoginInfo();
      wx.reLaunch({ url: '/pages/login/login' });
    }, 1500);
    return false;
  }
  return true;
}

/**
 * 校验用户是否有权访问指定餐厅，无权限则提示并跳转登录页
 * @param {string} restaurantId - 目标餐厅 ID
 * @returns {boolean} 是否通过校验
 */
function assertRestaurantAccess(restaurantId) {
  if (!hasRestaurantAccess(restaurantId)) {
    wx.showToast({ title: '您没有该餐厅的操作权限', icon: 'none', duration: 2000 });
    setTimeout(() => {
      clearLoginInfo();
      wx.reLaunch({ url: '/pages/login/login' });
    }, 1500);
    return false;
  }
  return true;
}

module.exports = {
  saveLoginInfo,
  getUserInfo,
  getCurrentRestaurant,
  setCurrentRestaurant,
  isLoggedIn,
  clearLoginInfo,
  hasPermission,
  isAdmin,
  getRoleLabel,
  hasRestaurantAccess,
  requireRestaurant,
  assertRestaurantAccess,
};
