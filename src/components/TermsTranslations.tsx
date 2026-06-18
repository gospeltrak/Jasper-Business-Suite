import React from "react";

export function getTermsTitle(lang: string): string {
  switch (lang) {
    case "sw":
      return "Masharti & Vigezo vya Mpango wa Washirika";
    case "fr":
      return "Conditions Générales du Programme d'Affiliation";
    case "ar":
      return "الشروط والأحكام لبرنامج التسويق بالعمولة";
    default:
      return "Affiliate Program Terms & Conditions";
  }
}

export function getTermsSubtitle(lang: string): string {
  switch (lang) {
    case "sw":
      return "Tafadhali soma kwa makini na ushuke chini kabisa ili kukubali masharti";
    case "fr":
      return "Veuillez lire attentivement et faire défiler vers le bas pour accepter";
    case "ar":
      return "يرجى القراءة بعناية والتمرير إلى الأسفل لفتح زر الموافقة";
    default:
      return "Please read carefully and scroll to the bottom to unlock acceptance";
  }
}

export function getTermsScrollMsg(lang: string): string {
  switch (lang) {
    case "sw":
      return "Tafadhali shuka chini kabisa ili kufungua kitufe cha kukubali.";
    case "fr":
      return "Veuillez faire défiler entièrement vers le bas pour déverrouiller l'accord.";
    case "ar":
      return "يرجى التمرير لأسفل بالكامل لإلغاء قفل الموافقة.";
    default:
      return "Please scroll entirely down to unlock the agreement accept lock.";
  }
}

export function getTermsStatusMsg(lang: string, hasScrolled: boolean): string {
  if (hasScrolled) {
    switch (lang) {
      case "sw":
        return "Tayari: Orodha ya kusoma imekamilika";
      case "fr":
        return "Prêt : Lecture complète confirmée";
      case "ar":
        return "جاهز: تم قراءة الشروط بالكامل";
      default:
        return "Ready: Scroll checklist cleared";
    }
  } else {
    switch (lang) {
      case "sw":
        return "Imefungwa: Shuka chini kusoma masharti yote";
      case "fr":
        return "Verrouillé : Faites défiler pour tout lire";
      case "ar":
        return "مغلق: قم بالتمرير لأسفل لقراءة الشروط";
      default:
        return "Locked: Scroll down to read full terms";
    }
  }
}

export function getTermsAcceptBtnText(lang: string, hasScrolled: boolean): string {
  if (hasScrolled) {
    switch (lang) {
      case "sw":
        return "Ninakubali Masharti & Kukamilisha ✓";
      case "fr":
        return "J'accepte les conditions & Terminer ✓";
      case "ar":
        return "أوافق على الشروط وأكمل التسجيل ✓";
      default:
        return "I Accept Terms & Complete ✓";
    }
  } else {
    switch (lang) {
      case "sw":
        return "⬇️ Shuka Chini Kufungua Kitufe";
      case "fr":
        return "⬇️ Défilez vers le bas pour déverrouiller";
      case "ar":
        return "⬇️ قم بالتمرير لأسفل لفتح الزر";
      default:
        return "⬇️ Scroll Down to Unlock Accept Button";
    }
  }
}

