// modal_v2.js

let modalCurrentIndex = 0;
let modalImageCount = 0;
let modalImageIndexBeforeFullscreen = 0;

let modalTouchStartX = 0;
let modalTouchStartY = 0;

let modalCurrentImageKey = null;

// Запоминаем: для каких URL был onerror (чтобы сразу ставить заглушку)
const brokenImageMap = new Map();

function getVariantCountText(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return count + ' вариант';
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) {
    return count + ' варианта';
  }
  return count + ' вариантов';
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

  try {
    isAddingToCart = true;
    renderProductModal(currentProduct);
    const sc2 = document.querySelector('#modalContent .flex-1');
    if (sc2) sc2.scrollTop = prevScrollTop;

    if (!isCompleteSelection()) {
      tg?.showAlert?.('❌ Выберите все опции: SIM → Память → Цвет → Регион');
      return;
    }

    if (!productsData) {
      tg?.showAlert?.('Товары не загрузились, попробуйте позже');
      return;
    }

    const variants = getFilteredVariants(
      getProductVariants(currentProduct.name).filter(v => v.inStock)
    );

    if (!variants.length) {
      tg?.showAlert?.('❌ Нет доступных вариантов');
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
    closeModal();
  } finally {
    isAddingToCart = false;
    const scA = document.querySelector('#modalContent .flex-1');
    const prevA = scA ? scA.scrollTop : 0;
    if (currentProduct) {
      renderProductModal(currentProduct);
      const scB = document.querySelector('#modalContent .flex-1');
      if (scB) scB.scrollTop = prevA;
    }
  }
};

