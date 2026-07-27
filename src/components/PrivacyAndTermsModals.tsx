import { X, Globe, Shield, Scale, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../LanguageContext';

interface PrivacyAndTermsModalsProps {
  isOpen: boolean;
  type: 'privacy' | 'terms';
  onClose: () => void;
  isDark?: boolean;
}

function FrenchLegalContent({ type, isDark }: { type: 'privacy' | 'terms'; isDark: boolean }) {
  const sectionClass = `border p-4 rounded-2xl ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`;
  if (type === 'privacy') {
    return (
      <div className="space-y-4 pr-1">
        <div className={sectionClass}><h4 className="font-bold text-emerald-500 mb-2">1. Vos informations</h4><p className="text-xs">Jasper garde les informations nécessaires pour gérer votre compte, vos ventes, vos produits et vos paiements.</p></div>
        <div className={sectionClass}><h4 className="font-bold text-emerald-500 mb-2">2. Sécurité</h4><p className="text-xs">Nous protégeons les informations envoyées entre votre appareil et nos serveurs.</p></div>
        <div className={sectionClass}><h4 className="font-bold text-emerald-500 mb-2">3. Partage</h4><p className="text-xs">Nous ne vendons pas les informations de votre entreprise. Nous les partageons seulement si la loi l'exige.</p></div>
        <div className={sectionClass}><h4 className="font-bold text-emerald-500 mb-2">4. Vos droits</h4><p className="text-xs">Vous pouvez demander une copie, une correction ou la suppression de vos informations.</p></div>
        <div className={sectionClass}><h4 className="font-bold text-emerald-500 mb-2">5. Aide</h4><p className="text-xs">Contactez l'équipe Jasper si vous avez une question sur vos informations.</p></div>
      </div>
    );
  }
  return (
    <div className="space-y-4 pr-1">
      <div className={sectionClass}><h4 className="font-bold text-emerald-500 mb-2">1. Utilisation du système</h4><p className="text-xs">Utilisez Jasper pour un travail légal. Gardez votre mot de passe secret.</p></div>
      <div className={sectionClass}><h4 className="font-bold text-emerald-500 mb-2">2. Votre compte</h4><p className="text-xs">Donnez des informations correctes. Vous êtes responsable des actions faites avec votre compte.</p></div>
      <div className={sectionClass}><h4 className="font-bold text-emerald-500 mb-2">3. Paiement</h4><p className="text-xs">Les fonctions disponibles dépendent du forfait choisi et du paiement effectué.</p></div>
      <div className={sectionClass}><h4 className="font-bold text-emerald-500 mb-2">4. Vos données</h4><p className="text-xs">Vous gardez la propriété de vos données. Faites des copies de vos rapports importants.</p></div>
      <div className={sectionClass}><h4 className="font-bold text-emerald-500 mb-2">5. Assistance</h4><p className="text-xs">Contactez Jasper si le système ne fonctionne pas correctement ou si vous avez besoin d'aide.</p></div>
    </div>
  );
}

export default function PrivacyAndTermsModals({ isOpen, type, onClose, isDark = false }: PrivacyAndTermsModalsProps) {
  const { lang } = useTranslation();
  const [modalLang, setModalLang] = useState<'en' | 'sw' | 'fr'>(lang);

  useEffect(() => {
    if (isOpen) setModalLang(lang);
  }, [isOpen, lang]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-fade-in text-left">
      <div
        className={`relative w-full max-w-4xl h-[90vh] flex flex-col rounded-3xl overflow-hidden border shadow-2xl transition-colors duration-300 ${
          isDark
            ? 'bg-slate-900 border-slate-800 text-slate-100'
            : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        {/* Modal Header */}
        <div className={`px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b ${
          isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-xl ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
              {type === 'privacy' ? <Shield className="w-5 h-5" /> : <Scale className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight">
                {type === 'privacy'
                  ? (modalLang === 'en' ? 'Jasper — Privacy Policy' : modalLang === 'fr' ? 'Jasper — Règles de Confidentialité' : 'Jasper — Sera ya Faragha')
                  : (modalLang === 'en' ? 'Jasper — Terms of Use' : modalLang === 'fr' ? "Jasper — Conditions d'Utilisation" : 'Jasper — Masharti ya Matumizi')
                }
              </h3>
              <p className={`text-[10.5px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {type === 'privacy'
                  ? (modalLang === 'en' ? 'How we keep your information safe' : modalLang === 'fr' ? 'Comment nous protégeons vos informations' : 'Jinsi tunavyolinda taarifa zako')
                  : (modalLang === 'en' ? 'Rules for using Jasper' : modalLang === 'fr' ? 'Règles pour utiliser Jasper' : 'Sheria za kutumia Jasper')
                }
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 self-end sm:self-auto">
            {/* Language Selector */}
            <div className={`flex items-center rounded-xl p-0.5 border ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                onClick={() => setModalLang('en')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  modalLang === 'en'
                    ? isDark ? 'bg-emerald-500 text-slate-950' : 'bg-[#00b87a] text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-500'
                }`}
              >
                English
              </button>
              <button
                onClick={() => setModalLang('sw')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  modalLang === 'sw'
                    ? isDark ? 'bg-emerald-500 text-slate-950' : 'bg-[#00b87a] text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-500'
                }`}
              >
                Kiswahili
              </button>
              <button
                onClick={() => setModalLang('fr')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  modalLang === 'fr'
                    ? isDark ? 'bg-emerald-500 text-slate-950' : 'bg-[#00b87a] text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-500'
                }`}
              >
                Français
              </button>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                isDark ? 'hover:bg-slate-800 text-slate-450 hover:text-white' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-900'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content Container */}
        <div className={`flex-1 p-6 overflow-y-auto space-y-6 font-sans text-sm leading-relaxed ${
          isDark ? 'bg-slate-950/20' : 'bg-slate-50/55'
        }`}>
          {type === 'privacy' ? (
            modalLang === 'en' ? (
              // PRIVACY POLICY (ENGLISH)
              <div className="space-y-6 pr-1">
                <div className={`border p-4 rounded-2xl ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <h4 className="font-bold text-emerald-500 flex items-center gap-2 mb-2">
                    <Globe className="w-4 h-4 text-emerald-500" />
                    1. Data Protection & Global Compliance Scope
                  </h4>
                  <p className="text-xs font-light">
                    Jasper ("we", "our", "us") values your business records and confidential merchant data.
                    This Privacy Policy is compiled to comply strictly with modern personal data protection laws, including the
                    <strong> Tanzania Personal Data Protection Act, 2022</strong>,
                    <strong> Kenya Data Protection Act of 2019</strong>,
                    <strong> Nigeria Data Protection Act (NDPA) of 2023</strong>, and the
                    <strong> European Union General Data Protection Regulation (GDPR)</strong>.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">2. Information We Collect</h4>
                  <p className="text-xs font-light">
	                    To deliver reliable online enterprise resource planning, hotel occupancy statistics, pharmacy stock indicators,
                    and virtual AI desk operations, we store:
                  </p>
                  <ul className="list-disc list-inside space-y-1.5 text-xs font-light ml-2">
                    <li><strong>Merchant Credentials:</strong> Standard email registrations, hashed security access controls, phone numbers, and optional white-label logo directories.</li>
                    <li><strong>Store Datasets:</strong> Inventory items, unit metrics, cost parameters, categorical classification tags, and supplier/customer phone books.</li>
                    <li><strong>POS Transaction Records:</strong> Real-time checkout receipts, physical monetary ledger totals, cost of goods (COGS), statutory rate settings, and daily expense reports.</li>
                    <li><strong>Mobile money metadata:</strong> Encrypted carrier feedback records and GSM verification keys needed to counter mobile cash payment fraud during manual checkout.</li>
                  </ul>
                </div>

                <div className="space-y-3">
	                  <h4 className="font-bold text-base tracking-tight border-b pb-1">3. Online-First Cloud Data Residency</h4>
	                  <p className="text-xs font-light">
	                    Jasper is built with a secure <strong>online-first cloud data model</strong>. You remain the controller and owner of the merchant records you enter; Jasper acts as the service provider and processor needed to host and operate the workspace. Detailed sales, stock, customer, staff, supplier, and operating records are protected with encryption in transit and at rest, tenant isolation, role-based access controls, and audit safeguards. Jasper's ordinary platform administration view is limited to service metadata such as account creation date, subscription/payment status, package type, trial/subscription expiry, and system access status. Jasper does not operate as your bookkeeper and does not manually inspect your private transaction ledger during ordinary service operation. Authorized access may occur only when required for support, security, legal compliance, or incident response, and must follow access controls and confidentiality duties.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">4. Secure Mobile Money Integration Handling</h4>
                  <p className="text-xs font-light">
                    When running manual mobile checkouts (for Tigo Pesa, M-Pesa, Airtel Money, or local banking transfers),
                    Jasper reads solely the specific transaction reference IDs you format and input. We do not extract personal consumer contact lists, credit card secrets,
                    or external device telemetry logs. This secures your customers' trust and prevents payment identity phishing within public checkout kiosks.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">5. Non-Disclosure & Anti-Exploitation Guarantee</h4>
                  <p className="text-xs font-light">
                    Jasper may display platform-controlled ads, sponsor banners, product notices, or promotional placements inside dashboard spaces.
                    We do not sell, rent, distribute, or trade your private commercial reports, sales margins, cost of goods data, or statutory calculation records to third-party brokers or data aggregators.
                    Ads must not promote illegal conduct, unsafe products, hate, sexual exploitation, gambling to restricted persons, harmful medical claims, malware, fraud, or content that violates public morals or threatens user safety.
                    Your financial metrics remain your trade secret and are not used to expose your business performance to advertisers.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">6. Decoupling, Portability & Right to Erasure</h4>
                  <p className="text-xs font-light">
                    Under East African personal data laws and GDPR frameworks, you hold control over your business intelligence:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-xs font-light ml-2">
                    <li><strong>Right to Portability:</strong> You may download, export, and transfer your transaction history logs at any time.</li>
	                    <li><strong>Right to Deletion:</strong> You can request deletion of eligible service records according to law and account status. Existing local browser cache may contain recovery copies; clearing it can remove records that exist only on that device.</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">7. Policy Bulletins & Contact Channel</h4>
                  <p className="text-xs font-light">
                    We may update our privacy policies periodically to adapt to service, security, and legal changes.
                    For privacy inquiries or custom deletion requests, contact our dedicated compliance handler at
                    <a href="mailto:deployments@jasper.africa" className="text-emerald-500 underline ml-1">deployments@jasper.africa</a>.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">8. Lawful Basis, Consent & Purpose Limitation</h4>
                  <p className="text-xs font-light">
                    We process personal data only for clear business purposes: account creation, authentication, tenant isolation, subscription billing, support, fraud prevention, legal compliance, analytics, service improvement, and secure advertising placement. Where consent is required, you may withdraw it prospectively, subject to lawful retention duties.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">9. Data Subject Rights</h4>
                  <p className="text-xs font-light">
                    Subject to applicable law, users may request access, correction, deletion, restriction, objection to certain processing, portability, and information about how their data is processed. Requests may require identity verification before action is taken.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">10. Data Sharing & Processors</h4>
                  <p className="text-xs font-light">
                    We may share only necessary service-level data with hosting providers, payment processors, authentication providers, SMS/WhatsApp support channels, legal advisers, fraud-prevention providers, and lawful authorities when legally required. Such sharing is limited to legitimate operational purposes and confidentiality obligations where applicable.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">11. Cross-Border Storage & Transfers</h4>
                  <p className="text-xs font-light">
                    Cloud infrastructure, backups, and support tools may process data outside Tanzania. We use reasonable contractual, technical, and organisational safeguards to protect personal data during cross-border transfers.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">12. Cookies, Local Storage & Tracking</h4>
                  <p className="text-xs font-light">
	                    Jasper uses cookies, local storage, IndexedDB, and similar technologies for login sessions, read caches, preserved legacy queues, preferences, analytics, and security checks. Business data changes require internet and are saved to the encrypted database. Clearing browser storage may remove local recovery copies that exist only on that device.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">13. Security & Breach Response</h4>
                  <p className="text-xs font-light">
                    We apply reasonable access controls, encryption-in-transit, account isolation, audit logs, and sync safeguards. Users remain responsible for device security, passwords, staff permissions, browser cache handling, and lawful entry of their own business data. If a material platform-side data breach occurs, we will assess, contain, remediate, and notify where legally required.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">14. Retention</h4>
                  <p className="text-xs font-light">
                    We retain personal and business data only as long as reasonably necessary for service delivery, accounting, dispute handling, legal obligations, security, and backup integrity. Some records may remain in backups for a limited period before deletion cycles complete.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">15. Children, Sensitive Data & User Responsibility</h4>
                  <p className="text-xs font-light">
                    Jasper is intended for business users aged 18 or older. Do not upload unnecessary sensitive personal data, children’s data, medical records, or third-party confidential information unless you have lawful authority and appropriate safeguards. You remain responsible for the legality of data you enter into your tenant workspace.
                  </p>
                </div>
              </div>
            ) : modalLang === 'fr' ? (
              <FrenchLegalContent type="privacy" isDark={isDark} />
            ) : (
              // PRIVACY POLICY (SWAHILI)
              <div className="space-y-6 pr-1">
                <div className={`border p-4 rounded-2xl ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <h4 className="font-bold text-emerald-500 flex items-center gap-2 mb-2">
                    <Globe className="w-4 h-4 text-emerald-500" />
                    1. Ulinzi wa Data na Uzingatiaji wa Sheria za Kimataifa
                  </h4>
                  <p className="text-xs font-light">
                    Jasper ("sisi", "yetu") inathamini sana rekodi za biashara yako na data zako za siri.
                    Sera hii ya Faragha imeandaliwa ili kufuata kikamilifu sheria za kisasa za ulinzi wa data za kibinafsi, ikiwa ni pamoja na
                    <strong> Sheria ya Ulinzi wa Taarifa Binafsi ya Tanzania, 2022</strong>,
                    <strong> Sheria ya Ulinzi wa Data ya Kenya ya Mwaka 2019</strong>,
                    <strong> Sheria ya Ulinzi wa Taarifa ya Nigeria (NDPA) ya Mwaka 2023</strong>, pamoja na
                    <strong> Mwongozo Mkuu wa Ulinzi wa Data wa Umoja wa Ulaya (GDPR)</strong>.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">2. Taarifa Tunazokusanya</h4>
                  <p className="text-xs font-light">
	                    Ili kukupa mfumo madhubuti wa usimamizi wa mauzo mtandaoni, takwimu za vyumba vya kulala, udhibiti wa famasia na bidhaa,
                    pamoja na roboti msaidizi wa AI (Lucy), tunahifadhi yafuatayo:
                  </p>
                  <ul className="list-disc list-inside space-y-1.5 text-xs font-light ml-2">
                    <li><strong>Maelezo ya Kuingia ya Mfanyabiashara:</strong> Barua pepe za usajili, nenosiri lililosimbwa kwa ulinzi, namba za simu, na nembo za hiari za mfumo.</li>
                    <li><strong>Seti ya Data za Duka:</strong> Orodha ya bidhaa, vipimo, bei, gharama, makundi ya bidhaa, na majina ya wasambazaji pamoja na wateja.</li>
                    <li><strong>Rekodi za Mauzo (POS):</strong> Stakabadhi za malipo, hesabu kamili ya pesa za keshia, gharama ya bidhaa (COGS), mipangilio ya viwango vya kisheria, na ripoti za matumizi ya duka.</li>
                    <li><strong>Data ya Malipo ya Simu:</strong> Kumbukumbu zilizosimbwa za miamala ya simu ili kusaidia mfanyabiashara kupambana na utapeli wa miamala ya uongo.</li>
                  </ul>
                </div>

                <div className="space-y-3">
	                  <h4 className="font-bold text-base tracking-tight border-b pb-1">3. Uhifadhi wa Cloud Kwanza</h4>
	                  <p className="text-xs font-light">
	                    Jasper imeundwa kwa mfumo salama wa <strong>online-first cloud data</strong>. Wewe unabaki kuwa mmiliki na mdhibiti wa rekodi za biashara unazoingiza; Jasper ni mtoa huduma na mchakataji wa data anayehitajika kuhost na kuendesha workspace. Rekodi za mauzo, stoki, wateja, wafanyakazi, wasambazaji na uendeshaji zinalindwa kwa encryption wakati wa usafirishaji na zikiwa zimehifadhiwa, tenant isolation, ruhusa kulingana na role, na audit safeguards. Upande wa kawaida wa uendeshaji wa Jasper unaona service metadata kama tarehe uliyojiunga, hali ya malipo, kifurushi, muda wa trial/subscription kuisha na hali ya access ya mfumo. Jasper si mhasibu wako na haikagui ledger yako binafsi katika matumizi ya kawaida. Access iliyoidhinishwa inaweza kutokea tu inapohitajika kwa support, usalama, kutii sheria au kushughulikia tukio, kwa kufuata access controls na wajibu wa usiri.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">4. Usalama wa Utendaji wa Malipo ya Simu</h4>
                  <p className="text-xs font-light">
                    Unapofanya miamala na kuhakiki malipo kwa simu (kama vile Tigo Pesa, M-Pesa, au Airtel Money),
                    Jasper inasoma tu kumbukumbu za miamala (Reference IDs) unazoziingiza mwenyewe. Hatuchukui orodha za mawasiliano binafsi au namba za siri za wateja wako,
                    jambo hili linalinda siri za wateja wako na kuzuia wizi wa utambulisho wa malipo.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">5. Ahadi ya Kuzuia Unyonyaji na Kutoshiriki Data</h4>
                  <p className="text-xs font-light">
                    Jasper inaweza kuonyesha matangazo yanayodhibitiwa na mfumo, mabango ya wadhamini, taarifa za bidhaa au matangazo ya kibiashara kwenye sehemu maalum za dashboard.
                    Hatuuzi, hatukodishi, hatugawi wala kubadilishana ripoti zako za siri za mauzo, faida, gharama za bidhaa au rekodi za hesabu za kisheria kwa madalali wa data.
                    Matangazo hayataruhusiwa kuvunja maadili, kuhamasisha uhalifu, bidhaa hatarishi, chuki, udhalilishaji wa kingono, kamari kwa watu wasioruhusiwa, madai ya tiba yasiyo salama, malware, utapeli au jambo linalohatarisha usalama wa watumiaji.
                    Takwimu zako za kifedha zinasalia kuwa siri yako ya kibiashara.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">6. Uhuru wa Kuhamisha na Kufuta Data</h4>
                  <p className="text-xs font-light">
                    Chini ya sheria za ulinzi wa taarifa binafsi za Afrika Mashariki na sheria ya GDPR ya Ulaya, una udhibiti juu ya habari zako:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-xs font-light ml-2">
                    <li><strong>Haki ya Kuhamisha:</strong> Unaweza kupakua au kuhamisha kumbukumbu zako za mauzo wakati wowote.</li>
	                    <li><strong>Haki ya Kufutwa kabisa:</strong> Unaweza kuomba kufutwa kwa service records zinazostahili kulingana na sheria na hali ya akaunti. Browser cache inaweza kuwa na recovery copies; ukiifuta unaweza kuondoa kumbukumbu zilizokuwepo kwenye kifaa hicho pekee.</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">7. Maswali na Mawasiliano</h4>
                  <p className="text-xs font-light">
                    Sera hizi zinaweza kuboreshwa mara kwa mara ili kufuata mabadiliko ya kisheria.
                    Kama una swali lolote la kisheria au faragha, wasiliana na timu yetu kupitia barua pepe ya
                    <a href="mailto:deployments@jasper.africa" className="text-emerald-500 underline ml-1">deployments@jasper.africa</a>.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">8. Msingi wa Kisheria, Ridhaa na Kusudi la Matumizi</h4>
                  <p className="text-xs font-light">
                    Tunachakata taarifa binafsi kwa madhumuni ya wazi: kufungua akaunti, kuingia salama, kutenganisha tenant, malipo ya vifurushi, msaada kwa wateja, kuzuia udanganyifu, kutimiza sheria, uchambuzi, kuboresha huduma na kuweka matangazo salama. Pale ridhaa inapohitajika, unaweza kuiondoa kwa matumizi ya baadaye kulingana na wajibu wa kisheria.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">9. Haki za Mhusika wa Taarifa</h4>
                  <p className="text-xs font-light">
                    Kwa mujibu wa sheria, mtumiaji anaweza kuomba kuona, kurekebisha, kufuta, kuzuia uchakataji, kupinga baadhi ya matumizi, kuhamisha taarifa, au kujulishwa namna taarifa zake zinavyochakatwa. Tunaweza kuthibitisha utambulisho kabla ya kutekeleza ombi.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">10. Kushiriki Data na Watoa Huduma</h4>
                  <p className="text-xs font-light">
                    Tunaweza kushiriki taarifa za kiwango cha huduma zinazohitajika na watoa huduma wa hosting, malipo, uthibitishaji, SMS/WhatsApp support, washauri wa sheria, watoa huduma wa kuzuia udanganyifu na taasisi halali pale sheria inapohitaji. Kushiriki huko kunakuwa kwa madhumuni halali na kwa usiri unaofaa.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">11. Uhifadhi Nje ya Nchi na Uhamishaji</h4>
                  <p className="text-xs font-light">
                    Miundombinu ya encrypted database, backups na zana za msaada zinaweza kuchakata taarifa nje ya Tanzania. Tunatumia hatua za kimkataba, kiufundi na kiutawala kulinda taarifa wakati wa uhamishaji wa mipaka.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">12. Cookies, Local Storage na Ufuatiliaji</h4>
                  <p className="text-xs font-light">
	                    Jasper hutumia cookies, local storage, IndexedDB na teknolojia zinazofanana kwa session, cache ya kusoma, foleni za zamani zilizohifadhiwa, mapendeleo, analytics na ukaguzi wa usalama. Mabadiliko ya business data yanahitaji intaneti na husave kwenye encrypted database. Ukifuta browser storage unaweza kuondoa recovery copies zilizokuwepo kwenye kifaa hicho pekee.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">13. Usalama na Tukio la Uvujaji</h4>
                  <p className="text-xs font-light">
                    Tunatumia udhibiti wa ruhusa, encryption wakati wa usafirishaji, utengano wa akaunti, audit logs na ulinzi wa sync. Mtumiaji anawajibika kwa usalama wa kifaa, nywila, ruhusa za staff, matumizi ya browser cache na uhalali wa data anazoingiza. Tukio kubwa la uvujaji wa upande wa platform likitokea, tutachunguza, kudhibiti, kurekebisha na kutoa taarifa pale sheria inapohitaji.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">14. Muda wa Kuhifadhi</h4>
                  <p className="text-xs font-light">
                    Tunahifadhi taarifa binafsi na za biashara kwa muda unaohitajika kwa huduma, hesabu, migogoro, wajibu wa kisheria, usalama na backup. Baadhi ya rekodi zinaweza kubaki kwenye backup kwa muda mfupi kabla ya mzunguko wa kufuta kukamilika.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">15. Watoto, Taarifa Nyeti na Wajibu wa Mtumiaji</h4>
                  <p className="text-xs font-light">
                    Jasper ni kwa watumiaji wa biashara wenye miaka 18 au zaidi. Usiweke taarifa nyeti zisizo za lazima, taarifa za watoto, rekodi za kitabibu au siri za watu wengine bila mamlaka ya kisheria na ulinzi unaofaa. Unawajibika kwa uhalali wa taarifa unazoingiza kwenye workspace yako.
                  </p>
                </div>
              </div>
            )
          ) : (
            modalLang === 'en' ? (
              // TERMS AND CONDITIONS (ENGLISH)
              <div className="space-y-6 pr-1">
                <div className={`border p-4 rounded-2xl ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <h4 className="font-bold text-emerald-500 flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-emerald-500" />
                    1. Direct Agreement & Scope of Services
                  </h4>
                  <p className="text-xs font-light">
                    Please read these Terms and Conditions ("Terms", "Agreement") carefully before activating your account on Jasper.
	                    This legally binding Agreement governs your utilization of the Jasper POS Online Cashier, Hotel PMS modules,
                    Pharmacy management utilities, White-Label tools, and Lucy AI recommendations. By initiating your free trial or logging into our application terminals,
                    you irrevocably agree to respect these terms. Update agreements operate worldwide and protect our operational interests.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">2. Registration, Merchant Security & Kiosk PINs</h4>
                  <p className="text-xs font-light">
                    To start logging stock and running digital business checkouts, you must deploy active cashier/owner profiles.
                    You are explicitly and solely responsible for maintaining the strict confidentiality of your device access PINs, cash drawer codes, and security passwords.
                    Any data compromised or local cash discrepancy arising from unprotected cashier logins remains the exclusive responsibility of the merchant registry.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">3. Licensing Limits & Intellectual Property Protection</h4>
                  <p className="text-xs font-light">
                    Jasper grants you a non-transferable, revocable, non-exclusive license to utilize our software platform to manage daily retail ledger histories.
	                    You are strictly forbidden from reverse-engineering, database-mining, cloning core data routing engines,
                    or extracting the software’s underlying neural prompt matrices for any external commercial applications. All source codes, interfaces, and intellectual property remain our exclusive property.
                  </p>
                </div>

                <div className="space-y-3 bg-red-500/5 p-4 rounded-2xl border border-red-500/10 space-y-2">
	                  <h4 className="font-bold text-base text-red-500 tracking-tight pb-1">4. CRITICAL DISCLAIMER: Online-Only Saving Covenants</h4>
	                  <p className="text-xs font-light">
	                    Because Jasper is now engineered with an <strong>online-only business saving model</strong>, business changes require internet before they are accepted.
                    <strong>The merchant absolutely acknowledges and covenants that:</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-1.5 text-xs font-light ml-2">
	                    <li>If internet is unavailable, the merchant must reconnect before recording sales, editing stock, changing products, or updating settings.</li>
	                    <li>Existing local browser cache or legacy pending records may be preserved for manual recovery only. They are not automatically replayed to the encrypted database.</li>
                    <li>Jasper's support/admin view is limited to service-level account information such as registration date, package, payment status, expiry date, and access status. Detailed tenant business records remain the responsibility of the tenant.</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">5. Regional Agent On-Site Deployments SLA</h4>
                  <p className="text-xs font-light">
                    Our local regional agents offtake direct physical installations, hardware mapping (thermal receipts, barcode configurations, cashier box triggers),
	                    and on-site team training. While we strive to verify reliable online operation at your specific terminal desk,
                    Jasper is not liable for hardware incompatibilities or regional GSM carrier outages affecting mobile money verification response rates.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">6. "Lucy AI" Informational Counsel Disclaimer</h4>
                  <p className="text-xs font-light">
                    All suggestions, business performance projections, stock forecasting alerts, and expense advice generated by
                    our integrated virtual assistant "Lucy" or AI tools are provided <strong>exclusively for informational purposes</strong>.
                    Lucy's calculations do not constitute official legal, accounting, regulatory, or professional financial advice.
                    Merchants must seek certified professional advice where formal legal, accounting, regulatory, or financial decisions are required.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">7. Billing Subscription Plans, Cancellations & Upgrades</h4>
                  <p className="text-xs font-light">
                    Jasper provides a standard 10-day free trial. Accounts registered with a valid affiliate promo code may receive 20 free trial days. After trial expiration,
                    the selected subscription plan (Ruby, Diamond, or Tanzanite) will require timely payments to avoid automated write-access restrictions.
                    All subscription payments are non-refundable. You may cancel or upgrade your store registers directly through the account billing gateway.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">8. Strictest Limitation of Liability</h4>
                  <p className="text-xs font-light">
                    To the absolute maximum extent permitted under applicable local laws of your operating jurisdiction (including Kenya, Tanzania, Nigeria, Uganda, and Rwanda),
                    Jasper, its directors, developers, and regional installer agents <strong>shall never be liable for any indirect, incidental, punitive, or consequential damages</strong>.
                    This includes, without limitation: loss of store profits, inventory accounting discrepancies, incorrect statutory rate settings, cashier embezzlement,
                    or encrypted database sync interruptions. Subject to any liability or consumer right that applicable law does not allow us to exclude or limit, our total composite liability shall not exceed the subscription fees you actively paid us in the four (4) months prior to the dispute trigger.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">9. Advertising Placements & Ethical Content</h4>
                  <p className="text-xs font-light">
                    Jasper may display dashboard banners, sticky ads, sponsor messages, educational promotions, Jasper product notices, and third-party ad placements approved by the platform. Ads must not violate public morals, encourage crime, endanger user safety, spread malware, impersonate institutions, promote illegal goods, contain hate or sexual exploitation, target restricted persons with gambling or harmful products, or make unsafe medical/financial claims. We may remove, block, or suspend any ad at our sole discretion.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">10. Merchant Content & Legal Responsibility</h4>
                  <p className="text-xs font-light">
                    You are responsible for all products, services, customer records, prices, invoices, staff actions, advertisements, uploaded content, and business decisions entered into your tenant workspace. You warrant that you have legal authority to process any customer, employee, supplier, and patient data you upload.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">11. Acceptable Use & Security Conduct</h4>
                  <p className="text-xs font-light">
                    You must not attack, probe, bypass, overload, reverse engineer, scrape, resell, clone, or misuse Jasper services. You must not introduce malware, share credentials, create fraudulent accounts, tamper with subscription controls, or use the platform for unlawful surveillance, harassment, money laundering, illegal conduct, or regulated activities without proper licences.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">12. Service Changes, Suspension & Enforcement</h4>
                  <p className="text-xs font-light">
                    We may update features, pricing, limits, integrations, AI availability, advertising spaces, and operational rules to protect the platform and comply with law. We may suspend or terminate accounts for non-payment, security risk, abuse, unlawful conduct, false registration information, or breach of these Terms.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">13. Third-Party Services & Connectivity</h4>
                  <p className="text-xs font-light">
                    Jasper may rely on internet providers, secure infrastructure providers, payment networks, AI providers, mobile-money channels, app stores, ad networks, SMS/WhatsApp channels, and device hardware. We are not responsible for outages, policy changes, fees, rejection, throttling, hardware defects, or inaccurate data supplied by third parties outside our direct control.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">14. Indemnity</h4>
                  <p className="text-xs font-light">
                    You agree to defend and indemnify Jasper, its owner, directors, staff, agents, and service providers from claims, penalties, losses, costs, or damages arising from your unlawful use, uploaded data, customer disputes, statutory calculation errors, staff misuse, breach of privacy duties, breach of these Terms, or violation of third-party rights.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1 font-semibold">15. Governing Law & Constructive Arbitration</h4>
                  <p className="text-xs font-light">
                    This Agreement, any affiliate engagements, and POS terminal codes are governed under the local commercial regulatory frameworks of the operating country.
                    Any disputes arising out of the system's performance shall undergo constructive bilateral arbitration in regional urban offices (Dar es Salaam / Nairobi)
                    before escalating to formal civil court filings.
                  </p>
                </div>
              </div>
            ) : modalLang === 'fr' ? (
              <FrenchLegalContent type="terms" isDark={isDark} />
            ) : (
              // TERMS AND CONDITIONS (SWAHILI)
              <div className="space-y-6 pr-1">
                <div className={`border p-4 rounded-2xl ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <h4 className="font-bold text-emerald-500 flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-emerald-500" />
                    1. Makubaliano ya Moja kwa Moja na Huduma za Mfumo
                  </h4>
                  <p className="text-xs font-light">
                    Tafadhali soma Masharti na Vigezo hivi ("Masharti", "Makubaliano") kwa makini kabla ya kuwezesha akaunti yako kwenye Jasper.
	                    Makubaliano haya ya kisheria yanatawala matumizi yako ya Keshia ya Jasper ya Mtandaoni (Online POS), usimamizi wa vyumba vya hoteli,
                    katalogi za famasia, huduma za kurekebisha muonekano, na ushauri wa kiakili kutoka kwa Lucy AI. Kwa kuanza jaribio lako la bure au kuingia kwenye mfumo,
                    unakubali masharti haya bila masharti yoyote. Maboresho ya masharti haya yanalinda haki zetu za uendeshaji biashara duniani kote.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">2. Usajili, Usalama wa Mfanyabiashara na Namba za Siri (PINs)</h4>
                  <p className="text-xs font-light">
                    Ili kuanza kufuatilia bidhaa na kufanya mauzo, lazima utengeneze wasifu wa mmiliki au keshia.
                    Wewe kama mfanyabiashara unawajibika kikamilifu na pekee kwa kuhakikisha namba za siri za keshia wako, nambari za stoo, na nywila za usalama zinalindwa vyema.
                    Hasara yoyote ya fedha au upotevu wa data unaotokana na uzembe wa kulinda namba hizi za siri itakuwa juu ya mfanyabiashara mwenyewe.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">3. Mipaka ya Leseni na Ulinzi wa Miliki Ubunifu</h4>
                  <p className="text-xs font-light">
                    Jasper inakupa leseni maalum ambayo haiwezi kuhamishwa kwa mtu mwingine, na inaweza kufutwa wakati wowote, kutumia programu yetu kwa lengo la kusimamia mahesabu ya mauzo yako ya kila siku pekee.
	                    Ni marufuku kabisa kujaribu kunakili msimbo wetu (reverse-engineer), kuiba siri za data routing, au kutumia utendaji wa software yetu kutengeneza mifumo mingine inayofanana kwa malengo ya kibiashara nje ya Jasper. Msimbo na miundo yote ni miliki ya Jasper pekee.
                  </p>
                </div>

                <div className="space-y-3 bg-red-500/5 p-4 rounded-2xl border border-red-500/10 space-y-2">
	                  <h4 className="font-bold text-base text-red-500 tracking-tight pb-1">4. ILANI MUHIMU SANA: Makubaliano ya Online-Only Saving</h4>
	                  <p className="text-xs font-light">
	                    Kwa sababu Jasper sasa inatumia <strong>online-only business saving</strong>, mabadiliko ya biashara yanahitaji intaneti kabla ya kukubaliwa.
                    <strong>Mfanyabiashara anakubali na kuahidi yafuatayo:</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-1.5 text-xs font-light ml-2">
	                    <li>Internet isipokuwepo, mfanyabiashara anatakiwa kuunganisha kwanza kabla ya kurekodi mauzo, kubadili stoki, bidhaa au settings.</li>
	                    <li>Cache za browser au pending records za zamani zinaweza kuhifadhiwa kwa manual recovery tu. Hazitasync automatically kwenda encrypted database.</li>
                    <li>Upande wa admin/support wa Jasper unaona tu taarifa za kiwango cha huduma kama tarehe ya kujiunga, kifurushi, hali ya malipo, tarehe ya kuisha na hali ya access. Rekodi za kina za biashara ya tenant ni wajibu wa tenant mwenyewe.</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">5. Usaidizi wa Mawakala wa Uwekaji wa Mfumo Ofisini Kwako (SLA)</h4>
                  <p className="text-xs font-light">
                    Mawakala wetu wa karibu ofisini kwako wanasimamia ufungaji wa mfumo, uunganishaji wa vifaa vya keshia (mashine za risiti, scanners, keshdroo ya fedha),
                    na mafunzo ya moja kwa moja ya timu yako. Wakati tunajitahidi kuhakikisha vifaa hivi vinafanya kazi vyema,
                    Jasper haitawajibika kwa matatizo ya kiufundi ya vifaa vya nje visivyoungwa mkono na softwea yetu, au kukatika kwa mtandao wa simu kuzuia uhakiki wa malipo ya simu.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">6. KANUSHO: Ushauri wa Kitakwimu kutoka kwa Lucy AI</h4>
                  <p className="text-xs font-light">
                    Ushauri wote, makadirio ya mienendo ya kifedha, utabiri wa stoki, na mapendekezo ya matumizi yanayotolewa na
                    msaidizi wa AI "Lucy" au mifumo ya artificial intelligence kwenye Dashboard yanatolewa <strong>kwa madhumuni ya kukusaidia kujifunza na kutambua mambo tu</strong>.
                    Ushauri huo si ushauri rasmi wa kisheria, kihasibu, kibiashara au kifedha wa kitaalamu.
                    Mteja ana jukumu la kushauriana na mtaalamu husika pale maamuzi rasmi yanapohitajika.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">7. Malipo ya Vifurushi, Kughairi na Kubadilisha Huduma</h4>
                  <p className="text-xs font-light">
                    Jasper inatoa siku 10 za majaribio bure. Akaunti iliyosajiliwa kwa promo code halali ya affiliate inaweza kupata siku 20 za majaribio bure. Baada ya kipindi cha majaribio kwisha,
                    kifurushi kilichochaguliwa (Ruby, Diamond, au Tanzanite) kitahitaji malipo kwa wakati ili kuzuia akaunti kufungwa au kusimamisha uwezo wa kuandika taarifa mpya.
                    Malipo yote yaliyofanyika hayarudishwi (non-refundable). Unaweza kurejesha au kuongeza vifurushi moja kwa moja kupitia sehemu ya kulipia.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">8. Kikomo Kikubwa cha Dhima ya Kisheria</h4>
                  <p className="text-xs font-light">
                    Kwa kiwango cha juu kabisa kinachoruhusiwa na sheria husika za nchi unakoendesha biashara yako (Kenya, Tanzania, Nigeria, nk),
                    Jasper, wakurugenzi wake, watengenezaji wake, na mawakala wake wa nyanjani <strong>hawatatakiwa kamwe kuwajibika kwa hasara yoyote ya moja kwa moja au isiyo ya moja kwa moja</strong>.
                    Hii inajumuisha, lakini si tu: upotevu wa faida ya duka au hoteli, makosa ya hesabu za bidhaa, mipangilio isiyo sahihi ya viwango vya kisheria, wizi wa ndani unaofanywa na keshia wako,
                    au kushindwa kwa encrypted database kusawazisha data zote. Bila kuondoa haki au dhima ambayo sheria husika hairuhusu izuiwe au ipunguzwe, dhima yetu kuu ya kifedha haitazidi kiasi cha usajili ulichotulipa katika kipindi cha miezi minne (4) iliyopita kabla ya kutokea kwa mgogoro husika.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">9. Matangazo na Maadili ya Maudhui</h4>
                  <p className="text-xs font-light">
                    Jasper inaweza kuonyesha mabango ya dashboard, sticky ads, ujumbe wa wadhamini, matangazo ya elimu, taarifa za bidhaa za Jasper na matangazo ya watu wa tatu yaliyoidhinishwa na mfumo. Matangazo hayaruhusiwi kuvunja maadili ya jamii, kuhamasisha uhalifu, kuhatarisha usalama, kusambaza malware, kujifanya taasisi, kuuza bidhaa haramu, kueneza chuki au udhalilishaji wa kingono, kulenga watu wasioruhusiwa kwa kamari/bidhaa hatarishi, au kutoa madai ya tiba/fedha yasiyo salama. Tunaweza kuondoa, kuzuia au kusimamisha tangazo lolote kwa uamuzi wetu.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">10. Maudhui ya Mfanyabiashara na Wajibu wa Kisheria</h4>
                  <p className="text-xs font-light">
                    Unawajibika kwa bidhaa, huduma, rekodi za wateja, bei, risiti, vitendo vya staff, matangazo, maudhui uliyopakia na maamuzi ya biashara unayoingiza kwenye tenant yako. Unathibitisha una mamlaka ya kisheria kuchakata taarifa za wateja, wafanyakazi, wasambazaji au wagonjwa unazoingiza.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">11. Matumizi Yanayokubalika na Usalama</h4>
                  <p className="text-xs font-light">
                    Huruhusiwi kushambulia, kuchunguza kwa nia mbaya, kupita ulinzi, kulemea, kunakili, kuuza upya au kutumia vibaya huduma za Jasper. Huruhusiwi kuingiza malware, kugawa credentials, kutengeneza akaunti bandia, kuchezea controls za subscription, au kutumia mfumo kwa ufuatiliaji haramu, unyanyasaji, utakatishaji fedha, vitendo haramu au shughuli zilizo na leseni bila leseni sahihi.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">12. Mabadiliko ya Huduma, Kusimamisha na Utekelezaji</h4>
                  <p className="text-xs font-light">
                    Tunaweza kubadilisha features, bei, limits, integrations, upatikanaji wa AI, maeneo ya matangazo na kanuni za uendeshaji ili kulinda mfumo na kufuata sheria. Tunaweza kusimamisha au kufuta akaunti kwa kutolipa, hatari ya usalama, matumizi mabaya, taarifa za uongo, vitendo haramu au kuvunja Masharti haya.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">13. Huduma za Watu wa Tatu na Muunganisho</h4>
                  <p className="text-xs font-light">
                    Jasper inaweza kutegemea watoa intaneti, secure infrastructure providers, mitandao ya malipo, watoa AI, mobile-money, app stores, ad networks, SMS/WhatsApp channels na vifaa vya hardware. Hatutawajibika kwa kukatika kwa huduma, mabadiliko ya sera, ada, kukataliwa, throttling, hitilafu za vifaa au data isiyo sahihi kutoka kwa wahusika walio nje ya udhibiti wetu.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">14. Kufidia Hasara na Madai</h4>
                  <p className="text-xs font-light">
                    Unakubali kumlinda na kumfidia Jasper, mmiliki wake, wakurugenzi, wafanyakazi, mawakala na watoa huduma dhidi ya madai, adhabu, hasara, gharama au uharibifu unaotokana na matumizi yako haramu, data uliyopakia, migogoro ya wateja, makosa ya hesabu za kisheria, matumizi mabaya ya staff, kuvunja wajibu wa faragha, kuvunja Masharti haya au kukiuka haki za wengine.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1 font-semibold">15. Sheria Zinazotawala na Utatuzi wa Migogoro</h4>
                  <p className="text-xs font-light">
                    Masharti na Masharti haya yanatawaliwa na kutafsiriwa kwa mujibu wa sheria za kibiashara za nchi uliyopo.
                    Migogoro yote inayohusiana na mfumo huu inapaswa kujaribiwa kutatuliwa kwanza kwa usuluhishi wa amani wa pande mbili (Tanzania / Kenya)
                    kabla ya kuwasilisha malalamiko hayo mahakamani.
                  </p>
                </div>
              </div>
            )
          )}
        </div>

        {/* Modal Footer */}
        <div className={`px-6 py-4 flex justify-between items-center border-t ${
          isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center space-x-1.5 text-xs text-slate-400">
            <Globe className="w-3.5 h-3.5 text-emerald-500" />
            <span className="font-mono text-[10px] uppercase">
              {modalLang === 'en' ? 'Legal information' : modalLang === 'fr' ? 'Informations légales' : 'Taarifa za sheria'}
            </span>
          </div>

          <button
            onClick={onClose}
            className={`font-sans font-bold text-xs uppercase tracking-wider px-6 py-2.5 rounded-xl transition-all cursor-pointer ${
              isDark
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                : 'bg-[#00b87a] hover:bg-[#009966] text-white shadow-xs'
            }`}
          >
            {modalLang === 'en' ? 'Close' : modalLang === 'fr' ? 'Fermer' : 'Funga'}
          </button>
        </div>
      </div>
    </div>
  );
}
