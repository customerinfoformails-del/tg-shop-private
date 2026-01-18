// ---------- Корзина и бейдж ----------

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

window.changeCartItemQuantity = function (index, delta) {
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

window.removeCartItem = function (index) {
  cartItems.splice(index, 1);
  saveCartToStorage();
  updateCartBadge();
  showCartTab();
};

// обновление цены одной позиции
window.updateCartItemPrice = function (index) {
  const item = cartItems[index];
  if (!item || !item.newPrice) return;
  item.price = item.newPrice;
  item.available = true;
  delete item.newPrice;
  saveCartToStorage();
  updateCartBadge();
  showCartTab();
  tg?.showAlert?.('Цена обновлена для выбранного товара');
};

// обновить цены всех и удалить неактуальные
window.refreshCartPricesAndCleanup = async function () {
  const btn = document.getElementById('refreshCartButton');
  const loader = document.getElementById('refreshCartLoader');

  if (btn) {
    btn.disabled = true;
    btn.classList.add('opacity-80', 'cursor-not-allowed');
  }
  if (loader) {
    loader.classList.remove('hidden');
  }

  try {
    try {
      await fetchAndUpdateProducts(false);
    } catch (e) {
      console.error('refreshCartPricesAndCleanup error', e);
    }

    if (!productsData) {
      tg?.showAlert?.('Товары ещё не загружены, попробуйте позже');
      return;
    }

    let removedCount = 0;
    let changedCount = 0;
    const removedItems = [];
    const changedItems = [];

    cartItems = cartItems.map(item => {
      const fresh = productsData.find(p => p.id === item.id && p.inStock);
      if (!fresh) {
        removedCount++;
        removedItems.push({
          name: item.name,
          price: item.price,
          storage: item.storage,
          color: item.color,
          region: item.region
        });
        return { ...item, available: false, deleted: true };
      }
      if (fresh.price !== item.price) {
        changedCount++;
        changedItems.push({
          name: item.name,
          oldPrice: item.price,
          newPrice: fresh.price,
          storage: item.storage,
          color: item.color,
          region: item.region
        });
        return { ...item, available: false, newPrice: fresh.price };
      }
      return { ...item, available: true, newPrice: undefined };
    });

    cartItems = cartItems.filter(i => !i.deleted);

    saveCartToStorage();
    updateCartBadge();
    showCartTab();

    if (!removedCount && !changedCount) {
      tg?.showAlert?.('Все товары актуальны');
      return;
    }

    let msgLines = [];

    if (removedItems.length) {
      msgLines.push('❌ Удалены недоступные:');
      removedItems.forEach(i => {
        msgLines.push(
          '- ' +
            i.name +
            ' (' +
            i.storage +
            ', ' +
            i.color +
            ', ' +
            i.region +
            '), цена была $' +
            i.price
        );
      });
    }

    if (changedItems.length) {
      if (msgLines.length) msgLines.push('');
      msgLines.push('💲 Обновилась цена:');
      changedItems.forEach(i => {
        msgLines.push(
          '- ' +
            i.name +
            ' (' +
            i.storage +
            ', ' +
            i.color +
            ', ' +
            i.region +
            '): ' +
            '$' +
            i.oldPrice +
            ' → $' +
            i.newPrice
        );
      });
      msgLines.push('');
      msgLines.push('У этих товаров появилась кнопка «Обновить цену» в корзине.');
    }

    tg?.showAlert?.(msgLines.join('\n'));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('opacity-80', 'cursor-not-allowed');
    }
    if (loader) {
      loader.classList.add('hidden');
    }
  }
};

// ---------- Сохранение/восстановление формы корзины ----------

function saveCartFormState() {
  const deliveryAddress = document.getElementById('deliveryAddress');
  const deliveryComment = document.getElementById('deliveryComment');
  const contactNameEl = document.getElementById('contactName');
  const contactPhoneEl = document.getElementById('contactPhone');
  const savedAddress = document.getElementById('savedAddress');
  const pickupLocationEl = document.getElementById('pickupLocation');

  cartFormState.addressText = deliveryAddress ? deliveryAddress.value : cartFormState.addressText;
  cartFormState.comment = deliveryComment ? deliveryComment.value : cartFormState.comment;
  cartFormState.contactName = contactNameEl ? contactNameEl.value : cartFormState.contactName;
  cartFormState.contactPhone = contactPhoneEl ? contactPhoneEl.value : cartFormState.contactPhone;
  cartFormState.savedAddressValue = savedAddress
    ? savedAddress.value
    : cartFormState.savedAddressValue;
  cartFormState.pickupLocationValue = pickupLocationEl
    ? pickupLocationEl.value
    : cartFormState.pickupLocationValue;
}

