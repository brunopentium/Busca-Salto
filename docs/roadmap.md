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
- Controle de solicitacoes: https://docs.google.com/spreadsheets/d/1syCpTPP-9MxF_kbPhvjcyFi3c3Vq9ZUWzYuW8yVbsXs/edit

## Estado atual

- Site publicado na Vercel.
- HTTPS ativo no dominio Vercel; HTTP redireciona para HTTPS.
- A base principal esta em Google Sheets privado.
- O site nao consulta mais CSV publico do Google Sheets.
- A publicacao antiga da planilha via link CSV foi interrompida e passou a retornar 401.
- Primeira copia de seguranca da base principal criada em 24/05/2026 no Google Drive.
- Rotina de backup e processo de restauracao inicial documentados.
- Planilha de controle de solicitacoes criada no Google Drive.
- Processo operacional de cadastro, correcao, reclamacao e validacao de responsavel documentado.
- Processo de atualizacao segura da base principal documentado no Documento Mestre.
- Checklist antes de publicar mudancas documentado no Documento Mestre e neste roadmap.
- Planos comerciais iniciais definidos: gratuito, parceiro, destaque e top.
- Regras iniciais por plano implementadas na API e nos cards do site.
- Ordenacao inicial implementada com plano, relevancia, qualidade do cadastro e aleatoriedade controlada entre gratuitos comparaveis.
- Botoes e layout dos cards foram validados em celular real em 24/05/2026, sem corte lateral visivel.
- Botao `Sou responsavel por este comercio` configurado para abrir o WhatsApp oficial do Busca Salto com mensagem pronta identificando o comercio.
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
- Solicitacoes de alteracao, cadastro, reclamacao e disputa devem ser registradas em planilha propria antes de qualquer alteracao sensivel na base.
- Alteracoes sensiveis exigem prova razoavel de vinculo com o comercio.
- A base principal deve preservar nomes de cabecalhos, ordem das colunas, IDs e integridade de linhas.
- Para ocultar temporariamente um comercio, preferir alterar `status` em vez de apagar a linha.
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
- [x] 6. Implementar regras por plano no site/API. Area: Comercial/Site. Pontuacao: 6. Concluido: API e cards aplicam regras iniciais por plano.
- [x] 7. Definir e implementar regra de ordenacao dos cards, considerando plano, qualidade/completude do cadastro, relevancia da busca e aleatoriedade controlada dos gratuitos. Area: Site. Pontuacao: 5. Concluido: regra registrada e implementada na API.

### P2 - Validacao da experiencia do usuario

- [x] 8. Testar botoes e layout no celular. Area: Site. Pontuacao: 8. Concluido: validado em celular real em 24/05/2026; cards e botoes renderizaram corretamente, sem corte lateral visivel.
- [x] 9. Melhorar fluxo `Sou responsavel por este comercio`. Area: Site/Comercial. Pontuacao: 5. Concluido: botao configurado para abrir o WhatsApp oficial do Busca Salto com mensagem pronta identificando o comercio.
- [x] 10. Criar processo para empresa solicitar alteracao/cadastro. Area: Comercial. Pontuacao: 6. Concluido: criada planilha de controle e definido processo operacional no Documento Mestre.

### P3 - Operacao e governanca

- [x] 11. Documentar como atualizar a planilha sem quebrar o site. Area: Operacao. Pontuacao: 6. Concluido: processo operacional registrado no Documento Mestre.
- [x] 12. Criar checklist antes de publicar mudancas. Area: Operacao. Pontuacao: 6. Concluido: checklist operacional registrado no Documento Mestre e neste roadmap.

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

## Regras por plano implementadas

- A API aplica controle por plano no retorno publico da listagem.
- Contatos nao sao enviados diretamente na listagem; apenas indicadores de disponibilidade sao enviados.
- Telefone, WhatsApp, Instagram, Facebook e site continuam sendo buscados individualmente no clique do usuario.
- Cadastros gratuitos nao recebem imagem nem oferta no JSON publico da listagem.
- Parceiro, Destaque e Top podem receber imagem.
- Oferta e liberada apenas para Destaque e Top.
- O site agrupa parceiros acima dos gratuitos e renderiza selos conforme o plano.
- A prioridade tecnica inicial segue a ordem Top, Destaque, Parceiro e Gratuito.

