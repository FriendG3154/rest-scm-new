/**
 * 需求清单页面
 * 展示当前餐厅的报货清单，支持按供应商分组显示，编辑数量，导入模板
 */
const orderApi = require('../../api/order');
const ingredientApi = require('../../api/ingredient');
const authUtil = require('../../utils/auth');
const { resolveImageUrl } = require('../../utils/util');
import Toast from 'tdesign-miniprogram/toast'

Page({
  data: {
    statusBarHeight: 0,
    navHeight: 0,
    userInfo: null,
    currentRestaurant: null,
    today: '',
    loading: false,
    refreshing: false,

    // 订单数据
    orderItems: [],
    groupedItems: [],

    // 餐厅选择
    showRestaurantSheet: false,
    restaurantActions: [],

    // 是否已审核（审核后禁止编辑和添加）
    isApproved: false,

    // 导入清单
    showImport: false,
    ingredientList: [],
    filteredIngredientList: [],
    importSearchKey: '',
    selectedIngredients: [],
    selectedMap: {},
    ingredientSelectedMap: {},
    selectedCount: 0,
    swipeOpenId: '',

    // 供应商选择弹窗
    showSupplierPicker: false,
    supplierPickerList: [],
    supplierPickerIngredient: null,
    supplierPickerSelected: [],
  },

  onLoad() {
    const sysInfo = wx.getWindowInfo();
    const menuRect = wx.getMenuButtonBoundingClientRect();
    const statusBarHeight = sysInfo.statusBarHeight || 44;
    const navHeight = menuRect.bottom + 20;

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    this.setData({
      statusBarHeight,
      navHeight,
      today,
      userInfo: authUtil.getUserInfo(),
      currentRestaurant: authUtil.getCurrentRestaurant(),
    });
  },

  onShow() {
    // 设置自定义 tabbar 激活状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setActiveByUrl('/pages/list/list');
    }

    // 校验用户是否关联了餐厅
    if (!authUtil.requireRestaurant()) return;

    // 校验当前选中的餐厅是否有权限访问
    const currentRestaurant = authUtil.getCurrentRestaurant();
    if (currentRestaurant && !authUtil.hasRestaurantAccess(currentRestaurant.id)) {
      // 当前餐厅无权限，尝试切换到有权限的餐厅
      const user = authUtil.getUserInfo();
      if (user && user.restaurants && user.restaurants.length > 0) {
        authUtil.setCurrentRestaurant(user.restaurants[0]);
        this.setData({ currentRestaurant: user.restaurants[0] });
      } else {
        authUtil.assertRestaurantAccess(currentRestaurant.id);
        return;
      }
    }

    this._loadOrders();
  },

  onRefresh() {
    this.setData({ refreshing: true });
    this._loadOrders().finally(() => {
      this.setData({ refreshing: false });
    });
  },

  /**
   * 加载订单列表
   */
  async _loadOrders() {
    const { currentRestaurant } = this.data;
    if (!currentRestaurant) return;

    this.setData({ loading: true });
    try {
      const result = await orderApi.listRequests({
        restaurant_id: currentRestaurant.id,
        status: 'pending',
        page: 1,
        pageSize: 100,
      });

      // 提取所有订单项并按供应商分组
      const allItems = [];
      if (result && result.items) {
        result.items.forEach((order) => {
          if (order.items) {
            order.items.forEach((item) => {
              allItems.push({
                ...item,
                orderId: order.id,
                quantity: Number(item.quantity),
                ingredient: {
                  ...item.ingredient,
                  icon: resolveImageUrl(item.ingredient?.icon),
                },
              });
            });
          }
        });
      }

      // 检查今日是否已有审核通过的订单
      let isApproved = false;
      if (allItems.length === 0) {
        try {
          const approvedResult = await orderApi.listRequests({
            restaurant_id: currentRestaurant.id,
            status: 'approved',
            page: 1,
            pageSize: 1,
          });
          if (approvedResult && approvedResult.items && approvedResult.items.length > 0) {
            isApproved = true;
          }
        } catch (e) {
          console.error('检查审核状态失败:', e);
        }
      }

      this.setData({
        orderItems: allItems,
        groupedItems: this._groupBySupplier(allItems),
        isApproved,
      });
    } catch (err) {
      console.error('加载订单失败:', err);
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 按供应商分组
   * @param {Array} items - 订单项数组
   * @returns {Array} 分组后的数据
   */
  _groupBySupplier(items) {
    const groups = {};
    items.forEach((item) => {
      const supplierId = item.supplier?.id || 'unknown';
      const supplierName = item.supplier?.company_name || '未指定供应商';
      if (!groups[supplierId]) {
        groups[supplierId] = {
          supplierId,
          supplierName,
          items: [],
        };
      }
      groups[supplierId].items.push(item);
    });
    return Object.values(groups);
  },

  /**
   * 修改数量（审核后禁止操作），校验单位范围限制
   */
  async onQuantityChange(e) {
    if (this.data.isApproved) return;
    const id = e.currentTarget.dataset.id;
    const item = e.currentTarget.dataset.item;
    const quantity = parseFloat(e.detail.value);
    if (!quantity || quantity <= 0) {
      Toast({ theme:'info',  context: this, selector: '#t-toast', message: '数量必须大于0' })
      this._loadOrders();
      return;
    }
    // 校验单位范围
    const unit = item?.ingredient?.unit;
    if (unit) {
      const minVal = unit.min_value !== null && unit.min_value !== undefined ? Number(unit.min_value) : null;
      const maxVal = unit.max_value !== null && unit.max_value !== undefined ? Number(unit.max_value) : null;
      if (minVal !== null && quantity < minVal) {
        Toast({ theme:'info', context: this, selector: '#t-toast', message: `数量不能小于 ${minVal}${unit.name}` });
        await orderApi.updateItem(id, minVal);

        this._loadOrders();
        return;
      }
      if (maxVal !== null && quantity > maxVal) {
        Toast({ theme:'info', context: this, selector: '#t-toast', message: `数量不能大于 ${maxVal}${unit.name}` });
        await orderApi.updateItem(id, maxVal);
        this._loadOrders();
        return;
      }
    }
    try {
      await orderApi.updateItem(id, quantity);
    } catch (err) {
        Toast({ theme:'fail', context: this, selector: '#t-toast', message: err.message || '更新失败' });
      this._loadOrders();
    }
  },

  /**
   * 左滑删除 - 触摸开始（审核后禁止操作）
   */
  onTouchStart(e) {
    if (this.data.isApproved) return;
    this._touchStartX = e.touches[0].clientX;
    this._touchStartY = e.touches[0].clientY;
    this._swiping = false;
  },

  /**
   * 左滑删除 - 触摸移动
   */
  onTouchMove(e) {
    const dx = e.touches[0].clientX - this._touchStartX;
    const dy = e.touches[0].clientY - this._touchStartY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 20) {
      this._swiping = true;
    }
  },

  /**
   * 左滑删除 - 触摸结束
   */
  onTouchEnd(e) {
    const dx = e.changedTouches[0].clientX - this._touchStartX;
    const item = e.currentTarget.dataset.item;
    if (this._swiping && dx < -60) {
      // 左滑超过60px，打开删除按钮
      this.setData({ swipeOpenId: item.id });
    } else {
      // 右滑或点击，关闭删除按钮
      this.setData({ swipeOpenId: '' });
    }
  },

  /**
   * 点击删除按钮
   */
  async onSwipeDelete(e) {
    const item = e.currentTarget.dataset.item;
    try {
      await orderApi.deleteItem(item.id);
      this.setData({ swipeOpenId: '' });
      Toast({ theme:'success', context: this, selector: '#t-toast', message: '已删除' });
      this._loadOrders();
    } catch (err) {
      Toast({ theme:'fail', context: this, selector: '#t-toast', message: err.message || '删除失败' });
    }
  },

  // ========== 餐厅选择 ==========
  showRestaurantPicker() {
    const user = authUtil.getUserInfo();
    if (!user || !user.restaurants) return;

    const actions = user.restaurants.map((r) => ({
      label: r.name,
      id: r.id,
    }));

    this.setData({
      showRestaurantSheet: true,
      restaurantActions: actions,
    });
  },

  hideRestaurantPicker() {
    this.setData({ showRestaurantSheet: false });
  },

  onRestaurantSelect(e) {
    const { index } = e.detail;
    const user = authUtil.getUserInfo();
    const restaurant = user.restaurants[index];
    if (restaurant) {
      // 校验用户是否有权访问该餐厅
      if (!authUtil.hasRestaurantAccess(restaurant.id)) {
        wx.showToast({ title: '您没有该餐厅的操作权限', icon: 'none' });
        this.setData({ showRestaurantSheet: false });
        return;
      }
      authUtil.setCurrentRestaurant(restaurant);
      this.setData({
        currentRestaurant: restaurant,
        showRestaurantSheet: false,
      });
      this._loadOrders();
    }
  },

  // ========== 导入清单 ==========
  showImportSheet() {
    if (this.data.isApproved) {
      Toast({ theme: 'info', context: this, selector: '#t-toast', message: '今日清单已审核，无法添加食材' });
      return;
    }
    this.setData({ showImport: true, selectedIngredients: [], selectedMap: {}, ingredientSelectedMap: {}, selectedCount: 0, importSearchKey: '' });
    this._loadIngredients();
  },

  /**
   * 导入清单搜索框输入事件
   * @param {Object} e - 输入事件对象
   */
  onImportSearchChange(e) {
    const keyword = (e.detail.value || '').trim().toLowerCase();
    this.setData({ importSearchKey: e.detail.value || '' });
    this._filterIngredientList(keyword);
  },

  /**
   * 根据关键字过滤食材列表
   * @param {string} keyword - 搜索关键字
   */
  _filterIngredientList(keyword) {
    const list = this.data.ingredientList;
    if (!keyword) {
      this.setData({ filteredIngredientList: list });
      return;
    }
    const filtered = list.filter((ing) => {
      const name = (ing.name || '').toLowerCase();
      const category = (ing.category?.name || '').toLowerCase();
      return name.includes(keyword) || category.includes(keyword);
    });
    this.setData({ filteredIngredientList: filtered });
  },

  hideImportSheet() {
    this.setData({ showImport: false });
  },

  onImportVisibleChange(e) {
    this.setData({ showImport: e.detail.visible });
  },

  async _loadIngredients() {
    try {
      const result = await ingredientApi.listAll();
      const rawItems = Array.isArray(result) ? result : (result?.items || []);
      const items = rawItems.map((item) => ({
        ...item,
        icon: resolveImageUrl(item.icon),
      }));

      // 回显：将清单中已存在的食材-供应商对预选中
      const selectedIngredients = [];
      const selectedMap = {};
      const ingredientSelectedMap = {};
      this.data.orderItems.forEach((oi) => {
        const ingId = oi.ingredient_id || oi.ingredient?.id;
        const supId = oi.supplier_id || oi.supplier?.id;
        if (ingId && items.some((ing) => ing.id === ingId)) {
          const key = `${ingId}_${supId}`;
          if (!selectedMap[key]) {
            selectedIngredients.push({ ingredient_id: ingId, supplier_id: supId });
            selectedMap[key] = true;
            ingredientSelectedMap[ingId] = (ingredientSelectedMap[ingId] || 0) + 1;
          }
        }
      });

      this.setData({
        ingredientList: items,
        filteredIngredientList: items,
        selectedIngredients,
        selectedMap,
        ingredientSelectedMap,
        selectedCount: selectedIngredients.length,
      });
    } catch (err) {
      console.error('加载食材列表失败:', err);
    }
  },

  toggleIngredient(e) {
    const id = e.currentTarget.dataset.id;
    const ing = this.data.ingredientList.find((i) => i.id === id);
    if (!ing) return;

    if (ing.suppliers && ing.suppliers.length > 1) {
      // 多个供应商，弹窗让用户多选，默认供应商排第一
      const sorted = [...ing.suppliers].sort((a, b) => {
        if (a.is_default && !b.is_default) return -1;
        if (!a.is_default && b.is_default) return 1;
        return 0;
      });
      // 预选当前已选中的供应商
      const currentSelected = sorted
        .filter((s) => this.data.selectedMap[`${id}_${s.supplier_id}`])
        .map((s) => s.supplier_id);
      this.setData({
        showSupplierPicker: true,
        supplierPickerList: sorted,
        supplierPickerIngredient: ing,
        supplierPickerSelected: currentSelected,
      });
    } else {
      // 0或1个供应商，直接切换选中
      const selected = [...this.data.selectedIngredients];
      const map = { ...this.data.selectedMap };
      const ingMap = { ...this.data.ingredientSelectedMap };
      const supplierId = ing.suppliers?.[0]?.supplier_id || null;
      const key = `${id}_${supplierId}`;

      const existIdx = selected.findIndex((s) => s.ingredient_id === id && s.supplier_id === supplierId);
      if (existIdx >= 0) {
        selected.splice(existIdx, 1);
        delete map[key];
        delete ingMap[id];
      } else {
        selected.push({ ingredient_id: id, supplier_id: supplierId });
        map[key] = true;
        ingMap[id] = 1;
      }

      this.setData({
        selectedIngredients: selected,
        selectedMap: map,
        ingredientSelectedMap: ingMap,
        selectedCount: selected.length,
      });
    }
  },

  /**
   * 供应商选择弹窗 - 选中
   */
  onSupplierPickerChange(e) {
    this.setData({ supplierPickerSelected: e.detail.value });
  },

  /**
   * 供应商选择弹窗 - 确认（多选）
   */
  onSupplierPickerConfirm() {
    const { supplierPickerIngredient, supplierPickerSelected } = this.data;
    if (!supplierPickerIngredient) return;

    const id = supplierPickerIngredient.id;
    let selected = [...this.data.selectedIngredients];
    const map = { ...this.data.selectedMap };
    const ingMap = { ...this.data.ingredientSelectedMap };

    // 移除该食材的所有旧选择
    selected = selected.filter((s) => s.ingredient_id !== id);
    Object.keys(map).forEach((key) => {
      if (key.startsWith(`${id}_`)) delete map[key];
    });

    // 添加新选择
    if (supplierPickerSelected.length > 0) {
      supplierPickerSelected.forEach((supplierId) => {
        selected.push({ ingredient_id: id, supplier_id: supplierId });
        map[`${id}_${supplierId}`] = true;
      });
      ingMap[id] = supplierPickerSelected.length;
    } else {
      delete ingMap[id];
    }

    this.setData({
      selectedIngredients: selected,
      selectedMap: map,
      ingredientSelectedMap: ingMap,
      selectedCount: selected.length,
      showSupplierPicker: false,
      supplierPickerList: [],
      supplierPickerIngredient: null,
      supplierPickerSelected: [],
    });
  },

  /**
   * 供应商选择弹窗 - 取消
   */
  onSupplierPickerCancel() {
    this.setData({
      showSupplierPicker: false,
      supplierPickerList: [],
      supplierPickerIngredient: null,
      supplierPickerSelected: [],
    });
  },

  async confirmImport() {
    const { selectedIngredients, currentRestaurant } = this.data;
    if (selectedIngredients.length === 0) {
      Toast({ theme:'info', context: this, selector: '#t-toast', message: '请至少选择一项' });
      return;
    }

    if (!currentRestaurant) {
      Toast({ theme:'info', context: this, selector: '#t-toast', message: '请先选择餐厅' });
      return;
    }

    // 过滤掉清单中已存在的食材-供应商对，只导入新增的
    const existingPairs = new Set();
    this.data.orderItems.forEach((oi) => {
      const ingId = oi.ingredient_id || oi.ingredient?.id;
      const supId = oi.supplier_id || oi.supplier?.id;
      if (ingId) existingPairs.add(`${ingId}_${supId}`);
    });
    const newItems = selectedIngredients.filter(
      (item) => !existingPairs.has(`${item.ingredient_id}_${item.supplier_id}`)
    );
    if (newItems.length === 0) {
      Toast({ theme:'info', context: this, selector: '#t-toast', message: '所选品类已在清单中' });
      return;
    }

    const items = newItems.map((item) => ({
      ingredient_id: item.ingredient_id,
      quantity: 1,
      supplier_id: item.supplier_id,
    }));

    try {
      await orderApi.createRequest(currentRestaurant.id, items);
      Toast({ theme:'success', context: this, selector: '#t-toast', message: '导入成功' });
      this.setData({ showImport: false });
      this._loadOrders();
    } catch (err) {
      Toast({ theme:'fail', context: this, selector: '#t-toast', message: err.message || '导入失败' });
    }
  },
});
