import { useState, useEffect } from 'react';
import { useTranslation } from '../LanguageContext';
import { createLucyResponse, getLucyGreeting } from '../utils/lucyBrain';
import PrivacyAndTermsModals from './PrivacyAndTermsModals';
import { 
  Store, 
  ShoppingCart, 
  WifiOff, 
  RefreshCw, 
  Layers, 
  ArrowRight, 
  CheckCircle2, 
  Globe, 
  Sparkles, 
  CreditCard,
  Plus,
  Trash2,
  Minimize2,
  Check,
  ChevronDown,
  MessageSquare,
  X,
  Send,
  User,
  MapPin,
  Phone,
  Mail,
  SendHorizontal,
  Info,
  Building2,
  Pill,
  UtensilsCrossed,
  Hotel,
  Youtube,
  Instagram,
  Facebook,
  Sun,
  Moon,
  Menu,
  Factory
} from 'lucide-react';

const TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    home: "Home",
    aboutUs: "About Us",
    features: "Features",
    pricing: "Pricing",
    faq: "FAQ",
    contact: "Contact",
    signIn: "Sign In",
    freeTrial: "Free Trial",
    coreBadge: "Simple Business System",
    headlinePre: "Stop Managing.",
    headlinePost: "Start Growing.",
    tagline: "Your business deserves a partner that works as hard as you do.",
    builtFor: "Built For:",
    retail: "Retail Shops",
    wholesale: "Wholesale Shops",
    pharmacies: "Pharmacies",
    manufacturing: "Manufacturing",
    cashMgmt: "Cash Management",
    cashDesc: "Manage your cash accurately every single day with ease.",
    capitalProt: "Capital Protection",
    capitalDesc: "Keep your capital safe with clear, simple transaction logs.",
    stockIntel: "Stock Control",
    stockDesc: "Track your product levels and get simple notifications when low.",
    offlineTitle: "Works Without Internet",
    offlineDesc: "Runs 100% offline. Accepts mobile money instantly with no slowdowns.",
    meetLucy: "Meet Lucy, Your AI",
    lucyDesc: "Your friendly AI assistant to answer questions and help you grow daily.",
    creed: "Jasper helps your business grow higher!",
    getStarted: "Get Started — It's Free",
    offlineMetric: "Works Offline",
    syncMetric: "Instant Sync",
    aiMetric: "AI Assistant",
    aboutTitle: "Offline Sales Support For All Businesses",
    aboutDesc: "We created Jasper because unstable internet should never stop your sales desk. Whether you are in Dar, Mbeya, or Nairobi, your cash drawer keeps working.",
    aboutSupport: "Real support offices around East Africa",
    aboutCurrency: "Automatic local tax settings",
    aboutEndpoints: "Over 2,400 active stores registered",
    advancedCapabilities: "Advanced Features",
    advancedDesc: "Simple solutions to keep your cash registers working always.",
    featOfflineTitle: "Offline Cashier Desk",
    featOfflineDesc: "No internet or power goes out? No problem. Keep selling as normal and sync when network is restored.",
    featLedgerTitle: "Stock & Expiry Alerts",
    featLedgerDesc: "Track stock quantities, receive automatic low-stock notifications, and monitor medicine/product expiry dates easily.",
    featGatewayTitle: "Mobile Money Check",
    featGatewayDesc: "Invoices connect directly with M-Pesa, Tigo, and Airtel Money to verify transactions quickly.",
    featSmartSokoTitle: "SmartSoko Production",
    featSmartSokoDesc: "Manage raw materials, production batches, and yield efficiency with live unit cost tracking.",
    testimonialHeader: "Successful Businesses",
    testimonialSub: "What other shop owners say",
    mustafaSay: "We were losing sales when the internet was down. Since starting with Jasper's offline cashier, sales never stop.",
    kwameSay: "Managing medicine lists was hard. Then we got Jasper—Lucy sorted everything out easily. Perfect.",
    fatumaSay: "The hotel room booking works wonderfully. Our local receptionist team learned to use it in five minutes.",
    mustafaRole: "Restaurant Owner • Dar es Salaam",
    kwameRole: "Dispensary Director • Kisumu",
    fatumaRole: "Managing Director • Arusha",
    pricingHeader: "Simple Prices",
    pricingSub: "Choose a plan that fits your shop scale",
    pricingDesc: "Start with a 14-day free trial. Choose a plan to continue. Switch plans anytime.",
    trialName: "Free Trial",
    trialDesc: "Test all options and load your products free today.",
    essentialName: "Essential",
    essentialDesc: "Best for small shops with a single bill counter.",
    standardName: "Standard",
    standardDesc: "Perfect to run multi-branch shops, pharmacies, or hotels.",
    premiumName: "Premium",
    premiumDesc: "Unlimited items built for big warehouses.",
    limitTrial: "Max 20 Products • 1 Store • 1 User",
    limitEssential: "Max 200 Products • 1 Store • 2 Users",
    limitStandard: "Max 1,000 Products • 5 Stores • 5 Users",
    limitPremium: "Unlimited Products • 10 Stores • Unlimited Users",
    featureReport: "Standard POS transaction reports",
    featureNoExpiry: "Expiry date tracker & alerts",
    featureAiHelp: "Direct Lucy assistance",
    featureVip: "VIP priority assistance support",
    choosePlan: "Choose Plan",
    startFree: "Start Trial Free",
    faqHeader: "Common Questions",
    aboutCompany: "Company Info",
    contactSupport: "Contact Us",
    callLucy: "Ask Lucy",
    getInTouch: "Get In Touch",
    directAssistance: "Direct Assistance & On-Site Deployments",
    contactDesc: "Need on-site installation, hardware mapping, or personalized training? Contact our local regional agents immediately to deploy an deployment installer to your desk.",
    callLocalAgent: "Call Local Agent",
    contactDeployments: "Contact Deployments",
    privacyText: "Privacy Policy",
    privacyModalTitle: "Jasper Suite Privacy Policy",
    privacyIntro: "We protect your business data under strict legal rules:",
    privacyPoint1: "Own Device Security: Your daily transaction records are cached securely only on your own physical device.",
    privacyPoint2: "Secure Cloud Sync: Network transfers sent to our database are shielded using professional secure servers encryption.",
    privacyPoint3: "No Third-Party Exploits: We never trade, sell or dispatch your confidential shop reports with outside advertising teams.",
    privacyPoint4: "Full Erasure Rights: You are fully authorized to thoroughly wipe out your local caches and cloud records at any time.",
    closeBtn: "Close"
  },
  sw: {
    home: "Mwanzo",
    aboutUs: "Kuhusu Sisi",
    features: "Vipengele",
    pricing: "Bei",
    faq: "Maswali",
    contact: "Mawasiliano",
    signIn: "Ingia",
    freeTrial: "Jaribu Bure",
    coreBadge: "Mfumo Rahisi wa Biashara",
    headlinePre: "Acha Kusumbuka.",
    headlinePost: "Onyesha Mafanikio.",
    tagline: "Biashara yako inahitaji msaidizi anayefanya kazi kwa bidii kama wewe.",
    builtFor: "Inafaa Kwa Ajili Ya:",
    retail: "Duka la Rejareja",
    wholesale: "Duka la Jumla",
    pharmacies: "Famasia na Dawa",
    manufacturing: "Wazalishaji",
    cashMgmt: "Usimamizi wa Pesa",
    cashDesc: "Dhibiti hesabu zako za pesa kwa usahihi kila siku.",
    capitalProt: "Ulinzi wa Mtaji",
    capitalDesc: "Weka mtaji wako salama kwa kumbukumbu rahisi za mauzo.",
    stockIntel: "Udhibiti wa Stoki",
    stockDesc: "Fuatilia idadi ya bidhaa zako na upate taarifa zikiisha.",
    offlineTitle: "Inafanya Kazi Bure Bila Internet",
    offlineDesc: "Inafanya kazi 100% bila internet. Pokea malipo ya simu haraka.",
    meetLucy: "Kutana na Lucy",
    lucyDesc: "msaidizi na rafiki yako wa karibu atakayekusaidia kutumia mfumo na kukuza biashara yako",
    creed: "Jasper inasaidia biashara yako kukua zaidi!",
    getStarted: "Anza Sasa - Ni Bure",
    offlineMetric: "Bila Mtandao",
    syncMetric: "Sawazisha Haraka",
    aiMetric: "Msaidizi wa AI",
    aboutTitle: "usaidizi wa biashara yako bila mtandao",
    aboutDesc: "jasper imeundwa ili kukusaidia kusimimamia na kukuza biashara yako popote ulipo. jasper inarahisisha iwe upo dar mbeya au nairobi biashara yako iko mikononi mwako.",
    aboutSupport: "msaada wa haraka unapokwama",
    aboutCurrency: "Marekebisho rahisi ya kodi",
    aboutEndpoints: "zaidi ya maduka 1000+ yanayotumia",
    advancedCapabilities: "Vipengele Muhimu",
    advancedDesc: "Njia rahisi za kuhakikisha mashine za mauzo zinafanya kazi kila wakati.",
    featOfflineTitle: "mauzo bil ya mtandao",
    featOfflineDesc: "Je, hakuna internet au umeme ikikatika? Hakuna shida. Mauzo yanaendelea na kujisawazisha mtandao ukirudi.",
    featLedgerTitle: "Usimamizi wa Stoki & Taarifa za Bidhaa",
    featLedgerDesc: "Fuatilia idadi ya bidhaa zako kwa urahisi, pokea taarifa stoki inapopungua, na uzuie hasara kwa kufuatilia tarehe za kuharibika kwa bidhaa.",
    featGatewayTitle: "Hakiki Malipo ya Simu",
    featGatewayDesc: "Inaungana moja kwa moja na M-Pesa, Tigo Pesa, na Airtel Money ili kuhakiki malipo kwa sekunde chache.",
    featSmartSokoTitle: "Zalisha na SmartSoko",
    featSmartSokoDesc: "Dhibiti malighafi, uzalishaji, na gharama halisi za kila bidhaa kwa urahisi.",
    testimonialHeader: "Biashara Zinazofanikiwa",
    testimonialSub: "Maudhui kutoka kwa wamiliki wa maduka",
    mustafaSay: "Tulipoteza mauzo mtandao ulipokatika. Tangu tuanze kutumia keshia ya bila mtandao ya Jasper, mauzo hayajawahi kusimama.",
    kwameSay: "Kupanga orodha za dawa ilikuwa ngumu sana. Baada ya kupata Jasper, Lucy alimaliza tatizo huo kwa urahisi. Safi kabisa.",
    fatumaSay: "Mfumo wa vyumba vya hoteli unafanya kazi vizuri. Wafanyakazi wetu walijifunza kuutumia kwa dakika tano tu.",
    mustafaRole: "Mmiliki wa Mgahawa • Dar es Salaam",
    kwameRole: "Mkurugenzi wa Famasia • Kisumu",
    fatumaRole: "Meneja wa Hoteli • Arusha",
    pricingHeader: "Bei Rahisi",
    pricingSub: "Chagua kifurushi kinachofaa duka lako",
    pricingDesc: "Anza na siku 14 bure. Chagua kifurushi ili uendelee. Badilisha kifurushi wakati wowote.",
    trialName: "Majaribio Bure",
    trialDesc: "Kagua vipengele na uandae orodha ya bidhaa zako bure kabisa.",
    essentialName: "Msingi",
    essentialDesc: "Inafaa kwa maduka yenye keshia moja ili kufuatilia bidhaa na tarehe za mwisho.",
    standardName: "Kati",
    standardDesc: "Inafaa kwa maduka yenye matawi mengi, famasia, au hoteli.",
    premiumName: "Mkuu",
    premiumDesc: "Bidhaa zisizo na kikomo, inafaa sana kwa ghala kubwa la biashara.",
    limitTrial: "Bidhaa 20 • Duka 1 • Mtumiaji 1",
    limitEssential: "Bidhaa 200 • Duka 1 • Watumiaji 2",
    limitStandard: "Bidhaa 1,000 • Maduka 5 • Watumiaji 5",
    limitPremium: "Idadi ya Bidhaa Bila Kikomo • Maduka 10",
    featureReport: "Ripoti za Mauzo za Kawaida",
    featureNoExpiry: "Kufuatilia tarehe ya mwisho wa bidhaa",
    featureAiHelp: "Usaidizi wa Lucy",
    featureVip: "Msaada maalum kwanza",
    choosePlan: "Chagua Kifurushi",
    startFree: "Anza Majaribio Bure",
    faqHeader: "Maswali ya Mara kwa Mara",
    aboutCompany: "Maelezo ya Kampuni",
    contactSupport: "Wasiliana nasi",
    callLucy: "Ongea na Lucy",
    getInTouch: "Wasiliana Nasi",
    directAssistance: "Msaada wa Moja kwa Moja na Huduma za Kukufikia Ulipo",
    contactDesc: "Unahitaji kuunganishwa, kusaidiwa kutumia mfumo, au mafunzo ya moja kwa moja? Wasiliana na mawakala wetu wa karibu tukufikie na kukusaidia mpaka ofisini kwako.",
    callLocalAgent: "Piga Simu kwa Wakala wa Karibu",
    contactDeployments: "Wasiliana kwa Huduma ya Ufungaji",
    privacyText: "Sera ya Faragha",
    privacyModalTitle: "Sera ya Faragha ya Jasper Suite",
    privacyIntro: "Tunalinda data zako za biashara kwa sheria zifuatazo:",
    privacyPoint1: "Faragha ya Kifaa: Mauzo yako ya siku yanahifadhiwa kwa usiri mkubwa ndani ya kifaa chako mwenwe.",
    privacyPoint2: "Usaidizi wa Mtandao: Data inayotumwa kwenye mtandao inalindwa kwa njia salama za kisasa.",
    privacyPoint3: "Hakuna Kushiriki Data: Kamwe hatuuzi au kugawa ripoti zako za mauzo kwa kampuni nyingine.",
    privacyPoint4: "Haki ya Kufuta: Unaweza kufuta kabisa data zako zote kwenye mtandao na kwenye kifaa chako wakati wowote.",
    closeBtn: "Funga"
  },
  es: {
    home: "Inicio",
    aboutUs: "Nosotros",
    features: "Funciones",
    pricing: "Precios",
    faq: "Preguntas",
    contact: "Contacto",
    signIn: "Ingresar",
    freeTrial: "Prueba Gratis",
    coreBadge: "Sistema de Negocio Único",
    headlinePre: "Menos Control.",
    headlinePost: "Más Crecimiento.",
    tagline: "Tu negocio merece un compañero que trabaje tan duro como tú.",
    builtFor: "Creado Para:",
    retail: "Tiendas de Venta",
    wholesale: "Tiendas por Mayor",
    pharmacies: "Farmacias",
    cashMgmt: "Control de Caja",
    cashDesc: "Controla todo tu dinero con precisión todos los días.",
    capitalProt: "Luz de Capital",
    capitalDesc: "Mantén tu capital seguro con registros simples de transacciones.",
    stockIntel: "Control de Inventario",
    stockDesc: "Sigue tus productos con alertas de bajo nivel de stock.",
    offlineTitle: "Funciona Sin Internet",
    offlineDesc: "Funciona 100% sin internet. Recibe pagos móviles al instante.",
    meetLucy: "Conoce a Lucy",
    lucyDesc: "Tu asesora inteligente lista para responder preguntas y ayudarte a crecer.",
    creed: "¡Jasper ayuda a que tu negocio crezca más!",
    getStarted: "Comienza Gratis",
    offlineMetric: "Sin Internet",
    syncMetric: "Sincronización Rápida",
    aiMetric: "Asistente de IA",
    aboutTitle: "Apoyo Sin Internet para Tu Negocio",
    aboutDesc: "Creamos Jasper para que un internet inestable nunca detenga tus ventas. Tu caja registradora sigue funcionando siempre.",
    aboutSupport: "Oficinas de soporte reales",
    aboutCurrency: "Configuración automática de impuestos locales",
    aboutEndpoints: "Más de 2400 tiendas activas",
    advancedCapabilities: "Características Avanzadas",
    advancedDesc: "Soluciones sencillas para mantener tus cajas funcionando siempre.",
    featOfflineTitle: "Caja Registradora Sin Internet",
    featOfflineDesc: "¿Sin internet o sin luz? No hay problema. Sigue vendiendo y se actualiza al volver la red.",
    featLedgerTitle: "Moneda Multi-País",
    featLedgerDesc: "Soporta monedas TZS, KES y NGN con tasas de impuestos locales fácilmente.",
    featGatewayTitle: "Verificación de Pago Móvil",
    featGatewayDesc: "Se conecta con M-Pesa, Tigo Pesa y Airtel Money para confirmar pagos en segundos.",
    testimonialHeader: "Clientes Felices",
    testimonialSub: "Lo que dicen los dueños de tiendas",
    mustafaSay: "Perdíamos ventas cuando se caía el internet. Desde que usamos Jasper sin conexión, las ventas nunca se detienen.",
    kwameSay: "Controlar las medicinas era difícil. Lucy de Jasper ordenó todo fácilmente. Excelente.",
    fatumaSay: "El sistema de reservas de hotel funciona genial. Las recepcionistas aprendieron en cinco minutos.",
    mustafaRole: "Dueño de Restaurante • Dar es Salaam",
    kwameRole: "Director de Farmacia • Kisumu",
    fatumaRole: "Directora de Hotel • Arusha",
    pricingHeader: "Precios Simples",
    pricingSub: "Elige el mejor plan para tu tienda",
    pricingDesc: "Prueba gratis por 14 días. Elige un plan para continuar. Cambia de plan cuando quieras.",
    trialName: "Prueba Gratis",
    trialDesc: "Prueba las funciones y carga tus productos gratis hoy.",
    essentialName: "Esencial",
    essentialDesc: "Ideal para tiendas pequeñas con un solo cajero.",
    standardName: "Estándar",
    standardDesc: "Perfecto para negocios con varias sucursales o farmacias.",
    premiumName: "Premium",
    premiumDesc: "Productos ilimitados para grandes almacenes y distribución.",
    limitTrial: "Máximo 20 Productos • 1 Tienda • 1 Usuario",
    limitEssential: "Máximo 200 Productos • 1 Tienda • 2 Usuarios",
    limitStandard: "Máximo 1000 Productos • 5 Tiendas • 5 Usuarios",
    limitPremium: "Productos Ilimitados • 10 Tiendas • Personal Ilimitado",
    featureReport: "Informes estándar de ventas",
    featureNoExpiry: "Control de fechas de vencimiento",
    featureAiHelp: "Asistencia de Lucy",
    featureVip: "Atención prioritaria y rápida",
    choosePlan: "Elegir Plan",
    startFree: "Probar Gratis",
    faqHeader: "Preguntas Frecuentes",
    aboutCompany: "Información de la Empresa",
    contactSupport: "Escríbenos",
    callLucy: "Pregúntale a Lucy",
    privacyText: "Política de Privacidad",
    privacyModalTitle: "Política de Privacidad de Jasper Suite",
    privacyIntro: "Protegemos tus datos comerciales bajo reglas legales estrictas:",
    privacyPoint1: "Guardado Local Puro: Tu información de ventas se guarda de forma segura únicamente en tu propio dispositivo.",
    privacyPoint2: "Privacidad en la Nube: Los registros sincronizados están protegidos con conexiones seguras.",
    privacyPoint3: "Información Protegida: Nunca vendemos ni compartimos tus reportes comerciales con extraños.",
    privacyPoint4: "Control Total de Borrado: Puedes eliminar definitivamente todos tus datos cuando lo desees.",
    closeBtn: "Cerrar"
  },
  fr: {
    home: "Accueil",
    aboutUs: "À Propos",
    features: "Fonctions",
    pricing: "Tarifs",
    faq: "Questions",
    contact: "Contact",
    signIn: "Se Connecter",
    freeTrial: "Essai Gratuit",
    coreBadge: "Système de Vente Stable",
    headlinePre: "Arrêtez de stresser.",
    headlinePost: "Progressez vite.",
    tagline: "Votre commerce mérite un partenaire qui travaille dur comme vous.",
    builtFor: "Créé Pour:",
    retail: "Boutiques en Détail",
    wholesale: "Boutiques en Gros",
    pharmacies: "Pharmacies",
    cashMgmt: "Gestion de Caisse",
    cashDesc: "Gerez votre argent avec clarté chaque jour de manière simple.",
    capitalProt: "Protection du Capital",
    capitalDesc: "Gardez votre capital en sécurité avec des calculs simples.",
    stockIntel: "Suivi des Stocks",
    stockDesc: "Faites le point de vos stocks avec des alertes simples de baisse.",
    offlineTitle: "Fonctionne Sans Connexion",
    offlineDesc: "Marche à 100% sans internet. Reçoit les paiements mobiles de suite.",
    meetLucy: "Découvrez Lucy",
    lucyDesc: "Votre assistante intelligente qui répond à vos questions et vous aide à grandir.",
    creed: "Jasper aide votre commerce à grandir plus haut !",
    getStarted: "Commencer Gratuitement",
    offlineMetric: "Sans Internet",
    syncMetric: "Mise à jour Rapide",
    aiMetric: "Assistant IA",
    aboutTitle: "De l'Aide Sans Connexion Pour Vos Ventes",
    aboutDesc: "Nous avons créé Jasper pour qu'une mauvaise connexion ne bloque jamais vos ventes. Votre tiroir-caisse fonctionne toujours.",
    aboutSupport: "Bureaux de support réels",
    aboutCurrency: "Calcul automatique de la taxe locale",
    aboutEndpoints: "Plus de 2 400 boutiques actives",
    advancedCapabilities: "Fonctions Clés",
    advancedDesc: "Des plans faciles pour que la caisse de votre boutique reste active.",
    featOfflineTitle: "Caisse Sans Internet",
    featOfflineDesc: "Panne de réseau ou de courant ? Aucun souci. Vendez comme d'habitude et synchronisez après.",
    featLedgerTitle: "Multi-Devise Simple",
    featLedgerDesc: "Gère les monnaies TZS, KES, et NGN avec les taxes de vente locales en direct.",
    featGatewayTitle: "Validation de Paiement Mobile",
    featGatewayDesc: "Vérifie les transactions M-Pesa, Airtel et Tigo en quelques secondes.",
    testimonialHeader: "Commerçants Heureux",
    testimonialSub: "Ce que disent les propriétaires",
    mustafaSay: "On perdait des ventes en cas de coupure réseau. Depuis qu'on a Jasper sans internet, la caisse n'arrête pas.",
    kwameSay: "L'inventaire des remèdes était fatiguant. Notre assistante Lucy a tout réglé avec plaisir.",
    fatumaSay: "Le planning des chambres d'hôtel est super. Nos agents ont appris à l'utiliser en cinq minutes seulement.",
    mustafaRole: "Chef de Restaurant • Dar es Salaam",
    kwameRole: "Gérant de Pharmacie • Kisumu",
    fatumaRole: "Directrice d'Hôtel • Arusha",
    pricingHeader: "Tarifs Simples",
    pricingSub: "Choisissez l'abonnement idéal pour votre magasin",
    pricingDesc: "Bénéficiez de 14 jours d'essai gratuit. Changez d'offre à tout moment.",
    trialName: "Essai Gratuit",
    trialDesc: "Testez toutes les options et chargez vos produits aujourd'hui de façon libre.",
    essentialName: "Essentiel",
    essentialDesc: "Idéal pour les petits commerces avec un seul employé.",
    standardName: "Standard",
    standardDesc: "Parfait pour gérer plusieurs boutiques, pharmacies ou hôtels.",
    premiumName: "Premium",
    premiumDesc: "Articles illimités pour les grands dépôts ou réseaux de revente.",
    limitTrial: "Max 20 Produits • 1 Boutique • 1 Utilisateur",
    limitEssential: "Max 200 Produits • 1 Boutique • 2 Utilisateurs",
    limitStandard: "Max 1 000 Produits • 5 Boutiques • 5 Utilisateurs",
    limitPremium: "Produits illimités • 10 Boutiques • Personnel illimité",
    featureReport: "Rapports de caisse réguliers",
    featureNoExpiry: "Alertes sur les dates d'expiration",
    featureAiHelp: "Soutien direct de Lucy",
    featureVip: "Assistance VIP rapide",
    choosePlan: "Choisir ce Plan",
    startFree: "Essayer Gratuitement",
    faqHeader: "Questions Fréquentes",
    aboutCompany: "Infos de l'Entreprise",
    contactSupport: "Nous Contacter",
    callLucy: "Consulter Lucy",
    privacyText: "Règles de Confidentialité",
    privacyModalTitle: "Confidentialité de Jasper Suite",
    privacyIntro: "Nous protégeons rigoureusement vos données de vente :",
    privacyPoint1: "Sécurité Locale : Vos statistiques de vente du jour restent privées sur votre propre appareil.",
    privacyPoint2: "Synchronisation Sûre : Les fichiers envoyés sur notre réseau sont cryptés de bout en bout.",
    privacyPoint3: "Pas de Partage Payant : Nous ne revendons jamais vos informations de caisse à d'autres sociétés.",
    privacyPoint4: "Contrôle de Retrait : Vous pouvez effacer définitivement vos données à tout instant.",
    closeBtn: "Fermer"
  },
  it: {
    home: "Inizio",
    aboutUs: "Chi Siamo",
    features: "Funzioni",
    pricing: "Prezzi",
    faq: "Domande",
    contact: "Contatti",
    signIn: "Accedi",
    freeTrial: "Prova Gratis",
    coreBadge: "Gestione Semplice Negozi",
    headlinePre: "Zero Stress.",
    headlinePost: "Crescita Facile.",
    tagline: "Il tuo negozio merita un alleato che lavori sodo come te.",
    builtFor: "Studiato Per:",
    retail: "Negozi al Dettaglio",
    wholesale: "Negozi all'Ingrosso",
    pharmacies: "Farmacie",
    cashMgmt: "Controllo di Cassa",
    cashDesc: "Gestisci i tuoi contanti con precisione ogni giorno, semplicemente.",
    capitalProt: "Tutela del Capitale",
    capitalDesc: "Proteggi i tuoi guadagni con registri di vendita facili da leggere.",
    stockIntel: "Gestione Prodotti",
    stockDesc: "Tieni il conto del magazzino e ricevi avvisi quando il prodotto scarseggia.",
    offlineTitle: "Funziona Senza Internet",
    offlineDesc: "Attivo al 100% senza rete. Ricevi i pagamenti dei cellulari sul momento.",
    meetLucy: "Incontra Lucy",
    lucyDesc: "La tua aiutante intelligente pronta a rispondere e a far crescere i tuoi affari.",
    creed: "Jasper spinge la tua attività ancora più in alto!",
    getStarted: "Comincia Gratis",
    offlineMetric: "Senza Internet",
    syncMetric: "Sincronia Rapida",
    aiMetric: "Aiutante IA",
    aboutTitle: "Vendite Sicure Anche Senza Connessione",
    aboutDesc: "Abbiamo costruito Jasper perché una connessione instabile non deve mai bloccare la tua cassa. Il tuo negozio continua a vendere sempre.",
    aboutSupport: "Uffici di supporto reali",
    aboutCurrency: "Configurazione tasse locali automatica",
    aboutEndpoints: "Più di 2.400 negozi attivi",
    advancedCapabilities: "Caratteristiche Chiave",
    advancedDesc: "Metodi chiari per far funzionare sempre la tua cassa di vendita.",
    featOfflineTitle: "Cassa Attiva Senza Rete",
    featOfflineDesc: "Niente rete o via la corrente? Non c'è problema. Continua a battere scontrini e si aggiorna dopo.",
    featLedgerTitle: "Gestione Valute Diverse",
    featLedgerDesc: "Gestisce valute TZS, KES, NGN e le relative tasse con la massima facilità.",
    featGatewayTitle: "Verifica Pagamenti da Cellulare",
    featGatewayDesc: "Controlla le transazioni con M-Pesa, Airtel e Tigo in pochissimi istanti.",
    testimonialHeader: "Commercianti Felici",
    testimonialSub: "Cosa dicono i nostri clienti",
    mustafaSay: "Perdevamo soldi quando saltava la rete. Grazie alla cassa offline di Jasper, adesso vendiamo senza sosta.",
    kwameSay: "Organizzare l'elenco dei farmaci era un tormento. Lucy di Jasper ha sistemato tutto in modo facile.",
    fatumaSay: "Il sistema di prenotazione camere funziona molto bene. I dipendenti hanno imparato la cassa in cinque minuti.",
    mustafaRole: "Proprietario Ristorante • Dar es Salaam",
    kwameRole: "Direttore di Farmacia • Kisumu",
    fatumaRole: "Direttrice d'Hotel • Arusha",
    pricingHeader: "Prezzi Trasparenti",
    pricingSub: "Scegli l'abbonamento su misura per la tua attività",
    pricingDesc: "Attiva subito una prova gratuita di 14 giorni. Puoi cambiare piano quando preferisci.",
    trialName: "Prova Gratis",
    trialDesc: "Testa tutte le funzioni e inserisci i tuoi prodotti oggi stesso.",
    essentialName: "Essenziale",
    essentialDesc: "L'ideale per i piccoli negozi gestiti da un singolo operatore.",
    standardName: "Standard",
    standardDesc: "Perfetto per negozi multi-filiale, alberghi e farmacie.",
    premiumName: "Premium",
    premiumDesc: "Prodotti illimitati per magazzini merci e reti distributive.",
    limitTrial: "Max 20 Prodotti • 1 Negozio • 1 Utente",
    limitEssential: "Max 200 Prodotti • 1 Negozio • 2 Utenti",
    limitStandard: "Max 1.000 Prodotti • 5 Negozi • 5 Utenti",
    limitPremium: "Articoli illimitati • 10 Negozi • Staff illimitato",
    featureReport: "Statistiche e resoconti cassa",
    featureNoExpiry: "Verifica date di scadenza dei lotti",
    featureAiHelp: "Supporto diretto di Lucy",
    featureVip: "Assistenza VIP immediata",
    choosePlan: "Scegli questo Piano",
    startFree: "Inizia Prova Gratis",
    faqHeader: "Domande Comuni",
    aboutCompany: "Informazioni Azienda",
    contactSupport: "Parla con Noi",
    callLucy: "Chiedi a Lucy",
    privacyText: "Norme Sulla Privacy",
    privacyModalTitle: "Informativa sulla Privacy Jasper Suite",
    privacyIntro: "Rispettiamo e proteggiamo i tuoi dati di vendita con cura:",
    privacyPoint1: "Archiviazione Locale Riservata: I tuoi registri giornalieri rimangono sul tuo dispositivo senza uscire.",
    privacyPoint2: "Sincronizzazione Protetta: Tutto ciò che viene inviato online viaggia su reti ultra-sicure.",
    privacyPoint3: "Nessuna Cessione: Non vendiamo né inoltriamo mai le tue informazioni private a terze parti.",
    privacyPoint4: "Cancellazione Totale: Sei libero di azzerare o eliminare per sempre i tuoi dati quando vuoi.",
    closeBtn: "Chiudi"
  },
  ar: {
    home: "الرئيسية",
    aboutUs: "نبذة عنا",
    features: "الميزات",
    pricing: "الأسعار",
    faq: "الأسئلة",
    contact: "اتصل بنا",
    signIn: "تسجيل الدخول",
    freeTrial: "تجربة مجانية",
    coreBadge: "برنامج تجاري سهل",
    headlinePre: "وداعاً للتعقيد.",
    headlinePost: "ضاعف أرباحك.",
    tagline: "تستحق تجارتك شريكاً مخلصاً يعمل بجد مثلك تماماً ليلاً ونهاراً.",
    builtFor: "مصمم لأجل:",
    retail: "محلات التجزئة",
    wholesale: "تجار الجملة",
    pharmacies: "الصيدليات الطبية",
    cashMgmt: "إدارة الأموال والدرج",
    cashDesc: "تنظيم حسابات النقود بدقة متناهية كل يوم بكل سهولة.",
    capitalProt: "حماية رأس المال",
    capitalDesc: "حافظ على أمان أموالك عبر سجلات مبيعات بسيطة ومباشرة.",
    stockIntel: "تنظيم وإدارة المخزون",
    stockDesc: "تابع كميات بضائعك وتلقى تنبيهات فورية عند اقتراب نفاذ المنتجات.",
    offlineTitle: "يعمل بالكامل بدون إنترنت",
    offlineDesc: "يعمل بنسبة مئة بالمائة في حال انقطاع الشبكة أو الكهرباء. يوثق الدفع فوراً.",
    meetLucy: "تحدث مع لوسي الذكية",
    lucyDesc: "مساعدتك الذكية الودودة للإجابة عن تساؤلاتك ومساعدتك على تنمية تجارتك.",
    creed: "جاسبر يساعد عملك التجاري للوصول لأعلى المراتب!",
    getStarted: "ابدأ الآن مجاناً",
    offlineMetric: "دون اتصال",
    syncMetric: "تحديث فوري",
    aiMetric: "مساعد ذكاء اصطناعي",
    aboutTitle: "بياعتك مستمرة حتى بدون شبكة",
    aboutDesc: "لقد قمنا بتطوير جاسبر لكي لا يقف انقطاع النت عائق حساباتك أبداً. درج المبيعات يعمل دائماً.",
    aboutSupport: "مكاتب دعم فني حقيقية",
    aboutCurrency: "تحديث الضرائب المحلية تلقائياً",
    aboutEndpoints: "أكثر من ٢٤٠٠ متجر نشط",
    advancedCapabilities: "ميزات وتجهيزات متقدمة",
    advancedDesc: "خطوات غاية في السهولة لتأمين عمل آلات المحاسبة طوال اليوم.",
    featOfflineTitle: "ماكينة بيع دون إنترنت",
    featOfflineDesc: "شبكة ضعيفة أو كهرباء مقطوعة؟ لا تقلق. واصل البيع وسيتم التحديث بمجرد عودة الاتصال.",
    featLedgerTitle: "دعم العملات المختلفة",
    featLedgerDesc: "إدارة عملات TZS و KES و NGN والضرائب المخصصة معاً بمنتهى البساطة.",
    featGatewayTitle: "توثيق فوري للمدفوعات عبر الهاتف",
    featGatewayDesc: "تكامل تام مع خدمات M-Pesa وغيرها للتحقق من وصول المال خلال ثوانٍ معدودة.",
    testimonialHeader: "آراء شركاء النجاح",
    testimonialSub: "ماذا يقول أصحاب المتاجر",
    mustafaSay: "كنا نخسر المبيعات عند عطل النت. مع كاشير جاسبر دون إنترنت، حركة البيع لم تتوقف أبداً لدينا.",
    kwameSay: "ترتيب قوائم وتواريخ الأدوية كان متعباً وصعباً. لوسي الذكية رتبت كل شيء بسهولة تامة.",
    fatumaSay: "مراقبة وإدارة حجز الغرف بالفندق يسير بشكل ممتاز. موظفونا تعلموا تشغيلها بخمس دقائق.",
    mustafaRole: "صاحب مطعم • دار السلام",
    kwameRole: "مدير صيدلية • كيسومو",
    fatumaRole: "إدارة الفندق • أروشا",
    pricingHeader: "أسعار مناسبة وبسيطة",
    pricingSub: "اختر الخطة التي تناسب حجم نشاطك التجاري",
    pricingDesc: "استفد من تجربة مجانية لمدة ١٤ يوماً. تستطيع التعديل أو الترقية وقتما تشاء.",
    trialName: "تجربة مجانية",
    trialDesc: "جرب كافة المزايا وأضف منتجاتك اليوم بدون أي التزامات مالية.",
    essentialName: "الأساسي",
    essentialDesc: "الأفضل للمشاريع الناشئة التي تحتاج ماكينة محاسبة واحدة.",
    standardName: "القياسي",
    standardDesc: "ممتاز جداً لإدارة عدة فروع ومنافذ صيدلية أو منشأة فندقية.",
    premiumName: "المتميز",
    premiumDesc: "منتجات غير محدودة موجه للمستودعات ومراكز العرض الكبرى.",
    limitTrial: "أقصى حد ٢٠ منتج • متجر واحد • مستخدم واحد",
    limitEssential: "أقصى حد ٢٠٠ منتج • متجر واحد • مستخدمين اثنين",
    limitStandard: "أقصى حد ١٠٠٠ منتج • ٥ فروع • ٥ مستخدمين",
    limitPremium: "منتجات بلا حدود • ١٠ فروع • موظفين بلا قيود",
    featureReport: "تقارير حسابات مبيعات قياسية",
    featureNoExpiry: "متابعة تواريخ انتهاء الصلاحية",
    featureAiHelp: "مساعدة مخصصة عبر لوسي",
    featureVip: "أولوية دعم فني سريع للغاية VIP",
    choosePlan: "اختر هذه الخطة",
    startFree: "ابدأ التجربة مجاناً",
    faqHeader: "أسئلة وإجابات",
    aboutCompany: "معلومات عن الشركة",
    contactSupport: "تواصل معنا",
    callLucy: "تحدث مع لوسي",
    privacyText: "سياسة الخصوصية",
    privacyModalTitle: "وثيقة خصوصية وحماية بيانات جاسبر",
    privacyIntro: "نحن ملتزمون التزاماً كلياً بحماية سرية مبيعاتك وأرقامك التجاري:",
    privacyPoint1: "سرية الجهاز: تُخزن مبيعاتك اليومية محلياً مشفرة في جهازك الخاص فقط.",
    privacyPoint2: "نقل تشفير آمن: جميع البيانات المرسلة لأجهزتنا تمر عبر قنوات اتصال مشفرة وصارمة.",
    privacyPoint3: "حظر البيع والمشاركة: يمنع كلياً بيع أو تقديم سجلات بضائعك ومردودك لأي جهة ترويجية.",
    privacyPoint4: "حق الحذف الكامل: تملك الصلاحية المطلقة لمسح حساباتك من الأجهزة والسيرفر بضغطة زر.",
    closeBtn: "إغلاق"
  },
  zh: {
    home: "首页",
    aboutUs: "关于我们",
    features: "核心功能",
    pricing: "价格方案",
    faq: "常见问题",
    contact: "联系我们",
    signIn: "登录系统",
    freeTrial: "免费试用",
    coreBadge: "简单的一站式商业系统",
    headlinePre: "停止繁琐管理。",
    headlinePost: "开启快速增长。",
    tagline: "您的业务值得拥有一个像您一样努力奋斗的忠实伙伴。",
    builtFor: "适用行业:",
    retail: "零售商铺",
    wholesale: "批发商行",
    pharmacies: "药店与药房",
    cashMgmt: "现金与账目管理",
    cashDesc: "每天轻松、准确地管理您的现金和营业收入账户。",
    capitalProt: "资金安全防护",
    capitalDesc: "通过清晰简单的交易日志，保障您的每一笔资金安全无虞。",
    stockIntel: "库存智能跟踪",
    stockDesc: "智能监控您的产品库存，并在库存不足时及时发送提醒。",
    offlineTitle: "不依赖网络运行",
    offlineDesc: "100% 支持离线操作。即使停网断电，也能瞬间完成收款。",
    meetLucy: "与智能助手 Lucy 相识",
    lucyDesc: "您的友好助手，随时解答疑问并提供业务优化建议。",
    creed: "Jasper 助您的生意蓬勃发展，更上一层楼！",
    getStarted: "免费开始使用",
    offlineMetric: "离线结账支持",
    syncMetric: "联网自动同步",
    aiMetric: "智能 AI 助手",
    aboutTitle: "为所有商家量身定做的离线销售服务",
    aboutDesc: "我们创立 Jasper 的初衷是，不稳定的网络不应该成为销售的绊脚石。无论您在何处，收款抽屉都会正常运转。",
    aboutSupport: "实体人工支持网点",
    aboutCurrency: "全自动本地税率计算与设置",
    aboutEndpoints: "已有超过 2400 家活跃注册店铺使用",
    advancedCapabilities: "行业领先的高级功能",
    advancedDesc: "简单实用的解决方案，确保您的收银台始终流畅运转。",
    featOfflineTitle: "离线智能收银台",
    featOfflineDesc: "没有网络或突然断电？完全不用担心。照常收银，并在网络恢复后自动同步。",
    featLedgerTitle: "多国货币支持",
    featLedgerDesc: "轻松支持 TZS, KES 和 NGN 货币，并自动适配当地的商业税率计算。",
    featGatewayTitle: "手机快捷收款实时验证",
    featGatewayDesc: "直连 M-Pesa, Tigo 及 Airtel Money 等主流通道，数秒内验证交易状态。",
    testimonialHeader: "成功的商家",
    testimonialSub: "听听其他店主怎么说",
    mustafaSay: "以前网络不稳定时，我们的美食广场每天至少损失15%的生意。使用 Jasper 的离线功能后，收银从未中断过！",
    kwameSay: "药店以前药品的繁杂管理耗费了我们很多精力。有了 Jasper，智能助理 Lucy 帮我们打理得有言不虚。太好用了！",
    fatumaSay: "酒店房间预订系统运行十分顺畅。前台人员都在短短五分钟内轻松学会使用了。",
    mustafaRole: "餐厅老板 • 达累斯萨拉姆",
    kwameRole: "药房总监 • 基苏木",
    fatumaRole: "酒店经理 • 阿鲁沙",
    pricingHeader: "价格清晰",
    pricingSub: "选择匹配您商铺规模的套餐",
    pricingDesc: "立即注册即可享受 14 天免费体验，随时调整或升级套餐方案。",
    trialName: "免费试用",
    trialDesc: "自由测试所有功能，开始免费添加您的产品。",
    essentialName: "创业起步",
    essentialDesc: "最适合配备单一收银窗口的小型成长门店。",
    standardName: "标准旗舰",
    standardDesc: "多分店、连锁药房或精品酒店的首选配置。",
    premiumName: "尊贵批发",
    premiumDesc: "支持无限量添加商品，超大型物流或仓储不二之选。",
    limitTrial: "最多 20 种产品 • 1 家店面 • 1 名店员",
    limitEssential: "最多 200 种产品 • 1 家店面 • 2 名店员",
    limitStandard: "最多 1000 种产品 • 5 家分店 • 5 名店员",
    limitPremium: "不限量添加产品 • 10 家分店 • 不限制人数",
    featureReport: "标准 POS 交易报表",
    featureNoExpiry: "商品有效期跟踪和到期提醒",
    featureAiHelp: "专属 Lucy 智能助手指导",
    featureVip: "享有 VIP 优先技术支持",
    choosePlan: "选择套餐",
    startFree: "开启免费试用",
    faqHeader: "常见回答",
    aboutCompany: "企业概况",
    contactSupport: "获取协助与支持",
    callLucy: "咨询 Lucy 智能助理",
    privacyText: "隐私政策",
    privacyModalTitle: "Jasper 商业套件用户隐私保护条例",
    privacyIntro: "我们严格保障您的核心商业秘密及经营数据安全:",
    privacyPoint1: "本地安全：您的日常销售流水与经营日志仅高度保存在您本人的终端设备。",
    privacyPoint2: "安全传输：同步到服务器的营业信息、产品名单均采用银行级别加密。",
    privacyPoint3: "禁止转售：我们郑重承诺，绝不将您的营业状况转售或分享给营销团队。",
    privacyPoint4: "完全销毁：您随时可以点按清空，永久彻底铲除您的云端和本地数据记录。",
    closeBtn: "安全关闭"
  },
  hi: {
    home: "होम",
    aboutUs: "हमारे बारे में",
    features: "विशेषताएं",
    pricing: "कीमतें",
    faq: "सवाल",
    contact: "संपर्क",
    signIn: "लॉगिन करें",
    freeTrial: "फ्री ट्रायल",
    coreBadge: "आसान बिजनेस सिस्टम",
    headlinePre: "परेशानी बंद करें.",
    headlinePost: "मुनाफा बढ़ाएं.",
    tagline: "आपके व्यापार को एक ऐसे मददगार साथी की ज़रूरत है जो आपकी तरह ही मेहनत करे.",
    builtFor: "इनके लिए उपयोगी:",
    retail: "रिटेल दुकानें",
    wholesale: "थोक दुकानें",
    pharmacies: "दवाइयों की दुकान",
    cashMgmt: "रोज़ाना पैसे का हिसाब",
    cashDesc: "अपनी रोज़ाना की आमदनी और पैसों का हिसाब बिल्कुल सही रखें.",
    capitalProt: "पूंजी की सुरक्षा",
    capitalDesc: "लेनदेन के सरल रिकॉर्ड के साथ अपनी पूंजी सुरक्षित रखें.",
    stockIntel: "सामान का हिसाब (स्टॉक)",
    stockDesc: "सामान की संख्या पर नज़र रखें और खत्म होने पर तुरंत जानें.",
    offlineTitle: "बिना इंटरनेट चलेगा",
    offlineDesc: "बिजली या इंटरनेट न होने पर भी 100% चलेगा. तुरंत पेमेंट लें.",
    meetLucy: "मिलिए लकी से",
    lucyDesc: "आपकी मददगार साथी जो सवाल के जवाब देती है और व्यापार बढ़ाती है.",
    creed: "जैस्पर आपके व्यापार को और आगे बढ़ाएगा!",
    getStarted: "मुफ़्त शुरू करें",
    offlineMetric: "बिना इंटरनेट",
    syncMetric: "तुरंत अपडेट",
    aiMetric: "AI सहायक",
    aboutTitle: "सामान बेचने में इंटरनेट की परेशानी खत्म",
    aboutDesc: "हमने जैस्पर इसलिए बनाया ताकि खराब इंटरनेट से कभी आपकी दुकान की बिक्री न रुके. आपका पैसे का गल्ला हमेशा चालू रहेगा.",
    aboutSupport: "असली सहायता केंद्र",
    aboutCurrency: "स्थानीय टैक्स का अपने आप मेल",
    aboutEndpoints: "2400 से ज़्यादा चलती हुई दुकानें",
    advancedCapabilities: "मुख्य विशेषताएं",
    advancedDesc: "हमेशा बिक्री चालू रखने के आसान और सीधे तरीके.",
    featOfflineTitle: "बिना इंटरनेट की गल्ला मशीन",
    featOfflineDesc: "इंटरनेट नहीं है? कोई बात नहीं. बिक्री जारी रखें, नेट आने पर अपने आप अपडेट हो जाएगा.",
    featLedgerTitle: "विभिन्न देशों के पैसे का सपोर्ट",
    featLedgerDesc: "बिना किसी झंझट के स्थानीय टैक्स के साथ TZS, KES और NGN पैसों को संभाले.",
    featGatewayTitle: "मोबाइल पैसे की तुरंत जांच",
    featGatewayDesc: "M-Pesa और दूसरे पेमेंट ऐप से जुड़कर पेमेंट को तुरंत चेक करता है.",
    testimonialHeader: "सफल दुकानदार",
    testimonialSub: "बाकी दुकानदारों की जुबानी",
    mustafaSay: "इंटरनेट बंद होने पर हमारा नुकसान होता था. जब से हमने जैविक जैस्पर शुरू किया है, बिक्री कभी नहीं रुकती.",
    kwameSay: "दवाइयों की लिस्ट बनाना बहुत कठिन था. जैस्पर की लकी ने सब कुछ चुटकियों में आसान कर दिया.",
    fatumaSay: "हलांकि होटल के कमरों की बुकिंग कमाल की है. हमारे कर्मचारियों ने इसे सिर्फ पांच मिनट में सीख लिया.",
    mustafaRole: "रेस्टोरेंट मालिक • दार एस सलाम",
    kwameRole: "फार्मेसी डायरेक्टर • किसुमू",
    fatumaRole: "हॉस्टल मैनेजर • अरुशा",
    pricingHeader: "सीधी कीमतें",
    pricingSub: "अपनी दुकान के आकार के अनुसार सबसे अच्छा प्लान चुनें",
    pricingDesc: "14 दिन का फ्री ट्रायल आज ही शुरू करें. जब चाहें अपना प्लान बदलें.",
    trialName: "फ्री ट्रायल",
    trialDesc: "विशेषताओं को परखें और अपना सामान मुफ़्त में जोड़ें.",
    essentialName: "ज़रूरी",
    essentialDesc: "छोटे दुकानदारों के लिए सबसे बढ़िया जहां केवल एक बिल काउंटर है.",
    standardName: "स्टैंडर्ड",
    standardDesc: "बड़ी दुकानों, होटल या दवाइयों की दुकानों के लिए बेस्ट.",
    premiumName: "प्रीमियम",
    premiumDesc: "अनलिमिटेड सामान के साथ बड़े गोदामों के लिए संपूर्ण व्यवस्था.",
    limitTrial: "अधिकतम 20 सामान • 1 दुकान • 1 कर्मचारी",
    limitEssential: "अधिकतम 200 सामान • 1 दुकान • 2 कर्मचारी",
    limitStandard: "अधिकतम 1000 सामान • 5 दुकानें • 5 कर्मचारी",
    limitPremium: "असीमित सामान • 10 दुकानें • असीमित स्टाफ",
    featureReport: "आसान बिक्री रिपोर्ट",
    featureNoExpiry: "दवा खत्म होने की तारीख",
    featureAiHelp: "लकी की मदद",
    featureVip: "VIP वीआईपी तुरंत मदद",
    choosePlan: "प्लान चुनें",
    startFree: "फ्री में शुरू करें",
    faqHeader: "सवाल और जवाब",
    aboutCompany: "कंपनी की जानकारी",
    contactSupport: "हमसे बात करें",
    callLucy: "लकी से बात करें",
    privacyText: "गोपनीयता नीति",
    privacyModalTitle: "जैस्पर सुइट गोपनीयता सुरक्षा नियम",
    privacyIntro: "हम आपके व्यापार का डेटा इन कड़े नियमों के तहत सुरक्षित रखते हैं:",
    privacyPoint1: "अपने पास सुरक्षा: आपका रोज़ का हिसाब केवल आपके अपने फोन पर ही सुरक्षित रहता है.",
    privacyPoint2: "सुरक्षित सर्वर: सर्वर पर भेजा जाने वाला डेटा पूरी तरह से सुरक्षित ताले (एन्क्रिप्शन) से बंधा होता है.",
    privacyPoint3: "कोई बाहरी शेयर नहीं: हम कभी भी आपकी दुकान की बिक्री का डेटा किसी और कंपनी को नहीं बेचते.",
    privacyPoint4: "डेटा मिटाने का अधिकार: आप जब चाहें अपना सारा डेटा चुटकियों में पूरी तरह से मिटा सकते.",
    closeBtn: "बंद करें"
  }
};

