import { Product, Sale, Tenant } from '../types';

export type LucyLanguage = 'sw' | 'en';

export interface LucyContext {
  activeTenant?: Tenant;
  activeTab?: string;
  products?: Product[];
  sales?: Sale[];
  expenses?: any[];
  surface?: 'dashboard' | 'forecasting' | 'landing';
}

export interface LucyResponse {
  text: string;
  language: LucyLanguage;
  action?: 'NAVIGATE';
  targetTab?: string;
  refused?: boolean;
  safetyTopic?: string;
}

const swahiliSignals = [
  'habari', 'naomba', 'nisaidie', 'tafadhali', 'mauzo', 'stoki', 'bidhaa', 'ripoti',
  'faida', 'hasara', 'fedha', 'duka', 'mfumo', 'bei', 'nunua', 'uza', 'muuzaji',
  'mteja', 'wateja', 'gharama', 'matumizi', 'malipo', 'akaunti', 'risiti', 'tuma',
  'fungua', 'nenda', 'onyesha', 'nipatie', 'nifanye', 'kiasi', 'mzigo'
];

const systemRiskSignals = [
  'hack', 'bypass', 'breach', 'exploit', 'sql injection', 'steal', 'token', 'api key',
  'secret key', 'admin password', 'database password', 'delete all', 'drop table',
  'disable security', 'remove security', 'ingia bila ruhusa', 'vunja mfumo',
  'iba', 'password ya admin', 'supabase key'
];

const businessSignals = [
  'sale', 'sales', 'sell', 'pos', 'stock', 'inventory', 'product', 'products', 'price',
  'profit', 'loss', 'expense', 'cash', 'bank', 'supplier', 'customer', 'report',
  'invoice', 'quotation', 'receipt', 'delivery', 'purchase', 'pharmacy', 'medicine',
  'batch', 'fifo', 'average', 'dashboard', 'setting', 'staff', 'password', 'login',
  'mauzo', 'uza', 'stoki', 'bidhaa', 'bei', 'faida', 'hasara', 'matumizi', 'fedha',
  'benki', 'msambazaji', 'mteja', 'ripoti', 'ankara', 'risiti', 'delivery',
  'manunuzi', 'dawa', 'mfumo', 'watumishi', 'ingia'
];

const generalKnowledgeSignals = [
  'football', 'messi', 'ronaldo', 'movie', 'song', 'lyrics', 'dating', 'weather',
  'politics', 'president', 'history of', 'recipe', 'game', 'joke', 'sing',
  'mpira', 'muziki', 'wimbo', 'mapenzi', 'hali ya hewa', 'siasa', 'rais', 'utani',
  'pika', 'mchezo'
];

const navigationIntents: Array<{ tab: string; sw: string; en: string; keys: string[] }> = [
  { tab: 'overview', sw: 'Nimefungua dashboard yako.', en: 'I opened your dashboard.', keys: ['dashboard', 'home', 'overview', 'nyumbani'] },
  { tab: 'pos', sw: 'Nimefungua POS ya mauzo.', en: 'I opened the POS sales screen.', keys: ['pos', 'till', 'cashier', 'checkout', 'sell', 'uza', 'mauzo'] },
  { tab: 'products', sw: 'Nimefungua Product Manager.', en: 'I opened Product Manager.', keys: ['product manager', 'products', 'catalog', 'bidhaa', 'stoki mpya'] },
  { tab: 'purchases-list', sw: 'Nimefungua manunuzi.', en: 'I opened purchases.', keys: ['purchase', 'purchases', 'buy stock', 'manunuzi', 'nunua'] },
  { tab: 'sales-list', sw: 'Nimefungua orodha ya mauzo.', en: 'I opened the sales list.', keys: ['sales list', 'sales history', 'receipts', 'historia ya mauzo', 'risiti'] },
  { tab: 'reports', sw: 'Nimefungua ripoti.', en: 'I opened reports.', keys: ['report', 'reports', 'audit', 'ripoti'] },
  { tab: 'forecasting', sw: 'Nimefungua utabiri wa mauzo na stoki.', en: 'I opened forecasting.', keys: ['forecast', 'forecasting', 'projection', 'predict', 'utabiri'] },
  { tab: 'expenses', sw: 'Nimefungua matumizi.', en: 'I opened expenses.', keys: ['expense', 'expenses', 'costs', 'matumizi', 'gharama'] },
  { tab: 'suppliers', sw: 'Nimefungua wateja na wasambazaji.', en: 'I opened parties and suppliers.', keys: ['supplier', 'customer', 'party', 'parties', 'mteja', 'wateja', 'msambazaji'] },
  { tab: 'deliveries', sw: 'Nimefungua delivery.', en: 'I opened deliveries.', keys: ['delivery', 'deliveries', 'rider', 'delivari'] },
  { tab: 'sync', sw: 'Nimefungua sehemu ya sync.', en: 'I opened offline sync.', keys: ['sync', 'offline', 'internet', 'mtandao'] },
  { tab: 'settings', sw: 'Nimefungua settings.', en: 'I opened settings.', keys: ['setting', 'settings', 'setup', 'configuration', 'mipangilio'] }
];

