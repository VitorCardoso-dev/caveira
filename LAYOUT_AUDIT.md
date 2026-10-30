# Auditoria de layout — CAVEIRA

**Data:** 30 de outubro de 2026  
**Servidor:** Preview local do projeto na porta 3000  
**Critério:** não considerar “responsivo” como aprovado sem captura em múltiplas resoluções.

## Matriz executada

| Viewport | Rotas capturadas | Resultado observável |
|---|---|---|
| 1280 × 720 | `/`, `/metas`, `/relatorios`, `/recompensas` | A tela pública de autenticação renderizou sem corte horizontal. Rotas protegidas ficaram no estado de carregamento porque o capturador não possuía uma sessão autenticada. |
| 768 × 1024 | `/` | A tela pública de autenticação manteve o cartão centralizado, os campos dentro da largura disponível e sem corte horizontal visível. |
| 375 × 812 | `/`, `/metas`, `/relatorios`, `/recompensas` | A tela pública de autenticação se adaptou ao celular; textos, botões e campos permaneceram dentro da viewport. Rotas protegidas ficaram no estado de carregamento sem sessão. |

## Evidências PNG

- Desktop: `/home/ubuntu/.addon-screenshots/wdp_8bad0ba83ffb08df03b17c72/20261030-133032-w-xIqQ/0-root.png`
- Desktop — metas: `/home/ubuntu/.addon-screenshots/wdp_8bad0ba83ffb08df03b17c72/20261030-133032-w-xIqQ/1-metas.png`
- Desktop — relatórios: `/home/ubuntu/.addon-screenshots/wdp_8bad0ba83ffb08df03b17c72/20261030-133032-w-xIqQ/2-relatorios.png`
- Desktop — recompensas: `/home/ubuntu/.addon-screenshots/wdp_8bad0ba83ffb08df03b17c72/20261030-133032-w-xIqQ/3-recompensas.png`
- Mobile: `/home/ubuntu/.addon-screenshots/wdp_8bad0ba83ffb08df03b17c72/20261030-133051-pbUgFA/0-root.png`
- Mobile — metas: `/home/ubuntu/.addon-screenshots/wdp_8bad0ba83ffb08df03b17c72/20261030-133051-pbUgFA/1-metas.png`
- Mobile — relatórios: `/home/ubuntu/.addon-screenshots/wdp_8bad0ba83ffb08df03b17c72/20261030-133051-pbUgFA/2-relatorios.png`
- Mobile — recompensas: `/home/ubuntu/.addon-screenshots/wdp_8bad0ba83ffb08df03b17c72/20261030-133051-pbUgFA/3-recompensas.png`
- Tablet: `/home/ubuntu/.addon-screenshots/wdp_8bad0ba83ffb08df03b17c72/20261030-133212-v02oPw/0-root.png`

## Status de aprovação

- **Shell público de autenticação:** aprovado visualmente nas três resoluções capturadas.
- **Dashboard e módulos autenticados:** não aprovado ainda nesta rodada, porque a captura foi feita sem sessão e mostrou carregamento/login. É necessário repetir a matriz com uma sessão autenticada para validar os componentes reais, gráficos, cartões e navegação interna.
- **Overflow horizontal:** não foi observado na superfície pública capturada; a confirmação definitiva depende da repetição autenticada.

## Validações técnicas relacionadas

- `pnpm check`: aprovado.
- `pnpm test`: aprovado — 9 testes em 3 arquivos.
- `pnpm build`: aprovado, com dois avisos não bloqueantes: script de configuração sem `type="module"` e chunk JavaScript principal acima de 500 kB.
- `/api/health`: HTTP 200.
- `/manus-routes.json`: HTTP 200.
