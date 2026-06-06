/* @refresh reload */
import { Route, Router } from '@solidjs/router';
import { render } from 'solid-js/web';
import './styles/global.css';
import { registerSW } from 'virtual:pwa-register';
import { App, CalendarSection, GeneratorsSection, RedirectToTasks, TasksSection } from './App.tsx';

const root = document.getElementById('root');
if (!root) {
    throw new Error('Root element #root not found');
}

render(
    () => (
        <Router base="/taskmaster" root={App}>
            <Route path="/" component={RedirectToTasks} />
            <Route path="/tasks" component={TasksSection} />
            <Route path="/tasks/:id" component={TasksSection} />
            <Route path="/calendar" component={CalendarSection} />
            <Route path="/generators" component={GeneratorsSection} />
            <Route path="/generators/:id" component={GeneratorsSection} />
        </Router>
    ),
    root
);

registerSW({ immediate: true });
