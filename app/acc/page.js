import { renderWorkspaceHome } from "../page";

export const revalidate = 3600;

export default async function AccountRoutePage({ searchParams }) {
  return renderWorkspaceHome(searchParams, "account");
}
