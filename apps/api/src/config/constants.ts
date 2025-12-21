export const APP_CONFIG = {
  APS: {
    BUCKET_KEY: process.env.APS_BUCKET || "aps-assembly-configurator-dom-demo",
    BASE_URL: "https://developer.api.autodesk.com",
    WEBHOOK_URL: process.env.APS_WEBHOOK_URL, // Optional: URL for Design Automation callbacks
  },
  UPLOAD: {
    ALLOWED_EXTENSIONS: ["rvt", "dwg", "pdf", "ifc", "nwc", "dwf"],
    DESTINATION: "uploads/",
  },
  TEMP_USER: {
    EMAIL: "temp-user@example.com",
    NAME: "Temporary User",
    APS_ID: "temp-user-id",
  },
  LIMITS: {
    MAX_FILE_SIZE_BYTES: parseInt(
      process.env.MAX_FILE_SIZE_BYTES || "209715200",
    ), // 200MB
    MAX_PROJECTS_PER_USER: 50,
    MAX_FILES_PER_PROJECT: 100,
    PROJECT_NAME_MIN_LENGTH: 3,
    PROJECT_NAME_MAX_LENGTH: 50,
  },
  DEMO_MODE: process.env.DEMO_MODE === "true",
};
