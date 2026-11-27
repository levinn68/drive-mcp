import { GET as getAuthServer, OPTIONS as optionsAuthServer } from "../oauth-authorization-server/route";

export const dynamic = "force-dynamic";

export async function GET(request) {
  return getAuthServer(request);
}

export async function OPTIONS(request) {
  return optionsAuthServer(request);
}
