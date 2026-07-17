/**
 * 登录页
 * 支持手机号+密码登录和微信手机号快捷登录
 */
const authApi = require('../../api/auth');
const authUtil = require('../../utils/auth');
import Toast from 'tdesign-miniprogram/toast';

Page({
  data: {
    phone: '',
    password: '',
    showPassword: false,
    loading: false,
    wechatLoading: false,
    agreed: false,
    phoneFocus: false,
    passwordFocus: false,
    canLogin: false,
  },

  onLoad() {
    // 如果已登录，直接跳转
    if (authUtil.isLoggedIn()) {
      wx.switchTab({ url: '/pages/list/list' });
    }
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
    this._checkCanLogin();
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
    this._checkCanLogin();
  },

  onPhoneFocus() {
    this.setData({ phoneFocus: true });
  },

  onPhoneBlur() {
    this.setData({ phoneFocus: false });
  },
  watchService(){
    wx.openPrivacyContract({
      success: () => {}, // 打开成功
      fail: () => {}, // 打开失败
      complete: () => {}
    })
  },

  onPasswordFocus() {
    this.setData({ passwordFocus: true });
  },

  onPasswordBlur() {
    this.setData({ passwordFocus: false });
  },

  togglePassword() {
    this.setData({ showPassword: !this.data.showPassword });
  },

  onAgreeChange(e) {
    this.setData({ agreed: e.detail.checked });
    this._checkCanLogin();
  },

  /**
   * 检查是否可以登录
   */
  _checkCanLogin() {
    const { phone, password, agreed } = this.data;
    this.setData({
      canLogin: phone.length >= 11 && password.length >= 1 && agreed,
    });
  },

  /**
   * 手机号+密码登录
   */
  async handleLogin() {
    if(!this.data.agreed){
      Toast({
        context: this,
        selector: '#t-toast',
        message: '请先阅读隐私政策',
      });
      return;
    }
    const { phone, password, loading } = this.data;

    if (loading) return;

    if (!phone || phone.length < 11) {
      Toast({
        context: this,
        selector: '#t-toast',
        message: '请输入正确的手机号',
        theme: 'info',
      });
      return;
    }

    if (!password) {
      Toast({
        context: this,
        selector: '#t-toast',
        message: '请输入密码',
        theme: 'info',
      });
      return;
    }

    this.setData({ loading: true });

    try {
      const result = await authApi.mobileLogin(phone, password);
      authUtil.saveLoginInfo(result);
      Toast({
        context: this,
        selector: '#t-toast',
        message: '登录成功',
        theme: 'success',
      });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/list/list' });
      }, 500);
    } catch (err) {
      Toast({
        theme:'fail',
        context: this,
        selector: '#t-toast',
        message: err.message || '登录失败',
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 微信手机号快捷登录
   * 通过 button open-type="getPhoneNumber" 触发
   * 流程：获取手机号 code → wx.login() 获取登录 code → 后端自动匹配用户并登录
   * @param {object} e - getPhoneNumber 事件对象
   */
  async getPhoneNumber(e) {
    
    // 用户拒绝授权
    if (e.detail.errMsg !== 'getPhoneNumber:ok' || !e.detail.code) {
      Toast({
        context: this,
        selector: '#t-toast',
        message: '需要授权手机号才能登录',
        theme: 'info',
      });
      return;
    }
    if(!this.data.agreed){
      Toast({
        context: this,
        selector: '#t-toast',
        message: '请先阅读隐私政策',
      });
      return;
    }
    if (this.data.wechatLoading) return;
    this.setData({ wechatLoading: true });

    try {
      const phoneCode = e.detail.code;

      // 1. 调用 wx.login 获取登录 code
      const loginRes = await new Promise((resolve, reject) => {
        wx.login({
          success: resolve,
          fail: reject,
        });
      });

      if (!loginRes.code) {
        throw new Error('获取微信登录凭证失败');
      }

      // 2. 调用后端微信登录接口（传递登录 code + 手机号 code）
      const result = await authApi.wechatLogin(loginRes.code, phoneCode);

      // 3. 登录成功
      authUtil.saveLoginInfo(result);
      Toast({
        context: this,
        selector: '#t-toast',
        message: '登录成功',
        theme: 'success',
      });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/list/list' });
      }, 500);
    } catch (err) {
      Toast({
        theme:'fail',
        context: this,
        selector: '#t-toast',
        message:  '账号不存在',
      });
    } finally {
      this.setData({ wechatLoading: false });
    }
  },
});
