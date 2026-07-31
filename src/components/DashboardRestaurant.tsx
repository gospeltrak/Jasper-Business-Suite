import React, { useState } from 'react';
import { Tenant, User, Sale, SaleItem } from '../types';
import { 
  Printer,
  MessageSquare,
  CreditCard,
  Receipt,
  FileText,
  CheckCircle2,
  Utensils, 
  Clock, 
  Plus, 
  Trash2, 
  CheckCircle, 
  Smartphone, 
  Database, 
  Users, 
  AlertCircle, 
  Search, 
  Layers, 
  X, 
  ChefHat, 
  Coins, 
  ShieldAlert, 
  RefreshCw,
  Bell,
  Award,
  BookOpen,
  Clipboard,
  Smartphone as PhoneIcon,
  Sparkles,
  ShoppingBag,
  BellRing,
  RotateCcw,
  Calendar,
  Truck,
  Activity
} from 'lucide-react';

interface DashboardRestaurantProps {
  activeTenant: Tenant;
  currentUser: User;
  onAddSyncLog?: (log: { id: string; timestamp: string; action: string; category: 'pms' | 'ledger' | 'sync'; status: 'success' | 'failed' | 'pending'; details: string }) => void;
  onAddSale?: (sale: Sale) => void;
}

interface MenuItem {
  id: string;
  name: string;
  category: 'Appetizers' | 'Mains' | 'Drinks' | 'Desserts';
  price: number;
  prepTime: number; 
  available: boolean;
  ingredients: string;
}

interface OrderItem {
  menuItemId: string;
  name: string;
  price: number;
  qty: number;
  notes?: string;
}

interface RestaurantOrder {
  id: string;
  tableId: string;
  waiterName: string;
  items: OrderItem[];
  extraServiceCharge: number;
  paymentStatus: 'Unpaid' | 'Paid';
  paymentMethod?: 'Cash' | 'Card' | 'M-Pesa';
  mPesaPhone?: string;
  totalBill: number;
  customerId?: string; 
  status: 'pending' | 'preparing' | 'ready' | 'delivered';
  orderSource?: 'Cashier Till' | 'Waiter Device' | 'QR Code';
  comments?: string;
  isCancelled?: boolean;
  cancelledReason?: string;
  isDelivery?: boolean;
  deliveryDetails?: {
    address: string;
    riderName: string;
    riderPhone: string;
    deliveryCost: number;
    status: 'Pending' | 'Dispatched' | 'Delivered' | 'Cancelled';
  };
}

interface TableReservation {
  id: string;
  customerName: string;
  customerPhone: string;
  tableId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  status: 'Pending' | 'Active' | 'Completed' | 'Cancelled';
  notes?: string;
  guestCount: number;
}

interface DiningTable {
  id: string;
  capacity: number;
  status: 'Available' | 'Occupied' | 'Awaiting Food' | 'Dirty' | 'Reserved';
  currentOrderId?: string;
  waiterName?: string;
  guestCount?: number;
}

interface KitchenTicket {
  id: string;
  tableId: string;
  orderId: string;
  itemsSummary: string;
  status: 'Queued' | 'Cooking' | 'Ready' | 'Served';
  elapsedMins: number;
  chefAssignee: string;
}

interface CustomerLoyalty {
  id: string;
  name: string;
  phone: string;
  loyaltyPoints: number;
  visitCount: number;
  lifetimeSpend: number;
}

interface RawIngredient {
  name: string;
  stock: number;
  unit: string;
}

interface WaiterAlert {
  id: string;
  title: string;
  time: string;
  tableId: string;
  items: string;
  read: boolean;
}

