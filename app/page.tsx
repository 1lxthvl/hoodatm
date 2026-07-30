import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowUpRight, Check, Circle, Flame, LockKeyhole, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { readXSession } from "./lib/x-session";
import { countTrackedReferrals } from "./lib/player-registry";
import { getXQuestStatus } from "./lib/x-quest-registry";
import { XQuestVerification } from "./components/x-quest-verification";
import { AccessCodeCard } from "./components/access-code-card";

const quests = [
  {
    title: "Connect your X account",
    points: "+100",
    description: "Secure your place on the whitelist with your real X identity.",
    status: "Required",
  },
  {
    title: "Follow @rhoodATM",
    points: "+50",
    description: "Follow the official hoodATM X account. Points are awarded only after X verifies the follow.",
    action: "follow",
  },
  {
    title: "Post",
    points: "+150",
    description: "Post the exact campaign message, @RHOODATM mention, and your personalized referral URL. X verifies the post before points are awarded.",
    action: "post",
  },
  {
    title: "Like",
    points: "+50",
    description: "Like the official hoodATM launch post. Points are awarded only after X verifies the like.",
    action: "like",
  },
  {
    title: "Retweet",
    points: "+100",
    description: "Repost the official hoodATM launch post. Points are awarded only after X verifies the repost.",
    action: "retweet",
  },
  {
    title: "Bring someone into the hood",
    points: "+0.1×",
    description: "Share your personal crew link. Every recorded referral permanently adds 0.1× to your whitelist-points multiplier.",
    action: "referral",
  },
];

export const dynamic = "force-dynamic";

