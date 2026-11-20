# Publicação e configuração do MusicCenter

1. Use um projeto dedicado no plano Free da sua organização. A aplicação utiliza Supabase Auth, PostgreSQL, Storage e a Edge Function de exclusão de conta. Consulte as cotas de banco, arquivos, tráfego e pausa por inatividade. [Plano Free](https://supabase.com/pricing)
2. Com a CLI Supabase 3 autenticada, execute os comandos abaixo a partir da raiz do repositório. Substitua `REFERENCIA_DO_PROJETO` pela referência do seu projeto. As migrações criam as tabelas, as políticas e o bucket privado `musiccenter-scores`.

   ```bash
   npm run supabase -- link --project-ref REFERENCIA_DO_PROJETO
   npm run supabase -- db push --remote --dry-run
   npm run supabase -- db push --remote
   npm run supabase -- functions deploy delete-account --use-api
   ```

3. Em **Authentication**, ative e-mail e senha, permita cadastro, mantenha o login anônimo desligado e defina a política de confirmação de e-mail. Em **URL Configuration**, defina **Site URL** como a origem HTTPS do painel e cadastre essa origem e `app.musiccenter.mobile://auth/callback` entre os redirecionamentos permitidos. Para entregar confirmações e recuperação de senha aos usuários finais, configure o remetente SMTP da equipe. O SMTP padrão do Supabase restringe o envio aos endereços da organização do projeto. [Redirecionamentos](https://supabase.com/docs/guides/auth/redirect-urls) · [SMTP no Supabase](https://supabase.com/docs/guides/auth/auth-smtp)
4. Copie [o modelo de configuração](../.env.example) para `.env.local`. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` com a URL e a chave **publishable** do projeto. `VITE_PUBLIC_WEB_URL` é a origem HTTPS do painel, por exemplo `https://musica.suaigreja.org`. No frontend, use somente a chave publicável ou a chave legada de papel `anon`. A chave de serviço fica no ambiente da função do Supabase.

## Web

Instale Node.js 22.12 ou posterior, execute `npm ci` e `npm run build`, e publique o **conteúdo de apps/web/dist/** na raiz de uma hospedagem estática HTTPS. O painel funciona com navegação por fragmentos, inclusive nas URLs de convite. Para desenvolvimento, `npm run dev` inicia o Vite.

O [pacote web](../entrega/MusicCenter-Web.zip) também pode ser extraído diretamente na hospedagem. O pacote entregue já aponta para o MusicCenter. Para uma hospedagem própria, recompile a partir da configuração desejada ou gere o pacote genérico sem variáveis `VITE_` e preencha `musiccenter-config.json` na raiz do site com os campos abaixo. O aplicativo móvel genérico lê esse mesmo arquivo ao conectar ao painel.

```json
{
  "url": "https://REFERENCIA_DO_PROJETO.supabase.co",
  "key": "CHAVE_PUBLICAVEL_DO_PROJETO",
  "webUrl": "https://musica.suaigreja.org"
}
```

## Publicação no Sites

O [manifesto do painel](../apps/web/.openai/hosting.json) identifica o site de produção e declara a pasta estática `dist`. Para uma nova versão, compile na raiz com `npm run build` e use o conteúdo de `apps/web/dist/` como a pasta `dist/` do checkout de publicação do Sites. O serviço usa esse checkout para versionar e publicar. A interface é mantida em `apps/web/src/`.

## Android e iOS

- [Instalador Android de teste](../entrega/MusicCenter-Android.apk). O instalador entregue abre o login do projeto MusicCenter. Uma compilação genérica pede o endereço HTTPS do painel no primeiro uso. Para compilar já conectado ao seu projeto, preencha `.env.local` e execute `npm run apk` com JDK 21 e Android SDK 36.
- [Projeto iPhone e iPad](../entrega/MusicCenter-iOS.zip). Extraia o ZIP inteiro em um Mac e abra `apps/mobile/ios/App/App.xcodeproj` no Xcode 26 ou posterior. Selecione o esquema **App**. Para aparelho físico, configure a equipe em **Signing & Capabilities**. O alvo mínimo é iOS 16.4. O pacote inclui interface compilada e plugins Swift locais. A assinatura e o teste nativo em dispositivo Apple exigem macOS com Xcode.

## Testar as regras de acesso

O [teste de integração](../backend/tests/online.mjs) usa uma pilha de desenvolvimento do Supabase em loopback e descarta as contas e arquivos sintéticos ao terminar. Passe ao processo `API_URL`, `PUBLISHABLE_KEY` (ou `ANON_KEY`) e `SERVICE_ROLE_KEY` (ou `SECRET_KEY`) exportados pela CLI **local** e execute `npm run test:online`. As credenciais administrativas de teste ficam fora do frontend. Os testes SQL estão em [backend/supabase/tests](../backend/supabase/tests).
