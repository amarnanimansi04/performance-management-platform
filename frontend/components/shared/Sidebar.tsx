"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import {
  BarChart3,
  LayoutDashboard,
  Target,
  CheckSquare,
  Users,
  ThumbsUp,
  Activity,
  Grid3x3,
  ScrollText,
  Download,
  LogOut,
} from "lucide-react";
import type { Role } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";

const navLinks: Record<
  Role,
  { label: string; href: string; icon: React.ReactNode }[]
> = {
  employee: [
    { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard size={18} /> },
    { label: "My Goals", href: "/goals", icon: <Target size={18} /> },
    { label: "Check-ins", href: "/goals/checkins", icon: <CheckSquare size={18} /> },
  ],
  manager: [
    { label: "Dashboard", href: "/manager/dashboard", icon: <LayoutDashboard size={18} /> },
    { label: "Approvals", href: "/manager/approvals", icon: <ThumbsUp size={18} /> },
    { label: "Team Pulse", href: "/manager/team-pulse", icon: <Activity size={18} /> },
  ],
  admin: [
    { label: "Dashboard", href: "/admin/dashboard", icon: <LayoutDashboard size={18} /> },
    { label: "9-Box Grid", href: "/admin/nine-box", icon: <Grid3x3 size={18} /> },
    { label: "Audit Log", href: "/admin/audit-log", icon: <ScrollText size={18} /> },
    { label: "Export", href: "/admin/export", icon: <Download size={18} /> },
  ],
};

const roleBadgeColors: Record<Role, string> = {
  employee: "bg-slate-100 text-slate-600",
  manager: "bg-indigo-100 text-indigo-700",
  admin: "bg-purple-100 text-purple-700",
};

interface SidebarProps {
  role: Role;
  userName: string;
}

export function Sidebar({ role, userName }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const links = navLinks[role];

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="w-64 min-h-screen bg-white border-r border-slate-200 flex flex-col">
      <div className="px-5 py-6 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-600 rounded-lg">
            <BarChart3 size={20} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 leading-tight">
              Performance Management
            </p>
            <p className="text-xs text-slate-400">Platform</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={clsx("nav-item", { active: pathname === link.href })}
          >
            {link.icon}
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-slate-100">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-700 truncate">{userName}</p>
            <span
              className={clsx(
                "inline-block mt-0.5 px-2 py-0.5 rounded-full text-xs font-medium capitalize",
                roleBadgeColors[role]
              )}
            >
              {role}
            </span>
          </div>
          <button
            onClick={handleSignOut}
            className="ml-2 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
