import { useState, FormEvent, useEffect, useRef } from 'react';
import { useTranslation } from '../LanguageContext';
import {
  Store,
  KeyRound,
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
  Globe,
  MessageCircle,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import { DEMO_USERS, DEFAULT_TENANTS } from '../data';
import { User, Tenant } from '../types';
import { getSecureDataBridgeClient, isPlaceholderSecureDataBridgeClient } from '../secureDataBridge';
import { initializeCleanTenantWorkspace } from '../utils/tenantIsolation';
import { startCloudSession } from '../utils/sessionControl';
import { toUserFacingError } from '../utils/safeError';
import { DEFAULT_CUSTOM_ROLES } from '../utils/defaultCustomRoles';
import PrivacyAndTermsModals from './PrivacyAndTermsModals';

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
  } catch {
    console.warn('[auth] Google identity response could not be decoded.');
    return null;
  }
}

const LOGIN_TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    welcome: "Welcome to Orvix",
    welcomeSub: "Run sales, stock, money, and your business in one place",
    signinTab: "Sign In",
    registerTab: "Create Account",
    emailLabel: "Phone Number or Email",
    passLabel: "Password",
    ownerName: "Your Full Name",
    companyName: "Business Name",
    region: "Country or Area",
    city: "City",
    phone: "Phone Number",
    promoCode: "Promo Code (Optional)",
    promoDesc: "A promo code can give you more free trial days.",
    nicheLabel: "Business Type (Required)",
    compileBtn: "Create Account",
    continueGoogle: "Continue with Google",
    googleOr: "OR CREATE AN ACCOUNT WITH GOOGLE",
    googleOrSig: "OR SIGN IN WITH GOOGLE",
    demoProfiles: "TEST ACCOUNTS",
    adminPortal: "System Admin",
    backHome: "Back to Orvix Home",
    selectNicheMsg: "Please choose your business type.",
    successReg: "Your business, \"{orgName}\", is ready."
  },
  sw: {
    welcome: "Karibu Orvix",
    welcomeSub: "Simamia mauzo, bidhaa, fedha na biashara sehemu moja",
    signinTab: "Ingia",
    registerTab: "Fungua Akaunti",
    emailLabel: "Namba ya Simu au Barua Pepe",
    passLabel: "Nenosiri",
    ownerName: "Jina Lako Kamili",
    companyName: "Jina la Biashara",
    region: "Nchi au Eneo",
    city: "Jiji",
    phone: "Namba ya Simu",
    promoCode: "Kodi ya Ofa (Si Lazima)",
    promoDesc: "Kodi ya ofa inaweza kukuongezea siku za majaribio.",
    nicheLabel: "Aina ya Biashara (Lazima)",
    compileBtn: "Fungua Akaunti",
    continueGoogle: "Endelea na Google",
    googleOr: "AU SAJILI KWA BOFYA MOJA YA GOOGLE",
    googleOrSig: "AU INGIA KWA BONGO MOJA YA GOOGLE",
    demoProfiles: "AKAUNTI ZA MAJARIBIO",
    adminPortal: "Msimamizi wa Mfumo",
    backHome: "Rudi Mwanzo",
    selectNicheMsg: "Tafadhali chagua aina ya biashara.",
    successReg: "Biashara yako, \"{orgName}\", iko tayari."
  },
  ar: {
    welcome: "مرحباً بكم في جاسبر إنتربرايز سويت",
    welcomeSub: "توحيد نقاط البيع، وإدارة الفنادق والقنوات متعددة المستأجرين",
    signinTab: "تسجيل الدخول للحساب",
    registerTab: "تسجيل عمل تجاري جديد",
    emailLabel: "معرّف الحساب",
    passLabel: "رمز المرور السري للمالك",
    ownerName: "الاسم الكامل للمالك",
    companyName: "اسم الشركة / الفندق",
    region: "منطقة العمليات",
    city: "اسم مدينة المكتب",
    phone: "رقم الهاتف",
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
    welcome: "Bienvenue sur Orvix",
    welcomeSub: "Gérez les ventes, le stock, l'argent et votre entreprise au même endroit",
    signinTab: "Connexion",
    registerTab: "Créer un Compte",
    emailLabel: "Téléphone ou E-mail",
    passLabel: "Mot de Passe",
    ownerName: "Votre Nom Complet",
    companyName: "Nom de l'Entreprise",
    region: "Pays ou Région",
    city: "Ville",
    phone: "Numéro de téléphone",
    promoCode: "Code Promo (Facultatif)",
    promoDesc: "Un code promo peut ajouter des jours d'essai gratuit.",
    nicheLabel: "Type d'Entreprise (Obligatoire)",
    compileBtn: "Créer le Compte",
    continueGoogle: "Continuer avec Google",
    googleOr: "OU S'INSCRIRE EN UN CLIC AVEC GOOGLE",
    googleOrSig: "OU SE CONNECTER EN UN CLIC AVEC GOOGLE",
    demoProfiles: "COMPTES DE TEST",
    adminPortal: "Administrateur du Système",
    backHome: "Retour à l'Accueil",
    selectNicheMsg: "Choisissez votre type d'entreprise.",
    successReg: "Votre entreprise, \"{orgName}\", est prête."
  }
};

interface LoginPageProps {
  onLogin: (user: User) => void;
  onNavigate: (route: string) => void;
  redirectMessage?: string;
  isDark?: boolean;
  onToggleTheme?: () => void;
  isSaasAdminPortal?: boolean;
  resolvedTenant?: Tenant | null;
  domainMode?: 'root' | 'app' | 'tenant';
  landingUrl?: string;
}

