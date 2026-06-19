import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Bed, 
  Sparkles, 
  TrendingUp, 
  User, 
  Plus, 
  Search, 
  Check, 
  CheckCircle, 
  Clock, 
  Settings, 
  CreditCard, 
  Coffee, 
  ShieldAlert, 
  PlusCircle, 
  DollarSign, 
  Smartphone, 
  Send, 
  MessageSquare, 
  MapPin, 
  Activity, 
  FileText, 
  RefreshCw,
  Utensils,
  ChevronRight,
  UserCheck,
  UserX,
  Sparkle
} from 'lucide-react';
import { Tenant, User as AppUser, SyncLog } from '../types';

interface DashboardHotelPMSProps {
  activeTenant: Tenant;
  currentUser: AppUser;
  onAddSyncLog?: (log: SyncLog) => void;
}

interface Room {
  id: string;
  number: string;
  type: string;
  pricePerNight: number;
  status: 'Clean' | 'Dirty' | 'Inspecting' | 'Maintenance';
  housekeeper?: string;
  amenities: string[];
}

interface Reservation {
  id: string;
  guestName: string;
  guestPhone: string;
  roomNumber: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  status: 'Checked-In' | 'Reserved' | 'Checked-Out';
  totalCharge: number;
  paymentStatus: 'Paid' | 'Unpaid' | 'Partial';
  specialRequests: string;
  additionalCharges: Array<{ desc: string; amount: number }>;
  guestIdType?: 'NIDA' | 'Passport' | 'VoterID' | 'Other';
  guestIdNumber?: string;
  guestOrigin?: string;
  guestAge?: number;
}

