import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type LanguageType = 'en' | 'sw';

interface LanguageContextType {
  lang: LanguageType;
  setLang: (lang: LanguageType) => void;
  t: (text: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Comprehensive dictionary for complete app-wide Translation propagation
const BUSINESS_DICTIONARY: Record<string, Record<string, string>> = {
  // English stays the default, but hard system words are changed to plain words.
  en: {
    "account identifier": "Phone number or email",
    "owner pin password": "Password",
    "business industry niche": "Business type",
    "business industry niche / type": "Business type",
    "region of operations": "Country or area",
    "city / office location": "City",
    "commercial profit & loss account": "Profit and loss report",
    "consolidated margin curve": "Sales and profit chart",
    "statement line items": "Report details",
    "operating outlays": "Business costs",
    "operating expenses burden": "Business expenses",
    "aggregate outflow": "Total money spent",
    "procurements": "Purchases",
    "procurement": "Purchase",
    "ledger": "Records",
    "audit ledger": "Report records",
    "reporting terminal": "Reports",
    "intelligence & auditing": "Business reports",
    "business intelligence": "Business reports",
    "gross income": "Total income",
    "gross revenue": "Total sales money",
    "net gross profit": "Profit",
    "cogs": "Product cost",
    "cost of goods sold": "Product cost",
    "sku": "Product code",
    "tracked skus": "Products checked",
    "units moved": "Items sold",
    "sales velocity": "Sales speed",
    "fast movers": "Fast-selling items",
    "slow movers": "Slow-selling items",
    "channel": "Sales type",
    "dual channel": "Retail and wholesale",
    "product profitability": "Product profit",
    "payment channels": "Payment methods",
    "active stock": "Products in stock",
    "branch yield": "Sales income",
    "deferred credit": "Pay later",
    "custom interval": "Choose dates",
    "all time": "All dates",
    "compile report": "Create report",
    "export": "Download",
    "commit ledger": "Save expense",
    "discard": "Cancel"
  },
  sw: {
    "account identifier": "Namba ya simu au barua pepe",
    "active stock": "Bidhaa zilizopo",
    "aggregate outflow": "Jumla ya matumizi",
    "audit ledger": "Kumbukumbu za ripoti",
    "branch yield": "Mapato ya tawi",
    "business industry niche": "Aina ya biashara",
    "business intelligence": "Ripoti za biashara",
    "commit ledger": "Hifadhi matumizi",
    "compile report": "Tengeneza ripoti",
    "consolidated margin curve": "Chati ya mauzo na faida",
    "cost of goods sold": "Gharama ya bidhaa",
    "deferred credit": "Malipo ya baadaye",
    "discard": "Ghairi",
    "dual channel": "Rejareja na jumla",
    "fast movers": "Bidhaa zinazouzwa haraka",
    "gross income": "Jumla ya mapato",
    "gross revenue": "Jumla ya mauzo",
    "intelligence & auditing": "Ripoti za biashara",
    "last 30 days": "Siku 30 zilizopita",
    "last 7 days": "Siku 7 zilizopita",
    "net gross profit": "Faida",
    "operating expenses burden": "Matumizi ya biashara",
    "past 30 days": "Siku 30 zilizopita",
    "procurement": "Manunuzi",
    "product profitability": "Faida ya bidhaa",
    "reporting terminal": "Ripoti",
    "sales velocity": "Kasi ya mauzo",
    "slow movers": "Bidhaa zinazouzwa polepole",
    "statement line items": "Maelezo ya ripoti",
    "tracked skus": "Bidhaa zilizofuatiliwa",
    "units moved": "Bidhaa zilizouzwa",
    "smart pos & business management": "POS Mahiri na Usimamizi wa Biashara",
    "bulkProduct": "Bidhaa ya Jumla",
    "sellByWeightOrPcs": "Uza kwa uzito au vipande",
    "buyIn": "Nunua kwa",
    "sellIn": "Uza kwa",
    "pricePerUnit": "Bei ya kila kipande",
    "totalUnitsFromPurchase": "Jumla ya vipande kutoka ununuzi",
    "totalRevenueIfAllSold": "Mapato yote ukiuza yote",
    "grossProfit": "Faida Ghafi",
    "breakeven": "Kiasi cha kuvunjia",
    "breakevenUnits": "Vipande vya kuvunjia",
    "scaleMode": "Uza kwa Uzito",
    "pcsMode": "Uza kwa Vipande",
    "hybridMode": "Njia Zote Mbili",
    "kgRemaining": "KG zilizobaki",
    "portionsRemaining": "Sehemu zilizobaki",
    "profitCalculator": "Hesabu Faida",
    "purchaseAnalysis": "Uchambuzi wa Ununuzi",
    "actualPerformance": "Utendaji Halisi",
    "wasteLoss": "Hasara / Baki",
    "bulkProductsReport": "Ripoti ya Bidhaa za Jumla",

    "home": "Nyumbani",
    "dashboard": "Dashibodi",
    "sales": "Mauzo",
    "pos": "Uza",
    "reports": "Ripoti",
    "more": "Zaidi",
    "parties": "Washirika",
    "purchases": "Manunuzi",
    "expenses": "Matumizi",
    "delivery": "Delivari",
    "delivery riders": "Madereva",
    "customers": "Wateja",
    "suppliers": "Wasambazaji",
    "products": "Bidhaa",
    "product manager": "Msimamizi wa Bidhaa",
    "inventory": "Ghala",
    "settings": "Mipangilio",
    "staff": "Wafanyakazi",
    "logout": "Toka",
    "online sync": "Sync ya Mtandao",
    "payment channels": "Njia za Malipo",
    "ledger": "Daftari la Hesabu",
    "quotations": "Nukuu za Bei",
    "proforma": "Ankara ya Awali",
    "finance": "Fedha",
    "real time performance": "Utendaji wa Wakati Huu",
    "total orders": "Jumla ya Oda",
    "total sales": "Jumla ya Mauzo",
    "cogs": "Gharama za Bidhaa",
    "total profit": "Faida Yote",
    "active orders": "Oda Zinazoendelea",
    "product costs": "Gharama za Bidhaa",
    "procurements": "Ununuzi",
    "opex cash": "Pesa za Uendeshaji",
    "deficit": "Upungufu",
    "receipt count": "Idadi ya Risiti",
    "total value": "Thamani Yote",
    "offline dockets": "Bili bila Mtandao",
    "pending": "Inasubiri",
    "store credit": "Mkopo wa Duka",
    "units sold": "Idadi Iliyouzwa",
    "inflow verified": "Mapato Yamethibitishwa",
    "supply stock in": "Bidhaa Zimeingizwa",
    "operating outlays": "Gharama za Uendeshaji",
    "net profit share": "Mgawanyo wa Faida",
    "top selling products": "Bidhaa Zinazoongoza kwa Mauzo",
    "weekly cohort metrics": "Takwimu za Wiki",
    "past30Days": "Siku 30 Zilizopita",
    "sales and purchase status": "Hali ya Mauzo na Manunuzi",
    "good morning": "Habari za asubuhi",
    "good afternoon": "Habari za mchana",
    "good evening": "Habari za jioni",
    "good night": "Usiku mwema",
    "today": "Leo",
    "yesterday": "Jana",
    "one week": "Wiki 1",
    "one month": "Mwezi 1",
    "three months": "Miezi 3",
    "one year": "Mwaka 1",
    "1 week": "Wiki 1",
    "1 month": "Mwezi 1",
    "3 month": "Miezi 3",
    "3 months": "Miezi 3",
    "1 year": "Mwaka 1",
    "sales & purchases status": "Hali ya Mauzo na Manunuzi",
    "hourly status review (today)": "Mapitio ya kila saa (Leo)",
    "daily status breakdown (past 7 days)": "Mchanganuo wa kila siku (Siku 7 zilizopita)",
    "weekly cohort metrics (past 30 days)": "Takwimu za wiki (Siku 30 zilizopita)",
    "quarterly operational analytics (past 3 months)": "Uchambuzi wa robo mwaka (Miezi 3 iliyopita)",
    "annual operational analytics (past 1 year)": "Uchambuzi wa mwaka (Mwaka 1 uliopita)",
    "all time": "Wakati Wote",
    "last7Days": "Siku 7 Zilizopita",
    "last30Days": "Siku 30 Zilizopita",
    "past 7 days": "Siku 7 Zilizopita",
    "past 3 months": "Miezi 3 Iliyopita",
    "past 1 year": "Mwaka 1 Uliopita",
    "custom interval": "Kipindi Maalum",
    "week": "Wiki",
    "month": "Mwezi",
    "year": "Mwaka",
    "this week": "Wiki Hii",
    "this month": "Mwezi Huu",
    "sales transactions ledger": "Daftari la Miamala ya Mauzo",
    "sales and receipts": "Mauzo na Risiti",
    "add sale direct": "Ongeza Uuzaji",
    "channel": "Njia",
    "retail": "Rejareja",
    "wholesale": "Jumla",
    "reference": "Kumbukumbu",
    "customer": "Mteja",
    "cashier": "Keshia",
    "amount paid": "Kiasi Kilicholipwa",
    "amount due": "Kiasi Kinachostahili",
    "payment method": "Njia ya Malipo",
    "cash": "Taslimu",
    "bank": "Benki",
    "mobile money": "Malipo ya Simu",
    "paid": "Imelipwa",
    "unpaid": "Haijalipiwa",
    "partial": "Sehemu",
    "credit": "Mkopo",
    "debts": "Madeni",
    "credit & debts": "Madeni",
    "settle": "Hesabu",
    "till settlement": "Hesabu",
    "quotes": "Nukuu",
    "quotes & invoices": "Nukuu na Ankara",
    "receipts": "Risiti",
    "collected": "Zilizopokelewa",
    "dawn": "Alfajiri",
    "morning": "Asubuhi",
    "afternoon": "Mchana",
    "evening": "Jioni",
    "predictive velocity": "Utabiri",
    "quick action": "Haraka",
    "open sell screen": "Fungua Kuuza",
    "tap to start selling now": "Bonyeza uanze kuuza sasa",
    "available balance": "Salio",
    "accounts": "Akaunti",
    "cash drawers": "Taslimu",
    "physical cash points": "Fedha Mkononi",
    "mobile wallets": "Pochi",
    "bank accounts": "Benki",
    "formal bank channels": "Benki Rasmi",
    "accounts & wallets": "Akaunti na Pochi",
    "see all": "Ona Zote",
    "treasury": "Hazina",
    "net movement": "Mzunguko wa Fedha",
    "transfer": "Hamisha",
    "history": "Historia",
    "directory": "Orodha",
    "register": "Sajili",
    "no staff registered.": "Hakuna wafanyakazi waliosajiliwa.",
    "register staff to see their session and performance reports here.": "Sajili wafanyakazi kuona taarifa zao hapa.",
    "product list": "Orodha ya Bidhaa",
    "view all products": "Ona Bidhaa Zote",
    "browse by type": "Chagua kwa Aina",
    "browse by brand": "Chagua kwa Chapa",
    "barcode & labels": "Msimbo na Lebo",
    "print station": "Chapisha",
    "brands": "Chapa",
    "csv or backup": "CSV au Nakala",
    "full restore backup": "Rudisha Nakala Kamili",
    "template": "Fomu",
    "cost": "Gharama",
    "shopping cart": "Kikapu",
    "sale entry date": "Tarehe ya Mauzo",
    "till subtotal": "Jumla Ndogo",
    "order discount": "Punguzo",
    "tax type": "Aina ya Kodi",
    "customer vat status": "Hali ya VAT",
    "delivery charges": "Gharama ya Delivari",
    "order total": "Jumla",
    "cart total": "Jumla",
    "void": "Futa",
    "proceed to payment": "Endelea na Malipo",
    "sales overview": "Muhtasari wa Mauzo",
    "today sales": "Mauzo Leo",
    "this week sales": "Mauzo Wiki Hii",
    "this month sales": "Mauzo Mwezi Huu",
    "last 3 months sales": "Mauzo Miezi 3 Zilizopita",
    "this year sales": "Mauzo Mwaka Huu",
    "sale": "Mauzo",
    "start selling": "Anza Kuuza",
    "start selling to see transactions here.": "Anza kuuza ili uone miamala hapa.",
    "supply chain warning activated. restock logs queued for": "Bidhaa",
    "lines.": "zinahitaji kuagizwa tena.",
    "operating expenses ledger": "Daftari la Matumizi",
    "entry": "Rekodi",
    "entries": "Rekodi",
    "add expenses": "Ongeza matumizi",
    "to see trend": "ili uone mwelekeo",
    "expenditure transaction index": "Orodha ya Matumizi",
    "showing": "Inaonyesha",
    "record(s) matching dates": "rekodi za tarehe hizi",
    "no expenses found": "Hakuna matumizi yaliyopatikana",
    "no expenses found.": "Hakuna matumizi yaliyopatikana.",
    "purchase orders": "Oda za Manunuzi",
    "add purchase": "Ongeza Manunuzi",
    "due": "deni",
    "show all": "Onyesha Zote",
    "search docs or clients...": "Tafuta hati au wateja...",
    "new quote / invoice": "Ongeza Nukuu / Ankara",
    "no documents found matching current filter under this tenant branch office.": "Hakuna hati zilizopatikana katika tawi hili.",
    "line item": "bidhaa",
    "total due": "Jumla ya Deni",
    "cancel receipt": "Ghairi Risiti",
    "add to delivery": "Ongeza kwa Delivari",
    "send to delivery note dispatch": "Tuma kwenye delivari",
    "view or print full-page invoice": "Angalia au Chapisha ankara kamili",
    "reverse payment and restore stock safely": "Rudisha malipo na stoki kwa usalama",
    "performance": "Utendaji",
    "search partners...": "Tafuta washirika...",
    "new supplier details": "Taarifa za Msambazaji Mpya",
    "vendor name": "Jina la Msambazaji",
    "no suppliers found matching your search.": "Hakuna wasambazaji waliopatikana.",
    "total spent": "Jumla Iliyotumika",
    "no customers recorded yet.": "Hakuna wateja bado.",
    "purchase": "Manunuzi",
    "product": "Bidhaa",
    "we owe": "Tunadaiwa",
    "owes delivery": "Deni la Delivari",
    "create delivery note": "Tengeneza Hati ya Delivari",
    "delivery accounting": "Hesabu za Delivari",
    "new delivery": "Delivari Mpya",
    "assigned delivery courier": "Dereva wa Delivari",
    "vehicle type": "Aina ya Gari",
    "item count": "Idadi ya Bidhaa",
    "date sent": "Tarehe ya Kutuma",
    "no matching tenant record was found.": "Hakuna taarifa zilizopatikana.",
    "no deliveries recorded yet.": "Hakuna delivari bado.",
    "unassigned": "Haijapangwa",
    "assign order delivery dispatch": "Panga Delivari ya Oda",
    "net operating profit": "Faida ya Uendeshaji",
    "total gross revenue": "Jumla ya Mapato",
    "daily performance trend": "Mwenendo wa Kila Siku",
    "inventory valuation": "Thamani ya Stoki",
    "cost of goods": "Gharama za Bidhaa",
    "no sales recorded for this period.": "Hakuna mauzo kwa kipindi hiki.",
    "delivery operations": "Shughuli za Delivari",
    "stock adjustment log": "Daftari la Marekebisho ya Stoki",
    "branch code": "Nambari ya Tawi",
    "business display name": "Jina la Biashara",
    "street address": "Anwani",
    "opening date": "Tarehe ya Kufungua",
    "what type of branch are you creating?": "Unataka kuunda tawi la aina gani?",
    "branches are available only on the tanzanite package. upgrade to create and manage multiple branches.": "Matawi yanapatikana kwenye mpango wa Tanzanite pekee. Boresha akaunti kuunda na kusimamia matawi mengi.",
    "clear search": "Futa Utafutaji",
    "activate branches": "Washa Matawi",
    "select a branch to view its details.": "Chagua tawi kuona taarifa zake.",
    "branch capacity": "Uwezo wa Tawi",
    "generate projections with lucy": "Tengeneza Utabiri na Lucy",
    "expected sales": "Mauzo Yanayotarajiwa",
    "supplier & market info": "Taarifa za Msambazaji na Soko",
    "risk": "Hatari",
    "manage your business preferences": "Simamia mapendeleo ya biashara yako",
    "operating time zone": "Saa za Eneo",
    "business brand name": "Jina la Chapa",
    "units of measure": "Vipimo",
    "bank account number": "Namba ya Akaunti ya Benki",
    "receiver name": "Jina la Mpokeaji",
    "alerts stay securely inside the tenant admin workspace. external messaging channels are disabled.": "Arifa zinabaki salama ndani ya mfumo. Njia za nje za ujumbe zimezimwa.",
    "review local work kept for manual recovery only.": "Angalia kazi iliyohifadhiwa kwa ajili ya kurejesha baadaye.",
    "consolidated store log ledger": "Daftari la Kumbukumbu za Duka",
    "barcode generator": "Tengeneza Msimbo",
    "client brand name": "Jina la Chapa ya Mteja",
    "normal billing cycles & subscription mechanics": "Mzunguko wa Malipo na Usajili",
    "read-only sale record": "Rekodi ya Mauzo (Kusoma Tu)",
    "archived": "Imehifadhiwa",
    "date & time": "Tarehe na Muda",
    "items purchased": "Bidhaa Zilizonunuliwa",
    "sub-total": "Jumla Ndogo",
    "tax / vat": "Kodi / VAT",
    "grand total": "Jumla Kuu",
    "balance due": "Deni Lililobaki",
    "pcs": "vipande",
    "customer info": "Taarifa za Mteja",
    "client name": "Jina la Mteja",
    "client phone": "Simu ya Mteja",
    "transaction details": "Taarifa za Muamala",
    "sale date": "Tarehe ya Mauzo",
    "adjust amount paid initially": "Rekebisha Kiasi Kilicholipwa Awali",
    "update transaction cart items": "Badilisha Bidhaa za Mauzo",
    "cancel changes": "Ghairi Mabadiliko",
    "new estimated total bill": "Jumla Mpya Inayokadiriwa",
    "vat taxes estimated": "Kodi ya VAT Inayokadiriwa",
    "invoice no": "Namba ya Ankara",
    "thank you for shopping with us": "Asante kwa kununua kwetu.",
    "thank you for shopping with us.": "Asante kwa kununua kwetu.",
    "original sale audit info": "Taarifa Asili za Ukaguzi wa Mauzo",
    "initial payment mode": "Njia ya Malipo ya Awali",
    "sale timestamp": "Tarehe ya Mauzo",
    "historical transactions timeline": "Historia ya Miamala",
    "paid amount": "Kiasi Kilicholipwa",
    "fully paid at checkout": "Imelipwa Kikamilifu Wakati wa Malipo",
    "posted on": "Iliwekwa tarehe",
    "using": "kwa kutumia",
    "settled invoice": "Imekamilika",
    "no balance due.": "Hakuna Deni Lililobaki.",
    "done auditing": "Maliza Ukaguzi",
    "send": "Tuma",
    "no:": "Namba:",
    "sales associate": "Msaidizi wa Mauzo",
    "tel": "Simu",
    "a4 invoice": "Ankara ya A4",
    "pending dispatch": "Inasubiri Kutuma",
    "on route": "Njiani",
    "revenue": "Mapato",
    "jobs": "Kazi",
    "crew": "Wafanyakazi",
    "report": "Ripoti",
    "search deliveries...": "Tafuta delivari...",
    "destination address not provided": "Anwani ya kufikishia haijawekwa",
    "category name": "Jina la Kundi",
    "all registered items": "Bidhaa Zote Zilizosajiliwa",
    "register new brand": "Sajili Chapa Mpya",
    "brand name": "Jina la Chapa",
    "brand logo / visual mark": "Nembo ya Chapa",
    "no logo": "Hakuna Nembo",
    "product brands": "Chapa za Bidhaa",
    "all brands": "Chapa Zote",
    "products grid": "Bidhaa",
    "showing active system registry lines under selected brand house labels.": "Inaonyesha bidhaa za chapa uliyochagua.",
    "output format roll size": "Ukubwa wa Karatasi",
    "thermal roll": "Rolli ya Joto",
    "a4 sticker sheet": "Karatasi ya Stika A4",
    "24 labels / a4 page": "Lebo 24 / Ukurasa wa A4",
    "with name & price": "Jina na Bei",
    "with name & barcode": "Jina na Msimbo wa Bidhaa",
    "only barcode": "Msimbo wa Bidhaa Pekee",
    "barcode only": "Msimbo wa Bidhaa pekee",
    "queue totals": "Jumla ya Foleni",
    "selected products:": "Bidhaa Zilizochaguliwa:",
    "items": "Bidhaa",
    "total ticket copies:": "Jumla ya Nakala:",
    "tags": "lebo",
    "output paper:": "Aina ya Karatasi:",
    "thermal adhesive roll": "Rolli ya Lebo za Joto",
    "standard flat a4 sheet (24-grid)": "Karatasi ya A4 (gridi 24)",
    "print job successfully transmitted to orvix printer. check feed.": "Imetumwa kwa printer. Angalia karatasi.",
    "print via orvix thermal printer": "Chapisha kwa Printer ya Orvix",
    "ready to print 50×30mm labels.": "Tayari kuchapisha lebo za 50×30mm.",
    "download a4 sticker sheet": "Pakua Karatasi ya Stika A4",
    "exports standalone print-ready html template with perfect 4x6 grid alignments.": "Inapakua faili tayari kuchapisha (gridi 4x6).",
    "1. product print queue selection": "1. Chagua Bidhaa za Kuchapisha",
    "choose items to print barcodes": "Chagua bidhaa za kuchapisha misimbo",
    "selected print queue": "Foleni Iliyochaguliwa",
    "paper size": "Ukubwa wa Karatasi",
    "2. label paper & output": "2. Karatasi ya Lebo",
    "link & print diagnostics": "Uchunguzi wa Uchapishaji",
    "status link": "Hali ya Muunganisho",
    "active link": "Imeunganishwa",
    "50mm roll": "Rolli ya 50mm",
    "copies:": "Nakala:",
    "print layout preview (wysiwyg layout simulation)": "Muonekano wa Uchapishaji",
    "thermal label preview.": "Muonekano wa Lebo ya Joto.",
    "thermal continuous sticker (50mm x 30mm)": "Stika ya Joto Endelevu (50mm x 30mm)",
    "view sale": "Angalia Uuzaji",
    "add payment": "Ongeza Malipo",
    "edit sale": "Hariri Uuzaji",
    "pos receipt": "Risiti ya Mauzo",
    "invoice": "Ankara",
    "delete sale": "Futa Uuzaji",
    "search": "Tafuta",
    "filter": "Chuja",
    "date range filter": "Chaguo la Tarehe",
    "from": "Kutoka",
    "to": "Hadi",
    "apply": "Tumia",
    "sync state": "Hali ya Sync",
    "point of sale": "Uza",
    "search products": "Tafuta bidhaa",
    "scan barcode": "Scan msimbo",
    "all categories": "Makundi Yote",
    "add to cart": "Weka Kikapuni",
    "cart": "Kikapu",
    "checkout": "Lipia",
    "subtotal": "Jumla Ndogo",
    "tax": "Kodi",
    "discount": "Punguzo",
    "total": "Jumla",
    "product not found": "Bidhaa haipatikani",
    "out of stock": "Haina stoki",
    "item not in system": "Bidhaa haipo kwenye mfumo",
    "in stock": "Ipo Stoki",
    "low stock": "Stoki Kidogo",
    "quantity": "Idadi",
    "price": "Bei",
    "remove": "Ondoa",
    "clear cart": "Futa Kikapu",
    "process sale": "Fanya Uuzaji",
    "product name": "Jina la Bidhaa",
    "sku": "Nambari ya Bidhaa",
    "barcode": "Msimbo wa Bidhaa",
    "category": "Kundi",
    "unit": "Kipimo",
    "cost price": "Bei ya Gharama",
    "selling price": "Bei ya Uuzaji",
    "stock quantity": "Kiasi cha Stoki",
    "alert quantity": "Kiasi cha Onyo",
    "brand": "Chapa",
    "wholesale price": "Bei ya Jumla",
    "add product": "Ongeza Bidhaa",
    "edit product": "Hariri Bidhaa",
    "delete product": "Futa Bidhaa",
    "shop stock": "Stoki ya Duka",
    "store stock": "Stoki ya Ghala",
    "allows dosage dividing": "Ruhusu Kugawanya Dozi",
    "sell in retail": "Uza Rejareja",
    "sell in wholesale": "Uza Jumla",
    "tabs per pack": "Vidonge kwa Pakiti",
    "procured supply records list": "Orodha ya Manunuzi",
    "timestamp": "Tarehe",
    "purchase id": "Nambari ya Ununuzi",
    "warehouse supplier": "Msambazaji",
    "restock target": "Lengo la Kujaza",
    "procured item details": "Maelezo ya Bidhaa",
    "invoice sum": "Jumla ya Ankara",
    "settled amount": "Kiasi Kilicholipwa",
    "outstanding credit": "Mkopo Uliobaki",
    "dispatch status": "Hali ya Usafirishaji",
    "backroom store": "Stoo",
    "full delivered": "Imefika Yote",
    "all targets": "Malengo Yote",
    "all payments": "Malipo Yote",
    "newest first": "Mapya Kwanza",
    "add supplier purchase": "Ongeza Ununuzi wa Msambazaji",
    "purchase history": "Historia ya Manunuzi",
    "supplier name": "Jina la Msambazaji",
    "total amount": "Jumla ya Kiasi",
    "delivery status": "Hali ya Utoaji",
    "delivery fee": "Ada ya Utoaji",
    "official document": "Hati Rasmi",
    "price quote": "Nukuu ya Bei",
    "invoice number": "Nambari ya Ankara",
    "quotation number": "Nambari ya Nukuu",
    "date issued": "Tarehe ya Kutolewa",
    "branch office": "Ofisi ya Tawi",
    "billed to": "Ankara kwa (Mteja)",
    "delivery destination": "Mahali pa Kupeleka",
    "qty": "Idadi",
    "unit rate": "Bei ya Kipimo",
    "items sub total": "Jumla Ndogo ya Bidhaa",
    "grand total due": "Jumla Kubwa Inayostahili",
    "settlements account": "Akaunti ya Malipo",
    "configure corporate accounts": "Sanidi akaunti za kampuni katika Mipangilio",
    "prepared by": "Imeandaliwa Na",
    "title": "Cheo",
    "signature": "Sahihi",
    "thank you for your business": "Asante kwa biashara yako",
    "we value your partnership": "Tunathamini ushirikiano wako",
    "add expense": "Ongeza Matumizi",
    "+ add expense": "+ Ongeza",
    "expense category": "Kundi la Matumizi",
    "description": "Maelezo",
    "receipt reference": "Kumbukumbu ya Risiti",
    "receipt image": "Picha ya Risiti",
    "transaction message": "Ujumbe wa Muamala",
    "note": "Kumbuka",
    "contact person": "Mtu wa kuwasiliana nae",
    "phone": "Simu",
    "email": "Barua Pepe",
    "add supplier": "Ongeza Msambazaji",
    "edit supplier": "Hariri Msambazaji",
    "delete supplier": "Futa Msambazaji",
    "customer name": "Jina la Mteja",
    "add customer": "Ongeza Mteja",
    "customer phone": "Simu ya Mteja",
    "customer address": "Anwani ya Mteja",
    "rider": "Dereva",
    "dispatched": "Imetumwa",
    "delivered": "Imefikishwa",
    "cancelled": "Imesitishwa",
    "dispatch": "Tuma",
    "assign rider": "Chagua Dereva",
    "notes": "Maelezo",
    "delivery cost": "Ada ya Utoaji",
    "sales report": "Ripoti ya Mauzo",
    "inventory report": "Ripoti ya Ghala",
    "expense report": "Ripoti ya Matumizi",
    "purchase report": "Ripoti ya Manunuzi",
    "profit and loss": "Faida na Hasara",
    "revenue generated": "Mapato Yaliyopatikana",
    "paid orders": "Oda Zilizolipiwa",
    "unpaid orders": "Oda Hazijalipwa",
    "profit generated": "Faida Iliyopatikana",
    "gross sales": "Mauzo Ghafi",
    "net profit": "Faida Halisi",
    "total tickets": "Jumla ya Tiketi",
    "margin": "Asilimia ya Faida",
    "general settings": "Mipangilio ya Jumla",
    "business name": "Jina la Biashara",
    "currency": "Sarafu",
    "tax rate": "Kiwango cha Kodi",
    "language": "Lugha",
    "dark mode": "Hali ya Giza",
    "light mode": "Hali ya Mwanga",
    "save logo": "Hifadhi Nembo",
    "upload logo": "Pakia Nembo",
    "change logo": "Badilisha Nembo",
    "profile": "Wasifu",
    "change password": "Badilisha Nywila",
    "business type": "Aina ya Biashara",
    "country": "Nchi",
    "city": "Mji",
    "mobile moneyproviders": "Watoa huduma wa malipo ya Simu",
    "invoice settings": "Mipangilio ya Ankara",
    "footer note": "Maelezo ya Chini",
    "show tax": "Onyesha Kodi",
    "save": "Hifadhi",
    "cancel": "Ghairi",
    "delete": "Futa",
    "edit": "Hariri",
    "add": "Ongeza",
    "export": "Hamisha",
    "print": "Chapisha",
    "confirm": "Thibitisha",
    "back": "Rudi",
    "close": "Funga",
    "next": "Endelea",
    "submit": "Wasilisha",
    "update": "Badilisha",
    "view": "Angalia",
    "download": "Pakua",
    "upload": "Pakia",
    "share": "Shirikisha",
    "refresh": "Onyesha Upya",
    "loading": "Inapakia",
    "success": "Imefanikiwa",
    "error": "Hitilafu",
    "warning": "Onyo",
    "no data available": "Hakuna Taarifa",
    "no sales yet": "Hakuna mauzo bado",
    "no products found": "Hakuna bidhaa",
    "something went wrong": "Kuna tatizo",
    "try again": "Jaribu tena",
    "saved successfully": "Imehifadhiwa",
    "deleted successfully": "Imefutwa",
    "updated successfully": "Imebadilishwa",
    "are you sure": "Una uhakika?",
    "this cannot be undone": "Haiwezi kurudishwa",
    "yes": "Ndiyo",
    "no": "Hapana",
    "sign out": "Toka",
    "welcome back": "Karibu tena",
    "active": "Inafanya kazi",
    "inactive": "Haifanyi kazi",
    "online": "Mtandaoni",
    "offline": "Bila Mtandao",
    "syncing": "Inapakia",
    "synced": "Imepakiwa",
    "name": "Jina",
    "date": "Tarehe",
    "amount": "Kiasi",
    "status": "Hali",
    "actions": "Vitendo",
    "no results": "Hakuna matokeo",
    "required": "Inahitajika",
    "optional": "Si lazima",
    "select option": "Chagua chaguo",
    "enter amount": "Ingiza kiasi",
    "enter name": "Ingiza jina",
    "select date": "Chagua tarehe",
    "business dashboard ready": "Dashibodi yako ya biashara iko tayari",
    "welcome message": "Karibu kwenye mfumo wako wa biashara",
    "sign in": "Ingia",
    "sign up": "Jisajili",
    "create account": "Fungua Akaunti",
    "free trial": "Jaribio la Bure",
    "full name": "Jina Kamili",
    "password": "Nywila",
    "confirm password": "Thibitisha Nywila",
    "forgot password": "Umesahau Nywila",
    "reset password": "Weka Upya Nywila",
    "africa commerce o s": "Mfumo wa Biashara Afrika",

    // Roles
    "staff members": "Wafanyakazi",
    "seller": "Muuzaji",
    "manager": "Meneja",
    "admin": "Msimamizi",
    "stock controller": "Mdhibiti wa Stoki",
    "delivery rider": "Dereva wa Utoaji",
    "pharmacist": "Mfamasia",
    "accountant": "Mhasibu",
    "supervisor": "Msimamizi wa Kazi",
    "role": "Jukumu",
    "roles": "Majukumu",
    "permissions": "Ruhusa",
    "custom roles & permissions": "Majukumu na Ruhusa Maalum",
    "role name": "Jina la Jukumu",
    "add role": "Ongeza Jukumu",
    "delete role": "Futa Jukumu",
    "edit role": "Hariri Jukumu",

    // UI labels that were mixing languages
    "search workspace...": "Tafuta...",
    "search workspace": "Tafuta",
    "delivery menu": "Menyu ya Utoaji",
    "sales forecasting": "Utabiri wa Mauzo",
    "cash & bank": "Pesa na Benki",
    "subscription": "Usajili",
    "ledger analytics": "Uchambuzi wa Daftari",

    // Settings page labels
    "system & branch configurations": "Mipangilio ya Mfumo na Tawi",
    "invoice & branding customization": "Ankara na Muonekano wa Chapa",
    "notifications & auto reports": "Arifa na Ripoti za Kiotomatiki",
    "active configurations layout": "Mpangilio wa Usanidi Unaotumika",
    "system module / functionality": "Moduli ya Mfumo / Kazi",
    "read": "Soma",
    "write": "Andika",
    "point of sale (pos)": "Uza (POS)",
    "products management": "Usimamizi wa Bidhaa",
    "purchases management": "Usimamizi wa Manunuzi",
    "suppliers management": "Usimamizi wa Wasambazaji",
    "expenses management": "Usimamizi wa Matumizi",
    "sales & expenses reports": "Ripoti za Mauzo na Matumizi",
    "profit & cogs reports": "Ripoti za Faida na Gharama",
    "settings access": "Ufikiaji wa Mipangilio",

    // Registration & login
    "whatsapp / mobile number": "Namba ya WhatsApp / Simu",
    "business industry niche / type": "Aina ya Biashara",
    "retail & wholesale": "Rejareja na Jumla",
    "pharmacy": "Duka la Dawa",
    "region of operations": "Mkoa wa Shughuli",
    "city / office location": "Mji / Ofisi",
    "company / business name": "Jina la Kampuni / Biashara",
    "owner full name": "Jina Kamili la Mmiliki",
    "owner pin password": "PIN / Nywila ya Mmiliki",
    "used to sign in & receive otp resets": "Inatumika kuingia na kupokea OTP",
    "your whatsapp / mobile number": "Namba yako ya WhatsApp / Simu",
    "continue": "Endelea",
    "call local agent": "Piga Simu Wakala",
    "contact for deployment": "Wasiliana kwa Usanidi",

    // Dashboard screen header
    "pos screen": "Uza",
    "overview screen": "Muhtasari",
    "products screen": "Bidhaa",
    "settings screen": "Mipangilio",
    "reports screen": "Ripoti",
    "expenses screen": "Matumizi",
    "suppliers screen": "Wasambazaji",
    "customers screen": "Wateja",
    "deliveries screen": "Utoaji",
    "inventory screen": "Ghala",
    "forecasting screen": "Utabiri",
    "cash-bank-matrix screen": "Pesa na Benki",

    // Product catalogue
    "product catalogue": "Orodha ya Bidhaa",
    "category directories": "Makundi ya Bidhaa",
    "brand directories": "Chapa za Bidhaa",
    "label directories": "Lebo za Bidhaa",
    "add new product": "Ongeza Bidhaa Mpya",
    "enter product name": "Ingiza jina la bidhaa",
    "enter brand name": "Ingiza jina la chapa",
    "enter category": "Ingiza kundi",
    "no products yet": "Hakuna bidhaa bado",
    "add your first product": "Ongeza bidhaa yako ya kwanza",

    "inventory sales distribution": "Mgawanyo wa mauzo ya bidhaa",
    "real-time audit log with operational action menus": "Daftari la ukaguzi wa papo hapo lenye menyu za vitendo",
    "products below security thresholds": "Bidhaa zilizo chini ya kiwango cha usalama wa stoki",
    "operational integrity intact": "Uendeshaji uko salama",
    "all items are stocked above target safety levels": "Bidhaa zote zipo juu ya kiwango cha tahadhari cha stoki",
    "search code, barcode or title": "Tafuta msimbo, barcode au jina",
    "scan barcode / qr ean code with reader": "Changanua barcode / QR / EAN kwa kisomaji",
    "void / clear entire basket": "Futa au safisha kikapu chote",
    "live manager override station": "Kituo cha ruhusa ya meneja",
    "enter supervisor override code": "Ingiza PIN ya msimamizi",
    "conflict overrides action log": "Kumbukumbu ya maombi ya ruhusa maalum",
    "awaiting layout selection and customer assignment": "Inasubiri kuchagua mpangilio na mteja",
    "customer identity (required for store credit)": "Utambulisho wa mteja (unahitajika kwa mkopo)",
    "phone number (optional)": "Namba ya simu (si lazima)",
    "select active payment rail": "Chagua njia ya malipo inayotumika",
    "multi-channel split breakdown": "Mchanganuo wa malipo kwa njia zaidi ya moja",
    "confirm & initialize payment": "Thibitisha na anzisha malipo",
    "communicating with payment server": "Inawasiliana na seva ya malipo",
    "simulated push dispatched": "Ombi la malipo limetumwa",
    "cloud synchronized ledger node": "Daftari limeunganishwa na mfumo wa wingu",
    "phone with country code": "Namba ya simu pamoja na msimbo wa nchi",
    "choose payment mode for detailed date-based metrics": "Chagua njia ya malipo kuona takwimu za tarehe",
    "liquidity & consolidated cash flow": "Ukwasi na mtiririko wa pesa kwa ujumla",
    "total payment in (inflows)": "Jumla ya pesa zilizoingia",
    "total payment out (outflows)": "Jumla ya pesa zilizotoka",
    "net outcome in selected range": "Matokeo halisi kwenye kipindi ulichochagua",
    "central vaults & bank accounts": "Hazina kuu na akaunti za benki",
    "add where money can be sent": "Ongeza mahali pesa zinaweza kutumwa",
    "why are you moving this money": "Kwa nini unahamisha pesa hizi?",
    "accounts transfer guidelines": "Mwongozo wa kuhamisha pesa",
    "select core source account": "Chagua akaunti ya kutoa pesa",
    "select target wallet or bank": "Chagua wallet au benki ya kupokea",
    "provide audited verification slip": "Weka risiti au uthibitisho wa muamala",
    "selected payment mode details": "Maelezo ya njia ya malipo iliyochaguliwa",
    "sum outcome inside date range": "Jumla ya matokeo ndani ya tarehe zilizochaguliwa",
    "set as transfer source & open panel": "Weka kama chanzo cha pesa na fungua paneli",
    "account history & transactions": "Historia ya akaunti na miamala",
    "search transactions": "Tafuta miamala",
    "all systems running normally": "Mifumo yote inaendelea vizuri",
    "enter company legal registry name": "Ingiza jina rasmi la kampuni",
    "generated company username/key": "Jina/key ya kampuni iliyotengenezwa",
    "generated based on company name for subdomain routing": "Imetengenezwa kutokana na jina la kampuni kwa ajili ya njia ya subdomain",
    "verification email address": "Barua pepe ya uthibitisho",
    "corporate headquarters address": "Anwani ya makao makuu ya kampuni",
    "legal street, plot no, city, country": "Mtaa rasmi, kiwanja, mji, nchi",
    "company tin (taxpayer identification number)": "TIN ya kampuni (namba ya mlipa kodi)",
    "company vat registration number": "Namba ya usajili wa VAT ya kampuni",
    "vat-yyyyyy-y (if applicable)": "VAT-YYYYYY-Y (kama inahusika)",
    "legal payment currency symbol": "Alama ya sarafu ya malipo",
    "supported formats: jpg, png, webp. maximum file size: 2mb": "Miundo inayokubalika: JPG, PNG, WEBP. Ukubwa wa juu: 2MB",
    "enter business brand name": "Ingiza jina la biashara",
    "contact helpline / phone no": "Namba ya msaada / simu",
    "helpline displayed on layouts": "Namba ya msaada inayoonekana kwenye nyaraka",
    "show product pictures in pos": "Onyesha picha za bidhaa kwenye POS",
    "active cashier till payments": "Njia za malipo za keshia zinazotumika",
    "click to remove payment channel": "Bofya kuondoa njia ya malipo",
    "add custom method": "Ongeza njia maalum",
    "active delivery settings (payment methods)": "Mipangilio ya delivari (njia za malipo)",
    "no delivery payment methods. pos default will be applied": "Hakuna njia za malipo ya delivari. Njia za POS zitatumika",
    "registered warehouses & store stock locations": "Maghala na maeneo ya stoki yaliyosajiliwa",
    "de-register store storage bin": "Ondoa eneo la stoki lililosajiliwa",
    "authorized measurement units (uom)": "Vipimo vilivyoidhinishwa (UOM)",
    "tax identification number (tin)": "Namba ya mlipa kodi (TIN)",
    "add a new term or policy clause": "Ongeza sharti au kipengele kipya",
    "register new staff profile": "Sajili mfanyakazi mpya",
    "profile photo (500x500 pix)": "Picha ya wasifu (500x500 px)",
    "png signature (500x500 pix)": "Sahihi ya PNG (500x500 px)",
    "unified stock registry desk": "Sehemu kuu ya usajili wa stoki",
    "download spreadsheet template": "Pakua template ya spreadsheet",
    "fits images & separates background instantly": "Inatosha picha na kuondoa background papo hapo",
    "retail scan barcode (acts as sku item code)": "Barcode ya rejareja (hutumika kama SKU)",
    "leave blank to auto-create sku": "Acha wazi ili SKU itengenezwe moja kwa moja",
    "define packet, dose and tab selling": "Weka uuzaji kwa pakiti, dozi na kidonge",
    "packet, dose, half dose and tab pricing": "Bei za pakiti, dozi, nusu dozi na kidonge",
    "search and select items to print barcodes for": "Tafuta na chagua bidhaa za kuchapisha barcode",
    "type product name or barcode to add": "Andika jina la bidhaa au barcode kuongeza",
    "barcode label layout option": "Mpangilio wa label ya barcode",
    "shows name, price & barcode": "Inaonyesha jina, bei na barcode",
    "shows name & barcode text (no price)": "Inaonyesha jina na barcode bila bei",
    "shows only the scan barcode bars": "Inaonyesha mistari ya barcode pekee",
    "ready for direct printing or local downloads": "Tayari kuchapishwa au kupakuliwa",
    "outbound stock pulling logic": "Kanuni ya kutoa stoki wakati wa kuuza",
    "stock replenishment & prices": "Kuongeza stoki na bei",
    "new buying cost (per unit)": "Gharama mpya ya kununua kwa kipimo",
    "configure new selling price": "Weka bei mpya ya kuuza",
    "no changes to selling price": "Hakuna mabadiliko ya bei ya kuuza",
    "quotations & proforma invoices": "Nukuu na proforma invoice",
    "filter invoice ledger list by customized date intervals": "Chuja orodha ya ankara kwa tarehe ulizochagua",
    "search receipt id, client customer name": "Tafuta ID ya risiti au jina la mteja",
    "outstanding sales invoices marked as credit tabs": "Ankara za mauzo zenye mkopo uliobaki",
    "total payment-ins collected": "Jumla ya malipo yaliyopokelewa",
    "remaining customer dockets debt pending settlement": "Deni la mteja lililobaki kusubiri kulipwa",
    "filter by customer, phone, or ticket ref": "Chuja kwa mteja, simu au kumbukumbu ya tiketi",
    "settle outstanding payment-in": "Lipa salio lililobaki",
    "submit payment-in reference": "Wasilisha kumbukumbu ya malipo",
    "new commercial sales document wizard": "Tengeneza hati mpya ya mauzo",
    "billing & delivery address": "Anwani ya malipo na delivari",
    "invoice footer tagline / memo": "Ujumbe wa chini wa ankara",
    "product search & picker tool": "Tafuta na chagua bidhaa",
    "select and add catalog items above": "Chagua na ongeza bidhaa hapo juu",
    "a4 office print preview mode": "Muonekano wa kuchapisha A4",
    "configure corporate accounts & bank keys in settings": "Sanidi akaunti za kampuni na benki kwenye mipangilio",
    "inspect client receipt details": "Kagua maelezo ya risiti ya mteja",
    "collect due balance installment": "Kusanya malipo ya salio",
    "update customer details or items": "Badilisha maelezo ya mteja au bidhaa",
    "view or print thermal slip": "Angalia au chapisha risiti ndogo",
    "print standard a4 pdf document": "Chapisha hati ya PDF ya A4",
    "void transaction indices permanently": "Futa muamala kabisa",
    "unified branch accounts & reports": "Akaunti na ripoti za tawi",
    "commercial profit & loss account": "Akaunti ya faida na hasara",
    "search customer, staff code, item": "Tafuta mteja, mfanyakazi au bidhaa",
    "no transactions matched research parameters": "Hakuna miamala iliyolingana na vigezo",
    "received payments & channel ledger": "Malipo yaliyopokelewa na daftari la njia za malipo",
    "date aggregated timeline transactions": "Miamala iliyopangwa kwa tarehe",
    "stock valuations & warehouse split": "Thamani ya stoki na mgawanyo wa ghala",
    "customer totals and credit": "Jumla za wateja na mikopo",
    "operating expenses logs receipt": "Kumbukumbu ya matumizi ya uendeshaji",
    "daily sales volume timeline": "Mtiririko wa mauzo ya kila siku",
    "select an audited branch segment to inspect": "Chagua sehemu ya tawi ya kukagua",
    "no sales transactions found in selected period": "Hakuna mauzo katika kipindi ulichochagua",
    "no operating expenses recorded within selected range": "Hakuna matumizi ndani ya kipindi ulichochagua",
    "no logistics delivery transactions logged yet": "Hakuna miamala ya delivari iliyorekodiwa bado",

    "open workspace menu": "Fungua menyu ya mfumo",
    "collapse sidebar": "Funga menyu ya pembeni",
    "cloud network connected": "Mtandao umeunganishwa",
    "local mode (offline)": "Hali ya kifaa bila mtandao",
    "device is online": "Kifaa kiko mtandaoni",
    "device is offline": "Kifaa hakiko mtandaoni",
    "switch to day mode": "Badili kwenda mwanga",
    "switch to dark mode": "Badili kwenda giza",
    "switch to light mode": "Badili kwenda mwanga",
    "select language": "Chagua lugha",
    "select language / badili lugha": "Chagua lugha",
    "select language / velg pris / badili lugha": "Chagua lugha",
    "talk to lucy": "Ongea na Lucy",
    "english": "Kiingereza",
    "swahili": "Kiswahili",
    "sign out failed, please try again": "Kutoka kumeshindikana, jaribu tena",
    "system subscription options": "Chaguo za vifurushi vya mfumo",
    "manage active subscriptions and premium account plans easily to expand store limits.": "Simamia vifurushi na mipango ya akaunti ili kuongeza uwezo wa duka.",
    "no tenant suite available": "Hakuna akaunti ya biashara iliyopo",
    "my jasper suite": "Orvix yangu",
    "profile settings": "Mipangilio ya wasifu",
    "preferences": "Mapendeleo",
    "system settings": "Mipangilio ya mfumo",
    "business setup": "Mpangilio wa biashara",
    "business settings": "Mipangilio ya biashara",
    "company level settings": "Mipangilio ya kampuni",
    "configure core business metadata, localized compliance tin/vat numbers, legal currency markers, and system color mode preferences.": "Sanidi taarifa kuu za biashara, namba za TIN/VAT, sarafu na mapendeleo ya muonekano.",
    "company legal name": "Jina rasmi la kampuni",
    "company code": "Msimbo wa kampuni",
    "email address": "Barua pepe",
    "direct phone line": "Namba ya simu",
    "company address": "Anwani ya kampuni",
    "vat number": "Namba ya VAT",
    "auto-generated-key": "msimbo wa moja kwa moja",
    "auto-created from your company name.": "Hutengenezwa kutokana na jina la kampuni.",
    "enter company legal registry name...": "Weka jina rasmi la kampuni...",
    "business profile": "Wasifu wa biashara",
    "business phone": "Simu ya biashara",
    "business email": "Barua pepe ya biashara",
    "business address": "Anwani ya biashara",
    "tagline": "Kauli mbiu",
    "payment methods": "Njia za malipo",
    "delivery payment methods": "Njia za malipo ya delivari",
    "store locations": "Maeneo ya stoo",
    "store location": "Eneo la stoo",
    "add payment method": "Ongeza njia ya malipo",
    "add delivery payment method": "Ongeza njia ya malipo ya delivari",
    "add store location": "Ongeza eneo la stoo",
    "add category": "Ongeza kundi",
    "add unit": "Ongeza kipimo",
    "new category": "Kundi jipya",
    "new unit": "Kipimo kipya",
    "categories": "Makundi",
    "units": "Vipimo",
    "registered categories": "Makundi yaliyosajiliwa",
    "registered units": "Vipimo vilivyosajiliwa",
    "save settings": "Hifadhi mipangilio",
    "save changes": "Hifadhi mabadiliko",
    "update settings": "Sasisha mipangilio",
    "saving": "Inahifadhi",
    "saving...": "Inahifadhi...",
    "saved": "Imehifadhiwa",
    "registered": "Imesajiliwa",
    "enabled": "Imewashwa",
    "disabled": "Imezimwa",
    "on": "Washa",
    "off": "Zima",
    "onboarding": "Usajili wa mwanzo",
    "overview": "Muhtasari",
    "sales list": "Orodha ya mauzo",
    "purchases list": "Orodha ya manunuzi",
    "cash bank matrix": "Fedha na benki",
    "forecasting": "Utabiri",
    "lucy ai": "Lucy AI",
    "lucy assistant": "Msaidizi Lucy",
    "quick sale": "Uuzaji wa haraka",
    "quick actions": "Vitendo vya haraka",
    "today's sales": "Mauzo ya leo",
    "todays sales": "Mauzo ya leo",
    "today's sale": "Uuzaji wa leo",
    "items sold": "Bidhaa zilizouzwa",
    "total spending": "Jumla ya matumizi",
    "profit margin": "Asilimia ya faida",
    "dues owed": "Madeni yanayodaiwa",
    "orders": "Oda",
    "order": "Oda",
    "buying": "Ununuzi",
    "profit": "Faida",
    "recent sales": "Mauzo ya karibuni",
    "sales trend": "Mwenendo wa mauzo",
    "purchase trend": "Mwenendo wa manunuzi",
    "hali ya mauzo na manunuzi": "Hali ya mauzo na manunuzi",
    "sales & purchase status": "Hali ya mauzo na manunuzi",
    "top products": "Bidhaa zinazoongoza",
    "best sellers": "Bidhaa zinazouza zaidi",
    "stock alerts": "Tahadhari za stoki",
    "low stock alerts": "Tahadhari za stoki ndogo",
    "register new product": "Sajili bidhaa mpya",
    "new product": "Bidhaa mpya",
    "bulk upload": "Pakia kwa wingi",
    "bulk template": "Template ya kupakia kwa wingi",
    "download template": "Pakua template",
    "upload spreadsheet": "Pakia spreadsheet",
    "descriptor & visual assets": "Maelezo na picha",
    "product name / title": "Jina la bidhaa",
    "select category": "Chagua kundi",
    "product brand": "Chapa ya bidhaa",
    "product image": "Picha ya bidhaa",
    "no image": "Hakuna picha",
    "upload product image": "Pakia picha ya bidhaa",
    "removes image background.": "Huondoa background ya picha.",
    "canvas processing": "Inachakata picha",
    "barcode controls & stock": "Barcode na stoki",
    "low stock alert level": "Kiwango cha tahadhari ya stoki",
    "set low-stock alert.": "Weka tahadhari ya stoki ndogo.",
    "channel rules & costs": "Kanuni za mauzo na gharama",
    "active selling channels": "Njia za mauzo zinazotumika",
    "sell retail": "Uza rejareja",
    "sell wholesale": "Uza jumla",
    "retail price": "Bei ya rejareja",
    "min wholesale qty": "Kiasi cha chini cha jumla",
    "locked": "Imefungwa",
    "product markup": "Ongezeko la bei",
    "margin gain per unit": "Faida kwa kipimo",
    "smart batch costing": "Gharama za batch kwa akili",
    "fifo, average, and batch price control.": "Udhibiti wa FIFO, wastani na bei ya batch.",
    "cashier override": "Ruhusu cashier kubadilisha",
    "package name": "Jina la pakiti",
    "sell / count unit": "Kipimo cha kuuza/kuhesabu",
    "1 package contains": "Pakiti moja ina",
    "pharmacy unit hierarchy": "Mpangilio wa vipimo vya pharmacy",
    "choose the product type, starting level, and how many units each level contains.": "Chagua aina ya bidhaa, ngazi ya kuanzia na vipimo vilivyomo kwenye kila ngazi.",
    "product type": "Aina ya bidhaa",
    "pharmaceutical": "Dawa",
    "non-pharmaceutical": "Siyo dawa",
    "starting level": "Ngazi ya kuanzia",
    "lowest unit": "Kipimo cha chini",
    "strips per box": "Strip kwa box",
    "cartons per master box": "Carton kwa box kubwa",
    "dose / middle price": "Bei ya dozi/ngazi ya kati",
    "auto if empty": "Itajazwa moja kwa moja ukiacha wazi",
    "retail package selling": "Uuzaji wa pakiti rejareja",
    "sell mode": "Njia ya kuuza",
    "base unit": "Kipimo cha msingi",
    "quick sale portions": "Sehemu za uuzaji wa haraka",
    "default portion qty": "Kiasi cha kawaida cha sehemu",
    "whole package sale value": "Thamani ya kuuza pakiti nzima",
    "cost of purchase": "Gharama ya ununuzi",
    "search products...": "Tafuta bidhaa...",
    "shop": "Duka",
    "store": "Stoo",
    "alert": "Tahadhari",
    "ledger actions": "Vitendo",
    "view details": "Angalia maelezo",
    "edit item": "Hariri bidhaa",
    "replenish stock": "Ongeza stoki",
    "delete item": "Futa bidhaa",
    "view product": "Angalia bidhaa",
    "stock replenishment": "Kuongeza stoki",
    "quantity added": "Kiasi kilichoongezwa",
    "supplier": "Msambazaji",
    "staff control center": "Kituo cha wafanyakazi",
    "staff & hr": "Wafanyakazi na HR",
    "register staff": "Sajili mfanyakazi",
    "registered staff": "Wafanyakazi waliosajiliwa",
    "registered staff accounts": "Akaunti za wafanyakazi zilizosajiliwa",
    "staff member": "Mfanyakazi",
    "staff type": "Aina ya mfanyakazi",
    "standard staff": "Mfanyakazi wa kawaida",
    "staff onboarding": "Usajili wa mfanyakazi",
    "save registration": "Hifadhi usajili",
    "edit login": "Hariri login",
    "save login": "Hifadhi login",
    "staff payroll, sessions and performance": "Mishahara, session na utendaji wa wafanyakazi",
    "overall report": "Ripoti ya jumla",
    "total staff": "Jumla ya wafanyakazi",
    "online now": "Waliopo mtandaoni",
    "active staff": "Wafanyakazi hai",
    "temporary staff": "Wafanyakazi wa muda",
    "total allowances": "Jumla ya posho",
    "total payroll": "Jumla ya mishahara",
    "total staff cost": "Gharama yote ya mfanyakazi",
    "orders / tx": "Oda / miamala",
    "username": "Jina la kuingia",
    "phone number": "Namba ya simu",
    "department": "Idara",
    "salary": "Mshahara",
    "salary type": "Aina ya mshahara",
    "allowance": "Posho",
    "allowances": "Posho",
    "permanent": "Wa kudumu",
    "temporary": "Wa muda",
    "monthly": "Kila mwezi",
    "weekly": "Kila wiki",
    "daily": "Kila siku",
    "waiter": "Mhudumu",
    "analytics": "Uchambuzi",
    "export pdf": "Pakua PDF",
    "export csv": "Pakua CSV",
    "download pdf": "Pakua PDF",
    "download csv": "Pakua CSV",
    "print report": "Chapisha ripoti",
    "filter report": "Chuja ripoti",
    "create": "Tengeneza",
    "import": "Pakia",
    "retry": "Jaribu tena",
    "loading...": "Inapakia...",
    "all": "Zote",
    "none": "Hakuna",
    "pending sync": "Inasubiri sync",
    "last sync": "Sync ya mwisho",
    "sync now": "Sync sasa",
    "dashboard ads": "Matangazo ya dashboard",
    "dashboard ad placement": "Sehemu ya tangazo la dashboard",
    "sticky bottom ad banner": "Tangazo la chini linalobaki",
    "save / edit ad code": "Hifadhi / hariri code ya tangazo",
    "save ad code": "Hifadhi code ya tangazo",
    "save / edit bottom ad": "Hifadhi / hariri tangazo la chini",
    "save bottom ad": "Hifadhi tangazo la chini",
    "dashboard ad code published.": "Code ya tangazo la dashboard imechapishwa.",
    "dashboard ad deleted and turned off.": "Tangazo la dashboard limefutwa na kuzimwa.",
    "sticky bottom ad published.": "Tangazo la chini limechapishwa.",
    "sticky bottom ad deleted and turned off.": "Tangazo la chini limefutwa na kuzimwa.",
    "ad exchange ssp": "Ad Exchange SSP",
    "ad placement": "Sehemu za matangazo",
    "ad placements": "Sehemu za matangazo",
    "ads by jb": "Matangazo ya JB",
    "promotional materials": "Vifaa vya matangazo",
    "copy": "Nakili",
    "copied": "Imenakiliwa",
    "preview": "Muonekano",
    "materials": "Vifaa",
    "video": "Video",
    "flyer": "Flyer",
    "image": "Picha",
    "open": "Fungua",
    "manage": "Simamia",
    "tasks": "Majukumu",
    "meetings": "Mikutano",
    "payouts": "Malipo",
    "code & link": "Code na link",
    "affiliate": "Affiliate",
    "partner": "Partner",
    "sub affiliates": "Sub affiliates",
    "organic subscribers": "Organic subscribers",
    "sub affiliate subscribers": "Sub affiliate subscribers",
    "tenant": "Tenant",
    "tenants": "Tenants",
    "package": "Kifurushi",
    "packages": "Vifurushi",
    "days remaining": "Siku zimebaki",
    "trial expired": "Majaribio yameisha",
    "subscribe": "Lipia kifurushi",
    "choose package": "Chagua kifurushi",
    "sales invoice": "Ankara ya Mauzo",
    "invoice to": "Ankara Kwa",
    "unit price": "Bei kwa Kimoja",
    "payment details": "Maelezo ya Malipo",
    "payment mode": "Njia ya Malipo",
    "account no.": "Namba ya Akaunti",
    "account name": "Jina la Akaunti",
    "terms & conditions": "Masharti na Vigezo",
    "authorized signature": "Sahihi Iliyoidhinishwa",
    "vat / tax": "VAT / Kodi",
    "walk-in customer": "Mteja wa Papo Hapo",
    "bill to": "Ankara Kwa",
    "powered by orvix": "Imeandaliwa na Orvix.africa",
    "powered by orvix.africa": "Imeandaliwa na Orvix.africa",
    "proforma invoice": "Ankara ya Awali",
    "quotation or proforma invoice": "Nukuu au Ankara ya Awali",
    "valid until": "Inatumika Hadi",
    "approved": "Imeidhinishwa",
    "vat": "VAT",

    // Found via a live Swahili-mode scan of the public login/landing pages
    // (their [Missing Translation] console warnings) -- real gaps, not text
    // that was already hardcoded in Swahili in the component.
    "african merchant os": "Mfumo wa Kibiashara Afrika",
    "loading…": "Inapakia…",
    "loading orvix": "Inapakia Orvix",
    "loading your business workspace": "Inapakia mfumo wako wa biashara",
    "orvix website": "Tovuti ya Orvix",
    "orvix pos and inventory management": "Orvix POS na usimamizi wa bidhaa",

    // Found via a full audit of the dashboard sidebar/menu, the global
    // branch switcher, and the per-tab search bar -- all were rendering
    // plain English because the exact phrase was missing from this
    // dictionary (the auto-translator can only translate a phrase it has
    // an entry for).
    "money & bank": "Pesa na Benki",
    "branches": "Matawi",
    "branch": "Tawi",
    "sell": "Uza",
    "stock": "Stoki",
    "partners": "Washirika",
    "money": "Pesa",
    "planning": "Mipango",
    "approvals": "Idhini",
    "placements": "Sehemu za Matangazo",
    "ads": "Matangazo",
    "chats": "Mazungumzo",
    "inbox": "Sanduku la Ujumbe",
    "activity": "Shughuli",
    "subscribers": "Wanachama",

    // Global branch switcher (GlobalBranchSwitcher.tsx)
    "switch branch": "Badilisha Tawi",
    "main": "Kuu",
    "main branch": "Tawi Kuu",
    "search branches": "Tafuta matawi",
    "manage branches": "Simamia Matawi",
    "add branch": "Ongeza Tawi",
    "only branches assigned to your account are shown.": "Matawi yaliyopangiwa akaunti yako pekee ndiyo yanaonekana.",
    "operational workspace": "Sehemu ya kazi",
    "location not set": "Mahali hapajawekwa",
    "currently active branch": "Tawi linalotumika sasa",
    "branch could not be selected.": "Imeshindwa kuchagua tawi.",
    "switching to": "Inabadilisha kwenda",

    // Per-tab search bar placeholders (contextualSearch.ts)
    "search products or scan barcode…": "Tafuta bidhaa au changanua barcode…",
    "search products, barcode or sku…": "Tafuta bidhaa, barcode au SKU…",
    "search invoice, customer or receipt…": "Tafuta ankara, mteja au risiti…",
    "search expenses by title or category…": "Tafuta matumizi kwa jina au kundi…",
    "search this report…": "Tafuta kwenye ripoti hii…",
    "search customers or phone number…": "Tafuta wateja au namba ya simu…",
    "search suppliers…": "Tafuta wasambazaji…",
    "search purchases…": "Tafuta manunuzi…",
    "search deliveries…": "Tafuta delivari…",
    "search transactions…": "Tafuta miamala…",
    "search dashboard…": "Tafuta dashibodi…",

    // Edit Purchase helper text (DashboardPurchases.tsx)
    "only your tenant's registered money & bank accounts are listed here.": "Akaunti za Pesa na Benki zilizosajiliwa za biashara yako pekee ndizo zinazoonekana hapa.",

    // Super Admin / platform portal menu (Orvix staff only, not tenant-facing)
    "status & requests": "Hali na Maombi",
    "status and request": "Hali na Maombi",
    "chats / broadcasts": "Mazungumzo / Matangazo",
    "user inbox": "Sanduku la Ujumbe la Mtumiaji",
    "security activity": "Shughuli za Usalama",
    "user activity": "Shughuli za Mtumiaji",
    "web editor": "Kihariri cha Tovuti",
    "hw inventory": "Stoki ya Vifaa",
    "hw stock": "Stoki ya Vifaa",
    "hw sales": "Mauzo ya Vifaa",
    "hw pos": "POS ya Vifaa",
    "subscribers list": "Orodha ya Wanachama",
    "white-label branding": "Chapa Maalum",
    "sync safety hub": "Kituo cha Usalama wa Sync",
    "affiliates": "Washirika wa Rufaa",

    // Pharmacy/retail-specific sidebar labels (Dashboard.tsx nav arrays)
    "pharma purchases journal": "Daftari la Manunuzi ya Dawa",
    "drug stock valuations": "Thamani ya Stoki ya Dawa",
    "suppliers directory": "Orodha ya Wasambazaji",
    "reports & audits": "Ripoti na Ukaguzi",
    "purchases journal": "Daftari la Manunuzi",
    "deliveries menu": "Menyu ya Delivari",
    "stock valuations": "Thamani ya Stoki",
    "ai stock forecast": "Utabiri wa Stoki kwa AI",
    "partners directory": "Orodha ya Washirika",
    "products catalog": "Orodha ya Bidhaa",
    "sales summary": "Muhtasari wa Mauzo",
    "cashier till (pos)": "POS ya Keshia",
    "pharmacist till (pos)": "POS ya Mfamasia",
    "prescriptions & sales": "Maagizo na Mauzo",
    "drugs & products catalog": "Orodha ya Dawa na Bidhaa",
    "clinical rx intercept": "Ukaguzi wa Maagizo ya Dawa"
  },
};

// The fallback phrase-parsing pass (step 4 below) used to re-sort every
// dictionary entry and rebuild a fresh RegExp for each of the ~900 entries
// on every single call -- and this runs on every DOM mutation across the
// whole app (see the MutationObserver in LanguageProvider below), not just
// once per screen. Cached once per language on first use instead: the sort
// and RegExp construction now happen a handful of times per session, not
// on every keystroke/render. The cached RegExp objects use the 'g' flag and
// are reused across calls, so lastIndex must be reset before each use below
// -- otherwise a global regex's internal position would carry over between
// unrelated translateString() calls and cause it to silently miss matches.
const dictionaryFallbackCache = new Map<LanguageType, { enKey: string; translation: string; regex: RegExp }[]>();

function getDictionaryFallbackEntries(lang: LanguageType, dict: Record<string, string>) {
  const cached = dictionaryFallbackCache.get(lang);
  if (cached) return cached;

  const entries = Object.entries(dict)
    .filter(([enKey]) => enKey.length >= 2)
    .sort((a, b) => b[0].length - a[0].length)
    .map(([enKey, translation]) => {
      const escaped = enKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const startBoundary = /^[a-zA-Z0-9]/.test(enKey) ? '\\b' : '';
      const endBoundary = /[a-zA-Z0-9]$/.test(enKey) ? '\\b' : '';
      let regex: RegExp | null = null;
      try {
        regex = new RegExp(`${startBoundary}${escaped}${endBoundary}`, 'gi');
      } catch {
        regex = null;
      }
      return regex ? { enKey, translation, regex } : null;
    })
    .filter((entry): entry is { enKey: string; translation: string; regex: RegExp } => entry !== null);

  dictionaryFallbackCache.set(lang, entries);
  return entries;
}

// Clean casing-aware word-by-word replacement or exact lookup
function translateString(text: string, lang: LanguageType): string {
  if (!text) return text;

  const trimmed = text.trim();
  if (!trimmed) return text;

  // A translated text node must keep its original surrounding whitespace --
  // adjacent sibling text nodes (e.g. a React `{count} items` expression
  // rendering as separate "{count}" and " items" nodes) rely on it, and
  // losing it merges them into run-together text like "2items".
  const leading = text.slice(0, text.length - text.trimStart().length);
  const trailing = text.slice(text.trimEnd().length);

  // A bare "s" text node is the English plural suffix from the common
  // `{word}{count !== 1 ? 's' : ''}` JSX idiom (e.g. "Sale" + "s" ->
  // "Mauzo" + "s" = "Mauzos"). Swahili doesn't pluralize this way, so drop
  // the suffix entirely once the preceding word has already been translated.
  if (lang === 'sw' && trimmed === 's') {
    return leading + trailing;
  }

  const dict = BUSINESS_DICTIONARY[lang];
  if (!dict) return text;

  const lText = trimmed.toLowerCase();

  // Strip trailing colons or punctuation for lookup
  const keyBase = lText.replace(/[:!?]$/, '').trim();
  const normalizedKey = keyBase.replace(/\s+/g, ' ');

  // 1. Direct match on full string
  if (dict[lText]) {
    return leading + matchCasing(trimmed, dict[lText]) + trailing;
  }

  // 2. Direct match on normalized string
  const normalizedText = lText.replace(/\s+/g, ' ');
  if (dict[normalizedText]) {
    return leading + matchCasing(trimmed, dict[normalizedText]) + trailing;
  }

  // 3. Match on stripped base
  if (dict[normalizedKey]) {
    const translatedBase = matchCasing(trimmed.replace(/[:!?]$/, ''), dict[normalizedKey]);
    const trailingPunctuation = trimmed.slice(trimmed.length - (trimmed.length - keyBase.length));
    return leading + translatedBase + trailingPunctuation + trailing;
  }

  // 4. Fallback: Parse common tokens and phrases recursively (sorted by length desc)
  let parsed = trimmed;
  const fallbackEntries = getDictionaryFallbackEntries(lang, dict);

  for (const { enKey, translation, regex } of fallbackEntries) {
    regex.lastIndex = 0;
    if (regex.test(parsed)) {
      regex.lastIndex = 0;
      parsed = parsed.replace(regex, (match) => {
        return matchCasing(match, translation);
      });
    }
  }

  // Console log missing translation keys if lang is Swahili ('sw')
  if (lang === 'sw') {
    const hasEnglishLetters = /[a-zA-Z]{3,}/.test(trimmed);
    const alreadyTranslated = parsed !== trimmed && !/[a-zA-Z]{3,}/.test(parsed);
    const key = trimmed.toLowerCase().replace(/[:!?]$/, '').trim();
    const isTranslatedInDict = !!(dict[key] || dict[key.replace(/\s+/g, ' ')]);

    if (hasEnglishLetters && !isTranslatedInDict && !alreadyTranslated) {
      const cacheKey = `missing_translation_${lang}_${key}`;
      if (!(window as any)[cacheKey]) {
        (window as any)[cacheKey] = true;
        console.warn(`[Missing Translation] "${trimmed}" is missing a translation for "${lang}"`);
      }
    }
  }

  return leading + parsed + trailing;
}

function matchCasing(original: string, translation: string): string {
  if (!original || !translation) return translation;
  if (original === original.toUpperCase()) return translation.toUpperCase();
  if (original[0] === original[0].toUpperCase() && translation[0] !== translation[0].toUpperCase()) {
    return translation[0].toUpperCase() + translation.substring(1);
  }
  return translation;
}

function translateNode(node: Node, language: LanguageType) {
  if (node.nodeType === Node.TEXT_NODE) {
    const originalText = (node as any).__originalText !== undefined 
      ? (node as any).__originalText 
      : node.nodeValue;

    if ((node as any).__originalText === undefined) {
      (node as any).__originalText = originalText;
    }

    const translated = translateString(originalText || '', language);
    if (node.nodeValue !== translated) {
      node.nodeValue = translated;
    }
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement;
    // Skip interactive editor code areas
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'TEXTAREA' && el.className?.includes('monaco')) return;

    ['title', 'aria-label'].forEach((attr) => {
      const originalAttr = (el as any)[`__original_${attr}`] !== undefined
        ? (el as any)[`__original_${attr}`]
        : el.getAttribute(attr);

      if ((el as any)[`__original_${attr}`] === undefined && originalAttr) {
        (el as any)[`__original_${attr}`] = originalAttr;
      }

      if (!originalAttr) return;

      const translated = translateString(originalAttr, language);
      if (el.getAttribute(attr) !== translated) {
        el.setAttribute(attr, translated);
      }
    });

    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      const inputEl = el as HTMLInputElement;
      const originalPlaceholder = (inputEl as any).__originalPlaceholder !== undefined
        ? (inputEl as any).__originalPlaceholder
        : inputEl.placeholder;

      if ((inputEl as any).__originalPlaceholder === undefined) {
        (inputEl as any).__originalPlaceholder = originalPlaceholder;
      }

      const translated = translateString(originalPlaceholder || '', language);
      if (inputEl.placeholder !== translated) {
        inputEl.placeholder = translated;
      }
    }

    for (let i = 0; i < el.childNodes.length; i++) {
      translateNode(el.childNodes[i], language);
    }
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LanguageType>(() => {
    const cached = window.localStorage.getItem('jasper_lang') || onlineStorage.getItem('jasper_lang');
    if (cached && ['en', 'sw'].includes(cached)) return cached as LanguageType;

    const legacyLandingLanguage = window.localStorage.getItem('orvix-language') || onlineStorage.getItem('orvix-language');
    if (legacyLandingLanguage && ['en', 'sw'].includes(legacyLandingLanguage)) {
      return legacyLandingLanguage as LanguageType;
    }

    const browserLanguage = typeof navigator !== 'undefined'
      ? navigator.language.toLowerCase().split('-')[0]
      : 'en';
    return ['en', 'sw'].includes(browserLanguage)
      ? browserLanguage as LanguageType
      : 'en';
  });

  useEffect(() => {
    window.localStorage.setItem('jasper_lang', lang);
    window.localStorage.removeItem('orvix-language');
    onlineStorage.setItem('jasper_lang', lang);
    onlineStorage.removeItem('orvix-language');
  }, [lang]);

  const setLang = (newLang: LanguageType) => {
    setLangState(newLang);
    window.localStorage.setItem('jasper_lang', newLang);
    onlineStorage.setItem('jasper_lang', newLang);
    window.dispatchEvent(new CustomEvent('jasper_lang_changed', { detail: newLang }));
  };

  useEffect(() => {
    const handleLangChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && ['en', 'sw'].includes(customEvent.detail)) {
        setLangState(customEvent.detail as LanguageType);
      }
    };
    window.addEventListener('jasper_lang_changed', handleLangChange);
    return () => {
      window.removeEventListener('jasper_lang_changed', handleLangChange);
    };
  }, []);

  // Use absolute real-time MutationObserver to translate the DOM in place
  useEffect(() => {
    document.documentElement.removeAttribute('dir');
    document.documentElement.lang = lang;
    document.body.classList.remove('rtl');

    const runGlobalTranslation = () => {
      translateNode(document.body, lang);
    };

    runGlobalTranslation();

    const observer = new MutationObserver((mutations) => {
      let shouldTranslate = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          shouldTranslate = true;
          break;
        }
        if (mutation.type === 'characterData') {
          const originalVal = (mutation.target as any).__originalText;
          const currentVal = mutation.target.nodeValue;
          const expectedTranslated = originalVal !== undefined ? translateString(originalVal, lang) : undefined;
          if (originalVal === undefined || currentVal !== expectedTranslated) {
            // Update cache to the new value set by React/DOM
            (mutation.target as any).__originalText = currentVal;
            shouldTranslate = true;
          }
        }
        if (mutation.type === 'attributes' && ['placeholder', 'title', 'aria-label'].includes(mutation.attributeName || '')) {
          const el = mutation.target as HTMLInputElement;
          const isPlaceholder = mutation.attributeName === 'placeholder';
          const originalKey = isPlaceholder ? '__originalPlaceholder' : `__original_${mutation.attributeName}`;
          const originalVal = (el as any)[originalKey];
          const currentVal = isPlaceholder ? el.placeholder : el.getAttribute(mutation.attributeName || '');
          const expectedTranslated = originalVal !== undefined ? translateString(originalVal, lang) : undefined;
          if (originalVal === undefined || currentVal !== expectedTranslated) {
            (el as any)[originalKey] = currentVal;
            shouldTranslate = true;
          }
        }
      }

      if (shouldTranslate) {
        observer.disconnect();
        runGlobalTranslation();
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
          attributeFilter: ['placeholder', 'title', 'aria-label']
        });
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'title', 'aria-label']
    });

    return () => {
      observer.disconnect();
    };
  }, [lang]);

  const t = (text: string): string => {
    return translateString(text, lang);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    return {
      lang: 'en' as LanguageType,
      setLang: () => {},
      t: (text: string) => text
    };
  }
  return context;
}