## Regra de ordenacao implementada

A ordenacao inicial segue quatro blocos:

1. Plano: Top, Destaque, Parceiro e Gratuito.
2. Relevancia da busca: nome, categoria, subcategoria, palavras-chave, descricao e bairro.
3. Qualidade/completude do cadastro: identificacao, localizacao, contato essencial, conteudo util e sinais digitais como complemento.
4. Aleatoriedade controlada: variacao entre cadastros gratuitos de pontuacao semelhante.

A qualidade do cadastro nao e uma simples contagem de campos preenchidos. A regra valoriza nome, categoria, subcategoria, bairro, endereco, WhatsApp/telefone, descricao e palavras-chave. Instagram, Facebook e site contam como complemento para nao prejudicar segmentos que normalmente nao usam esses canais.

A API aceita uma `seed` opcional e tambem usa uma janela de variacao padrao. Isso permite variar a ordem dos gratuitos sem prejudicar a prioridade dos planos pagos nem a relevancia da busca.

## Processo de solicitacoes de cadastro e alteracao

Planilha de controle:

- Nome: `Busca Salto - Solicitacoes de Cadastro e Alteracao`
- Link: https://docs.google.com/spreadsheets/d/1syCpTPP-9MxF_kbPhvjcyFi3c3Vq9ZUWzYuW8yVbsXs/edit

Regras iniciais:

1. Toda solicitacao recebida pelo WhatsApp ou outro canal deve virar uma linha na aba `solicitacoes`.
2. Antes de alterar telefone, WhatsApp, endereco, redes, site, imagem, oferta ou plano, pedir prova razoavel de vinculo.
3. Evidencias aceitas: WhatsApp oficial do cadastro, print de administracao de rede social, foto da fachada/cartao/cardapio, CNPJ/MEI ou e-mail do dominio do comercio.
4. Em caso de duvida, disputa ou risco de dano, nao aplicar mudanca sensivel ate validar melhor.
5. Acoes temporarias possiveis: ocultar contato incorreto, congelar alteracao ou manter ultima versao segura.
6. Reclamos sobre dado incorreto ou exposicao indevida devem ter prioridade de analise.
7. Encerrar cada solicitacao com status, decisao, data de conclusao, observacoes e link de evidencia quando houver.

Mensagem padrao de validacao:

`Ola! Para proteger o cadastro do comercio no Busca Salto, preciso confirmar que voce e responsavel por ele. Pode enviar uma confirmacao, como WhatsApp oficial do comercio, print de administracao do Instagram/Facebook, foto da fachada/cartao/cardapio, CNPJ/MEI ou e-mail do dominio do comercio? Apos validar, faco a correcao ou melhoria do cadastro.`

## Processo de atualizacao segura da base principal

A base principal deve ser atualizada com cuidado, pois a API le a aba `base_interna` da planilha privada configurada na Vercel. A planilha deve preservar a ordem dos cabecalhos, os nomes das colunas e a integridade de cada linha.

Campos tecnicos relevantes para o site:

- `ID`: identificador unico do comercio. Nao deve ser duplicado nem trocado entre linhas.
- `nome`: nome exibido no card e usado na busca.
- `categoria`, `subcategoria`, `bairro`, `endereco` e `descricao`: usados para exibicao, filtros, busca e qualidade do cadastro.
- `telefone`, `whatsapp`, `instagram`, `facebook` e `site`: usados pelos botoes, mas retornados pela API apenas sob demanda.
- `palavras_chave`: usadas para busca e relevancia.
- `plano` ou `tipo_exibicao`: controla gratuito, parceiro, destaque e top.
- `status`: somente linhas com status `ativo` aparecem no site.
- `prioridade`, `foto_url`, `oferta` e `verificado`: afetam exibicao, ordenacao e beneficios comerciais.

Procedimento antes de editar:

1. Confirmar que a edicao sera feita na planilha principal usada pela API e na aba correta, `base_interna`.
2. Criar backup quando a alteracao envolver muitas linhas, estrutura, cabecalhos, colunas, formulas, importacao em massa ou restauracao.
3. Nao alterar a ordem das colunas e nao renomear cabecalhos sem avaliar impacto na API.
4. Nao apagar o ID de uma linha existente e nao reutilizar ID de outro comercio.
5. Para solicitacoes externas, conferir se existe registro na planilha de solicitacoes e se a validacao do responsavel foi feita quando necessaria.

