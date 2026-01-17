// нормализация
function normalizeProducts(products) {
  return products.map(row => ({
    id: row.id,
    name: row.name,
    price: parseFloat(row.price) || 0,
    cat: row.cat,
    code: row.id,
    storage: row.memory || '',
    region: row.region || '',
    simType: row.sim || '',
    color: row.color || '',
    inStock: !!row.inStock,
    commonImage: row.commonImage || '',
    images: Array.isArray(row.images) ? row.images : []
  }));
}

// перемешивание массива (а не выбор id)
function shuffleArray(items) {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// список товаров для магазина
function getVisibleProducts() {
  if (!productsData) return [];

  // группируем по имени
  const groupedByName = {};
  productsData.forEach(p => {
    if (!groupedByName[p.name]) groupedByName[p.name] = [];
    groupedByName[p.name].push(p);
  });

  // по каждому имени берём один самый дешёвый вариант из тех, что в наличии
  let groupedVisible = Object.values(groupedByName)
    .filter(arr => arr.some(v => v.inStock))
    .map(arr => {
      const inStockVariants = arr.filter(v => v.inStock);
      return inStockVariants.reduce(
        (min, p) => (p.price < min.price ? p : min),
        inStockVariants[0]
      );
    });

  // фильтр по категории
  if (selectedCategory !== 'Все') {
    groupedVisible = groupedVisible.filter(p => p.cat === selectedCategory);
  }

  // поиск
  if (query.trim()) {
    const q = query.trim().toLowerCase();
    groupedVisible = groupedVisible.filter(p =>
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.cat && p.cat.toLowerCase().includes(q))
    );
  } else {
    // только когда нет поиска и категория "Все" — можно перемешать
    if (selectedCategory === 'Все') {
      groupedVisible = shuffleArray(groupedVisible);
    }
  }

  return groupedVisible;
}

// renderShop без randomIds
function renderShop() {
  if (!productsData || productsData.length === 0) {
    root.innerHTML = '<div class="text-center p-20 text-gray-500">Нет товаров</div>';
    return;
  }

  const list = getVisibleProducts();
  const showCount = Math.min(loadedCount, list.length);

  root.innerHTML =
    '<div class="pb-[65px]">' +
      '<div class="mb-5">' +
        '<h1 class="text-3xl font-bold text-center.mb-4">🛒 Магазин</h1>' +
        '<div class="flex items-center gap-3">' +
          '<div class="flex-1 bg-white rounded-2xl shadow px-3 py-2">' +
            '<label class="text-xs text-gray-500 block mb-1">Категория</label>' +
            '<select id="category" class="w-full bg-transparent border-none font-semibold text-base focus:outline-none appearance-none">' +
              CATEGORIES.map(c => (
                '<option value="' + c + '"' + (c === selectedCategory ? ' selected' : '') + '>' + c + '</option>'
              )).join('') +
            '</select>' +
          '</div>' +
          '<div class="w-44 bg-white rounded-2xl shadow px-3 py-2">' +
            '<label class="text-xs text-gray-500 block mb-1">Поиск</label>' +
            '<div class="flex items-center">' +
              '<svg class="w-4 h-4 text-gray-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
                '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"' +
                      ' d="M21 21l-4.35-4.35M10 18a8 8 0 100-16 8 8 0 000 16z"/>' +
              '</svg>' +
              '<input id="search" value="' + escapeHtml(query) + '" placeholder="Поиск..."' +
                     ' class="w-full bg-transparent outline-none text-sm text-gray-900" />' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="mt-3 text-xs text-gray-500">' +
          'Показано: <span class="font-semibold">' + showCount + '</span> из ' + list.length +
        '</div>' +
      '</div>' +
      '<div class="product-grid" id="productGrid">' +
        list.slice(0, showCount).map(productCard).join('') +
      '</div>' +
    '</div>';

  setupHandlers();
  preloadAllImages(list.slice(0, showCount));
  setupImageCarousels();
}

// в setupHandlers больше не трогаем randomIds
function setupHandlers() {
  const categoryEl = document.getElementById('category');
  const searchEl = document.getElementById('search');

  if (categoryEl) {
    categoryEl.onchange = function(e) {
      selectedCategory = e.target.value;
      loadedCount = 10;
      renderShop();
    };
  }

  if (searchEl) {
    searchEl.oninput = function(e) {
      query = e.target.value || '';
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(function() {
        loadedCount = 10;
        renderShop();
      }, 500);
    };
  }

  document.querySelectorAll('[data-product-name]').forEach(card => {
    card.addEventListener('click', function(e) {
      if (e.target.closest('button') || e.target.closest('.dot')) {
        return;
      }
      const productName = card.dataset.productName;
      const product = productsData.find(p => p.name === productName);
      if (product) {
        selectedOption = {};
        selectedQuantity = 1;
        showModal(product);
        tg?.HapticFeedback?.impactOccurred('medium');
      }
    });
  });
}
