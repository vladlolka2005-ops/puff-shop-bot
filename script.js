// ================= INIT =================

const S_URL = 'https://bsiavngtycpetiiikmxd.supabase.co';
const S_KEY = 'sb_publishable_5WlTFr_cduyplbY4BS2w2w_cevKpWmW';

const supabaseClient = supabase.createClient(S_URL, S_KEY);

let productsData = [];
let currentSort = 'promo';
let currentCategory = 'Рідина';

// Корзина и избранное
let cart = {};
let favorites = JSON.parse(localStorage.getItem('puff_favs')) || [];


// ================= CART STORAGE =================

function closeImageModal() {
    document.getElementById('image-modal').style.display = 'none';
}

function saveCart() {
    localStorage.setItem('puff_cart', JSON.stringify(cart));
}

function loadCart() {
    const saved = localStorage.getItem('puff_cart');
    if (saved) {
        cart = JSON.parse(saved);
    }
}

function removeFromCart(id) {
    delete cart[id];
    saveCart();
    updateFooter();
    renderCart();
}


// ================= LOAD =================

async function load() {
    const { data, error } = await supabaseClient.from('Products').select('*');

    if (error) {
        console.error('Ошибка загрузки:', error);
        return;
    }

    productsData = data;
    render();
}


// ================= RENDER PRODUCTS =================

function render() {
    const grid = document.getElementById('products-grid');
    if (!grid) return;

    let filtered = productsData.filter(p =>
        currentCategory === 'Рідина' || p.category === currentCategory
    );

    filtered.sort((a, b) => {
        if (currentSort === 'promo') {
            return (b.old_price ? 1 : 0) - (a.old_price ? 1 : 0);
        }
        if (currentSort === 'price-asc') return a.price - b.price;
        if (currentSort === 'price-desc') return b.price - a.price;
        return 0;
    });

    grid.innerHTML = filtered.map(p => {
        const isFav = favorites.includes(p.id);

        return `
            <div class="card">
                <button class="fav-btn ${isFav ? 'active' : ''}" onclick="toggleFav(${p.id})">
                    ${isFav ? '❤️' : '🤍'}
                </button>

				<div class="img-wrap">
					<img src="${p.image_url}" alt="" onclick="openImageModal('${p.image_url}')" style="cursor:pointer;">
				</div>

                <div class="info">
                    <span class="price">${p.price} ₴</span>
                    <div class="name">${p.name}</div>
                    <button class="buy-btn" onclick="handleBuy(this, ${p.id})">Купити</button>
                </div>
            </div>
        `;
    }).join('');

    updateFooter();
}


// ================= CART =================

function addToCart(id) {
    const product = productsData.find(p => p.id === id);
    if (!product) return;

    if (cart[id]) {
        cart[id].qty++;
    } else {
        cart[id] = { ...product, qty: 1 };
    }

    saveCart();
    updateFooter();

    if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
}

function changeQty(id, delta) {
    if (!cart[id]) return;

    const newQty = cart[id].qty + delta;

    if (newQty < 1) return;

    cart[id].qty = newQty;

    saveCart();
    updateFooter();
    renderCart();
}

function updateFooter() {
    let totalItems = 0;
    let totalPrice = 0;

    for (let id in cart) {
        totalItems += cart[id].qty;
        totalPrice += cart[id].price * cart[id].qty;
    }

    const text = totalItems > 0
        ? `Кошик (${totalItems}) — ${totalPrice} ₴`
        : 'Кошик порожній';

    // Главная кнопка
    const mainBtn = document.getElementById('cart-footer');
    if (mainBtn) mainBtn.innerText = text;

    // Кнопка в избранном
    const favBtn = document.getElementById('fav-cart-footer');
    if (favBtn) favBtn.innerText = text;
}

