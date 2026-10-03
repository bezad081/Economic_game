import ReactDOM from 'react-dom/client';
import App from './App';
import CrashShield from './components/CrashShield';
import './styles.css';

window.addEventListener('unhandledrejection',event=>console.error('MACROSTATE unhandled promise rejection',event.reason));
window.addEventListener('error',event=>console.error('MACROSTATE window error',event.error||event.message));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <CrashShield><App/></CrashShield>
);
