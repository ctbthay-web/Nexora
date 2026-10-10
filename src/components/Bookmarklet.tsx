"use client";
import CopyButton from "./CopyButton";

/**
 * Botão de favoritos. Roda na página do Mercado Livre aberta pela própria usuária (logada):
 * - página de um produto: abre o cadastro já preenchido;
 * - página de lista (Ofertas, busca, perfil de afiliado): envia os produtos para a tela de importação.
 * Lê só o que está visível na página. Não inventa nenhum dado.
 */
export function bookmarkletCode(origin: string) {
  const code = `(function(){try{
var O='${origin}';
var q=function(s){return document.querySelector(s)};
var amt=function(el){if(!el)return '';var f=el.querySelector('.andes-money-amount__fraction');var c=el.querySelector('.andes-money-amount__cents');return f?(f.innerText.replace(/\\./g,'')+(c?','+c.innerText:'')):''};
var clean=function(h){try{var u=new URL(h,location.href);var w=u.searchParams.get('wid');return u.origin+u.pathname+(w?'?wid='+w:'')}catch(e){return ''}};
var ld=[].slice.call(document.querySelectorAll('script[type="application/ld+json"]')).map(function(s){try{return JSON.parse(s.textContent)}catch(e){return null}}).filter(Boolean);
var arr=[];ld.forEach(function(x){(Array.isArray(x)?x:[x]).forEach(function(y){(y['@graph']?y['@graph']:[y]).forEach(function(z){arr.push(z)})})});
var pr=arr.filter(function(z){return z&&z['@type']==='Product'})[0];
if(pr){
var t=pr.name||'',p='',i='';var of=Array.isArray(pr.offers)?pr.offers[0]:pr.offers;if(of){p=of.price||of.lowPrice||''}var im=Array.isArray(pr.image)?pr.image[0]:pr.image;i=(im&&im.url)?im.url:(im||'');
if(!p){p=amt(q('.ui-pdp-price__second-line .andes-money-amount'))||amt(q('.andes-money-amount:not(.andes-money-amount--previous)'))}
if(!i){var m=q('meta[property="og:image"]');i=m?m.content:''}
var o=amt(q('.andes-money-amount--previous'));
var cl=q('link[rel=canonical]');var u=cl?cl.href:(location.origin+location.pathname);
window.open(O+'/produtos/novo?title='+encodeURIComponent(t)+'&price='+encodeURIComponent(p)+'&previous_price='+encodeURIComponent(o)+'&image='+encodeURIComponent(i)+'&url='+encodeURIComponent(u),'_blank');
return}
var cards=[].slice.call(document.querySelectorAll('.poly-card')),items=[];
cards.forEach(function(c){if(items.length>=60)return;
var a=c.querySelector('a.poly-component__title')||c.querySelector('.poly-component__title a')||c.querySelector('a[href]');if(!a)return;
var te=c.querySelector('.poly-component__title');var t=((te||a).innerText||'').trim();
var cur=amt([].slice.call(c.querySelectorAll('.andes-money-amount')).filter(function(x){return !x.classList.contains('andes-money-amount--previous')&&!x.closest('.andes-money-amount--previous')&&!x.closest('.poly-component__installments')})[0]);
var prev=amt(c.querySelector('.andes-money-amount--previous'));
var im=c.querySelector('img');var src=im?(im.currentSrc||im.src||''):'';if(!src||src.indexOf('data:')===0){src=im?(im.getAttribute('data-src')||''):''}
if(t&&cur){items.push({t:t.slice(0,300),p:cur,o:prev,i:src,u:clean(a.href)})}});
if(!items.length){alert('Nao encontrei produtos nesta pagina. Abra a pagina de um produto ou a lista de Ofertas do Mercado Livre e clique de novo.');return}
var w=window.open(O+'/produtos/importar','nexora_import');
var n=0;var iv=setInterval(function(){n++;try{w.postMessage({nexora:'import',items:items},O)}catch(e){}if(n>60)clearInterval(iv)},500);
window.addEventListener('message',function(e){if(e.origin===O&&e.data==='nexora-ack'){clearInterval(iv)}});
}catch(e){alert('Nao consegui ler esta pagina: '+e.message)}})();`.replace(/\n/g, "");
  return "javascript:" + encodeURIComponent(code);
}

export default function Bookmarklet({ origin, compact }: { origin: string; compact?: boolean }) {
  const href = bookmarkletCode(origin);
  return (
    <div className="space-y-2 rounded-lg border border-line bg-bg p-3 text-sm md:col-span-2">
      <p className="font-semibold">Botão “Enviar para o Nexora” (um clique, direto da página do Mercado Livre)</p>
      <ol className="list-decimal space-y-1 pl-5 text-xs text-muted">
        <li>Mostre a barra de favoritos do navegador (Ctrl+Shift+B).</li>
        <li>Arraste este botão roxo para a barra de favoritos (uma única vez; se já tinha um antigo, apague-o e arraste este):</li>
      </ol>
      <div dangerouslySetInnerHTML={{ __html: `<a href="${href}" class="btn btn-primary" onclick="return false" draggable="true">Enviar para o Nexora</a>` }} />
      <ol start={3} className="list-decimal space-y-1 pl-5 text-xs text-muted">
        <li><b>Um produto:</b> abra a página dele no Mercado Livre e clique no favorito. O cadastro abre preenchido.</li>
        <li><b>Várias ofertas:</b> abra <a className="underline" href="https://www.mercadolivre.com.br/ofertas" target="_blank" rel="noreferrer">mercadolivre.com.br/ofertas</a> (ou uma busca, ou o seu perfil de afiliado), clique no favorito e escolha, na tela do Nexora, quais salvar.</li>
      </ol>
      {!compact && <p className="text-xs text-muted">Se não conseguir arrastar: <CopyButton text={href} label="Copiar código do botão" /> e crie um favorito novo colando esse código no campo do endereço.</p>}
    </div>
  );
}
