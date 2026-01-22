import express from "express";
import type { Express } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { healthRouter } from "./routes/health";
import { authRouter } from "./routes/auth";
import { usersRouter } from "./routes/users";
import { lessonsRouter } from "./routes/lessons";
import { coursesRouter } from "./routes/courses";
import { tutorApplicationsRouter } from "./routes/tutorApplications";
import { pagesRouter } from "./routes/pages";
import { env } from "./config/env";
import { tutorsRouter } from "./routes/tutors";
import { adminRouter } from "./routes/admin";
import { activityRouter } from "./routes/activity";

export function createApp(): Express {
  const app = express();

  const allowedOrigins = [...env.frontendAppUrls, 'http://localhost:5174', 'http://localhost:5175'];
  const corsOptions: cors.CorsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.some((allowed) => origin === allowed)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  };

  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions));
  app.use(cookieParser());
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.get("/", (_req, res) => {
    res.status(200).json({ message: "Course Platform API" });
  });
  app.use("/health", healthRouter);
  app.use("/auth", authRouter);
  app.use("/users", usersRouter);
  app.use("/lessons", lessonsRouter);
  app.use("/courses", coursesRouter);
  app.use("/tutor-applications", tutorApplicationsRouter);
  app.use("/pages", pagesRouter);
  app.use("/tutors", tutorsRouter);
  app.use("/admin", adminRouter);
  app.use("/activity", activityRouter);

  // Mirror routes under /api/* so the frontend can call them with a consistent prefix.
  const apiRouter = express.Router();
  apiRouter.use("/health", healthRouter);
  apiRouter.use("/auth", authRouter);
  apiRouter.use("/users", usersRouter);
  apiRouter.use("/lessons", lessonsRouter);
  apiRouter.use("/courses", coursesRouter);
  apiRouter.use("/tutor-applications", tutorApplicationsRouter);
  apiRouter.use("/pages", pagesRouter);
  apiRouter.use("/tutors", tutorsRouter);
  apiRouter.use("/admin", adminRouter);
  apiRouter.use("/activity", activityRouter);
  app.use("/api", apiRouter);

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Unhandled error", err);
    res.status(500).json({ message: "Internal server error" });
  });

  return app;
}
