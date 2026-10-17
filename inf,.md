# Bug Busters — Plataforma Completa

Sistema de apresentação, captação e gestão de solicitações de projectos da Bug Busters.

## Stack

- **Frontend:** HTML, CSS, JavaScript (vanilla, responsivo)
- **Backend:** Node.js + Express
- **Base de dados:** SQLite (via `better-sqlite3`) — facilmente migrável para PostgreSQL
- **Autenticação:** Sessões com cookies HttpOnly + bcrypt

## Instalação

```bash
npm install
cp .env.example .env      # editar com dados reais
npm run seed              # cria admin + dados de exemplo
npm start
```

Aceder: http://localhost:3000

## Credenciais iniciais

- **E-mail:** admin@bugbusters.ao
- **Palavra-passe:** ChangeMe!2026
- **Painel:** http://localhost:3000/login.html

> ⚠️ Altere a palavra-passe imediatamente após o primeiro login.

## Funcionalidades

### Público
- Página inicial com apresentação, serviços, portfólio e equipa
- Páginas dedicadas: Serviços, Equipa, Portfólio, Contactos, Privacidade
- Formulário de solicitação em 3 etapas (dados pessoais → projecto → revisão)
- Geração de referência única (`BB-AAAA-NNNN`)
- Página de confirmação com botão de continuação para WhatsApp

### Painel Administrativo
- Login seguro com sessão
- Dashboard com indicadores
- Lista de solicitações com filtros (estado, tipo, pesquisa)
- Ficha detalhada com gestão de estado, prioridade e comentários
- Histórico de alterações por pedido
- Gestão de clientes
- Auditoria de operações
- Configurações da empresa (WhatsApp, LinkedIn, e-mail)

### Segurança
- Cookies HttpOnly, SameSite=Lax, Secure em produção
- Rate limiting no login e na submissão
- bcrypt para palavras-passe
- Mensagens genéricas no login (não revela existência de e-mail)
- CSRF implícito via SameSite
- Helmet para headers HTTP
- Auditoria de operações sensíveis
- Regras de integridade na base de dados

## API

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/v1/services` | Serviços activos |
| GET | `/api/v1/team` | Equipa publicada |
| GET | `/api/v1/portfolio` | Portfólio público |
| GET | `/api/v1/settings` | Configurações públicas |
| POST | `/api/v1/requests` | Submissão de solicitação |
| GET | `/api/v1/requests/confirmation/:token` | Confirmação |
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/logout` | Logout |
| GET | `/api/v1/auth/me` | Sessão actual |
| GET | `/api/v1/admin/dashboard` | Indicadores |
| GET | `/api/v1/admin/requests` | Listar pedidos |
| GET | `/api/v1/admin/requests/:id` | Detalhe |
| PATCH | `/api/v1/admin/requests/:id` | Actualizar |
| GET | `/api/v1/admin/requests/:id/history` | Histórico |
| GET | `/api/v1/admin/clients` | Clientes |
| GET | `/api/v1/admin/audit` | Auditoria |
| GET/PATCH | `/api/v1/admin/settings` | Configurações |

## Migrar para PostgreSQL

1. `npm install pg`
2. Substituir `database/db.js` por uma ligação `pg.Pool`
3. Converter as queries SQLite (`?`) para PostgreSQL (`$1`, `$2`...)
4. Ajustar `AUTOINCREMENT` → `SERIAL` e `datetime('now')` → `NOW()`
5. As regras de negócio e os endpoints permanecem inalterados

## Estrutura

```
bug-busters/
├── server.js
├── database/       # db.js, seed.js
├── middleware/     # auth.js
├── routes/         # auth.js, public.js, admin.js
└── public/         # HTML, CSS, JS do cliente
```

## Próximos passos

- Upload de anexos (multer + validação de tipo/tamanho)
- Exportação CSV de solicitações
- Notificações por e-mail
- Testes automatizados (Jest + Supertest)
- Dockerização (`compose.yaml`)
- Migração para PostgreSQL em produção