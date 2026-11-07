import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-ink-2">
          The page you asked for doesn&apos;t exist in this prototype — or it was
          moved. Nothing was changed on any server.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm font-medium text-accent hover:underline">
          Back to your landing page
        </Link>
      </div>
    </main>
  );
}
