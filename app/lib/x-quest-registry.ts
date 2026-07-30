import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type XQuest = "follow" | "post" | "like" | "retweet";

type QuestVerification = {
  postId: string;
  completedAt: string | null;
  lastCheckedAt: string | null;
  pendingUntil?: string | null;
};

type XGrantRecord = {
  userId: string;
  username: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
  scopes: string[];
  follow: QuestVerification;
  post: QuestVerification;
  like: QuestVerification;
  retweet: QuestVerification;
};

type XTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

export type PublicQuestStatus = {
  connectedForVerification: boolean;
  follow: QuestVerification;
  post: QuestVerification;
  like: QuestVerification;
  retweet: QuestVerification;
};

export class XQuestCooldown extends Error {
  nextCheckAt: string;

  constructor(nextCheckAt: string, message = "This quest can only be rechecked once every 12 hours.") {
    super(message);
    this.nextCheckAt = nextCheckAt;
  }
}

export class XVerificationUnavailable extends Error {}

const TWELVE_HOURS = 12 * 60 * 60 * 1000;
const TEMPORARY_RETRY_MS = 20 * 60 * 1000;
const CREDITS_RETRY_MS = 60 * 60 * 1000;
const TARGET_POST_ID = "2082123080462446795";
const TARGET_ACCOUNT_USERNAME = "rhoodatm";
const CAMPAIGN_MESSAGE = "Word's out there is a new hood to be claimed @RHOODATM you in or you out?";
const registryPath =
  process.env.HOODATM_X_TOKEN_LOG_PATH || ".data/x-tokens.json";
let registryQueue: Promise<unknown> = Promise.resolve();
let cachedTargetUserId: string | null = process.env.X_TARGET_USER_ID?.trim() || null;

const emptyQuest = (targetId = TARGET_POST_ID): QuestVerification => ({
  postId: targetId,
  completedAt: null,
  lastCheckedAt: null,
  pendingUntil: null,
});

function isExactCampaignReferralUrl(value: string | undefined, username: string) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.origin === "https://hoodatm.online"
      && url.pathname === "/"
      && url.searchParams.size === 1
      && url.searchParams.get("ref") === `$GANGSTER${username}`;
  } catch {
    return false;
  }
}

async function readRecordsUnsafe(): Promise<XGrantRecord[]> {
  try {
    const records = JSON.parse(
      await readFile(/* turbopackIgnore: true */ registryPath, "utf8"),
    ) as Array<Partial<XGrantRecord> & Pick<XGrantRecord, "userId">>;
    return records.map((record) => ({
      userId: record.userId,
      username: record.username ?? "",
      accessToken: record.accessToken ?? "",
      refreshToken: record.refreshToken ?? null,
      expiresAt: record.expiresAt ?? 0,
      scopes: Array.isArray(record.scopes) ? record.scopes : [],
      follow: record.follow?.postId === TARGET_ACCOUNT_USERNAME
        ? { ...emptyQuest(TARGET_ACCOUNT_USERNAME), ...record.follow }
        : emptyQuest(TARGET_ACCOUNT_USERNAME),
      post: record.post?.postId === record.userId
        ? { ...emptyQuest(record.userId), ...record.post }
        : emptyQuest(record.userId),
      like: record.like?.postId === TARGET_POST_ID
        ? { ...emptyQuest(), ...record.like }
        : emptyQuest(),
      retweet: record.retweet?.postId === TARGET_POST_ID
        ? { ...emptyQuest(), ...record.retweet }
        : emptyQuest(),
    }));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeRecordsUnsafe(records: XGrantRecord[]) {
  await mkdir(dirname(registryPath), { recursive: true });
  const temporaryPath = `${registryPath}.tmp`;
  await writeFile(
    /* turbopackIgnore: true */ temporaryPath,
    JSON.stringify(records, null, 2),
    { encoding: "utf8", mode: 0o600 },
  );
  await rename(
    /* turbopackIgnore: true */ temporaryPath,
    /* turbopackIgnore: true */ registryPath,
  );
}

export async function saveXGrant(input: {
  userId: string;
  username: string;
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
  scopes: string[];
}) {
  const operation = registryQueue.then(async () => {
    const records = await readRecordsUnsafe();
    const existing = records.find((record) => record.userId === input.userId);
    const next: XGrantRecord = {
      userId: input.userId,
      username: input.username.toLowerCase(),
      accessToken: input.accessToken,
      refreshToken: input.refreshToken ?? existing?.refreshToken ?? null,
      expiresAt: Date.now() + Math.max(60, input.expiresIn) * 1000,
      scopes: input.scopes,
      follow: existing?.follow ?? emptyQuest(TARGET_ACCOUNT_USERNAME),
      post: existing?.post ?? emptyQuest(input.userId),
      like: existing?.like ?? emptyQuest(),
      retweet: existing?.retweet ?? emptyQuest(),
    };
    if (existing) Object.assign(existing, next);
    else records.push(next);
    await writeRecordsUnsafe(records);
  });
  registryQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

/** Full grant dump for admin offline backups. Treat the result as secret material. */
export async function listXGrantsForBackup() {
  await registryQueue;
  return readRecordsUnsafe();
}

export async function getXQuestStatus(userId: string): Promise<PublicQuestStatus> {
  await registryQueue;
  const record = (await readRecordsUnsafe()).find((candidate) => candidate.userId === userId);
  const connectedForVerification = ["users.read", "tweet.read", "like.read", "follows.read"]
    .every((scope) => record?.scopes.includes(scope));
  return {
    connectedForVerification: Boolean(
      connectedForVerification && (record?.accessToken || record?.refreshToken),
    ),
    follow: record?.follow ?? emptyQuest(TARGET_ACCOUNT_USERNAME),
    post: record?.post ?? emptyQuest(userId),
    like: record?.like ?? emptyQuest(),
    retweet: record?.retweet ?? emptyQuest(),
  };
}

async function refreshAccessToken(record: XGrantRecord) {
  if (record.expiresAt > Date.now() + 60_000 && record.accessToken) {
    return record.accessToken;
  }
  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;
  if (!record.refreshToken || !clientId) {
    throw new XVerificationUnavailable("Reconnect X to enable quest verification.");
  }

  const headers: HeadersInit = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: record.refreshToken,
  });
  if (clientSecret) {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
  } else {
    body.set("client_id", clientId);
  }
  const response = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers,
    body,
    cache: "no-store",
  });
  const token = await response.json() as XTokenResponse & {
    detail?: string;
    title?: string;
    type?: string;
  };
  if (!response.ok || !token.access_token) {
    throwForXFailure(
      response.status,
      token,
      "Reconnect X to refresh quest verification access.",
    );
  }
  record.accessToken = token.access_token;
  record.refreshToken = token.refresh_token ?? record.refreshToken;
  record.expiresAt = Date.now() + Math.max(60, token.expires_in ?? 7200) * 1000;
  if (token.scope) record.scopes = token.scope.split(" ").filter(Boolean);
  return record.accessToken;
}

