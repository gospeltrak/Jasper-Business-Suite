import React, { useState, useEffect } from 'react';
import { StaffSettings, SystemSettings, Sale, Expense, Delivery, Tenant } from '../types';
import { Users, UserPlus, BarChart3, CheckCircle2, XCircle, Camera, Shield, Search, Upload } from 'lucide-react';
import { DEFAULT_CUSTOM_ROLES } from './DashboardSettings';

// Simple currency formatter
const currency = "TSh";

export default function DashboardStaff({
  systemSettings,
  onUpdateSettings,
  sales,
  expenses,
  activeTenant,
  deliveries
}: {
  systemSettings: SystemSettings;
  onUpdateSettings: (s: SystemSettings) => void;
  sales: Sale[];
  expenses: Expense[];
  activeTenant: Tenant;
  deliveries: Delivery[];
}) {
  const [activeTab, setActiveTab] = useState<'list' | 'register' | 'reports'>('list');
  const [staffList, setStaffList] = useState<StaffSettings[]>(systemSettings.staffs || []);
  const customRoles = systemSettings.customRoles || DEFAULT_CUSTOM_ROLES;

  // Real-time status lookup (Active/Offline)
  const [staffStatuses, setStaffStatuses] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Poll local storage to simulate "real-time" status indicator for staff members
    const checkStatuses = () => {
      const statuses: Record<string, boolean> = {};
      const storedMap = localStorage.getItem(`jasper_staff_statuses_${activeTenant.id}`);
      if (storedMap) {
        Object.assign(statuses, JSON.parse(storedMap));
      } else {
        // Mock default statuses if nothing found
        staffList.forEach(s => {
          statuses[s.id] = Math.random() > 0.5; // Randomly assign active/offline initially
        });
        localStorage.setItem(`jasper_staff_statuses_${activeTenant.id}`, JSON.stringify(statuses));
      }
      setStaffStatuses(statuses);
    };

    checkStatuses();
    const timer = setInterval(checkStatuses, 10000); // Check every 10s
    return () => clearInterval(timer);
  }, [staffList, activeTenant.id]);

  // Form states
  const [roleType, setRoleType] = useState<'standard' | 'delivery'>('standard');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [profilePic, setProfilePic] = useState('');
  const [selectedRole, setSelectedRole] = useState(customRoles[0]?.id || 'Seller');
  const [classification, setClassification] = useState<'rider' | 'driver'>('rider');
  const [vehicleType, setVehicleType] = useState<'motorcycle' | 'tuktuk' | 'car'>('motorcycle');
  const [vehicleColor, setVehicleColor] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [signatureImage, setSignatureImage] = useState('');
  
  const [successMessage, setSuccessMessage] = useState('');

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string>>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setter(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRegisterStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !phone || !password) return;

    const newStaff: StaffSettings = {
      id: `staff-${Date.now()}`,
      name: fullName,
      phone: phone,
      password: password,
      role: roleType === 'delivery' ? classification : selectedRole,
      salary: 0,
      profileImage: profilePic,
      ...(roleType === 'delivery' ? {
        classification,
        vehicleType,
        vehicleColor,
        licensePlate: licensePlate.toUpperCase(),
        signatureImage
      } : {})
    };

    const updatedStaffs = [...staffList, newStaff];
    setStaffList(updatedStaffs);
    onUpdateSettings({ ...systemSettings, staffs: updatedStaffs });
    setSuccessMessage(`Staff member "${fullName}" registered successfully.`);

    // Reset fields
    setFullName('');
    setPhone('');
    setPassword('');
    setProfilePic('');
    setVehicleColor('');
    setLicensePlate('');
    setSignatureImage('');

    setTimeout(() => {
      setSuccessMessage('');
      setActiveTab('list');
    }, 2000);
  };

  const handleDeleteStaff = (staffId: string) => {
    if (confirm('Are you sure you want to remove this staff member?')) {
      const updatedStaffs = staffList.filter(s => s.id !== staffId);
      setStaffList(updatedStaffs);
      onUpdateSettings({ ...systemSettings, staffs: updatedStaffs });
    }
  };

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-slate-200 flex justify-between items-end">
        <div>
          <h2 className="font-bold text-slate-800 text-xl tracking-tight flex items-center space-x-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <span>Staff Members & HR</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Register and manage your team. Assign roles, register delivery riders, and monitor employee sales and performance metrics.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-1 bg-slate-100 p-1 w-max rounded-xl">
        <button
          onClick={() => setActiveTab('list')}
          className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center space-x-2 transition-all ${
            activeTab === 'list' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Staff Directory</span>
        </button>
        <button
          onClick={() => setActiveTab('register')}
          className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center space-x-2 transition-all ${
            activeTab === 'register' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>Register Staff</span>
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center space-x-2 transition-all ${
            activeTab === 'reports' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Staff Performance</span>
        </button>
      </div>

      {/* TAB: LIST */}
      {activeTab === 'list' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <h3 className="font-bold text-slate-800 text-sm mb-4">Registered Staff Members</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-200 text-xs text-slate-500 font-bold uppercase tracking-wide">
                  <th className="p-4 font-mono font-bold">Profile</th>
                  <th className="p-4">Name & Login</th>
                  <th className="p-4">Assigned Role</th>
                  <th className="p-4">System Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staffList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400 italic">No staff members registered.</td>
                  </tr>
                ) : (
                  staffList.map(staff => {
                    const isOnline = staffStatuses[staff.id];
                    return (
                      <tr key={staff.id} className="hover:bg-slate-50/50">
                        <td className="p-4">
                          <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center">
                            {staff.profileImage ? (
                              <img src={staff.profileImage} alt={staff.name} className="w-full h-full object-cover" />
                            ) : (
                              <Users className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-slate-800">{staff.name}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{staff.phone}</div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                            staff.role === 'rider' || staff.role === 'driver' 
                              ? 'bg-amber-100 text-amber-800' 
                              : 'bg-indigo-50 text-indigo-700'
                          }`}>
                            {staff.role}
                          </span>
                        </td>
                        <td className="p-4">
                          {isOnline ? (
                            <span className="inline-flex items-center space-x-1.5 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md text-xs font-medium">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                              <span>Active</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1.5 px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-medium">
                              <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                              <span>Offline</span>
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <button 
                            onClick={() => handleDeleteStaff(staff.id)}
                            className="bg-rose-50 text-rose-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-rose-100 transition-colors"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: REGISTER */}
      {activeTab === 'register' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm max-w-3xl">
          <div className="mb-6 border-b border-slate-100 pb-4">
            <h3 className="font-bold text-slate-800 text-sm mb-1">Staff Onboarding Station</h3>
            <p className="text-xs text-slate-500">Provide staff login credentials and assign roles. Ensure profile pictures are square (recommended 500x500px).</p>
          </div>

          <div className="flex gap-4 mb-6">
            <label className="flex items-center space-x-2 text-sm font-medium cursor-pointer">
              <input 
                type="radio" 
                checked={roleType === 'standard'} 
                onChange={() => setRoleType('standard')} 
                className="text-indigo-600 focus:ring-indigo-500" 
              />
              <span>Standard Staff (Seller, Manager, etc)</span>
            </label>
            <label className="flex items-center space-x-2 text-sm font-medium cursor-pointer">
              <input 
                type="radio" 
                checked={roleType === 'delivery'} 
                onChange={() => setRoleType('delivery')} 
                className="text-indigo-600 focus:ring-indigo-500" 
              />
              <span>Logistics (Driver / Rider)</span>
            </label>
          </div>

          {successMessage && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm font-medium mb-6 flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleRegisterStaff} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Login Credentials block */}
              <div className="space-y-4">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">Basic Information & Login</h4>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Full Name</label>
                  <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Omary Juma" className="w-full bg-slate-50 border border-slate-200 text-slate-800 outline-none rounded-xl p-3 text-sm focus:border-indigo-500 focus:bg-white transition-all"/>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Phone Number (Login ID)</label>
                  <input type="tel" required value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 0712345678" className="w-full bg-slate-50 border border-slate-200 text-slate-800 outline-none rounded-xl p-3 text-sm focus:border-indigo-500 focus:bg-white transition-all"/>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Password</label>
                  <input type="text" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter secure password" className="w-full bg-slate-50 border border-slate-200 text-slate-800 outline-none rounded-xl p-3 text-sm focus:border-indigo-500 focus:bg-white transition-all"/>
                </div>
              </div>

              {/* Role & Profile Picture */}
              <div className="space-y-4">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">Profile & Role Setup</h4>
                
                {roleType === 'standard' ? (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Assign Role</label>
                    <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)} className="w-full bg-slate-50 border border-slate-200 text-slate-800 outline-none rounded-xl p-3 text-sm focus:border-indigo-500 cursor-pointer">
                      {customRoles.map(r => (
                        <option key={r.id} value={r.name}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Classification</label>
                      <select value={classification} onChange={e => setClassification(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 text-slate-800 outline-none rounded-xl p-3 text-sm focus:border-indigo-500">
                        <option value="rider">Motorcycle / TukTuk Rider</option>
                        <option value="driver">Van / Car Driver</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">Vehicle Type</label>
                        <select value={vehicleType} onChange={e => setVehicleType(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 text-slate-800 outline-none rounded-xl p-3 text-sm">
                          <option value="motorcycle">Motorcycle</option>
                          <option value="tuktuk">TukTuk / Bajaj</option>
                          <option value="car">Car / Van</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">Color</label>
                        <input type="text" value={vehicleColor} onChange={e => setVehicleColor(e.target.value)} placeholder="e.g. Red" className="w-full bg-slate-50 border border-slate-200 text-slate-800 outline-none rounded-xl p-3 text-sm"/>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">License Plate (Reg No.)</label>
                      <input type="text" required={roleType === 'delivery'} value={licensePlate} onChange={e => setLicensePlate(e.target.value)} placeholder="e.g. MC12345" className="w-full uppercase bg-slate-50 border border-slate-200 text-slate-800 outline-none rounded-xl p-3 text-sm font-mono"/>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Profile Picture (500x500 px)</label>
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-2xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                    {profilePic ? (
                      <div className="relative w-full h-full flex justify-center items-center">
                        <img src={profilePic} alt="Profile" className="h-full w-auto object-cover rounded-xl" />
                        <span className="absolute bottom-2 bg-black/60 text-white px-2 py-1 text-[10px] rounded backdrop-blur-md">Change</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Camera className="w-8 h-8 text-slate-400 mb-2" />
                        <p className="text-xs text-slate-500 font-medium">Click to upload photo</p>
                      </div>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, setProfilePic)} />
                  </label>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-end">
              <button 
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-xl transition-colors text-sm shadow-sm"
              >
                Save Registration
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB: REPORTS */}
      {activeTab === 'reports' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <div className="mb-6">
            <h3 className="font-bold text-slate-800 text-sm mb-1">Staff Performance & Analytics</h3>
            <p className="text-xs text-slate-500">Track orders processed, profit generated, and expenses logged per staff member.</p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {staffList.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 border-dashed text-slate-500 font-medium">
                Register staff to see their performance metrics here.
              </div>
            ) : (
              staffList.map(staff => {
                // Number of orders processed by this staff (Assume cashierMatches staff.name)
                const staffSales = sales.filter(s => s.cashierName === staff.name || s.staffName === staff.name);
                // For delivery riders, maybe log deliveries (by rider Details)
                const staffDeliveries = deliveries.filter(d => d.riderDetails?.name === staff.name || d.riderId === staff.id);
                
                const numOrders = staffSales.length + staffDeliveries.length;
                
                // Profit generated: sum(profit generated by their sales) -> rough approximation with (total - tax)
                const revenueGenerated = staffSales.reduce((acc, s) => acc + s.total, 0);
                const deliveryRevenue = staffDeliveries.reduce((acc, d) => acc + (Number(d.deliveryCost) || 0), 0);
                const totalRevenue = revenueGenerated + deliveryRevenue;

                const staffExpenses = expenses.filter(e => e.staffName === staff.name);
                const totalExpensesCreated = staffExpenses.reduce((acc, e) => acc + e.amount, 0);

                return (
                  <div key={staff.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 border border-slate-200 rounded-2xl hover:bg-slate-50/50 transition-colors gap-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 border-2 border-slate-200 bg-slate-100 flex items-center justify-center">
                        {staff.profileImage ? (
                          <img src={staff.profileImage} alt={staff.name} className="w-full h-full object-cover" />
                        ) : (
                          <Users className="w-6 h-6 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">{staff.name}</h4>
                        <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest">{staff.role}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-6 shrink-0">
                      <div>
                        <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">Orders / Tx</span>
                        <span className="text-lg font-black font-mono text-slate-700">{numOrders}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">Total Handled</span>
                        <span className="text-lg font-black font-mono text-emerald-700">{currency}{totalRevenue.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">Expenses Logged</span>
                        <span className="text-lg font-black font-mono text-rose-700">{currency}{totalExpensesCreated.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
