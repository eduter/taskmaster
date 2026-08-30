import calendarIcon from '../icons/tab-calendar.svg?raw';
import generatorsIcon from '../icons/tab-generators.svg?raw';
import { type AppTab, useActiveTab, useAppNavigate } from '../routing/navigation.ts';
import { Icon } from './Icon.tsx';
import { TodayTabIcon } from './TodayTabIcon.tsx';
import './AppTabs.css';

interface TabConfig {
    id: AppTab;
    label: string;
    icon?: string;
}

const TABS: TabConfig[] = [
    { id: 'today', label: "Today's tasks" },
    { id: 'calendar', label: 'Calendar', icon: calendarIcon },
    { id: 'generators', label: 'Generators', icon: generatorsIcon },
];

function AppTabs() {
    const activeTab = useActiveTab();
    const { toTab } = useAppNavigate();

    return (
        <nav class="app-tabs" aria-label="Main navigation">
            {TABS.map((tab) => (
                <button
                    type="button"
                    class="app-tabs__tab"
                    classList={{ 'app-tabs__tab--active': activeTab() === tab.id }}
                    aria-label={tab.label}
                    aria-current={activeTab() === tab.id ? 'page' : undefined}
                    onClick={() => toTab(tab.id)}
                >
                    {tab.id === 'today' ? <TodayTabIcon /> : <Icon src={tab.icon ?? ''} />}
                </button>
            ))}
        </nav>
    );
}

export { AppTabs };
