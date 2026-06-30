import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { request as httpRequest } from "http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Proxy all non-/api traffic to the Next.js dev server on port 3000.
//
// Key considerations:
// 1. Strip x-forwarded-host so Next.js host-check sees only "localhost:3000".
// 2. express.json() has already consumed the request stream for POST/PUT/PATCH
//    requests, so re-serialize req.body instead of piping the (empty) stream.
// 3. Use a 30 s socket timeout to survive Next.js first-compile latency (~5 s).
app.use((req: Request, res: Response) => {
  const proxyHeaders: Record<string, string | string[]> = {};
  for (const [key, val] of Object.entries(req.headers)) {
    if (
      key === "host" ||
      key === "x-forwarded-host" ||
      key === "x-forwarded-for" ||
      key === "x-forwarded-proto" ||
      key === "x-real-ip" ||
      key === "content-length" // will be recalculated below if needed
    ) {
      continue;
    }
    if (val !== undefined) proxyHeaders[key] = val as string | string[];
  }
  proxyHeaders["host"] = "localhost:3000";

  // Re-build body if express already consumed the stream
  let rawBody: Buffer | null = null;
  if (
    req.body !== undefined &&
    ["POST", "PUT", "PATCH"].includes(req.method)
  ) {
    rawBody = Buffer.from(JSON.stringify(req.body), "utf-8");
    proxyHeaders["content-type"] = "application/json";
    proxyHeaders["content-length"] = String(rawBody.byteLength);
  }

  const proxy = httpRequest(
    {
      hostname: "localhost",
      port: 3000,
      path: req.url,
      method: req.method,
      headers: proxyHeaders,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    },
  );

  // Allow up to 30 s for Next.js page compilation on first visit
  proxy.setTimeout(30_000, () => proxy.destroy());

  proxy.on("error", () => {
    if (!res.headersSent) res.status(502).send("Next.js server unavailable");
  });

  if (rawBody !== null) {
    proxy.write(rawBody);
    proxy.end();
  } else {
    req.pipe(proxy, { end: true });
  }
});

export default app;