export default async function WhitelistPage() {
  const cookieStore = await cookies();
  const xSession = readXSession(cookieStore.get("hoodatm_x_session")?.value, process.env.HOODATM_SESSION_SECRET);
  const questStatus = xSession ? await getXQuestStatus(xSession.id) : null;
  const referrals = xSession ? await countTrackedReferrals(xSession.username) : 0;
  const pointsMultiplier = 1 + referrals * 0.1;
  const baseScore = xSession
    ? 100
      + (questStatus?.follow.completedAt ? 50 : 0)
      + (questStatus?.post.completedAt ? 150 : 0)
      + (questStatus?.like.completedAt ? 50 : 0)
      + (questStatus?.retweet.completedAt ? 100 : 0)
    : 0;
  const score = Math.round(baseScore * pointsMultiplier);
  const launchPostId = "2082123080462446795";
  const suggestedCode = `$GANGSTER${xSession?.username ?? "yourusername"}`;
  const referralLink = `https://hoodatm.online/?ref=${encodeURIComponent(suggestedCode)}`;
  const postText = `Word's out there is a new hood to be claimed @RHOODATM you in or you out? ${referralLink}`;
  const questLinks: Record<string, string> = {
    follow: "https://twitter.com/intent/follow?screen_name=rhoodATM",
    post: `https://x.com/intent/post?text=${encodeURIComponent(postText)}`,
    like: launchPostId ? `https://x.com/intent/like?tweet_id=${launchPostId}` : "https://x.com/rhoodatm",
    retweet: launchPostId ? `https://x.com/intent/retweet?tweet_id=${launchPostId}` : "https://x.com/rhoodatm",
    referral: "/referral",
  };
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-amber-300/25 bg-[#090b09] px-6 py-10 shadow-[0_24px_80px_rgba(0,0,0,0.5)] sm:px-10 lg:px-14 lg:py-14">
        <Image
          src="/assets/hoodatm-x-banner.png"
          alt="Dark hoodATM ATM scene"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-45"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,8,7,.98)_0%,rgba(6,8,7,.88)_40%,rgba(6,8,7,.38)_100%)]" />
        <div className="relative grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/30 bg-black/55 px-3 py-1.5 text-sm font-semibold text-amber-100">
              <Flame className="h-4 w-4 text-red-400" />
              Whitelist is open
            </div>
            <p className="mt-7 text-sm font-bold uppercase tracking-[0.28em] text-lime-200">hoodATM early access</p>
            <h1 className="mt-3 text-5xl font-black tracking-tight text-white sm:text-6xl">Own the block.<br /><span className="text-red-400">Stack the hood.</span></h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200">
              Get on the whitelist to claim your turf. Connect X, complete launch quests, and earn points for your spot in the hoodATM rollout.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={xSession ? "#quests" : "/api/auth/x"} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-red-600 via-amber-400 to-lime-300 px-5 py-3 font-bold text-[#10130c] transition hover:brightness-110">
                {xSession ? `Connected @${xSession.username}` : "Connect with X"}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link href="/game" className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/45 px-5 py-3 font-semibold text-white transition hover:bg-white/10">
                See the game
              </Link>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-amber-200/25 bg-black/65 p-5 backdrop-blur-sm sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-200">Your whitelist score</p>
                <p className="mt-2 text-5xl font-black text-white">{score} <span className="text-base font-semibold text-lime-300">PTS</span></p>
              </div>
              <div className="rounded-2xl border border-lime-300/20 bg-lime-300/10 p-3 text-lime-200"><Trophy className="h-7 w-7" /></div>
            </div>
            <div className="mt-6 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                <div className={`h-full rounded-full bg-gradient-to-r from-red-500 via-amber-300 to-lime-300 transition-all ${xSession ? "w-full" : "w-0"}`} />
              </div>
              <span className="shrink-0 text-xs font-black uppercase tracking-[0.15em] text-lime-200">No cap</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-300">
              <span>{referrals} referral{referrals === 1 ? "" : "s"}</span>
              <span className="font-bold text-amber-200">{pointsMultiplier.toFixed(1)}× points</span>
              <span>Unlimited referral growth</span>
            </div>
            <p className="mt-3 text-sm text-slate-300">{xSession ? "X connected. Launch quests unlock next." : "Connect X to begin earning points."} Your final rank decides early-access priority.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <div id="quests" className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-lime-200">Whitelist quests</p>
              <h2 className="mt-2 text-3xl font-semibold text-white">Make noise. Earn your place.</h2>
            </div>
            <p className="text-sm text-slate-400">New quests unlock with the launch campaign.</p>
          </div>
          <div className="mt-7 space-y-3">
            {quests.map((quest, index) => {
              const action = "action" in quest ? quest.action : undefined;
              const actionHref = action ? questLinks[action] : undefined;
              const verified = action === "follow"
                ? Boolean(questStatus?.follow.completedAt)
                : action === "post"
                  ? Boolean(questStatus?.post.completedAt)
                : action === "like"
                  ? Boolean(questStatus?.like.completedAt)
                : action === "retweet"
                  ? Boolean(questStatus?.retweet.completedAt)
                  : false;
              return (
              <article key={quest.title} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-amber-200/25">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/40 text-slate-500">
                  {(index === 0 && xSession) || verified ? <Check className="h-5 w-5 text-lime-300" /> : index === 0 ? <Circle className="h-5 w-5" /> : <LockKeyhole className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-white">{quest.title}</h3>
                    <span className="rounded-full border border-lime-300/20 bg-lime-300/10 px-2.5 py-1 text-xs font-bold text-lime-200">
                      {action === "referral" ? quest.points : `${quest.points} PTS`}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{quest.description}</p>
                  {index === 0 ? (
                    <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-amber-200/80">{xSession ? "Completed" : "Required"}</p>
                  ) : xSession && (action === "follow" || action === "post" || action === "like" || action === "retweet") ? (
                    <XQuestVerification
                      quest={action}
                      postUrl={actionHref!}
                      connectedForVerification={questStatus?.connectedForVerification ?? false}
                      completedAt={questStatus?.[action].completedAt ?? null}
                      lastCheckedAt={questStatus?.[action].lastCheckedAt ?? null}
                      pendingUntil={questStatus?.[action].pendingUntil ?? null}
                    />
                  ) : xSession && actionHref ? (
                    <a href={actionHref} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.16em] text-amber-200 hover:text-amber-100">
                      Open {quest.title} quest <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-amber-200/80">Connect X to unlock</p>
                  )}
                </div>
              </article>
            );})}
          </div>
        </div>

        <aside className="space-y-6">
          <section className="rounded-[2rem] border border-lime-300/20 bg-lime-300/[0.06] p-6">
            <ShieldCheck className="h-7 w-7 text-lime-300" />
            <h2 className="mt-4 text-2xl font-semibold text-white">Fair by design</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">Follow, Post, Like, and Retweet points are awarded only after X confirms each action. Temporary X API errors remain pending for about 20 minutes; missing actions can be rechecked after 12 hours.</p>
          </section>
          <section className="rounded-[2rem] border border-amber-200/20 bg-slate-950/70 p-6">
            <Sparkles className="h-6 w-6 text-amber-200" />
            <h2 className="mt-4 text-2xl font-semibold text-white">What you&apos;re earning</h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              {["Early-access priority", "Launch announcement access", "A stronger claim to the block"].map((item) => (
                <li key={item} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-lime-300" />{item}</li>
              ))}
            </ul>
          </section>
          <section className="rounded-[2rem] border border-amber-300/25 bg-[linear-gradient(145deg,rgba(251,191,36,.12),rgba(15,23,42,.82))] p-6">
            <Trophy className="h-7 w-7 text-amber-200" />
            <h2 className="mt-4 text-2xl font-semibold text-white">Whitelist leaderboard rewards</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Your final points total sets the podium. Every referral raises your points multiplier, so the strongest crew-building run has the edge.
            </p>
            <ol className="mt-5 space-y-3">
              {[
                ["1st place", "OG Gangster"],
                ["2nd place", "General"],
                ["3rd place", "Captain"],
              ].map(([place, reward]) => (
                <li key={place} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                  <span className="text-sm font-black uppercase tracking-[0.14em] text-amber-200">{place}</span>
                  <span className="font-bold text-white">{reward}</span>
                </li>
              ))}
            </ol>
          </section>
          <AccessCodeCard />
        </aside>
      </section>
    </div>
  );
}
