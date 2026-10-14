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
