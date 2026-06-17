# Taxonomia Busca Salto

Este documento define o padrao operacional de categorias e subcategorias usado para manter a busca organizada, previsivel e facil de entender pelo usuario final.

## Principios

1. A categoria deve representar o grande segmento do comercio.
2. A subcategoria deve representar o que o usuario procuraria na pratica.
3. Evitar subcategorias que descrevem canal de venda, como `delivery`, quando isso puder ser tratado na descricao, oferta ou palavras-chave.
4. Evitar duplicidades por plural/singular, acento ou escrita diferente.
5. Quando um comercio atuar em mais de um ramo real, usar subcategorias separadas por `;`, por exemplo `Restaurante; Pizzaria`.
6. Termos comerciais muito especificos podem continuar em `palavras_chave`, sem virar filtro principal.

## Categorias oficiais

- Alimentação
- Automotivo
- Beleza e Estética
- Casa e Construção
- Comércio Geral
- Educação
- Esporte e Fitness
- Hotelaria
- Lazer e Eventos
- Pets
- Religião e Comunidade
- Saúde e Bem-estar
- Serviços
- Serviços Profissionais
- Tecnologia
- Transporte

## Normalizacoes importantes

- `Restaurante com delivery`, `Delivery de restaurante` e `Restaurante por quilo` devem aparecer como `Restaurante`.
- `Restaurante Rural`, `Restaurante Nordestino` e `Galeterias` devem aparecer como `Restaurante`.
- `Pizzaria delivery` deve aparecer como `Pizzaria`.
- `Pastel`, `Pasteis` e `Pastelaria delivery` devem aparecer como `Pastelaria`.
- `Hortas`, `Hortifrutis`, `Produtores Locais` e `Quitandas` devem aparecer como `Hortifrúti`.
- `Auto eletrica` deve aparecer como `Autoelétrica`.
- `Corretor de Imóveis` e `Corretores de Imóveis` devem aparecer como `Imobiliária`.
- `Corretora de Seguros` e `Corretoras de Seguros` devem aparecer como `Seguros`.
- `Material Gráfico`, `Materiais Gráficos` e `Comunicação Visual` devem aparecer como `Gráficas`.
- `Loja de Móveis` e `Móveis Planejados` devem aparecer como `Móveis`.
- `Clínica médica especializada`, `Consultório médico` e `Policlínica` devem aparecer como `Clínica Médica`.

## Uso no admin

O painel administrativo carrega a lista oficial pela rota autenticada `/api/admin/taxonomia`.

Ao salvar um comercio, a API admin tambem normaliza categoria e subcategoria antes de gravar na planilha. Isso reduz o risco de novos cadastros criarem filtros duplicados ou termos inconsistentes.

## Uso na busca publica

A API publica continua aplicando uma camada de padronizacao na leitura da planilha. Assim, dados antigos podem continuar existindo na base, mas o usuario final ve filtros mais limpos e resultados mais coerentes.
