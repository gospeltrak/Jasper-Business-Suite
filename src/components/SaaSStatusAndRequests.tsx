import React, { useState } from 'react';
import { Activity, ShieldAlert, CheckCircle, XCircle, Gift, Search, Megaphone, Image, Upload } from 'lucide-react';

export default function SaaSStatusAndRequests() {
  const [subscribers] = useState([
    { id: '1', name: 'Sarah Jasper', business: 'Jasper Wholesale', status: 'Online', duration: '4h 12m', planStatus: 'Active', daysLeft: 45 },
    { id: '2', name: 'Dr. John Okoth', business: 'Okoth Pharmacy', status: 'Offline', duration: 'Last seen 2h ago', planStatus: 'Expired', daysLeft: 0 },
    { id: '3', name: 'Mikumi Resort', business: 'Mikumi Lodge', status: 'Online', duration: '12h 45m', planStatus: 'Grace Period', daysLeft: -2 }
  ]);

  const [requests, setRequests] = useState([
    { id: 'req-1', user: 'Dr. John Okoth', type: 'Manual Activation', detail: 'Paid via bank transfer. Please check attached receipt.', status: 'Pending', receiptUrl: 'receipt-2049.pdf' },
    { id: 'req-2', user: 'Mikumi Resort', type: 'Manual Activation', detail: 'Cash payment processed. Awaiting system activation.', status: 'Pending', receiptUrl: 'img-receipt.jpg' }
  ]);

  const [emergencyUser, setEmergencyUser] = useState('');
  
  const handleEmergencyAction = (action: 'activate' | 'deactivate') => {
    if (!emergencyUser) {
      alert("Please select a user to perform an emergency operation.");
      return;
    }
    alert(`Emergency operation: ${action.toUpperCase()} executed for ${emergencyUser}.`);
    setEmergencyUser('');
  };

  const [selectedOfferUser, setSelectedOfferUser] = useState('');
  const [offerDateFrom, setOfferDateFrom] = useState('');
  const [offerDateTo, setOfferDateTo] = useState('');
  const [offerPackage, setOfferPackage] = useState('');
  const [offerBannerText, setOfferBannerText] = useState('');
  const [offerImage, setOfferImage] = useState<File | null>(null);

  const handleApproveRequest = (id: string) => {
    setRequests(reqs => reqs.filter(r => r.id !== id));
    alert('Request approved and action executed.');
  };

  const handleDenyRequest = (id: string) => {
    setRequests(reqs => reqs.filter(r => r.id !== id));
    alert('Request denied.');
  };

  const handleSendOffer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOfferUser || !offerDateFrom || !offerDateTo) {
      alert("Please select a user and provide an offer date range.");
      return;
    }
    const pkgText = offerPackage ? ` upgraded to ${offerPackage} ` : ' ';
    alert(`Offer executed! Date range ${offerDateFrom} to ${offerDateTo}${pkgText}and banner added for ${selectedOfferUser}.`);
    setSelectedOfferUser('');
    setOfferDateFrom('');
    setOfferDateTo('');
    setOfferPackage('');
    setOfferBannerText('');
    setOfferImage(null);
  };

  return (
    <div className="space-y-6 animate-fade-in text-left">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Subscriber Status Panel */}
        <div className="bg-slate-900 border border-slate-850 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">Subscriber Live Status</h3>
            </div>
          </div>
          
          <div className="space-y-3">
            {subscribers.map(sub => (
              <div key={sub.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="text-white font-bold text-xs">{sub.name} <span className="text-slate-500 font-mono text-[10px]">({sub.business})</span></h4>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`w-2 h-2 rounded-full ${sub.status === 'Online' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`}></span>
                    <span className="text-[10px] uppercase font-mono text-slate-400">{sub.status} • {sub.duration}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-[10px] font-bold uppercase ${sub.planStatus === 'Active' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {sub.planStatus}
                  </div>
                  <div className="text-[9px] text-slate-500 font-mono">{sub.daysLeft} Days left</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Operations & Requests Panel */}
        <div className="space-y-6">
          {/* Emergency Operations Override */}
          <div className="bg-slate-900 border border-slate-850 rounded-2xl p-6 space-y-4">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">Emergency Operations Override</h3>
            </div>
            <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
              Activation and deactivation is handled automatically by the system. Use this panel to manually override an account's status.
            </p>
            
            <div className="space-y-3">
              <label className="text-[10px] font-mono font-bold uppercase text-slate-400">Target Subscriber Account</label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  list="emergency-options"
                  className="w-full bg-slate-950 border border-slate-800 text-white text-xs rounded-xl py-3 pl-9 pr-4 focus:border-indigo-500 focus:outline-none"
                  placeholder="Search account to override..."
                  value={emergencyUser}
                  onChange={(e) => setEmergencyUser(e.target.value)}
                />
                <datalist id="emergency-options">
                  {subscribers.map(sub => (
                    <option key={sub.id} value={sub.name}>{sub.business}</option>
                  ))}
                </datalist>
              </div>
              <div className="flex space-x-2 pt-2">
                <button onClick={() => handleEmergencyAction('activate')} className="flex-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 py-2.5 rounded-xl font-bold text-xs uppercase transition-colors">
                  Force Activate
                </button>
                <button onClick={() => handleEmergencyAction('deactivate')} className="flex-1 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 py-2.5 rounded-xl font-bold text-xs uppercase transition-colors">
                  Force Deactivate
                </button>
              </div>
            </div>
          </div>

          {/* Manual Subscription Requests */}
          <div className="bg-slate-900 border border-slate-850 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Activity className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">Manual Subscription Requests</h3>
              </div>
              {requests.length > 0 && (
                <span className="bg-rose-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold animate-pulse">
                  {requests.length} Pending
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
              Subscribers who paid directly (e.g. via bank transfer) when the automated payment gateway failed. Please verify receipts before activating.
            </p>

            <div className="space-y-3">
              {requests.length === 0 ? (
                <div className="text-center p-6 bg-slate-950 rounded-xl border border-slate-800 border-dashed">
                  <span className="text-slate-500 text-xs">No pending manual activation requests</span>
                </div>
              ) : (
                requests.map(req => (
                  <div key={req.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3">
                    <div>
                      <h4 className="text-white font-bold text-xs">{req.user}</h4>
                      <span className="text-[10px] font-mono uppercase bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded mt-1 inline-block">{req.type}</span>
                      <p className="text-[10px] text-slate-400 mt-2">{req.detail}</p>
                      {req.receiptUrl && (
                        <div className="mt-3 p-2 bg-slate-900 rounded border border-slate-800 flex items-center justify-between">
                          <span className="text-xs text-slate-300 font-mono flex items-center space-x-2">
                            <Image className="w-3 h-3" />
                            <span>{req.receiptUrl}</span>
                          </span>
                          <button className="text-[10px] font-bold text-indigo-400 uppercase hover:underline">View Receipt</button>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 pt-2">
                      <button onClick={() => handleApproveRequest(req.id)} className="flex-1 flex justify-center items-center space-x-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 py-2 rounded font-bold text-[10px] uppercase transition-colors">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Verify & Activate</span>
                      </button>
                      <button onClick={() => handleDenyRequest(req.id)} className="flex-1 flex justify-center items-center space-x-1 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 py-2 rounded font-bold text-[10px] uppercase transition-colors">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Promotional Offers & Banner Editor */}
      <div className="bg-slate-900 border border-slate-850 rounded-2xl p-6 space-y-5">
        <div className="flex items-center space-x-2">
          <Gift className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">Special Offers & Banners</h3>
        </div>
        <p className="text-[11px] text-slate-400 font-sans">
          Grant free days to subscribers and push popup banners to their dashboard directly.
        </p>

        <form onSubmit={handleSendOffer} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono font-bold uppercase text-slate-400">Target Subscriber Account</label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  list="subscriber-options"
                  className="w-full bg-slate-950 border border-slate-800 text-white text-xs rounded-xl py-3 pl-9 pr-4 focus:border-indigo-500 focus:outline-none"
                  placeholder="Search or select a subscriber..."
                  value={selectedOfferUser}
                  onChange={(e) => setSelectedOfferUser(e.target.value)}
                  required
                />
                <datalist id="subscriber-options">
                  <option value="ALL">Apply to ALL Subscribers</option>
                  {subscribers.map(sub => (
                    <option key={sub.id} value={sub.name}>{sub.business}</option>
                  ))}
                </datalist>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono font-bold uppercase text-slate-400">Upgrade Package (Optional)</label>
              <select 
                className="w-full bg-slate-950 border border-slate-800 text-white text-xs rounded-xl py-3 px-4 focus:border-indigo-500 focus:outline-none appearance-none cursor-pointer"
                value={offerPackage}
                onChange={(e) => setOfferPackage(e.target.value)}
              >
                <option value="">Do not upgrade (keep current)</option>
                <option value="Premium Plan">Premium Plan</option>
                <option value="Enterprise Plan">Enterprise Plan</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono font-bold uppercase text-slate-400">Offer Date Range</label>
              <div className="flex items-center space-x-2">
                <input 
                  type="date"
                  required
                  className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl p-3 focus:border-indigo-500 focus:outline-none"
                  value={offerDateFrom}
                  onChange={(e) => setOfferDateFrom(e.target.value)}
                />
                <span className="text-slate-500 font-bold">-</span>
                <input 
                  type="date"
                  required
                  className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl p-3 focus:border-indigo-500 focus:outline-none"
                  value={offerDateTo}
                  onChange={(e) => setOfferDateTo(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-bold uppercase text-slate-400 flex items-center space-x-2">
              <Image className="w-3.5 h-3.5 text-slate-500" />
              <span>Banner Image Attachment (Optional)</span>
            </label>
            <div className="bg-slate-950 border border-slate-800 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:border-indigo-500/50 transition-colors group relative">
              <input 
                  type="file" 
                  accept="image/*" 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => setOfferImage(e.target.files?.[0] || null)}
              />
              <Upload className="w-6 h-6 text-slate-600 mb-2 group-hover:text-indigo-400 transition-colors" />
              <span className="text-xs text-slate-400 font-bold">
                {offerImage ? offerImage.name : "Click to upload a custom banner image"}
              </span>
              <span className="text-[10px] text-slate-500 mt-1">PNG, JPG, WEBP (Designs with balloons/ribbons recommended)</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-bold uppercase text-slate-400 flex items-center space-x-2">
              <Megaphone className="w-3.5 h-3.5 text-slate-500" />
              <span>Popup Banner Text (Optional)</span>
            </label>
            <textarea 
              placeholder="e.g. You have received 7 free diagnostic days. Enjoy!" 
              className="w-full bg-slate-950 border border-slate-800 text-white text-xs rounded-xl p-3 focus:border-indigo-500 focus:outline-none min-h-[80px]"
              value={offerBannerText}
              onChange={(e) => setOfferBannerText(e.target.value)}
            />
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold uppercase rounded-xl transition-colors shadow-md">
              Activate Offer & Banner
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