export const detectLucyLanguage = (input: string): LucyLanguage => {
  const lower = input.toLowerCase();
  const swScore = swahiliSignals.reduce((score, word) => score + (lower.includes(word) ? 1 : 0), 0);
  return swScore > 0 ? 'sw' : 'en';
};

export const getLucyGreeting = (language: LucyLanguage = 'en', tenantName?: string): string => {
  if (language === 'sw') {
    return `Habari, mimi ni Lucy. Niko hapa kukusaidia kutumia ${tenantName || 'Jasper'}, kuelewa mauzo, stoki, ripoti, POS, settings na hatua za kazi. Unaweza kuniuliza kwa Kiswahili.`;
  }
  return `Hi, I am Lucy. I can help you use ${tenantName || 'Jasper'}, understand sales, stock, reports, POS, settings, and daily business actions. You can ask me in English or Swahili.`;
};

const money = (amount: number, tenant?: Tenant) => {
  const currency = tenant?.currency || 'TSh';
  return `${currency}${Math.round(amount || 0).toLocaleString()}`;
};

const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();

const totalSales = (sales: Sale[] = []) => sales.reduce((sum, sale) => sum + (sale.total || 0), 0);

const totalExpenses = (expenses: any[] = []) => expenses.reduce((sum, expense) => {
  const value = Number(expense.amount ?? expense.total ?? expense.value ?? 0);
  return sum + (Number.isFinite(value) ? value : 0);
}, 0);

const lowStockProducts = (products: Product[] = []) => products
  .filter(product => Number(product.stockQty || 0) <= Number(product.alertQty || 0))
  .sort((a, b) => Number(a.stockQty || 0) - Number(b.stockQty || 0));

