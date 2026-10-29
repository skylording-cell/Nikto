(() => {
  "use strict";
  const MIN = 0.1, MAX = 10, STEP = 0.1;
  function normalizeQuantity(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < MIN || n > MAX) throw new Error("Количество должно быть от 0,1 до 10.");
    const ticks = Math.round(n * 10);
    if (Math.abs(n * 10 - ticks) > 1e-7) throw new Error("Количество должно изменяться шагом 0,1.");
    return ticks / 10;
  }
  function priceFor(value) {
    const q = normalizeQuantity(value);
    return Math.round(q < 1 ? q * 3000 : 3000 + (q - 1) * 2800);
  }
  function savingsFor(value) {
    const q = normalizeQuantity(value);
    return Math.max(0, Math.round(q * 3000 - priceFor(q)));
  }
  function formatPrice(value) { return Math.round(value).toLocaleString("ru-RU"); }
  function formatQuantity(value) {
    return Number(value).toLocaleString("ru-RU", {minimumFractionDigits: Number(value) % 1 ? 1 : 0, maximumFractionDigits: 1});
  }
  function validateOrder(data) {
    if (!data || typeof data !== "object") throw new Error("Проверьте данные заказа.");
    normalizeQuantity(data.quantity);
    const nickname = String(data.nickname ?? "").trim();
    if (!nickname) throw new Error("Укажите никнейм.");
    if (nickname.length > 60) throw new Error("Никнейм должен быть не длиннее 60 символов.");
    const method = String(data.contact_method ?? "");
    if (!["Telegram", "Телефон", "Другой способ"].includes(method)) throw new Error("Выберите способ связи.");
    const phone = String(data.phone ?? "").trim();
    if (method === "Телефон" && !phone) throw new Error("Укажите номер телефона для связи по телефону.");
    if (phone && (phone.length > 30 || !/^[+()\d\s.-]{6,30}$/.test(phone) || phone.replace(/\D/g, "").length < 6)) throw new Error("Проверьте формат номера телефона.");
    const comment = String(data.comment ?? "");
    if (comment.length > 500) throw new Error("Комментарий должен быть не длиннее 500 символов.");
    return {quantity: normalizeQuantity(data.quantity), nickname, phone: phone || null, contact_method: method, comment: comment.trim() || null};
  }
  window.BHH = {MIN, MAX, STEP, normalizeQuantity, priceFor, savingsFor, formatPrice, formatQuantity, validateOrder};
})();