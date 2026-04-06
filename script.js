// ================= INIT =================

const S_URL = 'https://bsiavngtycpetiiikmxd.supabase.co';
const S_KEY = 'sb_publishable_5WlTFr_cduyplbY4BS2w2w_cevKpWmW';

const supabaseClient = supabase.createClient(S_URL, S_KEY);

let activeDiscount = 0;
let activePromoCode = null;

let productsData = [];
let currentSort = 'promo';
let cart = {};
let currentCategory = 'Рідина';
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

    productsData = data || [];
    console.log("Загруженные товары:", productsData);
    validateCart();
    render();
}


// ================= RENDER PRODUCTS =================

function render() {
    const grid = document.getElementById('products-grid');
    if (!grid) return;

    let filtered = productsData.filter(p => {
        if (currentCategory === 'all') return true;

        return p.category?.toLowerCase() === currentCategory.toLowerCase();
    });

    filtered.sort((a, b) => {
        if (b.stock !== a.stock) {
            return b.stock - a.stock;
        }

        if (currentSort === 'promo') {
            return (b.old_price ? 1 : 0) - (a.old_price ? 1 : 0);
        }
        if (currentSort === 'price-asc') return a.price - b.price;
        if (currentSort === 'price-desc') return b.price - a.price;

        return 0;
    });

    console.log("Категория:", currentCategory);
    console.log("Товары:", productsData);
    console.log("После фильтра:", filtered);

    grid.innerHTML = filtered.map(p => {
        const isFav = favorites.includes(p.id);
        return renderProductCard(p, { isFavorite: isFav });
    }).join('');

    updateFooter();
}


// ================= CART =================

function addToCart(id) {
    const product = productsData.find(p => p.id === id);
    if (!product) return;

    const currentQty = cart[id]?.qty || 0;

    if (currentQty >= product.stock) {
        alert('Більше немає в наявності');
        return;
    }

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

    const product = productsData.find(p => p.id == id);
    if (!product) return;

    const newQty = cart[id].qty + delta;

    if (newQty < 1) return;

    if (newQty > product.stock) {
        alert('Досягнуто максимальну кількість товару на складі');
        return;
    }

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

    const mainBtn = document.getElementById('cart-footer');
    if (mainBtn) mainBtn.innerText = text;

    const favBtn = document.getElementById('fav-cart-footer');
    if (favBtn) favBtn.innerText = text;
}

function validateCart() {
    for (let id in cart) {
        const product = productsData.find(p => p.id == id);
        if (!product) continue;

        if (cart[id].qty > product.stock) {
            cart[id].qty = product.stock;
        }

        if (product.stock <= 0) {
            delete cart[id];
        }
    }

    saveCart();
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
    id = Number(id);

    const index = favorites.indexOf(id);

    if (index === -1) {
        favorites.push(id);
    } else {
        favorites.splice(index, 1);
    }

    localStorage.setItem('puff_favs', JSON.stringify(favorites));

    render();

    if (document.getElementById('favorites-screen')?.style.display === 'block') {
        openFavorites();
    }
}

function openFavorites() {
    document.getElementById('favorites-screen').style.display = 'block';

    const favProducts = productsData
        .filter(p => favorites.includes(p.id))
        .map(p => productsData.find(x => x.id === p.id) || p);

    const grid = document.getElementById('favorites-grid');
    const cartContainer = document.getElementById('fav-cart-container');

    if (!favProducts.length) {
        grid.innerHTML = '<p style="grid-column:1/3; text-align:center; color:#888;">Тут поки порожньо</p>';
        if (cartContainer) cartContainer.style.display = 'none';
        return;
    }

    if (cartContainer) cartContainer.style.display = 'block';

    grid.innerHTML = favProducts.map(p =>
        renderProductCard(p, { isFavorite: true })
    ).join('');
}


