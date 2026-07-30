"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownUp, Copy, Download, KeyRound, Plus, RefreshCw, Search, ShieldCheck, Users } from "lucide-react";

const categories = ["Connected", "Whitelisted", "Initiated", "Active", "Flagged"] as const;
const gangsterCharacters = ["Hoodlum", "Captain", "General", "OG"] as const;
type Category = (typeof categories)[number];
type GangsterCharacter = (typeof gangsterCharacters)[number];
type SortKey = "lastSeenAt" | "firstSeenAt" | "wallet" | "ipAddress" | "username" | "accessCode" | "characterGrant" | "initiationPaid" | "category";
type TrackedPlayer = {
  id: string;
  wallet: string;
  ipAddress: string;
  xUsername: string | null;
  gangsterUsername: string | null;
  referredByCode: string | null;
  accessCode: string | null;
  characterGrant: GangsterCharacter | null;
  characterEarningRate: number | null;
  characterCode: string | null;
  gangsterSlots: number;
  gangsterRoster: Array<{
    character: GangsterCharacter;
    earningRate: number;
    code: string | null;
    source: "code" | "paid" | "admin";
  }>;
  codeBonusSlotGranted: boolean;
  initiationPaid: boolean;
  category: Category;
  firstSeenAt: string;
  lastSeenAt: string;
};
type AccessCodeRecord = {
  id: string;
  code: string;
  createdAt: string;
  createdBy: string;
  type: "hood-access" | "character-claim";
  character: GangsterCharacter | null;
  usedAt: string | null;
  usedByWallet: string | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AdminPage() {
  const [players, setPlayers] = useState<TrackedPlayer[]>([]);
  const [codes, setCodes] = useState<AccessCodeRecord[]>([]);
  const [newCode, setNewCode] = useState("");
  const [newCodeDescription, setNewCodeDescription] = useState("");
  const [codeType, setCodeType] = useState<"hood-access" | "character-claim">("hood-access");
  const [codeCharacter, setCodeCharacter] = useState<GangsterCharacter>("Hoodlum");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"All" | Category>("All");
  const [sortKey, setSortKey] = useState<SortKey>("lastSeenAt");
  const [descending, setDescending] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState("");
  const [backingUp, setBackingUp] = useState(false);

  const loadPlayers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [playersResponse, codesResponse] = await Promise.all([
        fetch("/api/admin/players", { cache: "no-store" }),
        fetch("/api/admin/access-codes", { cache: "no-store" }),
      ]);
      if (!playersResponse.ok || !codesResponse.ok) {
        throw new Error(playersResponse.status === 403 || codesResponse.status === 403
          ? "Admin X session required."
          : "Could not load admin records.");
      }
      const playersResult = await playersResponse.json() as { players: TrackedPlayer[] };
      const codesResult = await codesResponse.json() as { codes: AccessCodeRecord[] };
      setPlayers(playersResult.players);
      setCodes(codesResult.codes);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load player records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadPlayers(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadPlayers]);

  const visiblePlayers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return players
      .filter((player) => category === "All" || player.category === category)
      .filter((player) => {
        if (!normalizedQuery) return true;
        return [
          player.wallet,
          player.ipAddress,
          player.xUsername,
          player.gangsterUsername,
          player.accessCode,
          player.referredByCode,
          player.characterGrant,
          ...(player.gangsterRoster ?? []).map((gangster) => gangster.character),
          player.characterCode,
          player.category,
        ].some((value) => value?.toLowerCase().includes(normalizedQuery));
      })
      .sort((left, right) => {
        const leftValue = sortKey === "username"
          ? left.gangsterUsername || left.xUsername || ""
          : String(left[sortKey] || "");
        const rightValue = sortKey === "username"
          ? right.gangsterUsername || right.xUsername || ""
          : String(right[sortKey] || "");
        const comparison = leftValue.localeCompare(rightValue);
        return descending ? -comparison : comparison;
      });
  }, [category, descending, players, query, sortKey]);

  async function changeCategory(player: TrackedPlayer, nextCategory: Category) {
    setUpdatingId(player.id);
    setError("");
    try {
      const response = await fetch("/api/admin/players", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: player.id, category: nextCategory }),
      });
      if (!response.ok) throw new Error("Category update failed.");
      const result = await response.json() as { player: TrackedPlayer };
      setPlayers((current) => current.map((item) => item.id === result.player.id ? result.player : item));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Category update failed.");
    } finally {
      setUpdatingId("");
    }
  }

  async function generateCode() {
    setError("");
    try {
      const response = await fetch("/api/admin/access-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: codeType,
          character: codeType === "character-claim" ? codeCharacter : null,
        }),
      });
      if (!response.ok) throw new Error("Code generation failed.");
      const result = await response.json() as { code: AccessCodeRecord };
      setCodes((current) => [result.code, ...current]);
      setNewCode(result.code.code);
      setNewCodeDescription(result.code.type === "character-claim"
        ? `${result.code.character} character · 50% earning rate`
        : "Hood Access");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Code generation failed.");
    }
  }

  async function assignCharacter(
    player: TrackedPlayer,
    characterGrant: GangsterCharacter | null,
  ) {
    setUpdatingId(player.id);
    setError("");
    try {
      const response = await fetch("/api/admin/players", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: player.id, characterGrant }),
      });
      if (!response.ok) throw new Error("Character assignment failed.");
      const result = await response.json() as { player: TrackedPlayer };
      setPlayers((current) => current.map((item) => item.id === result.player.id ? result.player : item));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Character assignment failed.");
    } finally {
      setUpdatingId("");
    }
  }

  async function setInitiationPaid(player: TrackedPlayer, initiationPaid: boolean) {
    setUpdatingId(player.id);
    setError("");
    try {
      const response = await fetch("/api/admin/players", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: player.id, initiationPaid }),
      });
      if (!response.ok) throw new Error("Initiation access update failed.");
      const result = await response.json() as { player: TrackedPlayer };
      setPlayers((current) => current.map((item) => item.id === result.player.id ? result.player : item));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Initiation access update failed.");
    } finally {
      setUpdatingId("");
    }
  }

  async function downloadLocalBackup() {
    setBackingUp(true);
    setError("");
    try {
      const response = await fetch("/api/admin/backup", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(response.status === 403
          ? "Admin X session required."
          : "Could not download registry backup.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const matched = /filename="([^"]+)"/.exec(disposition);
      const filename = matched?.[1] ?? `hoodatm-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Backup download failed.");
    } finally {
      setBackingUp(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-lime-300/20 bg-[radial-gradient(circle_at_85%_15%,rgba(163,230,53,.12),transparent_28rem),rgba(8,11,9,.95)] p-7 sm:p-9">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-lime-300/25 bg-lime-300/10 px-3 py-1.5 text-sm font-bold text-lime-200">
              <ShieldCheck className="h-4 w-4" /> @rhoodatm &amp; @1lxthvl
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-white sm:text-5xl">Player devtools</h1>
            <p className="mt-4 text-lg leading-8 text-slate-300">
              Review every wallet that connected, its verified X identity, access code, referral username, network address, and current account category.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => void downloadLocalBackup()}
              disabled={backingUp || loading}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-lime-300/30 bg-lime-300/10 px-5 py-3 text-sm font-bold text-lime-100 disabled:opacity-40"
            >
              <Download className={`h-4 w-4 ${backingUp ? "animate-pulse" : ""}`} />
              {backingUp ? "Preparing backup…" : "Download local backup"}
            </button>
            <button
              type="button"
              onClick={() => void loadPlayers()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-bold text-white disabled:opacity-40"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-5">
          <Users className="h-5 w-5 text-lime-300" />
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.17em] text-slate-500">Tracked wallets</p>
          <p className="mt-2 text-3xl font-black text-white">{players.length}</p>
        </div>
        <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-5">
          <ShieldCheck className="h-5 w-5 text-cyan-300" />
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.17em] text-slate-500">Verified X accounts</p>
          <p className="mt-2 text-3xl font-black text-white">{players.filter((player) => player.xUsername).length}</p>
        </div>
        <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-5">
          <ArrowDownUp className="h-5 w-5 text-amber-200" />
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.17em] text-slate-500">Visible results</p>
          <p className="mt-2 text-3xl font-black text-white">{visiblePlayers.length}</p>
        </div>
      </section>

      <section className="rounded-[2rem] border border-red-300/20 bg-red-400/[0.05] p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-red-200">
              <KeyRound className="h-4 w-4" /> Code generation
            </div>
            <h2 className="mt-2 text-3xl font-black text-white">One code. One wallet. One use.</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
              Generate a private Hood Access code. Once redeemed, it is permanently linked to that player’s connected wallet and cannot be used again.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[auto_auto_auto]">
            <select value={codeType} onChange={(event) => setCodeType(event.target.value as "hood-access" | "character-claim")} className="rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white">
              <option value="hood-access">Hood Access code</option>
              <option value="character-claim">Character claim code</option>
            </select>
            {codeType === "character-claim" ? (
              <select value={codeCharacter} onChange={(event) => setCodeCharacter(event.target.value as GangsterCharacter)} className="rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white">
                {gangsterCharacters.map((character) => <option key={character} value={character}>{character} · 50%</option>)}
              </select>
            ) : null}
            <button type="button" onClick={() => void generateCode()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-300 px-5 py-3 font-black text-slate-950">
              <Plus className="h-4 w-4" /> Generate code
            </button>
          </div>
        </div>
        {newCode ? (
          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-lime-300/25 bg-lime-300/10 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-lime-200">Newest unused code</p>
              <p className="mt-2 font-mono text-2xl font-black text-white">{newCode}</p>
              <p className="mt-1 text-sm text-lime-100/70">{newCodeDescription}</p>
            </div>
            <button type="button" onClick={() => void navigator.clipboard.writeText(newCode)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-white">
              <Copy className="h-4 w-4" /> Copy
            </button>
          </div>
        ) : null}
        <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[760px] text-left">
            <thead className="bg-black/30 text-xs uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-5 py-4">Code</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Purpose</th>
                <th className="px-4 py-4">Character</th>
                <th className="px-4 py-4">Linked wallet</th>
                <th className="px-5 py-4">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {codes.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-500">No one-time codes generated yet.</td></tr>
              ) : codes.map((code) => (
                <tr key={code.id}>
                  <td className="px-5 py-4 font-mono font-bold text-white">{code.code}</td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${code.usedAt ? "bg-slate-400/10 text-slate-300" : "bg-lime-300/10 text-lime-200"}`}>
                      {code.usedAt ? "Used" : "Unused"}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-300">{code.type === "character-claim" ? "Character claim" : "Hood Access"}</td>
                  <td className="px-4 py-4 font-bold text-amber-200">{code.character ? `${code.character} · 50%` : "—"}</td>
                  <td className="px-4 py-4 font-mono text-sm text-slate-300">{code.usedByWallet || "Not linked"}</td>
                  <td className="px-5 py-4 text-sm text-slate-400">{formatDate(code.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/70">
        <div className="grid gap-3 border-b border-white/10 p-5 md:grid-cols-[1fr_auto_auto_auto] md:items-center sm:p-6">
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/35 px-3">
            <Search className="h-4 w-4 text-slate-500" />
            <span className="sr-only">Search players</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent py-3 text-sm text-white outline-none"
              placeholder="Search wallet, IP, or username"
            />
          </label>
          <select value={category} onChange={(event) => setCategory(event.target.value as "All" | Category)} className="rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white">
            <option value="All">All categories</option>
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)} className="rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white">
            <option value="lastSeenAt">Last seen</option>
            <option value="firstSeenAt">First seen</option>
            <option value="wallet">Wallet</option>
            <option value="ipAddress">IP address</option>
            <option value="username">Username</option>
            <option value="accessCode">Access code</option>
            <option value="characterGrant">Character</option>
            <option value="initiationPaid">Initiation fee</option>
            <option value="category">Category</option>
          </select>
          <button type="button" onClick={() => setDescending((value) => !value)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white">
            <ArrowDownUp className="h-4 w-4" /> {descending ? "Descending" : "Ascending"}
          </button>
        </div>

        {error ? <p className="border-b border-red-300/20 bg-red-400/10 px-6 py-4 text-sm font-semibold text-red-200">{error}</p> : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1980px] text-left">
            <thead className="bg-black/25 text-xs uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-6 py-4">Wallet</th>
                <th className="px-4 py-4">IP address</th>
                <th className="px-4 py-4">X username</th>
                <th className="px-4 py-4">Gangster username</th>
                <th className="px-4 py-4">Access code</th>
                <th className="px-4 py-4">Referred by</th>
                <th className="px-4 py-4">Claimed character</th>
                <th className="px-4 py-4">Active roster / slots</th>
                <th className="px-4 py-4">Character code</th>
                <th className="px-4 py-4">Initiation fee</th>
                <th className="px-4 py-4">Category</th>
                <th className="px-4 py-4">First seen</th>
                <th className="px-6 py-4">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {!loading && visiblePlayers.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-6 py-12 text-center text-sm text-slate-500">No tracked players match these filters.</td>
                </tr>
              ) : null}
              {visiblePlayers.map((player) => (
                <tr key={player.id} className="hover:bg-white/[0.025]">
                  <td className="px-6 py-5 font-mono text-sm text-lime-200">{player.wallet}</td>
                  <td className="px-4 py-5 font-mono text-sm text-slate-300">{player.ipAddress}</td>
                  <td className="px-4 py-5 text-slate-300">{player.xUsername ? `@${player.xUsername}` : "Not connected"}</td>
                  <td className="px-4 py-5 text-white">{player.gangsterUsername ? `$GANGSTER${player.gangsterUsername}` : "Not registered"}</td>
                  <td className="px-4 py-5 font-mono text-sm text-amber-200">{player.accessCode || "None"}</td>
                  <td className="px-4 py-5 font-mono text-sm text-cyan-200">{player.referredByCode || "Direct"}</td>
                  <td className="px-4 py-5">
                    <select
                      value={player.characterGrant || ""}
                      onChange={(event) => void assignCharacter(player, (event.target.value || null) as GangsterCharacter | null)}
                      disabled={updatingId === player.id}
                      aria-label={`Claimed character for ${player.wallet}`}
                      className="rounded-lg border border-white/10 bg-black/45 px-3 py-2 text-sm text-white disabled:opacity-40"
                    >
                      <option value="">None</option>
                      {gangsterCharacters.map((character) => <option key={character} value={character}>{character} · 50%</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-5 text-sm text-cyan-100">
                    {(player.gangsterRoster ?? []).length > 0
                      ? `${player.gangsterRoster.map((gangster) => gangster.character).join(", ")} · ${player.gangsterRoster.length}/${player.gangsterSlots ?? 1}`
                      : `Empty · 0/${player.gangsterSlots ?? 1}`}
                  </td>
                  <td className="px-4 py-5 font-mono text-sm text-violet-200">{player.characterGrant ? player.characterCode || "Direct admin assignment" : "—"}</td>
                  <td className="px-4 py-5">
                    <select
                      value={player.initiationPaid ? "paid" : "unpaid"}
                      onChange={(event) => void setInitiationPaid(player, event.target.value === "paid")}
                      disabled={updatingId === player.id}
                      aria-label={`Initiation fee status for ${player.wallet}`}
                      className="rounded-lg border border-white/10 bg-black/45 px-3 py-2 text-sm text-white disabled:opacity-40"
                    >
                      <option value="unpaid">Not paid · locked</option>
                      <option value="paid">Paid · full access</option>
                    </select>
                  </td>
                  <td className="px-4 py-5">
                    <select
                      value={player.category}
                      onChange={(event) => void changeCategory(player, event.target.value as Category)}
                      disabled={updatingId === player.id}
                      aria-label={`Category for ${player.wallet}`}
                      className="rounded-lg border border-white/10 bg-black/45 px-3 py-2 text-sm text-white disabled:opacity-40"
                    >
                      {categories.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-5 text-sm text-slate-400">{formatDate(player.firstSeenAt)}</td>
                  <td className="px-6 py-5 text-sm text-slate-400">{formatDate(player.lastSeenAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
