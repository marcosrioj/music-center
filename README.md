# MusicCenter

O MusicCenter reúne planos, escalas, repertório e partituras em uma interface para navegador, Android e iOS. O Supabase autentica os usuários e controla o acesso ao espaço de cada equipe. [Abrir painel de produção](https://musiccenter-painel.marcosli7.chatgpt.site)

## Desenvolver

Use Node.js 22.12 ou posterior e execute os comandos na raiz. O npm instala os três workspaces com um único lockfile.

```bash
npm ci
npm run dev
```

O Vite mostra o endereço do painel no terminal. Para conectar uma instalação nova ao seu Supabase, copie `.env.example` para `.env.local` na raiz e preencha a URL do projeto, a chave **publicável** e a origem do painel. O frontend e os aplicativos móveis leem essa configuração no build. [Modelo de configuração](.env.example)

Para trabalhar apenas no painel, `npm ci --workspace @musiccenter/web` instala as dependências web. Cada servidor de desenvolvimento gera o próprio `/musiccenter-config.json` a partir das variáveis daquela sessão. O build grava a configuração de distribuição em `apps/web/dist/`.

## Onde fazer cada mudança

| Para trabalhar em | Diretório | Responsabilidade |
| --- | --- | --- |
| Interface compartilhada | [apps/web](apps/web) | React, estilos, telas, cliente do Supabase e build do painel. |
| Android | [apps/mobile/android](apps/mobile/android) | Projeto Gradle, manifesto, recursos e integrações Android. |
| iPhone e iPad | [apps/mobile/ios](apps/mobile/ios) | Projeto Xcode, recursos e integrações iOS. |
| Integração com os aparelhos | [apps/mobile](apps/mobile) | Configuração do Capacitor, plugins nativos e sincronização da interface. |
| Dados, autenticação e permissões | [backend/supabase](backend/supabase) | Migrações SQL, políticas de acesso, Storage e Edge Functions. |
| Testes do backend | [backend/tests](backend/tests) | Testes de integração em uma instância local. Os [testes SQL](backend/supabase/tests) ficam junto das migrações. |
| Empacotamento | [scripts](scripts) | Geração dos ZIPs web e iOS. Os pacotes prontos ficam em [entrega](entrega). |

Em `apps/web/src/`, **domain/** define as regras de música e planejamento, e **application/** coordena os casos de uso. **data/** implementa o acesso ao Supabase e aos arquivos, e **platform/** integra os recursos do navegador e dos aparelhos. As telas em **features/** recebem esses serviços pela composição em **app/**. Web, Android e iOS usam a mesma implementação. [Arquitetura e fluxo de uma edição](docs/arquitetura.md)

Os pacotes originais usados como referência ficam em `references/apks/` na máquina de trabalho. O levantamento funcional está em [docs/recon.md](docs/recon.md).

## Comandos na raiz

| Comando | Resultado |
| --- | --- |
| `npm run dev` | Inicia o painel com recarga automática. |
| `npm run build` | Verifica TypeScript e gera `apps/web/dist/`. |
| `npm run sync` | Compila a interface e atualiza os projetos nativos. |
| `npm run android` ou `npm run ios` | Sincroniza e abre Android Studio ou Xcode. |
| `npm run apk` | Gera o APK de teste em `entrega/MusicCenter-Android.apk`. |
| `npm run package:web` ou `npm run package:ios` | Gera o ZIP correspondente em `entrega/`. Requer Python 3. |
| `npm run supabase -- status` | Executa a CLI Supabase no diretório do backend. |
| `npm test` | Verifica as fronteiras arquiteturais e executa os testes unitários dos clientes e do backend. |
| `npm run test:online` | Exercita contas, permissões e sincronização no Supabase local com as credenciais de teste. |

## Operação

O projeto Supabase de produção é **MusicCenter** (`qzxusoxbydbquaogoeib`). Todos os usuários entram com uma conta de e-mail confirmado. O remetente padrão entrega confirmações e recuperação de senha apenas a membros da organização no Supabase. Para atender outros endereços, o administrador precisa configurar SMTP próprio. [E-mail no Supabase](https://supabase.com/docs/guides/auth/auth-smtp)

- [Uso do painel e dos aplicativos](docs/uso.md)
- [Backend e regras de acesso](docs/backend.md)
- [Configuração, publicação e testes](docs/publicacao.md)
- [Matriz de funcionalidades](docs/features.csv)
