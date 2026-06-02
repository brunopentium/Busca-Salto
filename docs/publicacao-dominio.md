# Busca Salto - Publicacao, dominio e medicao

## Dominio `buscasalto.com`

Status tecnico: o site esta preparado para rodar na Vercel. Em 02/06/2026, os dominios `buscasalto.com` e `www.buscasalto.com` foram adicionados ao projeto `busca-salto` na Vercel. A configuracao ainda aparece como invalida porque depende dos registros DNS no registrador do dominio.

Procedimento:

1. Na Vercel, abrir o projeto `busca-salto`.
2. Entrar em `Settings` > `Domains`.
3. Confirmar que `buscasalto.com` e `www.buscasalto.com` continuam listados.
4. No registrador do dominio, configurar os DNS conforme a Vercel indicou.

Configuracao exigida pela Vercel em 02/06/2026:

- Apex/root `buscasalto.com`: registro `A`, nome `@`, valor `216.198.79.1`.
- `www.buscasalto.com`: registro `CNAME`, nome `www`, valor `aa69eb81b66503f9.vercel-dns-017.com.`.

Confirmar sempre no painel da Vercel, pois o valor exibido ali prevalece.

## HTTPS

A Vercel emite certificado HTTPS automaticamente depois que o dominio aponta corretamente para ela.

Validacao:

1. Abrir `https://buscasalto.com`.
2. Confirmar se carrega sem alerta de certificado.
3. Abrir `http://buscasalto.com`.
4. Confirmar se redireciona para HTTPS.
5. Repetir para `https://www.buscasalto.com`.

Se o certificado ainda nao estiver ativo, aguardar propagacao DNS e revalidar no painel da Vercel.

## Google Search Console

Procedimento recomendado:

1. Abrir Google Search Console.
2. Adicionar propriedade do tipo `Domínio`: `buscasalto.com`.
3. Seguir a verificacao por DNS TXT indicada pelo Google.
4. Apos verificar, enviar o sitemap:
   - `https://buscasalto.com/sitemap.xml`
5. Enquanto o dominio final nao estiver ativo, usar temporariamente:
   - `https://busca-salto.vercel.app/sitemap.xml`

## Medicao de buscas e acessos

O projeto possui medicao inicial por logs da Vercel via `/api/metricas`.

Eventos registrados:

- `page_view`: acesso a pagina.
- `search`: busca ou filtro executado.
- `category_select`: categoria/subcategoria selecionada.
- `contact_click`: clique em WhatsApp, telefone, Instagram, Facebook ou site.
- `plan_click`: clique em plano na pagina de comerciantes.

Como consultar:

1. Abrir Vercel > projeto `busca-salto`.
2. Entrar em Logs ou Observability.
3. Filtrar por `busca-salto-metricas`.
4. Filtrar por `event` para analisar buscas, contatos e interesse comercial.

Evolucao futura:

- ativar Vercel Web Analytics se desejar dashboard visual;
- integrar Google Analytics/Tag Manager se o projeto precisar de relatorios de marketing;
- salvar eventos em banco proprio se for necessario historico detalhado fora dos logs.
