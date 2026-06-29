import React, { useState, useEffect } from "react";
import {
  Users,
  DollarSign,
  MousePointer,
  Award,
  PhoneCall,
  Clock,
  AlertTriangle,
  Copy,
  Check,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Layers,
  FileText,
  Smartphone,
  Info,
  Download,
  Image as ImageIcon,
  Code,
  Target,
  Video,
  Mic,
  MicOff,
  PlusCircle,
  Plus,
  Trash2,
  Edit2,
  Send,
  Play,
  Tv,
  Eye,
  EyeOff,
  BookOpen,
  Volume2,
  VolumeX,
  Grid,
  MessageSquare,
  ExternalLink,
  Search,
  ShoppingCart,
  Package,
  CheckCircle,
  XCircle,
} from "lucide-react";
import SaaSHardwarePOS from "./SaaSHardwarePOS";
import SaaSHardwareInventory from "./SaaSHardwareInventory";
import AffiliateWorkspace from "./affiliate/AffiliateWorkspace";
import AffiliateAgentDesk from "./affiliate/AffiliateAgentDesk";
import { loadAffiliateAgentWorkspace, loadAffiliateWorkspace } from "../utils/affiliateWorkspace";
import { getDynamicSupabaseClient } from "../supabaseClient";
import { useTranslation } from "../LanguageContext";
import {
  getTermsTitle,
  getTermsSubtitle,
  getTermsScrollMsg,
  getTermsStatusMsg,
  getTermsAcceptBtnText,
  renderTermsContent,
} from "./TermsTranslations";

interface Affiliate {
  id: string;
  name: string;
  email: string;
  phone: string;
  paymentMethod: string; // 'm-pesa' | 'tigo_yas' | 'airtel_money' | 'halopesa'
  promoCode: string;
  password?: string;
  isSuper?: boolean;
  targetReferrals?: number;
  parentSuperId?: string;
  nidaNumber?: string;
  tinNumber?: string;
}

interface AffiliatePortalProps {
  onNavigate: (route: string) => void;
  forcedRole?: "affiliate" | "partner";
}

