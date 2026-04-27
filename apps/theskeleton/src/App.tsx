import React, { useState } from "react";
import { googleAuthPlaceholder } from "./auth/googleAuthPlaceholder";

type PlaceholderUser = Awaited<
  ReturnType<typeof googleAuthPlaceholder.signInMock>
>;

type SignedOutViewProps = {
  loading: boolean;
  onSignIn: () => void;
};

type SignedInViewProps = {
  loading: boolean;
  onSignOut: () => void;
  user: PlaceholderUser | null;
};

function SignedOutView({ loading, onSignIn }: SignedOutViewProps) {
  return (
    <section
      style={{
        border: "1px solid #d0d7de",
        borderRadius: "0.75rem",
        marginTop: "1.5rem",
        padding: "1rem",
      }}
    >
      <h2>Signed-out view</h2>
      <p>
        TheSkeleton currently requires Google/Gmail sign-in as the only
        authentication method. This button is a placeholder and triggers a
        deterministic mock sign-in for UI review.
      </p>
      <button
        type="button"
        onClick={onSignIn}
        disabled={loading}
        aria-disabled={loading}
        style={{
          backgroundColor: "#1a73e8",
          color: "white",
          border: "none",
          padding: "0.5rem 1rem",
          borderRadius: "0.5rem",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Signing in…" : "Sign in with Google"}
      </button>

      <div style={{ marginTop: "0.75rem", color: "#6b7280" }}>
        <small>
          Placeholder note: {googleAuthPlaceholder.message} — {googleAuthPlaceholder.configurationNote}
        </small>
      </div>
    </section>
  );
}

function SignedInView({ user, onSignOut, loading }: SignedInViewProps) {
  if (!user) {
    return null;
  }

  return (
    <section
      style={{
        border: "1px solid #d0d7de",
        borderRadius: "0.75rem",
        marginTop: "1.5rem",
        padding: "1rem",
      }}
    >
      <h2>Authenticated user</h2>
      <p>
        The authenticated state is visible in the UI. TheSkeleton currently
        displays a minimal profile derived from Google sign-in ({user.provider}).
      </p>

      <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
        <div>
          <strong>{user.name}</strong>
          <div style={{ color: "#6b7280" }}>{user.email}</div>
        </div>

        <div style={{ marginLeft: "auto" }}>
          <button
            type="button"
            onClick={onSignOut}
            disabled={loading}
            aria-disabled={loading}
            style={{
              backgroundColor: "#e53935",
              color: "white",
              border: "none",
              padding: "0.4rem 0.8rem",
              borderRadius: "0.5rem",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<PlaceholderUser | null>(null);

  async function handleSignIn() {
    try {
      setLoading(true);
      const nextUser = await googleAuthPlaceholder.signInMock();
      setUser(nextUser);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    try {
      setLoading(true);
      await googleAuthPlaceholder.signOutMock();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        fontFamily: "sans-serif",
        margin: "0 auto",
        maxWidth: "48rem",
        padding: "3rem 1.5rem",
      }}
    >
      <h1>TheSkeleton</h1>
      <p>
        This milestone keeps Google login as a safe placeholder. No real OAuth
        flow, client ID, or secret is present in this app.
      </p>

      {!user ? (
        <SignedOutView loading={loading} onSignIn={handleSignIn} />
      ) : (
        <SignedInView
          loading={loading}
          onSignOut={handleSignOut}
          user={user}
        />
      )}

      <section
        style={{
          border: "1px solid #d0d7de",
          borderRadius: "0.75rem",
          marginTop: "1.5rem",
          padding: "1rem",
        }}
      >
        <h2>Auth boundary & next steps (placeholder)</h2>
        <p>
          The file <code>src/auth/googleAuthPlaceholder.ts</code> is the only
          auth boundary in this POC. It contains deterministic mock sign-in and
          sign-out behavior for local UI review.
        </p>
        <ul>
          <li>Only Google/Gmail sign-in is considered for authentication.</li>
          <li>Authenticated state is shown with a mock user profile.</li>
          <li>Sign-out returns the app to a signed-out placeholder view.</li>
        </ul>
      </section>
    </main>
  );
}
