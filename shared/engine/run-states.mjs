/**
 * Estados do run e o que cada um autoriza (F5 — requisito §8).
 *
 * Módulo só de constantes, sem import nenhum, para ser a **única** fonte de
 * verdade compartilhada por:
 *   · `shared/engine/execution-manager.mjs` (quem produz os estados);
 *   · `shared/services/studio-service.mjs` (quem aceita retomar);
 *   · `shared/ui/journey.mjs` e a interface (quem oferece a ação ao usuário).
 *
 * A regra que importa aqui: a interface nunca oferece uma ação que o serviço
 * recusaria, e o serviço nunca aceita um estado que a interface esconde. Se as
 * duas listas divergem, o usuário lê "você pode retomar" e recebe um erro — ou
 * tem um run retomável sem botão nenhum.
 */

/** Estados possíveis de um run gravado em `.lia-forge/runs/<runId>/run.json`. */
export const RUN_STATES = Object.freeze(['planned', 'running', 'succeeded', 'failed', 'cancelled', 'blocked', 'paused']);

/**
 * Estados a partir dos quais retomar faz sentido: o run está encerrado sem ter
 * entregue o resultado, e os passos concluídos ficaram em checkpoint.
 * `planned`/`running` não entram (o run ainda não terminou ou está em execução
 * neste processo) e `succeeded` não entra (não há o que retomar).
 */
export const RESUMABLE_RUN_STATES = Object.freeze(['cancelled', 'paused', 'blocked', 'failed']);

/** Estados em que o run já terminou e nada mais executa neste processo. */
export const TERMINAL_RUN_STATES = Object.freeze(['succeeded', 'failed', 'cancelled', 'blocked']);

/** O estado aceita retomada pelo serviço? */
export function isResumableRunState(status) {
  return RESUMABLE_RUN_STATES.includes(String(status ?? ''));
}
