# Publicação no Vercel

## Preparar a base de dados

1. Crie uma base PostgreSQL no Neon e copie a connection string com SSL.
2. Se precisar de manter os dados locais, configure `DATABASE_URL` e execute `npm run migrate:sqlite` numa base Neon vazia. O script importa os dados de `database/bugbusters.db` e recusa uma base que já contenha registos.
3. Execute `npm run seed` para criar a conta de administrador e os dados iniciais. Defina antes `ADMIN_EMAIL` e `ADMIN_PASSWORD`; a palavra-passe deve ter pelo menos 12 caracteres.
4. Se não precisar dos dados locais, execute apenas o seed na base Neon vazia.

Ao migrar, as contas e palavras-passe existentes são preservadas. `ADMIN_PASSWORD` só define a palavra-passe de uma conta nova; para utilizadores migrados, use a palavra-passe existente.

## Configurar o projeto

1. Importe o repositório no Vercel com a raiz do projeto como diretório raiz.
2. Em **Settings → Environment Variables**, adicione:
   - `DATABASE_URL`: connection string PostgreSQL do Neon.
   - `SESSION_SECRET`: valor aleatório com pelo menos 32 caracteres.
   - `PUBLIC_SITE_URL`: URL HTTPS do domínio público do Vercel.
   - `ADMIN_EMAIL` e `ADMIN_PASSWORD`: credenciais iniciais do administrador.
   - `COMPANY_WHATSAPP`, `COMPANY_LINKEDIN` e `COMPANY_EMAIL`.
3. Adicione as variáveis aos ambientes que pretende usar e faça deploy.

O esquema PostgreSQL e a tabela de sessões são criados na primeira chamada à API. As sessões são guardadas no PostgreSQL e não dependem da memória ou do disco temporário das funções.

## Desenvolvimento local

Copie `.env.example` para `.env`, substitua todos os valores de exemplo e use a connection string do Neon. O `.env` está excluído do Git.

Se uma connection string real foi incluída anteriormente em ficheiros partilhados ou publicados, substitua a credencial no Neon antes de publicar.
