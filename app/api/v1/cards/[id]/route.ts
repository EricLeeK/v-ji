import { handleCardItem } from "@/lib/agent/http";
import { productionRuntime } from "@/lib/agent/production";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return handleCardItem(request, id, productionRuntime);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return handleCardItem(request, id, productionRuntime);
}

export async function OPTIONS(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return handleCardItem(request, id, productionRuntime);
}
