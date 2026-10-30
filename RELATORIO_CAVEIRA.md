# Relatório de avaliação — CAVEIRA

**Data da avaliação:** 30 de outubro de 2026  
**Versão auditada:** `b8768b1`  
**Escopo:** produto, experiência, funcionalidades, segurança, qualidade técnica e prontidão comercial.

## Resumo executivo

O CAVEIRA é um **MVP pessoal funcional**, com uma identidade visual forte, autenticação privada, persistência em banco, dashboard, hábitos, tarefas, metas, foco, módulos de treino/alimentação/finanças, relatórios, PWA e uma primeira camada de gamificação com pontos semanais e recompensas.

Ele ainda **não está pronto para ser comercializado como produto confiável para o público geral**. O maior motivo não é o visual: são lacunas de produto, regras de pontos ainda incompletas, cobertura de testes pequena, ausência de recursos essenciais para uma operação comercial e alguns riscos de consistência do saldo de recompensas.

## Nota geral

### Nota como MVP pessoal: **7,0/10**

O app já entrega valor real para uma única pessoa, possui uma base técnica coerente e as operações principais persistem no banco. A identidade e o conceito são diferenciados.

### Nota como produto comercializável hoje: **4,2/10**

A nota cai porque comercialização exige confiabilidade em cenários variados, onboarding, recuperação de conta, suporte a múltiplos usuários, privacidade formal, testes de fluxos críticos, cobrança ou estratégia de negócio, observabilidade e regras de dados muito mais rigorosas.

### Nota consolidada de prontidão: **5,8/10**

| Dimensão | Nota | Diagnóstico |
|---|---:|---|
| Proposta e diferenciação | 8,0 | Conceito claro: disciplina, evolução e recompensa privada. |
| Identidade visual | 8,0 | Marca forte, coerente e memorável; o dark mode diferencia o app. |
| Dashboard e navegação | 7,0 | Boa centralização, mas alguns módulos ficam escondidos por rota direta. |
| Hábitos, tarefas e metas | 6,0 | CRUD básico funciona; faltam recorrência, subtarefas, calendário e histórico rico. |
| Pontuação e recompensas | 5,5 | Regras simples foram implementadas, mas ainda precisam de ledger e validação mais robustos. |
| Treino e alimentação | 4,5 | Existem registros básicos, mas não bibliotecas, planos, gráficos, água, macros completos ou progresso físico. |
| Finanças | 5,0 | Lançamentos e assistente existem; faltam orçamento, recorrências, contas e relatórios financeiros completos. |
| Segurança e privacidade | 5,5 | Escopo por usuário e autenticação existem; faltam exclusão completa, política, consentimentos e auditoria de segurança. |
| Qualidade e testes | 4,5 | `check`, `test` e `build` passam, porém há apenas 6 testes automatizados e quase nenhum teste de produto ponta a ponta. |
| Performance e operação | 5,0 | Build funciona, mas há bundle principal acima de 500 kB, warning de script no Vite e pouca observabilidade. |
| Prontidão comercial | 4,2 | Ainda faltam multiusuário maduro, onboarding, suporte, métricas, planos e preparação legal/operacional. |

## O que já está bom

- A aplicação tem uma personalidade visual própria e não parece um dashboard genérico.
- A autenticação é real e os dados principais são consultados com escopo por usuário.
- Há persistência em MySQL/Drizzle e migrações versionadas.
- O dashboard usa dados reais, sem depender de `localStorage` como banco definitivo.
- Tarefas com prazo vencido deixam de aparecer como abertas e afetam o placar.
- O sistema de pontuação adotou valores baixos e compreensíveis: hábitos, tarefas por prioridade, metas, foco e penalidades.
- O app possui exportação/importação JSON, PWA, service worker, perfil e endpoint de saúde.
- As validações atuais passam: TypeScript, 6 testes automatizados e build de produção.

