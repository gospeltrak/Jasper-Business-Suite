import React from "react";

export function getTermsTitle(lang: string, portalRole?: string): string {
  if (portalRole === 'partner') return "Partner Program Agreement & Terms";
  switch (lang) {
    case "sw": return "Masharti & Vigezo vya Mpango wa Washirika";
    case "fr": return "Conditions Générales du Programme d'Affiliation";
    case "ar": return "الشروط والأحكام لبرنامج التسويق بالعمولة";
    default:   return "Affiliate Program Terms & Conditions";
  }
}

export function getTermsSubtitle(lang: string): string {
  switch (lang) {
    case "sw": return "Tafadhali soma kwa makini na ushuke chini kabisa ili kukubali masharti";
    case "fr": return "Veuillez lire attentivement et faire défiler vers le bas pour accepter";
    case "ar": return "يرجى القراءة بعناية والتمرير إلى الأسفل لفتح زر الموافقة";
    default:   return "Please read carefully and scroll to the bottom to unlock acceptance";
  }
}

export function getTermsScrollMsg(lang: string): string {
  switch (lang) {
    case "sw": return "Tafadhali shuka chini kabisa ili kufungua kitufe cha kukubali.";
    case "fr": return "Veuillez faire défiler entièrement vers le bas pour déverrouiller l'accord.";
    case "ar": return "يرجى التمرير لأسفل بالكامل لإلغاء قفل الموافقة.";
    default:   return "Please scroll entirely down to unlock the agreement accept lock.";
  }
}

export function getTermsStatusMsg(lang: string, hasScrolled: boolean): string {
  if (hasScrolled) {
    switch (lang) {
      case "sw": return "Tayari: Orodha ya kusoma imekamilika";
      case "fr": return "Prêt : Lecture complète confirmée";
      case "ar": return "جاهز: تم قراءة الشروط بالكامل";
      default:   return "Ready: Scroll checklist cleared";
    }
  } else {
    switch (lang) {
      case "sw": return "Imefungwa: Shuka chini kusoma masharti yote";
      case "fr": return "Verrouillé : Faites défiler pour tout lire";
      case "ar": return "مغلق: قم بالتمرير لأسفل لقراءة الشروط";
      default:   return "Locked: Scroll down to read full terms";
    }
  }
}

export function getTermsAcceptBtnText(lang: string, hasScrolled: boolean): string {
  if (hasScrolled) {
    switch (lang) {
      case "sw": return "Ninakubali Masharti & Kukamilisha ✓";
      case "fr": return "J'accepte les conditions & Terminer ✓";
      case "ar": return "أوافق على الشروط وأكمل التسجيل ✓";
      default:   return "I Accept Terms & Complete ✓";
    }
  } else {
    switch (lang) {
      case "sw": return "⬇️ Shuka Chini Kufungua Kitufe";
      case "fr": return "⬇️ Défilez vers le bas pour déverrouiller";
      case "ar": return "⬇️ قم بالتمرير لأسفل لفتح الزر";
      default:   return "⬇️ Scroll Down to Unlock Accept Button";
    }
  }
}

// ─── PARTNER TERMS (English — favours Jasper/owner) ───────────────────────

