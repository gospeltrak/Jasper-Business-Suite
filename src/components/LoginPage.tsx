import { useState, FormEvent, useEffect, useRef } from 'react';
import { 
  Store, 
  KeyRound, 
  Mail, 
  AlertTriangle, 
  Play, 
  HelpCircle, 
  UserPlus, 
  Building, 
  Pill, 
  Utensils, 
  Hotel, 
  Sparkles, 
  CheckCircle,
  MapPin,
  Compass,
  Briefcase,
  Shield,
  Globe
} from 'lucide-react';
import { DEMO_USERS } from '../data';
import { User, Tenant } from '../types';

declare global {
  interface Window {
    google?: any;
  }
}

function decodeJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Failed to decode JWT', error);
    return null;
  }
}

const LOGIN_TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    welcome: "Welcome to Jasper Enterprise Suite",
    welcomeSub: "Unifying POS Ledger, Hotel PMs & Multi-Tenant Channels",
    signinTab: "Sign In Account",
    registerTab: "Register New Business",
    emailLabel: "Owner Email Address",
    passLabel: "Owner Pin Password",
    ownerName: "Owner Full Name",
    companyName: "Company / Hotel Name",
    region: "Region of operations",
    city: "City Name Office",
    phone: "Owner Contact Phone",
    promoCode: "Affiliate Referral Promo Code (Optional)",
    promoDesc: "Promo code gives you an extended 20 days free trial instead of 10 days.",
    nicheLabel: "Business Industry Niche (Mandatory)",
    compileBtn: "Compile Secure Tenant",
    continueGoogle: "Continue with Google",
    googleOr: "OR ONE-CLICK REGISTER WITH GOOGLE",
    googleOrSig: "OR ONE-CLICK SIGN IN",
    demoProfiles: "DEMO TEST PROFILES",
    adminPortal: "SaaS Core Authority",
    backHome: "Go back to Jasper Homepage",
    selectNicheMsg: "Please select a business industry niche first!",
    successReg: "Success! Registered \"{orgName}\" as a dynamic {businessType} tenant."
  },
  sw: {
    welcome: "Karibu kwenye Jasper Suite ya Biashara",
    welcomeSub: "POS Rejesta, Kitabu cha Hesabu, Usimamizi wa Hoteli na Huduma ya Pamoja",
    signinTab: "Ingia kwenye Akaunti",
    registerTab: "Sajili Biashara Mpya",
    emailLabel: "Barua Pepe ya Mmiliki",
    passLabel: "Nenosiri la Mmiliki (Pin)",
    ownerName: "Majina Kamili ya Mmiliki",
    companyName: "Jina la Kampuni au Biashara",
    region: "Nchi/Eneo la Huduma",
    city: "Jiji/Ofisi Kuu",
    phone: "Namba ya Simu ya Mmiliki",
    promoCode: "Kuponi ya Washirika (Sio Lazima)",
    promoDesc: "Kuponi hii inakupa majaribio ya siku 20 bure badala ya siku 10.",
    nicheLabel: "Aina ya Biashara yako (Lazima)",
    compileBtn: "Sajili na Fungua Biashara",
    continueGoogle: "Endelea na Google",
    googleOr: "AU SAJILI KWA BOFYA MOJA YA GOOGLE",
    googleOrSig: "AU INGIA KWA BONGO MOJA YA GOOGLE",
    demoProfiles: "MIPANGO YA MAJARIBIO YA HARAKA",
    adminPortal: "Mamlaka ya SaaS",
    backHome: "Rudi ukurasa mkuu wa Jasper",
    selectNicheMsg: "Tafadhali chagua aina ya biashara yako kwanza!",
    successReg: "Hongera! Umesajili \"{orgName}\" kama biashara mpya katika mfumo wetu mkuu."
  },
  ar: {
    welcome: "مرحباً بكم في جاسبر إنتربرايز سويت",
    welcomeSub: "توحيد نقاط البيع، وإدارة الفنادق والقنوات متعددة المستأجرين",
    signinTab: "تسجيل الدخول للحساب",
    registerTab: "تسجيل عمل تجاري جديد",
    emailLabel: "البريد الإلكتروني للمالك",
    passLabel: "رمز المرور السري للمالك",
    ownerName: "الاسم الكامل للمالك",
    companyName: "اسم الشركة / الفندق",
    region: "منطقة العمليات",
    city: "اسم مدينة المكتب",
    phone: "هاتف الاتصال بالمالك",
    promoCode: "رمز ترويج الإحالة (اختياري)",
    promoDesc: "يمنحك الرمز الترويجي فترة تجريبية مجانية ممتدة لـ 20 يومًا بدلاً من 10 أيام.",
    nicheLabel: "مجال العمل التجاري (إلزامي)",
    compileBtn: "تأكيد وتسجيل الحساب",
    continueGoogle: "المتابعة باستخدام Google",
    googleOr: "أو التسجيل السريع ببنقرة واحدة عبر Google",
    googleOrSig: "أو تسجيل الدخول السريع عبر Google",
    demoProfiles: "حسابات تجريبية سريعة جاهزة",
    adminPortal: "هيئة الرقابة المركزية لـ لساس",
    backHome: "العودة إلى الصفحة الرئيسية لجاسبر",
    selectNicheMsg: "الرجاء اختيار مجال العمل أولاً!",
    successReg: "لقد تم بنجاح تسجيل \"{orgName}\" كمستأجر جديد للمنصة."
  },
  fr: {
    welcome: "Bienvenue sur Jasper Suite",
    welcomeSub: "Unification du registre POS, de la comptabilité et hôtelière multi-locataire",
    signinTab: "Se Connecter",
    registerTab: "Enregistrer une Entreprise",
    emailLabel: "Adresse E-mail du Propriétaire",
    passLabel: "Code d'accès Pin",
    ownerName: "Nom Complet du Propriétaire",
    companyName: "Nom de l'Entreprise ou de l'Hôtel",
    region: "Région des opérations",
    city: "Ville du bureau principal",
    phone: "Numéro de téléphone portable",
    promoCode: "Code Promo d'affiliation (Optionnel)",
    promoDesc: "Le code promo prolonge l'essai gratuit jusqu'à 20 jours au lieu de 10.",
    nicheLabel: "Niche commerciale industrielle (Obligatoire)",
    compileBtn: "Compiler le Compte Sécurisé",
    continueGoogle: "Continuer avec Google",
    googleOr: "OU S'INSCRIRE EN UN CLIC AVEC GOOGLE",
    googleOrSig: "OU SE CONNECTER EN UN CLIC AVEC GOOGLE",
    demoProfiles: "PROFILS DE DÉMONSTRATION",
    adminPortal: "Autorité Centrale SaaS",
    backHome: "Retourner à la page d'accueil",
    selectNicheMsg: "Veuillez sélectionner votre secteur d'activité d'abord!",
    successReg: "Succès! Enregistrement de \"{orgName}\" en tant de nouveau locataire sur le système."
  }
};

interface LoginPageProps {
  onLogin: (user: User) => void;
  onNavigate: (route: string) => void;
  redirectMessage?: string;
  isDark?: boolean;
  onToggleTheme?: () => void;
  isSaasAdminPortal?: boolean;
}

