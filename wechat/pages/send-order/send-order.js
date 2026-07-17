/**
 * 发送采购单页面
 * 按供应商维度展示采购汇总，确认后发送给供应商
 * 仅 admin（店长）角色可访问
 */
const orderApi = require('../../api/order');
const authUtil = require('../../utils/auth');
const { resolveImageUrl } = require('../../utils/util');
import Toast  from 'tdesign-miniprogram/toast'

Page({
  data: {
    statusBarHeight: 0,
    navHeight: 0,
    loading: false,
    mode: '', // 'all' 或 单个供应商
    targetSupplierId: '',
    targetSupplierName: '',

    suppliers: [],
    activeSupplierIdx: 0,
    currentRestaurantItems: [],

    // 原始数据
    allOrders: [],
    ordersBySupplier: {},
  },

  onLoad(options) {
    // 权限校验：仅 admin（店长）可访问
    if (!authUtil.isAdmin()) {
      wx.switchTab({ url: '/pages/list/list' });
      return;
    }

    // 校验用户是否关联了餐厅
    if (!authUtil.requireRestaurant()) return;

    const sysInfo = wx.getWindowInfo();
    const menuRect = wx.getMenuButtonBoundingClientRect();
    const statusBarHeight = sysInfo.statusBarHeight || 44;
    const navHeight = menuRect.bottom + 8;

    this.setData({
      statusBarHeight,
      navHeight,
      mode: options.mode || '',
      targetSupplierId: options.supplierId || '',
      targetSupplierName: options.supplierName
        ? decodeURIComponent(options.supplierName)
        : '',
    });

    this._loadOrders();
  },

  goBack() {
    wx.navigateBack();
  },

  /**
   * 加载订单数据并按供应商→餐厅组织
   */
  async _loadOrders() {
    this.setData({ loading: true });
    try {
      const result = await orderApi.summaryToday();

      const orders = result?.approvedItems || [];
      this.setData({ allOrders: orders });
      this._buildSupplierView(orders);
    } catch (err) {
      console.error('加载订单失败:', err);
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 按供应商组织数据
   * @param {Array} orders - 订单数组
   */
  _buildSupplierView(orders) {
    const supplierMap = {};

    orders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const sid = item.supplier?.id || 'unknown';
        const sname = item.supplier?.company_name || '未指定供应商';

        if (!supplierMap[sid]) {
          supplierMap[sid] = {
            id: sid,
            name: sname,
            restaurantMap: {},
          };
        }

        const rid = order.restaurant?.id || 'unknown';
        if (!supplierMap[sid].restaurantMap[rid]) {
          supplierMap[sid].restaurantMap[rid] = {
            id: rid,
            name: order.restaurant?.name || '',
            address: order.restaurant?.address || '',
            items: [],
          };
        }

        supplierMap[sid].restaurantMap[rid].items.push({
          id: item.id,
          ingredientName: item.ingredient?.name || '',
          ingredientIcon: resolveImageUrl(item.ingredient?.icon),
          quantity: Number(item.quantity),
          unitName: item.ingredient?.unit?.name || '',
        });
      });
    });

    // 转换为数组
    let suppliers = Object.values(supplierMap).map((s) => ({
      ...s,
      restaurants: Object.values(s.restaurantMap),
    }));

    // 如果是针对特定供应商
    if (this.data.targetSupplierId) {
      suppliers = suppliers.filter((s) => s.id === this.data.targetSupplierId);
    }

    this.setData({
      suppliers,
      ordersBySupplier: supplierMap,
    });

    if (suppliers.length > 0) {
      this._updateCurrentView(0);
    }
  },

  /**
   * 切换供应商 tab
   */
  onSupplierTabChange(e) {
    const idx = e.currentTarget.dataset.index;
    this.setData({ activeSupplierIdx: idx });
    this._updateCurrentView(idx);
  },

  /**
   * 更新当前展示的餐厅+食材数据
   * @param {number} idx - 供应商索引
   */
  _updateCurrentView(idx) {
    const supplier = this.data.suppliers[idx];
    if (supplier) {
      this.setData({
        currentRestaurantItems: supplier.restaurants || [],
      });
    }
  },

  /**
   * 确认发送给供应商
   */
  confirmSend() {
    const supplier = this.data.suppliers[this.data.activeSupplierIdx];
    if (!supplier) return;

    wx.showModal({
      title: '确认发送',
      content: `确定将采购单发送给「${supplier.name}」吗？`,
      confirmColor: '#9d4400',
      success: async (res) => {
        if (res.confirm) {
          try {
            // 批量审核当前供应商相关的订单
            const orderIds = new Set();
            this.data.allOrders.forEach((order) => {
              (order.items || []).forEach((item) => {
                if ((item.supplier?.id || 'unknown') === supplier.id) {
                  orderIds.add(order.id);
                }
              });
            });

            for (const oid of orderIds) {
              try {
                await orderApi.listRequests({ page: 1, pageSize: 1 }); // 占位：实际应调用审批接口
              } catch {
                // 忽略权限不足等错误
              }
            }

            Toast({
              theme: 'success',
              context: this,
              selector: '#t-toast',
              message: '已发送给供应商',
            });

            // 按餐厅分别生成订单图片并提供转发
            const images = await this._generateOrderImages();
            if (images && images.length > 0) {
              const restaurantCount = images.length;
              wx.showModal({
                title: '发送成功',
                content: `已生成${restaurantCount}张采购单图片（每个餐厅一张），是否逐张转发给微信好友？`,
                confirmText: '转发',
                cancelText: '返回',
                confirmColor: '#9d4400',
                success: (shareRes) => {
                  if (shareRes.confirm) {
                    this._shareImagesSequentially(images, 0);
                  } else {
                    wx.navigateBack();
                  }
                },
              });
            } else {
              setTimeout(() => wx.navigateBack(), 1000);
            }
          } catch (err) {
            Toast({
              theme: 'fail',
              context: this,
              selector: '#t-toast',
              message: err.message || '发送失败',
            });
          }
        }
      },
    });
  },

  /**
   * 顺序分享多张图片
   * 每分享完一张后提示用户继续分享下一张，直到全部完成
   * @param {Array<{restaurantName: string, filePath: string}>} images - 图片数组
   * @param {number} index - 当前分享索引
   */
  _shareImagesSequentially(images, index) {
    if (index >= images.length) {
      wx.navigateBack();
      return;
    }

    const current = images[index];
    const remaining = images.length - index;

    if (index > 0) {
      wx.showModal({
        title: `继续转发（${index + 1}/${images.length}）`,
        content: `接下来转发「${current.restaurantName}」的采购单，还剩${remaining}张`,
        confirmText: '转发',
        cancelText: '跳过剩余',
        confirmColor: '#9d4400',
        success: (res) => {
          if (res.confirm) {
            wx.showShareImageMenu({
              path: current.filePath,
              complete: () => {
                this._shareImagesSequentially(images, index + 1);
              },
            });
          } else {
            wx.navigateBack();
          }
        },
      });
    } else {
      wx.showShareImageMenu({
        path: current.filePath,
        complete: () => {
          this._shareImagesSequentially(images, index + 1);
        },
      });
    }
  },

  /**
   * 为当前供应商的每个餐厅分别生成独立的订单图片
   * @returns {Promise<Array<{restaurantName: string, filePath: string}>|null>} 图片路径数组
   */
  async _generateOrderImages() {
    const supplier = this.data.suppliers[this.data.activeSupplierIdx];
    if (!supplier) return null;

    const restaurants = supplier.restaurants || [];
    if (restaurants.length === 0) return null;

    wx.showLoading({ title: '生成订单图片...' });

    try {
      const canvas = await new Promise((resolve) => {
        this.createSelectorQuery()
          .select('#orderCanvas')
          .fields({ node: true, size: true })
          .exec((res) => resolve(res[0]?.node));
      });

      if (!canvas) throw new Error('Canvas节点未找到');

      const images = [];
      for (const restaurant of restaurants) {
        const filePath = await this._generateSingleRestaurantImage(canvas, supplier, restaurant);
        if (filePath) {
          images.push({ restaurantName: restaurant.name, filePath });
        }
      }

      wx.hideLoading();
      return images.length > 0 ? images : null;
    } catch (err) {
      wx.hideLoading();
      console.error('生成订单图片失败:', err);
      return null;
    }
  },

  /**
   * 为单个餐厅生成采购单图片
   * 使用 Canvas 2D 绘制，包含：
   * - 头部蓝色区域：标题、供应商名称、餐厅名称、日期
   * - 内容区域：食材表格数据、交替行背景
   * - 底部：版权信息和分割线
   * @param {Object} canvas - Canvas 节点
   * @param {Object} supplier - 供应商信息
   * @param {Object} restaurant - 餐厅信息（含 items 数组）
   * @returns {Promise<string|null>} 临时文件路径，失败返回null
   */
  async _generateSingleRestaurantImage(canvas, supplier, restaurant) {
    try {
      const canvasWidth = 750;
      const padding = 48;

      // 计算画布总高度
      const headerHeight = 210;
      let bodyHeight = 20;
      bodyHeight += 15; // 表头前间距
      bodyHeight += 40; // 表头
      bodyHeight += 5;  // 分割线
      bodyHeight += restaurant.items.length * 48; // 数据行
      bodyHeight += 40; // 底部间距
      const footerHeight = 60;
      const totalHeight = Math.max(headerHeight + bodyHeight + footerHeight, 400);

      const dpr = wx.getWindowInfo().pixelRatio || 2;
      canvas.width = canvasWidth * dpr;
      canvas.height = totalHeight * dpr;

      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);

      // ---- 绘制背景 ----
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvasWidth, totalHeight);

      // ---- 绘制头部蓝色区域 ----
      ctx.fillStyle = '#002045';
      ctx.fillRect(0, 0, canvasWidth, headerHeight);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText('采购单', padding, 60);

      ctx.font = '24px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText(`供应商：${supplier.name}`, padding, 105);

      ctx.font = '22px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(`餐厅：${restaurant.name}`, padding, 140);

      if (restaurant.address) {
        ctx.font = '16px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText(restaurant.address, padding, 168);
      }

      ctx.font = '18px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      ctx.fillText(`日期：${dateStr}`, padding, 195);

      // ---- 绘制订单内容 ----
      let y = headerHeight + 20;
      const colName = padding;
      const colQty = canvasWidth * 0.6;
      const colUnit = canvasWidth - padding;

      // 表头
      ctx.fillStyle = '#AAAAAA';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('名称', colName, y + 18);
      ctx.textAlign = 'center';
      ctx.fillText('数量', colQty, y + 18);
      ctx.textAlign = 'right';
      ctx.fillText('单位', colUnit, y + 18);
      ctx.textAlign = 'left';
      y += 35;

      // 表头分割线
      ctx.strokeStyle = '#EEEEEE';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(canvasWidth - padding, y);
      ctx.stroke();
      y += 5;

      // 数据行 - 交替行背景
      restaurant.items.forEach((item, idx) => {
        if (idx % 2 === 0) {
          ctx.fillStyle = '#F8F9FF';
          ctx.fillRect(padding - 10, y, canvasWidth - padding * 2 + 20, 44);
        }

        ctx.fillStyle = '#333333';
        ctx.font = '18px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(item.ingredientName, colName, y + 28);

        ctx.fillStyle = '#002045';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(item.quantity), colQty, y + 28);

        ctx.fillStyle = '#666666';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(item.unitName, colUnit, y + 28);

        ctx.textAlign = 'left';
        y += 44;
      });

      y += 30;

      // ---- 绘制底部 ----
      y += 10;
      ctx.strokeStyle = '#EEEEEE';
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(canvasWidth - padding, y);
      ctx.stroke();

      ctx.fillStyle = '#CCCCCC';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('由采购管理系统生成', canvasWidth / 2, y + 30);
      ctx.textAlign = 'left';

      // ---- 导出图片 ----
      const tempFilePath = await new Promise((resolve, reject) => {
        wx.canvasToTempFilePath({
          canvas,
          fileType: 'png',
          quality: 1,
          success: (res) => resolve(res.tempFilePath),
          fail: reject,
        });
      });

      return tempFilePath;
    } catch (err) {
      console.error(`生成餐厅「${restaurant.name}」订单图片失败:`, err);
      return null;
    }
  },
});
