/** Legacy entry point; settings are always the canonical modal, never a separate page. */
import { useNavigate } from 'react-router-dom'
import { SettingsSheet } from './SettingsSheet'
export function SettingsView() {
  const navigate = useNavigate()
  return <SettingsSheet routeOpen onRouteClose={() => navigate('/', { replace: true })} />
}
