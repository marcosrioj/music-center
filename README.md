# MusicCenter

O MusicCenter reúne painel web, Android e iOS. **Todo usuário precisa entrar com sua própria conta.** O Supabase autentica as pessoas e armazena os planos, as escalas, o repertório, as anotações e as partituras. Uma instalação nova abre o fluxo de acesso.

O [painel de produção](https://musiccenter-painel.marcosli7.chatgpt.site) e os pacotes em `entrega/` usam o projeto Supabase **MusicCenter** (`qzxusoxbydbquaogoeib`). A página de login aceita visitantes com o link. O acesso aos espaços exige uma conta com e-mail confirmado.

O MusicCenter usa o serviço de e-mail padrão do Supabase. Ele envia confirmações de cadastro e links de recuperação de senha somente aos endereços dos membros da organização no Supabase. Músicos com outros endereços precisam de um remetente SMTP próprio configurado no projeto para receber essas mensagens. [Documentação de e-mail do Supabase](https://supabase.com/docs/guides/auth/auth-smtp)

## Usar o painel e os aplicativos

1. Abra o painel web ou o aplicativo, toque em **Criar conta** e cadastre e-mail e senha. Na versão publicada, confirme o cadastro abrindo o link no mesmo navegador ou aparelho em que iniciou o cadastro.
2. Depois de entrar, **crie um espaço** para administrar uma equipe ou **aceite o convite** de um espaço existente. Cada espaço tem um administrador. Uma conta pode participar de vários espaços.
3. Em **Repertório**, cadastre a música, a cifra, o tom, o andamento e o PDF. Em **Planos**, organize o roteiro, as durações e a escala. Os membros acompanham as mudanças no navegador ou no aplicativo.
4. Em **Gestão**, gere um convite e compartilhe o link ou o código. A pessoa precisa entrar e aceitar antes de consultar o conteúdo. O administrador também pode revogar convites e remover integrantes.
5. Em **Estante**, abra as músicas na ordem do plano, consulte o PDF, transponha a cifra de texto ou ligue o metrônomo. **Minhas anotações** acompanha sua conta e só é visível para você. Para excluir a própria conta, use o controle na seleção de espaços.

A interface verifica alterações a cada 12 segundos enquanto está visível e ao recuperar o foco. Uma edição concorrente gera um aviso para revisar os dados atuais. A abertura do espaço, a leitura de novos PDFs e o salvamento exigem conexão.

### Atualizar a versão local anterior

Atualize o aplicativo mantendo seus dados instalados. Entre e crie um espaço com a opção de importar o acervo do aparelho, ou use a importação em **Gestão** de um espaço vazio. A importação envia planos, escala, músicas e PDFs e associa suas notas à sua conta. Os arquivos antigos continuam disponíveis no aparelho. A transferência de um único plano por arquivo também continua disponível para o administrador.

## Publicar com Supabase Free

1. Use um projeto dedicado no plano Free da sua organização. A aplicação utiliza Supabase Auth, PostgreSQL, Storage e a Edge Function de exclusão de conta. Consulte as cotas de banco, arquivos, tráfego e pausa por inatividade. [Plano Free](https://supabase.com/pricing)
2. Com a CLI Supabase 3 autenticada, execute os comandos abaixo a partir da raiz do repositório. Substitua `REFERENCIA_DO_PROJETO` pela referência do seu projeto. As migrações criam as tabelas, as políticas e o bucket privado `musiccenter-scores`.

   ```bash
   supabase link --project-ref REFERENCIA_DO_PROJETO
   supabase db push --remote --dry-run
   supabase db push --remote
   supabase functions deploy delete-account --use-api
   ```

3. Em **Authentication**, ative e-mail e senha, permita cadastro, mantenha o login anônimo desligado e defina a política de confirmação de e-mail. Em **URL Configuration**, defina **Site URL** como a origem HTTPS do painel e cadastre essa origem e `app.musiccenter.mobile://auth/callback` entre os redirecionamentos permitidos. Para entregar confirmações e recuperação de senha aos usuários finais, configure o remetente SMTP da equipe. O SMTP padrão do Supabase restringe o envio aos endereços da organização do projeto. [Redirecionamentos](https://supabase.com/docs/guides/auth/redirect-urls) · [SMTP no Supabase](https://supabase.com/docs/guides/auth/auth-smtp)
4. Copie [o modelo de configuração](.env.example) para `.env.local`. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` com a URL e a chave **publishable** do projeto. `VITE_PUBLIC_WEB_URL` é a origem HTTPS do painel, por exemplo `https://musica.suaigreja.org`. No frontend, use somente a chave publicável ou a chave legada de papel `anon`. A chave de serviço fica no ambiente da função do Supabase.

### Web

Instale Node.js 22.12 ou posterior, execute `npm ci` e `npm run build`, e publique o **conteúdo de dist/** na raiz de uma hospedagem estática HTTPS. O painel funciona com navegação por fragmentos, inclusive nas URLs de convite. Para desenvolvimento, `npm run dev` inicia o Vite.

O [pacote web](entrega/MusicCenter-Web.zip) também pode ser extraído diretamente na hospedagem. O pacote entregue já aponta para o MusicCenter. Para uma hospedagem própria, recompile a partir da configuração desejada ou gere o pacote genérico sem variáveis `VITE_` e preencha `musiccenter-config.json` na raiz do site com os campos abaixo. O aplicativo móvel genérico lê esse mesmo arquivo ao conectar ao painel.

```json
{
  "url": "https://REFERENCIA_DO_PROJETO.supabase.co",
  "key": "CHAVE_PUBLICAVEL_DO_PROJETO",
  "webUrl": "https://musica.suaigreja.org"
}
```

### Android e iOS

- [Instalador Android de teste](entrega/MusicCenter-Android.apk). O instalador entregue abre o login do projeto MusicCenter. Uma compilação genérica pede o endereço HTTPS do painel no primeiro uso. Para compilar já conectado ao seu projeto, preencha `.env.local` e execute `npm run apk` com JDK 21 e Android SDK 36.
- [Projeto iPhone e iPad](entrega/MusicCenter-iOS.zip). Extraia o ZIP inteiro em um Mac e abra `ios/App/App.xcodeproj` no Xcode 26 ou posterior. Selecione o esquema **App**. Para aparelho físico, configure a equipe em **Signing & Capabilities**. O alvo mínimo é iOS 16.4. O pacote inclui interface compilada e plugins Swift locais. A assinatura e o teste nativo em dispositivo Apple exigem macOS com Xcode.

### Testar as regras de acesso

O [teste de integração](scripts/test-online.mjs) usa uma pilha de desenvolvimento do Supabase em loopback e descarta as contas e arquivos sintéticos ao terminar. Passe ao processo `API_URL`, `PUBLISHABLE_KEY` (ou `ANON_KEY`) e `SERVICE_ROLE_KEY` (ou `SECRET_KEY`) exportados pela CLI **local** e execute `npm run test:online`. As credenciais administrativas de teste ficam fora do frontend. Os testes SQL estão em [supabase/tests](supabase/tests).

[Backend e modelo de acesso](replica/backend.md) · [Mapa funcional](replica/recon.md) · [Matriz de recursos](replica/features.csv)
