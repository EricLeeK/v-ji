import { handleCardCollection } from "@/lib/agent/http";
import { productionRuntime } from "@/lib/agent/production";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handleCardCollection(request, productionRuntime);
}

export function POST(request: Request) {
  return handleCardCollection(request, productionRuntime);
}

export function OPTIONS(request: Request) {
  return handleCardCollection(request, productionRuntime);
}
