/* @refresh reload */
import { render } from 'solid-js/web';
import './styles/global.css';
import { App } from './App.tsx';
import { registerSW } from 'virtual:pwa-register';

const root = document.getElementById('root');
render(() => <App />, root!);

registerSW({ immediate: true });
