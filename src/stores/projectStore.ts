import { create } from "zustand";
import type { Project } from "../types";
import {
  getProjects,
  getOrCreateProject,
  assignMailToProject,
  getUnassignedMails,
  getProjectNames,
  getProjectsForMatching,
  updateProjectKeywords,
  getTotalMailStats,
  getUnassignedMailStats,
} from "../services/db";
import { analyzeMailProjects } from "../services/ai";
import { matchMailsToProjects } from "../services/matcher";

interface ProjectState {
  projects: Project[];
  totalStats: { total: number; unread: number };
  unassignedStats: { total: number; unread: number };
  analyzing: boolean;

  fetchProjects: () => Promise<void>;
  analyzeAndAssign: (apiKey: string) => Promise<void>;
  assignNewMails: (
    newMails: { id: string; subject: string }[]
  ) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  totalStats: { total: 0, unread: 0 },
  unassignedStats: { total: 0, unread: 0 },
  analyzing: false,

  fetchProjects: async () => {
    const [projects, totalStats, unassignedStats] = await Promise.all([
      getProjects(),
      getTotalMailStats(),
      getUnassignedMailStats(),
    ]);
    set({ projects, totalStats, unassignedStats });
  },

  // AI 분석: 프로젝트 생성 + 키워드 저장 (수동 트리거 또는 첫 실행)
  analyzeAndAssign: async (apiKey: string) => {
    const unassigned = await getUnassignedMails();
    if (unassigned.length === 0) return;

    set({ analyzing: true });
    try {
      const existingNames = await getProjectNames();
      const batchSize = 15;

      for (let i = 0; i < unassigned.length; i += batchSize) {
        const batch = unassigned.slice(i, i + batchSize);
        let assignments;
        try {
          assignments = await analyzeMailProjects(
            apiKey,
            batch.map((m) => ({ id: m.id, subject: m.subject })),
            existingNames
          );
        } catch (err) {
          console.error("[EmailSnap] AI batch error, stopping:", err);
          break;
        }

        if (assignments.length === 0) {
          console.warn("[EmailSnap] AI returned empty, stopping batch loop");
          break;
        }

        // Collect keywords per project for merging
        const projectKeywordsMap = new Map<string, Set<string>>();

        for (const a of assignments) {
          if (a.project_name) {
            const projectId = await getOrCreateProject(a.project_name);
            await assignMailToProject(a.mail_id, projectId);
            if (!existingNames.includes(a.project_name)) {
              existingNames.push(a.project_name);
            }

            // Accumulate keywords per project
            if (a.keywords.length > 0) {
              const existing = projectKeywordsMap.get(a.project_name) ?? new Set();
              a.keywords.forEach((kw) => existing.add(kw));
              projectKeywordsMap.set(a.project_name, existing);
            }
          }
        }

        // Save keywords to DB for each project
        for (const [projectName, keywords] of projectKeywordsMap) {
          const projectsInDb = await getProjectsForMatching();
          const p = projectsInDb.find((x) => x.name === projectName);
          if (p) {
            const merged = [...new Set([...p.keywords, ...keywords])];
            await updateProjectKeywords(p.id, merged);
          }
        }
      }

      await get().fetchProjects();
    } finally {
      set({ analyzing: false });
    }
  },

  // 키워드 매칭으로 분류 (AI 없이)
  assignNewMails: async (newMails) => {
    if (newMails.length === 0) return;

    try {
      const projects = await getProjectsForMatching();
      if (projects.length === 0) return; // no projects yet, skip

      const matches = matchMailsToProjects(newMails, projects);

      for (const m of matches) {
        await assignMailToProject(m.mailId, m.projectId);
      }

      if (matches.length > 0) {
        await get().fetchProjects();
      }

      console.log(
        `[EmailSnap] keyword match: ${matches.length}/${newMails.length} assigned`
      );
    } catch (err) {
      console.error("[EmailSnap] Failed to match new mails:", err);
    }
  },
}));
