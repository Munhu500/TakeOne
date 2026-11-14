export default function NotFound() {
  return (
    <div className="mx-auto mt-24 max-w-md px-6 text-center">
      <h1 className="text-h3">Page not found</h1>
      <p className="mt-2 text-small text-secondary">This link does not point to anything in the preview.</p>
      <p className="mt-6"><a className="text-accent-text hover:underline" href="/">Back to home</a></p>
    </div>
  );
}
