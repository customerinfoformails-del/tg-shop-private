const tg = window.Telegram?.WebApp;
try {
  tg?.ready();
  tg?.expand();
  tg?.setBackgroundColor?.('#f3f4f6'); // bg-gray-100
} catch (e) {
  console.log('[core] tg init error', e);
}

const API_URL =
  'https://script.google.com/macros/s/AKfycbxyKA2QcJBKim9ttOKHiJ_uTVYunBKhBnNFNf9BLGewzHpqqcY9ZY8smmvCwQZzOGs85Q/exec';
const ORDERS_API_URL =
  'https://tg-shop-test-backend.onrender.com/orders';
const BACKEND_ORDER_URL = 'https://tg-shop-test-backend.onrender.com/order';


const isMobileDevice =
  (navigator.userAgentData && navigator.userAgentData.mobile) ||
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobi/i.test(
    navigator.userAgent || ''
  );

let CATEGORIES = ['Все'];
let isOrdersLoading = false;

let selectedCategory = 'Все',
  query = '',
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
let placeOrderTimeoutId = null;

// сохранение состояния формы корзины между рендерами
let cartFormState = {
  addressText: '',
  comment: '',
  contactName: '',
  contactPhone: '',
  savedAddressValue: '',
  pickupLocationValue: ''
};

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

// ---------- localStorage (корзина и адреса) ----------

function saveCartToStorage() {
  try {
    localStorage.setItem('cartItems', JSON.stringify(cartItems));
  } catch (e) {
    console.log('[core] saveCartToStorage error', e);
  }
}

function loadCartFromStorage() {
  try {
    const raw = localStorage.getItem('cartItems');
    cartItems = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.log('[core] loadCartFromStorage error', e);
    cartItems = [];
  }
  console.log('[core] cartItems loaded', cartItems);
  updateCartBadge();
}

function saveAddressesToStorage() {
  try {
    localStorage.setItem('addresses', JSON.stringify(savedAddresses));
  } catch (e) {
    console.log('[core] saveAddressesToStorage error', e);
  }
}

function loadAddressesFromStorage() {
  try {
    const raw = localStorage.getItem('addresses');
    savedAddresses = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.log('[core] loadAddressesFromStorage error', e);
    savedAddresses = [];
  }
  console.log('[core] savedAddresses loaded', savedAddresses);
}

// заказы всегда только с сервера
function saveOrdersToStorage() {}
function loadOrdersFromStorage() {
  previousOrders = [];
  console.log('[core] previousOrders reset to []');
}

// ---------- Запрет зума ----------

document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('gesturechange', e => e.preventDefault());
document.addEventListener('gestureend', e => e.preventDefault());
document.addEventListener(
  'touchstart',
  e => {
    if (e.touches.length > 1) e.preventDefault();
  },
  { passive: false }
);
let lastTouchEnd = 0;
document.addEventListener(
  'touchend',
  e => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  },
  { passive: false }
);

// ---------- Таббар ----------

function setTabBarDisabled(disabled) {
  isTabChanging = disabled;
  document
    .querySelectorAll('#tabBar .tab-item')
    .forEach(t => t.classList.toggle('pointer-events-none', disabled));
}

function initTabBar() {
  console.log('[core] initTabBar');
  document.querySelectorAll('#tabBar .tab-item').forEach(tab => {
    tab.onclick = e => {
      e.preventDefault();
      switchTab(tab.dataset.tab);
    };
  });
  updateCartBadge();
}

