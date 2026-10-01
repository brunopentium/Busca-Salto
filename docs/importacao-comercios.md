# Importacao de comercios por categoria

## Fluxo de trabalho

1. Defina uma categoria oficial e uma regiao ou bairro de Salto para a pesquisa.
2. Pesquise comercios e confirme os dados em uma pagina publica do proprio estabelecimento, como site ou perfil social oficial. Use resultados do Google como ponto de partida; nao copie fotos, avaliacoes ou descricoes do Google Maps.
3. Organize os dados no modelo CSV disponivel na guia `Importar lote` do admin. Preencha `fonte_url` e `data_verificacao` em cada linha.
4. Carregue o arquivo no admin, revise campos incompletos e possiveis duplicados e selecione apenas os registros corretos.
5. Importe ate 25 registros por vez. A API confere duplicados novamente e grava as linhas mantendo formatacao e validacoes da planilha.

## Colunas aceitas

Obrigatorias: `nome`, `categoria`, `fonte_url`.

Opcionais: `subcategoria`, `bairro`, `endereco`, `whatsapp`, `telefone`, `instagram`, `facebook`, `site`, `descricao`, `palavras_chave`, `oferta`, `data_verificacao`, `status` e `plano`.

Por padrao, o comercio entra como gratuito, ativo, prioridade zero e nao verificado. A importacao em lote sempre grava `verificado` como `nao`; a presenca de uma pagina publica nao comprova que o responsavel pelo comercio confirmou o cadastro. Fotos devem ser adicionadas depois pelo cadastro normal do admin.

As colunas `fonte_url` e `data_verificacao` sao mantidas na planilha para facilitar revisoes. O site publico nao as exibe.

## Conferencias

- Nome e categoria precisam estar preenchidos; a categoria deve existir na taxonomia do admin.
- A fonte precisa ser uma URL `http` ou `https`.
- Registros repetidos no arquivo ou ja existentes na planilha ficam bloqueados para revisao. A comparacao considera abreviacoes de endereco, nomes alternativos separados por `/`, complementos como `Salto`, termos de ramo no nome e enderecos marcados como nao confirmados.
- Nome-base semelhante exige categoria compativel e evidencia adicional quando disponivel. Filiais com enderecos diferentes nao sao agrupadas apenas por compartilhar marca; nome exatamente igual e mesmo ramo com enderecos diferentes vai para revisao de mudanca ou filial. Negocios sem relacao no mesmo endereco tambem nao sao agrupados.
- Quando um nome-base distintivo aparece inteiro em outro nome mais descritivo, a mesma subcategoria permite sinalizar um possivel duplicado mesmo sem endereco. Essa coincidencia e mais fraca que nome exato, nao considera pedaços de palavras e sempre exige revisao manual.
- A previa mostra o cadastro correspondente, campos novos do CSV que podem complementar o registro e campos diferentes que precisam de conferencia. O botao de edicao abre o cadastro existente; nenhuma informacao e substituida automaticamente.
- Se o mesmo nome for usado por filiais diferentes, informe endereco ou contato para distinguir os cadastros.
- Um erro de duplicidade no momento da gravacao cancela o lote inteiro; revise a lista e envie novamente.

## Pesquisa de dados

O Busca Salto deve pesquisar manualmente e confirmar informacoes publicas em fontes do proprio estabelecimento antes de preparar cada lote. Nao usar a Places API para copiar conteudo para o diretorio: as regras do Google restringem armazenamento e uso de dados do Places em servicos de listagem. Tambem nao criar um coletor automatizado de resultados do Google Search.
