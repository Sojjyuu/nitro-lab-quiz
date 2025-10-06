"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";
import {
  fetchStatuses,
  createStatus,
  createComment,
  likeStatus,
  unlikeStatus,
} from "../lib/api/api";
import type { Comment as CommentItem, StatusItem } from "../types";
import { getClientToken } from "../lib/api/session";

type Flash = {
  text: string;
  tone: "idle" | "error" | "success";
};

const initialFlash: Flash = { text: "", tone: "idle" };
const redirectTarget = "/statuses";
const loginRedirect = (target: string) => `/login?redirect=${encodeURIComponent(target)}`;

const resolveLikeCount = (status: StatusItem): number => {
  if (typeof status.likeCount === "number") {
    return status.likeCount;
  }

  if (Array.isArray(status.like)) {
    return status.like.length;
  }

  return 0;
};

const computeHasLiked = (status: StatusItem, currentUserId: string | null): boolean => {
  if (typeof status.hasLiked === "boolean") {
    return status.hasLiked;
  }

  if (!currentUserId) {
    return false;
  }

  return status.like.some((entry) => {
    if (typeof entry === "string") {
      return entry === currentUserId;
    }

    return entry?._id === currentUserId;
  });
};

const normalizeStatuses = (list: StatusItem[], currentUserId: string | null): StatusItem[] =>
  list.map((status) => ({
    ...status,
    likeCount: resolveLikeCount(status),
    hasLiked: computeHasLiked(status, currentUserId),
    like: Array.isArray(status.like)
      ? status.like.map((entry) => (typeof entry === "string" ? entry : { ...entry }))
      : status.like,
    comment: Array.isArray(status.comment)
      ? status.comment.map((comment) => ({
          ...comment,
          createdBy:
            typeof comment.createdBy === "string"
              ? comment.createdBy
              : { ...comment.createdBy },
        }))
      : status.comment,
  }));

const cloneStatus = (status: StatusItem): StatusItem => ({
  ...status,
  like: Array.isArray(status.like)
    ? status.like.map((entry) => (typeof entry === "string" ? entry : { ...entry }))
    : status.like,
  comment: Array.isArray(status.comment)
    ? status.comment.map((comment) => ({
        ...comment,
        createdBy:
          typeof comment.createdBy === "string"
            ? comment.createdBy
            : { ...comment.createdBy },
      }))
    : status.comment,
});

const UNKNOWN_AUTHOR = "Unknown member";

type InsightTone = "posts" | "likes" | "comments" | "contributors";

type InsightMetric = {
  label: string;
  value: number;
  helper: string;
  tone: InsightTone;
};

type HighlightSpotlight = {
  title: string;
  author: string;
  metrics: string;
  excerpt: string;
};

type InsightSummary = {
  totals: InsightMetric[];
  highlight: HighlightSpotlight | null;
};

type AuthorLike =
  | string
  | {
      name?: string;
      firstname?: string;
      lastname?: string;
      email?: string;
      _id?: string;
    };

const deriveInitials = (value: string): string => {
  if (!value) return "";

  const normalized = value
    .replace(/[^A-Za-z0-9\s]/g, " ")
    .trim()
    .toUpperCase();

  if (!normalized) return "";

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return "";
  }

  if (words.length === 1) {
    const letters = words[0].replace(/[^A-Z0-9]/g, "");
    return letters.slice(0, 2);
  }

  return words
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("");
};

const buildFullName = (firstname?: string, lastname?: string): string | undefined => {
  const segments = [firstname, lastname]
    .map((segment) => segment?.trim())
    .filter((segment): segment is string => Boolean(segment));

  return segments.length > 0 ? segments.join(" ") : undefined;
};

const resolveAuthorName = (createdBy: AuthorLike, owner?: string): string => {
  if (typeof createdBy === "string") {
    return owner?.trim() || createdBy || UNKNOWN_AUTHOR;
  }

  const fullName = buildFullName(createdBy.firstname, createdBy.lastname);

  return (
    createdBy.name?.trim() ||
    fullName ||
    owner?.trim() ||
    createdBy.email?.trim() ||
    createdBy._id ||
    UNKNOWN_AUTHOR
  );
};

const resolveAuthorInitial = (createdBy: AuthorLike, owner?: string): string => {
  const fallback =
    typeof createdBy === "string"
      ? createdBy
      : createdBy.name ||
        buildFullName(createdBy.firstname, createdBy.lastname) ||
        createdBy.email ||
        createdBy._id ||
        owner ||
        "";

  return deriveInitials(resolveAuthorName(createdBy, owner)) || deriveInitials(fallback) || "?";
};

