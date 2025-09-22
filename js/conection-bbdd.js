
window.dbReady = (async () => {
  // Load Supabase library if not already present
  if (!window.supabase) {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/dist/umd/supabase.min.js';
    document.head.appendChild(s);
    await new Promise(res => { s.onload = res; });
  }

  if (!window.supabaseCreds) window.supabaseCreds = { url: '', key: '' };

  // Wait for credentials loaded from config.js
  await new Promise(res => {
    if (window.supabaseCreds.url && window.supabaseCreds.key) return res();
    document.addEventListener('credsLoaded', res, { once: true });
  });

  if (!supabaseCreds.url || !supabaseCreds.key) {
    document.addEventListener('DOMContentLoaded', () => {
      if (window.openConfigPopup) window.openConfigPopup();
    });
    await new Promise(res => document.addEventListener('configSaved', res, { once: true }));
  }

  window.supabaseClient = supabase.createClient(supabaseCreds.url, supabaseCreds.key);

  const camel = str => str.replace(/_([a-z])/g, (m, g) => g.toUpperCase());
  const decamel = str => str.replace(/([A-Z])/g, m => '_' + m.toLowerCase());
  const camelKeys = obj => Object.fromEntries(Object.entries(obj).map(([k, v]) => [camel(k), v]));
  const decamelKeys = obj => Object.fromEntries(Object.entries(obj).map(([k, v]) => [decamel(k), v]));
  const sanitizeStrings = o => {
    const out = {};
    Object.entries(o).forEach(([k, v]) => {
      out[k] = typeof v === 'string' ? v : v;
    });
    return out;
  };
  window.sanitizeStrings = sanitizeStrings;

  window.db = {
    async select(table, filter = {}) {
      let q = supabaseClient.from(table).select('*');
      Object.entries(filter).forEach(([k, v]) => { q = q.eq(k, v); });
      const { data, error } = await q;
      if (error) { console.error(error); throw error; }
      return data.map(camelKeys);
    },
    async insert(table, data) {
      data = sanitizeStrings(data);
      const { data: ret, error } = await supabaseClient.from(table).insert(decamelKeys(data)).select();
      if (error) { console.error(error); throw error; }
      return camelKeys(Array.isArray(ret) ? ret[0] : ret);
    },
    async update(table, filter, data) {
      data = sanitizeStrings(data);
      let q = supabaseClient.from(table).update(decamelKeys(data));
      Object.entries(filter).forEach(([k, v]) => { q = q.eq(k, v); });
      const { data: ret, error } = await q.select();
      if (error) { console.error(error); throw error; }
      return camelKeys(Array.isArray(ret) ? ret[0] : ret);
    },
    async delete(table, filter) {
      let q = supabaseClient.from(table).delete();
      Object.entries(filter).forEach(([k, v]) => { q = q.eq(k, v); });
      const { error } = await q;
      if (error) { console.error(error); throw error; }
      return true;
    },
    async selectRange(table, field, start, end) {
      let q = supabaseClient.from(table).select('*');
      if (start !== undefined) q = q.gte(field, start);
      if (end !== undefined) q = q.lte(field, end);
      const { data, error } = await q;
      if (error) { console.error(error); throw error; }
      return data.map(camelKeys);
    }
  };

})();
