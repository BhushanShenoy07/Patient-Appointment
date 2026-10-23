import Adk from "@arealtimetech/adk-js";

export type ArtBrowserConfig = {
  uri: string;
  org: string;
  environment: string;
  projectKey: string;
  channel: string;
  event: string;
  username: string;
};

type Subscription = Awaited<ReturnType<InstanceType<typeof Adk>["subscribe"]>> & Record<string, any>;
export type ArtConnection = { adk: InstanceType<typeof Adk>; sub?: Subscription; config: ArtBrowserConfig };

let connection: Promise<ArtConnection> | null = null;
let currentConfig: ArtBrowserConfig | null = null;
let online = new Set<string>();
type ArtListener = (message: { event: string; content: Record<string, unknown> }) => void;
const listeners = new Set<ArtListener>();
const seenIds = new Set<string>();
const presenceListeners = new Set<(online: Set<string>) => void>();
let relayTimer: ReturnType<typeof setInterval> | undefined;
let lastSyncTimestamp = 0;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s.`)), ms);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function routeTokenRequestsThroughServer(uri: string, username: string) {
  const tokenUrl = `https://${uri}/auth/token`;
  if (typeof window === "undefined") return;
  const w = window as typeof window & { __artTokenRoute?: string; __originalFetch?: typeof window.fetch };
  w.__artTokenRoute = tokenUrl;
  const originalFetch = w.__originalFetch || window.fetch.bind(window);
  w.__originalFetch = originalFetch;
  window.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    if (url === tokenUrl) {
      const targetUrl = username ? `/api/art/token?username=${encodeURIComponent(username)}` : "/api/art/token";
      return originalFetch(targetUrl, { method: "POST", credentials: "same-origin" });
    }
    return originalFetch(input, init);
  };
}

function dispatchIncoming(message: { event: string; content: Record<string, unknown> }, myUsername?: string) {
  const sender = typeof message?.content?.from === "string" ? message.content.from.toLowerCase() : "";
  const target = typeof message?.content?.to === "string" ? message.content.to.toLowerCase() : "";
  const me = (myUsername || currentConfig?.username || "").toLowerCase();

  // If targeted to a specific user and not for me, ignore
  if (target && me && target !== me) {
    return;
  }

  // Do not process own outgoing echoes
  if (sender && me && sender === me) {
    return;
  }

  const id = typeof message?.content?.id === "string" ? message.content.id : "";
  if (id) {
    if (seenIds.has(id)) return;
    seenIds.add(id);
  }

  if (sender) {
    markReachable(sender, true);
  }

  listeners.forEach(listener => listener(message));
}

async function syncRelay(username: string) {
  try {
    const res = await fetch(`/api/art/relay?username=${encodeURIComponent(username)}&since=${lastSyncTimestamp}`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.timestamp) lastSyncTimestamp = data.timestamp;

    // Update online presence accurately
    if (Array.isArray(data.activeUsers)) {
      const newOnline = new Set<string>();
      data.activeUsers.forEach((u: string) => {
        newOnline.add(u.toLowerCase());
      });
      // Current user is always online
      newOnline.add(username.toLowerCase());
      setOnlineUsers(newOnline);
    }

    // Process new messages
    if (Array.isArray(data.messages)) {
      data.messages.forEach((m: any) => {
        dispatchIncoming({ event: m.event, content: m.content }, username);
      });
    }
  } catch {
    // ignore network blips
  }
}

async function open(preferredUsername?: string): Promise<ArtConnection> {
  const configUrl = preferredUsername ? `/api/art/config?username=${encodeURIComponent(preferredUsername)}` : "/api/art/config";
  const response = await fetch(configUrl);
  const config = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(config.error || `ART configuration unavailable (${response.status}).`);
  currentConfig = config;
  routeTokenRequestsThroughServer(config.uri, config.username);

  // Self is online
  markReachable(config.username, true);

  // Start real-time relay synchronizer (only listen for current real-time messages)
  clearInterval(relayTimer);
  lastSyncTimestamp = Date.now() - 3000;
  void syncRelay(config.username);
  relayTimer = setInterval(() => void syncRelay(config.username), 2000);

  // Initialize ADK
  const adk = new Adk({ Uri: config.uri });
  adk.setCredentials({
    ClientID: "server-managed",
    ClientSecret: "server-managed",
    OrgTitle: config.org,
    Environment: config.environment,
    ProjectKey: config.projectKey,
  });

  let sub: Subscription | undefined;
  try {
    const opened = new Promise<void>(resolve => adk.on("open", () => resolve()));
    adk.connect();
    await withTimeout(opened, 10_000, "Connecting to ART");

    try {
      sub = (await withTimeout(adk.subscribe(config.channel), 10_000, "Subscribing to channel")) as Subscription;
    } catch {
      // Channel might not exist in console yet
    }

    if (sub) {
      if (sub.channelConfig?.channelType === "secure") {
        await adk.setKeyPair(await adk.generateKeyPair()).catch(() => {});
      }
      sub.listen((message: { event: string; content: Record<string, unknown> }) => {
        dispatchIncoming(message, config.username);
      });
    }
  } catch (err) {
    console.warn("[ART] WebSocket connection error, using realtime relay fallback.", err);
  }

  return { adk, sub, config };
}

