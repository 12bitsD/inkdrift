import type { InkdriftApi } from '../shared/api'

declare global {
  interface Window {
    inkdrift: InkdriftApi
  }
}

export {}
