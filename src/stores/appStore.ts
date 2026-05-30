import { createSignal } from 'solid-js';

type AppTab = 'today' | 'calendar' | 'generators';

const [activeTab, setActiveTab] = createSignal<AppTab>('today');

export type { AppTab };
export { activeTab, setActiveTab };
