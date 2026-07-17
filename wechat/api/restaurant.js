/**
 * 餐厅 API 模块
 */
const { query } = require('../utils/request');

/**
 * 获取餐厅列表
 * @param {object} params - 查询参数
 * @returns {Promise<{items: Array, total: number}>}
 */
function list(params = {}) {
  return query('restaurant.list', params);
}

/**
 * 获取餐厅详情
 * @param {string} id - 餐厅ID
 * @returns {Promise<object>}
 */
function getDetail(id) {
  return query('restaurant.getOne', { id });
}

module.exports = {
  list,
  getDetail,
};
