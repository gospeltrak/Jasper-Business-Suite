import React, { useState, useEffect } from 'react';
import { Shield, Plus, Trash, Eye, EyeOff, Save, CheckCircle, Image as ImageIcon } from 'lucide-react';
import { User } from '../types';
import {
  createSuperAdminStaff,
  deleteSuperAdminStaff,
  loadSuperAdminOverview,
  mapSuperAdminStaff,
  updateSuperAdminStaff
} from '../utils/superAdminData';

export default function SaaSStaffManager() {
  const [staffs, setStaffs] = useState<User[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [staffId, setStaffId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [profileImage, setProfileImage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Permissions array corresponding to SuperAdminWorkspaceTab
  const allPermissionsList = [
    { key: 'dashboard', label: 'Main Dashboard (Revenue, MMR)' },
    { key: 'subscribers', label: 'Platform Subscribers (Tenants)' },
    { key: 'hw-pos', label: 'Hardware Store - POS' },
    { key: 'hw-inventory', label: 'Hardware Store - Inventory' },
    { key: 'hw-sales', label: 'Hardware Store - Sales Logs' },
    { key: 'affiliates', label: 'Affiliates Management' },
    { key: 'status', label: 'Status & Service Requests' },
    { key: 'reports', label: 'Financial Reports' },
    { key: 'expenses', label: 'Operational Expenses' },
    { key: 'chats', label: 'Support SMS/Chats' },
    { key: 'inbox', label: 'Support Inbox (Email)' },
    { key: 'promotions', label: 'Marketing Promotions' },
    { key: 'settings', label: 'Settings & Security Roles' }
  ];

  const [permissions, setPermissions] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    allPermissionsList.forEach(p => initial[p.key] = false);
    return initial;
  });

  useEffect(() => {
    loadStaffs();
  }, []);

  const loadStaffs = async () => {
    try {
      const overview = await loadSuperAdminOverview();
      setStaffs(mapSuperAdminStaff(overview));
      setLoadError('');
    } catch (error: any) {
      setLoadError(error?.message || 'Unable to load SaaS staff accounts.');
      setStaffs([]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const newStaff: User = {
      id: staffId || `saas-staff-${Date.now()}`,
      name,
      email,
      password: '',
      role: 'SuperAdmin',
      tenantId: 'platform-control',
      activeTenant: 'platform-control',
      isSaaSStaff: true,
      profileImage,
      saasPermissions: permissions
    };

    try {
      const payload = {
        name,
        email,
        password,
        profileImageUrl: profileImage,
        permissions
      };
      const response = isEditing
        ? await updateSuperAdminStaff(staffId, payload)
        : await createSuperAdminStaff(payload);
      const saved = response.staff;
      const mappedStaff: User = {
        ...newStaff,
        id: saved.id,
        profileImage: saved.profile_image_url || profileImage,
        saasPermissions: saved.role_permissions || permissions
      };
      const existingIndex = staffs.findIndex(s => s.id === mappedStaff.id);
      const updatedStaffs = existingIndex >= 0
        ? staffs.map((staff) => staff.id === mappedStaff.id ? mappedStaff : staff)
        : [mappedStaff, ...staffs];
      setStaffs(updatedStaffs);
      setShowAddForm(false);
      resetForm();
      setLoadError('');
    } catch (error: any) {
      setLoadError(error?.message || 'Unable to save SaaS staff account.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this SaaS staff login?')) return;
    try {
      await deleteSuperAdminStaff(id);
      const filtered = staffs.filter(s => s.id !== id);
      setStaffs(filtered);
      setLoadError('');
    } catch (error: any) {
      setLoadError(error?.message || 'Unable to delete SaaS staff account.');
    }
  };

  const handleEdit = (staff: User) => {
    setStaffId(staff.id);
    setName(staff.name);
    setEmail(staff.email);
    setPassword(staff.password || '');
    setProfileImage(staff.profileImage || '');
    setPermissions(staff.saasPermissions || {});
    setIsEditing(true);
    setShowAddForm(true);
  };

  const resetForm = () => {
    setStaffId('');
    setName('');
    setEmail('');
    setPassword('');
    setProfileImage('');
    setIsEditing(false);
    const initial: Record<string, boolean> = {};
    allPermissionsList.forEach(p => initial[p.key] = false);
    setPermissions(initial);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const togglePermission = (key: string) => {
    setPermissions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 animate-fade-in text-left">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Shield className="w-5 h-5 text-amber-500" />
          <div>
            <h3 className="text-base font-extrabold text-white">SaaS Staff Control Center</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Manage admin access.</p>
          </div>
        </div>
        {!showAddForm && (
          <button
            onClick={() => { resetForm(); setShowAddForm(true); }}
            className="px-3 md:px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center space-x-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Staff User</span>
          </button>
        )}
      </div>

      {loadError && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
          {loadError}
        </div>
      )}

      {!showAddForm ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {staffs.length === 0 ? (
            <div className="col-span-full py-8 text-center bg-slate-950/50 rounded-2xl border border-slate-800 border-dashed">
              <p className="text-sm font-bold text-slate-500 mb-1">No custom staff users activated.</p>
              <p className="text-[10px] text-slate-600 font-mono">Click Add Staff to grant access to a new team member.</p>
            </div>
          ) : (
            staffs.map(staff => (
              <div key={staff.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center space-x-3">
                    {staff.profileImage ? (
                      <img src={staff.profileImage} alt={staff.name} className="w-10 h-10 rounded-full border border-slate-700 object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center font-bold text-slate-300 text-sm">
                        {staff.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-black text-white">{staff.name}</p>
                      <p className="text-[10px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded uppercase font-mono mt-0.5 font-bold tabular-nums">SaaS Delegate</p>
                    </div>
                  </div>
                </div>
                
                <p className="text-xs font-medium text-slate-400 mb-3 truncate font-mono">{staff.email}</p>
                
                <div className="flex items-center justify-between border-t border-slate-800 pt-3">
                  <div className="text-[9.5px] font-mono text-slate-500 font-black uppercase flex items-center">
                    <CheckCircle className="w-3 h-3 text-emerald-500 mr-1" />
                    {Object.values(staff.saasPermissions || {}).filter(Boolean).length} TABS GRANTED
                  </div>
                  <div className="flex space-x-1.5">
                    <button onClick={() => handleEdit(staff)} className="text-slate-400 hover:text-emerald-500 bg-transparent border-none cursor-pointer transition-colors px-1 text-xs font-bold font-mono">
                      EDIT
                    </button>
                    <button onClick={() => handleDelete(staff.id)} className="text-slate-500 hover:text-red-500 bg-transparent border-none cursor-pointer transition-colors px-1 flex content-center">
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <form onSubmit={handleSave} className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-6 mt-4 relative">
          <h4 className="text-sm font-black text-white">{isEditing ? 'Edit Existing Staff Credentials' : 'Configure New SaaS Staff Credentials'}</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-4">
              <div className="flex items-center space-x-4 mb-2">
                <div className="relative w-16 h-16 rounded-full overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                  {profileImage ? (
                    <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-slate-600" />
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <label className="cursor-pointer">
                      <Plus className="w-5 h-5 text-white" />
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                  </div>
                </div>
                <div className="text-xs">
                  <p className="font-bold text-slate-300">Staff Profile Image</p>
                  <p className="text-[10px] text-slate-500 max-w-[150px]">Click to upload.</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase block">Full Registered Name</label>
                <input 
                  type="text" 
                  value={name} 
                  required
                  onChange={e => setName(e.target.value)} 
                  className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 text-xs px-3 py-2.5 rounded-xl text-white outline-none" 
                  placeholder="e.g. John Doe"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase block">Login Email Route (Restricted)</label>
                <input 
                  type="email" 
                  value={email} 
                  required
                  onChange={e => setEmail(e.target.value)} 
                  className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 text-xs px-3 py-2.5 rounded-xl text-white outline-none" 
                  placeholder="admin.joe@jasper.com"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase block">Authority Key Password</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    value={password}
                    required={!isEditing}
                    onChange={e => setPassword(e.target.value)} 
                    className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 text-xs px-3 py-2.5 rounded-xl text-white outline-none" 
                    placeholder={isEditing ? 'Leave blank to keep existing password' : 'Minimum 8 characters'}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition-colors bg-transparent border-none cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="border border-slate-800 rounded-xl bg-slate-900 flex flex-col h-full overflow-hidden">
              <div className="p-3 border-b border-slate-800 bg-slate-800/40">
                <p className="text-[10px] font-bold text-amber-500 font-mono tracking-wider uppercase flex items-center">
                  <Shield className="w-3 h-3 mr-1.5" />
                  Grant Role Access Segments
                </p>
                <p className="text-[9.5px] text-slate-400 mt-1 leading-tight">Limit visible tabs.</p>
              </div>
              <div className="p-2 overflow-y-auto max-h-[220px] space-y-1 nice-scrollbar flex-grow">
                {allPermissionsList.map((perm) => (
                  <label key={perm.key} className="flex items-center p-2 hover:bg-slate-800/50 rounded-lg cursor-pointer transition-colors group">
                    <input 
                      type="checkbox" 
                      className="peer hidden" 
                      checked={permissions[perm.key] || false}
                      onChange={() => togglePermission(perm.key)}
                    />
                    <div className="w-4 h-4 border border-slate-600 rounded bg-slate-900 peer-checked:bg-amber-500 peer-checked:border-amber-500 flex items-center justify-center transition-colors">
                      <CheckCircle className="w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                    </div>
                    <span className="ml-3 text-xs font-semibold text-slate-400 group-hover:text-slate-300 peer-checked:text-amber-400 transition-colors">
                      {perm.label} {perm.key === 'settings' && <span className="opacity-50 ml-1 text-[9px]">(Caution)</span>}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl font-bold text-xs transition-all cursor-pointer"
            >
              Cancel Edit
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-600/20 hover:bg-amber-600 text-amber-500 hover:text-white border border-amber-600/50 rounded-xl font-bold text-xs transition-all flex items-center space-x-2 cursor-pointer shadow-[0_0_15px_rgba(217,119,6,0.1)] hover:shadow-[0_0_20px_rgba(217,119,6,0.2)]"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : isEditing ? 'Commit Profile Overrides' : 'Deploy Central Credentials'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
