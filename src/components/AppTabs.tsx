import type { AppTab } from '../stores/appStore.ts';
import calendarIcon from '../icons/tab-calendar.svg?raw';
import generatorsIcon from '../icons/tab-generators.svg?raw';
import todayIcon from '../icons/tab-today.svg?raw';
import { activeTab, setActiveTab } from '../stores/appStore.ts';
import { Icon } from './Icon.tsx';
import './AppTabs.css';

interface TabConfig {
    id: AppTab;
    label: string;
    icon: string;
}

const TABS: TabConfig[] = [
    { id: 'today', label: "Today's tasks", icon: todayIcon },
    { id: 'calendar', label: 'Calendar', icon: calendarIcon },
    { id: 'generators', label: 'Generators', icon: generatorsIcon },
];

function AppTabs() {
    return (
        <nav class="app-tabs" aria-label="Main navigation">
            {TABS.map((tab) => (
                <button
                    type="button"
                    class="app-tabs__tab"
                    classList={{ 'app-tabs__tab--active': activeTab() === tab.id }}
                    aria-label={tab.label}
                    aria-current={activeTab() === tab.id ? 'page' : undefined}
                    onClick={() => setActiveTab(tab.id)}
                >
                    <Icon src={tab.icon} />
                </button>
            ))}
        </nav>
    );
}

export { AppTabs };
