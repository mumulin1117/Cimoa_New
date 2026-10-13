export const push_route = (url) => new Promise((resolve, reject) => {
  uni.navigateTo({ url, animationType: 'none', animationDuration: 0, success: resolve, fail: reject })
})

export const replace_route = (url) => new Promise((resolve, reject) => {
  uni.redirectTo({ url, animationType: 'none', animationDuration: 0, success: resolve, fail: reject })
})

export const back_route = (delta = 1) => new Promise((resolve, reject) => {
  uni.navigateBack({ delta, animationType: 'none', animationDuration: 0, success: resolve, fail: reject })
})

export const switch_tab_route = (url) => new Promise((resolve, reject) => {
  uni.redirectTo({ url, animationType: 'none', animationDuration: 0, success: resolve, fail: reject })
})

export const route_query = (options = {}) => options
