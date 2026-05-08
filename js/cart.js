// Cart drawer template fallback if html/cart.html cannot be loaded
const cartHtmlTemplate = `
<div id="checkoutModal" class="modal">
    <div class="modal-content" style="width:420px; max-width:95%; background:rgb(255, 240, 165); padding:40px 20px; align-items:flex-start; overflow:auto;">
        <h3 style="text-align:center; width:100%; margin-bottom:20px;">Checkout</h3>
        <div id="checkout-items" style="max-height:300px; overflow:auto; text-align:left; margin-bottom:12px; width:100%;"></div>
        <p style="width:100%;">Items: <span id="checkout-count">0</span></p>
        <p style="width:100%;">Total: ₱<span id="checkout-total">0</span></p>

        <label for="payment-method" style="display:block; width:100%; margin:12px 0 6px;">Payment method:</label>
        <select id="payment-method" style="width:100%; padding:10px; margin-bottom:8px; border-radius:8px; border:1px solid #ddd;">
            <option value="gcash">Gcash</option>
            <option value="cod">Cash on Delivery</option>
        </select>

        <button onclick="completeCheckout()" style="margin-bottom:8px; width:100%; padding:10px; background:rgb(135,109,53); color:#fff; border:none; border-radius:8px; cursor:pointer;">Pay / Complete Order</button>
        <button onclick="closeCheckout()" style="background:#999; width:100%; padding:10px; color:#fff; border:none; border-radius:8px; cursor:pointer;">Close</button>
    </div>
</div>

<div id="cartOverlay" class="cart-overlay" onclick="toggleCartDrawer()"></div>
<aside id="cartDrawer" class="cart-drawer" aria-hidden="true">
    <div class="cart-drawer-header">
        <h3>Your Cart <span id="cart-count-header">(0)</span></h3>
        <button class="cart-drawer-close" onclick="toggleCartDrawer()">×</button>
    </div>
    <div class="cart-drawer-content">
        <div id="cart-items"></div>
    </div>
    <div class="cart-drawer-footer" id="cart-footer"></div>
</aside>
`;

function loadCartHtml() {
    const container = document.getElementById('cartContainer');
    if (!container) return;

    fetch('html/cart.html')
        .then(response => {
            if (!response.ok) throw new Error('Unable to load cart.html');
            return response.text();
        })
        .then(html => {
            container.innerHTML = html;
            cartHtmlLoaded = true;
            updateCart();
            if (cartShouldOpenAfterLoad) {
                const drawer = document.getElementById('cartDrawer');
                const overlay = document.getElementById('cartOverlay');
                if (drawer && overlay) {
                    renderCartDrawer();
                    drawer.classList.add('open');
                    overlay.classList.add('open');
                }
                cartShouldOpenAfterLoad = false;
            }
        })
        .catch(error => {
            console.warn('Failed to load cart.html:', error);
            container.innerHTML = cartHtmlTemplate;
            cartHtmlLoaded = true;
            updateCart();
            if (cartShouldOpenAfterLoad) {
                const drawer = document.getElementById('cartDrawer');
                const overlay = document.getElementById('cartOverlay');
                if (drawer && overlay) {
                    renderCartDrawer();
                    drawer.classList.add('open');
                    overlay.classList.add('open');
                }
                cartShouldOpenAfterLoad = false;
            }
        });
}

// Track whether the cart HTML has been injected and whether it should open after loading
let cartHtmlLoaded = false;
let cartShouldOpenAfterLoad = false;

// Load cart HTML when DOM is ready
document.addEventListener('DOMContentLoaded', loadCartHtml);

// CART
function generateId(){ return 'ci_' + Math.random().toString(36).slice(2,9); }

function saveCartToServer(username, cart) {
    if (!username || !Array.isArray(cart)) return;

    fetch('/api/save-cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, cart })
    })
    .then(res => res.json())
    .then(data => {
        if (!data.success) {
            console.warn('Cart save failed:', data.message);
        }
    })
    .catch(error => {
        console.warn('Unable to save cart to server:', error);
    });
}

function addToCart(name, price, image){
    if(!isLoggedIn){
        showNotification('Please login before adding items to cart.');
        openModal();
        return;
    }

    const existing = window.cart.find(c=>c.name===name && c.price===price && c.image===image);
    if(existing){ existing.qty = (existing.qty||1) + 1; }
    else { window.cart.push({id: generateId(), name, price, image, qty: 1}); }

    saveCart(currentUser, window.cart);
    saveCartToServer(currentUser, window.cart);
    updateCart();

    const drawer = document.getElementById('cartDrawer');
    if (drawer && drawer.classList.contains('open')) {
        renderCartDrawer();
    } else if (!cartHtmlLoaded) {
        loadCartHtml();
    }

    showNotification(`${name} added to cart!`);
}

