# CAVEIRA — resultados

## Fase 1 — Fundação, navegação, dashboard e persistência

- [x] **Estrutura e shell responsivo:** o aplicativo se chama CAVEIRA, usa tema escuro padrão, estética minimalista/intensa em preto, grafite, branco e pequenos detalhes vermelhos, tipografia legível, caveira estilizada, navegação intuitiva e adaptação para celular, tablet e computador; animações são discretas e há feedback visual nas interações.
- [x] **Autenticação e privacidade:** o produto é para uso exclusivamente pessoal; não há rede social, assinaturas, planos pagos, marketplace, ranking público nem administração de vários usuários; páginas e dados pessoais usam autenticação privada real e autorização por usuário, sem login simulado ou segurança baseada em URL difícil de adivinhar.
- [x] **Navegação e estados de uso:** a navegação possui Dashboard e entradas para Hábitos, Tarefas, Metas, Foco, Treinos, Alimentação, Finanças, Recompensas e Relatórios; cada seção sem registros apresenta estado vazio com instrução útil; formulários validam dados e mostram mensagens claras de sucesso/erro.
- [x] **Dashboard baseado em dados reais:** a tela inicial exibe saudação personalizada, data atual, pontuação de conclusão do dia, hábitos concluídos e pendentes, tarefas prioritárias, sequência atual de consistência, progresso de metas semanais/mensais, resumo de treino/alimentação, resumo financeiro, próxima recompensa de lazer, calendário/histórico, botão de modo foco e acessos rápidos; indicadores são calculados a partir dos dados cadastrados e não usam fictícios como se fossem do usuário.
- [x] **Persistência e operações reais:** registros criados pela interface continuam disponíveis depois de fechar e reabrir o aplicativo; operações de cadastro, leitura, edição e exclusão têm origem no banco persistente, não em `localStorage` como banco definitivo; exclusões importantes pedem confirmação e alterações relevantes podem ser auditadas.
- [x] **Base de dados e segurança:** o schema é versionado por migrações aditivas, as consultas são escopadas ao usuário autenticado, chaves não são expostas no navegador, e o servidor mantém `/api/health` funcional.

## Entrega atual — base integrada dos módulos

- Registros persistentes adicionados para treinos, alimentação, finanças e recompensas, com criação, edição, exclusão, datas, detalhes e trilha de auditoria.
- Relatório integrado com tarefas, foco, treinos, calorias, saldo observado, linha do tempo e XP derivado apenas de ações reais.
- Assistente financeiro protegido no servidor, fundamentado somente nas transações registradas e com fallback explícito quando a análise por IA não estiver disponível.
- Preferências pessoais, exportação JSON, importação versionada, manifesto instalável, ícone e service worker para cache do shell offline.
- Logo fotográfica baseada na referência enviada, aplicada ao favicon, PWA, shell, dashboard e perfil; perfil privado com identificação da conta, status de sessão, configurações e saída segura.
- Tarefas com prazo agora desaparecem da fila no dia seguinte ao vencimento, não podem ser concluídas retroativamente e descontam do placar; o layout global bloqueia rolagem horizontal em telas pequenas.
- Navegação principal simplificada: Foco, Treinos, Alimentação e Finanças continuam acessíveis por rota direta, mas foram retirados das abas e dos atalhos visíveis.
- Pontuação semanal realista: hábitos concluídos valem +2, tarefas baixa/média/alta +3/+5/+8, tarefas vencidas −2/−3/−5, metas concluídas +8 e foco +1 por bloco de 25 minutos com limite semanal; o relatório mostra ganhos, perdas, cumprimento e saldo, e recompensas podem consumir a carteira.
- Metas automáticas reais: cada meta pode ser manual ou acompanhar um hábito específico, tarefas concluídas, minutos de foco, registros de treino ou registros de alimentação; o servidor calcula o progresso a partir dos registros persistidos, limita ao alvo e bloqueia edição manual em metas automáticas.
- Auditoria de qualidade: 9 testes automatizados passam, build/check/migração/health/rotas foram verificados, e capturas foram executadas em 375×812, 768×1024 e 1280×720; a auditoria autenticada dos módulos permanece aberta porque as capturas desta rodada não tinham sessão.
- Vínculo tarefa-meta corrigido e testado autenticado: metas do tipo “tarefas concluídas” recebem um ID próprio, tarefas podem selecioná-las no cadastro, o servidor valida que a meta pertence ao mesmo usuário e a conclusão atualiza o progresso de 0/1 para 1/1 sem ultrapassar o alvo.
- Categorias predefinidas adicionadas aos cadastros de hábitos, tarefas e metas, incluindo Físico, Alimentação, Saúde, Mente, Estudos, Trabalho, Financeiro, Desenvolvimento pessoal, Relacionamentos e Outros.
- O checklist abaixo permanece aberto onde ainda faltam recorrência avançada, subtarefas, banco de exercícios/alimentos, água, receitas, orçamentos, carteira de recompensas e relatórios comparativos completos.

## Fase 2 — Hábitos, tarefas, metas e foco