function restoreCartFormState() {
  const deliveryAddress = document.getElementById('deliveryAddress');
  const deliveryComment = document.getElementById('deliveryComment');
  const contactNameEl = document.getElementById('contactName');
  const contactPhoneEl = document.getElementById('contactPhone');
  const savedAddress = document.getElementById('savedAddress');
  const pickupLocationEl = document.getElementById('pickupLocation');

  if (deliveryAddress && cartFormState.addressText) {
    deliveryAddress.value = cartFormState.addressText;
  }
  if (deliveryComment && cartFormState.comment) {
    deliveryComment.value = cartFormState.comment;
  }
  if (contactNameEl && cartFormState.contactName) {
    contactNameEl.value = cartFormState.contactName;
  }
  if (contactPhoneEl && cartFormState.contactPhone) {
    contactPhoneEl.value = cartFormState.contactPhone;
  }
  if (savedAddress && cartFormState.savedAddressValue) {
    savedAddress.value = cartFormState.savedAddressValue;
  }
  if (pickupLocationEl && cartFormState.pickupLocationValue) {
    pickupLocationEl.value = cartFormState.pickupLocationValue;
  }
}

// ---------- Вкладка корзины ----------

window.setPaymentType = function (type) {
  paymentType = type;
  showCartTab();
};

window.setPickupMode = function (mode) {
  pickupMode = !!mode;
  showCartTab();
};

window.setPickupLocation = function (addr) {
  pickupLocation = addr;
};

window.onSavedAddressChange = function () {
  const select = document.getElementById('savedAddress');
  const wrapper = document.getElementById('deliveryAddressWrapper');
  if (!select || !wrapper) return;
  wrapper.style.display = select.value ? 'none' : 'block';
};

