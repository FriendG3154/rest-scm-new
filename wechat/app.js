/**
 * Culinary Logic 小程序入口
 */
const auth = require('./utils/auth');

App({
  onLaunch() {
    // 检查登录状态
    if (!auth.isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/login' });
    }
  },

  globalData: {
    userInfo: null,
    currentRestaurant: null,
  },
});
