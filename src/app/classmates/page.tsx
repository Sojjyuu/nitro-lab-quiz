"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";
import { Classmate, fetchClassmates } from "../lib/api/api";
import { getClientToken } from "../lib/api/session";

type Status = {
  message: string;
  tone: "idle" | "error";
};

const currentYear = new Date().getFullYear();
const redirectTarget = "/classmates";
const loginRedirect = (target: string) => `/login?redirect=${encodeURIComponent(target)}`;

export default function ClassmatesPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [year, setYear] = useState<string>(String(currentYear));
  const [classmates, setClassmates] = useState<Classmate[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>({ message: "", tone: "idle" });

  useEffect(() => {
    const storedToken = getClientToken();
    if (!storedToken) {
      setStatus({ message: "Redirecting to sign in...", tone: "error" });
      router.replace(loginRedirect(redirectTarget));
      return;
    }

    setToken(storedToken);
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!year) {
      setStatus({ message: "Please enter an enrollment year.", tone: "error" });
      return;
    }

    if (!token) {
      setStatus({ message: "Token missing. Redirecting to sign in...", tone: "error" });
      router.replace(loginRedirect(redirectTarget));
      return;
    }

    try {
      setLoading(true);
      setStatus({ message: "", tone: "idle" });
      const data = await fetchClassmates(year, token);
      setClassmates(data);
      if (data.length === 0) {
        setStatus({ message: "No classmates found for that year.", tone: "idle" });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load classmates.";
      setStatus({ message, tone: "error" });
      setClassmates([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <h1>Classmates</h1>
        <p>Search by enrollment year to view classmates, their programs, and advisors.</p>
      </header>

      <form className={styles.controls} onSubmit={handleSubmit}>
        <label className={styles.field}>
          <span>Enrollment year</span>
          <input
            type="number"
            min={2000}
            max={2100}
            placeholder="2023"
            value={year}
            onChange={(event) => setYear(event.target.value)}
            required
            disabled={!token || loading}
          />
        </label>
        <button type="submit" className={styles.fetchButton} disabled={!token || loading}>
          {loading ? "Loading..." : "Fetch classmates"}
        </button>
      </form>

      {status.message ? (
        <p className={`${styles.status} ${status.tone === "error" ? styles.statusError : ""}`} aria-live="polite">
          {status.message}
        </p>
      ) : null}

      <section className={styles.results}>
        {classmates.length === 0 && !status.message ? (
          <p className={styles.empty}>No data yet. Enter a year and fetch classmates.</p>
        ) : null}

        {classmates.map((person) => (
          <article key={person._id} className={styles.card}>
            <div className={styles.cardHeader}>
              <img
                src={person.image || "https://placehold.co/80x80?text=No+Photo"}
                alt={`${person.firstname} ${person.lastname}`}
                className={styles.avatar}
                width={64}
                height={64}
              />
              <div>
                <h2>
                  {person.firstname} {person.lastname}
                </h2>
                <p>{person.email}</p>
              </div>
            </div>

            <dl className={styles.meta}>
              <div>
                <dt>Program</dt>
                <dd>{person.education.major}</dd>
              </div>
              <div>
                <dt>Student ID</dt>
                <dd>{person.education.studentId}</dd>
              </div>
              <div>
                <dt>Advisor</dt>
                <dd>{person.education.advisor?.name ?? "-"}</dd>
              </div>
              <div>
                <dt>School</dt>
                <dd>{person.education.school?.name ?? "-"}</dd>
              </div>
            </dl>
          </article>
        ))}
      </section>
    </div>
  );
}
