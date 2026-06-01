import { Link, NavLink, Outlet } from "react-router-dom";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
    isActive ? "bg-ink-600 text-white" : "text-zinc-400 hover:text-zinc-200"
  }`;

export default function App() {
  return (
    <div className="min-h-full">
      <header className="border-b border-ink-700 bg-ink-800/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl">🎣</span>
            <span className="text-lg font-bold tracking-tight text-white">ToolHunt</span>
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={navClass}>
              Dashboard
            </NavLink>
            <NavLink to="/connect" className={navClass}>
              Connect
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
