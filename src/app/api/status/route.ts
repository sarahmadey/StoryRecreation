import { appStatus } from "@/lib/server/config";
import { route } from "@/lib/server/auth";

export const GET = route(async () => Response.json(appStatus()));
