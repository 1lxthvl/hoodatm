"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Check, RefreshCw } from "lucide-react";

type Quest = "follow" | "post" | "like" | "retweet";

function formatRetry(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function XQuestVerification({
  quest,
  postUrl,
  connectedForVerification,
  completedAt,
  lastCheckedAt,
  pendingUntil,
}: {
  quest: Quest;
  postUrl: string;
  connectedForVerification: boolean;
  completedAt: string | null;
  lastCheckedAt: string | null;
  pendingUntil?: string | null;
}) {
  const questLabel = quest === "follow"
    ? "Follow"
    : quest === "post"
      ? "Post"
      : quest === "like"
        ? "Like"
        : "Retweet";
  const [verified, setVerified] = useState(Boolean(completedAt));
  const [nextCheckAt, setNextCheckAt] = useState(
    !completedAt && (pendingUntil || lastCheckedAt)
      ? pendingUntil ?? new Date(Date.parse(lastCheckedAt!) + 12 * 60 * 60 * 1000).toISOString()
      : null,
  );
  const [status, setStatus] = useState(
    completedAt ? `${questLabel} verified. Points awarded.` : "",
  );
  const [checking, setChecking] = useState(false);
  const [cooldownActive, setCooldownActive] = useState(false);

  useEffect(() => {
    let expiryTimer: number | undefined;
    const syncTimer = window.setTimeout(() => {
      const remaining = nextCheckAt ? Date.parse(nextCheckAt) - Date.now() : 0;
      setCooldownActive(remaining > 0);
      if (remaining > 0) {
        expiryTimer = window.setTimeout(() => setCooldownActive(false), remaining);
      }
    }, 0);
    return () => {
      window.clearTimeout(syncTimer);
      if (expiryTimer !== undefined) window.clearTimeout(expiryTimer);
    };
  }, [nextCheckAt]);

  async function verify() {
    setChecking(true);
    setStatus("");
    try {
      const response = await fetch("/api/quests/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quest }),
      });
      const result = await response.json() as {
        verified?: boolean;
        pending?: boolean;
        completedAt?: string | null;
        nextCheckAt?: string | null;
        error?: string;
      };
      if (!response.ok) {
        if (result.nextCheckAt) setNextCheckAt(result.nextCheckAt);
        throw new Error(result.error || "X verification failed.");
      }
      if (result.verified) {
        setVerified(true);
        setStatus(`${questLabel} verified. Points awarded.`);
        window.setTimeout(() => window.location.reload(), 700);
      } else {
        setNextCheckAt(result.nextCheckAt ?? null);
        setStatus(
          result.pending
            ? (result.error
              || "X verification is pending after a temporary API error. Retry shortly.")
            : `${questLabel} not found. Complete it on X before the next check.`,
        );
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "X verification failed.");
    } finally {
      setChecking(false);
    }
  }

  if (verified) {
    return (
      <p className="mt-3 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-lime-200">
        <Check className="h-3.5 w-3.5" /> Verified · points awarded
      </p>
    );
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-3">
        <a
          href={postUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.16em] text-amber-200 hover:text-amber-100"
        >
          {quest === "follow"
            ? "Follow on X"
            : quest === "post"
              ? "Post on X"
              : quest === "like"
                ? "Like on X"
                : "Retweet on X"} <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
        {connectedForVerification ? (
          <button
            type="button"
            onClick={() => void verify()}
            disabled={checking || cooldownActive}
            className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.16em] text-cyan-200 hover:text-cyan-100 disabled:cursor-not-allowed disabled:text-slate-600"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${checking ? "animate-spin" : ""}`} />
            {checking ? "Checking X" : "Verify for points"}
          </button>
        ) : (
          <a
            href="/api/auth/x"
            className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200 hover:text-cyan-100"
          >
            Reconnect X to verify
          </a>
        )}
      </div>
      {cooldownActive ? (
        <p className="mt-2 text-xs text-slate-500">
          Next verification available {formatRetry(nextCheckAt)}.
        </p>
      ) : null}
      {status ? <p className="mt-2 text-xs font-semibold text-amber-100">{status}</p> : null}
    </div>
  );
}