function renderPartnerTerms() {
  return (
    <div className="space-y-5 text-[11px] text-slate-300 leading-relaxed">
      <p className="font-black text-amber-400 text-sm border-b border-slate-700 pb-2 uppercase tracking-wider">
        Jasper — Partner (Super Affiliate Agent) Agreement
      </p>
      <p className="text-[10px] font-mono text-slate-500 italic">
        Effective Date: June 28, 2026 · Governing Law: United Republic of Tanzania
      </p>

      <p className="text-[11px] text-slate-400 leading-relaxed">
        This Agreement is entered into between <strong className="text-white">Jasper</strong> ("the Company", "we", "us", "our") and the individual registering as a Partner ("Partner", "you"). By clicking "I Accept", you agree to be legally bound by all terms below. The Company's rights are protected in full under the laws of the United Republic of Tanzania.
      </p>

      {/* Section 1 */}
      <div className="space-y-2">
        <p className="font-black text-white text-[12px] uppercase tracking-wider">
          1. Partner Status — Independent Contractor
        </p>
        <p>
          You are engaged by the Company as an <strong className="text-amber-400">independent contractor only</strong>. Nothing in this Agreement shall create an employment, partnership, agency, joint venture, or any other legal relationship between you and Jasper. You are NOT an employee of the Company. You are not entitled to any employment benefits, salary, pension, social security, paid leave, sick pay, or any other employment rights under the <em>Employment and Labour Relations Act, Cap. 366 (Tanzania)</em>.
        </p>
        <p>
          The Company may engage multiple Partners simultaneously in the same territory. You have no exclusivity rights over any region, sector, or customer base.
        </p>
      </div>

      {/* Section 2 */}
      <div className="space-y-2">
        <p className="font-black text-white text-[12px] uppercase tracking-wider">
          2. Partner Eligibility & Identity Verification
        </p>
        <p>
          You must be at least <strong className="text-amber-400">18 years of age</strong> and possess a valid Tanzania National ID (NIDA). You must provide your full legal name exactly as it appears on your NIDA, your active WhatsApp/mobile number, and your mobile money payout number. Submission of false, forged, or borrowed identity documents is a criminal offence under the <em>Electronic and Postal Communications Act (EPOCA)</em> and the <em>Cybercrime Act, 2015 (Tanzania)</em>. The Company reserves the right to terminate your account, forfeit all pending earnings, and report you to law enforcement authorities.
        </p>
      </div>

      {/* Section 3 */}
      <div className="space-y-2">
        <p className="font-black text-white text-[12px] uppercase tracking-wider">
          3. Commission Structure & Payment Terms
        </p>
        <p>
          As a Partner, you earn:
        </p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li><strong className="text-amber-400">15% recurring commission</strong> on each monthly subscription payment made by businesses you directly referred to Jasper, as long as that business remains an active paying subscriber.</li>
          <li><strong className="text-amber-400">5% override commission</strong> on every commission earned by affiliates operating under your partner network (your downlines).</li>
        </ul>
        <p>
          Commissions are calculated on <strong className="text-white">actual settled revenue only</strong> — not on trial periods, chargebacks, refunded payments, disputed transactions, or payments made by accounts you registered yourself. The Company's calculation of commissions is <strong className="text-white">final and binding</strong>.
        </p>
        <p>
          Payments are made <strong className="text-amber-400">once per calendar month</strong>, on the last Friday of each month, via mobile money (M-Pesa, Mixx by Yas, Airtel Money, Halopesa) to the payout number you provided at registration. The Company reserves the right to delay any payment if it has reasonable grounds to suspect fraudulent activity, pending investigations, or system errors.
        </p>
        <p className="text-slate-400">
          Minimum payout threshold: <strong className="text-white">TZS 5,000</strong>. Amounts below this threshold will roll over to the next payment cycle.
        </p>
      </div>

      {/* Section 4 */}
      <div className="space-y-2">
        <p className="font-black text-white text-[12px] uppercase tracking-wider">
          4. Tax Compliance (Tanzania Revenue Authority)
        </p>
        <p>
          All commission payments are subject to applicable withholding tax under the <em>Income Tax Act, Cap. 332 (Tanzania)</em>. The Company will deduct and remit withholding tax at the applicable rate on your behalf:
        </p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li><strong className="text-amber-400">5% withholding tax</strong> if you have a valid TIN Number registered in your name.</li>
          <li><strong className="text-amber-400">15% withholding tax</strong> if you do not have a TIN Number.</li>
        </ul>
        <p>
          You are solely responsible for filing any additional personal income tax returns required by TRA. The Company bears no liability for your personal tax obligations beyond the withholding deduction made at source.
        </p>
      </div>

      {/* Section 5 */}
      <div className="space-y-2">
        <p className="font-black text-white text-[12px] uppercase tracking-wider">
          5. Partner Network Management
        </p>
        <p>
          As a Partner, you are authorised to recruit, onboard, and manage affiliates under your network. However:
        </p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>You may <strong className="text-white">not</strong> make promises or representations about Jasper's products, pricing, or commissions that differ from the official terms published by the Company.</li>
          <li>You may <strong className="text-white">not</strong> charge affiliates any fee for joining or operating under your network.</li>
          <li>You are responsible for ensuring affiliates you recruit comply with this Agreement and the Affiliate Program Terms.</li>
          <li>The Company may remove any affiliate from your network at any time without notice or liability.</li>
        </ul>
      </div>

      {/* Section 6 */}
      <div className="space-y-2">
        <p className="font-black text-white text-[12px] uppercase tracking-wider">
          6. Prohibited Conduct
        </p>
        <p>
          The following are strictly prohibited and will result in immediate termination, forfeiture of all earnings, and potential legal action:
        </p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Self-referrals — registering your own business under your own partner/affiliate code.</li>
          <li>Creating fake, duplicate, or borrowed accounts to generate fraudulent commissions.</li>
          <li>Making false, misleading, or defamatory statements about Jasper or its competitors.</li>
          <li>Sharing, selling, or transferring your partner account credentials to any third party.</li>
          <li>Using spam, unsolicited messages, or deceptive marketing practices.</li>
          <li>Impersonating Jasper staff or claiming to be an official representative of the Company without written authorisation.</li>
        </ul>
      </div>

      {/* Section 7 */}
      <div className="space-y-2">
        <p className="font-black text-white text-[12px] uppercase tracking-wider">
          7. Company Rights & Termination
        </p>
        <p>
          The Company reserves the right, at its sole discretion, to:
        </p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Modify, suspend, or terminate the Partner Program at any time with <strong className="text-white">30 days' written notice</strong> to active Partners.</li>
          <li>Amend commission rates, thresholds, and payment terms with <strong className="text-white">14 days' notice</strong> posted on the platform.</li>
          <li>Terminate your Partner account immediately and without notice if you breach any term of this Agreement, engage in fraud, or cause reputational harm to Jasper.</li>
          <li>Withhold and permanently forfeit any unpaid commissions upon termination for breach.</li>
          <li>Audit your referral activity and reverse any commissions found to be fraudulent or in breach of this Agreement.</li>
        </ul>
        <p>
          Upon termination for any reason, you must immediately cease using Jasper branding, promotional materials, and any content provided by the Company.
        </p>
      </div>

      {/* Section 8 */}
      <div className="space-y-2">
        <p className="font-black text-white text-[12px] uppercase tracking-wider">
          8. Intellectual Property
        </p>
        <p>
          All Jasper branding, logos, marketing materials, software, and content remain the exclusive intellectual property of the Company. You are granted a limited, non-exclusive, revocable licence to use Jasper's promotional materials solely for the purpose of referring customers to Jasper. You may not modify, reproduce, or commercialise any Company materials without prior written consent.
        </p>
      </div>

      {/* Section 9 */}
      <div className="space-y-2">
        <p className="font-black text-white text-[12px] uppercase tracking-wider">
          9. Limitation of Liability
        </p>
        <p>
          The Company's total liability to you under this Agreement shall not exceed the total commissions paid to you in the <strong className="text-white">3 months preceding the claim</strong>. The Company is not liable for any indirect, consequential, incidental, or special damages including loss of profits or business opportunities. The Company makes no guarantee of earnings or minimum income from the Partner Program.
        </p>
      </div>

      {/* Section 10 */}
      <div className="space-y-2">
        <p className="font-black text-white text-[12px] uppercase tracking-wider">
          10. Confidentiality
        </p>
        <p>
          You agree to keep confidential all non-public information about Jasper's business, technology, customer data, pricing, and internal operations that you become aware of through your participation in the Partner Program. This obligation survives termination of this Agreement for a period of <strong className="text-white">3 years</strong>.
        </p>
      </div>

      {/* Section 11 */}
      <div className="space-y-2">
        <p className="font-black text-white text-[12px] uppercase tracking-wider">
          11. Data Protection
        </p>
        <p>
          By registering, you consent to the Company collecting, storing, and processing your personal data (name, phone, NIDA, TIN) for the purpose of operating the Partner Program, making payments, and complying with TRA tax requirements. Your data will not be sold to third parties. The Company complies with the <em>Personal Data Protection Act, 2022 (Tanzania)</em>.
        </p>
      </div>

      {/* Section 12 */}
      <div className="space-y-2">
        <p className="font-black text-white text-[12px] uppercase tracking-wider">
          12. Governing Law & Dispute Resolution
        </p>
        <p>
          This Agreement is governed by and construed in accordance with the laws of the <strong className="text-white">United Republic of Tanzania</strong>. Any dispute arising out of or in connection with this Agreement shall first be attempted to be resolved through good-faith negotiation. If unresolved within 30 days, disputes shall be submitted to arbitration under the <em>Arbitration Act, Cap. 15 (Tanzania)</em>. The seat of arbitration shall be Dar es Salaam, Tanzania.
        </p>
      </div>

      {/* Section 13 */}
      <div className="space-y-2 border-t border-slate-700 pt-4">
        <p className="font-black text-amber-400 text-[12px] uppercase tracking-wider">
          13. Acceptance
        </p>
        <p>
          By clicking "I Accept Terms & Complete", you confirm that:
        </p>
        <ul className="list-disc list-inside space-y-1 pl-2 text-slate-300">
          <li>You have read, understood, and agree to be legally bound by this entire Agreement.</li>
          <li>You are at least 18 years old and legally capable of entering into a binding contract.</li>
          <li>The identity information you have provided is accurate and complete.</li>
          <li>You understand your tax obligations under Tanzanian law.</li>
        </ul>
        <p className="text-slate-500 text-[10px] mt-2">
          Jasper · Dar es Salaam, Tanzania · support@jasper.africa
        </p>
      </div>
    </div>
  );
}

