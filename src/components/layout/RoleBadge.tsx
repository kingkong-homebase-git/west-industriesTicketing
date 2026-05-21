interface RoleBadgeProps {
  role: string;
}

export default function RoleBadge({ role }: RoleBadgeProps) {
  const isSuperUser = role === "super_user";
  const isAdmin = role === "admin";
  const label = role === "super_user" ? "Super User" : role === "admin" ? "Admin" : "Team Member";
  
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border"
      style={{
        background: isSuperUser 
          ? "rgba(249,115,22,0.15)" 
          : isAdmin 
            ? "rgba(6,182,212,0.15)" 
            : "rgba(139,144,167,0.1)",
        color: isSuperUser 
          ? "var(--accent)" 
          : isAdmin 
            ? "#06b6d4" 
            : "var(--text-secondary)",
        borderColor: isSuperUser 
          ? "rgba(249,115,22,0.3)" 
          : isAdmin 
            ? "rgba(6,182,212,0.3)" 
            : "rgba(139,144,167,0.2)",
      }}
    >
      {label}
    </span>
  );
}
