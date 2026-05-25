# Busca Salto - Roadmap Tecnico

Este arquivo concentra as anotacoes tecnicas e o checklist operacional do projeto. Ele deve funcionar como trilho de execucao para o Codex, enquanto o Documento Mestre no Google Drive permanece como fonte principal de decisao estrategica e comercial.

## Referencias principais

- Site publicado: https://busca-salto.vercel.app/
- Repositorio GitHub: `brunopentium/Busca-Salto`
- Frontend principal: `index.html`
- API principal: `api/comercios.js`
- Documento Mestre: `Busca Salto - Documento Mestre do Projeto`, no Google Drive
- Banco principal: Google Sheets privado lido via API
- Backup inicial da base: https://docs.google.com/spreadsheets/d/1nE_0sRJf1bRdjAHjjtHsEZJVrH7AVKzRMeVso0HsIUc/edit

## Estado atual

- Site publicado na Vercel.
- HTTPS ativo no dominio Vercel; HTTP redireciona para HTTPS.
- A base principal esta em Google Sheets privado.
- O site nao consulta mais CSV publico do Google Sheets.
- A publicacao antiga da planilha via link CSV foi interrompida e passou a retornar 401.
- Primeira copia de seguranca da base principal criada em 24/05/2026 no Google Drive.
- Rotina de backup e processo de restauracao inicial documentados.
- Planos comerciais iniciais definidos: gratuito, parceiro, destaque e top.
- A API le a planilha privada via service account e variaveis de ambiente da Vercel.
- A listagem nao entrega contatos diretamente (`whatsapp`, `telefone`, `instagram`, `facebook`, `site`).
- A listagem entrega apenas flags `has_whatsapp`, `has_telefone`, `has_instagram`, `has_facebook`, `has_site`.
- Contatos sao buscados sob demanda via `mode=contact` quando o usuario clica no botao.
- A home retorna apenas a primeira pagina e nao libera carregamento infinito sem busca/filtro.
- Com busca/filtro, a API ainda permite paginacao.

## Decisoes tecnicas e comerciais ja assumidas

- Manter a planilha o mais completa possivel.
- Controlar exibicao no site/API por plano, nao removendo dados da base.
- Contatos basicos devem continuar disponiveis tambem para gratuitos, para preservar a utilidade do site no inicio.
- Monetizacao deve focar em prioridade, imagem, destaque visual, oferta, selo e posicao.
- Parceiros devem poder ter imagem para melhorar o visual geral do site.
- Gratuitos devem ter ordenacao aleatoria entre si a cada nova pesquisa/carregamento.
- A ordenacao deve considerar plano, qualidade/completude do cadastro, relevancia da busca e aleatoriedade controlada.
- A qualidade do cadastro deve valorizar dados essenciais e evitar injustica com segmentos que naturalmente nao usam site, Facebook ou outras redes.
- O Documento Mestre e a fonte de decisao; este roadmap e a trilha tecnica de execucao.

## Sequencia mestre de execucao

A ordem abaixo combina pontuacao, dependencia logica e momento atual do projeto. Ao iniciar uma nova frente, seguir esta sequencia salvo decisao contraria do usuario.

### P0 - Protecao da base e operacao inicial

- [x] 1. Despublicar planilha antiga, se ainda estiver publica. Area: Seguranca. Pontuacao: 9. Concluido: link CSV publicado passou a retornar 401.
- [x] 2. Configurar backup da planilha/base. Area: Operacao. Pontuacao: 8. Concluido: primeira copia criada em 24/05/2026 no Drive; rotina inicial registrada neste roadmap e no Documento Mestre.
- [x] 3. Criar processo de restauracao da base. Area: Operacao. Pontuacao: 6. Concluido: procedimento registrado neste roadmap e no Documento Mestre.

### P1 - Definicoes comerciais e regras de exibicao

- [x] 4. Definir planos: gratuito, parceiro, destaque e top. Area: Comercial. Pontuacao: 8. Concluido: nomenclatura e funcao dos planos registradas neste roadmap e no Documento Mestre.
- [x] 5. Definir beneficios de cada plano. Area: Comercial. Pontuacao: 8. Concluido: beneficios iniciais registrados neste roadmap e no Documento Mestre.
- [ ] 6. Implementar regras por plano no site/API. Area: Comercial/Site. Pontuacao: 6.
- [ ] 7. Definir e implementar regra de ordenacao dos cards, considerando plano, qualidade/completude do cadastro, relevancia da busca e aleatoriedade controlada dos gratuitos. Area: Site. Pontuacao: 5.
  - Observacao: a regra deve evitar injustica com segmentos que naturalmente nao usam site, Facebook ou outras redes. A pontuacao de qualidade deve valorizar dados essenciais, como nome, categoria, bairro, endereco, WhatsApp/telefone e descricao, tratando presenca digital como complemento, nao como obrigacao.

