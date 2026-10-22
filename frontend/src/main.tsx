import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { TideConfiguredContext, loadTideConfig } from './app/tideContext'
import './index.css'

const root = createRoot(document.getElementById('root')!)

async function start() {
  const config = await loadTideConfig()
  if (!config) {
    // Production build: no simulation to fall back to, so a missing realm is a hard stop.
    root.render(
      <p role="alert" className="p-6 text-sm">
        SafeThreshold cannot start: no TideCloak realm is configured (public/tidecloak.json is missing).
      </p>,
    )
    return
  }
  const { TideProvider } = await import('./app/TideConnected')
  root.render(
    <StrictMode>
      <TideConfiguredContext.Provider value>
        <TideProvider config={config}>
          <App />
        </TideProvider>
      </TideConfiguredContext.Provider>
    </StrictMode>,
  )
}

void start()
