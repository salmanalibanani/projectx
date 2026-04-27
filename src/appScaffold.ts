import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { AppScaffoldResult } from "./types.js";

const appPath = "apps/theskeleton";

const scaffoldFiles = {
  "apps/theskeleton/package.json": `{
  "name": "theskeleton",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "@types/react": "^19.1.2",
    "@types/react-dom": "^19.1.2",
    "@vitejs/plugin-react": "^5.0.0",
    "typescript": "^5.8.3",
    "vite": "^7.1.0"
  }
}
`,
  "apps/theskeleton/index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TheSkeleton</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
  "apps/theskeleton/tsconfig.json": `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"],
  "references": []
}
`,
  "apps/theskeleton/vite.config.ts": `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
`,
  "apps/theskeleton/src/main.tsx": `import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
`,
  "apps/theskeleton/src/App.tsx": `export default function App() {
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
`,
  "apps/theskeleton/src/auth/googleAuthPlaceholder.ts": `export const googleAuthPlaceholder = {
  message: "No real OAuth is implemented yet.",
  configurationNote:
    "A future Google client ID should come from environment-based configuration.",
  secretPolicy: "No secrets should be committed to the repository.",
} as const;
`,
} as const;

export async function generateAppScaffold(): Promise<AppScaffoldResult> {
  const files = Object.keys(scaffoldFiles);
  const conflicts: string[] = [];

  for (const filePath of files) {
    try {
      const existingContent = await readFile(filePath, "utf8");

      if (existingContent !== scaffoldFiles[filePath as keyof typeof scaffoldFiles]) {
        conflicts.push(filePath);
      }
    } catch (error) {
      const fileError = error as NodeJS.ErrnoException;

      if (fileError.code !== "ENOENT") {
        throw error;
      }
    }
  }

  if (conflicts.length > 0) {
    return {
      generated: false,
      appPath,
      files,
      error: "App scaffold files already exist with conflicting content.",
      conflicts,
    };
  }

  for (const filePath of files) {
    await mkdir(dirname(filePath), { recursive: true });

    try {
      await readFile(filePath, "utf8");
    } catch (error) {
      const fileError = error as NodeJS.ErrnoException;

      if (fileError.code !== "ENOENT") {
        throw error;
      }

      await writeFile(
        filePath,
        scaffoldFiles[filePath as keyof typeof scaffoldFiles],
        "utf8",
      );
    }
  }

  return {
    generated: true,
    appPath,
    files,
  };
}
