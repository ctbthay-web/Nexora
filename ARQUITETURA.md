# Arquitetura recomendada

## Stack
- **Front + rotas de servidor:** Next.js 14 (App Router) + TypeScript + Tailwind. Mutações via Server Actions.
- **Banco/Auth/Storage:** Supabase (Postgres + RLS + Auth). Imagens/artes: Supabase Storage (Fase 2).
- **Worker / agendador (Fase 3):** processo Node separado (ex.: Railway, Render, Fly.io) que usa `SUPABASE_SERVICE_ROLE_KEY`, lê `publish_queue` (`status='pending' and scheduled_for <= now()`), trava o item, envia, registra sucesso/erro e reprograma com retentativas. Não roda no navegador nem no Vercel serverless puro.
- **Integrações:** uma pasta por serviço em `src/integrations/<nome>/` com a mesma interface (`search`, `buildAffiliateLink`, `testConnection`), para adicionar marketplaces sem mexer no resto.
- **IA:** módulo `src/ai/` com provedor configurável; o prompt só recebe campos reais do produto e proíbe inventar preço, cupom, urgência ou avaliação.

## Modelo de dados (Fase 1)
`profiles` · `marketplace_connections` · `channels` · `products` · `publish_queue` · `activity_log`. Todas com RLS por `user_id`. Duplicidade na fila impedida por índice único parcial `(product_id, channel_id)` para itens `pending/sent`. Desconto é coluna calculada no banco, só existe com preço anterior maior.

## Reaproveitamento
A pasta estava vazia: nada a preservar.

## Integrações e credenciais
| Serviço | Credencial | Pode fazer agora? |
|---|---|---|
| Supabase | URL + anon key | Sim (Fase 1) |
| Telegram | Token do bot (@BotFather) + bot como admin do canal/grupo | Código na Fase 3; gratuito |
| Shopee | Conta no Programa de Afiliados + App ID/Secret da API | Depende de aprovação deles |
| Mercado Livre | Programa de Afiliados + app OAuth | Depende de aprovação |
| Amazon | Associates + PA-API (costuma exigir vendas qualificadas) | Depende de aprovação |
| Magalu / Shein | Programa de afiliados; API pública não confirmada | Cadastro manual até confirmar |
| IA de textos | Chave de API de um provedor | Pago por uso |
| Geração de artes | Montagem por template (sem custo) ou serviço de imagem (pago) | Template na Fase 2 |
| WhatsApp | API oficial não publica em grupos qualquer; exige provedor autorizado (custo mensal) | Fase 4, após escolher provedor |
| Instagram | Conta profissional + app Meta com permissões e revisão | Fase 4 |

## Dependem de serviços externos
Busca real de produtos, links de afiliado verificados, textos por IA, envios (Telegram/WhatsApp/Instagram), comissões e vendas (só com dados confirmados pela fonte).

## Plano
- **Fase 2:** primeira integração real (recomendo começar pela que você já tem aprovada), validação do link de afiliado, busca/filtros, IA de textos, artes por template, revisão.
- **Fase 3:** Telegram + worker + retentativas + logs de execução.
- **Fase 4:** WhatsApp, Instagram, vitrine, rastreamento de cliques, relatórios CSV/Excel.
