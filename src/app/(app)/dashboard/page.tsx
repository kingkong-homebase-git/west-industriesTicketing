export default function DashboardPage() {
  return (
    <div className="flex items-center justify-center h-full">
      <div
        className="rounded-2xl border p-12 text-center max-w-md"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="text-4xl mb-4">🚀</div>
        <h1 className="text-xl font-semibold text-text-primary mb-2">
          Dashboard
        </h1>
        <p className="text-text-secondary text-sm">
          More modules are coming soon. For now, head over to{" "}
          <a href="/tasks" className="text-accent hover:underline">
            Tasks
          </a>{" "}
          to manage your team&apos;s work.
        </p>
      </div>
    </div>
  );
}