## Principais problemas que impedem um app “perfeito”

### 1. Pontos e recompensas ainda não formam uma carteira financeira confiável

O saldo semanal é calculado a partir de eventos derivados, mas os débitos de resgate são persistidos separadamente. Isso cria risco de inconsistência entre semanas e entre saldo exibido e saldo realmente disponível. O endpoint de resgate deve recalcular e validar o saldo no servidor dentro de uma operação transacional, e não confiar apenas no saldo verificado no cliente.

Também faltam:

- histórico visual de créditos e débitos;
- idempotência contra duplo clique e requisições repetidas;
- estorno ou cancelamento de resgate;
- regras explícitas para pontos que atravessam a virada da semana;
- testes para marcar/desmarcar, editar e concluir novamente sem duplicar pontos;
- limites e regras configuráveis pelo usuário.

**Prioridade: crítica.**

### 2. O modelo de obrigações ainda é simples demais

Hábitos semanais e personalizados ainda não têm uma agenda realmente interpretada. Faltam dias específicos, pausas, dispensas, lembretes e uma distinção segura entre “não realizado”, “não aplicável” e “não registrado”. Penalizar automaticamente um hábito sem considerar sua frequência, data de criação ou pausa pode produzir uma pontuação injusta.

Tarefas ainda não têm recorrência, subtarefas, checklist, ordenação manual, filtros, visualizações por período ou edição completa em todas as telas.

**Prioridade: alta.**

### 3. A análise semanal é curta e não explica suficientemente o comportamento

O relatório mostra ganhos, perdas, saldo e percentual, mas ainda não mostra com profundidade:

- quais hábitos foram mais consistentes;
- quais obrigações causaram as perdas;
- comparação com a semana anterior;
- tendências de melhora ou queda;
- dias fortes e dias críticos;
- três prioridades sugeridas para a semana seguinte;
- explicação auditável de cada ponto ganho ou perdido.

**Prioridade: alta.**

### 4. Os módulos de treino, alimentação e finanças são registros, não produtos completos

Eles têm uma base funcional, porém ainda faltam os recursos que fariam o usuário permanecer no app:

- treino: biblioteca, fichas, divisão por dias, descanso, recordes, gráficos, medidas e recuperação;
- alimentação: água, macros completos, alimentos personalizados, receitas, lista de compras e metas nutricionais;
- finanças: orçamento, recorrência, contas a pagar/receber, metas de economia, filtros, gráficos e fechamento mensal.

**Prioridade: alta, mas deve ser executada por etapas.**

### 5. A cobertura de testes é insuficiente para vender o produto

Hoje os checks técnicos passam, mas a suíte tem somente 6 testes automatizados concentrados em autenticação/plataforma. Faltam testes de regras de negócio e testes de interface para os fluxos mais sensíveis:

- prazo vencido;
- pontuação semanal;
- dedução por falha;
- resgate sem saldo;
- prevenção de pontos duplicados;
- isolamento entre usuários;
- exportação e importação de backup;
- exclusão e restauração;
- responsividade em celular.

**Prioridade: crítica antes de qualquer lançamento público.**

### 6. Privacidade e operação comercial ainda não estão fechadas

Para comercializar, será necessário preparar política de privacidade, termos de uso, consentimento para dados sensíveis, retenção e exclusão, exportação completa, gestão de sessão, recuperação de conta, suporte, logs operacionais e tratamento de incidentes. Dados de saúde, alimentação e finanças merecem uma revisão de segurança e privacidade específica.

**Prioridade: crítica antes de usuários pagantes.**

### 7. Há dívida técnica de manutenção

O projeto concentra uma quantidade grande de JSX em `Home.tsx` e principalmente em `ModulePage.tsx`. Isso torna mudanças futuras mais lentas e aumenta o risco de regressão. O ideal é separar componentes reutilizáveis, formulários, cards, tabelas e cada domínio em arquivos próprios.