type XPost = {
  id: string;
  text?: string;
  referenced_tweets?: Array<{ type: string; id: string }>;
  entities?: { urls?: Array<{ expanded_url?: string; unwound_url?: string }> };
};

class XTemporaryVerificationError extends Error {
  retryMs: number;

  constructor(message: string, retryMs = TEMPORARY_RETRY_MS) {
    super(message);
    this.retryMs = retryMs;
  }
}

function isCreditsDepletedPayload(payload: { detail?: string; title?: string; type?: string }) {
  const haystack = `${payload.title ?? ""} ${payload.detail ?? ""} ${payload.type ?? ""}`.toLowerCase();
  return haystack.includes("credits")
    || haystack.includes("usagecap")
    || haystack.includes("usage cap")
    || haystack.includes("rate limit");
}

function throwForXFailure(
  status: number,
  payload: { detail?: string; title?: string; type?: string },
  fallback: string,
): never {
  const message = payload.detail || payload.title || fallback;
  if (
    status === 429
    || status === 402
    || status >= 500
    || isCreditsDepletedPayload(payload)
  ) {
    const credits = isCreditsDepletedPayload(payload);
    throw new XTemporaryVerificationError(
      credits
        ? "X API credits are temporarily exhausted. Verification will retry automatically."
        : message,
      credits ? CREDITS_RETRY_MS : TEMPORARY_RETRY_MS,
    );
  }
  throw new XVerificationUnavailable(message);
}

async function fetchXPayload(url: string, accessToken: string) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const payload = await response.json() as {
    data?: unknown;
    meta?: { next_token?: string };
    detail?: string;
    title?: string;
    type?: string;
    errors?: Array<{ message?: string }>;
  };
  if (!response.ok) {
    throwForXFailure(
      response.status,
      payload,
      "X could not verify this quest right now.",
    );
  }
  return payload;
}

async function resolveTargetUserId(accessToken: string) {
  if (cachedTargetUserId) return cachedTargetUserId;
  const payload = await fetchXPayload(
    `https://api.x.com/2/users/by/username/${TARGET_ACCOUNT_USERNAME}?user.fields=id`,
    accessToken,
  );
  const data = payload.data as { id?: string } | undefined;
  if (!data?.id) {
    throw new XVerificationUnavailable("Could not resolve the official @RHOODATM account.");
  }
  cachedTargetUserId = data.id;
  return data.id;
}

