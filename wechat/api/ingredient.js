/**
 * 食材 API 模块
 */
const { query } = require('../utils/request');

/**
 * 获取食材列表
 * @param {object} params - 查询参数
 * @returns {Promise<{items: Array, total: number}>}
 */
function list(params = {}) {
  return query('ingredient.list', params);
}

/**
 * 获取全量食材列表（不分页）
 * @returns {Promise<Array>} 全部食材列表
 */
function listAll() {
  return query('ingredient.listAll');
}

/**
 * 获取食材详情
 * @param {string} id - 食材ID
 * @returns {Promise<object>}
 */
function getDetail(id) {
  return query('ingredient.getOne', { id });
}

module.exports = {
  list,
  listAll,
  getDetail,
};