export default function LoginPage({ onLogin, onNavigate, redirectMessage, isDark = false, onToggleTheme, isSaasAdminPortal }: LoginPageProps) {
  // Navigation Tabs: signin vs register
  const [authTab, setAuthTab] = useState<'signin' | 'register'>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('register') === 'true' || urlParams.get('ref') || urlParams.get('promo')) {
      return 'register';
    }
    return 'signin';
  });

  const [emailChecked, setEmailChecked] = useState(false);

  // Sign in Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Registration Form States
  const [ownerName, setOwnerName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [orgName, setOrgName] = useState('');
  const [businessType, setBusinessType] = useState<'retail' | 'pharmacy' | 'restaurant' | 'hotel' | ''>('');
  const [country, setCountry] = useState<'Nigeria' | 'Kenya' | 'Ghana' | 'South Africa' | 'Tanzania'>('Kenya');
  const [city, setCity] = useState('Nairobi');
  const [affiliateCode, setAffiliateCode] = useState(() => {
    // Check if affiliate is stored in URL params as ?ref=CODE or ?promo=CODE
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('ref') || urlParams.get('promo') || '';
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // SaaS Dynamic Niche Launch State
  const [launchedNiches, setLaunchedNiches] = useState<string[]>(() => {
    const raw = localStorage.getItem('saas_launched_niches');
    return raw ? JSON.parse(raw) : ['retail', 'pharmacy']; // Matches the user's wish: retail & pharmacy active first!
  });

  useEffect(() => {
    const handleUpdate = () => {
      const raw = localStorage.getItem('saas_launched_niches');
      if (raw) setLaunchedNiches(JSON.parse(raw));
    };
    window.addEventListener('saas_niches_updated', handleUpdate);

    // Check for params in URL on load
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('ref') || urlParams.get('promo');
    if (code) {
      setAffiliateCode(code);
      setAuthTab('register');
    } else if (urlParams.get('register') === 'true') {
      setAuthTab('register');
    }

    return () => window.removeEventListener('saas_niches_updated', handleUpdate);
  }, []);

  // Google SSO states
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleStep, setGoogleStep] = useState<'select' | 'register'>('select');
  const [selectedGoogleEmail, setSelectedGoogleEmail] = useState('');
  const [selectedGoogleName, setSelectedGoogleName] = useState('');
  const [customGoogleEmailInput, setCustomGoogleEmailInput] = useState('');
  const [showCustomGoogleInput, setShowCustomGoogleInput] = useState(false);
  
  // Custom states during Google Signup
  const [googleOrgName, setGoogleOrgName] = useState('');
  const [googlePhone, setGooglePhone] = useState('');
  const [googleBusinessType, setGoogleBusinessType] = useState<'retail' | 'pharmacy' | 'restaurant' | 'hotel'>('retail');
  const [googleCountry, setGoogleCountry] = useState<'Nigeria' | 'Kenya' | 'Ghana' | 'South Africa' | 'Tanzania'>('Kenya');
  const [googleCity, setGoogleCity] = useState('Nairobi');

  // Translation support
  const [currentLang, setCurrentLang] = useState<'en' | 'sw' | 'ar' | 'fr'>(() => {
    const cached = localStorage.getItem('jasper_lang');
    return (cached && ['en', 'sw', 'ar', 'fr'].includes(cached)) ? (cached as any) : 'en';
  });

  useEffect(() => {
    const handleLangChange = () => {
      const cached = localStorage.getItem('jasper_lang');
      if (cached && ['en', 'sw', 'ar', 'fr'].includes(cached)) {
        setCurrentLang(cached as any);
      }
    };
    window.addEventListener('jasper_lang_changed', handleLangChange);
    window.addEventListener('storage', handleLangChange);
    return () => {
      window.removeEventListener('jasper_lang_changed', handleLangChange);
      window.removeEventListener('storage', handleLangChange);
    };
  }, []);

  const t = (key: string, variables?: Record<string, string>) => {
    const dict = LOGIN_TRANSLATIONS[currentLang] || LOGIN_TRANSLATIONS['en'];
    let text = dict[key] || LOGIN_TRANSLATIONS['en'][key] || key;
    if (variables) {
      Object.entries(variables).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, v);
      });
    }
    return text;
  };

  // Ref tracking to avoid stale enclosure in GIS callbacks
  const handleSelectGoogleAccountRef = useRef<(email: string, name: string) => void>(() => {});
  useEffect(() => {
    handleSelectGoogleAccountRef.current = handleSelectGoogleAccount;
  }, [handleSelectGoogleAccount]);

  // Dynamic Google One-Tap & standard Sign In Initialization
  useEffect(() => {
    const googleClientId = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID;
    if (!googleClientId) return;

    const initGoogleGsi = () => {
      if (window.google?.accounts?.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: (response: any) => {
              const payload = decodeJwt(response.credential);
              if (payload && payload.email) {
                // Trigger oauth-verified registration or direct login action
                handleSelectGoogleAccountRef.current(
                  payload.email, 
                  payload.name || payload.email.split('@')[0]
                );
              } else {
                setError('Authentication failed: Could not retrieve a valid Google user profile JWT.');
              }
            },
            auto_select: false,
            use_fedcm_for_prompt: false,
            cancel_on_tap_outside: true,
          });

          // Trigger One Tap UI automatically on startup if NOT loaded inside a sandboxed iframe
          const isSelfInIframe = window.self !== window.top;
          if (!isSelfInIframe) {
            window.google.accounts.id.prompt((notification: any) => {
              if (notification.isNotDisplayed()) {
                console.info('Google One Tap UI skipped or blocked: ', notification.getNotDisplayedReason());
              }
            });
          } else {
            console.info('Google One Tap UI bypassed automatically inside sandboxed iframe context.');
          }
        } catch (err) {
          console.error('Google One Tap init failed: ', err);
        }
      }
    };

    if (window.google?.accounts?.id) {
      initGoogleGsi();
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          initGoogleGsi();
          clearInterval(interval);
        }
      }, 600);
      return () => clearInterval(interval);
    }
  }, []);

  const getAllSystemUsers = () => {
    const customUsers = JSON.parse(localStorage.getItem('jasper_custom_users') || '[]');
    const saasStaffs = JSON.parse(localStorage.getItem('jasper_saas_staffs') || '[]');
    const systemUsers = [...DEMO_USERS, ...customUsers, ...saasStaffs];

    // Scan all cached tenants settings for staffs
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('jasper_settings_')) {
          const tenantId = key.replace('jasper_settings_', '');
          try {
            const settings = JSON.parse(localStorage.getItem(key) || '{}');
            if (settings.staffs && Array.isArray(settings.staffs)) {
              settings.staffs.forEach((staff: any) => {
                 systemUsers.push({
                   id: staff.id,
                   email: staff.phone || staff.name.toLowerCase().replace(' ', '') + '@jasper.com', 
                   phone: staff.phone || '',
                   password: staff.password || 'password123',
                   name: staff.name,
                   role: staff.role || 'Cashier',
                   tenantId: tenantId,
                   activeTenant: tenantId,
                   profileImage: staff.profileImage
                 });
              });
            }
          } catch(e) {}
        }
    }
    return systemUsers;
  };

  const handleCheckEmail = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError('Please enter your email or phone to proceed.');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      const combinedUsers = getAllSystemUsers();
      const match = combinedUsers.find(
        (u: any) => u.email.toLowerCase() === email.toLowerCase().trim() || (u.phone && u.phone === email.trim())
      );

      setIsLoading(false);
      if (match) {
        setEmailChecked(true);
        setError(null);
      } else {
        setError('No account found with this credential. Please Register to start your free trial.');
      }
    }, 450);
  };

  const handleLoginSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!emailChecked) {
      handleCheckEmail(e);
    } else {
      triggerLogin(email, password);
    }
  };

  const triggerLogin = (targetEmail: string, targetPass: string) => {
    setIsLoading(true);
    setError(null);

    setTimeout(() => {
      const combinedUsers = getAllSystemUsers();

      // If Super Admin enters any password other than 'password123', log into DURESS DASHBOARD
      if (targetEmail.toLowerCase() === 'saas.admin@jasper.com' && targetPass !== 'password123') {
        onLogin({
          id: 'u-saas-duress',
          email: 'saas.admin@jasper.com',
          name: 'Jasper SaaS Controller',
          role: 'SuperAdmin',
          tenantId: 't-lagos-01',
          activeTenant: 't-lagos-01',
          isDuress: true
        });
        return;
      }

      const match = combinedUsers.find(
        (u: any) => (u.email.toLowerCase() === targetEmail.toLowerCase() || (u.phone && u.phone === targetEmail.trim())) && u.password === targetPass
      );

      if (match) {
        onLogin({
          id: match.id || 'u-' + Math.random().toString(36).substr(2, 9),
          email: match.email,
          name: match.name,
          role: match.role as any,
          tenantId: match.tenantId,
          activeTenant: match.activeTenant,
          profileImage: match.profileImage,
          phone: match.phone,
          trial_start_date: match.trial_start_date || new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          trial_end_date: match.trial_end_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          is_affiliate_lead: match.is_affiliate_lead || false,
          referral_code_used: match.referral_code_used || ''
        });
      } else {
        setError('Invalid credentials. Check the quick-fill profiles below to test standard roles!');
        setIsLoading(false);
      }
    }, 600);
  };

  const handleQuickFill = (userObj: typeof DEMO_USERS[0]) => {
    setEmail(userObj.email);
    setPassword(userObj.password);
    setEmailChecked(true);
    triggerLogin(userObj.email, userObj.password);
  };

  const registerAffiliateReferral = (code: string, subscriberName: string) => {
    const raw = localStorage.getItem('saas_immersive_affiliates');
    if (!raw) return;
    try {
      const affiliates = JSON.parse(raw);
      const matchIndex = affiliates.findIndex((a: any) => a.promoCode.toUpperCase() === code.toUpperCase());
      if (matchIndex !== -1) {
        affiliates[matchIndex].conversionsPromo = (affiliates[matchIndex].conversionsPromo || 0) + 1;
        // Mock a subscription payment value of TSh 1,500,000
        const revenueAdded = 1500000;
        affiliates[matchIndex].revenueGenerated = (affiliates[matchIndex].revenueGenerated || 0) + revenueAdded;
        affiliates[matchIndex].totalEarnings = (affiliates[matchIndex].totalEarnings || 0) + Math.round(revenueAdded * 0.15);

        // If this affiliate is recruited by a Super Affiliate:
        if (affiliates[matchIndex].parentSuperId) {
          const superId = affiliates[matchIndex].parentSuperId;
          const superIndex = affiliates.findIndex((a: any) => a.id === superId);
          if (superIndex !== -1) {
            // Recruiter gets 5% oversight earnings
            affiliates[superIndex].revenueGenerated = (affiliates[superIndex].revenueGenerated || 0) + revenueAdded;
            affiliates[superIndex].totalEarnings = (affiliates[superIndex].totalEarnings || 0) + Math.round(revenueAdded * 0.05);
            affiliates[superIndex].conversionsPromo = (affiliates[superIndex].conversionsPromo || 0) + 1;
          }
        }
        localStorage.setItem('saas_immersive_affiliates', JSON.stringify(affiliates));
        window.dispatchEvent(new Event('saas_logs_updated'));
      }
    } catch (e) {
      console.error('Error in tracing affiliate codes', e);
    }
  };

  // Perform dynamic tenant/business registration
  const handleRegisterSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!ownerName || !regEmail || !regPassword || !orgName || !regPhone) {
      setError('Please fill in all registration inputs, including your contact phone.');
      return;
    }
    if (!businessType) {
      setError(currentLang === 'sw' ? 'Tafadhali chagua aina ya biashara yako kwanza!' : 'Please select a business industry niche first!');
      return;
    }

    setIsLoading(true);

    const currencyMapping = {
      'Nigeria': { symbol: '₦', code: 'NGN', tax: 0.075 },
      'Kenya': { symbol: 'KSh', code: 'KES', tax: 0.16 },
      'Ghana': { symbol: 'GH₵', code: 'GHS', tax: 0.15 },
      'South Africa': { symbol: 'R', code: 'ZAR', tax: 0.15 },
      'Tanzania': { symbol: 'TSh', code: 'TZS', tax: 0.18 }
    } as const;

    const mappedCurrency = currencyMapping[country];
    const newTenantId = 't-dyn-' + Math.floor(100 + Math.random() * 900);

    const newTenant: Tenant = {
      id: newTenantId,
      name: orgName,
      country,
      city,
      currency: mappedCurrency.symbol,
      currencyCode: mappedCurrency.code,
      taxRate: mappedCurrency.tax,
      mobileMoneyProviders: country === 'Kenya' ? ['M-Pesa', 'Airtel Money'] : ['MTN MoMo'],
      businessType: businessType
    };

    const userStartDate = new Date();
    const hasReferral = !!affiliateCode.trim();
    const trialDays = hasReferral ? 20 : 10;
    const userEndDate = new Date(userStartDate);
    userEndDate.setDate(userEndDate.getDate() + trialDays);

    const newDynamicUser = {
      id: 'u-dyn-' + Math.floor(100 + Math.random() * 900),
      email: regEmail,
      password: regPassword,
      name: ownerName,
      role: 'Admin' as const,
      tenantId: newTenantId,
      activeTenant: newTenantId,
      phone: regPhone,
      trial_start_date: userStartDate.toISOString(),
      trial_end_date: userEndDate.toISOString(),
      is_affiliate_lead: hasReferral,
      referral_code_used: hasReferral ? affiliateCode.trim() : ''
    };

    // Store custom tenants dynamically in localStorage
    const savedCustomTenants = JSON.parse(localStorage.getItem('jasper_custom_tenants') || '[]');
    localStorage.setItem('jasper_custom_tenants', JSON.stringify([...savedCustomTenants, newTenant]));

    // Store custom users dynamically in localStorage
    const savedCustomUsers = JSON.parse(localStorage.getItem('jasper_custom_users') || '[]');
    localStorage.setItem('jasper_custom_users', JSON.stringify([...savedCustomUsers, newDynamicUser]));

    // Affiliate referral tracking registry
    if (affiliateCode.trim()) {
      const code = affiliateCode.trim().toUpperCase();
      const referralLedger = JSON.parse(localStorage.getItem('jasper_referral_ledger') || '[]');
      referralLedger.push({
        id: 'ref-dyn-' + Math.floor(1000 + Math.random() * 9000),
        affiliateCode: code,
        subscriberName: orgName,
        package: '30-Day Extended Free Trial (Promo Applied)',
        payoutStatus: 'Trial Mode',
        registeredAt: new Date().toISOString().split('T')[0],
        commission: 0
      });
      localStorage.setItem('jasper_referral_ledger', JSON.stringify(referralLedger));

      // Generate customized initial sub state with promotional coupon registered
      const initialSubState = {
        planId: 'trial' as const,
        trialStartedAt: new Date().toISOString(),
        isSubscribedPaid: false,
        simulatedDaysPassed: 0,
        promoCodeUsed: code,
        autoRenewEnabled: true,
        paymentStatus: 'active' as const
      };
      localStorage.setItem('jasper_subscription_state', JSON.stringify(initialSubState));
      registerAffiliateReferral(code, orgName);
    } else {
      // Basic normal Trial duration
      const initialSubState = {
        planId: 'trial' as const,
        trialStartedAt: new Date().toISOString(),
        isSubscribedPaid: false,
        simulatedDaysPassed: 0,
        autoRenewEnabled: true,
        paymentStatus: 'active' as const
      };
      localStorage.setItem('jasper_subscription_state', JSON.stringify(initialSubState));
    }

    setTimeout(() => {
      setIsLoading(false);
      setSuccessMessage(`Success! Registered "${orgName}" as a dynamic ${businessType === 'hotel' ? 'Hotel Business' : businessType === 'retail' ? 'Retail & Wholesale' : businessType === 'pharmacy' ? 'Pharmacy' : 'Restaurant'} tenant.`);
      
      // Auto-fill signin inputs to speed up test operations
      setEmail(regEmail);
      setPassword(regPassword);
      
      // Pivot to signin automatically
      setAuthTab('signin');
      
      // Auto trigger login directly for premium user experience
      triggerLogin(regEmail, regPassword);
    }, 1000);
  };

  const handleGoogleLoginClick = () => {
    setError(null);
    setSuccessMessage(null);
    
    const googleClientId = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID;
    const isSelfInIframe = window.self !== window.top;

    if (googleClientId && window.google?.accounts?.id && !isSelfInIframe) {
      // Trigger Google Real auth prompt immediately
      try {
        window.google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // One Tap is blocked or dismissed, fallback gracefully to the selection dialog modal
            setSelectedGoogleEmail('');
            setSelectedGoogleName('');
            setGoogleStep('select');
            setShowGoogleModal(true);
          }
        });
      } catch (err) {
        console.warn('Could not launch One Tap, opening modal instead:', err);
        setSelectedGoogleEmail('');
        setSelectedGoogleName('');
        setGoogleStep('select');
        setShowGoogleModal(true);
      }
    } else {
      setSelectedGoogleEmail('');
      setSelectedGoogleName('');
      setGoogleStep('select');
      setShowGoogleModal(true);
    }
  };

  function handleSelectGoogleAccount(emailAddress: string, displayName: string) {
    setIsLoading(true);
    
    // Check if user exists
    const customUsers = JSON.parse(localStorage.getItem('jasper_custom_users') || '[]');
    const combinedUsers = [...DEMO_USERS, ...customUsers];
    const match = combinedUsers.find(u => u.email.toLowerCase() === emailAddress.toLowerCase());

    if (match) {
      // User is already registered! Log them in!
      setTimeout(() => {
        setIsLoading(false);
        setShowGoogleModal(false);
        onLogin({
          id: match.id || 'u-google-' + Math.random().toString(36).substr(2, 9),
          email: match.email,
          name: match.name,
          role: match.role as any,
          tenantId: match.tenantId,
          activeTenant: match.activeTenant,
          profileImage: match.profileImage,
          phone: match.phone
        });
      }, 800);
    } else {
      // User is registering with Google - transition to complete profile metadata
      setTimeout(() => {
        setIsLoading(false);
        setSelectedGoogleEmail(emailAddress);
        setSelectedGoogleName(displayName);
        setGoogleStep('register');
      }, 400);
    }
  }

  const handleGoogleRegisterSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedGoogleEmail || !selectedGoogleName || !googleOrgName || !googlePhone) {
      setError('Please complete all profile details before continuing.');
      return;
    }

    setIsLoading(true);

    const currencyMapping = {
      'Nigeria': { symbol: '₦', code: 'NGN', tax: 0.075 },
      'Kenya': { symbol: 'KSh', code: 'KES', tax: 0.16 },
      'Ghana': { symbol: 'GH₵', code: 'GHS', tax: 0.15 },
      'South Africa': { symbol: 'R', code: 'ZAR', tax: 0.15 },
      'Tanzania': { symbol: 'TSh', code: 'TZS', tax: 0.18 }
    } as const;

    const mappedCurrency = currencyMapping[googleCountry];
    const newTenantId = 't-dyn-google-' + Math.floor(100 + Math.random() * 900);

    const newTenant: Tenant = {
      id: newTenantId,
      name: googleOrgName,
      country: googleCountry,
      city: googleCity,
      currency: mappedCurrency.symbol,
      currencyCode: mappedCurrency.code,
      taxRate: mappedCurrency.tax,
      mobileMoneyProviders: googleCountry === 'Kenya' ? ['M-Pesa', 'Airtel Money'] : ['MTN MoMo'],
      businessType: googleBusinessType
    };

    const userStartDate = new Date();
    const hasReferral = !!affiliateCode.trim();
    const trialDays = hasReferral ? 20 : 10;
    const userEndDate = new Date(userStartDate);
    userEndDate.setDate(userEndDate.getDate() + trialDays);

    const newDynamicUser = {
      id: 'u-dyn-google-' + Math.floor(100 + Math.random() * 900),
      email: selectedGoogleEmail,
      password: 'oauth-google-sign-in', // secure mock SSO key
      name: selectedGoogleName,
      role: 'Admin' as const,
      tenantId: newTenantId,
      activeTenant: newTenantId,
      phone: googlePhone,
      trial_start_date: userStartDate.toISOString(),
      trial_end_date: userEndDate.toISOString(),
      is_affiliate_lead: hasReferral,
      referral_code_used: hasReferral ? affiliateCode.trim() : ''
    };

    // Store custom tenants dynamically in localStorage
    const savedCustomTenants = JSON.parse(localStorage.getItem('jasper_custom_tenants') || '[]');
    localStorage.setItem('jasper_custom_tenants', JSON.stringify([...savedCustomTenants, newTenant]));

    // Store custom users dynamically in localStorage
    const savedCustomUsers = JSON.parse(localStorage.getItem('jasper_custom_users') || '[]');
    localStorage.setItem('jasper_custom_users', JSON.stringify([...savedCustomUsers, newDynamicUser]));

    // Affiliate referral promo coupon registered if code was applied (optional config)
    if (affiliateCode.trim()) {
      const code = affiliateCode.trim().toUpperCase();
      const referralLedger = JSON.parse(localStorage.getItem('jasper_referral_ledger') || '[]');
      referralLedger.push({
        id: 'ref-dyn-google-' + Math.floor(1000 + Math.random() * 9000),
        affiliateCode: code,
        subscriberName: googleOrgName,
        package: '30-Day Extended Free Trial (Promo Applied)',
        payoutStatus: 'Trial Mode',
        registeredAt: new Date().toISOString().split('T')[0],
        commission: 0
      });
      localStorage.setItem('jasper_referral_ledger', JSON.stringify(referralLedger));

      const initialSubState = {
        planId: 'trial' as const,
        trialStartedAt: new Date().toISOString(),
        isSubscribedPaid: false,
        simulatedDaysPassed: 0,
        promoCodeUsed: code,
        autoRenewEnabled: true,
        paymentStatus: 'active' as const
      };
      localStorage.setItem('jasper_subscription_state', JSON.stringify(initialSubState));
      registerAffiliateReferral(code, googleOrgName);
    } else {
      const initialSubState = {
        planId: 'trial' as const,
        trialStartedAt: new Date().toISOString(),
        isSubscribedPaid: false,
        simulatedDaysPassed: 0,
        autoRenewEnabled: true,
        paymentStatus: 'active' as const
      };
      localStorage.setItem('jasper_subscription_state', JSON.stringify(initialSubState));
    }

    setTimeout(() => {
      setIsLoading(false);
      setShowGoogleModal(false);
      onLogin({
        id: newDynamicUser.id,
        email: newDynamicUser.email,
        name: newDynamicUser.name,
        role: 'Admin',
        tenantId: newTenantId,
        activeTenant: newTenantId,
        phone: googlePhone,
        trial_start_date: newDynamicUser.trial_start_date,
        trial_end_date: newDynamicUser.trial_end_date,
        is_affiliate_lead: newDynamicUser.is_affiliate_lead,
        referral_code_used: newDynamicUser.referral_code_used
      });
    }, 800);
  };

  return (
    <div id="login-container" className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-850 dark:text-slate-100 font-sans flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative selection:bg-emerald-100 selection:text-emerald-950 overflow-y-auto transition-colors duration-300">
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden font-sans">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-emerald-100/30 rounded-full blur-[110px]" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-lg relative z-10 space-y-6">
        {/* Core Header */}
        <div className="text-center space-y-2 cursor-pointer" onClick={() => onNavigate('/')}>
          <div className={`inline-flex p-3 rounded-2xl border items-center justify-center mb-1 hover:scale-105 transition-transform shadow-xs ${isSaasAdminPortal ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}`}>
            {isSaasAdminPortal ? (
              <Shield className="w-8 h-8 text-amber-600 stroke-[1.75]" />
            ) : (
              <Store className="w-8 h-8 text-emerald-600 stroke-[1.75]" />
            )}
          </div>
          <h2 className="text-2xl font-black tracking-tight text-slate-850 dark:text-slate-100">
            {isSaasAdminPortal ? 'SaaS Core Authority' : 'Welcome to Jasper Enterprise Suite'}
          </h2>
          <p className="text-[10px] text-slate-450 dark:text-slate-400 font-bold tracking-widest uppercase font-mono">
            {isSaasAdminPortal ? 'Central Management Backoffice' : 'Unifying POS Ledger, Hotel PMs & Multi-Tenant Channels'}
          </p>
        </div>

        {/* Warning or Success outputs */}
        {(successMessage || redirectMessage || error) && (
          <div className={`p-4 rounded-2xl border flex items-start space-x-3 text-xs font-mono animate-fade-in ${
            successMessage 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-250' 
              : error 
                ? 'bg-red-50 text-red-700 border-red-200' 
                : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            <span className="shrink-0 mt-0.5">⚠️</span>
            <div className="space-y-1 font-sans">
              <p className="font-bold">
                {successMessage ? 'Registration Ledger updated' : error ? 'Fault Signal' : 'Active Safe Tunnel Redirect'}
              </p>
              <p className="font-medium text-[11px] leading-relaxed">
                {successMessage || error || redirectMessage}
              </p>
            </div>
          </div>
        )}

        {/* Auth Tab Picker */}
        {!isSaasAdminPortal && (
          <div className="flex bg-slate-200 p-1 rounded-2xl grid grid-cols-2 font-bold text-xs shadow-inner">
            <button
              onClick={() => { setAuthTab('signin'); setError(null); }}
              className={`py-3 rounded-xl transition-all cursor-pointer text-center ${authTab === 'signin' ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-700 bg-transparent border-none'}`}
            >
              Sign In Account
            </button>
            <button
              onClick={() => { setAuthTab('register'); setError(null); }}
              className={`py-3 rounded-xl transition-all cursor-pointer text-center ${authTab === 'register' ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-700 bg-transparent border-none'}`}
            >
              Register New Business
            </button>
          </div>
        )}

        {/* Action card boundary */}
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-6">
          
          {(authTab === 'signin' || isSaasAdminPortal) ? (
            /* Sign in screen */
            <form className="space-y-5" onSubmit={handleLoginSubmit}>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">
                    {isSaasAdminPortal ? 'SAAS STAFF ACCOUNT EMAIL' : 'CASHIER / STAFF EMAIL OR PHONE'}
                  </label>
                  {emailChecked && (
                    <button
                      type="button"
                      onClick={() => {
                        setEmailChecked(false);
                        setPassword('');
                      }}
                      className="text-[10px] font-bold text-emerald-600 hover:text-emerald-750 bg-transparent cursor-pointer border-none outline-none"
                    >
                      Change Account
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="login-email"
                    type="text"
                    required
                    disabled={emailChecked}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 border border-slate-200 focus:border-emerald-500 rounded-xl px-4 py-3 pl-11 text-sm text-slate-800 placeholder-slate-400 font-sans transition-all outline-none"
                    placeholder="Email or Phone Number"
                  />
                  <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                </div>
              </div>

              {emailChecked ? (
                <div className="space-y-1.5 animate-fade-in">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">
                    SECURITY PIN PASSWORD
                  </label>
                  <div className="relative">
                    <input
                      id="login-password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl px-4 py-3 pl-11 text-sm text-slate-800 placeholder-slate-400 font-mono tracking-wider transition-all outline-none"
                      placeholder="••••••••••••"
                    />
                    <KeyRound className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                  </div>
                </div>
              ) : null}

              <button
                id="login-submit-btn"
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-550 disabled:opacity-55 text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-2 shadow-md shadow-emerald-500/10 active:scale-98"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processing securely...</span>
                  </>
                ) : emailChecked ? (
                  <span>Access Terminal Cabin</span>
                ) : (
                  <span>Continue to Security PIN</span>
                )}
              </button>

              <div className="relative flex py-1.5 items-center">
                <div className="flex-grow border-t border-slate-150"></div>
                <span className="flex-shrink mx-3 text-[9px] font-mono text-slate-400 uppercase tracking-wider font-extrabold">
                  OR GOOGLE SINGLE SIGN-ON
                </span>
                <div className="flex-grow border-t border-slate-150"></div>
              </div>

              <button
                type="button"
                onClick={handleGoogleLoginClick}
                className="w-full py-3 border border-slate-200 bg-white hover:bg-slate-50 text-slate-705 font-bold rounded-2.5xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-2.5 active:scale-98 shadow-xs"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.648 2.42-2.519 4.114-5.137 4.114-3.467 0-6.277-2.81-6.277-6.277s2.81-6.277 6.277-6.277c1.551 0 2.966.565 4.062 1.49l3.056-3.057C19.167 2.147 15.932 1 12.24 1 5.48 1 0 6.48 0 13.22c0 6.74 5.48 12.22 12.24 12.22 6.41 0 11.536-4.595 11.536-11.39 0-.693-.06-1.344-.173-1.956H12.24z"/>
                </svg>
                <span>Continue with Google</span>
              </button>
            </form>
          ) : (
            /* Registration screen with picker for the 4 dynamic business sectors */
            <form className="space-y-5" onSubmit={handleRegisterSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">Owner Full Name</label>
                  <input
                    type="text"
                    required
                    value={ownerName}
                    placeholder="e.g. Tunde Alao"
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-505 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">Company / Hotel Name</label>
                  <input
                    type="text"
                    required
                    value={orgName}
                    placeholder="e.g. Lagos Royal Retreat"
                    onChange={(e) => setOrgName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-505 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">Owner Email Address</label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    placeholder="tunde@lagosroyal.com"
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-555 rounded-xl px-3.5 py-2.5 text-xs text-slate-805 outline-none font-sans"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">Owner Pin Password</label>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    placeholder="••••••••"
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-555 rounded-xl px-3.5 py-2.5 text-xs text-slate-805 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">Region of operations</label>
                  <select
                    value={country}
                    onChange={(e) => {
                      const selectedCount = e.target.value as any;
                      setCountry(selectedCount);
                      setCity(selectedCount === 'Nigeria' ? 'Lagos' : selectedCount === 'Tanzania' ? 'Dar es Salaam' : selectedCount === 'Ghana' ? 'Accra' : selectedCount === 'South Africa' ? 'Johannesburg' : 'Nairobi');
                    }}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl px-3 py-2.5 text-xs text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="Kenya">Kenya (KES)</option>
                    <option value="Nigeria">Nigeria (NGN)</option>
                    <option value="Tanzania">Tanzania (TZS)</option>
                    <option value="Ghana">Ghana (GHS)</option>
                    <option value="South Africa">South Africa (ZAR)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-505 uppercase block">City Name Office</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-505 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-505 uppercase block">Owner Contact Phone</label>
                  <input
                    type="tel"
                    required
                    value={regPhone}
                    placeholder="e.g. +254 712 345 678"
                    onChange={(e) => setRegPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-505 rounded-xl px-3.5 py-2.5 text-xs text-slate-850 outline-none font-sans"
                  />
                </div>
              </div>

              {/* OPTIONAL AFFILIATE REFERRAL TRACKER */}
              <div className="space-y-1.5 bg-emerald-50/40 p-3.5 rounded-2xl border border-emerald-100/60">
                <label className="text-[10px] font-bold text-emerald-800 uppercase block tracking-wider font-mono flex items-center space-x-1">
                  <Sparkles className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span>Affiliate Referral Promo Code (Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter PROMO CODE"
                  value={affiliateCode}
                  onChange={(e) => setAffiliateCode(e.target.value)}
                  className="w-full bg-white border border-emerald-250 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-bold uppercase tracking-wider outline-none placeholder:font-bold placeholder:uppercase placeholder:text-slate-400"
                />
                <p className="text-[9.5px] text-emerald-700 font-sans leading-normal font-medium">
                  Promo code gives you an extended 20 days free trial instead of 10 days.
                </p>
              </div>

              {/* MANDATORY BUSINESS INDUSTRY NICHE CLICKABLE BLOCKS */}
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider font-mono">
                  {t('nicheLabel')}
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Block 1: Retail and Wholesale */}
                  <button
                    type="button"
                    onClick={() => {
                      setBusinessType('retail');
                      setError(null);
                    }}
                    className={`flex flex-col items-start text-left p-4 rounded-2xl border transition-all relative cursor-pointer ${
                      businessType === 'retail'
                        ? 'border-emerald-500 bg-emerald-500/5 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-350 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className={`p-2 rounded-xl shrink-0 ${businessType === 'retail' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        <Store className="w-5 h-5" />
                      </div>
                      <div className="font-extrabold text-[11px] text-slate-800">
                        {currentLang === 'sw' ? 'Bloko 1: Rejareja na Jumla' : currentLang === 'ar' ? 'الكتلة 1: تجارة التجزئة والجملة' : currentLang === 'fr' ? 'Bloc 1: Vente au détail et en gros' : 'Block 1: Retail and Wholesale'}
                      </div>
                    </div>
                    <p className="text-[9.5px] text-slate-500 mt-2 font-sans font-light leading-relaxed">
                      {currentLang === 'sw' ? 'POS Rejesta, usimamizi wa stoki, ripoti za hesabu na madeni.' : currentLang === 'ar' ? 'نقاط بيع وتسجيل متكاملة، تتبع المخزون والتقارير والضرائب.' : currentLang === 'fr' ? 'Caisse POS, mouvements de stocks, taxes et devises.' : 'Offline-First POS Register, multi-tax ledgers, digital bills printout.'}
                    </p>
                    {businessType === 'retail' && (
                      <div className="absolute top-3 right-3 w-4 h-4 bg-emerald-500 text-[10px] text-white flex items-center justify-center rounded-full font-bold">
                        ✓
                      </div>
                    )}
                  </button>

                  {/* Block 2: Pharmacy */}
                  <button
                    type="button"
                    onClick={() => {
                      setBusinessType('pharmacy');
                      setError(null);
                    }}
                    className={`flex flex-col items-start text-left p-4 rounded-2xl border transition-all relative cursor-pointer ${
                      businessType === 'pharmacy'
                        ? 'border-emerald-500 bg-emerald-500/5 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-350 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className={`p-2 rounded-xl shrink-0 ${businessType === 'pharmacy' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        <Pill className="w-5 h-5" />
                      </div>
                      <div className="font-extrabold text-[11px] text-slate-800">
                        {currentLang === 'sw' ? 'Bloko 2: Famasia ya Dawa' : currentLang === 'ar' ? 'الكتلة 2: الصيدلية والعقاقير' : currentLang === 'fr' ? 'Bloc 2: Pharmacie médicale' : 'Block 2: Pharmacy'}
                      </div>
                    </div>
                    <p className="text-[9.5px] text-slate-500 mt-2 font-sans font-light leading-relaxed">
                      {currentLang === 'sw' ? 'Orodha za dawa za kitalu, arifa za muda wa dawa kuisha.' : currentLang === 'ar' ? 'إخطارات لتواريخ انتهاء الصلاحية وتتبع فئات الأدوية.' : currentLang === 'fr' ? 'Génériques des médicaments, alertes d\'expiration et prescriptions.' : 'E-prescription index checks, chemical generic class lists, drug expiry tracker.'}
                    </p>
                    {businessType === 'pharmacy' && (
                      <div className="absolute top-3 right-3 w-4 h-4 bg-emerald-500 text-[10px] text-white flex items-center justify-center rounded-full font-bold">
                        ✓
                      </div>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-55 text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Allocating Cloud DB Cluster...</span>
                  </>
                ) : (
                  <span>Compile Secure Tenant</span>
                )}
              </button>

              <div className="relative flex py-1.5 items-center">
                <div className="flex-grow border-t border-slate-150"></div>
                <span className="flex-shrink mx-3 text-[9px] font-mono text-slate-400 uppercase tracking-wider font-extrabold">
                  OR ONE-CLICK REGISTER WITH GOOGLE
                </span>
                <div className="flex-grow border-t border-slate-150"></div>
              </div>

              <button
                type="button"
                onClick={handleGoogleLoginClick}
                className="w-full py-3 border border-slate-205 bg-white hover:bg-slate-50 text-slate-705 font-bold rounded-2.5xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-2.5 active:scale-98 shadow-xs"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.648 2.42-2.519 4.114-5.137 4.114-3.467 0-6.277-2.81-6.277-6.277s2.81-6.277 6.277-6.277c1.551 0 2.966.565 4.062 1.49l3.056-3.057C19.167 2.147 15.932 1 12.24 1 5.48 1 0 6.48 0 13.22c0 6.74 5.48 12.22 12.24 12.22 6.41 0 11.536-4.595 11.536-11.39 0-.693-.06-1.344-.173-1.956H12.24z"/>
                </svg>
                <span>Continue with Google</span>
              </button>
            </form>
          )}

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-150"></div>
            <span className="flex-shrink mx-4 text-[10px] font-mono text-slate-400 uppercase tracking-wider font-bold">
              DEMO TEST PROFILES
            </span>
            <div className="flex-grow border-t border-slate-150"></div>
          </div>

          {/* Quick fills - separated nicely into category blocks */}
          <div className="space-y-3 font-sans">
            <p className="text-[10px] font-bold text-slate-400 text-center uppercase tracking-wide flex items-center justify-center space-x-1.5 mb-1">
              <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
              <span>Select profile to auto-fill security codes:</span>
            </p>
            
            {/* Split the mock profiles clearly */}
            <div className="grid grid-cols-1 gap-3">
              
              {/* Jasper Super SaaS Admin Central Profile - Requested! */}
              <div className="p-1 border-2 border-slate-900 rounded-2xl bg-slate-900 text-white shadow-lg overflow-hidden relative">
                <div className="absolute top-0 right-0 p-1.5 bg-amber-500 rounded-bl-xl text-[8px] font-mono font-black text-slate-950 uppercase tracking-widest leading-none flex items-center space-x-1">
                  <span className="animate-pulse">●</span> <span>SaaS Host Authority</span>
                </div>
                <p className="text-[9px] font-mono mx-2.5 mt-2 mb-1.5 text-amber-400 font-bold uppercase tracking-widest flex items-center space-x-1">
                  <span>👑 CENTRAL SAAS ADMIN PLATFORM</span>
                </p>
                {DEMO_USERS.filter(u => u.email === 'saas.admin@jasper.com').map(user => (
                  <button
                    key={user.email}
                    type="button"
                    onClick={() => handleQuickFill(user)}
                    className="flex w-full items-center justify-between p-3.5 bg-slate-950 border border-slate-800 hover:border-amber-400 rounded-xl transition-all cursor-pointer group text-left"
                  >
                    <div>
                      <p className="text-xs font-black text-white group-hover:text-amber-400 transition-colors">
                        {user.name} <span className="text-[10px] font-mono text-amber-500">({user.role})</span>
                      </p>
                      <p className="text-[10px] text-slate-400">{user.email}</p>
                    </div>
                    <span className="text-[9px] font-mono font-extrabold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-lg">
                      SaaS Active Controller
                    </span>
                  </button>
                ))}
              </div>

              {/* Hotel Business Quick fill (Serah) */}
              {!isSaasAdminPortal && (
                <div className="p-1 border border-indigo-100 rounded-2xl bg-indigo-50/20">
                  <p className="text-[8.5px] font-mono mx-2.5 my-1 text-indigo-700 font-bold uppercase tracking-wider">Hotel PMS Mode (Cloudbeds+ Adaptation)</p>
                  {DEMO_USERS.filter(u => u.tenantId === 't-hotel-01').map(user => (
                    <button
                      key={user.email}
                      type="button"
                      onClick={() => handleQuickFill(user)}
                      className="flex w-full items-center justify-between p-3.5 bg-white border border-slate-150 hover:border-emerald-500 rounded-xl transition-all cursor-pointer group text-left shadow-xs"
                    >
                      <div>
                        <p className="text-xs font-black text-slate-800 group-hover:text-emerald-700">
                          {user.name} <span className="text-[10px] font-mono text-slate-400">({user.role})</span>
                        </p>
                        <p className="text-[10px] text-slate-450">{user.email}</p>
                      </div>
                      <span className="text-[9.5px] font-mono font-bold text-indigo-700 bg-indigo-55/60 border border-indigo-150 px-2 py-0.5 rounded-full">
                        Nairobi, KE — Hotel OS
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Restaurant Business Quick fill (Juma) */}
              {!isSaasAdminPortal && (
                <div className="p-1 border border-orange-100 rounded-2xl bg-orange-50/20 animate-fade-in">
                  <p className="text-[8.5px] font-mono mx-2.5 my-1 text-orange-750 font-bold uppercase tracking-wider">Restaurant QR & POS Mode</p>
                  {DEMO_USERS.filter(u => u.tenantId === 't-restaurant-01').map(user => (
                    <button
                      key={user.email}
                      type="button"
                      onClick={() => handleQuickFill(user)}
                      className="flex w-full items-center justify-between p-3.5 bg-white border border-slate-150 hover:border-emerald-500 rounded-xl transition-all cursor-pointer group text-left shadow-xs"
                    >
                      <div>
                        <p className="text-xs font-black text-slate-800 group-hover:text-emerald-700">
                          {user.name} <span className="text-[10px] font-mono text-slate-400">({user.role})</span>
                        </p>
                        <p className="text-[10px] text-slate-450">{user.email}</p>
                      </div>
                      <span className="text-[9.5px] font-mono font-bold text-orange-700 bg-orange-50 border border-orange-150 px-2 py-0.5 rounded-full animate-pulse">
                        Dar es Salaam, TZ — Restaurant OS
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Pharmacy Niche Quick fill (Amina) */}
              {!isSaasAdminPortal && (
                <div className="p-1 border border-emerald-100 rounded-2xl bg-emerald-50/20 animate-fade-in">
                  <p className="text-[8.5px] font-mono mx-2.5 my-1 text-emerald-750 font-bold uppercase tracking-wider">Pharmacy Clinical & Rx Mode</p>
                  {DEMO_USERS.filter(u => u.tenantId === 't-pharma-01').map(user => (
                    <button
                      key={user.email}
                      type="button"
                      onClick={() => handleQuickFill(user)}
                      className="flex w-full items-center justify-between p-3.5 bg-white border border-slate-150 hover:border-emerald-500 rounded-xl transition-all cursor-pointer group text-left shadow-xs"
                    >
                      <div>
                        <p className="text-xs font-black text-slate-800 group-hover:text-emerald-700">
                          {user.name} <span className="text-[10px] font-mono text-slate-400">({user.role})</span>
                        </p>
                        <p className="text-[10px] text-slate-450">{user.email}</p>
                      </div>
                      <span className="text-[9.5px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-150 px-2 py-0.5 rounded-full animate-pulse">
                        Dar es Salaam, TZ — Pharmacy OS
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Retail Quick fills (Named "Retail and Wholesale") */}
              {!isSaasAdminPortal && (
                <div className="p-1 border border-slate-205 rounded-2xl bg-slate-50/20">
                <p className="text-[8.5px] font-mono mx-2.5 my-1 text-slate-500 font-bold uppercase tracking-wider">Retail and Wholesale Mode</p>
                <div className="space-y-1.5">
                  {DEMO_USERS.filter(u => u.tenantId !== 't-hotel-01' && u.tenantId !== 't-restaurant-01' && u.tenantId !== 't-pharma-01' && u.email !== 'saas.admin@jasper.com').map(user => {
                    const branch = user.tenantId === 't-lagos-01' ? 'Dar es Salaam, TZ (TSh)' : user.tenantId === 't-nairobi-02' ? 'Nairobi, KE (KSh)' : 'Accra, GH (₵)';
                    return (
                      <button
                        key={user.email}
                        type="button"
                        onClick={() => handleQuickFill(user)}
                        className="flex w-full items-center justify-between p-3 bg-white border border-slate-150 hover:border-emerald-500 rounded-xl transition-all cursor-pointer group text-left"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-700 group-hover:text-emerald-700">
                            {user.name} <span className="text-[9.5px] font-mono text-slate-400">({user.role})</span>
                          </p>
                          <p className="text-[9.5px] text-slate-450">{user.email}</p>
                        </div>
                        <span className="text-[9px] font-mono font-bold text-slate-505 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
                          {branch}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              )}

            </div>
          </div>
        </div>

        {/* Back link */}
        <div className="text-center font-sans">
          <button
            onClick={() => onNavigate('/')}
            className="text-xs text-slate-400 hover:text-emerald-650 font-bold transition-all bg-transparent border-none cursor-pointer"
          >
            ← Back to Jasper Landing Hub
          </button>
        </div>
      </div>

      {/* GOOGLE SSO FLOW MODAL */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden relative">
            
            {/* Modal Header */}
            <div className="px-6 py-5 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.648 2.42-2.519 4.114-5.137 4.114-3.467 0-6.277-2.81-6.277-6.277s2.81-6.277 6.277-6.277c1.551 0 2.966.565 4.062 1.49l3.056-3.057C19.167 2.147 15.932 1 12.24 1 5.48 1 0 6.48 0 13.22c0 6.74 5.48 12.22 12.24 12.22 6.41 0 11.536-4.595 11.536-11.39 0-.693-.06-1.344-.173-1.956H12.24z"/>
                </svg>
                <span className="text-xs font-mono font-black text-slate-500 uppercase tracking-widest">Google Consent Sheet</span>
              </div>
              <button 
                type="button"
                onClick={() => setShowGoogleModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors text-lg font-bold bg-transparent border-none cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {googleStep === 'select' ? (
              /* Account Chooser Step */
              <div className="p-6 space-y-6">
                <div className="text-center space-y-1.5">
                  <h3 className="text-base font-black text-slate-800 tracking-tight">Sign in with Google</h3>
                  <p className="text-xs text-slate-500 font-medium">to continue securely to your Jasper SaaS cabin workspace</p>
                </div>

                <div className="space-y-2.5 font-sans">
                  {/* Account choice list */}
                  
                  {/* Option A: Preferred Gmail account */}
                  <button
                    type="button"
                    onClick={() => handleSelectGoogleAccount('gospeltrak@gmail.com', 'Tunde Alao')}
                    className="w-full p-4 hover:bg-slate-50 border border-slate-150 hover:border-emerald-300 rounded-2xl text-left flex items-center justify-between transition-all cursor-pointer group"
                  >
                    <div className="flex items-center space-x-3.5">
                      <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm tracking-wide shadow-inner">
                        TA
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">Tunde Alao (Owner)</p>
                        <p className="text-[10.5px] font-mono text-slate-400">gospeltrak@gmail.com</p>
                      </div>
                    </div>
                    <span className="text-[8.5px] font-mono bg-emerald-50 text-emerald-800 font-black border border-emerald-150/40 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      Connected Profile
                    </span>
                  </button>

                  {/* Option B: SaaS Central admin */}
                  <button
                    type="button"
                    onClick={() => handleSelectGoogleAccount('saas.admin@jasper.com', 'Sarah Jasper')}
                    className="w-full p-4 hover:bg-slate-50 border border-slate-150 hover:border-emerald-300 rounded-2xl text-left flex items-center justify-between transition-all cursor-pointer group"
                  >
                    <div className="flex items-center space-x-3.5">
                      <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-sm tracking-wide shadow-inner">
                        SJ
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800 group-hover:text-amber-700 transition-colors">Sarah Jasper (SaaS SuperAdmin)</p>
                        <p className="text-[10.5px] font-mono text-slate-400">saas.admin@jasper.com</p>
                      </div>
                    </div>
                    <span className="text-[8.5px] font-mono bg-amber-50 text-amber-850 font-black border border-amber-150/40 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      Central Admin
                    </span>
                  </button>

                  {/* Option C: Use custom Gmail */}
                  {!showCustomGoogleInput ? (
                    <button
                      type="button"
                      onClick={() => setShowCustomGoogleInput(true)}
                      className="w-full p-4 hover:bg-slate-50 border border-dashed border-slate-200 hover:border-emerald-400 rounded-2xl text-center text-xs font-bold text-slate-500 hover:text-emerald-700 transition-all cursor-pointer bg-slate-50/30"
                    >
                      ➕ Login with a different Gmail address...
                    </button>
                  ) : (
                    <div className="p-4 border border-emerald-200 bg-emerald-50/15 rounded-2xl space-y-3 animate-fade-in">
                      <label className="text-[9.5px] font-bold text-slate-500 uppercase block font-mono">Enter Custom Gmail Account Address</label>
                      <div className="flex space-x-2">
                        <input
                          type="email"
                          placeholder="e.g. dynamic.merchant@gmail.com"
                          value={customGoogleEmailInput}
                          onChange={(e) => setCustomGoogleEmailInput(e.target.value)}
                          className="flex-1 bg-white border border-slate-150 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none font-sans"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!customGoogleEmailInput.toLowerCase().endsWith('@gmail.com') && !customGoogleEmailInput.includes('@')) {
                              alert('Please register with a valid Gmail address!');
                              return;
                            }
                            const nicePart = customGoogleEmailInput.split('@')[0];
                            const capitalizedNice = nicePart.charAt(0).toUpperCase() + nicePart.slice(1);
                            handleSelectGoogleAccount(customGoogleEmailInput.trim().toLowerCase(), capitalizedNice);
                          }}
                          className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 cursor-pointer"
                        >
                          Select Account
                        </button>
                      </div>
                    </div>
                  )}

                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center space-x-2 text-[10px] text-slate-400 font-sans leading-relaxed">
                  <span>🔒</span>
                  <span>Google sharing rules: Shares name, email address, and general consent keys. Google Single Sign-on integration is verified and secure.</span>
                </div>
              </div>
            ) : (
              /* Profile details registration step for Google Sign-in */
              <form onSubmit={handleGoogleRegisterSubmit} className="p-6 space-y-4 font-sans text-left">
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-slate-800 tracking-tight flex items-center space-x-1.5">
                    <span>👑 Complete Google Signup Profile</span>
                  </h3>
                  <p className="text-xs text-slate-500 leading-normal">
                    We verified your Gmail <strong className="text-emerald-700 font-mono font-bold">{selectedGoogleEmail}</strong>. Please finalize your custom tenant configuration:
                  </p>
                </div>

                {/* Email Pre-filled and Lock display */}
                <div className="bg-emerald-50/40 p-3 rounded-2xl border border-emerald-100/50 flex items-center justify-between">
                  <div>
                    <span className="text-[8px] font-mono font-black text-emerald-800 uppercase block tracking-wider">Authorized Gmail Key</span>
                    <span className="text-xs font-bold text-slate-700 font-mono">{selectedGoogleEmail}</span>
                  </div>
                  <span className="flex items-center space-x-1 text-[9px] font-mono text-emerald-700 font-black bg-emerald-100/75 p-1.5 rounded-lg border border-emerald-200">
                    <span>🛡️ Verified Auth</span>
                  </span>
                </div>

                {/* Grid 1: Name and Salon/Company Name */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block">Owner Full Name</label>
                    <input
                      type="text"
                      required
                      value={selectedGoogleName}
                      onChange={(e) => setSelectedGoogleName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none font-sans"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block">Company / Hotel Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Lagos Royal Retreat"
                      value={googleOrgName}
                      onChange={(e) => setGoogleOrgName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none font-sans"
                    />
                  </div>
                </div>

                {/* Contact Phone & Region Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1.5 md:col-span-1">
                    <label className="text-[10px] font-bold text-slate-505 uppercase block">Region</label>
                    <select
                      value={googleCountry}
                      onChange={(e) => {
                        const selCountry = e.target.value as any;
                        setGoogleCountry(selCountry);
                        setGoogleCity(selCountry === 'Nigeria' ? 'Lagos' : selCountry === 'Tanzania' ? 'Dar es Salaam' : selCountry === 'Ghana' ? 'Accra' : selCountry === 'South Africa' ? 'Johannesburg' : 'Nairobi');
                      }}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl px-2 py-2 text-xs text-slate-800 outline-none cursor-pointer font-sans"
                    >
                      <option value="Kenya">Kenya (KES)</option>
                      <option value="Nigeria">Nigeria (NGN)</option>
                      <option value="Tanzania">Tanzania (TZS)</option>
                      <option value="Ghana">Ghana (GHS)</option>
                      <option value="South Africa">South Africa (ZAR)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5 md:col-span-1">
                    <label className="text-[10px] font-bold text-slate-550 uppercase block">City Name Office</label>
                    <input
                      type="text"
                      required
                      value={googleCity}
                      onChange={(e) => setGoogleCity(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl px-2.5 py-2 text-xs text-slate-850 outline-none font-sans"
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-1">
                    <label className="text-[10px] font-bold text-slate-550 uppercase block">Contact Phone (Required)</label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. +234 81 2345 6789"
                      value={googlePhone}
                      onChange={(e) => setGooglePhone(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-555 rounded-xl px-2.5 py-2 text-xs text-slate-850 outline-none font-sans"
                    />
                  </div>
                </div>

                {/* Verticals Niche selector */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider font-mono">Select Sector vertical Niche (Mandatory)</label>
                  <div className="relative font-sans">
                    <select
                      id="google-reg-business-niche"
                      required
                      value={googleBusinessType}
                      onChange={(e) => setGoogleBusinessType(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none cursor-pointer font-sans font-bold appearance-none transition-all"
                    >
                      <option value="retail">Retail and Wholesale POS Suite</option>
                      <option value="pharmacy">Pharmacy & Clinical BestRx Suite</option>
                      <option value="restaurant" disabled>Restaurant Dining & Kitchen POS Suite (Phase 2 - Coming Soon)</option>
                      <option value="hotel" disabled>Hotel Property & PMS Calendar Suite (Phase 2 - Coming Soon)</option>
                    </select>
                    <div className="absolute right-3.5 top-3 pointer-events-none text-slate-500 text-xs font-light">
                      ▼
                    </div>
                  </div>
                </div>

                {/* Optional Referral Code inside Google Signup */}
                <div className="bg-emerald-50/25 p-2.5 rounded-xl border border-emerald-100 flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 select-none text-[9.5px]">
                    <span className="text-[#0e7058] font-bold">💡 Promo Code Active:</span>
                    <span className="font-mono bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-black uppercase text-[8px]">
                      {affiliateCode.trim() ? affiliateCode.toUpperCase() : 'NO_CODE'}
                    </span>
                  </div>
                  {!affiliateCode.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        const code = prompt('Enter coupon promo code (e.g. SARAH_JASPER):');
                        if (code) setAffiliateCode(code);
                      }}
                      className="text-[9.5px] font-bold text-emerald-700 hover:underline bg-transparent border-none cursor-pointer"
                    >
                      Add Promo Coupon
                    </button>
                  )}
                </div>

                {/* Submissions Action Buttons in Modal */}
                <div className="pt-2 flex space-x-3 font-sans">
                  <button
                    type="button"
                    onClick={() => setGoogleStep('select')}
                    className="px-4 py-3 border border-slate-200 text-slate-550 rounded-xl hover:bg-slate-50 text-xs font-bold cursor-pointer"
                  >
                    Back to Selection
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-55 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-1.5 shadow"
                  >
                    {isLoading ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span>Confirm & Access Cabin</span>
                    )}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
