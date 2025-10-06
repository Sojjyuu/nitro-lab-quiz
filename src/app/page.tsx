import Link from "next/link";
import styles from "./page.module.css";

const navItems = [
  {
    href: "/login",
    title: "Sign In",
    description: "Sign in to unlock the features and fetch your API token.",
  },
  {
    href: "/profile",
    title: "Profile",
    description: "Review your academic profile, advisor, and school information.",
  },
  {
    href: "/classmates",
    title: "Classmates",
    description: "Browse your cohort and see program details and advisors.",
  },
  {
    href: "/statuses",
    title: "Status Board",
    description: "Post updates, leave comments, and react to classmates.",
  },
];

export default function Home() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.badge}>KKU Classroom Toolkit</span>
        <h1>Welcome</h1>
        <p>
          A starter workspace for the classroom APIs. Begin with the sign in flow,
          then explore your profile, classmates, and the shared status board.
        </p>
      </header>

      <main className={styles.main}>
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} className={styles.card}>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
            <span aria-hidden className={styles.arrow}>&rarr;</span>
          </Link>
        ))}
      </main>

      <footer className={styles.footer}>
        <small>Tip: sign in first to receive the token required by the other endpoints.</small>
      </footer>
    </div>
  );
}