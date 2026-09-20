import axios from 'axios'
import { getMaxInitData } from '../platform/max'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const initData = getMaxInitData()
  if (initData) config.headers['X-Max-Init-Data'] = initData
  return config
})
