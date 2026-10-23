import { handleIdentity } from "@/lib/api/handleIdentity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export function GET(request: Request): Promise<Response> {
  return handleIdentity(request);
}
