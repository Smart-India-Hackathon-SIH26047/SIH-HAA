import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="theme-victim flex min-h-svh items-center justify-center bg-canvas px-6 text-ink">
      <div className="text-center">
        <p className="font-medium">This page isn’t here.</p>
        <Link to="/" className="mt-3 inline-block text-sm text-accent-strong underline">
          Go back
        </Link>
      </div>
    </div>
  );
}