- [ ] **Hábitos:** criar, editar, excluir e arquivar hábitos; frequência diária, semanal ou dias específicos; horários e lembretes; observações; estados concluído, pendente, dispensado e perdido; pausas planejadas sem penalizar dias anteriores; sequências, calendário, histórico, taxas diária/semanal/mensal e identificação de hábitos consistentes/negligenciados; alteração retroativa deixa registro.
- [ ] **Tarefas e metas:** tarefas têm título, descrição, categoria, prioridade, prazo e status; suportam recorrência, subtarefas/checklists, visualizações diária/semanal/mensal, filtros, atrasos e reordenação; metas têm tipo, prazo, etapas, indicadores mensuráveis, progresso percentual, marcos e relatórios semanais/mensais.
- [ ] **Modo foco:** temporizador configurável incluindo Pomodoro, lista de tarefas prioritárias, registro do tempo efetivamente dedicado, histórico de sessões e resumo de produtividade.

## Fase 3 — Treinamento físico

- [ ] Biblioteca e cadastro de exercícios com grupo muscular, instruções e equipamentos; fichas personalizadas e divisões por dias; séries, repetições, carga, descanso e observações; registros concluídos, histórico, gráficos e recordes; temporizador de descanso e calendário.
- [ ] Medidas corporais, fotos de progresso, peso, cardio e descanso/recuperação; adaptação a tempo/equipamentos; não prescrever cargas sem contexto nem incentivar treinar com dor ou ignorar recuperação.

## Fase 4 — Nutrição e alimentação

- [ ] Diário, banco e cadastro personalizado de alimentos, refeições, quantidades em g/ml/unidades, calorias e macros, metas editáveis, histórico diário, água, gráficos, planejamento, lista de compras e receitas.
- [ ] Valores nutricionais aproximados são identificados como estimativas e podem ser corrigidos; objetivos de manutenção/ganho/perda são editáveis sem incentivo a restrições extremas.

## Fase 5 — Finanças e análise opcional por IA

- [ ] Receitas, despesas, categorias, datas, descrições, pagamentos, recorrências, contas a pagar/receber, orçamento, saldo, metas de economia, reserva, histórico, filtros, gráficos e relatórios mensais.
- [ ] Assistente analisa apenas os dados reais registrados, informa falta de informação e responde sobre maiores gastos, economia, cortes, orçamento e valor mensal para uma meta; não inventa transações, não conecta bancos automaticamente e não envia informação financeira externamente sem consentimento explícito.

## Fase 6 — XP e lazer pessoal

- [ ] XP por tarefas, hábitos e objetivos concluídos; níveis, conquistas/medalhas, sequências, estatísticas, marcos, histórico, desafios e penalidades proporcionais; sem XP duplicado por marcar/desmarcar.
- [ ] Recompensas privadas de lazer têm nome, descrição, categoria, duração, custo opcional, condições, pontos/metas, status, data e histórico; regras personalizáveis, carteira transparente de créditos/débitos, limite contra pontos ilimitados, opções gratuitas/pagas com impacto no orçamento e sem culpa excessiva.

## Fase 7 — Relatórios, backup, segurança e PWA

- [ ] Relatórios diário/semanal/mensal agregam hábitos, tarefas, foco, treinos, físico, alimentação, finanças e recompensas; com comparação de períodos, tendências, áreas de atenção e fechamento semanal com o que funcionou, falhou e três prioridades; correlação não é apresentada como causalidade.
- [ ] Configurações incluem perfil, objetivos, categorias, metas, notificações, horários, recompensas, exportação CSV/JSON, importação de backups válidos, backup/restauração, apagar dados pessoais com confirmação e histórico de alterações.
- [ ] O aplicativo funciona bem em telas pequenas, oferece acesso offline ao essencial quando possível, é instalável como PWA e passa pelos checks, testes e build de produção sem declarar integrações não implementadas como concluídas.


## Entrega 2026-10-30 — experiência de execução e evolução

- [x] **Categorias predefinidas para tarefas, hábitos e metas:** o cadastro usa um seletor com Alimentação, Trabalho, Estudos, Financeiro, Físico, Saúde, Desenvolvimento pessoal, Hábitos, Mente, Relacionamentos e Outros; a tarefa não exibe mais prioridade manual.
- [x] **Pontuação por categoria e sem exagero:** tarefas recebem 8/7/6/6/5/5/5/4/4/4/3 pontos conforme a categoria; prazos vencidos perdem metade dos pontos, com mínimo de 2; ações da mesma categoria no mesmo dia são deduplicadas para evitar contar hábito e tarefa como dois ganhos independentes.
- [x] **Guias internas nos três módulos:** Hábitos, Tarefas e Metas têm Visão geral e Criação, com a criação separada da leitura dos registros persistentes.
- [x] **Visão geral de Metas:** metas são exibidas em cards visuais com imagem da marca, variação cromática por categoria, evolução, estado, atraso e indicação de acompanhamento automático.
- [x] **Visão geral de Tarefas:** mostra tarefas criadas/com prazo no dia, cumprimento diário, categoria de maior constância, categoria que exige atenção e taxas históricas por categoria.
- [x] **Metas novas com acompanhamento automático:** a criação não oferece progresso manual; a origem é tarefa, hábito, foco, treino ou alimentação, e tarefas podem ser vinculadas a metas.
- [x] **Gráfico de linha do painel:** o dashboard passou a consumir a série diária real de 14 dias, com pontos de hábitos/tarefas deduplicados, em vez de apenas cards/barras decorativas.
- [x] **Validação:** `pnpm check`, `pnpm test` (9 testes) e `pnpm build` passaram; Preview respondeu 200 em `/api/health` e `/manus-routes.json`; fluxo autenticado de tarefas e metas foi revisado no navegador; guias de criação foram abertas e a ausência de prioridade foi confirmada.
- [ ] **Pendência de produto:** registros antigos com categorias digitadas livremente continuam preservados e aparecem como categorias legadas; se desejado, a próxima etapa pode oferecer migração assistida para as categorias oficiais, sem apagar histórico.

