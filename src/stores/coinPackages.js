// Cards display the owner-provided USD prices. These labels never replace
// StoreKit's localized transaction price or determine purchase availability.
export const ACTIVE_COIN_PACKAGES = Object.freeze([
  [60, '0.99', 'rblzerghvsqyxkgp'], [120, '1.99', 'mznhzilrvvtggvdi'],
  [300, '3.99', 'vjsbdvylaviugals'], [380, '4.99', 'vbadxyfeihvigwiu'],
  [800, '9.99', 'ypznugdetqagwzja'], [1600, '19.99', 'dcbyodummketgliq'],
  [3200, '49.99', 'cuxjyntanjgosesh'], [6800, '99.99', 'gmuduvxnpwzfitwu'],
].map(([coins, reference_usd, product_id]) => Object.freeze({ package_id: `pkg_${coins}`, coins, product_id, reference_usd, price: '', badge: coins === 300 ? 'Most Popular' : '', image_url: `/static/assets/coins/coins-${coins <= 300 ? coins === 120 ? 60 : coins : 680}.png` })))
export const COIN_PACKAGES = ACTIVE_COIN_PACKAGES
export const configured_coin_package = id => COIN_PACKAGES.find(pack => pack.package_id === id) || null
export function available_coin_packages(products = []) {
  return COIN_PACKAGES.map(pack => {
    const product = products.find(row => row.product_id === pack.product_id && row.package_id === pack.package_id)
    return { ...pack, display_price_usd: `$${pack.reference_usd}`, price: product?.display_price || 'Unavailable', available: !!product, ...(product ? { currency_code: product.currency_code || '', price_amount: product.price_amount ?? null } : {}) }
  })
}
export function normalize_purchase_products(result) {
  if (!result || !Array.isArray(result.products)) throw new Error('Coin packages could not be loaded. Please try again.')
  const found = new Set()
  return result.products.map(product => {
    const pack = COIN_PACKAGES.find(row => row.product_id === product?.product_id)
    if (!pack || product.package_id !== pack.package_id || typeof product.display_price !== 'string' || !product.display_price.trim() || product.display_price.length > 120 || found.has(product.product_id)) throw new Error('The App Store returned an unavailable coin package. Please try again.')
    found.add(product.product_id)
    return { product_id: pack.product_id, package_id: pack.package_id, display_price: product.display_price.trim(), currency_code: typeof product.currency_code === 'string' ? product.currency_code : '', price_amount: Number.isFinite(product.price_amount) ? product.price_amount : null }
  })
}
