import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 text-center">
      <h1 className="text-4xl font-extrabold text-slate-800">404 - Page Not Found</h1>
      <p className="mt-2 text-slate-600">The page or department record you are looking for does not exist.</p>
      <Link
        href="/dashboard"
        className="mt-6 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
      >
        Return to Dashboard
      </Link>
    </div>
  );
}
