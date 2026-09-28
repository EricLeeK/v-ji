import { handleMcp } from "@/lib/agent/mcp";
import { productionRuntime } from "@/lib/agent/production";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return handleMcp(request, productionRuntime);
}

export function GET(request: Request) {
  return handleMcp(request, productionRuntime);
}

export function DELETE(request: Request) {
  return handleMcp(request, productionRuntime);
}

export function OPTIONS(request: Request) {
  return handleMcp(request, productionRuntime);
}
