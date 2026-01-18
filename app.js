const tg = window.Telegram?.WebApp;
try {
  tg?.ready();
  tg?.expand();
  tg?.setBackgroundColor?.('#f3f4f6'); // Tailwind bg-gray-100
} catch (e) {}

const API_URL = 'https://script.google.com/macros/s/AKfycbxyKA2QcJBKim9ttOKHiJ_uTVYunBKhBnNFNf9BLGewzHpqqcY9ZY8smmvCwQZzOGs85Q/exec';
const ORDERS_API_URL = 'https://script.google.com/macros/s/AKfycbxr_WtXjtNelG9HRya2ngKaYkd-9dUrADnVG8H9_SJTHIheJ_eFFj3BCCdED22-3K5t5Q/exec';
const BACKEND_ORDER_URL = 'https://tg-shop-test-backend.onrender.com/order';

let CATEGORIES = ['Все'];

let selectedCategory = 'Все',
  query = '',
  randomIds = [],
  loadedCount = 10,
  imageCache = new Map(),
  productsData = null,
  currentProduct = null,
  selectedOption = {},
  selectedQuantity = 1,
  searchTimeout = null,
  currentTab = 'shop';

let cartItems = [];
let savedAddresses = [];
let previousOrders = [];

let paymentType = 'cash';
let pickupMode = false;
let pickupLocation = '';

const PICKUP_LOCATIONS = [
  'ТЦ Галерея, пр-т Победителей, 9',
  'ТРЦ Dana Mall, ул. Петра Мстиславца, 11'
];

let isAddingToCart = false;
let isPlacingOrder = false;
let isRefreshingProducts = false;
let isTabChanging = false;

const root = document.getElementById('root');
const modal = document.getElementById('productModal');

// ---------- Глобальная обработка ошибок ----------

window.onerror = function (message, source, lineno, colno, error) {
  console.error('Global error:', message, source, lineno, colno, error);
  try {
    showError('Произошла ошибка в приложении. Попробуйте обновить Mini App.');
  } catch (e) {
    tg?.showAlert?.('Произошла ошибка в приложении. Попробуйте обновить Mini App.');
  }
  return true;
};

// ---------- localStorage ----------

function saveCartToStorage() {
  try {
    localStorage.setItem('cartItems', JSON.stringify(cartItems));
  } catch (e) {}
}

function loadCartFromStorage() {
  try {
    const raw = localStorage.getItem('cartItems');
    cartItems = raw ? JSON.parse(raw) : [];
  } catch (e) {
    cartItems = [];
  }
  updateCartBadge();
}

function saveAddressesToStorage() {
  try {
    localStorage.setItem('addresses', JSON.stringify(savedAddresses));
  } catch (e) {}
}

function loadAddressesFromStorage() {
  try {
    const raw = localStorage.getItem('addresses');
    savedAddresses = raw ? JSON.parse(raw) : [];
  } catch (e) {
    savedAddresses = [];
  }
}

function saveOrdersToStorage() {
  try {
    localStorage.setItem('orders', JSON.stringify(previousOrders));
  } catch (e) {}
}

function loadOrdersFromStorage() {
  try {
    const raw = localStorage.getItem('orders');
    previousOrders = raw ? JSON.parse(raw) : [];
  } catch (e) {
    previousOrders = [];
  }
}

// ---------- Запрет зума ----------

