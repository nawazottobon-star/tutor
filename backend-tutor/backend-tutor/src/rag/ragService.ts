import { Prisma } from "@prisma/client";
import { createEmbedding, generateAnswerFromContext } from "./openAiClient";
import { scrubPossiblePii } from "./pii";
import { logRagUsage } from "./usageLogger";
import { prisma } from "../services/prisma";

type ChunkPayload = {
  chunkId: string;
  content: string;
  courseId: string;
  position: number;
  embedding: number[];
};

type QueryContext = {
  chunkId: string;
  content: string;
  score: number;
};

type ConversationTurn = {
  role: "user" | "assistant";
  content: string;
};

const VECTOR_QUERY_LIMIT = 5;
const EMBEDDING_DIMENSIONS = 1536;
const INSERT_BATCH_SIZE = 50;

export async function replaceCourseChunks(courseTitle: string, chunks: ChunkPayload[]): Promise<void> {
  if (chunks.length === 0) {
    throw new Error("No chunks generated from course material.");
  }

  const courseId = chunks[0]?.courseId;
  if (!courseId) {
    throw new Error("Chunks are missing course identifiers.");
  }

  await prisma.$executeRaw(
    Prisma.sql`
      DELETE FROM course_chunks
      WHERE course_id = ${courseId}
    `,
  );

  for (let i = 0; i < chunks.length; i += INSERT_BATCH_SIZE) {
    const batch = chunks.slice(i, i + INSERT_BATCH_SIZE);
    const values = batch.map((chunk) => {
      const embedding = normalizeEmbedding(chunk.embedding);
      const vectorLiteral = toVectorLiteral(embedding);
      return Prisma.sql`(${chunk.chunkId}, ${chunk.courseId}, ${normalizePosition(chunk.position)}, ${chunk.content}, ${Prisma.raw(vectorLiteral)})`;
    });

    await prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO course_chunks (chunk_id, course_id, position, content, embedding)
        VALUES ${Prisma.join(values)}
        ON CONFLICT (chunk_id)
        DO UPDATE SET
          course_id = EXCLUDED.course_id,
          position = EXCLUDED.position,
          content = EXCLUDED.content,
          embedding = EXCLUDED.embedding
      `,
    );
  }
}

export async function askCourseAssistant(options: {
  courseId: string;
  courseTitle?: string;
  question: string;
  userId: string;
  conversation?: ConversationTurn[];
  summary?: string | null;
  personaPrompt?: string | null;
}): Promise<{ answer: string }> {
  const sanitizedQuestion = scrubPossiblePii(options.question ?? "").trim();
  if (!sanitizedQuestion) {
    throw new Error("A question is required.");
  }

  try {
    const queryEmbedding = await createEmbedding(sanitizedQuestion);
    const contexts = await fetchRelevantContexts(options.courseId, queryEmbedding);

    if (contexts.length === 0) {
      logRagUsage(options.userId, "success");
      return {
        answer:
          "I don't have enough details in the course materials to answer that. Could you try asking about another topic covered here?",
      };
    }

    const prompt = buildPrompt({
      courseTitle: options.courseTitle ?? "Ottolearn Course",
      question: sanitizedQuestion,
      contexts,
      summary: options.summary ?? null,
      conversation: options.conversation ?? [],
      personaPrompt: options.personaPrompt ?? null,
    });

    const answer = await generateAnswerFromContext(prompt);
    logRagUsage(options.userId, "success");
    return { answer };
  } catch (error) {
    logRagUsage(options.userId, "fail");
    throw error;
  }
}

async function fetchRelevantContexts(courseId: string, embedding: number[]): Promise<QueryContext[]> {
  const normalizedEmbedding = normalizeEmbedding(embedding);
  const vectorLiteral = toVectorLiteral(normalizedEmbedding);
  const rows = await prisma.$queryRaw<
    { chunk_id: string; content: string; score: number }[]
  >(Prisma.sql`
      SELECT chunk_id,
             content,
             1 - (embedding <=> ${Prisma.raw(vectorLiteral)}) AS score
      FROM course_chunks
      WHERE course_id = ${courseId}
      ORDER BY embedding <=> ${Prisma.raw(vectorLiteral)}
      LIMIT ${VECTOR_QUERY_LIMIT}
    `);

  return rows.map((row) => ({
    chunkId: row.chunk_id,
    content: row.content,
    score: typeof row.score === "number" ? row.score : Number(row.score),
  }));
}

function buildPrompt(params: {
  courseTitle: string;
  question: string;
  contexts: QueryContext[];
  summary?: string | null;
  conversation?: ConversationTurn[];
  personaPrompt?: string | null;
}): string {
  const contextBlock = params.contexts
    .map((ctx, index) => `Context ${index + 1}:\n${ctx.content}`)
    .join("\n\n");
  const summaryBlock = params.summary?.trim()
    ? `Conversation summary:\n${params.summary.trim()}`
    : "";
  const historyBlock =
    params.conversation && params.conversation.length > 0
      ? [
        "Recent conversation:",
        params.conversation
          .map((turn) => `${turn.role === "user" ? "User" : "Assistant"}: ${turn.content}`)
          .join("\n"),
      ].join("\n")
      : "";
  const personaBlock = params.personaPrompt?.trim()
    ? `Learner personalization:\n${params.personaPrompt.trim()}`
    : "";

  return [
    `You are a warm, encouraging mentor assisting a learner in the course "${params.courseTitle}".`,
    "Use conversation history only to understand the learner's intent.",
    "Answer using only the provided contexts from the official course material.",
    "If the answer is not contained in the contexts, politely say you don't have that information.",
    "Respond in 3-6 sentences total and keep the tone human and supportive.",
    "",
    personaBlock,
    summaryBlock,
    historyBlock,
    "Course contexts:",
    contextBlock,
    "",
    `Learner question: ${params.question}`,
    "Answer:",
  ].join("\n");
}

function normalizeEmbedding(embedding: number[]): number[] {
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error("Embedding vector is empty.");
  }
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Embedding vector must be ${EMBEDDING_DIMENSIONS} dimensions.`);
  }
  return embedding.map((value, index) => {
    if (!Number.isFinite(value)) {
      throw new Error(`Embedding value at index ${index} is not a finite number.`);
    }
    return Number(value);
  });
}

function toVectorLiteral(embedding: number[]): string {
  const payload = embedding.map((value) => value.toString()).join(",");
  return `'[${payload}]'::vector`;
}

function normalizePosition(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.trunc(value);
}