## Entrega 2026-10-30 — Treinos em três guias

- [x] **Visão geral de Treinos:** `/treinos` apresenta fichas ativas, dias programados, treino de hoje, sessões da semana, total histórico e últimas sessões persistentes.
- [x] **Criação de fichas:** é possível criar fichas com nome, categoria, modalidade e dias da semana; cada ficha aceita exercícios com grupo muscular, equipamento, séries, repetições, carga inicial e descanso, com exclusão persistente.
- [x] **Acompanhamento em tempo real:** a terceira guia abre uma sessão persistente, cria séries planejadas no servidor, permite registrar repetições/carga, concluir cada série, iniciar descanso configurado ou de 60 segundos e finalizar a sessão.
- [x] **Pontuação e metas:** uma sessão concluída gera uma transação idempotente de +5 pontos e pode alimentar o acompanhamento automático de metas por registros de treino, sem duplicar pontuação por reabertura.
- [x] **Responsividade:** a execução usa controles grandes, cartões empilhados e cabeçalho de progresso para uso em 375px, sem rolagem lateral.
- [ ] **Evolução avançada:** gráficos de volume/recordes, medidas corporais, fotos, cardio e biblioteca inicial de exercícios por grupo muscular ainda podem ser ampliados sobre a estrutura persistente criada.

## Evolução aprovada — implementação incremental

- [x] **Ledger de pontuação por categoria:** a nova pontuação usa 4, 6, 8, 10, 12 ou 14 pontos conforme as categorias existentes: Outros 4; Mente, Hábitos e Relacionamentos 6; Físico e Saúde 8; Estudos e Desenvolvimento pessoal 10; Alimentação 12; Trabalho e Financeiro 14. Cada atividade recebe sua própria pontuação, sem deduplicar atividades diferentes da mesma categoria no mesmo dia.
- [x] **Resultados e corrosividade:** cumprimento gera o valor integral; falha normal perde metade; falha corrosiva perde o dobro; saldo negativo é permitido; a opção corrosiva é configurável no cadastro de hábitos e tarefas; cada movimentação fica no histórico e retries não duplicam o mesmo evento.
- [x] **Transição segura da pontuação:** atividades antigas não são recalculadas; movimentações e resgates antigos permanecem preservados; o saldo legado é documentado e distinguido do novo ledger; referências antigas continuam legíveis.
- [x] **Loja de recompensas:** recompensas possuem cadastro próprio com nome, descrição, categoria, imagem opcional, custo em pontos, edição, arquivamento e grade visual; o servidor valida o custo e o resgate exige confirmação, pode gerar saldo negativo, cria histórico próprio e nunca apaga movimentações anteriores.
- [ ] **Metas com múltiplas fontes:** metas aceitam fontes de hábitos, tarefas, indicadores de módulos, treinos quando explicitamente vinculados e progresso manual; fontes têm proporções configuráveis; progresso manual possui histórico; uma mesma atividade não é contada duas vezes.
- [x] **Treinos independentes:** novas sessões não geram pontos automaticamente nem criam hábitos ou tarefas; pontos antigos, fichas, sessões, exercícios, séries, cargas e estatísticas permanecem; treino só contribui para uma meta quando houver vínculo configurado pelo usuário.
- [ ] **Dashboard e relatórios determinísticos:** dashboard e relatórios exibem resumo de pontos, hábitos, tarefas, metas, desempenho, evolução diária/semanal/mensal, constância, pontos fortes, pontos fracos, resultados negativos e estatísticas de treinos em bloco separado; notas geral e por categoria usam 85–100 Excelente, 70–84 Bom, 50–69 Regular e 0–49 Precisa melhorar; sem dados suficientes exibem “Dados insuficientes”; análises novas não usam IA.
- [ ] **Compatibilidade, segurança e backup:** migrações são aditivas e precedidas por verificação de órfãos/duplicidades; todas as novas tabelas e referências entram no backup/restauração; operações continuam protegidas por usuário; isolamento entre duas contas, idempotência, exportação/restauração e permissões são testados antes do checkpoint de cada etapa.
