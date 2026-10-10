"use client";
import CopyButton from "./CopyButton";

/** Botão de favoritos: lido na página do produto aberta pela própria usuária (logada), envia os dados para o cadastro. */
export function bookmarkletCode(origin: string) {
  const code = `(function(){try{
var q=function(s){return document.querySelector(s)};
var t='',p='',i='',o='';
var ld=[].slice.call(document.querySelectorAll('script[type="application/ld+json"]')).map(function(s){try{return JSON.parse(s.textContent)}catch(e){return null}}).filter(Boolean);
var arr=[];ld.forEach(function(x){(Array.isArray(x)?x:[x]).forEach(function(y){(y['@graph']?y['@graph']:[y]).forEach(function(z){arr.push(z)})})});
var pr=arr.filter(function(z){return z&&z['@type']==='Product'})[0];
if(pr){t=pr.name||'';var of=Array.isArray(pr.offers)?pr.offers[0]:pr.offers;if(of){p=of.price||of.lowPrice||''}var im=Array.isArray(pr.image)?pr.image[0]:pr.image;i=(im&&im.url)?im.url:(im||'')}
if(!t){var h=q('h1');t=h?h.innerText:document.title}
if(!i){var m=q('meta[property="og:image"]');i=m?m.content:''}
var amt=function(el){if(!el)return '';var f=el.querySelector('.andes-money-amount__fraction');var c=el.querySelector('.andes-money-amount__cents');return f?(f.innerText.replace(/\\./g,'')+(c?','+c.innerText:'')):''};
if(!p){p=amt(q('.ui-pdp-price__second-line .andes-money-amount'))||amt(q('.andes-money-amount:not(.andes-money-amount--previous)'))}
o=amt(q('.andes-money-amount--previous'));
var cl=q('link[rel=canonical]');var u=cl?cl.href:(location.origin+location.pathname);
var qs='title='+encodeURIComponent(t)+'&price='+encodeURIComponent(p)+'&previous_price='+encodeURIComponent(o)+'&image='+encodeURIComponent(i)+'&url='+encodeURIComponent(u);
window.open('${origin}/produtos/novo?'+qs,'_blank');
}catch(e){alert('Nao consegui ler esta pagina: '+e.message)}})();`.replace(/\n/g, "");
  return "javascript:" + encodeURIComponent(code);
}

export default function Bookmarklet({ origin }: { origin: string }) {
  const href = bookmarkletCode(origin);
  return (
    <div className="space-y-2 rounded-lg border border-line bg-bg p-3 text-sm md:col-span-2">
      <p className="font-semibold">Jeito mais fácil: botão “Enviar para o Nexora”</p>
      <ol className="list-decimal space-y-1 pl-5 text-xs text-muted">
        <li>Mostre a barra de favoritos do navegador (Ctrl+Shift+B).</li>
        <li>Arraste este botão roxo para a barra de favoritos (faça isso uma única vez):</li>
      </ol>
      <div dangerouslySetInnerHTML={{ __html: `<a href="${href}" class="btn btn-primary" onclick="return false" draggable="true">Enviar para o Nexora</a>` }} />
      <ol start={3} className="list-decimal space-y-1 pl-5 text-xs text-muted">
        <li>Abra a página de qualquer produto no Mercado Livre (logada na sua conta) e clique no favorito “Enviar para o Nexora”.</li>
        <li>Abre este cadastro já preenchido com nome, preço, foto e link. Cole o seu link de afiliado, confira e cadastre.</li>
      </ol>
      <p className="text-xs text-muted">Se não conseguir arrastar: <CopyButton text={href} label="Copiar código do botão" /> e crie um favorito novo colando esse código no campo do endereço.</p>
    </div>
  );
}