interface LandingPageProps {
  onNavigate: (route: string) => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
}

export default function LandingPage({ onNavigate, isDark = false, onToggleTheme }: LandingPageProps) {
  const [currency, setCurrency] = useState<'TZS' | 'KES' | 'NGN'>('TZS');
  const { lang, setLang } = useTranslation();

  // 1. Fast fallback geo detection using browser timezone and navigator settings
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) {
        if (tz.includes('Nairobi')) {
          setCurrency('KES');
        } else if (tz.includes('Lagos')) {
          setCurrency('NGN');
        } else if (tz.includes('Dar_es_Salaam') || tz.includes('Arusha') || tz.includes('Kampala')) {
          setCurrency('TZS');
        } else {
          const userLang = navigator.language || '';
          if (userLang.includes('KE')) {
            setCurrency('KES');
          } else if (userLang.includes('NG')) {
            setCurrency('NGN');
          } else {
            setCurrency('TZS');
          }
        }
      }
    } catch (e: any) {
      console.warn("Failed to auto-detect timezone/currency:", e?.message || e);
    }

    // 2. High-precision dynamic IP location lookup
    const detectLocation = async () => {
      setCurrency('TZS');
    };
    detectLocation();
  }, []);

  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  
  // Custom landing values state loaded from localstorage
  const [customValues, setCustomValues] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('jasper_landing_custom_values');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [sectionsOrder, setSectionsOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('jasper_landing_sections_order');
      return saved ? JSON.parse(saved) : ['landing-hero', 'about', 'features', 'marquee-partners', 'testimonials', 'pricing', 'faqs', 'contact'];
    } catch {
      return ['landing-hero', 'about', 'features', 'marquee-partners', 'testimonials', 'pricing', 'faqs', 'contact'];
    }
  });

  const [hiddenSections, setHiddenSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('jasper_landing_hidden_sections');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [customTestimonials, setCustomTestimonials] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('jasper_custom_testimonials');
      return saved ? JSON.parse(saved) : [
        {
          quote: "We were losing almost 15% of daily checkout logs because our internet went unstable at peak hours inside Mwenge food court. With Jasper's offline queue, our cashier till never stops. Incredible offline product.",
          name: "Mustafa Al-Busaidy",
          role: "Restaurant Owner • Dar es Salaam",
          initials: "MA",
          color: "emerald"
        },
        {
          quote: "Integrating generic classification drugs generic names inside Kisumu used to occupy our pharmacists for days. Then we launched Jasper—Lucy resolved everything automatically. Highly recommended!",
          name: "Dr. Kwame Osei",
          role: "Dispensary Director • Kisumu Pharmacy",
          initials: "KO",
          color: "teal"
        },
        {
          quote: "Jasper's Hotel suite PMS checked-in our room listings flawlessly. Seasonal rates surge works with zero configuration, and having direct support in Swahili inside checkout from assistant makes training receptionist very easy.",
          name: "Fatuma Mrisho",
          role: "Managing Director • Arusha Lodge",
          initials: "FM",
          color: "violet"
        }
      ];
    } catch {
      return [];
    }
  });

  const [customFaqs, setCustomFaqs] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('jasper_custom_faqs');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handleUpdate = () => {
      try {
        const savedOrder = localStorage.getItem('jasper_landing_sections_order');
        if (savedOrder) setSectionsOrder(JSON.parse(savedOrder));
        
        const savedHidden = localStorage.getItem('jasper_landing_hidden_sections');
        if (savedHidden) setHiddenSections(JSON.parse(savedHidden));
        
        const savedValues = localStorage.getItem('jasper_landing_custom_values');
        if (savedValues) setCustomValues(JSON.parse(savedValues));

        const savedTestimonials = localStorage.getItem('jasper_custom_testimonials');
        if (savedTestimonials) setCustomTestimonials(JSON.parse(savedTestimonials));

        const savedFaqs = localStorage.getItem('jasper_custom_faqs');
        if (savedFaqs) setCustomFaqs(JSON.parse(savedFaqs));
      } catch (e) {
        console.error(e);
      }
    };
    
    window.addEventListener('saas_landing_page_updated', handleUpdate);
    return () => window.removeEventListener('saas_landing_page_updated', handleUpdate);
  }, []);

  const tBase = TRANSLATIONS[lang] || TRANSLATIONS.en;
  const t = { ...tBase, ...customValues };
  
  // Custom interactive tab for the right column section of the hero
  const [activeHeroTab, setActiveHeroTab] = useState<'retail' | 'restaurant' | 'pharmacy' | 'hotel'>('retail');

  // Privacy Policy and Terms and Conditions Modals
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);

  // Accordion state tracker for collapsible FAQs
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  // Floating Lucy Chat Bubble states
  const [isLucyOpen, setIsLucyOpen] = useState(false);
  const [lucyInput, setLucyInput] = useState('');
  const [lucyMessages, setLucyMessages] = useState<Array<{ sender: 'lucy' | 'user'; text: string; time: string }>>([
    { sender: 'lucy', text: getLucyGreeting('en'), time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) }
  ]);
  const [isLucyThinking, setIsLucyThinking] = useState(false);

  // Currency factors
  const currencySymbol = currency === 'TZS' ? 'TSh' : currency === 'KES' ? 'KSh' : '₦';
  const exchangeRate = currency === 'TZS' ? 1 : currency === 'KES' ? 0.057 : 0.62;
  const formatPrice = (baseTzs: number) => {
    return Math.round(baseTzs * exchangeRate).toLocaleString();
  };

  // State log to track featured logos on home landing page dynamically from Super Admin
  const [featuredLogos, setFeaturedLogos] = useState<string[]>([]);

  useEffect(() => {
    // Read featured logos from local storage
    const savedLogos = JSON.parse(localStorage.getItem('jasper_featured_logos') || '[]');
    const defaultLogos = [
      "Bakhresa Group",
      "Kariakoo Wholesalers",
      "Kisumu Pharmacy Ltd",
      "Dar Food Court",
      "Arusha Heights Hotel",
      "Mwanza Grains"
    ];
    // Merge or fallback
    setFeaturedLogos(savedLogos.length > 0 ? [...savedLogos, ...defaultLogos] : defaultLogos);
  }, []);

  // Handle conversational Lucy responses on home page
  const handleLucySend = (e: any) => {
    e.preventDefault();
    if (!lucyInput.trim()) return;

    const userMsg = lucyInput.trim();
    const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    setLucyMessages(prev => [...prev, { sender: 'user', text: userMsg, time: timestamp }]);
    setLucyInput('');
    setIsLucyThinking(true);

    // Lucy works offline on the landing page and stores lightweight interest signals locally.
    setTimeout(() => {
      const lucy = createLucyResponse(userMsg, { surface: 'landing' });
      const lower = userMsg.toLowerCase();
      const categoryType = lower.includes('price') || lower.includes('cost') || lower.includes('subscription') || lower.includes('package')
        ? 'Subscription Interest'
        : lower.includes('hotel') || lower.includes('room') || lower.includes('pms')
          ? 'Hotel Sector Interest'
          : lower.includes('pharmacy') || lower.includes('drug') || lower.includes('medicine') || lower.includes('rx')
            ? 'Pharmacy Sector Interest'
            : lower.includes('restaurant') || lower.includes('table') || lower.includes('food') || lower.includes('kds')
              ? 'Restaurant Sector Interest'
              : lower.includes('offline') || lower.includes('internet') || lower.includes('network') || lower.includes('mtandao')
                ? 'Technical Resilience Query'
                : lucy.refused
                  ? 'Out-of-Scope Query'
                  : 'Features Walkthrough';
      const matchedNiche = lower.includes('hotel') || lower.includes('room') || lower.includes('pms')
        ? 'hotel'
        : lower.includes('pharmacy') || lower.includes('drug') || lower.includes('medicine') || lower.includes('rx')
          ? 'pharmacy'
          : lower.includes('restaurant') || lower.includes('table') || lower.includes('food') || lower.includes('kds')
            ? 'restaurant'
            : 'general';

      setLucyMessages(prev => [...prev, { sender: 'lucy', text: lucy.text, time: timestamp }]);
      setIsLucyThinking(false);

      const selfLearnings = JSON.parse(localStorage.getItem('jasper_lucy_self_learnings') || '[]');
      selfLearnings.push({
        id: 'ln-' + Math.floor(1000 + Math.random() * 9000),
        timestamp: new Date().toISOString(),
        query: userMsg,
        category: categoryType,
        insight: `Prospect queried: "${userMsg}". AI provided targeted feedback. Client seems interested in "${matchedNiche}" capability.`,
        sentiment: userMsg.length > 25 ? 'highly interested' : 'neutral',
        detectedBusinessType: matchedNiche
      });
      localStorage.setItem('jasper_lucy_self_learnings', JSON.stringify(selfLearnings));

    }, 1100);
  };

  const faqDataByLang: Record<string, Array<{ q: string, a: string }>> = {
    en: [
      {
        q: "Does Jasper work 100% offline?",
        a: "Yes, absolutely! If your internet connection or power goes down, Jasper keeps checking out customers and tracking stock locally on your device. Once the internet is restored, it automatically synchronizes and updates your cloud dashboard."
      },
      {
        q: "How do I pay after my 14-day free trial?",
        a: "At the end of your 14 days, you will receive a friendly notification in your dashboard to choose a suitable package. You can pay easily using standard local methods like M-Pesa, Airtel Money, Tigo Mixx by Yas, or Visa/Mastercard."
      },
      {
        q: "How does the multi-store consolidated bookkeeping work?",
        a: "Jasper allows you to connect multiple branches (such as Dar, Nairobi, or Arusha). Each branch can adopt its own localized currency and tax structure (like local VAT) in real-time, while consolidating all sales and stock reports under the single super owner account."
      },
      {
        q: "What are the limits on different packages?",
        a: "The essential plan permits up to 200 products and 2 users. The standard plan supports up to 1,000 products, 5 stores, and 5 users. The premium plan features unlimited products and staff across 10 active stores."
      }
    ],
    sw: [
      {
        q: "Je, inafanya kazi nikiwa nje ya mtandao (bila internet)?",
        a: "Ndiyo, kabisa! Internet au umeme ukikatika, Jasper itaendelea kufanya kazi ya mauzo na kupunguza stoki kama kawaida. Internet ikirudi, mfumo unajisawazisha wenyewe kwenye mtandao wako."
      },
      {
        q: "Ninalipia vipi baada ya majaribio ya siku 14 kupita?",
        a: "Baada ya majaribio ya bure kuisha, utapata ujumbe kwenye skrini yako ukikuongoza kuchagua kifurushi chako. Unaweza kulipa kwa M-Pesa, Airtel Money, Tigo Mixx au kadi ya benki."
      },
      {
        q: "Inasaidiaje kuunganisha maduka mengi pamoja?",
        a: "Jasper inaruhusu kuunganisha matawi tofauti (kama Dar, Arusha au Nairobi). Kila tawi linaweza kutumia sarafu na kodi yake ya VAT, huku ripoti zote za stoki na faida zikionekana pamoja kwenye akaunti ya mmiliki."
      },
      {
        q: "Kuna tofauti gani kati ya hivi vifurushi vitatu?",
        a: "Kifurushi cha essential kinaruhusu bidhaa hadi 200 na watumiaji 2. Kifurushi cha standard kinaruhusu bidhaa 1,000, maduka 5 na watumishi 5. Kifurushi cha premium hakina ukomo vya bidhaa na watumishi."
      }
    ],
    ar: [
      {
        q: "هل يعمل جاسبر 100% دون اتصال بالإنترنت؟",
        a: "نعم، بالتأكيد! إذا انقطع الاتصال بالإنترنت أو الكهرباء، يستمر جاسبر في محاسبة العملاء وتتبع المخزون محلياً على جهازك. بمجرد استعادة الإنترنت، يقوم تلقائياً بمزامنتها وتحديث لوحة التحكم السحابية."
      },
      {
        q: "كيف يمكنني الدفع بعد انتهاء التجربة المجانية لمدة 14 يوماً؟",
        a: "في نهاية الـ 14 يوماً، ستتلقى إشعاراً ودياً في لوحة التحكم الخاصة بك لاختيار الحزمة المناسبة. يمكنك الدفع بسهولة باستخدام الطرق المحلية القياسية مثل M-Pesa أو Airtel Money أو تيجو ميكس أو عبر بطاقة الفيزا/الماستركارد."
      },
      {
        q: "كيف تعمل المحاسبة الموحدة لمتاجر متعددة؟",
        a: "يسمح لك جاسبر بربط فروع متعددة (مثل دار السلام، نيروبي، أو أروشا). يمكن لكل فرع اعتماد عملته المحلية وهيكل الضرائب الخاص به (مثل ضريبة القيمة المضافة) في الوقت الفعلي، مع توحيد جميع تقارير المبيعات والمخزون تحت حساب مالك مالي واحد."
      },
      {
        q: "ما هي الحدود المفروضة على الحزم المختلفة؟",
        a: "تسمح الخطة الأساسية (Essential) بما يصل إلى 200 منتج ومميزين اثنين. تدعم الخطة القياسية (Standard) ما يصل إلى 1000 منتج و5 متاجر و5 مستخدمين. تتميز الخطة الممتازة (Premium) بمنتجات وموظفين غير محدودين عبر 10 متاجر نشطة."
      }
    ],
    fr: [
      {
        q: "Est-ce que Jasper fonctionne à 100% hors ligne ?",
        a: "Oui, absolument ! Si votre connexion Internet ou l'alimentation électrique est coupée, Jasper continue d'enregistrer les clients et de suivre les stocks localement sur votre appareil. Une fois la connexion rétablie, il synchronise et met à jour automatiquement votre tableau de bord cloud."
      },
      {
        q: "Comment puis-je payer après mon essai gratuit de 14 jours ?",
        a: "À la fin de vos 14 jours, vous recevrez une notification amicale dans votre tableau de bord pour choisir un forfait adapté. Vous pouvez payer facilement en utilisant des méthodes locales standard telles que M-Pesa, Airtel Money, Tigo Mixx ou par Visa/Mastercard."
      },
      {
        q: "Comment fonctionne la comptabilité consolidée multi-magasins ?",
        a: "Jasper vous permet de connecter plusieurs succursales (comme Dar, Nairobi ou Arusha). Chaque succursale peut adopter sa propre devise et structure fiscale locale (comme la TVA locale) en temps réel, tout en consolidant tous les rapports de vente et de stock sous un compte unique de super-propriétaire."
      },
      {
        q: "Quelles sont les limites des différents forfaits ?",
        a: "Le forfait Essential autorise jusqu'à 200 produits et 2 utilisateurs. Le forfait Standard prend en charge jusqu'à 1 000 produits, 5 magasins et 5 utilisateurs. Le forfait Premium propose des produits et du personnel illimités dans un maximum de 10 magasins actifs."
      }
    ]
  };

  const faqData = customFaqs && customFaqs.length > 0 ? customFaqs : (faqDataByLang[lang] || faqDataByLang.en);

  return (
    <div id="landing-container" className={`min-h-screen font-sans antialiased overflow-x-hidden transition-colors duration-300 selection:bg-emerald-500 ${isDark ? 'bg-slate-950 text-slate-100 selection:text-slate-950' : 'bg-slate-50 text-slate-800 selection:text-white'}`}>
      
      {/* Floating Glass Header with Updated Navigation Tabs Layout */}
      <header id="landing-header" className={`sticky top-0 z-50 backdrop-blur-md border-b transition-all duration-300 ${isDark ? 'bg-slate-950/80 border-slate-900/60' : 'bg-white/80 border-slate-200 shadow-xs'}`}>
        {/* Desktop Header Layout */}
        <div className="hidden lg:flex max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 items-center justify-between">
          
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onNavigate('/')}>
            <div className="w-10 h-10 rounded-full overflow-hidden shadow-sm flex items-center justify-center">
              <img src={t.systemLogo || "/icon.svg"} alt="Jasper Suite Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <span className={`text-xl font-bold tracking-tight focus:outline-none ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Jasper<span className="text-emerald-500 font-normal"> Suite</span>
              </span>
              <span className={`block text-[8px] tracking-widest uppercase font-mono mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>AFRICAN COMMERCE OS</span>
            </div>
          </div>
          
          {/* Exact requested Top menu arrangement with dual language adaptation */}
          <nav className={`hidden lg:flex items-center space-x-7 text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            {!hiddenSections['landing-hero'] && (
              <a href="#landing-hero" className="hover:text-emerald-500 transition-colors">
                {t.home}
              </a>
            )}
            {!hiddenSections['about'] && (
              <a href="#about" className="hover:text-emerald-500 transition-colors">
                {t.aboutUs}
              </a>
            )}
            {!hiddenSections['features'] && (
              <a href="#features" className="hover:text-emerald-500 transition-colors">
                {t.features}
              </a>
            )}
            {!hiddenSections['pricing'] && (
              <a href="#pricing" className="hover:text-emerald-500 transition-colors">
                {t.pricing}
              </a>
            )}
            {!hiddenSections['faqs'] && (
              <a href="#faqs" className="hover:text-emerald-500 transition-colors">
                FAQ
              </a>
            )}
            {!hiddenSections['contact'] && (
              <a href="#contact" className="hover:text-emerald-500 transition-colors">
                {t.contact}
              </a>
            )}
          </nav>

          <div className="flex items-center space-x-4">
            <button 
              id="header-btn-login"
              onClick={() => onNavigate('/login')}
              className={`text-[13.5px] font-bold uppercase tracking-wider transition-colors cursor-pointer px-2 flex items-center h-[28px] ${isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {t.signIn}
            </button>
            <button 
              id="header-btn-signup"
              onClick={() => onNavigate('/login?register=true')}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[12px] font-bold uppercase tracking-widest px-3 h-[28px] rounded-full transition-all shadow-lg shadow-emerald-500/10 active:scale-95 cursor-pointer flex items-center justify-center"
            >
              {t.freeTrial}
            </button>

            {/* Day / Dark Mode Toggle Switch */}
            <button
              onClick={() => onToggleTheme?.()}
              className={`w-[28px] h-[28px] rounded-lg border transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                isDark 
                  ? 'bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800' 
                  : 'bg-white border-slate-200 text-indigo-600 hover:bg-slate-100 shadow-xs'
              }`}
              title={isDark ? "Switch to Day Mode" : "Switch to Dark Mode"}
            >
              {isDark ? <Sun className="w-[14px] h-[14px]" /> : <Moon className="w-[14px] h-[14px]" />}
            </button>

            {/* Beautiful Multi-Language Dropdown displaying chosen code with a Globe Icon */}
            <div className="relative">
              <button
                id="landing-lang-btn"
                onClick={() => setShowLangMenu(!showLangMenu)}
                className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-bold border rounded-xl cursor-pointer transition-all ${
                  isDark 
                    ? 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-850' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-xs'
                }`}
                title="Select Language / Velg Pris / Badili Lugha"
              >
                <Globe className="w-4 h-4 text-emerald-500" />
                <span className="uppercase font-mono text-[10px]">{lang}</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              </button>

              {showLangMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowLangMenu(false)} />
                  <div className={`absolute right-0 mt-2 w-36 rounded-2xl border p-1 shadow-xl z-50 animate-in fade-in slide-in-from-top-3 duration-150 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                  }`}>
                    {[
                      { code: 'en', label: 'English' },
                      { code: 'sw', label: 'Swahili' },
                      { code: 'ar', label: '🇸🇦 العربية' },
                      { code: 'fr', label: '🇫🇷 Français' }
                    ].map((item) => (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => {
                          setLang(item.code as any);
                          setShowLangMenu(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs font-medium rounded-xl transition-colors cursor-pointer flex items-center justify-between ${
                          lang === item.code 
                            ? 'bg-emerald-500 text-slate-950 font-bold' 
                            : isDark ? 'hover:bg-slate-900 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <span>{item.label}</span>
                        {lang === item.code && <span className="text-[9px] uppercase font-mono px-1 py-0.5 bg-slate-950/20 text-slate-900 rounded-sm">✓</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Header Layout (single row, fixed height 56px = h-14, centered items) */}
        <div className="flex lg:hidden max-w-7xl mx-auto px-3 h-14 items-center justify-between relative">
          {/* Left: Logo and branding */}
          <div className="flex items-center space-x-2.5 cursor-pointer shrink-0" onClick={() => onNavigate('/')}>
            <div className="w-8 h-8 rounded-full overflow-hidden shadow-xs flex items-center justify-center shrink-0">
              <img src={t.systemLogo || "/icon.svg"} alt="Jasper Suite Logo" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col justify-center leading-tight">
              <span className={`text-[15px] font-bold tracking-tight leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Jasper<span className="text-emerald-500 font-normal"> Suite</span>
              </span>
              <span className={`text-[7px] tracking-widest uppercase font-mono mt-0.5 leading-none ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>AFRICAN COMMERCE OS</span>
            </div>
          </div>

          {/* Right: Actions list in exact requested sequence: Theme Toggle, SIGN IN, FREE TRIAL, Hamburger Menu */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* Theme toggle -> compact 28px visual tap target */}
            <button
              onClick={() => onToggleTheme?.()}
              className={`w-[28px] h-[28px] flex items-center justify-center rounded-lg border transition-all cursor-pointer shrink-0 ${
                isDark 
                  ? 'bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800' 
                  : 'bg-white border-slate-200 text-indigo-600 hover:bg-slate-100 shadow-xs'
              }`}
              title={isDark ? "Switch to Day Mode" : "Switch to Dark Mode"}
            >
              {isDark ? <Sun className="w-[14px] h-[14px]" /> : <Moon className="w-[14px] h-[14px]" />}
            </button>

            {/* SIGN IN text button */}
            <button 
              id="header-btn-login-mobile"
              onClick={() => onNavigate('/login')}
              className={`text-[13.5px] font-bold uppercase tracking-wider transition-colors cursor-pointer px-1 flex items-center h-[28px] ${isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {t.signIn}
            </button>

            {/* FREE TRIAL compact pill button */}
            <button 
              id="header-btn-signup-mobile"
              onClick={() => onNavigate('/login?register=true')}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[12px] font-bold uppercase tracking-wider px-3 h-[28px] rounded-full transition-all shadow-md shadow-emerald-500/10 active:scale-95 cursor-pointer shrink-0 flex items-center justify-center"
            >
              {t.freeTrial}
            </button>

            {/* Hamburger button (☰) -> Opens the language-only dropdown menu */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className={`w-[28px] h-[28px] flex items-center justify-center rounded-lg border transition-all cursor-pointer shrink-0 ${
                isDark 
                  ? 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 shadow-xs'
              }`}
              title="Select Language"
            >
              <Menu className="w-[18px] h-[18px]" />
            </button>
          </div>

          {/* Hamburger dropdown menu containing ONLY the language selector */}
          {showMobileMenu && (
            <>
              {/* Backing mask to dismiss on outer tap */}
              <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowMobileMenu(false)} />
              
              <div className={`absolute right-3 top-14 w-44 rounded-2xl border p-1 shadow-xl z-50 animate-in fade-in slide-in-from-top-3 duration-150 ${
                isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
              }`}>
                {/* Visual identifier for language menu */}
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-900 mb-1 flex items-center space-x-1.5 opacity-80">
                  <Globe className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Languages</span>
                </div>
                {[
                  { code: 'en', label: 'English' },
                  { code: 'sw', label: 'Swahili' },
                  { code: 'ar', label: '🇸🇦 العربية' },
                  { code: 'fr', label: '🇫🇷 Français' }
                ].map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => {
                      setLang(item.code as any);
                      setShowMobileMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center justify-between ${
                      lang === item.code 
                        ? 'bg-emerald-500 text-slate-950 font-bold' 
                        : isDark ? 'hover:bg-slate-900 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span>{item.label}</span>
                    {lang === item.code && <span className="text-[9px] uppercase font-mono px-1 py-0.5 bg-slate-950/20 text-slate-900 rounded-sm">✓</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </header>

      {/* Main sections container for flex reordering */}
      <div className="flex flex-col flex-1 w-full relative">

        {/* Hero Section with Interactive Niche Sector Switcher Illustration */}
        <section id="landing-hero" className={`relative pt-12 pb-24 md:py-32 overflow-hidden transition-colors duration-300 px-4 sm:px-6 lg:px-8 order-${sectionsOrder.indexOf('landing-hero') + 1} ${hiddenSections['landing-hero'] ? 'hidden' : 'block'} ${isDark ? '' : 'bg-gradient-to-br from-[#f0fdf9] to-[#f8fafc]'}`}>
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[100px]" />
          <div className="absolute top-1/2 right-10 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[120px]" />
          <div className={`absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] transition-opacity duration-300 ${isDark ? 'opacity-35' : 'opacity-10'}`} />
        </div>        <div className="max-w-4xl mx-auto text-center space-y-8 relative z-10 flex flex-col items-center">
          
          <div className={`inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full border text-[10px] font-mono tracking-wider transition-colors duration-300 ${isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15' : 'bg-[#e6faf4] text-[#007a52] border-emerald-200'}`}>
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            <span>{t.coreBadge}</span>
          </div>

          <h1 className={`text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] transition-colors duration-300 ${isDark ? 'text-white' : 'text-[#111827]'}`}>
            {t.headlinePre} <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">{t.headlinePost}</span>
          </h1>

          {/* Specifically requested copies & formatting arranged into a masterclass professional layout */}
          <div className="w-full max-w-4xl mx-auto space-y-12 pt-6">
            
            {/* Tagline Intro Block */}
            <div className="text-center">
              <p className={`text-lg sm:text-xl md:text-2xl font-medium tracking-tight leading-relaxed max-w-3xl mx-auto border-l-4 border-emerald-500 pl-4 sm:pl-6 text-left sm:text-center sm:border-l-0 transition-colors duration-300 ${isDark ? 'text-slate-100' : 'text-[#374151]'}`}>
                {t.tagline}
              </p>
            </div>

            {/* Target Sectors Badge Grid */}
            <div className="space-y-4">
              <p className="text-xs font-mono uppercase text-slate-500 tracking-widest text-center font-bold">
                {t.builtFor}
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {[
                  { label: t.retail, icon: ShoppingCart, color: isDark ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/15" : "text-[#007a52] bg-[#e6faf4] border-emerald-200" },
                  { label: t.wholesale, icon: Store, color: isDark ? "text-blue-400 bg-blue-500/10 border-blue-500/15" : "text-[#007a52] bg-[#e6faf4] border-emerald-200" },
                  { label: t.pharmacies, icon: Pill, color: isDark ? "text-rose-400 bg-rose-500/10 border-rose-500/15" : "text-rose-700 bg-rose-50 border-rose-200" },
                  { label: t.manufacturing || "Manufacturing", icon: Factory, color: isDark ? "text-amber-400 bg-amber-500/10 border-amber-500/15" : "text-amber-700 bg-amber-50 border-amber-200" }
                ].map((sec, i) => (
                  <div key={i} className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl border transition-colors duration-300 ${sec.color}`}>
                    <sec.icon className="w-4 h-4" />
                    <span>{sec.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Core Action Triplets Bento Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 font-sans">
              {[
                {
                  title: t.cashMgmt,
                  desc: t.cashDesc,
                  accent: isDark ? "border-emerald-500/10 bg-slate-900/30 hover:border-slate-800" : "border-slate-200 bg-[#eef0f3] hover:border-slate-350 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
                },
                {
                  title: t.capitalProt,
                  desc: t.capitalDesc,
                  accent: isDark ? "border-teal-500/10 bg-slate-900/30 hover:border-slate-800" : "border-slate-200 bg-[#eef0f3] hover:border-slate-350 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
                },
                {
                  title: t.stockIntel,
                  desc: t.stockDesc,
                  accent: isDark ? "border-blue-500/10 bg-slate-900/30 hover:border-slate-800" : "border-slate-200 bg-[#eef0f3] hover:border-slate-350 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
                }
              ].map((tri, i) => (
                <div key={i} className={`p-5 rounded-2xl border transition-all text-left space-y-2 shadow-xs ${tri.accent}`}>
                  <span className={`text-xs font-bold uppercase font-mono tracking-wider ${isDark ? 'text-emerald-400' : 'text-[#007a52]'}`}>{tri.title}</span>
                  <p className={`text-xs font-light leading-relaxed ${isDark ? 'text-slate-300' : 'text-[#374151]'}`}>{tri.desc}</p>
                </div>
              ))}
            </div>

            {/* Offline Resilience & AI assistant interactive panel */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
              
              {/* Box 1: Zero Friction Payments & Offline Register */}
              <div className={`p-6 rounded-3xl space-y-3 relative overflow-hidden border-2 ${isDark ? 'bg-slate-900/20 border-slate-900' : 'bg-white border-slate-200 shadow-xs'}`}>
                <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 rounded-full blur-xl" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-teal-400">Resilience System</span>
                <h4 className={`text-base font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {t.offlineTitle || "Works Without Internet"}
                </h4>
                <p className={`text-xs font-light leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {t.offlineDesc || "Runs 100% offline. Accepts mobile money instantly with no slowdowns."}
                </p>
              </div>

              {/* Box 2: Lucy Spotlight */}
              <div className={`p-6 rounded-3xl space-y-3 relative overflow-hidden border-2 ${isDark ? 'bg-slate-900/20 border-emerald-500/15' : 'bg-[#e6faf4]/20 border-emerald-500/20 shadow-xs'}`}>
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Lucy Core Assistant
                </span>
                <h4 className={`text-base font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {t.meetLucy || "Meet Lucy"}
                </h4>
                <p className={`text-xs font-light leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {t.lucyDesc || "Your friendly assistant to answer questions and help you grow daily."}
                </p>
              </div>

            </div>

            {/* Creed Signature Text */}
            <div className="text-center pt-2">
              <span className="text-lg md:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 tracking-tight block animate-pulse">
                {t.creed || "Jasper helps your business grow higher!"}
              </span>
            </div>

          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md pt-2">
            <button
              onClick={() => onNavigate('/login?register=true')}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider px-8 py-4 rounded-2xl flex items-center justify-center space-x-2 shadow-xl shadow-emerald-500/15 transition-all cursor-pointer transform active:scale-95 duration-150"
            >
              <span>{t.getStarted || "Get Started — It's Free"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Quick trust metrics */}
          <div className={`grid grid-cols-3 gap-8 pt-8 text-center w-full max-w-xl border-t ${isDark ? 'border-slate-900' : 'border-slate-200'}`}>
            <div>
              <dt className={`text-xl sm:text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t.metric1_val || "99.9%"}</dt>
              <dd className="text-[10px] text-slate-500 font-mono mt-0.5 uppercase tracking-wider">{t.offlineMetric || "Works Offline"}</dd>
            </div>
            <div>
              <dt className={`text-xl sm:text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t.metric2_val || "0.3s"}</dt>
              <dd className="text-[10px] text-slate-500 font-mono mt-0.5 uppercase tracking-wider">{t.syncMetric || "Instant Sync"}</dd>
            </div>
            <div>
              <dt className={`text-xl sm:text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t.metric3_val || "100%"}</dt>
              <dd className="text-[10px] text-slate-500 font-mono mt-0.5 uppercase tracking-wider">{t.aiMetric || "AI Assistant"}</dd>
            </div>
          </div>
        </div>
      </section>

      {/* About Us section (Requested in updated tabs list) */}
      <section id="about" className={`py-20 relative border-t px-4 sm:px-6 lg:px-8 transition-colors duration-300 order-${sectionsOrder.indexOf('about') + 1} ${hiddenSections['about'] ? 'hidden' : 'block'} ${isDark ? 'bg-slate-950 border-slate-900' : 'bg-slate-100 border-slate-200'}`}>
        <div className="max-w-4xl mx-auto space-y-8 text-center flex flex-col items-center">
          <span className="text-xs font-mono uppercase tracking-widest text-emerald-500 font-bold">{t.aboutUs || "About Us"} • ABOUT JASPER SUITE</span>
          <h2 className={`text-3xl sm:text-4xl font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t.aboutTitle || "Offline Sales Support For All Businesses"}</h2>
          <p className={`text-sm leading-relaxed font-light max-w-3xl ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            {t.aboutDesc || "We created Jasper because unstable internet should never stop your sales desk. Whether you are in Dar, Mbeya, or Nairobi, your cash drawer keeps working."}
          </p>
          <div className={`flex flex-col sm:flex-row justify-center items-center gap-6 text-xs font-mono pt-4 border-t w-full ${isDark ? 'text-slate-300 border-slate-900' : 'text-slate-600 border-slate-250'}`}>
            <div className="flex items-center space-x-2">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              <span>{t.aboutSupport || "Real support offices around East Africa"}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              <span>{t.aboutCurrency || "Automatic local tax settings"}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-1.5 h-1.5 bg-emerald-55 bg-emerald-55 bg-emerald-500 rounded-full" />
              <span>{t.aboutEndpoints || "Over 2,400 active stores registered"}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Pillar Bento Grid */}
      <section id="features" className={`py-20 border-t transition-colors duration-300 px-4 sm:px-6 lg:px-8 order-${sectionsOrder.indexOf('features') + 1} ${hiddenSections['features'] ? 'hidden' : 'block'} ${isDark ? 'bg-slate-950 border-slate-900' : 'bg-[#f4f6f8] border-slate-200'}`}>
        <div className="max-w-7xl mx-auto space-y-12 text-left">
          
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className={`text-xs font-mono uppercase tracking-widest font-bold ${isDark ? 'text-emerald-400' : 'text-[#007a52]'}`}>{t.advancedCapabilities || "Advanced Features"}</h2>
            <p className={`text-3xl sm:text-4xl font-extrabold leading-tight ${isDark ? 'text-white' : 'text-[#111827]'}`}>
              {t.advancedDesc || "Simple solutions to keep your cash registers working always."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
            
            {/* Feat 1: Offline-First Hybrid Queue */}
            <div className={`p-8 rounded-2xl relative group transition-all border ${isDark ? 'bg-slate-900/45 border-slate-850 hover:border-slate-755' : 'bg-white border-slate-200 hover:border-slate-300 shadow-[0_2px_12px_rgba(0,0,0,0.06)]'}`}>
              <div className={`p-3 w-fit rounded-xl border mb-6 group-hover:scale-110 transition-transform ${isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-[#e6faf4] text-[#007a52] border-emerald-200'}`}>
                <WifiOff className="w-6 h-6 stroke-[1.75]" />
              </div>
              <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-[#111827]'}`}>{t.featOfflineTitle || "Offline Cashier Desk"}</h3>
              <p className={`text-sm leading-relaxed font-light ${isDark ? 'text-slate-400' : 'text-[#374151]'}`}>
                {t.featOfflineDesc || "No internet or power goes out? No problem. Keep selling as normal and sync when network is restored."}
              </p>
            </div>

            {/* Feat 2: Multi-Tenant Enterprise Ledgers */}
            <div className={`p-8 rounded-2xl relative group transition-all border ${isDark ? 'bg-slate-900/45 border-slate-850 hover:border-slate-755' : 'bg-white border-slate-200 hover:border-slate-300 shadow-[0_2px_12px_rgba(0,0,0,0.06)]'}`}>
              <div className={`p-3 w-fit rounded-xl border mb-6 group-hover:scale-110 transition-transform ${isDark ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' : 'bg-teal-50 text-[#007a52] border-teal-200'}`}>
                <Layers className="w-6 h-6 stroke-[1.75]" />
              </div>
              <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-[#111827]'}`}>{t.featLedgerTitle || "Multi-Country Currency"}</h3>
              <p className={`text-sm leading-relaxed font-light ${isDark ? 'text-slate-400' : 'text-[#374151]'}`}>
                {t.featLedgerDesc || "Supports TZS, KES, and NGN currencies with local tax rates easily."}
              </p>
            </div>

            {/* Feat 3: Embed payments */}
            <div className={`p-8 rounded-2xl relative group transition-all border ${isDark ? 'bg-slate-900/45 border-slate-850 hover:border-slate-755' : 'bg-white border-slate-200 hover:border-slate-300 shadow-[0_2px_12px_rgba(0,0,0,0.06)]'}`}>
              <div className={`p-3 w-fit rounded-xl border mb-6 group-hover:scale-110 transition-transform ${isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                <Globe className="w-6 h-6 stroke-[1.75]" />
              </div>
              <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-[#111827]'}`}>{t.featGatewayTitle || "Mobile Money Check"}</h3>
              <p className={`text-sm leading-relaxed font-light ${isDark ? 'text-slate-400' : 'text-[#374151]'}`}>
                {t.featGatewayDesc || "Invoices connect directly with M-Pesa, Tigo, and Airtel Money to verify transactions quickly."}
              </p>
            </div>
            
            {/* Feat 4: SmartSoko */}
            <div className={`p-8 rounded-2xl relative group transition-all border ${isDark ? 'bg-slate-900/45 border-slate-850 hover:border-slate-755' : 'bg-white border-slate-200 hover:border-slate-300 shadow-[0_2px_12px_rgba(0,0,0,0.06)]'}`}>
              <div className={`p-3 w-fit rounded-xl border mb-6 group-hover:scale-110 transition-transform ${isDark ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                <Factory className="w-6 h-6 stroke-[1.75]" />
              </div>
              <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-[#111827]'}`}>{t.featSmartSokoTitle || "SmartSoko Production"}</h3>
              <p className={`text-sm leading-relaxed font-light ${isDark ? 'text-slate-400' : 'text-[#374151]'}`}>
                {t.featSmartSokoDesc || "Manage raw materials, production batches, and yield efficiency with live unit cost tracking."}
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Moving / Infinite scrolling Marquee Band on Trusted Businesses with sleek, small partner logos (Just Logos) */}
      <section id="marquee-partners" className={`py-12 border-t border-b overflow-hidden relative transition-colors duration-300 order-${sectionsOrder.indexOf('marquee-partners') + 1} ${hiddenSections['marquee-partners'] ? 'hidden' : 'block'} ${isDark ? 'bg-slate-950 border-slate-900' : 'bg-white border-slate-200'}`}>
        <div className={`absolute inset-y-0 left-0 w-24 z-10 pointer-events-none bg-gradient-to-r ${isDark ? 'from-slate-950 to-transparent' : 'from-white to-transparent'}`} />
        <div className={`absolute inset-y-0 right-0 w-24 z-10 pointer-events-none bg-gradient-to-l ${isDark ? 'from-slate-950 to-transparent' : 'from-white to-transparent'}`} />
        
        <div className="max-w-7xl mx-auto px-4 text-center mb-8">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block font-bold">
            {t.trustedBy}
          </span>
        </div>

        {/* Scroll Track container with dynamic small logos, just the visual logos, no names */}
        <div className="flex items-center space-x-8 animate-marquee whitespace-nowrap py-2">
          {featuredLogos.map((logo, idx) => {
            let LogoIcon = Store;
            if (logo.includes('Bakhresa')) LogoIcon = Building2;
            else if (logo.includes('Kariakoo')) LogoIcon = ShoppingCart;
            else if (logo.includes('Pharmacy')) LogoIcon = Pill;
            else if (logo.includes('Food')) LogoIcon = UtensilsCrossed;
            else if (logo.includes('Hotel')) LogoIcon = Hotel;

            return (
              <div 
                key={idx} 
                className={`inline-flex items-center justify-center w-28 h-14 rounded-xl shadow-inner transition-all shrink-0 select-none border ${isDark ? 'bg-slate-900/30 border-slate-850/80 hover:border-emerald-505/20' : 'bg-slate-50 border-slate-100'}`}
              >
                <LogoIcon className="w-5 h-5 mr-1.5 text-slate-400" />
                <span className="text-[10px] font-bold">{logo}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* SaaS Pricing Matrices Block */}
      <section id="pricing" className={`py-20 border-t transition-colors duration-300 px-4 sm:px-6 lg:px-8 order-${sectionsOrder.indexOf('pricing') + 1} ${hiddenSections['pricing'] ? 'hidden' : 'block'} ${isDark ? 'bg-slate-950 border-slate-900' : 'bg-white border-slate-200'}`}>
        <div className="max-w-7xl mx-auto space-y-12">
          
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className={`text-xs font-mono uppercase tracking-widest font-bold ${isDark ? 'text-emerald-400' : 'text-[#007a52]'}`}>
              {t.pricingHeader || "Flexible SaaS Subscriptions"}
            </h2>
            <p className={`text-3xl sm:text-4xl font-extrabold leading-tight ${isDark ? 'text-white' : 'text-[#111827]'}`}>
              {t.pricingSub || "No hidden overheads, cancel anytime"}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Tier 2: essential (15,000 TSh) */}
            <div className={`p-6 rounded-2xl flex flex-col justify-between space-y-6 transition-all border ${isDark ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300 shadow-[0_2px_12px_rgba(0,0,0,0.06)]'}`}>
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className={`text-[8px] font-mono uppercase border px-1.5 py-0.2 rounded font-bold ${isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-[#e6faf4] text-[#007a52] border-emerald-250'}`}>Standard</span>
                  <h4 className={`text-base font-bold lowercase ${isDark ? 'text-white' : 'text-[#111827]'}`}>{t.essentialName || "essential"}</h4>
                  <p className={`text-[11px] leading-relaxed font-light ${isDark ? 'text-slate-400' : 'text-[#374151]'}`}>{t.essentialDesc || "Ideal for single-tills shops ready to log catalog lists and track expiries."}</p>
                </div>
                <div className="flex items-baseline space-x-1">
                  <span className={`text-xl font-bold ${isDark ? 'text-white' : 'text-[#111827]'}`}>{currencySymbol}</span>
                  <span className={`text-3xl font-extrabold ${isDark ? 'text-white' : 'text-[#111827]'}`}>{formatPrice(Number(t.priceEssential || 15000))}</span>
                  <span className="text-[10px] text-slate-500">/month</span>
                </div>
                <ul className={`space-y-2 text-xs border-t pt-3 ${isDark ? 'text-slate-300 border-slate-850/60' : 'text-[#374151] border-slate-100'}`}>
                  <li className="flex items-center space-x-2">
                    <span className={`p-0.5 rounded ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[#e6faf4] text-[#007a52]'}`}><Check className="w-3 h-3" /></span>
                    <span>Max {t.limitEssential_Products ? <strong>{t.limitEssential_Products}</strong> : <><strong>200 Products</strong></>}</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className={`p-0.5 rounded ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[#e6faf4] text-[#007a52]'}`}><Check className="w-3 h-3" /></span>
                    <span>Max {t.limitEssential_Stores ? <strong>{t.limitEssential_Stores}</strong> : <><strong>1 Active Store</strong></>}</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className={`p-0.5 rounded ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[#e6faf4] text-[#007a52]'}`}><Check className="w-3 h-3" /></span>
                    <span>Max {t.limitEssential_Users ? <strong>{t.limitEssential_Users}</strong> : <><strong>2 Users/Staff</strong></>}</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className={`p-0.5 rounded ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[#e6faf4] text-[#007a52]'}`}><Check className="w-3 h-3" /></span>
                    <span>{t.featureEssential_ledger || "Supplies journal ledger"}</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className={`p-0.5 rounded ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[#e6faf4] text-[#007a52]'}`}><Check className="w-3 h-3" /></span>
                    <span>{t.featureEssential_sync || "Mobile Money synchronizer"}</span>
                  </li>
                </ul>
              </div>
              <button 
                onClick={() => onNavigate('/login?register=true')}
                className={`w-full py-2.5 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer ${isDark ? 'bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30' : 'bg-[#e6faf4] hover:bg-emerald-100/50 text-[#007a52] border border-emerald-200'}`}
              >
                Choose {t.essentialName || "essential"}
              </button>
            </div>

            {/* Tier 3: Standard Business (30,000 TSh) - Featured */}
            <div className={`rounded-2xl flex flex-col justify-between space-y-6 relative hover:border-emerald-400 transition-all border-2 ${isDark ? 'bg-slate-900 border-emerald-500 shadow-lg shadow-emerald-500/5' : 'bg-[#eef0f3] border-[#00b87a] shadow-[0_4px_20px_rgba(0,184,122,0.08)]'}`}>
              <div className={`absolute top-0 right-6 -translate-y-1/2 px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider ${isDark ? 'bg-emerald-500 text-slate-950' : 'bg-[#00b87a] text-white'}`}>
                Recommended
              </div>
              
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <span className={`text-[8px] font-mono uppercase border px-1.5 py-0.2 rounded font-bold ${isDark ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-[#e6faf4] text-[#007a52] border-emerald-250'}`}>Multi Tenant</span>
                  <h4 className={`text-base font-bold flex items-center space-x-1.5 lowercase ${isDark ? 'text-white' : 'text-[#111827]'}`}>
                    <span>{t.standardName || "standard"}</span>
                    <Sparkles className={`w-3.5 h-3.5 ${isDark ? 'text-emerald-400' : 'text-[#00b87a]'}`} />
                  </h4>
                  <p className={`text-[11px] leading-relaxed font-light ${isDark ? 'text-slate-355 text-slate-300' : 'text-[#374151]'}`}>{t.standardDesc || "Comprehensive setup designed for multi-branch hotels, food courts or pharmacies."}</p>
                </div>
                
                <div className="flex items-baseline space-x-1">
                  <span className={`text-xl font-bold ${isDark ? 'text-emerald-400' : 'text-[#007a52]'}`}>{currencySymbol}</span>
                  <span className={`text-3xl font-extrabold ${isDark ? 'text-emerald-400' : 'text-[#007a52]'}`}>{formatPrice(Number(t.priceStandard || 30000))}</span>
                  <span className="text-[10px] text-slate-500">/month</span>
                </div>
                
                <ul className={`space-y-2 text-xs border-t pt-3 ${isDark ? 'text-slate-300 border-slate-850' : 'text-[#374151] border-slate-200'}`}>
                  <li className="flex items-center space-x-2">
                    <span className={`p-0.5 rounded ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[#e6faf4] text-[#007a52]'}`}><Check className="w-3 h-3" /></span>
                    <span>Max {t.limitStandard_Products ? <strong>{t.limitStandard_Products}</strong> : <><strong>1,000 Products</strong></>}</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className={`p-0.5 rounded ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[#e6faf4] text-[#007a52]'}`}><Check className="w-3 h-3" /></span>
                    <span>Max {t.limitStandard_Stores ? <strong>{t.limitStandard_Stores}</strong> : <><strong>5 Active Stores</strong></>}</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className={`p-0.5 rounded ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[#e6faf4] text-[#007a52]'}`}><Check className="w-3 h-3" /></span>
                    <span>Max {t.limitStandard_Users ? <strong>{t.limitStandard_Users}</strong> : <><strong>5 Users/Staff</strong></>}</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className={`p-0.5 rounded ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[#e6faf4] text-[#007a52]'}`}><Check className="w-3 h-3" /></span>
                    <span>{t.featureStandard_rooms || "Suite Niche Custom PMS Rooms"}</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className={`p-0.5 rounded ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[#e6faf4] text-[#007a52]'}`}><Check className="w-3 h-3" /></span>
                    <span>{t.featureStandard_lucy || "Lucy Self-learning assistance"}</span>
                  </li>
                </ul>
              </div>

              <div className="px-6 pb-6">
                <button 
                  onClick={() => onNavigate('/login?register=true')}
                  className={`w-full py-2.5 font-black text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-md ${isDark ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/10' : 'bg-[#00b87a] hover:bg-[#009966] text-white shadow-[#00b87a]/15'}`}
                >
                  Choose {t.standardName || "standard"}
                </button>
              </div>
            </div>

            {/* Tier 4: premium (45,000 TSh) */}
            <div className={`p-6 rounded-2xl flex flex-col justify-between space-y-6 transition-all border ${isDark ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300 shadow-[0_2px_12px_rgba(0,0,0,0.06)]'}`}>
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className={`text-[8px] font-mono uppercase bg-emerald-500/10 border px-1.5 py-0.2 rounded font-bold ${isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-[#e6faf4] text-[#007a52] border-emerald-250'}`}>Uncapped</span>
                  <h4 className={`text-base font-bold lowercase ${isDark ? 'text-white' : 'text-[#111827]'}`}>{t.premiumName || "premium"}</h4>
                  <p className={`text-[11px] leading-relaxed font-light ${isDark ? 'text-slate-400' : 'text-[#374151]'}`}>{t.premiumDesc || "Full-scale accounting ledger for warehouses distribution networks."}</p>
                </div>
                <div className="flex items-baseline space-x-1">
                  <span className={`text-xl font-bold ${isDark ? 'text-white' : 'text-[#111827]'}`}>{currencySymbol}</span>
                  <span className={`text-3xl font-extrabold ${isDark ? 'text-white' : 'text-[#111827]'}`}>{formatPrice(Number(t.pricePremium || 45000))}</span>
                  <span className="text-[10px] text-slate-500">/month</span>
                </div>
                <ul className={`space-y-2 text-xs border-t pt-3 ${isDark ? 'text-slate-350 border-slate-850/60' : 'text-[#374151] border-slate-100'}`}>
                  <li className="flex items-center space-x-2">
                    <span className={`p-0.5 rounded ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[#e6faf4] text-[#007a52]'}`}><Check className="w-3 h-3" /></span>
                    <span>{t.limitPremium_Products ? <strong>{t.limitPremium_Products}</strong> : <><strong>Volume Unlimited Products</strong></>}</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className={`p-0.5 rounded ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[#e6faf4] text-[#007a52]'}`}><Check className="w-3 h-3" /></span>
                    <span>Max {t.limitPremium_Stores ? <strong>{t.limitPremium_Stores}</strong> : <><strong>10 Active Stores</strong></>}</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className={`p-0.5 rounded ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[#e6faf4] text-[#007a52]'}`}><Check className="w-3 h-3" /></span>
                    <span>{t.limitPremium_Users ? <strong>{t.limitPremium_Users}</strong> : <><strong>Volume Unlimited Staff</strong></>}</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className={`p-0.5 rounded ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[#e6faf4] text-[#007a52]'}`}><Check className="w-3 h-3" /></span>
                    <span>{t.featurePremium_whiteLabel || "VIP White-label custom domains"}</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className={`p-0.5 rounded ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[#e6faf4] text-[#007a52]'}`}><Check className="w-3 h-3" /></span>
                    <span>{t.featurePremium_dedicated || "Dedicated priority servers nodes"}</span>
                  </li>
                </ul>
              </div>
              <button 
                onClick={() => onNavigate('/login?register=true')}
                className={`w-full py-2.5 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer ${isDark ? 'bg-slate-800 hover:bg-slate-755 text-white' : 'bg-[#eef0f3] hover:bg-slate-200 text-[#111827]'}`}
              >
                Choose {t.premiumName || "premium"}
              </button>
            </div>

          </div>
        </div>
      </section>

       {/* Frequently Asked Questions (FAQs) Accordion Section (Requested) */}
      <section id="faqs" className={`py-20 border-t transition-colors duration-300 px-4 sm:px-6 lg:px-8 order-${sectionsOrder.indexOf('faqs') + 1} ${hiddenSections['faqs'] ? 'hidden' : 'block'} ${isDark ? 'bg-slate-950 border-slate-900' : 'bg-white border-slate-200'}`}>
        <div className="max-w-4xl mx-auto space-y-12 text-left">
          
          <div className="text-center space-y-3">
            <h2 className={`text-xs font-mono uppercase tracking-widest font-bold ${isDark ? 'text-emerald-400' : 'text-[#007a52]'}`}>FAQ</h2>
            <p className={`text-3xl font-extrabold ${isDark ? 'text-white' : 'text-[#111827]'}`}>{t.faqTitle}</p>
          </div>

          <div className="space-y-4">
            {faqData.map((faq, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <div 
                  key={idx}
                  className={`border rounded-2xl overflow-hidden transition-all duration-300 ${isDark ? 'bg-slate-900 border-slate-850' : 'bg-[#eef0f3] border-slate-200 shadow-xs'}`}
                >
                  <button
                    onClick={() => setActiveFaq(isOpen ? null : idx)}
                    className={`w-full p-5 flex justify-between items-center text-left text-sm font-bold uppercase tracking-tight focus:outline-none cursor-pointer ${isDark ? 'text-white' : 'text-[#111827]'}`}
                  >
                    <span>{faq.q}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-305 duration-300 ${isDark ? 'text-emerald-400' : 'text-[#007a52]'} ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {isOpen && (
                    <div className={`px-5 pb-5 pt-1 text-xs leading-relaxed font-light border-t font-mono animate-fade-in ${isDark ? 'text-slate-350 border-slate-850/40 bg-slate-950/20' : 'text-[#374151] border-slate-200 bg-white'}`}>
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Collapsible FAQ Help desk Call-to-action */}
          <div className={`border p-6 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-left ${isDark ? 'bg-slate-900 border-slate-850' : 'bg-[#eef0f3] border-slate-205 border-slate-220 border-slate-200 shadow-xs'}`}>
            <div className="space-y-1">
              <h5 className={`text-xs font-bold uppercase tracking-tight ${isDark ? 'text-white' : 'text-[#111827]'}`}>Kama hujaona swali lako katika maswali ya kawaida...</h5>
              <p className={`text-[11px] font-light ${isDark ? 'text-slate-400' : 'text-[#6b7280]'}`}>Ask Lucy. Swahili supported.</p>
            </div>
            
            <button
              onClick={() => setIsLucyOpen(true)}
              className={`font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl cursor-pointer ${isDark ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950' : 'bg-[#00b87a] hover:bg-[#009966] text-white shadow-[#00b87a]/15 shadow-md'}`}
            >
              Ask Lucy
            </button>
          </div>

        </div>
      </section>

      {/* Contact Section (Requested) – Form and Headquarters labels completely removed */}
      <section id="contact" className={`py-20 border-t transition-colors duration-300 px-4 sm:px-6 lg:px-8 order-${sectionsOrder.indexOf('contact') + 1} ${hiddenSections['contact'] ? 'hidden' : 'block'} ${isDark ? 'bg-slate-950 border-slate-900' : 'bg-[#f4f6f8] border-slate-200'}`}>
        <div className="max-w-4xl mx-auto space-y-12 text-center">
          
          <div className="text-center space-y-3">
            <h2 className={`text-xs font-mono uppercase tracking-widest font-bold ${isDark ? 'text-emerald-400' : 'text-[#007a52]'}`}>{t.getInTouch || "Get In Touch"}</h2>
            <p className={`text-3xl font-extrabold ${isDark ? 'text-white' : 'text-[#111827]'}`}>{t.directAssistance || "Direct Assistance & On-Site Deployments"}</p>
            <p className={`text-sm leading-relaxed max-w-2xl mx-auto font-light ${isDark ? 'text-slate-400' : 'text-[#6b7280]'}`}>
              {t.contactDesc || "Need on-site installation, hardware mapping, or personalized training? Contact our local regional agents immediately to deploy an deployment installer to your desk."}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-6 pt-4 max-w-2xl mx-auto">
            <a 
              href={customValues.contactPhone ? `tel:${customValues.contactPhone}` : "tel:+255754002991"} 
              className={`w-full sm:w-auto flex items-center justify-center space-x-3 font-bold text-sm uppercase tracking-wider px-8 py-4 rounded-2xl transition-all cursor-pointer shadow-lg ${isDark ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/10' : 'bg-[#00b87a] hover:bg-[#009966] text-white shadow-[#00b87a]/15'}`}
            >
              <Phone className={`w-5 h-5 ${isDark ? 'fill-slate-950' : 'fill-white'}`} />
              <span>{customValues.contactPhoneLabel || t.callLocalAgent || "Call Local Agent"}</span>
            </a>
            <a 
              href={customValues.contactEmail ? `mailto:${customValues.contactEmail}` : "mailto:deployments@jasper.africa"} 
              className={`w-full sm:w-auto flex items-center justify-center space-x-3 border font-bold text-sm uppercase tracking-wider px-8 py-4 rounded-2xl transition-all cursor-pointer ${isDark ? 'bg-slate-900 hover:bg-slate-800 text-white border-slate-800 hover:border-slate-755' : 'bg-white hover:bg-slate-50 text-[#111827] border-slate-200'}`}
            >
              <Mail className={`w-5 h-5 ${isDark ? 'text-emerald-400' : 'text-[#00b87a]'}`} />
              <span>{customValues.contactEmailLabel || t.contactDeployments || "Contact Deployments"}</span>
            </a>
          </div>

        </div>
      </section>

      </div>

      {/* FLOATING LUCY CHAT BUBBLE ASSISTANT (Requested) */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        {isLucyOpen ? (
          <div className={`w-[340px] h-[460px] border rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-fade-in font-sans text-left transition-colors duration-300 ${isDark ? 'bg-slate-900 border-emerald-500/60' : 'bg-white border-slate-200'}`}>
            {/* Header */}
            <div className={`px-4 py-3 flex items-center justify-between border-b ${isDark ? 'bg-slate-950 border-slate-800/80' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full animate-pulse ${isDark ? 'bg-emerald-400' : 'bg-emerald-600'}`} />
                <div>
                  <h4 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-[#111827]'}`}>Lucy self-learning assistant</h4>
                  <span className={`text-[8.5px] font-mono block ${isDark ? 'text-emerald-400' : 'text-[#007a52]'}`}>Swahili & English Prewired</span>
                </div>
              </div>
              <button 
                onClick={() => setIsLucyOpen(false)}
                className={`p-1 cursor-pointer transition-colors ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-805 hover:text-slate-900'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Message window */}
            <div className={`flex-1 p-4 overflow-y-auto space-y-3.5 scrollbar-thin ${isDark ? 'bg-slate-950/40' : 'bg-slate-50'}`}>
              {lucyMessages.map((msg, idx) => (
                <div 
                  key={idx}
                  className={`flex flex-col space-y-1 ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className={`p-3 rounded-2xl text-xs leading-relaxed max-w-[85%] ${
                    msg.sender === 'user' 
                      ? isDark ? 'bg-emerald-500 text-slate-950 font-medium rounded-tr-none' : 'bg-[#00b87a] text-white font-medium rounded-tr-none shadow-sm'
                      : isDark ? 'bg-slate-850 text-slate-100 rounded-tl-none border border-slate-800' : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none shadow-xs'
                  }`}>
                    {msg.text}
                  </div>
                  <span className="text-[8.5px] text-slate-500 font-mono">{msg.time}</span>
                </div>
              ))}
              {isLucyThinking && (
                <div className={`flex items-center space-x-1.5 p-2 border rounded-lg text-[10.5px] font-mono w-40 ${isDark ? 'bg-slate-900 border-slate-850 text-slate-400' : 'bg-white border-slate-200 text-slate-600'}`}>
                  <RefreshCw className={`w-3 h-3 animate-spin ${isDark ? 'text-emerald-400' : 'text-[#00b87a]'}`} />
                  <span>Lucy in Swahili context...</span>
                </div>
              )}
            </div>

            {/* Quick Suggestions buttons inside Lucy Floating widget */}
            <div className={`p-2 border-t flex flex-wrap gap-1 ${isDark ? 'bg-slate-950 border-slate-850' : 'bg-slate-50 border-slate-150'}`}>
              <button 
                onClick={() => { setLucyInput("Nahitaji kujua vifurushi na bei zao"); }}
                className={`px-2 py-1 border text-[9px] rounded font-mono cursor-pointer transition-colors ${isDark ? 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-300' : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-600'}`}
              >
                💵 Vifurushi & Bei
              </button>
              <button 
                onClick={() => { setLucyInput("Je, inafanya kazi hotelini?"); }}
                className={`px-2 py-1 border text-[9px] rounded font-mono cursor-pointer transition-colors ${isDark ? 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-300' : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-600'}`}
              >
                🏨 Hotel & PMS
              </button>
              <button 
                onClick={() => { setLucyInput("Ni kwa jinsi gani inasaidia pharmacy?"); }}
                className={`px-2 py-1 border text-[9px] rounded font-mono cursor-pointer transition-colors ${isDark ? 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-300' : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-600'}`}
              >
                💊 Duka la Dawa
              </button>
            </div>

            {/* Chat form fields */}
            <form onSubmit={handleLucySend} className={`p-3 border-t flex items-center space-x-2 ${isDark ? 'bg-slate-950 border-slate-850/80' : 'bg-slate-50 border-slate-200'}`}>
              <input
                type="text"
                placeholder="Uliza chochote kuhusu Jasper..."
                value={lucyInput}
                onChange={(e) => setLucyInput(e.target.value)}
                className={`flex-1 border rounded-xl p-2.5 text-xs placeholder-slate-500 outline-none font-medium ${isDark ? 'bg-slate-900 border-slate-800 text-white focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-850 focus:border-[#00b87a]'}`}
              />
              <button 
                type="submit"
                className={`p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0 ${isDark ? 'bg-emerald-500 hover:bg-emerald-450 text-slate-950' : 'bg-[#00b87a] hover:bg-[#009966] text-white'}`}
              >
                <SendHorizontal className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          <button
            onClick={() => setIsLucyOpen(true)}
            className={`flex items-center space-x-2 px-4 py-3.5 rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer ${isDark ? 'bg-emerald-500 hover:bg-emerald-450 text-slate-950' : 'bg-[#00b87a] hover:bg-[#009966] text-white shadow-[#00b87a]/15'}`}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider font-mono">Talk to Lucy</span>
          </button>
        )}
      </div>

      {/* Organized Footer Links Section - exact requested formatting */}
      <footer className={`border-t text-left font-sans py-16 transition-colors duration-300 px-4 sm:px-6 lg:px-8 ${isDark ? 'bg-slate-950 border-slate-900' : 'bg-white border-slate-200'}`}>
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
          
          {/* Address details first */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <img src={t.systemLogo || "/icon.svg"} alt="Jasper Suite Logo" className="w-6 h-6 rounded-full overflow-hidden object-cover" />
              <span className={`text-base font-bold ${isDark ? 'text-white' : 'text-[#111827]'}`}>Jasper <span className="text-emerald-450 text-emerald-505 text-emerald-500 font-normal">Suite</span></span>
            </div>
            
            <p className={`text-xs font-light leading-relaxed ${isDark ? 'text-slate-400' : 'text-[#374151]'}`}>
              Jasper Business Suite
            </p>
            
            <p className={`text-[10.5px] font-mono ${isDark ? 'text-slate-500' : 'text-[#6b7280]'}`}>
              deployments@jasper.africa
            </p>
          </div>

          {/* Column 1 Links: Home, FAQs, Privacy Policy, Terms and Conditions, Contact Support */}
          <div className="space-y-2 text-xs">
            <h5 className={`font-mono text-[10px] uppercase font-bold tracking-wider ${isDark ? 'text-slate-400' : 'text-[#111827]'}`}>{t.footerCol1Title || "Company Suite"}</h5>
            <ul className={`space-y-2 ${isDark ? 'text-slate-400' : 'text-[#374151]'}`}>
              <li><a href="#landing-hero" className={`transition-colors ${isDark ? 'hover:text-emerald-400' : 'hover:text-[#00b87a]'}`}>{t.footerHome || "Home Page"}</a></li>
              <li><a href="#faqs" className={`transition-colors ${isDark ? 'hover:text-emerald-400' : 'hover:text-[#00b87a]'}`}>{t.footerFaq || "FAQ"}</a></li>
              <li><span className={`transition-colors cursor-pointer ${isDark ? 'hover:text-emerald-400' : 'hover:text-[#00b87a]'}`} onClick={() => setIsPrivacyOpen(true)}>{t.footerPrivacy || "Privacy Policy"}</span></li>
              <li><span className={`transition-colors cursor-pointer ${isDark ? 'hover:text-emerald-400' : 'hover:text-[#00b87a]'}`} onClick={() => setIsTermsOpen(true)}>{t.footerTerms || "Terms and Conditions"}</span></li>
              <li><a href="#contact" className={`transition-colors ${isDark ? 'hover:text-emerald-400' : 'hover:text-[#00b87a]'}`}>{t.footerContact || "Contact Support"}</a></li>
            </ul>
          </div>

          {/* Column 2 Links: Affiliates ONLY */}
          <div className="space-y-2 text-xs">
            <h5 className={`font-mono text-[10px] uppercase font-bold tracking-wider ${isDark ? 'text-slate-400' : 'text-[#111827]'}`}>{t.footerCol2Title || "Affiliates"}</h5>
            <ul className={`space-y-2 ${isDark ? 'text-slate-400' : 'text-[#374151]'}`}>
              <li>
                <button
                  onClick={() => onNavigate('/affiliate?role=affiliate&mode=register')}
                  className={`transition-colors bg-transparent border-none p-0 outline-none cursor-pointer text-left font-sans text-xs ${isDark ? 'text-slate-400 hover:text-emerald-400' : 'text-[#374151] hover:text-[#00b87a]'}`}
                >
                  {t.footerJoinAffiliate || "Join Affiliate Program"}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/affiliate?role=affiliate&mode=login')}
                  className={`transition-colors bg-transparent border-none p-0 outline-none cursor-pointer text-left font-sans text-xs ${isDark ? 'text-slate-400 hover:text-emerald-400' : 'text-[#374151] hover:text-[#00b87a]'}`}
                >
                  {t.footerAffiliateLogin || "Affiliate Log In"}
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3 Links: Becoming a Partner ONLY */}
          <div className="space-y-2 text-xs">
            <h5 className={`font-mono text-[10px] uppercase font-bold tracking-wider ${isDark ? 'text-slate-400' : 'text-[#111827]'}`}>{t.footerCol3Title || "Becoming a Partner"}</h5>
            <ul className={`space-y-2 ${isDark ? 'text-slate-400' : 'text-[#374151]'}`}>
              <li>
                <button
                  onClick={() => onNavigate('/affiliate?role=partner&mode=register')}
                  className={`transition-colors bg-transparent border-none p-0 outline-none cursor-pointer text-left font-sans text-xs ${isDark ? 'text-slate-400 hover:text-emerald-400' : 'text-[#374151] hover:text-[#00b87a]'}`}
                >
                  {t.footerBecomePartner || "Become a Partner"}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/affiliate?role=partner&mode=login')}
                  className={`transition-colors bg-transparent border-none p-0 outline-none cursor-pointer text-left font-sans text-xs ${isDark ? 'text-slate-400 hover:text-emerald-400' : 'text-[#374151] hover:text-[#00b87a]'}`}
                >
                  {t.footerPartnerLogin || "Partner Log In"}
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3 Links: Social Icons */}
          <div className="space-y-3 text-xs">
            <h5 className={`font-mono text-[10px] uppercase font-bold tracking-wider ${isDark ? 'text-slate-400' : 'text-[#111827]'}`}>{t.footerCol4Title || "Follow Us"}</h5>
            <div className="flex flex-wrap gap-2.5">
              <a href={t.socialYoutube || "https://youtube.com"} target="_blank" rel="noreferrer" className={`p-2.5 border rounded-xl cursor-pointer transition-colors flex items-center justify-center ${isDark ? 'bg-slate-900 hover:bg-slate-800 border-slate-850 text-rose-450 hover:text-rose-400' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-rose-600'}`}>
                <Youtube className="w-5 h-5" />
              </a>
              <a href={t.socialInstagram || "https://instagram.com"} target="_blank" rel="noreferrer" className={`p-2.5 border rounded-xl cursor-pointer transition-colors flex items-center justify-center ${isDark ? 'bg-slate-900 hover:bg-slate-800 border-slate-850 text-pink-450 hover:text-pink-400' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-pink-600'}`}>
                <Instagram className="w-5 h-5" />
              </a>
              <a href={t.socialTiktok || "https://tiktok.com"} target="_blank" rel="noreferrer" className={`p-2.5 border rounded-xl cursor-pointer transition-colors flex items-center justify-center ${isDark ? 'bg-slate-900 hover:bg-slate-800 border-slate-850 text-slate-300 hover:text-white' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 hover:text-black'}`}>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                </svg>
              </a>
              <a href={t.socialFacebook || "https://facebook.com"} target="_blank" rel="noreferrer" className={`p-2.5 border rounded-xl cursor-pointer transition-colors flex items-center justify-center ${isDark ? 'bg-slate-900 hover:bg-slate-800 border-slate-850 text-blue-450 hover:text-blue-400' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-blue-600'}`}>
                <Facebook className="w-5 h-5" />
              </a>
            </div>
          </div>

        </div>

        {/* Footer legalities */}
        <div className={`max-w-7xl mx-auto mt-12 pt-6 border-t text-center text-[10px] font-sans flex flex-col sm:flex-row justify-between gap-4 ${isDark ? 'border-slate-900 text-slate-600' : 'border-slate-200 text-[#6b7280]'}`}>
          <p>{t.footerCopyright || "© 2026 Jasper Business Suite Network. All rights reserved."}</p>
        </div>
      </footer>

      <PrivacyAndTermsModals 
        isOpen={isPrivacyOpen} 
        type="privacy" 
        onClose={() => setIsPrivacyOpen(false)} 
        isDark={isDark} 
      />

      <PrivacyAndTermsModals 
        isOpen={isTermsOpen} 
        type="terms" 
        onClose={() => setIsTermsOpen(false)} 
        isDark={isDark} 
      />
    </div>
  );
}
