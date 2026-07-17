/**
 * HTTP 请求工具（axios 风格封装）
 * 基于 wx.request 实现，提供拦截器、自动 token 注入、token 刷新等功能
 */

const BASE_URL = (() => {
  const envVersion =
    typeof __wxConfig !== 'undefined' ? __wxConfig.envVersion : 'develop';
  if (envVersion === 'release') {
    // return 'https://www.gingin.top/api/trpc';
    return 'http://101.133.137.118:3000/api/trpc';
  }
  // 开发版/体验版：直连服务器 IP
  return 'http://101.133.137.118:3000/api/trpc';
})();

/** 餐厅权限相关的错误消息，匹配后端 assertRestaurantAccess / restaurantMemberMiddleware */
const RESTAURANT_AUTH_MESSAGES = ['您不属于该餐厅', '您未关联任何餐厅'];

/** 请求队列：token 刷新期间排队的请求 */
let isRefreshing = false;
let requestQueue = [];

/**
 * 执行排队中的请求
 * @param {string} token - 新 token
 */
function processQueue(token) {
  requestQueue.forEach((cb) => cb(token));
  requestQueue = [];
}

/**
 * 发起 tRPC HTTP 请求
 * @param {string} procedure - tRPC 过程名，如 'auth.mobileLogin'
 * @param {'query'|'mutation'} type - 请求类型
 * @param {object} input - 请求参数
 * @returns {Promise<object>} 响应数据
 */
function trpcRequest(procedure, type = 'query', input = undefined) {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token');
    const header = {
      'Content-Type': 'application/json',
    };
    if (token) {
      header['Authorization'] = `Bearer ${token}`;
    }

    let url = `${BASE_URL}/${procedure}`;
    let method = 'GET';
    let data = undefined;

    if (type === 'mutation') {
      method = 'POST';
      data = input !== undefined ? { json: input } : { json: {} };
    } else {
      method = 'GET';
      if (input !== undefined) {
        const encoded = encodeURIComponent(JSON.stringify({ json: input }));
        url = `${url}?input=${encoded}`;
      }
    }

    wx.request({
      url,
      method,
      header,
      data,
      timeout: 15000,
      success(res) {
        if (res.statusCode === 401) {
          // 检查是否为餐厅权限错误（不应尝试刷新 token）
          const restaurantErrMsg =
            res.data?.error?.json?.message || res.data?.error?.message || '';
          const isRestaurantAuthError = RESTAURANT_AUTH_MESSAGES.some(
            (msg) => restaurantErrMsg.includes(msg),
          );
          if (isRestaurantAuthError) {
            wx.removeStorageSync('token');
            wx.removeStorageSync('refreshToken');
            wx.removeStorageSync('userInfo');
            wx.removeStorageSync('currentRestaurant');
            wx.showToast({ title: restaurantErrMsg, icon: 'none', duration: 2000 });
            setTimeout(() => {
              wx.reLaunch({ url: '/pages/login/login' });
            }, 1500);
            reject(new Error(restaurantErrMsg));
            return;
          }

          // token 过期，尝试刷新
          if (!isRefreshing) {
            isRefreshing = true;
            refreshToken()
              .then((newToken) => {
                processQueue(newToken);
                // 用新 token 重试当前请求
                header['Authorization'] = `Bearer ${newToken}`;
                wx.request({
                  url,
                  method,
                  header,
                  data,
                  success(retryRes) {
                    if (retryRes.statusCode >= 200 && retryRes.statusCode < 300) {
                      const retryResult = retryRes.data?.result?.data;
                      resolve(retryResult?.json ?? retryResult);
                    } else {
                      reject(retryRes.data);
                    }
                  },
                  fail: reject,
                });
              })
              .catch(() => {
                processQueue(null);
                // 刷新失败，跳转登录
                wx.removeStorageSync('token');
                wx.removeStorageSync('refreshToken');
                wx.removeStorageSync('userInfo');
                wx.reLaunch({ url: '/pages/login/login' });
                reject(new Error('登录已过期'));
              })
              .finally(() => {
                isRefreshing = false;
              });
          } else {
            // 正在刷新中，加入队列
            return new Promise((qResolve, qReject) => {
              requestQueue.push((newToken) => {
                if (!newToken) {
                  qReject(new Error('登录已过期'));
                  return;
                }
                header['Authorization'] = `Bearer ${newToken}`;
                wx.request({
                  url,
                  method,
                  header,
                  data,
                  success(qRes) {
                    const qResult = qRes.data?.result?.data;
                    qResolve(qResult?.json ?? qResult);
                  },
                  fail: qReject,
                });
              });
            })
              .then(resolve)
              .catch(reject);
          }
          return;
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          const result = res.data?.result?.data;
          resolve(result?.json ?? result);
        } else {
          const errorData = res.data;
          const errMsg =
            errorData?.error?.json?.message ||
            errorData?.error?.message ||
            '请求失败';
          reject(new Error(errMsg));
        }
      },
      fail(err) {
        if (err.errMsg && err.errMsg.indexOf('ERR_CONNECTION') !== -1) {
          reject(new Error('服务器连接失败，请检查网络后重试'));
        } else if (err.errMsg && err.errMsg.indexOf('timeout') !== -1) {
          reject(new Error('请求超时，请稍后重试'));
        } else {
          reject(new Error(err.errMsg || '网络请求失败'));
        }
      },
    });
  });
}

/**
 * 刷新 token
 * @returns {Promise<string>} 新的 token
 */
function refreshToken() {
  const token = wx.getStorageSync('refreshToken');
  if (!token) {
    return Promise.reject(new Error('无 refreshToken'));
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${BASE_URL}/auth.refreshToken`,
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: { json: { refreshToken: token } },
      success(res) {
        if (res.statusCode === 200) {
          const result = res.data?.result?.data?.json ?? res.data?.result?.data;
          if (result?.token) {
            wx.setStorageSync('token', result.token);
            wx.setStorageSync('refreshToken', result.refreshToken);
            resolve(result.token);
          } else {
            reject(new Error('刷新 token 失败'));
          }
        } else {
          reject(new Error('刷新 token 失败'));
        }
      },
      fail: reject,
    });
  });
}

/**
 * tRPC 查询请求
 * @param {string} procedure - 过程名
 * @param {object} input - 查询参数
 * @returns {Promise<object>}
 */
function query(procedure, input) {
  return trpcRequest(procedure, 'query', input);
}

/**
 * tRPC 变更请求
 * @param {string} procedure - 过程名
 * @param {object} input - 变更参数
 * @returns {Promise<object>}
 */
function mutate(procedure, input) {
  return trpcRequest(procedure, 'mutation', input);
}

module.exports = {
  query,
  mutate,
  BASE_URL,
};
