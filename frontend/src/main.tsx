import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { WorldProvider } from './app/WorldProvider'
import { TideConfiguredContext, loadTideConfig } from './app/tideContext'
import './index.css'

const root = createRoot(document.getElementById('root')!)

async function start() {
  const config = await loadTideConfig()
  const app = (
    <WorldProvider>
      <App />
    </WorldProvider>
  )
  // The Tide SDK is only downloaded when a realm is configured.
  const TideProvider = config ? (await import('./app/TideConnected')).TideProvider : null
  root.render(
    <StrictMode>
      <TideConfiguredContext.Provider value={config !== null}>
        {TideProvider && config ? <TideProvider config={config}>{app}</TideProvider> : app}
      </TideConfiguredContext.Provider>
    </StrictMode>,
  )
}

void start()
