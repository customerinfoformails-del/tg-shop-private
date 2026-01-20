let modalCurrentIndex = 0;
let modalImageCount = 0;
let modalImageIndexBeforeFullscreen = 0;

let modalTouchStartX = 0;
let modalTouchStartY = 0;

function getVariantCountText(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return count + ' вариант';
  }
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) {
    return count + ' варианта';
  }
  return count + ' вариантов';
}

// SVG-заглушка без текста, размеры как у .no-images h-64
function getModalSvgPlaceholder() {
  const wrapper = document.createElement('div');
  wrapper.className = 'no-images h-64';
  wrapper.innerHTML =
    '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"' +
      ' d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>' +
    '</svg>';
  return wrapper;
}

function selectOptionNoFocus(type, option) {
  if (document.activeElement && document.activeElement.blur) {
    document.activeElement.blur();
  }

  const scrollContainer = document.querySelector('#modalContent .flex-1');
  const prevScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;

  if (selectedOption[type] === option) {
    const typeIndex = FILTER_ORDER.indexOf(type);
    for (let i = typeIndex; i < FILTER_ORDER.length; i++) {
      delete selectedOption[FILTER_ORDER[i]];
    }
  } else {
    const typeIndex = FILTER_ORDER.indexOf(type);
    for (let i = typeIndex + 1; i < FILTER_ORDER.length; i++) {
      delete selectedOption[FILTER_ORDER[i]];
    }
    selectedOption[type] = option;
  }

  renderProductModal(currentProduct);

  const newScrollContainer = document.querySelector('#modalContent .flex-1');
  if (newScrollContainer) newScrollContainer.scrollTop = prevScrollTop;

  tg?.HapticFeedback?.impactOccurred('light');
}

function clearOptionNoFocus(type) {
  if (document.activeElement && document.activeElement.blur) {
    document.activeElement.blur();
  }

  const scrollContainer = document.querySelector('#modalContent .flex-1');
  const prevScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;

  const typeIndex = FILTER_ORDER.indexOf(type);
  for (let i = typeIndex; i < FILTER_ORDER.length; i++) {
    delete selectedOption[FILTER_ORDER[i]];
  }

  renderProductModal(currentProduct);

  const newScrollContainer = document.querySelector('#modalContent .flex-1');
  if (newScrollContainer) newScrollContainer.scrollTop = prevScrollTop;

  tg?.HapticFeedback?.impactOccurred('light');
}

window.selectOptionNoFocus = selectOptionNoFocus;
window.clearOptionNoFocus = clearOptionNoFocus;

window.changeQuantity = function (delta) {
  const scrollContainer = document.querySelector('#modalContent .flex-1');
  const prevScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;

  let q = selectedQuantity + delta;
  if (q < 1) q = 1;
  if (q > 100) q = 100;
  selectedQuantity = q;
  const span = document.getElementById('quantityValue');
  if (span) span.textContent = selectedQuantity;

  if (currentProduct) {
    renderProductModal(currentProduct);
  }

  const newScrollContainer = document.querySelector('#modalContent .flex-1');
  if (newScrollContainer) newScrollContainer.scrollTop = prevScrollTop;
};

// без дополнительного запроса за таблицей
window.addToCartFromModal = async function () {
  if (isAddingToCart) return;

  const scrollContainer = document.querySelector('#modalContent .flex-1');
  const prevScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;

  isAddingToCart = true;
  renderProductModal(currentProduct);
  const sc2 = document.querySelector('#modalContent .flex-1');
  if (sc2) sc2.scrollTop = prevScrollTop;

  if (!isCompleteSelection()) {
    tg?.showAlert?.('❌ Выберите все опции: SIM → Память → Цвет → Регион');
    isAddingToCart = false;
    const scA = document.querySelector('#modalContent .flex-1');
    const prevA = scA ? scA.scrollTop : 0;
    renderProductModal(currentProduct);
    const scB = document.querySelector('#modalContent .flex-1');
    if (scB) scB.scrollTop = prevA;
    return;
  }

  if (!productsData) {
    tg?.showAlert?.('Товары не загрузились, попробуйте позже');
    isAddingToCart = false;
    const scA = document.querySelector('#modalContent .flex-1');
    const prevA = scA ? scA.scrollTop : 0;
    renderProductModal(currentProduct);
    const scB = document.querySelector('#modalContent .flex-1');
    if (scB) scB.scrollTop = prevA;
    return;
  }

  const allVariants = getFilteredVariants(
    getProductVariants(currentProduct.name).filter(v => v.inStock)
  );
  const variants = allVariants;

  if (variants.length === 0) {
    tg?.showAlert?.('❌ Нет доступных вариантов');
    isAddingToCart = false;
    const scA = document.querySelector('#modalContent .flex-1');
    const prevA = scA ? scA.scrollTop : 0;
    renderProductModal(currentProduct);
    const scB = document.querySelector('#modalContent .flex-1');
    if (scB) scB.scrollTop = prevA;
    return;
  }

  const selectedVariant = variants[0];
  addToCart(selectedVariant, selectedQuantity);
  tg?.showAlert?.(
    '✅ ' +
      selectedVariant.name +
      '\n' +
      selectedVariant.storage +
      ' | ' +
      selectedVariant.color +
      ' | ' +
      selectedVariant.region +
      '\n' +
      'Количество: ' +
      selectedQuantity +
      '\nRUB ' +
      selectedVariant.price * selectedQuantity
  );
  isAddingToCart = false;
  closeModal();
};