O build também informa um bundle principal acima de 500 kB e um warning sobre o script `/api/platform/config.js` sem `type="module"`. Não bloqueia a execução, mas deve ser resolvido antes de escalar.

## O que fazer para chegar a uma versão comercial

### Etapa 1 — Confiabilidade do núcleo

1. Transformar pontos em um ledger completo: cada crédito e débito precisa ter origem, data, valor, referência, idempotência e auditoria.
2. Validar resgates exclusivamente no servidor e dentro de transação.
3. Criar testes de unidade para todas as regras de pontos.
4. Criar testes de integração para tarefas vencidas, hábitos, metas e recompensas.
5. Corrigir a semântica de hábitos: frequência, pausa, dispensado, perdido e não aplicável.
6. Adicionar histórico “por que recebi/perdi estes pontos?”.

### Etapa 2 — Produto diário de alta retenção

1. Implementar onboarding com configuração de objetivo, rotina e primeira recompensa.
2. Adicionar calendário semanal com filtros e revisão diária.
3. Implementar tarefas recorrentes, subtarefas, ordenação e filtros.
4. Criar fechamento semanal com comparação contra a semana anterior.
5. Adicionar notificações controladas e lembretes configuráveis.
6. Melhorar estados vazios, mensagens de erro, acessibilidade e navegação mobile.

### Etapa 3 — Módulos que justificam uso recorrente

1. Evoluir treino para fichas, exercícios, histórico e gráficos.
2. Evoluir alimentação para diário completo, água, macros e metas editáveis.
3. Evoluir finanças para orçamento, recorrência, metas e relatórios.
4. Adicionar importação CSV e exportação CSV/JSON completa.
5. Criar gráficos legíveis e comparações de período.

### Etapa 4 — Preparação comercial

1. Definir público inicial e posicionamento: produtividade disciplinada, evolução pessoal ou plataforma integrada.
2. Testar com 10–20 usuários reais antes de cobrar.
3. Implementar multiusuário com isolamento rigorosamente testado.
4. Criar onboarding, recuperação de conta, suporte e central de ajuda.
5. Preparar LGPD, política de privacidade, termos, consentimento e exclusão de dados.
6. Definir modelo de negócio, limites do plano gratuito e proposta do plano pago.
7. Adicionar observabilidade, alertas, backups automáticos e plano de recuperação.
8. Medir ativação, retenção semanal, conclusão de tarefas, resgates e abandono.

## Critério prático de lançamento

Eu não recomendaria cobrar pelo CAVEIRA ainda. Recomendaria primeiro um **beta fechado gratuito**, com foco em uma única promessa: “ajudar a pessoa a cumprir obrigações reais ao longo da semana sem gamificação exagerada”.

O produto poderia ser considerado pronto para um beta público quando atingir:

- 30+ testes de regras de negócio;
- testes de fluxo dos principais caminhos autenticados;
- saldo de recompensas validado integralmente no servidor;
- onboarding concluído em menos de 3 minutos;
- comparação semanal clara;
- exportação e exclusão de dados verificadas;
- ausência de bugs críticos por pelo menos duas semanas de uso;
- feedback positivo de usuários reais em tarefas, hábitos e recompensas.

## Veredito final

O CAVEIRA **não é um app vazio nem um protótipo descartável**. Ele já é uma base funcional e visualmente diferenciada para uso pessoal. A melhor decisão agora não é adicionar dezenas de telas: é tornar o núcleo de obrigações, pontos e recompensas matematicamente confiável, explicável e testado.

Depois disso, o próximo salto de valor será escolher um foco comercial claro. Tentar vender simultaneamente produtividade, treino, nutrição e finanças antes de aprofundar qualquer um deles pode deixar o produto amplo, porém superficial.

**Recomendação:** beta fechado primeiro; comercialização somente após concluir a Etapa 1 e a preparação de privacidade/operação da Etapa 4.
