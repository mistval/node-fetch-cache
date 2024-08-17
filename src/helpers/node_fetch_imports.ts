export async function getNodeFetch() {
  const { default: fetch, Request: NodeFetchRequest, Response: NodeFetchResponse } = await import('node-fetch');
  return { fetch, NodeFetchRequest, NodeFetchResponse };
}
