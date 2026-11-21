# Arquitetura do MusicCenter

Web, Android e iOS executam o mesmo domínio e os mesmos casos de uso. O navegador monta a interface React diretamente. Android e iOS hospedam essa interface com o Capacitor. Os projetos Gradle e Xcode cuidam da inicialização, do ciclo de vida e dos recursos de cada plataforma.

## Como uma alteração de plano chega ao banco

1. A tela entrega o plano editado à sessão do espaço.
2. `WorkspaceSession.savePlan` verifica o papel do usuário, o espaço ativo e a revisão da edição. A fila da sessão serializa gravações. As notas particulares são removidas da cópia compartilhada.
3. O repositório Supabase transmite o plano e a revisão esperada para a RPC. O PostgreSQL verifica a identidade e as permissões e decide se aceita a gravação.
4. A sessão aplica a revisão confirmada, combina o resultado com as notas do usuário e notifica a interface. Em caso de conflito, ela busca a revisão do servidor.

## Onde implementar

| Camada | Responsabilidade | Exemplo |
| --- | --- | --- |
| [Domínio](../apps/web/src/domain) | Tipos e operações puras de música e planejamento | Transpor acordes, ordenar planos e separar anotações |
| [Aplicação](../apps/web/src/application) | Casos de uso e contratos para os recursos que eles precisam | Editar um espaço, importar acervo com rollback, recuperar uma sessão |
| [Dados](../apps/web/src/data) | Implementações para Auth, banco, Storage e acervo legado | Traduzir uma operação de edição para a RPC e seus erros |
| [Plataforma](../apps/web/src/platform) | Integrações com o navegador e com os plugins dos aparelhos | Retorno do link de confirmação, botão Voltar e compartilhamento |
| [Apresentação](../apps/web/src/features) | Formulários, navegação das telas e renderização | Exibir o repertório ou uma página do PDF |
| [Composição](../apps/web/src/app/runtime.ts) | Escolher as implementações e entregá-las aos componentes | Montar autenticação e serviços do espaço depois de validar o painel |

Ao incluir uma operação que depende de dados externos, defina o contrato conforme a necessidade do caso de uso. Implemente-o no adaptador correspondente e faça a ligação na composição. Os testes podem fornecer uma implementação em memória do mesmo contrato.

## Backend

A função [delete-account](../backend/supabase/functions/delete-account) tem seu próprio ponto de composição em `index.ts`. O controlador HTTP interpreta o método e a autorização. O caso de uso verifica a identidade, prepara os espaços, solicita a remoção dos PDFs e só então manda excluir a conta. O adaptador implementa essas operações com o Supabase. Uma falha na limpeza interrompe a exclusão da identidade, permitindo repetir a operação.

As [migrações SQL](../backend/supabase/migrations) mantêm a autorização e a concorrência no servidor. Essas verificações também valem para chamadas diretas à API.

## Verificação

Na raiz, `npm test` verifica as dependências entre camadas e roda os testes unitários da aplicação compartilhada e da Edge Function. `npm run check:architecture` executa apenas a verificação de fronteiras. Para testar as políticas reais de banco e Storage, use `npm run test:online` com a instância de homologação local descrita no [guia de testes](publicacao.md).
