/*
 * The port a suite serves on, overridable so two checkouts on one machine can
 * run their suites at once. Both configs use `reuseExistingServer: false`, but
 * that only refuses a server already listening: two suites starting together on
 * one port can each reach the other's server, which is how a Worker test once
 * read an email written into another worktree.
 */
const PORT_MIN = 1024;
const PORT_MAX = 65_535;

export const portFromEnv = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;

  const port = Number(raw);
  if (!Number.isInteger(port) || port < PORT_MIN || port > PORT_MAX) {
    throw new Error(
      `${name}=${raw} is not a port. Use a whole number from ${PORT_MIN} to ${PORT_MAX}.`,
    );
  }
  return port;
};

export const TEST_PORT = portFromEnv('TEST_PORT', 4321);
export const TEST_WORKER_PORT = portFromEnv('TEST_WORKER_PORT', 4322);