function renderCart() {
    const list = document.getElementById('cart-list');

    let html = '';
    let total = 0;

    for (let id in cart) {
        const item = cart[id];
        total += item.price * item.qty;

        html += `
            <div class="cart-item" style="justify-content: space-between;">
                <div style="display:flex; gap:10px; align-items:center;">
                    <img src="${item.image_url}">
                    <div>
                        <div>${item.name}</div>
						<div style="font-weight:bold;">${item.price * item.qty} ₴</div>
                    </div>
                </div>

                <div style="display:flex; gap:10px; align-items:center;">
                    <div class="qty-ctrl">
                        <button class="qty-btn" onclick="changeQty(${item.id}, -1)">-</button>
                        <span>${item.qty}</span>
                        <button class="qty-btn" onclick="changeQty(${item.id}, 1)">+</button>
                    </div>

                    <span onclick="removeFromCart(${item.id})" style="cursor:pointer;">🗑️</span>
                </div>
            </div>
        `;
    }

    list.innerHTML = html || '<p style="text-align:center; color:#888;">Кошик порожній</p>';
    document.getElementById('cart-total').innerText = `Разом: ${total} ₴`;
}


// ================= FAVORITES =================

function toggleFav(id) {
    const index = favorites.indexOf(id);

    if (index === -1) {
        favorites.push(id);
    } else {
        favorites.splice(index, 1);
    }

    localStorage.setItem('puff_favs', JSON.stringify(favorites));
    render();
}

function openFavorites() {
    document.getElementById('favorites-screen').style.display = 'block';

    const grid = document.getElementById('favorites-grid');
    const favProducts = productsData.filter(p => favorites.includes(p.id));

    const cartContainer = document.getElementById('fav-cart-container');

    if (!favProducts.length) {
        grid.innerHTML = '<p style="grid-column:1/3; text-align:center; color:#888;">Тут поки порожньо</p>';

        // Скрываем кнопку корзины
        if (cartContainer) cartContainer.style.display = 'none';

        return;
    }

    // Показываем кнопку корзины
    if (cartContainer) cartContainer.style.display = 'block';

    grid.innerHTML = favProducts.map(p => `
        <div class="card">
            <button class="fav-btn active" onclick="toggleFav(${p.id}); openFavorites(); render();">❤️</button>
            <div class="img-wrap">
                <img src="${p.image_url}" onclick="openImageModal('${p.image_url}')" style="cursor:pointer;">
            </div>
            <div class="info">
                <span class="price">${p.price} ₴</span>
                <div class="name">${p.name}</div>
                <button class="buy-btn" onclick="handleBuy(this, ${p.id})">Купити</button>
            </div>
        </div>
    `).join('');
}


// ================= UI =================

function filterCat(cat, el) {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');

    currentCategory = cat;
    render();
}

function sortProducts() {
    const select = document.getElementById('sort-select');
    if (!select) return;

    currentSort = select.value;
    render();
}

function toggleDeliveryFields() {
    const method = document.getElementById('order-delivery').value;

    document.getElementById('np-fields').style.display =
        method === 'nova_poshta' ? 'block' : 'none';

    document.getElementById('pickup-info').style.display =
        method === 'self_pickup' ? 'block' : 'none';
}


// ================= MODALS =================

function openCart() {
    if (Object.keys(cart).length === 0) {
        alert('Кошик порожній!');
        return;
    }

    document.getElementById('cart-screen').style.display = 'block';
    renderCart();
}

function openProfile() {
    document.getElementById('profile-screen').style.display = 'block';
}

function openHistory() {
    document.getElementById('history-screen').style.display = 'block';
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}


// ================= CHECKOUT =================

function openCheckout() {
    if (!Object.keys(cart).length) return alert('Кошик порожній!');
    document.getElementById('checkout-screen').style.display = 'block';
    toggleDeliveryFields();
}

