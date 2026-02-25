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

// ── Project Analysis ──

export interface ProjectAssignment {
  mail_id: string;
  project_name: string;
  keywords: string[];
}

export async function analyzeMailProjects(
  apiKey: string,
  mails: { id: string; subject: string }[],
  existingProjects: string[] = []
): Promise<ProjectAssignment[]> {
  if (mails.length === 0) return [];

  const systemPrompt = `당신은 이메일 제목을 분석하여 프로젝트/업무 단위로 그룹핑하는 전문가입니다.

핵심 규칙 (우선순위 순):
1. 기존 프로젝트 목록이 주어지면, 반드시 기존 프로젝트에 먼저 배정하세요
2. 기존 프로젝트와 비슷한 주제면 반드시 기존 프로젝트 이름을 "정확히 그대로" 사용하세요 (절대 유사한 새 이름 금지)
3. 기존 프로젝트에 전혀 해당하지 않는 완전히 새로운 주제일 때만 새 프로젝트를 만드세요
4. 프로젝트 이름은 간결하게 (예: "인프라 구축", "앱 리뉴얼")
5. [대괄호]나 Re:/Fwd: 접두사에서 프로젝트명을 추출하세요
6. 각 프로젝트에 대해 이메일 제목에서 자주 등장하는 핵심 키워드 3~5개를 추출하세요
7. 반드시 JSON만 응답하세요

응답 형식:
{
  "assignments": [
    { "id": "메일id", "project": "프로젝트명", "keywords": ["키워드1", "키워드2"] }
  ]
}`;

  const mailList = mails.map((m) => ({ id: m.id, subject: m.subject }));

  const existingContext =
    existingProjects.length > 0
      ? `[필수] 기존 프로젝트 목록 (반드시 우선 사용, 새 프로젝트는 최소화):\n${existingProjects.map((p) => `- ${p}`).join("\n")}\n\n`
      : "";

  const userPrompt = `${existingContext}분류할 이메일:\n${JSON.stringify(mailList, null, 2)}`;

  try {
    const response = await invoke<string>("call_groq_api", {
      apiKey,
      systemPrompt,
      userPrompt,
    });

    const parsed = JSON.parse(response);
    return (parsed.assignments || []).map(
      (a: { id: string; project: string; keywords?: string[] }) => ({
        mail_id: String(a.id),
        project_name: String(a.project || ""),
        keywords: Array.isArray(a.keywords) ? a.keywords.map(String) : [],
      })
    );
  } catch (err) {
    console.error("[EmailSnap] AI project analysis error:", err);
    return [];
  }
}
