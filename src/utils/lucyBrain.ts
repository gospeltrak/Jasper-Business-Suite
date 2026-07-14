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
  'fungua', 'nenda', 'onyesha', 'nipatie', 'nifanye', 'kiasi', 'mzigo', 'nahitaji',
  'kujua', 'kifurushi', 'vifurushi', 'jaribio', 'hoteli', 'mgahawa'
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
  'package', 'packages', 'subscription', 'trial', 'free trial', 'pricing', 'hotel',
  'restaurant', 'wholesale', 'retail', 'affiliate', 'tenant', 'business suite',
  'mauzo', 'uza', 'stoki', 'bidhaa', 'bei', 'faida', 'hasara', 'matumizi', 'fedha',
  'benki', 'msambazaji', 'mteja', 'ripoti', 'ankara', 'risiti', 'delivery',
  'manunuzi', 'dawa', 'mfumo', 'watumishi', 'ingia', 'kifurushi', 'vifurushi',
  'gharama', 'jaribio', 'hoteli', 'mgahawa', 'jumla', 'rejareja'
];

const generalKnowledgeSignals = [
  'football', 'messi', 'ronaldo', 'movie', 'song', 'lyrics', 'dating', 'weather',
  'politics', 'president', 'history of', 'recipe', 'game', 'joke', 'sing',
  'mpira', 'muziki', 'wimbo', 'mapenzi', 'hali ya hewa', 'siasa', 'rais', 'utani',
  'pika', 'mchezo'
];

const greetingSignals = [
  'hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening',
  'habari', 'mambo', 'niaje', 'hujambo', 'salama', 'shikamoo'
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

export const getLucyGreeting = (language: LucyLanguage = 'en', tenantName?: string, businessType?: string): string => {
  const name = tenantName || 'your business';
  if (language === 'sw') {
    return `Habari 😊 Mimi ni Lucy, msaidizi wako wa biashara ya ${name}. Naweza kukusaidia kuangalia mauzo, stock, ripoti, au madeni. Unataka tuanze na ipi?`;
  }
  return `Hi 😊 I'm Lucy, your business assistant for ${name}. I can help you check sales, stock, reports, debts, and give business recommendations. What would you like to look at?`;
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
      : 'For WhatsApp documents, Ndiva should generate the official PDF first, then send it to the customer number with a short respectful message. If WhatsApp Business API is not connected yet, Lucy can prepare the message and open WhatsApp for sending.';
  }

  if (lower.includes('offline') || lower.includes('internet') || lower.includes('mtandao')) {
    return language === 'sw'
      ? 'Ndiva sasa inahitaji intaneti ili kusave mabadiliko ya biashara. Hii inalinda mauzo, stoki, settings na taarifa za tenant zisisave kwenye kifaa tu kisha zipotee au ku-overwrite cloud. Internet ikikatika, unganisha kwanza kabla ya kuendelea na mabadiliko.'
      : 'Ndiva now requires internet to save business changes. This protects sales, stock, settings, and tenant records from being saved only on one device and later lost or overwriting cloud data. If internet drops, reconnect before continuing with edits.';
  }

  if (lower.includes('password') || lower.includes('login') || lower.includes('otp') || lower.includes('ingia')) {
    return language === 'sw'
      ? 'Kwa login, tumia namba ya WhatsApp. Mmiliki au admin anaweza kurejesha password kwa OTP ya WhatsApp. Staff anaweza kuingia kwa namba yake, na admin anaweza kumuwekea password/PIN mpya kwenye Staff Members.'
      : 'For login, use the WhatsApp number. Owner/admin recovery uses WhatsApp OTP. Staff can sign in with their phone number, and the admin can reset staff password/PIN from Staff Members.';
  }

  return null;
};

const includesAny = (lower: string, keys: string[]) => keys.some(key => lower.includes(key));
const isShortGreeting = (lower: string) => {
  if (lower.length >= 45) return false;
  return /(^|\s)(hi|hello|hey|habari|mambo|hujambo|salama)(\s|$|[.!?])/.test(lower);
};

