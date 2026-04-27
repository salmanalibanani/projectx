export default function App() {
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
      <p>Google login will be added here in a later implementation milestone.</p>

      <section
        style={{
          border: "1px solid #d0d7de",
          borderRadius: "0.75rem",
          marginTop: "1.5rem",
          padding: "1rem",
        }}
      >
        <h2>Signed-out state</h2>
        <p>User is currently signed out.</p>
        <button disabled type="button">
          Sign in with Google
        </button>
      </section>

      <section
        style={{
          border: "1px solid #d0d7de",
          borderRadius: "0.75rem",
          marginTop: "1.5rem",
          padding: "1rem",
        }}
      >
        <h2>Authenticated user placeholder</h2>
        <p>No authenticated user state is connected yet.</p>
      </section>
    </main>
  );
}
