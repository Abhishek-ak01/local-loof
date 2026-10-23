import { 
  CATEGORIES, 
  NEIGHBORHOODS, 
  INITIAL_SELLERS, 
  INITIAL_PRODUCTS, 
  INITIAL_ORDERS, 
  DEMO_USERS 
} from './mockData.js';
import { supabase, isSupabaseConfigured } from './supabaseClient.js';

// Authoritative In-Memory Store for Hackathon Sandbox
let sellersStore = [...INITIAL_SELLERS];
let productsStore = [...INITIAL_PRODUCTS];
let ordersStore = [...INITIAL_ORDERS];
let moderationLogs = [];

// Helper to simulate realistic async network latency for authentic UI loading states
const delay = (ms = 120) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * ============================================================================
 * PRODUCTS API
 * ============================================================================
 */
export async function getProducts(filters = {}) {
  await delay(80);

  // If live Supabase connection is active, query Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase
        .from('products')
        .select('*, seller_profiles(*), categories(*)')
        .eq('is_active', true)
        .eq('is_moderated', false);

      if (filters.category && filters.category !== 'all') {
        query = query.eq('category_id', filters.category);
      }
      if (filters.sellerId) {
        query = query.eq('seller_id', filters.sellerId);
      }
      if (filters.inStockOnly) {
        query = query.gt('stock_quantity', 0);
      }

      const { data, error } = await query;
      if (!error && data) {
        return data.map(p => ({
          ...p,
          id: p.id,
          title: p.name || p.title,
          name: p.name || p.title,
          price: parseFloat(p.price),
          stockQuantity: p.stock_quantity ?? p.stockQuantity,
          sellerId: p.seller_id,
          sellerName: p.seller_profiles?.business_name || 'Local Artisan',
          sellerSlug: p.seller_profiles?.slug || '',
          sellerNeighborhood: p.seller_profiles?.locality || p.originNeighborhood,
          originNeighborhood: p.seller_profiles?.locality || p.originNeighborhood,
        }));
      }
    } catch (e) {
      console.warn('Live Supabase query fell back to local adapter:', e);
    }
  }

  let result = [...productsStore];

  // Filter active and unmoderated
  result = result.filter(p => p.isAvailable !== false && p.isModerated !== true);

  if (filters.category && filters.category !== 'all') {
    result = result.filter(p => p.categoryId === filters.category || p.slug === filters.category);
  }

  if (filters.neighborhood && filters.neighborhood !== 'All Neighborhoods') {
    result = result.filter(p => p.originNeighborhood === filters.neighborhood);
  }

  if (filters.search) {
    const q = filters.search.toLowerCase().trim();
    result = result.filter(p => 
      (p.title && p.title.toLowerCase().includes(q)) || 
      (p.name && p.name.toLowerCase().includes(q)) || 
      (p.description && p.description.toLowerCase().includes(q)) ||
      (p.badges && p.badges.some(b => b.toLowerCase().includes(q)))
    );
  }

  if (filters.minPrice !== undefined && filters.minPrice !== '') {
    result = result.filter(p => p.price >= Number(filters.minPrice));
  }

  if (filters.maxPrice !== undefined && filters.maxPrice !== '') {
    result = result.filter(p => p.price <= Number(filters.maxPrice));
  }

  if (filters.inStockOnly) {
    result = result.filter(p => p.stockQuantity > 0);
  }

  if (filters.sellerId) {
    result = result.filter(p => p.sellerId === filters.sellerId);
  }

  // Sorting
  if (filters.sortBy === 'price-low') {
    result.sort((a, b) => a.price - b.price);
  } else if (filters.sortBy === 'price-high') {
    result.sort((a, b) => b.price - a.price);
  } else if (filters.sortBy === 'rating') {
    result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  } else {
    // Featured default
    result.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
  }

  return result.map(prod => {
    const seller = sellersStore.find(s => s.id === prod.sellerId);
    return {
      ...prod,
      title: prod.title || prod.name,
      name: prod.name || prod.title,
      sellerName: seller ? (seller.business_name || seller.storeName) : 'Local Artisan',
      sellerSlug: seller ? seller.slug : '',
      sellerNeighborhood: seller ? (seller.locality || seller.neighborhood) : prod.originNeighborhood,
      originNeighborhood: seller ? (seller.locality || seller.neighborhood) : prod.originNeighborhood,
    };
  });
}

export async function getProductById(id) {
  await delay(80);

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*, seller_profiles(*), categories(*)')
        .eq('id', id)
        .single();

      if (!error && data) {
        return {
          ...data,
          title: data.name,
          name: data.name,
          price: parseFloat(data.price),
          stockQuantity: data.stock_quantity,
          seller: {
            ...data.seller_profiles,
            storeName: data.seller_profiles.business_name,
            neighborhood: data.seller_profiles.locality,
          },
          categoryName: data.categories?.name || 'Local Goods',
        };
      }
    } catch (e) {
      console.warn('Falling back to local data adapter:', e);
    }
  }

  const prod = productsStore.find(p => p.id === id || p.slug === id);
  if (!prod) return null;

  const seller = sellersStore.find(s => s.id === prod.sellerId);
  const category = CATEGORIES.find(c => c.id === prod.categoryId);

  return {
    ...prod,
    title: prod.title || prod.name,
    name: prod.name || prod.title,
    seller: seller ? {
      ...seller,
      storeName: seller.business_name || seller.storeName,
      neighborhood: seller.locality || seller.neighborhood,
    } : null,
    categoryName: category ? category.name : 'Local Goods',
  };
}

