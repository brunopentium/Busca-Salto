# Busca Salto - Admin e seguranca

Este documento registra a estrutura inicial para o painel privado do Busca Salto.

## Objetivo

Criar um webapp em `/admin` para gerenciar comercios, imagens e patrocinadores sem editar manualmente a planilha principal.

## Principios

- O frontend publico nunca recebe credenciais Google, tokens privados, senha ou segredo de sessao.
- Toda rota `/api/admin/*` deve exigir sessao valida antes de ler ou alterar dados.
- O painel deve usar cookie `HttpOnly`, `Secure` em producao e `SameSite=Strict`.
- Escrita na planilha deve preservar cabecalhos, IDs e linhas existentes.
- Alteracoes sensiveis devem continuar seguindo o processo de validacao comercial.
- Uploads devem aceitar apenas imagens, com limite de tamanho e validacao de MIME/extensao.
- Imagens destinadas ao site podem ficar publicas no Drive; evidencias e documentos de validacao devem ficar privados.

## Variaveis de ambiente previstas

Ja usadas:

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `GOOGLE_SHEETS_ID`
- `GOOGLE_SHEETS_TAB`

Previstas para o painel:

- `ADMIN_PASSWORD_HASH`: hash da senha do painel.
- `ADMIN_SESSION_SECRET`: segredo longo usado para assinar sessao.
- `ADMIN_COOKIE_NAME`: opcional, nome do cookie de sessao.
- `GOOGLE_DRIVE_IMAGES_FOLDER_ID`: pasta raiz das imagens publicas do site.
- `GOOGLE_DRIVE_BUSINESSES_FOLDER_ID`: subpasta para fotos de comercios.
- `GOOGLE_DRIVE_SPONSORS_FOLDER_ID`: subpasta para banners de patrocinadores.
- `GOOGLE_DRIVE_PENDING_FOLDER_ID`: subpasta temporaria para uploads ainda nao aprovados.

## Pastas criadas no Google Drive

Criadas em 16/06/2026:

- Raiz: `Busca Salto - Imagens`
  - ID: `18scb_k52bmcHyyz6WPnmzuy7S0N8mvb-`
  - URL: https://drive.google.com/drive/folders/18scb_k52bmcHyyz6WPnmzuy7S0N8mvb-
- Comercios:
  - ID: `1SI56xKqxzdxLEgu72Q1G-NL00LuOAPNA`
  - URL: https://drive.google.com/drive/folders/1SI56xKqxzdxLEgu72Q1G-NL00LuOAPNA
- Patrocinadores:
  - ID: `18rKSfu38PHR8NCda6j3V6BS99kuT9NU7`
  - URL: https://drive.google.com/drive/folders/18rKSfu38PHR8NCda6j3V6BS99kuT9NU7
- Temporarios/pendentes:
  - ID: `1ZWoxvbRLi0wN1utVI1KS4aZqW8CsfbCp`
  - URL: https://drive.google.com/drive/folders/1ZWoxvbRLi0wN1utVI1KS4aZqW8CsfbCp

Essas pastas permanecem privadas por padrao. O fluxo de upload deve publicar apenas os arquivos aprovados para exibicao no site.

## Estrutura tecnica inicial

- `api/_lib/google.js`: centraliza credenciais Google, escopos e clientes Sheets/Drive.
- `api/_lib/http.js`: centraliza respostas JSON, leitura segura de corpo e IP.
- `api/_lib/admin-auth.js`: valida senha hashada e assina sessao privada do painel.
- `api/admin/login.js`: cria sessao se a senha estiver correta.
- `api/admin/session.js`: valida sessao atual.
- `api/admin/logout.js`: encerra sessao.
- `api/admin/comercios.js`: lista, cria e edita comercios com dados completos somente para sessao admin.
- `api/admin/upload.js`: recebe imagem autenticada, valida tipo/tamanho, envia ao Google Drive e retorna URL publica do arquivo aprovado.
- `api/admin/patrocinadores.js`: cria, lista e edita banners de patrocinadores em aba propria da planilha.
- `api/patrocinadores.js`: API publica somente com patrocinadores ativos.
- `api/_lib/sponsors.js`: garante a aba `patrocinadores`, aplica cabecalhos e filtra periodo/status.
- `api/_lib/sheets-admin.js`: le e escreve na planilha com cabecalhos preservados e mapeia linhas para o painel.
- `admin.html`: tela inicial privada do painel.

As proximas rotas do admin devem importar esses modulos em vez de recriar acesso a credenciais.

## Geracao do hash da senha

Use o script local:

```powershell
node scripts/generate-admin-password-hash.js
```

O valor gerado deve ser configurado em `ADMIN_PASSWORD_HASH`. O segredo `ADMIN_SESSION_SECRET` deve ser uma string aleatoria longa, com pelo menos 32 caracteres.

## Upload de imagens

Limites iniciais:

- Tipos aceitos: JPEG, PNG e WebP.
- Tamanho maximo: 3 MB por imagem.
- Pasta padrao para fotos de comercio: `comercios`.
- O arquivo enviado e compartilhado como leitura publica para poder aparecer no site.

Depois de enviar a foto pelo painel, o campo `foto_url` e preenchido. Para a imagem aparecer no site publico, salvar o cadastro e usar plano que permita imagem.

O painel agora aceita ate 5 fotos por comercio:

- `foto_url`
- `foto_url_2`
- `foto_url_3`
- `foto_url_4`
- `foto_url_5`

O site publico continua usando a primeira foto como capa do card. As demais ficam registradas para galerias ou expansoes futuras. Remover uma foto no painel limpa o campo do cadastro; o arquivo enviado ao Drive pode permanecer na pasta publica.

## Patrocinadores

Os banners de patrocinadores ficam na aba `patrocinadores`, criada automaticamente quando o painel admin acessar a gestao pela primeira vez.

Cabecalhos:

- `id`
- `nome`
- `imagem_url`
- `link_url`
- `status`
- `ordem`
- `inicio`
- `fim`
- `texto_alt`
- `data_atualizacao`
- `imagem_desktop_2`
- `imagem_desktop_3`
- `imagem_desktop_4`
- `imagem_desktop_5`
- `imagem_mobile_1`
- `imagem_mobile_2`
- `imagem_mobile_3`
- `imagem_mobile_4`
- `imagem_mobile_5`

Somente registros com `status` ativo, imagem preenchida e dentro do periodo configurado aparecem na API publica e no carrossel do site.

O campo `imagem_url` permanece como o banner desktop principal por compatibilidade. Para patrocinadores, o painel permite ate 5 banners desktop (`imagem_url` + `imagem_desktop_2` a `imagem_desktop_5`) e ate 5 banners smartphone (`imagem_mobile_1` a `imagem_mobile_5`). No celular, o site usa os banners smartphone quando existirem; se nao existirem, usa os banners desktop.

Fotos e banners podem ter configuracao de enquadramento salva separadamente da URL. O admin grava modo de encaixe, zoom e posicao em campos de ajuste, preservando o arquivo original no Google Drive e permitindo reajuste posterior sem novo upload.

Excluir comercio ou patrocinador pelo painel marca a linha como `excluido`, sem apagar fisicamente a linha da planilha. Isso remove o item do site publico e preserva historico operacional.
