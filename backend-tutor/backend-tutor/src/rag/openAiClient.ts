import OpenAI from "openai";
import { env } from "../config/env";
import { PERSONA_KEYS } from "../services/personaPromptTemplates";


const client = new OpenAI({
  apiKey: env.openAiApiKey,
});

export async function createEmbedding(text: string): Promise<number[]> {
  const response = await client.embeddings.create({
    model: env.embeddingModel,
    input: text,
  });

  const vector = response.data[0]?.embedding;
  if (!vector) {
    throw new Error("OpenAI did not return an embedding vector");
  }
  return vector;
}

async function runChatCompletion(options: {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const completion = await client.chat.completions.create({
    model: env.llmModel,
    temperature: options.temperature ?? 0.2,
    messages: [
      { role: "system", content: options.systemPrompt },
      { role: "user", content: options.userPrompt },
    ],
    max_tokens: options.maxTokens ?? 500,
  });

  const message = completion.choices[0]?.message?.content?.trim();
  if (!message) {
    throw new Error("OpenAI did not return a chat completion");
  }
  return message;
}

export async function generateAnswerFromContext(prompt: string): Promise<string> {
  return runChatCompletion({
    systemPrompt: "You are Ottolearn's AI mentor. Answer with warmth and clarity using only the provided course material.",
    userPrompt: prompt,
  });
}

export async function rewriteFollowUpQuestion(options: {
  question: string;
  lastAssistantMessage: string;
  summary?: string | null;
}): Promise<string> {
  const summaryBlock = options.summary?.trim()
    ? `Conversation summary:\n${options.summary.trim()}`
    : "";
  const prompt = [
    "Rewrite the user's question so it is a standalone question that preserves the intended meaning.",
    "Use the previous assistant response for context. If the question is already clear, return it unchanged.",
    "Return only the rewritten question text.",
    "",
    summaryBlock,
    `Previous assistant response:\n${options.lastAssistantMessage}`,
    `User question:\n${options.question}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return runChatCompletion({
    systemPrompt:
      "You rewrite follow-up questions into standalone questions without adding new information.",
    userPrompt: prompt,
    temperature: 0.1,
    maxTokens: 80,
  });
}

export async function summarizeConversation(options: {
  previousSummary?: string | null;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<string> {
  const historyBlock = options.messages
    .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
    .join("\n");
  const summaryBlock = options.previousSummary?.trim()
    ? `Existing summary:\n${options.previousSummary.trim()}`
    : "";
  const prompt = [
    "Summarize the conversation so far. Focus on the learner's goals, questions, and key definitions.",
    "Do not invent facts. Keep it concise and useful for future follow-up questions.",
    "",
    summaryBlock,
    "New turns to summarize:",
    historyBlock,
  ]
    .filter(Boolean)
    .join("\n\n");

  return runChatCompletion({
    systemPrompt:
      "You are a helpful assistant that produces concise, factual summaries for chat memory.",
    userPrompt: prompt,
    temperature: 0.2,
    maxTokens: 220,
  });
}

export async function generateTutorCopilotAnswer(prompt: string): Promise<string> {
  return runChatCompletion({
    systemPrompt:
      "You are Ottolearn's intelligent tutor analytics copilot. Your role is to help tutors understand their learners' progress and engagement.\n\n" +
      "INTENT RECOGNITION:\n" +
      "- If the tutor asks about a SPECIFIC COHORT (e.g., 'cohort 1', 'cohort 2'), provide data ONLY for that cohort\n" +
      "- If the tutor asks GENERAL questions (e.g., 'how many students', 'which cohort', 'compare'), analyze ALL cohorts and provide course-wide insights\n" +
      "- If the tutor asks about specific students by name, find them across all cohorts\n\n" +
      "RESPONSE FORMAT:\n" +
      "- Use clear headings and bullet points for multi-part answers\n" +
      "- Always cite specific numbers and names from the provided data\n" +
      "- For cohort comparisons, present data in a structured format\n" +
      "- Flag at-risk learners (< 50% completion) when relevant\n" +
      "- Keep responses concise but complete (3-8 sentences depending on complexity)\n\n" +
      "DATA RULES:\n" +
      "- Use ONLY the provided learner roster, cohort details, and stats\n" +
      "- Never invent or assume data not explicitly provided\n" +
      "- If information is missing, state it clearly\n" +
      "- When listing students, use their actual names from the data\n\n" +
      "EXAMPLES:\n" +
      "Q: 'How many students in cohort 2?' → Answer with cohort 2 data only\n" +
      "Q: 'How many students total?' → Answer with course-wide total across all cohorts\n" +
      "Q: 'Which cohort has most students?' → Compare all cohorts and identify the largest",
    userPrompt: prompt,
    temperature: 0.15,
  });
}

export async function improveEmailMessage(options: {
  originalMessage: string;
  tutorName: string;
  learnerName: string;
  courseName: string;
}): Promise<string> {
  const { originalMessage, tutorName, learnerName, courseName } = options;

  // AI-friendly context for multiple vs single learner
  const isMultiple = learnerName.toLowerCase().includes('selected learners') ||
    learnerName.toLowerCase().includes('students') ||
    learnerName.toLowerCase().includes('group');

  const systemPrompt = `You are an expert educational communication assistant. Your task is to rewrite tutor-to-learner email messages to be:

1. PROFESSIONAL: Use formal, respectful tone appropriate for educational settings
2. CLEAR: Preserve the tutor's original intent and message
3. MOTIVATIONAL: Encourage and inspire the learner with positive language
4. ACTIONABLE: Include a clear call-to-action or next step
5. PERSONALIZED: Use the provided names and context naturally

RULES:
- Do NOT add information not implied by the original message
- Do NOT make assumptions about course content beyond what's stated
- Keep the message concise but warm (2-4 paragraphs ideal)
- Always include a greeting and closing
- Use the tutor's name in the signature
- ${isMultiple ? "Address the recipients as 'students'" : "Address the learner by their name"}
- Reference the course name when relevant
- End with an encouraging call-to-action

OUTPUT: Only the improved email body. No subject line, no explanations.`;

  const userPrompt = `Original message from tutor: "${originalMessage}"

Context:
- Tutor name: ${tutorName}
- Learner name: ${learnerName}
- Course: ${courseName}

Rewrite this message following the guidelines above.`;

  return runChatCompletion({
    systemPrompt,
    userPrompt,
    temperature: 0.7,
    maxTokens: 500,
  });
}

export async function classifyLearnerPersona(options: {
  responses: Array<{ question: string; answer: string }>;
}): Promise<{ personaKey: string; reasoning: string }> {
  const responsesBlock = options.responses
    .map((item, index) => `Q${index + 1}: ${item.question}\nA${index + 1}: ${item.answer}`)
    .join("\n\n");
  const personaDefinitions = [
    "non_it_migrant: new to IT, anxious about programming, prefers slow explanations and real-world analogies.",
    "rote_memorizer: knows theory but struggles to implement, wants templates and exam-style patterns.",
    "english_hesitant: understands logic but struggles with English fluency, needs simple language.",
    "last_minute_panic: behind schedule, needs fast, high-impact guidance and a clear action plan.",
    "pseudo_coder: copy-pastes code, needs line-by-line clarity and small changes to build understanding.",
  ].join("\n");

  const prompt = [
    "Classify the learner into exactly one persona key from the list below.",
    "Return a JSON object with keys: personaKey, reasoning.",
    `Persona keys: ${PERSONA_KEYS.join(", ")}`,
    "Persona definitions:",
    personaDefinitions,
    "",
    "Learner responses:",
    responsesBlock,
  ].join("\n");

  const raw = await runChatCompletion({
    systemPrompt:
      "You are a strict classifier. Return JSON only and choose exactly one personaKey from the provided list.",
    userPrompt: prompt,
    temperature: 0.1,
    maxTokens: 200,
  });

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Persona classification response did not include JSON.");
  }

  const jsonBlock = raw.slice(start, end + 1);
  return JSON.parse(jsonBlock) as { personaKey: string; reasoning: string };
}
