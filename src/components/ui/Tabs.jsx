export default function Tabs({ tabs, active, onChange, label = 'Sections' }) {
  return (
    <nav className="posho-tabbar" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={active === tab.key ? 'active' : ''}
          aria-current={active === tab.key ? 'page' : undefined}
          onClick={() => onChange(tab.key)}
        >
          {tab.icon}
          {tab.label}
          {typeof tab.count === 'number' && tab.count > 0 ? ` · ${tab.count}` : ''}
        </button>
      ))}
    </nav>
  );
}