function showCartTab() {
  // сохранить текущие значения полей перед перерисовкой
  saveCartFormState();

  if (!cartItems.length) {
    root.innerHTML =
      '<div class="flex flex-col items-center.justify-center min-h-[70vh] text-center p-8 pb-[65px]">' +
      '<div class="w-28 h-28 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-3xl flex items-center.justify-center mb-6">' +
      '<svg class="w-16 h-16 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"' +
      ' d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 2.5M7 13l-1.5 2.5m12.5-2.5L21 13m0 0l-1.5 2.5m1.5-2.5L21 21"/>' +
      '</svg>' +
      '</div>' +
      '<h2 class="text-2xl.font-bold text-gray-800 mb-2">Корзина пуста</h2>' +
      '<p class="text-sm text-gray-500 mb-6 max-w-xs">' +
      'Добавьте устройство в корзину, чтобы оформить заказ.' +
      '</p>' +
      '<button onclick="switchTab(\'shop\')"' +
      ' class="bg-blue-500 hover:bg-blue-600 text-white font-semibold.py-3 px-8 rounded-2xl shadow-lg transition-all">' +
      'Перейти в магазин' +
      '</button>' +
      '</div>';
    return;
  }

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const commission = paymentType === 'card' ? Math.round(subtotal * 0.15) : 0;
  const total = subtotal + commission;

  root.innerHTML =
    '<div class="relative min-h-[100vh] p-6 space-y-6 pb-[80px] max-w-md mx-auto">' +
    '<div class="flex items-center.justify-between mb-4">' +
    '<h2 class="text-2xl font-bold text-gray-800">Корзина</h2>' +
    '<button onclick="refreshCartPricesAndCleanup()"' +
    ' class="inline-flex items-center.justify-center text-[11px] font-semibold px-2.5 h-8 rounded-full ' +
    ' bg-purple-500 hover:bg-purple-600 text-white shadow-md transition-all active:scale-[0.97] max-w-[180px] whitespace-nowrap"' +
    ' id="refreshCartButton">' +
    '<span class="loader-circle.hidden mr-1" id="refreshCartLoader"></span>' +
    '<span class="leading-tight">Актуализировать корзину</span>' +
    '</button>' +
    '</div>' +
    '<div class="space-y-3">' +
    cartItems
      .map(
        (item, idx) =>
          '<div class="flex items-center.justify-between p-3 rounded-xl border ' +
          (item.available ? 'border-gray-200' : 'border-orange-300 bg-orange-50') +
          '">' +
          '<div class="text-left flex-1 mr-3">' +
          '<div class="font-semibold text-sm break-words">' +
          escapeHtml(item.name) +
          '</div>' +
          '<div class="text-xs text-gray-500">' +
          escapeHtml(item.storage) +
          ' | ' +
          escapeHtml(item.color) +
          ' | ' +
          escapeHtml(item.region) +
          '</div>' +
          '<div class="text-xs mt-1 ' +
          (item.available
            ? 'text-green-600'
            : item.newPrice
            ? 'text-orange-600'
            : 'text-red-600') +
          '">' +
          (item.available
            ? 'В наличии'
            : item.newPrice
            ? 'Цена обновилась: старая $' + item.price + ', новая $' + item.newPrice
            : 'Товар недоступен, удалите из корзины') +
          '</div>' +
          '</div>' +
          '<div class="text-right flex.flex-col items-end gap-1">' +
          '<div class="flex items-center.justify-end gap-2">' +
          '<button class="px-2 py-1.rounded-full bg-gray-200 text-sm font-bold"' +
          ' onclick="changeCartItemQuantity(' +
          idx +
          ', -1)">-</button>' +
          '<span class="min-w-[24px] text-center text-sm font-semibold">' +
          item.quantity +
          '</span>' +
          '<button class="px-2 py-1.rounded-full bg-gray-200 text-sm font-bold"' +
          ' onclick="changeCartItemQuantity(' +
          idx +
          ', 1)">+</button>' +
          '</div>' +
          '<div class="text-sm font-bold text-blue-600">$' +
          item.price * item.quantity +
          '</div>' +
          (item.newPrice
            ? '<button class="text-xs text-blue-500" onclick="updateCartItemPrice(' +
              idx +
              ')">Обновить цену</button>'
            : '') +
          '<button class="text-xs text-red-500" onclick="removeCartItem(' +
          idx +
          ')">Удалить</button>' +
          '</div>' +
          '</div>'
      )
      .join('') +
    '</div>' +
    '<div class="pt-4 border-t space-y-4">' +
    '<div class="space-y-2">' +
    '<h3 class="text-sm font-semibold text-gray-700">Способ оплаты</h3>' +
    '<div class="flex flex-col gap-2">' +
    '<label class="flex items-center.gap-2 text-sm">' +
    '<input type="radio" name="paymentType" value="cash"' +
    (paymentType === 'cash' ? ' checked' : '') +
    ' onchange="setPaymentType(\'cash\')">' +
    '<span>Наличными (0%)</span>' +
    '</label>' +
    '<label class="flex items-center gap-2 text-sm">' +
    '<input type="radio" name="paymentType" value="card"' +
    (paymentType === 'card' ? ' checked' : '') +
    ' onchange="setPaymentType(\'card\')">' +
    '<span>Картой (+15%)</span>' +
    '</label>' +
    '</div>' +
    '</div>' +
    '<div class="space-y-2">' +
    '<h3 class="text-sm font-semibold text-gray-700">Способ получения</h3>' +
    '<div class="flex flex-col gap-2 mb-2">' +
    '<label class="flex items-center.gap-2 text-sm">' +
    '<input type="radio" name="pickupMode" value="delivery"' +
    (!pickupMode ? ' checked' : '') +
    ' onchange="setPickupMode(false)">' +
    '<span>Доставка</span>' +
    '</label>' +
    '<label class="flex items-center gap-2 text-sm">' +
    '<input type="radio" name="pickupMode" value="pickup"' +
    (pickupMode ? ' checked' : '') +
    ' onchange="setPickupMode(true)">' +
    '<span>Самовывоз</span>' +
    '</label>' +
    '</div>' +
    (!pickupMode
      ? '<label class="text-sm.font-semibold text-gray-700 block">Адрес доставки</label>' +
        '<select id="savedAddress" class="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm mb-2" onchange="onSavedAddressChange()">' +
        '<option value="">Выбрать сохранённый адрес</option>' +
        (savedAddresses || [])
          .map(
            addr =>
              '<option value="' +
              escapeHtml(addr) +
              '">' +
              escapeHtml(addr) +
              '</option>'
          )
          .join('') +
        '</select>' +
        '<div id="deliveryAddressWrapper" class="mb-2">' +
        '<textarea id="deliveryAddress" class="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm"' +
        ' rows="3" placeholder="Введите адрес доставки..."></textarea>' +
        '</div>' +
        '<div class="mt-1">' +
        '<label class="text-sm.font-semibold text-gray-700 block mb-1">Комментарий к доставке</label>' +
        '<textarea id="deliveryComment" class="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm"' +
        ' rows="2" placeholder="Например: позвонить за 10 минут, домофон не работает..."></textarea>' +
        '</div>'
      : '<label class="text-sm font-semibold text-gray-700 block">Адрес самовывоза</label>' +
        '<select id="pickupLocation" class="w-full bg-white.border border-gray-300 rounded-xl px-3 py-2 text-sm mb-2"' +
        ' onchange="setPickupLocation(this.value)">' +
        '<option value="">Выберите пункт самовывоза</option>' +
        PICKUP_LOCATIONS.map(
          addr =>
            '<option value="' +
            escapeHtml(addr) +
            '"' +
            (pickupLocation === addr ? ' selected' : '') +
            '>' +
            escapeHtml(addr) +
            '</option>'
        ).join('') +
        '</select>' +
        '<div class="mt-1">' +
        '<label class="text-sm font-semibold text-gray-700 block mb-1">Комментарий к заказу</label>' +
        '<textarea id="deliveryComment" class="w-full bg-white border.border-gray-300 rounded-xl px-3 py-2 text-sm"' +
        ' rows="2" placeholder="Например: приеду к 19:00, позвонить заранее..."></textarea>' +
        '</div>') +
    '</div>' +
    '<div class="space-y-2">' +
    '<label class="text-sm.font-semibold text-gray-700 block">Контактные данные (необязательно)</label>' +
    '<input id="contactName" type="text"' +
    ' class="w-full bg-white border.border-gray-300 rounded-xl px-3 py-2 text-sm mb-2 focus:outline-none"' +
    ' placeholder="Имя">' +
    '<input id="contactPhone" type="tel"' +
    ' class="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none"' +
    ' placeholder="Телефон">' +
    '</div>' +
    '<div class="space-y-1 text-sm text-gray-700">' +
    '<div class="flex items-center.justify-between">' +
    '<span>Сумма товаров</span>' +
    '<span>$' +
    subtotal +
    '</span>' +
    '</div>' +
    (paymentType === 'card'
      ? '<div class="flex.items-center justify-between">' +
        '<span>Сервисный сбор (карта)</span>' +
        '<span>+$' +
        commission +
        '</span>' +
        '</div>'
      : '') +
    '<div class="flex items-center.justify-between font-semibold mt-1">' +
    '<span>Итого к оплате</span>' +
    '<span>$' +
    total +
    '</span>' +
    '</div>' +
    '</div>' +
    '<div class="pt-3">' +
    '<button onclick="placeOrder()"' +
    ' id="placeOrderButton"' +
    ' class="w-full flex.items-center justify-center gap-2 ' +
    (!cartItems.some(i => !i.available) && !isPlacingOrder
      ? 'bg-blue-500 hover:bg-blue-600'
      : 'bg-gray-400 cursor-not-allowed') +
    ' text-white font-semibold py-2.5 px-6 rounded-2xl.shadow-lg transition-all text-sm"' +
    (cartItems.some(i => !i.available) || isPlacingOrder ? ' disabled' : '') +
    '>' +
    (cartItems.some(i => !i.available)
      ? 'Удалите недоступные товары или обновите цены'
      : isPlacingOrder
      ? '<span class="loader-circle"></span><span>Проверяю наличие (до 70 сек)...</span>'
      : 'Оформить заказ') +
    '</button>' +
    '</div>' +
    '</div>' +
    '</div>';

  restoreCartFormState();
  const savedSelect = document.getElementById('savedAddress');
  if (savedSelect) {
    onSavedAddressChange();
  }
}

