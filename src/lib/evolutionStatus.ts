// Utilities to normalize and interpret Evolution API connection status responses
// Handles multiple possible shapes returned by different deployments

export function extractConnectionState(input: any): boolean | null {
  if (!input) return null;

  // If API wraps payload
  const candidate =
    // common shapes
    input?.state ??
    input?.status ??
    input?.instance?.state ??
    input?.instance?.status ??
    input?.connection?.state ??
    input?.connectionState ??
    // boolean flags
    (typeof input?.connected === 'boolean' ? (input.connected ? 'open' : 'close') : undefined) ??
    (typeof input?.isConnected === 'boolean' ? (input.isConnected ? 'open' : 'close') : undefined);

  // If still undefined, try to unwrap one level deep automatically
  const unwrap = typeof input === 'object' && Object.keys(input).length === 1
    ? input[Object.keys(input)[0]]
    : undefined;

  const candidate2 = candidate ?? unwrap?.state ?? unwrap?.status;

  return normalizeState(candidate2);
}

function normalizeState(value: unknown): boolean | null {
  if (value == null) return null;

  if (typeof value === 'boolean') return value;

  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    const connectedSet = new Set([
      'open', 'connected', 'online', 'up', 'ready', 'authenticated', 'logged', 'active'
    ]);
    const disconnectedSet = new Set([
      'close', 'closed', 'disconnected', 'offline', 'down', 'pairing', 'connecting', 'qr', 'waiting', 'timeout'
    ]);

    if (connectedSet.has(v)) return true;
    if (disconnectedSet.has(v)) return false;

    // handle enums like DELIVERY_ACK etc. -> not connection states
    if (/ack|fail|error|invalid/.test(v)) return null;
  }

  // Unknown structure
  return null;
}
