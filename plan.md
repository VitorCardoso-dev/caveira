# CAVEIRA — plano de implementação

## Escopo aprovado

Construir o CAVEIRA como um sistema pessoal privado de evolução integral. A entrega incremental começa pela Fase 1: estrutura da aplicação, navegação, dashboard com indicadores calculados e persistência real no banco gerenciado. As fases seguintes entram sobre a mesma fundação sem trocar a stack.

## Abordagem de implementação

- **Stack preservada:** React + TypeScript + Vite no cliente; Express + tRPC no servidor; Drizzle ORM + MySQL gerenciado para dados persistentes; Tailwind CSS e componentes Radix já presentes no starter.
- **Privacidade:** usar a autenticação Manus OAuth já preparada pelo template e `protectedProcedure` para qualquer dado pessoal. Não criar login simulado, multiusuário público ou dados fictícios apresentados como reais.
- **Fase 1 de dados:** adicionar tabelas pessoais de hábitos, tarefas, metas, atividades de foco e preferências de perfil em Drizzle. Todas as entidades carregadas por `userId`, com timestamps e registro de alteração onde aplicável. O dashboard agrega dados do banco em uma consulta tRPC protegida e ações rápidas gravam registros reais.
- **Evolução por módulos:** manter `server/routers.ts` como fronteira de API, queries em `server/db.ts`, schema/migrações em `drizzle/`, componentes de domínio em `client/src/components/` e páginas em `client/src/pages/`. A navegação terá rotas declaradas e manifesto `/manus-routes.json` sincronizado.
- **Persistência e experiência:** formulários com validação no cliente e servidor, estados vazios úteis, feedback via toast, confirmação para exclusões e atualização otimista apenas quando não puder mascarar falha de gravação. Nenhum indicador deve depender exclusivamente de `localStorage`; o storage local poderá guardar apenas preferências não sensíveis enquanto a fonte de verdade é o banco.
- **Próximas fases:** hábitos/tarefas/metas e foco; treino; nutrição; finanças e IA; XP/recompensas; relatórios, backups e PWA. Cada módulo reutiliza o mesmo padrão de CRUD, autorização por usuário e cálculo explicável.

## Estrutura de projeto

- `client/src/App.tsx`: shell autenticado e roteamento principal.
- `client/src/pages/Home.tsx`: dashboard diário e ações rápidas.
- `client/src/pages/Modules.tsx`: páginas iniciais dos módulos e seus estados vazios.
- `client/src/components/`: shell visual, navegação lateral, cards de resumo, dialogs e formulários reutilizáveis.
- `client/src/index.css`: tokens, tema dark padrão, responsividade e detalhes de marca.
- `server/routers.ts`: procedimentos tRPC de autenticação, dashboard e CRUD inicial.
- `server/db.ts`: consultas e mutações Drizzle com escopo por usuário.
- `drizzle/schema.ts` e `drizzle/*.sql`: modelo persistente e migrações aditivas.
- `public/manus-routes.json`: rotas de página conhecidas para o Preview/publicação.
- `app.config.ts`: metadados de logo do projeto antes do checkpoint.

## Direção visual e de produto

- **Movimento:** brutalismo editorial refinado / dashboard de treino de alta performance. O visual deve parecer uma central de comando pessoal, não um app de bem-estar genérico.
- **Princípios:** (1) clareza operacional acima de decoração; (2) contraste forte e hierarquia de ação; (3) progresso visível, sem culpa; (4) densidade controlada para permitir uso diário.
- **Filosofia de cor:** preto carvão e grafite criam foco e silêncio visual; branco quebrado garante leitura; vermelho-caveira é reservado a ações, alertas e estados de intensidade para permanecer raro e significativo.
- **Paleta:** `#0B0B0D` fundo, `#121216` superfícies, `#1F1F25` bordas e camadas, `#F2F0EC` texto principal, `#98979D` texto secundário, `#E53935` vermelho-caveira, `#B7F36B` verde ácido apenas para progresso confirmado.
- **Layout:** shell assimétrico com rail lateral fixo no desktop, cabeçalho de contexto e área de conteúdo em trilhos; no mobile, rail vira barra inferior/atalhos. Cards de resumo têm bordas e barras de progresso, não painéis flutuantes excessivos.
- **Assinaturas:** monograma/caveira geométrica em CSS/SVG como marca; barras de progresso com marcador de “linha de combate”; micro-rótulos em caixa alta com tracking amplo e contadores monoespaçados.
- **Interação:** cada ação deve responder imediatamente com estado claro; concluir é afirmativo e reversível com histórico; excluir é explícito e protegido; recompensas nunca usam linguagem de punição ou vergonha.
- **Animação:** entrada curta de 180–240 ms, progresso com easing suave, pulso discreto apenas para estado ativo; não animar tudo nem criar distrações em dados e timers.
- **Tipografia:** `Inter` para leitura e interface, `JetBrains Mono` para métricas, horários e números de progresso; títulos em peso 700/800, labels compactos em 11–12px com tracking de 0.12em.
- **Essência de marca:** “um painel privado para transformar consistência em evolução mensurável”; personalidade **intensa, lúcida, sustentável**.
- **Voz:** headlines diretas e sem frases motivacionais vazias; CTAs são verbos concretos. Exemplos: “Hoje é construído no próximo bloco.” / “Registre o real. Ajuste o plano.”
- **Wordmark/logo:** palavra CAVEIRA em caixa alta com um recorte angular no A e um ícone de caveira geométrica construído por duas cavidades e uma mandíbula curta; o símbolo deve funcionar sozinho em rail e favicon.
- **Cor proprietária:** vermelho-caveira `#E53935`, usado com parcimônia para distinguir o CAVEIRA de dashboards genéricos.

## Build e validação

O projeto deve rodar com `pnpm dev` em `0.0.0.0:3000`, expor `/api/health` e `/manus-routes.json`, passar por `pnpm check`, `pnpm test` e `pnpm build`. Mudanças de schema devem gerar migração Drizzle aditiva e ser aplicadas conscientemente ao banco gerenciado compartilhado. Antes de um checkpoint, revisar a diff, configurar `logoUrl` literal em `app.config.ts`, confirmar que o dashboard não contém dados de demonstração e salvar no Git canônico; publicação só ocorre se autorizada pela configuração existente.
