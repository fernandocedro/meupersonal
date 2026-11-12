const api = async (path, options={}) => {
  const r = await fetch(`/api${path}`, {headers:{"Content-Type":"application/json",...(options.headers||{})},...options});
  const data = await r.json().catch(()=>({error:"Resposta inválida"}));
  if(!r.ok) throw new Error(data.error||"Não foi possível concluir.");
  return data;
};
(async()=>{
  const box=document.querySelector("#plans");
  try{
    const {plans}=await api("/public/plans");
    if(!plans.length){box.innerHTML='<div class="panel">Os planos estarão disponíveis em breve.</div>';return;}
    box.innerHTML=plans.map(p=>`<article class="panel"><p class="eyebrow">MEU PERSONAL</p><h2>${escapeHtml(p.name)}</h2><strong style="font:800 2rem Manrope">R$ ${Number(p.price_cents/100).toFixed(2).replace(".",",")}</strong><p class="muted">${p.duration_days} dias de acompanhamento</p><button class="btn primary full" data-buy="${p.id}">Quero este plano</button></article>`).join("");
    box.querySelectorAll("[data-buy]").forEach(b=>b.onclick=()=>document.querySelector("#purchase-message").textContent="A etapa de checkout será ativada após configurar o provedor de pagamento e as credenciais no servidor. Nenhuma cobrança foi realizada.");
  }catch(e){box.innerHTML='<div class="panel">Não foi possível carregar os planos. Confira a configuração da API Cloudflare.</div>';}
})();
function escapeHtml(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
