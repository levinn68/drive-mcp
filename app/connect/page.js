import ConnectGateway from "../../components/connect-gateway";

export const dynamic = "force-dynamic";

const MCP_REGISTRY = "https://registry.modelcontextprotocol.io/v0.1/servers";

async function lookupRegistry(term, exactName) {
  if (!term) return { exact: null, candidates: [], error: null };
  try {
    const url = new URL(MCP_REGISTRY);
    url.searchParams.set("search", term);
    url.searchParams.set("limit", "20");
    url.searchParams.set("version", "latest");
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "DRIVE-MCP/1.2" },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return { exact: null, candidates: [], error: `Official MCP Registry returned HTTP ${response.status}` };
    const payload = await response.json();
    const entries = Array.isArray(payload.servers) ? payload.servers : [];
    const exact = exactName
      ? entries.find((entry) => (entry.server || entry)?.name === exactName) || null
      : entries.find((entry) => (entry.server || entry)?.name?.toLowerCase() === term.toLowerCase()) || null;
    return { exact, candidates: entries.slice(0, 8), error: null };
  } catch (error) {
    return { exact: null, candidates: [], error: error?.message || "Could not reach Official MCP Registry" };
  }
}

export default async function ConnectPage({ searchParams }) {
  const params = await searchParams;
  const serverParam = typeof params?.server === "string" ? params.server.trim() : "";
  const queryParam = typeof params?.query === "string" ? params.query.trim() : "";
  const endpointParam = typeof params?.endpoint === "string" ? params.endpoint.trim() : "";
  const term = serverParam || queryParam;

  const { exact, candidates, error } = await lookupRegistry(term, serverParam || null);

  return (
    <ConnectGateway
      serverParam={serverParam}
      queryParam={queryParam}
      endpointParam={endpointParam}
      initialEntry={exact || (candidates.length === 1 ? candidates[0] : null)}
      candidates={candidates}
      lookupError={error}
    />
  );
}