### P2 - Validacao da experiencia do usuario

- [ ] 8. Testar botoes e layout no celular. Area: Site. Pontuacao: 8.
- [ ] 9. Melhorar fluxo `Sou responsavel por este comercio`. Area: Site/Comercial. Pontuacao: 5.
- [ ] 10. Criar processo para empresa solicitar alteracao/cadastro. Area: Comercial. Pontuacao: 6.

### P3 - Operacao e governanca

- [ ] 11. Documentar como atualizar a planilha sem quebrar o site. Area: Operacao. Pontuacao: 6.
- [ ] 12. Criar checklist antes de publicar mudancas. Area: Operacao. Pontuacao: 6.

### P4 - Publicacao e dominio

- [ ] 13. Configurar dominio `buscasalto.com`. Area: Publicacao. Pontuacao: 6.
- [ ] 14. Apontar dominio para Vercel. Area: Publicacao. Pontuacao: 6.
- [ ] 15. Validar HTTPS no dominio final. Area: Publicacao. Pontuacao: 8.
- [ ] 16. Configurar Google Search Console. Area: Publicacao. Pontuacao: 5.
- [ ] 17. Configurar Analytics ou medicao de buscas e acessos. Area: Publicacao. Pontuacao: 4.

### P5 - Monitoramento e seguranca complementar

- [ ] 18. Monitorar erros na Vercel. Area: Operacao. Pontuacao: 5.
- [ ] 19. Adicionar limite simples na API. Area: Seguranca. Pontuacao: 5.
- [ ] 20. Reduzir raspagem massiva por paginacao. Area: Seguranca. Pontuacao: 3.

### P6 - Qualidade de busca, dados e interface

- [ ] 21. Melhorar busca por acentos, plurais e erros comuns. Area: Site. Pontuacao: 4.
- [ ] 22. Revisar categorias e subcategorias. Area: Dados. Pontuacao: 3.
- [ ] 23. Melhorar visual, layout e imagens do site. Area: Site. Pontuacao: 4.

### P7 - Comercializacao e expansao

- [ ] 24. Criar processo para vender destaque por categoria. Area: Comercial. Pontuacao: 5.
- [ ] 25. Definir exclusividade do Top Categoria. Area: Comercial. Pontuacao: 5.

## Planos comerciais iniciais

Para fins de planilha, API e site, os planos iniciais devem usar os valores padronizados:

- `gratuito`
- `parceiro`
- `destaque`
- `top`

Beneficios iniciais:

- Gratuito: cadastro basico ativo no site, com nome, categoria, subcategoria, bairro, endereco/mapa e contatos basicos quando existirem. Nao possui imagem personalizada, oferta, selo ou destaque visual.
- Parceiro: inclui todos os recursos do gratuito, imagem no card, descricao revisada, selo de parceiro e prioridade acima dos gratuitos.
- Destaque: inclui todos os recursos do parceiro, destaque visual mais forte, possibilidade de oferta/promocao e prioridade acima do parceiro.
- Top: inclui todos os recursos do destaque, posicao maxima na categoria e selo Top Categoria. A regra de exclusividade por categoria ainda sera definida.

A regra comercial inicial preserva telefone e WhatsApp tambem para gratuitos, pois a utilidade do site para o usuario final e prioridade na fase de adocao.

## Rotina inicial de backup

Backup inicial criado em 24/05/2026:

- Nome: `Backup Busca Salto - base_interna - 2026-05-24`
- Link: https://docs.google.com/spreadsheets/d/1nE_0sRJf1bRdjAHjjtHsEZJVrH7AVKzRMeVso0HsIUc/edit

Regras iniciais:

- Criar backup antes de alteracoes estruturais na base, colunas, formulas ou regras de exibicao.
- Criar backup periodico, preferencialmente semanal durante a fase de implantacao e mensal apos estabilizacao.
- Manter versoes antigas ate existir historico suficiente para recuperacao segura.
- Nomear os backups com o padrao `Backup Busca Salto - base_interna - AAAA-MM-DD`.
- Registrar no Documento Mestre e neste roadmap quando houver backup relevante ou mudanca no processo.

