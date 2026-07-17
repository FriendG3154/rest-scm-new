/**
 * 订单 API 模块
 */
const { query, mutate } = require('../utils/request');

/**
 * 获取订单列表
 * @param {object} params - 查询参数
 * @param {string} [params.status] - 订单状态筛选
 * @param {string} [params.restaurant_id] - 餐厅ID筛选
 * @param {number} [params.page] - 页码
 * @param {number} [params.pageSize] - 每页数量
 * @returns {Promise<{items: Array, total: number}>}
 */
function listRequests(params = {}) {
  return query('order.todaylistRequests', params);
}

/**
 * 获取订单详情
 * @param {string} id - 订单ID
 * @returns {Promise<object>}
 */
function getRequestDetail(id) {
  return query('order.getRequestDetail', { id });
}

/**
 * 创建订单
 * @param {string} restaurantId - 餐厅ID
 * @param {Array<{ingredient_id: string, quantity: number, supplier_id?: string}>} items - 订单项
 * @returns {Promise<object>}
 */
function createRequest(restaurantId, items) {
  return mutate('order.createRequest', {
    restaurant_id: restaurantId,
    items,
  });
}

/**
 * 更新订单项数量
 * @param {string} id - 订单项ID
 * @param {number} quantity - 新数量
 * @returns {Promise<object>}
 */
function updateItem(id, quantity) {
  return mutate('order.updateItem', { id, quantity });
}

/**
 * 删除订单项
 * @param {string} id - 订单项ID
 * @returns {Promise<object>}
 */
function deleteItem(id) {
  return mutate('order.deleteItem', { id });
}

/**
 * 审核通过订单
 * @param {string} id - 订单ID
 * @returns {Promise<object>}
 */
function approveRequest(id) {
  return mutate('order.approve', { id });
}

/**
 * 获取统计数据
 * @returns {Promise<{pendingCount: number, approvedCount: number}>}
 */
function getStats() {
  return query('order.stats');
}

/**
 * 获取今日汇总清单
 * 仅返回今天的订单，优先 pending 状态，无则返回 approved
 * @returns {Promise<{items: Array, status: string}>}
 */
function summaryToday() {
  return query('order.summaryToday');
}

module.exports = {
  listRequests,
  getRequestDetail,
  createRequest,
  updateItem,
  deleteItem,
  approveRequest,
  getStats,
  summaryToday,
};
