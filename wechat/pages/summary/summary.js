/**
 * 清单汇总页面
 * 汇总所有餐厅的订单数据，支持按供应商/餐厅/食材三种维度查看
 * pending 状态可编辑数量并审核，approved 状态可分享给供应商
 * 仅 admin（店长）角色可访问
 */
const orderApi = require('../../api/order');
const authUtil = require('../../utils/auth');
const { resolveImageUrl } = require('../../utils/util');
import Toast from 'tdesign-miniprogram/toast';


Page({
  data: {
    statusBarHeight: 0,
    navHeight: 0,
    activeTab: 0,
    loading: false,
    refreshing: false,
    currentEmpty: false,

    // 审核状态 tab：0 = 未审核(pending), 1 = 已审核(approved)
    statusTab: 0,
    // 是否同时存在两种状态（控制 tab 显隐）
    showStatusTab: false,

    // 当前订单状态：pending / approved
    currentStatus: '',

    // 三种分组视图
    supplierGroups: [],
    restaurantGroups: [],
    ingredientGroups: [],

    // 原始数据（按状态分开存储）
    pendingOrders: [],
    approvedOrders: [],
    allOrders: [],
  },

  onLoad() {
    const sysInfo = wx.getWindowInfo();
    const menuRect = wx.getMenuButtonBoundingClientRect();
    const statusBarHeight = sysInfo.statusBarHeight || 44;
    const navHeight = menuRect.bottom + 18;

    this.setData({ statusBarHeight, navHeight });
  },

  onShow() {
    // 权限校验：仅 admin（店长）可访问汇总页面
    if (!authUtil.isAdmin()) {
      wx.switchTab({ url: '/pages/list/list' });
      return;
    }

    // 校验用户是否关联了餐厅
    if (!authUtil.requireRestaurant()) return;

    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setActiveByUrl('/pages/summary/summary');
    }
    this._refreshPage();
  },

  onRefresh() {
    this.setData({ refreshing: true });
    this._refreshPage().finally(() => {
      this.setData({ refreshing: false });
    });
  },

  onTabChange(e) {
    const tab = parseInt(e.currentTarget.dataset.tab);
    this.setData({ activeTab: tab });
    this._updateEmptyState();
  },

  /**
   * 切换审核状态 tab（未审核 / 已审核）
   * @param {object} e - tap 事件，dataset.tab 为 0(未审核) 或 1(已审核)
   */
  onStatusTabChange(e) {
    const statusTab = parseInt(e.currentTarget.dataset.tab);
    if (statusTab === this.data.statusTab) return;

    const currentStatus = statusTab === 0 ? 'pending' : 'approved';
    const allOrders = statusTab === 0 ? this.data.pendingOrders : this.data.approvedOrders;

    this.setData({ statusTab, currentStatus, allOrders });
    this._buildAllViews(allOrders);
  },

  onFilterTap() {
    Toast({ theme:'error',context: this, selector: '#t-toast', message: '筛选功能开发中' });
  },

  /**
   * 完整刷新页面状态
   * 重置所有视图数据，重新从服务端拉取最新清单状态，根据数据自动切换审核状态 tab
   */
  async _refreshPage() {
    // 先清空当前视图数据，避免残留旧状态
    this.setData({
      supplierGroups: [],
      restaurantGroups: [],
      ingredientGroups: [],
      allOrders: [],
      currentEmpty: false,
    });
    await this._loadData();
  },

  /**
   * 加载全部订单数据
   * 调用今日汇总接口，同时获取 pending 和 approved 数据
   */
  async _loadData() {
    this.setData({ loading: true });
    try {
      const result = await orderApi.summaryToday();
      const pendingOrders = result?.pendingItems || [];
      const approvedOrders = result?.approvedItems || [];

      const hasPending = pendingOrders.length > 0;
      const hasApproved = approvedOrders.length > 0;
      const showStatusTab = hasPending && hasApproved;

      // 决定当前显示的 tab 和状态（根据服务端最新数据自动判定）
      let statusTab = this.data.statusTab;
      let currentStatus = '';
      let allOrders = [];

      if (showStatusTab) {
        // 两种状态都有：若当前 tab 对应的状态已无数据则自动切换
        if (statusTab === 0 && !hasPending) {
          statusTab = 1;
        } else if (statusTab === 1 && !hasApproved) {
          statusTab = 0;
        }
        currentStatus = statusTab === 0 ? 'pending' : 'approved';
        allOrders = statusTab === 0 ? pendingOrders : approvedOrders;
      } else if (hasPending) {
        statusTab = 0;
        currentStatus = 'pending';
        allOrders = pendingOrders;
      } else if (hasApproved) {
        statusTab = 1;
        currentStatus = 'approved';
        allOrders = approvedOrders;
      } else {
        statusTab = 0;
        currentStatus = '';
        allOrders = [];
      }

      this.setData({ pendingOrders, approvedOrders, allOrders, currentStatus, showStatusTab, statusTab });
      this._buildAllViews(allOrders);
    } catch (err) {
      console.error('加载汇总数据失败:', err);
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 构建三种视图数据
   * @param {Array} orders - 订单数组
   */
  _buildAllViews(orders) {
    this._buildSupplierView(orders);
    this._buildRestaurantView(orders);
    this._buildIngredientView(orders);
    this._updateEmptyState();
  },

  /**
   * 按供应商分组汇总
   * 同一食材如有多个餐厅采购，按餐厅拆分显示数量
   */
  _buildSupplierView(orders) {
    const map = {};
    orders.forEach((order) => {
      const restaurantId = order.restaurant?.id || 'unknown';
      const restaurantName = order.restaurant?.name || '未知餐厅';
      (order.items || []).forEach((item) => {
        const sid = item.supplier?.id || 'unknown';
        if (!map[sid]) {
          map[sid] = {
            id: sid,
            name: item.supplier?.company_name || '未指定供应商',
            contactName: item.supplier?.contact_name || '',
            ingredientMap: {},
          };
        }
        const iid = item.ingredient?.id;
        if (!map[sid].ingredientMap[iid]) {
          map[sid].ingredientMap[iid] = {
            id: iid,
            name: item.ingredient?.name || '',
            icon: resolveImageUrl(item.ingredient?.icon),
            unitName: item.ingredient?.unit?.name || '',
            minValue: item.ingredient?.unit?.min_value != null ? Number(item.ingredient.unit.min_value) : null,
            maxValue: item.ingredient?.unit?.max_value != null ? Number(item.ingredient.unit.max_value) : null,
            totalQty: 0,
            orderItems: [],
            restaurantMap: {},
          };
        }
        map[sid].ingredientMap[iid].totalQty += Number(item.quantity);
        map[sid].ingredientMap[iid].orderItems.push({ id: item.id, quantity: Number(item.quantity) });
        // 按餐厅聚合数量
        if (!map[sid].ingredientMap[iid].restaurantMap[restaurantId]) {
          map[sid].ingredientMap[iid].restaurantMap[restaurantId] = {
            restaurantName: restaurantName,
            quantity: 0,
            orderItems: [],
          };
        }
        map[sid].ingredientMap[iid].restaurantMap[restaurantId].quantity += Number(item.quantity);
        map[sid].ingredientMap[iid].restaurantMap[restaurantId].orderItems.push({ id: item.id, quantity: Number(item.quantity) });
      });
    });

    const groups = Object.values(map).map((g) => ({
      ...g,
      items: Object.values(g.ingredientMap).map((ing) => {
        const restaurantDetails = Object.values(ing.restaurantMap);
        return {
          ...ing,
          restaurantDetails: restaurantDetails,
          multiRestaurant: restaurantDetails.length > 1,
        };
      }),
    }));
    this.setData({ supplierGroups: groups });
  },

  /**
   * 按餐厅分组汇总
   * 同一食材如有多个供应商采购，按供应商拆分显示数量
   */
  _buildRestaurantView(orders) {
    const map = {};
    orders.forEach((order) => {
      const rid = order.restaurant?.id || 'unknown';
      if (!map[rid]) {
        map[rid] = {
          id: rid,
          name: order.restaurant?.name || '',
          address: order.restaurant?.address || '',
          ingredientMap: {},
        };
      }
      (order.items || []).forEach((item) => {
        const iid = item.ingredient?.id;
        const supplierId = item.supplier?.id || 'unknown';
        const supplierName = item.supplier?.company_name || '未指定供应商';
        if (!map[rid].ingredientMap[iid]) {
          map[rid].ingredientMap[iid] = {
            id: iid,
            name: item.ingredient?.name || '',
            icon: resolveImageUrl(item.ingredient?.icon),
            unitName: item.ingredient?.unit?.name || '',
            minValue: item.ingredient?.unit?.min_value != null ? Number(item.ingredient.unit.min_value) : null,
            maxValue: item.ingredient?.unit?.max_value != null ? Number(item.ingredient.unit.max_value) : null,
            totalQty: 0,
            orderItems: [],
            supplierMap: {},
          };
        }
        map[rid].ingredientMap[iid].totalQty += Number(item.quantity);
        map[rid].ingredientMap[iid].orderItems.push({ id: item.id, quantity: Number(item.quantity) });
        // 按供应商聚合数量
        if (!map[rid].ingredientMap[iid].supplierMap[supplierId]) {
          map[rid].ingredientMap[iid].supplierMap[supplierId] = {
            supplierName: supplierName,
            quantity: 0,
            orderItems: [],
          };
        }
        map[rid].ingredientMap[iid].supplierMap[supplierId].quantity += Number(item.quantity);
        map[rid].ingredientMap[iid].supplierMap[supplierId].orderItems.push({ id: item.id, quantity: Number(item.quantity) });
      });
    });

    const groups = Object.values(map).map((g) => ({
      ...g,
      items: Object.values(g.ingredientMap).map((ing) => {
        const supplierDetails = Object.values(ing.supplierMap);
        return {
          ...ing,
          supplierDetails: supplierDetails,
          multiSupplier: supplierDetails.length > 1,
        };
      }),
    }));
    this.setData({ restaurantGroups: groups });
  },

  /**
   * 按食材分组汇总
   * 层级：食材 → 供应商 → 餐厅，区分同一食材下不同供应商、不同餐厅的数量
   */
  _buildIngredientView(orders) {
    const map = {};
    orders.forEach((order) => {
      const restaurantId = order.restaurant?.id || 'unknown';
      const restaurantName = order.restaurant?.name || '未知餐厅';
      (order.items || []).forEach((item) => {
        const iid = item.ingredient?.id;
        const supplierId = item.supplier?.id || 'unknown';
        const supplierName = item.supplier?.company_name || '未指定供应商';
        if (!map[iid]) {
          map[iid] = {
            id: iid,
            name: item.ingredient?.name || '',
            icon: resolveImageUrl(item.ingredient?.icon),
            unitName: item.ingredient?.unit?.name || '',
            minValue: item.ingredient?.unit?.min_value != null ? Number(item.ingredient.unit.min_value) : null,
            maxValue: item.ingredient?.unit?.max_value != null ? Number(item.ingredient.unit.max_value) : null,
            totalQty: 0,
            orderItems: [],
            supplierMap: {},
          };
        }
        map[iid].totalQty += Number(item.quantity);
        map[iid].orderItems.push({ id: item.id, quantity: Number(item.quantity) });
        // 先按供应商分组
        if (!map[iid].supplierMap[supplierId]) {
          map[iid].supplierMap[supplierId] = {
            id: supplierId,
            name: supplierName,
            totalQty: 0,
            orderItems: [],
            restaurantMap: {},
          };
        }
        map[iid].supplierMap[supplierId].totalQty += Number(item.quantity);
        map[iid].supplierMap[supplierId].orderItems.push({ id: item.id, quantity: Number(item.quantity) });
        // 再按餐厅分组
        if (!map[iid].supplierMap[supplierId].restaurantMap[restaurantId]) {
          map[iid].supplierMap[supplierId].restaurantMap[restaurantId] = {
            restaurantName,
            quantity: 0,
            orderItems: [],
          };
        }
        map[iid].supplierMap[supplierId].restaurantMap[restaurantId].quantity += Number(item.quantity);
        map[iid].supplierMap[supplierId].restaurantMap[restaurantId].orderItems.push({ id: item.id, quantity: Number(item.quantity) });
      });
    });

    const groups = Object.values(map).map((g) => {
      const suppliers = Object.values(g.supplierMap).map((s) => {
        const restaurantDetails = Object.values(s.restaurantMap);
        return {
          ...s,
          restaurantDetails,
          multiRestaurant: restaurantDetails.length > 1,
        };
      });
      return {
        ...g,
        suppliers,
      };
    });
    this.setData({ ingredientGroups: groups });
  },

  _updateEmptyState() {
    const { activeTab, supplierGroups, restaurantGroups, ingredientGroups } = this.data;
    let empty = false;
    if (activeTab === 0) empty = supplierGroups.length === 0;
    if (activeTab === 1) empty = restaurantGroups.length === 0;
    if (activeTab === 2) empty = ingredientGroups.length === 0;
    this.setData({ currentEmpty: empty });
  },

  /**
   * 修改菜品数量（餐厅视图，单个订单项）
   * 数量为 0 时触发删除确认
   */
  async onQuantityChange(e) {
    const { value } = e.detail;
    const itemId = e.currentTarget.dataset.itemId;
    const itemName = e.currentTarget.dataset.itemName || '该菜品';
    const minValue = e.currentTarget.dataset.minValue;
    const maxValue = e.currentTarget.dataset.maxValue;
    const unitName = e.currentTarget.dataset.unitName || '';
    if (!itemId) return;

    let qty = parseFloat(value);
    if (!qty || qty <= 0) {
      this._confirmDeleteItem(itemId, itemName);
      return;
    }

    const minVal = minValue != null && minValue !== '' ? Number(minValue) : null;
    const maxVal = maxValue != null && maxValue !== '' ? Number(maxValue) : null;

    if (minVal !== null && qty < minVal) {
      qty = minVal;
      Toast({ theme:'info', context: this, selector: '#t-toast', message: `数量不能小于 ${minVal}${unitName}` });
    }
    if (maxVal !== null && qty > maxVal) {
      qty = maxVal;
      Toast({ theme:'info', context: this, selector: '#t-toast', message: `数量不能大于 ${maxVal}${unitName}` });
    }

    try {
      await orderApi.updateItem(itemId, qty);
      const allOrders = this.data.allOrders.map((order) => ({
        ...order,
        items: order.items.map((item) =>
          item.id === itemId ? { ...item, quantity: qty } : item,
        ),
      }));
      this.setData({ allOrders });
      this._buildAllViews(allOrders);
    } catch (err) {
      Toast({ theme:'info',context: this, selector: '#t-toast', message: '更新数量失败' });
    }
  },

  /**
   * 修改聚合数量（供应商/食材视图）
   * 数量为 0 时触发删除确认
   */
  async onGroupQtyChange(e) {
    const { value } = e.detail;
    const orderItemsStr = e.currentTarget.dataset.orderItems;
    const itemName = e.currentTarget.dataset.itemName || '该菜品';
    const minValue = e.currentTarget.dataset.minValue;
    const maxValue = e.currentTarget.dataset.maxValue;
    const unitName = e.currentTarget.dataset.unitName || '';
    if (!orderItemsStr) return;

    const orderItems = typeof orderItemsStr === 'string' ? JSON.parse(orderItemsStr) : orderItemsStr;
    if (!orderItems || orderItems.length === 0) return;

    let qty = parseFloat(value);
    if (!qty || qty <= 0) {
      this._confirmDeleteGroupItems(orderItems, itemName);
      return;
    }

    const minVal = minValue != null && minValue !== '' ? Number(minValue) : null;
    const maxVal = maxValue != null && maxValue !== '' ? Number(maxValue) : null;

    if (minVal !== null && qty < minVal) {
      qty = minVal;
      Toast({ theme:'info', context: this, selector: '#t-toast', message: `数量不能小于 ${minVal}${unitName}` });
    }
    if (maxVal !== null && qty > maxVal) {
      qty = maxVal;
      Toast({ theme:'info', context: this, selector: '#t-toast', message: `数量不能大于 ${maxVal}${unitName}` });
    }

    const oldTotal = orderItems.reduce((sum, oi) => sum + oi.quantity, 0);
    const newTotal = qty;
    if (newTotal === oldTotal) return;

    try {
      const updates = [];
      let remaining = newTotal;
      for (let i = 0; i < orderItems.length; i++) {
        const oi = orderItems[i];
        let newQty;
        if (i === orderItems.length - 1) {
          newQty = Math.max(1, remaining);
        } else {
          newQty = Math.max(1, Math.round((oi.quantity / oldTotal) * newTotal));
          remaining -= newQty;
        }
        updates.push({ id: oi.id, quantity: newQty });
      }

      for (const u of updates) {
        await orderApi.updateItem(u.id, u.quantity);
      }

      const updateMap = {};
      updates.forEach((u) => { updateMap[u.id] = u.quantity; });
      const allOrders = this.data.allOrders.map((order) => ({
        ...order,
        items: order.items.map((item) =>
          updateMap[item.id] !== undefined ? { ...item, quantity: updateMap[item.id] } : item,
        ),
      }));
      this.setData({ allOrders });
      this._buildAllViews(allOrders);
    } catch (err) {
      Toast({ theme:'info',context: this, selector: '#t-toast', message: err.message});
      // this._loadData();
    }
  },

  /* ========== 左滑删除 touch 事件 ========== */

  onTouchStart(e) {
    if (this.data.currentStatus !== 'pending') return;
    const touch = e.changedTouches[0];
    this._touchStartX = touch.clientX;
    this._touchStartY = touch.clientY;
    this._swiping = false;
    this._directionLocked = false;

    // 关闭之前打开的滑动项（移除动画标记）
    this._resetAllSwipe();
  },

  onTouchMove(e) {
    if (this.data.currentStatus !== 'pending') return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - this._touchStartX;
    const dy = touch.clientY - this._touchStartY;

    // 首次判断方向
    if (!this._directionLocked) {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      this._directionLocked = true;
      // 纵向滑动则不拦截
      if (Math.abs(dy) > Math.abs(dx)) {
        this._swiping = false;
        return;
      }
      this._swiping = true;
    }

    if (!this._swiping) return;

    // 限制为左滑，最大 -65px
    const x = Math.max(-65, Math.min(0, dx));
    this._setSwipeX(e, x, false);
  },

  onTouchEnd(e) {
    if (this.data.currentStatus !== 'pending' || !this._swiping) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - this._touchStartX;
    const finalX = dx < -30 ? -65 : 0;
    this._setSwipeX(e, finalX, true);
  },

  /**
   * 重置所有已打开的滑动项
   */
  _resetAllSwipe() {
    const updates = {};
    const { activeTab, supplierGroups, restaurantGroups, ingredientGroups } = this.data;

    if (activeTab === 0) {
      supplierGroups.forEach((g, sIdx) => {
        g.items.forEach((f, fIdx) => {
          if (f._swipeX) {
            updates[`supplierGroups[${sIdx}].items[${fIdx}]._swipeX`] = 0;
            updates[`supplierGroups[${sIdx}].items[${fIdx}]._animating`] = true;
          }
          if (f.restaurantDetails) {
            f.restaurantDetails.forEach((rd, rdIdx) => {
              if (rd._swipeX) {
                updates[`supplierGroups[${sIdx}].items[${fIdx}].restaurantDetails[${rdIdx}]._swipeX`] = 0;
                updates[`supplierGroups[${sIdx}].items[${fIdx}].restaurantDetails[${rdIdx}]._animating`] = true;
              }
            });
          }
        });
      });
    } else if (activeTab === 1) {
      restaurantGroups.forEach((g, rIdx) => {
        g.items.forEach((f, fIdx) => {
          if (f._swipeX) {
            updates[`restaurantGroups[${rIdx}].items[${fIdx}]._swipeX`] = 0;
            updates[`restaurantGroups[${rIdx}].items[${fIdx}]._animating`] = true;
          }
          if (f.supplierDetails) {
            f.supplierDetails.forEach((sd, sdIdx) => {
              if (sd._swipeX) {
                updates[`restaurantGroups[${rIdx}].items[${fIdx}].supplierDetails[${sdIdx}]._swipeX`] = 0;
                updates[`restaurantGroups[${rIdx}].items[${fIdx}].supplierDetails[${sdIdx}]._animating`] = true;
              }
            });
          }
        });
      });
    } else if (activeTab === 2) {
      ingredientGroups.forEach((g, iIdx) => {
        if (g.suppliers) {
          g.suppliers.forEach((s, sIdx) => {
            if (s._swipeX) {
              updates[`ingredientGroups[${iIdx}].suppliers[${sIdx}]._swipeX`] = 0;
              updates[`ingredientGroups[${iIdx}].suppliers[${sIdx}]._animating`] = true;
            }
            if (s.restaurantDetails) {
              s.restaurantDetails.forEach((rd, rdIdx) => {
                if (rd._swipeX) {
                  updates[`ingredientGroups[${iIdx}].suppliers[${sIdx}].restaurantDetails[${rdIdx}]._swipeX`] = 0;
                  updates[`ingredientGroups[${iIdx}].suppliers[${sIdx}].restaurantDetails[${rdIdx}]._animating`] = true;
                }
              });
            }
          });
        }
      });
    }

    if (Object.keys(updates).length > 0) {
      this.setData(updates);
    }
  },

  /**
   * 设置滑动偏移量
   * @param {object} e - touch 事件
   * @param {number} x - 偏移量
   * @param {boolean} animate - 是否添加过渡动画
   */
  _setSwipeX(e, x, animate) {
    const dataset = e.currentTarget.dataset;
    const { activeTab } = this.data;
    let basePath = '';

    if (activeTab === 0 && dataset.supplierIdx !== undefined) {
      if (dataset.rdIdx !== undefined) {
        basePath = `supplierGroups[${dataset.supplierIdx}].items[${dataset.foodIdx}].restaurantDetails[${dataset.rdIdx}]`;
      } else {
        basePath = `supplierGroups[${dataset.supplierIdx}].items[${dataset.foodIdx}]`;
      }
    } else if (activeTab === 1 && dataset.restaurantIdx !== undefined) {
      if (dataset.sdIdx !== undefined) {
        basePath = `restaurantGroups[${dataset.restaurantIdx}].items[${dataset.foodIdx}].supplierDetails[${dataset.sdIdx}]`;
      } else {
        basePath = `restaurantGroups[${dataset.restaurantIdx}].items[${dataset.foodIdx}]`;
      }
    } else if (activeTab === 2 && dataset.ingredientIdx !== undefined) {
      if (dataset.rdIdx !== undefined) {
        basePath = `ingredientGroups[${dataset.ingredientIdx}].suppliers[${dataset.supplierIdx}].restaurantDetails[${dataset.rdIdx}]`;
      } else {
        basePath = `ingredientGroups[${dataset.ingredientIdx}].suppliers[${dataset.supplierIdx}]`;
      }
    }

    if (basePath) {
      this.setData({
        [`${basePath}._swipeX`]: x,
        [`${basePath}._animating`]: animate,
      });
    }
  },

  /* ========== 删除逻辑 ========== */

  /**
   * 点击删除按钮 - 单个订单项
   */
  onDeleteItem(e) {
    if (this.data.currentStatus !== 'pending') return;
    const itemId = e.currentTarget.dataset.itemId;
    const itemName = e.currentTarget.dataset.itemName || '该菜品';
    this._confirmDeleteItem(itemId, itemName);
  },

  /**
   * 点击删除按钮 - 聚合项
   */
  onDeleteGroupItems(e) {
    if (this.data.currentStatus !== 'pending') return;
    const orderItemsStr = e.currentTarget.dataset.orderItems;
    const itemName = e.currentTarget.dataset.itemName || '该菜品';
    const orderItems = typeof orderItemsStr === 'string' ? JSON.parse(orderItemsStr) : orderItemsStr;
    if (!orderItems || orderItems.length === 0) return;
    this._confirmDeleteGroupItems(orderItems, itemName);
  },

  /**
   * 确认删除单个订单项
   */
  _confirmDeleteItem(itemId, itemName) {
    wx.showModal({
      title: '确认删除',
      content: `确定删除「${itemName}」吗？`,
      confirmColor: '#e34d59',
      success: async (res) => {
        if (!res.confirm) {
          this._loadData();
          return;
        }
        try {
          await orderApi.deleteItem(itemId);
          const allOrders = this.data.allOrders.map((order) => ({
            ...order,
            items: order.items.filter((item) => item.id !== itemId),
          })).filter((order) => order.items.length > 0);
          this.setData({ allOrders });
          this._buildAllViews(allOrders);
          Toast({ theme:'success', context: this, selector: '#t-toast', message: '已删除' });
        } catch (err) {
          console.error('删除失败:', err);
          Toast({theme:'error', context: this, selector: '#t-toast', message: '删除失败' });
        }
      },
    });
  },

  /**
   * 确认删除聚合项对应的所有订单项
   */
  _confirmDeleteGroupItems(orderItems, itemName) {
    wx.showModal({
      title: '确认删除',
      content: `确定删除「${itemName}」吗？共 ${orderItems.length} 条记录将被删除。`,
      confirmColor: '#e34d59',
      success: async (res) => {
        if (!res.confirm) {
          this._loadData();
          return;
        }
        try {
          const deleteIds = new Set(orderItems.map((oi) => oi.id));
          for (const oi of orderItems) {
            await orderApi.deleteItem(oi.id);
          }
          const allOrders = this.data.allOrders.map((order) => ({
            ...order,
            items: order.items.filter((item) => !deleteIds.has(item.id)),
          })).filter((order) => order.items.length > 0);
          this.setData({ allOrders });
          this._buildAllViews(allOrders);
          Toast({theme:'success', context: this, selector: '#t-toast', message: '已删除' });
        } catch (err) {
          console.error('删除失败:', err);
          Toast({theme:'error', context: this, selector: '#t-toast', message: '删除失败' });
        }
      },
    });
  },

  /**
   * 一键审核所有 pending 订单
   * 审核完成后会重新拉取服务端数据，根据最新状态刷新整个页面
   */
  onApproveAll() {
    wx.showModal({
      title: '确认审核',
      content: '确认审核通过所有待处理订单？',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          this.setData({ loading: true });
          const orders = this.data.allOrders.filter((o) => o.status === 'pending');
          for (const order of orders) {
            await orderApi.approveRequest(order.id);
          }
          Toast({theme:'success', context: this, selector: '#t-toast', message: '审核通过' });
          // 重新从服务端获取最新数据，刷新整个页面状态
          await this._refreshPage();
        } catch (err) {
          console.error('审核失败:', err);
          Toast({theme:'error', context: this, selector: '#t-toast', message: '审核失败' });
          // 即使部分审核失败也刷新页面，展示最新状态
          await this._refreshPage();
        }
      },
    });
  },

  /**
   * 发送给单个供应商
   */
  onSendToSupplier(e) {
    const supplier = e.currentTarget.dataset.supplier;
    wx.navigateTo({
      url: `/pages/send-order/send-order?supplierId=${supplier.id}&supplierName=${encodeURIComponent(supplier.name)}`,
    });
  },

  /**
   * 一键发送所有供应商
   */
  onSendAll() {
    wx.navigateTo({
      url: '/pages/send-order/send-order?mode=all',
    });
  },
});
