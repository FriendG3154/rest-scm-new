/**
 * 认证 API 模块
 */
const { mutate, query } = require('../utils/request');

/**
 * 手机号+密码登录
 * @param {string} phone - 手机号
 * @param {string} password - 密码
 * @returns {Promise<object>} 登录结果
 */
function mobileLogin(phone, password) {
  return mutate('auth.mobileLogin', { phone, password });
}

/**
 * 微信手机号快捷登录
 * @param {string} code - wx.login() 返回的临时登录凭证
 * @param {string} phoneCode - getPhoneNumber 事件返回的 code
 * @returns {Promise<object>} 登录结果
 */
function wechatLogin(code, phoneCode) {
  return mutate('auth.wechatLogin', { code, phoneCode });
}

/**
 * 获取当前用户信息
 * @returns {Promise<object|null>}
 */
function getMe() {
  return query('auth.me');
}

/**
 * 刷新 token
 * @param {string} refreshToken
 * @returns {Promise<object>}
 */
function refreshToken(refreshToken) {
  return mutate('auth.refreshToken', { refreshToken });
}

module.exports = {
  mobileLogin,
  wechatLogin,
  getMe,
  refreshToken,
};
