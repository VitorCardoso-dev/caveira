# Auditoria funcional — CAVEIRA

**Data:** 30 de outubro de 2026

## Metas automáticas

Metas agora possuem uma origem explícita: manual, hábito vinculado, tarefas concluídas, minutos de foco, registros de treino ou registros de alimentação. O servidor calcula o progresso usando os registros persistidos do usuário, limita o valor ao alvo e retorna o estado calculado. Metas automáticas não exibem um campo de progresso manual nem aceitam mutação manual de progresso.

A atualização acontece em novas consultas do dashboard e da tela de metas. Por exemplo, ao concluir um hábito vinculado ou registrar uma sessão de foco, o próximo carregamento recalcula o cartão a partir do banco. O cálculo não depende apenas do estado visual do navegador.

## Evidência de testes

Foram adicionados três testes de metas automáticas: contagem apenas do hábito vinculado dentro do período, contagem de tarefas/foco/treinos respeitando o alvo e preservação do progresso de metas manuais. O conjunto passou com **9 testes em 3 arquivos**.

Também passaram `pnpm check`, `pnpm build`, `pnpm db:migrate`, `/api/health` com HTTP 200 e `/manus-routes.json` com HTTP 200.

## Auditoria de controles

As rotas de produto estão declaradas em `/manus-routes.json`: dashboard, perfil, hábitos, tarefas, metas, foco, treinos, alimentação, finanças, recompensas, relatórios e configurações.

A auditoria de handlers encontrou um botão de menu no dashboard sem ação conectada. Ele foi removido, em vez de permanecer como controle decorativo. Os demais controles do produto têm `onClick`, `onSubmit`, navegação por rota ou mutação tRPC correspondente. A página `ComponentShowcase` continua sendo uma página interna de componentes do starter, não uma rota de produto no manifesto.

## Auditoria de layout

A matriz de captura foi executada em 375×812, 768×1024 e 1280×720. A evidência detalhada, com caminhos dos PNGs e limitações, está em [LAYOUT_AUDIT.md](./LAYOUT_AUDIT.md).

A superfície de autenticação passou visualmente nas três larguras. As rotas protegidas não foram declaradas aprovadas nesta rodada porque o capturador não possuía sessão autenticada e exibiu carregamento/login. É necessário repetir a captura com uma sessão autenticada para provar o layout do dashboard e dos módulos reais.

## Limitações ainda abertas

A validação de interação autenticada não foi simulada nesta rodada: não foi inventado um usuário nem usado um fluxo de login sem autorização. A próxima evidência necessária é um click-through autenticado de criação de hábito, criação de meta automática, conclusão do hábito vinculado e confirmação do avanço do cartão.


## Atualização de estabilização — 2026-11-01 (PR #6)

A rodada de estabilização foi executada sobre a `main` após a PR #5. O checkpoint de código desta rodada está na PR [#6](https://github.com/VitorCardoso-dev/caveira/pull/6).

### Correções desta rodada

- Pontos de metas concluídas e blocos de foco passaram a ser gravados no ledger, evitando que o placar semanal conte pontos que não aparecem no XP e nos gráficos.
- O limite semanal de foco é preservado durante a transição entre a pontuação legada e o ledger novo; chaves únicas protegem os blocos contra duplicação.
- Editar detalhes de uma meta sem enviar status preserva o status atual. O progresso manual conclui a meta pelo alvo configurado, não por um valor fixo.
- O cronômetro acumula somente o tempo ativo entre pausas e retomadas; o servidor valida a coerência entre duração, início e fim.
- O editor de metas não permite salvar enquanto as fontes persistidas estão carregando ou se a consulta falhou.
- Os totais de receitas e despesas do módulo financeiro usam o mês corrente, no fuso de São Paulo.
- Frequências semanal e personalizada foram desativadas temporariamente na criação e rejeitadas pelo servidor: o schema ainda não persiste dias/agenda suficientes para aplicar essas regras com segurança. Hábitos legados com essas frequências não recebem pontuação arbitrária; devem ser recriados como diários até a implementação da agenda.

### Evidência automatizada

A execução de qualidade no commit `7f6420ad93cb877fed4ffcad8bbc7b4cfaa9a34c` passou em todas as etapas: TypeScript, migrações em MySQL 8.4 descartável, testes automatizados e build de produção. Resultado: **13 arquivos de teste e 55 testes aprovados**.

### Limites externos — não confundir com falhas da CI

- O MySQL da CI é descartável; isso não prova que as migrações pendentes foram aplicadas no banco de produção.
- Não foi executado deploy nem alterado banco real nesta rodada.
- A revisão visual autenticada em navegador e a validação das credenciais/URLs reais de OAuth, banco e hospedagem dependem do ambiente publicado e de uma sessão autenticada.
- Frequências semanal e personalizada permanecem como funcionalidade futura, explicitamente bloqueada para evitar registros com regras falsas.
