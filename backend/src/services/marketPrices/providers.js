const { safeUrl, clean, MarketInputError } = require('./core');
const PROVIDER = 'SERPAPI_SHOPPING';
function providerStatus(env = process.env) {
  return [
    { id: PROVIDER, name: 'Google Shopping melalui SerpApi', available: Boolean(env.SERPAPI_API_KEY && env.MARKET_SERPAPI_ENABLED === 'true'), reason: env.SERPAPI_API_KEY && env.MARKET_SERPAPI_ENABLED === 'true' ? null : 'Kredensial dan aktivasi penyedia belum dikonfigurasi.', automatic: true },
    ...['Tokopedia', 'Shopee', 'Blibli', 'Distributor'].map(name => ({ id: name.toUpperCase(), name, available: false, automatic: false, reason: 'Integrasi pencarian langsung belum tersedia. Tambahkan listing atau penawaran yang sudah diperiksa.' })),
  ];
}
class ProviderError extends Error {
  constructor(code, retryable = true) { super(code); this.code = code; this.retryable = retryable; }
}
function createShoppingProvider({ env = process.env, fetchImpl = fetch } = {}) {
  return {
    id: PROVIDER,
    getProviderStatus: () => providerStatus(env)[0],
    async searchProducts(item, profile) {
      if (!this.getProviderStatus().available) throw new ProviderError('PROVIDER_UNAVAILABLE', false);
      const q = [profile.expectedBrand, profile.expectedPartNumber, item.name, profile.vehicleCompatibility].filter(Boolean).join(' ').slice(0, 300);
      const u = new URL('https://serpapi.com/search.json');
      u.search = new URLSearchParams({ engine: 'google_shopping', q, gl: 'id', hl: 'id', api_key: env.SERPAPI_API_KEY }).toString();
      let response;
      try { response = await fetchImpl(u, { signal: AbortSignal.timeout(15000), redirect: 'error' }); }
      catch { throw new ProviderError('PROVIDER_TIMEOUT'); }
      if (!response.ok) throw new ProviderError(response.status === 429 ? 'PROVIDER_RATE_LIMIT' : `PROVIDER_HTTP_${response.status}`, response.status === 429 || response.status >= 500);
      const raw = await response.text();
      if (raw.length > 3000000) throw new ProviderError('PROVIDER_RESPONSE_TOO_LARGE', false);
      let payload;
      try { payload = JSON.parse(raw); } catch { throw new ProviderError('PROVIDER_INVALID_RESPONSE'); }
      if (payload.error) throw new ProviderError('PROVIDER_RESPONSE_ERROR', false);
      if (!payload.search_metadata || !['Success', 'Cached'].includes(payload.search_metadata.status)) throw new ProviderError('PROVIDER_INCOMPLETE_RESPONSE');
      // A cached search is an observation from its original creation date, not today.
      const observedAt = new Date(String(payload.search_metadata.created_at || '').replace(' UTC', 'Z').replace(' ', 'T'));
      if (!Number.isFinite(observedAt.getTime()) || observedAt > new Date(Date.now() + 60000)) throw new ProviderError('PROVIDER_MISSING_TIMESTAMP', false);
      const results = [];
      const seen = new Set();
      for (const row of (payload.shopping_results || []).slice(0, 25)) {
        if (!Number.isFinite(row.extracted_price) || row.extracted_price <= 0 || row.extracted_price > 1e12) continue;
        // Do not infer currency from an unlabelled number or treat installment/old prices as a quote.
        if (!/Rp|IDR/i.test(String(row.price || '')) || /cicilan|bulan|installment/i.test(String(row.price || ''))) continue;
        let url;
        try { url = safeUrl(row.link || row.product_link); } catch { continue; }
        if (seen.has(url) || !clean(row.title) || !clean(row.source)) continue;
        seen.add(url);
        results.push({ url, title: clean(row.title, 300), seller: clean(row.source), price: row.extracted_price.toFixed(2), currency: 'IDR', observedAt: observedAt.toISOString(),
          // Search snippets do not establish brand, pack size, tax, compatibility, or stock.
          brand: '', partNumber: '', productType: 'UNKNOWN', condition: row.second_hand_condition ? 'USED' : 'UNKNOWN', packSize: '1', unit: item.unit, taxBasis: 'UNKNOWN', availability: 'UNKNOWN',
          evidence: { searchId: clean(payload.search_metadata.id), externalId: clean(row.product_id) } });
      }
      return results;
    },
    async getProductDetails() { throw new MarketInputError('Penyedia ini menyediakan hasil pencarian. Buka tautan asli untuk memverifikasi detail produk.', 422); },
    async checkPrice(item, profile) { return this.searchProducts(item, profile); },
  };
}
module.exports = { PROVIDER, providerStatus, ProviderError, createShoppingProvider };
