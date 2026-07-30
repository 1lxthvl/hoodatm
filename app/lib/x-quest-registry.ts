import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type XQuest = "follow" | "like" | "retweet";

type QuestVerification = {
  postId: string;
  completedAt: string | null;
  lastCheckedAt: string | null;
};

type XGrantRecord = {
  userId: string;
  username: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
  scopes: string[];
  follow: QuestVerification;
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
  like: QuestVerification;
  retweet: QuestVerification;
};

export class XQuestCooldown extends Error {
  nextCheckAt: string;

  constructor(nextCheckAt: string) {
    super("This quest can only be rechecked once every 12 hours.");
    this.nextCheckAt = nextCheckAt;
  }
}

export class XVerificationUnavailable extends Error {}

const TWELVE_HOURS = 12 * 60 * 60 * 1000;
const TARGET_POST_ID = "2082123080462446795";
const TARGET_ACCOUNT_USERNAME = "rhoodatm";
const registryPath =
  process.env.HOODATM_X_TOKEN_LOG_PATH || ".data/x-tokens.json";
let registryQueue: Promise<unknown> = Promise.resolve();

const emptyQuest = (targetId = TARGET_POST_ID): QuestVerification => ({
  postId: targetId,
  completedAt: null,
  lastCheckedAt: null,
});

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
  const token = await response.json() as XTokenResponse;
  if (!response.ok || !token.access_token) {
    throw new XVerificationUnavailable("Reconnect X to refresh quest verification access.");
  }
  record.accessToken = token.access_token;
  record.refreshToken = token.refresh_token ?? record.refreshToken;
  record.expiresAt = Date.now() + Math.max(60, token.expires_in ?? 7200) * 1000;
  if (token.scope) record.scopes = token.scope.split(" ").filter(Boolean);
  return record.accessToken;
}

async function fetchXJson(url: string, accessToken: string) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const payload = await response.json() as {
    data?: Array<{
      id: string;
      referenced_tweets?: Array<{ type: string; id: string }>;
    }>;
    detail?: string;
    title?: string;
  };
  if (!response.ok) {
    throw new XVerificationUnavailable(
      payload.detail || payload.title || "X could not verify this quest right now.",
    );
  }
  return payload.data ?? [];
}

async function verifyWithX(record: XGrantRecord, quest: XQuest, accessToken: string) {
  if (quest === "follow") {
    let paginationToken = "";
    for (let page = 0; page < 10; page += 1) {
      const url = new URL(
        `https://api.x.com/2/users/${encodeURIComponent(record.userId)}/following`,
      );
      url.searchParams.set("max_results", "1000");
      url.searchParams.set("user.fields", "username");
      if (paginationToken) url.searchParams.set("pagination_token", paginationToken);
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const payload = await response.json() as {
        data?: Array<{ username?: string }>;
        meta?: { next_token?: string };
        detail?: string;
        title?: string;
      };
      if (!response.ok) {
        throw new XVerificationUnavailable(
          payload.detail || payload.title || "X could not verify this follow right now.",
        );
      }
      if (payload.data?.some(
        (user) => user.username?.toLowerCase() === TARGET_ACCOUNT_USERNAME,
      )) return true;
      paginationToken = payload.meta?.next_token ?? "";
      if (!paginationToken) break;
    }
    return false;
  }

  if (quest === "like") {
    const likedPosts = await fetchXJson(
      `https://api.x.com/2/users/${encodeURIComponent(record.userId)}/liked_tweets?max_results=100`,
      accessToken,
    );
    return likedPosts.some((post) => post.id === TARGET_POST_ID);
  }

  const timeline = await fetchXJson(
    `https://api.x.com/2/users/${encodeURIComponent(record.userId)}/tweets?max_results=100&tweet.fields=referenced_tweets`,
    accessToken,
  );
  return timeline.some((post) => post.referenced_tweets?.some(
    (reference) => reference.type === "retweeted" && reference.id === TARGET_POST_ID,
  ));
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
    if (lastCheckedAt + TWELVE_HOURS > Date.now()) {
      throw new XQuestCooldown(new Date(lastCheckedAt + TWELVE_HOURS).toISOString());
    }

    const accessToken = await refreshAccessToken(record);
    const verified = await verifyWithX(record, quest, accessToken);
    const checkedAt = new Date().toISOString();
    state.lastCheckedAt = checkedAt;
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