const resolveStatusAuthorName = (status: StatusItem): string =>
  resolveAuthorName(status.createdBy, status.owner);

const resolveCommentAuthorName = (comment: CommentItem): string =>
  resolveAuthorName(comment.createdBy, comment.owner);

const resolveStatusAuthorInitial = (status: StatusItem): string =>
  resolveAuthorInitial(status.createdBy, status.owner);

const resolveCommentAuthorInitial = (comment: CommentItem): string =>
  resolveAuthorInitial(comment.createdBy, comment.owner);

export default function StatusesPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [flash, setFlash] = useState<Flash>(initialFlash);
  const [content, setContent] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const storedToken = getClientToken();
    if (!storedToken) {
      setToken(null);
      setUserId(null);
      setFlash({ text: "Redirecting to sign in...", tone: "error" });
      router.replace(loginRedirect(redirectTarget));
      return;
    }

    setToken(storedToken);

    if (typeof window !== "undefined") {
      const storedProfile = window.localStorage.getItem("classroomProfile");
      if (storedProfile) {
        try {
          const parsed = JSON.parse(storedProfile) as { _id?: string };
          setUserId(parsed?._id ?? null);
        } catch {
          setUserId(null);
        }
      } else {
        setUserId(null);
      }
    }
  }, [router]);

  useEffect(() => {
    if (!token) return;
    void loadStatuses(token);
  }, [token, userId]);

  const loadStatuses = async (activeToken: string, activeUserId: string | null = userId) => {
    try {
      setLoading(true);
      const data = await fetchStatuses(activeToken);
      const normalized = normalizeStatuses(data, activeUserId);
      setStatuses(normalized);
      if (normalized.length === 0) {
        setFlash({ text: "No statuses yet. Be the first to post!", tone: "idle" });
      } else {
        setFlash(initialFlash);
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : "Unable to load statuses.";
      setFlash({ text, tone: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      setFlash({ text: "Token missing. Redirecting to sign in...", tone: "error" });
      router.replace(loginRedirect(redirectTarget));
      return;
    }

    if (!content.trim()) {
      setFlash({ text: "Please enter some content before posting.", tone: "error" });
      return;
    }

    try {
      setPosting(true);
      await createStatus({ content: content.trim() }, token);
      setContent("");
      setFlash({ text: "Status posted successfully.", tone: "success" });
      await loadStatuses(token);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Unable to post status.";
      setFlash({ text, tone: "error" });
    } finally {
      setPosting(false);
    }
  };

  const handleComment = async (event: FormEvent<HTMLFormElement>, statusId: string) => {
    event.preventDefault();
    if (!token) {
      setFlash({ text: "Token missing. Redirecting to sign in...", tone: "error" });
      router.replace(loginRedirect(redirectTarget));
      return;
    }

    const draft = commentDrafts[statusId]?.trim();
    if (!draft) {
      setFlash({ text: "Please type a comment before submitting.", tone: "error" });
      return;
    }

    try {
      await createComment({ content: draft, statusId }, token);
      setCommentDrafts((prev) => ({ ...prev, [statusId]: "" }));
      await loadStatuses(token);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Unable to add comment.";
      setFlash({ text, tone: "error" });
    }
  };

  const toggleLike = async (statusId: string, hasLiked: boolean) => {
    if (!token) {
      setFlash({ text: "Token missing. Redirecting to sign in...", tone: "error" });
      router.replace(loginRedirect(redirectTarget));
      return;
    }

    const previousStatuses = statuses.map((statusEntry) => cloneStatus(statusEntry));
    const viewerId = userId;

    const nextStatuses = statuses.map((statusEntry) => {
      if (statusEntry._id !== statusId) {
        return statusEntry;
      }

      const baseCount = resolveLikeCount(statusEntry);
      let nextLikeArray = Array.isArray(statusEntry.like)
        ? statusEntry.like.map((entry) => (typeof entry === "string" ? entry : { ...entry }))
        : [];

      if (viewerId) {
        const alreadyLiked = nextLikeArray.some((entry) =>
          typeof entry === "string" ? entry === viewerId : entry?._id === viewerId
        );

        if (hasLiked) {
          nextLikeArray = nextLikeArray.filter((entry) =>
            typeof entry === "string" ? entry !== viewerId : entry?._id !== viewerId
          );
        } else if (!alreadyLiked) {
          nextLikeArray = [...nextLikeArray, viewerId];
        }
      }

      const updatedCount = viewerId
        ? nextLikeArray.length
        : hasLiked
        ? Math.max(0, baseCount - 1)
        : baseCount + 1;

      return {
        ...statusEntry,
        hasLiked: !hasLiked,
        likeCount: updatedCount,
        like: viewerId ? nextLikeArray : statusEntry.like,
      };
    });

    const normalizedNext = normalizeStatuses(nextStatuses, viewerId);

    setStatuses(normalizedNext);

    try {
      if (hasLiked) {
        await unlikeStatus(statusId, token);
      } else {
        await likeStatus(statusId, token);
      }
    } catch (error) {
      setStatuses(previousStatuses);
      const text = error instanceof Error ? error.message : "Unable to update like.";
      setFlash({ text, tone: "error" });
    }
  };

  const insights = useMemo<InsightSummary>(() => {
    if (statuses.length === 0) {
      const introHelper = loading ? "Crunching latest numbers..." : "Start the conversation";
      return {
        totals: [
          { label: "Active Posts", value: 0, helper: introHelper, tone: "posts" },
          {
            label: "Reactions",
            value: 0,
            helper: loading ? "Gathering likes data..." : "No likes yet",
            tone: "likes",
          },
          {
            label: "Comments",
            value: 0,
            helper: loading ? "Collecting comments..." : "No insights yet",
            tone: "comments",
          },
          {
            label: "Voices",
            value: 0,
            helper: loading ? "Checking contributors..." : "Invite classmates to join in",
            tone: "contributors",
          },
        ],
        highlight: null,
      };
    }

    let totalLikes = 0;
    let totalComments = 0;
    const contributorSet = new Set<string>();
    let topStatus = statuses[0];
    let topScore = resolveLikeCount(topStatus) * 2 + topStatus.comment.length;

    for (const status of statuses) {
      const likeCount = resolveLikeCount(status);
      const commentCount = status.comment.length;

      totalLikes += likeCount;
      totalComments += commentCount;

      contributorSet.add(resolveStatusAuthorName(status));
      status.comment.forEach((comment) => {
        contributorSet.add(resolveCommentAuthorName(comment));
      });

      const engagementScore = likeCount * 2 + commentCount;
      if (engagementScore > topScore) {
        topScore = engagementScore;
        topStatus = status;
      }
    }

    const totals: InsightMetric[] = [
      {
        label: "Active Posts",
        value: statuses.length,
        helper: statuses.length === 1 ? "1 update shared" : `${statuses.length} updates shared`,
        tone: "posts",
      },
      {
        label: "Reactions",
        value: totalLikes,
        helper: totalLikes === 1 ? "1 total like" : `${totalLikes} total likes`,
        tone: "likes",
      },
      {
        label: "Comments",
        value: totalComments,
        helper: totalComments === 1 ? "1 insight shared" : `${totalComments} insights shared`,
        tone: "comments",
      },
      {
        label: "Voices",
        value: contributorSet.size,
        helper:
          contributorSet.size === 0
            ? "Join the conversation"
            : contributorSet.size === 1
            ? "1 contributing member"
            : `${contributorSet.size} contributing members`,
        tone: "contributors",
      },
    ];

    const trimmedContent = (topStatus.content ?? "").trim();
    const excerpt =
      trimmedContent.length === 0
        ? "This update is driving the conversation."
        : trimmedContent.length > 160
        ? `${trimmedContent.slice(0, 157)}…`
        : trimmedContent;

    const highlight: HighlightSpotlight = {
      title: "Most Engaging Post",
      author: resolveStatusAuthorName(topStatus),
      metrics: `${resolveLikeCount(topStatus)} likes • ${topStatus.comment.length} comments`,
      excerpt,
    };

    return { totals, highlight };
  }, [loading, statuses]);

  const toneClassMap = useMemo<Record<InsightTone, string>>(
    () => ({
      posts: styles.insightPosts,
      likes: styles.insightLikes,
      comments: styles.insightComments,
      contributors: styles.insightContributors,
    }),
    []
  );

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <h1>Status Board</h1>
        <p>Post updates, interact with classmates, and follow conversations in your program.</p>
      </header>

      <section className={styles.postBox}>
        <form onSubmit={handlePost} className={styles.postForm}>
          <textarea
            rows={4}
            placeholder="Share your update with the class..."
            value={content}
            onChange={(event) => setContent(event.target.value)}
            disabled={!token || posting}
          />
          <div className={styles.postActions}>
            <button type="submit" disabled={!token || posting}>
              {posting ? "Posting..." : "Post status"}
            </button>
            {!token ? <span className={styles.postHint}>Sign in to enable posting.</span> : null}
          </div>
        </form>
      </section>

      {flash.text ? (
        <p
          className={`${styles.flash} ${
            flash.tone === "error"
              ? styles.flashError
              : flash.tone === "success"
              ? styles.flashSuccess
              : ""
          }`}
          aria-live="polite"
        >
          {flash.text}
        </p>
      ) : null}

      <section className={styles.insights} aria-label="Classroom activity overview">
        <div className={styles.insightsHeader}>
          <h2>Classroom Pulse</h2>
          <p>Real-time snapshot of class activity.</p>
        </div>
        <div className={styles.insightGrid}>
          {insights.totals.map((item) => {
            const toneClass = toneClassMap[item.tone];
            return (
              <article key={item.label} className={`${styles.insightCard} ${toneClass}`}>
                <span className={styles.insightLabel}>{item.label}</span>
                <span className={styles.insightValue}>{item.value}</span>
                <span className={styles.insightHelper}>{item.helper}</span>
              </article>
            );
          })}
        </div>
        {insights.highlight ? (
          <div className={styles.highlightCard}>
            <div className={styles.highlightMeta}>
              <span className={styles.highlightBadge}>{insights.highlight.title}</span>
              <h3>{insights.highlight.author}</h3>
              <p>{insights.highlight.metrics}</p>
            </div>
            {insights.highlight.excerpt ? (
              <p className={styles.highlightExcerpt}>{insights.highlight.excerpt}</p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className={styles.list}>
        {loading ? <p className={styles.loading}>Loading statuses...</p> : null}

        {!loading && statuses.length === 0 && !flash.text ? (
          <p className={styles.empty}>No statuses found.</p>
        ) : null}

        {statuses.map((status) => {
          const authorName = resolveStatusAuthorName(status);
          const authorInitial = resolveStatusAuthorInitial(status);
          const commentCount = status.comment.length;

          return (
            <article key={status._id} className={styles.card}>
              <header className={styles.cardHeader}>
                <div className={styles.cardAuthor}>
                  <span className={styles.avatar} aria-hidden="true">
                    {authorInitial}
                  </span>
                  <div className={styles.cardMeta}>
                    <h2>{authorName}</h2>
                    <time dateTime={status.createdAt}>
                      {new Date(status.createdAt).toLocaleString()}
                    </time>
                  </div>
                </div>
                <button
                  type="button"
                  className={`${styles.likeButton} ${status.hasLiked ? styles.likeActive : ""}`}
                  onClick={() => toggleLike(status._id, status.hasLiked)}
                  disabled={!token}
                >
                  <span className={styles.likePrimary}>{status.hasLiked ? "Unlike" : "Like"}</span>
                  <span className={styles.likeCount}>{resolveLikeCount(status)}</span>
                </button>
              </header>

              <div className={styles.cardBody}>
                <p className={styles.content}>{status.content}</p>
              </div>

              <section className={styles.comments}>
                <div className={styles.commentsHeader}>
                  <h3>Discussion</h3>
                  <span className={styles.commentsBadge}>{commentCount}</span>
                </div>
                {commentCount === 0 ? (
                  <p className={styles.emptyComment}>No comments yet. Share your thoughts.</p>
                ) : (
                  <ul className={styles.commentList}>
                    {status.comment.map((comment) => {
                      const commentAuthor = resolveCommentAuthorName(comment);
                      const commentInitial = resolveCommentAuthorInitial(comment);

                      return (
                        <li key={comment._id} className={styles.comment}>
                          <span className={styles.commentAvatar} aria-hidden="true">
                            {commentInitial}
                          </span>
                          <div className={styles.commentBody}>
                            <div className={styles.commentMeta}>
                              <span className={styles.commentAuthor}>{commentAuthor}</span>
                              <time dateTime={comment.createdAt}>
                                {new Date(comment.createdAt).toLocaleString()}
                              </time>
                            </div>
                            <p className={styles.commentText}>{comment.content}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <form
                  className={styles.commentForm}
                  onSubmit={(event) => handleComment(event, status._id)}
                >
                  <input
                    type="text"
                    placeholder="Add a comment"
                    value={commentDrafts[status._id] ?? ""}
                    onChange={(event) =>
                      setCommentDrafts((prev) => ({ ...prev, [status._id]: event.target.value }))
                    }
                    disabled={!token}
                  />
                  <button type="submit" disabled={!token}>
                    Comment
                  </button>
                </form>
              </section>
            </article>
          );
        })}
      </section>
    </div>
  );
}

