(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const cfg = window.BHH_CONFIG || {};
  const configured = cfg.supabaseUrl && !cfg.supabaseUrl.startsWith("YOUR_") && cfg.supabaseAnonKey && !cfg.supabaseAnonKey.startsWith("YOUR_");
  const supabase = configured && window.supabase ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
  const range = $("giftRange"), choices = $("quickChoices"), modal = $("modalBackdrop"), form = $("orderForm");
  let quantity = 1, pending = false, focusBeforeModal = null;
  const fmt = BHH.formatPrice;
  function setQuantity(raw) {
    try { quantity = BHH.normalizeQuantity(raw); } catch { return; }
    range.value = String(quantity);
    $("quantityDisplay").textContent = BHH.formatQuantity(quantity);
    $("giftWord").textContent = quantity % 1 ? "подарка" : (quantity === 1 ? "подарок" : "подарков");
    $("priceDisplay").textContent = fmt(BHH.priceFor(quantity));
    const pct = (quantity - .1) / 9.9 * 100;
    range.style.background = `linear-gradient(90deg,#2b9657 0%,#2b9657 ${pct}%,#e8e3d5 ${pct}%,#e8e3d5 100%)`;
    [...choices.querySelectorAll("button")].forEach(b => {
      const selected = Number(b.dataset.value) === quantity;
      b.classList.toggle("selected", selected); b.setAttribute("aria-pressed", String(selected));
    });
  }
  function toast(message, error=false) {
    const el=$("toast"); el.textContent=message; el.classList.toggle("error",error); el.classList.add("show");
    clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove("show"),4500);
  }
  function openModal() {
    if (!supabase) { toast("Сайт ещё не подключён к Supabase. Заполните config.js и разверните Edge Function.", true); return; }
    focusBeforeModal=document.activeElement;
    $("modalQuantity").textContent=BHH.formatQuantity(quantity);
    $("modalPrice").textContent=fmt(BHH.priceFor(quantity))+" ₽";
    $("modalSavings").textContent=fmt(BHH.savingsFor(quantity))+" ₽";
    $("formError").hidden=true; modal.hidden=false; document.body.classList.add("modal-open");
    $("nickname").focus();
  }
  function closeModal() {
    if (pending) return;
    modal.hidden=true; document.body.classList.remove("modal-open");
    if(focusBeforeModal) focusBeforeModal.focus();
  }
  function showRecentOrders() {
    let ids=[]; try { ids=JSON.parse(sessionStorage.getItem("bhh.recent")||"[]"); } catch {}
    const list=$("ordersList"); $("headerCount").textContent=String(ids.length); 
    if (!ids.length) { list.innerHTML='<div class="empty-orders">Ваши заказы появятся здесь после оформления. Сохраните номер и код, чтобы проверить статус.</div>'; return; }
    list.replaceChildren();
    ids.slice(0,5).forEach(o=>{
      const card=document.createElement("article"); card.className="order-row";
      const title=document.createElement("strong"); title.textContent=o.public_id;
      const meta=document.createElement("span"); meta.textContent=`${o.quantity} подарка · ${fmt(o.price)} ₽`;
      const link=document.createElement("a"); link.href="track.html"; link.textContent="Отследить"; link.className="track-link";
      card.append(title,meta,link); list.append(card);
    });
  }
  form.addEventListener("submit", async e=>{
    e.preventDefault(); if(pending) return;
    $("formError").hidden=true;
    let payload;
    try {
      payload=BHH.validateOrder({quantity, nickname:$("nickname").value, phone:$("phone").value, contact_method:$("contactMethod").value, comment:$("orderComment").value});
    } catch(err) { $("formError").textContent=err.message; $("formError").hidden=false; return; }
    if(!window.confirm(`Подтвердить заказ ${BHH.formatQuantity(quantity)} подарка на ${fmt(BHH.priceFor(quantity))} ₽?`)) return;
    pending=true; const btn=$("confirmOrder"); btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Отправляем…';
    try {
      // Idempotency key is reused for this attempt; server additionally rate-limits requests.
      let idempotencyKey=sessionStorage.getItem("bhh.pending-idempotency");
      if(!idempotencyKey){idempotencyKey=crypto.randomUUID();sessionStorage.setItem("bhh.pending-idempotency",idempotencyKey)}
      const {data,error}=await supabase.functions.invoke("create-order",{body:{...payload, idempotency_key:idempotencyKey}});
      if(error) throw new Error(error.message || "Не удалось связаться с сервером.");
      if(!data || !data.public_id || !data.tracking_code) throw new Error(data?.error || "Сервер не подтвердил сохранение заказа.");
      const success={public_id:data.public_id,tracking_code:data.tracking_code,quantity:data.quantity,price:data.price};
      // Secret tracking code lives only in sessionStorage until leaving the success flow.
      sessionStorage.setItem("bhh.success",JSON.stringify(success));
      sessionStorage.removeItem("bhh.pending-idempotency");
      let recent=[]; try{recent=JSON.parse(sessionStorage.getItem("bhh.recent")||"[]")}catch{}
      recent=[{public_id:data.public_id,quantity:data.quantity,price:data.price},...recent.filter(x=>x.public_id!==data.public_id)].slice(0,5);
      sessionStorage.setItem("bhh.recent",JSON.stringify(recent));
      window.location.href="success.html";
    } catch(err) {
      $("formError").textContent=err.message==="Failed to fetch"?"Нет соединения с сервером. Проверьте интернет и попробуйте снова.":err.message;
      $("formError").hidden=false;
    } finally { pending=false; btn.disabled=false; btn.innerHTML="<span>Подтвердить заказ</span><span>↗</span>"; }
  });
  range.addEventListener("input",()=>setQuantity(range.value));
  choices.addEventListener("click",e=>{const b=e.target.closest("button[data-value]");if(b)setQuantity(b.dataset.value)});
  $("startOrder").addEventListener("click",openModal);
  $("modalClose").addEventListener("click",closeModal); $("cancelOrder").addEventListener("click",closeModal);
  modal.addEventListener("click",e=>{if(e.target===modal)closeModal()});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!modal.hidden)closeModal()});
  $("contactMethod").addEventListener("change",()=>{$("phone").required=$("contactMethod").value==="Телефон"});
  setQuantity(1); showRecentOrders();
})();