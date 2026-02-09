import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { serviceHistories } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const { userId } = auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch service history records for the user
    const data = await db
      .select()
      .from(serviceHistories)
      .where(eq(serviceHistories.userId, userId));

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Database Fetch Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch service history' },
      { status: 500 }
    );
  }
} 