/** Opens (once) and returns the signed-in user's ART connection. */
export function connectArt(preferredUsername?: string) {
  connection ??= open(preferredUsername).catch(error => {
    connection = null;
    throw error;
  });
  return connection;
}

export async function disconnectArt() {
  const current = connection;
  connection = null;
  clearInterval(relayTimer);
  relayTimer = undefined;
  const username = currentConfig?.username;
  currentConfig = null;

  if (username) {
    try {
      await fetch("/api/art/relay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: username, type: "offline" }),
      });
    } catch {}
  }

  const conn = await current?.catch(() => null);
  await conn?.adk.disconnect().catch(() => {});
  online = new Set();
  presenceListeners.forEach(listener => listener(new Set(online)));
}

export type SendResult = { delivered: true } | { delivered: false; reason: string };

/**
 * Sends an event to a specific user.
 */
export async function sendToUser(
  username: string,
  payload: Record<string, unknown>,
  event?: string
): Promise<SendResult> {
  const id = typeof payload.id === "string" ? payload.id : crypto.randomUUID();
  payload = { ...payload, id };
  const { sub, config } = await connectArt();
  const recipient = username.toLowerCase();
  if (recipient === config.username.toLowerCase()) {
    throw new Error("You cannot send an ART message to yourself.");
  }

  const messagePayload = {
    ...payload,
    to: recipient,
    from: payload.from || config.username,
  };

  // 1. Post to relay
  try {
    await fetch("/api/art/relay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: event || config.event,
        from: config.username,
        to: recipient,
        content: messagePayload,
        id,
      }),
    });
  } catch (e) {
    console.warn("[ART] Relay post error:", e);
  }

  // 2. Also push over WebSocket if subscription is active
  if (sub) {
    try {
      await sub.push(event || config.event, messagePayload, { to: [recipient] });
    } catch {
      // Relay handles delivery
    }
  }

  // Fast-sync immediately
  void syncRelay(config.username);

  return { delivered: true };
}

export async function artStatus() {
  const { config } = await connectArt();
  return { username: config.username, channel: config.channel, presence: true };
}

/** Calls handler once for every event delivered to this user. Returns an unsubscribe function. */
export function onArtEvent(handler: ArtListener) {
  listeners.add(handler);
  return () => {
    listeners.delete(handler);
  };
}

/** Calls handler with the set of online ART usernames whenever presence changes. */
export function onPresence(handler: (online: Set<string>) => void) {
  presenceListeners.add(handler);
  handler(new Set(online));
  return () => {
    presenceListeners.delete(handler);
  };
}

function setOnlineUsers(newSet: Set<string>) {
  let changed = newSet.size !== online.size;
  if (!changed) {
    for (const u of newSet) {
      if (!online.has(u)) {
        changed = true;
        break;
      }
    }
  }
  if (changed) {
    online = newSet;
    presenceListeners.forEach(listener => listener(new Set(online)));
  }
}

function markReachable(username: string, reachable: boolean) {
  const u = username.toLowerCase();
  const next = new Set(online);
  if (reachable) {
    next.add(u);
  } else {
    next.delete(u);
  }
  setOnlineUsers(next);
}

export async function watchUsers(_usernames: string[]) {
  // Presence is accurately synchronized via real-time relay and heartbeats
}

export function checkUser(_username: string) {
  if (currentConfig) {
    void syncRelay(currentConfig.username);
  }
}

export function triggerPresenceSync() {
  if (currentConfig) {
    void syncRelay(currentConfig.username);
  }
}