Procedimento durante a edicao:

1. Editar uma linha por comercio, preservando a correspondencia entre nome, endereco, contatos, categoria, descricao, plano e demais campos.
2. Quando uma informacao nao estiver confirmada, preferir manter vazio ou seguir o padrao operacional definido para aquele campo, evitando inventar dados.
3. Para remover temporariamente um comercio do site, alterar `status` para `inativo` ou outro valor diferente de `ativo`, em vez de apagar a linha.
4. Para alterar plano comercial, usar somente os valores padronizados: `gratuito`, `parceiro`, `destaque` ou `top`.
5. Em alteracoes grandes, trabalhar em blocos pequenos e revisar amostras antes de continuar.

Validacao apos editar:

1. Conferir se os cabecalhos continuam na mesma ordem e com os mesmos nomes essenciais.
2. Conferir se nao ha IDs duplicados, linhas deslocadas ou contatos em empresas erradas.
3. Testar a API em listagem, filtros e contato individual.
4. Testar o site em uma busca ou categoria afetada pela alteracao.
5. Considerar o cache de ate 15 minutos antes de concluir que a alteracao nao apareceu.
6. Registrar mudancas relevantes no Documento Mestre, roadmap tecnico ou planilha de solicitacoes, conforme o caso.

Regra de seguranca operacional:

Se houver duvida, disputa, erro em massa, alteracao sensivel ou risco de prejudicar um comercio, interromper a edicao, preservar a base atual e pedir validacao antes de seguir.

## Checklist antes de publicar mudancas

Antes de publicar mudancas no site, API, Vercel ou base principal, deve-se executar este checklist.

1. Identificar o tipo de mudanca: codigo/site, API, dados/base, dominio/Vercel ou regra comercial.
2. Conferir se a mudanca tem solicitacao, decisao ou justificativa registrada quando afetar negocio, dados ou exibicao publica.
3. Criar backup quando a mudanca envolver base, colunas, importacao em massa, restauracao ou alteracao estrutural.
4. Verificar se a mudanca nao expoe a planilha privada, chaves, variaveis de ambiente ou contatos em massa.
5. Testar API principal: listagem, filtros e contato individual.
6. Testar site em desktop e celular quando houver alteracao visual ou de comportamento.
7. Conferir que botoes de WhatsApp, telefone, Instagram, Facebook, site e endereco funcionam sem abrir links vazios.
8. Conferir que planos gratuito, parceiro, destaque e top continuam respeitando as regras de exibicao.
9. Conferir que busca, filtros e carregamento de mais resultados continuam funcionando.
10. Validar HTTPS e dominio afetado quando houver alteracao de publicacao.
11. Aguardar ou considerar cache de ate 15 minutos quando a mudanca envolver dados.
12. Registrar mudanca relevante no Documento Mestre, roadmap tecnico ou planilha de solicitacoes.
13. Se qualquer teste falhar, nao considerar a publicacao concluida ate corrigir ou reverter.

Regra de bloqueio: mudancas que possam derrubar o site, expor base privada, trocar contatos entre comercios, quebrar a API ou gerar prejuizo a comercio devem ser interrompidas ate validacao.

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
- Aplicadas regras iniciais por plano no retorno publico da API.
- Implementada ordenacao por plano, relevancia, qualidade do cadastro e aleatoriedade controlada entre gratuitos comparaveis.
- Configurado o WhatsApp oficial do Busca Salto no fluxo `Sou responsavel por este comercio`.
- Criada planilha de controle de solicitacoes de cadastro e alteracao.
- Documentado processo operacional de validacao de responsavel, alteracao, reclamacao e disputa.
- Documentado processo seguro de atualizacao da base principal.
- Documentado checklist antes de publicar mudancas.
- Interrompida a publicacao antiga da planilha por CSV publico.
- Criado primeiro backup da base principal no Google Drive e registrada a rotina inicial de backup.
- Documentado processo inicial de restauracao da base.
- Definidos planos comerciais iniciais e beneficios por plano.
- Validado layout mobile dos cards e botoes em celular real em 24/05/2026.
- Criado Documento Mestre no Google Drive.
- Criado este roadmap tecnico no GitHub.
