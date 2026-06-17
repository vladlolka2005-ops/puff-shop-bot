// ================= INIT =================

const S_URL = 'https://bsiavngtycpetiiikmxd.supabase.co';
const S_KEY = 'sb_publishable_5WlTFr_cduyplbY4BS2w2w_cevKpWmW';

const supabaseClient = supabase.createClient(S_URL, S_KEY);

let productsData = [];
let currentSort = 'promo';
let currentCategory = 'Рідина';

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
    const numericId = Number(id);
    delete cart[numericId];
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
    validateCart();
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

    grid.innerHTML = filtered.map(p => {
        const isFav = favorites.includes(Number(p.id));
        return renderProductCard(p, { isFavorite: isFav });
    }).join('');

    updateFooter();
}


// ================= CART =================

function addToCart(id) {
    const numericId = Number(id);
    const product = productsData.find(p => Number(p.id) === numericId);
    if (!product) return;

    const currentQty = cart[numericId]?.qty || 0;

    if (Number(currentQty) >= Number(product.stock)) {
        alert('Більше немає в наявності');
        return;
    }

    if (cart[numericId]) {
        cart[numericId].qty++;
    } else {
        cart[numericId] = { ...product, qty: 1 };
    }

    saveCart();
    updateFooter();

    if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
}

function changeQty(id, delta) {
    const numericId = Number(id);
    if (!cart[numericId]) return;

    const product = productsData.find(p => Number(p.id) === numericId);
    if (!product) return;

    const newQty = cart[numericId].qty + delta;

    if (newQty < 1) return;

    if (newQty > product.stock) {
        alert('Досягнуто максимальну кількість товару на складі');
        return;
    }

    cart[numericId].qty = newQty;

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
        const product = productsData.find(p => Number(p.id) === Number(id));
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
    const numericId = Number(id);

    const index = favorites.indexOf(numericId);

    if (index === -1) {
        favorites.push(numericId);
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
        .filter(p => favorites.includes(Number(p.id)))
        .map(p => productsData.find(x => Number(x.id) === Number(p.id)) || p);

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

// ================= ORDER SUBMISSION =================
function openCheckout() {
    if (!Object.keys(cart).length) return alert('Кошик порожній!');
    document.getElementById('checkout-screen').style.display = 'block';
    toggleDeliveryFields();

    // Меняем нативную кнопку под экран оформления
    if (window.Telegram?.WebApp?.MainButton) {
        const mainBtn = window.Telegram.WebApp.MainButton;
        mainBtn.setText("ПІДТВЕРДИТИ ЗАМОВЛЕННЯ");
        mainBtn.offClick(openCheckout);
        mainBtn.onClick(submitOrder);
    }

    // РАЗБЛОКИРОВКА КЛАВИАТУРЫ ДЛЯ ТГ:
    setTimeout(() => {
        const nameInput = document.getElementById('order-name');
        if (nameInput) {
            nameInput.focus();
        }
    }, 150);
}

async function submitOrder() {
    const name = document.getElementById('order-name').value.trim();
    const phone = document.getElementById('order-phone').value.trim();
    const delivery = document.getElementById('order-delivery').value;
    const payment = document.getElementById('order-payment').value;
    const city = document.getElementById('order-city').value.trim();
    const warehouse = document.getElementById('order-warehouse').value.trim();
    const comment = document.getElementById('order-comment').value.trim();

    let cleanPhone = phone.replace(/\D/g, ''); 
    if (cleanPhone.startsWith('0') && cleanPhone.length === 10) {
        cleanPhone = cleanPhone.substring(1);
    }

    if (!name || !/^\d{9}$/.test(cleanPhone)) {
        return alert('Перевірте контактні дані! Номер повинен містити 9 цифр (наприклад: 931234567)');
    }

    const items = Object.values(cart);
    if (!items.length) return alert('Кошик порожній!');

    const total = items.reduce((s, i) => s + i.price * i.qty, 0);

    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user || null;
    const telegramId = tgUser?.id || null;
    const telegramUsername = tgUser?.username ? '@' + tgUser.username : null;

    const orderItems = items.map(i => ({
        id: i.id,
        name: i.name,
        qty: i.qty,
        price: i.price,
    }));

    // Отправляем заказ в БД напрямую (оригинальные английские колонки)
    const { error: orderError } = await supabaseClient
        .from('orders')
        .insert([{
            items: orderItems,
            total: total,
            status: 'pending',
            customer_name: name,
            telegram_username: telegramUsername,
            telegram_id: telegramId,
            phone: cleanPhone,
            delivery: delivery,
            payment: payment,
            city: delivery === 'nova_poshta' ? city : null,
            warehouse: delivery === 'nova_poshta' ? warehouse : null,
            comment: comment || null,
        }]);

    if (orderError) {
        console.error('Ошибка сохранения заказа:', orderError);
        alert('Помилка збереження замовлення!');
        return;
    }

    // Если запись прошла успешно:
    if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        window.Telegram.WebApp.MainButton.hide(); // Скрываем главную кнопку
    }

    // Переключаем интерфейс на экран успешного заказа
    document.getElementById('checkout-screen').style.display = 'none';
    document.getElementById('cart-screen').style.display = 'none';
    document.getElementById('success-screen').style.display = 'block';

    // Очищаем корзину и обновляем витрину
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

    addToCart(Number(id));
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

            const localProduct = productsData.find(p => Number(p.id) == Number(item.id));
            if (localProduct) {
                localProduct.stock = newStock;
            }
        }

        const { error: updateOrderError } = await supabaseClient
            .from('orders')
            .update({ status: 'rejected' })
            .eq('id', orderId);

        if (updateOrderError) throw updateOrderError;

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