function updateCart(){
    const totalUnits = window.cart.reduce((s,i)=>s + (i.qty||1), 0);
    const totalPrice = window.cart.reduce((s,i)=>s + ((i.qty||1) * i.price), 0);

    const headerCount = document.getElementById("header-cart-count");
    const cartCountEl = document.getElementById("cart-count");
    const totalEl = document.getElementById("total");
    const selectedCountEl = document.getElementById("selected-count");
    const selectedTotalEl = document.getElementById("selected-total");

    if(headerCount) headerCount.innerText = totalUnits;
    if(cartCountEl) cartCountEl.innerText = totalUnits;
    if(totalEl) totalEl.innerText = totalPrice;
    if(selectedCountEl) selectedCountEl.innerText = totalUnits;
    if(selectedTotalEl) selectedTotalEl.innerText = totalPrice;

    if(currentUser){
        saveCart(currentUser, window.cart);
        saveCartToServer(currentUser, window.cart);
    }
}

// CHECKOUT
function showCheckout(){
    const checkoutModal = document.getElementById("checkoutModal");
    // render cart items into modal
    const list = document.getElementById('checkout-items');
    list.innerHTML = '';
    if(window.cart.length === 0){
        list.innerHTML = '<p>Your cart is empty.</p>';
    } else {
        window.cart.forEach((item, idx)=>{
            list.innerHTML += `
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                    <img src="images/${item.image}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;">
                    <div style="flex:1;text-align:left;">
                        <div style="font-weight:600;">${item.name}</div>
                        <div style="color:#666;">₱${item.price}</div>
                    </div>
                    <div>
                        <button onclick="removeCartItem(${idx})" style="background:#c44;color:#fff;border:none;padding:6px;border-radius:6px;cursor:pointer;">Remove</button>
                    </div>
                </div>`;
        });
    }
    document.getElementById("checkout-count").innerText = window.cart.length;
    document.getElementById("checkout-total").innerText = window.cart.reduce((sum,i)=>sum+i.price,0);
    checkoutModal.style.display = "flex";
}
function closeCheckout(){ document.getElementById("checkoutModal").style.display="none"; }
function completeCheckout(){
    const method=document.getElementById("payment-method").value;
    const total = window.cart.reduce((sum,i)=>sum+i.price,0);
    if(window.cart.length === 0){ alert('Cart is empty'); return; }
    alert("Payment successful via "+method+"!\nTotal: ₱"+ total);
    // Save order to orders array
    const order = {
        id: 'order_' + Date.now(),
        user: currentUser,
        items: [...window.cart],
        total: total,
        paymentMethod: method,
        status: 'completed',
        date: new Date().toLocaleString()
    };
    saveOrder(order);
    // Clear cart
    window.cart = [];
    updateCart();
    closeCheckout();
}

function switchOrderTab(status){
    const buttons = document.querySelectorAll('.orders-tab');
    buttons.forEach(btn => btn.classList.toggle('active', btn.dataset.status === status));
    renderOrders(status);
}

function renderOrders(status){
    const userOrders = getOrders(currentUser);
    const filteredOrders = status === 'all' ? userOrders : userOrders.filter(order => order.status === status);
    const list = document.getElementById('orders-list');
    list.innerHTML = '';
    if(filteredOrders.length === 0){
        const message = status === 'cancelled' ? 'You have no cancelled orders yet.' : status === 'completed' ? 'You have no completed orders yet.' : 'You have no orders yet.';
        list.innerHTML = `<p style="color:#7d6a45; padding:24px 0; text-align:center;">${message}</p>`;
        return;
    }

    filteredOrders.forEach(order => {
        list.innerHTML += `
            <div class="order-item">
                <div class="order-header">
                    <div>
                        <div class="order-id">Order #${order.id}</div>
                        <div class="order-date">${order.date}</div>
                    </div>
                    <div style="text-align:right;">
                        <div class="order-status ${order.status}">${order.status === 'completed' ? 'Delivered' : 'Cancelled'}</div>
                        <div class="order-total">₱${order.total}</div>
                    </div>
                </div>
                <div class="order-items">
                    ${order.items.map(item => `
                        <div class="order-product">
                            <img src="images/${item.image}" alt="${item.name}">
                            <div class="order-product-details">
                                <div class="order-product-name">${item.name}</div>
                                <div class="order-product-price">₱${item.price}</div>
                                <div class="order-product-qty">Qty: ${item.qty || 1}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="order-actions">
                    <button class="order-details-btn" onclick="viewOrderDetails('${order.id}')">View Details</button>
                    <button class="order-again-btn" onclick="buyAgain('${order.id}')">Buy Again</button>
                </div>
            </div>`;
    });
}

function viewOrderDetails(orderId){
    const userOrders = getOrders(currentUser);
    const order = userOrders.find(o => o.id === orderId);
    if(!order){ return alert('Order not found.'); }
    const items = order.items.map(item => `${item.name} x${item.qty || 1} - ₱${item.price}`).join('\n');
    alert(`Order #${order.id}\nDate: ${order.date}\nStatus: ${order.status}\n\nItems:\n${items}\n\nTotal: ₱${order.total}`);
}

function buyAgain(orderId){
    const userOrders = getOrders(currentUser);
    const order = userOrders.find(o => o.id === orderId);
    if(!order){ return alert('Order not found.'); }
    order.items.forEach(item => {
        const existing = window.cart.find(cartItem => cartItem.id === item.id);
        if(existing){ existing.qty = (existing.qty || 1) + (item.qty || 1); }
        else { window.cart.push({...item}); }
    });
    updateCart();
    alert('Added order items to your cart.');
}

function removeCartItem(index){
    window.cart.splice(index,1);
    updateCart();
    // if checkout modal is open, re-render
    if(document.getElementById('checkoutModal').style.display==='flex') showCheckout();
    const drawer = document.getElementById('cartDrawer');
    if(drawer && drawer.classList.contains('open')) renderCartDrawer();
}

// CART DRAWER FUNCTIONS - Enhanced with Selection
let selectedItems = new Set();

function toggleCartDrawer(){
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartOverlay');
    if (!drawer || !overlay) {
        cartShouldOpenAfterLoad = true;
        loadCartHtml();
        return;
    }

    const isOpen = drawer.classList.contains('open');
    if(isOpen){ drawer.classList.remove('open'); overlay.classList.remove('open'); }
    else{ renderCartDrawer(); drawer.classList.add('open'); overlay.classList.add('open'); }
}

function formatPeso(value){
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 0 }).format(value);
}

