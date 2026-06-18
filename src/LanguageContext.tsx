import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type LanguageType = 'en' | 'sw' | 'ar' | 'fr';

interface LanguageContextType {
  lang: LanguageType;
  setLang: (lang: LanguageType) => void;
  t: (text: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Comprehensive dictionary for complete app-wide Translation propagation
const BUSINESS_DICTIONARY: Record<LanguageType, Record<string, string>> = {
  en: {}, // English is default, returns unmodified if not translated
  sw: {
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
    "all time": "Wakati Wote",
    "last7Days": "Siku 7 Zilizopita",
    "last30Days": "Siku 30 Zilizopita",
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
    "africa commerce o s": "Mfumo wa Biashara Afrika"
  },
  ar: {
    "home": "الرئيسية",
    "dashboard": "لوحة التحكم",
    "sales": "المبيعات",
    "pos": "نقطة البيع",
    "reports": "التقارير",
    "more": "المزيد",
    "parties": "الشركاء",
    "purchases": "المشتريات",
    "expenses": "المصروفات",
    "delivery": "التوصيل",
    "delivery riders": "عمال التوصيل",
    "customers": "العملاء",
    "suppliers": "الموردون",
    "products": "المنتجات",
    "product manager": "مدير المنتجات",
    "inventory": "المخزون",
    "settings": "الإعدادات",
    "staff": "الموظفون",
    "logout": "تسجيل الخروج",
    "online sync": "المزامنة",
    "payment channels": "قنوات الدفع",
    "ledger": "دفتر الأستاذ",
    "quotations": "عروض الأسعار",
    "proforma": "فاتورة مبدئية",
    "finance": "المالية",
    "real time performance": "الأداء الفوري",
    "total orders": "إجمالي الطلبات",
    "total sales": "إجمالي المبيعات",
    "cogs": "تكلفة البضاعة المباعة",
    "total profit": "إجمالي الربح",
    "active orders": "الطلبات النشطة",
    "product costs": "تكاليف المنتجات",
    "procurements": "المشتريات",
    "opex cash": "نفقات التشغيل",
    "deficit": "عجز",
    "receipt count": "عدد الإيصالات",
    "total value": "القيمة الإجمالية",
    "offline dockets": "الفواتير غير المتصلة",
    "pending": "قيد الانتظار",
    "store credit": "رصيد المتجر",
    "units sold": "الوحدات المباعة",
    "inflow verified": "التدفقات المؤكدة",
    "supply stock in": "البضاعة الواردة",
    "operating outlays": "مصاريف التشغيل",
    "net profit share": "حصة الربح الصافي",
    "top selling products": "أكثر المنتجات مبيعاً",
    "weekly cohort metrics": "مقاييس أسبوعية",
    "past 30 days": "آخر 30 يوم",
    "sales and purchase status": "حالة المبيعات والمشتريات",
    "good morning": "صباح الخير",
    "good afternoon": "مساء الخير",
    "good evening": "مساء النور",
    "good night": "تصبح على خير",
    "today": "اليوم",
    "yesterday": "أمس",
    "one week": "أسبوع واحد",
    "one month": "شهر واحد",
    "three months": "3 أشهر",
    "one year": "سنة واحدة",
    "all time": "كل الوقت",
    "last 7 days": "آخر 7 أيام",
    "last 30 days": "آخر 30 يوم",
    "this week": "هذا الأسبوع",
    "this month": "هذا الشهر",
    "sales transactions ledger": "دفتر معاملات المبيعات",
    "sales and receipts": "المبيعات والإيصالات",
    "add sale direct": "إضافة بيع",
    "channel": "القناة",
    "retail": "تجزئة",
    "wholesale": "جملة",
    "reference": "المرجع",
    "customer": "العميل",
    "cashier": "الكاشير",
    "amount paid": "المبلغ المدفوع",
    "amount due": "المبلغ المستحق",
    "payment method": "طريقة الدفع",
    "cash": "نقداً",
    "bank": "بنك",
    "mobile money": "محفظة إلكترونية",
    "paid": "مدفوع",
    "unpaid": "غير مدفوع",
    "partial": "جزئي",
    "view sale": "عرض البيع",
    "add payment": "إضافة دفعة",
    "edit sale": "تعديل البيع",
    "pos receipt": "إيصال نقطة البيع",
    "invoice": "فاتورة",
    "delete sale": "حذف البيع",
    "search": "بحث",
    "filter": "تصفية",
    "date range filter": "تصفية التواريخ",
    "from": "من",
    "to": "إلى",
    "apply": "تطبيق",
    "sync state": "حالة المزامنة",
    "point of sale": "نقطة البيع",
    "search products": "البحث عن منتجات",
    "scan barcode": "مسح الباركود",
    "all categories": "جميع الفئات",
    "add to cart": "إضافة للسلة",
    "cart": "سلة التسوق",
    "checkout": "إتمام الشراء",
    "subtotal": "المجموع الفرعي",
    "tax": "ضريبة",
    "discount": "خصم",
    "total": "المجموع",
    "product not found": "المنتج غير موجود",
    "out of stock": "نفد المخزون",
    "item not in system": "المنتج غير موجود في النظام",
    "in stock": "متوفر",
    "low stock": "مخزون منخفض",
    "quantity": "الكمية",
    "price": "السعر",
    "remove": "إزالة",
    "clear cart": "إفراغ السلة",
    "process sale": "معالجة البيع",
    "product name": "اسم المنتج",
    "sku": "رمز المنتج",
    "barcode": "الباركود",
    "category": "الفئة",
    "unit": "الوحدة",
    "cost price": "سعر التكلفة",
    "selling price": "سعر البيع",
    "stock quantity": "كمية المخزون",
    "alert quantity": "كمية التنبيه",
    "brand": "العلامة التجارية",
    "wholesale price": "سعر الجملة",
    "add product": "إضافة منتج",
    "edit product": "تعديل المنتج",
    "delete product": "حذف المنتج",
    "shop stock": "مخزون المتجر",
    "store stock": "مخزون المستودع",
    "allows dosage dividing": "السماح بتقسيم الجرعة",
    "sell in retail": "بيع بالتجزئة",
    "sell in wholesale": "بيع بالجملة",
    "tabs per pack": "أقراص في العبوة",
    "procured supply records list": "قائمة المشتريات",
    "timestamp": "التاريخ",
    "purchase id": "رقم الشراء",
    "warehouse supplier": "المورد",
    "restock target": "هدف إعادة التخزين",
    "procured item details": "تفاصيل البنود",
    "invoice sum": "مجموع الفاتورة",
    "settled amount": "المبلغ المسوى",
    "outstanding credit": "الرصيد المتبقي",
    "dispatch status": "حالة الشحن",
    "backroom store": "المستودع الخلفي",
    "full delivered": "تم التسليم الكامل",
    "all targets": "جميع الأهداف",
    "all payments": "جميع المدفوعات",
    "newest first": "الأحدث أولاً",
    "add supplier purchase": "إضافة مشتريات من مورد",
    "purchase history": "سجل المشتريات",
    "supplier name": "اسم المورد",
    "total amount": "المبلغ الإجمالي",
    "delivery status": "حالة التوصيل",
    "delivery fee": "رسوم التوصيل",
    "official document": "وثيقة رسمية",
    "price quote": "عرض سعر",
    "invoice number": "رقم الفاتورة",
    "quotation number": "رقم عرض السعر",
    "date issued": "تاريخ الإصدار",
    "branch office": "مكتب الفرع",
    "billed to": "فاتورة إلى",
    "delivery destination": "وجهة التوصيل",
    "qty": "الكمية",
    "unit rate": "السعر للوحدة",
    "items sub total": "المجموع الفرعي للبنود",
    "grand total due": "الإجمالي المستحق",
    "settlements account": "حساب التسويات",
    "configure corporate accounts": "تكوين الحسابات في الإعدادات",
    "prepared by": "أعده",
    "title": "اللقب",
    "signature": "التوقيع",
    "thank you for your business": "شكراً لتعاملكم معنا",
    "we value your partnership": "نقدر شراكتكم",
    "add expense": "إضافة مصروف",
    "expense category": "فئة المصروف",
    "description": "الوصف",
    "receipt reference": "مرجع الإيصال",
    "receipt image": "صورة الإيصال",
    "transaction message": "رسالة المعاملة",
    "note": "ملاحظة",
    "contact person": "شخص الاتصال",
    "phone": "الهاتف",
    "email": "البريد الإلكتروني",
    "add supplier": "إضافة مورد",
    "edit supplier": "تعديل المورد",
    "delete supplier": "حذف المورد",
    "customer name": "اسم العميل",
    "add customer": "إضافة عميل",
    "customer phone": "هاتف العميل",
    "customer address": "عنوان العميل",
    "rider": "عامل التوصيل",
    "dispatched": "تم الإرسال",
    "delivered": "تم التسليم",
    "cancelled": "ملغي",
    "dispatch": "إرسال",
    "assign rider": "تعيين عامل توصيل",
    "notes": "ملاحظات",
    "delivery cost": "تكلفة التوصيل",
    "sales report": "تقرير المبيعات",
    "inventory report": "تقرير المخزون",
    "expense report": "تقرير المصروفات",
    "purchase report": "تقرير المشتريات",
    "profit and loss": "الأرباح والخسائر",
    "revenue generated": "الإيرادات المحققة",
    "paid orders": "الطلبات المدفوعة",
    "unpaid orders": "الطلبات غير المدفوعة",
    "profit generated": "الربح المحقق",
    "gross sales": "إجمالي المبيعات",
    "net profit": "صافي الربح",
    "total tickets": "إجمالي التذاكر",
    "margin": "هامش الربح",
    "general settings": "الإعدادات العامة",
    "business name": "اسم الشركة",
    "currency": "العملة",
    "tax rate": "نسبة الضريبة",
    "language": "اللغة",
    "dark mode": "الوضع الداكن",
    "light mode": "الوضع الفاتح",
    "save logo": "حفظ الشعار",
    "upload logo": "رفع الشعار",
    "change logo": "تغيير الشعار",
    "profile": "الملف الشخصي",
    "change password": "تغيير كلمة المرور",
    "business type": "نوع النشاط التجاري",
    "country": "الدولة",
    "city": "المدينة",
    "mobile moneyproviders": "مزودو المحافظ الإلكترونية",
    "invoice settings": "إعدادات الفواتير",
    "footer note": "ملاحظة التذييل",
    "show tax": "إظهار الضريبة",
    "save": "حفظ",
    "cancel": "إلغاء",
    "delete": "حذف",
    "edit": "تعديل",
    "add": "إضافة",
    "export": "تصدير",
    "print": "طباعة",
    "confirm": "تأكيد",
    "back": "رجوع",
    "close": "إغلاق",
    "next": "التالي",
    "submit": "إرسال",
    "update": "تحديث",
    "view": "عرض",
    "download": "تنزيل",
    "upload": "رفع",
    "share": "مشاركة",
    "refresh": "تحديث",
    "loading": "جارٍ التحميل",
    "success": "نجاح",
    "error": "خطأ",
    "warning": "تحذير",
    "no data available": "لا توجد بيانات",
    "no sales yet": "لا توجد مبيعات بعد",
    "no products found": "لا توجد منتجات",
    "something went wrong": "حدث خطأ ما",
    "try again": "حاول مرة أخرى",
    "saved successfully": "تم الحفظ بنجاح",
    "deleted successfully": "تم الحذف بنجاح",
    "updated successfully": "تم التحديث بنجاح",
    "are you sure": "هل أنت متأكد؟",
    "this cannot be undone": "لا يمكن التراجع عن هذا الإجراء",
    "yes": "نعم",
    "no": "لا",
    "sign out": "تسجيل الخروج",
    "welcome back": "مرحباً بعودتك",
    "active": "نشط",
    "inactive": "غير نشط",
    "online": "متصل",
    "offline": "غير متصل",
    "syncing": "جارٍ المزامنة",
    "synced": "تمت المزامنة",
    "name": "الاسم",
    "date": "التاريخ",
    "amount": "المبلغ",
    "status": "الحالة",
    "actions": "الإجراءات",
    "no results": "لا توجد نتائج",
    "required": "مطلوب",
    "optional": "اختياري",
    "select option": "اختر خياراً",
    "enter amount": "أدخل المبلغ",
    "enter name": "أدخل الاسم",
    "select date": "اختر تاريخاً",
    "business dashboard ready": "لوحة تحكم عملك جاهزة",
    "welcome message": "مرحباً بك في نظام إدارة أعمالك",
    "sign in": "تسجيل الدخول",
    "sign up": "إنشاء حساب",
    "create account": "إنشاء حساب جديد",
    "free trial": "تجربة مجانية",
    "full name": "الاسم الكامل",
    "password": "كلمة المرور",
    "confirm password": "تأكيد كلمة المرور",
    "forgot password": "نسيت كلمة المرور",
    "reset password": "إعادة تعيين كلمة المرور",
    "africa commerce o s": "نظام التجارة الأفريقي"
  },
  fr: {
    "home": "Accueil",
    "dashboard": "Tableau de bord",
    "sales": "Ventes",
    "pos": "Point de Vente",
    "reports": "Rapports",
    "more": "Plus",
    "parties": "Partenaires",
    "purchases": "Achats",
    "expenses": "Dépenses",
    "delivery": "Livraison",
    "delivery riders": "Livreurs",
    "customers": "Clients",
    "suppliers": "Fournisseurs",
    "products": "Produits",
    "product manager": "Gestionnaire de Produits",
    "inventory": "Inventaire",
    "settings": "Paramètres",
    "staff": "Personnel",
    "logout": "Déconnexion",
    "online sync": "Synchronisation",
    "payment channels": "Canaux de Paiement",
    "ledger": "Grand Livre",
    "quotations": "Devis",
    "proforma": "Facture Proforma",
    "finance": "Finance",
    "real time performance": "Performance en Temps Réel",
    "total orders": "Total des Commandes",
    "total sales": "Total des Ventes",
    "cogs": "Coût des Marchandises",
    "total profit": "Bénéfice Total",
    "active orders": "Commandes Actives",
    "product costs": "Coûts des Produits",
    "procurements": "Approvisionnements",
    "opex cash": "Charges d'Exploitation",
    "deficit": "Déficit",
    "receipt count": "Nombre de Reçus",
    "total value": "Valeur Totale",
    "offline dockets": "Tickets Hors Ligne",
    "pending": "En Attente",
    "store credit": "Crédit Magasin",
    "units sold": "Unités Vendues",
    "inflow verified": "Entrées Vérifiées",
    "supply stock in": "Stock Approvisionné",
    "operating outlays": "Charges d'Exploitation",
    "net profit share": "Part du Bénéfice Net",
    "top selling products": "Produits les Plus Vendus",
    "weekly cohort metrics": "Métriques Hebdomadaires",
    "past 30 days": "30 Derniers Jours",
    "sales and purchase status": "Statut Ventes et Achats",
    "good morning": "Bonjour",
    "good afternoon": "Bon après-midi",
    "good evening": "Bonsoir",
    "good night": "Bonne nuit",
    "today": "Aujourd'hui",
    "yesterday": "Hier",
    "one week": "1 Semaine",
    "one month": "1 Mois",
    "three months": "3 Mois",
    "one year": "1 An",
    "all time": "Tout le Temps",
    "last 7 days": "7 Derniers Jours",
    "last 30 days": "30 Derniers Jours",
    "this week": "Cette Semaine",
    "this month": "Ce Mois",
    "sales transactions ledger": "Grand Livre des Ventes",
    "sales and receipts": "Ventes et Reçus",
    "add sale direct": "Ajouter une Vente",
    "channel": "Canal",
    "retail": "Détail",
    "wholesale": "Gros",
    "reference": "Référence",
    "customer": "Client",
    "cashier": "Caissier",
    "amount paid": "Montant Payé",
    "amount due": "Montant Dû",
    "payment method": "Mode de Paiement",
    "cash": "Espèces",
    "bank": "Banque",
    "mobile money": "Mobile Money",
    "paid": "Payé",
    "unpaid": "Non Payé",
    "partial": "Partiel",
    "view sale": "Voir la Vente",
    "add payment": "Ajouter un Paiement",
    "edit sale": "Modifier la Vente",
    "pos receipt": "Reçu PDV",
    "invoice": "Facture",
    "delete sale": "Supprimer la Vente",
    "search": "Rechercher",
    "filter": "Filtrer",
    "date range filter": "Filtre de Dates",
    "from": "De",
    "to": "À",
    "apply": "Appliquer",
    "sync state": "État de Sync",
    "point of sale": "Point de Vente",
    "search products": "Rechercher des produits",
    "scan barcode": "Scanner le code-barres",
    "all categories": "Toutes les Catégories",
    "add to cart": "Ajouter au Panier",
    "cart": "Panier",
    "checkout": "Passer la Commande",
    "subtotal": "Sous-total",
    "tax": "Taxe",
    "discount": "Remise",
    "total": "Total",
    "product not found": "Produit introuvable",
    "out of stock": "Rupture de Stock",
    "item not in system": "Article non dans le système",
    "in stock": "En Stock",
    "low stock": "Stock Faible",
    "quantity": "Quantité",
    "price": "Prix",
    "remove": "Supprimer",
    "clear cart": "Vider le Panier",
    "process sale": "Traiter la Vente",
    "product name": "Nom du Produit",
    "sku": "Référence Produit",
    "barcode": "Code-barres",
    "category": "Catégorie",
    "unit": "Unité",
    "cost price": "Prix de Revient",
    "selling price": "Prix de Vente",
    "stock quantity": "Quantité en Stock",
    "alert quantity": "Quantité d'Alerte",
    "brand": "Marque",
    "wholesale price": "Prix de Gros",
    "add product": "Ajouter un Produit",
    "edit product": "Modifier le Produit",
    "delete product": "Supprimer le Produit",
    "shop stock": "Stock Boutique",
    "store stock": "Stock Entrepôt",
    "allows dosage dividing": "Autoriser la Division de Dosage",
    "sell in retail": "Vendre au Détail",
    "sell in wholesale": "Vendre en Gros",
    "tabs per pack": "Comprimés par Paquet",
    "procured supply records list": "Liste des Achats",
    "timestamp": "Date",
    "purchase id": "Numéro d'Achat",
    "warehouse supplier": "Fournisseur",
    "restock target": "Cible de Réapprovisionnement",
    "procured item details": "Détails des Articles",
    "invoice sum": "Montant de la Facture",
    "settled amount": "Montant Réglé",
    "outstanding credit": "Crédit Restant",
    "dispatch status": "Statut d'Expédition",
    "backroom store": "Entrepôt Arrière",
    "full delivered": "Livraison Complète",
    "all targets": "Toutes les Cibles",
    "all payments": "Tous les Paiements",
    "newest first": "Plus Récent d'Abord",
    "add supplier purchase": "Ajouter un Achat Fournisseur",
    "purchase history": "Historique des Achats",
    "supplier name": "Nom du Fournisseur",
    "total amount": "Montant Total",
    "delivery status": "Statut de Livraison",
    "delivery fee": "Frais de Livraison",
    "official document": "Document Officiel",
    "price quote": "Devis",
    "invoice number": "Numéro de Facture",
    "quotation number": "Numéro de Devis",
    "date issued": "Date d'Émission",
    "branch office": "Agence",
    "billed to": "Facturé À",
    "delivery destination": "Destination de Livraison",
    "qty": "Qté",
    "unit rate": "Prix Unitaire",
    "items sub total": "Sous-total des Articles",
    "grand total due": "Total Général Dû",
    "settlements account": "Compte de Règlement",
    "configure corporate accounts": "Configurer les comptes dans Paramètres",
    "prepared by": "Préparé Par",
    "title": "Titre",
    "signature": "Signature",
    "thank you for your business": "Merci pour votre confiance",
    "we value your partnership": "Nous apprécions votre partenariat",
    "add expense": "Ajouter une Dépense",
    "expense category": "Catégorie de Dépense",
    "description": "Description",
    "receipt reference": "Référence du Reçu",
    "receipt image": "Image du Reçu",
    "transaction message": "Message de Transaction",
    "note": "Note",
    "contact person": "Personne de Contact",
    "phone": "Téléphone",
    "email": "E-mail",
    "add supplier": "Ajouter un Fournisseur",
    "edit supplier": "Modifier le Fournisseur",
    "delete supplier": "Supprimer le Fournisseur",
    "customer name": "Nom du Client",
    "add customer": "Ajouter un Client",
    "customer phone": "Téléphone du Client",
    "customer address": "Adresse du Client",
    "rider": "Livreur",
    "dispatched": "Expédié",
    "delivered": "Livré",
    "cancelled": "Annulé",
    "dispatch": "Expédier",
    "assign rider": "Assigner un Livreur",
    "notes": "Notes",
    "delivery cost": "Coût de Livraison",
    "sales report": "Rapport des Ventes",
    "inventory report": "Rapport d'Inventaire",
    "expense report": "Rapport des Dépenses",
    "purchase report": "Rapport des Achats",
    "profit and loss": "Profits et Pertes",
    "revenue generated": "Revenus Générés",
    "paid orders": "Commandes Payées",
    "unpaid orders": "Commandes Non Payées",
    "profit generated": "Bénéfice Généré",
    "gross sales": "Ventes Brutes",
    "net profit": "Bénéfice Net",
    "total tickets": "Total des Tickets",
    "margin": "Marge",
    "general settings": "Paramètres Généraux",
    "business name": "Nom de l'Entreprise",
    "currency": "Devise",
    "tax rate": "Taux de Taxe",
    "language": "Langue",
    "dark mode": "Mode Sombre",
    "light mode": "Mode Clair",
    "save logo": "Enregistrer le Logo",
    "upload logo": "Télécharger le Logo",
    "change logo": "Changer le Logo",
    "profile": "Profil",
    "change password": "Changer le Mot de Passe",
    "business type": "Type d'Entreprise",
    "country": "Pays",
    "city": "Ville",
    "mobile moneyproviders": "Fournisseurs Mobile Money",
    "invoice settings": "Paramètres de Facturation",
    "footer note": "Note de Bas de Page",
    "show tax": "Afficher la Taxe",
    "save": "Enregistrer",
    "cancel": "Annuler",
    "delete": "Supprimer",
    "edit": "Modifier",
    "add": "Ajouter",
    "export": "Exporter",
    "print": "Imprimer",
    "confirm": "Confirmer",
    "back": "Retour",
    "close": "Fermer",
    "next": "Suivant",
    "submit": "Soumettre",
    "update": "Mettre à jour",
    "view": "Voir",
    "download": "Télécharger",
    "upload": "Téléverser",
    "share": "Partager",
    "refresh": "Actualiser",
    "loading": "Chargement",
    "success": "Succès",
    "error": "Erreur",
    "warning": "Avertissement",
    "no data available": "Aucune donnée disponible",
    "no sales yet": "Aucune vente pour l'instant",
    "no products found": "Aucun produit trouvé",
    "something went wrong": "Une erreur s'est produite",
    "try again": "Réessayer",
    "saved successfully": "Enregistré avec succès",
    "deleted successfully": "Supprimé avec succès",
    "updated successfully": "Mis à jour avec succès",
    "are you sure": "Êtes-vous sûr?",
    "this cannot be undone": "Cette action est irréversible",
    "yes": "Oui",
    "no": "Non",
    "sign out": "Déconnexion",
    "welcome back": "Bon retour",
    "active": "Actif",
    "inactive": "Inactif",
    "online": "En ligne",
    "offline": "Hors ligne",
    "syncing": "Synchronisation",
    "synced": "Synchronisé",
    "name": "Nom",
    "date": "Date",
    "amount": "Montant",
    "status": "Statut",
    "actions": "Actions",
    "no results": "Aucun résultat",
    "required": "Obligatoire",
    "optional": "Optionnel",
    "select option": "Sélectionner une option",
    "enter amount": "Saisir le montant",
    "enter name": "Saisir le nom",
    "select date": "Sélectionner une date",
    "business dashboard ready": "Votre tableau de bord est prêt",
    "welcome message": "Bienvenue sur votre système de gestion",
    "sign in": "Se connecter",
    "sign up": "S'inscrire",
    "create account": "Créer un compte",
    "free trial": "Essai Gratuit",
    "full name": "Nom Complet",
    "password": "Mot de passe",
    "confirm password": "Confirmer le mot de passe",
    "forgot password": "Mot de passe oublié",
    "reset password": "Réinitialiser le mot de passe",
    "africa commerce o s": "Système de Commerce Africain"
  }
};

// Clean casing-aware word-by-word replacement or exact lookup
function translateString(text: string, lang: LanguageType): string {
  if (!text || lang === 'en') return text;
  
  const trimmed = text.trim();
  if (!trimmed) return text;

  const dict = BUSINESS_DICTIONARY[lang];
  if (!dict) return text;

  const lText = trimmed.toLowerCase();
  
  // Strip trailing colons or punctuation for lookup
  const keyBase = lText.replace(/[:!?]$/, '').trim();
  const normalizedKey = keyBase.replace(/\s+/g, ' ');

  // 1. Direct match on full string
  if (dict[lText]) {
    return matchCasing(trimmed, dict[lText]);
  }

  // 2. Direct match on normalized string
  const normalizedText = lText.replace(/\s+/g, ' ');
  if (dict[normalizedText]) {
    return matchCasing(trimmed, dict[normalizedText]);
  }

  // 3. Match on stripped base
  if (dict[normalizedKey]) {
    const translatedBase = matchCasing(trimmed.replace(/[:!?]$/, ''), dict[normalizedKey]);
    const trailingPunctuation = trimmed.slice(trimmed.length - (trimmed.length - keyBase.length));
    return translatedBase + trailingPunctuation;
  }

  // 4. Fallback: Parse common tokens and phrases recursively (sorted by length desc)
  let parsed = trimmed;
  const items = Object.entries(dict);
  items.sort((a, b) => b[0].length - a[0].length);

  for (const [enKey, translation] of items) {
    if (enKey.length >= 2) {
      // Escape special regex chars
      const escaped = enKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Require boundaries only for alphanumeric characters to prevent boundary failure on punctuation
      const startBoundary = /^[a-zA-Z0-9]/.test(enKey) ? '\\b' : '';
      const endBoundary = /[a-zA-Z0-9]$/.test(enKey) ? '\\b' : '';

      try {
        const regex = new RegExp(`${startBoundary}${escaped}${endBoundary}`, 'gi');
        if (regex.test(parsed)) {
          parsed = parsed.replace(regex, (match) => {
            return matchCasing(match, translation);
          });
        }
      } catch (e) {
        // Fallback basic replace if RegExp fails
        const idx = parsed.toLowerCase().indexOf(enKey);
        if (idx !== -1) {
          const originalMatch = parsed.substring(idx, idx + enKey.length);
          parsed = parsed.replace(originalMatch, matchCasing(originalMatch, translation));
        }
      }
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

  return parsed;
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

    if (language === 'en') {
      if (node.nodeValue !== originalText) {
        node.nodeValue = originalText;
      }
    } else {
      const translated = translateString(originalText || '', language);
      if (node.nodeValue !== translated) {
        node.nodeValue = translated;
      }
    }
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement;
    // Skip interactive editor code areas
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'TEXTAREA' && el.className?.includes('monaco')) return;

    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      const inputEl = el as HTMLInputElement;
      const originalPlaceholder = (inputEl as any).__originalPlaceholder !== undefined
        ? (inputEl as any).__originalPlaceholder
        : inputEl.placeholder;

      if ((inputEl as any).__originalPlaceholder === undefined) {
        (inputEl as any).__originalPlaceholder = originalPlaceholder;
      }

      if (language === 'en') {
        if (inputEl.placeholder !== originalPlaceholder) {
          inputEl.placeholder = originalPlaceholder;
        }
      } else {
        const translated = translateString(originalPlaceholder || '', language);
        if (inputEl.placeholder !== translated) {
          inputEl.placeholder = translated;
        }
      }
    }

    for (let i = 0; i < el.childNodes.length; i++) {
      translateNode(el.childNodes[i], language);
    }
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LanguageType>(() => {
    const cached = localStorage.getItem('jasper_lang');
    return (cached && ['en', 'sw', 'ar', 'fr'].includes(cached))
      ? (cached as LanguageType)
      : 'en';
  });

  const setLang = (newLang: LanguageType) => {
    setLangState(newLang);
    localStorage.setItem('jasper_lang', newLang);
    window.dispatchEvent(new CustomEvent('jasper_lang_changed', { detail: newLang }));
  };

  useEffect(() => {
    const handleLangChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && ['en', 'sw', 'ar', 'fr'].includes(customEvent.detail)) {
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
    // RTL Support for Arabic
    if (lang === 'ar') {
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'ar';
      document.body.classList.add('rtl');
    } else {
      document.documentElement.removeAttribute('dir');
      document.documentElement.lang = lang;
      document.body.classList.remove('rtl');
    }

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
        if (mutation.type === 'attributes' && mutation.attributeName === 'placeholder') {
          const el = mutation.target as HTMLInputElement;
          const originalVal = (el as any).__originalPlaceholder;
          const currentVal = el.placeholder;
          const expectedTranslated = originalVal !== undefined ? translateString(originalVal, lang) : undefined;
          if (originalVal === undefined || currentVal !== expectedTranslated) {
            (el as any).__originalPlaceholder = currentVal;
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
          attributeFilter: ['placeholder']
        });
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder']
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