// ─── AFFILIATE TERMS (existing) ────────────────────────────────────────────

export function renderTermsContent(lang: string, portalRole?: string) {
  // Partner gets their own dedicated legal agreement
  if (portalRole === 'partner') {
    return renderPartnerTerms();
  }

  if (lang === "sw") {
    return (
      <div className="space-y-4">
        <p className="font-bold text-amber-400 text-sm border-b border-slate-800 pb-2">
          MASHARTI & VIGEZO VYA Washirika wa Jasper
        </p>
        <p className="text-[11px] font-mono text-slate-400 italic mb-4">
          Tarehe ya Kuanza: Juni 17, 2026
        </p>
        <p className="font-bold text-slate-100 text-[13px] pt-2">Ushiriki, Utambulisho na Uhalali wa Akaunti</p>
        <p>Kwa kujiunga na mtandao wa washirika wa Jasper, unathibitisha una umri kuanzia miaka 18 na unaishi au una uwepo kisheria wa kifedha nchini Tanzania au Afrika Mashariki. Ili kuzuia ulaghai, wanachama wote lazima watoe Jina la Kwanza na Jina la Pili kama ilivyoandikwa kwenye Kitambulisho chao cha Taifa (NIDA) pamoja na Nambari halali ya Kitambulisho cha NIDA, namba ya simu ya kupokelea malipo na namba ya TIN ya mlipakodi.</p>
        <p className="font-bold text-slate-100 text-[13px] pt-2">Kamisheni na Malipo</p>
        <p>Utapokea kamisheni ya asilimia 15 (15% recurring commission) ya malipo ya kila mwezi ya usajili wa maduka, maduka ya dawa au migahawa uliyowaunganisha kwenye Jasper.</p>
        <p>Kamisheni huhesabiwa kwenye mapato yaliyolipwa na kuthibitishwa pekee. Hakuna kamisheni kwa akaunti za majaribio, akaunti bandia, chargebacks, refunds, malipo yanayopingwa au biashara uliyojisajili mwenyewe kwa code yako.</p>
        <p className="font-bold text-slate-100 text-[13px] pt-2">Utii wa Kodi na Taarifa Sahihi</p>
        <p>Malipo yote yanafanyika kulingana na miongozo na sheria za kodi za Mamlaka ya Mapato Tanzania (TRA).</p>
        <p>Unawajibika kutoa NIDA, TIN na taarifa za malipo zilizo sahihi. Jasper inaweza kuchelewesha, kukataa au kusimamisha malipo pale kuna hitilafu, taarifa za uongo, uchunguzi wa udanganyifu au matakwa ya kisheria.</p>
        <p className="font-bold text-slate-100 text-[13px] pt-2">Matumizi ya Promo Materials na Matangazo</p>
        <p>Unaweza kutumia flyers, video, captions, banners na nyenzo rasmi zinazotolewa na Jasper kwa lengo la kutangaza mfumo. Huruhusiwi kubadilisha maana ya matangazo, kutoa ahadi zisizo rasmi, kusema wewe ni mfanyakazi wa Jasper bila ruhusa, au kutangaza kwa njia inayovunja maadili, sheria, faragha au usalama wa watumiaji.</p>
        <p className="font-bold text-slate-100 text-[13px] pt-2">Mambo Yaliyokatazwa</p>
        <p>Ni marufuku kujisajili mwenyewe kwa kutumia code yako, kutumia accounts bandia, kuiba leads za affiliate mwingine, kutumia spam, kudanganya bei/kifurushi, kudai uhakika wa mapato, kuharibu jina la Jasper, au kukusanya taarifa za wateja bila ridhaa halali.</p>
        <p className="font-bold text-slate-100 text-[13px] pt-2">Faragha na Ulinzi wa Data</p>
        <p>Kwa kusajiliwa unakubali Jasper kuchakata jina, simu, NIDA, TIN, taarifa za malipo, referral code na shughuli zako za affiliate kwa ajili ya kuendesha program, kuzuia udanganyifu, kulipa kamisheni na kutimiza sheria. Jasper itazingatia Sheria ya Ulinzi wa Taarifa Binafsi, 2022 ya Tanzania, lakini wewe pia unawajibika kulinda data za wateja unaowaleta.</p>
        <p className="font-bold text-slate-100 text-[13px] pt-2">Haki za Jasper na Kikomo cha Dhima</p>
        <p>Jasper inaweza kubadilisha commissions, rules, promo materials, payout thresholds au kusimamisha program kwa taarifa inayofaa. Akaunti inaweza kusimamishwa mara moja kwa udanganyifu, kuvunja sheria au kuhatarisha jina la kampuni. Dhima ya Jasper haitazidi kamisheni halali uliyolipwa katika miezi mitatu iliyopita kabla ya madai.</p>
        <p className="font-bold text-slate-100 text-[13px] pt-2">Sheria na Migogoro</p>
        <p>Masharti haya yanatawaliwa na sheria za Tanzania. Migogoro itajaribiwa kwanza kwa mazungumzo ya nia njema, kisha njia za usuluhishi au mamlaka husika Dar es Salaam pale inapohitajika.</p>
      </div>
    );
  }

  if (lang === "fr") {
    return (
      <div className="space-y-4">
        <p className="font-bold text-amber-400 text-sm border-b border-slate-800 pb-2">CONDITIONS GÉNÉRALES DU PROGRAMME D'AFFILIATION JASPER</p>
        <p className="text-[11px] font-mono text-slate-400 italic mb-4">Date d'effet : 17 Juin 2026</p>
        <p className="font-bold text-slate-100 text-[13px] pt-2">1. ÉLIGIBILITÉ À L'INSCRIPTION</p>
        <p>En vous inscrivant au réseau de partenaires affiliés de Jasper, vous déclarez que vous êtes âgé d'au moins 18 ans et que vous résidez légalement ou possédez une présence financière légale en Tanzanie ou en Afrique de l'Est.</p>
        <p className="font-bold text-slate-100 text-[13px] pt-2">2. RÈGLEMENTS DES COMMISSIONS</p>
        <p>Vous recevrez une commission récurrente de 15% sur toutes les factures d'abonnement mensuelles payées en totalité par les commerces que vous parrainez sur Jasper.</p>
        <p className="font-bold text-slate-100 text-[13px] pt-2">3. DISPOSITIONS FISCALES ET CONFORMITÉ (TRA)</p>
        <p>Tous les paiements effectués dans le cadre du programme d'affiliation Jasper sont soumis aux lois fiscales locales de la Tanzania Revenue Authority (TRA).</p>
      </div>
    );
  }

  if (lang === "ar") {
    return (
      <div className="space-y-4 text-right" dir="rtl">
        <p className="font-bold text-amber-400 text-sm border-b border-slate-800 pb-2 text-right">الشروط والأحكام لبرنامج التسويق بالعمولة جاشبر</p>
        <p className="text-[11px] font-mono text-slate-400 italic mb-4 text-right">تاريخ البدء: 17 يونيو 2026</p>
        <p className="font-bold text-slate-100 text-[13px] pt-2 text-right">1. أهلية التسجيل والتحقق من الهوية</p>
        <p className="text-right">بالتسجيل في شبكة شركاء Jasper، فإنك تقر بأن عمرك لا يقل عن 18 عامًا وتتمتع بإقامة قانونية في تنزانيا أو شرق إفريقيا.</p>
        <p className="font-bold text-slate-100 text-[13px] pt-2 text-right">2. هيكل الأرباح والعمولات</p>
        <p className="text-right">ستتلقى عمولة متكررة بنسبة 15٪ على جميع فواتير الاشتراك الشهري المدفوعة بالكامل من التجار الذين تمت إحالتهم إلى Jasper.</p>
        <p className="font-bold text-slate-100 text-[13px] pt-2 text-right">3. الامتثال الضريبي (TRA)</p>
        <p className="text-right">تخضع جميع الالتزامات المالية لقوانين الضرائب المحلية المحددة من قبل مصلحة الضرائب التنزانية (TRA).</p>
      </div>
    );
  }

  // DEFAULT ENGLISH AFFILIATE TERMS
  return (
    <div className="space-y-4">
      <p className="font-bold text-amber-400 text-sm border-b border-slate-800 pb-2">AFFILIATE PROGRAM TERMS & CONDITIONS</p>
      <p className="text-[11px] font-mono text-slate-400 italic mb-4">Effective Date: June 17, 2026</p>
      <p className="font-bold text-slate-100 text-[13px] pt-2">Enrollment, Identity & Account Integrity</p>
      <p>By enrolling in the Jasper affiliate partner network, you declare that you are at least 18 years of age and currently reside or possess a legal financial presence in Tanzania or East Africa. To prevent identity and financial fraud, all members must supply their first name and second name exactly as they appear on their National ID card, Tanzania National ID Number (NIDA Number), and Taxpayer Identification Number (TIN Number) upon registration.</p>
      <p>Any attempt to submit false NIDA IDs or non-matching taxpayer certificates to circumvent local revenue withholding mandates will result in registration rejection, account forfeiture, and permanent blacklisting from our retail suite.</p>
      <p className="font-bold text-slate-100 text-[13px] pt-2">Revenue Commission Schedule</p>
      <p>You shall receive a 15% recurring commission on all monthly subscription invoices paid in full by shop, hotel, pharmacy, or restaurant operators whom you refer to Jasper. No commissions shall accrue on cancelled accounts, test accounts, credit balances, or transactions disputed for suspicious charge activity.</p>
      <p>Commissions are calculated in Tanzanian Shillings (TSh) and paid to your designated mobile money wallet (Vodacom M-Pesa, Mixx by Yas, Airtel Money, Halopesa) on the last Friday of every calendar month.</p>
      <p>Commission is calculated only on settled revenue actually received by Jasper. Free trials, refunds, chargebacks, disputed payments, internal demos, fraudulent tenants, self-referrals, duplicate tenants and accounts registered for artificial commission generation do not qualify.</p>
      <p className="font-bold text-slate-100 text-[13px] pt-2">Taxation & Withholding Compliance</p>
      <p>All payments are subject to local tax laws specified by the Tanzania Revenue Authority (TRA). Withholding tax of 5% (with TIN) or 15% (without TIN) shall be automatically filed and paid on your behalf under your supplied Taxpayer Identification Number.</p>
      <p>You remain responsible for personal tax filings, truthful registration information and keeping payout details current. Jasper may delay, reverse or withhold payment during fraud review, legal review, technical reconciliation or where supplied data is incomplete.</p>
      <p className="font-bold text-slate-100 text-[13px] pt-2">Marketing Materials, Ads & Brand Rules</p>
      <p>Jasper may provide flyers, videos, banners, captions, links, codes and promotional materials. You may use them only to promote Jasper honestly and lawfully. You may not alter their meaning, make unofficial promises, impersonate Jasper staff, run misleading campaigns, or publish promotions that violate public morals, privacy, consumer safety, advertising law, cyber law or platform rules.</p>
      <p className="font-bold text-slate-100 text-[13px] pt-2">Compliance & Prohibited Practices</p>
      <p>Affiliates are strictly forbidden from executing self-referrals, creating fake accounts, making misleading advertisements, or impersonating Jasper staff. In any such instance, your user account will be locked and all accrued balances forfeited with no appeal.</p>
      <p>Spam, unauthorized scraping, collecting customer data without consent, bribing staff, stealing another affiliate's lead, reselling account access, tampering with referral links, defaming Jasper, or promising guaranteed profits are prohibited.</p>
      <p className="font-bold text-slate-100 text-[13px] pt-2">Privacy & Data Protection</p>
      <p>By registering, you consent to Jasper collecting and processing your name, phone, NIDA, TIN, payout details, referral code, activity logs and commission records for operating the affiliate program, paying commissions, preventing fraud, enforcing rules and complying with law. Jasper observes the Tanzania Personal Data Protection Act, 2022. You must also protect customer and tenant data you handle.</p>
      <p className="font-bold text-slate-100 text-[13px] pt-2">Company Rights, Suspension & Limitation of Liability</p>
      <p>Jasper may amend commission rates, payout thresholds, promotional assets, program rules or eligibility requirements with reasonable notice through the platform. Jasper may immediately suspend or terminate an account for fraud, abuse, breach, reputational harm, unlawful marketing or security risk. Jasper's maximum liability to an affiliate is limited to lawful commissions paid to that affiliate in the three months before the claim.</p>
      <p className="font-bold text-slate-100 text-[13px] pt-2">Governing Law & Disputes</p>
      <p>These affiliate terms are governed by the laws of the United Republic of Tanzania. Disputes must first be handled through good-faith negotiation, then lawful mediation, arbitration or competent authorities in Dar es Salaam where required.</p>
    </div>
  );
}
