import { NavLink } from 'react-router-dom';

const tabs = [
  { path: '/chart', label: 'Chart' },
  { path: '/analysis', label: 'Analysis' },
];

export function TabBar() {
  return (
    <nav className="flex bg-[#0d1117] border-b border-gray-800 px-4">
      {tabs.map((tab) => (
        <NavLink
          key={tab.path}
          to={tab.path}
          className={({ isActive }) =>
            `px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              isActive
                ? 'text-blue-400 border-blue-400'
                : 'text-gray-400 border-transparent hover:text-gray-200'
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
