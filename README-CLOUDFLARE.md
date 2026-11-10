# Meu personal — base Cloudflare

Este pacote adiciona a estrutura Cloudflare ao protótipo: página pública de compra/planos, API Worker e esquema Cloudflare D1.

## Arquitetura
- Cloudflare Pages/Workers Assets: entrega dos arquivos HTML/CSS/JS.
- Cloudflare Workers: API privada; valida sessão e permissões.
- Cloudflare D1: usuários, treinos, exercícios, conclusões, perguntas/respostas, avisos, planos e compras.
- Cloudflare R2: recomendado para fotos e arquivos enviados.
- Gateway de pagamento: integração via Worker + webhook do provedor (não incluída/ativada nesta versão).

A Cloudflare documenta D1 como banco SQL serverless acessado pelo Worker por binding. Veja:
https://developers.cloudflare.com/d1/get-started/
https://developers.cloudflare.com/workers/wrangler/configuration/
https://developers.cloudflare.com/d1/reference/migrations/

## Rodar no VS Code
1. Instale Node.js LTS.
2. Abra esta pasta no VS Code.
3. No terminal execute `npm install`.
4. Crie a base: `npx wrangler d1 create meu-personal-db`.
5. Copie o `database_id` retornado para `wrangler.toml`.
6. Aplique o esquema local: `npm run db:migrate:local`.
7. Execute `npm run dev`.

Para produção, crie e migre a base remota com `npm run db:migrate:remote` e publique com `npm run deploy`.

## O que esta base API já demonstra
- Endpoint público para listar planos ativos.
- Login com verificação PBKDF2 e sessão opaca armazenada como hash no D1.
- Endpoints autenticados de treinos, perguntas/respostas e avisos.
- Aluno só consulta suas próprias perguntas e seus próprios treinos.
- Professor/admin pode responder perguntas e publicar avisos gerais.
- A resposta fica vinculada à pergunta e só é retornada ao aluno dono dela.

## Ainda precisa ser ligado antes de uso real
Este pacote é uma base de desenvolvimento, não uma plataforma pronta para receber clientes. A tela de compra lista planos, mas não cobra ainda. É necessário implementar:
- Cadastro seguro e fluxo de convite/recuperação de senha para usuários.
- Rotas completas de gestão de alunos e exercícios, edição/exclusão, e conclusão de treino.
- Integração real de checkout e webhook assinado do gateway. Só o webhook validado deve mudar uma compra para `paid` e liberar o pacote.
- Front-end do professor e do aluno consumindo a API (a UI antiga do protótipo ainda usa localStorage e não está conectada automaticamente a esta API).
- Upload de fotos para R2 com validação de tipo/tamanho e URLs controladas.
- Notificações push: requer service worker, permissão no dispositivo, armazenamento de subscriptions e envio Web Push. A tela de avisos já tem estrutura de dados e API, mas não envia push nesta versão.
- Rate limiting, proteção contra abuso, logs, backups, política de privacidade e revisão de segurança.

## Criar o primeiro usuário professor
Não insira senha em texto puro no D1. Gere um hash PBKDF2 no backend/ambiente seguro, no formato `pbkdf2$ITERATIONS$SALT_HEX$HASH_HEX`, e insira esse hash na coluna `password_hash`. Não publique nem compartilhe o hash ou senha inicial.
