import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // برای حالا، middleware را غیرفعال می‌کنیم تا بیلد شود
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