async function submitOrder() {
    const name = document.getElementById('order-name').value.trim();
    const tg = document.getElementById('order-tg').value.trim();
    const phone = document.getElementById('order-phone').value.trim();
    
    // Додаємо збір даних про доставку та оплату
    const delivery = document.getElementById('order-delivery').value;
    const payment = document.getElementById('order-payment').value;
    const city = document.getElementById('order-city').value.trim();
    const warehouse = document.getElementById('order-warehouse').value.trim();

    if (!name || !tg || !/^\d{9}$/.test(phone)) {
        return alert('Перевірте контактні дані!');
    }

    if (delivery === 'nova_poshta' && (!city || !warehouse)) {
        return alert('Вкажіть місто та відділення Нової Пошти!');
    }

    const items = Object.values(cart);
    const total = items.reduce((s, i) => s + i.price * i.qty, 0);

    const botToken = '8604574755:AAEonaFfivCYbsLWXY7pEpKsg2l3QyJGEVg'; 
    const adminId = '6405107523'; 

    // Формуємо красивий текст для способу доставки та оплати
    const deliveryText = delivery === 'nova_poshta' ? `🚚 Нова Пошта (${city}, відд. №${warehouse})` : '🏃 Самовивіз';
    const paymentText = payment === 'cash' ? '💵 Готівка / На карту' : '💳 Оплата на сайті ';

    const itemsList = items.map(i => `- ${i.name} (x${i.qty})`).join('\n');
    
    // Оновлений текст повідомлення
    const text = `📦 НОВЕ ЗАМОВЛЕННЯ!\n\n` +
                 `👤 Клієнт: ${name}\n` +
                 `📞 Тел: +380${phone}\n` +
                 `✈️ TG: ${tg}\n\n` +
                 `📍 Доставка: ${deliveryText}\n` +
                 `💰 Оплата: ${paymentText}\n\n` +
                 `🛒 Товари:\n${itemsList}\n\n` +
                 `💰 Сума: ${total} ₴`;

    try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: adminId, text: text })
        });
        
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
    } catch (e) {
        console.error("Помилка відправки:", e);
    }

    document.getElementById('checkout-screen').style.display = 'none';
    document.getElementById('cart-screen').style.display = 'none';
    document.getElementById('success-screen').style.display = 'block';

    cart = {};
    saveCart();
    updateFooter();
}

// ================= START =================

loadCart();
load();

if (window.Telegram?.WebApp) {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
}

function openImageModal(src) {
    const modal = document.getElementById('image-modal');
    const img = document.getElementById('modal-image');

    img.src = src;
    modal.style.display = 'block';
}

function flyToCart(imgElement, targetBtnId = 'cart-footer') {
    const cartBtn = document.getElementById(targetBtnId);

    const imgRect = imgElement.getBoundingClientRect();
    const cartRect = cartBtn.getBoundingClientRect();

    const flyingImg = imgElement.cloneNode(true);

    flyingImg.classList.add('fly-image');
    document.body.appendChild(flyingImg);

    flyingImg.style.left = imgRect.left + 'px';
    flyingImg.style.top = imgRect.top + 'px';
    flyingImg.style.width = imgRect.width + 'px';
    flyingImg.style.height = imgRect.height + 'px';

    setTimeout(() => {
        flyingImg.style.left = cartRect.left + cartRect.width / 2 + 'px';
        flyingImg.style.top = cartRect.top + cartRect.height / 2 + 'px';
        flyingImg.style.transform = 'scale(0.2)';
        flyingImg.style.opacity = '0.5';
    }, 10);

    setTimeout(() => {
        flyingImg.remove();
    }, 800);
}

function handleBuy(btn, id) {
    const card = btn.closest('.card');
    const img = card.querySelector('img');

    const isFavorites = document.getElementById('favorites-screen')?.style.display === 'block';

    // если в избранном → летим в fav-кнопку
    if (isFavorites) {
        flyToCart(img, 'fav-cart-footer');
    } else {
        flyToCart(img, 'cart-footer');
    }

    addToCart(id);
}
