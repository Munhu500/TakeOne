/** DEMO_MODE=true, or a missing key, always selects the mock implementation. */
export function isDemoMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.DEMO_MODE ?? 'true').toLowerCase() !== 'false';
}
export function useReal(key: string | undefined, env: NodeJS.ProcessEnv = process.env): key is string {
  return !isDemoMode(env) && !!key;
}