export default function DashboardRestaurant({ activeTenant, currentUser, onAddSyncLog, onAddSale }: DashboardRestaurantProps) {
  // --- SUBTAB VIEW STATS ---
  const [activeSubTab, setActiveSubTab] = useState<'tables' | 'kds' | 'menu' | 'loyalty' | 'waiter' | 'sql' | 'reservations' | 'deliveries'>('tables');
  
  // --- DATABASE & SIMULATION STATES ---
  const [menuItems, setMenuItems] = useState<MenuItem[]>([
    { id: 'MN-1', name: 'Kuku Choma (Flame Grilled Half Chicken)', category: 'Mains', price: 22000, prepTime: 25, available: true, ingredients: '0.5 Chicken, 0.4kg Potatoes' },
    { id: 'MN-2', name: 'Nyama Choma Combo Platter', category: 'Mains', price: 34000, prepTime: 30, available: true, ingredients: '1.2kg Goat Meat, 0.8kg Potatoes' },
    { id: 'MN-3', name: 'Chips Mayai Special Extra', category: 'Appetizers', price: 8500, prepTime: 12, available: true, ingredients: '3 Eggs, 0.35kg Potatoes' },
    { id: 'MN-4', name: 'Spiced Pilau Rice with Goat', category: 'Mains', price: 18000, prepTime: 20, available: true, ingredients: '0.3kg Basmati, 0.25kg Goat Meat' },
    { id: 'MN-5', name: 'Samaki wa Kupaka (Swahili Tilapia)', category: 'Mains', price: 26000, prepTime: 22, available: true, ingredients: '1 Snapper Catch, 0.5L Coconut Paste' },
    { id: 'MN-6', name: 'Fresh Hibiscus & Passion Pitcher', category: 'Drinks', price: 8000, prepTime: 5, available: true, ingredients: '1L Hibiscus Extract' }
  ]);

  const [tables, setTables] = useState<DiningTable[]>([
    { id: 'Table 1', capacity: 2, status: 'Occupied', currentOrderId: 'ORD-801', waiterName: 'Kofi', guestCount: 2 },
    { id: 'Table 2', capacity: 4, status: 'Dirty', waiterName: 'Grace' },
    { id: 'Table 3', capacity: 6, status: 'Reserved', waiterName: 'Grace' },
    { id: 'Table 4', capacity: 2, status: 'Available' },
    { id: 'Table 5', capacity: 8, status: 'Occupied', currentOrderId: 'ORD-804', waiterName: 'Kofi', guestCount: 6 },
    { id: 'Table 6', capacity: 4, status: 'Available' }
  ]);

  const [orders, setOrders] = useState<RestaurantOrder[]>([
    {
      id: 'ORD-801',
      tableId: 'Table 1',
      waiterName: 'Kofi',
      items: [
        { menuItemId: 'MN-3', name: 'Chips Mayai Special Extra', price: 8500, qty: 1, notes: 'Extra pepper' },
        { menuItemId: 'MN-6', name: 'Fresh Hibiscus & Passion Pitcher', price: 8000, qty: 1 }
      ],
      extraServiceCharge: 825,
      paymentStatus: 'Unpaid',
      totalBill: 17325,
      status: 'preparing'
    },
    {
      id: 'ORD-804',
      tableId: 'Table 5',
      waiterName: 'Kofi',
      items: [
        { menuItemId: 'MN-1', name: 'Kuku Choma (Flame Grilled Half Chicken)', price: 22000, qty: 2 },
        { menuItemId: 'MN-2', name: 'Nyama Choma Combo Platter', price: 34000, qty: 1 }
      ],
      extraServiceCharge: 3900,
      paymentStatus: 'Unpaid',
      totalBill: 81900,
      status: 'preparing'
    }
  ]);

  const [tickets, setTickets] = useState<KitchenTicket[]>([
    { id: 'TKT-101', tableId: 'Table 1', orderId: 'ORD-801', itemsSummary: '1x Chips Mayai (Extra pepper), 1x Hibiscus Pitcher', status: 'Cooking', elapsedMins: 4, chefAssignee: 'Line Cook Juma' },
    { id: 'TKT-102', tableId: 'Table 5', orderId: 'ORD-804', itemsSummary: '2x Kuku Choma, 1x Nyama Choma Platter', status: 'Queued', elapsedMins: 2, chefAssignee: 'Sous Chef Grace' }
  ]);

  const [loyaltyDb, setLoyaltyDb] = useState<CustomerLoyalty[]>([
    { id: 'CUST-101', name: 'Salama Hadija', phone: '0711223344', loyaltyPoints: 240, visitCount: 8, lifetimeSpend: 195000 },
    { id: 'CUST-102', name: 'Juma Bakari', phone: '0755998877', loyaltyPoints: 150, visitCount: 5, lifetimeSpend: 112000 },
    { id: 'CUST-103', name: 'Fatma Omary', phone: '0777443322', loyaltyPoints: 30, visitCount: 1, lifetimeSpend: 24000 }
  ]);

  const [inventory, setInventory] = useState<RawIngredient[]>([
    { name: 'Local Chicken', stock: 50.00, unit: 'units' },
    { name: 'Fresh Potatoes', stock: 200.00, unit: 'kg' },
    { name: 'Organic Eggs', stock: 350.00, unit: 'units' },
    { name: 'Goat Meat Tender', stock: 120.00, unit: 'kg' },
    { name: 'Coconut Rich Paste', stock: 80.00, unit: 'liters' },
    { name: 'Snapper Catch', stock: 60.00, unit: 'units' },
    { name: 'Basmati Rice', stock: 150.00, unit: 'kg' },
    { name: 'Hibiscus Flower Extract', stock: 50.00, unit: 'liters' }
  ]);

  const [alerts, setAlerts] = useState<WaiterAlert[]>([
    { id: 'ALT-1', title: 'Food Ready for Run', time: '18:12', tableId: 'Table 1', items: 'Chips Mayai Special Extra', read: false }
  ]);

  // Recipe requirements map
  const [recipeBook, setRecipeBook] = useState<Record<string, { name: string; quantity: number }[]>>({
    'MN-1': [
      { name: 'Local Chicken', quantity: 0.5 },
      { name: 'Fresh Potatoes', quantity: 0.4 }
    ],
    'MN-2': [
      { name: 'Goat Meat Tender', quantity: 1.2 },
      { name: 'Fresh Potatoes', quantity: 0.8 }
    ],
    'MN-3': [
      { name: 'Organic Eggs', quantity: 3 },
      { name: 'Fresh Potatoes', quantity: 0.35 }
    ],
    'MN-4': [
      { name: 'Basmati Rice', quantity: 0.3 },
      { name: 'Goat Meat Tender', quantity: 0.25 }
    ],
    'MN-5': [
      { name: 'Snapper Catch', quantity: 1 },
      { name: 'Coconut Rich Paste', quantity: 0.5 }
    ],
    'MN-6': [
      { name: 'Hibiscus Flower Extract', quantity: 1 }
    ]
  });

  // --- LOCAL NAVIGATION STATS ---
  const [selectedTable, setSelectedTable] = useState<DiningTable | null>(tables[0]);
  const [posWaiterName, setPosWaiterName] = useState('Kofi');
  const [guestCountInput, setGuestCountInput] = useState('2');
  const [activeOrderItems, setActiveOrderItems] = useState<OrderItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'Appetizers' | 'Mains' | 'Drinks' | 'Desserts'>('All');

  // --- NEW: MANAGEMENT REAL-TIME TABLE RADAR OVERLAY STATE ---
  const [inspectingTable, setInspectingTable] = useState<DiningTable | null>(null);
  const [mgmtCommentInput, setMgmtCommentInput] = useState('');
  
  // --- NEW: CASHIER REGISTER TILL VS QR ORDER SOURCE STATE ---
  const [selectedOrderSource, setSelectedOrderSource] = useState<'Cashier Till' | 'Waiter Device' | 'QR Code'>('Cashier Till');

  // --- NEW: RESTAURANT TABLE RESERVATIONS / BOOKING PM PLANNER ---
  const [reservations, setReservations] = useState<TableReservation[]>([
    { id: 'RES-301', customerName: 'Zuwena Khamis', customerPhone: '0712345678', tableId: 'Table 3', date: '2026-05-29', time: '19:30', status: 'Pending', guestCount: 4, notes: 'Window view preferred' },
    { id: 'RES-302', customerName: 'Baraka Machano', customerPhone: '0754898912', tableId: 'Table 1', date: '2026-05-29', time: '13:00', status: 'Active', guestCount: 2, notes: 'Celebrating anniversary' },
    { id: 'RES-303', customerName: 'Amani Mtambo', customerPhone: '0789121234', tableId: 'Table 5', date: '2026-05-30', time: '20:00', status: 'Pending', guestCount: 6, notes: 'Needs high chairs' }
  ]);
  const [newResName, setNewResName] = useState('');
  const [newResPhone, setNewResPhone] = useState('');
  const [newResTable, setNewResTable] = useState('Table 1');
  const [newResDate, setNewResDate] = useState('2026-05-29');
  const [newResTime, setNewResTime] = useState('19:00');
  const [newResNotes, setNewResNotes] = useState('');
  const [newResGuestCount, setNewResGuestCount] = useState('2');

  // --- NEW: DELIVERY DISPATCH STATE ---
  const [deliveryOrders, setDeliveryOrders] = useState<RestaurantOrder[]>([
    {
      id: 'ORD-DEL-101',
      tableId: 'Delivery',
      waiterName: 'Cashier Till Dispatcher',
      items: [
        { menuItemId: 'MN-1', name: 'Kuku Choma (Flame Grilled Half Chicken)', price: 22000, qty: 1 },
        { menuItemId: 'MN-6', name: 'Fresh Hibiscus & Passion Pitcher', price: 8000, qty: 1 }
      ],
      extraServiceCharge: 1500,
      paymentStatus: 'Unpaid',
      totalBill: 33500, // 30000 + 1500 (extra) + 2000 delivery
      status: 'preparing',
      orderSource: 'Cashier Till',
      isDelivery: true,
      comments: 'Please include extra chili sauce packets.',
      deliveryDetails: {
        address: 'Kinondoni Block 4, House 12, Dar es Salaam',
        riderName: 'Iddi Driver',
        riderPhone: '0711559900',
        deliveryCost: 2000,
        status: 'Pending'
      }
    },
    {
      id: 'ORD-DEL-102',
      tableId: 'Delivery',
      waiterName: 'QR Customer Portal',
      items: [
        { menuItemId: 'MN-3', name: 'Chips Mayai Special Extra', price: 8500, qty: 2 }
      ],
      extraServiceCharge: 850,
      paymentStatus: 'Paid',
      totalBill: 19850, // 17000 + 850 + 2000
      status: 'delivered',
      orderSource: 'QR Code',
      isDelivery: true,
      deliveryDetails: {
        address: 'Msasani Peninsula, Apartment 3B',
        riderName: 'Faraji Rider',
        riderPhone: '0788334455',
        deliveryCost: 2000,
        status: 'Delivered'
      }
    }
  ]);
  const [deliveryCustomerName, setDeliveryCustomerName] = useState('');
  const [deliveryCustomerPhone, setDeliveryCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryRider, setDeliveryRider] = useState('Iddi Driver');
  const [deliveryRiderPhone, setDeliveryRiderPhone] = useState('0711559900');
  const [deliveryCostVal, setDeliveryCostVal] = useState('2000');
  const [isDeliveryOrder, setIsDeliveryOrder] = useState(false);
  const [selectedDeliveryTab, setSelectedDeliveryTab] = useState<'all' | 'pending' | 'dispatched' | 'delivered'>('all');
  
  // Client Money details
  const [mPesaPhoneInput, setMPesaPhoneInput] = useState('');
  const [mPesaStatus, setMPesaStatus] = useState<'idle' | 'pushing' | 'completed'>('idle');

  // New Loyalty Customer Form
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');

  // --- MENU MANAGEMENT STATES ---
  const [menuSearch, setMenuSearch] = useState('');
  const [menuFilterCategory, setMenuFilterCategory] = useState<'All' | 'Appetizers' | 'Mains' | 'Drinks' | 'Desserts'>('All');
  
  // New Dish Form
  const [newDishName, setNewDishName] = useState('');
  const [newDishCategory, setNewDishCategory] = useState<'Appetizers' | 'Mains' | 'Drinks' | 'Desserts'>('Mains');
  const [newDishPrice, setNewDishPrice] = useState('');
  const [newDishPrepTime, setNewDishPrepTime] = useState('15');
  const [newDishRecipes, setNewDishRecipes] = useState<Record<string, number>>({}); // ingredient_name -> quantity
  
  // Developer SQL copy stats
  const [sqlCopied, setSqlCopied] = useState(false);

  // --- SCAN-TO-ORDER COMPONENT SIMULATOR ---
  const [phoneSimTable, setPhoneSimTable] = useState<string>('Table 4');
  const [phoneLoyaltyPhone, setPhoneLoyaltyPhone] = useState('');
  const [phoneActiveCustomer, setPhoneActiveCustomer] = useState<CustomerLoyalty | null>(null);
  const [phoneCart, setPhoneCart] = useState<OrderItem[]>([]);
  const [phoneRegisteredName, setPhoneRegisteredName] = useState('');
  const [phoneRegistering, setPhoneRegistering] = useState(false);
  const [phoneMpesaPhone, setPhoneMpesaPhone] = useState('');
  const [phoneOrderState, setPhoneOrderState] = useState<'browse' | 'cart' | 'placed' | 'paid'>('browse');

  // Logs state
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    'System: Restaurant operations system initialized.',
    'System: Relational tables structure ready for local test-bed.'
  ]);

  // --- RESTAURANT CHECKOUT & RECEIPT POPUP STATE ENGINE ---
  const [restaurantVatStatus, setRestaurantVatStatus] = useState<'vat' | 'non-vat'>('non-vat');
  const [restaurantPayMethod, setRestaurantPayMethod] = useState<'Cash' | 'Mobile Money' | 'Bank'>('Cash');
  const [restaurantReceiptSale, setRestaurantReceiptSale] = useState<Sale | null>(null);
  const [isRestaurantReceiptOpen, setIsRestaurantReceiptOpen] = useState(false);
  const [restaurantReceiptPhone, setRestaurantReceiptPhone] = useState('');

  const addTerminalLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setTerminalLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 30));
  };

  const currencyValue = (val: number) => {
    return `${activeTenant.currency} ${val.toLocaleString()}`;
  };

  // --- INVENTORY INGREDIENT DEDUCTOR HELPERS ---
  const deductStockForOrderItems = (items: OrderItem[]) => {
    setInventory(prev => {
      const updated = [...prev];
      items.forEach(item => {
        const ingredients = recipeBook[item.menuItemId];
        if (ingredients) {
          ingredients.forEach(needed => {
            const index = updated.findIndex(idx => idx.name.toLowerCase() === needed.name.toLowerCase());
            if (index !== -1) {
              const currentStock = updated[index].stock;
              const quantityToDeduct = needed.quantity * item.qty;
              updated[index].stock = Math.max(0, parseFloat((currentStock - quantityToDeduct).toFixed(2)));
              addTerminalLog(`Recipe reduction: Deducted ${quantityToDeduct} ${updated[index].unit} of ${needed.name} for ${item.name}`);
            }
          });
        }
      });
      return updated;
    });
  };

  // SQL code for export
  const supabaseSqlSchema = `-- PostgreSQL relational schema script for Supabase
-- Core database structures for high-fidelity restaurant companion
-- Handles persistent tables, indexes, and an automatic recipe stock deduction trigger

-- Enable standard uuid generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create CUSTOMERS table (phone loyalties)
CREATE TABLE public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) UNIQUE NOT NULL,
    loyalty_points INTEGER DEFAULT 0 NOT NULL,
    visit_count INTEGER DEFAULT 0 NOT NULL,
    lifetime_spend NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 2. Create MENU_ITEMS table
CREATE TABLE public.menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    category VARCHAR(100) NOT NULL,
    picture_url VARCHAR(500),
    prep_time_minutes INTEGER DEFAULT 15 NOT NULL,
    is_available BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 3. Create INVENTORY table (raw ingredient counts)
CREATE TABLE public.inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ingredient_name VARCHAR(255) UNIQUE NOT NULL,
    stock_quantity NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    unit_of_measure VARCHAR(50) NOT NULL,
    minimum_threshold NUMERIC(10, 2) DEFAULT 5.00 NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 4. Create PRODUCT_RECIPES table (links meals to inventory ingredients)
CREATE TABLE public.product_recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
    ingredient_name VARCHAR(255) NOT NULL REFERENCES public.inventory(ingredient_name) ON DELETE RESTRICT,
    required_quantity NUMERIC(10, 3) NOT NULL,
    unit_of_measure VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT unique_menu_ingredient UNIQUE (menu_item_id, ingredient_name)
);

-- 5. Create ORDERS table with status and bill
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_number VARCHAR(50) NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    total_bill NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' NOT NULL, -- 'pending', 'preparing', 'ready', 'delivered'
    payment_status VARCHAR(50) DEFAULT 'unpaid' NOT NULL, -- 'unpaid', 'paid'
    payment_method VARCHAR(100), -- 'M-Pesa', 'Cash', 'Card'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT valid_order_status CHECK (status IN ('pending', 'preparing', 'ready', 'delivered')),
    CONSTRAINT valid_payment_status CHECK (payment_status IN ('unpaid', 'paid'))
);

-- 6. Create ORDER_ITEMS links
CREATE TABLE public.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE RESTRICT,
    quantity INTEGER DEFAULT 1 NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT positive_quantity CHECK (quantity > 0)
);

-- 7. Trigger to automatically deduct ingredients from inventory when an order_item is sold
CREATE OR REPLACE FUNCTION public.deduct_recipe_inventory_on_order()
RETURNS TRIGGER AS $$
DECLARE
    recipe_row RECORD;
BEGIN
    FOR recipe_row IN 
        SELECT ingredient_name, required_quantity 
        FROM public.product_recipes 
        WHERE menu_item_id = NEW.menu_item_id
    LOOP
        UPDATE public.inventory
        SET stock_quantity = stock_quantity - (recipe_row.required_quantity * NEW.quantity),
            updated_at = CURRENT_TIMESTAMP
        WHERE ingredient_name = recipe_row.ingredient_name;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_deduct_recipe_inventory
AFTER INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.deduct_recipe_inventory_on_order();

-- 8. Trigger to credit points to customers automatically upon successful payment
CREATE OR REPLACE FUNCTION public.credit_customer_loyalty_points()
RETURNS TRIGGER AS $$
DECLARE
    earned_points INTEGER;
BEGIN
    IF NEW.payment_status = 'paid' AND OLD.payment_status = 'unpaid' AND NEW.customer_id IS NOT NULL THEN
        -- Earn 1 point per 1,000 Shilling / Currency units
        earned_points := FLOOR(NEW.total_bill / 1000);
        UPDATE public.customers
        SET visit_count = visit_count + 1,
            lifetime_spend = lifetime_spend + NEW.total_bill,
            loyalty_points = loyalty_points + earned_points
        WHERE id = NEW.customer_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_credit_customer_loyalty
AFTER UPDATE OF payment_status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.credit_customer_loyalty_points();

-- 9. Practical Indexes for fast loading
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_customers_phone ON public.customers(phone);
CREATE INDEX idx_recipes_menu ON public.product_recipes(menu_item_id);`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(supabaseSqlSchema);
    setSqlCopied(true);
    addTerminalLog('Developer Action: Copied Supabase SQL code to clipboard.');
    setTimeout(() => setSqlCopied(false), 2000);
  };

  // --- LOYALTY REGISTER ACTION HANDLERS ---
  const handleEnrollCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName || !newCustPhone) return;
    
    const existing = loyaltyDb.find(c => c.phone === newCustPhone);
    if (existing) {
      addTerminalLog(`Loyalty Alert: Number ${newCustPhone} is already enrolled to ${existing.name}`);
      return;
    }

    const newCust: CustomerLoyalty = {
      id: `CUST-${Math.floor(Math.random() * 900) + 100}`,
      name: newCustName,
      phone: newCustPhone,
      loyaltyPoints: 10,
      visitCount: 1,
      lifetimeSpend: 0
    };

    setLoyaltyDb(prev => [...prev, newCust]);
    addTerminalLog(`Success: Enrolled ${newCust.name} in Loyalty Rewards! Granted 10 startup bonus points.`);
    setNewCustName('');
    setNewCustPhone('');
  };

  // --- POS ORDER SUBMISSION HANDLERS ---
  const handleAddPosItem = (dish: MenuItem) => {
    setActiveOrderItems(prev => {
      const existing = prev.find(i => i.menuItemId === dish.id);
      if (existing) {
        return prev.map(i => i.menuItemId === dish.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { menuItemId: dish.id, name: dish.name, price: dish.price, qty: 1 }];
    });
  };

  const handleUpdatePosQty = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      setActiveOrderItems(prev => prev.filter(i => i.menuItemId !== itemId));
    } else {
      setActiveOrderItems(prev => prev.map(i => i.menuItemId === itemId ? { ...i, qty: newQty } : i));
    }
  };

  const handleSubmitPosOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeOrderItems.length === 0) return;

    const isDel = isDeliveryOrder;
    const newOrdId = isDel
      ? `ORD-DEL-${Math.floor(Math.random() * 800) + 100}`
      : `ORD-${Math.floor(Math.random() * 900) + 100}`;
    
    const subtotal = activeOrderItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const serviceFee = Math.round(subtotal * 0.05);
    const delCost = isDel ? (parseFloat(deliveryCostVal) || 0) : 0;
    const totalWithSvc = subtotal + serviceFee + delCost;

    const newOrder: RestaurantOrder = {
      id: newOrdId,
      tableId: isDel ? 'Delivery' : (selectedTable?.id || 'Delivery'),
      waiterName: isDel ? 'Delivery Station' : posWaiterName,
      items: activeOrderItems,
      extraServiceCharge: serviceFee,
      paymentStatus: 'Unpaid',
      totalBill: totalWithSvc,
      status: 'pending',
      orderSource: selectedOrderSource,
      isDelivery: isDel,
      comments: mgmtCommentInput || undefined,
      deliveryDetails: isDel ? {
        address: deliveryAddress || 'No Address Provided',
        riderName: deliveryRider || 'Iddi Driver',
        riderPhone: deliveryRiderPhone || '0711559900',
        deliveryCost: delCost,
        status: 'Pending'
      } : undefined
    };

    if (isDel) {
      setDeliveryOrders(prev => [newOrder, ...prev]);
      addTerminalLog(`Delivery Service: Placed delivery order ${newOrdId} for ${deliveryCustomerName || 'Guest'}. Dispatching...`);
    } else {
      if (!selectedTable) return;
      setOrders(prev => [...prev, newOrder]);
      // Update table state
      setTables(prev => prev.map(t => t.id === selectedTable.id ? {
        ...t,
        status: 'Awaiting Food',
        currentOrderId: newOrdId,
        waiterName: posWaiterName,
        guestCount: parseInt(guestCountInput) || 2
      } : t));
      addTerminalLog(`POS Order placed for ${selectedTable.id} (${newOrdId}). Transmitted to KDS.`);
    }
    
    // Create KDS ticket
    const summary = activeOrderItems.map(i => `${i.qty}x ${i.name}${i.notes ? ` (${i.notes})` : ''}`).join(', ');
    const newTkt: KitchenTicket = {
      id: `TKT-${Math.floor(Math.random() * 900) + 100}`,
      tableId: isDel ? '🛵 Delivery' : (selectedTable?.id || 'Table'),
      orderId: newOrdId,
      itemsSummary: isDel ? `🛵 [DELIVERY] ${summary}` : summary,
      status: 'Queued',
      elapsedMins: 1,
      chefAssignee: 'Line Cook Juma'
    };
    setTickets(prev => [...prev, newTkt]);

    // Central sales tracker fallback
    if (isDel && onAddSale) {
      // If paid list is needed, centralize it here or upon dispatch checkout
    }

    // Cleanup form states
    setActiveOrderItems([]);
    setMgmtCommentInput('');
    setDeliveryCustomerName('');
    setDeliveryCustomerPhone('');
    setDeliveryAddress('');
    setIsDeliveryOrder(false);
  };

  // --- INTEGRATED RESTAURANT CHECKOUT & SQUEEZE STOCK OUTLET ---
  const handleRestaurantCheckoutSubmit = (orderId: string) => {
    const tktOrder = orders.find(o => o.id === orderId);
    if (!tktOrder) return;

    // Recalculate bill based on dynamic compliance choice (vat vs non-vat)
    const baseItemsSum = tktOrder.items.reduce((sum, it) => sum + (it.price * it.qty), 0);
    // Surcharge is 5%
    const serviceFee = Math.round(baseItemsSum * 0.05);
    const taxAmt = restaurantVatStatus === 'vat' ? Math.round(baseItemsSum * activeTenant.taxRate) : 0;
    const finalTotal = baseItemsSum + serviceFee + taxAmt;

    // Deduct stock for all ordered items
    tktOrder.items.forEach(it => {
      const requiredIngredients = recipeBook[it.menuItemId];
      if (requiredIngredients) {
        setInventory(prev => prev.map(invItem => {
          const matchedIng = requiredIngredients.find(ri => ri.name === invItem.name);
          if (matchedIng) {
            return {
              ...invItem,
              stock: Math.max(0, invItem.stock - (matchedIng.quantity * it.qty))
            };
          }
          return invItem;
        }));
      }
    });

    // Update the local orders database
    setOrders(prev => prev.map(o => o.id === orderId ? {
      ...o,
      paymentStatus: 'Paid',
      paymentMethod: restaurantPayMethod === 'Mobile Money' ? 'Mobile Money' : (restaurantPayMethod === 'Bank' ? 'Bank' : 'Cash'),
      totalBill: finalTotal
    } : o));

    // Clear the dining table status and make it dirty for cleaning
    setTables(prev => prev.map(t => t.id === tktOrder.tableId ? {
      ...t,
      status: 'Dirty',
      currentOrderId: undefined,
      waiterName: undefined,
      guestCount: undefined
    } : t));

    // Compile Sale items for the global unified ledger
    const saleItems: SaleItem[] = tktOrder.items.map(it => ({
      productId: it.menuItemId,
      productName: it.name,
      qty: it.qty,
      price: it.price,
      discount: 0,
      discountType: 'percent'
    }));

    const newSale: Sale = {
      id: 'sl-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
      items: saleItems,
      total: finalTotal,
      tax: taxAmt,
      deliveryCost: 0,
      discount: 0,
      discountType: 'percent',
      paymentMethod: restaurantPayMethod,
      reference: Math.random().toString(36).substring(2, 8).toUpperCase(),
      tenantId: activeTenant.id,
      timestamp: new Date().toISOString(),
      syncStatus: 'synced',
      cashierName: currentUser.name || 'Waiter Station',
      customerName: 'Table Guest (' + tktOrder.tableId + ')',
      customerPhone: mPesaPhoneInput || undefined,
      staffName: tktOrder.waiterName,
      vatStatus: restaurantVatStatus,
    };

    // Trigger loyalty credit if a matching customer phone is supplied
    if (mPesaPhoneInput) {
      const matchLoyal = loyaltyDb.find(c => c.phone === mPesaPhoneInput);
      if (matchLoyal) {
        setLoyaltyDb(prev => prev.map(c => c.id === matchLoyal.id ? {
          ...c,
          visitCount: c.visitCount + 1,
          loyaltyPoints: c.loyaltyPoints + Math.floor(finalTotal / 1000),
          lifetimeSpend: c.lifetimeSpend + finalTotal
        } : c));
        addTerminalLog(`Loyalty Account credited for ${matchLoyal.name}! Received ${Math.floor(finalTotal / 1000)} points.`);
      }
    }

    // Call onAddSale to push it to the central general ledger
    if (onAddSale) {
      onAddSale(newSale);
    }

    // Set active receipt states to open the modal
    setRestaurantReceiptSale(newSale);
    setIsRestaurantReceiptOpen(true);
    setRestaurantReceiptPhone(mPesaPhoneInput || '');

    addTerminalLog(`✓ Table Settle: ${tktOrder.tableId} bill finalized (${currencyValue(finalTotal)}). Receipt pop-up displayed.`);
  };

  // Mark table as clean
  const handleClearTableAndCheckout = (tableId: string) => {
    setTables(prev => prev.map(t => t.id === tableId ? {
      ...t,
      status: 'Dirty',
      currentOrderId: undefined,
      waiterName: undefined,
      guestCount: undefined
    } : t));
    addTerminalLog(`Table ${tableId} bill cleared from terminal. Table flag changed to Dirty.`);
  };

  // --- SCAN-TO-ORDER PHONE APP ACTIONS ---
  const handlePhoneLookupLoyalty = () => {
    const found = loyaltyDb.find(c => c.phone === phoneLoyaltyPhone);
    if (found) {
      setPhoneActiveCustomer(found);
      addTerminalLog(`Scan-To-Order: Guest loaded loyalty profile for ${found.name}.`);
    } else {
      setPhoneRegistering(true);
    }
  };

  const handlePhoneEnrollAndContinue = () => {
    if (!phoneRegisteredName || !phoneLoyaltyPhone) return;
    const newId = `CUST-${Math.floor(Math.random() * 900) + 100}`;
    const newCust: CustomerLoyalty = {
      id: newId,
      name: phoneRegisteredName,
      phone: phoneLoyaltyPhone,
      loyaltyPoints: 10,
      visitCount: 1,
      lifetimeSpend: 0
    };
    setLoyaltyDb(prev => [...prev, newCust]);
    setPhoneActiveCustomer(newCust);
    setPhoneRegistering(false);
    addTerminalLog(`Scan-To-Order: Guest registered as ${newCust.name} via QR flow.`);
  };

  const handlePhoneAddToCart = (dish: MenuItem) => {
    setPhoneCart(prev => {
      const exists = prev.find(x => x.menuItemId === dish.id);
      if (exists) {
        return prev.map(x => x.menuItemId === dish.id ? { ...x, qty: x.qty + 1 } : x);
      }
      return [...prev, { menuItemId: dish.id, name: dish.name, price: dish.price, qty: 1 }];
    });
  };

  const handlePhonePlaceOrder = () => {
    if (phoneCart.length === 0) return;

    const newOrdId = `ORD-QR-${Math.floor(Math.random() * 800) + 100}`;
    const subtotal = phoneCart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    // Apply loyalty discount if customer loaded (15% off!)
    const discount = phoneActiveCustomer ? Math.round(subtotal * 0.15) : 0;
    const serviceFee = Math.round((subtotal - discount) * 0.05);
    const finalBill = subtotal - discount + serviceFee;

    const newOrder: RestaurantOrder = {
      id: newOrdId,
      tableId: phoneSimTable,
      waiterName: 'Scan-To-Order QR',
      items: phoneCart,
      extraServiceCharge: serviceFee,
      paymentStatus: 'Unpaid',
      totalBill: finalBill,
      customerId: phoneActiveCustomer?.id,
      status: 'pending'
    };

    setOrders(prev => [...prev, newOrder]);

    // Send to KDS
    const summary = phoneCart.map(i => `${i.qty}x ${i.name}`).join(', ');
    const newTkt: KitchenTicket = {
      id: `TKT-${Math.floor(Math.random() * 900) + 100}`,
      tableId: phoneSimTable,
      orderId: newOrdId,
      itemsSummary: `📱 [QR Order] ${summary}`,
      status: 'Queued',
      elapsedMins: 1,
      chefAssignee: 'Line Cook Juma'
    };
    setTickets(prev => [...prev, newTkt]);

    // Update master dining Table layout
    setTables(prev => prev.map(t => t.id === phoneSimTable ? {
      ...t,
      status: 'Awaiting Food',
      currentOrderId: newOrdId,
      waiterName: 'QR digital',
      guestCount: 1
    } : t));

    addTerminalLog(`Scan-To-Order: Table ${phoneSimTable} dispatched order successfully. KDS ticket queued.`);
    setPhoneOrderState('placed');
  };

  // --- KDS & RECIPE AUTO-DEDUCTION LOGIC ---
  const handleAdvanceKdsTicket = (tktId: string) => {
    let tkt = tickets.find(t => t.id === tktId);
    if (!tkt) return;

    if (tkt.status === 'Queued') {
      // Transition to Cooking: Trigger Recipe Ingredients Deduction right now!
      const relatedOrder = orders.find(o => o.id === tkt?.orderId);
      if (relatedOrder) {
        deductStockForOrderItems(relatedOrder.items);
      }

      setTickets(prev => prev.map(t => t.id === tktId ? { ...t, status: 'Cooking' } : t));
      addTerminalLog(`KDS: Chef started compiling ${tktId}. Redundant recipe assets deducted from live stock.`);
    } 
    else if (tkt.status === 'Cooking') {
      // Transition to Ready (Notifier Companion gets alerted)
      setTickets(prev => prev.map(t => t.id === tktId ? { ...t, status: 'Ready' } : t));
      
      const newAlert: WaiterAlert = {
        id: `ALT-${Math.floor(Math.random() * 900) + 100}`,
        title: `Dish Hot on Pass! 🛎️`,
        time: new Date().toTimeString().slice(0, 5),
        tableId: tkt.tableId,
        items: tkt.itemsSummary,
        read: false
      };
      setAlerts(prev => [newAlert, ...prev]);
      addTerminalLog(`KDS Alert: TKT ${tktId} is PLATED & Ready! Waiter pager buzzed.`);
    } 
    else if (tkt.status === 'Ready') {
      // Transition to Served (Dispatched to customer)
      setTickets(prev => prev.filter(t => t.id !== tktId));
      setTables(prev => prev.map(t => t.id === tkt.tableId ? { ...t, status: 'Occupied' } : t));
      addTerminalLog(`KDS: Order delivered & marked served for ${tkt.tableId}.`);
    }
  };

  // --- MENU MANAGEMENT LOGIC HANDLERS ---
  const handleCreateDish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDishName.trim()) return;
    const priceNum = parseFloat(newDishPrice) || 0;
    if (priceNum <= 0) return;
    const prepMins = parseInt(newDishPrepTime) || 15;

    // Generate unique ID based on existing items
    const nextId = `MN-${menuItems.length + 10}`;

    // Compute ingredients string for visual card display
    const recipeIngredientsList = Object.entries(newDishRecipes)
      .filter(([_, qty]) => (qty as number) > 0)
      .map(([name, qty]) => {
        const unit = inventory.find(i => i.name === name)?.unit || 'units';
        return `${qty as number} ${unit} ${name}`;
      });
    const ingredientsString = recipeIngredientsList.join(', ') || 'No raw ingredients configured';

    const newDishItem: MenuItem = {
      id: nextId,
      name: newDishName,
      category: newDishCategory,
      price: priceNum,
      prepTime: prepMins,
      available: true,
      ingredients: ingredientsString
    };

    const recipeEntries = Object.entries(newDishRecipes)
      .filter(([_, qty]) => (qty as number) > 0)
      .map(([name, qty]) => ({ name, quantity: qty as number }));

    setMenuItems(prev => [...prev, newDishItem]);
    setRecipeBook(prev => ({
      ...prev,
      [nextId]: recipeEntries
    }));

    addTerminalLog(`Product Catalog: Added ${newDishName} (${newDishCategory}) with recipe mapping.`);

    // Reset Form Fields
    setNewDishName('');
    setNewDishPrice('');
    setNewDishPrepTime('15');
    setNewDishRecipes({});
  };

  const handleDeleteDish = (id: string) => {
    const dish = menuItems.find(m => m.id === id);
    if (!dish) return;
    setMenuItems(prev => prev.filter(m => m.id !== id));
    addTerminalLog(`Product Catalog: Removed ${dish.name} from active menu catalog.`);
  };

  return (
    <div className="space-y-6">
      
      {/* Dynamic Jumbotron Header Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-1/4 -translate-y-1/4 w-80 h-80 bg-orange-600/10 rounded-full pointer-events-none blur-3xl animate-pulse" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-gradient-to-tr from-amber-500 to-orange-500 rounded-xl text-black">
                <Utensils className="w-5 h-5 font-bold" />
              </span>
              <span className="text-[10px] font-mono tracking-widest bg-orange-500/10 text-orange-400 px-3 py-1 rounded-full border border-orange-500/20 font-bold uppercase">
                Restaurant Hub Suite
              </span>
            </div>
            <h2 className="text-2xl font-black tracking-tight flex items-center space-x-2">
              <span>Bistro Digital Companion</span>
              <span className="text-xs bg-slate-800 text-slate-350 px-2.5 py-0.5 rounded-full font-mono border border-slate-700">Offline-First Engine</span>
            </h2>
            <p className="text-slate-400 text-xs max-w-xl font-light leading-relaxed">
              Experience the complete operations flow: customer QR self-ordering, automated menu recipes inventory calculations, kitchen display monitoring, and waiter companion paging alerts.
            </p>
          </div>
          
          <div className="bg-slate-850 border border-slate-750 p-4 rounded-2xl text-right font-mono text-xs w-full md:w-auto">
            <span className="text-slate-450 block text-[9px] uppercase tracking-widest font-black">Active Restaurant Payment Mode</span>
            <span className="text-base font-extrabold text-orange-400 block mt-1">
              {activeTenant.name}
            </span>
          </div>
        </div>
      </div>

      {/* Main Module Switch Board */}
      <div className="flex flex-wrap gap-2 border-b border-slate-205 pb-3">
        <button
          onClick={() => setActiveSubTab('tables')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'tables' 
              ? 'bg-slate-900 text-white' 
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Table Map & QR Ordering</span>
        </button>

        <button
          onClick={() => setActiveSubTab('kds')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
            activeSubTab === 'kds' 
              ? 'bg-slate-900 text-white' 
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <ChefHat className="w-4 h-4" />
          <span>Kitchen Display (KDS)</span>
          {tickets.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-amber-500 text-white w-4 h-4 rounded-full text-[9px] font-mono flex items-center justify-center font-black animate-bounce">
              {tickets.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('menu')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'menu' 
              ? 'bg-slate-900 text-white' 
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <BookOpen className="w-4 h-4 text-orange-500" />
          <span>Menu & Recipes Catalog</span>
        </button>

        <button
          onClick={() => setActiveSubTab('loyalty')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'loyalty' 
              ? 'bg-slate-900 text-white' 
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <Award className="w-4 h-4 animate-spin-slow text-orange-500" />
          <span>Loyalty Programs Directory</span>
        </button>

        <button
          onClick={() => setActiveSubTab('waiter')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
            activeSubTab === 'waiter' 
              ? 'bg-slate-900 text-white' 
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Waiters Pager App</span>
          {alerts.filter(a => !a.read).length > 0 && (
            <span className="absolute -top-1 -right-1 bg-rose-500 text-white w-4 h-4 rounded-full text-[9px] font-mono flex items-center justify-center font-black">
              {alerts.filter(a => !a.read).length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('reservations')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'reservations' 
              ? 'bg-slate-900 text-white' 
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4 text-purple-505" />
          <span>Table Bookings Planner</span>
        </button>

        <button
          onClick={() => setActiveSubTab('deliveries')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'deliveries' 
              ? 'bg-slate-900 text-white' 
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <Truck className="w-4 h-4 text-sky-505 animate-pulse" />
          <span>Delivery Dispatch Gateway</span>
        </button>

        <button
          onClick={() => setActiveSubTab('sql')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'sql' 
              ? 'bg-amber-600 text-white' 
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-250'
          }`}
        >
          <Database className="w-4 h-4" />
          <span className="font-mono">Supabase SQL Schema</span>
        </button>
      </div>

      {/* --- TAB 1: DINING GRID & MOBILE QR SCAN-TO-ORDER --- */}
      {activeSubTab === 'tables' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          
          {/* Main Visual Dining Layout */}
          <div className="xl:col-span-8 bg-white border border-slate-200 rounded-3xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Dynamic Layout Grid</h3>
                <p className="text-[11px] text-slate-450 leading-tight">Pick a table or scan QR.</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-1 px-3 rounded-xl text-[10px] font-mono text-slate-500">
                Active Tables: <strong>{tables.length}</strong>
              </div>
            </div>

            {/* Quick Map Legend */}
            <div className="flex items-center flex-wrap gap-2 text-[9.5px] font-mono font-bold bg-slate-50 p-2.5 rounded-xl">
              <span className="text-slate-450 block uppercase mr-2 font-black">Table status:</span>
              <div className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-emerald-700">Available</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-orange-700">Dine-In Block</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                <span className="text-blue-700">KDS Cooking</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <span className="text-rose-700">Dirty</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                <span className="text-purple-705">Reserved</span>
              </div>
            </div>

            {/* Actual Tables Grid container */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {tables.map(table => {
                const isFocused = selectedTable?.id === table.id;
                const tblOrder = orders.find(o => o.tableId === table.id && o.paymentStatus === 'Unpaid');

                return (
                  <div
                    key={table.id}
                    onClick={() => {
                      setSelectedTable(table);
                      setGuestCountInput(table.guestCount?.toString() || '2');
                      setPosWaiterName(table.waiterName || 'Kofi');
                      setInspectingTable(table); // Open Live Activity Radar
                    }}
                    className={`p-4 rounded-2xl border text-left flex flex-col justify-between h-[125px] cursor-pointer transition-all ${
                      isFocused 
                        ? 'border-orange-500 ring-4 ring-orange-500/10 shadow-md bg-stone-50/50' 
                        : table.status === 'Occupied' 
                          ? 'bg-amber-50/40 border-amber-350 hover:bg-amber-50/60' 
                          : table.status === 'Awaiting Food'
                            ? 'bg-blue-50/40 border-blue-400 hover:bg-blue-50/60'
                            : table.status === 'Reserved'
                              ? 'bg-purple-50/40 border-purple-300 hover:bg-purple-50/60'
                              : table.status === 'Dirty'
                                ? 'bg-rose-50/40 border-red-300 hover:bg-rose-50/60'
                                : 'bg-slate-50 hover:bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-black text-slate-800">{table.id}</span>
                      <span className="text-[9px] bg-slate-200 text-slate-600 px-1 rounded font-mono">
                        {table.capacity} Pax
                      </span>
                    </div>

                    <div className="my-1">
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono uppercase font-bold text-[8.5px] border ${
                        table.status === 'Occupied' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                        table.status === 'Awaiting Food' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                        table.status === 'Reserved' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                        table.status === 'Dirty' ? 'bg-red-100 text-rose-800 border-red-200 animate-pulse' :
                        'bg-emerald-100 text-emerald-800 border-emerald-250'
                      }`}>
                        {table.status === 'Occupied' ? 'Dining' : table.status}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[10px] font-mono">
                      <span className="text-slate-450">Amt:</span>
                      <span className="font-extrabold text-slate-800">
                        {tblOrder ? currencyValue(tblOrder.totalBill) : 'Empty'}
                      </span>
                    </div>

                    {/* Scan to Order trigger button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPhoneSimTable(table.id);
                        setPhoneOrderState('browse');
                        setPhoneCart([]);
                        addTerminalLog(`Demo: Simulated Scan-to-Order on ${table.id}`);
                      }}
                      className="mt-1.5 w-full py-1 bg-orange-600 hover:bg-orange-700 text-white text-[9.5px] rounded-lg font-mono flex items-center justify-center space-x-1 shadow transition-all shrink-0 border-none"
                    >
                      <Smartphone className="w-3 h-3" />
                      <span>Scan-to-Order</span>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Quick interactive logs */}
            <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
              <p className="text-[10px] font-mono font-bold text-orange-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                <span>Digital Terminal Feed</span>
                <span className="text-slate-500 font-normal">Offline Ledger Synced</span>
              </p>
              <div className="h-24 overflow-y-auto space-y-1 text-[10.5px] font-mono text-slate-300 divide-y divide-slate-800/50">
                {terminalLogs.map((log, idx) => (
                  <p key={idx} className="py-1">{log}</p>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: POS Order focus AND Smartphone QR Ordering Simulator Side-by-Side */}
          <div className="xl:col-span-4 space-y-6">

            {/* Guest SmartPhone QR Ordering Simulation Box */}
            <div className="bg-slate-950 text-slate-100 rounded-[36px] p-5 border-4 border-slate-800 shadow-2xl relative">
              {/* Speaker / Notch simulator */}
              <div className="w-28 h-4.5 bg-slate-800 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="w-2 h-2 rounded-full bg-slate-900 inline-block mr-2" />
                <span className="w-10 h-1 bg-slate-700 rounded-full inline-block" />
              </div>

              <div className="space-y-4">
                <div className="bg-gradient-to-r from-orange-600 to-amber-600 p-3 rounded-2xl text-center">
                  <p className="text-[9px] font-mono uppercase tracking-widest text-amber-100">Live Customer Portal</p>
                  <h4 className="text-xs font-bold text-white flex items-center justify-center space-x-1.5">
                    <Smartphone className="w-4 h-4 text-amber-200" />
                    <span>Scan-To-Order: {phoneSimTable}</span>
                  </h4>
                </div>

                {phoneOrderState === 'browse' && (
                  <div className="space-y-3.5 text-xs">
                    {/* Customer Enrollment prompt */}
                    {!phoneActiveCustomer ? (
                      <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl space-y-2">
                        <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider font-mono">🎁 Member Loyalty Club ?</p>
                        <p className="text-[10px] text-slate-400 leading-tight">Earn points and discount.</p>
                        
                        {phoneRegistering ? (
                          <div className="space-y-2 pt-1.5">
                            <input
                              type="text"
                              placeholder="Your full name"
                              value={phoneRegisteredName}
                              onChange={(e) => setPhoneRegisteredName(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-[10.5px] outline-none text-white font-mono"
                            />
                            <button
                              onClick={handlePhoneEnrollAndContinue}
                              className="w-full bg-orange-655 text-black font-bold font-mono text-[10px] p-1 rounded-md cursor-pointer border-none bg-orange-400"
                            >
                              Enroll with Phone
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            <input
                              type="tel"
                              placeholder="Enter Phone e.g. 07XXXXXXXX"
                              value={phoneLoyaltyPhone}
                              onChange={(e) => setPhoneLoyaltyPhone(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-[10.5px] outline-none text-white font-mono"
                            />
                            <button
                              onClick={handlePhoneLookupLoyalty}
                              className="bg-slate-800 hover:bg-slate-700 text-[10px] font-mono px-2.5 rounded text-white border-none cursor-pointer"
                            >
                              Verify
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-emerald-950/40 border border-emerald-500/20 p-2.5 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-emerald-400 font-mono font-bold">✓ Welcome Back, {phoneActiveCustomer.name}</p>
                          <p className="text-[9px] text-slate-400">{phoneActiveCustomer.phone} | {phoneActiveCustomer.loyaltyPoints} points</p>
                        </div>
                        <span className="text-[9px] font-mono bg-emerald-500/10 text-emerald-300 font-bold p-1 rounded">15% Off VIP</span>
                      </div>
                    )}

                    {/* Quick Menu Catalog Scroller */}
                    <div className="space-y-2">
                      <p className="text-[10.5px] font-mono font-bold text-slate-355 uppercase">🍽️ Digital QR Menu Card</p>
                      <div className="space-y-2 max-h-[170px] overflow-y-auto pr-1">
                        {menuItems.map(dish => (
                          <div key={dish.id} className="p-2 bg-slate-900 border border-slate-800 rounded-xl flex justify-between items-center text-xs">
                            <div>
                              <p className="font-bold text-slate-100">{dish.name}</p>
                              <p className="text-[9.5px] font-mono text-slate-400">{currencyValue(dish.price)}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                handlePhoneAddToCart(dish);
                                addTerminalLog(`Scan-To-Order: Added ${dish.name} to Smartphone Cart.`);
                              }}
                              className="p-1 px-2.5 bg-orange-650 hover:bg-orange-550 text-black border-none font-bold text-[10px] rounded font-mono uppercase tracking-wide cursor-pointer bg-orange-400"
                            >
                              + Add
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Footer basket toggle */}
                    {phoneCart.length > 0 && (
                      <button
                        onClick={() => setPhoneOrderState('cart')}
                        className="w-full py-2 bg-orange-600 hover:bg-orange-650 rounded-xl font-mono text-[10px] font-black uppercase text-white flex items-center justify-center space-x-2 border-none cursor-pointer"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>Checkout Phone basket ({phoneCart.reduce((s, c) => s + c.qty, 0)})</span>
                      </button>
                    )}
                  </div>
                )}

                {phoneOrderState === 'cart' && (
                  <div className="space-y-3.5 text-xs">
                    <p className="text-[10px] font-mono text-orange-400 uppercase tracking-widest">🛒 Simulated QR Grocery Bag</p>
                    
                    <div className="space-y-2 divide-y divide-slate-800 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                      {phoneCart.map((it, i) => (
                        <div key={i} className="pt-2 flex justify-between items-center">
                          <div>
                            <p className="font-bold text-slate-200">{it.qty}x {it.name}</p>
                            <p className="text-[9.5px] font-mono text-slate-500">{currencyValue(it.price * it.qty)}</p>
                          </div>
                          <button
                            onClick={() => setPhoneCart(prev => prev.filter(x => x.menuItemId !== it.menuItemId))}
                            className="bg-transparent hover:text-rose-500 text-slate-500 border-none cursor-pointer p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}

                      {/* Calculations */}
                      <div className="pt-2.5 mt-2 text-[10.5px] font-mono space-y-1 bg-slate-950 p-2 rounded-lg border border-slate-850">
                        <div className="flex justify-between text-slate-400">
                          <span>Subtotal:</span>
                          <span>{currencyValue(phoneCart.reduce((s, c) => s + (c.price * c.qty), 0))}</span>
                        </div>
                        {phoneActiveCustomer && (
                          <div className="flex justify-between text-emerald-400">
                            <span>15% Club discount:</span>
                            <span>-{currencyValue(Math.round(phoneCart.reduce((s, c) => s + (c.price * c.qty), 0) * 0.15))}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-slate-400">
                          <span>5% SVC Card Fee:</span>
                          <span>{currencyValue(Math.round((phoneCart.reduce((s, c) => s + (c.price * c.qty), 0) - (phoneActiveCustomer ? Math.round(phoneCart.reduce((s, c) => s + (c.price * c.qty), 0) * 0.15) : 0)) * 0.05))}</span>
                        </div>
                        <div className="flex justify-between text-white font-black text-xs pt-1 border-t border-dashed border-slate-800">
                          <span>Total due:</span>
                          <span>{currencyValue(phoneCart.reduce((s, c) => s + (c.price * c.qty), 0) - (phoneActiveCustomer ? Math.round(phoneCart.reduce((s, c) => s + (c.price * c.qty), 0) * 0.15) : 0) + Math.round((phoneCart.reduce((s, c) => s + (c.price * c.qty), 0) - (phoneActiveCustomer ? Math.round(phoneCart.reduce((s, c) => s + (c.price * c.qty), 0) * 0.15) : 0)) * 0.05))}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setPhoneOrderState('browse')}
                        className="py-2.5 bg-slate-800 hover:bg-slate-705 text-white rounded-xl font-mono text-[9px] uppercase font-bold tracking-tight border-none cursor-pointer"
                      >
                        ← Add Food
                      </button>
                      <button
                        onClick={handlePhonePlaceOrder}
                        className="py-2.5 bg-orange-600 hover:bg-orange-550 text-white rounded-xl font-mono text-[9px] uppercase font-bold tracking-tight border-none cursor-pointer"
                      >
                        ⚡ Submit QR Order
                      </button>
                    </div>
                  </div>
                )}

                {phoneOrderState === 'placed' && (
                  <div className="space-y-4 text-center py-5">
                    <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
                    <div>
                      <h5 className="text-sm font-bold text-white">Order Transmitted to KDS!</h5>
                      <p className="text-[10.5px] text-slate-450 mt-1 leading-relaxed">
                        Your smartphone order has been placed on <strong>{phoneSimTable}</strong>. The chef is currently preparing your meal.
                      </p>
                    </div>

                    <div className="border border-slate-800 rounded-xl p-3 text-left space-y-1.5 text-xs bg-slate-900/40">
                      <p className="text-[9.5px] font-mono text-amber-400 uppercase tracking-wider font-bold">Simulate Payment</p>
                      <input
                        type="tel"
                        placeholder="M-Pesa payment phone"
                        value={phoneMpesaPhone}
                        onChange={(e) => setPhoneMpesaPhone(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-[10px] outline-none text-white font-mono"
                      />
                      <button
                        onClick={() => {
                          if (!phoneMpesaPhone) return;
                          setPhoneOrderState('paid');
                          setTables(prev => prev.map(t => t.id === phoneSimTable ? { ...t, status: 'Dirty' } : t));
                          addTerminalLog(`Scan-To-Order: Client completed mobile validation over M-Pesa at ${phoneSimTable}.`);
                        }}
                        className="w-full py-1.5 bg-emerald-600 text-white rounded text-[10px] font-mono uppercase font-black border-none cursor-pointer"
                      >
                        💸 Pay with M-Pesa Emulator
                      </button>
                    </div>

                    <button
                      onClick={() => setPhoneOrderState('browse')}
                      className="text-[10px] text-slate-500 underline hover:text-slate-300 border-none bg-transparent"
                    >
                      Browse full menu again
                    </button>
                  </div>
                )}

                {phoneOrderState === 'paid' && (
                  <div className="space-y-3.5 text-center py-6">
                    <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-sm border border-emerald-500/20">
                      ✓
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-white uppercase font-mono tracking-widest text-emerald-400">Ledger Fully Paid</h5>
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                        Thank you for dining with {activeTenant.name}! Visit logged in persistent register.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setPhoneOrderState('browse');
                        setPhoneCart([]);
                      }}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-white font-mono text-[9px] border-none cursor-pointer uppercase font-bold"
                    >
                      New Simulator Run
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Standard Waiter POS Order Workspace Entry Card */}
            {selectedTable ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
                <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                  <div>
                    <span className="text-[9px] font-mono uppercase bg-slate-105 text-slate-500 px-2 py-0.5 rounded font-black">Active Waiter POS Console</span>
                    <h4 className="text-sm font-black text-slate-800 mt-1">{selectedTable.id} Active Folio</h4>
                  </div>
                  <button
                    onClick={() => setSelectedTable(null)}
                    className="p-1 text-slate-400 hover:text-slate-700 bg-slate-50 rounded-lg cursor-pointer border-none"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-slate-50 border border-slate-150 rounded-2xl p-3 text-xs space-y-1.5">
                  <div className="flex justify-between text-slate-500 font-mono text-[10px]">
                    <span>Table Capacity:</span>
                    <span className="font-bold">{selectedTable.capacity} Pax</span>
                  </div>
                  <div className="flex justify-between text-slate-500 font-mono text-[10px]">
                    <span>Current Layout Status:</span>
                    <span className="font-black text-orange-600 uppercase">{selectedTable.status}</span>
                  </div>
                </div>

                {/* PLACE POS ORDER DIRECTLY FOR CUSTOMERS BEING SERVED */}
                {selectedTable.status === 'Available' || selectedTable.status === 'Dirty' ? (
                  <form onSubmit={handleSubmitPosOrder} className="space-y-3.5">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-[9px] font-mono font-bold text-slate-400 block mb-1">Steward Name</label>
                        <select
                          value={posWaiterName}
                          onChange={(e) => setPosWaiterName(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-1.5 outline-none cursor-pointer"
                        >
                          <option value="Kofi">Kofi (Lead)</option>
                          <option value="Grace">Grace (Waiter)</option>
                          <option value="Juma">Juma (Bartender)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] font-mono font-bold text-slate-400 block mb-1">Covers Count</label>
                        <input
                          type="number"
                          min="1"
                          max={selectedTable.capacity + 2}
                          value={guestCountInput}
                          onChange={(e) => setGuestCountInput(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-1.5 outline-none font-mono"
                        />
                      </div>
                    </div>

                    {/* Basket items */}
                    <div className="space-y-1">
                      <span className="text-[9.5px] font-mono font-bold text-slate-450 uppercase block">Selected Food Items ({activeOrderItems.reduce((s, c) => s + c.qty, 0)})</span>
                      {activeOrderItems.length === 0 ? (
                        <div className="p-3 border border-dashed border-slate-200 rounded-xl text-center text-[10px] text-slate-450 italic bg-slate-50">
                          Click menu items in general list underneath to compile waiter bill.
                        </div>
                      ) : (
                        <div className="border border-slate-205 rounded-xl p-2 bg-white max-h-[120px] overflow-y-auto space-y-1.5">
                          {activeOrderItems.map(item => (
                            <div key={item.menuItemId} className="flex justify-between items-center text-xs">
                              <span className="font-bold line-clamp-1">{item.name}</span>
                              <div className="flex items-center space-x-1">
                                <button
                                  type="button"
                                  onClick={() => handleUpdatePosQty(item.menuItemId, item.qty - 1)}
                                  className="w-5 h-5 bg-slate-100 hover:bg-slate-200 rounded font-black text-slate-700 border-none cursor-pointer flex items-center justify-center"
                                >
                                  -
                                </button>
                                <span className="font-mono text-[11px] px-1">{item.qty}</span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdatePosQty(item.menuItemId, item.qty + 1)}
                                  className="w-5 h-5 bg-slate-100 hover:bg-slate-200 rounded font-black text-slate-700 border-none cursor-pointer flex items-center justify-center"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={activeOrderItems.length === 0}
                      className="w-full py-2 bg-slate-900 border-none disabled:bg-slate-100 hover:bg-slate-800 disabled:text-slate-400 text-white font-mono font-bold tracking-tight uppercase text-[10px] rounded-xl cursor-pointer"
                    >
                      🚀 Place Waiter Order
                    </button>

                    <div className="space-y-1 border-t border-slate-100 pt-3">
                      <p className="text-[9.5px] font-mono font-bold text-slate-400 block mb-1">Quick Add Menu Dishes</p>
                      <div className="grid grid-cols-2 gap-1.5 max-h-[110px] overflow-y-auto">
                        {menuItems.map(dish => (
                          <button
                            key={dish.id}
                            type="button"
                            onClick={() => handleAddPosItem(dish)}
                            className="text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 p-1.5 rounded-lg text-[10px] flex flex-col justify-between cursor-pointer"
                          >
                            <span className="font-extrabold line-clamp-1 text-slate-800">{dish.name}</span>
                            <span className="font-mono text-slate-550 mt-0.5 text-[9px]">{currencyValue(dish.price)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </form>
                ) : (
                  // BILL SETTLEMENT WITH MPESA PUSH APIS
                  (() => {
                    const matchedUnpaidOrd = orders.find(o => o.tableId === selectedTable.id && o.paymentStatus === 'Unpaid');
                    if (!matchedUnpaidOrd) return (
                      <div className="space-y-3 pt-2 text-center">
                        <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
                        <p className="text-xs font-mono font-bold text-slate-700">No Outstanding Bills Here</p>
                        <button
                          onClick={() => handleClearTableAndCheckout(selectedTable.id)}
                          className="px-3 py-1 bg-slate-900 text-white text-[10px] rounded font-mono uppercase tracking-wider border-none cursor-pointer"
                        >
                          Reset / Settle Table
                        </button>
                      </div>
                    );

                    const baseItemsSum = matchedUnpaidOrd.items.reduce((sum, it) => sum + (it.price * it.qty), 0);
                    const serviceFeeSurcharge = Math.round(baseItemsSum * 0.05);
                    const calculatedTax = restaurantVatStatus === 'vat' ? Math.round(baseItemsSum * activeTenant.taxRate) : 0;
                    const calculatedGrandTotal = baseItemsSum + serviceFeeSurcharge + calculatedTax;

                    return (
                      <div className="space-y-4">
                        <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2 text-xs">
                          <p className="text-[10px] font-mono font-bold text-rose-500 uppercase">Outstanding Ledger</p>
                          <div className="space-y-1">
                            {matchedUnpaidOrd.items.map((it, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span className="font-bold">{it.qty}x {it.name}</span>
                                <span className="font-mono">{currencyValue(it.price * it.qty)}</span>
                              </div>
                            ))}
                          </div>
                          
                          <div className="border-t border-dashed border-slate-250 pt-2 font-mono text-[10.5px] space-y-1">
                            <div className="flex justify-between text-slate-500">
                              <span>Service Surcharge (5%):</span>
                              <span>{currencyValue(serviceFeeSurcharge)}</span>
                            </div>

                            {restaurantVatStatus === 'vat' && (
                              <div className="flex justify-between text-slate-500">
                                <span>VAT ({Math.round(activeTenant.taxRate * 100)}%):</span>
                                <span>{currencyValue(calculatedTax)}</span>
                              </div>
                            )}

                            <div className="flex justify-between font-black text-slate-800 text-xs border-t border-slate-200 pt-1.5 mt-1">
                              <span>Grand Total:</span>
                              <span className="text-emerald-700">{currencyValue(calculatedGrandTotal)}</span>
                            </div>
                          </div>
                        </div>

                        {/* COMPLIANCE CHANGER */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">TAX COMPLIANCE</label>
                          <select
                            value={restaurantVatStatus}
                            onChange={(e) => setRestaurantVatStatus(e.target.value as 'vat' | 'non-vat')}
                            className="w-full text-xs bg-white border border-slate-250 px-2.5 py-2 rounded-xl text-slate-850 outline-none focus:border-emerald-500 font-sans"
                          >
                            <option value="non-vat">Normal Sell (Non-VAT Receipt)</option>
                            <option value="vat">VAT Sell (VAT-Compliant Receipt)</option>
                          </select>
                        </div>

                        {/* PAYMENT METHODS SELECTION */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">PAYMENT RAIL CHANNEL</label>
                          <div className="grid grid-cols-3 gap-1">
                            {(['Cash', 'Mobile Money', 'Bank'] as const).map((method) => (
                              <button
                                key={method}
                                type="button"
                                onClick={() => setRestaurantPayMethod(method)}
                                className={`py-2 text-[10.5px] rounded-lg border font-bold transition-all cursor-pointer ${
                                  restaurantPayMethod === method
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-400 font-extrabold'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-350'
                                }`}
                              >
                                {method}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Customer Loyalty matching field */}
                        <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[11px] space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Loyalty Phone Number</label>
                          <div className="flex gap-1.5 font-sans">
                            <input
                              type="tel"
                              placeholder="e.g. 0711223344"
                              value={mPesaPhoneInput}
                              onChange={(e) => setMPesaPhoneInput(e.target.value.replace(/[^0-9]/g, ''))}
                              className="w-full bg-white border border-slate-250 rounded-lg px-2 py-1 outline-none font-mono text-xs focus:border-emerald-500"
                            />
                          </div>
                          <p className="text-[8.5px] text-slate-450 italic leading-none font-sans block">
                            Entering customer's enrolled phone number rewards visit count and ledger loyalty points.
                          </p>
                        </div>

                        {/* CHECKOUT SUBMIT BUTTON */}
                        <button
                          type="button"
                          onClick={() => handleRestaurantCheckoutSubmit(matchedUnpaidOrd.id)}
                          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-sm hover:shadow"
                        >
                          Finish Sell & Open POS Receipt
                        </button>
                      </div>
                    );
                  })()
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* --- TAB 2: KITCHEN DISPLAY SYSTEM & LIVE MENU RECIPES INVENTORY --- */}
      {activeSubTab === 'kds' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Real-time KDS Board */}
          <div className="lg:col-span-8 bg-slate-950 text-slate-100 rounded-3xl p-6 border border-slate-850 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <ChefHat className="w-5 h-5 text-orange-500" />
                <h3 className="text-sm font-black uppercase tracking-wider">Kitchen Display System (KDS) monitor</h3>
              </div>
              <span className="text-[10px] font-mono bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded-full border border-orange-500/20">
                Active Fire: {tickets.length} tickets
              </span>
            </div>

            {tickets.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <CheckCircle className="w-10 h-10 text-emerald-450 mx-auto" />
                <p className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest">Pass Counter Fully Clear</p>
                <p className="text-[10px] text-slate-500 max-w-xs mx-auto">All orders served.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {tickets.map(tkt => (
                  <div key={tkt.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 flex flex-col justify-between gap-3 text-xs">
                    <div>
                      <div className="flex justify-between items-center text-[11px] font-mono border-b border-slate-850 pb-2">
                        <span className="font-black text-orange-500">{tkt.id}</span>
                        <span className="bg-slate-800 px-1 py-0.5 rounded font-bold text-slate-300 uppercase">{tkt.tableId}</span>
                        <span className="text-slate-550 flex items-center space-x-1 text-[10px]">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{tkt.elapsedMins}m elapsed</span>
                        </span>
                      </div>

                      <p className="font-bold text-slate-100 font-sans tracking-tight text-sm mt-3 leading-snug">
                        {tkt.itemsSummary}
                      </p>
                    </div>

                    <div className="space-y-2.5 pt-2 border-t border-slate-850">
                      <div className="flex justify-between items-center text-[9.5px] font-mono text-slate-450">
                        <span>Staff: <strong className="font-bold text-slate-300">{tkt.chefAssignee}</strong></span>
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[8.5px] uppercase ${
                          tkt.status === 'Queued' ? 'bg-slate-800 text-slate-400' :
                          tkt.status === 'Cooking' ? 'bg-amber-500/10 text-amber-500' :
                          'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {tkt.status}
                        </span>
                      </div>

                      <button
                        onClick={() => handleAdvanceKdsTicket(tkt.id)}
                        className={`w-full py-2 rounded-xl text-[10.5px] font-mono uppercase font-black tracking-tight border-none cursor-pointer text-white transition-all ${
                          tkt.status === 'Queued' ? 'bg-amber-600 hover:bg-amber-550' :
                          tkt.status === 'Cooking' ? 'bg-emerald-600 hover:bg-emerald-555' :
                          'bg-indigo-600 hover:bg-indigo-550'
                        }`}
                      >
                        {tkt.status === 'Queued' && '🍳 Start Prep & Cook'}
                        {tkt.status === 'Cooking' && '🛎️ Plated ok / Trigger Alert'}
                        {tkt.status === 'Ready' && '🏃 Dispatch run to Table'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Real-time Ingredient Stock Deduction Inventory Card */}
          <div className="lg:col-span-4 bg-white border border-slate-205 rounded-3xl p-6 space-y-4">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Product Recipes Inventory</h3>
              <p className="text-[11px] text-slate-450 mt-0.5 leading-snug">
                Selling dishes automatically decrements the raw ingredient stock units simulated in real-time.
              </p>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl p-3 bg-slate-50/50 space-y-2.5 text-xs max-h-[300px] overflow-y-auto">
              <div className="no-divide flex justify-between font-mono font-bold text-[9px] text-slate-400 uppercase pb-1.5">
                <span>Stock Item</span>
                <span>Active Volume</span>
              </div>
              {inventory.map((item, idx) => (
                <div key={idx} className="pt-2 flex justify-between items-center">
                  <span className="font-semibold text-slate-800">{item.name}</span>
                  <div className="text-right">
                    <span className="font-mono font-black text-slate-800 tracking-tight">{item.stock}</span>
                    <span className="text-[9px] text-slate-450 ml-1 font-mono uppercase">{item.unit}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Simulated RESTOCK action */}
            <button
              onClick={() => {
                setInventory([
                  { name: 'Local Chicken', stock: 50.00, unit: 'units' },
                  { name: 'Fresh Potatoes', stock: 200.00, unit: 'kg' },
                  { name: 'Organic Eggs', stock: 350.00, unit: 'units' },
                  { name: 'Goat Meat Tender', stock: 120.00, unit: 'kg' },
                  { name: 'Coconut Rich Paste', stock: 80.00, unit: 'liters' },
                  { name: 'Snapper Catch', stock: 60.00, unit: 'units' },
                  { name: 'Basmati Rice', stock: 150.00, unit: 'kg' },
                  { name: 'Fresh Hibiscus Ext.', stock: 50.00, unit: 'liters' }
                ]);
                addTerminalLog('Inventory: Fully replenished cold-storage stock levels.');
              }}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[10px] font-bold rounded-xl border-none cursor-pointer flex items-center justify-center space-x-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restock Inventory to Full</span>
            </button>
          </div>
        </div>
      )}

      {/* --- TAB 3: MENU & INGREDIENTS CATALOG --- */}
      {activeSubTab === 'menu' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Main Dish Management List (col-span-8) */}
          <div className="xl:col-span-8 bg-white border border-slate-200 rounded-3xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-slate-100 pb-4 gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Digital Dishes & Recipes Directory</h3>
                <p className="text-[11px] text-slate-450 mt-0.5 leading-snug">
                  Manage your visual menu catalog, adjust active selling prices, and check instant cookable portions based on raw storage metrics.
                </p>
              </div>
              <div className="bg-slate-100 border border-slate-200 p-1 px-3 rounded-xl text-[10px] font-mono text-slate-500 whitespace-nowrap self-start">
                Active Catalog: <strong>{menuItems.length} items</strong>
              </div>
            </div>

            {/* Filters bar */}
            <div className="flex flex-col md:flex-row gap-3">
              {/* Search bar */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by dish name or ingredients..."
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-slate-800 transition"
                />
              </div>

              {/* Category selector */}
              <div className="flex flex-wrap gap-1.5 self-center">
                {(['All', 'Appetizers', 'Mains', 'Drinks', 'Desserts'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setMenuFilterCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-[10.5px] font-bold transition cursor-pointer border-none ${
                      menuFilterCategory === cat
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-150 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* List Table/Cards container */}
            <div className="space-y-3.5 max-h-[600px] overflow-y-auto pr-1">
              {menuItems
                .filter((item) => {
                  const matchesSearch =
                    item.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
                    item.ingredients.toLowerCase().includes(menuSearch.toLowerCase());
                  const matchesCat =
                    menuFilterCategory === 'All' || item.category === menuFilterCategory;
                  return matchesSearch && matchesCat;
                })
                .map((item) => {
                  // Core ingredient calculations
                  const recipeReqs = recipeBook[item.id] || [];
                  let portionsAvailable = Infinity;
                  let hasLowStock = false;

                  recipeReqs.forEach((req) => {
                    const invItem = inventory.find(
                      (i) => i.name.toLowerCase() === req.name.toLowerCase()
                    );
                    if (invItem) {
                      const maxPossible = Math.floor(invItem.stock / req.quantity);
                      if (maxPossible < portionsAvailable) {
                        portionsAvailable = maxPossible;
                      }
                      if (invItem.stock < req.quantity * 5) {
                        hasLowStock = true;
                      }
                    } else {
                      portionsAvailable = 0;
                      hasLowStock = true;
                    }
                  });

                  const isRecipeMapped = recipeReqs.length > 0;
                  const finalPortionsStr = isRecipeMapped
                    ? portionsAvailable === Infinity
                      ? 'No inventory constraints'
                      : portionsAvailable <= 0
                      ? '⚠️ INSUFFICIENT STOCK!'
                      : `🍽️ ${portionsAvailable} portions cookable`
                    : 'Unlimited (No raw ingredients)';

                  // Category visual style variables
                  let badgeColorCls = 'bg-orange-50 text-orange-700 border-orange-200';
                  if (item.category === 'Appetizers') badgeColorCls = 'bg-purple-50 text-purple-700 border-purple-200';
                  if (item.category === 'Drinks') badgeColorCls = 'bg-sky-50 text-sky-700 border-sky-200';
                  if (item.category === 'Desserts') badgeColorCls = 'bg-emerald-50 text-emerald-700 border-emerald-200';

                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-2xl border transition hover:shadow-xs ${
                        item.available ? 'bg-white border-slate-200' : 'bg-slate-50/70 border-slate-150 opacity-80'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        {/* Left Side: Dish Primary Info */}
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <span className="font-mono text-[9px] font-black text-slate-400">
                              {item.id}
                            </span>
                            <span
                              className={`text-[9.5px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${badgeColorCls}`}
                            >
                              {item.category}
                            </span>
                            {!item.available && (
                              <span className="text-[9px] font-mono font-bold uppercase bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded">
                                Sold Out
                              </span>
                            )}
                          </div>
                          <h4 className="text-xs font-black text-slate-805 mt-1">{item.name}</h4>
                          <p className="text-[10.5px] text-slate-500 leading-relaxed font-mono">
                            <span className="text-slate-500 font-bold">Recipe details:</span> {item.ingredients}
                          </p>

                          {/* Ingredient status warning text */}
                          <div className="flex items-center space-x-2 mt-1.5">
                            <span className={`text-[10px] font-mono font-bold ${
                              portionsAvailable <= 0 
                                ? 'text-rose-600' 
                                : hasLowStock 
                                ? 'text-amber-600' 
                                : 'text-emerald-700'
                            }`}>
                              {finalPortionsStr}
                            </span>
                          </div>
                        </div>

                        {/* Right Side: Quick Action & Price Adjust */}
                        <div className="flex items-center flex-wrap gap-2.5 lg:self-center">
                          {/* Price input */}
                          <div className="space-y-0.5">
                            <span className="text-[8px] font-mono uppercase text-slate-400 block font-bold">Price Adjust ({activeTenant.currencyCode})</span>
                            <input
                              type="number"
                              value={item.price}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setMenuItems(prev => prev.map(m => m.id === item.id ? { ...m, price: val } : m));
                              }}
                              className="w-[100px] border border-slate-200 rounded-lg p-1 text-xs text-slate-800 font-mono font-bold bg-slate-50 focus:bg-white text-right outline-none"
                            />
                          </div>

                          {/* Prep time adjuster */}
                          <div className="space-y-0.5">
                            <span className="text-[8px] font-mono uppercase text-slate-400 block font-bold">Prep Time (Min)</span>
                            <input
                              type="number"
                              value={item.prepTime}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setMenuItems(prev => prev.map(m => m.id === item.id ? { ...m, prepTime: val } : m));
                              }}
                              className="w-[55px] border border-slate-200 rounded-lg p-1 text-xs text-slate-800 font-mono bg-slate-50 focus:bg-white text-center outline-none"
                            />
                          </div>

                          {/* Availability button toggler */}
                          <div className="space-y-0.5 flex flex-col justify-end h-full pt-4">
                            <button
                              type="button"
                              onClick={() => {
                                setMenuItems(prev => prev.map(m => m.id === item.id ? { ...m, available: !m.available } : m));
                                addTerminalLog(`Product Catalog: Toggled availability status for ${item.name}.`);
                              }}
                              className={`px-2 py-1.5 rounded-lg text-[9px] uppercase font-mono tracking-tight font-bold border-none cursor-pointer text-center ${
                                item.available 
                                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/50' 
                                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/50'
                              }`}
                            >
                              {item.available ? '● In Stock' : '○ Disabled'}
                            </button>
                          </div>

                          {/* Delete dish completely */}
                          <div className="space-y-0.5 flex flex-col justify-end h-full pt-4">
                            <button
                              type="button"
                              onClick={() => handleDeleteDish(item.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-55 rounded-lg border-none cursor-pointer transition flex items-center justify-center"
                              title="Delete menu item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              
              {menuItems.filter((item) => {
                  const matchesSearch =
                    item.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
                    item.ingredients.toLowerCase().includes(menuSearch.toLowerCase());
                  const matchesCat =
                    menuFilterCategory === 'All' || item.category === menuFilterCategory;
                  return matchesSearch && matchesCat;
                }).length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs font-mono">
                  No dishes found in this category mapping. Try adding a new dish on the right!
                </div>
              )}
            </div>
          </div>

          {/* Form to Create New Dish (col-span-4) */}
          <div className="xl:col-span-4 bg-white border border-slate-200 rounded-3xl p-6 space-y-4 self-start">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Create New Menu Dish</h3>
              <p className="text-[11px] text-slate-450 leading-snug">
                Configure dish specifications, prices, and map ingredients dependencies automatically.
              </p>
            </div>

            <form onSubmit={handleCreateDish} className="space-y-4 text-xs text-slate-700">
              {/* Dish Name */}
              <div className="space-y-1">
                <label className="font-bold text-slate-400 font-mono text-[9px] uppercase">Dish Name / Beverage Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Spicy Swahili Saffron Shrimp"
                  value={newDishName}
                  onChange={(e) => setNewDishName(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-xl outline-none focus:border-slate-800 text-xs font-medium"
                />
              </div>

              {/* Category & Prep Mins */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-400 font-mono text-[9px] uppercase">Category</label>
                  <select
                    value={newDishCategory}
                    onChange={(e) => setNewDishCategory(e.target.value as any)}
                    className="w-full p-2 border border-slate-200 rounded-xl outline-none text-xs bg-white font-medium cursor-pointer"
                  >
                    <option value="Mains">Mains</option>
                    <option value="Appetizers">Appetizers</option>
                    <option value="Drinks">Drinks</option>
                    <option value="Desserts">Desserts</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-400 font-mono text-[9px] uppercase">Prep Time (Min)</label>
                  <input
                    type="number"
                    min="1"
                    value={newDishPrepTime}
                    onChange={(e) => setNewDishPrepTime(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl outline-none text-xs font-mono text-center"
                  />
                </div>
              </div>

              {/* Price */}
              <div className="space-y-1">
                <label className="font-bold text-slate-400 font-mono text-[9px] uppercase">Selling Price ({activeTenant.currencyCode})</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-mono text-slate-400 font-black text-[11px]">{activeTenant.currency}</span>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g., 15000"
                    value={newDishPrice}
                    onChange={(e) => setNewDishPrice(e.target.value)}
                    className="w-full pl-12 pr-4 p-2.5 border border-slate-200 rounded-xl outline-none focus:border-slate-800 text-xs font-mono text-right font-black"
                  />
                </div>
              </div>

              {/* Recipe Stock Builder checklist */}
              <div className="space-y-1.5 border-t border-slate-100 pt-3">
                <label className="font-bold text-slate-400 font-mono text-[9px] uppercase block">
                  Assign Recipe Ingredients
                </label>
                <p className="text-[9.5px] text-slate-400 leading-tight">
                  Check raw storage assets consumed by this dish and identify units required.
                </p>

                <div className="border border-slate-200 rounded-2xl p-3 space-y-2 max-h-[180px] overflow-y-auto">
                  {inventory.map((ing) => {
                    const currentVal = newDishRecipes[ing.name] || 0;
                    return (
                      <div key={ing.name} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-none">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={currentVal > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewDishRecipes(prev => ({ ...prev, [ing.name]: 0.5 }));
                              } else {
                                setNewDishRecipes(prev => {
                                  const next = { ...prev };
                                  delete next[ing.name];
                                  return next;
                                });
                              }
                            }}
                            className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                          />
                          <span className="text-[11.5px] text-slate-700 font-bold">{ing.name}</span>
                        </div>
                        {currentVal > 0 && (
                          <div className="flex items-center space-x-1 animate-fade-in text-[11px]">
                            <input
                              type="number"
                              step="0.05"
                              min="0.01"
                              value={currentVal}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setNewDishRecipes(prev => ({ ...prev, [ing.name]: val }));
                              }}
                              className="w-[50px] p-1 text-[11px] font-mono border border-slate-200 rounded text-right outline-none"
                            />
                            <span className="text-[9px] text-slate-400 font-mono font-bold uppercase">{ing.unit}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                className="w-full py-2.5 bg-orange-600 hover:bg-orange-550 text-white font-bold rounded-2xl border-none cursor-pointer flex items-center justify-center space-x-2 text-xs uppercase"
              >
                <Plus className="w-4 h-4" />
                <span>Add Dish to Active Catalog</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- TAB 3: LOYALTY DATABASE LOOP & CUSTOMER REGISTRY --- */}
      {activeSubTab === 'loyalty' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Customer registry database */}
          <div className="lg:col-span-8 bg-white border border-slate-205 rounded-3xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Loyalty directory (Tanzania Subledger)</h3>
                <p className="text-[11px] text-slate-450 mt-0.5">Members get 15% discount.</p>
              </div>
              <span className="text-[10px] bg-slate-100 text-slate-605 px-2.5 py-1 rounded-full font-mono border border-slate-200">
                Registered: <strong>{loyaltyDb.length} accounts</strong>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-mono text-slate-400 uppercase font-black uppercase tracking-wider pb-1.5">
                    <th className="py-2.5">Guest Identity</th>
                    <th>Loyalty phone number</th>
                    <th>Visit count</th>
                    <th>Earned points</th>
                    <th className="text-right">Accumulated Spend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-155">
                  {loyaltyDb.map(cust => (
                    <tr key={cust.id} className="hover:bg-slate-50/50">
                      <td className="py-3 font-bold text-slate-800">{cust.name}</td>
                      <td className="py-3 font-mono text-slate-600">{cust.phone}</td>
                      <td className="py-3 font-mono font-extrabold text-slate-800">{cust.visitCount} visits</td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 rounded font-mono font-bold text-[9.5px]">
                          ⭐ {cust.loyaltyPoints} points
                        </span>
                      </td>
                      <td className="py-3 text-right font-mono font-black text-slate-900">{currencyValue(cust.lifetimeSpend)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* New Enrollment loop form */}
          <div className="lg:col-span-4">
            <div className="bg-white border border-slate-205 rounded-3xl p-6 space-y-4 shadow-sm">
              <div className="border-b border-slate-100 pb-2">
                <h4 className="text-xs font-mono font-black text-slate-800 uppercase tracking-widest text-orange-500">Add New Guest Account</h4>
                <p className="text-[10px] text-slate-450">Add visit points.</p>
              </div>

              <form onSubmit={handleEnrollCustomer} className="space-y-3.5 text-xs text-slate-700">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold text-slate-400 block">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Salim Rashid"
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-orange-500 rounded-xl px-3 py-2 text-xs outline-none text-slate-800 font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold text-slate-400 block">Phone Number (M-Pesa compliant)</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 0712345678"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-orange-500 rounded-xl px-3 py-2 text-xs outline-none text-slate-800 font-mono"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-mono font-bold uppercase tracking-wide text-[10px] rounded-xl border-none cursor-pointer flex items-center justify-center space-x-1.5 shadow"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register Guest Card</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 4: WAITER COMPANION PAGER NOTIFICATION MODULE --- */}
      {activeSubTab === 'waiter' && (
        <div className="bg-slate-900 text-white border border-slate-800 p-6 rounded-3xl space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <BellRing className="w-5 h-5 text-indigo-400" />
              <h3 className="text-sm font-black uppercase tracking-wider">Waiter Notification App module</h3>
            </div>
            <button
              onClick={() => {
                setAlerts(prev => prev.map(a => ({ ...a, read: true })));
                addTerminalLog('Notifier Companion: Cleared all active read notifications.');
              }}
              className="text-[10px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1 rounded-lg border-none cursor-pointer"
            >
              Dismiss All Pagers
            </button>
          </div>

          <p className="text-[11px] text-slate-450 mt-1 max-w-2xl leading-relaxed">
            This module simulates hand-held steward pagers. When kitchen technicians cook or plate tickets ready on the KDS fire board, they advance order status on screen, and standard alarms trigger pings specifically calling assigned waiters the split second food is hot.
          </p>

          <div className="space-y-3">
            {alerts.length === 0 ? (
              <div className="py-12 text-center text-slate-500 italic text-xs font-mono">
                No active waiter beeper logs yet. Advance cooking items inside KDS to trigger alert.
              </div>
            ) : (
              alerts.map(alt => (
                <div 
                  key={alt.id} 
                  className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs ${
                    alt.read 
                      ? 'bg-slate-950/60 border-slate-850 opacity-60' 
                      : 'bg-indigo-950/20 border-indigo-500/30 ring-2 ring-indigo-500/10'
                  }`}
                >
                  <div>
                    <div className="flex items-center space-x-2.5">
                      <span className={`w-2 h-2 rounded-full ${alt.read ? 'bg-slate-600' : 'bg-red-500 inline-block animate-ping'}`} />
                      <strong className="text-slate-100 font-bold">{alt.title}</strong>
                      <span className="text-[9.5px] font-mono text-slate-500">{alt.time}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
                      Table Assigned: <strong className="text-slate-200">{alt.tableId}</strong> | Hot Items: <strong className="text-amber-500 font-mono">{alt.items}</strong>
                    </p>
                  </div>

                  <div className="flex gap-2">
                    {!alt.read && (
                      <button
                        onClick={() => {
                          setAlerts(prev => prev.map(a => a.id === alt.id ? { ...a, read: true } : a));
                          addTerminalLog(`Notifier Companion: Steward Grace marked Table alert ${alt.id} read / heading to pass.`);
                        }}
                        className="px-3.5 py-1.5 bg-indigo-650 hover:bg-indigo-550 border-none rounded-lg text-white font-mono text-[9px] font-bold uppercase cursor-pointer"
                      >
                        Acknowledge Call
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setAlerts(prev => prev.filter(a => a.id !== alt.id));
                        addTerminalLog(`Notifier Companion: Dropped off food, cleared ledger pager.`);
                      }}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 border-none rounded-lg text-slate-300 font-mono text-[9px] cursor-pointer"
                    >
                      Clear Log
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* --- TAB 5: RELATIONAL DATABASE & SUPABASE SCHEMA script EXPORTER --- */}
      {activeSubTab === 'sql' && (
        <div className="bg-slate-950 text-slate-200 rounded-3xl p-6 border border-slate-850 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-850 pb-3">
            <div className="flex items-center space-x-2.5">
              <span className="p-1 px-2.2 bg-emerald-500/10 text-emerald-400 rounded-lg text-xs font-mono font-bold">Postgres SQL</span>
              <div>
                <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest">Supabase Database Schema Code</h3>
                <p className="text-[10.5px] text-slate-500">Recipe stock SQL.</p>
              </div>
            </div>

            <button
              onClick={copyToClipboard}
              className={`px-4 py-2 text-[10.5px] font-mono uppercase tracking-wider rounded-xl transition-all cursor-pointer border-none font-bold ${
                sqlCopied ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              {sqlCopied ? '✓ Copied SQL to clipboard!' : 'Copy SQL Script'}
            </button>
          </div>

          <div className="space-y-4 text-xs">
            <div className="bg-amber-500/5 border border-amber-550/20 p-4 rounded-2xl flex items-start space-x-2 text-slate-350">
              <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-400 font-bold block mb-1">Elite Product Recipes Stock Mechanics</strong>
                <p className="text-[10.5px] leading-relaxed text-slate-400">
                  The schema contains 10 logical entities, complete indices, and a PostgreSQL trigger function <code className="bg-slate-900 p-0.5 rounded px-1.5 text-orange-400 font-bold">trigger_deduct_recipe_inventory</code>. When a transaction inserts menu items into <code className="bg-slate-900 p-0.5 rounded text-white">order_items</code>, the trigger automatically queries the <code className="bg-slate-950 px-1 border border-slate-800 rounded font-bold">product_recipes</code> table and decrements raw stock quantities in <code className="bg-slate-900 p-0.5 rounded text-white">inventory</code> instantaneously.
                </p>
              </div>
            </div>

            <div className="relative">
              <pre className="p-4 bg-slate-900 border border-slate-850 rounded-2xl font-mono text-[11px] text-emerald-400 overflow-x-auto max-h-[350px] leading-relaxed">
                {supabaseSqlSchema}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* --- NEW TAB: TABLE BOOKINGS PLANNER & HOTEL-STYLE PMS --- */}
      {activeSubTab === 'reservations' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
            
            {/* Left Column: Create Reservation Form */}
            <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4 font-sans">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Book Table Reservation</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed">Reserve tables.</p>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                if (!newResName || !newResPhone) return;
                
                const newRes: TableReservation = {
                  id: `RES-${Math.floor(Math.random() * 900) + 100}`,
                  customerName: newResName,
                  customerPhone: newResPhone,
                  tableId: newResTable,
                  date: newResDate,
                  time: newResTime,
                  status: 'Pending',
                  guestCount: parseInt(newResGuestCount) || 2,
                  notes: newResNotes || undefined
                };

                setReservations(prev => [newRes, ...prev]);
                
                // Update the table status to Reserved if the date is today
                setTables(prev => prev.map(t => t.id === newResTable ? { ...t, status: 'Reserved' } : t));

                addTerminalLog(`Reservation: Table scheduler booked ${newResTable} for ${newResName} (${newResGuestCount} Pax) on ${newResDate} at ${newResTime}`);
                
                // Reset fields
                setNewResName('');
                setNewResPhone('');
                setNewResNotes('');
              }} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-widest font-black text-slate-500 mb-1">Customer Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Fatma Kassim"
                    value={newResName}
                    onChange={(e) => setNewResName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 outline-none p-2.5 rounded-xl text-xs focus:bg-white focus:border-purple-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-widest font-black text-slate-500 mb-1">Phone Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 0715998844"
                    value={newResPhone}
                    onChange={(e) => setNewResPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 outline-none p-2.5 rounded-xl text-xs focus:bg-white focus:border-purple-500 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] uppercase font-mono tracking-widest font-black text-slate-500 mb-1">Select Table</label>
                    <select
                      value={newResTable}
                      onChange={(e) => setNewResTable(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 outline-none p-2.5 rounded-xl text-xs focus:bg-white focus:border-purple-500 transition-all cursor-pointer"
                    >
                      {tables.map(t => (
                        <option key={t.id} value={t.id}>{t.id} ({t.capacity} Pax)</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-mono tracking-widest font-black text-slate-500 mb-1">Guest Size</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="Guests"
                      value={newResGuestCount}
                      onChange={(e) => setNewResGuestCount(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-205 outline-none p-2.5 rounded-xl text-xs focus:bg-white focus:border-purple-500 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] uppercase font-mono tracking-widest font-black text-slate-500 mb-1">Date</label>
                    <input
                      type="date"
                      value={newResDate}
                      onChange={(e) => setNewResDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-205 outline-none p-2.5 rounded-xl text-xs focus:bg-white focus:border-purple-500 transition-all cursor-pointer font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-mono tracking-widest font-black text-slate-500 mb-1">Time Slot</label>
                    <input
                      type="time"
                      value={newResTime}
                      onChange={(e) => setNewResTime(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-205 outline-none p-2.5 rounded-xl text-xs focus:bg-white focus:border-purple-500 transition-all cursor-pointer font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-widest font-black text-slate-500 mb-1">Special Preferences / Notes</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Vegetarian diet, anniversary setup"
                    value={newResNotes}
                    onChange={(e) => setNewResNotes(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-250 outline-none p-2.5 rounded-xl text-xs focus:bg-white focus:border-purple-500 transition-all resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-purple-700 hover:bg-purple-600 border-none rounded-xl text-white font-mono text-[11px] font-black uppercase cursor-pointer tracking-wider shadow-sm transition-all text-center"
                >
                  Confirm Table Reservation
                </button>
              </form>
            </div>

            {/* Right Column: HotelPMS Style Reservation Grid View */}
            <div className="lg:col-span-8 space-y-4 font-sans">
              <div className="bg-gradient-to-tr from-purple-900 to-indigo-950 text-white rounded-3xl p-6 border border-slate-800 shadow-sm relative overflow-hidden">
                <div className="absolute right-0 top-0 translate-x-1/4 -translate-y-1/4 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
                <div className="flex justify-between items-start relative z-10">
                  <div>
                    <strong className="text-[10px] font-mono text-purple-300 uppercase tracking-widest block font-bold">RESTAURANT FORECAST PLANNER</strong>
                    <h3 className="text-lg font-black tracking-tight text-white mt-0.5">Hotel-Inspired Guest Reservation Board</h3>
                    <p className="text-[11px] text-purple-200 leading-relaxed max-w-lg mt-1 font-sans">
                      Correlate upcoming tables blockings, guest arrival timestamps, and seat vacancies live. Update booking states instantly.
                    </p>
                  </div>
                  <div className="bg-white/10 p-3 rounded-2xl text-center">
                    <p className="text-[9px] uppercase font-mono text-purple-205 tracking-wider">Total Booked</p>
                    <span className="text-xl font-black font-mono text-white">{reservations.length}</span>
                  </div>
                </div>
              </div>

              {/* Reservations entries table */}
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="p-4 bg-slate-50 border-b border-slate-205 flex justify-between items-center">
                  <span className="text-xs font-black text-slate-900 uppercase tracking-wider">Reservation Logs ({reservations.length})</span>
                  <div className="flex space-x-2 text-[10.5px]">
                    <span className="flex items-center space-x-1.5"><span className="w-2.5 h-2.5 bg-yellow-400 rounded-full inline-block" /> <span className="text-slate-600 font-bold">Pending</span></span>
                    <span className="flex items-center space-x-1.5"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-full inline-block" /> <span className="text-slate-600 font-bold">Active</span></span>
                  </div>
                </div>

                <div className="divide-y divide-slate-150 overflow-x-auto">
                  {reservations.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 italic">No table reservations logged.</div>
                  ) : (
                    <table className="w-full text-left text-xs text-slate-705 min-w-[600px] border-none">
                      <thead className="bg-slate-50 font-mono text-[9.5px] uppercase text-slate-400 border-b border-slate-150">
                        <tr>
                          <th className="p-4">Guest Info</th>
                          <th className="p-4">Table Code</th>
                          <th className="p-4">Seating size</th>
                          <th className="p-4">Date/Time Slot</th>
                          <th className="p-4">State Status</th>
                          <th className="p-4 text-center">Operation Control</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {reservations.map(res => (
                          <tr key={res.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4">
                              <span className="font-extrabold text-slate-800 block text-xs">{res.customerName}</span>
                              <span className="text-[10px] font-mono text-slate-450">{res.customerPhone}</span>
                            </td>
                            <td className="p-4 font-mono font-black text-slate-805">
                              {res.tableId}
                            </td>
                            <td className="p-4 font-bold text-slate-700">
                              👨‍👩‍👦 {res.guestCount} Pax
                            </td>
                            <td className="p-4 text-slate-600">
                              <span className="block font-mono text-[10.5px] font-bold text-slate-800">{res.date}</span>
                              <span className="block text-[10px] font-mono text-slate-400">⏰ {res.time}</span>
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                res.status === 'Pending' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                                res.status === 'Active' ? 'bg-emerald-100 text-emerald-800 border-emerald-250 animate-pulse' :
                                res.status === 'Cancelled' ? 'bg-rose-100 text-rose-800 border-red-200' :
                                'bg-slate-100 text-slate-800 border-slate-200'
                              }`}>
                                {res.status}
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              <div className="flex items-center justify-center gap-1.5 flex-nowrap">
                                {res.status === 'Pending' && (
                                  <button
                                    onClick={() => {
                                      // Seat Guest
                                      setReservations(prev => prev.map(r => r.id === res.id ? { ...r, status: 'Active' } : r));
                                      setTables(prev => prev.map(t => t.id === res.tableId ? {
                                        ...t,
                                        status: 'Occupied',
                                        currentOrderId: `ORD-RES-${Math.floor(Math.random()*800)+100}`,
                                        waiterName: 'Steward Reservator',
                                        guestCount: res.guestCount
                                      } : t));
                                      
                                      addTerminalLog(`PM Seated: Seated ${res.customerName} on ${res.tableId}. Created seat bill.`);
                                    }}
                                    className="px-2 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-[9px] uppercase font-bold cursor-pointer hover:bg-emerald-100 transition-all font-mono"
                                  >
                                    Seat Guest
                                  </button>
                                )}
                                
                                {res.status !== 'Cancelled' && res.status !== 'Completed' && (
                                  <button
                                    onClick={() => {
                                      setReservations(prev => prev.map(r => r.id === res.id ? { ...r, status: 'Cancelled' } : r));
                                      setTables(prev => prev.map(t => t.id === res.tableId ? { ...t, status: 'Available' } : t));
                                      addTerminalLog(`PM Revoke: Revoked booking ${res.id} for ${res.customerName}`);
                                    }}
                                    className="px-2 py-1 bg-rose-50 text-rose-800 border border-red-200 rounded-lg text-[9px] uppercase font-bold cursor-pointer hover:bg-rose-100 transition-all font-mono"
                                  >
                                    Cancel
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setReservations(prev => prev.filter(r => r.id !== res.id));
                                    addTerminalLog(`PM Delete: Erased booking record ${res.id}`);
                                  }}
                                  className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg border-none cursor-pointer"
                                  title="Delete Record"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* --- NEW TAB: DELIVERY DISPATCH SYSTEM --- */}
      {activeSubTab === 'deliveries' && (
        <div className="space-y-6">
          
          {/* Statistics summary row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in font-sans">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
              <span className="text-[9.5px] font-mono text-slate-450 uppercase font-bold tracking-widest block">Active Deliveries</span>
              <h2 className="text-xl font-black text-slate-800 mt-1">{deliveryOrders.length} Orders</h2>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
              <span className="text-[9.5px] font-mono text-slate-450 uppercase font-bold tracking-widest block">Pending Dispatch</span>
              <h2 className="text-xl font-black text-amber-600 mt-1">{deliveryOrders.filter(o => o.deliveryDetails?.status === 'Pending').length} Orders</h2>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
              <span className="text-[9.5px] font-mono text-slate-450 uppercase font-bold tracking-widest block">On transit / Dispatched</span>
              <h2 className="text-xl font-black text-sky-600 mt-1">{deliveryOrders.filter(o => o.deliveryDetails?.status === 'Dispatched').length} Riders</h2>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
              <span className="text-[9.5px] font-mono text-slate-450 uppercase font-bold tracking-widest block">Delivered Today</span>
              <h2 className="text-xl font-black text-emerald-600 mt-1">{deliveryOrders.filter(o => o.deliveryDetails?.status === 'Delivered').length} Completed</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-sans">
            
            {/* Left Box: Simple Dispatcher Order Trigger Panel */}
            <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Create Delivery Dispatch</h3>
                <p className="text-[11px] text-slate-400">Add delivery order.</p>
              </div>

              {activeOrderItems.length === 0 ? (
                <div className="p-6 bg-slate-50 border border-slate-200 text-center rounded-2xl space-y-2">
                  <ShoppingBag className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-[11px] text-slate-700 font-bold">Basket Till is Empty</p>
                  <p className="text-[9.5px] text-slate-450 leading-relaxed">Pick dishes from menu.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  
                  {/* Selected items overview */}
                  <div className="p-3 bg-stone-50 border border-slate-150 rounded-2xl space-y-1.5 max-h-[160px] overflow-y-auto">
                    <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-black block">Basket items for dispatch:</span>
                    {activeOrderItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[11px]">
                        <span className="font-extrabold text-slate-800">{item.qty}x {item.name}</span>
                        <span className="font-mono text-slate-600 font-bold">{currencyValue(item.price * item.qty)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Delivery Info form */}
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (!deliveryAddress) return;
                    
                    setIsDeliveryOrder(true);
                    setSelectedOrderSource('Cashier Till');
                    
                    // Trigger submission
                    handleSubmitPosOrder(e);
                  }} className="space-y-3.5 text-xs">
                    <div>
                      <label className="block text-[10px] uppercase font-mono tracking-widest font-black text-slate-500 mb-1">Customer Info Name & Phone</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Name"
                          value={deliveryCustomerName}
                          onChange={(e) => setDeliveryCustomerName(e.target.value)}
                          className="bg-slate-50 border border-slate-205 outline-none p-2.5 rounded-xl text-xs w-full focus:bg-white focus:border-sky-500"
                        />
                        <input
                          type="text"
                          required
                          placeholder="Phone number"
                          value={deliveryCustomerPhone}
                          onChange={(e) => setDeliveryCustomerPhone(e.target.value)}
                          className="bg-slate-50 border border-slate-205 outline-none p-2.5 rounded-xl text-xs w-full focus:bg-white focus:border-sky-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-mono tracking-widest font-black text-slate-500 mb-1">Detailed Shipping Address</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Mikocheni B, Plot 520, Dar es Salaam"
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-205 outline-none p-2.5 rounded-xl text-xs focus:bg-white focus:border-sky-500 transition-all font-sans"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] uppercase font-mono tracking-widest font-black text-slate-500 mb-1">Surcharge Cost (TZS)</label>
                        <input
                          type="number"
                          value={deliveryCostVal}
                          onChange={(e) => setDeliveryCostVal(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-205 outline-none p-2.5 rounded-xl text-xs focus:bg-white focus:border-sky-500 transition-all font-mono"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-[10px] uppercase font-mono tracking-widest font-black text-slate-500 mb-1">Assign Dispatcher Rider</label>
                        <select
                          value={deliveryRider}
                          onChange={(e) => {
                            setDeliveryRider(e.target.value);
                            setDeliveryRiderPhone(e.target.value === 'Iddi Driver' ? '0711559900' : '0788334455');
                          }}
                          className="w-full bg-slate-50 border border-slate-205 outline-none p-2.5 rounded-xl text-xs font-sans cursor-pointer focus:bg-white focus:border-sky-555"
                        >
                          <option value="Iddi Driver">Iddi Driver (0711559900)</option>
                          <option value="Faraji Rider">Faraji Rider (0788334455)</option>
                        </select>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 bg-sky-600 hover:bg-sky-500 border-none rounded-xl text-white font-mono text-[10.5px] font-black uppercase cursor-pointer tracking-wider shadow-sm transition-all text-center"
                    >
                      Dispatch Delivery Order
                    </button>
                  </form>

                </div>
              )}
            </div>

            {/* Right Box: Delivery dispatch live tracking cards list */}
            <div className="lg:col-span-8 space-y-4">
              
              {/* Filter Row */}
              <div className="flex bg-white p-2 rounded-2xl border border-slate-200 text-xs font-bold gap-1 shadow-xs font-sans">
                {(['all', 'pending', 'dispatched', 'delivered'] as const).map(tab => (
                  <button
                    type="button"
                    key={tab}
                    onClick={() => setSelectedDeliveryTab(tab)}
                    className={`px-4 py-2 rounded-xl uppercase tracking-wider text-[10px] border-none font-mono cursor-pointer transition-colors ${
                      selectedDeliveryTab === tab 
                        ? 'bg-slate-900 text-white' 
                        : 'bg-white text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {tab} orders
                  </button>
                ))}
              </div>

              {/* Delivery orders list */}
              {(() => {
                const filteredDeliveries = deliveryOrders.filter(o => {
                  if (selectedDeliveryTab === 'all') return true;
                  return o.deliveryDetails?.status.toLowerCase() === selectedDeliveryTab;
                });

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredDeliveries.length === 0 ? (
                      <div className="p-8 bg-white border border-slate-200 rounded-3xl text-center text-slate-400 italic col-span-2 shadow-xs">No matched delivery orders on this queue.</div>
                    ) : (
                      filteredDeliveries.map(ord => {
                        const itemsTxt = ord.items.map(i => `${i.qty}x ${i.name}`).join(', ');
                        
                        return (
                          <div key={ord.id} className="bg-white border border-slate-205 p-5 rounded-3xl shadow-xs hover:border-sky-400 transition-all space-y-3 flex flex-col justify-between">
                            <div className="space-y-2">
                              
                              {/* Card Header metadata */}
                              <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                                <div>
                                  <span className="text-[10px] font-mono text-slate-400 block font-bold">{ord.id}</span>
                                  <span className="text-xs font-black text-slate-800">{ord.deliveryDetails?.riderName || 'Unassigned Rider'}</span>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black font-mono uppercase border ${
                                  ord.deliveryDetails?.status === 'Pending' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                                  ord.deliveryDetails?.status === 'Dispatched' ? 'bg-sky-50 text-sky-800 border-sky-200 animate-pulse' :
                                  'bg-emerald-50 text-emerald-800 border-emerald-250'
                                }`}>
                                  {ord.deliveryDetails?.status}
                                </span>
                              </div>

                              {/* Order details */}
                              <div className="text-[11.5px] space-y-1 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                <p className="text-slate-700 font-sans"><strong className="text-slate-850">Address:</strong> {ord.deliveryDetails?.address}</p>
                                <p className="text-slate-705 font-sans"><strong className="text-slate-850">Dishes:</strong> {itemsTxt}</p>
                                {ord.comments && (
                                  <p className="text-[10px] italic text-slate-450 font-mono mt-1">Note: "{ord.comments}"</p>
                                )}
                              </div>

                              {/* Sum and cost indicators */}
                              <div className="flex justify-between items-center text-[11px] font-mono px-1">
                                <span className="text-slate-400 font-bold uppercase">Price + Deliv:</span>
                                <span className="font-extrabold text-slate-800 text-xs">{currencyValue(ord.totalBill)} (fee: {currencyValue(ord.deliveryDetails?.deliveryCost || 2000)})</span>
                              </div>
                            </div>

                            {/* Actions footer */}
                            <div className="flex gap-2 pt-2 border-t border-slate-150 mt-2">
                              {ord.deliveryDetails?.status === 'Pending' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeliveryOrders(prev => prev.map(o => o.id === ord.id ? {
                                      ...o,
                                      deliveryDetails: { ...o.deliveryDetails!, status: 'Dispatched' }
                                    } : o));
                                    addTerminalLog(`Deliveries: Dispatched rider ${ord.deliveryDetails?.riderName} with package ${ord.id}!`);
                                  }}
                                  className="w-full py-2 bg-sky-655 hover:bg-sky-750 text-white border-none rounded-xl text-[10px] font-bold uppercase cursor-pointer text-center"
                                >
                                  Dispatch Rider
                                </button>
                              )}

                              {ord.deliveryDetails?.status === 'Dispatched' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeliveryOrders(prev => prev.map(o => o.id === ord.id ? {
                                      ...o,
                                      deliveryDetails: { ...o.deliveryDetails!, status: 'Delivered' },
                                      paymentStatus: 'Paid'
                                    } : o));
                                    addTerminalLog(`Deliveries: Package ${ord.id} delivered. Received payment ${currencyValue(ord.totalBill)} successfully!`);
                                  }}
                                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white border-none rounded-xl text-[10px] font-bold uppercase cursor-pointer text-center"
                                >
                                  Complete Delivery
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  // Cancel delivery order
                                  setDeliveryOrders(prev => prev.filter(o => o.id !== ord.id));
                                  // Clear associated KDS tickets
                                  setTickets(prev => prev.filter(t => t.orderId !== ord.id));
                                  addTerminalLog(`Deliveries Alert: Cancelled delivery order ${ord.id}. Returning items to chef.`);
                                }}
                                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-red-200 rounded-xl text-[10px] font-extrabold uppercase cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>

                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })()}

            </div>

          </div>
        </div>
      )}

      {/* 🔴 LIVE MANAGEMENT RADAR: TABLE INSPECTOR & ORDER ACTIVITY TRACKER */}
      {inspectingTable && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header branding */}
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0 border-none">
              <div className="flex items-center space-x-2">
                <span className="p-2 bg-gradient-to-tr from-rose-500 to-amber-500 rounded-xl text-white animate-pulse">
                  <Activity className="w-4 h-4" />
                </span>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-white">🔴 LIVE MANAGEMENT RADAR</h4>
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold">Inspecting: {inspectingTable.id}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setInspectingTable(null);
                  setMgmtCommentInput('');
                }}
                className="p-1.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono text-[10px] uppercase font-black cursor-pointer transition-all border-none"
              >
                Close Radar
              </button>
            </div>

            {/* Content Viewport */}
            <div className="p-6 overflow-y-auto space-y-5 flex-grow bg-slate-50">
              
              {/* Quick status banner */}
              <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[9px] font-mono uppercase text-slate-400 block font-bold">Physical Table State</span>
                  <p className="text-sm font-black text-slate-805">{inspectingTable.id} • Max Capacity {inspectingTable.capacity} Pax</p>
                </div>
                <div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                    inspectingTable.status === 'Occupied' ? 'bg-amber-150 text-amber-805 border-amber-250 font-bold' :
                    inspectingTable.status === 'Awaiting Food' ? 'bg-blue-100 text-blue-805 border-blue-200 font-bold' :
                    inspectingTable.status === 'Reserved' ? 'bg-purple-100 text-purple-805 border-purple-200 font-bold' :
                    inspectingTable.status === 'Dirty' ? 'bg-red-100 text-rose-805 border-red-200 animate-pulse font-bold' :
                    'bg-emerald-100 text-emerald-850 border-emerald-250 font-bold'
                  }`}>
                    {inspectingTable.status === 'Occupied' ? 'Dining now' : inspectingTable.status}
                  </span>
                </div>
              </div>

              {/* Outstanding current customer order */}
              {(() => {
                const matchedUnpaidOrd = orders.find(o => o.tableId === inspectingTable.id && o.paymentStatus === 'Unpaid');
                
                if (matchedUnpaidOrd) {
                  const baseItemsSum = matchedUnpaidOrd.items.reduce((s, c) => s + (c.price * c.qty), 0);
                  const grandTotal = matchedUnpaidOrd.totalBill;
                  
                  return (
                    <div className="space-y-4">
                      
                      {/* Order general metadata */}
                      <div className="bg-slate-900 text-slate-105 p-4 rounded-3xl space-y-2 border border-slate-800 shadow-sm relative overflow-hidden text-slate-200">
                        <div className="absolute right-0 top-0 translate-x-1/4 -translate-y-1/4 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />
                        
                        <div className="flex justify-between items-center border-b border-slate-800 pb-2 relative z-10 text-xs">
                          <div>
                            <span className="text-[9px] font-mono text-slate-500 block">Unique Code ID</span>
                            <span className="font-extrabold font-mono text-slate-200">{matchedUnpaidOrd.id}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] font-mono text-slate-500 block">Order Origin Hub</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                              matchedUnpaidOrd.orderSource === 'QR Code' 
                                ? 'bg-amber-500/20 text-amber-300' 
                                : matchedUnpaidOrd.orderSource === 'Cashier Till'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : 'bg-teal-500/20 text-teal-300'
                            }`}>
                              {matchedUnpaidOrd.orderSource === 'QR Code' ? '📱 QR Code' : matchedUnpaidOrd.orderSource === 'Cashier Till' ? '🖥️ Cashier Register' : '💼 Waiter Device'}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-1 relative z-10 text-[11px] font-mono text-slate-300">
                          <div>
                            <span className="text-slate-400 block text-[9.5px]">Assigned Steward:</span>
                            <span className="text-white font-bold">{matchedUnpaidOrd.waiterName || 'Steward Desk'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[9.5px]">Cook State on Pass:</span>
                            <span className="uppercase text-orange-400 font-extrabold block animate-pulse">{matchedUnpaidOrd.status}</span>
                          </div>
                        </div>

                        {matchedUnpaidOrd.comments && (
                          <div className="bg-slate-955 p-2.5 rounded-xl border border-slate-850 mt-2 text-[10.5px]">
                            <span className="text-orange-400 font-black block text-[9.5px] uppercase font-mono mb-1">📝 Manager/Guest Comment Log:</span>
                            <p className="text-slate-300 italic">" {matchedUnpaidOrd.comments} "</p>
                          </div>
                        )}
                      </div>

                      {/* Items ordered container list */}
                      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3">
                        <p className="text-[10px] font-mono font-bold text-slate-450 uppercase tracking-widest border-b border-slate-100 pb-1.5 flex justify-between">
                          <span>Items compile in bill</span>
                          <span>{matchedUnpaidOrd.items.length} dishes</span>
                        </p>
                        
                        <div className="space-y-2 divide-y divide-slate-100">
                          {matchedUnpaidOrd.items.map((it, idx) => (
                            <div key={idx} className="pt-2 flex justify-between items-center text-xs">
                              <div>
                                <p className="font-extrabold text-slate-800">{it.qty}x {it.name}</p>
                                <p className="text-[9.5px] font-mono text-slate-450">{currencyValue(it.price)} each {it.notes ? `• Note: ${it.notes}` : ''}</p>
                              </div>
                              <div className="text-right">
                                <span className="font-mono text-slate-800 font-bold">{currencyValue(it.price * it.qty)}</span>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Order mathematical calculations summary */}
                        <div className="bg-slate-50 border border-slate-150 p-3 rounded-2xl font-mono text-[10.5px] space-y-1.5 mt-4">
                          <div className="flex justify-between text-slate-500">
                            <span>Subtotal Items:</span>
                            <span>{currencyValue(baseItemsSum)}</span>
                          </div>
                          <div className="flex justify-between text-slate-500">
                            <span>Service Surcharge card (5%):</span>
                            <span>{currencyValue(matchedUnpaidOrd.extraServiceCharge)}</span>
                          </div>
                          <div className="flex justify-between font-extrabold text-slate-800 border-t border-slate-200 pt-2 text-xs mt-1.5">
                            <span>Total Outstanding Bill (TZS):</span>
                            <span className="text-emerald-700">{currencyValue(grandTotal)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Interactive Comments & Notes updating */}
                      <div className="bg-white rounded-3xl p-5 border border-slate-200 space-y-3">
                        <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest block text-slate-500">Write Guest Comment / Kitchen Instructions</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Order notes..."
                            value={mgmtCommentInput}
                            onChange={(e) => setMgmtCommentInput(e.target.value)}
                            className="bg-slate-50 border border-slate-200 outline-none p-2 rounded-xl text-xs w-full focus:bg-white focus:border-orange-500"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!mgmtCommentInput.trim()) return;
                              setOrders(prev => prev.map(o => o.id === matchedUnpaidOrd.id ? { ...o, comments: mgmtCommentInput } : o));
                              addTerminalLog(`Management: Recorded custom comment on ${matchedUnpaidOrd.id}: "${mgmtCommentInput}"`);
                              setMgmtCommentInput('');
                              setInspectingTable(prev => prev ? { ...prev } : null); // refresh visual
                            }}
                            className="bg-slate-900 border-none hover:bg-slate-850 text-white font-mono text-[10px] px-3.5 rounded-xl cursor-pointer font-bold uppercase"
                          >
                            Add Note
                          </button>
                        </div>
                      </div>

                      {/* Cancel / Void order mechanisms */}
                      <div className="bg-red-50 border border-red-150 p-5 rounded-3xl space-y-3">
                        <h6 className="text-xs font-black text-rose-800 uppercase tracking-widest flex items-center space-x-1.5">
                          <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
                          <span>Management Void Operations</span>
                        </h6>
                        <p className="text-[10.5px] text-rose-700 leading-relaxed font-sans">
                          If the customer cancels or this was a dummy entry, you can void this order immediately. This halts kitchen tickets and returns the table to Available.
                        </p>
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              // Cancel / Delete Order
                              setOrders(prev => prev.filter(o => o.id !== matchedUnpaidOrd.id));
                              // Remove KDS tickets
                              setTickets(prev => prev.filter(t => t.orderId !== matchedUnpaidOrd.id));
                              // Release table
                              setTables(prev => prev.map(t => t.id === inspectingTable.id ? {
                                ...t,
                                status: 'Available',
                                currentOrderId: undefined,
                                waiterName: undefined,
                                guestCount: undefined
                              } : t));
                              
                              addTerminalLog(`🚨 VOID: Management voided order ${matchedUnpaidOrd.id}. Kitchen fire extinguished.`);
                              setInspectingTable(null);
                            }}
                            className="bg-rose-600 hover:bg-rose-700 text-white font-mono text-[10px] font-extrabold py-2.5 px-4 rounded-xl flex-grow border-none cursor-pointer uppercase tracking-tight"
                          >
                            Void Order & Free Table
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => {
                              // Rush KDS Order
                              setTickets(prev => prev.map(t => t.orderId === matchedUnpaidOrd.id ? { ...t, status: 'Cooking', chefAssignee: '🚨 EXEC CHEF PRIORITY' } : t));
                              addTerminalLog(`RUSH: Accelerated preparation queue for order ${matchedUnpaidOrd.id}`);
                              setInspectingTable(null);
                            }}
                            className="bg-amber-500 hover:bg-amber-600 font-mono text-[10px] font-extrabold py-2.5 px-3 rounded-xl text-black border-none cursor-pointer uppercase tracking-tight"
                          >
                            ⚡ Rush Cook
                          </button>
                        </div>
                      </div>

                    </div>
                  );
                } else {
                  // EMPTY TABLE VIEW - SHOW CURRENT OCCUPANCY STATUS MODIFIERS & RESERVATIONS
                  const tableReservations = reservations.filter(r => r.tableId === inspectingTable.id && r.status !== 'Completed' && r.status !== 'Cancelled');
                  
                  return (
                    <div className="space-y-4">
                      
                      {/* Empty table card */}
                      <div className="p-8 text-center bg-white border border-slate-200 rounded-3xl space-y-3.5">
                        <Utensils className="w-10 h-10 text-slate-350 mx-auto" />
                        <div>
                          <strong className="text-xs font-mono font-black uppercase text-slate-400 tracking-wider">No Outstanding Dine-In Bill</strong>
                          <h6 className="text-sm font-bold text-slate-800 mt-1">Ready for Incoming Customers</h6>
                          <p className="text-[10.5px] text-slate-500 max-w-xs mx-auto leading-relaxed mt-1">Table is ready.</p>
                        </div>
                        
                        {/* Status switching buttons */}
                        <div className="flex justify-center gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setTables(prev => prev.map(t => t.id === inspectingTable.id ? { ...t, status: 'Available' } : t));
                              addTerminalLog(`Management: Set ${inspectingTable.id} status to Available`);
                              setInspectingTable(prev => prev ? { ...prev, status: 'Available' } : null);
                            }}
                            className="px-3 py-1.5 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded-xl text-[10px] font-bold uppercase transition-all border border-emerald-200 cursor-pointer"
                          >
                            Available
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setTables(prev => prev.map(t => t.id === inspectingTable.id ? { ...t, status: 'Dirty' } : t));
                              addTerminalLog(`Management: Set ${inspectingTable.id} status to Dirty for cleaning`);
                              setInspectingTable(prev => prev ? { ...prev, status: 'Dirty' } : null);
                            }}
                            className="px-3 py-1.5 bg-rose-50 text-rose-800 hover:bg-rose-100 rounded-xl text-[10px] font-bold uppercase transition-all border border-red-200 cursor-pointer"
                          >
                            Dirty
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setTables(prev => prev.map(t => t.id === inspectingTable.id ? { ...t, status: 'Reserved' } : t));
                              addTerminalLog(`Management: Set ${inspectingTable.id} status to Reserved`);
                              setInspectingTable(prev => prev ? { ...prev, status: 'Reserved' } : null);
                            }}
                            className="px-3 py-1.5 bg-purple-50 text-purple-800 hover:bg-purple-100 rounded-xl text-[10px] font-bold uppercase transition-all border border-purple-200 cursor-pointer"
                          >
                            Reserved
                          </button>
                        </div>
                      </div>

                      {/* Reservations upcoming bookings overview */}
                      <div className="bg-white rounded-3xl p-5 border border-slate-200 space-y-3">
                        <span className="text-[10px] font-mono font-bold text-slate-450 uppercase tracking-widest block border-b border-slate-100 pb-1.5">📅 Table Schedule & Bookings Today:</span>
                        {tableReservations.length === 0 ? (
                          <p className="text-[10.5px] text-slate-400 italic">No bookings scheduled on this table today yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {tableReservations.map(res => (
                              <div key={res.id} className="p-3 bg-purple-50/10 border border-purple-200 rounded-xl flex justify-between items-center text-xs">
                                <div>
                                  <p className="font-extrabold text-slate-800">{res.customerName} ({res.guestCount} Covery)</p>
                                  <p className="text-[9.5px] font-mono text-slate-450">{res.date} at {res.time} | Tel: {res.customerPhone}</p>
                                </div>
                                <span className="bg-purple-550 text-white font-mono text-[9px] px-2 py-0.5 rounded font-black uppercase">Reserved</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>
                  );
                }
              })()}

            </div>

            {/* Modal Footer with quick closing */}
            <div className="p-4.5 bg-slate-100 border-t border-slate-205 text-right shrink-0 border-none">
              <button
                type="button"
                onClick={() => {
                  setInspectingTable(null);
                  setMgmtCommentInput('');
                }}
                className="p-2.5 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-mono text-xs uppercase font-extrabold cursor-pointer border-none"
              >
                Done Inspecting
              </button>
            </div>

          </div>
        </div>
      )}

      {/* RESTAURANT THERMAL RECEIPT POPUP DIALOG */}
      {isRestaurantReceiptOpen && restaurantReceiptSale && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header branding */}
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-2">
                <Receipt className="w-5 h-5 text-emerald-400" />
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-white">RESTAURANT GUEST RECEIPT</h4>
                  <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-bold">Orvix Dining Station</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRestaurantReceiptOpen(false)}
                className="p-1 px-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono text-[10px] uppercase font-bold cursor-pointer transition-colors border-none"
              >
                Close
              </button>
            </div>

            {/* Reciept graphic inside custom viewport */}
            <div className="p-6 overflow-y-auto space-y-6 flex-grow bg-slate-50">
              <div className="bg-white text-slate-905 p-5 rounded-3xl font-mono text-xs space-y-4 shadow-md border-dashed border-2 border-slate-250">
                <div className="text-center space-y-1 border-b border-dashed border-slate-200 pb-3">
                  <h5 className="font-bold text-sm uppercase">{activeTenant.name}</h5>
                  <p className="text-[10.5px] text-slate-500">{activeTenant.city}, {activeTenant.country}</p>
                  <p className="text-[9.5px] text-slate-500">Tel: +254 (0) 700 9000</p>
                </div>

                <div className="space-y-1 text-[10.5px] border-b border-dashed border-slate-200 pb-2">
                  <div className="flex justify-between">
                    <span>Receipt Ref:</span>
                    <span className="font-bold">{restaurantReceiptSale.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Date & Time:</span>
                    <span>{new Date(restaurantReceiptSale.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Table No:</span>
                    <span className="font-bold">{restaurantReceiptSale.reference?.replace('REST-FOLIO-', '') || 'Table'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cashier/Server:</span>
                    <span>{restaurantReceiptSale.cashierName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Payment Way:</span>
                    <span className="font-black text-emerald-700 uppercase bg-emerald-55 px-1 py-0.5 rounded text-[10px] inline-block">{restaurantReceiptSale.paymentMethod}</span>
                  </div>
                </div>

                {/* Items checklist */}
                <div className="space-y-2 border-b border-dashed border-slate-200 pb-3">
                  <div className="grid grid-cols-12 font-bold text-[10px]">
                    <span className="col-span-6 text-left">Dish / Drink Description</span>
                    <span className="col-span-2 text-center">Qty</span>
                    <span className="col-span-4 text-right">Amount</span>
                  </div>
                  {restaurantReceiptSale.items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 text-[10.5px] gap-y-0.5 text-slate-700">
                      <span className="col-span-6 text-left line-clamp-1">{item.productName}</span>
                      <span className="col-span-2 text-center">{item.qty}</span>
                      <span className="col-span-4 text-right">
                        {activeTenant.currency || 'TSh '}{(item.price * item.qty).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Bill details */}
                <div className="space-y-1 text-right font-bold text-[11px] text-slate-700">
                  {(() => {
                    const isVat = restaurantReceiptSale.vatStatus === 'vat';
                    const taxAmt = restaurantReceiptSale.tax || 0;
                    const surchargeAmt = Math.round((restaurantReceiptSale.total - taxAmt) * 0.05 / 1.05);
                    const subtotalBase = restaurantReceiptSale.total - taxAmt - surchargeAmt;

                    return (
                      <>
                        <div className="flex justify-between font-normal text-slate-500">
                          <span>Subtotal Items:</span>
                          <span>{activeTenant.currency || 'TSh '}{subtotalBase.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between font-normal text-slate-500">
                          <span>Surcharge Fee (5%):</span>
                          <span>{activeTenant.currency || 'TSh '}{surchargeAmt.toLocaleString()}</span>
                        </div>
                        {isVat && (
                          <div className="flex justify-between font-normal text-emerald-700">
                            <span>VAT ({Math.round(activeTenant.taxRate * 100)}%):</span>
                            <span>{activeTenant.currency || 'TSh '}{taxAmt.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-xs border-t border-slate-105 pt-2 text-slate-900 font-extrabold">
                          <span>GRAND TOTAL:</span>
                          <span>{activeTenant.currency || 'TSh '}{restaurantReceiptSale.total.toLocaleString()}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>

                <div className="text-center font-normal text-[8.5px] text-slate-400 border-t border-dashed border-slate-200 pt-3 space-y-0.5">
                  <p>Asante kwa kutembelea Orvix!</p>
                  <p className="uppercase tracking-wider">Cloud Synchronized Dining Node</p>
                </div>
              </div>

              {/* Digital WhatsApp Sharing Input */}
              <div className="bg-emerald-50/40 border border-emerald-100/75 rounded-3xl p-4 space-y-3 shrink-0 text-left">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest block">
                  Send Digital Receipt via WhatsApp
                </span>
                <div className="flex gap-2">
                  <div className="relative flex-grow">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-[11px]">+</span>
                    <input
                      type="text"
                      placeholder="Phone number e.g. 255711223344"
                      value={restaurantReceiptPhone}
                      onChange={(e) => setRestaurantReceiptPhone(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full bg-white border border-slate-250 rounded-xl text-xs pl-6 pr-3 py-2.5 text-slate-800 focus:outline-none focus:border-emerald-500 font-mono placeholder:font-sans placeholder:text-slate-400"
                    />
                  </div>
                  
                  {(() => {
                    const msg = `🧾 *RECEIPT: ${restaurantReceiptSale.id}* at *${activeTenant.name}*\n` +
                      `📅 Date: ${new Date().toLocaleString()}\n` +
                      `💵 Paid Total: ${activeTenant.currency || 'TSh '}${restaurantReceiptSale.total.toLocaleString()} (${restaurantReceiptSale.paymentMethod})\n` +
                      `\nThanks for choosing us! Hope to see you again soon.`;
                    const link = `https://api.whatsapp.com/send?phone=${restaurantReceiptPhone || ''}&text=${encodeURIComponent(msg)}`;
                    return (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shadow-sm text-center justify-center decoration-transparent"
                      >
                        <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                        <span>Share Receipt</span>
                      </a>
                    );
                  })()}
                </div>
                <p className="text-[8.5px] text-slate-450 leading-relaxed font-sans">
                  Leave country code if already prefixed. Direct share formats compatible with mobile and web clients.
                </p>
              </div>

              {/* Action Buttons: Print thermal receipt or complete */}
              <div className="grid grid-cols-2 gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="w-full py-3 bg-white border border-slate-250 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs uppercase cursor-pointer flex items-center justify-center space-x-1.5 transition-colors font-sans"
                >
                  <Printer className="w-4 h-4 text-slate-500" />
                  <span>Print Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsRestaurantReceiptOpen(false)}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs uppercase cursor-pointer transition-colors font-sans border-none"
                >
                  Finish & Settle
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Tra and Compliance footnote indicator */}
      <div className="bg-slate-50 border border-slate-200 p-4.5 rounded-3xl flex items-center space-x-3 text-slate-450 text-[11px]">
        <AlertCircle className="w-4 h-4 text-slate-500 shrink-0" />
        <p className="leading-snug">
          <strong>Offline-Buffer Cache Notice</strong>: If Cloud Run containers drop internet connection to Supabase or your Postgres instance, the offline ledger queue continues saving dining table states in client memory, so you never lose high fire service revenue.
        </p>
      </div>

    </div>
  );
}
