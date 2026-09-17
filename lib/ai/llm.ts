import {
  type AiGenerateSettings,
} from "@/lib/ai/schemas";
import { DEEPSEEK_CHAT_URL, DEEPSEEK_MODEL } from "@/lib/ai/provider";
import type { AiDb } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

export type LlmUsage = {
  model: string;
  promptTokens: number;
  cacheHitTokens: number;
  completionTokens: number;
};

export type LlmImage = { mime: string; data: string };

export type LlmRequest = {
  system: string;
  user: string;
  images?: LlmImage[];
  thinking?: boolean;
  kind: "outline" | "cards";
};

export type LlmClient = {
  completeJson(request: LlmRequest): Promise<{ data: unknown; usage: LlmUsage }>;
};

export function createLlmClient(apiKey: string): LlmClient {
  return new DeepSeekLlmClient(apiKey);
}

export async function recordUsage(client: AiDb, ownerId: string, jobId: string, usage: LlmUsage) {
  await client.from("ai_usage").insert({
    owner_id: ownerId,
    job_id: jobId,
    model: usage.model,
    prompt_tokens: usage.promptTokens,
    cache_hit_tokens: usage.cacheHitTokens,
    completion_tokens: usage.completionTokens,
  });
}

class DeepSeekLlmClient implements LlmClient {
  constructor(private readonly apiKey: string) {}

  async completeJson(request: LlmRequest) {
    const userContent = request.images?.length
      ? [
          { type: "text", text: request.user },
          ...request.images.map((image) => ({
            type: "image_url" as const,
            image_url: {
              url: `data:${image.mime};base64,${image.data}`,
              detail: "auto" as const,
            },
          })),
        ]
      : request.user;

    const response = await fetch(DEEPSEEK_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: "system", content: `${request.system}\n只输出合法 JSON 对象。` },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
        thinking: { type: request.thinking ? "enabled" : "disabled" },
        reasoning_effort: request.thinking ? "low" : undefined,
      }),
    });

    if (response.status === 429) {
      throw new RetryableLlmError("模型限流，请稍后重试");
    }
    if (response.status === 401) {
      throw new Error("DeepSeek API Key 无效，请到设置中重新填写");
    }
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`DeepSeek 请求失败：${response.status} ${body.slice(0, 300)}`);
    }
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        prompt_cache_hit_tokens?: number;
      };
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("模型没有返回内容");
    const data = parseJsonObject(content);
    const usage: LlmUsage = {
      model: DEEPSEEK_MODEL,
      promptTokens: payload.usage?.prompt_tokens ?? 0,
      cacheHitTokens: payload.usage?.prompt_cache_hit_tokens ?? 0,
      completionTokens: payload.usage?.completion_tokens ?? 0,
    };
    return { data, usage };
  }
}

export class RetryableLlmError extends Error {}

function parseJsonObject(raw: string) {
  const trimmed = raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
    }
    throw new Error("模型输出不是合法 JSON");
  }
}

export function parseSettings(raw: Json | null | undefined): AiGenerateSettings {
  const fallback: AiGenerateSettings = {
    types: "auto",
    coverage: "core",
    cardLimit: "auto",
    detail: "brief",
    grounding: "source_only",
    layout: "auto",
  };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;
  const value = raw as Record<string, unknown>;
  return {
    types: Array.isArray(value.types) ? (value.types as AiGenerateSettings["types"]) : "auto",
    coverage: value.coverage === "full" ? "full" : "core",
    cardLimit: typeof value.cardLimit === "number" ? value.cardLimit : "auto",
    detail: value.detail === "detailed" || value.detail === "standard" ? value.detail : "brief",
    grounding: value.grounding === "allow_supplement" ? "allow_supplement" : "source_only",
    layout:
      value.layout === "minimal" || value.layout === "emphasis" || value.layout === "illustrated"
        ? value.layout
        : "auto",
  };
}