function switchTab(tabName) {
  console.log('[core] switchTab from', currentTab, 'to', tabName);
  if (isTabChanging) return;
  if (currentTab === tabName) return;

  if (typeof closeModal === 'function' && modal && !modal.classList.contains('hidden')) {
    closeModal();
  }

  const prevTab = currentTab;
  isTabChanging = true;
  setTabBarDisabled(true);

  Promise.resolve()
    .then(() => {
      if (tabName === 'shop') {
        renderShop();
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
      document
        .querySelectorAll('#tabBar .tab-item')
        .forEach(t => t.classList.remove('active'));
      const currentEl = document.querySelector('[data-tab="' + tabName + '"]');
      if (currentEl) currentEl.classList.add('active');
    })
    .catch(err => {
      console.error('[core] switchTab error', err);
      currentTab = prevTab;
    })
    .finally(() => {
      isTabChanging = false;
      setTabBarDisabled(false);
    });
}

// ---------- Синхронизация корзины и товаров ----------

function syncCartWithProducts() {
  if (!productsData) return;
  cartItems = cartItems.map(item => {
    const exists = productsData.some(p => p.id === item.id && p.inStock);
    return { ...item, available: exists };
  });
  console.log('[core] syncCartWithProducts result', cartItems);
  saveCartToStorage();
  updateCartBadge();
}

function syncProductsAndCart() {
  syncCartWithProducts();
  if (currentTab === 'shop') renderShop();
  if (currentTab === 'cart') showCartTab();
}

// ---------- Метрики ----------

function logStage(label, startTime) {
  const now = performance.now();
  console.log(`[perf] ${label}: ${Math.round(now - startTime)} ms`);
}

// ---------- Загрузка товаров с API ----------

async function fetchAndUpdateProducts(showLoader = false) {
  const t0 = performance.now();
  console.log('[core] fetchAndUpdateProducts start, showLoader =', showLoader, 'tab=', currentTab);

  if (showLoader && currentTab === 'shop') {
    root.innerHTML =
      '<div class="pb-[65px] max-w-md mx-auto">' +
        '<div class="mb-5">' +
          '<div class="h-6 w-32 mb-4 rounded placeholder-shimmer"></div>' +
          '<div class="flex items-center gap-3">' +
            '<div class="flex-1 bg-white rounded-2xl px-3 py-2">' +
              '<div class="h-3 w-20 mb-2 rounded placeholder-shimmer"></div>' +
              '<div class="h-4 w-full rounded placeholder-shimmer"></div>' +
            '</div>' +
            '<div class="w-44 bg-white rounded-2xl px-3 py-2">' +
              '<div class="h-3 w-16 mb-2 rounded placeholder-shimmer"></div>' +
              '<div class="h-4 w-full rounded placeholder-shimmer"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="product-grid">' +
          Array.from({ length: 6 }).map(() =>
            '<div class="bg-white rounded-2xl p-4 shadow-lg">' +
              '<div class="h-32 mb-3 rounded-xl overflow-hidden">' +
                '<div class="w-full h-full rounded-xl placeholder-shimmer"></div>' +
              '</div>' +
              '<div class="h-4 w-3/4 mb-2 rounded placeholder-shimmer"></div>' +
              '<div class="h-5 w-1/2 mb-2 rounded placeholder-shimmer"></div>' +
              '<div class="h-3 w-1/3 rounded placeholder-shimmer"></div>' +
            '</div>'
          ).join('') +
        '</div>' +
      '</div>';
  }

  try {
    const response = await fetch(API_URL);
    logStage('products fetch', t0);
    console.log('[core] products response status', response.status);

    if (!response.ok) throw new Error('HTTP ' + response.status);

    const products = await response.json();
    logStage('products json parse', t0);
    console.log('[core] products count', Array.isArray(products) ? products.length : 'not array');

    const normalized = normalizeProducts(products);
    logStage('normalizeProducts', t0);

    productsData = normalized;

    const cats = Array.from(new Set(productsData.map(p => p.cat).filter(Boolean)));
    CATEGORIES = ['Все', ...cats];
    console.log('[core] CATEGORIES', CATEGORIES);

    syncProductsAndCart();
    logStage('update productsData + sync', t0);
  } catch (error) {
    console.error('[core] products API error:', error);
    if (showLoader && currentTab === 'shop') {
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

const loadedImageUrls = new Set();

window.handleProductImageLoad = function (img, url) {
  try {
    if (!loadedImageUrls.has(url)) {
      loadedImageUrls.add(url);
      img.classList.add('loaded'); // плавный fade-in
    } else {
      // уже когда-то грузили этот URL — сразу показываем без анимации
      img.style.opacity = '1';
    }
  } catch (e) {
    console.log('[images] handleProductImageLoad error', e);
    img.style.opacity = '1';
  }
};

// ---------- Обновление товаров вручную ----------

window.refreshProducts = async function () {
  if (isRefreshingProducts) return;
  isRefreshingProducts = true;
  console.log('[core] refreshProducts clicked');

  root.innerHTML =
    '<div class="pb-[65px] max-w-md mx-auto">' +
      '<div class="product-grid">' +
        Array.from({ length: 6 }).map(() =>
          '<div class="bg-white rounded-2xl p-4 shadow-lg">' +
            '<div class="h-32 mb-3 rounded-xl placeholder-shimmer"></div>' +
            '<div class="h-4 w-3/4 mb-2 rounded placeholder-shimmer"></div>' +
            '<div class="h-5 w-1/2 mb-2 rounded placeholder-shimmer"></div>' +
            '<div class="h-3 w-1/3 rounded placeholder-shimmer"></div>' +
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

// ---------- История заказов с Google Sheets ----------

async function fetchUserOrders() {
  try {
    const userId = tg?.initDataUnsafe?.user?.id;
    console.log('[orders] fetchUserOrders userId =', userId);
    if (!userId) return;

    isOrdersLoading = true;
    if (currentTab === 'profile') {
      renderProfileSkeleton();
    }

    const url = ORDERS_API_URL + '?userId=' + encodeURIComponent(userId);
    console.log('[orders] fetch url:', url);
    const resp = await fetch(url);
    console.log('[orders] response status', resp.status);
    if (!resp.ok) return;

    const data = await resp.json();
    console.log(
      '[orders] data.ok=',
      data.ok,
      'count=',
      Array.isArray(data.orders) ? data.orders.length : 'no array'
    );
    if (!data.ok || !Array.isArray(data.orders)) return;

    previousOrders = data.orders;
    console.log('[orders] previousOrders updated', previousOrders.length);

    if (currentTab === 'profile') {
      showProfileTab();
    }
  } catch (e) {
    console.error('[orders] fetchUserOrders error', e);
  } finally {
    isOrdersLoading = false;
  }
}

// ---------- Инициализация ----------

function hideTabBar() {
  if (!isMobileDevice) return; // на десктопе не трогаем таббар
  const tabBar = document.getElementById('tabBar');
  if (!tabBar) return;
  tabBar.style.opacity = '0';
  tabBar.style.pointerEvents = 'none';
}

function showTabBar() {
  if (!isMobileDevice) return; // на десктопе всегда видим
  const tabBar = document.getElementById('tabBar');
  if (!tabBar) return;
  tabBar.style.opacity = '1';
  tabBar.style.pointerEvents = 'auto';
}

async function initApp() {
  const t0 = performance.now();
  try {
    console.log('[core] initApp start');
    console.log('tg object:', window.Telegram?.WebApp);
    console.log('initData string:', window.Telegram?.WebApp?.initData);
    console.log('initDataUnsafe object:', window.Telegram?.WebApp?.initDataUnsafe);
    console.log('initDataUnsafe.user:', window.Telegram?.WebApp?.initDataUnsafe?.user);

    initTabBar();
    logStage('after initTabBar', t0);

    loadOrdersFromStorage(); // просто previousOrders = []
    loadAddressesFromStorage();
    loadCartFromStorage();
    logStage('after localStorage', t0);

    await fetchAndUpdateProducts(true);
    logStage('after fetchAndUpdateProducts', t0);

    // начальная серверная история
    fetchUserOrders().catch(e => console.error('[orders] init fetch error', e));

    if (currentTab === 'shop') {
      renderShop();
    } else if (currentTab === 'cart') {
      showCartTab();
    } else if (currentTab === 'sale') {
      showSaleTab();
    } else if (currentTab === 'profile') {
      showProfileTab();
    } else if (currentTab === 'about') {
      showAboutTab();
    }
    logStage('after initial tab render', t0);

    setInterval(() => {
      try {
        fetchAndUpdateProducts(false).catch(err => console.error('[core] Auto-refresh error', err));
      } catch (e) {
        console.error('[core] Auto-refresh exception', e);
      }
    }, 5 * 60 * 1000);
  } catch (e) {
    console.error('[core] Init error:', e);
    showError(e.message || 'Ошибка инициализации приложения');
  }
}

initApp();
