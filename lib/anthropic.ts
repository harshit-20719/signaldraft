import Anthropic from "@anthropic-ai/sdk";
import { config } from "@/lib/config";

// Thin wrapper around the Claude API. Centralises three things so the rest of
// the engine never repeats them: reading the key, the default model, and a
// clear error when the key is missing. Server-side only — the key is read from
// process.env, which Next.js never ships to the browser (KTD9).

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
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
