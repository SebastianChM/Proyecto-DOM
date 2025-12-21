/**
 * 🔧 Configuración Centralizada de Axios
 *
 * Instancia de axios preconfigurada con:
 * - withCredentials: true (envía cookies de sesión)
 * - baseURL configurada
 * - Timeouts razonables
 */

import axios from "axios";

// Use empty string to leverage Next.js proxy/rewrites by default (works for both localhost and ngrok)
const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

// Crear instancia de axios con configuración por defecto
export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true, // ✅ CRÍTICO: Envía cookies de sesión
  timeout: 30000, // 30 segundos
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor para logging (solo en desarrollo)
// Interceptor para logging (solo en desarrollo)
if (process.env.NODE_ENV === "development") {
  apiClient.interceptors.request.use(
    (config) => {
      // console.log(`🌐 API Request: ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    },
    (error) => {
      console.warn("⚠️ Request Error:", error);
      return Promise.reject(error);
    },
  );

  apiClient.interceptors.response.use(
    (response) => {
      // console.log(`✅ API Response: ${response.status} ${response.config.url}`);
      return response;
    },
    (error) => {
      // Only log actual network/server errors, not 4xx validation errors which are handled by UI
      if (error.response && error.response.status >= 500) {
        console.error(
          `❌ API Error: ${error.response.status} ${error.config?.url}`,
          {
            data: error.response.data,
          },
        );
      } else if (!error.response) {
        console.error("❌ Network Error:", error.message);
      }
      return Promise.reject(error);
    },
  );
}

export default apiClient;