function renderProductModal(product) {
  currentProduct = product;

  const allVariants = getProductVariants(product.name);
  const variants = allVariants.filter(v => v.inStock);

  if (variants.length === 0) {
    document.getElementById('modalContent').innerHTML =
      '<div class="flex flex-col h-full">' +
      '<div class="p-6 pb-4 border-b border-gray-200">' +
      '<div class="flex items-center justify-between mb-2">' +
      '<h2 class="text-2xl font-bold">' +
      escapeHtml(product.name) +
      '</h2>' +
      '<button onclick="closeModal()" class="p-2 hover:bg-gray-100 rounded-xl">' +
      '<svg class="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>' +
      '</svg>' +
      '</button>' +
      '</div>' +
      '<div class="text-sm text-red-500">Нет доступных вариантов</div>' +
      '</div>' +
      '</div>';
    return;
  }

  const filteredVariants = getFilteredVariants(variants);
  const availableOptions = {};

  FILTER_ORDER.forEach(type => {
    availableOptions[type] = getAvailableOptions(type, variants);
  });

  const complete = isCompleteSelection();
  const availableVariants = filteredVariants;

  const currentMinPrice = availableVariants.length
    ? Math.min.apply(null, availableVariants.map(v => v.price))
    : Math.min.apply(null, variants.map(v => v.price));

  let headerPriceText;
  let headerSuffix = '';

  if (!complete) {
    headerPriceText = 'от RUB ' + currentMinPrice;
    headerSuffix = 'за единицу';
  } else if (complete && availableVariants.length > 0) {
    const priceToShow = availableVariants[0].price;
    headerPriceText = 'RUB ' + priceToShow;
    headerSuffix = 'за единицу';
  } else {
    headerPriceText = 'Нет вариантов';
    headerSuffix = '';
  }

  let filteredImages = [];
  if (complete && availableVariants.length > 0) {
    filteredImages = getFilteredProductImages(availableVariants);
    if (filteredImages.length === 0 && variants[0].commonImage) {
      filteredImages = [variants[0].commonImage];
    }
  }

  // общая картинка только из самого товара
  const productCommonImage = product.commonImage || '';

  modalImageIndexBeforeFullscreen = modalCurrentIndex;

  document.getElementById('modalContent').innerHTML =
    '<div class="flex flex-col h-full">' +
    '<div class="p-6 pb-4 border-b border-gray-200">' +
    '<div class="flex items-center justify-between mb-2">' +
    '<h2 class="text-2xl font-bold">' +
    escapeHtml(product.name) +
    '</h2>' +
    '<button onclick="closeModal()" class="p-2 hover:bg-gray-100 rounded-xl">' +
    '<svg class="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>' +
    '</svg>' +
    '</button>' +
    '</div>' +
    '<div class="flex items-center gap-2 text-sm text-gray-500">' +
    '<span>' +
    headerPriceText +
    (headerSuffix ? ' ' + headerSuffix : '') +
    '</span>' +
    '<span>• ' +
    getVariantCountText(availableVariants.length) +
    '</span>' +
    '</div>' +
    '</div>' +

    '<div class="flex-1 overflow-y-auto">' +
    '<div class="modal-image-section">' +
    '<div class="w-full h-64 image-carousel h-64 rounded-xl overflow-hidden" id="modalCarousel">' +
    (complete && filteredImages.length > 0
      ? '<div class="image-carousel-inner" id="modalCarouselInner">' +
        filteredImages
          .slice(0, 10)
          .map(
            img =>
              '<img src="' +
              img +
              '" class="carousel-img w-full h-full object-contain" alt="Product image" loading="lazy"' +
              ' onerror="this.onerror=null; var inner=this.parentElement; if(inner){ inner.innerHTML=\'\'; inner.appendChild(getModalSvgPlaceholder()); }" />'
          )
          .join('') +
        '</div>' +
        (filteredImages.length > 1
          ? '<button class="nav-btn nav-prev" onclick="modalPrev(); event.stopPropagation()">‹</button>' +
            '<button class="nav-btn nav-next" onclick="modalNext(); event.stopPropagation()">›</button>' +
            '<div class="carousel-dots" id="modalDots">' +
            filteredImages
              .map(
                (_, idx) =>
                  '<div class="dot' +
                  (idx === modalImageIndexBeforeFullscreen ? ' active' : '') +
                  '" onclick="modalGoTo(' +
                  idx +
                  '); event.stopPropagation()"></div>'
              )
              .join('') +
            '</div>'
          : '')
      : productCommonImage
      ? '<div class="w-full h-64 rounded-xl overflow-hidden flex items-center justify-center">' +
        '<img src="' +
        productCommonImage +
        '" class="w-full h-full object-contain" alt="Product image" />' +
        '</div>'
      : '<div class="no-images h-64">' +
        '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
        '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"' +
        ' d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>' +
        '</svg>' +
        '<div class="text-center text-sm font-medium">Выберите все параметры для просмотра фото</div>' +
        '</div>') +
    '</div>' +
    (complete && filteredImages.length > 0
      ? '<div class="h-2 mb-2"></div>'
      : '<p class="px-3 pt-1 pb-2 text-xs text-gray-500 text-center">' +
        '❓ Чтобы посмотреть реальные фото товара, выберите все параметры устройства.' +
        '</p>') +
    '</div>' +

    '<div class="px-4 pt-0 pb-4 space-y-4">' +
    FILTER_ORDER.map((type, index) => {
      const isLocked = index > getCurrentSectionIndex();
      return (
        '<div class="option-section ' +
        (isLocked ? 'locked' : 'unlocked') +
        '" data-section="' +
        type +
        '">' +
        '<label class="text-sm font-semibold text-gray-700 capitalize mb-2 block">' +
        getLabel(type) +
        '</label>' +
        '<div class="flex gap-2 scroll-carousel pb-1">' +
        availableOptions[type]
          .map(option => {
            const isSelected = selectedOption[type] === option;
            return (
              '<button class="option-btn px-3 py-1.5 text-xs font-medium rounded-full border scroll-item ' +
              (isSelected
                ? 'bg-blue-500 text-white border-blue-500 shadow-md font-bold'
                : 'bg-gray-100 border-gray-300 hover:bg-gray-200') +
              ' transition-all"' +
              ' data-type="' +
              type +
              '"' +
              ' data-option="' +
              escapeHtml(option) +
              '"' +
              ' onclick="selectOptionNoFocus(\'' +
              type +
              '\', \'' +
              escapeHtml(option) +
              '\'); return false;">' +
              escapeHtml(option) +
              '</button>'
            );
          })
          .join('') +
        (selectedOption[type]
          ? '<button onclick="clearOptionNoFocus(\'' +
            type +
            '\'); return false;"' +
            ' class="px-3 py-1.5 text-xs text-red-500.font-medium rounded-full border border-red-200 hover:bg-red-50 scroll-item w-12">✕</button>'
          : '') +
        '</div>' +
        (!availableOptions[type].length
          ? '<p class="text-xs text-gray-400 mt-1">Нет вариантов</p>'
          : '') +
        '</div>'
      );
    }).join('') +

    '<div class="quantity-section">' +
    '<label class="text-sm font-semibold text-gray-700 mb-2 block">Количество</label>' +
    '<div class="flex items-center gap-3">' +
    '<button class="px-3 py-1.5 rounded-full bg-gray-200 text-lg font-bold"' +
    ' onclick="changeQuantity(-1); return false;">-</button>' +
    '<span id="quantityValue" class="min-w-[40px] text-center font-semibold">' +
    selectedQuantity +
    '</span>' +
    '<button class="px-3 py-1.5 rounded-full bg-gray-200 text-lg font-bold"' +
    ' onclick="changeQuantity(1); return false;">+</button>' +
    '</div>' +
    '<p class="text-xs text-gray-400 mt-1">Максимум 100 шт.</p>' +
    '</div>' +

    '<div class="pt-4 border-t">' +
    '<div class="text-center text-sm text-gray-500 mb-3">' +
    'Доступно: <span id="variantCount" class="font-bold text-blue-600">' +
    getVariantCountText(availableVariants.length) +
    '</span>' +
    (complete && availableVariants.length === 1
      ? '<div class="text-xs mt-1 bg-blue-50 border border-blue-200 rounded-xl p-2">' +
        '✅ Выбран: ' +
        availableVariants[0].storage +
        ' | ' +
        availableVariants[0].color +
        ' | ' +
        availableVariants[0].region +
        '</div>'
      : '') +
    '</div>' +
    '</div>' +
    '</div>' +
    '</div>' +

    '<div class="modal-footer border-t bg-white">' +
    '<button onclick="addToCartFromModal()"' +
    ' class="w-full flex items-center justify-center gap-2 ' +
    (complete && availableVariants.length > 0 && !isAddingToCart
      ? 'bg-blue-500 hover:bg-blue-600'
      : 'bg-gray-400 cursor-not-allowed') +
    ' text-white font-semibold px-4 rounded-2xl shadow-lg transition-all"' +
    (complete && availableVariants.length > 0 && !isAddingToCart ? '' : ' disabled') +
    '>' +
    (isAddingToCart
      ? '<span class="loader-circle"></span><span>Проверяю наличие...</span>'
      : complete && availableVariants.length > 0
      ? '✅ В корзину RUB ' +
        (availableVariants[0] && availableVariants[0].price
          ? availableVariants[0].price * selectedQuantity
          : '')
      : 'Выберите все опции') +
    '</button>' +
    '</div>' +
    '</div>';

  if (complete && filteredImages.length > 0) {
    modalCurrentIndex = modalImageIndexBeforeFullscreen;
    initModalCarousel(filteredImages.length);
    initModalSwipe();
  }
}

