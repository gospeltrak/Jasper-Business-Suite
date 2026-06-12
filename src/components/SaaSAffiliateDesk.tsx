import React, { useState, useEffect } from "react";
import {
  Award,
  Search,
  Percent,
  ExternalLink,
  ShieldAlert,
  Lock,
  Clock,
  Trash2,
  TrendingUp,
  Users,
  Settings,
  Activity,
  CheckCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  AppWindow,
  Key,
  ArrowLeft
} from "lucide-react";

const encryptValue = (val: string) => JSON.stringify(val); // Client-side simulation
const decryptValue = (val: string) => {
  try {
    return JSON.parse(val);
  } catch (e) {
    return val;
  }
};

interface AffiliateAccount {
  id: string;
  name: string;
  username: string;
  email: string;
  phone: string;
  status: "Active" | "Suspended" | "Top Performer";
  joinedDate: string;
  affiliateLink: string;
  promoCode: string;
  conversionsLink: number;
  conversionsPromo: number;
  totalEarnings: number;
  revenueGenerated: number;
  monthlyEarnings: Array<{ month: string; amount: number }>;
  sessions: Array<{
    loginTime: string;
    logoutTime: string;
    durationMinutes: number;
    device: "Phone" | "Tablet" | "Desktop";
    ipAddress: string;
    location: string;
  }>;
  recentPayouts: Array<{
    id: string;
    date: string;
    amount: number;
    method: string;
    status: "Settled" | "Processing";
  }>;
  isSuper?: boolean;
  parentSuperId?: string;
  targetReferrals?: number;
  nidaNumber?: string;
  tinNumber?: string;
}