## Processo inicial de restauracao

A restauracao deve preservar o ID da planilha principal usada pela API. Como regra, nao se deve trocar a planilha configurada na Vercel sem necessidade; o caminho preferencial e restaurar os dados dentro da planilha principal.

Procedimento:

1. Antes de restaurar, criar uma copia emergencial da base atual, mesmo que esteja com erro.
2. Identificar qual backup sera usado como fonte de recuperacao.
3. Conferir se a aba de origem e `base_interna` e se os cabecalhos estao compativeis com a planilha principal.
4. Copiar os dados do backup para a aba `base_interna` da planilha principal, preservando a ordem das colunas.
5. Revisar amostras de linhas para confirmar que nome, categoria, subcategoria, contatos, endereco, palavras-chave, plano e demais campos nao foram deslocados.
6. Testar a API em listagem, filtros e contato individual apos a restauracao, considerando o cache de ate 15 minutos.
7. Registrar no Documento Mestre e no roadmap tecnico qual backup foi usado e o motivo da restauracao.

Observacao: a copia de backup nao deve ser editada diretamente. Ela deve permanecer como ponto de retorno.

## Notas tecnicas para proximas implementacoes

### Regras por plano

A base deve continuar completa. A API deve decidir o que entregar e o frontend deve decidir o que renderizar conforme o campo `plano`.

Diretriz inicial:

- Gratuito: contatos basicos liberados quando existirem; sem imagem personalizada, sem oferta, sem destaque visual; ordem aleatoria entre gratuitos.
- Parceiro: tudo do gratuito, imagem no card, descricao melhor, selo/diferenciacao e prioridade acima dos gratuitos.
- Destaque: tudo do parceiro, oferta/promocao, visual mais forte e melhor posicao.
- Top: tudo do destaque, posicao maxima e selo Top Categoria.

### Ordenacao

A ordenacao desejada deve considerar quatro blocos:

1. Plano: Top > Destaque > Parceiro > Gratuito.
2. Relevancia da busca: correspondencia com nome, categoria, subcategoria, palavras-chave, bairro e descricao.
3. Qualidade/completude do cadastro: dados essenciais preenchidos e confiaveis.
4. Aleatoriedade controlada: variacao entre gratuitos ou entre cadastros de qualidade semelhante.

A qualidade do cadastro nao deve ser uma simples contagem de campos preenchidos. Para evitar injustica, a regra deve priorizar blocos de informacao:

- Identificacao: nome, categoria e subcategoria.
- Localizacao: bairro e endereco.
- Contato essencial: WhatsApp ou telefone.
- Conteudo util: descricao e palavras-chave.
- Presenca digital: Instagram, Facebook ou site como complemento, nao obrigacao.
- Recursos comerciais/visuais: imagem e oferta conforme plano.

Dentro dos gratuitos, a ordem deve variar a cada nova busca ou carregamento, sem prejudicar a prioridade dos planos pagos e sem premiar artificialmente apenas quem tem mais redes sociais.

### Seguranca da API

A API ja evita expor contatos na listagem. Proximos passos tecnicos:

- limitar chamadas por IP/janela de tempo quando viavel;
- evitar extracao massiva facil por paginacao sequencial;
- manter cache para reduzir chamadas ao Google Sheets;
- revisar quais campos podem sair em cada modo da API.

## Implementacoes feitas

- Criada API `/api/comercios` com leitura privada do Google Sheets.
- Removida dependencia de CSV publico no frontend.
- Criado modo `filters` para carregar categorias e bairros.
- Criado modo `contact` para buscar contato individual por clique.
- Ajustado frontend para renderizar botoes de contato sem expor dados na listagem.
- Corrigido comportamento de popup para contatos abrirem com URL correta.
- Adicionado fallback de ID na API quando a coluna `ID` nao estiver disponivel.
- Interrompida a publicacao antiga da planilha por CSV publico.
- Criado primeiro backup da base principal no Google Drive e registrada a rotina inicial de backup.
- Documentado processo inicial de restauracao da base.
- Definidos planos comerciais iniciais e beneficios por plano.
- Criado Documento Mestre no Google Drive.
- Criado este roadmap tecnico no GitHub.
