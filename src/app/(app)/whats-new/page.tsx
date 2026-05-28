import {
  AtSign,
  CalendarDays,
  KanbanSquare,
  LayoutGrid,
  Mail,
  Paperclip,
  Sparkles,
  Star,
  SunMoon,
  Folder,
  type LucideIcon,
} from "lucide-react";

interface Feature {
  icon: LucideIcon;
  title: string;
  desc: string;
  isNew?: boolean;
}

const LATEST: Feature[] = [
  {
    icon: CalendarDays,
    title: "Jacques Calendar",
    desc: "A live, read-only view of the CEO's Google Calendar, right inside Hemisphere — themed to match. Find it in the sidebar.",
    isNew: true,
  },
  {
    icon: AtSign,
    title: "@mentions in comments",
    desc: "Type @ in any task comment to tag a teammate. They get an email so nothing slips through the cracks.",
    isNew: true,
  },
  {
    icon: Star,
    title: "Priority matrix",
    desc: "Tag tasks Urgent / Important (Eisenhower). Urgent & Important tasks get a red star and a dedicated Priority page.",
    isNew: true,
  },
  {
    icon: Mail,
    title: "Smart email alerts",
    desc: "Get emailed when a task is assigned to you, when an urgent task is created, and when a deadline is within 24 hours.",
    isNew: true,
  },
];

const CORE: Feature[] = [
  {
    icon: LayoutGrid,
    title: "4 board views",
    desc: "Switch any board between Kanban, Calendar, Timeline (Gantt) and Feed — your choice sticks per board.",
  },
  {
    icon: Paperclip,
    title: "Attachments",
    desc: "Attach links and documents to any task. Files are stored safely and download in a click.",
  },
  {
    icon: KanbanSquare,
    title: "Team board",
    desc: "See everyone's work grouped by assignee. Super users can create and assign tasks from here.",
  },
  {
    icon: Folder,
    title: "Projects",
    desc: "Group tasks into projects with their own board, accessible from the sidebar.",
  },
  {
    icon: SunMoon,
    title: "Light & dark",
    desc: "A warm sunset theme in both light and dark mode — switch any time from the header.",
  },
  {
    icon: KanbanSquare,
    title: "Checklists & status",
    desc: "Break tasks into checklist items and track progress through clear status columns.",
  },
];

function FeatureCard({ icon: Icon, title, desc, isNew }: Feature) {
  return (
    <div className="group relative bg-surface/30 backdrop-blur-md border border-border rounded-2xl p-5 hover:border-accent/50 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(249,115,22,0.08)] transition-all duration-300">
      {isNew && (
        <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wider text-accent bg-accent/10 border border-accent/30 px-2 py-0.5 rounded-full">
          New
        </span>
      )}
      <div className="w-11 h-11 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-4">
        <Icon size={22} className="text-accent" />
      </div>
      <h3 className="text-base font-semibold text-text-primary mb-1.5">{title}</h3>
      <p className="text-sm text-text-secondary leading-relaxed">{desc}</p>
    </div>
  );
}

export default function WhatsNewPage() {
  return (
    <div className="h-full overflow-y-auto kanban-col-scroll">
      <div className="max-w-5xl mx-auto pb-10">
        {/* Hero */}
        <div className="text-center py-10">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-accent bg-accent/10 border border-accent/25 px-3 py-1 rounded-full mb-5">
            <Sparkles size={13} />
            What&apos;s new
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight bg-gradient-to-r from-[#fb923c] via-[#f9568a] to-[#c026d3] bg-clip-text text-transparent pb-1">
            Hemisphere keeps getting better
          </h1>
          <p className="text-text-secondary mt-4 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
            Your team&apos;s operations hub — tasks, priorities, attachments,
            comments and calendars in one warm, fast workspace. Here&apos;s
            everything it can do.
          </p>
        </div>

        {/* Just landed */}
        <section className="mb-12">
          <h2 className="text-sm font-bold uppercase tracking-widest text-accent/80 mb-4">
            ✨ Just landed
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {LATEST.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </section>

        {/* Everything else */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-widest text-accent/80 mb-4">
            Everything Hemisphere does
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CORE.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </section>

        <p className="text-center text-xs text-text-secondary/60 mt-12">
          Built for the team · Hemisphere
        </p>
      </div>
    </div>
  );
}