function toggleItemSelection(itemId){
    if(selectedItems.has(itemId)){
        selectedItems.delete(itemId);
    } else {
        selectedItems.add(itemId);
    }
    renderCartDrawer();
}

function selectAllItems(){
    window.cart.forEach(item => selectedItems.add(item.id));
    renderCartDrawer();
}

function deselectAllItems(){
    selectedItems.clear();
    renderCartDrawer();
}

function removeSelectedItems(){
    window.cart = window.cart.filter(item => !selectedItems.has(item.id));
    selectedItems.clear();
    updateCart();
    renderCartDrawer();
}

function renderCartDrawer(){
    const list = document.getElementById('cart-items');
    const footer = document.getElementById('cart-footer');
    list.innerHTML = '';
    footer.innerHTML = '';
    
    if(window.cart.length === 0){
        list.innerHTML = '<div class="cart-empty"><div style="font-size:48px; margin-bottom:16px;">🛒</div>Your cart is empty.<br>Add a bag to see it here.</div>';
        footer.innerHTML = `
            <div class="order-summary-panel">
                <h4>Order Summary</h4>
                <div class="summary-row"><span>Subtotal</span><strong>₱0</strong></div>
                <div class="summary-row"><span>Shipping</span><strong>Free</strong></div>
                <div class="summary-row total"><span>Total</span><strong>₱0</strong></div>
            </div>
            <div class="cart-actions">
                <button class="view-cart-btn" onclick="toggleCartDrawer()">Continue shopping</button>
            </div>`;
        document.getElementById('cart-count-header').innerText = '(0)';
        return;
    }
    
    let totalAmount = 0;
    let totalItems = 0;
    let selectedTotal = 0;
    let selectedCount = 0;
    
    const itemsHtml = window.cart.map((item, idx)=>{
        const qty = item.qty||1;
        const subtotal = qty * item.price;
        const isSelected = selectedItems.has(item.id);
        totalAmount += subtotal;
        totalItems += qty;
        if(isSelected){
            selectedTotal += subtotal;
            selectedCount += qty;
        }
        return `
            <div class="cart-item" data-id="${item.id}" style="display:flex; gap:12px; padding:16px; border-bottom:1px solid #e0d5c7; align-items:flex-start;">
                <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleItemSelection('${item.id}')" style="margin-top:8px; cursor:pointer; width:18px; height:18px;">
                <img src="images/${item.image}" alt="${item.name}" style="width:80px; height:80px; object-fit:cover; border-radius:8px;">
                <div class="cart-item-details" style="flex:1;">
                    <h4 style="margin:0 0 6px 0; font-size:14px; font-weight:600;">${item.name}</h4>
                    <p class="cart-item-price" style="margin:0 0 10px 0; font-size:14px; font-weight:600; color:rgb(177, 113, 65);">${formatPeso(item.price)}</p>
                    <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
                        <button onclick="changeQuantity('${item.id}', -1)" style="width:28px; height:28px; border:1px solid #d0c4b4; background:#fff; cursor:pointer; border-radius:4px;">−</button>
                        <span style="width:32px; text-align:center; font-weight:600;">${qty}</span>
                        <button onclick="changeQuantity('${item.id}', 1)" style="width:28px; height:28px; border:1px solid #d0c4b4; background:#fff; cursor:pointer; border-radius:4px;">+</button>
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
                    <p style="margin:0; font-weight:600; font-size:14px;">${formatPeso(subtotal)}</p>
                    <button class="cart-item-remove" onclick="removeCartItemById('${item.id}')" style="background:none; border:none; font-size:18px; cursor:pointer;">🗑</button>
                </div>
            </div>`;
    }).join('');
    
    const allSelected = selectedItems.size === window.cart.length && window.cart.length > 0;
    
    list.innerHTML = `
        <div style="padding:16px; border-bottom:2px solid #d0c4b4; display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:10px;">
                <input type="checkbox" ${allSelected ? 'checked' : ''} onchange="${allSelected ? 'deselectAllItems()' : 'selectAllItems()'}" style="cursor:pointer; width:18px; height:18px;">
                <label style="cursor:pointer; font-weight:600; font-size:14px;">Select all (${window.cart.length})</label>
            </div>
            <button onclick="removeSelectedItems()" style="background:none; border:none; color:#b19f8d; cursor:pointer; font-size:13px; text-decoration:underline;">Remove all</button>
        </div>
        ${itemsHtml}`;
    
    document.getElementById('cart-count-header').innerText = `(${totalItems})`;
    
    footer.innerHTML = `
        <div class="order-summary-panel">
            <h4>Order Summary</h4>
            <div class="summary-row"><span>Subtotal (${selectedCount > 0 ? selectedCount : 'selected'} items)</span><strong>${formatPeso(selectedCount > 0 ? selectedTotal : 0)}</strong></div>
            <div class="summary-row"><span>Shipping</span><strong>Free</strong></div>
            <div class="summary-row total"><span>Total</span><strong>${formatPeso(selectedCount > 0 ? selectedTotal : 0)}</strong></div>
        </div>
        <div class="cart-actions">
            <label for="drawer-payment" style="display:block; margin-bottom:8px; font-weight:600; font-size:13px;">Payment method</label>
            <select id="drawer-payment" style="width:100%; padding:10px; border:1px solid #d0c4b4; border-radius:4px; background:#fff; margin-bottom:12px;">
                <option value="gcash">GCash</option>
                <option value="cod">Cash on Delivery</option>
            </select>
            <button class="checkout-btn" onclick="checkoutSelected()" style="width:100%; padding:12px; background:rgb(134, 104, 40); color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:600; margin-bottom:8px;">🔒 Checkout Securely</button>
            <button class="view-cart-btn" onclick="toggleCartDrawer()" style="width:100%; padding:12px; background:transparent; border:1px solid #d0c4b4; border-radius:6px; cursor:pointer; font-weight:600;">Continue shopping</button>
            <div class="security-msg" style="text-align:center; margin-top:12px; font-size:12px; color:#b19f8d;">✓ Your payment is safe and secure.</div>
        </div>`;
}