const buildLandingAnswer = (message: string, language: LucyLanguage, lower: string) => {
  if (isShortGreeting(lower)) {
    return language === 'sw'
      ? 'Karibu sana. Nipo hapa kukuongoza taratibu: unaweza kuniambia aina ya biashara yako, au uniulize kuhusu bei, free trial, POS, stoki, reports, cloud sync, pharmacy, hotel au restaurant.'
      : 'Welcome. I am here with you step by step: tell me your business type, or ask about pricing, free trial, POS, stock, reports, cloud sync, pharmacy, hotel, or restaurant.';
  }

  if (includesAny(lower, ['price', 'cost', 'package', 'packages', 'subscription', 'pricing', 'free trial', 'trial', 'bei', 'gharama', 'kifurushi', 'vifurushi', 'malipo', 'jaribio'])) {
    return language === 'sw'
      ? 'Ndiyo, nikupe picha rahisi. Ndiva huanza na free trial ili uone mfumo kwanza. Ruby ni kwa matumizi ya msingi, Diamond inaanza Lucy AI na ripoti nzuri zaidi, na Tanzanite ni kwa biashara inayotaka uwezo mkubwa zaidi kama forecasting. Kama unatumia promo code, trial inaweza kuwa ndefu zaidi kulingana na offer iliyopo. Una duka moja au matawi mengi? Nikijua hilo nitakushauri kifurushi kinachofaa.'
      : 'Yes, here is the simple picture. Ndiva starts with a free trial so you can feel the system first. Ruby is for essential operations, Diamond unlocks Lucy AI and stronger reports, and Tanzanite is for businesses that want higher power such as forecasting. If you use a promo code, the trial may be longer depending on the active offer. Do you run one shop or multiple branches? That helps me recommend the right package.';
  }

  if (includesAny(lower, ['pharmacy', 'medicine', 'drug', 'rx', 'dawa', 'duka la dawa'])) {
    return language === 'sw'
      ? 'Pharmacy inaingia vizuri kwenye Ndiva. Unaweza kupanga dawa kwa categories na units, kuuza kupitia POS, kufuatilia stoki, manunuzi, expenses, faida, na reports. Hatua nzuri ya kwanza ni kuweka units zako kama box, strip, tablet au bottle, kisha kupanga categories za dawa. Unataka nikueleze pharmacy setup hatua kwa hatua?'
      : 'Pharmacy fits Ndiva very well. You can organize medicine categories and units, sell through POS, track stock, purchases, expenses, profit, and reports. A good first step is setting units like box, strip, tablet, or bottle, then adding medicine categories. Would you like a step-by-step pharmacy setup flow?';
  }

  if (includesAny(lower, ['hotel', 'room', 'pms', 'booking', 'hoteli', 'chumba', 'vyumba'])) {
    return language === 'sw'
      ? 'Kwa hotel, Ndiva inaweza kusaidia kuona biashara kwa upande wa mauzo, gharama, stoki, reports, na usimamizi wa huduma. PMS/hotel tools zinalenga kurahisisha vyumba, bookings na mapato, huku owner akiona picha ya biashara kwa urahisi. Ni hotel ndogo ya vyumba vichache au una departments nyingi?'
      : 'For hotels, Ndiva helps with sales, expenses, stock, reports, and service management. The PMS/hotel tools are meant to simplify rooms, bookings, and revenue while the owner sees the business clearly. Is it a small hotel with a few rooms, or do you run multiple departments?';
  }

  if (includesAny(lower, ['restaurant', 'food', 'table', 'kds', 'mgahawa', 'chakula', 'meza'])) {
    return language === 'sw'
      ? 'Kwa restaurant, Ndiva inalenga kufanya order, mauzo, stoki ya ingredients, expenses na reports ziwe rahisi kufuatilia. Unaweza kuanza na menu items, bei, staff wanaouza, kisha reports za mauzo ya siku. Unataka mfumo ukuongoze zaidi kwenye quick sale au restaurant setup?'
      : 'For restaurants, Ndiva helps you keep orders, sales, ingredient stock, expenses, and reports under control. You can start with menu items, prices, staff sales, then daily sales reports. Do you want a quick-sale setup or a fuller restaurant workflow?';
  }

  if (includesAny(lower, ['offline', 'internet', 'network', 'sync', 'mtandao', 'bila internet'])) {
    return language === 'sw'
      ? 'Kwa sasa Ndiva inasave business data online-only. Ukiwa bila internet, unganisha kwanza kabla ya kufanya mauzo, kubadili bidhaa, stoki au settings. Hii inapunguza risk ya data kupotea au kifaa cha zamani kuandika juu ya cloud.'
      : 'Ndiva now saves business data online-only. If you are offline, reconnect before recording sales or changing products, stock, or settings. This reduces the risk of data loss or an old device overwriting cloud data.';
  }

  if (includesAny(lower, ['pos', 'sell', 'sales', 'cashier', 'receipt', 'uza', 'mauzo', 'risiti'])) {
    return language === 'sw'
      ? 'POS ndiyo sehemu ya kuuza haraka. Unaweka bidhaa, bei na stoki, halafu cashier anauza na mfumo unaandaa risiti, kupunguza stoki na kusaidia owner kuona mauzo. Ukianza leo, hatua tatu ni: sajili bidhaa, weka bei, fanya sale ya majaribio. Unauza bidhaa za rejareja, jumla, au huduma?'
      : 'POS is the fast selling area. You add products, prices, and stock, then the cashier sells while Ndiva prepares receipts, reduces stock, and helps the owner see sales. If you start today, the first three steps are: add products, set prices, make a test sale. Do you sell retail, wholesale, or services?';
  }

  if (includesAny(lower, ['stock', 'inventory', 'product', 'products', 'stoki', 'bidhaa', 'ghala'])) {
    return language === 'sw'
      ? 'Stoki ni moyo wa biashara. Ndiva hukusaidia kujua kilichopo, kinachouza, kilichokaribia kuisha, na faida inayotoka kwenye bidhaa. Ukiweka categories na units vizuri mwanzo, reports zako zinakuwa safi zaidi. Unataka nikupe mfano wa kupanga categories na units?'
      : 'Stock is the heartbeat of the business. Ndiva helps you know what you have, what is moving, what is nearly finished, and which products create profit. If categories and units are clean from the start, reports become much clearer. Would you like an example category and unit structure?';
  }

  if (includesAny(lower, ['report', 'reports', 'profit', 'forecast', 'forecasting', 'ripoti', 'faida', 'utabiri'])) {
    return language === 'sw'
      ? 'Reports ndizo zinakuonyesha ukweli wa biashara: mauzo, matumizi, faida, bidhaa zinazoenda haraka na sehemu zinazohitaji uamuzi. Diamond inakupa Lucy kwa msaada wa maswali na reports, Tanzanite inaenda zaidi kwenye forecasting. Unauliza kuhusu report ya kila siku, mwezi, au kutabiri mauzo?'
      : 'Reports show the truth of the business: sales, expenses, profit, fast-moving products, and decisions that need attention. Diamond gives Lucy for guided questions and reports, while Tanzanite goes further with forecasting. Are you asking about daily reports, monthly reports, or sales forecasting?';
  }

  return language === 'sw'
    ? `Nimekupata. Ndiva ni mfumo wa kuendesha biashara kwa POS, stoki, manunuzi, expenses, reports, staff na Lucy AI. Ili nikujibu vizuri zaidi, niambie biashara yako ni ipi na changamoto yako kubwa ni nini leo: mauzo, stoki, ripoti, staff, au kufungua account?`
    : `I hear you. Ndiva helps run a business through POS, stock, purchases, expenses, reports, staff, and Lucy AI. To guide you well, tell me your business type and the biggest thing you want solved today: sales, stock, reports, staff, or getting started?`;
};