// ================= UI =================
async function applyPromo() {
    const codeInput = document.getElementById('promo-input').value.trim();
    const msg = document.getElementById('promo-message');
    
    if (!codeInput) return;

    // Ищем код в твоей таблице promocodes
    const { data, error } = await supabaseClient
        .from('promocodes')
        .select('*')
        .eq('code', codeInput)
        .eq('is_used', false)
        .single();

    if (error || !data) {
        msg.style.color = '#ff5252';
        msg.innerText = '❌ Код недійсний або використаний';
        activeDiscount = 0;
        activePromoCode = null;
  } else {
    msg.style.color = '#31b545';
    
    // Считаем сумму скидки в процентах от общей суммы (замени totalAmount на свою переменную суммы)
    const total = parseFloat(document.getElementById('total-price').innerText); 
    const discountValue = (total * data.discount_amount) / 100;

    msg.innerText = `✅ Знижка ${data.discount_amount}% активована! (-${discountValue.toFixed(0)} ₴)`;
    
    // Сохраняем вычисленную сумму скидки, чтобы она отнялась при финальном расчете
    activeDiscount = discountValue;
    activePromoCode = data.code;
}
}
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
    if (Object.keys(cart).length === 0) return;

    document.getElementById('cart-screen').style.display = 'block';
    renderCart();
}

function openProfile() {
    document.getElementById('profile-screen').style.display = 'block';
}

function openHistory() {
    document.getElementById('history-screen').style.display = 'block';
    loadHistory();
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

    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user || null;
    const telegramId = tgUser?.id || null;
    const telegramUsername = tgUser?.username ? '@' + tgUser.username : null;

    const phone = document.getElementById('order-phone').value.trim();
    const delivery = document.getElementById('order-delivery').value;
    const payment = document.getElementById('order-payment').value;
    const city = document.getElementById('order-city').value.trim();
    const warehouse = document.getElementById('order-warehouse').value.trim();
    const comment = document.getElementById('order-comment').value.trim();

    if (!name || !/^\d{9}$/.test(phone)) {
        return alert('Перевірте контактні дані!');
    }

    const items = Object.values(cart);

    if (!items.length) {
        return alert('Кошик порожній!');
    }

    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
const total = subtotal - activeDiscount > 0 ? subtotal - activeDiscount : 0;

    const rpcItems = items.map(i => ({
        product_id: i.id,
        quantity: i.qty,
    }));

    // ================= RPC =================

    const { error: rpcError } = await supabaseClient.rpc('create_order', {
        p_items: rpcItems,
    });

    if (rpcError) {
        console.error('RPC error:', rpcError.message);
        alert('Помилка оформлення замовлення: ' + rpcError.message);
        return;
    }

    // ================= SAVE ORDER =================

    const orderItems = items.map(i => ({
        id: i.id,
        name: i.name,
        qty: i.qty,
        price: i.price,
    }));

    const { data: orderData, error: orderError } = await supabaseClient
        .from('orders')
        .insert([{
            items: orderItems,
            total: total,
            status: 'pending',

            customer_name: name,
            telegram: telegramUsername,
            telegram_id: telegramId,
            phone: phone,

            delivery: delivery,
            payment: payment,

            city: delivery === 'nova_poshta' ? city : null,
            warehouse: delivery === 'nova_poshta' ? warehouse : null,

            comment: comment || null,
        }])
        .select();

    if (orderError) {
        console.error('Ошибка сохранения заказа:', orderError);
        alert('Помилка збереження замовлення!');
        return;
    }
      if (activePromoCode) {
      await supabaseClient
        .from('promocodes')
        .update({ is_used: true })
        .eq('code', activePromoCode);
    }
    if (!orderData || orderData.length === 0) {
        alert('Помилка отримання даних замовлення!');
        return;
    }

    const orderNumber = orderData[0].order_number;
    const prettyId = String(orderNumber).padStart(6, '0');

    // ================= TELEGRAM =================

    const botToken = '8604574755:AAEonaFfivCYbsLWXY7pEpKsg2l3QyJGEVg';
    const adminId = '6405107523';

    const deliveryText = delivery === 'nova_poshta'
        ? `🚚 Нова Пошта (${city}, відд. №${warehouse})`
        : '🏃 Самовивіз';

    const paymentText = payment === 'cash'
        ? '💵 Готівка / На карту'
        : '💳 Оплата на сайті';

    const itemsList = items.map(i => `- ${i.name} (x${i.qty})`).join('\n');

    const adminText = `📦 НОВЕ ЗАМОВЛЕННЯ №${prettyId}!

👤 Клієнт: ${name}
📞 Тел: +380${phone}
✈️ TG: ${telegramUsername || '—'}

📍 Доставка: ${deliveryText}
💰 Оплата: ${paymentText}

📝 Коментар: ${comment || '—'}

🛒 Товари:
${itemsList}

💰 Сума: ${total} ₴`;

    const clientText = `📦 Дякуємо за замовлення №${prettyId}, ${name}!

🚚 НОВА ПОШТА: передплата 50 грн.

💳 ПОВНА ОПЛАТА: номер картки 4874070059344406

📩 Після оплати очікуємо на вашу квитанцію.

🚀 САМОВИВІЗ: напишіть менеджеру день і зручний час.

📩 Зв'язок з менеджером: @nnpuff`;

    try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: adminId,
                text: adminText,
            }),
        });

        if (telegramId) {
            const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: telegramId,
                    text: clientText,
                }),
            });

            const data = await res.json();
            if (!data.ok) {
                console.error('Client Telegram error:', data);
            }
        } else {
            console.warn('Нет telegram_id — сообщение клиенту не отправлено');
        }

        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }

    } catch (e) {
        console.error('Telegram error:', e);
    }

    // ================= UI =================

    document.getElementById('checkout-screen').style.display = 'none';
    document.getElementById('cart-screen').style.display = 'none';
    document.getElementById('success-screen').style.display = 'block';

    // уменьшаем stock после покупки
