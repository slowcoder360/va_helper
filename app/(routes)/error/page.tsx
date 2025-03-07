// app/error/page.tsx

'use client'

import { useSearchParams } from 'next/navigation';

export default function ErrorPage() {
  const searchParams = useSearchParams();
  const message = searchParams.get('message') || 'An error occurred.';

  return (
    <div className='items-center justify-start text-center mt-3'>
      <h1>Error</h1>
      <p>{decodeURIComponent(message)}</p>
    </div>
  );
}
