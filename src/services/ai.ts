import { invoke } from "@tauri-apps/api/core";
import type { AIClassificationResult, MailCategory } from "../types";

const SYSTEM_PROMPT = `너는 이메일 분류 전문가야. 이메일 제목과 발신자 정보를 보고 카테고리를 분류해줘.

카테고리 종류:
- urgent: 긴급한 메일 (장애, 긴급 요청, 즉시 처리 필요)
- approval: 결재/승인 관련 메일
- external: 외부 발신 메일
- internal: 내부 업무 메일
- system: 시스템 자동 발송 메일 (알림, 노티피케이션)
- uncategorized: 분류 불가

반드시 아래 JSON 형식으로 응답해:
{
  "category": "카테고리명",
  "confidence": 0.0~1.0,
  "reason": "분류 이유 한 줄"
}`;

export async function classifyWithAI(
  apiKey: string,
  subject: string,
  senderEmail: string
): Promise<AIClassificationResult> {
  const userPrompt = `제목: ${subject}\n발신자: ${senderEmail}`;

  const response = await invoke<string>("call_groq_api", {
    apiKey,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
  });

  const parsed = JSON.parse(response);

  return {
    category: parsed.category as MailCategory,
    confidence: parsed.confidence ?? 0,
    reason: parsed.reason ?? "",
  };
}

export async function classifyBatchWithAI(
  apiKey: string,
  mails: { subject: string; sender_email: string }[]
): Promise<AIClassificationResult[]> {
  const userPrompt = mails
    .map((m, i) => `[${i + 1}] 제목: ${m.subject} | 발신자: ${m.sender_email}`)
    .join("\n");

  const batchSystemPrompt = `${SYSTEM_PROMPT}

여러 메일이 주어지면 각각 분류해서 배열로 응답해:
{ "results": [ { "category": "...", "confidence": 0.0~1.0, "reason": "..." }, ... ] }`;

  const response = await invoke<string>("call_groq_api", {
    apiKey,
    systemPrompt: batchSystemPrompt,
    userPrompt,
  });

  const parsed = JSON.parse(response);
  return (parsed.results ?? [parsed]).map(
    (r: { category: string; confidence: number; reason: string }) => ({
      category: r.category as MailCategory,
      confidence: r.confidence ?? 0,
      reason: r.reason ?? "",
    })
  );
}