items.forEach(item => {
    const product = productsData.find(p => p.id == item.id);
    if (product) {
        product.stock -= item.qty;
        if (product.stock < 0) product.stock = 0;
    }
});

cart = {};
saveCart();
updateFooter();
render();
}


// ================= START =================

loadCart();
load();

if (window.Telegram?.WebApp) {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
}


// ================= IMAGE MODAL =================

function openImageModal(src) {
    const modal = document.getElementById('image-modal');
    const img = document.getElementById('modal-image');

    img.src = src;
    modal.style.display = 'block';
}


// ================= FLY TO CART =================

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

    if (isFavorites) {
        flyToCart(img, 'fav-cart-footer');
    } else {
        flyToCart(img, 'cart-footer');
    }

    addToCart(id);
}


// ================= RENDER HELPERS =================

function renderProductCard(p, { isFavorite = false } = {}) {
    return `
        <div class="card">
            <button class="fav-btn ${isFavorite ? 'active' : ''}"
                onclick="toggleFav(${p.id})">
                ${isFavorite ? '❤️' : '🤍'}
            </button>

            <div class="img-wrap">
                <img src="${p.image_url}"
                     onclick="openImageModal('${p.image_url}')"
                     style="cursor:pointer;">
            </div>

            <div class="info">
                ${renderStock(p.stock)}

                <div class="price">${p.price} ₴</div>
                <div class="name">${p.name}</div>

                <button class="buy-btn"
                    onclick="handleBuy(this, ${p.id})"
                    ${p.stock <= 0 ? 'disabled style="opacity:0.5"' : ''}>
                    ${p.stock > 0 ? 'Купити' : 'Немає'}
                </button>
            </div>
        </div>
    `;
}

function renderStock(stock) {
    return `
        <div class="stock ${stock > 0 ? 'in' : 'out'}">
            ${stock > 0
                ? `В наявності: ${stock} шт.`
                : 'Немає в наявності'}
        </div>
    `;
}


// ================= HISTORY =================