export default function DashboardHotelPMS({ activeTenant, currentUser, onAddSyncLog }: DashboardHotelPMSProps) {
  // Mock Data
  const [rooms, setRooms] = useState<Room[]>([
    { id: 'rm-101', number: '101', type: 'Deluxe Ocean Suite', pricePerNight: 12500, status: 'Clean', amenities: ['Ocean View', 'Balcony', 'AC'] },
    { id: 'rm-102', number: '102', type: 'Deluxe Ocean Suite', pricePerNight: 12500, status: 'Dirty', amenities: ['Ocean View', 'Balcony', 'AC'], housekeeper: 'Mercy G.' },
    { id: 'rm-103', number: '103', type: 'Executive Mountain View', pricePerNight: 9500, status: 'Clean', amenities: ['Mountain View', 'AC', 'Mini-bar'] },
    { id: 'rm-201', number: '201', type: 'Executive Mountain View', pricePerNight: 9500, status: 'Inspecting', amenities: ['Mountain View', 'AC', 'Mini-bar'], housekeeper: 'Karanja J.' },
    { id: 'rm-202', number: '202', type: 'Standard Garden Cabin', pricePerNight: 6500, status: 'Clean', amenities: ['Garden View', 'Fan'] },
    { id: 'rm-301', number: '301', type: 'Royal Penthouse Vault', pricePerNight: 28000, status: 'Clean', amenities: ['Private Pool', 'Kitchen', 'Workspace', 'Spa Access'] },
    { id: 'rm-302', number: '302', type: 'Standard Garden Cabin', pricePerNight: 6500, status: 'Maintenance', amenities: ['Garden View', 'Fan'] }
  ]);

  const [reservations, setReservations] = useState<Reservation[]>([
    {
      id: 'RES-9011',
      guestName: 'Faith Mwende',
      guestPhone: '+254 722 888 123',
      roomNumber: '101',
      checkIn: '2026-05-21',
      checkOut: '2026-05-24',
      status: 'Checked-In',
      totalCharge: 37500,
      paymentStatus: 'Paid',
      specialRequests: 'Vegan breakfast, extra pillows, airport taxi at 10 AM',
      additionalCharges: [
        { desc: 'Room Service (Beverages)', amount: 2400 },
        { desc: 'Massage Therapy', amount: 4500 }
      ],
      guestIdType: 'Passport',
      guestIdNumber: 'KE-AA9010',
      guestOrigin: 'Mombasa, Kenya',
      guestAge: 29
    },
    {
      id: 'RES-4402',
      guestName: 'Alhaji Kunle',
      guestPhone: '+234 803 111 9222',
      roomNumber: '301',
      checkIn: '2026-05-20',
      checkOut: '2026-05-27',
      status: 'Checked-In',
      totalCharge: 196000,
      paymentStatus: 'Paid',
      specialRequests: 'Prefers ultra-high floor, needs workspace setup, VIP welcome basket',
      additionalCharges: [
        { desc: 'Premium Cohiba Cigar Box', amount: 15000 }
      ],
      guestIdType: 'Passport',
      guestIdNumber: 'NG-998811P',
      guestOrigin: 'Lagos, Nigeria',
      guestAge: 46
    },
    {
      id: 'RES-8012',
      guestName: 'Winston Asante',
      guestPhone: '+233 244 555 111',
      roomNumber: '103',
      checkIn: '2026-05-22',
      checkOut: '2026-05-25',
      status: 'Reserved',
      totalCharge: 28500,
      paymentStatus: 'Unpaid',
      specialRequests: 'Pre-ordered fruit basket',
      additionalCharges: [],
      guestIdType: 'Passport',
      guestIdNumber: 'GH-332909',
      guestOrigin: 'Accra, Ghana',
      guestAge: 38
    },
    {
      id: 'RES-3211',
      guestName: 'Mary Chen',
      guestPhone: '+254 711 000 888',
      roomNumber: '202',
      checkIn: '2026-05-18',
      checkOut: '2026-05-21',
      status: 'Checked-Out',
      totalCharge: 19500,
      paymentStatus: 'Paid',
      specialRequests: 'Extra hangers',
      additionalCharges: [],
      guestIdType: 'Passport',
      guestIdNumber: 'CN-908122',
      guestOrigin: 'Beijing, China',
      guestAge: 32
    }
  ]);

  // Calendar setup
  const [calendarDates, setCalendarDates] = useState<string[]>([]);
  useEffect(() => {
    const dates: string[] = [];
    const base = new Date('2026-05-21');
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    setCalendarDates(dates);
  }, []);

  // UI State controllers
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const [selectedRoomForBooking, setSelectedRoomForBooking] = useState<string | null>(null);
  const [selectedDateForBooking, setSelectedDateForBooking] = useState<string | null>(null);

  // New booking form fields
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [assignedRoom, setAssignedRoom] = useState('101');
  const [checkInDate, setCheckInDate] = useState('2026-05-21');
  const [checkOutDate, setCheckOutDate] = useState('2026-05-23');
  const [specialRequests, setSpecialRequests] = useState('');
  const [paymentChoice, setPaymentChoice] = useState<'Paid' | 'Unpaid'>('Unpaid');
  const [guestIdType, setGuestIdType] = useState<'NIDA' | 'Passport' | 'VoterID' | 'Other'>('NIDA');
  const [guestIdNumber, setGuestIdNumber] = useState('');
  const [guestOrigin, setGuestOrigin] = useState('');
  const [guestAge, setGuestAge] = useState('');

  // Dynamic pricing states (Cloudbeds Killer feature!)
  const [surgeMultiplier, setSurgeMultiplier] = useState<number>(1.0);
  const [dynamicPricingApplied, setDynamicPricingApplied] = useState(false);
  const [suggestedMultiplier, setSuggestedMultiplier] = useState(1.18); // Recommended surge based on weekend/events
  const [currentWeather, setCurrentWeather] = useState('Sunny & Clear');
  const [localEvent, setLocalEvent] = useState('Nairobi Tech Expo (High Guest Demand)');

  // Selected CRM & Folio charging states
  const [searchQuery, setSearchQuery] = useState('');
  const [housekeepingFilter, setHousekeepingFilter] = useState<'All' | 'Clean' | 'Dirty' | 'Inspecting' | 'Maintenance'>('All');
  const [chargeDesc, setChargeDesc] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');
  const [mPesaPhone, setMPesaPhone] = useState('');
  const [mPesaTriggered, setMPesaTriggered] = useState(false);
  const [mPesaStatus, setMPesaStatus] = useState<'idle' | 'pushing' | 'completed'>('idle');

  // Helper currency formatter
  const formattedCurrencyValue = (amount: number) => {
    return `${activeTenant.currency || 'KSh'} ${Math.round(amount).toLocaleString()}`;
  };

  // Add Dynamic PMS Sync Notification Log helper
  const addPmsLog = (message: string, status: 'success' | 'warning' | 'pending' | 'failed' = 'success') => {
    if (onAddSyncLog) {
      onAddSyncLog({
        id: 'log-pms-' + Math.random().toString(36).substr(2, 5),
        type: 'product_update',
        status,
        message,
        timestamp: new Date().toISOString()
      });
    }
  };

  // Click room/date cell to triggers reservation draft
  const handleCellClick = (roomNumber: string, date: string) => {
    setSelectedRoomForBooking(roomNumber);
    setSelectedDateForBooking(date);
    setAssignedRoom(roomNumber);
    setCheckInDate(date);
    
    // Auto-calculate check out as next day
    const d = new Date(date);
    d.setDate(d.getDate() + 2);
    setCheckOutDate(d.toISOString().split('T')[0]);
    setIsNewBookingModalOpen(true);
  };

  // Submit dynamic reservation state
  const handleCreateBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName || !guestPhone) return;

    const matchedRoom = rooms.find(r => r.number === assignedRoom);
    const cost = matchedRoom ? matchedRoom.pricePerNight * surgeMultiplier : 8000;
    
    // Stay duration
    const start = new Date(checkInDate);
    const end = new Date(checkOutDate);
    const nights = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const totalCharge = cost * nights;

    const newRes: Reservation = {
      id: 'RES-' + Math.floor(1000 + Math.random() * 9000),
      guestName,
      guestPhone,
      roomNumber: assignedRoom,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      status: 'Reserved',
      totalCharge,
      paymentStatus: paymentChoice,
      specialRequests: specialRequests || 'No specifications',
      additionalCharges: [],
      guestIdType,
      guestIdNumber,
      guestOrigin,
      guestAge: guestAge ? parseInt(guestAge, 10) : undefined
    };

    setReservations(prev => [newRes, ...prev]);
    setIsNewBookingModalOpen(false);

    // Update room status to Dirty if they checked in right away, or keep room tidy
    addPmsLog(`[PMS Calendar] Created reservation ${newRes.id} for guest ${guestName} (Room ${assignedRoom})`, 'success');

    // Reset fields
    setGuestName('');
    setGuestPhone('');
    setSpecialRequests('');
    setPaymentChoice('Unpaid');
    setGuestIdType('NIDA');
    setGuestIdNumber('');
    setGuestOrigin('');
    setGuestAge('');
  };

  // Fast Housekeeping State Pivot
  const changeRoomStatus = (roomId: string, newStatus: Room['status']) => {
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, status: newStatus } : r));
    const matched = rooms.find(r => r.id === roomId);
    addPmsLog(`[Housekeeping Manager] Room ${matched?.number} pivoted status to ${newStatus}`, 'success');
  };

  // Perform dynamic surcharges - Killer feature compared to standard Cloudbeds
  const triggerPricingSurge = () => {
    if (dynamicPricingApplied) {
      // Revert
      setSurgeMultiplier(1.0);
      setDynamicPricingApplied(false);
      addPmsLog(`[Surge Engine] Reverted channel prices to default seasonal tariff base`, 'warning');
    } else {
      // Apply recommended surcharge
      setSurgeMultiplier(suggestedMultiplier);
      setDynamicPricingApplied(true);
      addPmsLog(`[AI Revenue Maximizer] Deployed +18% Pricing surge across Booking.com, Airbnb, and Direct Engine due to: ${localEvent}`, 'success');
    }
  };

  // Charge to Room Folio
  const handleAddFolioCharge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReservation || !chargeDesc || !chargeAmount) return;

    const chargeNum = parseFloat(chargeAmount);
    if (isNaN(chargeNum) || chargeNum <= 0) return;

    const newCharge = { desc: chargeDesc, amount: chargeNum };
    
    setReservations(prev => prev.map(res => {
      if (res.id === selectedReservation.id) {
        return {
          ...res,
          totalCharge: res.totalCharge + chargeNum,
          additionalCharges: [...res.additionalCharges, newCharge]
        };
      }
      return res;
    }));

    // Cascade updates to visual overlay focus
    setSelectedReservation(prev => {
      if (!prev) return null;
      return {
        ...prev,
        totalCharge: prev.totalCharge + chargeNum,
        additionalCharges: [...prev.additionalCharges, newCharge]
      };
    });

    addPmsLog(`[Folio Ledger] Added custom folio charge "${chargeDesc}" (${formattedCurrencyValue(chargeNum)}) to ${selectedReservation.guestName}`, 'success');
    setChargeDesc('');
    setChargeAmount('');
  };

  // Check out Guest / Process checkout payments
  const handleUpdateReservationStatus = (resId: string, nextStatus: Reservation['status']) => {
    const matchedRes = reservations.find(r => r.id === resId);

    // Guard: Final lodging payment must be fully Paid before checking in (giving room to guest)
    if (nextStatus === 'Checked-In' && matchedRes && matchedRes.paymentStatus !== 'Paid') {
      addPmsLog(`[PMS Security Guard] Room key block. Invoice for ${matchedRes.guestName} must be fully Paid before check-in!`, 'failed');
      return;
    }

    setReservations(prev => prev.map(res => {
      if (res.id === resId) {
        return { ...res, status: nextStatus };
      }
      return res;
    }));

    setSelectedReservation(prev => {
      if (!prev) return null;
      return { ...prev, status: nextStatus };
    });

    // Automatically flag corresponding Room as Dirty on check-out
    if (matchedRes && nextStatus === 'Checked-Out') {
      setRooms(prev => prev.map(rm => rm.number === matchedRes.roomNumber ? { ...rm, status: 'Dirty' } : rm));
    }

    addPmsLog(`[PMS Calendar] Guest reservation ${resId} status changed to ${nextStatus}`, 'success');
  };

  // Direct Mobile Money STK Push simulation for guest checkout
  const triggerMobileMoneySTKPush = () => {
    if (!mPesaPhone) return;
    setMPesaStatus('pushing');
    addPmsLog(`[Mobile Money Portal] Initiating secure checkout STK Push to ${mPesaPhone} for amount: ${formattedCurrencyValue(selectedReservation?.totalCharge || 0)}`, 'pending');

    setTimeout(() => {
      setMPesaStatus('completed');
      setMPesaTriggered(true);
      
      // Update Payment Status to Paid
      if (selectedReservation) {
        setReservations(prev => prev.map(res => {
          if (res.id === selectedReservation.id) {
            return { ...res, paymentStatus: 'Paid' };
          }
          return res;
        }));
        setSelectedReservation(prev => {
          if (!prev) return null;
          return { ...prev, paymentStatus: 'Paid' };
        });
      }

      addPmsLog(`[Mobile Money Terminal] Guest checkout bill verified online. Reference TX-STK-${Math.floor(100000 + Math.random() * 900000)} cleared.`, 'success');
    }, 1500);
  };

  // Filtered lists
  const filteredRooms = rooms.filter(r => housekeepingFilter === 'All' || r.status === housekeepingFilter);
  const filteredReservations = reservations.filter(r => 
    r.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.roomNumber.includes(searchQuery) ||
    r.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div id="hotel-pms-workspace" className="space-y-8 animate-fade-in font-sans">
      
      {/* Dynamic Header Promo / Warning Bar of premium killer features */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-emerald-950 p-6 rounded-3xl border border-indigo-950 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 bg-emerald-500 text-slate-950 text-[9px] font-mono font-black uppercase rounded-md tracking-wider">Cloudbeds+ Premium OS</span>
            <span className="text-[10px] text-indigo-300 font-mono font-bold tracking-widest uppercase">Autonomous Revenue Optimization Suite</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Hotel Property Management & Booking Hub
          </h2>
          <p className="text-[11.5px] text-slate-300 leading-relaxed max-w-xl font-light">
            An augmented PMS system integrating room charts, dynamically surging pricing based on local high-traffic events, real-time housekeeping dispatch schedules, and mobile money STK pushes.
          </p>
        </div>

        {/* AI Surge Optimization Controller Widget */}
        <div className="bg-white/10 rounded-2xl p-4 border border-white/10 space-y-3 w-full md:w-auto min-w-[280px]">
          <div className="flex items-center justify-between text-xs font-mono font-medium text-indigo-200">
            <span className="flex items-center space-x-1.5 font-bold uppercase tracking-wider text-[9px]">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>Yield Price Surge recomendation</span>
            </span>
            <span className="px-1.5 py-0.2 bg-indigo-505/30 border border-indigo-400 text-indigo-200 text-[9.5px] font-bold rounded">
              High Traffic Event
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[10.5px] text-slate-350 font-medium">Factor: <span className="text-white font-bold">{localEvent}</span></p>
              <p className="text-sm font-black text-rose-300 font-mono">Surge recommendation: +18% Tariff Premium</p>
            </div>
            <button
              onClick={triggerPricingSurge}
              className={`px-3 py-2 rounded-xl text-[10.5px] font-bold tracking-wider uppercase transition-all cursor-pointer shadow-md ${
                dynamicPricingApplied 
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950' 
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
              }`}
            >
              {dynamicPricingApplied ? 'Surge Active' : 'Apply surge'}
            </button>
          </div>
        </div>
      </div>

      {/* Primary KPI HUD Counters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Occupancy Rate */}
        <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[10.1px] font-mono text-slate-400 uppercase tracking-widest font-bold">Occupancy Level</p>
            <span className="p-1 px-2 bg-emerald-50 text-emerald-700 text-[10px] font-mono font-bold rounded-lg border border-emerald-100 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              <span>Target Met</span>
            </span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-black text-slate-850 font-mono">71.4%</span>
            <span className="text-[10px] font-medium text-slate-500">5 of 7 Rooms occupied</span>
          </div>
        </div>

        {/* KPI 2: Live surge rate */}
        <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[10.1px] font-mono text-slate-400 uppercase tracking-widest font-bold">Surge Multiplier</p>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-black text-slate-850 font-mono">
              x{surgeMultiplier.toFixed(2)}
            </span>
            <span className="text-[10px] font-medium text-slate-500">
              {dynamicPricingApplied ? 'Surged Rate' : 'Base Rate active'}
            </span>
          </div>
        </div>

        {/* KPI 3: Occupancy Revenue / RevPar */}
        <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[10.1px] font-mono text-slate-400 uppercase tracking-widest font-bold">RevPAR Metrics</p>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-2xl font-black text-slate-850 font-mono">
              {formattedCurrencyValue(rooms.filter(r => r.status === 'Clean').reduce((acc, r) => acc + r.pricePerNight * surgeMultiplier, 0) / rooms.length)}
            </span>
            <span className="text-[9.5px] text-slate-450 font-medium">Daily average per available room</span>
          </div>
        </div>

        {/* KPI 4: Pending Housekeeping */}
        <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-xs space-y-1.5" onClick={() => setHousekeepingFilter('Dirty')}>
          <div className="flex items-center justify-between cursor-pointer">
            <p className="text-[10.1px] font-mono text-slate-400 uppercase tracking-widest font-bold">Housekeeping Triage</p>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-3xl font-black text-slate-850 font-mono">
              {rooms.filter(r => r.status === 'Dirty' || r.status === 'Inspecting').length}
            </span>
            <span className="text-[10px] text-slate-500 font-medium font-sans">
              Active cleaning jobs dispatched
            </span>
          </div>
        </div>
      </div>

      {/* Section split tabs: Grid calendar, housekeeping registry, and guest CRM */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* Reservation Grid calendar: occupy 8 columns on large */}
        <section className="xl:col-span-8 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-emerald-500" />
                <span>Cloudbeds PMS Reservation Matrix</span>
              </h3>
              <p className="text-[11px] text-slate-450 font-medium font-sans">
                Interactive real-time occupancy grid. Select empty cells to book rooms or click active tickets to inspect vouchers.
              </p>
            </div>
            
            <button
              onClick={() => {
                setSelectedRoomForBooking('101');
                setSelectedDateForBooking('2026-05-21');
                setIsNewBookingModalOpen(true);
              }}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold p-3 px-4 rounded-xl text-xs uppercase tracking-wide transition-all cursor-pointer flex items-center space-x-1.5 border-none self-start"
            >
              <PlusCircle className="w-4 h-4 text-emerald-400 font-bold" />
              <span>Manual Check-In Booking</span>
            </button>
          </div>

          {/* Graphical reservation calendar grid */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden overflow-x-auto min-w-full">
            <table className="w-full text-left border-collapse table-fixed min-w-[700px]">
              
              {/* Header dates */}
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-800 text-[10px] font-bold font-mono tracking-wider uppercase">
                <tr>
                  <th className="p-3 border-r border-slate-200 w-44">ROOM MATRIX / TARIFF</th>
                  {calendarDates.map(date => {
                    // format date string "2026-05-21" to "THU 21"
                    const dayObj = new Date(date);
                    const label = dayObj.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
                    const isToday = date === '2026-05-21';
                    return (
                      <th key={date} className={`p-3 text-center border-r border-slate-200 ${isToday ? 'bg-emerald-50/70 text-emerald-700' : ''}`}>
                        {label} {isToday && '(TODAY)'}
                      </th>
                    );
                  })}
                </tr>
              </thead>

              {/* Rows */}
              <tbody className="divide-y divide-slate-150 text-xs font-sans">
                {rooms.map(room => {
                  const baseTariff = room.pricePerNight * surgeMultiplier;
                  
                  return (
                    <tr key={room.id} className="hover:bg-slate-50/50 transition-colors">
                      
                      {/* Room metadata cell */}
                      <td className="p-3 border-r border-slate-200 space-y-1">
                        <div className="flex items-center space-x-1.5">
                          <Bed className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-bold text-slate-700">Room {room.number}</span>
                        </div>
                        <p className="text-[9.5px] text-slate-500 line-clamp-1 font-medium">{room.type}</p>
                        <p className="text-[9.5px] font-mono text-emerald-600 font-bold tracking-tight">
                          {formattedCurrencyValue(baseTariff)}
                        </p>
                      </td>

                      {/* Dates cells */}
                      {calendarDates.map(date => {
                        // Check if there is an active reservation overlaying this room number and date
                        const matchingRes = reservations.find(res => {
                          if (res.roomNumber !== room.number) return false;
                          const checkInTime = new Date(res.checkIn).getTime();
                          const checkOutTime = new Date(res.checkOut).getTime();
                          const cellTime = new Date(date).getTime();
                          // Cell is occupied if it sits between or is exactly checkIn and before checkOut
                          return cellTime >= checkInTime && cellTime < checkOutTime;
                        });

                        if (matchingRes) {
                          // Is this date the check-in date? To prevent redundant rendering, we only show block starting from checkIn day
                          const isCheckInDay = date === matchingRes.checkIn;
                          
                          if (isCheckInDay) {
                            // Calculate span of nights
                            const start = new Date(matchingRes.checkIn);
                            const end = new Date(matchingRes.checkOut);
                            const daysSpan = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                            
                            // Color scheme based on status
                            const scheme = 
                              matchingRes.status === 'Checked-In' 
                                ? 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-750' 
                                : matchingRes.status === 'Reserved'
                                  ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
                                  : 'bg-slate-200 text-slate-700 border-slate-350 hover:bg-slate-250';

                            return (
                              <td 
                                key={date} 
                                colSpan={daysSpan} 
                                className="p-1 border-r border-slate-150 relative cursor-pointer"
                                onClick={() => setSelectedReservation(matchingRes)}
                              >
                                <div className={`m-1 p-2 border rounded-xl shadow-xs transition-transform transform active:scale-95 flex flex-col justify-between h-14 ${scheme}`}>
                                  <div>
                                    <div className="flex items-center justify-between">
                                      <p className="font-bold text-[9.5px] leading-tight truncate">{matchingRes.guestName}</p>
                                      <p className="text-[8px] font-mono font-black uppercase bg-white/20 px-1 rounded-sm leading-none">
                                        {matchingRes.id}
                                      </p>
                                    </div>
                                    <p className="text-[8px] opacity-90 truncate leading-relaxed">
                                      {daysSpan} Nights ({matchingRes.paymentStatus === 'Paid' ? 'Paid' : 'Due'})
                                    </p>
                                  </div>
                                  <div className="flex items-center space-x-1 justify-end">
                                    <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
                                    <span className="text-[7.5px] font-mono uppercase font-bold tracking-wider leading-none">
                                      {matchingRes.status}
                                    </span>
                                  </div>
                                </div>
                              </td>
                            );
                          } else {
                            // If it's a continuing occupied date, return null because colSpan covers it
                            return null;
                          }
                        }

                        // Otherwise room cell is vacant! Click-to-book cell
                        return (
                          <td 
                            key={date} 
                            onClick={() => handleCellClick(room.number, date)}
                            className="text-center p-2 border-r border-slate-150 hover:bg-emerald-50 bg-slate-50/30 cursor-pointer font-mono font-bold text-slate-350 hover:text-emerald-600 text-[10px] transition-colors h-16 vertical-middle"
                            title="Vacant Room Slot. Click to book."
                          >
                            +
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 flex-wrap gap-2 pt-2">
            <div className="flex items-center space-x-4">
              <span className="flex items-center space-x-1">
                <span className="inline-block w-2.5 h-2.5 bg-indigo-650 rounded border border-indigo-750" />
                <span>Checked In</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="inline-block w-2.5 h-2.5 bg-emerald-650 rounded border border-emerald-755" />
                <span>Reserved (Confirmed)</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="inline-block w-2.5 h-2.5 bg-slate-205 rounded border border-slate-350" />
                <span>Checked Out (Archive)</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="inline-block w-2.5 h-2.5 bg-slate-50 text-[10px] border border-slate-200 text-center text-slate-400 font-mono">+</span>
                <span>Click empty slot to schedule checkout</span>
              </span>
            </div>
            
            <p className="font-bold text-indigo-805">Active surcharges applied: x{surgeMultiplier}</p>
          </div>
        </section>

        {/* Housekeeping Triage Sidebar: occupy 4 columns on large screens */}
        <section className="xl:col-span-4 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-850 flex items-center space-x-2">
              <Clock className="w-4 h-4 text-emerald-550" />
              <span>Room Maintenance & Crew Tasks</span>
            </h3>
            <p className="text-[11px] text-slate-455">
              Live housekeeping workflow dispatching. Staff updates room clearance before assigning guests.
            </p>
          </div>

          {/* Quick Housekeeping toggling filters */}
          <div className="flex flex-wrap gap-1.5">
            {(['All', 'Clean', 'Dirty', 'Inspecting', 'Maintenance'] as const).map(f => {
              const count = f === 'All' ? rooms.length : rooms.filter(r => r.status === f).length;
              return (
                <button
                  key={f}
                  onClick={() => setHousekeepingFilter(f)}
                  className={`px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold border transition-all cursor-pointer ${
                    housekeepingFilter === f 
                      ? 'bg-emerald-50 text-emerald-950 border-emerald-200' 
                      : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-slate-700'
                  }`}
                >
                  {f} ({count})
                </button>
              );
            })}
          </div>

          {/* Rooms cleaning lists */}
          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {filteredRooms.map(room => {
              // Get current status color code
              const statusColors = 
                room.status === 'Clean' 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-205'
                  : room.status === 'Dirty'
                    ? 'bg-rose-50 text-rose-700 border-rose-205'
                    : room.status === 'Inspecting'
                      ? 'bg-amber-50 text-amber-700 border-amber-205'
                      : 'bg-slate-100 text-slate-600 border-slate-200';

              return (
                <div key={room.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 transition-colors hover:bg-slate-100/50">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-black text-slate-800 text-xs text-[12.5px]">Room {room.number}</span>
                        <span className="text-[9.5px] font-mono text-slate-500">({room.type})</span>
                      </div>
                      <p className="text-[9.5px] text-slate-400 font-mono">Amenities: {room.amenities.join(', ')}</p>
                    </div>

                    <span className={`px-2 py-0.5 rounded-lg text-[9.5px] font-mono font-bold border ${statusColors}`}>
                      {room.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] border-t border-slate-200/60 pt-2 flex-wrap gap-2">
                    <div className="flex items-center space-x-1 text-slate-500">
                      <span className="font-bold text-[9px] text-slate-400 uppercase tracking-widest font-mono">assigned crew:</span>
                      <span className="font-semibold text-slate-700">{room.housekeeper || 'Ad-Hoc Maid'}</span>
                    </div>

                    {/* Quick status cycle action */}
                    <div className="flex items-center space-x-1">
                      {room.status === 'Dirty' && (
                        <button
                          onClick={() => changeRoomStatus(room.id, 'Inspecting')}
                          className="px-2 py-1 bg-amber-550/10 hover:bg-amber-555/20 border border-amber-200 text-amber-700 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          Start Clean
                        </button>
                      )}
                      {room.status === 'Inspecting' && (
                        <button
                          onClick={() => changeRoomStatus(room.id, 'Clean')}
                          className="px-2 py-1 bg-emerald-550/10 hover:bg-emerald-555/25 border border-emerald-200 text-emerald-700 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          Clear & Sanitize
                        </button>
                      )}
                      {room.status === 'Clean' && (
                        <button
                          onClick={() => changeRoomStatus(room.id, 'Dirty')}
                          className="px-2 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          Mark Dirty
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-150 p-3.5 bg-emerald-500/5 border border-emerald-100 rounded-2xl text-[10px] text-emerald-800 leading-relaxed font-sans">
            <span className="font-mono font-bold uppercase tracking-wider block mb-0.5">Automated Cleaning Dispatch:</span>
            Guests checkout status automatically triggers Room Dirty status alarms. Crew receives SMS dispatch alerts.
          </div>
        </section>

      </div>

      {/* VIP Preferences and Folio CRM Registry */}
      <section className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
              <UserCheck className="w-4 h-4 text-emerald-500" />
              <span>Consolidated CRM Guest Ledger & Room Charging</span>
            </h3>
            <p className="text-[11px] text-slate-450 font-medium">
              Maintain high-end profiles, post POS restaurant charges to guest rooms, and invoice balances.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search guests or rooms..."
              className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-505 rounded-xl px-3.5 py-2 pl-9 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all"
            />
            <Search className="absolute left-3 top-3 w-3.5 h-3.5 text-slate-400" />
          </div>
        </div>

        {/* Guest tables */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-800 text-[10px] font-bold font-mono tracking-wider uppercase">
              <tr>
                <th className="p-4">GUEST / ID</th>
                <th className="p-4 text-center">ROOM</th>
                <th className="p-4">STAY PLAN</th>
                <th className="p-4">SPECIAL PREFERENCES</th>
                <th className="p-4">FOLIO CHARGES BASE</th>
                <th className="p-4 text-right">TOTAL INVOICE balance</th>
                <th className="p-4 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 text-xs text-slate-700">
              {filteredReservations.map(res => {
                const totalChargedVal = res.totalCharge + res.additionalCharges.reduce((sum, item) => sum + item.amount, 0);
                const paymentColors = 
                  res.paymentStatus === 'Paid' 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                    : res.paymentStatus === 'Partial'
                      ? 'bg-amber-50 text-amber-700 border-amber-100'
                      : 'bg-rose-50 text-rose-700 border-rose-100';

                return (
                  <tr key={res.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 shrink-0 font-bold text-[10px] uppercase">
                          {res.guestName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{res.guestName}</p>
                          <p className="text-[10px] text-slate-455 font-mono">{res.guestPhone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className="px-2 py-1 bg-slate-100 border border-slate-200 font-bold text-slate-800 rounded-xl font-mono">
                        Room {res.roomNumber}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="space-y-0.5">
                        <p className="font-medium text-slate-800">
                          {res.checkIn} to {res.checkOut}
                        </p>
                        <p className="text-[9.5px] font-mono text-slate-400">
                          Status: <span className="font-bold text-slate-705 uppercase">{res.status}</span>
                        </p>
                      </div>
                    </td>
                    <td className="p-4 max-w-[240px] truncate" title={res.specialRequests}>
                      <p className="text-[11px] leading-relaxed italic text-slate-500 font-medium">
                        "{res.specialRequests || 'None specify'}"
                      </p>
                    </td>
                    <td className="p-4">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-slate-700">Room rate plus {res.additionalCharges.length} charges</p>
                        <div className="flex flex-wrap gap-1">
                          {res.additionalCharges.slice(0, 2).map((item, idx) => (
                            <span key={idx} className="text-[8px] font-mono bg-indigo-50 text-indigo-700 px-1 py-0.2 border border-indigo-100 rounded" title={item.desc}>
                              +{item.amount}
                            </span>
                          ))}
                          {res.additionalCharges.length > 2 && (
                            <span className="text-[8px] font-mono bg-slate-50 text-slate-550 px-1 py-0.2 border rounded">
                              +{res.additionalCharges.length - 2} more
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="space-y-1">
                        <p className="font-mono text-xs font-black text-slate-850">
                          {formattedCurrencyValue(totalChargedVal)}
                        </p>
                        <span className={`px-2 py-0.5 rounded-lg text-[8.5px] font-mono font-bold border ${paymentColors}`}>
                          {res.paymentStatus}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => setSelectedReservation(res)}
                        className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 hover:text-indigo-600 border border-slate-200 text-slate-600 text-[10.5px] font-bold rounded-xl transition-all cursor-pointer"
                      >
                        Manage Folio
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* DIALOG: VIEW RESERVATION DETAILS & WORK WITH FOLIO INVOICE */}
      {selectedReservation && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setSelectedReservation(null)}
        >
          <div 
            className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden p-6 relative flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-100">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-850 uppercase tracking-tight">
                    Manage guest invoice folio & checkout
                  </h4>
                  <p className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">
                    VOUCHER ID: {selectedReservation.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedReservation(null)}
                className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-150 text-slate-500 font-bold flex items-center justify-center text-xs transition-colors cursor-pointer border-none"
              >
                ✕
              </button>
            </div>

            {/* Scrollable contents */}
            <div className="py-4 space-y-6 overflow-y-auto flex-grow max-h-[65vh] pr-1 scrollbar-thin">
              
              {/* Guest core info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <p className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">Guest CRM Profile</p>
                  <p className="text-sm font-extrabold text-slate-800">{selectedReservation.guestName}</p>
                  <p className="text-xs text-slate-500 font-mono">Mobile: {selectedReservation.guestPhone}</p>
                  
                  <div className="pt-2 border-t border-slate-200 mt-2 space-y-1.5 text-xs">
                    <p className="text-[10.5px] text-slate-600 font-sans">
                      <span className="font-bold text-slate-700 uppercase tracking-tight text-[9px] font-mono block text-slate-450">ID Verification:</span>{' '}
                      {selectedReservation.guestIdType ? (
                        <span className="flex items-center space-x-1.5 mt-0.5">
                          <span className="font-medium">
                            {selectedReservation.guestIdType === 'NIDA' ? '🇹🇿 NIDA (TZ Resident)' : ''}
                            {selectedReservation.guestIdType === 'Passport' ? '✈️ Passport (Non-Citizen)' : ''}
                            {selectedReservation.guestIdType === 'VoterID' ? "🗳️ Voter's ID Card" : ''}
                            {selectedReservation.guestIdType === 'Other' ? '📇 Other Document' : ''}
                          </span>
                          <span className="font-mono bg-slate-200 text-slate-850 px-1.5 py-0.5 rounded text-[10px] font-bold">
                            {selectedReservation.guestIdNumber || 'N/A'}
                          </span>
                        </span>
                      ) : (
                        <span className="italic text-slate-400">Not recorded</span>
                      )}
                    </p>
                    <p className="text-[10.5px] text-slate-600 font-sans">
                      <span className="font-bold text-slate-700 uppercase tracking-tight text-[9px] font-mono block text-slate-450">Origin & Age:</span>{' '}
                      <span className="text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded text-[10px] mt-0.5 inline-block border border-emerald-100 mr-1.5">
                        📍 {selectedReservation.guestOrigin || 'Not recorded'}
                      </span>
                      {selectedReservation.guestAge !== undefined ? (
                        <span className="text-slate-700 font-extrabold bg-slate-100 px-2 py-0.5 rounded text-[10px] mt-0.5 inline-block border border-slate-200">
                          🎂 {selectedReservation.guestAge} yrs
                        </span>
                      ) : null}
                    </p>
                  </div>

                  <p className="text-[11.5px] italic text-slate-550 leading-normal pt-1 block">
                    "Prefs: {selectedReservation.specialRequests}"
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <p className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">Room Allocation Details</p>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-black text-slate-800 bg-white border border-slate-200 px-2 py-0.7 rounded-xl font-mono">
                      Room {selectedReservation.roomNumber}
                    </span>
                    <span className="text-xs text-rose-600 font-bold">Occupied</span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">Check-In date: <span className="font-mono text-slate-700 font-bold">{selectedReservation.checkIn}</span></p>
                  <p className="text-xs text-slate-500 font-medium font-sans">Check-Out plan: <span className="font-mono text-slate-700 font-bold">{selectedReservation.checkOut}</span></p>
                </div>
              </div>

              {/* CRM Invoice detailizer */}
              <div className="space-y-2">
                <p className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">Room Folio Bill detailizer</p>
                <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 font-sans text-xs">
                  <div className="flex justify-between items-center bg-slate-50 p-3 italic text-xs font-mono font-bold text-slate-500">
                    <span>Voucher Particulars</span>
                    <span>Debit Balance</span>
                  </div>
                  
                  {/* Base charge room item */}
                  <div className="flex justify-between items-center p-3 text-slate-700 font-medium">
                    <span>Base Lodging Charge (Room Tarif)</span>
                    <span className="font-mono font-bold text-slate-800">{formattedCurrencyValue(selectedReservation.totalCharge - selectedReservation.additionalCharges.reduce((sum, item) => sum + item.amount, 0))}</span>
                  </div>

                  {/* Addit folio charges */}
                  {selectedReservation.additionalCharges.map((charge, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 text-slate-750 font-medium bg-indigo-50/20">
                      <span className="flex items-center space-x-2">
                        <Utensils className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{charge.desc}</span>
                      </span>
                      <span className="font-mono text-indigo-700 font-bold">+{formattedCurrencyValue(charge.amount)}</span>
                    </div>
                  ))}

                  {/* Grand total */}
                  <div className="flex justify-between items-center p-4 bg-slate-900 text-white font-mono font-bold">
                    <span className="uppercase text-[10.5px] tracking-wide text-teal-400 font-black">Grand Outstanding Folio</span>
                    <span className="text-sm font-black text-white">
                      {formattedCurrencyValue(selectedReservation.totalCharge)}
                    </span>
                  </div>
                </div>
              </div>

              {/* POS restaurant bill poster and dynamic room charge panel */}
              <div id="add-hotel-folio-charge-section" className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
                <div className="space-y-0.5">
                  <p className="text-[10.5px] font-mono text-slate-400 font-bold uppercase tracking-wider">
                    Post restaurant / extra charge to room folio
                  </p>
                  <p className="text-[9.5px] text-slate-455">
                    Connect pool bar POS, restaurant orders, or golf vouchers directly. Charges append instantly to checkout invoice.
                  </p>
                </div>

                <form onSubmit={handleAddFolioCharge} className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-end">
                  <div className="sm:col-span-6 space-y-1">
                    <label className="text-[9.5px] text-slate-455 uppercase font-medium">Charge description (Particular)</label>
                    <input
                      type="text"
                      value={chargeDesc}
                      required
                      placeholder="e.g. Poolside Wine Charging"
                      onChange={(e) => setChargeDesc(e.target.value)}
                      className="w-full bg-white border border-slate-200 focus:border-indigo-505 rounded-xl px-3 py-2 text-xs outline-none"
                    />
                  </div>
                  <div className="sm:col-span-4 space-y-1">
                    <label className="text-[9.5px] text-slate-455 uppercase font-medium">Bill Amount ({activeTenant.currency || 'KSh'})</label>
                    <input
                      type="number"
                      value={chargeAmount}
                      required
                      placeholder="2500"
                      onChange={(e) => setChargeAmount(e.target.value)}
                      className="w-full bg-white border border-slate-200 focus:border-indigo-550 rounded-xl px-3 py-2 text-xs outline-none font-mono"
                    />
                  </div>
                  <button
                    type="submit"
                    className="sm:col-span-2 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold uppercase tracking-longer transition-colors cursor-pointer shadow border-none h-[36px]"
                  >
                    Post charge
                  </button>
                </form>
              </div>

              {/* Direct local checkout using dynamic mobile money integration / manual cash settlement */}
              {selectedReservation.paymentStatus !== 'Paid' && (
                <div className="bg-emerald-500/5 border border-emerald-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      <Smartphone className="w-4 h-4 text-emerald-600" />
                      <p className="text-[10.5px] font-mono text-emerald-800 font-bold uppercase tracking-wider">
                        direct invoice settlement
                      </p>
                    </div>
                    <span className="text-[9px] font-mono font-bold text-rose-600 uppercase px-1.5 py-0.5 bg-rose-50 border border-rose-100 rounded">
                      Unpaid
                    </span>
                  </div>
                  
                  <p className="text-[9.5px] text-slate-500">
                    The final payment must be paid before a room can be provided or checked in. Settle instantly via M-Pesa push or record manual Cash/Card receipt below.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 bg-white/60 p-3 rounded-2xl border border-slate-100">
                    <div className="md:col-span-8 flex flex-col sm:flex-row gap-2 items-center">
                      <input
                        type="tel"
                        value={mPesaPhone}
                        placeholder="M-Pesa phone: e.g. 0722888123"
                        onChange={(e) => {
                          setMPesaPhone(e.target.value);
                          setMPesaTriggered(false);
                        }}
                        className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-3.5 py-1.5 text-xs outline-none font-mono text-emerald-950"
                      />
                      <button
                        type="button"
                        disabled={!mPesaPhone || mPesaStatus === 'pushing'}
                        onClick={triggerMobileMoneySTKPush}
                        className="w-full sm:w-auto px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-505 disabled:opacity-50 text-white font-bold rounded-xl text-[10px] uppercase font-mono tracking-wider transition-all cursor-pointer border-none shadow-sm"
                      >
                        {mPesaStatus === 'pushing' ? 'Requesting...' : 'M-Pesa STK'}
                      </button>
                    </div>

                    <div className="md:col-span-4 flex items-center justify-end border-t md:border-t-0 md:border-l border-slate-250 pt-2.5 md:pt-0 md:pl-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setReservations(prev => prev.map(res => {
                            if (res.id === selectedReservation.id) {
                              return { ...res, paymentStatus: 'Paid' };
                            }
                            return res;
                          }));
                          setSelectedReservation(prev => {
                            if (!prev) return null;
                            return { ...prev, paymentStatus: 'Paid' };
                          });
                          addPmsLog(`[Folio Ledger] Recorded manual Cash/Card Payment of ${formattedCurrencyValue(selectedReservation.totalCharge)} for ${selectedReservation.guestName}`, 'success');
                        }}
                        className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-[10px] uppercase tracking-wider font-mono cursor-pointer transition-colors border-none"
                      >
                        Cash / POS Card
                      </button>
                    </div>
                  </div>

                  {mPesaStatus === 'completed' && (
                    <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200 text-[10px] text-emerald-800 font-mono font-bold animate-fade-in">
                      ✓ Invoice settled! M-Pesa receipt verified.
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Actions Footer */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-sans">
              
              <div className="flex items-center space-x-1.5">
                {selectedReservation.status === 'Reserved' && (
                  <button
                    onClick={() => {
                      if (selectedReservation.paymentStatus !== 'Paid') {
                        addPmsLog(`Check-In Blocked: ${selectedReservation.guestName}'s outstanding invoice must be settled before check-in key handover.`, 'failed');
                        return;
                      }
                      handleUpdateReservationStatus(selectedReservation.id, 'Checked-In');
                    }}
                    disabled={selectedReservation.paymentStatus !== 'Paid'}
                    className={`px-4 py-2 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center space-x-1 border-none ${
                      selectedReservation.paymentStatus === 'Paid'
                        ? 'bg-indigo-600 hover:bg-indigo-500 cursor-pointer'
                        : 'bg-slate-350 text-slate-500 cursor-not-allowed opacity-60'
                    }`}
                    title={selectedReservation.paymentStatus !== 'Paid' ? 'Payment is required before guest can be given a room' : 'Check in guest'}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Check In Guest</span>
                  </button>
                )}

                {selectedReservation.status === 'Checked-In' && (
                  <button
                    onClick={() => handleUpdateReservationStatus(selectedReservation.id, 'Checked-Out')}
                    disabled={selectedReservation.paymentStatus !== 'Paid'}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer border-none flex items-center space-x-1"
                    title={selectedReservation.paymentStatus !== 'Paid' ? 'Please settle folio bill before check out' : 'Check out guest'}
                  >
                    <UserX className="w-3.5 h-3.5 text-rose-455 font-bold" />
                    <span>Process check-out</span>
                  </button>
                )}

                {selectedReservation.paymentStatus !== 'Paid' && (
                  <span className="text-[10px] font-mono text-rose-600 font-bold bg-rose-50 px-2 py-1 rounded border border-rose-150 flex items-center space-x-1 animate-pulse">
                    <span>⚠️ Settle remaining balance first to assign room keys</span>
                  </span>
                )}
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={() => setSelectedReservation(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer border-none"
                >
                  Close panel
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* DIALOG: RECORD NEW BOOKING / CALENDAR RESERVATION */}
      {isNewBookingModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsNewBookingModalOpen(false)}
        >
          <div 
            className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden p-6 relative flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="text-sm font-black text-slate-850 uppercase tracking-tight flex items-center space-x-1.5">
                <Bed className="w-4 h-4 text-emerald-500" />
                <span>Schedule New Guest Stay</span>
              </h4>
              <button
                onClick={() => setIsNewBookingModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-500 font-bold flex items-center justify-center text-xs transition-colors cursor-pointer border-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBooking} className="py-4 space-y-4">
              <div className="grid grid-cols-2 gap-35">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block font-mono">Assigned Room</label>
                  <select
                    value={assignedRoom}
                    onChange={(e) => setAssignedRoom(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none cursor-pointer"
                  >
                    {rooms.map(room => (
                      <option key={room.id} value={room.number}>
                        Room {room.number} ({room.type})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-1 border-l border-slate-150 pl-3">
                  <label className="text-[10px] font-bold text-slate-550 uppercase block font-mono">Active surcharges</label>
                  <div className="text-xs font-mono font-bold text-emerald-650 pt-1">
                    x{surgeMultiplier.toFixed(2)} {dynamicPricingApplied ? '(SURGE ACTION)' : '(Default)'}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase block font-mono">Guest Full Name</label>
                <input
                  type="text"
                  required
                  value={guestName}
                  placeholder="e.g. Faith Mwende"
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-505 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase block font-mono">Guest Mobile Phone</label>
                <input
                  type="tel"
                  required
                  value={guestPhone}
                  placeholder="e.g. +254 722 888 123"
                  onChange={(e) => setGuestPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-505 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block font-mono">ID verification type</label>
                  <select
                    value={guestIdType}
                    onChange={(e) => setGuestIdType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="NIDA">National ID (NIDA - TZ Resident)</option>
                    <option value="Passport">Passport Number (Non-Citizen)</option>
                    <option value="VoterID">Voter's ID Card (No NIDA)</option>
                    <option value="Other">Other / Not Listed ID</option>
                  </select>
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block font-mono">ID Document Code</label>
                  <input
                    type="text"
                    required
                    value={guestIdNumber}
                    placeholder={
                      guestIdType === 'NIDA' ? '19900101-XXXX-XXXX' :
                      guestIdType === 'Passport' ? 'TZ-P129XX8' :
                      guestIdType === 'VoterID' ? 'VOT-992-102' : 'ID-887711'
                    }
                    onChange={(e) => setGuestIdNumber(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-505 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block font-mono">Guest Origin / Physical Location</label>
                  <input
                    type="text"
                    required
                    value={guestOrigin}
                    placeholder="Where is customer from (e.g. Arusha, TZ)"
                    onChange={(e) => setGuestOrigin(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-505 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block font-mono">Age (Years)</label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    required
                    value={guestAge}
                    placeholder="e.g. 28"
                    onChange={(e) => setGuestAge(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-505 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block font-mono">Check-In Date</label>
                  <input
                    type="date"
                    required
                    value={checkInDate}
                    onChange={(e) => setCheckInDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-505 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none font-mono"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block font-mono">Check-Out Date</label>
                  <input
                    type="date"
                    required
                    value={checkOutDate}
                    onChange={(e) => setCheckOutDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-550 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase block font-mono">Special Requests / Preferences</label>
                <textarea
                  value={specialRequests}
                  placeholder="Guest notes..."
                  rows={2}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-505 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none resize-none font-sans"
                />
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block font-bold">Inital Lodging Pay invoice</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentChoice('Paid')}
                    className={`py-1.5 px-3 rounded-xl border text-[11px] font-mono text-center font-bold transition-all cursor-pointer ${
                      paymentChoice === 'Paid' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-400' 
                        : 'bg-slate-50 text-slate-500 border-slate-200'
                    }`}
                  >
                    Pre-Paid settled
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentChoice('Unpaid')}
                    className={`py-1.5 px-3 rounded-xl border text-[11px] font-mono text-center font-bold transition-all cursor-pointer ${
                      paymentChoice === 'Unpaid' 
                        ? 'bg-rose-50 text-rose-700 border-rose-300' 
                        : 'bg-slate-50 text-slate-505 border-slate-200'
                    }`}
                  >
                    Pay at Checkout (Due)
                  </button>
                </div>
              </div>

              <div className="pt-4 flex space-x-2">
                <button
                  type="button"
                  onClick={() => setIsNewBookingModalOpen(false)}
                  className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer border-none text-center"
                >
                  Cancel
                </button>
                
                <button
                  type="submit"
                  className="w-1/2 py-3 bg-emerald-600 hover:bg-emerald-505 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border-none shadow text-center"
                >
                  Register Stay Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
