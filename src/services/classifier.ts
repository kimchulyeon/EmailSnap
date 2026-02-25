import type { CategoryRule, MailCategory } from "../types";

interface MailInput {
  subject: string;
  sender_email: string;
}

/**
 * 규칙 기반 메일 카테고리 분류
 * 우선순위가 높은(숫자가 작은) 규칙이 먼저 적용됨
 */
export function classifyMail(
  mail: MailInput,
  rules: CategoryRule[],
  companyDomain: string
): MailCategory {
  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

  for (const rule of sortedRules) {
    if (matchesRule(mail, rule, companyDomain)) {
      return rule.name as MailCategory;
    }
  }

  return "uncategorized";
}

function matchesRule(
  mail: MailInput,
  rule: CategoryRule,
  companyDomain: string
): boolean {
  const values = rule.match_value.split(",").map((v) => v.trim().toLowerCase());

  switch (rule.match_type) {
    case "subject_contains":
      return values.some((keyword) =>
        mail.subject.toLowerCase().includes(keyword)
      );

    case "sender_domain": {
      const senderDomain = mail.sender_email.split("@")[1]?.toLowerCase() || "";

      if (rule.match_value === "__EXTERNAL__") {
        return companyDomain !== "" && senderDomain !== companyDomain.toLowerCase();
      }
      if (rule.match_value === "__INTERNAL__") {
        return companyDomain !== "" && senderDomain === companyDomain.toLowerCase();
      }
      return values.some((domain) => senderDomain === domain);
    }

    case "sender_contains":
      return values.some((keyword) =>
        mail.sender_email.toLowerCase().includes(keyword)
      );

    default:
      return false;
  }
}