document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('gesturechange', e => e.preventDefault());
document.addEventListener('gestureend', e => e.preventDefault());
document.addEventListener('touchstart', e => {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', e => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });

// ---------- Таббар ----------

function setTabBarDisabled(disabled) {
  isTabChanging = disabled;
  document
    .querySelectorAll('#tabBar .tab-item')
    .forEach(t => t.classList.toggle('pointer-events-none', disabled));
}

function initTabBar() {
  document.querySelectorAll('#tabBar .tab-item').forEach(tab => {
    tab.onclick = (e) => {
      e.preventDefault();
      switchTab(tab.dataset.tab);
    };
  });
  updateCartBadge();
}

function switchTab(tabName) {
  if (isTabChanging) return;
  if (currentTab === tabName) return;

  if (typeof closeModal === 'function' && modal && !modal.classList.contains('hidden')) {
    closeModal();
  }

  const prevTab = currentTab;
  isTabChanging = true;
  setTabBarDisabled(true);

  Promise.resolve().then(() => {
    if (tabName === 'shop') {
      if (typeof renderShop === 'function') renderShop();
    } else if (tabName === 'cart') {
      showCartTab();
    } else if (tabName === 'sale') {
      showSaleTab();
    } else if (tabName === 'profile') {
      showProfileTab();
    } else if (tabName === 'about') {
      showAboutTab();
    }
    currentTab = tabName;
    document.querySelectorAll('#tabBar .tab-item').forEach(t => t.classList.remove('active'));
    const currentEl = document.querySelector('[data-tab="' + tabName + '"]');
    if (currentEl) currentEl.classList.add('active');
  }).catch(err => {
    console.error('switchTab error', err);
    currentTab = prevTab;
  }).finally(() => {
    isTabChanging = false;
    setTabBarDisabled(false);
  });
}

// ---------- Корзина и синхронизация ----------

function updateCartBadge() {
  const badge = document.getElementById('cartBadge');
  if (!badge) return;
  const count = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

function addToCart(variant, quantity) {
  if (!productsData) {
    tg?.showAlert?.('Товары ещё не загружены, попробуйте позже');
    return;
  }

  const freshVariant = productsData.find(p => p.id === variant.id) || variant;

  const existing = cartItems.find(item => item.id === freshVariant.id);
  if (existing) {
    existing.quantity = Math.min(existing.quantity + quantity, 100);
  } else {
    cartItems.push({
      id: freshVariant.id,
      name: freshVariant.name,
      price: freshVariant.price,
      storage: freshVariant.storage,
      color: freshVariant.color,
      region: freshVariant.region,
      quantity,
      available: true
    });
  }

  saveCartToStorage();
  updateCartBadge();
  tg?.HapticFeedback?.notificationOccurred('success');
}

window.changeCartItemQuantity = function(index, delta) {
  const item = cartItems[index];
  if (!item) return;
  let q = item.quantity + delta;
  if (q < 1) q = 1;
  if (q > 100) q = 100;
  item.quantity = q;
  saveCartToStorage();
  updateCartBadge();
  showCartTab();
};

window.removeCartItem = function(index) {
  cartItems.splice(index, 1);
  saveCartToStorage();
  updateCartBadge();
  showCartTab();
};

function syncCartWithProducts() {
  if (!productsData) return;
  cartItems = cartItems.map(item => {
    const exists = productsData.some(p => p.id === item.id && p.inStock);
    return { ...item, available: exists };
  });
  saveCartToStorage();
  updateCartBadge();
}

function syncProductsAndCart() {
  syncCartWithProducts();
  if (currentTab === 'shop' && typeof renderShop === 'function') renderShop();
  if (currentTab === 'cart') showCartTab();
}

// ---------- Вкладка корзины ----------

window.setPaymentType = function(type) {
  paymentType = type;
  showCartTab();
};

window.setPickupMode = function(mode) {
  pickupMode = !!mode;
  showCartTab();
};

window.setPickupLocation = function(addr) {
  pickupLocation = addr;
};

window.onSavedAddressChange = function() {
  const select = document.getElementById('savedAddress');
  const wrapper = document.getElementById('deliveryAddressWrapper');
  if (!select || !wrapper) return;
  wrapper.style.display = select.value ? 'none' : 'block';
};

function showCartTab() {
  if (!cartItems.length) {
    root.innerHTML =
      '<div class="flex flex-col items-center justify-center min-h-[70vh] text-center p-8 pb-[65px]">' +
        '<div class="w-28 h-28 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-3xl flex items-center justify-center mb-6">' +
          '<svg class="w-16 h-16 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
            '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"' +
                  ' d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 2.5M7 13l-1.5 2.5m12.5-2.5L21 13m0 0l-1.5 2.5m1.5-2.5L21 21"/>' +
          '</svg>' +
        '</div>' +
        '<h2 class="text-2xl font-bold text-gray-800 mb-2">Корзина пуста</h2>' +
        '<p class="text-sm text-gray-500 mb-6 max-w-xs">' +
          'Добавьте устройство в корзину, чтобы оформить заказ.' +
        '</p>' +
        '<button onclick="switchTab(\'shop\')"' +
                ' class="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-8 rounded-2xl shadow-lg transition-all">' +
          'Перейти в магазин' +
        '</button>' +
      '</div>';
    return;
  }

  const subtotal = cartItems.reduce((sum, item) =>
    sum + item.price * item.quantity, 0
  );
  const commission = paymentType === 'card' ? Math.round(subtotal * 0.15) : 0;
  const total = subtotal + commission;

  root.innerHTML =
    '<div class="relative min-h-[100vh] p-6 space-y-6 pb-[80px] max-w-md mx-auto">' +
      '<h2 class="text-2xl font-bold text-gray-800 mb-4">Корзина</h2>' +
      '<div class="space-y-3">' +
        cartItems.map((item, idx) =>
          '<div class="flex items-center justify-between p-3 rounded-xl border ' +
                 (item.available ? 'border-gray-200' : 'border-red-300 bg-red-50') +
                 '">' +
            '<div class="text-left flex-1 mr-3">' +
              '<div class="font-semibold text-sm break-words">' + escapeHtml(item.name) + '</div>' +
              '<div class="text-xs text-gray-500">' +
                escapeHtml(item.storage) + ' | ' +
                escapeHtml(item.color) + ' | ' +
                escapeHtml(item.region) +
              '</div>' +
              '<div class="text-xs mt-1 ' + (item.available ? 'text-green-600' : 'text-red-600') + '">' +
                (item.available ? 'В наличии' : 'Товар недоступен, удалите из корзины') +
              '</div>' +
            '</div>' +
            '<div class="text-right flex flex-col items-end gap-1">' +
              '<div class="flex items-center justify-end gap-2">' +
                '<button class="px-2 py-1 rounded-full bg-gray-200 text-sm font-bold"' +
                        ' onclick="changeCartItemQuantity(' + idx + ', -1)">-</button>' +
                '<span class="min-w-[24px] text-center text-sm font-semibold">' + item.quantity + '</span>' +
                '<button class="px-2 py-1 rounded-full bg-gray-200 text-sm font-bold"' +
                        ' onclick="changeCartItemQuantity(' + idx + ', 1)">+</button>' +
              '</div>' +
              '<div class="text-sm font-bold text-blue-600">$' + (item.price * item.quantity) + '</div>' +
              '<button class="text-xs text-red-500" onclick="removeCartItem(' + idx + ')">Удалить</button>' +
            '</div>' +
          '</div>'
        ).join('') +
      '</div>' +

      '<div class="pt-4 border-t space-y-4">' +
        '<div class="space-y-2">' +
          '<h3 class="text-sm font-semibold text-gray-700">Способ оплаты</h3>' +
          '<div class="flex flex-col gap-2">' +
            '<label class="flex items-center gap-2 text-sm">' +
              '<input type="radio" name="paymentType" value="cash"' +
                     (paymentType === "cash" ? " checked" : "") +
                     ' onchange="setPaymentType(\'cash\')">' +
              '<span>Наличными (0%)</span>' +
            '</label>' +
            '<label class="flex items-center gap-2 text-sm">' +
              '<input type="radio" name="paymentType" value="card"' +
                     (paymentType === "card" ? " checked" : "") +
                     ' onchange="setPaymentType(\'card\')">' +
              '<span>Картой (+15%)</span>' +
            '</label>' +
          '</div>' +
        '</div>' +

        '<div class="space-y-2">' +
          '<h3 class="text-sm font-semibold text-gray-700">Способ получения</h3>' +
          '<div class="flex flex-col gap-2 mb-2">' +
            '<label class="flex items-center gap-2 text-sm">' +
              '<input type="radio" name="pickupMode" value="delivery"' +
                     (!pickupMode ? " checked" : "") +
                     ' onchange="setPickupMode(false)">' +
              '<span>Доставка</span>' +
            '</label>' +
            '<label class="flex items-center gap-2 text-sm">' +
              '<input type="radio" name="pickupMode" value="pickup"' +
                     (pickupMode ? " checked" : "") +
                     ' onchange="setPickupMode(true)">' +
              '<span>Самовывоз</span>' +
            '</label>' +
          '</div>' +

          (!pickupMode
            ? (
              '<label class="text-sm font-semibold text-gray-700 block">Адрес доставки</label>' +
              '<select id="savedAddress" class="w-full bg-white border rounded-xl px-3 py-2 text-sm mb-2" onchange="onSavedAddressChange()">' +
                '<option value="">Выбрать сохранённый адрес</option>' +
                (savedAddresses || []).map(addr =>
                  '<option value="' + escapeHtml(addr) + '">' + escapeHtml(addr) + '</option>'
                ).join('') +
              '</select>' +
              '<div id="deliveryAddressWrapper">' +
                '<textarea id="deliveryAddress" class="w-full bg-white border rounded-xl px-3 py-2 text-sm"' +
                          ' rows="3" placeholder="Введите адрес доставки..."></textarea>' +
              '</div>'
            )
            : (
              '<label class="text-sm font-semibold text-gray-700 block">Адрес самовывоза</label>' +
              '<select id="pickupLocation" class="w-full bg-white border rounded-xl px-3 py-2 text-sm mb-2"' +
                      ' onchange="setPickupLocation(this.value)">' +
                '<option value="">Выберите пункт самовывоза</option>' +
                PICKUP_LOCATIONS.map(addr =>
                  '<option value="' + escapeHtml(addr) + '"' +
                    (pickupLocation === addr ? ' selected' : '') + '>' +
                    escapeHtml(addr) +
                  '</option>'
                ).join('') +
              '</select>'
            )
          ) +
        '</div>' +

        '<div class="space-y-1 text-sm text-gray-700">' +
          '<div class="flex items-center justify-between">' +
            '<span>Сумма товаров</span>' +
            '<span>$' + subtotal + '</span>' +
          '</div>' +
          '<div class="flex items-center justify-between">' +
            '<span>Наценка за оплату картой</span>' +
            '<span>' + (paymentType === "card" ? "+ $" + commission : "$0") + '</span>' +
          '</div>' +
          '<div class="flex items-center justify-between font-semibold mt-1">' +
            '<span>Итого к оплате</span>' +
            '<span>$' + total + '</span>' +
          '</div>' +
        '</div>' +

        '<div class="pt-3">' +
          '<button onclick="placeOrder()"' +
                  ' class="w-full flex items-center justify-center gap-2 ' +
                    (!cartItems.some(i => !i.available) && !isPlacingOrder
                      ? 'bg-blue-500 hover:bg-blue-600'
                      : 'bg-gray-400 cursor-not-allowed') +
                    ' text-white font-semibold py-2.5 px-6 rounded-2xl shadow-lg transition-all text-sm"' +
                  (cartItems.some(i => !i.available) || isPlacingOrder ? ' disabled' : '') +
                  '>' +
            (cartItems.some(i => !i.available)
              ? 'Удалите недоступные товары'
              : (isPlacingOrder
                  ? '<span class="loader-circle"></span><span>Проверяю наличие...</span>'
                  : 'Оформить заказ'
                )
            ) +
          '</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  const savedSelect = document.getElementById('savedAddress');
  if (savedSelect) {
    onSavedAddressChange();
  }
}

// ---------- Вкладка распродажи ----------

function showSaleTab() {
  root.innerHTML =
    '<div class="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 pb-[65px]">' +
      '<div class="w-24 h-24 bg-orange-100 rounded-3xl flex items-center justify-center mb-6">' +
        '<svg class="w-16 h-16 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
          '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"' +
                ' d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>' +
        '</svg>' +
      '</div>' +
      '<h2 class="text-2xl font-bold text-gray-800 mb-4">Распродажа</h2>' +
      '<p class="text-lg text-gray-600 mb-8">Скоро здесь будут скидки до 70%!</p>' +
      '<button onclick="switchTab(\'shop\')" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-2xl shadow-lg transition-all">' +
        'В магазин' +
      '</button>' +
    '</div>';
}

// ---------- Профиль ----------

window.toggleOrderDetails = function(index) {
  const block = document.getElementById('orderDetails_' + index);
  if (!block) return;
  block.classList.toggle('hidden');
};

function showProfileTab() {
  const user = tg?.initDataUnsafe?.user;
  const username = user?.username || 'неизвестно';
  const displayId = '@' + username;

  const ordersHtml = previousOrders.length
    ? previousOrders.map((o, idx) =>
        '<div class="p-3 border rounded-xl mb-2 cursor-pointer" onclick="toggleOrderDetails(' + idx + ')">' +
          '<div class="flex items-center justify-between mb-1">' +
            '<span class="text-sm font-semibold break-all">Заказ #' + o.id + '</span>' +
            '<span class="text-sm font-bold text-blue-600 ml-2 whitespace-nowrap">$' + o.total + '</span>' +
          '</div>' +
          '<div class="text-xs text-gray-500 mb-1">' + new Date(o.date).toLocaleString() + '</div>' +
          '<div class="text-xs text-gray-600 mb-1 break-words">Адрес: ' + escapeHtml(o.address) + '</div>' +
          '<div class="text-xs text-gray-600 mb-1">Товаров: ' + o.items.length + '</div>' +
          '<div id="orderDetails_' + idx + '" class="hidden mt-2 text-xs text-gray-700 bg-gray-50 rounded-lg p-2">' +
            o.items.map(item =>
              '<div class="flex items-center justify-between mb-1 gap-2">' +
                '<div class="flex-1 min-w-0">' +
                  '<div class="font-semibold break-words">' + escapeHtml(item.name) + '</div>' +
                  '<div class="text-[11px] text-gray-500">' +
                    escapeHtml(item.storage) + ' | ' +
                    escapeHtml(item.color) + ' | ' +
                    escapeHtml(item.region) +
                  '</div>' +
                '</div>' +
                '<div class="text-right text-[11px] whitespace-nowrap">' +
                  '<div>' + item.quantity + ' шт.</div>' +
                  '<div>$' + (item.price * item.quantity) + '</div>' +
                '</div>' +
              '</div>'
            ).join('') +
          '</div>' +
        '</div>'
      ).join('')
    : '<p class="text-sm text-gray-500">Заказов пока нет</p>';

  const addressesHtml = savedAddresses.length
    ? savedAddresses.map((addr, idx) =>
        '<div class="flex items-center gap-2 p-2 border rounded-xl mb-1">' +
          '<span class="flex-1 text-xs text-gray-700 break-words">' + escapeHtml(addr) + '</span>' +
          '<button class="text-xs text-red-500 shrink-0" onclick="removeAddress(' + idx + ')">Удалить</button>' +
        '</div>'
      ).join('')
    : '<p class="text-sm text-gray-500">Сохранённых адресов нет</p>';

  root.innerHTML =
    '<div class="p-6 space-y-6 pb-[65px] max-w-md mx-auto">' +
      '<div class="flex items-center gap-4">' +
        '<div class="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex.items-center justify-center">' +
          '<svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
            '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"' +
                  ' d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>' +
          '</svg>' +
        '</div>' +
        '<div class="flex flex-col min-w-0">' +
          '<h2 class="text-xl font-bold leading-tight">Профиль</h2>' +
          '<p class="text-gray-500 text-sm mt-1 break-all">ID: ' + escapeHtml(displayId) + '</p>' +
        '</div>' +
      '</div>' +

      '<div class="space-y-3">' +
        '<h3 class="text-lg font-semibold">Сохранённые адреса</h3>' +
        '<div id="addressesList">' + addressesHtml + '</div>' +
        '<div class="space-y-2">' +
          '<textarea id="newAddress" class="w-full bg-white border rounded-xl px-3 py-2 text-sm" rows="2" placeholder="Новый адрес..."></textarea>' +
          '<button class="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-xl transition-all"' +
                  ' onclick="addAddress()">' +
            'Сохранить адрес' +
          '</button>' +
        '</div>' +
      '</div>' +

      '<div class="space-y-3">' +
        '<h3 class="text-lg font-semibold">Предыдущие заказы</h3>' +
        '<div>' + ordersHtml + '</div>' +
      '</div>' +
    '</div>';
}

window.addAddress = function() {
  const ta = document.getElementById('newAddress');
  if (!ta) return;
  const val = ta.value.trim();
  if (!val) {
    tg?.showAlert?.('Введите адрес');
    return;
  }
  savedAddresses.push(val);
  saveAddressesToStorage();
  ta.value = '';
  showProfileTab();
};

window.removeAddress = function(index) {
  savedAddresses.splice(index, 1);
  saveAddressesToStorage();
  showProfileTab();
};

// ---------- Вкладка "О нас" ----------

function showAboutTab() {
  root.innerHTML =
    '<div class="p-6 space-y-6 pb-[65px] max-w-md mx-auto">' +
      '<h2 class="text-2xl font-bold text-gray-800 mb-4">О нас</h2>' +
      '<div class="space-y-4 text-gray-700">' +
        '<p>Магазин премиальной техники Apple с гарантией качества и лучшими ценами.</p>' +
        '<div class="grid grid-cols-2 gap-4 mt-8">' +
          '<div class="text-center p-4 bg-blue-50 rounded-xl">' +
            '<div class="text-2xl font-bold text-blue-600">1000+</div>' +
            '<div class="text-sm text-gray-600">товаров</div>' +
          '</div>' +
          '<div class="text-center p-4 bg-green-50 rounded-xl">' +
            '<div class="text-2xl font-bold text-green-600">24/7</div>' +
            '<div class="text-sm text-gray-600">поддержка</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
}

// ---------- Ошибка ----------

function showError(message) {
  root.innerHTML =
    '<div class="flex flex-col.items-center justify-center min-h-screen text-center p-8 pb-[65px]">' +
      '<div class="w-20 h-20 bg-red-100 rounded-2xl flex items-center justify-center mb-6">' +
        '<svg class="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
          '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"' +
                ' d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>' +
        '</svg>' +
      '</div>' +
      '<h2 class="text-2xl font-bold text-gray-800 mb-4">Ошибка загрузки</h2>' +
      '<p class="text-lg text-red-600 mb-2">' + escapeHtml(message) + '</p>' +
      '<button onclick="location.reload()"' +
              ' class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-2xl shadow-lg transition-all">' +
        'Попробовать снова' +
      '</button>' +
    '</div>';
  tg?.showAlert?.('❌ ' + message);
}

// ---------- Утилита ----------

function escapeHtml(s) {
  const map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'};
  return String(s).replace(/[&<>"']/g, m => map[m]);
}

// ---------- Бэкдроп модалки ----------

if (modal) {
  modal.addEventListener('click', e => {
    if (e.target === modal) closeModal();
  });
}

// ---------- ESC ----------

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (modal && !modal.classList.contains('hidden')) {
      closeModal();
    }
  }
});

// ---------- Метрики ----------

function logStage(label, startTime) {
  const now = performance.now();
  console.log(`[perf] ${label}: ${Math.round(now - startTime)} ms`);
}

// ---------- Оформление заказа ----------

window.placeOrder = async function() {
  if (isPlacingOrder) return;

  const orderClickTs = Date.now();

  if (cartItems.length === 0) {
    tg?.showAlert?.('Корзина пуста');
    return;
  }

  let address = '';
  if (pickupMode) {
    if (!pickupLocation) {
      tg?.showAlert?.('Выберите пункт самовывоза');
      return;
    }
    address = 'Самовывоз: ' + pickupLocation;
  } else {
    const select = document.getElementById('savedAddress');
    const textarea = document.getElementById('deliveryAddress');
    address = (textarea && textarea.value.trim()) || '';
    if (!address && select && select.value) {
      address = select.value;
    }
    if (!address) {
      tg?.showAlert?.('Введите или выберите адрес доставки');
      return;
    }
  }

  isPlacingOrder = true;
  showCartTab();

  try {
    await fetchAndUpdateProducts(false);
  } catch (e) {
    console.error('refresh before order failed', e);
  }

  if (!productsData) {
    tg?.showAlert?.('Товары ещё не загружены, попробуйте позже');
    isPlacingOrder = false;
    showCartTab();
    return;
  }

  let hasUnavailable = false;
  cartItems = cartItems.map(item => {
    const exists = productsData.some(p => p.id === item.id && p.inStock);
    if (!exists) hasUnavailable = true;
    return { ...item, available: exists };
  });
  saveCartToStorage();
  updateCartBadge();

  if (hasUnavailable) {
    tg?.showAlert?.('Некоторые товары стали недоступны. Удалите их из корзины.');
    isPlacingOrder = false;
    showCartTab();
    return;
  }

  const subtotal = cartItems.reduce((sum, item) =>
    sum + item.price * item.quantity, 0
  );
  const commission = paymentType === 'card' ? Math.round(subtotal * 0.15) : 0;
  const total = subtotal + commission;

  const order = {
    id: Date.now(),
    date: new Date().toISOString(),
    items: cartItems.slice(),
    subtotal,
    commission,
    total,
    address,
    paymentType,
    pickupMode,
    pickupLocation: pickupMode ? pickupLocation : '',
    user: tg?.initDataUnsafe?.user || null,
    clientClickTs: orderClickTs
  };

  previousOrders.push(order);
  saveOrdersToStorage();

  try {
    const resp = await fetch(BACKEND_ORDER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order)
    });

    const text = await resp.text();
    console.log('BACKEND_ORDER_URL status:', resp.status);
    console.log('BACKEND_ORDER_URL body:', text);

    let json = null;
    try { json = JSON.parse(text); } catch (e) {}

    if (!resp.ok || !json || json.ok !== true) {
      tg?.showAlert?.('Заказ не сохранён, попробуйте ещё раз.');
      isPlacingOrder = false;
      showCartTab();
      return;
    }

    const now = Date.now();
    const durationMs = now - orderClickTs;
    console.log('[perf] placeOrder duration:', durationMs, 'ms');
  } catch (e) {
    console.error('backend order error', e);
    tg?.showAlert?.('Ошибка при отправке заказа, попробуйте ещё раз.');
    isPlacingOrder = false;
    showCartTab();
    return;
  }

  tg?.showAlert?.('✅ Заказ оформлен!');
  cartItems = [];
  saveCartToStorage();
  updateCartBadge();
  isPlacingOrder = false;
  showCartTab();
};

