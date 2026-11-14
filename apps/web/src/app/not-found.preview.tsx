export default function NotFound() {
  return (
    <div className="mx-auto mt-24 max-w-md px-6 text-center">
      <h1 className="font-display text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-muted">This link does not point to anything in the preview.</p>
      <p className="mt-6"><a className="text-accent hover:underline" href="/">Back to home</a></p>
    </div>
  );
}
