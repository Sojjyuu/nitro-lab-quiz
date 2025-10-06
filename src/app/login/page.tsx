"use client";

import { ChangeEvent, FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./page.module.css";
import { signIn } from "../lib/api/api";
import { getClientToken } from "../lib/api/session";

type FormState = {
  email: string;
  password: string;
};

type Status = {
  message: string;
  tone: "idle" | "error" | "success";
};

const initialForm: FormState = {
  email: "",
  password: "",
};

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") ?? "/statuses";
  const redirectTimer = useRef<NodeJS.Timeout | null>(null);

  const [form, setForm] = useState<FormState>(initialForm);
  const [status, setStatus] = useState<Status>({ message: "", tone: "idle" });
  const [loading, setLoading] = useState(false);
  const [tokenPreview, setTokenPreview] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = getClientToken();
    if (storedToken) {
      setTokenPreview(storedToken);
      setStatus({ message: "You are already signed in. Redirecting...", tone: "success" });
      redirectTimer.current = setTimeout(() => {
        router.replace(redirectPath);
      }, 900);
    }

    return () => {
      if (redirectTimer.current) {
        clearTimeout(redirectTimer.current);
      }
    };
  }, [redirectPath, router]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.email || !form.password) {
      setStatus({ message: "Please provide both email and password.", tone: "error" });
      return;
    }

    try {
      setLoading(true);
      setStatus({ message: "Signing in...", tone: "idle" });
      const data = await signIn(form);

      window.localStorage.setItem("classroomToken", data.token);
      window.localStorage.setItem("classroomProfile", JSON.stringify(data));
      setTokenPreview(data.token);

      await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: data.token }),
      }).catch(() => {
        /* swallow; cookie not critical for client usage */
      });

      setForm(initialForm);
      setStatus({ message: "Sign in success. Redirecting you now...", tone: "success" });

      redirectTimer.current = setTimeout(() => {
        router.push(redirectPath);
      }, 800);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setStatus({ message, tone: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <section className={styles.card}>
        <header className={styles.header}>
          <h1>Sign In</h1>
          <p>Enter your classroom email and password to receive an API token.</p>
        </header>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>Email</span>
            <input
              type="email"
              name="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              required
            />
          </label>

          <label className={styles.field}>
            <span>Password</span>
            <input
              type="password"
              name="password"
              placeholder="password123"
              value={form.password}
              onChange={handleChange}
              autoComplete="current-password"
              required
            />
          </label>

          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {status.message ? (
          <p
            className={`${styles.status} ${
              status.tone === "error"
                ? styles.statusError
                : status.tone === "success"
                ? styles.statusSuccess
                : ""
            }`}
            aria-live="polite"
          >
            {status.message}
          </p>
        ) : null}
      </section>

      <aside className={styles.hint}>
        <h2>What happens next?</h2>
        <ol>
          <li>Submit your credentials to the /api/classroom/signin endpoint.</li>
          <li>We store the returned token securely on this device.</li>
          <li>You are redirected to continue exploring classmates and statuses.</li>
        </ol>

        {tokenPreview ? (
          <div className={styles.tokenBox}>
            <p>Latest token detected for this browser:</p>
            <code>{tokenPreview}</code>
          </div>
        ) : (
          <p className={styles.tokenNote}>No token stored yet.</p>
        )}
      </aside>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