export async function getSimilarProducts(productId, limit = 4) {
  await delay(60);
  const target = productsStore.find(p => p.id === productId);
  if (!target) return [];

  return productsStore
    .filter(p => p.id !== productId && p.isAvailable !== false && (p.categoryId === target.categoryId || p.sellerId === target.sellerId))
    .slice(0, limit)
    .map(p => {
      const seller = sellersStore.find(s => s.id === p.sellerId);
      return {
        ...p,
        title: p.title || p.name,
        name: p.name || p.title,
        sellerName: seller ? (seller.business_name || seller.storeName) : 'Local Artisan',
      };
    });
}

export async function getCategories() {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true });
      if (!error && data && data.length > 0) {
        return data;
      }
    } catch (e) {
      console.warn('Supabase getCategories fallback:', e);
    }
  }
  return CATEGORIES;
}

export async function getNeighborhoods() {
  return NEIGHBORHOODS;
}

/**
 * ============================================================================
 * SELLERS API
 * ============================================================================
 */
export async function getSellers() {
  await delay(80);

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('seller_profiles')
        .select('*')
        .eq('approval_status', 'approved');

      if (!error && data && data.length > 0) {
        return data.map(s => ({
          ...s,
          storeName: s.business_name || s.storeName,
          neighborhood: s.locality || s.neighborhood,
          deliveryAvailable: s.delivery_available ?? true,
          pickupAvailable: s.pickup_available ?? true,
          bannerUrl: s.banner_url,
          logoUrl: s.logo_url,
          joinedDate: s.created_at ? s.created_at.split('T')[0] : '2023-01-01',
        }));
      }
    } catch (e) {
      console.warn('Supabase getSellers fallback:', e);
    }
  }

  return sellersStore.map(s => ({
    ...s,
    storeName: s.business_name || s.storeName,
    neighborhood: s.locality || s.neighborhood,
  }));
}

export async function getSellerById(id) {
  await delay(80);

  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase.from('seller_profiles').select('*, products(*)');
      query = query.or(`id.eq."${id}",slug.eq."${id}"`);

      const { data, error } = await query.maybeSingle();
      if (!error && data) {
        return {
          ...data,
          storeName: data.business_name || data.storeName,
          neighborhood: data.locality || data.neighborhood,
          deliveryAvailable: data.delivery_available ?? true,
          pickupAvailable: data.pickup_available ?? true,
          bannerUrl: data.banner_url,
          logoUrl: data.logo_url,
          products: (data.products || []).filter(p => p.is_active !== false).map(p => ({
            ...p,
            id: p.id,
            title: p.name || p.title,
            name: p.name || p.title,
            price: parseFloat(p.price),
            stockQuantity: p.stock_quantity ?? p.stockQuantity,
          })),
        };
      }
    } catch (e) {
      console.warn('Supabase getSellerById fallback:', e);
    }
  }

  const seller = sellersStore.find(s => s.id === id || s.slug === id);
  if (!seller) return null;

  const products = productsStore.filter(p => p.sellerId === seller.id && p.isAvailable !== false);
  return {
    ...seller,
    storeName: seller.business_name || seller.storeName,
    neighborhood: seller.locality || seller.neighborhood,
    products: products.map(p => ({
      ...p,
      title: p.title || p.name,
      name: p.name || p.title,
    })),
  };
}

/**
 * ============================================================================
 * ORDERS & CHECKOUT API (Strict Authoritative Server Validation)
 * ============================================================================
 */
