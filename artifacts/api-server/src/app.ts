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
// Strip x-forwarded-host so Next.js host-check sees only "localhost:3000".
app.use((req: Request, res: Response) => {
  const proxyHeaders: Record<string, string | string[]> = {};
  for (const [key, val] of Object.entries(req.headers)) {
    if (
      key === "host" ||
      key === "x-forwarded-host" ||
      key === "x-forwarded-for" ||
      key === "x-forwarded-proto" ||
      key === "x-real-ip"
    ) {
      continue;
    }
    if (val !== undefined) proxyHeaders[key] = val as string | string[];
  }
  proxyHeaders["host"] = "localhost:3000";

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
  proxy.on("error", () => {
    res.status(502).send("Next.js server unavailable");
  });
  req.pipe(proxy, { end: true });
});

export default app;
