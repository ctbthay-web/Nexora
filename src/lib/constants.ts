export type MarketplaceKey = "shopee" | "mercadolivre" | "amazon" | "magalu" | "shein";

export const MARKETPLACES: Record<
  MarketplaceKey,
  { label: string; auth: string; idLabel: string; howTo: string }
> = {
  shopee: {
    label: "Shopee",
    auth: "Programa de Afiliados Shopee (API Open Platform: App ID + Secret)",
    idLabel: "ID de afiliado",
    howTo: "Cadastre-se no Programa de Afiliados Shopee, solicite acesso à API de afiliados e guarde App ID e Secret no .env do servidor (Fase 2).",
  },
  mercadolivre: {
    label: "Mercado Livre",
    auth: "Programa de Afiliados + OAuth da API do Mercado Livre",
    idLabel: "ID / etiqueta de afiliado",
    howTo: "Entre no Programa de Afiliados do Mercado Livre e crie um app de desenvolvedor para a API (Fase 2). Confirme os requisitos atuais na página oficial.",
  },
  amazon: {
    label: "Amazon",
    auth: "Amazon Associates (tag de associado) + Product Advertising API",
    idLabel: "Tag de associado",
    howTo: "Crie a conta Amazon Associates. A Product Advertising API costuma exigir vendas qualificadas para liberar as chaves. Confirme na página oficial.",
  },
  magalu: {
    label: "Magalu",
    auth: "Programa de parceiros/afiliados Magalu",
    idLabel: "ID de parceiro",
    howTo: "Cadastre-se no programa de parceiros do Magalu e verifique se há API disponível para o seu perfil; caso contrário, links serão gerados pelo painel do programa.",
  },
  shein: {
    label: "Shein",
    auth: "Programa de afiliados Shein (sem API pública confirmada)",
    idLabel: "ID de afiliado",
    howTo: "Cadastre-se no programa de afiliados da Shein. Não presumimos API aberta: produtos podem precisar ser cadastrados manualmente.",
  },
};

export const CHANNEL_TYPES = {
  telegram: { label: "Telegram", phase: "Fase 3", ready: true },
  whatsapp: { label: "WhatsApp", phase: "Fase 4", ready: false },
  instagram: { label: "Instagram", phase: "Fase 4", ready: false },
} as const;

export const PRODUCT_STATUS: Record<string, { label: string; cls: string }> = {
  found: { label: "Encontrado", cls: "bg-slate-500/15 text-slate-600 dark:text-slate-300" },
  approved: { label: "Aprovado", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  rejected: { label: "Rejeitado", cls: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
  queued: { label: "Na fila", cls: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300" },
  published: { label: "Publicado", cls: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  failed: { label: "Falhou", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
};

export const TIMEZONES = [
  "America/Sao_Paulo", "America/Manaus", "America/Fortaleza", "America/Cuiaba", "America/Rio_Branco", "UTC",
];