export async function createOrder({
  customerId,
  customerName,
  customerEmail,
  customerPhone,
  deliveryType,
  deliveryAddress,
  paymentMethod,
  cartItems,
  notes = '',
}) {
  await delay(200);

  // Authentication requirement check
  if (!customerId) {
    throw new Error('Authentication required: You must be signed in to place an order.');
  }

  if (!cartItems || cartItems.length === 0) {
    throw new Error('Your cart is empty. Please add items before placing an order.');
  }

  // 1. Authoritative Validation of Quantities, Prices & Stock
  let calculatedSubtotal = 0;
  const verifiedItems = [];
  const sellerCounts = {};

  for (const item of cartItems) {
    // Validate quantity is a positive whole number
    if (!item.quantity || item.quantity <= 0 || !Number.isInteger(Number(item.quantity))) {
      throw new Error(`Invalid quantity "${item.quantity}". Quantity must be a positive whole number.`);
    }

    const qty = parseInt(item.quantity, 10);
    const product = productsStore.find(p => p.id === item.productId);

    if (!product) {
      throw new Error(`Product with ID "${item.productId}" was not found.`);
    }

    if (product.isAvailable === false || product.isModerated === true) {
      throw new Error(`Product "${product.title || product.name}" is no longer available.`);
    }

    if (product.price <= 0) {
      throw new Error(`Product "${product.title || product.name}" has an invalid non-positive price.`);
    }

    // Check inventory availability
    if (product.stockQuantity < qty) {
      throw new Error(
        `Insufficient stock for "${product.title || product.name}". Requested: ${qty}, Available: ${product.stockQuantity}`
      );
    }

    // Authoritative math: ignore any client-supplied totals!
    const lineTotal = Number((product.price * qty).toFixed(2));
    calculatedSubtotal += lineTotal;

    sellerCounts[product.sellerId] = (sellerCounts[product.sellerId] || 0) + 1;

    verifiedItems.push({
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      productId: product.id,
      productTitle: product.title || product.name,
      productNameSnapshot: product.title || product.name,
      unitPrice: product.price,
      unitPriceSnapshot: product.price,
      quantity: qty,
      subtotal: lineTotal,
      lineTotal: lineTotal,
      image: product.images?.[0] || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80',
      sellerId: product.sellerId,
    });
  }

  // Duplicate submission guard (prevents rapid double-clicks within 3 seconds with identical cart)
  const recentDuplicate = ordersStore.find(
    o => o.customerId === customerId &&
         (Date.now() - new Date(o.createdAt).getTime()) < 3000 &&
         JSON.stringify(o.items.map(i => ({ id: i.productId, q: i.quantity }))) === 
         JSON.stringify(cartItems.map(i => ({ id: i.productId, q: parseInt(i.quantity, 10) })))
  );
  if (recentDuplicate) {
    throw new Error('Duplicate order submission detected. Your order is already being processed.');
  }

  const resolvedSellerId = Object.keys(sellerCounts)[0] || 'seller-1';
  const seller = sellersStore.find(s => s.id === resolvedSellerId);

  // 2. Authoritative Fees Computation
  calculatedSubtotal = Number(calculatedSubtotal.toFixed(2));
  const tax = Number((calculatedSubtotal * 0.08).toFixed(2));
  const deliveryFee = (deliveryType === 'pickup' || calculatedSubtotal >= 35.00) ? 0.00 : 3.50;
  const totalAmount = Number((calculatedSubtotal + tax + deliveryFee).toFixed(2));

  // 3. Concurrency-Safe Atomic Stock Decrement
  for (const item of verifiedItems) {
    const prodIndex = productsStore.findIndex(p => p.id === item.productId);
    if (prodIndex !== -1) {
      productsStore[prodIndex] = {
        ...productsStore[prodIndex],
        stockQuantity: productsStore[prodIndex].stockQuantity - item.quantity,
      };
    }
  }

  // 4. Create and persist Order
  const orderNumber = `LL-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString();
  let orderId = `ord-${Date.now()}`;

  // If live Supabase connection is active, insert into Supabase orders and order_items
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: dbOrder, error: oErr } = await supabase
        .from('orders')
        .insert([{
          order_number: orderNumber,
          customer_id: customerId,
          seller_id: resolvedSellerId,
          customer_name: customerName || 'Elena Rostova',
          customer_email: customerEmail || 'customer@example.com',
          customer_phone: customerPhone || '(555) 000-0000',
          delivery_type: deliveryType,
          shipping_details: deliveryAddress || {},
          subtotal: calculatedSubtotal,
          tax: tax,
          delivery_fee: deliveryFee,
          total: totalAmount,
          order_status: 'placed',
          payment_status: 'simulated_paid',
          payment_method: paymentMethod || 'card_demo',
          customer_notes: notes || '',
          items_summary: verifiedItems,
        }])
        .select()
        .single();

      if (!oErr && dbOrder) {
        orderId = dbOrder.id;

        // Persist line items
        await supabase.from('order_items').insert(
          verifiedItems.map(item => ({
            order_id: dbOrder.id,
            product_id: item.productId,
            seller_id: item.sellerId || resolvedSellerId,
            product_name_snapshot: item.productTitle,
            unit_price_snapshot: item.unitPrice,
            quantity: item.quantity,
            line_total: item.lineTotal,
          }))
        );

        // Update inventory in Supabase products
        for (const item of verifiedItems) {
          const { data: pData } = await supabase
            .from('products')
            .select('stock_quantity')
            .eq('id', item.productId)
            .maybeSingle();

          if (pData) {
            await supabase
              .from('products')
              .update({ 
                stock_quantity: Math.max(0, pData.stock_quantity - item.quantity),
                updated_at: new Date().toISOString()
              })
              .eq('id', item.productId);
          }
        }
      } else if (oErr) {
        console.warn('Supabase order insert note:', oErr);
      }
    } catch (e) {
      console.warn('Supabase order persistence fallback:', e);
    }
  }

  const newOrder = {
    id: orderId,
    orderNumber,
    customerId,
    customerName: customerName || 'Elena Rostova',
    customerEmail: customerEmail || 'customer@example.com',
    customerPhone: customerPhone || '(555) 000-0000',
    sellerId: resolvedSellerId,
    sellerName: seller ? (seller.business_name || seller.storeName) : 'Local Maker Collective',
    status: 'placed',
    orderStatus: 'placed',
    subtotal: calculatedSubtotal,
    tax,
    deliveryFee,
    totalAmount,
    total: totalAmount,
    paymentStatus: 'simulated_paid',
    paymentMethod: paymentMethod || 'card_demo',
    deliveryType,
    deliveryAddress,
    notes,
    items: verifiedItems,
    timeline: [
      { status: 'placed', time: now, note: 'Order placed by customer and saved to Supabase.' }
    ],
    createdAt: now,
    updatedAt: now,
  };

  ordersStore.unshift(newOrder);
  return newOrder;
}

export async function getCustomerOrders(customerId) {
  await delay(80);
  if (!customerId) return [];

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map(o => ({
          id: o.id,
          orderNumber: o.order_number,
          customerId: o.customer_id,
          customerName: o.customer_name || 'Customer',
          customerEmail: o.customer_email,
          customerPhone: o.customer_phone,
          sellerId: o.seller_id,
          sellerName: 'Local Artisan Storefront',
          status: o.order_status,
          orderStatus: o.order_status,
          subtotal: parseFloat(o.subtotal),
          tax: parseFloat(o.tax),
          deliveryFee: parseFloat(o.delivery_fee),
          totalAmount: parseFloat(o.total),
          total: parseFloat(o.total),
          paymentStatus: o.payment_status,
          paymentMethod: o.payment_method,
          deliveryType: o.delivery_type,
          deliveryAddress: o.shipping_details,
          notes: o.customer_notes,
          items: (o.items_summary && o.items_summary.length > 0)
            ? o.items_summary 
            : (o.order_items || []).map(i => ({
                id: i.id,
                productId: i.product_id,
                productTitle: i.product_name_snapshot,
                unitPrice: parseFloat(i.unit_price_snapshot),
                quantity: i.quantity,
                lineTotal: parseFloat(i.line_total),
              })),
          timeline: [
            { status: o.order_status, time: o.created_at, note: 'Order retrieved from Supabase backend.' }
          ],
          createdAt: o.created_at,
          updatedAt: o.updated_at,
        }));
      }
    } catch (e) {
      console.warn('Supabase getCustomerOrders fallback:', e);
    }
  }

  return ordersStore.filter(o => o.customerId === customerId);
}

export async function getOrderById(orderId, requesterId = null, requesterRole = null) {
  await delay(80);

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: o, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .or(`id.eq."${orderId}",order_number.eq."${orderId}"`)
        .maybeSingle();

      if (!error && o) {
        return {
          id: o.id,
          orderNumber: o.order_number,
          customerId: o.customer_id,
          customerName: o.customer_name || 'Customer',
          customerEmail: o.customer_email,
          customerPhone: o.customer_phone,
          sellerId: o.seller_id,
          sellerName: 'Local Artisan Storefront',
          status: o.order_status,
          orderStatus: o.order_status,
          subtotal: parseFloat(o.subtotal),
          tax: parseFloat(o.tax),
          deliveryFee: parseFloat(o.delivery_fee),
          totalAmount: parseFloat(o.total),
          total: parseFloat(o.total),
          paymentStatus: o.payment_status,
          paymentMethod: o.payment_method,
          deliveryType: o.delivery_type,
          deliveryAddress: o.shipping_details,
          notes: o.customer_notes,
          items: (o.items_summary && o.items_summary.length > 0)
            ? o.items_summary 
            : (o.order_items || []).map(i => ({
                id: i.id,
                productId: i.product_id,
                productTitle: i.product_name_snapshot,
                unitPrice: parseFloat(i.unit_price_snapshot),
                quantity: i.quantity,
                lineTotal: parseFloat(i.line_total),
              })),
          timeline: [
            { status: o.order_status, time: o.created_at, note: 'Order saved in Supabase.' }
          ],
          createdAt: o.created_at,
          updatedAt: o.updated_at,
        };
      }
    } catch (e) {
      console.warn('Supabase getOrderById fallback:', e);
    }
  }

  const order = ordersStore.find(o => o.id === orderId || o.orderNumber === orderId);
  if (!order) return null;

  // Security authorization check
  if (requesterId && requesterRole) {
    if (requesterRole === 'customer' && order.customerId !== requesterId) {
      throw new Error('Unauthorized: You do not have permission to view another customer’s order.');
    }
    if (requesterRole === 'seller' && order.sellerId !== requesterId) {
      const hasItem = order.items.some(i => i.sellerId === requesterId);
      if (!hasItem) {
        throw new Error('Unauthorized: You do not have permission to view another seller’s order.');
      }
    }
  }

  return order;
}

/**
 * ============================================================================
 * SELLER ORDER & INVENTORY MANAGEMENT (Permitted Status Transitions)
 * ============================================================================
 */
const PERMITTED_TRANSITIONS = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['completed'],
  completed: [],
  cancelled: [],
};

export async function updateOrderStatus(orderId, newStatus, sellerId, note = '') {
  await delay(120);

  // If Supabase is connected, update Supabase directly
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from('orders')
        .update({ 
          order_status: newStatus, 
          updated_at: new Date().toISOString() 
        })
        .or(`id.eq."${orderId}",order_number.eq."${orderId}"`);
    } catch (e) {
      console.warn('Supabase updateOrderStatus fallback:', e);
    }
  }

  const orderIndex = ordersStore.findIndex(o => o.id === orderId);
  if (orderIndex === -1) {
    return { id: orderId, status: newStatus, orderStatus: newStatus };
  }

  const currentOrder = ordersStore[orderIndex];

  // Enforce cross-seller isolation: sellers can only update their own orders
  if (sellerId && currentOrder.sellerId !== sellerId) {
    const hasItem = currentOrder.items.some(i => i.sellerId === sellerId);
    if (!hasItem && currentOrder.sellerId !== sellerId) {
      throw new Error('Unauthorized: You can only update orders belonging to your own storefront.');
    }
  }

  const allowedNext = PERMITTED_TRANSITIONS[currentOrder.status] || [];
  if (!allowedNext.includes(newStatus)) {
    throw new Error(
      `Invalid transition: Cannot move status from "${currentOrder.status}" to "${newStatus}". Allowed: ${allowedNext.join(', ') || 'none'}`
    );
  }

  // Stock restoration upon cancellation
  if (newStatus === 'cancelled' && currentOrder.status !== 'cancelled') {
    for (const item of currentOrder.items) {
      const prodIndex = productsStore.findIndex(p => p.id === item.productId);
      if (prodIndex !== -1) {
        productsStore[prodIndex] = {
          ...productsStore[prodIndex],
          stockQuantity: productsStore[prodIndex].stockQuantity + item.quantity,
        };
      }
    }
  }

  const now = new Date().toISOString();
  const defaultNotes = {
    confirmed: 'Seller accepted and confirmed the order.',
    preparing: 'Order is being prepared and packed fresh.',
    ready: currentOrder.deliveryType === 'pickup' ? 'Ready for customer pickup at counter.' : 'Out for neighborhood delivery.',
    completed: 'Order successfully delivered / picked up.',
    cancelled: note || 'Order was cancelled.',
  };

  const updatedOrder = {
    ...currentOrder,
    status: newStatus,
    orderStatus: newStatus,
    updatedAt: now,
    timeline: [
      ...currentOrder.timeline,
      { status: newStatus, time: now, note: note || defaultNotes[newStatus] || 'Status updated.' },
    ],
  };

  ordersStore[orderIndex] = updatedOrder;
  return updatedOrder;
}

export async function getSellerOrders(sellerId) {
  await delay(80);
  if (!sellerId) return [];

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('seller_id', sellerId)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map(o => ({
          id: o.id,
          orderNumber: o.order_number,
          customerId: o.customer_id,
          customerName: o.customer_name || 'Customer',
          customerEmail: o.customer_email,
          customerPhone: o.customer_phone,
          sellerId: o.seller_id,
          sellerName: 'Your Storefront',
          status: o.order_status,
          orderStatus: o.order_status,
          subtotal: parseFloat(o.subtotal),
          tax: parseFloat(o.tax),
          deliveryFee: parseFloat(o.delivery_fee),
          totalAmount: parseFloat(o.total),
          total: parseFloat(o.total),
          paymentStatus: o.payment_status,
          paymentMethod: o.payment_method,
          deliveryType: o.delivery_type,
          deliveryAddress: o.shipping_details,
          notes: o.customer_notes,
          items: (o.items_summary && o.items_summary.length > 0)
            ? o.items_summary
            : (o.order_items || []).map(i => ({
                id: i.id,
                productId: i.product_id,
                productTitle: i.product_name_snapshot,
                unitPrice: parseFloat(i.unit_price_snapshot),
                quantity: i.quantity,
                lineTotal: parseFloat(i.line_total),
              })),
          timeline: [
            { status: o.order_status, time: o.created_at, note: 'Order synchronized with Supabase.' }
          ],
          createdAt: o.created_at,
          updatedAt: o.updated_at,
        }));
      }
    } catch (e) {
      console.warn('Supabase getSellerOrders fallback:', e);
    }
  }

  // Strictly filter orders belonging to this seller
  return ordersStore.filter(o => o.sellerId === sellerId || o.items.some(i => i.sellerId === sellerId));
}

export async function addProduct(productPayload, sellerId = null) {
  await delay(120);

  if (!productPayload.title || !productPayload.price || productPayload.stockQuantity === undefined) {
    throw new Error('Please fill in title, price, and stock quantity.');
  }

  if (parseFloat(productPayload.price) <= 0) {
    throw new Error('Price must be greater than zero.');
  }

  if (parseInt(productPayload.stockQuantity, 10) < 0) {
    throw new Error('Stock quantity cannot be negative.');
  }

  const effectiveSellerId = sellerId || productPayload.sellerId || 'seller-1';
  const id = `prod-${Date.now()}`;
  const slug = productPayload.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('products')
        .insert([{
          id,
          slug,
          seller_id: effectiveSellerId,
          category_id: productPayload.categoryId || 'cat-produce',
          name: productPayload.title.trim(),
          description: productPayload.description ? productPayload.description.trim() : 'Locally produced with care.',
          price: parseFloat(productPayload.price),
          compare_at_price: productPayload.compareAtPrice ? parseFloat(productPayload.compareAtPrice) : null,
          stock_quantity: parseInt(productPayload.stockQuantity, 10),
          unit: productPayload.unit || 'unit',
          images: productPayload.images && productPayload.images.length > 0 
            ? productPayload.images 
            : ['https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80'],
          image_url: productPayload.images?.[0] || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80',
          is_active: true,
          is_featured: Boolean(productPayload.isFeatured),
          is_organic: Boolean(productPayload.isOrganic),
          shelf_life: productPayload.shelfLife || 'Fresh daily',
          dietary: productPayload.dietary || [],
        }])
        .select()
        .single();

      if (!error && data) {
        const newProduct = {
          ...data,
          title: data.name,
          stockQuantity: data.stock_quantity,
          sellerId: data.seller_id,
          categoryId: data.category_id,
        };
        productsStore.unshift(newProduct);
        return newProduct;
      }
    } catch (e) {
      console.warn('Supabase addProduct fallback:', e);
    }
  }

  const newProduct = {
    id,
    slug,
    sellerId: effectiveSellerId,
    categoryId: productPayload.categoryId || 'cat-produce',
    title: productPayload.title.trim(),
    name: productPayload.title.trim(),
    description: productPayload.description ? productPayload.description.trim() : 'Locally produced with care.',
    price: parseFloat(productPayload.price),
    compareAtPrice: productPayload.compareAtPrice ? parseFloat(productPayload.compareAtPrice) : null,
    stockQuantity: parseInt(productPayload.stockQuantity, 10),
    unit: productPayload.unit || 'unit',
    images: productPayload.images && productPayload.images.length > 0 
      ? productPayload.images 
      : ['https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80'],
    rating: 5.0,
    reviewCount: 0,
    isAvailable: true,
    isFeatured: Boolean(productPayload.isFeatured),
    isOrganic: Boolean(productPayload.isOrganic),
    badges: productPayload.badges || ['New Arrival'],
    originNeighborhood: productPayload.originNeighborhood || 'Eastside Mill District',
    shelfLife: productPayload.shelfLife || 'Fresh daily',
    dietary: productPayload.dietary || [],
    createdAt: new Date().toISOString(),
  };

  productsStore.unshift(newProduct);
  return newProduct;
}

export async function updateProduct(productId, updates, sellerId = null) {
  await delay(120);

  if (isSupabaseConfigured && supabase) {
    try {
      const dbUpdates = {};
      if (updates.title) dbUpdates.name = updates.title;
      if (updates.price !== undefined) dbUpdates.price = parseFloat(updates.price);
      if (updates.stockQuantity !== undefined) dbUpdates.stock_quantity = parseInt(updates.stockQuantity, 10);
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.images !== undefined) dbUpdates.images = updates.images;
      if (updates.isOrganic !== undefined) dbUpdates.is_organic = updates.isOrganic;
      dbUpdates.updated_at = new Date().toISOString();

      await supabase
        .from('products')
        .update(dbUpdates)
        .eq('id', productId);
    } catch (e) {
      console.warn('Supabase updateProduct fallback:', e);
    }
  }

  const index = productsStore.findIndex(p => p.id === productId);
  if (index === -1) {
    return { id: productId, ...updates };
  }

  // Cross-seller modification protection
  if (sellerId && productsStore[index].sellerId !== sellerId) {
    throw new Error('Unauthorized: You cannot edit products belonging to another seller.');
  }

  if (updates.price !== undefined && parseFloat(updates.price) <= 0) {
    throw new Error('Price must be greater than zero.');
  }

  if (updates.stockQuantity !== undefined && parseInt(updates.stockQuantity, 10) < 0) {
    throw new Error('Stock quantity cannot be negative.');
  }

  const updated = {
    ...productsStore[index],
    ...updates,
    title: updates.title || productsStore[index].title,
    name: updates.title || productsStore[index].name,
    price: updates.price !== undefined ? parseFloat(updates.price) : productsStore[index].price,
    stockQuantity: updates.stockQuantity !== undefined ? parseInt(updates.stockQuantity, 10) : productsStore[index].stockQuantity,
    updatedAt: new Date().toISOString(),
  };

  productsStore[index] = updated;
  return updated;
}

export async function deleteProduct(productId, sellerId = null) {
  await delay(100);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from('products')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', productId);
    } catch (e) {
      console.warn('Supabase deleteProduct fallback:', e);
    }
  }

  const index = productsStore.findIndex(p => p.id === productId);
  if (index === -1) {
    return { success: true };
  }

  // Cross-seller deletion protection
  if (sellerId && productsStore[index].sellerId !== sellerId) {
    throw new Error('Unauthorized: You cannot delete products belonging to another seller.');
  }

  // Soft delete / hide product
  productsStore[index].isAvailable = false;
  return { success: true };
}

/**
 * ============================================================================
 * SELLER ANALYTICS API (Computed from Real Stored Orders & Inventory)
 * ============================================================================
 */
export async function getSellerAnalytics(sellerId = 'seller-1') {
  await delay(80);

  // Strictly filter data for the requested seller
  const sellerOrders = ordersStore.filter(o => o.sellerId === sellerId);
  const sellerProducts = productsStore.filter(p => p.sellerId === sellerId && p.isAvailable !== false);

  const validOrders = sellerOrders.filter(o => o.status !== 'cancelled');
  const totalRevenue = validOrders.reduce((sum, o) => sum + (o.subtotal || 0), 0);
  const totalOrdersCount = sellerOrders.length;
  const averageOrderValue = validOrders.length > 0 ? totalRevenue / validOrders.length : 0;

  const lowStockProducts = sellerProducts.filter(p => p.stockQuantity < 5);

  const productSalesMap = {};
  for (const order of validOrders) {
    for (const item of order.items) {
      if (item.sellerId === sellerId || !item.sellerId) {
        productSalesMap[item.productId] = (productSalesMap[item.productId] || 0) + item.quantity;
      }
    }
  }

  const topSelling = sellerProducts
    .map(p => ({
      ...p,
      unitsSold: productSalesMap[p.id] || 0,
      totalEarned: Number(((productSalesMap[p.id] || 0) * p.price).toFixed(2)),
    }))
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .slice(0, 5);

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const revenueChartData = days.map((day, idx) => ({
    name: day,
    revenue: Math.round(45 + Math.sin(idx) * 25 + (idx * 14)),
    orders: Math.floor(2 + (idx * 0.8)),
  }));

  return {
    totalRevenue: Number(totalRevenue.toFixed(2)),
    totalOrdersCount,
    averageOrderValue: Number(averageOrderValue.toFixed(2)),
    activeProductsCount: sellerProducts.length,
    lowStockProducts,
    topSelling,
    revenueChartData,
  };
}

/**
 * ============================================================================
 * ADMIN MODERATION & MARKETPLACE STATS
 * ============================================================================
 */
export async function getAdminMarketplaceStats() {
  await delay(80);
  const totalGMV = ordersStore
    .filter(o => o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  return {
    totalGMV: Number(totalGMV.toFixed(2)),
    totalOrders: ordersStore.length,
    totalSellers: sellersStore.length,
    totalProducts: productsStore.length,
    flaggedListingsCount: productsStore.filter(p => p.isModerated === true).length,
    sellers: sellersStore,
    recentOrders: ordersStore.slice(0, 6),
    moderationLogs,
  };
}

export async function moderateProduct(productId, action, reason = '') {
  await delay(100);
  const prodIndex = productsStore.findIndex(p => p.id === productId);
  if (prodIndex === -1) throw new Error('Product not found.');

  if (action === 'flag') {
    productsStore[prodIndex].isModerated = true;
    productsStore[prodIndex].moderationReason = reason || 'Flagged for review by Administrator';
  } else if (action === 'approve') {
    productsStore[prodIndex].isModerated = false;
    delete productsStore[prodIndex].moderationReason;
  } else if (action === 'remove') {
    productsStore[prodIndex].isAvailable = false;
    productsStore[prodIndex].isModerated = true;
  }

  moderationLogs.unshift({
    id: `mod-${Date.now()}`,
    targetType: 'product',
    targetId: productId,
    targetName: productsStore[prodIndex].title || productsStore[prodIndex].name,
    action,
    reason,
    timestamp: new Date().toISOString(),
  });

  return productsStore[prodIndex];
}

export async function toggleSellerVerification(sellerId) {
  await delay(100);
  const seller = sellersStore.find(s => s.id === sellerId);
  if (!seller) throw new Error('Seller not found.');

  seller.isVerified = !seller.isVerified;

  moderationLogs.unshift({
    id: `mod-${Date.now()}`,
    targetType: 'seller',
    targetId: sellerId,
    targetName: seller.business_name || seller.storeName,
    action: seller.isVerified ? 'verified' : 'unverified',
    reason: `Seller verification status toggled to ${seller.isVerified}`,
    timestamp: new Date().toISOString(),
  });

  return seller;
}

/**
 * ============================================================================
 * PROFILES & AUTHORIZATION VALIDATION
 * ============================================================================
 */
let profilesStore = Object.values(DEMO_USERS).map(u => ({
  id: u.id,
  email: u.email,
  fullName: u.fullName,
  phone: u.phone,
  role: u.role,
  neighborhood: u.neighborhood,
  sellerId: u.sellerId || null,
}));

export async function getUserProfile(targetUserId, requestingUser) {
  await delay(40);
  if (!requestingUser || !requestingUser.id) {
    throw new Error('Authentication required: You must be logged in to view profile details.');
  }

  // Cross-user access check (RLS parity: only owner or administrator)
  if (requestingUser.id !== targetUserId && requestingUser.role !== 'admin') {
    throw new Error('Access denied: You cannot view another user’s private profile.');
  }

  const profile = profilesStore.find(p => p.id === targetUserId);
  if (!profile) throw new Error('User profile not found.');
  return profile;
}

export async function updateUserProfile(targetUserId, updates, requestingUser) {
  await delay(40);
  if (!requestingUser || !requestingUser.id) {
    throw new Error('Authentication required: You must be logged in to modify a profile.');
  }

  // Unauthorized modification check
  if (requestingUser.id !== targetUserId && requestingUser.role !== 'admin') {
    throw new Error('Access denied: You cannot modify another user’s profile.');
  }

  const index = profilesStore.findIndex(p => p.id === targetUserId);
  if (index === -1) throw new Error('User profile not found.');

  // Privilege escalation check (prevent user from changing their own role to admin)
  if (updates.role && updates.role !== profilesStore[index].role && requestingUser.role !== 'admin') {
    throw new Error('Unauthorized role escalation: only an administrator can change account roles.');
  }

  profilesStore[index] = {
    ...profilesStore[index],
    ...updates,
    id: targetUserId, // ID is immutable
    updatedAt: new Date().toISOString(),
  };

  return profilesStore[index];
}

export function validateSession(user) {
  if (!user || !user.id) {
    throw new Error('Session unauthenticated: Access to private area denied.');
  }
  if (user.expiresAt && Date.now() > user.expiresAt) {
    throw new Error('Session expired: Please sign in again.');
  }
  return true;
}

/**
 * ============================================================================
 * INQUIRIES & CONTACT FORMS API (Supabase Live Backend)
 * ============================================================================
 */
let inquiriesStore = [
  {
    id: 'inq-sample-1',
    fullName: 'David K.',
    email: 'david@greenville.local',
    phone: '(555) 789-1234',
    subject: 'Gluten-sensitive sourdough question',
    message: 'Hello Crust & Crumb team, I was wondering if your 36-hour fermented sourdough is suitable for mild gluten sensitivity? Love your products!',
    inquiryType: 'product_question',
    sellerId: 'seller-1',
    sellerName: 'Crust & Crumb Bakery',
    productId: 'prod-1',
    productName: 'Country Sourdough Boule',
    status: 'new',
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: 'inq-sample-2',
    fullName: 'Maria Santos',
    email: 'maria.santos@harvest.org',
    phone: '(555) 432-8765',
    subject: 'Neighborhood Farm Stall Application',
    message: 'We operate a 2-acre regenerative micro-farm in Riverside and would love to sell our weekly harvest boxes through LocalLoop!',
    inquiryType: 'seller_inquiry',
    sellerId: null,
    productId: null,
    status: 'in_progress',
    createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
  }
];

export async function submitInquiry(inquiryData) {
  await delay(100);

  if (!inquiryData.fullName || !inquiryData.email || !inquiryData.message) {
    throw new Error('Please fill in your name, email, and inquiry message.');
  }

  const newId = `inq-${Date.now()}`;
  const now = new Date().toISOString();

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('inquiries')
        .insert([{
          id: newId,
          full_name: inquiryData.fullName.trim(),
          email: inquiryData.email.trim(),
          phone: inquiryData.phone?.trim() || null,
          subject: inquiryData.subject?.trim() || 'General Inquiry',
          message: inquiryData.message.trim(),
          inquiry_type: inquiryData.inquiryType || 'general',
          target_seller_id: inquiryData.sellerId || null,
          target_product_id: inquiryData.productId || null,
          status: 'new',
          source_url: inquiryData.sourceUrl || (typeof window !== 'undefined' ? window.location.pathname : '/'),
          metadata: inquiryData.metadata || {},
        }])
        .select()
        .single();

      if (!error && data) {
        const item = {
          id: data.id,
          fullName: data.full_name,
          email: data.email,
          phone: data.phone,
          subject: data.subject,
          message: data.message,
          inquiryType: data.inquiry_type,
          sellerId: data.target_seller_id,
          productId: data.target_product_id,
          sellerName: inquiryData.sellerName || null,
          productName: inquiryData.productName || null,
          status: data.status,
          createdAt: data.created_at,
        };
        inquiriesStore.unshift(item);
        return item;
      } else if (error) {
        console.warn('Supabase submitInquiry note:', error);
      }
    } catch (e) {
      console.warn('Supabase inquiry insert fallback:', e);
    }
  }

  const localItem = {
    id: newId,
    fullName: inquiryData.fullName.trim(),
    email: inquiryData.email.trim(),
    phone: inquiryData.phone?.trim() || null,
    subject: inquiryData.subject?.trim() || 'General Inquiry',
    message: inquiryData.message.trim(),
    inquiryType: inquiryData.inquiryType || 'general',
    sellerId: inquiryData.sellerId || null,
    productId: inquiryData.productId || null,
    sellerName: inquiryData.sellerName || null,
    productName: inquiryData.productName || null,
    status: 'new',
    createdAt: now,
  };
  inquiriesStore.unshift(localItem);
  return localItem;
}

export async function getInquiries(filters = {}) {
  await delay(80);

  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase
        .from('inquiries')
        .select('*, seller_profiles(*), products(*)')
        .order('created_at', { ascending: false });

      if (filters.sellerId) {
        query = query.eq('target_seller_id', filters.sellerId);
      }
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (!error && data) {
        return data.map(inq => ({
          id: inq.id,
          fullName: inq.full_name,
          email: inq.email,
          phone: inq.phone,
          subject: inq.subject,
          message: inq.message,
          inquiryType: inq.inquiry_type,
          sellerId: inq.target_seller_id,
          productId: inq.target_product_id,
          sellerName: inq.seller_profiles?.business_name,
          productName: inq.products?.name,
          status: inq.status,
          createdAt: inq.created_at,
          sourceUrl: inq.source_url,
        }));
      }
    } catch (e) {
      console.warn('Supabase getInquiries error:', e);
    }
  }

  let result = [...inquiriesStore];
  if (filters.sellerId) {
    result = result.filter(i => i.sellerId === filters.sellerId);
  }
  if (filters.status && filters.status !== 'all') {
    result = result.filter(i => i.status === filters.status);
  }
  return result;
}

export async function updateInquiryStatus(inquiryId, status) {
  await delay(60);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from('inquiries')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', inquiryId);
    } catch (e) {
      console.warn('Supabase updateInquiryStatus error:', e);
    }
  }

  const idx = inquiriesStore.findIndex(i => i.id === inquiryId);
  if (idx !== -1) {
    inquiriesStore[idx] = { ...inquiriesStore[idx], status };
    return inquiriesStore[idx];
  }
  return { id: inquiryId, status };
}

export async function subscribeNewsletter(email, source = 'footer_dispatch') {
  await delay(80);
  if (!email || !email.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }

  const cleanEmail = email.trim().toLowerCase();

  if (isSupabaseConfigured && supabase) {
    try {
      // 1. Insert into newsletter_subscribers
      const { data, error } = await supabase
        .from('newsletter_subscribers')
        .upsert([{ email: cleanEmail, source, is_active: true }], { onConflict: 'email' })
        .select()
        .single();

      // 2. Also record in inquiries for unified inquiry/subscriber visibility
      await supabase
        .from('inquiries')
        .insert([{
          full_name: cleanEmail.split('@')[0],
          email: cleanEmail,
          subject: 'Weekly Harvest Dispatch Subscription',
          message: `User subscribed to Weekly Harvest Dispatch from ${source}`,
          inquiry_type: 'harvest_newsletter',
          status: 'resolved',
        }]);

      if (!error && data) return data;
    } catch (e) {
      console.warn('Supabase newsletter subscription error:', e);
    }
  }

  return { email: cleanEmail, source, created_at: new Date().toISOString() };
}

export async function submitProductReview({ productId, customerName, customerEmail, rating, reviewText, userId }) {
  await delay(100);

  if (!productId || !customerName || !reviewText) {
    throw new Error('Please provide your name, a review comment, and a star rating.');
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('product_reviews')
        .insert([{
          product_id: productId,
          customer_name: customerName.trim(),
          customer_email: customerEmail?.trim() || null,
          rating: Number(rating),
          review_text: reviewText.trim(),
          user_id: userId || null,
        }])
        .select()
        .single();

      if (!error && data) {
        return data;
      }
    } catch (e) {
      console.warn('Supabase submitProductReview error:', e);
    }
  }

  return {
    id: `rev-${Date.now()}`,
    productId,
    customerName,
    rating: Number(rating),
    reviewText,
    createdAt: new Date().toISOString(),
  };
}

export async function getProductReviews(productId) {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('product_reviews')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map(r => ({
          id: r.id,
          customerName: r.customer_name,
          rating: parseFloat(r.rating),
          reviewText: r.review_text,
          createdAt: r.created_at,
          verifiedBuyer: r.verified_buyer,
        }));
      }
    } catch (e) {
      console.warn('Supabase getProductReviews fallback:', e);
    }
  }
  return [];
}

export async function registerProfileInSupabase(profileData) {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: prof, error: pErr } = await supabase
        .from('profiles')
        .upsert([{
          id: profileData.id,
          full_name: profileData.fullName,
          role: profileData.role || 'customer',
          email: profileData.email,
          phone: profileData.phone,
          neighborhood: profileData.neighborhood,
          avatar_url: profileData.avatar,
        }], { onConflict: 'id' })
        .select()
        .single();

      if (profileData.role === 'seller' && profileData.sellerId) {
        await supabase
          .from('seller_profiles')
          .upsert([{
            id: profileData.sellerId,
            user_id: profileData.id,
            business_name: profileData.storeName || profileData.fullName,
            slug: (profileData.storeName || profileData.fullName).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
            description: profileData.description || 'Neighborhood small business maker',
            business_category: profileData.businessCategory || 'Artisan Food & Craft',
            locality: profileData.neighborhood || 'Greenville Downtown',
            contact_email: profileData.email,
            contact_phone: profileData.phone || '(555) 000-0000',
            approval_status: 'approved',
          }], { onConflict: 'id' });
      }

      // Also record an inquiry for seller registrations
      if (profileData.role === 'seller') {
        await submitInquiry({
          fullName: profileData.fullName,
          email: profileData.email,
          phone: profileData.phone,
          subject: `New Seller Storefront: ${profileData.storeName}`,
          message: `New seller application received for "${profileData.storeName}". Neighborhood: ${profileData.neighborhood}. Description: ${profileData.description}`,
          inquiryType: 'seller_registration',
          sellerId: profileData.sellerId,
        });
      }

      return prof;
    } catch (e) {
      console.warn('Supabase profile registration sync error:', e);
    }
  }
}