function changeQuantity(itemId, delta){
    const item = window.cart.find(c=>c.id===itemId);
    if(!item) return;
    item.qty = Math.max(1, (item.qty||1) + delta);
    updateCart();
    const drawer = document.getElementById('cartDrawer');
    if(drawer && drawer.classList.contains('open')) renderCartDrawer();
}

function removeCartItemById(id){
    const idx = cart.findIndex(c=>c.id===id);
    if(idx>=0) cart.splice(idx,1);
    updateCart();
    const drawer = document.getElementById('cartDrawer');
    if(drawer && drawer.classList.contains('open')) renderCartDrawer();
}

function checkoutSelected(){
    const method = document.getElementById('drawer-payment').value;
    if(selectedItems.size === 0){
        alert('Please select at least one item to checkout.');
        return;
    }
    
    const selectedCartItems = cart.filter(item => selectedItems.has(item.id));
    const total = selectedCartItems.reduce((s,i)=>s + (i.price * (i.qty||1)),0);
    
    showNotification(`Payment successful via ${method}!`);
    const order = {
        id: 'order_' + Date.now(),
        user: currentUser,
        items: selectedCartItems.map(item => ({ ...item })),
        total: total,
        paymentMethod: method,
        status: 'completed',
        date: new Date().toLocaleString()
    };
    saveOrder(order);
    
    // Remove purchased items from cart
    window.cart = window.cart.filter(item => !selectedItems.has(item.id));
    selectedItems.clear();
    updateCart();
    renderCartDrawer();
    
    // Show success message
    setTimeout(() => {
        alert('Order placed successfully!\nOrder ID: ' + order.id + '\nTotal: ' + formatPeso(total));
        toggleCartDrawer();
    }, 500);
}