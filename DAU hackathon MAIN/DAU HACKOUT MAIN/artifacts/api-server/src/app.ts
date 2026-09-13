import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { attachAuthContext } from "./middleware/auth";
import { errorHandler, notFound } from "./middleware/errors";
import { requestContext } from "./middleware/request-context";
import { securityHeaders, writeRateLimit } from "./middleware/security";

const app: Express = express();

app.disable("x-powered-by");
app.use(helmet());
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
app.use(requestContext);
app.use(securityHeaders);
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",").map((origin) => origin.trim()) ?? true,
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(writeRateLimit);
app.use(attachAuthContext);

app.use("/api", router);
app.use(notFound);
app.use(errorHandler);

export default app;
