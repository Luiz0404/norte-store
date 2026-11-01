# NORTE® — Premium Streetwear Store

Loja em React + TypeScript + Vite, com Tailwind disponível, Framer Motion, Supabase e estrutura inicial para checkout Stripe. A identidade visual é original e não inclui produtos/preços comerciais fictícios. A loja começa vazia até que produtos reais sejam cadastrados no banco.

## Rodar localmente

1. Instale Node.js 20+.
2. No diretório do projeto: `npm install`
3. Copie `.env.example` para `.env.local` e informe URL e chave pública (anon/publishable) do Supabase.
4. Rode `npm run dev`.

Sem Supabase configurado, a experiência visual abre, mas a lista de produtos permanece vazia e o checkout é explicitamente desativado. Isso evita simular vendas.

## Banco de dados

Execute `supabase/migrations/001_store_schema.sql` no SQL Editor do projeto Supabase. Cadastre produtos reais em `products`, variantes reais em `variants` e imagens no Supabase Storage ou em URLs públicas seguras. `price_cents` e `compare_at_cents` são centavos de BRL (ex.: R$ 199,90 = 19990). Ative `products.active` apenas depois de revisar conteúdo e estoque.

O SQL habilita RLS e libera leitura pública apenas para produtos/variantes ativos e banners ativos. As escritas de pedidos, cupons e newsletter não estão liberadas para o navegador. Antes de produção, crie tabela `admin_users`, políticas RLS que autorizem apenas os IDs explicitamente cadastrados e políticas administrativas de CRUD. Nunca dê permissão de administrador a qualquer usuário autenticado.

## Checkout / pagamento real

A Edge Function `create-checkout` usa Stripe Checkout e consulta o produto/preço/estoque no banco em vez de confiar no navegador. Por segurança, o exemplo exige sessão autenticada do Supabase. Configure `STRIPE_SECRET_KEY`, `STORE_URL`, `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` em **Edge Function Secrets**, nunca no frontend. Faça deploy com:

`supabase functions deploy create-checkout`

O exemplo não decrementa estoque nem marca pedido como pago. Para vender de verdade, implemente um webhook Stripe assinado (`STRIPE_WEBHOOK_SECRET`) que verifique o evento no servidor, grave pedido e itens com snapshot de preço, faça decremento atômico de estoque e trate eventos repetidos/idempotência. Não confie na página de sucesso do navegador como prova de pagamento. Teste primeiro com chaves de teste do Stripe.

O checkout atual exige usuário autenticado, portanto antes de lançamento decida se o checkout será de convidado ou com conta. O código não afirma que pagamentos estão prontos para produção.

## Frete, cupons, administração

- `calculate-shipping` é um ponto de integração: precisa de credenciais e API real de transportadora (ex.: Correios/Melhor Envio); não inventa valor de frete.
- Cupom `NORTE10` aparece apenas como indicação de interface, não é aplicado no pagamento. A função de checkout não aceita desconto percentual sem mapeamento validado no Stripe. Configure cupons reais e valide regras/limites no backend antes de habilitá-los.
- O acesso de login administrativo está iniciado; o CRUD completo de produtos, imagens, banners, pedidos, promoção e estoque ainda precisa de uma área autenticada protegida por políticas RLS/admin. Não publique como painel de gestão completo até concluir essa etapa.
- A newsletter exibe uma mensagem de configuração; conecte um endpoint com validação/consentimento e proteção contra abuso antes de armazenar e-mails.

## Imagens e conteúdo

As imagens editoriais são referências visuais remotas do Unsplash e podem ser substituídas por fotos autorizadas da marca. Não são imagens reais de produtos NORTE®. Não publique itens com preço, guia de medidas, avaliação ou estoque sem fornecer os dados verdadeiros.

## Publicação

Pode ser hospedado na Vercel, Netlify ou outro host compatível com Vite. Configure variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` na hospedagem. A chave anon é pública por definição; a segurança depende de RLS. Nunca use `service_role` ou chave secreta do Stripe em variáveis `VITE_*`.
