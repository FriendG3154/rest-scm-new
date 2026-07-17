/**
 * 个人中心页面
 * 展示用户信息、关联餐厅、退出登录
 */
const authUtil = require('../../utils/auth');
const Toast = require('tdesign-miniprogram/toast/index');

Page({
  data: {
    statusBarHeight: 0,
    navHeight: 0,
    userInfo: {},
    roleLabel: '',
    restaurants: [],
    currentRestaurant: null,
  },

  onLoad() {
    const sysInfo = wx.getWindowInfo();
    const menuRect = wx.getMenuButtonBoundingClientRect();
    const statusBarHeight = sysInfo.statusBarHeight || 44;
    const navHeight = menuRect.bottom + 8;

    this.setData({ statusBarHeight, navHeight });
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setActiveByUrl('/pages/profile/profile');
    }
    this._loadUserInfo();
  },

  /**
   * 加载用户信息
   */
  _loadUserInfo() {
    const userInfo = authUtil.getUserInfo() || {};
    const currentRestaurant = authUtil.getCurrentRestaurant();

    this.setData({
      userInfo,
      roleLabel: authUtil.getRoleLabel(userInfo.role),
      restaurants: userInfo.restaurants || [],
      currentRestaurant,
    });
  },

  /**
   * 退出登录
   */
  handleLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      confirmColor: '#ba1a1a',
      success: (res) => {
        if (res.confirm) {
          authUtil.clearLoginInfo();
          wx.reLaunch({ url: '/pages/login/login' });
        }
      },
    });
  },
});
