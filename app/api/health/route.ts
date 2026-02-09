import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { getPineconeClient } from "@/lib/pinecone";

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  checks: {
    database: CheckResult;
    pinecone: CheckResult;
    openai: CheckResult;
  };
}

interface CheckResult {
  status: "ok" | "error";
  latencyMs?: number;
  error?: string;
}

async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (error) {
    return {
      status: "error",
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : "Database connection failed",
    };
  }
}

async function checkPinecone(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const client = getPineconeClient();
    await client.listIndexes();
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (error) {
    return {
      status: "error",
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : "Pinecone connection failed",
    };
  }
}

async function checkOpenAI(): Promise<CheckResult> {
  const start = Date.now();
  try {
    // Light check: verify the API key is configured
    if (!process.env.OPENAI_API_KEY && !process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
      return { status: "error", error: "OpenAI API key not configured" };
    }
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (error) {
    return {
      status: "error",
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : "OpenAI check failed",
    };
  }
}

export async function GET() {
  const [database, pinecone, openai] = await Promise.all([
    checkDatabase(),
    checkPinecone(),
    checkOpenAI(),
  ]);

  const checks = { database, pinecone, openai };
  const allOk = Object.values(checks).every((c) => c.status === "ok");
  const anyError = Object.values(checks).some((c) => c.status === "error");

  const health: HealthStatus = {
    status: allOk ? "healthy" : anyError ? "degraded" : "healthy",
    timestamp: new Date().toISOString(),
    checks,
  };

  return NextResponse.json(health, {
    status: allOk ? 200 : 503,
  });
}