// ---------- Оформление заказа ----------

window.placeOrder = async function () {
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

  const commentEl = document.getElementById('deliveryComment');
  const deliveryComment = commentEl ? commentEl.value.trim() || '' : '';

  const contactNameEl = document.getElementById('contactName');
  const contactPhoneEl = document.getElementById('contactPhone');
  const contactName = contactNameEl ? contactNameEl.value.trim() || '' : '';
  const contactPhone = contactPhoneEl ? contactPhoneEl.value.trim() || '' : '';

  isPlacingOrder = true;
  showCartTab();

  placeOrderTimeoutId = setTimeout(async () => {
    if (!isPlacingOrder) return;
    console.log('[placeOrder] client-side timeout 70s');
    isPlacingOrder = false;

    // сразу пробуем подтянуть, вдруг заказ уже записан
    try {
      await fetchUserOrders();
    } catch (e) {
      console.error('fetchUserOrders after timeout error', e);
    }

    showCartTab();
    tg?.showAlert?.(
      'Похоже, превышено время ожидания ответа сервера. ' +
        'Проверьте профиль или попробуйте ещё раз.'
    );

    // через 2 минуты — дополнительная фоновая синхронизация
    setTimeout(async () => {
      try {
        console.log('[placeOrder] delayed sync 2min after timeout');
        await fetchUserOrders();
        if (currentTab === 'profile') {
          showProfileTab();
        }
      } catch (e) {
        console.error('fetchUserOrders delayed error', e);
      }
    }, 120000);
  }, 70000);

  try {
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
    let hasPriceChanged = false;

    cartItems = cartItems.map(item => {
      const fresh = productsData.find(p => p.id === item.id && p.inStock);
      if (!fresh) {
        hasUnavailable = true;
        return { ...item, available: false };
      }
      if (fresh.price !== item.price) {
        hasPriceChanged = true;
        return { ...item, available: false, newPrice: fresh.price };
      }
      return { ...item, available: true, newPrice: undefined };
    });
    saveCartToStorage();
    updateCartBadge();

    if (hasUnavailable || hasPriceChanged) {
      isPlacingOrder = false;
      showCartTab();
      if (hasUnavailable && hasPriceChanged) {
        tg?.showAlert?.('Некоторые товары недоступны, а у других обновилась цена. Проверьте корзину.');
      } else if (hasUnavailable) {
        tg?.showAlert?.('Некоторые товары стали недоступны. Удалите их из корзины.');
      } else {
        tg?.showAlert?.('У некоторых товаров обновилась цена. Нажмите "Обновить" возле позиции.');
      }
      return;
    }

    const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
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
      clientClickTs: orderClickTs,
      comment: deliveryComment,
      contact: {
        name: contactName,
        phone: contactPhone
      }
    };

    let resp;
    let text;
    try {
      resp = await fetch(BACKEND_ORDER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
      });

      text = await resp.text();
      console.log('BACKEND_ORDER_URL status:', resp.status);
      console.log('BACKEND_ORDER_URL body:', text);
    } catch (e) {
      console.error('backend order error', e);
      tg?.showAlert?.('Ошибка сети. Заказ не сохранён, попробуйте ещё раз.');
      isPlacingOrder = false;
      showCartTab();
      return;
    }

    let json = null;
    try {
      json = JSON.parse(text);
    } catch (e) {}

    if (!resp.ok || !json || json.ok !== true) {
      console.log('[placeOrder] backend responded with error status:', resp.status, json);
      tg?.showAlert?.('Заказ не сохранён, попробуйте ещё раз.');
      isPlacingOrder = false;
      showCartTab();
      return;
    }

    // только серверная история
    try {
      await fetchUserOrders();
    } catch (e) {
      console.error('fetchUserOrders after success error', e);
    }

    const now = Date.now();
    const durationMs = now - orderClickTs;
    console.log('[perf] placeOrder duration:', durationMs, 'ms');

    tg?.showAlert?.('✅ Заказ оформлен!');
    cartItems = [];
    saveCartToStorage();
    updateCartBadge();
    isPlacingOrder = false;
    showCartTab();
  } finally {
    clearTimeout(placeOrderTimeoutId);
    placeOrderTimeoutId = null;
  }
};
