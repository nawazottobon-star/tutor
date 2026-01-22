import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import { Prisma, PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/utils/password";

const prisma = new PrismaClient();

const COURSE_ID = "f26180b2-5dda-495a-a014-ae02e63f172f";
const ADMIN_EMAIL = "jaswanthvanapalli12@gmail.com";
const ADMIN_PASSWORD = "Ottobon@2025";
const ADMIN_NAME = "Platform Admin";

type SeedCourse = {
  courseId?: string;
  slug: string;
  courseName: string;
  description: string;
  priceCents: number;
  category: string;
  level: string;
  instructor: string;
  durationMinutes: number;
  rating: number;
  students: number;
  thumbnailUrl?: string;
  heroVideoUrl?: string;
  isFeatured?: boolean;
};

const SEED_COURSES: SeedCourse[] = [
  {
    courseId: COURSE_ID,
    slug: "ai-in-web-development",
    courseName: "AI in Web Development",
    description:
      "Master the integration of AI technologies in modern web development while building a complete end-to-end application with guided prompts and real project workflows.",
    priceCents: 399900,
    category: "AI & Machine Learning",
    level: "Beginner",
    instructor: "Dr. Sarah Chen",
    durationMinutes: 8 * 60,
    rating: 4.8,
    students: 2847,
    thumbnailUrl: "https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d?auto=format&fit=crop&w=800&q=80",
    heroVideoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    isFeatured: true,
  },
  {
    slug: "full-stack-react-mastery",
    courseName: "Full Stack React Mastery",
    description:
      "Complete guide to the React ecosystem including Next.js, TypeScript, testing, API design, and deployment best practices for production apps.",
    priceCents: 649900,
    category: "Frontend Development",
    level: "Intermediate",
    instructor: "Alex Rodriguez",
    durationMinutes: 12 * 60,
    rating: 4.9,
    students: 1523,
    thumbnailUrl: "https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7?auto=format&fit=crop&w=800&q=80",
    heroVideoUrl: "https://www.youtube.com/embed/VYOjWnS4cMY",
    isFeatured: true,
  },
  {
    slug: "python-for-automation",
    courseName: "Python for Automation",
    description:
      "Automate repetitive tasks and build powerful scripts with Python. Cover web scraping, file processing, API integration, and scheduling.",
    priceCents: 319900,
    category: "Python & Automation",
    level: "Beginner",
    instructor: "Maria Garcia",
    durationMinutes: 6 * 60,
    rating: 4.7,
    students: 3241,
    thumbnailUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80",
  },
  {
    slug: "advanced-javascript-concepts",
    courseName: "Advanced JavaScript Concepts",
    description:
      "Deep dive into JavaScript fundamentals, async flows, design patterns, and performance tuning to ship resilient frontends.",
    priceCents: 569900,
    category: "Programming Languages",
    level: "Advanced",
    instructor: "John Mitchell",
    durationMinutes: 10 * 60,
    rating: 4.8,
    students: 2113,
    thumbnailUrl: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=800&q=80",
  },
  {
    slug: "human-centered-ui-design",
    courseName: "Human-Centered UI Design",
    description:
      "Blend research, typography, accessibility, and prototyping to design delightful experiences with Figma and collaborative workflows.",
    priceCents: 289900,
    category: "Design",
    level: "Intermediate",
    instructor: "Priya Natarajan",
    durationMinutes: 5 * 60,
    rating: 4.6,
    students: 1842,
    thumbnailUrl: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80",
  },
];

type PageContentSeed = {
  slug: string;
  title: string;
  subtitle?: string;
  heroImage?: string;
  sections: Prisma.JsonValue;
};

const PAGE_CONTENT: PageContentSeed[] = [
  {
    slug: "about",
    title: "Learning that moves careers forward",
    subtitle: "Ottolearn blends industry projects, senior mentors, and adaptive AI guidance so learners build skills with confidence.",
    heroImage: "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1600&q=80",
    sections: {
      stats: [
        { label: "Learners", value: "58K+" },
        { label: "Instructors", value: "320+" },
        { label: "Countries", value: "42" },
      ],
      highlights: [
        {
          title: "Career-first curriculum",
          description: "Every module ends with a workplace scenario reviewed by mentors working at top product companies.",
        },
        {
          title: "Personalized guidance",
          description: "Adaptive study plans identify weak topics and recommend lessons, practice labs, or tutors automatically.",
        },
        {
          title: "Verified credentials",
          description: "Shareable course credentials and capstone reviews showcase real mastery to hiring teams.",
        },
      ],
      values: [
        { title: "People over vanity metrics", description: "We optimise for learner trust and job-readiness, not course starts." },
        { title: "Learning transparently", description: "Clear syllabi, project rubrics, and success data keep everyone aligned." },
        { title: "Built with industry", description: "Courses are co-designed with product orgs so skills match hiring needs." },
      ],
      faqs: [
        {
          question: "How are instructors vetted?",
          answer: "Mentors submit teaching demos, project samples, and references. Only 8% make it onto the platform.",
        },
        {
          question: "Do courses include live support?",
          answer: "Each track offers weekly office hours, async Q&A, and AI copilots to unblock you faster.",
        },
      ],
    },
  },
  {
    slug: "courses",
    title: "Curated tracks across tech, product, and creative skills",
    subtitle: "Browse an ever-growing catalogue backed by mentor support, practice projects, and progress analytics.",
    sections: {
      categories: ["AI & ML", "Frontend", "Backend", "Cloud & DevOps", "Design", "Product"],
      filters: ["Beginner friendly", "Includes certificate", "Live mentor hours", "Hands-on labs"],
    },
  },
  {
    slug: "become-a-tutor",
    title: "Share your expertise with 58K+ motivated learners",
    subtitle: "Launch a cohort-based experience or contribute on-demand lessons. We help with curriculum design, tooling, and analytics.",
    sections: {
      steps: [
        { title: "Submit your course idea", description: "Tell us about the skills you teach and the outcomes learners can expect." },
        { title: "Co-design the syllabus", description: "Our curriculum team helps structure modules, assessments, and projects." },
        { title: "Launch with confidence", description: "We provide recording support, mentor training, and detailed learner analytics." },
      ],
      perks: [
        { title: "Revenue sharing", description: "Earn up to 60% share on every learner and unlock milestone bonuses." },
        { title: "Production support", description: "From studio hours to editors—we make content creation painless." },
        { title: "Global reach", description: "Teach learners across 40+ countries with translations and AI dubbing built-in." },
      ],
    },
  },
];

type CsvTopicRow = {
  topic_id: string;
  course_id: string;
  module_no: string;
  module_name: string;
  topic_number: string;
  topic_name: string;
  content_type: string | null;
  video_url: string | null;
  text_content: string | null;
  is_preview: string | null;
};

type SimulationBody = {
  overview: string;
  steps: Array<{
    title: string;
    challenge: string;
    task: string;
  }>;
};

function toBoolean(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function normaliseLineEndings(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return value.replace(/\r\n/g, "\n").trim();
}

async function loadTopicsFromCsv(csvPath: string, courseId: string): Promise<Prisma.TopicCreateManyInput[]> {
  try {
    const raw = await fs.readFile(csvPath, "utf8");
    const records = parse(raw, {
      columns: true,
      skip_empty_lines: true,
    }) as CsvTopicRow[];

    return records
      .filter((record) => record.course_id === courseId)
      .map((record) => {
        const moduleNo = Number.parseInt(record.module_no, 10);
        const topicNumber = Number.parseInt(record.topic_number, 10);

        return {
          topicId: record.topic_id,
          courseId: record.course_id,
          moduleNo: Number.isNaN(moduleNo) ? 0 : moduleNo,
          moduleName: record.module_name?.trim() ?? "",
          topicNumber: Number.isNaN(topicNumber) ? 0 : topicNumber,
          topicName: record.topic_name?.trim() ?? "",
          contentType: record.content_type?.trim().toLowerCase() ?? "video",
          videoUrl: record.video_url?.trim() || null,
          textContent: normaliseLineEndings(record.text_content),
          isPreview: toBoolean(record.is_preview),
        };
      });
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      console.warn(`Topics CSV not found at ${csvPath}. Skipping topic seeding.`);
      return [];
    }
    console.error("Failed to parse topics CSV", error);
    throw error;
  }
}

async function seedCourses(): Promise<void> {
  for (const course of SEED_COURSES) {
    const { courseId, ...rest } = course;
    const payload = {
      ...rest,
      slug: rest.slug.toLowerCase(),
      isFeatured: rest.isFeatured ?? false,
    };

    if (courseId) {
      await prisma.course.upsert({
        where: { courseId },
        create: { courseId, ...payload },
        update: payload,
      });
    } else {
      await prisma.course.upsert({
        where: { slug: payload.slug },
        create: payload,
        update: payload,
      });
    }
  }
}

async function seedTopics(topics: Prisma.TopicCreateManyInput[]): Promise<void> {
  if (topics.length === 0) {
    console.warn("No topics found in CSV; skipping topic seeding.");
    return;
  }

  await prisma.topic.deleteMany({
    where: { courseId: COURSE_ID },
  });

  const chunkSize = 100;
  for (let index = 0; index < topics.length; index += chunkSize) {
    const chunk = topics.slice(index, index + chunkSize);
    await prisma.topic.createMany({
      data: chunk,
      skipDuplicates: true,
    });
  }

  console.log(`Seeded ${topics.length} topics from CSV`);
}

function buildSimulationBody(topic: Prisma.TopicCreateManyInput): SimulationBody {
  const topicLabel = topic.topicName?.trim() || "this lesson";
  return {
    overview: `Apply the ideas from "${topicLabel}" by walking through real-world tradeoffs. Choose a strategy, defend your reasoning, and predict downstream impact.`,
    steps: [
      {
        title: "Tool Alignment",
        challenge: "Your AI design output doesn't match the expectations of your coding assistant.",
        task: "Decide whether to refactor prompts, regenerate assets, or adjust the runtime to keep the flow unblocked.",
      },
      {
        title: "Feedback Loop Diagnosis",
        challenge: "A downstream AI flags regressions after deployment.",
        task: "Identify where the feedback loop failed—communication gap, missing human checkpoint, or incorrect assumptions.",
      },
      {
        title: "Prompt Precision",
        challenge: "Stakeholders gave vague instructions for the feature.",
        task: "Rewrite the request into a structured, AI-ready prompt with constraints, intent, and hand-off notes.",
      },
      {
        title: "System Failure Choice",
        challenge: "One supporting AI tool becomes unavailable mid-build.",
        task: "Choose which outage would be most disruptive for this topic and justify it with dependency/risk analysis.",
      },
    ],
  };
}

async function seedSimulationExercises(topics: Prisma.TopicCreateManyInput[]): Promise<void> {
  if (topics.length === 0) {
    console.warn("Skipping simulation seeding because no topics were loaded.");
    return;
  }

  const payload = topics.map((topic) => ({
    topicId: topic.topicId!,
    title: `${topic.topicName?.trim() || "Lesson"} Simulation Exercise`,
    body: buildSimulationBody(topic),
  }));

  await prisma.simulationExercise.deleteMany({
    where: {
      topicId: { in: payload.map((entry) => entry.topicId) },
    },
  });

  const chunkSize = 100;
  for (let index = 0; index < payload.length; index += chunkSize) {
    const chunk = payload.slice(index, index + chunkSize);
    await prisma.simulationExercise.createMany({
      data: chunk,
      skipDuplicates: true,
    });
  }

  console.log(`Seeded ${payload.length} simulation exercises`);
}

async function main(): Promise<void> {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const csvPath = path.resolve(__dirname, "..", "..", "topics_all_modules.csv");

  console.log("Seeding database...");
  await seedAdmin();
  await seedCourses();
  const topics = await loadTopicsFromCsv(csvPath, COURSE_ID);
  if (topics.length > 0) {
    await seedTopics(topics);
    await seedSimulationExercises(topics);
  } else {
    console.warn("No topics were seeded because the CSV was missing.");
  }
  await seedPageContent();
  console.log("Database seed completed.");
}

async function seedPageContent(): Promise<void> {
  for (const page of PAGE_CONTENT) {
    await prisma.pageContent.upsert({
      where: { slug: page.slug },
      create: page,
      update: page,
    });
  }
}

async function seedAdmin(): Promise<void> {
  const passwordHash = await hashPassword(ADMIN_PASSWORD);
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    create: {
      email: ADMIN_EMAIL,
      fullName: ADMIN_NAME,
      passwordHash,
      role: "admin",
    },
    update: {
      fullName: ADMIN_NAME,
      role: "admin",
      passwordHash,
    },
  });
}

main()
  .catch((error) => {
    console.error("Database seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
