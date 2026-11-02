/**
 * Host half of dsh-ui-dock.
 *
 * The bundle only needs a Host row so the Loader can activate it and the
 * Client half (`./client`) can register into the shell slots. There is no
 * Host-side capability, no Tool, and no state file to own: every setting
 * lives in the browser (`localStorage['dsh:ui-dock:v1']`) because it only
 * drives CSS variables and per-row visibility.
 *
 * @param {object} ctx Host root context.
 */
export function apply(ctx) {
  // Nothing to register on the Host. Log once so a `failed` row is diagnosable
  // instead of silent.
  ctx.effect(() => () => {}, 'ui-dock: host half')
}
