function renderProfileSkeleton() {
  root.innerHTML =
    '<div class="p-6 space-y-6 pb-[65px] max-w-md mx-auto bg-gray-50">' +
      '<div class="flex items-center gap-4">' +
        '<div class="w-16 h-16 bg-gray-200 rounded-2xl placeholder-shimmer"></div>' +
        '<div class="flex-1 space-y-2">' +
          '<div class="h-4 w-24 bg-gray-200 rounded placeholder-shimmer"></div>' +
          '<div class="h-3 w-40 bg-gray-200 rounded placeholder-shimmer"></div>' +
        '</div>' +
      '</div>' +
      '<div class="space-y-3">' +
        '<div class="h-4 w-32 bg-gray-200 rounded placeholder-shimmer"></div>' +
        '<div class="space-y-2">' +
          Array.from({ length: 2 }).map(() =>
            '<div class="h-10 w-full bg-white border border-gray-200 rounded-2xl flex items-center px-3">' +
              '<div class="h-3 w-3/4 bg-gray-200 rounded placeholder-shimmer"></div>' +
            '</div>'
          ).join('') +
        '</div>' +
      '</div>' +
      '<div class="space-y-3">' +
        '<div class="h-4 w-40 bg-gray-200 rounded placeholder-shimmer"></div>' +
        Array.from({ length: 3 }).map(() =>
          '<div class="bg-white border border-gray-200 rounded-2xl p-3 space-y-2">' +
            '<div class="h-3 w-1/2 bg-gray-200 rounded placeholder-shimmer"></div>' +
            '<div class="h-3 w-1/3 bg-gray-200 rounded.placeholder-shimmer"></div>' +
            '<div class="h-3 w-1/4 bg-gray-200 rounded.placeholder-shimmer"></div>' +
          '</div>'
        ).join('') +
      '</div>' +
    '</div>';
}

window.toggleOrderDetails = function (index) {
  const block = document.getElementById('orderDetails_' + index);
  if (!block) return;
  block.classList.toggle('hidden');
};

function showProfileTab() {
  if (isOrdersLoading) {
    renderProfileSkeleton();
    return;
  }

  const user = tg?.initDataUnsafe?.user;
  const username = user?.username || 'неизвестно';
  const displayId = '@' + username;

  const ordersHtml = previousOrders.length
    ? previousOrders
        .map(
          (o, idx) =>
            '<div class="mb-3 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">' +
            '<button type="button" class="w-full text-left px-3 py-2 flex items-center justify-between" onclick="toggleOrderDetails(' +
            idx +
            ')">' +
            '<div class="flex flex-col min-w-0 mr-2">' +
            '<span class="text-sm font-semibold text-gray-800 truncate">Заказ #' +
            o.id +
            '</span>' +
            '<span class="text-[11px] text-gray-500">' +
            new Date(o.date).toLocaleString() +
            '</span>' +
            '</div>' +
            '<span class="text-sm font-bold text-blue-600 whitespace-nowrap">$' +
            o.total +
            '</span>' +
            '</button>' +
            '<div class="px-3 pb-2 border-t border-gray-100 text-xs text-gray-600">' +
            '<div class="mt-1 break-words">Адрес: ' +
            escapeHtml(o.address) +
            '</div>' +
            (o.comment
              ? '<div class="mt-1 break-words text-gray-500">Комментарий: ' +
                escapeHtml(o.comment) +
                '</div>'
              : '') +
            (o.contact && (o.contact.name || o.contact.phone)
              ? '<div class="mt-1 break-words">Контакт: ' +
                (o.contact.name ? escapeHtml(o.contact.name) : '') +
                (o.contact.name && o.contact.phone ? ', ' : '') +
                (o.contact.phone ? escapeHtml(o.contact.phone) : '') +
                '</div>'
              : '') +
            '<div class="mt-1 text-gray-500">Товаров: ' +
            o.items.reduce((sum, item) => sum + (item.quantity || 0), 0) +
            '</div>' +
            '<div id="orderDetails_' +
            idx +
            '" class="hidden mt-2 pt-2 border-t border-dashed border-gray-200">' +
            o.items
              .map(
                item =>
                  '<div class="flex items-center justify-between mb-1 gap-2">' +
                  '<div class="flex-1 min-w-0">' +
                  '<div class="font-semibold text-[11px] break-words">' +
                  escapeHtml(item.name) +
                  '</div>' +
                  '<div class="text-[10px] text-gray-500">' +
                  escapeHtml(item.storage) +
                  ' | ' +
                  escapeHtml(item.color) +
                  ' | ' +
                  escapeHtml(item.region) +
                  '</div>' +
                  '</div>' +
                  '<div class="text-right text-[10px] whitespace-nowrap">' +
                  '<div>' +
                  item.quantity +
                  ' шт.</div>' +
                  '<div>$' +
                  item.price * item.quantity +
                  '</div>' +
                  '</div>' +
                  '</div>'
              )
              .join('') +
            '</div>' +
            '</div>' +
            '</div>'
        )
        .join('')
    : '<p class="text-sm text-gray-500">Заказов пока нет</p>';

  const addressesHtml = savedAddresses.length
    ? savedAddresses
        .map(
          (addr, idx) =>
            '<div class="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-2xl mb-1">' +
            '<span class="flex-1 text-xs text-gray-700 break-words">' +
            escapeHtml(addr) +
            '</span>' +
            '<button class="text-xs text-red-500 shrink-0" onclick="removeAddress(' +
            idx +
            ')">Удалить</button>' +
            '</div>'
        )
        .join('')
    : '<p class="text-sm text-gray-500">Сохранённых адресов нет</p>';

  root.innerHTML =
    '<div class="p-6 space-y-6 pb-[65px] max-w-md mx-auto bg-gray-50">' +
    '<div class="flex items-center gap-4">' +
    '<div class="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shrink-0">' +
    '<svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"' +
    ' d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>' +
    '</svg>' +
    '</div>' +
    '<div class="flex flex-col min-w-0">' +
    '<h2 class="text-xl font-bold leading-tight text-gray-900">Профиль</h2>' +
    '<p class="text-gray-500 text-sm mt-1 break-all">ID: ' +
    escapeHtml(displayId) +
    '</p>' +
    '</div>' +
    '</div>' +
    '<div class="space-y-3">' +
    '<h3 class="text-lg font-semibold text-gray-800">Сохранённые адреса</h3>' +
    '<div id="addressesList">' +
    addressesHtml +
    '</div>' +
    '<div class="space-y-2">' +
    '<textarea id="newAddress" class="w-full bg-white border border-gray-300 rounded-2xl px-3 py-2 text-sm" rows="2" placeholder="Новый адрес..."></textarea>' +
    '<button class="w-full bg-gray-900 hover:bg-black text-white font-bold.py-2 px-4 rounded-2xl transition-all text-sm"' +
    ' onclick="addAddress()">' +
    'Сохранить адрес' +
    '</button>' +
    '</div>' +
    '</div>' +
    '<div class="space-y-3">' +
    '<h3 class="text-lg font-semibold text-gray-800">Предыдущие заказы</h3>' +
    '<div>' +
    ordersHtml +
    '</div>' +
    '</div>' +
    '</div>';
}

window.addAddress = function () {
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

window.removeAddress = function (index) {
  savedAddresses.splice(index, 1);
  saveAddressesToStorage();
  showProfileTab();
};
