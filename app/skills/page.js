import { renderWorkspaceHome } from "../page";

export const revalidate = 3600;

export default async function SkillsRoutePage({ searchParams }) {
  return renderWorkspaceHome(searchParams, "skills");
}