export function renderTermsContent(lang: string) {
  if (lang === "sw") {
    return (
      <div className="space-y-4">
        <p className="font-bold text-amber-400 text-sm border-b border-slate-800 pb-2">
          MASHARTI & VIGEZO VYA Washirika wa Jasper
        </p>
        <p className="text-[11px] font-mono text-slate-400 italic mb-4">
          Tarehe ya Kuanza: Juni 17, 2026
        </p>

        <p className="font-bold text-slate-100 text-[13px] pt-2">
          1. USHIRIKI NA VIGEZO VYA AFYA YA AKAUNTI
        </p>
        <p>
          Kwa kujiunga na mtandao wa washirika wa Jasper Business Suite, unathibitisha una umri kuanzia miaka 18 na unaishi au una uwepo kisheria wa kifedha nchini Tanzania au Afrika Mashariki. Ili kuzuia ulaghai, wanachama wote lazima watoe Jina la Kwanza na Jina la Pili kama ilivyoandikwa kwenye Kitambulisho chao cha Taifa (NIDA) pamoja na Nambari halali ya Kitambulisho cha NIDA, namba ya simu ya kupokelea malipo na namba ya TIN ya mlipakodi (TIN Number).
        </p>
        <p>
          Majaribio yoyote ya kutoa vitambulisho vya kughushi au kutoa taarifa zisizo sahihi ili kukwepa kodi au sheria za kifedha zitasababisha akaunti yako kufungwa mara moja, kufutiwa mapato yote na kuzuiliwa kabisa kutumia huduma zetu.
        </p>

        <p className="font-bold text-slate-100 text-[13px] pt-2">
          2. MTINDO WA KOMECHELI NA MAPATO
        </p>
        <p>
          Utapokea kamisheni ya asilimia 15 (15% recurring commission) ya malipo ya kila mwezi ya usajili wa maduka, maduka ya dawa (pharmacy) au migahawa uliyowaunganisha kwenye Jasper Business Suite. Hakuna kamisheni itakayolipwa kwa wanachama waliofuta akaunti au akaunti za majaribio (free trial).
        </p>
        <p>
          Utoaji wa hesabu hufanyika katika Shilingi za Kitanzania (TSh) na malipo hutumwa moja kwa moja kwenye akaunti ya pochi yako ya kielektroniki ya simu (Vodacom M-Pesa, Mixx by Yas, Airtel Money, Halopesa) kila Ijumaa ya mwisho wa mwezi.
        </p>

        <p className="font-bold text-slate-100 text-[13px] pt-2">
          3. SHEREHE ZA UTII WA KODI (TRA COMPLIANCE)
        </p>
        <p>
          Malipo yote yanafanyika kulingana na miongozo na sheria za kodi za Mamlaka ya Mapato Tanzania (TRA). Kama mshirika, unathibitisha kuwa kodi ya zuio ya asilimia 10 (withholding tax) au kiasi kingine chochote kisheria kitashughulikiwa na kulipwa kwa niaba yako kwa kutumia Nambari yako ya TIN uliyowasilisha.
        </p>

        <p className="font-bold text-slate-100 text-[13px] pt-2">
          4. UTARATIBU WA WASHIRIKA NA MAMBO YALIYOKATAZWA
        </p>
        <p>
          Ni marufuku kujisajili mwenyewe kwa kutumia kodi yako mwenyewe ya washirika au kutumia mbinu za kitapeli kama matangazo ya uwongo au kujinasibisha na chapa ya Jasper kinyume cha sheria. Ukigundulika kufanya hivyo, akaunti na mapato yako yatafutwa mara moja.
        </p>
      </div>
    );
  }

  if (lang === "fr") {
    return (
      <div className="space-y-4">
        <p className="font-bold text-amber-400 text-sm border-b border-slate-800 pb-2">
          CONDITIONS GÉNÉRALES DU PROGRAMME D'AFFILIATION JASPER
        </p>
        <p className="text-[11px] font-mono text-slate-400 italic mb-4">
          Date d'effet : 17 Juin 2026
        </p>

        <p className="font-bold text-slate-100 text-[13px] pt-2">
          1. ÉLIGIBILITÉ À L'INSCRIPTION
        </p>
        <p>
          En vous inscrivant au réseau de partenaires affiliés de Jasper, vous déclarez que vous êtes âgé d'au moins 18 ans et que vous résidez légalement ou possédez une présence financière légale en Tanzanie ou en Afrique de l'Est. Pour éviter la fraude d'identité et financière, tous les membres doivent fournir leur premier et second nom tels qu'indiqués sur leur pièce d'identité nationale (NIDA) ainsi que leur numéro de carte d'identité nationale (NIDA) et leur numéro d'identification fiscale (TIN) lors de l'enregistrement.
        </p>

        <p className="font-bold text-slate-100 text-[13px] pt-2">
          2. RÈGLEMENTS DES COMMISSIONS
        </p>
        <p>
          Vous recevrez une commission récurrente de 15% sur toutes les factures d'abonnement mensuelles payées en totalité par les commerces, hôtels, pharmacies ou restaurants que vous parrainez sur Jasper. Les commissions sont payées en Shillings tanzaniens (TSh) sur votre portefeuille mobile (M-Pesa, Mixx by Yas, Airtel Money, Halopesa) le dernier vendredi du mois.
        </p>

        <p className="font-bold text-slate-100 text-[13px] pt-2">
          3. DISPOSITIONS FISCALES ET CONFORMITÉ (TRA)
        </p>
        <p>
          Tous les paiements effectués dans le cadre du programme d'affiliation Jasper sont soumis aux lois fiscales locales de la Tanzania Revenue Authority (TRA).
        </p>
      </div>
    );
  }

  if (lang === "ar") {
    return (
      <div className="space-y-4 text-right" dir="rtl">
        <p className="font-bold text-amber-400 text-sm border-b border-slate-800 pb-2 text-right">
          الشروط والأحكام لبرنامج التسويق بالعمولة جاشبر
        </p>
        <p className="text-[11px] font-mono text-slate-400 italic mb-4 text-right">
          تاريخ البدء: 17 يونيو 2026
        </p>

        <p className="font-bold text-slate-100 text-[13px] pt-2 text-right">
          1. أهلية التسجيل والتحقق من الهوية
        </p>
        <p className="text-right">
          بالتسجيل في شبكة شركاء Jaspers، فإنك تقر بأن عمرك لا يقل عن 18 عامًا وتتمتع بإقامة قانونية في تنزانيا أو شرق إفريقيا. لمنع الاحتيال المالي، يجب على جميع الأعضاء تقديم الاسم الأول والاسم الثاني المطابقين تمامًا لبطاقة الهوية الوطنية (NIDA) ورقم الهوية الوطنية ورقم التعريف الضريبي (TIN) عند التسجيل.
        </p>

        <p className="font-bold text-slate-100 text-[13px] pt-2 text-right">
          2. هيكل الأرباح والعمولات
        </p>
        <p className="text-right">
          ستتلقى عمولة متكررة بنسبة 15٪ على جميع فواتير الاشتراك الشهري المدفوعة بالكامل من التجار والمرافق التي تمت إحالتها إلى Jasper. يتم دفع العمولات بالشلن التنزاني (TSh) إلى محفظتك الإلكترونية في الجمعة الأخيرة من كل شهر ميلادي.
        </p>

        <p className="font-bold text-slate-100 text-[13px] pt-2 text-right">
          3. الامتثال الضريبي والجمركي (TRA)
        </p>
        <p className="text-right">
          تخضع جميع الالتزامات المالية والمدفوعات لقوانين الضرائب المحلية المحددة من قبل مصلحة الضرائب التنزانية (TRA).
        </p>
      </div>
    );
  }

  // DEFAULT ENGLISH
  return (
    <div className="space-y-4">
      <p className="font-bold text-amber-400 text-sm border-b border-slate-800 pb-2">
        AFFILIATE PROGRAM TERMS & CONDITIONS
      </p>
      <p className="text-[11px] font-mono text-slate-450 italic mb-4">
        Effective Date: June 17, 2026
      </p>

      <p className="font-bold text-slate-100 text-[13px] pt-2">
        1. ENROLLMENT ELIGIBILITY & FRAUD PROTECTION
      </p>
      <p>
        By enrolling in the Jasper suite affiliate partner network, you declare that you are at least 18 years of age and currently reside or possess a legal financial presence in Tanzania or East Africa. To prevent identity and financial fraud, all members must supply their first name and second name exactly as they appear on their National ID card, their active mobile number registered under their respective identity, Tanzania National ID Number (NIDA Number), and Taxpayer Identification Number (TIN Number) upon registration.
      </p>
      <p>
        Any attempt to submit false NIDA IDs or non-matching taxpayer certificates to circumvent local revenue withholding mandates will result in registration rejection, account forfeiture, and permanent blacklisting from our retail suite.
      </p>

      <p className="font-bold text-slate-100 text-[13px] pt-2">
        2. REVENUE COMMISSION SCHEDULE
      </p>
      <p>
        You shall receive a 15% recurring commission on all monthly subscription invoices paid in full by shop, hotel, pharmacy, or restaurant operators whom you refer to Jasper. No commissions shall accrue on cancelled accounts, test accounts, credit balances, or transactions disputed for suspicious charge activity.
      </p>
      <p>
        Commissions are calculated in East African Shillings (TSh) based on actual settled subscription revenue and paid straight to your designated mobile money wallet (Vodacom M-Pesa, Mixx by Yas, Airtel Money, Halopesa) on the last Friday of every calendar month.
      </p>

      <p className="font-bold text-slate-100 text-[13px] pt-2">
        3. TAXATION & WITHHOLDING COMPLIANCE (TRA)
      </p>
      <p>
        All payments made through the Jasper Suite Affiliate Program are subject to local tax laws specified by the Tanzania Revenue Authority (TRA). As a registered partner, you agree that withholding tax of up to 10% or the mandatory regulatory withholding rate shall be automatically filed and paid on your behalf under your supplied Taxpayer Identification Number (TIN).
      </p>

      <p className="font-bold text-slate-100 text-[13px] pt-2">
        4. COMPLIANCE & PROHIBITED PRACTICES
      </p>
      <p>
        Affiliates are strictly forbidden from executing "self-referrals" – i.e., registering their own retail outlets using their own personal affiliate coupon codes to secure discounts. Direct spamming, misleading advertisements, or cyber squatting on matching domains is completely prohibited. In any such instance, your user accounts will be locked and all accrued balances forfeited.
      </p>
    </div>
  );
}