// ---------- Обновление товаров вручную ----------

window.refreshProducts = async function() {
  if (isRefreshingProducts) return;
  isRefreshingProducts = true;

  root.innerHTML =
    '<div class="pb-[65px] max-w-md mx-auto">' +
      '<div class="product-grid">' +
        Array.from({ length: 6 }).map(() =>
          '<div class="bg-white rounded-2xl p-4 shadow-lg">' +
            '<div class="h-32 mb-3 rounded-xl placeholder-shimmer"></div>' +
            '<div class="h-4 w-3/4 mb-2 rounded placeholder-shimmer"></div>' +
            '<div class="h-5 w-1/2 mb-2 rounded.placeholder-shimmer"></div>' +
            '<div class="h-3 w-1/3 rounded.placeholder-shimmer"></div>' +
          '</div>'
        ).join('') +
      '</div>' +
    '</div>';

  try {
    await fetchAndUpdateProducts(true);
  } finally {
    isRefreshingProducts = false;
  }
};

// ---------- Загрузка товаров с API ----------

async function fetchAndUpdateProducts(showLoader = false) {
  const t0 = performance.now();

  if (showLoader) {
    root.innerHTML =
      '<div class="pb-[65px] max-w-md mx-auto">' +
        '<div class="mb-5">' +
          '<div class="h-6 w-32 mb-4 rounded placeholder-shimmer"></div>' +
          '<div class="flex items-center gap-3">' +
            '<div class="flex-1 bg-white rounded-2xl px-3 py-2">' +
              '<div class="h-3 w-20 mb-2 rounded placeholder-shimmer"></div>' +
              '<div class="h-4 w-full rounded.placeholder-shimmer"></div>' +
            '</div>' +
            '<div class="w-44 bg-white rounded-2xl px-3 py-2">' +
              '<div class="h-3 w-16 mb-2 rounded.placeholder-shimmer"></div>' +
              '<div class="h-4 w-full rounded.placeholder-shimmer"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="product-grid">' +
          Array.from({ length: 6 }).map(() =>
            '<div class="bg-white rounded-2xl p-4 shadow-lg">' +
              '<div class="h-32 mb-3 rounded-xl placeholder-shimmer"></div>' +
              '<div class="h-4 w-3/4 mb-2 rounded.placeholder-shimmer"></div>' +
              '<div class="h-5 w-1/2 mb-2 rounded.placeholder-shimmer"></div>' +
              '<div class="h-3 w-1/3 rounded.placeholder-shimmer"></div>' +
            '</div>'
          ).join('') +
        '</div>' +
      '</div>';
  }

  try {
    const response = await fetch(API_URL);
    logStage('products fetch', t0);

    if (!response.ok) throw new Error('HTTP ' + response.status);

    const products = await response.json();
    logStage('products json parse', t0);

    const normalized = normalizeProducts(products);
    logStage('normalizeProducts', t0);

    const inStockNames = new Set(
      normalized.filter(v => v.inStock).map(v => v.name)
    );
    const newProductsData = normalized.filter(v => inStockNames.has(v.name));

    const oldJson = JSON.stringify(productsData || []);
    const newJson = JSON.stringify(newProductsData);

    if (oldJson !== newJson) {
      productsData = newProductsData;

      const cats = Array.from(new Set(productsData.map(p => p.cat).filter(Boolean)));
      CATEGORIES = ['Все', ...cats];

      if (selectedCategory === 'Все') {
        randomIds = pickRandomIds(productsData, Math.min(20, productsData.length));
      }

      syncProductsAndCart();
    }

    logStage('update productsData + sync', t0);
  } catch (error) {
    console.error('API error:', error);
    if (showLoader) {
      isRefreshingProducts = false;
      root.innerHTML =
        '<div class="flex flex-col items-center justify-center min-h-[70vh] text-center p-8 pb-[65px] max-w-md mx-auto">' +
          '<div class="w-24 h-24 bg-red-50 rounded-3xl flex items-center justify-center mb-4">' +
            '<svg class="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
              '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"' +
                    ' d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>' +
            '</svg>' +
          '</div>' +
          '<h2 class="text-xl font-bold text-gray-800 mb-2">Не удалось загрузить товары</h2>' +
          '<p class="text-sm text-gray-500 mb-4 max-w-xs">' +
            'Проверьте соединение и попробуйте обновить список товаров.' +
          '</p>' +
          '<button onclick="refreshProducts()"' +
                  ' class="flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-8 rounded-2xl shadow-lg transition-all text-sm">' +
            '<span class="loader-circle"></span>' +
            '<span>Обновить товары</span>' +
          '</button>' +
        '</div>';
    }
  }
}