async function loadHistory() {
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const telegramId = tgUser?.id;

    if (!telegramId) {
        document.getElementById('history-screen').innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <button class="back-btn" onclick="closeModal('history-screen')">‹</button>
                    Історія
                </div>
                <p style="text-align:center; color:#888;">Не вдалося отримати користувача Telegram</p>
            </div>
        `;
        return;
    }

    const { data, error } = await supabaseClient
        .from('orders')
        .select('*')
        .eq('telegram_id', telegramId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    renderHistory(data || []);
}

function renderHistory(orders) {
    const container = document.getElementById('history-screen');

    const statusLabelMap = {
        pending: 'В процесi',
        confirmed: 'Підтверджено',
        completed: 'Виконано',
        rejected: 'Вiдхилено',
    };

    const statusClassMap = {
        pending: 'status-pending',
        confirmed: 'status-confirmed',
        completed: 'status-completed',
        rejected: 'status-rejected',
    };

    if (!orders.length) {
        container.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <button class="back-btn" onclick="closeModal('history-screen')">‹</button>
                    Історія
                </div>
                <p style="text-align:center; color:#888;">Замовлень ще немає</p>
            </div>
        `;
        return;
    }

    let html = `
        <div class="modal-content">
            <div class="modal-header">
                <button class="back-btn" onclick="closeModal('history-screen')">‹</button>
                Історія
            </div>
    `;

    orders.forEach(order => {
        const itemsHtml = order.items.map(i => `
            <div style="font-size:13px; color:#b2bcc4;">
                • ${i.name} x${i.qty}
            </div>
        `).join('');

        const prettyId = String(order.order_number).padStart(6, '0');

        const statusKey = order.status;
        const statusLabel = statusLabelMap[statusKey] || statusKey;
        const statusClass = statusClassMap[statusKey] || '';

        html += `
            <div style="background: var(--tg-card); padding: 12px; border-radius: 12px; margin-bottom: 10px;">

                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <b>№${prettyId}</b>
                    <span style="color:#31b545;">${order.total} ₴</span>
                </div>

                <div style="font-size:12px; color:#888; margin-bottom:5px;">
                    ${new Date(order.created_at).toLocaleString()}
                </div>

                <div style="margin-bottom:6px; font-size:13px;">
                    Статус:
                    <span class="status-badge ${statusClass}">
                        ${statusLabel}
                    </span>
                </div>

                <div>
                    ${itemsHtml}
                </div>

                ${order.status === 'pending' ? `
                    <div style="margin-top:10px; text-align:right;">
                        <button class="cancel-btn" onclick="confirmCancelOrder('${order.id}')">
                            Скасувати замовлення
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    });

    html += `</div>`;

    container.innerHTML = html;
}

function getStatusLabel(status) {
    switch (status) {
        case 'pending':   return 'В процесi';
        case 'confirmed': return 'Підтверджено';
        case 'completed': return 'Виконано';
        case 'rejected':  return 'Вiдхилено';
        default:          return status;
    }
}


// ================= CANCEL ORDER =================

async function cancelOrder(orderId) {
    try {
        const { data: order, error } = await supabaseClient
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();

        if (error) throw error;

        if (order.status !== 'pending') {
            alert('Замовлення вже не можна скасувати');
            return;
        }

        for (const item of order.items) {
            const { data: product, error: getError } = await supabaseClient
                .from('Products')
                .select('stock')
                .eq('id', item.id)
                .single();

            if (getError) throw getError;

            const newStock = product.stock + item.qty;

            const { error: updateError } = await supabaseClient
                .from('Products')
                .update({ stock: newStock })
                .eq('id', item.id);

            if (updateError) throw updateError;

            const localProduct = productsData.find(p => p.id == item.id);
            if (localProduct) {
                localProduct.stock = newStock;
            }
        }

        const { error: updateOrderError } = await supabaseClient
            .from('orders')
            .update({ status: 'rejected' })
            .eq('id', orderId);

        if (updateOrderError) throw updateOrderError;

        // ================= TELEGRAM =================

        const botToken = '8604574755:AAEonaFfivCYbsLWXY7pEpKsg2l3QyJGEVg';
        const adminId = '6405107523';

        const orderNumber = order.order_number;
        const prettyId = String(orderNumber).padStart(6, '0');

        const itemsList = order.items
            .map(i => `- ${i.name} (x${i.qty})`)
            .join('\n');

        const adminCancelText = `❌ ЗАМОВЛЕННЯ СКАСОВАНО №${prettyId}

		👤 Клієнт: ${order.customer_name}
		📞 Тел: +380${order.phone}
		✈️ TG: ${order.telegram || '—'}

		🛒 Товари:
		${itemsList}

		💰 Сума: ${order.total} ₴`;

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: adminId,
                text: adminCancelText,
            }),
        });

        if (order.telegram_id) {
            const userCancelText = `❌ Ваше замовлення №${prettyId} було скасовано.\nЯкщо це помилка або у вас є питання — зв'яжіться з менеджером: @nnpuff`;

            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: order.telegram_id,
                    text: userCancelText,
                }),
            });
        }

        validateCart();
        render();
        updateFooter();
        loadHistory();

    } catch (err) {
        console.error(err);
        alert('Помилка при скасуванні');
    }
}

function confirmCancelOrder(orderId) {
    const confirmed = confirm('Ви дійсно хочете скасувати це замовлення?');
    if (!confirmed) return;
    cancelOrder(orderId);
}