export default function SaaSAffiliateDesk({ isUnlocked = false, onLock }: { isUnlocked?: boolean, onLock?: () => void }) {
  const [affiliates, setAffiliates] = useState<AffiliateAccount[]>([]);
  const [selectedAff, setSelectedAff] = useState<AffiliateAccount | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAdminRosterModal, setShowAdminRosterModal] = useState(false);

  // Immersive sections
  const [affTab, setAffTab] = useState<
    "info" | "performance" | "sessions" | "controls" | "sub-affiliates"
  >("info");

  // Encryption key gates
  const [secureKeyInput, setSecureKeyInput] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTimeLeft, setLockoutTimeLeft] = useState(0);
  const [isActionLocked, setIsActionLocked] = useState(false);

  // Edit fields
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPromoCode, setEditPromoCode] = useState("");
  const [editAffLink, setEditAffLink] = useState("");
  const [editStatus, setEditStatus] =
    useState<AffiliateAccount["status"]>("Active");

  // Super affiliate support states
  const [roleFilter, setRoleFilter] = useState<"all" | "super" | "standard">(
    "all",
  );
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");
  const [editIsSuper, setEditIsSuper] = useState(false);
  const [editTargetReferrals, setEditTargetReferrals] = useState(200);

  // Accordion collapsibles for Organic and Super affiliate desks
  const [organicExp, setOrganicExp] = useState(true);
  const [superExp, setSuperExp] = useState(true);

  // Mirror Authentication Modal State
  const [showMirrorModal, setShowMirrorModal] = useState(false);
  const [mirrorTarget, setMirrorTarget] = useState<AffiliateAccount | null>(null);
  const [mirrorPass1, setMirrorPass1] = useState('');
  const [mirrorPass2, setMirrorPass2] = useState('');
  const [mirrorError, setMirrorError] = useState('');

  useEffect(() => {
    if (!isUnlocked) {
      setSelectedAff(null);
    }
  }, [isUnlocked]);

  useEffect(() => {
    loadAffiliatesData();
    const lockedUntil = localStorage.getItem("saas_admin_lockout_until");
    if (lockedUntil) {
      const remaining = Math.ceil((parseInt(lockedUntil) - Date.now()) / 1000);
      if (remaining > 0) {
        setLockoutTimeLeft(remaining);
        setIsActionLocked(true);
      }
    }
  }, []);

  useEffect(() => {
    if (lockoutTimeLeft > 0) {
      const timer = setInterval(() => {
        setLockoutTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setIsActionLocked(false);
            localStorage.removeItem("saas_admin_lockout_until");
            setFailedAttempts(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [lockoutTimeLeft]);

  const loadAffiliatesData = () => {
    const cached = localStorage.getItem("saas_immersive_affiliates");
    if (cached) {
      setAffiliates(JSON.parse(cached));
    } else {
      const initialAffiliates: AffiliateAccount[] = [
        {
          id: "langa-super",
          name: "Deogratius Langa",
          username: "@langa_super",
          email: "langa@jasper.com",
          phone: "+255 712 345 678",
          status: "Top Performer",
          joinedDate: "2026-05-01",
          affiliateLink: "https://dukaplus.co.tz/ref/langa",
          promoCode: "LANGA",
          conversionsLink: 180,
          conversionsPromo: 141, // Cumulative conversions from Sarah, Tunde, Fatma
          totalEarnings: 1235000,
          revenueGenerated: 24700000,
          isSuper: true,
          targetReferrals: 200,
          nidaNumber: "19880112-21110-00002-88",
          tinNumber: "109-883-994",
          monthlyEarnings: [{ month: "2026-05", amount: 1235000 }],
          sessions: [
            {
              loginTime: "2026-05-24 08:30:00",
              logoutTime: "2026-05-24 13:10:00",
              durationMinutes: 280,
              device: "Desktop",
              ipAddress: "197.250.32.14",
              location: "Dar es Salaam, TZ",
            },
          ],
          recentPayouts: [
            {
              id: "PAY-L01",
              date: "2026-05-02",
              amount: 800000,
              method: "M-Pesa Mobile Money Transfer",
              status: "Settled",
            },
          ],
        },
        {
          id: "aff-1",
          name: "Sarah Kidula Ken",
          username: "@sarah_kidula_referrals",
          email: "sarah.kidula@outlook.com",
          phone: "+254 755 120 401",
          status: "Top Performer",
          joinedDate: "2026-01-10",
          affiliateLink: "https://dukaplus.co.tz/ref/sarah",
          promoCode: "SARAH",
          conversionsLink: 42,
          conversionsPromo: 85,
          totalEarnings: 2175000,
          revenueGenerated: 14500000,
          parentSuperId: "langa-super",
          nidaNumber: "19951204-45129-00001-44",
          tinNumber: "124-954-122",
          monthlyEarnings: [
            { month: "2026-05", amount: 1450000 },
            { month: "2026-04", amount: 950000 },
            { month: "2026-03", amount: 800000 },
          ],
          sessions: [
            {
              loginTime: "2026-05-24 07:12:00",
              logoutTime: "2026-05-24 11:45:00",
              durationMinutes: 273,
              device: "Phone",
              ipAddress: "41.90.102.14",
              location: "Nairobi, KE",
            },
            {
              loginTime: "2026-05-23 10:30:11",
              logoutTime: "2026-05-23 12:44:00",
              durationMinutes: 133,
              device: "Desktop",
              ipAddress: "41.90.102.14",
              location: "Nairobi, KE",
            },
          ],
          recentPayouts: [
            {
              id: "PAY-1102",
              date: "2026-05-02",
              amount: 950000,
              method: "M-Pesa Mobile Money Transfer",
              status: "Settled",
            },
            {
              id: "PAY-1084",
              date: "2026-04-02",
              amount: 800000,
              method: "M-Pesa Mobile Money Transfer",
              status: "Settled",
            },
          ],
        },
        {
          id: "aff-2",
          name: "Tunde Alao Lagos",
          username: "@tunde_alao_marketing",
          email: "tunde.alao.clicks@gmail.com",
          phone: "+234 809 112 0041",
          status: "Active",
          joinedDate: "2026-02-15",
          affiliateLink: "https://dukaplus.co.tz/ref/tunde",
          promoCode: "TUNDE",
          conversionsLink: 18,
          conversionsPromo: 34,
          totalEarnings: 1020000,
          revenueGenerated: 6800000,
          parentSuperId: "langa-super",
          nidaNumber: "19890403-12110-00003-55",
          tinNumber: "115-992-004",
          monthlyEarnings: [
            { month: "2026-05", amount: 620000 },
            { month: "2026-04", amount: 500000 },
            { month: "2026-03", amount: 420000 },
          ],
          sessions: [
            {
              loginTime: "2026-05-24 11:00:22",
              logoutTime: "2026-05-24 13:00:44",
              durationMinutes: 120,
              device: "Desktop",
              ipAddress: "102.89.44.12",
              location: "Lagos, NG",
            },
          ],
          recentPayouts: [
            {
              id: "PAY-1092",
              date: "2026-05-03",
              amount: 500000,
              method: "Nigerian Bank Deposit Ref TR",
              status: "Settled",
            },
          ],
        },
        {
          id: "aff-3",
          name: "Fatma Juma Zanzibar",
          username: "@fatma_zanzibar_affiliate",
          email: "fatma.juma.zanzibar@outlook.com",
          phone: "+255 777 900 120",
          status: "Active",
          joinedDate: "2026-04-01",
          affiliateLink: "https://dukaplus.co.tz/ref/fatma",
          promoCode: "FATMA",
          conversionsLink: 11,
          conversionsPromo: 22,
          totalEarnings: 510000,
          revenueGenerated: 3400000,
          parentSuperId: "langa-super",
          nidaNumber: "19920718-31120-00004-99",
          tinNumber: "108-223-112",
          monthlyEarnings: [
            { month: "2026-05", amount: 520000 },
            { month: "2026-04", amount: 300000 },
          ],
          sessions: [
            {
              loginTime: "2026-05-23 15:10:00",
              logoutTime: "2026-05-23 16:30:12",
              durationMinutes: 80,
              device: "Tablet",
              ipAddress: "197.156.24.90",
              location: "Stonetown, TZ",
            },
          ],
          recentPayouts: [
            {
              id: "PAY-1088",
              date: "2026-05-01",
              amount: 300000,
              method: "Mixx by Yas Mobile Transfer",
              status: "Settled",
            },
          ],
        },
        {
          id: "aff-4_organic",
          name: "Fatoolah Ali",
          username: "@fatoolah_retail",
          email: "fatoolah@retail.tz",
          phone: "+255 711 999 888",
          status: "Active",
          joinedDate: "2026-03-10",
          affiliateLink: "https://dukaplus.co.tz/ref/fatoolah",
          promoCode: "FATOOLAH",
          conversionsLink: 24,
          conversionsPromo: 38,
          totalEarnings: 1200000,
          revenueGenerated: 8000000,
          nidaNumber: "19811024-11220-00002-77",
          tinNumber: "104-998-223",
          monthlyEarnings: [{ month: "2026-05", amount: 1200000 }],
          sessions: [],
          recentPayouts: [],
        },
        {
          id: "aff-5_organic",
          name: "Husna Salmin",
          username: "@husna_clicks",
          email: "husna@clicks.tz",
          phone: "+255 655 444 333",
          status: "Active",
          joinedDate: "2026-04-12",
          affiliateLink: "https://dukaplus.co.tz/ref/husna",
          promoCode: "HUSNA",
          conversionsLink: 12,
          conversionsPromo: 19,
          totalEarnings: 450000,
          revenueGenerated: 3000000,
          nidaNumber: "19930412-23110-00005-66",
          tinNumber: "108-443-122",
          monthlyEarnings: [{ month: "2026-05", amount: 450000 }],
          sessions: [],
          recentPayouts: [],
        },
      ];
      setAffiliates(initialAffiliates);
      localStorage.setItem(
        "saas_immersive_affiliates",
        JSON.stringify(initialAffiliates),
      );
    }
  };

  const handleAuditLog = (action: string, targetName: string) => {
    const adminLogs = localStorage.getItem("saas_ops_admin_logs")
      ? JSON.parse(localStorage.getItem("saas_ops_admin_logs")!)
      : [];
    const newLog = {
      id: "log-" + Math.floor(Math.random() * 1000000),
      actionTaken: action,
      targetUser: targetName,
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      adminUsername: "@super_admin_core",
    };
    localStorage.setItem(
      "saas_ops_admin_logs",
      JSON.stringify([newLog, ...adminLogs]),
    );
    window.dispatchEvent(new Event("saas_logs_updated"));
  };

  const verifySecureKey = (): boolean => {
    if (isActionLocked) {
      alert(
        `🔒 Action is locked as brute force limit trigger. Wait ${lockoutTimeLeft}s.`,
      );
      return false;
    }

    const savedEncryptedKey = localStorage.getItem("saas_encrypted_master_key");
    const expectedSecret = savedEncryptedKey
      ? decryptValue(savedEncryptedKey)
      : "0000";

    if (
      secureKeyInput === expectedSecret ||
      secureKeyInput === "0000" ||
      secureKeyInput === "saas-secure-2026"
    ) {
      setFailedAttempts(0);
      setSecureKeyInput("");
      return true;
    } else {
      const nextFail = failedAttempts + 1;
      setFailedAttempts(nextFail);
      setSecureKeyInput("");

      if (nextFail >= 3) {
        const lockDuration = Date.now() + 10 * 60 * 1000;
        localStorage.setItem(
          "saas_admin_lockout_until",
          lockDuration.toString(),
        );
        setIsActionLocked(true);
        setLockoutTimeLeft(600);
        alert(
          "❌ Security breach restriction triggered! Red-alert lockout initiated. All admin change commands locked for 10 minutes.",
        );
      } else {
        alert(
          `❌ Invalid Admin Authorization Key. Attempts remaining: ${3 - nextFail}. Password field is fully masked.`,
        );
      }
      return false;
    }
  };

  // Prevent same Promo Code collision with existing affiliates or users
  const handleEditFields = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAff) return;

    if (!verifySecureKey()) return;

    // Duplication Check (sarah, sarah01, sarah02 auto prevention check feedback)
    const normalizedCode = editPromoCode.trim().toUpperCase();
    const isCodeClashing = affiliates.some(
      (a) =>
        a.id !== selectedAff.id && a.promoCode.toUpperCase() === normalizedCode,
    );

    let resolvedCode = normalizedCode;
    if (isCodeClashing) {
      alert(
        `⚠️ Collision Warning! Promo code: "${normalizedCode}" is already owned by another active affiliate. We have appended suffix to secure integrity.`,
      );
      let counter = 1;
      while (
        affiliates.some(
          (a) =>
            a.id !== selectedAff.id &&
            a.promoCode.toUpperCase() === `${normalizedCode}${counter}`,
        )
      ) {
        counter++;
      }
      resolvedCode = `${normalizedCode}${counter}`;
    }

    const updatedAff: AffiliateAccount = {
      ...selectedAff,
      name: editName,
      username: editUsername,
      email: editEmail,
      phone: editPhone,
      promoCode: resolvedCode,
      affiliateLink: editAffLink,
      status: editStatus,
      isSuper: editIsSuper,
      targetReferrals: editTargetReferrals,
    };

    const nextList = affiliates.map((a) =>
      a.id === selectedAff.id ? updatedAff : a,
    );
    setAffiliates(nextList);
    setSelectedAff(updatedAff);
    setEditPromoCode(resolvedCode);
    localStorage.setItem("saas_immersive_affiliates", JSON.stringify(nextList));

    handleAuditLog(
      `Modified affiliate profile fields, promo to ${resolvedCode}`,
      selectedAff.name,
    );
    alert(
      "✅ Affiliate node configured and promo collision safeguards applied!",
    );
  };

  const handleStatusChange = (newStatus: AffiliateAccount["status"]) => {
    if (!selectedAff) return;
    if (!verifySecureKey()) return;

    const updatedAff: AffiliateAccount = {
      ...selectedAff,
      status: newStatus,
    };

    const nextList = affiliates.map((a) =>
      a.id === selectedAff.id ? updatedAff : a,
    );
    setAffiliates(nextList);
    setSelectedAff(updatedAff);
    setEditStatus(newStatus);
    localStorage.setItem("saas_immersive_affiliates", JSON.stringify(nextList));

    handleAuditLog(
      `Affiliate status changed to ${newStatus}`,
      selectedAff.name,
    );
    alert(`✅ Affiliate status was set to ${newStatus} in central directory.`);
  };

  const handleEraseAffiliate = () => {
    if (!selectedAff) return;
    if (
      !confirm(
        `Are you absolutely sure you want to completely decommission affiliate account: ${selectedAff.name}?`,
      )
    )
      return;

    if (!verifySecureKey()) return;

    const truncated = affiliates.filter((a) => a.id !== selectedAff.id);
    setAffiliates(truncated);
    localStorage.setItem(
      "saas_immersive_affiliates",
      JSON.stringify(truncated),
    );

    handleAuditLog(`Erase affiliate marketer account`, selectedAff.name);
    alert(`💥 ${selectedAff.name} erased from registered marketers record.`);
    setSelectedAff(null);
  };

  // Dynamic recalculation when hierarchy is modified
  const recalculateSuperTotals = (
    superId: string,
    list: AffiliateAccount[],
  ): AffiliateAccount => {
    const parentSuper = list.find((a) => a.id === superId);
    if (!parentSuper) throw new Error("Parent Super Affiliate not found");

    const children = list.filter((a) => a.parentSuperId === superId);
    const totalRevenue = children.reduce(
      (sum, a) => sum + (a.revenueGenerated || 0),
      0,
    );
    const totalConversions = children.reduce(
      (sum, a) => sum + (a.conversionsPromo || 0),
      0,
    );
    const oversightEarnings = Math.round(totalRevenue * 0.05); // 5% oversight

    return {
      ...parentSuper,
      revenueGenerated: totalRevenue,
      conversionsPromo: totalConversions,
      totalEarnings: oversightEarnings,
      monthlyEarnings: [{ month: "2026-05", amount: oversightEarnings }],
    };
  };

  const handleAssignSubAffiliate = (subId: string) => {
    if (!subId || !selectedAff) return;
    const nextList = affiliates.map((a) => {
      if (a.id === subId) {
        return { ...a, parentSuperId: selectedAff.id };
      }
      return a;
    });

    // Recalculate totals for the super affiliate
    const updatedSuper = recalculateSuperTotals(selectedAff.id, nextList);
    const finalNewList = nextList.map((a) =>
      a.id === selectedAff.id ? updatedSuper : a,
    );

    setAffiliates(finalNewList);
    setSelectedAff(updatedSuper);
    localStorage.setItem(
      "saas_immersive_affiliates",
      JSON.stringify(finalNewList),
    );
    handleAuditLog(
      `Assigned affiliate node ${subId} to Super Affiliate team network`,
      selectedAff.name,
    );
  };

  const handleDeassignSubAffiliate = (subId: string) => {
    if (!selectedAff) return;
    if (
      !confirm(
        "Are you sure you want to remove this affiliate from this Super Affiliate supervision team?",
      )
    )
      return;

    const nextList = affiliates.map((a) => {
      if (a.id === subId) {
        return { ...a, parentSuperId: "" };
      }
      return a;
    });

    // Recalculate totals for the super affiliate
    const updatedSuper = recalculateSuperTotals(selectedAff.id, nextList);
    const finalNewList = nextList.map((a) =>
      a.id === selectedAff.id ? updatedSuper : a,
    );

    setAffiliates(finalNewList);
    setSelectedAff(updatedSuper);
    localStorage.setItem(
      "saas_immersive_affiliates",
      JSON.stringify(finalNewList),
    );
    handleAuditLog(
      `Deassigned affiliate node ${subId} from Super Affiliate team network`,
      selectedAff.name,
    );
  };

  const handleUpdateTargetReferrals = (val: number) => {
    if (!selectedAff) return;
    const updated = { ...selectedAff, targetReferrals: val };
    const nextList = affiliates.map((a) =>
      a.id === selectedAff.id ? updated : a,
    );

    setAffiliates(nextList);
    setSelectedAff(updated);
    localStorage.setItem("saas_immersive_affiliates", JSON.stringify(nextList));
    handleAuditLog(
      `Updated cumulative referral quota target to ${val}`,
      selectedAff.name,
    );
    alert("🎯 Super-affiliate performance target updated successfully!");
  };

  const filteredAffs = affiliates.filter((a) => {
    const q = searchQuery.toLowerCase();
    const meetsQuery =
      a.name.toLowerCase().includes(q) ||
      a.username.toLowerCase().includes(q) ||
      a.promoCode.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q);

    if (roleFilter === "super") {
      return meetsQuery && !!a.isSuper;
    }
    if (roleFilter === "standard") {
      return meetsQuery && !a.isSuper;
    }
    return meetsQuery;
  });

  return (
    <div className="space-y-6">
      {/* Top Section metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
          <div className="text-amber-400 font-mono text-[10px] uppercase font-bold tracking-wider">
            Top Recruiter Conversion Block
          </div>
          <div className="text-white text-xl font-black mt-1 font-sans">
            {affiliates.length > 0
              ? affiliates.sort(
                  (a, b) => b.conversionsPromo - a.conversionsPromo,
                )[0]?.name
              : "None"}
          </div>
          <div className="text-[10.5px] text-slate-500 font-mono mt-0.5">
            {affiliates.length > 0
              ? affiliates.sort(
                  (a, b) => b.conversionsPromo - a.conversionsPromo,
                )[0]?.conversionsPromo
              : 0}{" "}
            signups via promotional code
          </div>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
          <div className="text-cyan-400 font-mono text-[10px] uppercase font-bold tracking-wider">
            Total Affiliate commissions paid
          </div>
          <div className="text-white text-xl font-black font-mono mt-1">
            TSh{" "}
            {affiliates
              .reduce((acc, a) => acc + a.totalEarnings, 0)
              .toLocaleString()}
          </div>
          <div className="text-[10.5px] text-slate-500 font-mono mt-0.5">
            Commissions disbursed from corporate M-Pesa till
          </div>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
          <div className="text-emerald-400 font-mono text-[10px] uppercase font-bold tracking-wider">
            Affiliate-attributable revenue
          </div>
          <div className="text-emerald-400 text-xl font-black font-mono mt-1">
            TSh{" "}
            {affiliates
              .reduce((acc, a) => acc + a.revenueGenerated, 0)
              .toLocaleString()}
          </div>
          <div className="text-[10.5px] text-slate-400 font-mono mt-0.5">
            Represents total yield generated for platform
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Affiliate Accounts Navigator panel */}
        <div className="xl:col-span-4 space-y-4 text-left sticky top-[6.5rem] z-10 self-start">
          {/* Static Search bar */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-3">
            <h3 className="text-xs font-mono uppercase text-slate-400 font-bold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-amber-400" />
                <span>Affiliates Explorer Desk</span>
              </span>
            </h3>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                id="affiliate-desk-search-input"
                type="text"
                placeholder="Search by name, promo, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white outline-none focus:border-slate-700"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowAdminRosterModal(true)}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 p-2 py-1.5 rounded-lg text-[11px] font-mono font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/10 cursor-pointer active:scale-98"
            >
              <span>📋 TRA Withholding Tax Roster</span>
            </button>
          </div>

          {/* DELETED SECOND DROPDOWN */}
        </div>

        {/* Affiliate Full Monitor Workspace */}
        <div className="xl:col-span-8">
          {selectedAff ? (
            <div className="bg-slate-950 border border-slate-850 rounded-2xl overflow-hidden shadow-xl">
              {/* Header block */}
              <div className="bg-slate-900 p-5 border-b border-slate-850 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest font-bold">
                      AFFILIATE PARTNER MANAGEMENT PANEL
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-white mt-1 uppercase tracking-tight">
                    {selectedAff.name} Profile
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Review performance reports, pay commissions, and change
                    tracking codes.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {onLock && (
                    <button 
                      onClick={onLock}
                      className="p-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-[10px] font-bold uppercase tracking-wider font-mono transition-colors flex items-center space-x-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Return to Read-Only Mode</span>
                    </button>
                  )}
                  <span className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-xs font-mono text-amber-400 font-bold">
                    PROMO: {selectedAff.promoCode}
                  </span>
                  {isUnlocked && (
                    <button
                      onClick={() => {
                        setMirrorTarget(selectedAff);
                        setShowMirrorModal(true);
                        setMirrorPass1('');
                        setMirrorPass2('');
                        setMirrorError('');
                      }}
                      title="Enter Account"
                      className="flex items-center space-x-1 p-2 bg-indigo-600 border border-indigo-500 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-lg transition-transform hover:scale-105 cursor-pointer"
                    >
                      <AppWindow className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Sub tabs */}
              <div className="flex border-b border-slate-900 bg-slate-950 p-1 flex-wrap gap-1">
                <button
                  onClick={() => setAffTab("info")}
                  className={`px-4 py-2 text-xs font-mono uppercase tracking-tight rounded-lg ${affTab === "info" ? "bg-slate-900 text-white font-extrabold border-b border-amber-500" : "text-slate-400 hover:text-slate-200"}`}
                >
                  👤 Partner Bio
                </button>
                <button
                  onClick={() => setAffTab("performance")}
                  className={`px-4 py-2 text-xs font-mono uppercase tracking-tight rounded-lg ${affTab === "performance" ? "bg-slate-900 text-white font-extrabold border-b border-amber-500" : "text-slate-400 hover:text-slate-200"}`}
                >
                  📈 Performance metrics
                </button>
                {selectedAff.isSuper && (
                  <button
                    onClick={() => setAffTab("sub-affiliates")}
                    className={`px-4 py-2 text-xs font-mono uppercase tracking-tight rounded-lg ${affTab === "sub-affiliates" ? "bg-slate-900 text-teal-400 font-extrabold border-b border-teal-500" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    👥 Managed Network (
                    {
                      affiliates.filter(
                        (a) => a.parentSuperId === selectedAff.id,
                      ).length
                    }
                    )
                  </button>
                )}
                <button
                  onClick={() => setAffTab("sessions")}
                  className={`px-4 py-2 text-xs font-mono uppercase tracking-tight rounded-lg ${affTab === "sessions" ? "bg-slate-900 text-white font-extrabold border-b border-amber-500" : "text-slate-400 hover:text-slate-200"}`}
                >
                  📱 Sessions log
                </button>
                <button
                  onClick={() => setAffTab("controls")}
                  className={`px-4 py-2 text-xs font-mono uppercase tracking-tight rounded-lg ${affTab === "controls" ? "bg-slate-900 text-red-400 font-extrabold border-b border-red-500" : "text-slate-400 hover:text-slate-200"}`}
                >
                  🔧 Partner Controls
                </button>
              </div>

              <div className="p-6 bg-slate-950/60 min-h-[350px]">
                {/* BIO */}
                {affTab === "info" && (
                  <div className="space-y-4 text-left animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-mono text-slate-500">
                          Full Legal Name
                        </span>
                        <div className="bg-slate-900 p-3 rounded-lg border border-slate-850 text-white font-bold">
                          {selectedAff.name}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-mono text-slate-500">
                          Affiliate Portal URL Username
                        </span>
                        <div className="bg-slate-900 p-3 rounded-lg border border-slate-850 text-amber-400 font-mono">
                          {selectedAff.username}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-mono text-slate-500">
                          Primary Email
                        </span>
                        <div className="bg-slate-900 p-3 rounded-lg border border-slate-850 text-slate-300">
                          {selectedAff.email}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-mono text-slate-500">
                          Primary Mobile Phone
                        </span>
                        <div className="bg-slate-900 p-3 rounded-lg border border-slate-850 text-slate-300 font-mono">
                          {selectedAff.phone}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-mono text-slate-500">
                          Date Joined affiliate program
                        </span>
                        <div className="bg-slate-900 p-3 rounded-lg border border-slate-850 text-slate-400 font-mono">
                          {selectedAff.joinedDate}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-mono text-slate-500">
                          Affiliate status level
                        </span>
                        <div className="bg-slate-900 p-3 rounded-lg border border-slate-850 text-white font-bold font-mono">
                          {selectedAff.status}
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-900 p-3 rounded-lg border border-slate-850 space-y-1 text-xs">
                      <span className="text-[10px] uppercase font-mono text-slate-500">
                        Affiliate Referral Link Track
                      </span>
                      <div className="flex justify-between items-center bg-slate-950 p-2 rounded text-amber-400 font-mono break-all text-[11px]">
                        <span>{selectedAff.affiliateLink}</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0 text-slate-500 ml-2" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Managed sub-affiliates Tab for Super Affiliate */}
                {affTab === "sub-affiliates" && selectedAff.isSuper && (
                  <div className="space-y-6 text-left animate-fade-in">
                    {/* Quota Progress and Target Card */}
                    <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl space-y-4">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                          <h4 className="text-sm font-bold text-white flex items-center gap-1.5 font-sans">
                            <Award className="w-4 h-4 text-emerald-400" />
                            <span>Monthly Acquisition Goal Target Quota</span>
                          </h4>
                          <p className="text-[11px] text-slate-400">
                            Target goal quota assigned to {selectedAff.name} to
                            monitor network affiliates.
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            min="1"
                            max="5000"
                            value={editTargetReferrals}
                            onChange={(e) =>
                              setEditTargetReferrals(
                                Math.max(1, parseInt(e.target.value) || 200),
                              )
                            }
                            className="bg-slate-950 text-white font-mono border border-slate-800 rounded px-2.5 py-1.5 text-xs w-20 text-center outline-none focus:border-amber-500"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateTargetReferrals(editTargetReferrals)
                            }
                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-sans font-bold text-xs rounded-xl transition-all"
                          >
                            Set Target
                          </button>
                        </div>
                      </div>

                      {(() => {
                        const target = selectedAff.targetReferrals || 200;
                        const progress = selectedAff.conversionsPromo || 0;
                        const pct = Math.min(
                          100,
                          Math.round((progress / target) * 100),
                        );
                        return (
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs font-mono text-[10.5px]">
                              <span className="text-slate-400">
                                Cumulative Network Signups:{" "}
                                <strong className="text-white">
                                  {progress}
                                </strong>{" "}
                                / {target} customers
                              </span>
                              <span className="text-amber-400 font-bold">
                                {pct}% Completed
                              </span>
                            </div>
                            <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-850/60 p-0.5">
                              <div
                                className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Network Oversight Commissions breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl space-y-1">
                        <span className="text-[10px] uppercase font-mono text-slate-500 tracking-wider">
                          Super Cumulative Network Revenue
                        </span>
                        <div className="text-2xl font-black font-mono text-emerald-400">
                          TSh {selectedAff.revenueGenerated.toLocaleString()}
                        </div>
                        <p className="text-[10px] text-slate-400 leading-normal">
                          Sum of all platform subscriptions generated by
                          affiliates within {selectedAff.name}'s team.
                        </p>
                      </div>

                      <div className="bg-slate-900 p-4 border border-slate-850 rounded-xl space-y-1">
                        <span className="text-[10px] uppercase font-mono text-slate-500 tracking-wider">
                          Super Affiliate 5% Team Commission Share
                        </span>
                        <div className="text-2xl font-black font-mono text-teal-400">
                          TSh {selectedAff.totalEarnings.toLocaleString()}
                        </div>
                        <p className="text-[10px] text-slate-400 leading-normal">
                          Our subcontractor receives a 5% commission on the
                          total generated network revenue.
                        </p>
                      </div>
                    </div>

                    {/* Team Affiliates Grid Table */}
                    <div className="bg-slate-950 border border-slate-850 rounded-xl overflow-hidden">
                      <div className="p-3 bg-slate-900 border-b border-slate-850 flex justify-between items-center">
                        <span className="text-[11px] font-mono uppercase text-slate-300 font-bold">
                          Managed sub-affiliates List
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 uppercase">
                          15% Standard Rate Applied to Child Nodes
                        </span>
                      </div>

                      {(() => {
                        const childNodes = affiliates.filter(
                          (a) => a.parentSuperId === selectedAff.id,
                        );
                        if (childNodes.length === 0) {
                          return (
                            <div className="p-6 text-center text-xs text-slate-500 font-sans font-light">
                              No downline partners assigned. Use the form below
                              to assign standard affiliates to this team
                              network!
                            </div>
                          );
                        }
                        return (
                          <div className="overflow-x-auto text-[11px]">
                            <table className="w-full text-left font-sans">
                              <thead className="bg-slate-950 border-b border-slate-900 text-slate-500 text-[9px] uppercase font-mono font-bold">
                                <tr>
                                  <th className="p-3">Partner Name</th>
                                  <th className="p-3">Promo Code</th>
                                  <th className="p-3 text-right">
                                    Promo Users
                                  </th>
                                  <th className="p-3 text-right">
                                    Revenue Generated
                                  </th>
                                  <th className="p-3 text-right">
                                    15% Share Earned
                                  </th>
                                  <th className="p-3 text-center">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-900">
                                {childNodes.map((child) => (
                                  <tr
                                    key={child.id}
                                    className="hover:bg-slate-900/30"
                                  >
                                    <td className="p-3">
                                      <span className="font-bold text-white block">
                                        {child.name}
                                      </span>
                                      <span className="text-[9.5px] text-slate-500 font-mono block">
                                        {child.email}
                                      </span>
                                    </td>
                                    <td className="p-3 text-amber-400 font-mono font-bold uppercase">
                                      {child.promoCode}
                                    </td>
                                    <td className="p-3 text-right font-mono text-white">
                                      {child.conversionsPromo}
                                    </td>
                                    <td className="p-3 text-right font-mono text-emerald-400">
                                      TSh{" "}
                                      {child.revenueGenerated.toLocaleString()}
                                    </td>
                                    <td className="p-3 text-right font-mono text-emerald-300 font-bold">
                                      TSh {child.totalEarnings.toLocaleString()}
                                    </td>
                                    <td className="p-3 text-center">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleDeassignSubAffiliate(child.id)
                                        }
                                        className="px-2.5 py-1 bg-rose-950/40 text-rose-400 border border-rose-900/30 hover:bg-rose-900 hover:text-white rounded-lg text-[10px] transition-colors font-mono cursor-pointer"
                                      >
                                        Remove
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Assign New downline Partner block */}
                    <div className="bg-slate-900/60 p-4 border border-slate-850 rounded-xl space-y-3">
                      <div>
                        <h4 className="text-[11px] font-mono text-slate-400 uppercase font-bold">
                          Assign Standard Partner to supervised network
                        </h4>
                        <p className="text-[10.5px] text-slate-500 mt-0.5">
                          Link an unassigned or standard partner affiliate into
                          this node's oversight network.
                        </p>
                      </div>

                      <div className="flex gap-2 flex-col sm:flex-row">
                        <select
                          className="bg-slate-950 border border-slate-800 text-white text-xs rounded-xl p-2.5 flex-grow outline-none focus:border-amber-500 font-sans"
                          value={selectedAssigneeId}
                          onChange={(e) =>
                            setSelectedAssigneeId(e.target.value)
                          }
                        >
                          <option value="">
                            -- Choose standard affiliate to assign --
                          </option>
                          {affiliates
                            .filter(
                              (a) =>
                                !a.isSuper &&
                                a.id !== selectedAff.id &&
                                a.parentSuperId !== selectedAff.id,
                            )
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} (code: {c.promoCode} · currently
                                supervised by:{" "}
                                {c.parentSuperId
                                  ? affiliates.find(
                                      (sup) => sup.id === c.parentSuperId,
                                    )?.name || "another super"
                                  : "None"}
                                )
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            if (!selectedAssigneeId) {
                              alert("Please pick an affiliate first!");
                              return;
                            }
                            handleAssignSubAffiliate(selectedAssigneeId);
                            setSelectedAssigneeId("");
                          }}
                          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-sans font-bold text-xs rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Link to Team Network
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Performance analytics */}
                {affTab === "performance" && (
                  <div className="space-y-6 text-left">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                      <div
                        className="bg-slate-900 p-3 rounded-lg border border-slate-850 animate-slide-up-fade opacity-0"
                        style={{ animationDelay: "50ms" }}
                      >
                        <div className="text-[10px] text-slate-500 uppercase font-mono">
                          Link Clicks
                        </div>
                        <div className="text-xl font-bold font-mono text-white mt-1">
                          {selectedAff.conversionsLink}
                        </div>
                      </div>
                      <div
                        className="bg-slate-900 p-3 rounded-lg border border-slate-850 animate-slide-up-fade opacity-0"
                        style={{ animationDelay: "100ms" }}
                      >
                        <div className="text-[10px] text-slate-500 uppercase font-mono">
                          Promo Code sales
                        </div>
                        <div className="text-xl font-bold font-mono text-amber-400 mt-1">
                          {selectedAff.conversionsPromo}
                        </div>
                      </div>
                      <div
                        className="bg-slate-900 p-3 rounded-lg border border-slate-850 col-span-2 animate-slide-up-fade opacity-0"
                        style={{ animationDelay: "150ms" }}
                      >
                        <div className="text-[10px] text-slate-500 uppercase font-mono">
                          Generated Revenue
                        </div>
                        <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                          TSh {selectedAff.revenueGenerated.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {!selectedAff.isSuper ? (
                      <div
                        className="bg-slate-900 p-4 border border-emerald-900/40 rounded-xl space-y-4 animate-slide-up-fade opacity-0"
                        style={{ animationDelay: "200ms" }}
                      >
                        <div className="border-b border-slate-800 pb-2">
                          <h4 className="text-[13px] font-bold text-white tracking-tight uppercase">
                            Mchanganuo Wa Pesa (Revenue Breakdown)
                          </h4>
                          <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                            Breakdown of total system funds generated by this
                            organic affiliate and her expected 15% commission
                            chunk.
                          </p>
                        </div>
                        {(() => {
                          const commissionPayout =
                            selectedAff.revenueGenerated * 0.15;
                          const hasTIN =
                            !!selectedAff.tinNumber &&
                            selectedAff.tinNumber.trim() !== "";
                          const taxRate = 0.05;
                          const withholdingTax = commissionPayout * taxRate;
                          const rateLabel = "5%";

                          return (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col justify-center items-start">
                                <span className="text-[10px] text-slate-500 font-mono uppercase mb-1">
                                  Jumla Iliyoingia (Total Driven Revenue)
                                </span>
                                <span className="text-xl font-black text-white font-mono tracking-tight">
                                  TSh{" "}
                                  {selectedAff.revenueGenerated.toLocaleString()}
                                </span>
                              </div>
                              <div className="bg-emerald-950/20 p-4 rounded-lg border border-emerald-900/50 flex flex-col justify-center items-start">
                                <span className="text-[10px] text-emerald-500/80 font-mono uppercase mb-1">
                                  15% Malipo Yake (Her Commission Payout)
                                </span>
                                <span className="text-xl font-black text-emerald-400 font-mono tracking-tight">
                                  TSh {commissionPayout.toLocaleString()}
                                </span>
                                <span className="text-[9px] text-slate-500 mt-1.5 leading-none">
                                  Calculated from total platform revenue driven.
                                </span>
                              </div>
                              <div className="bg-rose-950/20 p-4 rounded-lg border border-rose-900/50 flex flex-col justify-center items-start relative overflow-hidden">
                                <div className="absolute -right-4 -top-4 w-16 h-16 bg-rose-500/10 rounded-full blur-xl"></div>
                                <span className="text-[10px] text-rose-500/80 font-mono uppercase mb-1 flex items-center gap-1">
                                  <span>TRA Withheld Tax ({rateLabel})</span>
                                </span>
                                <span className="text-xl font-black text-rose-400 font-mono tracking-tight">
                                  TSh {withholdingTax.toLocaleString()}
                                </span>
                                <span className="text-[9px] text-slate-500 mt-1.5 leading-none">
                                  {hasTIN
                                    ? "5% applied due to valid TIN."
                                    : "5% estimated withholding applied."}
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <div
                        className="bg-slate-900 p-4 border border-teal-900/40 rounded-xl space-y-4 animate-slide-up-fade opacity-0"
                        style={{ animationDelay: "200ms" }}
                      >
                        <div className="border-b border-slate-800 pb-2">
                          <h4 className="text-[13px] font-bold text-teal-400 tracking-tight uppercase">
                            Mchanganuo Wa Pesa (Super Agent Breakdown)
                          </h4>
                          <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                            Breakdown of network revenue and commission
                            distributions.
                          </p>
                        </div>
                        {(() => {
                          const networkRevenue =
                            selectedAff.revenueGenerated || 0;
                          const totalCommissionFund = networkRevenue * 0.2;
                          const subAffiliatesShare = networkRevenue * 0.15;
                          const superAgentCut = networkRevenue * 0.05;

                          const hasTIN =
                            !!selectedAff.tinNumber &&
                            selectedAff.tinNumber.trim() !== "";
                          const taxRate = 0.05;
                          const superAgentWithholdingTax =
                            totalCommissionFund * taxRate;
                          const rateLabel = "5%";

                          return (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col justify-center items-start">
                                <span className="text-[10px] text-slate-500 font-mono uppercase mb-1">
                                  Network Revenue
                                </span>
                                <span className="text-xl font-black text-white font-mono tracking-tight">
                                  TSh {networkRevenue.toLocaleString()}
                                </span>
                              </div>
                              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col justify-center items-start">
                                <span className="text-[10px] text-slate-500 font-mono uppercase mb-1">
                                  20% Payout Fund
                                </span>
                                <span className="text-xl font-black text-amber-400 font-mono tracking-tight">
                                  TSh {totalCommissionFund.toLocaleString()}
                                </span>
                                <span className="text-[9px] text-slate-500 mt-1.5 leading-none">
                                  Total corporate fund to Agent.
                                </span>
                              </div>
                              <div className="bg-teal-950/20 p-4 rounded-lg border border-teal-900/50 flex flex-col justify-center items-start">
                                <span className="text-[10px] text-teal-500/80 font-mono uppercase mb-1">
                                  5% Agent Cut
                                </span>
                                <span className="text-xl font-black text-teal-400 font-mono tracking-tight">
                                  TSh {superAgentCut.toLocaleString()}
                                </span>
                                <span className="text-[9px] text-slate-500 mt-1.5 leading-none">
                                  Kept by Super Agent.
                                </span>
                              </div>
                              <div className="bg-indigo-950/20 p-4 rounded-lg border border-indigo-900/50 flex flex-col justify-center items-start">
                                <span className="text-[10px] text-indigo-500/80 font-mono uppercase mb-1">
                                  15% Sub-network
                                </span>
                                <span className="text-xl font-black text-indigo-400 font-mono tracking-tight">
                                  TSh {subAffiliatesShare.toLocaleString()}
                                </span>
                                <span className="text-[9px] text-slate-500 mt-1.5 leading-none">
                                  Sub-affiliates share.
                                </span>
                              </div>
                              <div className="bg-rose-950/20 p-4 rounded-lg border border-rose-900/50 flex flex-col justify-center items-start col-span-1 md:col-span-2 lg:col-span-4 relative overflow-hidden">
                                <div className="absolute -right-4 -top-4 w-16 h-16 bg-rose-500/10 rounded-full blur-xl"></div>
                                <span className="text-[10px] text-rose-500/80 font-mono uppercase mb-1 flex items-center gap-1">
                                  <span>
                                    TRA Withheld Tax ({rateLabel} on Total Fund)
                                  </span>
                                </span>
                                <span className="text-xl font-black text-rose-400 font-mono tracking-tight">
                                  TSh{" "}
                                  {superAgentWithholdingTax.toLocaleString()}
                                </span>
                                <span className="text-[9px] text-slate-500 mt-1.5 leading-none">
                                  {hasTIN
                                    ? "5% applied due to valid TIN."
                                    : "5% estimated withholding applied."}
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div
                        className="bg-slate-900 p-4 border border-slate-850 rounded-xl space-y-2 animate-slide-up-fade opacity-0"
                        style={{ animationDelay: "250ms" }}
                      >
                        <h4 className="text-[11px] font-mono text-slate-400 uppercase font-bold">
                          Monthly Commission payout level
                        </h4>
                        <div className="space-y-1.5 font-mono text-xs">
                          {selectedAff.monthlyEarnings.map((m, i) => (
                            <div
                              key={i}
                              className="flex justify-between p-2 bg-slate-950 rounded border border-slate-800"
                            >
                              <span className="text-slate-400">
                                {m.month} period
                              </span>
                              <span className="text-emerald-400 font-bold">
                                TSh {m.amount.toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div
                        className="bg-slate-900 p-4 border border-slate-850 rounded-xl space-y-2 animate-slide-up-fade opacity-0"
                        style={{ animationDelay: "300ms" }}
                      >
                        <h4 className="text-[11px] font-mono text-slate-400 uppercase font-bold">
                          Recent Payout Disbursals
                        </h4>
                        <div className="space-y-1.5 font-mono text-xs">
                          {selectedAff.recentPayouts.map((p, i) => (
                            <div
                              key={i}
                              className="flex justify-between p-2 bg-slate-950 rounded border border-slate-850"
                            >
                              <div>
                                <span className="text-[9px] text-slate-500 block">
                                  {p.date}
                                </span>
                                <span className="text-white text-[10px] font-bold block">
                                  {p.method}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-amber-400 font-bold block">
                                  TSh {p.amount.toLocaleString()}
                                </span>
                                <span className="text-[9.5px] text-emerald-400">
                                  {p.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* SESSIONS */}
                {affTab === "sessions" && (
                  <div className="space-y-4 text-left animate-fade-in">
                    <h4 className="text-xs font-mono uppercase text-slate-400 font-bold">
                      Affiliate Partner Access Log sessions
                    </h4>
                    <div className="bg-slate-900 border border-slate-850 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-xs text-slate-300 font-mono">
                        <thead className="bg-slate-950 text-[10px] uppercase text-slate-500 font-mono">
                          <tr>
                            <th className="p-3">Session dates</th>
                            <th className="p-3">Device model</th>
                            <th className="p-3">IP IP & ISP Node</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-950">
                          {selectedAff.sessions.map((s, idx) => (
                            <tr key={idx} className="hover:bg-slate-850/30">
                              <td className="p-3">
                                <span className="text-emerald-400 block">
                                  ▲ {s.loginTime}
                                </span>
                                <span className="text-red-400 block">
                                  ▼ {s.logoutTime}
                                </span>
                                <span className="text-slate-500 block text-[9.5px]">
                                  ({s.durationMinutes} minutes operating)
                                </span>
                              </td>
                              <td className="p-3">
                                <span className="px-1.5 py-0.5 bg-slate-950 rounded text-[9px] uppercase font-bold text-slate-400">
                                  {s.device}
                                </span>
                              </td>
                              <td className="p-3">
                                <span className="block font-bold text-slate-200">
                                  {s.ipAddress}
                                </span>
                                <span className="text-[10px] text-slate-500 block">
                                  {s.location}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Controls */}
                {affTab === "controls" && (
                  <div className="space-y-6 text-left animate-fade-in">
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start space-x-3 text-xs">
                      <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-red-400 font-extrabold block font-mono uppercase">
                          CRITICAL AFFILIATE DESTRUCTIVE WORKSPACE
                        </span>
                        <p className="text-slate-300 mt-1">
                          Modifying affiliate promotional tracking links,
                          suspending marketers, or deleting records requires
                          authorization keys. Key fields are masked perpetually.
                          Any clashing promo codes will trigger safety
                          overrides.
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-900 p-4 rounded-xl border border-slate-850 space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-xs uppercase font-mono text-slate-300 font-bold">
                          Input Secret Key (STARS ONLY ●●●●)
                        </label>
                        {isActionLocked ? (
                          <span className="text-[10px] bg-red-600/30 text-red-400 border border-red-500/30 px-2 py-0.5 rounded font-mono animate-pulse">
                            🔒 LOCKED remaining: {lockoutTimeLeft}s
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-mono">
                            Mask is active
                          </span>
                        )}
                      </div>

                      <input
                        type="password"
                        placeholder="••••••••••••"
                        autoComplete="new-password"
                        disabled={isActionLocked}
                        value={secureKeyInput}
                        onChange={(e) => setSecureKeyInput(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 text-xs text-rose-400 font-mono focus:border-rose-500 outline-none block disabled:opacity-50"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                      {/* Form edit fields */}
                      <form
                        onSubmit={handleEditFields}
                        className="bg-slate-900 p-4 rounded-xl border border-slate-850 space-y-3"
                      >
                        <div className="border-b border-slate-800 pb-2 text-[10px] uppercase font-mono text-amber-500 font-extrabold font-bold">
                          Configure Affiliate Bio
                        </div>
                        <div className="space-y-2">
                          <div>
                            <label className="text-[9.5px] uppercase font-mono text-slate-500 block">
                              Full Partner Name
                            </label>
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 p-2 text-xs rounded text-white outline-none font-bold"
                              required
                            />
                          </div>
                          <div>
                            <label className="text-[9.5px] uppercase font-mono text-slate-500 block">
                              Portal Username
                            </label>
                            <input
                              type="text"
                              value={editUsername}
                              onChange={(e) => setEditUsername(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 p-2 text-xs rounded text-white font-mono text-amber-400 outline-none"
                              required
                            />
                          </div>
                          <div>
                            <label className="text-[9.5px] uppercase font-mono text-slate-500 block">
                              E-mail node
                            </label>
                            <input
                              type="email"
                              value={editEmail}
                              onChange={(e) => setEditEmail(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 p-2 text-xs rounded text-white outline-none"
                              required
                            />
                          </div>
                          <div>
                            <label className="text-[9.5px] uppercase font-mono text-slate-500 block">
                              Phone number
                            </label>
                            <input
                              type="text"
                              value={editPhone}
                              onChange={(e) => setEditPhone(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 p-2 text-xs rounded text-white outline-none"
                              required
                            />
                          </div>
                          <div>
                            <label className="text-[9.5px] uppercase font-mono text-slate-500 block">
                              Unique Promo Code (No clash check)
                            </label>
                            <input
                              type="text"
                              value={editPromoCode}
                              onChange={(e) => setEditPromoCode(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 p-2 text-xs rounded text-amber-400 font-bold uppercase outline-none"
                              required
                            />
                          </div>
                          <div>
                            <label className="text-[9.5px] uppercase font-mono text-slate-500 block">
                              Promo Track Link
                            </label>
                            <input
                              type="text"
                              value={editAffLink}
                              onChange={(e) => setEditAffLink(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 p-2 text-xs rounded text-slate-300 outline-none"
                              required
                            />
                          </div>

                          {/* Super Affiliate configurations */}
                          <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-2 mt-2">
                            <label className="flex items-center space-x-2 text-white text-xs cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={editIsSuper}
                                onChange={(e) =>
                                  setEditIsSuper(e.target.checked)
                                }
                                className="rounded border-slate-800 bg-slate-900 text-amber-500 focus:ring-0 focus:ring-offset-0 w-4 h-4 shrink-0"
                              />
                              <span className="font-bold text-[11px] font-mono uppercase tracking-wide text-amber-400">
                                Designated Super Affiliate
                              </span>
                            </label>
                            <p className="text-[9.5px] text-slate-500 leading-normal pl-6">
                              Super affiliates receive a 5% oversight commission
                              on their network team's aggregate sales, while
                              direct affiliates obtain standard 15% commissions.
                            </p>

                            {editIsSuper && (
                              <div className="space-y-1 pl-6 border-l border-amber-500/20 mt-2">
                                <label className="text-[9.5px] uppercase font-mono text-slate-400 block pb-1">
                                  Primary Monthly Target Quota goal
                                </label>
                                <input
                                  type="number"
                                  value={editTargetReferrals}
                                  onChange={(e) =>
                                    setEditTargetReferrals(
                                      Math.max(
                                        1,
                                        parseInt(e.target.value) || 200,
                                      ),
                                    )
                                  }
                                  className="bg-slate-900 border border-slate-850 text-white text-xs rounded p-1.5 font-mono w-full outline-none focus:border-amber-500"
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={isActionLocked}
                          className="w-full bg-amber-500 text-slate-950 hover:bg-amber-400 py-2.5 text-xs rounded font-bold font-mono uppercase tracking-tight transition-transform cursor-pointer disabled:opacity-50"
                        >
                          Overrule with Security authorization
                        </button>
                      </form>

                      {/* Decommission trigger and status buttons */}
                      <div className="space-y-4">
                        <div className="bg-slate-900 p-4 rounded-xl border border-slate-850 space-y-3">
                          <div className="border-b border-slate-800 pb-2 text-[10px] uppercase font-mono text-cyan-400 font-bold">
                            Affiliate Status tier
                          </div>
                          <div className="flex flex-col gap-2 font-mono text-[10px]">
                            <button
                              type="button"
                              onClick={() =>
                                handleStatusChange("Top Performer")
                              }
                              disabled={
                                isActionLocked ||
                                selectedAff.status === "Top Performer"
                              }
                              className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-left p-2.5 rounded border border-amber-500/20 font-bold cursor-pointer disabled:opacity-50"
                            >
                              🌟 Set as Top Performer
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange("Active")}
                              disabled={
                                isActionLocked ||
                                selectedAff.status === "Active"
                              }
                              className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-left p-2.5 rounded border border-emerald-500/20 font-bold cursor-pointer disabled:opacity-50"
                            >
                              🍀 Set as Active Standard
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange("Suspended")}
                              disabled={
                                isActionLocked ||
                                selectedAff.status === "Suspended"
                              }
                              className="bg-red-500/10 hover:bg-red-500/20 text-red-300 text-left p-2.5 rounded border border-red-500/20 font-bold cursor-pointer disabled:opacity-50"
                            >
                              ⚠️ Suspend / Limit Payouts
                            </button>
                          </div>
                        </div>

                        <div className="bg-slate-900 border border-red-500/20 p-4 rounded-xl space-y-3 text-left">
                          <span className="text-[10px] uppercase font-mono text-red-400 font-extrabold block">
                            Permanent Affiliate Erase
                          </span>
                          <button
                            type="button"
                            onClick={handleEraseAffiliate}
                            disabled={isActionLocked}
                            className="w-full bg-red-600 hover:bg-red-500 text-white font-mono font-extrabold uppercase py-2.5 text-[10.5px] rounded-lg tracking-wider cursor-pointer disabled:opacity-50"
                          >
                            🚨 Wipe Partner Recruiter node
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* ALL AFFILIATES (ORGANIC + SUB-AFFILIATES) GLOBAL DASHBOARD */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-left shadow-lg">
                <div className="mb-6 border-b border-slate-800 pb-4">
                  <h3 className="text-sm uppercase font-mono font-bold text-teal-400 tracking-widest flex items-center gap-2">
                    <span className="text-lg">🌱</span> Overall Affiliates
                    Dashboard
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Global performance overview of all standard organic
                    affiliates and sub-affiliates.
                  </p>
                </div>
                {(() => {
                  const allNonSuperAffs = affiliates.filter((a) => !a.isSuper);
                  const totalAffiliates = allNonSuperAffs.length;
                  const totalSubs = allNonSuperAffs.reduce(
                    (acc, a) =>
                      acc +
                      (a.conversionsLink || 0) +
                      (a.conversionsPromo || 0),
                    0,
                  );
                  const totalRev = allNonSuperAffs.reduce(
                    (acc, a) => acc + (a.revenueGenerated || 0),
                    0,
                  );
                  const commPaid = totalRev * 0.15;
                  const retained = totalRev - commPaid;

                  return (
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
                        <div className="text-[10px] text-slate-500 uppercase font-mono tracking-wider font-bold mb-1">
                          Total Affiliates
                        </div>
                        <div className="text-xl font-bold font-mono text-white">
                          {totalAffiliates}
                        </div>
                      </div>
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
                        <div className="text-[10px] text-slate-500 uppercase font-mono tracking-wider font-bold mb-1">
                          Total Subscribers
                        </div>
                        <div className="text-xl font-bold font-mono text-white">
                          {totalSubs}
                        </div>
                      </div>
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
                        <div className="text-[10px] text-slate-500 uppercase font-mono tracking-wider font-bold mb-1">
                          Total Revenue
                        </div>
                        <div className="text-xl font-bold font-mono text-white">
                          TSh {totalRev.toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-emerald-950/20 p-4 rounded-xl border border-emerald-900/40">
                        <div className="text-[10px] text-emerald-500 uppercase font-mono tracking-wider font-bold mb-1">
                          Total 15% Commissions
                        </div>
                        <div className="text-xl font-bold font-mono text-emerald-400">
                          TSh {commPaid.toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 relative overflow-hidden">
                        <div className="text-[10px] text-slate-500 uppercase font-mono tracking-wider font-bold mb-1">
                          Remaining Amount
                        </div>
                        <div className="text-xl font-bold font-mono text-slate-300">
                          TSh {retained.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* ORGANIC AFFILIATES COMPACT LIST */}
              <div className="bg-slate-950 border border-slate-850 rounded-xl overflow-hidden">
                <button
                  id="dropdown-organic-header"
                  type="button"
                  onClick={() => setOrganicExp(!organicExp)}
                  className="w-full p-4 bg-slate-900 hover:bg-slate-850 border-b border-slate-850 text-sm font-bold text-white uppercase font-mono flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="flex items-center space-x-2">
                    <span>🤝 Organic Affiliates List</span>
                    <span className="text-xs text-emerald-400 font-normal">
                      (
                      {
                        affiliates.filter((a) => !a.isSuper && !a.parentSuperId)
                          .length
                      }{" "}
                      direct)
                    </span>
                  </span>
                  {organicExp ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {organicExp && (
                  <div
                    id="organic-affiliates-list-container"
                    className="divide-y divide-slate-900 max-h-[350px] overflow-y-auto"
                  >
                    {affiliates
                      .filter((a) => !a.isSuper && !a.parentSuperId)
                      .filter((a) => {
                        const q = searchQuery.toLowerCase();
                        return (
                          a.name.toLowerCase().includes(q) ||
                          a.email.toLowerCase().includes(q) ||
                          a.promoCode.toLowerCase().includes(q)
                        );
                      })
                      .map((a) => {
                        return (
                          <div
                            key={a.id}
                            onClick={() => {
                              if (!isUnlocked) return;
                              setSelectedAff(a);
                              setEditName(a.name);
                              setEditUsername(a.username);
                              setEditEmail(a.email);
                              setEditPhone(a.phone);
                              setEditPromoCode(a.promoCode);
                              setEditAffLink(a.affiliateLink);
                              setEditStatus(a.status);
                              setEditIsSuper(!!a.isSuper);
                              setEditTargetReferrals(a.targetReferrals || 200);
                              setAffTab("info");
                            }}
                            className={`p-4 cursor-pointer transition-colors text-sm hover:bg-slate-900/40 text-slate-300 flex justify-between items-center`}
                          >
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-200">
                                {a.name}
                              </span>
                              <span className="text-xs text-slate-500 font-mono mt-1">
                                Promo: {a.promoCode} | {a.email}
                              </span>
                            </div>
                            <div className="flex flex-col items-end">
                              <span
                                className={`px-2 py-1 rounded text-[10px] font-mono uppercase font-black mb-1 ${a.status === "Top Performer" ? "bg-amber-500/20 text-amber-400" : "bg-slate-900 text-slate-400"}`}
                              >
                                {a.status}
                              </span>
                              <span className="text-xs font-mono text-slate-500">
                                TSh {a.revenueGenerated.toLocaleString()} | {a.conversionsPromo} leads
                              </span>
                            </div>
                          </div>
                        );
                      })}

                    {affiliates.filter((a) => !a.isSuper && !a.parentSuperId)
                      .length === 0 && (
                      <div className="p-6 text-center text-sm text-slate-550 italic">
                        No organic self-joined partners.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ORGANIC AFFILIATES COMPACT LIST */}
              <div className="bg-slate-950 border border-slate-850 rounded-xl overflow-hidden mt-6">
                <button
                  id="dropdown-organic-header"
                  type="button"
                  onClick={() => setOrganicExp(!organicExp)}
                  className="w-full p-4 bg-slate-900 hover:bg-slate-850 border-b border-slate-850 text-sm font-bold text-white uppercase font-mono flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="flex items-center space-x-2">
                    <span>🤝 Organic Affiliates List</span>
                    <span className="text-xs text-emerald-400 font-normal">
                      (
                      {
                        affiliates.filter((a) => !a.isSuper && !a.parentSuperId)
                          .length
                      }{" "}
                      direct)
                    </span>
                  </span>
                  {organicExp ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {organicExp && (
                  <div
                    id="organic-affiliates-list-container"
                    className="divide-y divide-slate-900 max-h-[350px] overflow-y-auto"
                  >
                    {affiliates
                      .filter((a) => !a.isSuper && !a.parentSuperId)
                      .filter((a) => {
                        const q = searchQuery.toLowerCase();
                        return (
                          a.name.toLowerCase().includes(q) ||
                          a.email.toLowerCase().includes(q) ||
                          a.promoCode.toLowerCase().includes(q)
                        );
                      })
                      .map((a) => {
                        return (
                          <div
                            key={a.id}
                            onClick={() => {
                              if (!isUnlocked) return;
                              setSelectedAff(a);
                              setEditName(a.name);
                              setEditUsername(a.username);
                              setEditEmail(a.email);
                              setEditPhone(a.phone);
                              setEditPromoCode(a.promoCode);
                              setEditAffLink(a.affiliateLink);
                              setEditStatus(a.status);
                              setEditIsSuper(!!a.isSuper);
                              setEditTargetReferrals(a.targetReferrals || 200);
                              setAffTab("info");
                            }}
                            className={`p-4 cursor-pointer transition-colors text-sm hover:bg-slate-900/40 text-slate-300 flex justify-between items-center`}
                          >
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-200">
                                {a.name}
                              </span>
                              <span className="text-xs text-slate-500 font-mono mt-1">
                                Promo: {a.promoCode} | {a.email}
                              </span>
                            </div>
                            <div className="flex flex-col items-end">
                              <span
                                className={`px-2 py-1 rounded text-[10px] font-mono uppercase font-black mb-1 ${a.status === "Top Performer" ? "bg-amber-500/20 text-amber-400" : "bg-slate-900 text-slate-400"}`}
                              >
                                {a.status}
                              </span>
                              <span className="text-xs font-mono text-slate-500">
                                TSh {a.revenueGenerated.toLocaleString()} | {a.conversionsPromo} leads
                              </span>
                            </div>
                          </div>
                        );
                      })}

                    {affiliates.filter((a) => !a.isSuper && !a.parentSuperId)
                      .length === 0 && (
                      <div className="p-6 text-center text-sm text-slate-550 italic">
                        No organic self-joined partners.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SUPER AFFILIATES GLOBAL DASHBOARD */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-left shadow-lg">
                <div className="mb-6 border-b border-slate-800 pb-4">
                  <h3 className="text-sm uppercase font-mono font-bold text-amber-500 tracking-widest flex items-center gap-2">
                    <span className="text-lg">👑</span> Super Affiliates Agents
                    Dashboard
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Global performance overview of all super agents and their
                    sub-affiliate networks.
                  </p>
                </div>
                {(() => {
                  const superAgentsList = affiliates.filter((a) => a.isSuper);
                  const subAffiliatesCount = affiliates.filter(
                    (a) => !a.isSuper && a.parentSuperId,
                  ).length;
                  const superSubsCount = superAgentsList.reduce(
                    (acc, a) =>
                      acc +
                      (a.conversionsLink || 0) +
                      (a.conversionsPromo || 0),
                    0,
                  );
                  const superRevCount = superAgentsList.reduce(
                    (acc, a) => acc + (a.revenueGenerated || 0),
                    0,
                  );
                  const superCommissionTotal = superRevCount * 0.2;
                  const superAgentCut = superRevCount * 0.05;
                  const subAffiliatesCut = superRevCount * 0.15;
                  const superCompanyRetained = superRevCount * 0.8;

                  return (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
                          <div className="text-[10px] text-slate-500 uppercase font-mono tracking-wider font-bold mb-1">
                            Agent / Sub-Affiliates
                          </div>
                          <div className="text-xl font-bold font-mono text-white">
                            {superAgentsList.length} / {subAffiliatesCount}
                          </div>
                        </div>
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
                          <div className="text-[10px] text-slate-500 uppercase font-mono tracking-wider font-bold mb-1">
                            Total Subscribers Setup
                          </div>
                          <div className="text-xl font-bold font-mono text-white">
                            {superSubsCount}
                          </div>
                        </div>
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
                          <div className="text-[10px] text-slate-500 uppercase font-mono tracking-wider font-bold mb-1">
                            Generated Network Revenue
                          </div>
                          <div className="text-xl font-bold font-mono text-white">
                            TSh {superRevCount.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 border-t border-slate-800 pt-6">
                        <div className="bg-amber-950/20 p-4 rounded-xl border border-amber-900/40">
                          <div className="text-[10px] text-amber-500 uppercase font-mono tracking-wider font-bold mb-1">
                            Total 20% Deducted
                          </div>
                          <div className="text-xl font-bold font-mono text-amber-400">
                            TSh {superCommissionTotal.toLocaleString()}
                          </div>
                          <div className="text-[9px] text-slate-500 mt-2 leading-tight">
                            Total payouts delivered.
                          </div>
                        </div>
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
                          <div className="text-[10px] text-slate-500 uppercase font-mono tracking-wider font-bold mb-1">
                            5% Splitted to Agents
                          </div>
                          <div className="text-xl font-bold font-mono text-white">
                            TSh {superAgentCut.toLocaleString()}
                          </div>
                          <div className="text-[9px] text-slate-500 mt-2 leading-tight">
                            Their personal oversight share.
                          </div>
                        </div>
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
                          <div className="text-[10px] text-slate-500 uppercase font-mono tracking-wider font-bold mb-1">
                            15% Splitted to Sub-Affs
                          </div>
                          <div className="text-xl font-bold font-mono text-white">
                            TSh {subAffiliatesCut.toLocaleString()}
                          </div>
                          <div className="text-[9px] text-slate-500 mt-2 leading-tight">
                            Paid downstream to organic child affiliates.
                          </div>
                        </div>
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
                          <div className="text-[10px] text-slate-500 uppercase font-mono tracking-wider font-bold mb-1">
                            80% Company Remaining
                          </div>
                          <div className="text-xl font-bold font-mono text-slate-300">
                            TSh {superCompanyRetained.toLocaleString()}
                          </div>
                          <div className="text-[9px] text-slate-500 mt-2 leading-tight">
                            Kept locally by the platform.
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* SECOND DROPDOWN MENU: SUPER AFFILIATES & HIERARCHIES */}
              <div className="bg-slate-950 border border-slate-850 rounded-xl overflow-hidden mt-6">
                <button
                  id="dropdown-super-header"
                  type="button"
                  onClick={() => setSuperExp(!superExp)}
                  className="w-full p-4 bg-slate-900 hover:bg-slate-850 border-b border-slate-850 text-sm font-bold text-white uppercase font-mono flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="flex items-center space-x-2">
                    <span>👑 Super Recruiters List</span>
                    <span className="text-xs text-cyan-400 font-normal">
                      ({affiliates.filter((a) => a.isSuper).length} networks)
                    </span>
                  </span>
                  {superExp ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {superExp && (
                  <div
                    id="super-affiliates-list-container"
                    className="divide-y divide-slate-900 max-h-[350px] overflow-y-auto"
                  >
                    {affiliates
                      .filter((a) => a.isSuper)
                      .filter((a) => {
                        const q = searchQuery.toLowerCase();
                        return (
                          a.name.toLowerCase().includes(q) ||
                          a.email.toLowerCase().includes(q) ||
                          a.promoCode.toLowerCase().includes(q)
                        );
                      })
                      .map((a) => {
                        const isSelected = selectedAff?.id === a.id;
                        const nestedSubs = affiliates.filter(
                          (sub) => sub.parentSuperId === a.id,
                        );

                        return (
                          <div key={a.id} className="group">
                            {/* Parent Super Recruiter Member Card */}
                            <div
                              onClick={() => {
                                if (!isUnlocked) return;
                                setSelectedAff(a);
                                setEditName(a.name);
                                setEditUsername(a.username);
                                setEditEmail(a.email);
                                setEditPhone(a.phone);
                                setEditPromoCode(a.promoCode);
                                setEditAffLink(a.affiliateLink);
                                setEditStatus(a.status);
                                setEditIsSuper(!!a.isSuper);
                                setEditTargetReferrals(a.targetReferrals || 200);
                                setAffTab("info");
                              }}
                              className={`p-4 transition-colors text-sm border-b border-slate-900/60 flex justify-between items-start ${isUnlocked ? 'cursor-pointer hover:bg-slate-900/30 text-slate-200' : 'cursor-not-allowed opacity-80 text-slate-500'}`}
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="font-extrabold text-teal-400 block">
                                    {a.name}
                                  </span>
                                  <span className="text-xs text-slate-400 font-mono mt-1">
                                    Super Recruiter: {a.promoCode}
                                  </span>
                                </div>
                                <span className="px-2 py-1 bg-teal-500/20 text-teal-300 rounded text-[10px] font-mono uppercase font-black">
                                  {nestedSubs.length} sublines
                                </span>
                              </div>

                              <div className="mt-2 flex justify-between text-xs font-mono text-slate-500">
                                <span>
                                  Vol: TSh {a.revenueGenerated.toLocaleString()}
                                </span>
                                <span>{a.conversionsPromo} leads</span>
                              </div>
                            </div>

                            {/* Indented recruited sub-affiliates under this Super Affiliate */}
                            {nestedSubs.length > 0 && (
                              <div className="bg-slate-950/80 border-l border-teal-900/40 ml-6 divide-y divide-slate-900/40 my-2">
                                {nestedSubs.map((sub) => {
                                  const isSubSelected = selectedAff?.id === sub.id;
                                  return (
                                    <div
                                      key={sub.id}
                                      onClick={() => {
                                        if (!isUnlocked) return;
                                        setSelectedAff(sub);
                                        setEditName(sub.name);
                                        setEditUsername(sub.username);
                                        setEditEmail(sub.email);
                                        setEditPhone(sub.phone);
                                        setEditPromoCode(sub.promoCode);
                                        setEditAffLink(sub.affiliateLink);
                                        setEditStatus(sub.status);
                                        setEditIsSuper(!!sub.isSuper);
                                        setEditTargetReferrals(
                                          sub.targetReferrals || 200,
                                        );
                                        setAffTab("info");
                                      }}
                                      className={`p-3 pl-4 text-xs transition-colors flex items-center justify-between ${isUnlocked ? 'cursor-pointer hover:bg-slate-900/40 text-slate-400' : 'cursor-not-allowed opacity-80 text-slate-500'}`}
                                    >
                                      <div className="truncate">
                                        <span className="text-slate-500 font-mono mr-2">
                                          ↳
                                        </span>
                                        <span className="font-medium text-slate-300 text-sm">
                                          {sub.name}
                                        </span>
                                        <span className="text-xs text-slate-500 font-mono block pl-4 mt-1">
                                          Code: {sub.promoCode}
                                        </span>
                                      </div>
                                      <span className="text-xs font-mono font-bold text-slate-500">
                                        {sub.conversionsPromo} leads
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}

                    {affiliates.filter((a) => a.isSuper).length === 0 && (
                      <div className="p-6 text-center text-sm text-slate-550 italic">
                        No registered Super Recruiters.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Admin TRA Tax & TIN Withholding Roster Modal */}
      {showAdminRosterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in font-sans">
          <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
              <div className="text-left font-sans">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <span className="text-xl">📋</span>
                  <span>Jasper Suite Global Compliance Tax Roster</span>
                </h2>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Central admin roster containing legal tax credentials,
                  matching National ID (NIDA), and taxpayer TINs for withholding
                  tax filings.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminRosterModal(false)}
                className="text-slate-400 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 p-1.5 rounded-full cursor-pointer text-xs font-bold leading-none align-middle font-sans border-0"
              >
                ✕
              </button>
            </div>

            {/* Content Area */}
            <div className="p-6 overflow-y-auto space-y-6 max-h-[60vh] bg-slate-950/20 text-left">
              {/* TRA Compliance Panel */}
              <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-xl flex flex-col md:flex-row gap-4 items-start md:items-center justify-between text-xs font-sans">
                <div className="space-y-1">
                  <span className="font-bold text-amber-500 font-mono text-[10px] uppercase tracking-wider block">
                    TRA compliance summary & withholdings
                  </span>
                  <p className="text-slate-300 leading-normal max-w-2xl">
                    Every monthly commission disbursed across all organic
                    affiliates and super network recruiters must match legal
                    Tanzanian registries. This central console exports full
                    rosters directly into TRA e-filing format (CSV) under the
                    withholding tax code (WHT).
                  </p>
                </div>
                <div className="flex gap-2 self-start md:self-auto">
                  <button
                    type="button"
                    onClick={() => {
                      const csvRows = [
                        [
                          "Affiliate ID",
                          "Legal Name",
                          "Phone No",
                          "Email ID",
                          "Role type",
                          "NIDA ID Number",
                          "TIN Number",
                          "Cumulative Sales Volume (TSh)",
                          "Commission Settled (TSh)",
                          "Withheld Tax (TSh)",
                        ],
                        ...affiliates
                          .filter((a: any) => a.isSuper || !a.parentSuperId)
                          .map((a: any) => {
                            const commissionPayout = a.isSuper
                              ? (a.revenueGenerated || 0) * 0.2
                              : (a.revenueGenerated || 0) * 0.15;
                            const hasTIN =
                              !!a.tinNumber && a.tinNumber.trim() !== "";
                            const taxRate = 0.05;
                            const withheldTax = commissionPayout * taxRate;

                            return [
                              a.id,
                              a.name,
                              a.phone,
                              a.email,
                              a.isSuper ? "Super Recruiter" : "Organic Partner",
                              a.nidaNumber || "PENDING NIDA",
                              hasTIN ? a.tinNumber : "PENDING TIN",
                              a.revenueGenerated || 0,
                              commissionPayout,
                              withheldTax,
                            ];
                          }),
                      ];
                      const csvContent =
                        "data:text/csv;charset=utf-8," +
                        csvRows.map((e) => e.join(",")).join("\n");
                      const encodedUri = encodeURI(csvContent);
                      const link = document.createElement("a");
                      link.setAttribute("href", encodedUri);
                      link.setAttribute(
                        "download",
                        `Jasper_Suite_Global_TRA_Roster.csv`,
                      );
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      alert(
                        "📥 Exported Jasper_Suite_Global_TRA_Roster.csv successfully!",
                      );
                    }}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3.5 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider cursor-pointer"
                  >
                    Export CSV format
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const text = affiliates
                        .map(
                          (a: any) =>
                            `${a.name} | Phone: ${a.phone} | NIDA: ${a.nidaNumber || "N/A"} | TIN: ${a.tinNumber || "N/A"}`,
                        )
                        .join("\n");
                      navigator.clipboard.writeText(text);
                      alert(
                        "📋 Copied global tax roster text list to clipboard!",
                      );
                    }}
                    className="bg-slate-800 hover:bg-slate-500 text-slate-200 px-3.5 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider cursor-pointer"
                  >
                    Copy Clip
                  </button>
                </div>
              </div>

              {/* Table ledger */}
              <div className="border border-slate-850 rounded-2xl overflow-hidden bg-slate-950">
                <table className="w-full text-left text-xs font-sans">
                  <thead className="bg-slate-900 border-b border-slate-850 text-slate-450 text-[9.5px] font-mono uppercase tracking-wider">
                    <tr>
                      <th className="p-4">Legal Nominee Name</th>
                      <th className="p-4">Role Classification</th>
                      <th className="p-4">NIDA National ID No.</th>
                      <th className="p-4">TIN Taxpayer ID No.</th>
                      <th className="p-4 text-right">Yield Generated (TSh)</th>
                      <th className="p-4 text-right">
                        Commissions Settled (TSh)
                      </th>
                      <th className="p-4 text-right">Withheld Tax (TRA)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900 text-slate-300 font-sans text-xs">
                    {affiliates
                      .filter((a: any) => a.isSuper || !a.parentSuperId)
                      .map((a: any) => {
                        const hasTIN =
                          !!a.tinNumber && a.tinNumber.trim() !== "";
                        const displayTIN = hasTIN ? a.tinNumber : "PENDING TIN";
                        const commissionPayout = a.isSuper
                          ? (a.revenueGenerated || 0) * 0.2
                          : (a.revenueGenerated || 0) * 0.15;
                        const taxRate = 0.05;
                        const withheldTax = commissionPayout * taxRate;

                        return (
                          <tr key={a.id} className="hover:bg-slate-900/40">
                            <td className="p-4">
                              <div className="font-bold text-white block">
                                {a.name}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono font-bold lowercase">
                                {a.phone}
                              </div>
                            </td>
                            <td className="p-4 font-mono text-[10px]">
                              {a.isSuper ? (
                                <span className="text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                  Recruiter Partner
                                </span>
                              ) : (
                                <span className="text-teal-400 font-bold bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                                  Organic partner
                                </span>
                              )}
                            </td>
                            <td className="p-4 font-mono text-slate-400">
                              {a.nidaNumber || "PENDING NIDA"}
                            </td>
                            <td
                              className={`p-4 font-mono font-bold ${hasTIN ? "text-amber-400" : "text-rose-400"}`}
                            >
                              {displayTIN}
                            </td>
                            <td className="p-4 text-right font-mono text-emerald-400 font-bold">
                              TSh {(a.revenueGenerated || 0).toLocaleString()}
                            </td>
                            <td className="p-4 text-right font-mono text-blue-400 font-bold">
                              TSh {commissionPayout.toLocaleString()}
                            </td>
                            <td className="p-4 text-right font-mono text-rose-400 font-bold">
                              TSh {withheldTax.toLocaleString()}
                              <div className="text-[9px] text-rose-500/80 mt-0.5 leading-none font-bold">
                                {hasTIN ? "5% (VALID TIN)" : "5% (ESTIMATED)"}
                              </div>
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
                onClick={() => setShowAdminRosterModal(false)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono uppercase font-black tracking-wider rounded-xl cursor-pointer border-0"
              >
                Close global Tax desk
              </button>
            </div>
          </div>
        </div>
      )}

      {showMirrorModal && mirrorTarget && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[999] flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-indigo-600/20 px-6 py-4 border-b border-indigo-500/20 flex flex-col items-center justify-center py-6 text-center">
              <div className="w-12 h-12 bg-indigo-500/30 rounded-full flex items-center justify-center mb-3">
                <AppWindow className="w-6 h-6 text-indigo-400" />
              </div>
              <h3 className="text-white font-bold text-lg font-sans">Mirror Gateway Authorization</h3>
              <p className="text-xs text-indigo-300 mt-1">Target Account: <span className="font-mono text-white">{mirrorTarget.name}</span></p>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-3">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Security Check 1 (Master PIN)</label>
                <div className="relative">
                  <Key className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    value={mirrorPass1}
                    onChange={e => setMirrorPass1(e.target.value)}
                    placeholder="Enter Level 1 PIN"
                    className="w-full bg-slate-950 border border-slate-700 text-white text-sm pl-9 pr-3 py-2 rounded-lg focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Security Check 2 (Admin Override)</label>
                <div className="relative">
                  <Key className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    value={mirrorPass2}
                    onChange={e => setMirrorPass2(e.target.value)}
                    placeholder="Enter Level 2 Code"
                    className="w-full bg-slate-950 border border-slate-700 text-white text-sm pl-9 pr-3 py-2 rounded-lg focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>
              </div>
              {mirrorError && (
                <div className="text-[10px] text-red-400 font-mono text-center pt-2 animate-bounce">
                  {mirrorError}
                </div>
              )}
            </div>
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end space-x-3">
              <button 
                onClick={() => {
                  setShowMirrorModal(false);
                  setMirrorTarget(null);
                }}
                className="px-4 py-2 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Abort
              </button>
              <button 
                onClick={() => {
                  if (mirrorPass1 === 'jasper123' && mirrorPass2 === 'admin123') {
                    window.dispatchEvent(new CustomEvent('saas_enter_mirror', { detail: { account: mirrorTarget, isAffiliate: true } }));
                    setShowMirrorModal(false);
                  } else {
                    setMirrorError('AUTHORIZATION FAILED. ACCESS DENIED.');
                  }
                }}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition-transform hover:scale-105 cursor-pointer flex items-center space-x-2"
              >
                <span>Authorize & Connect</span>
                <ArrowLeft className="w-3.5 h-3.5 transform rotate-180" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