// ---------- Инициализация ----------

async function initApp() {
  const t0 = performance.now();
  try {
    console.log('tg object:', window.Telegram?.WebApp);
    console.log('initData string:', window.Telegram?.WebApp?.initData);
    console.log('initDataUnsafe object:', window.Telegram?.WebApp?.initDataUnsafe);
    console.log('initDataUnsafe.user:', window.Telegram?.WebApp?.initDataUnsafe?.user);

    if (typeof initTabBar === 'function') {
      initTabBar();
    }
    logStage('after initTabBar', t0);

    loadOrdersFromStorage();
    loadAddressesFromStorage();
    loadCartFromStorage();
    logStage('after localStorage', t0);

    if (typeof fetchAndUpdateProducts === 'function') {
      await fetchAndUpdateProducts(true);
    } else {
      throw new Error('Функция fetchAndUpdateProducts не найдена (products.js не загружен)');
    }
    logStage('after fetchAndUpdateProducts', t0);

    if (typeof renderShop === 'function') {
      renderShop();
    } else {
      throw new Error('Функция renderShop не найдена (products.js не загружен)');
    }
    logStage('after renderShop', t0);

    setInterval(() => {
      try {
        if (typeof fetchAndUpdateProducts === 'function') {
          fetchAndUpdateProducts(false).catch(err => console.error('Auto-refresh error', err));
        }
      } catch (e) {
        console.error('Auto-refresh exception', e);
      }
    }, 5 * 60 * 1000);
  } catch (e) {
    console.error('Init error:', e);
    showError(e.message || 'Ошибка инициализации приложения');
  }
}

initApp();
