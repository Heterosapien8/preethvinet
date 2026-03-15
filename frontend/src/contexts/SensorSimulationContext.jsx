import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import { ROLES } from '../config/constants'
import sensorSimulationService from '../services/sensorSimulation/SensorSimulationService'

const SensorSimulationContext = createContext(null)

export function SensorSimulationProvider({ children }) {
  const { role } = useAuth()
  const [simulationState, setSimulationState] = useState(sensorSimulationService.getState())

  useEffect(() => sensorSimulationService.subscribe(setSimulationState), [])

  const value = useMemo(() => {
    const isAdmin = role === ROLES.SUPER_ADMIN

    return {
      ...simulationState,
      start: async (options) => {
        if (!isAdmin) {
          console.warn('Sensor simulation start is restricted to super admin users.')
          return simulationState
        }
        return sensorSimulationService.start(options)
      },
      stop: () => {
        if (!isAdmin) {
          console.warn('Sensor simulation stop is restricted to super admin users.')
          return
        }
        sensorSimulationService.stop()
      },
      triggerManualSpike: async (locationId, parameter) => {
        if (!isAdmin) {
          console.warn('Manual sensor spikes are restricted to super admin users.')
          return null
        }
        return sensorSimulationService.triggerManualSpike(locationId, parameter)
      },
    }
  }, [role, simulationState])

  return (
    <SensorSimulationContext.Provider value={value}>
      {children}
    </SensorSimulationContext.Provider>
  )
}

export function useSensorSimulation() {
  const context = useContext(SensorSimulationContext)
  if (!context) {
    throw new Error('useSensorSimulation must be used inside SensorSimulationProvider')
  }
  return context
}
