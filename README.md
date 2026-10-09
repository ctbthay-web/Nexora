# Nexora — Achadinhos & Automação de Afiliados (Fase 1)

Plataforma original de achadinhos e afiliados, inspirada no fluxo funcional de ferramentas do tipo (busca → divulgação → fila → publicação → métricas). Nenhum código, marca ou texto de terceiros foi copiado.

## O que funciona na Fase 1 (testado)

| Módulo | Estado |
|---|---|
| Cadastro / login / sair (Supabase Auth) | Funciona (precisa do Supabase configurado) |
| Isolamento por usuário (RLS no Postgres) | Políticas criadas no SQL |
| Dashboard com números reais do banco | Funciona. Cliques/vendas/comissões aparecem como "—" (Fase 4) |
| Produtos: cadastrar, editar, aprovar, rejeitar, favoritar, duplicar, excluir, filtrar | Funciona |
| Modo demonstração | Funciona, itens marcados `[DEMO]` e sem link de afiliado |
| Fila de publicação com agendamento e bloqueio de duplicidade | Funciona (salva e cancela) — **não envia** ainda |
| Marketplaces: identificador de afiliado, ativar/desativar, status | Funciona. "Verificar configuração" **não chama API** |
| Canais: cadastrar/ativar/remover | Funciona. Nenhum conectado ainda |
| Configurações: nome, fuso, cor, histórico de atividades | Funciona |
| Tema claro/escuro, layout responsivo | Funciona |

## Ainda NÃO existe (fases seguintes)
Busca automática em marketplaces e geração de link (Fase 2) · IA de textos e artes (Fase 2) · envio ao Telegram, agendador em servidor, retentativas (Fase 3) · WhatsApp, Instagram, vitrine pública, rastreamento, relatórios (Fase 4).

## Como rodar

1. Crie um projeto gratuito em https://supabase.com.
2. **SQL Editor** → cole todo o conteúdo de `supabase/migrations/0001_init.sql` → Run.
3. **Project Settings → API**: copie *Project URL* e a chave *anon public*.
4. Copie `.env.example` para `.env.local` e preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. (Recomendado para testar) Supabase → **Authentication → Providers → Email**: desligue "Confirm email" para entrar logo após o cadastro.
6. No terminal, dentro da pasta:
   ```
   npm install
   npm run dev
   ```
7. Abra http://localhost:3000, crie sua conta.

Testes: `npm test` (utilitários) · `npm run typecheck` · `npm run build`.

## Variáveis de ambiente

| Variável | Fase | Observação |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 1 | Pública |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 1 | Pública (protegida por RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | 3 | **Só servidor/worker.** Nunca no front-end |
| `SHOPEE_APP_ID`, `SHOPEE_SECRET` | 2 | Programa de afiliados Shopee |
| `AMAZON_ACCESS_KEY`, `AMAZON_SECRET_KEY`, `AMAZON_PARTNER_TAG` | 2 | Associates + PA-API |
| `ANTHROPIC_API_KEY` (ou outro provedor de IA) | 2 | Textos; **tem custo por uso** |
| `TELEGRAM_BOT_TOKEN` | 3 | Criado no @BotFather (gratuito) |

## Segurança
Chaves secretas nunca ficam no navegador nem na tela de configuração. O banco usa RLS: cada linha só é visível ao dono (`auth.uid() = user_id`).

Veja `ARQUITETURA.md` para o plano completo.