export const createLucyResponse = (message: string, ctx: LucyContext = {}): LucyResponse => {
  const language = detectLucyLanguage(message);
  const lower = normalize(message);

  const isGreeting = greetingSignals.some(signal => lower === signal || lower.startsWith(`${signal} `));
  if (isGreeting) {
    return {
      language,
      text: getLucyGreeting(language, ctx.activeTenant?.name, ctx.activeTenant?.businessType)
    };
  }

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
        ? 'Samahani, mimi Lucy nimetengenezwa kusaidia biashara yako na matumizi ya Ndiva. Kwa swali hilo la nje ya biashara, tafadhali tumia Google, tovuti rasmi, au mtaalamu wa eneo hilo. Niko tayari kukusaidia kuhusu mauzo, stoki, POS, ripoti, settings, staff au documents.'
        : 'I am sorry, I was made to help with your business and Ndiva. For that question outside business operations, please use Google, official websites, or a qualified specialist. I can help with sales, stock, POS, reports, settings, staff, or documents.'
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

  if (ctx.surface === 'landing') {
    return {
      language,
      text: buildLandingAnswer(message, language, lower)
    };
  }

  if (!isBusinessRelated && ctx.surface !== 'landing') {
    return {
      language,
      refused: true,
      text: language === 'sw'
        ? 'Samahani, sijaelewa kama hili linahusu biashara yako au matumizi ya Ndiva. Niulize kuhusu mauzo, stoki, POS, ripoti, settings, WhatsApp documents, staff, manunuzi, au fedha.'
        : 'I am sorry, I could not tell if this is about your business or Ndiva. Ask me about sales, stock, POS, reports, settings, WhatsApp documents, staff, purchases, or cash.'
    };
  }

  return {
    language,
    text: language === 'sw'
      ? 'Nimekusikia. Kwa hatua ya haraka, unaweza kuniambia: fungua POS, onyesha ripoti, angalia stoki ndogo, au nifanyie muhtasari wa biashara. Nitajibu kwa lugha unayotumia.'
      : 'I hear you. For a quick action, you can tell me: open POS, show reports, check low stock, or summarize my business. I will reply in the language you use.'
  };
};
