import { renderWorkspaceHome } from "../page";

export const revalidate = 3600;

export default async function McpRoutePage({ searchParams }) {
  return renderWorkspaceHome(searchParams, "mcp");
}
