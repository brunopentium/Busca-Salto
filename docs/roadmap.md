# Busca Salto - Roadmap Tecnico

Este arquivo concentra anotacoes tecnicas do projeto para nao depender apenas do historico do chat.

## Estado atual

- Site publicado na Vercel: https://busca-salto.vercel.app/
- Repositorio GitHub: brunopentium/Busca-Salto
- Banco principal em Google Sheets privado.
- API em Vercel Serverless Function: `api/comercios.js`.
- Frontend principal: `index.html`.
- O site nao consulta mais CSV publico do Google Sheets.
- A API le a planilha privada via service account e variaveis de ambiente da Vercel.
- A listagem nao entrega contatos diretamente (`whatsapp`, `telefone`, `instagram`, `facebook`, `site`).
- A listagem entrega apenas flags `has_whatsapp`, `has_telefone`, `has_instagram`, `has_facebook`, `has_site`.
- Os contatos sao buscados sob demanda via `mode=contact` quando o usuario clica no botao.
- A home retorna apenas a primeira pagina e nao libera carregamento infinito sem busca/filtro.
- Com busca/filtro, a API ainda permite paginacao.
- HTTPS ativo no dominio Vercel; HTTP redireciona para HTTPS.

## Decisoes tecnicas

- Manter a planilha o mais completa possivel.
- Controlar exibicao no site/API por plano, nao removendo dados da base.
- Contatos basicos podem continuar disponiveis para gratuitos para preservar utilidade do site.
- Monetizacao deve focar em prioridade, imagem, destaque visual, oferta e posicao.
- Parceiros devem poder ter imagem para melhorar o visual geral do site.
- Gratuitos devem ter ordenacao aleatoria entre si a cada nova pesquisa/carregamento.

## Pendencias tecnicas

### Seguranca

- [ ] Adicionar limite simples de chamadas na API.
- [ ] Reduzir raspagem massiva por paginacao sequencial.
- [ ] Definir no codigo quais recursos cada plano pode exibir.
- [ ] Revisar se a planilha antiga/publicada foi despublicada no Google Sheets.
- [ ] Revisar headers de cache e comportamento da API.

### Dados

- [ ] Revisar padronizacao de categorias e subcategorias.
- [ ] Revisar campos vazios, `nao confirmado` e inconsistencias de bairros.
- [ ] Definir quais colunas sao internas e quais podem ir para resposta publica.

### Site

- [ ] Testar layout em celular.
- [ ] Melhorar busca para acentos, plurais e erros comuns.
- [ ] Validar botoes de WhatsApp, telefone, Instagram, Facebook, site e endereco em desktop e celular.
- [ ] Implementar ordenacao: Top > Destaque > Parceiro > Gratuito aleatorio.
- [ ] Melhorar fluxo `Sou responsavel por este comercio`.
- [ ] Melhorar visual, layout, imagens e acabamento geral.

### Publicacao

- [ ] Configurar dominio `buscasalto.com` na Vercel.
- [ ] Apontar DNS do dominio para Vercel.
- [ ] Validar HTTPS no dominio final.
- [ ] Configurar Google Search Console.
- [ ] Configurar Analytics/medicao de buscas e acessos.

### Operacao

- [ ] Definir rotina de backup da planilha.
- [ ] Definir processo de restauracao.
- [ ] Documentar como atualizar a planilha sem quebrar o site.
- [ ] Criar checklist de publicacao.
- [ ] Monitorar erros na Vercel.

## Implementacoes feitas

- Criada API `/api/comercios` com leitura privada do Google Sheets.
- Removida dependencia de CSV publico no frontend.
- Criado modo `filters` para carregar categorias e bairros.
- Criado modo `contact` para buscar contato individual por clique.
- Ajustado frontend para renderizar botoes de contato sem expor dados na listagem.
- Corrigido comportamento de popup para contatos abrirem com URL correta.
- Adicionado fallback de ID na API quando a coluna `ID` nao estiver disponivel.
