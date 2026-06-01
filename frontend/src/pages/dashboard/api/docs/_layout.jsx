import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usePermissions } from '@/contexts/PermissionsContext';
import { ChevronRight } from 'lucide-react';

const BASE = '/dashboard/api/docs';

const MODULES = [
  { path: 'employees',    label: 'Employees',    gate: null },
  { path: 'rangs',        label: 'Rangs',        gate: null },
  { path: 'clients',      label: 'Clients',      gate: 'clients' },
  { path: 'comptabilite', label: 'Comptabilité', gate: 'comptabilite' },
  { path: 'chat',         label: 'Chat',         gate: 'chat' },
  { path: 'boxs',         label: 'Boxs',         gate: 'boxs' },
  { path: 'inventory',    label: 'Inventory',    gate: 'inventory' },
  { path: 'garage',       label: 'Garage',       gate: 'garage' },
];

function NavLink({ to, active, children }) {
  return (
    <Link
      to={to}
      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-sm transition
        ${active
          ? 'bg-brand-primary/15 text-brand-primary font-medium'
          : 'text-cca-textSecondary hover:text-cca-textPrimary hover:bg-cca-surface'}`}
    >
      <span>{children}</span>
      {active && <ChevronRight size={12} />}
    </Link>
  );
}

function SectionLink({ id, label, active }) {
  const handleClick = (e) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <button
      onClick={handleClick}
      className={`w-full text-left pl-5 pr-3 py-1 rounded-md text-xs transition flex items-center gap-1.5
        ${active
          ? 'text-brand-primary font-medium'
          : 'text-cca-textSecondary hover:text-cca-textPrimary'}`}
    >
      <span className="w-1 h-1 rounded-full bg-current opacity-60 shrink-0" />
      {label}
    </button>
  );
}

export function DocsLayout({ children, sections = [] }) {
  const { pathname } = useLocation();
  const { companyModules, isReady } = usePermissions();
  const [activeSection, setActiveSection] = useState(null);

  const hasModule = (gate) => !gate || !isReady || companyModules.includes(gate);
  const isLanding = pathname === BASE;

  useEffect(() => {
    if (!sections.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length) setActiveSection(visible[0].target.id);
      },
      { rootMargin: '-10% 0px -80% 0px', threshold: 0 }
    );
    sections.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  return (
    <div className="flex gap-10 max-w-5xl mx-auto p-6">
      <aside className="w-44 shrink-0">
        <nav className="sticky top-6 space-y-0.5">
          {!isLanding && (
            <Link
              to={BASE}
              className="flex items-center gap-1.5 px-3 py-1.5 mb-2 text-xs text-cca-textSecondary hover:text-cca-textPrimary transition"
            >
              ← API Docs
            </Link>
          )}
          <p className="pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-cca-textSecondary px-2">
            Modules
          </p>
          {MODULES.filter(m => hasModule(m.gate)).map(m => {
            const isActive = pathname === `${BASE}/${m.path}`;
            return (
              <div key={m.path}>
                <NavLink to={`${BASE}/${m.path}`} active={isActive}>
                  {m.label}
                </NavLink>
                {isActive && sections.length > 0 && (
                  <div className="mt-0.5 mb-1 space-y-0.5">
                    {sections.map(s => (
                      <SectionLink
                        key={s.id}
                        id={s.id}
                        label={s.label}
                        active={activeSection === s.id}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 min-w-0 space-y-10">
        {children}
      </main>
    </div>
  );
}
