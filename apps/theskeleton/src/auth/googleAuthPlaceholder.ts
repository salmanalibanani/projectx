export const googleAuthPlaceholder = {
  // Human-readable note: this file defines the explicit boundary for future
  // Google OAuth wiring. It intentionally contains NO secrets, client IDs, or
  // network calls. In a later implementation milestone the functions below
  // will be replaced with real integrations that read client IDs from
  // environment configuration and perform OAuth flows.

  message: "No real OAuth is implemented yet.",
  configurationNote:
    "A future Google client ID should come from environment-based configuration. Do NOT commit secrets.",
  secretPolicy: "No secrets should be committed to the repository.",

  // Deterministic mock sign-in used for local UI and review. This simulates a
  // successful Google sign-in without calling any external services.
  async signInMock() {
    // Simulate a stable, deterministic delay to mimic an async call.
    await new Promise((res) => setTimeout(res, 150));

    // Return a deterministic mock user profile. These values are static and
    // safe for repository storage.
    return {
      id: "demo-123",
      name: "Demo User",
      email: "demo.user@example.com",
      picture: undefined,
      provider: "google",
    } as const;
  },

  // Deterministic mock sign-out.
  async signOutMock() {
    await new Promise((res) => setTimeout(res, 75));
    return true;
  },
} as const;
