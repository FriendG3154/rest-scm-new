const authUtil = require('../utils/auth');

Component({
  data: {
    active: 0,
    list: [],
  },

  lifetimes: {
    attached() {
      this._buildTabs();
    },
  },

  methods: {
    /**
     * 根据用户角色动态构建TabBar列表
     * admin（店长）：清单 + 汇总 + 个人
     * user（员工）：清单 + 个人
     */
    _buildTabs() {
      const list = [
        { icon: 'view-list', label: '清单', url: '/pages/list/list' },
      ];

      if (authUtil.isAdmin()) {
        list.push({ icon: 'chart-bar', label: '汇总', url: '/pages/summary/summary' });
      }

      list.push({ icon: 'user', label: '个人', url: '/pages/profile/profile' });

      this.setData({ list });
    },

    onChange(e) {
      const idx = e.currentTarget.dataset.index;
      this.setData({ active: idx });
      wx.switchTab({ url: this.data.list[idx].url });
    },

    /**
     * 根据页面URL设置当前激活的tab
     * @param {string} url - 页面路径，如 '/pages/list/list'
     */
    setActiveByUrl(url) {
      const idx = this.data.list.findIndex(item => item.url === url);
      if (idx >= 0) {
        this.setData({ active: idx });
      }
    },

    /**
     * 由页面调用，设置当前激活的 tab
     * @param {number} idx - tab 索引
     */
    setActive(idx) {
      this.setData({ active: idx });
    },
  },
});
