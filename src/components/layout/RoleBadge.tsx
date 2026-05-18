interface RoleBadgeProps {
  role: string;
}

export default function RoleBadge({ role }: RoleBadgeProps) {
  const isSuperUser = role === "super_user";
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{
        background: isSuperUser ? "rgba(99,102,241,0.15)" : "rgba(139,144,167,0.1)",
        color: isSuperUser ? "var(--accent)" : "var(--text-secondary)",
      }}
    >
      {isSuperUser ? "Super User" : "Team Member"}
    </span>
  );
}
