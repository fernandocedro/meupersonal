# Meu personal — Cloudflare e Android

O app servido em `public/` usa o Worker da Cloudflare como API e o D1 remoto como banco. A URL da API fica em `public/js/api-config.js`, compartilhada pelas páginas de login, treinos, mensagens e planos.

## Arquitetura
- Cloudflare Pages/Workers Assets: entrega dos arquivos HTML/CSS/JS.
- Cloudflare Workers: API do app.
- Cloudflare D1: usuários, treinos, exercícios, conclusões, perguntas/respostas, avisos, planos e compras.
- Cloudflare R2: recomendado para fotos e arquivos enviados.
- Gateway de pagamento: integração via Worker + webhook do provedor (não incluída/ativada nesta versão).

A Cloudflare documenta D1 como banco SQL serverless acessado pelo Worker por binding. Veja:
https://developers.cloudflare.com/d1/get-started/
https://developers.cloudflare.com/workers/wrangler/configuration/
https://developers.cloudflare.com/d1/reference/migrations/

## Desenvolvimento local
1. Instale Node.js LTS.
2. Abra esta pasta no VS Code.
3. No terminal execute `npm install`.
4. Crie a base: `npx wrangler d1 create meu-personal-db`.
5. Copie o `database_id` retornado para `wrangler.toml`.
6. Aplique o esquema local: `npm run db:migrate:local`.
7. Execute `npm run dev`.

## API online e Capacitor

- API publicada: `https://falling-art-9ea8.frcmxpx.workers.dev`.
- O painel de Gerenciar alunos exibe idade, altura, peso, IMC informativo, gráfico das medidas corporais atuais e respostas da avaliação. Para IMC por idade de 5 a 18 anos, usa as tabelas LMS de referência da OMS; a partir dos 19 anos usa os limites adultos. Medidas de membros e respostas de saúde não são usadas para diagnosticar obesidade. Fonte: https://www.who.int/tools/growth-reference-data-for-5to19-years/indicators/bmi-for-age
- O app usa essa URL absoluta, portanto as chamadas funcionam fora do Wrangler e no WebView do Capacitor.
- Para instalar como web app no Android, abra a URL no Chrome e toque em **Instalar aplicativo**. No iPhone, abra no Safari e use **Compartilhar → Adicionar à Tela de Início**. O nome e o ícone MP verde vêm do manifesto PWA.
- O manifesto PWA e os ícones ficam em `public/manifest.webmanifest` e `public/icons/`. O service worker guarda a estrutura da interface para abertura offline.
- Os dados já consultados são guardados no cache local do navegador, separado pelo ID da conta. Ao abrir uma tela, o app mostra o último cache e atualiza em segundo plano; senhas não são armazenadas no cache. Sem internet é possível consultar o que já foi carregado, mas criar, editar e excluir ainda exige conexão com a API.
- Para apontar para outro ambiente, altere `baseUrl` em `public/js/api-config.js`, gere/sincronize o app Capacitor e publique os assets/Worker com `npm run deploy`.
- O D1 remoto já recebeu as migrações anteriores. Após adicionar uma migração, aplique-a com `npm run db:migrate:remote`. O banco remoto está vazio de usuários; contas e dados do banco local não são sincronizados automaticamente.
- As rotas de usuários agora exigem sessão; alunos só consultam o próprio perfil e a equipe autenticada pode gerenciar alunos. Use somente dados de teste até proteger os demais endpoints de armazenamento com autenticação e autorização.

## Limitações antes do uso com dados reais
Esta versão é para desenvolvimento e teste, não para receber dados reais de alunos. Ainda é necessário implementar:
- Cadastro seguro e fluxo de convite/recuperação de senha para usuários.
- Completar autenticação e autorização nas demais rotas de armazenamento, incluindo treinos, exercícios e mensagens. As rotas de usuários já exigem sessão.
- Integração real de checkout e webhook assinado do gateway. Só o webhook validado deve mudar uma compra para `paid` e liberar o pacote.
- Upload de fotos para R2 com validação de tipo/tamanho e URLs controladas.
- Notificações push: requer service worker, permissão no dispositivo, armazenamento de subscriptions e envio Web Push. A tela de avisos já tem estrutura de dados e API, mas não envia push nesta versão.
- Rate limiting, proteção contra abuso, logs, backups, política de privacidade e revisão de segurança.

## Criar o primeiro usuário professor
Não insira senha em texto puro no D1. Gere um hash PBKDF2 no backend/ambiente seguro, no formato `pbkdf2$ITERATIONS$SALT_HEX$HASH_HEX`, e insira esse hash na coluna `password_hash`. Não publique nem compartilhe o hash ou senha inicial.
