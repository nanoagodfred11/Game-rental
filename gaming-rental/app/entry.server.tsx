import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";
import { type EntryContext, ServerRouter } from "react-router";
import { connectDB } from "~/services/db.server";
import { seedDatabase } from "~/services/seed.server";
import { startBackgroundWorker } from "~/services/background.server";

// Eagerly initialize on module load — runs before any loader
const initPromise = (async () => {
  try {
    await connectDB();
    await seedDatabase();
    startBackgroundWorker();
    console.log("Server initialization complete");
  } catch (error) {
    console.error("Server initialization error:", error);
  }
})();

export { initPromise };

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  entryContext: EntryContext
) {
  // Ensure init is complete (no-op if already done)
  await initPromise;

  const body = await renderToReadableStream(
    <ServerRouter context={entryContext} url={request.url} />,
    {
      signal: request.signal,
      onError(error: unknown) {
        console.error(error);
        responseStatusCode = 500;
      },
    }
  );

  if (isbot(request.headers.get("user-agent") || "")) {
    await body.allReady;
  }

  responseHeaders.set("Content-Type", "text/html");
  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
