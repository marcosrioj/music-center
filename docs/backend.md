# Backend online do MusicCenter

A interface compartilhada pelo painel web e pelos aplicativos usa o SDK oficial do Supabase. O endpoint do projeto e a chave publicável identificam o serviço. A sessão do Supabase Auth identifica o usuário em cada operação.

| Recurso | Quem acessa | Persistência |
| --- | --- | --- |
| Espaço, roteiro, escala e repertório | Administrador edita, membros aceitos consultam | PostgreSQL, RPCs autenticadas e revisão otimista por espaço |
| Convites e membros | Administrador gera ou revoga convites e remove integrantes. Uma conta autenticada aceita o convite | Tokens aleatórios armazenados como digest e vínculos por ID da conta |
| PDFs | Administrador envia. Membros podem baixar os PDFs vinculados às músicas do seu espaço | Bucket privado com RLS, prefixo por espaço e limite de 50 MiB por arquivo |
| Notas pessoais | Somente o titular logado e integrante do espaço | Tabela privada, gravada com comparação de versão do texto |
| Exclusão de conta | O próprio titular | Edge Function verifica o token no Auth, bloqueia novos envios, limpa os PDFs dos espaços administrados e exclui a identidade |

O schema `public` contém as seis tabelas do MusicCenter. Todas usam RLS e os aplicativos acessam os dados pelas RPCs. No Table Editor, abra `public.spaces` para consultar o campo `workspace`, que contém os planos e as músicas. As funções auxiliares ficam em `mc_private`. As operações expostas verificam a identidade e o papel do usuário. A importação do acervo local ocorre por opção do administrador em um espaço vazio. O aplicativo publica a revisão nova após a confirmação pelo servidor. PDFs enviados por uma operação que falhou passam por limpeza. Um PDF já referenciado é protegido pelas políticas da equipe.

A chave de serviço é necessária na Edge Function e nos testes de integração isolados. O frontend usa a chave pública. O Supabase aplica seus limites de Auth. A migração limita o tamanho do conteúdo e a quantidade de integrantes, convites e espaços. A política de backup e a entrega de e-mails pertencem ao projeto de hospedagem escolhido.

As duas sessões de navegador foram testadas com contas distintas em uma instância de desenvolvimento real de Auth, PostgreSQL, PostgREST e Storage. Os testes exercitaram cadastro, login, proteção de dados, convite, edição concorrente, sincronização de planos, leitura de PDF e remoção de acesso. A publicação pode usar o plano Free. [Documentação do Supabase](https://supabase.com/docs)

## Arquivos e testes

A [configuração da CLI](../backend/supabase/config.toml), as [migrações PostgreSQL](../backend/supabase/migrations/) e a [função de exclusão de conta](../backend/supabase/functions/delete-account/index.ts) ficam em `backend/supabase/`. Na raiz do repositório, passe `--workdir backend` aos comandos da CLI.

O [teste de integração](../backend/tests/online.mjs) usa uma instância Supabase local. Com as variáveis `API_URL`, `ANON_KEY` e `SERVICE_ROLE_KEY` dessa instância exportadas, execute `npm run test:online` na raiz. O [teste SQL](../backend/supabase/tests/workspace.sql) exercita as políticas de acesso em uma transação revertida ao final.