export default function LoginPage({ onLogin, onNavigate, redirectMessage, isDark = false, onToggleTheme, isSaasAdminPortal, resolvedTenant, domainMode = 'root', landingUrl }: LoginPageProps) {
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
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasActiveLoginAttempt, setHasActiveLoginAttempt] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginOtpMode, setLoginOtpMode] = useState(false);
  const [loginOtp, setLoginOtp] = useState('');
  const [loginOtpInput, setLoginOtpInput] = useState('');
  const [loginOtpUser, setLoginOtpUser] = useState<any | null>(null);
  const [loginOtpMessage, setLoginOtpMessage] = useState<string | null>(null);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryIdentifier, setRecoveryIdentifier] = useState('');
  const [recoveryWhatsapp, setRecoveryWhatsapp] = useState('');
  const [recoveryOtp, setRecoveryOtp] = useState('');
  const [recoveryInputOtp, setRecoveryInputOtp] = useState('');
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');
  const [recoverySecurityAnswer, setRecoverySecurityAnswer] = useState('');
  const [recoveryUser, setRecoveryUser] = useState<any | null>(null);
  const [recoveryStep, setRecoveryStep] = useState<'identify' | 'security' | 'verify'>('identify');
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);

  // Registration Form States
  const [ownerName, setOwnerName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regSecurityQuestion, setRegSecurityQuestion] = useState('');
  const [regSecurityAnswer, setRegSecurityAnswer] = useState('');
  const [orgName, setOrgName] = useState('');
  const [businessType, setBusinessType] = useState<string>('Retail');
  const [country, setCountry] = useState<'Nigeria' | 'Kenya' | 'Ghana' | 'South Africa' | 'Tanzania'>('Tanzania');
  const [city, setCity] = useState('Dar es Salaam');
  const [affiliateCode, setAffiliateCode] = useState(() => {
    // Check if affiliate is stored in URL params as ?ref=CODE or ?promo=CODE
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('ref') || urlParams.get('promo') || '';
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [acceptedTenantLegal, setAcceptedTenantLegal] = useState(false);
  const [tenantLegalModalType, setTenantLegalModalType] = useState<'privacy' | 'terms' | null>(null);

  // Tenant Workspace Onboarding States
  const [onboardingUser, setOnboardingUser] = useState<User | null>(null);
  const [onboardingBusinessName, setOnboardingBusinessName] = useState('');
  const [onboardingBusinessType, setOnboardingBusinessType] = useState('Retail');
  const [onboardingCity, setOnboardingCity] = useState('Dar es Salaam');

  const [loginScreenLogoUrl, setLoginScreenLogoUrl] = useState<string | null>(null);
  const tenantLogoFromContext = (resolvedTenant?.company_settings as any)?.logo_url || (resolvedTenant?.company_settings as any)?.logoUrl || null;
  const tenantLoginTitle = resolvedTenant?.name || (domainMode === 'tenant' ? 'Business Login' : 'Orvix');
  const isTenantDomainLogin = domainMode === 'tenant' && !!resolvedTenant?.id;
  const handleBackToLandingHub = () => {
    if (landingUrl) {
      const targetUrl = new URL(landingUrl, window.location.origin);
      if (targetUrl.origin !== window.location.origin) {
        window.location.assign(targetUrl.toString());
        return;
      }
      onNavigate(targetUrl.pathname || '/');
      return;
    }
    onNavigate('/');
  };

  // SaaS Dynamic Niche Launch State
  const [launchedNiches, setLaunchedNiches] = useState<string[]>(() => {
    const raw = onlineStorage.getItem('saas_launched_niches');
    return raw ? JSON.parse(raw) : ['retail', 'pharmacy']; // Matches the user's wish: retail & pharmacy active first!
  });

  useEffect(() => {
    if (tenantLogoFromContext) {
      setLoginScreenLogoUrl(tenantLogoFromContext);
    } else {
      // Fetch tenant logo by domain on load
      const domain = window.location.hostname;
      fetch(`/api/tenant/logo-by-domain?domain=${encodeURIComponent(domain)}`)
        .then(res => {
          const contentType = res.headers.get('content-type') || '';
          if (!res.ok || !contentType.includes('application/json')) return null;
          return res.json();
        })
        .then(data => {
          if (data && data.logoUrl) {
            setLoginScreenLogoUrl(data.logoUrl);
          }
        })
        .catch(() => undefined);
    }

    const handleUpdate = () => {
      const raw = onlineStorage.getItem('saas_launched_niches');
      if (raw) setLaunchedNiches(JSON.parse(raw));
    };
    window.addEventListener('saas_niches_updated', handleUpdate);

    // Check for params in URL on load
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('ref') || urlParams.get('promo');
    if (code) {
      setAffiliateCode(code);
      setAuthTab(isTenantDomainLogin ? 'signin' : 'register');
    } else if (urlParams.get('register') === 'true') {
      setAuthTab(isTenantDomainLogin ? 'signin' : 'register');
    } else if (isTenantDomainLogin) {
      setAuthTab('signin');
    }

    return () => window.removeEventListener('saas_niches_updated', handleUpdate);
  }, [tenantLogoFromContext, isTenantDomainLogin]);

  useEffect(() => {
    const clearTransientLoginError = () => {
      setHasActiveLoginAttempt(false);
      setError((current) => current?.startsWith('Invalid credentials') ? null : current);
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) clearTransientLoginError();
    };

    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('beforeunload', clearTransientLoginError);
    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('beforeunload', clearTransientLoginError);
    };
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
  const { lang: currentLang, setLang: setCurrentLang, t: tContext } = useTranslation();

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
                setError(toUserFacingError(
                  { status: 401 },
                  { language: currentLang, context: 'sign_in', fallbackCode: 'AUTH_ERROR' },
                ).message);
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
    const customUsers = JSON.parse(onlineStorage.getItem('jasper_custom_users') || '[]');
    const saasStaffs = JSON.parse(onlineStorage.getItem('jasper_saas_staffs') || '[]');
    const passwordOverrides = JSON.parse(onlineStorage.getItem('jasper_password_overrides') || '{}');
    const withPasswordOverride = (user: any) => {
      const overrideKey = user.email || user.phone || user.id;
      return overrideKey && passwordOverrides[overrideKey]
        ? { ...user, password: passwordOverrides[overrideKey] }
        : user;
    };
    const systemUsers = [...DEMO_USERS, ...customUsers, ...saasStaffs].map(withPasswordOverride);
    const resolveStaffPermissions = (settings: any, roleName: string) => {
      const roles = settings.customRoles?.length ? settings.customRoles : DEFAULT_CUSTOM_ROLES;
      const normalizedRole = (roleName || '').toLowerCase();
      const roleKey = normalizedRole === 'waiter' ? 'seller' : normalizedRole;
      return roles.find((role: any) => role.name.toLowerCase() === roleKey)?.permissions || {};
    };

    // Scan all cached tenants settings for staffs
    for (let i = 0; i < onlineStorage.length; i++) {
        const key = onlineStorage.key(i);
        if (key && key.startsWith('jasper_settings_')) {
          const tenantId = key.replace('jasper_settings_', '');
          try {
            const settings = JSON.parse(onlineStorage.getItem(key) || '{}');
            if (settings.staffs && Array.isArray(settings.staffs)) {
              settings.staffs.forEach((staff: any) => {
                 const staffRole = staff.role || 'Cashier';
                 systemUsers.push(withPasswordOverride({
                   id: staff.id,
                   email: staff.phone || staff.name.toLowerCase().replace(' ', '') + '@jasper.com',
                   phone: staff.phone || '',
                   password: staff.password || 'password123',
                   name: staff.name,
                   role: staffRole,
                   tenantId: tenantId,
                   activeTenant: tenantId,
                   profileImage: staff.profileImage,
                   isSaaSStaff: true,
                   rolePermissions: resolveStaffPermissions(settings, staffRole)
                 }));
              });
            }
          } catch(e) {}
        }
    }
    return systemUsers;
  };

  const getPhoneDigits = (phone: string) => (phone || '').replace(/\D/g, '');

  const normalizePhoneForWhatsapp = (phone: string) => {
    let digits = getPhoneDigits(phone);
    if (!digits) return '';
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith('2550')) return `255${digits.slice(4)}`;
    if (digits.startsWith('0')) return `255${digits.slice(1)}`;
    if (digits.length === 9 && /^[67]/.test(digits)) return `255${digits}`;
    return digits;
  };

  const makeInternalEmailCandidatesFromPhone = (phone: string) => {
    const digits = getPhoneDigits(phone);
    const normalized = normalizePhoneForWhatsapp(phone);
    const candidates = new Set<string>();

    if (normalized) candidates.add(normalized);
    if (digits) {
      candidates.add(digits);
      if (digits.startsWith('0')) candidates.add(`255${digits.slice(1)}`);
      if (digits.startsWith('2550')) candidates.add(`255${digits.slice(4)}`);
      if (digits.startsWith('255') && digits.length > 3) candidates.add(`0${digits.slice(3)}`);
      if (digits.length === 9 && /^[67]/.test(digits)) candidates.add(`255${digits}`);
    }

    return Array.from(candidates)
      .filter(Boolean)
      .map(value => `wa${value}@whatsapp.jasper.local`);
  };

  const sameLoginIdentifier = (valueA?: string, valueB?: string) => {
    const a = (valueA || '').trim();
    const b = (valueB || '').trim();
    if (!a || !b) return false;
    if (a.toLowerCase() === b.toLowerCase()) return true;
    const phoneA = normalizePhoneForWhatsapp(a);
    const phoneB = normalizePhoneForWhatsapp(b);
    return !!phoneA && !!phoneB && phoneA === phoneB;
  };

  const makeInternalEmailFromPhone = (phone: string) => {
    return makeInternalEmailCandidatesFromPhone(phone)[0] || '';
  };

  const makeInternalEmailFromBusiness = (businessName: string, owner: string) => {
    const base = `${businessName || owner || 'owner'}-${Date.now()}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'owner';
    return `${base}@signup.jasper.local`;
  };

  const isOwnerRecoveryRole = (role?: string) => {
    const normalized = (role || '').toLowerCase();
    return ['admin', 'manager', 'superadmin', 'owner'].some(r => normalized.includes(r));
  };

  const normalizeSecurityAnswer = (answer: string) =>
    answer.trim().toLowerCase().replace(/\s+/g, ' ');

  const handleStartRecovery = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setRecoveryMessage(null);

    const identifier = recoveryIdentifier.trim() || email.trim();
    if (!identifier) {
      setRecoveryMessage('Enter your WhatsApp number first.');
      return;
    }

    const found = getAllSystemUsers().find((u: any) =>
      sameLoginIdentifier(u.phone, identifier) || sameLoginIdentifier(u.email, identifier)
    );

    if (!found) {
      setRecoveryMessage('No account found with that WhatsApp number.');
      return;
    }

    if (!isOwnerRecoveryRole(found.role)) {
      setRecoveryMessage('Staff password reset is handled by the business admin in Staff Members.');
      return;
    }

    if (!found.securityQuestion || !found.securityAnswer) {
      setRecoveryMessage('Sorry, we could not verify that it was you. If you are confident it is you, please contact Orvix support.');
      return;
    }

    setRecoveryUser(found);
    setRecoveryWhatsapp(normalizePhoneForWhatsapp(found.phone || identifier));
    setRecoverySecurityAnswer('');
    setRecoveryStep('security');
    setRecoveryMessage(null);
  };

  const handleVerifyRecoverySecurity = (e: FormEvent) => {
    e.preventDefault();
    setRecoveryMessage(null);

    if (!recoveryUser) {
      setRecoveryStep('identify');
      setRecoveryMessage('Start the reset again.');
      return;
    }

    if (normalizeSecurityAnswer(recoverySecurityAnswer) !== normalizeSecurityAnswer(recoveryUser.securityAnswer || '')) {
      setRecoveryMessage('Sorry, we could not verify that it was you. If you are confident it is you, please contact Orvix support.');
      return;
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const whatsappNumber = normalizePhoneForWhatsapp(recoveryWhatsapp || recoveryUser.phone || recoveryIdentifier);
    if (!whatsappNumber) {
      setRecoveryMessage('Enter the owner/admin WhatsApp number to receive OTP.');
      return;
    }
    setRecoveryOtp(otp);
    setRecoveryWhatsapp(whatsappNumber);
    setRecoveryStep('verify');
    setRecoveryMessage('Security answer verified. OTP prepared. Send it to the owner/admin WhatsApp, then enter it here.');

    const message = `Orvix password reset OTP: ${otp}. Use this code to reset your admin account password. If you did not request this, please ignore it.`;
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  const persistRecoveredPassword = (user: any, newPassword: string) => {
    const updateList = (key: string) => {
      const list = JSON.parse(onlineStorage.getItem(key) || '[]');
      const updated = list.map((entry: any) => {
        const sameUser = (entry.email && user.email && entry.email === user.email) || (entry.id && user.id && entry.id === user.id) || (entry.phone && user.phone && entry.phone === user.phone);
        return sameUser ? { ...entry, password: newPassword } : entry;
      });
      onlineStorage.setItem(key, JSON.stringify(updated));
    };

    updateList('jasper_custom_users');
    updateList('jasper_saas_staffs');

    if (user.activeTenant || user.tenantId) {
      const settingsKey = `jasper_settings_${user.activeTenant || user.tenantId}`;
      const settings = JSON.parse(onlineStorage.getItem(settingsKey) || '{}');
      if (Array.isArray(settings.staffs)) {
        settings.staffs = settings.staffs.map((staff: any) => {
          const sameStaff = (staff.id && user.id && staff.id === user.id) || (staff.phone && user.phone && staff.phone === user.phone);
          return sameStaff ? { ...staff, password: newPassword } : staff;
        });
        onlineStorage.setItem(settingsKey, JSON.stringify(settings));
      }
    }

    const overrides = JSON.parse(onlineStorage.getItem('jasper_password_overrides') || '{}');
    if (user.email) overrides[user.email] = newPassword;
    if (user.phone) overrides[user.phone] = newPassword;
    if (user.id) overrides[user.id] = newPassword;
    onlineStorage.setItem('jasper_password_overrides', JSON.stringify(overrides));
  };

  const handleFinishRecovery = (e: FormEvent) => {
    e.preventDefault();
    setRecoveryMessage(null);

    if (!recoveryUser || !recoveryOtp) {
      setRecoveryStep('identify');
      setRecoveryMessage('Start the reset again.');
      return;
    }

    if (recoveryInputOtp.trim() !== recoveryOtp) {
      setRecoveryMessage('Wrong OTP. Check WhatsApp and try again.');
      return;
    }

    if (recoveryNewPassword.trim().length < 4) {
      setRecoveryMessage('New password must have at least 4 characters.');
      return;
    }

    persistRecoveredPassword(recoveryUser, recoveryNewPassword.trim());
    setEmail(recoveryUser.phone || recoveryUser.email || '');
    setPassword(recoveryNewPassword.trim());
    setEmailChecked(true);
    setShowRecovery(false);
    setRecoveryStep('identify');
    setRecoveryIdentifier('');
    setRecoveryWhatsapp('');
    setRecoveryOtp('');
    setRecoveryInputOtp('');
    setRecoveryNewPassword('');
    setRecoverySecurityAnswer('');
    setRecoveryUser(null);
    setSuccessMessage('Password reset successfully. You can sign in now.');
  };

  const handleCheckEmail = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError('Please enter your WhatsApp number to proceed.');
      return;
    }

    // Do not query a public account directory before authentication. It leaks
    // account existence and blocks real database-only users such as Super Admin.
    setEmailChecked(true);
  };

  const handleOnboardingSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!onboardingUser) return;
    if (!onboardingBusinessName.trim()) {
      setError('Please enter your business name.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const client: any = await getSecureDataBridgeClient();

      // Create a brand new tenant row in the public table
      const { data: newTenant, error: tenantError } = await client
        .from('tenants')
        .insert({
          name: onboardingBusinessName,
          country: country || 'Tanzania',
          city: onboardingCity || 'Dar es Salaam',
          currency: 'Tanzanian Shilling',
          currency_code: 'TZS',
          tax_rate: 0.18,
          mobile_money_providers: [],
          business_type: onboardingBusinessType,
          company_settings: { logo_url: null, theme: 'default' },
          business_settings: { allow_negative_stock: false, default_unit: 'pcs' },
          invoice_settings: { show_tax: true, footer_note: 'Thank you for your business' }
        })
        .select()
        .single();

      if (tenantError) {
        throw tenantError;
      }

      if (!newTenant) {
        throw new Error('Tenant provisioning failed: no database row returned.');
      }

      // Record profile user row matching this auth id linked to their new tenant
      const { error: userError } = await client
        .from('users')
        .upsert({
          id: onboardingUser.id,
          email: onboardingUser.email,
          name: onboardingUser.name,
          role: 'Admin',
          tenant_id: newTenant.id,
          active_tenant: newTenant.id,
          phone: onboardingUser.phone || null,
          is_duress: false,
          is_saas_staff: false
        });

      if (userError) {
        throw userError;
      }

      const updatedUser: User = {
        ...onboardingUser,
        tenantId: newTenant.id,
        activeTenant: newTenant.id,
        role: 'Admin'
      };

      // Store locally so cached components load instantly
      const savedCustomTenants = JSON.parse(onlineStorage.getItem('jasper_custom_tenants') || '[]');
      onlineStorage.setItem('jasper_custom_tenants', JSON.stringify([...savedCustomTenants, newTenant]));

      const savedCustomUsers = JSON.parse(onlineStorage.getItem('jasper_custom_users') || '[]');
      onlineStorage.setItem('jasper_custom_users', JSON.stringify([...savedCustomUsers, updatedUser]));

      setIsLoading(false);
      setOnboardingUser(null);
      setSuccessMessage(`Workspace "${onboardingBusinessName}" provisioned successfully.`);
      triggerOnLoginWithSplash(updatedUser);

    } catch (err: any) {
      console.error('[Onboarding Flow Error]:', err);
      // Fallback local onboarding matching live flow
      const newTenantId = 't-dyn-' + Math.floor(100 + Math.random() * 900);
      const fallbackTenant: Tenant = {
        id: newTenantId,
        name: onboardingBusinessName,
        country: country || 'Tanzania',
        city: onboardingCity || 'Dar es Salaam',
        currency: 'TSh',
        currencyCode: 'TZS',
        taxRate: 0.18,
        mobileMoneyProviders: [],
        businessType: 'retail'
      };

      const updatedUser: User = {
        ...onboardingUser,
        tenantId: newTenantId,
        activeTenant: newTenantId,
        role: 'Admin'
      };

      const savedCustomTenants = JSON.parse(onlineStorage.getItem('jasper_custom_tenants') || '[]');
      onlineStorage.setItem('jasper_custom_tenants', JSON.stringify([...savedCustomTenants, fallbackTenant]));

      const savedCustomUsers = JSON.parse(onlineStorage.getItem('jasper_custom_users') || '[]');
      onlineStorage.setItem('jasper_custom_users', JSON.stringify([...savedCustomUsers, updatedUser]));

      setIsLoading(false);
      setOnboardingUser(null);
      setSuccessMessage(`Workspace "${onboardingBusinessName}" provisioned successfully. (Offline fallback mode)`);
      triggerOnLoginWithSplash(updatedUser);
    }
  };

  const triggerOnLoginWithSplash = (userPayload: any) => {
    const tenantId = userPayload.activeTenant || userPayload.tenantId;

    if (!tenantId) {
      // Intercept and open the workspace onboarding flow immediately
      setOnboardingUser(userPayload);
      setIsLoading(false);
      return;
    }

    setIsLoading(false); // Stop any form loading spinners

    // Start presence tracking for this tenant user (fire-and-forget)
    import('../utils/userPresence').then(({ startPresenceTracking }) => {
      startPresenceTracking(
        userPayload.id || userPayload.tenantId || 'tenant-unknown',
        'tenant',
        userPayload.name || 'Tenant'
      );
    }).catch(() => { /* non-critical */ });

    // Authentication and the cloud session are already complete at this point.
    // Hand control to App immediately so the protected route cannot remain on
    // the login page while a cosmetic welcome timer is pending. App owns the
    // dashboard splash screen after navigation.
    onLogin(userPayload);
  };

  const handleLoginSubmit = (e: FormEvent) => {
    e.preventDefault();
    setHasActiveLoginAttempt(true);
    if (!emailChecked) {
      handleCheckEmail(e);
    } else if (loginOtpMode) {
      triggerOtpLogin();
    } else {
      triggerLogin(email, password);
    }
  };

  const handleSendLoginOtp = () => {
    setLoginOtpMessage(null);
    setError(null);

    const user = getAllSystemUsers().find((u: any) =>
      sameLoginIdentifier(u.phone, email) || sameLoginIdentifier(u.email, email)
    );

    if (!user) {
      setLoginOtpMessage('No account found for this WhatsApp number.');
      return;
    }

    const whatsappNumber = normalizePhoneForWhatsapp(user.phone || email);
    if (!whatsappNumber) {
      setLoginOtpMessage('This account has no WhatsApp number. Ask admin to update the phone number.');
      return;
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    setLoginOtp(otp);
    setLoginOtpUser(user);
    setLoginOtpInput('');
    setLoginOtpMode(true);
    setPassword('');
    setLoginOtpMessage('OTP prepared. Send it through WhatsApp, then enter it here.');

    const message = `Orvix login OTP: ${otp}. Use this code to sign in. If you did not request this, please ignore it.`;
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  const triggerOtpLogin = () => {
    setError(null);
    if (!loginOtpUser || !loginOtp) {
      setLoginOtpMode(false);
      setLoginOtpMessage('Request a new WhatsApp OTP.');
      return;
    }

    if (loginOtpInput.trim() !== loginOtp) {
      setLoginOtpMessage('Wrong OTP. Check WhatsApp and try again.');
      return;
    }

    setIsLoading(true);
    triggerOnLoginWithSplash({
      id: loginOtpUser.id || 'u-' + Math.random().toString(36).substr(2, 9),
      email: loginOtpUser.email,
      name: loginOtpUser.name,
      role: loginOtpUser.role as any,
      tenantId: loginOtpUser.tenantId,
      activeTenant: loginOtpUser.activeTenant,
      profileImage: loginOtpUser.profileImage,
      phone: loginOtpUser.phone,
      trial_start_date: loginOtpUser.trial_start_date || new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      trial_end_date: loginOtpUser.trial_end_date || new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      is_affiliate_lead: loginOtpUser.is_affiliate_lead || false,
      referral_code_used: loginOtpUser.referral_code_used || ''
    });
  };

  const triggerLogin = async (targetIdentifier: string, targetPass: string) => {
    setIsLoading(true);
    setError(null);
    const cleanIdentifier = String(targetIdentifier || '').trim();
    const cleanPassword = String(targetPass || '').trim();
    let loginFailure: unknown = { status: 401 };

    try {
      const client: any = await getSecureDataBridgeClient();
      if (isPlaceholderSecureDataBridgeClient(client)) {
        setError(toUserFacingError(
          { status: 503 },
          { language: currentLang, context: 'sign_in', fallbackCode: 'LOAD_ERROR' },
        ).message);
        setIsLoading(false);
        return;
      }
      let resolvedPhoneEmail = '';
      if (!cleanIdentifier.includes('@')) {
        try {
          const lookupController = new AbortController();
          const lookupTimeout = window.setTimeout(() => lookupController.abort(), 2500);
          const lookupRes = await fetch('/api/auth/lookup-phone', {
            method: 'POST',
            cache: 'no-store',
            headers: {
              'Content-Type': 'application/json',
              'X-Jasper-Language': currentLang,
            },
            body: JSON.stringify({ phone: cleanIdentifier }),
            signal: lookupController.signal,
          });
          window.clearTimeout(lookupTimeout);
          const lookupPayload = await lookupRes.json().catch(() => ({}));
          resolvedPhoneEmail = lookupRes.ok ? String(lookupPayload?.email || '').trim().toLowerCase() : '';
        } catch (_) { /* synthetic staff/legacy candidates remain available below */ }
      }
      // One deliberate Auth request per login attempt. Phone lookup is the
      // authoritative resolver; if it is unavailable, use only the canonical
      // legacy address instead of trying every historical phone format.
      const authEmail = cleanIdentifier.includes('@')
        ? cleanIdentifier.toLowerCase()
        : resolvedPhoneEmail || makeInternalEmailFromPhone(cleanIdentifier) || cleanIdentifier.toLowerCase();

      // Perform authentic database-backed authentication securely
      // Supabase's auth fetch can remain pending during a regional/network
      // incident. Bound every attempt so the login button always recovers and
      // the legacy/test-account fallback can run instead of spinning forever.
      const signInWithTimeout = async (candidateEmail: string, timeoutMs = 4500): Promise<any> => {
        let timeoutId: number | undefined;
        try {
          return await Promise.race([
            client.auth.signInWithPassword({
              email: candidateEmail,
              password: cleanPassword
            }),
            new Promise(resolve => {
              timeoutId = window.setTimeout(() => resolve({
                data: null,
                error: new Error('Secure sign-in timed out. Please try again.')
              }), timeoutMs);
            })
          ]);
        } finally {
          if (timeoutId !== undefined) window.clearTimeout(timeoutId);
        }
      };
      let authData: any = null;
      let authError: any = null;
      let matchedAuthEmail = authEmail;
      ({ data: authData, error: authError } = await signInWithTimeout(authEmail));
      loginFailure = authError || loginFailure;

      // Tenant staff created inside workspace settings do not have an Auth row
      // until their first successful login. Ask the backend to validate and
      // provision that account, then continue through the normal Supabase path.
      const secureAuthTimedOut = String(authError?.message || '').toLowerCase().includes('timed out');
      const secureAuthStatus = Number(authError?.status || authError?.statusCode || 0);
      const secureAuthUnavailable = secureAuthTimedOut || secureAuthStatus >= 500;
      if (authError && !secureAuthUnavailable && !cleanIdentifier.includes('@')) {
        const staffLoginController = new AbortController();
        const staffLoginTimeout = window.setTimeout(() => staffLoginController.abort(), 6000);
        try {
          const staffLoginResponse = await fetch('/api/auth/register?mode=staff-login', {
            method: 'POST',
            cache: 'no-store',
            headers: {
              'Content-Type': 'application/json',
              'X-Jasper-Language': currentLang,
            },
            body: JSON.stringify({ phone: cleanIdentifier, password: cleanPassword }),
            signal: staffLoginController.signal
          });
          const staffLoginPayload = await staffLoginResponse.json().catch(() => ({}));
          if (staffLoginResponse.ok && staffLoginPayload?.email) {
            const retry = await signInWithTimeout(staffLoginPayload.email);
            if (!retry.error && retry.data?.user) {
              authData = retry.data;
              authError = null;
              matchedAuthEmail = staffLoginPayload.email;
            }
          }
        } catch (_) { /* continue to generic invalid-login response */ }
        finally {
          window.clearTimeout(staffLoginTimeout);
        }
      }

      if (!authError && authData?.user) {
        // Password is verified. Load the matching profile through the trusted
        // backend first so a slow RLS/browser request cannot leave login loading.
        let userProfile: any = null;
        let profileError: any = null;
        let profileFallbackAllowed = false;
        try {
          const controller = new AbortController();
          const timeoutId = window.setTimeout(() => controller.abort(), 8000);
          const profileResponse = await fetch('/api/auth/profile', {
            cache: 'no-store',
            headers: {
              Authorization: `Bearer ${authData.session?.access_token || ''}`,
              'X-Jasper-Language': currentLang,
            },
            signal: controller.signal
          });
          window.clearTimeout(timeoutId);
          const profilePayload = await profileResponse.json().catch(() => ({}));
          if (profileResponse.ok) {
            userProfile = profilePayload?.profile || null;
          } else {
            profileFallbackAllowed = [404, 405, 501].includes(profileResponse.status);
            profileError = {
              ...profilePayload,
              status: profileResponse.status,
            };
          }
        } catch (error) {
          profileError = error;
        }

        // Fallback for static deployments that do not have the profile route.
        // Never double a database request after a timeout or upstream 5xx.
        if (!userProfile && profileFallbackAllowed) {
          try {
            const profileResult: any = await Promise.race([
              client
                .from('users')
                .select('id,email,name,role,role_key,account_type,tenant_id,active_tenant,phone,is_active,is_saas_staff,role_permissions,profile_image_url')
                .eq('id', authData.user.id)
                .single(),
              new Promise((_, reject) => window.setTimeout(() => reject(new Error('Account lookup timed out.')), 8000))
            ]);
            userProfile = profileResult?.data || null;
            profileError = profileResult?.error || null;
          } catch (error) {
            profileError = error;
          }
        }

        const isPlatformAdmin = userProfile?.account_type === 'super_admin' ||
          ['superadmin', 'super_admin'].includes(String(userProfile?.role_key || userProfile?.role || '').toLowerCase());
        const profileTenantId = userProfile?.tenant_id || userProfile?.active_tenant;
        if (isTenantDomainLogin && !isPlatformAdmin && profileTenantId !== resolvedTenant?.id) {
          await client.auth.signOut();
          setError(toUserFacingError(
            { status: 403 },
            { language: currentLang, context: 'sign_in', fallbackCode: 'PERMISSION_ERROR' },
          ).message);
          setIsLoading(false);
          return;
        }
        if (profileError || !userProfile || (!userProfile.tenant_id && !isPlatformAdmin)) {
          // No user profile profile/tenant exists yet. Redirect to onboarding form
          if (isTenantDomainLogin) {
            await client.auth.signOut();
            setError(toUserFacingError(
              { status: 403 },
              { language: currentLang, context: 'sign_in', fallbackCode: 'PERMISSION_ERROR' },
            ).message);
            setIsLoading(false);
            return;
          }
          triggerOnLoginWithSplash({
            id: authData.user.id,
            email: authData.user.email || matchedAuthEmail,
            name: authData.user.user_metadata?.full_name || authData.user.email?.split('@')[0] || 'User',
            role: 'Admin',
            tenantId: null,
            activeTenant: null,
          phone: authData.user.phone || cleanIdentifier || null,
          });
          return;
        }

        // Session tracking — fire and forget, never block login
        startCloudSession(authData.session?.access_token).catch(() => null);

        const profileRolePermissions = userProfile.role_permissions && Object.keys(userProfile.role_permissions).length
          ? userProfile.role_permissions
          : undefined;
        const isBusinessStaff = userProfile.account_type === 'business_staff';
        const staffRoleKey = String(userProfile.role_key || '').trim();
        const effectiveProfileRole = isBusinessStaff && staffRoleKey
          ? staffRoleKey.replace(/(^|[\s_-])([a-z])/g, (_match: string, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`)
          : userProfile.role || 'Admin';
        triggerOnLoginWithSplash({
          id: userProfile.id,
          email: userProfile.email,
          name: userProfile.name,
          role: isPlatformAdmin ? 'SuperAdmin' : effectiveProfileRole,
          tenantId: userProfile.tenant_id || 'platform-control',
          activeTenant: userProfile.active_tenant || userProfile.tenant_id || 'platform-control',
          phone: userProfile.phone || null,
          isSaaSStaff: userProfile.is_saas_staff || false,
          saasPermissions: userProfile.role_permissions || undefined,
          rolePermissions: profileRolePermissions,
          profileImage: userProfile.profile_image_url || undefined,
        });
        return;
      }
    } catch (error) {
      loginFailure = error;
      const safeError = toUserFacingError(error, {
        language: currentLang,
        context: 'sign_in',
        fallbackCode: 'LOAD_ERROR',
      });
      console.warn('[auth] Secure sign-in request did not complete.', safeError.code, safeError.reference || '');
    }

    if (isTenantDomainLogin) {
      setHasActiveLoginAttempt(true);
      setError(toUserFacingError(
        loginFailure,
        { language: currentLang, context: 'sign_in', fallbackCode: 'AUTH_ERROR' },
      ).message);
      setIsLoading(false);
      return;
    }

    // Default Fallback
    setTimeout(() => {
      const combinedUsers = getAllSystemUsers();

      if (sameLoginIdentifier(cleanIdentifier, 'saas.admin@jasper.com') && cleanPassword !== 'password123') {
        onLogin({
          id: 'u-saas-duress',
          email: 'saas.admin@jasper.com',
          name: 'Jasper Controller',
          role: 'SuperAdmin',
          tenantId: 't-lagos-01',
          activeTenant: 't-lagos-01',
          isDuress: true
        });
        return;
      }

      const match = combinedUsers.find(
        (u: any) => (sameLoginIdentifier(u.phone, cleanIdentifier) || sameLoginIdentifier(u.email, cleanIdentifier)) && String(u.password || '').trim() === cleanPassword
      );

      if (match) {
        triggerOnLoginWithSplash({
          id: match.id || 'u-' + Math.random().toString(36).substr(2, 9),
          email: match.email,
          name: match.name,
          role: match.role as any,
          tenantId: match.tenantId,
          activeTenant: match.activeTenant,
          profileImage: match.profileImage,
          phone: match.phone,
          isSaaSStaff: match.isSaaSStaff || false,
          rolePermissions: match.rolePermissions,
          trial_start_date: match.trial_start_date || new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          trial_end_date: match.trial_end_date || new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          is_affiliate_lead: match.is_affiliate_lead || false,
          referral_code_used: match.referral_code_used || ''
        });
      } else {
        setHasActiveLoginAttempt(true);
        setError(toUserFacingError(
          { status: 401 },
          { language: currentLang, context: 'sign_in', fallbackCode: 'AUTH_ERROR' },
        ).message);
        setIsLoading(false);
      }
    }, 600);
  };

  const handleQuickFill = (userObj: typeof DEMO_USERS[0]) => {
    setHasActiveLoginAttempt(true);
    setEmail(userObj.phone || userObj.email);
    setPassword(userObj.password);
    setLoginOtpMode(false);
    setLoginOtp('');
    setLoginOtpInput('');
    setLoginOtpUser(null);
    setEmailChecked(true);
    triggerLogin(userObj.phone || userObj.email, userObj.password);
  };

  const numberValue = (value: unknown): number => Number(value || 0);

  const registerAffiliateReferral = async (code: string, subscriberName: string, tenantId?: string) => {
    const upperCode = code.toUpperCase();

    // ── 1. Update onlineStorage (immediate, offline-safe) ──────────
    const raw = onlineStorage.getItem('saas_immersive_affiliates');
    let affiliates: any[] = [];
    if (raw) {
      try { affiliates = JSON.parse(raw); } catch {}
    }
    const matchIndex = affiliates.findIndex((a: any) => a.promoCode?.toUpperCase() === upperCode);
    const trialPackagePrice = 1500000; // List price only; trial registration is not a payment.
    if (matchIndex !== -1) {
      affiliates[matchIndex].conversionsPromo = (affiliates[matchIndex].conversionsPromo || 0) + 1;
      if (affiliates[matchIndex].parentSuperId) {
        const superId = affiliates[matchIndex].parentSuperId;
        const superIndex = affiliates.findIndex((a: any) => a.id === superId);
        if (superIndex !== -1) {
          affiliates[superIndex].conversionsPromo = (affiliates[superIndex].conversionsPromo || 0) + 1;
        }
      }
      onlineStorage.setItem('saas_immersive_affiliates', JSON.stringify(affiliates));
      window.dispatchEvent(new Event('saas_logs_updated'));
    }

    // ── 2. Save to encrypted database — referred_customers + commission_ledger ──
    try {
      const client: any = await getSecureDataBridgeClient();

      // Find sub-affiliate record in encrypted database
      const { data: subAff } = await client
        .from('affiliates')
        .select('id, display_name, parent_super_agent_id, account_type')
        .ilike('promo_code', upperCode)
        .maybeSingle();

      const subAffiliateId = subAff?.id || (matchIndex !== -1 ? affiliates[matchIndex].id : null);
      const parentSuperAgentId = subAff?.parent_super_agent_id || (matchIndex !== -1 ? affiliates[matchIndex].parentSuperId : null);
      const now = new Date().toISOString();

      // 2a. referred_customers — track which tenant came from which sub-affiliate
      await client.from('referred_customers').insert({
        id: `rc-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
        customer_id: tenantId || null,
        customer_name: subscriberName,
        source_type: parentSuperAgentId ? 'sub_affiliate' : 'organic_affiliate',
        affiliate_id: subAffiliateId,
        sub_affiliate_id: subAffiliateId,
        parent_super_agent_id: parentSuperAgentId || null,
        promo_code_used: upperCode,
        referral_code_used: upperCode,
        package_name: 'Trial',
        package_price: trialPackagePrice,
        amount_paid: 0,
        payment_status: 'pending',
        commission_status: 'pending',
        commission_amount: 0,
        created_at: now,
      });

      // 2b. Keep a zero-value pending audit row. Revenue and commissions are
      // recognized only by the confirmed subscription-payment flow.
      await client.from('commission_ledger').insert({
        id: `cl-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
        customer_id: tenantId || null,
        source_type: parentSuperAgentId ? 'sub_affiliate' : 'organic_affiliate',
        affiliate_id: subAffiliateId,
        sub_affiliate_id: subAffiliateId,
        parent_super_agent_id: parentSuperAgentId || null,
        revenue_amount: 0,
        network_pool_20: 0,
        manager_commission_5: 0,
        sub_affiliate_gross_commission_15: 0,
        withholding_tax_rate: 0.05,
        withholding_tax_amount: 0,
        sub_affiliate_net_payout: 0,
        tin_number_available: false,
        withholding_status: 'not_active',
        status: 'pending',
        currency: 'TZS',
        created_at: now,
      });

      // 2c. A trial is a referral/customer, but it is not revenue.
      if (subAffiliateId) {
        const { data: currentRow } = await client
          .from('affiliates')
          .select('customers_count')
          .eq('id', subAffiliateId)
          .maybeSingle();
        await client.from('affiliates')
          .update({
            customers_count: numberValue(currentRow?.customers_count) + 1,
          })
          .eq('id', subAffiliateId);
      }

    } catch (dbErr) {
      console.warn('[referral] secure database tracking failed — onlineStorage tracking active:', dbErr);
    }
  };

  // Perform dynamic tenant/business registration
  const handleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!acceptedTenantLegal) {
      setError('Please read and accept the Terms & Conditions and Privacy Policy before registration.');
      return;
    }
    if (!ownerName || !regEmail || !regPassword || !orgName || !regSecurityQuestion || !regSecurityAnswer) {
      setError('Please fill in all registration inputs.');
      return;
    }
    if (!businessType) {
      setError('Please select a business industry niche first!');
      return;
    }

    // Registration requires internet — block if offline
    if (!navigator.onLine) {
      setError(toUserFacingError(
        new TypeError('Failed to fetch'),
        { language: currentLang, context: 'registration', fallbackCode: 'NETWORK_ERROR' },
      ).message);
      return;
    }

    setIsLoading(true);
    setError(null);
    const cleanOwnerPhone = normalizePhoneForWhatsapp(regEmail);
    const ownerAuthEmail = regEmail.includes('@')
      ? regEmail.trim()
      : makeInternalEmailFromPhone(regEmail) || makeInternalEmailFromBusiness(orgName, ownerName);
    const currencyMapping = {
      'Nigeria': { symbol: '₦', code: 'NGN', tax: 0.075 },
      'Kenya': { symbol: 'KSh', code: 'KES', tax: 0.16 },
      'Ghana': { symbol: 'GH₵', code: 'GHS', tax: 0.15 },
      'South Africa': { symbol: 'R', code: 'ZAR', tax: 0.15 },
      'Tanzania': { symbol: 'TSh', code: 'TZS', tax: 0.18 }
    } as const;
    const mappedCurrency = currencyMapping[country] || currencyMapping.Tanzania;

    try {
      const registrationResponse = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Jasper-Language': currentLang,
        },
        body: JSON.stringify({
          email: ownerAuthEmail,
          password: regPassword,
          name: ownerName,
          businessName: orgName,
          phone: cleanOwnerPhone || regEmail.trim(),
          country,
          city,
          currency: mappedCurrency.symbol,
          currencyCode: mappedCurrency.code,
          taxRate: mappedCurrency.tax,
          businessType,
          referralCode: affiliateCode.trim() || undefined,
        })
      });
      const registration = await registrationResponse.json().catch(() => ({}));
      if (!registrationResponse.ok || !registration?.tenant || !registration?.userId) {
        throw {
          ...registration,
          status: registrationResponse.status,
        };
      }

      const newTenant = registration.tenant as Tenant;
      const authUserId = registration.userId as string;

      // Establish the browser auth session immediately. Dashboard persistence and
      // realtime tenant updates use this authenticated database session.
      const client: any = await getSecureDataBridgeClient();
      const { error: signInError } = await client.auth.signInWithPassword({
        email: ownerAuthEmail,
        password: regPassword
      });
      if (signInError) {
        console.warn('[auth] Account was created, but the browser session was not established.');
      }

      const hasPromoCode = !!affiliateCode.trim();
      const trialDays = hasPromoCode ? 20 : 10;
      const trialStartDate = new Date();
      const trialEndDate = new Date(trialStartDate);
      trialEndDate.setDate(trialEndDate.getDate() + trialDays);

      // Store response variables
      const registeredUser: User = {
        id: authUserId,
        email: ownerAuthEmail,
        name: ownerName,
        role: 'Admin',
        tenantId: newTenant.id,
        activeTenant: newTenant.id,
        phone: cleanOwnerPhone || regEmail.trim(),
        securityQuestion: regSecurityQuestion.trim(),
        securityAnswer: normalizeSecurityAnswer(regSecurityAnswer),
        isSaaSStaff: false,
        trial_start_date: trialStartDate.toISOString(),
        trial_end_date: trialEndDate.toISOString(),
        is_affiliate_lead: hasPromoCode,
        referral_code_used: hasPromoCode ? affiliateCode.trim() : ''
      };

      // Store custom tenants dynamically in onlineStorage
      const savedCustomTenants = JSON.parse(onlineStorage.getItem('jasper_custom_tenants') || '[]');
      onlineStorage.setItem('jasper_custom_tenants', JSON.stringify([...savedCustomTenants, newTenant]));
      initializeCleanTenantWorkspace(newTenant);

      // Store custom users dynamically in onlineStorage
      const savedCustomUsers = JSON.parse(onlineStorage.getItem('jasper_custom_users') || '[]');
      onlineStorage.setItem('jasper_custom_users', JSON.stringify([...savedCustomUsers, {
        ...registeredUser,
        password: regPassword,
        securityQuestion: regSecurityQuestion.trim(),
        securityAnswer: normalizeSecurityAnswer(regSecurityAnswer)
      }]));

      onlineStorage.setItem('jasper_subscription_state', JSON.stringify({
        planId: 'trial',
        trialStartedAt: trialStartDate.toISOString(),
        isSubscribedPaid: false,
        simulatedDaysPassed: 0,
        promoCodeUsed: hasPromoCode ? affiliateCode.trim().toUpperCase() : undefined,
        autoRenewEnabled: true,
        paymentStatus: 'active'
      }));

      // Track affiliate referral if code was used
      if (affiliateCode.trim()) {
        registerAffiliateReferral(affiliateCode.trim(), orgName, newTenant.id);
      }

      setIsLoading(false);
      setSuccessMessage(`Success! Registered "${orgName}" as an isolated business tenant.`);

      // Auto trigger login directly for premium user experience
      triggerOnLoginWithSplash(registeredUser);

    } catch (err: any) {
      const safeError = toUserFacingError(err, {
        language: currentLang,
        context: 'registration',
        fallbackCode: 'SAVE_ERROR',
      });
      console.warn('[auth] Secure registration did not complete.', safeError.code, safeError.reference || '');
      setError(safeError.message);
      setIsLoading(false);
    }
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
    const customUsers = JSON.parse(onlineStorage.getItem('jasper_custom_users') || '[]');
    const combinedUsers = [...DEMO_USERS, ...customUsers];
    const match = combinedUsers.find(u => u.email.toLowerCase() === emailAddress.toLowerCase());

    if (match) {
      // User is already registered! Log them in!
      setTimeout(() => {
        setIsLoading(false);
        setShowGoogleModal(false);
        triggerOnLoginWithSplash({
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
    setError('Google account registration is not available yet. Please use WhatsApp/password registration so your account works securely on every device.');
    setIsLoading(false);
    return;
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

    // Store custom tenants dynamically in onlineStorage
    const savedCustomTenants = JSON.parse(onlineStorage.getItem('jasper_custom_tenants') || '[]');
    onlineStorage.setItem('jasper_custom_tenants', JSON.stringify([...savedCustomTenants, newTenant]));

    // Store custom users dynamically in onlineStorage
    const savedCustomUsers = JSON.parse(onlineStorage.getItem('jasper_custom_users') || '[]');
    onlineStorage.setItem('jasper_custom_users', JSON.stringify([...savedCustomUsers, newDynamicUser]));

    // Affiliate referral promo coupon registered if code was applied (optional config)
    if (affiliateCode.trim()) {
      const code = affiliateCode.trim().toUpperCase();
      const referralLedger = JSON.parse(onlineStorage.getItem('jasper_referral_ledger') || '[]');
      referralLedger.push({
        id: 'ref-dyn-google-' + Math.floor(1000 + Math.random() * 9000),
        affiliateCode: code,
        subscriberName: googleOrgName,
        package: '20-Day Extended Free Trial (Promo Applied)',
        payoutStatus: 'Trial Mode',
        registeredAt: new Date().toISOString().split('T')[0],
        commission: 0
      });
      onlineStorage.setItem('jasper_referral_ledger', JSON.stringify(referralLedger));

      const initialSubState = {
        planId: 'trial' as const,
        trialStartedAt: new Date().toISOString(),
        isSubscribedPaid: false,
        simulatedDaysPassed: 0,
        promoCodeUsed: code,
        autoRenewEnabled: true,
        paymentStatus: 'active' as const
      };
      onlineStorage.setItem('jasper_subscription_state', JSON.stringify(initialSubState));
      registerAffiliateReferral(code, googleOrgName, newTenantId);
    } else {
      const initialSubState = {
        planId: 'trial' as const,
        trialStartedAt: new Date().toISOString(),
        isSubscribedPaid: false,
        simulatedDaysPassed: 0,
        autoRenewEnabled: true,
        paymentStatus: 'active' as const
      };
      onlineStorage.setItem('jasper_subscription_state', JSON.stringify(initialSubState));
    }

    setTimeout(() => {
      setIsLoading(false);
      setShowGoogleModal(false);
      triggerOnLoginWithSplash({
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

  const isInvalidCredentialsError = error?.startsWith('Invalid credentials');
  const visibleError = isInvalidCredentialsError && !hasActiveLoginAttempt ? null : error;
  const visibleNotice = successMessage || redirectMessage || visibleError;

  return (
    <div id="login-container" className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans flex flex-col justify-start py-12 px-4 sm:px-6 lg:px-8 relative selection:bg-emerald-100 selection:text-emerald-950 transition-colors duration-300">
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden font-sans">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-gradient-to-br from-emerald-200/40 to-teal-200/30 rounded-full blur-[110px]" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-lg relative z-10 space-y-6">
        {/* Core Header */}
        <div className="text-center space-y-3 cursor-pointer" onClick={() => onNavigate('/')}>
          <div className={`inline-flex p-1 rounded-2xl border items-center justify-center mb-1 hover:scale-105 transition-transform shadow-md ${isSaasAdminPortal ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}`}>
            {isSaasAdminPortal ? (
              <Shield className="w-8 h-8 text-amber-600 stroke-[1.75]" />
            ) : loginScreenLogoUrl ? (
              <img src={loginScreenLogoUrl} alt="Orvix Logo" className="w-14 h-14 object-contain" referrerPolicy="no-referrer" />
            ) : (
              <img src="/jb-logo.png" alt="Orvix Logo" className="w-14 h-14 object-contain animate-pulse" />
            )}
          </div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
            {isSaasAdminPortal ? 'SaaS Core Authority' : tenantLoginTitle}
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold tracking-normal leading-relaxed uppercase max-w-sm mx-auto">
            {isSaasAdminPortal
              ? 'Central Management Backoffice'
              : isTenantDomainLogin
                ? `${resolvedTenant?.primaryDomain || `${resolvedTenant?.subdomainSlug || ''}.orvix.africa`} secure business portal`
              : currentLang === 'sw'
                ? 'Mfumo wa Kisasa wa Usimamizi wa Biashara na Mauzo'
                : 'Next-Generation Unified POS & Enterprise Management Suite'}
          </p>
        </div>

        {/* Warning or Success outputs */}
        {visibleNotice && (
          <div className={`p-4 rounded-2xl border flex items-start space-x-3 text-xs font-mono animate-fade-in ${
            successMessage
              ? 'bg-emerald-50 text-emerald-800 border-emerald-250'
              : visibleError
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            <span className="shrink-0 mt-0.5">⚠️</span>
            <div className="space-y-1 font-sans">
              <p className="font-bold">
                {successMessage ? 'Registration Ledger updated' : visibleError ? 'Login needs attention' : 'Active Safe Tunnel Redirect'}
              </p>
              <p className="font-medium text-[11px] leading-relaxed">
                {successMessage || visibleError || redirectMessage}
              </p>
            </div>
          </div>
        )}

        {/* Auth Tab Picker */}
        {!isSaasAdminPortal && !onboardingUser && !isTenantDomainLogin && (
          <div className="flex bg-slate-200 p-1 rounded-2xl grid grid-cols-2 font-bold text-xs shadow-inner">
            <button
              onClick={() => { setAuthTab('signin'); setError(null); }}
              className={`py-3 rounded-xl transition-all cursor-pointer text-center ${authTab === 'signin' ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-700 bg-transparent border-none'}`}
            >
	            Sign In
            </button>
            <button
              onClick={() => { setAuthTab('register'); setError(null); }}
              className={`py-3 rounded-xl transition-all cursor-pointer text-center ${authTab === 'register' ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-700 bg-transparent border-none'}`}
            >
	            Join Us
            </button>
          </div>
        )}

        {/* Action card boundary */}
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-6">

          {onboardingUser ? (
            /* Onboarding Form Screen */
            <form className="space-y-5 animate-fade-in" onSubmit={handleOnboardingSubmit}>
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
                <p className="text-xs font-semibold text-amber-800 leading-normal">
                  Tenant Workspace Configuration: Please set up your business details to launch your isolated dashboard.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider font-mono">Business Name</label>
                <input
                  type="text"
                  required
                  value={onboardingBusinessName}
                  placeholder="e.g. My Isolated Business Ltd"
                  onChange={(e) => setOnboardingBusinessName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider font-mono">Business Type</label>
                <select
                  value={onboardingBusinessType}
                  onChange={(e) => setOnboardingBusinessType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl px-3 py-2.5 text-xs text-slate-800 outline-none cursor-pointer"
                >
                  <option value="Retail">Retail</option>
                  <option value="Wholesale">Wholesale</option>
                  <option value="Retail & Wholesale">Retail & Wholesale</option>
                  <option value="Restaurant">Restaurant</option>
                  <option value="Pharmacy">Pharmacy</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider font-mono">City / Office Location</label>
                <input
                  type="text"
                  required
                  value={onboardingCity}
                  placeholder="e.g. Dar es Salaam"
                  onChange={(e) => setOnboardingCity(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-55 text-white font-extrabold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-2 rounded-xl"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Spinning Up Isolated Tenant...</span>
                  </>
                ) : (
                  <span>Launch My Isolated Dashboard</span>
                )}
              </button>
            </form>
          ) : (authTab === 'signin' || isSaasAdminPortal) ? (
            /* Sign in screen */
            <form className="space-y-5" onSubmit={handleLoginSubmit}>
              {/* Warm Personalized Welcoming Banner */}
              {!isSaasAdminPortal && (
                <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-800/30 rounded-2xl p-4 text-center shadow-xs animate-fade-in">
                  <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 leading-normal">
                    {currentLang === 'sw'
                      ? 'Karibu tena 👋 Ingia kwenye dashibodi yako ya biashara'
                      : 'Welcome back 👋 Sign in to your business dashboard'}
                  </p>
                </div>
              )}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">
                    {isSaasAdminPortal ? 'SAAS STAFF WHATSAPP NUMBER' : 'WHATSAPP NUMBER'}
                  </label>
                  {emailChecked && (
                    <button
                      type="button"
                      onClick={() => {
                        setEmailChecked(false);
                        setPassword('');
                        setLoginOtpMode(false);
                        setLoginOtp('');
                        setLoginOtpInput('');
                        setLoginOtpUser(null);
                        setLoginOtpMessage(null);
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
                    placeholder="WhatsApp number"
                  />
                  <MessageCircle className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                </div>
              </div>

              {emailChecked ? (
                <div className="space-y-1.5 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block">
                      {loginOtpMode ? 'WHATSAPP OTP' : 'SECURITY PIN PASSWORD'}
                    </label>
                  </div>
                  <div className="relative">
                    {loginOtpMode ? (
                      <input
                        id="login-otp"
                        type="text"
                        required
                        value={loginOtpInput}
                        onChange={(e) => setLoginOtpInput(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl px-4 py-3 pl-11 text-sm text-slate-800 placeholder-slate-400 font-mono tracking-widest transition-all outline-none"
                        placeholder="Enter WhatsApp OTP"
                      />
                    ) : (
                      <input
                        id="login-password"
                        type={showLoginPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl px-4 py-3 pl-11 pr-11 text-sm text-slate-800 placeholder-slate-400 font-mono tracking-wider transition-all outline-none"
                        placeholder="••••••••••••"
                      />
                    )}
                    <KeyRound className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                    {!loginOtpMode && (
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword((prev) => !prev)}
                        className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-700 transition-colors"
                        aria-label={showLoginPassword ? "Hide password" : "Show password"}
                      >
                        {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                  {loginOtpMessage && (
                    <div className="text-[11px] font-bold text-emerald-900 bg-emerald-50 border border-emerald-150 rounded-xl px-3 py-2">
                      {loginOtpMessage}
                    </div>
                  )}
                  {loginOtpMode && (
                    <button
                      type="button"
                      onClick={() => {
                        setLoginOtpMode(false);
                        setLoginOtp('');
                        setLoginOtpInput('');
                        setLoginOtpUser(null);
                        setLoginOtpMessage(null);
                      }}
                      className="text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-800"
                    >
                      Use PIN/password instead
                    </button>
                  )}
                  {!loginOtpMode && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setShowRecovery(true);
                          setRecoveryIdentifier(email);
                          setRecoveryStep('identify');
                          setRecoveryMessage(null);
                        }}
                        className="text-[10px] font-black uppercase tracking-wider text-emerald-700 hover:text-emerald-800"
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}
                </div>
              ) : null}

              {!emailChecked && (
                <div className="flex justify-end -mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRecovery(true);
                      setRecoveryIdentifier(email);
                      setRecoveryStep('identify');
                      setRecoveryMessage(null);
                    }}
                    className="text-[10px] font-black uppercase tracking-wider text-emerald-700 hover:text-emerald-800"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {showRecovery && (
                <div className="rounded-2xl border border-emerald-300 bg-white p-4 space-y-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <MessageCircle className="w-4 h-4 text-emerald-700" />
                        Password Recovery
                      </h4>
                      <p className="text-[11px] text-slate-700 mt-1 leading-snug">
                        Admin recovery verifies your security question first, then sends WhatsApp OTP.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowRecovery(false)}
                      className="text-[10px] font-black text-slate-500 hover:text-slate-800"
                    >
                      CLOSE
                    </button>
                  </div>

                  {recoveryMessage && (
                    <div className="text-[11px] font-bold text-emerald-900 bg-emerald-50 border border-emerald-150 rounded-xl px-3 py-2">
                      {recoveryMessage}
                    </div>
                  )}

                  {recoveryStep === 'identify' ? (
                    <div className="space-y-2">
                      <input
                        type="tel"
                        value={recoveryIdentifier}
                        onChange={e => { setRecoveryIdentifier(e.target.value); setRecoveryWhatsapp(e.target.value); }}
                        placeholder="Your WhatsApp / mobile number"
                        className="w-full bg-white border border-emerald-150 rounded-xl px-3 py-2.5 text-xs font-semibold outline-none focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={handleStartRecovery}
                        className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2"
                      >
                        <Shield className="w-4 h-4" />
                        Continue
                      </button>
                    </div>
                  ) : recoveryStep === 'security' ? (
                    <div className="space-y-2">
                      <div className="bg-white border border-emerald-150 rounded-xl px-3 py-2.5">
                        <span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">Security Question</span>
                        <p className="text-xs font-bold text-slate-800 mt-1">{recoveryUser?.securityQuestion}</p>
                      </div>
                      <input
                        type="text"
                        value={recoverySecurityAnswer}
                        onChange={e => setRecoverySecurityAnswer(e.target.value)}
                        placeholder="Your answer"
                        className="w-full bg-white border border-emerald-150 rounded-xl px-3 py-2.5 text-xs font-semibold outline-none focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyRecoverySecurity}
                        className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Verify & Send OTP
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={recoveryInputOtp}
                        onChange={e => setRecoveryInputOtp(e.target.value)}
                        placeholder="Enter 6-digit OTP"
                        className="w-full bg-white border border-emerald-150 rounded-xl px-3 py-2.5 text-xs font-mono font-black tracking-widest outline-none focus:border-emerald-500"
                      />
                      <input
                        type="password"
                        value={recoveryNewPassword}
                        onChange={e => setRecoveryNewPassword(e.target.value)}
                        placeholder="New password / PIN"
                        className="w-full bg-white border border-emerald-150 rounded-xl px-3 py-2.5 text-xs font-semibold outline-none focus:border-emerald-500"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setRecoveryStep('identify');
                            setRecoveryInputOtp('');
                            setRecoveryNewPassword('');
                          }}
                          className="py-2.5 rounded-xl bg-white border border-emerald-150 text-slate-700 text-[10px] font-black uppercase tracking-wider"
                        >
                          Change Number
                        </button>
                        <button
                          type="button"
                          onClick={handleFinishRecovery}
                          className="py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-white text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Reset Password
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                id="login-submit-btn"
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-55 text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-2 shadow-md shadow-emerald-500/10 active:scale-98"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processing securely...</span>
                  </>
                ) : emailChecked ? (
	                  <span>Sign In</span>
                ) : (
                  <span>Continue</span>
                )}
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
                    placeholder="e.g. Jane Doe"
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-505 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">Company Name</label>
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
	                  <label className="text-[10px] font-bold text-slate-500 uppercase block">Owner WhatsApp Number</label>
	                  <input
	                    type="tel"
	                    required
	                    value={regEmail}
	                    placeholder="e.g. +255 712 345 678"
	                    onChange={(e) => setRegEmail(e.target.value)}
	                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-555 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none font-sans"
	                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">Owner Pin Password</label>
                  <div className="relative">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      value={regPassword}
                      placeholder="••••••••"
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-555 rounded-xl px-3.5 py-2.5 pr-11 text-xs text-slate-800 outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword((prev) => !prev)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                      aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                    >
                      {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">Security Question</label>
                  <input
                    type="text"
                    required
                    value={regSecurityQuestion}
                    placeholder="e.g. What is your first shop name?"
                    onChange={(e) => setRegSecurityQuestion(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-555 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none font-sans"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">Security Answer</label>
                  <input
                    type="text"
                    required
                    value={regSecurityAnswer}
                    placeholder="Answer you will remember"
                    onChange={(e) => setRegSecurityAnswer(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-555 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none font-sans"
                  />
                </div>
              </div>

	              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <p className="text-[9.5px] text-emerald-700 font-sans leading-normal font-normal">
                  Register with a promo code to get 20 free days instead of 10.
                </p>
              </div>

              {/* BUSINESS TYPE - NICHE BLOCKS */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider font-mono">
                  Business Industry Niche / Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'Retail & Wholesale', label: 'Retail & Wholesale', icon: '🛒', desc: 'Shops, supermarkets, distributors' },
                    { value: 'Pharmacy', label: 'Pharmacy', icon: '💊', desc: 'Clinics, dispensaries, chemists' },
                  ].map(niche => (
                    <button
                      key={niche.value}
                      type="button"
                      onClick={() => { setBusinessType(niche.value); setError(null); }}
                      className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                        businessType === niche.value
                          ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                          : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
                      }`}
                    >
                      <span className="text-2xl block mb-1">{niche.icon}</span>
                      <span className={`block text-xs font-black ${businessType === niche.value ? 'text-emerald-800' : 'text-slate-700'}`}>{niche.label}</span>
                      <span className="block text-[10px] text-slate-400 font-medium mt-0.5 leading-snug">{niche.desc}</span>
                      {businessType === niche.value && (
                        <span className="mt-1.5 inline-block text-[9px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Selected ✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                <label className="flex items-start gap-3 text-[11px] leading-relaxed text-slate-600">
                  <input
                    type="checkbox"
                    checked={acceptedTenantLegal}
                    onChange={(e) => setAcceptedTenantLegal(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600"
                  />
                  <span>
                    I have read and agree to Orvix's{' '}
                    <button type="button" onClick={() => setTenantLegalModalType('terms')} className="font-black text-emerald-700 underline bg-transparent border-none p-0 cursor-pointer">
                      Terms & Conditions
                    </button>
                    {' '}and{' '}
                    <button type="button" onClick={() => setTenantLegalModalType('privacy')} className="font-black text-emerald-700 underline bg-transparent border-none p-0 cursor-pointer">
                      Privacy Policy
                    </button>
                    , including secure data processing, lawful advertising placements, and system-use responsibilities.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading || !acceptedTenantLegal}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-55 disabled:cursor-not-allowed text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Allocating Cloud DB Cluster...</span>
                  </>
                ) : (
	                  <span>Join Us</span>
                )}
              </button>

            </form>
          )}


                {/* Back link */}
        <div className="text-center font-sans">
          <button
            onClick={handleBackToLandingHub}
            className="text-xs text-slate-400 hover:text-emerald-600 font-bold transition-all bg-transparent border-none cursor-pointer"
          >
            ← Back to Orvix Landing Hub
          </button>
        </div>
      </div>
      </div>

      {/* GOOGLE SSO FLOW MODAL */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden relative">

            {/* Modal Header */}
            <div className="px-6 py-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
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
                  <p className="text-xs text-slate-500 font-medium">to continue securely to your Orvix cabin workspace</p>
                </div>

                <div className="space-y-2.5 font-sans">
                  {/* Account choice list */}

                  {/* Option A: Preferred Gmail account */}
                  <button
                    type="button"
                    onClick={() => handleSelectGoogleAccount('demo@example.com', 'Jane Doe')}
                    className="w-full p-4 hover:bg-slate-50 border border-slate-150 hover:border-emerald-300 rounded-2xl text-left flex items-center justify-between transition-all cursor-pointer group"
                  >
                    <div className="flex items-center space-x-3.5">
                      <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm tracking-wide shadow-inner">
                        TA
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">Jane Doe (Owner)</p>
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
                    className="w-full p-4 hover:bg-slate-50 border border-slate-200 hover:border-emerald-300 rounded-2xl text-left flex items-center justify-between transition-all cursor-pointer group"
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
                          className="flex-1 bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none font-sans"
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
                          className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-500 cursor-pointer"
                        >
                          Select Account
                        </button>
                      </div>
                    </div>
                  )}

                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center space-x-2 text-[10px] text-slate-400 font-sans leading-relaxed">
                  <span>🔒</span>
                  <span>Google shares verified profile details.</span>
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
                    <label className="text-[10px] font-bold text-slate-500 uppercase block">Company Name</label>
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
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl px-2.5 py-2 text-xs text-slate-800 outline-none font-sans"
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
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-555 rounded-xl px-2.5 py-2 text-xs text-slate-800 outline-none font-sans"
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
                        const code = prompt('Enter coupon promo code (e.g. JASPER):');
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
                    className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-55 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-1.5 shadow"
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

      <PrivacyAndTermsModals
        isOpen={tenantLegalModalType !== null}
        type={tenantLegalModalType || 'terms'}
        onClose={() => setTenantLegalModalType(null)}
        isDark={isDark}
      />

    </div>
  );
}
