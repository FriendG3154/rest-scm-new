/**
 * 供应商 API 模块
 */
const { query } = require('../utils/request');

/**
 * 获取供应商列表
 * @param {object} params - 查询参数
 * @returns {Promise<{items: Array, total: number}>}
 */
function list(params = {}) {
  return query('supplier.list', params);
}

/**
 * 获取供应商详情
 * @param {string} id - 供应商ID
 * @returns {Promise<object>}
 */
function getDetail(id) {
  return query('supplier.getOne', { id });
}

module.exports = {
  list,
  getDetail,
};
