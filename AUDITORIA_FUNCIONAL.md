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
