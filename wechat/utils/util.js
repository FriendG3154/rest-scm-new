const formatTime = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return `${[year, month, day].map(formatNumber).join('/')} ${[hour, minute, second].map(formatNumber).join(':')}`
}

const formatNumber = n => {
  n = n.toString()
  return n[1] ? n : `0${n}`
}

/**
 * 将服务端返回的图片相对路径转为绝对URL
 * @param {string} url - 服务端返回的图片路径，可能是相对路径或完整URL
 * @returns {string} 完整图片URL，空值返回空字符串
 */
const resolveImageUrl = (url) => {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  const envVersion = typeof __wxConfig !== 'undefined' ? __wxConfig.envVersion : 'develop'
  const serverBase = envVersion === 'release'
    ? 'http://101.133.137.118:3000'
    : 'http://101.133.137.118:3000'
  return `${serverBase}${url.startsWith('/') ? '' : '/'}${url}`
}

module.exports = {
  formatTime,
  resolveImageUrl
}