function initModalCarousel(imageCount) {
  if (imageCount <= 1) return;
  modalImageCount = imageCount;
  const inner = document.getElementById('modalCarouselInner');
  if (!inner) return;

  function updateModalCarousel() {
    inner.style.transform = 'translateX(-' + modalCurrentIndex * 100 + '%)';
    document.querySelectorAll('#modalDots .dot').forEach((dot, idx) => {
      dot.classList.toggle('active', idx === modalCurrentIndex);
    });
  }

  window.modalNext = function () {
    modalCurrentIndex = (modalCurrentIndex + 1) % modalImageCount;
    updateModalCarousel();
    tg?.HapticFeedback?.selectionChanged();
  };

  window.modalPrev = function () {
    modalCurrentIndex = modalCurrentIndex === 0 ? modalImageCount - 1 : modalCurrentIndex - 1;
    updateModalCarousel();
    tg?.HapticFeedback?.selectionChanged();
  };

  window.modalGoTo = function (i) {
    modalCurrentIndex = i;
    updateModalCarousel();
    tg?.HapticFeedback?.selectionChanged();
  };

  updateModalCarousel();
}

// свайпы по карусели
function initModalSwipe() {
  const carousel = document.getElementById('modalCarousel');
  if (!carousel) return;

  carousel.addEventListener(
    'touchstart',
    function (e) {
      const touch = e.changedTouches[0];
      modalTouchStartX = touch.clientX;
      modalTouchStartY = touch.clientY;
    },
    { passive: true }
  );

  carousel.addEventListener(
    'touchend',
    function (e) {
      const touch = e.changedTouches[0];
      const dx = touch.clientX - modalTouchStartX;
      const dy = Math.abs(touch.clientY - modalTouchStartY);

      if (Math.abs(dx) < 40 || dy > 50) return;

      if (dx < 0) {
        window.modalNext && window.modalNext();
      } else {
        window.modalPrev && window.modalPrev();
      }
    },
    { passive: true }
  );
}

function showModal(product) {
  renderProductModal(product);
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  tg?.expand();
}

window.closeModal = function () {
  modal.classList.add('hidden');
  document.body.style.overflow = '';
  selectedOption = {};
  currentProduct = null;
  selectedQuantity = 1;
  tg?.HapticFeedback?.impactOccurred('light');
};
