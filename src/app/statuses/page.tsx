"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";
import {
  fetchStatuses,
  createStatus,
  createComment,
  likeStatus,
  unlikeStatus,
} from "../lib/api/api";
import type { StatusItem } from "../types";
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
      ? status.comment.map((comment) => ({ ...comment }))
      : status.comment,
  }));

const cloneStatus = (status: StatusItem): StatusItem => ({
  ...status,
  like: Array.isArray(status.like)
    ? status.like.map((entry) => (typeof entry === "string" ? entry : { ...entry }))
    : status.like,
  comment: Array.isArray(status.comment)
    ? status.comment.map((comment) => ({ ...comment }))
    : status.comment,
});

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

      <section className={styles.list}>
        {loading ? <p className={styles.loading}>Loading statuses...</p> : null}

        {!loading && statuses.length === 0 && !flash.text ? (
          <p className={styles.empty}>No statuses found.</p>
        ) : null}

        {statuses.map((status) => (
          <article key={status._id} className={styles.card}>
            <header className={styles.cardHeader}>
              <div className={styles.cardMeta}>
                <h2>{typeof status.createdBy === "string" ? status.createdBy : status.createdBy.name}</h2>
                <time dateTime={status.createdAt}>
                  {new Date(status.createdAt).toLocaleString()}
                </time>
              </div>
              <button
                type="button"
                className={`${styles.likeButton} ${status.hasLiked ? styles.likeActive : ""}`}
                onClick={() => toggleLike(status._id, status.hasLiked)}
                disabled={!token}
              >
                {status.hasLiked ? "Unlike" : "Like"} ({resolveLikeCount(status)})
              </button>
            </header>

            <p className={styles.content}>{status.content}</p>

            <section className={styles.comments}>
              <h3>Comments</h3>
              {status.comment.length === 0 ? (
                <p className={styles.emptyComment}>No comments yet.</p>
              ) : (
                <ul>
                  {status.comment.map((comment) => (
                    <li key={comment._id}>
                      <p>{comment.content}</p>
                      <time dateTime={comment.createdAt}>
                        {new Date(comment.createdAt).toLocaleString()}
                      </time>
                    </li>
                  ))}
                </ul>
              )}

              <form className={styles.commentForm} onSubmit={(event) => handleComment(event, status._id)}>
                <input
                  type="text"
                  placeholder="Add a comment"
                  value={commentDrafts[status._id] ?? ""}
                  onChange={(event) =>
                    setCommentDrafts((prev) => ({ ...prev, [status._id]: event.target.value }))
                  }
                  disabled={!token}
                />
                <button type="submit" disabled={!token}>Comment</button>
              </form>
            </section>
          </article>
        ))}
      </section>
    </div>
  );
}