async function userListContainsId(
  urlWithoutPagination: string,
  accessToken: string,
  userId: string,
  maxPages = 5,
) {
  let paginationToken = "";
  for (let page = 0; page < maxPages; page += 1) {
    const url = new URL(urlWithoutPagination);
    url.searchParams.set("max_results", "100");
    url.searchParams.set("user.fields", "id");
    if (paginationToken) url.searchParams.set("pagination_token", paginationToken);
    const payload = await fetchXPayload(url.toString(), accessToken);
    const users = (payload.data as Array<{ id?: string }> | undefined) ?? [];
    if (users.some((user) => user.id === userId)) return true;
    paginationToken = payload.meta?.next_token ?? "";
    if (!paginationToken) break;
  }
  return false;
}

async function verifyWithX(record: XGrantRecord, quest: XQuest, accessToken: string) {
  if (quest === "follow") {
    const targetUserId = await resolveTargetUserId(accessToken);
    const response = await fetch(
      `https://api.x.com/2/users/${encodeURIComponent(record.userId)}/following/${encodeURIComponent(targetUserId)}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      },
    );
    const payload = await response.json() as {
      data?: { id?: string };
      detail?: string;
      title?: string;
      type?: string;
    };
    // 404 means the authenticated user is not following the target.
    if (response.status === 404) return false;
    if (!response.ok) {
      throwForXFailure(
        response.status,
        payload,
        "X could not verify this follow right now.",
      );
    }
    return Boolean(payload.data?.id);
  }

  if (quest === "like") {
    return userListContainsId(
      `https://api.x.com/2/tweets/${TARGET_POST_ID}/liking_users`,
      accessToken,
      record.userId,
    );
  }

  if (quest === "retweet") {
    return userListContainsId(
      `https://api.x.com/2/tweets/${TARGET_POST_ID}/retweeted_by`,
      accessToken,
      record.userId,
    );
  }

  const payload = await fetchXPayload(
    `https://api.x.com/2/users/${encodeURIComponent(record.userId)}/tweets?max_results=20&tweet.fields=referenced_tweets,entities,created_at`,
    accessToken,
  );
  const timeline = (payload.data as XPost[] | undefined) ?? [];
  return timeline.some((post) => {
    const text = post.text?.trim() ?? "";
    const containsMessage = text === CAMPAIGN_MESSAGE
      || text.startsWith(`${CAMPAIGN_MESSAGE} `);
    const containsMention = text.toLowerCase().includes("@rhoodatm");
    const urls = post.entities?.urls ?? [];
    const containsExactReferral = urls.some((url) => (
      isExactCampaignReferralUrl(url.unwound_url, record.username)
      || isExactCampaignReferralUrl(url.expanded_url, record.username)
    ));
    return containsMessage && containsMention && containsExactReferral;
  });
}

export async function verifyXQuest(userId: string, quest: XQuest) {
  const operation = registryQueue.then(async () => {
    const records = await readRecordsUnsafe();
    const record = records.find((candidate) => candidate.userId === userId);
    if (!record) {
      throw new XVerificationUnavailable("Reconnect X once to enable quest verification.");
    }
    const state = record[quest];
    if (state.completedAt) {
      return { verified: true, completedAt: state.completedAt, nextCheckAt: null };
    }
    const lastCheckedAt = state.lastCheckedAt ? Date.parse(state.lastCheckedAt) : 0;
    const pendingUntil = state.pendingUntil ? Date.parse(state.pendingUntil) : 0;
    if (pendingUntil > Date.now()) {
      throw new XQuestCooldown(
        new Date(pendingUntil).toISOString(),
        "X verification is pending after a temporary API error. It will be retryable in about 20 minutes.",
      );
    }
    if (!state.pendingUntil && lastCheckedAt + TWELVE_HOURS > Date.now()) {
      throw new XQuestCooldown(new Date(lastCheckedAt + TWELVE_HOURS).toISOString());
    }

    let verified: boolean;
    try {
      const accessToken = await refreshAccessToken(record);
      verified = await verifyWithX(record, quest, accessToken);
    } catch (error) {
      if (!(error instanceof XTemporaryVerificationError)) throw error;
      const retryAt = new Date(Date.now() + error.retryMs).toISOString();
      state.lastCheckedAt = new Date().toISOString();
      state.pendingUntil = retryAt;
      await writeRecordsUnsafe(records);
      return {
        verified: false,
        pending: true,
        completedAt: null,
        nextCheckAt: retryAt,
        error: error.message,
      };
    }
    const checkedAt = new Date().toISOString();
    state.lastCheckedAt = checkedAt;
    state.pendingUntil = null;
    if (verified) state.completedAt = checkedAt;
    await writeRecordsUnsafe(records);
    return {
      verified,
      completedAt: state.completedAt,
      nextCheckAt: verified
        ? null
        : new Date(Date.now() + TWELVE_HOURS).toISOString(),
    };
  });
  registryQueue = operation.then(() => undefined, () => undefined);
  return operation;
}
