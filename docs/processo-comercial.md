# Busca Salto - Processo comercial

## Planos

Valores iniciais para fase de lancamento:

- Gratuito: R$ 0,00 por mes.
- Parceiro: R$ 49,90 por mes.
- Destaque: R$ 89,90 por mes.
- Top Categoria: R$ 149,90 por mes.

Os valores podem ser ajustados comercialmente. O codigo da pagina `comerciantes.html` e da API `/api/checkout` deve ser atualizado se os precos mudarem.

## Venda de destaque por categoria

Objetivo: vender melhoria de exibicao sem prejudicar a utilidade da busca para o usuario comum.

Fluxo operacional:

1. Comerciante acessa `comerciantes.html` ou clica em `Sou responsavel por este comercio`.
2. Comerciante escolhe plano e inicia o pagamento pelo Mercado Pago.
3. Solicitar nome do comercio, categoria/subcategoria desejada, responsavel, telefone e comprovacao de vinculo.
4. Registrar a solicitacao na planilha de controle.
5. Verificar se o comercio ja existe na base.
6. Validar disponibilidade quando for `Top Categoria`.
7. Confirmar pagamento ou condicao comercial.
8. Atualizar a base principal preservando ID, linha e colunas.
9. Testar no site a categoria afetada.
10. Registrar conclusao na planilha de controle.

## Beneficios por plano

### Gratuito

- Cadastro basico.
- Nome, categoria, subcategoria, bairro, endereco e contatos disponiveis quando existirem.
- Sem imagem personalizada, oferta ou prioridade comercial.

### Parceiro

- Prioridade acima dos gratuitos.
- Imagem no card.
- Selo de parceiro.
- Descricao revisada.

### Destaque

- Prioridade acima de Parceiro.
- Destaque visual mais forte.
- Imagem no card.
- Oferta/promocao no card.
- Selo de destaque.

### Top Categoria

- Maior prioridade dentro da categoria/subcategoria.
- Selo Top Categoria.
- Todos os recursos do Destaque.
- Exclusividade inicial conforme regra abaixo.

## Exclusividade do Top Categoria

Regra inicial:

- A exclusividade e por subcategoria principal.
- Quando a subcategoria for muito ampla, usar combinacao de categoria + subcategoria + bairro como criterio comercial auxiliar.
- Um unico comercio pode ficar como `top` em uma mesma subcategoria principal por ciclo comercial ativo.
- Ciclo inicial: 30 dias.
- Renovacao: o Top ativo tem prioridade de renovacao se estiver em dia.
- Caso outro comercio solicite o mesmo Top, registrar como lista de espera.

Exemplos:

- `Pizzaria`: apenas um Top Categoria ativo em Pizzaria.
- `Clínica Médica`: apenas um Top ativo, salvo decisao comercial de segmentar por bairro ou especialidade.
- `Restaurante`: pode exigir avaliacao manual por ser uma subcategoria ampla.

## Regras de seguranca comercial

- Nenhum plano deve ser ativado sem registro da solicitacao.
- Alteracao sensivel exige validacao de responsavel.
- Pagamento aprovado nao substitui validacao de vinculo.
- Se houver disputa entre responsaveis, congelar alteracao ate validacao adicional.
- Se um Top for vendido indevidamente em categoria ja ocupada, preservar o cliente ativo e oferecer alternativa, reembolso ou fila.

## Mercado Pago

A API `/api/checkout` esta preparada para criar preferencia de pagamento quando a variavel `MERCADO_PAGO_ACCESS_TOKEN` estiver configurada na Vercel.

Sem essa variavel, a API informa que o checkout Mercado Pago ainda nao esta configurado. A pagina nao deve apresentar venda por WhatsApp como fluxo principal.

Variaveis recomendadas:

- `MERCADO_PAGO_ACCESS_TOKEN`: token privado da conta Mercado Pago.
- `SITE_URL`: URL publica final, preferencialmente `https://buscasalto.com` apos configurar o dominio.

Depois de configurar o token, testar os planos pagos em `comerciantes.html` antes de divulgar.
