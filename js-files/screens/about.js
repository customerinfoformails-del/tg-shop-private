// function showAboutTab() {
//     root.innerHTML =
//       '<div class="p-6 space-y-6 pb-[65px] max-w-md mx-auto">' +
//       '<h2 class="text-2xl font-bold text-gray-800 mb-4">О нас</h2>' +
//       '<div class="space-y-4 text-gray-700">' +
//       '<p>Магазин премиальной техники Apple с гарантией качества и лучшими ценами.</p>' +
//       '<div class="grid grid-cols-2 gap-4 mt-8">' +
//       '<div class="text-center p-4 bg-blue-50 rounded-xl">' +
//       '<div class="text-2xl font-bold text-blue-600">1000+</div>' +
//       '<div class="text-sm text-gray-600">товаров</div>' +
//       '</div>' +
//       '<div class="text-center p-4 bg-green-50 rounded-xl">' +
//       '<div class="text-2xl font-bold text-green-600">24/7</div>' +
//       '<div class="text-sm text-gray-600">поддержка</div>' +
//       '</div>' +
//       '</div>' +
//       '</div>' +
//       '</div>';
//   }
  
function showAboutTab() {
  const v = window.APP_VERSIONS || {};
  const appVer = v.app || 'n/a';

  const versionsHtml = `
    <div class="mt-6 text-sm text-gray-600 space-y-1">
      <div>app: v${appVer}</div>
      <div>core: v${v.core || appVer}</div>
      <div>cart: v${v.cart || appVer}</div>
      <div>products: v${v.products || appVer}</div>
      <div>profile: v${v.profile || appVer}</div>
      <div>sale: v${v.sale || appVer}</div>
      <div>about: v${v.about || appVer}</div>
    </div>
  `;

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
        versionsHtml +
      '</div>' +
    '</div>';
}