export default function AffiliatePortal({ onNavigate, forcedRole }: AffiliatePortalProps) {
  const { lang, t } = useTranslation();
  const [authMode, setAuthMode] = useState<"login" | "register" | "dashboard">(
    "login",
  );

  // Auth Form Input States
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [payoutPhone, setPayoutPhone] = useState("");
  const [password, setPassword] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("m-pesa");
  const [promoCode, setPromoCode] = useState("");
  const [parentSuperCode, setParentSuperCode] = useState("");
  const [claimMessage, setClaimMessage] = useState("");
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [portalRole, setPortalRole] = useState<"affiliate" | "partner">(
    forcedRole ?? "affiliate",
  );
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [nidaNumber, setNidaNumber] = useState("");
  const [tinNumber, setTinNumber] = useState("");
  const [firstName, setFirstName] = useState("");
  const [secondName, setSecondName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Active Logged In Affiliate Info state representation
  const [activeAffiliate, setActiveAffiliate] = useState<Affiliate | null>(
    null,
  );
  const [databaseWorkspaceEnabled, setDatabaseWorkspaceEnabled] = useState(false);
  const [databaseAgentWorkspaceEnabled, setDatabaseAgentWorkspaceEnabled] = useState(false);
  const [isEditingPromo, setIsEditingPromo] = useState(false);
  const [newPromoInput, setNewPromoInput] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoSuggestions, setPromoSuggestions] = useState<string[]>([]);
  const [activeCreativeTab, setActiveCreativeTab] = useState<string>("flyer");
  const [sspInventory, setSspInventory] = useState<any[]>([]);
  const [tutorialLibrary, setTutorialLibrary] = useState<any[]>([]);
  const [tutorialAssignments, setTutorialAssignments] = useState<any[]>([]);

  // ── RESTORE SESSION ON PAGE RELOAD ──────────────────────────────────────
  // If user was already logged in (localStorage has their session), restore it
  useEffect(() => {
    const saved = localStorage.getItem('jasper_logged_affiliate');
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (!parsed?.id) return;
      setActiveAffiliate(parsed);
      setAuthMode('dashboard');
      // Restore correct dashboard based on forcedRole or isSuper flag
      if (forcedRole === 'partner' || parsed.isSuper === true) {
        setDatabaseAgentWorkspaceEnabled(true);
      } else {
        setDatabaseWorkspaceEnabled(true);
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Load dynamic SSP banners from admin platform
    const savedBanners =
      localStorage.getItem("saas_promotional_banners") ||
      localStorage.getItem("saas_ops_banners");
    if (savedBanners) {
      try {
        const parsed = JSON.parse(savedBanners);
        setSspInventory(Array.isArray(parsed) ? parsed : []);
      } catch (error) {
        console.error("Failed to load SSP inventory", error);
        setSspInventory([]);
      }
    }

    try {
      const savedTutorials = localStorage.getItem("saas_training_tutorials");
      const savedAssignments = localStorage.getItem("saas_tutorial_assignments");
      setTutorialLibrary(savedTutorials ? JSON.parse(savedTutorials) : []);
      setTutorialAssignments(savedAssignments ? JSON.parse(savedAssignments) : []);
    } catch (error) {
      console.error("Failed to load tutorials", error);
      setTutorialLibrary([]);
      setTutorialAssignments([]);
    }
    
    // Parse URL query arguments to support separate pathway links
    try {
      const params = new URLSearchParams(window.location.search);
      const roleParam = params.get("role");
      const modeParam = params.get("mode");
      if (!forcedRole && (roleParam === "partner" || roleParam === "affiliate")) {
        setPortalRole(roleParam);
      }
      if (modeParam === "login" || modeParam === "register" || modeParam === "dashboard") {
        setAuthMode(modeParam as any);
      }
    } catch (e) {
      console.error("Failed to parse URL query arguments", e);
    }
  }, []);

  useEffect(() => {
    // Partner workspace loader — only runs at /partner
    if (forcedRole !== 'partner') return;
    let cancelled = false;
    loadAffiliateAgentWorkspace()
      .then((workspace) => {
        if (cancelled) return;
        // Even if no affiliates yet (new partner), still show Partner Dashboard
        setDatabaseAgentWorkspaceEnabled(true);
        setAuthMode('dashboard');
      })
      .catch(() => {
        // Supabase failed — fall back to localStorage session restore
        if (!cancelled) setDatabaseAgentWorkspaceEnabled(false);
      });
    return () => { cancelled = true; };
  }, [forcedRole]);

  useEffect(() => {
    // Affiliate workspace loader — ONLY runs at /affiliate, never at /partner
    if (forcedRole === 'partner') return;
    let cancelled = false;
    loadAffiliateWorkspace()
      .then((workspace) => {
        if (cancelled || !workspace) return;
        setActiveAffiliate({
          id: workspace.profile.id,
          name: workspace.profile.display_name,
          email: '',
          phone: workspace.profile.payout_account || '',
          paymentMethod: workspace.profile.payout_method || 'm-pesa',
          promoCode: workspace.profile.referral_code,
        });
        setDatabaseWorkspaceEnabled(true);
        setAuthMode('dashboard');
      })
      .catch(() => {
        if (!cancelled) setDatabaseWorkspaceEnabled(false);
      });
    return () => { cancelled = true; };
  }, [forcedRole]);

  // Clipboards feedback tracking
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Waitlist State and Helpers for Partner Program Capacity
  const [waitlistName, setWaitlistName] = useState("");
  const [waitlistPhone, setWaitlistPhone] = useState("");

  const getPartnersCount = () => {
    try {
      const raw = localStorage.getItem("saas_immersive_affiliates") || "[]";
      const list = JSON.parse(raw);
      return list.filter((a: any) => a.isSuper === true || a.isSuper === "true").length;
    } catch (e) {
      return 0;
    }
  };

  const getPartnerCapacity = () => {
    const saved = localStorage.getItem('jasper_partner_capacity');
    return saved ? parseInt(saved, 10) : 5;
  };

  const handleWaitlistSubmit = (e: any) => {
    e.preventDefault();
    if (!waitlistName.trim()) {
      alert("Please provide your Full Name.");
      return;
    }
    const phoneNo = waitlistPhone.trim();
    const phoneRegex = /^[+]?[0-9]{8,15}$/;
    if (!phoneRegex.test(phoneNo.replace(/\s+/g, ""))) {
      alert("Please enter a valid phone number (digits only, e.g. 0754002991, 8 to 15 digits).");
      return;
    }

    const currentWaitlist = JSON.parse(localStorage.getItem('jasper_partner_waitlist') || '[]');
    const newEntry = {
      fullName: waitlistName.trim(),
      phoneNumber: phoneNo,
      addedAt: new Date().toISOString().split('T')[0]
    };
    currentWaitlist.push(newEntry);
    localStorage.setItem('jasper_partner_waitlist', JSON.stringify(currentWaitlist));

    // Dispatch update notification so active admin views refresh immediately!
    window.dispatchEvent(new Event('jasper_partner_waitlist_updated'));

    alert(`🎉 Thank you, ${waitlistName.trim()}! You have been successfully added to our partner program waitlist. We appreciate your deep desire to collaborate, and you will be the absolute first to be notified as soon as slots reopen!`);
    
    // Reset waitlist form fields
    setWaitlistName("");
    setWaitlistPhone("");
  };
  const [copiedBanner, setCopiedBanner] = useState(false);
  const [payoutFormSuccess, setPayoutFormSuccess] = useState(false);

  // Super Affiliate Extra State Actions
  const [superActiveTab, setSuperActiveTab] = useState<
    | "overview"
    | "manage"
    | "sessions"
    | "conferencing"
    | "hw-pos"
    | "hw-inventory"
  >("overview");
  const [superManageSearch, setSuperManageSearch] = useState("");

  // Manage sub-affiliate dialog states
  const [showAddAffiliateModal, setShowAddAffiliateModal] = useState(false);
  const [showEditAffiliateModal, setShowEditAffiliateModal] = useState(false);
  const [selectedEditAffiliate, setSelectedEditAffiliate] = useState<
    any | null
  >(null);

  // Form states for Add Sub-Affiliate
  const [addAffName, setAddAffName] = useState("");
  const [addAffEmail, setAddAffEmail] = useState("");
  const [addAffPhone, setAddAffPhone] = useState("");
  const [addAffPromo, setAddAffPromo] = useState("");
  const [addAffPhoneMethod, setAddAffPhoneMethod] = useState("m-pesa");
  const [addAffPassword, setAddAffPassword] = useState("pass123");
  const [addAffTarget, setAddAffTarget] = useState(150);
  const [addAffNida, setAddAffNida] = useState("");
  const [addAffTin, setAddAffTin] = useState("");

  // Form states for Edit Sub-Affiliate
  const [editAffName, setEditAffName] = useState("");
  const [editAffEmail, setEditAffEmail] = useState("");
  const [editAffPhone, setEditAffPhone] = useState("");
  const [editAffPromo, setEditAffPromo] = useState("");
  const [editAffPhoneMethod, setEditAffPhoneMethod] = useState("m-pesa");
  const [editAffTarget, setEditAffTarget] = useState(150);
  const [editAffNida, setEditAffNida] = useState("");
  const [editAffTin, setEditAffTin] = useState("");

  // Sending Message State Actions
  const [showSendMessageModal, setShowSendMessageModal] = useState(false);
  const [selectedMessageAffiliate, setSelectedMessageAffiliate] = useState<
    any | null
  >(null);
  const [sublineDirectMessage, setSublineDirectMessage] = useState("");
  const [sublineMessagesHistory, setSublineMessagesHistory] = useState<any[]>(
    () => {
      try {
        const cached = localStorage.getItem("saas_subline_messages");
        return cached ? JSON.parse(cached) : [];
      } catch {
        return [];
      }
    },
  );

  const handleSendTutorialToSubAffiliate = (tutorial: any, child: any) => {
    if (!activeAffiliate || !tutorial || !child) return;
    const assignment = {
      id: "lesson-" + Math.floor(Math.random() * 1000000),
      tutorialId: tutorial.id,
      tutorial,
      fromId: activeAffiliate.id,
      fromName: activeAffiliate.name,
      toId: child.id,
      toName: child.name,
      sentAt: new Date().toISOString(),
      read: false,
    };
    const nextAssignments = [assignment, ...tutorialAssignments];
    setTutorialAssignments(nextAssignments);
    localStorage.setItem("saas_tutorial_assignments", JSON.stringify(nextAssignments));
    alert(`Tutorial sent to ${child.name}.`);
  };

  // Sessions materials research configuration
  const [sessionsSearchQuery, setSessionsSearchQuery] = useState("");
  const [sessionsCategory, setSessionsCategory] = useState<
    "all" | "guide" | "video" | "marketing" | "lesson" | "message"
  >("all");

  // Video conferencing simulation state representors
  const [isConferenceActive, setIsConferenceActive] = useState(false);
  const [conferenceRoomId, setConferenceRoomId] = useState(
    "CONF-JASPER-MASTERCLASS",
  );
  const [videoHostMutedAll, setVideoHostMutedAll] = useState(false);
  const [conferenceMembers, setConferenceMembers] = useState([
    {
      id: "m1",
      name: "Juma J. (Restaurant POS)",
      role: "Speaker",
      avatar: "👨‍🍳",
      isMuted: false,
      isSpeaking: true,
      cameraActive: true,
      signal: "Excellent",
    },
    {
      id: "m2",
      name: "Dr. Amina K. (Clinical BestRx)",
      role: "Speaker",
      avatar: "👩‍⚕️",
      isMuted: false,
      isSpeaking: false,
      cameraActive: true,
      signal: "Good",
    },
    {
      id: "m3",
      name: "Serah L. (Hotel PMS)",
      role: "Speaker",
      avatar: "👩‍💼",
      isMuted: true,
      isSpeaking: false,
      cameraActive: true,
      signal: "Excellent",
    },
    {
      id: "m4",
      name: "Amor Ben (Wholesale King)",
      role: "Attendee",
      avatar: "🧔",
      isMuted: true,
      isSpeaking: false,
      cameraActive: false,
      signal: "Poor",
    },
    {
      id: "m5",
      name: "Kariakoo Glassware Team",
      role: "Attendee",
      avatar: "🏭",
      isMuted: true,
      isSpeaking: false,
      cameraActive: true,
      signal: "Good",
    },
  ]);
  const [activeSpeakerId, setActiveSpeakerId] = useState("m1");

  // SaaS Mirror Selected User
  const [selectedMirrorAccount, setSelectedMirrorAccount] = useState<
    any | null
  >(null);

  // States for sub-affiliate mirror editing & monitoring
  const [isEditingMirroredClicks, setIsEditingMirroredClicks] = useState(false);
  const [mirroredClicksValue, setMirroredClicksValue] = useState(148);
  const [showAddMirroredStoreModal, setShowAddMirroredStoreModal] =
    useState(false);
  const [showEditMirroredStoreModal, setShowEditMirroredStoreModal] =
    useState(false);
  const [selectedEditMirroredStore, setSelectedEditMirroredStore] = useState<
    any | null
  >(null);

  // Form input fields for mirrored subscriber stores
  const [mirroredStoreName, setMirroredStoreName] = useState("");
  const [mirroredStoreTier, setMirroredStoreTier] =
    useState("Diamond");
  const [mirroredStoreStatus, setMirroredStoreStatus] = useState("Paid");
  const [mirroredStoreCharge, setMirroredStoreCharge] = useState(35000);

  // Generate beautiful pre-populated simulation stats for demo portfolios
  const [clicksCount, setClicksCount] = useState<number>(() => {
    try {
      const cached = localStorage.getItem("jasper_logged_affiliate");
      if (cached) {
        const aff = JSON.parse(cached);
        const code = aff.promoCode || "";
        const storageKey = `jasper_clicks_${code}`;
        const savedClicks = localStorage.getItem(storageKey);
        if (savedClicks !== null) {
          return Number(savedClicks);
        }
        if (code.toUpperCase() === "SARAH_JASPER") return 148;
        if (code.toUpperCase() === "LANGA") return 325;
        return 0;
      }
    } catch (e) {
      console.error(e);
    }
    return 148; // Default fallback for unlogged or guest view
  });
  const [claimsReloader, setClaimsReloader] = useState(0);
  const [subscribers, setSubscribers] = useState(() => {
    const defaultSubs = [
      {
        id: "1",
        storeName: "Kariakoo Glassware Ltd",
        registeredAt: "2026-05-10",
        tier: "Diamond",
        status: "Paid",
        charge: 35000,
        commission: 5250,
        affiliateCode: "SARAH_JASPER",
      },
      {
        id: "2",
        storeName: "Kisumu Chemists Shop",
        registeredAt: "2026-05-18",
        tier: "Ruby",
        status: "Paid",
        charge: 20000,
        commission: 3000,
        affiliateCode: "SARAH_JASPER",
      },
      {
        id: "3",
        storeName: "Mwenge Food Court",
        registeredAt: "2026-05-22",
        tier: "Tanzanite",
        status: "Paid",
        charge: 50000,
        commission: 7500,
        affiliateCode: "SARAH_JASPER",
      },
      {
        id: "4",
        storeName: "Arusha Highlands Lodge",
        registeredAt: "2026-05-23",
        tier: "trial",
        status: "Active Trial",
        charge: 0,
        commission: 0,
        affiliateCode: "SARAH_JASPER",
      },
    ];

    try {
      const referralLedger = JSON.parse(localStorage.getItem("jasper_referral_ledger") || "[]");
      const mappedLedger = referralLedger.map((r: any) => ({
        id: r.id,
        storeName: r.subscriberName,
        registeredAt: r.registeredAt,
        tier: r.package || "Ruby",
        status: r.payoutStatus === "Paid" || r.package !== "trial" ? "Paid" : "Active Trial",
        charge: r.package === "Tanzanite" ? 50000 : r.package === "Diamond" ? 35000 : 20000,
        commission: r.commission || 0,
        affiliateCode: r.affiliateCode,
      }));
      return [...defaultSubs, ...mappedLedger];
    } catch (e) {
      return defaultSubs;
    }
  });

  // Custom Super Affiliate mutation handlers
  const saveAffiliatesList = (nextList: any[]) => {
    localStorage.setItem("saas_immersive_affiliates", JSON.stringify(nextList));
    // Trigger internal dispatch to update claims/counts
    window.dispatchEvent(new CustomEvent("saas_claims_reload"));
  };

  const handleCreateSubAffiliate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addAffName || !addAffEmail || !addAffPhone || !addAffPromo) {
      alert(
        "Please fill in essential affiliate fields (Name, Email, Phone, Promo Code).",
      );
      return;
    }

    const raw = localStorage.getItem("saas_immersive_affiliates");
    let list: any[] = [];
    if (raw) {
      try {
        list = JSON.parse(raw);
      } catch {}
    }

    // Check duplicate promo or email
    const duplicate = list.some(
      (a) =>
        a.email.toLowerCase() === addAffEmail.toLowerCase().trim() ||
        a.promoCode.toUpperCase() === addAffPromo.toUpperCase().trim(),
    );
    if (duplicate) {
      alert(
        "An affiliate with this Email or Promo Code already exists in the system!",
      );
      return;
    }

    const newAff = {
      id: "aff-" + Math.floor(100 + Math.random() * 900),
      name: addAffName.trim(),
      email: addAffEmail.trim().toLowerCase(),
      phone: addAffPhone.trim(),
      promoCode: addAffPromo.trim().toUpperCase(),
      paymentMethod: addAffPhoneMethod,
      password: addAffPassword,
      isSuper: false,
      conversionsPromo: 0,
      revenueDate: 0,
      targetReferrals: Number(addAffTarget) || 150,
      parentSuperId: activeAffiliate?.id || "LANGA",
      nidaNumber: addAffNida.trim() || "N/A",
      tinNumber: addAffTin.trim() || "N/A",
    };

    const updatedList = [...list, newAff];
    saveAffiliatesList(updatedList);

    // Clear inputs
    setAddAffName("");
    setAddAffEmail("");
    setAddAffPhone("");
    setAddAffPromo("");
    setAddAffNida("");
    setAddAffTin("");
    setShowAddAffiliateModal(false);
    alert(
      `🎉 Successfully onboarded downline partner ${newAff.name}! Promo Code ${newAff.promoCode} is active immediately.`,
    );
  };

  const handleUpdateSubAffiliateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEditAffiliate) return;

    if (!editAffName || !editAffEmail || !editAffPhone || !editAffPromo) {
      alert("Please fill in essential affiliate fields.");
      return;
    }

    const raw = localStorage.getItem("saas_immersive_affiliates");
    let list: any[] = [];
    if (raw) {
      try {
        list = JSON.parse(raw);
      } catch {}
    }

    const updatedList = list.map((a) => {
      if (a.id === selectedEditAffiliate.id) {
        return {
          ...a,
          name: editAffName.trim(),
          email: editAffEmail.trim().toLowerCase(),
          phone: editAffPhone.trim(),
          promoCode: editAffPromo.trim().toUpperCase(),
          paymentMethod: editAffPhoneMethod,
          targetReferrals: Number(editAffTarget) || 150,
          nidaNumber: editAffNida.trim() || "N/A",
          tinNumber: editAffTin.trim() || "N/A",
        };
      }
      return a;
    });

    saveAffiliatesList(updatedList);
    setShowEditAffiliateModal(false);
    setSelectedEditAffiliate(null);
    alert("✓ Downline Affiliate information updated successfully!");
  };

  const handleOpenEditAffiliate = (aff: any) => {
    setSelectedEditAffiliate(aff);
    setEditAffName(aff.name);
    setEditAffEmail(aff.email);
    setEditAffPhone(aff.phone);
    setEditAffPromo(aff.promoCode);
    setEditAffPhoneMethod(aff.paymentMethod || "m-pesa");
    setEditAffTarget(aff.targetReferrals || 150);
    setEditAffNida(aff.nidaNumber || "");
    setEditAffTin(aff.tinNumber || "");
    setShowEditAffiliateModal(true);
  };

  const handleDeleteSubAffiliate = (affId: string, name: string) => {
    if (
      !confirm(
        `Are you absolutely sure you want to remove sub-affiliate ${name}? This action cannot be undone.`,
      )
    ) {
      return;
    }

    const raw = localStorage.getItem("saas_immersive_affiliates");
    let list: any[] = [];
    if (raw) {
      try {
        list = JSON.parse(raw);
      } catch {}
    }

    const filtered = list.filter((a) => a.id !== affId);
    saveAffiliatesList(filtered);
    alert(`✗ Affiliate ${name} has been removed from your network.`);
  };

  const handleToggleDisableAffiliate = (affId: string, name: string, currentlyDisabled: boolean) => {
    const action = currentlyDisabled ? 'enable' : 'disable';
    if (!confirm(`Are you sure you want to ${action} ${name}? ${currentlyDisabled ? 'They will be able to use their promo code again.' : 'Their promo code will be deactivated and they will not be able to earn commissions.'}`)) return;

    const raw = localStorage.getItem("saas_immersive_affiliates");
    let list: any[] = [];
    if (raw) { try { list = JSON.parse(raw); } catch {} }

    const updated = list.map((a: any) =>
      a.id === affId ? { ...a, isDisabled: !currentlyDisabled, status: currentlyDisabled ? 'Active' : 'Disabled' } : a
    );
    saveAffiliatesList(updated);
    alert(`${currentlyDisabled ? '✅ Enabled' : '⛔ Disabled'}: ${name} has been ${action}d.`);
  };

  const handleSendMessageToSubline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMessageAffiliate) return;
    if (!sublineDirectMessage.trim()) {
      alert("Please enter a message text to transmit.");
      return;
    }

    const newMsg = {
      id: "msg-" + Math.floor(1000 + Math.random() * 9000),
      fromId: activeAffiliate?.id || "LANGA",
      fromName: activeAffiliate?.name || "Super Recruiter",
      toId: selectedMessageAffiliate.id,
      toName: selectedMessageAffiliate.name,
      toPromo: selectedMessageAffiliate.promoCode,
      text: sublineDirectMessage.trim(),
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 16),
    };

    const nextHistory = [newMsg, ...sublineMessagesHistory];
    setSublineMessagesHistory(nextHistory);
    localStorage.setItem("saas_subline_messages", JSON.stringify(nextHistory));

    setSublineDirectMessage("");
    setShowSendMessageModal(false);

    // Play sound simulation or toast alert
    alert(
      `✉️ Message dispatched successfully to ${selectedMessageAffiliate.name}! It will appear on their partner terminal feed!`,
    );
  };

  // Generate simulated speak behavior in videoconference
  useEffect(() => {
    let interval: any = null;
    if (isConferenceActive) {
      interval = setInterval(() => {
        const randIndex = Math.floor(Math.random() * conferenceMembers.length);
        const nextMembers = conferenceMembers.map((m, idx) => {
          if (videoHostMutedAll) {
            return { ...m, isSpeaking: false };
          }
          const speakState = idx === randIndex ? !m.isMuted : false;
          return { ...m, isSpeaking: speakState };
        });
        setConferenceMembers(nextMembers);

        const currentSpeaker = nextMembers.find((m) => m.isSpeaking);
        if (currentSpeaker) {
          setActiveSpeakerId(currentSpeaker.id);
        }
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isConferenceActive, videoHostMutedAll, conferenceMembers]);

  // Read/Write affiliates to localStorage to make it 100% active and integrated
  useEffect(() => {
    const handleClaimsReload = () => {
      setClaimsReloader((prev) => prev + 1);
    };
    window.addEventListener("saas_claims_reload", handleClaimsReload);
    return () =>
      window.removeEventListener("saas_claims_reload", handleClaimsReload);
  }, []);

  useEffect(() => {
    // Affiliate dashboards are database-backed. Old browser-only demo sessions
    // must not reopen the legacy dashboard or show disconnected affiliate data.
    localStorage.removeItem("jasper_logged_affiliate");
  }, []);

  const handleUpdatePromoCode = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newPromoInput.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    if (!cleaned) {
      setPromoError("Promo code must contain letters and numbers only.");
      return;
    }

    // Check all existing promo codes across both stores
    const existingAffs = JSON.parse(localStorage.getItem("jasper_affiliates") || "[]");
    const immersiveList = JSON.parse(localStorage.getItem("saas_immersive_affiliates") || "[]");
    const allCodes = new Set([
      ...existingAffs.map((a: any) => a.promoCode?.toUpperCase()),
      ...immersiveList.map((a: any) => a.promoCode?.toUpperCase()),
    ]);
    // Remove own current code from check
    allCodes.delete(activeAffiliate?.promoCode?.toUpperCase());

    if (allCodes.has(cleaned)) {
      // Generate smart suggestions based on the chosen code
      const suggestions: string[] = [];
      const digits = ["1","2","3","4","5","7","8","9"];
      const suffixes = ["_PRO","_TZ","_EA","X","_VIP","_PLUS"];
      for (const d of digits) {
        const s = `${cleaned}${d}`;
        if (!allCodes.has(s)) { suggestions.push(s); if (suggestions.length >= 3) break; }
      }
      if (suggestions.length < 3) {
        for (const sfx of suffixes) {
          const s = `${cleaned}${sfx}`;
          if (!allCodes.has(s)) { suggestions.push(s); if (suggestions.length >= 3) break; }
        }
      }
      setPromoError(`"${cleaned}" is already taken.`);
      setPromoSuggestions(suggestions);
      return;
    }

    setPromoError(null);
    setPromoSuggestions([]);

    // Update activeAffiliate state
    const updatedAffiliate = {
      ...activeAffiliate!,
      promoCode: cleaned
    };
    setActiveAffiliate(updatedAffiliate);
    localStorage.setItem("jasper_logged_affiliate", JSON.stringify(updatedAffiliate));

    // Update in jasper_affiliates
    const nextAffiliates = existingAffs.map((a: any) => {
      if (a.id === activeAffiliate?.id) {
        return { ...a, promoCode: cleaned };
      }
      return a;
    });
    localStorage.setItem("jasper_affiliates", JSON.stringify(nextAffiliates));

    // Update in saas_immersive_affiliates
    const immersiveCached = localStorage.getItem("saas_immersive_affiliates");
    if (immersiveCached) {
      try {
        const list = JSON.parse(immersiveCached);
        const updatedList = list.map((a: any) => {
          if (a.id === activeAffiliate?.id) {
            return {
              ...a,
              promoCode: cleaned,
              affiliateLink: `https://dukaplus.co.tz/ref/${cleaned.toLowerCase()}`
            };
          }
          return a;
        });
        localStorage.setItem("saas_immersive_affiliates", JSON.stringify(updatedList));
      } catch (err) {}
    }

    // Also update sub list and ledger for referral subscribers
    const oldCode = activeAffiliate?.promoCode || "";
    setSubscribers((prev: any[]) => prev.map((s) => {
      if (s.affiliateCode && s.affiliateCode.trim().toUpperCase() === oldCode.trim().toUpperCase()) {
        return { ...s, affiliateCode: cleaned };
      }
      return s;
    }));

    try {
      const referralLedger = JSON.parse(localStorage.getItem("jasper_referral_ledger") || "[]");
      const updatedLedger = referralLedger.map((r: any) => {
        if (r.affiliateCode && r.affiliateCode.trim().toUpperCase() === oldCode.trim().toUpperCase()) {
          return { ...r, affiliateCode: cleaned };
        }
        return r;
      });
      localStorage.setItem("jasper_referral_ledger", JSON.stringify(updatedLedger));
    } catch (err) {}

    setIsEditingPromo(false);
    setPromoError(null);
    setPromoSuggestions([]);
  };

  const handleRegisterAffiliate = (e: any) => {
    e.preventDefault();
    if (!firstName || !secondName || !phone || !password) {
      alert("Please enter first name, second name, phone number, and password.");
      return;
    }

    if (!nidaNumber || nidaNumber.trim().length === 0) {
      alert("National ID (NIDA) is mandatory. Please provide a valid NIDA number.");
      return;
    }

    // Agent/Partner promo code is REQUIRED for affiliates
    if (portalRole !== 'partner' && !parentSuperCode.trim()) {
      alert("⚠️ Agent / Partner code is required. Please enter the promo code of the Partner who recruited you.");
      return;
    }

    const registeredName = `${firstName.trim()} ${secondName.trim()}`;
    const generatedReferralCode = `${firstName.substring(0, 5).replace(/[^A-Za-z0-9]/g, "").toUpperCase()}_${secondName.substring(0, 5).replace(/[^A-Za-z0-9]/g, "").toUpperCase()}_JAR_${Math.floor(100 + Math.random() * 900)}`;
    void (async () => {
      try {
        const response = await fetch('/api/affiliate/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: registeredName,
            phone,
            password,
            payoutMethod: paymentMethod,
            referralCode: generatedReferralCode,
            isPartner: portalRole === 'partner',
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Registration failed.');
        // API succeeded — go to login so they sign in properly
        setLoginEmail(phone);
        setLoginPassword('');
        setAuthMode('login');
        alert(`Your ${portalRole === 'partner' ? 'partner' : 'affiliate'} account is ready. Sign in with your phone number and password.`);
      } catch (registrationError: any) {
        // API failed — fall through to localStorage registration below
        console.warn('API registration failed, using localStorage:', registrationError?.message);
      }
    })();
    // NOTE: we do NOT return here anymore — we fall through to localStorage registration
    // so that registration works even when the API is unavailable

    const name = `${firstName.trim()} ${secondName.trim()}`;
    const email = `${firstName.toLowerCase().replace(/[^A-Za-z0-9]/g, "")}.${secondName.toLowerCase().replace(/[^A-Za-z0-9]/g, "")}${Math.floor(100 + Math.random() * 900)}@jasper-affiliate.com`;
    const cleanCode = `${firstName.substring(0, 5).replace(/[^A-Za-z0-9]/g, "").toUpperCase()}_${secondName.substring(0, 5).replace(/[^A-Za-z0-9]/g, "").toUpperCase()}_JAR_${Math.floor(100 + Math.random() * 900)}`;

    // Check for parent super-affiliate recruiter assignment
    let parentSuperId: string | undefined = undefined;
    const cleanParentCode = parentSuperCode.trim().toUpperCase();

    const immersiveCached = localStorage.getItem("saas_immersive_affiliates");
    let immersiveList: any[] = [];
    if (immersiveCached) {
      try {
        immersiveList = JSON.parse(immersiveCached);
      } catch (err) {}
    }

    const isRegisterSuper = portalRole === "partner";

    if (isRegisterSuper) {
      alert(
        `👑 Congratulations! You have successfully registered your Recruiting Partner network console on Jasper Africa. Start onboarding downlines right away!`,
      );
    } else if (cleanParentCode) {
      const parentMatch = immersiveList.find(
        (a: any) => a.promoCode.toUpperCase() === cleanParentCode && a.isSuper,
      );
      if (parentMatch) {
        parentSuperId = parentMatch.id;
        alert(
          `🤝 Welcome under Super Affiliate recruiter ${parentMatch.name}! You have registered under their team. You enjoy a 15% rate, and they get 5% oversight.`,
        );
      } else {
        alert(
          `⚠️ Recruiter code "${cleanParentCode}" was not found or is not active as a Super Affiliate! You have been registered as an Organic Affiliate directly with the main SaaS (15% direct commission).`,
        );
      }
    } else {
      alert(
        `🌿 Registered successfully as an Organic Affiliate. You are managed directly by us and get 15% direct commission.`,
      );
    }

    const assignedId = "aff-" + Math.floor(100 + Math.random() * 900);
    const newAff: Affiliate = {
      id: assignedId,
      name,
      email,
      phone,                              // WhatsApp login number
      paymentMethod,
      promoCode: cleanCode,
      parentSuperId,
      isSuper: isRegisterSuper,
      nidaNumber: nidaNumber || "N/A",
      tinNumber: tinNumber || "N/A",
      payoutPhone: payoutPhone || phone,  // Commission payout number (fallback to phone)
    };

    // Store in global affiliates list
    const existing = JSON.parse(
      localStorage.getItem("jasper_affiliates") || "[]",
    );
    existing.push(newAff);
    localStorage.setItem("jasper_affiliates", JSON.stringify(existing));

    const newImmersiveRecord = {
      id: assignedId,
      name,
      username: `@${name.toLowerCase().replace(/\s+/g, "_")}_referrals`,
      email,
      phone,                              // WhatsApp / login number
      payoutPhone: payoutPhone || phone,  // Commission payout number
      status: "Active",
      joinedDate: new Date().toISOString().split("T")[0],
      affiliateLink: `https://dukaplus.co.tz/ref/${cleanCode.toLowerCase()}`,
      promoCode: cleanCode,
      conversionsLink: 0,
      conversionsPromo: 0,
      totalEarnings: 0,
      revenueDate: 0,
      parentSuperId,
      isSuper: isRegisterSuper,
      monthlyEarnings: [
        { month: new Date().toISOString().substring(0, 7), amount: 0 },
      ],
      sessions: [],
      recentPayouts: [],
      paymentMethod,
      nidaNumber: nidaNumber || "N/A",
      tinNumber: tinNumber || "N/A",
    };

    immersiveList.push(newImmersiveRecord);
    localStorage.setItem(
      "saas_immersive_affiliates",
      JSON.stringify(immersiveList),
    );

    // Save active session
    localStorage.setItem("jasper_logged_affiliate", JSON.stringify(newAff));
    setActiveAffiliate(newAff);
    setAuthMode("dashboard");
    if (portalRole === 'partner') {
      setDatabaseAgentWorkspaceEnabled(true);
    } else {
      setDatabaseWorkspaceEnabled(true);
    }
  };

  const handleQuickDemoAffiliate = () => {
    setLoginEmail("+255700000010");
    setLoginPassword("password123");
    const defaultAffiliate: Affiliate = {
      id: "aff-demo-99",
      name: "Sarah Mwakasege",
      email: "partner@jasper.africa",
      phone: "0754 002 991",
      paymentMethod: "tigo_yas",
      promoCode: "SARAH_JASPER",
      isSuper: false,
      nidaNumber: "19951204-45129-00001-44",
      tinNumber: "124-954-122",
    };
    localStorage.setItem(
      "jasper_logged_affiliate",
      JSON.stringify(defaultAffiliate),
    );
    setActiveAffiliate(defaultAffiliate);
    setAuthMode("dashboard");
    setDatabaseWorkspaceEnabled(true);
  };

  const handleQuickDemoPartner = () => {
    setLoginEmail("+255700000011");
    setLoginPassword("password123");
    const defaultAffiliate: Affiliate = {
      id: "langa-super",
      name: "Deogratius Langa",
      email: "langa@jasper.com",
      phone: "+255 712 345 678",
      paymentMethod: "m-pesa",
      promoCode: "LANGA",
      isSuper: true,
      nidaNumber: "19880112-21110-00002-88",
      tinNumber: "109-883-994",
    };
    localStorage.setItem(
      "jasper_logged_affiliate",
      JSON.stringify(defaultAffiliate),
    );
    setActiveAffiliate(defaultAffiliate);
    setAuthMode("dashboard");
    setDatabaseAgentWorkspaceEnabled(true);
  };

  const handleLoginAffiliate = async (e: any) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      alert("Please enter your email and password");
      return;
    }

    try {
      const client: any = await getDynamicSupabaseClient();
      const normalizedLogin = loginEmail.trim();
      const authEmail = normalizedLogin.includes('@')
        ? normalizedLogin
        : `affiliate-${normalizedLogin.replace(/\D/g, '')}@jasper.local`;
      const { data: authData, error: authError } = await client.auth.signInWithPassword({
        email: authEmail,
        password: loginPassword,
      });
      if (authError || !authData?.user) {
        throw new Error(authError?.message || 'Sign in failed.');
      }

      if (portalRole === 'partner') {
        const agentWorkspace = await loadAffiliateAgentWorkspace();
        if (agentWorkspace?.affiliates.length) {
          setDatabaseAgentWorkspaceEnabled(true);
          setAuthMode('dashboard');
          return;
        }
      }

      const workspace = await loadAffiliateWorkspace();
      if (!workspace) {
        await client.auth.signOut();
        throw new Error('This account is not registered as an active affiliate.');
      }

      setActiveAffiliate({
        id: workspace.profile.id,
        name: workspace.profile.display_name,
        email: authData.user.email || '',
        phone: workspace.profile.payout_account || '',
        paymentMethod: workspace.profile.payout_method || 'm-pesa',
        promoCode: workspace.profile.referral_code,
      });
      setDatabaseWorkspaceEnabled(true);
      setAuthMode('dashboard');
      return;
    } catch (authFailure: any) {
      alert(authFailure?.message || 'Unable to sign in to the affiliate workspace.');
      return;
    }

    const isLoginSuper = portalRole === "partner";

    // 1. Seek in central SaaS Admin master list (supports seeded Langa Super Affiliate & assigned child affiliates)
    const rawImmersive = localStorage.getItem("saas_immersive_affiliates");
    if (rawImmersive) {
      try {
        const parsed = JSON.parse(rawImmersive);
        const match = parsed.find(
          (a: any) => (a.phone?.replace(/[^\d]/g, '') === loginEmail.replace(/[^\d]/g, '') || a.email?.toLowerCase() === loginEmail.toLowerCase()),
        );
        if (match) {
          const mappedAff: Affiliate = {
            id: match.id,
            name: match.name,
            email: match.email,
            phone: match.phone,
            paymentMethod: match.paymentMethod || "m-pesa",
            promoCode: match.promoCode,
            isSuper: isLoginSuper,
            targetReferrals: match.targetReferrals || 200,
            nidaNumber: match.nidaNumber || "N/A",
            tinNumber: match.tinNumber || "N/A",
          };
          localStorage.setItem(
            "jasper_logged_affiliate",
            JSON.stringify(mappedAff),
          );
          setActiveAffiliate(mappedAff);
          setAuthMode("dashboard");
          // Set the correct workspace flag based on portal role
          if (portalRole === 'partner') {
            setDatabaseAgentWorkspaceEnabled(true);
          } else {
            setDatabaseWorkspaceEnabled(true);
          }
          return;
        }
      } catch (err) {
        console.error("Error parsing immersive database", err);
      }
    }

    // 2. Fall back to custom locally registered affiliates
    const existing: Affiliate[] = JSON.parse(
      localStorage.getItem("jasper_affiliates") || "[]",
    );
    const match = existing.find(
      (a) => (a.phone?.replace(/[^\d]/g, '') === loginEmail.replace(/[^\d]/g, '') || a.email?.toLowerCase() === loginEmail.toLowerCase()),
    );

    if (match) {
      const mappedAff: Affiliate = {
        ...match,
        isSuper: isLoginSuper,
      };
      localStorage.setItem(
        "jasper_logged_affiliate",
        JSON.stringify(mappedAff),
      );
      setActiveAffiliate(mappedAff);
      setAuthMode("dashboard");
      // Set the correct workspace flag
      if (portalRole === 'partner') {
        setDatabaseAgentWorkspaceEnabled(true);
      } else {
        setDatabaseWorkspaceEnabled(true);
      }
    } else {
      // Allow seamless test fallback with email "partner@jasper.africa"
      const defaultAffiliate: Affiliate = {
        id: "aff-demo-99",
        name: "Sarah Mwakasege",
        email: loginEmail,
        phone: "0754 002 991",
        paymentMethod: "tigo_yas",
        promoCode: "SARAH_JASPER",
        isSuper: isLoginSuper,
      };
      localStorage.setItem(
        "jasper_logged_affiliate",
        JSON.stringify(defaultAffiliate),
      );
      setActiveAffiliate(defaultAffiliate);
      setAuthMode("dashboard");
      // Set the correct workspace flag
      if (portalRole === 'partner') {
        setDatabaseAgentWorkspaceEnabled(true);
      } else {
        setDatabaseWorkspaceEnabled(true);
      }
    }
  };

  const handleLogoutAffiliate = async () => {
    try {
      const client: any = await getDynamicSupabaseClient();
      await client.auth.signOut();
    } catch { /* Local cleanup still runs if the network is unavailable. */ }
    localStorage.removeItem("jasper_logged_affiliate");
    setActiveAffiliate(null);
    setDatabaseWorkspaceEnabled(false);
    setDatabaseAgentWorkspaceEnabled(false);
    setAuthMode("login");
  };

  const copyToClipboard = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCreative = (title: string, size: string, promo: string) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 300;
    let height = 250;
    if (size === "728x90") {
      width = 728;
      height = 90;
    } else if (size === "160x600") {
      width = 160;
      height = 600;
    } else if (size === "1:1") {
      width = 800;
      height = 800;
    } else if (size === "9:16") {
      width = 450;
      height = 800;
    }

    canvas.width = width;
    canvas.height = height;

    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, "#020617");
    grad.addColorStop(1, "#064e3b");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = width > 500 ? 8 : 4;
    ctx.strokeRect(2, 2, width - 4, height - 4);

    ctx.fillStyle = "#ffffff";
    if (size === "728x90") {
      ctx.font = "bold 20px sans-serif";
      ctx.fillText("JASPER POS Ledger - 100% Offline Suite", 25, 38);
      ctx.fillStyle = "#34d399";
      ctx.font = "bold 13px monospace";
      ctx.fillText(`PROMO: ${promo} (Get 1 Month Extended Trial)`, 25, 62);

      ctx.fillStyle = "#10b981";
      ctx.fillRect(520, 25, 180, 40);
      ctx.fillStyle = "#020617";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText("ANZA SASA BURE", 555, 49);
    } else if (size === "160x600") {
      ctx.font = "bold 24px sans-serif";
      ctx.fillText("JASPER", 20, 50);
      ctx.font = "bold 15px sans-serif";
      ctx.fillText("ERP Ledger", 20, 75);

      ctx.fillStyle = "#34d399";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText("100% Offline", 20, 120);
      ctx.fillText("Biashara Smart", 20, 140);

      ctx.fillStyle = "rgba(16, 185, 129, 0.1)";
      ctx.fillRect(10, 220, 140, 120);
      ctx.strokeStyle = "#10b981";
      ctx.strokeRect(10, 220, 140, 120);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px monospace";
      ctx.fillText("PROMO CODE:", 20, 250);
      ctx.fillStyle = "#34d399";
      ctx.font = "bold 15px monospace";
      ctx.fillText(promo, 25, 280);
      ctx.fillStyle = "#a7f3d0";
      ctx.font = "bold 8px sans-serif";
      ctx.fillText("1 MONTH FREE ON SIGNUP", 18, 315);

      ctx.fillStyle = "#10b981";
      ctx.fillRect(10, 480, 140, 45);
      ctx.fillStyle = "#020617";
      ctx.font = "bold 11px sans-serif";
      ctx.fillText("ACCESS NOW", 40, 507);
    } else if (size === "300x250") {
      ctx.font = "bold 22px sans-serif";
      ctx.fillText("JASPER Suite ERP", 20, 45);
      ctx.fillStyle = "#34d399";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText("Runs 100% Offline POS", 20, 75);

      ctx.fillStyle = "#ffffff";
      ctx.font = "12px sans-serif";
      ctx.fillText("For Retail, Wholesale, Restaurants,", 20, 110);
      ctx.fillText("Pharmacies and Hospitality.", 20, 128);

      ctx.fillStyle = "rgba(16, 185, 129, 0.1)";
      ctx.fillRect(20, 150, 260, 55);
      ctx.fillStyle = "#10b981";
      ctx.strokeRect(20, 150, 260, 55);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px monospace";
      ctx.fillText("PROMO COUPON (1 Month FREE):", 35, 170);
      ctx.fillStyle = "#34d399";
      ctx.font = "bold 16px monospace";
      ctx.fillText(promo, 35, 192);

      ctx.fillStyle = "#64748b";
      ctx.font = "10px sans-serif";
      ctx.fillText("No Credit Card Required • Fast & Reliable", 20, 230);
    } else if (size === "1:1") {
      ctx.font = "bold 42px sans-serif";
      ctx.fillText("JASPER POS & ERP", 50, 100);
      ctx.fillStyle = "#34d399";
      ctx.font = "bold 26px sans-serif";
      ctx.fillText("Tanzania Authorized SaaS Solution", 50, 145);

      ctx.fillStyle = "#ffffff";
      ctx.font = "20px sans-serif";
      ctx.fillText("✓ Runs 100% Offline - Never down", 50, 230);
      ctx.fillText("✓ Accepts Mobile money Instantly", 50, 280);
      ctx.fillText("✓ For Retail, Pharmacies & Restaurants", 50, 330);
      ctx.fillText("✓ Lucy assistant built-in for support", 50, 380);

      ctx.fillStyle = "rgba(16, 185, 129, 0.1)";
      ctx.fillRect(50, 440, 700, 180);
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 6;
      ctx.strokeRect(50, 440, 700, 180);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 18px monospace";
      ctx.fillText(
        "TUMIA PROMO CODE ILI UPATE MWEZI 1 WA BURE (30 DAYS FREE):",
        90,
        490,
      );
      ctx.fillStyle = "#10b981";
      ctx.font = "bold 54px monospace";
      ctx.fillText(promo, 90, 560);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText(
        "Hakuna malipo ya awali • Unganishwa instant na azampay / selcom",
        50,
        680,
      );

      ctx.fillStyle = "#34d399";
      ctx.font = "bold 24px sans-serif";
      ctx.fillText("JISAJILI KATIKA: https://jasper.africa", 50, 730);
    } else if (size === "9:16") {
      ctx.font = "bold 26px sans-serif";
      ctx.fillText("JASPER SAAS POWERHOUSE", 30, 80);
      ctx.fillStyle = "#34d399";
      ctx.font = "bold 18px sans-serif";
      ctx.fillText("100% Offline Retail Suite", 30, 120);

      ctx.fillStyle = "#ffffff";
      ctx.font = "16px sans-serif";
      ctx.fillText("✓ Cashier Tills POS", 30, 190);
      ctx.fillText("✓ Stock intelligence alerts", 30, 230);
      ctx.fillText("✓ Financial P&L indexes", 30, 275);
      ctx.fillText("✓ Lucy auto trainings", 30, 320);

      ctx.fillStyle = "rgba(16, 185, 129, 0.15)";
      ctx.fillRect(20, 390, 410, 180);
      ctx.strokeStyle = "#10b981";
      ctx.strokeRect(20, 390, 410, 180);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 12px monospace";
      ctx.fillText("EXCLUSIVE MERCHANTS DEAL:", 40, 430);
      ctx.fillStyle = "#10b981";
      ctx.font = "bold 42px monospace";
      ctx.fillText(promo, 40, 500);
      ctx.fillStyle = "#34d399";
      ctx.font = "bold 11px monospace";
      ctx.fillText("1 MONTH FREE FOR NEW SUBSCRIBERS", 40, 540);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText("Join Tanzania’s Pride ERP Today", 30, 620);
      ctx.fillStyle = "#64748b";
      ctx.font = "12px sans-serif";
      ctx.fillText("Visit Jasper.africa signup screen", 30, 650);
    }

    const imgURL = canvas.toDataURL("image/png");
    const dlLink = document.createElement("a");
    dlLink.download = `${title.replace(/\s+/g, "_").toLowerCase()}_${promo}.png`;
    dlLink.href = imgURL;
    document.body.appendChild(dlLink);
    dlLink.click();
    document.body.removeChild(dlLink);
  };

  // Read managed affiliates to calculate dynamic stats at the component scope for modals
  const rawImmersiveGlobal = localStorage.getItem("saas_immersive_affiliates");
  let managedKids: any[] = [];
  if (rawImmersiveGlobal) {
    try {
      const parsed = JSON.parse(rawImmersiveGlobal);
      // Fallback is active for mock super partner Langa
      managedKids = parsed.filter(
        (a: any) => a.parentSuperId === activeAffiliate?.id,
      );
    } catch (e) {}
  }

  // Filter subscribers to enforce tenant/affiliate data isolation strictly
  const currentAffiliateCode = activeAffiliate?.promoCode || "";
  const receivedTutorials = tutorialAssignments.filter(
    (assignment) => assignment.toId === activeAffiliate?.id,
  );
  const filteredSubscribers = subscribers.filter(
    (s) =>
      s.affiliateCode &&
      s.affiliateCode.trim().toUpperCase() === currentAffiliateCode.trim().toUpperCase()
  );

  // Calculate earnings
  const paidSubsCount = filteredSubscribers.filter((s) => s.status === "Paid").length;
  const totalEarnedCommissions = filteredSubscribers.reduce(
    (sum, s) => sum + s.commission,
    0,
  );

  // Calculate Last Friday of the Current Month Payout schedule
  const getPayoutDateString = () => {
    const d = new Date();
    // Start with the last day of the current month
    const year = d.getFullYear();
    const month = d.getMonth();
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Step blackwards until we find a Friday
    let day = lastDayOfMonth.getDay(); // 0 is Sunday, 5 is Friday
    let diff = 0;
    if (day >= 5) {
      diff = day - 5;
    } else {
      diff = day + 2; // e.g. Thursday is 4, needs 6 days back
    }
    const lastFriday = new Date(
      lastDayOfMonth.getTime() - diff * 24 * 60 * 60 * 1000,
    );
    return lastFriday.toLocaleDateString("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div
      id="affiliate-portal-view"
      className="min-h-screen bg-slate-950 text-slate-100 font-sans leading-normal selection:bg-emerald-500 selection:text-slate-950"
    >
      {/* Background radial effects */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-10 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-emerald-500/5 blur-[80px] sm:left-1/3 sm:h-[500px] sm:w-[500px] sm:translate-x-0 sm:blur-[100px]" />
        <div className="absolute bottom-10 right-4 h-52 w-52 rounded-full bg-blue-500/5 blur-[80px] sm:right-10 sm:h-[400px] sm:w-[400px] sm:blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        {/* Header navigation bar */}
        <header className="flex justify-between items-center py-4 border-b border-slate-900/60 h-16">
          <div
            className="flex items-center space-x-3 cursor-pointer"
            onClick={() => onNavigate("/")}
          >
            <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex items-center justify-center">
              <Award className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <span className="text-base font-bold text-white">
                Jasper{" "}
                <span className="text-emerald-400 font-normal">Affiliate</span>
              </span>
              <span className="block text-[8px] text-slate-400 font-mono tracking-widest uppercase">
                Earn 15% Recurring commission
              </span>
            </div>
          </div>

          <button
            onClick={() => onNavigate("/")}
            className="flex items-center space-x-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white rounded-xl transition-all border border-slate-800 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Homepage</span>
          </button>
        </header>

        {authMode === "dashboard" && databaseAgentWorkspaceEnabled ? (
          <AffiliateAgentDesk onLogout={handleLogoutAffiliate} />
        ) : authMode === "dashboard" && databaseWorkspaceEnabled ? (
          <AffiliateWorkspace onLogout={handleLogoutAffiliate} />
        ) : authMode === "dashboard" && activeAffiliate ? (
          // Fallback — workspace flags not set yet, use forcedRole/isSuper to decide
          (() => {
            if (forcedRole === 'partner' || activeAffiliate.isSuper === true) {
              setDatabaseAgentWorkspaceEnabled(true);
            } else {
              setDatabaseWorkspaceEnabled(true);
            }
            return null;
          })()
        ) : authMode !== "dashboard" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center py-6">
            {/* Left side: Pitch text — different for partner vs affiliate */}
            <div className="lg:col-span-6 space-y-8">
              {portalRole === 'partner' ? (
                <>
                  <div className="inline-flex items-center space-x-2 bg-amber-500/10 text-amber-400 px-3.5 py-1.5 rounded-full border border-amber-500/15 text-xs font-mono">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Jasper Partner Program</span>
                  </div>
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
                    Lead a Network.{" "}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-300">
                      Earn More as a Partner.
                    </span>
                  </h1>
                  <p className="text-slate-400 text-sm sm:text-base leading-relaxed font-light">
                    As a Jasper Partner (Super Affiliate Agent), you build and manage your own team of affiliates across Tanzania and East Africa. You earn{" "}
                    <strong className="text-amber-400">15% on your direct referrals</strong>{" "}
                    plus{" "}
                    <strong className="text-amber-400">5% oversight commission</strong>{" "}
                    on every sale made by affiliates under your network. No cap. No fine print.
                  </p>
                  <div className="space-y-4">
                    {[
                      { title: 'Recruit & Manage Affiliates', desc: 'Onboard affiliates under your network, assign promo codes, track their performance and send direct messages to your team.' },
                      { title: '5% Override on Every Team Sale', desc: 'Every time an affiliate under you makes a referral, you automatically earn 5% on top — paid monthly to your mobile wallet.' },
                      { title: 'Partner Command Dashboard', desc: 'Access a dedicated dashboard with network overview, monthly reconciliation, team management, and training tools for your downlines.' },
                    ].map(item => (
                      <div key={item.title} className="flex items-start space-x-3">
                        <div className="p-1 bg-amber-500/10 text-amber-400 rounded mt-0.5 shrink-0"><Check className="w-4 h-4" /></div>
                        <div>
                          <h5 className="text-sm font-bold text-slate-200">{item.title}</h5>
                          <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="inline-flex items-center space-x-2 bg-emerald-500/10 text-emerald-400 px-3.5 py-1.5 rounded-full border border-emerald-500/15 text-xs font-mono">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Jasper Affiliate Program</span>
                  </div>
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
                    Empower African Merchants.{" "}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                      Share & Earn 15%.
                    </span>
                  </h1>
                  <p className="text-slate-400 text-sm sm:text-base leading-relaxed font-light">
                    Join Tanzania and East Africa's fastest-growing retail suite. Recommend Jasper to shop owners and Pharmacy owners. For every monthly subscription they complete, you receive{" "}
                    <strong className="text-emerald-400">15% commission recurring</strong>, paid straight to your mobile wallet. No fine print. Just beautiful tools.
                  </p>
                  <div className="space-y-4">
                    {[
                      { title: 'Instant Verification Linking', desc: 'Custom reference URLs and Coupon registration inputs match sub-accounts.' },
                      { title: 'Guaranteed Monthly Payouts', desc: 'Funds are aggregated and dispatched 1 time every month on the last week Friday afternoon. Guaranteed.' },
                      { title: 'High Conversion Kits', desc: 'Get pre-designed HTML marketing copy banners, ready-made email newsletters, and templates to start referring today.' },
                    ].map(item => (
                      <div key={item.title} className="flex items-start space-x-3">
                        <div className="p-1 bg-emerald-500/10 text-emerald-400 rounded mt-0.5 shrink-0"><Check className="w-4 h-4" /></div>
                        <div>
                          <h5 className="text-sm font-bold text-slate-200">{item.title}</h5>
                          <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            {/* Right side: Clean Login Form */}
            <div className="lg:col-span-6 flex items-center justify-center">
              <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 p-8 rounded-3xl shadow-2xl backdrop-blur-md space-y-7">

                {/* Header */}
                <div className="text-center space-y-2">
                  <div className={`inline-flex p-3 rounded-2xl border items-center justify-center mb-1 ${portalRole === 'partner' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                    <img src="/jb-logo.png" alt="Jasper" className="w-10 h-10 object-contain" />
                  </div>
                  <h2 className="text-2xl font-black text-white tracking-tight">
                    {portalRole === 'partner' ? 'Partner Portal' : 'Affiliate Portal'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {portalRole === 'partner'
                      ? 'Sign in to your Super Affiliate Agent account'
                      : 'Sign in to your Affiliate account'}
                  </p>
                </div>

                {/* Login form */}
                {authMode === 'login' ? (
                  <form onSubmit={handleLoginAffiliate} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="e.g. +255 712 345 678"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className={`w-full bg-slate-950 border text-white placeholder-slate-600 outline-none rounded-2xl px-4 py-3.5 text-sm font-mono focus:ring-0 ${portalRole === 'partner' ? 'border-slate-700 focus:border-amber-500' : 'border-slate-700 focus:border-emerald-500'}`}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          type={showLoginPassword ? 'text' : 'password'}
                          required
                          placeholder="••••••••"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className={`w-full bg-slate-950 border text-white placeholder-slate-600 outline-none rounded-2xl px-4 py-3.5 pr-11 text-sm focus:ring-0 ${portalRole === 'partner' ? 'border-slate-700 focus:border-amber-500' : 'border-slate-700 focus:border-emerald-500'}`}
                        />
                        <button type="button" onClick={() => setShowLoginPassword(p => !p)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer">
                          {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button type="submit"
                      className={`w-full py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider transition-all cursor-pointer border-none flex items-center justify-center gap-2 ${portalRole === 'partner' ? 'bg-amber-500 hover:bg-amber-400 text-slate-950' : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'}`}>
                      Sign In <ArrowRight className="w-4 h-4" />
                    </button>

                    {/* Become a partner / affiliate link */}
                    <div className="text-center pt-2 border-t border-slate-800">
                      <p className="text-xs text-slate-500">
                        {portalRole === 'partner' ? "Don't have a partner account?" : "Don't have an affiliate account?"}
                      </p>
                      <button type="button" onClick={() => setAuthMode('register')}
                        className={`text-xs font-bold mt-1 cursor-pointer bg-transparent border-none ${portalRole === 'partner' ? 'text-amber-400 hover:text-amber-300' : 'text-emerald-400 hover:text-emerald-300'}`}>
                        {portalRole === 'partner' ? 'Become a Partner →' : 'Become an Affiliate →'}
                      </button>
                    </div>
                  </form>
                ) : portalRole === 'partner' && getPartnersCount() >= getPartnerCapacity() ? (
                  /* PARTNER CAPACITY REACHED */
                  <form onSubmit={handleWaitlistSubmit} className="space-y-5">
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-center">
                      <p className="text-xs text-amber-400 font-bold uppercase tracking-wider mb-1">Partner Program Full</p>
                      <p className="text-xs text-slate-400">Leave your details and we'll notify you when spots open.</p>
                    </div>
                    <input type="text" required placeholder="Your Full Name" value={waitlistName} onChange={e => setWaitlistName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 text-white placeholder-slate-600 outline-none rounded-2xl px-4 py-3 text-sm focus:border-amber-500" />
                    <input type="tel" required placeholder="Phone Number" value={waitlistPhone} onChange={e => setWaitlistPhone(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 text-white placeholder-slate-600 outline-none rounded-2xl px-4 py-3 text-sm focus:border-amber-500 font-mono" />
                    <button type="submit" className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm cursor-pointer border-none">
                      Join Waitlist
                    </button>
                    <button type="button" onClick={() => setAuthMode('login')}
                      className="w-full text-xs text-slate-500 hover:text-slate-300 cursor-pointer bg-transparent border-none">
                      ← Back to Login
                    </button>
                  </form>
                ) : (
                  /* REGISTER FORM */
                  <form onSubmit={handleRegisterAffiliate} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">First Name</label>
                        <input type="text" required placeholder="e.g. Sarah" value={firstName} onChange={e => setFirstName(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 text-white placeholder-slate-600 outline-none rounded-2xl px-3 py-3 text-sm focus:border-emerald-500" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Second Name</label>
                        <input type="text" required placeholder="e.g. Mwakasege" value={secondName} onChange={e => setSecondName(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 text-white placeholder-slate-600 outline-none rounded-2xl px-3 py-3 text-sm focus:border-emerald-500" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        WhatsApp Number <span className="text-[9px] text-slate-500 normal-case font-normal">(used as login)</span>
                      </label>
                      <input type="tel" required placeholder="e.g. +255 712 345 678" value={phone} onChange={e => setPhone(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 text-white placeholder-slate-600 outline-none rounded-2xl px-4 py-3 text-sm font-mono focus:border-emerald-500" />
                      <p className="text-[9px] text-slate-500">This number will be your login username.</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Commission Payout Number <span className="text-[9px] text-slate-500 normal-case font-normal">(mobile money)</span>
                      </label>
                      <input type="tel" required placeholder="e.g. 0754 002 991" value={payoutPhone} onChange={e => setPayoutPhone(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 text-white placeholder-slate-600 outline-none rounded-2xl px-4 py-3 text-sm font-mono focus:border-emerald-500" />
                      <div className="flex items-start gap-1.5 p-2.5 bg-blue-500/8 border border-blue-500/20 rounded-xl">
                        <span className="text-blue-400 text-[10px] shrink-0">ℹ️</span>
                        <p className="text-[9px] text-blue-300 leading-relaxed">
                          <strong>Muhimu:</strong> Weka namba ya simu iliyosajiliwa na Kitambulisho chako cha NIDA chenye jina lako kamili. Namba hii itatumika kuthibitisha utambulisho wako wakati wa malipo ya kamisheni. Namba tofauti na NIDA inaweza kusababisha ucheleweshaji au kuzuiwa kwa malipo.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Payout Provider</label>
                      <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 text-slate-300 outline-none rounded-2xl px-4 py-3 text-sm focus:border-emerald-500 cursor-pointer">
                        <option value="m-pesa">Vodacom M-Pesa</option>
                        <option value="tigo_yas">Mixx by Yas</option>
                        <option value="airtel_money">Airtel Money</option>
                        <option value="halopesa">Halopesa</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">NIDA ID <span className="text-rose-400">*</span></label>
                        <input type="text" required placeholder="19951204-45129-00001-44" value={nidaNumber} onChange={e => setNidaNumber(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 text-white placeholder-slate-600 outline-none rounded-2xl px-3 py-3 text-xs font-mono focus:border-amber-500" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">TIN (Optional)</label>
                        <input type="text" placeholder="124-954-122" value={tinNumber} onChange={e => setTinNumber(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 text-white placeholder-slate-600 outline-none rounded-2xl px-3 py-3 text-xs font-mono focus:border-emerald-500" />
                      </div>
                    </div>

                    {/* Partner code — only shown for affiliates, NOT for partners */}
                    {portalRole !== 'partner' && (
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-teal-400 uppercase tracking-wider block">
                          Partner Code <span className="text-rose-400">*</span>
                        </label>
                        <input type="text" placeholder="e.g. LANGA" value={parentSuperCode} onChange={e => setParentSuperCode(e.target.value)}
                          className={`w-full bg-slate-950 border text-white placeholder-slate-600 outline-none rounded-2xl px-4 py-3 text-sm font-mono text-center tracking-widest uppercase focus:border-teal-500 ${parentSuperCode.trim() ? 'border-teal-500' : 'border-rose-500/50'}`} />
                        <p className="text-[9px] text-slate-500">Enter the promo code of the Partner who recruited you. Required.</p>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Password</label>
                      <div className="relative">
                        <input type={showPassword ? 'text' : 'password'} required placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 text-white placeholder-slate-600 outline-none rounded-2xl px-4 py-3 pr-10 text-sm focus:border-emerald-500" />
                        <button type="button" onClick={() => setShowPassword(p => !p)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer">
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 p-3 bg-slate-950 border border-slate-800 rounded-xl">
                      <input type="checkbox" id="terms-check" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} className="mt-0.5 cursor-pointer" />
                      <label htmlFor="terms-check" className="text-[10px] text-slate-400 leading-relaxed cursor-pointer">
                        I agree to the{' '}
                        <button type="button" onClick={() => setShowTermsModal(true)} className="text-emerald-400 hover:text-emerald-300 cursor-pointer bg-transparent border-none font-bold">
                          Terms & Conditions
                        </button>
                      </label>
                    </div>

                    <button type="submit" disabled={!acceptedTerms}
                      className={`w-full py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider transition-all cursor-pointer border-none ${acceptedTerms ? portalRole === 'partner' ? 'bg-amber-500 hover:bg-amber-400 text-slate-950' : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}>
                      {portalRole === 'partner' ? 'Create Partner Account' : 'Create Affiliate Account'}
                    </button>

                    <div className="text-center">
                      <button type="button" onClick={() => setAuthMode('login')}
                        className="text-xs text-slate-500 hover:text-slate-300 cursor-pointer bg-transparent border-none">
                        ← Already have an account? Sign In
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        ) : activeAffiliate?.isSuper ? (
          /* Premium Super Affiliate Portfolio Dashboard */
          <div className="space-y-8 animate-fade-in text-left border-0 p-0 m-0">
            {/* Header info */}
            <div className="bg-slate-900 border border-slate-850 p-6 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-1">
                <span className="bg-teal-500/10 text-teal-400 border border-teal-500/20 text-[9.5px] uppercase font-bold px-2 py-0.5 rounded-lg font-mono tracking-wider">
                  Super Affiliate Master Panel
                </span>
                <h2 className="text-xl font-extrabold text-white">
                  Karibu Sana, {activeAffiliate?.name}!
                </h2>
                <p className="text-xs text-slate-400">
                  Manage direct sub-affiliates, consult learning materials, run
                  live video calls, and inspect client SaaS records.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="px-3 py-1.5 bg-slate-950 border border-slate-850 rounded-xl font-mono text-xs flex items-center space-x-2 shrink-0">
                  <Smartphone className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <span className="text-slate-500 uppercase text-[9px]">
                    Master Code:
                  </span>
                  {isEditingPromo ? (
                    <div className="space-y-2">
                      {/* ⚠️ Caution notice */}
                      <div className="flex items-start gap-1.5 p-2.5 bg-amber-500/10 border border-amber-500/25 rounded-xl">
                        <span className="text-amber-400 text-[10px] shrink-0 mt-0.5">⚠️</span>
                        <p className="text-[9px] text-amber-300 leading-relaxed">
                          <strong>Tahadhari:</strong> Unaweza kubadilisha promo code mara moja tu. Ukibadilisha, kuwa makini sana — mabadiliko mengi yanaweza kuzuia system kufuatilia taarifa zako na malipo yako. Hakikisha unachagua code utakayoitumia kwa muda mrefu.
                        </p>
                      </div>
                      <form onSubmit={handleUpdatePromoCode} className="flex items-center space-x-1">
                        <input
                          type="text"
                          className={`bg-slate-900 border text-teal-400 uppercase text-xs font-bold px-1 rounded focus:outline-none w-28 ${promoError ? 'border-rose-500' : 'border-teal-500'}`}
                          value={newPromoInput}
                          onChange={(e) => { setNewPromoInput(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "")); setPromoError(null); setPromoSuggestions([]); }}
                          maxLength={20}
                          autoFocus
                        />
                        <button type="submit" className="text-emerald-400 hover:text-emerald-300 font-bold text-[10px]">Save</button>
                        <button type="button" onClick={() => { setIsEditingPromo(false); setPromoError(null); setPromoSuggestions([]); }} className="text-slate-400 hover:text-white text-[10px]">✕</button>
                      </form>
                      {promoError && (
                        <div className="space-y-1">
                          <p className="text-[9px] text-rose-400 font-bold">{promoError}</p>
                          {promoSuggestions.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="text-[8px] text-slate-500">Try:</span>
                              {promoSuggestions.map(s => (
                                <button key={s} type="button" onClick={() => { setNewPromoInput(s); setPromoError(null); setPromoSuggestions([]); }}
                                  className="text-[9px] text-teal-400 bg-teal-500/10 border border-teal-500/20 px-1.5 py-0.5 rounded font-bold cursor-pointer hover:bg-teal-500/20">
                                  {s}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1.5">
                      <span className="text-white font-bold">
                        {activeAffiliate?.promoCode}
                      </span>
                      <button
                        onClick={() => {
                          setNewPromoInput(activeAffiliate?.promoCode || "");
                          setIsEditingPromo(true);
                        }}
                        className="text-slate-500 hover:text-teal-400 transition-colors"
                        title="Edit Master Code"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleLogoutAffiliate}
                  className="px-3 py-1.5 hover:bg-slate-800 text-slate-400 hover:text-rose-400 text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-200 cursor-pointer border border-slate-800"
                >
                  Log Out
                </button>
              </div>
            </div>

            {/* TRA TAX OVERRIDE WARNS */}
            <div className="bg-amber-500/10 border border-amber-500/25 p-4 rounded-2xl flex items-start space-x-3 text-xs text-amber-200">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
              <div className="space-y-1 font-light">
                <span className="font-bold text-[11px] uppercase tracking-wider font-mono block text-amber-400">
                  ⚠️ Central TRA Compliance Guidelines (Grace Period Status:
                  Active)
                </span>
                <p className="leading-relaxed">
                  Withholding tax (WHT) of{" "}
                  <strong className="text-white font-bold">5%</strong> will be
                  introduced on commissions in the future. Today,{" "}
                  <strong className="text-white font-bold">
                    no tax is withheld
                  </strong>
                  ! You and your direct downline marketers receive 100% of
                  earnings.
                </p>
              </div>
            </div>

            {/* RESPONSIVE SIDEBAR + TAB CONTENT */}
            <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
              {/* SIDEBAR NAVIGATION */}
              <div className="w-full lg:w-64 shrink-0 flex flex-col gap-1.5 border-b lg:border-b-0 lg:border-r border-slate-850 pb-4 lg:pb-0 lg:pr-6">
                {[
                  { id: "overview", key: "network overview", name: "Network Overview", icon: Layers },
                  {
                    id: "reconciliation",
                    key: "monthly reconciliation",
                    name: "Monthly Reconciliation",
                    icon: DollarSign,
                  },
                  { id: "manage", key: "manage sub-affiliates", name: "Manage Sub-Affiliates", icon: Users },
                  { id: "sessions", key: "tutorials and lessons", name: "Tutorials & Lessons", icon: BookOpen },
                  {
                    id: "conferencing",
                    key: "video conferencing call",
                    name: "Video Conferencing Call",
                    icon: Video,
                  },
                  { id: "hw-pos", key: "hardware pos", name: "Hardware POS", icon: ShoppingCart },
                  {
                    id: "hw-inventory",
                    key: "hardware inventory",
                    name: "Hardware Inventory",
                    icon: Package,
                  },
                ].map((item) => {
                  const IconComp = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSuperActiveTab(item.id as any);
                      }}
                      className={`w-full px-4 py-3 rounded-xl text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-start gap-3 transition-all cursor-pointer ${
                        superActiveTab === item.id
                          ? "bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/10"
                          : "text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent"
                      }`}
                    >
                      <IconComp className={`w-4 h-4 shrink-0 ${superActiveTab === item.id ? "text-slate-950" : "text-slate-500"}`} />
                      <span className="text-left leading-tight">
                        {t[item.key] || item.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* TAB CONTENT PORTALS */}
              <div className="flex-1 min-w-0 w-full">
                {(() => {
              // Retrieve child partners registered under this Super Recruiter
              const rawImmersive = localStorage.getItem(
                "saas_immersive_affiliates",
              );
              let managedKids: any[] = [];
              if (rawImmersive) {
                try {
                  const parsed = JSON.parse(rawImmersive);
                  managedKids = parsed.filter(
                    (a: any) => a.parentSuperId === activeAffiliate?.id,
                  );
                } catch (e) {}
              }

              const totalConversions = managedKids.reduce(
                (sum, a) => sum + (a.conversionsPromo || 0),
                0,
              );
              const totalRevenue = managedKids.reduce(
                (sum, a) => sum + (a.revenueGenerated || 0),
                0,
              );
              const totalEarnings = Math.round(totalRevenue * 0.05); // 5% oversight master rate
              const target = activeAffiliate?.targetReferrals || 200;
              const progressPct = Math.min(
                100,
                Math.round((totalConversions / target) * 100),
              );

              // 1. OVERVIEW SCREEN
              if (superActiveTab === "overview") {
                return (
                  <div className="space-y-8 animate-fade-in">
                    {/* Key Metrics block */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div className="bg-slate-900 border border-slate-850/70 p-5 rounded-2xl space-y-4 relative overflow-hidden">
                        <div className="absolute top-4 right-4 text-emerald-400/10">
                          <Target className="w-6 h-6" />
                        </div>
                        <dt className="text-[10px] uppercase font-mono tracking-widest text-slate-400 block">
                          Quota Progression
                        </dt>
                        <div className="space-y-2 pt-1">
                          <dd className="text-2xl font-extrabold text-white font-mono">
                            {totalConversions} / {target}
                          </dd>
                          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden p-0.5 border border-slate-850">
                            <div
                              className="bg-gradient-to-r from-teal-500 to-emerald-500 h-full rounded-full"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                          <span className="text-[9.5px] text-slate-400 font-mono block">
                            {progressPct}% achieved · need{" "}
                            {Math.max(0, target - totalConversions)} more
                          </span>
                        </div>
                      </div>

                      <div className="bg-slate-900 border border-slate-850/70 p-5 rounded-2xl space-y-2 relative overflow-hidden">
                        <div className="absolute top-4 right-4 text-teal-400/20">
                          <DollarSign className="w-6 h-6" />
                        </div>
                        <dt className="text-[10px] uppercase font-mono tracking-widest text-slate-400">
                          Total Oversight 5% Share
                        </dt>
                        <dd className="text-3xl font-extrabold text-teal-400 font-mono">
                          TSh {totalEarnings.toLocaleString()}
                        </dd>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Generated by 15% standard downlines
                        </div>
                      </div>

                      <div className="bg-slate-900 border border-slate-850/70 p-5 rounded-2xl space-y-2 relative overflow-hidden">
                        <div className="absolute top-4 right-4 text-indigo-400/20">
                          <Users className="w-6 h-6" />
                        </div>
                        <dt className="text-[10px] uppercase font-mono tracking-widest text-slate-400">
                          Team Active Marketers
                        </dt>
                        <dd className="text-3xl font-extrabold text-white font-mono">
                          {managedKids.length} Registered
                        </dd>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Direct affiliate channels
                        </div>
                      </div>

                      <div className="bg-slate-900 border border-slate-850/70 p-5 rounded-2xl space-y-2 relative overflow-hidden">
                        <div className="absolute top-4 right-4 text-slate-700/30">
                          <Clock className="w-6 h-6 animate-pulse" />
                        </div>
                        <dt className="text-[10px] uppercase font-mono tracking-widest text-slate-400">
                          Next Ledger Payout Date
                        </dt>
                        <dd className="text-base font-black text-amber-400 font-mono py-1 uppercase">
                          {getPayoutDateString()}
                        </dd>
                        <div className="text-[9.5px] text-slate-400 font-mono">
                          Direct Mixx by Yas / M-Pesa wallets dispatch
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                      {/* Downstream subline table summary */}
                      <div className="lg:col-span-8 bg-slate-900/60 border border-slate-850/80 p-6 rounded-2xl space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                          <div>
                            <h3 className="text-sm font-bold text-white flex items-center gap-1.5 font-sans uppercase tracking-tight">
                              <Users className="w-4 h-4 text-teal-400" />
                              <span>Your Supervised Downline Team Network</span>
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Real-time stats of referred downlines. Head to the
                              'Manage Sub-Affiliates' tab to add, edit, or
                              remove entries.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowRosterModal(true)}
                            className="bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/20 px-3.5 py-2 rounded-xl text-xs font-mono font-semibold uppercase tracking-wider transition-all cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <span>📋 Pull TIN Roster</span>
                          </button>
                        </div>

                        {managedKids.length === 0 ? (
                          <div className="p-8 text-center text-xs text-slate-500 font-sans font-light bg-slate-950 rounded-xl border border-slate-850/30">
                            No active partner marketers currently assigned under
                            your supervision code. Click the 'Manage
                            Sub-Affiliates' tab to add your first marketer!
                          </div>
                        ) : (
                          <div className="bg-slate-950 border border-slate-850/60 rounded-xl overflow-hidden">
                            <div className="overflow-x-auto text-xs">
                              <table className="w-full text-left">
                                <thead className="bg-slate-900 border-b border-slate-850 text-slate-500 text-[9px] uppercase font-mono font-bold">
                                  <tr>
                                    <th className="p-3">Marketer Partner</th>
                                    <th className="p-3 font-mono">
                                      Promo Code
                                    </th>
                                    <th className="p-3 text-right">
                                      Promo Users
                                    </th>
                                    <th className="p-3 text-right">
                                      Team Revenue
                                    </th>
                                    <th className="p-3 text-right">
                                      5% Oversight Reward
                                    </th>
                                    <th className="p-3 text-center">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-905 text-[11px] font-sans text-slate-400">
                                  {managedKids.map((kid: any) => {
                                    const kidOversightEarn = Math.round(
                                      (kid.revenueGenerated || 0) * 0.05,
                                    );
                                    return (
                                      <tr
                                        key={kid.id}
                                        className="hover:bg-slate-900/40"
                                      >
                                        <td className="p-3">
                                          <div className="font-bold text-white block">
                                            {kid.name}
                                          </div>
                                          <div className="text-[10px] text-slate-400">
                                            {kid.email}
                                          </div>
                                        </td>
                                        <td className="p-3 text-amber-400 font-mono font-bold uppercase">
                                          {kid.promoCode}
                                        </td>
                                        <td className="p-3 text-right font-mono text-slate-300">
                                          {kid.conversionsPromo || 0}
                                        </td>
                                        <td className="p-3 text-right font-mono text-emerald-400 font-bold">
                                          TSh{" "}
                                          {(
                                            kid.revenueGenerated || 0
                                          ).toLocaleString()}
                                        </td>
                                        <td className="p-3 text-right font-mono text-teal-400 font-bold text-[12px]">
                                          TSh{" "}
                                          {kidOversightEarn.toLocaleString()}
                                        </td>
                                        <td className="p-3 text-center">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setSuperActiveTab("manage");
                                            }}
                                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono font-bold text-[9.5px] uppercase rounded transition cursor-pointer inline-flex items-center gap-1"
                                          >
                                            <span>Manage</span>
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Recruiter Resources preview */}
                      <div className="lg:col-span-4 bg-slate-900/60 border border-slate-850/80 p-6 rounded-2xl space-y-4">
                        <div>
                          <h3 className="text-sm font-bold text-white flex items-center gap-1.5 font-sans uppercase tracking-tight">
                            <Award className="w-4 h-4 text-emerald-400" />
                            <span>Quick Pitch Script</span>
                          </h3>
                        </div>

                        <div className="p-4 bg-slate-950 text-slate-400 text-[11px] rounded-xl border border-slate-850/60 leading-relaxed font-sans space-y-2">
                          <span className="font-bold text-teal-400 uppercase font-mono block text-[9px]">
                            Langa Recruiter Pitch:
                          </span>
                          <p className="italic font-light">
                            "Anza kurahisisha hesabu za biashara yako leo kwa
                            kutumia Jasper POS inayofanya kazi bila internet!
                            Watapata siku 30 za bure kwa kutumia promo code
                            yangu."
                          </p>
                        </div>

                        <div className="pt-2 text-xs font-mono text-slate-400">
                          <span className="font-bold block uppercase text-white mb-2">
                            Pitch Guidelines:
                          </span>
                          <ul className="list-disc pl-4 space-y-1 text-[11px]">
                            <li>Focus on Pharmacy, Retail & Dine niches.</li>
                            <li>Emphasize Offline operation structure.</li>
                            <li>Target 150+ signups for bonus.</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Dispute Claims and Grievances Support Feed */}
                    <div className="bg-slate-900/60 border border-slate-850/80 p-6 rounded-2xl space-y-6">
                      <div>
                        <h3 className="text-sm uppercase font-mono font-black text-teal-400 flex items-center space-x-2">
                          <span className="text-base">📥</span>
                          <span>
                            Downline Affiliate Inquiries & Dispute Tickets
                          </span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5 font-sans font-light">
                          Inquiries and payout grievances filed by
                          sub-affiliates in your direct invite subline. Direct
                          review and reply is required.
                        </p>
                      </div>

                      {(() => {
                        const claims = JSON.parse(
                          localStorage.getItem("saas_affiliate_claims") || "[]",
                        );
                        const filteredClaims = claims.filter(
                          (c: any) => c.parentSuperId === activeAffiliate?.id,
                        );

                        if (filteredClaims.length === 0) {
                          return (
                            <div className="p-8 text-center text-xs text-slate-500 font-sans italic bg-slate-950 rounded-xl border border-slate-850/45">
                              Your team affiliate network is operating smoothly!
                              No disputes or payment inquiries have been
                              submitted.
                            </div>
                          );
                        }

                        return (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
                            {filteredClaims.map((claim: any) => (
                              <div
                                key={claim.id}
                                className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col justify-between space-y-4 text-left"
                              >
                                <div className="space-y-2">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <span className="text-[10px] bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded font-mono font-bold tracking-widest">
                                        {claim.id}
                                      </span>
                                      <h4 className="text-xs font-bold text-white mt-1.5">
                                        {claim.category}
                                      </h4>
                                    </div>
                                    <span className="text-[9.5px] font-mono text-slate-550">
                                      {claim.timestamp}
                                    </span>
                                  </div>

                                  <div className="bg-slate-905 p-2.5 rounded border border-slate-850 text-xs italic text-slate-400 font-mono leading-relaxed bg-slate-900/60">
                                    "{claim.message}"
                                  </div>

                                  <div className="text-[10.5px] text-slate-400 flex justify-between items-center">
                                    <span>
                                      From:{" "}
                                      <strong>{claim.affiliateName}</strong> (
                                      {claim.affiliatePromo})
                                    </span>
                                    <span
                                      className={`px-1.5 py-0.2 rounded font-mono text-[9px] font-bold uppercase ${
                                        claim.status === "Resolved"
                                          ? "bg-emerald-500/15 text-emerald-400"
                                          : "bg-amber-500/15 text-amber-400"
                                      }`}
                                    >
                                      {claim.status}
                                    </span>
                                  </div>
                                </div>

                                <div className="border-t border-slate-900/60 pt-3">
                                  {claim.reply ? (
                                    <div className="bg-teal-500/5 p-2.5 rounded border border-teal-500/10 text-[10.5px] text-teal-350 leading-relaxed font-sans">
                                      <strong className="text-slate-500 font-mono text-[9px] uppercase block tracking-wider mb-1">
                                        Your official reply comment:
                                      </strong>
                                      "{claim.reply}"
                                    </div>
                                  ) : (
                                    <form
                                      onSubmit={(e) => {
                                        e.preventDefault();
                                        const formInput =
                                          e.currentTarget.elements.namedItem(
                                            "replyText",
                                          ) as HTMLInputElement;
                                        const replyVal = formInput?.value || "";
                                        if (!replyVal.trim())
                                          return alert(
                                            "Please enter response comment.",
                                          );

                                        const centralClaims = JSON.parse(
                                          localStorage.getItem(
                                            "saas_affiliate_claims",
                                          ) || "[]",
                                        );
                                        const idx = centralClaims.findIndex(
                                          (x: any) => x.id === claim.id,
                                        );
                                        if (idx !== -1) {
                                          centralClaims[idx].status =
                                            "Resolved";
                                          centralClaims[idx].reply = replyVal;
                                          localStorage.setItem(
                                            "saas_affiliate_claims",
                                            JSON.stringify(centralClaims),
                                          );
                                          alert(
                                            "✓ Claim inquiry resolved with reply comment!",
                                          );
                                          formInput.value = "";
                                          window.dispatchEvent(
                                            new CustomEvent(
                                              "saas_claims_reload",
                                            ),
                                          );
                                        }
                                      }}
                                      className="flex items-center space-x-2"
                                    >
                                      <input
                                        name="replyText"
                                        type="text"
                                        required
                                        placeholder="Type resolution response comment..."
                                        className="flex-1 bg-slate-90 px-3 py-1.5 text-xs text-white placeholder-slate-600 outline-none focus:border-teal-500 font-sans rounded bg-slate-900 border border-slate-800"
                                      />
                                      <button
                                        type="submit"
                                        className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded font-bold text-[10px] uppercase cursor-pointer transition-colors shrink-0"
                                      >
                                        Resolve
                                      </button>
                                    </form>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              }

              // 1.5 RECONCILIATION SCREEN
              if (superActiveTab === "reconciliation") {
                const superCommissionTotal = totalRevenue * 0.2;
                const superAgentCut = totalRevenue * 0.05;
                const subAffiliatesCut = totalRevenue * 0.15;
                const hasTIN =
                  !!activeAffiliate?.tinNumber &&
                  activeAffiliate?.tinNumber.trim() !== "";
                const taxRate = hasTIN ? 0.05 : 0.15;
                const superAgentWithholdingTax = superCommissionTotal * taxRate;

                return (
                  <div className="space-y-6 animate-fade-in text-left">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
                      <div className="mb-6 flex flex-col md:flex-row md:justify-between border-b border-slate-800 pb-4">
                        <div>
                          <h3 className="text-sm uppercase font-mono font-bold text-teal-400 tracking-widest flex items-center gap-2">
                            <DollarSign className="w-4 h-4" /> Monthly
                            Reconciliation Report
                          </h3>
                          <p className="text-[11px] text-slate-400 mt-1">
                            Automated breakdown of your 20% team payout fund.
                          </p>
                        </div>
                        <div className="mt-4 md:mt-0 flex flex-col sm:flex-row gap-2">
                          <button
                            type="button"
                            onClick={() => window.print()}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider cursor-pointer inline-flex items-center justify-center gap-2 print:hidden"
                          >
                            Download Monthly Payout Summary
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const csvRows = [
                                ["Description", "Amount (TSh)"],
                                ["Generated Network Revenue", totalRevenue],
                                ["20% Total Payout Fund", superCommissionTotal],
                                ["15% Share to Sub-Affiliates", subAffiliatesCut],
                                ["5% Master Agent Cut", superAgentCut],
                                [
                                  "Withholding Tax (TRA)",
                                  superAgentWithholdingTax,
                                ],
                              ];
                              const csvContent =
                                "data:text/csv;charset=utf-8," +
                                csvRows.map((e) => e.join(",")).join("\n");
                              const link = document.createElement("a");
                              link.setAttribute("href", encodeURI(csvContent));
                              link.setAttribute(
                                "download",
                                `Super_Agent_Reconciliation_${activeAffiliate?.name.replace(/ /g, "_")}.csv`,
                              );
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              alert(
                                "📥 Reconciliation report exported successfully!",
                              );
                            }}
                            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider cursor-pointer inline-flex items-center justify-center gap-2 print:hidden"
                          >
                            Export CSV Report
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col justify-center">
                          <div className="text-[10px] text-slate-500 uppercase font-mono tracking-wider font-bold mb-1">
                            Total Team Revenue
                          </div>
                          <div className="text-xl font-bold font-mono text-white">
                            TSh {totalRevenue.toLocaleString()}
                          </div>
                          <div className="text-[9px] text-slate-500 mt-2 leading-tight">
                            Network volume.
                          </div>
                        </div>

                        <div className="bg-amber-950/20 p-4 rounded-xl border border-amber-900/40 flex flex-col justify-center">
                          <div className="text-[10px] text-amber-500 uppercase font-mono tracking-wider font-bold mb-1">
                            20% Total Fund
                          </div>
                          <div className="text-xl font-bold font-mono text-amber-400">
                            TSh {superCommissionTotal.toLocaleString()}
                          </div>
                          <div className="text-[9px] text-slate-500 mt-2 leading-tight">
                            Allocated from total company revenue.
                          </div>
                        </div>

                        <div className="bg-indigo-950/20 p-4 rounded-xl border border-indigo-900/40 flex flex-col justify-center">
                          <div className="text-[10px] text-indigo-400 uppercase font-mono tracking-wider font-bold mb-1">
                            15% Sub-Affiliate Due
                          </div>
                          <div className="text-xl font-bold font-mono text-indigo-400">
                            TSh {subAffiliatesCut.toLocaleString()}
                          </div>
                          <div className="text-[9px] text-slate-500 mt-2 leading-tight">
                            Amount that you must pay to your agents.
                          </div>
                        </div>

                        <div className="bg-teal-950/20 p-4 rounded-xl border border-teal-900/40 flex flex-col justify-center">
                          <div className="text-[10px] text-teal-500 uppercase font-mono tracking-wider font-bold mb-1">
                            5% Your Master Cut
                          </div>
                          <div className="text-xl font-bold font-mono text-teal-400">
                            TSh {superAgentCut.toLocaleString()}
                          </div>
                          <div className="text-[9px] text-slate-500 mt-2 leading-tight">
                            Your retained earnings from the network.
                          </div>
                        </div>
                      </div>

                      <div className="bg-rose-950/20 p-4 rounded-xl border border-rose-900/40 mt-4 relative overflow-hidden flex flex-col justify-center">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl" />
                        <div className="text-[10px] text-rose-500 uppercase font-mono tracking-wider font-bold mb-1">
                          Withheld Tax ({hasTIN ? "5%" : "15%"})
                        </div>
                        <div className="text-xl font-bold font-mono text-rose-400 relative z-10">
                          TSh {superAgentWithholdingTax.toLocaleString()}
                        </div>
                        <div className="text-[9px] text-slate-500 mt-2 leading-tight relative z-10">
                          Calculated on the 20% Total Fund pending TRA transfer.
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // 2. MANAGE SUB-AFFILIATES (CRUD) SCREEN
              if (superActiveTab === "manage") {
                const searchLC = superManageSearch.toLowerCase();
                const filteredKids = managedKids.filter(
                  (k) =>
                    k.name.toLowerCase().includes(searchLC) ||
                    k.email.toLowerCase().includes(searchLC) ||
                    k.promoCode.toLowerCase().includes(searchLC) ||
                    k.phone.includes(searchLC),
                );

                return (
                  <div className="space-y-6 animate-fade-in">
                    {/* Header Controls for Manage section */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 p-6 rounded-2xl border border-slate-850">
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider font-mono">
                          <Users className="w-4 h-4 text-emerald-400" />
                          <span>Direct Downstream Channels Organization</span>
                        </h3>
                        <p className="text-xs text-slate-400">
                          Onboard new direct network partners, edit registration
                          metadata, delete affiliates, and emit system direct
                          messages.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setAddAffPromo(
                            (activeAffiliate?.promoCode || "LANGA") +
                              "-" +
                              Math.floor(10 + Math.random() * 90),
                          );
                          setShowAddAffiliateModal(true);
                        }}
                        className="w-full md:w-auto px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 shrink-0 active:scale-95"
                      >
                        <PlusCircle className="w-4 h-4" />
                        <span>Onboard Downline Marketer</span>
                      </button>
                    </div>

                    {/* Search & Statistics Filter Bar */}
                    <div className="relative font-sans">
                      <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        value={superManageSearch}
                        onChange={(e) => setSuperManageSearch(e.target.value)}
                        placeholder="Search affiliates..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-xs text-white placeholder-slate-500 outline-none focus:border-teal-400 font-sans"
                      />
                    </div>

                    {/* Downline network partner list */}
                    {filteredKids.length === 0 ? (
                      <div className="p-12 text-center text-xs text-slate-500 bg-slate-950 border border-slate-850 rounded-xl italic">
                        {superManageSearch
                          ? "No sub-affiliate entries match your search filters."
                          : "No downline marketers have been added yet under your recruit network."}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredKids.map((aff) => {
                          const rateEarn = Math.round(
                            (aff.revenueGenerated || 0) * 0.05,
                          );
                          return (
                            <div
                              key={aff.id}
                              className={`bg-slate-900 border p-5 rounded-2xl flex flex-col justify-between space-y-4 text-left relative overflow-hidden group ${aff.isDisabled ? 'border-rose-900/50 opacity-70' : 'border-slate-800'}`}
                            >
                              {/* Top Banner tag */}
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] bg-slate-950 text-slate-400 px-2 py-0.5 rounded font-mono font-bold uppercase">
                                      {aff.id}
                                    </span>
                                    {aff.isDisabled && (
                                      <span className="text-[9px] bg-rose-500/15 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded font-bold uppercase">
                                        Disabled
                                      </span>
                                    )}
                                  </div>
                                  <h4 className="text-xs font-black text-white mt-1.5">
                                    {aff.name}
                                  </h4>
                                  <span className="text-[10px] text-slate-500 block truncate font-sans">
                                    {aff.email}
                                  </span>
                                </div>
                                <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase ${aff.isDisabled ? 'bg-slate-800 text-slate-500 line-through' : 'bg-amber-500 text-slate-950'}`}>
                                  {aff.promoCode}
                                </span>
                              </div>

                              {/* Target status bar */}
                              <div className="space-y-1">
                                <span className="text-[9px] font-mono uppercase text-slate-500 flex justify-between">
                                  <span>Progress Quota Target:</span>
                                  <span className="text-white font-bold">
                                    {aff.conversionsPromo || 0} /{" "}
                                    {aff.targetReferrals || 150}
                                  </span>
                                </span>
                                <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden p-0.5">
                                  <div
                                    className="bg-teal-500 h-full rounded"
                                    style={{
                                      width: `${Math.min(100, Math.round(((aff.conversionsPromo || 0) / (aff.targetReferrals || 150)) * 100))}%`,
                                    }}
                                  />
                                </div>
                              </div>

                              {/* Wallet & Financials block */}
                              <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-850 text-[10.5px] font-mono text-slate-400">
                                <div>
                                  <span className="text-[8.5px] text-slate-550 block uppercase">
                                    Wallet Account
                                  </span>
                                  <span className="text-white block font-bold truncate">
                                    {aff.phone}
                                  </span>
                                  <span className="text-[8px] text-emerald-400 uppercase font-black">
                                    {aff.paymentMethod || "m-pesa"}
                                  </span>
                                </div>
                                <div className="text-right border-l border-slate-900 pl-2">
                                  <span className="text-[8.5px] text-slate-550 block uppercase">
                                    Your 5% Oversight
                                  </span>
                                  <span className="text-teal-400 block font-bold text-xs">
                                    TSh {rateEarn.toLocaleString()}
                                  </span>
                                  <span className="text-[8px] text-slate-500 font-extrabold uppercase">
                                    Date: TSh{" "}
                                    {(
                                      aff.revenueGenerated || 0
                                    ).toLocaleString()}
                                  </span>
                                </div>
                              </div>

                              {/* TIN or NIDA info */}
                              <div className="text-[9px] font-mono text-slate-500 flex justify-between pt-1 border-t border-slate-850/60">
                                <span>
                                  NIDA:{" "}
                                  <strong className="text-slate-400">
                                    {aff.nidaNumber || "N/A"}
                                  </strong>
                                </span>
                                <span>
                                  TIN:{" "}
                                  <strong className="text-slate-400">
                                    {aff.tinNumber || "N/A"}
                                  </strong>
                                </span>
                              </div>

                              {/* Actions Block for Super Recruiter */}
                              <div className="flex items-center gap-1.5 pt-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedMessageAffiliate(aff);
                                    setSublineDirectMessage("");
                                    setShowSendMessageModal(true);
                                  }}
                                  className="flex-1 py-1.5 bg-slate-950 hover:bg-slate-800 text-teal-400 hover:text-teal-300 font-extrabold font-mono text-[9.5px] uppercase rounded-lg transition-colors cursor-pointer border border-slate-800 flex items-center justify-center gap-1"
                                >
                                  <MessageSquare className="w-3.5 h-3.5 text-teal-400" />
                                  <span>Message</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleToggleDisableAffiliate(aff.id, aff.name, !!aff.isDisabled)}
                                  className={`p-2 rounded-xl transition-colors cursor-pointer border text-[9px] font-bold flex items-center gap-1 px-2 ${aff.isDisabled ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/20'}`}
                                  title={aff.isDisabled ? 'Enable Affiliate' : 'Disable Affiliate'}
                                >
                                  {aff.isDisabled ? (
                                    <><CheckCircle className="w-3.5 h-3.5" /><span>Enable</span></>
                                  ) : (
                                    <><XCircle className="w-3.5 h-3.5" /><span>Disable</span></>
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleOpenEditAffiliate(aff)}
                                  className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer border border-slate-800"
                                  title="Edit Info Fields"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteSubAffiliate(aff.id, aff.name)
                                  }
                                  className="p-2 bg-slate-950 hover:bg-slate-800 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer border border-slate-800"
                                  title="Remove Affiliate"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Sent Messages History Log list */}
                    <div className="bg-slate-900/60 border border-slate-850/80 p-6 rounded-2xl space-y-4 mt-6">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                        <h4 className="text-xs uppercase font-mono tracking-wider font-extrabold text-white flex items-center gap-2">
                          <Send className="w-3.5 h-3.5 text-teal-400" />
                          <span>Direct Message Transmission Logs</span>
                        </h4>
                        <span className="text-[9.5px] font-mono text-slate-500">
                          Total Transmitted: {sublineMessagesHistory.length}
                        </span>
                      </div>

                      {sublineMessagesHistory.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-600 font-mono italic">
                          No messages have been dispatched yet. Use the
                          "Message" button above on any partner to dispatch a
                          Direct Message!
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                          {sublineMessagesHistory.map((m) => (
                            <div
                              key={m.id}
                              className="bg-slate-950 p-3 rounded-xl border border-slate-850 font-mono text-xs text-left text-slate-400 space-y-1"
                            >
                              <div className="flex justify-between text-[10px] text-slate-500">
                                <span>
                                  Sent To:{" "}
                                  <strong className="text-white">
                                    {m.toName}
                                  </strong>{" "}
                                  ({m.toPromo})
                                </span>
                                <span>{m.timestamp}</span>
                              </div>
                              <p className="text-slate-200 mt-1 pl-2 border-l-2 border-teal-500/40">
                                "{m.text}"
                              </p>
                              <div className="flex justify-end text-[8.5px] text-emerald-400 gap-1.5 items-center">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                                <span>
                                  Dispatched via Central SMS Hub (Success)
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              // 3. TUTORIAL CLASSROOM SESSIONS (Material learning hub)
              if (superActiveTab === "sessions") {
                const ALL_SESSIONS_MATERIALS = [
                  {
                    id: "doc-1",
                    title:
                      "Jasper POS System Operator Quick-Start Handbook (v2.4)",
                    desc: "Offline sales, printers, shifts, tax, stock.",
                    category: "guide",
                    fileSize: "4.8 MB",
                    duration: "25 min read",
                    format: "PDF Manual",
                  },
                  {
                    id: "doc-2",
                    title:
                      "Strategic Merchant Invitation & Objection Resolution Script",
                    desc: "Effective talking points and scripts specifically designed for Tanzanian pharmacies, retail shops and diners, answering questions on pricing, tax, and local offline resilience.",
                    category: "guide",
                    fileSize: "1.2 MB",
                    duration: "12 min study",
                    format: "PDF Guide",
                  },
                  {
                    id: "doc-3",
                    title:
                      "Pharmacy Clinical POS & BestRx Integration Workflows",
                    desc: "How to onboard pharmacies, set up brand generic classification listings, track batch expiration alerts, and manage e-prescription records.",
                    category: "guide",
                    fileSize: "2.5 MB",
                    duration: "15 min read",
                    format: "Interactive Playbook",
                  },
                  {
                    id: "vid-1",
                    title:
                      "Video Guide: Setting up a Dining Table QR Menu in 15 Minutes",
                    desc: "Step-by-step video tutorial demonstrating the creation of digital restaurant QR menus, dining zones configuration, and printer allocation setups.",
                    category: "video",
                    fileSize: "42 MB",
                    duration: "15 mins stream",
                    format: "MP4 Video",
                  },
                  {
                    id: "vid-2",
                    title:
                      "Video Guide: Mastering Multi-Branch Retail Cloud Consolidation",
                    desc: "Operational training on standard cloud sync pipelines, inventory transfers across stores, and multi-tenant performance report exports.",
                    category: "video",
                    fileSize: "58 MB",
                    duration: "22 mins stream",
                    format: "HD Video Class",
                  },
                  {
                    id: "mkt-1",
                    title:
                      "A3 High-Contrast Desktop Merchant Counter Banner Printouts",
                    desc: "Customizable posters with space for your Referral Code, styled for checkout counters to drive organic customer trial signups.",
                    category: "marketing",
                    fileSize: "8.4 MB",
                    duration: "Print Ready",
                    format: "Vector PDF Poster",
                  },
                  {
                    id: "mkt-2",
                    title:
                      "Social Stories Graphics & Facebook Promotional Canvas Templates",
                    desc: "A library of modern templates to share across WhatsApp Status pages, Instagram posts and stories, driving pre-configured 30 days trial signups.",
                    category: "marketing",
                    fileSize: "14.2 MB",
                    duration: "Zip File",
                    format: "Asset Creative Pack",
                  },
                  ...tutorialLibrary.map((tutorial) => ({
                    id: tutorial.id,
                    title: tutorial.title,
                    desc: tutorial.description || tutorial.link || tutorial.fileName || "Tutorial from Jasper admin.",
                    category: tutorial.type || "lesson",
                    fileSize: tutorial.fileName ? "Uploaded" : "Link",
                    duration: tutorial.type === "video" ? "Video" : "Lesson",
                    format:
                      tutorial.type === "video"
                        ? "Video Tutorial"
                        : tutorial.type === "message"
                          ? "Message"
                          : tutorial.type === "guide"
                            ? "Guide"
                            : "Lesson",
                    sourceTutorial: tutorial,
                  })),
                ];

                const searchClean = sessionsSearchQuery.toLowerCase();
                const filteredMaterials = ALL_SESSIONS_MATERIALS.filter((m) => {
                  const matchCategory =
                    sessionsCategory === "all" ||
                    m.category === sessionsCategory;
                  const matchText =
                    m.title.toLowerCase().includes(searchClean) ||
                    m.desc.toLowerCase().includes(searchClean);
                  return matchCategory && matchText;
                });

                return (
                  <div className="space-y-6 animate-fade-in text-left">
                    {/* Header bar */}
                    <div className="bg-slate-900 border border-slate-850 p-6 rounded-2xl space-y-1.5 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-teal-400" />
                          <span>Sessions & Learning Material Academy</span>
                        </h3>
                        <p className="text-xs text-slate-400">
                          Review onboarding manuals, educational guidebooks,
                          social media flyer packs, and setup training
                          presentations.
                        </p>
                      </div>
                      <span className="text-[10px] bg-slate-950 border border-slate-800 text-teal-400 px-3 py-1.5 rounded-lg font-mono">
                        Available Resources: 7 active
                      </span>
                    </div>

                    {/* Filter controls */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                        <input
                          type="text"
                          value={sessionsSearchQuery}
                          onChange={(e) =>
                            setSessionsSearchQuery(e.target.value)
                          }
                          placeholder="Search documents..."
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-11 pr-4 py-3.5 text-xs text-white placeholder-slate-500 outline-none focus:border-teal-400"
                        />
                      </div>

                      <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 flex overflow-x-auto gap-1 self-start">
                        {[
                          { id: "all", name: "All Formats" },
                          { id: "guide", name: "Guides & Manuals" },
                          { id: "video", name: "Video Classrooms" },
                          { id: "lesson", name: "Lessons" },
                          { id: "message", name: "Messages" },
                          { id: "marketing", name: "Marketing Assets" },
                        ].map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setSessionsCategory(c.id as any)}
                            className={`px-3 py-2 rounded-lg text-[10.5px] uppercase font-mono font-bold tracking-wider shrink-0 cursor-pointer ${
                              sessionsCategory === c.id
                                ? "bg-teal-500 text-slate-950 font-black"
                                : "text-slate-400 hover:text-white bg-transparent"
                            }`}
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Resource items list */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                      {filteredMaterials.map((mat) => (
                        <div
                          key={mat.id}
                          className="bg-slate-900 border border-slate-850 p-5 rounded-2xl space-y-4 text-left flex flex-col justify-between group hover:border-slate-800 transition-colors"
                        >
                          <div className="space-y-2">
                            <div className="flex justify-between items-start">
                              <span
                                className={`px-2 py-0.5 rounded text-[8.5px] font-mono font-black uppercase ${
                                  mat.category === "guide"
                                    ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                                    : mat.category === "video"
                                      ? "bg-teal-500/10 text-teal-400 border border-teal-500/20"
                                      : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                }`}
                              >
                                {mat.format}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {mat.fileSize} / {mat.duration}
                              </span>
                            </div>

                            <h4 className="text-xs font-extrabold text-white leading-relaxed group-hover:text-teal-400 transition-colors">
                              {mat.title}
                            </h4>
                            <p className="text-[11px] text-slate-400 leading-normal font-sans font-light">
                              {mat.desc}
                            </p>
                          </div>

                          <div className="pt-3 border-t border-slate-950 flex justify-between items-center bg-transparent">
                            <span className="text-[9.5px] font-mono text-slate-500">
                              ID: {mat.id.toUpperCase()}
                            </span>
                            <div className="flex flex-wrap justify-end gap-2">
                              {mat.sourceTutorial?.link && (
                                <a
                                  href={mat.sourceTutorial.link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-3.5 py-1.5 bg-slate-950 hover:bg-slate-850 text-white font-bold font-mono text-[9.5px] uppercase rounded-xl border border-slate-800 flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <ExternalLink className="w-3 h-3 text-teal-400" />
                                  <span>Open</span>
                                </a>
                              )}
                              {mat.sourceTutorial?.assetData && (
                                <a
                                  href={mat.sourceTutorial.assetData}
                                  download={mat.sourceTutorial.fileName || mat.title}
                                  className="px-3.5 py-1.5 bg-slate-950 hover:bg-slate-850 text-white font-bold font-mono text-[9.5px] uppercase rounded-xl border border-slate-800 flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <Download className="w-3 h-3 text-teal-400" />
                                  <span>File</span>
                                </a>
                              )}
                              {managedKids.slice(0, 4).map((child) => (
                                <button
                                  key={`${mat.id}-${child.id}`}
                                  type="button"
                                  onClick={() =>
                                    handleSendTutorialToSubAffiliate(
                                      mat.sourceTutorial || mat,
                                      child,
                                    )
                                  }
                                  className="px-3.5 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold font-mono text-[9.5px] uppercase rounded-xl flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <Send className="w-3 h-3" />
                                  <span>{child.name.split(" ")[0]}</span>
                                </button>
                              ))}
                              {managedKids.length === 0 && (
                                <span className="text-[9.5px] text-slate-500 font-mono">No sub-affiliates</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              // 4. VIDEO CONFERENCING WORKSPACE
              if (superActiveTab === "conferencing") {
                return (
                  <div className="space-y-6 animate-fade-in text-left">
                    {/* Header */}
                    <div className="bg-slate-900 border border-slate-850 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="space-y-1">
                        <span className="bg-red-500/15 text-red-400 border border-red-500/20 text-[9.5px] uppercase font-bold px-2 py-0.5 rounded-lg font-mono">
                          Live Video Conferencing Hub
                        </span>
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono mt-1">
                          Enterprise Virtual Onboarding Call Station
                        </h3>
                        <p className="text-xs text-slate-400">
                          Call downstream affiliates, spotlight key speakers,
                          and execute host-level mute rules across the room.
                        </p>
                      </div>

                      <div className="flex gap-2 w-full md:w-auto self-start">
                        {isConferenceActive ? (
                          <button
                            type="button"
                            onClick={() => {
                              setIsConferenceActive(false);
                              alert(
                                "🛑 Conference call has been terminated. Room closed.",
                              );
                            }}
                            className="bg-red-650 hover:bg-red-500 text-white font-bold p-3 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer flex-1 md:flex-none text-center bg-red-600 shadow-md shadow-red-500/10 active:scale-95"
                          >
                            Disconnect Call
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setIsConferenceActive(true);
                              alert(
                                "📡 Booting remote signaling server... Virtual Room Created! Members are joining...",
                              );
                            }}
                            className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer flex-1 md:flex-none text-center shadow-lg shadow-teal-500/10 active:scale-95 flex items-center justify-center gap-2"
                          >
                            <Play className="w-4 h-4 fill-current" />
                            <span>Boot Conference Call</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {isConferenceActive ? (
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Video Grid stream */}
                        <div className="lg:col-span-8 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {/* Host Screen (Self) */}
                            <div className="bg-slate-950 border-2 border-teal-500 p-4 rounded-2xl aspect-video flex flex-col justify-between relative overflow-hidden group shadow-lg shadow-teal-500/5">
                              <div className="absolute top-3 right-3 flex space-x-1.5">
                                <span className="bg-teal-500 text-slate-950 text-[8px] font-black uppercase px-1.5 py-0.2 rounded font-mono">
                                  HOST
                                </span>
                                <span className="bg-emerald-500/20 text-emerald-400 text-[8px] font-mono font-bold px-1 py-0.2 rounded leading-none flex items-center gap-0.5">
                                  ● LIVE
                                </span>
                              </div>

                              <div className="flex-1 flex items-center justify-center">
                                <span className="text-4xl select-none">👑</span>
                              </div>

                              <div className="flex justify-between items-center text-[10.5px] font-mono text-slate-400 pt-1 border-t border-slate-900/60 z-10">
                                <span className="text-white font-bold shrink-0">
                                  {activeAffiliate?.name} (You)
                                </span>
                                <span className="text-emerald-400 text-[8.5px] font-black shrink-0">
                                  1080p Stream
                                </span>
                              </div>
                              {/* Decibel visual mic bars */}
                              <div className="absolute bottom-11 left-4 right-4 flex gap-0.5 h-1 items-end opacity-60">
                                <span className="bg-teal-400 w-1.5 h-2.5 animate-pulse" />
                                <span className="bg-teal-400 w-1.5 h-1.5 animate-pulse" />
                                <span className="bg-teal-400 w-1.5 h-5 animate-pulse" />
                                <span className="bg-teal-400 w-1.5 h-3 animate-pulse" />
                              </div>
                            </div>

                            {/* Active Members Streams */}
                            {conferenceMembers.map((m) => {
                              const isSpeakingActive =
                                m.isSpeaking &&
                                !m.isMuted &&
                                !videoHostMutedAll;
                              return (
                                <div
                                  key={m.id}
                                  className={`bg-slate-950 p-4 rounded-2xl aspect-video flex flex-col justify-between relative overflow-hidden transition-all duration-300 border ${
                                    isSpeakingActive
                                      ? "border-emerald-500 shadow-md shadow-emerald-500/10 scale-102 bg-slate-950"
                                      : "border-slate-850 bg-slate-950/60"
                                  }`}
                                >
                                  <div className="absolute top-3 right-3 flex space-x-1 items-center z-10">
                                    <span className="bg-slate-900 text-slate-400 text-[8px] font-mono uppercase px-1 py-0.2 rounded">
                                      {m.role}
                                    </span>
                                    {m.isMuted || videoHostMutedAll ? (
                                      <span className="bg-red-500/15 text-red-400 text-[8.5px] p-0.5 rounded">
                                        <MicOff className="w-2.5 h-2.5" />
                                      </span>
                                    ) : (
                                      <span className="bg-emerald-500/15 text-emerald-400 text-[8.5px] p-0.5 rounded">
                                        <Mic className="w-2.5 h-2.5" />
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex-1 flex items-center justify-center">
                                    {m.cameraActive ? (
                                      <span className="text-4xl select-none animate-bounce">
                                        {m.avatar}
                                      </span>
                                    ) : (
                                      <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center text-slate-500 font-mono font-bold text-xs">
                                        Audio
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-900/60">
                                    <span className="text-white font-bold truncate pr-1">
                                      {m.name}
                                    </span>
                                    <span
                                      className={`text-[8px] shrink-0 font-bold ${m.signal === "Poor" ? "text-rose-400" : "text-slate-500"}`}
                                    >
                                      📶 {m.signal}
                                    </span>
                                  </div>

                                  {/* Waveform active simulation bar */}
                                  {isSpeakingActive && (
                                    <div className="absolute bottom-11 left-4 right-4 flex gap-0.5 h-2 items-end">
                                      <span className="bg-emerald-400 w-1 h-3 animate-pulse" />
                                      <span className="bg-emerald-400 w-1 h-1 bg-slate-400" />
                                      <span className="bg-emerald-400 w-1 h-2 animate-bounce" />
                                      <span className="bg-emerald-400 w-1 h-4 animate-bounce" />
                                      <span className="bg-emerald-400 w-1 h-1" />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Control panel buttons footer */}
                          <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex flex-wrap items-center justify-center gap-3">
                            <span className="text-[10px] font-mono text-slate-500 uppercase mr-2 tracking-wider">
                              Session Controls:
                            </span>

                            <button
                              type="button"
                              onClick={() => {
                                setVideoHostMutedAll((prev) => !prev);
                                alert(
                                  !videoHostMutedAll
                                    ? "🔇 Host muted all participant micro-speakers!"
                                    : "🔊 Host disabled bulk mute!",
                                );
                              }}
                              className={`px-3 py-1.5 rounded-lg text-[10.5px] font-mono font-bold uppercase cursor-pointer transition-all ${
                                videoHostMutedAll
                                  ? "bg-amber-500/20 text-amber-400 border border-amber-550"
                                  : "bg-slate-900 hover:bg-slate-850 text-slate-400 border border-slate-800"
                              }`}
                            >
                              {videoHostMutedAll
                                ? "🔊 Allow All Microphones"
                                : "🔇 Mute All Speakers"}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                alert(
                                  "🖥️ Screen transfer triggered on signal channel... Ready to share presentation.",
                                )
                              }
                              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 text-slate-400 rounded-lg text-[10.5px] font-mono font-bold uppercase cursor-pointer border border-slate-800 flex items-center gap-1"
                            >
                              <Tv className="w-3 h-3 text-teal-400" />
                              <span>Present Screen</span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                alert(
                                  "🚨 Master Recording initiated. Session backup will be stored in Affiliate Portal Archives.",
                                )
                              }
                              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 text-red-400 rounded-lg text-[10.5px] font-mono font-bold uppercase cursor-pointer border border-slate-850 flex items-center gap-1.5"
                            >
                              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                              <span>Rec Call</span>
                            </button>
                          </div>
                        </div>

                        {/* Host Control Side Panel (Mute Speakers / Allow Speakers) */}
                        <div className="lg:col-span-4 bg-slate-900/60 border border-slate-850 p-5 rounded-2xl flex flex-col justify-between space-y-4">
                          <div className="space-y-4 text-left">
                            <div className="pb-2 border-b border-slate-850">
                              <h4 className="text-xs uppercase font-mono tracking-wider font-extrabold text-white">
                                Host Moderator Control Panel
                              </h4>
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                Control individual microphone permissions on the
                                signaling server.
                              </p>
                            </div>

                            {/* Speaker lists */}
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                              {conferenceMembers.map((m) => (
                                <div
                                  key={m.id}
                                  className="bg-slate-950 p-2.5 rounded-lg border border-slate-850 flex items-center justify-between text-xs font-mono text-slate-400"
                                >
                                  <div className="flex items-center space-x-2">
                                    <span className="text-base">
                                      {m.avatar}
                                    </span>
                                    <div>
                                      <span className="text-white block font-bold truncate max-w-[140px]">
                                        {m.name}
                                      </span>
                                      <span className="text-[8px] text-slate-550 block uppercase">
                                        {m.role}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center space-x-1.5">
                                    {m.isMuted || videoHostMutedAll ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (videoHostMutedAll) {
                                            alert(
                                              "Disabled: Master Mute-All has been turned on by host. Turn it off first.",
                                            );
                                            return;
                                          }
                                          const updated = conferenceMembers.map(
                                            (item) =>
                                              item.id === m.id
                                                ? { ...item, isMuted: false }
                                                : item,
                                          );
                                          setConferenceMembers(updated);
                                        }}
                                        className="px-2 py-1 bg-rose-500/10 text-rose-400 hover:text-white rounded text-[8px] font-black uppercase transition-colors cursor-pointer border border-rose-500/20"
                                      >
                                        Allow Speak
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updated = conferenceMembers.map(
                                            (item) =>
                                              item.id === m.id
                                                ? {
                                                    ...item,
                                                    isMuted: true,
                                                    isSpeaking: false,
                                                  }
                                                : item,
                                          );
                                          setConferenceMembers(updated);
                                        }}
                                        className="px-2 py-1 bg-emerald-500/10 text-emerald-400 hover:bg-rose-500/10 hover:text-rose-400 rounded text-[8px] font-black uppercase transition-colors cursor-pointer border border-emerald-550"
                                      >
                                        Host Mute
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (
                                          confirm(
                                            `Kick participant ${m.name} from the active virtual room?`,
                                          )
                                        ) {
                                          setConferenceMembers((prev) =>
                                            prev.filter(
                                              (item) => item.id !== m.id,
                                            ),
                                          );
                                          alert(
                                            `Participant ${m.name} removed by operator.`,
                                          );
                                        }
                                      }}
                                      className="p-1 bg-slate-900 border border-slate-800 text-slate-500 hover:text-rose-400 hover:border-slate-700 rounded transition-colors cursor-pointer"
                                      title="Kick Participant"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="p-3 bg-slate-950 rounded-xl border border-slate-850/60 font-sans text-[10px] text-slate-500 leading-relaxed text-left">
                            📌 <strong>Affiliate Video Call tips:</strong> Use
                            this videoconferencing tool to run weekly team
                            onboarding orientations, review marketing
                            strategies, and resolve downline grievance payouts
                            on Friday schedules.
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-12 text-center text-xs text-slate-500 bg-slate-950 border border-slate-850 rounded-2xl italic flex flex-col items-center justify-center space-y-4">
                        <Video className="w-12 h-12 text-slate-700 shrink-0" />
                        <div>
                          <p className="font-extrabold text-white text-xs uppercase font-mono mb-1">
                            Affiliate Conference Room is Closed
                          </p>
                          <p className="text-[11px] text-slate-400 max-w-sm mx-auto leading-normal font-sans not-italic font-light">
                            Launch a live conference video panel with all your
                            active child affiliates immediately with one-click
                            peer configuration.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setIsConferenceActive(true);
                            alert(
                              "📡 Remote signalling server established... Member streams are loaded!",
                            );
                          }}
                          className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md shadow-teal-500/15"
                        >
                          Start Call Broadcast
                        </button>
                      </div>
                    )}
                  </div>
                );
              }

              // 5. HARDWARE POS
              if (superActiveTab === "hw-pos") {
                return (
                  <div className="space-y-6 animate-fade-in text-left">
                    <SaaSHardwarePOS affiliateId={activeAffiliate?.id} />
                  </div>
                );
              }

              // 6. HARDWARE INVENTORY
              if (superActiveTab === "hw-inventory") {
                return (
                  <div className="space-y-6 animate-fade-in text-left">
                    <SaaSHardwareInventory affiliateId={activeAffiliate?.id} />
                  </div>
                );
              }
            })()}
              </div>
            </div>

            {/* MODALS RENDER OVERLAYS */}
            {/* ADD DOWNLINE AFFILIATE DIALOG MODAL */}
            {showAddAffiliateModal && (
              <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in leading-relaxed font-sans">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl text-left space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                    <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">
                      Onboard New Downline Marketer Partner
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowAddAffiliateModal(false)}
                      className="text-slate-400 hover:text-white text-lg font-bold border-none bg-transparent cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <form
                    onSubmit={handleCreateSubAffiliate}
                    className="space-y-3.5 text-xs"
                  >
                    <div className="grid grid-cols-2 gap-3.5">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-mono text-slate-500 block font-bold">
                          Partner Full Name
                        </label>
                        <input
                          type="text"
                          required
                          value={addAffName}
                          onChange={(e) => setAddAffName(e.target.value)}
                          placeholder="e.g. Juma Langa Kid"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-teal-500"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-mono text-slate-500 block font-bold">
                          Promo Code Coupon (For Days Trial)
                        </label>
                        <input
                          type="text"
                          required
                          value={addAffPromo}
                          onChange={(e) => setAddAffPromo(e.target.value)}
                          placeholder="e.g. LANGA-JUMA"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-upper outline-none focus:border-teal-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-mono text-slate-500 block font-bold">
                          Email address
                        </label>
                        <input
                          type="email"
                          required
                          value={addAffEmail}
                          onChange={(e) => setAddAffEmail(e.target.value)}
                          placeholder="partner@jasper.com"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-teal-500"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-mono text-slate-500 block font-bold">
                          Wallet Phone Number
                        </label>
                        <input
                          type="tel"
                          required
                          value={addAffPhone}
                          onChange={(e) => setAddAffPhone(e.target.value)}
                          placeholder="e.g. +255 744 190 200"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-teal-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-mono text-slate-500 block font-bold">
                          Payout Wallet Method
                        </label>
                        <select
                          value={addAffPhoneMethod}
                          onChange={(e) => setAddAffPhoneMethod(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white cursor-pointer outline-none focus:border-teal-500"
                        >
                          <option value="m-pesa">Vodacom M-Pesa Wallet</option>
                          <option value="tigo_yas">Mixx by Yas Wallet</option>
                          <option value="airtel_money">
                            Airtel Money Wallet
                          </option>
                          <option value="halopesa">
                            Halotel PaloPesa Wallet
                          </option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-mono text-slate-500 block font-bold">
                          Default User Password
                        </label>
                        <input
                          type="text"
                          required
                          value={addAffPassword}
                          onChange={(e) => setAddAffPassword(e.target.value)}
                          placeholder="pass123"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-teal-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-mono text-slate-500 block font-bold">
                          NIDA ID Registration (TRA compliance)
                        </label>
                        <input
                          type="text"
                          value={addAffNida}
                          onChange={(e) => setAddAffNida(e.target.value)}
                          placeholder="Tanzanian NIDA Serial"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-teal-500"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-mono text-slate-500 block font-bold">
                          TIN Certificate Serial (TRA compliance)
                        </label>
                        <input
                          type="text"
                          value={addAffTin}
                          onChange={(e) => setAddAffTin(e.target.value)}
                          placeholder="Tanzanian TIN Number"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-teal-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-mono text-slate-500 block font-bold">
                        Quota Progress Target referrals
                      </label>
                      <input
                        type="number"
                        value={addAffTarget}
                        onChange={(e) =>
                          setAddAffTarget(Number(e.target.value))
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-teal-500"
                      />
                    </div>

                    <div className="flex justify-end gap-2.5 pt-4">
                      <button
                        type="button"
                        onClick={() => setShowAddAffiliateModal(false)}
                        className="px-4 py-2 bg-slate-950 hover:bg-slate-850 text-slate-500 rounded-xl font-bold uppercase transition-colors cursor-pointer border border-slate-800"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl uppercase transition-colors cursor-pointer"
                      >
                        Activate Downline
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* EDIT DOWNLINE AFFILIATE DIALOG MODAL */}
            {showEditAffiliateModal && selectedEditAffiliate && (
              <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in leading-relaxed font-sans">
                <div className="bg-slate-900 border border-slate-820 rounded-3xl p-6 w-full max-w-lg shadow-2xl text-left space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                    <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">
                      Edit Downline Partner Info
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setShowEditAffiliateModal(false);
                        setSelectedEditAffiliate(null);
                      }}
                      className="text-slate-400 hover:text-white text-lg font-bold border-none bg-transparent cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <form
                    onSubmit={handleUpdateSubAffiliateSubmit}
                    className="space-y-3.5 text-xs"
                  >
                    <div className="grid grid-cols-2 gap-3.5">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-mono text-slate-500 block font-bold">
                          Partner Name
                        </label>
                        <input
                          type="text"
                          required
                          value={editAffName}
                          onChange={(e) => setEditAffName(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-white outline-none focus:border-teal-500"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-mono text-slate-500 block font-bold">
                          Promo Coupon Code
                        </label>
                        <input
                          type="text"
                          required
                          value={editAffPromo}
                          onChange={(e) => setEditAffPromo(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-white font-mono uppercase outline-none focus:border-teal-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-mono text-slate-500 block font-bold">
                          Email address
                        </label>
                        <input
                          type="email"
                          required
                          value={editAffEmail}
                          onChange={(e) => setEditAffEmail(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-white outline-none focus:border-teal-500"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-mono text-slate-500 block font-bold">
                          Wallet Phone Number
                        </label>
                        <input
                          type="text"
                          required
                          value={editAffPhone}
                          onChange={(e) => setEditAffPhone(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-white outline-none focus:border-teal-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-mono text-slate-500 block font-bold">
                          Payout Wallet Method
                        </label>
                        <select
                          value={editAffPhoneMethod}
                          onChange={(e) =>
                            setEditAffPhoneMethod(e.target.value)
                          }
                          className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-white cursor-pointer outline-none"
                        >
                          <option value="m-pesa">Vodacom M-Pesa</option>
                          <option value="tigo_yas">Mixx by Yas</option>
                          <option value="airtel_money">Airtel Money</option>
                          <option value="halopesa">Halotel PaloPesa</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-mono text-slate-500 block font-bold">
                          Quota Progress Target referrals
                        </label>
                        <input
                          type="number"
                          value={editAffTarget}
                          onChange={(e) =>
                            setEditAffTarget(Number(e.target.value))
                          }
                          className="w-full bg-slate-950 border border-slate-855 rounded-xl px-3 py-2 text-white outline-none focus:border-teal-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-mono text-slate-500 block font-bold">
                          NIDA Number
                        </label>
                        <input
                          type="text"
                          value={editAffNida}
                          onChange={(e) => setEditAffNida(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-white outline-none focus:border-teal-500"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-mono text-slate-500 block font-bold">
                          TIN Number
                        </label>
                        <input
                          type="text"
                          value={editAffTin}
                          onChange={(e) => setEditAffTin(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-white outline-none focus:border-teal-500"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2.5 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowEditAffiliateModal(false);
                          setSelectedEditAffiliate(null);
                        }}
                        className="px-4 py-2 bg-slate-950 hover:bg-slate-850 text-slate-405 rounded-xl font-bold uppercase transition-colors cursor-pointer border border-slate-800"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black rounded-xl uppercase transition-colors cursor-pointer"
                      >
                        Save updates
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* SEND MESSAGE MODAL DIALOG */}
            {showSendMessageModal && selectedMessageAffiliate && (
              <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in leading-relaxed font-sans">
                <div className="bg-slate-900 border border-slate-820 rounded-3xl p-6 w-full max-w-md shadow-2xl text-left space-y-4 animate-fade-in">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                    <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-teal-400" />
                      <span>Direct Message Partner</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSendMessageModal(false);
                        setSelectedMessageAffiliate(null);
                      }}
                      className="text-slate-500 hover:text-white text-lg font-bold border-none bg-transparent cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="text-xs text-slate-400 space-y-1">
                    <span>Transmitting to subline recipient:</span>
                    <strong className="text-white block font-mono bg-slate-950 p-2 rounded border border-slate-850 text-center uppercase tracking-widest">
                      {selectedMessageAffiliate.name} (
                      {selectedMessageAffiliate.promoCode})
                    </strong>
                  </div>

                  <form
                    onSubmit={handleSendMessageToSubline}
                    className="space-y-3.5 text-xs"
                  >
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-mono text-slate-500 block font-bold">
                        Direct Message Text Comments
                      </label>
                      <textarea
                        required
                        rows={4}
                        value={sublineDirectMessage}
                        onChange={(e) =>
                          setSublineDirectMessage(e.target.value)
                        }
                        placeholder="Write message..."
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3.5 py-2.5 text-white outline-none focus:border-teal-500 font-sans"
                      />
                    </div>

                    <div className="flex justify-end gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowSendMessageModal(false);
                          setSelectedMessageAffiliate(null);
                        }}
                        className="px-4 py-2 bg-slate-955 hover:bg-slate-850 text-slate-400 rounded-xl font-bold uppercase transition-colors cursor-pointer border border-slate-800"
                      >
                        Dismiss
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-955 font-black rounded-xl uppercase transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Send className="w-3 h-3 fill-current text-slate-950" />
                        <span>Transmit Msg</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Dashboard of authorized logged-in affiliate */
          <div className="space-y-8 animate-fade-in text-left">
            {/* Header info */}
            <div className="bg-slate-900 border border-slate-850 p-6 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade-in">
              <div className="space-y-1">
                <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 text-[9px] uppercase font-bold px-2 py-0.5 rounded-lg font-mono">
                  Affiliate Force Partner Panel
                </span>
                <h2 className="text-xl font-extrabold text-white">
                  Habari Njema, {activeAffiliate?.name}!
                </h2>
                <p className="text-xs text-slate-400">
                  Track and view real-time progression clicks, referred paying
                  subscribers, and recurring TSh earnings.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="px-3.5 py-1.5 bg-slate-950 border border-slate-850 rounded-xl font-mono text-xs flex items-center space-x-2">
                  <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-slate-400 uppercase text-[9.5px]">
                    Payout Wallet:
                  </span>
                  <span className="text-white font-bold">
                    {activeAffiliate?.phone} (
                    {activeAffiliate?.paymentMethod === "tigo_yas"
                      ? "Mixx by Yas"
                      : activeAffiliate?.paymentMethod === "m-pesa"
                        ? "M-Pesa"
                        : activeAffiliate?.paymentMethod === "airtel_money"
                          ? "Airtel Money"
                          : "Halopesa"}
                    )
                  </span>
                </div>

                <button
                  onClick={handleLogoutAffiliate}
                  className="px-3 py-1.5 hover:bg-slate-850 text-slate-500 hover:text-rose-400 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
                >
                  Log Out
                </button>
              </div>
            </div>

            {/* TRA TAX STRICT WARNING protocol block - specifically requested! */}
            <div className="bg-amber-500/10 border border-amber-500/25 p-4 rounded-2xl flex items-start space-x-3 text-xs text-amber-200">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
              <div className="space-y-1 font-light">
                <span className="font-bold text-[11px] uppercase tracking-wider font-mono block text-amber-400">
                  ⚠️ TRA Compliance Notice Statement
                </span>
                <p className="leading-relaxed">
                  Please be informed that soon as law requires, we will be
                  charging{" "}
                  <strong className="text-white font-bold">
                    5% of your earnings
                  </strong>{" "}
                  to submit directly to the{" "}
                  <strong className="text-white font-bold">
                    Tanzania Revenue Authority (TRA)
                  </strong>{" "}
                  as withholding commission tax. You will be formally notified
                  with push alerts before we implement this feature. For now,
                  you can sit back, relax, and enjoy 100% of your earnings
                  tax-free!
                </p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <h3 className="text-sm uppercase font-mono tracking-wider font-extrabold text-white flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-teal-400" />
                    <span>Tutorials & Lessons</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Lessons sent by your super affiliate or agent.
                  </p>
                </div>
                <span className="text-[10px] bg-slate-950 border border-slate-800 text-teal-400 px-3 py-1 rounded-lg font-mono">
                  {receivedTutorials.length} lesson{receivedTutorials.length === 1 ? "" : "s"}
                </span>
              </div>

              {receivedTutorials.length === 0 ? (
                <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 text-xs text-slate-400">
                  No tutorials sent yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {receivedTutorials.map((assignment) => {
                    const tutorial = assignment.tutorial || {};
                    return (
                      <div key={assignment.id} className="bg-slate-950 border border-slate-850 rounded-xl p-4 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/20 text-[9px] font-mono uppercase font-bold">
                            {tutorial.type || "lesson"}
                          </span>
                          <span className="text-[9px] text-slate-500 font-mono">
                            From {assignment.fromName}
                          </span>
                        </div>
                        <h4 className="text-sm text-white font-extrabold">{tutorial.title}</h4>
                        <p className="text-[11px] text-slate-400 leading-normal">{tutorial.description || "Open this lesson and follow the guide."}</p>
                        <div className="flex flex-wrap gap-2 pt-2">
                          {tutorial.link && (
                            <a
                              href={tutorial.link}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-lg font-mono font-bold text-[10px] uppercase"
                            >
                              Open Link
                            </a>
                          )}
                          {tutorial.assetData && (
                            <a
                              href={tutorial.assetData}
                              download={tutorial.fileName || tutorial.title}
                              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 text-white rounded-lg border border-slate-800 font-mono font-bold text-[10px] uppercase"
                            >
                              Download
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Dashboard Analytics progression stats grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Stat 1: Clicks */}
              <div className="bg-slate-900 border border-slate-850/70 p-5 rounded-2xl space-y-2 relative overflow-hidden">
                <div className="absolute top-4 right-4 text-slate-700">
                  <MousePointer className="w-6 h-6" />
                </div>
                <dt className="text-xs uppercase font-mono tracking-widest text-slate-400 text-[9px]">
                  Progression Clicks
                </dt>
                <dd className="text-3xl font-extrabold text-white font-mono">
                  {clicksCount}
                </dd>
                <div className="text-[10px] text-emerald-400 font-mono flex items-center space-x-1">
                  <span>+18% unique hits this week</span>
                </div>
              </div>

              {/* Stat 2: Referrals */}
              <div className="bg-slate-900 border border-slate-850/70 p-5 rounded-2xl space-y-2 relative overflow-hidden">
                <div className="absolute top-4 right-4 text-slate-700">
                  <Users className="w-6 h-6" />
                </div>
                <dt className="text-xs uppercase font-mono tracking-widest text-slate-400 text-[9px]">
                  Referred Subscribers
                </dt>
                <dd className="text-3xl font-extrabold text-white font-mono">
                  {filteredSubscribers.length}
                </dd>
                <div className="text-[10px] text-slate-400 font-mono">
                  <span className="text-emerald-400 font-bold">
                    {paidSubsCount} Active Paid
                  </span>{" "}
                  •{" "}
                  {
                    filteredSubscribers.filter((s) => s.status === "Active Trial")
                      .length
                  }{" "}
                  Trialists
                </div>
              </div>

              {/* Stat 3: Month Earnings */}
              <div className="bg-slate-900 border border-slate-850/70 p-5 rounded-2xl space-y-2 relative overflow-hidden">
                <div className="absolute top-4 right-4 text-emerald-400/20">
                  <DollarSign className="w-6 h-6" />
                </div>
                <dt className="text-xs uppercase font-mono tracking-widest text-slate-400 text-[9px]">
                  Monthly 15% Share Earn
                </dt>
                <dd className="text-3xl font-extrabold text-emerald-400 font-mono">
                  TSh {totalEarnedCommissions.toLocaleString()}
                </dd>
                <div className="text-[10px] text-slate-400 font-mono">
                  Paying recurring until unsubscribe
                </div>
              </div>

              {/* Stat 4: Next Draw Date */}
              <div className="bg-slate-900 border border-slate-850/70 p-5 rounded-2xl space-y-2 relative overflow-hidden">
                <div className="absolute top-4 right-4 text-slate-700">
                  <Clock className="w-6 h-6" />
                </div>
                <dt className="text-xs uppercase font-mono tracking-widest text-slate-400 text-[9px]">
                  Last Friday Payout Schedule
                </dt>
                <dd className="text-base font-black text-amber-400 shrink-0 uppercase tracking-tight py-1 font-mono">
                  {getPayoutDateString()}
                </dd>
                <div className="text-[9.5px] text-slate-400 font-mono">
                  Wallet Dispatched 1 time every month
                </div>
              </div>
            </div>

            {/* Middle Section: Advertising copy materials copy tool  & active referrals board */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Materials widget */}
              <div className="lg:col-span-6 bg-slate-900/60 border border-slate-850/80 p-6 rounded-2xl space-y-6">
                <div>
                  <h3 className="text-sm uppercase font-mono tracking-wider font-extrabold text-white">
                    Advertising Creative Materials Kit
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Copy and share these pre-wired links and coupons to earn
                    commission.
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Item 1: Custom referral URL */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] font-mono">
                      <span className="text-slate-500 uppercase">
                        Your Custom Tracking Link:
                      </span>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            `https://jasper.africa/?ref=${activeAffiliate?.promoCode}`,
                            setCopiedLink,
                          )
                        }
                        className="text-emerald-400 hover:underline flex items-center space-x-1 cursor-pointer font-bold uppercase text-[9px]"
                      >
                        {copiedLink ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copiedLink ? "Copied" : "Copy"}</span>
                      </button>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs font-mono text-emerald-400 select-all truncate">
                      https://jasper.africa/?ref={activeAffiliate?.promoCode}
                    </div>
                  </div>

                  {/* Item 2: Promo Code coupon copy */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] font-mono">
                      <span className="text-slate-500 uppercase">
                        Your Signup Promo Code Coupon:
                      </span>
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => {
                            setNewPromoInput(activeAffiliate?.promoCode || "");
                            setIsEditingPromo(!isEditingPromo);
                          }}
                          className={`${isEditingPromo ? "text-amber-400" : "text-teal-400"} hover:underline flex items-center space-x-1 cursor-pointer font-bold uppercase text-[9px]`}
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>{isEditingPromo ? "Editing" : "Change Code"}</span>
                        </button>
                        {!isEditingPromo && (
                          <button
                            onClick={() =>
                              copyToClipboard(
                                activeAffiliate?.promoCode || "",
                                setCopiedCode,
                              )
                            }
                            className="text-emerald-400 hover:underline flex items-center space-x-1 cursor-pointer font-bold uppercase text-[9px]"
                          >
                            {copiedCode ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            <span>{copiedCode ? "Copied" : "Copy"}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {isEditingPromo ? (
                      <form onSubmit={handleUpdatePromoCode} className="space-y-2 pt-1">
                        {/* ⚠️ Caution notice */}
                        <div className="flex items-start gap-2 p-2.5 bg-amber-500/10 border border-amber-500/25 rounded-xl">
                          <span className="text-amber-400 text-[10px] shrink-0">⚠️</span>
                          <p className="text-[9px] text-amber-300 leading-relaxed">
                            <strong>Tahadhari:</strong> Unaweza kubadilisha promo code mara moja tu. Ukibadilisha, kuwa makini sana — mabadiliko mengi yanaweza kuzuia system kufuatilia taarifa zako na malipo yako. Chagua code utakayoitumia kwa muda mrefu.
                          </p>
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            className={`w-full bg-slate-950 p-2.5 rounded-lg border font-mono text-center text-teal-300 uppercase text-xs tracking-widest font-extrabold focus:outline-none focus:ring-1 focus:ring-teal-400 ${promoError ? 'border-rose-500' : 'border-teal-500'}`}
                            value={newPromoInput}
                            onChange={(e) => { setNewPromoInput(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "")); setPromoError(null); setPromoSuggestions([]); }}
                            placeholder="YOUR NEW PROMO CODE"
                            maxLength={30}
                            required
                          />
                        </div>
                        {promoError && (
                          <div className="space-y-1.5">
                            <p className="text-[10px] text-rose-400 font-bold">⚠️ {promoError} Choose a different one.</p>
                            {promoSuggestions.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[9px] text-slate-500 font-mono">Available suggestions:</span>
                                {promoSuggestions.map(s => (
                                  <button key={s} type="button"
                                    onClick={() => { setNewPromoInput(s); setPromoError(null); setPromoSuggestions([]); }}
                                    className="text-[10px] text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded font-black font-mono cursor-pointer hover:bg-teal-500/20 tracking-wider">
                                    {s}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        <div className="flex justify-end space-x-2 text-[9px] font-mono">
                          <button type="button"
                            onClick={() => { setIsEditingPromo(false); setPromoError(null); setPromoSuggestions([]); }}
                            className="px-2.5 py-1 text-slate-400 bg-slate-900 border border-slate-800 rounded-md hover:text-white">
                            CANCEL
                          </button>
                          <button type="submit"
                            className="px-3 py-1 text-slate-950 bg-teal-400 hover:bg-teal-300 rounded-md font-extrabold uppercase transition-colors">
                            SAVE CHANGES
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs font-mono text-white tracking-widest font-extrabold text-center select-all uppercase">
                        {activeAffiliate?.promoCode}
                      </div>
                    )}
                  </div>

                  {/* Graphical Adsense & Social Media Materials Tab List */}
                  <div className="border-t border-slate-800 pt-4 space-y-4">
                    <span className="text-[9.5px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                      📡 AD EXCHANGE SSP INVENTORY & EMBED TAGS (15% TRACKED)
                    </span>

                    <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 flex overflow-x-auto gap-1 scrollbar-none">
                      {[
                        { id: "flyer", name: "Flyer (1:1)", size: "1:1" },
                        { id: "tiktok", name: "Posters (9:16)", size: "9:16" },
                        {
                          id: "leaderboard",
                          name: "Leaderboard",
                          size: "728x90",
                        },
                        { id: "rectangle", name: "Rectangle", size: "300x250" },
                        {
                          id: "skyscraper",
                          name: "Skyscraper",
                          size: "160x600",
                        },
                        ...sspInventory.map((ssp) => ({
                          id: ssp.id,
                          name: `SSP: ${ssp.title} (${ssp.size})`,
                          size: ssp.size,
                        })),
                      ].map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setActiveCreativeTab(t.id)}
                          className={`px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider font-mono shrink-0 cursor-pointer ${
                            activeCreativeTab === t.id
                              ? "bg-emerald-500 text-slate-950 font-black"
                              : "text-slate-400 hover:text-white bg-slate-900/50"
                          }`}
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>

                    {/* Active creative interactive preview box */}
                    <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 space-y-3">
                      <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 uppercase">
                        <span>Live Custom Ad Preview:</span>
                        <span className="text-emerald-400 font-bold">
                          {activeCreativeTab === "flyer" &&
                            "1080x1080px Square (Insta/WhatsApp)"}
                          {activeCreativeTab === "tiktok" &&
                            "1080x1920px Vertical (TikTok/Reels)"}
                          {activeCreativeTab === "leaderboard" &&
                            "728x90px Leaderboard Banner"}
                          {activeCreativeTab === "rectangle" &&
                            "300x250px Medium Rectangle Banner"}
                          {activeCreativeTab === "skyscraper" &&
                            "160x600px Skyscraper Column Banner"}
                          {sspInventory.find(
                            (s) => s.id === activeCreativeTab,
                          ) && `SSP Custom Network Ad Format`}
                        </span>
                      </div>

                      {/* The Ad Container - Styled with actual visual aesthetics to look like an AdWords banner */}
                      <div className="flex items-center justify-center bg-slate-950 p-4 rounded-lg border border-slate-800 overflow-hidden min-h-[140px] relative">
                        {activeCreativeTab === "leaderboard" && (
                          <div className="w-full max-w-[600px] bg-slate-905 bg-slate-900 border border-emerald-500/30 rounded px-4 py-2 text-left font-sans flex items-center justify-between text-white shrink-0">
                            <div>
                              <h4 className="text-xs font-black text-emerald-400">
                                JASPER POS — 100% OFFLINE BIASHARA
                              </h4>
                              <p className="text-[9px] text-slate-400">
                                Kodi ya Promo:{" "}
                                <span className="font-mono text-white font-bold">
                                  {activeAffiliate?.promoCode}
                                </span>{" "}
                                (30 Days Free Trial)
                              </p>
                            </div>
                            <span className="bg-emerald-500 text-slate-955 bg-slate-950 text-white px-2 py-1 rounded text-[8.5px] font-bold uppercase shrink-0">
                              ANZA BURE
                            </span>
                          </div>
                        )}

                        {activeCreativeTab === "rectangle" && (
                          <div className="w-[245px] h-[200px] bg-slate-905 bg-slate-905 bg-slate-900 border border-emerald-500/30 rounded p-3 text-left font-sans flex flex-col justify-between text-white shrink-0">
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <h4 className="text-xs font-black text-emerald-400">
                                  JASPER ERP LEDGER
                                </h4>
                                <span className="text-[7px] text-slate-500 border border-slate-800 px-1 py-0.2 rounded font-mono">
                                  15% SHARE
                                </span>
                              </div>
                              <p className="text-[9px] text-slate-400 leading-relaxed">
                                Runs 100% offline. Manages store, pharmacy,
                                duka, or table-orders.
                              </p>
                            </div>
                            <div className="space-y-1 bg-emerald-500/5 p-1.5 rounded border border-emerald-500/20 text-center">
                              <span className="text-[8px] text-slate-400 block font-mono">
                                PROMO (Extended 1 Month Free)
                              </span>
                              <span className="text-xs font-black text-emerald-300 block tracking-widest uppercase font-mono">
                                {activeAffiliate?.promoCode}
                              </span>
                            </div>
                            <span className="bg-emerald-500 text-slate-950 py-1 rounded text-[9px] font-mono font-bold uppercase text-center block">
                              ACCESS TERMINAL
                            </span>
                          </div>
                        )}

                        {activeCreativeTab === "skyscraper" && (
                          <div className="w-[120px] h-[320px] bg-slate-905 bg-slate-900 border border-emerald-500/30 rounded p-2.5 text-left font-sans flex flex-col justify-between text-white shrink-0 text-center">
                            <div>
                              <h4 className="text-xs font-black text-emerald-400 tracking-tight text-center">
                                JASPER
                              </h4>
                              <span className="text-[8px] text-slate-400 block text-center font-bold">
                                Runs offline
                              </span>
                              <div className="border-t border-slate-800 my-2"></div>
                              <p className="text-[7.5px] text-slate-500 leading-tight">
                                No internet required for POS cashier tills.
                              </p>
                            </div>
                            <div className="bg-emerald-500/5 p-1 rounded border border-emerald-500/25">
                              <span className="text-[7px] text-slate-455 text-slate-500 block">
                                CODE:
                              </span>
                              <span className="text-[9.5px] font-black text-emerald-300 font-mono tracking-tight uppercase truncate block">
                                {activeAffiliate?.promoCode}
                              </span>
                            </div>
                            <span className="bg-emerald-500 text-slate-950 py-1 rounded text-[8px] font-bold uppercase text-center block">
                              JOIN FREE
                            </span>
                          </div>
                        )}

                        {activeCreativeTab === "flyer" && (
                          <div className="w-[280px] h-[280px] bg-slate-905 bg-slate-900 border-2 border-emerald-500/40 rounded-xl p-4 text-left font-sans flex flex-col justify-between text-white shrink-0 relative">
                            <div className="absolute top-2 right-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-1.5 py-0.2 text-[7px] rounded uppercase font-mono">
                              Tanzania Smart ERP
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-white leading-tight">
                                JASPER ONLINE/OFFLINE
                              </h4>
                              <h5 className="text-[10px] text-emerald-400 font-bold mb-2">
                                Merchant Retail Powerhouse
                              </h5>
                              <ul className="space-y-0.5 text-[8.5px] text-slate-400">
                                <li>✓ Works 100% Offline without network</li>
                                <li>
                                  ✓ Instantly accept all mobile money wallets
                                </li>
                                <li>✓ Auto updates stock supplies logs</li>
                              </ul>
                            </div>
                            <div className="bg-emerald-950/40 p-2 rounded-lg border border-emerald-500/20">
                              <span className="text-[7px] text-slate-455 text-slate-400 block uppercase tracking-wider font-mono">
                                Exclusive 30-Day Free Promo Code:
                              </span>
                              <span className="text-[13px] font-black text-emerald-400 font-mono tracking-widest block uppercase">
                                {activeAffiliate?.promoCode}
                              </span>
                            </div>
                            <div className="text-[8px] text-slate-500 text-center">
                              Register in milliseconds at https://jasper.africa
                            </div>
                          </div>
                        )}

                        {activeCreativeTab === "tiktok" && (
                          <div className="w-[180px] h-[320px] bg-slate-905 bg-slate-905 bg-slate-900 border border-emerald-500/30 rounded-lg p-3 text-left font-sans flex flex-col justify-between text-white shrink-0 relative">
                            <div className="absolute top-2 right-2 bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1 text-[7px] rounded font-mono font-bold">
                              TikTok Format
                            </div>
                            <div>
                              <h4 className="text-[11px] font-black text-white leading-tight">
                                TANZANIA'S PRIDE POS
                              </h4>
                              <h5 className="text-[9px] text-emerald-400 font-bold mb-1">
                                Jasper Business Suite
                              </h5>
                              <p className="text-[7.5px] text-slate-500 leading-normal">
                                Manages cash, stocks, receipts, hotels,
                                pharmacies, bar, or retail store branches.
                              </p>
                            </div>
                            <div className="space-y-1">
                              <div className="bg-emerald-500/5 p-2 rounded border border-emerald-500/30 text-center">
                                <span className="text-[7px] text-slate-500 block uppercase font-mono">
                                  Use Promo Code Coupon:
                                </span>
                                <span className="text-xs font-black text-emerald-300 font-mono tracking-widest block uppercase">
                                  {activeAffiliate?.promoCode}
                                </span>
                              </div>
                              <span className="bg-emerald-500 text-slate-955 bg-slate-950 hover:bg-emerald-400 text-slate-950 py-1 rounded text-[8.5px] font-bold text-center uppercase block font-mono">
                                SCAN QR CODE
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Rendering dynamic SSP Ad Exchanges */}
                        {(() => {
                          const sspAd = sspInventory.find(
                            (s) => s.id === activeCreativeTab,
                          );
                          if (!sspAd) return null;

                          const [rawWidth, rawHeight] = (sspAd.size || "300x250")
                            .split("x")
                            .map((value: string) => Number(value));
                          const width = Number.isFinite(rawWidth) ? rawWidth : 300;
                          const height = Number.isFinite(rawHeight) ? rawHeight : 250;
                          const isVideo =
                            sspAd.adType === "video" ||
                            (sspAd.creativeMime || "").startsWith("video/");
                          const isMedia =
                            !!sspAd.assetData &&
                            (sspAd.adType === "image" ||
                              sspAd.adType === "motion" ||
                              isVideo);

                          return (
                            <div
                              className="bg-slate-900 border border-emerald-500/50 flex flex-col items-center justify-center text-center shrink-0 relative overflow-hidden"
                              style={{
                                width: `${width}px`,
                                height: `${height}px`,
                                maxWidth: "100%",
                                minHeight: "100px",
                              }}
                            >
                              {isMedia && isVideo && (
                                <video
                                  src={sspAd.assetData}
                                  className="absolute inset-0 w-full h-full object-cover"
                                  controls
                                  loop
                                  muted
                                  playsInline
                                />
                              )}
                              {isMedia && !isVideo && (
                                <img
                                  src={sspAd.assetData}
                                  alt={sspAd.title || "SSP creative"}
                                  className="absolute inset-0 w-full h-full object-cover"
                                />
                              )}
                              {!isMedia && sspAd.message && (
                                <div className="absolute inset-0 bg-slate-950 flex items-center justify-center p-4">
                                  <p className="text-sm text-white font-bold leading-snug">
                                    {sspAd.message}
                                  </p>
                                </div>
                              )}
                              {!isMedia && !sspAd.message && sspAd.creativeName && (
                                <div className="absolute inset-0 bg-slate-800 flex items-center justify-center text-slate-500">
                                  <span className="text-[10px] uppercase font-mono tracking-widest">
                                    [SSP Ad: {sspAd.creativeName}]
                                  </span>
                                </div>
                              )}
                              <div className="relative z-10 w-full h-full flex flex-col justify-between bg-gradient-to-b from-slate-950/70 via-transparent to-slate-950/75 p-3 pointer-events-none">
                                <div className="flex justify-end">
                                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1 py-0.5 text-[7px] font-mono whitespace-nowrap">
                                    Ads by Jasper Exchange
                                  </span>
                                </div>
                                <div className="space-y-1">
                                  <h4 className="text-sm font-black text-white leading-tight uppercase px-2 line-clamp-2">
                                    {sspAd.title}
                                  </h4>
                                  <p className="text-[9px] text-slate-200">
                                    SSP Promo Code:{" "}
                                    <span className="font-mono text-emerald-300 font-bold">
                                      {activeAffiliate?.promoCode}
                                    </span>
                                  </p>
                                  <a
                                    href={sspAd.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-block mt-1 bg-emerald-500 text-slate-950 px-3 py-1 font-bold text-[9px] uppercase hover:bg-emerald-400 transition-colors pointer-events-auto"
                                  >
                                    Act Now
                                  </a>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Embed and direct buttons */}
                      <div className="grid grid-cols-2 gap-2 text-xs font-sans">
                        <button
                          type="button"
                          onClick={() => {
                            let sizeStr = "1:1";
                            const sspMatch = sspInventory.find(
                              (s) => s.id === activeCreativeTab,
                            );
                            if (sspMatch) sizeStr = sspMatch.size;
                            else if (activeCreativeTab === "leaderboard")
                              sizeStr = "728x90";
                            else if (activeCreativeTab === "rectangle")
                              sizeStr = "300x250";
                            else if (activeCreativeTab === "skyscraper")
                              sizeStr = "160x600";
                            else if (activeCreativeTab === "tiktok")
                              sizeStr = "9:16";
                            downloadCreative(
                              `Jasper ${sspMatch ? "SSP " + sspMatch.title : activeCreativeTab} Ad banner`,
                              sizeStr,
                              activeAffiliate?.promoCode || "SARAH_JASPER",
                            );
                          }}
                          className="py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-bold flex items-center justify-center space-x-1 cursor-pointer transition-colors"
                        >
                          <Download className="w-4 h-4 shrink-0 text-slate-950" />
                          <span>Download Custom PNG</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const sspMatch = sspInventory.find(
                              (s) => s.id === activeCreativeTab,
                            );
                            const widthObj = sspMatch
                              ? sspMatch.size.split("x")[0]
                              : activeCreativeTab === "leaderboard"
                                ? "728"
                                : activeCreativeTab === "rectangle"
                                  ? "300"
                                  : activeCreativeTab === "skyscraper"
                                    ? "160"
                                    : "400";
                            const heightObj = sspMatch
                              ? sspMatch.size.split("x")[1]
                              : activeCreativeTab === "leaderboard"
                                ? "90"
                                : activeCreativeTab === "rectangle"
                                  ? "250"
                                  : activeCreativeTab === "skyscraper"
                                    ? "600"
                                    : "400";
                            const iframeSrc = sspMatch
                              ? `${sspMatch.url}?ref=${activeAffiliate?.promoCode}`
                              : `https://jasper.africa/embed/ad?size=${activeCreativeTab}&ref=${activeAffiliate?.promoCode}`;
                            const codeStr = `<iframe src="${iframeSrc}" width="${widthObj}" height="${heightObj}" style="border:none;overflow:hidden"></iframe>`;
                            copyToClipboard(codeStr, setCopiedBanner);
                          }}
                          className="py-2.5 bg-slate-900 border border-slate-800 text-emerald-400 hover:text-white rounded-xl font-bold font-mono text-[10.5px] tracking-wide flex items-center justify-center space-x-1 cursor-pointer transition-colors"
                        >
                          <Code className="w-4 h-4 shrink-0" />
                          <span>
                            {copiedBanner ? "Copied Ad Tag" : "Copy SSP Ad Tag"}
                          </span>
                        </button>
                      </div>

                      {/* Display embed warning note */}
                      <p className="text-[9.5px] leading-relaxed text-slate-500 flex items-start space-x-1.5 font-sans font-light">
                        <Info className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span>
                          This HTML code simulates standard Google AdSense embed
                          frames. Place this code snippet anywhere in your
                          website placements or articles, and we will serve the
                          live ad with tracked
                          referral link behind it!
                        </span>
                      </p>
                    </div>

                    {/* Pre-written Promo Text template */}
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 text-xs text-slate-400 space-y-1.5">
                      <span className="font-bold text-[10px] text-white uppercase font-mono tracking-wider block">
                        Pre-written Promo Template:
                      </span>
                      <p className="italic text-[11px] leading-relaxed">
                        "Unawasha duka, lodge, duka la dawa (Pharmacy) au
                        mgahawa? Jasper ndio operating system uliyokuwa
                        unatafuta. Inafanya kazi 100% offline bila internet na
                        unaweza kuona ripoti zote za mauzo moja kwa moja kwenye
                        simu yako! Jisajili sasa upate siku 30 za majaribio ya
                        BURE ukitumia code yangu: {activeAffiliate?.promoCode}{" "}
                        katika https://jasper.africa/?ref=
                        {activeAffiliate?.promoCode}"
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Referred portfolio table */}
              <div className="lg:col-span-6 bg-slate-900/60 border border-slate-850/80 p-6 rounded-2xl space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm uppercase font-mono tracking-wider font-extrabold text-white">
                    Referred Subscriptions Ledgers
                  </h3>
                  <span className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-[9px] font-mono font-bold uppercase text-slate-500">
                    Real-Time Data
                  </span>
                </div>

                <div className="space-y-3 max-h-[340px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 pr-1.5">
                  {filteredSubscribers.length === 0 ? (
                    <div className="text-center py-10 px-4 rounded-xl border border-dashed border-slate-800 bg-slate-950/40 text-slate-400 space-y-3 select-none">
                      <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-lg">
                        <span>🎯</span>
                      </div>
                      <div className="space-y-1">
                        <p className="font-bold text-white text-xs">Hakuna data bado / No data yet</p>
                        <p className="text-[10px] text-slate-500 max-w-xs mx-auto text-center">Bado hakuna mteja. Shiriki code yako.</p>
                      </div>
                    </div>
                  ) : (
                    filteredSubscribers.map((sub) => (
                      <div
                        key={sub.id}
                        className="bg-slate-950/70 p-3 rounded-xl border border-slate-850 flex items-center justify-between text-xs font-mono"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-white text-[12px]">
                              {sub.storeName}
                            </span>
                            <span
                              className={`text-[8.5px] uppercase font-bold px-1.5 py-0.2 rounded ${
                                sub.status === "Paid"
                                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                                  : "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                              }`}
                            >
                              {sub.tier}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 flex justify-between gap-4 font-sans font-light">
                            <span>Joined: {sub.registeredAt}</span>
                            <span>
                              Monthly bill: TSh {sub.charge.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        <div className="text-right space-y-0.5">
                          <div
                            className={`text-sms font-bold ${sub.commission > 0 ? "text-emerald-400" : "text-slate-505"}`}
                          >
                            + TSh {sub.commission.toLocaleString()}
                          </div>
                          <span className="text-[8.5px] text-slate-505 uppercase text-slate-500 tracking-wider font-bold">
                            {sub.status === "Paid"
                              ? "CONFIRMED"
                              : "RECURRING TRIAL"}
                          </span>
                        </div>
                      </div>
                    ))
                  )}

                  <div className="text-center pt-2">
                    <button
                      onClick={() => {
                        const newName = prompt(
                          "Enter name of shop you want to simulate as referred:",
                        );
                        if (!newName) return;
                        const packageChoice = prompt(
                          "Enter Tier: 1: Ruby (20k), 2: Diamond (35k), 3: Tanzanite (50k)",
                        );
                        let tier = "Ruby";
                        let charge = 20000;
                        let commission = 3000;
                        if (packageChoice === "2") {
                          tier = "Diamond";
                          charge = 35000;
                          commission = 5250;
                        } else if (packageChoice === "3") {
                          tier = "Tanzanite";
                          charge = 50000;
                          commission = 7500;
                        }

                        const newReg = {
                          id:
                            "sub-dyn-" +
                            Math.random().toString(36).substr(2, 9),
                          storeName: newName,
                          registeredAt: new Date().toISOString().split("T")[0],
                          tier,
                          status: "Paid",
                          charge,
                          commission,
                        };

                        setSubscribers((prev) => [...prev, newReg]);

                        // Register in Global Referral Tracker ledger so it loads inside Super SaaS Admin too!
                        const promoToken =
                          activeAffiliate?.promoCode || "SARAH_JASPER";
                        const referralLedger = JSON.parse(
                          localStorage.getItem("jasper_referral_ledger") ||
                            "[]",
                        );
                        referralLedger.push({
                          id: newReg.id,
                          affiliateCode: promoToken,
                          subscriberName: newReg.storeName,
                          package: newReg.tier,
                          payoutStatus: "Pending Next Payday",
                          registeredAt: newReg.registeredAt,
                          commission: newReg.commission,
                        });
                        localStorage.setItem(
                          "jasper_referral_ledger",
                          JSON.stringify(referralLedger),
                        );

                        // Incremental click reward simulation progression
                        setClicksCount(
                          (prev) => prev + Math.floor(6 + Math.random() * 8),
                        );
                      }}
                      className="text-[10px] font-bold uppercase bg-slate-950 text-slate-400 hover:text-white border border-slate-800 px-3 py-1 text-center rounded-xl cursor-pointer hover:border-slate-700 transition-colors"
                    >
                      + Simulate New Referral Account Sign Up
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Claims & Dispute Reconciliation Support */}
            <div className="bg-slate-900/60 border border-slate-850/80 p-6 rounded-2xl mt-8 space-y-6 text-left">
              <div>
                <h3 className="text-sm uppercase font-mono tracking-wider font-extrabold text-white flex items-center space-x-2">
                  <span className="text-emerald-400">🛡️</span>
                  <span>Disputes & Payment Reconciliation Board</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Have inquiries about delayed mobile payouts, missing
                  promo-code conversions, or wish to report a payout dispute?
                  Submit a grievance directly to your team supervisor.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Form column */}
                <div className="lg:col-span-12 xl:col-span-5 bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-4">
                  <span className="text-[9.5px] font-mono font-bold text-slate-400 uppercase tracking-widest block">
                    Submit Support Claim Ticket
                  </span>

                  {claimSuccess ? (
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg space-y-2 text-center text-xs animate-fade-in text-emerald-400">
                      <p className="font-bold">
                        ✓ Ticket Submitted Successfully
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Your claim has been routed to your Supervisor and logged
                        in Platform Ledger.
                      </p>
                      <button
                        type="button"
                        onClick={() => setClaimSuccess(false)}
                        className="mt-1 px-3 py-1 bg-emerald-500 text-slate-950 rounded font-bold uppercase text-[9px] cursor-pointer"
                      >
                        File another claim
                      </button>
                    </div>
                  ) : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!claimMessage.trim())
                          return alert("Please describe your dispute details.");
                        const targetSuperMatch = activeAffiliate?.parentSuperId;
                        const claims = JSON.parse(
                          localStorage.getItem("saas_affiliate_claims") || "[]",
                        );
                        const category =
                          (
                            e.currentTarget.elements.namedItem(
                              "claimCategory",
                            ) as HTMLSelectElement
                          )?.value || "General Inquiry";

                        const newClaim = {
                          id: "CLM-" + Math.floor(Math.random() * 1000000),
                          affiliateId: activeAffiliate?.id || "unknown",
                          affiliateName: activeAffiliate?.name || "Sarah",
                          affiliateEmail: activeAffiliate?.email || "",
                          affiliatePromo: activeAffiliate?.promoCode || "SARAH",
                          parentSuperId: targetSuperMatch || null,
                          category,
                          message: claimMessage,
                          status: "Pending Review",
                          timestamp: new Date()
                            .toISOString()
                            .replace("T", " ")
                            .substring(0, 16),
                          reply: "",
                        };

                        claims.push(newClaim);
                        localStorage.setItem(
                          "saas_affiliate_claims",
                          JSON.stringify(claims),
                        );
                        setClaimMessage("");
                        setClaimSuccess(true);

                        // Notify central views to reload claims instantly
                        window.dispatchEvent(
                          new CustomEvent("saas_claims_reload"),
                        );
                      }}
                      className="space-y-3"
                    >
                      <div className="space-y-1">
                        <label className="text-[9px] font-mono uppercase text-slate-400">
                          Grievance Category Type
                        </label>
                        <select
                          name="claimCategory"
                          className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-xs text-white cursor-pointer outline-none"
                        >
                          <option value="Delayed Payout Transfer">
                            Delayed Payout Transfer
                          </option>
                          <option value="Conversion Counting Dispute">
                            Conversion Counting Dispute
                          </option>
                          <option value="Promo Coupon Code Error">
                            Promo Coupon Code Error
                          </option>
                          <option value="Tanzania WHT Tax Inquiries">
                            Tanzania WHT Tax Inquiries
                          </option>
                          <option value="Wallet Number Modification">
                            Wallet Number Modification
                          </option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[9px] font-mono text-slate-400">
                          <label className="uppercase">
                            Dispute Grievance Description
                          </label>
                          <span>{claimMessage.length}/500 chars</span>
                        </div>
                        <textarea
                          required
                          maxLength={505}
                          value={claimMessage}
                          onChange={(e) => setClaimMessage(e.target.value)}
                          placeholder="Add details..."
                          rows={3}
                          className="w-full bg-slate-900 border border-slate-800 rounded p-2.5 text-xs text-white placeholder-slate-650 outline-none focus:border-emerald-500 font-sans"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold uppercase tracking-wider text-[10px] rounded cursor-pointer transition-colors"
                      >
                        Transmit Ticket Code
                      </button>
                    </form>
                  )}
                </div>

                {/* History list column */}
                <div className="lg:col-span-12 xl:col-span-7 bg-slate-950/40 p-4 border border-slate-850 rounded-xl space-y-4">
                  <span className="text-[9.5px] font-mono font-bold text-slate-400 uppercase tracking-widest block">
                    Logged Reconciliation Tickets (
                    {
                      JSON.parse(
                        localStorage.getItem("saas_affiliate_claims") || "[]",
                      ).filter(
                        (c: any) => c.affiliateId === activeAffiliate?.id,
                      ).length
                    }
                    )
                  </span>

                  <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                    {(() => {
                      const list = JSON.parse(
                        localStorage.getItem("saas_affiliate_claims") || "[]",
                      ).filter(
                        (c: any) => c.affiliateId === activeAffiliate?.id,
                      );
                      if (list.length === 0) {
                        return (
                          <div className="text-center py-8 text-[11px] text-slate-500 font-sans italic font-light">
                            No disputes. Account is
                            set for regular payout.
                          </div>
                        );
                      }

                      return [...list].reverse().map((ticket: any) => (
                        <div
                          key={ticket.id}
                          className="bg-slate-900/60 p-3 rounded-lg border border-slate-850 text-xs text-left space-y-2"
                        >
                          <div className="flex justify-between items-center text-[10px] font-mono">
                            <span className="text-emerald-400 font-bold">
                              {ticket.id}
                            </span>
                            <span className="text-slate-500">
                              {ticket.timestamp}
                            </span>
                          </div>

                          <div className="font-light text-slate-300">
                            <strong className="text-white block font-sans text-[11px] font-bold mb-0.5">
                              {ticket.category}
                            </strong>
                            <p className="line-clamp-2 text-slate-400 font-mono text-[10.5px] leading-relaxed italic">
                              "{ticket.message}"
                            </p>
                          </div>

                          <div className="flex items-center justify-between border-t border-slate-850/60 pt-2 text-[9.5px]">
                            <span className="font-bold flex items-center space-x-1 font-mono">
                              <span className="text-slate-500">
                                Supervisor:
                              </span>
                              <span className="text-teal-400">
                                {ticket.parentSuperId
                                  ? "Super Recruiter"
                                  : "Platform Admin Helpdesk"}
                              </span>
                            </span>

                            <span
                              className={`px-2 py-0.2 rounded font-bold uppercase text-[8.5px] ${
                                ticket.status === "Resolved"
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              }`}
                            >
                              {ticket.status}
                            </span>
                          </div>

                          {ticket.reply && (
                            <div className="bg-slate-950 p-2.5 rounded border border-slate-800 text-[10.5px] text-emerald-400 font-sans leading-relaxed">
                              <strong className="text-slate-400 block text-[9px] uppercase font-mono tracking-wider mb-1">
                                Supervisor Reply Response:
                              </strong>
                              "{ticket.reply}"
                            </div>
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Super Affiliate Tax & TIN Withholding Roster Modal */}
        {showRosterModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in font-sans">
            <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
                <div className="text-left font-sans">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <span className="text-xl">📋</span>
                    <span>Downline Tax & TIN Withholding Roster</span>
                  </h2>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Official compliance roster for filing withholding tax of
                    recruitee network with Tanzania Revenue Authority (TRA)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRosterModal(false)}
                  className="text-slate-400 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 p-1.5 rounded-full cursor-pointer text-xs font-bold leading-none align-middle"
                >
                  ✕
                </button>
              </div>

              {/* Roster content */}
              <div className="p-6 overflow-y-auto space-y-6 max-h-[60vh] bg-slate-950/20 text-left">
                {/* Summary Alerts */}
                <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-xl flex flex-col md:flex-row gap-4 items-start md:items-center justify-between text-xs font-sans">
                  <div className="space-y-1">
                    <span className="font-bold text-amber-500 font-mono text-[10px] uppercase tracking-wider block">
                      TRA Withholding Compliance Statement
                    </span>
                    <p className="text-slate-300 leading-normal max-w-xl">
                      In the United Republic of Tanzania, commissions paid to
                      non-employees are subject to withholding tax rules. This
                      shows sub-affiliate payouts, their
                      National ID (NIDA), and corresponding Taxpayer
                      Identification Number (TIN) for withholding remittance
                      filings.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const csvRows = [
                          [
                            "Legal Name",
                            "Phone",
                            "NIDA Number",
                            "TIN Number",
                            "Cumulative Sales Volume (TSh)",
                            "Estimated Withholding (TSh)",
                          ],
                          ...managedKids.map((k: any) => [
                            k.name,
                            k.phone,
                            k.nidaNumber || "19951204-45129",
                            k.tinNumber || "124-954-122",
                            k.revenueGenerated || 0,
                            Math.round((k.revenueGenerated || 0) * 0.15 * 0.1),
                          ]),
                        ];
                        const csvContent =
                          "data:text/csv;charset=utf-8," +
                          csvRows.map((e) => e.join(",")).join("\n");
                        const encodedUri = encodeURI(csvContent);
                        const link = document.createElement("a");
                        link.setAttribute("href", encodedUri);
                        link.setAttribute(
                          "download",
                          `Withholding_Tax_Roster_${activeAffiliate?.promoCode}.csv`,
                        );
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        alert(
                          "📥 Exported Withholding_Tax_Roster.csv successfully!",
                        );
                      }}
                      className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3 py-1.5 rounded-lg text-[10.5px] font-mono font-bold uppercase tracking-wider cursor-pointer"
                    >
                      Export CSV Roster
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const text = managedKids
                          .map(
                            (k: any) =>
                              `Name: ${k.name} | Phone: ${k.phone} | NIDA: ${k.nidaNumber || "N/A"} | TIN: ${k.tinNumber || "N/A"}`,
                          )
                          .join("\n");
                        navigator.clipboard.writeText(text);
                        alert("📋 Copied text roster list to clipboard!");
                      }}
                      className="bg-slate-800 hover:bg-slate-500 text-slate-200 px-3 py-1.5 rounded-lg text-[10.5px] font-mono font-bold uppercase tracking-wider cursor-pointer"
                    >
                      Copy Clip
                    </button>
                  </div>
                </div>

                {/* Table list */}
                <div className="border border-slate-850 rounded-2xl overflow-hidden bg-slate-950">
                  <table className="w-full text-left text-xs font-sans">
                    <thead className="bg-slate-900 border-b border-slate-850 text-slate-500 text-[9.5px] font-mono uppercase tracking-wider">
                      <tr>
                        <th className="p-4">Direct Marketer Name</th>
                        <th className="p-4">Payout Contact (Phone)</th>
                        <th className="p-4">NIDA National ID No.</th>
                        <th className="p-4">TIN Taxpayer ID No.</th>
                        <th className="p-4 text-right">
                          Revenue Managed (TSh)
                        </th>
                        <th className="p-4 text-right">
                          Est. Withholding (10%)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900 text-slate-300 font-sans text-xs">
                      {managedKids.map((k: any) => {
                        const estWithholding = Math.round(
                          (k.revenueGenerated || 0) * 0.15 * 0.1,
                        );
                        return (
                          <tr key={k.id} className="hover:bg-slate-900/30">
                            <td className="p-4 font-bold text-white">
                              {k.name}
                            </td>
                            <td className="p-4 font-mono text-slate-300">
                              {k.phone}
                            </td>
                            <td className="p-4 font-mono text-slate-400">
                              {k.nidaNumber || "19951204-45129-00001-44"}
                            </td>
                            <td className="p-4 font-mono text-amber-500 font-bold">
                              {k.tinNumber || "124-954-122"}
                            </td>
                            <td className="p-4 text-right font-mono text-emerald-400 font-bold">
                              TSh {(k.revenueGenerated || 0).toLocaleString()}
                            </td>
                            <td className="p-4 text-right font-mono text-rose-400">
                              TSh {estWithholding.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-slate-800 bg-slate-950/40 text-right">
                <button
                  type="button"
                  onClick={() => setShowRosterModal(false)}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono uppercase font-black tracking-wider rounded-xl cursor-pointer"
                >
                  Close tax Console
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Scroll-to-Accept Terms Modal Popup Overlay */}
        {showTermsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in font-sans">
            <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
              {/* Header */}
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
                <div className="flex items-center space-x-2">
                  <span className="text-xl">📜</span>
                  <div className="text-left">
                    <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                      {getTermsTitle(lang)}
                    </h2>
                    <p className="text-[10px] text-slate-400">
                      {getTermsSubtitle(lang)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTermsModal(false)}
                  className="text-slate-400 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 p-1.5 rounded-full cursor-pointer text-xs font-bold leading-none align-middle"
                >
                  ✕
                </button>
              </div>

              {/* Scrollable Terms Area */}
              <div
                onScroll={(e) => {
                  const element = e.currentTarget;
                  if (
                    element.scrollHeight -
                      element.scrollTop -
                      element.clientHeight <
                    12
                  ) {
                    setHasScrolledToBottom(true);
                  }
                }}
                className="p-6 overflow-y-auto space-y-4 text-xs text-slate-300 leading-relaxed max-h-[50vh] bg-slate-950/20 text-left selection:bg-amber-500/10 select-none font-sans"
              >
                {renderTermsContent(lang, portalRole)}

                <div className="pt-4 border-t border-slate-800 text-[10px] text-slate-500 italic text-center">
                  {getTermsScrollMsg(lang)}
                </div>
              </div>

              {/* Footer Accept Controls */}
              <div className="p-6 border-t border-slate-800 bg-slate-950/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-2">
                  <span
                    className={`w-3 h-3 rounded-full ${hasScrolledToBottom ? "bg-emerald-500 animate-pulse" : "bg-slate-700"}`}
                  />
                  <span className="text-[10.5px] font-semibold text-slate-400 text-left">
                    {getTermsStatusMsg(lang, hasScrolledToBottom)}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={!hasScrolledToBottom}
                  onClick={() => {
                    setAcceptedTerms(true);
                    setShowTermsModal(false);
                  }}
                  className={`px-6 py-3 font-mono uppercase tracking-wider text-xs font-black rounded-xl transition-all duration-300 md:w-auto w-full ${
                    hasScrolledToBottom
                      ? "bg-amber-500 text-slate-950 font-black hover:bg-amber-400 cursor-pointer shadow-lg shadow-amber-500/10 hover:scale-102"
                      : "bg-slate-800 text-slate-500 opacity-40 cursor-not-allowed border border-slate-700"
                  }`}
                >
                  {getTermsAcceptBtnText(lang, hasScrolledToBottom)}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* End with Contact Support footer */}
        <div className="border-t border-slate-900 pt-8 pb-4 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-550 text-slate-500 font-mono gap-4">
          <span>
            © 2026 Jasper Suite • Verified Affiliate Shared Growth Ledger
          </span>
          <button
            onClick={() => onNavigate("/")}
            className="text-slate-400 hover:text-emerald-400 transition-colors bg-transparent border border-transparent p-0 outline-none cursor-pointer flex items-center space-x-1 font-bold uppercase tracking-wider"
          >
            <span>Need Help? Contact Support</span>
          </button>
        </div>
      </div>
    </div>
  );
}