function renderProductModal(product) {
  currentProduct = product;

  const allVariants = getProductVariants(product.name);
  const variants = allVariants.filter(v => v.inStock);
  const modalRoot = document.getElementById('modalContent');

  if (!variants.length) {
    modalRoot.innerHTML =
      '<div class="flex flex-col h-full">' +
        '<div class="p-6 pb-4 border-b border-gray-200">' +
          '<div class="flex items-center justify-between mb-2">' +
            '<h2 class="text-2xl font-bold">' + escapeHtml(product.name) + '</h2>' +
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
  const availableVariants = filteredVariants;
  const availableOptions = {};

  FILTER_ORDER.forEach(type => {
    availableOptions[type] = getAvailableOptions(type, variants);
  });

  const complete = isCompleteSelection();

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
  }

  let filteredImages = [];
  if (complete && availableVariants.length > 0) {
    filteredImages = getFilteredProductImages(availableVariants);
    if (!filteredImages.length && variants[0].commonImage) {
      filteredImages = [variants[0].commonImage];
    }
  }

  const productCommonImage = product.commonImage || '';

  if (!modalRoot.dataset.initialized) {
    modalRoot.dataset.initialized = '1';

    modalRoot.innerHTML =
      '<div class="flex flex-col h-full">' +

        '<div class="p-6 pb-4 border-b border-gray-200">' +
          '<div class="flex items-center justify-between mb-2">' +
            '<h2 class="text-2xl font-bold" id="modalTitle"></h2>' +
            '<button onclick="closeModal()" class="p-2 hover:bg-gray-100 rounded-xl">' +
              '<svg class="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
                '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>' +
              '</svg>' +
            '</button>' +
          '</div>' +
          '<div class="flex items-center gap-2 text-sm text-gray-500">' +
            '<span id="modalPrice"></span>' +
            '<span>• <span id="modalVariantCount"></span></span>' +
          '</div>' +
        '</div>' +

        '<div class="flex-1 overflow-y-auto" id="modalScrollArea">' +

          '<div class="modal-image-section">' +
            '<div class="w-full h-64 image-carousel h-64 rounded-xl overflow-hidden relative bg-white" id="modalCarousel">' +
              '<div class="image-carousel-inner w-full h-full flex items-center justify-center" id="modalCarouselInner"></div>' +
              '<button class="nav-btn nav-prev" id="modalPrevBtn" onclick="modalPrev(); event.stopPropagation()">‹</button>' +
              '<button class="nav-btn nav-next" id="modalNextBtn" onclick="modalNext(); event.stopPropagation()">›</button>' +
              '<div class="carousel-dots" id="modalDots"></div>' +
            '</div>' +
            '<div id="modalImageHint" class="px-3 pt-1 pb-2 text-xs text-gray-500 text-center"></div>' +
          '</div>' +

          '<div id="modalBodyDynamic" class="px-4 pt-0 pb-4 space-y-4"></div>' +
        '</div>' +

        '<div class="modal-footer border-t bg-white">' +
          '<button id="modalAddButton"' +
          ' class="w-full flex items-center justify-center gap-2 text-white font-semibold px-4 rounded-2xl shadow-lg transition-all" onclick="addToCartFromModal(); return false;"></button>' +
        '</div>' +

      '</div>';

    initModalSwipe();
  }

  document.getElementById('modalTitle').textContent = product.name;
  document.getElementById('modalPrice').textContent =
    headerPriceText + (headerSuffix ? ' ' + headerSuffix : '');
  document.getElementById('modalVariantCount').textContent =
    getVariantCountText(availableVariants.length);

  // === БЛОК КАРУСЕЛИ / ПЛЕЙСХОЛДЕР ===
  const carouselInner = document.getElementById('modalCarouselInner');
  const dotsRoot = document.getElementById('modalDots');
  const imageHintEl = document.getElementById('modalImageHint');
  const prevBtn = document.getElementById('modalPrevBtn');
  const nextBtn = document.getElementById('modalNextBtn');

  let imagesToShow = [];
  if (complete && filteredImages.length > 0) {
    imagesToShow = filteredImages.slice(0, 10);
  } else if (productCommonImage) {
    imagesToShow = [productCommonImage];
  }

  const nextKey = JSON.stringify({
    complete,
    images: imagesToShow,
    common: productCommonImage
  });

  if (modalCurrentImageKey !== nextKey) {
    modalCurrentImageKey = nextKey;

    carouselInner.innerHTML =
      '<div class="flex w-full h-full" id="modalSlidesWrapper"></div>';
    dotsRoot.innerHTML = '';
    modalImageCount = imagesToShow.length;

    const slidesWrapper = document.getElementById('modalSlidesWrapper');

    const svgPlaceholder =
      '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"' +
      ' class="w-12 h-12 text-gray-400">' +
        '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"' +
        ' d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>' +
      '</svg>';

    function makeSlideContent(url, mode) {
      // mode: 'photo' | 'placeholder' | 'empty'
      const hasPhoto = mode === 'photo' && url;
      const showPlaceholder = mode === 'placeholder';

      if (hasPhoto) {
        return (
          '<img src="' + url + '"' +
          ' class="carousel-img w-full h-64 object-contain modal-photo modal-photo-hidden"' +
          ' alt="Product image" loading="lazy" />'
        );
      }
      if (showPlaceholder) {
        return (
          '<div class="modal-photo modal-photo-hidden flex items-center justify-center">' +
            svgPlaceholder +
          '</div>'
        );
      }
      return '';
    }

    function makeSlide(url, mode) {
      return (
        '<div class="w-full h-64 flex-shrink-0 flex items-center justify-center relative bg-white">' +
          makeSlideContent(url, mode) +
        '</div>'
      );
    }

    // 1) старт: всегда чистый белый фон
    if (!imagesToShow.length) {
      slidesWrapper.innerHTML = makeSlide('', 'empty');
      prevBtn.style.display = 'none';
      nextBtn.style.display = 'none';

      // через animation frame рисуем placeholder
      requestAnimationFrame(() => {
        const slide = slidesWrapper.firstElementChild;
        slide.innerHTML = makeSlideContent('', 'placeholder');
        const layer = slide.querySelector('.modal-photo');
        layer.classList.remove('modal-photo-hidden');
        layer.classList.add('modal-photo-visible');
      });
    } else {
      // есть URL'ы
      slidesWrapper.innerHTML = imagesToShow
        .map(url => makeSlide(url, 'empty'))
        .join('');

      const slideEls = slidesWrapper.children;

      imagesToShow.forEach((url, idx) => {
        const slide = slideEls[idx];

        if (!url || brokenImageMap.get(url)) {
          // заранее известен как пустой/битый → сразу подложка
          slide.innerHTML = makeSlideContent('', 'placeholder');
          const ph = slide.querySelector('.modal-photo');
          ph.classList.remove('modal-photo-hidden');
          ph.classList.add('modal-photo-visible');
          return;
        }

        // ставим фото как fade-слой
        slide.innerHTML = makeSlideContent(url, 'photo');
        const img = slide.querySelector('img');

        img.addEventListener('load', () => {
          img.classList.remove('modal-photo-hidden');
          img.classList.add('modal-photo-visible');
        });

        img.addEventListener('error', () => {
          brokenImageMap.set(url, true);
          slide.innerHTML = makeSlideContent('', 'placeholder');
          const ph = slide.querySelector('.modal-photo');
          ph.classList.remove('modal-photo-hidden');
          ph.classList.add('modal-photo-visible');
        });
      });

      modalCurrentIndex = 0;

      if (imagesToShow.length > 1) {
        dotsRoot.innerHTML = imagesToShow
          .map(
            (_, idx) =>
              '<div class="dot' +
              (idx === modalCurrentIndex ? ' active' : '') +
              '" onclick="modalGoTo(' +
              idx +
              '); event.stopPropagation()"></div>'
          )
          .join('');
        prevBtn.style.display = '';
        nextBtn.style.display = '';
        initModalCarousel(imagesToShow.length);
      } else {
        dotsRoot.innerHTML = '';
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
      }
    }

    if (!complete || !filteredImages.length) {
      imageHintEl.textContent =
        '❓ Чтобы посмотреть реальные фото товара, выберите все параметры устройства.';
    } else {
      imageHintEl.textContent = '';
    }
  }

  // === ТЕЛО МОДАЛКИ (опции, количество) ===
  const body = document.getElementById('modalBodyDynamic');

  body.innerHTML =
    FILTER_ORDER.map((type, index) => {
      const isLocked = index > getCurrentSectionIndex();
      return (
        '<div class="option-section ' +
          (isLocked ? 'locked' : 'unlocked') +
          '" data-section="' + type + '">' +
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
                    ' data-type="' + type + '"' +
                    ' data-option="' + escapeHtml(option) + '"' +
                    ' onclick="selectOptionNoFocus(\'' + type + '\', \'' + escapeHtml(option) + '\'); return false;">' +
                    escapeHtml(option) +
                  '</button>'
                );
              })
              .join('') +
            (selectedOption[type]
              ? '<button onclick="clearOptionNoFocus(\'' + type + '\'); return false;"' +
                ' class="px-3 py-1.5 text-xs text-red-500 font-medium rounded-full border border-red-200 hover:bg-red-50 scroll-item w-12">✕</button>'
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
    '</div>';

  const btn = document.getElementById('modalAddButton');

  if (isAddingToCart) {
    btn.innerHTML = '<span class="loader-circle"></span><span>Проверяю наличие...</span>';
    btn.className =
      'w-full flex itemscenter justify-center gap-2 bg-gray-400 text-white font-semibold px-4 rounded-2xl shadow-lg transition-all cursor-not-allowed';
    btn.disabled = true;
  } else if (complete && availableVariants.length > 0) {
    const sum = availableVariants[0].price
      ? availableVariants[0].price * selectedQuantity
      : '';
    btn.innerHTML = '✅ В корзину RUB ' + sum;
    btn.className =
      'w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 rounded-2xl shadow-lg transition-all';
    btn.disabled = false;
  } else {
    btn.innerHTML = 'Выберите все опции';
    btn.className =
      'w-full flex items-center justify-center gap-2 bg-gray-400 text-white font-semibold px-4 rounded-2xl shadow-lg transition-all cursor-not-allowed';
    btn.disabled = true;
  }
}

// Карусель
function initModalCarousel(imageCount) {
  if (imageCount <= 1) return;
  modalImageCount = imageCount;
  const inner =
    document.getElementById('modalSlidesWrapper') ||
    document.getElementById('modalCarouselInner');
  if (!inner) return;

  function updateModalCarousel() {
    inner.style.transform = 'translateX(-' + modalCurrentIndex * 100 + '%)';
    const dots = document.querySelectorAll('#modalDots .dot');
    dots.forEach((dot, idx) => {
      dot.classList.toggle('active', idx === modalCurrentIndex);
    });
  }

  window.modalNext = function () {
    modalCurrentIndex = (modalCurrentIndex + 1) % modalImageCount;
    updateModalCarousel();
    tg?.HapticFeedback?.selectionChanged();
  };

  window.modalPrev = function () {
    modalCurrentIndex =
      modalCurrentIndex === 0 ? modalImageCount - 1 : modalCurrentIndex - 1;
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
