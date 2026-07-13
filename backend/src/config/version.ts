/**
 * Build identity, baked in at image-build time on the Dev PC.
 *
 * The Production PC is airgapped: nobody there can check a git tag or diff a
 * commit. If the running system cannot state its own version, there is no way to
 * know what is deployed or whether an update actually took effect — so this is
 * exposed unauthenticated at GET /api/version and used by the update script to
 * verify a rollout landed.
 *
 * Values arrive as Docker build args -> ENV. The fallbacks only ever show up in
 * a local dev run, never in a released image.
 */
export const buildInfo = {
  version: process.env.APP_VERSION ?? '0.0.0-dev',
  /** ISO-8601 UTC, stamped when the image was built. */
  builtAt: process.env.BUILD_TIME ?? 'unknown',
  /** Short git SHA of the tree the release was cut from. */
  commit: process.env.GIT_COMMIT ?? 'unknown',
} as const;