const bestSellingProducts = (sales: Sale[] = []) => {
  const qtyByProduct = new Map<string, number>();
  sales.forEach(sale => {
    sale.items?.forEach(item => {
      qtyByProduct.set(item.productName, (qtyByProduct.get(item.productName) || 0) + Number(item.qty || 0));
    });
  });
  return Array.from(qtyByProduct.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
};

const buildBusinessSnapshot = (ctx: LucyContext, language: LucyLanguage) => {
  const products = ctx.products || [];
  const sales = ctx.sales || [];
  const expenses = ctx.expenses || [];
  const revenue = totalSales(sales);
  const spend = totalExpenses(expenses);
  const lowStock = lowStockProducts(products);
  const bestSellers = bestSellingProducts(sales);

  if (language === 'sw') {
    const lowStockText = lowStock.length
      ? `Bidhaa za kuangalia kwanza: ${lowStock.slice(0, 4).map(p => `${p.name} (${p.stockQty} ${p.unit || p.baseUnit || 'pcs'})`).join(', ')}.`
      : 'Sioni bidhaa iliyofika chini ya kiwango cha tahadhari kwa sasa.';
    const bestText = bestSellers.length
      ? `Zinazoonekana kuuza zaidi: ${bestSellers.map(([name, qty]) => `${name} (${qty})`).join(', ')}.`
      : 'Bado sina mauzo ya kutosha kusema bidhaa inayouza zaidi.';
    return `Muhtasari wa haraka: bidhaa ${products.length}, mauzo yaliyorekodiwa ${sales.length}, jumla ya mauzo ${money(revenue, ctx.activeTenant)}, matumizi ${money(spend, ctx.activeTenant)}, makadirio rahisi ya salio ${money(revenue - spend, ctx.activeTenant)}. ${lowStockText} ${bestText}`;
  }

  const lowStockText = lowStock.length
    ? `First stock to check: ${lowStock.slice(0, 4).map(p => `${p.name} (${p.stockQty} ${p.unit || p.baseUnit || 'pcs'})`).join(', ')}.`
    : 'I do not see any item below its alert level right now.';
  const bestText = bestSellers.length
    ? `Top movers: ${bestSellers.map(([name, qty]) => `${name} (${qty})`).join(', ')}.`
    : 'There is not enough sales history yet to identify best sellers.';
  return `Quick snapshot: ${products.length} products, ${sales.length} recorded sales, revenue ${money(revenue, ctx.activeTenant)}, expenses ${money(spend, ctx.activeTenant)}, simple net ${money(revenue - spend, ctx.activeTenant)}. ${lowStockText} ${bestText}`;
};

const buildHelpAnswer = (ctx: LucyContext, language: LucyLanguage, lower: string) => {
  if (lower.includes('fifo') || lower.includes('batch') || lower.includes('average')) {
    return language === 'sw'
      ? 'FIFO huuza stoki ya zamani kwanza. Average hutumia wastani wa gharama ya bidhaa zote zilizopo. Batch Price huuza kwa bei ya batch iliyochaguliwa. Kwa POS, chagua njia unayotaka kwenye bidhaa au kwenye settings za stoki ili hesabu ya faida itumie njia sahihi.'
      : 'FIFO sells the oldest stock first. Average uses the weighted cost of available stock. Batch Price sells from a selected/current batch price. In POS, the product stock settings control which cost method is used for profit and stock deduction.';
  }

  if (lower.includes('whatsapp') || lower.includes('send') || lower.includes('tuma')) {
    return language === 'sw'
      ? 'Kwa kutuma document kwa WhatsApp, mfumo unatakiwa kutengeneza PDF rasmi kwanza, kisha kuituma kwa namba ya mteja pamoja na ujumbe mfupi wa heshima. Kama WhatsApp Business API haijaunganishwa, Lucy atakuandalia ujumbe na kufungua WhatsApp ili utume.'
      : 'For WhatsApp documents, Jasper should generate the official PDF first, then send it to the customer number with a short respectful message. If WhatsApp Business API is not connected yet, Lucy can prepare the message and open WhatsApp for sending.';
  }

  if (lower.includes('offline') || lower.includes('internet') || lower.includes('mtandao')) {
    return language === 'sw'
      ? 'Jasper inaendelea kufanya kazi bila internet kwa kuhifadhi mauzo na mabadiliko muhimu kwenye kifaa. Internet ikirudi, sehemu ya sync inasaidia kusawazisha data. Ukiona kitu hakijahifadhiwa baada ya refresh, ni dalili ya sehemu hiyo bado haijaunganishwa vizuri na local/cloud storage.'
      : 'Jasper can keep working without internet by saving important sales and changes on the device. When internet returns, the sync area helps consolidate data. If something disappears after refresh, that screen still needs stronger local/cloud persistence.';
  }

  if (lower.includes('password') || lower.includes('login') || lower.includes('otp') || lower.includes('ingia')) {
    return language === 'sw'
      ? 'Kwa login, tumia namba ya WhatsApp. Mmiliki au admin anaweza kurejesha password kwa OTP ya WhatsApp. Staff anaweza kuingia kwa namba yake, na admin anaweza kumuwekea password/PIN mpya kwenye Staff Members.'
      : 'For login, use the WhatsApp number. Owner/admin recovery uses WhatsApp OTP. Staff can sign in with their phone number, and the admin can reset staff password/PIN from Staff Members.';
  }

  return null;
};

export const createLucyResponse = (message: string, ctx: LucyContext = {}): LucyResponse => {
  const language = detectLucyLanguage(message);
  const lower = normalize(message);

  const risk = systemRiskSignals.find(signal => lower.includes(signal));
  if (risk) {
    return {
      language,
      refused: true,
      safetyTopic: risk,
      text: language === 'sw'
        ? 'Samahani, siwezi kusaidia kuvunja usalama, kupata siri za mfumo, au kufanya jambo linaloweza kuharibu data. Naweza kukusaidia kwa njia salama kama kurekebisha login, kuweka ruhusa za staff, backup, sync, au kuimarisha usalama.'
        : 'I am sorry, I cannot help bypass security, expose secrets, or do anything that could damage data. I can help safely with login recovery, staff permissions, backups, sync, or improving system security.'
    };
  }

  const isBusinessRelated = businessSignals.some(signal => lower.includes(signal));
  const isGeneralQuestion = generalKnowledgeSignals.some(signal => lower.includes(signal));
  if (isGeneralQuestion && !isBusinessRelated) {
    return {
      language,
      refused: true,
      text: language === 'sw'
        ? 'Samahani, mimi Lucy nimetengenezwa kusaidia biashara yako na matumizi ya Jasper. Kwa swali hilo la nje ya biashara, tafadhali tumia Google, tovuti rasmi, au mtaalamu wa eneo hilo. Niko tayari kukusaidia kuhusu mauzo, stoki, POS, ripoti, settings, staff au documents.'
        : 'I am sorry, I was made to help with your business and Jasper. For that question outside business operations, please use Google, official websites, or a qualified specialist. I can help with sales, stock, POS, reports, settings, staff, or documents.'
    };
  }

  const navigation = navigationIntents.find(intent => (
    (lower.includes('open') || lower.includes('go to') || lower.includes('show') || lower.includes('fungua') || lower.includes('nenda') || lower.includes('onyesha')) &&
    intent.keys.some(key => lower.includes(key))
  ));
  if (navigation) {
    return {
      language,
      action: 'NAVIGATE',
      targetTab: navigation.tab,
      text: `${language === 'sw' ? navigation.sw : navigation.en} ${language === 'sw' ? 'Ukifika hapo, niambie unataka kufanya nini hatua inayofuata.' : 'Once there, tell me what you want to do next.'}`
    };
  }

  if (
    lower.includes('summary') || lower.includes('summarize') || lower.includes('analyze') ||
    lower.includes('report') || lower.includes('ripoti') || lower.includes('faida') ||
    lower.includes('profit') || lower.includes('low stock') || lower.includes('stoki')
  ) {
    return {
      language,
      text: buildBusinessSnapshot(ctx, language)
    };
  }

  const helpAnswer = buildHelpAnswer(ctx, language, lower);
  if (helpAnswer) {
    return { language, text: helpAnswer };
  }

  if (!isBusinessRelated && ctx.surface !== 'landing') {
    return {
      language,
      refused: true,
      text: language === 'sw'
        ? 'Samahani, sijaelewa kama hili linahusu biashara yako au matumizi ya Jasper. Niulize kuhusu mauzo, stoki, POS, ripoti, settings, WhatsApp documents, staff, manunuzi, au fedha.'
        : 'I am sorry, I could not tell if this is about your business or Jasper. Ask me about sales, stock, POS, reports, settings, WhatsApp documents, staff, purchases, or cash.'
    };
  }

  if (ctx.surface === 'landing') {
    return {
      language,
      text: language === 'sw'
        ? 'Jasper inasaidia biashara kufanya mauzo, stoki, reports, POS, offline mode, WhatsApp documents na usimamizi wa staff. Niambie aina ya biashara yako, halafu nitakuonyesha sehemu muhimu.'
        : 'Jasper helps businesses run sales, stock, reports, POS, offline work, WhatsApp documents, and staff management. Tell me your business type and I will point you to the right features.'
    };
  }

  return {
    language,
    text: language === 'sw'
      ? 'Nimekusikia. Kwa hatua ya haraka, unaweza kuniambia: fungua POS, onyesha ripoti, angalia stoki ndogo, au nifanyie muhtasari wa biashara. Nitajibu kwa lugha unayotumia.'
      : 'I hear you. For a quick action, you can tell me: open POS, show reports, check low stock, or summarize my business. I will reply in the language you use.'
  };
};
