import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { config } from "@/lib/config";

// Thin wrapper around the Claude API. Centralises three things so the rest of
// the engine never repeats them: reading the key, the default model, and a
// clear error when the key is missing. Server-side only — the key is read from
// process.env, which Next.js never ships to the browser (KTD9).

function getClient(): Anthropic {
  // .trim() defends against stray whitespace pasted into the key (e.g. a
  // trailing newline or invisible Unicode separator), which would otherwise
  // break the HTTP auth header.
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local (see .env.example).",
    );
  }
  return new Anthropic({ apiKey });
}

export interface ClaudeTextOptions {
  prompt: string;
  system?: string;
  model?: string;
  maxTokens?: number;
}

// Send one message to Claude and return its reply as plain text.
// Later stages (resolve, extract, draft) build on this same call.
export async function claudeText({
  prompt,
  system,
  model = config.claude.model,
  maxTokens = 1024,
}: ClaudeTextOptions): Promise<string> {
  const client = getClient();
  const message = await client.messages.create({
    model,
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages: [{ role: "user", content: prompt }],
  });

  // A reply can contain several content blocks; keep the text ones and join.
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}

export interface ClaudeStructuredOptions<T extends z.ZodType> {
  // The expected shape of Claude's answer, as a Zod schema.
  schema: T;
  prompt: string;
  system?: string;
  model?: string;
  maxTokens?: number;
}

// Ask Claude for data in a fixed shape and get back a validated, typed object.
// Uses Anthropic's structured-outputs feature, which *constrains* the model to
// return JSON matching the schema — so we never have to hand-parse a string or
// retry on malformed JSON. The Zod schema is the single source of truth for the
// shape, its validation, and its TypeScript type.
export async function claudeStructured<T extends z.ZodType>({
  schema,
  prompt,
  system,
  model = config.claude.model,
  maxTokens = 1024,
}: ClaudeStructuredOptions<T>): Promise<z.infer<T>> {
  const client = getClient();
  const message = await client.messages.parse({
    model,
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages: [{ role: "user", content: prompt }],
    output_config: { format: zodOutputFormat(schema) },
  });

  if (message.stop_reason === "refusal") {
    throw new Error("Claude refused to produce the requested structured output.");
  }
  if (message.parsed_output == null) {
    throw new Error("Claude's reply did not match the expected structured shape.");
  }
  return message.parsed_output;
}
