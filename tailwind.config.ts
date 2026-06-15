import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // فعلاً middleware را غیرفعال می‌کنیم تا build با موفقیت انجام شود
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
