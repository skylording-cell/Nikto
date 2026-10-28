(() => {
  "use strict";
  const PRICE_PER_GIFT = 3000;
  const STORAGE_KEY = "bigHappyHouse.orders.v1";
  const $ = (id) => document.getElementById(id);
  const range = $("giftRange");
  const quickChoices = $("quickChoices");
  const quantityDisplay = $("quantityDisplay");
  const giftWord = $("giftWord");
  const priceDisplay = $("priceDisplay");
  const modalBackdrop = $("modalBackdrop");
  const confirmButton = $("confirmOrder");
  const mascot = $("mascot");
  const mascotCaption = $("mascotCaption");
  const ordersList = $("ordersList");
  let currentQuantity = 1;
  let pending = false;
  let toastTimer;
  let successTimer;
  let lastFocusedElement = null;

  const demoOrders = [
    { id: "#58310427", quantity: 2, price: 6000, createdAt: Date.now() - 1000 * 60 * 18, status: "В обработке", demo: true },
    { id: "#76192854", quantity: 0.5, price: 1500, createdAt: Date.now() - 1000 * 60 * 60 * 5, status: "Заказ в пути", demo: true },
    { id: "#49268315", quantity: 1, price: 3000, createdAt: Date.now() - 1000 * 60 * 60 * 27, status: "Готово", demo: true }
  ];
  const statusInfo = {
    "Отправлен на проверку": { cls: "review", icon: "◷" },
    "В обработке": { cls: "process", icon: "◌" },
    "Заказ в пути": { cls: "transit", icon: "↗" },
    "Готово": { cls: "done", icon: "✓" }
  };
  function formatQuantity(value) {
    return Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 1, minimumFractionDigits: Number(value) % 1 ? 1 : 0 });
  }
  function formatPrice(value) {
    return Math.round(value).toLocaleString("ru-RU");
  }
  function wordForQuantity(value) {
    if (value % 1 !== 0) return "подарка";
    const n = Math.abs(value) % 100, n1 = n % 10;
    if (n > 10 && n < 20) return "подарков";
    if (n1 > 1 && n1 < 5) return "подарка";
    if (n1 === 1) return "подарок";
    return "подарков";
  }
  function priceFor(value) { return Math.round(value * PRICE_PER_GIFT); }
  function updateRangeTrack() {
    const percent = ((Number(range.value) - 0.1) / 9.9) * 100;
    range.style.background = `linear-gradient(90deg,#2b9657 0%,#2b9657 ${percent}%,#e8e3d5 ${percent}%,#e8e3d5 100%)`;
  }
  function setQuantity(value) {
    currentQuantity = Math.min(10, Math.max(0.1, Math.round(Number(value) * 10) / 10));
    range.value = String(currentQuantity);
    quantityDisplay.textContent = formatQuantity(currentQuantity);
    giftWord.textContent = wordForQuantity(currentQuantity);
    priceDisplay.textContent = formatPrice(priceFor(currentQuantity));
    updateRangeTrack();
    [...quickChoices.querySelectorAll("button")].forEach(button => {
      const selected = Math.abs(Number(button.dataset.value) - currentQuantity) < 0.001;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }
  function readOrders() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.filter(o => o && typeof o.id === "string" && Number.isFinite(Number(o.quantity)) && Number.isFinite(Number(o.price))) : [];
    } catch { return []; }
  }
  function saveOrders(orders) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(orders)); return true; }
    catch { showToast("Не удалось сохранить заказ. Проверьте свободное место в браузере."); return false; }
  }
  function allOrders() {
    const saved = readOrders();
    return [...saved, ...demoOrders].sort((a,b) => Number(b.createdAt) - Number(a.createdAt));
  }
  function formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return "Сегодня, " + date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return "Вчера, " + date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }) + ", " + date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  }
  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
  }
  function renderOrders() {
    const orders = allOrders();
    $("ordersTotal").textContent = String(orders.length).padStart(2, "0");
    $("headerCount").textContent = readOrders().length;
    if (!orders.length) {
      ordersList.innerHTML = '<div class="empty-orders">Здесь появятся ваши заказы.</div>';
      return;
    }
    ordersList.innerHTML = orders.map(order => {
      const status = statusInfo[order.status] || statusInfo["Отправлен на проверку"];
      const label = order.demo ? " · пример" : "";
      return `<article class="order-row">
        <div class="order-symbol" aria-hidden="true">${status.icon}</div>
        <div class="order-main"><div class="order-topline"><span class="order-id">${escapeHTML(order.id)}</span><span class="order-quantity">${formatQuantity(Number(order.quantity))} ${wordForQuantity(Number(order.quantity))}${label}</span></div><div class="order-date">${formatDate(Number(order.createdAt))}</div></div>
        <div class="order-right"><div class="order-price">${formatPrice(Number(order.price))} конфеток</div><span class="status ${status.cls}">${escapeHTML(order.status)}</span></div>
      </article>`;
    }).join("");
  }
  function openModal() {
    lastFocusedElement = document.activeElement;
    $("modalQuantity").textContent = `${formatQuantity(currentQuantity)} ${wordForQuantity(currentQuantity)}`;
    $("modalPrice").textContent = formatPrice(priceFor(currentQuantity));
    $("modalTitle").innerHTML = "Вы уверены, что<br>хотите сделать заказ?";
    $("modalDescription").textContent = "Домик уже немного волнуется — давайте всё проверим.";
    confirmButton.disabled = false;
    confirmButton.innerHTML = "<span>Да, оформить заказ</span><span>↗</span>";
    modalBackdrop.hidden = false;
    document.body.style.overflow = "hidden";
    setMascotState("anticipation");
    $("cancelOrder").focus();
  }
  function closeModal() {
    if (pending) return;
    modalBackdrop.hidden = true;
    document.body.style.overflow = "";
    if (!mascot.classList.contains("success")) setMascotState("idle");
    if (lastFocusedElement && typeof lastFocusedElement.focus === "function") lastFocusedElement.focus();
  }
  function generateId(existing) {
    const ids = new Set(existing.map(o => o.id));
    let id;
    do { id = "#" + String(Math.floor(10000000 + Math.random() * 90000000)); } while (ids.has(id));
    return id;
  }
  function setMascotState(state) {
    mascot.classList.remove("idle", "anticipation", "success");
    mascot.classList.add(state);
    mascotCaption.innerHTML = state === "success"
      ? '<span class="caption-dot"></span> Ура! Подарок отправлен!'
      : state === "anticipation"
      ? '<span class="caption-dot"></span> Домик затаил дыхание…'
      : '<span class="caption-dot"></span> Домик уже готов дарить счастье';
  }
  function launchConfetti() {
    const stage = $("mascotStage");
    stage.querySelectorAll(".confetti-piece").forEach(node => node.remove());
    for (let i = 0; i < 28; i++) {
      const piece = document.createElement("i");
      piece.className = "confetti-piece";
      piece.style.setProperty("--dx", `${Math.round((Math.random() - .5) * 250)}px`);
      piece.style.setProperty("--dy", `${Math.round(-60 - Math.random() * 170)}px`);
      piece.style.setProperty("--rot", `${Math.round(Math.random() * 700 - 350)}deg`);
      piece.style.animationDelay = `${Math.random() * .2}s`;
      piece.style.left = `${25 + Math.random() * 50}%`;
      stage.appendChild(piece);
      window.setTimeout(() => piece.remove(), 1900);
    }
  }
  function showToast(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
  }
  function confirmOrder() {
    if (pending) return;
    pending = true;
    confirmButton.disabled = true;
    confirmButton.innerHTML = "<span>Создаём заказ…</span><span>· · ·</span>";
    setMascotState("anticipation");
    // A short processing state makes the confirmation feel intentional and prevents double submits.
    window.setTimeout(() => {
      const existing = readOrders();
      const order = {
        id: generateId([...existing, ...demoOrders]),
        quantity: currentQuantity,
        price: priceFor(currentQuantity),
        createdAt: Date.now(),
        status: "Отправлен на проверку",
        demo: false
      };
      const next = [order, ...existing];
      if (!saveOrders(next)) {
        pending = false;
        confirmButton.disabled = false;
        confirmButton.innerHTML = "<span>Да, оформить заказ</span><span>↗</span>";
        setMascotState("idle");
        return;
      }
      renderOrders();
      modalBackdrop.hidden = true;
      document.body.style.overflow = "";
      pending = false;
      setMascotState("success");
      launchConfetti();
      showToast(`Заказ ${order.id} создан · ${formatPrice(order.price)} конфеток`);
      clearTimeout(successTimer);
      successTimer = setTimeout(() => setMascotState("idle"), 2800);
      $("orders").scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    }, 520);
  }
  quickChoices.addEventListener("click", event => {
    const button = event.target.closest("button[data-value]");
    if (button) setQuantity(button.dataset.value);
  });
  range.addEventListener("input", () => setQuantity(range.value));
  $("startOrder").addEventListener("click", openModal);
  $("cancelOrder").addEventListener("click", closeModal);
  $("modalClose").addEventListener("click", closeModal);
  confirmButton.addEventListener("click", confirmOrder);
  modalBackdrop.addEventListener("click", event => { if (event.target === modalBackdrop) closeModal(); });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !modalBackdrop.hidden) closeModal();
    if (event.key === "Tab" && !modalBackdrop.hidden) {
      const focusables = [...modalBackdrop.querySelectorAll("button:not(:disabled)")];
      if (!focusables.length) return;
      if (event.shiftKey && document.activeElement === focusables[0]) { event.preventDefault(); focusables[focusables.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === focusables[focusables.length - 1]) { event.preventDefault(); focusables[0].focus(); }
    }
  });
  setQuantity(1);
  renderOrders();
})();