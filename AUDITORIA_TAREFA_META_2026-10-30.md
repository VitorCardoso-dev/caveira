# Evidência autenticada — tarefa e meta

Em 30 de outubro de 2026, o fluxo foi executado no Preview com uma sessão autenticada do usuário.

1. A tela `/metas` mostrou a meta antiga `Físico forte e bonito` como **manual**, com progresso `1/100`. Concluir uma tarefa não altera uma meta manual; esse foi o motivo do teste original não produzir avanço.
2. Foi criada uma meta de teste com tipo **Tarefas concluídas** e alvo `1`.
3. Foi criada uma tarefa e vinculada explicitamente a essa meta pelo seletor **Meta vinculada**.
4. A tarefa foi concluída na tela `/tarefas`.
5. Ao retornar a `/metas`, a meta passou de `0/1` para `1/1` e apareceu como **concluída**.
6. Os dois registros de teste foram removidos diretamente com filtros simultâneos de ID, usuário e título. Nenhum registro existente foi alterado.

A correção persiste o `goalId` da tarefa, valida a propriedade da meta no servidor e calcula a meta automática usando tarefas concluídas vinculadas ao seu próprio ID. O cliente não consegue transformar uma meta manual em progresso automático por manipulação de payload sem passar pela validação server-side.

Evidência visual capturada durante o fluxo:

- Meta automática criada: `/home/ubuntu/screenshots/8328-iz7iy9qdklp7j0k_2026-10-30_13-55-38_7832.webp`
- Tarefa vinculada criada: `/home/ubuntu/screenshots/8328-iz7iy9qdklp7j0k_2026-10-30_13-56-11_7078.webp`
- Meta em `1/1` concluída: `/home/ubuntu/screenshots/8328-iz7iy9qdklp7j0k_2026-10-30_13-56-28_8117.webp`
