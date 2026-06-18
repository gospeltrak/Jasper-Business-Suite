import { X, Globe, Shield, Scale, FileText } from 'lucide-react';
import { useState } from 'react';

interface PrivacyAndTermsModalsProps {
  isOpen: boolean;
  type: 'privacy' | 'terms';
  onClose: () => void;
  isDark?: boolean;
}

export default function PrivacyAndTermsModals({ isOpen, type, onClose, isDark = false }: PrivacyAndTermsModalsProps) {
  const [modalLang, setModalLang] = useState<'en' | 'sw'>('en');

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
                  ? (modalLang === 'en' ? 'Jasper Suite — Merchant Privacy Policy' : 'Jasper Suite — Sera ya Faragha ya Mfanyabiashara')
                  : (modalLang === 'en' ? 'Jasper Suite — Terms & Conditions of Use' : 'Jasper Suite — Masharti na Vigezo vya Matumizi')
                }
              </h3>
              <p className={`text-[10.5px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {type === 'privacy' 
                  ? (modalLang === 'en' ? 'Compliant with East African & International Privacy Laws (PDPA / GDPR)' : 'Inazingatia Sheria za Kulinda Data za Afrika Mashariki na Kimataifa')
                  : (modalLang === 'en' ? 'Legal Framework & Operational Limitation of Liability' : 'Mwongozo wa Kisheria na Kikomo cha Dhima ya Kampuni')
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
                    Jasper Suite ("we", "our", "us") values your business records and confidential merchant data. 
                    This Privacy Policy is compiled to comply strictly with modern personal data protection laws, including the 
                    <strong> Tanzania Personal Data Protection Act of 2019</strong>, 
                    <strong> Kenya Data Protection Act of 2019</strong>, 
                    <strong> Nigeria Data Protection Act (NDPA) of 2023</strong>, and the 
                    <strong> European Union General Data Protection Regulation (GDPR)</strong>.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">2. Information We Collect</h4>
                  <p className="text-xs font-light">
                    To deliver reliable offline enterprise resource planning, hotel occupancy statistics, pharmacy stock indicators, 
                    and virtual AI desk operations, we store:
                  </p>
                  <ul className="list-disc list-inside space-y-1.5 text-xs font-light ml-2">
                    <li><strong>Merchant Credentials:</strong> Standard email registrations, hashed security access controls, phone numbers, and optional white-label logo directories.</li>
                    <li><strong>Store Datasets:</strong> Inventory items, unit metrics, cost parameters, categorical classification tags, and supplier/customer phone books.</li>
                    <li><strong>POS Transaction Enregistrations:</strong> Real-time checkout receipts, physical monetary ledger totals, cost of goods (COGS), multi-country tax valuations, and daily expense reports.</li>
                    <li><strong>Mobile money metadata:</strong> Encrypted carrier feedback records and GSM verification keys needed to counter mobile cash payment fraud during manual checkout.</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">3. Offline-First Caching & Data Residency</h4>
                  <p className="text-xs font-light">
                    Unlike standard internet-dependent SaaS platforms, Jasper is uniquely built with an <strong>Offline-First Framework</strong>. 
                    Your daily cash log files, sales balances, and secret cashier ledger items are stored securely inside your device’s local databases (IndexedDB, LocalStorage, and local cache) 
                    before they are safely uploaded to our encrypted cloud servers. 
                    As a merchant, you own full sovereignty over your physical registers and device memory logs. 
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
                    <strong>We do not run advertisements.</strong> Jasper Suite never sells, rents, distributes, or trades your private commercial reports, 
                    sales margins, cost of goods data, or tax computations to any third-party marketing companies, brokers, or data aggregators. 
                    Your financial metrics remain exclusively your trade secret.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">6. Decoupling, Portability & Right to Erasure</h4>
                  <p className="text-xs font-light">
                    Under East African personal data laws and GDPR frameworks, you hold absolute authority over your business intelligence:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-xs font-light ml-2">
                    <li><strong>Right to Portability:</strong> You may download, export, and transfer your transaction history logs at any time.</li>
                    <li><strong>Right to Deletion:</strong> You can purge your cloud server listings and restore/empty your local physical cache directly through settings. Once wiped, we cannot recover this data.</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">7. Policy Bulletins & Contact Channel</h4>
                  <p className="text-xs font-light">
                    We may update our privacy policies periodically to adapt to newly promulgated local tax laws. 
                    For privacy inquiries or custom deletion requests, contact our dedicated compliance handler at 
                    <a href="mailto:deployments@jasper.africa" className="text-emerald-500 underline ml-1">deployments@jasper.africa</a>.
                  </p>
                </div>
              </div>
            ) : (
              // PRIVACY POLICY (SWAHILI)
              <div className="space-y-6 pr-1">
                <div className={`border p-4 rounded-2xl ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <h4 className="font-bold text-emerald-500 flex items-center gap-2 mb-2">
                    <Globe className="w-4 h-4 text-emerald-500" />
                    1. Ulinzi wa Data na Uzingatiaji wa Sheria za Kimataifa
                  </h4>
                  <p className="text-xs font-light">
                    Jasper Suite ("sisi", "yetu") inathamini sana rekodi za biashara yako na data zako za siri.
                    Sera hii ya Faragha imeandaliwa ili kufuata kikamilifu sheria za kisasa za ulinzi wa data za kibinafsi, ikiwa ni pamoja na 
                    <strong> Sheria ya Ulinzi wa Taarifa Binafsi ya Tanzania ya Mwaka 2019</strong>, 
                    <strong> Sheria ya Ulinzi wa Data ya Kenya ya Mwaka 2019</strong>, 
                    <strong> Sheria ya Ulinzi wa Taarifa ya Nigeria (NDPA) ya Mwaka 2023</strong>, pamoja na 
                    <strong> Mwongozo Mkuu wa Ulinzi wa Data wa Umoja wa Ulaya (GDPR)</strong>.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">2. Taarifa Tunazokusanya</h4>
                  <p className="text-xs font-light">
                    Ili kukupa mfumo madhubuti wa usimamizi wa mauzo bila mtandao, takwimu za vyumba vya kulala, udhibiti wa famasia na bidhaa, 
                    pamoja na roboti msaidizi wa AI (Lucy), tunahifadhi yafuatayo:
                  </p>
                  <ul className="list-disc list-inside space-y-1.5 text-xs font-light ml-2">
                    <li><strong>Maelezo ya Kuingia ya Mfanyabiashara:</strong> Barua pepe za usajili, nenosiri lililosimbwa kwa ulinzi, namba za simu, na nembo za hiari za mfumo.</li>
                    <li><strong>Seti ya Data za Duka:</strong> Orodha ya bidhaa, vipimo, bei, gharama, makundi ya bidhaa, na majina ya wasambazaji pamoja na wateja.</li>
                    <li><strong>Rekodi za Mauzo (POS):</strong> Stakabadhi za malipo, hesabu kamili ya pesa za keshia, gharama ya bidhaa (COGS), hesabu za kodi za nchi husika, na ripoti za matumizi ya duka.</li>
                    <li><strong>Data ya Malipo ya Simu:</strong> Kumbukumbu zilizosimbwa za miamala ya simu ili kusaidia mfanyabiashara kupambana na utapeli wa miamala ya uongo.</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">3. Uhifadhi Bila Mtandao (Offline-First)</h4>
                  <p className="text-xs font-light">
                    Tofauti na mifumo mingine inayotegemea intaneti pekee, Jasper imeundwa kufanya kazi hata bila mtandao kabisa. 
                    Mauzo yako ya kila siku, salio la pesa, na madaftari ya duka yanahifadhiwa kwanza ndani ya kifaa chako chenyewe (IndexedDB na LocalStorage) 
                    kabla ya kusawazishwa kwa njia salama kwenye seva zetu za cloud. 
                    Wewe kama mfanyabiashara una umiliki kamili na uamuzi juu ya kifaa chako na rekodi zako.
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
                    <strong>Hatufanyi biashara ya matangazo.</strong> Jasper Suite kamwe haiuzi, haikodishi, haigawi wala kubadilishana ripoti zako za siri za mauzo, 
                    faida yako, wala maelezo ya kodi kwa kampuni nyingine za matangazo au madalali wa data.
                    Takwimu zako za kifedha zinasalia kuwa siri yako ya kibiashara pekee.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">6. Uhuru wa Kuhamisha na Kufuta Data</h4>
                  <p className="text-xs font-light">
                    Chini ya sheria za ulinzi wa taarifa binafsi za Afrika Mashariki na sheria ya GDPR ya Ulaya, una mamlaka kamili juu ya habari zako:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-xs font-light ml-2">
                    <li><strong>Haki ya Kuhamisha:</strong> Unaweza kupakua au kuhamisha kumbukumbu zako za mauzo wakati wowote.</li>
                    <li><strong>Haki ya Kufutwa kabisa:</strong> Unaweza kufuta data zako zote kwenye seva za cloud pamoja na kusafisha kumbukumbu ya kifaa chako moja kwa moja kupitia sehemu ya mipangilio. Mara baada ya kufutwa, data hizi haziwezi kurejeshwa tena.</li>
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
                    Please read these Terms and Conditions ("Terms", "Agreement") carefully before activating your account on Jasper Suite. 
                    This legally binding Agreement governs your utilization of the Jasper POS Offline Cashier, Hotel PMS modules, 
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
                    Jasper Suite grants you a non-transferable, revocable, non-exclusive license to utilize our software platform to manage daily retail ledger histories. 
                    You are strictly forbidden from reverse-engineering, database-mining, cloning core offline routing engines, 
                    or extracting the software’s underlying neural prompt matrices for any external commercial applications. All source codes, interfaces, and intellectual property remain our exclusive property.
                  </p>
                </div>

                <div className="space-y-3 bg-red-500/5 p-4 rounded-2xl border border-red-500/10 space-y-2">
                  <h4 className="font-bold text-base text-red-500 tracking-tight pb-1">4. CRITICAL DISCLAIMER: Offline System Synchronisation Covenants</h4>
                  <p className="text-xs font-light">
                    Because Jasper is uniquely engineered with an <strong>Offline-First design</strong>, transaction logs remain cached on your specific browser or terminal. 
                    <strong>The merchant absolutely acknowledges and covenants that:</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-1.5 text-xs font-light ml-2">
                    <li>If you clear your web browser’s physical cache file, format your local registry, or perform a manual physical browser cleanout BEFORE synchronizing with our secure cloud database, all unsynced data logs will be permanently destroyed. We possess NO retrieval mechanisms for un-synced client-side states.</li>
                    <li>Merchants agree to establish an internet connection periodically (at least once every 7 calendar days) to trigger automatic data synchronization checks. Jasper is not responsible for local data fragmentation due to neglected synchronization.</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">5. Regional Agent On-Site Deployments SLA</h4>
                  <p className="text-xs font-light">
                    Our local regional agents offtake direct physical installations, hardware mapping (thermal receipts, barcode configurations, cashier box triggers), 
                    and on-site team training. While we strive to verify reliable offline operation at your specific terminal desk, 
                    Jasper is not liable for hardware incompatibilities or regional GSM carrier outages affecting mobile money verification response rates.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">6. "Lucy AI" Informational Counsel Disclaimer</h4>
                  <p className="text-xs font-light">
                    All suggestions, business performance projections, stock forecasting alerts, and expense advice generated by 
                    our integrated virtual assistant "Lucy" or AI tools are provided <strong>exclusively for informational purposes</strong>. 
                    Lucy's calculations do not constitute official legal, tax, accounting, or professional financial advice. 
                    Merchants must seekcertified regional audits to satisfy tax authority compliance requirements.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">7. Billing Subscription Plans, Cancellations & Upgrades</h4>
                  <p className="text-xs font-light">
                    Jasper Suite provides an active 14-day free trial on selected tiers. After trial expiration, 
                    the selected subscription plan (Essential, Standard, or Premium) will require timely payments to avoid automated cashier write-access lockouts. 
                    All subscription payments are non-refundable. You may cancel or upgrade your store registers directly through the account billing gateway.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">8. Strictest Limitation of Liability</h4>
                  <p className="text-xs font-light">
                    To the absolute maximum extent permitted under applicable local laws of your operating jurisdiction (including Kenya, Tanzania, Nigeria, Uganda, and Rwanda), 
                    Jasper Suite, its directors, developers, and regional installer agents <strong>shall never be liable for any indirect, incidental, punitive, or consequential damages</strong>. 
                    This includes, without limitation: loss of store profits, inventory accounting discrepancies, incorrect tax rate filings, cashier embezzlement, 
                    or server sync interruptions. Our total composite liability shall not exceed the subscription fees you actively paid us in the six (6) months prior to the dispute trigger.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1 font-semibold">9. Governing Law & Constructive Arbitration</h4>
                  <p className="text-xs font-light">
                    This Agreement, any affiliate engagements, and POS terminal codes are governed under the local commercial regulatory frameworks of the operating country. 
                    Any disputes arising out of the system's performance shall undergo constructive bilateral arbitration in regional urban offices (Dar es Salaam / Nairobi) 
                    before escalating to formal civil court filings.
                  </p>
                </div>
              </div>
            ) : (
              // TERMS AND CONDITIONS (SWAHILI)
              <div className="space-y-6 pr-1">
                <div className={`border p-4 rounded-2xl ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <h4 className="font-bold text-emerald-500 flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-emerald-500" />
                    1. Makubaliano ya Moja kwa Moja na Huduma za Mfumo
                  </h4>
                  <p className="text-xs font-light">
                    Tafadhali soma Masharti na Vigezo hivi ("Masharti", "Makubaliano") kwa makini kabla ya kuwezesha akaunti yako kwenye Jasper Suite. 
                    Makubaliano haya ya kisheria yanatawala matumizi yako ya Keshia ya Jasper (Offline POS), usimamizi wa vyumba vya hoteli, 
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
                    Jasper Suite inakupa leseni maalum ambayo haiwezi kuhamishwa kwa mtu mwingine, na inaweza kufutwa wakati wowote, kutumia programu yetu kwa lengo la kusimamia mahesabu ya mauzo yako ya kila siku pekee. 
                    Ni marufuku kabisa kujaribu kunakili msimbo wetu (reverse-engineer), kuiba siri zetu za kikashia zisizo na mtandao, au kutumia utendaji wa software yetu kutengeneza mifumo mingine inayofanana kwa malengo ya kibiashara nje ya Jasper. Msimbo na miundo yote ni miliki ya Jasper pekee.
                  </p>
                </div>

                <div className="space-y-3 bg-red-500/5 p-4 rounded-2xl border border-red-500/10 space-y-2">
                  <h4 className="font-bold text-base text-red-500 tracking-tight pb-1">4. ILANI MUHIMU SANA: Makubaliano ya Kusawazisha Mfumo (Sync) Bila Mtandao</h4>
                  <p className="text-xs font-light">
                    Kwa sababu Jasper imetengenezwa kipekee kufanya kazi <strong>bila intaneti (Offline-First)</strong>, rekodi zote za mauzo zinahifadhiwa ndani ya kivinjari au kifaa chako husika. 
                    <strong>Mfanyabiashara anakubali na kuahidi yafuatayo:</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-1.5 text-xs font-light ml-2">
                    <li>Ukifuta 'cache' ya kivinjari chako cha mtandao (browser cache), uki-format kifaa chako, au kufanya usafishaji mkubwa wa kivinjari KABLA ya kusawazisha (sync) maelezo hayo na mfumo wetu mkuu wa cloud, data zako zote ambazo hazijasawazishwa zitapotea kabisa. Sisi hatuna uwezo kabisa wa kurejesha data zilizofutwa kwenye kifaa chako kabla ya kusawazishwa.</li>
                    <li>Wamiliki wa maduka wanakubali kuunganisha kifaa chao na intaneti angalau mara moja kila baada ya siku 7 (siku saba) ili mfumo uweze kusawazisha data na cloud moja kwa moja. Jasper haitahusika na upotevu wa data kwa duka ambalo limekaa muda mrefu bila kusawazisha kumbukumbu zake.</li>
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
                    Ushauri huo si ushauri rasmi wa kisheria, kodi, au kihasibu wa kitaalamu. 
                    Mteja ana jukumu la kushauriana na wakaguzi rasmi wa kodi ili kukidhi matakwa ya mamlaka ya mapato ya nchi husika.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">7. Malipo ya Vifurushi, Kughairi na Kubadilisha Huduma</h4>
                  <p className="text-xs font-light">
                    Jasper Suite inatoa siku 14 za majaribio bure kwenye baadhi ya vifurushi. Baada ya kipindi cha majaribio kwisha, 
                    kifurushi kilichochaguliwa (Msingi, Kati, au Mkuu) kitahitaji malipo kwa wakati ili kuzuia akaunti kufungwa au kusimamisha uwezo wa kuandika mauzo mapya. 
                    Malipo yote yaliyofanyika hayarudishwi (non-refundable). Unaweza kurejesha au kuongeza vifurushi moja kwa moja kupitia sehemu ya kulipia.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1">8. Kikomo Kikubwa cha Dhima ya Kisheria</h4>
                  <p className="text-xs font-light">
                    Kwa kiwango cha juu kabisa kinachoruhusiwa na sheria husika za nchi unakoendesha biashara yako (Kenya, Tanzania, Nigeria, nk), 
                    Jasper Suite, wakurugenzi wake, watengenezaji wake, na mawakala wake wa nyanjani <strong>hawatatakiwa kamwe kuwajibika kwa hasara yoyote ya moja kwa moja au isiyo ya moja kwa moja</strong>. 
                    Hii inajumuisha, lakini si tu: upotevu wa faida ya duka au hoteli, makosa ya hesabu za bidhaa, marekebisho yasiyo sahihi ya kodi, wizi wa ndani unaofanywa na keshia wako, 
                    au kushindwa kwa cloud kusawazisha data zote. Dhima yetu kuu ya kifedha haitazidi kiasi cha usajili ulichotulipa katika kipindi cha miezi sita (6) iliyopita kabla ya kutokea kwa mgogoro husika.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-base tracking-tight border-b pb-1 font-semibold">9. Sheria Zinazotawala na Utatuzi wa Migogoro</h4>
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
              {modalLang === 'en' ? 'Verified Legal Shield v2.4' : 'Ulinzi wa Kisheria v2.4'}
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
            {modalLang === 'en' ? 'Understood & Close' : 'Nimeelewa & Funga'}
          </button>
        </div>
      </div>
    </div>
  );
}
