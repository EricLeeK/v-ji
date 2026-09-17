import { createPipelineClient } from "@/lib/supabase/admin";
import { runGenerateCardsPipeline } from "@/lib/ai/pipeline";

async function runReadAndGenerate(jobId: string) {
  "use step";
  console.log("ai generate cards", jobId);
  const client = createPipelineClient();
  await runGenerateCardsPipeline(jobId, client);
}

export async function generateCardsWorkflow(jobId: string) {
  "use workflow";
  await runReadAndGenerate(jobId);
}
