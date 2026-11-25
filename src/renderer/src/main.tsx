import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// Fonts bundled with the app (OFL), so the UI and the text burnt into the video look the same
// offline. Only the weights the app uses.
import '@fontsource/be-vietnam-pro/300.css';
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/jetbrains-mono/700.css';
import '@fontsource/playfair-display/500.css';
import '@fontsource/playfair-display/500-italic.css';
// Title fonts for the text panel (D28): normal / bold / italic where the font has them, Latin + Vietnamese only.
import '@fontsource/be-vietnam-pro/latin-700.css';
import '@fontsource/be-vietnam-pro/vietnamese-700.css';
import '@fontsource/be-vietnam-pro/latin-300-italic.css';
import '@fontsource/be-vietnam-pro/vietnamese-300-italic.css';
import '@fontsource/be-vietnam-pro/latin-400-italic.css';
import '@fontsource/be-vietnam-pro/vietnamese-400-italic.css';
import '@fontsource/playfair-display/latin-400.css';
import '@fontsource/playfair-display/vietnamese-400.css';
import '@fontsource/playfair-display/latin-700.css';
import '@fontsource/playfair-display/vietnamese-700.css';
import '@fontsource/playfair-display/latin-400-italic.css';
import '@fontsource/playfair-display/vietnamese-400-italic.css';
import '@fontsource/playfair-display/latin-700-italic.css';
import '@fontsource/playfair-display/vietnamese-700-italic.css';
import '@fontsource/montserrat/latin-400.css';
import '@fontsource/montserrat/vietnamese-400.css';
import '@fontsource/montserrat/latin-700.css';
import '@fontsource/montserrat/vietnamese-700.css';
import '@fontsource/montserrat/latin-400-italic.css';
import '@fontsource/montserrat/vietnamese-400-italic.css';
import '@fontsource/montserrat/latin-700-italic.css';
import '@fontsource/montserrat/vietnamese-700-italic.css';
import '@fontsource/lora/latin-400.css';
import '@fontsource/lora/vietnamese-400.css';
import '@fontsource/lora/latin-700.css';
import '@fontsource/lora/vietnamese-700.css';
import '@fontsource/lora/latin-400-italic.css';
import '@fontsource/lora/vietnamese-400-italic.css';
import '@fontsource/lora/latin-700-italic.css';
import '@fontsource/lora/vietnamese-700-italic.css';
import '@fontsource/dancing-script/latin-400.css';
import '@fontsource/dancing-script/vietnamese-400.css';
import '@fontsource/dancing-script/latin-700.css';
import '@fontsource/dancing-script/vietnamese-700.css';
import '@fontsource/great-vibes/latin-400.css';
import '@fontsource/great-vibes/vietnamese-400.css';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
