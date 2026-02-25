/**
 * AI 없이 키워드 기반으로 메일을 프로젝트에 매칭
 */

interface ProjectForMatch {
  id: number;
  name: string;
  keywords: string[];
}

export function matchMailToProject(
  subject: string,
  projects: ProjectForMatch[]
): number | null {
  if (projects.length === 0) return null;

  const subjectLower = subject.toLowerCase().replace(/^(re:|fwd:|fw:)\s*/gi, "");
  let bestMatch: number | null = null;
  let bestScore = 0;

  for (const project of projects) {
    let score = 0;

    // Check if project name appears in subject (strongest signal)
    const nameLower = project.name.toLowerCase();
    if (subjectLower.includes(nameLower)) {
      score += 3;
    }

    // Check each keyword
    for (const kw of project.keywords) {
      if (!kw) continue;
      const kwLower = kw.toLowerCase();
      if (subjectLower.includes(kwLower)) {
        score += 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = project.id;
    }
  }

  return bestMatch;
}

/**
 * 여러 메일을 한번에 매칭
 */
export function matchMailsToProjects(
  mails: { id: string; subject: string }[],
  projects: ProjectForMatch[]
): { mailId: string; projectId: number }[] {
  const results: { mailId: string; projectId: number }[] = [];

  for (const mail of mails) {
    const projectId = matchMailToProject(mail.subject, projects);
    if (projectId !== null) {
      results.push({ mailId: mail.id, projectId });
    }
  }

  return results;
}
